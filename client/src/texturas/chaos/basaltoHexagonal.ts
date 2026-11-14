import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * BASALTO EM COLUNAS (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Pisos de
 * pedra): a costa vulcânica, vista de cima. Os topos das colunas de basalto, hexágonos irregulares de meia casa,
 * grafite azulado; cada coluna no seu tom e na sua altura: a borda de cima à esquerda de cada topo pega a luz, a
 * coluna mais alta joga sombra na vizinha mais baixa do lado de baixo à direita, e entre elas fica a fresta escura.
 * Um topo é um nada abaulado, outro um nada fundo, como a pedra gasta pelo mar.
 *
 * Os hexágonos são as células de Voronoi de uma grade em favo (fileiras alternadas meia coluna adiante) com cada
 * ponto um pouco fora do lugar: 16 colunas por 18 fileiras no ladrilho de 8 casas, o favo um nada esticado para
 * caber inteiro e dar a volta.
 */

const CASAS = 8
const COLUNAS = 16
const FILEIRAS = 18
/** O tamanho da célula da grade, em casas. */
const LARGURA_DA_CELULA = CASAS / COLUNAS
const ALTURA_DA_CELULA = CASAS / FILEIRAS
/** O quanto cada ponto foge do lugar no favo (fração da célula): o hexágono fica irregular. */
const FOLGA = 0.16
/** Meia fresta entre duas colunas, em casas, e a passagem macia dela. */
const MEIA_FRESTA = [0.012, 0.022] as const
const PASSAGEM = 0.009
/** O bisel do topo: largura em casas e a inclinação dele na borda. */
const BISEL = { largura: 0.05, inclinacao: 0.5 } as const
/** O topo abaulado (positivo) ou fundo (negativo): inclinação por casa a partir do meio. */
const CURVA = [-0.5, 0.8] as const
/** A sombra que a coluna mais alta joga: comprimento em casas por unidade de altura, e quanto escurece. */
const SOMBRA = { comprimento: 0.09, forca: 0.22 } as const
/** Quanto a coluna mais alta clareia (fica mais perto da luz). */
const ALTURA_CLAREIA = 0.06
const LUZ_DO_RELEVO = 0.26
/** A luz vem de cima à esquerda: o rumo para ela, no plano (normalizado). */
const RUMO_DA_LUZ = -Math.SQRT1_2

/** Grafite azulado: o azul passa o vermelho por uns 13 níveis, nada mais. */
const TONS: readonly Rgb[] = [rgb('#4a4f57'), rgb('#474c53'), rgb('#4e535a'), rgb('#444950'), rgb('#50555c'), rgb('#4b4f55')]
/** O sal do mar que a água deixa secar no topo fundo: cinza claro, apagado. */
const SAL = rgb('#6c7076')
/**
 * No topo fundo, a poça de sal: raio em casas a partir do meio, a passagem macia, a força e o quanto o topo tem de
 * ser fundo (fração da curva mais funda) para guardar a poça.
 */
const POCA_DE_SAL = { raio: 0.06, passagem: 0.08, forca: 0.2, fundoMinimo: 0.4 } as const
/** O fundo da fresta. */
const FRESTA = rgb('#2a2d32')

/** O favo sorteado uma vez: o ponto (em células, já com a célula) e a altura de cada coluna. */
let favo: { x: Float64Array; y: Float64Array; altura: Float64Array } | null = null

function grade(): { x: Float64Array; y: Float64Array; altura: Float64Array } {
  if (favo !== null) return favo
  const x = new Float64Array(COLUNAS * FILEIRAS)
  const y = new Float64Array(COLUNAS * FILEIRAS)
  const altura = new Float64Array(COLUNAS * FILEIRAS)
  for (let j = 0; j < FILEIRAS; j += 1) {
    for (let i = 0; i < COLUNAS; i += 1) {
      const k = j * COLUNAS + i
      x[k] = i + 0.5 + (j % 2 === 1 ? 0.5 : 0) + (hash(i, j, 2201) - 0.5) * 2 * FOLGA
      y[k] = j + 0.5 + (hash(i, j, 2202) - 0.5) * 2 * FOLGA
      altura[k] = hash(i, j, 2203)
    }
  }
  favo = { x, y, altura }
  return favo
}

/** Rascunho por ponto: as 9 colunas em volta, sem alocar a cada pixel. */
const VIZINHAS = 9
const vizinhaDx = new Float64Array(VIZINHAS)
const vizinhaDy = new Float64Array(VIZINHAS)
const vizinhaD2 = new Float64Array(VIZINHAS)
const vizinhaIndice = new Int32Array(VIZINHAS)

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/**
 * A cor do basalto no ponto (u, v) do ladrilho.
 * O favo dá a volta (16 e 18 são pares): a coluna do lado de lá da emenda aparece inteira do lado de cá.
 */
export function texturaBasaltoHexagonal(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const { x: gx, y: gy, altura } = grade()
  // A emenda do ladrilho passa longe das frestas: um quarto de coluna e meia fileira adiante.
  const x = uu * COLUNAS + 0.25
  const y = vv * FILEIRAS + 0.5
  const j0 = Math.floor(y)
  // As 9 candidatas (3 fileiras x 3 colunas) e a dona: a mais perto, medida em casas.
  let n = 0
  let dona = 0
  for (let oj = -1; oj <= 1; oj += 1) {
    const jj = j0 + oj
    const j = ((jj % FILEIRAS) + FILEIRAS) % FILEIRAS
    const desvio = j % 2 === 1 ? 0.5 : 0
    const i0 = Math.floor(x - desvio)
    for (let oi = -1; oi <= 1; oi += 1) {
      const ii = i0 + oi
      const i = ((ii % COLUNAS) + COLUNAS) % COLUNAS
      const k = j * COLUNAS + i
      const dx = (x - (gx[k] + (ii - i))) * LARGURA_DA_CELULA
      const dy = (y - (gy[k] + (jj - j))) * ALTURA_DA_CELULA
      vizinhaDx[n] = dx
      vizinhaDy[n] = dy
      vizinhaD2[n] = dx * dx + dy * dy
      vizinhaIndice[n] = k
      if (vizinhaD2[n] < vizinhaD2[dona]) dona = n
      n += 1
    }
  }
  const coluna = vizinhaIndice[dona]
  const minhaAltura = altura[coluna]
  const pdx = vizinhaDx[dona]
  const pdy = vizinhaDy[dona]
  // A borda mais perto (e o rumo para dentro do topo) e a sombra das vizinhas mais altas do lado da luz.
  let borda = Infinity
  let dentroX = 0
  let dentroY = 0
  let sombra = 0
  for (let m = 0; m < n; m += 1) {
    if (m === dona) continue
    const qx = pdx - vizinhaDx[m]
    const qy = pdy - vizinhaDy[m]
    const entre = Math.sqrt(qx * qx + qy * qy)
    if (entre < 1e-9) continue
    const s = (vizinhaD2[m] - vizinhaD2[dona]) / (2 * entre)
    if (s < borda) {
      borda = s
      dentroX = -qx / entre
      dentroY = -qy / entre
    }
    // A vizinha fica do lado da luz quando o rumo daqui para ela aponta para cima à esquerda.
    const paraLuz = ((qx / entre) * RUMO_DA_LUZ + (qy / entre) * RUMO_DA_LUZ)
    const maisAlta = altura[vizinhaIndice[m]] - minhaAltura
    if (paraLuz > 0 && maisAlta > 0) sombra = Math.max(sombra, passoSuave(SOMBRA.comprimento * maisAlta * paraLuz, 0, s))
  }
  const meiaFresta = MEIA_FRESTA[0] + (MEIA_FRESTA[1] - MEIA_FRESTA[0]) * valor(uu * 48, vv * 48, 48, 2204)
  const noTopo = borda - meiaFresta

  // O topo: o tom da coluna, a altura, as manchas, o sal no topo fundo, o bisel, a curva e a sombra da vizinha.
  let c = TONS[Math.floor(hash(coluna, 0, 2205) * TONS.length) % TONS.length]
  const curva = CURVA[0] + (CURVA[1] - CURVA[0]) * hash(coluna, 1, 2205)
  // Só o topo bem fundo guarda água (o raso seca antes de o sal juntar).
  const fundo = curva / CURVA[0]
  if (fundo > POCA_DE_SAL.fundoMinimo) {
    const meio = Math.sqrt(pdx * pdx + pdy * pdy)
    c = misturar(c, SAL, passoSuave(POCA_DE_SAL.raio + POCA_DE_SAL.passagem, POCA_DE_SAL.raio, meio) * POCA_DE_SAL.forca * fundo)
  }
  c = luz(c, minhaAltura * ALTURA_CLAREIA + fbm(uu, vv, 20, 2, 2207) * 0.035 + (valor(uu * 256, vv * 256, 256, 2208) - 0.5) * 0.035)
  const bisel = BISEL.inclinacao * (1 - passoSuave(0, BISEL.largura, noTopo))
  const dhx = dentroX * bisel - curva * pdx
  const dhy = dentroY * bisel - curva * pdy
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO - sombra * SOMBRA.forca)
  return empacotar(misturar(c, FRESTA, passoSuave(PASSAGEM, -PASSAGEM, noTopo)))
}
