/**
 * Contratos da VISÃO DE JOGADOR (ferramenta do mestre): o mestre escolhe uma
 * ficha e abre uma janela separada com a tela do jogador daquela ficha, em
 * "Olhar" (só vê) ou "Jogar" (age para testar). É teste: nada do que acontece
 * lá fica no jogo de verdade nem chega aos jogadores reais.
 *
 * Este arquivo só tem tipos: é o ponto de encontro entre o painel da aba Jogo
 * (`components/RoomPanel.tsx`), a lista de fichas, a barra da janela de teste
 * e o controlador (`net/visaoDeTeste/visaoDeTeste.ts`).
 */

/** Uma ficha na lista da Visão de jogador (fichas da cena aberta do editor). */
export interface FichaParaTeste {
  id: string
  nome: string
  /**
   * Retrato da lista: a cópia embutida da foto (`Token.imageData`, data URL
   * pequena) ou null. Nunca o caminho do disco (`Token.image`): a janela de
   * teste é a tela do jogador e não lê arquivo do mestre.
   */
  retrato: string | null
  /** Cor do disco da ficha (`#rrggbb`), para o círculo sem foto. */
  cor: string
  /** Nome do jogador dono da ficha (sala aberta ou mesa guardada); null = "sem jogador". */
  dono: string | null
  npc: boolean
}

export type ModoDoTeste = 'olhar' | 'jogar'

/** O que o painel da aba Jogo recebe do App para a Visão de jogador. */
export interface VisaoDeJogadorNoPainel {
  /** Há janela de teste aberta agora: o botão mostra o estado "Janela aberta". */
  aberta: boolean
  /** Nome da ficha olhada na janela aberta (null com a janela fechada). */
  fichaAberta: string | null
  fichas: readonly FichaParaTeste[]
  /** Ficha selecionada no mapa do editor: vem primeiro na lista, com o selo "Selecionada". */
  fichaSelecionadaId: string | null
  /** Escolheu uma ficha na lista: abre a janela de teste com ela. */
  onAbrir(tokenId: string): void
  /** Com a janela aberta, traz a janela para a frente (sem trocar a ficha). */
  onMostrar(): void
  onFechar(): void
}

/** A barra fina da janela de teste, logo abaixo do título do Windows. */
export interface BarraDoTesteProps {
  ficha: FichaParaTeste
  modo: ModoDoTeste
  onModo(modo: ModoDoTeste): void
  /** false = o lado "Jogar" aparece desligado (ainda não disponível). Ausente = true. */
  jogarDisponivel?: boolean
  /** Fichas para "Trocar ficha" (a mesma lista do painel). */
  fichas: readonly FichaParaTeste[]
  fichaSelecionadaId: string | null
  onTrocarFicha(tokenId: string): void
  /** Ausente = sem o botão "Esquecer tudo". */
  onEsquecerTudo?: () => void
  onFechar(): void
}

/** Recado do modo Olhar quando o mestre tenta uma ação do jogador. */
export interface RecadoDoOlharProps {
  /** Muda para Jogar na hora. Ausente = recado sem o botão (Jogar indisponível). */
  onPassarParaJogar?: () => void
  onFechar(): void
}
