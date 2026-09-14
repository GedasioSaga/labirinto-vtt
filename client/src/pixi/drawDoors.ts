import type { Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { SELECTION_COLOR, STROKE_WEIGHT } from './constants'
import { screenSafeWidth } from './drawWalls'

/**
 * Cor de porta destrancada — MESMO valor RGB que `drawWalls.ts` hardcodava
 * antes desta mudança (ver risco nº 6 do plano: a responsabilidade de "isto
 * é uma porta" sai de `drawWalls.ts` e vem para cá; o número não muda de
 * propósito, senão todo mapa salvo trocaria de cor ao abrir).
 * Trancada ganha um vermelho — primeira vez que `DoorState.locked` (existe
 * no schema desde sempre, nunca teve leitor) afeta o que aparece na tela.
 */
const DOOR_COLOR = 0xd08c3a
const DOOR_LOCKED_COLOR = 0xc0392b

/** Meio-comprimento da ombreira (traço perpendicular à parede, nas duas
 *  pontas do vão) — mesma unidade de mundo (px) que o resto do canvas. */
const JAMB_HALF = 6

/** Ângulo de balanço da folha quando `door.open === true`, medido a partir
 *  da direção da própria parede. 55° sugere uma porta entreaberta sem
 *  invadir o vão vizinho em paredes curtas. */
const LEAF_OPEN_ANGLE = (55 * Math.PI) / 180

/** Espaçamento alvo entre barras do portão (`kind === 'gate'`), em px de
 *  mundo — barra a cada ~12px lê como grade sem virar hachura ilegível em
 *  vãos grandes (gate = 96px de vão → ~8 barras). */
const GATE_BAR_SPACING = 12

/**
 * Desenha uma ombreira: traço curto perpendicular à parede, centrado no
 * ponto `(x, y)`. Chamado duas vezes por porta (uma ponta do vão de cada
 * lado) — presente em todo `kind`, é o "batente" que marca onde a parede
 * sólida termina e o vão começa.
 */
function drawJamb(graphics: Graphics, x: number, y: number, px: number, py: number): void {
  graphics.moveTo(x - px * JAMB_HALF, y - py * JAMB_HALF).lineTo(x + px * JAMB_HALF, y + py * JAMB_HALF)
}

/**
 * Desenha uma folha de porta: uma linha saindo da dobradiça em `(hingeX, hingeY)`.
 * Fechada, ela se sobrepõe ao vão (`dirX, dirY` = sentido da parede). Aberta,
 * gira `LEAF_OPEN_ANGLE` em direção ao lado perpendicular `(perpX, perpY)` —
 * rotação de vetor por combinação linear na base ortonormal (dir, perp), sem
 * precisar de `atan2`/ângulo absoluto.
 */
function drawLeaf(
  graphics: Graphics,
  hingeX: number,
  hingeY: number,
  dirX: number,
  dirY: number,
  perpX: number,
  perpY: number,
  leafLength: number,
  open: boolean,
): void {
  const angle = open ? LEAF_OPEN_ANGLE : 0
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const endX = hingeX + (dirX * cos + perpX * sin) * leafLength
  const endY = hingeY + (dirY * cos + perpY * sin) * leafLength
  graphics.moveTo(hingeX, hingeY).lineTo(endX, endY)
}

/**
 * Desenha as barras do portão (`kind === 'gate'`) — grade perpendicular à
 * parede, uniformemente espaçada ao longo do vão. Gate não tem dobradiça
 * (não balança como folha): `open` encolhe as barras pela metade, sugerindo
 * grade erguida, em vez de girar algo que fisicamente desliza.
 */
function drawGateBars(
  graphics: Graphics,
  x1: number,
  y1: number,
  ux: number,
  uy: number,
  px: number,
  py: number,
  length: number,
  open: boolean,
): void {
  const barHalf = open ? JAMB_HALF * 0.35 : JAMB_HALF * 0.8
  const barCount = Math.max(2, Math.round(length / GATE_BAR_SPACING))
  for (let i = 0; i <= barCount; i += 1) {
    const t = (i / barCount) * length
    const bx = x1 + ux * t
    const by = y1 + uy * t
    graphics.moveTo(bx - px * barHalf, by - py * barHalf).lineTo(bx + px * barHalf, by + py * barHalf)
  }
}

/**
 * Renderer da camada 'portas' — ver `lib/layers.ts:wallLayer`. Recebe a MESMA
 * lista de walls já filtrada por `visibleWalls` que `drawWalls.ts` recebe
 * (filtro por camada é por-wall: parede com porta cai em 'portas', sem porta
 * cai em 'paredes' — passar a lista completa aqui é seguro porque o loop
 * abaixo ignora toda `wall.door === null`).
 *
 * `drawWalls.ts` desenha a LINHA da parede (mesma espessura/cor de sempre,
 * COM ou SEM porta — não distingue mais). Este arquivo desenha só o que
 * sobrepõe: ombreiras + folha(s)/barras, específico do `door.kind`. É o
 * reposicionamento do risco nº 6 do plano: a cor laranja de porta sai de
 * `drawWalls.ts:10` (histórico) e vem pra cá — o comportamento observável
 * (uma parede com porta continua visualmente distinta de uma sem) é o mesmo,
 * só o arquivo que desenha mudou.
 */
export function drawDoors(graphics: Graphics, walls: Wall[], selectedWallId: string | null = null, cameraScale = 1): void {
  graphics.clear()
  for (const wall of walls) {
    const door = wall.door
    if (!door) continue

    const dx = wall.x2 - wall.x1
    const dy = wall.y2 - wall.y1
    const length = Math.hypot(dx, dy)
    if (length === 0) continue

    const ux = dx / length
    const uy = dy / length
    // Perpendicular unitário (rotação de 90°) — usado pra ombreira e pro
    // balanço da folha/barra.
    const px = -uy
    const py = ux

    const isSelected = wall.id === selectedWallId
    const color = isSelected ? SELECTION_COLOR : door.locked ? DOOR_LOCKED_COLOR : DOOR_COLOR
    const strokeWidth = isSelected ? STROKE_WEIGHT.medium : STROKE_WEIGHT.thin

    drawJamb(graphics, wall.x1, wall.y1, px, py)
    drawJamb(graphics, wall.x2, wall.y2, px, py)

    if (door.kind === 'gate') {
      drawGateBars(graphics, wall.x1, wall.y1, ux, uy, px, py, length, door.open)
    } else if (door.kind === 'double') {
      // Duas folhas, uma dobradiça em cada ponta do vão, cada uma cobrindo
      // metade do comprimento — ambas giram pro mesmo lado (+perp) quando
      // abertas, convenção comum de porta dupla de duas folhas.
      drawLeaf(graphics, wall.x1, wall.y1, ux, uy, px, py, length / 2, door.open)
      drawLeaf(graphics, wall.x2, wall.y2, -ux, -uy, px, py, length / 2, door.open)
    } else {
      drawLeaf(graphics, wall.x1, wall.y1, ux, uy, px, py, length, door.open)
    }

    // Mesmo piso de 1 px de tela das paredes: sem antialias a folha fina some com zoom baixo.
    graphics.stroke({ width: screenSafeWidth(strokeWidth, cameraScale), color })
  }
}
