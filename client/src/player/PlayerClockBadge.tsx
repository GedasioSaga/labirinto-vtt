import { PERIOD_LABEL, type PlayerClock } from '../lib/campaignClock'

/** O que o jogador lê quando a cena dele está escura (externa, à noite). */
export const DARK_HINT_TEXT = 'pouca luz'

interface PlayerClockBadgeProps {
  /** O relógio como o mestre mandou (só o período e o escuro). Ausente = mestre sem relógio. */
  relogio: PlayerClock | undefined
}

/**
 * RELÓGIO DA CAMPANHA na tela do jogador: a hora aproximada (Manhã, Tarde,
 * Noite) num selo pequeno no canto, e "pouca luz" quando a cena dele está
 * escura — é por isso que ele enxerga menos. Por cima do mapa e fora do fluxo
 * (`position: fixed`): não mexe no canvas. `note` e não `status`: a hora muda
 * pouco e não é aviso, então não interrompe o leitor de tela; o nome diz o
 * que o selo é ("Hora do dia"), que o texto curto sozinho não diz.
 */
export function PlayerClockBadge({ relogio }: PlayerClockBadgeProps) {
  if (relogio === undefined) return null
  const label = PERIOD_LABEL[relogio.periodo]
  const dark = relogio.escuro === true
  return (
    <p className={dark ? 'pp-clock pp-clock--escuro' : 'pp-clock'} role="note" aria-label={dark ? `Hora do dia: ${label}. ${DARK_HINT_TEXT}` : `Hora do dia: ${label}`}>
      {dark ? `${label} · ${DARK_HINT_TEXT}` : label}
    </p>
  )
}
