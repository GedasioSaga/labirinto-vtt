import type { CarriedItem, MapData, Token } from '../../types/map'
import type { ItemChange } from '../items'
import type { Personagem } from '../personagem'
import { moedasDe } from '../troca'
import { fichaComMochila, fichasDeVariosBonecos, itensIguais } from './juncao'

/**
 * MOCHILA NA FICHA — depois da migração (docs/planos/lobby-jogadores-2026-11-05.md
 * §4): a ficha é a dona da mochila e da bolsa; o boneco só mostra. Puras, para
 * o jogo (fatia A3, `applyItemsInScene` e o espelho em `stores/adventureStore.ts`)
 * chamar sem reescrever a regra.
 */

/** A mesma mochila: os mesmos itens, na mesma ordem, cada um com a mesma vaga e os mesmos dados. */
function mesmaMochila(a: readonly CarriedItem[], b: readonly CarriedItem[]): boolean {
  return a === b || (a.length === b.length && a.every((item, i) => item.id === b[i].id && itensIguais(item, b[i])))
}

/** O boneco mostrando a mochila e a bolsa da ficha; já igual, o MESMO boneco. Vazia e zero tiram a chave (ausente === vazia). */
function bonecoComAFicha(boneco: Token, ficha: Pick<Personagem, 'mochila' | 'moedas'>): Token {
  const mochila = ficha.mochila ?? []
  const moedas = moedasDe(ficha)
  if (mesmaMochila(boneco.mochila ?? [], mochila) && moedasDe(boneco) === moedas) return boneco
  const { mochila: _antes, moedas: _bolsaDeAntes, ...semMochila } = boneco
  return { ...semMochila, ...(mochila.length > 0 ? { mochila: [...mochila] } : {}), ...(moedas > 0 ? { moedas } : {}) }
}

/**
 * O ESPELHO — "a ficha vence o boneco": cada boneco do mapa ligado a uma ficha
 * da lista passa a mostrar a mochila e a bolsa DELA. Vale para a cena que
 * entra (abrir, chegar do disco, trocar de cena) e para as cenas já abertas
 * quando a ficha muda. Nunca o contrário: um boneco com a mochila velha (a
 * Poção já gasta numa cena que ficou para trás) não devolve nada à ficha.
 *
 * Fica de fora, com a mochila que já tem: o boneco sem ficha (NPC sem ficha,
 * ou ficha que não está na lista) e a ficha ligada a mais de um boneco NESTE
 * mapa (a mesma regra de `mudancaNasFichas` e da migração). Nada mudando, o
 * MESMO mapa.
 */
export function mapaComAsFichas(map: MapData, personagens: readonly Personagem[]): MapData {
  if (personagens.length === 0) return map
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const deVariosBonecos = fichasDeVariosBonecos(map.tokens)
  let mudou = false
  const tokens = map.tokens.map((boneco) => {
    if (boneco.characterId === null || deVariosBonecos.has(boneco.characterId)) return boneco
    const ficha = porId.get(boneco.characterId)
    if (ficha === undefined) return boneco
    const espelhado = bonecoComAFicha(boneco, ficha)
    if (espelhado !== boneco) mudou = true
    return espelhado
  })
  return mudou ? { ...map, tokens } : map
}

/** O espelho em cada passo do desfazer (ou do refazer); nada mudando, a MESMA lista. */
export function passosComAsFichas(passos: MapData[], personagens: readonly Personagem[]): MapData[] {
  let mudou = false
  const espelhados = passos.map((passo) => {
    const espelhado = mapaComAsFichas(passo, personagens)
    if (espelhado !== passo) mudou = true
    return espelhado
  })
  return mudou ? espelhados : passos
}

/** O mínimo do boneco para achar a ficha dele. */
export type BonecoLigado = Pick<Token, 'id' | 'characterId'>

/**
 * Uma mudança de itens (`ItemChange`: pegar, dar, tirar, pagar, trocar) nas
 * FICHAS dos bonecos ligados a elas. Cada mochila e cada bolsa da mudança já é
 * a nova inteira, então uma troca entre dois bonecos com ficha muda as DUAS
 * fichas de uma vez. Boneco sem ficha (NPC sem ficha, ou ficha que não está na
 * lista) não muda ficha nenhuma — a mochila dele continua no boneco. Ficha
 * ligada a mais de um boneco entre `bonecos` (os da cena) também não: como na
 * migração (`fichasDeVariosBonecos`), cada boneco fica com a própria mochila.
 * Nada mudando, devolve a MESMA lista.
 */
export function mudancaNasFichas(personagens: readonly Personagem[], bonecos: readonly BonecoLigado[], mudanca: Pick<ItemChange, 'mochilas' | 'bolsas'>): readonly Personagem[] {
  const deVariosBonecos = fichasDeVariosBonecos(bonecos)
  const fichaDoBoneco = new Map<string, string>()
  for (const boneco of bonecos) {
    if (boneco.characterId !== null && !deVariosBonecos.has(boneco.characterId)) fichaDoBoneco.set(boneco.id, boneco.characterId)
  }
  const mochilas = new Map<string, CarriedItem[]>()
  for (const { tokenId, mochila } of mudanca.mochilas) {
    const fichaId = fichaDoBoneco.get(tokenId)
    if (fichaId !== undefined) mochilas.set(fichaId, mochila)
  }
  const bolsas = new Map<string, number>()
  for (const { tokenId, moedas } of mudanca.bolsas ?? []) {
    const fichaId = fichaDoBoneco.get(tokenId)
    if (fichaId !== undefined) bolsas.set(fichaId, moedas)
  }
  if (mochilas.size === 0 && bolsas.size === 0) return personagens
  let mudou = false
  const novas = personagens.map((personagem) => {
    const mochila = mochilas.get(personagem.id)
    const moedas = bolsas.get(personagem.id)
    if (mochila === undefined && moedas === undefined) return personagem
    mudou = true
    return fichaComMochila(personagem, mochila ?? personagem.mochila ?? [], moedas ?? personagem.moedas ?? 0)
  })
  return mudou ? novas : personagens
}

/**
 * A ficha que NASCE depois da migração (personagem novo ligado a um boneco que
 * já carregava coisas): nasce com a mochila e a bolsa do boneco (§4.2, Ap3).
 * Ficha que já tem mochila ou bolsa não é nova: volta igual. Só para o
 * momento em que a ficha nasce — depois, quem manda é a ficha.
 */
export function fichaQueNasceDoBoneco(personagem: Personagem, boneco: Pick<Token, 'mochila' | 'moedas'>): Personagem {
  if (personagem.mochila !== undefined || personagem.moedas !== undefined) return personagem
  if (boneco.mochila === undefined && boneco.moedas === undefined) return personagem
  return fichaComMochila(personagem, boneco.mochila ?? [], boneco.moedas ?? 0)
}
