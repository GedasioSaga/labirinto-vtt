/**
 * MONTE DE ENTULHO de cima com volume (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; objeto novo). O lixo
 * que se junta em volta de toda casa do cortiço, num monte só. A silhueta vem antes do detalhe: o MONTE baixo e mole
 * de caliça e terra, o SACO de estopa rasgado e tombado em cima dele (a boca amarrada, o rasgo escuro na barriga e o
 * que vazou escorrendo pelo monte), a TÁBUA quebrada atravessada, que passa da beira do monte com a ponta lascada,
 * um SARRAFO meio enterrado, o TRAPO azul desbotado caído na encosta, os CACOS de barro (a beira de um pote e os
 * pedaços), três tijolos partidos, um aro de barril amassado e umas pedras soltas no chão em volta.
 *
 * A 25% de zoom sobram a mancha parda do monte, o bolo claro do saco, o risco da tábua para fora e o ponto azul do
 * trapo: é um monte de lixo, não um móvel.
 *
 * Na 3/4 (`{ modo: 'derivado', espessura: 0,16 casa }`) o monte é uma coluna baixa e o saco, um tampo grosso em cima
 * dele (a caixa da sombra do saco desce até a frente do monte, para ele ser pintado depois). Material: `madeira` (a
 * tábua e o sarrafo; sugestão: madeira velha). O resto é fixo, em cores apagadas. Medidas de 1,5 x 1,25 casa.
 */
import { hash } from '../../ruido'
import { caixa, capsula, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, PREGO, materialDaPeca, type MontarMovel } from './contexto'
import { bolha, comMeioEm, girada, setorDeAnel } from './fossoDeArena'

/** Alturas (casas): o monte e o alto do saco. */
const ALTURA_DO_MONTE = 0.14
const ALTURA_DO_SACO = 0.3
/** A caliça do monte, a estopa do saco, o que vazou dele, o trapo, o tijolo e o barro dos cacos. */
const CALICA: MaterialDaPeca = { classe: 'liso', rgb: [0x74, 0x6a, 0x5e] }
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa9, 0x97, 0x74] }
const VAZADO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xb4, 0x94] }
const TRAPO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x5f, 0x6e, 0x7a] }
const TIJOLO: MaterialDaPeca = { classe: 'pedra', pedra: 'arenito', rgb: [0x90, 0x66, 0x55] }

/** A caliça: manchas largas, a terra nos baixos e o miúdo claro e escuro em grãos moles (o grão some pela metade na sombra). */
const texDaCalica: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.07 + p.su, y * 0.07) * 0.15 + ruido(x * 0.3, y * 0.3 + 3) * 0.08 + ruido(x * 0.8 + 5, y * 0.8) * 0.05
  const grao = ruido(x * 1.6 + p.sv, y * 1.6 + 11)
  if (grao > 0.3) s[6] = 0.16
  else if (grao < -0.32) s[6] = -0.16
}

/** Um PEDAÇO de caliça: a pedra de quinas, de raio `r` em volta de (x, y), cada quina a uma distância sorteada. */
function pedaco(x: number, y: number, r: number, semente: number): Forma {
  const pontos: Ponto[] = []
  const quinas = 5 + (semente % 2)
  for (let i = 0; i < quinas; i += 1) {
    const a = (i / quinas) * 2 * Math.PI + hash(i, 1, semente) * 0.6
    const longe = r * (0.72 + 0.5 * hash(i, 2, semente))
    pontos.push([x + Math.cos(a) * longe, y + Math.sin(a) * longe * 0.86])
  }
  return poligono(pontos)
}

/** A tábua de (ax, ay) a (bx, by), de largura `larg`, com a ponta de `b` lascada em dentes. */
function tabuaLascada(ax: number, ay: number, bx: number, by: number, larg: number, semente: number): Forma {
  const l = Math.hypot(bx - ax, by - ay)
  const [ux, uy] = [(bx - ax) / l, (by - ay) / l]
  const [nx, ny] = [-uy, ux]
  const em = (ao: number, de: number): Ponto => [ax + ux * ao + nx * de, ay + uy * ao + ny * de]
  const pontos: Ponto[] = [em(0, -larg / 2), em(l - larg * 0.5, -larg / 2)]
  // Os dentes da quebra: a madeira racha ao longo do veio, em lascas desiguais.
  const dentes = 5
  for (let i = 0; i <= dentes; i += 1) {
    const de = -larg / 2 + (larg * i) / dentes
    pontos.push(em(l - larg * (i % 2 === 0 ? 0.5 + 0.5 * hash(i, 1, semente) : -0.25 * hash(i, 2, semente)), de))
  }
  pontos.push(em(0, larg / 2))
  return poligono(pontos)
}

export const montarMonteDeEntulho: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const madeira = c.m.madeira
  const L = cena.partes
  const k = Math.min(w / (1.5 * g), h / (1.25 * g))
  const barro = materialDaPeca('barro')
  const ferro = materialDaPeca('ferro')

  // ---------- no chão, em volta: as pedras soltas, um caco e a ponta do sarrafo ----------
  const soltas: readonly (readonly [number, number, number, number])[] = [
    [-36, 6, 2.6, 0.4], [-31, 19, 1.8, 1.3], [35, 20, 2.3, 2.2], [27, 29, 1.6, 0.2], [-10, 31, 2, 2.8], [38, -3, 1.5, 1.1],
  ]
  soltas.forEach(([x, y, r, volta], i) => {
    const forma = elipseGirada(x * k, y * k, r * k * 1.3, r * k, volta)
    cena.sombras.push(contato(forma, 0.26))
    L.push(P(forma, CALICA, { tabua: 0, bisel: r * k * 0.8, tom: 1.08 + 0.2 * hash(i, 1, 7201), contorno: 0.26, semente: 7202 + i, projeta: { dist: 0.9, forca: 0.24 } }))
  })
  const cacoNoChao = poligono([[18 * k, 30 * k], [23.5 * k, 28.4 * k], [24.6 * k, 32.2 * k], [20 * k, 33.6 * k]])
  cena.sombras.push(contato(cacoNoChao, 0.24))
  L.push(P(cacoNoChao, barro, { tabua: 0, bisel: 0.8, tom: 0.96, contorno: 0.28, semente: 7210 }))

  // ---------- o MONTE: a volta mole, com a caliça por cima ----------
  const monte = bolha(-1 * k, 2 * k, 33 * k, 25 * k, 7220, 0.13, 0.12)
  cena.sombras.push({ forma: monte, z: g * ALTURA_DO_MONTE, forca: 0.3 }, contato(monte, 0.34))
  // O meio da caixa das peças do monte fica fora do saco: na 3/4 elas sobem com o monte, não com o saco.
  const noMonte: readonly [number, number] = [14 * k, 12 * k]
  L.push(P(comMeioEm(monte, noMonte[0], noMonte[1]), CALICA, { tabua: 0, bisel: 8 * k, ruga: 1.5, contorno: 0.26, textura: texDaCalica, semente: 7221 }))
  L.push(P(comMeioEm(bolha(4 * k, 5 * k, 20 * k, 13 * k, 7222, 0.2, -0.3), noMonte[0], noMonte[1]), CALICA, { tabua: 0, bisel: 5 * k, ruga: 1.2, tom: 1.1, contorno: 0.08, textura: texDaCalica, semente: 7223 }))
  // Os PEDAÇOS de caliça por cima do monte: é o que faz dele um monte de entulho e não um montinho de terra.
  const pedacos: readonly (readonly [number, number, number, number])[] = [
    [-25, 5, 2.3, 1.22], [-18, -14, 1.9, 0.82], [-4, 9, 2.5, 1.26], [6, -15, 2.1, 1.16], [12, 13, 1.8, 0.86], [23, -12, 2.2, 1.2],
    [1, 17, 1.6, 1.3], [-10, 12, 1.5, 0.8], [14, -17, 1.4, 1.28], [25, 10, 1.7, 1.12], [-28, -6, 1.6, 1.18], [-2, -19, 1.7, 0.84], [8, 2, 1.5, 1.24],
  ]
  pedacos.forEach(([x, y, r, tom], i) => {
    L.push(P(pedaco(x * k, y * k, r * k, 7224 + i * 3), CALICA, { tabua: 0, bisel: r * k * 0.6, tom, contorno: 0.28, semente: 7224 + i, projeta: { dist: 0.9 * k, forca: 0.26 } }))
  })

  // Os TIJOLOS partidos, meio enterrados na encosta de baixo.
  const tijolos: readonly (readonly [number, number, number, number, number])[] = [
    [-20, 14, 5.2, 2.8, 0.5], [-13.5, 19.5, 3.4, 2.6, -0.3], [9, 21, 4.4, 2.7, 0.15],
  ]
  tijolos.forEach(([x, y, mw, mh, volta], i) => {
    const forma = girada(caixa((x - mw) * k, (y - mh) * k, (x + mw) * k, (y + mh) * k, 0.7 * k), x * k, y * k, volta)
    L.push(P(forma, TIJOLO, { tabua: 0, eixo: volta, bisel: 1 * k, tom: 0.94 + 0.12 * hash(i, 2, 7230), contorno: 0.28, semente: 7231 + i, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  })

  // O ARO de barril amassado, saindo do monte à esquerda.
  L.push(P(comMeioEm(setorDeAnel(-22 * k, -4 * k, 8.2 * k, 9.4 * k, 1.9, 3.3, 0), -27 * k, 4 * k), ferro, { tabua: 0, bisel: 0.6, tom: 1.1, contorno: 0.3, semente: 7240, projeta: { dist: 1 * k, forca: 0.3 } }))

  // O SARRAFO meio enterrado, com as duas pontas quebradas.
  const sarrafo = tabuaLascada(-3 * k, 17.4 * k, -31 * k, 12.6 * k, 4.6 * k, 7250)
  L.push(P(comMeioEm(sarrafo, -14 * k, 14.6 * k), madeira, { tabua: 0, eixo: Math.atan2(-4.8, -28), bisel: 1 * k, tom: 0.88, contorno: 0.28, semente: 7251, projeta: { dist: 1.2 * k, forca: 0.32 } }))

  // Os CACOS de barro: a beira de um pote (um arco) e os pedaços, um deles com o lado de dentro à mostra.
  L.push(P(setorDeAnel(21 * k, 13 * k, 4.6 * k, 6.4 * k, 3.5, 1.9, 0), barro, { tabua: 0, bisel: 0.8 * k, tom: 1.04, contorno: 0.3, semente: 7260, projeta: { dist: 1 * k, forca: 0.3 } }))
  const cacos: readonly (readonly [readonly Ponto[], number])[] = [
    [[[26, 14.6], [31, 13], [30, 17.6], [26.8, 18.4]], 0.84],
    [[[14, 17], [17.4, 15.2], [18.6, 19], [15, 20.4]], 1],
    [[[23, 20.4], [26, 21.6], [24, 24]], 0.9],
    [[[-4, 22.6], [-0.4, 21.4], [0.8, 24.4], [-2.6, 25.6]], 0.96],
  ]
  cacos.forEach(([pontos, tom], i) => {
    L.push(P(poligono(pontos.map(([x, y]): Ponto => [x * k, y * k])), barro, { tabua: 0, bisel: 0.7 * k, tom, contorno: 0.3, semente: 7261 + i, projeta: { dist: 0.7 * k, forca: 0.26 } }))
  })

  // O TRAPO azul desbotado, caído na encosta da direita, com duas pregas e a ponta puída.
  const trapo = bolha(17 * k, -1 * k, 10.5 * k, 6.6 * k, 7270, 0.24, 0.7)
  L.push(P(trapo, TRAPO, { tabua: 0, bisel: 2 * k, ruga: 1.7, contorno: 0.26, semente: 7271, projeta: { dist: 1.2 * k, forca: 0.3, suave: 1 } }))
  for (const [i, [ax, ay, bx, by]] of ([[11, -4, 20, 1.4], [15.4, -6, 23.6, -1.6]] as const).entries()) {
    L.push(P(capsula(ax * k, ay * k, bx * k, by * k, 0.5 * k), TRAPO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.55, semente: 7272 + i }))
  }
  L.push(P(bolha(26.4 * k, 4.4 * k, 3.4 * k, 2 * k, 7274, 0.3, 0.9), TRAPO, { tabua: 0, bisel: 1 * k, ruga: 1.4, tom: 0.9, contorno: 0.26, semente: 7275 }))

  // A TÁBUA quebrada: atravessa o monte e passa da beira dele, com a ponta lascada e dois pregos.
  const [tax, tay, tbx, tby] = [3 * k, 13 * k, 36 * k, -26 * k]
  const tabua = tabuaLascada(tax, tay, tbx, tby, 6.6 * k, 7280)
  const eixo = Math.atan2(tby - tay, tbx - tax)
  cena.sombras.push({ forma: capsula(tbx - 9 * k, tby + 10.6 * k, tbx - 1.5 * k, tby + 1.8 * k, 2.6 * k), z: 0, forca: 0.26, suave: 1.6 })
  L.push(P(comMeioEm(tabua, 17 * k, -4 * k), madeira, { tabua: 0, eixo, bisel: 1.1 * k, contorno: 0.28, semente: 7281, projeta: { dist: 2.4 * k, forca: 0.36, suave: 1.1 } }))
  for (const ao of [5, 9.4]) {
    L.push(P(elipseGirada(tax + Math.cos(eixo) * ao * k + Math.sin(eixo) * 0.8 * k, tay + Math.sin(eixo) * ao * k - Math.cos(eixo) * 0.8 * k, 0.75 * k, 0.75 * k, 0), PREGO, { tabua: 0, bisel: 0.4, contorno: 0.2, semente: 7282 }))
  }

  // ---------- o SACO de estopa rasgado, tombado em cima do monte ----------
  const [sx, sy, volta] = [-9 * k, -5 * k, -0.34]
  const saco = bolha(sx, sy, 15.5 * k, 10.6 * k, 7290, 0.13, volta)
  // A caixa da sombra desce até a frente do monte: na 3/4 o saco é pintado depois dele, por cima.
  const naFrente: Forma = { b: [saco.b[0], saco.b[1], saco.b[2], monte.b[3] + 0.5], d: saco.d }
  cena.sombras.push({ forma: naFrente, z: g * ALTURA_DO_SACO, solta: true, forca: 0.26 })
  // O que vazou do rasgo: escorre do saco pela encosta, para baixo.
  const [co, si] = [Math.cos(volta), Math.sin(volta)]
  const noSaco = (ao: number, de: number): Ponto => [sx + ao * co * k - de * si * k, sy + ao * si * k + de * co * k]
  const [vx, vy] = noSaco(3.4, 12)
  L.push(P(bolha(vx, vy, 5.4 * k, 4 * k, 7291, 0.26, 0.4), VAZADO, { tabua: 0, bisel: 1.6 * k, ruga: 0.8, contorno: 0.2, alfa: 0.9, textura: texDaCalica, semente: 7292 }))
  L.push(P(bolha(vx + 3 * k, vy + 5 * k, 2.6 * k, 2 * k, 7293, 0.3), VAZADO, { tabua: 0, bisel: 0.9 * k, contorno: 0.16, alfa: 0.8, textura: texDaCalica, semente: 7294 }))
  L.push(P(saco, ESTOPA, { tabua: 0, eixo: volta, bisel: 5.4 * k, ruga: 1.5, contorno: 0.26, semente: 7295, projeta: { dist: 2.6 * k, forca: 0.38, suave: 1.4 } }))
  // A costura do lado, as dobras e o RASGO na barriga, com a estopa virada na beira dele.
  for (const [i, [a0, d0, a1, d1, r]] of ([[-11, -6.6, 9, -7.4, 0.45], [-9, 2.4, -2, 4.6, 0.5], [-6, -2.6, 2, -3.2, 0.45]] as const).entries()) {
    const [p0, p1] = [noSaco(a0, d0), noSaco(a1, d1)]
    L.push(P(comMeioEm(capsula(p0[0], p0[1], p1[0], p1[1], r * k), sx, sy), ESTOPA, { tabua: 0, bisel: 0, contorno: 0, tom: 0.68, alfa: 0.5, semente: 7296 + i }))
  }
  const rasgo = poligono([noSaco(1.4, 2.2), noSaco(4.2, 3.4), noSaco(6.4, 6), noSaco(5.4, 9.4), noSaco(3.4, 8), noSaco(2.6, 5.4)])
  L.push(P(comMeioEm(poligono([noSaco(0.6, 1.4), noSaco(4.8, 2.4), noSaco(7.6, 6), noSaco(6, 10.4), noSaco(2.4, 8.6), noSaco(1.4, 5.2)]), sx, sy), ESTOPA, { tabua: 0, bisel: 0.9 * k, tom: 1.12, contorno: 0.24, semente: 7300 }))
  L.push(P(comMeioEm(rasgo, sx, sy), BURACO, { tabua: 0, bisel: 0, contorno: 0, tom: 1.15, semente: 7301 }))
  // A BOCA amarrada: o pescoço franzido, a corda e o tufo de estopa depois do nó.
  const [fx, fy] = noSaco(-19.4, -1.6)
  L.push(P(comMeioEm(elipseGirada(fx, fy, 3.6 * k, 2.6 * k, volta + 0.3), sx, sy), ESTOPA, { tabua: 0, bisel: 1.4 * k, ruga: 1.6, tom: 1.08, contorno: 0.26, semente: 7302, projeta: { dist: 1.6 * k, forca: 0.3 } }))
  const [c0, c1] = [noSaco(-15.6, -3.6), noSaco(-15.2, 2.4)]
  L.push(P(comMeioEm(capsula(c0[0], c0[1], c1[0], c1[1], 0.85 * k), sx, sy), materialDaPeca('corda'), { tabua: 0, bisel: 0.8 * k, contorno: 0.26, semente: 7303 }))
}
