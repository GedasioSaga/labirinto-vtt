/**
 * SELO DE ÓRBITAS no chão (lote L04 de 24/11/2026, a Fortaleza do ritual;
 * versão do círculo mágico). Um selo antigo EMBUTIDO no piso, e não riscado a
 * giz: dois ANÉIS de fora com a régua de graus entre eles, três ÓRBITAS (três
 * elipses iguais cruzadas no meio, a 60 graus uma da outra), um astro pequeno
 * em cada órbita, um ponto em cada ponta delas e, no meio, o disco das DUAS
 * METADES que giram uma na outra, a clara e a escura, cada uma com o ponto da
 * outra. Um brilho azul fraco em volta dos traços diz que ele está ativo; não
 * é fonte de luz (quem ilumina é o integrador, se o mestre quiser).
 *
 * O que o separa do círculo mágico: lá o traço é de giz, torto, com falha e
 * borrão; aqui é fio de metal claro embutido, de compasso, igual na volta
 * inteira. O tempo aparece só em duas TRINCAS do piso, que cortam o fio onde
 * passam, e no brilho que respira um pouco ao longo dele.
 *
 * É objeto de CHÃO RENTE, como o círculo mágico: nenhuma sombra, nenhuma
 * altura; mora por baixo dos outros objetos e das fichas, e a 3/4 sai igual à
 * vista de cima. O selo inteiro é UMA peça com textura própria (a distância a
 * cada traço, num passo só por pixel).
 *
 * O selo é REDONDO: sai do menor lado da pegada. Esticado, sobra chão dos
 * lados; as órbitas não viram ovais tortos. O traço não engrossa com o
 * tamanho: a largura dele é em px do protótipo.
 *
 * Para aparecer em chão claro e em chão escuro, o fio tem o miolo quase branco
 * e a beira azul, e por fora uma borda escura fina e meio transparente; o
 * brilho vem por baixo de tudo. As cores não pegam luz nem sombra (a emissão
 * da textura). Sem material no painel: o fio é fixo.
 */
import type { Rgb } from '../../ruido'
import { elipse, type Ponto } from './formas'
import { ruido, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
const GRAU = Math.PI / 180

// ---------- o desenho (fração do raio do selo, ou px do protótipo quando diz) ----------

/** Os dois anéis de fora, com a régua de graus entre eles. */
const ANEL_DE_FORA = 0.95
const ANEL_DE_DENTRO = 0.84
/** A régua: quantos riscos na volta, de quantos em quantos um é comprido, e de onde até onde vai o curto e o comprido. */
const RISCOS_DA_REGUA = 72
const RISCO_COMPRIDO_A_CADA = 6
const RISCO_CURTO: readonly [number, number] = [0.875, 0.915]
const RISCO_COMPRIDO: readonly [number, number] = [0.855, 0.935]
/** As três órbitas: o meio eixo maior (a ponta encosta no anel de dentro), o menor e o giro da primeira (graus). */
const ORBITAS = 3
const EIXO_MAIOR = ANEL_DE_DENTRO
const EIXO_MENOR = 0.33
const GIRO_DAS_ORBITAS = -90
/** O astro de cada órbita: onde ele está na volta dela (graus) e o raio (px). */
const ASTROS: readonly number[] = [38, 164, 287]
const RAIO_DO_ASTRO = 2.1
/** O ponto na ponta de cada órbita, em cima do anel de dentro (raio, px). */
const RAIO_DA_PONTA = 1.5
/** O anel tracejado de dentro, por onde as órbitas passam: o raio, quantos traços na volta e quanto de cada passo é traço. */
const ANEL_TRACEJADO = 0.5
const TRACOS_DO_ANEL = 36
const CHEIO_DO_TRACO = 0.62
/** O disco do meio: o raio, o giro das duas metades (graus) e o raio do ponto de cada uma (fração do disco). */
const DISCO = 0.25
const GIRO_DO_DISCO = 24
const PONTO_DA_METADE = 0.15

// ---------- o traço (meias larguras, px do protótipo) ----------

const MIOLO = 0.36
const TRACO = 0.82
/** A régua é mais fina que os anéis e as órbitas. */
const MIOLO_DA_REGUA = 0.16
const TRACO_DA_REGUA = 0.44
/** Por fora do traço: a borda escura e o brilho. */
const BORDA = 0.5
const BRILHO = 3

/**
 * O miolo quase branco, a beira azul, a borda escura e o brilho: um azul só, contido (a beira tem saturação
 * 0,5, abaixo do teto de 0,62). A metade escura do disco tem luminância linear 0,055, acima do piso de luz.
 */
const COR_DO_MIOLO: Rgb = [0xe4, 0xf1, 0xfb]
const COR_DA_BEIRA: Rgb = [0x6a, 0x9a, 0xd6]
const COR_DA_BORDA: Rgb = [0x1f, 0x2c, 0x44]
const COR_DO_BRILHO: Rgb = [0x8f, 0xbd, 0xf0]
const METADE_CLARA: Rgb = [0xd3, 0xe6, 0xf7]
const METADE_ESCURA: Rgb = [0x33, 0x42, 0x5f]
const ALFA_DA_BORDA = 0.46
const ALFA_DO_BRILHO = 0.2
/** O disco do meio brilha mais que os fios: um halo redondo em volta dele (raio em discos, alfa no pé do disco). */
const HALO_DO_DISCO = 2.1
const ALFA_DO_HALO = 0.16
/** As metades não são tinta cheia: deixam passar um pouco do piso. */
const ALFA_DAS_METADES = 0.9
/** O brilho respira ao longo do fio: quanto ele cai nos trechos fracos e o tamanho do trecho (px por volta do ruído). */
const RESPIRO_DO_FIO = 0.3
const TRECHO_DO_RESPIRO = 9

/**
 * As trincas do piso: cada uma é uma linha quebrada (fração do raio) que corta o fio onde passa; a meia largura
 * do corte (px) e a faixa em que o fio volta.
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
 * A pintura do selo num passo só por pixel: a distância (px) aos anéis, à régua, às órbitas, aos astros e ao
 * disco do meio; com ela, o brilho, a borda escura e o fio, de baixo para cima, e por fim as duas metades do
 * disco. Fora disso o pixel fica transparente.
 */
function texDoSelo(c: ContextoDoMovel): Textura {
  const R = Math.min(c.hw, c.hh)
  const orbitas: Orbita[] = []
  const pontas: Ponto[] = []
  const astros: Ponto[] = []
  for (let k = 0; k < ORBITAS; k += 1) {
    const giro = (GIRO_DAS_ORBITAS + (k * 180) / ORBITAS) * GRAU
    const [co, si] = [Math.cos(giro), Math.sin(giro)]
    const [a, b] = [EIXO_MAIOR * R, EIXO_MENOR * R]
    orbitas.push({ c: co, s: si, a, b })
    for (const lado of [-1, 1]) pontas.push([co * a * lado, si * a * lado])
    const t = ASTROS[k % ASTROS.length] * GRAU
    astros.push([co * a * Math.cos(t) - si * b * Math.sin(t), si * a * Math.cos(t) + co * b * Math.sin(t)])
  }
  const trincas = TRINCAS.map((linha) => linha.map(([x, y]): Ponto => [x * R, y * R]))
  const rDisco = DISCO * R
  const [cd, sd] = [Math.cos(GIRO_DO_DISCO * GRAU), Math.sin(GIRO_DO_DISCO * GRAU)]
  const passoDaRegua = VOLTA / RISCOS_DA_REGUA

  return (_u, _v, x, y, _p, s, escala) => {
    const r = Math.sqrt(x * x + y * y)
    s[4] = 1
    if (r > R * ANEL_DE_FORA + BRILHO) {
      s[5] = 0
      return
    }

    // ---- os fios grossos: os dois anéis, as órbitas, os astros, as pontas e a volta do disco ----
    let d = Math.min(Math.abs(r - R * ANEL_DE_FORA), Math.abs(r - R * ANEL_DE_DENTRO))
    if (r < R * ANEL_DE_DENTRO + BRILHO) {
      for (const o of orbitas) d = Math.min(d, ateAOrbita(o, x, y))
      for (const [ax, ay] of astros) d = Math.min(d, Math.max(0, Math.hypot(x - ax, y - ay) - RAIO_DO_ASTRO))
      d = Math.min(d, Math.abs(r - rDisco))
    }
    for (const [px, py] of pontas) d = Math.min(d, Math.max(0, Math.hypot(x - px, y - py) - RAIO_DA_PONTA))

    // ---- a régua de graus, entre os dois anéis (só perto da faixa dela) ----
    let dr = Infinity
    if (r > R * RISCO_COMPRIDO[0] - BRILHO && r < R * RISCO_COMPRIDO[1] + BRILHO) {
      const a = Math.atan2(y, x)
      const j = Math.round(a / passoDaRegua)
      const [de, ate] = j % RISCO_COMPRIDO_A_CADA === 0 ? RISCO_COMPRIDO : RISCO_CURTO
      const aoLado = Math.abs(a - j * passoDaRegua) * r
      const aoLongo = Math.max(R * de - r, r - R * ate, 0)
      dr = Math.sqrt(aoLado * aoLado + aoLongo * aoLongo)
    }
    // ---- o anel tracejado de dentro: fino como a régua ----
    const doTracejado = Math.abs(r - R * ANEL_TRACEJADO)
    if (doTracejado < TRACO_DA_REGUA + BRILHO) {
      const fase = (Math.atan2(y, x) / VOLTA) * TRACOS_DO_ANEL
      const noPasso = fase - Math.floor(fase)
      // Fora do traço, a distância até a ponta mais perto dele, ao longo do anel.
      const aoLongo = noPasso <= CHEIO_DO_TRACO ? 0 : (Math.min(noPasso - CHEIO_DO_TRACO, 1 - noPasso) * VOLTA * r) / TRACOS_DO_ANEL
      dr = Math.min(dr, Math.sqrt(doTracejado * doTracejado + aoLongo * aoLongo))
    }

    // ---- as trincas: onde passam, o fio some ----
    let inteiro = 1
    for (const linha of trincas) inteiro = Math.min(inteiro, limitar01((ateALinha(linha, x, y) - CORTE_DA_TRINCA) / VOLTA_DO_FIO))

    const foraDoTraco = Math.min(d - TRACO, dr - TRACO_DA_REGUA)
    const dentroDoDisco = r < rDisco - TRACO * 0.5
    const halo = ALFA_DO_HALO * limitar01(1 - (r - rDisco) / (rDisco * (HALO_DO_DISCO - 1))) ** 2
    if (foraDoTraco > BRILHO && !dentroDoDisco && halo <= 0) {
      s[5] = 0
      return
    }

    const respiro = 1 - RESPIRO_DO_FIO * (0.5 + ruido(x / TRECHO_DO_RESPIRO + 31, y / TRECHO_DO_RESPIRO + 7))
    const fio = inteiro * respiro
    const aTraco = limitar01(0.5 - foraDoTraco * escala) * inteiro
    const miolo = limitar01(0.5 - Math.min(d - MIOLO, dr - MIOLO_DA_REGUA) * escala) * respiro
    const aBorda = foraDoTraco > 0 ? ALFA_DA_BORDA * inteiro * limitar01(1 - foraDoTraco / BORDA) : 0
    const perto = 1 - limitar01(foraDoTraco / BRILHO)
    const aBrilho = Math.max(ALFA_DO_BRILHO * fio * perto * perto, r > rDisco ? halo : 0)

    // De baixo para cima: o brilho, a borda escura, as metades do disco e o fio.
    let cr = COR_DO_BRILHO[0]
    let cg = COR_DO_BRILHO[1]
    let cb = COR_DO_BRILHO[2]
    let a = aBrilho
    const cobrir = (cor: Rgb, k: number): void => {
      if (k <= 0) return
      const junto = k + a * (1 - k)
      cr = (cor[0] * k + cr * a * (1 - k)) / junto
      cg = (cor[1] * k + cg * a * (1 - k)) / junto
      cb = (cor[2] * k + cb * a * (1 - k)) / junto
      a = junto
    }
    cobrir(COR_DA_BORDA, aBorda)
    if (r < rDisco) {
      // As duas metades, no disco de raio 1: a clara é a metade da direita sem a roda de baixo, mais a roda de cima;
      // cada metade leva o ponto da outra. Distância com sinal (negativa na clara), em raios do disco.
      const qx = (x * cd + y * sd) / rDisco
      const qy = (-x * sd + y * cd) / rDisco
      const deCima = Math.hypot(qx, qy + 0.5)
      const deBaixo = Math.hypot(qx, qy - 0.5)
      const clara = Math.min(Math.max(-qx, 0.5 - deBaixo), deCima - 0.5)
      const comPontos = Math.min(Math.max(clara, PONTO_DA_METADE - deCima), deBaixo - PONTO_DA_METADE)
      const k = limitar01(0.5 - comPontos * rDisco * escala)
      const borda = limitar01(0.5 + (rDisco - r) * escala)
      cobrir([METADE_ESCURA[0] + (METADE_CLARA[0] - METADE_ESCURA[0]) * k, METADE_ESCURA[1] + (METADE_CLARA[1] - METADE_ESCURA[1]) * k, METADE_ESCURA[2] + (METADE_CLARA[2] - METADE_ESCURA[2]) * k], ALFA_DAS_METADES * borda)
    }
    cobrir(
      [COR_DA_BEIRA[0] + (COR_DO_MIOLO[0] - COR_DA_BEIRA[0]) * miolo, COR_DA_BEIRA[1] + (COR_DO_MIOLO[1] - COR_DA_BEIRA[1]) * miolo, COR_DA_BEIRA[2] + (COR_DO_MIOLO[2] - COR_DA_BEIRA[2]) * miolo],
      aTraco,
    )
    s[0] = cr
    s[1] = cg
    s[2] = cb
    s[5] = a
  }
}

export const montarSeloDeOrbitas: MontarMovel = (c, cena) => {
  const R = Math.min(c.hw, c.hh)
  // O escuro em que a metade escura do disco seria levantada, se caísse abaixo do piso de luz: o próprio azul dela.
  cena.corDoPiso = METADE_ESCURA
  cena.partes.push(c.peca(elipse(0, 0, R, R), { classe: 'liso', rgb: COR_DA_BEIRA }, { bisel: 0, contorno: 0, textura: texDoSelo(c), semente: 3501 }))
}
