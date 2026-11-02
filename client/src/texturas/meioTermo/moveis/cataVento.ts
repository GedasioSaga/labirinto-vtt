/**
 * OS OBJETOS DE VENTO de cima com volume (02/11/2026): só a BASE de cada um.
 * As pás (a roda de muitas pás e o leme, as 4 velas, o papel colorido) ficam
 * em pé na tela e giram na camada animada (`pixi/pasDoVento.ts`); a imagem é a
 * mesma girando ou parado.
 *
 * - CATA-VENTO DE FAZENDA: os quatro pés da torre de madeira abrindo para os
 *   cantos, as travessas em X entre eles e a plataforma no meio, com a haste
 *   da bomba de ferro. A torre é alta: a sombra dela cai comprida no chão.
 * - MOINHO DE VENTO: a torre redonda de pedra vista de cima, o telhado em cone
 *   de tábuas (gomos em volta do pino do alto) e a soleira da porta embaixo.
 * - CATA-VENTO DE BRINQUEDO: o palito fincado no chão e a sombra miúda do
 *   papel; o resto é a camada animada.
 *
 * Materiais: a madeira da torre (fazenda); a pedra das paredes e a madeira do
 * telhado (moinho). O brinquedo não tem escolha (o papel tem cor própria).
 */
import { barra, caixa, elipse, poligono, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'

/** Alturas em casas (a sombra no chão): a torre da fazenda, o moinho e o palito. */
const ALTURA_DA_TORRE = 1.6
const ALTURA_DO_MOINHO = 2.2
const ALTURA_DO_PALITO = 0.9
const FERRO: MaterialDaPeca = materialDaPeca('ferro')
const PALITO: MaterialDaPeca = materialDaPeca('pinho')

/** 0..1 fixo por peça: o tom de cada gomo do telhado. */
function tomFixo(i: number): number {
  const s = Math.sin(i * 12.9898 + 7.31) * 43758.5453
  return s - Math.floor(s)
}

export const montarCataVento: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const menor = Math.min(hw, hh)
  const k = menor / 28
  const madeira = c.m.madeira
  // Os pés saem dos cantos e sobem para o meio (de cima, convergem para a plataforma).
  const pe = 0.84
  const topo = 0.2
  const cantos: Ponto[] = [[-hw * pe, -hh * pe], [hw * pe, -hh * pe], [hw * pe, hh * pe], [-hw * pe, hh * pe]]
  const alto: Ponto[] = [[-menor * topo, -menor * topo], [menor * topo, -menor * topo], [menor * topo, menor * topo], [-menor * topo, menor * topo]]
  const largura = 3.2 * k
  const pes = cantos.map(([x, y], i) => barra(x, y, alto[i][0], alto[i][1], largura))
  // A sombra comprida da torre: a pirâmide de pés, alta.
  for (const forma of pes) cena.sombras.push({ forma, z: g * ALTURA_DA_TORRE * 0.6 })
  cena.sombras.push(contato(caixa(-hw * pe, -hh * pe, hw * pe, hh * pe), 0.12))
  const L = cena.partes
  // As travessas em X entre os pés vizinhos, a meia altura (de cima, um losango por dentro dos pés).
  const meio = (a: Ponto, b: Ponto): Ponto => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  for (let i = 0; i < 4; i += 1) {
    const a = cantos[i]
    const b = cantos[(i + 1) % 4]
    const am = meio(a, alto[i])
    const bm = meio(b, alto[(i + 1) % 4])
    L.push(P(barra(a[0], a[1], bm[0], bm[1], 1.7 * k), madeira, { tabua: 0, bisel: 0.6 * k, tom: 0.84, contorno: 0.22, semente: 800 + i }))
    L.push(P(barra(b[0], b[1], am[0], am[1], 1.7 * k), madeira, { tabua: 0, bisel: 0.6 * k, tom: 0.88, contorno: 0.22, semente: 810 + i }))
  }
  // Os quatro pés, por cima das travessas, com a sapata de pedra no chão.
  pes.forEach((forma, i) => {
    L.push(P(elipse(cantos[i][0], cantos[i][1], 2.6 * k, 2.6 * k), materialDaPeca('granito'), { tabua: 0, bisel: 0.8 * k, tom: 0.92, contorno: 0.24, semente: 820 + i }))
    L.push(P(forma, madeira, { tabua: 0, bisel: 1 * k, tom: 1, contorno: 0.26, semente: 830 + i, projeta: { dist: 1.6 * k, forca: 0.24 } }))
  })
  // A plataforma no alto da torre e a haste da bomba no meio.
  const p = menor * (topo + 0.06)
  L.push(P(caixa(-p, -p, p, p, 0.8 * k), madeira, { tabua: 2.6 * k, bisel: 1 * k, tom: 1.04, contorno: 0.26, semente: 840, projeta: { dist: 3.2 * k, forca: 0.3 } }))
  L.push(P(elipse(0, 0, 2.2 * k, 2.2 * k), FERRO, { tabua: 0, bisel: 0.9 * k, tom: 0.9, contorno: 0.3, semente: 841, projeta: { dist: 1.2 * k, forca: 0.3 } }))
}

export const montarMoinho: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const telhado = c.m.madeira
  const k = Math.min(hw, hh) / 56
  const rx = hw * 0.9
  const ry = hh * 0.9
  const parede = elipse(0, 0, rx, ry)
  cena.sombras.push({ forma: parede, z: g * ALTURA_DO_MOINHO }, contato(parede, 0.32))
  const L = cena.partes
  // A soleira da porta, embaixo (a frente do moinho).
  L.push(P(caixa(-9 * k, ry - 6 * k, 9 * k, ry + 4.5 * k, 1.4 * k), pedra, { tabua: 0, bisel: 1.4 * k, tom: 0.9, contorno: 0.24, semente: 900 }))
  // A beira das paredes de pedra, que aparece em volta do beiral.
  L.push(P(parede, pedra, { tabua: 0, bisel: 3 * k, tom: 0.96, contorno: 0.26, semente: 901 }))
  // O telhado em cone: gomos de tábua do beiral até o pino, cada um no seu tom.
  const beiralX = rx * 0.88
  const beiralY = ry * 0.88
  const gomos = 16
  for (let i = 0; i < gomos; i += 1) {
    const a0 = (i / gomos) * 2 * Math.PI + 0.1
    const a1 = ((i + 1) / gomos) * 2 * Math.PI + 0.1
    const am = (a0 + a1) / 2
    const pontos: Ponto[] = [
      [Math.cos(am) * 1.2 * k, Math.sin(am) * 1.2 * k],
      [Math.cos(a0) * beiralX, Math.sin(a0) * beiralY],
      [Math.cos(am) * beiralX * 1.01, Math.sin(am) * beiralY * 1.01],
      [Math.cos(a1) * beiralX, Math.sin(a1) * beiralY],
    ]
    // A luz vem de cima à esquerda: os gomos desse lado mais claros, o resto no tom de cada tábua.
    const luz = 0.06 * Math.cos(am - (-3 * Math.PI) / 4)
    L.push(P(poligono(pontos), telhado, { tabua: 0, bisel: 1.2 * k, tom: 0.9 + luz + 0.1 * tomFixo(i), contorno: 0.24, eixo: am, semente: 910 + i, projeta: i === 0 ? { dist: 4 * k, forca: 0.28 } : undefined }))
  }
  // O pino do alto do telhado, onde o eixo das velas entra.
  L.push(P(elipse(0, 0, 6 * k, 6 * k), telhado, { tabua: 0, bisel: 2 * k, tom: 1.06, contorno: 0.28, semente: 930, projeta: { dist: 2.4 * k, forca: 0.3 } }))
  L.push(P(elipse(0, 0, 2.6 * k, 2.6 * k), FERRO, { tabua: 0, bisel: 1 * k, tom: 0.9, contorno: 0.3, semente: 931 }))
}

export const montarCataVentoBrinquedo: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const k = Math.min(hw, hh) / 14
  const palito = elipse(0, 0, 1.6 * k, 1.6 * k)
  cena.sombras.push({ forma: palito, z: g * ALTURA_DO_PALITO }, contato(elipse(0, 0, 2.4 * k, 2.4 * k), 0.3))
  // O palito visto de cima: a ponta redonda, com a terra mexida em volta de onde foi fincado.
  cena.partes.push(P(elipse(0, 0, 3.4 * k, 3 * k), materialDaPeca('nogueira'), { tabua: 0, bisel: 0, tom: 0.62, contorno: 0, alfa: 0.35, suave: 1.4 * k, semente: 950 }))
  cena.partes.push(P(palito, PALITO, { tabua: 0, bisel: 0.6 * k, tom: 1.02, contorno: 0.3, semente: 951 }))
}
