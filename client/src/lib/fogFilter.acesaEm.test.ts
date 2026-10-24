/**
 * LUZ QUE ACENDE SOZINHA (Luz L3) no recorte do jogador, com pacote forjado
 * (o mapa do mestre montado à mão e passado direto a `filterMapForPlayer`).
 * O período da cena viaja marcado no raio (`raioDoPeriodo`), como a noite da
 * L2: a luz apagada no período não sai, não ilumina e não revela ficha; o
 * campo `acesaEm` nunca sai; a cena interior ignora a troca.
 */
import { describe, expect, it } from 'vitest'
import type { Light, MapData, Periodo, Token, Wall } from '../types/map'
import { filterMapForPlayer, raioDaNoite, raioDoPeriodo, type VisionRadius } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { luzAcesaNoPeriodo } from './periodo'

const GRID = 50
const HEROI = { x: 1000, y: 1000 }
const RAIO = 400
const NOITE = 150
const OITO_CASAS = 8 * GRID
const SO_ANA: Record<string, string[]> = { ana: ['heroi'] }
const PERIODOS: Periodo[] = ['dia', 'tarde', 'noite']

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function luz(id: string, x: number, y: number, radius: number, extra: Partial<Light> = {}): Light {
  return { id, x, y, radius, color: '#ffba7b', intensity: 0.85, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function cena(tokens: Token[], lights: Light[], marcas: Partial<MapData> = { externa: true }): MapData {
  return { ...createEmptyMap('vila', 'Vila', 40, 40, GRID), tokens: [ficha('heroi', HEROI.x, HEROI.y), ...tokens], lights, ...marcas }
}

/** O raio do host no período: à noite a visão curta e marcada, de dia e de tarde a cheia. */
function raioNo(periodo: Periodo): VisionRadius {
  return periodo === 'noite' ? raioDaNoite(() => NOITE) : raioDoPeriodo(() => RAIO, periodo)
}

function luzesQueChegam(map: MapData, periodo: Periodo): string[] {
  return filterMapForPlayer(map, 'ana', SO_ANA, raioNo(periodo))
    .map.lights.map((l) => l.id)
    .sort()
}

describe('a luz que acende sozinha no recorte (pacote forjado)', () => {
  it('lampião só à noite: de dia e de tarde não sai; à noite sai, e sem o campo acesaEm', () => {
    const map = cena([], [luz('lampiao', HEROI.x + 60, HEROI.y, 120, { acesaEm: ['noite'] })])
    expect(luzesQueChegam(map, 'dia')).toEqual([])
    expect(luzesQueChegam(map, 'tarde')).toEqual([])
    expect(luzesQueChegam(map, 'noite')).toEqual(['lampiao'])
    for (const periodo of PERIODOS) expect(JSON.stringify(filterMapForPlayer(map, 'ana', SO_ANA, raioNo(periodo)))).not.toContain('acesaEm')
  })

  it('[] nunca sai; sem o campo sai sempre', () => {
    const map = cena([], [luz('nunca', HEROI.x + 60, HEROI.y, 120, { acesaEm: [] }), luz('sempre', HEROI.x - 60, HEROI.y, 120)])
    for (const periodo of PERIODOS) expect(luzesQueChegam(map, periodo), periodo).toEqual(['sempre'])
  })

  it('luz apagada no período não revela ficha: o guarda sob o lampião do dia fica no escuro à noite', () => {
    const guarda = ficha('guarda', HEROI.x, HEROI.y + OITO_CASAS)
    const doDia = cena([guarda], [luz('lampiao', HEROI.x, HEROI.y + OITO_CASAS + 20, 100, { acesaEm: ['dia'] })])
    const daNoite = cena([guarda], [luz('lampiao', HEROI.x, HEROI.y + OITO_CASAS + 20, 100, { acesaEm: ['tarde', 'noite'] })])
    const ids = (map: MapData): string[] => filterMapForPlayer(map, 'ana', SO_ANA, raioNo('noite')).map.tokens.map((t) => t.id).sort()
    expect(ids(doDia)).toEqual(['heroi'])
    expect(JSON.stringify(filterMapForPlayer(doDia, 'ana', SO_ANA, raioNo('noite')))).not.toContain('"guarda"')
    expect(ids(daNoite)).toEqual(['guarda', 'heroi'])
  })

  it('vista de longe apagada no período: nem o ponto aceso sai', () => {
    const farol = luz('farol', HEROI.x + 900, HEROI.y, 80, { vistaDeLonge: true, acesaEm: ['noite'] })
    expect(luzesQueChegam(cena([], [farol]), 'dia')).toEqual([])
    expect(luzesQueChegam(cena([], [farol]), 'noite')).toEqual(['farol'])
  })

  it('cena interior ignora a troca (D1): a luz da tarde e da noite acende de dia', () => {
    const map = cena([], [luz('tocha', HEROI.x + 60, HEROI.y, 120, { acesaEm: ['tarde', 'noite'] })], {})
    for (const periodo of PERIODOS) expect(luzesQueChegam(map, periodo), periodo).toEqual(['tocha'])
  })

  it('apagada e porEstado vencem no recorte também', () => {
    const porEstado: Light['porEstado'] = { estadoId: 'energia', efeitos: [{ valor: 'ligada', efeito: 'acesa' }] }
    const map = cena([], [luz('apagada', HEROI.x + 60, HEROI.y, 120, { acesaEm: ['noite'], apagada: true }), luz('estado', HEROI.x - 60, HEROI.y, 120, { acesaEm: [], porEstado })])
    for (const periodo of PERIODOS) expect(luzesQueChegam(map, periodo), periodo).toEqual(['estado'])
  })

  it('raio sem marca (quem chama sem período): a cena de período fixo vale; senão, dia', () => {
    const lampiao = luz('lampiao', HEROI.x + 60, HEROI.y, 120, { acesaEm: ['noite'] })
    expect(filterMapForPlayer(cena([], [lampiao]), 'ana', SO_ANA, RAIO).map.lights).toEqual([])
    expect(filterMapForPlayer(cena([], [lampiao], { periodoFixo: 'noite' }), 'ana', SO_ANA, RAIO).map.lights.map((l) => l.id)).toEqual(['lampiao'])
  })
})

/** Gerador com semente fixa (mulberry32): a mesma semente sorteia os mesmos cenários. */
function sorteador(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ACESA_EM_SORTEADOS: unknown[] = [undefined, [], ['dia'], ['tarde'], ['noite'], ['tarde', 'noite'], ['dia', 'noite'], ['dia', 'tarde', 'noite'], 'noite', ['madrugada'], 7]

/** Um cenário sorteado: cena externa, interior ou fixa; 6 luzes, 6 NPCs e 3 muros em volta do herói. */
function cenario(r: () => number, comAcesaEm: boolean): { map: MapData; periodo: Periodo } {
  const perto = (): number => Math.round((r() - 0.5) * 2 * 600)
  const marcas: Partial<MapData>[] = [{ externa: true }, {}, { periodoFixo: 'noite' }, { periodoFixo: 'tarde' }]
  const lights = Array.from({ length: 6 }, (_, i) => {
    const extra: Partial<Light> = {}
    if (comAcesaEm) {
      const sorteado = ACESA_EM_SORTEADOS[Math.floor(r() * ACESA_EM_SORTEADOS.length)]
      if (sorteado !== undefined) extra.acesaEm = sorteado as Periodo[] // forja de propósito: o sorteio inclui valor torto
    }
    if (r() < 0.15) extra.apagada = true
    if (r() < 0.2) extra.vistaDeLonge = true
    return luz(`luz${i}`, HEROI.x + perto(), HEROI.y + perto(), 60 + Math.round(r() * 200), extra)
  })
  const tokens = Array.from({ length: 6 }, (_, i) => ficha(`npc${i}`, HEROI.x + perto(), HEROI.y + perto()))
  const walls = Array.from({ length: 3 }, (_, i) => parede(`muro${i}`, HEROI.x + perto(), HEROI.y + perto(), HEROI.x + perto(), HEROI.y + perto()))
  const map = { ...cena(tokens, lights, marcas[Math.floor(r() * marcas.length)]), walls }
  return { map, periodo: PERIODOS[Math.floor(r() * PERIODOS.length)] ?? 'dia' }
}

/** O raio que o host da L2 mandava (antes da L3): só a noite marcada. */
function raioDaL2(periodo: Periodo): VisionRadius {
  return periodo === 'noite' ? raioDaNoite(() => NOITE) : () => RAIO
}

describe('vazamento com sementes fixas', () => {
  it('1.000 pedidos sorteados: 0 fora da regra (o recorte é o mesmo de um mapa só com as luzes acesas)', () => {
    const r = sorteador(20261024)
    let foraDaRegra = 0
    for (let i = 0; i < 1000; i += 1) {
      const { map, periodo } = cenario(r, true)
      const raio = raioNo(periodo)
      const recorte = filterMapForPlayer(map, 'ana', SO_ANA, raio)
      const soAcesas = { ...map, lights: map.lights.filter((l) => luzAcesaNoPeriodo(l, map, periodo)) }
      const esperado = filterMapForPlayer(soAcesas, 'ana', SO_ANA, raio)
      const texto = JSON.stringify(recorte)
      if (texto.includes('acesaEm') || texto !== JSON.stringify(esperado)) foraDaRegra += 1
    }
    expect(foraDaRegra).toBe(0)
  }, 120_000)

  it('mapa antigo (sem acesaEm): veredito idêntico ao da L2 em 500 pedidos com semente fixa', () => {
    const r = sorteador(924)
    let diferentes = 0
    for (let i = 0; i < 500; i += 1) {
      const { map, periodo } = cenario(r, false)
      const hoje = JSON.stringify(filterMapForPlayer(map, 'ana', SO_ANA, raioDaL2(periodo)))
      if (JSON.stringify(filterMapForPlayer(map, 'ana', SO_ANA, raioNo(periodo))) !== hoje) diferentes += 1
    }
    expect(diferentes).toBe(0)
  }, 120_000)
})
