/**
 * CORPO AMORTALHADO de cima com volume (lote L03 de 24/11/2026, Tortura e
 * fogo; desenho ORIGINAL, só a ideia do "corpo enrolado", da "mortalha", do
 * "corpo sob lençol" e do "fardo embrulhado" dos mapas de referência): um
 * VULTO comprido deitado no chão, enrolado em faixas de PANO CRU e amarrado
 * com CORDAS. Sem rosto, sem mão, sem mancha de sangue: quem conta é o volume
 * (a cabeça redonda numa ponta, o pescoço, os ombros largos, o corpo afinando
 * até os tornozelos e os pés levantando o pano) e as cinco voltas de corda que
 * o apertam. A ponta da corda dos tornozelos fica largada no chão (o fardo foi
 * arrastado até ali).
 *
 * O pano é enrolado em faixas de través, e cada faixa guarda as LISTRAS
 * APAGADAS do tecido de colchão de onde foi rasgada: dois fios azul-acinzentados
 * que somem em manchas (regra do estilo: sem listra gritante). A sujeira é
 * terra, nunca vinho.
 *
 * A 25% de zoom sobram o vulto claro e comprido, com a bola da cabeça numa
 * ponta e os ombros largos logo depois, e os riscos da corda de través: é o
 * que diz "corpo embrulhado", e não saco, tapete enrolado ou tora.
 *
 * NA 3/4 é derivado (`tresQuartos.ts`): o vulto é uma coluna baixa
 * (`ALTURA` casa do menor lado) e a frente dele é uma faixa estreita do pano
 * descendo até o chão; a ponta da corda fica no chão. Nada lê o giro. Sem material escolhido: o pano e a corda
 * são fixos. Os lugares saem de frações da pegada (1,7 x 0,55 casa de partida,
 * a cabeça à esquerda) e as medidas miúdas, do menor lado.
 */
import { limitar01, type Rgb } from '../../ruido'
import { cadeia, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A pegada de partida, em casas: as medidas miúdas (px do protótipo) valem nela. */
const COMPRIMENTO_DE_PARTIDA = 1.7
const LARGURA_DE_PARTIDA = 0.55
/**
 * A altura do vulto deitado, em casas do menor lado: até onde o pano desce A
 * PRUMO. O corpo é roliço e o lombo já está no chanfro largo do pano; com a
 * altura inteira do corpo (0,3) a frente da 3/4 saía uma laje clara debaixo
 * dele, e o vulto parecia deitado num estrado.
 */
const ALTURA = 0.19

/** Onde o vulto fica na pegada (frações da meia pegada): o meio dele e o meio comprimento. Sobra a ponta da corda à direita. */
const MEIO_DO_VULTO = -0.06
const MEIO_COMPRIMENTO = 0.9

/**
 * O PERFIL do vulto: a meia largura (fração da meia pegada) ao longo do
 * comprimento, de -1 (o alto da cabeça) a 1 (a sola dos pés). Entre dois
 * pontos a largura anda suave.
 */
const PERFIL: readonly Ponto[] = [
  [-1, 0.16],
  [-0.965, 0.32],
  [-0.89, 0.44],
  [-0.81, 0.43],
  [-0.735, 0.33],
  [-0.65, 0.6],
  [-0.55, 0.88],
  [-0.32, 0.86],
  [0, 0.74],
  [0.4, 0.6],
  [0.74, 0.45],
  [0.87, 0.48],
  [0.955, 0.49],
  [1, 0.38],
]
/** Quantos pontos tem cada lado do contorno. */
const PONTOS_DO_CONTORNO = 56

/** As voltas de corda: onde (de -1 a 1 no vulto), quanto a corda entorta (px) e se leva o nó. */
const VOLTAS: readonly { readonly t: number; readonly torta: number; readonly no?: true }[] = [
  { t: -0.735, torta: -0.5 },
  { t: -0.4, torta: 0.8, no: true },
  { t: -0.02, torta: -0.6 },
  { t: 0.4, torta: 0.7 },
  { t: 0.74, torta: -0.4 },
]
/** O raio da corda (px de partida) e quanto ela aperta o pano (a largura do vulto cai isto debaixo dela). */
const RAIO_DA_CORDA = 1.1
const APERTO = 0.06
const LARGURA_DO_APERTO = 0.045

/** Os calombos por cima do pano (x de -1 a 1 no vulto, raios em fração do meio comprimento e da meia largura, tom). */
const CALOMBOS: readonly (readonly [number, number, number, number])[] = [
  [-0.87, 0.1, 0.34, 1.07],
  [-0.4, 0.2, 0.56, 1.04],
  [0.1, 0.24, 0.42, 1.02],
  [0.9, 0.07, 0.36, 1.06],
]

/** O pano cru: linho grosso sem alvejar, com a trama do linho. */
const PANO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xbd, 0xae, 0x92] }
/** O fio das listras apagadas (o azul-acinzentado do tecido de colchão) e a terra da sujeira. */
const FIO_DA_LISTRA: Rgb = [0x76, 0x80, 0x8a]
const TERRA: Rgb = [0x8c, 0x79, 0x60]
/** As faixas do pano: a largura (px de partida), o quanto inclinam de través e a sombra da beira de cada uma. */
const LARGURA_DA_FAIXA = 7.4
const INCLINACAO_DAS_FAIXAS = 0.34
const SOMBRA_DA_BEIRA = 0.17
/** As listras: onde ficam dentro da faixa (frações), a meia largura e o quanto tingem no ponto mais vivo. */
const LISTRAS: readonly number[] = [0.5, 0.68]
const MEIA_LISTRA = 0.055
const FORCA_DA_LISTRA = 0.42
/** A sujeira: o quanto a terra tinge nas manchas. */
const FORCA_DA_TERRA = 0.34

const CORDA = materialDaPeca('corda')
const DO_TECIDO = texturaDaClasse('tecido')

function suave(t: number): number {
  const x = limitar01(t)
  return x * x * (3 - 2 * x)
}

/** A meia largura do perfil em `t` (fração da meia pegada), com o aperto de cada volta de corda. */
function larguraEm(t: number): number {
  let i = 1
  while (i < PERFIL.length - 1 && PERFIL[i][0] < t) i += 1
  const [t0, w0] = PERFIL[i - 1]
  const [t1, w1] = PERFIL[i]
  let w = w0 + (w1 - w0) * suave((t - t0) / (t1 - t0))
  for (const volta of VOLTAS) {
    const d = Math.abs(t - volta.t) / LARGURA_DO_APERTO
    if (d < 1) w *= 1 - APERTO * (1 - d * d)
  }
  return w
}

/** A curva de três pontos (Bézier de segundo grau) em `n` trechos: a corda largada não faz quina. */
function curva(a: Ponto, b: Ponto, c: Ponto, n: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const u = 1 - t
    pontos.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]])
  }
  return pontos
}

/**
 * O pano enrolado: a trama do linho, a beira de cada faixa (a de cima faz
 * sombra na de baixo), o tom de cada faixa, as duas listras apagadas e a terra.
 * Tudo pelo lugar no desenho (x, y), para o vulto e os calombos emendarem.
 */
function texDaMortalha(k: number): Textura {
  const co = Math.cos(INCLINACAO_DAS_FAIXAS)
  const si = Math.sin(INCLINACAO_DAS_FAIXAS)
  const largura = LARGURA_DA_FAIXA * k
  return (u, v, x, y, p, s, escala) => {
    if (DO_TECIDO !== null) DO_TECIDO(u, v, x, y, p, s, escala)
    // A beira da faixa ondula um pouco: pano rasgado à mão, não fita.
    const a = (x * co + y * si + ruido(x * 0.06 + 3, y * 0.11 + 11) * 2.2 * k) / largura
    const faixa = Math.floor(a)
    const f = a - faixa
    s[3] += (ruido(faixa * 7.3 + 0.5, 1.5) - 0.05) * 0.1
    if (f < 0.16) s[3] -= SOMBRA_DA_BEIRA * (1 - f / 0.16)
    else if (f < 0.34) s[3] += 0.03
    // As listras somem em manchas: o tecido é velho.
    const apagada = limitar01(0.6 + ruido(x * 0.05 + faixa * 3.1, y * 0.05 + 17) * 2.6)
    for (const centro of LISTRAS) {
      const d = Math.abs(f - centro) / MEIA_LISTRA
      if (d >= 1) continue
      const t = (1 - d * d) * FORCA_DA_LISTRA * apagada
      s[0] += (FIO_DA_LISTRA[0] - s[0]) * t
      s[1] += (FIO_DA_LISTRA[1] - s[1]) * t
      s[2] += (FIO_DA_LISTRA[2] - s[2]) * t
    }
    const mancha = limitar01((ruido(x * 0.085 + 41, y * 0.085 + 5) - 0.12) * 2.6) * FORCA_DA_TERRA
    s[0] += (TERRA[0] - s[0]) * mancha
    s[1] += (TERRA[1] - s[1]) * mancha
    s[2] += (TERRA[2] - s[2]) * mancha
  }
}

export const montarCorpoAmortalhado: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw / ((COMPRIMENTO_DE_PARTIDA * G) / 2), hh / ((LARGURA_DE_PARTIDA * G) / 2))
  const L = cena.partes
  const xDe = (t: number): number => (MEIO_DO_VULTO + t * MEIO_COMPRIMENTO) * hw
  const tex = texDaMortalha(k)

  // ---------- o vulto: o contorno pelo perfil, um lado e o outro de volta ----------
  const deCima: Ponto[] = []
  const deBaixo: Ponto[] = []
  for (let i = 0; i <= PONTOS_DO_CONTORNO; i += 1) {
    const t = -1 + (2 * i) / PONTOS_DO_CONTORNO
    const w = larguraEm(t) * hh
    deCima.push([xDe(t), -w])
    deBaixo.push([xDe(t), w])
  }
  const vulto: Forma = poligono([...deCima, ...deBaixo.reverse()])
  const altura = 2 * Math.min(hw, hh) * ALTURA

  cena.sombras.push(contato(vulto, 0.3), { forma: vulto, z: altura, forca: 0.3 })

  // ---------- no chão: a ponta da corda dos tornozelos, largada numa volta mole ----------
  const sai: Ponto = [xDe(0.74), larguraEm(0.74) * hh * 0.6]
  const rabicho = cadeia(
    [...curva(sai, [xDe(0.8), hh * 1.02], [xDe(0.97), hh * 0.8], 6), ...curva([xDe(0.97), hh * 0.8], [xDe(1.12), hh * 0.6], [xDe(1.08), hh * 0.1], 6).slice(1)],
    RAIO_DA_CORDA * k * 0.9,
  )
  cena.sombras.push(contato(rabicho, 0.26))
  L.push(P(rabicho, CORDA, { tabua: 0, bisel: RAIO_DA_CORDA * k * 0.9, contorno: 0.3, tom: 0.92, semente: 24101 }))

  // ---------- o pano: o vulto e os calombos (a cabeça, o peito de braços cruzados, as coxas e os pés) ----------
  const pano = { tabua: 0, ruga: 0.4, textura: tex }
  L.push(P(vulto, PANO, { ...pano, bisel: hh * 0.4, contorno: 0.3, semente: 24110 }))
  CALOMBOS.forEach(([t, rx, ry, tom], i) => {
    const forma = elipse(xDe(t), -hh * 0.05, rx * MEIO_COMPRIMENTO * hw, ry * hh)
    L.push(P(forma, PANO, { ...pano, bisel: ry * hh * 0.9, tom, contorno: 0, suave: 2 * k, semente: 24111 + i }))
  })
  // O vinco entre as pernas, raso: as duas juntas debaixo do mesmo pano.
  L.push(P(capsula(xDe(0.3), hh * 0.03, xDe(0.68), hh * 0.03, 0.7 * k), PANO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.26, suave: 1.6 * k, semente: 24119 }))

  // ---------- as cordas: cada volta de través, apertando o pano, e o nó com as duas pontas ----------
  VOLTAS.forEach((volta, i) => {
    const x = xDe(volta.t)
    const w = larguraEm(volta.t) * hh + 0.4 * k
    const corda = capsula(x - volta.torta * k, -w, x + volta.torta * k, w, RAIO_DA_CORDA * k)
    L.push(P(corda, CORDA, { tabua: 0, eixo: QUARTO, bisel: RAIO_DA_CORDA * k, contorno: 0.3, semente: 24120 + i, projeta: { dist: 1.1 * k, forca: 0.32 } }))
    if (volta.no !== true) return
    const no: Ponto = [x, -hh * 0.1]
    const pontas: readonly (readonly Ponto[])[] = [
      curva(no, [no[0] - 2.6 * k, no[1] + 0.6 * k], [no[0] - 3.4 * k, no[1] + 3.6 * k], 4),
      curva(no, [no[0] + 2.8 * k, no[1] + 1 * k], [no[0] + 2.4 * k, no[1] + 4.4 * k], 4),
    ]
    pontas.forEach((caminho, j) => {
      L.push(P(cadeia(caminho, RAIO_DA_CORDA * k * 0.75), CORDA, { tabua: 0, bisel: RAIO_DA_CORDA * k * 0.75, contorno: 0.3, tom: 0.95, semente: 24130 + j, projeta: { dist: 0.8 * k, forca: 0.26 } }))
    })
    L.push(P(elipse(no[0], no[1], 1.7 * k, 1.5 * k), CORDA, { tabua: 0, bisel: 1.4 * k, contorno: 0.32, tom: 1.04, semente: 24135, projeta: { dist: 0.9 * k, forca: 0.28 } }))
  })
}
