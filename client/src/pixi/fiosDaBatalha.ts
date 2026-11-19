import { Graphics } from 'pixi.js'
import type { FioNoCampo } from '../lib/batalha/marcasNoCampo'
import { BRASA, CONTORNO_DO_CAMPO } from './drawMarcasDoCampo'

/**
 * CAMPO DE BATALHA (protótipo aprovado em 19/11/2026): os fios entre fichas,
 * no chão (por baixo das fichas, na faixa da grade da batalha), no mestre e no
 * jogador. Tracejado em brasa com a ponta de seta:
 *
 *   voo     do atacante ao alvo, enquanto o golpe espera a reação;
 *   contra  de quem contra-ataca até quem tem a vez (que espera).
 *
 * Px de TELA (o traço e o tracejado não mudam com o zoom): redesenha só quando
 * os fios, as fichas das pontas ou o zoom mudam (`chave`). Sem fio, o Graphics
 * fica vazio e não é limpo de novo (limpar o vazio refaria o lote do mundo).
 */

const TRACO_PX = 2.5
const CONTORNO_PX = 6
const TRACO_CHEIO_PX = 7
const VAO_PX = 7
const PONTA_COMPRIMENTO_PX = 12
const PONTA_MEIA_LARGURA_PX = 6.5
/** Folga da ponta e da saída além da borda da ficha, em px de tela. */
const FOLGA_DA_PONTA_PX = 14
const FOLGA_DA_SAIDA_PX = 8

export interface PontaDoFio {
  x: number
  y: number
  /** Meio lado da ficha, em px de mundo. */
  raio: number
}

export interface FiosDaBatalha {
  readonly grafico: Graphics
  /** Desenha os fios (`null` = nenhum: fora da batalha, exportação). `onde` lê a ficha pelo id. */
  desenhar(fios: readonly FioNoCampo[] | null, onde: (tokenId: string) => PontaDoFio | null, escala: number): void
}

function tracejar(g: Graphics, ax: number, ay: number, bx: number, by: number, cheio: number, vao: number): void {
  const total = Math.hypot(bx - ax, by - ay)
  if (total <= 0) return
  const ux = (bx - ax) / total
  const uy = (by - ay) / total
  for (let d = 0; d < total; d += cheio + vao) {
    const fim = Math.min(total, d + cheio)
    g.moveTo(ax + ux * d, ay + uy * d).lineTo(ax + ux * fim, ay + uy * fim)
  }
}

export function criarFiosDaBatalha(): FiosDaBatalha {
  const grafico = new Graphics()
  grafico.label = 'fios-da-batalha'
  grafico.eventMode = 'none'
  let chave = ''

  return {
    grafico,
    desenhar(fios, onde, escala) {
      const pontas: { a: PontaDoFio; b: PontaDoFio }[] = []
      for (const fio of fios ?? []) {
        const a = onde(fio.de)
        const b = onde(fio.para)
        if (a !== null && b !== null && (a.x !== b.x || a.y !== b.y)) pontas.push({ a, b })
      }
      const nova = pontas.length === 0 ? '' : `${escala}|${pontas.map(({ a, b }) => `${a.x},${a.y},${a.raio}>${b.x},${b.y},${b.raio}`).join(';')}`
      if (nova === chave) return
      chave = nova
      grafico.clear()
      if (pontas.length === 0) return
      const px = 1 / (escala > 0 ? escala : 1)
      const trechos: { ax: number; ay: number; bx: number; by: number }[] = []
      const setas: number[][] = []
      for (const { a, b } of pontas) {
        const total = Math.hypot(b.x - a.x, b.y - a.y)
        const ux = (b.x - a.x) / total
        const uy = (b.y - a.y) / total
        const saida = a.raio + FOLGA_DA_SAIDA_PX * px
        const chegada = b.raio + FOLGA_DA_PONTA_PX * px
        // Fichas encostadas: não cabe fio entre elas.
        if (total <= saida + chegada + PONTA_COMPRIMENTO_PX * px) continue
        const pontaX = b.x - ux * chegada
        const pontaY = b.y - uy * chegada
        const baseX = pontaX - ux * PONTA_COMPRIMENTO_PX * px
        const baseY = pontaY - uy * PONTA_COMPRIMENTO_PX * px
        trechos.push({ ax: a.x + ux * saida, ay: a.y + uy * saida, bx: baseX, by: baseY })
        const m = PONTA_MEIA_LARGURA_PX * px
        setas.push([pontaX, pontaY, baseX - uy * m, baseY + ux * m, baseX + uy * m, baseY - ux * m])
      }
      // Contorno escuro por baixo e a brasa por cima: o mesmo tracejado, duas vezes.
      for (const t of trechos) tracejar(grafico, t.ax, t.ay, t.bx, t.by, TRACO_CHEIO_PX * px, VAO_PX * px)
      if (trechos.length > 0) grafico.stroke({ width: CONTORNO_PX * px, color: CONTORNO_DO_CAMPO, alpha: 0.62, cap: 'butt' })
      for (const t of trechos) tracejar(grafico, t.ax, t.ay, t.bx, t.by, TRACO_CHEIO_PX * px, VAO_PX * px)
      if (trechos.length > 0) grafico.stroke({ width: TRACO_PX * px, color: BRASA, cap: 'butt' })
      for (const seta of setas) grafico.poly(seta).fill({ color: BRASA }).stroke({ width: 1.5 * px, color: CONTORNO_DO_CAMPO, alpha: 0.62 })
    },
  }
}
