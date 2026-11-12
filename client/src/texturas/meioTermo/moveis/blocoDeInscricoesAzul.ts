/**
 * BLOCO DE INSCRIÇÕES AZUL (lote 16): o cubo de pedra azul-escura, quase anil,
 * polida, com as faces cobertas de glifos entalhados mais escuros que a pedra.
 * O desenho é o de `blocoDeInscricoes.ts`; aqui ficam só as cores e o texto.
 */
import type { MontarMovel } from './contexto'
import { montarBlocoDeInscricoes, type CoresDoBloco } from './blocoDeInscricoes'

const CORES: CoresDoBloco = {
  pedra: [78, 84, 140],
  sulco: [50, 54, 94],
  mancha: [66, 70, 98],
  quebra: [122, 124, 160],
  piso: [56, 68, 86],
  brilho: 0.08,
  reflexo: 0.03,
  grao: 0.05,
  texto: 1,
}

export const montarBlocoDeInscricoesAzul: MontarMovel = (c, cena) => montarBlocoDeInscricoes(c, cena, CORES)
