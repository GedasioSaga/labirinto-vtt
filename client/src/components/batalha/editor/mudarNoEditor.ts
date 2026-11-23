import type { MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'

/**
 * Como uma linha muda a mecânica no editor novo: a mecânica inteira de novo e,
 * se a troca tirou alguma peça, o aviso que sobe com o Desfazer.
 */
export type MudarNoEditor = (mecanica: MecanicaV1, aviso?: string) => void
