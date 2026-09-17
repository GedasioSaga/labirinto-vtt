import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS, PIN_HEIGHT, findPinAt, isPlayerSafePinImage, pinSummary } from './pins'

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: '', image: null, ...extra }
}

const UMA_IMAGEM = 'data:image/webp;base64,UklGRg=='
const UM_CAMINHO = 'C:\\Users\\mestre\\AppData\\Roaming\\labirinto\\maps\\m1\\pino.webp'

describe('findPinAt', () => {
  const alvo = pino('p1', 200, 300)

  it('a ponta cravada é o ponto clicado', () => {
    expect(findPinAt([alvo], { x: 200, y: 300 })?.id).toBe('p1')
  })

  it('a cabeça acima da ponta também acerta', () => {
    expect(findPinAt([alvo], { x: 200, y: 300 - PIN_HEAD_OFFSET })?.id).toBe('p1')
    expect(findPinAt([alvo], { x: 200 + PIN_HEAD_RADIUS - 1, y: 300 - PIN_HEAD_OFFSET })?.id).toBe('p1')
  })

  it('longe do desenho não acerta nada', () => {
    expect(findPinAt([alvo], { x: 200, y: 300 + 40 })).toBeNull()
    expect(findPinAt([alvo], { x: 200 + 60, y: 300 - PIN_HEAD_OFFSET })).toBeNull()
    expect(findPinAt([alvo], { x: 200, y: 300 - PIN_HEIGHT - 40 })).toBeNull()
  })

  it('a folga do dedo aumenta o alvo sem mudar o desenho', () => {
    const quaseFora = { x: 200 + PIN_HEAD_RADIUS + 4, y: 300 - PIN_HEAD_OFFSET }
    expect(findPinAt([alvo], quaseFora)).toBeNull()
    expect(findPinAt([alvo], quaseFora, 6)?.id).toBe('p1')
  })

  it('pinos empilhados: ganha o desenhado por último, que é o que está por cima', () => {
    const debaixo = pino('velho', 200, 300)
    const emCima = pino('novo', 200, 300, { kind: 'interrogacao' })
    expect(findPinAt([debaixo, emCima], { x: 200, y: 300 })?.id).toBe('novo')
  })

  it('lista vazia devolve null em vez de estourar', () => {
    expect(findPinAt([], { x: 0, y: 0 })).toBeNull()
  })
})

describe('isPlayerSafePinImage', () => {
  it('data URL de imagem passa', () => {
    expect(isPlayerSafePinImage(UMA_IMAGEM)).toBe(true)
  })

  it('caminho do disco do mestre e ausência de imagem não passam', () => {
    expect(isPlayerSafePinImage(UM_CAMINHO)).toBe(false)
    expect(isPlayerSafePinImage('/home/mestre/pino.webp')).toBe(false)
    expect(isPlayerSafePinImage('file:///C:/mapas/pino.webp')).toBe(false)
    expect(isPlayerSafePinImage(null)).toBe(false)
  })
})

describe('pinSummary', () => {
  it('sem descrição, diz o tipo', () => {
    expect(pinSummary(pino('p1', 0, 0))).toBe('Ponto de interesse !')
    expect(pinSummary(pino('p2', 0, 0, { kind: 'interrogacao' }))).toBe('Ponto de interesse ?')
  })

  it('com descrição, é a descrição', () => {
    expect(pinSummary(pino('p1', 0, 0, { description: '  Estátua rachada  ' }))).toBe('Estátua rachada')
  })
})

describe('recorte do pino para o jogador', () => {
  const RAIO = 300
  const POSSE = { p1: ['heroi'] }

  function mapaCom(pins: Pin[]) {
    return {
      ...createEmptyMap('m', 'M', 1000, 1000, 40),
      tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
      pins,
    }
  }

  it('pino perto do token sai; pino fora da visão não sai', () => {
    const { map } = filterMapForPlayer(mapaCom([pino('perto', 240, 200), pino('longe', 950, 950)]), 'p1', POSSE, RAIO)
    expect(map.pins.map((p) => p.id)).toEqual(['perto'])
  })

  it('pino com todo campo opcional ausente atravessa inteiro, com a descrição do mestre', () => {
    const { map } = filterMapForPlayer(mapaCom([pino('perto', 240, 200, { description: 'Estátua rachada' })]), 'p1', POSSE, RAIO)
    expect(map.pins[0]).toEqual({ id: 'perto', x: 240, y: 200, kind: 'exclamacao', description: 'Estátua rachada', image: null })
  })

  it('imagem em data URL chega ao jogador; caminho de disco vira null', () => {
    const { map } = filterMapForPlayer(
      mapaCom([pino('foto', 240, 200, { image: UMA_IMAGEM }), pino('disco', 220, 220, { image: UM_CAMINHO })]),
      'p1',
      POSSE,
      RAIO,
    )
    expect(map.pins.find((p) => p.id === 'foto')?.image).toBe(UMA_IMAGEM)
    expect(map.pins.find((p) => p.id === 'disco')?.image).toBeNull()
  })

  it('camada Anotações oculta tira todos os pinos', () => {
    const base = mapaCom([pino('perto', 240, 200)])
    const { map } = filterMapForPlayer({ ...base, hiddenLayers: ['anotacoes'] }, 'p1', POSSE, RAIO)
    expect(map.pins).toEqual([])
  })
})
