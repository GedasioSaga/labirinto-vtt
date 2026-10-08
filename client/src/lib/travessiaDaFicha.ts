import type { Light, MapData, Token } from '../types/map'
import { travelPinsClearance } from '../net/hostSession'
import * as mapFactory from './mapFactory'
import { carrierIdOf, withoutCarrier } from './carry'
import { vehicleRiderSpots, type SeatHold } from './gatherParty'
import { withPlayerVisibleTokens } from './pinTravel'
import { comPiso, mapaDoPiso, pisoDe } from './pisos'
import { tokenSizeInSquares, type Point } from './tokenSize'
import { leaveVehicle, passengersOf } from './vehicle'

/**
 * A TRAVESSIA DA FICHA entre duas cenas, pura: a ficha (e quem vai a bordo
 * dela, e as tochas presas neles) sai de uma cena e chega na outra. Quem a
 * grava no jogo de verdade é `adventureStore.transferToken`, sobre as stores do
 * editor; a VISÃO DE JOGADOR a grava na camada de teste
 * (`net/visaoDeTeste/escritoresDeTeste.ts`), sem tocar em store nenhuma.
 *
 * Três passos, para a camada de teste poder guardar cada lado na cena dele:
 * `planoDaTravessia` lê as duas cenas e decide quem chega onde;
 * `saidaDaTravessia` tira da origem; `chegadaDaTravessia` põe no destino.
 * `travessiaDaFicha` é os três juntos, sobre o mapa e o desfazer de cada cena.
 */

/** Um mapa com o desfazer dele: a cena aberta (no `useMapStore`) ou uma de fundo (no cache). */
export interface SceneHistory {
  map: MapData
  past: MapData[]
  future: MapData[]
}

/** O que atravessa: a ficha `tokenId` chega em (`x`, `y`), no piso `piso` (ausente = térreo). */
export interface PedidoDeTravessia {
  tokenId: string
  x: number
  y: number
  piso?: number
  /** VEÍCULO no "Reunir o grupo aqui": as casas que a reunião já deu e o pino dela. */
  hold?: SeatHold
}

/** Quem atravessa, já na casa e no piso de chegada, e as tochas presas neles, já no ponto de chegada. */
export interface PlanoDaTravessia {
  /** A ficha que atravessa primeiro, depois quem vai a bordo dela. Os ids não mudam. */
  viajantes: Token[]
  /** Com o id que tinham na origem: é por ele que saem de lá. */
  tochas: Light[]
}

/**
 * Id novo para o que chega e já tem id ocupado no destino (`idAntigo`). O jogo
 * de verdade sorteia; a camada de teste, que reaplica a travessia a cada
 * leitura, precisa de um id que não mude entre uma leitura e outra.
 */
export type NovoId = (idAntigo: string) => string

/*
 * A TRAVESSIA NÃO ENTRA NO DESFAZER. Tirar o token só do mapa atual deixaria
 * o `past` inteiro com ele: um Ctrl+Z na cena de origem o traria de volta, e
 * o mesmo token estaria nas DUAS cenas. Por isso o token sai de todo passo do
 * histórico da origem (passado e futuro) e entra em todo passo do histórico
 * do destino: desfazer e refazer andam pelo resto da edição sem nunca
 * duplicar nem perder a ficha de um jogador.
 */
function withoutToken(history: SceneHistory, tokenId: string): SceneHistory {
  const drop = (map: MapData): MapData => (map.tokens.some((t) => t.id === tokenId) ? mapFactory.removeToken(map, tokenId) : map)
  return { map: drop(history.map), past: history.past.map(drop), future: history.future.map(drop) }
}

/*
 * TOCHA PRESA NA FICHA atravessa com ela. Apagar a ficha solta a tocha e a
 * deixa onde está (`mapFactory.removeToken`), mas na travessia a ficha não
 * some: a tocha ficaria acesa na origem, no lugar de onde ela saiu, e ela
 * chegaria a uma cena escura enxergando só a própria casa. Como a ficha, a
 * tocha sai de todo passo do histórico da origem (um Ctrl+Z não a acende de
 * volta lá) e entra em todo passo do histórico do destino.
 */

/** As tochas presas em `departing[i]`, já na casa de `arriving[i]`: o mesmo afastamento e o piso de quem chega. */
function torchesOf(map: MapData, departing: readonly Token[], arriving: readonly Token[]): Light[] {
  return departing.flatMap((before, index) => {
    const after = arriving[index]
    return map.lights
      .filter((l) => l.attachedTokenId === before.id)
      .map((l) => comPiso({ ...l, x: l.x + after.x - before.x, y: l.y + after.y - before.y }, pisoDe(after)))
  })
}

function withoutLights(history: SceneHistory, lightIds: ReadonlySet<string>): SceneHistory {
  const drop = (map: MapData): MapData => (map.lights.some((l) => lightIds.has(l.id)) ? { ...map, lights: map.lights.filter((l) => !lightIds.has(l.id)) } : map)
  return { map: drop(history.map), past: history.past.map(drop), future: history.future.map(drop) }
}

/** Luz de mesmo id no destino (cena copiada) fica com o dela; a tocha que chega ganha id novo. */
function withLights(history: SceneHistory, lights: readonly Light[], novoId: NovoId): SceneHistory {
  if (lights.length === 0) return history
  const steps = [history.map, ...history.past, ...history.future]
  const taken = (id: string): boolean => steps.some((map) => map.lights.some((l) => l.id === id))
  const arriving = lights.map((l) => (taken(l.id) ? { ...l, id: novoId(l.id) } : l))
  const put = (map: MapData): MapData => ({ ...map, lights: [...map.lights, ...arriving] })
  return { map: put(history.map), past: history.past.map(put), future: history.future.map(put) }
}

/**
 * A ficha `fromId` passa a se chamar `toId`, e o que o mapa guarda pelo id
 * dela vai junto: a tocha presa nela, as fichas que ela leva e o lugar dela
 * num veículo.
 */
function renameToken(map: MapData, fromId: string, toId: string): MapData {
  const renamePassenger = (t: Token): Token => {
    const passageiros = t.veiculo?.passageiros
    if (t.veiculo === undefined || passageiros === undefined || !passageiros.includes(fromId)) return t
    return { ...t, veiculo: { ...t.veiculo, passageiros: passageiros.map((id) => (id === fromId ? toId : id)) } }
  }
  return {
    ...map,
    tokens: map.tokens.map((t) => {
      const renamed = renamePassenger(t.id === fromId ? { ...t, id: toId } : t)
      return renamed.levadoPor === fromId ? { ...renamed, levadoPor: toId } : renamed
    }),
    lights: map.lights.map((l) => (l.attachedTokenId === fromId ? { ...l, attachedTokenId: toId } : l)),
  }
}

/*
 * FICHA COM ID REPETIDO. Duas cenas podem ter uma ficha de mesmo id (cena
 * copiada, mapa importado duas vezes). Quem chega não substitui quem já
 * estava: a de DESTINO ganha id novo, em todo passo do histórico dela (senão
 * um Ctrl+Z traria de volta a ficha com o id repetido). A que viaja guarda o
 * id porque é por ele que a sessão sabe de qual jogador ela é, e o que chamou
 * a travessia (`carryToken`, "Deixar ir", "Reunir o grupo") segue apontando
 * para ela. Tudo que é guardado pelo id da de destino vai junto para o id
 * novo: o que mora no mapa (a tocha presa, as fichas que ela leva e o lugar
 * dela num veículo) aqui, em `renameToken`; o que mora FORA dele (a seleção e
 * a iniciativa) em `adventureStore.transferToken`, com `renamedResidents`.
 *
 * VÁRIAS DE UMA VEZ (o veículo e quem está a bordo): TODAS as de destino com
 * id repetido trocam de id ANTES de qualquer uma chegar. Uma por vez, a
 * troca de id da segunda passaria também na lista do veículo que já tinha
 * chegado, e ele levaria a ficha antiga de lá no lugar de quem viajou.
 */
function withTokens(history: SceneHistory, tokens: readonly Token[], novoId: NovoId): { history: SceneHistory; renamedResidents: Map<string, string> } {
  const steps = [history.map, ...history.past, ...history.future]
  // Quem já estava no destino com o id de quem chegou ganhou id novo: traveler → resident.
  const renamedResidents = new Map<string, string>()
  for (const token of tokens) {
    if (steps.some((map) => map.tokens.some((t) => t.id === token.id))) renamedResidents.set(token.id, novoId(token.id))
  }
  const put = (map: MapData): MapData => {
    let next = map
    for (const [travelerId, residentId] of renamedResidents) next = renameToken(next, travelerId, residentId)
    // Id de quem chega que sobrou na lista de um veículo do destino (ficha que
    // já não estava lá) não põe quem chega a bordo dele sem ninguém pedir.
    for (const token of tokens) next = leaveVehicle(next, token.id)
    for (const token of tokens) next = mapFactory.addToken(next, token)
    return next
  }
  return { history: { map: put(history.map), past: history.past.map(put), future: history.future.map(put) }, renamedResidents }
}

/**
 * LEVAR FICHA JUNTO: a ficha levada que chega a uma cena SEM quem a leva chega
 * solta. Quem leva atravessa ANTES das levadas (`hostBridge`), então achá-la
 * no destino é o "foi junto". Sem ela lá, a levada mudou de cena sozinha (pino
 * dela, "Mandar para…" só nela, reunião sem quem leva): gravar o vínculo
 * deixava um fantasma que o painel mostrava solto e que voltava a puxar a
 * ficha quando quem leva chegasse depois, sem o mestre ter prendido de novo.
 */
function arrivingLink(token: Token, destination: MapData): Token {
  const carrierId = carrierIdOf(token)
  if (carrierId === null || destination.tokens.some((t) => t.id === carrierId)) return token
  return withoutCarrier(token)
}

/**
 * Quem chega onde: a ficha `pedido.tokenId` da `origem` e quem vai a bordo
 * dela, no `destino`, com as tochas presas neles. `null` = a ficha não está na
 * origem.
 *
 * VEÍCULO: quem está a bordo atravessa junto e chega ainda a bordo (os ids de
 * quem viaja não mudam). Cada um no afastamento que tinha em volta dele,
 * quando a casa serve; senão, na casa livre mais perto do veículo — nunca fora
 * do mapa, do outro lado de uma parede ou em cima de um pino de viagem (o
 * veículo chega colado ao par). PISOS: todos chegam no piso do veículo, e só a
 * planta desse piso barra (`mapaDoPiso`). No "Reunir o grupo aqui", nem na
 * casa que a reunião deu a outro, nem no pino dela. Ficha secreta ou escondida
 * pelo mestre não ocupa casa (`withPlayerVisibleTokens`): desviar dela
 * contaria ao jogador que há algo invisível ali.
 */
export function planoDaTravessia(origem: MapData, destino: MapData, pedido: PedidoDeTravessia): PlanoDaTravessia | null {
  const { tokenId, x, y, piso, hold } = pedido
  const token = origem.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return null
  const riders = passengersOf(origem, tokenId)
  const planta = mapaDoPiso(destino, piso ?? 0)
  const seats = vehicleRiderSpots(
    withPlayerVisibleTokens(planta),
    { x, y, size: tokenSizeInSquares(token) },
    riders.map((p) => ({ dx: p.x - token.x, dy: p.y - token.y, size: tokenSizeInSquares(p) })),
    [...travelPinsClearance(planta), ...(hold?.keepClear ?? [])],
    hold?.seats ?? [],
  )
  const arrive = (t: Token, at: Point): Token => comPiso({ ...arrivingLink(t, destino), x: at.x, y: at.y }, piso)
  const viajantes: Token[] = [arrive(token, { x, y }), ...riders.map((p, index) => arrive(p, seats[index]))]
  return { viajantes, tochas: torchesOf(origem, [token, ...riders], viajantes) }
}

/** A origem sem quem atravessa e sem as tochas presas neles, em todo passo do desfazer. */
export function saidaDaTravessia(origem: SceneHistory, plano: PlanoDaTravessia): SceneHistory {
  const semTochas = withoutLights(origem, new Set(plano.tochas.map((l) => l.id)))
  return plano.viajantes.reduce((history, viajante) => withoutToken(history, viajante.id), semTochas)
}

/**
 * O destino com quem atravessa e as tochas, em todo passo do desfazer.
 * `renamedResidents`: quem já estava lá com o id de um viajante e ganhou id
 * novo (id do viajante → id novo).
 */
export function chegadaDaTravessia(destino: SceneHistory, plano: PlanoDaTravessia, novoId: NovoId): { history: SceneHistory; renamedResidents: Map<string, string> } {
  const { history: withTravelers, renamedResidents } = withTokens(destino, plano.viajantes, novoId)
  // Depois de `withTokens`: a troca de id de quem já estava leva as tochas DELE, não as que chegam.
  return { history: withLights(withTravelers, plano.tochas, novoId), renamedResidents }
}

/** A travessia inteira: a origem e o destino depois dela. `null` = a ficha não está na origem. */
export function travessiaDaFicha(
  origem: SceneHistory,
  destino: SceneHistory,
  pedido: PedidoDeTravessia,
  novoId: NovoId,
): { origem: SceneHistory; destino: SceneHistory; renamedResidents: Map<string, string> } | null {
  const plano = planoDaTravessia(origem.map, destino.map, pedido)
  if (plano === null) return null
  const chegada = chegadaDaTravessia(destino, plano, novoId)
  return { origem: saidaDaTravessia(origem, plano), destino: chegada.history, renamedResidents: chegada.renamedResidents }
}
