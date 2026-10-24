/**
 * Candidatos e critérios das PEÇAS NOVAS do lote 2 (MT5): sebe, jardineira,
 * arco do portão, placa de seta e tapete longo, como o app as pede (o objeto
 * no tamanho padrão na grade de 50 px, os tons OFICIAIS do material nos campos
 * de cor e a semente que `chaveDoMovel` dá). Dividido entre o teste por
 * candidato (`moveisMt5.test.ts`) e a varredura das 1000 sementes
 * (`pixi/rasterDosMoveis.sementesMt5.test.ts`).
 *
 * Só para teste: nenhum código do app importa isto.
 */
import type { Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { MATERIAIS, type IdDoMaterial } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from './index'
import { ALFA_DE_PECA, ALFA_OPACO, medirImagem, type MedidasDaImagem } from './medidas.testkit'

export const COBERTURA_MINIMA = 0.25
export const SATURACAO_P95_MAXIMA = 0.62
export const BRILHO_MEDIO_MINIMO = 0.17
export const CONTORNO_MINIMO = 0.06
export const LUMINANCIA_LINEAR_MINIMA = 0.03
export const OPACIDADE_DOS_OPACOS_MINIMA = 0.98
export const OPACIDADE_DO_MIOLO_MINIMA = 0.96
/**
 * Fração máxima do miolo das peças abaixo do alfa opaco (o mesmo teto da MT4):
 * a média do miolo não morde uma peça inteira com alfa x 0,9 em cima da
 * sombra; a contagem morde (prova por mutação no relatório da MT5).
 */
export const MIOLO_TRANSLUCIDO_MAXIMO = 0.05
export const CASA = 50

export interface Candidato {
  readonly nome: string
  readonly prop: Prop
}

function hex(id: IdDoMaterial): string {
  return MATERIAIS[id].hex
}

export function peca(mobilia: NonNullable<Prop['mobilia']>, casasW: number, casasH: number, cor: IdDoMaterial, linha: IdDoMaterial | null, extra: Partial<Prop> = {}): Prop {
  const base: Prop = { id: 'm', src: '', x: 0, y: 0, width: casasW * CASA, height: casasH * CASA, linkedMapPath: null, mobilia, mobiliaCor: hex(cor), ...extra }
  return linha === null ? base : { ...base, mobiliaCorDaLinha: hex(linha) }
}

/** Em cada tipo: o mais escuro, o mais cinza e o mais claro ou vivo que o lugar aceita; a sebe também curva. */
export const TIPOS_MT5: Readonly<Record<string, readonly Candidato[]>> = {
  sebe: [
    { nome: 'sebe de buxo', prop: peca('sebe', 2, 0.5, 'buxo', null) },
    { nome: 'sebe de alfeneiro', prop: peca('sebe', 2, 0.5, 'alfeneiro', null) },
    { nome: 'sebe de buxo curva 90°', prop: peca('sebe', 4, 0.5, 'buxo', null, { mobiliaCurva: 90 }) },
    { nome: 'sebe de alfeneiro curva -150°', prop: peca('sebe', 3, 0.5, 'alfeneiro', null, { mobiliaCurva: -150 }) },
  ],
  jardineira: [
    { nome: 'jardineira nogueira', prop: peca('jardineira', 1, 0.5, 'nogueira', null) },
    { nome: 'jardineira velha', prop: peca('jardineira', 1, 0.5, 'velha', null) },
    { nome: 'jardineira pinho', prop: peca('jardineira', 1, 0.5, 'pinho', null) },
  ],
  arcoDoPortao: [
    { nome: 'arco nogueira+pinho', prop: peca('arcoDoPortao', 2, 0.5, 'nogueira', 'pinho') },
    { nome: 'arco velha+velha', prop: peca('arcoDoPortao', 2, 0.5, 'velha', 'velha') },
    { nome: 'arco cerejeira+carvalho', prop: peca('arcoDoPortao', 2, 0.5, 'cerejeira', 'carvalho') },
  ],
  placaDeSeta: [
    { nome: 'placa nogueira', prop: peca('placaDeSeta', 0.5, 0.5, 'nogueira', null) },
    { nome: 'placa velha', prop: peca('placaDeSeta', 0.5, 0.5, 'velha', null) },
    { nome: 'placa pinho', prop: peca('placaDeSeta', 0.5, 0.5, 'pinho', null) },
  ],
  tapeteLongo: [
    { nome: 'tapete longo vinho', prop: peca('tapeteLongo', 1, 4, 'vinho', null) },
    { nome: 'tapete longo azul', prop: peca('tapeteLongo', 1, 4, 'azul', null) },
    { nome: 'tapete longo linho', prop: peca('tapeteLongo', 1, 4, 'linho', null) },
    { nome: 'tapete longo ocre deitado', prop: peca('tapeteLongo', 4, 1, 'ocre', null) },
  ],
}

export function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error(`${prop.mobilia} sem desenho com textura`)
  return chave.desenho
}

/** Fração dos pixels de miolo (peça com os 4 vizinhos também de peça) com alfa abaixo do opaco. */
export function mioloTranslucido(px: Uint8ClampedArray, W: number, H: number): number {
  const dePeca = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && px[(y * W + x) * 4 + 3] >= ALFA_DE_PECA
  let miolo = 0
  let translucidos = 0
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!dePeca(x, y) || !dePeca(x - 1, y) || !dePeca(x + 1, y) || !dePeca(x, y - 1) || !dePeca(x, y + 1)) continue
      miolo += 1
      if (px[(y * W + x) * 4 + 3] < ALFA_OPACO) translucidos += 1
    }
  }
  return miolo > 0 ? translucidos / miolo : 0
}

export interface MedidasMt5 extends MedidasDaImagem {
  readonly translucido: number
}

export function medir(d: DesenhoDoMovel, nivel: number): MedidasMt5 {
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(d, S)
  return { ...medirImagem(pixels, limites.W, limites.H, d.casasW * G * S * (d.casasH * G * S)), translucido: mioloTranslucido(pixels, limites.W, limites.H) }
}

export function reprovacoes(m: MedidasMt5): string[] {
  const falhas: string[] = []
  if (m.cobertura < COBERTURA_MINIMA) falhas.push(`cobertura ${m.cobertura.toFixed(3)}`)
  if (m.saturacaoP95 > SATURACAO_P95_MAXIMA) falhas.push(`saturação p95 ${m.saturacaoP95.toFixed(3)}`)
  if (m.brilhoMedio < BRILHO_MEDIO_MINIMO) falhas.push(`brilho médio ${m.brilhoMedio.toFixed(3)}`)
  if (m.contornoMinimo < CONTORNO_MINIMO || m.brilhoMinimo < CONTORNO_MINIMO) falhas.push(`contorno ${m.contornoMinimo.toFixed(3)}`)
  if (m.luminanciaLinearMinima < LUMINANCIA_LINEAR_MINIMA) falhas.push(`luz linear ${m.luminanciaLinearMinima.toFixed(4)}`)
  if (m.opacidadeDosOpacos < OPACIDADE_DOS_OPACOS_MINIMA) falhas.push(`opacidade ${m.opacidadeDosOpacos.toFixed(3)}`)
  if (m.opacidadeDoMiolo < OPACIDADE_DO_MIOLO_MINIMA) falhas.push(`miolo ${m.opacidadeDoMiolo.toFixed(3)}`)
  if (m.translucido > MIOLO_TRANSLUCIDO_MAXIMO) falhas.push(`miolo translúcido ${m.translucido.toFixed(3)}`)
  return falhas
}
