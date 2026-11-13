import { selectedTokenSize, TOKEN_SIZE_OPTIONS } from '../lib/tokenSize'
import { CampoDoTamanho } from './CampoDoTamanho'

export interface TokenSizeControlsProps {
  /** Lado da ficha, em casas, com o de fábrica já resolvido (`tokenSizeInSquares`): 1,5 digitado, 1,37 da alça de canto. */
  size: number
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
 * (`TokenColorControls`). Exportada para o "Tamanho da ficha ao entrar" da
 * cena (`SceneTokenSizeControls`), que oferece os mesmos atalhos.
 */
export function TokenSizeArt({ cells }: { cells: number }) {
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
 * Tamanho da ficha EM CASAS DA GRADE — para o dragão não ficar do tamanho do
 * rato. O campo `Token.size` já existia e o desenho já o obedecia
 * (`pixi/tokensRenderer.ts`); o que faltava era um jeito de dizer o número, em
 * vez de puxar a alça de canto no olhômetro.
 *
 * Em cima, o campo (`CampoDoTamanho`, pedido de 12/11/2026): o número que o
 * mestre digita, 0,5 ou 1,5 também, com − e + de 0,1 casa — o mesmo do
 * "Tamanho da ficha ao entrar" da cena. Embaixo, os atalhos 1, 2 e 3 com a
 * arte da grade, na pastilha `lb-seg` de sempre (`role="radio"` num
 * `radiogroup`); ao lado do campo não cabem sem apertar a largura do rail.
 * Lado que não é atalho (1,5) deixa nenhum marcado, e o campo diz o número.
 *
 * O texto visível do atalho é só o número, e o nome acessível é "2 casas": o
 * visível continua contido no acessível, então leitor de tela e comando de
 * voz concordam com o que está escrito na tela.
 *
 * Quem usa remonta isto a cada ficha (`key`): o número digitado e não
 * confirmado não passa para a ficha seguinte.
 */
export function TokenSizeControls({ size, onSizeChange }: TokenSizeControlsProps) {
  const atalhoMarcado = selectedTokenSize({ size })
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Tamanho da ficha</h2>
      <CampoDoTamanho casas={size} onTrocar={onSizeChange} rotulo="Tamanho da ficha em casas" nomeDoPasso="o tamanho da ficha" />
      <div className="lb-seg" role="radiogroup" aria-label="Tamanho da ficha">
        {TOKEN_SIZE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={atalhoMarcado === option.value}
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
