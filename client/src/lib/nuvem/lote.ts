import type { Personagem } from '../personagem'
import { aplicarOp } from './aplicar'
import { lerMudanca, segmentoValido, type NomeDaRegra } from './caminho'
import { conflitoDeFichaApagada, montarConflito, opConcorrente, valorNoCaminho } from './conflito'
import { bytesDoJson, ehRegistro, proprio, type Json } from './json'
import { cabeNaCota, chaveDaCotaDaCampanha, chaveDaCotaDaConta, comNegadaContada, comOpContada, LIMITES, tetoDaOpEmBytes, type Cota } from './limites'
import { autorDaOp, membroAtivo, permissaoDaMudanca, podeDeclararAutor, type AutorEfetivo } from './permissao'
import type {
  Conflito,
  FichaGuardada,
  Identidade,
  Membro,
  MensagemDoServidor,
  MotivoAdiado,
  MotivoNegado,
  Mudanca,
  Op,
  OpGravada,
  Recusada,
  Visibilidade,
} from './tipos'

/**
 * PROCESSAR LOTE (docs/planos/lobby-jogadores-2026-11-05.md §5.2-5.4, §6.4,
 * §6.5): o único validador do servidor, o mesmo para o WebSocket do site, o
 * POST do app e o desfazer. Puro: lê a campanha por um leitor síncrono (o
 * SQLite do DO é síncrono) e devolve o que gravar, que o DO grava inteiro num
 * `transactionSync` só.
 *
 * Cada op recebe uma resposta, e nenhuma some em silêncio:
 * - `ack`: gravada, com a rev nova (também o eco "criar o que já existe");
 * - `conflito`: mesmo campo mudado depois da base por outra autoria; fica em
 *   `recusadas` até alguém decidir;
 * - `negado`: definitivo (fora do esquema, sem permissão, base inválida…);
 *   o cliente guarda a op até alguém decidir;
 * - `adiado`: cota ou ritmo; o cliente reenvia sozinho com o mesmo `opId`.
 *   Depois da primeira adiada, as seguintes do lote também esperam (a fila
 *   manda em ordem, e a mais nova no mesmo campo nunca pode entrar antes).
 *
 * Op por op: campo diferente nunca é derrubado pelo conflito de outro. Só as
 * `atomico` seguidas do mesmo `loteId` (troca e pagamento de itens, ficha
 * trocada inteira) são tudo ou nada. O mesmo `opId` de novo, aceito ou
 * recusado, recebe a mesma resposta e nunca grava duas vezes.
 */

/** A campanha como o DO a lê. Tudo síncrono e só do que já foi gravado. */
export interface LeitorDaCampanha {
  /** A última rev gravada; 0 = nenhuma op ainda. */
  revAtual(): number
  ficha(fichaId: string): FichaGuardada | undefined
  opGravada(opId: string): OpGravada | undefined
  recusada(opId: string): Recusada | undefined
  /** As ops da ficha com `rev > depoisDe`, na ordem da rev (índice `(fichaId, rev)`). */
  opsDaFicha(fichaId: string, depoisDe: number): readonly OpGravada[]
  /** As ops que desfazem `opId` (coluna `desfaz`). */
  desfeitasDe(opId: string): readonly OpGravada[]
  membro(contaId: string): Membro | undefined
  cota(chave: string): Cota | undefined
}

export type RespostaDaOp = Extract<MensagemDoServidor, { t: 'ack' | 'conflito' | 'negado' | 'adiado' }>

/** O que o DO grava, inteiro, numa transação: ops novas (na ordem da rev), fichas como ficaram, recusadas novas, cotas. */
export interface Gravacoes {
  ops: OpGravada[]
  fichas: FichaGuardada[]
  recusadas: Recusada[]
  cotas: { chave: string; cota: Cota }[]
}

export interface ResultadoDoProcessamento {
  /** Uma por op que tinha `opId` legível, na ordem do lote. */
  respostas: RespostaDaOp[]
  gravacoes: Gravacoes
  revAtual: number
  /** Para o limitador (§6.5): op sem `opId` e negada por regra. Nunca conta `adiado` nem a corrida com a ficha de agora. */
  violacoes: number
}

/** Negado que o cliente certo nunca manda (ele valida antes com as mesmas funções): conta como violação. */
const MOTIVOS_DE_VIOLACAO: ReadonlySet<MotivoNegado> = new Set<MotivoNegado>(['fora-do-esquema', 'sem-permissao', 'base-invalida', 'versao'])

/** Ficha criada por op entra na mesa; a do treino só nasce pelo publicar (T8). */
const VISIBILIDADE_DE_FICHA_NOVA: Visibilidade = 'mesa'

export function processarLote(leitor: LeitorDaCampanha, quem: Identidade, lote: readonly unknown[], agora: number): ResultadoDoProcessamento {
  return processar(leitor, quem, lote, agora, false)
}

/** Para `desfazer.ts`: a inversa montada pelo servidor, a única op que pode levar `desfaz`. */
export function processarInversa(leitor: LeitorDaCampanha, quem: Identidade, inversa: Op, agora: number): ResultadoDoProcessamento {
  return processar(leitor, quem, [inversa], agora, true)
}

/** O pedido que nem vira op: sem id legível (só violação), recusado antes de montar a op, ou já respondido antes. */
export type SemOp = { t: 'malformado' } | { t: 'negar'; opId: string; motivo: MotivoNegado; detalhe: string } | { t: 'dada'; resposta: RespostaDaOp }

/** A resposta do pedido que nem vira op (o desfazer), com a negada contada como qualquer outra. */
export function resultadoSemOp(leitor: LeitorDaCampanha, quem: Identidade, saida: SemOp, agora: number): ResultadoDoProcessamento {
  const estado = estadoInicial(leitor)
  if (saida.t === 'malformado') return resultadoDe(estado, [], 1)
  const processo = processoDe(estado, leitor, quem, agora, true)
  const respostas = [saida.t === 'negar' ? negar(processo, saida.opId, saida.motivo, saida.detalhe) : saida.resposta]
  return resultadoDe(estado, respostas, processo.violacoes)
}

/** O `opId` (sem ele não há a quem responder) ou o `loteId` da entrada, se legível. */
function segmentoLegivel(entrada: unknown, campo: 'opId' | 'loteId'): string | null {
  if (!ehRegistro(entrada)) return null
  const segmento = proprio(entrada, campo)
  return segmentoValido(segmento) ? segmento : null
}

/** Frame de ops recusado pelo ritmo (§6.5): cada op vira `adiado`, nunca `negado`. */
export function respostasAdiadas(lote: readonly unknown[], motivo: MotivoAdiado, tentarDepoisDe: number): RespostaDaOp[] {
  return lote.flatMap((entrada): RespostaDaOp[] => {
    const opId = segmentoLegivel(entrada, 'opId')
    return opId === null ? [] : [{ t: 'adiado', opId, motivo, tentarDepoisDe }]
  })
}

/**
 * Este `opId` já passou por aqui? `dada` = a mesma resposta de antes (ack com
 * a mesma rev, ou o mesmo conflito). `alheia` = o `opId` é de outro autor: ele
 * não recebe nada da op alheia (o conflito guardado pode mostrar valor que
 * ele não vê).
 */
export type Reenvio = { t: 'nova' } | { t: 'dada'; resposta: RespostaDaOp } | { t: 'alheia' }

export function reenvio(gravada: OpGravada | undefined, recusada: Recusada | undefined, autorContaId: string): Reenvio {
  if (gravada !== undefined) return gravada.autorContaId === autorContaId ? { t: 'dada', resposta: { t: 'ack', opId: gravada.opId, rev: gravada.rev } } : { t: 'alheia' }
  if (recusada !== undefined) return recusada.autorContaId === autorContaId ? { t: 'dada', resposta: { t: 'conflito', ...recusada.resposta } } : { t: 'alheia' }
  return { t: 'nova' }
}

// ── Estado do lote: o já gravado (leitor) + o que este lote fez ────────────

interface Estado {
  leitor: LeitorDaCampanha
  rev: number
  fichas: Map<string, FichaGuardada>
  ops: OpGravada[]
  recusadas: Map<string, Recusada>
  cotas: Map<string, Cota>
}

function copiar(estado: Estado): Estado {
  return { ...estado, fichas: new Map(estado.fichas), ops: [...estado.ops], recusadas: new Map(estado.recusadas), cotas: new Map(estado.cotas) }
}

function adotar(estado: Estado, ensaio: Estado): void {
  estado.rev = ensaio.rev
  estado.fichas = ensaio.fichas
  estado.ops = ensaio.ops
  estado.recusadas = ensaio.recusadas
  estado.cotas = ensaio.cotas
}

function fichaDe(estado: Estado, fichaId: string): FichaGuardada | undefined {
  return estado.fichas.get(fichaId) ?? estado.leitor.ficha(fichaId)
}

function opGravadaDe(estado: Estado, opId: string): OpGravada | undefined {
  return estado.ops.find((op) => op.opId === opId) ?? estado.leitor.opGravada(opId)
}

function recusadaDe(estado: Estado, opId: string): Recusada | undefined {
  return estado.recusadas.get(opId) ?? estado.leitor.recusada(opId)
}

function opsDaFichaDe(estado: Estado, fichaId: string, depoisDe: number): OpGravada[] {
  return [...estado.leitor.opsDaFicha(fichaId, depoisDe), ...estado.ops.filter((op) => op.fichaId === fichaId && op.rev > depoisDe)]
}

function cotaDe(estado: Estado, chave: string): Cota | undefined {
  return estado.cotas.get(chave) ?? estado.leitor.cota(chave)
}

function docDe(ficha: FichaGuardada | undefined): Personagem | null {
  return ficha === undefined || ficha.apagada ? null : ficha.doc
}

// ── O lote ──────────────────────────────────────────────────────────────────

interface Processo {
  estado: Estado
  quem: Identidade
  remetente: Membro | undefined
  agora: number
  doServidor: boolean
  /** `opId` já visto neste lote: repetido no mesmo frame é erro do cliente. */
  vistos: Set<string>
  violacoes: number
}

function estadoInicial(leitor: LeitorDaCampanha): Estado {
  return { leitor, rev: leitor.revAtual(), fichas: new Map(), ops: [], recusadas: new Map(), cotas: new Map() }
}

function processoDe(estado: Estado, leitor: LeitorDaCampanha, quem: Identidade, agora: number, doServidor: boolean): Processo {
  return { estado, quem, remetente: leitor.membro(quem.contaId), agora, doServidor, vistos: new Set(), violacoes: 0 }
}

function resultadoDe(estado: Estado, respostas: RespostaDaOp[], violacoes: number): ResultadoDoProcessamento {
  return {
    respostas,
    gravacoes: {
      ops: estado.ops,
      fichas: [...estado.fichas.values()],
      recusadas: [...estado.recusadas.values()],
      cotas: [...estado.cotas].map(([chave, cota]) => ({ chave, cota })),
    },
    revAtual: estado.rev,
    violacoes,
  }
}

function processar(leitor: LeitorDaCampanha, quem: Identidade, lote: readonly unknown[], agora: number, doServidor: boolean): ResultadoDoProcessamento {
  const estado = estadoInicial(leitor)
  const processo = processoDe(estado, leitor, quem, agora, doServidor)
  const respostas: RespostaDaOp[] = []
  if (lote.length > LIMITES.opsPorLote) {
    // Lote grande demais é frame torto: nada entra (cortar no meio poderia partir um tudo-ou-nada). Uma violação só.
    processo.violacoes += 1
    for (const opId of lote.map((entrada) => segmentoLegivel(entrada, 'opId'))) {
      if (opId !== null) respostas.push(negar(processo, opId, 'acima-do-teto', `Lote grande demais: máximo ${LIMITES.opsPorLote} mudanças`, true))
    }
  } else {
    let adiamento: Adiamento | null = null
    for (const grupo of emGrupos(lote)) {
      const validacoes = grupo.map((entrada) => validar(processo, entrada))
      processo.violacoes += validacoes.filter((validacao) => validacao.t === 'malformada').length
      const doGrupo = responderGrupo(processo, validacoes, adiamento)
      respostas.push(...doGrupo)
      if (adiamento === null) adiamento = adiamentoDe(doGrupo)
    }
  }
  return resultadoDe(estado, respostas, processo.violacoes)
}

/**
 * A primeira adiada do lote segura as seguintes: a cota é conferida op a op, e
 * a op menor caberia depois da maior adiada. Do mesmo aparelho no mesmo campo
 * não há conflito, então a mais velha, reenviada amanhã, apagaria a mais nova.
 */
interface Adiamento {
  motivo: MotivoAdiado
  tentarDepoisDe: number
}

function adiamentoDe(respostas: readonly RespostaDaOp[]): Adiamento | null {
  for (const dada of respostas) {
    if (dada.t === 'adiado') return { motivo: dada.motivo, tentarDepoisDe: dada.tentarDepoisDe }
  }
  return null
}

function ehAtomica(entrada: unknown): boolean {
  return ehRegistro(entrada) && proprio(entrada, 'atomico') === true
}

interface Grupo {
  entradas: unknown[]
  /** O primeiro `loteId` legível do grupo; `null` = nenhum ainda. */
  loteId: string | null
}

/**
 * Cada op solta é um grupo; as `atomico` seguidas DO MESMO `loteId` formam um
 * grupo só (§5.2: tudo ou nada só entre as ops geradas juntas). Duas trocas no
 * mesmo frame, cada uma com o seu lote, nunca se derrubam. A atômica de lote
 * ilegível fica no grupo em que está: ela vai ser negada, e o grupo não pode
 * entrar pela metade.
 */
function emGrupos(lote: readonly unknown[]): unknown[][] {
  const grupos: Grupo[] = []
  let anteriorAtomica = false
  for (const entrada of lote) {
    const atomica = ehAtomica(entrada)
    const loteId = segmentoLegivel(entrada, 'loteId')
    const ultimo = grupos.at(-1)
    const mesmoLote = ultimo !== undefined && (loteId === null || ultimo.loteId === null || ultimo.loteId === loteId)
    if (atomica && anteriorAtomica && ultimo !== undefined && mesmoLote) {
      ultimo.entradas.push(entrada)
      if (ultimo.loteId === null) ultimo.loteId = loteId
    } else {
      grupos.push({ entradas: [entrada], loteId })
    }
    anteriorAtomica = atomica
  }
  return grupos.map((grupo) => grupo.entradas)
}

/**
 * A op negada vira só contador (§4.5), na conta de quem mandou, e conta como
 * violação se o motivo é regra que o cliente certo nunca quebra. `colateral`
 * = recusada só por ir junto com outra (tudo ou nada): não é violação dela.
 */
function negar(processo: Processo, opId: string, motivo: MotivoNegado, detalhe: string, colateral = false): RespostaDaOp {
  const chave = chaveDaCotaDaConta(processo.quem.contaId, processo.agora)
  processo.estado.cotas.set(chave, comNegadaContada(cotaDe(processo.estado, chave)))
  if (!colateral && MOTIVOS_DE_VIOLACAO.has(motivo)) processo.violacoes += 1
  return { t: 'negado', opId, motivo, detalhe }
}

// ── Fase 1: validar (envelope, membro, autor, reenvio, esquema, base, permissão) ──

export interface Envelope {
  opId: string
  loteId: string
  baseRev: number
  clienteId: string
  quandoCliente: number
  desfaz?: string
  resolve?: string
  autorDeclarado?: string
}

export type LeituraDoEnvelope = { ok: true; envelope: Envelope } | { ok: false; opId: string | null; detalhe: string }

/** O envelope da op que veio do fio (ou do disco, na fila); o `opId` sai mesmo com o resto torto, para a recusa ter a quem responder. */
export function lerEnvelope(entrada: unknown): LeituraDoEnvelope {
  if (!ehRegistro(entrada)) return { ok: false, opId: null, detalhe: 'Mudança fora do formato' }
  const opId = proprio(entrada, 'opId')
  if (!segmentoValido(opId)) return { ok: false, opId: null, detalhe: 'Mudança sem id' }
  const loteId = proprio(entrada, 'loteId')
  const clienteId = proprio(entrada, 'clienteId')
  const baseRev = proprio(entrada, 'baseRev')
  const quandoCliente = proprio(entrada, 'quandoCliente')
  if (!segmentoValido(loteId) || !segmentoValido(clienteId)) return { ok: false, opId, detalhe: 'Mudança sem lote ou sem aparelho' }
  if (typeof baseRev !== 'number' || !Number.isSafeInteger(baseRev)) return { ok: false, opId, detalhe: 'Base da mudança fora do formato' }
  if (typeof quandoCliente !== 'number' || !Number.isFinite(quandoCliente)) return { ok: false, opId, detalhe: 'Hora da mudança fora do formato' }
  const envelope: Envelope = { opId, loteId, baseRev, clienteId, quandoCliente }
  for (const campo of ['desfaz', 'resolve', 'autorDeclarado'] as const) {
    const valor = proprio(entrada, campo)
    if (valor === undefined) continue
    if (!segmentoValido(valor)) return { ok: false, opId, detalhe: 'Mudança fora do formato' }
    envelope[campo] = valor
  }
  return { ok: true, envelope }
}

interface Validada {
  op: Op
  regra: NomeDaRegra
  remetente: Membro
  autor: AutorEfetivo
  bytes: number
}

type Validacao = { t: 'malformada' } | { t: 'resposta'; resposta: RespostaDaOp } | { t: 'valida'; validada: Validada }

function validar(processo: Processo, entrada: unknown): Validacao {
  const { estado, quem, remetente } = processo
  const leitura = lerEnvelope(entrada)
  if (!leitura.ok) return leitura.opId === null ? { t: 'malformada' } : resposta(negar(processo, leitura.opId, 'fora-do-esquema', leitura.detalhe))
  const envelope = leitura.envelope
  const { opId } = envelope
  if (processo.vistos.has(opId)) return resposta(negar(processo, opId, 'fora-do-esquema', 'Id de mudança repetido no mesmo lote'))
  processo.vistos.add(opId)
  const jaDada = respostaJaDada(processo, envelope)
  if (jaDada !== null) return resposta(jaDada)
  if (!membroAtivo(remetente)) return resposta(negar(processo, opId, 'sem-permissao', 'Você não está nesta campanha'))
  const declarado = envelope.autorDeclarado
  const autoria = autorDaOp(quem, remetente, declarado, declarado === undefined ? undefined : estado.leitor.membro(declarado))
  if (!autoria.ok) return resposta(negar(processo, opId, autoria.motivo, autoria.detalhe))
  const autor = autoria.autor
  // A resposta já dada a este autor saiu em `respostaJaDada`; aqui sobra o id que é de outra pessoa.
  if (reenvio(opGravadaDe(estado, opId), recusadaDe(estado, opId), autor.membro.contaId).t === 'alheia') {
    return resposta(negar(processo, opId, 'sem-permissao', 'Este id de mudança é de outra pessoa'))
  }
  if (envelope.desfaz !== undefined && !processo.doServidor) return resposta(negar(processo, opId, 'fora-do-esquema', 'Desfazer vai pelo pedido de desfazer'))
  if (envelope.resolve !== undefined && recusadaDe(estado, envelope.resolve)?.autorContaId !== autor.membro.contaId) {
    return resposta(negar(processo, opId, 'sem-permissao', 'Só dá para resolver a própria mudança recusada'))
  }
  const lida = lerMudanca(entrada)
  if (!lida.ok) return resposta(negar(processo, opId, lida.motivo, lida.detalhe))
  const op: Op = { ...envelope, ...lida.mudanca }
  const bytes = bytesDoJson(op)
  if (bytes > tetoDaOpEmBytes(lida.lida.regra)) return resposta(negar(processo, opId, 'acima-do-teto', 'Mudança grande demais para o Lobby'))
  if (op.baseRev < 0 || op.baseRev > estado.rev) return resposta(negar(processo, opId, 'base-invalida', 'A base da mudança não existe nesta campanha'))
  const permissao = permissaoDaMudanca(remetente, fichaDe(estado, op.fichaId), op)
  if (!permissao.ok) return resposta(negar(processo, opId, permissao.motivo, permissao.detalhe))
  return { t: 'valida', validada: { op, regra: lida.lida.regra, remetente, autor, bytes } }
}

function resposta(dada: RespostaDaOp): Validacao {
  return { t: 'resposta', resposta: dada }
}

/**
 * O reenvio de uma op já respondida (o ack se perdeu) recebe a mesma resposta
 * ANTES de conferir membro e autor de hoje: quem saiu da campanha depois, ou
 * o jogador da sala que saiu, não transforma em "negado" uma op que está no
 * log. O autor declarado só conta vindo do app do mestre, como em
 * `autorDaOp`: declarar o autor de uma op alheia não devolve a resposta dela.
 * `null` = segue a validação de sempre.
 */
function respostaJaDada(processo: Processo, envelope: Envelope): RespostaDaOp | null {
  const { estado, quem, remetente } = processo
  const declarado = envelope.autorDeclarado
  if (declarado !== undefined && !podeDeclararAutor(quem, remetente)) return null
  const autorContaId = declarado === undefined ? quem.contaId : declarado
  const repetida = reenvio(opGravadaDe(estado, envelope.opId), recusadaDe(estado, envelope.opId), autorContaId)
  return repetida.t === 'dada' ? repetida.resposta : null
}

// ── Fase 2: executar (cota, conflito, aplicar, gravar), tudo ou nada no grupo ──

type Desfecho =
  | { t: 'ack'; resposta: RespostaDaOp }
  | { t: 'adiado'; motivo: MotivoAdiado; tentarDepoisDe: number }
  | { t: 'conflito'; conflito: Conflito }
  | { t: 'negado'; motivo: MotivoNegado; detalhe: string }

/**
 * As respostas do grupo, na ordem. Grupo atômico com uma op negada já na
 * validação: nenhuma das outras entra. As válidas rodam num ensaio do
 * estado; a primeira que não entra derruba o grupo inteiro (a solta é um
 * grupo de uma). Com `adiamento` (uma anterior do lote foi adiada), as
 * válidas nem rodam: esperam junto, na mesma hora.
 */
function responderGrupo(processo: Processo, validacoes: readonly Validacao[], adiamento: Adiamento | null): RespostaDaOp[] {
  const validas = validacoes.flatMap((validacao) => (validacao.t === 'valida' ? [validacao.validada] : []))
  const negadas = validacoes.flatMap((validacao) => (validacao.t === 'resposta' && validacao.resposta.t === 'negado' ? [validacao.resposta] : []))
  const executadas = new Map<Validada, RespostaDaOp>()
  const primeiraNegada = negadas.at(0)
  // Tudo ou nada: a irmã ilegível (sem id) também derruba o grupo, senão ele entraria pela metade.
  const temIlegivel = validacoes.some((validacao) => validacao.t === 'malformada')
  if (primeiraNegada !== undefined || temIlegivel) {
    const motivo = primeiraNegada === undefined ? 'fora-do-esquema' : primeiraNegada.motivo
    const causa = primeiraNegada === undefined ? 'uma mudança ilegível' : `a mudança ${primeiraNegada.opId}`
    for (const validada of validas) executadas.set(validada, negar(processo, validada.op.opId, motivo, `Vai junto com ${causa}, recusada`, true))
  } else if (adiamento !== null) {
    for (const validada of validas) executadas.set(validada, { t: 'adiado', opId: validada.op.opId, ...adiamento })
  } else {
    executarGrupo(processo, validas).forEach((dada, indice) => executadas.set(validas[indice], dada))
  }
  return validacoes.flatMap((validacao): RespostaDaOp[] => {
    if (validacao.t === 'malformada') return []
    if (validacao.t === 'resposta') return [validacao.resposta]
    const dada = executadas.get(validacao.validada)
    return dada === undefined ? [] : [dada]
  })
}

function executarGrupo(processo: Processo, grupo: readonly Validada[]): RespostaDaOp[] {
  const ensaio = copiar(processo.estado)
  const feitas: RespostaDaOp[] = []
  for (const validada of grupo) {
    const desfecho = executar(ensaio, processo, validada)
    if (desfecho.t !== 'ack') return recusarGrupo(processo, grupo, validada, desfecho)
    feitas.push(desfecho.resposta)
  }
  adotar(processo.estado, ensaio)
  return feitas
}

/** O grupo inteiro volta com a resposta da op que não entrou; as outras dizem que vão junto com ela. */
function recusarGrupo(processo: Processo, grupo: readonly Validada[], falhou: Validada, desfecho: Exclude<Desfecho, { t: 'ack' }>): RespostaDaOp[] {
  const opIdQueFalhou = falhou.op.opId
  switch (desfecho.t) {
    case 'adiado':
      return grupo.map((validada) => ({ t: 'adiado', opId: validada.op.opId, motivo: desfecho.motivo, tentarDepoisDe: desfecho.tentarDepoisDe }))
    case 'negado':
      return grupo.map((validada) =>
        validada === falhou
          ? negar(processo, opIdQueFalhou, desfecho.motivo, desfecho.detalhe)
          : negar(processo, validada.op.opId, desfecho.motivo, `Vai junto com a mudança ${opIdQueFalhou}, recusada: ${desfecho.detalhe}`, true),
      )
    case 'conflito':
      return grupo.map((validada) => {
        const conflito = validada === falhou ? desfecho.conflito : conflitoQueVaiJunto(processo.estado, validada, desfecho.conflito)
        guardarRecusada(processo, validada, conflito)
        return { t: 'conflito', ...conflito }
      })
  }
}

/** A irmã de tudo-ou-nada da op que bateu: mesma pessoa e hora, o valor de agora no caminho dela. */
function conflitoQueVaiJunto(estado: Estado, validada: Validada, bateu: Conflito): Conflito {
  const ficha = fichaDe(estado, validada.op.fichaId)
  const conflito: Conflito = { opId: validada.op.opId, quem: bateu.quem, quando: bateu.quando, revAtual: bateu.revAtual, porCausaDe: bateu.opId }
  const valorAtual = valorNoCaminho(docDe(ficha), validada.op.caminho)
  if (valorAtual !== undefined) conflito.valorAtual = valorAtual
  if (ficha !== undefined && ficha.apagada) conflito.fichaApagada = true
  return conflito
}

/** O conflito fica em `recusadas` até alguém decidir; o reenvio com o mesmo `opId` recebe a mesma resposta. Gasta cota: grava linha. */
function guardarRecusada(processo: Processo, validada: Validada, conflito: Conflito): void {
  const { estado, agora } = processo
  estado.recusadas.set(validada.op.opId, { opId: validada.op.opId, op: validada.op, autorContaId: validada.autor.membro.contaId, resposta: conflito, quando: agora })
  contarOp(estado, validada, agora)
}

function contarOp(estado: Estado, validada: Validada, agora: number): void {
  const daConta = chaveDaCotaDaConta(validada.remetente.contaId, agora)
  const daCampanha = chaveDaCotaDaCampanha(agora)
  estado.cotas.set(daConta, comOpContada(cotaDe(estado, daConta), validada.bytes))
  estado.cotas.set(daCampanha, comOpContada(cotaDe(estado, daCampanha), validada.bytes))
}

function executar(estado: Estado, processo: Processo, validada: Validada): Desfecho {
  const { op, remetente, bytes } = validada
  const { agora } = processo
  const cota = cabeNaCota(cotaDe(estado, chaveDaCotaDaConta(remetente.contaId, agora)), cotaDe(estado, chaveDaCotaDaCampanha(agora)), remetente.contaId, bytes, agora)
  if (!cota.ok) return { t: 'adiado', motivo: cota.motivo, tentarDepoisDe: cota.tentarDepoisDe }
  // O conflito é com quem mexeu ANTES do grupo (`processo.estado`), nunca com o ensaio: as irmãs do
  // tudo-ou-nada são a mesma intenção, e a rev e o valor que o autor recebe têm de existir depois que o
  // ensaio é descartado (senão o "Usar a minha" com `baseRev = revAtual` cai em base inválida).
  const conflito = acharConflito(processo.estado, validada)
  if (conflito !== null) return { t: 'conflito', conflito }
  const ficha = fichaDe(estado, op.fichaId)
  const aplicada = aplicarOp(docDe(ficha), op)
  if (!aplicada.ok) return { t: 'negado', motivo: aplicada.motivo, detalhe: aplicada.detalhe }
  estado.rev += 1
  // Item empilhável que somou na vaga que já existia: é a soma que entra no log e no desfazer.
  const feita = aplicada.efetiva === undefined ? op : aplicada.efetiva
  estado.ops.push(gravadaDe(op, feita, aplicada.antes, validada.autor, processo.quem, estado.rev, agora))
  const depois = fichaDepois(ficha, aplicada.doc, estado.rev)
  if (depois !== undefined) estado.fichas.set(op.fichaId, depois)
  contarOp(estado, validada, agora)
  return { t: 'ack', resposta: { t: 'ack', opId: op.opId, rev: estado.rev } }
}

function acharConflito(estado: Estado, validada: Validada): Conflito | null {
  const { op } = validada
  const ficha = fichaDe(estado, op.fichaId)
  const recriando = validada.regra === 'ficha' && op.acao === 'criar'
  if (ficha !== undefined && ficha.apagada && !recriando) {
    // A rev da ficha apagada é a da op que a apagou.
    const apagou = opsDaFichaDe(estado, op.fichaId, ficha.rev - 1).find((gravada) => gravada.rev === ficha.rev)
    return conflitoDeFichaApagada(op.opId, apagou, estado.rev)
  }
  const autoria = { clienteId: op.clienteId, autorContaId: validada.autor.membro.contaId }
  const concorrente = opConcorrente(op, autoria, opsDaFichaDe(estado, op.fichaId, op.baseRev))
  if (concorrente === null) return null
  return montarConflito(op.opId, concorrente, valorNoCaminho(docDe(ficha), op.caminho), estado.rev)
}

/** A ficha depois da op. Apagar guarda o último doc com a marca (o dono continua conhecido); apagar o que nunca existiu não guarda nada. */
function fichaDepois(antes: FichaGuardada | undefined, doc: Personagem | null, rev: number): FichaGuardada | undefined {
  if (doc !== null) return { doc, apagada: false, visivel: antes === undefined ? VISIBILIDADE_DE_FICHA_NOVA : antes.visivel, rev }
  return antes === undefined ? undefined : { ...antes, apagada: true, rev }
}

function gravadaDe(op: Op, feita: Mudanca, antes: Json | undefined, autor: AutorEfetivo, quem: Identidade, rev: number, agora: number): OpGravada {
  const gravada: OpGravada = {
    opId: op.opId,
    loteId: op.loteId,
    fichaId: feita.fichaId,
    caminho: feita.caminho,
    acao: feita.acao,
    baseRev: op.baseRev,
    clienteId: op.clienteId,
    quandoCliente: op.quandoCliente,
    rev,
    autorContaId: autor.membro.contaId,
    autorNome: autor.membro.nome,
    origem: autor.atestadoPeloApp ? 'mesa' : quem.origem,
    atestadoPeloApp: autor.atestadoPeloApp,
    quando: agora,
  }
  if (feita.valor !== undefined) gravada.valor = feita.valor
  if (feita.delta !== undefined) gravada.delta = feita.delta
  if (op.atomico === true) gravada.atomico = true
  if (op.desfaz !== undefined) gravada.desfaz = op.desfaz
  if (op.resolve !== undefined) gravada.resolve = op.resolve
  if (op.autorDeclarado !== undefined) gravada.autorDeclarado = op.autorDeclarado
  if (antes !== undefined) gravada.antes = antes
  return gravada
}
