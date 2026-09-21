import { TOKEN_SIZE_OPTIONS } from '../lib/tokenSize'

export interface TokenSizeControlsProps {
  /** Lado marcado, em quadrados; `null` = a ficha está num tamanho que não é
   *  nenhum dos três (esticada pela alça de canto). */
  size: number | null
  onSizeChange: (size: number) => void
}

/** Lado da célula na arte, em unidades do viewBox 18×18 — três células. */
const CELULA = 6

/**
 * Miniatura do que cada escolha faz: a mesma grade fina do minimapa, com o
 * disco da ficha por cima ocupando `cells` células. É o desenho que responde
 * "2 quadrados é quanto?" sem precisar de legenda.
 *
 * `aria-hidden`: o nome acessível do botão já diz "2 quadrados", e anunciar a
 * arte de novo só atrapalharia — mesma regra da amostra de cor
 * (`TokenColorControls`).
 */
function TokenSizeArt({ cells }: { cells: number }) {
  const meio = (CELULA * 3) / 2
  // -1 para o disco não encostar na borda da miniatura, o mesmo respiro que o
  // token de verdade tem no mapa (`radius = gridSize * size / 2 - 2`).
  const raio = (CELULA * cells) / 2 - 1
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.4">
        <rect x="0.375" y="0.375" width="17.25" height="17.25" />
        <path d={`M${CELULA} 0V18M${CELULA * 2} 0V18M0 ${CELULA}H18M0 ${CELULA * 2}H18`} />
      </g>
      <circle cx={meio} cy={meio} r={raio} fill="currentColor" />
    </svg>
  )
}

/**
 * Tamanho da ficha EM QUADRADOS DA GRADE — para o dragão não ficar do tamanho
 * do rato. O campo `Token.size` já existia e o desenho já o obedecia
 * (`pixi/tokensRenderer.ts`); o que faltava era um jeito de dizer o número, em
 * vez de puxar a alça de canto no olhômetro.
 *
 * Mesma pastilha `lb-seg` do "Sentido da escada" (`StairControls`): três
 * opções numa fila só, `role="radio"` dentro de um `radiogroup`, com alvo de
 * toque, estado marcado e navegação por teclado já prontos.
 *
 * O texto visível é só o número, e o nome acessível é "2 quadrados": o visível
 * continua contido no acessível, então leitor de tela e comando de voz
 * concordam com o que está escrito na tela.
 */
export function TokenSizeControls({ size, onSizeChange }: TokenSizeControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Tamanho da ficha</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Tamanho da ficha">
        {TOKEN_SIZE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={size === option.value}
            aria-label={option.label}
            className="lb-seg__option"
            onClick={() => onSizeChange(option.value)}
          >
            <TokenSizeArt cells={option.value} />
            {option.value}
          </button>
        ))}
      </div>
    </section>
  )
}
