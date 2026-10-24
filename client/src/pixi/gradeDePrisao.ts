import type { Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { numeroDoRgb, tonsDoMeio } from '../texturas/meioTermo/tons'

/**
 * GRADE DE PRISÃO vista de cima (Meio-Termo, fatia MT10): a parede `janela`
 * com `grade` (`types/map.ts`) vira o TRILHO de ferro ao longo da parede e a
 * CABEÇA de cada barra (um círculo), espaçadas por igual. Cada barra tem o
 * contorno escuro da própria cor (nunca preto), um realce pequeno em cima e à
 * esquerda (a luz do mapa) e uma sombra curta no chão, embaixo e à direita.
 *
 * Tamanho em px do MUNDO (a grade é um objeto, cresce com o zoom), com piso em
 * px de TELA para não sumir no zoom longe: o raio e o trilho nunca ficam abaixo
 * de 2 px de tela e o passo nunca abaixo de 7 px de tela (no zoom longe as
 * barras ficam mais espaçadas, em vez de virar uma faixa).
 *
 * Só desenho: quem deixa ver e barra o passo é a `janela` (`lib/visibility.ts`,
 * `lib/collision.ts`). Quem chama (`drawWalls.ts`) só chega aqui com a chave
 * de obra ligada; desligada, a janela de traço duplo de sempre.
 */

/** Passo entre as barras, em px do mundo (5 barras por casa de 50). */
export const PASSO_DA_GRADE_PX = 10
/**
 * Raio da cabeça da barra e largura do trilho, em px do mundo. MT10b (pedido do
 * usuário em 24/10: a 50% e a 100% a grade parecia pontilhado): o trilho foi de
 * 1,6 para 2,6 e a barra de 1,9 para 2,6 de raio, para ler como trilho
 * contínuo com contas (a conta sai do trilho dos dois lados e, entre duas,
 * sobra trilho à vista).
 */
export const RAIO_DA_BARRA_PX = 2.6
export const LARGURA_DO_TRILHO_PX = 2.6
const CONTORNO_PX = 0.8
/** Pisos em px de TELA (MT10b: raio 1,2 -> 2, trilho 1 -> 2, passo 4 -> 7). */
const RAIO_MINIMO_NA_TELA = 2
const PASSO_MINIMO_NA_TELA = 7
const CONTORNO_MINIMO_NA_TELA = 0.75
const TRILHO_MINIMO_NA_TELA = 2
/** Folga entre barras: o passo nunca fica menor que 2,6 raios (as cabeças não se encostam). */
const PASSO_EM_RAIOS = 2.6
const SOMBRA_ALFA = 0.3

const FERRO = tonsDoMeio('ferro')

/** As cores da grade (números do Pixi), da paleta do Meio-Termo. */
export const CORES_DA_GRADE = {
  base: numeroDoRgb(FERRO.base),
  realce: numeroDoRgb(FERRO.realce),
  contorno: numeroDoRgb(FERRO.contorno),
} as const

export interface GeometriaDaGrade {
  /** Centro da cabeça de cada barra, em px do mundo. */
  readonly barras: readonly { readonly x: number; readonly y: number }[]
  /** Raio da cabeça, em px do mundo. */
  readonly raio: number
  readonly trilho: number
  readonly contorno: number
}

function escalaUsavel(cameraScale: number): number {
  return Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
}

/** Onde ficam as barras desta parede, neste zoom. Parede sem comprimento: nenhuma barra. */
export function geometriaDaGrade(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>, cameraScale: number): GeometriaDaGrade {
  const escala = escalaUsavel(cameraScale)
  const raio = Math.max(RAIO_DA_BARRA_PX, RAIO_MINIMO_NA_TELA / escala)
  const contorno = Math.max(CONTORNO_PX, CONTORNO_MINIMO_NA_TELA / escala)
  const trilho = Math.max(LARGURA_DO_TRILHO_PX, TRILHO_MINIMO_NA_TELA / escala)
  const comprimento = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (!(comprimento > 0)) return { barras: [], raio, trilho, contorno }
  const passoMinimo = Math.max(PASSO_DA_GRADE_PX, PASSO_MINIMO_NA_TELA / escala, raio * PASSO_EM_RAIOS)
  const n = Math.max(1, Math.floor(comprimento / passoMinimo))
  const ux = (wall.x2 - wall.x1) / comprimento
  const uy = (wall.y2 - wall.y1) / comprimento
  const barras: { x: number; y: number }[] = []
  for (let i = 0; i < n; i += 1) {
    const t = ((i + 0.5) * comprimento) / n
    barras.push({ x: wall.x1 + ux * t, y: wall.y1 + uy * t })
  }
  return { barras, raio, trilho, contorno }
}

/** Desenha a grade no `Graphics` (sem `clear`: mora junto das outras paredes). */
export function desenharGrade(graphics: Graphics, wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>, cameraScale: number): void {
  const geo = geometriaDaGrade(wall, cameraScale)
  if (geo.barras.length === 0) return
  const { raio, trilho, contorno } = geo
  // Trilho: o contorno por baixo, o ferro por cima.
  graphics.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2)
  graphics.stroke({ width: trilho + 2 * contorno, color: CORES_DA_GRADE.contorno, cap: 'round' })
  graphics.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2)
  graphics.stroke({ width: trilho, color: CORES_DA_GRADE.base, cap: 'round' })
  // Sombra curta das barras no chão, embaixo e à direita.
  for (const b of geo.barras) graphics.circle(b.x + raio * 0.45, b.y + raio * 0.6, raio)
  graphics.fill({ color: CORES_DA_GRADE.contorno, alpha: SOMBRA_ALFA })
  // A cabeça de cada barra, com o contorno da própria cor.
  for (const b of geo.barras) graphics.circle(b.x, b.y, raio)
  graphics.fill({ color: CORES_DA_GRADE.base })
  for (const b of geo.barras) graphics.circle(b.x, b.y, raio)
  graphics.stroke({ width: contorno, color: CORES_DA_GRADE.contorno })
  // O realce da luz (de cima, à esquerda).
  for (const b of geo.barras) graphics.circle(b.x - raio * 0.32, b.y - raio * 0.32, raio * 0.38)
  graphics.fill({ color: CORES_DA_GRADE.realce })
}
