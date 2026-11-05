import type { CarriedItem, Token } from '../../types/map'
import type { ItemChange } from '../items'
import type { Personagem } from '../personagem'
import { fichaComMochila, fichasDeVariosBonecos } from './juncao'

/**
 * MOCHILA NA FICHA — depois da migração (docs/planos/lobby-jogadores-2026-11-05.md
 * §4): a ficha é a dona da mochila e da bolsa; o boneco só mostra. Puras, para
 * o jogo (fatia A3, `applyItemsInScene`) chamar sem reescrever a regra.
 */

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
