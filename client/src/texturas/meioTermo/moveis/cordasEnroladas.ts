/**
 * CORDAS ENROLADAS de cima com volume (lote 12 dos objetos novos, 11/11/2026;
 * a campanha é de piratas): os cabos de um navio aduchados no convés. O ROLO
 * GRANDE é a corda grossa de cânhamo enrolada em espiral chata (a aducha à
 * flamenga), volta encostada em volta, com a ponta de dentro falcaçada no
 * miolo; a ponta de fora sai do rolo e corre até o CABEÇO DE AMARRAÇÃO de
 * ferro, onde a alça dela está passada em volta da coluna, debaixo do chapéu,
 * com a costura na garganta. O ROLO MENOR, de cabo alcatroado (mais escuro),
 * está empilhado em voltas soltas, uma por cima da outra, encostado no rolo
 * grande; a ponta dele corre solta pelo chão e acaba num NÓ, com a falcaça na
 * ponta.
 *
 * O que diz "corda" a 25% de zoom é a espiral e a torção: os fios em diagonal
 * acompanham cada volta (a torção do vergueiro do canhão, aqui medida ao longo
 * da espiral inteira). O cabeço escuro e alto, com a sombra comprida, segura o
 * canto de cima.
 *
 * Sem material no painel: o cânhamo, o cabo alcatroado e o ferro do cabeço são
 * fixos, como a corda do canhão e o feno. As posições são frações da meia
 * pegada (1 x 1 casa de partida); o que é redondo (os rolos, o cabeço, a
 * grossura da corda) sai do menor lado.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { barra, cadeia, caixa, capsula, elipse, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Projecao, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as cores ----------

/** O cânhamo do rolo grande e da alça no cabeço (o do vergueiro do canhão) e o fundo da torção. */
const CANHAMO: Rgb = [0xc4, 0xac, 0x7e]
const TORCAO_DO_CANHAMO: Rgb = [0x8e, 0x76, 0x50]
/** O cabo alcatroado do rolo menor: mais escuro e mais frio, para os dois rolos não virarem um só a 25%. */
const ALCATROADO: Rgb = [0x9a, 0x82, 0x60]
const TORCAO_DO_ALCATROADO: Rgb = [0x64, 0x52, 0x3a]
/** A falcaça (o fio enrolado que arremata a ponta da corda). */
const FALCACA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x46, 0x30] }
/** O ferro do cabeço, de piche gasto (quase preto), e o da chapa e das porcas, menos escuro. */
const FERRO_DO_CABECO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.76)) }
const FERRO_DA_CHAPA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }

const VOLTA = Math.PI * 2

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

// ---------- a torção ----------

/** Uma volta da torção a cada `PASSO_DA_TORCAO` px ao longo da corda e o quanto a faixa deita de través (a cocha da corda). */
const PASSO_DA_TORCAO = 3.9
const DEITADO_DA_TORCAO = 1.8
/** A faixa escura da torção ocupa pouco mais de um terço da volta: a corda continua lendo clara. */
const COMECO_DA_FAIXA = 0.3
/** A corda é redonda e o chanfro a escurece nas beiras: um pouco de luz a mais deixa o meio no tom do cânhamo. */
const LUZ_DA_CORDA = 0.06

/** A torção no ponto, pelo caminho andado ao longo da corda e pela distância de través (positiva para dentro da curva). */
function torcer(s: Float32Array, aoLongo: number, atraves: number, raio: number, fundo: Rgb, x: number, y: number): void {
  const faixa = Math.sin((aoLongo / PASSO_DA_TORCAO) * VOLTA + (atraves / raio) * DEITADO_DA_TORCAO)
  misturarEm(s, fundo, limitar((faixa - COMECO_DA_FAIXA) / (1 - COMECO_DA_FAIXA), 0, 1))
  s[3] += LUZ_DA_CORDA + ruido(x * 0.7, y * 0.7) * 0.04
}

/** A torção AO LONGO de um caminho de pedaços retos (a do vergueiro do canhão): as faixas acompanham as curvas. */
function texDoCaminho(caminho: readonly Ponto[], raio: number, fundo: Rgb, inicio = 0): Textura {
  const ate: number[] = [inicio]
  for (let i = 1; i < caminho.length; i += 1) ate.push(ate[i - 1] + Math.hypot(caminho[i][0] - caminho[i - 1][0], caminho[i][1] - caminho[i - 1][1]))
  return (_u, _v, x, y, _p, s) => {
    let menor = Infinity
    let aoLongo = 0
    let atraves = 0
    for (let i = 1; i < caminho.length; i += 1) {
      const [ax, ay] = caminho[i - 1]
      const dx = caminho[i][0] - ax
      const dy = caminho[i][1] - ay
      const comprimento = ate[i] - ate[i - 1] || 1e-9
      const h = limitar(((x - ax) * dx + (y - ay) * dy) / (comprimento * comprimento), 0, 1)
      const qx = x - ax - dx * h
      const qy = y - ay - dy * h
      const d2 = qx * qx + qy * qy
      if (d2 >= menor) continue
      menor = d2
      aoLongo = ate[i - 1] + h * comprimento
      atraves = (qy * dx - qx * dy) / comprimento
    }
    torcer(s, aoLongo, atraves, raio, fundo, x, y)
  }
}

/** Pedaços por vão da curva: a corda não faz quina. */
const PASSOS_DA_CURVA = 5

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
}

/** A curva suave que passa pelos pontos (Catmull-Rom). */
function curva(pontos: readonly Ponto[]): Ponto[] {
  const ultimo = pontos.length - 1
  const saida: Ponto[] = []
  for (let i = 0; i < ultimo; i += 1) {
    const p0 = pontos[Math.max(0, i - 1)]
    const p1 = pontos[i]
    const p2 = pontos[i + 1]
    const p3 = pontos[Math.min(ultimo, i + 2)]
    for (let j = 0; j < PASSOS_DA_CURVA; j += 1) {
      const t = j / PASSOS_DA_CURVA
      saida.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)])
    }
  }
  saida.push(pontos[ultimo])
  return saida
}

// ---------- a espiral do rolo grande ----------

/**
 * A espiral chata (de Arquimedes) do rolo grande, que gira no sentido do relógio na tela, do miolo para fora:
 * o meio, o raio no miolo, o passo de uma volta, o ângulo andado do miolo até a ponta de fora e o ângulo, na
 * tela, em que a ponta de fora fica.
 */
interface Espiral {
  readonly cx: number
  readonly cy: number
  readonly r0: number
  readonly passo: number
  readonly giro: number
  readonly fim: number
}

function raioNaEspiral(e: Espiral, th: number): number {
  return e.r0 + (e.passo * th) / VOLTA
}

/** O caminho andado do miolo até o ângulo `th` (o comprimento da espiral). */
function andadoNaEspiral(e: Espiral, th: number): number {
  return e.r0 * th + (e.passo * th * th) / (2 * VOLTA)
}

/** O mais perto da espiral, por conta (sem procurar pedaço por pedaço): [distância ao eixo da corda, ângulo andado, de través]. */
const PERTO = new Float64Array(3)
function pertoDaEspiral(e: Espiral, x: number, y: number): void {
  const dx = x - e.cx
  const dy = y - e.cy
  const rho = Math.sqrt(dx * dx + dy * dy)
  const inicio = e.fim - e.giro
  let fase = Math.atan2(dy, dx) - inicio
  fase -= Math.floor(fase / VOLTA) * VOLTA
  // A volta cujo raio, neste ângulo, é o mais perto do ponto; a de dentro e a de fora entram para as pontas.
  const n0 = Math.round((rho - e.r0 - (e.passo * fase) / VOLTA) / e.passo)
  PERTO[0] = Infinity
  for (let n = n0 - 1; n <= n0 + 1; n += 1) {
    const th = fase + VOLTA * n
    let dist: number
    let andou: number
    let atraves: number
    if (th < 0 || th > e.giro) {
      // Além de uma ponta: a distância até a ponta (o arremate redondo da corda).
      andou = th < 0 ? 0 : e.giro
      const r = raioNaEspiral(e, andou)
      const a = inicio + andou
      dist = Math.hypot(x - e.cx - Math.cos(a) * r, y - e.cy - Math.sin(a) * r)
      atraves = r - rho
    } else {
      andou = th
      atraves = raioNaEspiral(e, th) - rho
      dist = Math.abs(atraves)
    }
    if (dist < PERTO[0]) {
      PERTO[0] = dist
      PERTO[1] = andou
      PERTO[2] = atraves
    }
  }
}

function formaDaEspiral(e: Espiral, raio: number): Forma {
  const R = raioNaEspiral(e, e.giro) + raio
  return {
    b: [e.cx - R, e.cy - R, e.cx + R, e.cy + R],
    d(x, y) {
      pertoDaEspiral(e, x, y)
      return PERTO[0] - raio
    },
  }
}

function texDaEspiral(e: Espiral, raio: number, fundo: Rgb): Textura {
  return (_u, _v, x, y, _p, s) => {
    pertoDaEspiral(e, x, y)
    torcer(s, andadoNaEspiral(e, PERTO[1]), PERTO[2], raio, fundo, x, y)
  }
}

/** O ponto da espiral no ângulo andado `th` e o rumo dela ali (para fora, no sentido do relógio). */
function naEspiral(e: Espiral, th: number): { readonly ponto: Ponto; readonly rumo: Ponto } {
  const a = e.fim - e.giro + th
  const r = raioNaEspiral(e, th)
  return { ponto: [e.cx + Math.cos(a) * r, e.cy + Math.sin(a) * r], rumo: [-Math.sin(a), Math.cos(a)] }
}

// ---------- uma volta solta do rolo menor ----------

/** Uma volta fechada de corda: o meio, o raio, o quanto ela ovaliza e onde (a volta jogada à mão não é redonda). */
interface Volta {
  readonly cx: number
  readonly cy: number
  readonly raio: number
  readonly ovalado: number
  readonly fase: number
}

function raioDaVolta(v: Volta, a: number): number {
  return v.raio * (1 + v.ovalado * Math.sin(2 * a + v.fase))
}

function formaDaVolta(v: Volta, grossura: number): Forma {
  const R = v.raio * (1 + v.ovalado) + grossura
  return {
    b: [v.cx - R, v.cy - R, v.cx + R, v.cy + R],
    d(x, y) {
      const a = Math.atan2(y - v.cy, x - v.cx)
      return Math.abs(Math.hypot(x - v.cx, y - v.cy) - raioDaVolta(v, a)) - grossura
    },
  }
}

/** A torção da volta: um número inteiro de faixas na volta inteira, para não haver emenda onde o ângulo dá a volta. */
function texDaVolta(v: Volta, grossura: number, fundo: Rgb): Textura {
  const faixas = Math.max(1, Math.round((VOLTA * v.raio) / PASSO_DA_TORCAO))
  const porRadiano = (faixas * PASSO_DA_TORCAO) / VOLTA
  return (_u, _v, x, y, _p, s) => {
    const a = Math.atan2(y - v.cy, x - v.cx)
    torcer(s, (a + Math.PI) * porRadiano, raioDaVolta(v, a) - Math.hypot(x - v.cx, y - v.cy), grossura, fundo, x, y)
  }
}

// ---------- as medidas ----------

/** O raio da corda (fração do menor lado): o cabo grosso de amarração. */
const RAIO_DO_CABO = 0.034
/** O rolo grande: o meio (frações da meia pegada), o raio de fora, o do miolo e a folga entre as voltas (menor lado). */
const ROLO_GRANDE = { x: -0.29, y: -0.07, raio: 0.32, miolo: 0.06, folga: 0.004 } as const
/** O cabeço: o meio (frações da meia pegada), a meia chapa, a coluna, o chapéu e a cúpula (menor lado). */
const CABECO = { x: 0.68, y: -0.66, chapa: 0.14, coluna: 0.064, chapeu: 0.1, cupula: 0.072 } as const
/** A garganta da alça: a distância até o meio da coluna (menor lado) e o comprimento da costura antes dela. */
const GARGANTA = 0.19
const COSTURA = 0.1
/**
 * O rolo menor: o meio (frações da meia pegada), o raio das voltas (menor lado) e cada volta, de baixo para
 * cima: [dx, dy] (px da casa de 56), o raio a mais, o ovalado. Desencontradas assim, as voltas se leem uma a
 * uma; quase em cima umas das outras, o rolo virava um anel grosso só.
 */
const ROLO_MENOR = { x: 0.5, y: 0.52, raio: 0.17 } as const
const VOLTAS_DO_ROLO_MENOR: readonly (readonly [number, number, number, number])[] = [
  [-2.2, 1.6, 0.06, 0.07],
  [1.8, -1.2, -0.04, 0.06],
  [-1.2, -2, 0.05, 0.05],
  [0.8, 0.9, -0.02, 0.045],
]
/** A ponta solta do rolo menor: de onde sai na volta de cima (ângulo), o caminho no chão (frações da meia pegada) e o nó. */
const SAIDA_DA_PONTA = 2.6
const CAMINHO_DA_PONTA: readonly Ponto[] = [
  [-0.07, 0.8],
  [-0.36, 0.85],
]
/** O nó: a laçada é mais apertada que a grossura da corda, então fecha num caroço torcido (com buraco, lia argola). */
const NO = { x: -0.57, y: 0.82, raio: 0.026 } as const
const RABO_DO_NO: Ponto = [-0.82, 0.74]
/** Alturas em casas: o rolo grande (uma corda deitada), o rolo menor (as voltas empilhadas), a coluna e o chapéu do cabeço. */
const ALTURA_DO_ROLO_GRANDE = 0.07
const ALTURA_DO_ROLO_MENOR = 0.16
const ALTURA_DA_COLUNA = 0.3
const ALTURA_DO_CABECO = 0.36
/** A sombra que a corda de cima faz na de baixo. */
const SOMBRA_DA_CORDA: Projecao = { dist: 0.9, forca: 0.3, suave: 0.7 }

/** Uma corda por um caminho suave: a forma, a sombra no chão e a peça com a torção. Devolve o caminho. */
function corda(c: ContextoDoMovel, cena: Cena, pontos: readonly Ponto[], raio: number, tom: Rgb, fundo: Rgb, semente: number, inicio = 0): Ponto[] {
  const caminho = curva(pontos)
  const forma = cadeia(caminho, raio)
  cena.sombras.push(contato(forma, 0.24))
  cena.partes.push(c.peca(forma, { classe: 'liso', rgb: tom }, { bisel: raio, contorno: 0.3, textura: texDoCaminho(caminho, raio, fundo, inicio), semente, projeta: SOMBRA_DA_CORDA }))
  return caminho
}

/**
 * A falcaça: a cinta de fio escuro, de pontas retas, um pouco antes da ponta `fim` (vindo de `antes`). Em
 * cápsula ela virava um gomo marrom maior que a própria ponta da corda.
 */
function falcaca(c: ContextoDoMovel, cena: Cena, antes: Ponto, fim: Ponto, raio: number, semente: number): void {
  const comprimento = Math.hypot(fim[0] - antes[0], fim[1] - antes[1]) || 1
  const ux = (fim[0] - antes[0]) / comprimento
  const uy = (fim[1] - antes[1]) / comprimento
  const de = raio * 2.3
  const ate = raio * 1.1
  cena.partes.push(c.peca(barra(fim[0] - ux * de, fim[1] - uy * de, fim[0] - ux * ate, fim[1] - uy * ate, raio * 2.15), FALCACA, { bisel: raio * 0.6, contorno: 0.22, semente }))
}

// ---------- o rolo grande, a alça e o cabeço ----------

function montarRoloGrandeECabeco(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, g } = c
  const P = c.peca
  const L = cena.partes
  const k = Math.min(c.w, c.h)
  const raio = k * RAIO_DO_CABO
  const cx = ROLO_GRANDE.x * hw
  const cy = ROLO_GRANDE.y * hh
  const bx = CABECO.x * hw
  const by = CABECO.y * hh

  // A garganta da alça fica na linha entre o cabeço e o meio do rolo; a ponta de fora sai do rolo na tangente que chega nela.
  const paraORolo = Math.atan2(cy - by, cx - bx)
  const garganta: Ponto = [bx + Math.cos(paraORolo) * k * GARGANTA, by + Math.sin(paraORolo) * k * GARGANTA]
  const passo = 2 * raio + k * ROLO_GRANDE.folga
  const r0 = k * ROLO_GRANDE.miolo
  const rFora = k * ROLO_GRANDE.raio - raio
  const dist = Math.hypot(garganta[0] - cx, garganta[1] - cy)
  const fim = Math.atan2(garganta[1] - cy, garganta[0] - cx) - Math.acos(Math.min(1, rFora / dist))
  const espiral: Espiral = { cx, cy, r0, passo, giro: ((rFora - r0) / passo) * VOLTA, fim }

  // A ponta de fora, por baixo da última volta (o arremate redondo da espiral cobre a emenda), até a garganta.
  const { ponto: saida, rumo } = naEspiral(espiral, espiral.giro)
  const eixo: Ponto = [Math.cos(paraORolo), Math.sin(paraORolo)]
  const antesDaGarganta: Ponto = [garganta[0] + eixo[0] * k * COSTURA, garganta[1] + eixo[1] * k * COSTURA]
  corda(c, cena, [saida, [saida[0] + rumo[0] * raio * 2.5, saida[1] + rumo[1] * raio * 2.5], antesDaGarganta, garganta], raio, CANHAMO, TORCAO_DO_CANHAMO, 7400, andadoNaEspiral(espiral, espiral.giro))

  // A espiral: uma corda só, do miolo para fora, com a ponta de dentro falcaçada.
  const rolo = formaDaEspiral(espiral, raio)
  cena.sombras.push({ forma: elipse(cx, cy, rFora + raio, rFora + raio), z: g * ALTURA_DO_ROLO_GRANDE }, contato(elipse(cx, cy, rFora + raio, rFora + raio), 0.3))
  L.push(P(rolo, { classe: 'liso', rgb: CANHAMO }, { bisel: raio, contorno: 0.32, textura: texDaEspiral(espiral, raio, TORCAO_DO_CANHAMO), semente: 7401, projeta: SOMBRA_DA_CORDA }))
  const miolo = naEspiral(espiral, 0)
  const dentro = naEspiral(espiral, 0.9)
  falcaca(c, cena, dentro.ponto, miolo.ponto, raio, 7402)

  // O cabeço: a chapa aparafusada no convés, as quatro porcas e, por cima da alça, o chapéu com a cúpula.
  const a = k * CABECO.chapa
  const chapa = caixa(bx - a, by - a, bx + a, by + a, a * 0.3)
  cena.sombras.push(contato(chapa, 0.3), { forma: elipse(bx, by, k * CABECO.coluna, k * CABECO.coluna), z: g * ALTURA_DA_COLUNA })
  cena.sombras.push({ forma: elipse(bx, by, k * CABECO.chapeu, k * CABECO.chapeu), z: g * ALTURA_DO_CABECO, solta: true, forca: 0.3 })
  L.push(P(chapa, FERRO_DA_CHAPA, { tabua: 0, bisel: 0.8, tom: 0.92, contorno: 0.3, metal: 0.2, semente: 7410 }))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    L.push(P(elipse(bx + sx * a * 0.72, by + sy * a * 0.72, k * 0.017, k * 0.017), FERRO_DA_CHAPA, { bisel: k * 0.017, tom: 1.12, contorno: 0.2, metal: 0.36 }))
  }

  // A alça em volta da coluna: da garganta, as duas pernas abrem nas tangentes e dão a volta por trás do cabeço.
  // Ela fica debaixo da aba do chapéu e sai um pouco para fora dela: de cima se vê o anel de corda em volta.
  const rAlca = k * CABECO.chapeu + raio * 0.15
  const abre = Math.acos(Math.min(1, rAlca / (k * GARGANTA)))
  const deUmLado = paraORolo + abre
  const doOutro = paraORolo - abre + VOLTA
  const PASSOS_DA_ALCA = 14
  const alca: Ponto[] = [garganta]
  for (let i = 0; i <= PASSOS_DA_ALCA; i += 1) {
    const ang = deUmLado + ((doOutro - deUmLado) * i) / PASSOS_DA_ALCA
    alca.push([bx + Math.cos(ang) * rAlca, by + Math.sin(ang) * rAlca])
  }
  alca.push(garganta)
  const formaDaAlca = cadeia(alca, raio)
  L.push(P(formaDaAlca, { classe: 'liso', rgb: CANHAMO }, { bisel: raio, contorno: 0.3, textura: texDoCaminho(alca, raio, TORCAO_DO_CANHAMO), semente: 7420, projeta: SOMBRA_DA_CORDA }))
  // A costura na garganta: a corda mais grossa onde a ponta foi entrançada de volta nela, arrematada de falcaça.
  const costura = capsula(antesDaGarganta[0], antesDaGarganta[1], garganta[0] - eixo[0] * raio * 0.6, garganta[1] - eixo[1] * raio * 0.6, raio * 1.28)
  L.push(P(costura, { classe: 'liso', rgb: CANHAMO }, { bisel: raio * 1.2, tom: 0.94, contorno: 0.3, textura: texDoCaminho([antesDaGarganta, garganta], raio * 0.8, TORCAO_DO_CANHAMO), semente: 7421, projeta: SOMBRA_DA_CORDA }))
  falcaca(c, cena, garganta, antesDaGarganta, raio * 1.15, 7422)

  // O chapéu do cabeço: a aba larga por cima da alça e o topo chato de ferro fundido, de piche gasto. Com a
  // cúpula redonda e brilhante ele lia bala de canhão; chato, com a aba, lê o pé de amarração visto de cima.
  L.push(P(elipse(bx, by, k * CABECO.chapeu, k * CABECO.chapeu), FERRO_DO_CABECO, { tabua: 0, bisel: 1.3, tom: 0.92, contorno: 0.32, metal: 0.3, semente: 7430, projeta: { dist: 1.8, forca: 0.42, suave: 1 } }))
  L.push(P(elipse(bx, by, k * CABECO.cupula, k * CABECO.cupula), FERRO_DO_CABECO, { tabua: 0, bisel: k * CABECO.cupula * 0.35, tom: 1.02, contorno: 0.24, metal: 0.24, semente: 7431 }))
}

// ---------- o rolo menor e a ponta com o nó ----------

function montarRoloMenor(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, g } = c
  const P = c.peca
  const L = cena.partes
  const k = Math.min(c.w, c.h)
  const raio = k * RAIO_DO_CABO
  const cx = ROLO_MENOR.x * hw
  const cy = ROLO_MENOR.y * hh
  const R = k * ROLO_MENOR.raio
  const borda = elipse(cx, cy, R + raio * 1.6, R + raio * 1.6)
  cena.sombras.push({ forma: borda, z: g * ALTURA_DO_ROLO_MENOR }, contato(borda, 0.32))

  // As voltas, de baixo para cima: cada uma desencontrada da de baixo, a de baixo mais escura (está na sombra das de cima).
  let ultima: Volta = { cx, cy, raio: R, ovalado: 0, fase: 0 }
  VOLTAS_DO_ROLO_MENOR.forEach(([dx, dy, mais, ovalado], i) => {
    const volta: Volta = { cx: cx + (dx * k) / G, cy: cy + (dy * k) / G, raio: R * (1 + mais), ovalado, fase: hash(i, 1, 7501) * VOLTA }
    const tom = 0.8 + (0.2 * i) / (VOLTAS_DO_ROLO_MENOR.length - 1)
    L.push(P(formaDaVolta(volta, raio), { classe: 'liso', rgb: ALCATROADO }, { bisel: raio, tom, contorno: 0.32, textura: texDaVolta(volta, raio, TORCAO_DO_ALCATROADO), semente: 7500 + i, projeta: SOMBRA_DA_CORDA }))
    ultima = volta
  })

  // A ponta solta: sai da volta de cima, corre pelo chão e entra no nó.
  const r = raioDaVolta(ultima, SAIDA_DA_PONTA)
  const saida: Ponto = [ultima.cx + Math.cos(SAIDA_DA_PONTA) * r, ultima.cy + Math.sin(SAIDA_DA_PONTA) * r]
  const nx = NO.x * hw
  const ny = NO.y * hh
  const rNo = k * NO.raio
  const naMeiaPegada = ([fx, fy]: Ponto): Ponto => [fx * hw, fy * hh]
  corda(c, cena, [saida, ...CAMINHO_DA_PONTA.map(naMeiaPegada), [nx + rNo * 1.1, ny + rNo * 0.5]], raio, ALCATROADO, TORCAO_DO_ALCATROADO, 7510)

  // O nó: a laçada (uma volta fechada da corda) e o chicote, que sai de dentro dela por cima e acaba falcaçado.
  const laco: Volta = { cx: nx, cy: ny, raio: rNo, ovalado: 0.08, fase: 0.6 }
  const formaDoLaco = formaDaVolta(laco, raio)
  cena.sombras.push(contato(formaDoLaco, 0.28))
  L.push(P(formaDoLaco, { classe: 'liso', rgb: ALCATROADO }, { bisel: raio, tom: 0.92, contorno: 0.32, textura: texDaVolta(laco, raio, TORCAO_DO_ALCATROADO), semente: 7520, projeta: SOMBRA_DA_CORDA }))
  const [rx, ry] = naMeiaPegada(RABO_DO_NO)
  const chicote = corda(c, cena, [[nx + rNo * 0.5, ny + rNo * 0.3], [nx - rNo * 0.8, ny - rNo * 0.3], [(nx + rx) / 2, (ny + ry) / 2 - rNo * 0.2], [rx, ry]], raio, ALCATROADO, TORCAO_DO_ALCATROADO, 7521)
  falcaca(c, cena, chicote[chicote.length - 3], chicote[chicote.length - 1], raio, 7522)
}

export const montarCordasEnroladas: MontarMovel = (c, cena) => {
  montarRoloGrandeECabeco(c, cena)
  montarRoloMenor(c, cena)
}
