import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS, emOrdemDoTresQuartos } from '../lib/mobilia/vistaTresQuartos'
import { carregarMoveisDoMeioTermo, drawPropSilhouettes } from './drawPropSilhouettes'
import { createChamasDasFogueiras } from './chamasDasFogueiras'
import { createPropsRenderer } from './drawProps'
import { RasterDosMoveis, trocarRasterNoTeste } from './rasterDosMoveis'

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `mocked://${path}` }))

/**
 * VISTA 3/4 na TELA (MT11): com a chave de obra ligada e o mapa em 3/4, os
 * móveis saem pela BASE (o mais ao sul por cima), no jogador (uma lista por
 * faixa) e no editor (um desenho por móvel); a chama da fogueira sobe com a
 * lenha. Sem a vista, ou com a chave desligada, nada muda.
 */

type Instrucao = Graphics['context']['instructions'][number]
type Textura = Extract<Instrucao, { action: 'texture' }>

function movel(id: string, mobilia: NonNullable<Prop['mobilia']>, y: number, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x: 200, y, width: 50, height: 50, linkedMapPath: null, mobilia, ...extra }
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

function texturas(g: Graphics): Textura[] {
  return g.context.instructions.filter((i): i is Textura => i.action === 'texture')
}

/** O y do centro de cada móvel colado, na ordem de pintura. */
function ordemPintada(g: Graphics): number[] {
  return texturas(g).map((t) => t.data.transform.ty)
}

/** Três móveis empilhados: a lista vem do sul para o norte, e um tapete por último. */
const PILHA: Prop[] = [
  movel('bau', 'bau', 230),
  movel('caixa', 'caixa', 200),
  movel('barril', 'barril', 180),
  movel('tapete', 'tapete', 205, { width: 150, height: 100 }),
]

afterEach(() => {
  trocarObraNoTeste(false)
  trocarRasterNoTeste(null)
})

describe('a ordem pela base na 3/4', () => {
  it('jogador: com a obra e a 3/4, o tapete primeiro e o resto do norte para o sul', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { rodar } = rasterComFila()
    const g = new Graphics()
    drawPropSilhouettes(g, PILHA, 1, 1, 'tres-quartos')
    rodar()
    expect(ordemPintada(g)).toEqual([205, 180, 200, 230])
  })

  it('sem a vista: a ordem da lista (o tapete primeiro), como antes', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { rodar } = rasterComFila()
    const g = new Graphics()
    drawPropSilhouettes(g, PILHA, 1, 1)
    rodar()
    expect(ordemPintada(g)).toEqual([205, 230, 200, 180])
  })

  it('a base é a da pegada GIRADA: a cama de 1 x 3 deitada 90° tem a base mais ao norte', () => {
    const cama = movel('cama', 'catre', 200, { width: 50, height: 150 })
    const caixa = movel('caixa', 'caixa', 230, { width: 50, height: 50 })
    expect(emOrdemDoTresQuartos([caixa, cama]).map((p) => p.id)).toEqual(['caixa', 'cama'])
    expect(emOrdemDoTresQuartos([caixa, { ...cama, rotation: 90 }]).map((p) => p.id)).toEqual(['cama', 'caixa'])
  })

  it('editor: os desenhos dos móveis trocam de lugar pela base, sem mexer no chão nem nas imagens', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { rodar } = rasterComFila()
    const container = new Container()
    const renderer = createPropsRenderer()
    const vista = { cameraScale: 1, rendererResolution: 1, vistaDosMoveis: 'tres-quartos' as const }
    // Fora de ordem de propósito: o editor põe cada desenho novo embaixo (índice 0), então esta lista sai 200, 230, 180 sem a 3/4.
    renderer.draw(container, [PILHA[2], PILHA[0], PILHA[1], PILHA[3]], null, vista)
    rodar()
    const ys = container.children.filter((c) => c.label === 'mobilia').map((c) => (c instanceof Graphics ? (texturas(c)[0]?.data.transform.ty ?? -1) : -1))
    expect(ys).toEqual([180, 200, 230])
    renderer.destruir()
  })
})

describe('a chave de obra desligada não pinta a 3/4', () => {
  it('a peça nova (sempre em imagem) sai igual com e sem a vista quando a obra está desligada', async () => {
    await carregarMoveisDoMeioTermo()
    const { rodar } = rasterComFila()
    const mesa = movel('m', 'mesaQuadrada', 200)
    const semVista = new Graphics()
    const comVista = new Graphics()
    drawPropSilhouettes(semVista, [mesa], 1, 1)
    drawPropSilhouettes(comVista, [mesa], 1, 1, 'tres-quartos')
    rodar()
    drawPropSilhouettes(semVista, [mesa], 1, 1)
    drawPropSilhouettes(comVista, [mesa], 1, 1, 'tres-quartos')
    const [a] = texturas(semVista)
    const [b] = texturas(comVista)
    expect(b.data.image).toBe(a.data.image)
    expect([b.data.dx, b.data.dy, b.data.dw, b.data.dh]).toEqual([a.data.dx, a.data.dy, a.data.dw, a.data.dh])
  })

  it('com a obra ligada a 3/4 é outra imagem, mais alta (o tampo sobe acima da pegada)', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { rodar } = rasterComFila()
    const mesa = movel('m', 'mesaQuadrada', 200)
    const semVista = new Graphics()
    const comVista = new Graphics()
    drawPropSilhouettes(semVista, [mesa], 1, 1)
    drawPropSilhouettes(comVista, [mesa], 1, 1, 'tres-quartos')
    rodar()
    drawPropSilhouettes(semVista, [mesa], 1, 1)
    drawPropSilhouettes(comVista, [mesa], 1, 1, 'tres-quartos')
    const [a] = texturas(semVista)
    const [b] = texturas(comVista)
    expect(b.data.image).not.toBe(a.data.image)
    expect(b.data.dy).toBeLessThan(a.data.dy - 10)
  })
})

describe('a chama da fogueira na 3/4', () => {
  const fogueira: Prop = movel('f', 'fogueira', 300, { width: 100, height: 100 })

  it('sobe com a lenha só com a obra ligada e o mapa em 3/4', () => {
    const chamas = createChamasDasFogueiras()
    const antes = chamas.colocar(fogueira, { cameraScale: 1 })?.position.y ?? NaN
    const semObra = chamas.colocar(fogueira, { cameraScale: 1, vistaDosMoveis: 'tres-quartos' })?.position.y ?? NaN
    expect(semObra).toBe(antes)
    trocarObraNoTeste(true)
    const tres = chamas.colocar(fogueira, { cameraScale: 1, vistaDosMoveis: 'tres-quartos' })?.position.y ?? NaN
    expect(tres).toBeCloseTo(antes + DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS, 6)
    expect(DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS).toBeLessThan(-3)
    // A fogueira de Lado já é desenhada em pé: a chama fica onde está.
    const deLado = { ...fogueira, mobiliaVista: 'lado' as const }
    expect(chamas.colocar(deLado, { cameraScale: 1, vistaDosMoveis: 'tres-quartos' })?.position.y).toBe(chamas.colocar(deLado, { cameraScale: 1 })?.position.y)
    chamas.destruir()
  })
})
