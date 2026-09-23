import { TOKEN_COLOR_OPTIONS, tokenColorName } from '../lib/tokenColor'

export interface TokenColorControlsProps {
  /** Cor marcada, em `#rrggbb` minúsculo; `null` = cor de fábrica. */
  color: string | null
  /** `null` devolve o token à cor de fábrica. */
  onColorChange: (color: string | null) => void
}

/**
 * Cor da ficha selecionada — o que separa aliado de inimigo quando há oito
 * discos iguais no meio da luta. Um punhado pequeno de cores chapadas, não um
 * seletor de milhões de tons: o gesto é "este é inimigo", um clique, e não
 * "procure um vermelho".
 *
 * Mesma pastilha em grade de `PinIconControls` (`lb-seg--grid`, `role="radio"`
 * dentro de um `radiogroup`): é o padrão da casa para escolha entre poucas
 * opções com amostra visual, e já vem com alvo de toque, estado marcado e
 * navegação por teclado do `.lb-seg__option`.
 *
 * O NOME ACESSÍVEL carrega o papel junto do rótulo ("Verde — aliado") enquanto
 * o texto visível fica curto ("Verde") para caber nas três colunas do rail.
 * O visível continua contido no acessível, então comando de voz e leitor de
 * tela concordam com o que está escrito na tela.
 */
export function TokenColorControls({ color, onColorChange }: TokenColorControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Cor da ficha</h2>
      <div className="lb-seg lb-seg--grid" role="radiogroup" aria-label="Cor da ficha">
        {TOKEN_COLOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={color === option.value}
            aria-label={tokenColorName(option)}
            className="lb-seg__option"
            onClick={() => onColorChange(option.value)}
          >
            {/* Amostra chapada, sem degradê nem brilho: é a mesma tinta que
                sai no mapa. `aria-hidden` porque o nome da cor já está no
                nome acessível do botão — anunciar duas vezes atrapalha. */}
            <svg className="lb-token-color__chip" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="9" r="8" fill={option.value} stroke="#1a1a1a" strokeWidth="1" />
            </svg>
            {option.label}
          </button>
        ))}
      </div>
      {/* Só aparece quando há o que desfazer — mesma regra do "Sem ícone" de
          `PinIconControls`. Sem cor escolhida o botão não mudaria nada. */}
      {color !== null && (
        <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onColorChange(null)}>
          Cor padrão
        </button>
      )}
    </section>
  )
}
