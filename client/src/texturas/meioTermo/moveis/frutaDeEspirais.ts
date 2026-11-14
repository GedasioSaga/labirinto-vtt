/**
 * FRUTA DE ESPIRAIS (lote L07 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do mestre: "fruta de
 * espirais: cor trocável"). A fruta misteriosa dos piratas, com desenho próprio: o corpo redondo e liso coberto
 * de ESPIRAIS em relevo (cada uma o caracol de um gomo, a crista clara com o sulco escuro por dentro), o CABO
 * curto saindo da covinha, a GAVINHA enrolada em caracol por cima e uma FOLHA de nervura marcada.
 *
 * Vista do alto um pouco de frente, como a moeda: o cabo fica no terço de cima, não no meio, porque vista bem
 * de cima a fruta virava um disco com um ponto, e o cabo enrolado é metade do que diz "essa fruta". A 1x sobram
 * o disco de cor com as voltas claras e o risco verde da folha.
 *
 * EM PÉ na 3/4 (como a barra de ouro e a bigorna): é volume redondo que encosta no chão, e a frente varrida do
 * perfil derivado virava um tambor debaixo dela. O desenho é feito na pegada de partida (0,45 casa) e escala
 * inteiro com o menor lado. Material: `fruta` (a cor da casca, de qualquer tecido da tabela; a lã vinho de
 * partida); o cabo, a gavinha e a folha são fixos.
 */
import { cadeia, capsula, dentroDe, elipse, elipseGirada, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A pegada de partida (lado, px do protótipo) e a altura da fruta, em casas. */
const LADO_DE_PARTIDA = 0.45 * G
const ALTURA = 0.2

/** O corpo: o meio (um pouco para baixo: o cabo e a folha ocupam o alto) e os raios. */
const CORPO_Y = 1.2
const RAIO_X = 11
const RAIO_Y = 10.4
/** O chanfro largo que arredonda o corpo. */
const BISEL_DO_CORPO = 3.6

/** Cada espiral: o meio e o raio, em frações do raio do corpo, e o sentido em que enrola. */
interface Espiral {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly sentido: 1 | -1
  readonly giro: number
}

const ESPIRAIS: readonly Espiral[] = [
  { x: 0.02, y: 0.16, r: 0.34, sentido: 1, giro: 0.4 },
  { x: -0.56, y: -0.08, r: 0.3, sentido: -1, giro: 2.1 },
  { x: 0.58, y: -0.04, r: 0.3, sentido: 1, giro: 3.6 },
  { x: -0.38, y: 0.58, r: 0.28, sentido: 1, giro: 5.2 },
  { x: 0.42, y: 0.6, r: 0.28, sentido: -1, giro: 1.2 },
  { x: -0.34, y: -0.52, r: 0.22, sentido: 1, giro: 4.4 },
  { x: 0.36, y: -0.54, r: 0.22, sentido: -1, giro: 0.9 },
  { x: 0.02, y: 0.86, r: 0.2, sentido: 1, giro: 2.8 },
]
/** As voltas de cada espiral, o passo dos pontos e a grossura da crista e do sulco (px). */
const VOLTAS = 1.7
const PASSO = 0.22
const CRISTA = 0.62
const SULCO = 0.4
const TOM_DA_CRISTA = 1.34
const TOM_DO_SULCO = 0.6

/** O cabo: da covinha até a ponta, e a gavinha que enrola a partir dela. */
const COVINHA: Ponto = [0, -5]
const PONTA_DO_CABO: Ponto = [0.9, -8.2]
const MEIO_DA_GAVINHA: Ponto = [3.6, -8.4]
const RAIO_DA_GAVINHA = 2.5
const VOLTAS_DA_GAVINHA = 1.35

/** A folha: o meio, os raios e o rumo (apontando para cima à esquerda). */
const FOLHA_X = -3.9
const FOLHA_Y = -8.2
const FOLHA_RX = 4.4
const FOLHA_RY = 1.9
const RUMO_DA_FOLHA = -0.42

const CABO: MaterialDaPeca = { classe: 'madeira', rgb: [0x7a, 0x5c, 0x3c] }
const FOLHA: MaterialDaPeca = { classe: 'liso', rgb: [0x72, 0x8c, 0x4c] }
const NERVURA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0xb0, 0x6e] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf4, 0xf0, 0xe6] }
const COVA: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x2c, 0x22] }

/** A casca: lisa, com o grão miúdo e umas pintas mais claras, como a de uma fruta de verdade. */
const texDaCasca: Textura = (_u, _v, x, y, p, s) => {
  const pinta = ruido(x * 0.9 + p.su, y * 0.9 + p.sv)
  s[3] += ruido(x * 0.3 + p.sv, y * 0.3) * 0.06 + (pinta > 0.42 ? 0.05 : 0)
}

/** Os pontos de uma espiral de Arquimedes de `voltas` voltas, do miolo até o raio `r` (px). */
function espiral(cx: number, cy: number, r: number, voltas: number, sentido: 1 | -1, giro: number): Ponto[] {
  const fim = voltas * Math.PI * 2
  const pontos: Ponto[] = []
  for (let t = 0.6; t <= fim; t += PASSO) {
    const raio = (r * t) / fim
    const a = giro + sentido * t
    pontos.push([cx + raio * Math.cos(a), cy + raio * Math.sin(a)])
  }
  return pontos
}

export const montarFrutaDeEspirais: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const em = ([x, y]: Ponto): Ponto => [x * k, y * k]
  const casca = c.m.fruta
  const L = cena.partes
  const corpo = elipse(0, CORPO_Y * k, RAIO_X * k, RAIO_Y * k)
  const raio = Math.min(RAIO_X, RAIO_Y) * k

  cena.sombras.push({ forma: corpo, z: c.g * ALTURA * k, forca: 0.26 }, contato(elipse(0, (CORPO_Y + 1) * k, (RAIO_X - 0.6) * k, (RAIO_Y - 0.8) * k), 0.34))

  L.push(P(corpo, { classe: 'liso', rgb: casca.rgb }, { bisel: BISEL_DO_CORPO * k, contorno: 0.3, tabua: 0, textura: texDaCasca, semente: 7201 }))
  // As espirais: o sulco escuro por dentro da volta e a crista clara por cima, só dentro do corpo.
  const dentro: Forma = elipse(0, CORPO_Y * k, (RAIO_X - 0.5) * k, (RAIO_Y - 0.5) * k)
  const relevo: MaterialDaPeca = { classe: 'liso', rgb: casca.rgb }
  ESPIRAIS.forEach((e, i) => {
    const cx = e.x * RAIO_X * k
    const cy = (CORPO_Y + e.y * RAIO_Y) * k
    const r = e.r * raio
    L.push(P(dentroDe(cadeia(espiral(cx, cy, r * 0.86, VOLTAS, e.sentido, e.giro + 0.5 * e.sentido), SULCO * k), dentro), relevo, { bisel: 0.2 * k, contorno: 0, tom: TOM_DO_SULCO, alfa: 0.9, semente: 7210 + i }))
    L.push(P(dentroDe(cadeia(espiral(cx, cy, r, VOLTAS, e.sentido, e.giro), CRISTA * k), dentro), relevo, { bisel: 0.55 * k, contorno: 0.12, tom: TOM_DA_CRISTA, semente: 7220 + i }))
  })
  // O brilho grande da casca lisa, para cima à esquerda, e o reflexo pequeno embaixo à direita.
  L.push(P(elipseGirada(-4.6 * k, (CORPO_Y - 4.4) * k, 3.6 * k, 2.2 * k, -0.6), BRILHO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 1.4 * k }))
  L.push(P(elipse(5.4 * k, (CORPO_Y + 5.6) * k, 1.1 * k, 0.7 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.22, suave: 0.6 * k }))

  // A covinha, o cabo, a gavinha enrolada e a folha.
  L.push(P(elipse(...em(COVINHA), 2.2 * k, 1.5 * k), COVA, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.9 * k }))
  const sombraDoCabo = { dist: 0.9 * k, forca: 0.34, suave: 0.5 * k }
  L.push(P(elipseGirada(FOLHA_X * k, FOLHA_Y * k, FOLHA_RX * k, FOLHA_RY * k, RUMO_DA_FOLHA), FOLHA, { bisel: 0.8 * k, contorno: 0.28, projeta: sombraDoCabo, semente: 7230 }))
  const [fx, fy] = [Math.cos(RUMO_DA_FOLHA), Math.sin(RUMO_DA_FOLHA)]
  L.push(P(capsula((FOLHA_X - fx * 3.6) * k, (FOLHA_Y - fy * 3.6) * k, (FOLHA_X + fx * 3.2) * k, (FOLHA_Y + fy * 3.2) * k, 0.28 * k), NERVURA, { bisel: 0, contorno: 0, alfa: 0.8, semente: 7231 }))
  L.push(P(capsula(...em(COVINHA), ...em(PONTA_DO_CABO), 0.95 * k), CABO, { tabua: 0, bisel: 0.7 * k, contorno: 0.3, eixo: -1.3, projeta: sombraDoCabo, semente: 7232 }))
  // A gavinha começa na ponta do cabo e enrola para dentro, por cima da fruta.
  const [gx, gy] = em(MEIO_DA_GAVINHA)
  const [px, py] = em(PONTA_DO_CABO)
  const inicio = Math.atan2(py - gy, px - gx)
  const pontos: Ponto[] = []
  const fim = VOLTAS_DA_GAVINHA * Math.PI * 2
  for (let t = 0; t <= fim; t += PASSO) {
    const r = RAIO_DA_GAVINHA * k * (1 - (0.75 * t) / fim)
    pontos.push([gx + r * Math.cos(inicio + t), gy + r * Math.sin(inicio + t)])
  }
  L.push(P(cadeia(pontos, 0.5 * k), CABO, { tabua: 0, bisel: 0.4 * k, contorno: 0.3, tom: 1.12, projeta: sombraDoCabo, semente: 7233 }))
}
