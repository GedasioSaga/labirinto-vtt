/**
 * ALCANCE: AS CASAS QUE ACENDEM (plano docs/design/habilidades/ALCANCE.md §4; protótipo
 * aprovado tmp/proto-alcance/fonte.html, `dentroDaForma`, `casasDaForma` e `areaDaExplosao`).
 * A mesma conta no host, no mestre, no jogador, no Testar e no treino do Lobby.
 *
 * Forma: medida da borda da ficha INTEIRA de quem usa, como `casaNaAreaDaFicha`
 * (`lib/batalha/area.ts`). Na ficha de 1 casa dá o mesmo que o protótipo.
 *
 * Parede: a regra da visão que já existe (`visionSegments` + `hasLineOfSight`, `lib/visibility.ts`):
 * porta fechada e parede cortam; janela e porta aberta deixam passar; móvel baixo e barranco não
 * cortam; objeto com "Tapa a visão" corta. A casa acende se a linha do centro de QUALQUER casa da
 * ficha de quem usa até o centro dela não corta nada (o centro de uma ficha 2x2 cai na quina da
 * grade, onde a ponta da parede cortaria tudo). Na explosão, a linha sai do centro escolhido.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import { hasLineOfSight, type Segment } from '../../visibility'
import type { Casa, Direcao, PegadaNaGrade } from '../area'
import { centroDaCasa } from '../blocos'
import { raioDaExplosao, type FormaDaAreaLonge, type FormaDoAlcance } from './forma'

/** O que a grade e o mapa dão para a conta. */
interface GradeDoAlcance {
  /** Obstáculos de visão (`visionSegments` do mapa que a tela tem), em px de mundo. */
  segmentos: readonly Segment[]
  /** Casas da grade; nada acende fora de 0..colunas-1 x 0..linhas-1. */
  colunas: number
  linhas: number
  /** Px de mundo por casa (`map.grid`). */
  grade: number
}

export interface PedidoDasCasas extends GradeDoAlcance {
  forma: FormaDoAlcance
  /** A ficha inteira de quem usa (`pegadaDaFicha`). */
  quemUsa: PegadaNaGrade
  /** Para onde a mira aponta; só a linha, o quadrado à frente e o leque olham. */
  direcao: Direcao
  /**
   * As casas da ficha de quem usa também acendem: a regra de hoje deixa ele ser alvo (ajuda que
   * inclui quem usa, área "todos" num ponto colado). A forma `si` acende sempre.
   */
  acendeQuemUsa?: boolean
}

export interface PedidoDaExplosao extends GradeDoAlcance {
  forma: FormaDaAreaLonge
  /** A casa escolhida (`ponto`, ficha de 1 casa) ou a ficha inteira no centro (`ficha`). */
  centro: PegadaNaGrade
}

/** Onde a casa fica em relação à ficha inteira. */
interface CasaVistaDaFicha {
  /** Casas além da borda, na coluna e na linha (0 = na faixa da ficha). */
  foraNaCol: number
  foraNaRow: number
  /** A distância do xadrez até a borda (0 = uma casa da ficha). */
  distancia: number
}

function verDaFicha(ficha: PegadaNaGrade, casa: Casa): CasaVistaDaFicha {
  const foraNaCol = Math.max(ficha.col - casa.col, 0, casa.col - (ficha.col + ficha.tamanho - 1))
  const foraNaRow = Math.max(ficha.row - casa.row, 0, casa.row - (ficha.row + ficha.tamanho - 1))
  return { foraNaCol, foraNaRow, distancia: Math.max(foraNaCol, foraNaRow) }
}

/**
 * A casa vista por quem olha para `direcao`: `frente` = quantas casas além da borda da frente
 * (1 = colada nela); `lado` = a coluna contada da casa mais à esquerda da ficha (positivo = à
 * direita de quem olha). A mesma conta de `casaNaAreaDaFicha` (`area.ts`).
 */
function frenteELado(ficha: PegadaNaGrade, direcao: Direcao, casa: Casa): { frente: number; lado: number } {
  const ultimaCol = ficha.col + ficha.tamanho - 1
  const ultimaRow = ficha.row + ficha.tamanho - 1
  switch (direcao) {
    case 'norte':
      return { frente: ficha.row - casa.row, lado: casa.col - ficha.col }
    case 'sul':
      return { frente: casa.row - ultimaRow, lado: ultimaCol - casa.col }
    case 'leste':
      return { frente: casa.col - ultimaCol, lado: casa.row - ficha.row }
    case 'oeste':
      return { frente: ficha.col - casa.col, lado: ultimaRow - casa.row }
  }
}

/** A casa (fora da ficha) está na forma, sem olhar parede. */
function naForma(forma: FormaDoAlcance, ficha: PegadaNaGrade, direcao: Direcao, casa: Casa, vista: CasaVistaDaFicha): boolean {
  switch (forma.tipo) {
    case 'si':
      return false
    case 'alvo':
      return vista.distancia >= (forma.de ?? 1) && vista.distancia <= forma.ate
    case 'volta':
    case 'ponto':
    case 'ficha':
      return vista.distancia <= forma.ate
    case 'cruz':
      return (vista.foraNaCol === 0 || vista.foraNaRow === 0) && vista.distancia <= forma.ate
    case 'linha': {
      const { frente, lado } = frenteELado(ficha, direcao, casa)
      return frente >= 1 && frente <= forma.ate && lado >= 0 && lado < ficha.tamanho
    }
    case 'leque': {
      // A fileira colada tem a largura da ficha; cada fileira seguinte abre uma casa de cada lado.
      const { frente, lado } = frenteELado(ficha, direcao, casa)
      const abre = frente - 1
      return frente >= 1 && frente <= forma.ate && lado >= -abre && lado <= ficha.tamanho - 1 + abre
    }
    case 'frente': {
      // Centrado na ficha; com sobra ímpar, a metade a mais fica à direita de quem olha.
      const { frente, lado } = frenteELado(ficha, direcao, casa)
      const esquerda = -Math.floor((forma.lado - ficha.tamanho) / 2)
      return frente >= 1 && frente <= forma.lado && lado >= esquerda && lado < esquerda + forma.lado
    }
  }
}

/** Até quantas casas da borda da ficha a forma chega, em qualquer direção (a caixa da conta). */
function alcanceDaCaixa(forma: FormaDoAlcance): number {
  switch (forma.tipo) {
    case 'si':
      return 0
    case 'frente':
      return forma.lado
    default:
      return forma.ate
  }
}

interface Caixa {
  colMin: number
  colMax: number
  rowMin: number
  rowMax: number
}

function caixaEmVolta(ficha: PegadaNaGrade, folga: number, grade: GradeDoAlcance): Caixa {
  const ultimaCol = Math.ceil(grade.colunas) - 1
  const ultimaRow = Math.ceil(grade.linhas) - 1
  return {
    colMin: Math.max(0, ficha.col - folga),
    colMax: Math.min(ultimaCol, ficha.col + ficha.tamanho - 1 + folga),
    rowMin: Math.max(0, ficha.row - folga),
    rowMax: Math.min(ultimaRow, ficha.row + ficha.tamanho - 1 + folga),
  }
}

/** Só os obstáculos que tocam a caixa (em px): toda linha da conta fica dentro dela. */
function segmentosNaCaixa(segmentos: readonly Segment[], caixa: Caixa, grade: number): Segment[] {
  const xMin = caixa.colMin * grade
  const xMax = (caixa.colMax + 1) * grade
  const yMin = caixa.rowMin * grade
  const yMax = (caixa.rowMax + 1) * grade
  return segmentos.filter((s) => Math.max(s.x1, s.x2) >= xMin && Math.min(s.x1, s.x2) <= xMax && Math.max(s.y1, s.y2) >= yMin && Math.min(s.y1, s.y2) <= yMax)
}

/** Os centros, em px, das casas da ficha (de onde sai a linha da parede). */
function centrosDaFicha(ficha: PegadaNaGrade, grade: number): { x: number; y: number }[] {
  const centros: { x: number; y: number }[] = []
  for (let row = ficha.row; row < ficha.row + ficha.tamanho; row += 1) {
    for (let col = ficha.col; col < ficha.col + ficha.tamanho; col += 1) centros.push(centroDaCasa({ col, row }, grade))
  }
  return centros
}

/**
 * As casas que acendem, na ordem da grade (linha a linha, da esquerda para a direita): as da
 * forma, à vista de quem usa. As casas da ficha de quem usa acendem só com `acendeQuemUsa` (ou
 * na forma `si`), sem conferir parede.
 */
export function casasDoAlcance(pedido: PedidoDasCasas): Casa[] {
  const { forma, quemUsa, direcao, grade } = pedido
  const acendeQuemUsa = pedido.acendeQuemUsa === true || forma.tipo === 'si'
  const caixa = caixaEmVolta(quemUsa, alcanceDaCaixa(forma), pedido)
  const segmentos = segmentosNaCaixa(pedido.segmentos, caixa, grade)
  const deOnde = centrosDaFicha(quemUsa, grade)
  const acesas: Casa[] = []
  for (let row = caixa.rowMin; row <= caixa.rowMax; row += 1) {
    for (let col = caixa.colMin; col <= caixa.colMax; col += 1) {
      const casa = { col, row }
      const vista = verDaFicha(quemUsa, casa)
      if (vista.distancia === 0) {
        if (acendeQuemUsa) acesas.push(casa)
        continue
      }
      if (!naForma(forma, quemUsa, direcao, casa, vista)) continue
      const ate = centroDaCasa(casa, grade)
      if (deOnde.some((de) => hasLineOfSight(de, ate, segmentos))) acesas.push(casa)
    }
  }
  return acesas
}

/**
 * As casas da explosão em volta do centro escolhido, na ordem da grade: até `raio` casas da
 * borda do centro (as dele entram), à vista do centro. Quem entra (inimigo, aliado, quem usa) é
 * outra conta.
 */
export function casasDaExplosao(pedido: PedidoDaExplosao): Casa[] {
  const { centro, grade } = pedido
  const raio = raioDaExplosao(pedido.forma)
  // A caixa em volta do centro já é a explosão inteira (a distância do xadrez faz um quadrado).
  const caixa = caixaEmVolta(centro, raio, pedido)
  const segmentos = segmentosNaCaixa(pedido.segmentos, caixa, grade)
  const deOnde = centrosDaFicha(centro, grade)
  const acesas: Casa[] = []
  for (let row = caixa.rowMin; row <= caixa.rowMax; row += 1) {
    for (let col = caixa.colMin; col <= caixa.colMax; col += 1) {
      const casa = { col, row }
      const ate = centroDaCasa(casa, grade)
      if (verDaFicha(centro, casa).distancia === 0 || deOnde.some((de) => hasLineOfSight(de, ate, segmentos))) acesas.push(casa)
    }
  }
  return acesas
}
