import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import type { DrawingTool } from '../types/tools'
import { theme } from '../theme'
import { TOOLBAR_SLOTS, TOOL_CLUSTERS, TOOL_HINTS, TOOL_LABELS, clusterIdOf, type ToolbarSlot } from './labels'
import { TOOL_SHORTCUTS } from '../lib/keymap'
import { placeHint, type HintPlacement } from './hintPlacement'
import {
  TOOL_VARIANTS,
  drawingClusterGroups,
  hasVariantEcho,
  toolHasVariantAxis,
  variantEcho,
  type ToolVariantGroup,
  type ToolVariantStoreKey,
} from '../lib/toolVariants'
import { ToolVariantMenu, readVariantValue, type ToolVariantBindings } from './ToolVariantMenu'
import {
  BrushIcon,
  CircleIcon,
  ConcealZoneIcon,
  CurveIcon,
  CursorIcon,
  DoorIcon,
  EllipseIcon,
  EraserIcon,
  FloorIcon,
  LightIcon,
  LineIcon,
  MeasureIcon,
  PinIcon,
  PolygonIcon,
  PropIcon,
  RectIcon,
  RegionIcon,
  RegularPolygonIcon,
  RoomCircleIcon,
  RoomFreeIcon,
  RoomIcon,
  StairIcon,
  TextIcon,
  TokenIcon,
  WallIcon,
} from './icons'

interface ToolbarProps {
  activeTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
  /** Última forma de desenho ativada (mapStore) — o botão Desenho mostra e reativa esta quando nenhuma forma está ativa. */
  lastDrawingTool: DrawingTool
  /**
   * Valor/ação por eixo de variante (doorKind/wallKind/regionFillPattern/
   * polygonSides/drawShape...) — a setinha de cada ferramenta com entrada
   * `available: true` em `TOOL_VARIANTS` (lib/toolVariants.ts), e a do botão
   * Desenho, lê e escreve daqui. Mesmas preferências de sessão que
   * `PropertiesPanel` já edita no painel esquerdo (App.tsx) — a setinha é só
   * um segundo caminho de UI até o MESMO estado, não um estado novo.
   */
  variantBindings: ToolVariantBindings
}

// Partial, não Record<DrawingTool, ...>: assim uma futura extensão de
// DrawingTool não força entrada aqui antes do ícone existir.
const TOOL_ICONS: Partial<Record<DrawingTool, ComponentType<{ size?: number }>>> = {
  select: CursorIcon,
  wall: WallIcon,
  door: DoorIcon,
  light: LightIcon,
  region: RegionIcon,
  room: RoomIcon,
  roomCircle: RoomCircleIcon,
  roomPolygon: RegularPolygonIcon,
  roomFree: RoomFreeIcon,
  floor: FloorIcon,
  stair: StairIcon,
  token: TokenIcon,
  prop: PropIcon,
  brush: BrushIcon,
  line: LineIcon,
  circle: CircleIcon,
  ellipse: EllipseIcon,
  rect: RectIcon,
  polygon: PolygonIcon,
  curve: CurveIcon,
  text: TextIcon,
  measure: MeasureIcon,
  eraser: EraserIcon,
  concealZone: ConcealZoneIcon,
  pin: PinIcon,
}

/** Tamanho do ícone dentro de uma opção do grupo Forma. */
const MENU_ICON_SIZE = 16

function menuIconFor(tool: DrawingTool): ReactNode {
  const Icon = TOOL_ICONS[tool]
  return Icon ? <Icon size={MENU_ICON_SIZE} /> : null
}

/**
 * Setinha de variantes — canto do botão principal. Ícone LOCAL de propósito:
 * `components/icons.tsx` é arquivo de integrador/fundação (fora do escopo de
 * escrita desta tarefa), então não recebe entrada nova. Mesma convenção de
 * contorno das demais famílias de ícone do app: viewBox 24, sem fill,
 * strokeWidth 1.6.
 */
function ChevronDownIcon() {
  return (
    <svg
      width={9}
      height={9}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 9l7 7 7-7" />
    </svg>
  )
}

const EDGE_GAP = parseFloat(theme.layout.edgeGap)
/** Primeiro x livre à direita do painel lateral. */
const HINT_MIN_LEFT = parseFloat(theme.layout.railWidth) + EDGE_GAP * 2

/* ---------------------------------------------- eco da escolha de variante */

/**
 * ESTILO EM LINHA, e não classe nova em `main.css`, por limite de escopo: esta
 * peça só pode escrever em Toolbar/ToolVariantMenu/toolVariants, e a folha de
 * estilo é de outra. O que importa está mantido — nenhum valor nasce aqui:
 * cor, raio, espaço e tempo vêm todos de `theme.ts`, a mesma fonte que gera as
 * `--lb-*` que o `main.css` consome. Se um dia a folha puder ser tocada, isto
 * vira `.lb-toolbar__echo` sem mudar um valor sequer.
 */

/**
 * Marca da escolha no canto do botão dono dela: ponto de latão — o MESMO
 * acento que marcou a opção clicada dentro do menu
 * (`.lb-toolvariant-menu__option[aria-checked='true']`) — para o texto do balão
 * e o botão que o originou serem lidos como uma coisa só.
 *
 * `position: absolute` de propósito: a `.lb-toolvariant-anchor` já é
 * `position: relative`, então o ponto NÃO entra no fluxo e a barra não muda de
 * largura nem arrisca quebrar linha por causa dele. 7px com anel de 2px da cor
 * do painel afundado: medidas de desenho de ícone, na mesma faixa dos 15px da
 * setinha e dos 9px da seta do balão, que também não saem da escala de 4pt.
 */
const VARIANT_MARK_STYLE: CSSProperties = {
  position: 'absolute',
  top: '-1px',
  right: '-1px',
  width: '7px',
  height: '7px',
  borderRadius: theme.radius.full,
  background: theme.color.brass,
  boxShadow: `0 0 0 2px ${theme.color.stoneSunken}`,
  pointerEvents: 'none',
}

/** Rótulo do eco: mesma legenda de seção do resto do app (`.lb-eyebrow`), só
 *  com respiro até o valor. O espaço EM TEXTO entre os dois (no JSX) não é
 *  decoração: sem ele o `role="status"` anuncia "Próxima paredeInterna", e a
 *  margem, que é só visual, não separa palavra nenhuma para quem ouve. */
const ECHO_SUBJECT_STYLE: CSSProperties = { marginRight: theme.space[1] }

/** Valor do eco em latão: fecha o caminho do olho — a opção ficou em latão no
 *  menu, o ponto no botão é de latão, o valor aqui também. */
const ECHO_VALUE_STYLE: CSSProperties = { color: theme.color.brass, fontWeight: theme.font.weight.medium }

/** Linha do eco dentro do balão. Com dica em cima, um filete separa os dois
 *  registros (a dica ensina a ferramenta ativa; o eco relata um estado). */
function echoLineStyle(withSeparator: boolean): CSSProperties {
  return {
    display: 'block',
    marginTop: withSeparator ? theme.space[2] : undefined,
    paddingTop: withSeparator ? theme.space[2] : undefined,
    borderTop: withSeparator ? `1px solid ${theme.color.line}` : undefined,
  }
}

/**
 * Entrada do eco. Propósito: confirmar uma ação que o usuário acabou de fazer —
 * o único motivo que justifica movimento aqui. Só `opacity`/`transform` (nada
 * de layout), abaixo de 300ms e com a curva de desaceleração do app. A frase
 * usa `base` (170ms) e o ponto usa `fast` (110ms): o ponto é pequeno e nasce
 * embaixo do ponteiro, então chega primeiro; a frase, que é o que se lê, entra
 * logo atrás.
 */
const ECHO_LINE_MOTION: KeyframeAnimationOptions = { duration: parseFloat(theme.motion.base), easing: theme.motion.ease }
const ECHO_MARK_MOTION: KeyframeAnimationOptions = { duration: parseFloat(theme.motion.fast), easing: theme.motion.ease }

/** Posição da barra e eixo tocados pela última escolha de variante. */
interface VariantChoice {
  slot: ToolbarSlot
  storeKey: ToolVariantStoreKey
}

/** O que uma posição da barra desenha: nome, ícone, dica, ação e menu. */
interface SlotView {
  label: string
  Icon: ComponentType<{ size?: number }>
  pressed: boolean
  tip: string
  target: DrawingTool
  /** Grupos do popover da setinha; `null` = sem setinha. */
  groups: ToolVariantGroup[] | null
  iconFor?: (tool: DrawingTool) => ReactNode
}

function slotView(slot: ToolbarSlot, activeTool: DrawingTool, lastDrawingTool: DrawingTool): SlotView | null {
  const clusterId = clusterIdOf(slot)
  if (clusterId) {
    const cluster = TOOL_CLUSTERS[clusterId]
    const pressed = cluster.tools.includes(activeTool)
    // O ícone diz o que o clique fará (D5): a forma ativa, ou a última usada.
    const shape = pressed ? activeTool : lastDrawingTool
    const Icon = TOOL_ICONS[shape]
    if (!Icon) return null
    return {
      label: cluster.label,
      Icon,
      pressed,
      tip: `${cluster.label}: ${TOOL_LABELS[shape]} (${TOOL_SHORTCUTS[shape]})`,
      target: shape,
      groups: drawingClusterGroups(shape),
      iconFor: menuIconFor,
    }
  }
  const tool = slot as DrawingTool
  const Icon = TOOL_ICONS[tool]
  const label = TOOL_LABELS[tool]
  // TOOLBAR_SLOTS só lista ferramentas com ícone e rótulo — se faltar, é bug
  // de wiring ao adicionar a ferramenta, não caso de runtime a tratar.
  if (!Icon || !label) return null
  const variantEntry = TOOL_VARIANTS[tool]
  return {
    label,
    Icon,
    pressed: activeTool === tool,
    tip: `${label} (${TOOL_SHORTCUTS[tool]})`,
    target: tool,
    groups: variantEntry && variantEntry.available ? variantEntry.groups : null,
  }
}

/**
 * Barra de ferramentas flutuante e a dica contextual ancorada na ferramenta
 * ativa.
 *
 * Os botões são só de ícone: o nome acessível — e o tooltip de hover — vêm de
 * `TOOL_LABELS` (ou do rótulo do grupo), que os testes e2e leem com
 * `exact: true`. Nada de texto dentro do `<button>`, para o nome acessível
 * continuar sendo exatamente o rótulo.
 *
 * A dica não fica centralizada sob a barra inteira: ela nasce sob o ícone que a
 * disparou, com uma seta apontando para ele. A posição precisa ser medida
 * porque depende da largura do texto e de onde a janela deixa o balão caber —
 * `placeHint` faz a conta, este componente só fornece as medidas.
 *
 * A barra quebra em mais de uma linha quando não cabe na largura central. A
 * unidade de quebra é o GRUPO de `TOOLBAR_SLOTS`, não o botão: cada grupo vira
 * um `.lb-toolbar__group` com `flex-wrap: nowrap` interno, e é a barra
 * (`.lb-toolbar`, `flex-wrap: wrap`) que distribui grupos inteiros entre
 * linhas, sem separador órfão na borda de uma linha.
 *
 * Botão Desenho (plano de 15/09/2026, fatia 2): as 7 formas (Pincel a
 * Polígono) dividem UM botão. O nome acessível é fixo em "Desenho" (D6); o
 * ícone e o `data-tip` mostram a forma ativa ou a última usada, e o clique no
 * corpo reativa essa forma (D5). As formas continuam alcançáveis pela UI em
 * dois cliques — setinha "Opções de Desenho" e o rádio da forma, que é o
 * caminho do helper `e2e/helpers/tools.ts` (`pickTool`) — e em uma tecla
 * (P/L/U/C/O/R/A, D4).
 *
 * Setinha de variantes (Fase 4, N1): cada ferramenta com `available: true` em
 * `TOOL_VARIANTS` ganha uma SEGUNDA `<button>`, irmã da principal (nunca
 * aninhada — dois `<button>` um dentro do outro é HTML inválido), com nome
 * acessível próprio (`Opções de <nome>`) que abre um popover
 * (`ToolVariantMenu`). O clique no CORPO do botão principal só chama
 * `onSelectTool`, e a setinha só existe para quem tem opção pronta.
 */
export function Toolbar({ activeTool, onSelectTool, lastDrawingTool, variantBindings }: ToolbarProps) {
  /**
   * Passo 3, F1: a dica some depois do primeiro uso da ferramenta no canvas e
   * volta ao trocar de ferramenta. Estado só de UI, nunca vai para o mapa.
   * O reset na troca é feito durante o render (padrão "estado derivado da
   * prop"), porque a ferramenta também muda por atalho de teclado, fora do Toolbar.
   */
  const [hintDismissed, setHintDismissed] = useState(false)
  const [hintTool, setHintTool] = useState(activeTool)
  /**
   * Última escolha feita numa setinha — só QUAL posição e QUAL eixo. O VALOR
   * fica de fora de propósito: ele é relido de `variantBindings` a cada render
   * (`variantEcho` abaixo), então a barra mostra o estado de AGORA e não a
   * lembrança de um clique. Se a mesma preferência mudar pelo painel esquerdo,
   * a frase acompanha; se virar um valor sem rótulo no menu, a frase some.
   */
  const [variantChoice, setVariantChoice] = useState<VariantChoice | null>(null)
  if (hintTool !== activeTool) {
    setHintTool(activeTool)
    setHintDismissed(false)
    // O eco sobrevive à troca de ferramenta quando a nova ferramenta é dona do
    // mesmo eixo (escolher "Interna" e então ativar a Parede deixa a frase MAIS
    // relevante, não menos). Indo para uma ferramenta que não tem esse eixo, a
    // barra volta a falar só da ferramenta ativa.
    if (variantChoice && !toolHasVariantAxis(activeTool, variantChoice.storeKey)) setVariantChoice(null)
  }
  const hint = hintDismissed ? undefined : TOOL_HINTS[activeTool]
  /** O que a barra diz sobre a escolha, recalculado do valor corrente do eixo. */
  const echo = variantChoice ? variantEcho(variantChoice.storeKey, readVariantValue(variantBindings, variantChoice.storeKey)) : null
  const dockRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  /** Os dois pedaços do eco — a frase no balão e o ponto no botão —, só para a
   *  animação de entrada. */
  const echoRef = useRef<HTMLSpanElement>(null)
  const markRef = useRef<HTMLSpanElement>(null)
  const [placement, setPlacement] = useState<HintPlacement | null>(null)

  /**
   * Posição da barra cuja setinha está aberta agora (no máximo uma, mesmo
   * padrão de "um dropdown por vez" de qualquer barra de ferramentas). `null`
   * = nenhuma aberta.
   */
  const [openVariantSlot, setOpenVariantSlot] = useState<ToolbarSlot | null>(null)
  /** Um `<div>` âncora por posição (guarda o botão + a setinha) — usado só
   *  pra decidir "o clique foi dentro do popover aberto ou fora dele" no
   *  listener de pointerdown abaixo. */
  const variantAnchorRefs = useRef<Map<ToolbarSlot, HTMLDivElement>>(new Map())
  /** Um botão de setinha por posição — usado só pra devolver o foco a ela
   *  quando o popover fecha (Escape, clique fora, ou opção escolhida). */
  const variantArrowRefs = useRef<Map<ToolbarSlot, HTMLButtonElement>>(new Map())

  const closeVariantMenu = () => {
    const slot = openVariantSlot
    setOpenVariantSlot(null)
    if (slot) variantArrowRefs.current.get(slot)?.focus()
  }

  // Fecha ao clicar fora do popover aberto. `pointerdown` (não `click`) pra
  // fechar ANTES do clique seguinte poder acertar outro alvo por baixo do
  // popover — mesma ordem de eventos que um <select> nativo usa.
  useEffect(() => {
    if (!openVariantSlot) return
    const handlePointerDown = (event: PointerEvent) => {
      const anchor = variantAnchorRefs.current.get(openVariantSlot)
      if (anchor && event.target instanceof Node && anchor.contains(event.target)) return
      setOpenVariantSlot(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openVariantSlot])

  // Primeiro pointerdown de botão principal num <canvas> (o do Pixi) = ferramenta usada.
  // Captura, para o Pixi não conseguir engolir o evento antes; botão do meio é pan, não uso.
  useEffect(() => {
    if (hintDismissed) return
    const handleCanvasPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && event.target instanceof HTMLCanvasElement) setHintDismissed(true)
    }
    document.addEventListener('pointerdown', handleCanvasPointerDown, true)
    return () => document.removeEventListener('pointerdown', handleCanvasPointerDown, true)
  }, [hintDismissed])

  useLayoutEffect(() => {
    // O balão existe com dica, com eco, ou com os dois — e precisa ser medido
    // em qualquer um dos casos, porque a largura muda quando o eco entra.
    if (!hint && !echo) {
      setPlacement(null)
      return
    }

    const measure = () => {
      const dock = dockRef.current
      const balloon = hintRef.current
      const button = activeButtonRef.current
      if (!dock || !balloon || !button) return

      const buttonBox = button.getBoundingClientRect()
      setPlacement(
        placeHint({
          anchorCenter: buttonBox.left + buttonBox.width / 2,
          originLeft: dock.getBoundingClientRect().left,
          hintWidth: balloon.offsetWidth,
          viewportWidth: window.innerWidth,
          minLeft: HINT_MIN_LEFT,
          edgeGap: EDGE_GAP,
        }),
      )
    }

    // Em `useLayoutEffect` a medida entra antes do paint, então o balão nunca
    // aparece na posição provisória.
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeTool, hint, echo?.subject, echo?.value])

  // Entrada do eco — ver ECHO_LINE_MOTION. Roda por escolha, não por render: a
  // dependência é o objeto `variantChoice`, que só nasce de novo num clique de
  // opção (inclusive ao reescolher a MESMA, onde repetir o movimento é a
  // resposta certa a "cliquei de novo"). Movimento é decoração: com
  // `prefers-reduced-motion` ou sem Web Animations, o estado final é o mesmo,
  // já pintado pelo React.
  useEffect(() => {
    if (!variantChoice) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    echoRef.current?.animate?.([{ opacity: 0, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'none' }], ECHO_LINE_MOTION)
    markRef.current?.animate?.([{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }], ECHO_MARK_MOTION)
  }, [variantChoice])

  const hintStyle: CSSProperties = placement
    ? ({ left: placement.left, '--lb-hint-arrow': `${placement.arrow}px` } as CSSProperties)
    : // Ainda sem medida: some, mas continua ocupando layout para poder ser medido.
      { visibility: 'hidden' }

  return (
    <div className="lb-toolbar-dock" ref={dockRef}>
      <div className="lb-panel lb-toolbar" role="toolbar" aria-label="Ferramentas do mapa">
        {TOOLBAR_SLOTS.map((group, index) => (
          // Grupo inteiro é a unidade de quebra de linha — ver comentário do
          // componente. O separador mora dentro do grupo que ele abre, então
          // os dois sempre migram juntos para a linha seguinte.
          <div className="lb-toolbar__group" key={group[0]}>
            {index > 0 && <span className="lb-toolbar__sep" aria-hidden="true" />}
            {group.map((slot) => {
              const view = slotView(slot, activeTool, lastDrawingTool)
              if (!view) return null
              const { Icon } = view
              const menuOpen = openVariantSlot === slot
              return (
                // Âncora do par botão+setinha. A setinha é um `<button>` IRMÃO
                // do principal (nunca aninhado), então o clique no corpo do
                // botão principal só chama `onSelectTool`, nunca abre o popover.
                <div
                  key={slot}
                  className="lb-toolvariant-anchor"
                  ref={(node) => {
                    if (node) variantAnchorRefs.current.set(slot, node)
                    else variantAnchorRefs.current.delete(slot)
                  }}
                >
                  <button
                    // A dica da ferramenta ativa ancora no botão que está
                    // pressionado — no grupo Desenho, o próprio botão do grupo.
                    ref={view.pressed ? activeButtonRef : undefined}
                    type="button"
                    className="lb-iconbtn lb-tip"
                    aria-label={view.label}
                    aria-pressed={view.pressed}
                    // Onda 1, item 6 do plano — atalho invisível é atalho
                    // inexistente. `aria-label` fica intocado; só o balão de
                    // dica ganha a letra.
                    data-tip={view.tip}
                    onClick={() => onSelectTool(view.target)}
                  >
                    <Icon />
                  </button>
                  {view.groups && (
                    <button
                      ref={(node) => {
                        if (node) variantArrowRefs.current.set(slot, node)
                        else variantArrowRefs.current.delete(slot)
                      }}
                      type="button"
                      className="lb-toolvariant-arrow"
                      aria-label={`Opções de ${view.label}`}
                      aria-haspopup="true"
                      aria-expanded={menuOpen}
                      onClick={(event) => {
                        // Defensivo: os dois botões são irmãos, mas não custa
                        // garantir que o clique não chegue ao principal.
                        event.stopPropagation()
                        setOpenVariantSlot((current) => (current === slot ? null : slot))
                      }}
                    >
                      <ChevronDownIcon />
                    </button>
                  )}
                  {echo && variantChoice?.slot === slot && (
                    // Onde a escolha PEGOU. Sem isto a fileira de botões fica
                    // pixel por pixel igual depois de uma escolha — o defeito
                    // que esta peça conserta: quem estava olhando o botão
                    // precisa ver a resposta no botão, não só no balão abaixo.
                    // Decorativo para leitor de tela: o nome acessível do botão
                    // continua sendo só o rótulo (os e2e leem com `exact`), e
                    // quem anuncia a mudança é o balão, que é `role="status"`.
                    <span ref={markRef} aria-hidden="true" style={VARIANT_MARK_STYLE} />
                  )}
                  {view.groups && menuOpen && (
                    <ToolVariantMenu
                      title={view.label}
                      groups={view.groups}
                      bindings={variantBindings}
                      iconFor={view.iconFor}
                      onClose={closeVariantMenu}
                      onChoose={(storeKey) => {
                        // `drawShape` não ecoa — escolher a forma ATIVA a
                        // ferramenta, e a troca já é o rastro (ícone,
                        // `aria-pressed` e dica mudam sozinhos). Escolher uma
                        // forma também LIMPA um eco anterior: a barra passou a
                        // falar de outra coisa.
                        setVariantChoice(hasVariantEcho(storeKey) ? { slot, storeKey } : null)
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {(hint || echo) && (
        // O balão é a única superfície de texto da barra, então é ele que fala
        // dos dois assuntos: a dica ensina a ferramenta ativa, e o eco relata a
        // preferência que a última escolha deixou valendo. Ele continua sendo
        // UM elemento `.lb-hint` (os testes contam por esse seletor), e vive
        // enquanto houver o que dizer — o eco não morre junto com a dica, que
        // some no primeiro uso da ferramenta no canvas.
        <p className="lb-hint" role="status" ref={hintRef} style={hintStyle}>
          {hint}
          {echo && (
            <span ref={echoRef} style={echoLineStyle(Boolean(hint))}>
              <span className="lb-eyebrow" style={ECHO_SUBJECT_STYLE}>
                {echo.subject}
              </span>{' '}
              <span style={ECHO_VALUE_STYLE}>{echo.value}</span>
            </span>
          )}
        </p>
      )}
    </div>
  )
}
