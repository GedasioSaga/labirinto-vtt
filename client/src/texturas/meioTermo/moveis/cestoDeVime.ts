/**
 * CESTO DE VIME de cima com volume (lote 6 dos objetos novos, 11/11/2026),
 * para a feira, a cozinha e a despensa. O cesto redondo e bojudo, visto do
 * alto: a PAREDE trançada que sobra em volta da boca (duas fileiras de vime
 * que passam por cima de uma estaca e por trás da seguinte, desencontradas
 * como tijolo), a BORDA grossa torcida, as duas ALÇAS em orelha, uma de cada
 * lado, o PANO listrado que forra o cesto e sai pela borda da frente, e o
 * cesto CHEIO de maçãs, em monte (vermelhas, com umas verdes no meio; de
 * perto, o cabinho e o lustro de cada uma).
 *
 * A trama é o que diz "cesto" e não "barril": os lombos da parede têm perto de
 * 5 px do protótipo (4 pixels no tamanho de mesa) e as voltas da borda, 3. O
 * que é mais miúdo que isso (a fibra do vime, o filete da listra, o cabinho)
 * só entra de perto.
 *
 * NA 3/4 o cesto sobe pelas sombras, como o barril: a boca sobe e a parede
 * aparece embaixo, na palha trançada do motor (o material do cesto é da classe
 * palha). A ponta do pano que cai pela frente é uma peça só dela, guardada
 * debaixo da boca na vista de cima (onde nada dela aparece), com um pino que a
 * faz ser pintada depois da parede; com o cesto girado, a parede a cobre. As
 * alças têm a estrutura solta delas (sem sombra), que na 3/4 lhes dá a grossura.
 *
 * A 25% de zoom sobram o anel claro da borda, as bolinhas vermelhas e a mancha
 * clara do pano na frente. Material: `pano` (o forro; as listras saem dele:
 * azuis no pano claro, cruas no escuro). O vime e as maçãs são fixos. O cesto
 * estica em oval com a pegada (0,7 x 0,7 casa de partida); as maçãs saem do
 * menor lado.
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { oklabDoRgb } from '../materiais'
import { anel, cadeia, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** Altura do cesto em casas (a sombra; na 3/4, a parede). */
const ALTURA = 0.34
/** O desenho foi medido no cesto de 0,7 casa (19,6 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.35 * G
/** O raio do bojo do cesto, em fração da meia pegada: o resto é das alças e da ponta do pano. */
const RAIO_DO_CESTO = 0.84
const GRAUS = Math.PI / 180
const VOLTA_INTEIRA = Math.PI * 2

/**
 * O vime: palha de salgueiro descascado, mais clara e menos viva que a terra do chão (saturação HSV ~0,45). É da
 * classe palha para a parede que a 3/4 varre sair trançada.
 */
const VIME: MaterialDaPeca = { classe: 'palha', rgb: [0xc6, 0xa4, 0x6c] }
/** As maçãs, nas cores da banca de frutas, um nada menos vivas (o cesto é quase só maçã, e o teto de saturação é 0,62). */
const MACA: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x56, 0x4a] }
const MACA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x96, 0x4a, 0x44] }
const MACA_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0xa8, 0x62] }
/** O amarelo que mancha a maçã vermelha do lado que não pegou sol, e o cabinho. */
const TOM_DO_AMARELO: Rgb = [0xc0, 0xa0, 0x62]
const CABINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x46, 0x32] }
/** As listras do pano: azul desbotado no pano claro, cru no pano escuro. */
const LISTRA_AZUL: Rgb = [0x6a, 0x7a, 0x90]
const LISTRA_CRUA: Rgb = [0xde, 0xd4, 0xba]
/** A partir desta luz (OKLab L) o pano é claro e a listra é a azul. */
const LUZ_DO_PANO_CLARO = 0.62

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

// ---------- a trama ----------

/** A parede trançada vai deste raio (fração do raio do cesto) até a beira; a borda torcida e o forro ficam para dentro. */
const PAREDE_DE = 0.68
const BORDA_POR_FORA = 0.71
const BORDA_POR_DENTRO = 0.54
const RAIO_DO_FORRO = 0.57
/** As fileiras de vime da parede e os lombos de cada volta (cada lombo passa por cima de uma estaca). */
const FILEIRAS = 2
const LOMBOS = 18
/** As voltas da torção da borda. */
const VOLTAS_DA_BORDA = 21

/**
 * A parede trançada, vista do alto: cada fileira é uma volta de vime que aparece em lombos (claro no meio,
 * escuro onde mergulha atrás da estaca), e a fileira seguinte é desencontrada de meio lombo.
 */
function texDaParede(rx: number, ry: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const nx = x / rx
    const ny = y / ry
    const f = ((Math.hypot(nx, ny) - PAREDE_DE) / (1 - PAREDE_DE)) * FILEIRAS
    const j = Math.max(0, Math.min(FILEIRAS - 1, Math.floor(f)))
    const volta = (Math.atan2(ny, nx) / VOLTA_INTEIRA) * LOMBOS + (j & 1) * 0.5
    const i = Math.floor(volta)
    const aoLongo = Math.sin((volta - i) * Math.PI)
    const atraves = Math.sin(limitar01(f - j) * Math.PI)
    s[3] += (Math.pow(aoLongo, 0.6) - 0.72) * 0.5 + (atraves - 0.7) * 0.26 + (hash(i, j, 4231) - 0.5) * 0.09
    // De perto, a fibra do vime ao comprido de cada lombo.
    if (escala >= ESCALA_DO_DETALHE) s[3] += ruido(volta * 7 + j * 13, f * 5) * 0.06
  }
}

/** A borda torcida: os gomos claros em diagonal e o vinco escuro entre um e outro. */
function texDaBorda(rx: number, ry: number): Textura {
  const meio = (BORDA_POR_FORA + BORDA_POR_DENTRO) / 2
  const largura = BORDA_POR_FORA - BORDA_POR_DENTRO
  return (_u, _v, x, y, _p, s) => {
    const nx = x / rx
    const ny = y / ry
    const onda = Math.sin(((Math.atan2(ny, nx) / VOLTA_INTEIRA) * VOLTAS_DA_BORDA + ((Math.hypot(nx, ny) - meio) / largura) * 0.8) * VOLTA_INTEIRA)
    s[3] += onda > 0 ? 0.09 * onda : 0.3 * onda
  }
}

/** A alça torcida: os gomos pela volta em torno do meio do cesto (a alça corre em roda dele). */
const texDaAlca: Textura = (_u, _v, x, y, _p, s) => {
  const onda = Math.sin(Math.atan2(y, x) * 46 + Math.hypot(x, y) * 1.4)
  s[3] += onda > 0 ? 0.08 * onda : 0.26 * onda
}

// ---------- o pano ----------

/** As listras do pano: para onde correm (radianos), de quanto em quanto (px da medida de partida) e as meias larguras. */
const RUMO_DA_LISTRA = 0.5
const PASSO_DA_LISTRA = 6.4
const MEIA_LISTRA = 0.62
const LUGAR_DO_FILETE = 1.5
const MEIO_FILETE = 0.24
const LISTRA_NO_PANO = 0.62
const BEIRA_DA_LISTRA = 0.3
/** As pregas do pano que cai pela borda, em roda do meio do cesto (quantas caberiam na volta inteira). */
const PREGAS_DO_PANO = 20

/** A prega do pano: o fundo dela escurece (ao quadrado: um risco, não uma faixa) e o lombo clareia um pouco. */
function prega(onda: number, fundo: number, lombo: number): number {
  return onda > 0 ? -fundo * onda * onda : -lombo * onda
}

/**
 * O pano listrado: a trama do tecido escolhido, as listras ao comprido (a faixa e, de perto, um filete de cada
 * lado dela) e, onde ele cai pela borda (`pregas` > 0), as pregas que descem dela.
 */
function texDoPano(listra: Rgb, k: number, pregas: number): Textura {
  const doTecido = texturaDaClasse('tecido')
  const co = Math.cos(RUMO_DA_LISTRA)
  const si = Math.sin(RUMO_DA_LISTRA)
  const passo = PASSO_DA_LISTRA * k
  return (u, v, x, y, p, s, escala) => {
    if (doTecido !== null) doTecido(u, v, x, y, p, s, escala)
    const w = (x * co + y * si) / passo
    const d = Math.abs(w - Math.floor(w) - 0.5) * passo
    const naFaixa = limitar01((MEIA_LISTRA * k - d) / BEIRA_DA_LISTRA + 0.5)
    // No tamanho de mesa o filete tem menos de 1 pixel e vira chuvisco: fica só a faixa.
    const noFilete = escala < ESCALA_DO_DETALHE ? 0 : limitar01((MEIO_FILETE * k - Math.abs(d - LUGAR_DO_FILETE * k)) / BEIRA_DA_LISTRA + 0.5)
    const quanto = LISTRA_NO_PANO * Math.max(naFaixa, noFilete)
    s[0] += (listra[0] - s[0]) * quanto
    s[1] += (listra[1] - s[1]) * quanto
    s[2] += (listra[2] - s[2]) * quanto
    if (pregas > 0) s[3] += prega(Math.sin(Math.atan2(y, x) * PREGAS_DO_PANO + ruido(x * 0.3, y * 0.3) * 2.2), 0.32 * pregas, 0.09 * pregas)
  }
}

/**
 * O pano que sai pela borda da frente: de onde a onde vai em roda (graus; 90 = a frente), de que raio ele vem
 * (por dentro) e até onde a bainha cai para fora da parede, com a ponta no meio (frações do raio do cesto).
 */
const PANO_DE = 84
const PANO_ATE = 140
const PANO_POR_DENTRO = 0.46
const BAINHA = 1.03
const PONTA_DA_BAINHA = 0.14
/** Quanto a bainha abre para os lados além do que o pano ocupa na borda (graus) e os pontos do contorno dela. */
const ABERTURA_DA_BAINHA = 9
const PONTOS_DA_BAINHA = 14
/**
 * A ponta que cai pela frente da parede na 3/4: [graus em roda, queda em px da medida de partida abaixo da
 * boca]. Começa na beira da boca: é ali que o pano dobra, claro em cima e mais escuro na frente.
 */
const PONTA_CAIDA: readonly Ponto[] = [
  [96, 0],
  [128, 0],
  [124, 4.4],
  [113, 9.6],
  [101, 5.2],
]
/** Quanto a ponta caída sobe na 3/4 (px): o mínimo para o pino dela valer como estrutura. */
const SUBIDA_DA_PONTA = 0.3
/** Onde fica o pino da ponta caída, em roda do meio do cesto: fora do bojo, entre a alça e a frente. */
const PINO_DA_PONTA = { graus: 140, raio: 1.12 } as const
/** A ponta caída é a frente do pano: um pouco menos de luz que o que está em cima da borda. */
const TOM_DA_PONTA_CAIDA = 0.88

// ---------- as maçãs ----------

type Fruta = 'vermelha' | 'escura' | 'verde'

interface Maca {
  /** Para que lado do meio do cesto (graus) e a que distância (fração do raio do forro). */
  readonly rumo: number
  readonly longe: number
  /** O raio, em fração do raio do forro (do menor lado). */
  readonly raio: number
  readonly fruta: Fruta
  /** O cabinho aparece (a maçã está de pé) ou não (está de lado). */
  readonly cabinho: boolean
}

/** A camada de baixo, em roda, encostada na borda. */
const MACAS_DE_BAIXO: readonly Maca[] = [
  { rumo: 16, longe: 0.64, raio: 0.33, fruta: 'vermelha', cabinho: false },
  { rumo: 66, longe: 0.62, raio: 0.34, fruta: 'escura', cabinho: true },
  { rumo: 121, longe: 0.6, raio: 0.32, fruta: 'verde', cabinho: false },
  { rumo: 174, longe: 0.65, raio: 0.34, fruta: 'vermelha', cabinho: true },
  { rumo: 226, longe: 0.62, raio: 0.33, fruta: 'escura', cabinho: false },
  { rumo: 279, longe: 0.64, raio: 0.34, fruta: 'vermelha', cabinho: true },
  { rumo: 331, longe: 0.63, raio: 0.32, fruta: 'verde', cabinho: false },
]
/** O monte do meio, por cima das outras. */
const MACAS_DE_CIMA: readonly Maca[] = [
  { rumo: 205, longe: 0.3, raio: 0.36, fruta: 'vermelha', cabinho: true },
  { rumo: 330, longe: 0.3, raio: 0.35, fruta: 'escura', cabinho: false },
  { rumo: 88, longe: 0.28, raio: 0.37, fruta: 'vermelha', cabinho: true },
]
const COR_DA_FRUTA: Readonly<Record<Fruta, MaterialDaPeca>> = { vermelha: MACA, escura: MACA_ESCURA, verde: MACA_VERDE }
/** O lustro da casca: o brilho do metal do motor, fraco. */
const LUSTRO_DA_MACA = 0.13

/** A casca da maçã vermelha: a mancha amarela do lado que não pegou sol, sorteada por fruta. */
function texDaMaca(cx: number, cy: number, r: number, sem: number): Textura {
  const rumo = hash(sem, 1, 4253) * VOLTA_INTEIRA
  const mx = cx + Math.cos(rumo) * r * 0.5
  const my = cy + Math.sin(rumo) * r * 0.5
  return (_u, _v, x, y, _p, s) => {
    const perto = limitar01(1 - Math.hypot(x - mx, y - my) / (r * 0.9))
    const quanto = 0.4 * perto * perto
    s[0] += (TOM_DO_AMARELO[0] - s[0]) * quanto
    s[1] += (TOM_DO_AMARELO[1] - s[1]) * quanto
    s[2] += (TOM_DO_AMARELO[2] - s[2]) * quanto
  }
}

// ---------- as alças ----------

/** Cada alça: meia abertura em roda (graus), de que raio sai e até onde a orelha chega (frações do raio do cesto), e a meia grossura. */
const MEIA_ABERTURA_DA_ALCA = 27
const ALCA_DE = 0.9
const ALCA_ATE = 1.1
const GROSSURA_DA_ALCA = 0.07
const PASSOS_DA_ALCA = 10

/** A mesma forma com a caixa de pintura trocada por `b` (maior que a dela). */
function comCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/**
 * A mesma forma com a caixa de pintura espelhada em volta de (mx, my). O desenho não muda (fora da forma nada
 * pinta); o meio da caixa, que é o que a 3/4 lê para saber em que estrutura a peça está, cai no pino.
 */
function centrada(f: Forma, mx: number, my: number): Forma {
  const ax = Math.max(Math.abs(f.b[0] - mx), Math.abs(f.b[2] - mx))
  const ay = Math.max(Math.abs(f.b[1] - my), Math.abs(f.b[3] - my))
  return comCaixa(f, [mx - ax, my - ay, mx + ax, my + ay])
}

/** Meia largura do pino (px do protótipo): só o meio exato da caixa de uma peça cai nele. */
const MEIO_PINO = 0.001

/**
 * Um PINO: a estrutura da 3/4 sem tamanho nem tinta. Só o ponto (x, y) está dentro dele, então só a peça cuja
 * caixa de pintura tem o meio ali sobe com ele, e a beirada que a 3/4 daria a um tampo no ar não pinta nada.
 * `frente` = até onde a caixa do pino vai para a frente: é pela frente da caixa que a 3/4 ordena as estruturas,
 * e o que sobe com o pino é pintado depois de tudo o que acaba antes dela.
 */
function pino(x: number, y: number, frente: number): Forma {
  return {
    b: [x - MEIO_PINO, y - MEIO_PINO, x + MEIO_PINO, frente],
    d: (px, py) => (Math.abs(px - x) <= MEIO_PINO && Math.abs(py - y) <= MEIO_PINO ? -MEIO_PINO : 1),
  }
}

export const montarCestoDeVime: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pano = c.m.pano
  const rx = RAIO_DO_CESTO * hw
  const ry = RAIO_DO_CESTO * hh
  const R = Math.min(rx, ry)
  const k = Math.min(hw, hh) / MEIO_LADO_DE_PARTIDA
  const H = g * ALTURA
  const L = cena.partes
  /** O ponto em roda do meio do cesto: `graus` (90 = a frente) e `raio` em fração do raio do cesto. */
  const emRoda = (graus: number, raio: number): Ponto => [Math.cos(graus * GRAUS) * raio * rx, Math.sin(graus * GRAUS) * raio * ry]
  const listra = oklabDoRgb(pano.rgb[0], pano.rgb[1], pano.rgb[2])[0] >= LUZ_DO_PANO_CLARO ? LISTRA_AZUL : LISTRA_CRUA

  const bojo = elipse(0, 0, rx, ry)
  cena.sombras.push({ forma: bojo, z: H }, contato(bojo))

  // A ponta do pano que cai pela frente, guardada debaixo da boca: só a 3/4 a mostra, na frente da parede.
  const caida = poligono(PONTA_CAIDA.map(([graus, queda]): Ponto => [Math.cos(graus * GRAUS) * rx, Math.sin(graus * GRAUS) * ry - H + queda * k + SUBIDA_DA_PONTA]))
  // O pino dela fica no canto da pegada, logo fora do bojo (fora da coluna do cesto e perto da ponta guardada:
  // a caixa de pintura espelhada sai menor), e a caixa dele vai até a beira da pegada: é a última estrutura que a 3/4 pinta.
  const [px, py] = emRoda(PINO_DA_PONTA.graus, PINO_DA_PONTA.raio)
  cena.sombras.push({ forma: pino(px, py, hh), z: SUBIDA_DA_PONTA, solta: true, forca: 0 })
  L.push(P(centrada(caida, px, py), pano, { bisel: 0.7 * k, tom: TOM_DA_PONTA_CAIDA, contorno: 0.26, ruga: 0.9, textura: texDoPano(listra, k, 1), semente: 4201 }))

  // A parede trançada: o bojo inteiro, com a beira arredondada. A caixa dela é a pegada: é a maior peça, e é o
  // material dela (o vime) que a 3/4 usa na parede.
  L.push(P(comCaixa(bojo, [-hw, -hh, hw, hh]), VIME, { bisel: R * 0.16, contorno: 0.3, textura: texDaParede(rx, ry), semente: 4202 }))

  // O forro de pano, afundado dentro da borda, e a camada de baixo das maçãs por cima dele.
  L.push(P(elipse(0, 0, rx * RAIO_DO_FORRO, ry * RAIO_DO_FORRO), pano, { bisel: 0, contorno: 0, tom: 0.94, ruga: 0.9, recesso: { k: 2.6 * k, forca: 0.4 }, textura: texDoPano(listra, k, 0), semente: 4203 }))
  const raioDoForro = R * RAIO_DO_FORRO
  const umaMaca = (maca: Maca, emCima: boolean, sem: number): void => {
    const [x, y] = emRoda(maca.rumo, maca.longe * RAIO_DO_FORRO)
    const r = maca.raio * raioDoForro
    const cor = COR_DA_FRUTA[maca.fruta]
    L.push(P(elipse(x, y, r, r), cor, {
      bisel: r * 0.95,
      tom: 0.94 + 0.14 * hash(sem, 2, 4253),
      contorno: 0.3,
      metal: LUSTRO_DA_MACA,
      textura: maca.fruta === 'verde' ? undefined : texDaMaca(x, y, r, sem),
      semente: sem,
      projeta: { dist: r * (emCima ? 0.42 : 0.3), forca: emCima ? 0.32 : 0.28, suave: 0.9 * k },
    }))
    if (!maca.cabinho) return
    // A covinha e o cabinho, um pouco fora do meio (a maçã nunca assenta reta).
    const rumo = hash(sem, 3, 4253) * VOLTA_INTEIRA
    const cxv = x + Math.cos(rumo) * r * 0.16
    const cyv = y + Math.sin(rumo) * r * 0.16
    L.push(P(elipse(cxv, cyv, r * 0.24, r * 0.2), cor, { bisel: 0, tom: 0.62, contorno: 0, alfa: 0.8, suave: 0.5 * k, semente: sem }))
    L.push(P(cadeia([[cxv, cyv], [cxv + Math.cos(rumo + 0.7) * r * 0.42, cyv + Math.sin(rumo + 0.7) * r * 0.42]], 0.32 * k), CABINHO, { bisel: 0.3 * k, contorno: 0.1, semente: sem }))
  }
  MACAS_DE_BAIXO.forEach((maca, i) => umaMaca(maca, false, 4210 + i))

  // A borda torcida, por cima da parede e da beira das maçãs de baixo.
  const borda = anel(0, 0, rx * BORDA_POR_FORA, ry * BORDA_POR_FORA, rx * BORDA_POR_DENTRO, ry * BORDA_POR_DENTRO)
  L.push(P(borda, VIME, { bisel: (R * (BORDA_POR_FORA - BORDA_POR_DENTRO)) / 2, tom: 1.08, contorno: 0.26, textura: texDaBorda(rx, ry), semente: 4204, projeta: { dist: 1.5 * k, forca: 0.36, suave: 1 * k } }))

  // O pano que sai pela borda da frente: vem de dentro, passa por cima da borda e cai para fora, com a ponta no meio.
  const porDentro: Ponto[] = []
  const bainha: Ponto[] = []
  for (let i = 0; i <= PONTOS_DA_BAINHA; i += 1) {
    const f = i / PONTOS_DA_BAINHA
    porDentro.push(emRoda(PANO_DE + (PANO_ATE - PANO_DE) * f, PANO_POR_DENTRO))
    const ponta = Math.pow(1 - Math.abs(2 * f - 1), 0.75)
    const graus = PANO_DE - ABERTURA_DA_BAINHA + (PANO_ATE - PANO_DE + 2 * ABERTURA_DA_BAINHA) * f
    bainha.push(emRoda(graus, BAINHA + PONTA_DA_BAINHA * ponta + 0.012 * Math.sin(f * 19)))
  }
  const saida = poligono([...porDentro, ...bainha.reverse()])
  L.push(P(saida, pano, { bisel: 0.8 * k, contorno: 0.26, ruga: 1, textura: texDoPano(listra, k, 1), semente: 4205, projeta: { dist: 1.3 * k, forca: 0.32, suave: 0.9 * k } }))

  // As duas alças em orelha, uma de cada lado. A sombra solta delas não escurece o chão (a orelha solta no ar
  // desenhava um anel de sombra ao lado do cesto): só diz à 3/4 a altura, e a beirada que ela ganha é a grossura da alça.
  const grossura = GROSSURA_DA_ALCA * R
  const orelha = (lado: number): Forma => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= PASSOS_DA_ALCA; i += 1) {
      const f = (2 * i) / PASSOS_DA_ALCA - 1
      pontos.push(emRoda(lado + f * MEIA_ABERTURA_DA_ALCA, ALCA_DE + (ALCA_ATE - ALCA_DE) * Math.pow(Math.cos((f * Math.PI) / 2), 0.7)))
    }
    return cadeia(pontos, grossura)
  }
  const alcas = uniao(orelha(0), orelha(180))
  cena.sombras.push({ forma: alcas, z: H, solta: true, forca: 0 })
  L.push(P(alcas, VIME, { bisel: grossura, tom: 0.9, contorno: 0.3, textura: texDaAlca, semente: 4206, projeta: { dist: 1.2 * k, forca: 0.3 } }))

  // O monte do meio, por cima de tudo.
  MACAS_DE_CIMA.forEach((maca, i) => umaMaca(maca, true, 4230 + i))
}
