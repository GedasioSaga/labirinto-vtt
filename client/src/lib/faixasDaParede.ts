import type { MaterialDaParede, Prop, RegionPoint, Wall } from '../types/map'
import { ehMaterialDaParede, FORMATO_DA_IMAGEM } from '../texturas/paredes/catalogo'
import { clampWallWidth, type WallWithStyle } from '../pixi/drawWalls'
import { CONTORNO_PX } from './contornoDaParede'
import { ehMovelDoChao } from './mobilia'

/**
 * O CORPO DA PAREDE na tela do jogador (caça de 12/11/2026, achados N1 e N4).
 *
 * A névoa do jogador é recortada no anel da visão, e o anel termina no EIXO da
 * primeira parede que barra a vista. A parede com textura tem corpo (12, 20 ou
 * 32 px), então a metade de lá ficava debaixo do preto: o jogador via a parede
 * pela metade (o print 21 do mestre). Aqui ficam as contas puras que devolvem
 * a parede inteira:
 *
 * - `faixasDaParede`: os retângulos do corpo das paredes com textura que
 *   encostam no anel (visão ou contorno lembrado). A tela os soma às máscaras
 *   da névoa (`redrawFog` em `player/PlayerView.tsx`).
 * - `presoNaParede`: o objeto atravessado na parede (tocha, armadura de nicho),
 *   que a tela desenha por cima das paredes (decisão 20 do mestre).
 *
 * A espessura do material mora aqui (e não em `pixi/paredesComMaterial.ts`,
 * que a reexporta) para o recorte do mestre (`lib/fogFilter.ts`) medir a mesma
 * parede sem puxar o Pixi.
 *
 * Por que nada escondido aparece: os retângulos só descobrem o CORPO de uma
 * parede que já está no pacote do jogador (o mestre decide o pacote: parede de
 * sala secreta e de dentro de teto fechado nunca saem), e só no trecho que
 * encosta no que ele vê ou lembra. O topo da parede cobre o que está embaixo.
 */

/** Espessura em px do mundo por degrau, a 64 px por casa (a mesma proposta do Desenhado, CONTRATO 11.15). */
export const ESPESSURA_DO_MATERIAL_PX = { thin: 12, medium: 20, thick: 32 } as const

export type ParedeComMaterial = WallWithStyle & { material: MaterialDaParede }

/** A parede sai com textura: material do catálogo, sem porta, nem janela, nem invisível (essas têm desenho próprio). */
export function paredeComMaterial(w: WallWithStyle): w is ParedeComMaterial {
  return ehMaterialDaParede(w.material) && w.door === null && w.hidden !== true && w.janela !== true
}

/** A escala da grade: quantos px do mundo vale 1 px da casa de 64. */
export function escalaDaGrade(grid: number): number {
  return Number.isFinite(grid) && grid > 0 ? grid / FORMATO_DA_IMAGEM.casa : 1
}

/** A espessura da parede com textura em px do mundo. */
export function espessuraDoMaterial(w: Pick<Wall, 'thickness'>, grid: number): number {
  const t = w.thickness
  if (typeof t === 'number' && Number.isFinite(t)) return clampWallWidth(t)
  return (t === 'thin' || t === 'thick' ? ESPESSURA_DO_MATERIAL_PX[t] : ESPESSURA_DO_MATERIAL_PX.medium) * escalaDaGrade(grid)
}

// ---------- as faixas do corpo (N1) ----------

/** Uma parede vista como corpo: o eixo e a meia largura, em px do mundo. */
export interface CorpoDaParede {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Do eixo até a borda de fora do contorno escuro. */
  meia: number
}

/** Quanto a aresta do anel pode passar da borda do corpo e ainda contar como "em cima da parede" (px do mundo). */
const FOLGA_DA_ARESTA_PX = 0.75
/** Trecho de parede coberto por uma aresta que não chega a isto não vira faixa (px do mundo). */
const TRECHO_MINIMO_PX = 0.5

/** Meia largura do corpo desenhado da parede com textura: metade da espessura mais o contorno escuro. */
export function meiaLarguraDoCorpo(w: Pick<Wall, 'thickness'>, grid: number): number {
  return espessuraDoMaterial(w, grid) / 2 + CONTORNO_PX * escalaDaGrade(grid)
}

/** Os corpos das paredes com textura da lista (as outras são linha, sem corpo a mostrar). */
export function corposComTextura(walls: readonly WallWithStyle[], grid: number): CorpoDaParede[] {
  const corpos: CorpoDaParede[] = []
  for (const w of walls) {
    if (!paredeComMaterial(w)) continue
    corpos.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, meia: meiaLarguraDoCorpo(w, grid) })
  }
  return corpos
}

interface CorpoPronto {
  x1: number
  y1: number
  /** Direção da parede (unitária) e a normal. */
  ux: number
  uy: number
  nx: number
  ny: number
  comp: number
  meia: number
  /** Distância máxima ao eixo para a ponta da aresta contar. */
  alcance: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function prontos(corpos: readonly CorpoDaParede[]): CorpoPronto[] {
  const saida: CorpoPronto[] = []
  for (const c of corpos) {
    const dx = c.x2 - c.x1
    const dy = c.y2 - c.y1
    const comp = Math.hypot(dx, dy)
    if (!Number.isFinite(comp) || comp <= 0 || !Number.isFinite(c.meia) || c.meia <= 0) continue
    const ux = dx / comp
    const uy = dy / comp
    const alcance = c.meia + FOLGA_DA_ARESTA_PX
    saida.push({
      x1: c.x1,
      y1: c.y1,
      ux,
      uy,
      nx: -uy,
      ny: ux,
      comp,
      meia: c.meia,
      alcance,
      minX: Math.min(c.x1, c.x2) - alcance,
      minY: Math.min(c.y1, c.y2) - alcance,
      maxX: Math.max(c.x1, c.x2) + alcance,
      maxY: Math.max(c.y1, c.y2) + alcance,
    })
  }
  return saida
}

/** Caixa envolvente de um anel, ou `null` se algum ponto não for finito. */
function caixaDo(anel: readonly RegionPoint[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of anel) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
  return { minX, minY, maxX, maxY }
}

/**
 * O trecho `[t0, t1]` (ao longo do eixo, de 0 a `comp`) que a aresta `a`-`b`
 * cobre, ou `null` quando ela não corre em cima da parede: as DUAS pontas
 * precisam estar a até `alcance` do eixo, e a aresta não pode atravessar o
 * eixo de um lado ao outro (a aresta radial de quem olha pela ponta da parede).
 */
function trechoDaAresta(a: RegionPoint, b: RegionPoint, c: CorpoPronto): [number, number] | null {
  const da = (a.x - c.x1) * c.nx + (a.y - c.y1) * c.ny
  const db = (b.x - c.x1) * c.nx + (b.y - c.y1) * c.ny
  if (Math.abs(da) > c.alcance || Math.abs(db) > c.alcance) return null
  if (da * db < 0 && Math.min(Math.abs(da), Math.abs(db)) > FOLGA_DA_ARESTA_PX) return null
  const ta = (a.x - c.x1) * c.ux + (a.y - c.y1) * c.uy
  const tb = (b.x - c.x1) * c.ux + (b.y - c.y1) * c.uy
  const t0 = Math.max(0, Math.min(ta, tb))
  const t1 = Math.min(c.comp, Math.max(ta, tb))
  return t1 - t0 > TRECHO_MINIMO_PX ? [t0, t1] : null
}

/** O retângulo do corpo de `t0` a `t1` ao longo do eixo, na largura inteira. */
function retangulo(c: CorpoPronto, t0: number, t1: number): RegionPoint[] {
  const ax = c.x1 + c.ux * t0
  const ay = c.y1 + c.uy * t0
  const bx = c.x1 + c.ux * t1
  const by = c.y1 + c.uy * t1
  const ox = c.nx * c.meia
  const oy = c.ny * c.meia
  return [
    { x: ax + ox, y: ay + oy },
    { x: bx + ox, y: by + oy },
    { x: bx - ox, y: by - oy },
    { x: ax - ox, y: ay - oy },
  ]
}

/**
 * As FAIXAS DO CORPO a descobrir na névoa: para cada aresta dos `aneis` que corre
 * em cima de uma parede com textura (as duas pontas a até meia largura + 0,75 px
 * do eixo), o trecho da parede coberto por ela, na largura inteira do corpo.
 * Trechos da mesma parede que se tocam viram um retângulo só. O trecho que
 * encosta numa ponta da parede passa dela por meia largura (o pilar do canto e
 * a tampa da ponta solta).
 *
 * Função pura: os mesmos anéis e corpos dão os mesmos retângulos.
 */
export function faixasDaParede(aneis: readonly (readonly RegionPoint[])[], corpos: readonly CorpoDaParede[]): RegionPoint[][] {
  const lista = prontos(corpos)
  if (lista.length === 0) return []
  const trechos = new Map<number, [number, number][]>()
  for (const anel of aneis) {
    if (anel.length < 3) continue
    const caixa = caixaDo(anel)
    if (caixa === null) continue
    const perto: number[] = []
    lista.forEach((c, i) => {
      if (c.maxX >= caixa.minX && c.minX <= caixa.maxX && c.maxY >= caixa.minY && c.minY <= caixa.maxY) perto.push(i)
    })
    if (perto.length === 0) continue
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
      const a = anel[j]
      const b = anel[i]
      for (const k of perto) {
        const c = lista[k]
        // Aresta inteira fora da caixa da parede: nem faz a conta.
        if (Math.max(a.x, b.x) < c.minX || Math.min(a.x, b.x) > c.maxX || Math.max(a.y, b.y) < c.minY || Math.min(a.y, b.y) > c.maxY) continue
        const trecho = trechoDaAresta(a, b, c)
        if (trecho === null) continue
        const daParede = trechos.get(k)
        if (daParede === undefined) trechos.set(k, [trecho])
        else daParede.push(trecho)
      }
    }
  }
  const saida: RegionPoint[][] = []
  for (const [k, lista2] of trechos) {
    const c = lista[k]
    lista2.sort((p, q) => p[0] - q[0])
    let [t0, t1] = lista2[0]
    const fechar = (): void => {
      const inicio = t0 <= FOLGA_DA_ARESTA_PX ? -c.meia : t0
      const fim = t1 >= c.comp - FOLGA_DA_ARESTA_PX ? c.comp + c.meia : t1
      saida.push(retangulo(c, inicio, fim))
    }
    for (let i = 1; i < lista2.length; i += 1) {
      const [s0, s1] = lista2[i]
      if (s0 <= t1 + TRECHO_MINIMO_PX) {
        t1 = Math.max(t1, s1)
        continue
      }
      fechar()
      t0 = s0
      t1 = s1
    }
    fechar()
  }
  return saida
}

// ---------- o objeto preso na parede (N4, decisão 20) ----------

/** Quanto o centro do objeto pode ficar além da meia espessura para contar como preso na parede (px do mundo). */
export const FOLGA_DO_OBJETO_NA_PAREDE_PX = 3

/** Uma parede que segura objeto: o eixo e a distância máxima do centro do objeto a ele. */
export interface ParedeQueSegura {
  x1: number
  y1: number
  x2: number
  y2: number
  alcance: number
  /** A caixa do eixo já alargada pelo alcance: descarta o objeto longe sem a conta da distância. */
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * As paredes da lista que seguram objeto: parede de verdade (sem porta, sem
 * janela, não invisível). A com textura alcança a meia espessura do corpo mais
 * 3 px; a de linha, só os 3 px (a linha não tem corpo no mundo).
 */
export function paredesQueSeguram(walls: readonly WallWithStyle[], grid: number): ParedeQueSegura[] {
  const saida: ParedeQueSegura[] = []
  for (const w of walls) {
    if (w.door !== null || w.hidden === true || w.janela === true) continue
    if (![w.x1, w.y1, w.x2, w.y2].every(Number.isFinite)) continue
    const meia = paredeComMaterial(w) ? espessuraDoMaterial(w, grid) / 2 : 0
    const alcance = meia + FOLGA_DO_OBJETO_NA_PAREDE_PX
    saida.push({
      x1: w.x1,
      y1: w.y1,
      x2: w.x2,
      y2: w.y2,
      alcance,
      minX: Math.min(w.x1, w.x2) - alcance,
      minY: Math.min(w.y1, w.y2) - alcance,
      maxX: Math.max(w.x1, w.x2) + alcance,
      maxY: Math.max(w.y1, w.y2) + alcance,
    })
  }
  return saida
}

/** O ponto do eixo mais perto de `p` e a distância até ele. */
function maisPertoNoEixo(p: RegionPoint, w: ParedeQueSegura): { x: number; y: number; distancia: number } {
  const dx = w.x2 - w.x1
  const dy = w.y2 - w.y1
  const comp2 = dx * dx + dy * dy
  const t = comp2 > 0 ? Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / comp2)) : 0
  const x = w.x1 + t * dx
  const y = w.y1 + t * dy
  return { x, y, distancia: Math.hypot(p.x - x, p.y - y) }
}

/** A parede segura o objeto deste centro: dentro da caixa e a até `alcance` do eixo. */
function segura(centro: RegionPoint, w: ParedeQueSegura): boolean {
  return centro.x >= w.minX && centro.x <= w.maxX && centro.y >= w.minY && centro.y <= w.maxY && maisPertoNoEixo(centro, w).distancia <= w.alcance
}

/** O centro do objeto, ou `null` quando ele mora no chão (tapete, ponte, monte de ouro: por baixo de tudo, inclusive de parede) ou não é finito. */
function centroQuePrende(prop: Pick<Prop, 'x' | 'y' | 'mobilia'>): RegionPoint | null {
  if (ehMovelDoChao(prop.mobilia)) return null
  if (!Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return null
  return { x: prop.x, y: prop.y }
}

/** O objeto está PRESO NA PAREDE: o centro a até meia espessura + 3 px de uma das `paredes`. */
export function presoNaParede(prop: Pick<Prop, 'x' | 'y' | 'mobilia'>, paredes: readonly ParedeQueSegura[]): boolean {
  const centro = centroQuePrende(prop)
  return centro !== null && paredes.some((w) => segura(centro, w))
}

/**
 * Os LADOS do objeto preso: para cada parede que o segura, os dois pontos a
 * meia espessura + 3 px do eixo, um de cada lado, na altura do centro dele. O
 * recorte do mestre (`lib/fogFilter.ts`) conta o objeto como visto quando um
 * deles está à vista (decisão 20: quem vê a parede vê o que está preso nela,
 * dos dois lados). Lista vazia = não está preso.
 */
export function ladosDoObjetoNaParede(prop: Pick<Prop, 'x' | 'y' | 'mobilia'>, paredes: readonly ParedeQueSegura[]): RegionPoint[] {
  const centro = centroQuePrende(prop)
  if (centro === null) return []
  const lados: RegionPoint[] = []
  for (const w of paredes) {
    if (!segura(centro, w)) continue
    const comp = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    if (!(comp > 0)) continue
    const nx = (-(w.y2 - w.y1) / comp) * w.alcance
    const ny = ((w.x2 - w.x1) / comp) * w.alcance
    const pe = maisPertoNoEixo(centro, w)
    lados.push({ x: pe.x + nx, y: pe.y + ny }, { x: pe.x - nx, y: pe.y - ny })
  }
  return lados
}
