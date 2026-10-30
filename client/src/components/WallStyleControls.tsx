import type { ReactNode } from 'react'
import type { FeitioDaParede, Wall, WallThicknessPreset } from '../types/map'
import {
  WALL_COLOR,
  WALL_WIDTH_WORLD_MAX,
  WALL_WIDTH_WORLD_MIN,
  wallWorldWidth,
  type WallLineStyle,
  type WallThickness,
} from '../pixi/drawWalls'
import { Toggle } from './Toggle'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'

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

/** A frase do limite do ajuste fino, que o campo "Espessura" explica sob demanda. */
const WALL_WIDTH_HINT_ID = 'lb-wall-thickness-hint'

const WALL_COLOR_INPUT_ID = 'lb-wall-color'

/** A frase do "Desenho" (Pedra | Linha), que o campo explica sob demanda. */
const WALL_FEITIO_HINT_ID = 'lb-wall-feitio-hint'

const FEITIO_OPTIONS: Array<{ value: FeitioDaParede; label: string }> = [
  { value: 'pedra', label: 'Pedra' },
  { value: 'linha', label: 'Linha' },
]

/** A cor padrão da linha (`WALL_COLOR`) como o `<input type="color">` a lê. */
const WALL_COLOR_HEX = `#${WALL_COLOR.toString(16).padStart(6, '0')}`

const LINE_STYLE_OPTIONS: Array<{ value: WallLineStyle; label: string }> = [
  { value: 'round', label: 'Arredondada' },
  { value: 'straight', label: 'Reta' },
]

/** O pedaço do bloco que a ficha da parede selecionada põe em cada lugar (ver `parte`). */
export type ParteDaParede = 'essencial' | 'deixa' | 'tipo'

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
   * (px de mundo, 1..`WALL_WIDTH_WORLD_MAX`), que é o que o slider "Ajuste
   * fino" escreve. A assinatura de `onThicknessChange` não mudou — quem
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
  /**
   * GRADE DE PRISÃO (Meio-Termo, MT10): a janela desenhada como barras de
   * ferro. Só entra numa janela sem porta e com a obra do Meio-Termo ligada
   * (quem decide é `gradeDaParede`); sem ele o interruptor não aparece.
   */
  grade?: { ligada: boolean; onChange: (ligada: boolean) => void }
  /**
   * PASSAGEM E COR (pedido de 07/10/2026) — só da parede JÁ SELECIONADA, como
   * a janela: sem o handler o controle não aparece. `deixaPassar` é
   * `!blocksMove`, `deixaVer` é `!blocksLight`; `color` `null` = cor padrão.
   */
  passagem?: {
    deixaPassar: boolean
    onDeixaPassarChange: (on: boolean) => void
    deixaVer: boolean
    onDeixaVerChange: (on: boolean) => void
  }
  cor?: { color: string | null; onColorChange: (color: string | null) => void }
  /**
   * PEDRA OU LINHA (`Wall.feitio`, pedido de 29/10/2026) — só da parede JÁ
   * SELECIONADA e só com o mapa no Desenhado: no Atual e no Simples a parede já
   * é linha, e o controle não entra (quem decide é o `App`). Trocar é um passo
   * do Ctrl+Z e leva junto os pedaços da parede partida por porta.
   */
  feitio?: { valor: FeitioDaParede; onChange: (feitio: FeitioDaParede) => void }
  /**
   * O Avançado da parede ("Ponta e canto"), como a ÚLTIMA linha deste bloco
   * (pedido painel-acervo, fatia 3), e não uma seção irmã com fio: é da
   * parede, como o da ficha é de "Trava e visibilidade". Quem monta é o
   * painel, que sabe qual parede está selecionada (`key` para nascer
   * fechado a cada parede).
   */
  avancado?: ReactNode
  /** Sem o título "Parede": dentro da ficha "Parede em volta" da porta, que já tem o seu. */
  semTitulo?: boolean
  /**
   * Só um pedaço do bloco, para a ficha da parede selecionada (fatia 16a):
   * `essencial` é a cor, a espessura, o ajuste fino e o Avançado; `deixa` é o
   * que atravessa a parede (Janela, Deixa passar, Deixa ver); `tipo` é
   * "Parede interna". Sem título em nenhum deles. Ausente, o bloco inteiro,
   * como antes: a ferramenta Parede e a ficha "Parede em volta" da porta.
   */
  parte?: ParteDaParede
}

/**
 * Classificação visual da parede: interna/externa (semântica, herdada),
 * espessura (3 degraus de fio de planta + ajuste fino contínuo até a muralha
 * de castelo, em px de mundo) e ponta/canto (arredondado/reto) —
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
  grade,
  passagem,
  cor,
  feitio,
  avancado,
  semTitulo = false,
  parte,
}: WallStyleControlsProps) {
  // `lineStyle`/`onLineStyleChange` continuam no tipo (o chamador monta um
  // objeto só), mas quem desenha é `WallLineStyleField`, no Avançado.
  //
  // Com a parede num valor CONTÍNUO nenhum degrau fica marcado, de propósito:
  // "muralha de 32 px" não é Fina, Média nem Grossa, e fingir que é faria o
  // degrau marcado mentir. Clicar num degrau volta para o fio de planta.
  const activePreset = typeof thickness === 'string' ? thickness : thickness === undefined ? 'medium' : null
  const worldWidth = wallWorldWidth(thickness)
  // Sem `parte`, o bloco inteiro na ordem de sempre; com ela, só os trechos daquele pedaço.
  const mostra = (pedaco: ParteDaParede) => parte === undefined || parte === pedaco
  return (
    <section className="lb-section">
      {parte === undefined && !semTitulo && <h2 className="lb-eyebrow">Parede</h2>}
      {mostra('tipo') && (
        <Toggle
          label="Parede interna"
          checked={wallKind === 'interior'}
          onChange={(checked) => onWallKindChange(checked ? 'interior' : 'exterior')}
        />
      )}
      {mostra('deixa') && onJanelaChange && (
        <Toggle label="Janela (vê, não passa)" checked={janela === true} onChange={onJanelaChange} />
      )}
      {mostra('deixa') && janela === true && grade && (
        <Toggle label="Grade de prisão (barras de ferro)" checked={grade.ligada} onChange={grade.onChange} />
      )}
      {mostra('deixa') && passagem && (
        <>
          <Toggle label="Deixa passar (a ficha atravessa)" checked={passagem.deixaPassar} onChange={passagem.onDeixaPassarChange} />
          <Toggle label="Deixa ver (a visão atravessa)" checked={passagem.deixaVer} onChange={passagem.onDeixaVerChange} />
        </>
      )}
      {mostra('essencial') && feitio && (
        // A primeira linha do essencial: ela decide o que a cor e a espessura
        // abaixo pintam. Rótulo primeiro filho do campo e a frase por
        // `aria-describedby`, o contrato da dica sob demanda (como "Espessura").
        <div className="lb-field">
          <span className="lb-label">Desenho</span>
          <div className="lb-seg" role="radiogroup" aria-label="Desenho da parede" aria-describedby={WALL_FEITIO_HINT_ID}>
            {FEITIO_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={feitio.valor === value}
                className="lb-seg__option"
                onClick={() => feitio.onChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="lb-field__hint" id={WALL_FEITIO_HINT_ID}>
            Pedra é a alvenaria do estilo Desenhado; Linha é a linha fina de sempre, na cor da parede. A visão e o passo não mudam.
          </p>
        </div>
      )}
      {mostra('essencial') && cor && (
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={WALL_COLOR_INPUT_ID}>
            Cor da parede
          </label>
          <div className="lb-room-title__color">
            {cor.color !== null && (
              <button type="button" className="lb-btn lb-btn--ghost" onClick={() => cor.onColorChange(null)}>
                Padrão
              </button>
            )}
            <CampoDeCorComPipeta
              id={WALL_COLOR_INPUT_ID}
              value={cor.color ?? WALL_COLOR_HEX}
              rotuloDaPipeta="Pegar do mapa a cor da parede"
              onChange={cor.onColorChange}
            />
          </div>
        </div>
      )}
      {mostra('essencial') && (
        <>
          {/* Painel enxuto (pedido de 30/09/2026, fatia 1): a frase do limite saiu
              de baixo do slider, onde ocupava três linhas fixas, e virou a dica
              deste campo. O rótulo continua o PRIMEIRO filho do campo, porque é
              ele que ganha o "?" (main.css, dicas sob demanda), e o grupo aponta
              a frase por `aria-describedby`, que é o contrato de
              `lib/dicaDoPainel.ts`. Ela mora aqui porque explica o par: os degraus
              são o fio de planta, e o ajuste fino logo abaixo vai além deles. Sem
              handler o grupo se diz desligado, e a frase volta ao fluxo à vista
              (dica de controle morto não abre). */}
          <div className="lb-field">
            <span className="lb-label">Espessura</span>
            <div
              className="lb-seg"
              role="radiogroup"
              aria-label="Espessura da parede"
              aria-describedby={WALL_WIDTH_HINT_ID}
              aria-disabled={onThicknessChange ? undefined : true}
            >
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
            <p className="lb-field__hint" id={WALL_WIDTH_HINT_ID}>
              No ajuste fino a parede vai até {WALL_WIDTH_WORLD_MAX} px, uma célula inteira de muralha. Acompanha o zoom do mapa.
            </p>
          </div>
          <div className="lb-field">
            <div className="lb-section__row">
              <label className="lb-label" htmlFor={WALL_WIDTH_INPUT_ID}>
                Ajuste fino
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
              // ("Ajuste fino", o mesmo nome do slider de Região), então o que se
              // lê na tela e o que o leitor de tela anuncia são a mesma palavra.
              // Antes era "Grossura", sinônimo de "Espessura" logo acima: dois
              // nomes para a mesma propriedade.
              // Mesmo `?.` guardado dos degraus: sem o handler o controle já nasce
              // desabilitado, então isto nunca é um arrasto que não faz nada.
              onChange={(event) => onThicknessChange?.(Number(event.target.value))}
            />
          </div>
          {avancado}
        </>
      )}
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
