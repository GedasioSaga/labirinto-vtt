import type { FichaLida, TecnicaLida } from './leitura'
import type { PosicoesDaCena } from './posicao'
import {
  TEXTO_DBT_MAX,
  type AutorDBT,
  type CombatenteDBT,
  type EfeitoDBT,
  type IdDoCombatente,
  type LadosDoDado,
  type NucleoDBT,
  type Pendencia,
  type TipoDaLinhaDBT,
} from './tipos'

/**
 * O TRABALHO DE UM COMANDO: o motor roda cada comando sobre uma cópia local
 * do núcleo (trocado por objetos novos, nunca mexido por dentro) e dos PV/PK
 * de cada ficha (docs/planos/dbt-batalha.md, seção 16: "Ki chegou a 0" e "PV
 * chegou a 0" são vistos no mesmo comando). No fim, `motor.ts` monta o
 * resultado: núcleo novo, valores finais das fichas, a linha e os efeitos.
 */

export interface ContextoDBT {
  /** Por personagem; null = combatente manual (ficha sem `dbt`). */
  fichas: ReadonlyMap<string, FichaLida | null>
  posicoes: PosicoesDaCena | null
  rolar: (lados: LadosDoDado) => number
  gerarId: () => string
  agora: number
}

export interface Trabalho {
  nucleo: NucleoDBT
  readonly ctx: ContextoDBT
  readonly autor: AutorDBT
  /** PV/PK de agora por personagem (lidos na primeira vez que o comando toca). */
  readonly recursos: Map<string, { pv: number; pk: number }>
  readonly tocadas: Set<string>
  readonly efeitos: Omit<EfeitoDBT, 'seq'>[]
  readonly textos: string[]
  readonly publicos: string[]
  readonly tokenIds: Set<string>
  readonly personagemIds: Set<string>
  comD20: boolean
  tipo: TipoDaLinhaDBT | null
  /** Freio contra laço (vez que passa sozinha sem fim). */
  passos: number
}

export const PASSOS_MAX = 200

export function novoTrabalho(nucleo: NucleoDBT, ctx: ContextoDBT, autor: AutorDBT): Trabalho {
  return {
    nucleo,
    ctx,
    autor,
    recursos: new Map(),
    tocadas: new Set(),
    efeitos: [],
    textos: [],
    publicos: [],
    tokenIds: new Set(),
    personagemIds: new Set(),
    comD20: false,
    tipo: null,
    passos: 0,
  }
}

export function ehMestre(autor: AutorDBT): boolean {
  return autor.tipo === 'mestre'
}

export function combatente(t: Trabalho, id: IdDoCombatente): CombatenteDBT | undefined {
  return Object.hasOwn(t.nucleo.combatentes, id) ? t.nucleo.combatentes[id] : undefined
}

/** Troca o combatente pelo que `mudar` devolve (o núcleo vira objeto novo). */
export function mudarCombatente(t: Trabalho, id: IdDoCombatente, mudar: (c: CombatenteDBT) => CombatenteDBT): void {
  const atual = combatente(t, id)
  if (atual === undefined) return
  const novo = mudar(atual)
  if (novo === atual) return
  t.nucleo = { ...t.nucleo, combatentes: { ...t.nucleo.combatentes, [id]: novo } }
}

export function fichaDe(t: Trabalho, c: CombatenteDBT | undefined): FichaLida | null {
  if (c === undefined || c.personagemId === null) return null
  return t.ctx.fichas.get(c.personagemId) ?? null
}

export function tecnicaDe(t: Trabalho, id: IdDoCombatente, tecnicaId: string): TecnicaLida | undefined {
  return fichaDe(t, combatente(t, id))?.tecnicas.find((tecnica) => tecnica.id === tecnicaId)
}

const ORDEM_DOS_RANKS = ['E', 'D', 'C', 'B', 'A', 'Z']

/** Posição do rank (E = 0 ... Z = 5). */
export function indiceDoRank(rank: string): number {
  return ORDEM_DOS_RANKS.indexOf(rank)
}

function recursosDe(t: Trabalho, f: FichaLida): { pv: number; pk: number } {
  const lidos = t.recursos.get(f.personagemId)
  if (lidos !== undefined) return lidos
  const novos = { pv: f.pv.atual, pk: f.pk.atual }
  t.recursos.set(f.personagemId, novos)
  return novos
}

export function pvDe(t: Trabalho, f: FichaLida): number {
  return recursosDe(t, f).pv
}

export function pkDe(t: Trabalho, f: FichaLida): number {
  return recursosDe(t, f).pk
}

/** Grava PV/PK entre 0 e o máximo (o excedente do dano vai só ao texto). */
export function porRecurso(t: Trabalho, f: FichaLida, recurso: 'pv' | 'pk', valor: number): void {
  const atuais = recursosDe(t, f)
  const max = recurso === 'pv' ? f.pv.max : f.pk.max
  atuais[recurso] = Math.min(max, Math.max(0, Math.trunc(valor)))
  t.tocadas.add(f.personagemId)
  t.personagemIds.add(f.personagemId)
}

export function nomeDe(t: Trabalho, id: IdDoCombatente): string {
  return combatente(t, id)?.nome ?? '?'
}

function cortado(texto: string): string {
  return texto.length <= TEXTO_DBT_MAX ? texto : `${texto.slice(0, TEXTO_DBT_MAX - 1)}…`
}

/** Um pedaço da linha: o do mestre e o do jogador (sem números secretos). */
export function escrever(t: Trabalho, texto: string, publico: string = texto): void {
  t.textos.push(cortado(texto))
  t.publicos.push(cortado(publico))
}

export function envolver(t: Trabalho, ...ids: IdDoCombatente[]): void {
  for (const id of ids) {
    t.tokenIds.add(id)
    const personagemId = combatente(t, id)?.personagemId
    if (personagemId !== null && personagemId !== undefined) t.personagemIds.add(personagemId)
  }
}

export function tipoDaLinha(t: Trabalho, tipo: TipoDaLinhaDBT): void {
  if (t.tipo === null) t.tipo = tipo
}

export function efeito(t: Trabalho, novo: Omit<EfeitoDBT, 'seq'>): void {
  t.efeitos.push(novo)
}

export function rolarD20(t: Trabalho): number {
  t.comD20 = true
  return t.ctx.rolar(20)
}

/** Pendência nova: aninhada entra na frente (vira a ativa); irmã vai ao fim (seção 1.6). */
export function porPendencia(t: Trabalho, pendencia: Pendencia, naFrente: boolean): void {
  const resto = t.nucleo.pendencias
  t.nucleo = { ...t.nucleo, pendencias: naFrente ? [pendencia, ...resto] : [...resto, pendencia] }
}

export function tirarPendencia(t: Trabalho, id: string): void {
  t.nucleo = { ...t.nucleo, pendencias: t.nucleo.pendencias.filter((pendencia) => pendencia.id !== id) }
}

export function trocarPendencia(t: Trabalho, nova: Pendencia): void {
  t.nucleo = { ...t.nucleo, pendencias: t.nucleo.pendencias.map((pendencia) => (pendencia.id === nova.id ? nova : pendencia)) }
}

/** Os combatentes do lado oposto que ainda contam (não mortos). */
export function inimigosDe(t: Trabalho, id: IdDoCombatente): IdDoCombatente[] {
  const eu = combatente(t, id)
  if (eu === undefined) return []
  return Object.values(t.nucleo.combatentes)
    .filter((outro) => outro.lado !== eu.lado && outro.morte.situacao !== 'morto')
    .map((outro) => outro.id)
}

export function aliadosDe(t: Trabalho, id: IdDoCombatente): IdDoCombatente[] {
  const eu = combatente(t, id)
  if (eu === undefined) return []
  return Object.values(t.nucleo.combatentes)
    .filter((outro) => outro.id !== id && outro.lado === eu.lado && outro.morte.situacao !== 'morto')
    .map((outro) => outro.id)
}

/** Fora de combate: inconsciente ou morto (salvaguarda ainda recebe a vez para rolar). */
export function foraDeCombate(c: CombatenteDBT): boolean {
  return c.morte.situacao === 'inconsciente' || c.morte.situacao === 'morto'
}

export function dePe(c: CombatenteDBT): boolean {
  return c.morte.situacao === 'de-pe'
}
