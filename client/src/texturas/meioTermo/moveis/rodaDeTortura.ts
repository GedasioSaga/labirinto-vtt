/**
 * RODA DE TORTURA de cima com volume (lote L03 de 24/11/2026, Tortura e fogo;
 * desenho ORIGINAL, só a ideia do objeto dos mapas de referência): a roda
 * grande de carroção deitada no alto de um EIXO, onde o preso é amarrado de
 * braços e pernas abertos. VAZIA: o mestre põe o token em cima. O ARO grosso
 * de madeira em oito cambotas, oito RAIOS torneados e o CUBO com a tampa de
 * ferro; no aro, os CRAVOS de ferro em pirâmide e quatro TIRAS DE COURO
 * afiveladas (dois pulsos, dois tornozelos), com a ponta solta. Debaixo, a
 * CRUZETA de vigas do pé, que aparece nos vãos entre os raios.
 *
 * Do alto, o que diz "erguida" é a SOMBRA: a da roda cai longe, para baixo à
 * direita, e aparece inteira nos vãos entre os raios. O cubo está gasto e mais
 * claro. Nada de gente, de sangue ou de mancha.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): a roda é um tampo solto na altura do
 * eixo, com a beirada `ESPESSURA_DA_RODA_DE_TORTURA` (o perfil do tipo tem de
 * trazer: `{ modo: 'derivado', espessura: ESPESSURA_DA_RODA_DE_TORTURA }`); o
 * eixo é uma coluna no meio e a cruzeta fica no chão (a caixa de cada viga é
 * centrada num vão, fora da roda). Nada lê o giro: a roda é igual dos quatro
 * lados.
 *
 * A 25% de zoom sobram o aro claro, a estrela dos raios e os quatro riscos
 * escuros do couro: é o que diz "roda de tortura", e não mesa redonda, poço ou
 * roda de carroça largada. Materiais: `madeira` e `ferragens`. O couro é fixo.
 * Tudo sai do menor lado da pegada (2 x 2 casas de partida).
 */
import { hash, type Rgb } from '../../ruido'
import { anel, barra, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './andaimeDaTresQuartos'

/** A roda foi medida no tamanho de partida (2 casas, 56 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = G
/** A altura da roda em casas (a do eixo) e a grossura dela na 3/4 (px do protótipo). */
const ALTURA = 0.34
export const ESPESSURA_DA_RODA_DE_TORTURA = 0.11 * G

/** O aro, em fração do meio lado: por fora e por dentro; o cubo e a tampa de ferro dele (px de partida). */
const ARO_DE_FORA = 0.9
const ARO_DE_DENTRO = 0.735
const RAIO_DO_CUBO = 9.6
const RAIO_DA_TAMPA = 4.6
/** Os raios: quantos e a largura (px de partida). */
const RAIOS = 8
const LARGURA_DO_RAIO = 5
/** Os cravos: quantos em volta do aro e o tamanho (px de partida). */
const CRAVOS = 16
const RAIO_DO_CRAVO = 1.75
/** As tiras de couro: o ângulo de cada uma (graus, 0 = a direita, 90 = a frente) e a largura (px de partida). */
const TIRAS: readonly number[] = [-146, -34, 56, 124]
const LARGURA_DA_TIRA = 4
/** A algema de couro de cada tira: o raio de fora do laço (px de partida). */
const RAIO_DA_ALGEMA = 5.6
/** A cruzeta do pé: o meio comprimento (fração do meio lado) e a largura das vigas (px de partida). */
const CRUZETA = 0.74
const LARGURA_DA_VIGA = 7

const TOM_DO_ARO = 1
const TOM_DO_RAIO = 0.94
const TOM_DO_CUBO = 1.1
const TOM_DA_CRUZETA = 0.62
const TOM_DO_CRAVO = 1.2
const BRILHO_DO_FERRO = 0.36
const ESCURO_DA_MADEIRA: Rgb = [0x4f, 0x3b, 0x2c]
const GRAUS = Math.PI / 180

/** O couro das tiras, o latão das fivelas e o escuro das emendas do aro. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x45, 0x33] }
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x8a, 0x58] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x2b, 0x26] }

export const montarRodaDeTortura: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const madeira = c.m.madeira
  const ferro = c.m.ferragens
  const L = cena.partes
  const altura = 2 * R * ALTURA
  cena.corDoPiso = ESCURO_DA_MADEIRA
  const em = (graus: number, f: number): Ponto => [Math.cos(graus * GRAUS) * f * hw, Math.sin(graus * GRAUS) * f * hh]
  const daMadeira = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 1.4 * k, contorno: 0.3, semente, ...mais })
  const sombraMiuda = { dist: 1 * k, forca: 0.3 }

  // ---------- as formas da roda: o aro, os raios e o cubo ----------
  const aro = anel(0, 0, ARO_DE_FORA * hw, ARO_DE_FORA * hh, ARO_DE_DENTRO * hw, ARO_DE_DENTRO * hh)
  const cubo = elipse(0, 0, RAIO_DO_CUBO * k, RAIO_DO_CUBO * k)
  const raios: { forma: Forma; angulo: number }[] = []
  for (let i = 0; i < RAIOS; i += 1) {
    const graus = (i * 360) / RAIOS + 22.5
    const [ax, ay] = em(graus, 0.12)
    const [bx, by] = em(graus, ARO_DE_DENTRO + 0.02)
    raios.push({ forma: barra(ax, ay, bx, by, LARGURA_DO_RAIO * k), angulo: Math.atan2(by - ay, bx - ax) })
  }
  const roda = raios.reduce((f, r) => uniao(f, r.forma), uniao(aro, cubo))

  // ---------- as sombras: a roda no ar (longe, para baixo à direita), o eixo e a cruzeta no chão ----------
  const eixo = elipse(0, 0, 4.6 * k, 4.6 * k)
  const vigas = [45, 135].map((graus) => {
    const [ax, ay] = em(graus, CRUZETA)
    return barra(-ax, -ay, ax, ay, LARGURA_DA_VIGA * k)
  })
  cena.sombras.push(contato(uniao(vigas[0], vigas[1]), 0.32))
  cena.sombras.push({ forma: eixo, z: altura - ESPESSURA_DA_RODA_DE_TORTURA, forca: 0.26 })
  cena.sombras.push({ forma: roda, z: altura, solta: true, forca: 0.3 })

  // ---------- no chão: a cruzeta do pé (a caixa de cada viga centrada num vão, para não subir com a roda) ----------
  const [vx, vy] = em(0, 0.42)
  vigas.forEach((viga, i) => {
    L.push(P(comMeioEm(viga, vx, vy), madeira, daMadeira(25201 + i, { eixo: (45 + 90 * i) * GRAUS, tom: TOM_DA_CRUZETA, bisel: 1.6 * k })))
  })
  for (const graus of [45, 135, 225, 315]) {
    const [px, py] = em(graus, CRUZETA - 0.05)
    L.push(P(comMeioEm(elipse(px, py, 1.5 * k, 1.5 * k), vx, vy), ferro, { tabua: 0, bisel: 1.2 * k, contorno: 0.26, tom: 1.1, metal: BRILHO_DO_FERRO, semente: 25205 + graus }))
  }

  // ---------- a roda: os raios, o aro (o veio pelo arco) com as emendas das cambotas, e o cubo ----------
  raios.forEach((raio, i) => {
    L.push(P(raio.forma, madeira, daMadeira(25210 + i, { eixo: raio.angulo, tom: TOM_DO_RAIO + 0.06 * hash(i, 1, 25210), bisel: LARGURA_DO_RAIO * k * 0.42, projeta: { dist: 5 * k, forca: 0.22, suave: 2.6 * k } })))
  })
  const meioDoAro = ((ARO_DE_FORA + ARO_DE_DENTRO) / 2) * R
  L.push(P(aro, madeira, daMadeira(25220, { arco: { cx: 0, cy: 0, r: meioDoAro, a0: 0 }, tom: TOM_DO_ARO, bisel: 2 * k, projeta: { dist: 5 * k, forca: 0.22, suave: 2.6 * k } })))
  for (let i = 0; i < RAIOS; i += 1) {
    const [ax, ay] = em((i * 360) / RAIOS, ARO_DE_DENTRO + 0.012)
    const [bx, by] = em((i * 360) / RAIOS, ARO_DE_FORA - 0.012)
    L.push(P(capsula(ax, ay, bx, by, 0.34 * k), VAO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 25230 + i }))
  }
  L.push(P(cubo, madeira, daMadeira(25240, { polar: { cx: 0, cy: 0, r: RAIO_DO_CUBO * k }, tom: TOM_DO_CUBO, bisel: 3 * k, projeta: { dist: 1.6 * k, forca: 0.3 } })))
  L.push(P(elipse(0, 0, RAIO_DA_TAMPA * k, RAIO_DA_TAMPA * k), ferro, { tabua: 0, bisel: 1.6 * k, contorno: 0.3, tom: 1.04, metal: BRILHO_DO_FERRO, semente: 25241, projeta: sombraMiuda }))
  L.push(P(elipse(0, 0, 1.7 * k, 1.7 * k), ferro, { tabua: 0, bisel: 1.4 * k, contorno: 0.24, tom: 1.3, metal: 0.5, semente: 25242 }))

  // ---------- os cravos de ferro em pirâmide, em volta do aro (nenhum debaixo de uma tira) ----------
  const raioDosCravos = (ARO_DE_FORA + ARO_DE_DENTRO) / 2
  for (let i = 0; i < CRAVOS; i += 1) {
    const graus = ((i + 0.5) * 360) / CRAVOS
    if (TIRAS.some((tira) => Math.abs(((graus - tira + 540) % 360) - 180) < 11)) continue
    const [x, y] = em(graus, raioDosCravos)
    const r = RAIO_DO_CRAVO * k
    L.push(P(poligono([[x - r, y], [x, y - r], [x + r, y], [x, y + r]]), ferro, { tabua: 0, bisel: r * 0.95, contorno: 0.26, tom: TOM_DO_CRAVO, metal: 0.5, semente: 25250 + i, projeta: { dist: 0.8 * k, forca: 0.3 } }))
  }

  // ---------- as tiras de couro: a volta que abraça o aro e, por cima dele, a ALGEMA aberta com a fivela ----------
  TIRAS.forEach((graus, i) => {
    const [ax, ay] = em(graus, ARO_DE_DENTRO - 0.022)
    const [bx, by] = em(graus, ARO_DE_FORA + 0.022)
    L.push(P(barra(ax, ay, bx, by, LARGURA_DA_TIRA * k), COURO, { tabua: 0, bisel: 0.9 * k, contorno: 0.32, tom: 0.86, semente: 25260 + i, projeta: sombraMiuda }))
    // A algema: o laço de couro deitado no aro, onde entra o pulso ou o tornozelo.
    const [fx, fy] = em(graus, raioDosCravos)
    const fora = RAIO_DA_ALGEMA * k
    L.push(P(anel(fx, fy, fora, fora, fora * 0.6, fora * 0.6), COURO, { tabua: 0, bisel: 1 * k, contorno: 0.32, tom: 1.3 + 0.08 * hash(i, 2, 25260), semente: 25264 + i, projeta: { dist: 1.3 * k, forca: 0.34 } }))
    // A fivela de latão, do lado de fora da roda.
    const [lx, ly] = em(graus, raioDosCravos + (fora * 0.8) / R)
    const lado = 2.3 * k
    const fivela = uniao(anel(lx, ly, lado, lado, lado * 0.5, lado * 0.5), capsula(lx - lado * 0.6, ly, lx + lado * 0.6, ly, 0.4 * k))
    L.push(P(fivela, LATAO, { tabua: 0, bisel: 0.7 * k, contorno: 0.3, metal: 0.5, semente: 25268 + i, projeta: sombraMiuda }))
  })
}
