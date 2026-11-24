/**
 * POÇO DE SANGUE de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; versão do `poco`, tipo
 * novo: o poço de sempre não muda). Só a BOCA redonda de pedra, sem esteio, sarilho nem balde: o anel de onze pedras
 * de alto pouco arredondado, cada uma do seu tom, da sua largura e da sua fundura (o anel de cunhas iguais lia como
 * engrenagem), e dentro dele o LÍQUIDO cor de vinho velho, grosso e PARADO: sem redemoinho, só umas nuvens lentas e
 * um ou dois anéis finos e mais escuros junto da pedra (o sangue coagulando na beira), com a sombra da borda do lado
 * da luz, um brilho fraco que vem do fundo (o miolo um pouco mais claro, que não pega a sombra), um reflexo apagado
 * e três bolhas presas na beira. As pedras estão manchadas por dentro, e por um lado o poço já TRANSBORDOU: dois
 * fios secos atravessam a borda, descem até o chão e acabam numa mancha escura.
 *
 * Sangue no tom do lote: vinho velho e apagado, nunca vermelho vivo. O brilho do desenho é fraco; se o mestre quiser
 * luz de verdade, é uma entrada em `LUZ_DOS_OBJETOS` (sugestão no registro do lote).
 *
 * Na 3/4 (DERIVADO) a boca é um tambor baixo de pedra (0,3 casa) com o líquido no alto; a mancha fica no chão.
 * Material: `pedra` (a borda; sugestão: granito), no tom da PEDRA ESCURA da arena (`PEDRA_ESCURA`). O líquido é
 * fixo. Medidas do menor meio lado (1,5 x 1,5 casa de partida, como o poço).
 */
import { hash } from '../../ruido'
import { capsula, elipse, elipseGirada } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { anelExato, bolha, comMeioEm, passo, PEDRA_ESCURA, setorDeAnel } from './fossoDeArena'

/** Os raios, em fração do menor meio lado: a beira de fora da borda e a boca. */
const RAIO_DE_FORA = 0.92
const RAIO_DA_BOCA = 0.6
/** A altura da borda (casas) e quantas pedras dão a volta. */
const ALTURA = 0.3
const PEDRAS = 11
/** As pedras: o quanto a largura de cada uma foge da média (para mais ou para menos) e o chanfro do alto (px no tamanho de partida). */
const LARGURA_VARIA = 0.35
const BISEL_DA_PEDRA = 1.8
/** O líquido parado: a força das nuvens lentas e os anéis coagulados junto da pedra, [raio (fração da boca), meia largura (px), escuro]. */
const NUVEM = 0.1
const COAGULADO: readonly (readonly [number, number, number])[] = [
  [0.9, 0.75, 0.16],
  [0.76, 0.6, 0.09],
]
/** O vinho velho do líquido, o miolo que brilha fraco, o seco que manchou a pedra e o reflexo apagado. */
const VINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x64, 0x34, 0x39] }
const BRILHO = [0x84, 0x4a, 0x4b] as const
const SECO = [0x5e, 0x34, 0x36] as const
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xa8, 0xa4] }
/** O escuro em que o pixel escuro demais é levantado: um vinho quase cinza, que serve à pedra e ao líquido. */
const ESCURO = [0x54, 0x36, 0x38] as const
/** Para onde o poço transbordou (rad; baixo à direita) e a meia largura dos dois fios (rad). */
const TRANSBORDO = 0.74
const FIOS: readonly (readonly [number, number])[] = [
  [-0.07, 0.046],
  [0.09, 0.029],
]
/** Quanto os fios secos e a mancha de dentro cobrem a pedra, no máximo. */
const ALFA_DO_SECO = 0.9
/** As bolhas presas na beira: [ângulo, distância (fração do raio da boca), raio (px)]. */
const BOLHAS: readonly (readonly [number, number, number])[] = [
  [2.2, 0.72, 1.5],
  [2.45, 0.8, 0.95],
  [5.1, 0.76, 1.1],
]

/**
 * O líquido, grosso e parado: nuvens lentas sem torção (a espiral lia como redemoinho ou portal), os anéis finos e
 * escuros do sangue que coagula junto da pedra (um nada tortos, e falhados aqui e ali) e o miolo que brilha fraco
 * (emissão: não pega a sombra da borda).
 */
function texDoLiquido(r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x, y) / r
    const volta = ruido((x / r) * 2.6 + 5.3, (y / r) * 2.6 + 1.7)
    let luz = volta * NUVEM + ruido(x * 0.24 + 3, y * 0.24) * 0.04 - 0.06 * passo(0.7, 1, rr)
    const a = Math.atan2(y, x)
    for (const [onde, meia, escuro] of COAGULADO) {
      const torto = onde + ruido(Math.cos(a) * 2.2 + onde * 31, Math.sin(a) * 2.2) * 0.035
      const falha = passo(-0.25, 0.1, ruido(Math.cos(a) * 1.4 + 9, Math.sin(a) * 1.4 + onde * 17))
      luz -= escuro * falha * passo(meia, meia * 0.3, Math.abs(rr - torto) * r)
    }
    s[3] += luz
    const miolo = Math.exp(-((rr / 0.58) ** 2)) * (0.85 + volta * 0.3)
    for (let k = 0; k < 3; k += 1) s[k] += (BRILHO[k] - s[k]) * miolo * 0.5
    s[4] = 0.42 * miolo
  }
}

export const montarPocoDeSangue: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const daPedra = texturaDaClasse(pedra.classe)
  const L = cena.partes
  const R = Math.min(hw, hh)
  const k = R / 42
  const rFora = R * RAIO_DE_FORA
  const rBoca = R * RAIO_DA_BOCA
  cena.corDoPiso = ESCURO
  cena.sombras.push({ forma: elipse(0, 0, rFora, rFora), z: g * ALTURA }, contato(elipse(0, 0, rFora, rFora), 0.32))

  // A MANCHA do transbordo, no chão (o meio da caixa fora da boca: fica no chão na 3/4).
  const [tx, ty] = [Math.cos(TRANSBORDO), Math.sin(TRANSBORDO)]
  const mancha = bolha(tx * rFora * 1.1, ty * rFora * 1.1, 7.5 * k, 5 * k, 6601, 0.2, TRANSBORDO + 0.5)
  L.push(P(mancha, { classe: 'liso', rgb: SECO }, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, suave: 1.1 * k, tom: 1.04, semente: 6602 }))
  L.push(P(bolha(tx * rFora * 1.34 + 2 * k, ty * rFora * 1.3 - 4 * k, 2 * k, 1.5 * k, 6603, 0.2), { classe: 'liso', rgb: SECO }, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, suave: 0.8 * k, semente: 6604 }))
  // Os dois fios secos chegam ao chão: saem de baixo da borda e vão até a mancha (o meio da caixa na mancha: ficam no chão na 3/4).
  for (const [i, [onde, meia]] of FIOS.entries()) {
    const [fx, fy] = [Math.cos(TRANSBORDO + onde), Math.sin(TRANSBORDO + onde)]
    const fio = capsula(fx * rFora * 0.94, fy * rFora * 0.94, fx * rFora * 1.07, fy * rFora * 1.07, meia * rFora * 0.9)
    L.push(P(comMeioEm(fio, tx * rFora * 1.1, ty * rFora * 1.1), { classe: 'liso', rgb: SECO }, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.75, suave: 0.5 * k, semente: 6605 + i }))
  }

  // O LEITO das juntas: o disco escuro debaixo das pedras (a maior peça da boca: dá a pedra à frente da 3/4).
  L.push(P(elipse(0, 0, rFora - 0.6 * k, rFora - 0.6 * k), pedra, { tabua: 0, bisel: 0.6, tom: 0.62 * PEDRA_ESCURA, contorno: 0.24, semente: 6610 }))

  // O LÍQUIDO, com a sombra da borda do lado da luz, o reflexo apagado e as bolhas.
  L.push(P(elipse(0, 0, rBoca + 0.8 * k, rBoca + 0.8 * k), VINHO, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 5.5 * k, forca: 0.5 }, textura: texDoLiquido(rBoca), semente: 6620 }))
  L.push(P(elipseGirada(rBoca * 0.3, rBoca * 0.42, rBoca * 0.34, rBoca * 0.09, -0.35), REFLEXO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.14, suave: 1.6 * k, semente: 6621 }))
  BOLHAS.forEach(([a, longe, raio], i) => {
    const [bx, by] = [Math.cos(a) * rBoca * longe, Math.sin(a) * rBoca * longe]
    L.push(P(anelExato(bx, by, raio * k * 0.55, raio * k), VINHO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.72, alfa: 0.7, semente: 6630 + i }))
    L.push(P(elipse(bx - raio * k * 0.3, by - raio * k * 0.3, raio * k * 0.36, raio * k * 0.36), REFLEXO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, semente: 6640 + i }))
  })

  // As PEDRAS da borda: manchadas por dentro e riscadas pelos dois fios do transbordo.
  const manchada: Textura = (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const rr = Math.hypot(x, y)
    let seco = passo(rBoca + 4.2 * k, rBoca + 0.6 * k, rr) * (0.45 + ruido(x * 0.3 + 11, y * 0.3) * 0.7)
    let da = Math.atan2(y, x) - TRANSBORDO
    da -= 2 * Math.PI * Math.round(da / (2 * Math.PI))
    for (const [onde, meia] of FIOS) {
      const torto = da - onde - ruido(rr * 0.2, onde * 9) * 0.05
      seco = Math.max(seco, passo(meia, meia * 0.35, Math.abs(torto)) * ALFA_DO_SECO)
    }
    const quanto = Math.min(ALFA_DO_SECO, Math.max(0, seco))
    for (let i = 0; i < 3; i += 1) s[i] += (SECO[i] - s[i]) * quanto
  }
  // Cada pedra da sua largura (a soma fecha a volta) e da sua fundura, com o alto pouco arredondado.
  const larguras = Array.from({ length: PEDRAS }, (_, i) => 1 + (hash(i, 3, 6650) - 0.5) * 2 * LARGURA_VARIA)
  const soma = larguras.reduce((a, b) => a + b, 0)
  let a0 = 0.21
  for (let i = 0; i < PEDRAS; i += 1) {
    const da = (2 * Math.PI * larguras[i]) / soma
    const forma = setorDeAnel(0, 0, rBoca, rFora - 2.2 * k * hash(i, 1, 6650), a0, da, 1.1 * k)
    L.push(P(forma, pedra, { tabua: 0, arco: { cx: 0, cy: 0, r: (rBoca + rFora) / 2, a0: a0 + da / 2 }, bisel: BISEL_DA_PEDRA * k, tom: (0.94 + 0.2 * hash(i, 2, 6650)) * PEDRA_ESCURA, contorno: 0.26, textura: manchada, semente: 6660 + i }))
    a0 += da
  }
}
