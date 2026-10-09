import type { CarriedItem, MapData, Pin, PinItem, Prop, Token } from '../types/map'
import { tokenRadiusOf } from './doorReach'
import { rotationToRadians } from './itemTransform'
import {
  carriedItemsOf,
  darDoAcervoChange,
  ITEM_REACH_CELLS,
  itemOfPin,
  quantidadeDe,
  readPinItem,
  removeItemChange,
  tokenReachesPin,
  type ItemChange,
  type ItemParaDar,
} from './items'
import { comPiso, pisoDe } from './pisos'

/**
 * ITEM NO MAPA (entrega 5 dos sistemas de RPG) — regras puras do item que o
 * mestre solta do acervo no mapa, em uma de duas FORMAS:
 *  - `chao`: a IMAGEM do item deitada no chão. É um objeto (`Prop.item`): o
 *    mestre arrasta, redimensiona e gira como qualquer objeto, e o jogador a
 *    vê quando ela está na visão dele e a toca;
 *  - `pino`: o PINO DE ITEM ("!" com o símbolo do saco, `Pin.item`), para o
 *    item sem imagem ou quando o mestre prefere o marcador.
 * As duas pegam do mesmo jeito (`pin.take`, `net/hostSession.ts`) e levam à
 * mochila os dados inteiros do item: imagem (referência de mídia), descrição,
 * categoria, preço e quantidade, empilhando no empilhável. Sem DOM, sem store.
 */

export type FormaDoItem = 'chao' | 'pino'

/** Onde está um item pegável do mapa, com o item numa cópia limpa. */
export type ItemNoMapa =
  | { forma: 'pino'; id: string; item: PinItem; pin: Pin }
  | { forma: 'chao'; id: string; item: PinItem; prop: Prop }

/** O item do objeto no chão, quando ele é um: nome não vazio, dados pela porta de `readPinItem`. */
export function itemDoObjeto(prop: Pick<Prop, 'item'>): PinItem | null {
  return prop.item === undefined ? null : (readPinItem(prop.item) ?? null)
}

/**
 * O item pegável de id `id` — pino primeiro, depois o objeto no chão (os ids
 * são sorteados, nunca se repetem entre os dois). `null` = não há, ou não é
 * pegável: quem pergunta (o host, o cartão) trata os dois casos igual.
 */
export function acharItemNoMapa(map: Pick<MapData, 'pins' | 'props'>, id: string): ItemNoMapa | null {
  const pin = map.pins.find((p) => p.id === id)
  if (pin !== undefined) {
    const item = itemOfPin(pin)
    return item === null ? null : { forma: 'pino', id, item, pin }
  }
  const prop = map.props.find((p) => p.id === id)
  const item = prop === undefined ? null : itemDoObjeto(prop)
  return prop === undefined || item === null ? null : { forma: 'chao', id, item, prop }
}

/** Os objetos do chão que são item, na ordem do mapa. */
export function itensNoChao(props: readonly Prop[]): Prop[] {
  return props.filter((prop) => itemDoObjeto(prop) !== null)
}

/** O ponto no sistema do objeto (sem a rotação dele), com o centro na origem. */
function pontoNoObjeto(prop: Pick<Prop, 'x' | 'y' | 'rotation'>, ponto: { x: number; y: number }): { x: number; y: number } {
  const angulo = -rotationToRadians(prop.rotation)
  const dx = ponto.x - prop.x
  const dy = ponto.y - prop.y
  return { x: dx * Math.cos(angulo) - dy * Math.sin(angulo), y: dx * Math.sin(angulo) + dy * Math.cos(angulo) }
}

/** Distância do ponto ao retângulo do objeto (girado); 0 dentro dele. */
export function distanciaAoObjeto(prop: Pick<Prop, 'x' | 'y' | 'width' | 'height' | 'rotation'>, ponto: { x: number; y: number }): number {
  const local = pontoNoObjeto(prop, ponto)
  const fora = (valor: number, metade: number): number => Math.max(Math.abs(valor) - metade, 0)
  return Math.hypot(fora(local.x, prop.width / 2), fora(local.y, prop.height / 2))
}

/**
 * O item do chão sob o ponto, o de cima primeiro (o último da lista é o
 * desenhado por cima). `folga` em px de mundo: a do dedo, como no pino.
 */
export function itemNoChaoNoPonto(props: readonly Prop[], ponto: { x: number; y: number }, folga: number): Prop | null {
  for (let i = props.length - 1; i >= 0; i--) {
    const prop = props[i]
    if (itemDoObjeto(prop) !== null && distanciaAoObjeto(prop, ponto) <= folga) return prop
  }
  return null
}

/**
 * O item está ao alcance da ficha: a mesma régua do pino (`ITEM_REACH_CELLS`
 * além da borda dela), medida até o ponto mais perto da imagem no chão — uma
 * espada comprida se pega pela ponta.
 */
export function fichaAlcancaItem(token: Pick<Token, 'x' | 'y' | 'size'>, alvo: ItemNoMapa, grid: number): boolean {
  if (alvo.forma === 'pino') return tokenReachesPin(token, alvo.pin, grid)
  return distanciaAoObjeto(alvo.prop, token) <= tokenRadiusOf(token, grid) + grid * ITEM_REACH_CELLS
}

/**
 * O que o JOGADOR recebe do item (pino ou chão): o cartão mostra a imagem, o
 * nome, a descrição, a categoria e a quantidade, e precisa saber se pede ao
 * mestre. LISTA DO QUE VAI: o id do acervo, o preço e o "empilha" são do
 * mestre e da mochila — no chão não dizem nada ao jogador. A imagem só como
 * referência de mídia (`readPinItem` já recusou o resto).
 */
export function itemParaJogador(item: PinItem): PinItem {
  const paraJogador: PinItem = { nome: item.nome }
  if (item.livre === true) paraJogador.livre = true
  if (item.imagem !== undefined) paraJogador.imagem = item.imagem
  if (item.descricao !== undefined) paraJogador.descricao = item.descricao
  if (item.categoria !== undefined) paraJogador.categoria = item.categoria
  if (item.quantidade !== undefined) paraJogador.quantidade = item.quantidade
  return paraJogador
}

/**
 * O item do acervo como ele nasce no mapa: os dados que vão para a mochila,
 * uma unidade, e "Pega direto" (`livre`) — o padrão que o usuário escolheu
 * para o item que o mestre solta. `null` = nome vazio.
 */
export function itemDoAcervoNoMapa(item: ItemParaDar): PinItem | null {
  const lido = readPinItem({ ...item, quantidade: undefined, livre: true })
  return lido ?? null
}

/** O pino de item: "!" com o símbolo do saco, sem texto nem imagem próprios (o cartão mostra os do item). */
export function pinoDeItem(id: string, ponto: { x: number; y: number }, item: PinItem): Pin {
  return { id, x: ponto.x, y: ponto.y, kind: 'exclamacao', icon: 'item', description: '', image: null, item }
}

/** A imagem do item no chão, centrada em `ponto`, numa caixa de `lado` px (o mestre redimensiona depois). */
export function objetoDeItem(id: string, ponto: { x: number; y: number }, lado: number, item: PinItem): Prop {
  return { id, src: '', x: ponto.x, y: ponto.y, width: lado, height: lado, linkedMapPath: null, item }
}

/** A imagem do item nasce do tamanho de uma casa da grade: cabe na mão da ficha, e o mestre aumenta se quiser. */
export function ladoNoChao(grid: number): number {
  return Number.isFinite(grid) && grid > 0 ? grid : 50
}

/**
 * Troca a FORMA do item `id` (imagem no chão ⇄ pino de item), no mesmo lugar,
 * no mesmo piso e com o mesmo id, "Oculto para jogadores", trava e o item
 * inteiro. Item sem imagem não vira imagem no chão (não haveria o que
 * desenhar). Nada a trocar devolve o MESMO mapa.
 */
export function trocarFormaDoItem(map: MapData, id: string): MapData {
  const alvo = acharItemNoMapa(map, id)
  if (alvo === null) return map
  if (alvo.forma === 'chao') {
    const { prop } = alvo
    const pino = comPiso(pinoDeItem(id, { x: prop.x, y: prop.y }, alvo.item), prop.piso)
    if (prop.secret === true) pino.secret = true
    if (prop.locked === true) pino.locked = true
    return { ...map, props: map.props.filter((p) => p.id !== id), pins: [...map.pins, pino] }
  }
  const { pin } = alvo
  if (alvo.item.imagem === undefined) return map
  const objeto = comPiso(objetoDeItem(id, { x: pin.x, y: pin.y }, ladoNoChao(map.grid), alvo.item), pin.piso)
  if (pin.secret === true) objeto.secret = true
  if (pin.locked === true) objeto.locked = true
  return { ...map, pins: map.pins.filter((p) => p.id !== id), props: [...map.props, objeto] }
}

/**
 * "Pegar": o item sai do mapa e vai INTEIRO à mochila da ficha — imagem,
 * descrição, categoria, preço e quantidade. Empilhável com o mesmo item do
 * acervo já na mochila soma na vaga que existe (a regra do "Dar a…",
 * `darDoAcervoChange`); senão abre vaga nova com o id do item no mapa (o de
 * sempre: o id do pino de onde ele saiu), ou `freshId` se a mochila já tem
 * esse id. `null` = item sem nome (não acontece com o que `acharItemNoMapa` achou).
 */
export function pegarItemChange(token: Token, alvo: ItemNoMapa, freshId: string): ItemChange | null {
  const vagaId = carriedItemsOf(token).some((carried) => carried.id === alvo.id) ? freshId : alvo.id
  const { livre: _livre, ...dados } = alvo.item
  const change = darDoAcervoChange(token, dados, quantidadeDe(alvo.item), vagaId)
  if (change === null) return null
  return alvo.forma === 'pino' ? { ...change, removePinId: alvo.id } : { ...change, removePropId: alvo.id }
}

/** O item da mochila de volta à forma de item no mapa (sem o id da vaga). */
function itemDaMochila(carried: CarriedItem): PinItem {
  const { id: _id, ...item } = carried
  return item
}

/**
 * "Devolver ao chão" (mestre) e "Largar no chão" (ficha de personagem): o item
 * sai da mochila e volta ao mapa onde a ficha está — no MESMO piso dela — com
 * TODOS os dados, pedindo ao mestre de novo, como o largar de sempre. A forma
 * segue uma regra só: com imagem, a IMAGEM NO CHÃO (a forma padrão de quem
 * solta do acervo); sem imagem, o PINO DE ITEM (não há o que desenhar no
 * chão). Usa o id da vaga (o do pino de onde o item saiu); se o mapa já tem
 * pino ou objeto com esse id, usa `freshId` — nunca sobrescreve nada.
 */
export function dropItemChange(map: MapData, token: Token, itemId: string, freshId: string): ItemChange | null {
  const carried = carriedItemsOf(token).find((item) => item.id === itemId)
  const removed = removeItemChange(token, itemId)
  if (carried === undefined || removed === null) return null
  const ocupado = map.pins.some((pin) => pin.id === carried.id) || map.props.some((prop) => prop.id === carried.id)
  const id = ocupado ? freshId : carried.id
  const item = readPinItem(itemDaMochila(carried))
  if (item === undefined) return null
  // O host grava direto (fora do desfazer que carimba o piso em edição): sem o
  // piso da ficha o item cairia no térreo, longe de quem o largou.
  const piso = pisoDe(token)
  if (item.imagem !== undefined) return { ...removed, addProp: comPiso(objetoDeItem(id, token, ladoNoChao(map.grid), item), piso) }
  return { ...removed, addPin: comPiso(pinoDeItem(id, token, item), piso) }
}
