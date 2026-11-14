/**
 * SILO de cima com volume (lote L18 dos objetos e construções de 14/11/2026, construção do grupo Torres e
 * prédios): o silo de grãos de fazenda. A PAREDE redonda de alvenaria (o barro dá o tijolo), cintada por quatro
 * AROS de ferro, com a CÚPULA de chapa em gomos por cima, o RESPIRO no alto, a ESCADA DE MARINHEIRO subindo pela
 * frente até a beira e seguindo pela cúpula até o ALÇAPÃO, e a PORTINHA de madeira no pé (frente à esquerda), com
 * o degrau de pedra e dois SACOS de grão encostados, um deles derramando.
 *
 * De cima: a borda de tijolo em volta da cúpula cinza de gomos (mais clara do lado da luz), a escada riscando a
 * cúpula da beira ao alçapão, o respiro no meio, a escada de fora saindo da parede, os sacos e a SOMBRA comprida
 * para baixo à direita. É a cúpula de chapa com a escada que diz "silo" e não torre de pedra (ameias) nem moinho
 * (cone de tábuas).
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DO_SILO`, a espessura do perfil):
 * - a parede é uma coluna só, com a borda de tijolo como peça dela (o meio da caixa da borda fica na beira da
 *   frente, fora da cúpula);
 * - cada ARO é um tampo raso só na metade da frente NA TELA (o de trás riscaria a parede), um tico mais largo que
 *   o de cima: o pingo de ferro de cada um fica nesse tico, onde nenhum aro mais alto alcança;
 * - a PORTA é uma coluna que sai um tico da parede, com a chapa de ferro nesse tico, e a caixa esticada até a frente da
 *   parede NA TELA (sai depois dela);
 * - a CÚPULA são seis tampos em degrau, do mais largo ao mais estreito, cada um com os gomos e o trecho da escada
 *   dele, a caixa esticada para a frente NA TELA (saem depois da parede e dos aros, de baixo para cima);
 * - a ESCADA de fora: os dois banzos são colunas e cada degrau um tampo raso, um tico mais fundo que o de cima
 *   (o pingo de ferro do degrau fica nesse tico).
 * Por isso o desenho lê `c.giro`. A parede enche a pegada (elipse, como o moinho); as alturas são em casas.
 * Materiais: `pedra` (a parede) e `telhado` (a cúpula). O ferro dos aros e da escada, a chapa da porta, os sacos
 * e o grão são fixos.
 *
 * PEGADA SÓLIDA: a elipse da parede, `PAREDE` do meio lado (0,84) em cada eixo.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Sombra } from './motor'
import { BURACO, G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** A beirada de cada tampo do silo (px do protótipo): a largura dos aros, dos degraus e de cada degrau da cúpula. */
export const ESPESSURA_DO_SILO = 0.05 * G

/** A parede em fração do meio lado (em cada eixo): a pegada sólida. */
const PAREDE = 0.84
/** A borda de tijolo que aparece em volta da cúpula (px, na escala da pegada de partida). */
const BORDA = 3.5
/** Alturas em casas: a parede, o quanto a cúpula sobe acima dela, os aros e a porta. */
const ALTURA_DA_PAREDE = 3
const ALTURA_DA_CUPULA = 0.62
const AROS: readonly number[] = [0.98, 1.56, 2.14, 2.7]
const ALTURA_DA_PORTA = 0.74
/** Os degraus da cúpula, em fração do raio dela, do mais largo ao mais estreito. */
const CAMADAS_DA_CUPULA: readonly number[] = [1, 0.9, 0.76, 0.6, 0.42, 0.22]
const GOMOS = 12
/** A porta: o ângulo (frente à esquerda) e a meia abertura (rad). */
const PORTA_EM = 1.2
const MEIA_PORTA = 0.2
/** A escada de fora (px na escala de partida): a meia largura, o quanto fica longe da parede, o passo dos degraus. */
const MEIA_ESCADA = 5.5
const ESCADA_LONGE = 4.6
const RAIO_DO_BANZO = 1.1
const PASSO_DO_DEGRAU = 0.14 * G
/** O quanto a escada passa da beira da parede (casas): o corrimão da chegada. */
const ESCADA_ACIMA = 0.22
/** O alçapão da cúpula (fração do raio dela) e o respiro no alto (raio em fração do raio da cúpula). */
const ALCAPAO_EM = 0.34
const RAIO_DO_RESPIRO = 0.13
/** A luz vem de cima à esquerda NA TELA: o ângulo dela e o quanto clareia o gomo virado para ela. */
const ANGULO_DA_LUZ = (-3 * Math.PI) / 4
const LUZ_DOS_GOMOS = 0.13

const FERRO = materialDaPeca('ferro')
/** A porta é de chapa, como os aros: de madeira ela sumia no barro da parede. */
const PORTA = FERRO
const DEGRAU = materialDaPeca('granito')
const SACO = materialDaPeca('linho')
const GRAO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xa6, 0x6a] }

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** A mesma forma com a caixa esticada até `ate` px do centro, do lado que fica embaixo NA TELA (sai depois). */
function esticadaParaAFrente(forma: Forma, ate: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Caixa =
    dx > 0.5 ? [x0, y0, Math.max(x1, ate), y1] : dx < -0.5 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** Só a parte da forma abaixo de `corte` NA TELA (a metade da frente de um anel: a de trás some atrás da parede). */
function soNaFrente(forma: Forma, corte: number, quartos: number): Forma {
  return { b: forma.b, d: (x, y) => Math.max(forma.d(x, y), corte - naTela(x, y, quartos)[1]) }
}

export const montarSiloDeGraos: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.hw, c.hh) / G
  const [rx, ry] = [c.hw * PAREDE, c.hh * PAREDE]
  const maior = Math.max(rx, ry)
  const e = ESPESSURA_DO_SILO
  const pedra = c.m.pedra
  const telhado = c.m.telhado
  const brilho = telhado.classe === 'metal' ? 0.32 : 0
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  const S = cena.sombras
  const zParede = ALTURA_DA_PAREDE * c.g
  const solta = (forma: Forma, z: number): Sombra => ({ forma, z, solta: true, forca: 0 })
  /** Um ponto da elipse da parede afastada `d` px, no ângulo `a`. */
  const naParede = (a: number, d: number): Ponto => [Math.cos(a) * (rx + d), Math.sin(a) * (ry + d)]
  /** O ângulo, NA TELA, de uma direção do desenho: é por ele que a luz cai nos gomos em qualquer giro. */
  const anguloNaTela = (a: number): number => {
    const [x, y] = naTela(Math.cos(a), Math.sin(a), quartos)
    return Math.atan2(y, x)
  }

  // ---------- as sombras: o contato da parede (a coluna dela faz a sombra comprida) ----------
  const parede = elipse(0, 0, rx, ry)
  S.push(contato(elipse(0, 0, rx + 1, ry + 1), 0.36), { forma: parede, z: zParede, forca: 0.34 })

  // ---------- no chão: o degrau da porta, os sacos e o grão derramado ----------
  const [px, py] = naParede(PORTA_EM, 7 * k)
  L.push(P(caixa(px - 9 * k, py - 3 * k, px + 9 * k, py + 4 * k, 1.4 * k), DEGRAU, { bisel: 1.2 * k, contorno: 0.28, tom: 0.92, semente: 18300 }))
  const [sx, sy] = [c.hw * 0.74, c.hh * 0.78]
  const sacoEmPe = elipse(sx, sy, 8.5 * k, 8 * k)
  S.push(contato(sacoEmPe, 0.32), { forma: sacoEmPe, z: 0.32 * c.g, forca: 0.26 })
  L.push(P(sacoEmPe, SACO, { tabua: 0, bisel: 4 * k, contorno: 0.3, tom: 0.9, ruga: 0.5, semente: 18301 }))
  L.push(P(elipse(sx + 0.6 * k, sy - 0.6 * k, 3 * k, 2.6 * k), SACO, { tabua: 0, bisel: 1.4 * k, contorno: 0.32, tom: 0.78, ruga: 0.6, projeta: { dist: 1, forca: 0.3 }, semente: 18302 }))
  L.push(P(capsula(sx - 1.2 * k, sy - 2 * k, sx + 2.4 * k, sy + 0.8 * k, 0.9 * k), materialDaPeca('corda'), { tabua: 0, bisel: 0.6, contorno: 0.3, semente: 18303 }))
  // O saco deitado, com a boca aberta para a direita derramando o grão.
  const [dx0, dy0] = [-c.hw * 0.62, c.hh * 0.92]
  const deitado = poligono([[dx0 - 11 * k, dy0 - 5 * k], [dx0 + 6 * k, dy0 - 6 * k], [dx0 + 10 * k, dy0 - 1 * k], [dx0 + 6 * k, dy0 + 4.5 * k], [dx0 - 11 * k, dy0 + 4.5 * k]])
  S.push(contato(deitado, 0.3), { forma: deitado, z: 0.2 * c.g, forca: 0.24 })
  for (let i = 0; i < 26; i += 1) {
    const t = hash(i, 1, 18310)
    const [gx, gy] = [dx0 + 10 * k + t * 14 * k, dy0 - 1 * k + (hash(i, 2, 18310) - 0.5) * (4 + 8 * t) * k]
    L.push(P(elipse(gx, gy, 1.1 * k, 0.8 * k), GRAO, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.85 + 0.3 * hash(i, 3, 18310), semente: 18311 + i }))
  }
  L.push(P(deitado, SACO, { tabua: 0, bisel: 3 * k, contorno: 0.3, tom: 0.94, ruga: 0.5, eixo: 0, semente: 18340 }))
  L.push(P(elipse(dx0 + 8.5 * k, dy0 - 0.7 * k, 2.4 * k, 4.2 * k), GRAO, { tabua: 0, bisel: 1, contorno: 0.3, tom: 0.9, recesso: { k: 1, forca: 0.3 }, semente: 18341 }))

  // ---------- a parede: a coluna, com a borda de tijolo em volta da cúpula como peça dela ----------
  const borda = BORDA * k
  L.push(P(comMeioEm(anel(0, 0, rx, ry, rx - borda - 0.6, ry - borda - 0.6), 0, ry - borda * 0.3), pedra, { tabua: 0, bisel: 1.2 * k, contorno: 0.3, tom: 1.04, semente: 18350 }))

  // ---------- a porta: coluna que sai da parede, com a chapa no meio dela (a corda de fora passa do meio da folha, que fica fora dos aros) ----------
  const quina = (a: number, d: number): Ponto => naParede(a, d)
  const vao = poligono([quina(PORTA_EM - MEIA_PORTA, -3 * k), quina(PORTA_EM - MEIA_PORTA, 6 * k), quina(PORTA_EM + MEIA_PORTA, 6 * k), quina(PORTA_EM + MEIA_PORTA, -3 * k)])
  S.push({ forma: esticadaParaAFrente(vao, maior + 0.5, quartos), z: ALTURA_DA_PORTA * c.g, forca: 0 })
  const folha = poligono([quina(PORTA_EM - MEIA_PORTA * 0.9, 0.3 * k), quina(PORTA_EM - MEIA_PORTA * 0.9, 3.4 * k), quina(PORTA_EM + MEIA_PORTA * 0.9, 3.4 * k), quina(PORTA_EM + MEIA_PORTA * 0.9, 0.3 * k)])
  L.push(P(comMeioEm(folha, ...naParede(PORTA_EM, 3 * k)), PORTA, { tabua: 0, bisel: 0.4, contorno: 0.34, tom: 0.8, metal: 0.3, semente: 18351 }))

  // ---------- os aros: tampos rasos na metade da frente NA TELA, o de baixo um tico mais largo ----------
  const [fx, fy] = doDesenho(0, 1, quartos)
  const corte = -0.25 * (Math.abs(fx) > 0.5 ? rx : ry)
  AROS.forEach((altura, i) => {
    const fora = 1.2 * k + 0.5 * (AROS.length - 1 - i)
    S.push(solta(soNaFrente(anel(0, 0, rx + fora, ry + fora, rx - 1, ry - 1), corte, quartos), altura * c.g))
    const [ax, ay] = [fx * (rx + fora - 0.25), fy * (ry + fora - 0.25)]
    L.push(P(elipse(ax, ay, 0.2, 0.2), FERRO, { tabua: 0, bisel: 0, contorno: 0, semente: 18360 + i }))
  })

  // ---------- a cúpula: seis tampos em degrau, cada um com os gomos e o trecho da escada dele ----------
  const [cx, cy] = [rx - borda, ry - borda]
  const zDaCamada = (f: number): number => zParede + e + ALTURA_DA_CUPULA * c.g * Math.sqrt(Math.max(0, 1 - f * f))
  const passoDoGomo = (2 * Math.PI) / GOMOS
  CAMADAS_DA_CUPULA.forEach((f, i) => {
    const prox = i + 1 < CAMADAS_DA_CUPULA.length ? CAMADAS_DA_CUPULA[i + 1] : 0
    const z = zDaCamada(f)
    S.push(solta(esticadaParaAFrente(elipse(0, 0, cx * f, cy * f), maior + 1.2 * k + 2.8 + 0.01 * i, quartos), z))
    // Quanto mais alta a camada, mais deitada a chapa: a luz pesa menos no gomo.
    const inclinacao = 1 - (i / CAMADAS_DA_CUPULA.length) * 0.6
    for (let j = 0; j < GOMOS; j += 1) {
      const [a0, a1] = [j * passoDoGomo + 0.13, (j + 1) * passoDoGomo + 0.13]
      const am = (a0 + a1) / 2
      const ponto = (a: number, r: number): Ponto => [Math.cos(a) * cx * r, Math.sin(a) * cy * r]
      const gomo = poligono(prox > 0 ? [ponto(a0, f), ponto(am, f), ponto(a1, f), ponto(a1, prox), ponto(a0, prox)] : [ponto(a0, f), ponto(am, f), ponto(a1, f), [0, 0]])
      const meio = ponto(am, prox > 0 ? (f + prox) / 2 : f * 0.5)
      const tom = 0.94 + LUZ_DOS_GOMOS * inclinacao * Math.cos(anguloNaTela(am) - ANGULO_DA_LUZ) + 0.04 * (hash(j, 0, 18370) - 0.5)
      L.push(P(comMeioEm(gomo, meio[0], meio[1]), telhado, { tabua: 0, eixo: am, bisel: 0.3 * k, tom, contorno: 0.05, metal: brilho, semente: 18370 + i * GOMOS + j }))
    }
    // O trecho da escada da cúpula nesta camada: os dois banzos (do alçapão para fora) e um degrau.
    if (f > ALCAPAO_EM) {
      const r1 = Math.max(prox, ALCAPAO_EM)
      const [ya, yb] = [cy * f, cy * r1]
      for (const lado of [-1, 1]) {
        const xb = lado * MEIA_ESCADA * 0.7 * k
        L.push(P(comMeioEm(capsula(xb, ya - 0.4, xb, yb + 0.4, 0.75 * k), xb, (ya + yb) / 2), FERRO, { tabua: 0, eixo: QUARTO, bisel: 0.6 * k, contorno: 0.32, tom: 1.08, metal: 0.4, projeta: { dist: 1, forca: 0.32 }, semente: 18460 + i * 2 + (lado + 1) / 2 }))
      }
      const yd = (ya + yb) / 2
      L.push(P(capsula(-MEIA_ESCADA * 0.7 * k, yd, MEIA_ESCADA * 0.7 * k, yd, 0.55 * k), FERRO, { tabua: 0, bisel: 0.5 * k, contorno: 0.3, tom: 1.02, metal: 0.4, projeta: { dist: 0.8, forca: 0.3 }, semente: 18480 + i }))
    }
  })
  // O alçapão no fim da escada da cúpula: a tampa de chapa com a dobradiça.
  const yAl = cy * ALCAPAO_EM
  L.push(P(caixa(-6.5 * k, yAl - 6 * k, 6.5 * k, yAl + 1.5 * k, 1 * k), telhado, { tabua: 0, bisel: 1 * k, contorno: 0.34, tom: 1.06, metal: brilho, projeta: { dist: 1.2, forca: 0.32 }, semente: 18490 }))
  L.push(P(capsula(-4.5 * k, yAl + 0.6 * k, 4.5 * k, yAl + 0.6 * k, 0.8 * k), FERRO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.4, semente: 18491 }))

  // ---------- o respiro no alto: um cilindro baixo com o chapéu de chapa ----------
  const zTopo = zDaCamada(CAMADAS_DA_CUPULA[CAMADAS_DA_CUPULA.length - 1])
  const [vx, vy] = [cx * RAIO_DO_RESPIRO, cy * RAIO_DO_RESPIRO]
  S.push(solta(esticadaParaAFrente(elipse(0, 0, vx, vy), maior + 1.2 * k + 2.9, quartos), zTopo + 0.1 * c.g))
  S.push(solta(esticadaParaAFrente(elipse(0, 0, vx * 0.55, vy * 0.55), maior + 1.2 * k + 2.95, quartos), zTopo + 0.17 * c.g))
  L.push(P(comMeioEm(anel(0, 0, vx, vy, vx * 0.55 + 0.6, vy * 0.55 + 0.6), vx * 0.78, 0), telhado, { tabua: 0, bisel: 1 * k, tom: 0.9, contorno: 0.3, metal: brilho, projeta: { dist: 1.6, forca: 0.32 }, semente: 18492 }))
  L.push(P(elipse(0, 0, vx * 0.55, vy * 0.55), telhado, { tabua: 0, bisel: vx * 0.3, tom: 1.1, contorno: 0.32, metal: brilho, projeta: { dist: 1.4, forca: 0.32 }, semente: 18493 }))
  L.push(P(elipse(0, 0, 1.2 * k, 1.2 * k), BURACO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.7, semente: 18494 }))

  // ---------- a escada de fora, na frente: os banzos são colunas, cada degrau um tampo um tico mais fundo ----------
  const yEscada = ry + ESCADA_LONGE * k
  const zEscada = zParede + ESCADA_ACIMA * c.g
  const degraus = Math.floor(zEscada / PASSO_DO_DEGRAU)
  for (let j = 0; j < degraus; j += 1) {
    const fundo = 0.1 * (degraus - 1 - j)
    S.push(solta(caixa(-MEIA_ESCADA * k, yEscada - 0.8 * k, MEIA_ESCADA * k, yEscada + 0.6 * k + fundo), PASSO_DO_DEGRAU * (j + 1)))
    L.push(P(elipse(0, yEscada + 0.6 * k + fundo - 0.05, 0.2, 0.2), FERRO, { tabua: 0, bisel: 0, contorno: 0, semente: 18500 + j }))
  }
  for (const lado of [-1, 1]) {
    const banzo = elipse(lado * MEIA_ESCADA * k, yEscada, RAIO_DO_BANZO * k, RAIO_DO_BANZO * k)
    S.push({ forma: banzo, z: zEscada, suave: 1.2, forca: 0.24 })
    L.push(P(banzo, FERRO, { tabua: 0, bisel: 0.6 * k, contorno: 0.32, tom: 1.06, metal: 0.4, projeta: { dist: 0.8, forca: 0.3 }, semente: 18540 + (lado + 1) / 2 }))
    // O braço que prende o banzo na parede, no alto: de cima, a risca do banzo até a borda.
    L.push(P(capsula(lado * MEIA_ESCADA * k, yEscada - RAIO_DO_BANZO * k, lado * MEIA_ESCADA * k, ry - 1, 0.6 * k), FERRO, { tabua: 0, eixo: QUARTO, bisel: 0.4, contorno: 0.3, tom: 0.92, metal: 0.4, semente: 18542 + (lado + 1) / 2 }))
  }
}
