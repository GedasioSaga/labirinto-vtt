/**
 * NICHO FUNERÁRIO (lote L05 de 24/11/2026, item 45, dos corredores da cripta do mapa 8; desenho próprio, só a ideia
 * do objeto): o LÓCULO de parede, a cova comprida aberta na pedra, deitada ao longo da parede, com a MOLDURA de pedra
 * de arco abatido e a SOLEIRA embaixo.
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`), como a lápide e a tapeçaria: de cima, um nicho de parede é
 * uma risca dentro da parede e não diz nada. O alto da moldura pega a luz numa faixa fina; a face da frente é mais
 * escura; a sombra sai do pé, para baixo à direita.
 *
 * Duas FORMAS (`lib/mobilia/nichoFunerario.ts`, gravadas em `Prop.mobiliaForma`, lidas na `variante`):
 * - FECHADO (o padrão): a LAJE inteira tapando o lóculo, com a placa do epitáfio gasto, a rosácea gravada no arco,
 *   as quatro ROSETAS de bronze dos cantos (com a pátina), uma trinca e o musgo no canto;
 * - ABERTO: a laje PARTIDA, o pedaço grande caído e encostado na frente, à esquerda (ainda com a placa e duas
 *   rosetas), e os cacos no chão; dentro, o escuro do lóculo com o CRÂNIO virado para fora, os OSSOS compridos no
 *   chão dele, as costelas e a TEIA no canto do arco.
 *
 * Materiais: `pedra`; o bronze, o osso, o fundo, a teia e o musgo são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { lerVarianteDoNichoFunerario } from '../../../lib/mobilia/nichoFunerario'
import { cadeia, capsula, caixa, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** A altura da moldura em casas (a sombra comprida) e quanto ela sobe acima da pegada (o teto do plano é 0,2). */
const ALTURA = 1.1
const SUBIDA = 0.18
/** A faixa do alto que pega a luz, a flecha do arco da moldura e a do arco do lóculo (px). */
const TOPO = 3.2
const ARCO = 8
const ARCO_DO_LOCULO = 6
/** O pé (px acima da beira de baixo da pegada), a soleira e a moldura em relevo em volta do lóculo (px). */
const PE = 2.4
const SOLEIRA = 8.2
const MOLDURA = 3.2
/** O lóculo dentro da moldura: a sobra dos lados e de cima (px). */
const LADO_DO_LOCULO = 15
/** O bronze das rosetas (o do sarcófago de bronze) e a pátina verde contida. */
const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: rgb('#8d6e47') }
const PATINA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#6b8a77') }
/** O osso: o marfim velho dos ossos e do crânio (`ossos.ts`). */
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xc6, 0xaa] }
/** O fundo do lóculo: o escuro frio da pedra, que o piso de luz segura. */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x36, 0x33] }
const TEIA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd2, 0xc8] }
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** As medidas da moldura na pegada, em px do protótipo. */
interface Moldura {
  readonly x: number
  readonly yPe: number
  readonly yLados: number
  readonly xLoculo: number
  readonly yLoculo: number
  readonly yFundoDoLoculo: number
}

function medidas(c: ContextoDoMovel): Moldura {
  const yPe = c.hh - PE
  const yAlto = -c.hh - SUBIDA * c.g
  const yLados = yAlto + TOPO + ARCO
  return { x: c.hw - 3, yPe, yLados, xLoculo: c.hw - LADO_DO_LOCULO, yLoculo: yLados + 6.5, yFundoDoLoculo: yPe - SOLEIRA - 0.8 }
}

/** O contorno da moldura (o retângulo com o arco abatido em cima), descido `dy` px e com o pé em `yPe`. */
function contornoDaMoldura(m: Moldura, dy: number, yPe: number): Forma {
  return uniao(caixa(-m.x, m.yLados + dy, m.x, yPe, 0.8), elipse(0, m.yLados + dy, m.x, ARCO))
}

/** O lóculo (o vão da moldura), encolhido `dentro` px para todos os lados. */
function loculo(m: Moldura, dentro: number): Forma {
  const x = m.xLoculo - dentro
  return uniao(caixa(-x, m.yLoculo, x, m.yFundoDoLoculo - dentro, 0.6), elipse(0, m.yLoculo, x, ARCO_DO_LOCULO - dentro))
}

/** A moldura de pedra, igual nas duas formas: a sombra, a faixa do alto, a face, a soleira. O lóculo vem por cima. */
function montarMoldura(c: ContextoDoMovel, cena: Cena, m: Moldura): void {
  const P = c.peca
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  cena.sombras.push({ forma: caixa(-m.x, m.yPe - 1.5, m.x, m.yPe, 0.6), z: c.g * ALTURA, forca: 0.3 }, contato(caixa(-m.x - 1.5, m.yPe - 1.2, m.x + 1.5, m.yPe + 1.2, 1), 0.32))
  L.push(P(contornoDaMoldura(m, -TOPO, m.yPe - TOPO), pedra, { tabua: 0, bisel: 1, tom: 1.08, semente: 4500 }))
  L.push(P(contornoDaMoldura(m, 0, m.yPe), pedra, { tabua: 0, bisel: 1.1, tom: 0.8, contorno: 0.3, semente: 4501 }))
  // As juntas dos blocos da face: duas fiadas de cada lado do lóculo.
  for (const lado of [-1, 1]) {
    for (const y of [m.yLoculo + 4, m.yLoculo + 18]) {
      L.push(P(caixa(lado > 0 ? m.xLoculo + MOLDURA + 0.6 : -m.x + 0.6, y - 0.35, lado > 0 ? m.x - 0.6 : -m.xLoculo - MOLDURA - 0.6, y + 0.35, 0.2), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.7, semente: 4502 }))
    }
  }
  // A SOLEIRA: o alto claro dela e a face, um pouco mais larga que a moldura.
  L.push(P(caixa(-m.x - 1.6, m.yPe - SOLEIRA, m.x + 1.6, m.yPe - SOLEIRA + 1.6, 0.5), pedra, { tabua: 0, bisel: 0.5, tom: 1.12, contorno: 0.24, semente: 4503 }))
  L.push(P(caixa(-m.x - 1.6, m.yPe - SOLEIRA + 1.6, m.x + 1.6, m.yPe, 0.5), pedra, { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.3, projeta: { dist: 0.8, forca: 0.24 }, semente: 4504 }))
}

/** A moldura em relevo em volta do lóculo, por cima do que está dentro dele (faz sombra para dentro). */
function montarMolduraDoLoculo(c: ContextoDoMovel, cena: Cena, m: Moldura): void {
  cena.partes.push(c.peca(menos(loculo(m, -MOLDURA), loculo(m, 0)), c.m.pedra, { tabua: 0, bisel: 1, tom: 0.98, contorno: 0.26, projeta: { dist: 1.2, forca: 0.32 }, semente: 4505 }))
}

/** Uma roseta de bronze: o botão, o furo e a pátina em volta. */
function roseta(c: ContextoDoMovel, cena: Cena, x: number, y: number, r: number, semente: number): void {
  const P = c.peca
  cena.partes.push(P(elipse(x + r * 0.3, y + r * 0.4, r * 1.25, r * 1.1), PATINA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.36, suave: r * 0.8, semente }))
  cena.partes.push(P(elipse(x, y, r, r), BRONZE, { tabua: 0, bisel: r * 0.6, tom: 1.08, contorno: 0.26, projeta: { dist: 0.6, forca: 0.26 }, semente: semente + 1 }))
  cena.partes.push(P(elipse(x, y, r * 0.32, r * 0.32), BRONZE, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0, semente: semente + 2 }))
}

/** O epitáfio gasto: as linhas em palavras rebaixadas, de comprimentos diferentes, algumas quase sumidas. */
function epitafio(c: ContextoDoMovel, cena: Cena, x0: number, x1: number, ys: readonly number[], semente: number): void {
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, recesso: { k: 0.6, forca: 0.3 } }
  ys.forEach((y, i) => {
    const meia = ((x1 - x0) / 2) * (i === 0 ? 0.6 : 0.82 + 0.18 * hash(i, 2, semente))
    const meio = (x0 + x1) / 2
    let x = meio - meia
    let p = 0
    while (x < meio + meia - 1.4) {
      const palavra = Math.min(meio + meia - x, 2.4 + 5.6 * hash(i, p, semente + 1))
      cena.partes.push(c.peca(caixa(x, y - 0.55, x + palavra, y + 0.55, 0.3), c.m.pedra, { ...gravada, alfa: hash(i, p, semente + 2) < 0.3 ? 0.35 : 0.85, semente: semente + 3 + i * 11 + p }))
      x += palavra + 1.6
      p += 1
    }
  })
}

export const montarNichoFunerarioFechado: MontarMovel = (c, cena) => {
  const m = medidas(c)
  const P = c.peca
  const pedra = c.m.pedra
  const L = cena.partes
  montarMoldura(c, cena, m)

  // O vão (a junta escura) e a LAJE dentro dele.
  L.push(P(loculo(m, 0), pedra, { tabua: 0, bisel: 0, tom: 0.46, contorno: 0.2, recesso: { k: 1.6, forca: 0.4 }, semente: 4510 }))
  const laje = loculo(m, 1.3)
  L.push(P(laje, pedra, { tabua: 0, bisel: 1.3, tom: 1, contorno: 0.28, semente: 4511 }))

  // A PLACA do epitáfio e a ROSÁCEA gravada no arco.
  const yMeio = (m.yLoculo + m.yFundoDoLoculo) / 2 + 1
  L.push(P(caixa(-17, yMeio - 8.4, 17, yMeio + 8, 0.8), pedra, { tabua: 0, bisel: 0.9, tom: 1.08, contorno: 0.22, projeta: { dist: 0.7, forca: 0.24 }, semente: 4512 }))
  epitafio(c, cena, -14, 14, [yMeio - 4.4, yMeio - 0.2, yMeio + 4], 4520)
  const yRosa = m.yLoculo - 1.6
  L.push(P(elipse(0, yRosa, 2.6, 2.6), pedra, { tabua: 0, bisel: 0.6, tom: 1.08, contorno: 0.2, semente: 4513 }))
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * 2 * Math.PI
    L.push(P(elipseGirada(Math.cos(a) * 2.9, yRosa + Math.sin(a) * 2.9, 1.5, 0.75, a), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, recesso: { k: 0.4, forca: 0.26 }, semente: 4514 + k }))
  }

  // As quatro ROSETAS de bronze nos cantos da laje.
  const xr = m.xLoculo - 5.6
  for (const [x, y] of [[-xr, m.yLoculo + 1.6], [xr, m.yLoculo + 1.6], [-xr, m.yFundoDoLoculo - 5.2], [xr, m.yFundoDoLoculo - 5.2]] as const) roseta(c, cena, x, y, 2.1, 4530)

  // A TRINCA da direita e o MUSGO no canto de baixo à esquerda e na soleira.
  const trinca: Ponto[] = [[xr + 4, m.yFundoDoLoculo - 2.4], [xr - 4.5, m.yFundoDoLoculo - 8], [xr - 2.6, m.yFundoDoLoculo - 13.4], [xr - 9.4, m.yFundoDoLoculo - 19]]
  L.push(P(dentroDe(cadeia(trinca, 0.34), laje), pedra, { tabua: 0, bisel: 0, tom: 0.44, contorno: 0, semente: 4540 }))
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9 }
  L.push(P(dentroDe(elipse(-m.xLoculo + 2, m.yFundoDoLoculo - 1.6, 5, 2.6), laje), MUSGO, { ...musgo, semente: 4541 }))
  montarMolduraDoLoculo(c, cena, m)
  L.push(P(elipse(-m.x + 6, m.yPe - SOLEIRA + 0.6, 6.4, 1.4), MUSGO, { ...musgo, alfa: 0.5, semente: 4542 }))

  // No pé, embaixo da trinca: o tufo de musgo e as duas lascas que caíram da laje.
  L.push(P(elipse(m.x - 12, m.yPe - 0.2, 8, 1.7), MUSGO, { ...musgo, alfa: 0.55, semente: 4543 }))
  const lascas: readonly (readonly Ponto[])[] = [
    [[m.x - 17, m.yPe + 0.2], [m.x - 14.4, m.yPe - 0.8], [m.x - 13.4, m.yPe + 1.2], [m.x - 16, m.yPe + 1.8]],
    [[m.x - 9.6, m.yPe + 0.6], [m.x - 8, m.yPe - 0.2], [m.x - 7.2, m.yPe + 1.4]],
  ]
  lascas.forEach((pontos, k) => L.push(P(poligono(pontos), pedra, { tabua: 0, bisel: 0.5, tom: 0.98 - k * 0.06, contorno: 0.3, semente: 4544 + k })))
}

/** Um osso comprido (a capsula com os dois nós de cada ponta), de (ax, ay) a (bx, by). */
function ossoComprido(ax: number, ay: number, bx: number, by: number, r: number): Forma {
  const ux = (bx - ax) / Math.hypot(bx - ax, by - ay)
  const uy = (by - ay) / Math.hypot(bx - ax, by - ay)
  const nos = (x: number, y: number): Forma => uniao(elipse(x - uy * r * 0.8, y + ux * r * 0.8, r * 1.25, r * 1.25), elipse(x + uy * r * 0.8, y - ux * r * 0.8, r * 1.25, r * 1.25))
  return uniao(capsula(ax, ay, bx, by, r), uniao(nos(ax, ay), nos(bx, by)))
}

export const montarNichoFunerarioAberto: MontarMovel = (c, cena) => {
  const m = medidas(c)
  const P = c.peca
  const pedra = c.m.pedra
  const L = cena.partes
  montarMoldura(c, cena, m)

  // O LÓCULO aberto: o fundo escuro e o chão dele, mais claro (visto um pouco de cima).
  const vao = loculo(m, 0)
  L.push(P(vao, FUNDO, { tabua: 0, bisel: 0, contorno: 0.2, recesso: { k: 3.2, forca: 0.5 }, semente: 4550 }))
  L.push(P(dentroDe(vao, caixa(-m.xLoculo, m.yFundoDoLoculo - 5.6, m.xLoculo, m.yFundoDoLoculo)), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.5, alfa: 0.75, suave: 1.6, semente: 4551 }))
  // As fiadas da parede do fundo, quase apagadas no escuro: duas juntas deitadas e as de pé, desencontradas.
  const junta = { tabua: 0, bisel: 0, contorno: 0, tom: 0.52, alfa: 0.4 }
  const fiadas = [m.yLoculo + 2.4, m.yLoculo + 11, m.yLoculo + 19.6]
  fiadas.forEach((y, k) => {
    L.push(P(dentroDe(caixa(-m.xLoculo, y - 0.35, m.xLoculo, y + 0.35), loculo(m, 2)), pedra, { ...junta, semente: 4557 + k }))
    for (let x = -m.xLoculo + 9 + (k % 2) * 7; x < m.xLoculo - 4; x += 14) {
      L.push(P(dentroDe(caixa(x - 0.35, y + 0.35, x + 0.35, y + 8.3), loculo(m, 2)), pedra, { ...junta, alfa: 0.3, semente: 4559 }))
    }
  })

  // A TEIA no canto do arco, à esquerda: os fios que saem do canto e os dois laços.
  const [tx, ty] = [-m.xLoculo + 0.6, m.yLoculo - 1]
  const teia = { tabua: 0, bisel: 0, contorno: 0, alfa: 0.42, semente: 4552 }
  for (const [dx, dy] of [[14, -2.4], [12.4, 4.2], [8.2, 9.6], [2.6, 12]] as const) L.push(P(cadeia([[tx, ty], [tx + dx, ty + dy]], 0.18), TEIA, teia))
  L.push(P(cadeia([[tx + 5.6, ty - 0.8], [tx + 5.2, ty + 2], [tx + 3.6, ty + 4.2], [tx + 1.2, ty + 5]], 0.16), TEIA, teia))
  L.push(P(cadeia([[tx + 10, ty - 1.6], [tx + 9.2, ty + 3.2], [tx + 6.2, ty + 7.2], [tx + 2, ty + 8.8]], 0.16), TEIA, { ...teia, alfa: 0.34 }))

  // Os OSSOS no chão do lóculo: dois compridos cruzados, as costelas e a sombra deles.
  const yChao = m.yFundoDoLoculo - 1.8
  L.push(P(elipse(4, yChao + 0.8, 26, 1.6), FUNDO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 1.2, semente: 4553 }))
  L.push(P(ossoComprido(-24, yChao - 0.4, 4, yChao - 2.2, 1.2), OSSO, { tabua: 0, bisel: 1, tom: 0.92, contorno: 0.3, semente: 4554 }))
  L.push(P(ossoComprido(-12, yChao + 0.2, 13, yChao - 0.8, 1.1), OSSO, { tabua: 0, bisel: 1, tom: 0.84, contorno: 0.3, semente: 4555 }))
  for (let k = 0; k < 4; k += 1) {
    const x = -2 + k * 3.6
    L.push(P(cadeia([[x - 3, yChao - 3.2], [x - 1.6, yChao - 6.4], [x + 0.6, yChao - 7.4], [x + 2.4, yChao - 6.2]], 0.55), OSSO, { tabua: 0, bisel: 0.4, tom: 0.82 + k * 0.03, contorno: 0.26, semente: 4556 + k }))
  }

  // O CRÂNIO virado para fora, à direita: a cúpula, as maçãs, as órbitas, o nariz e os dentes.
  const cx = m.xLoculo - 13
  const cy = yChao - 6
  L.push(P(elipse(cx + 2.4, yChao + 0.4, 7.6, 1.6), FUNDO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, suave: 1, semente: 4560 }))
  L.push(P(caixa(cx - 3.4, cy + 2.6, cx + 3.4, cy + 6.2, 1.4), OSSO, { tabua: 0, bisel: 0.9, tom: 0.86, contorno: 0.3, semente: 4561 }))
  L.push(P(elipse(cx, cy - 0.6, 6, 5.4), OSSO, { tabua: 0, bisel: 2.4, tom: 1, contorno: 0.3, semente: 4562 }))
  for (const lado of [-1, 1]) L.push(P(elipseGirada(cx + lado * 2.3, cy + 0.8, 1.6, 1.9, lado * 0.25), FUNDO, { tabua: 0, bisel: 0, contorno: 0.2, recesso: { k: 0.8, forca: 0.3 }, semente: 4563 }))
  L.push(P(poligono([[cx, cy + 2.2], [cx + 0.9, cy + 3.8], [cx - 0.9, cy + 3.8]]), FUNDO, { tabua: 0, bisel: 0, contorno: 0, semente: 4564 }))
  L.push(P(caixa(cx - 2.6, cy + 4.6, cx + 2.6, cy + 5.4, 0.3), FUNDO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8, semente: 4565 }))
  for (let k = -2; k <= 2; k += 1) L.push(P(caixa(cx + k * 1.05 - 0.2, cy + 4.6, cx + k * 1.05 + 0.2, cy + 5.8, 0), FUNDO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: 4566 }))

  montarMolduraDoLoculo(c, cena, m)

  // A LAJE PARTIDA caída e encostada na frente, à esquerda: a beira de cima clara, a face, o resto da placa, duas
  // rosetas e o contato no chão. A beira de cima de quebra é dentada.
  const quebra: Ponto[] = [[-m.x + 1, c.hh - 0.6], [-14, c.hh - 0.6], [-15.6, c.hh - 13], [-19.4, c.hh - 15.6], [-23.6, c.hh - 13.8], [-28.4, c.hh - 18.6], [-34, c.hh - 17.2], [-m.x + 3.6, c.hh - 20.2]]
  cena.sombras.push(contato(caixa(-m.x, c.hh - 2.4, -13, c.hh + 0.6, 1), 0.36))
  L.push(P(poligono(quebra.map(([x, y]): Ponto => [x - 0.6, y - 2.2])), pedra, { tabua: 0, bisel: 0.6, tom: 1.12, contorno: 0.24, semente: 4570 }))
  const lajeCaida = poligono(quebra)
  L.push(P(lajeCaida, pedra, { tabua: 0, bisel: 1.2, tom: 0.9, contorno: 0.3, projeta: { dist: 1.6, forca: 0.36 }, semente: 4571 }))
  L.push(P(dentroDe(caixa(-40, c.hh - 13.4, -22, c.hh - 4.6, 0.6), lajeCaida), pedra, { tabua: 0, bisel: 0.8, tom: 0.98, contorno: 0.2, projeta: { dist: 0.6, forca: 0.22 }, semente: 4572 }))
  epitafio(c, cena, -37, -24, [c.hh - 10.4, c.hh - 7.4], 4580)
  roseta(c, cena, -m.x + 7.4, c.hh - 15.4, 1.9, 4590)
  roseta(c, cena, -m.x + 7.4, c.hh - 4.6, 1.9, 4593)

  // Os CACOS no chão, à direita do pé.
  const cacos: readonly (readonly Ponto[])[] = [
    [[16, c.hh - 2.2], [20.4, c.hh - 3.2], [21.6, c.hh - 0.8], [17.4, c.hh - 0.2]],
    [[24.6, c.hh - 1.4], [27, c.hh - 2.6], [27.8, c.hh - 0.6]],
    [[-9.6, c.hh - 1.6], [-7.2, c.hh - 2.4], [-6.6, c.hh - 0.4], [-9, c.hh - 0.2]],
  ]
  cacos.forEach((pontos, k) => L.push(P(poligono(pontos), pedra, { tabua: 0, bisel: 0.5, tom: 0.96 - k * 0.05, contorno: 0.3, semente: 4596 + k })))
}

/** O nicho na forma gravada (a `variante`: 0 fechado, 1 aberto). */
export const montarNichoFunerario: MontarMovel = (c, cena) => {
  const montar = lerVarianteDoNichoFunerario(c.variante) === 'aberto' ? montarNichoFunerarioAberto : montarNichoFunerarioFechado
  montar(c, cena)
}
