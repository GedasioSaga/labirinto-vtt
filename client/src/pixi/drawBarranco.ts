import { Graphics } from 'pixi.js'
import type { BarrancoDoMapa } from '../types/map'
import { alcaDoRisco, corridas, escalaDoBarranco, geosDoBarranco, pontoEm, type Corrida, type GeoDoBarranco } from '../lib/barranco'
import { AJUSTE_DO_PENHASCO, corDaParede } from '../lib/relevo'
import { meioTermoLigado } from '../lib/estiloDoMapa'
import { PALETA_MEIO_TERMO } from '../texturas/meioTermo/paleta'
import { contornoDoTom, corDoBarranco, LARGURA_DO_CONTORNO, TONS_DO_BARRANCO } from '../texturas/meioTermo/barranco'
import { misturar, rgb, type Rgb } from '../texturas/ruido'

/**
 * DESENHO DO BARRANCO (porte de `docs/design/barranco/prototipo/index.html`,
 * `pintarMapa`), no editor do mestre e na tela do jogador e da TV.
 *
 * Vetor num Graphics só, refeito apenas quando o barranco muda (o mapa é
 * imutável: a referência basta). Sem textura do tamanho do mapa: a sombra
 * borrada do protótipo vira três faixas de alfa baixo, que somam um degradê
 * sem filtro nem render target.
 *
 * Cara pelo estilo do mapa (`meioTermoLigado`):
 * - Atual (Meio-Termo): o perfil liso de `texturas/meioTermo/barranco.ts`, com
 *   o contorno escuro da própria terra no pé;
 * - Simples (linhas): as faixas do Penhasco nesse estilo (`corDaParede`), sem contorno.
 * Nos dois: luz de cima à esquerda (a parede virada para a luz clareia, a de
 * costas escurece e joga mais sombra no lado baixo) e o alto de cada área um
 * pouco mais claro a cada degrau. Nada de bolinha, escama ou detalhe repetido.
 */

const RAIZ = Math.SQRT1_2
/** A luz vem de cima à esquerda, como no resto do app. */
const PARA_LUZ: readonly [number, number] = [-RAIZ, -RAIZ]
/** Faixas de cor da parede, do lábio ao pé. */
const FAIXAS = 6
/** Degraus de luz da face (o protótipo também quantiza em 12). */
const PASSOS_DA_FACE = 12
const LUZ: Rgb = rgb('#fff3dc')
const SOMBRA_NO_CHAO: Rgb = contornoDoTom(rgb(PALETA_MEIO_TERMO.ardosia.base))
/** As três faixas da sombra: até onde vão (fração da sombra inteira) e o alfa de cada uma. */
const FAIXAS_DA_SOMBRA: readonly (readonly [number, number])[] = [
  [1, 0.1],
  [0.72, 0.1],
  [0.45, 0.1],
]
const COR_DA_ESCOLHA = 0xd9a441

function numero(c: Rgb): number {
  return (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2])
}

/** A cor de uma faixa da parede pela fração da altura (0 = lábio, 1 = pé) e pela face (1 = de frente para a luz). */
function corDaFaixa(fracao: number, face: number, simples: boolean): number {
  const base: Rgb = simples ? corDaParede(fracao * AJUSTE_DO_PENHASCO.altura) : corDoBarranco(fracao)
  const luz = face > 0 ? misturar(base, LUZ, face * 0.42 * 0.45) : misturar(base, TONS_DO_BARRANCO.contorno, -face * 0.45 * 0.55)
  return numero(luz)
}

const cacheDeCores = new Map<string, number>()
function corGuardada(faixa: number, face: number, simples: boolean): number {
  const chave = `${faixa}:${face}:${simples ? 1 : 0}`
  const pronta = cacheDeCores.get(chave)
  if (pronta !== undefined) return pronta
  const cor = corDaFaixa((faixa + 0.5) / FAIXAS, face / PASSOS_DA_FACE, simples)
  cacheDeCores.set(chave, cor)
  return cor
}

/** Os trechos de uma corrida, em ordem (no laço fechado, o último fecha no primeiro). */
function trechosDa(geo: GeoDoBarranco, corrida: Corrida): number[] {
  return corrida.fechada ? Array.from({ length: geo.nSeg }, (_, i) => i) : corrida.idx.slice(0, -1)
}

/** Os pontos de uma sequência de trechos (o fim de cada um é o começo do próximo). */
function pontosDosTrechos(geo: GeoDoBarranco, trechos: readonly number[]): number[] {
  const n = geo.lip.length
  const idx = trechos.map((i) => i)
  const ultimo = trechos[trechos.length - 1]
  idx.push((ultimo + 1) % n)
  return idx
}

/** A faixa entre duas distâncias da beira (para o lado baixo), como polígono aberto e costurado. */
function faixa(geo: GeoDoBarranco, idx: readonly number[], de: (i: number) => number, ate: (i: number) => number): number[] {
  const pts: number[] = []
  for (const i of idx) pts.push(geo.lip[i][0] + geo.vn[i][0] * de(i), geo.lip[i][1] + geo.vn[i][1] * de(i))
  for (let k = idx.length - 1; k >= 0; k -= 1) {
    const i = idx[k]
    pts.push(geo.lip[i][0] + geo.vn[i][0] * ate(i), geo.lip[i][1] + geo.vn[i][1] * ate(i))
  }
  return pts
}

function pintarSombra(g: Graphics, geo: GeoDoBarranco, escala: number): void {
  for (const corrida of corridas(geo)) {
    const idx = corrida.fechada ? [...corrida.idx, corrida.idx[0]] : corrida.idx
    const de = (i: number): number => geo.t[i] * 0.5
    const inteira = (i: number): number => {
      const u = geo.un[i]
      const deCostas = Math.max(0, -(u[0] * PARA_LUZ[0] + u[1] * PARA_LUZ[1]))
      return geo.t[i] + 3 * escala + geo.t[i] * 1.05 * deCostas
    }
    for (const [ate, alpha] of FAIXAS_DA_SOMBRA) {
      g.poly(faixa(geo, idx, de, (i) => de(i) + (inteira(i) - de(i)) * ate)).fill({ color: numero(SOMBRA_NO_CHAO), alpha })
    }
  }
}

function pintarParede(g: Graphics, geo: GeoDoBarranco, escala: number, simples: boolean): void {
  for (const corrida of corridas(geo)) {
    const trechos = trechosDa(geo, corrida)
    // Trechos seguidos com a mesma luz viram uma tira só por faixa de cor.
    let inicio = 0
    while (inicio < trechos.length) {
      const sn = geo.sn[trechos[inicio]]
      const face = Math.round((sn[0] * PARA_LUZ[0] + sn[1] * PARA_LUZ[1]) * PASSOS_DA_FACE)
      let fim = inicio + 1
      while (fim < trechos.length) {
        const s2 = geo.sn[trechos[fim]]
        if (Math.round((s2[0] * PARA_LUZ[0] + s2[1] * PARA_LUZ[1]) * PASSOS_DA_FACE) !== face) break
        fim += 1
      }
      const idx = pontosDosTrechos(geo, trechos.slice(inicio, fim))
      if (idx.some((i) => geo.t[i] >= 0.4)) {
        for (let f = 0; f < FAIXAS; f += 1) {
          g.poly(faixa(geo, idx, (i) => (geo.t[i] * f) / FAIXAS, (i) => (geo.t[i] * (f + 1)) / FAIXAS)).fill({ color: corGuardada(f, face, simples) })
        }
      }
      inicio = fim
    }
    // O contorno no pé: o escuro da própria terra, nunca preto (só no Atual, como o Penhasco).
    if (!simples) {
      const pes = (corrida.fechada ? [...corrida.idx, corrida.idx[0]] : corrida.idx).filter((i) => geo.t[i] > 0.6 * escala || corrida.fechada)
      if (pes.length > 1) {
        const pts = pes.flatMap((i) => [geo.lip[i][0] + geo.vn[i][0] * geo.t[i], geo.lip[i][1] + geo.vn[i][1] * geo.t[i]])
        g.poly(pts, false).stroke({ color: numero(TONS_DO_BARRANCO.contorno), width: LARGURA_DO_CONTORNO * escala, join: 'round', cap: 'round' })
      }
    }
  }
}

/** A beira de cima: um fio de luz no alto, do lado alto. */
function pintarBeira(g: Graphics, geo: GeoDoBarranco, escala: number): void {
  for (const corrida of corridas(geo)) {
    const idx = corrida.fechada ? [...corrida.idx, corrida.idx[0]] : corrida.idx
    if (idx.length < 2) continue
    const pts = idx.flatMap((i) => [geo.lip[i][0] - geo.un[i][0] * 0.9 * escala, geo.lip[i][1] - geo.un[i][1] * 0.9 * escala])
    g.poly(pts, false).stroke({ color: numero(LUZ), alpha: 0.45, width: 1.7 * escala, join: 'round', cap: 'round' })
  }
}

const TERRA = PALETA_MEIO_TERMO.terra

/** O vão de terra da rampa: a parede abre e vira descida, com as duas laterais cortadas. */
export function pintarRampa(g: Graphics, geo: GeoDoBarranco, s: number, w: number, escala: number, alpha = 1): void {
  const N = 12
  const topo: number[][] = []
  const pe: number[][] = []
  let fx = 0
  let fy = 0
  for (let q = 0; q <= N; q += 1) {
    const u = q / N
    const P = pontoEm(geo, s - w / 2 + w * u)
    const t = Math.max(P.t, 4 * escala)
    const saia = 7 * escala * Math.sin(Math.PI * u)
    topo.push([P.x - P.ux * 1.5 * escala, P.y - P.uy * 1.5 * escala])
    pe.push([P.x + P.ux * (t + saia), P.y + P.uy * (t + saia)])
    fx += P.ux
    fy += P.uy
  }
  const fl = Math.hypot(fx, fy) || 1
  const f = (fx / fl) * PARA_LUZ[0] + (fy / fl) * PARA_LUZ[1]
  const claro = f > 0 ? misturar(rgb(TERRA.realce), LUZ, f * 0.25) : rgb(TERRA.realce)
  const fundo = f < 0 ? misturar(rgb(TERRA.base), rgb(TERRA.sombra), -f * 0.6) : rgb(TERRA.base)
  const tons: readonly Rgb[] = [claro, misturar(claro, rgb(TERRA.base), 0.7), fundo]
  for (let k = 0; k < tons.length; k += 1) {
    const a = k / tons.length
    const b = (k + 1) / tons.length
    const pts: number[] = []
    for (let q = 0; q <= N; q += 1) pts.push(topo[q][0] + (pe[q][0] - topo[q][0]) * a, topo[q][1] + (pe[q][1] - topo[q][1]) * a)
    for (let q = N; q >= 0; q -= 1) pts.push(topo[q][0] + (pe[q][0] - topo[q][0]) * b, topo[q][1] + (pe[q][1] - topo[q][1]) * b)
    g.poly(pts).fill({ color: numero(tons[k]), alpha })
  }
  const contorno = { color: numero(TONS_DO_BARRANCO.contorno), width: 1.2 * escala, cap: 'round' as const, alpha }
  g.moveTo(topo[0][0], topo[0][1]).lineTo(pe[0][0], pe[0][1]).stroke(contorno)
  g.moveTo(topo[N][0], topo[N][1]).lineTo(pe[N][0], pe[N][1]).stroke(contorno)
}

function areaComSinal(lip: readonly number[][]): number {
  let a = 0
  for (let i = 0; i < lip.length; i += 1) {
    const p = lip[i]
    const q = lip[(i + 1) % lip.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

function dentro(x: number, y: number, pol: readonly number[][]): boolean {
  let d = false
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i, i += 1) {
    const [xi, yi] = pol[i]
    const [xj, yj] = pol[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d
  }
  return d
}

/** O alto de uma área: mais claro a cada degrau. Laço de fora (área negativa) enche; buraco dentro dele corta. */
function pintarTopo(g: Graphics, lista: readonly GeoDoBarranco[], k: number): void {
  const fora = lista.filter((geo) => areaComSinal(geo.lip) < 0)
  const buracos = lista.filter((geo) => areaComSinal(geo.lip) >= 0)
  for (const geo of fora) {
    g.poly(geo.lip.flatMap((p) => [p[0], p[1]])).fill({ color: numero(LUZ), alpha: 0.07 * k })
    for (const b of buracos) if (dentro(b.lip[0][0], b.lip[0][1], geo.lip)) g.poly(b.lip.flatMap((p) => [p[0], p[1]])).cut()
  }
}

function pintarBarrancos(g: Graphics, lista: readonly GeoDoBarranco[], escala: number, simples: boolean): void {
  for (const geo of lista) pintarSombra(g, geo, escala)
  for (const geo of lista) {
    pintarParede(g, geo, escala, simples)
    for (const v of geo.vaos) pintarRampa(g, geo, v.s, v.w, escala)
  }
}

/** O risco escolhido: a beira em destaque e a alça Virar com a seta para o lado baixo. */
function pintarEscolha(g: Graphics, geo: GeoDoBarranco, grid: number, escala: number): void {
  g.poly(geo.lip.flatMap((p) => [p[0], p[1]]), false).stroke({ color: COR_DA_ESCOLHA, alpha: 0.9, width: 2 * escala, join: 'round', cap: 'round' })
  const alca = alcaDoRisco(geo, grid)
  const contorno = numero(TONS_DO_BARRANCO.contorno)
  g.circle(alca.x, alca.y, alca.raio).fill({ color: 0xfffaf0, alpha: 0.95 }).stroke({ color: COR_DA_ESCOLHA, width: 2 * escala })
  const meio = alca.raio * 0.5
  const ponta = { x: alca.x + alca.ux * meio, y: alca.y + alca.uy * meio }
  const lado = { x: -alca.uy * meio * 0.6, y: alca.ux * meio * 0.6 }
  g.moveTo(alca.x - alca.ux * meio, alca.y - alca.uy * meio).lineTo(ponta.x, ponta.y).stroke({ color: contorno, width: 2 * escala, cap: 'round' })
  g.moveTo(ponta.x - alca.ux * meio * 0.6 + lado.x, ponta.y - alca.uy * meio * 0.6 + lado.y)
    .lineTo(ponta.x, ponta.y)
    .lineTo(ponta.x - alca.ux * meio * 0.6 - lado.x, ponta.y - alca.uy * meio * 0.6 - lado.y)
    .stroke({ color: contorno, width: 2 * escala, cap: 'round', join: 'round' })
}

/** O que desenhar. `mostras` só no meio da virada; `escolhido` só no editor. */
export interface EntradaDoBarranco {
  barranco: BarrancoDoMapa | undefined
  piso: number
  grid: number
  mostras?: ReadonlyMap<string, number>
  escolhido?: string | null
}

export interface DesenhoDoBarranco {
  camada: Graphics
  atualizar: (entrada: EntradaDoBarranco | null) => void
  destroy: () => void
}

export function criarDesenhoDoBarranco(): DesenhoDoBarranco {
  const camada = new Graphics()
  camada.eventMode = 'none'
  let ultima: (EntradaDoBarranco & { simples: boolean }) | null = null

  const atualizar = (entrada: EntradaDoBarranco | null): void => {
    const simples = !meioTermoLigado()
    if (entrada === null || entrada.barranco === undefined) {
      if (ultima !== null) camada.clear()
      ultima = null
      return
    }
    if (
      ultima !== null &&
      ultima.barranco === entrada.barranco &&
      ultima.piso === entrada.piso &&
      ultima.grid === entrada.grid &&
      ultima.mostras === entrada.mostras &&
      (ultima.escolhido ?? null) === (entrada.escolhido ?? null) &&
      ultima.simples === simples
    ) {
      return
    }
    ultima = { ...entrada, simples }
    camada.clear()
    const escala = escalaDoBarranco(entrada.grid)
    const geos = geosDoBarranco(entrada.barranco, entrada.piso, entrada.grid, entrada.mostras)
    // Nível por nível: sombra no de baixo, parede, rampa, o alto e a beira; os riscos por último.
    for (let k = 1; k <= 3; k += 1) {
      const lista = geos.filter((geo) => geo.tipo === 'area' && geo.nivel === k)
      if (lista.length === 0) continue
      pintarBarrancos(camada, lista, escala, simples)
      pintarTopo(camada, lista, k)
      for (const geo of lista) pintarBeira(camada, geo, escala)
    }
    const riscos = geos.filter((geo) => geo.tipo === 'risco')
    pintarBarrancos(camada, riscos, escala, simples)
    for (const geo of riscos) pintarBeira(camada, geo, escala)
    const escolhido = entrada.escolhido ?? null
    const geoEscolhido = escolhido === null ? undefined : riscos.find((geo) => geo.id === escolhido)
    if (geoEscolhido !== undefined) pintarEscolha(camada, geoEscolhido, entrada.grid, escala)
  }

  return {
    camada,
    atualizar,
    destroy: () => {
      camada.destroy()
      ultima = null
    },
  }
}
