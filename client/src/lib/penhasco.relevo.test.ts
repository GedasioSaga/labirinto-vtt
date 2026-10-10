/**
 * PENHASCO no relevo e no caminho do dado: a cor da parede por profundidade, o
 * plano que ganha embaixo a altura da parede, o arquivo que guarda e lê os
 * riscos, e o recorte do jogador que só leva os riscos junto do que ele
 * conhece (a costa na névoa não pode viajar pela rede).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Region, RegionPoint, Token, TracoDePenhasco } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { filterMapForPlayer } from './fogFilter'
import { AJUSTE_DO_PENHASCO, corDaParede, mesmosPenhascos, planoComPenhascos, planoDoRelevo } from './relevo'

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function regiao(id: string, points: RegionPoint[]): Region {
  return { id, points, tag: 'region', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
}

function risco(id: string, modo: TracoDePenhasco['modo'], de: number, ate: number, y: number, raio = 20): TracoDePenhasco {
  const pontos: RegionPoint[] = []
  for (let x = de; x <= ate; x += 10) pontos.push({ x, y })
  return { id, modo, raio, pontos }
}

describe('corDaParede: faixas de cima para baixo, o pé mais escuro', () => {
  it('o lábio é a faixa clara do protótipo e o pé é a base molhada, escurecida', () => {
    expect(corDaParede(1)).toEqual([224, 192, 136].map((c) => Math.round(c * (1 - 0.2 / 18))))
    const pe = corDaParede(17.5)
    expect(pe).toEqual([112, 78, 50].map((c) => Math.round(c * (1 - (0.2 * 17.5) / 18))))
  })

  it('o veio escuro (6 a 7,6) é mais escuro que as faixas em volta dele', () => {
    const soma = (c: number[]) => c[0] + c[1] + c[2]
    expect(soma(corDaParede(6.8))).toBeLessThan(soma(corDaParede(4)))
    expect(soma(corDaParede(6.8))).toBeLessThan(soma(corDaParede(9.5)))
  })

  it('perto da divisa a cor passa aos poucos (sem degrau seco), longe dela é a faixa pura', () => {
    const antes = corDaParede(5.0)
    const naDivisa = corDaParede(6.0)
    const depois = corDaParede(7.0)
    // Na divisa, a cor fica entre as duas faixas.
    expect(naDivisa[0]).toBeLessThan(antes[0])
    expect(naDivisa[0]).toBeGreaterThan(depois[0])
  })

  it('além da altura, a cor é a do pé (nunca índice fora da tabela)', () => {
    expect(corDaParede(AJUSTE_DO_PENHASCO.altura + 5)).toEqual(corDaParede(AJUSTE_DO_PENHASCO.altura))
  })
})

describe('planoComPenhascos: a textura ganha embaixo a altura da parede', () => {
  const MAPA = createEmptyMap('m', 'M', 1242, 1242, 10)
  const TERRA = regiao('t', retangulo(1000, 1000, 5000, 4000))

  it('sem risco de penhasco o plano é o mesmo', () => {
    const plano = planoDoRelevo(MAPA, [TERRA])
    if (plano === null) throw new Error('sem plano')
    expect(planoComPenhascos(plano, undefined)).toBe(plano)
    expect(planoComPenhascos(plano, [risco('b', 'apagar', 1000, 2000, 4000)])).toBe(plano)
  })

  it('com risco: os riscos entram e só a altura cresce, pela parede (18 px do protótipo × 10)', () => {
    const plano = planoDoRelevo(MAPA, [TERRA])
    if (plano === null) throw new Error('sem plano')
    const riscos = [risco('a', 'riscar', 1000, 2000, 4000)]
    const com = planoComPenhascos(plano, riscos)
    expect(com.penhascos).toEqual(riscos)
    expect(com.retangulo.x).toBe(plano.retangulo.x)
    expect(com.retangulo.y).toBe(plano.retangulo.y)
    expect(com.retangulo.largura).toBe(plano.retangulo.largura)
    expect(com.retangulo.altura).toBeCloseTo(plano.retangulo.altura + AJUSTE_DO_PENHASCO.altura * 10)
    // `planoDoRelevo` com os riscos dá o mesmo.
    expect(planoDoRelevo(MAPA, [TERRA], [], undefined, riscos)).toEqual(com)
  })

  it('o teto da textura continua valendo com a parede (a escala encolhe)', () => {
    const plano = planoDoRelevo(MAPA, [TERRA], [], 256)
    if (plano === null) throw new Error('sem plano')
    const com = planoComPenhascos(plano, [risco('a', 'riscar', 1000, 2000, 4000)], 256)
    expect(Math.max(com.retangulo.largura, com.retangulo.altura) * com.escala).toBeLessThanOrEqual(256 + 1e-9)
  })
})

describe('mesmosPenhascos', () => {
  it('mesmo conteúdo em objetos novos é igual; ausente e vazio também', () => {
    const a = [risco('a', 'riscar', 0, 100, 10)]
    expect(mesmosPenhascos(a, JSON.parse(JSON.stringify(a)))).toBe(true)
    expect(mesmosPenhascos(undefined, [])).toBe(true)
    expect(mesmosPenhascos(a, [risco('a', 'riscar', 0, 110, 10)])).toBe(false)
    expect(mesmosPenhascos(a, [{ ...a[0], modo: 'apagar' }])).toBe(false)
  })
})

describe('arquivo: os riscos vão e voltam, e o mapa sem riscos abre sem o campo', () => {
  it('ida e volta', () => {
    const riscos = [risco('a', 'riscar', 0, 100, 10), risco('b', 'apagar', 40, 60, 10)]
    const mapa: MapData = { ...createEmptyMap('m', 'M', 10, 10, 50), penhascos: riscos }
    expect(deserializeMap(serializeMap(mapa)).penhascos).toEqual(riscos)
    expect('penhascos' in deserializeMap(serializeMap(createEmptyMap('m', 'M', 10, 10, 50)))).toBe(false)
  })
})

describe('névoa: o jogador só recebe os riscos junto do que ele conhece', () => {
  // Ana em (200, 200), visão de 400 px. A costa de baixo da terra está em y = 600:
  // o trecho de x 0 a 500 está à vista; o de x 1100 a 1400 fica na névoa.
  const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }
  const TERRA = regiao('T', retangulo(0, 0, 1500, 600))
  const perto = risco('perto', 'riscar', 0, 400, 600)
  const longe = risco('longe', 'riscar', 1100, 1400, 600)
  const mestre: MapData = {
    ...createEmptyMap('m-pen', 'Mundo', 40, 40, 50),
    continente: true,
    regions: [TERRA],
    tokens: [ANA],
    penhascos: [perto, longe],
  }

  it('o risco à vista vai; o da costa na névoa não sai do host', () => {
    const view = filterMapForPlayer(mestre, 'p1', { p1: ['ana'] }, 400)
    const ids = (view.map.penhascos ?? []).map((t) => t.id)
    expect(ids.some((id) => id.startsWith('perto'))).toBe(true)
    expect(ids.some((id) => id.startsWith('longe'))).toBe(false)
    const xs = (view.map.penhascos ?? []).flatMap((t) => t.pontos.map((p) => p.x))
    expect(Math.max(...xs)).toBeLessThan(1100)
  })

  it('sem nada perto do que ele conhece, o campo nem sai', () => {
    const view = filterMapForPlayer({ ...mestre, penhascos: [longe] }, 'p1', { p1: ['ana'] }, 400)
    expect(view.map.penhascos).toBeUndefined()
  })

  it('a costa que entra numa zona oculta: nenhum ponto de dentro dela sai, nem a folga da ponta', () => {
    // Ana bem perto da costa conhece a terra dos dois lados de uma enseada que é zona oculta.
    const anaNaCosta: Token = { ...ANA, x: 300, y: 500 }
    const ZONA = retangulo(245, 500, 355, 700)
    const naZona = (p: RegionPoint): boolean => p.x > 245 && p.x < 355 && p.y > 500 && p.y < 700
    const comZona: MapData = {
      ...mestre,
      tokens: [anaNaCosta],
      penhascos: [risco('enseada', 'riscar', 0, 600, 600)],
      concealZones: [{ id: 'z1', name: 'Enseada', revealed: false, points: ZONA }],
    }
    const view = filterMapForPlayer(comZona, 'p1', { p1: ['ana'] }, 400)
    const pontos = (view.map.penhascos ?? []).flatMap((t) => t.pontos)
    expect(pontos.length).toBeGreaterThan(0)
    expect(pontos.filter(naZona)).toEqual([])
  })

  it('mapa sem penhasco: o recorte não ganha a chave', () => {
    const { penhascos: _riscos, ...semPenhasco } = mestre
    const view = filterMapForPlayer(semPenhasco, 'p1', { p1: ['ana'] }, 400)
    expect('penhascos' in view.map).toBe(false)
  })
})
