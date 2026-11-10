import { useCallback, useEffect, useRef, useState } from 'react'
import { ehSoRealceNoMapa, marcarRealceNoMapa } from '../../lib/batalha/realceNoMapa'
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
  /** A lista fechou: para de ouvir o mapa e devolve a ferramenta e a seleção de antes. */
  soltar(): void
}

/**
 * Depois do clique a seleção esvazia sozinha, para o clique seguinte NA MESMA
 * ficha contar (ele só é visto quando a seleção muda). O tempo deixa o gesto
 * do clique terminar antes de mexer na seleção.
 */
const ESPERA_PARA_ESVAZIAR_MS = 220

/**
 * A troca de seleção feita por este arquivo (acender, apagar) não é clique do
 * mestre. Vale para toda lista aberta: a carta da faixa que acende uma ficha
 * não marca nem desmarca ninguém na lista de quem entra.
 */
let trocaDaqui = false

/**
 * `soRealce`: a seleção só acende uma ficha, não é escolha do mestre. Fica
 * marcada (`realceNoMapa`), e Delete, Backspace e recortar não agem nela
 * (segunda auditoria, achado 3). O resto que passa por aqui (esvaziar,
 * devolver a seleção de antes) tira a marca.
 */
function porSelecao(selecao: SelectionSet, soRealce = false): void {
  trocaDaqui = true
  try {
    marcarRealceNoMapa(soRealce && selecao !== EMPTY_SELECTION ? selecao : null)
    useMapStore.getState().setSelection(selecao)
  } finally {
    trocaDaqui = false
  }
}

function selecaoDaFicha(tokenId: string | null): SelectionSet {
  const existe = tokenId !== null && useMapStore.getState().map.tokens.some((token) => token.id === tokenId)
  return tokenId !== null && existe ? selectionOfItem({ kind: 'token', id: tokenId }) : EMPTY_SELECTION
}

/**
 * As fichas selecionadas no mapa agora (conserto de 09/11, achado 3): quem o mestre selecionou antes de abrir a lista
 * já vem marcado. A ficha só acesa por uma lista não conta: não foi o mestre que a selecionou.
 */
export function fichasSelecionadasNoMapa(): string[] {
  const { selection } = useMapStore.getState()
  if (ehSoRealceNoMapa(selection)) return []
  return selection.filter((item) => item.kind === 'token').map((item) => item.id)
}

export function abrirEscolhaNoMapa(aoClicar: (tokenId: string) => void): EscolhaNoMapa {
  const inicio = useMapStore.getState()
  const antes: SelectionSet = inicio.selection
  // Clicar em ficha só seleciona com a ferramenta Selecionar. A que o mestre usava volta ao fechar (segunda auditoria, achado 5).
  const ferramentaDeAntes = inicio.activeTool
  if (ferramentaDeAntes !== 'select') inicio.setActiveTool('select')
  let relogio: ReturnType<typeof setTimeout> | null = null

  const pararRelogio = (): void => {
    if (relogio !== null) clearTimeout(relogio)
    relogio = null
  }

  porSelecao(EMPTY_SELECTION)
  const parar = useMapStore.subscribe((estado, anterior) => {
    if (trocaDaqui || estado.selection === anterior.selection) return
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
      porSelecao(selecaoDaFicha(tokenId), true)
    },
    soltar() {
      pararRelogio()
      parar()
      // A ferramenta antes da seleção: trocar para uma ferramenta que cria limpa a seleção. Se o mestre pegou outra no meio, a dele fica.
      const agora = useMapStore.getState()
      if (ferramentaDeAntes !== 'select' && agora.activeTool === 'select') agora.setActiveTool(ferramentaDeAntes)
      porSelecao(antes)
    },
  }
}

/**
 * Conserto de 09/11/2026 (achado 1): a lista aberta ouve o mapa por este gancho.
 * `clique` é a ficha clicada (`seq` sobe a cada clique) e volta a `null` quando
 * a lista fecha: a lista seguinte não herda o clique da anterior (antes, o
 * último clique ficava guardado e a lista reaberta o repetia ao nascer).
 */
export function useEscolhaNoMapa(ativa: boolean): { clique: { tokenId: string; seq: number } | null; destacar: (tokenId: string | null) => void } {
  const [clique, setClique] = useState<{ tokenId: string; seq: number } | null>(null)
  const escolha = useRef<EscolhaNoMapa | null>(null)
  useEffect(() => {
    if (!ativa) return
    const aberta = abrirEscolhaNoMapa((tokenId) => setClique((antes) => ({ tokenId, seq: (antes?.seq ?? 0) + 1 })))
    escolha.current = aberta
    return () => {
      escolha.current = null
      aberta.soltar()
      setClique(null)
    }
  }, [ativa])
  const destacar = useCallback((tokenId: string | null) => escolha.current?.destacar(tokenId), [])
  return { clique, destacar }
}

/** Passar o mouse numa carta sem querer (de passagem) não acende nada: só depois deste tanto parado nela. */
const ESPERA_DA_INTENCAO_MS = 120

/**
 * Conserto de 09/11/2026 (achado 4): passar o mouse numa carta da faixa da
 * ordem acende a ficha dela no mapa, pela mesma seleção do editor. Sair da
 * carta devolve a seleção de antes. Só vista do mestre; nada muda no mapa.
 */
export function abrirDestaqueDaFaixa(): { apontar(tokenId: string | null): void; soltar(): void } {
  let antes: SelectionSet | null = null
  let aceso: string | null = null
  let relogio: ReturnType<typeof setTimeout> | null = null
  const pararRelogio = (): void => {
    if (relogio !== null) clearTimeout(relogio)
    relogio = null
  }
  const apagar = (): void => {
    pararRelogio()
    // Só devolve a seleção se ela ainda é a que esta faixa acendeu: o que o mestre selecionou no meio fica.
    const atual = selectionSingle(useMapStore.getState().selection)
    if (antes !== null && aceso !== null && atual?.kind === 'token' && atual.id === aceso) porSelecao(antes)
    antes = null
    aceso = null
  }
  return {
    apontar(tokenId) {
      // A carta nova desmarca a espera da anterior (o mouse só passou por ela).
      pararRelogio()
      if (tokenId === aceso) return
      if (tokenId === null) {
        apagar()
        return
      }
      relogio = setTimeout(() => {
        relogio = null
        const selecao = selecaoDaFicha(tokenId)
        if (selecao === EMPTY_SELECTION) return
        if (antes === null) antes = useMapStore.getState().selection
        aceso = tokenId
        porSelecao(selecao, true)
      }, ESPERA_DA_INTENCAO_MS)
    },
    soltar: apagar,
  }
}
