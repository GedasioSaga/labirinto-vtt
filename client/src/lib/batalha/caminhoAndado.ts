import { blocosEntre, type Casa } from './blocos'

/**
 * CAMINHO ANDADO EM BATALHA (fatia B6 de docs/planos/modo-batalha-2026-10-24.md):
 * as casas que cada ficha de jogador andou desde que a batalha ligou (ou
 * desde o último "Zerar caminhos", que só o mestre usa: decisão 3 de 28/10).
 *
 * O mestre guarda a trilha inteira (`stores/batalhaStore.ts`); cada jogador
 * recebe no snapshot só o que pode ver (decisão 4: ele vê o dos colegas):
 * - a trilha das fichas DELE inteira, com a conta ("Você andou N blocos");
 * - a dos colegas só nas casas que ele vê agora, e só de ficha que o recorte
 *   dele já leva. Nada do caminho do colega passa por dentro da névoa dele.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** Teto de casas guardadas por ficha: a batalha longa não engorda o snapshot. A conta (`blocos`) continua exata. */
export const CASAS_POR_TRILHA = 240
/** Teto de fichas com caminho num snapshot (lido do fio). */
export const FICHAS_COM_CAMINHO_MAX = 64
/** Maior coluna ou linha aceita do fio: mapa nenhum da mesa chega perto. */
const CASA_MAX = 10_000
const ID_MAX = 200

/** O caminho de uma ficha como vai ao jogador. `blocos` só na ficha dele. */
export interface CaminhoAndado {
  readonly tokenId: string
  readonly casas: readonly Casa[]
  readonly blocos?: number
}

/** O campo `caminhos` do snapshot: os caminhos e quantas vezes o mestre zerou nesta batalha. */
export interface CaminhosDaBatalha {
  readonly zerados: number
  readonly fichas: readonly CaminhoAndado[]
}

/** O que o mestre guarda por cena em batalha (o pedaço de `BatalhaDaCena` que o recorte lê). */
export interface CaminhosNoMestre {
  readonly caminhos: Readonly<Record<string, number>>
  readonly trilhas: Readonly<Record<string, readonly Casa[]>>
  readonly zerados: number
}

/** O que o recorte do jogador decide. */
export interface VistaDoCaminho {
  /** As fichas dele: vão inteiras e com a conta. */
  readonly minhas: ReadonlySet<string>
  /** As fichas que o recorte dele leva: caminho de ficha que ele não vê nem sai. */
  readonly visiveis: ReadonlySet<string>
  /** A casa está à vista dele agora? Só vale para o caminho de colega. */
  readonly aVista: (casa: Casa) => boolean
}

function mesmaCasa(a: Casa, b: Casa): boolean {
  return a.col === b.col && a.row === b.row
}

/**
 * Soma as casas de um movimento aceito à trilha. O movimento começa onde a
 * ficha estava: se é onde a trilha parou, a casa não se repete. Passou do
 * teto, saem as mais antigas.
 */
export function somarNaTrilha(trilha: readonly Casa[], casas: readonly Casa[], teto: number = CASAS_POR_TRILHA): readonly Casa[] {
  if (casas.length < 2) return trilha
  const ultima = trilha[trilha.length - 1]
  const primeira = casas[0]
  const continua = ultima !== undefined && primeira !== undefined && mesmaCasa(ultima, primeira)
  const nova = [...trilha, ...(continua ? casas.slice(1) : casas)]
  return nova.length > teto ? nova.slice(nova.length - teto) : nova
}

/** Os caminhos que o jogador recebe (ver o topo do arquivo). */
export function caminhosParaJogador(noMestre: CaminhosNoMestre, vista: VistaDoCaminho): CaminhosDaBatalha {
  const fichas: CaminhoAndado[] = []
  for (const [tokenId, trilha] of Object.entries(noMestre.trilhas)) {
    if (fichas.length >= FICHAS_COM_CAMINHO_MAX) break
    if (vista.minhas.has(tokenId)) {
      fichas.push({ tokenId, casas: trilha, blocos: noMestre.caminhos[tokenId] ?? 0 })
      continue
    }
    if (!vista.visiveis.has(tokenId)) continue
    const casas = trilha.filter((casa) => vista.aVista(casa))
    if (casas.length >= 2) fichas.push({ tokenId, casas })
  }
  return { zerados: noMestre.zerados, fichas }
}

/** "Você andou N blocos": a soma das fichas dele (só elas vêm com `blocos`). Sem caminho, 0. */
export function blocosQueEleAndou(caminhos: CaminhosDaBatalha | undefined): number {
  if (caminhos === undefined) return 0
  return caminhos.fichas.reduce((soma, ficha) => soma + (ficha.blocos ?? 0), 0)
}

/**
 * Trechos contínuos da trilha (cada casa vizinha da anterior). O buraco — o
 * mestre levou a ficha, ou a casa do colega está fora da vista — não vira
 * traço ligando duas pontas.
 */
export function trechosDaTrilha(casas: readonly Casa[]): Casa[][] {
  const trechos: Casa[][] = []
  let atual: Casa[] = []
  for (const casa of casas) {
    const ultima = atual[atual.length - 1]
    if (ultima !== undefined && blocosEntre(ultima, casa) !== 1) {
      if (atual.length > 1) trechos.push(atual)
      atual = []
    }
    atual.push(casa)
  }
  if (atual.length > 1) trechos.push(atual)
  return trechos
}

/**
 * Os números do caminho dele, um por bloco andado. Com o teto, as casas mais
 * antigas já saíram: a numeração continua de onde a conta (`blocos`) diz.
 */
export function numerosDaTrilha(trechos: readonly (readonly Casa[])[], blocos: number): { casa: Casa; numero: number }[] {
  const passos = trechos.reduce((soma, trecho) => soma + trecho.length - 1, 0)
  let numero = Math.max(0, blocos - passos)
  const numeros: { casa: Casa; numero: number }[] = []
  for (const trecho of trechos) {
    for (const casa of trecho.slice(1)) {
      numero += 1
      numeros.push({ casa, numero })
    }
  }
  return numeros
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inteiroEntre(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function lerCasa(value: unknown): Casa | null {
  if (!isRecord(value) || !inteiroEntre(value.col, 0, CASA_MAX) || !inteiroEntre(value.row, 0, CASA_MAX)) return null
  return { col: value.col, row: value.row }
}

function lerCaminho(value: unknown): CaminhoAndado | null {
  if (!isRecord(value) || typeof value.tokenId !== 'string' || value.tokenId.length === 0 || value.tokenId.length > ID_MAX) return null
  if (!Array.isArray(value.casas) || value.casas.length > CASAS_POR_TRILHA) return null
  const casas: Casa[] = []
  for (const bruta of value.casas) {
    const casa = lerCasa(bruta)
    if (casa === null) return null
    casas.push(casa)
  }
  if (value.blocos === undefined) return { tokenId: value.tokenId, casas }
  if (!inteiroEntre(value.blocos, 0, Number.MAX_SAFE_INTEGER)) return null
  return { tokenId: value.tokenId, casas, blocos: value.blocos }
}

/** Lê o campo `caminhos` do snapshot. Torto = `null` (o jogador derruba a mensagem, como os outros campos). */
export function lerCaminhosDaBatalha(value: unknown): CaminhosDaBatalha | null {
  if (!isRecord(value) || !inteiroEntre(value.zerados, 0, Number.MAX_SAFE_INTEGER)) return null
  if (!Array.isArray(value.fichas) || value.fichas.length > FICHAS_COM_CAMINHO_MAX) return null
  const fichas: CaminhoAndado[] = []
  for (const bruta of value.fichas) {
    const caminho = lerCaminho(bruta)
    if (caminho === null) return null
    fichas.push(caminho)
  }
  return { zerados: value.zerados, fichas }
}
