import { Container, Graphics, Text } from 'pixi.js'
import type { Pin } from '../types/map'
import {
  PIN_GLYPH,
  PIN_HEAD_OFFSET,
  PIN_HEAD_RADIUS,
  PIN_HEIGHT,
  PIN_LEVER_SYMBOL,
  PIN_SYMBOLS,
  PIN_TRAVEL_SYMBOL,
  cleanPinName,
  isPinIcon,
  type PinSymbolShape,
} from '../lib/pins'
import { SELECTION_COLOR } from './constants'

export interface PinsRenderer {
  /**
   * `unlinkedIds`: pinos de viagem SEM par, desenhados apagados. Só o editor
   * do mestre sabe disso — o recorte do jogador nunca leva o destino
   * (`lib/fogFilter.ts`) —, então sem o conjunto todo pino de viagem sai aceso.
   */
  draw: (container: Container, pins: readonly Pin[], selectedId: string | null, unlinkedIds?: ReadonlySet<string>) => void
}

/** Latão quente: o pino é chamariz, precisa saltar do chão marrom e do preto da névoa. */
const PIN_FILL = 0xf2c14e
/** Contorno escuro: sem ele a cabeça some contra chão claro. */
const PIN_OUTLINE = 0x1b1208
const PIN_OUTLINE_WIDTH = 2
const SELECTED_RING_WIDTH = 3
/** Folga entre a cabeça e o anel de seleção, em px de mundo. */
const SELECTED_RING_GAP = 3
const GLYPH_COLOR = 0x1b1208
/** O glifo ocupa a cabeça quase inteira: é ele que separa "!" de "?" a distância. */
const GLYPH_FONT_SIZE = PIN_HEAD_RADIUS * 1.7
/**
 * Meia-aresta do quadrado onde o símbolo é desenhado, em px de mundo. `0.64` do
 * raio deixa a forma tocar a borda sem encostar no contorno da cabeça: o
 * símbolo é o que se lê, o aro é só a moldura.
 */
const SYMBOL_RADIUS = PIN_HEAD_RADIUS * 0.64
/** Traço do símbolo: fino como a parede do minimapa, grosso o bastante para não sumir no zoom de fora. */
const SYMBOL_WIDTH = 1.7

/**
 * Pino de VIAGEM: o negativo do marcador. Cabeça escura — o chão do minimapa
 * — com a linha clara por cima, aro e símbolo no mesmo latão do pino de
 * sempre. Lê como "passagem" ao lado dos marcadores de latão sem inventar
 * cor nova nem engrossar traço.
 */
const TRAVEL_HEAD_FILL = PIN_OUTLINE
const TRAVEL_LINE = PIN_FILL
/**
 * Passagem sem par: a mesma linha, apagada. O pino continua no mapa e
 * clicável, mas o latão some — é o aviso de que ele ainda não leva a lugar nenhum.
 */
const TRAVEL_LINE_UNLINKED = 0x8a8478

/**
 * Pino de ponto de interesse: gota cravada no ponto (a ponta fica EXATAMENTE
 * em `pin.x`/`pin.y`, que é o que o mestre clicou) com o glifo dentro da
 * cabeça. Desenhado por código, como a escada (`drawStairs.ts`) — nada de
 * sprite: o mapa inteiro é vetor e o pino precisa continuar legível em
 * qualquer zoom.
 *
 * Um `Graphics` para todos os pinos e um `Text` por id que NUNCA é destruído
 * durante a sessão: `Text` destruído antes de ser renderizado derruba o Pixi
 * 8.20 em `TexturePool.returnTexture` — mesma regra de `drawRoomNames.ts` e
 * `drawConcealZones.ts`. Pino apagado só fica invisível.
 */
/**
 * Símbolo dentro da cabeça — o escolhido pelo mestre ou a passagem do pino de
 * viagem —, a partir da forma normalizada de `lib/pins.ts`. Desenhado no MESMO
 * `Graphics` do pino — um símbolo é traço, não texto, e desenhá-lo aqui evita
 * mais um `Text` por pino (ver o aviso de `TexturePool.returnTexture` no
 * cabeçalho deste arquivo).
 */
function drawShape(graphics: Graphics, shape: PinSymbolShape, cx: number, cy: number, color: number): void {
  const px = (n: number) => cx + n * SYMBOL_RADIUS
  const py = (n: number) => cy + n * SYMBOL_RADIUS
  const traco = { width: SYMBOL_WIDTH, color, cap: 'round', join: 'round' } as const

  for (const stroke of shape.strokes) {
    const [primeiro, ...resto] = stroke.points
    if (primeiro === undefined) continue
    graphics.moveTo(px(primeiro.x), py(primeiro.y))
    for (const ponto of resto) graphics.lineTo(px(ponto.x), py(ponto.y))
    if (stroke.closed === true) graphics.lineTo(px(primeiro.x), py(primeiro.y))
    graphics.stroke(traco)
  }
  for (const ring of shape.rings ?? []) {
    graphics.circle(px(ring.x), py(ring.y), ring.r * SYMBOL_RADIUS).stroke(traco)
  }
  for (const dot of shape.dots ?? []) {
    graphics.circle(px(dot.x), py(dot.y), dot.r * SYMBOL_RADIUS).fill({ color })
  }
}

/** Cabeça do marcador ("!" e "?"): latão com contorno escuro e, se escolhido, o símbolo em traço escuro. */
function drawMarkerHead(graphics: Graphics, pin: Pin, headY: number): void {
  graphics.circle(pin.x, headY, PIN_HEAD_RADIUS).fill({ color: PIN_FILL }).stroke({ width: PIN_OUTLINE_WIDTH, color: PIN_OUTLINE })
  if (isPinIcon(pin.icon)) drawShape(graphics, PIN_SYMBOLS[pin.icon], pin.x, headY, GLYPH_COLOR)
}

/** Cabeça da alavanca: a mesma de latão do marcador, com a alavanca em traço escuro no lugar do glifo. */
function drawLeverHead(graphics: Graphics, pin: Pin, headY: number): void {
  graphics.circle(pin.x, headY, PIN_HEAD_RADIUS).fill({ color: PIN_FILL }).stroke({ width: PIN_OUTLINE_WIDTH, color: PIN_OUTLINE })
  drawShape(graphics, PIN_LEVER_SYMBOL, pin.x, headY, GLYPH_COLOR)
}

/** Cabeça do pino de viagem: escura, com aro e passagem na linha clara — apagada quando não tem par. */
function drawTravelHead(graphics: Graphics, pin: Pin, headY: number, unlinked: boolean): void {
  const linha = unlinked ? TRAVEL_LINE_UNLINKED : TRAVEL_LINE
  graphics.circle(pin.x, headY, PIN_HEAD_RADIUS).fill({ color: TRAVEL_HEAD_FILL }).stroke({ width: PIN_OUTLINE_WIDTH, color: linha })
  drawShape(graphics, PIN_TRAVEL_SYMBOL, pin.x, headY, linha)
}

/** Traço do aro da chegada oculta: metade do contorno normal, fino como a parede do minimapa. */
const ARRIVAL_RING_WIDTH = PIN_OUTLINE_WIDTH / 2
/** Raio do ponto no meio da cabeça vazada, em fração do raio da cabeça. */
const ARRIVAL_DOT_RADIUS = PIN_HEAD_RADIUS * 0.22

/**
 * CHEGADA OCULTA (mão única): cabeça VAZADA — o chão aparece por dentro —,
 * com aro fino de latão e um ponto no meio, "aqui se chega". Nada de hachura
 * nem cor nova (estilo minimapa); a diferença lê pelo cheio que falta, e o
 * mestre sabe de relance que este pino não existe para o jogador.
 */
function drawArrivalHead(graphics: Graphics, pin: Pin, headY: number): void {
  graphics.circle(pin.x, headY, PIN_HEAD_RADIUS).stroke({ width: ARRIVAL_RING_WIDTH, color: TRAVEL_LINE })
  graphics.circle(pin.x, headY, ARRIVAL_DOT_RADIUS).fill({ color: TRAVEL_LINE })
}

/** O nome do mestre: letra pequena e clara, a da parede do minimapa — rótulo, não chamariz. */
const NAME_FONT_SIZE = 11
const NAME_COLOR = 0xe8e2d0
/** Contorno escuro do nome: legível sobre chão claro e sobre o preto da névoa. */
const NAME_OUTLINE = { color: PIN_OUTLINE, width: 3 } as const
/** Folga entre a cabeça do pino e o começo do nome, em px de mundo. */
const NAME_GAP = 4

export interface PinsRendererOptions {
  /**
   * Desenha o NOME SÓ DO MESTRE ao lado de cada pino. Só o editor liga: o
   * mapa do jogador usa este mesmo renderer, e lá o nome nunca é desenhado —
   * nem se um pino chegasse com ele (o recorte já o tira, `lib/fogFilter.ts`).
   */
  showNames?: boolean
}

export function createPinsRenderer(options: PinsRendererOptions = {}): PinsRenderer {
  const showNames = options.showNames === true
  const graphics = new Graphics()
  const glyphs = new Map<string, Text>()
  // Mesma regra dos glifos: um `Text` por id, nunca destruído (só invisível).
  const names = new Map<string, Text>()

  /** O nome ao lado da cabeça, à direita e na altura dela; sem nome, o rótulo some. */
  function drawName(container: Container, pin: Pin, headY: number): void {
    const nome = showNames ? cleanPinName(pin.nome) : ''
    let label = names.get(pin.id)
    if (nome === '') {
      if (label) label.visible = false
      return
    }
    if (!label) {
      label = new Text({ text: nome, style: { fontSize: NAME_FONT_SIZE, fill: NAME_COLOR, stroke: NAME_OUTLINE } })
      label.anchor.set(0, 0.5)
      names.set(pin.id, label)
    }
    if (label.parent !== container) container.addChild(label)
    label.text = nome
    label.position.set(pin.x + PIN_HEAD_RADIUS + NAME_GAP, headY)
    label.visible = true
  }

  function draw(container: Container, pins: readonly Pin[], selectedId: string | null, unlinkedIds?: ReadonlySet<string>): void {
    if (graphics.parent !== container) container.addChildAt(graphics, 0)
    graphics.clear()

    const ids = new Set(pins.map((p) => p.id))
    for (const [id, glyph] of glyphs) {
      if (!ids.has(id)) glyph.visible = false
    }
    for (const [id, label] of names) {
      if (!ids.has(id)) label.visible = false
    }

    for (const pin of pins) {
      const headY = pin.y - PIN_HEAD_OFFSET
      if (pin.id === selectedId) {
        graphics
          .circle(pin.x, headY, PIN_HEAD_RADIUS + SELECTED_RING_GAP)
          .stroke({ width: SELECTED_RING_WIDTH, color: SELECTION_COLOR })
      }
      // Haste: da ponta cravada até o meio da cabeça, para a gota ler como uma peça só.
      graphics
        .moveTo(pin.x, pin.y)
        .lineTo(pin.x, pin.y - PIN_HEIGHT + PIN_HEAD_RADIUS)
        .stroke({ width: PIN_OUTLINE_WIDTH + 2, color: PIN_OUTLINE, cap: 'round' })

      // Com símbolo (escolhido, ou a passagem do pino de viagem), é ELE que
      // ocupa a cabeça: o glifo sai de cena (invisível, nunca destruído) em
      // vez de dividir o espaço com o desenho.
      const viagem = pin.kind === 'viagem'
      const alavanca = pin.kind === 'alavanca'
      const comSimbolo = viagem || alavanca || isPinIcon(pin.icon)
      if (viagem && pin.soChegada === true) drawArrivalHead(graphics, pin, headY)
      else if (viagem) drawTravelHead(graphics, pin, headY, unlinkedIds?.has(pin.id) === true)
      else if (alavanca) drawLeverHead(graphics, pin, headY)
      else drawMarkerHead(graphics, pin, headY)
      drawName(container, pin, headY)

      let glyph = glyphs.get(pin.id)
      if (!glyph) {
        if (comSimbolo) continue
        glyph = new Text({
          text: PIN_GLYPH[pin.kind],
          style: { fontSize: GLYPH_FONT_SIZE, fontWeight: 'bold', fill: GLYPH_COLOR },
        })
        glyph.anchor.set(0.5)
        glyphs.set(pin.id, glyph)
      }
      if (glyph.parent !== container) container.addChild(glyph)
      glyph.text = PIN_GLYPH[pin.kind]
      glyph.position.set(pin.x, headY)
      glyph.visible = !comSimbolo
    }
  }

  return { draw }
}
