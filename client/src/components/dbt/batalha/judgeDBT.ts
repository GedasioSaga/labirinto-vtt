import { useCallback, useEffect } from 'react'
import { gravarJudgeLembrado, judgeInicial, lerJudgeLembrado, type JudgeNaCena } from '../../../lib/batalha/judge'
import { judgeNoMapaDaBatalha } from '../../../lib/batalha/ondeNasceOJudge'
import { useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { useMapStore } from '../../../stores/mapStore'

/**
 * O JUDGE NA BATALHA DBT (seção 20, fatia 3: o efeito do One Piece no
 * `App.tsx` replicado para a store DBT). Mesma infra do One Piece
 * (`lib/batalha/judge` e `lib/batalha/ondeNasceOJudge`): nasce perto de quem
 * está na batalha, em casa livre do piso deles, do mesmo lado das paredes
 * (pedido de 19/11/2026, mapa grande inclusive); o lugar onde o mestre o
 * deixou neste mapa só vale se está perto desse grupo. Grade hex, ninguém da
 * batalha no mapa ou nenhuma casa livre: a regra de antes (`judgeInicial`), o
 * lembrado perto da primeira ficha da ordem, senão 2 casas ao norte dela,
 * senão o centro. Soltar numa casa grava na store (vai aos jogadores no
 * `batalhaDBT.estado`) e fica lembrado neste aparelho.
 */

/** Onde o Judge fica lembrado por mapa neste aparelho; `null` quando o acesso lança (dado bloqueado). */
function armazemDoJudge(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Onde ele nasce na cena aberta. `tokenIds`: quem está na batalha (os tokens
 * dos combatentes), na ordem; o primeiro é a primeira ficha da regra de antes.
 */
export function judgeInicialDBT(sceneKey: string, aventuraId: string | null, tokenIds: readonly string[]): JudgeNaCena {
  const mapa = useMapStore.getState().map
  const lembrado = lerJudgeLembrado(armazemDoJudge(), aventuraId, sceneKey)
  const pertoDoGrupo = judgeNoMapaDaBatalha(mapa, tokenIds, lembrado)
  if (pertoDoGrupo !== null) return pertoDoGrupo
  const primeiroTokenId = tokenIds.at(0)
  const primeira = primeiroTokenId === undefined ? undefined : mapa.tokens.find((token) => token.id === primeiroTokenId)
  // O centro da casa do meio (os pés numa casa, como a ficha).
  const centro = { x: (Math.floor(mapa.width / 2) + 0.5) * mapa.grid, y: (Math.floor(mapa.height / 2) + 0.5) * mapa.grid }
  return judgeInicial(
    lembrado,
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
    const inicial = judgeInicialDBT(sceneKey, aventuraId, cena.ordem.cartas)
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
