import type { Point } from '../../pixi/world'
import type { Segment } from '../visibility'
import { type Casa, centroDaCasa } from './blocos'

/**
 * MEDIÇÃO DO MODO BATALHA (fatia B2 de docs/planos/modo-batalha-2026-10-24.md):
 * círculo, cone e linha de visão na grade quadrada, com as casas e a conta de
 * blocos (diagonal = 1) de `blocos.ts`.
 *
 * Círculo e cone são só geometria da grade: não leem parede. A visão recebe os
 * obstáculos prontos — os de `visionSegments(recorte, espiadas)`
 * (`lib/visibility.ts`), a mesma conta da névoa do jogador —, então o que o
 * mestre esconde na tela dele (olho da camada, opacidade, parede invisível)
 * não muda resposta nenhuma.
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

/** O tamanho do mapa, em casas: o que passa da borda não entra na medida. */
export interface LimitesDaGrade {
  readonly colunas: number
  readonly linhas: number
}

export type Direcao8 = 'leste' | 'sudeste' | 'sul' | 'sudoeste' | 'oeste' | 'noroeste' | 'norte' | 'nordeste'

/** As 8 direções do cone (decisão 5), na ordem dos ponteiros do relógio na tela (y para baixo), a partir de leste. */
export const DIRECOES_EM_ORDEM: readonly Direcao8[] = ['leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste']

/** Um passo de 1 bloco em cada direção, em (colunas, linhas), com y para baixo. */
export const PASSO_DA_DIRECAO: Readonly<Record<Direcao8, readonly [number, number]>> = {
  leste: [1, 0],
  sudeste: [1, 1],
  sul: [0, 1],
  sudoeste: [-1, 1],
  oeste: [-1, 0],
  noroeste: [-1, -1],
  norte: [0, -1],
  nordeste: [1, -1],
}

/**
 * Meia abertura do cone: atan(1/2), uns 26,57°, a do protótipo
 * (docs/design/batalha-isometrica/README.md) — a largura cresce junto com a
 * distância. O cosseno dela ao quadrado é 4/5: a conta fica em inteiros, sem
 * erro de arredondamento na casa que cai bem na beira.
 */
const COSSENO2_DA_ABERTURA = { numerador: 4, denominador: 5 }

/** Folga do toque, em px: a mesma de `hasLineOfSight` (`lib/visibility.ts`). Tocar só a origem não cega; o alvo em cima do obstáculo conta como visto. */
const TOQUE_MINIMO = 1e-6
/** Abaixo disto a linha e o obstáculo são paralelos (a mesma folga de `lib/visibility.ts`). */
const QUASE_PARALELO = 1e-12

/**
 * A resposta da visão: livre, ou barrada no primeiro obstáculo que a linha
 * encontra — o ponto, em px de mundo, e o índice dele na lista recebida.
 */
export type LinhaDeVisao = { readonly livre: true } | { readonly livre: false; readonly ponto: Point; readonly obstaculo: number }

function casaInteira(casa: Casa): boolean {
  return Number.isInteger(casa.col) && Number.isInteger(casa.row)
}

/** O alcance em blocos inteiros (quebrado arredonda para baixo); `null` quando não é número ou é negativo. */
function alcanceEmBlocos(valor: number): number | null {
  if (Number.isNaN(valor) || valor < 0) return null
  return Math.floor(valor)
}

interface Janela {
  readonly c0: number
  readonly c1: number
  readonly r0: number
  readonly r1: number
}

/** As casas a até `alcance` blocos do centro, cortadas pela borda do mapa; `null` quando o mapa não tem casa. */
function janelaNoMapa(centro: Casa, alcance: number, limites: LimitesDaGrade): Janela | null {
  if (!Number.isFinite(limites.colunas) || !Number.isFinite(limites.linhas) || limites.colunas <= 0 || limites.linhas <= 0) return null
  return {
    c0: Math.max(0, centro.col - alcance),
    c1: Math.min(Math.ceil(limites.colunas) - 1, centro.col + alcance),
    r0: Math.max(0, centro.row - alcance),
    r1: Math.min(Math.ceil(limites.linhas) - 1, centro.row + alcance),
  }
}

/**
 * CÍRCULO QUADRADO (decisão 4): toda casa a até `raio` blocos do centro, com
 * a diagonal custando 1 — o quadrado de lado 2·raio + 1 (raio 2 = 25 casas),
 * coerente com a régua. Linha por linha, da esquerda para a direita.
 */
export function casasNoCirculo(centro: Casa, raio: number, limites: LimitesDaGrade): Casa[] {
  const alcance = alcanceEmBlocos(raio)
  if (alcance === null || !casaInteira(centro)) return []
  const janela = janelaNoMapa(centro, alcance, limites)
  if (janela === null) return []
  const casas: Casa[] = []
  for (let row = janela.r0; row <= janela.r1; row += 1) {
    for (let col = janela.c0; col <= janela.c1; col += 1) casas.push({ col, row })
  }
  return casas
}

/**
 * CONE EM 8 DIREÇÕES (decisão 5): as casas a até `comprimento` blocos de quem
 * mede (diagonal = 1), dentro da meia abertura de atan(1/2) em volta da
 * direção, beira inclusa. Quem mede não entra. Linha por linha.
 */
export function casasNoCone(origem: Casa, direcao: Direcao8, comprimento: number, limites: LimitesDaGrade): Casa[] {
  const alcance = alcanceEmBlocos(comprimento)
  if (alcance === null || alcance === 0 || !casaInteira(origem)) return []
  const janela = janelaNoMapa(origem, alcance, limites)
  if (janela === null) return []
  const [ux, uy] = PASSO_DA_DIRECAO[direcao]
  const tamanho2DaDirecao = ux * ux + uy * uy
  const { numerador, denominador } = COSSENO2_DA_ABERTURA
  const casas: Casa[] = []
  for (let row = janela.r0; row <= janela.r1; row += 1) {
    for (let col = janela.c0; col <= janela.c1; col += 1) {
      const vx = col - origem.col
      const vy = row - origem.row
      const projecao = vx * ux + vy * uy
      // cos² do ângulo >= 4/5, sem divisão: projecao² · 5 >= |v|² · |u|² · 4 (e a projeção para a frente).
      if (projecao <= 0) continue
      if (denominador * projecao * projecao >= numerador * (vx * vx + vy * vy) * tamanho2DaDirecao) casas.push({ col, row })
    }
  }
  return casas
}

/** A direção do cone mais perto do vetor (dx, dy), y para baixo; `null` sem direção (vetor nulo ou que não é número). */
export function direcaoMaisPerto(dx: number, dy: number): Direcao8 | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return null
  const oitavos = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  return DIRECOES_EM_ORDEM[((oitavos % 8) + 8) % 8]
}

/**
 * LINHA DE VISÃO de `de` até `para`, em px de mundo, contra os obstáculos. A
 * regra é a de `hasLineOfSight` (`lib/visibility.ts`), para a resposta bater
 * com o que a névoa mostra: obstáculo paralelo (colinear inclusive) não barra,
 * tocar a ponta de um obstáculo barra, tocar só a origem ou só o alvo não.
 * `null` quando um dos pontos não é número.
 */
export function linhaDeVisao(de: Point, para: Point, obstaculos: readonly Segment[]): LinhaDeVisao | null {
  const dx = para.x - de.x
  const dy = para.y - de.y
  const comprimento = Math.hypot(dx, dy)
  if (!Number.isFinite(comprimento)) return null
  if (comprimento < TOQUE_MINIMO) return { livre: true }
  // As folgas em px viram fração do trecho (0 = origem, 1 = alvo).
  const tMinimo = TOQUE_MINIMO / comprimento
  const tMaximo = 1 - tMinimo
  const xMinimo = Math.min(de.x, para.x)
  const xMaximo = Math.max(de.x, para.x)
  const yMinimo = Math.min(de.y, para.y)
  const yMaximo = Math.max(de.y, para.y)
  let primeiroT = Number.POSITIVE_INFINITY
  let primeiro = -1
  obstaculos.forEach((s, indice) => {
    if (Math.max(s.x1, s.x2) < xMinimo || Math.min(s.x1, s.x2) > xMaximo || Math.max(s.y1, s.y2) < yMinimo || Math.min(s.y1, s.y2) > yMaximo) return
    const ex = s.x2 - s.x1
    const ey = s.y2 - s.y1
    const denominador = dx * ey - dy * ex
    if (Math.abs(denominador) < QUASE_PARALELO) return
    const wx = s.x1 - de.x
    const wy = s.y1 - de.y
    const t = (wx * ey - wy * ex) / denominador
    if (t < tMinimo || t > tMaximo || t >= primeiroT) return
    const u = (wx * dy - wy * dx) / denominador
    if (u < 0 || u > 1) return
    primeiroT = t
    primeiro = indice
  })
  if (primeiro === -1) return { livre: true }
  return { livre: false, ponto: { x: de.x + dx * primeiroT, y: de.y + dy * primeiroT }, obstaculo: primeiro }
}

/** A linha de visão do centro de uma casa ao centro de outra; `null` com casa que não é inteira ou grade sem tamanho. */
export function linhaDeVisaoEntreCasas(de: Casa, para: Casa, obstaculos: readonly Segment[], grid: number): LinhaDeVisao | null {
  if (!casaInteira(de) || !casaInteira(para) || !Number.isFinite(grid) || grid <= 0) return null
  return linhaDeVisao(centroDaCasa(de, grid), centroDaCasa(para, grid), obstaculos)
}
