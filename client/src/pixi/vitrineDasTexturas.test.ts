/**
 * VITRINE DAS TEXTURAS (F7): onde a composição fica (pixel inteiro da tela,
 * tela + margem, ladrilhos do centro para fora) e quando compor de novo
 * (metade da margem gasta, zoom, câmera parada fora do lugar ou com a pintura
 * desatualizada). E, no renderer de texturas com palco, que a pintura nova
 * compõe na hora, o quadro parado não compõe, e o pan compõe aos poucos por
 * trás (um ladrilho por quadro) e troca só no fim.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Texture, type Renderer, type Ticker } from 'pixi.js'
import type { PinceladaDeTextura } from '../types/map'
import { createTexturasRenderer, type EntradaDasTexturas } from './drawTexturas'
import { LADO_DO_LADRILHO_PX, MARGEM_DA_VITRINE, PARADA_MS, ZOOM_SEM_COMPOR, ladrilhosDoQuadro, precisaCompor, quadroDaVitrine, type EstadoDaVitrine } from './vitrineDasTexturas'

afterEach(() => {
  vi.useRealTimers()
})

const TELA = { width: 2560, height: 1440 }

describe('quadro e ladrilhos da vitrine', () => {
  it('tela + margem em px inteiros do aparelho, e o mundo coberto sai da mesma conta da tela', () => {
    const q = quadroDaVitrine({ s: 0.5, tx: -100.3, ty: 40.7 }, TELA, 1.5)
    const mx = Math.ceil(3840 * MARGEM_DA_VITRINE)
    expect(q.x0).toBe(-mx)
    expect(Number.isInteger(q.x0) && Number.isInteger(q.y0)).toBe(true)
    expect(q.largura).toBe(3840 + 2 * mx)
    expect(q.altura).toBe(2160 + 2 * Math.ceil(2160 * MARGEM_DA_VITRINE))
    expect(q.vista.minX).toBeCloseTo((0 + 100.3) / 0.5)
    expect(q.vista.maxX).toBeCloseTo((2560 + 100.3) / 0.5)
    expect(q.vista.minY).toBeCloseTo((0 - 40.7) / 0.5)
    expect(q.mundo.minX).toBeCloseTo((-mx / 1.5 + 100.3) / 0.5)
  })

  it('os ladrilhos cobrem o quadro, em px inteiros, e o do centro vem primeiro', () => {
    const q = quadroDaVitrine({ s: 1, tx: 0, ty: 0 }, TELA, 1.5)
    const lista = ladrilhosDoQuadro(q, 1.5)
    const colunas = Math.ceil(q.largura / LADO_DO_LADRILHO_PX)
    const linhas = Math.ceil(q.altura / LADO_DO_LADRILHO_PX)
    expect(lista).toHaveLength(colunas * linhas)
    expect(lista.every((l) => Number.isInteger(l.x) && Number.isInteger(l.y))).toBe(true)
    const cx = q.x0 + q.largura / 2
    const primeiro = lista[0]
    expect(primeiro.x <= cx + LADO_DO_LADRILHO_PX && cx - LADO_DO_LADRILHO_PX < primeiro.x + LADO_DO_LADRILHO_PX).toBe(true)
    // O canto do ladrilho no mundo é o px dele de volta pela câmera.
    expect(primeiro.mundo.minX).toBeCloseTo(primeiro.x / 1.5)
    expect(primeiro.mundo.maxX - primeiro.mundo.minX).toBeCloseTo(LADO_DO_LADRILHO_PX / 1.5)
  })
})

describe('quando compor de novo', () => {
  const camera = { s: 1, tx: 0, ty: 0 }
  const frente = quadroDaVitrine(camera, TELA, 1)
  const base: EstadoDaVitrine = { frente, desatualizada: false, parada: 1000 }
  const andando = { ...base, parada: 0 }

  it('sem composição: compõe; mesma câmera e pintura em dia: não', () => {
    expect(precisaCompor({ ...base, frente: null }, frente)).toBe(true)
    expect(precisaCompor(base, frente)).toBe(false)
  })

  it('pan andando: dentro da metade da margem não compõe; passou dela, compõe antes do buraco', () => {
    // Margem de 320 px na largura: metade = 160.
    expect(precisaCompor(andando, quadroDaVitrine({ s: 1, tx: -150.5, ty: 0 }, TELA, 1))).toBe(false)
    expect(precisaCompor(andando, quadroDaVitrine({ s: 1, tx: -170, ty: 0 }, TELA, 1))).toBe(true)
  })

  it('zoom andando: até o limite reaproveita, além dele compõe', () => {
    const perto = (s: number) => quadroDaVitrine({ s, tx: 1280 - 1280 * s, ty: 720 - 720 * s }, TELA, 1)
    expect(precisaCompor(andando, perto(ZOOM_SEM_COMPOR - 0.01))).toBe(false)
    expect(precisaCompor(andando, perto(ZOOM_SEM_COMPOR + 0.01))).toBe(true)
  })

  it('parada: compõe se a câmera não é a da composição (volta a 1:1) ou se a pintura está desatualizada', () => {
    const andou = quadroDaVitrine({ s: 1, tx: -10.5, ty: 0 }, TELA, 1)
    expect(precisaCompor({ ...base, parada: PARADA_MS - 1 }, andou)).toBe(false)
    expect(precisaCompor({ ...base, parada: PARADA_MS }, andou)).toBe(true)
    expect(precisaCompor({ ...base, desatualizada: true, parada: PARADA_MS - 1 }, frente)).toBe(false)
    expect(precisaCompor({ ...base, desatualizada: true }, frente)).toBe(true)
  })
})

describe('renderer de texturas com palco (F7)', () => {
  const MAPA = { width: 30, height: 20, grid: 64 }
  const pincel: PinceladaDeTextura = { id: '1', tipo: 'pincel', textura: 'grama', forca: 1, raio: 100, pontos: [{ x: 300, y: 300 }] }
  const entrada: EntradaDasTexturas = { cena: 'a', mapa: MAPA, passos: [pincel], importadas: undefined, regioes: [], desenhos: [] }

  function palcoFalso() {
    let passo: (() => void) | null = null
    const ticker = {
      add: (f: () => void) => {
        passo = f
      },
      remove: vi.fn(),
    } as unknown as Ticker // as: só o add/remove que a vitrine usa
    const render = vi.fn()
    const renderer = { resolution: 1, screen: { width: 800, height: 600 }, view: { antialias: false }, render } as unknown as Renderer // as: só o que a vitrine lê
    return { palco: { renderer, ticker }, render, quadro: () => passo?.() }
  }

  // Tela 800 x 600 + 12,5% de margem = 1000 x 750 px: 2 x 1 ladrilhos.
  const LADRILHOS = Math.ceil(1000 / LADO_DO_LADRILHO_PX) * Math.ceil(750 / LADO_DO_LADRILHO_PX)

  it('pintura nova compõe tudo na hora; parado não compõe; o pan compõe por trás, um ladrilho por quadro', async () => {
    vi.useFakeTimers()
    const p = palcoFalso()
    const r = createTexturasRenderer({
      rasterizar: async (plano) => plano.camadas.map(() => document.createElement('canvas')),
      ladrilho: async () => new Texture(),
      mascara: () => new Texture(),
      palco: p.palco,
    })
    const mundo = new Container()
    mundo.addChild(r.camada)
    r.atualizar(entrada)
    await vi.advanceTimersByTimeAsync(0)
    p.quadro()
    expect(p.render).toHaveBeenCalledTimes(LADRILHOS)
    const chamada = p.render.mock.calls[0][0] as { clearColor: number[]; container: Container }
    expect(chamada.clearColor).toEqual([0, 0, 0, 0])
    // A pilha (com as camadas e as máscaras) nunca vai para o palco; no palco só os sprites dos ladrilhos.
    expect(chamada.container.parent).toBeNull()
    expect(chamada.container.children.length).toBeGreaterThan(0)
    const sprites = (r.camada.children[0] as Container).children
    expect(sprites).toHaveLength(LADRILHOS)
    expect(sprites.every((s) => s instanceof Sprite)).toBe(true)
    // Parado: nenhuma composição nova.
    await vi.advanceTimersByTimeAsync(1000)
    p.quadro()
    p.quadro()
    expect(p.render).toHaveBeenCalledTimes(LADRILHOS)
    // Pan além da metade da margem: compõe por trás, um ladrilho por quadro, e só então troca.
    mundo.position.set(-200, 0)
    p.quadro()
    expect(p.render).toHaveBeenCalledTimes(LADRILHOS + 1)
    expect(r.camada.children).toHaveLength(2)
    for (let i = 1; i < LADRILHOS; i += 1) p.quadro()
    expect(p.render).toHaveBeenCalledTimes(2 * LADRILHOS)
    expect(r.camada.children).toHaveLength(1)
    // Pintura nova: tudo na hora.
    r.atualizar({ ...entrada, passos: [{ ...pincel, id: '2', pontos: [{ x: 400, y: 300 }] }] })
    await vi.advanceTimersByTimeAsync(1000)
    p.quadro()
    expect(p.render).toHaveBeenCalledTimes(3 * LADRILHOS)
    r.destruir()
  })
})
