import { useCallback, useEffect, useRef } from 'react'
import type { AutorDaAcao, TurnosDaCena } from '../../lib/batalha/turnos'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { cliqueDoPassarVale, vezMostrada } from './dadosDaFaixa'

const MESTRE: AutorDaAcao = { tipo: 'mestre' }

/**
 * Conserto das fichas F1 (bug 7): o "Passar a vez" do mestre (a faixa, o
 * painel e o painel da vez) não pula ninguém. O pedido leva a vez que a tela
 * MOSTRA (a store recusa se ela já andou) e só vale com a vez já assentada
 * (`cliqueDoPassarVale`). Devolve se passou.
 */
export function usePassarVezDoMestre(sceneKey: string, turnos: Pick<TurnosDaCena, 'vez' | 'rodada'> | undefined): () => boolean {
  const vez = turnos?.vez ?? null
  const rodada = turnos?.rodada ?? 0
  // Começa assentada: a tela que acabou de abrir não perde o primeiro clique.
  const desde = useRef(Number.NEGATIVE_INFINITY)
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false
      return
    }
    desde.current = performance.now()
  }, [vez, rodada])
  return useCallback(() => {
    if (!cliqueDoPassarVale(desde.current, performance.now())) return false
    return useBatalhaStore.getState().passarVez(sceneKey, MESTRE, vezMostrada({ vez, rodada }))
  }, [sceneKey, vez, rodada])
}
