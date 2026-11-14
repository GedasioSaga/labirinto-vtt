/**
 * BOLICHE DE GRAMA de cima com volume (lote L11 dos objetos novos,
 * 14/11/2026, "Descanso e brincadeira"): o jogo de pinos de quintal, sem
 * pista, no próprio chão do mapa. Os NOVE PINOS de madeira torneada em
 * losango, a ponta virada para o sul (para quem joga); um deles, o da frente à
 * direita, CAÍDO, deitado de lado com o perfil do pino à mostra; e a BOLA de
 * madeira escura, com os três furos de pegar, rolando para os pinos.
 *
 * De cima o pino em pé é um alvo de três anéis: a barriga clara, a faixa
 * vermelha pintada no ombro dela e a cabeça clara no meio. O que diz "pino" a
 * quem não sabe é o caído (a silhueta de garrafa, com a faixa vermelha no
 * pescoço) e o losango; o que diz "boliche" é a bola com os furos.
 *
 * Na 3/4 cada pino em pé são duas colunas, a da barriga (larga e baixa, com a
 * faixa vermelha no alto) e a do pescoço (fina e alta), com a cabeça no alto
 * dela: a barriga é pintada na frente do pescoço e o pino sai torneado, e não
 * um cilindro. A barriga e a faixa vistas de cima levam a caixa puxada para o
 * sul (`naCaixa`), para sair da coluna do pescoço e subir com a da barriga. O
 * pino caído e a bola são colunas baixas. O perfil é o derivado.
 *
 * Desenhado em 1 x 1 casa; as medidas saem do menor lado e as posições, de
 * frações dele. Materiais: `madeira` (os pinos) e `bola`. A faixa vermelha é
 * fixa.
 */
import { anel, barra, dentroDe, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { BURACO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { circulo } from './tampoEmFatias'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Alturas do pino em casas: o alto da barriga e o alto da cabeça. */
const ALTURA_DA_BARRIGA = 0.17
const ALTURA_DO_PINO = 0.32
/** O raio da barriga do pino (fração do menor meio lado) e o do pescoço e da cabeça (fração do da barriga). */
const RAIO_DA_BARRIGA = 0.15
const RAIO_DO_PESCOCO = 0.5
/** A faixa vermelha pintada no ombro da barriga, de cima um anel: de onde a onde (fração do raio da barriga). */
const FAIXA_DO_OMBRO: readonly [number, number] = [0.58, 0.82]
/** O losango: meio passo entre os pinos (fração do menor meio lado) e quanto ele fica ao norte do meio. */
const PASSO_DO_LOSANGO = 0.3
const LOSANGO_AO_NORTE = 0.1
/** A bola: o raio e o meio (frações do menor meio lado). */
const RAIO_DA_BOLA = 0.24
const LUGAR_DA_BOLA: Ponto = [-0.55, 0.64]
/** O pino caído: o pé (fração do menor meio lado) e o rumo (radianos). */
const PE_DO_CAIDO: Ponto = [0.36, 0.42]
const RUMO_DO_CAIDO = 0.72

/** A faixa vermelha dos pinos: a lã vinho do Meio-Termo, um pouco mais viva (é tinta, e não pano). */
const FAIXA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('vinho', 1.18)) }

/** O pino, de pé (0) ao alto (1): o raio em cada altura, em fração do raio da barriga (a silhueta de garrafa). */
const PERFIL_DO_PINO: readonly (readonly [number, number])[] = [
  [0, 0.62],
  [0.08, 0.86],
  [0.28, 1],
  [0.46, 0.84],
  [0.6, 0.56],
  [0.7, 0.5],
  [0.8, 0.58],
  [0.92, 0.52],
  [1, 0.2],
]
/** A faixa vermelha no pino caído: de onde a onde ao longo dele. */
const FAIXA_DO_CAIDO: readonly [number, number] = [0.56, 0.7]

/** A mesma forma com outra caixa de pintura (a 3/4 lê o meio da caixa para saber com quem a peça sobe). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: f.d }
}

/**
 * Um PINO EM PÉ: as duas colunas e, de cima, a barriga, a faixa vermelha no ombro dela e a cabeça, no alto da
 * coluna do pescoço (a cabeça é a maior peça do pescoço e dá a madeira à frente dele). A barriga e a faixa levam a
 * caixa puxada para o sul: o meio delas sai do pescoço (mais alto) e elas sobem com a coluna da barriga.
 */
function montarPino(c: ContextoDoMovel, cena: Cena, x: number, y: number, R: number, semente: number): void {
  const P = c.peca
  const r = R * RAIO_DA_BARRIGA
  const rp = r * RAIO_DO_PESCOCO
  const barriga = circulo(x, y, r)
  const pescoco = circulo(x, y, rp)
  cena.sombras.push({ forma: pescoco, z: c.g * ALTURA_DO_PINO }, { forma: barriga, z: c.g * ALTURA_DA_BARRIGA }, contato(circulo(x, y, r * 1.1), 0.34))
  cena.partes.push(P(naCaixa(barriga, [x - r, y - r, x + r, y + r * 2.6]), c.m.madeira, { eixo: 0.6, tabua: 0, bisel: r * 0.75, contorno: 0.28, semente }))
  const [de, ate] = FAIXA_DO_OMBRO
  cena.partes.push(P(naCaixa(anel(x, y, r * ate, r * ate, r * de, r * de), [x - r * ate, y - r * ate, x + r * ate, y + r * (ate + 1.36)]), FAIXA, { bisel: 0.6, contorno: 0.26, semente: semente + 1 }))
  cena.partes.push(P(pescoco, c.m.madeira, { eixo: 0.6, tabua: 0, bisel: rp * 0.9, contorno: 0.26, tom: 1.08, semente: semente + 2, projeta: { dist: 0.9, forca: 0.3, suave: 0.7 } }))
}

/** A silhueta do pino deitado: do pé em (x, y) no rumo `ang`, com o comprimento `L` e o raio da barriga `r`. */
function silhuetaDoPino(x: number, y: number, ang: number, L: number, r: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const noMapa = (t: number, lado: number): Ponto => [x + co * t - si * lado, y + si * t + co * lado]
  const pontos: Ponto[] = []
  for (const [t, q] of PERFIL_DO_PINO) pontos.push(noMapa(t * L, q * r))
  for (let i = PERFIL_DO_PINO.length - 1; i >= 0; i -= 1) {
    const [t, q] = PERFIL_DO_PINO[i]
    pontos.push(noMapa(t * L, -q * r))
  }
  return poligono(pontos)
}

/** O PINO CAÍDO: a silhueta deitada, uma coluna baixa (a altura do raio), com a faixa vermelha no pescoço. */
function montarCaido(c: ContextoDoMovel, cena: Cena, R: number): void {
  const P = c.peca
  const r = R * RAIO_DA_BARRIGA
  const L = c.g * ALTURA_DO_PINO
  const [px, py] = [PE_DO_CAIDO[0] * R, PE_DO_CAIDO[1] * R]
  const pino = silhuetaDoPino(px, py, RUMO_DO_CAIDO, L, r)
  // Coluna de pouco menos que o raio: da altura do pino deitado, ele virava um caixote na 3/4.
  cena.sombras.push({ forma: pino, z: r * 0.8 }, contato(pino, 0.32))
  cena.partes.push(P(pino, c.m.madeira, { eixo: RUMO_DO_CAIDO, tabua: 0, bisel: r * 0.8, contorno: 0.28, semente: 6400 }))
  const co = Math.cos(RUMO_DO_CAIDO)
  const si = Math.sin(RUMO_DO_CAIDO)
  const [de, ate] = FAIXA_DO_CAIDO
  const faixa = barra(px + co * de * L, py + si * de * L, px + co * ate * L, py + si * ate * L, r * 2.4)
  cena.partes.push(P(dentroDe(pino, faixa), FAIXA, { eixo: RUMO_DO_CAIDO, bisel: r * 0.5, contorno: 0.26, semente: 6401 }))
  // A base cortada do pino, o disco do pé, virada para o losango.
  const base = elipse(px + co * 0.6, py + si * 0.6, r * 0.32, r * 0.58)
  cena.partes.push(P(base, c.m.madeira, { eixo: RUMO_DO_CAIDO + Math.PI / 2, tabua: 0, bisel: 0.5, contorno: 0.2, tom: 0.84, semente: 6402 }))
}

/** A BOLA: a esfera de madeira (o chanfro do raio inteiro), com os três furos de pegar. */
function montarBola(c: ContextoDoMovel, cena: Cena, R: number): void {
  const P = c.peca
  const r = R * RAIO_DA_BOLA
  const [x, y] = [LUGAR_DA_BOLA[0] * R, LUGAR_DA_BOLA[1] * R]
  const bola = circulo(x, y, r)
  // Coluna baixa, de meio raio: mais alta, a bola saía um barril na 3/4.
  cena.sombras.push({ forma: bola, z: r * 0.5 }, contato(circulo(x, y, r * 0.8), 0.36))
  cena.partes.push(P(bola, c.m.bola, { eixo: -0.5, tabua: 0, bisel: r, contorno: 0.3, semente: 6410 }))
  // Os dois furos dos dedos e o do polegar, um pouco abaixo, no lado da bola virado para a luz.
  for (const [i, [fx, fy, fr]] of ([[-0.34, -0.3, 0.15], [0.02, -0.42, 0.15], [-0.08, 0.06, 0.17]] as const).entries()) {
    cena.partes.push(P(circulo(x + fx * r, y + fy * r, fr * r), BURACO, { bisel: 0.5, contorno: 0.1, recesso: { k: 1.2, forca: 0.5 }, semente: 6411 + i }))
  }
}

export const montarBolicheDeGrama: MontarMovel = (c, cena) => {
  const R = Math.min(c.hw, c.hh)
  const a = R * PASSO_DO_LOSANGO
  const y0 = -R * LOSANGO_AO_NORTE
  montarBola(c, cena, R)
  montarCaido(c, cena, R)
  // O losango de trás para a frente; o da frente à direita (u = 1, v = 0) é o que caiu.
  let semente = 6420
  for (let soma = -2; soma <= 2; soma += 1) {
    for (let u = -1; u <= 1; u += 1) {
      const v = soma - u
      if (v < -1 || v > 1 || (u === 1 && v === 0)) continue
      montarPino(c, cena, (u - v) * a, y0 + (u + v) * a, R, semente)
      semente += 3
    }
  }
}
