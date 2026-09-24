import { colecaoNomesDaCena } from '../lib/colecao'
import { pinClueForPlayer } from '../lib/fogFilter'
import { useMapStore } from '../stores/mapStore'
import type { Pin } from '../types/map'
import type { PinColecaoControlsProps } from './PinColecaoControls'

/**
 * COLEÇÃO DE PISTAS no painel do pino aberto: o que `App.tsx` entrega ao
 * `PinControls`. A peça e a frase inteira ficam neste mapa; o host manda ao
 * jogador só o progresso dele.
 *
 * `temCartao` usa a MESMA regra do host (`pinClueForPlayer`): pino sem texto e
 * sem foto que o jogador receba não vira pista, então a peça nunca soma.
 */
export function pinColecaoPanel(pin: Pin, pins: readonly Pin[]): PinColecaoControlsProps {
  return {
    colecao: pin.colecao ?? null,
    onChange: (colecao) => useMapStore.getState().updatePin(pin.id, { colecao }),
    nomes: colecaoNomesDaCena(pins),
    temCartao: pinClueForPlayer(pin) !== null,
  }
}
