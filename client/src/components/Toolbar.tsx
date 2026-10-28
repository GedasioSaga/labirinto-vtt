import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import type { DrawingTool } from '../types/tools'
import { theme } from '../theme'
import {
  PENHASCO_HINT_FORA_DO_CONTINENTE,
  ROOM_FREE_WALL_HINT,
  TOOLBAR_GROUPS,
  TOOL_CLUSTERS,
  TOOL_HINTS,
  TOOL_LABELS,
  clusterIdOf,
  clusterOfTool,
  type ToolClusterId,
  type ToolbarSlot,
} from './labels'
import { TOOL_SHORTCUTS } from '../lib/keymap'
import { isContinente } from '../lib/marcadorDeContinente'
import { useMapStore } from '../stores/mapStore'
import { placeHint, type HintPlacement } from './hintPlacement'
import {
  TOOL_VARIANTS,
  clusterOptionLabel,
  clusterVariantGroups,
  hasVariantEcho,
  toolHasVariantAxis,
  variantEcho,
  type ToolVariantGroup,
  type ToolVariantStoreKey,
} from '../lib/toolVariants'
import { ToolVariantMenu, readVariantValue, type ToolVariantBindings } from './ToolVariantMenu'
import { ComSaida } from './grimorio/ComSaida'
import { Balao } from './grimorio/Balao'
import { movimentoReduzido } from './grimorio/comum'
import { TOOL_ICONS } from './toolIcons'

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

/** Tamanho do ícone dentro de uma opção do grupo Forma. */
const MENU_ICON_SIZE = 16

function menuIconFor(tool: DrawingTool): ReactNode {
  const Icon = TOOL_ICONS[tool]
  return Icon ? <Icon size={MENU_ICON_SIZE} /> : null
}

const EDGE_GAP = parseFloat(theme.layout.edgeGap)
/** Primeiro x livre à direita do livro do mestre. */
const HINT_MIN_LEFT = parseFloat(theme.layout.livroDoMestre) + EDGE_GAP

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
  // O anel tem a cor do couro da barra: separa o ponto do botão sem contorno.
  boxShadow: `0 0 0 2px ${theme.gr.couro[2]}`,
  pointerEvents: 'none',
  zIndex: 2,
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

/* ------------------------------------------------------- placa de latão */

/**
 * Segurar o botão por este tempo abre as variantes, como o clique direito
 * (protótipo consolidado: 450 ms). Mais curto, um clique demorado viraria menu.
 */
const SEGURAR_PARA_VARIANTES_MS = 450

/**
 * A placa de latão: uma só, desliza até o botão da ferramenta armada
 * (protótipo consolidado, fatia 6). Propósito do movimento: mostrar de onde a
 * ferramenta saiu e para onde foi, quando a troca nasce de um clique na barra.
 * Pela tecla ela troca na hora — atalho de uso constante não anima —, e também
 * na primeira posição, quando a barra muda de tamanho e com movimento reduzido.
 *
 * Só `transform` (com a curva e os 150 ms de `--lb-gr-ease-out`/`--lb-gr-dur-move`,
 * no CSS), escrito direto no elemento: armar uma ferramenta não re-renderiza
 * nada a mais por causa dela. A medida sai num quadro de animação ou no
 * ResizeObserver, nunca dentro do commit (ver o balão da dica, abaixo).
 */
function usePlacaDeLatao(
  barraRef: RefObject<HTMLDivElement | null>,
  placaRef: RefObject<HTMLSpanElement | null>,
  ferramenta: DrawingTool,
  animarProxima: RefObject<boolean>,
): void {
  // Barra que muda de tamanho (janela, quebra de linha): a placa acompanha sem deslizar.
  useEffect(() => {
    const barra = barraRef.current
    if (!barra || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => moverPlaca(barra, placaRef.current, false))
    observer.observe(barra)
    return () => observer.disconnect()
  }, [barraRef, placaRef])

  useEffect(() => {
    const animar = animarProxima.current
    animarProxima.current = false
    const quadro = requestAnimationFrame(() => moverPlaca(barraRef.current, placaRef.current, animar))
    return () => cancelAnimationFrame(quadro)
  }, [ferramenta, barraRef, placaRef, animarProxima])
}

function moverPlaca(barra: HTMLDivElement | null, placa: HTMLSpanElement | null, animar: boolean): void {
  if (!barra || !placa) return
  const botao = barra.querySelector<HTMLElement>('.lb-ferr[aria-pressed="true"]')
  // Ferramenta fora da barra (o Token, com a flag ligada por atalho): nenhuma placa.
  if (!botao) {
    placa.removeAttribute('data-posta')
    return
  }
  const caixa = barra.getBoundingClientRect()
  const alvo = botao.getBoundingClientRect()
  const x = alvo.left - caixa.left - barra.clientLeft
  const y = alvo.top - caixa.top - barra.clientTop
  const naHora = !animar || !placa.hasAttribute('data-posta') || movimentoReduzido()
  if (naHora) placa.style.transition = 'none'
  placa.style.transform = `translate(${x}px, ${y}px)`
  placa.setAttribute('data-posta', '')
  if (naHora) {
    // Lê o layout para o navegador aplicar a posição sem transição antes de devolvê-la.
    void placa.offsetWidth
    placa.style.transition = ''
  }
}

/** Posição da barra e eixo tocados pela última escolha de variante. */
interface VariantChoice {
  slot: ToolbarSlot
  storeKey: ToolVariantStoreKey
}

/** O que uma posição da barra desenha: nome, ícone, balão, ação e menu. */
interface SlotView {
  label: string
  Icon: ComponentType<{ size?: number }>
  pressed: boolean
  /** Texto do balão ("Sala: Circular"); o atalho e o grupo vão à parte. */
  texto: string
  /** Letra da ferramenta que o clique arma. Sala livre e Caminho nasceram sem letra (`lib/keymap.ts`). */
  atalho: string | undefined
  target: DrawingTool
  /** Grupos do popover das variantes; `null` = sem cantinho. */
  groups: ToolVariantGroup[] | null
  iconFor?: (tool: DrawingTool) => ReactNode
}

/** A última ferramenta usada de cada botão que agrupa ferramentas — é o que o clique no botão arma. */
type UltimaDoGrupo = Record<ToolClusterId, DrawingTool>

function slotView(slot: ToolbarSlot, activeTool: DrawingTool, ultima: UltimaDoGrupo): SlotView | null {
  const clusterId = clusterIdOf(slot)
  if (clusterId) {
    const cluster = TOOL_CLUSTERS[clusterId]
    const pressed = cluster.tools.includes(activeTool)
    // O ícone diz o que o clique fará (D5): a forma ativa, ou a última usada.
    const shape = pressed ? activeTool : ultima[clusterId]
    const Icon = TOOL_ICONS[shape]
    if (!Icon) return null
    return {
      label: cluster.label,
      Icon,
      pressed,
      texto: `${cluster.label}: ${clusterOptionLabel(clusterId, shape) ?? TOOL_LABELS[shape] ?? shape}`,
      atalho: TOOL_SHORTCUTS[shape] || undefined,
      target: shape,
      groups: clusterVariantGroups(clusterId, shape),
      iconFor: menuIconFor,
    }
  }
  const tool = slot as DrawingTool // clusterIdOf deu null: a posição é uma ferramenta avulsa
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
    texto: label,
    atalho: TOOL_SHORTCUTS[tool] || undefined,
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
 * Cantinho de variantes (Fase 4, N1; visual da fatia 6): cada ferramenta com
 * `available: true` em `TOOL_VARIANTS` ganha uma SEGUNDA `<button>`, irmã da
 * principal (nunca aninhada — dois `<button>` um dentro do outro é HTML
 * inválido), desenhada como o triângulo no canto do botão, com nome acessível
 * próprio (`Opções de <nome>`) que abre um popover (`ToolVariantMenu`). Clique
 * direito ou segurar o botão principal abrem o mesmo popover e armam a
 * ferramenta (protótipo consolidado); o clique no CORPO só chama `onSelectTool`.
 *
 * Fatia 6: barra no pé do mapa, em faixa de couro com 5 grupos (Escolher,
 * Construir, Terreno, Esconder e revelar, Anotar), placa de latão na
 * ferramenta armada e balão com o atalho em tecla e o nome do grupo. Sala
 * (4 salas + Região) e Objeto (móvel + Peça) viraram botões que agrupam
 * ferramentas, como o Desenho; as letras de cada uma não mudaram.
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
  // PENHASCO fora do continente: a dica fala de região, não de costa (`PENHASCO_HINT_FORA_DO_CONTINENTE`).
  const continente = useMapStore((s) => isContinente(s.map))
  /**
   * Última escolha feita numa setinha — só QUAL posição e QUAL eixo. O VALOR
   * fica de fora de propósito: ele é relido de `variantBindings` a cada render
   * (`variantEcho` abaixo), então a barra mostra o estado de AGORA e não a
   * lembrança de um clique. Se a mesma preferência mudar pelo painel esquerdo,
   * a frase acompanha; se virar um valor sem rótulo no menu, a frase some.
   */
  const [variantChoice, setVariantChoice] = useState<VariantChoice | null>(null)
  /**
   * Última ferramenta de Sala e de Objeto, lembrada pela barra durante a sessão
   * (a do Desenho vem do mapStore, `lastDrawingTool`). Também acompanha a
   * troca por tecla: apertar J e voltar ao Selecionar deixa o botão Sala na
   * Circular, como o Desenho faz com a forma.
   */
  const [ultimasLocais, setUltimasLocais] = useState<Omit<UltimaDoGrupo, 'drawing'>>({ sala: 'room', objeto: 'mobilia' })
  const grupoDaAtiva = clusterOfTool(activeTool)
  if (grupoDaAtiva && grupoDaAtiva !== 'drawing' && ultimasLocais[grupoDaAtiva] !== activeTool) {
    setUltimasLocais({ ...ultimasLocais, [grupoDaAtiva]: activeTool })
  }
  const ultima: UltimaDoGrupo = { drawing: lastDrawingTool, ...ultimasLocais }
  if (hintTool !== activeTool) {
    setHintTool(activeTool)
    setHintDismissed(false)
    // O eco sobrevive à troca de ferramenta quando a nova ferramenta é dona do
    // mesmo eixo (escolher "Interna" e então ativar a Parede deixa a frase MAIS
    // relevante, não menos). Indo para uma ferramenta que não tem esse eixo, a
    // barra volta a falar só da ferramenta ativa.
    if (variantChoice && !toolHasVariantAxis(activeTool, variantChoice.storeKey)) setVariantChoice(null)
  }
  // A Sala livre em "Criar: Parede" faz o mesmo traçado com outro fim (2 pontos,
  // linha aberta, sem sala): a dica acompanha o modo escolhido na setinha.
  const toolHint =
    activeTool === 'roomFree' && variantBindings.roomFreeKind.value === 'parede'
      ? ROOM_FREE_WALL_HINT
      : activeTool === 'penhasco' && !continente
        ? PENHASCO_HINT_FORA_DO_CONTINENTE
        : TOOL_HINTS[activeTool]
  const hint = hintDismissed ? undefined : toolHint
  /** O que a barra diz sobre a escolha, recalculado do valor corrente do eixo. */
  const echo = variantChoice ? variantEcho(variantChoice.storeKey, readVariantValue(variantBindings, variantChoice.storeKey)) : null
  const dockRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  /** A barra em si (`.lb-toolbar`): a placa de latão se mede contra ela. */
  const barraRef = useRef<HTMLDivElement>(null)
  const placaRef = useRef<HTMLSpanElement>(null)
  /** A próxima troca de ferramenta veio de um gesto na barra: a placa desliza (pela tecla, troca na hora). */
  const animarPlaca = useRef(false)
  usePlacaDeLatao(barraRef, placaRef, activeTool, animarPlaca)
  /** Relógio do "segurar para ver as variantes"; `null` = ninguém segurando. */
  const segurando = useRef<number | null>(null)
  const pararDeSegurar = () => {
    if (segurando.current === null) return
    window.clearTimeout(segurando.current)
    segurando.current = null
  }
  useEffect(() => pararDeSegurar, [])
  /** Os dois pedaços do eco — a frase no balão e o ponto no botão —, só para a
   *  animação de entrada. */
  const echoRef = useRef<HTMLSpanElement>(null)
  const markRef = useRef<HTMLSpanElement>(null)
  /**
   * Tudo o que muda a posição do balão. A medida guardada só vale para a chave
   * com que foi tirada: trocar de ferramenta ou de texto esconde o balão até a
   * medida nova, em vez de mostrá-lo um quadro na posição da anterior.
   */
  const placementKey = hint || echo ? [activeTool, hint ?? '', echo?.subject ?? '', echo?.value ?? ''].join('|') : null
  const [placement, setPlacement] = useState<{ key: string; value: HintPlacement } | null>(null)

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

  useEffect(() => {
    // O balão existe com dica, com eco, ou com os dois — e precisa ser medido
    // em qualquer um dos casos, porque a largura muda quando o eco entra.
    if (placementKey === null) return

    const measure = () => {
      const dock = dockRef.current
      const balloon = hintRef.current
      const button = activeButtonRef.current
      if (!dock || !balloon || !button) return

      const buttonBox = button.getBoundingClientRect()
      setPlacement({
        key: placementKey,
        value: placeHint({
          anchorCenter: buttonBox.left + buttonBox.width / 2,
          originLeft: dock.getBoundingClientRect().left,
          hintWidth: balloon.offsetWidth,
          // A coluna da direita espelha o rail: o balão para antes dela como
          // para antes do rail (a borda direita útil é a janela menos a coluna).
          viewportWidth: window.innerWidth - (HINT_MIN_LEFT - EDGE_GAP),
          minLeft: HINT_MIN_LEFT,
          edgeGap: EDGE_GAP,
        }),
      })
    }

    // Nunca mede dentro do commit: na abertura, com o canvas recém-montado, ler
    // o layout aqui forçava um recálculo síncrono de 198 a 241 ms (perfil da
    // torre). O ResizeObserver entrega a primeira observação logo depois do
    // layout que o navegador já ia fazer, com a medida limpa; sem ele, o
    // próximo quadro. Até lá o balão fica escondido (`hintStyle`), nunca na
    // posição da ferramenta anterior.
    let frame = 0
    const measureNextFrame = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (observer) {
      for (const el of [dockRef.current, hintRef.current, activeButtonRef.current]) if (el) observer.observe(el)
    } else {
      measureNextFrame()
    }
    // A janela pode mudar sem nenhum dos três mudar de tamanho (a barra só
    // desliza), e a conta depende da largura da janela.
    window.addEventListener('resize', measureNextFrame)
    return () => {
      observer?.disconnect()
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', measureNextFrame)
    }
  }, [placementKey])

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

  const current = placement?.key === placementKey ? placement.value : null
  const hintStyle: CSSProperties = current
    ? ({ left: current.left, '--lb-hint-arrow': `${current.arrow}px` } as CSSProperties)
    : // Ainda sem medida: some, mas continua ocupando layout para poder ser medido.
      { visibility: 'hidden' }

  /** Clique direito ou segurar: abre as variantes e arma a ferramenta, como no protótipo. */
  const abrirVariantesPeloGesto = (slot: ToolbarSlot, view: SlotView) => {
    pararDeSegurar()
    setOpenVariantSlot(slot)
    if (view.pressed) return
    animarPlaca.current = true
    onSelectTool(view.target)
  }
  const comecarASegurar = (evento: ReactPointerEvent<HTMLButtonElement>, slot: ToolbarSlot, view: SlotView) => {
    pararDeSegurar()
    if (evento.button !== 0 || !view.groups) return
    segurando.current = window.setTimeout(() => abrirVariantesPeloGesto(slot, view), SEGURAR_PARA_VARIANTES_MS)
  }

  return (
    <div className="lb-toolbar-dock" ref={dockRef}>
      <div ref={barraRef} className="lb-toolbar" role="toolbar" aria-label="Ferramentas do mapa">
        <span ref={placaRef} className="lb-toolbar__placa" aria-hidden="true" />
        {TOOLBAR_GROUPS.map((group, index) => (
          // Grupo inteiro é a unidade de quebra de linha — ver comentário do
          // componente. O separador mora dentro do grupo que ele abre, então
          // os dois sempre migram juntos para a linha seguinte.
          <div className="lb-toolbar__group" key={group.nome} role="group" aria-label={group.nome}>
            {index > 0 && <span className="lb-toolbar__sep" aria-hidden="true" />}
            {group.slots.map((slot) => {
              const view = slotView(slot, activeTool, ultima)
              if (!view) return null
              const { Icon } = view
              const menuOpen = openVariantSlot === slot
              return (
                // Âncora do par botão+cantinho. O cantinho é um `<button>` IRMÃO
                // do principal (nunca aninhado), então o clique no corpo do
                // botão principal só chama `onSelectTool`, nunca abre o popover.
                <div
                  key={slot}
                  className="lb-toolvariant-anchor"
                  ref={(node) => {
                    if (node) variantAnchorRefs.current.set(slot, node)
                    else variantAnchorRefs.current.delete(slot)
                  }}
                  onContextMenu={(event) => {
                    if (!view.groups) return
                    event.preventDefault()
                    abrirVariantesPeloGesto(slot, view)
                  }}
                >
                  <Balao texto={view.texto} atalho={view.atalho} grupo={group.nome}>
                    {(gatilho) => (
                      <button
                        // A dica da ferramenta ativa ancora no botão que está
                        // pressionado — num botão que agrupa, o próprio botão.
                        ref={(node) => {
                          gatilho.ref(node)
                          if (view.pressed) activeButtonRef.current = node
                        }}
                        type="button"
                        className="lb-ferr"
                        // O nome acessível é só o rótulo (os e2e leem com
                        // `exact`); a letra vai no balão, como tecla.
                        aria-label={view.label}
                        aria-pressed={view.pressed}
                        aria-describedby={gatilho['aria-describedby']}
                        onPointerEnter={gatilho.onPointerEnter}
                        onPointerLeave={() => {
                          gatilho.onPointerLeave()
                          pararDeSegurar()
                        }}
                        onPointerDown={(event) => {
                          gatilho.onPointerDown()
                          comecarASegurar(event, slot, view)
                        }}
                        onPointerUp={pararDeSegurar}
                        onPointerCancel={pararDeSegurar}
                        onFocus={gatilho.onFocus}
                        onBlur={gatilho.onBlur}
                        onKeyDown={gatilho.onKeyDown}
                        onClick={() => {
                          animarPlaca.current = true
                          onSelectTool(view.target)
                        }}
                      >
                        <Icon />
                      </button>
                    )}
                  </Balao>
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
                    />
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
                  <ComSaida>
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
                  </ComSaida>
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
