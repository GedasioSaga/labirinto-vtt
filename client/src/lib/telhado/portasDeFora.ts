import type { Region, RegionPoint, Wall } from '../../types/map'
import { isPointExplored, type Exploration } from '../exploration'
import { wallLineSamples } from '../fogFilter'
import { roomHasRoof } from '../roomOps'
import { pointInPolygonInclusive, pointOnPolygonBorder } from '../roomNesting'

/*
 * PORTA VISÍVEL POR CIMA DO TELHADO (pedido de 20/10/2026). Na tela do
 * jogador o telhado fica acima das paredes e portas, então de fora ele não via
 * por onde entrar. Regra pura, sem Pixi: quais portas sobem para a camada
 * `portasNoTelhado` (`player/PlayerView.tsx`).
 *
 * Decisões do usuário:
 * - só a porta DE FORA: na borda de uma Sala com teto, com o outro lado fora de
 *   qualquer Sala com teto. Porta entre duas Salas com teto segue escondida;
 *   entre Sala com teto e Sala sem teto, aparece;
 * - só a porta que o jogador vê ou já viu: o ponto meia casa para fora dela tem
 *   de estar na visão de agora ou no explorado. A dos fundos só surge depois de
 *   ele dar a volta.
 */

/** Folga para a porta contar como da BORDA da Sala: a mesma de `OPENING_BORDER_TOLERANCE` (`lib/fogFilter.ts`). */
const TOLERANCIA_DA_BORDA = 2
/**
 * Distância da sonda que decide de que lado da porta fica o interior: além da
 * folga da borda (a porta pode estar até 2 px fora da linha), para a sonda de
 * dentro nunca cair "em cima do muro".
 */
const SONDA_DO_LADO_PX = 4

export interface SalaComTeto {
  id: string
  points: readonly RegionPoint[]
}

export interface PortaDeFora {
  parede: Wall
  /** Salas com teto de cuja borda esta é porta de fora (duas quando o quarto encosta na parede de fora da casa). */
  salaIds: string[]
  /** Meia casa para fora do meio da porta, pela normal, do lado de fora da Sala: é o que o jogador tem de ter visto. */
  fora: RegionPoint
}

/** Só Sala com teto ligado (`roomHasRoof`) e polígono de verdade: as mesmas que viram telhado na tela do jogador. */
export function salasComTetoDe(regions: readonly Region[]): SalaComTeto[] {
  return regions.filter((r) => roomHasRoof(r.room) && r.points.length >= 3).map((r) => ({ id: r.id, points: r.points }))
}

function dentroDe(p: RegionPoint, pontos: readonly RegionPoint[]): boolean {
  return pointInPolygonInclusive(p, pontos) && !pointOnPolygonBorder(p, pontos)
}

/** Unidade que vai do meio da porta para FORA da Sala, ou `null` se a geometria não diz qual lado é qual. */
function normalParaFora(parede: Wall, sala: SalaComTeto): RegionPoint | null {
  const dx = parede.x2 - parede.x1
  const dy = parede.y2 - parede.y1
  const comprimento = Math.hypot(dx, dy)
  if (!(comprimento > 0)) return null
  const nx = -dy / comprimento
  const ny = dx / comprimento
  const mx = (parede.x1 + parede.x2) / 2
  const my = (parede.y1 + parede.y2) / 2
  const ladoPositivo = dentroDe({ x: mx + nx * SONDA_DO_LADO_PX, y: my + ny * SONDA_DO_LADO_PX }, sala.points)
  const ladoNegativo = dentroDe({ x: mx - nx * SONDA_DO_LADO_PX, y: my - ny * SONDA_DO_LADO_PX }, sala.points)
  // Dentro dos dois lados ou de nenhum (sala mais fina que a sonda, polígono torto): na dúvida, o telhado cobre como antes.
  if (ladoPositivo === ladoNegativo) return null
  return ladoPositivo ? { x: -nx, y: -ny } : { x: nx, y: ny }
}

/**
 * As portas de fora das Salas com teto, na ordem de `walls`. A porta tem de
 * estar com o traço INTEIRO na borda da Sala (pontas, quartos e meio, como o
 * vão de `lib/fogFilter.ts`), e o ponto meia casa para fora dela não pode cair
 * dentro de outra Sala com teto. Grade inválida: nenhuma.
 */
export function portasDeFora(walls: readonly Wall[], salasComTeto: readonly SalaComTeto[], grid: number): PortaDeFora[] {
  if (!Number.isFinite(grid) || grid <= 0 || salasComTeto.length === 0) return []
  const meiaCasa = grid / 2
  const out: PortaDeFora[] = []
  for (const parede of walls) {
    if (parede.door === null) continue
    const amostras = wallLineSamples(parede)
    const mx = (parede.x1 + parede.x2) / 2
    const my = (parede.y1 + parede.y2) / 2
    let achada: PortaDeFora | null = null
    for (const sala of salasComTeto) {
      if (!amostras.every((p) => pointOnPolygonBorder(p, sala.points, TOLERANCIA_DA_BORDA))) continue
      const normal = normalParaFora(parede, sala)
      if (normal === null) continue
      const fora = { x: mx + normal.x * meiaCasa, y: my + normal.y * meiaCasa }
      if (salasComTeto.some((outra) => outra.id !== sala.id && pointInPolygonInclusive(fora, outra.points))) continue
      if (achada === null) achada = { parede, salaIds: [sala.id], fora }
      else achada.salaIds.push(sala.id)
    }
    if (achada !== null) out.push(achada)
  }
  return out
}

/** O jogador vê ou já viu o lado de fora da porta: na visão de agora ou no explorado. */
export function portaJaVista(
  porta: Pick<PortaDeFora, 'fora'>,
  visao: readonly (readonly RegionPoint[])[],
  explorado: Exploration | undefined,
): boolean {
  if (visao.some((anel) => anel.length >= 3 && pointInPolygonInclusive(porta.fora, anel))) return true
  return explorado !== undefined && isPointExplored(explorado, porta.fora)
}

/**
 * As paredes que vão para a camada de cima: porta de fora de algum telhado que
 * está à vista agora (`TelhadosRenderer.idsVisiveis`, que inclui o que ainda
 * está sumindo) e com o lado de fora visto.
 */
export function portasNoTelhado(
  portas: readonly PortaDeFora[],
  idsVisiveis: ReadonlySet<string>,
  visao: readonly (readonly RegionPoint[])[],
  explorado: Exploration | undefined,
): Wall[] {
  return portas.filter((p) => p.salaIds.some((id) => idsVisiveis.has(id)) && portaJaVista(p, visao, explorado)).map((p) => p.parede)
}
