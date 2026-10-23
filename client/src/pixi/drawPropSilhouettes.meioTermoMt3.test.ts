import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { carregarMoveisDoMeioTermo, drawPropSilhouettes } from './drawPropSilhouettes'
import { createPropsRenderer, FLOOR_LABEL } from './drawProps'
import { RasterDosMoveis, trocarRasterNoTeste } from './rasterDosMoveis'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `mocked://${path}` }))

/**
 * MT3 na tela: com a chave de obra ligada, os 11 tipos saem em imagem (o
 * desenho de linhas fica só enquanto ela não está pronta, sem mudar a chave de
 * repintura do jogador); o tapete continua no chão e por baixo, no jogador
 * (primeiro do `Graphics` único) e no editor (contêiner do chão); a chama da
 * fogueira continua por cima da imagem. Desligada, nenhum caminho novo roda.
 */

type Instruction = Graphics['context']['instructions'][number]
type DeImagem = Extract<Instruction, { action: 'texture' }>

const GRADE = 50

/** Os 11 tipos no tamanho padrão (`lib/mobilia.ts`), mais a cerca curva, o tapete redondo e as vistas de lado. */
const MOVEIS: readonly Prop[] = [
  ['barril', 0.7, 0.7],
  ['caixa', 0.8, 0.8],
  ['bau', 1, 0.6],
  ['catre', 1, 2],
  ['mesa', 2, 1],
  ['cadeira', 0.5, 0.5],
  ['cerca', 2, 0.25],
  ['armario', 1, 0.5],
  ['aparador', 2, 0.5],
  ['fogueira', 1, 1],
  ['tapete', 3, 2],
].map(([mobilia, w, h], i): Prop => ({ id: `m${i}`, src: '', x: 200, y: 200, width: Number(w) * GRADE, height: Number(h) * GRADE, linkedMapPath: null, mobilia: mobiliaDe(mobilia) }))

const VARIANTES: readonly Prop[] = [
  { id: 'cc', src: '', x: 200, y: 200, width: 150, height: 12.5, linkedMapPath: null, mobilia: 'cerca', mobiliaCurva: 120 },
  { id: 'tr', src: '', x: 200, y: 200, width: 100, height: 100, linkedMapPath: null, mobilia: 'tapete', mobiliaForma: 'redondo' },
  { id: 'al', src: '', x: 200, y: 200, width: 50, height: 75, linkedMapPath: null, mobilia: 'armario', mobiliaVista: 'lado' },
  { id: 'pl', src: '', x: 200, y: 200, width: 100, height: 45, linkedMapPath: null, mobilia: 'aparador', mobiliaVista: 'lado' },
  { id: 'fl', src: '', x: 200, y: 200, width: 50, height: 62.5, linkedMapPath: null, mobilia: 'fogueira', mobiliaVista: 'lado' },
  { id: 'tl', src: '', x: 200, y: 200, width: 150, height: 12.5, linkedMapPath: null, mobilia: 'tapete', mobiliaVista: 'lado' },
]

function mobiliaDe(valor: string | number): NonNullable<Prop['mobilia']> {
  const tipos = ['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete'] as const
  const achado = tipos.find((t) => t === valor)
  if (achado === undefined) throw new Error(`tipo desconhecido: ${String(valor)}`)
  return achado
}

function acoes(g: Graphics): string[] {
  return g.context.instructions.map((i) => i.action)
}

function imagens(g: Graphics): DeImagem[] {
  return g.context.instructions.filter((i): i is DeImagem => i.action === 'texture')
}

function rasterComFila(): { raster: RasterDosMoveis; rodar: () => void } {
  const fatias: (() => void)[] = []
  const raster = new RasterDosMoveis({ agendar: (fatia) => fatias.push(fatia) })
  trocarRasterNoTeste(raster)
  return {
    raster,
    rodar: () => {
      while (fatias.length > 0) fatias.shift()?.()
    },
  }
}

/** A chave de repintura dos objetos do jogador (`PlayerView.tsx`, `redrawPropsLayer`). */
function chaveDeRepinturaDoJogador(props: readonly Prop[]): string {
  return JSON.stringify([props, 1, 1, GRADE])
}

afterEach(() => {
  trocarObraNoTeste(false)
  trocarRasterNoTeste(null)
})

describe('MT3 com a chave de obra ligada', () => {
  for (const prop of [...MOVEIS, ...VARIANTES]) {
    const nome = `${prop.mobilia ?? '?'}${prop.mobiliaVista === 'lado' ? ' de lado' : ''}${prop.mobiliaForma === 'redondo' ? ' redondo' : ''}${prop.mobiliaCurva !== undefined ? ' curva' : ''}`
    it(`${nome}: primeiro o desenho de linhas, depois só a imagem, sem mudar a chave do jogador`, async () => {
      await carregarMoveisDoMeioTermo()
      trocarObraNoTeste(true)
      const { raster, rodar } = rasterComFila()
      const g = new Graphics()
      const props = [prop]
      const chaveAntes = chaveDeRepinturaDoJogador(props)
      drawPropSilhouettes(g, props, 1, 1)
      expect(acoes(g).length).toBeGreaterThan(0)
      expect(acoes(g)).not.toContain('texture')
      rodar()
      expect(acoes(g)).toEqual(['texture'])
      expect(raster.geradas).toBe(1)
      const bytes = imagens(g)[0].data.image.source.resource
      expect(bytes instanceof Uint8ClampedArray && bytes.some((b) => b > 0)).toBe(true)
      expect(chaveDeRepinturaDoJogador(props)).toBe(chaveAntes)
    })
  }

  it('jogador: o tapete é a PRIMEIRA imagem do Graphics único (por baixo da mesa e da cadeira), mesmo vindo por último na lista', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const tapete = MOVEIS[10]
    const props = [MOVEIS[4], MOVEIS[5], tapete]
    const g = new Graphics()
    drawPropSilhouettes(g, props, 1, 1)
    rodar()
    const coladas = imagens(g)
    expect(coladas).toHaveLength(3)
    const doTapete = raster.imagemDoMovel(tapete, 1, 1)
    if (doTapete === null) throw new Error('tapete sem imagem')
    expect(coladas[0].data.image).toBe(doTapete.textura)
  })

  it('editor: a imagem do tapete fica no contêiner do chão, e a chama da fogueira fica por cima da imagem dela', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { rodar } = rasterComFila()
    const container = new Container()
    const tapete = MOVEIS[10]
    const fogueira = MOVEIS[9]
    createPropsRenderer().draw(container, [fogueira, tapete], null, { cameraScale: 1, rendererResolution: 1 })
    rodar()
    const chao = container.children.find((c) => c.label === FLOOR_LABEL)
    if (!(chao instanceof Container)) throw new Error('sem chão')
    expect(container.getChildIndex(chao)).toBe(0)
    const noChao = chao.children.filter((c): c is Graphics => c instanceof Graphics)
    expect(noChao).toHaveLength(1)
    expect(acoes(noChao[0])).toEqual(['texture'])
    const desenhos = container.children.filter((c): c is Graphics => c instanceof Graphics && c.label === 'mobilia')
    expect(desenhos).toHaveLength(1)
    expect(acoes(desenhos[0])).toEqual(['texture'])
    // A chama (o que sobra fora do chão e do desenho) vem logo depois do desenho da fogueira.
    const indiceDoDesenho = container.getChildIndex(desenhos[0])
    const chama = container.children.find((c) => c !== chao && c !== desenhos[0])
    if (chama === undefined) throw new Error('sem chama')
    expect(container.getChildIndex(chama)).toBeGreaterThan(indiceDoDesenho)
  })
})

describe('MT3 com a chave de obra desligada', () => {
  it('nenhum caminho novo roda para os 5 tipos novos: nada de imagem pedida nem colada', () => {
    const { raster } = rasterComFila()
    const pedir = vi.spyOn(raster, 'imagemParaDesenhar')
    const g = new Graphics()
    drawPropSilhouettes(g, [...MOVEIS.slice(6), ...VARIANTES], 1, 1)
    expect(pedir).not.toHaveBeenCalled()
    expect(acoes(g)).not.toContain('texture')
    expect(raster.geradas).toBe(0)
  })
})
