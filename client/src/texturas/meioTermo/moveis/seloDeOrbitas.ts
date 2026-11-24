/**
 * SELO DE ÓRBITAS no chão (lote L04 de 24/11/2026, a Fortaleza do ritual;
 * versão do círculo mágico). Um selo antigo ENTALHADO no piso, e não riscado a
 * giz: dois ANÉIS de fora com uma faixa de riscos e losangos entre eles, duas
 * ÓRBITAS (duas elipses iguais, cruzadas em X no meio), um losango gravado em
 * cada ponta delas e um em cada órbita e, no meio, o disco das DUAS METADES
 * que giram uma na outra, de pedra INCRUSTADA em dois tons (a clara e a
 * cinza-azulada escura), cada uma com o ponto da outra. No fundo de cada
 * sulco corre um fio azul fraco, e um brilho azul muito leve em volta diz que
 * o selo está ativo; não é fonte de luz (quem ilumina é o integrador, se o
 * mestre quiser).
 *
 * Revisão do diretor de arte (24/11/2026): a primeira versão, de fio claro em
 * traço igual, três elipses com bolinhas e um disco azul-marinho e branco
 * chapado, lia como o logotipo do átomo com um yin-yang de clip-art, flutuando
 * sobre o chão. Agora cada linha é um SULCO escuro de uns 2 px, com a beira
 * de baixo à direita pegando luz (é isso que diz entalhe) e o fio azul DENTRO
 * dele; as elipses são duas; as bolinhas viraram losangos gravados; o disco é
 * pedra, com a borda gasta e uma trinca; e o brilho azul tem a metade da
 * força. Na hierarquia do lote, o azul fica abaixo dos dois vermelhos.
 *
 * O que o separa do círculo mágico: lá o traço é de giz, torto, com falha e
 * borrão; aqui é talhe de compasso, gasto pelo tempo (o sulco engrossa e
 * afina um pouco, e duas TRINCAS do piso apagam o fio onde passam).
 *
 * É objeto de CHÃO RENTE, como o círculo mágico: nenhuma sombra, nenhuma
 * altura; mora por baixo dos outros objetos e das fichas, e a 3/4 sai igual à
 * vista de cima. O selo inteiro é UMA peça com textura própria (a distância a
 * cada sulco, em dois passos por pixel: o ponto e o vizinho dele do lado da
 * luz).
 *
 * O selo é REDONDO: sai do menor lado da pegada. Esticado, sobra chão dos
 * lados; as órbitas não viram ovais tortos. O sulco não engrossa com o
 * tamanho: a largura dele é em px do protótipo.
 *
 * Para ler em chão claro e em chão escuro: o sulco é o ESCURO do próprio piso
 * (um escuro neutro meio transparente por cima dele, o que aparece no chão
 * claro) e a beira iluminada e o fio azul são claros (o que aparece no chão
 * escuro). Sem material no painel: as cores são fixas.
 */
import type { Rgb } from '../../ruido'
import { elipse, type Ponto } from './formas'
import { ruido, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

const GRAU = Math.PI / 180

// ---------- o desenho (fração do raio do selo, ou px do protótipo quando diz) ----------

/** Os dois anéis de fora, com a faixa de riscos e losangos entre eles. */
const ANEL_DE_FORA = 0.95
const ANEL_DE_DENTRO = 0.84
/**
 * A faixa: um risco curto de través a cada 15 graus (de onde até onde) e, nos quatro eixos, um losango no lugar
 * do risco (os meios eixos em px: ao longo do raio e de través).
 */
const RISCOS_DA_FAIXA = 24
const LOSANGO_A_CADA = 6
const RISCO: readonly [number, number] = [0.87, 0.92]
const MEIO_DA_FAIXA = (ANEL_DE_FORA + ANEL_DE_DENTRO) / 2
const LOSANGO_DA_FAIXA: readonly [number, number] = [3, 2.2]
/** As duas órbitas, cruzadas em X: o meio eixo maior (a ponta encosta no anel de dentro), o menor e o giro da primeira (graus). */
const ORBITAS = 2
const EIXO_MAIOR = ANEL_DE_DENTRO
const EIXO_MENOR = 0.36
const GIRO_DAS_ORBITAS = -45
/** O losango gravado em cada ponta das órbitas, em cima do anel de dentro, e o de cada órbita (onde fica na volta dela, em graus). */
const LOSANGO_DA_PONTA: readonly [number, number] = [3.6, 2.6]
const LOSANGOS_DAS_ORBITAS: readonly number[] = [38, 164]
const LOSANGO_DA_ORBITA: readonly [number, number] = [2.9, 2.1]
/** O disco do meio: o raio, o giro das duas metades (graus), o raio do ponto de cada uma (fração do disco) e a folga do sulco em volta dele (px). */
const DISCO = 0.25
const GIRO_DO_DISCO = 24
const PONTO_DA_METADE = 0.15
const SULCO_DO_DISCO = 1.1

// ---------- o talhe (meias larguras, px do protótipo) ----------

/** O sulco das linhas (perto de 2 px de largura), o dos riscos da faixa, mais fino, e o fio azul no fundo do sulco. */
const MEIO_SULCO = 0.95
const MEIO_RISCO = 0.6
const MEIO_FIO = 0.3
/** O talhe gasto: quanto a largura do sulco muda ao longo dele e o tamanho do trecho (px por volta do ruído). */
const GASTO_DO_SULCO = 0.32
const TRECHO_DO_GASTO = 6
/** De onde a luz vem no chão (a do motor) e a quantos px do sulco a beira dele pega luz. */
const LUZ_X = 0.79
const LUZ_Y = 0.61
const PASSO_DA_LUZ = 1.05
/** Em volta do sulco: até onde o brilho azul vai (px). */
const BRILHO = 3

/**
 * As cores. O sulco é um escuro neutro e quente, meio transparente: sobre o piso, dá o tom escuro do próprio piso.
 * A beira iluminada é a pedra clara. O fio e o brilho são um azul só, contido (saturação 0,36), e fracos. O disco:
 * a pedra clara e a cinza-azulada escura (luminância linear 0,10, bem acima do piso de luz), opacas.
 */
const COR_DO_SULCO: Rgb = [0x2c, 0x2a, 0x27]
const COR_DA_BEIRA: Rgb = [0xea, 0xe4, 0xd6]
const COR_DO_FIO: Rgb = [0x8c, 0xb2, 0xdc]
const COR_DO_BRILHO: Rgb = [0x8f, 0xbd, 0xf0]
const PEDRA_CLARA: Rgb = [0xbe, 0xb8, 0xac]
const PEDRA_ESCURA: Rgb = [0x55, 0x5d, 0x68]
const ALFA_DO_SULCO = 0.6
const ALFA_DA_BEIRA = 0.38
const ALFA_DO_FIO = 0.56
/** O brilho azul em volta do sulco e o halo do disco: a metade da força da primeira versão (0,2 e 0,16). */
const ALFA_DO_BRILHO = 0.1
const HALO_DO_DISCO = 2.1
const ALFA_DO_HALO = 0.08
/** O fio respira ao longo do sulco: quanto ele cai nos trechos fracos e o tamanho do trecho (px por volta do ruído). */
const RESPIRO_DO_FIO = 0.3
const TRECHO_DO_RESPIRO = 9
/** A pedra do disco: o grão (a variação de luz, em dois tamanhos), a junta entre as duas metades (px e força) e a borda gasta (até quantos px ela recua). */
const GRAO_DA_PEDRA: readonly [number, number] = [0.12, 0.07]
const JUNTA_DAS_METADES = 0.5
const FORCA_DA_JUNTA = 0.4
const LASCA_DA_BORDA = 1.7
/**
 * O tom mais escuro da pedra do disco (na junta e na trinca): na metade escura e na clara. Sem este piso a trinca
 * da metade escura saía quase preta, e o motor, ao levantá-la, parava em 0,035 de luminância linear, abaixo do piso
 * de luz (a mistura dele é em sRGB e rende menos que a conta linear). Com 0,68, a pedra escura fica em 0,049.
 */
const TOM_MINIMO_DA_PEDRA: readonly [number, number] = [0.68, 0.4]
/** A trinca do disco: uma linha quebrada de lado a lado (fração do raio do disco), a meia largura (px) e a força. */
const TRINCA_DO_DISCO: readonly Ponto[] = [[-1.02, -0.3], [-0.5, -0.12], [-0.22, -0.3], [0.2, -0.06], [0.52, -0.2], [1.02, 0.08]]
const MEIA_TRINCA = 0.45
const FORCA_DA_TRINCA = 0.5

/**
 * As trincas do piso: cada uma é uma linha quebrada (fração do raio) que apaga o fio azul onde passa; a meia
 * largura do corte (px) e a faixa em que o fio volta.
 */
const TRINCAS: readonly (readonly Ponto[])[] = [
  [[-1.02, -0.3], [-0.74, -0.24], [-0.52, -0.4], [-0.3, -0.36]],
  [[0.36, 1.02], [0.42, 0.72], [0.6, 0.52], [0.58, 0.3]],
]
const CORTE_DA_TRINCA = 0.55
const VOLTA_DO_FIO = 0.7

function limitar01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t
}

/** Uma órbita: o cosseno e o seno do giro dela e os dois meios eixos (px). */
interface Orbita {
  readonly c: number
  readonly s: number
  readonly a: number
  readonly b: number
}

/** Um losango gravado: o meio (px), o rumo do eixo `a` e os dois meios eixos (px). */
interface Losango {
  readonly x: number
  readonly y: number
  readonly ux: number
  readonly uy: number
  readonly a: number
  readonly b: number
}

/** A distância (px) do ponto ao fio da órbita (a aproximação da elipse de `formas.ts`, boa perto do fio). */
function ateAOrbita(o: Orbita, x: number, y: number): number {
  const px = x * o.c + y * o.s
  const py = -x * o.s + y * o.c
  const k0 = Math.sqrt((px * px) / (o.a * o.a) + (py * py) / (o.b * o.b))
  const k1 = Math.sqrt((px * px) / (o.a * o.a * o.a * o.a) + (py * py) / (o.b * o.b * o.b * o.b))
  return k1 > 1e-9 ? Math.abs((k0 * (k0 - 1)) / k1) : o.b
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

/**
 * A pintura do selo. Para cada pixel, quanto ele está FORA do talhe (px; negativo dentro): a distância aos sulcos
 * das linhas (os anéis, as órbitas, a volta do disco), aos riscos da faixa e aos losangos gravados. Com ela, de
 * baixo para cima: o brilho azul, a beira que pega luz (o talhe medido um passo para o lado da luz), o sulco
 * escuro e o fio azul no fundo dele; por fim, a pedra incrustada do disco. Fora disso o pixel fica transparente.
 */
function texDoSelo(c: ContextoDoMovel): Textura {
  const R = Math.min(c.hw, c.hh)
  const orbitas: Orbita[] = []
  const losangos: Losango[] = []
  for (let k = 0; k < ORBITAS; k += 1) {
    const giro = (GIRO_DAS_ORBITAS + (k * 180) / ORBITAS) * GRAU
    const [co, si] = [Math.cos(giro), Math.sin(giro)]
    const [a, b] = [EIXO_MAIOR * R, EIXO_MENOR * R]
    orbitas.push({ c: co, s: si, a, b })
    for (const lado of [-1, 1]) losangos.push({ x: co * a * lado, y: si * a * lado, ux: co, uy: si, a: LOSANGO_DA_PONTA[0], b: LOSANGO_DA_PONTA[1] })
    // O losango de cada órbita: em cima do fio dela, com a ponta ao longo dele.
    const t = LOSANGOS_DAS_ORBITAS[k % LOSANGOS_DAS_ORBITAS.length] * GRAU
    const [lx, ly] = [a * Math.cos(t), b * Math.sin(t)]
    const [tx, ty] = [-a * Math.sin(t), b * Math.cos(t)]
    const tl = Math.hypot(tx, ty) || 1
    losangos.push({ x: co * lx - si * ly, y: si * lx + co * ly, ux: (co * tx - si * ty) / tl, uy: (si * tx + co * ty) / tl, a: LOSANGO_DA_ORBITA[0], b: LOSANGO_DA_ORBITA[1] })
  }
  for (let k = 0; k < 4; k += 1) {
    const [co, si] = [Math.cos(k * 90 * GRAU), Math.sin(k * 90 * GRAU)]
    losangos.push({ x: co * MEIO_DA_FAIXA * R, y: si * MEIO_DA_FAIXA * R, ux: co, uy: si, a: LOSANGO_DA_FAIXA[0], b: LOSANGO_DA_FAIXA[1] })
  }
  const trincas = TRINCAS.map((linha) => linha.map(([x, y]): Ponto => [x * R, y * R]))
  const rDisco = DISCO * R
  const trincaDoDisco = TRINCA_DO_DISCO.map(([x, y]): Ponto => [x * rDisco, y * rDisco])
  const [cd, sd] = [Math.cos(GIRO_DO_DISCO * GRAU), Math.sin(GIRO_DO_DISCO * GRAU)]
  const passoDaFaixa = (Math.PI * 2) / RISCOS_DA_FAIXA

  /** A distância (px) ao meio do sulco de linha mais perto: os dois anéis, as órbitas e a volta do disco. */
  const ateOSulco = (x: number, y: number, r: number): number => {
    let d = Math.min(Math.abs(r - R * ANEL_DE_FORA), Math.abs(r - R * ANEL_DE_DENTRO), Math.abs(r - rDisco - SULCO_DO_DISCO))
    if (r < R * ANEL_DE_DENTRO + BRILHO + 2) for (const o of orbitas) d = Math.min(d, ateAOrbita(o, x, y))
    return d
  }

  /** Quanto o ponto está fora do talhe fino (px; negativo dentro): os riscos da faixa e os losangos gravados. */
  const foraDoTalheFino = (x: number, y: number, r: number): number => {
    let fora = Infinity
    if (r > R * RISCO[0] - BRILHO - 2 && r < R * RISCO[1] + BRILHO + 2) {
      const a = Math.atan2(y, x)
      const j = Math.round(a / passoDaFaixa)
      if (j % LOSANGO_A_CADA !== 0) {
        const aoLado = Math.abs(a - j * passoDaFaixa) * r
        const aoLongo = Math.max(R * RISCO[0] - r, r - R * RISCO[1], 0)
        fora = Math.sqrt(aoLado * aoLado + aoLongo * aoLongo) - MEIO_RISCO
      }
    }
    for (const l of losangos) {
      const [px, py] = [x - l.x, y - l.y]
      const noLosango = (Math.abs(px * l.ux + py * l.uy) / l.a + Math.abs(-px * l.uy + py * l.ux) / l.b - 1) * Math.min(l.a, l.b) * 0.7
      if (noLosango < fora) fora = noLosango
    }
    return fora
  }

  return (_u, _v, x, y, _p, s, escala) => {
    const r = Math.sqrt(x * x + y * y)
    s[4] = 1
    if (r > R * ANEL_DE_FORA + BRILHO + 1) {
      s[5] = 0
      return
    }

    const gasto = 1 - GASTO_DO_SULCO * (0.5 + ruido(x / TRECHO_DO_GASTO + 11, y / TRECHO_DO_GASTO + 5))
    const doSulco = ateOSulco(x, y, r)
    const fora = Math.min(doSulco - MEIO_SULCO * gasto, foraDoTalheFino(x, y, r))
    const noDisco = r < rDisco + 0.5
    const halo = r > rDisco ? ALFA_DO_HALO * limitar01(1 - (r - rDisco) / (rDisco * (HALO_DO_DISCO - 1))) ** 2 : 0
    if (fora > BRILHO + PASSO_DA_LUZ && !noDisco && halo <= 0) {
      s[5] = 0
      return
    }

    // ---- as trincas do piso: onde passam, o fio azul some ----
    let inteiro = 1
    for (const linha of trincas) inteiro = Math.min(inteiro, limitar01((ateALinha(linha, x, y) - CORTE_DA_TRINCA) / VOLTA_DO_FIO))
    const respiro = 1 - RESPIRO_DO_FIO * (0.5 + ruido(x / TRECHO_DO_RESPIRO + 31, y / TRECHO_DO_RESPIRO + 7))

    // ---- o talhe: o sulco, a beira de baixo à direita, que pega luz, e o fio azul no fundo ----
    const noSulco = limitar01(0.5 - fora * escala)
    const [lx, ly] = [x - LUZ_X * PASSO_DA_LUZ, y - LUZ_Y * PASSO_DA_LUZ]
    const rl = Math.sqrt(lx * lx + ly * ly)
    const foraNaLuz = Math.min(ateOSulco(lx, ly, rl) - MEIO_SULCO * gasto, foraDoTalheFino(lx, ly, rl))
    const naBeira = limitar01(0.5 - foraNaLuz * escala) * (1 - noSulco)
    const noFio = limitar01(0.5 - (doSulco - MEIO_FIO) * escala) * inteiro * respiro
    const perto = 1 - limitar01(fora / BRILHO)

    // De baixo para cima: o brilho, a beira clara, o sulco escuro e o fio azul.
    let cr = COR_DO_BRILHO[0]
    let cg = COR_DO_BRILHO[1]
    let cb = COR_DO_BRILHO[2]
    let a = Math.max(ALFA_DO_BRILHO * inteiro * respiro * perto * perto, halo)
    const cobrir = (r0: number, g0: number, b0: number, k: number): void => {
      if (k <= 0) return
      const junto = k + a * (1 - k)
      cr = (r0 * k + cr * a * (1 - k)) / junto
      cg = (g0 * k + cg * a * (1 - k)) / junto
      cb = (b0 * k + cb * a * (1 - k)) / junto
      a = junto
    }
    cobrir(COR_DA_BEIRA[0], COR_DA_BEIRA[1], COR_DA_BEIRA[2], ALFA_DA_BEIRA * naBeira)
    cobrir(COR_DO_SULCO[0], COR_DO_SULCO[1], COR_DO_SULCO[2], ALFA_DO_SULCO * noSulco)
    cobrir(COR_DO_FIO[0], COR_DO_FIO[1], COR_DO_FIO[2], ALFA_DO_FIO * noFio)

    if (noDisco) {
      // ---- a pedra incrustada: as duas metades, no disco de raio 1 ----
      // A clara é a metade da direita sem a roda de baixo, mais a roda de cima; cada metade leva o ponto da outra.
      // Distância com sinal (negativa na clara), em raios do disco.
      const qx = (x * cd + y * sd) / rDisco
      const qy = (-x * sd + y * cd) / rDisco
      const deCima = Math.hypot(qx, qy + 0.5)
      const deBaixo = Math.hypot(qx, qy - 0.5)
      const clara = Math.min(Math.max(-qx, 0.5 - deBaixo), deCima - 0.5)
      const comPontos = Math.min(Math.max(clara, PONTO_DA_METADE - deCima), deBaixo - PONTO_DA_METADE)
      const k = limitar01(0.5 - comPontos * rDisco * escala)
      // O grão da pedra, a junta escura entre as duas metades e a trinca que atravessa o disco.
      let luz = GRAO_DA_PEDRA[0] * ruido(x * 0.45 + 3, y * 0.45 + 17) + GRAO_DA_PEDRA[1] * ruido(x * 1.6 + 9, y * 1.6 + 2)
      const daJunta = Math.abs(comPontos) * rDisco
      if (daJunta < JUNTA_DAS_METADES + 0.5) luz -= FORCA_DA_JUNTA * limitar01((JUNTA_DAS_METADES + 0.5 - daJunta) / 0.5)
      const daTrinca = ateALinha(trincaDoDisco, x, y)
      if (daTrinca < MEIA_TRINCA + 0.5) luz -= FORCA_DA_TRINCA * limitar01((MEIA_TRINCA + 0.5 - daTrinca) / 0.5) * (0.7 + 0.6 * ruido(x * 0.4 + 2, y * 0.4))
      // A borda gasta: aqui e ali o disco recua e deixa ver o sulco em volta dele.
      const lasca = LASCA_DA_BORDA * limitar01((ruido(x * 0.3 + 3, y * 0.3 + 9) - 0.14) * 4)
      const piso = TOM_MINIMO_DA_PEDRA[0] + (TOM_MINIMO_DA_PEDRA[1] - TOM_MINIMO_DA_PEDRA[0]) * k
      const tom = 1 + luz < piso ? piso : 1 + luz
      cobrir(
        (PEDRA_ESCURA[0] + (PEDRA_CLARA[0] - PEDRA_ESCURA[0]) * k) * tom,
        (PEDRA_ESCURA[1] + (PEDRA_CLARA[1] - PEDRA_ESCURA[1]) * k) * tom,
        (PEDRA_ESCURA[2] + (PEDRA_CLARA[2] - PEDRA_ESCURA[2]) * k) * tom,
        limitar01(0.5 + (rDisco - lasca - r) * escala),
      )
    }
    s[0] = cr
    s[1] = cg
    s[2] = cb
    s[5] = a
  }
}

export const montarSeloDeOrbitas: MontarMovel = (c, cena) => {
  const R = Math.min(c.hw, c.hh)
  // O escuro em que a pedra escura do disco seria levantada, se caísse abaixo do piso de luz: o próprio tom dela.
  cena.corDoPiso = PEDRA_ESCURA
  cena.partes.push(c.peca(elipse(0, 0, R, R), { classe: 'liso', rgb: PEDRA_CLARA }, { bisel: 0, contorno: 0, textura: texDoSelo(c), semente: 3501 }))
}
