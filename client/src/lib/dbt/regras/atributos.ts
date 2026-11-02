/**
 * DRAGON BALL TALES — atributos: o modificador e a leitura do valor. Puro.
 * Base das outras regras (ficha, NPC, comparar).
 */
import { ATRIBUTO_INICIAL, type IdAtributoDBT } from '../modelo'

/**
 * Os atributos como o Personagem guarda (`Personagem.atributos`, chave = id
 * do atributo). Chave ausente ou número torto = valor de ficha nova.
 */
export type AtributosDBT = Readonly<Record<string, number>>

/** Siglas da tela, na ordem do livro. */
export const SIGLA_DO_ATRIBUTO: Readonly<Record<IdAtributoDBT, string>> = {
  for: 'FOR',
  des: 'DES',
  con: 'CON',
  int: 'INT',
  sab: 'SAB',
  pod: 'POD',
  pre: 'PRE',
}

/**
 * floor((valor − 10) / 2): 8 → −1, 10 → 0, 12 → +1, 14 → +2. O texto da p. 6
 * diz "+1 a cada número acima", mas os exemplos da mesma página seguem esta
 * conta; vale o exemplo (plano, regra dos erros do livro).
 */
export function modificador(valor: number): number {
  return Math.floor((valor - 10) / 2)
}

/** O valor do atributo; ausente ou não finito = 8, o de uma ficha nova (3.0.2, p. 12). */
export function valorDoAtributo(atributos: AtributosDBT, id: IdAtributoDBT): number {
  const valor = atributos[id]
  return Number.isFinite(valor) ? valor : ATRIBUTO_INICIAL
}

export function modificadorDoAtributo(atributos: AtributosDBT, id: IdAtributoDBT): number {
  return modificador(valorDoAtributo(atributos, id))
}

/** "+2", "-1", "+0": como o livro escreve o modificador. */
export function comSinal(n: number): string {
  return n < 0 ? String(n) : `+${n}`
}

/** 10000 → "10.000" (sem depender do idioma da máquina). */
export function milhar(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
