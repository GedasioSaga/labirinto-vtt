import type { Graphics } from 'pixi.js'
import type { DoorState, Wall } from '../types/map'
import { corPropriaDaPorta } from '../lib/corDaPorta'
import {
  CONTORNO_DA_PORTA,
  desenharBatente,
  desenharFolhaFechada,
  pintarFolha,
  tracarRetanguloDaPorta as traceDoorRect,
  type AnimacaoDePorta,
  type PecaDaFolha,
  type PortaParaDesenho,
} from '../portas/animacoesDePorta'
import { SELECTION_COLOR } from './constants'
import { selectionOutlineWidth } from './drawWalls'
import { alignToPixel, pixelGrid, strokeWidthInWorld } from './pixelAlign'

/**
 * DESENHO DA PORTA DE 22/10/2026 (o `.mapa .porta-folha` do protótipo
 * consolidado, escolhido pelo usuário: "eu prefiro ela assim"): a folha é uma
 * barra CREME com contorno escuro que enche o vão até a parede; trancada é a
 * mesma barra em vermelho (o `--lb-color-ember`). Mapa salvo não muda: a cor
 * sai do estado, não do arquivo.
 */
export const DOOR_COLOR = 0xd9d2c0
export const DOOR_LOCKED_COLOR = 0xe2645a
/** O contorno escuro da folha, 1 px de TELA centrado na borda dela (como o `stroke-width: 1` do SVG). */
export const DOOR_EDGE_COLOR = CONTORNO_DA_PORTA
export const DOOR_EDGE_SCREEN_PX = 1

/**
 * A cor com que a porta é pintada: a própria (`DoorState.cor`, fatia 22) nos
 * três estados; sem ela, o creme de sempre e o vermelho da trancada.
 */
export function corDaPortaNoMapa(door: Pick<DoorState, 'cor' | 'locked'>): number {
  return corPropriaDaPorta(door) ?? (door.locked ? DOOR_LOCKED_COLOR : DOOR_COLOR)
}

/**
 * TRANCADA COM COR PRÓPRIA: a cor já não diz "trancada", então a porta ganha
 * um contorno vermelho POR FORA do contorno escuro e um cadeado pequeno no
 * meio. Tudo chapado e opaco, em px de TELA: a cópia da porta por cima do
 * telhado (`player/PlayerView.tsx`) pinta o mesmo desenho em cima, e alfa somaria.
 */
export const DOOR_LOCKED_RING_SCREEN_PX = 1.5
/**
 * O CADEADO (o do protótipo `docs/design/porta-animacoes`): corpo de 6 por 5 px
 * de tela, alça de raio 1,75 px e traço de 1 px, fixos na tela (nunca crescem
 * com o zoom). Corpo creme e traço vermelho: lê sobre qualquer cor de porta,
 * até a vermelha, onde o traço some e o corpo claro fica.
 */
export const DOOR_PADLOCK_BODY_W_SCREEN_PX = 6
export const DOOR_PADLOCK_BODY_H_SCREEN_PX = 5
export const DOOR_PADLOCK_SHACKLE_R_SCREEN_PX = 1.75
export const DOOR_PADLOCK_STROKE_SCREEN_PX = 1
export const DOOR_PADLOCK_FILL = 0xf4ead8

/**
 * A folha enche o VÃO INTEIRO, de parede a parede (antes, 60% dele, com folga
 * até a parede). A espessura fica fixa na TELA, como a parede, para a porta
 * continuar legível de longe e não virar um bloco de perto.
 */
export const DOOR_LENGTH_RATIO = 1
export const DOOR_THICKNESS_SCREEN_PX = 4
/**
 * Porta aberta: a mesma caixa, com o miolo vazado em escuro; sobra um traço
 * claro desta espessura de tela de cada lado (`desenharBatente`).
 */
export const DOOR_OPEN_OUTLINE_SCREEN_PX = 1

/**
 * PORTAS POR ATRAVESSAR (só na tela do jogador): ponto no meio da porta cujo
 * outro lado ainda está na névoa para ele. Escuro sobre a folha fechada (como
 * no protótipo); na aberta, cujo miolo já é escuro, sai na cor da porta. Raio
 * em px de TELA, que cabe na espessura em qualquer zoom: marca discreta de
 * minimapa, sem ícone nem halo.
 */
export const DOOR_TO_CROSS_COLOR = DOOR_EDGE_COLOR
export const DOOR_TO_CROSS_DOT_SCREEN_PX = 1.5
/**
 * O ponto com a porta ANDANDO: o que está debaixo dele muda a cada quadro
 * (folha, chão, miolo), então ele vira dois tons e um dos dois sempre
 * contrasta: o miolo escuro do ponto parado e, em volta, um anel na cor da
 * porta que cresce até este tanto de tela no meio do caminho e volta. Sobre a
 * folha, o escuro cai na faixa clara e o anel no contorno escuro; sobre o chão
 * ou o miolo da aberta, o anel. O miolo escuro some no último trecho
 * (`DOOR_TO_CROSS_CORE_FADE_FROM` até 1). Nos extremos é o ponto da porta
 * parada (escuro em 0, cor da porta em 1), sem salto ao começar e ao parar.
 */
export const DOOR_TO_CROSS_RING_SCREEN_PX = 1
export const DOOR_TO_CROSS_CORE_FADE_FROM = 0.75

/**
 * Renderer da camada 'portas' — ver `lib/layers.ts:wallLayer`. Recebe a MESMA
 * lista de walls já filtrada por `visibleWalls` que `drawWalls.ts` recebe; o
 * loop ignora toda `wall.door === null`. A linha da parede com porta não é
 * desenhada (o vão é da porta), então a folha fica sozinha no vão.
 *
 * `door.kind` (normal, dupla, portão) continua no dado e no painel, mas todos
 * aparecem como a mesma folha: no minimapa o que importa é o estado.
 *  - fechada: barra creme cheia, contorno escuro;
 *  - trancada: a barra vermelha (aberta + trancada também fica cheia: o
 *    cadeado vale mais que a folha);
 *  - aberta: a caixa com o miolo escuro (`desenharBatente`).
 *
 * COR PRÓPRIA (`door.cor`, fatia 22): a cor dela no lugar do creme e do
 * vermelho, nos três estados (`corDaPortaNoMapa`), e o contorno escuro fica. A
 * trancada ganha o contorno vermelho por fora e o cadeado no meio; a secreta
 * tracejada e a seta de um lado usam a mesma cor. Porta secreta nunca leva
 * cadeado (o contorno juntaria os traços num retângulo, e o cadeado diria
 * "porta" onde o jogador vê parede).
 *
 * Porta de sala secreta não chega aqui para o jogador (fogFilter.ts corta a
 * parede) e o editor desenha igual às outras, como antes. PORTA SECRETA
 * (`door.secret`) também não chega ao jogador como porta (vira parede em
 * fogFilter.ts); no editor sai tracejada (`traceSecretDashes`).
 *
 * `toCross` (PORTAS POR ATRAVESSAR, só o jogador passa): ids das portas que
 * levam o ponto no meio. O editor não passa e desenha como sempre.
 *
 * `animando` (PORTA ANIMADA, `pixi/animadorDePortas.ts`): ids das portas no
 * meio do abrir/fechar, desenhadas pela animação escolhida em vez do estado.
 * Porta secreta nunca anima: aberta ou fechada, ela é a mesma tracejada.
 * Seleção, seta de um lado e ponto de atravessar continuam por cima, iguais.
 */
export function drawDoors(
  graphics: Graphics,
  walls: Wall[],
  selectedWallId: string | null = null,
  cameraScale = 1,
  rendererResolution = 1,
  toCross: ReadonlySet<string> = NO_DOORS_TO_CROSS,
  animando: ReadonlyMap<string, PortaAnimando> = NENHUMA_ANIMANDO,
): void {
  graphics.clear()
  const screenPx = 1 / (Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1)
  const thicknessPixel = pixelGrid(cameraScale, rendererResolution, DOOR_THICKNESS_SCREEN_PX)
  const edgePixel = pixelGrid(cameraScale, rendererResolution, DOOR_EDGE_SCREEN_PX)
  // O centro se alinha pela caixa de FORA (folha + contorno): com o contorno
  // centrado na borda, a caixa de fora e a cor de dentro têm a mesma paridade
  // de pixels, e as duas bordas caem em pixel físico inteiro, nítidas.
  const outerPixel = { pxPerWorld: thicknessPixel.pxPerWorld, physicalWidth: thicknessPixel.physicalWidth + edgePixel.physicalWidth }
  const thickness = strokeWidthInWorld(thicknessPixel)
  const edge = strokeWidthInWorld(edgePixel)
  const outlineWidth = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, DOOR_OPEN_OUTLINE_SCREEN_PX))
  const selectionWidth = selectionOutlineWidth(cameraScale)
  const lockedRingWidth = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, DOOR_LOCKED_RING_SCREEN_PX))

  for (const wall of walls) {
    const door = wall.door
    if (!door) continue

    const dx = wall.x2 - wall.x1
    const dy = wall.y2 - wall.y1
    const length = Math.hypot(dx, dy)
    if (length === 0) continue

    const cx = alignToPixel((wall.x1 + wall.x2) / 2, outerPixel)
    const cy = alignToPixel((wall.y1 + wall.y2) / 2, outerPixel)
    const ux = dx / length
    const uy = dy / length
    const halfLength = (length * DOOR_LENGTH_RATIO) / 2
    const filled = door.locked || !door.open
    const color = corDaPortaNoMapa(door)
    const secreta = door.secret === true
    const cadeado = door.locked && !secreta && corPropriaDaPorta(door) !== null
    const ring = cadeado ? lockedRingWidth : 0
    // Até onde a porta vai, com o contorno escuro: o que fica por fora (anel, seleção, seta) começa aqui.
    const outerHalfLength = halfLength + edge / 2
    const outerHalfThickness = thickness / 2 + edge / 2

    // Seleção NÃO troca a cor: moldura em SELECTION_COLOR POR FORA da porta
    // (`SELECTION_OUTLINE_SCREEN_PX` de tela), mesma regra da parede — e por
    // fora do contorno vermelho, que senão a cobriria.
    if (wall.id === selectedWallId) {
      traceDoorRect(graphics, cx, cy, ux, uy, outerHalfLength + ring + selectionWidth / 2, outerHalfThickness + ring + selectionWidth / 2)
      graphics.stroke({ width: selectionWidth, color: SELECTION_COLOR, join: 'miter' })
    }

    const porta: PortaParaDesenho = {
      x1: wall.x1,
      y1: wall.y1,
      x2: wall.x2,
      y2: wall.y2,
      cx,
      cy,
      ux,
      uy,
      meioComprimento: halfLength,
      espessura: thickness,
      contorno: outlineWidth,
      cor: color,
      escala: cameraScale,
      borda: edge,
      corDaBorda: DOOR_EDGE_COLOR,
    }
    const emAnimacao = secreta ? undefined : animando.get(wall.id)
    const animou = emAnimacao !== undefined && desenharAnimando(graphics, emAnimacao, porta)
    if (secreta) traceSecretDashes(graphics, porta)
    else if (!animou) drawDoorAtRest(graphics, porta, filled)
    if (ring > 0) {
      traceDoorRect(graphics, cx, cy, ux, uy, outerHalfLength + ring / 2, outerHalfThickness + ring / 2)
      graphics.stroke({ width: ring, color: DOOR_LOCKED_COLOR, join: 'miter' })
    }
    if (cadeado) drawPadlock(graphics, cx, cy, cameraScale)

    if (door.opensFrom !== undefined) {
      const arrowLength = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, ONE_SIDE_ARROW_SCREEN_PX))
      const gap = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, ONE_SIDE_ARROW_GAP_SCREEN_PX))
      // Normal (-uy, ux) aponta para o lado 'right' (`lib/doorReach.ts:sideOfWall`).
      const sign = door.opensFrom === 'right' ? 1 : -1
      traceOneSideArrow(graphics, cx, cy, ux, uy, sign, outerHalfThickness + gap, arrowLength, Math.min(halfLength, arrowLength * 0.7))
      graphics.fill({ color }).stroke({ width: edge, color: DOOR_EDGE_COLOR, join: 'miter' })
    }

    if (!secreta && toCross.has(wall.id)) drawToCrossDot(graphics, cx, cy, screenPx, color, animou ? emAnimacao.progresso : filled ? 0 : 1)
  }
}

const NO_DOORS_TO_CROSS: ReadonlySet<string> = new Set()

/**
 * O ponto de PORTAS POR ATRAVESSAR em `progresso` (0 = a cara da fechada, 1 = a
 * da aberta; a porta parada passa 0 ou 1). Disco na cor da porta de raio `DOT
 * + RING × sen(π·p)` e, por cima, o miolo escuro de raio `DOT`, que encolhe
 * suave a partir de `CORE_FADE_FROM` até sumir em 1. Em 0 só o escuro (o disco
 * claro, do mesmo tamanho, fica coberto e nem é pintado); em 1 só o claro.
 */
function drawToCrossDot(graphics: Graphics, cx: number, cy: number, screenPx: number, doorColor: number, progresso: number): void {
  const p = Math.min(1, Math.max(0, progresso))
  // sen(π) dá 1e-16, não 0: os extremos saem exatos, e o ponto parado continua uma instrução só.
  const onda = p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p)
  const ring = (DOOR_TO_CROSS_DOT_SCREEN_PX + DOOR_TO_CROSS_RING_SCREEN_PX * onda) * screenPx
  const fade = Math.min(1, Math.max(0, (p - DOOR_TO_CROSS_CORE_FADE_FROM) / (1 - DOOR_TO_CROSS_CORE_FADE_FROM)))
  const core = DOOR_TO_CROSS_DOT_SCREEN_PX * (1 - fade * fade * (3 - 2 * fade)) * screenPx
  if (ring > core) graphics.circle(cx, cy, ring).fill({ color: doorColor })
  if (core > 0) graphics.circle(cx, cy, core).fill({ color: DOOR_TO_CROSS_COLOR })
}

/**
 * PORTA DE UM LADO (`door.opensFrom`), só no editor — o jogador nunca recebe o
 * campo (`lib/fogFilter.ts`): um triângulo chapado no lado que abre, com a
 * ponta virada para a porta, na cor dela e com o contorno escuro. Tamanho fixo
 * na tela, como a espessura.
 */
export const ONE_SIDE_ARROW_SCREEN_PX = 8
export const ONE_SIDE_ARROW_GAP_SCREEN_PX = 3

function traceOneSideArrow(graphics: Graphics, cx: number, cy: number, ux: number, uy: number, sign: number, tipDistance: number, arrowLength: number, halfBase: number): void {
  const nx = -uy * sign
  const ny = ux * sign
  const tipX = cx + nx * tipDistance
  const tipY = cy + ny * tipDistance
  const baseX = cx + nx * (tipDistance + arrowLength)
  const baseY = cy + ny * (tipDistance + arrowLength)
  graphics.poly([tipX, tipY, baseX + ux * halfBase, baseY + uy * halfBase, baseX - ux * halfBase, baseY - uy * halfBase], true)
}

/**
 * PORTA SECRETA no editor: a mesma folha, partida em `SECRET_DOOR_DASHES`
 * pedaços com vão igual entre eles, cada um com o contorno escuro —
 * "tracejada", para o mestre saber que o jogador vê ali só a parede. A cor
 * segue a regra de sempre (trancada vermelha). Aberta também sai tracejada:
 * enquanto secreta, ela é parede para o jogador (`lib/collision.ts`), então
 * "aberta" não tem cara própria.
 */
export const SECRET_DOOR_DASHES = 3

function traceSecretDashes(graphics: Graphics, porta: PortaParaDesenho): void {
  // n traços e n-1 vãos do mesmo tamanho cobrem o comprimento inteiro da porta.
  const piece = (2 * porta.meioComprimento) / (2 * SECRET_DOOR_DASHES - 1)
  const pecas: PecaDaFolha[] = []
  for (let i = 0; i < SECRET_DOOR_DASHES; i += 1) {
    const offset = -porta.meioComprimento + piece * (2 * i) + piece / 2
    pecas.push({ forma: 'retangulo', cx: porta.cx + porta.ux * offset, cy: porta.cy + porta.uy * offset, dx: porta.ux, dy: porta.uy, meioComprimento: piece / 2, meiaEspessura: porta.espessura / 2 })
  }
  pintarFolha(graphics, porta, pecas)
}

/**
 * O CADEADO da trancada com cor própria, em pé na TELA (não gira com a parede:
 * é ícone, não folha) e centrado na porta: a alça em meia-volta sobre o corpo.
 * Tamanho fixo em px de tela, como a espessura.
 */
function drawPadlock(graphics: Graphics, cx: number, cy: number, cameraScale: number): void {
  const px = 1 / (Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1)
  const width = DOOR_PADLOCK_BODY_W_SCREEN_PX * px
  const height = DOOR_PADLOCK_BODY_H_SCREEN_PX * px
  const shackle = DOOR_PADLOCK_SHACKLE_R_SCREEN_PX * px
  const stroke = DOOR_PADLOCK_STROKE_SCREEN_PX * px
  // O corpo desce 1 px para o conjunto (alça + corpo) ficar centrado na porta.
  const top = cy - height / 2 + px
  graphics
    .moveTo(cx - shackle, top)
    .lineTo(cx - shackle, top - px)
    .arc(cx, top - px, shackle, Math.PI, Math.PI * 2)
    .lineTo(cx + shackle, top)
    .stroke({ width: stroke * 1.25, color: DOOR_LOCKED_COLOR })
  graphics.rect(cx - width / 2, top, width, height).fill({ color: DOOR_PADLOCK_FILL }).stroke({ width: stroke, color: DOOR_LOCKED_COLOR, join: 'miter' })
}

/**
 * Uma porta no meio do caminho entre fechada e aberta: o desenho dela sai da
 * animação, não do estado. Vale até o tween terminar; daí a porta volta a
 * ser desenhada pelo estado, idêntica à de sempre.
 */
export interface PortaAnimando {
  animacao: AnimacaoDePorta
  /** 0 = fechada, 1 = aberta, já com a curva aplicada. */
  progresso: number
  abrindo: boolean
}

const NENHUMA_ANIMANDO: ReadonlyMap<string, PortaAnimando> = new Map()

/**
 * A porta parada: fechada (ou trancada) é a folha cheia; aberta, o batente.
 * São os MESMOS ajudantes que as animações chamam nos extremos
 * (`desenharFolhaFechada`, `desenharBatente`): o começo e o fim de toda
 * animação são este desenho, instrução por instrução.
 */
function drawDoorAtRest(graphics: Graphics, porta: PortaParaDesenho, filled: boolean): void {
  if (filled) desenharFolhaFechada(graphics, porta)
  else desenharBatente(graphics, porta)
}

/**
 * Desenha a porta pela animação. Devolve `false` se a animação quebrou (código
 * de pacote com defeito): quem chama desenha o estado final, e o path que a
 * animação deixou pela metade é descartado para não vazar no próximo `fill`.
 */
function desenharAnimando(graphics: Graphics, animando: PortaAnimando, porta: PortaParaDesenho): boolean {
  try {
    animando.animacao.desenhar(graphics, porta, animando.progresso, animando.abrindo)
    return true
  } catch {
    graphics.beginPath()
    return false
  }
}
