import { CHAT_MENCOES_MAX, type MensagemDoChat } from '../../lib/nuvem/chatDoLobby'
import { ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import type { PastaNoDisco } from './discoDaNuvem'
import { ehFalha, falhaDoStatus, pedirComFalha, type FalhaDaNuvem, type TransporteDaNuvem } from './ponte'

/**
 * A CÓPIA DA SALA DO CHAT NO APP DO MESTRE (docs/planos/lobby-jogadores-2026-11-05.md
 * §4.4, §5.4 e §8.2, fatia C3; achados Ch6 e XS5): `chat-sala.jsonl` em
 * `<appData>/nuvem/<campanhaId>/`, uma mensagem por linha, puxada pela rota
 * `GET /api/c/:id/chat/sala?desde=<cursor>` (no Rust, a variante `SalaDoChat`).
 *
 * - Só a sala. O privado nunca vai ao disco do mestre (§5.7): a rota só lê
 *   `chat_sala`, e uma resposta que traga qualquer marca de privado é recusada
 *   INTEIRA, sem gravar nada (a falha aparece; a conversa privada não fica).
 * - Lápide: apagar no site faz a mensagem voltar com `apagadaEm` e um `mudou`
 *   novo. A cópia troca a linha e o texto apagado SAI do arquivo: mensagem
 *   nova é acrescentada (append); qualquer troca de mensagem que já estava no
 *   disco reescreve o arquivo inteiro pela troca segura (`reescrever`).
 * - O cursor é o maior `mudou` da cópia (relido do arquivo ao abrir) ou o `ate`
 *   da última página: pedir de novo o que já veio não muda nada.
 * - Leitura tolerante: a linha cortada por uma queda é ignorada, e a próxima
 *   gravação reescreve o arquivo sem ela.
 */

export const ARQUIVO_DA_SALA = 'chat-sala.jsonl'
/** O teto da rota no Worker (`LIMITE_DA_ROTA_DA_SALA`) e da R1 (1..500). */
export const LIMITE_DA_PAGINA_DA_SALA = 500
/** Páginas por atualização: 10 mil mudanças. O resto vem na próxima, sem perder o lugar. */
const PAGINAS_POR_VEZ = 20
/** O mesmo teto de nome e de id de conta que a tela aguenta; acima disso a linha não é da sala. */
const TEXTO_CURTO_MAX = 200

/** Campos que só o privado tem no servidor (`chat_dm`): se aparecerem, a resposta não é da sala. */
const MARCAS_DO_PRIVADO: readonly string[] = ['contaA', 'contaB', 'par', 'emailA', 'emailB']

function ehInteiroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0
}

function ehCursor(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function ehInstante(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
}

function ehTextoCurto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= TEXTO_CURTO_MAX
}

/** `true` = a linha traz algo que só o privado tem (inclusive um `canal` que não é a sala). */
function ehDoPrivado(bruta: Record<string, unknown>): boolean {
  if (MARCAS_DO_PRIVADO.some((campo) => Object.hasOwn(bruta, campo))) return true
  return Object.hasOwn(bruta, 'canal') && proprio(bruta, 'canal') !== 'sala'
}

function lerMencoes(valor: unknown): string[] | null {
  if (!Array.isArray(valor) || valor.length > CHAT_MENCOES_MAX) return null
  const lista: readonly unknown[] = valor
  return lista.every(ehTextoCurto) ? lista.filter(ehTextoCurto) : null
}

export type LeituraDaMensagem = { t: 'sala'; msg: MensagemDoChat } | { t: 'privado' } | { t: 'torta' }

/**
 * Uma mensagem da sala, refeita campo a campo (vem da rede ou do disco). Na
 * lápide o texto e as menções ficam vazios mesmo que venham preenchidos:
 * mensagem apagada não deixa o texto no disco do mestre.
 */
export function lerMensagemDaSala(bruta: unknown): LeituraDaMensagem {
  if (!ehRegistro(bruta)) return { t: 'torta' }
  if (ehDoPrivado(bruta)) return { t: 'privado' }
  const id = proprio(bruta, 'id')
  const autorContaId = proprio(bruta, 'autorContaId')
  const autorNome = proprio(bruta, 'autorNome')
  const texto = proprio(bruta, 'texto')
  const mencoes = lerMencoes(proprio(bruta, 'mencoes'))
  const criadaEm = proprio(bruta, 'criadaEm')
  const apagadaEm = proprio(bruta, 'apagadaEm')
  const mudou = proprio(bruta, 'mudou')
  if (!ehInteiroPositivo(id) || !ehTextoCurto(autorContaId) || typeof autorNome !== 'string' || autorNome.length > TEXTO_CURTO_MAX) return { t: 'torta' }
  if (typeof texto !== 'string' || mencoes === null || !ehInstante(criadaEm) || !ehInteiroPositivo(mudou)) return { t: 'torta' }
  if (apagadaEm !== null && !ehInstante(apagadaEm)) return { t: 'torta' }
  const apagada = apagadaEm !== null
  return {
    t: 'sala',
    msg: { id, autorContaId, autorNome, texto: apagada ? '' : texto, mencoes: apagada ? [] : mencoes, criadaEm, apagadaEm, mudou },
  }
}

export interface PaginaDaSala {
  desde: number
  /** O cursor para a próxima página (ou para a próxima atualização). */
  ate: number
  lista: MensagemDoChat[]
  temMais: boolean
}

/** A página inteira ou nada (string = o motivo). Uma linha de privado derruba a página: nada dela é gravado. */
export function lerPaginaDaSala(corpo: unknown): PaginaDaSala | string {
  if (!ehRegistro(corpo)) return 'Resposta da sala do chat fora do formato'
  const desde = proprio(corpo, 'desde')
  const ate = proprio(corpo, 'ate')
  const lista = proprio(corpo, 'lista')
  const temMais = proprio(corpo, 'temMais')
  if (!ehCursor(desde) || !ehCursor(ate) || ate < desde || !Array.isArray(lista) || typeof temMais !== 'boolean') return 'Resposta da sala do chat fora do formato'
  const brutas: readonly unknown[] = lista
  const mensagens: MensagemDoChat[] = []
  for (const bruta of brutas) {
    const lida = lerMensagemDaSala(bruta)
    if (lida.t === 'privado') return 'O servidor mandou uma conversa privada junto com a sala: nada desta página foi gravado'
    if (lida.t === 'torta') return 'Uma mensagem da sala do chat veio fora do formato'
    mensagens.push(lida.msg)
  }
  return { desde, ate, lista: mensagens, temMais }
}

// ── A cópia em memória ──────────────────────────────────────────────────────

/** As mensagens por id, cada uma na versão de maior `mudou`. */
export type CopiaDaSala = Map<number, MensagemDoChat>

export interface CopiaLida {
  copia: CopiaDaSala
  /** Linhas que não se entendem (a cortada pela queda, ou de privado): a próxima gravação reescreve sem elas. */
  ignoradas: number
}

function guardarMaisNova(copia: CopiaDaSala, msg: MensagemDoChat): void {
  const atual = copia.get(msg.id)
  if (atual === undefined || msg.mudou > atual.mudou) copia.set(msg.id, msg)
}

export function copiaDoArquivo(texto: string | null): CopiaLida {
  const copia: CopiaDaSala = new Map()
  let ignoradas = 0
  if (texto === null) return { copia, ignoradas }
  for (const linha of texto.split('\n')) {
    if (linha.trim() === '') continue
    let bruta: unknown
    try {
      bruta = lerJsonSeguro(linha)
    } catch (erro) {
      if (!(erro instanceof SyntaxError)) throw erro
      ignoradas += 1
      continue
    }
    const lida = lerMensagemDaSala(bruta)
    if (lida.t === 'sala') guardarMaisNova(copia, lida.msg)
    else ignoradas += 1
  }
  return { copia, ignoradas }
}

export function cursorDaCopia(copia: CopiaDaSala): number {
  let cursor = 0
  for (const msg of copia.values()) cursor = Math.max(cursor, msg.mudou)
  return cursor
}

function linhasDe(mensagens: readonly MensagemDoChat[]): string {
  return mensagens.map((msg) => `${JSON.stringify(msg)}\n`).join('')
}

/** O arquivo inteiro, na ordem do id (a ordem da conversa). */
export function textoDaCopia(copia: CopiaDaSala): string {
  return linhasDe([...copia.values()].sort((a, b) => a.id - b.id))
}

/** O que muda na cópia com uma página: só o que é mais novo que o do disco. */
export interface MudancaNaCopia {
  mudadas: MensagemDoChat[]
  /** Alguma mensagem que já estava no disco mudou (lápide): o arquivo é reescrito para o texto antigo sair. */
  trocaLinha: boolean
}

export function mudancaDaPagina(copia: CopiaDaSala, lista: readonly MensagemDoChat[]): MudancaNaCopia {
  const porId = new Map<number, MensagemDoChat>()
  let trocaLinha = false
  for (const msg of lista) {
    const atual = porId.get(msg.id) ?? copia.get(msg.id)
    if (atual !== undefined && atual.mudou >= msg.mudou) continue
    if (copia.has(msg.id)) trocaLinha = true
    porId.set(msg.id, msg)
  }
  return { mudadas: [...porId.values()], trocaLinha }
}

// ── A atualização (disco + servidor) ────────────────────────────────────────

export type ResultadoDaPaginaDaSala = ({ t: 'ok' } & PaginaDaSala) | FalhaDaNuvem

/** De onde vêm as páginas: no app, a R1; nos testes, um servidor falso. */
export interface FonteDaSala {
  pagina(campanhaId: string, desde: number, limite: number): Promise<ResultadoDaPaginaDaSala>
}

export type ResultadoDaCopiaDaSala = { t: 'ok'; mensagens: number; gravadas: number } | FalhaDaNuvem

export interface CopiaDaSalaNoDisco {
  /** Puxa o que mudou desde o cursor e grava. Uma por vez: a segunda chamada espera a primeira. */
  atualizar(): Promise<ResultadoDaCopiaDaSala>
}

export function abrirCopiaDaSala(campanhaId: string, pasta: PastaNoDisco, fonte: FonteDaSala): CopiaDaSalaNoDisco {
  let aberta: { copia: CopiaDaSala; cursor: number; reescreverNaProxima: boolean } | null = null
  let emCurso: Promise<ResultadoDaCopiaDaSala> | null = null

  async function abrir(): Promise<NonNullable<typeof aberta>> {
    if (aberta !== null) return aberta
    const lida = copiaDoArquivo(await pasta.ler(ARQUIVO_DA_SALA))
    aberta = { copia: lida.copia, cursor: cursorDaCopia(lida.copia), reescreverNaProxima: lida.ignoradas > 0 }
    return aberta
  }

  /** Grava primeiro, muda a memória depois: se o disco recusar, a mesma página vem de novo na próxima. */
  async function gravar(estado: NonNullable<typeof aberta>, mudanca: MudancaNaCopia): Promise<void> {
    if (mudanca.mudadas.length === 0) return
    if (mudanca.trocaLinha || estado.reescreverNaProxima) {
      const nova: CopiaDaSala = new Map(estado.copia)
      for (const msg of mudanca.mudadas) nova.set(msg.id, msg)
      await pasta.reescrever(ARQUIVO_DA_SALA, textoDaCopia(nova))
      estado.copia = nova
      estado.reescreverNaProxima = false
      return
    }
    await pasta.acrescentar(ARQUIVO_DA_SALA, linhasDe(mudanca.mudadas))
    for (const msg of mudanca.mudadas) estado.copia.set(msg.id, msg)
  }

  async function atualizarAgora(): Promise<ResultadoDaCopiaDaSala> {
    const estado = await abrir()
    let gravadas = 0
    for (let vez = 0; vez < PAGINAS_POR_VEZ; vez += 1) {
      const pagina = await fonte.pagina(campanhaId, estado.cursor, LIMITE_DA_PAGINA_DA_SALA)
      if (pagina.t !== 'ok') return pagina
      const mudanca = mudancaDaPagina(estado.copia, pagina.lista)
      await gravar(estado, mudanca)
      gravadas += mudanca.mudadas.length
      const avancou = pagina.lista.reduce((maior, msg) => Math.max(maior, msg.mudou), pagina.ate)
      // Página que não anda (servidor torto) não vira laço sem fim.
      if (avancou <= estado.cursor) break
      estado.cursor = avancou
      if (!pagina.temMais) break
    }
    return { t: 'ok', mensagens: estado.copia.size, gravadas }
  }

  return {
    atualizar() {
      emCurso ??= atualizarAgora().finally(() => {
        emCurso = null
      })
      return emCurso
    },
  }
}

/** A fonte de verdade: a rota `salaDoChat` pela ponte da R1 (o adaptador da A5). */
export function fonteDaSalaSobre(transporte: TransporteDaNuvem): FonteDaSala {
  return {
    async pagina(campanhaId, desde, limite) {
      const resposta = await pedirComFalha(transporte, { rota: 'salaDoChat', campanhaId, desde, limite })
      if (ehFalha(resposta)) return resposta
      if (resposta.status !== 200) return falhaDoStatus(resposta)
      const pagina = lerPaginaDaSala(resposta.corpo)
      return typeof pagina === 'string' ? { t: 'erro', detalhe: pagina } : { t: 'ok', ...pagina }
    },
  }
}
