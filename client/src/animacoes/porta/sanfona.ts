import type { AnimacaoDePorta, PecaDaFolha } from '../../portas/animacoesDePorta'
import { pintarFolha } from '../../portas/animacoesDePorta'
import { comecarQuadro, saidaQuad, suave, trecho } from './_folha'

/**
 * SANFONA: a folha, que enche o vão, dobra em 4 gomos em zigue-zague, presa na
 * ponta de (x2,y2) (o mesmo lado para onde o "Deslizar" corre), e o pacote
 * dobrado recolhe para dentro dessa ponta, no batente. As dobras ficam
 * centradas na linha da parede: o pacote sai no máximo meio gomo para cada
 * lado.
 *
 * Os gomos são retângulos da espessura da porta; nas dobras, um círculo do
 * mesmo raio fecha a quina (a dobradiça). Gomos e dobras são pintados juntos
 * (`pintarFolha`): uma sanfona com um contorno só. Opaca o caminho inteiro.
 */

const GOMOS = 4
const DOBRA_MAX_RAD = (78 * Math.PI) / 180
const FIM_DA_DOBRA = 0.7
const INICIO_DO_RECOLHER = 0.55
/** No fim do recolher a espessura também afina, para o pacote sumir sem deixar um ponto. */
const AFINA_ABAIXO_DE = 0.35

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso) => {
  const p = comecarQuadro(g, porta, progresso)
  if (p === null) return

  const resto = 1 - suave(trecho(p, INICIO_DO_RECOLHER, 1))
  const gomo = ((2 * porta.meioComprimento) / GOMOS) * resto
  if (gomo <= 0) return
  const dobra = DOBRA_MAX_RAD * saidaQuad(trecho(p, 0, FIM_DA_DOBRA))
  const meiaEspessura = (porta.espessura / 2) * Math.min(1, resto / AFINA_ABAIXO_DE)
  const nx = -porta.uy
  const ny = porta.ux
  const passo = gomo * Math.cos(dobra)
  const meiaAltura = (gomo * Math.sin(dobra)) / 2
  // Âncora: a ponta de (x2,y2). Vértice k anda k passos para (x1,y1) e alterna de lado.
  const ax = porta.cx + porta.ux * porta.meioComprimento
  const ay = porta.cy + porta.uy * porta.meioComprimento
  const vx: number[] = []
  const vy: number[] = []
  for (let k = 0; k <= GOMOS; k += 1) {
    const lado = k % 2 === 0 ? -meiaAltura : meiaAltura
    vx.push(ax - porta.ux * passo * k + nx * lado)
    vy.push(ay - porta.uy * passo * k + ny * lado)
  }
  const pecas: PecaDaFolha[] = []
  for (let k = 1; k <= GOMOS; k += 1) {
    const dx = (vx[k] - vx[k - 1]) / gomo
    const dy = (vy[k] - vy[k - 1]) / gomo
    pecas.push({ forma: 'retangulo', cx: (vx[k] + vx[k - 1]) / 2, cy: (vy[k] + vy[k - 1]) / 2, dx, dy, meioComprimento: gomo / 2, meiaEspessura })
  }
  for (let k = 1; k < GOMOS; k += 1) pecas.push({ forma: 'circulo', cx: vx[k], cy: vy[k], raio: meiaEspessura })
  pintarFolha(g, porta, pecas)
}

export default desenhar
