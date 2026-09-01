import type { Region } from '../types/map'
import { Toggle } from './Toggle'

/**
 * Junção do vértice do contorno da região — só os 2 valores que o usuário
 * pediu por nome ("arredondados ou retos"), nunca um 3º inventado (ex.:
 * `'bevel'`, que o Pixi também suporta mas ninguém pediu). Tipo dono deste
 * arquivo, não importado de `pixi/drawRegions.ts` — mesmo padrão já usado no
 * repo entre `lib/brushTexture.ts` (`BrushTexture`) e `types/map.ts`
 * (`FreehandTexture`): dois tipos estruturalmente iguais, declarados em
 * módulos diferentes, pra não acoplar um componente de UI ao módulo de
 * render (que importa `pixi.js` de verdade). Ver CONTRATO no relatório do
 * agente para o campo equivalente que o integrador adiciona em
 * `types/map.ts` (`Region.strokeJoin`, sugerido).
 */
export type RegionStrokeJoin = 'round' | 'miter'

/** Nome curado dos 3 pontos da escala de espessura — mesmo eixo que
 *  `Region.strokeWidth` (sugerido no CONTRATO), só a apresentação em preset.
 *  Nunca um 4º inventado. */
export type RegionStrokePreset = 'thin' | 'medium' | 'thick'

/**
 * `strokeWidth` (px de mundo) de cada preset nomeado — pedido literal do
 * usuário: "poligono finos ou medios ou gordos", pensado pro caso de uso que
 * ele deu (rua/construção artesanal desenhada com a ferramenta Polígono).
 * Valores absolutos, não relativos a `grid` (ao contrário de
 * `StairSizePreset`/`lib/stairs.ts`) — o contorno de uma região não precisa
 * escalar com o tamanho da célula, escala com o quanto o usuário quer
 * destacar a borda. `medium` (4) bate com `WALL_WIDTH.exterior`
 * (`pixi/drawWalls.ts`) — mesmo peso visual de uma parede padrão, então uma
 * "sala" desenhada por Polígono com espessura média combina com as paredes
 * de verdade ao lado. `thin` (1) é o pedido explícito "extremamente fino".
 * `thick` (12) cobre contorno de rua/construção grossa sem estourar o teto
 * do slider de ajuste fino (`REGION_STROKE_WIDTH_MAX`).
 */
export const REGION_STROKE_WIDTH_BY_PRESET: Record<RegionStrokePreset, number> = {
  thin: 1,
  medium: 4,
  thick: 12,
}

/** Mesma escala 1–20 que `DrawingStyleControls.tsx` usa pro slider de
 *  espessura de desenho — um único range de "fino a grosso" no app inteiro,
 *  em vez de cada painel inventar o próprio teto. */
export const REGION_STROKE_WIDTH_MIN = 1
export const REGION_STROKE_WIDTH_MAX = 20

const STROKE_PRESET_ORDER: RegionStrokePreset[] = ['thin', 'medium', 'thick']

const STROKE_PRESET_LABELS: Record<RegionStrokePreset, string> = {
  thin: 'Fino',
  medium: 'Médio',
  thick: 'Grosso',
}

const JOIN_OPTIONS: Array<{ value: RegionStrokeJoin; label: string }> = [
  { value: 'round', label: 'Arredondado' },
  { value: 'miter', label: 'Reto' },
]

/**
 * Preset cujo valor bate exatamente com `strokeWidth` — só para destacar o
 * botão ativo (`aria-checked`), mesmo critério de
 * `stairSizePresetForStepWidth` (`lib/stairs.ts`): nunca usado para decidir o
 * que gravar (o slider de ajuste fino sempre grava o valor exato movido, sem
 * arredondar pro preset mais próximo). `undefined` quando o valor atual não
 * bate com nenhum preset — nenhum botão fica marcado, que é o estado
 * correto.
 */
export function regionStrokePresetForWidth(strokeWidth: number): RegionStrokePreset | undefined {
  // `Object.entries` sempre tipa a chave como `string` (mesmo vindo de um
  // `Record` com union de chaves fechada) — nunca `RegionStrokePreset[]`. O
  // cast é seguro porque as chaves de `REGION_STROKE_WIDTH_BY_PRESET` SÃO
  // exatamente essa união (o `Record<RegionStrokePreset, number>` acima
  // garante, em tempo de compilação, que não falta nem sobra nenhuma) —
  // mesmo padrão já usado em `lib/stairs.ts` (`stairSizePresetForStepWidth`).
  const entries = Object.entries(REGION_STROKE_WIDTH_BY_PRESET) as Array<[RegionStrokePreset, number]>
  return entries.find(([, width]) => width === strokeWidth)?.[0]
}

export interface RegionStyleControlsProps {
  color: string
  onColorChange: (color: string) => void
  pattern: Region['fillPattern']
  onPatternChange: (pattern: Region['fillPattern']) => void
  /**
   * Espessura do contorno, em px de mundo (`Region.strokeWidth`, sugerido no
   * CONTRATO). Presets fino/médio/grosso (`REGION_STROKE_WIDTH_BY_PRESET`)
   * + slider de ajuste fino — mesmo padrão de dois controles pro mesmo eixo
   * que `StairControls` já usa pra `stepWidth` (3 botões nomeados + campo
   * numérico). Mesma dualidade de fonte que `color`/`pattern` acima: o
   * chamador liga na preferência da PRÓXIMA região OU na região JÁ
   * SELECIONADA — este componente só apresenta o controle.
   *
   * OPCIONAL — junto com `onStrokeWidthChange` — DE PROPÓSITO, ao contrário
   * de `color`/`pattern`: campo novo desta rodada, `Region.strokeWidth`
   * ainda não existe em `types/map.ts` (arquivo do integrador). Deixar
   * obrigatório quebraria a compilação de `App.tsx` (fora do meu escopo)
   * até o integrador colar o trecho do CONTRATO — mesmo padrão já usado
   * neste arquivo por `onLinkWalls`/`onSmoothRegion` (ambos opcionais,
   * seção só aparece quando o chamador manda o par). Ausente = seção não
   * renderiza (nenhuma UI pela metade).
   */
  strokeWidth?: number
  onStrokeWidthChange?: (strokeWidth: number) => void
  /**
   * Acabamento do VÉRTICE do contorno (`Region.strokeJoin`, sugerido no
   * CONTRATO) — `'round'` arredonda o canto, `'miter'` mantém o canto
   * anguloso. Rotulado "Cantos do contorno" (não "Ponta da linha", que já é
   * o nome de `LineCapControls`) DE PROPÓSITO: o contorno de uma Região é
   * sempre um polígono FECHADO (`g.closePath()` em `pixi/drawRegions.ts`),
   * então não existe ponta solta — confirmado lendo
   * `node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/
   * buildLine.js:127,332`, o `cap` só entra no cálculo `if (!closedShape)`.
   * Arredondado-vs-reto num polígono fechado é sempre JOIN, nunca CAP — por
   * isso não existe `strokeCap` aqui: seria um controle fantasma, sem
   * nenhum efeito visual (regra 10, "sem código morto"). O rótulo abaixo do
   * segmented control explica essa distinção pro usuário não escolher
   * "Reto" esperando afetar uma ponta que este contorno nunca tem.
   *
   * OPCIONAL junto com `onStrokeJoinChange`, mesmo motivo de `strokeWidth`
   * acima — campo novo, ainda não existe em `types/map.ts`.
   */
  strokeJoin?: RegionStrokeJoin
  onStrokeJoinChange?: (strokeJoin: RegionStrokeJoin) => void
  /**
   * Presente só quando há uma Região selecionada (`selection?.kind === 'region'`)
   * — o chamador decide isso. Preenche as arestas da região sem parede ainda
   * (Regiao solta, ou Sala que perdeu parede apagada) com um clique.
   */
  onLinkWalls?: () => void
  /**
   * Presente só quando há uma Região selecionada — simplifica o contorno
   * (Douglas-Peucker) e arredonda os cantos restantes (Chaikin), transformando
   * um contorno serrilhado/pixelado (ex.: extraído de imagem) numa curva limpa.
   */
  onSmoothRegion?: () => void
}

/**
 * Cor, padrão de preenchimento e — desde a rodada F4 (pedido literal do
 * usuário sobre desenhar rua/construção artesanal com a ferramenta Polígono)
 * — espessura e acabamento de canto do contorno da região: antes de desenhar
 * (liga em `regionFillColor`/`regionFillPattern`/preferência equivalente de
 * `strokeWidth`/`strokeJoin`) ou editando a região já selecionada (liga nas
 * actions `withHistory` de edição) — o chamador decide qual fonte usar, este
 * componente só mostra os controles.
 */
export function RegionStyleControls({
  color,
  onColorChange,
  pattern,
  onPatternChange,
  strokeWidth,
  onStrokeWidthChange,
  strokeJoin,
  onStrokeJoinChange,
  onLinkWalls,
  onSmoothRegion,
}: RegionStyleControlsProps) {
  const showStrokeWidth = strokeWidth !== undefined && onStrokeWidthChange !== undefined
  const showStrokeJoin = strokeJoin !== undefined && onStrokeJoinChange !== undefined
  const activeStrokePreset = strokeWidth !== undefined ? regionStrokePresetForWidth(strokeWidth) : undefined

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Região</h2>
      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-region-color">
          Cor
        </label>
        <input
          id="lb-region-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>
      <Toggle
        label="Hachurado"
        checked={pattern === 'hatch'}
        onChange={(checked) => onPatternChange(checked ? 'hatch' : 'solid')}
      />

      {showStrokeWidth && (
        <div className="lb-field">
          <span className="lb-label">Espessura do contorno</span>
          <div className="lb-seg" role="radiogroup" aria-label="Espessura do contorno">
            {STROKE_PRESET_ORDER.map((preset) => (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={activeStrokePreset === preset}
                className="lb-seg__option"
                onClick={() => onStrokeWidthChange?.(REGION_STROKE_WIDTH_BY_PRESET[preset])}
              >
                {STROKE_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>
      )}
      {showStrokeWidth && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-region-strokewidth">
              Ajuste fino
            </label>
            <span className="lb-num">{strokeWidth} px</span>
          </div>
          <input
            id="lb-region-strokewidth"
            className="lb-range"
            type="range"
            min={REGION_STROKE_WIDTH_MIN}
            max={REGION_STROKE_WIDTH_MAX}
            step={1}
            value={strokeWidth}
            onChange={(event) => onStrokeWidthChange?.(Number(event.target.value))}
          />
        </div>
      )}

      {showStrokeJoin && (
        <div className="lb-field">
          <span className="lb-label">Cantos do contorno</span>
          <div className="lb-seg" role="radiogroup" aria-label="Cantos do contorno">
            {JOIN_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={strokeJoin === value}
                className="lb-seg__option"
                onClick={() => onStrokeJoinChange?.(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="lb-label">
            Um contorno fechado não tem ponta solta — isto ajusta o vértice, não a extremidade da linha.
          </p>
        </div>
      )}

      {onLinkWalls && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onLinkWalls}>
          Criar parede na borda
        </button>
      )}
      {onSmoothRegion && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onSmoothRegion}>
          Suavizar contorno
        </button>
      )}
    </section>
  )
}
