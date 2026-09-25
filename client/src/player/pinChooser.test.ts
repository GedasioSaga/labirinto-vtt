// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Stair } from '../types/map'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import { findPinsAt } from '../lib/pins'
import { findPlayerPinsAt } from '../lib/selectionHitTest'
import { escolhaDoToque, rotuloNaEscolha, tituloDaEscolha } from './pinChooser'

/**
 * DOIS PINOS NO MESMO PONTO (relato da torre, n 484/511/627): o toque do
 * jogador só abria o de cima, e o de baixo ficava inalcançável em qualquer
 * zoom. Agora o toque junta TODOS os pinos sob o dedo, a partir do mapa do
 * RECORTE — o que a névoa, a zona oculta ou o mestre escondem nunca entra na
 * lista, nem como contagem ("Aqui há 2 coisas" com uma delas secreta diria
 * que há algo ali).
 */

const RAIO = 300
const POSSE = { p1: ['bruno'] }
const TOLERANCIA = 18

const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'down', segments: [{ x1: 240, y1: 200, x2: 240, y2: 120 }], stepWidth: 40 }

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: '', image: null, ...extra }
}

function mapaDoMestre(pins: Pin[], stairs: Stair[] = []): MapData {
  return {
    ...createEmptyMap('m', 'Térreo', 1000, 1000, 40),
    tokens: [{ id: 'bruno', characterId: null, name: 'Bruno', x: 200, y: 200, size: 1, image: null }],
    stairs,
    pins,
  }
}

function recorte(pins: Pin[], stairs: Stair[] = []): MapData {
  return filterMapForPlayer(mapaDoMestre(pins, stairs), 'p1', POSSE, RAIO).map
}

function tocar(map: MapData, point: { x: number; y: number }): string[] {
  return findPlayerPinsAt({ stairs: map.stairs, pins: map.pins, hiddenLayers: map.hiddenLayers }, point, TOLERANCIA).map((p) => p.id)
}

/** A cabeça do pino cravado em (x, y): onde o dedo cai quando toca o desenho. */
const CABECA = { x: 300, y: 300 - 23 }

describe('findPinsAt: todos os pinos sob o ponto', () => {
  it('dois pinos cravados no mesmo ponto: os dois voltam, o de cima primeiro', () => {
    const pins = [pino('baixo', 300, 300), pino('cima', 300, 300)]
    expect(findPinsAt(pins, CABECA, TOLERANCIA).map((p) => p.id)).toEqual(['cima', 'baixo'])
  })

  it('pinos vizinhos dentro da folga do dedo: do mais perto ao mais longe', () => {
    const pins = [pino('perto', 300, 300), pino('longe', 312, 300)]
    // O dedo cai um pouco à esquerda da cabeça do "perto": o "longe" fica mais distante.
    expect(findPinsAt(pins, { x: 296, y: 277 }, TOLERANCIA).map((p) => p.id)).toEqual(['perto', 'longe'])
  })

  it('fora da folga, nada', () => {
    expect(findPinsAt([pino('a', 300, 300)], { x: 500, y: 500 }, TOLERANCIA)).toEqual([])
  })
})

describe('toque do jogador no recorte: só o que ele pode ver entra na lista', () => {
  it('dois pinos à vista no mesmo ponto: o toque junta os dois', () => {
    const map = recorte([pino('relogio', 300, 300, { description: 'Relógio de volta' }), pino('luneta', 300, 300, { description: 'Uma luneta' })])
    expect(tocar(map, CABECA)).toEqual(['luneta', 'relogio'])
  })

  it('pino SECRETO no mesmo ponto não chega ao jogador e não conta na lista', () => {
    const mestre = [pino('visivel', 300, 300, { description: 'Um baú' }), pino('secreto', 300, 300, { description: 'O cofre do vilão', secret: true })]
    const map = recorte(mestre)
    expect(map.pins.map((p) => p.id)).toEqual(['visivel'])
    expect(JSON.stringify(map)).not.toContain('O cofre do vilão')
    expect(tocar(map, CABECA)).toEqual(['visivel'])
    expect(escolhaDoToque(tocar(map, CABECA))).toEqual({ tipo: 'abrir', pinId: 'visivel' })
  })

  it('pino OCULTO pelo mestre no mesmo ponto também fica fora', () => {
    const map = recorte([pino('visivel', 300, 300), pino('oculto', 300, 300, { hidden: true, description: 'Escondido' })])
    expect(tocar(map, CABECA)).toEqual(['visivel'])
    expect(JSON.stringify(map)).not.toContain('Escondido')
  })

  it('pino sob a névoa, colado num pino à vista, não entra', () => {
    // O "longe" está a 900 px da ficha, fora do raio de visão: a névoa o cobre.
    const map = recorte([pino('perto', 300, 300), pino('na-nevoa', 900, 900, { description: 'Na névoa' })])
    expect(map.pins.map((p) => p.id)).toEqual(['perto'])
    expect(tocar(map, { x: 900, y: 877 })).toEqual([])
    expect(JSON.stringify(map)).not.toContain('Na névoa')
  })

  it('pino de escada no mesmo lugar de um pino comum: os dois entram, a escada depois', () => {
    const escadaPin = pino('pino-da-escada', 240, 200, {
      kind: 'viagem',
      passagem: 'livre',
      destino: { sceneId: 'cena-porao', pinId: 'par' },
      escadaId: 'escada',
    })
    const map = recorte([escadaPin, pino('comum', 240, 170, { description: 'Um baú' })], [ESCADA])
    expect(tocar(map, { x: 240, y: 150 })).toEqual(['comum', 'pino-da-escada'])
  })
})

describe('escolhaDoToque: o que o toque faz', () => {
  it('nenhum pino: nada', () => {
    expect(escolhaDoToque([])).toEqual({ tipo: 'nada' })
  })
  it('um pino: abre o cartão direto, como sempre', () => {
    expect(escolhaDoToque(['a'])).toEqual({ tipo: 'abrir', pinId: 'a' })
  })
  it('dois ou mais: abre a escolha, na mesma ordem', () => {
    expect(escolhaDoToque(['a', 'b'])).toEqual({ tipo: 'escolher', pinIds: ['a', 'b'] })
  })
})

describe('rótulo de cada linha e título da escolha', () => {
  it('título conta as coisas', () => {
    expect(tituloDaEscolha(2)).toBe('Aqui há 2 coisas')
    expect(tituloDaEscolha(3)).toBe('Aqui há 3 coisas')
    expect(tituloDaEscolha(1)).toBe('Aqui há 1 coisa')
  })

  it('as primeiras palavras da descrição, com reticências quando corta', () => {
    const longo = pino('p1ch', 0, 0, { description: 'Relógio de volta, luneta e espelho de sinal. Está impecável demais para um lugar abandonado.' })
    const rotulo = rotuloNaEscolha(longo, [])
    expect(rotulo.startsWith('Relógio de volta, luneta')).toBe(true)
    expect(rotulo.endsWith('…')).toBe(true)
    expect(rotulo.length).toBeLessThanOrEqual(41)
    expect(rotulo.length).toBeGreaterThan(10)
  })

  it('descrição curta sai inteira; só a primeira linha', () => {
    expect(rotuloNaEscolha(pino('a', 0, 0, { description: 'Um baú\nCom cadeado' }), [])).toBe('Um baú')
  })

  it('sem descrição: o símbolo ou o tipo do pino', () => {
    expect(rotuloNaEscolha(pino('a', 0, 0, { icon: 'bau' }), [])).toBe('Baú')
    expect(rotuloNaEscolha(pino('a', 0, 0), [])).toBe('Ponto de interesse')
    expect(rotuloNaEscolha(pino('a', 0, 0, { kind: 'viagem' }), [])).toBe('Passagem')
    expect(rotuloNaEscolha(pino('a', 0, 0, { kind: 'alavanca' }), [])).toBe('Alavanca')
  })

  it('pino de escada é o sentido dela, nunca o nome do andar', () => {
    const map = recorte(
      [pino('pino-da-escada', 240, 200, { kind: 'viagem', passagem: 'livre', destino: { sceneId: 'cena-porao', pinId: 'par' }, escadaId: 'escada' })],
      [ESCADA],
    )
    const escadaPin = map.pins.find((p) => p.id === 'pino-da-escada')
    expect(escadaPin).toBeDefined()
    if (escadaPin === undefined) return
    expect(rotuloNaEscolha(escadaPin, map.stairs)).toBe('Descer')
    expect(JSON.stringify(escadaPin)).not.toContain('cena-porao')
  })
})
