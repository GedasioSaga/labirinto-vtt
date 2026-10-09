import type { CriarCena } from '../../transicoes/tipos'
import { criarEscadaDeMadeira } from './_escadaMadeira'

/**
 * "Escada de madeira subindo": primeira pessoa subindo um lance estreito de
 * madeira entre paredes de lambri, no clima do Resident Evil. A cena é a
 * mesma da descida, com o sentido trocado (`_escadaMadeira.ts`).
 */
const criar: CriarCena = criarEscadaDeMadeira(1)

export default criar
