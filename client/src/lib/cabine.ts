import type { CabineNaParada, PinDestination } from '../types/map'
import { readPinDestination, sameDestination } from './pinTravel'

/**
 * CABINE DE TRANSPORTE — elevador, paternoster, cesto: um pino de viagem que
 * só leva quando a cabine está nele. Plano: `docs/planos/cabine-de-transporte-p.md`.
 *
 * A cabine mora na AVENTURA (`Adventure.cabines`), porque cruza cenas e tem
 * uma posição só; o `map.json` da cena não muda. As regras aqui são puras: sem
 * store, sem DOM, sem rede.
 */

export interface CabineDeTransporte {
  /** Estável: é o que o painel e o host citam. Nunca vai ao jogador. */
  id: string
  /** "Espinha" — só do mestre; nunca vai ao jogador. */
  nome: string
  /** As paradas (cena + pino de viagem), na ordem, sem repetir. */
  paradas: PinDestination[]
  /** A parada onde a cabine está, sempre uma de `paradas`; `null` = em lugar nenhum. */
  atual: PinDestination | null
}

/** A cabine anda: a posição nova de `cabineId`, que o integrador grava na aventura. */
export interface MovimentoDeCabine {
  cabineId: string
  parada: PinDestination
}

/** Teto do nome no painel: cabe na linha da lista sem quebrar. */
export const CABINE_NOME_MAX = 40

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function temParada(paradas: readonly PinDestination[], parada: PinDestination): boolean {
  return paradas.some((p) => sameDestination(p, parada))
}

/**
 * Leitura do `adventure.json`. Ausente = aventura antiga, que continua sem a
 * chave. Cabine sem id (ou com id repetido) sai; parada fora da forma ou
 * repetida sai; `atual` que não é parada dela vira `null` — nunca uma cabine
 * "aqui" num pino que não é parada.
 */
export function cabinesDoArquivo(raw: unknown): CabineDeTransporte[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const cabines: CabineDeTransporte[] = []
  for (const bruta of raw) {
    if (!isRecord(bruta)) continue
    const { id, nome, paradas, atual } = bruta
    if (typeof id !== 'string' || id.length === 0 || cabines.some((c) => c.id === id)) continue
    const limpas: PinDestination[] = []
    for (const p of Array.isArray(paradas) ? paradas : []) {
      const parada = readPinDestination(p)
      if (parada !== null && !temParada(limpas, parada)) limpas.push(parada)
    }
    const lida = readPinDestination(atual)
    cabines.push({
      id,
      nome: typeof nome === 'string' && nome.trim().length > 0 ? nome.trim().slice(0, CABINE_NOME_MAX) : id,
      paradas: limpas,
      atual: lida !== null && temParada(limpas, lida) ? lida : null,
    })
  }
  return cabines
}

/** A cabine de que o pino `pinId` da cena `sceneId` é parada; `null` = não é parada (ou mapa solto). */
export function cabineDaParada(cabines: readonly CabineDeTransporte[] | undefined, sceneId: string | null, pinId: string): CabineDeTransporte | null {
  if (cabines === undefined || sceneId === null) return null
  const parada = { sceneId, pinId }
  return cabines.find((c) => temParada(c.paradas, parada)) ?? null
}

/** O que a parada diz: a cabine está `aqui` ou `longe`. `null` = o pino não é parada. */
export function cabineNaParada(cabines: readonly CabineDeTransporte[] | undefined, sceneId: string | null, pinId: string): CabineNaParada | null {
  const cabine = cabineDaParada(cabines, sceneId, pinId)
  if (cabine === null || sceneId === null) return null
  return sameDestination(cabine.atual, { sceneId, pinId }) ? 'aqui' : 'longe'
}

/**
 * Quem passa de uma parada com a cabine para outra parada DA MESMA cabine
 * leva a cabine: ela passa a estar na chegada. Qualquer outra viagem não
 * mexe em cabine nenhuma (`null`).
 */
export function cabineAposViagem(cabines: readonly CabineDeTransporte[] | undefined, de: PinDestination, para: PinDestination): MovimentoDeCabine | null {
  const cabine = cabineDaParada(cabines, de.sceneId, de.pinId)
  if (cabine === null || !sameDestination(cabine.atual, de) || !temParada(cabine.paradas, para)) return null
  return { cabineId: cabine.id, parada: { sceneId: para.sceneId, pinId: para.pinId } }
}

/** Uma cabine nova com `parada` como primeira parada e a cabine nela. Nome vazio: `null`. */
export function novaCabine(nome: string, parada: PinDestination, id: string = `cabine_${crypto.randomUUID()}`): CabineDeTransporte | null {
  const limpo = nome.trim().slice(0, CABINE_NOME_MAX)
  if (limpo.length === 0) return null
  const aqui = { sceneId: parada.sceneId, pinId: parada.pinId }
  return { id, nome: limpo, paradas: [aqui], atual: aqui }
}

/**
 * `parada` passa a ser da cabine `cabineId` (`null` = de nenhuma) e sai de
 * qualquer outra. A cabine que perde a parada onde estava vai para a primeira
 * que sobrou; a que ganha a primeira parada recebe a cabine nela. `null`
 * quando nada muda — quem grava não suja a aventura à toa.
 */
export function comParada(cabines: readonly CabineDeTransporte[], parada: PinDestination, cabineId: string | null): CabineDeTransporte[] | null {
  const dona = cabines.find((c) => temParada(c.paradas, parada))
  if ((dona?.id ?? null) === cabineId) return null
  if (cabineId !== null && !cabines.some((c) => c.id === cabineId)) return null
  const aqui = { sceneId: parada.sceneId, pinId: parada.pinId }
  return cabines.map((c) => {
    if (c.id === cabineId) {
      const paradas = [...c.paradas, aqui]
      return { ...c, paradas, atual: c.atual ?? aqui }
    }
    if (c === dona) {
      const paradas = c.paradas.filter((p) => !sameDestination(p, parada))
      return { ...c, paradas, atual: sameDestination(c.atual, parada) ? (paradas[0] ?? null) : c.atual }
    }
    return c
  })
}

/** A cabine `cabineId` passa a estar em `parada`, que tem de ser dela. `null` quando não dá ou ela já está lá. */
export function comCabineEm(cabines: readonly CabineDeTransporte[], cabineId: string, parada: PinDestination): CabineDeTransporte[] | null {
  const cabine = cabines.find((c) => c.id === cabineId)
  if (cabine === undefined || !temParada(cabine.paradas, parada) || sameDestination(cabine.atual, parada)) return null
  return cabines.map((c) => (c.id === cabineId ? { ...c, atual: { sceneId: parada.sceneId, pinId: parada.pinId } } : c))
}
