import type { BolhaMotivoDoFim, BolhaResultado } from '../../../net/protocoloDaBolha'

/**
 * Os textos da Bolha d'Água na tela do jogador (português simples). Os da
 * carga do jogo (rota que o mestre não serve, demora, falha da casca) são os
 * mesmos do Fogo na Floresta: o caminho de carga é o mesmo.
 */

export {
  ERRO_DA_CARGA_DEMORADA,
  ERRO_DA_CARGA_PARADA,
  ERRO_DO_JOGO_AUSENTE,
  ERRO_DO_JOGO_QUE_NAO_LIGOU,
  oQueFazerSemOJogo,
  textoDaCargaDoFogo as textoDaCarga,
} from '../../fogo/tela/textos'

export const NOME_DO_JOGO_BOLHA = "Bolha d'Água"

/** O jogo se joga com o mouse: sem ele (toque), não dá para mirar nem segurar a força. */
export const AVISO_MOUSE_BOLHA = 'Precisa de mouse: o jogo não funciona com toque (celular ou tablet).'

export const CONTROLES_DA_BOLHA =
  'Mire com o mouse. Segure o botão esquerdo para dar força e solte quando a sombra chegar no fogo; o direito cancela. Fogo deixado em paz volta a crescer.'

export const NOME_DO_RESULTADO_BOLHA: Record<BolhaResultado, string> = {
  venceu: 'Apagou',
  perdeu: 'Não apagou',
  saiu: 'Saiu',
}

export const MOTIVO_DO_ENCERRAMENTO_BOLHA: Record<BolhaMotivoDoFim, string> = {
  fora: 'A partida começou sem você: da próxima vez, toque em Pronto antes.',
  mestre: 'O mestre encerrou a partida.',
  saiu: 'Você saiu da partida (a conexão caiu ou a página recarregou).',
}

/** Como a partida acabou, numa frase. Motivo novo que o app não conhece: `null` (a tela não diz nada). */
export function fraseDoMotivoBolha(motivo: string): string | null {
  if (motivo === 'apagou') return 'Todo o fogo foi apagado.'
  if (motivo === 'tempo') return 'O tempo acabou com fogo ainda aceso.'
  if (motivo === 'tomou') return 'O fogo cresceu mais rápido do que a água chegou.'
  return null
}

const ESTRELAS_MAX = 3

/** "★★☆": as estrelas que se veem; quem ouve a tela recebe `rotuloDasEstrelas`. */
export function desenhoDasEstrelas(estrelas: number): string {
  const cheias = Math.max(0, Math.min(ESTRELAS_MAX, estrelas))
  return '★'.repeat(cheias) + '☆'.repeat(ESTRELAS_MAX - cheias)
}

export function rotuloDasEstrelas(estrelas: number): string {
  return `${estrelas} de ${ESTRELAS_MAX} ${estrelas === 1 ? 'estrela' : 'estrelas'}`
}

export function textoDosPontos(pontos: number): string {
  return `${pontos} ${pontos === 1 ? 'ponto' : 'pontos'}`
}

export function textoDosFocos(focos: number): string {
  return `${focos} ${focos === 1 ? 'foco apagado' : 'focos apagados'}`
}
