import { criarCampo } from './_campoEnsolarado'

/**
 * Campo ensolarado (aprovado em 12/10/2026): estrada de terra, para, ergue o
 * olhar ao sol e o sol toma a tela. A cena inteira está em `_campoEnsolarado.ts`,
 * dividida com as variações de fundo (três casas, vila).
 */
export { estadoDoCampo, momentoDoPasso, rajadaEm, ROTEIRO_DO_CAMPO } from './_campoEnsolarado'
export type { EstadoDoCampo } from './_campoEnsolarado'
export default criarCampo('nenhum')
