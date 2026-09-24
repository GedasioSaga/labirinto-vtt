import type { Wall, WallThicknessPreset } from '../types/map'
import {
  WALL_WIDTH_WORLD_MAX,
  WALL_WIDTH_WORLD_MIN,
  wallWorldWidth,
  type WallLineStyle,
  type WallThickness,
} from '../pixi/drawWalls'
import { Toggle } from './Toggle'

/** Mesmo padrão de `LineCapControls.tsx`/`GridControls.tsx` (`LINE_STYLES`):
 *  array explícito de opções, não `Object.keys` (que tiparia `string[]`). */
const THICKNESS_OPTIONS: Array<{ value: WallThicknessPreset; label: string }> = [
  { value: 'thin', label: 'Fina' },
  { value: 'medium', label: 'Média' },
  { value: 'thick', label: 'Grossa' },
]

/** Um único controle montado por vez no painel — id fixo, como o
 *  `lb-region-strokewidth` de `RegionStyleControls`. */
const WALL_WIDTH_INPUT_ID = 'lb-wall-thickness'

const LINE_STYLE_OPTIONS: Array<{ value: WallLineStyle; label: string }> = [
  { value: 'round', label: 'Arredondada' },
  { value: 'straight', label: 'Reta' },
]

export interface WallStyleControlsProps {
  /** `undefined` conta como 'exterior' — mesmo default do schema (ver
   *  Wall.wallKind em types/map.ts). */
  wallKind: Wall['wallKind']
  onWallKindChange: (kind: NonNullable<Wall['wallKind']>) => void
  /**
   * Fase 6 — pedido literal do usuário: "se eu quero poligono finos ou
   * medios ou gordos". `undefined` conta como 'medium' (ver `WallThickness`
   * em `types/map.ts`). Eixo SEPARADO de `wallKind`: dá pra ter parede
   * externa fina (rua/construção artesanal) ou interna grossa.
   *
   * 17/09/2026 — "isso era para ser uma muralha de castelo mas nao consigo
   * engrossar a linha o quanto eu quiser": além dos 3 degraus, aceita NÚMERO
   * (px de mundo, 1..`WALL_WIDTH_WORLD_MAX`), que é o que o controle de
   * grossura escreve. A assinatura de `onThicknessChange` não mudou — quem
   * mudou foi `Wall['thickness']`, então `App.tsx`/`mapStore`/`mapFactory`,
   * todos tipados a partir dele, passaram a aceitar o número sem uma linha de
   * alteração em nenhum deles.
   *
   * `thickness`/`onThicknessChange` (e o par `lineStyle`/`onLineStyleChange`
   * abaixo) são OPCIONAIS de propósito, diferente de `wallKind`/
   * `onWallKindChange` (obrigatórios, eixo pré-existente): `PropertiesPanel`/
   * `App.tsx` são arquivos de integrador fora do meu escopo de escrita, e o
   * call site de hoje só passa `wallKind`/`onWallKindChange` — se estes 2
   * pares fossem obrigatórios, o `tsc` do projeto quebraria em arquivo que
   * não é meu até o integrador aplicar o CONTRATO. Com `onThicknessChange`
   * ausente o botão nasce `disabled` (ver render abaixo) — visivelmente
   * inerte, nunca um clique que silenciosamente não faz nada (D5,
   * ROADMAP.md: "feature pronta e inalcançável" já aconteceu 3× por esse
   * motivo exato).
   */
  thickness?: WallThickness
  onThicknessChange?: (thickness: WallThickness) => void
  /**
   * Fase 6 — pedido literal: "essas paredes tem a ponta redonda, quero a
   * opcao de colocar reta ou redondo" + "as linhas dos poligonos se eu
   * quero eles arredondados ou retos". `undefined` conta como 'round'
   * (comportamento de antes desta fase). Um único controle cobre os dois
   * pedidos: numa parede solta vira a PONTA (cap); num canto fechado de
   * Sala/polígono vira o CANTO (join) — ver `pixi/drawWalls.ts`. Opcional
   * pelo mesmo motivo de `thickness` acima.
   */
  lineStyle?: WallLineStyle
  onLineStyleChange?: (lineStyle: WallLineStyle) => void
  /**
   * JANELA — a visão atravessa, a ficha não (`Wall.janela`). Só existe para a
   * parede JÁ SELECIONADA e sem porta: sem `onJanelaChange` o interruptor nem
   * aparece (não há "próxima parede janela": janela se marca na parede certa).
   */
  janela?: boolean
  onJanelaChange?: (janela: boolean) => void
}

/**
 * Classificação visual da parede: interna/externa (semântica, herdada),
 * espessura (3 degraus de fio de planta + grossura contínua até a muralha de
 * castelo, em px de mundo) e ponta/canto (arredondado/reto) —
 * três eixos independentes, controlam só `pixi/drawWalls.ts`, nunca
 * `blocksLight`/`blocksMove`/collision.
 *
 * Igual RegionStyleControls/LineCapControls: o chamador decide a FONTE deste
 * componente só mostra os controles. Duas ligações possíveis por eixo —
 *  - preferência da PRÓXIMA parede: `wallKind`/`setWallKind` (store, sem histórico);
 *  - a parede JÁ SELECIONADA: `selectedWall.wallKind`/`(k) => setWallKindForWall(selectedWall.id, k)` (com histórico).
 * Mesmo par dual esperado para `thickness`/`lineStyle` (ver CONTRATO).
 */
export function WallStyleControls({
  wallKind,
  onWallKindChange,
  thickness,
  onThicknessChange,
  janela,
  onJanelaChange,
}: WallStyleControlsProps) {
  // `lineStyle`/`onLineStyleChange` continuam no tipo (o chamador monta um
  // objeto só), mas quem desenha é `WallLineStyleField`, no Avançado.
  //
  // Com a parede num valor CONTÍNUO nenhum degrau fica marcado, de propósito:
  // "muralha de 32 px" não é Fina, Média nem Grossa, e fingir que é faria o
  // degrau marcado mentir. Clicar num degrau volta para o fio de planta.
  const activePreset = typeof thickness === 'string' ? thickness : thickness === undefined ? 'medium' : null
  const worldWidth = wallWorldWidth(thickness)
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Parede</h2>
      <Toggle
        label="Parede interna"
        checked={wallKind === 'interior'}
        onChange={(checked) => onWallKindChange(checked ? 'interior' : 'exterior')}
      />
      {onJanelaChange && (
        <Toggle label="Janela (vê, não passa)" checked={janela === true} onChange={onJanelaChange} />
      )}
      <div className="lb-field">
        <span className="lb-label">Espessura</span>
        <div className="lb-seg" role="radiogroup" aria-label="Espessura da parede">
          {THICKNESS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={activePreset === value}
              className="lb-seg__option"
              disabled={!onThicknessChange}
              // Ausência de onThicknessChange é caso legítimo (call site
              // ainda não integrado, ver doc de WallStyleControlsProps) — o
              // botão já nasce disabled acima, então este `?.` nunca dispara
              // silenciosamente num controle que parece ativo.
              onClick={() => onThicknessChange?.(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={WALL_WIDTH_INPUT_ID}>
            Grossura
          </label>
          <span className="lb-num">{worldWidth} px</span>
        </div>
        <input
          id={WALL_WIDTH_INPUT_ID}
          className="lb-range"
          type="range"
          min={WALL_WIDTH_WORLD_MIN}
          max={WALL_WIDTH_WORLD_MAX}
          step={1}
          value={worldWidth}
          disabled={!onThicknessChange}
          // Sem `aria-label`: o nome acessível vem do <label for> visível
          // ("Grossura"), então o que se lê na tela e o que o leitor de tela
          // anuncia são a mesma palavra.
          // Mesmo `?.` guardado dos degraus: sem o handler o controle já nasce
          // desabilitado, então isto nunca é um arrasto que não faz nada.
          onChange={(event) => onThicknessChange?.(Number(event.target.value))}
        />
        <p className="lb-field__hint">
          Até {WALL_WIDTH_WORLD_MAX} px: uma célula inteira de muralha. Acompanha o zoom, como a largura de qualquer coisa
          construída no mapa.
        </p>
      </div>
    </section>
  )
}

export interface WallLineStyleFieldProps extends Pick<WallStyleControlsProps, 'lineStyle' | 'onLineStyleChange'> {
  /** Id da frase do Avançado que explica o controle. */
  describedBy?: string
}

/**
 * "Ponta e canto" da parede, fora de `WallStyleControls` desde a fatia 3 do
 * plano de 15/09/2026: mora na seção Avançado do painel. `undefined` conta
 * como 'round'; sem `onLineStyleChange` os botões nascem desabilitados.
 */
export function WallLineStyleField({ lineStyle, onLineStyleChange, describedBy }: WallLineStyleFieldProps) {
  const resolvedLineStyle = lineStyle ?? 'round'
  return (
    <div className="lb-field">
      <span className="lb-label">Ponta e canto</span>
      <div className="lb-seg" role="radiogroup" aria-label="Ponta e canto da parede" aria-describedby={describedBy}>
        {LINE_STYLE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={resolvedLineStyle === value}
            className="lb-seg__option"
            disabled={!onLineStyleChange}
            onClick={() => onLineStyleChange?.(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
