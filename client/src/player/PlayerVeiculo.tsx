import { useEffect, useMemo, useState } from 'react'
import type { PlayerConfronto } from '../lib/confronto'
import { isNearVehicle } from '../lib/vehicle'
import type { MapData } from '../types/map'
import { fichaTravada, type TravasDaTela } from './PlayerEscada'

/**
 * Quanto o botão espera o host depois do toque. Sem resposta nesse prazo
 * (pedido que morreu em silêncio, `net/hostSession.ts`), volta a valer em vez
 * de girar para sempre — como a escada (`PISO_PENDENTE_MAX_MS`).
 */
export const VEICULO_PENDENTE_MAX_MS = 4000

export interface PlayerVeiculoProps {
  /** O mapa que o jogador RECEBEU (o recorte): só tem os veículos que ele vê, marcados com `embarcavel`. */
  map: MapData
  ownTokens: readonly string[]
  /** Cena pausada pelo mestre: nada sobe nem desce. */
  paused: boolean
  /** INICIATIVA: a ficha da vez, só quando ela veio no recorte (`turnForPlayer`). Ausente = sem vez que ele veja. */
  turn?: string
  /** CONFRONTO da cena dele, como o host mandou. */
  confronto?: PlayerConfronto
  onSubir: (tokenId: string, vehicleId: string) => void
  onDescer: (tokenId: string) => void
  /** O aviso do rodapé (`moveNotice.id`): a recusa ("Veículo cheio") também encerra a espera do botão. */
  aviso?: number
}

/** O que a coluna das ações do lugar oferece agora. */
export type OfertaDoVeiculo =
  | { tipo: 'a-bordo'; tokenId: string; motorista: boolean; podeDescer: boolean }
  | { tipo: 'subir'; tokenId: string; vehicleId: string }

/**
 * A ficha do jogador a bordo (o host marca `aBordo` só na do dono) vence: a
 * tela diz que ele está no veículo e oferece "Descer". A pé, a primeira ficha
 * dele, solta, encostada num veículo que ele vê (`isNearVehicle`, a mesma
 * conta do host) ganha o "Subir". Lugar livre a tela não sabe — o host diz
 * "Veículo cheio" na recusa.
 *
 * As travas são as da escada (`fichaTravada`), porque o host confere as
 * mesmas no "Subir" e no "Descer" (`travaDaFichaDoJogador`): cadeado, floco
 * e — na INICIATIVA ou no CONFRONTO — a vez de outra ficha. Travada, o botão
 * não aparece (a escada faz igual) em vez de prometer o que o host recusaria
 * com "Espere sua vez"; a faixa "Sua vez" já diz quando voltar a valer. Vez de
 * ficha que ele não vê não chega aqui (`turn` ausente): a tela não pode
 * saber dela sem contar que existe, e o host continua recusando.
 */
export function ofertaDoVeiculo(
  map: MapData,
  ownTokens: readonly string[],
  paused: boolean,
  vez: Pick<TravasDaTela, 'turn' | 'confronto'> = { turn: undefined, confronto: undefined },
): OfertaDoVeiculo | null {
  const travas: TravasDaTela = { ...vez, paused }
  const own = new Set(ownTokens)
  const minhas = map.tokens.filter((t) => own.has(t.id))
  const aBordo = minhas.find((t) => t.aBordo !== undefined)
  if (aBordo?.aBordo !== undefined) {
    return { tipo: 'a-bordo', tokenId: aBordo.id, motorista: aBordo.aBordo.motorista, podeDescer: !fichaTravada(aBordo, travas) }
  }
  if (paused) return null
  const veiculos = map.tokens.filter((t) => t.embarcavel === true)
  if (veiculos.length === 0) return null
  for (const token of minhas) {
    // Veículo não embarca em veículo.
    if (token.embarcavel === true || fichaTravada(token, travas)) continue
    const perto = veiculos.find((v) => v.id !== token.id && isNearVehicle(map, v, token))
    if (perto !== undefined) return { tipo: 'subir', tokenId: token.id, vehicleId: perto.id }
  }
  return null
}

/**
 * VEÍCULO — na coluna das ações do lugar (`.pp-lugar`, com a escada e o
 * "Espiar"). A pé e encostado num veículo: "Subir". A bordo: o rótulo "No
 * veículo · motorista" (ou só "No veículo") e o "Descer". Tocar manda o pedido
 * e o botão espera ("Subindo…"/"Descendo…") até o snapshot mudar a oferta ou
 * até `VEICULO_PENDENTE_MAX_MS`.
 */
export function PlayerVeiculo({ map, ownTokens, paused, turn, confronto, onSubir, onDescer, aviso }: PlayerVeiculoProps) {
  const oferta = useMemo(() => ofertaDoVeiculo(map, ownTokens, paused, { turn, confronto }), [map, ownTokens, paused, turn, confronto])
  const chave = oferta === null ? null : `${oferta.tipo}|${oferta.tokenId}|${oferta.tipo === 'subir' ? oferta.vehicleId : ''}`
  const [pendente, setPendente] = useState<string | null>(null)

  // A oferta mudou (subiu, desceu, saiu de perto) ou veio a recusa: o pedido acabou, respondido ou não.
  useEffect(() => {
    setPendente(null)
  }, [chave, aviso])

  useEffect(() => {
    if (pendente === null) return
    const timer = setTimeout(() => setPendente(null), VEICULO_PENDENTE_MAX_MS)
    return () => clearTimeout(timer)
  }, [pendente])

  if (oferta === null) return null
  const esperando = pendente !== null && pendente === chave

  if (oferta.tipo === 'subir') {
    return (
      <div className="pp-veiculo">
        <button
          type="button"
          className="pp-escada__button"
          aria-disabled={esperando}
          aria-label={esperando ? undefined : 'Subir no veículo'}
          onClick={() => {
            if (esperando) return
            setPendente(chave)
            onSubir(oferta.tokenId, oferta.vehicleId)
          }}
        >
          {esperando ? (
            'Subindo…'
          ) : (
            <>
              Subir
              <span className="pp-rotulo-resto"> no veículo</span>
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="pp-veiculo">
      <span className="pp-veiculo__rotulo" role="status">
        {oferta.motorista ? 'No veículo · motorista' : 'No veículo'}
      </span>
      {oferta.podeDescer && (
        <button
          type="button"
          className="pp-escada__button"
          aria-disabled={esperando}
          aria-label={esperando ? undefined : 'Descer do veículo'}
          onClick={() => {
            if (esperando) return
            setPendente(chave)
            onDescer(oferta.tokenId)
          }}
        >
          {esperando ? (
            'Descendo…'
          ) : (
            <>
              Descer
              <span className="pp-rotulo-resto"> do veículo</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
