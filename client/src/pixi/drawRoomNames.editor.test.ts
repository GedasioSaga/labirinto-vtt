import { describe, expect, it } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createRoomNamesRenderer, roomLabelEditorLook, roomLabelFontSizeFor } from './drawRoomNames'
import { ROOM_LABEL_DEFAULT_COLOR } from '../lib/roomLabelStyle'
import type { Region, RegionPoint, RoomMeta } from '../types/map'

/**
 * CAMPO DE NOME DA SALA É A PRÓPRIA PLAQUINHA. O campo que abre ao criar (ou
 * renomear) uma Sala copia a etiqueta que o mapa desenha — lugar, fonte, cor,
 * plaquinha e orientação — e a etiqueta do mapa some enquanto ele está aberto:
 * uma etiqueta só na tela, a que se edita.
 */

const GRID = 70

function quadrado(x: number, y: number, lado: number): RegionPoint[] {
  return [
    { x, y },
    { x: x + lado, y },
    { x: x + lado, y: y + lado },
    { x, y: y + lado },
  ]
}

function sala(id: string, points: RegionPoint[], room: Partial<RoomMeta> = {}, parentId?: string): Region {
  return {
    id,
    points,
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Sala do Tesouro', ...room },
    ...(parentId === undefined ? {} : { parentId }),
  }
}

function textoDe(container: Container, nome: string): Text {
  const text = container.children.find((child): child is Text => child instanceof Text && child.text === nome)
  if (!text) throw new Error(`sem o nome ${nome}`)
  return text
}

/** A plaquinha é o Graphics na mesma posição do texto. */
function plaquinhaDe(container: Container, nome: string): Graphics {
  const text = textoDe(container, nome)
  const plate = container.children.find(
    (child): child is Graphics => child instanceof Graphics && child.x === text.x && child.y === text.y,
  )
  if (!plate) throw new Error(`sem plaquinha para ${nome}`)
  return plate
}

describe('roomLabelEditorLook — o campo copia a etiqueta desta sala', () => {
  it('sala sem estilo: plaquinha de pedra clara, tinta grafite, fonte do grid, horizontal, no centro', () => {
    const region = sala('a', quadrado(0, 0, 400))
    const look = roomLabelEditorLook(region, [region], GRID)
    expect(look).toMatchObject({
      x: 200,
      y: 200,
      fontSize: roomLabelFontSizeFor(region, GRID),
      plateColor: '#c9c1ac',
      color: ROOM_LABEL_DEFAULT_COLOR,
      vertical: false,
    })
  })

  it('a pílula do campo tem as proporções da plaquinha: altura 1,85 da fonte, respiro 0,35, largura mínima 5,5', () => {
    const region = sala('a', quadrado(0, 0, 400))
    const look = roomLabelEditorLook(region, [region], GRID)
    expect(look.plateHeightEm).toBe(1.85)
    expect(look.platePadXEm).toBe(0.35)
    expect(look.plateMinWidthEm).toBe(5.5)
  })

  it('as letras do campo são as da etiqueta: a mesma fonte do Text do mapa, itálico só no nome escondido dos jogadores', () => {
    const region = sala('a', quadrado(0, 0, 400))
    const container = new Container()
    createRoomNamesRenderer().draw(container, [region], GRID, 1)
    const fonteDoMapa = textoDe(container, 'Sala do Tesouro').style.fontFamily
    expect(roomLabelEditorLook(region, [region], GRID).fontFamily).toBe(Array.isArray(fonteDoMapa) ? fonteDoMapa.join(', ') : fonteDoMapa)
    expect(roomLabelEditorLook(region, [region], GRID).italic).toBe(false)

    const escondida = sala('b', quadrado(0, 0, 400), { nameHiddenFromPlayers: true })
    expect(roomLabelEditorLook(escondida, [escondida], GRID).italic).toBe(true)
  })

  it('sala SEM plaquinha: o campo não ganha pílula bege — fundo transparente', () => {
    const region = sala('a', quadrado(0, 0, 400), { labelPlate: false })
    expect(roomLabelEditorLook(region, [region], GRID).plateColor).toBeNull()
  })

  it('cor, tamanho e orientação escolhidos pelo mestre valem no campo', () => {
    const region = sala('a', quadrado(0, 0, 400), { labelColor: '#ffcc00', labelScale: 1.5, labelVertical: true })
    const look = roomLabelEditorLook(region, [region], GRID)
    expect(look.color).toBe('#ffcc00')
    expect(look.fontSize).toBeCloseTo(roomLabelFontSizeFor(region, GRID), 9)
    expect(look.fontSize).toBeGreaterThan(roomLabelFontSizeFor(sala('b', quadrado(0, 0, 400)), GRID))
    expect(look.vertical).toBe(true)
  })

  it('nome arrastado pelo mestre: o campo abre onde a etiqueta foi solta', () => {
    const region = sala('a', quadrado(0, 0, 400), { labelOffset: { x: 30, y: -50 } })
    const look = roomLabelEditorLook(region, [region], GRID)
    expect({ x: look.x, y: look.y }).toEqual({ x: 230, y: 150 })
  })

  it('sala com sub-sala no meio: o campo abre na plaquinha desviada, não no centro coberto pela filha', () => {
    const pai = sala('pai', quadrado(0, 0, 400))
    const filha = sala('filha', quadrado(150, 150, 100), { name: 'Cofre' }, 'pai')
    const regions = [pai, filha]
    const container = new Container()
    createRoomNamesRenderer().draw(container, regions, GRID, 1)
    const desenhado = textoDe(container, 'Sala do Tesouro')

    const look = roomLabelEditorLook(pai, regions, GRID)
    expect({ x: look.x, y: look.y }).toEqual({ x: desenhado.x, y: desenhado.y })
    expect({ x: look.x, y: look.y }).not.toEqual({ x: 200, y: 200 })
  })
})

describe('createRoomNamesRenderer — a etiqueta em edição sai do mapa enquanto o campo está aberto', () => {
  it('só a sala em edição some (nome e plaquinha); as outras continuam', () => {
    const a = sala('a', quadrado(0, 0, 400))
    const b = sala('b', quadrado(500, 0, 400), { name: 'Cripta' })
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    renderer.draw(container, [a, b], GRID, 1)

    renderer.setEditingRegion('a')
    expect(textoDe(container, 'Sala do Tesouro').visible).toBe(false)
    expect(plaquinhaDe(container, 'Sala do Tesouro').visible).toBe(false)
    expect(textoDe(container, 'Cripta').visible).toBe(true)
    expect(plaquinhaDe(container, 'Cripta').visible).toBe(true)
  })

  it('redesenho no meio da edição (zoom, outra mudança no mapa) não traz a etiqueta de volta', () => {
    const a = sala('a', quadrado(0, 0, 400))
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    renderer.draw(container, [a], GRID, 1)
    renderer.setEditingRegion('a')

    renderer.draw(container, [a], GRID, 1)
    renderer.setCameraScale(2)
    expect(textoDe(container, 'Sala do Tesouro').visible).toBe(false)
    expect(plaquinhaDe(container, 'Sala do Tesouro').visible).toBe(false)
  })

  it('campo fechado: a etiqueta volta, respeitando o zoom e a escolha de plaquinha', () => {
    const a = sala('a', quadrado(0, 0, 400))
    const semFundo = sala('b', quadrado(500, 0, 400), { name: 'Cripta', labelPlate: false })
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    renderer.draw(container, [a, semFundo], GRID, 1)

    renderer.setEditingRegion('a')
    renderer.setEditingRegion('b')
    // Trocar de sala em edição devolve a anterior.
    expect(textoDe(container, 'Sala do Tesouro').visible).toBe(true)
    expect(textoDe(container, 'Cripta').visible).toBe(false)

    renderer.setEditingRegion(null)
    expect(textoDe(container, 'Cripta').visible).toBe(true)
    // Sem plaquinha por escolha do mestre: fechar a edição não inventa uma.
    expect(plaquinhaDe(container, 'Cripta').visible).toBe(false)

    // Abaixo de 30% de zoom o nome não aparece (screenLabel.ts), com ou sem edição.
    renderer.setCameraScale(0.2)
    expect(textoDe(container, 'Sala do Tesouro').visible).toBe(false)
  })

  it('CASO OBRIGATÓRIO: id em edição que não existe (sala apagada no meio) não quebra nem esconde as outras', () => {
    const a = sala('a', quadrado(0, 0, 400))
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    renderer.draw(container, [a], GRID, 1)
    expect(() => renderer.setEditingRegion('fantasma')).not.toThrow()
    expect(textoDe(container, 'Sala do Tesouro').visible).toBe(true)
  })
})
