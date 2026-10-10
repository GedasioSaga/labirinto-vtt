/**
 * RELEVO (fatia 1): a terra é a UNIÃO das regiões — sem divisa interna; a
 * sombra no mar e o friso saem só da costa (terra-mar); a sombra de fronteira
 * só onde há terra dos dois lados. Chave por mapa, ligada por padrão só no
 * Continente. E a regra da névoa: cada tela gera o relevo das regiões que ELA
 * recebeu — região fora do recorte do jogador não deixa rastro no plano.
 */
import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Region, RegionPoint, Token } from '../types/map'
import { createEmptyMap, setRelevo, setTipoDeMapa } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { filterMapForPlayer } from './fogFilter'
import { visibleRegions } from './layers'
import {
  AJUSTE_DAS_DIVISAS,
  TETO_DA_TEXTURA,
  areasPintadas,
  assinaturaDaTerra,
  bordasDaTerra,
  idsDasAreasPintadas,
  planoDoRelevo,
  planoDoRelevoEmPassos,
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

// ---------------------------------------------------------------------------
// FATIA 1b — divisas pintadas: a borda de desenho preenchido sobre a terra.

/** 1 px do protótipo = 10 px de mundo: folga 15, passo 40, longe do mar 40, tamanho mínimo 640, espessura mínima 40. */
const MAPA_1B = createEmptyMap('m-1b', 'Continente', 1242, 1242, 10)
const U = unidadeDoRelevo(MAPA_1B)
const TERRA = regiao('terra', retangulo(0, 0, 4000, 3000), { fillColor: '#a8776a' })

let proximo = 0
type DesenhoPoligono = Extract<Drawing, { kind: 'polygon' }>

function poligono(points: RegionPoint[], color: string, extra: Partial<DesenhoPoligono> = {}): DesenhoPoligono {
  proximo += 1
  return { id: `d${proximo}`, kind: 'polygon', points, color, width: 0, filled: true, fillAlpha: 1, ...extra }
}

function divisasDe(desenhos: Drawing[], regioes: Region[] = [TERRA]): Segmento[] {
  const plano = planoDoRelevo(MAPA_1B, regioes, desenhos)
  if (plano === null) throw new Error('sem plano')
  return plano.divisas
}

const meio = (s: Segmento): RegionPoint => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 })

/** O segmento está sobre a reta x = valor e passa por algum y entre `de` e `ate` (trechos seguidos chegam emendados). */
function tocaVertical(s: Segmento, x: number, de: number, ate: number): boolean {
  if (Math.abs(s.a.x - x) > 0.01 || Math.abs(s.b.x - x) > 0.01) return false
  return Math.min(s.a.y, s.b.y) < ate && Math.max(s.a.y, s.b.y) > de
}

describe('divisas pintadas: quem conta', () => {
  it('pré-condição: a escala do teste é a do comentário', () => {
    expect(U).toBe(10)
    expect(AJUSTE_DAS_DIVISAS.tamanhoMinimo * U).toBe(640)
  })

  it('bioma preenchido sobre a terra: a borda inteira vira divisa, e nada fora dela', () => {
    const divisas = divisasDe([poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148')])
    expect(comprimento(divisas)).toBeCloseTo(4000, 0)
    const naBorda = (s: Segmento) =>
      sobreVertical(s, 1000, 1000, 2000) || sobreVertical(s, 2000, 1000, 2000) || sobreHorizontal(s, 1000, 1000, 2000) || sobreHorizontal(s, 2000, 1000, 2000)
    expect(divisas.every(naBorda)).toBe(true)
  })

  it('só regiões (sem desenho) não tem divisa: a fatia 1 não muda', () => {
    expect(divisasDe([])).toEqual([])
  })

  it('rabisco não conta: Pincel fechado, Linha, Curva e Caminho grossos não dividem nada', () => {
    const laco = retangulo(1000, 1000, 2000, 2000)
    const rabiscos: Drawing[] = [
      { id: 'pincel', kind: 'freehand', points: [...laco, laco[0]], color: '#0aa148', width: 80 },
      { id: 'linha', kind: 'line', x1: 500, y1: 500, x2: 3500, y2: 2500, color: '#0aa148', width: 80 },
      { id: 'curva', kind: 'curve', points: laco, color: '#0aa148', width: 80 },
      { id: 'caminho', kind: 'path', points: laco, color: '#0aa148', width: 80 },
      { id: 'texto', kind: 'text', x: 1500, y: 1500, text: 'Floresta', color: '#0aa148', fontSize: 400 },
    ]
    expect(areasPintadas(rabiscos, { espessura: 0, tamanho: 0 })).toEqual([])
    expect(divisasDe(rabiscos)).toEqual([])
  })

  it('desenho sobre o mar não é terra: sem divisa, e a terra e a textura ficam iguais', () => {
    const noMar = poligono(retangulo(5000, 500, 6500, 2500), '#0aa148')
    const sem = planoDoRelevo(MAPA_1B, [TERRA])
    const com = planoDoRelevo(MAPA_1B, [TERRA], [noMar])
    expect(com?.divisas).toEqual([])
    expect(com?.terras).toEqual(sem?.terras)
    expect(com?.retangulo).toEqual(sem?.retangulo)
  })

  it('desenho que passa da costa: só o pedaço sobre a terra divide, e nunca rente ao mar', () => {
    const divisas = divisasDe([poligono(retangulo(3000, 1000, 5000, 2000), '#0aa148')])
    expect(divisas.some((s) => sobreVertical(s, 3000, 1000, 2000))).toBe(true)
    // A borda de x = 5000 está no mar; as de cima e de baixo param antes da costa (x = 4000).
    expect(divisas.every((s) => meio(s).x < 4000 - AJUSTE_DAS_DIVISAS.longeDoMar * U)).toBe(true)
  })

  it('bioma pintado até a costa: a borda que corre junto do mar é costa, não divisa', () => {
    // Encosta na costa de cima (y = 0) e na da esquerda (x = 0), e corre a 20 px da de baixo.
    const divisas = divisasDe([poligono(retangulo(0, 0, 1500, 2980), '#0aa148')])
    expect(divisas.some((s) => tocaVertical(s, 1500, 100, 2900))).toBe(true)
    expect(divisas.every((s) => sobreVertical(s, 1500, 0, 3000))).toBe(true)
  })

  it('fundo desligado, ou transparente demais, não divide', () => {
    expect(divisasDe([poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148', { filled: false })])).toEqual([])
    expect(divisasDe([poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148', { fillAlpha: 0.3 })])).toEqual([])
  })

  it('tinta transparente por cima de uma divisa: a divisa de baixo continua, a borda da tinta não divide', () => {
    const bioma = poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148')
    const tinta = poligono(retangulo(1500, 500, 2500, 2500), '#ff0000', { fillAlpha: 0.3 })
    const divisas = divisasDe([bioma, tinta])
    expect(divisas.some((s) => tocaVertical(s, 2000, 1100, 1900))).toBe(true)
    expect(divisas.some((s) => sobreVertical(s, 2500, 0, 3000))).toBe(false)
  })

  it('sobreposição: a borda coberta por outro desenho some; a do desenho de cima divide', () => {
    const verde = poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148')
    const azul = poligono(retangulo(1500, 1000, 2500, 2000), '#47948c')
    const divisas = divisasDe([verde, azul])
    // A borda direita do verde (x = 2000) está debaixo do azul: azul dos dois lados.
    expect(divisas.some((s) => tocaVertical(s, 2000, 1050, 1950))).toBe(false)
    expect(divisas.some((s) => sobreVertical(s, 1000, 1000, 2000))).toBe(true)
    expect(divisas.some((s) => sobreVertical(s, 1500, 1000, 2000))).toBe(true)
    expect(divisas.some((s) => sobreVertical(s, 2500, 1000, 2000))).toBe(true)
  })

  it('o mesmo desenho repetido por cima de si mesmo não cria divisa nova', () => {
    const forma = retangulo(1000, 1000, 2000, 2000)
    const uma = divisasDe([poligono(forma, '#0aa148')])
    const tres = divisasDe([poligono(forma, '#0aa148'), poligono(forma, '#0aa148'), poligono(forma, '#0aa148')])
    // Três vezes a mesma borda (uma por cópia), no mesmo lugar: nenhum trecho a mais.
    expect(comprimento(tres)).toBeCloseTo(3 * comprimento(uma), 0)
    expect(tres.every((s) => uma.some((t) => sobreVertical(t, s.a.x, 0, 3000) || sobreHorizontal(t, s.a.y, 0, 4000)))).toBe(true)
  })

  it('tons quase iguais (os marrons de uma montanha) não são divisa', () => {
    const montanha = regiao('montanha', retangulo(0, 0, 4000, 3000), { fillColor: '#9e8a74' })
    expect(divisasDe([poligono(retangulo(1000, 1000, 2000, 2000), '#96887a')], [montanha])).toEqual([])
  })

  it('detalhe pequeno (o ícone de montanha) não divide, mas a cor dele conta para o vizinho', () => {
    // Sozinho, um cone de 400 px (menor que 640) não escurece nada.
    expect(divisasDe([poligono(retangulo(1500, 1500, 1900, 1900), '#82766b')])).toEqual([])
    // Por cima da borda de um bioma, com a cor do chão de fora: ali a borda some.
    const bioma = poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148')
    const pedra = poligono(retangulo(1900, 1300, 2100, 1700), '#a8776a')
    const divisas = divisasDe([bioma, pedra])
    expect(divisas.some((s) => tocaVertical(s, 2000, 1000, 1200))).toBe(true)
    expect(divisas.some((s) => tocaVertical(s, 2000, 1350, 1650))).toBe(false)
  })

  it('forma fina (faixa de 30 px) não divide: a sombra viraria uma listra', () => {
    expect(divisasDe([poligono(retangulo(500, 1000, 3500, 1030), '#0aa148')])).toEqual([])
  })

  it('Retângulo puxado ao contrário, Círculo e Elipse também dividem', () => {
    const formas: Drawing[] = [
      { id: 'ret', kind: 'rect', x: 2000, y: 2000, w: -1000, h: -1000, color: '#0aa148', width: 0, filled: true, fillAlpha: 1 },
      { id: 'circ', kind: 'circle', cx: 3000, cy: 1000, radius: 500, color: '#47948c', width: 0, filled: true, fillAlpha: 1 },
      { id: 'eli', kind: 'ellipse', cx: 1500, cy: 2400, rx: 700, ry: 400, color: '#bd993f', width: 0, filled: true, fillAlpha: 1 },
    ]
    for (const forma of formas) expect(divisasDe([forma]).length, forma.id).toBeGreaterThan(0)
  })

  it('sala de duas cores: desenho da cor do lado de lá não divide dentro dele', () => {
    const dividida = regiao('dividida', retangulo(0, 0, 4000, 3000), { fillColor: '#a8776a', split: { color: '#0aa148', direction: 'vertical', at: 0.5 } })
    // O desenho fica todo no lado da segunda cor (x de 2000 a 4000) e tem essa mesma cor.
    expect(divisasDe([poligono(retangulo(2500, 1000, 3500, 2000), '#0aa148')], [dividida])).toEqual([])
    // Do lado da primeira cor, ele divide.
    expect(divisasDe([poligono(retangulo(500, 1000, 1500, 2000), '#0aa148')], [dividida]).length).toBeGreaterThan(0)
  })

  it('campo opcional ausente (mapa velho): desenho sem traço nem segredo, região sem fundo declarado', () => {
    const regiaoMagra: Region = { id: 'magra', points: retangulo(0, 0, 4000, 3000), tag: 'region', fillColor: '#a8776a', fillPattern: 'solid', data: {} }
    const desenho: Drawing = { id: 'magro', kind: 'polygon', points: retangulo(1000, 1000, 2000, 2000), color: '#0aa148', width: 0, filled: true, fillAlpha: 1 }
    expect(comprimento(divisasDe([desenho], [regiaoMagra]))).toBeCloseTo(4000, 0)
  })
})

describe('divisas pintadas: assinatura e o que sai na hora', () => {
  const bioma = poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148')

  it('rabisco, texto e caminho novos não mudam a assinatura; bioma novo, cor nova e forma nova mudam', () => {
    const base = assinaturaDaTerra([TERRA], [bioma])
    const rabisco: Drawing = { id: 'r', kind: 'freehand', points: retangulo(0, 0, 10, 10), color: '#000000', width: 4 }
    expect(assinaturaDaTerra([TERRA], [bioma, rabisco])).toBe(base)
    expect(assinaturaDaTerra([TERRA], [bioma, poligono(retangulo(0, 0, 900, 900), '#47948c')])).not.toBe(base)
    expect(assinaturaDaTerra([TERRA], [{ ...bioma, color: '#47948c' }])).not.toBe(base)
    expect(assinaturaDaTerra([TERRA], [{ ...bioma, points: retangulo(1000, 1000, 2100, 2000) }])).not.toBe(base)
    // A cor da região agora conta (ela entra na cor do chão).
    expect(assinaturaDaTerra([{ ...TERRA, fillColor: '#000000' }], [bioma])).not.toBe(base)
  })

  it('ids das áreas pintadas: só os desenhos com fundo (inclusive transparente), nunca rabisco', () => {
    const tinta = poligono(retangulo(0, 0, 100, 100), '#ff0000', { fillAlpha: 0.2 })
    const rabisco: Drawing = { id: 'r2', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10, color: '#000000', width: 4 }
    expect([...idsDasAreasPintadas([bioma, tinta, rabisco])].sort()).toEqual([bioma.id, tinta.id].sort())
  })
})

describe('névoa: desenho fora do recorte do jogador não deixa divisa', () => {
  const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 1500, y: 1500, size: 1, image: null }
  const perto = poligono(retangulo(1200, 1200, 2000, 2000), '#0aa148')
  const longe = poligono(retangulo(9000, 1000, 10000, 2000), '#47948c')
  const segredo = poligono(retangulo(1000, 2100, 2000, 2900), '#bd993f', { secret: true })
  const grande = regiao('grande', retangulo(0, 0, 11000, 3000), { fillColor: '#a8776a' })
  const mestre: MapData = { ...MAPA_1B, continente: true, regions: [grande], drawings: [perto, longe, segredo], tokens: [ANA] }

  it('o recorte do jogador traz só o desenho perto (pré-condição)', () => {
    const view = filterMapForPlayer(mestre, 'p1', { p1: ['ana'] }, 1200)
    expect(view.map.drawings.map((d) => d.id)).toEqual([perto.id])
  })

  it('as divisas do jogador saem só do desenho que ele recebeu', () => {
    const view = filterMapForPlayer(mestre, 'p1', { p1: ['ana'] }, 1200)
    const plano = planoDoRelevo(view.map, visibleRegions(view.map.regions, view.map.hiddenLayers), view.map.drawings)
    if (plano === null) throw new Error('sem plano')
    expect(plano.divisas.length).toBeGreaterThan(0)
    expect(plano.divisas.every((s) => meio(s).x <= 2000 && meio(s).y <= 2000)).toBe(true)
  })

  it('o mestre, com tudo, tem as divisas dos três', () => {
    const plano = planoDoRelevo(mestre, mestre.regions, mestre.drawings)
    if (plano === null) throw new Error('sem plano')
    expect(plano.divisas.some((s) => meio(s).x > 8000)).toBe(true)
    expect(plano.divisas.some((s) => meio(s).y > 2050)).toBe(true)
  })
})

describe('divisas pintadas: quem está na textura e o plano em passos', () => {
  it('o plano lista como divisores só os desenhos que deram divisa (detalhe, tinta fraca e desenho no mar não)', () => {
    const bioma = poligono(retangulo(1000, 1000, 2000, 2000), '#0aa148')
    const detalhe = poligono(retangulo(2500, 500, 2700, 700), '#3a2a1a')
    const tinta = poligono(retangulo(2500, 1500, 3500, 2500), '#d23c3c', { fillAlpha: 0.3 })
    const noMar = poligono(retangulo(5000, 500, 6500, 2500), '#0aa148')
    const plano = planoDoRelevo(MAPA_1B, [TERRA], [bioma, detalhe, tinta, noMar])
    expect(plano?.divisores).toEqual([bioma.id])
  })

  it('desenho de borda toda na costa (sem nenhum trecho de divisa) não é divisor', () => {
    const plano = planoDoRelevo(MAPA_1B, [TERRA], [poligono(retangulo(-500, -500, 4500, 3500), '#0aa148')])
    expect(plano?.divisas).toEqual([])
    expect(plano?.divisores).toEqual([])
  })

  it('em passos: pausa várias vezes no meio da classificação e chega ao MESMO plano de uma vez só', () => {
    // Polígono de muitos lados (como o do balde): a classificação pausa no meio dele.
    const lados = 400
    const circulo = Array.from({ length: lados }, (_, i): RegionPoint => {
      const t = (i / lados) * Math.PI * 2
      return { x: 2000 + Math.cos(t) * 800, y: 1500 + Math.sin(t) * 800 }
    })
    const desenhos = [poligono(circulo, '#0aa148'), poligono(retangulo(200, 200, 1200, 1200), '#47948c')]
    const passos = planoDoRelevoEmPassos(MAPA_1B, [TERRA], desenhos)
    let pausas = 0
    let passo = passos.next()
    while (passo.done !== true) {
      pausas += 1
      passo = passos.next()
    }
    expect(pausas).toBeGreaterThan(lados / 64)
    expect(passo.value).toEqual(planoDoRelevo(MAPA_1B, [TERRA], desenhos))
    expect(passo.value?.divisores).toHaveLength(2)
  })
})
