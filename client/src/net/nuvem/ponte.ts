import { lerMudanca, segmentoValido } from '../../lib/nuvem/caminho'
import { ehJson, ehRegistro, lerJsonSeguro, proprio, type Json } from '../../lib/nuvem/json'
import { lerRegistro } from '../../lib/nuvem/fila'
import { lerEnvelope, type RespostaDaOp } from '../../lib/nuvem/lote'
import { VERSAO_DO_FORMATO, type MotivoAdiado, type Op, type OpGravada, type Origem } from '../../lib/nuvem/tipos'
import { comandosDaR1, invocarDoTauri, type Invocar, type PedidoDaR1 } from './comandosDaR1'

/**
 * A PONTE DA NUVEM NO TYPESCRIPT (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.4, fatias R1 e A5): o app do mestre nunca fala com a Cloudflare pela
 * webview. Quem faz o HTTPS é o Rust (`desktop/src-tauri/src/nuvem.rs`, fatia
 * R1), com o Service Token no Cofre do Windows e a URL base fixa no binário.
 * Daqui sai só a rota (um enum fechado) e o corpo; volta o status e o corpo.
 *
 * O CONTRATO DA R1 (`nuvem.rs`, commit 4cd50b1e), do jeito que este arquivo o usa:
 *
 *  - comando `nuvem_pedir({ pedido })`, só na janela main; `pedido` marcado
 *    pelo campo `rota`, campos em camelCase, campo a mais é recusado:
 *      `{ rota: 'eu' }`                                    GET  /api/eu
 *      `{ rota: 'publicar' | 'membros' | 'ops', campanhaId, corpo }`  POST /api/c/:id/<rota>
 *      `{ rota: 'desde', campanhaId, rev, limite? }`       GET  /api/c/:id/desde/:rev?limite= (1..500)
 *      `{ rota: 'exportar', campanhaId, deRev?, ateRev? }` GET  /api/c/:id/exportar
 *  - Ok = o JSON da resposta 2xx, inteiro (`null` com corpo vazio);
 *  - Err = `{ codigo, mensagem, status, detalhe }`, mensagem pronta em
 *    português; `status` e `detalhe` (até 300 caracteres do corpo) só nos
 *    erros HTTP (`acesso_negado` 3xx/401/403, `nao_encontrado` 404, `ritmo`
 *    429, `servidor` 5xx, `http` o resto, como o 409 de versão); `rede` = sem
 *    conexão, 15 s estourados ou queda no meio; `sem_credencial` = o token
 *    ainda não foi colado.
 *
 * Aqui dentro o Err HTTP volta a ser `{ status, corpo }` (o corpo relido do
 * `detalhe`), para o 404, o 409 de versão e o 5xx serem decididos num lugar
 * só (`falhaDoStatus`). O resto vira `ErroDaPonte`: `rede` = "sem rede"
 * (espera crescente, §5.5); `sem-credencial` (inclusive a credencial recusada
 * pelo Access) para o laço até a pessoa colar o token.
 *
 * Mídia (PUT/GET) e as credenciais são outros comandos da R1, fora do laço do
 * sincronizador (fatias W3/A6). Os seis comandos, com nome e argumentos, moram
 * num lugar só: `comandosDaR1.ts` (fatia J0).
 */

export type RotaDaNuvem =
  | { rota: 'eu' }
  | { rota: 'publicar'; campanhaId: string }
  | { rota: 'membros'; campanhaId: string }
  | { rota: 'ops'; campanhaId: string }
  | { rota: 'desde'; campanhaId: string; rev: number; limite: number }
  | { rota: 'exportar'; campanhaId: string; deRev?: number; ateRev?: number }

export interface RespostaHttp {
  status: number
  corpo: unknown
}

export type CodigoDoErroDaPonte = 'sem-credencial' | 'rede' | 'interno'

/** O que a R1 devolve no `Err`, já lido. */
export class ErroDaPonte extends Error {
  constructor(
    readonly codigo: CodigoDoErroDaPonte,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroDaPonte'
  }
}

/** O pedido cru: o Rust no app; nos testes, um servidor falso. Rejeita só com `ErroDaPonte`. */
export interface TransporteDaNuvem {
  pedir(rota: RotaDaNuvem, corpo?: Json): Promise<RespostaHttp>
}

/** Ops por página do `desde` (o teto do Worker, `LIMITE_DO_DESDE`). */
export const LIMITE_DO_DESDE = 500

/** Por que o pedido não deu certo, já separado pelo que o laço faz com cada um. */
export type FalhaDaNuvem =
  /** Não conectou, passou do tempo, ou o servidor caiu (5xx, 429): tenta de novo com espera crescente. */
  | { t: 'sem-rede'; detalhe: string }
  /** O servidor usa outro formato: o app precisa ser atualizado. */
  | { t: 'versao'; detalhe: string }
  /** A campanha não existe, ou o e-mail do token não é mais o mestre dela. */
  | { t: 'nao-existe'; detalhe: string }
  /** O Service Token ainda não foi colado ("Conta na nuvem"). */
  | { t: 'sem-credencial'; detalhe: string }
  /** Resposta que não devia acontecer (400, corpo torto): o laço para e mostra. */
  | { t: 'erro'; detalhe: string }

export type ResultadoDoEnvio = { t: 'ok'; respostas: RespostaDaOp[]; revAtual: number } | FalhaDaNuvem

export interface PaginaDoDesde {
  desde: number
  ate: number
  lista: OpGravada[]
  revAtual: number
}

export type ResultadoDoDesde = ({ t: 'ok' } & PaginaDoDesde) | FalhaDaNuvem

/** O que o sincronizador usa. */
export interface PonteDaNuvem {
  enviarOps(campanhaId: string, clienteId: string, lote: readonly Op[]): Promise<ResultadoDoEnvio>
  desde(campanhaId: string, rev: number, limite?: number): Promise<ResultadoDoDesde>
}

// ── Leitura das respostas (vêm da rede: conferidas campo a campo) ───────────

function ehRev(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

const ORIGENS: Readonly<Record<Origem, true>> = { app: true, site: true, mesa: true }

function ehOrigem(valor: unknown): valor is Origem {
  return typeof valor === 'string' && Object.hasOwn(ORIGENS, valor)
}

const MOTIVOS_DO_ADIAMENTO: Readonly<Record<MotivoAdiado, true>> = { cota: true, ritmo: true }

function ehMotivoAdiado(valor: unknown): valor is MotivoAdiado {
  return typeof valor === 'string' && Object.hasOwn(MOTIVOS_DO_ADIAMENTO, valor)
}

/** A resposta de uma op, como `receberRespostas` da fila espera; `null` = torta. */
export function lerRespostaDaOp(bruta: unknown): RespostaDaOp | null {
  if (!ehRegistro(bruta)) return null
  if (proprio(bruta, 't') === 'adiado') {
    const opId = proprio(bruta, 'opId')
    const motivo = proprio(bruta, 'motivo')
    const tentarDepoisDe = proprio(bruta, 'tentarDepoisDe')
    if (!segmentoValido(opId) || !ehMotivoAdiado(motivo) || typeof tentarDepoisDe !== 'number' || !Number.isFinite(tentarDepoisDe)) return null
    return { t: 'adiado', opId, motivo, tentarDepoisDe }
  }
  // ack, conflito e negado: o mesmo leitor da linha do `fila.jsonl`.
  const registro = lerRegistro(bruta)
  if (registro === null) return null
  switch (registro.t) {
    case 'ack':
    case 'conflito':
    case 'negado':
      return registro
    default:
      return null
  }
}

/** A op gravada que veio no `desde`, refeita só com o que o formato conhece; `null` = torta. */
export function lerOpGravada(bruta: unknown): OpGravada | null {
  if (!ehRegistro(bruta)) return null
  const envelope = lerEnvelope(bruta)
  const lida = lerMudanca(bruta)
  if (!envelope.ok || !lida.ok) return null
  const rev = proprio(bruta, 'rev')
  const autorContaId = proprio(bruta, 'autorContaId')
  const autorNome = proprio(bruta, 'autorNome')
  const origem = proprio(bruta, 'origem')
  const atestadoPeloApp = proprio(bruta, 'atestadoPeloApp')
  const quando = proprio(bruta, 'quando')
  const antes = proprio(bruta, 'antes')
  if (!ehRev(rev) || rev === 0 || typeof autorContaId !== 'string' || typeof autorNome !== 'string' || !ehOrigem(origem)) return null
  if (typeof atestadoPeloApp !== 'boolean' || typeof quando !== 'number' || !Number.isFinite(quando)) return null
  if (antes !== undefined && !ehJson(antes)) return null
  const op: OpGravada = { ...envelope.envelope, ...lida.mudanca, rev, autorContaId, autorNome, origem, atestadoPeloApp, quando }
  if (antes !== undefined) op.antes = antes
  return op
}

function detalheDoCorpo(corpo: unknown, padrao: string): string {
  const detalhe = ehRegistro(corpo) ? proprio(corpo, 'detalhe') : undefined
  return typeof detalhe === 'string' && detalhe.length > 0 ? detalhe : padrao
}

/** O status que não é 200, separado pelo que o laço faz com ele. */
function falhaDoStatus(resposta: RespostaHttp): FalhaDaNuvem {
  const { status, corpo } = resposta
  const erro = ehRegistro(corpo) ? proprio(corpo, 'erro') : undefined
  if (status === 409 && erro === 'versao') return { t: 'versao', detalhe: detalheDoCorpo(corpo, 'O servidor do Lobby usa outro formato: atualize o app') }
  if (status === 404) return { t: 'nao-existe', detalhe: 'O Lobby não achou esta campanha para a sua conta' }
  if (status === 429 || status >= 500) return { t: 'sem-rede', detalhe: `O servidor do Lobby não respondeu agora (${status})` }
  return { t: 'erro', detalhe: detalheDoCorpo(corpo, `O servidor do Lobby recusou o pedido (${status})`) }
}

async function pedirComFalha(transporte: TransporteDaNuvem, rota: RotaDaNuvem, corpo?: Json): Promise<RespostaHttp | FalhaDaNuvem> {
  try {
    return await transporte.pedir(rota, corpo)
  } catch (erro) {
    if (!(erro instanceof ErroDaPonte)) throw erro
    if (erro.codigo === 'rede') return { t: 'sem-rede', detalhe: erro.message }
    if (erro.codigo === 'sem-credencial') return { t: 'sem-credencial', detalhe: erro.message }
    return { t: 'erro', detalhe: erro.message }
  }
}

function ehFalha(resposta: RespostaHttp | FalhaDaNuvem): resposta is FalhaDaNuvem {
  return !('status' in resposta)
}

function lerEnvio(corpo: unknown): ResultadoDoEnvio {
  const respostas = ehRegistro(corpo) ? proprio(corpo, 'respostas') : undefined
  const revAtual = ehRegistro(corpo) ? proprio(corpo, 'revAtual') : undefined
  if (!Array.isArray(respostas) || !ehRev(revAtual)) return { t: 'erro', detalhe: 'Resposta do envio fora do formato' }
  const brutas: readonly unknown[] = respostas
  const lidas = brutas.map(lerRespostaDaOp)
  // Resposta torta não vira "pendente para sempre" calada: o laço para e mostra.
  if (lidas.some((lida) => lida === null)) return { t: 'erro', detalhe: 'Resposta de uma mudança fora do formato' }
  return { t: 'ok', respostas: lidas.filter((lida): lida is RespostaDaOp => lida !== null), revAtual }
}

/** A página inteira ou nada: pular uma op torta deixaria buraco no diário (§5.5). */
function lerDesde(corpo: unknown): ResultadoDoDesde {
  if (!ehRegistro(corpo)) return { t: 'erro', detalhe: 'Resposta do desde fora do formato' }
  const desde = proprio(corpo, 'desde')
  const ate = proprio(corpo, 'ate')
  const lista = proprio(corpo, 'lista')
  const revAtual = proprio(corpo, 'revAtual')
  if (!ehRev(desde) || !ehRev(ate) || !ehRev(revAtual) || !Array.isArray(lista) || ate < desde) return { t: 'erro', detalhe: 'Resposta do desde fora do formato' }
  const brutas: readonly unknown[] = lista
  const ops = brutas.map(lerOpGravada)
  if (ops.some((op) => op === null)) return { t: 'erro', detalhe: 'Uma mudança do servidor veio fora do formato' }
  return { t: 'ok', desde, ate, revAtual, lista: ops.filter((op): op is OpGravada => op !== null) }
}

export function ponteSobre(transporte: TransporteDaNuvem): PonteDaNuvem {
  return {
    async enviarOps(campanhaId, clienteId, lote) {
      // A op vai ao fio como JSON puro: o `structuredClone` tira referência compartilhada, e o tipo `Op` já é JSON.
      const corpo: Json = { v: VERSAO_DO_FORMATO, clienteId, lote: lote.map(opComoJson) }
      const resposta = await pedirComFalha(transporte, { rota: 'ops', campanhaId }, corpo)
      if (ehFalha(resposta)) return resposta
      return resposta.status === 200 ? lerEnvio(resposta.corpo) : falhaDoStatus(resposta)
    },
    async desde(campanhaId, rev, limite = LIMITE_DO_DESDE) {
      const resposta = await pedirComFalha(transporte, { rota: 'desde', campanhaId, rev, limite })
      if (ehFalha(resposta)) return resposta
      return resposta.status === 200 ? lerDesde(resposta.corpo) : falhaDoStatus(resposta)
    },
  }
}

/** A op como JSON: só os campos que existem (o `undefined` não vai ao fio). */
function opComoJson(op: Op): Json {
  const json: { [chave: string]: Json } = {}
  for (const [chave, valor] of Object.entries(op)) {
    if (valor !== undefined && ehJson(valor)) json[chave] = valor
  }
  return json
}

// ── O transporte do app (a R1) ──────────────────────────────────────────────

/** Os códigos da R1 que são resposta HTTP: voltam como `{ status, corpo }`. */
const CODIGOS_HTTP: ReadonlySet<string> = new Set(['nao_encontrado', 'ritmo', 'servidor', 'http'])
/** O Access recusou a credencial (3xx, 401, 403): para o laço como a falta dela. */
const CODIGOS_DE_CREDENCIAL: ReadonlySet<string> = new Set(['sem_credencial', 'acesso_negado'])

/** O corpo que a R1 cortou em `detalhe`; `null` = não é JSON (cortado no meio, ou HTML de erro). */
function corpoDoDetalhe(detalhe: unknown): unknown {
  if (typeof detalhe !== 'string') return null
  try {
    return lerJsonSeguro(detalhe)
  } catch (erro) {
    if (erro instanceof SyntaxError) return null
    throw erro
  }
}

/** O `Err` da R1 lido: o erro HTTP como resposta, o resto como `ErroDaPonte`. O que não tem a forma do contrato vira `interno`. */
export function lerErroDaR1(bruto: unknown): RespostaHttp | ErroDaPonte {
  if (!ehRegistro(bruto)) return new ErroDaPonte('interno', bruto instanceof Error ? bruto.message : String(bruto))
  const codigo = proprio(bruto, 'codigo')
  const mensagem = proprio(bruto, 'mensagem')
  const status = proprio(bruto, 'status')
  const texto = typeof mensagem === 'string' ? mensagem : 'A ponte da nuvem falhou'
  if (typeof codigo === 'string' && CODIGOS_HTTP.has(codigo) && typeof status === 'number' && Number.isSafeInteger(status)) {
    return { status, corpo: corpoDoDetalhe(proprio(bruto, 'detalhe')) }
  }
  if (codigo === 'rede') return new ErroDaPonte('rede', texto)
  if (typeof codigo === 'string' && CODIGOS_DE_CREDENCIAL.has(codigo)) return new ErroDaPonte('sem-credencial', texto)
  return new ErroDaPonte('interno', texto)
}

export type { Invocar } from './comandosDaR1'

/**
 * A rota do laço com o corpo, como o `PedidoNuvem` da R1 a lê. `null` = corpo
 * numa rota GET, ou falta dele numa POST: a R1 recusaria (campo a mais, ou
 * `corpo` ausente), então o erro de montagem fica aqui, com o nome da rota.
 */
function pedidoDaRota(rota: RotaDaNuvem, corpo: Json | undefined): PedidoDaR1 | null {
  switch (rota.rota) {
    case 'publicar':
    case 'membros':
    case 'ops':
      return corpo === undefined ? null : { rota: rota.rota, campanhaId: rota.campanhaId, corpo }
    case 'eu':
    case 'desde':
    case 'exportar':
      return corpo === undefined ? rota : null
  }
}

/** O transporte de verdade: o comando `nuvem_pedir` da R1, pelo adaptador `comandosDaR1`. */
export function transporteDoTauri(invocar: Invocar = invocarDoTauri): TransporteDaNuvem {
  const r1 = comandosDaR1(invocar)
  return {
    async pedir(rota, corpo) {
      const pedido = pedidoDaRota(rota, corpo)
      if (pedido === null) throw new ErroDaPonte('interno', `Pedido ao Lobby montado errado: a rota ${rota.rota} ${corpo === undefined ? 'precisa de corpo' : 'não leva corpo'}`)
      try {
        return { status: 200, corpo: await r1.pedir(pedido) }
      } catch (erro) {
        const lido = lerErroDaR1(erro)
        if (lido instanceof ErroDaPonte) throw lido
        return lido
      }
    },
  }
}
