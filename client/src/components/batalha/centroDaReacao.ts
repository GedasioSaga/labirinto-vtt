import { create } from 'zustand'

/**
 * A REAÇÃO DO MESTRE NO CENTRO (pedido de 10/11/2026: "reação tem que ficar
 * na parte do campo e não na lateral"): a carta REAÇÃO do NPC abre sobre o
 * mapa (`ReacaoNoCentro`, montada pelo App junto do menu da vez) e a aba
 * Batalha fica só com a lista curta de quem espera (`ReacoesPendentes`).
 * Esta store liga as duas: a linha clicada na aba traz aquela reação ao
 * centro, e o centro conta qual está à vista para a linha se marcar.
 *
 * A reação NÃO trava a vez: a vez passa com ela esperando, e o golpe espera
 * a virada da rodada (quem não reagir toma nele). Ela vem na frente porque é
 * a decisão que o mestre deve antes da virada; o menu da vez e a mira do NPC
 * ficam atrás (`VezDoNpcNoCentro` lê `naFrente`) e voltam quando ela resolve
 * ou recolhe.
 */

interface ReacaoNoCentroDoMestre {
  /** A reação que o mestre trouxe ao centro (`chaveDaReacao`); `null` = a da vez na fila. */
  escolhida: string | null
  /** O mestre recolheu a carta (Esc ou Recolher): fica só o botão REAÇÃO. */
  recolhida: boolean
  /** A carta está à vista no centro (escrito pelo `ReacaoNoCentro`). */
  naFrente: boolean
  /** A reação à vista no centro, aberta ou recolhida (escrito pelo `ReacaoNoCentro`); `null` = nenhuma. */
  noCentro: string | null
  /**
   * Sobe a cada vez que o MESTRE pede a carta (a linha da aba, o botão REAÇÃO, as setas): aí ela pega o foco. A que
   * abre sozinha (golpe novo) não sobe: só pega o foco se ele não estiver num campo ou fora da batalha.
   */
  foco: number
  /** A linha da aba (e as setas): aquela reação vem ao centro, aberta e com o foco. */
  trazer: (chave: string) => void
  recolher: () => void
  /** `pedeFoco` falso = abriu sozinha (golpe novo). */
  abrir: (pedeFoco?: boolean) => void
  mostrar: (noCentro: string | null, naFrente: boolean) => void
}

export const useReacaoNoCentro = create<ReacaoNoCentroDoMestre>()((set) => ({
  escolhida: null,
  recolhida: false,
  naFrente: false,
  noCentro: null,
  foco: 0,
  trazer: (chave) => set((state) => ({ escolhida: chave, recolhida: false, foco: state.foco + 1 })),
  recolher: () => set({ recolhida: true }),
  abrir: (pedeFoco = true) => set((state) => ({ recolhida: false, foco: pedeFoco ? state.foco + 1 : state.foco })),
  mostrar: (noCentro, naFrente) => set({ noCentro, naFrente }),
}))

/** Os `input` em que não se digita: com o foco neles, o Enter não escreve nada que a carta roubaria. */
const SEM_DIGITAR = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

/** Onde o mestre está mexendo na batalha: o mapa (e o que mora nele: o menu da vez, a mira), a aba Batalha e a faixa da ordem. */
const DA_BATALHA = '.lb-editor__canvas, .lb-batalha-pagina, .bt-faixa, .bt-centro-do-mestre'

/**
 * A carta que abre SOZINHA (golpe novo, a seguinte da fila, o dado que volta) pode pegar o foco? Só com o foco no
 * corpo da página, na própria carta ou num controle da batalha que não seja de digitar. Num campo de texto
 * (qualquer lugar), num `select` ou fora da batalha, não: o próximo Enter ou espaço rolaria o d20 sem o mestre querer.
 */
export function focoPodeIrParaACarta(ativo: Element | null, carta: Element | null): boolean {
  if (ativo === null || ativo === document.body || ativo === document.documentElement) return true
  if (carta !== null && carta.contains(ativo)) return true
  if (ativo.tagName === 'TEXTAREA' || ativo.tagName === 'SELECT') return false
  if (ativo instanceof HTMLInputElement && !SEM_DIGITAR.has(ativo.type)) return false
  if (ativo.closest('[contenteditable]:not([contenteditable="false"])') !== null) return false
  return ativo.closest(DA_BATALHA) !== null
}
