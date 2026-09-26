import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { filterMapForPlayer } from './fogFilter'
import { amarradosPorEstado, aplicarEstadoNoMapa, contarAmarrados, contarMudancas } from './estadoDoMundo'
import type { Light, MapData } from '../types/map'

/**
 * ESTADO DO MUNDO nas LUZES — "Energia: ligada | desligada". O apagão apaga as
 * lâmpadas amarradas em todas as cenas; religar acende de novo. O jogador
 * recebe só a luz acesa, sem a regra.
 */
const ENERGIA = 'estado_energia'

function lampada(extra: Partial<Light> = {}): Light {
  return {
    id: 'lampada',
    x: 200,
    y: 200,
    radius: 120,
    color: '#ffdd88',
    intensity: 1,
    porEstado: {
      estadoId: ENERGIA,
      efeitos: [
        { valor: 'ligada', efeito: 'acesa' },
        { valor: 'desligada', efeito: 'apagada' },
      ],
    },
    ...extra,
  }
}

function tocha(): Light {
  return { id: 'tocha', x: 300, y: 200, radius: 80, color: '#ff8800', intensity: 1 }
}

function salaDasMaquinas(extra: Partial<Light> = {}): MapData {
  return { ...createEmptyMap('map_maquinas', 'Sala das máquinas', 1000, 1000, 50), lights: [lampada(extra), tocha()] }
}

/** A sala com a Gabi (do jogador 'p') no meio, vendo as duas luzes. */
function comAGabi(map: MapData): MapData {
  return { ...map, tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 250, y: 250, size: 1, image: null }] }
}

function luzesDoJogador(map: MapData): Light[] {
  return filterMapForPlayer(comAGabi(map), 'p', { p: ['t'] }, 400).map.lights
}

describe('aplicarEstadoNoMapa nas luzes: a energia desligada apaga a lâmpada amarrada', () => {
  it('desligada: a lâmpada fica apagada e a tocha solta não muda nem de referência', () => {
    const antes = salaDasMaquinas()
    const depois = aplicarEstadoNoMapa(antes, ENERGIA, 'desligada')
    expect(depois.lights.find((l) => l.id === 'lampada')?.apagada).toBe(true)
    expect(depois.lights.find((l) => l.id === 'tocha')).toBe(antes.lights.find((l) => l.id === 'tocha'))
    // A regra continua lá: religar precisa dela.
    expect(depois.lights.find((l) => l.id === 'lampada')?.porEstado?.estadoId).toBe(ENERGIA)
  })

  it('ligada de novo: a lâmpada acende e perde o campo (luz acesa grava igual à de antes)', () => {
    const apagada = aplicarEstadoNoMapa(salaDasMaquinas(), ENERGIA, 'desligada')
    const acesa = aplicarEstadoNoMapa(apagada, ENERGIA, 'ligada')
    const luz = acesa.lights.find((l) => l.id === 'lampada')
    expect(luz?.apagada).toBeUndefined()
    expect(luz !== undefined && 'apagada' in luz).toBe(false)
  })

  it('já no efeito: devolve o MESMO mapa', () => {
    const antes = salaDasMaquinas()
    expect(aplicarEstadoNoMapa(antes, ENERGIA, 'ligada')).toBe(antes)
  })

  it('a luz conta nas mudanças e nos amarrados', () => {
    expect(contarMudancas(salaDasMaquinas(), ENERGIA, 'desligada')).toBe(1)
    expect(contarMudancas(salaDasMaquinas(), ENERGIA, 'ligada')).toBe(0)
    expect(contarAmarrados(salaDasMaquinas(), ENERGIA)).toBe(1)
    expect(amarradosPorEstado([salaDasMaquinas(), salaDasMaquinas()]).get(ENERGIA)).toBe(2)
  })
})

describe('arquivo da cena: luz apagada e regra da luz vão e voltam', () => {
  it('a regra e o apagada voltam iguais do disco', () => {
    const map = aplicarEstadoNoMapa(salaDasMaquinas(), ENERGIA, 'desligada')
    const lida = deserializeMap(serializeMap(map)).lights.find((l) => l.id === 'lampada')
    expect(lida?.apagada).toBe(true)
    expect(lida?.porEstado).toEqual(lampada().porEstado)
  })

  it('luz de mapa antigo abre sem os campos novos', () => {
    const lida = deserializeMap(serializeMap({ ...salaDasMaquinas(), lights: [tocha()] })).lights[0]
    expect(lida).toEqual(tocha())
    expect('porEstado' in lida).toBe(false)
    expect('apagada' in lida).toBe(false)
  })

  it('regra torta e apagada que não é booleano (arquivo editado à mão) somem: a luz volta a ser a de sempre', () => {
    const json = JSON.stringify({ ...salaDasMaquinas(), lights: [{ ...tocha(), apagada: 'sim', porEstado: { estadoId: ENERGIA, efeitos: [{ valor: 'x', efeito: 'piscando' }] } }] })
    const lida = deserializeMap(json).lights[0]
    expect(lida.id).toBe('tocha')
    expect('porEstado' in lida).toBe(false)
    expect('apagada' in lida).toBe(false)
  })
})

describe('recorte do jogador: luz apagada não vai, e a regra nunca vai', () => {
  it('apagada: o jogador não recebe a lâmpada; a tocha acesa vai', () => {
    const map = aplicarEstadoNoMapa(salaDasMaquinas(), ENERGIA, 'desligada')
    expect(luzesDoJogador(map).map((l) => l.id)).toEqual(['tocha'])
  })

  it('acesa: a lâmpada vai sem porEstado, e o JSON não cita o estado nem os valores', () => {
    const luzes = luzesDoJogador(salaDasMaquinas())
    expect(luzes.map((l) => l.id)).toEqual(['lampada', 'tocha'])
    expect(luzes[0]).toEqual({ id: 'lampada', x: 200, y: 200, radius: 120, color: '#ffdd88', intensity: 1 })
    const json = JSON.stringify(luzes)
    expect(json.includes(ENERGIA)).toBe(false)
    expect(json.includes('desligada')).toBe(false)
  })
})
