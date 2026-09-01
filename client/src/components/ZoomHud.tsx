import { MAX_SCALE, MIN_SCALE } from '../pixi/world'
import './ZoomHud.css'

interface ZoomHudProps {
  /** Escala atual da câmera do canvas — 1 é 100%, mesma unidade de `Camera.scale` em `pixi/world.ts`. */
  scale: number
  /** Chamado ao clicar no HUD. O integrador decide como voltar a 100% (recentrar ou não). */
  onReset: () => void
}

// Folga contra imprecisão de ponto flutuante vinda do gesto de zoom
// (`zoomAt` em `pixi/world.ts` multiplica por `Math.exp(...)`), não da
// própria `clampScale` — o clamp em si devolve o literal exato de
// `MIN_SCALE`/`MAX_SCALE` quando corta.
const LIMIT_EPSILON = 1e-6

/**
 * Indicador discreto de zoom, fixo no canto do canvas. Mostra a porcentagem
 * atual da câmera e volta a 100% ao clicar.
 *
 * Hoje não existe nenhuma leitura do estado da câmera: quando a roda do
 * mouse "morre" nos limites de `pixi/world.ts` (10%/400%), o usuário não tem
 * como saber se travou ou se é o fim da faixa. Este HUD fecha esse laço.
 *
 * Nome acessível: formato fixo e previsível `Zoom: {percentual}%`, com sufixo
 * também fixo quando no limite (` — zoom mínimo` / ` — zoom máximo`) — uma
 * função determinística de `scale`, para casar com o padrão de e2e do
 * projeto (`getByRole('button', { name, exact: true })`). O estado de limite
 * também aparece como texto visível ("MÍN"/"MÁX"), não só como cor — ver
 * `ZoomHud.css`.
 */
export function ZoomHud({ scale, onReset }: ZoomHudProps) {
  const percent = Math.round(scale * 100)
  const atMin = scale <= MIN_SCALE + LIMIT_EPSILON
  const atMax = scale >= MAX_SCALE - LIMIT_EPSILON
  const atLimit = atMin || atMax
  const limitSuffix = atMin ? ' — zoom mínimo' : atMax ? ' — zoom máximo' : ''

  return (
    <button
      type="button"
      className={`lb-panel lb-zoomhud${atLimit ? ' lb-zoomhud--limit' : ''}`}
      onClick={onReset}
      title="Clique para redefinir o zoom para 100%"
      aria-label={`Zoom: ${percent}%${limitSuffix}`}
    >
      <span className="lb-zoomhud__value lb-num" aria-hidden="true">
        {percent}%
      </span>
      {atLimit && (
        <span className="lb-zoomhud__limit-mark" aria-hidden="true">
          {atMin ? 'MÍN' : 'MÁX'}
        </span>
      )}
    </button>
  )
}
