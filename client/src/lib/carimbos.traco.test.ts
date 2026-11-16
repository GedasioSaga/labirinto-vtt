import { describe, expect, it } from 'vitest'
import type { Carimbo, RegionPoint } from '../types/map'
import { criarTraco, TRACO_PADRAO, type OpcoesDoTraco, type TracoDoCarimbo } from './carimbos'

/**
 * O TRAÇO dos Carimbos (`criarTraco`, 16/11/2026): arrastar solta um objeto a
 * cada passo fixo AO LONGO do caminho, o módulo que emenda (a sebe) ganha um
 * no canto e um na ponta, e a trilha de pedras vira para o rumo.
 */

const SEBE: TracoDoCarimbo = { espaco: 0.36, emenda: true, preferido: true }
/** O tamanho do módulo no mundo (o de um mapa de casas de 50 px): o passo da sebe é 14,4 px. */
const T = 40
const PASSO_DA_SEBE = SEBE.espaco * T

function ids(): () => string {
  let n = 0
  return () => `t${++n}`
}

function traco(jeito: TracoDoCarimbo, extra: Partial<OpcoesDoTraco> = {}) {
  return criarTraco({ tipo: 'sebe-aparada', tamanho: T, espaco: jeito.espaco, jeito, sorteio: () => 0.5, novoId: ids(), ...extra })
}

/** Arrasta pelo caminho como a mão: um ponto a cada 7 px, e solta no último. */
function arrastar(jeito: TracoDoCarimbo, cantos: readonly RegionPoint[], extra: Partial<OpcoesDoTraco> = {}): Carimbo[] {
  const t = traco(jeito, extra)
  t.comecar(cantos[0])
  for (let i = 1; i < cantos.length; i++) {
    const de = cantos[i - 1]
    const ate = cantos[i]
    const n = Math.ceil(Math.hypot(ate.x - de.x, ate.y - de.y) / 7)
    for (let k = 1; k <= n; k++) t.passar({ x: de.x + ((ate.x - de.x) * k) / n, y: de.y + ((ate.y - de.y) * k) / n })
  }
  t.terminar(cantos[cantos.length - 1])
  return [...t.soltos()]
}

/** Para cada ponto do caminho (de px em px), a distância "de quadrado" (a maior das duas) ao módulo mais perto. */
function maiorFolgaNoCaminho(soltos: readonly Carimbo[], cantos: readonly RegionPoint[]): number {
  let maior = 0
  for (let i = 1; i < cantos.length; i++) {
    const de = cantos[i - 1]
    const ate = cantos[i]
    const n = Math.ceil(Math.hypot(ate.x - de.x, ate.y - de.y))
    for (let k = 0; k <= n; k++) {
      const p = { x: de.x + ((ate.x - de.x) * k) / n, y: de.y + ((ate.y - de.y) * k) / n }
      maior = Math.max(maior, Math.min(...soltos.map((c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)))))
    }
  }
  return maior
}

describe('traço', () => {
  it('a sebe de 10 casas: um módulo a cada passo, todos do mesmo tamanho, até onde a mão soltou', () => {
    const reta = [
      { x: 100, y: 200 },
      { x: 600, y: 200 },
    ]
    const soltos = arrastar(SEBE, reta)
    const xs = soltos.map((c) => c.x).sort((a, b) => a - b)
    // 500 px / 14,4 = 34 passos inteiros: 35 do passo fixo (o do clique incluído) e o da ponta.
    expect(soltos).toHaveLength(36)
    expect(xs[0]).toBe(100)
    expect(xs[xs.length - 1]).toBe(600)
    for (let i = 1; i < xs.length - 1; i++) expect(Math.abs(xs[i] - xs[i - 1] - PASSO_DA_SEBE)).toBeLessThanOrEqual(0.1)
    expect(new Set(soltos.map((c) => c.tamanho))).toEqual(new Set([T]))
    expect(soltos.every((c) => c.y === 200)).toBe(true)
    // O pé cheio do módulo tem 0,404 de lado: nenhum ponto da reta fica a mais de meio passo do módulo mais perto.
    expect(maiorFolgaNoCaminho(soltos, reta)).toBeLessThanOrEqual(PASSO_DA_SEBE / 2 + 0.1)
  })

  it('a sebe em L num arrasto só ganha o módulo do canto: a quina não sai mordida', () => {
    const ele = [
      { x: 100, y: 100 },
      { x: 333, y: 100 },
      { x: 333, y: 310 },
    ]
    const soltos = arrastar(SEBE, ele)
    expect(soltos.some((c) => c.x === 333 && c.y === 100)).toBe(true)
    expect(soltos.some((c) => c.x === 333 && c.y === 310)).toBe(true)
    expect(maiorFolgaNoCaminho(soltos, ele)).toBeLessThanOrEqual(PASSO_DA_SEBE / 2 + 0.1)
    // A reta não vira canto: na de cima, os 17 do passo fixo (233 px / 14,4) e só o da quina a mais.
    expect(soltos.filter((c) => c.y === 100)).toHaveLength(17 + 1)
  })

  it('o clique (a mão tremeu sem sair dele) solta um só; vagas no fim param o traço', () => {
    const clique = traco(SEBE)
    clique.comecar({ x: 50, y: 50 })
    clique.passar({ x: 51, y: 50 })
    clique.terminar({ x: 51.5, y: 50.5 })
    expect(clique.soltos()).toHaveLength(1)
    expect(clique.espalhou()).toBe(false)

    const curto = arrastar(SEBE, [{ x: 0, y: 0 }, { x: 500, y: 0 }], { vagas: 5 })
    expect(curto).toHaveLength(5)
  })

  it('a trilha de pedras vira para o rumo e mede o passo no chão achatado', () => {
    const PEDRAS: TracoDoCarimbo = { espaco: 1.2, rumo: true, achata: 0.55 }
    const deLado = arrastar(PEDRAS, [{ x: 0, y: 0 }, { x: 300, y: 0 }], { tipo: 'pedras-de-passo' })
    expect(deLado.map((c) => c.giro)).toEqual(deLado.map(() => 0))
    expect(deLado[1].x - deLado[0].x).toBeCloseTo(48, 5)
    const descendo = arrastar(PEDRAS, [{ x: 0, y: 0 }, { x: 0, y: 300 }], { tipo: 'pedras-de-passo' })
    // O primeiro esperava o rumo e também desce.
    expect(descendo.map((c) => c.giro)).toEqual(descendo.map(() => 90))
    // No chão o passo é o mesmo (48 px); na tela, achatado: 48 × 0,55.
    expect(descendo[1].y - descendo[0].y).toBeCloseTo(26.4, 1)
    // Sem jeito próprio: um tamanho de distância, o giro sorteado e sem a ponta do módulo que emenda.
    const fileira = arrastar(TRACO_PADRAO, [{ x: 0, y: 0 }, { x: 100, y: 0 }], { tipo: 'arvore' })
    expect(fileira.map((c) => c.x)).toEqual([0, 40, 80])
  })
})
