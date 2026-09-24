import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin, Stair } from '../types/map'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import { findPlayerPinAt } from '../lib/selectionHitTest'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * A escada do JOGADOR de ponta a ponta, do mapa do mestre ao cartão: o recorte
 * (`filterMapForPlayer`), o toque no lance (`findPlayerPinAt`, o mesmo que o
 * `PlayerView` chama) e o cartão aberto com as escadas do recorte (o mesmo que
 * o `Session` de `player/main.tsx` monta). Nada é passado à mão entre as peças.
 */

const RAIO = 300
const POSSE = { p1: ['bruno'] }
const TOLERANCIA = 8

const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'down', segments: [{ x1: 240, y1: 200, x2: 240, y2: 120 }], stepWidth: 40 }
const PINO_DA_ESCADA: Pin = {
  id: 'pino-da-escada',
  x: 240,
  y: 200,
  kind: 'viagem',
  description: '',
  image: null,
  passagem: 'livre',
  destino: { sceneId: 'cena-porao', pinId: 'pino-do-par' },
  escadaId: 'escada',
}
const PINO_COMUM: Pin = { id: 'pino-comum', x: 400, y: 300, kind: 'exclamacao', description: 'Um baú', image: null }
/** O meio do lance: longe da boca, onde o pino invisível mora. */
const MEIO_DO_LANCE = { x: 240, y: 150 }

function mapaDoMestre(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'Térreo', 1000, 1000, 40),
    tokens: [{ id: 'bruno', characterId: null, name: 'Bruno', x: 200, y: 200, size: 1, image: null }],
    stairs: [ESCADA],
    pins,
  }
}

function recorte(pins: Pin[]): MapData {
  return filterMapForPlayer(mapaDoMestre(pins), 'p1', POSSE, RAIO).map
}

describe('escada do jogador: recorte → toque → cartão', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('tocar o meio do lance abre o pino da escada, e o cartão lê "Descer" sem imagem nem texto de ponto de interesse', () => {
    const map = recorte([PINO_DA_ESCADA, PINO_COMUM])
    const pin = findPlayerPinAt(map, MEIO_DO_LANCE, TOLERANCIA)
    if (pin === null) throw new Error('o toque no lance não achou o pino da escada')
    expect(pin.id).toBe('pino-da-escada')

    act(() => root.render(<PlayerPinCard pin={pin} stairs={map.stairs} onClose={() => {}} onRequestTravel={vi.fn()} />))
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Descer')
    expect(container.querySelector('.pp-pincard__text')?.textContent).toBe('Descer')
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).not.toContain('O mestre ainda não escreveu')
    expect(container.textContent).not.toContain('Passar por aqui?')
  })

  it('o pino comum continua se tocando como pino, e o cartão dele é o de ponto de interesse', () => {
    const map = recorte([PINO_DA_ESCADA, PINO_COMUM])
    const pin = findPlayerPinAt(map, { x: 400, y: 295 }, TOLERANCIA)
    expect(pin?.id).toBe('pino-comum')
    if (pin === null) return
    act(() => root.render(<PlayerPinCard pin={pin} stairs={map.stairs} onClose={() => {}} />))
    expect(container.querySelector('.pp-pincard__text')?.textContent).toBe('Um baú')
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('escada sem ligação: está no recorte, mas tocar o lance não abre nada', () => {
    const map = recorte([])
    expect(map.stairs.map((s) => s.id)).toEqual(['escada'])
    expect(findPlayerPinAt(map, MEIO_DO_LANCE, TOLERANCIA)).toBeNull()
  })

  it('o par do outro andar foi desligado (pino sem destino): a escada sai, o toque não abre nada', () => {
    const { destino: _desligado, ...semDestino } = PINO_DA_ESCADA
    const map = recorte([semDestino])
    expect(map.stairs.map((s) => s.id)).toEqual(['escada'])
    expect(map.pins).toEqual([])
    expect(findPlayerPinAt(map, MEIO_DO_LANCE, TOLERANCIA)).toBeNull()
  })

  it('longe de tudo: nada', () => {
    const map = recorte([PINO_DA_ESCADA, PINO_COMUM])
    expect(map.pins).toHaveLength(2)
    expect(findPlayerPinAt(map, { x: 700, y: 700 }, TOLERANCIA)).toBeNull()
  })
})
