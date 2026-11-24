import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * LAJEADO POLIGONAL (lista de 24/11/2026, item 114; mapa 8): pedras chatas e irregulares, de MUITOS LADOS e de
 * TAMANHOS MISTURADOS, cinza-azul escuro, assentadas lado a lado com juntas FINAS (o lajeado de ardósia, o "opus
 * incertum"). As pedras saem de um Voronoi de pontos espalhados numa grade que dá a volta no ladrilho (uma célula e
 * meia por casa), num lugar um nada torcido pelo ruído (a pedra cortada tem lado quase reto) e com os cantos
 * arredondados (mínimo suave das duas bordas mais perto). Para sair de pedra grande a lasca pequena (área de 1 para
 * 5), uma célula em quatro se FUNDE com a vizinha (a mesma pedra: a mediatriz entre as duas não vira junta) e uma em
 * cinco se DIVIDE em duas, com um segundo ponto. Cada pedra no seu tom, cedida um nada para um lado, com o ombro de
 * cima à esquerda pegando a luz e as camadas da pedra (a clivagem da ardósia) em faixas fracas, num rumo sorteado por
 * pedra. Com uma célula por pedra, todas do mesmo tamanho, a grade lia como couro de girafa ou lama rachada.
 *
 * Diferente das vizinhas: o Calçamento é de pedras redondas e graúdas, de junta larga; o Basalto em colunas é de
 * hexágonos certos; as Pedras com lama têm lama entre elas. Aqui a pedra é chata e angulosa e a junta é um fio.
 */

const CASAS = 8
/** Células por lado do ladrilho: uma célula e meia por casa. */
const PEDRAS = 12
const CASAS_POR_CELULA = CASAS / PEDRAS
/** O quanto o ponto da pedra foge do meio da célula (0 a 0,5). */
const FOLGA = 0.42
const SEMENTE = 11400
/** Em quantas células a pedra se funde com a vizinha (pedra grande) e em quantas a célula se divide em duas (lascas). */
const FUNDE = 0.25
const DIVIDE = 0.2
/** O segundo ponto da célula dividida: a distância do primeiro, em células, e a margem até a beira da célula. */
const SEGUNDO = { afasta: [0.3, 0.45] as const, margem: 0.06 } as const
/** As vizinhas com que a célula pode se fundir: a da direita, a de baixo, a da esquerda e a de cima. */
const VIZINHAS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]

/** Meia junta de cada pedra, em casas: a junta fina (somando as duas pedras, uns 5 cm). */
const MEIA_JUNTA = [0.013, 0.019] as const
/** O raio do canto arredondado (o mínimo suave das duas bordas), em casas. */
const CANTO = 0.05
/**
 * A torção do lugar onde se procura a pedra, em células: a larga só entorta um nada (a borda ondulada lia como lama;
 * a pedra cortada tem lado reto), a miúda lasca a beira.
 */
const TORCAO = { larga: 0.04, miuda: 0.015 } as const
/** O ombro gasto: da borda até `largura` casas para dentro a pedra desce; a inclinação na borda. */
const OMBRO = { largura: 0.06, inclinacao: 0.3 } as const
const TORTO = 0.045
const LUZ_DO_RELEVO = 0.24
/** A passagem macia da pedra para a junta, em casas a partir da borda: para fora quase nada, e a junta fica um fio. */
const PASSAGEM = { dentro: -0.008, fora: 0.004 } as const
/** A poeira na beira: até onde entra (casas) e quanto escurece. */
const POEIRA = { largura: 0.06, forca: 0.05 } as const
/** As camadas da pedra: faixas por casa e a força delas. */
const CAMADAS = { porCasa: 7, forca: 0.03 } as const
/** Ruído de valor sem período: para o que é medido dentro da pedra e não no ladrilho. */
const SEM_PERIODO = 1 << 20
/** O lado da vizinhança procurada: 5 x 5 células, para a borda certa mesmo com o ponto longe do meio. */
const VIZINHANCA = 5
const MEIA_VIZINHANCA = (VIZINHANCA - 1) / 2
/** Os pontos da vizinhança: até dois por célula. */
const MAXIMO_DE_PONTOS = VIZINHANCA * VIZINHANCA * 2

/** Ardósia cinza-azul escura (croma ~0,07): nenhuma sai azul de verdade. */
const TONS: readonly Rgb[] = [rgb('#4f5761'), rgb('#535b64'), rgb('#4b535c'), rgb('#57606a'), rgb('#4e555d'), rgb('#525a61'), rgb('#485059')]
/** A junta: o mesmo azul-ardósia, fundo, sem chegar ao preto (a junta preta saía grossa na mesa). */
const COR_DA_JUNTA = rgb('#333a41')

/** As pedras do ladrilho, sorteadas uma vez. */
interface Pedras {
  /** O 1º ponto de cada célula, dentro dela (0 a 1). */
  readonly px: Float64Array
  readonly py: Float64Array
  /** O 2º ponto, só nas células divididas (`divide` = 1): a pedra dele é `célula * 2 + 1`. */
  readonly qx: Float64Array
  readonly qy: Float64Array
  readonly divide: Uint8Array
  /** A pedra do 1º ponto: `célula * 2`, ou a da vizinha com que a célula se fundiu. */
  readonly dono: Int32Array
  /** O ponto de referência da pedra do 1º ponto, a partir do canto da célula (o da vizinha, se fundiu): as camadas correm iguais na pedra inteira. */
  readonly refX: Float64Array
  readonly refY: Float64Array
}

let prontas: Pedras | null = null
/** Os pontos da vizinhança do ponto em conta (só uma conta por vez: a função não é reentrante). */
const CANDIDATAS_X = new Float64Array(MAXIMO_DE_PONTOS)
const CANDIDATAS_Y = new Float64Array(MAXIMO_DE_PONTOS)
const CANDIDATAS_ID = new Int32Array(MAXIMO_DE_PONTOS)
const CANDIDATAS_RX = new Float64Array(MAXIMO_DE_PONTOS)
const CANDIDATAS_RY = new Float64Array(MAXIMO_DE_PONTOS)

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

/** Os pontos de cada célula, as divididas e as fundidas (aos pares: a vizinha que recebeu uma não se funde de novo). */
function sortearPedras(): Pedras {
  if (prontas !== null) return prontas
  const total = PEDRAS * PEDRAS
  const px = new Float64Array(total)
  const py = new Float64Array(total)
  const qx = new Float64Array(total)
  const qy = new Float64Array(total)
  const divide = new Uint8Array(total)
  const dono = new Int32Array(total)
  const refX = new Float64Array(total)
  const refY = new Float64Array(total)
  for (let iy = 0; iy < PEDRAS; iy += 1) {
    for (let ix = 0; ix < PEDRAS; ix += 1) {
      const c = iy * PEDRAS + ix
      px[c] = 0.5 + (hash(ix, iy, SEMENTE) - 0.5) * 2 * FOLGA
      py[c] = 0.5 + (hash(ix, iy, SEMENTE + 1) - 0.5) * 2 * FOLGA
      dono[c] = c * 2
      refX[c] = px[c]
      refY[c] = py[c]
      if (hash(ix, iy, SEMENTE + 40) >= DIVIDE) continue
      divide[c] = 1
      const rumo = hash(ix, iy, SEMENTE + 41) * Math.PI * 2
      const afasta = SEGUNDO.afasta[0] + (SEGUNDO.afasta[1] - SEGUNDO.afasta[0]) * hash(ix, iy, SEMENTE + 42)
      qx[c] = Math.min(1 - SEGUNDO.margem, Math.max(SEGUNDO.margem, px[c] + Math.cos(rumo) * afasta))
      qy[c] = Math.min(1 - SEGUNDO.margem, Math.max(SEGUNDO.margem, py[c] + Math.sin(rumo) * afasta))
    }
  }
  const recebeu = new Uint8Array(total)
  for (let iy = 0; iy < PEDRAS; iy += 1) {
    for (let ix = 0; ix < PEDRAS; ix += 1) {
      const c = iy * PEDRAS + ix
      if (divide[c] === 1 || recebeu[c] === 1 || hash(ix, iy, SEMENTE + 43) >= FUNDE) continue
      const [dx, dy] = VIZINHAS[Math.floor(hash(ix, iy, SEMENTE + 44) * VIZINHAS.length) % VIZINHAS.length]
      const vizinha = voltaInteira(iy + dy, PEDRAS) * PEDRAS + voltaInteira(ix + dx, PEDRAS)
      if (divide[vizinha] === 1 || recebeu[vizinha] === 1 || dono[vizinha] !== vizinha * 2) continue
      dono[c] = vizinha * 2
      recebeu[vizinha] = 1
      refX[c] = dx + px[vizinha]
      refY[c] = dy + py[vizinha]
    }
  }
  prontas = { px, py, qx, qy, divide, dono, refX, refY }
  return prontas
}

/** Guarda um ponto da vizinhança: o lugar, a pedra e a referência da pedra. Devolve quantos já há. */
function candidata(n: number, x: number, y: number, pedra: number, rx: number, ry: number): number {
  CANDIDATAS_X[n] = x
  CANDIDATAS_Y[n] = y
  CANDIDATAS_ID[n] = pedra
  CANDIDATAS_RX[n] = rx
  CANDIDATAS_RY[n] = ry
  return n + 1
}

/** O mínimo suave: arredonda o canto onde duas bordas se encontram (`k` = o raio). */
function minimoSuave(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - (h * h * k) / 4
}

/** A cor do lajeado poligonal no ponto (u, v) do ladrilho de 8 casas. */
export function texturaLajeadoPoligonal(u: number, v: number): number {
  const p = sortearPedras()
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * PEDRAS + fbm(uu, vv, 6, 3, SEMENTE + 2) * TORCAO.larga + fbm(uu, vv, 48, 1, SEMENTE + 3) * TORCAO.miuda
  const y = vv * PEDRAS + fbm(uu, vv, 6, 3, SEMENTE + 4) * TORCAO.larga + fbm(uu, vv, 48, 1, SEMENTE + 5) * TORCAO.miuda
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  // Os pontos da vizinhança (a grade dá a volta: a pedra do outro lado da emenda é a mesma) e o mais perto deles.
  let n = 0
  for (let oy = -MEIA_VIZINHANCA; oy <= MEIA_VIZINHANCA; oy += 1) {
    for (let ox = -MEIA_VIZINHANCA; ox <= MEIA_VIZINHANCA; ox += 1) {
      const gx = cx + ox
      const gy = cy + oy
      const c = voltaInteira(gy, PEDRAS) * PEDRAS + voltaInteira(gx, PEDRAS)
      n = candidata(n, gx + p.px[c], gy + p.py[c], p.dono[c], gx + p.refX[c], gy + p.refY[c])
      if (p.divide[c] === 1) n = candidata(n, gx + p.qx[c], gy + p.qy[c], c * 2 + 1, gx + p.qx[c], gy + p.qy[c])
    }
  }
  let melhor = Infinity
  let b = 0
  for (let k = 0; k < n; k += 1) {
    const d = (x - CANDIDATAS_X[k]) * (x - CANDIDATAS_X[k]) + (y - CANDIDATAS_Y[k]) * (y - CANDIDATAS_Y[k])
    if (d < melhor) {
      melhor = d
      b = k
    }
  }
  // A distância às bordas (as mediatrizes com os pontos de OUTRAS pedras; entre as duas metades de uma pedra fundida
  // não há borda), positiva dentro: as duas mais perto e o rumo da primeira.
  const pedra = CANDIDATAS_ID[b]
  const bx = CANDIDATAS_X[b]
  const by = CANDIDATAS_Y[b]
  let e1 = Infinity
  let e2 = Infinity
  let nx = 0
  let ny = 0
  for (let k = 0; k < n; k += 1) {
    if (CANDIDATAS_ID[k] === pedra) continue
    const ex = CANDIDATAS_X[k] - bx
    const ey = CANDIDATAS_Y[k] - by
    const tamanho = Math.sqrt(ex * ex + ey * ey)
    const m = (((bx + CANDIDATAS_X[k]) / 2 - x) * ex + ((by + CANDIDATAS_Y[k]) / 2 - y) * ey) / tamanho
    if (m < e1) {
      e2 = e1
      e1 = m
      nx = ex / tamanho
      ny = ey / tamanho
    } else if (m < e2) e2 = m
  }
  const dentro = minimoSuave(e1, e2, CANTO / CASAS_POR_CELULA) * CASAS_POR_CELULA
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(pedra, 0, SEMENTE)
  // Distância assinada à borda da pedra, em casas (negativa dentro).
  const borda = meiaJunta - dentro

  let c = TONS[Math.floor(hash(pedra, 2, SEMENTE) * TONS.length) % TONS.length]
  // As camadas da pedra, num rumo sorteado por pedra, tortas e fracas (medidas da referência da pedra: correm iguais
  // nas duas metades de uma pedra fundida).
  const rumo = hash(pedra, 3, SEMENTE) * Math.PI
  const aoLongo = ((x - CANDIDATAS_RX[b]) * Math.cos(rumo) + (y - CANDIDATAS_RY[b]) * Math.sin(rumo)) * CASAS_POR_CELULA
  const faixa = valor(aoLongo * CAMADAS.porCasa + fbm(uu, vv, 8, 2, SEMENTE + 6) * 0.6, pedra, SEM_PERIODO, SEMENTE + 7) - 0.5
  const grao = valor(uu * 256, vv * 256, 256, SEMENTE + 8)
  const poro = passoSuave(0.18, 0.05, grao)
  c = luz(c, faixa * CAMADAS.forca + fbm(uu, vv, 10, 2, SEMENTE + 9) * 0.035 + (hash(pedra, 4, SEMENTE) - 0.5) * 0.09 + (grao - 0.5) * 0.04 - poro * 0.06)
  c = luz(c, -passoSuave(POEIRA.largura, 0, -borda) * POEIRA.forca)
  // O ombro gasto pega a luz de cima à esquerda; a pedra inteira cedida um nada.
  const ombro = OMBRO.inclinacao * (1 - passoSuave(0, OMBRO.largura, -borda))
  const dhx = -nx * ombro + (hash(pedra, 5, SEMENTE) - 0.5) * 2 * TORTO
  const dhy = -ny * ombro + (hash(pedra, 6, SEMENTE) - 0.5) * 2 * TORTO
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)
  const naJunta = passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)
  if (naJunta <= 0) return empacotar(c)
  return empacotar(misturar(c, luz(COR_DA_JUNTA, (grao - 0.5) * 0.12), naJunta))
}
