import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import {
  childRoomsOf,
  createRoomNamesRenderer,
  estimateRoomLabelTextWidth,
  findRoomLabelAt,
  roomLabelAnchor,
  roomLabelBounds,
  roomLabelFontSize,
  roomLabelPlateSize,
  roomLabelPosition,
  roomLabelPositionAvoidingChildren,
} from './drawRoomNames'
import type { Region, RegionPoint } from '../types/map'

function buildRoom(id: string, name: string | null, points: RegionPoint[]): Region {
  return {
    id,
    points,
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    ...(name === null ? {} : { room: { shape: 'rect' as const, name } }),
  }
}

const SQUARE: RegionPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]

function textChildren(container: Container): Text[] {
  return container.children.filter((child): child is Text => child instanceof Text)
}

describe('roomLabelAnchor', () => {
  it('retângulo: centro geométrico', () => {
    const anchor = roomLabelAnchor([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 60 },
      { x: 10, y: 60 },
    ])
    expect(anchor.x).toBeCloseTo(60)
    expect(anchor.y).toBeCloseTo(40)
  })

  it('triângulo: média dos três vértices (centróide de área coincide)', () => {
    const anchor = roomLabelAnchor([
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 0, y: 60 },
    ])
    expect(anchor.x).toBeCloseTo(30)
    expect(anchor.y).toBeCloseTo(20)
  })

  it('sentido horário e anti-horário dão o mesmo ponto', () => {
    const reversed = [...SQUARE].reverse()
    expect(roomLabelAnchor(reversed).x).toBeCloseTo(50)
    expect(roomLabelAnchor(reversed).y).toBeCloseTo(50)
  })

  it('polígono côncavo em L: centróide de área, não média dos vértices', () => {
    // L = quadrado 0..20 x 0..10 (área 200, centro 10,5) + 0..10 x 10..20 (área 100, centro 5,15).
    const lShape: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ]
    const anchor = roomLabelAnchor(lShape)
    expect(anchor.x).toBeCloseTo((200 * 10 + 100 * 5) / 300)
    expect(anchor.y).toBeCloseTo((200 * 5 + 100 * 15) / 300)
    // A média dos vértices daria (10, 10): prova que não é esse o caminho.
    expect(anchor.x).not.toBeCloseTo(10)
  })

  it('pontos colineares (área zero) caem na média dos pontos', () => {
    const anchor = roomLabelAnchor([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 50, y: 0 },
    ])
    expect(anchor.x).toBeCloseTo(20)
    expect(anchor.y).toBeCloseTo(0)
    expect(Number.isFinite(anchor.x)).toBe(true)
  })

  it('ponto único e lista vazia não produzem NaN', () => {
    expect(roomLabelAnchor([{ x: 7, y: 9 }])).toEqual({ x: 7, y: 9 })
    expect(roomLabelAnchor([])).toEqual({ x: 0, y: 0 })
  })
})

describe('roomLabelFontSize', () => {
  it('proporcional ao grid, limitado entre 12 e 28', () => {
    expect(roomLabelFontSize(70)).toBeCloseTo(21)
    expect(roomLabelFontSize(10)).toBe(12)
    expect(roomLabelFontSize(500)).toBe(28)
  })
})

describe('createRoomNamesRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('só desenha regiões com room.name não vazio, centradas no centróide', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(
      container,
      [
        buildRoom('sala', 'Cripta', SQUARE),
        buildRoom('sem-nome', '   ', SQUARE),
        buildRoom('regiao-comum', null, SQUARE),
      ],
      70,
    )

    const texts = textChildren(container)
    expect(texts).toHaveLength(1)
    expect(texts[0].text).toBe('Cripta')
    expect(texts[0].position.x).toBeCloseTo(50)
    expect(texts[0].position.y).toBeCloseTo(50)
    expect(texts[0].anchor.x).toBe(0.5)
    expect(texts[0].anchor.y).toBe(0.5)
    expect(texts[0].style.fontSize).toBeCloseTo(21)
  })

  it('região que some fica invisível, sem destruir o Text; volta reaproveitando o mesmo objeto', () => {
    const destroySpy = vi.spyOn(Text.prototype, 'destroy')
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 50)
    const first = textChildren(container)[0]

    renderer.draw(container, [], 50)
    expect(destroySpy).not.toHaveBeenCalled()
    expect(first.destroyed).toBe(false)
    expect(first.visible).toBe(false)

    renderer.draw(container, [buildRoom('sala', 'Salão', SQUARE)], 50)
    const texts = textChildren(container)
    expect(texts).toHaveLength(1)
    expect(texts[0]).toBe(first)
    expect(first.visible).toBe(true)
    expect(first.text).toBe('Salão')
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('sala que perde o nome também só fica invisível', () => {
    const destroySpy = vi.spyOn(Text.prototype, 'destroy')
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 50)
    renderer.draw(container, [buildRoom('sala', '', SQUARE)], 50)

    expect(textChildren(container)[0].visible).toBe(false)
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('mudança de grid atualiza o tamanho da fonte', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 50)
    expect(textChildren(container)[0].style.fontSize).toBe(15)
    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 90)
    expect(textChildren(container)[0].style.fontSize).toBeCloseTo(27)
  })

  it('zoom baixo: nome compensa até 11 px de tela e some abaixo de 30%, sem re-rasterizar', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 64, 1)
    const text = textChildren(container)[0]
    expect(text.scale.x).toBe(1)
    const fontSize = roomLabelFontSize(64)

    renderer.setCameraScale(0.35)
    expect(text.visible).toBe(true)
    expect(fontSize * 0.35 * text.scale.x).toBeCloseTo(11, 6)

    renderer.setCameraScale(0.25)
    expect(text.visible).toBe(false)

    // Redraw sem zoom explícito mantém o último informado.
    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 64)
    expect(text.visible).toBe(false)
    renderer.setCameraScale(2)
    expect(text.visible).toBe(true)
    expect(text.scale.x).toBe(1)
  })

  it('setCameraScale não reexibe sala que perdeu o nome', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], 64, 1)
    renderer.draw(container, [buildRoom('sala', '', SQUARE)], 64)
    renderer.setCameraScale(0.5)
    expect(textChildren(container)[0].visible).toBe(false)
  })

  it('labelOffset desloca o texto a partir do centróide (mesmo renderer do jogador)', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [withOffset(buildRoom('sala', 'Cripta', SQUARE), { x: 30, y: -20 })], 70)

    expect(textChildren(container)[0].position.x).toBeCloseTo(80)
    expect(textChildren(container)[0].position.y).toBeCloseTo(30)
  })
})

function withOffset(region: Region, labelOffset: { x: number; y: number }): Region {
  if (!region.room) throw new Error('região sem room')
  return { ...region, room: { ...region.room, labelOffset } }
}

describe('roomLabelBounds com zoom', () => {
  it('caixa de clique cresce com a compensação e some abaixo de 30%', () => {
    const room = buildRoom('sala', 'Cripta', SQUARE)
    const at100 = roomLabelBounds(room, 64, 1)
    const at35 = roomLabelBounds(room, 64, 0.35)
    if (!at100 || !at35) throw new Error('esperava caixa')
    expect(at35.maxX - at35.minX).toBeGreaterThan(at100.maxX - at100.minX)
    expect(roomLabelBounds(room, 64, 0.25)).toBeNull()
    expect(findRoomLabelAt([room], { x: 50, y: 50 }, 64, 0.25)).toBeNull()
    expect(findRoomLabelAt([room], { x: 50, y: 50 }, 64, 0.35)).toBe(room)
  })
})

describe('roomLabelPosition', () => {
  it('sem offset é o centróide; com offset soma', () => {
    expect(roomLabelPosition(buildRoom('sala', 'Cripta', SQUARE))).toEqual({ x: 50, y: 50 })
    expect(roomLabelPosition(withOffset(buildRoom('sala', 'Cripta', SQUARE), { x: -10, y: 5 }))).toEqual({ x: 40, y: 55 })
  })
})

describe('findRoomLabelAt', () => {
  it('acha a sala pelo retângulo do nome e segue o offset', () => {
    const moved = withOffset(buildRoom('sala', 'Cripta', SQUARE), { x: 200, y: 0 })

    expect(findRoomLabelAt([moved], { x: 250, y: 50 }, 70)?.id).toBe('sala')
    // O centro da sala não é mais o nome depois do arrasto.
    expect(findRoomLabelAt([moved], { x: 50, y: 50 }, 70)).toBeNull()
  })

  it('sala sem nome ou região comum não tem rótulo clicável', () => {
    expect(roomLabelBounds(buildRoom('sem-nome', '  ', SQUARE), 70)).toBeNull()
    expect(findRoomLabelAt([buildRoom('comum', null, SQUARE)], { x: 50, y: 50 }, 70)).toBeNull()
  })

  it('com rótulos sobrepostos vence a região desenhada por último', () => {
    const regions = [buildRoom('baixo', 'Cripta', SQUARE), buildRoom('cima', 'Cripta', SQUARE)]
    expect(findRoomLabelAt(regions, { x: 50, y: 50 }, 70)?.id).toBe('cima')
  })
})

/*
 * Dor medida no passeio cego de 17/09/2026: o nome da sala de FORA era
 * desenhado no centróide dela, que numa sala com um quarto dentro cai em cima
 * do quarto — 0,30% do recorte da filha pintado com a tinta do rótulo da mãe.
 */
const GRID = 64
/** Mãe 512×448 com um quarto de 256×256 no canto superior esquerdo: o
 *  centróide da mãe (256, 224) cai dentro do quarto. Mesma forma da cena
 *  medida na jornada. */
const MAE_PONTOS: RegionPoint[] = [
  { x: 0, y: 0 },
  { x: 512, y: 0 },
  { x: 512, y: 448 },
  { x: 0, y: 448 },
]
const FILHA_PONTOS: RegionPoint[] = [
  { x: 0, y: 0 },
  { x: 256, y: 0 },
  { x: 256, y: 256 },
  { x: 0, y: 256 },
]

function comMae(region: Region, parentId: string): Region {
  return { ...region, parentId }
}

function cenaMaeEFilha(nomeDaMae = 'Sala 1', nomeDaFilha = 'Sala 2'): { mae: Region; filha: Region; cena: Region[] } {
  const mae = buildRoom('mae', nomeDaMae, MAE_PONTOS)
  const filha = comMae(buildRoom('filha', nomeDaFilha, FILHA_PONTOS), 'mae')
  return { mae, filha, cena: [mae, filha] }
}

/** Caixa do rótulo pela mesma régua do hit-test, já com o desvio aplicado. */
function caixaDoRotulo(region: Region, cena: Region[]) {
  const box = roomLabelBounds(region, GRID, 1, cena)
  if (!box) throw new Error('esperava caixa de rótulo')
  return box
}

const FILHA_CAIXA = { minX: 0, minY: 0, maxX: 256, maxY: 256 }

function invade(box: { minX: number; minY: number; maxX: number; maxY: number }, alvo: typeof FILHA_CAIXA): boolean {
  return box.minX < alvo.maxX && box.maxX > alvo.minX && box.minY < alvo.maxY && box.maxY > alvo.minY
}

describe('childRoomsOf', () => {
  it('pega só quem aponta para esta sala em parentId', () => {
    const { cena } = cenaMaeEFilha()
    expect(childRoomsOf(cena, 'mae').map((r) => r.id)).toEqual(['filha'])
    expect(childRoomsOf(cena, 'filha')).toEqual([])
  })

  it('ignora polígono degenerado (menos de 3 pontos), que não esconde nada', () => {
    const risco = comMae(buildRoom('risco', 'X', [{ x: 0, y: 0 }, { x: 10, y: 0 }]), 'mae')
    expect(childRoomsOf([risco], 'mae')).toEqual([])
  })
})

describe('roomLabelPositionAvoidingChildren', () => {
  it('sala sem filha continua no centróide (nada muda para a maioria das salas)', () => {
    const sozinha = buildRoom('sala', 'Cripta', MAE_PONTOS)
    expect(roomLabelPositionAvoidingChildren(sozinha, [sozinha], GRID)).toEqual(roomLabelAnchor(MAE_PONTOS))
  })

  it('o rótulo da mãe sai de cima da filha, continua dentro da mãe e continua perto do centróide', () => {
    const { mae, cena } = cenaMaeEFilha()
    const centroide = roomLabelAnchor(MAE_PONTOS)
    const posicao = roomLabelPositionAvoidingChildren(mae, cena, GRID)

    expect(posicao).not.toEqual(centroide)
    // Dentro da mãe, e a caixa inteira do rótulo fora da filha.
    expect(invade(caixaDoRotulo(mae, cena), FILHA_CAIXA)).toBe(false)
    const box = caixaDoRotulo(mae, cena)
    expect(box.minX).toBeGreaterThanOrEqual(0)
    expect(box.maxX).toBeLessThanOrEqual(512)
    expect(box.minY).toBeGreaterThanOrEqual(0)
    expect(box.maxY).toBeLessThanOrEqual(448)
    // Perto: o desvio é o mínimo que resolve, não um canto qualquer da sala.
    expect(Math.hypot(posicao.x - centroide.x, posicao.y - centroide.y)).toBeLessThan(120)
  })

  it('CONTROLE: sem o desvio (cena sem as vizinhas) o rótulo da mãe cai dentro da filha', () => {
    const { mae } = cenaMaeEFilha()
    const box = caixaDoRotulo(mae, [])
    expect(invade(box, FILHA_CAIXA)).toBe(true)
  })

  it('o rótulo da própria filha não se mexe: quem tem filha é a mãe', () => {
    const { filha, cena } = cenaMaeEFilha()
    expect(roomLabelPositionAvoidingChildren(filha, cena, GRID)).toEqual(roomLabelAnchor(FILHA_PONTOS))
  })

  it('offset arrastado pelo mestre manda: sem desvio nenhum', () => {
    const { mae, filha } = cenaMaeEFilha()
    const arrastada = withOffset(mae, { x: 10, y: 20 })
    expect(roomLabelPositionAvoidingChildren(arrastada, [arrastada, filha], GRID)).toEqual({ x: 266, y: 244 })
  })

  it('sala tomada inteira pela filha cai de volta no centróide (nome dentro da sala é melhor que nome fora)', () => {
    const mae = buildRoom('mae', 'Sala 1', MAE_PONTOS)
    const filha = comMae(buildRoom('filha', 'Sala 2', MAE_PONTOS), 'mae')
    expect(roomLabelPositionAvoidingChildren(mae, [mae, filha], GRID)).toEqual(roomLabelAnchor(MAE_PONTOS))
  })

  it('região crua (sem room, sem parentId, sem ponto nenhum) não quebra nem produz NaN', () => {
    const crua: Region = { id: 'crua', points: [], tag: '', fillColor: '#333', fillPattern: 'solid', data: {} }
    const posicao = roomLabelPositionAvoidingChildren(crua, [crua], GRID)
    expect(posicao).toEqual({ x: 0, y: 0 })
    expect(roomLabelBounds(crua, GRID, 1, [crua])).toBeNull()
  })

  it('sala com nome mas sem filha e sem parentId na cena continua no centróide', () => {
    const solta = buildRoom('solta', 'Sala 9', FILHA_PONTOS)
    expect(roomLabelPositionAvoidingChildren(solta, [solta], GRID)).toEqual({ x: 128, y: 128 })
  })

  it('nome comprido ou curto, o desvio é estável entre duas chamadas iguais', () => {
    const { mae, cena } = cenaMaeEFilha()
    expect(roomLabelPositionAvoidingChildren(mae, cena, GRID)).toEqual(roomLabelPositionAvoidingChildren(mae, cena, GRID))
  })
})

describe('a cena exata que a jornada mede', () => {
  // Mesmas coordenadas da jornada `task-jornada-sala-de-verdade.spec.ts` (mãe
  // 384..896 × 192..640, quarto 384..640 × 192..448, grade 64). Na tela elas
  // aparecem deslocadas pela origem do canvas; o deslocamento é o mesmo para a
  // sala, para o quarto e para o recorte, então a geometria relativa — que é o
  // que decide se o rótulo invade — é esta aqui.
  const MAE_JORNADA: RegionPoint[] = [
    { x: 384, y: 192 },
    { x: 896, y: 192 },
    { x: 896, y: 640 },
    { x: 384, y: 640 },
  ]
  const FILHA_JORNADA: RegionPoint[] = [
    { x: 384, y: 192 },
    { x: 640, y: 192 },
    { x: 640, y: 448 },
    { x: 384, y: 448 },
  ]
  /** O recorte que a jornada fotografa: o miolo do quarto, 6 px para dentro. */
  const RECORTE_DA_FILHA = { minX: 390, minY: 198, maxX: 634, maxY: 442 }

  it('o rótulo da mãe ("Sala 1") não põe um pixel dentro do recorte do quarto', () => {
    const mae = buildRoom('mae', 'Sala 1', MAE_JORNADA)
    const filha = comMae(buildRoom('filha', 'Sala 2', FILHA_JORNADA), 'mae')
    const cena = [mae, filha]

    const box = caixaDoRotulo(mae, cena)
    const invadeRecorte =
      box.minX < RECORTE_DA_FILHA.maxX &&
      box.maxX > RECORTE_DA_FILHA.minX &&
      box.minY < RECORTE_DA_FILHA.maxY &&
      box.maxY > RECORTE_DA_FILHA.minY
    expect(invadeRecorte).toBe(false)
    // E continua sendo o nome DAQUELA sala: dentro dela, e não no meio do mapa.
    expect(box.minX).toBeGreaterThanOrEqual(384)
    expect(box.maxX).toBeLessThanOrEqual(896)
    expect(box.minY).toBeGreaterThanOrEqual(192)
    expect(box.maxY).toBeLessThanOrEqual(640)
  })
})

describe('findRoomLabelAt com sala dentro de sala', () => {
  it('o clique pega o nome da mãe onde ele está desenhado, não no centróide', () => {
    const { mae, cena } = cenaMaeEFilha()
    const posicao = roomLabelPositionAvoidingChildren(mae, cena, GRID)

    expect(findRoomLabelAt(cena, posicao, GRID)?.id).toBe('mae')
    // No centróide da mãe (dentro da filha) quem responde é a filha, ou ninguém
    // — o que nunca pode acontecer é a mãe responder por um rótulo que não
    // está mais lá.
    expect(findRoomLabelAt(cena, roomLabelAnchor(MAE_PONTOS), GRID)?.id).not.toBe('mae')
  })
})

describe('createRoomNamesRenderer com sala dentro de sala', () => {
  it('desenha o nome da mãe na posição desviada', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    const { mae, cena } = cenaMaeEFilha()

    renderer.draw(container, cena, GRID, 1)

    const esperado = roomLabelPositionAvoidingChildren(mae, cena, GRID)
    const textoDaMae = textChildren(container).find((t) => t.text === 'Sala 1')
    if (!textoDaMae) throw new Error('esperava o rótulo da mãe desenhado')
    expect(textoDaMae.position.x).toBeCloseTo(esperado.x)
    expect(textoDaMae.position.y).toBeCloseTo(esperado.y)
    expect(textoDaMae.position.y).not.toBeCloseTo(224)
  })

  it('filha ainda sem nome também desvia o rótulo da mãe (o quarto já está na tela)', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    const mae = buildRoom('mae', 'Sala 1', MAE_PONTOS)
    const filhaSemNome = comMae(buildRoom('filha', '', FILHA_PONTOS), 'mae')

    renderer.draw(container, [mae, filhaSemNome], GRID, 1)

    const textos = textChildren(container).filter((t) => t.visible)
    expect(textos).toHaveLength(1)
    expect(textos[0].position.y).not.toBeCloseTo(224)
  })
})

function plateChildren(container: Container): Graphics[] {
  return container.children.filter((child): child is Graphics => child instanceof Graphics)
}

describe('roomLabelPlateSize', () => {
  it('nome curto cai na largura mínima; nome comprido cresce com o texto mais o respiro', () => {
    const fonte = 20
    const curto = roomLabelPlateSize(10, fonte)
    const comprido = roomLabelPlateSize(200, fonte)

    expect(curto.width).toBe(fonte * 5.5)
    expect(comprido.width).toBe(200 + 2 * fonte * 0.35)
  })

  it('é pílula: o canto é metade da altura, não um raio qualquer', () => {
    const plaquinha = roomLabelPlateSize(80, 20)
    expect(plaquinha.height).toBe(37)
    expect(plaquinha.radius).toBe(plaquinha.height / 2)
  })

  it('cresce junto com a fonte (a plaquinha acompanha o zoom do rótulo)', () => {
    expect(roomLabelPlateSize(40, 40).height).toBe(roomLabelPlateSize(40, 20).height * 2)
  })
})

describe('caixa de clique do nome', () => {
  it('é exatamente a plaquinha desenhada: o que o mestre vê é o que ele pega', () => {
    const room = buildRoom('sala', 'Cripta', SQUARE)
    const caixa = roomLabelBounds(room, GRID, 1)
    if (!caixa) throw new Error('esperava caixa')
    const fonte = roomLabelFontSize(GRID)
    const plaquinha = roomLabelPlateSize(estimateRoomLabelTextWidth('Cripta', fonte), fonte)

    expect(caixa.maxX - caixa.minX).toBeCloseTo(plaquinha.width)
    expect(caixa.maxY - caixa.minY).toBeCloseTo(plaquinha.height)
  })
})

describe('etiqueta em pílula do nome da sala', () => {
  it('cada nome ganha uma plaquinha na mesma posição do texto', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], GRID, 1)

    const plaquinhas = plateChildren(container)
    expect(plaquinhas).toHaveLength(1)
    expect(plaquinhas[0].visible).toBe(true)
    expect(plaquinhas[0].position.x).toBeCloseTo(textChildren(container)[0].position.x)
    expect(plaquinhas[0].position.y).toBeCloseTo(textChildren(container)[0].position.y)
  })

  it('toda plaquinha fica ATRÁS de todo nome: a etiqueta de uma sala não tapa o nome da vizinha', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    const vizinha: RegionPoint[] = [
      { x: 60, y: 0 },
      { x: 160, y: 0 },
      { x: 160, y: 100 },
      { x: 60, y: 100 },
    ]

    renderer.draw(container, [buildRoom('a', 'Cripta', SQUARE), buildRoom('b', 'Adega', vizinha)], GRID, 1)

    // As duas plaquinhas ocupam o fundo do container e os dois nomes vêm
    // depois — ordem de pintura do Pixi é a ordem dos filhos.
    expect(plateChildren(container).map((g) => container.getChildIndex(g))).toEqual([0, 1])
    expect(textChildren(container).map((t) => container.getChildIndex(t))).toEqual([2, 3])
  })

  it('a plaquinha some junto com o nome, some junto no zoom afastado e volta inteira', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], GRID, 1)
    const plaquinha = plateChildren(container)[0]

    renderer.draw(container, [buildRoom('sala', '', SQUARE)], GRID, 1)
    expect(plaquinha.visible).toBe(false)
    // Mesmo cuidado do Text: esconder, nunca destruir durante a sessão.
    expect(plaquinha.destroyed).toBe(false)

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], GRID, 1)
    expect(plateChildren(container)).toHaveLength(1)
    expect(plaquinha.visible).toBe(true)

    renderer.setCameraScale(0.25)
    expect(plaquinha.visible).toBe(false)
    renderer.setCameraScale(1)
    expect(plaquinha.visible).toBe(true)
  })

  it('no zoom afastado a plaquinha cresce na mesma medida do texto, e os dois continuam do mesmo tamanho', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()

    renderer.draw(container, [buildRoom('sala', 'Cripta', SQUARE)], GRID, 1)
    expect(plateChildren(container)[0].scale.x).toBe(1)

    renderer.setCameraScale(0.35)
    expect(plateChildren(container)[0].scale.x).toBe(textChildren(container)[0].scale.x)
    expect(plateChildren(container)[0].scale.x).toBeGreaterThan(1)
  })

  it('nome escondido dos jogadores esmaece a etiqueta inteira, não só as letras', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    const secreta = buildRoom('sala', 'Cripta', SQUARE)
    if (!secreta.room) throw new Error('região sem room')

    renderer.draw(container, [{ ...secreta, room: { ...secreta.room, nameHiddenFromPlayers: true } }], GRID, 1)

    expect(plateChildren(container)[0].alpha).toBe(textChildren(container)[0].alpha)
    expect(plateChildren(container)[0].alpha).toBe(0.5)
  })
})
