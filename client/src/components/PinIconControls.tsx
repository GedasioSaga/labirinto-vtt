import { useId } from 'react'
import type { PinIcon } from '../types/map'
import { PIN_ICON_LABELS, PIN_ICON_ORDER } from '../lib/pins'
import { PinSymbolArt } from './PinSymbolArt'

export interface PinIconControlsProps {
  /** `null` = sem ícone: o pino desenha o glifo do tipo, que é a cara de hoje. */
  icon: PinIcon | null
  onIconChange: (icon: PinIcon | null) => void
  /**
   * Há um pino aberto no painel. `false` = a escolha é a preferência do
   * PRÓXIMO pino, e a linha de apoio precisa dizer isso — senão o controle
   * parece não ter feito nada.
   */
  pinSelected: boolean
}

interface PinIconFieldProps extends PinIconControlsProps {
  /** O glifo do tipo escolhido ("!" ou "?"): é ele que o ícone substitui. */
  glyph: string
}

/**
 * Escolha do ícone do ponto de interesse — baú, armadilha, chave, perigo,
 * escada e água. É o que separa dois marcadores no mapa sem o mestre ter de
 * abrir cada um para lembrar qual é qual.
 *
 * Mesmo par de estados de `PinControls` e `DoorKindControls`: com um pino
 * aberto, muda ESSE pino (com histórico); sem nenhum, guarda a preferência do
 * próximo. Quem decide a fonte é o chamador — este componente só mostra.
 *
 * É um CAMPO do bloco "Ponto de interesse" (`PinControls`), logo abaixo do
 * tipo, e não uma seção com título próprio: tipo e ícone são a mesma pergunta
 * ("o que aparece na cabeça do pino?"). Em duas seções o mestre não via que o
 * ícone toma o lugar do "!"/"?" — a linha de apoio diz isso com o glifo do tipo
 * escolhido.
 */
export function PinIconControls({ icon, onIconChange, pinSelected, glyph }: PinIconFieldProps) {
  const rotuloId = useId()
  return (
    <div className="lb-field">
      <span id={rotuloId} className="lb-label">
        Ícone no mapa
      </span>
      <div className="lb-seg lb-seg--grid" role="radiogroup" aria-labelledby={rotuloId}>
        {PIN_ICON_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={icon === option}
            className="lb-seg__option"
            onClick={() => onIconChange(option)}
          >
            <PinSymbolArt icon={option} />
            {PIN_ICON_LABELS[option]}
          </button>
        ))}
      </div>
      {/* Só aparece quando há o que remover — mesma regra do "Remover imagem"
          de `PinControls`. Sem ícone escolhido, o botão não teria efeito. */}
      {icon !== null && (
        <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onIconChange(null)}>
          Sem ícone
        </button>
      )}
      <span className="lb-label">
        {pinSelected
          ? `O ícone aparece no lugar do "${glyph}" — no mapa e no cartão do jogador.`
          : 'Vale para o próximo ponto de interesse que você cravar.'}
      </span>
    </div>
  )
}
