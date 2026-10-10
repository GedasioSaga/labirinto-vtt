/**
 * NUVENS (fatia 6 do relevo): a chave por mapa com o padrão do tipo, a ida e
 * volta pelo arquivo e pelo recorte do jogador, e o movimento — deriva linear,
 * nuvem e sombra sempre dentro do retângulo do mapa, formação suave nas
 * pontas, o mesmo quadro em qualquer tela no mesmo instante, e parada inteira
 * no movimento reduzido.
 */
import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap, setNuvens, setTipoDeMapa } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import {
  AJUSTE_DAS_NUVENS,
  NUVENS,
  NUVEM_DE_PERTO,
  ceuDoMapa,
  corpoPeloZoom,
  medidaDaNuvem,
  nuvensLigadas,
  quadroDaNuvem,
  type CeuDoMapa,
  type MedidaDaNuvem,
} from './nuvens'

const normal = createEmptyMap('m', 'Masmorra', 10, 10, 50)
const continente: MapData = { ...normal, continente: true }

describe('chave "Nuvens" e o padrão por tipo de mapa', () => {
  it('sem escolha do mestre: ligada no Continente (e no mapa-mundi antigo), desligada no Normal', () => {
    expect(nuvensLigadas(normal)).toBe(false)
    expect(nuvensLigadas(continente)).toBe(true)
    expect(nuvensLigadas({ ...normal, worldMap: true })).toBe(true)
    expect(nuvensLigadas({ ...continente, nuvens: false })).toBe(false)
    expect(nuvensLigadas({ ...normal, nuvens: true })).toBe(true)
  })

  it('setNuvens grava só o que difere do padrão; voltar ao padrão tira o campo; o mesmo valor devolve o mesmo mapa', () => {
    const desligada = setNuvens(continente, false)
    expect(desligada.nuvens).toBe(false)
    expect('nuvens' in setNuvens(desligada, true)).toBe(false)
    expect(setNuvens(continente, true)).toBe(continente)
    expect(setNuvens(normal, false)).toBe(normal)
    expect(setNuvens(normal, true).nuvens).toBe(true)
  })

  it('cena sem escolha segue o tipo de mapa', () => {
    expect(nuvensLigadas(setTipoDeMapa(continente, 'normal'))).toBe(false)
    expect(nuvensLigadas(setTipoDeMapa(normal, 'continente'))).toBe(true)
  })

  it('arquivo: mapa antigo abre sem o campo; booleano volta; valor torto abre sem o campo', () => {
    const json = JSON.parse(serializeMap(continente)) as Record<string, unknown> // JSON.parse devolve any: o arquivo é um objeto, só espalhado aqui
    expect('nuvens' in deserializeMap(JSON.stringify(json))).toBe(false)
    expect(deserializeMap(JSON.stringify({ ...json, nuvens: false })).nuvens).toBe(false)
    expect(deserializeMap(JSON.stringify({ ...json, nuvens: true })).nuvens).toBe(true)
    expect('nuvens' in deserializeMap(JSON.stringify({ ...json, nuvens: 'sim' }))).toBe(false)
    expect(deserializeMap(serializeMap({ ...continente, nuvens: false })).nuvens).toBe(false)
  })

  it('a chave atravessa o recorte do jogador (a tela dele monta as mesmas nuvens)', () => {
    const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }
    const mestre: MapData = { ...createEmptyMap('m-nuv', 'Mundo', 30, 30, 50), continente: true, nuvens: false, tokens: [ANA] }
    const { map } = filterMapForPlayer(mestre, 'p1', { p1: ['ana'] }, 400)
    expect(map.nuvens).toBe(false)
    expect(nuvensLigadas(map)).toBe(false)
    expect(nuvensLigadas(filterMapForPlayer({ ...mestre, nuvens: undefined }, 'p1', { p1: ['ana'] }, 400).map)).toBe(true)
  })
})

describe('o céu do jogador sai só do recorte dele', () => {
  /** Um trecho de oceano na beira de baixo, fora do mar: é ele que estica o céu até a borda do mapa. */
  const BEIRA: FloorPiece = {
    id: 'beira',
    shape: { kind: 'rect', cx: 6400, cy: 12600, w: 400, h: 400 },
    op: 'add',
    modifiers: {},
    fillColor: '#00375c',
  }
  /** Zona oculta sobre a beira: o recorte tira a peça (a maior parte dela está na zona). */
  const zona = (revealed: boolean) => ({
    id: 'zona-beira',
    name: 'Baía escondida',
    revealed,
    points: [
      { x: 6100, y: 12300 },
      { x: 6700, y: 12300 },
      { x: 6700, y: 12800 },
      { x: 6100, y: 12800 },
    ],
  })
  const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 6400, y: 7000, size: 1, image: null }
  const mestre = (revealed: boolean): MapData => ({
    ...createEmptyMap('tasmaturi', 'Tasmaturi', 200, 200, 64),
    continente: true,
    background: { type: 'color', src: '#2b2b2b' },
    floor: [MAR, BEIRA],
    tokens: [ANA],
    concealZones: [zona(revealed)],
  })
  const recorte = (map: MapData) => filterMapForPlayer(map, 'p1', { p1: ['ana'] }, 400).map

  it('a peça de chão na zona oculta não chega ao jogador, e o céu dele não a conta (a caixa não entrega o tamanho do chão escondido)', () => {
    const doJogador = recorte(mestre(false))
    // O cenário vale: a beira não saiu no recorte, e com ela o céu do mestre é outro.
    expect(doJogador.floor.some((f) => f.id === 'beira')).toBe(false)
    expect(ceuDoMapa(doJogador)).not.toEqual(ceuDoMapa(mestre(false)))
    expect(ceuDoMapa(doJogador)).toEqual(ceuDoMapa({ ...doJogador, ceuDasNuvens: undefined }))
  })

  it('abrir a zona entrega a peça, e só então o céu do jogador a conta (fica igual ao do mestre)', () => {
    const aberta = recorte(mestre(true))
    expect(aberta.floor.some((f) => f.id === 'beira')).toBe(true)
    expect(ceuDoMapa(aberta)).toEqual(ceuDoMapa(mestre(true)))
  })

  it('com a chave desligada o recorte não leva céu nenhum', () => {
    expect(recorte({ ...mestre(false), nuvens: false }).ceuDasNuvens).toBeUndefined()
  })

  it('céu torto vindo da rede (não finito, sem área) não vale: volta a conta pelo chão recebido', () => {
    const doJogador = recorte(mestre(false))
    const pelaConta = ceuDoMapa({ ...doJogador, ceuDasNuvens: undefined })
    expect(ceuDoMapa({ ...doJogador, ceuDasNuvens: { x: Number.NaN, y: 0, largura: 10, altura: 10 } })).toEqual(pelaConta)
    expect(ceuDoMapa({ ...doJogador, ceuDasNuvens: { x: 0, y: 0, largura: 0, altura: 10 } })).toEqual(pelaConta)
  })
})

/** O mar do mapa real de teste: uma peça de chão retangular que cobre só a faixa do meio. */
const MAR: FloorPiece = {
  id: 'mar',
  shape: { kind: 'rect', cx: 6279.6, cy: 7774.8, w: 13810, h: 9090 },
  op: 'add',
  modifiers: {},
  fillColor: '#00375c',
}
/** O mapa real de teste (Tasmaturi Village): 200 × 200 células de 64 px, fundo cinza vazio e o mar como chão. */
const TASMATURI = { ...createEmptyMap('tasmaturi', 'Tasmaturi', 200, 200, 64), background: { type: 'color' as const, src: '#2b2b2b' }, floor: [MAR] }
const CEU_GRANDE: CeuDoMapa = ceuDoMapa(TASMATURI) ?? { x: 0, y: 0, largura: 0, altura: 0, unidade: 0 }

function medidas(ceu: CeuDoMapa): MedidaDaNuvem[] {
  return NUVENS.map((nuvem) => {
    const medida = medidaDaNuvem(nuvem, ceu)
    if (medida === null) throw new Error(`nuvem ${nuvem.semente} não coube`)
    return medida
  })
}

describe('medida da nuvem no céu do mapa', () => {
  it('o céu é o retângulo do chão pintado, dentro do mapa: as nuvens não passam sobre o fundo vazio', () => {
    expect(CEU_GRANDE.x).toBe(0)
    expect(CEU_GRANDE.largura).toBe(12800)
    expect(CEU_GRANDE.y).toBeCloseTo(7774.8 - 9090 / 2, 6)
    expect(CEU_GRANDE.altura).toBeCloseTo(9090, 6)
    // A unidade continua a do MAPA: a nuvem tem o mesmo tamanho com ou sem chão.
    expect(CEU_GRANDE.unidade).toBeCloseTo(12800 / 1242, 9)
  })

  it('sem chão, com imagem de fundo ou com o chão todo fora do mapa: o retângulo do mapa; mapa sem tamanho não tem céu', () => {
    const inteiro = { x: 0, y: 0, largura: 12800, altura: 12800, unidade: 12800 / 1242 }
    expect(ceuDoMapa({ ...TASMATURI, floor: [] })).toEqual(inteiro)
    expect(ceuDoMapa({ ...TASMATURI, background: { type: 'image', src: 'mapa.png' } })).toEqual(inteiro)
    expect(ceuDoMapa({ ...TASMATURI, floor: [{ ...MAR, shape: { kind: 'rect', cx: -9000, cy: 500, w: 100, h: 100 } }] })).toEqual(inteiro)
    expect(ceuDoMapa({ ...TASMATURI, width: 0 })).toBeNull()
  })

  it('peça oculta para os jogadores e peça que subtrai não contam (o céu é o mesmo no mestre e no jogador)', () => {
    const ilha: FloorPiece = { ...MAR, id: 'ilha', shape: { kind: 'rect', cx: 1000, cy: 1000, w: 400, h: 400 } }
    expect(ceuDoMapa({ ...TASMATURI, floor: [MAR, { ...ilha, hidden: true }] })).toEqual(CEU_GRANDE)
    expect(ceuDoMapa({ ...TASMATURI, floor: [MAR, { ...ilha, op: 'subtract' }] })).toEqual(CEU_GRANDE)
    const comIlha = ceuDoMapa({ ...TASMATURI, floor: [MAR, ilha] })
    expect(comIlha?.y).toBeCloseTo(800, 6)
  })

  it('o tamanho segue o protótipo pela unidade do mapa (o mesmo na tela do mestre e na do jogador)', () => {
    const [primeira] = medidas(CEU_GRANDE)
    expect(primeira.largura).toBeCloseTo(NUVENS[0].largura * CEU_GRANDE.unidade, 6)
    expect(primeira.altura).toBeCloseTo(primeira.largura * AJUSTE_DAS_NUVENS.proporcao, 6)
    expect(primeira.sombraDx).toBeCloseTo(AJUSTE_DAS_NUVENS.sombra.dx * CEU_GRANDE.unidade, 6)
  })

  it('a travessia leva de um a dois minutos: devagar, como no protótipo', () => {
    for (const medida of medidas(CEU_GRANDE)) {
      expect(medida.travessia).toBeGreaterThan(55)
      expect(medida.travessia).toBeLessThan(120)
    }
  })

  it('mapa estreito e alto: a nuvem não passa do teto da largura', () => {
    const ceu: CeuDoMapa = { x: 0, y: 0, largura: 900, altura: 4000, unidade: 4000 / 1242 }
    for (const nuvem of NUVENS) {
      const medida = medidaDaNuvem(nuvem, ceu)
      if (medida !== null) expect(medida.largura).toBeLessThanOrEqual(900 * AJUSTE_DAS_NUVENS.larguraMaxima + 1e-9)
    }
  })

  it('nuvem que não cabe com a sombra não aparece', () => {
    const ceu: CeuDoMapa = { x: 0, y: 0, largura: 100, altura: 20, unidade: 1 }
    expect(NUVENS.map((nuvem) => medidaDaNuvem(nuvem, ceu))).toEqual([null, null, null])
  })
})

describe('o movimento', () => {
  const nuvem = NUVENS[0]
  const medida = medidas(CEU_GRANDE)[0]

  it('nuvem e sombra ficam sempre dentro do céu (o mar pintado), a travessia inteira', () => {
    const ceu = CEU_GRANDE
    for (const [i, def] of NUVENS.entries()) {
      const m = medidas(ceu)[i]
      for (let k = 0; k <= 400; k++) {
        const q = quadroDaNuvem(def, m, (k / 400) * m.travessia * 3)
        expect(q.x).toBeGreaterThanOrEqual(ceu.x)
        expect(q.y).toBeGreaterThanOrEqual(ceu.y)
        expect(q.x + m.sombraDx + m.largura).toBeLessThanOrEqual(ceu.x + ceu.largura + 1e-6)
        expect(q.y + m.sombraDy + m.altura).toBeLessThanOrEqual(ceu.y + ceu.altura + 1e-6)
      }
    }
  })

  it('a deriva é linear: o mesmo passo de tempo anda a mesma distância no meio da travessia', () => {
    const t0 = (0.4 - nuvem.fase + 1) * medida.travessia
    const a = quadroDaNuvem(nuvem, medida, t0)
    const b = quadroDaNuvem(nuvem, medida, t0 + 1)
    const c = quadroDaNuvem(nuvem, medida, t0 + 2)
    expect(b.x - a.x).toBeCloseTo(c.x - b.x, 6)
    expect(b.x - a.x).toBeCloseTo(nuvem.velocidade * CEU_GRANDE.unidade, 6)
    expect(a.y).toBe(c.y)
  })

  it('forma-se na beira da esquerda e desfaz-se na da direita, sem tranco; no meio, inteira', () => {
    const em = (progresso: number) => quadroDaNuvem(nuvem, medida, (progresso - nuvem.fase + 1) * medida.travessia)
    expect(em(0).alfa).toBeCloseTo(0, 6)
    expect(em(0.999999).alfa).toBeLessThan(0.001)
    expect(em(0.5).alfa).toBe(1)
    const borda = AJUSTE_DAS_NUVENS.formacao
    expect(em(borda / 2).alfa).toBeCloseTo(0.5, 2)
    // Sobe sem volta: cada passo da formação é maior ou igual ao anterior.
    let antes = 0
    for (let k = 1; k <= 50; k++) {
      const alfa = em((k / 50) * borda).alfa
      expect(alfa).toBeGreaterThanOrEqual(antes - 1e-9)
      antes = alfa
    }
  })

  it('o laço fecha sem salto visível: quando a nuvem volta para a esquerda, ela está transparente', () => {
    const fim = (1 - nuvem.fase + 2) * medida.travessia
    const antes = quadroDaNuvem(nuvem, medida, fim - 0.01)
    const depois = quadroDaNuvem(nuvem, medida, fim + 0.01)
    expect(antes.x).toBeGreaterThan(depois.x)
    expect(antes.alfa).toBeLessThan(0.01)
    expect(depois.alfa).toBeLessThan(0.01)
  })

  it('o mesmo instante dá o mesmo quadro em qualquer tela (mestre e jogador sem conversar)', () => {
    const agora = 1_791_600_000.25
    const daqui = medidaDaNuvem(nuvem, CEU_GRANDE)
    const dali = medidaDaNuvem(nuvem, ceuDoMapa({ ...TASMATURI, floor: [{ ...MAR }] }) ?? CEU_GRANDE)
    if (daqui === null || dali === null) throw new Error('não coube')
    expect(quadroDaNuvem(nuvem, dali, agora)).toEqual(quadroDaNuvem(nuvem, daqui, agora))
  })

  it('o céu mudou um pouco (uma pincelada alargou o chão): a nuvem segue de onde estava, sem pular nem reaparecer', () => {
    // Achado da revisão: a fase vinha de `segundos / travessia` com a travessia
    // tirada da largura do céu; com o relógio de parede (~1,8e9 s), alargar o
    // céu em 1 px já sorteava outro lugar para as três nuvens.
    const CELULA = 64
    const estreito: CeuDoMapa = { x: 400, y: 3000, largura: 12000, altura: 9000, unidade: CEU_GRANDE.unidade }
    const alargado: CeuDoMapa = { ...estreito, x: estreito.x - CELULA, largura: estreito.largura + CELULA }
    for (const def of NUVENS) {
      const antes = medidaDaNuvem(def, estreito)
      const depois = medidaDaNuvem(def, alargado)
      if (antes === null || depois === null) throw new Error('não coube')
      for (const agora of [1_791_600_000.25, 1_791_600_031.5, 1_791_600_077]) {
        const a = quadroDaNuvem(def, antes, agora)
        const b = quadroDaNuvem(def, depois, agora)
        expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(CELULA + 1e-6)
        expect(b.y).toBeCloseTo(a.y, 6)
        expect(b.alfa).toBeCloseTo(a.alfa, 9)
      }
    }
  })

  it('movimento reduzido: parada na fase, inteira, longe das pontas', () => {
    for (const [i, def] of NUVENS.entries()) {
      const m = medidas(CEU_GRANDE)[i]
      const q = quadroDaNuvem(def, m, null)
      expect(q.alfa).toBe(1)
      expect(q.x).toBeCloseTo(m.x0 + def.fase * m.percurso, 6)
      expect(def.fase).toBeGreaterThan(AJUSTE_DAS_NUVENS.formacao)
      expect(def.fase).toBeLessThan(1 - AJUSTE_DAS_NUVENS.formacao)
    }
  })

  it('relógio atrasado (instante negativo) ainda cai dentro da travessia', () => {
    const q = quadroDaNuvem(nuvem, medida, -12.5)
    expect(q.x).toBeGreaterThanOrEqual(medida.x0)
    expect(q.x).toBeLessThanOrEqual(medida.x0 + medida.percurso)
  })
})

describe('de perto, a nuvem vira névoa', () => {
  it('de longe (até 1/4 da tela) o corpo inteiro; de perto (80% da tela ou mais) só o mínimo; sem medida da tela, inteiro', () => {
    expect(corpoPeloZoom(300, 1600)).toBe(1)
    expect(corpoPeloZoom(400, 1600)).toBe(1)
    expect(corpoPeloZoom(1280, 1600)).toBe(NUVEM_DE_PERTO.minimo)
    expect(corpoPeloZoom(2000, 390)).toBe(NUVEM_DE_PERTO.minimo)
    expect(corpoPeloZoom(2000, 0)).toBe(1)
  })

  it('entre os dois, desce sem degrau e sem voltar', () => {
    let antes = 1
    for (let k = 0; k <= 100; k++) {
      const fracao = NUVEM_DE_PERTO.inteiraAte + ((NUVEM_DE_PERTO.minimoDesde - NUVEM_DE_PERTO.inteiraAte) * k) / 100
      const corpo = corpoPeloZoom(fracao * 1000, 1000)
      expect(corpo).toBeLessThanOrEqual(antes + 1e-9)
      expect(antes - corpo).toBeLessThan(0.05)
      antes = corpo
    }
    expect(antes).toBeCloseTo(NUVEM_DE_PERTO.minimo, 6)
  })
})
