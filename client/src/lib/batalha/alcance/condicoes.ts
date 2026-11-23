/**
 * ALCANCE: AS CONDIÇÕES QUE O MUDAM (plano docs/design/habilidades/ALCANCE.md §4; protótipo
 * aprovado tmp/proto-alcance/fonte.html, `alcanceComCondicoes`). Um selo pode somar (+N ou -N)
 * ou pôr um teto ("no máximo X") no alcance, valendo para tudo, só armas, só habilidades ou só
 * itens. Ordem: as somas, depois o menor teto, nunca abaixo de 1.
 *
 * Muda só o comprimento: o lado do quadrado à frente, a explosão da área longe e o "só em quem
 * usa" ficam. No anel muda só o máximo; abaixo do mínimo, o anel fica de mínimo a mínimo.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import type { FormaDoAlcance } from './forma'

/** Para quem a mudança vale. */
export type EscopoDoAlcance = 'tudo' | 'armas' | 'habilidades' | 'itens'

/** De onde vem o que quem usa escolheu (Atacar com a arma, uma técnica, um item). */
export type GrupoDoAlcance = Exclude<EscopoDoAlcance, 'tudo'>

/** O que o selo faz no alcance: `soma` (n positivo ou negativo) ou `teto` (no máximo n). */
export interface MudancaDoAlcance {
  mexe: 'soma' | 'teto'
  n: number
  vale: EscopoDoAlcance
}

/** Um selo ativo em quem usa; sem `alcance`, não mexe no alcance (fica de fora). */
export interface SeloQueMudaOAlcance {
  nome: string
  alcance?: MudancaDoAlcance
}

export interface AlcanceComCondicoes {
  /** A forma que vale agora. */
  forma: FormaDoAlcance
  /**
   * O aviso da mira: "Alcance 6 → 4 (Ofuscado)"; "Alcance 4, sem mudança (Mira Firme +2,
   * Ofuscado −2)" quando vale mas não muda. `null` quando nenhuma condição vale para esta forma.
   */
  aviso: string | null
  /** O número mudou. */
  muda: boolean
}

interface CondicaoQueVale {
  nome: string
  alcance: MudancaDoAlcance
}

function valeNoGrupo(mudanca: MudancaDoAlcance, grupo: GrupoDoAlcance): boolean {
  return mudanca.vale === 'tudo' || mudanca.vale === grupo
}

function quanto(mudanca: MudancaDoAlcance): string {
  if (mudanca.mexe === 'teto') return `máx ${mudanca.n}`
  return `${mudanca.n > 0 ? '+' : '−'}${Math.abs(mudanca.n)}`
}

/** Por que mudou: o nome da condição sozinha; várias, cada uma com o quanto. */
function porQue(valem: readonly CondicaoQueVale[]): string {
  const unica = valem.length === 1 ? valem[0] : undefined
  if (unica !== undefined) return unica.nome
  return valem.map((c) => (c.alcance.mexe === 'teto' ? `${c.nome}: ${quanto(c.alcance)}` : `${c.nome} ${quanto(c.alcance)}`)).join(', ')
}

/** O número que a forma mostra no aviso: o anel mostra "de a ate". */
function numeroDoAviso(forma: FormaDoAlcance, ate: number): string {
  return forma.tipo === 'alvo' && forma.de !== undefined ? `${forma.de} a ${ate}` : `${ate}`
}

/** A forma com outro comprimento; o resto (de, explosão) fica. */
function comOutroAte(forma: FormaDoAlcance, ate: number): FormaDoAlcance {
  switch (forma.tipo) {
    case 'frente':
    case 'si':
      return forma
    default:
      return { ...forma, ate }
  }
}

/**
 * O alcance que vale agora: a forma com os selos ativos de quem usa que valem para `grupo`, na
 * ordem em que chegam (é a ordem dos nomes no aviso).
 */
export function alcanceComCondicoes(forma: FormaDoAlcance, grupo: GrupoDoAlcance, selosAtivos: readonly SeloQueMudaOAlcance[]): AlcanceComCondicoes {
  const valem: CondicaoQueVale[] = []
  for (const selo of selosAtivos) {
    if (selo.alcance !== undefined && valeNoGrupo(selo.alcance, grupo)) valem.push({ nome: selo.nome, alcance: selo.alcance })
  }
  if (valem.length === 0 || forma.tipo === 'frente' || forma.tipo === 'si') return { forma, aviso: null, muda: false }
  let ate = forma.ate
  for (const c of valem) if (c.alcance.mexe === 'soma') ate += c.alcance.n
  for (const c of valem) if (c.alcance.mexe === 'teto') ate = Math.min(ate, c.alcance.n)
  ate = Math.max(1, ate)
  const minimoDoAnel = forma.tipo === 'alvo' ? forma.de : undefined
  const encolheu = minimoDoAnel !== undefined && ate < minimoDoAnel
  if (encolheu) ate = minimoDoAnel
  const muda = ate !== forma.ate
  const motivo = porQue(valem)
  let aviso = muda
    ? `Alcance ${numeroDoAviso(forma, forma.ate)} → ${numeroDoAviso(forma, ate)} (${motivo})`
    : `Alcance ${numeroDoAviso(forma, forma.ate)}, sem mudança (${motivo})`
  if (encolheu) aviso += `; o anel não fica menor que ${minimoDoAnel}`
  return { forma: comOutroAte(forma, ate), aviso, muda }
}
