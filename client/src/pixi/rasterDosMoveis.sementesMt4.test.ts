import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { G } from '../texturas/meioTermo/moveis/contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from '../texturas/meioTermo/moveis'
import { medirImagem, type MedidasDaImagem } from '../texturas/meioTermo/moveis/medidas.testkit'
import { MATERIAIS, type IdDoMaterial } from '../texturas/meioTermo/materiais'
import { varianteDaLapide } from '../lib/mobilia/pecasNovas'
import { chaveDoMovel, SEMENTES } from './rasterDosMoveis'

/**
 * As 9 PEÇAS NOVAS da MT4 com a SEMENTE QUE O APP DÁ (`chaveDoMovel`, o hash
 * do desenho, 0 a 999), como o app as pede: o objeto no tamanho padrão de
 * `lib/mobilia/pecasNovas.ts` (grade de 50 px) com os tons OFICIAIS nos
 * campos de cor (o que o painel grava). Em cada tipo, as combinações mais
 * escuras e mais cinzentas, as mais claras e vivas (linho, ocre, cerejeira,
 * arenito, onde o lugar aceita), as vistas de lado e as 3 lápides, nos níveis
 * 1, 2 e 3, pelos critérios de pixel da MT2; e a varredura das 1000 sementes
 * no PIOR candidato do tipo EM CADA CRITÉRIO (menor contorno, maior saturação
 * p95, menor brilho médio, menor opacidade do miolo, achados aqui mesmo com a
 * semente do app), cada um conferido em todos os limites.
 */

const COBERTURA_MINIMA = 0.25
const SATURACAO_P95_MAXIMA = 0.62
const BRILHO_MEDIO_MINIMO = 0.17
const CONTORNO_MINIMO = 0.06
const LUMINANCIA_LINEAR_MINIMA = 0.03
const OPACIDADE_DOS_OPACOS_MINIMA = 0.98
const OPACIDADE_DO_MIOLO_MINIMA = 0.96
const CASA = 50

function hex(id: IdDoMaterial): string {
  return MATERIAIS[id].hex
}

function peca(mobilia: NonNullable<Prop['mobilia']>, casasW: number, casasH: number, cor: IdDoMaterial, linha: IdDoMaterial | null, extra: Partial<Prop> = {}): Prop {
  const base: Prop = { id: 'm', src: '', x: 0, y: 0, width: casasW * CASA, height: casasH * CASA, linkedMapPath: null, mobilia, mobiliaCor: hex(cor), ...extra }
  return linha === null ? base : { ...base, mobiliaCorDaLinha: hex(linha) }
}

function idDaLapide(variante: number): string {
  for (let i = 0; i < 100; i += 1) if (varianteDaLapide(`lapide-${i}`) === variante) return `lapide-${i}`
  throw new Error(`nenhum id dá a lápide ${variante}`)
}

interface Candidato {
  readonly nome: string
  readonly prop: Prop
}

const LADO = { mobiliaVista: 'lado' } as const

const TIPOS: Readonly<Record<string, readonly Candidato[]>> = {
  mesaQuadrada: [
    { nome: 'mesa quadrada nogueira', prop: peca('mesaQuadrada', 1, 1, 'nogueira', null) },
    { nome: 'mesa quadrada velha', prop: peca('mesaQuadrada', 1, 1, 'velha', null) },
    { nome: 'mesa quadrada cerejeira', prop: peca('mesaQuadrada', 1, 1, 'cerejeira', null) },
  ],
  mesaRedonda: [
    { nome: 'mesa redonda nogueira', prop: peca('mesaRedonda', 1.25, 1.25, 'nogueira', null) },
    { nome: 'mesa redonda velha', prop: peca('mesaRedonda', 1.25, 1.25, 'velha', null) },
    { nome: 'mesa redonda cerejeira', prop: peca('mesaRedonda', 1.25, 1.25, 'cerejeira', null) },
  ],
  lapide: [
    { nome: 'lápide arco ardósia', prop: peca('lapide', 0.6, 0.35, 'ardosia', null, { id: idDaLapide(0) }) },
    { nome: 'lápide reta ardósia', prop: peca('lapide', 0.6, 0.35, 'ardosia', null, { id: idDaLapide(1) }) },
    { nome: 'lápide cruz ardósia', prop: peca('lapide', 0.6, 0.35, 'ardosia', null, { id: idDaLapide(2) }) },
    { nome: 'lápide cruz granito', prop: peca('lapide', 0.6, 0.35, 'granito', null, { id: idDaLapide(2) }) },
    { nome: 'lápide arco arenito', prop: peca('lapide', 0.6, 0.35, 'arenito', null, { id: idDaLapide(0) }) },
    { nome: 'lápide reta arenito', prop: peca('lapide', 0.6, 0.35, 'arenito', null, { id: idDaLapide(1) }) },
    { nome: 'lápide cruz arenito', prop: peca('lapide', 0.6, 0.35, 'arenito', null, { id: idDaLapide(2) }) },
  ],
  vaso: [
    { nome: 'vaso de barro', prop: peca('vaso', 0.5, 0.5, 'barro', null) },
    { nome: 'vaso de granito', prop: peca('vaso', 0.5, 0.5, 'granito', null) },
    { nome: 'vaso de arenito', prop: peca('vaso', 0.5, 0.5, 'arenito', null) },
  ],
  lampiao: [
    // O lugar do lampião só aceita ferro e latão: nenhum dos materiais claros cabe aqui.
    { nome: 'lampião de ferro', prop: peca('lampiao', 0.5, 0.5, 'ferro', null) },
    { nome: 'lampião de latão', prop: peca('lampiao', 0.5, 0.5, 'latao', null) },
  ],
  quadroDeAvisos: [
    { nome: 'quadro nogueira', prop: peca('quadroDeAvisos', 1, 0.4, 'nogueira', null) },
    { nome: 'quadro velha', prop: peca('quadroDeAvisos', 1, 0.4, 'velha', null) },
    { nome: 'quadro cerejeira', prop: peca('quadroDeAvisos', 1, 0.4, 'cerejeira', null) },
  ],
  poco: [
    { nome: 'poço ardósia+nogueira', prop: peca('poco', 1.5, 1.5, 'ardosia', 'nogueira') },
    { nome: 'poço granito+velha', prop: peca('poco', 1.5, 1.5, 'granito', 'velha') },
    { nome: 'poço arenito+cerejeira', prop: peca('poco', 1.5, 1.5, 'arenito', 'cerejeira') },
  ],
  barraca: [
    { nome: 'barraca vinho+nogueira', prop: peca('barraca', 2, 2, 'vinho', 'nogueira') },
    { nome: 'barraca azul+velha', prop: peca('barraca', 2, 2, 'azul', 'velha') },
    { nome: 'barraca linho+cerejeira', prop: peca('barraca', 2, 2, 'linho', 'cerejeira') },
    { nome: 'barraca ocre+pinho', prop: peca('barraca', 2, 2, 'ocre', 'pinho') },
    { nome: 'barraca de lado vinho+nogueira', prop: peca('barraca', 2, 2, 'vinho', 'nogueira', LADO) },
    { nome: 'barraca de lado musgo+velha', prop: peca('barraca', 2, 2, 'musgo', 'velha', LADO) },
    { nome: 'barraca de lado linho+cerejeira', prop: peca('barraca', 2, 2, 'linho', 'cerejeira', LADO) },
    { nome: 'barraca de lado ocre+nogueira', prop: peca('barraca', 2, 2, 'ocre', 'nogueira', LADO) },
  ],
  carroca: [
    { nome: 'carroça nogueira+ferro', prop: peca('carroca', 2, 1.25, 'nogueira', 'ferro') },
    { nome: 'carroça velha+latão', prop: peca('carroca', 2, 1.25, 'velha', 'latao') },
    { nome: 'carroça cerejeira+latão', prop: peca('carroca', 2, 1.25, 'cerejeira', 'latao') },
    { nome: 'carroça de lado nogueira+ferro', prop: peca('carroca', 2, 1.25, 'nogueira', 'ferro', LADO) },
    { nome: 'carroça de lado velha+latão', prop: peca('carroca', 2, 1.25, 'velha', 'latao', LADO) },
    { nome: 'carroça de lado cerejeira+ferro', prop: peca('carroca', 2, 1.25, 'cerejeira', 'ferro', LADO) },
  ],
}

function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error('peça sem desenho com textura')
  return chave.desenho
}

function medir(d: DesenhoDoMovel, nivel: number): MedidasDaImagem {
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(d, S)
  return medirImagem(pixels, limites.W, limites.H, d.casasW * G * S * (d.casasH * G * S))
}

function reprovacoes(m: MedidasDaImagem): string[] {
  const falhas: string[] = []
  if (m.cobertura < COBERTURA_MINIMA) falhas.push(`cobertura ${m.cobertura.toFixed(3)}`)
  if (m.saturacaoP95 > SATURACAO_P95_MAXIMA) falhas.push(`saturação p95 ${m.saturacaoP95.toFixed(3)}`)
  if (m.brilhoMedio < BRILHO_MEDIO_MINIMO) falhas.push(`brilho médio ${m.brilhoMedio.toFixed(3)}`)
  if (m.contornoMinimo < CONTORNO_MINIMO || m.brilhoMinimo < CONTORNO_MINIMO) falhas.push(`contorno ${m.contornoMinimo.toFixed(3)}`)
  if (m.luminanciaLinearMinima < LUMINANCIA_LINEAR_MINIMA) falhas.push(`luz linear ${m.luminanciaLinearMinima.toFixed(4)}`)
  if (m.opacidadeDosOpacos < OPACIDADE_DOS_OPACOS_MINIMA) falhas.push(`opacidade ${m.opacidadeDosOpacos.toFixed(3)}`)
  if (m.opacidadeDoMiolo < OPACIDADE_DO_MIOLO_MINIMA) falhas.push(`miolo ${m.opacidadeDoMiolo.toFixed(3)}`)
  return falhas
}

describe('MT4 com a semente do app (o hash do desenho)', () => {
  for (const candidatos of Object.values(TIPOS)) {
    for (const { nome, prop } of candidatos) {
      for (const nivel of [1, 2, 3]) {
        it(`${nome} no nível ${nivel}: passa em todos os critérios de pixel`, () => {
          const d = desenhoDoApp(prop, nivel)
          expect(reprovacoes(medir(d, nivel)), `semente ${d.semente}`).toEqual([])
        })
      }
    }
  }

  it('a lápide leva a variação do id na chave: o mesmo id dá o mesmo desenho, outro desenho dá outra semente', () => {
    const a = desenhoDoApp(peca('lapide', 0.6, 0.35, 'granito', null, { id: idDaLapide(0) }), 1)
    const deNovo = desenhoDoApp(peca('lapide', 0.6, 0.35, 'granito', null, { id: idDaLapide(0) }), 3)
    const cruz = desenhoDoApp(peca('lapide', 0.6, 0.35, 'granito', null, { id: idDaLapide(2) }), 1)
    expect(a.variante).toBe(0)
    expect(deNovo.variante).toBe(0)
    expect(deNovo.semente).toBe(a.semente)
    expect(cruz.variante).toBe(2)
    expect(cruz.semente).not.toBe(a.semente)
    // Os outros tipos não ganham variação: a chave deles é a mesma de antes da MT4.
    expect(desenhoDoApp(peca('mesa', 2, 1, 'carvalho', null), 1).variante).toBeUndefined()
  })
})

/** Cada critério do pior candidato: `true` quando as medidas `b` são piores que as `a` nele. */
const CRITERIOS_DO_PIOR: Readonly<Record<string, (a: MedidasDaImagem, b: MedidasDaImagem) => boolean>> = {
  'menor contorno': (a, b) => Math.min(b.contornoMinimo, b.brilhoMinimo) < Math.min(a.contornoMinimo, a.brilhoMinimo),
  'maior saturação p95': (a, b) => b.saturacaoP95 > a.saturacaoP95,
  'menor brilho médio': (a, b) => b.brilhoMedio < a.brilhoMedio,
  'menor opacidade do miolo': (a, b) => b.opacidadeDoMiolo < a.opacidadeDoMiolo,
}

interface Pior {
  readonly candidato: Candidato
  /** Os critérios em que ele é o pior do tipo (o mesmo candidato pode ser o pior em vários). */
  readonly criterios: string[]
}

/** O pior candidato do tipo em cada critério, com a semente do app, sem repetir candidato. */
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

/** Cada pior em todas as sementes, em todos os limites: a lista do que reprovou (candidato, critério, semente e valor). */
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

/**
 * Níveis da varredura. CUSTO MEDIDO em 23/10/2026, sob o trinco, este arquivo
 * sozinho: 487 s (133 testes), contra 179 s (82 testes) da varredura de antes
 * (só o pior em contorno, só no nível 3). O nível 3 por critério custa 440 s
 * (a barraca sozinha 153 s, 2 a 3 piores distintos por tipo); o nível 1, 45 s
 * (1/9 dos pixels); os testes por candidato, ~1 s. Nenhum teste chega perto
 * do teto de 400 s. Tirar o nível 1 daqui economiza só esses 45 s.
 */
const NIVEIS_DA_VARREDURA = [3, 1] as const

describe('as 1000 sementes no pior candidato de cada critério, em cada peça nova', () => {
  for (const nivel of NIVEIS_DA_VARREDURA) {
    for (const [tipo, candidatos] of Object.entries(TIPOS)) {
      it(
        `${tipo} no nível ${nivel}: o pior em contorno, saturação, brilho e miolo passa em todos os limites, em todas as sementes`,
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
