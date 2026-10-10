/**
 * ALTURA DO PENHASCO (pedido de 10/10/2026: "um penhasco mais curto e outro
 * maior"): cada risco guarda a altura dele (Baixo, Médio, Alto). Ausente =
 * Médio = a parede de antes, então o mapa antigo abre igual.
 *
 * Prova o caminho do dado: a leitura do arquivo, a assinatura que refaz o
 * relevo, a cor esticada, o plano que cabe a parede mais alta, os degraus da
 * rampa entre alturas vizinhas, o risco que entra na lista e o recorte do
 * jogador (a altura viaja junto do pedaço).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Region, RegionPoint, Token, TracoDePenhasco } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { filterMapForPlayer } from './fogFilter'
import { lerPenhascos, riscarPenhasco } from './penhasco'
import { AJUSTE_DO_PENHASCO, alturaDaParede, corDaParede, degrausDaParede, mesmosPenhascos, planoComPenhascos, planoDoRelevo } from './relevo'

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

function risco(id: string, de: number, ate: number, y: number, altura?: TracoDePenhasco['altura'], raio = 20): TracoDePenhasco {
  const pontos: RegionPoint[] = []
  for (let x = de; x <= ate; x += 10) pontos.push({ x, y })
  return { id, modo: 'riscar', raio, pontos, ...(altura === undefined ? {} : { altura }) }
}

const MEDIA = AJUSTE_DO_PENHASCO.altura
const BAIXA = alturaDaParede({ altura: 'baixo' })
const ALTA = alturaDaParede({ altura: 'alto' })

describe('alturaDaParede: Baixo < Médio < Alto, e o Médio é a parede de antes', () => {
  it('ausente e Médio são a altura de sempre', () => {
    expect(alturaDaParede({})).toBe(MEDIA)
    expect(alturaDaParede({ altura: 'medio' })).toBe(MEDIA)
    expect(BAIXA).toBeLessThan(MEDIA)
    expect(ALTA).toBeGreaterThan(MEDIA)
  })
})

describe('lerPenhascos: a altura vem do arquivo, e a torta vira Médio', () => {
  it('Baixo e Alto ficam; Médio e valor desconhecido saem do risco (o risco fica)', () => {
    const lido = lerPenhascos([
      risco('b', 0, 20, 10, 'baixo'),
      risco('a', 0, 20, 10, 'alto'),
      { ...risco('m', 0, 20, 10), altura: 'medio' },
      { ...risco('x', 0, 20, 10), altura: 'gigante' },
      { ...risco('n', 0, 20, 10), altura: 3 },
    ])
    expect(lido?.map((t) => [t.id, t.altura])).toEqual([
      ['b', 'baixo'],
      ['a', 'alto'],
      ['m', undefined],
      ['x', undefined],
      ['n', undefined],
    ])
    expect(lido?.every((t) => t.altura !== undefined || !('altura' in t))).toBe(true)
  })

  it('ida e volta pelo disco preserva a altura; o risco sem ela abre sem o campo', () => {
    const riscos = [risco('a', 0, 100, 10, 'alto'), risco('b', 0, 100, 10, 'baixo'), risco('c', 0, 100, 10)]
    const mapa: MapData = { ...createEmptyMap('m', 'M', 10, 10, 50), penhascos: riscos }
    const volta = deserializeMap(serializeMap(mapa)).penhascos
    expect(volta).toEqual(riscos)
    expect(volta !== undefined && 'altura' in volta[2]).toBe(false)
  })
})

describe('mesmosPenhascos: mudar a altura refaz o relevo', () => {
  it('altura diferente não é o mesmo risco; ausente e Médio são', () => {
    const a = [risco('a', 0, 100, 10)]
    expect(mesmosPenhascos(a, [risco('a', 0, 100, 10, 'alto')])).toBe(false)
    expect(mesmosPenhascos(a, [risco('a', 0, 100, 10, 'medio')])).toBe(true)
  })
})

describe('corDaParede com a altura: as faixas esticam na proporção', () => {
  it('na parede Alta, o dobro da profundidade dá a cor da Média; na Baixa, a metade', () => {
    for (const p of [1, 4, 6.8, 9.5, 13, 17]) {
      expect(corDaParede(p * (ALTA / MEDIA), ALTA)).toEqual(corDaParede(p))
      expect(corDaParede(p * (BAIXA / MEDIA), BAIXA)).toEqual(corDaParede(p))
    }
  })

  it('sem a altura, a cor é a de antes', () => {
    expect(corDaParede(6.8, MEDIA)).toEqual(corDaParede(6.8))
  })
})

describe('planoComPenhascos: a textura cabe a parede mais alta', () => {
  const MAPA = createEmptyMap('m', 'M', 1242, 1242, 10)
  const TERRA = regiao('t', retangulo(1000, 1000, 5000, 4000))

  it('com um risco Alto, a altura cresce pela parede Alta; só Médio, como antes', () => {
    const plano = planoDoRelevo(MAPA, [TERRA])
    if (plano === null) throw new Error('sem plano')
    const medio = planoComPenhascos(plano, [risco('a', 1000, 2000, 4000)])
    expect(medio.retangulo.altura).toBeCloseTo(plano.retangulo.altura + MEDIA * 10)
    const alto = planoComPenhascos(plano, [risco('a', 1000, 2000, 4000), risco('b', 3000, 4000, 4000, 'alto')])
    expect(alto.retangulo.altura).toBeCloseTo(plano.retangulo.altura + ALTA * 10)
    const baixo = planoComPenhascos(plano, [risco('a', 1000, 2000, 4000, 'baixo')])
    expect(baixo.retangulo.altura).toBeCloseTo(plano.retangulo.altura + BAIXA * 10)
  })
})

describe('degrausDaParede: uma altura por risco, com rampa onde duas alturas se encostam', () => {
  it('só Médio (o mapa de antes): um degrau só, sem rampa', () => {
    expect(degrausDaParede([risco('a', 0, 500, 1000), { ...risco('b', 200, 300, 1000), modo: 'apagar' }], 10)).toEqual([
      { altura: MEDIA, niveis: [MEDIA], recuos: [] },
    ])
  })

  it('Baixo e Alto longe um do outro: dois degraus, sem rampa entre eles', () => {
    const degraus = degrausDaParede([risco('b', 0, 100, 1000, 'baixo'), risco('a', 5000, 5100, 1000, 'alto')], 10)
    expect(degraus.map((d) => d.altura)).toEqual([BAIXA, ALTA])
    expect(degraus[1]).toEqual({ altura: ALTA, niveis: [ALTA], recuos: [] })
  })

  it('Médio encostado no Alto: degraus intermediários, cada um recuando de lado a partir do Médio', () => {
    const degraus = degrausDaParede([risco('m', 0, 500, 1000), risco('a', 500, 1000, 1000, 'alto')], 10)
    const alturas = degraus.map((d) => d.altura)
    expect(alturas[0]).toBe(MEDIA)
    expect(alturas[alturas.length - 1]).toBe(ALTA)
    // Degraus pequenos o bastante para o borrão da ponta os juntar numa rampa.
    for (let i = 1; i < alturas.length; i += 1) expect(alturas[i] - alturas[i - 1]).toBeLessThanOrEqual(AJUSTE_DO_PENHASCO.rampa.degrau + 1e-9)
    // Cada degrau acima do Médio é a terra Alta menos o Médio alargado de lado; quanto mais alto, mais largo o recuo.
    const recuos = degraus.slice(1).map((d) => {
      expect(d.niveis).toEqual([ALTA])
      expect(d.recuos.map((r) => r.nivel)).toEqual([MEDIA])
      return d.recuos[0].alcance
    })
    for (let i = 1; i < recuos.length; i += 1) expect(recuos[i]).toBeGreaterThan(recuos[i - 1])
    expect(recuos[recuos.length - 1]).toBeCloseTo((ALTA - MEDIA) * AJUSTE_DO_PENHASCO.rampa.inclinacao * 10)
  })
})

describe('riscarPenhasco: a altura entra no risco, e o Médio não escreve o campo', () => {
  const naTerra = (p: RegionPoint): boolean => p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 1000

  it('Alto fica no risco; Médio e a borracha saem sem o campo', () => {
    const alto = riscarPenhasco([], risco('a', 100, 300, 1000, 'alto', 40), naTerra)
    expect(alto.lista[0].altura).toBe('alto')
    const medio = riscarPenhasco([], risco('m', 100, 300, 1000, 'medio', 40), naTerra)
    expect('altura' in medio.lista[0]).toBe(false)
    const borracha = riscarPenhasco(alto.lista, { ...risco('b', 100, 300, 1000, 'alto', 40), modo: 'apagar' }, naTerra)
    expect(borracha.lista.every((t) => t.modo === 'riscar' || !('altura' in t))).toBe(true)
  })
})

describe('névoa: a altura viaja com o pedaço que o jogador recebe', () => {
  const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }
  const mestre: MapData = {
    ...createEmptyMap('m-pen', 'Mundo', 40, 40, 50),
    continente: true,
    regions: [regiao('T', retangulo(0, 0, 1500, 600))],
    tokens: [ANA],
    penhascos: [risco('alto', 0, 400, 600, 'alto'), risco('medio', 0, 400, 600)],
  }

  it('o pedaço do risco Alto sai Alto; o do Médio sai sem o campo', () => {
    const view = filterMapForPlayer(mestre, 'p1', { p1: ['ana'] }, 400)
    const recebidos = view.map.penhascos ?? []
    const alto = recebidos.filter((t) => t.id.startsWith('alto~'))
    const medio = recebidos.filter((t) => t.id.startsWith('medio~'))
    expect(alto.length).toBeGreaterThan(0)
    expect(alto.every((t) => t.altura === 'alto')).toBe(true)
    expect(medio.length).toBeGreaterThan(0)
    expect(medio.every((t) => !('altura' in t))).toBe(true)
  })
})
