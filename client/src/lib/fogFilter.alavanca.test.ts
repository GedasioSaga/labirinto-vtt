/**
 * ALAVANCA no RECORTE DO JOGADOR. O jogador recebe o pino (tipo, descrição,
 * imagem) para poder acioná-lo, mas NUNCA a ligação: qual porta a alavanca
 * move é do mestre. A porta ligada pode estar em outra sala, atrás da névoa —
 * o id dela no pacote diria que ali existe uma porta.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { buildPin, createEmptyMap } from './mapFactory'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x: number, door: Wall['door'] = null): Wall {
  return { id, x1: x, y1: 0, x2: x, y2: 1000, blocksLight: true, blocksMove: true, door }
}

function alavanca(portaLigada: string, extra: Partial<Pin> = {}): Pin {
  return { ...buildPin('alav', { x: 200, y: 200 }, 'alavanca'), description: 'Uma alavanca enferrujada.', portaLigada, ...extra }
}

/** Herói em x=180; muro cego em x=500; o cofre (porta) em x=800, fora da vista. */
function mapa(pins: Pin[], walls: Wall[]): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), tokens: [ficha('heroi', 180, 200)], pins, walls }
}

const DONOS = { p1: ['heroi'] }
const RAIO = 700
const PORTA_FECHADA = { open: false, locked: false, kind: 'normal' } as const // literal: `kind` fica 'normal' (DoorKind), não string

describe('filterMapForPlayer — alavanca', () => {
  it('o pino chega como alavanca, sem a porta ligada', () => {
    const map = mapa([alavanca('porta-cofre-9f3a')], [parede('muro', 500), parede('porta-cofre-9f3a', 800, PORTA_FECHADA)])
    const out = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    const pino = out.map.pins.find((p) => p.id === 'alav')
    expect(pino?.kind).toBe('alavanca')
    expect(pino?.description).toBe('Uma alavanca enferrujada.')
    expect(pino !== undefined && 'portaLigada' in pino).toBe(false)
  })

  it('SEGURANÇA: a porta ligada atrás da névoa não aparece em lugar nenhum do pacote', () => {
    const map = mapa([alavanca('porta-cofre-9f3a')], [parede('muro', 500), parede('porta-cofre-9f3a', 800, PORTA_FECHADA)])
    const texto = JSON.stringify(filterMapForPlayer(map, 'p1', DONOS, RAIO))
    expect(texto).toContain('"alavanca"')
    expect(texto).not.toContain('porta-cofre-9f3a')
    expect(texto).not.toContain('portaLigada')
  })

  it('SEGURANÇA: mesmo com a porta ligada à vista, o pino não diz QUAL porta ele move', () => {
    const map = mapa([alavanca('porta-perto')], [parede('porta-perto', 400, PORTA_FECHADA)])
    const out = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    // A porta vem (ela está à vista), a ligação não.
    expect(out.map.walls.some((w) => w.id === 'porta-perto')).toBe(true)
    expect(JSON.stringify(out.map.pins)).not.toContain('porta-perto')
  })

  it('alavanca oculta para jogadores não chega, nem a descrição dela', () => {
    const map = mapa([alavanca('porta-cofre-9f3a', { secret: true })], [parede('porta-cofre-9f3a', 800, PORTA_FECHADA)])
    const out = filterMapForPlayer(map, 'p1', DONOS, RAIO)
    expect(out.map.pins).toEqual([])
    expect(JSON.stringify(out)).not.toContain('enferrujada')
  })
})
