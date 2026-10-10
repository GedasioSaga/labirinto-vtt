/**
 * RELEVO (fatia 1): a terra é a UNIÃO das regiões — sem divisa interna; a
 * sombra no mar e o friso saem só da costa (terra-mar); a sombra de fronteira
 * só onde há terra dos dois lados. Chave por mapa, ligada por padrão só no
 * Continente. E a regra da névoa: cada tela gera o relevo das regiões que ELA
 * recebeu — região fora do recorte do jogador não deixa rastro no plano.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Region, RegionPoint, Token } from '../types/map'
import { createEmptyMap, setRelevo, setTipoDeMapa } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { filterMapForPlayer } from './fogFilter'
import { visibleRegions } from './layers'
import {
  TETO_DA_TEXTURA,
  bordasDaTerra,
  planoDoRelevo,
  relevoLigado,
  tamanhoDaTextura,
  terrasDoRelevo,
  unidadeDoRelevo,
  type Segmento,
} from './relevo'

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function regiao(id: string, points: RegionPoint[], extra: Partial<Region> = {}): Region {
  return { id, points, tag: 'region', fillColor: '#76c577', fillPattern: 'solid', data: {}, ...extra }
}

/** O segmento está todo sobre a reta x = valor (ou y = valor), entre `de` e `ate` na outra coordenada? */
function sobreVertical(s: Segmento, x: number, de: number, ate: number): boolean {
  return [s.a, s.b].every((p) => Math.abs(p.x - x) < 0.01 && p.y >= de - 0.01 && p.y <= ate + 0.01)
}
function sobreHorizontal(s: Segmento, y: number, de: number, ate: number): boolean {
  return [s.a, s.b].every((p) => Math.abs(p.y - y) < 0.01 && p.x >= de - 0.01 && p.x <= ate + 0.01)
}
function comprimento(segmentos: readonly Segmento[]): number {
  return segmentos.reduce((soma, s) => soma + Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), 0)
}

describe('chave "Relevo" e o padrão por tipo de mapa', () => {
  const normal = createEmptyMap('m', 'Masmorra', 10, 10, 50)
  const continente: MapData = { ...normal, continente: true }

  it('sem escolha do mestre: ligado no Continente (e no mapa-mundi antigo), desligado no Normal', () => {
    expect(relevoLigado(normal)).toBe(false)
    expect(relevoLigado(continente)).toBe(true)
    expect(relevoLigado({ ...normal, worldMap: true })).toBe(true)
  })

  it('a escolha do mestre vence o padrão nos dois sentidos', () => {
    expect(relevoLigado({ ...continente, relevo: false })).toBe(false)
    expect(relevoLigado({ ...normal, relevo: true })).toBe(true)
  })

  it('setRelevo grava só o que difere do padrão; voltar ao padrão tira o campo; o mesmo valor devolve o mesmo mapa', () => {
    const desligado = setRelevo(continente, false)
    expect(desligado.relevo).toBe(false)
    const religado = setRelevo(desligado, true)
    expect('relevo' in religado).toBe(false)
    expect(relevoLigado(religado)).toBe(true)
    expect(setRelevo(continente, true)).toBe(continente)
    expect(setRelevo(normal, false)).toBe(normal)
    expect(setRelevo(normal, true).relevo).toBe(true)
  })

  it('cena sem escolha segue o tipo: virar Normal desliga, virar Continente liga', () => {
    expect(relevoLigado(setTipoDeMapa(continente, 'normal'))).toBe(false)
    expect(relevoLigado(setTipoDeMapa(normal, 'continente'))).toBe(true)
  })

  it('arquivo: mapa antigo abre sem o campo; booleano volta; valor torto abre sem o campo', () => {
    const json = JSON.parse(serializeMap(continente)) as Record<string, unknown>
    expect('relevo' in deserializeMap(JSON.stringify(json))).toBe(false)
    expect(deserializeMap(JSON.stringify({ ...json, relevo: false })).relevo).toBe(false)
    expect(deserializeMap(JSON.stringify({ ...json, relevo: true })).relevo).toBe(true)
    expect('relevo' in deserializeMap(JSON.stringify({ ...json, relevo: 'sim' }))).toBe(false)
  })
})

describe('a terra é a união das regiões', () => {
  it('região só contorno (sem fundo) e polígono degenerado não são terra', () => {
    const terras = terrasDoRelevo([
      regiao('a', retangulo(0, 0, 100, 100)),
      regiao('rua', retangulo(100, 0, 200, 100), { filled: false }),
      regiao('risco', [{ x: 0, y: 0 }, { x: 10, y: 10 }]),
    ])
    expect(terras).toHaveLength(1)
  })

  it('duas regiões lado a lado: a divisa é fronteira, o resto do contorno é costa', () => {
    const terras = terrasDoRelevo([regiao('a', retangulo(0, 0, 100, 100)), regiao('b', retangulo(100, 0, 200, 100))])
    const { fronteiras, costa } = bordasDaTerra(terras, 5, 2)
    expect(fronteiras.length).toBeGreaterThan(0)
    expect(fronteiras.every((s) => sobreVertical(s, 100, 0, 100))).toBe(true)
    // A divisa aparece nos dois lados (um por região), e só ela.
    expect(comprimento(fronteiras)).toBeCloseTo(200, 0)
    // Nenhum trecho de costa sobre a divisa: o mar não passa entre as duas.
    expect(costa.some((s) => sobreVertical(s, 100, 1, 99))).toBe(false)
    // O contorno de fora da união inteira é costa: 2 × 200 + 2 × 100.
    expect(comprimento(costa)).toBeCloseTo(600, 0)
  })

  it('divisa desenhada à mão com fresta menor que a folga continua sendo fronteira, não costa', () => {
    const terras = terrasDoRelevo([regiao('a', retangulo(0, 0, 100, 100)), regiao('b', retangulo(101, 0, 200, 100))])
    const { fronteiras } = bordasDaTerra(terras, 5, 2)
    expect(comprimento(fronteiras)).toBeCloseTo(200, 0)
  })

  it('ilha sozinha: só costa, nenhuma fronteira', () => {
    const { fronteiras, costa } = bordasDaTerra(terrasDoRelevo([regiao('ilha', retangulo(0, 0, 100, 50))]), 5, 2)
    expect(fronteiras).toEqual([])
    expect(comprimento(costa)).toBeCloseTo(300, 0)
  })

  it('lado meio encostado: só o trecho com vizinha vira fronteira, o resto do mesmo lado é costa', () => {
    const terras = terrasDoRelevo([regiao('grande', retangulo(0, 0, 100, 200)), regiao('pequena', retangulo(100, 0, 200, 100))])
    const { fronteiras, costa } = bordasDaTerra(terras, 5, 2)
    // Do lado x = 100 da grande, só y de 0 a 100 encosta na pequena.
    expect(fronteiras.every((s) => sobreVertical(s, 100, 0, 100))).toBe(true)
    expect(costa.some((s) => sobreVertical(s, 100, 100, 200))).toBe(true)
  })

  it('sub-região dentro de outra: o contorno dela é fronteira (terra dos dois lados)', () => {
    const terras = terrasDoRelevo([regiao('ilha', retangulo(0, 0, 300, 300)), regiao('vila', retangulo(100, 100, 200, 200))])
    const { fronteiras } = bordasDaTerra(terras, 5, 2)
    expect(comprimento(fronteiras)).toBeCloseTo(400, 0)
  })
})

describe('plano do relevo: tamanho da textura e unidade', () => {
  it('sem terra não há o que gerar', () => {
    expect(planoDoRelevo(createEmptyMap('m', 'M', 10, 10, 50), [])).toBeNull()
    expect(planoDoRelevo(createEmptyMap('m', 'M', 10, 10, 50), [regiao('rua', retangulo(0, 0, 100, 100), { filled: false })])).toBeNull()
  })

  it('mapa enorme: o lado maior da textura respeita o teto, com escala proporcional', () => {
    const mapa = createEmptyMap('m', 'M', 200, 200, 64)
    const plano = planoDoRelevo(mapa, [regiao('continente', retangulo(500, 500, 12000, 9000))])
    if (plano === null) throw new Error('sem plano')
    const { largura, altura } = tamanhoDaTextura(plano)
    expect(Math.max(largura, altura)).toBeLessThanOrEqual(TETO_DA_TEXTURA)
    expect(Math.max(largura, altura)).toBeGreaterThan(TETO_DA_TEXTURA - 2)
    expect(largura / altura).toBeCloseTo(plano.retangulo.largura / plano.retangulo.altura, 2)
  })

  it('terra pequena não ganha mais de 1 texel por px de mundo', () => {
    const plano = planoDoRelevo(createEmptyMap('m', 'M', 200, 200, 64), [regiao('ilhota', retangulo(0, 0, 100, 100))])
    expect(plano?.escala).toBe(1)
  })

  it('a unidade sai do tamanho do mapa, não da terra: o recorte do jogador tem o mesmo efeito do mestre', () => {
    const mapa = createEmptyMap('m', 'M', 100, 50, 64)
    const toda = planoDoRelevo(mapa, [regiao('a', retangulo(0, 0, 3000, 3000)), regiao('b', retangulo(3000, 0, 6000, 3000))])
    const parte = planoDoRelevo(mapa, [regiao('a', retangulo(0, 0, 3000, 3000))])
    expect(toda?.unidade).toBe(unidadeDoRelevo(mapa))
    expect(parte?.unidade).toBe(toda?.unidade)
    expect(parte?.mapa).toEqual(toda?.mapa)
  })
})

describe('névoa: região fora do recorte do jogador não deixa rastro no relevo dele', () => {
  const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }
  // A: onde a Ana está. D: vizinha de baixo, à vista. B: vizinha da direita,
  // escondida pelo mestre. C: longe, na névoa (nunca vista, nada explorado).
  const A = regiao('A', retangulo(100, 100, 400, 400))
  const D = regiao('D', retangulo(100, 400, 400, 700))
  const B = regiao('B', retangulo(400, 100, 700, 400), { hidden: true })
  const C = regiao('C', retangulo(1100, 100, 1400, 400))
  const mestre: MapData = { ...createEmptyMap('m-rel', 'Mundo', 30, 30, 50), continente: true, regions: [A, D, B, C], tokens: [ANA] }

  function planoDoJogador() {
    const view = filterMapForPlayer(mestre, 'p1', { p1: ['ana'] }, 400)
    return { view, plano: planoDoRelevo(view.map, visibleRegions(view.map.regions, view.map.hiddenLayers)) }
  }

  it('a chave atravessa e o recorte só traz A e D (pré-condição do teste)', () => {
    const { view } = planoDoJogador()
    expect(relevoLigado(view.map)).toBe(true)
    expect(view.map.regions.map((r) => r.id).sort()).toEqual(['A', 'D'])
  })

  it('a terra do jogador é só A e D: nada de B nem de C no plano', () => {
    const { plano } = planoDoJogador()
    if (plano === null) throw new Error('sem plano')
    expect(plano.terras).toHaveLength(2)
    expect(plano.terras).toEqual(expect.arrayContaining([A.points, D.points]))
    const pontos = plano.terras.flat()
    expect(pontos.some((p) => p.x > 400)).toBe(false)
    // A textura não cobre C: a sombra de C não tem onde existir.
    expect(plano.retangulo.x + plano.retangulo.largura).toBeLessThan(1100)
  })

  it('a divisa A-D (as duas à vista) escurece; a divisa com B escondida vira costa, como o jogador a vê', () => {
    const { plano } = planoDoJogador()
    if (plano === null) throw new Error('sem plano')
    expect(plano.fronteiras.length).toBeGreaterThan(0)
    expect(plano.fronteiras.every((s) => sobreHorizontal(s, 400, 100, 400))).toBe(true)
    expect(plano.fronteiras.some((s) => sobreVertical(s, 400, 100, 400))).toBe(false)
  })

  it('o mestre, com tudo, vê a divisa A-B como fronteira e a terra de C', () => {
    const plano = planoDoRelevo(mestre, mestre.regions)
    if (plano === null) throw new Error('sem plano')
    expect(plano.fronteiras.some((s) => sobreVertical(s, 400, 100, 400))).toBe(true)
    expect(plano.retangulo.x + plano.retangulo.largura).toBeGreaterThan(1400)
  })
})
