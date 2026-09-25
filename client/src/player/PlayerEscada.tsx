import { useEffect, useMemo, useState } from 'react'
import { escadaDaFicha, nomeDoPiso, pisoDe } from '../lib/pisos'
import type { PlayerConfronto } from '../lib/confronto'
import type { MapData, Token } from '../types/map'

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
  /** INICIATIVA: a ficha da vez, só quando ela veio no recorte (`turnForPlayer`). */
  turn: string | undefined
  /** CONFRONTO da cena dele, como o host mandou. */
  confronto: PlayerConfronto | undefined
  /** Cena pausada pelo mestre. */
  paused: boolean
  onTrocar: (tokenId: string, stairId: string) => void
}

/** O que a tela sabe das travas do passo — as mesmas que o host usa na escada. */
type TravasDaTela = Pick<PlayerEscadaProps, 'turn' | 'confronto' | 'paused'>

/** O que o botão oferece: qual ficha, por qual escada, de que piso para qual. */
interface Alvo {
  tokenId: string
  stairId: string
  piso: number
  destino: number
}

/**
 * O host recusa a escada em silêncio com as travas do passo
 * (`travaDaFichaDoJogador` em `handleTokenPiso`) e com a cena pausada: o botão
 * não oferece o que vai ser recusado. Vez de ficha que o jogador não vê não
 * chega aqui (`turn` ausente) — a tela não pode saber dela sem contar que existe.
 */
function fichaTravada(token: Token, { turn, confronto, paused }: TravasDaTela): boolean {
  if (paused) return true
  // Cadeado do mestre.
  if (token.locked === true) return true
  // Iniciativa: vez de outra ficha nesta cena.
  if (turn !== undefined && turn !== token.id) return true
  // Confronto: só prende ficha da fila; `vez` null é a vez de alguém que ele não vê.
  return confronto !== undefined && confronto.fila.includes(token.id) && confronto.vez !== token.id
}

/** A primeira ficha do jogador, sem trava, encostada numa escada que liga pisos. */
function alvoDoMapa(map: MapData, ownTokens: readonly string[], travas: TravasDaTela): Alvo | null {
  const own = new Set(ownTokens)
  for (const token of map.tokens) {
    if (!own.has(token.id)) continue
    if (fichaTravada(token, travas)) continue
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
export function PlayerEscada({ map, ownTokens, turn, confronto, paused, onTrocar }: PlayerEscadaProps) {
  const alvo = useMemo(() => alvoDoMapa(map, ownTokens, { turn, confronto, paused }), [map, ownTokens, turn, confronto, paused])
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
