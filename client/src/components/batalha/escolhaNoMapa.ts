import { EMPTY_SELECTION, selectionOfItem, selectionSingle, type SelectionSet } from '../../lib/selectionModel'
import { useMapStore } from '../../stores/mapStore'

/**
 * Pedido de 09/11/2026 (item 6): a lista "Quem entra na batalha?" e o mapa
 * conversam pela SELEÇÃO do editor, sem o canvas saber de nada. Passar o mouse
 * num nome acende a ficha (o anel de seleção que o mestre já conhece); clicar
 * numa ficha no mapa avisa a lista, que marca ou desmarca.
 *
 * Só vista do mestre: o mapa não muda (nada para desfazer) e a rede não manda
 * nada. Ao soltar, a seleção volta a ser a de antes de abrir.
 */
export interface EscolhaNoMapa {
  /** Acende a ficha no mapa; `null` apaga. Ficha que saiu do mapa também apaga. */
  destacar(tokenId: string | null): void
  /** A lista fechou: para de ouvir o mapa e devolve a seleção de antes. */
  soltar(): void
}

/**
 * Depois do clique a seleção esvazia sozinha, para o clique seguinte NA MESMA
 * ficha contar (ele só é visto quando a seleção muda). O tempo deixa o gesto
 * do clique terminar antes de mexer na seleção.
 */
const ESPERA_PARA_ESVAZIAR_MS = 220

export function abrirEscolhaNoMapa(aoClicar: (tokenId: string) => void): EscolhaNoMapa {
  const inicio = useMapStore.getState()
  const antes: SelectionSet = inicio.selection
  // Clicar em ficha só seleciona com a ferramenta Selecionar.
  if (inicio.activeTool !== 'select') inicio.setActiveTool('select')
  // A troca feita por esta lista (acender, apagar) não é clique do mestre.
  let daLista = false
  let relogio: ReturnType<typeof setTimeout> | null = null

  const porSelecao = (selecao: SelectionSet): void => {
    daLista = true
    try {
      useMapStore.getState().setSelection(selecao)
    } finally {
      daLista = false
    }
  }
  const pararRelogio = (): void => {
    if (relogio !== null) clearTimeout(relogio)
    relogio = null
  }

  porSelecao(EMPTY_SELECTION)
  const parar = useMapStore.subscribe((estado, anterior) => {
    if (daLista || estado.selection === anterior.selection) return
    const unico = selectionSingle(estado.selection)
    if (unico?.kind !== 'token') return
    aoClicar(unico.id)
    pararRelogio()
    relogio = setTimeout(() => {
      relogio = null
      const atual = selectionSingle(useMapStore.getState().selection)
      if (atual?.kind === 'token' && atual.id === unico.id) porSelecao(EMPTY_SELECTION)
    }, ESPERA_PARA_ESVAZIAR_MS)
  })

  return {
    destacar(tokenId) {
      pararRelogio()
      const existe = tokenId !== null && useMapStore.getState().map.tokens.some((token) => token.id === tokenId)
      porSelecao(tokenId !== null && existe ? selectionOfItem({ kind: 'token', id: tokenId }) : EMPTY_SELECTION)
    },
    soltar() {
      pararRelogio()
      parar()
      porSelecao(antes)
    },
  }
}
