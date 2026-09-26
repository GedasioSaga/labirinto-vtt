import type { Token, TokenContract } from '../types/map'

/**
 * AJUDANTE CONTRATADO — regras puras do acordo: tetos, leitura do que o
 * mestre digitou, o rótulo que o jogador lê e a limpeza do campo de fio.
 * Quem guarda o acordo é a sessão do host (`net/hostSession.ts`).
 */

/** Teto da tarefa: é uma linha no painel do jogador, não um recado. */
export const LOAN_TASK_MAX_LENGTH = 80

/** Prazo mais longo que o mestre pode dar: um dia de relógio. */
export const LOAN_MINUTES_MAX = 24 * 60

const MINUTE_MS = 60_000

/** O que o mestre escolhe ao emprestar. `minutos: null` = "Até eu tirar". */
export interface LoanTerms {
  tarefa: string
  minutos: number | null
  visao: boolean
}

/**
 * O acordo a guardar, ou `null` quando o prazo não vale (zero, negativo, não
 * finito). A tarefa sai aparada e cortada no teto; o prazo, no teto de um dia.
 */
export function contractFromTerms(terms: LoanTerms, now: number): TokenContract | null {
  const tarefa = terms.tarefa.trim().slice(0, LOAN_TASK_MAX_LENGTH)
  if (terms.minutos === null) return { tarefa, ate: null, visao: terms.visao }
  if (!Number.isFinite(terms.minutos) || terms.minutos <= 0) return null
  const minutos = Math.min(LOAN_MINUTES_MAX, terms.minutos)
  return { tarefa, ate: now + minutos * MINUTE_MS, visao: terms.visao }
}

/** O acordo venceu em `now`? "Até eu tirar" nunca vence. */
export function isContractDue(contrato: TokenContract, now: number): boolean {
  return contrato.ate !== null && contrato.ate <= now
}

/**
 * "Ajudante · levar o recado · até 21:30" / "Ajudante · até o mestre retomar".
 * `formatHour` recebe o fim em ms e devolve a hora de quem lê.
 */
export function loanLabel(contrato: TokenContract, formatHour: (at: number) => string): string {
  const prazo = contrato.ate === null ? 'até o mestre retomar' : `até ${formatHour(contrato.ate)}`
  return contrato.tarefa === '' ? `Ajudante · ${prazo}` : `Ajudante · ${contrato.tarefa} · ${prazo}`
}

/**
 * O acordo como a tela do JOGADOR o aceita do fio: forma exata ou nada. O
 * mapa do host não passa por validação campo a campo, e texto torto aqui
 * viraria "undefined" escrito no painel.
 */
export function readContract(value: unknown): TokenContract | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const tarefa: unknown = Reflect.get(value, 'tarefa')
  const ate: unknown = Reflect.get(value, 'ate')
  const visao: unknown = Reflect.get(value, 'visao')
  if (typeof tarefa !== 'string' || typeof visao !== 'boolean') return undefined
  if (ate !== null && (typeof ate !== 'number' || !Number.isFinite(ate))) return undefined
  return { tarefa: tarefa.slice(0, LOAN_TASK_MAX_LENGTH), ate, visao }
}

/** A ficha sem o campo de fio `contrato`. Sem o campo, volta pela mesma referência. */
export function withoutContract(token: Token): Token {
  if (!('contrato' in token)) return token
  const { contrato: _descartado, ...rest } = token
  return rest
}

/** A ficha sem a marca de fio `emprestada` (NPC emprestado). Sem a marca, volta pela mesma referência. */
export function withoutLentMark(token: Token): Token {
  if (!('emprestada' in token)) return token
  const { emprestada: _descartada, ...rest } = token
  return rest
}
