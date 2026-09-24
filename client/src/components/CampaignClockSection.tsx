import { useId } from 'react'
import { formatHour, isDarkAt, PERIOD_LABEL, periodOfHour } from '../lib/campaignClock'
import { Toggle } from './Toggle'

export interface CampaignClockSectionProps {
  /** A hora do relógio da campanha, 0 a 23. */
  hour: number
  /** A cena ABERTA é externa (escurece à noite). */
  outdoor: boolean
  onAdvanceHour(): void
  onNextPeriod(): void
  onOutdoorChange(outdoor: boolean): void
}

export const OUTDOOR_HINT = 'À noite, os jogadores nesta cena enxergam menos.'
export const DARK_NOW_TEXT = 'Esta cena está escura agora.'

/**
 * RELÓGIO DA CAMPANHA, na aba Jogo: a hora (08:00) e o período (Manhã) que os
 * jogadores leem, "+1 hora" e "Próximo período" para o tempo andar, e a marca
 * de cena externa da cena ABERTA — é ela que escurece à noite. O relógio é um
 * só para a aventura inteira; a marca é de cada cena.
 */
export function CampaignClockSection({ hour, outdoor, onAdvanceHour, onNextPeriod, onOutdoorChange }: CampaignClockSectionProps) {
  const headingId = useId()
  const hintId = useId()
  const dark = isDarkAt(hour, outdoor ? { externa: true } : {})
  return (
    <section className="lb-clock" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Relógio da campanha
      </h3>
      <p className="lb-clock__now">
        <strong className="lb-clock__hour lb-num">{formatHour(hour)}</strong>
        {/* Espaço no texto: sem ele leitor de tela e busca leem "08:00Manhã". Em flex ele não ocupa lugar. */}{' '}
        <span className="lb-clock__period">{PERIOD_LABEL[periodOfHour(hour)]}</span>
      </p>
      <div className="lb-clock__actions">
        <button type="button" className="lb-btn lb-btn--primary" onClick={onAdvanceHour}>
          +1 hora
        </button>
        <button type="button" className="lb-btn" onClick={onNextPeriod}>
          Próximo período
        </button>
      </div>
      <div className="lb-field">
        <Toggle label="Cena externa" checked={outdoor} describedBy={hintId} onChange={onOutdoorChange} />
        <p id={hintId} className="lb-field__hint">
          {OUTDOOR_HINT}
        </p>
        {dark && <p className="lb-clock__dark">{DARK_NOW_TEXT}</p>}
      </div>
    </section>
  )
}
