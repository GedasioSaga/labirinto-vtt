/**
 * FENO de cima com volume (29/10/2026), nas duas formas do painel
 * (`lib/mobilia/pilhas.ts`; a forma chega na `variante`), para o estábulo, o
 * celeiro e a fazenda:
 *
 * - FARDOS EMPILHADOS (variante 0, 1,5 x 1 casa): três fardos quadrados em pé,
 *   lado a lado, e um quarto deitado por cima deles, atravessado no fundo. Cada
 *   fardo tem a palha prensada em lascas (as divisas finas de través), as duas
 *   amarras de corda ao comprido, com a palha afundada junto delas, e uns fios
 *   soltos saindo da beira. O de cima é mais claro e faz sombra nos de baixo.
 * - MONTE DE FENO (variante 1, 1 x 1): o monte solto, em domo, com o alto um
 *   pouco para trás, os fios em todas as direções, a saia de palha espalhada no
 *   chão em volta e uns fios soltos.
 *
 * O amarelo-palha é CONTIDO (regra 5 do estilo: pastel, nunca neon): saturação
 * HSV ~0,46, abaixo do teto de 0,62, e a luz longe da do chão padrão. A palha e
 * a corda são fixas (o feno não tem material para escolher). A 25% de zoom
 * sobram os blocos claros com as duas linhas da corda (os fardos) e o domo com
 * o brilho de cima à esquerda (o monte).
 */
import { hash } from '../../ruido'
import { caixa, capsula, elipse, uniao, type Forma } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/** O feno: amarelo-palha contido (o token `palha` do Meio-Termo, #d6b56a, satura demais num bloco grande). */
const TOM_DO_FENO: Rgb3 = [0xc4, 0xa7, 0x69]
/** O fio mais seco e o mais verde, para a palha não virar um amarelo só. */
const FIO_SECO: Rgb3 = [0xd2, 0xbb, 0x84]
const FIO_VERDE: Rgb3 = [0xa8, 0x9a, 0x5c]
/** A corda das amarras: sisal mais escuro que o feno (a corda clara da cerca sumiria na palha). */
const TOM_DA_AMARRA: Rgb3 = [0x8a, 0x70, 0x4a]
const TORCAO_DA_AMARRA: Rgb3 = [0x6e, 0x58, 0x3a]

const FENO: MaterialDaPeca = { classe: 'palha', rgb: TOM_DO_FENO }
const AMARRA: MaterialDaPeca = { classe: 'liso', rgb: TOM_DA_AMARRA }

/** Largura de um fio de palha (px do protótipo): ~1,6 pixel a 1x, sem virar chuvisco. */
const LARGURA_DO_FIO = 1.8
/** Abaixo desta escala (pixels da imagem por px do protótipo) o fio fica com menos contraste, como a trama da palha. */
const ESCALA_DO_FIO_INTEIRO = 1.5
const CONTRASTE_DO_FIO_MIUDO = 0.45

/** O quanto os fios das duas camadas se cruzam, para cada lado da direção principal (radianos). */
const CRUZA = 0.55
const COS_CRUZA = Math.cos(CRUZA)
const SEN_CRUZA = Math.sin(CRUZA)
/** Fração dos pedaços de fio que aparecem por cima; no resto, o vão escuro entre a palha. */
const VAO_DA_PALHA = 0.42

/**
 * Uma camada de fios: pedaços CURTOS (3 a 7 px) de palha em fileiras de
 * `LARGURA_DO_FIO`, cada um com a sua luz e as pontas afinando; onde não há
 * pedaço, o vão (um pouco mais escuro). Devolve a luz e, em `cor`, o
 * sorteio do pedaço (para o fio seco ou o verde).
 */
function camadaDeFios(a: number, b: number, semente: number, cor: Float32Array): number {
  const j = Math.floor(b / LARGURA_DO_FIO)
  const fb = b / LARGURA_DO_FIO - j
  const comprimento = 3 + hash(j, semente, 941) * 4
  const ua = a / comprimento + hash(j, semente, 942)
  const k = Math.floor(ua)
  const fa = ua - k
  const h = hash(j, k, semente)
  cor[0] = h
  if (h < VAO_DA_PALHA) return -0.07
  const corpo = Math.sin(fb * Math.PI) * Math.sqrt(Math.sin(fa * Math.PI))
  return -0.05 + ((h - VAO_DA_PALHA) / (1 - VAO_DA_PALHA)) * 0.26 * corpo
}

const SORTEIO_1 = new Float32Array(1)
const SORTEIO_2 = new Float32Array(1)

/**
 * Os fios de palha no ponto, em coordenadas `a` (a direção principal) e `b`
 * (atravessando): duas camadas de pedaços curtos, cada uma um pouco torta para
 * um lado, e vale o fio mais claro dos dois (a palha cruzada, e não um veio).
 * Puxa a cor para o fio seco ou o verde. Escreve em `s`.
 */
function fios(a: number, b: number, s: Float32Array, escala: number, semente: number): void {
  const l1 = camadaDeFios(a * COS_CRUZA + b * SEN_CRUZA, b * COS_CRUZA - a * SEN_CRUZA, semente, SORTEIO_1)
  const l2 = camadaDeFios(a * COS_CRUZA - b * SEN_CRUZA + 31, b * COS_CRUZA + a * SEN_CRUZA + 17, semente + 3, SORTEIO_2)
  const luz = l1 > l2 ? l1 : l2
  const h = l1 > l2 ? SORTEIO_1[0] : SORTEIO_2[0]
  const k2 = escala < ESCALA_DO_FIO_INTEIRO ? CONTRASTE_DO_FIO_MIUDO : 1
  s[3] += luz * k2
  puxarACor(s, h, k2)
}

/** O fio sorteado `h` puxa a cor para o fio seco (os mais claros) ou o verde (uns poucos). */
function puxarACor(s: Float32Array, h: number, contraste: number): void {
  const cor = h > 0.9 ? FIO_SECO : h > VAO_DA_PALHA && h < 0.5 ? FIO_VERDE : null
  if (cor === null) return
  const t = 0.4 * contraste
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

// ---------- fardos empilhados ----------

/** Um fardo: o retângulo e se ele está deitado (comprido em x) ou em pé (comprido em y). */
interface Fardo {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly deitado: boolean
}

/** Período das lascas da palha prensada, ao comprido do fardo (px do protótipo). */
const LASCA = 5.6
/** As amarras ficam a esta fração da meia largura do fardo, dos dois lados do meio. */
const POSICAO_DA_AMARRA = 0.48
/** Quanto a palha afunda junto da amarra (px do protótipo de cada lado). */
const AFUNDADO_DA_AMARRA = 1.8

/**
 * A palha prensada de um fardo: os fios de través (em lascas), a divisa fina
 * de cada lasca ao comprido e o afundado ao lado das duas amarras.
 */
function texFardo(f: Fardo, semente: number): Textura {
  const cx = (f.x0 + f.x1) / 2
  const cy = (f.y0 + f.y1) / 2
  const meiaLargura = f.deitado ? (f.y1 - f.y0) / 2 : (f.x1 - f.x0) / 2
  return (_u, _v, x, y, _p, s, escala) => {
    // `ao` corre ao comprido do fardo, `atr` atravessa (a partir do meio).
    const ao = f.deitado ? x - cx : y - cy
    const atr = f.deitado ? y - cy : x - cx
    // Os fios correm de través, tortos pelo ruído (o lugar escorrega, a direção não gira: girar dobrava as
    // fileiras de fios em curvas compridas).
    fios(atr + ruido(ao * 0.2 + semente, atr * 0.2) * 2.2, ao + ruido(atr * 0.2, ao * 0.2 + semente) * 2.2, s, escala, semente)
    const fl = (ao + ruido(x * 0.12 + semente, y * 0.12) * 2.6) / LASCA
    const divisa = fl - Math.floor(fl)
    const perto = divisa < 1 - divisa ? divisa : 1 - divisa
    if (perto < 0.09) s[3] -= 0.06 * (1 - perto / 0.09)
    const amarra = Math.abs(Math.abs(atr) - meiaLargura * POSICAO_DA_AMARRA)
    if (amarra < AFUNDADO_DA_AMARRA) s[3] -= 0.16 * (1 - amarra / AFUNDADO_DA_AMARRA)
    s[3] += ruido(x * 0.07 + 3, y * 0.07) * 0.08
  }
}

/** A corda torcida da amarra: faixas em diagonal da cor da torção. */
const texAmarra: Textura = (u, v, _x, _y, _p, s) => {
  const t = Math.max(0, Math.min(1, (Math.sin((u * 0.8 + v * 1.4) * 1.1) - 0.2) / 0.8))
  s[0] += (TORCAO_DA_AMARRA[0] - s[0]) * t
  s[1] += (TORCAO_DA_AMARRA[1] - s[1]) * t
  s[2] += (TORCAO_DA_AMARRA[2] - s[2]) * t
}

/** Altura de um fardo em casas (o de cima fica em cima dele). */
const ALTURA_DO_FARDO = 0.42

/** Fios soltos saindo da beira de uma forma: pedaços finos de palha, alguns por fardo. */
function fiosSoltos(c: ContextoDoMovel, L: Peca[], pontos: readonly (readonly [number, number, number])[], semente: number): void {
  const { hw, hh } = c
  pontos.forEach(([x, y, angulo], i) => {
    const comprimento = 2.6 + hash(i, semente, 951) * 2.6
    const bx = Math.max(-hw + 0.6, Math.min(hw - 0.6, x + Math.cos(angulo) * comprimento))
    const by = Math.max(-hh + 0.6, Math.min(hh - 0.6, y + Math.sin(angulo) * comprimento))
    L.push(c.peca(capsula(x, y, bx, by, 0.42), FENO, { bisel: 0.3, tom: 0.82 + 0.14 * hash(i, semente, 952), contorno: 0.1, semente: semente + i }))
  })
}

function montarFardos(c: ContextoDoMovel, cena: Cena): void {
  const { w, hw, hh, g, peca: P } = c
  const vao = Math.max(0.8, w * 0.012)
  const largura = (w - 2 * vao - 1.2) / 3
  const embaixo: Fardo[] = [0, 1, 2].map((i) => {
    const x0 = -hw + 0.6 + i * (largura + vao)
    return { x0, y0: -hh + 0.8 + hash(i, 1, 961) * 1.2, x1: x0 + largura, y1: hh - 0.8 - hash(i, 2, 961) * 1.2, deitado: false }
  })
  // O de cima, deitado no fundo, por cima dos dois da esquerda: o comprido de um fardo em pé, a largura dele.
  const comprido = Math.min(embaixo[1].x1 - embaixo[0].x0 + vao, w * 0.7)
  const emCima: Fardo = { x0: -hw + 1.6, y0: -hh + 1.4, x1: -hw + 1.6 + comprido, y1: -hh + 1.4 + largura, deitado: true }
  const formaDo = (f: Fardo): Forma => caixa(f.x0, f.y0, f.x1, f.y1, Math.min(2.4, largura * 0.1))
  const formas = embaixo.map(formaDo)
  const formaDeCima = formaDo(emCima)
  cena.sombras.push(
    ...formas.map((forma) => ({ forma, z: g * ALTURA_DO_FARDO })),
    { forma: formaDeCima, z: g * ALTURA_DO_FARDO * 2, forca: 0.26 },
    contato(formas.reduce(uniao), 0.3),
  )
  const L = cena.partes
  // Os fios soltos por baixo da beira (a palha os cobre na raiz).
  fiosSoltos(c, L, [
    [embaixo[0].x0 + 0.8, hh * 0.35, Math.PI * 0.95],
    [embaixo[0].x0 + largura * 0.5, embaixo[0].y1 - 0.8, Math.PI * 0.58],
    [embaixo[1].x0 + largura * 0.3, embaixo[1].y1 - 0.8, Math.PI * 0.44],
    [embaixo[2].x1 - 0.8, hh * 0.1, Math.PI * 0.06],
    [embaixo[2].x0 + largura * 0.7, embaixo[2].y1 - 0.8, Math.PI * 0.4],
  ], 970)
  const fardo = (f: Fardo, forma: Forma, tom: number, k: number, emcima: boolean): void => {
    L.push(P(forma, FENO, { bisel: 3.2, tom, contorno: 0.22, textura: texFardo(f, 980 + k), semente: 980 + k, projeta: emcima ? { dist: 2.6, forca: 0.36, suave: 1.2 } : undefined }))
    // As duas amarras ao comprido, um pouco para dentro das pontas.
    const cx = (f.x0 + f.x1) / 2
    const cy = (f.y0 + f.y1) / 2
    const meia = (f.deitado ? f.y1 - f.y0 : f.x1 - f.x0) / 2
    for (const lado of [-1, 1]) {
      const d = lado * meia * POSICAO_DA_AMARRA
      const forma2 = f.deitado ? capsula(f.x0 + 1.2, cy + d, f.x1 - 1.2, cy + d, 0.7) : capsula(cx + d, f.y0 + 1.2, cx + d, f.y1 - 1.2, 0.7)
      L.push(P(forma2, AMARRA, { eixo: f.deitado ? 0 : Math.PI / 2, bisel: 0.6, tom: emcima ? 1 : 0.92, contorno: 0.12, textura: texAmarra, semente: 990 + k * 2 + (lado + 1) / 2 }))
    }
  }
  embaixo.forEach((f, i) => fardo(f, formas[i], 0.9 + 0.05 * hash(i, 3, 961), i, false))
  fardo(emCima, formaDeCima, 1.04, 3, true)
}

// ---------- monte de feno ----------

/** A franja da beira do monte (px do protótipo): ali a palha rareia em fiapos e o chão aparece entre eles. */
const FRANJA = 2.6

/**
 * Os fios do monte: a direção muda devagar pelo monte (um campo de ângulos do
 * ruído), como a palha jogada com o forcado; mais claro no alto (`cx`, `cy`).
 * Perto da beira de `forma`, a franja: fiapos ao longo dos fios, com o chão
 * entre eles (a beira do monte não é um risco liso).
 */
function texMonte(forma: Forma, cx: number, cy: number, raio: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    // A palha solta cruza em três direções fixas (0°, 60° e 120°, tortas pelo ruído), e vale a mais clara:
    // um campo de ângulos que gira dobrava as fileiras de fios em curvas, como as linhas de uma digital.
    const tx = x + ruido(y * 0.2 + semente, x * 0.2) * 2.4
    const ty = y + ruido(x * 0.2, y * 0.2 + semente) * 2.4
    const l0 = camadaDeFios(tx, ty, semente, SORTEIO_1)
    const h0 = SORTEIO_1[0]
    const l1 = camadaDeFios(tx * -0.5 + ty * 0.866 + 13, ty * -0.5 - tx * 0.866, semente + 5, SORTEIO_1)
    const h1 = SORTEIO_1[0]
    const l2 = camadaDeFios(tx * -0.5 - ty * 0.866 + 29, ty * -0.5 + tx * 0.866 + 7, semente + 9, SORTEIO_2)
    const h2 = SORTEIO_2[0]
    const luz = Math.max(l0, l1, l2)
    const h = luz === l0 ? h0 : luz === l1 ? h1 : h2
    const k2 = escala < ESCALA_DO_FIO_INTEIRO ? CONTRASTE_DO_FIO_MIUDO : 1
    s[3] += luz * k2
    puxarACor(s, h, k2)
    const a = tx
    const b = ty
    const q = Math.hypot(x - cx, y - cy) / raio
    s[3] += ruido(x * 0.09 + 7, y * 0.09) * 0.1 + (0.5 - Math.min(1, q)) * 0.1
    const d = forma.d(x, y)
    if (d > -FRANJA) {
      const fora = (d + FRANJA) / FRANJA
      const fiapo = hash(Math.floor(b / LARGURA_DO_FIO), Math.floor(a / 2.2), semente + 7)
      if (fiapo < fora * 0.95) s[5] = 0
    }
  }
}

/** Os tufos de palha espalhados no chão em volta do monte: [x, y] em fração da meia pegada e o raio em px. */
const TUFOS: readonly (readonly [number, number, number])[] = [
  [-0.82, 0.3, 3.4],
  [-0.5, 0.74, 3.8],
  [0.12, 0.86, 3.2],
  [0.66, 0.6, 4],
  [0.86, 0.02, 3],
  [0.5, -0.74, 2.8],
  [-0.62, -0.62, 2.6],
]

/** Altura do monte em casas (a sombra no chão). */
const ALTURA_DO_MONTE = 0.62

/**
 * União SUAVE (o "smooth min" de Inigo Quilez, raio `k`): os lóbulos do monte
 * se fundem sem vinco. Com a união seca, o chanfro marcava o encontro de cada
 * elipse com uma dobra, e as dobras liam como os anéis de um tronco.
 */
function uniaoSuave(a: Forma, b: Forma, k: number): Forma {
  return {
    b: [Math.min(a.b[0], b.b[0]), Math.min(a.b[1], b.b[1]), Math.max(a.b[2], b.b[2]), Math.max(a.b[3], b.b[3])],
    d(x, y) {
      const da = a.d(x, y)
      const db = b.d(x, y)
      const h = Math.max(k - Math.abs(da - db), 0) / k
      return Math.min(da, db) - h * h * k * 0.25
    },
  }
}

function montarMonte(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  // O monte: a roda de baixo com três lóbulos, e o alto, um pouco para trás (para o lado da luz).
  const funde = R * 0.3
  const monte = uniaoSuave(
    uniaoSuave(elipse(0, hh * 0.06, hw * 0.78, hh * 0.7), elipse(-hw * 0.32, -hh * 0.22, hw * 0.48, hh * 0.44), funde),
    uniaoSuave(elipse(hw * 0.34, -hh * 0.08, hw * 0.46, hh * 0.48), elipse(hw * 0.04, hh * 0.38, hw * 0.56, hh * 0.42), funde),
    funde,
  )
  cena.sombras.push({ forma: monte, z: g * ALTURA_DO_MONTE, suave: 2 }, contato(monte, 0.28))
  const L = cena.partes
  // Os tufos no chão em volta, ralos, e os fios soltos (a palha que caiu do forcado).
  TUFOS.forEach(([fx, fy, raio], i) => {
    const tufo = elipse(fx * hw, fy * hh, raio * 1.3, raio)
    L.push(P(tufo, FENO, { bisel: 0.6, tom: 0.86, contorno: 0, textura: texMonte(tufo, fx * hw, fy * hh, raio, 1001 + i), semente: 1001 + i }))
  })
  const soltos: [number, number, number][] = []
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + hash(i, 1, 1003) * 0.5
    const d = 0.7 + hash(i, 2, 1003) * 0.16
    soltos.push([Math.cos(a) * hw * d, Math.sin(a) * hh * d, a + (hash(i, 3, 1003) - 0.5) * 1.6])
  }
  fiosSoltos(c, L, soltos, 1010)
  // Um domo só (o chanfro largo dá o volume) e o alto clareado pela textura, um pouco para trás: com uma
  // segunda peça por cima, a beira dela desenhava uma dobra e o monte virava um caracol.
  L.push(P(monte, FENO, { bisel: R * 0.66, tom: 0.96, contorno: 0, textura: texMonte(monte, -hw * 0.08, -hh * 0.12, R * 0.8, 1020), semente: 1020 }))
}

export const montarFeno: MontarMovel = (c, cena) => {
  if (c.variante === 1) montarMonte(c, cena)
  else montarFardos(c, cena)
}
