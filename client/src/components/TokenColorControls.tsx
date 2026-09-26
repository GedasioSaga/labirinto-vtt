import { TOKEN_COLOR_OPTIONS, tokenColorName } from '../lib/tokenColor'
import './TokenControls.css'

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
 * UMA linha (peça P4 do laudo do painel): "Cor" à esquerda e as seis amostras
 * à direita, como a linha "Background" do painel do Figma UI3 — sem bloco nem
 * título, e as seis juntas no olho. A amostra é só o disco da tinta que sai
 * no mapa; a marcada ganha um aro de latão (TokenControls.css).
 *
 * `role="radio"` dentro de um `radiogroup` chamado "Cor da ficha" (o nome que
 * a jornada `condicao-na-ficha` procura). O NOME ACESSÍVEL carrega o papel
 * junto do rótulo ("Verde — aliado"); sem texto na amostra, o mesmo nome
 * aparece no `title` ao pairar, como nas setas de "Para onde olha"
 * (`TokenWatchControls`).
 */
export function TokenColorControls({ color, onColorChange }: TokenColorControlsProps) {
  return (
    <section className="lb-section lb-token-linha">
      <div className="lb-token-par">
        <span className="lb-label" aria-hidden="true">
          Cor
        </span>
        <div className="lb-token-cores" role="radiogroup" aria-label="Cor da ficha">
          {TOKEN_COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={color === option.value}
              aria-label={tokenColorName(option)}
              title={tokenColorName(option)}
              className="lb-token-cor"
              onClick={() => onColorChange(option.value)}
            >
              {/* Amostra chapada, sem degradê nem brilho: é a mesma tinta que
                  sai no mapa. `aria-hidden` porque o nome da cor já está no
                  nome acessível do botão — anunciar duas vezes atrapalha. */}
              <svg className="lb-token-cor__disco" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <circle cx="10" cy="10" r="9.5" fill={option.value} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      {/* Só aparece quando há o que desfazer — mesma regra do "Sem ícone" de
          `PinIconControls`. Sem cor escolhida o botão não mudaria nada. */}
      {color !== null && (
        <button type="button" className="lb-btn lb-btn--ghost lb-token-cor__padrao" onClick={() => onColorChange(null)}>
          Cor padrão
        </button>
      )}
    </section>
  )
}
