/**
 * ETAPAS DO POSTO e APITO ANDANDO (Caminhos F4) — o agendador puro.
 * Os passos da patrulha (esperar, falar, olhar, velocidade, esperar o mestre)
 * viram as etapas do posto da rotina (`PostoDaRotina.passos`), com o mesmo
 * executor (`lib/etapasDoNpc.ts`). O apito liga a caminhada (`apitarRotina`).
 *
 * Metas (escritas antes do código):
 * - posto com [Falar, Esperar 3 s, Olhar 90]: chega falando, fica 3 s (15
 *   tiques) no posto com a fala, e no tique seguinte olha para 90, cala e anda;
 * - posto sem etapas: espera 2 s (10 tiques), como antes do campo;
 * - etapa Velocidade 4: o trecho seguinte anda 4 casas/s, e volta a 2 no
 *   posto depois;
 * - apito em quem não andava: anda até o posto (mesmo fora do período), faz as
 *   etapas e sai da rotina andando; com "Esperar o mestre", espera o "Seguir";
 * - nenhum passo maior que 1 passo do trecho (+1 px).
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import type { MapData, PassoDaPatrulha, Periodo, PostoDaRotina, Token } from '../types/map'
import { comPortasDoNpc, type MotorDosNpcs, motorImediato } from './caminhamento/tiqueDosNpcs'
import type { EstadoDoMundo } from './estadoDoMundo'
import { createEmptyMap } from './mapFactory'
import { apitarRotina, darPassoDaRotina, ligarRotina, PASSO_DA_ROTINA_MS, passoEmPx, type RotinasAndando, seguirRotina } from './rotinaAndando'
import { type CenaDaRotina, moverNaCena, planejarRotina } from './rotinaDoNpc'

const G = 64
const PASSO = passoEmPx(G)
const APITO: EstadoDoMundo = { id: 'apito', nome: 'Apito', valores: ['Aurora', 'Meio', 'Brasa'], atual: 'Aurora' }
const ESTADOS = [APITO]
const CENA = 'praca'

const AURORA = { x: 160, y: 224 }
const MEIO = { x: 736, y: 224 }

function posto(valor: string, p: Point, passos?: PassoDaPatrulha[], periodo?: Periodo): PostoDaRotina {
  return { valor, sceneId: CENA, x: p.x, y: p.y, ...(passos === undefined ? {} : { passos }), ...(periodo === undefined ? {} : { periodo }) }
}

function tobias(p: Point, postos: PostoDaRotina[]): Token {
  return { id: 'tobias', characterId: null, name: 'Irmão Tobias', x: p.x, y: p.y, size: 1, image: null, npc: true, rotina: { estadoId: APITO.id, postos } }
}

/** Praça externa de 15 x 10 casas. */
function praca(tokens: Token[]): CenaDaRotina[] {
  const base: MapData = createEmptyMap(CENA, CENA, 15, 10, G)
  return [{ sceneId: CENA, map: { ...base, externa: true, tokens } }]
}

interface Mundo {
  cenas: CenaDaRotina[]
  andando: RotinasAndando
  motor: MotorDosNpcs
  t: number
}

/** Um tique na sessão `sessao`, aplicado no mapa como o editor aplica. */
function tique(m: Mundo, sessao: Periodo | null = 'dia'): void {
  const r = darPassoDaRotina(m.cenas, m.andando, ESTADOS, m.t * PASSO_DA_ROTINA_MS, new Set(), m.motor, sessao)
  m.cenas = m.cenas.map((c) => ({ ...c, map: comPortasDoNpc(moverNaCena(c.map, r.movimentos), r.portas.filter((p) => p.sceneId === c.sceneId)) }))
  m.andando = r.andando
  m.t += 1
}

function ficha(m: Mundo): Token {
  const t = m.cenas[0]?.map.tokens.find((token) => token.id === 'tobias')
  if (t === undefined) throw new Error('o Tobias sumiu do mapa')
  return t
}

interface Foto {
  x: number
  y: number
  fala: string | undefined
  rotation: number | undefined
  andando: boolean
}

/** `n` tiques: a ficha depois de cada um. */
function filmar(m: Mundo, n: number, sessao: Periodo | null = 'dia'): Foto[] {
  const fotos: Foto[] = []
  for (let k = 0; k < n; k += 1) {
    tique(m, sessao)
    const t = ficha(m)
    fotos.push({ x: t.x, y: t.y, fala: t.fala, rotation: t.rotation, andando: m.andando.has('tobias') })
  }
  return fotos
}

function maiorPasso(fotos: readonly Foto[], de: Point): number {
  let antes = de
  let maior = 0
  for (const f of fotos) {
    maior = Math.max(maior, Math.hypot(f.x - antes.x, f.y - antes.y))
    antes = f
  }
  return maior
}

const noPonto = (f: Foto, p: Point) => f.x === p.x && f.y === p.y

function ligado(cenas: CenaDaRotina[]): Mundo {
  return { cenas, andando: ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), motor: motorImediato(), t: 0 }
}

describe('etapas do posto na rotina andando', () => {
  it('[Falar, Esperar 3 s, Olhar 90]: chega falando, fica 15 tiques, olha, cala e anda', () => {
    const etapas: PassoDaPatrulha[] = [{ tipo: 'falar', texto: 'Bom dia' }, { tipo: 'esperar', segundos: 3 }, { tipo: 'olhar', graus: 90 }]
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA), posto('Meio', MEIO, etapas)])]))
    const fotos = filmar(m, 60)
    const a = fotos.findIndex((f) => noPonto(f, MEIO))
    expect(a).toBeGreaterThan(0)
    for (let k = a; k < a + 15; k += 1) {
      expect(noPonto(fotos[k], MEIO)).toBe(true)
      expect(fotos[k].fala).toBe('Bom dia')
    }
    const saiu = fotos[a + 15]
    expect(saiu.rotation).toBe(90)
    expect(saiu.fala).toBeUndefined()
    expect(noPonto(saiu, MEIO)).toBe(false)
    expect(maiorPasso(fotos, AURORA)).toBeLessThanOrEqual(PASSO + 1)
  })

  it('posto sem etapas: espera 2 s (10 tiques), como antes do campo', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA), posto('Meio', MEIO)])]))
    const fotos = filmar(m, 50)
    const a = fotos.findIndex((f) => noPonto(f, MEIO))
    expect(a).toBeGreaterThan(0)
    for (let k = a; k < a + 10; k += 1) expect(noPonto(fotos[k], MEIO)).toBe(true)
    expect(noPonto(fotos[a + 10], MEIO)).toBe(false)
  })

  it('etapa Velocidade 4: o trecho seguinte anda 4 casas/s; no posto depois, volta a 2', () => {
    const m = ligado(praca([tobias(AURORA, [posto('Aurora', AURORA), posto('Meio', MEIO, [{ tipo: 'velocidade', casas: 4 }])])]))
    const fotos = filmar(m, 80)
    const a = fotos.findIndex((f) => noPonto(f, MEIO))
    // Sem espera no posto: no tique seguinte já anda, no passo de 4 casas/s.
    const rapido = Math.hypot(fotos[a + 1].x - MEIO.x, fotos[a + 1].y - MEIO.y)
    expect(rapido).toBeGreaterThan(PASSO + 1)
    expect(rapido).toBeLessThanOrEqual(passoEmPx(G, 4) + 1)
    // Chegou à Aurora (sem etapas: espera 2 s) e voltou ao passo de 2 casas/s.
    const volta = fotos.findIndex((f, k) => k > a && noPonto(f, AURORA))
    expect(volta).toBeGreaterThan(a)
    const depois = fotos[volta + 11]
    expect(Math.hypot(depois.x - fotos[volta + 10].x, depois.y - fotos[volta + 10].y)).toBeLessThanOrEqual(PASSO + 1)
  })
})

describe('apito andando (apitarRotina)', () => {
  function apitado(cenas: CenaDaRotina[], valor: string, andando: RotinasAndando = new Map()): Mundo {
    const movimentos = planejarRotina(cenas, APITO.id, valor)
    return { cenas, andando: apitarRotina(andando, cenas, movimentos, valor, ESTADOS, 0), motor: motorImediato(), t: 0 }
  }

  it('não move ninguém no ato; anda até o posto, faz as etapas e sai da rotina andando', () => {
    const cenas = praca([tobias(AURORA, [posto('Meio', MEIO, [{ tipo: 'falar', texto: 'Cheguei' }])])])
    const m = apitado(cenas, 'Meio')
    expect(ficha(m)).toEqual(expect.objectContaining(AURORA))
    expect(m.andando.get('tobias')?.apito).toEqual({ valor: 'Meio', seguir: false })
    const fotos = filmar(m, 40)
    const a = fotos.findIndex((f) => noPonto(f, MEIO))
    expect(a).toBeGreaterThan(0)
    expect(fotos[0].x - AURORA.x).toBeGreaterThan(0)
    expect(maiorPasso(fotos, AURORA)).toBeLessThanOrEqual(PASSO + 1)
    // Chegou, falou e parou: sai da rotina andando, e a fala fica (ela não voltou a andar).
    expect(fotos[a].andando).toBe(false)
    expect(fotos[fotos.length - 1]).toEqual(expect.objectContaining({ ...MEIO, fala: 'Cheguei', andando: false }))
  })

  it('o posto do apito vale fora do período (o loop o pularia)', () => {
    const cenas = praca([tobias(AURORA, [posto('Meio', MEIO, undefined, 'noite')])])
    const m = apitado(cenas, 'Meio')
    filmar(m, 40, 'dia')
    expect(ficha(m)).toEqual(expect.objectContaining(MEIO))
  })

  it('"Esperar o mestre" segura quem foi pelo apito até o "Seguir"; depois faz o resto e sai', () => {
    const cenas = praca([tobias(AURORA, [posto('Meio', MEIO, [{ tipo: 'esperarMestre' }, { tipo: 'falar', texto: 'Pronto' }])])])
    const m = apitado(cenas, 'Meio')
    filmar(m, 60)
    expect(ficha(m)).toEqual(expect.objectContaining(MEIO))
    expect(m.andando.get('tobias')?.esperandoMestre).toBe(true)
    expect(ficha(m).fala).toBeUndefined()
    m.andando = seguirRotina(m.andando, 'tobias', m.t * PASSO_DA_ROTINA_MS)
    filmar(m, 1)
    expect(ficha(m)).toEqual(expect.objectContaining({ ...MEIO, fala: 'Pronto' }))
    expect(m.andando.has('tobias')).toBe(false)
  })

  it('quem já andava sozinha mira o posto do apito e, chegando, segue o loop (sem o apito)', () => {
    const BRASA = { x: 160, y: 480 }
    const cenas = praca([tobias(AURORA, [posto('Aurora', AURORA), posto('Meio', MEIO), posto('Brasa', BRASA)])])
    const ligada = ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0)
    const m = apitado(cenas, 'Brasa', ligada)
    expect(m.andando.get('tobias')).toEqual(expect.objectContaining({ destino: 2, apito: { valor: 'Brasa', seguir: true } }))
    // 256 px a 25,6 px por tique: chega no 10º tique e espera 2 s; 15 tiques param antes de ela chegar à Aurora.
    const fotos = filmar(m, 15)
    const a = fotos.findIndex((f) => noPonto(f, BRASA))
    expect(a).toBeGreaterThan(0)
    expect(fotos[a].andando).toBe(true)
    // Depois da Brasa, o seguinte na ordem do estado: a Aurora (índice 0).
    expect(m.andando.get('tobias')).toEqual(expect.objectContaining({ destino: 0 }))
    expect(m.andando.get('tobias')?.apito).toBeUndefined()
  })

  it('movimento vazio, ou valor sem posto: o mesmo estado', () => {
    const cenas = praca([tobias(AURORA, [posto('Meio', MEIO)])])
    const andando: RotinasAndando = new Map()
    expect(apitarRotina(andando, cenas, [], 'Meio', ESTADOS, 0)).toBe(andando)
    expect(apitarRotina(andando, cenas, [{ tokenId: 'tobias', de: CENA, para: CENA, x: 0, y: 0 }], 'Brasa', ESTADOS, 0)).toBe(andando)
  })
})

describe('moverNaCena com os efeitos das etapas', () => {
  it('quem troca de cena leva o efeito (fala, oculta) sem mudar de lugar aqui', () => {
    const [cena] = praca([tobias(AURORA, [])])
    const depois = moverNaCena(cena.map, [{ tokenId: 'tobias', de: CENA, para: 'outra', x: 999, y: 999, fala: 'Lá vou eu', sumida: true }])
    expect(depois.tokens[0]).toEqual(expect.objectContaining({ ...AURORA, fala: 'Lá vou eu', hidden: true }))
  })

  it('movimento sem efeito para outra cena: o MESMO mapa', () => {
    const [cena] = praca([tobias(AURORA, [])])
    expect(moverNaCena(cena.map, [{ tokenId: 'tobias', de: CENA, para: 'outra', x: 999, y: 999 }])).toBe(cena.map)
  })
})
