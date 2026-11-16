/**
 * CARRO ANTIGO (lote L2 das referências, 16/11/2026: versão original de um sedã dos anos 1920, só a ideia do objeto,
 * de nenhuma marca). A carroceria alta e quadrada da cor escolhida, com o friso claro na cintura, as portas e as
 * maçanetas; o capô comprido com as venezianas do lado e a dobradiça no meio; na frente o radiador niquelado com a
 * tampa, os dois faróis de tambor na barra e o para-choque; os para-lamas pretos sobre as quatro RODAS de raios de
 * madeira, ligados pelo estribo; a cabine com as janelas, o para-brisa e o teto preto de lona com as costuras; atrás,
 * o estepe de pé e o para-choque de trás. O capô aponta para a direita da pegada (x positivo).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): de cima aparecem o teto preto, o capô da cor da
 * pintura, os para-lamas e o estepe (a 25% de zoom: o retângulo comprido de duas cores com os quatro pretos dos
 * cantos); na 3/4 o carro sobe inteiro e o lado mostra as rodas de raios, as janelas e as portas (a textura de cada
 * fatia desenha a face naquela altura). Girado, mostra a frente com a grade e os faróis, ou a traseira com o estepe.
 *
 * Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pintura` (a carroceria; vale o rgb do material
 * escolhido, pintado liso); o preto, a borracha, o níquel, o vidro e a madeira dos raios são fixos.
 */
import type { Rgb } from '../../ruido'
import { caixa, elipse } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, type Fatiador } from './pilhaDeFatias'
import { disco, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'

/** Os fixos: a borracha dos pneus, o preto dos para-lamas e do teto, o níquel, o vidro e a madeira dos raios. */
const BORRACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x47, 0x44, 0x40] }
const PRETO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x4a, 0x47] }
const NIQUEL: MaterialDaPeca = { classe: 'metal', rgb: [0xb8, 0xb5, 0xad] }
const VIDRO: Rgb = [0x4f, 0x5d, 0x63]
const RAIO: Rgb = [0xa6, 0x82, 0x57]
/** As alturas (casas): a roda (raio), a cintura da carroceria e o teto. */
const RAIO_DA_RODA = 0.33
const CINTURA = 0.6
const TETO = 1.18
/** As rodas: onde ficam (fração do meio comprimento: a de trás e a da frente) e a largura do pneu (px). */
const RODAS = [-0.6, 0.58] as const
const PNEU = 7
/** O passo das fatias (px do protótipo). */
const PASSO = 1

const mod = (a: number, n: number): number => ((a % n) + n) % n

/** A face da caixa mais perto do ponto: a normal dela (de lado se está na beira, de cima no meio). */
function faceDaCaixa(b: readonly [number, number, number, number], x: number, y: number): [number, number, number] {
  const m = 1.4
  if (y > b[3] - m) return [0, 1, 0]
  if (y < b[1] + m) return [0, -1, 0]
  if (x > b[2] - m) return [1, 0, 0]
  if (x < b[0] + m) return [-1, 0, 0]
  return [0, 0, 1]
}

/** Pinta a amostra com a cor `rgb` (a peça é de um material, a textura escolhe a cor de cada ponto). */
function pintar(s: Float32Array, rgb: Rgb): void {
  s[0] = rgb[0]
  s[1] = rgb[1]
  s[2] = rgb[2]
}

export const montarCarroAntigo: MontarMovel = (c, cena) => {
  const { hw: L, hh: W, g, peca: P } = c
  const pintura: MaterialDaPeca = { classe: 'liso', rgb: c.m.pintura.rgb }
  const f: Fatiador = novoFatiador(P, cena, c.giro)
  const q = f.q
  const r = g * RAIO_DA_RODA
  const zCintura = g * CINTURA
  const zTeto = g * TETO
  const yRoda = W - 1 - PNEU / 2
  const [xTras, xFrente] = [L * RODAS[0], L * RODAS[1]]

  // As RODAS: o pneu e, na face de fora, os raios de madeira com o cubo niquelado.
  for (const xw of [xTras, xFrente]) {
    for (const sy of [-1, 1]) {
      const yc = sy * yRoda
      for (const z of alturas(0.4, 2 * r, PASSO)) {
        const meia = Math.sqrt(Math.max(0, r * r - (z - r) * (z - r)))
        if (meia < 0.8) continue
        const roda: Textura = (_u, _v, x, y, _p, s) => {
          const [dx, dz] = [x - xw, z - r]
          if (sy * (y - yc) > PNEU / 2 - 1.3) {
            const rr = Math.hypot(dx, dz)
            if (rr > r - 4.2) {
              s[3] += luzDaNormal(0, sy, 0, q) - 0.02
            } else if (rr < 2.8) {
              pintar(s, NIQUEL.rgb)
              s[3] += 0.08
            } else {
              const a = Math.atan2(dz, dx)
              const raio = mod(a, (2 * Math.PI) / 12) * rr < 1.5
              pintar(s, RAIO)
              s[3] += raio ? luzDaNormal(0, sy, 0, q) + 0.04 : -0.28
            }
            return
          }
          s[3] += luzDaNormal(dx / r, 0, dz / r, q) * 1.4
        }
        f.fatia(0, z, caixa(xw - meia, yc - PNEU / 2, xw + meia, yc + PNEU / 2, 0.8), BORRACHA, lisa(1, roda, 6500))
      }
      // O PARA-LAMA por cima da roda, em arco.
      const rf = r + 3.5
      for (const z of alturas(r, 2 * r + 3, PASSO)) {
        const meia = Math.sqrt(Math.max(0, rf * rf - (z - r) * (z - r)))
        if (meia < 2) continue
        const topo = z + PASSO > 2 * r + 3
        const arco: Textura = (_u, _v, x, y, _p, s) => {
          const lado = Math.abs(y - yc) > PNEU / 2 + 0.4
          s[3] += lado ? luzDaNormal(0, Math.sign(y - yc), 0, q) : luzDaNormal((x - xw) / rf, 0, (z - r) / rf, q) * 1.3
        }
        f.fatia(1, z, caixa(xw - meia, yc - PNEU / 2 - 1.6, xw + meia, yc + PNEU / 2 + 1.6, 1.2), PRETO, topo ? { tabua: 0, bisel: 0.8, tom: 1, contorno: 0.24, textura: arco, semente: 6510 } : lisa(1, arco, 6511))
      }
    }
  }

  // O ESTRIBO de cada lado, de para-lama a para-lama, com as listras de borracha.
  const zEstribo = r * 0.8
  for (const sy of [-1, 1]) {
    const yc = sy * yRoda
    const listras: Textura = (_u, _v, x, _y, _p, s) => {
      s[3] += mod(x, 3) < 0.7 ? -0.08 : 0.02
    }
    for (const z of alturas(zEstribo - 1.6, zEstribo, 0.8)) f.fatia(1, z, caixa(xTras + r + 1, yc - PNEU / 2 - 1.2, xFrente - r - 1, yc + PNEU / 2 + 1.2, 0.6), PRETO, z >= zEstribo - 1e-6 ? { tabua: 0, bisel: 0.5, tom: 1, contorno: 0.22, textura: listras, semente: 6520 } : lisa(0.9, undefined, 6521))
  }

  // A CARROCERIA de baixo: as portas, as maçanetas e o friso claro na cintura.
  const meiaDoCorpo = W - PNEU - 4
  const corpo = [-L + 7, -meiaDoCorpo, L - 24, meiaDoCorpo] as const
  const portas = [-L * 0.42, -L * 0.04, L * 0.1] as const
  const ladoDoCorpo = (z: number): Textura => (_u, _v, x, y, _p, s) => {
    const [nx, ny, nz] = faceDaCaixa(corpo, x, y)
    let luz = luzDaNormal(nx, ny, nz, q) + (nz > 0 ? 0.04 : 0)
    if (ny !== 0) {
      if (Math.abs(z - (zCintura - 2.2)) < 0.6) luz += 0.16
      if (portas.some((px) => Math.abs(x - px) < 0.45) && z > zEstribo + 2) luz -= 0.2
      if (portas.slice(0, 2).some((px) => Math.abs(x - (px + 5)) < 1.6) && Math.abs(z - (zCintura - 5)) < 0.7) {
        pintar(s, NIQUEL.rgb)
        luz += 0.06
      }
    }
    s[3] += luz
  }
  for (const z of alturas(zEstribo - 2, zCintura, PASSO)) {
    const topo = z >= zCintura - 1e-6
    f.fatia(2, z, caixa(corpo[0], corpo[1], corpo[2], corpo[3], 1.6), pintura, topo ? { tabua: 0, bisel: 1, tom: 1, contorno: 0.26, textura: ladoDoCorpo(z), semente: 6530 } : lisa(1, ladoDoCorpo(z), 6531))
  }

  // O CAPÔ: as venezianas do lado e a dobradiça no meio; o alto arredondado.
  const capo0 = L * 0.1
  const capo1 = L - 24
  for (const z of alturas(zCintura, zCintura + 9, PASSO)) {
    const meia = meiaDoCorpo - 3 - Math.max(0, z - zCintura - 5) * 2.2
    const b = [capo0, -meia, capo1, meia] as const
    const topo = z + PASSO > zCintura + 9
    const capo: Textura = (_u, _v, x, y, _p, s) => {
      const [nx, ny, nz] = faceDaCaixa(b, x, y)
      let luz = luzDaNormal(nx, ny, nz, q) + (nz > 0 ? 0.05 : 0)
      if (ny !== 0 && x > capo0 + 8 && x < capo1 - 6 && z > zCintura + 1.4 && z < zCintura + 5.5 && mod(x, 3.2) < 0.9) luz -= 0.2
      if (nz > 0 && Math.abs(y) < 0.5) luz -= 0.12
      s[3] += luz
    }
    f.fatia(2, z, caixa(b[0], b[1], b[2], b[3], 1.4), pintura, topo ? { tabua: 0, bisel: 1.2, tom: 1, contorno: 0.26, textura: capo, semente: 6540 } : lisa(1, capo, 6541))
  }

  // O RADIADOR niquelado com a grade (de frente) e a tampa; os FARÓIS de tambor na barra; o PARA-CHOQUE.
  const rad = [L - 24, -(meiaDoCorpo - 3), L - 19, meiaDoCorpo - 3] as const
  const radiador = (z: number): Textura => (_u, _v, x, y, _p, s) => {
    const [nx, ny, nz] = faceDaCaixa(rad, x, y)
    let luz = luzDaNormal(nx, ny, nz, q) * 1.3
    if (nx > 0 && Math.abs(y) < rad[3] - 2 && z > zEstribo + 1 && z < zCintura + 7) {
      s[0] *= 0.42
      s[1] *= 0.42
      s[2] *= 0.42
      luz += mod(z, 1.6) < 0.6 ? 0.18 : 0
    }
    s[3] += luz
  }
  for (const z of alturas(zEstribo - 2, zCintura + 10, PASSO)) f.fatia(3, z, caixa(rad[0], rad[1], rad[2], rad[3], 0.8), NIQUEL, z + PASSO > zCintura + 10 ? { tabua: 0, bisel: 0.6, tom: 1.04, contorno: 0.24, semente: 6550 } : lisa(1, radiador(z), 6551))
  for (const z of alturas(zCintura + 10, zCintura + 13, 0.6)) f.fatia(3, z, disco(L - 21.5, 0, 1.6), NIQUEL, z + 0.6 > zCintura + 13 ? { tabua: 0, bisel: 0.6, tom: 1.1, contorno: 0.24, semente: 6552 } : lisa(1, undefined, 6553))
  const zFarol = zCintura + 6
  for (const z of alturas(zCintura, zCintura + 1.6, 0.8)) f.fatia(3, z, caixa(L - 18.5, -(meiaDoCorpo + 1), L - 16.5, meiaDoCorpo + 1, 0.5), NIQUEL, lisa(0.95, undefined, 6554))
  for (const sy of [-1, 1]) {
    const yc = sy * (meiaDoCorpo - 1)
    for (const z of alturas(zFarol - 4.2, zFarol + 4.2, 0.6)) {
      const meia = Math.sqrt(Math.max(0, 4.2 * 4.2 - (z - zFarol) * (z - zFarol)))
      if (meia < 0.6) continue
      const farol: Textura = (_u, _v, x, y, _p, s) => {
        if (x > L - 15.2) {
          pintar(s, [0xe6, 0xdf, 0xbd])
          s[3] += 0.06 - 0.08 * (Math.hypot(y - yc, z - zFarol) / 4.2)
          return
        }
        s[3] += luzDaNormal(0, (y - yc) / 4.2, (z - zFarol) / 4.2, q) * 1.5
      }
      f.fatia(3, z, caixa(L - 22, yc - meia, L - 14.5, yc + meia, 0.6), NIQUEL, lisa(1, farol, 6560))
    }
  }
  for (const [xa, xb] of [[L - 8, L - 4.5], [-L + 1.5, -L + 5]] as const) {
    for (const z of alturas(zEstribo - 1, zEstribo + 2.5, 0.8)) f.fatia(3, z, caixa(xa, -(W - 3), xb, W - 3, 1.2), NIQUEL, z + 0.8 > zEstribo + 2.5 ? { eixo: 0, tabua: 0, bisel: 0.7, tom: 1.06, contorno: 0.24, semente: 6570 } : lisa(0.96, undefined, 6571))
  }

  // A CABINE: as janelas com as colunas, o para-brisa, o vidro de trás; o TETO preto de lona com as costuras.
  const cab0 = -L + 9
  const cab1 = capo0
  const zJanela0 = zCintura + 8
  const zJanela1 = zTeto - 7
  const colunas = [cab0 + 2.5, portas[0], portas[1] - 1.5, cab1 - 2] as const
  for (const z of alturas(zCintura, zTeto, PASSO)) {
    const noTeto = z > zTeto - 6
    const meia = meiaDoCorpo - 1 - Math.max(0, z - zCintura - 12) * 0.12 - (noTeto ? (z - (zTeto - 6)) * 0.45 : 0)
    const b = [cab0 + (noTeto ? 0.6 : 0), -meia, cab1 - (noTeto ? 0.6 : 0), meia] as const
    const topo = z + PASSO > zTeto
    const cabine: Textura = (_u, _v, x, y, _p, s) => {
      const [nx, ny, nz] = faceDaCaixa(b, x, y)
      let luz = luzDaNormal(nx, ny, nz, q)
      const naJanela = z > zJanela0 && z < zJanela1
      const vidro =
        (ny !== 0 && naJanela && !colunas.some((cx) => Math.abs(x - cx) < 1.6)) ||
        (nx > 0 && naJanela && Math.abs(y) < meia - 2) ||
        (nx < 0 && naJanela && Math.abs(y) < meia * 0.45 && z > zJanela0 + 3)
      if (vidro && !noTeto) {
        pintar(s, VIDRO)
        // O reflexo do céu, em faixa inclinada.
        luz += mod(x * 0.6 + z, 9) < 1.6 ? 0.12 : 0
      }
      if (noTeto && nz > 0 && Math.abs(Math.abs(y) - (meia - 4)) < 0.5) luz -= 0.1
      s[3] += luz
    }
    f.fatia(4, z, caixa(b[0], b[1], b[2], b[3], noTeto ? 2.6 : 1.4), noTeto ? PRETO : pintura, topo ? { tabua: 0, bisel: 1.2, tom: 1, contorno: 0.26, textura: cabine, semente: 6580 } : lisa(1, cabine, 6581))
  }

  // O ESTEPE de pé atrás: o pneu, a capa da cor da pintura e o cubo.
  const rs = r * 0.95
  const zEstepe = zCintura - 2
  for (const z of alturas(zEstepe - rs, zEstepe + rs, PASSO)) {
    const meia = Math.sqrt(Math.max(0, rs * rs - (z - zEstepe) * (z - zEstepe)))
    if (meia < 0.8) continue
    const estepe: Textura = (_u, _v, x, y, _p, s) => {
      if (x < -L + 3.6) {
        const rr = Math.hypot(y, z - zEstepe)
        if (rr < rs - 4) pintar(s, rr < 2.4 ? NIQUEL.rgb : pintura.rgb)
        s[3] += luzDaNormal(-1, 0, 0, q) + (rr < 2.4 ? 0.1 : 0)
        return
      }
      s[3] += luzDaNormal(0, y / rs, (z - zEstepe) / rs, q) * 1.4
    }
    f.fatia(3, z, caixa(-L + 2.5, -meia, -L + 8.5, meia, 0.8), BORRACHA, lisa(1, estepe, 6590))
  }
  f.fechar()

  // A sombra do carro alto (varrida do chão até a do teto), a de baixo da carroceria e o contato de cada pneu.
  cena.sombras.push(
    sombraVarrida(-L + 4, -meiaDoCorpo, L - 6, meiaDoCorpo, zTeto * 0.5, q, 0.2, 3),
    contato(elipse(0, 0, L * 0.9, W * 0.8), 0.3),
    ...[xTras, xFrente].flatMap((xw) => [-1, 1].map((sy) => contato(elipse(xw, sy * yRoda, r * 0.6, PNEU * 0.7), 0.36))),
  )
}
