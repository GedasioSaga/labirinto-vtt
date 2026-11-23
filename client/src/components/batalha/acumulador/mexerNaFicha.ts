import { createContext } from 'react'
import type { Personagem } from '../../../lib/personagem'

/**
 * A FICHA EM EDIÇÃO PELO MESTRE (ED6): quem precisa mudar outro cartão além do seu (o "+N <acumulador>"
 * do editor da técnica grava a regra no cartão que define o acumulador) lê a ficha e a troca inteira
 * por aqui. Só a `FichaAbas` do mestre em edição fornece; fora dela (o dono, o catálogo) é `null` e
 * quem lê não mostra o controle.
 */
export interface FichaQueSeMexe {
  personagem: Personagem
  mudar: (proxima: Personagem) => void
}

export const MexerNaFicha = createContext<FichaQueSeMexe | null>(null)
