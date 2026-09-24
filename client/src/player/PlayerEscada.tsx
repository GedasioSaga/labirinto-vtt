import { useEffect, useMemo, useState } from 'react'
import { escadaDaFicha, nomeDoPiso, pisoDe } from '../lib/pisos'
import type { MapData } from '../types/map'

/**
 * Quanto o botão espera o host depois do toque. O host recusa em silêncio
 * (`net/hostSession.ts`, `handleTokenPiso`): sem resposta nesse prazo, o botão
 * volta a valer em vez de girar para sempre.
 */
export const PISO_PENDENTE_MAX_MS = 4000

export interface PlayerEscadaProps {
  /** O mapa que o jogador RECEBEU (o recorte): só tem as escadas que ele pode ver. */
  map: MapData
  ownTokens: readonly string[]
  onTrocar: (tokenId: string, stairId: string) => void
}

/** O que o botão oferece: qual ficha, por qual escada, de que piso para qual. */
interface Alvo {
  tokenId: string
  stairId: string
  piso: number
  destino: number
}

/** A primeira ficha do jogador encostada numa escada que liga pisos. */
function alvoDoMapa(map: MapData, ownTokens: readonly string[]): Alvo | null {
  const own = new Set(ownTokens)
  for (const token of map.tokens) {
    if (!own.has(token.id)) continue
    const escada = escadaDaFicha(map, token)
    if (escada !== null) return { tokenId: token.id, stairId: escada.stairId, piso: pisoDe(token), destino: escada.destino }
  }
  return null
}

/**
 * PISOS NA MESMA CENA — "Subir ao 1º piso" / "Descer ao térreo", no canto de
 * baixo à direita, acima do zoom, só enquanto a ficha do jogador está encostada
 * numa escada que liga pisos. Tocar manda o pedido e o botão mostra
 * "Subindo…" até o piso novo chegar no snapshot (o botão vira o de voltar) ou
 * até `PISO_PENDENTE_MAX_MS`. Escada que não liga nada não ganha botão.
 */
export function PlayerEscada({ map, ownTokens, onTrocar }: PlayerEscadaProps) {
  const alvo = useMemo(() => alvoDoMapa(map, ownTokens), [map, ownTokens])
  /** O pedido que espera o host: de qual ficha e de que piso ela saiu. */
  const [pedido, setPedido] = useState<{ tokenId: string; deOnde: number } | null>(null)
  const alvoTokenId = alvo?.tokenId ?? null
  const alvoPiso = alvo?.piso ?? null

  // A ficha trocou de piso (ou saiu da escada): o pedido acabou, respondido ou não.
  useEffect(() => {
    setPedido(null)
  }, [alvoTokenId, alvoPiso])

  useEffect(() => {
    if (pedido === null) return
    const timer = setTimeout(() => setPedido(null), PISO_PENDENTE_MAX_MS)
    return () => clearTimeout(timer)
  }, [pedido])

  if (alvo === null) return null
  const pendente = pedido !== null && pedido.tokenId === alvo.tokenId && pedido.deOnde === alvo.piso
  const sobe = alvo.destino > alvo.piso
  const rotulo = pendente ? (sobe ? 'Subindo…' : 'Descendo…') : `${sobe ? 'Subir' : 'Descer'} ao ${nomeDoPiso(alvo.destino)}`

  return (
    <div className="pp-escada">
      <button
        type="button"
        className="pp-escada__button"
        aria-disabled={pendente}
        onClick={() => {
          if (pendente) return
          setPedido({ tokenId: alvo.tokenId, deOnde: alvo.piso })
          onTrocar(alvo.tokenId, alvo.stairId)
        }}
      >
        {rotulo}
      </button>
    </div>
  )
}
