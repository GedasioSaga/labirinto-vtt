/**
 * SÓ REPINTA O MÓVEL QUE MUDOU (P7 da lista de desempenho, 01/10/2026).
 *
 * Arrastar um móvel chama `draw` com todos os objetos a cada passo, e cada
 * móvel da mobília desenhada era limpo e refeito — medido no dev com 1200
 * móveis: ~40 mil `GraphicsContext.clear` num arrasto de 30 passos. Agora o
 * móvel só é repintado quando ele próprio, o zoom ou a densidade de pixel
 * mudam (o fio é em px de TELA, então os dois últimos mudam a largura).
 */
import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createPropsRenderer, FURNITURE_LABEL, type PropsView } from './drawProps'
import type { Prop } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

const ZOOM_1: PropsView = { cameraScale: 1, rendererResolution: 1 }

function movel(id: string, x: number, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x, y: 100, width: 40, height: 80, linkedMapPath: null, mobilia: 'catre', ...extra }
}

function tresMoveis(): Prop[] {
  return [movel('a', 100), movel('b', 300), movel('c', 500)]
}

function desenhosDosMoveis(container: Container): Graphics[] {
  return container.children.filter((c): c is Graphics => c instanceof Graphics && c.label === FURNITURE_LABEL)
}

/** desenho → id do móvel, pelo centro do desenho (cada móvel está num x diferente). */
function donosDosDesenhos(container: Container, props: Prop[]): Map<Graphics, string> {
  const donos = new Map<Graphics, string>()
  for (const desenho of desenhosDosMoveis(container)) {
    const caixa = desenho.getLocalBounds()
    const centro = caixa.x + caixa.width / 2
    const dono = props.find((p) => Math.abs(p.x - centro) < 1)
    if (dono) donos.set(desenho, dono.id)
  }
  return donos
}

/** Os móveis cujo desenho foi limpo (= repintado) durante `acao`, em ordem alfabética. */
function moveisRepintados(donos: Map<Graphics, string>, acao: () => void): string[] {
  const limpar = vi.spyOn(Graphics.prototype, 'clear')
  try {
    acao()
    const repintados = new Set<string>()
    for (const contexto of limpar.mock.contexts) {
      if (!(contexto instanceof Graphics)) continue
      const dono = donos.get(contexto)
      if (dono !== undefined) repintados.add(dono)
    }
    return [...repintados].sort()
  } finally {
    limpar.mockRestore()
  }
}

describe('createPropsRenderer — só repinta o móvel que mudou', () => {
  it('redesenhar com os mesmos móveis não repinta nenhum, e o desenho de cada um continua lá', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    const moveis = tresMoveis()
    renderer.draw(container, moveis, null, ZOOM_1)
    const donos = donosDosDesenhos(container, moveis)
    expect(donos.size).toBe(3)

    expect(moveisRepintados(donos, () => renderer.draw(container, moveis, null, ZOOM_1))).toEqual([])
    for (const desenho of desenhosDosMoveis(container)) {
      expect(desenho.context.instructions.map((i) => i.action)).toEqual(['fill', 'stroke', 'stroke'])
    }
  })

  it('arrastar um móvel repinta só ele, no lugar novo', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    const moveis = tresMoveis()
    renderer.draw(container, moveis, null, ZOOM_1)
    const donos = donosDosDesenhos(container, moveis)
    const movido = moveis.map((p) => (p.id === 'b' ? { ...p, x: 340 } : p))

    expect(moveisRepintados(donos, () => renderer.draw(container, movido, null, ZOOM_1))).toEqual(['b'])
    const caixas = desenhosDosMoveis(container).map((d) => d.getLocalBounds())
    expect(caixas.some((c) => Math.abs(c.x + c.width / 2 - 340) < 1)).toBe(true)
  })

  const campos: [string, Partial<Prop>][] = [
    ['tipo de móvel', { mobilia: 'mesa' }],
    ['cor', { mobiliaCor: '#8b4513' }],
    ['cor da linha', { mobiliaCorDaLinha: '#c0392b' }],
    ['preenchimento', { mobiliaPreenchido: false }],
    ['vista', { mobiliaVista: 'lado' }],
    ['giro', { rotation: 45 }],
    ['largura', { width: 60 }],
    ['altura', { height: 40 }],
    ['oculto no editor', { hidden: true }],
    ['oculto para jogadores', { secret: true }],
  ]
  it.each(campos)('mudar %s repinta só o móvel mudado', (_campo, mudanca) => {
    const container = new Container()
    const renderer = createPropsRenderer()
    const moveis = tresMoveis()
    renderer.draw(container, moveis, null, ZOOM_1)
    const donos = donosDosDesenhos(container, moveis)
    const mudados = moveis.map((p) => (p.id === 'b' ? { ...p, ...mudanca } : p))

    expect(moveisRepintados(donos, () => renderer.draw(container, mudados, null, ZOOM_1))).toEqual(['b'])
  })

  it('o oculto para jogadores fica meio apagado depois da repintura, e volta inteiro ao deixar de ser', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    const moveis = tresMoveis()
    renderer.draw(container, moveis, null, ZOOM_1)
    const donos = donosDosDesenhos(container, moveis)
    const desenhoDoB = [...donos].find(([, id]) => id === 'b')?.[0]
    if (!desenhoDoB) throw new Error('sem o desenho do móvel b')

    renderer.draw(container, moveis.map((p) => (p.id === 'b' ? { ...p, secret: true } : p)), null, ZOOM_1)
    expect(desenhoDoB.alpha).toBeLessThan(1)
    renderer.draw(container, moveis, null, ZOOM_1)
    expect(desenhoDoB.alpha).toBe(1)
  })

  it('zoom novo repinta todos: o fio é em px de tela', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    const moveis = tresMoveis()
    renderer.draw(container, moveis, null, ZOOM_1)
    const donos = donosDosDesenhos(container, moveis)

    expect(moveisRepintados(donos, () => renderer.draw(container, moveis, null, { cameraScale: 2, rendererResolution: 1 }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('densidade de pixel nova (outro monitor) repinta todos', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    const moveis = tresMoveis()
    renderer.draw(container, moveis, null, ZOOM_1)
    const donos = donosDosDesenhos(container, moveis)

    expect(moveisRepintados(donos, () => renderer.draw(container, moveis, null, { cameraScale: 1, rendererResolution: 2 }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('selecionar um móvel não repinta móvel nenhum: o destaque mora num Graphics só dele', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    const moveis = tresMoveis()
    renderer.draw(container, moveis, null, ZOOM_1)
    const donos = donosDosDesenhos(container, moveis)

    expect(moveisRepintados(donos, () => renderer.draw(container, moveis, 'b', ZOOM_1))).toEqual([])
  })
})
