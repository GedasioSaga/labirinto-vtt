/**
 * PEDAÇOS DO CHÃO (MT7) e a costura em `drawTexturas` com a chave de obra:
 * nível pela vista, fila em fatias, cache com teto (o pedaço em uso nunca
 * sai; o que sai é destruído), troca de nível sem buraco, e o renderer de
 * texturas que, com a chave LIGADA, põe os pedaços por cima do ladrilho
 * repetido (placeholder) e, DESLIGADA, monta o mesmo de antes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, MaskFilter, Sprite, Texture, TilingSprite, type Rectangle } from 'pixi.js'
import type { PinceladaDeTextura } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { LADO_DO_PEDACO, type ChaoDaTextura, type ImagemDoLadrilho } from '../texturas/meioTermo/chaoNoMundo'
import { BYTES_DO_PEDACO, CacheDoChao, MAX_PEDACOS_NA_VISTA, areaNaVista, chaoDoGrupo, montarChaoEmPedacos, nivelDaVista, pedacosDaArea } from './pedacosDoChao'
import { createTexturasRenderer, type EntradaDasTexturas } from './drawTexturas'

function ladrilhoXadrez(lado = 16): ImagemDoLadrilho {
  const pixels = new Uint8ClampedArray(lado * lado * 4)
  for (let i = 0; i < lado * lado; i += 1) {
    const claro = ((i % lado) + Math.floor(i / lado)) % 2 === 0
    pixels.set(claro ? [200, 180, 120, 255] : [120, 140, 90, 255], i * 4)
  }
  return { lado, pixels }
}

const CHAO: ChaoDaTextura = { ladrilho: ladrilhoXadrez(), ladoNoMundo: 192, semente: 7, torcao: 0.15 }

/** Fila manual: cada `rodar()` executa as fatias agendadas até aquele momento. */
function filaManual() {
  let agendadas: (() => void)[] = []
  return {
    agendar: (f: () => void) => agendadas.push(f),
    rodar: () => {
      const agora = agendadas
      agendadas = []
      for (const f of agora) f()
      return agora.length
    },
    tudo() {
      let voltas = 0
      while (this.rodar() > 0) voltas += 1
      return voltas
    },
  }
}

afterEach(() => {
  trocarObraNoTeste(false)
  vi.useRealTimers()
})

describe('nível e pedaços da vista', () => {
  it('a vista de 1440 x 900 a 100% fica no nível 0; o mapa afastado sobe de nível até caber no teto', () => {
    expect(nivelDaVista({ minX: 0, minY: 0, maxX: 1440, maxY: 900 })).toBe(0)
    const longe = { minX: 0, minY: 0, maxX: 14_400, maxY: 9000 }
    const nivel = nivelDaVista(longe)
    expect(nivel).toBeGreaterThan(0)
    expect(pedacosDaArea(longe, nivel).length).toBeLessThanOrEqual(MAX_PEDACOS_NA_VISTA)
  })

  it('os pedaços cobrem a área e saem do centro para fora', () => {
    const area = { minX: 100, minY: 50, maxX: 900, maxY: 600 }
    const lista = pedacosDaArea(area, 0)
    expect(lista).toHaveLength(4 * 3)
    const centro = lista[0]
    expect(centro.i * LADO_DO_PEDACO).toBeLessThanOrEqual(500)
    expect((centro.i + 1) * LADO_DO_PEDACO).toBeGreaterThan(500)
    expect(areaNaVista({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, { minX: 200, minY: 0, maxX: 300, maxY: 100 })).toBeNull()
  })
})

describe('cache dos pedaços', () => {
  it('pinta em fatias: nada fica pronto sem a fila andar, e cada fatia pinta só um pedaço de cada vez', () => {
    const fila = filaManual()
    const cache = new CacheDoChao({ agendar: fila.agendar, fatiaMs: 0, tetoDeBytes: 64 * BYTES_DO_PEDACO })
    const prontos: Texture[] = []
    const pedidos = [0, 1, 2].map((i) => cache.pedir('c', CHAO, { i, j: 0, nivel: 0 }, (t) => prontos.push(t)))
    expect(pedidos.every((p) => p.textura === null)).toBe(true)
    fila.rodar()
    // Com fatia de 0 ms, uma fatia pinta um passo de linhas: o primeiro pedaço ainda não acabou.
    expect(prontos).toHaveLength(0)
    const voltas = fila.tudo()
    expect(prontos).toHaveLength(3)
    expect(voltas).toBeGreaterThanOrEqual((3 * LADO_DO_PEDACO) / 8 - 2)
    // O mesmo pedaço pedido de novo vem pronto, sem pintar.
    const denovo = cache.pedir('c', CHAO, { i: 1, j: 0, nivel: 0 }, () => undefined)
    expect(denovo.textura).toBe(prontos[1])
    expect(cache.pintados).toBe(3)
    cache.destruir()
  })

  it('teto de bytes: os sem uso mais antigos saem e são destruídos; o pedaço em uso nunca sai', () => {
    const fila = filaManual()
    const cache = new CacheDoChao({ agendar: fila.agendar, fatiaMs: 1000, tetoDeBytes: 3 * BYTES_DO_PEDACO })
    const segurado = cache.pedir('c', CHAO, { i: 0, j: 0, nivel: 0 }, () => undefined)
    fila.tudo()
    const texturas: Texture[] = []
    for (let i = 1; i <= 5; i += 1) {
      const p = cache.pedir('c', CHAO, { i, j: 0, nivel: 0 }, (t) => texturas.push(t))
      fila.tudo()
      p.soltar()
    }
    expect(cache.quantos).toBeLessThanOrEqual(3)
    expect(cache.destruidos).toBeGreaterThanOrEqual(2)
    expect(texturas.slice(0, 2).every((t) => t.destroyed)).toBe(true)
    const deNovo = cache.pedir('c', CHAO, { i: 0, j: 0, nivel: 0 }, () => undefined)
    expect(deNovo.textura).not.toBeNull()
    expect(deNovo.textura?.destroyed).toBe(false)
    segurado.soltar()
    deNovo.soltar()
    cache.destruir()
  })

  it('o pedaço que saiu da vista antes de começar sai da fila sem ser pintado', () => {
    const fila = filaManual()
    const cache = new CacheDoChao({ agendar: fila.agendar, fatiaMs: 1000 })
    const p = cache.pedir('c', CHAO, { i: 0, j: 0, nivel: 0 }, () => undefined)
    p.soltar()
    fila.tudo()
    expect(cache.pintados).toBe(0)
    expect(cache.quantos).toBe(0)
  })
})

describe('a camada em pedaços', () => {
  function montar(cache: CacheDoChao, vista = { minX: 0, minY: 0, maxX: 600, maxY: 400 }) {
    const repetida = new TilingSprite({ texture: Texture.WHITE })
    const prontas = vi.fn()
    const camada = montarChaoEmPedacos({ cache, chaveDoChao: 'grama#0#192#meio-termo-1', chao: CHAO, caixa: { minX: 0, minY: 0, maxX: 2000, maxY: 2000 }, repetida, vista, aoFicarPronto: prontas })
    return { camada, repetida, prontas }
  }
  const sprites = (c: Container) => (c.children[1] as Container).children.filter((s) => s instanceof Sprite)

  it('o ladrilho de hoje fica por baixo até os pedaços chegarem; depois some, e a vista nova solta os de fora', async () => {
    const fila = filaManual()
    const cache = new CacheDoChao({ agendar: fila.agendar, fatiaMs: 1000 })
    const { camada, repetida, prontas } = montar(cache)
    expect(camada.grupo.children[0]).toBe(repetida)
    expect(repetida.renderable).toBe(true)
    expect(camada.faltam).toBe(3 * 2)
    fila.tudo()
    await camada.pronto()
    expect(camada.faltam).toBe(0)
    expect(repetida.renderable).toBe(false)
    expect(sprites(camada.grupo)).toHaveLength(6)
    expect(prontas).toHaveBeenCalledTimes(1)
    // Mesma faixa de pedaços: nada muda.
    camada.ajustar({ minX: 10, minY: 10, maxX: 610, maxY: 410 })
    expect(sprites(camada.grupo)).toHaveLength(6)
    // A vista andou para a direita: os pedaços da coluna da esquerda saem do palco.
    camada.ajustar({ minX: 600, minY: 0, maxX: 1200, maxY: 400 })
    expect(repetida.renderable).toBe(true)
    fila.tudo()
    expect(sprites(camada.grupo).every((s) => s.x >= 512)).toBe(true)
    camada.soltar()
    expect(camada.grupo.destroyed).toBe(true)
    expect(chaoDoGrupo(camada.grupo)).toBeUndefined()
    cache.destruir()
  })

  it('trocar de nível mantém os pedaços de antes por baixo até os novos chegarem (sem buraco)', () => {
    const fila = filaManual()
    const cache = new CacheDoChao({ agendar: fila.agendar, fatiaMs: 1000 })
    const { camada } = montar(cache)
    fila.tudo()
    const antes = sprites(camada.grupo)
    camada.ajustar({ minX: 0, minY: 0, maxX: 2000, maxY: 2000 })
    // Novo nível pedido e ainda não pintado: os de antes continuam no palco.
    expect(camada.faltam).toBeGreaterThan(0)
    expect(antes.every((s) => !s.destroyed)).toBe(true)
    fila.tudo()
    expect(camada.faltam).toBe(0)
    expect(antes.every((s) => s.destroyed)).toBe(true)
    camada.soltar()
    cache.destruir()
  })

  it('F1: a máscara entra como filtro com a área presa a vista ∩ caixa, que anda com a vista (mesmo sem trocar de pedaços)', () => {
    const fila = filaManual()
    const cache = new CacheDoChao({ agendar: fila.agendar, fatiaMs: 1000 })
    const mascara = new Sprite(Texture.WHITE)
    const caixa = { minX: 100, minY: 50, maxX: 2000, maxY: 1500 }
    const camada = montarChaoEmPedacos({ cache, chaveDoChao: 'grama#0#192#meio-termo-1', chao: CHAO, caixa, repetida: new TilingSprite({ texture: Texture.WHITE }), vista: { minX: 0.4, minY: 0, maxX: 600.2, maxY: 400 }, mascara })
    const filtro = camada.grupo.filters?.[0]
    expect(filtro).toBeInstanceOf(MaskFilter)
    expect((filtro as MaskFilter).sprite).toBe(mascara)
    expect((filtro as MaskFilter).channel).toBe('alpha')
    expect(camada.grupo.mask).toBeFalsy()
    // A máscara fica na cena (anda com o mundo) sem desenhar, como no `setMask` de sprite.
    expect(mascara.renderable).toBe(false)
    // Vista ∩ caixa, com pixel inteiro para fora (como o recorte da repetida).
    const area = () => {
      const a = camada.grupo.filterArea as Rectangle | undefined // as: o getter do Pixi pode não ter área
      if (a === undefined) throw new Error('sem área do filtro')
      return { x: a.x, y: a.y, w: a.width, h: a.height }
    }
    expect(area()).toEqual({ x: 100, y: 50, w: 501, h: 350 })
    // Pan dentro da mesma faixa de pedaços: a área anda junto.
    camada.ajustar({ minX: 150, minY: 60, maxX: 750, maxY: 460 })
    expect(area()).toEqual({ x: 150, y: 60, w: 600, h: 400 })
    // Zoom afastado: a área fica presa à caixa da pintura.
    camada.ajustar({ minX: -5000, minY: -5000, maxX: 9000, maxY: 9000 })
    expect(area()).toEqual({ x: 100, y: 50, w: 1900, h: 1450 })
    // Fora da vista: o grupo não desenha (área vazia faria o Pixi pular o filtro e desenhar sem máscara).
    camada.ajustar({ minX: 3000, minY: 3000, maxX: 3600, maxY: 3400 })
    expect(camada.grupo.renderable).toBe(false)
    camada.ajustar({ minX: 0, minY: 0, maxX: 600, maxY: 400 })
    expect(camada.grupo.renderable).toBe(true)
    // Soltar tira o filtro antes da textura da máscara sair.
    const destruir = vi.spyOn(filtro as MaskFilter, 'destroy')
    camada.soltar()
    expect(destruir).toHaveBeenCalled()
    cache.destruir()
  })
})

describe('drawTexturas com a chave de obra (MT7)', () => {
  const MAPA = { width: 30, height: 20, grid: 64 }
  const pincel: PinceladaDeTextura = { id: '1', tipo: 'pincel', textura: 'grama', forca: 1, raio: 100, pontos: [{ x: 300, y: 300 }] }
  const entrada = (passos: PinceladaDeTextura[]): EntradaDasTexturas => ({ cena: 'a', mapa: MAPA, passos, importadas: undefined, regioes: [], desenhos: [] })

  function renderer(fila: ReturnType<typeof filaManual>) {
    const cache = new CacheDoChao({ agendar: fila.agendar, fatiaMs: 1000 })
    const destruir = vi.spyOn(cache, 'destruir')
    const r = createTexturasRenderer({
      rasterizar: async (plano) => plano.camadas.map(() => document.createElement('canvas')),
      ladrilho: async () => new Texture(),
      mascara: () => new Texture(),
      pixelsDoLadrilho: () => ladrilhoXadrez(),
      cacheDoChao: cache,
    })
    return { r, cache, destruir }
  }

  it('desligada: o palco é o de antes (o ladrilho repetido com a máscara), sem pedaço', async () => {
    vi.useFakeTimers()
    const fila = filaManual()
    const { r, cache } = renderer(fila)
    r.atualizar(entrada([pincel]))
    await vi.advanceTimersByTimeAsync(0)
    const filhos = r.camada.children
    expect(filhos[0]).toBeInstanceOf(TilingSprite)
    expect(filhos[0].mask).toBeInstanceOf(Sprite)
    expect(filhos.some((c) => chaoDoGrupo(c) !== undefined)).toBe(false)
    expect(cache.quantos).toBe(0)
    r.destruir()
  })

  it('ligada: o grupo de pedaços leva a máscara, a vista pede pedaços, ligar e desligar pinta de novo, e destruir solta o cache', async () => {
    vi.useFakeTimers()
    trocarObraNoTeste(true)
    const fila = filaManual()
    const { r, cache, destruir } = renderer(fila)
    r.ajustarAVista({ minX: 0, minY: 0, maxX: 800, maxY: 600 })
    r.atualizar(entrada([pincel]))
    await vi.advanceTimersByTimeAsync(0)
    const grupo = r.camada.children[0]
    expect(chaoDoGrupo(grupo)).toBeDefined()
    expect((grupo.filters?.[0] as MaskFilter).sprite).toBeInstanceOf(Sprite)
    expect(grupo.children[0]).toBeInstanceOf(TilingSprite)
    expect(cache.quantos).toBeGreaterThan(0)
    fila.tudo()
    expect(chaoDoGrupo(grupo)?.faltam).toBe(0)
    // Desligar: a mesma entrada pinta de novo, no desenho de antes, e o grupo é solto.
    trocarObraNoTeste(false)
    r.atualizar(entrada([pincel]))
    await vi.advanceTimersByTimeAsync(1000)
    expect(grupo.destroyed).toBe(true)
    expect(r.camada.children[0]).toBeInstanceOf(TilingSprite)
    r.destruir()
    expect(destruir).toHaveBeenCalled()
  })
})
