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
import { anel, barra, caixa, elipse, poligono, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { rgb } from '../../ruido'

/** Alturas em casas (a sombra no chão): a torre da fazenda, o moinho e o palito. */
const ALTURA_DA_TORRE = 1.6
const ALTURA_DO_MOINHO = 2.2
const ALTURA_DO_PALITO = 0.9
const FERRO: MaterialDaPeca = materialDaPeca('ferro')
const PALITO: MaterialDaPeca = materialDaPeca('pinho')

/** O moinho de torre: a torre branca é a mais alta do mapa; a varanda fica a ~0,9 casa do chão. */
const ALTURA_DA_TORRE_BRANCA = 2.6
const ALTURA_DA_VARANDA = 0.9
/** A cal da torre (branco quente, não branco puro), o azul da cúpula e das velas, o creme e o dourado. */
const CAL: MaterialDaPeca = { classe: 'liso', rgb: rgb('#e4ddcd') }
const AZUL_DA_TORRE: MaterialDaPeca = { classe: 'liso', rgb: rgb('#3f6e9f') }
const CREME: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d9c48f') }
const DOURADO: MaterialDaPeca = { classe: 'metal', rgb: rgb('#c09a4e') }
/** A madeira escura da varanda: a nogueira do Meio-Termo, fixa. */
const MADEIRA_DA_VARANDA: MaterialDaPeca = materialDaPeca('nogueira')

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

/**
 * O MOINHO DE TORRE (03/11/2026, a forma "Torre"; `variante` 1): o moinho do
 * Mediterrâneo de cima, com um pouco de volume. De fora para dentro: a
 * varanda de tábuas escuras em anel, com o guarda-corpo e os pilares; a torre
 * branca de cal que afina para cima (o flanco do cone, mais claro do lado da
 * luz), com a faixa creme e a faixa azul na altura da varanda e as janelinhas
 * azuis; a cornija creme e a cúpula azul em gomos, com o pináculo dourado. As
 * 6 velas azuis giram na camada animada (`pixi/pasDoVento.ts`). Cores fixas,
 * contidas para o Meio-Termo: o mestre não escolhe material na Torre.
 */
function montarMoinhoTorre(c: Parameters<MontarMovel>[0], cena: Parameters<MontarMovel>[1]): void {
  const { hw, hh, g, peca: P } = c
  const k = Math.min(hw, hh) / 56
  const em = (f: number): [number, number] => [hw * f, hh * f]
  // A varanda é um anel estreito: a torre branca é o que lê de longe, como no moinho de verdade.
  const [vx, vy] = em(0.93)
  const [bx, by] = em(0.7)
  const [tx, ty] = em(0.38)
  const torre = elipse(0, 0, bx, by)
  cena.sombras.push({ forma: torre, z: g * ALTURA_DA_TORRE_BRANCA }, { forma: elipse(0, 0, vx, vy), z: g * ALTURA_DA_VARANDA, forca: 0.24, solta: true }, contato(elipse(0, 0, vx, vy), 0.22))
  const L = cena.partes
  // A VARANDA: as tábuas em raio, escuras, com fresta entre elas; o pé da torre por baixo, na sombra.
  L.push(P(anel(0, 0, vx, vy, bx * 0.96, by * 0.96), MADEIRA_DA_VARANDA, { tabua: 0, bisel: 0.6 * k, tom: 0.5, contorno: 0.22, semente: 960 }))
  const tabuas = 36
  for (let i = 0; i < tabuas; i += 1) {
    const a0 = (i / tabuas) * 2 * Math.PI + 0.012
    const a1 = ((i + 1) / tabuas) * 2 * Math.PI - 0.012
    const am = (a0 + a1) / 2
    const pontos: Ponto[] = [
      [Math.cos(a0) * bx * 0.97, Math.sin(a0) * by * 0.97],
      [Math.cos(a0) * vx * 0.99, Math.sin(a0) * vy * 0.99],
      [Math.cos(a1) * vx * 0.99, Math.sin(a1) * vy * 0.99],
      [Math.cos(a1) * bx * 0.97, Math.sin(a1) * by * 0.97],
    ]
    L.push(P(poligono(pontos), MADEIRA_DA_VARANDA, { tabua: 0, bisel: 0.8 * k, tom: 0.78 + 0.16 * tomFixo(i + 40), contorno: 0.22, eixo: am, semente: 961 + i }))
  }
  // O guarda-corpo em volta da varanda, mais alto que as tábuas, e os pilares por cima dele.
  L.push(P(anel(0, 0, vx, vy, vx - 3.2 * k, vy - 3.2 * k), MADEIRA_DA_VARANDA, { tabua: 0, bisel: 1 * k, tom: 0.92, contorno: 0.26, semente: 1000, projeta: { dist: 2.2 * k, forca: 0.3 } }))
  const pilares = 16
  for (let i = 0; i < pilares; i += 1) {
    const a = (i / pilares) * 2 * Math.PI + Math.PI / pilares
    const x = Math.cos(a) * (vx - 1.6 * k)
    const y = Math.sin(a) * (vy - 1.6 * k)
    L.push(P(caixa(x - 2.2 * k, y - 2.2 * k, x + 2.2 * k, y + 2.2 * k, 0.6 * k), MADEIRA_DA_VARANDA, { tabua: 0, bisel: 0.8 * k, tom: 1.04, contorno: 0.28, semente: 1010 + i, projeta: { dist: 1.8 * k, forca: 0.3 } }))
  }
  // A TORRE de cal, o flanco do cone de cima: mais clara do lado da luz (cima à esquerda), com um grão leve.
  const luzDoFlanco: Textura = (_u, _v, x, y, _p, s) => {
    const a = Math.atan2(y / by, x / bx)
    s[3] += 0.12 * Math.cos(a + (3 * Math.PI) / 4) + ruido(x * 0.4, y * 0.4) * 0.025
  }
  L.push(P(torre, CAL, { bisel: 1.2 * k, contorno: 0.24, textura: luzDoFlanco, semente: 1030, projeta: { dist: 3.2 * k, forca: 0.32 } }))
  // A faixa creme e a faixa azul na altura da varanda, no pé do flanco.
  L.push(P(anel(0, 0, bx * 0.97, by * 0.97, bx * 0.9, by * 0.9), CREME, { bisel: 0.5 * k, contorno: 0.16, semente: 1031 }))
  L.push(P(anel(0, 0, bx * 0.9, by * 0.9, bx * 0.84, by * 0.84), AZUL_DA_TORRE, { bisel: 0.5 * k, contorno: 0.16, semente: 1032 }))
  // As janelinhas azuis no flanco: de cima, a janela em pé na parede do cone fica deitada no raio.
  const janelas = [0.3, 1.25, 2.2, 3.4, 4.6, 5.5]
  janelas.forEach((a, i) => {
    // Entre a cornija (0,59 do pé da torre) e a faixa azul (0,84), um pouco mais larga embaixo.
    const canto = (r: number, meia: number): Ponto => [Math.cos(a + meia) * bx * r, Math.sin(a + meia) * by * r]
    L.push(P(poligono([canto(0.66, -0.06), canto(0.78, -0.075), canto(0.78, 0.075), canto(0.66, 0.06)]), AZUL_DA_TORRE, { bisel: 0.5 * k, tom: 0.8, contorno: 0.32, semente: 1040 + i }))
  })
  // A CORNIJA creme no alto da torre e a CÚPULA azul em gomos, com o pináculo dourado no meio.
  L.push(P(elipse(0, 0, tx * 1.08, ty * 1.08), CREME, { bisel: 1 * k, tom: 1, contorno: 0.26, semente: 1050, projeta: { dist: 2.6 * k, forca: 0.3 } }))
  const gomos = 12
  for (let i = 0; i < gomos; i += 1) {
    const a0 = (i / gomos) * 2 * Math.PI + 0.2
    const a1 = ((i + 1) / gomos) * 2 * Math.PI + 0.2
    const am = (a0 + a1) / 2
    const pontos: Ponto[] = [
      [0, 0],
      [Math.cos(a0) * tx, Math.sin(a0) * ty],
      [Math.cos(am) * tx * 1.01, Math.sin(am) * ty * 1.01],
      [Math.cos(a1) * tx, Math.sin(a1) * ty],
    ]
    const luz = 0.12 * Math.cos(am + (3 * Math.PI) / 4)
    L.push(P(poligono(pontos), AZUL_DA_TORRE, { bisel: 1.6 * k, tom: 1 + luz, contorno: 0.2, eixo: am, semente: 1060 + i, projeta: i === 0 ? { dist: 2.4 * k, forca: 0.26 } : undefined }))
  }
  L.push(P(elipse(0, 0, 4.2 * k, 4.2 * k), DOURADO, { bisel: 1.4 * k, contorno: 0.3, semente: 1080, projeta: { dist: 1.6 * k, forca: 0.3 } }))
}

export const montarMoinho: MontarMovel = (c, cena) => {
  // A forma Torre (03/11/2026) é a variante 1; o Clássico, o desenho de sempre (sem variante na chave).
  if (c.variante === 1) {
    montarMoinhoTorre(c, cena)
    return
  }
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
