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
 * escuras e mais cinzentas (e as vistas de lado e as 3 lápides), nos níveis 1,
 * 2 e 3, pelos critérios de pixel da MT2; e a varredura das 1000 sementes no
 * PIOR candidato do tipo no nível 3 (o de menor contorno, achado aqui mesmo).
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
  ],
  mesaRedonda: [
    { nome: 'mesa redonda nogueira', prop: peca('mesaRedonda', 1.25, 1.25, 'nogueira', null) },
    { nome: 'mesa redonda velha', prop: peca('mesaRedonda', 1.25, 1.25, 'velha', null) },
  ],
  lapide: [
    { nome: 'lápide arco ardósia', prop: peca('lapide', 0.6, 0.35, 'ardosia', null, { id: idDaLapide(0) }) },
    { nome: 'lápide reta ardósia', prop: peca('lapide', 0.6, 0.35, 'ardosia', null, { id: idDaLapide(1) }) },
    { nome: 'lápide cruz ardósia', prop: peca('lapide', 0.6, 0.35, 'ardosia', null, { id: idDaLapide(2) }) },
    { nome: 'lápide cruz granito', prop: peca('lapide', 0.6, 0.35, 'granito', null, { id: idDaLapide(2) }) },
  ],
  vaso: [
    { nome: 'vaso de barro', prop: peca('vaso', 0.5, 0.5, 'barro', null) },
    { nome: 'vaso de granito', prop: peca('vaso', 0.5, 0.5, 'granito', null) },
  ],
  lampiao: [
    { nome: 'lampião de ferro', prop: peca('lampiao', 0.5, 0.5, 'ferro', null) },
    { nome: 'lampião de latão', prop: peca('lampiao', 0.5, 0.5, 'latao', null) },
  ],
  quadroDeAvisos: [
    { nome: 'quadro nogueira', prop: peca('quadroDeAvisos', 1, 0.4, 'nogueira', null) },
    { nome: 'quadro velha', prop: peca('quadroDeAvisos', 1, 0.4, 'velha', null) },
  ],
  poco: [
    { nome: 'poço ardósia+nogueira', prop: peca('poco', 1.5, 1.5, 'ardosia', 'nogueira') },
    { nome: 'poço granito+velha', prop: peca('poco', 1.5, 1.5, 'granito', 'velha') },
  ],
  barraca: [
    { nome: 'barraca vinho+nogueira', prop: peca('barraca', 2, 2, 'vinho', 'nogueira') },
    { nome: 'barraca azul+velha', prop: peca('barraca', 2, 2, 'azul', 'velha') },
    { nome: 'barraca de lado vinho+nogueira', prop: peca('barraca', 2, 2, 'vinho', 'nogueira', LADO) },
    { nome: 'barraca de lado musgo+velha', prop: peca('barraca', 2, 2, 'musgo', 'velha', LADO) },
  ],
  carroca: [
    { nome: 'carroça nogueira+ferro', prop: peca('carroca', 2, 1.25, 'nogueira', 'ferro') },
    { nome: 'carroça velha+latão', prop: peca('carroca', 2, 1.25, 'velha', 'latao') },
    { nome: 'carroça de lado nogueira+ferro', prop: peca('carroca', 2, 1.25, 'nogueira', 'ferro', LADO) },
    { nome: 'carroça de lado velha+latão', prop: peca('carroca', 2, 1.25, 'velha', 'latao', LADO) },
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

describe('as 1000 sementes no pior caso de cada peça nova, no nível 3', () => {
  for (const [tipo, candidatos] of Object.entries(TIPOS)) {
    it(
      `${tipo}: o candidato de menor contorno, em todas as sementes, passa em todos os critérios`,
      () => {
        const medidos = candidatos.map((c) => ({ c, m: medir(desenhoDoApp(c.prop, 3), 3) }))
        const pior = medidos.reduce((a, b) => (Math.min(b.m.contornoMinimo, b.m.brilhoMinimo) < Math.min(a.m.contornoMinimo, a.m.brilhoMinimo) ? b : a))
        const base = desenhoDoApp(pior.c.prop, 3)
        const reprovadas: string[] = []
        for (let semente = 0; semente < SEMENTES; semente += 1) {
          const falhas = reprovacoes(medir({ ...base, semente }, 3))
          if (falhas.length > 0) reprovadas.push(`${pior.c.nome}, semente ${semente}: ${falhas.join(', ')}`)
        }
        expect(reprovadas.slice(0, 10)).toEqual([])
      },
      400_000,
    )
  }
})
