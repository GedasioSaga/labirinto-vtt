/**
 * "Enviar para cena ›" — a parte pura (`lib/enviarParaCena.ts`): o pino de
 * chegada, a casa sem pino (nunca dentro de parede) e a lista de cenas do
 * submenu. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { Adventure } from './adventure'
import type { MapData, Pin, Wall } from '../types/map'
import { addPin, addWall, createEmptyMap } from './mapFactory'
import { arrivalPoint } from './pinTravel'
import { MOTIVO_SO_UMA_CENA, casaDeChegada, opcoesDoEnvio, pinoDeChegada } from './enviarParaCena'

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 640, y: 320, kind: 'viagem', description: '', image: null, destino: null, ...extra }
}

function aventura(nomes: readonly string[]): Adventure {
  return {
    version: 1,
    id: 'adv',
    name: 'Ilha',
    startSceneId: 's0',
    scenes: nomes.map((nome, i) => ({ id: `s${i}`, name: nome, file: `s${i}.json` })),
  }
}

describe('pino de chegada', () => {
  it('é o primeiro pino de viagem visível: pula o escondido, o secreto e o que não é de viagem', () => {
    let map: MapData = createEmptyMap('m', 'Vila', 20, 20, 64)
    map = addPin(map, pino('marcador', { kind: 'exclamacao' }))
    map = addPin(map, pino('escondido', { hidden: true }))
    map = addPin(map, pino('secreto', { secret: true }))
    map = addPin(map, pino('porta-da-vila'))
    map = addPin(map, pino('outro'))
    expect(pinoDeChegada(map)?.id).toBe('porta-da-vila')
    expect(pinoDeChegada(createEmptyMap('v', 'Vazia', 20, 20, 64))).toBeNull()
  })

  it('sem pino, a ficha chega no centro; com parede cortando o centro, na casa livre mais perto, fora da parede', () => {
    const vazio = createEmptyMap('m', 'Campo', 20, 20, 64)
    expect(casaDeChegada(vazio, null, 1, 'zumbi')).toEqual(arrivalPoint(vazio))

    const centro = arrivalPoint(vazio)
    const parede: Wall = { id: 'muro', x1: centro.x, y1: 0, x2: centro.x, y2: 20 * 64, blocksLight: true, blocksMove: true, door: null }
    const comMuro = addWall(vazio, parede)
    const casa = casaDeChegada(comMuro, null, 1, 'zumbi')
    // Fora da parede: a meia casa dela, no mínimo, e ainda a uma casa do centro.
    expect(Math.abs(casa.x - centro.x)).toBeGreaterThanOrEqual(32)
    expect(Math.hypot(casa.x - centro.x, casa.y - centro.y)).toBeLessThanOrEqual(64 * 1.5)
  })
})

describe('cenas do submenu', () => {
  it('lista as outras cenas na ordem, sem a aberta; a que ainda abre vem desligada com o motivo', () => {
    const opcoes = opcoesDoEnvio(aventura(['Vila', 'Porão', 'Torre']), 's0', { s1: { status: 'ok' }, s2: { status: 'carregando' } })
    expect(opcoes.motivo).toBeNull()
    expect(opcoes.cenas).toEqual([
      { id: 's1', nome: 'Porão', motivo: null, estado: null },
      { id: 's2', nome: 'Torre', motivo: 'Esta cena ainda está abrindo.', estado: 'abrindo' },
    ])
  })

  it('mapa de uma cena só (ou mapa solto): nenhuma cena, e o item desligado diz por quê', () => {
    expect(opcoesDoEnvio(aventura(['Vila']), 's0', {})).toEqual({ cenas: [], motivo: MOTIVO_SO_UMA_CENA })
    expect(opcoesDoEnvio(null, null, {})).toEqual({ cenas: [], motivo: MOTIVO_SO_UMA_CENA })
  })
})
