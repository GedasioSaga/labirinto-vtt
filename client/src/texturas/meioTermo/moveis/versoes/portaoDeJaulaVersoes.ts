/**
 * As versões do PORTÃO DE JAULA (L01 do plano de arte por tema, 28/11/2026). A 1ª, o FECHADO, é o desenho do próprio
 * tipo (`montarPortaoDeJaula`); aqui fica o ABERTO, a folha girada nas dobradiças para dentro da pegada (desenhada no
 * arquivo do tipo, para a soleira, os postes e a grade serem os mesmos).
 */
import type { VersoesDesenhadas } from '.'
import { montarPortaoDeJaulaAberto } from '../portaoDeJaula'

export const versoesDoPortaoDeJaula: VersoesDesenhadas = {
  aberto: montarPortaoDeJaulaAberto,
}
