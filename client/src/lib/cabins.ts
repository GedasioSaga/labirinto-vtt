import type { MapData, Pin, PinDestination, RegionPoint, Token } from '../types/map'
import { seenOccupant, type OwnerVisionRadii } from './imposedOccupancy'
import { isArrivalOnly, travelExitsOf, type PinTravel } from './pinTravel'

/**
 * MOVIMENTO IMPOSTO — a CABINE CONTÍNUA (paternoster). Regra pura, sem DOM,
 * sem store. O mestre liga um pino "!"/"?" ao PRÓXIMO pino da mesma cena
 * (`Pin.cabine`); a cada "Avançar esteiras", a ficha que ficou parada na casa
 * do pino é levada à próxima parada. Encadeando as paradas (A → B → C → A), a
 * cabine não para de girar: quem continua dentro segue para a seguinte.
 *
 * A cabine anda no poço, não no chão: parede e porta fechada não a seguram.
 * Com "Fichas ocupam espaço", a parada ocupada por quem NÃO sai segura a
 * ficha; as cabines andam juntas, então quem sai da parada abre a vaga.
 *
 * O pino de VIAGEM também pode ser cabine, e a próxima parada dele é o PAR (o
 * pino de viagem da outra cena para onde uma das saídas leva): é o
 * paternoster que muda de andar. `Pin.cabine` guarda o id do par. Aqui só se
 * diz quem vai e para onde (`cabinTransfers`); quem troca a ficha de cena é a
 * aventura (`stores/avancarMovimentoImposto.ts`).
 */

/** Nome da parada sem descrição: a casa do pino, contada a partir de 1. */
function cellLabel(pin: Pin, grid: number): string {
  const size = grid > 0 ? grid : 1
  return `Pino na coluna ${Math.floor(pin.x / size) + 1}, linha ${Math.floor(pin.y / size) + 1}`
}

/** Teto do rótulo da parada no painel: a coluna do rail não comporta mais. */
const CABIN_LABEL_MAX = 40

/** Parada DESTA cena: pino "!"/"?". O de viagem leva ao par dele, nunca a outro pino da cena. */
function canBeCabin(pin: Pin): boolean {
  return pin.kind !== 'viagem'
}

/** As pontas das saídas do pino de viagem que pode ser cabine. Chegada oculta não leva de volta (mão única). */
function parDestinations(pin: Pin): PinDestination[] {
  if (pin.kind !== 'viagem' || isArrivalOnly(pin)) return []
  return travelExitsOf(pin).map((saida) => saida.destino)
}

/** O par para onde a cabine do pino de viagem leva, ou `null` (sem cabine, ou par que não é de nenhuma saída). */
function parStop(pin: Pin): PinDestination | null {
  if (pin.cabine === undefined) return null
  return parDestinations(pin).find((destino) => destino.pinId === pin.cabine) ?? null
}

/** `Pin.cabine` como veio do disco (cru): só texto não vazio; o resto é ausência. */
export function readCabin(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw !== '' ? raw : undefined
}

/** O pino com exatamente esta cabine; `undefined` APAGA o campo (o pino de sempre). */
export function pinWithCabin(pin: Pin, cabine: string | undefined): Pin {
  const { cabine: _antiga, ...semCabine } = pin
  return cabine === undefined ? semCabine : { ...semCabine, cabine }
}

/** A próxima parada que vale: pino desta cena, outro, e que pode ser cabine. */
function nextStop(map: MapData, pin: Pin): Pin | null {
  if (!canBeCabin(pin) || pin.cabine === undefined || pin.cabine === pin.id) return null
  const target = map.pins.find((p) => p.id === pin.cabine)
  return target !== undefined && canBeCabin(target) ? target : null
}

/** Id da próxima parada do pino, ou `null` (sem cabine, ou ligada a pino que sumiu). */
export function cabinOf(map: MapData, pinId: string): string | null {
  const pin = map.pins.find((p) => p.id === pinId)
  if (pin === undefined) return null
  if (pin.kind === 'viagem') return parStop(pin)?.pinId ?? null
  return nextStop(map, pin)?.id ?? null
}

/** Uma parada que o painel oferece. */
export interface CabinTarget {
  id: string
  label: string
}

/** As paradas possíveis do pino: os outros pinos "!"/"?" da cena, pelo nome que o mestre lê. */
export function cabinTargets(map: MapData, pinId: string): CabinTarget[] {
  return map.pins
    .filter((p) => p.id !== pinId && canBeCabin(p))
    .map((p) => {
      const firstLine = p.description.split('\n')[0]?.trim() ?? ''
      return { id: p.id, label: firstLine === '' ? cellLabel(p, map.grid) : firstLine.slice(0, CABIN_LABEL_MAX) }
    })
}

/** Teto do nome da cena no rótulo do par. */
const PAR_SCENE_LABEL_MAX = 28

/**
 * As paradas do pino de VIAGEM: o par de cada saída ligada, pelo nome da cena
 * (o painel é do mestre; o jogador nunca lê isto). `exits` é o que
 * `pinExitsTravelOf` resolve; saída sem par ou com a cena fora do ar não entra.
 */
export function cabinTargetsOfPar(exits: readonly { rotulo: string; travel: PinTravel }[]): CabinTarget[] {
  return exits.flatMap((exit): CabinTarget[] => {
    if (exit.travel.status !== 'ligado') return []
    const rotulo = exit.rotulo.trim()
    const cena = exit.travel.sceneName.slice(0, PAR_SCENE_LABEL_MAX)
    const label = rotulo === '' ? `Par em ${cena}` : `Par em ${cena} (${rotulo.slice(0, CABIN_LABEL_MAX)})`
    return [{ id: exit.travel.partner.id, label }]
  })
}

/**
 * O mestre liga o pino à próxima parada, troca, ou desliga (`null`). Pino que
 * não existe, parada inválida (o próprio pino, pino que não existe, pino de
 * viagem) ou a mesma escolha devolvem o MESMO mapa — sem histórico à toa.
 */
export function setPinCabin(map: MapData, pinId: string, targetId: string | null): MapData {
  const pin = map.pins.find((p) => p.id === pinId)
  if (pin === undefined) return map
  const viagem = pin.kind === 'viagem'
  if (viagem && isArrivalOnly(pin)) return map
  if (targetId === null) {
    return pin.cabine === undefined ? map : { ...map, pins: map.pins.map((p) => (p === pin ? pinWithCabin(p, undefined) : p)) }
  }
  if (targetId === pinId || targetId === pin.cabine) return map
  const valid = viagem
    ? parDestinations(pin).some((destino) => destino.pinId === targetId)
    : map.pins.some((p) => p.id === targetId && canBeCabin(p))
  if (!valid) return map
  return { ...map, pins: map.pins.map((p) => (p === pin ? pinWithCabin(p, targetId) : p)) }
}

/** A ficha está na CASA do pino (o centro dela a menos de meia casa em cada eixo). */
function standsOn(token: Token, pin: Pin, grid: number): boolean {
  return Math.abs(token.x - pin.x) < grid / 2 && Math.abs(token.y - pin.y) < grid / 2
}

/** Uma viagem de cabine: a ficha e a parada onde ela desce. */
interface CabinRide {
  token: Token
  to: RegionPoint
}

/** Quem pega a cabine: fora de `moved`, parado na casa de um pino com próxima parada válida. */
function cabinRides(map: MapData, tokens: readonly Token[], moved: ReadonlySet<string>): CabinRide[] {
  const stops = map.pins.flatMap((pin): { pin: Pin; next: Pin }[] => {
    const next = nextStop(map, pin)
    return next === null ? [] : [{ pin, next }]
  })
  if (stops.length === 0) return []
  return tokens.flatMap((token): CabinRide[] => {
    if (moved.has(token.id)) return []
    const stop = stops.find((s) => standsOn(token, s.pin, map.grid))
    return stop === undefined ? [] : [{ token, to: { x: stop.next.x, y: stop.next.y } }]
  })
}

/** Uma viagem de cabine ao PAR: a ficha sai desta cena para o pino `pinId` da cena `sceneId`. */
export interface CabinTransfer {
  tokenId: string
  sceneId: string
  pinId: string
}

/**
 * Quem a cabine do pino de viagem leva ao par neste Avançar: fora de `skip`
 * (quem a esteira moveu ou já pegou cabine nesta cena), parado na casa de um
 * pino de viagem com cabine ligada ao par. `tokens` é o chão DEPOIS das esteiras.
 */
export function cabinTransfers(map: MapData, tokens: readonly Token[], skip: ReadonlySet<string>): CabinTransfer[] {
  const stops = map.pins.flatMap((pin): { pin: Pin; par: PinDestination }[] => {
    const par = parStop(pin)
    return par === null ? [] : [{ pin, par }]
  })
  if (stops.length === 0) return []
  return tokens.flatMap((token): CabinTransfer[] => {
    if (skip.has(token.id)) return []
    const stop = stops.find((s) => standsOn(token, s.pin, map.grid))
    return stop === undefined ? [] : [{ tokenId: token.id, sceneId: stop.par.sceneId, pinId: stop.par.pinId }]
  })
}

/**
 * As viagens que acontecem, com "Fichas ocupam espaço". As cabines andam
 * JUNTAS: a parada ocupada por quem também sai não segura ninguém. Começa
 * supondo que todas saem; quem achar a parada tomada fica, e a conta recomeça
 * até ninguém mais ficar (cada volta só aumenta quem fica, então termina).
 * Duas fichas para a mesma parada: vai a primeira da lista.
 * `blockers` são as fichas que podem segurar; segura só a que o dono da ficha
 * que vai enxerga do pino onde ela está, com o raio do dono na sala
 * (`seenOccupant`, `radii`): ficar no pino por causa de quem ele não vê
 * contaria que existe alguém na parada.
 */
function resolveRides(map: MapData, rides: readonly CabinRide[], blockers: readonly Token[], radii: OwnerVisionRadii): CabinRide[] {
  const riding = new Set(rides.map((r) => r.token.id))
  const blocks = new Set(blockers.map((t) => t.id))
  const staying = blockers.filter((t) => !riding.has(t.id))
  const held = new Set<string>()
  for (;;) {
    const heldTokens = rides.filter((r) => held.has(r.token.id) && blocks.has(r.token.id)).map((r) => r.token)
    const arrived: Token[] = []
    const accepted: CabinRide[] = []
    let changed = false
    for (const ride of rides) {
      if (held.has(ride.token.id)) continue
      if (seenOccupant(map, ride.token, ride.to, [...staying, ...heldTokens, ...arrived], radii) !== undefined) {
        held.add(ride.token.id)
        changed = true
        break
      }
      if (blocks.has(ride.token.id)) arrived.push({ ...ride.token, x: ride.to.x, y: ride.to.y })
      accepted.push(ride)
    }
    if (!changed) return accepted
  }
}

/**
 * Onde a cabine larga cada ficha neste Avançar. `tokens` é o chão DEPOIS das
 * esteiras; `moved` são as fichas que a esteira moveu (estavam andando, não
 * paradas). `blockers` é `null` sem "Fichas ocupam espaço". `radii` é o raio
 * de visão do dono de cada ficha na sala (`lib/imposedOccupancy.ts`).
 */
export function cabinDestinations(
  map: MapData,
  tokens: readonly Token[],
  moved: ReadonlySet<string>,
  blockers: readonly Token[] | null,
  radii: OwnerVisionRadii,
): Map<string, RegionPoint> {
  const rides = cabinRides(map, tokens, moved)
  const done = blockers === null ? rides : resolveRides(map, rides, blockers, radii)
  return new Map(done.filter((r) => r.to.x !== r.token.x || r.to.y !== r.token.y).map((r) => [r.token.id, r.to]))
}
