import type { Era, Evento, Quando, Tempo, Verbete } from './tipos'

/**
 * A LINHA DO TEMPO SEM TELA (E3c, protótipo aprovado em 16/11, tela 5): uma
 * linha por campanha, eventos por era e ano, e o que chegou das sessões sem
 * data esperando na bandeja.
 *
 * - A era guarda a campanha (`Era.campanhaId`); a ordem das eras é a da lista.
 * - A campanha do evento é a dele (`Evento.campanhaId`); no evento de antes,
 *   sem ela, vale a da era, depois a da sessão de onde veio; sem nenhuma, a
 *   linha "Sem campanha". Nenhum evento some: o que não tem era desta linha
 *   (sem data, era apagada) fica na bandeja.
 * - Dentro de um ano, a ordem é a da lista de eventos: mover é tirar e pôr de
 *   novo na lista, sem campo de ordem.
 */

/** A linha "Sem campanha": eras e eventos de antes do E3c, sem campanha nenhuma. */
export const SEM_CAMPANHA = ''

/** A campanha de uma sessão pelo id; `undefined` = não há essa sessão, ou ela não tem campanha. */
export type CampanhaDaSessao = (sessaoId: string) => string | undefined

/** A campanha de cada sessão: a primeira das etiquetas dela (a que o "Para a linha do tempo" grava). */
export function campanhaDaSessaoEm(verbetes: ReadonlyMap<string, Verbete>): CampanhaDaSessao {
  return (sessaoId) => {
    const sessao = verbetes.get(sessaoId)
    return sessao === undefined || sessao.tipo !== 'sessao' ? undefined : sessao.campanhas[0]
  }
}

export function campanhaDaEra(era: Era): string {
  return era.campanhaId ?? SEM_CAMPANHA
}

export function campanhaDoEvento(evento: Evento, eras: readonly Era[], campanhaDaSessao: CampanhaDaSessao): string {
  if (evento.campanhaId !== undefined) return evento.campanhaId
  const era = eras.find((uma) => uma.id === evento.quando.era)
  if (era?.campanhaId !== undefined) return era.campanhaId
  const daSessao = evento.sessaoId === undefined ? undefined : campanhaDaSessao(evento.sessaoId)
  return daSessao ?? SEM_CAMPANHA
}

export function erasDaCampanha(tempo: Tempo, campanha: string): Era[] {
  return tempo.eras.filter((era) => campanhaDaEra(era) === campanha)
}

/** As campanhas que têm alguma era ou evento (para a linha "Sem campanha" só aparecer quando houver o que mostrar). */
export function campanhasComDados(tempo: Tempo, campanhaDaSessao: CampanhaDaSessao): Set<string> {
  const campanhas = new Set(tempo.eras.map(campanhaDaEra))
  for (const evento of tempo.eventos) campanhas.add(campanhaDoEvento(evento, tempo.eras, campanhaDaSessao))
  return campanhas
}

/** Quantos eventos a linha da campanha tem; `null` = todas as campanhas. */
export function contarEventos(tempo: Tempo, campanha: string | null, campanhaDaSessao: CampanhaDaSessao): number {
  if (campanha === null) return tempo.eventos.length
  return tempo.eventos.filter((evento) => campanhaDoEvento(evento, tempo.eras, campanhaDaSessao) === campanha).length
}

// ─── A linha de uma campanha ─────────────────────────────────────────────────

export interface AnoDaLinha {
  readonly ano: number
  readonly eventos: readonly Evento[]
}

export interface EraDaLinha {
  readonly era: Era
  /** Do ano mais antigo ao mais novo. */
  readonly anos: readonly AnoDaLinha[]
}

export interface LinhaDaCampanha {
  readonly eras: readonly EraDaLinha[]
  /** Sem data desta linha (vindos das sessões, ou de era apagada), na ordem da lista. */
  readonly bandeja: readonly Evento[]
  /** Os eventos com data, na ordem da tela: era, ano e lista. */
  readonly emOrdem: readonly Evento[]
  /** Segredos que a tela não está mostrando. */
  readonly escondidos: number
}

export function linhaDaCampanha(tempo: Tempo, campanha: string, campanhaDaSessao: CampanhaDaSessao, comSegredos: boolean): LinhaDaCampanha {
  const eras = erasDaCampanha(tempo, campanha)
  const daLinha = tempo.eventos.filter((evento) => campanhaDoEvento(evento, tempo.eras, campanhaDaSessao) === campanha)
  const visiveis = comSegredos ? daLinha : daLinha.filter((evento) => !evento.segredo)
  const idsDasEras = new Set(eras.map((era) => era.id))
  const porEra = eras.map((era): EraDaLinha => {
    const daEra = visiveis.filter((evento) => evento.quando.era === era.id)
    const anos = [...new Set(daEra.map((evento) => evento.quando.ano))].sort((a, b) => a - b)
    return { era, anos: anos.map((ano) => ({ ano, eventos: daEra.filter((evento) => evento.quando.ano === ano) })) }
  })
  return {
    eras: porEra,
    bandeja: visiveis.filter((evento) => !idsDasEras.has(evento.quando.era)),
    emOrdem: porEra.flatMap((era) => era.anos.flatMap((ano) => ano.eventos)),
    escondidos: daLinha.length - visiveis.length,
  }
}

// ─── Mover ───────────────────────────────────────────────────────────────────

/** Para onde vai um evento: a bandeja (sem data) ou um ano de uma era, antes de um evento (`null` = no fim do ano). */
export type DestinoDoEvento = { readonly t: 'bandeja' } | { readonly t: 'ano'; readonly era: string; readonly ano: number; readonly antesDe: string | null }

/** O quando numa data nova: mês, dia e rótulo eram do ano de antes (o rótulo do evento que veio da sessão era o nome dela, que agora vem no chip). */
function quandoEm(quando: Quando, era: string, ano: number): Quando {
  const { mes: _mes, dia: _dia, rotulo: _rotulo, ...resto } = quando
  return { ...resto, era, ano }
}

/** O evento passa a dizer a campanha da linha onde foi posto (a de "Sem campanha" não se escreve). */
function naCampanha(evento: Evento, campanha: string): Evento {
  return campanha === SEM_CAMPANHA || evento.campanhaId === campanha ? evento : { ...evento, campanhaId: campanha }
}

/** Põe o evento antes de `antesDe` (se for do mesmo ano) ou logo depois do último do ano; sem nenhum, no fim. */
function inserirNoAno(eventos: readonly Evento[], evento: Evento, antesDe: string | null, doAno: (outro: Evento) => boolean): Evento[] {
  const lista = [...eventos]
  const alvo = antesDe === null ? -1 : lista.findIndex((outro) => outro.id === antesDe && doAno(outro))
  if (alvo !== -1) {
    lista.splice(alvo, 0, evento)
    return lista
  }
  const ultimo = lista.reduce((achado, outro, indice) => (doAno(outro) ? indice : achado), -1)
  if (ultimo === -1) lista.push(evento)
  else lista.splice(ultimo + 1, 0, evento)
  return lista
}

function mesmaLista(a: readonly Evento[], b: readonly Evento[]): boolean {
  return a.length === b.length && a.every((evento, indice) => evento === b[indice])
}

/**
 * Leva o evento ao destino, na linha da `campanha`. Mudar de ano tira o mês e
 * o dia; voltar à bandeja tira a data. Nada muda = o mesmo `tempo` (a loja não grava).
 */
export function comEventoMovido(tempo: Tempo, eventoId: string, destino: DestinoDoEvento, campanha: string, campanhaDaSessao: CampanhaDaSessao): Tempo {
  const atual = tempo.eventos.find((evento) => evento.id === eventoId)
  if (atual === undefined) return tempo
  const resto = tempo.eventos.filter((evento) => evento.id !== eventoId)
  if (destino.t === 'bandeja') {
    if (!erasDaCampanha(tempo, campanha).some((era) => era.id === atual.quando.era)) return tempo
    return { ...tempo, eventos: [...resto, naCampanha({ ...atual, quando: quandoEm(atual.quando, '', 0) }, campanha)] }
  }
  const mudouDeAno = atual.quando.era !== destino.era || atual.quando.ano !== destino.ano
  const movido = naCampanha(mudouDeAno ? { ...atual, quando: quandoEm(atual.quando, destino.era, destino.ano) } : atual, campanha)
  const doAno = (outro: Evento) => outro.quando.era === destino.era && outro.quando.ano === destino.ano && campanhaDoEvento(outro, tempo.eras, campanhaDaSessao) === campanha
  const eventos = inserirNoAno(resto, movido, destino.antesDe, doAno)
  return movido === atual && mesmaLista(eventos, tempo.eventos) ? tempo : { ...tempo, eventos }
}

/**
 * Alt+↑/↓ na alça: troca de lugar com o vizinho do mesmo ano, ou passa para o
 * ano do lado (no fim dele subindo, no começo descendo). `null` = já é o
 * primeiro (ou o último), ou o evento não tem data nesta linha.
 */
export function comEventoNaTecla(tempo: Tempo, eventoId: string, direcao: -1 | 1, linha: LinhaDaCampanha, campanha: string, campanhaDaSessao: CampanhaDaSessao): Tempo | null {
  const indice = linha.emOrdem.findIndex((evento) => evento.id === eventoId)
  const evento = linha.emOrdem[indice]
  const vizinho = linha.emOrdem[indice + direcao]
  if (indice === -1 || evento === undefined || vizinho === undefined) return null
  if (vizinho.quando.era !== evento.quando.era || vizinho.quando.ano !== evento.quando.ano) {
    return comEventoMovido(tempo, eventoId, { t: 'ano', era: vizinho.quando.era, ano: vizinho.quando.ano, antesDe: direcao > 0 ? vizinho.id : null }, campanha, campanhaDaSessao)
  }
  const eventos = [...tempo.eventos]
  const daqui = eventos.findIndex((um) => um.id === evento.id)
  const dali = eventos.findIndex((um) => um.id === vizinho.id)
  if (daqui === -1 || dali === -1) return null
  eventos[daqui] = vizinho
  eventos[dali] = evento
  return { ...tempo, eventos }
}

// ─── Criar, editar, apagar ───────────────────────────────────────────────────

/** O que o formulário do evento manda. `era` vazia = sem data (a bandeja). */
export interface DadosDoEvento {
  readonly titulo: string
  readonly era: string
  readonly ano: number
  readonly mes?: number
  readonly dia?: number
  readonly resumo: string
  readonly sessaoId?: string
  readonly segredo: boolean
}

function quandoDosDados(antes: Quando | undefined, dados: DadosDoEvento): Quando {
  const semData = dados.era === ''
  const mesmoAno = antes !== undefined && antes.era === dados.era && (semData || antes.ano === dados.ano)
  const base = mesmoAno ? antes : quandoEm(antes ?? { era: '', ano: 0 }, dados.era, semData ? 0 : dados.ano)
  const { mes: _mes, dia: _dia, ...semDia } = base
  if (semData) return semDia
  return { ...semDia, ...(dados.mes === undefined ? {} : { mes: dados.mes }), ...(dados.dia === undefined ? {} : { dia: dados.dia }) }
}

/**
 * Cria (id novo) ou troca o evento. Data nova: o evento vai para o ano, antes
 * do primeiro de mês maior (sem mês, no fim do ano); sem data, para o fim da
 * bandeja. Sem mudar a data, ele fica onde estava.
 */
export function comEventoSalvo(tempo: Tempo, id: string, dados: DadosDoEvento, campanha: string, campanhaDaSessao: CampanhaDaSessao): Tempo {
  const antes = tempo.eventos.find((evento) => evento.id === id)
  const quando = quandoDosDados(antes?.quando, dados)
  const base: Evento = antes ?? { id, titulo: '', quando, verbetes: [], resumo: '', segredo: false }
  const { sessaoId: _sessaoId, ...semSessao } = base
  const evento = naCampanha({ ...semSessao, id, titulo: dados.titulo, quando, resumo: dados.resumo, segredo: dados.segredo, ...(dados.sessaoId === undefined ? {} : { sessaoId: dados.sessaoId }) }, campanha)
  const mudouAData = antes === undefined || antes.quando.era !== quando.era || antes.quando.ano !== quando.ano || antes.quando.mes !== quando.mes
  if (antes !== undefined && !mudouAData) return { ...tempo, eventos: tempo.eventos.map((outro) => (outro.id === id ? evento : outro)) }
  const resto = tempo.eventos.filter((outro) => outro.id !== id)
  if (quando.era === '') return { ...tempo, eventos: [...resto, evento] }
  const doAno = (outro: Evento) => outro.quando.era === quando.era && outro.quando.ano === quando.ano && campanhaDoEvento(outro, tempo.eras, campanhaDaSessao) === campanha
  const mes = quando.mes
  const depois = mes === undefined ? undefined : resto.find((outro) => doAno(outro) && (outro.quando.mes ?? 0) > mes)
  return { ...tempo, eventos: inserirNoAno(resto, evento, depois?.id ?? null, doAno) }
}

export function comEraNova(tempo: Tempo, id: string, nome: string, campanha: string): Tempo {
  const era: Era = campanha === SEM_CAMPANHA ? { id, nome } : { id, nome, campanhaId: campanha }
  return { ...tempo, eras: [...tempo.eras, era] }
}

export function comEraRenomeada(tempo: Tempo, eraId: string, nome: string): Tempo {
  const atual = tempo.eras.find((era) => era.id === eraId)
  if (atual === undefined || atual.nome === nome) return tempo
  return { ...tempo, eras: tempo.eras.map((era) => (era.id === eraId ? { ...era, nome } : era)) }
}

/** Devolve o evento ao lugar de antes (o Desfazer do "apagado"). */
export function comEventoDeVolta(tempo: Tempo, evento: Evento, indice: number): Tempo {
  if (tempo.eventos.some((outro) => outro.id === evento.id)) return tempo
  const eventos = [...tempo.eventos]
  eventos.splice(Math.min(Math.max(indice, 0), eventos.length), 0, evento)
  return { ...tempo, eventos }
}

// ─── Ano, mês e dia digitados ────────────────────────────────────────────────

export type LeituraDaData = { readonly ok: true; readonly valor: number | undefined } | { readonly ok: false; readonly motivo: string }

/** Ano de calendário inventado: de -999 999 a 999 999 (negativo = antes do marco da era). */
export const ANO_EXTREMO = 999_999
const SO_DIGITOS = /^-?[0-9]+$/

function lerInteiro(digitado: string, minimo: number, maximo: number, obrigatorio: string | null, fora: string): LeituraDaData {
  const texto = digitado.trim()
  if (texto === '') return obrigatorio === null ? { ok: true, valor: undefined } : { ok: false, motivo: obrigatorio }
  if (!SO_DIGITOS.test(texto)) return { ok: false, motivo: fora }
  const valor = Number(texto)
  return Number.isSafeInteger(valor) && valor >= minimo && valor <= maximo ? { ok: true, valor } : { ok: false, motivo: fora }
}

export function lerAno(digitado: string): LeituraDaData {
  return lerInteiro(digitado, -ANO_EXTREMO, ANO_EXTREMO, 'Dê o ano do evento, ou escolha "Sem data".', 'O ano é um número inteiro, como 1520 (ou -300, antes do marco da era).')
}

export function lerMes(digitado: string): LeituraDaData {
  return lerInteiro(digitado, 1, 12, null, 'O mês vai de 1 a 12, ou fica vazio.')
}

export function lerDia(digitado: string): LeituraDaData {
  return lerInteiro(digitado, 1, 31, null, 'O dia vai de 1 a 31, ou fica vazio.')
}

/** O que aparece ao lado do título: "sem data" na bandeja, "mês 3, dia 9" com mês. */
export function rotuloDoQuando(quando: Quando, comData: boolean): string {
  if (!comData) return 'sem data'
  if (quando.mes === undefined) return ''
  return quando.dia === undefined ? `mês ${quando.mes}` : `mês ${quando.mes}, dia ${quando.dia}`
}
