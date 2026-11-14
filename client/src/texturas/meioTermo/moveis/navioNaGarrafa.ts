/**
 * NAVIO NA GARRAFA de cima com volume (lote L08 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do mestre:
 * "navio na garrafa"). O enfeite do capitão: a GARRAFA deitada sobre dois BERÇOS numa TÁBUA de nogueira, com a
 * rolha amarrada no gargalo e a plaquinha de latão na frente. Dentro, o MAR de massa azul-acinzentada e o NAVIO
 * visto do alto: o casco em ponta, o convés claro, o gurupés, os três mastros com as VELAS enfunadas para a proa
 * (cada uma uma meia-lua clara atravessada no casco, com a verga) e a flâmula na popa.
 *
 * O vidro é meio transparente (verde-água claro): o casco, as velas e os berços aparecem através dele, e o
 * brilho comprido do alto, o reflexo de baixo e a beira escura dizem "garrafa". A 25% de zoom sobra a cápsula
 * clara de vidro com as manchinhas brancas das velas dentro, na tábua escura: é o que diz "navio na garrafa".
 *
 * Na 3/4 fica como de cima, com a sombra de baixo (EM_PE, como a fruta e o barril deitado): a garrafa é volume
 * redondo deitado, e a frente varrida do perfil derivado virava um caixote debaixo dela. O desenho é feito na
 * pegada de partida (1 x 0,45 casa): as posições escalam com a pegada e o que é redondo, com o menor lado.
 * Material: `madeira` (a tábua e os berços; a nogueira de partida). O vidro, o mar, o navio, a rolha e o latão
 * são fixos.
 */
import { anel, capsula, caixa, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Projecao, type Textura } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A pegada de partida (px do protótipo): o desenho é medido nela. */
const LARGURA_DE_PARTIDA = 1 * G
const FUNDO_DE_PARTIDA = 0.45 * G
/** As alturas, em casas: a tábua e o alto da garrafa (as sombras). */
const ALTURA_DA_TABUA = 0.05
const ALTURA_DA_GARRAFA = 0.34

/** A garrafa: o fundo, o ombro, o gargalo e o raio do corpo e do gargalo (px de partida, x para o gargalo). */
const FUNDO_X = -24
const OMBRO_X = 11
const GARGALO_X = 17.5
const BOCA_X = 24.5
const RAIO_DO_CORPO = 8.5
const RAIO_DO_GARGALO = 3.1
/** Os dois berços (o meio de cada um) e a meia largura deles. */
const BERCOS: readonly number[] = [-14, 7.5]
const MEIO_BERCO = 2.3

/** Os três mastros (x do desenho) e a meia envergadura da vela de cada um. */
const MASTROS: readonly (readonly [number, number])[] = [
  [-11, 6],
  [-3.6, 7.2],
  [3.4, 6.2],
]
/** O quanto a vela enfuna para a proa (px de partida). */
const BOJO_DA_VELA = 2.6

const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0xcc, 0xc2] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf6, 0xf8, 0xf2] }
const MAR: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x7a, 0x82] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xe0, 0xdc] }
const CASCO: MaterialDaPeca = { classe: 'madeira', rgb: [0x6a, 0x48, 0x30] }
const CONVES: MaterialDaPeca = { classe: 'madeira', rgb: [0xb4, 0x90, 0x62] }
const VELA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xec, 0xe4, 0xd0] }
const BANDEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x38, 0x36] }
const ROLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xb2, 0x8c, 0x62] }
const LATAO: MaterialDaPeca = materialDaPeca('latao')
const CORDA: MaterialDaPeca = materialDaPeca('corda')
const LETRA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x48, 0x2c] }

/** O vidro faz uma sombra curta, transparente, na tábua. */
const SOMBRA_DA_GARRAFA: Projecao = { dist: 2.2, forca: 0.3, suave: 1.4 }
const SOMBRA_DO_NAVIO: Projecao = { dist: 0.7, forca: 0.3, suave: 0.4 }

/** A cortiça: os poros escuros. */
const texDaRolha: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.9 + p.su, y * 0.9 + p.sv) * 0.14 + (ruido(x * 2.2, y * 2.2 + p.sv) > 0.3 ? -0.1 : 0)
}

/** A massa do mar: as ondas em riscos de través, como pinceladas. */
const texDoMar: Textura = (_u, _v, x, y, p, s) => {
  s[3] += Math.sin(x * 1.3 + ruido(x * 0.3 + p.su, y * 0.6) * 4) * 0.05 + ruido(x * 0.5, y * 0.5 + p.sv) * 0.08
}

export const montarNavioNaGarrafa: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const sx = c.w / LARGURA_DE_PARTIDA
  const sy = c.h / FUNDO_DE_PARTIDA
  const k = Math.min(sx, sy)
  const em = (x: number, y: number): Ponto => [x * sx, y * sy]
  const mad = c.m.madeira
  const L = cena.partes

  // A tábua, que enche a pegada, e os dois berços.
  const tabua = caixa(-hw * 0.98, -hh * 0.96, hw * 0.98, hh * 0.96, 1.6 * k)
  cena.sombras.push({ forma: tabua, z: c.g * ALTURA_DA_TABUA, forca: 0.26 }, contato(tabua, 0.32))
  L.push(P(tabua, mad, { eixo: 0, tabua: 0, bisel: 1.4 * k, contorno: 0.3, semente: 8601 }))
  for (const [i, x] of BERCOS.entries()) {
    const [bx] = em(x, 0)
    const berco = caixa(bx - MEIO_BERCO * k, -RAIO_DO_CORPO * 1.22 * sy, bx + MEIO_BERCO * k, RAIO_DO_CORPO * 1.22 * sy, 0.8 * k)
    L.push(P(berco, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9 * k, contorno: 0.3, tom: 1.18, projeta: { dist: 1, forca: 0.3 }, semente: 8603 + i }))
  }

  // A garrafa: o corpo de fundo arredondado, o ombro, o gargalo.
  const ry = RAIO_DO_CORPO * sy
  const rg = RAIO_DO_GARGALO * sy
  const [fx] = em(FUNDO_X, 0)
  const [ox] = em(OMBRO_X, 0)
  const [gx] = em(GARGALO_X, 0)
  const [bx] = em(BOCA_X, 0)
  const corpo = caixa(fx, -ry, ox + 2 * sx, ry, 4.4 * k)
  const ombro = poligono([[ox, -ry], [ox + 4.2 * sx, -ry * 0.78], [gx, -rg * 1.12], [gx, rg * 1.12], [ox + 4.2 * sx, ry * 0.78], [ox, ry]])
  const gargalo = caixa(gx - 1.5 * sx, -rg, bx, rg, 1 * k)
  const garrafa = uniao(uniao(corpo, ombro), gargalo)
  cena.sombras.push({ forma: garrafa, z: c.g * ALTURA_DA_GARRAFA, forca: 0.16 })

  // Dentro: o mar de massa ao longo do fundo, com a espuma na proa e na popa.
  const mar = caixa(fx + 3 * sx, -ry * 0.62, ox + 0.5 * sx, ry * 0.62, ry * 0.5)
  L.push(P(mar, MAR, { bisel: 1.6 * k, contorno: 0.2, textura: texDoMar, semente: 8610 }))
  for (const [i, [x, y, r]] of ([[9, 0, 2.4], [-18.5, 1.4, 1.8], [-6, 3.8, 1.2], [1, -3.9, 1.2]] as const).entries()) {
    L.push(P(elipse(...em(x, y), r * sx, r * 0.6 * sy), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.6, suave: 0.6 * k, semente: 8611 + i }))
  }

  // O navio visto do alto: o casco em ponta para o gargalo, o espelho de popa, o convés, o gurupés.
  const casco = poligono([em(-18, -3), em(-10, -4), em(0, -3.9), em(5.5, -2.8), em(10, 0), em(5.5, 2.8), em(0, 3.9), em(-10, 4), em(-18, 3)])
  L.push(P(casco, CASCO, { eixo: 0, tabua: 0, bisel: 1 * k, contorno: 0.3, projeta: SOMBRA_DO_NAVIO, semente: 8620 }))
  const conves = poligono([em(-16.8, -2.1), em(-10, -2.9), em(0, -2.8), em(4.8, -1.9), em(8, 0), em(4.8, 1.9), em(0, 2.8), em(-10, 2.9), em(-16.8, 2.1)])
  L.push(P(conves, CONVES, { eixo: 0, tabua: 1.2 * k, bisel: 0.4 * k, contorno: 0.16, semente: 8621 }))
  L.push(P(caixa(...em(-18, -2.6), ...em(-16.4, 2.6), 0.4 * k), CASCO, { eixo: QUARTO, tabua: 0, bisel: 0.5 * k, tom: 0.86, contorno: 0.26, semente: 8624 }))
  L.push(P(capsula(...em(9.4, 0), ...em(15, 0), 0.4 * k), CASCO, { bisel: 0.3 * k, contorno: 0.3, semente: 8622 }))
  // As velas: cheias, em D, enfunadas para a proa, com a costura do meio; a verga atravessada e o mastro no meio.
  MASTROS.forEach(([x, meia], i) => {
    const [mx, my] = em(x, 0)
    const bojo = BOJO_DA_VELA * sx
    const vela: Forma = dentroDe(elipse(mx, my, bojo, meia * sy), caixa(mx, my - meia * sy, mx + bojo, my + meia * sy))
    L.push(P(vela, VELA, { bisel: 1.1 * k, contorno: 0.28, projeta: { dist: 1.1, forca: 0.34, suave: 0.5 }, semente: 8630 + i }))
    L.push(P(dentroDe(capsula(mx + bojo * 0.5, my - meia * sy, mx + bojo * 0.5, my + meia * sy, 0.22 * k), vela), CASCO, { bisel: 0, contorno: 0, alfa: 0.18, semente: 8633 + i }))
    L.push(P(capsula(mx, my - meia * sy, mx, my + meia * sy, 0.32 * k), CASCO, { bisel: 0.2 * k, contorno: 0.22, semente: 8636 + i }))
    L.push(P(elipse(mx, my, 0.6 * k, 0.6 * k), CASCO, { bisel: 0.3 * k, tom: 0.8, contorno: 0.2, semente: 8639 + i }))
  })
  // A bandeira pirata no alto do mastro grande, voando para a popa, com o pontinho da caveira.
  const [bmx] = em(MASTROS[1][0], 0)
  L.push(P(caixa(bmx - 3.6 * sx, -0.9 * sy, bmx - 0.4 * sx, 0.9 * sy, 0.2 * k), BANDEIRA, { bisel: 0.3 * k, contorno: 0.26, projeta: SOMBRA_DO_NAVIO, semente: 8623 }))
  L.push(P(elipse(bmx - 2 * sx, 0, 0.45 * k, 0.45 * k), ESPUMA, { bisel: 0, contorno: 0, semente: 8625 }))

  // O vidro por cima de tudo, meio transparente, com a beira escura e o brilho de metal.
  L.push(P(garrafa, VIDRO, { bisel: 3.4 * k, contorno: 0.32, alfa: 0.26, metal: 0.5, projeta: SOMBRA_DA_GARRAFA, semente: 8640 }))
  // Os brilhos: o comprido do alto, rente à beira, um mais fino por dentro, o do ombro e do gargalo, e o reflexo de baixo.
  L.push(P(capsula(fx + 4 * sx, -ry * 0.8, ox - 1 * sx, -ry * 0.8, 0.8 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.62, suave: 0.5 * k, semente: 8641 }))
  L.push(P(capsula(fx + 6 * sx, -ry * 0.32, fx + 18 * sx, -ry * 0.32, 0.5 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.4 * k, semente: 8642 }))
  L.push(P(capsula(ox + 1.2 * sx, -ry * 0.78, gx + 0.4 * sx, -rg * 0.7, 0.6 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.4 * k, semente: 8643 }))
  L.push(P(capsula(gx + 0.6 * sx, -rg * 0.5, bx - 1.4 * sx, -rg * 0.5, 0.55 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.3 * k, semente: 8644 }))
  L.push(P(capsula(fx + 4 * sx, ry * 0.74, ox - 6 * sx, ry * 0.74, 0.6 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.18, suave: 0.6 * k, semente: 8645 }))
  // O fundo grosso da garrafa: o anel mais escuro na ponta de trás.
  L.push(P(caixa(fx, -ry, fx + 1.8 * sx, ry, 1 * k), VIDRO, { bisel: 0.8 * k, contorno: 0, tom: 0.7, alfa: 0.4, semente: 8646 }))

  // O barbante no gargalo, o anel da boca, a rolha e o lacre.
  L.push(P(caixa(bx - 3.6 * sx, -rg * 1.12, bx - 2.4 * sx, rg * 1.12, 0.4 * k), CORDA, { eixo: QUARTO, bisel: 0.4 * k, contorno: 0.26, semente: 8650 }))
  L.push(P(caixa(bx - 1.2 * sx, -rg * 1.16, bx, rg * 1.16, 0.6 * k), VIDRO, { bisel: 0.6 * k, contorno: 0.3, tom: 1.04, alfa: 0.6, metal: 0.5, semente: 8651 }))
  const rolha = caixa(bx, -rg * 0.86, bx + 2.6 * sx, rg * 0.86, 0.9 * k)
  L.push(P(rolha, ROLHA, { bisel: 0.9 * k, contorno: 0.3, textura: texDaRolha, projeta: { dist: 0.8, forca: 0.3 }, semente: 8652 }))

  // A plaquinha de latão na beira da tábua, com as duas linhas gravadas.
  const [px, py] = em(-2, 10.3)
  L.push(P(caixa(px - 7 * sx, py - 1.1 * sy, px + 7 * sx, py + 1.1 * sy, 0.4 * k), LATAO, { bisel: 0.5 * k, contorno: 0.3, metal: 0.5, semente: 8655 }))
  for (const [i, [x0, x1]] of ([[-5, 3.4], [-3.6, 5]] as const).entries()) {
    L.push(P(capsula(px + x0 * sx, py + (i - 0.5) * 0.9 * sy, px + x1 * sx, py + (i - 0.5) * 0.9 * sy, 0.18 * k), LETRA, { bisel: 0, contorno: 0, alfa: 0.6, semente: 8656 + i }))
  }
  // Os dois pregos de latão que seguram a plaquinha.
  for (const d of [-6.2, 6.2]) L.push(P(anel(px + d * sx, py, 0.5 * k, 0.5 * k, 0.15 * k, 0.15 * k), LATAO, { bisel: 0.3 * k, tom: 1.2, contorno: 0.2, semente: 8659 }))
}
