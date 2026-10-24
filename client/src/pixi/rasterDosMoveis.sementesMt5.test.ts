import { describe, expect, it } from 'vitest'
import { SEMENTES } from './rasterDosMoveis'
import { desenhoDoApp, medir, reprovacoes, TIPOS_MT5, type Candidato, type MedidasMt5 } from '../texturas/meioTermo/moveis/medidasMt5.testkit'

/**
 * As 5 PEÇAS NOVAS da MT5 nas 1000 sementes: em cada tipo, o PIOR candidato
 * EM CADA CRITÉRIO (menor contorno, maior saturação p95, menor brilho médio,
 * menor miolo, achados com a semente do app) passa em TODOS os limites, em
 * todas as sementes, nos níveis 3 e 1.
 *
 * Custo medido na MT5 (sob o trinco, este arquivo sozinho): ver a seção MT5
 * do plano `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`.
 */

const CRITERIOS_DO_PIOR: Readonly<Record<string, (a: MedidasMt5, b: MedidasMt5) => boolean>> = {
  'menor contorno': (a, b) => Math.min(b.contornoMinimo, b.brilhoMinimo) < Math.min(a.contornoMinimo, a.brilhoMinimo),
  'maior saturação p95': (a, b) => b.saturacaoP95 > a.saturacaoP95,
  'menor brilho médio': (a, b) => b.brilhoMedio < a.brilhoMedio,
  'menor miolo': (a, b) => b.opacidadeDoMiolo - b.translucido < a.opacidadeDoMiolo - a.translucido,
}

interface Pior {
  readonly candidato: Candidato
  readonly criterios: string[]
}

function pioresPorCriterio(candidatos: readonly Candidato[], nivel: number): Pior[] {
  const medidos = candidatos.map((c) => ({ c, m: medir(desenhoDoApp(c.prop, nivel), nivel) }))
  const piores = new Map<string, Pior>()
  for (const [criterio, ehPior] of Object.entries(CRITERIOS_DO_PIOR)) {
    const pior = medidos.reduce((a, b) => (ehPior(a.m, b.m) ? b : a))
    const visto = piores.get(pior.c.nome)
    if (visto === undefined) piores.set(pior.c.nome, { candidato: pior.c, criterios: [criterio] })
    else visto.criterios.push(criterio)
  }
  return [...piores.values()]
}

function reprovadasNasSementes(piores: readonly Pior[], nivel: number): string[] {
  const reprovadas: string[] = []
  for (const { candidato, criterios } of piores) {
    const base = desenhoDoApp(candidato.prop, nivel)
    for (let semente = 0; semente < SEMENTES; semente += 1) {
      const falhas = reprovacoes(medir({ ...base, semente }, nivel))
      if (falhas.length > 0) reprovadas.push(`${candidato.nome} (pior em ${criterios.join(', ')}), semente ${semente}: ${falhas.join(', ')}`)
    }
  }
  return reprovadas
}

const NIVEIS_DA_VARREDURA = [3, 1] as const

describe('MT5: as 1000 sementes no pior candidato de cada critério', () => {
  for (const nivel of NIVEIS_DA_VARREDURA) {
    for (const [tipo, candidatos] of Object.entries(TIPOS_MT5)) {
      it(
        `${tipo} no nível ${nivel}: passa em todos os limites em todas as sementes`,
        () => {
          const piores = pioresPorCriterio(candidatos, nivel)
          expect(piores.flatMap((p) => p.criterios)).toHaveLength(Object.keys(CRITERIOS_DO_PIOR).length)
          const reprovadas = reprovadasNasSementes(piores, nivel)
          expect({ total: reprovadas.length, primeiras: reprovadas.slice(0, 10) }).toEqual({ total: 0, primeiras: [] })
        },
        400_000,
      )
    }
  }
})
