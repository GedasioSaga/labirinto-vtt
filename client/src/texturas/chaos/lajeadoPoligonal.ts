import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * LAJEADO POLIGONAL (lista de 24/11/2026, item 114; mapa 8): pedras chatas e irregulares, de MUITOS LADOS, cinza-azul
 * escuro, assentadas lado a lado com juntas FINAS (o lajeado de ardósia, o "opus incertum"). Cada pedra é uma célula
 * de Voronoi de pontos espalhados numa grade que dá a volta no ladrilho (uma pedra e meia por casa), num lugar um
 * pouco torcido pelo ruído: a borda nunca sai reta de régua, e os cantos são arredondados (mínimo suave das duas
 * bordas mais perto). Cada pedra no seu tom, cedida um nada para um lado, com o ombro de cima à esquerda pegando a
 * luz e as camadas da pedra (a clivagem da ardósia) em faixas fracas, num rumo sorteado por pedra.
 *
 * Diferente das vizinhas: o Calçamento é de pedras redondas e graúdas, de junta larga; o Basalto em colunas é de
 * hexágonos certos; as Pedras com lama têm lama entre elas. Aqui a pedra é chata e angulosa e a junta é um fio.
 */

const CASAS = 8
/** Células por lado do ladrilho: uma pedra e meia por casa. */
const PEDRAS = 12
const CASAS_POR_CELULA = CASAS / PEDRAS
/** O quanto o ponto da pedra foge do meio da célula (0 a 0,5). */
const FOLGA = 0.42
const SEMENTE = 11400

/** Meia junta de cada pedra, em casas: a junta fina (somando as duas pedras, uns 5 cm). */
const MEIA_JUNTA = [0.013, 0.019] as const
/** O raio do canto arredondado (o mínimo suave das duas bordas), em casas. */
const CANTO = 0.05
/** A torção do lugar onde se procura a pedra, em células: a larga entorta a borda, a miúda a lasca. */
const TORCAO = { larga: 0.09, miuda: 0.015 } as const
/** O ombro gasto: da borda até `largura` casas para dentro a pedra desce; a inclinação na borda. */
const OMBRO = { largura: 0.06, inclinacao: 0.3 } as const
const TORTO = 0.045
const LUZ_DO_RELEVO = 0.24
/** A passagem macia da pedra para a junta, em casas a partir da borda. */
const PASSAGEM = { dentro: -0.008, fora: 0.006 } as const
/** A poeira na beira: até onde entra (casas) e quanto escurece. */
const POEIRA = { largura: 0.06, forca: 0.05 } as const
/** As camadas da pedra: faixas por casa e a força delas. */
const CAMADAS = { porCasa: 7, forca: 0.03 } as const
/** Ruído de valor sem período: para o que é medido dentro da pedra e não no ladrilho. */
const SEM_PERIODO = 1 << 20
/** O lado da vizinhança procurada: 5 x 5 células, para a borda certa mesmo com o ponto longe do meio. */
const VIZINHANCA = 5
const MEIA_VIZINHANCA = (VIZINHANCA - 1) / 2

/** Ardósia cinza-azul escura (croma ~0,07): nenhuma sai azul de verdade. */
const TONS: readonly Rgb[] = [rgb('#4f5761'), rgb('#535b64'), rgb('#4b535c'), rgb('#57606a'), rgb('#4e555d'), rgb('#525a61'), rgb('#485059')]
/** A junta: o mesmo azul-ardósia, fundo. */
const COR_DA_JUNTA = rgb('#2a2f35')

let pontos: Float64Array | null = null
/** As pedras da vizinhança do ponto em conta (só uma conta por vez: a função não é reentrante). */
const CANDIDATAS_X = new Float64Array(VIZINHANCA * VIZINHANCA)
const CANDIDATAS_Y = new Float64Array(VIZINHANCA * VIZINHANCA)
const CANDIDATAS_ID = new Int32Array(VIZINHANCA * VIZINHANCA)

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

/** O ponto de cada célula, dentro dela, sorteado uma vez. */
function pontosDasPedras(): Float64Array {
  if (pontos !== null) return pontos
  const p = new Float64Array(PEDRAS * PEDRAS * 2)
  for (let iy = 0; iy < PEDRAS; iy += 1) {
    for (let ix = 0; ix < PEDRAS; ix += 1) {
      p[(iy * PEDRAS + ix) * 2] = 0.5 + (hash(ix, iy, SEMENTE) - 0.5) * 2 * FOLGA
      p[(iy * PEDRAS + ix) * 2 + 1] = 0.5 + (hash(ix, iy, SEMENTE + 1) - 0.5) * 2 * FOLGA
    }
  }
  pontos = p
  return p
}

/** O mínimo suave: arredonda o canto onde duas bordas se encontram (`k` = o raio). */
function minimoSuave(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - (h * h * k) / 4
}

/** A cor do lajeado poligonal no ponto (u, v) do ladrilho de 8 casas. */
export function texturaLajeadoPoligonal(u: number, v: number): number {
  const p = pontosDasPedras()
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * PEDRAS + fbm(uu, vv, 6, 3, SEMENTE + 2) * TORCAO.larga + fbm(uu, vv, 48, 1, SEMENTE + 3) * TORCAO.miuda
  const y = vv * PEDRAS + fbm(uu, vv, 6, 3, SEMENTE + 4) * TORCAO.larga + fbm(uu, vv, 48, 1, SEMENTE + 5) * TORCAO.miuda
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  // A pedra mais perto, entre as da vizinhança (a grade dá a volta: a pedra do outro lado da emenda é a mesma).
  let melhor = Infinity
  let b = 0
  let n = 0
  for (let oy = -MEIA_VIZINHANCA; oy <= MEIA_VIZINHANCA; oy += 1) {
    for (let ox = -MEIA_VIZINHANCA; ox <= MEIA_VIZINHANCA; ox += 1) {
      const gx = cx + ox
      const gy = cy + oy
      const id = voltaInteira(gy, PEDRAS) * PEDRAS + voltaInteira(gx, PEDRAS)
      const qx = gx + p[id * 2]
      const qy = gy + p[id * 2 + 1]
      CANDIDATAS_X[n] = qx
      CANDIDATAS_Y[n] = qy
      CANDIDATAS_ID[n] = id
      const d = (x - qx) * (x - qx) + (y - qy) * (y - qy)
      if (d < melhor) {
        melhor = d
        b = n
      }
      n += 1
    }
  }
  // A distância às bordas (as mediatrizes com as vizinhas), positiva dentro: as duas mais perto e o rumo da primeira.
  const bx = CANDIDATAS_X[b]
  const by = CANDIDATAS_Y[b]
  let e1 = Infinity
  let e2 = Infinity
  let nx = 0
  let ny = 0
  for (let k = 0; k < n; k += 1) {
    if (k === b) continue
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
  const pedra = CANDIDATAS_ID[b]
  const dentro = minimoSuave(e1, e2, CANTO / CASAS_POR_CELULA) * CASAS_POR_CELULA
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(pedra, 0, SEMENTE)
  // Distância assinada à borda da pedra, em casas (negativa dentro).
  const borda = meiaJunta - dentro

  let c = TONS[Math.floor(hash(pedra, 2, SEMENTE) * TONS.length) % TONS.length]
  // As camadas da pedra, num rumo sorteado por pedra, tortas e fracas.
  const rumo = hash(pedra, 3, SEMENTE) * Math.PI
  const aoLongo = ((x - bx) * Math.cos(rumo) + (y - by) * Math.sin(rumo)) * CASAS_POR_CELULA
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
