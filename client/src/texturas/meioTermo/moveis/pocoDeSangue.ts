/**
 * POÇO DE SANGUE de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; versão do `poco`, tipo
 * novo: o poço de sempre não muda). Só a BOCA redonda de pedra, sem esteio, sarilho nem balde: o anel de onze pedras
 * de alto arredondado, cada uma do seu tom e do seu tamanho, e dentro dele o LÍQUIDO cor de vinho velho, grosso e
 * parado, marmorizado em voltas lentas, com a sombra da borda do lado da luz, um brilho fraco que vem do fundo (o
 * miolo um pouco mais claro, que não pega a sombra), um reflexo apagado e três bolhas presas na beira. As pedras
 * estão manchadas por dentro, e por um lado o poço já TRANSBORDOU: dois fios secos atravessam a borda e acabam numa
 * mancha escura no chão.
 *
 * Sangue no tom do lote: vinho velho e apagado, nunca vermelho vivo. O brilho do desenho é fraco; se o mestre quiser
 * luz de verdade, é uma entrada em `LUZ_DOS_OBJETOS` (sugestão no registro do lote).
 *
 * Na 3/4 (DERIVADO) a boca é um tambor baixo de pedra (0,3 casa) com o líquido no alto; a mancha fica no chão.
 * Material: `pedra` (a borda; sugestão: ardósia, para casar com a arena). O líquido é fixo. Medidas do menor meio
 * lado (1,5 x 1,5 casa de partida, como o poço).
 */
import { hash } from '../../ruido'
import { elipse, elipseGirada } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { anelExato, bolha, passo, setorDeAnel } from './fossoDeArena'

/** Os raios, em fração do menor meio lado: a beira de fora da borda e a boca. */
const RAIO_DE_FORA = 0.92
const RAIO_DA_BOCA = 0.6
/** A altura da borda (casas) e quantas pedras dão a volta. */
const ALTURA = 0.3
const PEDRAS = 11
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
  [-0.07, 0.035],
  [0.09, 0.022],
]
/** As bolhas presas na beira: [ângulo, distância (fração do raio da boca), raio (px)]. */
const BOLHAS: readonly (readonly [number, number, number])[] = [
  [2.2, 0.72, 1.5],
  [2.45, 0.8, 0.95],
  [5.1, 0.76, 1.1],
]

/** O líquido: as voltas lentas do marmorizado e o miolo que brilha fraco (emissão: não pega a sombra da borda). */
function texDoLiquido(r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x, y) / r
    const a = Math.atan2(y, x) + rr * 2.4
    const volta = ruido(Math.cos(a) * rr * 2.6 + 5.3, Math.sin(a) * rr * 2.6 + 1.7)
    s[3] += volta * 0.3 + ruido(x * 0.24 + 3, y * 0.24) * 0.05 - 0.06 * passo(0.7, 1, rr)
    const miolo = Math.exp(-((rr / 0.58) ** 2)) * (0.7 + volta * 0.6)
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

  // O LEITO das juntas: o disco escuro debaixo das pedras (a maior peça da boca: dá a pedra à frente da 3/4).
  L.push(P(elipse(0, 0, rFora - 0.6 * k, rFora - 0.6 * k), pedra, { tabua: 0, bisel: 0.6, tom: 0.62, contorno: 0.24, semente: 6610 }))

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
      seco = Math.max(seco, passo(meia, meia * 0.35, Math.abs(torto)) * 0.8)
    }
    const quanto = Math.min(0.8, Math.max(0, seco))
    for (let i = 0; i < 3; i += 1) s[i] += (SECO[i] - s[i]) * quanto
  }
  for (let i = 0; i < PEDRAS; i += 1) {
    const a0 = (i / PEDRAS) * 2 * Math.PI + 0.21
    const da = (2 * Math.PI) / PEDRAS
    const forma = setorDeAnel(0, 0, rBoca, rFora - 1.4 * k * hash(i, 1, 6650), a0, da, 1.1 * k)
    L.push(P(forma, pedra, { tabua: 0, arco: { cx: 0, cy: 0, r: (rBoca + rFora) / 2, a0: a0 + da / 2 }, bisel: 3.2 * k, tom: 0.96 + 0.16 * hash(i, 2, 6650), contorno: 0.26, textura: manchada, semente: 6660 + i }))
  }
}
