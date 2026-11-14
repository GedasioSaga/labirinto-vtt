/**
 * CARACOL-CÂMERA (lote L07, 14/11/2026): o caracol-telefone com a câmera nas costas no lugar do fone, a caixa
 * de couro escuro com a lente grande virada para cima. O desenho é o de `caracolTelefone.ts`.
 */
import type { MontarMovel } from './contexto'
import { montarCaracol } from './caracolTelefone'

export const montarCaracolTelefoneCamera: MontarMovel = (c, cena) => montarCaracol(c, cena, 'camera')
