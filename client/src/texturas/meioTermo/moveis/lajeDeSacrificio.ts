/**
 * LAJE DE SACRIFÍCIO (lote L2 das referências, 16/11/2026: versão original, só a ideia do objeto). Uma laje grossa
 * de pedra lavrada à mão, de beira irregular, deitada sobre dois blocos de pedra; em cima, a CALHA cavada em volta,
 * perto da beira, que desce para a BICA do canto da frente; no meio, a MANCHA escura e velha, seca, que escorreu um
 * fio até a calha; nas duas pontas, uma argola de ferro presa na pedra. Contida de propósito: nada de sangue vivo,
 * só a mancha que diz que a pedra foi usada.
 *
 * De cima aparecem a laje (o lavrado, a calha e a mancha) e a sombra comprida; na 3/4 a laje é um tampo solto com a
 * beirada da grossura dela (`ESPESSURA_DA_LAJE`, que o perfil da 3/4 usa) e os dois blocos são colunas, com o vão
 * escuro entre eles. A frente é o lado de baixo. Material: `pedra`; o ferro e a mancha são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { capsula, caixa, elipse, elipseGirada, menos, poligono, uniao, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, PREGO, type MontarMovel } from './contexto'

/** Altura da laje (do chão ao alto) em casas e a grossura dela (px do protótipo): a beirada na 3/4. */
const ALTURA = 0.5
export const ESPESSURA_DA_LAJE = 0.13 * G
/** Os blocos: quanto recuam da ponta e da beira comprida da laje, e o comprimento de cada um (px). */
const BLOCO = { daPonta: 6, daBeira: 5.5, comprimento: 19 } as const
/** A calha: quanto fica para dentro da beira e a largura (px). */
const CALHA = { dentro: 4.2, largura: 2.7 } as const
/** O lavrado irregular da beira: quanto cada ponto do contorno entra (px). */
const IRREGULAR = 1.3
/** A mancha velha: o castanho quase preto, meio transparente; seca, sem brilho. */
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x2c, 0x27] }
const FORCA_DA_MANCHA = 0.5
/**
 * O escuro em que o pixel escuro demais é levantado: o cinza quente da pedra (o mesmo do altar e do pilar). Com o
 * escuro de sempre (a nogueira), a beira da pedra na sombra saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarLajeDeSacrificio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zTopo = g * ALTURA
  const zBloco = zTopo - ESPESSURA_DA_LAJE

  // Os BLOCOS: duas colunas de pedra debaixo das pontas (de cima a laje os cobre; a 3/4 mostra a frente deles).
  const [lx0, ly0, lx1, ly1] = [-hw + 1.2, -hh + 2.4, hw - 1.2, hh - 2.4]
  for (const lado of [-1, 1]) {
    const xa = lado < 0 ? lx0 + BLOCO.daPonta : lx1 - BLOCO.daPonta - BLOCO.comprimento
    const bloco = caixa(xa, ly0 + BLOCO.daBeira, xa + BLOCO.comprimento, ly1 - BLOCO.daBeira, 1.4)
    cena.sombras.push({ forma: bloco, z: zBloco }, contato(bloco, 0.32))
    L.push(P(bloco, pedra, { tabua: 0, bisel: 1.2, tom: 0.8, contorno: 0.26, semente: 5201 + lado }))
  }

  // A LAJE: o contorno lavrado (os pontos entram um pouco, sorteados), a sombra solta e a pedra.
  const contornoDaLaje: Ponto[] = []
  const cantos: readonly Ponto[] = [[lx0, ly0], [lx1, ly0], [lx1, ly1], [lx0, ly1]]
  cantos.forEach(([ax, ay], i) => {
    const [bx, by] = cantos[(i + 1) % 4]
    const passos = Math.abs(bx - ax) > Math.abs(by - ay) ? 7 : 3
    for (let k = 0; k < passos; k += 1) {
      const t = k / passos
      const entra = k === 0 ? 1.4 : IRREGULAR * hash(i, k, 5210)
      // Entra para dentro da laje: a normal da beira aponta para fora, então o ponto anda para o meio.
      const [mx, my] = [ax + (bx - ax) * t, ay + (by - ay) * t]
      contornoDaLaje.push([mx - Math.sign(mx) * (Math.abs(by - ay) > 0 ? entra : 0) * (k === 0 ? 0.7 : 1), my - Math.sign(my) * (Math.abs(bx - ax) > 0 ? entra : 0) * (k === 0 ? 0.7 : 1)])
    }
  })
  const laje = poligono(contornoDaLaje)
  cena.sombras.push({ forma: laje, z: zTopo, solta: true, forca: 0.32 })
  L.push(P(laje, pedra, { tabua: 0, bisel: 2.2, tom: 1, contorno: 0.3, semente: 5220 }))

  // A CALHA cavada em volta e a BICA no canto da frente à direita (o rego que leva até a beira).
  const [cx0, cy0, cx1, cy1] = [lx0 + CALHA.dentro, ly0 + CALHA.dentro, lx1 - CALHA.dentro, ly1 - CALHA.dentro]
  const w2 = CALHA.largura
  const calha = menos(caixa(cx0, cy0, cx1, cy1, 2.4), caixa(cx0 + w2, cy0 + w2, cx1 - w2, cy1 - w2, 1.4))
  const cavado = { tabua: 0, bisel: 0.5, contorno: 0.06, recesso: { k: 1.4, forca: 0.42 }, semente: 5230 }
  L.push(P(calha, pedra, { ...cavado, tom: 0.8 }))
  L.push(P(capsula(cx1 - w2 / 2, cy1 - w2 / 2, lx1 - 2.4, ly1 - 2.4, w2 * 0.5), pedra, { ...cavado, tom: 0.7, semente: 5231 }))

  // A MANCHA no meio: três manchas que se juntam, de beira macia, e o fio que escorreu até a calha da frente.
  const mx = -hw * 0.08
  const forma = uniao(uniao(elipseGirada(mx, 0, 13, 7.5, 0.2), elipseGirada(mx + 9, 2.5, 7, 4.6, -0.5)), elipse(mx - 8, -2.4, 5.4, 4))
  const mancha = { tabua: 0, bisel: 0, contorno: 0, alfa: FORCA_DA_MANCHA, suave: 1.6, semente: 5240 }
  L.push(P(forma, MANCHA, mancha))
  L.push(P(elipse(mx + 2, 0.6, 7, 3.6), MANCHA, { ...mancha, alfa: FORCA_DA_MANCHA * 0.6, semente: 5241 }))
  const fio: Ponto[] = [[mx + 12, 4], [mx + 15, 7.5], [mx + 16.5, cy1 - w2]]
  for (let k = 1; k < fio.length; k += 1) {
    L.push(P(capsula(fio[k - 1][0], fio[k - 1][1], fio[k][0], fio[k][1], 0.75), MANCHA, { ...mancha, alfa: FORCA_DA_MANCHA * 0.8, suave: 0.6, semente: 5242 + k }))
  }
  // Um respingo velho perto da calha de trás.
  L.push(P(elipse(mx - 20, -7.2, 1.6, 1.2), MANCHA, { ...mancha, alfa: FORCA_DA_MANCHA * 0.7, suave: 0.8, semente: 5245 }))

  // As ARGOLAS de ferro nas pontas, deitadas, com o grampo cravado na pedra.
  for (const lado of [-1, 1]) {
    const x = lado * (hw - 8.4)
    L.push(P(elipse(x - lado * 1.6, 0, 1.3, 1.6), PREGO, { tabua: 0, bisel: 0.9, tom: 0.8, contorno: 0.28, semente: 5250 + lado }))
    L.push(P(menos(elipse(x + lado * 1.6, 0, 3.1, 3.1), elipse(x + lado * 1.6, 0, 1.9, 1.9)), PREGO, { tabua: 0, bisel: 0.6, tom: 1, contorno: 0.3, semente: 5253 + lado, projeta: { dist: 0.8, forca: 0.3 } }))
  }
}
