/**
 * O CORTE DO PAINEL EM RELEVO EM PLACAS (28/11): a área do relevo
 * (`AREA_DO_RELEVO`) vira uma grade de 4 x 3 placas de bordas tortas, como
 * peças de metal fundidas uma a uma. Cada cena tem o seu corte (a semente vem
 * do nome dela) e a imagem do mestre tem um próprio; o MESMO corte desenha o
 * vão no quadro, a placa posta, o editor e o PNG do item, então a placa que o
 * jogador leva na mochila é sempre o pedaço exato que falta.
 *
 * As vizinhas dividem os mesmos pontos de borda (calculados uma vez por
 * aresta): encaixadas, fecham sem fresta nem sobra.
 *
 * Puro: sem React, sem disco. Unidades do `viewBox` do painel (1600 x 1000).
 */
import { COLUNAS_DO_RELEVO, LINHAS_DO_RELEVO, PLACAS_DO_RELEVO, TAMANHO_DO_ENCAIXE_MAX, TAMANHO_DO_ENCAIXE_MIN, type CenaDoRelevo } from '../tipos'
import { ALTURA_DO_PAINEL, AREA_DO_RELEVO, LARGURA_DO_PAINEL } from './arte'

export interface Ponto {
  readonly x: number
  readonly y: number
}

export interface Caixa {
  readonly x: number
  readonly y: number
  readonly largura: number
  readonly altura: number
}

const LARGURA_DA_CELULA = AREA_DO_RELEVO.largura / COLUNAS_DO_RELEVO
const ALTURA_DA_CELULA = AREA_DO_RELEVO.altura / LINHAS_DO_RELEVO
/** Quanto um canto de dentro da grade anda, em fração da célula. */
const TORTO_DO_CANTO = 0.13
/** Quanto cada dente de uma aresta de dentro sai da reta, de lado, em fração da célula. */
const TORTO_DA_ARESTA = 0.06
/** Onde ficam os dentes de cada aresta de dentro. */
const DENTES: readonly number[] = [1 / 3, 2 / 3]

/** FNV-1a de 32 bits: a semente do corte pelo nome da cena. */
function sementeDe(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: o mesmo corte em toda abertura, em todo computador. */
function sorteador(semente: number): () => number {
  let s = semente
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Corte = readonly (readonly Ponto[])[]

const cortes = new Map<string, Corte>()

function cortar(chave: string): Corte {
  const sorte = sorteador(sementeDe(`relevo:${chave}`))
  const torto = () => sorte() * 2 - 1
  // Os cantos: os de dentro andam nos dois eixos; os da borda, só ao longo dela; os quatro do painel ficam.
  const cantos: Ponto[][] = []
  for (let lin = 0; lin <= LINHAS_DO_RELEVO; lin += 1) {
    const linha: Ponto[] = []
    for (let col = 0; col <= COLUNAS_DO_RELEVO; col += 1) {
      const andaX = col > 0 && col < COLUNAS_DO_RELEVO
      const andaY = lin > 0 && lin < LINHAS_DO_RELEVO
      linha.push({
        x: AREA_DO_RELEVO.x + col * LARGURA_DA_CELULA + (andaX ? torto() * TORTO_DO_CANTO * LARGURA_DA_CELULA : 0),
        y: AREA_DO_RELEVO.y + lin * ALTURA_DA_CELULA + (andaY ? torto() * TORTO_DO_CANTO * ALTURA_DA_CELULA : 0),
      })
    }
    cantos.push(linha)
  }
  const canto = (lin: number, col: number): Ponto => cantos[lin]?.[col] ?? { x: AREA_DO_RELEVO.x, y: AREA_DO_RELEVO.y }
  // Os dentes das arestas de dentro (as da borda do painel ficam retas), uma vez por aresta.
  const dentes = (a: Ponto, b: Ponto, lado: 'x' | 'y', tamanho: number): Ponto[] =>
    DENTES.map((f) => {
      const desvio = torto() * TORTO_DA_ARESTA * tamanho
      const x = a.x + (b.x - a.x) * f
      const y = a.y + (b.y - a.y) * f
      return lado === 'y' ? { x, y: y + desvio } : { x: x + desvio, y }
    })
  const deitadas: Ponto[][][] = []
  for (let lin = 0; lin <= LINHAS_DO_RELEVO; lin += 1) {
    const linha: Ponto[][] = []
    for (let col = 0; col < COLUNAS_DO_RELEVO; col += 1) linha.push(lin > 0 && lin < LINHAS_DO_RELEVO ? dentes(canto(lin, col), canto(lin, col + 1), 'y', ALTURA_DA_CELULA) : [])
    deitadas.push(linha)
  }
  const empe: Ponto[][][] = []
  for (let lin = 0; lin < LINHAS_DO_RELEVO; lin += 1) {
    const linha: Ponto[][] = []
    for (let col = 0; col <= COLUNAS_DO_RELEVO; col += 1) linha.push(col > 0 && col < COLUNAS_DO_RELEVO ? dentes(canto(lin, col), canto(lin + 1, col), 'x', LARGURA_DA_CELULA) : [])
    empe.push(linha)
  }
  const deitada = (lin: number, col: number) => deitadas[lin]?.[col] ?? []
  const emPe = (lin: number, col: number) => empe[lin]?.[col] ?? []
  const placas: Ponto[][] = []
  for (let lin = 0; lin < LINHAS_DO_RELEVO; lin += 1) {
    for (let col = 0; col < COLUNAS_DO_RELEVO; col += 1) {
      // No sentido do relógio (y para baixo): em cima, à direita, embaixo (de volta) e à esquerda (de volta).
      placas.push([
        canto(lin, col),
        ...deitada(lin, col),
        canto(lin, col + 1),
        ...emPe(lin, col + 1),
        canto(lin + 1, col + 1),
        ...[...deitada(lin + 1, col)].reverse(),
        canto(lin + 1, col),
        ...[...emPe(lin, col)].reverse(),
      ])
    }
  }
  return placas
}

function corteDe(cena: CenaDoRelevo | null): Corte {
  const chave = cena ?? 'imagem-propria'
  const pronto = cortes.get(chave)
  if (pronto !== undefined) return pronto
  const corte = cortar(chave)
  cortes.set(chave, corte)
  return corte
}

export function ehPlaca(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor < PLACAS_DO_RELEVO
}

/** O contorno da placa, no sentido do relógio, em unidades do painel. */
export function poligonoDaPlaca(cena: CenaDoRelevo | null, placa: number): readonly Ponto[] {
  const corte = corteDe(cena)
  return corte[ehPlaca(placa) ? placa : 0] ?? []
}

export function caixaDe(poligono: readonly Ponto[]): Caixa {
  const xs = poligono.map((p) => p.x)
  const ys = poligono.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, largura: Math.max(...xs) - x, altura: Math.max(...ys) - y }
}

/** O caminho SVG do contorno, com a origem em `origem` (o canto da caixa, para o SVG de cada placa). */
export function caminhoSvg(poligono: readonly Ponto[], origem: Ponto = { x: 0, y: 0 }): string {
  return `${poligono.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x - origem.x).toFixed(1)} ${(p.y - origem.y).toFixed(1)}`).join('')}Z`
}

/** O `clip-path: polygon()` do contorno em % da caixa dele. */
export function recorteCss(poligono: readonly Ponto[], caixa: Caixa): string {
  const pontos = poligono.map((p) => `${(((p.x - caixa.x) / caixa.largura) * 100).toFixed(2)}% ${(((p.y - caixa.y) / caixa.altura) * 100).toFixed(2)}%`)
  return `polygon(${pontos.join(', ')})`
}

/** Um retângulo do painel em % de outra caixa (a imagem do painel dentro do botão da placa). */
export function retanguloNaCaixa(retangulo: Caixa, caixa: Caixa): { left: string; top: string; width: string; height: string } {
  return {
    left: `${(((retangulo.x - caixa.x) / caixa.largura) * 100).toFixed(3)}%`,
    top: `${(((retangulo.y - caixa.y) / caixa.altura) * 100).toFixed(3)}%`,
    width: `${((retangulo.largura / caixa.largura) * 100).toFixed(3)}%`,
    height: `${((retangulo.altura / caixa.altura) * 100).toFixed(3)}%`,
  }
}

/** A caixa em % do quadro (o quadro inteiro é o painel): o lugar do botão da placa. */
export function caixaEmPorcento(caixa: Caixa): Caixa {
  return {
    x: (caixa.x / LARGURA_DO_PAINEL) * 100,
    y: (caixa.y / ALTURA_DO_PAINEL) * 100,
    largura: (caixa.largura / LARGURA_DO_PAINEL) * 100,
    altura: (caixa.altura / ALTURA_DO_PAINEL) * 100,
  }
}

export const PAINEL_INTEIRO: Caixa = { x: 0, y: 0, largura: LARGURA_DO_PAINEL, altura: ALTURA_DO_PAINEL }
export const AREA: Caixa = { x: AREA_DO_RELEVO.x, y: AREA_DO_RELEVO.y, largura: AREA_DO_RELEVO.largura, altura: AREA_DO_RELEVO.altura }

/**
 * O lugar do encaixe da placa para quem não conhece o relevo (o app mais
 * velho desenha um encaixe quadrado ali): o meio da placa, em % do quadro, e
 * a largura dela dentro do teto do encaixe.
 */
export function lugarDaPlaca(cena: CenaDoRelevo | null, placa: number): { x: number; y: number; t: number } {
  const caixa = caixaEmPorcento(caixaDe(poligonoDaPlaca(cena, placa)))
  const arredondar = (n: number) => Math.round(n * 100) / 100
  return {
    x: arredondar(caixa.x + caixa.largura / 2),
    y: arredondar(caixa.y + caixa.altura / 2),
    t: arredondar(Math.min(TAMANHO_DO_ENCAIXE_MAX, Math.max(TAMANHO_DO_ENCAIXE_MIN, caixa.largura))),
  }
}
