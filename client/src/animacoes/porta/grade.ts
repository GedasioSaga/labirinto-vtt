import type { AnimacaoDePorta, PecaDaFolha } from '../../portas/animacoesDePorta'
import { pintarFolha } from '../../portas/animacoesDePorta'
import { comecarQuadro, escalaDa, quantasPecas, saidaQuad, suave, trecho } from './_folha'

/**
 * GRADE QUE SOBE: vista de cima, a folha cheia vira uma grade ao longo do vão
 * inteiro: abre vãos e as barras crescem atravessadas na parede (passam um
 * pouco para os dois lados, como as pontas de uma grade de ferro vistas de
 * cima), presas por uma travessa fina. A corrente dá um tranco curto (tremor ao
 * longo da parede) e a grade sobe: as barras encolhem em perspectiva, do
 * centro para as pontas, até sumir. Fechando, o caminho volta: a grade desce,
 * treme ao assentar e fecha.
 *
 * Uma barra a cada 6 px de TELA, para a grade ler em qualquer zoom; barras e
 * travessa são pintadas juntas (`pintarFolha`), uma grade com um contorno só.
 * Opaca o caminho inteiro.
 */

const PASSO_DA_BARRA_PX = 6
/** O vão inteiro tem 1/0,6 do comprimento da folha do protótipo: os limites crescem na mesma conta. */
const BARRAS_MIN = 6
const BARRAS_MAX = 18
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

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso) => {
  const p = comecarQuadro(g, porta, progresso)
  if (p === null) return

  const L = porta.meioComprimento
  const barras = quantasPecas(porta, PASSO_DA_BARRA_PX, BARRAS_MIN, BARRAS_MAX)
  const passo = (2 * L) / barras
  const grade = saidaQuad(trecho(p, 0, FIM_DA_GRADE))
  const t = trecho(p, INICIO_DO_TREMOR, FIM_DO_TREMOR)
  const tremor = (TREMOR_PX / escalaDa(porta)) * Math.sin(2 * Math.PI * TREMOR_VOLTAS * t) * (1 - t)
  const sobe = trecho(p, INICIO_DA_SUBIDA, 1)
  const cx = porta.cx + porta.ux * tremor
  const cy = porta.cy + porta.uy * tremor
  const pecas: PecaDaFolha[] = []

  // Travessa: começa cheia (a porta fechada), afina com a grade e some na primeira metade da subida.
  const meiaTravessa = (porta.espessura / 2) * (1 - (1 - TRAVESSA) * grade) * (1 - suave(trecho(sobe, 0, 0.55)))
  if (meiaTravessa > 0) pecas.push({ forma: 'retangulo', cx, cy, dx: porta.ux, dy: porta.uy, meioComprimento: L, meiaEspessura: meiaTravessa })

  const meio = (barras - 1) / 2
  for (let i = 0; i < barras; i += 1) {
    const distancia = meio > 0 ? Math.abs(i - meio) / meio : 0
    const tamanho = 1 - suave(trecho(sobe, ONDA * distancia, ONDA * distancia + (1 - ONDA)))
    if (tamanho <= 0) continue
    const desvio = -L + passo * (i + 0.5)
    const meiaLargura = (passo / 2) * (1 - VAO * grade) * tamanho
    const meiaAltura = (porta.espessura / 2) * (1 + PONTA * grade) * tamanho
    pecas.push({ forma: 'retangulo', cx: cx + porta.ux * desvio, cy: cy + porta.uy * desvio, dx: porta.ux, dy: porta.uy, meioComprimento: meiaLargura, meiaEspessura: meiaAltura })
  }
  pintarFolha(g, porta, pecas)
}

export default desenhar
