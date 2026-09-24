import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import {
  PIN_HEAD_OFFSET,
  PIN_HEAD_RADIUS,
  PIN_HEIGHT,
  PIN_ICON_LABELS,
  PIN_ICON_ORDER,
  PIN_KIND_ORDER,
  PIN_MIN_SCREEN_HEIGHT,
  PIN_SYMBOLS,
  PIN_TAP_MAX_HEAD_RADII,
  PIN_TRAVEL_SYMBOL,
  findPinAt,
  isPinIcon,
  isPinKind,
  isPinPassage,
  isPlayerSafePinImage,
  passageOf,
  pinSizeScale,
  pinSummary,
  pinTapTolerance,
} from './pins'

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

  it('pino crescido (tamanho mínimo de tela): a cabeça desenhada lá em cima acerta, e só com o fator', () => {
    const fator = 4
    const cabecaCrescida = { x: 200, y: 300 - PIN_HEAD_OFFSET * fator }
    expect(findPinAt([alvo], cabecaCrescida, 0, fator)?.id).toBe('p1')
    expect(findPinAt([alvo], { x: 200 + PIN_HEAD_RADIUS * fator - 1, y: cabecaCrescida.y }, 0, fator)?.id).toBe('p1')
    // Sem o fator, o mesmo ponto fica acima do pino de tamanho de mundo.
    expect(findPinAt([alvo], cabecaCrescida)).toBeNull()
  })
})

/**
 * PINO NO ZOOM AFASTADO (relato dos jogadores, torre-lote-5 #485 e #517): o pino
 * era desenhado em px de mundo e sumia na tela, mas a folga do toque era fixa em
 * px de tela — um toque a várias casas abria um pino que ninguém via.
 */
describe('pino com tamanho mínimo no zoom afastado', () => {
  it('perto (zoom 1 ou mais) o pino não muda de tamanho', () => {
    expect(pinSizeScale(1)).toBe(1)
    expect(pinSizeScale(2)).toBe(1)
    // Exatamente no limiar ainda é o tamanho de mundo.
    expect(pinSizeScale(PIN_MIN_SCREEN_HEIGHT / PIN_HEIGHT)).toBe(1)
  })

  it('longe, o pino cresce no mundo e fica com a altura mínima na tela', () => {
    for (const escala of [0.3, 0.1, 0.05]) {
      const fator = pinSizeScale(escala)
      expect(fator).toBeGreaterThan(1)
      expect(PIN_HEIGHT * fator * escala).toBeCloseTo(PIN_MIN_SCREEN_HEIGHT, 9)
    }
  })

  it('escala inválida (zero, negativa, NaN, infinita) não explode o desenho: tamanho de mundo', () => {
    expect(pinSizeScale(0)).toBe(1)
    expect(pinSizeScale(-1)).toBe(1)
    expect(pinSizeScale(Number.NaN)).toBe(1)
    expect(pinSizeScale(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('perto, a folga do toque é a de sempre (px de tela / zoom)', () => {
    expect(pinTapTolerance(18, 1)).toBe(18)
    expect(pinTapTolerance(6, 0.1)).toBeCloseTo(60, 9)
    expect(pinTapTolerance(6, 0.1)).toBeGreaterThan(0)
  })

  it('longe, a folga nunca passa de alguns raios da cabeça DESENHADA', () => {
    const escala = 0.1
    const cabecaNaTela = PIN_HEAD_RADIUS * pinSizeScale(escala) * escala
    const folgaNaTela = pinTapTolerance(18, escala) * escala
    expect(folgaNaTela).toBeGreaterThan(0)
    expect(folgaNaTela).toBeCloseTo(cabecaNaTela * PIN_TAP_MAX_HEAD_RADII, 9)
    expect(folgaNaTela).toBeLessThan(18)
  })

  it('escala inválida não dá folga nenhuma (nem infinita)', () => {
    expect(pinTapTolerance(18, 0)).toBe(0)
    expect(pinTapTolerance(18, Number.NaN)).toBe(0)
  })

  it('a 5% de zoom (cena inteira na janela): um toque a 7 casas do pino não abre nada, e a cabeça desenhada abre', () => {
    const escala = 0.05
    const casa = 40
    const alvo = pino('p1', 2000, 2000)
    const fator = pinSizeScale(escala)
    const folga = pinTapTolerance(18, escala)
    const seteCasas = { x: alvo.x - 7 * casa, y: alvo.y }
    expect(findPinAt([alvo], seteCasas, folga, fator)).toBeNull()
    // Antes: tamanho de mundo e 18 px de tela de folga — o mesmo toque abria o pino invisível.
    expect(findPinAt([alvo], seteCasas, 18 / escala)?.id).toBe('p1')
    expect(findPinAt([alvo], { x: alvo.x, y: alvo.y - PIN_HEAD_OFFSET * fator }, folga, fator)?.id).toBe('p1')
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

describe('ícone do ponto de interesse', () => {
  it('os seis ícones pedidos têm rótulo, ordem e forma', () => {
    expect(PIN_ICON_ORDER).toEqual(['bau', 'armadilha', 'chave', 'perigo', 'escada', 'agua'])
    for (const icon of PIN_ICON_ORDER) {
      expect(PIN_ICON_LABELS[icon].length, icon).toBeGreaterThan(0)
      expect(PIN_SYMBOLS[icon].strokes.length, icon).toBeGreaterThan(0)
    }
  })

  it('ícone desconhecido não passa pela guarda — é o que impede o render de quebrar', () => {
    expect(isPinIcon('bau')).toBe(true)
    expect(isPinIcon('armadilha')).toBe(true)
    expect(isPinIcon('dragao')).toBe(false)
    expect(isPinIcon('')).toBe(false)
    expect(isPinIcon(undefined)).toBe(false)
    expect(isPinIcon(null)).toBe(false)
    expect(isPinIcon(7)).toBe(false)
  })

  it('dois ícones diferentes são desenhos diferentes: nenhuma forma se repete', () => {
    const desenhos = PIN_ICON_ORDER.map((icon) => JSON.stringify(PIN_SYMBOLS[icon]))
    expect(new Set(desenhos).size).toBe(PIN_ICON_ORDER.length)
  })

  it('toda forma cabe dentro da cabeça: nenhum ponto passa de 1 no quadrado normalizado', () => {
    for (const icon of PIN_ICON_ORDER) {
      const forma = PIN_SYMBOLS[icon]
      for (const stroke of forma.strokes) {
        expect(stroke.points.length, icon).toBeGreaterThan(1)
        for (const ponto of stroke.points) {
          expect(Math.abs(ponto.x), `${icon} x`).toBeLessThanOrEqual(1)
          expect(Math.abs(ponto.y), `${icon} y`).toBeLessThanOrEqual(1)
        }
      }
      for (const circulo of [...(forma.rings ?? []), ...(forma.dots ?? [])]) {
        expect(circulo.r, `${icon} r`).toBeGreaterThan(0)
        expect(Math.abs(circulo.x) + circulo.r, `${icon} x+r`).toBeLessThanOrEqual(1)
        expect(Math.abs(circulo.y) + circulo.r, `${icon} y+r`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('a passagem do pino de viagem cabe na cabeça e não repete nenhum dos seis símbolos', () => {
    for (const stroke of PIN_TRAVEL_SYMBOL.strokes) {
      expect(stroke.points.length).toBeGreaterThan(1)
      for (const ponto of stroke.points) {
        expect(Math.abs(ponto.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(ponto.y)).toBeLessThanOrEqual(1)
      }
    }
    const seis = PIN_ICON_ORDER.map((icon) => JSON.stringify(PIN_SYMBOLS[icon]))
    expect(seis).not.toContain(JSON.stringify(PIN_TRAVEL_SYMBOL))
  })

  it('o tipo viagem é o terceiro, ao lado de "!" e "?", e tipo desconhecido não passa pela guarda', () => {
    expect(PIN_KIND_ORDER).toEqual(['exclamacao', 'interrogacao', 'viagem'])
    expect(isPinKind('viagem')).toBe(true)
    expect(isPinKind('portal')).toBe(false)
    expect(isPinKind(undefined)).toBe(false)
  })

  it('sem descrição, o ícone é quem nomeia o pino; sem ícone, volta o glifo de hoje', () => {
    expect(pinSummary(pino('p1', 0, 0, { icon: 'bau' }))).toBe('Ponto de interesse — Baú')
    expect(pinSummary(pino('p2', 0, 0, { icon: 'armadilha' }))).toBe('Ponto de interesse — Armadilha')
    expect(pinSummary(pino('p3', 0, 0))).toBe('Ponto de interesse !')
  })

  it('a descrição continua ganhando do ícone', () => {
    expect(pinSummary(pino('p1', 0, 0, { icon: 'bau', description: 'Baú vazio' }))).toBe('Baú vazio')
  })

  it('pino de viagem sem descrição se chama "Pino de viagem", nunca pelo símbolo que ele não desenha', () => {
    expect(pinSummary(pino('p1', 0, 0, { kind: 'viagem' }))).toBe('Pino de viagem')
    expect(pinSummary(pino('p2', 0, 0, { kind: 'viagem', icon: 'bau' }))).toBe('Pino de viagem')
    expect(pinSummary(pino('p3', 0, 0, { kind: 'viagem', description: 'Escada da cripta' }))).toBe('Escada da cripta')
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

  it('o ícone atravessa o recorte: é o mesmo desenho na tela do mestre e na do jogador', () => {
    const { map } = filterMapForPlayer(mapaCom([pino('perto', 240, 200, { icon: 'armadilha' })]), 'p1', POSSE, RAIO)
    expect(map.pins.map((p) => p.icon)).toEqual(['armadilha'])
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

  it('o destino do pino de viagem nunca sai: nem a cena de destino, nem o pino par', () => {
    const viagem = pino('passagem', 240, 200, {
      kind: 'viagem',
      description: 'Escada que desce',
      destino: { sceneId: 'scene_cripta_secreta', pinId: 'pino_par_da_cripta' },
    })
    const { map } = filterMapForPlayer(mapaCom([viagem]), 'p1', POSSE, RAIO)

    // O pino sai — o jogador vê a passagem e lê a descrição que o mestre escreveu.
    expect(map.pins).toEqual([{ id: 'passagem', x: 240, y: 200, kind: 'viagem', description: 'Escada que desce', image: null }])
    expect('destino' in map.pins[0]).toBe(false)
    // Nem o id da cena nem o do par aparecem em lugar nenhum do recorte.
    const recorte = JSON.stringify(map)
    expect(recorte).not.toContain('scene_cripta_secreta')
    expect(recorte).not.toContain('pino_par_da_cripta')
    // O recorte é cópia: o mapa do mestre continua ligado.
    expect(viagem.destino).toEqual({ sceneId: 'scene_cripta_secreta', pinId: 'pino_par_da_cripta' })
  })

  it('a passagem do pino de viagem sai (o cartão precisa dela); o destino continua não saindo', () => {
    const pinos = [
      pino('livre', 240, 200, { kind: 'viagem', passagem: 'livre', destino: { sceneId: 'scene_cripta_secreta', pinId: 'par_livre' } }),
      pino('trancada', 220, 220, { kind: 'viagem', passagem: 'trancada', destino: { sceneId: 'scene_cripta_secreta', pinId: 'par_trancado' } }),
      pino('antiga', 200, 240, { kind: 'viagem', destino: { sceneId: 'scene_cripta_secreta', pinId: 'par_antigo' } }),
    ]
    const { map } = filterMapForPlayer(mapaCom(pinos), 'p1', POSSE, RAIO)
    expect(map.pins.map((p) => [p.id, p.passagem])).toEqual([
      ['livre', 'livre'],
      ['trancada', 'trancada'],
      // Pino sem o campo não ganha um no recorte: ausente é "pede ao mestre".
      ['antiga', undefined],
    ])
    expect(map.pins.some((p) => 'destino' in p)).toBe(false)
    expect(JSON.stringify(map)).not.toContain('scene_cripta_secreta')
  })

  it('passageOf: ausente e desconhecido são "pede"; só os três modos valem', () => {
    expect(passageOf(pino('a', 0, 0, { kind: 'viagem' }))).toBe('pede')
    expect(passageOf(pino('b', 0, 0, { kind: 'viagem', passagem: 'livre' }))).toBe('livre')
    expect(passageOf(pino('c', 0, 0, { kind: 'viagem', passagem: 'trancada' }))).toBe('trancada')
    expect([isPinPassage('pede'), isPinPassage('Livre'), isPinPassage(undefined), isPinPassage(null)]).toEqual([true, false, false, false])
  })

  it('camada Anotações oculta tira todos os pinos', () => {
    const base = mapaCom([pino('perto', 240, 200)])
    const { map } = filterMapForPlayer({ ...base, hiddenLayers: ['anotacoes'] }, 'p1', POSSE, RAIO)
    expect(map.pins).toEqual([])
  })
})
