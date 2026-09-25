import type { MarcaNoLugar } from '../types/map'
import { PlayerNoteCard } from './PlayerNoteCard'

export interface PlayerMarkCardProps {
  /** As marcas que o recorte trouxe ao jogador (`map.marcas`). Ausente = nenhuma. */
  marcas: readonly MarcaNoLugar[] | undefined
  /** O bilhete que o jogador tocou no mapa (`onMarkOpen` da PlayerView); `null` = nenhum. */
  openMarkId: string | null
  /** Recado do mestre ou texto de Sala na tela: um cartão de cada vez no mesmo lugar, o bilhete espera. */
  aguardando: boolean
  onClose(): void
  escapeCloses: boolean
}

/**
 * O bilhete aberto, se ainda está no recorte: o mestre pode tê-lo apagado com
 * o cartão aberto, e aí o cartão some junto, como o do pino. A seta não tem o
 * que ler e nunca abre.
 */
export function bilheteAberto(marcas: readonly MarcaNoLugar[] | undefined, openMarkId: string | null): MarcaNoLugar | null {
  if (openMarkId === null) return null
  return (marcas ?? []).find((m) => m.id === openMarkId && m.tipo === 'bilhete') ?? null
}

/** BILHETE NO LUGAR: o bilhete tocado no mapa, no mesmo cartão do recado do mestre. */
export function PlayerMarkCard({ marcas, openMarkId, aguardando, onClose, escapeCloses }: PlayerMarkCardProps) {
  const marca = bilheteAberto(marcas, openMarkId)
  if (marca === null || aguardando) return null
  return <PlayerNoteCard key={marca.id} title="Bilhete deixado aqui" text={marca.texto ?? ''} onClose={onClose} escapeCloses={escapeCloses} />
}
