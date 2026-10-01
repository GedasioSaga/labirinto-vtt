import { pointInRing } from '../lib/floorContour'
import { pisoDe } from '../lib/pisos'
import type { SomId } from '../lib/sons/receitas'
import type { MapData, RegionPoint, Wall } from '../types/map'
import type { PlayerState } from './playerConnection'

/**
 * QUANDO TOCAR UM SOM DE CLIMA NO JOGADOR (pedido "sons": "tocar um sound
 * effect ao pegar um item ou ir para um cenário, tipo Resident Evil").
 * Compara o estado da conexão antes e depois de UMA mudança e diz que sons
 * ela vale. Função pura: quem toca é `sonsDoJogador.ts`; como soa, `lib/sons`.
 *
 * O que nunca toca: a entrada no jogo, a queda e a volta, o lobby, o "Volto
 * já" e o que só reaparece (recado e alarme que o host reenvia na volta). O
 * estado do jogador muda muito, em vários `setState` seguidos; a regra é que
 * só a NOVIDADE toca, e uma vez.
 */

/**
 * O que esta página já viu: alarme e recado que chegam de novo (o host
 * reenvia o último recado da cena e o alarme que ainda vale na volta da
 * queda, no "Reconectar" e na volta do lobby) não tocam outra vez. Quem
 * guarda é o instalador, durante a vida da conexão.
 */
export interface JaVistos {
  readonly alarmes: Set<string>
  readonly recados: Set<string>
}

export function criarJaVistos(): JaVistos {
  return { alarmes: new Set(), recados: new Set() }
}

/**
 * O jogo valendo na tela: jogando, com o recorte do host já aplicado (o rev
 * volta a -1 na queda e no "Reconectar": o primeiro recorte depois disso é
 * história), sem queda em curso e sem o "Volto já" (a tela mostra "Você está
 * fora da mesa" no lugar do mapa).
 */
export function estaAoVivo(estado: PlayerState): boolean {
  return estado.status === 'playing' && estado.rev >= 0 && estado.reconnecting === undefined && estado.away !== true
}

/** Anota o que `estado` mostra. `antes` só poupa trabalho: lista que não mudou não é relida. */
export function anotarVistos(vistos: JaVistos, estado: PlayerState, antes?: PlayerState): void {
  if (estado.alarm !== undefined) vistos.alarmes.add(estado.alarm.id)
  if (estado.note !== undefined) vistos.recados.add(estado.note.id)
  if (antes === undefined || estado.notebook !== antes.notebook) for (const recado of estado.notebook ?? []) vistos.recados.add(recado.id)
  if (antes === undefined || estado.awayNotes !== antes.awayNotes) for (const recado of estado.awayNotes ?? []) vistos.recados.add(recado.id)
}

export function sonsDaMudanca(antes: PlayerState, depois: PlayerState, vistos: JaVistos): SomId[] {
  if (!estaAoVivo(antes) || !estaAoVivo(depois)) return []
  // Mapa novo não pode ser lido como "portas que abriram": havendo passagem, ela é o único som.
  if (houvePassagem(antes, depois)) return ['passagem']
  const sons: SomId[] = []
  if (pegouItem(antes, depois)) sons.push('item')
  if (topouComPortaTrancada(antes, depois)) sons.push('trancada')
  sons.push(...sonsDasPortas(antes, depois))
  if (chegouRolagem(antes, depois)) sons.push('dado')
  if (chegouAviso(antes, depois, vistos)) sons.push('aviso')
  return sons
}

/**
 * Trocou de cena ou de piso. A cena é a época (`sceneEpoch`), que só sobe
 * com as duas pontas jogando no `scene.changed`: a viagem pelo pino, o "levar"
 * e o "reunir" do mestre e a escada entre andares (cada andar é uma cena).
 * O `travel` em arrived/moved/gathered NÃO conta à parte: ele nasce no mesmo
 * `scene.changed`, logo atrás da época (`playerConnection.ts`), e tocaria a
 * mesma chegada duas vezes. Nem o rótulo do andar (`andares.atual`): o mestre
 * renomeia ou liga os andares sem ninguém sair do lugar.
 */
function houvePassagem(antes: PlayerState, depois: PlayerState): boolean {
  return depois.sceneEpoch > antes.sceneEpoch || trocouDePiso(antes, depois)
}

/** PISOS NA MESMA CENA: a ficha dele subiu ou desceu a escada. Mesma cena, mesmo mapa; muda o piso da ficha. */
function trocouDePiso(antes: PlayerState, depois: PlayerState): boolean {
  const mapaAntes = antes.map
  const mapaDepois = depois.map
  if (mapaAntes === undefined || mapaDepois === undefined || mapaAntes.id !== mapaDepois.id || mapaAntes.tokens === mapaDepois.tokens) return false
  const eramDele = new Set(antes.ownTokens ?? [])
  for (const id of depois.ownTokens ?? []) {
    if (!eramDele.has(id)) continue
    const fichaAntes = mapaAntes.tokens.find((ficha) => ficha.id === id)
    const fichaDepois = mapaDepois.tokens.find((ficha) => ficha.id === id)
    if (fichaAntes !== undefined && fichaDepois !== undefined && pisoDe(fichaAntes) !== pisoDe(fichaDepois)) return true
  }
  return false
}

/** "Pegar" aceito pelo mestre: cada resposta ganha `id` novo, então o mesmo id é o mesmo aviso. */
function pegouItem(antes: PlayerState, depois: PlayerState): boolean {
  const item = depois.item
  return item !== undefined && item.phase === 'taken' && item.id !== antes.item?.id
}

/** O toque na porta voltou "Trancada". Longe ou fora da vista não é a maçaneta chacoalhando. */
function topouComPortaTrancada(antes: PlayerState, depois: PlayerState): boolean {
  const aviso = depois.doorNotice
  return aviso !== undefined && aviso.reason === 'locked' && aviso.id !== antes.doorNotice?.id
}

/**
 * Distância, em px de mundo, das amostras de cada lado da porta: a mesma do
 * host (`DOOR_VISION_PROBE` em `lib/fogFilter.ts`). A porta fica NA borda da
 * visão; o lado de quem olha cai dentro dela.
 */
const AMOSTRA_DA_PORTA_PX = 2

type Segmento = Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>

/** O meio da porta e um ponto de cada lado dela, como o host amostra (`doorSamples`). */
function amostrasDaPorta({ x1, y1, x2, y2 }: Segmento): RegionPoint[] {
  const meio = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
  const comprimento = Math.hypot(x2 - x1, y2 - y1)
  if (comprimento === 0) return [meio]
  const nx = (-(y2 - y1) / comprimento) * AMOSTRA_DA_PORTA_PX
  const ny = ((x2 - x1) / comprimento) * AMOSTRA_DA_PORTA_PX
  return [meio, { x: meio.x + nx, y: meio.y + ny }, { x: meio.x - nx, y: meio.y - ny }]
}

/**
 * A porta está na visão de agora. Porta explorada fora da visão chega com o
 * estado LEMBRADO, e a nunca vista chega fechada (`lib/fogFilter.ts`): quando
 * o jogador a avista, ela "abre" no recorte sem ninguém ter mexido nela.
 */
function portaAVista(porta: Segmento, visao: readonly RegionPoint[][] | undefined): boolean {
  if (visao === undefined) return false
  return amostrasDaPorta(porta).some((ponto) => visao.some((anel) => pointInRing(ponto, anel)))
}

/**
 * As paredes do recorte. `isMapShape` não confere `walls` e o recorte pode
 * chegar sem o campo (`playerConnection.ts`, PORTAS POR ATRAVESSAR): aí não
 * há porta a comparar.
 */
function paredesDo(mapa: MapData): readonly Wall[] {
  return Array.isArray(mapa.walls) ? mapa.walls : []
}

/**
 * Portas que mudaram à vista dele, no mesmo mapa: no máximo um rangido e um
 * baque por mudança, mesmo com várias portas (alavanca, o mestre em lote).
 * Mapa de outra cena (o snapshot logo atrás do `scene.changed` vem com a
 * mesma época) não é comparado; porta que só aparece de um lado também não.
 */
function sonsDasPortas(antes: PlayerState, depois: PlayerState): SomId[] {
  const mapaAntes = antes.map
  const mapaDepois = depois.map
  if (mapaAntes === undefined || mapaDepois === undefined || mapaAntes.id !== mapaDepois.id) return []
  const paredesAntes = paredesDo(mapaAntes)
  const paredesDepois = paredesDo(mapaDepois)
  // Andar com a ficha troca o mapa mas não as paredes: a lista é a mesma e não há o que comparar.
  if (paredesAntes === paredesDepois) return []
  const portasAntes = new Map<string, Wall>()
  for (const parede of paredesAntes) if (parede.door !== null) portasAntes.set(parede.id, parede)
  let abriu = false
  let fechou = false
  for (const parede of paredesDepois) {
    const porta = parede.door
    if (porta === null) continue
    const antiga = portasAntes.get(parede.id)
    if (antiga === undefined || antiga.door === null || antiga.door.open === porta.open) continue
    if (!portaAVista(antiga, antes.vision) || !portaAVista(parede, depois.vision)) continue
    if (porta.open) abriu = true
    else fechou = true
  }
  const sons: SomId[] = []
  if (abriu) sons.push('portaAbre')
  if (fechou) sons.push('portaFecha')
  return sons
}

/** Rolagem com id que não estava na lista de antes; a lista tem teto, então a mais velha pode sair junto. */
function chegouRolagem(antes: PlayerState, depois: PlayerState): boolean {
  const rolagens = depois.diceRolls
  if (rolagens === undefined || rolagens === antes.diceRolls) return false
  const conhecidas = new Set((antes.diceRolls ?? []).map((rolagem) => rolagem.id))
  return rolagens.some((rolagem) => !conhecidas.has(rolagem.id))
}

/**
 * Alarme novo, ou recado novo do MESTRE (sem `from`; o abalo e a resposta
 * escrita ao "Chamar o mestre" chegam assim). Bilhete de colega não é aviso.
 * O que já foi visto nesta página (ou na ponta de antes) não toca de novo.
 */
function chegouAviso(antes: PlayerState, depois: PlayerState, vistos: JaVistos): boolean {
  const alarme = depois.alarm
  if (alarme !== undefined && alarme.id !== antes.alarm?.id && !vistos.alarmes.has(alarme.id)) return true
  const recado = depois.note
  return recado !== undefined && recado.from === undefined && recado.id !== antes.note?.id && !vistos.recados.has(recado.id)
}
