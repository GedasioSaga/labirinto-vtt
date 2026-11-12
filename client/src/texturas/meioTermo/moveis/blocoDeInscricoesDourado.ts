/**
 * BLOCO DE INSCRIÇÕES DOURADO (lote 16): o cubo de ouro velho e fosco, com
 * brilhos quentes discretos nas arestas e as faces cobertas de glifos
 * entalhados num ouro mais escuro. O desenho é o de `blocoDeInscricoes.ts`;
 * aqui ficam só as cores e o texto. O brilho do chanfro e os reflexos largos
 * nas faces são o que separa o ouro do arenito.
 */
import type { MontarMovel } from './contexto'
import { montarBlocoDeInscricoes, type CoresDoBloco } from './blocoDeInscricoes'

const CORES: CoresDoBloco = {
  pedra: [184, 150, 78],
  sulco: [106, 82, 46],
  mancha: [120, 102, 66],
  quebra: [220, 192, 124],
  piso: [80, 64, 40],
  brilho: 0.4,
  reflexo: 0.17,
  grao: 0.02,
  texto: 3,
}

export const montarBlocoDeInscricoesDourado: MontarMovel = (c, cena) => montarBlocoDeInscricoes(c, cena, CORES)
