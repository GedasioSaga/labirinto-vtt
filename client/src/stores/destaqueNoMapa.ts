import { EMPTY_SELECTION, selectionOfItem, selectionSingle, type SelectionSet } from '../lib/selectionModel'
import { useMapStore } from './mapStore'

/**
 * O seletor "Atribuir token" e o mapa conversam por aqui, sem o canvas saber
 * de nada: o destaque é a SELEÇÃO do editor (o anel que o mestre já conhece) e
 * o "clicar no token no mapa" é ouvir essa mesma seleção mudar.
 *
 * Tudo é vista do mestre: o mapa não muda (nada para desfazer) e a rede não
 * manda nada.
 */

export interface DestaqueNoMapa {
  /** Acende o token da cena aberta; `null` (ou token de outra cena) volta ao que estava. */
  destacar(tokenId: string | null): void
  /** A lista fechou: a seleção volta a ser a de antes de abrir. */
  soltar(): void
}

/** Guarda a seleção de agora e devolve o controle do destaque enquanto a lista está aberta. */
export function abrirDestaqueNoMapa(): DestaqueNoMapa {
  const antes: SelectionSet = useMapStore.getState().selection
  let aceso: string | null = null

  const voltar = (): void => {
    if (aceso === null) return
    const store = useMapStore.getState()
    // O mestre selecionou outra coisa no meio do caminho: a escolha dele fica.
    const atual = selectionSingle(store.selection)
    if (atual?.kind === 'token' && atual.id === aceso) store.setSelection(antes)
    aceso = null
  }

  return {
    destacar(tokenId) {
      if (tokenId === aceso) return
      const store = useMapStore.getState()
      if (tokenId === null || !store.map.tokens.some((token) => token.id === tokenId)) {
        voltar()
        return
      }
      aceso = tokenId
      store.setSelection(selectionOfItem({ kind: 'token', id: tokenId }))
    },
    soltar: voltar,
  }
}

/** Quem espera o clique agora: chamado quando outro card arma. */
let esperaAtual: (() => void) | null = null

/**
 * "Clicar no token no mapa": arma a ferramenta Selecionar com a seleção vazia
 * e avisa o primeiro token que o mestre clicar. Devolve como desarmar.
 * A seleção começa vazia de propósito: clicar no token que já estava
 * selecionado não mudaria nada, e o clique passaria em branco.
 */
export function esperarTokenNoMapa(aoClicar: (tokenId: string) => void, aoPerderAVez: () => void): () => void {
  // Um card de cada vez espera o clique: o que armou antes perde a vez.
  esperaAtual?.()
  const store = useMapStore.getState()
  if (store.activeTool !== 'select') store.setActiveTool('select')
  store.setSelection(EMPTY_SELECTION)
  const parar = useMapStore.subscribe((estado, anterior) => {
    if (estado.selection === anterior.selection) return
    const unico = selectionSingle(estado.selection)
    if (unico?.kind === 'token') aoClicar(unico.id)
  })
  const tirarAVez = (): void => {
    desarmar()
    aoPerderAVez()
  }
  const desarmar = (): void => {
    parar()
    if (esperaAtual === tirarAVez) esperaAtual = null
  }
  esperaAtual = tirarAVez
  return desarmar
}
