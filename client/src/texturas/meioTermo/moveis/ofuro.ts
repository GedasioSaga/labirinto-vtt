/**
 * OFURÔ de cima com volume (lote L12 dos objetos novos, 14/11/2026, "Descanso e brincadeira": "tina de banho
 * quente com vapor"): a tina de banho japonesa, QUADRADA e funda, de tábuas grossas de madeira clara, encaixadas
 * nos cantos (o topo da tábua da frente e da de trás aparece com os anéis), cheia de água quente. Metade da boca
 * está tapada pela TAMPA de três tábuas com as duas travessas; na parte aberta se vê a água, o BANCO afundado
 * junto à parede da frente e o VAPOR pintado (a névoa e três fios que sobem e passam por cima da tampa). Em cima
 * da tampa descansa a CONCHA de cabo comprido. A tina fica num canto do ESTRADO de ripas, e no estrado, do lado
 * da frente, estão o BALDE de aduelas com o aro de cobre e o BANQUINHO com a toalha dobrada.
 *
 * O que o separa da tina de madeira (`tinaDeMadeira.ts`): a tina é redonda, baixa, de aduelas e aros de ferro,
 * solta no chão; o ofurô é quadrado, mais alto, sem aros, com a tampa de tábuas, e vem com o estrado, o balde e o
 * banquinho. A 25% de zoom sobram o quadrado claro de madeira com a tampa de listras e a água no meio, e as ripas
 * em volta: é o que diz banho, e não caixa ou cocho.
 *
 * Fogo nenhum: o calor é só o vapor pintado. Na 3/4 (`tresQuartos.ts`, derivado): a TINA é uma coluna da altura da
 * borda (a frente que a 3/4 varre são as tábuas deitadas da parede), o BALDE e o BANQUINHO são colunas baixas, e o
 * ESTRADO não sobe (não tem estrutura: fica no chão, por baixo de tudo, como um tapete de ripas). A tampa, a concha
 * e o vapor estão dentro da tina e sobem com ela.
 *
 * Material: `madeira` (a tina, o estrado, a tampa, o balde, o banquinho). A água, o vapor, o cobre e a toalha são
 * fixos. A tina é do tamanho do menor lado (o estrado estica com a pegada).
 */
import { limitar01, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, capsula, elipse, anel, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, LENCOL, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** O desenho foi medido em 1,5 casa (42 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_PEGADA = 0.75 * G
const GRAUS = Math.PI / 180

/** Alturas em casas: a borda da tina, a do balde e a do banquinho. */
const ALTURA_DA_TINA = 0.56
const ALTURA_DO_BALDE = 0.28
const ALTURA_DO_BANQUINHO = 0.22

/** A tina: o lado (fração do menor meio lado, x 2) e a folga até o canto. Px de partida: a tábua da borda e a água. */
const LADO_DA_TINA = 0.73
const FOLGA = 0.03
const TABUA_DA_BORDA = 4.6
const DA_PAREDE_A_AGUA = 1.3
/** A tampa cobre a parte de trás da boca: quantas tábuas, a largura (fração do lado de dentro) e a fresta (px). */
const TABUAS_DA_TAMPA = 3
const TABUA_DA_TAMPA = 0.135
const FRESTA_DA_TAMPA = 0.7

/** O estrado: a ripa e a fresta entre elas (px de partida). */
const RIPA = 6.2
const FRESTA_DO_ESTRADO = 1.7

/** O balde e o banquinho: o raio do balde e as meias medidas do banquinho (frações do menor meio lado). */
const RAIO_DO_BALDE = 0.2
const MEIO_BANQUINHO: readonly [number, number] = [0.17, 0.11]

const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 1.02)) }
const AGUA_RASA: Rgb = [0x86, 0xa8, 0xa2]
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xe1, 0xdc] }
const VAPOR: MaterialDaPeca = { classe: 'liso', rgb: [0xf4, 0xf2, 0xea] }

/** Para o lado da luz, no chão: a borda desse lado faz sombra na água. */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
const SOMBRA_DA_BORDA = 3.6

/** A água funda: a sombra da borda do lado da luz, a beira mais clara junto da parede e a marola. */
function texDaAgua(agua: Forma, k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const naSombra = limitar01(0.5 + agua.d(x + PARA_A_LUZ_X * SOMBRA_DA_BORDA * k, y + PARA_A_LUZ_Y * SOMBRA_DA_BORDA * k) / (2 * k))
    const rasa = limitar01(1 + agua.d(x, y) / (3.5 * k))
    const t = rasa * rasa * 0.4
    s[0] += (AGUA_RASA[0] - s[0]) * t
    s[1] += (AGUA_RASA[1] - s[1]) * t
    s[2] += (AGUA_RASA[2] - s[2]) * t
    const xs = x / k
    const ys = y / k
    s[3] += ruido(xs * 0.12 + p.su, ys * 0.12) * 0.09 + ruido(xs * 0.4, ys * 0.4 + p.sv) * 0.03 - 0.32 * naSombra
  }
}

/** O fio de vapor some nas duas pontas. */
function texDoFio(x0: number, y0: number, dx: number, dy: number, comprimento: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[5] = Math.sin(limitar01(((x - x0) * dx + (y - y0) * dy) / comprimento) * Math.PI)
  }
}

/** Os fios de vapor: o pé em frações da água aberta, o rumo (graus), o comprimento e a largura do S (px) e a fase. */
const FIOS: readonly (readonly [x: number, y: number, rumo: number, comprimento: number, largura: number, fase: number])[] = [
  [-0.5, 0.2, -72, 26, 3, 0.4],
  [0.05, 0.4, -84, 31, 3.4, 2.3],
  [0.52, 0.1, -66, 23, 2.6, 4.2],
]
const PASSOS_DO_FIO = 12

export const montarOfuro: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const menor = Math.min(hw, hh)
  const k = menor / MEIA_PEGADA

  // O ESTRADO de ripas deitadas, rente ao chão, por baixo de tudo e sem estrutura.
  const estrado = caixa(-hw, -hh, hw, hh, 0.6 * k)
  cena.sombras.push(contato(estrado, 0.2))
  const passo = (RIPA + FRESTA_DO_ESTRADO) * k
  const ripas = Math.max(1, Math.floor((2 * hh + FRESTA_DO_ESTRADO * k) / passo))
  const sobra = (2 * hh - ripas * passo + FRESTA_DO_ESTRADO * k) / 2
  for (let i = 0; i < ripas; i += 1) {
    const y = -hh + sobra + i * passo
    L.push(P(caixa(-hw, y, hw, y + RIPA * k, 0.5 * k), mad, { eixo: 0, tabua: 0, bisel: 0.8 * k, tom: 0.9 + 0.06 * Math.sin(i * 2.3), contorno: 0.26, semente: 7600 + i }))
  }

  // A TINA no canto de trás à esquerda: a coluna da altura da borda.
  const lado = 2 * menor * LADO_DA_TINA
  const x0 = -hw + menor * FOLGA
  const y0 = -hh + menor * FOLGA
  const x1 = x0 + lado
  const y1 = y0 + lado
  const corpo = caixa(x0, y0, x1, y1, 1.2 * k)
  cena.sombras.push({ forma: corpo, z: g * ALTURA_DA_TINA }, contato(corpo, 0.34))
  L.push(P(corpo, mad, { eixo: 0, tabua: 0, bisel: 1 * k, tom: 0.8, contorno: 0.26, semente: 7620 }))

  // A BORDA: a tábua de trás e a da frente inteiras (o topo delas, com os anéis, aparece nos cantos) e as dos lados entre elas.
  const W = TABUA_DA_BORDA * k
  L.push(P(caixa(x0 + W, y0, x1 - W, y0 + W, 0.3 * k), mad, { eixo: 0, tabua: 0, bisel: 1.5 * k, tom: 1, contorno: 0.32, semente: 7621 }))
  L.push(P(caixa(x0 + W, y1 - W, x1 - W, y1, 0.3 * k), mad, { eixo: 0, tabua: 0, bisel: 1.5 * k, tom: 1, contorno: 0.32, semente: 7622 }))
  L.push(P(caixa(x0, y0 + W, x0 + W, y1 - W, 0.3 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 1.5 * k, tom: 0.93, contorno: 0.32, semente: 7623 }))
  L.push(P(caixa(x1 - W, y0 + W, x1, y1 - W, 0.3 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 1.5 * k, tom: 0.93, contorno: 0.32, semente: 7624 }))
  const cantos: readonly Ponto[] = [[x0, y0], [x1 - W, y0], [x0, y1 - W], [x1 - W, y1 - W]]
  cantos.forEach(([cx, cy], i) => {
    // O topo da tábua: os anéis em volta do miolo, que fica fora do canto (a tábua foi tirada de lado do tronco).
    const miolo = { cx: cx + (i % 2 === 0 ? -W * 1.6 : W * 2.6), cy: cy + W * 0.5, r: W }
    L.push(P(caixa(cx, cy, cx + W, cy + W, 0.4 * k), mad, { polar: miolo, tabua: 1.3 * k, bisel: 0.9 * k, tom: 0.84, contorno: 0.28, semente: 7625 + i }))
  })

  // Por dentro: a parede na sombra da borda, o banco afundado junto à parede da frente e a água.
  const ix0 = x0 + W
  const iy0 = y0 + W
  const ix1 = x1 - W
  const iy1 = y1 - W
  L.push(P(caixa(ix0, iy0, ix1, iy1, 0.4 * k), mad, { eixo: 0, tabua: 0, bisel: 0, tom: 0.5, contorno: 0.2, recesso: { k: 3.6 * k, forca: 0.5 }, semente: 7630 }))
  const ladoDeDentro = ix1 - ix0
  const da = DA_PAREDE_A_AGUA * k
  L.push(P(caixa(ix0 + da, iy1 - ladoDeDentro * 0.24, ix1 - da, iy1 - da, 0.5 * k), mad, { eixo: 0, tabua: 0, bisel: 0.8 * k, tom: 0.78, contorno: 0.2, semente: 7631 }))
  const agua = caixa(ix0 + da, iy0 + da, ix1 - da, iy1 - da, 0.6 * k)
  L.push(P(agua, AGUA, { bisel: 0, contorno: 0.14, alfa: 0.84, tom: 0.92, textura: texDaAgua(agua, k), semente: 7632 }))
  const meioX = (ix0 + ix1) / 2
  L.push(P(elipse(meioX + ladoDeDentro * 0.12, iy1 - ladoDeDentro * 0.34, ladoDeDentro * 0.2, 0.8 * k), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1 * k, semente: 7633 }))

  // A TAMPA: as tábuas deitadas por cima da borda de trás, as duas travessas e a concha descansando nela.
  const tabua = ladoDeDentro * TABUA_DA_TAMPA
  const fresta = FRESTA_DA_TAMPA * k
  const sombraDaTampa = { dist: 2.4 * k, forca: 0.34, suave: 1 * k }
  for (let i = 0; i < TABUAS_DA_TAMPA; i += 1) {
    const ya = iy0 - W * 0.45 + i * (tabua + fresta)
    // A última tábua foi puxada um pouco: é a que se abre para entrar.
    const puxada = i === TABUAS_DA_TAMPA - 1 ? 1.6 * k : 0
    L.push(P(caixa(x0 + 0.5 * k + puxada, ya + puxada * 0.4, x1 - 0.5 * k + puxada, ya + tabua + puxada * 0.4, 0.5 * k), mad, { eixo: 0, tabua: 0, bisel: 0.9 * k, tom: 1.1 - i * 0.04, contorno: 0.26, semente: 7640 + i, projeta: sombraDaTampa }))
  }
  const fimDaTampa = iy0 - W * 0.45 + TABUAS_DA_TAMPA * (tabua + fresta) - fresta
  for (const [i, fx] of [0.24, 0.76].entries()) {
    const tx = x0 + lado * fx
    L.push(P(caixa(tx - 1.5 * k, iy0 - W * 0.2, tx + 1.5 * k, fimDaTampa - 0.6 * k, 0.4 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8 * k, tom: 0.88, contorno: 0.28, semente: 7650 + i, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  }
  const conchaX = x0 + lado * 0.6
  const conchaY = (iy0 + fimDaTampa) / 2 + 0.5 * k
  const caboFim: Ponto = [x0 + lado * 0.12, conchaY + 1.8 * k]
  L.push(P(capsula(conchaX - 2.4 * k, conchaY + 0.3 * k, caboFim[0], caboFim[1], 0.85 * k), mad, { eixo: 0, tabua: 0, bisel: 0.85 * k, tom: 0.62, contorno: 0.34, semente: 7655, projeta: { dist: 1.4 * k, forca: 0.36 } }))
  L.push(P(elipse(conchaX, conchaY, 3 * k, 3 * k), mad, { polar: { cx: conchaX, cy: conchaY, r: 3 * k }, tabua: 1.2 * k, bisel: 1 * k, tom: 0.66, contorno: 0.34, semente: 7656, projeta: { dist: 1.8 * k, forca: 0.36 } }))
  L.push(P(elipse(conchaX, conchaY, 2.1 * k, 2.1 * k), mad, { bisel: 0, tom: 0.5, contorno: 0.1, recesso: { k: 1.2 * k, forca: 0.4 }, semente: 7657 }))

  // O BALDE de aduelas no canto da frente à direita, com o aro de cobre e a água.
  const rb = menor * RAIO_DO_BALDE
  const bx = hw - rb - menor * 0.05
  const by = hh - rb - menor * 0.06
  const balde = elipse(bx, by, rb, rb)
  cena.sombras.push({ forma: balde, z: g * ALTURA_DO_BALDE }, contato(balde, 0.32))
  const polarDoBalde = { cx: bx, cy: by, r: rb }
  L.push(P(balde, mad, { polar: polarDoBalde, tabua: (2 * Math.PI * rb) / 16, bisel: rb * 0.12, tom: 0.92, semente: 7660 }))
  L.push(P(anel(bx, by, rb * 0.99, rb * 0.99, rb * 0.88, rb * 0.88), materialDaPeca('latao'), { bisel: 0.6 * k, tom: 0.86, contorno: 0.3, metal: 0.5, semente: 7661 }))
  L.push(P(elipse(bx, by, rb * 0.76, rb * 0.76), mad, { polar: polarDoBalde, tabua: (2 * Math.PI * rb) / 16, bisel: 0, tom: 0.6, recesso: { k: 1.8 * k, forca: 0.4 }, semente: 7660 }))
  const aguaDoBalde = elipse(bx, by, rb * 0.68, rb * 0.68)
  L.push(P(aguaDoBalde, AGUA, { bisel: 0, contorno: 0.12, textura: texDaAgua(aguaDoBalde, k * 0.6), semente: 7662 }))

  // O BANQUINHO na frente da tina, com a toalha dobrada em cima.
  const qx = x0 + lado * 0.42
  const qy = hh - menor * MEIO_BANQUINHO[1] - menor * 0.07
  const mbx = menor * MEIO_BANQUINHO[0]
  const mby = menor * MEIO_BANQUINHO[1]
  const assento = caixa(qx - mbx, qy - mby, qx + mbx, qy + mby, 0.8 * k)
  cena.sombras.push({ forma: assento, z: g * ALTURA_DO_BANQUINHO }, contato(assento, 0.32))
  L.push(P(assento, mad, { eixo: QUARTO, tabua: (2 * mbx) / 3, bisel: 0.9 * k, tom: 0.96, contorno: 0.26, semente: 7670 }))
  L.push(P(caixa(qx - mbx * 0.62, qy - mby * 0.7, qx + mbx * 0.3, qy + mby * 0.8, 0.6 * k), LENCOL, { eixo: 0.1, bisel: 0.9 * k, ruga: 0.4, contorno: 0.26, semente: 7671, projeta: { dist: 1 * k, forca: 0.3 } }))
  L.push(P(caixa(qx - mbx * 0.62, qy - mby * 0.7, qx + mbx * 0.3, qy - mby * 0.1, 0.5 * k), LENCOL, { eixo: 0.1, bisel: 0.8 * k, tom: 1.05, ruga: 0.4, contorno: 0.2, semente: 7672, projeta: { dist: 0.7 * k, forca: 0.24 } }))

  // O VAPOR por cima de tudo na tina: a névoa na água aberta e os três fios que sobem por cima da tampa.
  const meioDaAguaY = (fimDaTampa + iy1) / 2
  const meiaAberta = (iy1 - fimDaTampa) / 2
  L.push(P(elipse(meioX, meioDaAguaY - meiaAberta * 0.2, ladoDeDentro * 0.42, meiaAberta * 1.1), VAPOR, { bisel: 0, contorno: 0, alfa: 0.14, suave: 7 * k, semente: 7680 }))
  FIOS.forEach(([fx, fy, rumo, comprimento, largura, fase], i) => {
    const px = meioX + fx * ladoDeDentro * 0.5
    const py = meioDaAguaY + fy * meiaAberta
    const dx = Math.cos(rumo * GRAUS)
    const dy = Math.sin(rumo * GRAUS)
    const fio: Ponto[] = []
    for (let j = 0; j <= PASSOS_DO_FIO; j += 1) {
      const t = j / PASSOS_DO_FIO
      const ao = t * comprimento * k
      const desvio = Math.sin(t * Math.PI * 2 + fase) * largura * k
      fio.push([px + dx * ao - dy * desvio, py + dy * ao + dx * desvio])
    }
    L.push(P(cadeia(fio, 1.4 * k), VAPOR, { bisel: 0, contorno: 0, alfa: 0.42, suave: 2 * k, textura: texDoFio(px, py, dx, dy, comprimento * k), semente: 7681 + i }))
  })
}
