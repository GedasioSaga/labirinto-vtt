import type { AlvoDoBalde, Drawing, Region, RegionPoint } from '../types/map'
import type { Caixa } from './texturas'

/**
 * BALDE da ferramenta Texturas (`lib/texturas.ts`): qual forma o clique enche
 * e qual é a parte À VISTA dela.
 *
 * O balde de um programa de pintura enche a mancha de mesma cor debaixo do
 * clique. No mapa a "mancha" é a forma pintada de cima: o desenho preenchido
 * (o bioma que o mestre pintou com o botão Desenho) ou, fora deles, a região
 * de terra. E enche só o que aparece dela: o que está desenhado POR CIMA (o
 * desenho de depois, o risco da serra, a região de depois) fica de fora e
 * continua à vista — senão o balde na ilha cobriria a floresta pintada nela.
 *
 * O balde guarda só o alvo (`AlvoDoBalde`); a forma é lida de novo a cada
 * pintura, então a textura acompanha o desenho se o mestre o redesenhar.
 */

/** Lados do polígono que aproxima círculo e elipse (o mesmo número do relevo). */
const LADOS_DA_ELIPSE = 64

/** O que sai da forma do balde: uma área cheia, ou um risco com largura. */
export type RecorteDoBalde =
  | { tipo: 'area'; pontos: RegionPoint[] }
  | { tipo: 'linha'; pontos: RegionPoint[]; largura: number; fechada: boolean }

/** A parte à vista de um alvo: o contorno dele menos os recortes. */
export interface FormaDoBalde {
  contorno: RegionPoint[]
  recortes: RecorteDoBalde[]
  caixa: Caixa
}

function finito(p: RegionPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y)
}

/** Região que conta como chão: polígono de verdade e com fundo (a mesma regra da terra do relevo). */
function regiaoCheia(r: Region): boolean {
  return r.filled !== false && r.points.length >= 3 && r.points.every(finito)
}

function elipse(cx: number, cy: number, rx: number, ry: number): RegionPoint[] | null {
  if (![cx, cy, rx, ry].every(Number.isFinite) || rx <= 0 || ry <= 0) return null
  const pontos: RegionPoint[] = []
  for (let i = 0; i < LADOS_DA_ELIPSE; i += 1) {
    const t = (i / LADOS_DA_ELIPSE) * Math.PI * 2
    pontos.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry })
  }
  return pontos
}

/** Contorno de um desenho fechado (polígono, retângulo, círculo, elipse), ou `null`. */
function contornoFechado(d: Drawing): RegionPoint[] | null {
  switch (d.kind) {
    case 'polygon':
      return d.points.length >= 3 && d.points.every(finito) ? d.points.map((p) => ({ x: p.x, y: p.y })) : null
    case 'rect': {
      if (![d.x, d.y, d.w, d.h].every(Number.isFinite) || d.w === 0 || d.h === 0) return null
      const x0 = Math.min(d.x, d.x + d.w)
      const y0 = Math.min(d.y, d.y + d.h)
      const x1 = Math.max(d.x, d.x + d.w)
      const y1 = Math.max(d.y, d.y + d.h)
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ]
    }
    case 'circle':
      return elipse(d.cx, d.cy, d.radius, d.radius)
    case 'ellipse':
      return elipse(d.cx, d.cy, d.rx, d.ry)
    default:
      return null
  }
}

/** Desenho fechado com fundo que se vê: é uma "mancha" que o balde enche. */
function pintaOChao(d: Drawing): boolean {
  if (d.kind !== 'polygon' && d.kind !== 'rect' && d.kind !== 'ellipse' && d.kind !== 'circle') return false
  return d.filled === true && Number.isFinite(d.fillAlpha) && d.fillAlpha > 0
}

/**
 * O que um desenho cobre por cima do que está embaixo dele: o fundo (se
 * pintado) e o traço. Caminho e Texto ficam acima da textura na tela (não
 * cobrem nada dela); a curva vai como a linha pelos pontos dela.
 */
function recortesDoDesenho(d: Drawing): RecorteDoBalde[] {
  const fechado = contornoFechado(d)
  if (fechado !== null) {
    const largura = 'width' in d && Number.isFinite(d.width) ? d.width : 0
    const recortes: RecorteDoBalde[] = []
    if (pintaOChao(d)) recortes.push({ tipo: 'area', pontos: fechado })
    if (largura > 0) recortes.push({ tipo: 'linha', pontos: fechado, largura, fechada: true })
    return recortes
  }
  switch (d.kind) {
    case 'freehand':
    case 'curve': {
      const pontos = d.points.filter(finito).map((p) => ({ x: p.x, y: p.y }))
      return pontos.length > 0 && d.width > 0 ? [{ tipo: 'linha', pontos, largura: d.width, fechada: false }] : []
    }
    case 'line':
      return [d.x1, d.y1, d.x2, d.y2].every(Number.isFinite) && d.width > 0
        ? [{ tipo: 'linha', pontos: [{ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }], largura: d.width, fechada: false }]
        : []
    default:
      return []
  }
}

/** Ponto dentro do polígono (par-ímpar, como o `fill('evenodd')` da tela). */
export function dentroDoPoligono(p: RegionPoint, poligono: readonly RegionPoint[]): boolean {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i, i += 1) {
    const a = poligono[i]
    const b = poligono[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

function caixaDosPontos(pontos: readonly RegionPoint[]): Caixa {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * A forma que o balde enche no ponto: o desenho pintado mais de cima que o
 * contém; fora de todos, a região de terra mais de cima. `null` = nenhum (o
 * mar, fora da terra).
 */
export function alvoDoBalde(regioes: readonly Region[], desenhos: readonly Drawing[], ponto: RegionPoint): AlvoDoBalde | null {
  for (let i = desenhos.length - 1; i >= 0; i -= 1) {
    const d = desenhos[i]
    if (!pintaOChao(d)) continue
    const contorno = contornoFechado(d)
    if (contorno !== null && dentroDoPoligono(ponto, contorno)) return { tipo: 'desenho', id: d.id }
  }
  for (let i = regioes.length - 1; i >= 0; i -= 1) {
    const r = regioes[i]
    if (regiaoCheia(r) && dentroDoPoligono(ponto, r.points)) return { tipo: 'regiao', id: r.id }
  }
  return null
}

/**
 * A parte à vista do alvo: o contorno dele menos o que está por cima (as
 * regiões cheias de depois e, numa região, todos os desenhos; num desenho, os
 * desenhos de depois). `null` = o alvo não está nestas listas (apagado, ou
 * fora do recorte do jogador).
 */
export function formaDoBalde(alvo: AlvoDoBalde, regioes: readonly Region[], desenhos: readonly Drawing[]): FormaDoBalde | null {
  if (alvo.tipo === 'regiao') {
    const indice = regioes.findIndex((r) => r.id === alvo.id)
    if (indice < 0 || !regiaoCheia(regioes[indice])) return null
    const contorno = regioes[indice].points.map((p) => ({ x: p.x, y: p.y }))
    const caixa = caixaDosPontos(contorno)
    const recortes: RecorteDoBalde[] = [
      ...regioes.slice(indice + 1).filter(regiaoCheia).map((r): RecorteDoBalde => ({ tipo: 'area', pontos: r.points })),
      ...desenhos.flatMap(recortesDoDesenho),
    ]
    return { contorno, recortes: recortes.filter((r) => tocaACaixa(r, caixa)), caixa }
  }
  const indice = desenhos.findIndex((d) => d.id === alvo.id)
  if (indice < 0 || !pintaOChao(desenhos[indice])) return null
  const contorno = contornoFechado(desenhos[indice])
  if (contorno === null) return null
  const caixa = caixaDosPontos(contorno)
  const recortes = desenhos.slice(indice + 1).flatMap(recortesDoDesenho)
  return { contorno, recortes: recortes.filter((r) => tocaACaixa(r, caixa)), caixa }
}

/** O recorte encosta na caixa do alvo? Os que não encostam não mudam nada e não vão para a tela. */
function tocaACaixa(recorte: RecorteDoBalde, caixa: Caixa): boolean {
  const meia = recorte.tipo === 'linha' ? recorte.largura / 2 : 0
  const c = caixaDosPontos(recorte.pontos)
  return c.minX - meia <= caixa.maxX && caixa.minX <= c.maxX + meia && c.minY - meia <= caixa.maxY && caixa.minY <= c.maxY + meia
}

/** A caixa da forma de um alvo, ou `null` (a forma sumiu). Para a borracha saber se passa por um balde. */
export function caixaDoAlvo(alvo: AlvoDoBalde, regioes: readonly Region[], desenhos: readonly Drawing[]): Caixa | null {
  if (alvo.tipo === 'regiao') {
    const r = regioes.find((item) => item.id === alvo.id)
    return r !== undefined && regiaoCheia(r) ? caixaDosPontos(r.points) : null
  }
  const d = desenhos.find((item) => item.id === alvo.id)
  const contorno = d === undefined || !pintaOChao(d) ? null : contornoFechado(d)
  return contorno === null ? null : caixaDosPontos(contorno)
}
