import type { Pin, PinColecao } from '../types/map'
import { clampClueText } from './clues'

/**
 * COLEÇÃO DE PISTAS — peças espalhadas ("Letreiro", peça 5 de 12) que o
 * jogador junta lendo os cartões. Aqui mora a parte pura: ler a peça do disco,
 * conferir se o pino é uma peça que conta e montar o progresso que o host
 * manda ao jogador. O host guarda as peças por jogador (`net/hostSession.ts`).
 */

/** Teto do nome da coleção, em unidades UTF-16: cabe numa linha do Caderno do celular. */
export const COLECAO_NOME_MAX_LENGTH = 40
/** Teto de peças de uma coleção: acima de uma fileira que o Caderno desenha legível. */
export const COLECAO_MAX_PARTES = 60
/** Quantas coleções o jogador guarda. Passou, a mais antiga sai (e a mensagem do host fica num teto conhecido). */
export const COLECOES_MAX = 30

/** Uma peça que conta: nome aparado e não vazio, número inteiro de 1 a `total`, frase já no teto (vazia = sem frase). */
export interface PecaDeColecao {
  nome: string
  parte: number
  total: number
  inteira: string
}

/** Uma peça que o jogador tem, como vai para a rede: o número e a pista do caderno que a traz. */
export interface ColecaoPeca {
  parte: number
  clueId: string
}

/**
 * O que o jogador sabe de uma coleção: o nome, o total e as peças DELE. Nada
 * de onde estão as que faltam. `inteira` só existe com `completa` (e só se o
 * mestre escreveu a frase).
 */
export interface ColecaoProgresso {
  nome: string
  total: number
  partes: ColecaoPeca[]
  completa: boolean
  inteira?: string
}

/** As coleções de UM jogador no host, pelo nome. Cada peça lembra a pista e a frase que o pino tinha quando foi lido. */
export type ColecoesDoJogador = Map<string, { total: number; partes: Map<number, { clueId: string; inteira: string }> }>

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

/**
 * A peça como veio do disco. Campo NOVO e OPCIONAL: ausente continua ausente.
 * Sem `nome` em texto ou com número que não é inteiro, volta ausente (o pino
 * vira avulso) em vez de derrubar o mapa; `inteira` que não é texto cai sozinha.
 */
export function readPinColecao(value: unknown): PinColecao | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const nome: unknown = Reflect.get(value, 'nome')
  const parte: unknown = Reflect.get(value, 'parte')
  const total: unknown = Reflect.get(value, 'total')
  const inteira: unknown = Reflect.get(value, 'inteira')
  if (typeof nome !== 'string' || !isWholeNumber(parte) || !isWholeNumber(total)) return undefined
  const colecao: PinColecao = { nome, parte, total }
  if (typeof inteira === 'string') colecao.inteira = inteira
  return colecao
}

/** Os nomes de coleção que os pinos desta cena usam, sem repetir, em ordem alfabética: sugestões do painel do mestre. */
export function colecaoNomesDaCena(pins: readonly Pin[]): string[] {
  const nomes = new Set(pins.flatMap((pin) => (pin.colecao === undefined ? [] : [cleanColecaoNome(pin.colecao.nome)])).filter((nome) => nome !== ''))
  return [...nomes].sort((a, b) => a.localeCompare(b))
}

/** As duas peças são a mesma? `undefined` só é igual a `undefined` (gravar a mesma peça de novo não é mudança). */
export function sameColecao(a: PinColecao | undefined, b: PinColecao | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.nome === b.nome && a.parte === b.parte && a.total === b.total && a.inteira === b.inteira
}

/** Nome da coleção aparado e dentro do teto, sem deixar meia letra no fim. */
function cleanColecaoNome(nome: string): string {
  const trimmed = nome.trim()
  if (trimmed.length <= COLECAO_NOME_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, COLECAO_NOME_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/**
 * O pino é uma peça que conta? `null` para pino avulso, sem nome, ou com
 * número fora de 1..total (total acima de `COLECAO_MAX_PARTES` também não).
 * Lê do pino do MESTRE: é quem chama que responde por o jogador poder vê-lo.
 */
export function pecaDoPino(pin: Pin): PecaDeColecao | null {
  const colecao = pin.colecao
  if (colecao === undefined) return null
  const nome = cleanColecaoNome(colecao.nome)
  const { parte, total } = colecao
  if (nome === '' || !isWholeNumber(parte) || !isWholeNumber(total)) return null
  if (total < 1 || total > COLECAO_MAX_PARTES || parte < 1 || parte > total) return null
  return { nome, parte, total, inteira: clampClueText((colecao.inteira ?? '').trim()) }
}

/**
 * Guarda a peça nas coleções do jogador. O total é o da peça mais recente (o
 * mestre pode ter mudado). `true` quando algo mudou — é quando o host manda a
 * lista de novo. Passou de `COLECOES_MAX` coleções, a mais antiga sai.
 */
export function guardarPeca(colecoes: ColecoesDoJogador, peca: PecaDeColecao, clueId: string): boolean {
  const guardada = colecoes.get(peca.nome)
  if (guardada === undefined) {
    colecoes.set(peca.nome, { total: peca.total, partes: new Map([[peca.parte, { clueId, inteira: peca.inteira }]]) })
    for (const antiga of colecoes.keys()) {
      if (colecoes.size <= COLECOES_MAX) break
      colecoes.delete(antiga)
    }
    return true
  }
  const anterior = guardada.partes.get(peca.parte)
  const igual = guardada.total === peca.total && anterior !== undefined && anterior.clueId === clueId && anterior.inteira === peca.inteira
  if (igual) return false
  guardada.total = peca.total
  guardada.partes.set(peca.parte, { clueId, inteira: peca.inteira })
  return true
}

/**
 * O progresso de cada coleção, como vai ao jogador. Só as peças dentro do
 * total atual, em ordem. Com todas: `completa`, e a frase da MENOR peça que a
 * tem — o mestre pode escrevê-la numa peça só. Incompleta, a frase não sai.
 */
export function progressoDasColecoes(colecoes: ColecoesDoJogador): ColecaoProgresso[] {
  return [...colecoes].map(([nome, { total, partes }]) => {
    const tem = [...partes].filter(([parte]) => parte <= total).sort(([a], [b]) => a - b)
    const progresso: ColecaoProgresso = { nome, total, partes: tem.map(([parte, { clueId }]) => ({ parte, clueId })), completa: tem.length === total }
    if (!progresso.completa) return progresso
    const frase = tem.find(([, peca]) => peca.inteira !== '')?.[1].inteira
    return frase === undefined ? progresso : { ...progresso, inteira: frase }
  })
}
