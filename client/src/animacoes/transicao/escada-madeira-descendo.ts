import type { CriarCena } from '../../transicoes/tipos'
import { criarEscadaDeMadeira } from './_escadaMadeira'

/**
 * "Escada de madeira descendo": a mesma escada estreita da subida, agora
 * olhando para baixo, com os degraus sumindo no escuro (`_escadaMadeira.ts`).
 */
const criar: CriarCena = criarEscadaDeMadeira(-1)

export default criar
