import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { G } from '../texturas/meioTermo/moveis/contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from '../texturas/meioTermo/moveis'
import { medirImagem, type MedidasDaImagem } from '../texturas/meioTermo/moveis/medidas.testkit'
import { MATERIAIS, type IdDoMaterial } from '../texturas/meioTermo/materiais'
import { chaveDoMovel, SEMENTES } from './rasterDosMoveis'

/**
 * Os 5 móveis da MT3 com a SEMENTE QUE O APP DÁ (`chaveDoMovel`, o hash do
 * desenho, 0 a 999), como o app os pede: o objeto no tamanho padrão de
 * `lib/mobilia.ts` (grade de 50 px) com os tons OFICIAIS nos campos de cor
 * (o que o painel grava). Em cada tipo, as combinações mais escuras e mais
 * cinzentas, nos níveis 1, 2 e 3, pelos critérios de pixel da MT2; e a
 * varredura das 1000 sementes no PIOR caso do tipo no nível 3 (o de menor
 * contorno entre os candidatos, achado aqui mesmo, não escolhido a olho).
 */

const COBERTURA_MINIMA = 0.25
const SATURACAO_P95_MAXIMA = 0.62
const BRILHO_MEDIO_MINIMO = 0.17
const CONTORNO_MINIMO = 0.06
const LUMINANCIA_LINEAR_MINIMA = 0.03
const OPACIDADE_DOS_OPACOS_MINIMA = 0.98
const OPACIDADE_DO_MIOLO_MINIMA = 0.96
/** Grade de referência do app (`GRADE_DE_REFERENCIA`): o tamanho padrão em casas vezes 50 px. */
const CASA = 50

function hex(id: IdDoMaterial): string {
  return MATERIAIS[id].hex
}

function movel(mobilia: NonNullable<Prop['mobilia']>, casasW: number, casasH: number, cor: IdDoMaterial, linha: IdDoMaterial | null, extra: Partial<Prop> = {}): Prop {
  const base: Prop = { id: 'm', src: '', x: 0, y: 0, width: casasW * CASA, height: casasH * CASA, linkedMapPath: null, mobilia, mobiliaCor: hex(cor), ...extra }
  return linha === null ? base : { ...base, mobiliaCorDaLinha: hex(linha) }
}

interface Candidato {
  readonly nome: string
  readonly prop: Prop
}

/** Candidatos de cada tipo: a madeira mais escura (nogueira) e a mais cinza (velha), as pedras e as lãs mais escuras, e as vistas de lado. */
const TIPOS: Readonly<Record<string, readonly Candidato[]>> = {
  cerca: [
    { nome: 'cerca velha+arame', prop: movel('cerca', 2, 0.25, 'velha', 'arame') },
    { nome: 'cerca nogueira+corda', prop: movel('cerca', 2, 0.25, 'nogueira', 'corda') },
    { nome: 'cerca velha+varas curva 90', prop: movel('cerca', 2, 0.25, 'velha', null, { mobiliaCurva: 90 }) },
    { nome: 'cerca nogueira+arame curva 45', prop: movel('cerca', 3, 0.25, 'nogueira', 'arame', { mobiliaCurva: 45 }) },
  ],
  armario: [
    { nome: 'armário nogueira+ferro', prop: movel('armario', 1, 0.5, 'nogueira', 'ferro') },
    { nome: 'armário velha+latão', prop: movel('armario', 1, 0.5, 'velha', 'latao') },
    { nome: 'armário de lado nogueira+ferro', prop: movel('armario', 1, 1.5, 'nogueira', 'ferro', { mobiliaVista: 'lado' }) },
    { nome: 'armário de lado velha+latão', prop: movel('armario', 1, 1.5, 'velha', 'latao', { mobiliaVista: 'lado' }) },
  ],
  aparador: [
    { nome: 'aparador nogueira+ferro', prop: movel('aparador', 2, 0.5, 'nogueira', 'ferro') },
    { nome: 'aparador velha+latão', prop: movel('aparador', 2, 0.5, 'velha', 'latao') },
    { nome: 'aparador de lado nogueira+latão', prop: movel('aparador', 2, 0.9, 'nogueira', 'latao', { mobiliaVista: 'lado' }) },
    { nome: 'aparador de lado velha+ferro', prop: movel('aparador', 2, 0.9, 'velha', 'ferro', { mobiliaVista: 'lado' }) },
  ],
  fogueira: [
    { nome: 'fogueira ardósia+carvalho', prop: movel('fogueira', 1, 1, 'ardosia', 'lenhaCarvalho') },
    { nome: 'fogueira granito+bétula', prop: movel('fogueira', 1, 1, 'granito', 'lenhaBetula') },
    { nome: 'fogueira de lado ardósia+carvalho', prop: movel('fogueira', 1, 1.25, 'ardosia', 'lenhaCarvalho', { mobiliaVista: 'lado' }) },
    { nome: 'fogueira de lado arenito+pinho', prop: movel('fogueira', 1, 1.25, 'arenito', 'lenhaPinho', { mobiliaVista: 'lado' }) },
  ],
  tapete: [
    { nome: 'tapete vinho', prop: movel('tapete', 3, 2, 'vinho', null) },
    { nome: 'tapete musgo', prop: movel('tapete', 3, 2, 'musgo', null) },
    { nome: 'tapete azul redondo', prop: movel('tapete', 2, 2, 'azul', null, { mobiliaForma: 'redondo' }) },
    { nome: 'tapete de lado vinho', prop: movel('tapete', 3, 0.25, 'vinho', null, { mobiliaVista: 'lado' }) },
  ],
}

function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error('móvel sem desenho com textura')
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

describe('MT3 com a semente do app (o hash do desenho)', () => {
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

  it('a semente do app muda com o desenho (forma do tapete, curva da cerca) e não com o nível', () => {
    const reto = desenhoDoApp(movel('cerca', 2, 0.25, 'velha', 'arame'), 1)
    const curvo = desenhoDoApp(movel('cerca', 2, 0.25, 'velha', 'arame', { mobiliaCurva: 90 }), 1)
    expect(curvo.curva).toBe(90)
    expect(curvo.semente).not.toBe(reto.semente)
    expect(desenhoDoApp(movel('cerca', 2, 0.25, 'velha', 'arame', { mobiliaCurva: 90 }), 3).semente).toBe(curvo.semente)
    // A volta entra de 5 em 5 graus: 88 e 92 caem em 90 e dividem a imagem.
    expect(desenhoDoApp(movel('cerca', 2, 0.25, 'velha', 'arame', { mobiliaCurva: 88 }), 1).curva).toBe(90)
    const redondo = desenhoDoApp(movel('tapete', 2, 2, 'azul', null, { mobiliaForma: 'redondo' }), 1)
    expect(redondo.forma).toBe('redondo')
    expect(desenhoDoApp(movel('tapete', 2, 2, 'azul', null), 1).forma).toBe('retangular')
  })
})

describe('as 1000 sementes no pior caso de cada tipo da MT3, no nível 3', () => {
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
        expect(reprovadas).toEqual([])
      },
      300_000,
    )
  }
})
