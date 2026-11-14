/**
 * CONCHA MÁGICA de cima com volume (lote L08 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do mestre:
 * "concha mágica (guarda vento, luz ou som)"). A concha das ilhas do céu que guarda o que se põe nela, com
 * desenho próprio: um BÚZIO deitado de boca para cima, a ponta da ESPIRAL para a esquerda (as voltas marcadas
 * pelo sulco e o BOTÃO polido na ponta, onde se aperta para soltar o que está guardado), os NÓS em ponta no
 * ombro, o CANAL fino à direita e a ASA larga do lábio de fora embaixo. A BOCA comprida é de madrepérola rosada,
 * com a COLUMELA lisa e as dobras em cima; lá no fundo, a LUZ fria do que está guardado, com três faíscas.
 *
 * A 25% de zoom sobra a gota creme com a fenda rosa e o ponto de luz: é o que diz "concha" e não "caracol" (o
 * caracol-telefone é um domo redondo de espiral chata, com o corpo e os olhos; o búzio é comprido, em ponta, e
 * mostra a boca). A luz é só pintada: a concha não ilumina o mapa.
 *
 * Na 3/4 fica como de cima, com a sombra de baixo (EM_PE, como a fruta): é volume redondo que encosta no chão. O
 * desenho é feito na pegada de partida (0,5 x 0,4 casa) e escala inteiro com o menor lado. Sem material: a
 * casca, a madrepérola e a luz são fixas.
 */
import { cadeia, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A pegada de partida (px do protótipo) e a altura da concha, em casas. */
const LARGURA_DE_PARTIDA = 0.5 * G
const FUNDO_DE_PARTIDA = 0.4 * G
const ALTURA = 0.16

/** A ponta da espiral (o botão) e as três voltas da espiral até o corpo: o meio e o raio de cada uma. */
const PONTA: Ponto = [-13, -2.8]
const VOLTAS: readonly (readonly [number, number, number])[] = [
  [-11.2, -2.6, 2.1],
  [-8.6, -2.3, 3.2],
  [-5.4, -1.9, 4.6],
]
/** Os nós do ombro: o x de cada um, ao longo da beira de cima do corpo. */
const NOS: readonly number[] = [-3.2, 0.8, 4.6, 8]

const CASCA: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xca, 0xaa] }
const FAIXA: readonly [number, number, number] = [0x9c, 0x74, 0x52]
const PEROLA: MaterialDaPeca = { classe: 'liso', rgb: [0xde, 0xb4, 0xa8] }
const FUNDO_DA_BOCA: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x7c, 0x78] }
const COLUMELA: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xd4, 0xc6] }
const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x55, 0x40] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf8, 0xf4, 0xec] }
/** A luz guardada: um verde-água claro, frio, que não pega sombra. */
const LUZ_GUARDADA: MaterialDaPeca = { classe: 'liso', rgb: [0xb6, 0xe6, 0xe2] }
/** A força da luz no miolo (emissão) e o expoente com que ela some até a beira (1 = em linha reta). */
const EMISSAO_DA_LUZ = 0.9
const QUEDA_DA_LUZ = 1.3

/** As faixas da casca: a partir de quanto a onda vira faixa marrom e o quanto ela cobre. */
const LIMIAR_DA_FAIXA = 0.35
const FAIXA_CHEIA = 0.5

/**
 * A casca: o grão, e as faixas onduladas que seguem as voltas (em arco em volta da ponta, que fica em (px, py) na
 * pegada; `k` é a escala do desenho, para as faixas terem a mesma largura em qualquer tamanho).
 */
function texDaCasca(px: number, py: number, k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    s[3] += ruido(x * 0.7 + p.su, y * 0.7 + p.sv) * 0.06
    const r = Math.hypot(x - px, y - py) / k
    const onda = Math.sin(r * 1.5 + ruido(x * 0.25 + p.sv, y * 0.25) * 3)
    if (onda <= LIMIAR_DA_FAIXA) return
    const t = Math.min(1, (onda - LIMIAR_DA_FAIXA) / 0.4) * FAIXA_CHEIA
    s[0] += (FAIXA[0] - s[0]) * t
    s[1] += (FAIXA[1] - s[1]) * t
    s[2] += (FAIXA[2] - s[2]) * t
  }
}

/** A madrepérola: o furta-cor leve, em ondas. */
const texDaPerola: Textura = (_u, _v, x, y, p, s) => {
  s[3] += Math.sin((x + y) * 0.9 + ruido(x * 0.4 + p.su, y * 0.4) * 5) * 0.06 + ruido(x * 0.9, y * 0.9 + p.sv) * 0.04
}

/** A luz do fundo da boca: forte no meio, some até a beira; é emissão, não pega a luz nem a sombra. */
function texDaLuz(cx: number, cy: number, rx: number, ry: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
    const forca = Math.max(0, 1 - d)
    s[4] = EMISSAO_DA_LUZ
    s[5] *= forca ** QUEDA_DA_LUZ
  }
}

/** Uma faísca de quatro pontas em (cx, cy), de raio `r`. */
function faisca(cx: number, cy: number, r: number): Forma {
  const f = r * 0.28
  return poligono([[cx, cy - r], [cx + f, cy - f], [cx + r, cy], [cx + f, cy + f], [cx, cy + r], [cx - f, cy + f], [cx - r, cy], [cx - f, cy - f]])
}

export const montarConchaMagica: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  const em = (x: number, y: number): Ponto => [x * k, y * k]
  const L = cena.partes
  const daCasca = texDaCasca(PONTA[0] * k, PONTA[1] * k, k)

  // O corpo, a asa do lábio, a espiral em cone e o canal: uma casca só.
  const corpo = elipse(...em(1, -1), 9.6 * k, 7 * k)
  const asa = elipseGirada(...em(3.4, 3.8), 9.6 * k, 4.8 * k, -0.1)
  const cone = poligono([em(-5, -6.8), em(-13.4, -3.4), em(-13.4, -2), em(-5, 3.6)])
  const canal = capsula(...em(9, 1.6), ...em(13.2, 3.6), 1.6 * k)
  const casca = uniao(uniao(corpo, asa), uniao(cone, canal))
  cena.sombras.push({ forma: casca, z: c.g * ALTURA * k, forca: 0.26 }, contato(elipse(...em(1, 1), 10 * k, 6.4 * k), 0.34))
  L.push(P(casca, CASCA, { bisel: 2.6 * k, contorno: 0.3, textura: daCasca, semente: 8701 }))

  // As voltas da espiral: cada uma um calombo com o sulco escuro na frente, da maior para a menor.
  for (let i = VOLTAS.length - 1; i >= 0; i -= 1) {
    const [x, y, r] = VOLTAS[i]
    const volta = elipse(...em(x, y), r * k, r * 0.92 * k)
    L.push(P(volta, CASCA, { bisel: r * 0.5 * k, contorno: 0.24, tom: 1.04 - i * 0.03, textura: daCasca, semente: 8710 + i }))
    L.push(P(dentroDe(menos(elipse(...em(x + r * 0.32, y), r * 1.02 * k, r * 0.98 * k), elipse(...em(x + r * 0.5, y), r * 0.96 * k, r * 0.98 * k)), casca), SULCO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.3 * k, semente: 8715 + i }))
  }
  // O botão polido na ponta.
  L.push(P(elipse(...em(PONTA[0], PONTA[1]), 1.5 * k, 1.4 * k), COLUMELA, { bisel: 0.8 * k, contorno: 0.3, tom: 1.02, semente: 8720 }))

  // Os nós em ponta no ombro, para cima e para a esquerda.
  NOS.forEach((x, i) => {
    const yBeira = -1 - 7 * Math.sqrt(Math.max(0, 1 - ((x - 1) / 9.6) ** 2))
    const no = poligono([em(x - 1.5, yBeira + 1.6), em(x - 0.6, yBeira - 2.1 + i * 0.2), em(x + 1.5, yBeira + 1.6)])
    L.push(P(no, CASCA, { bisel: 0.7 * k, contorno: 0.28, tom: 1.08, textura: daCasca, projeta: { dist: 0.7 * k, forca: 0.3 }, semente: 8722 + i }))
  })

  // A boca: a madrepérola, o fundo mais escuro e a luz guardada lá dentro.
  const boca = poligono([em(-4.2, 0.4), em(0, -1.6), em(6, -1.2), em(10.6, 1), em(11.6, 2.6), em(7, 3.6), em(0, 4.2), em(-3.6, 2.6)])
  L.push(P(boca, PEROLA, { bisel: 1.4 * k, contorno: 0.3, textura: texDaPerola, recesso: { k: 1.4 * k, forca: 0.34 }, semente: 8730 }))
  const fundo = elipseGirada(...em(2.6, 1.4), 5.4 * k, 1.5 * k, 0.04)
  L.push(P(fundo, FUNDO_DA_BOCA, { bisel: 0.8 * k, contorno: 0, alfa: 0.85, suave: 0.8 * k, recesso: { k: 0.8 * k, forca: 0.3 }, semente: 8731 }))
  const [lx, ly] = em(1.4, 1.4)
  L.push(P(elipse(lx, ly, 6.4 * k, 2.9 * k), LUZ_GUARDADA, { bisel: 0, contorno: 0, textura: texDaLuz(lx, ly, 6.4 * k, 2.9 * k), semente: 8732 }))
  L.push(P(elipse(lx, ly, 2.6 * k, 1.2 * k), BRILHO, { bisel: 0, contorno: 0, textura: texDaLuz(lx, ly, 2.6 * k, 1.2 * k), semente: 8737 }))
  // A columela lisa em cima da boca, com as três dobras, e o lábio de fora, grosso, embaixo.
  L.push(P(cadeia([em(-4, 0), em(0, -1.6), em(6, -1.3), em(10.4, 0.8)], 0.6 * k), COLUMELA, { bisel: 0.7 * k, contorno: 0.24, projeta: { dist: 0.6 * k, forca: 0.26 }, semente: 8733 }))
  for (let i = 0; i < 3; i += 1) {
    const x = -1.6 + i * 1.7
    L.push(P(capsula(...em(x, -0.6), ...em(x + 0.5, 0.5), 0.3 * k), SULCO, { bisel: 0, contorno: 0, alfa: 0.35, semente: 8734 + i }))
  }
  L.push(P(cadeia([em(-3.6, 2.8), em(0, 4.5), em(7, 3.9), em(11.8, 2.8)], 1 * k), CASCA, { bisel: 0.8 * k, contorno: 0.26, tom: 1.12, textura: daCasca, semente: 8738 }))

  // As faíscas da luz guardada e o brilho da casca lisa no alto à esquerda.
  for (const [i, [x, y, r]] of ([[3.2, 0.6, 1.6], [6.8, 2, 1.1], [-0.6, 2.2, 0.9]] as const).entries()) {
    const [fx, fy] = em(x, y)
    L.push(P(faisca(fx, fy, r * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.9, textura: texDaLuz(fx, fy, r * k * 1.4, r * k * 1.4), semente: 8740 + i }))
  }
  L.push(P(elipseGirada(...em(-2, -5), 3.6 * k, 1.2 * k, -0.2), BRILHO, { bisel: 0, contorno: 0, alfa: 0.36, suave: 0.9 * k, semente: 8745 }))
}
