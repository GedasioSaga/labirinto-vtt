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

/**
 * Escolha do ícone do ponto de interesse — baú, armadilha, chave, perigo,
 * escada e água. É o que separa dois marcadores no mapa sem o mestre ter de
 * abrir cada um para lembrar qual é qual.
 *
 * Mesmo par de estados de `PinControls` e `DoorKindControls`: com um pino
 * aberto, muda ESSE pino (com histórico); sem nenhum, guarda a preferência do
 * próximo. Quem decide a fonte é o chamador — este componente só mostra.
 *
 * FICA ANTES de `PinControls` no painel, e não depois, porque o último botão
 * daquela seção é "Excluir ponto de interesse": ação destrutiva no MEIO da
 * coluna é armadilha para quem só queria trocar o ícone.
 *
 * O título não diz "pino" nem "marcador" de propósito: "Ponto de interesse" já
 * é o título do bloco vizinho, e dois cabeçalhos com o mesmo nome no mesmo
 * painel confundem quem lê por leitor de tela.
 */
export function PinIconControls({ icon, onIconChange, pinSelected }: PinIconControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Ícone no mapa</h2>
      <div className="lb-seg lb-seg--grid" role="radiogroup" aria-label="Ícone do ponto de interesse">
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
          ? 'Sem ícone, o pino desenha o "!" ou o "?" do tipo.'
          : 'Vale para o próximo ponto de interesse que você cravar.'}
      </span>
    </section>
  )
}
