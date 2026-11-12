/**
 * BLOCO DE INSCRIÇÕES VERMELHO (lote 16): o cubo de pedra cor de vinho, puxada
 * para o carmim fechado, polida, com as faces cobertas de glifos entalhados mais
 * escuros que a pedra. O desenho é o de `blocoDeInscricoes.ts`; aqui ficam só as
 * cores e o texto.
 */
import type { MontarMovel } from './contexto'
import { montarBlocoDeInscricoes, type CoresDoBloco } from './blocoDeInscricoes'

const CORES: CoresDoBloco = {
  pedra: [142, 60, 72],
  sulco: [92, 42, 50],
  mancha: [104, 70, 70],
  quebra: [172, 118, 118],
  piso: [88, 58, 62],
  brilho: 0.08,
  reflexo: 0.03,
  grao: 0.05,
  texto: 2,
}

export const montarBlocoDeInscricoesVermelho: MontarMovel = (c, cena) => montarBlocoDeInscricoes(c, cena, CORES)
