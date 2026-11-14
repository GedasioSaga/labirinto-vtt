/**
 * REDE DE DORMIR ENTRE DOIS POSTES de cima com volume (lote L11 dos objetos
 * novos, 14/11/2026, "Descanso e brincadeira"): a rede de pano listrado,
 * armada entre dois POSTES de tronco fincados no chão. De cima, o PANO é um
 * fuso, largo no meio e franzido nas pontas, com as LISTRAS correndo ao
 * comprido e apertando para as pontas, como o pano franzido; o fundo da rede é
 * um vale (a parede do norte, de costas para a luz, fica na sombra, e a do
 * sul, clara). Nas beiras compridas, a VARANDA de crochê cru, em bicos. Em
 * cada ponta, o PUNHO, o leque de cordinhas que junta o pano numa ponta só, e
 * a CORDA até o poste, com o NÓ no lado do poste virado para a rede. Um
 * TRAVESSEIRO de linho na cabeceira (oeste). No chão, a sombra da rede, mais
 * perto no meio (que é baixo) e mais longe nas pontas (que são altas).
 *
 * A 25% de zoom sobram o fuso listrado e os dois pontos dos postes nas pontas,
 * com a sombra curva: é o que diz "rede" e não "tapete" nem "canoa" (a canoa
 * não tem poste nem corda).
 *
 * Na 3/4 a rede CAI no meio: o pano, o punho e a corda são cortados em fatias
 * ao longo do comprimento (`tampoEmFatias.ts`), cada uma um tampo solto na
 * altura da curva da rede naquele ponto, uma parábola da altura do nó (nos
 * postes) à do fundo (no meio). A varanda e o travesseiro sobem com a fatia de
 * pano em que estão. Os postes são colunas. O perfil é o derivado sem beirada
 * (`espessura: 0`), o do balanço.
 *
 * Desenhada em 3 x 1 casas: o comprimento sai da largura da pegada e a largura
 * do pano, da altura; esticada, a rede alonga. Materiais: `pano` (a rede; as
 * listras são de linho cru, ou de vinho na rede de linho, a conta do toldo) e
 * `lenha` (os postes, troncos com casca, como os do balanço). A corda, a
 * varanda e o travesseiro são fixos.
 */
import { misturar, passoSuave, type Rgb } from '../../ruido'
import { capsula, caixa, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, TOM_DA_CORDA, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { LENCOL, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'
import { circulo, emFatias, noAr } from './tampoEmFatias'

/** Alturas em casas: o alto do poste, o nó da corda no poste e o fundo da rede (o meio do pano). */
const ALTURA_DO_POSTE = 1.15
const ALTURA_DO_NO = 0.98
const ALTURA_DO_FUNDO = 0.42

/** O raio do poste em casas (engrossado: o tronco de 15 cm some no tamanho de mesa). */
const RAIO_DO_POSTE = 0.09
/** Ao longo da rede, a partir do poste (casas): onde a corda vira punho e onde o punho vira pano. */
const COMPRIMENTO_DA_CORDA = 0.22
const COMPRIMENTO_DO_PUNHO = 0.5
/** A meia largura do pano no meio e a largura da varanda, em fração da meia altura da pegada. */
const MEIA_LARGURA_DO_PANO = 0.68
const LARGURA_DA_VARANDA = 0.2
/** A varanda acaba antes do fim do pano (fração do meio comprimento do pano): o pano franze ali. */
const ALCANCE_DA_VARANDA = 0.86

/**
 * As fatias: quantas no pano, em cada punho e em cada corda, e a sobra de cada uma (px do protótipo). Fatia fina:
 * o cisalhamento de cada uma (`tampoEmFatias.ts`) aparece de cima como um dente de meio passo nas listras perto
 * das pontas, onde a rede sobe mais depressa.
 */
const FATIAS_DO_PANO = 140
const FATIAS_DO_PUNHO = 16
const FATIAS_DA_CORDA = 8
const SOBRA = 0.2
const SOBRA_DA_CORDA = 0.6

/** As listras ao comprido, em fração da meia largura do pano em cada ponto: [de, até] de cada lado do meio. */
const LISTRAS: readonly (readonly [number, number])[] = [
  [0.46, 0.6],
  [0.72, 0.8],
]
/** A faixa do meio, um tom abaixo do pano, e o quanto escurece. */
const FAIXA_DO_MEIO = 0.2
const TOM_DA_FAIXA_DO_MEIO = 0.84
/** O vale do pano: a parede do norte escurece, a do sul clareia (luz somada em cada ponta). */
const LUZ_DO_VALE = 0.11
/** Um bico da varanda a cada tanto de px do protótipo, ao longo da rede. */
const PASSO_DOS_BICOS = 4.2
/** Quantas cordinhas no leque do punho. */
const CORDINHAS = 11

const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
/** A madeira de dentro do tronco, no topo cortado: a casca puxada para o cerne claro (a conta dos destroços). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.62
/** A varanda de crochê é de algodão cru, o linho claro do lençol. */
const VARANDA = LENCOL
const TRAVESSEIRO = LENCOL

/** O fuso do pano (a interseção de dois círculos): pontudo nas pontas e largo no meio, com a distância boa. */
interface Fuso {
  readonly forma: Forma
  /** A meia largura no ponto x (0 fora do fuso). */
  meia(x: number): number
}

function fuso(meioComprimento: number, meiaLargura: number): Fuso {
  const R = (meioComprimento * meioComprimento + meiaLargura * meiaLargura) / (2 * meiaLargura)
  const d = R - meiaLargura
  const norte = circulo(0, d, R)
  const sul = circulo(0, -d, R)
  return {
    forma: { b: [-meioComprimento, -meiaLargura, meioComprimento, meiaLargura], d: (x, y) => Math.max(norte.d(x, y), sul.d(x, y)) },
    meia: (x) => Math.max(0, Math.sqrt(Math.max(0, R * R - x * x)) - d),
  }
}

/** A cor das listras: linho cru; na rede de linho, vinho (linho sobre linho dava uma rede lisa). */
function corDaListra(pano: MaterialDaPeca): MaterialDaPeca {
  return materialDaPeca(pano.fio === 'linho' ? 'vinho' : 'linho')
}

/**
 * O PANO: a trama do tecido, as listras ao comprido (na fração da meia largura do ponto, então apertam nas pontas
 * como o pano franzido), a faixa do meio mais escura e o vale (o norte na sombra, o sul na luz).
 */
function texDoPano(corpo: Fuso, listra: MaterialDaPeca): Textura {
  const trama = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (trama !== null) trama(u, v, x, y, p, s, escala)
    const meia = Math.max(corpo.meia(x), 1)
    const q = y / meia
    const aq = Math.abs(q)
    // O degrau da listra tem meio pixel de cada lado: menos que isso pisca no tamanho de mesa.
    const borda = 0.6 / (escala * meia)
    let naListra = 0
    for (const [de, ate] of LISTRAS) naListra = Math.max(naListra, passoSuave(de - borda, de + borda, aq) * (1 - passoSuave(ate - borda, ate + borda, aq)))
    const naFaixa = 1 - passoSuave(FAIXA_DO_MEIO - borda, FAIXA_DO_MEIO + borda, aq)
    const tom = 1 - (1 - TOM_DA_FAIXA_DO_MEIO) * naFaixa
    for (let i = 0; i < 3; i += 1) s[i] = (s[i] * tom) * (1 - naListra) + listra.rgb[i] * naListra
    s[3] += LUZ_DO_VALE * Math.max(-1, Math.min(1, q)) + ruido(x * 0.08 + p.su, y * 0.3) * 0.03
  }
}

/** A VARANDA: crochê cru em bicos, vazado entre um bico e outro, com a carreira de furos perto do pano. */
function texDaVaranda(corpo: Fuso, largura: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const fora = Math.abs(y) - corpo.meia(x)
    const f = x / PASSO_DOS_BICOS
    const bico = Math.abs(f - Math.floor(f) - 0.5) * 2
    // O bico: inteiro perto do pano, vai afinando até a ponta no meio do passo.
    if (fora > largura * (0.4 + 0.6 * (1 - bico))) {
      s[5] = 0
      return
    }
    const furo = Math.abs(fora - largura * 0.28) < largura * 0.1 && bico > 0.35
    s[3] += (furo ? -0.22 : 0) + ruido(x * 0.7 + p.su, y * 0.7) * 0.04
  }
}

/** O PUNHO: o leque de cordinhas que sai da ponta do pano e junta na corda. `ponta` = onde as cordinhas juntam. */
function texDoPunho(ponta: Ponto, abertura: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const ang = Math.atan2(y - ponta[1], Math.abs(x - ponta[0]))
    const k = (ang / abertura) * CORDINHAS * 0.5
    const entre = Math.abs(k - Math.round(k))
    s[3] += (entre > 0.32 ? -0.24 * passoSuave(0.32, 0.5, entre) : 0.04) + ruido(x * 0.5 + p.su, y * 0.5) * 0.04
  }
}

/** Topo de madeira cortada: os anéis em volta do centro do poste (a conta do mourão da cerca). */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const raio = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.4
    s[3] += Math.sin(raio * 4.2) * 0.035 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

/** O que a montagem passa a cada parte. */
interface Obra {
  readonly c: ContextoDoMovel
  /** O x do meio de cada poste (o lado positivo), a ponta do punho e a ponta do pano. */
  readonly xPoste: number
  readonly xPunho: number
  readonly xPano: number
  /** A altura da rede (px) em cada x: a parábola do nó ao fundo. */
  readonly altura: (x: number) => number
}

/** A SOMBRA da rede no chão: cada ponto da beira caído da altura dele (o meio, baixo, cai perto; as pontas, longe). */
function sombraDaRede(o: Obra, corpo: Fuso, largura: number): Forma {
  const pontos: Ponto[] = []
  const passos = 24
  for (const lado of [-1, 1]) {
    for (let i = 0; i <= passos; i += 1) {
      const t = lado < 0 ? i / passos : 1 - i / passos
      const x = -o.xPoste + 2 * o.xPoste * t
      const z = o.altura(x)
      const meia = Math.max(corpo.meia(x) + (Math.abs(x) < o.xPano * ALCANCE_DA_VARANDA ? largura * 0.6 : 0), 0.9)
      pontos.push([x + SOMBRA_X * z, lado * meia + SOMBRA_Y * z])
    }
  }
  return poligono(pontos)
}

/** Um POSTE: a casca do tronco, o topo cortado, a coluna e o contato no pé. */
function montarPoste(o: Obra, x: number, semente: number, cena: Cena): void {
  const { c } = o
  const r = c.g * RAIO_DO_POSTE
  const corpo = circulo(x, 0, r)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DO_POSTE }, contato(circulo(x, 0, r * 1.15), 0.34))
  // A casca é o disco inteiro e dá a casca à frente da coluna na 3/4 (é a maior peça do poste).
  const lenha = c.m.lenha
  cena.partes.push(c.peca(corpo, lenha, { eixo: Math.PI / 2, bisel: r * 0.5, contorno: 0.3, semente }))
  const cerne: MaterialDaPeca = { classe: 'madeira', rgb: misturar(lenha.rgb, CERNE, QUANTO_DE_CERNE) }
  cena.partes.push(c.peca(circulo(x, 0, r * 0.76), cerne, { textura: texDoTopo(x, 0), bisel: 0.9, contorno: 0.2, semente: semente + 1 }))
}

export const montarRedeDeDormir: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const r = g * RAIO_DO_POSTE
  const xPoste = hw - r * 1.15
  const xPunho = xPoste - g * COMPRIMENTO_DA_CORDA
  const xPano = xPoste - g * COMPRIMENTO_DO_PUNHO
  const zNo = g * ALTURA_DO_NO
  const zFundo = g * ALTURA_DO_FUNDO
  const altura = (x: number): number => zFundo + (zNo - zFundo) * Math.min(1, (x / xPoste) ** 2)
  const o: Obra = { c, xPoste, xPunho, xPano, altura }
  const meiaLargura = hh * MEIA_LARGURA_DO_PANO
  const largura = hh * LARGURA_DA_VARANDA
  const corpo = fuso(xPunho, meiaLargura)
  const pano = c.m.pano

  // No chão: a sombra da rede (com a varanda e as cordas) e a das cordas até os postes.
  cena.sombras.push({ forma: sombraDaRede(o, corpo, largura), z: 0, suave: 2.8, forca: 0.2 })

  // As cordas, por baixo dos postes (a ponta delas some atrás do tronco).
  for (const lado of [-1, 1]) {
    const de = lado * (xPunho - 1.5)
    // A corda acaba na beira do poste: o meio da última fatia dentro do tronco a faria subir com ele na 3/4.
    const ate = lado * (xPoste - r)
    const corda = capsula(de, 0, ate, 0, 0.95)
    emFatias(c, cena, corda, CORDA, { eixo: 0, bisel: 0.9, contorno: 0.26, semente: 5800 + lado }, {
      eixo: 'x', de: Math.min(de, ate) - 1, ate: Math.max(de, ate) + 1, altura, fatias: FATIAS_DA_CORDA, sobra: SOBRA_DA_CORDA,
    })
  }
  montarPoste(o, -xPoste, 5810, cena)
  montarPoste(o, xPoste, 5820, cena)
  // O nó: a volta da corda no lado do poste virado para a rede, na altura do nó.
  for (const lado of [-1, 1]) {
    // O meio do nó fica fora do tronco: dentro, a 3/4 o subiria com o poste, até o alto dele.
    const xn = lado * (xPoste - r * 1.2)
    const no = noAr(cena, elipse(xn, 0, 1.8, r * 0.95), zNo)
    cena.partes.push(P(no, CORDA, { eixo: Math.PI / 2, bisel: 1.1, contorno: 0.28, ruga: 0.6, semente: 5830 + lado, projeta: { dist: 0.6, forca: 0.3 } }))
  }

  // A varanda, por baixo do pano: sobe com a fatia de pano em que está.
  const alcance = xPano * ALCANCE_DA_VARANDA
  const grande = fuso(xPunho, meiaLargura + largura)
  const varanda = dentroDe(menos(grande.forma, corpo.forma), caixa(-alcance, -hh, alcance, hh))
  emFatias(c, cena, varanda, VARANDA, { bisel: 0.4, contorno: 0.2, semente: 5840, textura: texDaVaranda(corpo, largura) }, {
    eixo: 'x', de: -alcance, ate: alcance, altura, fatias: FATIAS_DO_PANO, sobra: SOBRA, semEstrutura: true,
  })

  // Os punhos: o leque de cordinhas da ponta do pano até a corda.
  for (const lado of [-1, 1]) {
    const de = Math.min(lado * xPano, lado * xPunho)
    const ate = Math.max(lado * xPano, lado * xPunho)
    const punho = dentroDe(corpo.forma, caixa(de, -hh, ate, hh))
    const abertura = Math.atan2(corpo.meia(xPano), xPunho - xPano)
    emFatias(c, cena, punho, CORDA, { eixo: 0, bisel: 1, contorno: 0.26, semente: 5850 + lado, textura: texDoPunho([lado * xPunho, 0], abertura) }, {
      eixo: 'x', de, ate, altura, fatias: FATIAS_DO_PUNHO, sobra: SOBRA,
    })
  }

  // O pano: o fuso listrado entre os dois punhos, com a costura franzida em cada ponta.
  const panoForma = dentroDe(corpo.forma, caixa(-xPano, -hh, xPano, hh))
  emFatias(c, cena, panoForma, pano, { eixo: 0, tabua: 0, bisel: 2.2, contorno: 0.26, semente: 5860, textura: texDoPano(corpo, corDaListra(pano)) }, {
    eixo: 'x', de: -xPano, ate: xPano, altura, fatias: FATIAS_DO_PANO, sobra: SOBRA,
  })

  // O travesseiro na cabeceira: sobe com a fatia de pano debaixo dele e faz sombra no pano.
  const xt = -xPano * 0.66
  const mx = g * 0.1
  const my = Math.min(corpo.meia(xt) * 0.62, g * 0.2)
  cena.partes.push(P(caixa(xt - mx, -my, xt + mx, my, mx * 0.8), TRAVESSEIRO, { eixo: Math.PI / 2, tabua: 0, bisel: mx * 0.9, contorno: 0.24, ruga: 0.5, semente: 5870, projeta: { dist: 1.4, forca: 0.32, suave: 1 } }))
}
