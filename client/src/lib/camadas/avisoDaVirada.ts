import { useToastStore } from '../../stores/toastStore'

/**
 * A VIRADA SEM PEDIR (revisão da fatia 6): o olho "Você vê" (ou o cadeado) de
 * uma camada NOVA num mapa de antes vira o mapa para v2 — e dali em diante
 * "Ocultar Paredes" esconde só do mestre, os jogadores passam a ver. O olho
 * de Telhados substituiu um botão de sessão usado toda hora, então essa virada
 * acontece sem o mestre ter pedido controle novo nenhum: avisa, uma vez por
 * mapa nesta sessão, com o Ctrl+Z como saída. A virada pelo olho dos
 * jogadores ou pela opacidade não passa por aqui (o mestre pediu o controle).
 */
const mapasAvisados = new Set<string>()

export const TEXTO_DA_VIRADA = 'Camadas novas ativadas: o olho "Você vê" agora não esconde dos jogadores. Desfazer: Ctrl+Z'

/** Aviso mais longo que o padrão (4 s): é uma frase para ler, não um "feito". */
const DURACAO_DO_AVISO_MS = 8000

export function avisarViradaParaV2(mapaId: string): void {
  if (mapasAvisados.has(mapaId)) return
  mapasAvisados.add(mapaId)
  useToastStore.getState().push('info', TEXTO_DA_VIRADA, DURACAO_DO_AVISO_MS, { chave: `virada-v2:${mapaId}` })
}
