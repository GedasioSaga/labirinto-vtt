import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'
import { computeVisibility, hasLineOfSight, visionSegments } from './visibility'
import { sorteador } from './caminhamento/robo.fixture'

/**
 * GRADE DE PRISÃO com um ROBÔ QUE JOGA COMO GENTE (regra de teste de jogos):
 * a ficha presa na cela quer chegar ao ponto do outro lado da grade. O robô
 * reage com ~250 ms de atraso (decide pelo que via 250 ms antes), erra a
 * direção (sorteio com semente fixa) e arrasta meia casa por vez, pelo mesmo
 * caminho do jogador de verdade (`validateTokenMove`, como o host confere).
 *
 * Metas com número: em 5 sementes, 0 de 5 atravessam a grade, e de TODA
 * posição que o robô ocupou a visão alcança o alvo pela grade. Controles: com
 * o vão aberto o robô chega em 5 de 5 (ele sabe andar); com parede comum a
 * visão não passa (a medida tem dente).
 */

const CASA = 50
const ALVO = { x: 750, y: 500 }
const INICIO = { x: 350, y: 500 }
const PAREDE_X = 500
/** A cela: paredes em volta e, na frente, o trecho `y` 350 a 650 é a grade (ou o controle). */
type Frente = 'grade' | 'janela' | 'aberto' | 'parede'

function mapa(frente: Frente): MapData {
  const base = createEmptyMap('cela', 'Cela', 20, 20, CASA)
  const w = (id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({ id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra })
  const walls: Wall[] = [
    w('cima', 200, 200, PAREDE_X, 200),
    w('baixo', 200, 800, PAREDE_X, 800),
    w('fundo', 200, 200, 200, 800),
    w('frente-cima', PAREDE_X, 200, PAREDE_X, 350),
    w('frente-baixo', PAREDE_X, 650, PAREDE_X, 800),
  ]
  if (frente === 'grade') walls.push(w('grade', PAREDE_X, 350, PAREDE_X, 650, { janela: true, grade: true }))
  if (frente === 'janela') walls.push(w('grade', PAREDE_X, 350, PAREDE_X, 650, { janela: true }))
  if (frente === 'parede') walls.push(w('grade', PAREDE_X, 350, PAREDE_X, 650))
  const ficha: Token = { ...(base.tokens[0] ?? ({} as Token)), id: 'preso', x: INICIO.x, y: INICIO.y } as Token
  return { ...base, walls, tokens: [ficha] }
}

/** Normal com semente (Box-Muller sobre o sorteio da fixture). */
function normal(sorte: () => number): number {
  const u = Math.max(sorte(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * sorte())
}

const ATRASO_MS = 250
const TIQUE_MS = 50
const DURACAO_MS = 30_000
const ERRO_RAD = (25 * Math.PI) / 180
const PASSO_PX = CASA / 2

interface Partida {
  chegou: boolean
  atravessou: boolean
  posicoes: { x: number; y: number }[]
  recusas: number
}

function jogar(frente: Frente, semente: number): Partida {
  const sorte = sorteador(semente)
  let m = mapa(frente)
  const historico: { t: number; x: number; y: number }[] = [{ t: 0, x: INICIO.x, y: INICIO.y }]
  const posicoes = [{ ...INICIO }]
  let recusas = 0
  let desvio = 0
  let proximaDecisao = ATRASO_MS
  for (let t = TIQUE_MS; t <= DURACAO_MS; t += TIQUE_MS) {
    if (t < proximaDecisao) continue
    // Decide pelo que via ATRASO_MS antes (a reação de gente), não pela posição de agora.
    const visto = [...historico].reverse().find((h) => h.t <= t - ATRASO_MS) ?? historico[0]
    const angulo = Math.atan2(ALVO.y - visto.y, ALVO.x - visto.x) + desvio + normal(sorte) * ERRO_RAD
    const ficha = m.tokens[0]
    const pedido = { playerId: 'jogador', tokenId: 'preso', x: ficha.x + Math.cos(angulo) * PASSO_PX, y: ficha.y + Math.sin(angulo) * PASSO_PX }
    const r = validateTokenMove(m, pedido, { jogador: ['preso'] })
    if (r.ok) {
      m = { ...m, tokens: [{ ...ficha, x: r.x, y: r.y }] }
      posicoes.push({ x: r.x, y: r.y })
      historico.push({ t, x: r.x, y: r.y })
      desvio *= 0.5
    } else {
      // Bateu: tenta contornar para um lado sorteado, como quem procura a saída.
      recusas += 1
      desvio = (sorte() < 0.5 ? -1 : 1) * (Math.PI / 3 + sorte() * Math.PI / 2)
    }
    proximaDecisao = t + ATRASO_MS + sorte() * 100
    const agora = m.tokens[0]
    if (Math.hypot(agora.x - ALVO.x, agora.y - ALVO.y) < CASA) break
  }
  const final = m.tokens[0]
  return {
    chegou: Math.hypot(final.x - ALVO.x, final.y - ALVO.y) < CASA,
    atravessou: posicoes.some((p) => p.x > PAREDE_X),
    posicoes,
    recusas,
  }
}

function dentroDoPoligono(p: { x: number; y: number }, poligono: readonly { x: number; y: number }[]): boolean {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i, i += 1) {
    const a = poligono[i]
    const b = poligono[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

const SEMENTES = [1, 2, 3, 4, 5]

describe('grade de prisão: o robô não passa e vê através', () => {
  it('0 de 5 atravessam a grade, e o robô tentou de verdade (bateu nela)', () => {
    const partidas = SEMENTES.map((s) => jogar('grade', s))
    expect(partidas.filter((p) => p.atravessou).length).toBe(0)
    for (const p of partidas) {
      expect(p.recusas).toBeGreaterThanOrEqual(5)
      // Chegou junto da grade (a menos de 1 casa dela).
      expect(Math.max(...p.posicoes.map((q) => q.x))).toBeGreaterThan(PAREDE_X - CASA)
    }
  })

  it('de toda posição que o robô ocupou na frente da grade, a visão alcança o alvo', () => {
    const m = mapa('grade')
    const segmentos = visionSegments(m)
    for (const s of SEMENTES) {
      for (const p of jogar('grade', s).posicoes) {
        // Só as posições cuja reta até o alvo cruza a frente pela grade (y de 350 a 650 em x = 500).
        const yNaFrente = p.y + ((ALVO.y - p.y) * (PAREDE_X - p.x)) / (ALVO.x - p.x)
        if (yNaFrente <= 355 || yNaFrente >= 645) continue
        expect(hasLineOfSight(p, ALVO, segmentos)).toBe(true)
      }
    }
    expect(dentroDoPoligono(ALVO, computeVisibility(INICIO, segmentos, 2000))).toBe(true)
  })

  it('a grade não muda as regras da janela (mesmo resultado com e sem o campo)', () => {
    for (const s of SEMENTES) {
      expect(jogar('grade', s).posicoes).toEqual(jogar('janela', s).posicoes)
    }
  })

  it('CONTROLE: com o vão aberto o robô chega em 5 de 5 (ele sabe andar)', () => {
    expect(SEMENTES.map((s) => jogar('aberto', s)).filter((p) => p.chegou).length).toBe(5)
  })

  it('CONTROLE: com parede comum a visão não passa', () => {
    const segmentos = visionSegments(mapa('parede'))
    expect(hasLineOfSight(INICIO, ALVO, segmentos)).toBe(false)
    expect(dentroDoPoligono(ALVO, computeVisibility(INICIO, segmentos, 2000))).toBe(false)
  })
})
