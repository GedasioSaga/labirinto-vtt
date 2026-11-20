import { create } from 'zustand'
import type { PecaPosta, Puzzle } from '../../puzzles/tipos'

/**
 * O EDITOR DO PUZZLE aberto (plano dos puzzles, §4 P6 e decisão 7): ele abre
 * em tela cheia por cima do mapa, e a página Jogos fica só com a lista e o
 * resumo. Três alvos, como no protótipo aprovado (`textoAlvo`):
 *
 * - `copia`: o puzzle de um lugar deste mapa (`Desafio.minigame`). Salvar
 *   recomeça o puzzle daquele lugar (`copiaSalva`), e o modelo não muda.
 * - `modelo`: um modelo de "Meus puzzles". Salvar não muda as cópias.
 * - `rascunho`: um puzzle novo, que só existe no editor até "Salvar nos meus puzzles".
 */
export type AlvoDoEditor = { tipo: 'copia'; desafioId: string } | { tipo: 'modelo'; modeloId: string } | { tipo: 'rascunho'; puzzle: Puzzle }

interface EstadoDoEditorDoPuzzle {
  alvo: AlvoDoEditor | null
  abrir: (alvo: AlvoDoEditor) => void
  fechar: () => void
}

export const useEditorDoPuzzleStore = create<EstadoDoEditorDoPuzzle>()((set) => ({
  alvo: null,
  abrir: (alvo) => set({ alvo }),
  fechar: () => set({ alvo: null }),
}))

/**
 * PONTO DE LIGAÇÃO com a rede do puzzle (fase P7): devolver as peças postas
 * à ficha de quem pôs (`darNaFicha` no host). Recomeçar o progresso (salvar
 * a cópia, "Zerar progresso") sem isso apagaria itens das mochilas, então,
 * enquanto ninguém liga, quem recomeça um puzzle com peças postas é recusado
 * com `SEM_DEVOLUCAO`. Lança com a frase pronta quando não deu para devolver.
 */
export type DevolverPecas = (desafioId: string, pecas: readonly PecaPosta[]) => Promise<void>

let devolverPecas: DevolverPecas | null = null

/** A P7 liga aqui a devolução de verdade; `null` desliga (o host fechou). */
export function ligarDevolucaoDasPecas(devolver: DevolverPecas | null): void {
  devolverPecas = devolver
}

export const SEM_DEVOLUCAO = 'Há peças postas neste puzzle, e esta versão ainda não sabe devolvê-las às mochilas de quem pôs. Nada mudou.'

/** Devolve as peças a quem pôs. Sem peças, não faz nada; sem a ligação, lança `SEM_DEVOLUCAO`. */
export async function devolverAsPecas(desafioId: string, pecas: readonly PecaPosta[]): Promise<void> {
  if (pecas.length === 0) return
  if (devolverPecas === null) throw new Error(SEM_DEVOLUCAO)
  await devolverPecas(desafioId, pecas)
}
