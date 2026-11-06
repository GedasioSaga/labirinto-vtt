import type { Personagem } from '../personagem'
import { aplicarOp } from './aplicar'
import { lerMudanca, segmentoValido } from './caminho'
import { bytesDoJson, ehJson, ehRegistro, lerJsonSeguro, proprio } from './json'
import { LIMITES, tetoDaOpEmBytes } from './limites'
import { lerEnvelope, type RespostaDaOp } from './lote'
import { VERSAO_DO_FORMATO, type Conflito, type MensagemDoServidor, type MotivoAdiado, type MotivoNegado, type Op } from './tipos'

/**
 * FILA OFFLINE (docs/planos/lobby-jogadores-2026-11-05.md §4.4, §5.5-5.7): a
 * mesa nunca para. A MESMA fila serve ao app (o adaptador grava `fila.jsonl`
 * no disco) e ao site (o adaptador grava no IndexedDB): o armazenamento é
 * injetado, e daqui para dentro tudo é puro.
 *
 * Toda mudança fica salva:
 * - a op só entra na fila (e na vista) DEPOIS de gravada no armazenamento;
 *   disco cheio = a promessa falha e a mudança não aparece como feita;
 * - reenvio sempre com o mesmo `opId` (o servidor responde igual, nunca grava
 *   duas vezes); a própria op que volta no `desde` (o eco) vale como ack;
 * - conflito e negado ficam guardados como "precisa de decisão" e só saem com
 *   `resolvido`, ou com a op de "Usar a minha" (`resolve`), que encerra o
 *   conflito na mesma linha em que é gravada; adiado continua pendente e vai
 *   de novo sozinho;
 * - a linha cortada no fim do arquivo (queda no meio do append) é ignorada,
 *   e a próxima gravação começa numa linha nova. Por isso o que não pode ser
 *   gravado pela metade vai numa linha só: o tudo-ou-nada inteiro (`grupo`),
 *   a escolha "Usar a minha" junto com a op nova, e a decisão de uma troca
 *   inteira (`resolverGrupo`: um `grupo` com as ops novas, ou um `resolvidos`).
 * - a op guardada e mandada é a refeita pela leitura do esquema (como o
 *   servidor a refaz): chave a mais no objeto que chegou não vai ao disco
 *   nem ao fio.
 *
 * A vista local (`vistaLocal`) é a base confirmada pelo servidor com as ops
 * locais por cima, na ordem: quando chegam ops remotas, a base anda e as
 * locais são reaplicadas sobre ela (rebase). Cada op local mantém a `baseRev`
 * de quando nasceu — é assim que o servidor vê o conflito de quem estava
 * offline. Entra na vista a op pendente, a aceita que a base ainda não
 * alcançou e a negada (o valor local com o selo "não aceito pelo servidor");
 * a do conflito fica de fora (o campo mostra o valor do servidor e a escolha
 * fica em `paraDecidir`).
 */

/** Acima disto, e com tudo respondido, o `fila.jsonl` é reescrito só com o que ainda espera decisão (§4.4). */
export const TETO_DA_FILA_EM_BYTES = 256 * 1024

/** Uma linha do `fila.jsonl` (ou uma entrada do IndexedDB). Todas citam o `opId` da op local; o `grupo`, o de cada op dele. */
export type RegistroDaFila =
  | ({ t: 'op'; v: number } & Op)
  /** Um tudo-ou-nada (`atomico`, o mesmo `loteId`) inteiro num registro só: a queda no meio da gravação perde o grupo todo, nunca metade. */
  | { t: 'grupo'; v: number; ops: Op[] }
  | { t: 'ack'; opId: string; rev: number }
  | ({ t: 'conflito' } & Conflito)
  | { t: 'negado'; opId: string; motivo: MotivoNegado; detalhe?: string }
  | { t: 'resolvido'; opId: string }
  /** As decisões de um tudo-ou-nada inteiro encerradas sem op nova, num registro só: a queda no meio nunca fecha metade da troca. */
  | { t: 'resolvidos'; opIds: string[] }

/** Uma decisão de um grupo: a op que esperava e, em "Usar a minha", a op nova que a encerra (`resolve` = `opId`). */
export interface DecisaoDaFila {
  opId: string
  usarAMinha?: Op
}

export interface Carregado {
  /** Os registros na ordem em que foram acrescentados, crus: a fila confere cada um. */
  registros: readonly unknown[]
  /** O que nem deu para ler (a linha cortada no fim). */
  ilegiveis: number
}

/** O lugar onde a fila mora. Só acrescenta; `substituir` é a compactação. */
export interface ArmazenamentoDaFila {
  carregar(): Promise<Carregado>
  /** Só resolve depois de gravado de verdade. */
  acrescentar(registros: readonly RegistroDaFila[]): Promise<void>
  substituir(registros: readonly RegistroDaFila[]): Promise<void>
}

/** O arquivo de texto do app (`fila.jsonl`): o adaptador de disco do Tauri implementa isto. */
export interface ArquivoDeTexto {
  /** O conteúdo inteiro; `null` = o arquivo ainda não existe. */
  ler(): Promise<string | null>
  /** Acrescenta no fim (append). */
  acrescentar(texto: string): Promise<void>
  /** Troca o conteúdo inteiro (no app, pela troca segura por rename). */
  reescrever(texto: string): Promise<void>
}

export type SituacaoDaEntrada =
  /** Sem resposta final; `tentarDepoisDe` = o servidor adiou (cota ou ritmo). */
  | { t: 'pendente'; tentarDepoisDe?: number; motivoDoAdiamento?: MotivoAdiado }
  /** Gravada no servidor com esta rev; sai da fila quando a base a alcança. */
  | { t: 'aceita'; rev: number }
  | { t: 'conflito'; conflito: Conflito }
  | { t: 'negado'; motivo: MotivoNegado; detalhe?: string }

export interface EntradaDaFila {
  readonly op: Op
  readonly situacao: SituacaoDaEntrada
  /** `VERSAO_DO_FORMATO` de quando a op nasceu (o site esvazia a fila numa troca de versão, §5.6). */
  readonly versao: number
}

/** A base que o servidor confirmou: o `estado` do site, ou a cópia do app ao abrir. */
export interface BaseConfirmada {
  rev: number
  fichas: readonly Personagem[]
}

export type RemotasRecebidas = Pick<Extract<MensagemDoServidor, { t: 'ops' }>, 'desde' | 'ate' | 'lista'>

export type ResultadoDasRemotas =
  /** As ops começam depois da base: falta um pedaço. Peça de novo a partir de `revConfirmada()`. */
  | { t: 'buraco' }
  /** `naoAplicaveis` = op confirmada que não entrou na base local: a base divergiu (peça o `estado`). */
  | { t: 'ok'; aplicadas: number; naoAplicaveis: string[] }

/** `repetida`: o `opId` já está na fila. `sem-decisao`: resolver op que não espera decisão. */
export type MotivoNaFila = MotivoNegado | 'repetida' | 'sem-decisao'

export interface ProblemaNaFila {
  opId: string
  motivo: MotivoNaFila
  /** Em português, para a tela. */
  detalhe: string
}

export type ResultadoNaFila = { ok: true } | { ok: false; problemas: ProblemaNaFila[] }

export interface Fila {
  /** Até onde a base confirmada chegou: o `desdeRev` do `ola`, o `:rev` do `desde`, a `baseRev` de op nova. */
  revConfirmada(): number
  /** As fichas como a tela mostra: a base com as ops locais por cima. Ficha apagada não aparece. */
  vistaLocal(): ReadonlyMap<string, Personagem>
  entradas(): readonly EntradaDaFila[]
  /** Conflitos e negadas: "Mudanças para decidir" / "precisam da sua decisão". */
  paraDecidir(): readonly EntradaDaFila[]
  /** Quantas esperam o servidor (o "3 esperando rede"). */
  esperando(): number
  /** O próximo lote a mandar, em ordem, sem partir um tudo-ou-nada. Vazio = nada a mandar agora. */
  paraEnviar(agora: number): Op[]
  /** Valida pelo mesmo esquema e tetos do servidor e grava; só depois a op entra na vista. Uma recusada = nenhuma entra. */
  acrescentar(ops: readonly Op[]): Promise<ResultadoNaFila>
  receberRespostas(respostas: readonly RespostaDaOp[]): Promise<void>
  receberRemotas(remotas: RemotasRecebidas): Promise<ResultadoDasRemotas>
  /** Troca a base inteira (o `estado` do site). Base mais velha que a atual é ignorada (`false`). */
  receberEstado(base: BaseConfirmada): Promise<boolean>
  /** Encerra a decisão: "Ficar com a do outro" / "Desfazer aqui" sem op; "Usar a minha" com a op nova (`resolve` = `opId`, só em conflito). */
  resolver(opId: string, usarAMinha?: Op): Promise<ResultadoNaFila>
  /**
   * A mesma decisão para um tudo-ou-nada inteiro (a troca, o pagamento), num
   * registro só: "Usar a minha" em todas (as ops novas, cada uma com o seu
   * `resolve`, formam um tudo-ou-nada só e vão num `grupo`) ou em nenhuma
   * (um `resolvidos`). A queda no meio deixa o grupo inteiro aberto, nunca metade.
   */
  resolverGrupo(decisoes: readonly DecisaoDaFila[]): Promise<ResultadoNaFila>
  /** Reescreve o armazenamento só com o que espera decisão, se passou do teto e nada espera o servidor. */
  compactarSePreciso(): Promise<boolean>
  /** Registros que não deu para ler ao abrir (a linha cortada no fim). */
  readonly ignoradosAoAbrir: number
}

const BASE_VAZIA: BaseConfirmada = { rev: 0, fichas: [] }

/** `{"t":"ops","lote":[]}`: o que o frame tem além das ops. */
const MOLDURA_DO_FRAME = bytesDoJson({ t: 'ops', lote: [] })

// ── Leitura dos registros (do disco ou do fio) ──────────────────────────────

const MOTIVO_NEGADO: Readonly<Record<MotivoNegado, true>> = {
  'fora-do-esquema': true,
  'sem-permissao': true,
  'acima-do-teto': true,
  midia: true,
  'doc-grande': true,
  'base-invalida': true,
  versao: true,
  'alvo-inexistente': true,
  'nada-a-desfazer': true,
}

function ehMotivoNegado(valor: unknown): valor is MotivoNegado {
  return typeof valor === 'string' && Object.hasOwn(MOTIVO_NEGADO, valor)
}

function ehRev(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

/** A op guardada, conferida como o servidor confere (envelope e esquema). `desfaz` nunca vai pela fila. */
function lerOp(registro: Record<string, unknown>): Op | null {
  const envelope = lerEnvelope(registro)
  const lida = lerMudanca(registro)
  if (!envelope.ok || !lida.ok || envelope.envelope.desfaz !== undefined) return null
  return { ...envelope.envelope, ...lida.mudanca }
}

function lerConflito(registro: Record<string, unknown>): Conflito | null {
  const opId = proprio(registro, 'opId')
  const quem = proprio(registro, 'quem')
  const quando = proprio(registro, 'quando')
  const revAtual = proprio(registro, 'revAtual')
  if (!segmentoValido(opId) || typeof quem !== 'string' || typeof quando !== 'number' || !Number.isFinite(quando) || !ehRev(revAtual)) return null
  const conflito: Conflito = { opId, quem, quando, revAtual }
  const valorAtual = proprio(registro, 'valorAtual')
  const fichaApagada = proprio(registro, 'fichaApagada')
  const porCausaDe = proprio(registro, 'porCausaDe')
  if (valorAtual !== undefined && !ehJson(valorAtual)) return null
  if (fichaApagada !== undefined && fichaApagada !== true) return null
  if (porCausaDe !== undefined && !segmentoValido(porCausaDe)) return null
  if (valorAtual !== undefined) conflito.valorAtual = valorAtual
  if (fichaApagada === true) conflito.fichaApagada = true
  if (porCausaDe !== undefined) conflito.porCausaDe = porCausaDe
  return conflito
}

function lerNegado(opId: string, registro: Record<string, unknown>): RegistroDaFila | null {
  const motivo = proprio(registro, 'motivo')
  const detalhe = proprio(registro, 'detalhe')
  if (!ehMotivoNegado(motivo) || (detalhe !== undefined && typeof detalhe !== 'string')) return null
  return detalhe === undefined ? { t: 'negado', opId, motivo } : { t: 'negado', opId, motivo, detalhe }
}

/** O tudo-ou-nada guardado: só vale inteiro, com cada op conferida e todas do mesmo grupo (`atomico`, o mesmo `loteId`). */
function lerGrupo(registro: Record<string, unknown>): RegistroDaFila | null {
  const v = proprio(registro, 'v')
  const lista = proprio(registro, 'ops')
  if (!ehRev(v) || !Array.isArray(lista)) return null
  const brutas: readonly unknown[] = lista
  const ops: Op[] = []
  for (const bruta of brutas) {
    const op = ehRegistro(bruta) ? lerOp(bruta) : null
    if (op === null) return null
    ops.push(op)
  }
  return emGrupos(ops).length === 1 ? { t: 'grupo', v, ops } : null
}

/** As decisões encerradas juntas: lista não vazia de `opId` válidos, sem repetir. */
function lerResolvidos(registro: Record<string, unknown>): RegistroDaFila | null {
  const lista = proprio(registro, 'opIds')
  if (!Array.isArray(lista) || lista.length === 0) return null
  const brutos: readonly unknown[] = lista
  const opIds: string[] = []
  for (const bruto of brutos) {
    if (!segmentoValido(bruto)) return null
    opIds.push(bruto)
  }
  return new Set(opIds).size === opIds.length ? { t: 'resolvidos', opIds } : null
}

/** O registro conferido e tipado; `null` = torto (fica de fora, contado em `ignoradosAoAbrir`). */
export function lerRegistro(bruto: unknown): RegistroDaFila | null {
  if (!ehRegistro(bruto)) return null
  const t = proprio(bruto, 't')
  if (t === 'grupo') return lerGrupo(bruto)
  if (t === 'resolvidos') return lerResolvidos(bruto)
  const opId = proprio(bruto, 'opId')
  if (!segmentoValido(opId)) return null
  switch (t) {
    case 'op': {
      const op = lerOp(bruto)
      const v = proprio(bruto, 'v')
      return op === null || !ehRev(v) ? null : registroDaOp(op, v)
    }
    case 'ack': {
      const rev = proprio(bruto, 'rev')
      return ehRev(rev) && rev > 0 ? { t: 'ack', opId, rev } : null
    }
    case 'conflito': {
      const conflito = lerConflito(bruto)
      return conflito === null ? null : { t: 'conflito', ...conflito }
    }
    case 'negado':
      return lerNegado(opId, bruto)
    case 'resolvido':
      return { t: 'resolvido', opId }
    default:
      return null
  }
}

/** Uma linha por registro; a que não é JSON (a cortada no fim) fica de fora. */
export function lerLinhasDaFila(texto: string): Carregado {
  const registros: unknown[] = []
  let ilegiveis = 0
  for (const linha of texto.split('\n')) {
    const limpa = linha.trim()
    if (limpa === '') continue
    try {
      registros.push(lerJsonSeguro(limpa))
    } catch (erro) {
      if (!(erro instanceof SyntaxError)) throw erro
      ilegiveis += 1
    }
  }
  return { registros, ilegiveis }
}

function linhasDe(registros: readonly RegistroDaFila[]): string {
  return registros.map((registro) => `${JSON.stringify(registro)}\n`).join('')
}

function terminaCortado(texto: string | null): boolean {
  return texto !== null && texto.length > 0 && !texto.endsWith('\n')
}

/** O `fila.jsonl`: só acrescenta linha. Se a última ficou cortada, a próxima gravação começa numa linha nova (senão grudaria nela e se perderia junto). */
export function armazenamentoEmTexto(arquivo: ArquivoDeTexto): ArmazenamentoDaFila {
  /** `null` = não se sabe (ainda não leu, ou a última gravação falhou no meio). */
  let fimCortado: boolean | null = null
  return {
    async carregar() {
      const texto = await arquivo.ler()
      fimCortado = terminaCortado(texto)
      return lerLinhasDaFila(texto ?? '')
    },
    async acrescentar(registros) {
      if (registros.length === 0) return
      if (fimCortado === null) fimCortado = terminaCortado(await arquivo.ler())
      const linhas = linhasDe(registros)
      try {
        await arquivo.acrescentar(fimCortado ? `\n${linhas}` : linhas)
        fimCortado = false
      } catch (erro) {
        fimCortado = null
        throw erro
      }
    },
    async substituir(registros) {
      fimCortado = null
      await arquivo.reescrever(linhasDe(registros))
      fimCortado = false
    },
  }
}

// ── Estado em memória ───────────────────────────────────────────────────────

type Entradas = Map<string, EntradaDaFila>

interface Estado {
  rev: number
  base: Map<string, Personagem>
  /** Na ordem da fila (a de criação): o `Map` mantém a ordem de inserção mesmo quando a entrada muda. */
  entradas: Entradas
  /** Tamanho aproximado do armazenamento, para a compactação. */
  bytes: number
}

function bytesDaLista(registros: readonly unknown[]): number {
  return registros.reduce<number>((soma, registro) => soma + bytesDoJson(registro) + 1, 0)
}

/** `t` e `v` depois da op: nem uma op torta sobrescreve o tipo e a versão do registro. */
function registroDaOp(op: Op, versao: number): RegistroDaFila {
  return { ...op, t: 'op', v: versao }
}

/** Cada op solta num registro; cada tudo-ou-nada inteiro num registro só. */
function registrosDasOps(ops: readonly Op[], versao: number): RegistroDaFila[] {
  return emGrupos(ops).map((grupo): RegistroDaFila => {
    const [primeira, ...resto] = grupo
    return resto.length === 0 ? registroDaOp(primeira, versao) : { t: 'grupo', v: versao, ops: grupo }
  })
}

function opDoRegistro(registro: Extract<RegistroDaFila, { t: 'op' }>): Op {
  const { t: _tipo, v: _versao, ...op } = registro
  return op
}

function registroDaDecisao(entrada: EntradaDaFila): RegistroDaFila | null {
  const { situacao, op } = entrada
  if (situacao.t === 'conflito') return { t: 'conflito', ...situacao.conflito }
  if (situacao.t !== 'negado') return null
  return situacao.detalhe === undefined ? { t: 'negado', opId: op.opId, motivo: situacao.motivo } : { t: 'negado', opId: op.opId, motivo: situacao.motivo, detalhe: situacao.detalhe }
}

function situacaoDaResposta(registro: Exclude<RegistroDaFila, { t: 'op' } | { t: 'grupo' } | { t: 'resolvido' } | { t: 'resolvidos' }>): SituacaoDaEntrada {
  switch (registro.t) {
    case 'ack':
      return { t: 'aceita', rev: registro.rev }
    case 'conflito': {
      const { t: _tipo, ...conflito } = registro
      return { t: 'conflito', conflito }
    }
    case 'negado':
      return registro.detalhe === undefined ? { t: 'negado', motivo: registro.motivo } : { t: 'negado', motivo: registro.motivo, detalhe: registro.detalhe }
  }
}

function esperaDecisao(situacao: SituacaoDaEntrada): boolean {
  return situacao.t === 'conflito' || situacao.t === 'negado'
}

function aindaEsperaDecisao(entradas: Entradas, opId: string): boolean {
  const entrada = entradas.get(opId)
  return entrada !== undefined && esperaDecisao(entrada.situacao)
}

/**
 * As ops novas entram pendentes, todas ou nenhuma (`false` = alguma já está na
 * fila). A de "Usar a minha" (`resolve`) encerra o conflito que cita: a
 * escolha e a op nova estão no mesmo registro, e a queda no meio da gravação
 * no máximo deixa o conflito aberto, nunca o fecha sem a op.
 */
function adotarOps(entradas: Entradas, ops: readonly Op[], versao: number): boolean {
  if (new Set(ops.map((op) => op.opId)).size !== ops.length || ops.some((op) => entradas.has(op.opId))) return false
  for (const op of ops) {
    entradas.set(op.opId, { op, situacao: { t: 'pendente' }, versao })
    // A citada pode já ter saído (a compactação guarda só o que espera decisão): então não há o que encerrar.
    const citada = op.resolve === undefined ? undefined : entradas.get(op.resolve)
    if (citada !== undefined && citada.situacao.t === 'conflito') entradas.delete(citada.op.opId)
  }
  return true
}

/**
 * Passa o registro para as entradas. `false` = não vale (op repetida, id
 * desconhecido, resposta para quem já tem resposta final, resolvido de quem
 * não espera decisão): nada muda. A primeira resposta final vence.
 */
function aplicarRegistro(entradas: Entradas, registro: RegistroDaFila): boolean {
  if (registro.t === 'op') return adotarOps(entradas, [opDoRegistro(registro)], registro.v)
  if (registro.t === 'grupo') return adotarOps(entradas, registro.ops, registro.v)
  if (registro.t === 'resolvidos') {
    // Todas ou nenhuma: uma que já não espera decisão invalida o registro inteiro.
    if (!registro.opIds.every((opId) => aindaEsperaDecisao(entradas, opId))) return false
    for (const opId of registro.opIds) entradas.delete(opId)
    return true
  }
  const entrada = entradas.get(registro.opId)
  if (entrada === undefined) return false
  if (registro.t === 'resolvido') {
    if (!esperaDecisao(entrada.situacao)) return false
    entradas.delete(registro.opId)
    return true
  }
  if (entrada.situacao.t !== 'pendente') return false
  entradas.set(registro.opId, { ...entrada, situacao: situacaoDaResposta(registro) })
  return true
}

/** A aceita que a base já alcançou está dentro dela: sai da fila (a gravação dela fica até a compactação). */
function descartarCobertas(estado: Estado): void {
  for (const [opId, entrada] of estado.entradas) {
    if (entrada.situacao.t === 'aceita' && entrada.situacao.rev <= estado.rev) estado.entradas.delete(opId)
  }
}

// ── Grupos tudo-ou-nada e a vista ───────────────────────────────────────────

function mesmoTudoOuNada(a: Op, b: Op): boolean {
  return a.atomico === true && b.atomico === true && a.loteId === b.loteId
}

/** Cada op solta é um grupo; as `atomico` seguidas do mesmo `loteId` formam um só (como o servidor agrupa). */
function emGrupos(ops: readonly Op[]): Op[][] {
  const grupos: Op[][] = []
  for (const op of ops) {
    const ultimo = grupos.at(-1)
    const anterior = ultimo?.at(-1)
    if (ultimo !== undefined && anterior !== undefined && mesmoTudoOuNada(anterior, op)) ultimo.push(op)
    else grupos.push([op])
  }
  return grupos
}

function poeNaVista(vista: Map<string, Personagem>, fichaId: string, doc: Personagem | null): void {
  if (doc === null) vista.delete(fichaId)
  else vista.set(fichaId, doc)
}

/** O grupo inteiro ou nada dele; a op que não cabe na vista de agora (o alvo sumiu) fica de fora: o servidor vai responder por ela. */
function aplicarGrupoNaVista(vista: Map<string, Personagem>, grupo: readonly Op[]): Map<string, Personagem> {
  const ensaio = grupo.length === 1 ? vista : new Map(vista)
  for (const op of grupo) {
    const aplicada = aplicarOp(ensaio.get(op.fichaId) ?? null, op)
    if (!aplicada.ok) return vista
    poeNaVista(ensaio, op.fichaId, aplicada.doc)
  }
  return ensaio
}

function vistaDe(estado: Estado): Map<string, Personagem> {
  const naVista = [...estado.entradas.values()].filter((entrada) => entrada.situacao.t !== 'conflito').map((entrada) => entrada.op)
  let vista = new Map(estado.base)
  for (const grupo of emGrupos(naVista)) vista = aplicarGrupoNaVista(vista, grupo)
  return vista
}

/** As ops que podem ir agora, em ordem: para na primeira adiada que ainda espera (a ordem do mesmo campo não pode trocar). */
function gruposParaEnviar(estado: Estado, agora: number): Op[][] {
  const prontas: Op[] = []
  for (const entrada of estado.entradas.values()) {
    if (entrada.situacao.t !== 'pendente') continue
    const { tentarDepoisDe } = entrada.situacao
    if (tentarDepoisDe !== undefined && tentarDepoisDe > agora) break
    prontas.push(entrada.op)
  }
  return emGrupos(prontas)
}

/** Grupos inteiros até o teto do lote e do frame; um grupo que sozinho passa do teto vai sozinho (o servidor responde por ele). */
function loteDosGrupos(grupos: readonly Op[][]): Op[] {
  const lote: Op[] = []
  let bytes = MOLDURA_DO_FRAME
  for (const grupo of grupos) {
    const doGrupo = bytesDaLista(grupo)
    const cabe = lote.length + grupo.length <= LIMITES.opsPorLote && bytes + doGrupo <= LIMITES.frameBytes
    if (!cabe) {
      if (lote.length === 0) lote.push(...grupo)
      break
    }
    lote.push(...grupo)
    bytes += doGrupo
  }
  return lote
}

// ── Validação da op nova (o mesmo esquema e os mesmos tetos do servidor) ───

function problema(opId: string, motivo: MotivoNaFila, detalhe: string): ProblemaNaFila {
  return { opId, motivo, detalhe }
}

type Conferida = { ok: true; op: Op } | { ok: false; problema: ProblemaNaFila }

function recusada(opId: string, motivo: MotivoNaFila, detalhe: string): Conferida {
  return { ok: false, problema: problema(opId, motivo, detalhe) }
}

/**
 * A op refeita só com o que o esquema conhece, como o servidor a refaz em
 * `validar`: é ela que vai ao disco e ao fio, nunca o objeto que chegou (uma
 * chave a mais, como `t` ou `autorContaId`, ficaria de fora). `resolve` só
 * vale na op de "Usar a minha", e tem de citar a decisão que ela encerra.
 */
function conferirNova(estado: Estado, bruta: Op, vistos: ReadonlySet<string>, resolve: string | undefined): Conferida {
  const leitura = lerEnvelope(bruta)
  if (!leitura.ok) return recusada(bruta.opId, 'fora-do-esquema', leitura.detalhe)
  const { envelope } = leitura
  if (vistos.has(envelope.opId) || estado.entradas.has(envelope.opId)) return recusada(envelope.opId, 'repetida', 'Esta mudança já está na fila')
  if (envelope.desfaz !== undefined) return recusada(envelope.opId, 'fora-do-esquema', 'Desfazer vai pelo pedido de desfazer, não pela fila')
  if (envelope.resolve !== resolve) return recusada(envelope.opId, 'fora-do-esquema', '"Usar a minha" vai pela decisão do conflito')
  const lida = lerMudanca(bruta)
  if (!lida.ok) return recusada(envelope.opId, lida.motivo, lida.detalhe)
  // Cópia: a op guardada não muda se quem a montou mexer no valor depois (a leitura guarda a mesma referência).
  const op: Op = structuredClone({ ...envelope, ...lida.mudanca })
  if (bytesDoJson(op) > tetoDaOpEmBytes(lida.lida.regra)) return recusada(op.opId, 'acima-do-teto', 'Mudança grande demais para o Lobby')
  if (op.baseRev < 0 || op.baseRev > estado.rev) return recusada(op.opId, 'base-invalida', 'A base da mudança ainda não chegou aqui')
  return { ok: true, op }
}

/** Todas conferidas, ou os problemas: uma recusada e nenhuma entra (é uma ação só da pessoa). `resolves[i]` = a decisão que a i-ésima encerra. */
function conferirNovas(estado: Estado, brutas: readonly Op[], resolves: readonly string[] = []): { ok: true; ops: Op[] } | { ok: false; problemas: ProblemaNaFila[] } {
  const vistos = new Set<string>()
  const problemas: ProblemaNaFila[] = []
  const ops: Op[] = []
  for (const [indice, bruta] of brutas.entries()) {
    const conferida = conferirNova(estado, bruta, vistos, resolves.at(indice))
    if (conferida.ok) ops.push(conferida.op)
    else problemas.push(conferida.problema)
    vistos.add(bruta.opId)
  }
  for (const grupo of emGrupos(brutas)) {
    if (grupo.length <= LIMITES.opsPorLote) continue
    // Tudo ou nada maior que o lote nunca caberia num frame: o servidor o recusaria inteiro.
    problemas.push(...grupo.map((op) => problema(op.opId, 'acima-do-teto', `Tudo ou nada grande demais: máximo ${LIMITES.opsPorLote} mudanças`)))
  }
  return problemas.length > 0 ? { ok: false, problemas } : { ok: true, ops }
}

// ── A fila ──────────────────────────────────────────────────────────────────

export async function criarFila(armazenamento: ArmazenamentoDaFila, base: BaseConfirmada = BASE_VAZIA): Promise<Fila> {
  if (!ehRev(base.rev)) throw new TypeError(`criarFila: rev da base inválida (${String(base.rev)})`)
  const carregado = await armazenamento.carregar()
  const estado: Estado = { rev: base.rev, base: baseDe(base), entradas: new Map(), bytes: bytesDaLista(carregado.registros) }
  let ignorados = carregado.ilegiveis
  for (const bruto of carregado.registros) {
    const registro = lerRegistro(bruto)
    if (registro === null || !aplicarRegistro(estado.entradas, registro)) ignorados += 1
  }
  descartarCobertas(estado)
  return montarFila(estado, armazenamento, ignorados)
}

function baseDe(base: BaseConfirmada): Map<string, Personagem> {
  return new Map(base.fichas.map((doc): [string, Personagem] => [doc.id, doc]))
}

function montarFila(estado: Estado, armazenamento: ArmazenamentoDaFila, ignoradosAoAbrir: number): Fila {
  let cadeia: Promise<unknown> = Promise.resolve()
  /** Uma gravação por vez, na ordem em que foram pedidas; quem pediu recebe a falha, e a próxima segue. */
  function emOrdem<T>(passo: () => Promise<T>): Promise<T> {
    const resultado = cadeia.then(passo)
    cadeia = resultado.catch(() => undefined)
    return resultado
  }
  /** Disco primeiro, memória depois: se a gravação falha, nada muda na fila. */
  async function gravarEAdotar(registros: readonly RegistroDaFila[], ensaio: Entradas): Promise<void> {
    if (registros.length > 0) await armazenamento.acrescentar(registros)
    estado.bytes += bytesDaLista(registros)
    estado.entradas = ensaio
    descartarCobertas(estado)
  }
  /** Grava e passa para as entradas, na ordem; cada registro é uma linha (o que não pode ficar pela metade já vem num só). */
  async function gravarRegistros(registros: readonly RegistroDaFila[]): Promise<void> {
    const ensaio = new Map(estado.entradas)
    for (const registro of registros) aplicarRegistro(ensaio, registro)
    await gravarEAdotar(registros, ensaio)
  }
  async function acrescentarNovas(brutas: readonly Op[], resolves?: readonly string[]): Promise<ResultadoNaFila> {
    const conferidas = conferirNovas(estado, brutas, resolves)
    if (!conferidas.ok) return conferidas
    await gravarRegistros(registrosDasOps(conferidas.ops, VERSAO_DO_FORMATO))
    return { ok: true }
  }
  async function resolverDecisao(opId: string, usarAMinha: Op | undefined): Promise<ResultadoNaFila> {
    const entrada = estado.entradas.get(opId)
    if (entrada === undefined || !esperaDecisao(entrada.situacao)) return { ok: false, problemas: [problema(opId, 'sem-decisao', 'Esta mudança não espera decisão')] }
    if (usarAMinha === undefined) {
      await gravarRegistros([{ t: 'resolvido', opId }])
      return { ok: true }
    }
    // A negada é definitiva (§5.4): mandar de novo seria negada de novo. "Usar a minha" é só do conflito.
    if (entrada.situacao.t !== 'conflito') return { ok: false, problemas: [problema(opId, 'sem-decisao', '"Usar a minha" só vale no conflito')] }
    // Sem `resolvido` à parte: a op nova (`resolve = opId`) encerra o conflito na mesma linha em que é gravada.
    return acrescentarNovas([usarAMinha], [opId])
  }
  async function resolverOGrupo(decisoes: readonly DecisaoDaFila[]): Promise<ResultadoNaFila> {
    const [primeira, ...resto] = decisoes
    if (primeira === undefined) return { ok: true }
    if (resto.length === 0) return resolverDecisao(primeira.opId, primeira.usarAMinha)
    const opIds = decisoes.map((decisao) => decisao.opId)
    const recusadas = (motivo: MotivoNaFila, detalhe: string): ResultadoNaFila => ({ ok: false, problemas: opIds.map((opId) => problema(opId, motivo, detalhe)) })
    if (new Set(opIds).size !== opIds.length) return recusadas('repetida', 'A mesma mudança apareceu duas vezes na decisão')
    if (!opIds.every((opId) => aindaEsperaDecisao(estado.entradas, opId))) return recusadas('sem-decisao', 'Alguma mudança da troca não espera mais decisão')
    const novas = decisoes.flatMap((decisao) => (decisao.usarAMinha === undefined ? [] : [decisao.usarAMinha]))
    if (novas.length === 0) {
      await gravarRegistros([{ t: 'resolvidos', opIds }])
      return { ok: true }
    }
    if (novas.length !== decisoes.length) return recusadas('sem-decisao', '"Usar a minha" vale para a troca inteira ou para nenhuma parte dela')
    if (!opIds.every((opId) => estado.entradas.get(opId)?.situacao.t === 'conflito')) return recusadas('sem-decisao', '"Usar a minha" só vale no conflito')
    // Um registro só (`grupo`) só existe para um tudo-ou-nada: as ops novas têm de formar um.
    if (emGrupos(novas).length !== 1) return recusadas('fora-do-esquema', 'As mudanças novas da troca têm de ir juntas, tudo ou nada')
    return acrescentarNovas(novas, opIds)
  }
  return {
    ignoradosAoAbrir,
    revConfirmada: () => estado.rev,
    vistaLocal: () => vistaDe(estado),
    entradas: () => [...estado.entradas.values()],
    paraDecidir: () => [...estado.entradas.values()].filter((entrada) => esperaDecisao(entrada.situacao)),
    esperando: () => [...estado.entradas.values()].filter((entrada) => entrada.situacao.t === 'pendente').length,
    paraEnviar: (agora) => loteDosGrupos(gruposParaEnviar(estado, agora)),
    acrescentar: (ops) => emOrdem(() => acrescentarNovas(ops)),
    receberRespostas: (respostas) => emOrdem(() => receberRespostas(estado, respostas, gravarEAdotar)),
    receberRemotas: (remotas) => emOrdem(() => receberRemotas(estado, remotas, gravarEAdotar)),
    receberEstado: (nova) => emOrdem(async () => receberEstado(estado, nova)),
    resolver: (opId, usarAMinha) => emOrdem(() => resolverDecisao(opId, usarAMinha)),
    resolverGrupo: (decisoes) => emOrdem(() => resolverOGrupo(decisoes)),
    compactarSePreciso: () => emOrdem(() => compactar(estado, armazenamento)),
  }
}

type GravarEAdotar = (registros: readonly RegistroDaFila[], ensaio: Entradas) => Promise<void>

/** A resposta vem do fio: passa pelo mesmo leitor do disco. Adiado só muda a memória (depois de reabrir, vai de novo e o servidor adia de novo). */
async function receberRespostas(estado: Estado, respostas: readonly RespostaDaOp[], gravarEAdotar: GravarEAdotar): Promise<void> {
  const ensaio = new Map(estado.entradas)
  const registros: RegistroDaFila[] = []
  for (const resposta of respostas) {
    if (resposta.t === 'adiado') {
      const entrada = ensaio.get(resposta.opId)
      if (entrada === undefined || entrada.situacao.t !== 'pendente' || !Number.isFinite(resposta.tentarDepoisDe)) continue
      ensaio.set(resposta.opId, { ...entrada, situacao: { t: 'pendente', tentarDepoisDe: resposta.tentarDepoisDe, motivoDoAdiamento: resposta.motivo } })
      continue
    }
    const registro = lerRegistro(resposta)
    // Do fio só vem resposta: op, grupo ou resolvido ali seria o servidor escrevendo na fila local.
    if (registro === null || registro.t === 'op' || registro.t === 'grupo' || registro.t === 'resolvido' || registro.t === 'resolvidos') continue
    if (aplicarRegistro(ensaio, registro)) registros.push(registro)
  }
  await gravarEAdotar(registros, ensaio)
}

/**
 * As ops confirmadas andam a base, na ordem da rev; a vista é refeita por
 * cima (rebase). A própria op que volta (o eco, mesmo `opId`) vale como ack:
 * o ack pode ter se perdido na queda, e a soma não pode entrar duas vezes. A
 * numeração pode ter buraco de propósito (op que o jogador não vê): o que diz
 * até onde a lista cobre é `ate`.
 */
async function receberRemotas(estado: Estado, remotas: RemotasRecebidas, gravarEAdotar: GravarEAdotar): Promise<ResultadoDasRemotas> {
  if (!ehRev(remotas.desde) || remotas.desde > estado.rev) return { t: 'buraco' }
  const ate = ehRev(remotas.ate) ? remotas.ate : estado.rev
  const base = new Map(estado.base)
  const ensaio = new Map(estado.entradas)
  const registros: RegistroDaFila[] = []
  const naoAplicaveis: string[] = []
  let ultima = estado.rev
  let aplicadas = 0
  for (const op of [...remotas.lista].sort((a, b) => a.rev - b.rev)) {
    if (!ehRev(op.rev) || op.rev <= ultima || op.rev > ate) continue
    ultima = op.rev
    const aplicada = aplicarOp(base.get(op.fichaId) ?? null, op)
    if (aplicada.ok) {
      poeNaVista(base, op.fichaId, aplicada.doc)
      aplicadas += 1
    } else {
      naoAplicaveis.push(op.opId)
    }
    const eco: RegistroDaFila = { t: 'ack', opId: op.opId, rev: op.rev }
    if (aplicarRegistro(ensaio, eco)) registros.push(eco)
  }
  await gravarEAdotar(registros, ensaio)
  estado.base = base
  estado.rev = Math.max(estado.rev, ate)
  descartarCobertas(estado)
  return { t: 'ok', aplicadas, naoAplicaveis }
}

/**
 * O `estado` do site (snapshot, sem os `opId`): a op mandada cuja resposta se
 * perdeu pode já estar dentro dele, e então a soma aparece dobrada na vista
 * até o reenvio receber o ack com a rev antiga e a entrada sair. O app nunca
 * recebe snapshot (`desde` sempre em ops), então lá isso não acontece.
 */
function receberEstado(estado: Estado, nova: BaseConfirmada): boolean {
  if (!ehRev(nova.rev) || nova.rev < estado.rev) return false
  estado.base = baseDe(nova)
  estado.rev = nova.rev
  descartarCobertas(estado)
  return true
}

/** "Só quando tudo foi confirmado e passa de 256 KB" (§4.4): ficam só as que esperam decisão, com a op e a resposta. */
async function compactar(estado: Estado, armazenamento: ArmazenamentoDaFila): Promise<boolean> {
  if (estado.bytes <= TETO_DA_FILA_EM_BYTES) return false
  const entradas = [...estado.entradas.values()]
  if (entradas.some((entrada) => !esperaDecisao(entrada.situacao))) return false
  const registros = entradas.flatMap((entrada) => {
    const decisao = registroDaDecisao(entrada)
    return decisao === null ? [] : [registroDaOp(entrada.op, entrada.versao), decisao]
  })
  await armazenamento.substituir(registros)
  estado.bytes = bytesDaLista(registros)
  return true
}
