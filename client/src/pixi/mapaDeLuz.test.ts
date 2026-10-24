import { describe, expect, it } from 'vitest'
import { Container, Matrix, type RenderTexture } from 'pixi.js'
import type { Light, MapData } from '../types/map'
import { AMBIENTE_PADRAO } from '../lib/periodo'
import type { Segment } from '../lib/visibility'
import {
  LUZ_POR_PERIODO,
  TINTA_NO_EDITOR,
  alfaDoContorno,
  corDaTinta,
  criarMapaDeLuz,
  criarRevisao,
  luzesDoMapa,
  matrizDaVista,
  mesmoConteudo,
  quedaDaLuz,
  tintaDaCena,
  tintaDoJogador,
  tintaDoPeriodo,
  type QuadroDoMapaDeLuz,
  type RenderizadorDoMapaDeLuz,
} from './mapaDeLuz'

function luz(over: Partial<Light> = {}): Light {
  return { id: 'l1', x: 100, y: 100, radius: 140, color: '#ffba7b', intensity: 0.85, ...over }
}

function rgb(cor: number): [number, number, number] {
  return [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255]
}

/** O ponto (x, y) está dentro do polígono? (par-ímpar) */
function dentro(poligono: readonly { x: number; y: number }[], x: number, y: number): boolean {
  let fora = true
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]
    const b = poligono[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) fora = !fora
  }
  return !fora
}

const CENA_EXTERNA: Pick<MapData, 'externa' | 'periodoFixo' | 'ambientePorPeriodo'> = { externa: true }
const CENA_INTERIOR: Pick<MapData, 'externa' | 'periodoFixo' | 'ambientePorPeriodo'> = {}

describe('mapaDeLuz: a tinta do período', () => {
  it('mistura o branco com a cor do período na força do período (noite padrão: ardósia a 85%)', () => {
    expect(rgb(corDaTinta(AMBIENTE_PADRAO.noite))).toEqual([98, 115, 162])
    expect(rgb(corDaTinta(AMBIENTE_PADRAO.tarde))).toEqual([247, 208, 170])
  })

  it('a força muda a tinta: a mesma cor a 50% sai mais clara que a 85%, e a 0% é branco', () => {
    const meia = rgb(corDaTinta({ cor: '#465a92', forca: 0.5 }))
    const cheia = rgb(corDaTinta({ cor: '#465a92', forca: 0.85 }))
    expect(meia[0]).toBeGreaterThan(cheia[0])
    expect(meia[2]).toBeGreaterThan(cheia[2])
    expect(corDaTinta({ cor: '#465a92', forca: 0 })).toBe(0xffffff)
    expect(corDaTinta({ cor: '#465a92', forca: 1 })).toBe(0x465a92)
  })

  it('dia nunca tem tinta, mesmo com cor e força (o mapa fica idêntico ao de hoje)', () => {
    expect(tintaDoPeriodo('dia', { cor: '#465a92', forca: 1 }, 1)).toBeNull()
    expect(tintaDoPeriodo('noite', { cor: '#465a92', forca: 0 }, 1)).toBeNull()
    expect(tintaDoPeriodo('noite', AMBIENTE_PADRAO.noite, 0)).toBeNull()
    const noite = tintaDoPeriodo('noite', AMBIENTE_PADRAO.noite, 1)
    expect(noite).toEqual({ periodo: 'noite', rgb: corDaTinta(AMBIENTE_PADRAO.noite), alfa: 1, fatorDaLuz: 1 })
    expect(tintaDoPeriodo('tarde', AMBIENTE_PADRAO.tarde, 1)?.fatorDaLuz).toBe(LUZ_POR_PERIODO.tarde)
  })

  it('cena interior não recebe tinta à noite; a externa e a fixa recebem', () => {
    expect(tintaDaCena(CENA_INTERIOR, 'noite', 1)).toBeNull()
    expect(tintaDaCena(CENA_EXTERNA, 'noite', 1)?.periodo).toBe('noite')
    expect(tintaDaCena({ periodoFixo: 'noite' }, 'dia', 1)?.periodo).toBe('noite')
    expect(tintaDaCena(CENA_EXTERNA, 'dia', 1)).toBeNull()
    expect(tintaDaCena(CENA_EXTERNA, null, 1)).toBeNull()
  })

  it('o ambiente da cena manda: a força 0 da noite desliga a tinta, outra força muda a cor', () => {
    expect(tintaDaCena({ externa: true, ambientePorPeriodo: { noite: { forca: 0 } } }, 'noite', 1)).toBeNull()
    const leve = tintaDaCena({ externa: true, ambientePorPeriodo: { noite: { forca: 0.3 } } }, 'noite', 1)
    const padrao = tintaDaCena(CENA_EXTERNA, 'noite', 1)
    expect(leve?.rgb).not.toBe(padrao?.rgb)
  })

  it('o editor vê a tinta a 50%', () => {
    expect(tintaDaCena(CENA_EXTERNA, 'noite', TINTA_NO_EDITOR)?.alfa).toBe(0.5)
  })

  it('o jogador lê a tinta do snapshot (ausente = dia, sem tinta)', () => {
    expect(tintaDoJogador(undefined)).toBeNull()
    expect(tintaDoJogador(null)).toBeNull()
    expect(tintaDoJogador({ periodo: 'dia', cor: '#ffffff', forca: 0 })).toBeNull()
    expect(tintaDoJogador({ periodo: 'noite', cor: '#465a92', forca: 0.85 })?.rgb).toBe(corDaTinta(AMBIENTE_PADRAO.noite))
  })
})

describe('mapaDeLuz: contorno da própria ficha', () => {
  it('cheio à noite, fraco à tarde, nada sem tinta (a conta do protótipo)', () => {
    expect(alfaDoContorno(tintaDoPeriodo('noite', AMBIENTE_PADRAO.noite, 1))).toBe(1)
    expect(alfaDoContorno(tintaDoPeriodo('tarde', AMBIENTE_PADRAO.tarde, 1))).toBeCloseTo(0.146, 2)
    expect(alfaDoContorno(null)).toBe(0)
  })
})

describe('mapaDeLuz: a luz quente', () => {
  it('a queda vai de 1 no centro a 0 na borda, sem anel duro', () => {
    expect(quedaDaLuz(0)).toBe(1)
    expect(quedaDaLuz(0.5)).toBe(0.5)
    expect(quedaDaLuz(1)).toBe(0)
    expect(quedaDaLuz(1.5)).toBe(0)
    expect(quedaDaLuz(0.125)).toBeCloseTo(0.91, 5)
  })

  it('a parede barra a luz: o ponto atrás do muro fica fora do claro, o da frente dentro', () => {
    const muro: Segment[] = [{ x1: 160, y1: 0, x2: 160, y2: 200 }]
    const [l] = luzesDoMapa([luz()], muro, 1)
    expect(dentro(l.poligono, 140, 100)).toBe(true)
    expect(dentro(l.poligono, 200, 100)).toBe(false)
    // Sem a parede o mesmo ponto acende: é a parede que barra, não o raio.
    const [solta] = luzesDoMapa([luz()], [], 1)
    expect(dentro(solta.poligono, 200, 100)).toBe(true)
  })

  it('a força da luz é a intensidade vezes o fator do período (tarde a 30%)', () => {
    expect(luzesDoMapa([luz()], [], 1)[0].forca).toBeCloseTo(0.85, 5)
    expect(luzesDoMapa([luz()], [], LUZ_POR_PERIODO.tarde)[0].forca).toBeCloseTo(0.255, 5)
    expect(luzesDoMapa([luz()], [], 0)).toEqual([])
  })

  it('luz apagada, ponto de longe (raio 0) e luz sem força não entram', () => {
    const luzes = [luz({ id: 'a', apagada: true }), luz({ id: 'b', radius: 0 }), luz({ id: 'c', intensity: 0 }), luz({ id: 'd' })]
    expect(luzesDoMapa(luzes, [], 1).map((l) => l.id)).toEqual(['d'])
  })
})

describe('mapaDeLuz: chave de revisão', () => {
  it('mesma referência ou mesmo conteúdo em lista nova = mesma revisão; conteúdo novo = revisão nova', () => {
    const revisao = criarRevisao()
    const luzes = [luz()]
    const paredes = [{ id: 'w', x1: 0, y1: 0, x2: 1, y2: 1 }]
    const r1 = revisao.de([luzes, paredes])
    expect(revisao.de([luzes, paredes])).toBe(r1)
    expect(revisao.de([[luz()], [{ id: 'w', x1: 0, y1: 0, x2: 1, y2: 1 }]])).toBe(r1)
    const r2 = revisao.de([[luz({ x: 101 })], paredes])
    expect(r2).not.toBe(r1)
    // Voltar ao conteúdo de antes também é mudança: a chave nunca reaproveita um número.
    expect(revisao.de([luzes, paredes])).not.toBe(r2)
    expect(revisao.de([luzes, paredes])).not.toBe(r1)
  })

  it('mesmoConteudo compara listas e objetos por valor', () => {
    expect(mesmoConteudo({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBe(true)
    expect(mesmoConteudo({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] })).toBe(false)
    expect(mesmoConteudo({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(mesmoConteudo([1, 2], [1, 2, 3])).toBe(false)
    expect(mesmoConteudo(null, undefined)).toBe(false)
  })
})

describe('mapaDeLuz: a vista', () => {
  it('a matriz leva o mundo à textura a meia resolução', () => {
    const m = matrizDaVista({ x: 40, y: -20, escala: 2, largura: 800, altura: 600 }, new Matrix())
    const p = m.apply({ x: 10, y: 30 })
    // tela = 10 * 2 + 40 = 60 → textura 30; 30 * 2 - 20 = 40 → 20
    expect(p.x).toBeCloseTo(30)
    expect(p.y).toBeCloseTo(20)
  })
})

describe('mapaDeLuz: o refazer', () => {
  interface Chamada {
    container: Container
    target: RenderTexture
    clearColor: number
    transform: Matrix
  }
  function montar() {
    const chamadas: Chamada[] = []
    const renderizador: RenderizadorDoMapaDeLuz = { render: (opcoes) => void chamadas.push(opcoes) }
    const mapa = criarMapaDeLuz(renderizador)
    let obstaculosPedidos = 0
    const quadro = (over: Partial<QuadroDoMapaDeLuz> = {}): QuadroDoMapaDeLuz => ({
      tinta: tintaDoPeriodo('noite', AMBIENTE_PADRAO.noite, 1),
      revisao: 1,
      luzes: () => [luz()],
      obstaculos: () => {
        obstaculosPedidos += 1
        return []
      },
      mapa: { largura: 1000, altura: 800 },
      vista: { x: 0, y: 0, escala: 1, largura: 800, altura: 600 },
      fichas: [],
      ...over,
    })
    return { mapa, chamadas, quadro, obstaculos: () => obstaculosPedidos }
  }

  it('sem tinta: o sprite some, sai do mundo, e nada é desenhado (o dia fica idêntico)', () => {
    const { mapa, chamadas, quadro } = montar()
    const mundo = new Container()
    mundo.addChild(mapa.sprite, mapa.contorno)
    mapa.atualizar(quadro({ tinta: null }))
    mapa.atualizar(null)
    expect(mapa.sprite.visible).toBe(false)
    expect(mapa.contorno.visible).toBe(false)
    expect(mundo.children).toHaveLength(0)
    expect(chamadas).toHaveLength(0)
  })

  it('à noite desenha uma vez e só refaz quando muda a vista, a revisão ou a tinta', () => {
    const { mapa, chamadas, quadro, obstaculos } = montar()
    mapa.atualizar(quadro())
    expect(mapa.sprite.visible).toBe(true)
    expect(mapa.sprite.blendMode).toBe('multiply')
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].clearColor).toBe(0xffffff)
    mapa.atualizar(quadro())
    expect(chamadas).toHaveLength(1)
    // Pan: refaz o desenho, mas a geometria (raycast) é a mesma.
    mapa.atualizar(quadro({ vista: { x: 30, y: 0, escala: 1, largura: 800, altura: 600 } }))
    expect(chamadas).toHaveLength(2)
    expect(obstaculos()).toBe(1)
    // Parede ou luz nova: revisão nova, geometria nova.
    mapa.atualizar(quadro({ revisao: 2, vista: { x: 30, y: 0, escala: 1, largura: 800, altura: 600 } }))
    expect(chamadas).toHaveLength(3)
    expect(obstaculos()).toBe(2)
    mapa.atualizar(quadro({ revisao: 2, tinta: tintaDoPeriodo('tarde', AMBIENTE_PADRAO.tarde, 1), vista: { x: 30, y: 0, escala: 1, largura: 800, altura: 600 } }))
    expect(chamadas).toHaveLength(4)
    expect(mapa.medidas.refeitos).toBe(4)
  })

  it('o sprite fica sob a vista: no mundo, na posição e escala que levam a textura à tela', () => {
    const { mapa, quadro } = montar()
    mapa.atualizar(quadro({ vista: { x: 40, y: -20, escala: 2, largura: 800, altura: 600 } }))
    expect(mapa.sprite.position.x).toBeCloseTo(-20)
    expect(mapa.sprite.position.y).toBeCloseTo(10)
    expect(mapa.sprite.scale.x).toBeCloseTo(1)
  })

  it('o editor põe a tinta a 50% no próprio sprite', () => {
    const { mapa, quadro } = montar()
    mapa.atualizar(quadro({ tinta: tintaDoPeriodo('noite', AMBIENTE_PADRAO.noite, TINTA_NO_EDITOR) }))
    expect(mapa.sprite.alpha).toBe(0.5)
  })

  it('o contorno creme só aparece com ficha e com tinta escura', () => {
    const { mapa, quadro } = montar()
    mapa.atualizar(quadro({ fichas: [{ x: 50, y: 50, raio: 20 }] }))
    expect(mapa.contorno.visible).toBe(true)
    mapa.atualizar(quadro({ fichas: [] }))
    expect(mapa.contorno.visible).toBe(false)
    mapa.atualizar(quadro({ tinta: null, fichas: [{ x: 50, y: 50, raio: 20 }] }))
    expect(mapa.contorno.visible).toBe(false)
  })
})
