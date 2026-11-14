/**
 * MASTRO COM BANDEIRA de cima com volume (L06 dos objetos novos, 14/11/2026,
 * grupo Base militar; serve também ao castelo e à cidade). O MASTRO alto num
 * PEDESTAL quadrado de pedra em dois degraus, com o colar de ferro no pé; lá
 * no alto, o BOTÃO dourado da ponta e a BANDEIRA tremulando para o leste: a
 * tralha de lona clara com os dois ilhoses junto do mastro, o pano em ondas
 * (as dobras claras e escuras de través), o EMBLEMA de anel no meio e a ponta
 * solta esfiapada. Do alto a bandeira é desenhada aberta ao vento, como na
 * torre de pedra: de cima de verdade ela seria um risco.
 *
 * A sombra é o que diz "alto": a do mastro corre comprida para baixo à
 * direita, e a da bandeira cai solta, longe. A 25% de zoom sobra o retângulo
 * colorido em ondas com o anel claro, preso no pino dourado sobre o
 * quadradinho de pedra.
 *
 * NA 3/4 o mastro é uma coluna da altura toda (`ALTURA_DO_MASTRO_COM_BANDEIRA`)
 * e a bandeira, um tampo solto lá em cima, da mesma altura; os dois degraus
 * são colunas baixas. As peças do pé usam `comMeioEm`, para não subirem com o
 * mastro. O desenho não lê `c.giro`: as dobras giram com o objeto.
 *
 * Materiais: `bandeira` (o pano; lã vinho de partida), `mastro` (carvalho de
 * partida) e `pedra` (o pedestal; granito de partida). A tralha, os ilhoses,
 * o colar e o botão são fixos. O emblema é linho claro, ou vinho se o pano for
 * claro. As medidas saem do menor meio lado da pegada (1 x 1 casa de partida).
 */
import { hash, rgb } from '../../ruido'
import { oklabDoRgb, tomDoMeio } from '../materiais'
import { caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, LENCOL, type MontarMovel } from './contexto'

// ---------- as medidas, em frações do menor meio lado ----------

/** O pé do mastro na pegada (a bandeira vai para o leste dele). */
const PE_DO_MASTRO: Ponto = [-0.5, -0.04]
/** O pedestal: a meia medida do degrau de baixo e do de cima, e os raios do colar, do topo do mastro e do botão. */
const DEGRAU_DE_BAIXO = 0.42
const DEGRAU_DE_CIMA = 0.28
const RAIO_DO_COLAR = 0.12
const RAIO_DO_TOPO = 0.1
const RAIO_DO_BOTAO = 0.085
/** A bandeira: comprimento, largura, o rumo do vento (radianos, para baixo à direita) e as ondas. */
const COMPRIMENTO_DA_BANDEIRA = 1.46
const LARGURA_DA_BANDEIRA = 1
const RUMO_DO_VENTO = 0.12
const ONDAS = 1.6
/** Quanto o pano ondula de lado na ponta solta (fração da largura); junto do mastro, nada. */
const AMPLITUDE_DA_ONDA = 0.07
/** A tralha (a faixa de lona junto do mastro) e o emblema de anel (o meio e os raios, em fração da largura). */
const TRALHA = 0.07
const MEIO_DO_EMBLEMA = 0.46
const ANEL_DE_FORA = 0.24
const ANEL_DE_DENTRO = 0.14
/** Os fiapos da ponta solta: quantos, e o quanto entram. */
const FIAPOS = 9
const FUNDO_DOS_FIAPOS = 0.035
/** Pontos de cada beira da bandeira. */
const PONTOS_DA_BEIRA = 24

/** Alturas em casas: o mastro (a bandeira fica lá em cima) e os dois degraus. */
const ALTURA_DO_MASTRO_COM_BANDEIRA = 2 * G
const ALTURA_DO_DEGRAU_DE_BAIXO = 0.1
const ALTURA_DO_DEGRAU_DE_CIMA = 0.2
/** A grossura do pano na 3/4 (a beirada do tampo solto). */
export const ESPESSURA_DA_BANDEIRA = 0.03 * G

// ---------- os materiais fixos ----------

const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.95)) }
const DOURADO: MaterialDaPeca = { classe: 'metal', rgb: [0xb8, 0x96, 0x55] }
const VINHO_DO_EMBLEMA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: rgb(tomDoMeio('vinho', 1)) }
/** O pano claro demais para o emblema de linho (luz OKLab acima disto) leva o emblema vinho. */
const LUZ_DO_PANO_CLARO = 0.66
/** Quanto as dobras clareiam e escurecem o pano. */
const FORCA_DAS_DOBRAS = 0.22

/** O pano: a trama do material e as dobras de través, claras na crista e escuras no vale de cada onda. */
function texDoPano(px: number, py: number, comprimento: number): Textura {
  const doTecido = texturaDaClasse('tecido')
  const [co, si] = [Math.cos(RUMO_DO_VENTO), Math.sin(RUMO_DO_VENTO)]
  return (u, v, x, y, p, s, escala) => {
    const t = ((x - px) * co + (y - py) * si) / comprimento
    // A dobra é a inclinação da onda: o lado que olha para a luz (a oeste) clareia.
    s[3] -= FORCA_DAS_DOBRAS * Math.sin(t * ONDAS * Math.PI * 2) * Math.min(1, t * 3)
    if (doTecido !== null) doTecido(u, v, x, y, p, s, escala)
  }
}

/** A mesma forma com a caixa centrada em (mx, my): o desenho não muda, mas na 3/4 a peça sobe com o que está ali. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

export const montarMastroComBandeira: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const [px, py] = [PE_DO_MASTRO[0] * c.hw, PE_DO_MASTRO[1] * c.hh]
  const pano = c.m.bandeira
  const comprimento = COMPRIMENTO_DA_BANDEIRA * R
  const largura = LARGURA_DA_BANDEIRA * R
  const [co, si] = [Math.cos(RUMO_DO_VENTO), Math.sin(RUMO_DO_VENTO)]
  /** Um ponto da bandeira: `t` ao longo (0 no mastro, 1 na ponta), `w` de través (-0,5 a 0,5), com a onda. */
  const naBandeira = (t: number, w: number): Ponto => {
    const onda = AMPLITUDE_DA_ONDA * largura * Math.min(1, t * 2) * Math.sin(t * ONDAS * Math.PI * 2 + 0.6)
    const u = t * comprimento
    const v = w * largura + onda
    return [px + u * co - v * si, py + u * si + v * co]
  }
  const beira = (w: number, de: number, ate: number): Ponto[] =>
    Array.from({ length: PONTOS_DA_BEIRA + 1 }, (_, i) => naBandeira(de + ((ate - de) * i) / PONTOS_DA_BEIRA, w))
  // A ponta solta esfiapada: de baixo para cima, os fiapos entram um pouco no pano.
  const ponta = Array.from({ length: FIAPOS * 2 + 1 }, (_, i) => naBandeira(1 - (i % 2 === 1 ? FUNDO_DOS_FIAPOS * (0.4 + 0.6 * hash(i, 1, 3301)) : 0), 0.5 - i / (FIAPOS * 2)))
  const bandeira = poligono([...beira(-0.5, 0, 1), ...ponta, ...beira(0.5, 1, 0)])
  const H = ALTURA_DO_MASTRO_COM_BANDEIRA

  // ---------- as sombras: o mastro comprido, a bandeira solta lá em cima e os degraus ----------
  const degrauDeBaixo = caixa(px - DEGRAU_DE_BAIXO * R, py - DEGRAU_DE_BAIXO * R, px + DEGRAU_DE_BAIXO * R, py + DEGRAU_DE_BAIXO * R, 0.8)
  const degrauDeCima = caixa(px - DEGRAU_DE_CIMA * R, py - DEGRAU_DE_CIMA * R, px + DEGRAU_DE_CIMA * R, py + DEGRAU_DE_CIMA * R, 0.6)
  const topo = elipse(px, py, RAIO_DO_TOPO * R, RAIO_DO_TOPO * R)
  cena.sombras.push(
    { forma: degrauDeBaixo, z: ALTURA_DO_DEGRAU_DE_BAIXO * G, forca: 0.3 },
    contato(degrauDeBaixo, 0.34),
    { forma: degrauDeCima, z: ALTURA_DO_DEGRAU_DE_CIMA * G, forca: 0.28 },
    { forma: elipse(px, py, RAIO_DO_TOPO * R * 0.75, RAIO_DO_TOPO * R * 0.75), z: H, forca: 0.4 },
    { forma: bandeira, z: H, solta: true, forca: 0.26 },
  )

  // ---------- o pedestal: os dois degraus de pedra e o colar de ferro no pé ----------
  // As caixas vão para longe do mastro e da bandeira: na 3/4 cada degrau sobe só a altura dele.
  L.push(P(comMeioEm(degrauDeBaixo, px - 0.35 * R, py + 0.35 * R), c.m.pedra, { tabua: 0, bisel: 1.6, tom: 0.92, contorno: 0.28, semente: 33001, projeta: { dist: 1, forca: 0.3 } }))
  L.push(P(comMeioEm(degrauDeCima, px - 0.2 * R, py + 0.2 * R), c.m.pedra, { tabua: 0, bisel: 1.4, tom: 1.04, contorno: 0.28, semente: 33002, projeta: { dist: 1.4, forca: 0.32 } }))
  L.push(P(comMeioEm(elipse(px, py, RAIO_DO_COLAR * R, RAIO_DO_COLAR * R), px - 0.1 * R, py + 0.06 * R), FERRO, { tabua: 0, bisel: RAIO_DO_COLAR * R * 0.6, contorno: 0.3, metal: 0.4, semente: 33003, projeta: { dist: 0.8, forca: 0.3 } }))

  // ---------- a bandeira: o pano, a tralha com os ilhoses e o emblema ----------
  L.push(P(bandeira, pano, { tabua: 0, bisel: 0.9, contorno: 0.26, textura: texDoPano(px, py, comprimento), semente: 33010 }))
  // A caixa da tralha vai para o meio do pano: encostada no mastro, ela subia com ele e pintava a frente dele de lona.
  const tralha = poligono([...beira(-0.5, 0, TRALHA), ...beira(0.5, TRALHA, 0)])
  const [mx, my] = naBandeira(0.3, 0)
  L.push(P(comMeioEm(tralha, mx, my), LENCOL, { tabua: 0, bisel: 0.7, tom: 0.94, contorno: 0.24, semente: 33011, projeta: { dist: 0.6, forca: 0.24 } }))
  for (const [i, w] of [-0.36, 0.36].entries()) {
    const [ix, iy] = naBandeira(TRALHA * 0.5, w)
    L.push(P(elipse(ix, iy, 0.035 * R, 0.035 * R), FERRO, { bisel: 0.5, contorno: 0.2, metal: 0.4, semente: 33012 + i }))
  }
  const [ex, ey] = naBandeira(MEIO_DO_EMBLEMA, 0)
  const [L0] = oklabDoRgb(pano.rgb[0], pano.rgb[1], pano.rgb[2])
  const doEmblema = L0 > LUZ_DO_PANO_CLARO ? VINHO_DO_EMBLEMA : LENCOL
  const rFora = ANEL_DE_FORA * largura
  const rDentro = ANEL_DE_DENTRO * largura
  L.push(P(elipse(ex, ey, rFora, rFora), doEmblema, { tabua: 0, bisel: 0.6, contorno: 0.16, textura: texDoPano(px, py, comprimento), semente: 33014 }))
  L.push(P(elipse(ex, ey, rDentro, rDentro), pano, { tabua: 0, bisel: 0.5, contorno: 0.14, textura: texDoPano(px, py, comprimento), semente: 33015 }))

  // ---------- no alto do mastro: o topo e o botão dourado ----------
  L.push(P(topo, c.m.mastro, { tabua: 0, bisel: RAIO_DO_TOPO * R * 0.7, contorno: 0.3, polar: { cx: px, cy: py, r: RAIO_DO_TOPO * R }, semente: 33016 }))
  const rBotao = RAIO_DO_BOTAO * R
  L.push(P(elipse(px, py, rBotao, rBotao), DOURADO, { tabua: 0, bisel: rBotao, contorno: 0.28, metal: 0.6, semente: 33017, projeta: { dist: 0.9, forca: 0.32 } }))
}
