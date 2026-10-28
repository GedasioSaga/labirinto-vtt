import type { Point } from '../../pixi/world'
import type { Segment } from '../visibility'
import { blocosEntre, casaDoPonto, centroDaCasa, type Casa } from './blocos'
import {
  casasNoCirculo,
  casasNoCone,
  direcaoMaisPerto,
  DIRECOES_EM_ORDEM,
  linhaDeVisaoEntreCasas,
  PASSO_DA_DIRECAO,
  type Direcao8,
  type LimitesDaGrade,
  type LinhaDeVisao,
} from './medicao'

/**
 * FERRAMENTAS DO JOGADOR EM BATALHA (fatia B6 de
 * docs/planos/modo-batalha-2026-10-24.md, protótipo aprovado em
 * docs/design/batalha-ferramentas/): Medir em blocos, Círculo, Cone e Visão,
 * e a forma que a medida tem quando vai ao mestre ("Compartilhar com o mestre").
 *
 * Decisões do usuário (28/10): o Medir conta em linha reta, casa a casa, sem
 * olhar parede; em batalha o Medir de sempre conta blocos e Círculo, Cone e
 * Visão só aparecem em batalha. A Visão usa só as paredes que o jogador
 * conhece (parede invisível não corta medição; o mestre arbitra).
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

export type FerramentaDeMedida = 'regua' | 'circulo' | 'cone' | 'visao'

export const FERRAMENTAS_DE_MEDIDA: readonly FerramentaDeMedida[] = ['regua', 'circulo', 'cone', 'visao']

/** Teto do raio do círculo, em blocos (o do protótipo). */
export const RAIO_MAXIMO = 9
/** Teto do comprimento do cone, em blocos (o do protótipo). */
export const CONE_MAXIMO = 12

export function textoBlocos(n: number): string {
  return n === 1 ? '1 bloco' : `${n} blocos`
}

/**
 * A medida em casas: o que a tela do jogador desenha em batalha e o que vai ao
 * mestre. A régua leva pontos de mundo porque fora da batalha ela não é de
 * casa (encaixa no vértice da grade); em batalha os pontos são centros de casa.
 */
export type MedidaCompartilhada =
  | { readonly ferramenta: 'regua'; readonly de: Point; readonly ate: Point }
  | { readonly ferramenta: 'circulo'; readonly centro: Casa; readonly raio: number }
  | { readonly ferramenta: 'cone'; readonly origem: Casa; readonly direcao: Direcao8; readonly comprimento: number }
  | { readonly ferramenta: 'visao'; readonly de: Casa; readonly para: Casa }

/** O tamanho do mapa: casas e o lado da casa em px de mundo. */
export interface GradeDoMapa extends LimitesDaGrade {
  readonly grid: number
}

function prenderNaGrade(casa: Casa, grade: LimitesDaGrade): Casa {
  return {
    col: Math.min(Math.max(0, Math.ceil(grade.colunas) - 1), Math.max(0, casa.col)),
    row: Math.min(Math.max(0, Math.ceil(grade.linhas) - 1), Math.max(0, casa.row)),
  }
}

function mesmaCasa(a: Casa, b: Casa): boolean {
  return a.col === b.col && a.row === b.row
}

/**
 * O gesto (de onde o dedo apertou até onde está, px de mundo) virando medida
 * de batalha. As duas pontas ficam presas no mapa. Cone sem direção ainda
 * (as duas pontas na mesma casa) aponta para leste com comprimento 0.
 */
export function medidaDoGesto(ferramenta: FerramentaDeMedida, inicio: Point, fim: Point, grade: GradeDoMapa): MedidaCompartilhada {
  const de = prenderNaGrade(casaDoPonto(inicio, grade.grid), grade)
  const ate = prenderNaGrade(casaDoPonto(fim, grade.grid), grade)
  switch (ferramenta) {
    case 'regua':
      return { ferramenta, de: centroDaCasa(de, grade.grid), ate: centroDaCasa(ate, grade.grid) }
    case 'circulo':
      return { ferramenta, centro: de, raio: Math.min(RAIO_MAXIMO, blocosEntre(de, ate)) }
    case 'cone':
      return {
        ferramenta,
        origem: de,
        direcao: direcaoMaisPerto(ate.col - de.col, ate.row - de.row) ?? 'leste',
        comprimento: Math.min(CONE_MAXIMO, blocosEntre(de, ate)),
      }
    case 'visao':
      return { ferramenta, de, para: ate }
  }
}

/** Medida vazia (um toque sem arrastar): some ao soltar, em vez de ficar na tela e ir ao mestre. */
export function medidaVazia(medida: MedidaCompartilhada, grid: number): boolean {
  switch (medida.ferramenta) {
    case 'regua':
      return mesmaCasa(casaDoPonto(medida.de, grid), casaDoPonto(medida.ate, grid))
    case 'circulo':
      return medida.raio === 0
    case 'cone':
      return medida.comprimento === 0
    case 'visao':
      return mesmaCasa(medida.de, medida.para)
  }
}

/**
 * O fim do gesto que desenha `medida` a partir de `inicio`: é por ele que Q, E,
 * + e − mexem na medida já solta sem estado novo (o gesto continua sendo dois
 * pontos). `null` quando a ferramenta não tem o que mudar.
 */
export function fimQueDesenha(medida: MedidaCompartilhada, grid: number): Point | null {
  if (medida.ferramenta === 'circulo') return centroDaCasa({ col: medida.centro.col + medida.raio, row: medida.centro.row }, grid)
  if (medida.ferramenta !== 'cone') return null
  const [ux, uy] = PASSO_DA_DIRECAO[medida.direcao]
  return centroDaCasa({ col: medida.origem.col + ux * medida.comprimento, row: medida.origem.row + uy * medida.comprimento }, grid)
}

/** Q (−1) e E (+1) giram o cone um oitavo; cone sem comprimento ganha 1 bloco. */
export function girarCone(medida: MedidaCompartilhada, sentido: 1 | -1): MedidaCompartilhada {
  if (medida.ferramenta !== 'cone') return medida
  const indice = DIRECOES_EM_ORDEM.indexOf(medida.direcao)
  const direcao = DIRECOES_EM_ORDEM[(indice + sentido + 8) % 8] ?? medida.direcao
  return { ...medida, direcao, comprimento: Math.max(1, medida.comprimento) }
}

/** + e − mudam o raio do círculo (0 a 9) e o comprimento do cone (1 a 12). */
export function ajustarTamanho(medida: MedidaCompartilhada, passo: 1 | -1): MedidaCompartilhada {
  if (medida.ferramenta === 'circulo') return { ...medida, raio: Math.min(RAIO_MAXIMO, Math.max(0, medida.raio + passo)) }
  if (medida.ferramenta === 'cone') return { ...medida, comprimento: Math.min(CONE_MAXIMO, Math.max(1, medida.comprimento + passo)) }
  return medida
}

/** As casas da régua, da primeira à última, uma por bloco (a do protótipo: arredonda a reta casa a casa). */
export function casasDaRegua(de: Casa, ate: Casa): Casa[] {
  const n = blocosEntre(de, ate)
  const casas: Casa[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = n === 0 ? 0 : i / n
    casas.push({ col: Math.round(de.col + (ate.col - de.col) * t), row: Math.round(de.row + (ate.row - de.row) * t) })
  }
  return casas
}

const NOME_DA_DIRECAO: Readonly<Record<Direcao8, string>> = {
  leste: 'o leste',
  sudeste: 'o sudeste',
  sul: 'o sul',
  sudoeste: 'o sudoeste',
  oeste: 'o oeste',
  noroeste: 'o noroeste',
  norte: 'o norte',
  nordeste: 'o nordeste',
}

/** O que a tela desenha e diz de uma medida de batalha. */
export interface LeituraDaMedida {
  /** O rótulo ("6 blocos", "raio 2, 25 blocos", "Vê, a 5 blocos"…), também o que o leitor de tela ouve. */
  texto: string
  /** Casas pintadas: as da régua (sem a de saída, numeradas), as do círculo ou as do cone. */
  casas: Casa[]
  /** A régua numera cada casa com o bloco dela. */
  numerada: boolean
  /** Só na Visão: a resposta contra as paredes que o jogador conhece. */
  visao: LinhaDeVisao | null
  /** Onde o rótulo mora (centro da casa, px de mundo). */
  ancora: Point
}

/**
 * A leitura de uma medida na tela do jogador. `obstaculos`: o que barra a
 * Visão para ele (`visionSegments` do recorte); as outras ferramentas não
 * olham parede.
 */
export function lerMedida(medida: MedidaCompartilhada, grade: GradeDoMapa, obstaculos: readonly Segment[]): LeituraDaMedida {
  const { grid } = grade
  switch (medida.ferramenta) {
    case 'regua': {
      const de = casaDoPonto(medida.de, grid)
      const ate = casaDoPonto(medida.ate, grid)
      return { texto: textoBlocos(blocosEntre(de, ate)), casas: casasDaRegua(de, ate).slice(1), numerada: true, visao: null, ancora: medida.ate }
    }
    case 'circulo': {
      const casas = casasNoCirculo(medida.centro, medida.raio, grade)
      const canto = prenderNaGrade({ col: medida.centro.col + medida.raio, row: medida.centro.row - medida.raio }, grade)
      return { texto: `raio ${medida.raio}, ${textoBlocos(casas.length)}`, casas, numerada: false, visao: null, ancora: centroDaCasa(canto, grid) }
    }
    case 'cone': {
      if (medida.comprimento === 0) return { texto: 'Arraste para a direção', casas: [], numerada: false, visao: null, ancora: centroDaCasa(medida.origem, grid) }
      const casas = casasNoCone(medida.origem, medida.direcao, medida.comprimento, grade)
      const [ux, uy] = PASSO_DA_DIRECAO[medida.direcao]
      const ponta = prenderNaGrade({ col: medida.origem.col + ux * medida.comprimento, row: medida.origem.row + uy * medida.comprimento }, grade)
      return {
        texto: `${medida.comprimento} para ${NOME_DA_DIRECAO[medida.direcao]}, ${textoBlocos(casas.length)}`,
        casas,
        numerada: false,
        visao: null,
        ancora: centroDaCasa(ponta, grid),
      }
    }
    case 'visao': {
      const ancora = centroDaCasa(medida.para, grid)
      if (mesmaCasa(medida.de, medida.para)) return { texto: 'Arraste até o alvo', casas: [], numerada: false, visao: null, ancora }
      const visao = linhaDeVisaoEntreCasas(medida.de, medida.para, obstaculos, grid)
      const distancia = textoBlocos(blocosEntre(medida.de, medida.para))
      const texto = visao === null || visao.livre ? `Vê, a ${distancia}` : `Parede no caminho, a ${distancia}`
      return { texto, casas: [], numerada: false, visao, ancora }
    }
  }
}

/**
 * O rótulo que o MESTRE lê da medida de um jogador, montado só de números
 * (nada de texto vem do jogador). A Visão no mestre não conta parede: ele vê
 * o mapa inteiro e arbitra o efeito real. `foraDaBatalha`: a régua de sempre,
 * com o rótulo do Medir do mapa (`rotuloForaDaBatalha`).
 */
export function rotuloParaOMestre(nome: string, medida: MedidaCompartilhada, grade: GradeDoMapa, rotuloForaDaBatalha: string | null): string {
  if (medida.ferramenta === 'regua' && rotuloForaDaBatalha !== null) return `${nome}: ${rotuloForaDaBatalha}`
  if (medida.ferramenta === 'visao') return `${nome}: visão, a ${textoBlocos(blocosEntre(medida.de, medida.para))}`
  return `${nome}: ${lerMedida(medida, grade, []).texto}`
}

function casaNoMapa(casa: Casa, grade: LimitesDaGrade): boolean {
  return Number.isInteger(casa.col) && Number.isInteger(casa.row) && casa.col >= 0 && casa.row >= 0 && casa.col < grade.colunas && casa.row < grade.linhas
}

function pontoNoMapa(p: Point, grade: GradeDoMapa): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= grade.colunas * grade.grid && p.y <= grade.linhas * grade.grid
}

/**
 * O HOST confere a medida que chegou do jogador contra o mapa da cena dele:
 * casas e pontos dentro do mapa, raio e comprimento dentro do teto. Círculo,
 * Cone e Visão só existem em batalha. A forma (tipos, direção numa das 8) já
 * passou pelo parser do protocolo; aqui é o que depende do mapa.
 */
export function medidaCabeNoMapa(medida: MedidaCompartilhada, grade: GradeDoMapa, emBatalha: boolean): boolean {
  if (!(grade.grid > 0) || !Number.isFinite(grade.colunas) || !Number.isFinite(grade.linhas)) return false
  switch (medida.ferramenta) {
    case 'regua':
      return pontoNoMapa(medida.de, grade) && pontoNoMapa(medida.ate, grade)
    case 'circulo':
      return emBatalha && casaNoMapa(medida.centro, grade) && medida.raio >= 0 && medida.raio <= RAIO_MAXIMO
    case 'cone':
      return emBatalha && casaNoMapa(medida.origem, grade) && medida.comprimento >= 1 && medida.comprimento <= CONE_MAXIMO
    case 'visao':
      return emBatalha && casaNoMapa(medida.de, grade) && casaNoMapa(medida.para, grade)
  }
}
