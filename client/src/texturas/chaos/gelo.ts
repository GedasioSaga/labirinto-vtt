import { empacotar, fbm, hash, luz, misturar, mod, passoSuave, rgb, valor } from '../ruido'

/**
 * GELO (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; cartão Neve): o lago
 * congelado visto de cima. O gelo vai do claro e fosco (a geada) ao escuro e limpo, onde se vê a água funda por baixo,
 * em manchas largas; por cima corre a rede de RACHADURAS: as grandes, poucas e compridas, e as finas só em alguns
 * trechos, cada uma uma linha clara (o plano partido pega a luz) com o fio escuro do lado de baixo à direita. No gelo
 * limpo há bolhas de ar presas, em punhados miúdos; por cima de tudo, a neve que o vento varreu fica em manchas
 * soltas de beira mole (cobre as rachaduras). Cores contidas: o azul é acinzentado (gelo de inverno, não piscina),
 * nada de branco puro nem brilho estourado.
 *
 * As medidas, em casas: o ladrilho tem 8; as placas das rachaduras grandes têm 1,6 casa e as finas 0,6; a rachadura
 * grande tem uns 0,035 de largura; a bolha, de 0,02 a 0,04. As placas e as bolhas são células de uma grade que dá a
 * volta no ladrilho, com o ponto de cada célula TABELADO uma vez (o sorteio não se repete a cada pixel); o lado da
 * sombra da rachadura sai dos dois pontos mais perto (a rachadura fica para o lado do segundo), sem medir de novo.
 */

const CASAS = 8

const GELO = rgb('#a9bdcd')
/** O gelo limpo e escuro, com a água funda por baixo. */
const FUNDO = rgb('#7e97ab')
/** A geada: o gelo fosco, claro. */
const GEADA = rgb('#c5d3df')
const NEVE = rgb('#dbe5ee')
const RACHA = rgb('#dfe9f1')
const RACHA_SOMBRA = rgb('#6a8296')
const BOLHA = rgb('#d2dee8')

/** Uma grade que dá a volta no ladrilho: células por lado e, por célula, o ponto sorteado (x, y em células). */
interface Grade {
  readonly n: number
  readonly pontos: Float64Array
  /** Por célula, um sorteio de 0 a 1 e outro (o punhado e o raio da bolha). */
  readonly sorteios: Float64Array
}

function novaGrade(n: number, semente: number, folga: number): Grade {
  const pontos = new Float64Array(n * n * 2)
  const sorteios = new Float64Array(n * n * 2)
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const k = (j * n + i) * 2
      pontos[k] = i + 0.5 + (hash(i, j, semente) - 0.5) * 2 * folga
      pontos[k + 1] = j + 0.5 + (hash(i, j, semente + 7) - 0.5) * 2 * folga
      sorteios[k] = hash(i, j, semente + 13)
      sorteios[k + 1] = hash(i, j, semente + 19)
    }
  }
  return { n, pontos, sorteios }
}

/** As grades, feitas na primeira vez que o gelo é pintado. */
let grades: { grandes: Grade; finas: Grade; bolhas: Grade } | null = null

function gradesDoGelo(): { grandes: Grade; finas: Grade; bolhas: Grade } {
  if (grades === null) grades = { grandes: novaGrade(5, 2209, 0.45), finas: novaGrade(13, 2210, 0.45), bolhas: novaGrade(44, 2205, 0.38) }
  return grades
}

/** A meia largura da rachadura (fração da célula) das grandes e das finas. */
const MEIA = { grandes: 0.011, finas: 0.012 } as const
const BOLHA_RAIO = [0.02, 0.04] as const

/**
 * A rachadura da grade no ponto: `linha` (1 em cima dela) e `sombra` (o fio escuro do lado de baixo à direita: a
 * rachadura fica para o lado do segundo ponto mais perto; se esse lado é o de cima à esquerda, o ponto está na sombra).
 */
function rachadura(u: number, v: number, g: Grade, meia: number): { linha: number; sombra: number } {
  const x = u * g.n
  const y = v * g.n
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  let d1 = Infinity
  let d2 = Infinity
  let ax = 0
  let ay = 0
  let bx = 0
  let by = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const gx = cx + ox
      const gy = cy + oy
      const ix = mod(gx, g.n)
      const iy = mod(gy, g.n)
      const k = (iy * g.n + ix) * 2
      const sx = gx - ix + g.pontos[k]
      const sy = gy - iy + g.pontos[k + 1]
      const d = Math.hypot(x - sx, y - sy)
      if (d < d1) {
        d2 = d1
        bx = ax
        by = ay
        d1 = d
        ax = sx
        ay = sy
      } else if (d < d2) {
        d2 = d
        bx = sx
        by = sy
      }
    }
  }
  const borda = (d2 - d1) / 2
  const linha = 1 - passoSuave(meia * 0.4, meia * 1.6, borda)
  const nx = bx - ax
  const ny = by - ay
  const paraALuz = Math.max(0, -(nx + ny) / ((Math.hypot(nx, ny) || 1) * Math.SQRT2))
  return { linha, sombra: (1 - passoSuave(meia * 1.2, meia * 3.4, borda)) * paraALuz * (1 - linha) }
}

/** As bolhas de ar no gelo limpo: o quanto o ponto está dentro de uma (0 a 1), só nas células que o punhado sorteou. */
function bolha(u: number, v: number, punhado: number): number {
  const g = gradesDoGelo().bolhas
  const x = u * g.n
  const y = v * g.n
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  let dentro = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const gx = cx + ox
      const gy = cy + oy
      const ix = mod(gx, g.n)
      const iy = mod(gy, g.n)
      const k = (iy * g.n + ix) * 2
      if (g.sorteios[k] > punhado) continue
      const r = ((BOLHA_RAIO[0] + (BOLHA_RAIO[1] - BOLHA_RAIO[0]) * g.sorteios[k + 1]) * g.n) / CASAS
      const d = Math.hypot(x - (gx - ix + g.pontos[k]), y - (gy - iy + g.pontos[k + 1]))
      dentro = Math.max(dentro, 1 - passoSuave(r * 0.7, r, d))
    }
  }
  return dentro
}

/**
 * Os campos largos do gelo (os ruídos de poucas oitavas), TABELADOS uma vez numa grade de 256 x 256 que dá a volta e
 * lidos com interpolação: o ladrilho não refaz as oitavas a cada pixel. Na ordem: o limpo, a geada, o brilho do céu,
 * o punhado das bolhas, os trechos de rachadura fina, a neve varrida, a torção das rachaduras (x e y) e os trechos
 * onde a rachadura grande aparece.
 */
const LADO_DOS_CAMPOS = 256
const CAMPOS: readonly (readonly [number, number, number])[] = [
  [2, 3, 2201],
  [4, 3, 2202],
  [1, 2, 2203],
  [6, 2, 2204],
  [3, 2, 2208],
  [3, 4, 2211],
  [5, 2, 2214],
  [5, 2, 2215],
  [3, 2, 2216],
]
/** A torção das rachaduras (fração do ladrilho): a beira das placas sai torta, não de régua. */
const TORCAO = 0.012

let tabelaDosCampos: Float32Array | null = null
const amostra = new Float64Array(CAMPOS.length)

function camposEm(uu: number, vv: number): Float64Array {
  const n = CAMPOS.length
  if (tabelaDosCampos === null) {
    const t = new Float32Array(LADO_DOS_CAMPOS * LADO_DOS_CAMPOS * n)
    for (let j = 0; j < LADO_DOS_CAMPOS; j += 1) {
      for (let i = 0; i < LADO_DOS_CAMPOS; i += 1) {
        const k = (j * LADO_DOS_CAMPOS + i) * n
        CAMPOS.forEach(([base, oitavas, semente], q) => {
          t[k + q] = fbm(i / LADO_DOS_CAMPOS, j / LADO_DOS_CAMPOS, base, oitavas, semente)
        })
      }
    }
    tabelaDosCampos = t
  }
  const t = tabelaDosCampos
  const x = uu * LADO_DOS_CAMPOS
  const y = vv * LADO_DOS_CAMPOS
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i0 = mod(x0, LADO_DOS_CAMPOS)
  const i1 = mod(x0 + 1, LADO_DOS_CAMPOS)
  const j0 = mod(y0, LADO_DOS_CAMPOS)
  const j1 = mod(y0 + 1, LADO_DOS_CAMPOS)
  const a = (j0 * LADO_DOS_CAMPOS + i0) * n
  const b = (j0 * LADO_DOS_CAMPOS + i1) * n
  const c = (j1 * LADO_DOS_CAMPOS + i0) * n
  const d = (j1 * LADO_DOS_CAMPOS + i1) * n
  for (let q = 0; q < n; q += 1) amostra[q] = (t[a + q] * (1 - fx) + t[b + q] * fx) * (1 - fy) + (t[c + q] * (1 - fx) + t[d + q] * fx) * fy
  return amostra
}

/** A cor do gelo no ponto (u, v) do ladrilho. */
export function texturaGelo(u: number, v: number): number {
  const uu = u - Math.floor(u)
  const vv = v - Math.floor(v)
  const { grandes, finas } = gradesDoGelo()
  const [campoLimpo, campoGeada, campoBrilho, campoPunhado, campoFinas, campoNeve, torceX, torceY, campoGrandes] = camposEm(uu, vv)
  // O claro e o escuro do gelo, em manchas largas; a geada por cima, mais miúda.
  const limpo = passoSuave(0.38, 0.72, campoLimpo * 0.5 + 0.5)
  let c = misturar(GELO, FUNDO, limpo * 0.75)
  const geada = passoSuave(0.52, 0.8, campoGeada * 0.5 + 0.5) * (1 - limpo * 0.6)
  c = misturar(c, GEADA, geada * 0.65)
  // O brilho largo do céu no gelo, bem fraco.
  c = luz(c, campoBrilho * 0.05)
  // As bolhas presas no gelo limpo.
  if (limpo > 0.3) {
    const b = bolha(uu, vv, 0.16 * passoSuave(0.3, 0.8, limpo) * passoSuave(0.45, 0.7, campoPunhado * 0.5 + 0.5))
    if (b > 0) c = misturar(c, BOLHA, b * 0.55)
  }
  // As rachaduras, nas placas tortas: as grandes só em alguns trechos (a rede fica aberta, não um vitral), as finas
  // em outros, mais fracas.
  const ru = uu + torceX * TORCAO
  const rv = vv + torceY * TORCAO
  let linha = 0
  let sombra = 0
  const trechoDeGrandes = passoSuave(0.36, 0.56, campoGrandes * 0.5 + 0.5)
  if (trechoDeGrandes > 0) {
    const grande = rachadura(ru, rv, grandes, MEIA.grandes)
    linha = grande.linha * trechoDeGrandes * 0.85
    sombra = grande.sombra * trechoDeGrandes
  }
  const trechoDeFinas = passoSuave(0.5, 0.68, campoFinas * 0.5 + 0.5)
  if (trechoDeFinas > 0) {
    const fina = rachadura(ru, rv, finas, MEIA.finas)
    linha = Math.max(linha, fina.linha * trechoDeFinas * 0.6)
    sombra = Math.max(sombra, fina.sombra * trechoDeFinas * 0.6)
  }
  c = misturar(c, RACHA_SOMBRA, sombra * 0.5)
  c = misturar(c, RACHA, linha * 0.7)
  // A neve varrida: manchas soltas de beira mole por cima de tudo.
  const neve = passoSuave(0.66, 0.8, campoNeve * 0.5 + 0.5 + (valor(uu * 64, vv * 64, 64, 2212) - 0.5) * 0.06)
  c = misturar(c, NEVE, neve * 0.92)
  return empacotar(luz(c, (valor(uu * 256, vv * 256, 256, 2213) - 0.5) * 0.025))
}
