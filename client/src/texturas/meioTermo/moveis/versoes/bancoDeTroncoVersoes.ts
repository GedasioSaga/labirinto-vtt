/**
 * As versões do BANCO DE TRONCO (L07 do plano de arte por tema, 28/11/2026). A 1ª, TRONCO, é o desenho do próprio
 * tipo (`montarBancoDeTronco`); aqui fica a TÁBUA SOBRE TOCOS, do mesmo arquivo do tipo para a casca e o corte serem
 * os mesmos.
 */
import type { VersoesDesenhadas } from '.'
import { montarBancoDeTroncoTabuaSobreTocos } from '../bancoDeTronco'

export const versoesDoBancoDeTronco: VersoesDesenhadas = {
  tabuaSobreTocos: montarBancoDeTroncoTabuaSobreTocos,
}
