/**
 * CARACOL-TELEFONE DOURADO (lote L07, 14/11/2026): o caracol-telefone de casca de ouro, com brilho, e o fone
 * vermelho-escuro de aros dourados. O desenho é o de `caracolTelefone.ts`.
 */
import type { MontarMovel } from './contexto'
import { montarCaracol } from './caracolTelefone'

export const montarCaracolTelefoneDourado: MontarMovel = (c, cena) => montarCaracol(c, cena, 'dourado')
