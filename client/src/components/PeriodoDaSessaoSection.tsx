import { useId } from 'react'
import type { Periodo } from '../types/map'
import { PERIODOS } from '../lib/periodo'
import { Toggle } from './Toggle'

export interface PeriodoDaSessaoSectionProps {
  /** O período da sessão (o da aventura; no mapa solto, o da sessão). */
  periodo: Periodo
  /** A cena ABERTA é externa: segue o período da sessão. */
  externa: boolean
  /** A cena ABERTA fica sempre num período (`MapData.periodoFixo`); ausente = segue a regra. */
  periodoFixo?: Periodo
  onPeriodoChange(periodo: Periodo): void
  onExternaChange(externa: boolean): void
}

export const PERIODO_LABEL: Readonly<Record<Periodo, string>> = { dia: 'Dia', tarde: 'Tarde', noite: 'Noite' }

/** "de dia", "à tarde", "à noite": como a frase do estado da cena diz o período. */
const PERIODO_NA_FRASE: Readonly<Record<Periodo, string>> = { dia: 'de dia', tarde: 'à tarde', noite: 'à noite' }

export const PERIODO_HINT = 'Vale para as cenas externas. As outras cenas não mudam.'

/** O que a cena ABERTA mostra aos jogadores agora, em uma frase. */
export function estadoDaCenaAberta(periodo: Periodo, externa: boolean, periodoFixo: Periodo | undefined): string {
  if (periodoFixo !== undefined) return `Esta cena fica sempre ${PERIODO_NA_FRASE[periodoFixo]}.`
  if (externa) return `Esta cena segue o período: agora está ${PERIODO_NA_FRASE[periodo]}.`
  return 'Esta cena é interior: fica sempre de dia.'
}

/**
 * DIA/TARDE/NOITE na aba Grupo do mestre: o período da sessão em três botões
 * (rádios de botão, o mesmo segmentado do resto do painel; o marcado acende em
 * latão) e a marca de cena externa da cena ABERTA, com a frase do que ela
 * mostra agora. O período é um só para a aventura inteira; a marca é de cada
 * cena. Cena sem marca é interior e ignora a troca (decisão D1 do plano).
 */
export function PeriodoDaSessaoSection({ periodo, externa, periodoFixo, onPeriodoChange, onExternaChange }: PeriodoDaSessaoSectionProps) {
  const headingId = useId()
  const hintId = useId()
  const estadoId = useId()
  return (
    <section className="lb-periodo" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Período
      </h3>
      <div className="lb-seg" role="radiogroup" aria-labelledby={headingId} aria-describedby={hintId}>
        {PERIODOS.map((opcao) => (
          <button key={opcao} type="button" role="radio" aria-checked={periodo === opcao} className="lb-seg__option" onClick={() => onPeriodoChange(opcao)}>
            {PERIODO_LABEL[opcao]}
          </button>
        ))}
      </div>
      <p id={hintId} className="lb-field__hint">
        {PERIODO_HINT}
      </p>
      <div className="lb-field">
        <Toggle label="Cena externa" checked={externa} describedBy={estadoId} onChange={onExternaChange} />
        {/* `status`: trocar o período ou a marca muda a frase, e o leitor de tela a lê sem roubar o foco. */}
        <p id={estadoId} className="lb-field__hint lb-periodo__estado" role="status">
          {estadoDaCenaAberta(periodo, externa, periodoFixo)}
        </p>
      </div>
    </section>
  )
}
