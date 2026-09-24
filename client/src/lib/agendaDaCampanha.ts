/**
 * AGENDA DA CAMPANHA — eventos datados por dia e apito ("Disparo dos Gêmeos,
 * dia 7, Meio") que disparam quando a hora da mesa chega. Plano:
 * `docs/planos/feat-agenda-da-campanha.md`.
 *
 * Mora na aventura (`Adventure.agenda`), nunca no `MapData`: o host só serve
 * mapas de cena ao jogador, então nem o título, nem o momento marcado, nem a
 * hora da mesa chegam a ele. Quem dispara é o mestre, avançando a hora; o
 * disparo vira aviso na Caixa dele (`components/AgendaSection.tsx`).
 */

/** Os quatro apitos do dia, na ordem em que soam. */
export type Apito = 'aurora' | 'meio' | 'brasa' | 'sombra'

export const APITOS: readonly Apito[] = ['aurora', 'meio', 'brasa', 'sombra']

export const NOME_DO_APITO: Readonly<Record<Apito, string>> = { aurora: 'Aurora', meio: 'Meio', brasa: 'Brasa', sombra: 'Sombra' }

/** Um momento da campanha: o dia (inteiro, a partir de 1) e o apito dele. */
export interface MomentoDaMesa {
  dia: number
  apito: Apito
}

export interface EventoDaAgenda {
  /** Estável: é o que remover cita. */
  id: string
  /** "Disparo dos Gêmeos" — só do mestre; nunca vai ao jogador. */
  titulo: string
  quando: MomentoDaMesa
  /** Já disparou: não dispara de novo. Ausente = ainda por vir. */
  disparado?: true
}

export interface AgendaDaCampanha {
  /** A hora da mesa agora. */
  agora: MomentoDaMesa
  /** Na ordem em que o mestre marcou. */
  eventos: EventoDaAgenda[]
}

/** Campanha nova começa no primeiro apito do primeiro dia. */
export const PRIMEIRO_MOMENTO: MomentoDaMesa = { dia: 1, apito: 'aurora' }

/** Teto do dia que o formulário aceita: campanha longa cabe, número absurdo não. */
export const DIA_MAXIMO = 9999

/** Título do evento no painel: uma linha curta. */
export const TITULO_MAX = 80

export function novaAgenda(): AgendaDaCampanha {
  return { agora: { ...PRIMEIRO_MOMENTO }, eventos: [] }
}

export function isApito(value: unknown): value is Apito {
  return APITOS.some((apito) => apito === value)
}

export function isDiaValido(dia: number): boolean {
  return Number.isInteger(dia) && dia >= 1 && dia <= DIA_MAXIMO
}

/** O momento como número que cresce com o tempo: quatro apitos por dia. */
function posicao(momento: MomentoDaMesa): number {
  return (momento.dia - 1) * APITOS.length + APITOS.indexOf(momento.apito)
}

/** Negativo quando `a` vem antes de `b`, zero no mesmo momento, positivo depois. */
export function compararMomentos(a: MomentoDaMesa, b: MomentoDaMesa): number {
  return posicao(a) - posicao(b)
}

/** `quando` já chegou (é o agora ou veio antes dele)? */
export function jaPassou(agora: MomentoDaMesa, quando: MomentoDaMesa): boolean {
  return compararMomentos(quando, agora) <= 0
}

/** O apito seguinte; depois da Sombra, a Aurora do dia seguinte. */
export function proximoApito(momento: MomentoDaMesa): MomentoDaMesa {
  const indice = APITOS.indexOf(momento.apito)
  const seguinte = APITOS[indice + 1]
  return seguinte === undefined ? { dia: momento.dia + 1, apito: APITOS[0] } : { dia: momento.dia, apito: seguinte }
}

/** A Aurora do dia seguinte. */
export function proximoDia(momento: MomentoDaMesa): MomentoDaMesa {
  return { dia: momento.dia + 1, apito: APITOS[0] }
}

/** Como o mestre lê: "dia 7, Meio". */
export function formatarMomento(momento: MomentoDaMesa): string {
  return `dia ${momento.dia}, ${NOME_DO_APITO[momento.apito]}`
}

/** O texto do aviso na Caixa: "Disparo dos Gêmeos — dia 7, Meio". */
export function avisoDoEvento(evento: EventoDaAgenda): string {
  return `${evento.titulo} — ${formatarMomento(evento.quando)}`
}

/**
 * A agenda com um evento novo no fim. `null` quando não dá: título vazio, dia
 * fora de 1..DIA_MAXIMO, ou momento que já passou (ele nunca dispararia na
 * hora — só no próximo avanço, fora de hora).
 */
export function adicionarEvento(agenda: AgendaDaCampanha, titulo: string, quando: MomentoDaMesa): AgendaDaCampanha | null {
  const limpo = titulo.trim().slice(0, TITULO_MAX)
  if (limpo.length === 0 || !isDiaValido(quando.dia) || jaPassou(agenda.agora, quando)) return null
  const evento: EventoDaAgenda = { id: `ev_${crypto.randomUUID()}`, titulo: limpo, quando: { dia: quando.dia, apito: quando.apito } }
  return { ...agenda, eventos: [...agenda.eventos, evento] }
}

/** A agenda sem o evento `id`, ou a MESMA agenda quando ele não está lá. */
export function removerEvento(agenda: AgendaDaCampanha, id: string): AgendaDaCampanha {
  if (!agenda.eventos.some((evento) => evento.id === id)) return agenda
  return { ...agenda, eventos: agenda.eventos.filter((evento) => evento.id !== id) }
}

export interface AvancoDaAgenda {
  agenda: AgendaDaCampanha
  /** O que disparou agora, na ordem da hora (empate: a ordem da lista). */
  disparados: EventoDaAgenda[]
}

/**
 * Leva a hora da mesa a `agora` e dispara todo evento ainda não disparado cujo
 * momento chegou — pular vários apitos dispara os do meio. O disparado fica
 * marcado e não volta a disparar.
 */
export function levarAgendaA(agenda: AgendaDaCampanha, agora: MomentoDaMesa): AvancoDaAgenda {
  const vencem = new Set(agenda.eventos.filter((evento) => evento.disparado !== true && jaPassou(agora, evento.quando)).map((evento) => evento.id))
  const eventos = agenda.eventos.map((evento): EventoDaAgenda => (vencem.has(evento.id) ? { ...evento, disparado: true } : evento))
  // `sort` é estável: no mesmo momento, fica a ordem em que o mestre marcou.
  const disparados = eventos.filter((evento) => vencem.has(evento.id)).sort((a, b) => compararMomentos(a.quando, b.quando))
  return { agenda: { agora: { dia: agora.dia, apito: agora.apito }, eventos }, disparados }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function momentoOuNull(raw: unknown): MomentoDaMesa | null {
  if (!isRecord(raw)) return null
  const { dia, apito } = raw
  if (typeof dia !== 'number' || !isDiaValido(dia) || !isApito(apito)) return null
  return { dia, apito }
}

function eventoOuNull(raw: unknown): EventoDaAgenda | null {
  if (!isRecord(raw)) return null
  const { id, titulo, quando, disparado } = raw
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof titulo !== 'string' || titulo.trim().length === 0) return null
  const momento = momentoOuNull(quando)
  if (momento === null) return null
  const evento: EventoDaAgenda = { id, titulo: titulo.trim().slice(0, TITULO_MAX), quando: momento }
  return disparado === true ? { ...evento, disparado: true } : evento
}

/**
 * `adventure.agenda` como veio do disco (pode ter sido editado à mão). Sem
 * hora válida a agenda inteira é descartada (`undefined`, igual a aventura
 * antiga); evento malformado ou de id repetido sai da lista sozinho.
 */
export function lerAgenda(raw: unknown): AgendaDaCampanha | undefined {
  if (!isRecord(raw)) return undefined
  const agora = momentoOuNull(raw.agora)
  if (agora === null) return undefined
  const vistos = new Set<string>()
  const eventos: EventoDaAgenda[] = []
  for (const bruto of Array.isArray(raw.eventos) ? raw.eventos : []) {
    const evento = eventoOuNull(bruto)
    if (evento === null || vistos.has(evento.id)) continue
    vistos.add(evento.id)
    eventos.push(evento)
  }
  return { agora, eventos }
}
