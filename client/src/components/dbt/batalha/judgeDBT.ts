import { useCallback, useEffect } from 'react'
import { gravarJudgeLembrado, judgeInicial, lerJudgeLembrado, type JudgeNaCena } from '../../../lib/batalha/judge'
import { useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { useMapStore } from '../../../stores/mapStore'

/**
 * O JUDGE NA BATALHA DBT (seção 20, fatia 3: o efeito de `App.tsx:1433-1452`
 * replicado para a store DBT). Mesma infra genérica do One Piece
 * (`lib/batalha/judge`): nasce onde o mestre o deixou neste mapa, senão 2
 * casas ao norte da primeira ficha da ordem, senão no centro; soltar numa
 * casa grava na store (vai aos jogadores no `batalhaDBT.estado`) e fica
 * lembrado neste aparelho.
 */

/** Onde o Judge fica lembrado por mapa neste aparelho; `null` quando o acesso lança (dado bloqueado). */
function armazemDoJudge(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Onde ele nasce na cena aberta: o lembrado, a primeira ficha da ordem ou o centro do mapa. */
export function judgeInicialDBT(sceneKey: string, aventuraId: string | null, primeiroTokenId: string | null): JudgeNaCena {
  const mapa = useMapStore.getState().map
  const primeira = primeiroTokenId === null ? undefined : mapa.tokens.find((token) => token.id === primeiroTokenId)
  // O centro da casa do meio (os pés numa casa, como a ficha).
  const centro = { x: (Math.floor(mapa.width / 2) + 0.5) * mapa.grid, y: (Math.floor(mapa.height / 2) + 0.5) * mapa.grid }
  return judgeInicial(
    lerJudgeLembrado(armazemDoJudge(), aventuraId, sceneKey),
    primeira === undefined ? null : { x: primeira.x, y: primeira.y },
    centro,
    mapa.grid,
    { largura: mapa.width * mapa.grid, altura: mapa.height * mapa.grid },
  )
}

/** O Judge da cena na batalha DBT; `null` fora de batalha ou sem Judge. Seletor estável. */
export function judgeDaCenaDBT(state: { cenas: Readonly<Record<string, { judge?: JudgeNaCena }>> }, sceneKey: string | null): JudgeNaCena | null {
  if (sceneKey === null || !Object.hasOwn(state.cenas, sceneKey)) return null
  return state.cenas[sceneKey].judge ?? null
}

/**
 * Para o App do mestre: o Judge da cena aberta (`judge` do `PixiCanvas`, em
 * OU com o do One Piece) e o `onJudgeSolto`. Batalha DBT ligada sem Judge (a
 * cena veio de antes do Iniciar o pôr): ele nasce aqui.
 */
export function useJudgeDBT(sceneKey: string, aventuraId: string | null): { judge: JudgeNaCena | null; soltar: (x: number, y: number) => void } {
  const ligada = useBatalhaDBTStore((state) => Object.hasOwn(state.cenas, sceneKey))
  const judge = useBatalhaDBTStore((state) => judgeDaCenaDBT(state, sceneKey))
  useEffect(() => {
    if (!ligada || judge !== null) return
    const cena = useBatalhaDBTStore.getState().cenas[sceneKey]
    if (cena === undefined) return
    const inicial = judgeInicialDBT(sceneKey, aventuraId, cena.ordem.cartas[0] ?? null)
    useBatalhaDBTStore.getState().moverJudge(sceneKey, inicial.x, inicial.y)
  }, [ligada, judge, sceneKey, aventuraId])
  const soltar = useCallback(
    (x: number, y: number) => {
      if (!useBatalhaDBTStore.getState().moverJudge(sceneKey, x, y)) return
      gravarJudgeLembrado(armazemDoJudge(), aventuraId, sceneKey, { x, y })
    },
    [sceneKey, aventuraId],
  )
  return { judge, soltar }
}
