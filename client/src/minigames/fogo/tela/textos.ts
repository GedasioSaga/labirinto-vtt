import type { DificuldadeFogo, FuncaoFogo } from '../tipos'
import type { FogoMotivoDoFim, FogoResultado } from '../../../net/protocoloDoFogo'

/** Os textos do Fogo na Floresta, no painel do mestre e na tela do jogador (português simples). */

export const NOME_DO_JOGO_FOGO = 'Fogo na Floresta'

export const NOME_DA_DIFICULDADE_FOGO: Record<DificuldadeFogo, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  extremo: 'Extremo',
}

export const NOME_DA_FUNCAO_FOGO: Record<FuncaoFogo, string> = {
  bombeiro: 'Bombeiro',
  lenhador: 'Lenhador',
  socorrista: 'Socorrista',
}

/** O que cada função faz, numa linha (o convite mostra ao escolher). */
export const DICA_DA_FUNCAO_FOGO: Record<FuncaoFogo, string> = {
  bombeiro: 'Apaga o fogo com a mangueira; enche a água no lago ou no caminhão.',
  lenhador: 'Corta pinheiro e cava aceiro para o fogo não passar.',
  socorrista: 'Leva campistas e animais até o caminhão.',
}

export const NOME_DO_RESULTADO_FOGO: Record<FogoResultado, string> = {
  venceu: 'Venceu',
  perdeu: 'Não venceu',
  saiu: 'Saiu',
}

export const MOTIVO_DO_ENCERRAMENTO_FOGO: Record<FogoMotivoDoFim, string> = {
  fora: 'O jogo começou sem você: da próxima vez, toque em Pronto antes.',
  mestre: 'O mestre encerrou o jogo.',
  saiu: 'Você saiu do jogo (a conexão caiu ou a página recarregou).',
  divergiu: 'As partidas dos aparelhos ficaram diferentes e o jogo foi encerrado. Nada foi ganho nem perdido.',
}

/** Por que o jogo não chegou neste aparelho (entra no aviso: "O jogo não carregou (...)"). */
export const ERRO_DO_JOGO_AUSENTE = 'o aparelho do mestre ainda não tem este jogo'
export const ERRO_DA_CARGA_DEMORADA = 'demorou demais para carregar'

export const CONTROLES_DO_FOGO = 'WASD ou setas andam; o mouse mira; clique ou Espaço faz a ação; E pega e solta; 1, 2 e 3 trocam de função no caminhão.'
