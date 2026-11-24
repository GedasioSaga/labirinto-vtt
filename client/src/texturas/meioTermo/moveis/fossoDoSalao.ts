/**
 * FOSSO DO SALÃO (lote L04 de 24/11/2026, a Fortaleza do ritual; construção
 * nova). O piso rebaixado redondo do meio de um salão de fortaleza, de cerca
 * de 6 x 6 casas: a GUIA de pedra rente ao chão, dois ANÉIS DE DEGRAUS que
 * descem, o FUNDO com a faixa de INSCRIÇÕES gravadas em volta, a GRADE de
 * ferro em anel sobre o poço escuro e, no meio, o MARCO de pedra com a GEMA
 * rubra engastada, de brilho fraco.
 *
 * Quem diz "rebaixado" visto do alto é a luz: em cada degrau, do lado de onde
 * a luz vem (cima à esquerda) o espelho de cima faz SOMBRA no piso de baixo,
 * e do outro lado o espelho pega luz (um fio claro). Cada piso é mais escuro
 * que o de cima. No poço, a parede de dentro aparece em meia-lua do lado
 * claro, e o clarão rubro sobe do fundo por entre as barras.
 *
 * O tempo: três trincas que atravessam os degraus e a quina lascada aqui e
 * ali, onde alguém arrastou coisa pesada escada abaixo.
 *
 * As inscrições são INVENTADAS, de talhe reto (cinzel não faz curva fácil):
 * oito sinais quadrados, cada um com um ponto, em grupos separados por um
 * losango. Nenhum é letra nem runa de verdade.
 *
 * É CHÃO: rente, não barra a passagem e não tapa a visão; mora por baixo dos
 * outros objetos e das fichas, e a 3/4 sai igual à vista de cima (nenhuma
 * sombra dele tem altura). O fosso inteiro é UMA peça com textura própria (um
 * passo só por pixel, como o círculo mágico): são 6 x 6 casas, e uma peça por
 * laje custaria a distância de cada uma em cada pixel.
 *
 * Esticado, os anéis viram elipse pela pegada; as juntas, as barras e o talhe
 * das inscrições continuam com a largura em px do protótipo. Materiais:
 * `pedra` (as lajes e o marco) e `grade` (o ferro). A gema é fixa.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { elipse, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

const VOLTA = Math.PI * 2

// ---------- a planta (fração da meia pegada) ----------

/** Onde cada piso acaba, de fora para dentro: a guia, os dois degraus e o fundo, até a beira do poço. */
const BEIRAS: readonly number[] = [1, 0.915, 0.79, 0.665]
const BEIRA_DO_POCO = 0.4
/** O tom de cada piso (a guia pega a luz do salão; o fundo, menos) e quantas lajes cada anel tem, com o desencontro delas. */
const TOM_DO_PISO: readonly number[] = [1.04, 0.93, 0.83, 0.74]
const LAJES_DO_PISO: readonly number[] = [32, 26, 22, 16]
const DESENCONTRO: readonly number[] = [0, 0.37, 0.71, 0.13]
/** A faixa das inscrições, no fundo: de onde até onde, e quanto ela é mais clara (a pedra polida). */
const FAIXA_DAS_INSCRICOES: readonly [number, number] = [0.478, 0.602]
const LUZ_DA_FAIXA = 0.06
/** O marco do meio: a beira, o tom, o sulco torneado e a coroa de dentes talhada entre o sulco e a beira. */
const MARCO = 0.19
const TOM_DO_MARCO = 0.76
const SULCO_DO_MARCO = 0.138
const DENTES_DO_MARCO = 12
const COROA_DE_DENTES: readonly [number, number] = [0.15, 0.178]
/** O aro do engaste e a gema. */
const ENGASTE: readonly [number, number] = [0.088, 0.114]
const GEMA = 0.09
/** A grade: os três aros (o raio do meio e a meia largura em px de um fosso de 6 casas) e as barras em raio. */
const AROS: readonly (readonly [number, number])[] = [[0.392, 3], [0.295, 1.9], [0.198, 2.7]]
const BARRAS = 16
const MEIA_BARRA = 2.3
/** O rebite em cada cruzamento de barra com o aro de fora e o de dentro (raio em px, no fosso de partida). */
const RAIO_DO_REBITE = 1.7
/** O meio lado em que as larguras em px foram medidas (6 casas): fosso menor, ferro e talhe mais finos, até o piso. */
const MEIO_LADO_DE_PARTIDA = 168
const ESCALA_MINIMA_DO_FERRO = 0.6

// ---------- a luz (a direção é a do motor: de cima à esquerda) ----------

/** Para onde a luz anda no chão (baixo à direita). */
const LUZ_X = 0.79
const LUZ_Y = 0.61
/** A sombra do espelho no piso de baixo: o comprimento (px, no fosso de partida) e a força. */
const SOMBRA_DO_DEGRAU = 10.5
const FORCA_DA_SOMBRA = 0.4
/** O escuro no pé de cada espelho, na volta inteira (px e força), e o fio claro do espelho que pega luz. */
const PE_DO_ESPELHO = 1.5
const FORCA_DO_PE = 0.2
const FIO_DO_ESPELHO = 2.4
const LUZ_DO_ESPELHO = 0.26
/** A quina de cima de cada degrau, gasta de pisar: um fio claro (px e força). */
const QUINA = 1.1
const LUZ_DA_QUINA = 0.06
/** As juntas entre as lajes: a meia largura (px) e quanto escurecem. */
const JUNTA = 0.8
const FORCA_DA_JUNTA = 0.26
/** Quanto o tom muda de uma laje para a outra. */
const TOM_DAS_LAJES = 0.13
/** A fuligem do poço no fundo: até onde vai (fração) e quanto escurece na beira dele. */
const FULIGEM_ATE = 0.52
const FORCA_DA_FULIGEM = 0.16

// ---------- o tempo ----------

/** As trincas, em fração da meia pegada: linhas quebradas que atravessam os degraus. A meia largura (px) e a força. */
const TRINCAS: readonly (readonly Ponto[])[] = [
  [[0.99, -0.24], [0.86, -0.19], [0.76, -0.26], [0.63, -0.21], [0.56, -0.25]],
  [[-0.46, 0.88], [-0.43, 0.74], [-0.52, 0.63], [-0.47, 0.5]],
  [[-0.95, -0.2], [-0.83, -0.27], [-0.78, -0.24]],
]
const MEIA_TRINCA = 0.5
const FORCA_DA_TRINCA = 0.3
/** As lascas da quina: quantas vagas por degrau, a chance de cada vaga ter uma, o raio (px, de e até) e quanto escurece. */
const VAGAS_DE_LASCA = 9
const CHANCE_DE_LASCA = 0.5
const RAIO_DA_LASCA: readonly [number, number] = [2.2, 4.4]
const FORCA_DA_LASCA = 0.2

// ---------- as inscrições ----------

/** Um sinal: riscos retos no quadrado de -1 a 1 (u ao longo da faixa, w para fora do fosso) e o ponto dele. */
interface Sinal {
  readonly riscos: readonly (readonly [number, number, number, number])[]
  readonly ponto: Ponto
}

const linha = (...p: Ponto[]): (readonly [number, number, number, number])[] => p.slice(1).map((b, i) => [p[i][0], p[i][1], b[0], b[1]] as const)

/** O alfabeto: oito sinais de talhe reto, sem cruz, sem seta, sem forquilha e sem raio (nada de runa nem de letra). */
const SINAIS: readonly Sinal[] = [
  // o colchete de rabo torto
  { riscos: linha([0.7, -0.9], [-0.7, -0.9], [-0.7, 0.2], [0.6, 0.9]), ponto: [0.3, -0.25] },
  // o portal de verga torta
  { riscos: linha([-0.7, 0.9], [-0.7, -0.3], [0.7, -0.9], [0.7, 0.9]), ponto: [0, 0.45] },
  // a verga com a língua e a soleira curta
  { riscos: [...linha([-0.8, -0.9], [0.8, -0.9]), ...linha([-0.3, -0.9], [-0.3, 0.1]), ...linha([-0.2, 0.9], [0.8, 0.9])], ponto: [0.42, 0] },
  // os dois cantos, um dentro do outro
  { riscos: [...linha([-0.8, -0.9], [-0.8, 0.9], [0.8, 0.9]), ...linha([-0.1, -0.9], [-0.1, 0.2], [0.8, 0.2])], ponto: [0.5, -0.5] },
  // a escada
  { riscos: linha([-0.8, 0.9], [-0.8, 0.3], [-0.2, 0.3], [-0.2, -0.3], [0.4, -0.3], [0.4, -0.9], [0.8, -0.9]), ponto: [0.5, 0.55] },
  // a volta quadrada
  { riscos: linha([0.8, -0.9], [-0.8, -0.9], [-0.8, 0.9], [0.8, 0.9], [0.8, -0.2], [-0.1, -0.2], [-0.1, 0.3]), ponto: [0.35, -0.55] },
  // as duas tortas
  { riscos: [...linha([-0.8, 0.9], [0, -0.9]), ...linha([0, 0.9], [0.8, -0.9])], ponto: [-0.55, -0.6] },
  // a soleira com o esteio e a escora
  { riscos: [...linha([-0.8, -0.9], [-0.8, 0.9], [0.8, 0.9]), ...linha([0.1, 0.9], [0.8, -0.5])], ponto: [-0.2, -0.3] },
]
/** Quantos sinais por grupo (depois de cada grupo vem o losango) e o passo de um sinal ao outro, em meias alturas de sinal. */
const SINAIS_POR_GRUPO = 5
const PASSO_DOS_SINAIS = 2.9
/** A meia altura do sinal (fração da meia faixa), a meia largura do talhe (px, no fosso de partida) e o raio do ponto e do losango (meias alturas). */
const ALTURA_DO_SINAL = 0.62
const TALHE = 0.85
const PONTO_DO_SINAL = 0.2
const LOSANGO = 0.36
/** O talhe: quanto o fundo dele escurece e quanto a beira que pega luz clareia. */
const FUNDO_DO_TALHE = 0.3
const LUZ_DO_TALHE = 0.26

/** Distância (em meias alturas de sinal) do ponto (u, w) ao sinal: os riscos e o ponto. */
function ateOSinal(s: Sinal, u: number, w: number): number {
  let menor = Infinity
  for (const [ax, ay, bx, by] of s.riscos) {
    const dx = bx - ax
    const dy = by - ay
    let h = ((u - ax) * dx + (w - ay) * dy) / (dx * dx + dy * dy)
    h = h < 0 ? 0 : h > 1 ? 1 : h
    const qx = u - ax - dx * h
    const qy = w - ay - dy * h
    const dd = qx * qx + qy * qy
    if (dd < menor) menor = dd
  }
  const doPonto = Math.hypot(u - s.ponto[0], w - s.ponto[1]) - PONTO_DO_SINAL
  const doRisco = Math.sqrt(menor)
  return doPonto < doRisco ? Math.max(0, doPonto) : doRisco
}

/** Uma trinca em px, com a caixa dela (o ponto fora da caixa nem mede a distância). */
interface Trinca {
  readonly pontos: readonly Ponto[]
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
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

// ---------- as cores fixas ----------

/**
 * O escuro em que o pixel escuro demais é levantado: na pedra e no ferro, o cinza quente das outras pedras; onde o
 * clarão rubro chega, um cinza puxado para o vinho. Os dois têm luminância linear 0,066. Com o cinza de sempre
 * (0,056) o clarão do poço, levantado pelo motor, caía a 0,042, abaixo do piso de luz (0,045): o vermelho escuro
 * quase não tem luminância, e a mistura em sRGB rende menos que a conta linear.
 */
const ESCURO_DA_PEDRA: Rgb = [0x4b, 0x48, 0x45]
const ESCURO_DO_CLARAO: Rgb = [0x56, 0x44, 0x42]
const LUZ_DO_ESCURO = 0.066
/** Abaixo desta luminância linear a própria textura levanta a cor, com folga sobre o piso de luz do motor. */
const PISO_DO_FOSSO = 0.052
const FUNDO_DO_POCO: Rgb = [0x36, 0x2c, 0x2b]
/** A gema: o rubi fundo, a faceta na sombra, a faceta na luz e o reflexo. Vinho contido, não vermelho vivo. */
const RUBI: Rgb = [0x8e, 0x2b, 0x39]
const RUBI_NA_SOMBRA: Rgb = [0x54, 0x1a, 0x28]
const RUBI_NA_LUZ: Rgb = [0xd2, 0x74, 0x7a]
const REFLEXO: Rgb = [0xff, 0xea, 0xe4]
/** O clarão rubro: no marco e nas barras em volta da gema, e subindo do fundo do poço. */
const CLARAO: Rgb = [0xd6, 0x5a, 0x58]
const ALFA_DO_CLARAO = 0.15
const CLARAO_ATE = 0.38
const ALFA_DO_CLARAO_NO_POCO = 0.5

function limitar01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t
}

function suave01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
}

/** sRGB de 8 bits (sem arredondar) para linear, pela potência 2,2: basta para saber se a cor está escura demais. */
function linear(v: number): number {
  return v <= 0 ? 0 : Math.pow(v / 255, 2.2)
}

/**
 * A pintura do fosso num passo só por pixel. De baixo para cima: a pedra do piso em que o ponto cai (o tom do
 * piso, a laje, as juntas, a sombra e a luz dos espelhos, as inscrições), o poço com a parede e o clarão, o
 * marco, o ferro da grade e a gema.
 */
function texDoFosso(c: ContextoDoMovel, pedra: MaterialDaPeca, ferro: MaterialDaPeca): Textura {
  const { hw, hh } = c
  const R = Math.min(hw, hh)
  const k = Math.max(ESCALA_MINIMA_DO_FERRO, R / MEIO_LADO_DE_PARTIDA)
  const daPedra = texturaDaClasse('pedra')
  const sorteio = Math.round(c.w + 7 * c.h)

  // As inscrições: quantas vagas cabem na volta do meio da faixa e que sinal vai em cada uma.
  const meioDaFaixa = (FAIXA_DAS_INSCRICOES[0] + FAIXA_DAS_INSCRICOES[1]) / 2
  const meiaFaixa = ((FAIXA_DAS_INSCRICOES[1] - FAIXA_DAS_INSCRICOES[0]) / 2) * R
  const unidade = meiaFaixa * ALTURA_DO_SINAL
  const [ea, eb] = [meioDaFaixa * hw, meioDaFaixa * hh]
  const perimetro = Math.PI * (3 * (ea + eb) - Math.sqrt((3 * ea + eb) * (ea + 3 * eb)))
  const vagas = Math.max(SINAIS_POR_GRUPO + 1, Math.round(perimetro / (PASSO_DOS_SINAIS * unidade)))
  const passoDaVaga = VOLTA / vagas
  const sinais: (Sinal | null)[] = []
  for (let j = 0; j < vagas; j += 1) {
    const pausa = j % (SINAIS_POR_GRUPO + 1) === SINAIS_POR_GRUPO
    sinais.push(pausa ? null : SINAIS[Math.floor(hash(j, 7, 3100 + sorteio) * SINAIS.length) % SINAIS.length])
  }
  const talhe = TALHE * k

  /** Quanto o ponto está dentro do talhe das inscrições (0 fora, 1 no fundo). */
  const noTalhe = (x: number, y: number): number => {
    const X = x / hw
    const Y = y / hh
    const rho = Math.sqrt(X * X + Y * Y)
    const fora = (rho - meioDaFaixa) * R
    if (Math.abs(fora) > meiaFaixa) return 0
    let a = Math.atan2(Y, X)
    a -= Math.floor(a / VOLTA) * VOLTA
    const j = Math.min(vagas - 1, Math.floor(a / passoDaVaga))
    const u = ((a - (j + 0.5) * passoDaVaga) * meioDaFaixa * R) / unidade
    const w = fora / unidade
    const sinal = sinais[j]
    const d = sinal === null ? (Math.abs(u) + Math.abs(w) - LOSANGO) * 0.7 : ateOSinal(sinal, u, w)
    return limitar01(0.5 + (talhe - d * unidade) / 0.9)
  }

  const trincas: Trinca[] = TRINCAS.map((linhaDaTrinca) => {
    const pontos = linhaDaTrinca.map(([x, y]): Ponto => [x * hw, y * hh])
    const xs = pontos.map(([x]) => x)
    const ys = pontos.map(([, y]) => y)
    return { pontos, x0: Math.min(...xs) - 2, y0: Math.min(...ys) - 2, x1: Math.max(...xs) + 2, y1: Math.max(...ys) + 2 }
  })

  const [fr, fg, fb] = ferro.rgb
  const [pr, pg, pb] = pedra.rgb

  return (u, v, x, y, p, s, escala) => {
    const X = x / hw
    const Y = y / hh
    const rho = Math.sqrt(X * X + Y * Y)
    // Px por unidade de `rho` no ponto: a distância a uma beira em px, com a pegada esticada.
    const gx = X / hw
    const gy = Y / hh
    const gl = Math.sqrt(gx * gx + gy * gy)
    const pxPorRho = gl > 1e-9 ? rho / gl : R
    const co = rho > 1e-6 ? X / rho : 1
    const si = rho > 1e-6 ? Y / rho : 0
    // Positivo do lado de onde a luz vem (a parede de fora fica entre o ponto e a luz).
    const paraALuz = -(co * LUZ_X + si * LUZ_Y)
    const contraALuz = paraALuz < 0 ? -paraALuz : 0
    let th = Math.atan2(Y, X)
    th -= Math.floor(th / VOLTA) * VOLTA
    const rpx = rho * pxPorRho

    // O grão da pedra do painel (granito, arenito, ardósia, mármore): a variação de luz e o pontilhado dela.
    s[3] = 0
    s[6] = 0
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    let luz = s[3]
    const pontilhado = s[6]
    s[3] = 0
    s[6] = 0

    let cr: number
    let cg: number
    let cb: number

    if (rho > BEIRA_DO_POCO || rho <= MARCO) {
      // ---------- a pedra: os quatro pisos e o marco ----------
      let tom: number
      if (rho <= MARCO) {
        tom = TOM_DO_MARCO
        // O sulco torneado, a coroa de dentes talhada e a beira, que pega luz do lado claro e some do outro.
        const doSulco = Math.abs(rho - SULCO_DO_MARCO) * pxPorRho
        if (doSulco < 1.1 * k) luz -= 0.22 * (1 - doSulco / (1.1 * k))
        if (rho > COROA_DE_DENTES[0] && rho < COROA_DE_DENTES[1]) {
          const naVolta = (th / VOLTA) * DENTES_DO_MARCO
          const aoLado = Math.abs(naVolta - Math.floor(naVolta) - 0.5) * ((VOLTA * rpx) / DENTES_DO_MARCO)
          if (aoLado < 0.9 * k) luz -= 0.24 * (1 - aoLado / (0.9 * k))
        }
        const daBeira = (MARCO - rho) * pxPorRho
        if (daBeira < 3 * k) luz += 0.16 * (1 - daBeira / (3 * k)) * paraALuz
      } else {
        let piso = 3
        while (piso > 0 && rho > BEIRAS[piso]) piso -= 1
        tom = TOM_DO_PISO[piso]
        const lajes = LAJES_DO_PISO[piso]
        const naVolta = (th / VOLTA) * lajes + DESENCONTRO[piso]
        const laje = Math.floor(naVolta)
        const fa = naVolta - laje
        luz += (hash(((laje % lajes) + lajes) % lajes, piso, 3110 + sorteio) - 0.5) * TOM_DAS_LAJES
        const daJunta = (fa < 1 - fa ? fa : 1 - fa) * ((VOLTA * rpx) / lajes)
        if (daJunta < JUNTA) luz -= FORCA_DA_JUNTA * (1 - daJunta / JUNTA)
        else if (fa < 0.5 && daJunta < JUNTA + 1) luz += 0.04
        // O espelho de cima: a sombra dele do lado da luz, o pé escuro e o fio claro do outro lado.
        if (piso > 0) {
          const t = (BEIRAS[piso] - rho) * pxPorRho
          const comprida = SOMBRA_DO_DEGRAU * k * (paraALuz > 0 ? paraALuz : 0)
          if (t < comprida) luz -= FORCA_DA_SOMBRA * suave01((comprida - t) / (0.5 * comprida + 0.8))
          if (t < PE_DO_ESPELHO * k) luz -= FORCA_DO_PE * (1 - t / (PE_DO_ESPELHO * k)) * (0.5 + 0.5 * (paraALuz > 0 ? paraALuz : 0))
          const fio = FIO_DO_ESPELHO * k * contraALuz
          if (t < fio) luz += LUZ_DO_ESPELHO * (1 - t / fio)
        }
        // A quina de cima do degrau seguinte, gasta: mais clara do lado que pega luz. E as lascas dela.
        const dentro = piso < 3 ? BEIRAS[piso + 1] : BEIRA_DO_POCO
        const daQuina = (rho - dentro) * pxPorRho
        if (daQuina < QUINA) luz += LUZ_DA_QUINA * (1 - daQuina / QUINA) * (0.4 + 0.6 * contraALuz)
        if (piso < 3 && daQuina < RAIO_DA_LASCA[1] * k) {
          const naVoltaDasLascas = (th / VOLTA) * VAGAS_DE_LASCA + piso * 0.37
          const vaga = Math.floor(naVoltaDasLascas)
          if (hash(vaga, piso, 3190 + sorteio) < CHANCE_DE_LASCA) {
            const meio = vaga + 0.25 + 0.5 * hash(vaga, piso + 10, 3190 + sorteio)
            const aoLado = (naVoltaDasLascas - meio) * ((VOLTA * rpx) / VAGAS_DE_LASCA)
            const raio = (RAIO_DA_LASCA[0] + (RAIO_DA_LASCA[1] - RAIO_DA_LASCA[0]) * hash(vaga, piso + 20, 3190 + sorteio)) * k
            const d = Math.sqrt(aoLado * aoLado + daQuina * daQuina) - raio
            if (d < 0) luz -= FORCA_DA_LASCA * limitar01(-d / 1.2) * (0.7 + 0.6 * ruido(x * 0.9, y * 0.9))
          }
        }
        if (piso === 3) {
          // O fundo: a fuligem do poço, a faixa polida das inscrições com os dois frisos e o talhe dos sinais.
          if (rho < FULIGEM_ATE) luz -= FORCA_DA_FULIGEM * (1 - (rho - BEIRA_DO_POCO) / (FULIGEM_ATE - BEIRA_DO_POCO)) * (0.75 + ruido(x * 0.2 + 5, y * 0.2 + 9))
          if (rho > FAIXA_DAS_INSCRICOES[0] && rho < FAIXA_DAS_INSCRICOES[1]) {
            luz += LUZ_DA_FAIXA
            const e = 0.6
            const fundo = noTalhe(x, y)
            luz -= FUNDO_DO_TALHE * fundo
            // A beira do talhe que olha para a luz (a de baixo à direita) clareia; a outra escurece.
            luz += LUZ_DO_TALHE * (noTalhe(x - LUZ_X * e, y - LUZ_Y * e) - noTalhe(x + LUZ_X * e, y + LUZ_Y * e))
          }
          const doFriso = Math.min(Math.abs(rho - FAIXA_DAS_INSCRICOES[0]), Math.abs(rho - FAIXA_DAS_INSCRICOES[1])) * pxPorRho
          if (doFriso < 0.7) luz -= 0.2 * (1 - doFriso / 0.7)
        }
        // As trincas: o fio escuro, com a beira de baixo um pouco mais clara.
        for (const trinca of trincas) {
          if (x < trinca.x0 || x > trinca.x1 || y < trinca.y0 || y > trinca.y1) continue
          const d = ateALinha(trinca.pontos, x, y)
          if (d < MEIA_TRINCA + 0.6) luz -= FORCA_DA_TRINCA * limitar01((MEIA_TRINCA + 0.6 - d) / 0.6) * (0.6 + 0.8 * ruido(x * 0.3 + 2, y * 0.3))
        }
      }
      const f = 1 + pontilhado * 0.75
      cr = (pr * tom * (1 + luz) + 22 * luz) * f
      cg = (pg * tom * (1 + luz) + 22 * luz) * f
      cb = (pb * tom * (1 + luz) + 22 * luz) * f
    } else {
      // ---------- o poço: a parede de dentro em meia-lua do lado claro e o escuro do fundo ----------
      const t = (BEIRA_DO_POCO - rho) * pxPorRho
      const parede = 8 * k * (0.3 + 0.7 * contraALuz)
      if (t < parede) {
        const q = t / parede
        const tom = (0.66 - 0.3 * q) * (1 + luz) * (0.74 + 0.4 * contraALuz)
        cr = pr * tom
        cg = pg * tom
        cb = pb * tom
      } else {
        const fundo = 1 + ruido(x * 0.16 + 3, y * 0.16 + 11) * 0.3
        cr = FUNDO_DO_POCO[0] * fundo
        cg = FUNDO_DO_POCO[1] * fundo
        cb = FUNDO_DO_POCO[2] * fundo
      }
    }

    // ---------- o clarão rubro: em volta da gema e subindo do poço ----------
    let noClarao = 0
    if (rho < CLARAO_ATE && rho > GEMA * 0.9) {
      const q = 1 - (rho - GEMA) / (CLARAO_ATE - GEMA)
      const noPoco = rho > MARCO && rho < BEIRA_DO_POCO
      const a = (noPoco ? ALFA_DO_CLARAO_NO_POCO : ALFA_DO_CLARAO) * q * q * (0.85 + 0.3 * ruido(x * 0.12 + 17, y * 0.12 + 3))
      cr += (CLARAO[0] - cr) * a
      cg += (CLARAO[1] - cg) * a
      cb += (CLARAO[2] - cb) * a
      noClarao = limitar01(a * 3)
    }

    // ---------- o ferro: os três aros, as barras em raio e o engaste da gema ----------
    let doFerro = Infinity
    let nx = 0
    let ny = 0
    for (const [raio, largura] of AROS) {
      const fora = (rho - raio) * pxPorRho
      const d = Math.abs(fora) - largura * k
      if (d < doFerro) {
        doFerro = d
        nx = (co * fora) / (largura * k)
        ny = (si * fora) / (largura * k)
      }
    }
    let rebite = 0
    if (rho > AROS[2][0] - 0.03 && rho < AROS[0][0] + 0.03) {
      // O meio da barra fica no meio do passo: nenhuma cai em cima do eixo, onde `atan2` dá a volta.
      const naVolta = (th / VOLTA) * BARRAS
      const aoLado = (naVolta - Math.floor(naVolta) - 0.5) * ((VOLTA * rpx) / BARRAS)
      if (rho > AROS[2][0] && rho < AROS[0][0]) {
        const d = Math.abs(aoLado) - MEIA_BARRA * k
        if (d < doFerro) {
          doFerro = d
          nx = (-si * aoLado) / (MEIA_BARRA * k)
          ny = (co * aoLado) / (MEIA_BARRA * k)
        }
      }
      for (const aro of [AROS[0], AROS[2]]) {
        const d = Math.hypot(aoLado, (rho - aro[0]) * pxPorRho) / (RAIO_DO_REBITE * k)
        if (d < 1) rebite = Math.max(rebite, 1 - d * d)
      }
    }
    const meioDoEngaste = (ENGASTE[0] + ENGASTE[1]) / 2
    const meioEngaste = ((ENGASTE[1] - ENGASTE[0]) / 2) * pxPorRho
    const doEngaste = Math.abs(rho - meioDoEngaste) * pxPorRho - meioEngaste
    if (doEngaste < doFerro) {
      const fora = (rho - meioDoEngaste) * pxPorRho
      doFerro = doEngaste
      nx = (co * fora) / meioEngaste
      ny = (si * fora) / meioEngaste
    }
    const cobre = limitar01(0.5 - doFerro * escala)
    if (cobre > 0) {
      // O ferro roliço: a luz no lombo do lado claro, o escuro nas beiras, o grão do metal batido e a cabeça do rebite.
      const lombo = -(nx * LUZ_X + ny * LUZ_Y)
      const beira = nx * nx + ny * ny
      const grao = ruido(x * 0.5 + 41, y * 0.5 + 13) * 0.14
      const tom = 0.96 + 0.46 * lombo - 0.3 * beira + grao + 0.34 * rebite
      const brilho = (lombo > 0.35 ? (lombo - 0.35) * 80 : 0) + 26 * rebite
      let mr = fr * tom + brilho
      let mg = fg * tom + brilho * 0.96
      let mb = fb * tom + brilho * 0.88
      // O ferro perto da gema pega o clarão dela.
      if (rho < CLARAO_ATE) {
        const a = 0.26 * (1 - rho / CLARAO_ATE)
        mr += (CLARAO[0] - mr) * a
        mg += (CLARAO[1] - mg) * a
        mb += (CLARAO[2] - mb) * a
      }
      cr += (mr - cr) * cobre
      cg += (mg - cg) * cobre
      cb += (mb - cb) * cobre
    } else if (doFerro < 2.4 * k && rho > MARCO * 0.6) {
      // O escuro curto em volta do ferro, onde ele assenta na pedra.
      const a = 0.24 * (1 - doFerro / (2.4 * k))
      cr *= 1 - a
      cg *= 1 - a
      cb *= 1 - a
    }

    // ---------- a gema: a mesa no meio, as facetas em volta e os dois reflexos ----------
    if (rho < GEMA * 1.04) {
      const q = rho / GEMA
      const naFatia = (th / VOLTA) * 16 + 0.5
      const fatia = Math.floor(naFatia)
      const a = (fatia / 16) * VOLTA
      const luzDaFaceta = -(Math.cos(a) * LUZ_X + Math.sin(a) * LUZ_Y)
      let cor: Rgb
      if (q < 0.5) {
        // A mesa: lisa, um pouco mais clara para o lado da luz.
        cor = misturar(RUBI, RUBI_NA_LUZ, limitar01(0.16 + 0.3 * paraALuz * (q / 0.5)))
      } else {
        const t = luzDaFaceta * 0.75 + (fatia % 2 === 0 ? 0.12 : -0.12)
        cor = t >= 0 ? misturar(RUBI, RUBI_NA_LUZ, limitar01(t)) : misturar(RUBI, RUBI_NA_SOMBRA, limitar01(-t))
      }
      let gr: number = cor[0]
      let gg: number = cor[1]
      let gb: number = cor[2]
      // As arestas entre as facetas e a volta da mesa: um fio mais claro.
      const daBeiraDaFatia = 0.5 - Math.abs(naFatia - fatia - 0.5)
      const daAresta = Math.min(daBeiraDaFatia * ((VOLTA * rpx) / 16), Math.abs(q - 0.5) * GEMA * pxPorRho)
      if (q >= 0.46 && daAresta < 0.55) {
        const f = 0.3 * (1 - daAresta / 0.55)
        gr += (RUBI_NA_LUZ[0] - gr) * f
        gg += (RUBI_NA_LUZ[1] - gg) * f
        gb += (RUBI_NA_LUZ[2] - gb) * f
      }
      // A cinta: a beira da gema, na sombra do engaste.
      if (q > 0.86) {
        const f = 0.45 * limitar01((q - 0.86) / 0.14)
        gr += (RUBI_NA_SOMBRA[0] - gr) * f
        gg += (RUBI_NA_SOMBRA[1] - gg) * f
        gb += (RUBI_NA_SOMBRA[2] - gb) * f
      }
      const gema = GEMA * pxPorRho
      const reflexo = Math.max(limitar01(1.2 - Math.hypot(x + 0.3 * gema, y + 0.34 * gema) / (0.17 * gema)) * 0.75, limitar01(1.2 - Math.hypot(x - 0.36 * gema, y - 0.4 * gema) / (0.08 * gema)) * 0.45)
      gr += (REFLEXO[0] - gr) * reflexo
      gg += (REFLEXO[1] - gg) * reflexo
      gb += (REFLEXO[2] - gb) * reflexo
      const cobreAGema = limitar01(0.5 + (GEMA - rho) * pxPorRho * escala)
      cr += (gr - cr) * cobreAGema
      cg += (gg - cg) * cobreAGema
      cb += (gb - cb) * cobreAGema
    }

    // ---------- o piso de luz: o que ficou escuro demais sobe para o escuro quente do fosso ----------
    if (cr + cg + cb < 260) {
      const L = 0.2126 * linear(cr) + 0.7152 * linear(cg) + 0.0722 * linear(cb)
      if (L < PISO_DO_FOSSO) {
        const t = Math.min(1, ((PISO_DO_FOSSO - L) / (LUZ_DO_ESCURO - L)) * 1.3)
        cr += (ESCURO_DA_PEDRA[0] + (ESCURO_DO_CLARAO[0] - ESCURO_DA_PEDRA[0]) * noClarao - cr) * t
        cg += (ESCURO_DA_PEDRA[1] + (ESCURO_DO_CLARAO[1] - ESCURO_DA_PEDRA[1]) * noClarao - cg) * t
        cb += (ESCURO_DA_PEDRA[2] + (ESCURO_DO_CLARAO[2] - ESCURO_DA_PEDRA[2]) * noClarao - cb) * t
      }
    }

    s[0] = cr
    s[1] = cg
    s[2] = cb
  }
}

export const montarFossoDoSalao: MontarMovel = (c, cena) => {
  const forma = elipse(0, 0, c.hw, c.hh)
  cena.corDoPiso = ESCURO_DO_CLARAO
  // Rente ao chão: só o contato da guia, sem altura (a 3/4 não sobe nada).
  cena.sombras.push(contato(forma, 0.18))
  cena.partes.push(c.peca(forma, c.m.pedra, { tabua: 0, bisel: 1.6, contorno: 0.26, textura: texDoFosso(c, c.m.pedra, c.m.grade), semente: 3101 }))
}
