/**
 * MONTANHA de cima com volume (16/11/2026, leva E2 item 11 do mestre), em três tamanhos: a pequena (4 x 4 casas,
 * um pico), a média (6 x 6, um pico e um ombro) e a grande (10 x 8, um maciço de três picos e um contraforte).
 * Arte original no Meio-Termo: rocha de tom contido, sem listra berrante.
 *
 * Cada pico é uma ESTRELA DE CRISTAS: do cume descem cristas (as arestas que pegam o sol de um lado e ficam na
 * sombra do outro) e, entre elas, os vales. A curva de nível na altura t sai de `raio(θ) = base(θ) * (1 - t)^γ(θ)`:
 * na direção de uma crista γ é pequeno (a curva fica longe do cume, a crista é alta lá fora) e no meio do vale é
 * grande (a curva recua). É o que faz as curvas de nível virarem estrelas com pontas nas cristas, como numa carta
 * topográfica de verdade.
 *
 * O desenho tem duas partes que andam juntas:
 * - os ESTRATOS: o pico vira `n` faixas de nível (a de baixo maior, a do cume menor), cada uma uma peça com a
 *   forma polar dela (distância barata, sem polígono de centenas de lados); cada faixa é também um TAMPO solto na
 *   altura dela, e é isso que a 3/4 (`tresQuartos.ts`) sobe: a encosta vira degraus de rocha, um estrato por
 *   `ESPESSURA_DO_ESTRATO`, a mesma régua das fiadas da torre de pedra;
 * - o SOMBREADO por pixel (`texturaDaEncosta`): a normal sai da própria altura do pico (com um rugoso de rocha), e
 *   a luz de cima à esquerda NA TELA clareia a face virada para ela e escurece a outra. A faixa não aparece de cima:
 *   o sombreado é contínuo de uma faixa à outra, e o que se vê são as cristas, os vales e as linhas finas dos
 *   estratos acompanhando as curvas de nível.
 *
 * A NEVE (a variante 1, "Neve: Com" no painel, `lib/mobilia/montanha.ts`) também é por pixel: acima da linha de
 * neve a rocha vira neve, com a linha descendo nos vales (a neve se junta nas canaletas), subindo na face de sol e
 * com o rasgo do ruído. Na 3/4 a frente dos estratos inteiros acima da linha sai de neve.
 *
 * No pé: a beira escura da rocha, os tufos de mato baixo (o verde-oliva do musgo puxado para a pedra) e o cascalho
 * que desce na boca dos vales. A sombra no chão é a de cada estrato, deslocada pela altura dele.
 *
 * GIRO: a luz é fixa NA TELA. O sombreado lê `c.giro` e leva a luz para o referencial do desenho.
 * Material: `pedra`. A neve, o mato e a beira são fixos.
 *
 * PEGADA SÓLIDA (para a colisão, `lib/obstaculosDeObjeto.ts`): a elipse de `RAIO_SOLIDO_DA_MONTANHA` da caixa.
 */
import { hash, limitar01, misturar, passoSuave, rgb, type Rgb } from '../../ruido'
import { montanhaComNeve } from '../../../lib/mobilia/montanha'
import { tomDoMeio } from '../materiais'
import { comMeioEm, frenteNoDesenho } from './apoioDasConstrucoes'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'
import { elipseGirada, menos, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'

/** A altura de um estrato (px do protótipo): a beirada de cada tampo na 3/4. Um pouco mais que a fiada da torre: a encosta em degraus largos lê como rocha, e cada estrato a menos é uma frente a menos para pintar. */
export const ESPESSURA_DO_ESTRATO = 0.26 * G
/** O fio da frente de cada estrato na 3/4: leve, para a encosta não virar listras (o padrão das frentes é 0,2). */
export const CONTORNO_DO_ESTRATO = 0.06
/** A elipse que barra, em fração da caixa: o pé da encosta, sem o cascalho e o mato de fora. */
export const RAIO_SOLIDO_DA_MONTANHA = 0.86

/** Quantos ângulos guardam a curva de cada pico (a distância interpola entre eles). */
const ANGULOS = 360
const VOLTA = 2 * Math.PI
/** O γ no fundo do vale e o da crista mais forte e da mais fraca. */
const GAMA_DO_VALE = 1.5
const GAMA_DA_CRISTA_FORTE = 0.45
const GAMA_DA_CRISTA_FRACA = 0.72
/** Quanto a base estufa na direção de uma crista (o contraforte que chega ao chão). */
const ESTUFA_DA_CRISTA = 0.1
/** A caixa que a base não passa, em fração da meia pegada (sobra lugar para o cascalho e a beira). */
const BEIRA_DA_CAIXA = 0.95
/** Fora da curva a distância polar exagera perto das pontas: este fator a mantém por baixo da verdadeira. */
const FREIO_DA_DISTANCIA = 0.72

/** A luz NA TELA (de cima à esquerda) com 40 graus de altura: a mesma das rochas (`pedrasERochas.ts`). */
const LUZ_X = -0.79 * 0.77
const LUZ_Y = -0.61 * 0.77
const LUZ_Z = 0.64
/** Quanto a face virada para a luz clareia (e a outra escurece), em luz somada. */
const FORCA_DA_ENCOSTA = 0.8
const LUZ_MAIS_ESCURA = -0.42
const LUZ_MAIS_CLARA = 0.36

/** O rugoso da rocha: a altura do ruído em fração da altura do pico (no máximo `RUGOSO_MAXIMO` px). */
const RUGOSO = 0.05
const RUGOSO_MAXIMO = 5
/** As linhas dos estratos de cima: a força da luz que sobe e desce a cada estrato. */
const LUZ_DOS_ESTRATOS = 0.035
/** O vale fundo escurece (a canaleta de erosão). */
const ESCURO_DO_VALE = 0.09
/** O pé escurece um pouco (o chão encosta na rocha): até esta altura (px). */
const PE_ESCURO = 9
const LUZ_DO_PE = 0.1

/** A neve: no sol e na sombra (azulada, contida), a linha em fração do pico mais alto e o que a mexe. */
const NEVE_NO_SOL: Rgb = [0xe2, 0xe4, 0xe3]
const NEVE_NA_SOMBRA: Rgb = [0xa6, 0xb1, 0xbd]
const LINHA_DA_NEVE = 0.55
const NEVE_DESCE_NO_VALE = 0.12
const NEVE_SOBE_NO_SOL = 0.06
const RASGO_DA_NEVE = 0.07
/** A neve tem a textura da pedra quase toda apagada: sobra este tanto do grão. */
const GRAO_NA_NEVE = 0.25

/** O mato baixo do pé: até que altura (casas), quanto da cor ele toma e o limiar do ruído das manchas. */
const ALTURA_DO_MATO = 0.65
const COR_DO_MATO = 0.5
const LIMIAR_DO_MATO = -0.04
/** O verde-oliva do Meio-Termo puxado para a pedra, para não gritar em cima do cinza (o musgo das rochas). */
const TOM_DO_MATO: Rgb = rgb(tomDoMeio('musgo', 0.8))
const QUANTO_DE_PEDRA_NO_MATO = 0.25

/** A beira escura em volta do pé: quanto passa da curva (px) e o tom. */
const BEIRA = 0.8
const TOM_DA_BEIRA = 0.5
/** O escuro em que o pixel escuro demais é levantado (o piso de luz da pedra: cinza quente). */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** Um pico: o meio e os raios da base (frações da meia pegada), a altura (casas) e as cristas ([graus, força]). */
interface Pico {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly altura: number
  readonly cristas: readonly (readonly [number, number])[]
}

/** O relevo de um tamanho: a pegada de partida (casas) e os picos, do mais alto ao mais baixo. */
interface Relevo {
  readonly casasW: number
  readonly casasH: number
  readonly picos: readonly Pico[]
}

/**
 * Os três relevos. As cristas vão em graus NA TELA (0 = leste, 90 = sul), tortas de propósito: montanha não tem
 * simetria. A força (0 a 1) diz quanto a crista desce longe do cume.
 */
const RELEVOS: Readonly<Record<'pequena' | 'media' | 'grande', Relevo>> = {
  pequena: {
    casasW: 4,
    casasH: 4,
    picos: [
      { x: 0.03, y: 0.02, rx: 0.9, ry: 0.88, altura: 1.4, cristas: [[-105, 0.95], [-28, 0.6], [32, 0.85], [104, 0.7], [168, 0.9], [222, 0.55]] },
    ],
  },
  media: {
    casasW: 6,
    casasH: 6,
    picos: [
      { x: -0.08, y: -0.08, rx: 0.84, ry: 0.84, altura: 2.2, cristas: [[-112, 0.9], [-50, 0.7], [8, 0.95], [70, 0.6], [128, 0.85], [185, 0.75], [238, 0.5]] },
      { x: 0.46, y: 0.44, rx: 0.48, ry: 0.48, altura: 1.2, cristas: [[-40, 0.8], [40, 0.7], [118, 0.9], [205, 0.6]] },
    ],
  },
  grande: {
    casasW: 10,
    casasH: 8,
    picos: [
      { x: -0.2, y: -0.1, rx: 0.6, ry: 0.78, altura: 3.2, cristas: [[-118, 0.85], [-62, 0.7], [-8, 0.95], [52, 0.6], [102, 0.9], [160, 0.7], [212, 0.8]] },
      { x: 0.44, y: -0.14, rx: 0.48, ry: 0.68, altura: 2.4, cristas: [[-96, 0.9], [-30, 0.6], [24, 0.85], [88, 0.75], [150, 0.55], [200, 0.8]] },
      { x: 0.08, y: 0.5, rx: 0.42, ry: 0.42, altura: 1.4, cristas: [[-20, 0.7], [62, 0.85], [140, 0.6], [215, 0.8]] },
      { x: -0.66, y: 0.52, rx: 0.3, ry: 0.4, altura: 0.8, cristas: [[-60, 0.7], [40, 0.8], [150, 0.6], [240, 0.5]] },
    ],
  },
}

/** A torção do chão em volta do pico: a amplitude (fração do raio médio da base) e o tamanho da onda (idem). */
const TORCAO = 0.28
const ONDA_DA_TORCAO = 0.6
/** As cristas menores que saem das encostas dos vales: quanto mexem no γ e as duas frequências (voltas). */
const CRISTAS_MENORES = 0.26
const FREQUENCIAS_MENORES: readonly [number, number] = [11, 19]

/** O pico já medido em px: as tabelas da curva por ângulo, a torção e uma forma por estrato. */
interface PicoMontado {
  readonly cx: number
  readonly cy: number
  /** A altura (px), sempre um número inteiro de estratos. */
  readonly H: number
  readonly n: number
  /** Por ângulo: o raio da base, o γ e o quanto é vale (0 na crista, 1 no fundo). */
  readonly base: Float64Array
  readonly gama: Float64Array
  readonly vale: Float64Array
  /** A torção: amplitude (px), frequência (1/px) e semente. */
  readonly torcao: Torcao
  /** A altura já calculada numa grade (o sombreado e as formas leem dela). */
  readonly grade: Grade
  /** A curva de nível de cada estrato (k = 0 a base), em raios por ângulo (sem a torção), e a forma dela. */
  readonly raios: readonly Float64Array[]
  readonly camadas: readonly Forma[]
}

/**
 * A GRADE DA ALTURA de um pico: a altura (px), a inclinação e o "quanto é vale", de `PASSO_DA_GRADE` em
 * `PASSO_DA_GRADE` px, calculados uma vez por cena. A conta de verdade (a torção, o arco-tangente, a potência e o
 * rugoso) custava ~150 ns por ponto e era feita milhões de vezes (as formas dos estratos, as sombras, as frentes da
 * 3/4 e o sombreado); lida da grade, com interpolação, custa uma fração disso.
 */
interface Grade {
  readonly x0: number
  readonly y0: number
  readonly nx: number
  readonly ny: number
  readonly h: Float32Array
  readonly gx: Float32Array
  readonly gy: Float32Array
  readonly vale: Float32Array
  /** A inclinação de fora da grade (px por px): a da base, para a distância continuar crescendo lá fora. */
  readonly inclinacaoDeFora: number
  readonly H: number
}

/** O passo da grade (px do protótipo): no nível 3 é menos de 3 pixels da imagem, e a interpolação alisa. */
const PASSO_DA_GRADE = 1
/** A inclinação mínima que divide a distância (no cume chato a distância não explode). */
const INCLINACAO_MINIMA = 0.25

/** O que `lerGrade` devolve: altura, inclinação em x e em y, e o vale (sem alocar no laço do pintor). */
const LIDO = new Float64Array(4)

/** A grade no ponto, interpolada, em `LIDO`. Fora da grade, a altura continua descendo pela inclinação de fora. */
function lerGrade(g: Grade, x: number, y: number): void {
  const fx = (x - g.x0) / PASSO_DA_GRADE
  const fy = (y - g.y0) / PASSO_DA_GRADE
  if (fx < 0 || fy < 0 || fx >= g.nx - 1 || fy >= g.ny - 1) {
    const cx = fx < 0 ? 0 : fx > g.nx - 1 ? g.nx - 1 : fx
    const cy = fy < 0 ? 0 : fy > g.ny - 1 ? g.ny - 1 : fy
    const longe = Math.hypot(fx - cx, fy - cy) * PASSO_DA_GRADE
    const i = Math.floor(cy) * g.nx + Math.floor(cx)
    LIDO[0] = Math.min(g.h[i], 0) - longe * g.inclinacaoDeFora
    LIDO[1] = 0
    LIDO[2] = 0
    LIDO[3] = g.vale[i]
    return
  }
  const i0 = Math.floor(fx)
  const j0 = Math.floor(fy)
  const tx = fx - i0
  const ty = fy - j0
  const a = j0 * g.nx + i0
  const b = a + 1
  const c = a + g.nx
  const d = c + 1
  const w00 = (1 - tx) * (1 - ty)
  const w10 = tx * (1 - ty)
  const w01 = (1 - tx) * ty
  const w11 = tx * ty
  LIDO[0] = g.h[a] * w00 + g.h[b] * w10 + g.h[c] * w01 + g.h[d] * w11
  LIDO[1] = g.gx[a] * w00 + g.gx[b] * w10 + g.gx[c] * w01 + g.gx[d] * w11
  LIDO[2] = g.gy[a] * w00 + g.gy[b] * w10 + g.gy[c] * w01 + g.gy[d] * w11
  LIDO[3] = g.vale[a] * w00 + g.vale[b] * w10 + g.vale[c] * w01 + g.vale[d] * w11
}

/**
 * A CURVA DE NÍVEL como forma: a distância é a diferença de altura dividida pela inclinação (a conta de primeira
 * ordem, exata perto da curva, que é onde o pintor e a 3/4 olham), freada por fora. A caixa vem dos raios do pico.
 */
function curvaDeNivel(g: Grade, nivel: number, b: readonly [number, number, number, number]): Forma {
  return {
    b,
    d(x, y) {
      lerGrade(g, x, y)
      const inclinacao = Math.sqrt(LIDO[1] * LIDO[1] + LIDO[2] * LIDO[2])
      const d = (nivel - LIDO[0]) / (inclinacao > INCLINACAO_MINIMA ? inclinacao : INCLINACAO_MINIMA)
      return d > 0 ? d * FREIO_DA_DISTANCIA : d
    },
  }
}

interface Torcao {
  readonly a: number
  readonly k: number
  readonly s: number
}

/**
 * A TORÇÃO: o ponto empurrado por um ruído suave antes de ler a curva. As cristas deixam de ser retas saindo do
 * cume (o "papel amassado") e entortam como numa serra de verdade. A forma e o sombreado leem o mesmo empurrão.
 */
function torcidoX(t: Torcao, x: number, y: number): number {
  return x + t.a * ruido(x * t.k + t.s, y * t.k)
}

function torcidoY(t: Torcao, x: number, y: number): number {
  return y + t.a * ruido(x * t.k + t.s + 40, y * t.k + 40)
}

function anguloNaTabela(dx: number, dy: number): number {
  const a = Math.atan2(dy, dx)
  return ((a < 0 ? a + VOLTA : a) * ANGULOS) / VOLTA
}

/** O valor da tabela no ângulo (fração de índice `f`), interpolado. */
function naTabela(tabela: Float64Array, f: number): number {
  const i = Math.floor(f)
  const k = f - i
  const a = tabela[i % ANGULOS]
  return a + (tabela[(i + 1) % ANGULOS] - a) * k
}

/** A caixa da curva de raios `raios` em volta de (cx, cy), com a folga da torção. */
function caixaDosRaios(cx: number, cy: number, raios: Float64Array, folga: number): readonly [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i < ANGULOS; i += 1) {
    const a = (i * VOLTA) / ANGULOS
    const [x, y] = [cx + Math.cos(a) * raios[i], cy + Math.sin(a) * raios[i]]
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return [x0 - folga, y0 - folga, x1 + folga, y1 + folga]
}

/** O raio até a beira da caixa (px), saindo de (cx, cy) no ângulo `a`, descontada a torção. */
function raioAteACaixa(cx: number, cy: number, a: number, hw: number, hh: number, torcao: number): number {
  const [c, s] = [Math.cos(a), Math.sin(a)]
  const ate = (meio: number, centro: number, direcao: number): number => (Math.abs(direcao) < 1e-6 ? Infinity : ((direcao > 0 ? meio : -meio) - centro) / direcao)
  return Math.min(ate(hw * BEIRA_DA_CAIXA - torcao, cx, c), ate(hh * BEIRA_DA_CAIXA - torcao, cy, s))
}

/** O pico em px: as tabelas por ângulo e as curvas dos estratos. `escala` = a pegada sobre a de partida. */
function montarPico(p: Pico, hw: number, hh: number, escala: number, semente: number): PicoMontado {
  const [cx, cy] = [p.x * hw, p.y * hh]
  const [rx, ry] = [p.rx * hw, p.ry * hh]
  const raioMedio = Math.sqrt(rx * ry)
  const torcao: Torcao = { a: TORCAO * raioMedio, k: 1 / (ONDA_DA_TORCAO * raioMedio), s: semente * 13 }
  const n = Math.max(3, Math.round((p.altura * G * escala) / ESPESSURA_DO_ESTRATO))
  const cristas = [...p.cristas].map(([graus, forca]) => [((((graus % 360) + 360) % 360) * Math.PI) / 180, forca] as const).sort((a, b) => a[0] - b[0])
  const base = new Float64Array(ANGULOS)
  const gama = new Float64Array(ANGULOS)
  const vale = new Float64Array(ANGULOS)
  for (let i = 0; i < ANGULOS; i += 1) {
    const a = (i * VOLTA) / ANGULOS
    // As duas cristas em volta do ângulo, e onde ele fica entre elas (u de 0 a 1).
    let j = cristas.length - 1
    for (let q = 0; q < cristas.length; q += 1) if (cristas[q][0] <= a) j = q
    const [a0, f0] = cristas[j]
    const [a1Cru, f1] = cristas[(j + 1) % cristas.length]
    const a1 = a1Cru <= a0 ? a1Cru + VOLTA : a1Cru
    const aa = a < a0 ? a + VOLTA : a
    const u = (aa - a0) / (a1 - a0)
    // Expoente acima de 1: a crista fica arredondada no alto (com 0,9 ela vinha em quina, e o cume parecia um leque
    // de papel dobrado); a aresta viva sai do rugoso das cristas menores, que não é reto.
    const v = Math.sin(Math.PI * u) ** 1.5
    const forca = f0 + (f1 - f0) * u
    const gamaDaCrista = GAMA_DA_CRISTA_FRACA + (GAMA_DA_CRISTA_FORTE - GAMA_DA_CRISTA_FRACA) * forca
    // Nas encostas dos vales, as cristas menores: o γ desce e sobe um pouco (a curva ganha dentes pequenos).
    const menores = CRISTAS_MENORES * v * (0.6 * Math.sin(FREQUENCIAS_MENORES[0] * a + semente) + 0.4 * Math.sin(FREQUENCIAS_MENORES[1] * a + 2 * semente))
    vale[i] = v
    gama[i] = Math.max(0.35, gamaDaCrista + (GAMA_DO_VALE - gamaDaCrista) * v + menores)
    // A base: a elipse, ondulada (a montanha não tem pé redondo), estufada nas cristas e presa dentro da caixa.
    const elipse = (rx * ry) / Math.sqrt((ry * Math.cos(a)) ** 2 + (rx * Math.sin(a)) ** 2)
    const onda = 1 + 0.045 * Math.sin(3 * a + semente) + 0.03 * Math.sin(7 * a + 2 * semente)
    const estufa = 1 + ESTUFA_DA_CRISTA * (1 - v) * forca
    base[i] = Math.min(elipse * onda * estufa, raioAteACaixa(cx, cy, a, hw, hh, torcao.a / 2))
  }
  const raios: Float64Array[] = []
  for (let k = 0; k < n; k += 1) {
    const t = k / n
    const r = new Float64Array(ANGULOS)
    for (let i = 0; i < ANGULOS; i += 1) r[i] = base[i] * (1 - t) ** gama[i]
    raios.push(r)
  }
  const H = n * ESPESSURA_DO_ESTRATO
  const conta: ContaDoPico = { cx, cy, H, base, gama, vale, torcao, kDasArestas: 1 / (ONDA_DAS_ARESTAS * raioMedio), semente }
  const folga = torcao.a / 2 + 2
  const caixaDaBase = caixaDosRaios(cx, cy, raios[0], folga + 2)
  const grade = gradeDoPico(conta, caixaDaBase)
  // A caixa de cada estrato sai da grade (as arestas tiram a curva de nível de dentro da curva polar); o estrato que
  // ficou vazio (as arestas baixaram o cume) sai da conta.
  const camadas: Forma[] = []
  for (let k = 0; k < n; k += 1) {
    const caixa = caixaDoNivel(grade, k * ESPESSURA_DO_ESTRATO)
    if (caixa === null) break
    camadas.push(curvaDeNivel(grade, k * ESPESSURA_DO_ESTRATO, caixa))
  }
  return { cx, cy, H, n: camadas.length, base, gama, vale, torcao, grade, raios: raios.slice(0, camadas.length), camadas }
}

/** O que a conta de verdade da altura lê (antes da grade). */
interface ContaDoPico {
  readonly cx: number
  readonly cy: number
  readonly H: number
  readonly base: Float64Array
  readonly gama: Float64Array
  readonly vale: Float64Array
  readonly torcao: Torcao
  /** A frequência (1/px) das arestas da rocha e a semente delas. */
  readonly kDasArestas: number
  readonly semente: number
}

/** A caixa dos nós da grade com altura acima de `nivel` (com 2 px de folga); `null` = nenhum. */
function caixaDoNivel(g: Grade, nivel: number): readonly [number, number, number, number] | null {
  let [i0, j0, i1, j1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let j = 0; j < g.ny; j += 1) {
    for (let i = 0; i < g.nx; i += 1) {
      if (g.h[j * g.nx + i] < nivel) continue
      if (i < i0) i0 = i
      if (i > i1) i1 = i
      if (j < j0) j0 = j
      if (j > j1) j1 = j
    }
  }
  if (i1 < 0) return null
  const folga = 2 + PASSO_DA_GRADE
  return [g.x0 + i0 * PASSO_DA_GRADE - folga, g.y0 + j0 * PASSO_DA_GRADE - folga, g.x0 + i1 * PASSO_DA_GRADE + folga, g.y0 + j1 * PASSO_DA_GRADE + folga]
}

/** A grade da altura do pico na caixa `b`: a conta de verdade em cada nó e a inclinação por diferença central. */
function gradeDoPico(p: ContaDoPico, b: readonly [number, number, number, number]): Grade {
  const nx = Math.max(3, Math.ceil((b[2] - b[0]) / PASSO_DA_GRADE) + 1)
  const ny = Math.max(3, Math.ceil((b[3] - b[1]) / PASSO_DA_GRADE) + 1)
  const h = new Float32Array(nx * ny)
  const vale = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const x = b[0] + i * PASSO_DA_GRADE
      const y = b[1] + j * PASSO_DA_GRADE
      h[j * nx + i] = alturaDeVerdade(p, x, y)
      vale[j * nx + i] = naTabela(p.vale, anguloNaTabela(torcidoX(p.torcao, x, y) - p.cx, torcidoY(p.torcao, x, y) - p.cy))
    }
  }
  const gx = new Float32Array(nx * ny)
  const gy = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const [ia, ib] = [Math.max(0, i - 1), Math.min(nx - 1, i + 1)]
      const [ja, jb] = [Math.max(0, j - 1), Math.min(ny - 1, j + 1)]
      gx[j * nx + i] = (h[j * nx + ib] - h[j * nx + ia]) / ((ib - ia) * PASSO_DA_GRADE)
      gy[j * nx + i] = (h[jb * nx + i] - h[ja * nx + i]) / ((jb - ja) * PASSO_DA_GRADE)
    }
  }
  const raioMedio = Math.sqrt((b[2] - b[0]) * (b[3] - b[1])) / 2
  return { x0: b[0], y0: b[1], nx, ny, h, gx, gy, vale, inclinacaoDeFora: p.H / raioMedio, H: p.H }
}

/** A altura do pico no ponto (px; negativa fora do pé), com o rugoso da rocha: a conta que a grade guarda. */
function alturaDeVerdade(p: ContaDoPico, x: number, y: number): number {
  const dx = torcidoX(p.torcao, x, y) - p.cx
  const dy = torcidoY(p.torcao, x, y) - p.cy
  const f = anguloNaTabela(dx, dy)
  const R = naTabela(p.base, f)
  const g = naTabela(p.gama, f)
  const q = Math.sqrt(dx * dx + dy * dy) / (R > 1 ? R : 1)
  const t = q < 1 ? 1 - q ** (1 / g) : -(q - 1)
  if (t <= 0) return t * p.H
  // As ARESTAS: ruído "de crista" (1 - |ruído|, ao quadrado) em três oitavas, alto nas linhas onde o ruído troca de
  // sinal. Somado à cúpula, abre espigões que ramificam e entortam, e é ele que deixa a vista de cima com cara de
  // relevo de verdade. Cresce com a raiz da altura: some no pé (o contorno fica o da base) e manda no meio da encosta.
  let arestas = 0
  let amplitude = 1
  let soma = 0
  let k = p.kDasArestas
  for (let o = 0; o < OITAVAS_DAS_ARESTAS; o += 1) {
    const r = 1 - Math.abs(ruido(x * k + p.semente * 7 + o * 17, y * k + o * 29))
    arestas += amplitude * r * r
    soma += amplitude
    amplitude *= 0.5
    k *= 2.1
  }
  const detalhe = FORCA_DAS_ARESTAS * Math.sqrt(t) * (arestas / soma - MEIO_DAS_ARESTAS)
  return (t + detalhe) * p.H + Math.min(RUGOSO_MAXIMO, RUGOSO * p.H) * ruido(x * 0.16 + 31, y * 0.16)
}

/** As arestas: o tamanho da onda maior (fração do raio médio), quantas oitavas, a força e o valor médio (tirado). */
const ONDA_DAS_ARESTAS = 0.42
const OITAVAS_DAS_ARESTAS = 3
const FORCA_DAS_ARESTAS = 0.48
const MEIO_DAS_ARESTAS = 0.5

/** O que o sombreado de todos os picos divide: a luz no desenho, a neve, a cor da rocha e a do mato. */
interface Clima {
  readonly lx: number
  readonly ly: number
  readonly neve: boolean
  /** A altura da linha da neve (px) e a do pico mais alto (a régua do que mexe nela). */
  readonly zNeve: number
  readonly maisAlto: number
  readonly rocha: Rgb
  readonly mato: Rgb
  readonly alturaDoMato: number
  readonly daPedra: Textura | null
}

/** Inclinação (altura por px) a partir da qual a neve escorre e a rocha aparece: a face a prumo não segura neve. */
const NEVE_ESCORRE_DE = 1.1
const NEVE_ESCORRE_ATE = 2.2

/**
 * O SOMBREADO DA ENCOSTA, por pixel: a cor da rocha com o grão da pedra, a luz pela normal (a face de sol clara, a
 * de sombra escura), as linhas dos estratos, o vale fundo mais escuro, o pé encostado no chão, o mato baixo e, com
 * neve, a neve acima da linha. A cor sai daqui e não do material da peça (que só vale para a frente na 3/4).
 */
function texturaDaEncosta(p: PicoMontado, clima: Clima): Textura {
  return (u, v, x, y, peca, s, escala) => {
    s[0] = clima.rocha[0]
    s[1] = clima.rocha[1]
    s[2] = clima.rocha[2]
    if (clima.daPedra !== null) clima.daPedra(u, v, x, y, peca, s, escala)
    lerGrade(p.grade, x, y)
    const h = LIDO[0]
    const gx = LIDO[1]
    const gy = LIDO[2]
    const vale = LIDO[3]
    const lam = (-gx * clima.lx - gy * clima.ly + LUZ_Z) / Math.sqrt(gx * gx + gy * gy + 1)
    const sol = lam - LUZ_Z
    let luz = FORCA_DA_ENCOSTA * sol
    luz += LUZ_DOS_ESTRATOS * Math.sin((h / ESPESSURA_DO_ESTRATO) * VOLTA)
    const relativa = h / p.H
    luz -= ESCURO_DO_VALE * passoSuave(0.82, 1, vale) * passoSuave(0.05, 0.2, relativa) * (1 - passoSuave(0.75, 0.95, relativa))
    luz -= LUZ_DO_PE * (1 - passoSuave(0, PE_ESCURO, h))
    s[3] += luz < LUZ_MAIS_ESCURA ? LUZ_MAIS_ESCURA : luz > LUZ_MAIS_CLARA ? LUZ_MAIS_CLARA : luz
    // O mato baixo, em manchas, só no pé.
    if (h < clima.alturaDoMato) {
      const mancha = ruido(x * 0.055 + 5, y * 0.055) + ruido(x * 0.19, y * 0.19 + 9) * 0.45
      const mato = (1 - passoSuave(clima.alturaDoMato * 0.35, clima.alturaDoMato, h)) * passoSuave(LIMIAR_DO_MATO, LIMIAR_DO_MATO + 0.12, mancha)
      if (mato > 0) {
        const k = COR_DO_MATO * mato
        s[0] += (clima.mato[0] - s[0]) * k
        s[1] += (clima.mato[1] - s[1]) * k
        s[2] += (clima.mato[2] - s[2]) * k
      }
    }
    if (!clima.neve || h < clima.zNeve - clima.maisAlto * 0.3) return
    // A linha da neve: desce nos vales, sobe na face de sol, foge da face a prumo e se rasga no ruído (duas escalas).
    const rasgo = ruido(x * 0.06 + 3, y * 0.06 + 41) * 1.4 + ruido(x * 0.21 + 7, y * 0.21) * 0.6
    const prumo = passoSuave(NEVE_ESCORRE_DE, NEVE_ESCORRE_ATE, Math.sqrt(gx * gx + gy * gy))
    const excesso = h - clima.zNeve + clima.maisAlto * (NEVE_DESCE_NO_VALE * (vale - 0.4) - NEVE_SOBE_NO_SOL * sol * 3 + RASGO_DA_NEVE * rasgo - 0.2 * prumo)
    const neve = passoSuave(-1.4, 1.4, excesso)
    if (neve <= 0) return
    const sombra = limitar01(-sol * 2.4)
    // A cor da neve sem criar vetor (o laço do pintor passa aqui por pixel).
    s[0] += (NEVE_NO_SOL[0] + (NEVE_NA_SOMBRA[0] - NEVE_NO_SOL[0]) * sombra - s[0]) * neve
    s[1] += (NEVE_NO_SOL[1] + (NEVE_NA_SOMBRA[1] - NEVE_NO_SOL[1]) * sombra - s[1]) * neve
    s[2] += (NEVE_NO_SOL[2] + (NEVE_NA_SOMBRA[2] - NEVE_NO_SOL[2]) * sombra - s[2]) * neve
    // Na neve, o grão da pedra quase some; a luz da encosta fica (a sombra azulada já vem da cor).
    s[6] *= 1 - neve * (1 - GRAO_NA_NEVE)
    s[3] -= neve * 0.35 * luz
  }
}

/** A luz NA TELA levada ao referencial do desenho (a cena é pintada girada depois). */
function luzNoDesenho(giro: number): [number, number] {
  const [fx, fy] = frenteNoDesenho(giro)
  // O "para baixo" da tela é (fx, fy) no desenho e o "para a direita" é (fy, -fx) (o quarto de volta de `naTela`).
  return [LUZ_X * fy + LUZ_Y * fx, -LUZ_X * fx + LUZ_Y * fy]
}

/** O ponto no meio da faixa k do pico, no ângulo de índice i (antes da torção). */
function meioDaFaixa(p: PicoMontado, k: number, i: number): Ponto {
  const a = (i * VOLTA) / ANGULOS
  const fora = p.raios[k][i]
  const dentro = k + 1 < p.n ? p.raios[k + 1][i] : 0
  const r = (fora + dentro) / 2
  return [p.cx + Math.cos(a) * r, p.cy + Math.sin(a) * r]
}

/**
 * O MEIO que a 3/4 lê para pôr a faixa k no estrato dela: um ponto DENTRO da faixa (já com a torção), que nenhum
 * estrato mais alto de outro pico cobre, o mais perto possível do meio da caixa (a caixa recentrada nele cresce
 * menos, e o pintor anda menos). `null` = a faixa inteira fica por baixo de outro pico.
 */
function meioLivre(picos: readonly PicoMontado[], p: PicoMontado, k: number, forma: Forma): Ponto | null {
  const [mx, my] = [(forma.b[0] + forma.b[2]) / 2, (forma.b[1] + forma.b[3]) / 2]
  // Os candidatos: o meio da faixa em 60 ângulos (sem a torção) e uma grade na caixa (a torção tira a faixa do lugar).
  const candidatos: Ponto[] = []
  for (let i = 0; i < ANGULOS; i += 6) candidatos.push(meioDaFaixa(p, k, i))
  for (let gy = 0; gy <= LADO_DA_GRADE_DO_MEIO; gy += 1) {
    for (let gx = 0; gx <= LADO_DA_GRADE_DO_MEIO; gx += 1) {
      candidatos.push([forma.b[0] + ((forma.b[2] - forma.b[0]) * gx) / LADO_DA_GRADE_DO_MEIO, forma.b[1] + ((forma.b[3] - forma.b[1]) * gy) / LADO_DA_GRADE_DO_MEIO])
    }
  }
  let melhor: Ponto | null = null
  let menor = Infinity
  for (const ponto of candidatos) {
    const [x, y] = ponto
    if (forma.d(x, y) > -0.5) continue
    if (picos.some((q) => q !== p && k + 1 < q.n && q.camadas[k + 1].d(x, y) < 0)) continue
    const longe = Math.hypot(x - mx, y - my)
    if (longe < menor) {
      menor = longe
      melhor = ponto
    }
  }
  return melhor
}

/** A grade em que o meio da faixa é procurado (pontos por lado, menos um). */
const LADO_DA_GRADE_DO_MEIO = 40

/** Um tufo de mato: um punhado de bolinhas sorteadas na mancha (px), cada uma com o seu tom. */
function tufoDeMato(c: ContextoDoMovel, L: Peca[], mx: number, my: number, raio: number, cor: MaterialDaPeca, sem: number): void {
  const bolinhas = 4 + Math.round(hash(sem, 1, 2201) * 4)
  for (let i = 0; i < bolinhas; i += 1) {
    const t = hash(i, sem, 2202) * VOLTA
    const longe = hash(i, sem, 2203) * raio
    const r = 1.3 * (0.7 + 0.7 * hash(i, sem, 2204))
    const bolinha = elipseGirada(mx + Math.cos(t) * longe, my + Math.sin(t) * longe * 0.75, r, r * 0.86, t)
    L.push(c.peca(comMeioEm(bolinha, mx, my), cor, { bisel: r * 0.7, contorno: 0.26, tom: 0.8 + 0.3 * hash(i, sem, 2205), semente: 2300 + sem * 11 + i }))
  }
}

/** De quantos em quantos estratos um faz sombra no chão (os outros só dão a altura da 3/4). */
const ESTRATOS_POR_SOMBRA = 3

function montarRelevo(relevo: Relevo, c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh } = c
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const pedra = c.m.pedra
  cena.corDoPiso = ESCURO_DA_PEDRA
  const escala = Math.min(c.w / (relevo.casasW * G), c.h / (relevo.casasH * G))
  const picos = relevo.picos.map((p, i) => montarPico(p, hw, hh, escala, 1.7 + i * 2.3))
  const maisAlto = Math.max(...picos.map((p) => p.H))
  const neve = montanhaComNeve(c.variante)
  const zNeve = LINHA_DA_NEVE * maisAlto
  const [lx, ly] = luzNoDesenho(c.giro)
  const clima: Clima = {
    lx,
    ly,
    neve,
    zNeve,
    maisAlto,
    rocha: pedra.rgb,
    mato: misturar(TOM_DO_MATO, pedra.rgb, QUANTO_DE_PEDRA_NO_MATO),
    alturaDoMato: ALTURA_DO_MATO * G * escala,
    daPedra: texturaDaClasse('pedra'),
  }
  // A frente dos estratos nevados na 3/4 sai deste material; o `pedra` deixa o grão da pedra escolhida no sombreado.
  const NEVE: MaterialDaPeca = { classe: 'liso', rgb: NEVE_NO_SOL, ...(pedra.pedra !== undefined ? { pedra: pedra.pedra } : {}) }
  const mato: MaterialDaPeca = { classe: 'folha', rgb: misturar(TOM_DO_MATO, pedra.rgb, QUANTO_DE_PEDRA_NO_MATO * 0.6) }

  // ---------- no chão: o contato de cada pé e o cascalho na boca dos vales ----------
  for (const p of picos) S.push(contato(p.camadas[0], 0.3))
  picos.forEach((p, pi) => {
    for (let i = 0; i < ANGULOS; i += 9) {
      if (p.vale[i] < 0.9 || hash(i, pi, 2101) > 0.55) continue
      const a = (i * VOLTA) / ANGULOS
      for (let k = 0; k < 3; k += 1) {
        const longe = p.base[i] * (1 + 0.02 + 0.07 * hash(i, k, 2102)) + 2 + p.torcao.a * 0.3
        const desvio = (hash(i, k, 2103) - 0.5) * 0.12
        const [x, y] = [p.cx + Math.cos(a + desvio) * longe, p.cy + Math.sin(a + desvio) * longe]
        if (Math.abs(x) > hw * 0.985 || Math.abs(y) > hh * 0.985 || picos.some((q) => q.camadas[0].d(x, y) < 1)) continue
        const r = (2.2 + 2.6 * hash(i, k, 2104)) * Math.sqrt(escala)
        const seixo = elipseGirada(x, y, r, r * 0.72, hash(i, k, 2105) * VOLTA)
        S.push({ forma: seixo, z: r * 0.8, forca: 0.26 }, contato(seixo, 0.24))
        L.push(P(seixo, pedra, { tabua: 0, bisel: r * 0.75, contorno: 0.32, tom: 0.82 + 0.26 * hash(i, k, 2106), semente: 2110 + pi * 97 + i + k }))
      }
    }
  })

  // ---------- a beira escura de cada pé (por baixo de tudo: só o fio de fora aparece) ----------
  picos.forEach((p, pi) => {
    const pe = p.camadas[0]
    const beira: Forma = { b: [pe.b[0] - BEIRA, pe.b[1] - BEIRA, pe.b[2] + BEIRA, pe.b[3] + BEIRA], d: (x, y) => pe.d(x, y) - BEIRA }
    const meio = meioLivre(picos, p, 0, p.n > 1 ? menos(pe, p.camadas[1]) : pe)
    if (meio === null) return
    L.push(P(comMeioEm(beira, meio[0], meio[1]), pedra, { tabua: 0, bisel: 0.8, contorno: 0.3, tom: TOM_DA_BEIRA, semente: 2150 + pi }))
  })

  // ---------- os estratos, de baixo para cima (de todos os picos juntos): o tampo e a faixa de cada um ----------
  const nivelMaximo = Math.max(...picos.map((p) => p.n))
  for (let k = 0; k < nivelMaximo; k += 1) {
    const z = (k + 1) * ESPESSURA_DO_ESTRATO
    picos.forEach((p, pi) => {
      if (k >= p.n) return
      // O meio é procurado na FAIXA (entre esta curva e a de cima), mas a peça é a curva inteira: as faixas de cima
      // são pintadas antes e cobrem o miolo, então o pintor nem lê a distância lá dentro, e a conta por pixel cai à
      // metade (uma curva, não duas).
      const meio = meioLivre(picos, p, k, k + 1 < p.n ? menos(p.camadas[k], p.camadas[k + 1]) : p.camadas[k])
      if (meio === null) return
      const faixa = p.camadas[k]
      const daNeve = neve && z > zNeve + 0.08 * maisAlto
      const fazSombra = k % ESTRATOS_POR_SOMBRA === ESTRATOS_POR_SOMBRA - 1 || k === p.n - 1
      // A 3/4 pinta os estratos pela altura (`ordemPelaAltura` do perfil): a caixa fica a do estrato.
      S.push({ forma: p.camadas[k], z, solta: true, forca: fazSombra ? 0.28 : 0 })
      L.push(P(comMeioEm(faixa, meio[0], meio[1]), daNeve ? NEVE : pedra, { tabua: 0, bisel: 0, contorno: k === 0 ? 0.12 : 0.03, textura: texturaDaEncosta(p, clima), semente: 2200 + pi * 61 + k }))
    })
  }

  // ---------- os tufos de mato no pé (por cima da faixa de baixo) ----------
  picos.forEach((p, pi) => {
    const tufos = Math.round(p.n * 1.6)
    for (let j = 0; j < tufos; j += 1) {
      const i = Math.floor(hash(j, pi, 2210) * ANGULOS)
      const [x, y] = meioDaFaixa(p, 0, i)
      if (p.camadas[0].d(x, y) > -1 || (p.n > 1 && p.camadas[1].d(x, y) < 0)) continue
      if (picos.some((q) => q !== p && q.camadas[Math.min(1, q.n - 1)].d(x, y) < 0)) continue
      tufoDeMato(c, L, x, y, (2.4 + 2 * hash(j, pi, 2212)) * Math.sqrt(escala), mato, pi * 53 + j)
    }
  })
}

export const montarMontanhaPequena: MontarMovel = (c, cena) => montarRelevo(RELEVOS.pequena, c, cena)
export const montarMontanhaMedia: MontarMovel = (c, cena) => montarRelevo(RELEVOS.media, c, cena)
export const montarMontanhaGrande: MontarMovel = (c, cena) => montarRelevo(RELEVOS.grande, c, cena)
