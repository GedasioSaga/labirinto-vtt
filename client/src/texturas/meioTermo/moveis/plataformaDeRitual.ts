/**
 * PLATAFORMA DE RITUAL (lote L04 de 24/11/2026, a Fortaleza do ritual;
 * construção nova). O disco de pedra do centro de uma caverna de ritual, de
 * cerca de 5 x 5 casas: a GUIA de blocos na beira, dois anéis de LAJES em
 * raio, o ANEL MÁGICO verde embutido num canal entre eles, o MEDALHÃO liso do
 * meio (onde o mestre põe o altar) e, em volta, oito PILARETES de pedra de
 * topo em pirâmide, cada um com a ARGOLA de ferro de onde sai uma corrente.
 * As correntes não vêm junto: são outra peça, que o mestre prende na argola.
 *
 * Os pilaretes ficam nas oito diagonais (22,5 graus fora dos eixos): os
 * quatro eixos ficam livres para entrar no disco. Pisa-se nela: é CHÃO, não
 * barra a passagem e não tapa a visão; o disco é uma laje baixa (a espessura
 * dela é só pintada) e mora por baixo dos outros objetos e das fichas.
 *
 * O disco é UMA peça com textura própria (um passo só por pixel, como o fosso
 * do salão): as lajes, as juntas, o canal com o fio verde e o brilho dele, o
 * musgo da beira úmida, as duas trincas e a sombra de cada pilarete, que cai
 * NO disco (a sombra de chão do motor fica por baixo das peças).
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado SEM beirada) só os pilaretes
 * sobem: cada um é uma coluna, com as quatro águas da pirâmide em cima, e a
 * argola é um tampo solto a meia altura, pendurada do lado de fora. O disco
 * fica no chão. O desenho é montado JÁ NA TELA (`montadaNaTela`): a
 * plataforma é igual dos quatro lados, e a luz das águas fica do lado certo
 * com ela girada.
 *
 * REVISÃO DO DIRETOR DE ARTE (24/11/2026): sem espessura, o disco lia como um
 * decalque no chão, quase igual ao fosso do salão de longe. Agora a LAJE É
 * ELEVADA e mostra a borda grossa: no arco de baixo à direita, a face de pé
 * dela, uma faixa escura de 3 a 4 px; no arco de cima à esquerda, o fio claro
 * da quina; e a sombra pousada, firme, um pouco para baixo e à direita. O
 * fosso escurece para dentro; a plataforma CLAREIA no topo: é esse contraste
 * que separa os dois. O verde do anel perdeu um quarto da saturação e o canal
 * ficou mais escuro (na hierarquia do lote, o verde fica abaixo dos dois
 * vermelhos). As argolas cresceram 30% e têm o ferro da ponte de corrente.
 *
 * Esticada, os anéis viram elipse pela pegada; os pilaretes, as juntas e o fio
 * verde continuam com a medida em px do protótipo. Materiais: `pedra` (o
 * disco e os pilaretes) e `metal` (as argolas). O verde é fixo.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { comMeioEm, deslocada, montadaNaTela, solta } from './andaimeDaTresQuartos'
import { BRILHO_DO_FERRO_DA_PONTE, texDoFerroDaPonte, TOM_DO_FERRO_DA_PONTE } from './ponteDeCorrente'

const VOLTA = Math.PI * 2

// ---------- a planta (fração da meia pegada) ----------

/** Os anéis de pedra, de fora para dentro: a guia, as lajes de fora, o canal do anel mágico, as lajes de dentro e o medalhão. */
const GUIA = 0.925
const CANAL: readonly [number, number] = [0.575, 0.665]
const MEDALHAO = 0.3
/** Quantas pedras cada anel tem e o desencontro delas: a guia, as lajes de fora e as de dentro. */
const PEDRAS_DO_ANEL: readonly number[] = [40, 16, 8]
const DESENCONTRO: readonly number[] = [0.5, 0, 0.5]
/** O medalhão: o sulco torneado perto da beira e os oito raios talhados, de onde até onde. */
const SULCO_DO_MEDALHAO = 0.262
const RAIOS_DO_MEDALHAO = 8
const RAIO_TALHADO: readonly [number, number] = [0.1, 0.225]
/** O meio do canal, por onde corre o fio verde; os nós dele (um em cada eixo e diagonal) e os riscos da régua. */
const FIO = (CANAL[0] + CANAL[1]) / 2
const NOS_DO_FIO = 8
const RISCOS_DO_CANAL = 64
/** Os pilaretes: quantos, o giro do primeiro (graus) e onde ficam (fração da meia pegada). */
const PILARETES = 8
const GIRO_DOS_PILARETES = 22.5
const PILARETE_EM = 0.845

// ---------- os pilaretes (casas) ----------

/** O meio lado, a altura e a laje mais larga do pé (o rodapé). */
const MEIO_PILARETE = 0.105
const ALTURA_DO_PILARETE = 0.5
const MEIO_RODAPE = 0.14
/**
 * A argola: quanto o meio dela fica para fora do pilarete (casas), os raios, a grossura e a altura em que pende na
 * 3/4. São 30% maiores que as da primeira versão, que sumiam no tamanho de mesa.
 */
const ARGOLA_ALEM = 0.235
const ARGOLA: readonly [number, number] = [0.137, 0.098]
const GROSSURA_DA_ARGOLA = 0.034
const ALTURA_DA_ARGOLA = 0.26
/** As quatro águas da pirâmide pela direção na tela: a do norte e a do oeste pegam luz, a do sul e a do leste ficam na sombra. */
const TOM_DAS_AGUAS: readonly number[] = [1.14, 0.82, 0.76, 1.06]

// ---------- a luz e o tempo ----------

/** Para onde a luz anda no chão. */
const LUZ_X = 0.79
const LUZ_Y = 0.61
const JUNTA = 0.85
const FORCA_DA_JUNTA = 0.26
const TOM_DAS_PEDRAS = 0.13
/** O tom de cada anel: a laje CLAREIA no topo, da guia ao medalhão polido do meio (o contrário do fosso, que escurece para dentro). */
const TOM_DA_GUIA = 1.03
const TOM_DE_FORA = 1
const TOM_DE_DENTRO = 1.03
const TOM_DO_MEDALHAO = 1.08
const TOM_DO_CANAL = 0.58
/**
 * A ESPESSURA da laje. No arco de baixo à direita, a face de pé da borda: uma faixa escura (a largura em px, no
 * meio do arco, e o tom dela), que afina e some para os lados. No arco de cima à esquerda, o fio claro da quina.
 * `VIRADA` = em quanto do giro a faixa e o fio chegam inteiros. E a sombra pousada: quanto ela anda para baixo à
 * direita (px), a borda e a força (a de antes, força 0,36 sem deslocamento, não aparecia).
 */
const FAIXA_DA_BORDA = 3.8
const TOM_DA_FACE_DA_BORDA = 0.56
const FIO_DA_BORDA = 1.2
const LUZ_DO_FIO_DA_BORDA = 0.2
const VIRADA_DA_BORDA = 0.5
const ALTURA_DA_LAJE = 9
const BORDA_DA_SOMBRA_DA_LAJE = 2
const FORCA_DA_SOMBRA_DA_LAJE = 0.5
/** Quanto do salpico do granito fica na pedra: a metade do que o motor dá no disco, e a metade nos pilaretes. */
const SALPICO_NO_DISCO = 0.38
const SALPICO_NOS_PILARETES = 0.5
/** A sombra de cada pilarete no disco: a força e a borda (px). */
const FORCA_DA_SOMBRA = 0.3
const BORDA_DA_SOMBRA = 1.6
/** O musgo: aparece do lado da sombra, perto da guia. O limiar do ruído e quanto ele cobre no mais forte. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))
const LIMIAR_DO_MUSGO = 0.05
const ALFA_DO_MUSGO = 0.6
/** As trincas, em fração da meia pegada. */
const TRINCAS: readonly (readonly Ponto[])[] = [
  [[-0.98, 0.22], [-0.84, 0.17], [-0.74, 0.25], [-0.6, 0.2]],
  [[0.3, -0.55], [0.36, -0.42], [0.31, -0.32], [0.36, -0.2], [0.33, -0.08]],
]
const MEIA_TRINCA = 0.5
const FORCA_DA_TRINCA = 0.3

/**
 * O fio verde: o miolo claro, a beira e o brilho. Um verde só, de erva e não de menta: a beira tem saturação 0,34
 * (um quarto a menos que a da primeira versão, 0,46) e o brilho é mais fraco.
 */
const MIOLO_DO_FIO: Rgb = [0xc6, 0xde, 0xcb]
const BEIRA_DO_FIO: Rgb = [0x67, 0x9c, 0x7e]
const BRILHO_DO_FIO: Rgb = [0x88, 0xb8, 0x97]
const MEIO_FIO = 0.95
const MIOLO = 0.4
const BRILHO = 5.5
const ALFA_DO_BRILHO = 0.17
/** O escuro em que o pixel escuro demais é levantado: o cinza quente da pedra. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

const DA_PEDRA = texturaDaClasse('pedra')

/** A pedra dos pilaretes: a do material, com o salpico do granito à metade (multiplicado na cor: o tom escuro dela, nunca preto). */
const DA_PEDRA_MANSA: Textura = (u, v, x, y, p, s, escala) => {
  if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
  s[6] *= SALPICO_NOS_PILARETES
}

function limitar01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t
}

function suave01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
}

/** A distância (px) do ponto à linha quebrada. */
function ateALinha(pontos: readonly Ponto[], x: number, y: number): number {
  let menor = Infinity
  for (let i = 1; i < pontos.length; i += 1) {
    const [ax, ay] = pontos[i - 1]
    const dx = pontos[i][0] - ax
    const dy = pontos[i][1] - ay
    let h = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)
    h = h < 0 ? 0 : h > 1 ? 1 : h
    const qx = x - ax - dx * h
    const qy = y - ay - dy * h
    const dd = qx * qx + qy * qy
    if (dd < menor) menor = dd
  }
  return Math.sqrt(menor)
}

/** Onde fica o pilarete `i` (px, a partir do meio) e a direção dele para fora. */
function pilarete(c: ContextoDoMovel, i: number): { x: number; y: number; co: number; si: number } {
  const a = ((GIRO_DOS_PILARETES + (i * 360) / PILARETES) * Math.PI) / 180
  const [co, si] = [Math.cos(a), Math.sin(a)]
  return { x: co * PILARETE_EM * c.hw, y: si * PILARETE_EM * c.hh, co, si }
}

/**
 * A pintura do disco num passo só por pixel: a pedra do anel em que o ponto cai (o tom, a pedra, as juntas, o
 * talhe do medalhão), o musgo, as trincas, a sombra dos pilaretes e, no canal, o fio verde com o brilho dele.
 */
function texDoDisco(c: ContextoDoMovel, pedra: MaterialDaPeca): Textura {
  const { hw, hh, g } = c
  const R = Math.min(hw, hh)
  const sorteio = Math.round(c.w + 7 * c.h)
  const [pr, pg, pb] = pedra.rgb
  const trincas = TRINCAS.map((linha) => {
    const pontos = linha.map(([x, y]): Ponto => [x * hw, y * hh])
    const xs = pontos.map(([x]) => x)
    const ys = pontos.map(([, y]) => y)
    return { pontos, x0: Math.min(...xs) - 2, y0: Math.min(...ys) - 2, x1: Math.max(...xs) + 2, y1: Math.max(...ys) + 2 }
  })
  // A sombra de cada pilarete: o rodapé arrastado do pé até a altura, para baixo à direita.
  const altura = ALTURA_DO_PILARETE * g
  const meio = MEIO_PILARETE * g
  const sombras = Array.from({ length: PILARETES }, (_, i) => {
    const p = pilarete(c, i)
    return capsula(p.x, p.y, p.x + SOMBRA_X * altura, p.y + SOMBRA_Y * altura, meio)
  })
  const musgo = misturar(TOM_DO_MUSGO, pedra.rgb, 0.3)

  return (u, v, x, y, p, s, escala) => {
    const X = x / hw
    const Y = y / hh
    const rho = Math.sqrt(X * X + Y * Y)
    const gx = X / hw
    const gy = Y / hh
    const gl = Math.sqrt(gx * gx + gy * gy)
    const pxPorRho = gl > 1e-9 ? rho / gl : R
    const co = rho > 1e-6 ? X / rho : 1
    const si = rho > 1e-6 ? Y / rho : 0
    const paraALuz = -(co * LUZ_X + si * LUZ_Y)
    let th = Math.atan2(Y, X)
    th -= Math.floor(th / VOLTA) * VOLTA
    const rpx = rho * pxPorRho

    s[3] = 0
    s[6] = 0
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    let luz = s[3]
    const pontilhado = s[6]
    s[3] = 0
    s[6] = 0

    // ---------- a pedra do anel ----------
    let tom: number
    const noCanal = rho > CANAL[0] && rho < CANAL[1]
    if (rho <= MEDALHAO) {
      tom = TOM_DO_MEDALHAO
      const doSulco = Math.abs(rho - SULCO_DO_MEDALHAO) * pxPorRho
      if (doSulco < 1.1) luz -= 0.2 * (1 - doSulco / 1.1)
      if (rho > RAIO_TALHADO[0] && rho < RAIO_TALHADO[1]) {
        const naVolta = (th / VOLTA) * RAIOS_DO_MEDALHAO
        const aoLado = Math.abs(naVolta - Math.floor(naVolta) - 0.5) * ((VOLTA * rpx) / RAIOS_DO_MEDALHAO)
        if (aoLado < 0.9) luz -= 0.2 * (1 - aoLado / 0.9)
      }
      // A beira do medalhão: uma junta em volta dele.
      const daBeira = (MEDALHAO - rho) * pxPorRho
      if (daBeira < JUNTA) luz -= FORCA_DA_JUNTA * (1 - daBeira / JUNTA)
    } else if (noCanal) {
      // O canal rebaixado: mais escuro, com a beira de cima à esquerda na sombra e a de baixo à direita na luz.
      tom = TOM_DO_CANAL
      const daBeiraDeFora = (CANAL[1] - rho) * pxPorRho
      const daBeiraDeDentro = (rho - CANAL[0]) * pxPorRho
      if (daBeiraDeFora < 2) luz -= 0.22 * (1 - daBeiraDeFora / 2) * paraALuz
      if (daBeiraDeDentro < 2) luz += 0.22 * (1 - daBeiraDeDentro / 2) * paraALuz
    } else {
      const anel = rho > GUIA ? 0 : rho > CANAL[1] ? 1 : 2
      tom = anel === 0 ? TOM_DA_GUIA : anel === 1 ? TOM_DE_FORA : TOM_DE_DENTRO
      const pedras = PEDRAS_DO_ANEL[anel]
      const naVolta = (th / VOLTA) * pedras + DESENCONTRO[anel]
      const qual = Math.floor(naVolta)
      const fa = naVolta - qual
      luz += (hash(((qual % pedras) + pedras) % pedras, anel, 3600 + sorteio) - 0.5) * TOM_DAS_PEDRAS
      const daJunta = (fa < 1 - fa ? fa : 1 - fa) * ((VOLTA * rpx) / pedras)
      // As juntas em raio e as juntas em volta (a da guia, a do canal dos dois lados e a do medalhão).
      const emVolta = Math.min(Math.abs(rho - GUIA), Math.abs(rho - CANAL[1]), Math.abs(rho - CANAL[0]), Math.abs(rho - MEDALHAO)) * pxPorRho
      const junta = daJunta < emVolta ? daJunta : emVolta
      if (junta < JUNTA) luz -= FORCA_DA_JUNTA * (1 - junta / JUNTA)
      else if (junta < JUNTA + 1 && paraALuz < 0) luz += 0.04
    }

    // ---------- as trincas ----------
    for (const trinca of trincas) {
      if (x < trinca.x0 || x > trinca.x1 || y < trinca.y0 || y > trinca.y1) continue
      const d = ateALinha(trinca.pontos, x, y)
      if (d < MEIA_TRINCA + 0.6) luz -= FORCA_DA_TRINCA * limitar01((MEIA_TRINCA + 0.6 - d) / 0.6) * (0.6 + 0.8 * ruido(x * 0.3 + 2, y * 0.3))
    }

    // ---------- a sombra dos pilaretes no disco (o do setor do ponto e os dois vizinhos) ----------
    const setor = Math.floor(((th * 180) / Math.PI - GIRO_DOS_PILARETES) / (360 / PILARETES) + 0.5)
    let naSombra = 0
    for (let k = setor - 1; k <= setor + 1; k += 1) {
      const d = sombras[((k % PILARETES) + PILARETES) % PILARETES].d(x, y)
      const q = 0.5 - d / (2 * BORDA_DA_SOMBRA)
      if (q > naSombra) naSombra = q
    }
    if (naSombra > 0) luz -= FORCA_DA_SOMBRA * (naSombra < 1 ? naSombra : 1)

    // ---------- a espessura da laje: a face de pé da borda (baixo à direita) e o fio claro da quina (cima à esquerda) ----------
    const daBorda = (1 - rho) * pxPorRho
    if (paraALuz < 0) {
      const virada = suave01(-paraALuz / VIRADA_DA_BORDA)
      const faixa = FAIXA_DA_BORDA * virada
      if (daBorda < faixa + 0.3) {
        const naFace = limitar01((faixa + 0.3 - daBorda) / 0.6)
        tom *= 1 - (1 - TOM_DA_FACE_DA_BORDA) * naFace
        // A quina de cima da face: um fio um pouco mais claro, onde o tampo acaba.
        if (daBorda > faixa - 0.5 && virada > 0.3) luz += 0.06
      }
    } else if (daBorda < FIO_DA_BORDA + 0.3) {
      luz += LUZ_DO_FIO_DA_BORDA * suave01(paraALuz / VIRADA_DA_BORDA) * limitar01((FIO_DA_BORDA + 0.3 - daBorda) / 0.6)
    }

    const f = 1 + pontilhado * SALPICO_NO_DISCO
    let cr = (pr * tom * (1 + luz) + 22 * luz) * f
    let cg = (pg * tom * (1 + luz) + 22 * luz) * f
    let cb = (pb * tom * (1 + luz) + 22 * luz) * f

    // ---------- o musgo: do lado da sombra da guia e nas juntas úmidas de fora ----------
    if (rho > CANAL[1] + 0.03) {
      const n = ruido(x * 0.085 + 13, y * 0.085 + 5) + 0.5 * ruido(x * 0.3 + 31, y * 0.3 + 17)
      const perto = limitar01((rho - 0.72) / 0.26)
      const a = ALFA_DO_MUSGO * limitar01((n - LIMIAR_DO_MUSGO) * 3.2) * perto * (0.45 + 0.55 * limitar01(0.5 - paraALuz))
      if (a > 0) {
        const grao = 1 + ruido(x * 1.3 + 3, y * 1.3 + 9) * 0.35
        cr += (musgo[0] * grao - cr) * a
        cg += (musgo[1] * grao - cg) * a
        cb += (musgo[2] * grao - cb) * a
      }
    }

    // ---------- o anel mágico: os riscos da régua, o fio com os nós e o brilho ----------
    const doCanal = Math.abs(rho - FIO) * pxPorRho
    if (doCanal < BRILHO + MEIO_FIO) {
      // Os nós: um losango em cada eixo e diagonal, em cima do fio.
      const naVoltaDosNos = (th / VOLTA) * NOS_DO_FIO + 0.5
      const aoLadoDoNo = (naVoltaDosNos - Math.floor(naVoltaDosNos) - 0.5) * ((VOLTA * rpx) / NOS_DO_FIO)
      const doNo = (Math.abs(aoLadoDoNo) + doCanal - 3.4) * 0.7
      // Os riscos: curtos, de través do canal, entre os nós.
      const naVoltaDosRiscos = (th / VOLTA) * RISCOS_DO_CANAL + 0.5
      const aoLadoDoRisco = Math.abs(naVoltaDosRiscos - Math.floor(naVoltaDosRiscos) - 0.5) * ((VOLTA * rpx) / RISCOS_DO_CANAL)
      const doRisco = Math.hypot(aoLadoDoRisco, Math.max(0, doCanal - 2.6)) + 0.45
      const d = Math.min(doCanal, doNo < 0 ? 0 : doNo, Math.abs(aoLadoDoNo) > 5 ? doRisco : 9)
      const respiro = 0.82 + 0.3 * ruido(x * 0.1 + 7, y * 0.1 + 23)
      const perto = 1 - limitar01((d - MEIO_FIO) / BRILHO)
      const aBrilho = ALFA_DO_BRILHO * perto * perto * respiro
      cr += (BRILHO_DO_FIO[0] - cr) * aBrilho
      cg += (BRILHO_DO_FIO[1] - cg) * aBrilho
      cb += (BRILHO_DO_FIO[2] - cb) * aBrilho
      const aFio = limitar01(0.5 - (d - MEIO_FIO) * escala)
      if (aFio > 0) {
        const miolo = limitar01(0.5 - (d - MIOLO) * escala) * respiro
        cr += (BEIRA_DO_FIO[0] + (MIOLO_DO_FIO[0] - BEIRA_DO_FIO[0]) * miolo - cr) * aFio
        cg += (BEIRA_DO_FIO[1] + (MIOLO_DO_FIO[1] - BEIRA_DO_FIO[1]) * miolo - cg) * aFio
        cb += (BEIRA_DO_FIO[2] + (MIOLO_DO_FIO[2] - BEIRA_DO_FIO[2]) * miolo - cb) * aFio
      }
    }

    s[0] = cr
    s[1] = cg
    s[2] = cb
  }
}

const montar: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const pedra = c.m.pedra
  // A pedra dos pilaretes é LISA: a frente que a 3/4 varre leva o material da peça, e com a classe da pedra saía com
  // o salpico inteiro. O grão dos tampos vem da textura (`DA_PEDRA_MANSA`), que lê o tipo de pedra daqui.
  const pedraDoPilarete: MaterialDaPeca = { ...pedra, classe: 'liso' }
  const ferro = c.m.metal
  const L: Peca[] = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA

  // ---------- o disco: a laje elevada, com a sombra pousada para baixo à direita ----------
  // A sombra é a do disco deslocado, sem altura: com altura, o disco viraria coluna na 3/4 e subiria com a frente dele.
  const disco = elipse(0, 0, c.hw, c.hh)
  cena.sombras.push({ forma: deslocada(disco, SOMBRA_X * ALTURA_DA_LAJE, SOMBRA_Y * ALTURA_DA_LAJE), z: 0, suave: BORDA_DA_SOMBRA_DA_LAJE, forca: FORCA_DA_SOMBRA_DA_LAJE })
  L.push(P(disco, pedra, { tabua: 0, bisel: 1.2, contorno: 0.28, textura: texDoDisco(c, pedra), semente: 3601 }))

  // ---------- os pilaretes: o rodapé, a coluna com as quatro águas da pirâmide e a argola pendurada por fora ----------
  const meio = MEIO_PILARETE * g
  const rodape = MEIO_RODAPE * g
  const alto = ALTURA_DO_PILARETE * g
  for (let i = 0; i < PILARETES; i += 1) {
    const { x, y, co, si } = pilarete(c, i)
    const semente = 3610 + i * 10

    // A argola: de cima, deitada para fora; na 3/4, um tampo solto a meia altura (sem beirada: é um aro).
    const [ax, ay] = [x + co * ARGOLA_ALEM * g, y + si * ARGOLA_ALEM * g]
    const giro = Math.atan2(si, co)
    const aro: Forma = menos(
      elipseGirada(ax, ay, ARGOLA[0] * g, ARGOLA[1] * g, giro),
      elipseGirada(ax, ay, (ARGOLA[0] - GROSSURA_DA_ARGOLA * 2) * g, (ARGOLA[1] - GROSSURA_DA_ARGOLA * 2) * g, giro),
    )
    // O olhal: o toco de ferro que sai do pilarete e segura a argola.
    const olhal = capsula(x + co * meio * 0.8, y + si * meio * 0.8, ax - co * (ARGOLA[0] - GROSSURA_DA_ARGOLA) * g, ay - si * (ARGOLA[0] - GROSSURA_DA_ARGOLA) * g, GROSSURA_DA_ARGOLA * g)
    cena.sombras.push(solta(elipseGirada(ax, ay, ARGOLA[0] * g, ARGOLA[1] * g, giro), ALTURA_DA_ARGOLA * g))
    // O ferro das argolas é o da ponte de corrente: o mesmo tom, o mesmo brilho e a mesma ferrugem.
    const doFerro = { tabua: 0, bisel: GROSSURA_DA_ARGOLA * g * 0.9, tom: TOM_DO_FERRO_DA_PONTE, metal: BRILHO_DO_FERRO_DA_PONTE, contorno: 0.3, textura: texDoFerroDaPonte, projeta: { dist: 1.2, forca: 0.3 } }
    L.push(P(comMeioEm(olhal, ax, ay), ferro, { ...doFerro, tom: 0.9, semente: semente + 1 }))
    L.push(P(comMeioEm(aro, ax, ay), ferro, { ...doFerro, semente: semente + 2 }))

    // O rodapé: a laje baixa em volta do pé, rente ao disco (sem altura: com ela, a tira de trás sairia por cima da
    // coluna na 3/4). O meio da caixa da peça fica na quina de fora, fora do pilarete: ela não sobe com ele.
    const pe = caixa(x - rodape, y - rodape, x + rodape, y + rodape, 0.8)
    L.push(P(comMeioEm(pe, x - (rodape + meio) / 2, y - (rodape + meio) / 2), pedraDoPilarete, { tabua: 0, bisel: 1, tom: 0.84, contorno: 0.3, textura: DA_PEDRA_MANSA, semente }))

    // A coluna e as quatro águas (norte, leste, sul, oeste NA TELA), cada uma com a luz dela.
    const coluna = caixa(x - meio, y - meio, x + meio, y + meio, 0.5)
    cena.sombras.push({ forma: coluna, z: alto, suave: 1.6 })
    L.push(P(coluna, pedraDoPilarete, { tabua: 0, bisel: 0.8, tom: 0.9, contorno: 0.3, textura: DA_PEDRA_MANSA, semente: semente + 3 }))
    const cantos: readonly Ponto[] = [[x - meio, y - meio], [x + meio, y - meio], [x + meio, y + meio], [x - meio, y + meio]]
    cantos.forEach((canto, k) => {
      const agua = poligono([canto, cantos[(k + 1) % 4], [x, y]])
      // O meio da caixa de cada água cai dentro da coluna: ela sobe com a coluna.
      L.push(P(agua, pedraDoPilarete, { tabua: 0, bisel: 0, tom: TOM_DAS_AGUAS[k], contorno: 0.14, textura: DA_PEDRA_MANSA, semente: semente + 4 + k }))
    })
  }
}

/** Montada na tela e devolvida ao referencial do objeto: igual dos quatro lados. */
export const montarPlataformaDeRitual: MontarMovel = montadaNaTela(montar)
