import type { AnimacaoDePorta, PortaParaDesenho } from '../../portas/animacoesDePorta'
import { desenharBatente, tracarRetanguloDaPorta } from '../../portas/animacoesDePorta'

/**
 * GRADE QUE SOBE: vista de cima, a folha cheia vira uma grade: abre vãos e as
 * barras crescem atravessadas na parede (passam um pouco para os dois lados,
 * como as pontas de uma grade de ferro vistas de cima), presas por uma
 * travessa fina. A corrente dá um tranco curto (tremor ao longo da parede) e a
 * grade sobe: as barras encolhem em perspectiva, do centro para as pontas, até
 * sumir. Fechando, o caminho volta: a grade desce, treme ao assentar e fecha.
 *
 * Uma barra a cada 6 px de TELA, para a grade ler em qualquer zoom. Opaca o
 * caminho inteiro.
 */

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const trecho = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a))
const suave = (x: number): number => x * x * (3 - 2 * x)
const saidaQuad = (x: number): number => 1 - (1 - x) * (1 - x)

const PASSO_DA_BARRA_PX = 6
const BARRAS_MIN = 4
const BARRAS_MAX = 11
/** Os vãos abrem e as barras crescem até aqui. */
const FIM_DA_GRADE = 0.22
/** Fração da largura da barra que vira vão. */
const VAO = 0.6
/** Quanto a barra passa da espessura da porta, para cada lado (fração da meia espessura). */
const PONTA = 1
/** A travessa fica com esta fração da espessura da porta. */
const TRAVESSA = 0.3
/** Tranco da corrente: 3 idas e vindas de 0,9 px de tela que morrem até o fim do trecho. */
const INICIO_DO_TREMOR = 0.18
const FIM_DO_TREMOR = 0.44
const TREMOR_PX = 0.9
const TREMOR_VOLTAS = 3
const INICIO_DA_SUBIDA = 0.4
/** Atraso das pontas na subida (o centro sobe primeiro). */
const ONDA = 0.35

function desenharFechada(g: Parameters<AnimacaoDePorta['desenhar']>[0], porta: PortaParaDesenho): void {
  tracarRetanguloDaPorta(g, porta.cx, porta.cy, porta.ux, porta.uy, porta.meioComprimento, porta.espessura / 2)
  g.fill({ color: porta.cor })
}

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso) => {
  const p = clamp01(progresso)
  if (p <= 0) {
    desenharFechada(g, porta)
    return
  }
  desenharBatente(g, porta)
  if (p >= 1) return

  const L = porta.meioComprimento
  const escala = porta.escala > 0 ? porta.escala : 1
  const barras = Math.min(BARRAS_MAX, Math.max(BARRAS_MIN, Math.round((2 * L * escala) / PASSO_DA_BARRA_PX)))
  const passo = (2 * L) / barras
  const grade = saidaQuad(trecho(p, 0, FIM_DA_GRADE))
  const t = trecho(p, INICIO_DO_TREMOR, FIM_DO_TREMOR)
  const tremor = (TREMOR_PX / escala) * Math.sin(2 * Math.PI * TREMOR_VOLTAS * t) * (1 - t)
  const sobe = trecho(p, INICIO_DA_SUBIDA, 1)
  const cx = porta.cx + porta.ux * tremor
  const cy = porta.cy + porta.uy * tremor

  // Travessa: começa cheia (a porta fechada), afina com a grade e some na primeira metade da subida.
  const meiaTravessa = (porta.espessura / 2) * (1 - (1 - TRAVESSA) * grade) * (1 - suave(trecho(sobe, 0, 0.55)))
  if (meiaTravessa > 0) {
    tracarRetanguloDaPorta(g, cx, cy, porta.ux, porta.uy, L, meiaTravessa)
    g.fill({ color: porta.cor })
  }

  const meio = (barras - 1) / 2
  for (let i = 0; i < barras; i += 1) {
    const distancia = meio > 0 ? Math.abs(i - meio) / meio : 0
    const tamanho = 1 - suave(trecho(sobe, ONDA * distancia, ONDA * distancia + (1 - ONDA)))
    if (tamanho <= 0) continue
    const desvio = -L + passo * (i + 0.5)
    const meiaLargura = (passo / 2) * (1 - VAO * grade) * tamanho
    const meiaAltura = (porta.espessura / 2) * (1 + PONTA * grade) * tamanho
    tracarRetanguloDaPorta(g, cx + porta.ux * desvio, cy + porta.uy * desvio, porta.ux, porta.uy, meiaLargura, meiaAltura)
    g.fill({ color: porta.cor })
  }
}

export default desenhar
