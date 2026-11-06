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

/** O boneco já mostra a mochila e a bolsa da ficha (ausente === vazia, nos dois). */
export function mostraAFicha(boneco: Pick<Token, 'mochila' | 'moedas'>, ficha: Pick<Personagem, 'mochila' | 'moedas'>): boolean {
  return mesmaMochila(boneco.mochila ?? [], ficha.mochila ?? []) && moedasDe(boneco) === moedasDe(ficha)
}

/** O boneco mostrando a mochila e a bolsa da ficha; já igual, o MESMO boneco. Vazia e zero tiram a chave (ausente === vazia). */
export function bonecoComAFicha(boneco: Token, ficha: Pick<Personagem, 'mochila' | 'moedas'>): Token {
  if (mostraAFicha(boneco, ficha)) return boneco
  const mochila = ficha.mochila ?? []
  const moedas = moedasDe(ficha)
  const { mochila: _antes, moedas: _bolsaDeAntes, ...semMochila } = boneco
  return { ...semMochila, ...(mochila.length > 0 ? { mochila: [...mochila] } : {}), ...(moedas > 0 ? { moedas } : {}) }
}

/** Mochila vazia e bolsa zerada: o que fica no boneco que mostrava a ficha e não é mais o único dela no mapa. */
const SEM_NADA: Pick<Personagem, 'mochila' | 'moedas'> = {}

/**
 * O ESPELHO — "a ficha vence o boneco": cada boneco do mapa ligado a uma ficha
 * da lista passa a mostrar a mochila e a bolsa DELA. Vale para a cena que
 * entra (abrir, chegar do disco, trocar de cena) e para as cenas já abertas
 * quando a ficha muda. Nunca o contrário: um boneco com a mochila velha (a
 * Poção já gasta numa cena que ficou para trás) não devolve nada à ficha.
 *
 * Fica de fora, com a mochila que já tem: o boneco sem ficha (NPC sem ficha,
 * ou ficha que não está na lista) e a ficha ligada a mais de um boneco NESTE
 * mapa (a mesma regra de `mudancaNasFichas` e da migração) — menos o boneco
 * dela que mostra a ficha INTEIRA: é cópia, não é dele, e fica sem nada (a
 * mochila continua na ficha). Sem isso, a ficha que atravessa para uma cena
 * onde já há outro boneco dela entra em todo passo do desfazer de lá
 * (`lib/travessiaDaFicha.ts`) com a cópia, ao lado do outro, também com a
 * cópia; um Ctrl+Z ali daria a cada um uma mochila da ficha para gastar.
 * Nada mudando, o MESMO mapa.
 */
export function mapaComAsFichas(map: MapData, personagens: readonly Personagem[]): MapData {
  if (personagens.length === 0) return map
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const deVariosBonecos = fichasDeVariosBonecos(map.tokens)
  let mudou = false
  const tokens = map.tokens.map((boneco) => {
    if (boneco.characterId === null) return boneco
    const ficha = porId.get(boneco.characterId)
    if (ficha === undefined) return boneco
    const deVarios = deVariosBonecos.has(boneco.characterId)
    if (deVarios && !mostraAFicha(boneco, ficha)) return boneco
    const espelhado = bonecoComAFicha(boneco, deVarios ? SEM_NADA : ficha)
    if (espelhado !== boneco) mudou = true
    return espelhado
  })
  return mudou ? { ...map, tokens } : map
}

/**
 * O mapa sem as cópias da ficha: o boneco que a mostra (o único dela no
 * mapa, ficha da lista) fica sem mochila e sem bolsa — são da ficha, não
 * dele. Para o boneco que SAI do mapa e pode voltar depois, quando a ficha
 * já mudou: o Ctrl+C e o Ctrl+X (colar a cópia velha somaria de novo a Poção
 * já bebida e as moedas já pagas) e o "Guardar ficha" de quem foi embora. Na
 * volta ele mostra a ficha como ela estiver. Nada mudando, o MESMO mapa.
 */
export function mapaSemOEspelho(map: MapData, personagens: readonly Personagem[]): MapData {
  if (personagens.length === 0) return map
  const listadas = new Set(personagens.map((personagem) => personagem.id))
  const deVariosBonecos = fichasDeVariosBonecos(map.tokens)
  let mudou = false
  const tokens = map.tokens.map((boneco) => {
    if (boneco.characterId === null || !listadas.has(boneco.characterId) || deVariosBonecos.has(boneco.characterId)) return boneco
    const vazio = bonecoComAFicha(boneco, SEM_NADA)
    if (vazio !== boneco) mudou = true
    return vazio
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
 * TROCA E PAGAMENTO (§4.6, fatia A3): a mudança mexe em mais de uma parte —
 * duas mochilas ("Dar a…"), duas bolsas ("Pagar a…"), a mochila e a bolsa (a
 * troca do mestre). Cada parte sozinha criaria ou sumiria item ou moeda, então
 * no Lobby elas vão tudo ou nada (`atomico`). Pegar, tirar, devolver ao chão,
 * a venda da loja e o "moedas" do mestre mexem numa parte só: vão op por op.
 */
export function ehTrocaOuPagamento(mudanca: Pick<ItemChange, 'mochilas' | 'bolsas'>): boolean {
  return mudanca.mochilas.length + (mudanca.bolsas?.length ?? 0) > 1
}

/** Cada ficha com um boneco em `bonecoDaFicha` passa a ter a mochila e a bolsa dele. Nada mudando, a MESMA lista. */
function fichasComAMochilaDe(personagens: readonly Personagem[], bonecoDaFicha: ReadonlyMap<string, Pick<Token, 'mochila' | 'moedas'>>): readonly Personagem[] {
  if (bonecoDaFicha.size === 0) return personagens
  let mudou = false
  const novas = personagens.map((personagem) => {
    const boneco = bonecoDaFicha.get(personagem.id)
    if (boneco === undefined || mostraAFicha(boneco, personagem)) return personagem
    mudou = true
    return fichaComMochila(personagem, boneco.mochila ?? [], moedasDe(boneco))
  })
  return mudou ? novas : personagens
}

/**
 * A RECUPERAÇÃO — o contrário do espelho, só nela: o trabalho não salvo volta
 * pelos bonecos dos `mapas` recuperados, mas as fichas vêm do disco, do último
 * Salvar (a cópia de recuperação guarda só mapas). Com a mochila já na ficha
 * quando a cópia foi feita, o boneco recuperado mostrava a ficha de então:
 * aqui ele VENCE a ficha do disco — a Poção pega depois do último Salvar volta
 * para a ficha, e o espelho seguinte não a apaga.
 *
 * O primeiro mapa com boneco da ficha vale (quem chama põe o mapa aberto na
 * frente). Ficha com vários bonecos num mapa: aquele mapa não conta, a mochila
 * está nos bonecos (a regra de `mapaComAsFichas`). Nada mudando, a MESMA lista.
 */
export function fichasComOsBonecos(personagens: readonly Personagem[], mapas: readonly MapData[]): readonly Personagem[] {
  const bonecoDaFicha = new Map<string, Token>()
  for (const mapa of mapas) {
    const deVariosBonecos = fichasDeVariosBonecos(mapa.tokens)
    for (const boneco of mapa.tokens) {
      if (boneco.characterId === null || deVariosBonecos.has(boneco.characterId) || bonecoDaFicha.has(boneco.characterId)) continue
      bonecoDaFicha.set(boneco.characterId, boneco)
    }
  }
  return fichasComAMochilaDe(personagens, bonecoDaFicha)
}
