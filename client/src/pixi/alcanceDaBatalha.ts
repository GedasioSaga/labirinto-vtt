import { Container, Graphics } from 'pixi.js'
import type { Casa } from '../lib/batalha/blocos'
import { CONTORNO_DO_CAMPO, LATAO } from './drawMarcasDoCampo'

/**
 * CAMPO DE BATALHA (protótipo aprovado em 19/11/2026): ATÉ ONDE DÁ PARA ANDAR.
 * As casas ao alcance da ficha que tem a vez clareiam um pouco, ganham a linha
 * da grade (só aqui se conta casa: fora, a grade é só a cruz,
 * `gradeDaBatalha.ts`) e uma borda de latão entre contornos escuros. No chão,
 * na faixa da grade (por baixo das fichas), no mestre e no jogador.
 *
 * Traços em px de TELA: o zoom refaz; sem mudança (as mesmas casas, a mesma
 * escala), nada é desenhado (`chave`).
 */

const CLARO = 0xfffcf0
const CLARO_ALPHA = 0.17
/** A linha de dentro: o mesmo cinza que escurece o chão da cruz, um pouco mais forte. */
const LINHA_COR = 0x5a5a5a
const LINHA_ALPHA = 0.5
const LINHA_PX = 1
const BORDA_PX = 2
const BORDA_CONTORNO_PX = 4.5

export interface AlcanceDaBatalha {
  readonly camada: Container
  /** As casas ao alcance (`null` ou vazio = nenhuma), a casa da grade e o zoom. */
  desenhar(casas: readonly Casa[] | null, grid: number, escala: number): void
}

export function criarAlcanceDaBatalha(): AlcanceDaBatalha {
  const camada = new Container()
  camada.label = 'alcance-da-batalha'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  const claro = new Graphics()
  const linhas = new Graphics()
  linhas.blendMode = 'multiply'
  const borda = new Graphics()
  camada.addChild(claro, linhas, borda)
  let chave = ''

  const limpar = () => {
    for (const g of [claro, linhas, borda]) if (g.context.instructions.length > 0) g.clear()
  }

  return {
    camada,
    desenhar(casas, grid, escala) {
      // Só a vez de saída não é alcance: sem casa para onde ir, nada se desenha.
      const nova = casas === null || casas.length < 2 || grid <= 0 ? '' : `${grid}|${escala}|${casas.map((c) => `${c.col},${c.row}`).join(';')}`
      if (nova === chave) return
      chave = nova
      limpar()
      if (nova === '' || casas === null) return
      const tem = new Set(casas.map((c) => `${c.col},${c.row}`))
      const dentro = (col: number, row: number) => tem.has(`${col},${row}`)
      const px = 1 / (escala > 0 ? escala : 1)
      for (const { col, row } of casas) claro.rect(col * grid, row * grid, grid, grid)
      claro.fill({ color: CLARO, alpha: CLARO_ALPHA })
      let temLinha = false
      let temBorda = false
      for (const { col, row } of casas) {
        const x = col * grid
        const y = row * grid
        // A linha de dentro: a borda direita e a de baixo, quando a vizinha também é alcance.
        if (dentro(col + 1, row)) {
          linhas.moveTo(x + grid, y).lineTo(x + grid, y + grid)
          temLinha = true
        }
        if (dentro(col, row + 1)) {
          linhas.moveTo(x, y + grid).lineTo(x + grid, y + grid)
          temLinha = true
        }
        // A borda: cada lado cuja vizinha não é alcance.
        if (!dentro(col, row - 1)) borda.moveTo(x, y).lineTo(x + grid, y)
        if (!dentro(col + 1, row)) borda.moveTo(x + grid, y).lineTo(x + grid, y + grid)
        if (!dentro(col, row + 1)) borda.moveTo(x, y + grid).lineTo(x + grid, y + grid)
        if (!dentro(col - 1, row)) borda.moveTo(x, y).lineTo(x, y + grid)
        temBorda = true
      }
      if (temLinha) linhas.stroke({ width: LINHA_PX * px, color: LINHA_COR, alpha: LINHA_ALPHA })
      if (!temBorda) return
      borda.stroke({ width: BORDA_CONTORNO_PX * px, color: CONTORNO_DO_CAMPO, alpha: 0.62, cap: 'square' })
      // O mesmo caminho de novo, por cima, em latão.
      for (const { col, row } of casas) {
        const x = col * grid
        const y = row * grid
        if (!dentro(col, row - 1)) borda.moveTo(x, y).lineTo(x + grid, y)
        if (!dentro(col + 1, row)) borda.moveTo(x + grid, y).lineTo(x + grid, y + grid)
        if (!dentro(col, row + 1)) borda.moveTo(x, y + grid).lineTo(x + grid, y + grid)
        if (!dentro(col - 1, row)) borda.moveTo(x, y).lineTo(x, y + grid)
      }
      borda.stroke({ width: BORDA_PX * px, color: LATAO, cap: 'square' })
    },
  }
}
