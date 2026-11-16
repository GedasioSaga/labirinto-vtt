/**
 * MONTANHA de cima com volume (16/11/2026, leva E2 item 11 do mestre), em três tamanhos: a pequena (4 x 4 casas,
 * um pico), a média (6 x 6, um pico e um ombro) e a grande (10 x 8, um maciço de dois cumes, um contraforte e um
 * morro). Arte original no Meio-Termo: rocha de tom contido, sem listra berrante.
 *
 * REFEITA na mesma tarde (a primeira versão era rascunho): de cima as cristas saíam do cume como raios de leque, a
 * neve era uma estrela e a 3/4 subia em degraus (um estrato por fatia, 7,9 s para pintar a grande). Agora:
 *
 * - O RELEVO é um CAMPO DE ALTURA numa grade de 1 px, calculado uma vez por tamanho e giro (`terrenoDe`, guardado
 *   num cache pequeno: a vista de cima, a 3/4 e a neve leem o mesmo). Ele nasce de um ESQUELETO de cristas: de cada
 *   cume saem braços tortos e de comprimentos diferentes (o cume nunca fica no meio nem simétrico), cada braço solta
 *   ramos para os dois lados, alternados, e cada ramo solta raminhos. Cada pedaço de crista é uma aresta que desce
 *   para os lados (`INCLINACAO_DO_FLANCO`); o relevo é o mais alto deles. Entre dois ramos sobra um vale em V, e a
 *   rede de vales ramifica como a das cristas. Por cima, um ruído de cristas pequenas (a aresta de rocha que quebra
 *   a encosta) que cresce com a altura, e um pé que acaba antes da beira da caixa (`ENVELOPE`).
 * - DE CIMA é UMA peça: a forma é a curva de nível zero e a cor sai por pixel (`sombrear`): a normal do relevo contra
 *   a luz do mapa (de cima à esquerda), o vale mais escuro e a crista com um fio de luz (pela concavidade), o pé
 *   escuro encostado no chão, o mato em manchas no pé e, com neve, a neve.
 * - A NEVE segue o relevo: acima da linha ela cobre, desce em dedos pelas canaletas (o côncavo segura neve), some na
 *   face a prumo (a rocha aparece em faixas) e se rasga no ruído. Não é mais estrela.
 * - A 3/4 é desenhada AQUI (o perfil `propria`, `tresQuartos.ts`): o relevo projetado (a tela é y - z), coluna por
 *   coluna, da frente para trás (`projetar`). Cada pixel da tela sabe que ponto do relevo mostra; a cor é a mesma
 *   conta da vista de cima. Sem estratos: a massa é lisa, sem degraus. Onde uma crista da frente passa por cima do
 *   que fica atrás, um fio escuro separa as duas.
 *
 * No chão: a sombra do relevo inteiro para baixo à direita (a conta da luz de `SOMBRA_X`/`SOMBRA_Y`, uma varredura
 * na grade), o contato do pé, a beira escura em volta e o cascalho na boca dos vales.
 *
 * GIRO: o relevo é montado NA TELA (a luz fica no lugar) e devolvido ao referencial do objeto (`desgirarCena`): o
 * giro da imagem (`girarCena`) o traz de volta como foi montado. Material: `pedra`. A neve e o mato são fixos.
 *
 * PEGADA SÓLIDA (para a colisão, `lib/obstaculosDeObjeto.ts`): a elipse de `RAIO_SOLIDO_DA_MONTANHA` da caixa.
 */
import { hash, limitar01, misturar, passoSuave, rgb, type Rgb } from '../../ruido'
import { montanhaComNeve } from '../../../lib/mobilia/montanha'
import { tomDoMeio } from '../materiais'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'
import { elipseGirada, type Forma } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { desgirarCena, quartosDoGiro } from './pipaDeitada'

/** A elipse que barra, em fração da caixa: o pé da encosta, sem o cascalho e o mato de fora. */
export const RAIO_SOLIDO_DA_MONTANHA = 0.86

// ---------- o esqueleto de cada tamanho ----------

/** Um braço que sai do cume: o rumo (graus no desenho, 0 = leste, 90 = sul), o comprimento (fração do raio médio da caixa) e a altura no fim (fração da do cume; negativa = a crista some no chão antes da ponta, sem bolota). */
interface Braco {
  readonly rumo: number
  readonly comprimento: number
  readonly fim: number
}

/** Um cume: onde fica (fração da meia caixa), a altura (casas) e os braços. */
interface Cume {
  readonly x: number
  readonly y: number
  readonly altura: number
  readonly bracos: readonly Braco[]
}

interface Relevo {
  readonly nome: 'pequena' | 'media' | 'grande'
  readonly casasW: number
  readonly casasH: number
  readonly cumes: readonly Cume[]
  readonly semente: number
}

/**
 * Os três relevos. Os braços são tortos de propósito (nenhum par oposto, comprimentos diferentes): o cume fica
 * deslocado e a montanha não tem simetria. Na grande, o braço leste do cume maior e o oeste do segundo se encontram
 * no colo, que fica bem mais baixo que os dois.
 */
const RELEVOS: Readonly<Record<Relevo['nome'], Relevo>> = {
  pequena: {
    nome: 'pequena',
    casasW: 4,
    casasH: 4,
    semente: 11,
    cumes: [
      {
        x: 0.12,
        y: -0.1,
        altura: 1.4,
        bracos: [
          { rumo: -152, comprimento: 0.76, fim: 0.02 },
          { rumo: 18, comprimento: 0.61, fim: 0 },
          { rumo: 108, comprimento: 0.64, fim: -0.04 },
          { rumo: -64, comprimento: 0.39, fim: 0.04 },
        ],
      },
    ],
  },
  media: {
    nome: 'media',
    casasW: 6,
    casasH: 6,
    semente: 23,
    cumes: [
      {
        x: -0.14,
        y: -0.16,
        altura: 2.2,
        bracos: [
          { rumo: -160, comprimento: 0.64, fim: 0 },
          { rumo: -78, comprimento: 0.47, fim: 0.02 },
          { rumo: 44, comprimento: 0.67, fim: 0.42 },
          { rumo: 128, comprimento: 0.66, fim: -0.04 },
        ],
      },
      {
        x: 0.46,
        y: 0.42,
        altura: 1.25,
        bracos: [
          { rumo: -20, comprimento: 0.33, fim: 0 },
          { rumo: 82, comprimento: 0.31, fim: -0.02 },
          { rumo: 168, comprimento: 0.37, fim: 0.02 },
        ],
      },
    ],
  },
  grande: {
    nome: 'grande',
    casasW: 10,
    casasH: 8,
    semente: 37,
    cumes: [
      {
        x: -0.22,
        y: -0.12,
        altura: 3.2,
        bracos: [
          { rumo: -168, comprimento: 0.51, fim: 0 },
          { rumo: -96, comprimento: 0.39, fim: 0 },
          { rumo: -6, comprimento: 0.48, fim: 0.5 },
          { rumo: 74, comprimento: 0.56, fim: 0.06 },
          { rumo: 140, comprimento: 0.47, fim: -0.02 },
        ],
      },
      {
        x: 0.4,
        y: -0.18,
        altura: 2.45,
        bracos: [
          { rumo: -128, comprimento: 0.36, fim: 0 },
          { rumo: -40, comprimento: 0.39, fim: -0.02 },
          { rumo: 30, comprimento: 0.39, fim: -0.02 },
          { rumo: 104, comprimento: 0.48, fim: 0.02 },
          { rumo: 178, comprimento: 0.33, fim: 0.55 },
        ],
      },
      {
        x: 0.12,
        y: 0.5,
        altura: 1.3,
        bracos: [
          { rumo: -150, comprimento: 0.27, fim: 0.3 },
          { rumo: 12, comprimento: 0.31, fim: -0.02 },
          { rumo: 110, comprimento: 0.23, fim: 0 },
        ],
      },
      {
        x: -0.68,
        y: 0.52,
        altura: 0.8,
        bracos: [
          { rumo: -70, comprimento: 0.23, fim: 0.3 },
          { rumo: 60, comprimento: 0.2, fim: 0 },
          { rumo: 170, comprimento: 0.17, fim: 0 },
        ],
      },
    ],
  },
}

/** Um pedaço de crista, na TELA: de (ax, ay) na altura ha a (bx, by) na altura hb (px). */
interface Pedaco {
  readonly ax: number
  readonly ay: number
  readonly bx: number
  readonly by: number
  readonly ha: number
  readonly hb: number
}

/** A crista desce mais depressa perto da raiz e deita perto da ponta (o perfil côncavo de uma serra). */
const QUEDA_DO_GALHO = 1.35
/** Quanto o rumo de um galho vira a cada pedaço (radianos, para os dois lados). */
const SERPENTEIO = 0.35
/** Os ramos de um braço: um a cada esta fração do raio médio; a abertura deles (radianos) e a altura na ponta. */
const ESPACO_DOS_RAMOS = 0.16
const ABERTURA_MINIMA = 0.75
const ABERTURA_MAXIMA = 1.2
const FIM_DO_RAMO = 0

function alturaNoGalho(h0: number, h1: number, u: number): number {
  return h1 + (h0 - h1) * (1 - u) ** QUEDA_DO_GALHO
}

/** Leva o ponto do objeto para a tela (o giro de `girarCena`). */
function naTela(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** O ponto da tela de volta no objeto. */
function noObjeto(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

/**
 * Um GALHO do esqueleto (nível 0 o braço, 1 o ramo, 2 o raminho), em pedaços que serpenteiam, e os filhos dele. As
 * contas são no objeto; o pedaço entra na lista já na tela.
 */
function galho(lista: Pedaco[], x: number, y: number, rumo: number, comprimento: number, h0: number, h1: number, nivel: number, semente: number, raio: number, q: number): void {
  const pedacos = nivel === 0 ? 5 : nivel === 1 ? 3 : 2
  const passo = comprimento / pedacos
  const pontos: [number, number, number, number][] = [[x, y, h0, rumo]]
  let ang = rumo
  for (let k = 1; k <= pedacos; k += 1) {
    ang += SERPENTEIO * (hash(k, semente, 3101) - 0.5)
    const [px, py] = pontos[k - 1]
    pontos.push([px + Math.cos(ang) * passo, py + Math.sin(ang) * passo, alturaNoGalho(h0, h1, k / pedacos), ang])
    const [ax, ay] = naTela(px, py, q)
    const [bx, by] = naTela(pontos[k][0], pontos[k][1], q)
    lista.push({ ax, ay, bx, by, ha: pontos[k - 1][2], hb: pontos[k][2] })
  }
  if (nivel >= 2) return
  const filhos = nivel === 0 ? Math.max(2, Math.round(comprimento / (ESPACO_DOS_RAMOS * raio))) : comprimento > 0.28 * raio ? 2 : 1
  for (let f = 0; f < filhos; f += 1) {
    const u = Math.min(0.92, (f + 0.55 + 0.4 * (hash(f, semente, 3102) - 0.5)) / (filhos + 0.35))
    const k = Math.min(pedacos - 1, Math.floor(u * pedacos))
    const resto = u * pedacos - k
    const [ax, ay, , angulo] = pontos[k + 1]
    const [px, py] = pontos[k]
    const [rx, ry] = [px + (ax - px) * resto, py + (ay - py) * resto]
    const lado = (f + semente) % 2 === 0 ? 1 : -1
    const abertura = lado * (ABERTURA_MINIMA + (ABERTURA_MAXIMA - ABERTURA_MINIMA) * hash(f, semente, 3103))
    const tamanho = comprimento * (nivel === 0 ? 0.62 - 0.36 * u : 0.48) * (0.75 + 0.5 * hash(f, semente, 3104))
    const raiz = alturaNoGalho(h0, h1, u) * 0.97
    galho(lista, rx, ry, angulo + abertura, tamanho, raiz, raiz * FIM_DO_RAMO, nivel + 1, semente * 7 + f * 13 + 5, raio, q)
  }
}

// ---------- o campo de altura ----------

/** A encosta: a inclinação dela (1 = 45 graus; a crista desce bem mais devagar que a face) e o raio que arredonda o fio da crista (px). */
const INCLINACAO_DO_FLANCO = 1.5
const RAIO_DA_CRISTA = 2.5
/** A massa: o borrão do esqueleto (fração do raio médio) e quanto ela desce para o pé não passar do esqueleto. */
const BORRAO_DA_MASSA = 0.07
const FOLGA_DA_MASSA = 3
/** A serra que recorta a massa: quanto ela tira no fundo das grotas, a onda maior (fração do raio médio) e as oitavas. */
const FUNDO_DA_SERRA = 0.5
/** A serra sai quase toda abaixo de 0,6: esticada, as cristas dela chegam ao alto da massa. */
const ESTICA_A_SERRA = 2
const ONDA_DA_SERRA = 0.3
const OITAVAS_DA_SERRA = 3
/** A serra em volta: o raio (fração do raio médio) em que o ângulo vira arco, o quanto a distância encolhe (a crista fica comprida na descida), a faixa da costura (radianos) e a brandura da mistura entre cumes. */
const RAIO_DO_LEQUE = 0.55
const ESTICA_NA_DESCIDA = 0.45
const COSTURA = 1
/** Quanto (radianos) e com que onda (fração do raio médio) as grotas entortam. */
const CURVA_DAS_GROTAS = 0.25
const ONDA_DA_CURVA = 0.35
/** Até que distância do cume (fração do raio médio) a serra não corta. */
const PICO_LIMPO = 0.28
const MISTURA_DOS_CUMES = 0.08
/** O expoente do menor peso de cume que ainda conta (peso 0,02). */
const PESO_MINIMO_DO_CUME = Math.log(0.02)
/** O giro de uma oitava da serra para a outra (cerca de 37 graus). */
const GIRO_DA_OITAVA_COS = Math.cos(0.65)
const GIRO_DA_OITAVA_SEN = Math.sin(0.65)
/** O esqueleto que fica por cima da massa recortada: as arestas principais continuam nítidas (fração da altura dele). */
const ARESTA_PRINCIPAL = 0.78
/** A partir de que altura da massa (fração do cume) a aresta principal aparece inteira. */
const ARESTA_SO_NA_MASSA = 0.35
/** Abaixo disto (px) o campo não precisa de conta: é chão longe do pé. */
const FUNDO = -6
/** A grade grossa do esqueleto (px): a conta cara anda de 2 em 2 e a fina é interpolada (a crista já é arredondada). */
const PASSO_GROSSO = 2
/** O empurrão do ruído antes de ler o esqueleto: a amplitude e o tamanho da onda, em fração do raio médio. */
const TORCIDO = 0.06
const ONDA_DO_TORCIDO = 0.45
/** O pé: a elipse em fração da meia caixa onde a altura chega a zero, a inclinação do pé e a onda dele. */
const ENVELOPE = 0.96
const INCLINACAO_DO_PE = 1.4
const ONDA_DO_PE = 0.08
/** A emenda do pé com o esqueleto (px): sem ela a encosta quebra numa quina onde o pé corta a crista. */
const EMENDA_DO_PE = 12
/** As arestas de rocha: a força (fração da altura do cume mais alto), a onda maior (fração do raio médio) e as oitavas. */
const FORCA_DAS_ARESTAS = 0.06
const ONDA_DAS_ARESTAS = 0.12
const OITAVAS_DAS_ARESTAS = 3
/** As arestas miúdas, na grade fina: a quebra da rocha que a grade grossa não guarda. */
const FORCA_DAS_ARESTAS_MIUDAS = 0.022
const ONDA_DAS_ARESTAS_MIUDAS = 0.05
/** O raio do borrão que mede o côncavo (px) e a régua dele: o vale em V de inclinação 1 fica perto de 1. */
const RAIO_DO_CONCAVO = 4
const REGUA_DO_CONCAVO = 2.2
/** Abaixo disto a inclinação não divide a distância (o cume chato não faz a distância explodir). */
const INCLINACAO_MINIMA = 0.3

/** O relevo pronto, na TELA, numa grade de 1 px com o nó (0, 0) em (x0, y0). */
interface Terreno {
  readonly x0: number
  readonly y0: number
  readonly nx: number
  readonly ny: number
  /** A altura (px; negativa no chão em volta), a inclinação, o côncavo e a distância até o pé (negativa dentro). */
  readonly h: Float32Array
  readonly gx: Float32Array
  readonly gy: Float32Array
  readonly concavo: Float32Array
  readonly pe: Float32Array
  /** A distância até a borda da sombra no chão (negativa dentro). */
  readonly sombra: Float32Array
  /** O cume mais alto (px) e as caixas do pé e da sombra. */
  readonly maisAlto: number
  readonly caixaDoPe: readonly [number, number, number, number]
  readonly caixaDaSombra: readonly [number, number, number, number]
  /** Os cumes na tela (para achar o pé em volta deles). */
  readonly cumes: readonly (readonly [number, number])[]
  /** A 3/4, feita só quando pedida. */
  tres?: Projecao
}

/** O que `ler` devolve: altura, inclinação em x e em y, e o côncavo (sem alocar no laço do pintor). */
const LIDO = new Float64Array(4)

function lerTerreno(t: Terreno, x: number, y: number): void {
  let fx = x - t.x0
  let fy = y - t.y0
  fx = fx < 0 ? 0 : fx > t.nx - 1.001 ? t.nx - 1.001 : fx
  fy = fy < 0 ? 0 : fy > t.ny - 1.001 ? t.ny - 1.001 : fy
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const tx = fx - i
  const ty = fy - j
  const a = j * t.nx + i
  const b = a + 1
  const c = a + t.nx
  const d = c + 1
  const w00 = (1 - tx) * (1 - ty)
  const w10 = tx * (1 - ty)
  const w01 = (1 - tx) * ty
  const w11 = tx * ty
  LIDO[0] = t.h[a] * w00 + t.h[b] * w10 + t.h[c] * w01 + t.h[d] * w11
  LIDO[1] = t.gx[a] * w00 + t.gx[b] * w10 + t.gx[c] * w01 + t.gx[d] * w11
  LIDO[2] = t.gy[a] * w00 + t.gy[b] * w10 + t.gy[c] * w01 + t.gy[d] * w11
  LIDO[3] = t.concavo[a] * w00 + t.concavo[b] * w10 + t.concavo[c] * w01 + t.concavo[d] * w11
}

/** Um valor de uma grade de nx x ny com o nó (0, 0) em (x0, y0), interpolado; fora dela, `fora`. */
function naGrade(g: Float32Array, nx: number, ny: number, x0: number, y0: number, x: number, y: number, fora: number): number {
  const fx = x - x0
  const fy = y - y0
  if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return fora
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const tx = fx - i
  const ty = fy - j
  const a = j * nx + i
  return (g[a] * (1 - tx) + g[a + 1] * tx) * (1 - ty) + (g[a + nx] * (1 - tx) + g[a + nx + 1] * tx) * ty
}

/** O mínimo suave de a e b (o pé emendado na encosta sem quina). */
function minimoSuave(a: number, b: number, k: number): number {
  const t = limitar01(0.5 + (0.5 * (b - a)) / k)
  return b + (a - b) * t - k * t * (1 - t)
}

/** A distância do ponto ao pedaço e onde ele cai nele (0 a 1), em `PERTO`. */
const PERTO = new Float64Array(2)
function pertoDoPedaco(p: Pedaco, x: number, y: number): void {
  const ex = p.bx - p.ax
  const ey = p.by - p.ay
  const l2 = ex * ex + ey * ey
  let t = l2 > 0 ? ((x - p.ax) * ex + (y - p.ay) * ey) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = x - p.ax - ex * t
  const dy = y - p.ay - ey * t
  PERTO[0] = Math.sqrt(dx * dx + dy * dy)
  PERTO[1] = t
}

/** A encosta de uma crista: quanto ela desceu a `d` px do fio (reta e íngreme; o fio é arredondado). */
function descida(d: number): number {
  return INCLINACAO_DO_FLANCO * (Math.sqrt(d * d + RAIO_DA_CRISTA * RAIO_DA_CRISTA) - RAIO_DA_CRISTA)
}

/** A grade grossa do esqueleto: cada pedaço pinta só onde a encosta dele ainda está acima do `FUNDO`. */
function esqueletoNaGrade(pedacos: readonly Pedaco[], x0: number, y0: number, nx: number, ny: number, torcidoX: Float32Array, torcidoY: Float32Array, folga: number): Float32Array {
  const h = new Float32Array(nx * ny).fill(FUNDO)
  for (const p of pedacos) {
    const alcance = (Math.max(p.ha, p.hb) - FUNDO) / INCLINACAO_DO_FLANCO + RAIO_DA_CRISTA + folga
    const i0 = Math.max(0, Math.floor((Math.min(p.ax, p.bx) - alcance - x0) / PASSO_GROSSO))
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(p.ax, p.bx) + alcance - x0) / PASSO_GROSSO))
    const j0 = Math.max(0, Math.floor((Math.min(p.ay, p.by) - alcance - y0) / PASSO_GROSSO))
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(p.ay, p.by) + alcance - y0) / PASSO_GROSSO))
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const o = j * nx + i
        pertoDoPedaco(p, torcidoX[o], torcidoY[o])
        const d = PERTO[0]
        const v = p.ha + (p.hb - p.ha) * PERTO[1] - descida(d)
        if (v > h[o]) h[o] = v
      }
    }
  }
  return h
}

/**
 * A MASSA (na grade grossa): o esqueleto borrado e devolvido à altura dele. Assimétrica e em lobos ao longo dos
 * braços, lisa; é ela que a serra (`serra`) recorta. Fora do pé fica negativa (o chão), para a distância do pé.
 */
function massaDoEsqueleto(esqueleto: Float32Array, nx: number, ny: number, raio: number): Float32Array {
  const positivo = new Float32Array(esqueleto.length)
  let maiorDoEsqueleto = 0
  for (let o = 0; o < esqueleto.length; o += 1) {
    positivo[o] = esqueleto[o] > 0 ? esqueleto[o] : 0
    if (esqueleto[o] > maiorDoEsqueleto) maiorDoEsqueleto = esqueleto[o]
  }
  const massa = borrar(positivo, nx, ny, raio)
  let maiorDaMassa = 0
  for (let o = 0; o < massa.length; o += 1) if (massa[o] > maiorDaMassa) maiorDaMassa = massa[o]
  const k = maiorDaMassa > 0 ? maiorDoEsqueleto / maiorDaMassa : 1
  for (let o = 0; o < massa.length; o += 1) massa[o] = Math.max(FUNDO, massa[o] * k - FOLGA_DA_MASSA)
  return massa
}

/**
 * A SERRA: ruído de cristas multifractal (cada oitava pesa pelo valor da anterior, então o detalhe fino nasce nas
 * cristas e o fundo das grotas fica liso), entre 0 e 1. Com o ponto torcido, as cristas ramificam e entortam como as
 * de uma serra vista do alto.
 */
function serra(x: number, y: number, k0: number, semente: number): number {
  let soma = 0
  let peso = 0
  let a = 1
  let k = k0
  let w = 1
  // Cada oitava girada: o ruído de valor tem grade, e as cristas dele saíam em caixas alinhadas aos eixos.
  let px = x
  let py = y
  for (let o = 0; o < OITAVAS_DA_SERRA; o += 1) {
    let r = 1 - Math.abs(2 * ruido(px * k + semente + o * 17, py * k + o * 29))
    const gx = px * GIRO_DA_OITAVA_COS - py * GIRO_DA_OITAVA_SEN
    py = px * GIRO_DA_OITAVA_SEN + py * GIRO_DA_OITAVA_COS
    px = gx
    r = r * r * w
    w = r * 1.7 > 1 ? 1 : r * 1.7
    soma += a * r
    peso += a
    a *= 0.55
    k *= 2.1
  }
  return soma / peso
}

/**
 * A serra EM VOLTA dos cumes: lida em ângulo e distância de cada cume (no objeto), esticada na direção que desce, então as
 * cristas e as grotas dela correm do alto para o pé e se abrem em leque, como as de uma serra vista de cima (lida no
 * plano, ela fazia anéis fechados). Perto de dois cumes, mistura as duas leituras pelo mais próximo.
 */
function serraEmVolta(x: number, y: number, centros: readonly { x: number; y: number; altura: number }[], raio: number, k: number, semente: number): number {
  const brandura = MISTURA_DOS_CUMES * raio
  const kCurva = 1 / (ONDA_DA_CURVA * raio)
  let melhor = -Infinity
  for (const c of centros) {
    const nota = c.altura * raio - Math.hypot(x - c.x, y - c.y)
    if (nota > melhor) melhor = nota
  }
  let soma = 0
  let pesos = 0
  for (let ci = 0; ci < centros.length; ci += 1) {
    const c = centros[ci]
    const dx = x - c.x
    const dy = y - c.y
    const d = Math.hypot(dx, dy)
    // Peso abaixo de 0,02: o cume está longe demais para mudar a serra aqui (e a exponencial nem é calculada).
    const expoente = (c.altura * raio - d - melhor) / brandura
    if (expoente < PESO_MINIMO_DO_CUME) continue
    const peso = Math.exp(expoente)
    const r = d * ESTICA_NA_DESCIDA
    // O ângulo entortado por um ruído do plano (sem costura): as grotas descem em curva, não em raio de estrela.
    const angulo = Math.atan2(dy, dx)
    const theta = angulo + CURVA_DAS_GROTAS * (2 * ruido(x * kCurva + semente, y * kCurva + ci * 7) - 1)
    // O arco cresce com a raiz da distância: as cristas se abrem e ramificam descendo, sem virar raios finos no cume.
    const arco = Math.sqrt((d + RAIO_DO_LEQUE * raio) * RAIO_DO_LEQUE * raio)
    let v = serra(theta * arco, r, k, semente + ci * 53)
    // A costura do ângulo (meia-volta, no ângulo cru): as duas leituras meio a meio na costura, então ela não risca.
    const perto = Math.abs(angulo) - (Math.PI - COSTURA)
    if (perto > 0) {
      const outro = serra((theta - Math.sign(angulo) * 2 * Math.PI) * arco, r, k, semente + ci * 53)
      v += (outro - v) * 0.5 * (perto / COSTURA)
    }
    // Junto do cume a serra some (o 0,5 esticado não corta): o pico sai limpo das arestas do esqueleto, sem estrela.
    v += (0.5 - v) * (1 - passoSuave(0, PICO_LIMPO * raio, d))
    soma += peso * v
    pesos += peso
  }
  return pesos > 0 ? soma / pesos : 0
}

/** As arestas de rocha: ruído "de crista" (1 - |ruído|, ao quadrado) em oitavas, com a média tirada. */
function arestas(x: number, y: number, k0: number, semente: number): number {
  let soma = 0
  let peso = 0
  let a = 1
  let k = k0
  for (let o = 0; o < OITAVAS_DAS_ARESTAS; o += 1) {
    const r = 1 - Math.abs(2 * ruido(x * k + semente + o * 17, y * k + o * 29))
    soma += a * r * r
    peso += a
    a *= 0.5
    k *= 2.07
  }
  return soma / peso - 0.42
}

/** Borra a grade com uma caixa de raio `r` nas duas direções (duas passadas, já quase um sino), por soma corrida. */
function borrar(g: Float32Array, nx: number, ny: number, r: number): Float32Array {
  const a = new Float32Array(g)
  const b = new Float32Array(g.length)
  const lado = 2 * r + 1
  for (let passada = 0; passada < 2; passada += 1) {
    for (let j = 0; j < ny; j += 1) {
      const base = j * nx
      let soma = a[base] * (r + 1)
      for (let k = 1; k <= r; k += 1) soma += a[base + Math.min(nx - 1, k)]
      for (let i = 0; i < nx; i += 1) {
        b[base + i] = soma / lado
        soma += a[base + Math.min(nx - 1, i + r + 1)] - a[base + Math.max(0, i - r)]
      }
    }
    for (let i = 0; i < nx; i += 1) {
      let soma = b[i] * (r + 1)
      for (let k = 1; k <= r; k += 1) soma += b[Math.min(ny - 1, k) * nx + i]
      for (let j = 0; j < ny; j += 1) {
        a[j * nx + i] = soma / lado
        soma += b[Math.min(ny - 1, j + r + 1) * nx + i] - b[Math.max(0, j - r) * nx + i]
      }
    }
  }
  return a
}

/** A caixa dos nós com valor abaixo de `limite` em `g` (a forma e as folgas): nunca vazia (cai na grade inteira). */
function caixaDe(g: Float32Array, nx: number, ny: number, x0: number, y0: number, limite: number, folga: number): [number, number, number, number] {
  let [i0, j0, i1, j1] = [nx, ny, -1, -1]
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if (g[j * nx + i] >= limite) continue
      if (i < i0) i0 = i
      if (i > i1) i1 = i
      if (j < j0) j0 = j
      if (j > j1) j1 = j
    }
  }
  if (i1 < 0) return [x0, y0, x0 + nx - 1, y0 + ny - 1]
  return [x0 + i0 - folga, y0 + j0 - folga, x0 + i1 + folga, y0 + j1 + folga]
}

/** A distância (negativa dentro) da curva de nível zero de `v`: o valor dividido pela inclinação dele. */
function distanciaDoNivel(v: Float32Array, nx: number, ny: number): Float32Array {
  const d = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const o = j * nx + i
      const ia = i > 0 ? i - 1 : 0
      const ib = i < nx - 1 ? i + 1 : nx - 1
      const ja = j > 0 ? j - 1 : 0
      const jb = j < ny - 1 ? j + 1 : ny - 1
      const gx = (v[j * nx + ib] - v[j * nx + ia]) / (ib - ia)
      const gy = (v[jb * nx + i] - v[ja * nx + i]) / (jb - ja)
      const g = Math.sqrt(gx * gx + gy * gy)
      d[o] = -v[o] / (g > INCLINACAO_MINIMA ? g : INCLINACAO_MINIMA)
    }
  }
  return d
}

/** A margem da grade além da caixa (px): o pé, a beira e a distância de fora precisam de chão em volta. */
const MARGEM = 6

/** O relevo de um tamanho na TELA, para a pegada (w x h px do objeto) e o giro (quartos de volta). */
function montarTerreno(relevo: Relevo, w: number, h: number, q: number): Terreno {
  const [hw, hh] = [w / 2, h / 2]
  const escala = Math.min(w / (relevo.casasW * G), h / (relevo.casasH * G))
  const raio = Math.sqrt(hw * hh)
  // O esqueleto, no objeto, entra na lista já na tela.
  const pedacos: Pedaco[] = []
  relevo.cumes.forEach((cume, ci) => {
    const [cx, cy] = [cume.x * hw, cume.y * hh]
    const H = cume.altura * G * escala
    cume.bracos.forEach((b, bi) => {
      galho(pedacos, cx, cy, (b.rumo * Math.PI) / 180, b.comprimento * raio, H, H * b.fim, 0, relevo.semente * 101 + ci * 31 + bi * 7, raio, q)
    })
  })
  const [tw, th] = q % 2 === 1 ? [hh, hw] : [hw, hh]
  const mx = Math.ceil(tw + MARGEM)
  const my = Math.ceil(th + MARGEM)
  const [nx, ny, x0, y0] = [2 * mx + 1, 2 * my + 1, -mx, -my]
  // A grade grossa: o ponto empurrado pelo ruído (lido no objeto e levado à tela) e o esqueleto.
  // Um nó a mais que a fina em cada direção: a fina nunca lê fora da grossa (fora, o chão saltava e a sombra riscava a beira).
  const gnx = mx + 2
  const gny = my + 2
  const torcidoX = new Float32Array(gnx * gny)
  const torcidoY = new Float32Array(gnx * gny)
  const amplitude = TORCIDO * raio
  // O giro em coeficientes (as voltas de 90 graus): nos laços quentes, sem um par novo por nó.
  const [oa, oc] = noObjeto(1, 0, q)
  const [ob, od] = noObjeto(0, 1, q)
  const [ta, tc] = naTela(1, 0, q)
  const [tb, td] = naTela(0, 1, q)
  const onda = 1 / (ONDA_DO_TORCIDO * raio)
  const s = relevo.semente
  for (let j = 0; j < gny; j += 1) {
    for (let i = 0; i < gnx; i += 1) {
      const xs = x0 + i * PASSO_GROSSO
      const ys = y0 + j * PASSO_GROSSO
      const xo = oa * xs + ob * ys
      const yo = oc * xs + od * ys
      const ux = amplitude * ruido(xo * onda + s, yo * onda)
      const uy = amplitude * ruido(xo * onda + s + 40, yo * onda + 40)
      torcidoX[j * gnx + i] = xs + ta * ux + tb * uy
      torcidoY[j * gnx + i] = ys + tc * ux + td * uy
    }
  }
  const esqueleto = esqueletoNaGrade(pedacos, x0, y0, gnx, gny, torcidoX, torcidoY, amplitude)
  const grossa = massaDoEsqueleto(esqueleto, gnx, gny, Math.max(1, Math.round((BORRAO_DA_MASSA * raio) / PASSO_GROSSO)))
  let maisAltoDoEsqueleto = 0
  for (let o = 0; o < esqueleto.length; o += 1) if (esqueleto[o] > maisAltoDoEsqueleto) maisAltoDoEsqueleto = esqueleto[o]
  // A massa recortada pela serra (lida no ponto torcido), as arestas principais por cima e o teto do pé (a elipse
  // ondulada, que só apara o que passaria da caixa).
  const kSerra = 1 / (ONDA_DA_SERRA * raio)
  const centros = relevo.cumes.map((c) => ({ x: c.x * hw, y: c.y * hh, altura: c.altura }))
  const kArestas = 1 / (ONDA_DAS_ARESTAS * raio)
  for (let j = 0; j < gny; j += 1) {
    for (let i = 0; i < gnx; i += 1) {
      const o = j * gnx + i
      const xo = oa * torcidoX[o] + ob * torcidoY[o]
      const yo = oc * torcidoX[o] + od * torcidoY[o]
      let z = grossa[o]
      const massa = z
      if (z > 0) z = (z + FOLGA_DA_MASSA) * (1 - FUNDO_DA_SERRA + FUNDO_DA_SERRA * Math.min(1, serraEmVolta(xo, yo, centros, raio, kSerra, s * 3) * ESTICA_A_SERRA)) - FOLGA_DA_MASSA
      // A aresta principal só onde a massa já está alta: fora dela o ramo do esqueleto virava espinho saindo do pé.
      if (esqueleto[o] > 0) z = Math.max(z, ARESTA_PRINCIPAL * esqueleto[o] * passoSuave(0.12 * maisAltoDoEsqueleto, ARESTA_SO_NA_MASSA * maisAltoDoEsqueleto, massa))
      if (z > 0) z += FORCA_DAS_ARESTAS * maisAltoDoEsqueleto * Math.sqrt(Math.min(1, z / maisAltoDoEsqueleto)) * arestas(xo, yo, kArestas, s * 5)
      const xr = oa * (x0 + i * PASSO_GROSSO) + ob * (y0 + j * PASSO_GROSSO)
      const yr = oc * (x0 + i * PASSO_GROSSO) + od * (y0 + j * PASSO_GROSSO)
      const rho = Math.sqrt((xr / (ENVELOPE * hw)) ** 2 + (yr / (ENVELOPE * hh)) ** 2) * (1 + ONDA_DO_PE * 2 * ruido(xr * 0.02 + s * 3, yr * 0.02))
      grossa[o] = minimoSuave(z, INCLINACAO_DO_PE * raio * (1 - rho), EMENDA_DO_PE)
    }
  }
  // A grade fina: a grossa interpolada e as arestas miúdas da rocha.
  const altura = new Float32Array(nx * ny)
  const kMiuda = 1 / (ONDA_DAS_ARESTAS_MIUDAS * raio)
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      let z = naGrade(grossa, gnx, gny, 0, 0, i / PASSO_GROSSO, j / PASSO_GROSSO, FUNDO)
      if (z > 0) {
        const xo = oa * (x0 + i) + ob * (y0 + j)
        const yo = oc * (x0 + i) + od * (y0 + j)
        z += FORCA_DAS_ARESTAS_MIUDAS * maisAltoDoEsqueleto * Math.sqrt(Math.min(1, z / maisAltoDoEsqueleto)) * arestas(xo, yo, kMiuda, s * 9)
      }
      altura[j * nx + i] = z
    }
  }
  const gx = new Float32Array(nx * ny)
  const gy = new Float32Array(nx * ny)
  let maisAlto = 0
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const o = j * nx + i
      const ia = i > 0 ? i - 1 : 0
      const ib = i < nx - 1 ? i + 1 : nx - 1
      const ja = j > 0 ? j - 1 : 0
      const jb = j < ny - 1 ? j + 1 : ny - 1
      gx[o] = (altura[j * nx + ib] - altura[j * nx + ia]) / (ib - ia)
      gy[o] = (altura[jb * nx + i] - altura[ja * nx + i]) / (jb - ja)
      if (altura[o] > maisAlto) maisAlto = altura[o]
    }
  }
  // O côncavo: o borrão menos a altura (o vale fica acima da média em volta), na régua de `REGUA_DO_CONCAVO`.
  const borrada = borrar(altura, nx, ny, RAIO_DO_CONCAVO)
  const concavo = new Float32Array(nx * ny)
  for (let o = 0; o < concavo.length; o += 1) concavo[o] = (borrada[o] - altura[o]) / REGUA_DO_CONCAVO
  const pe = distanciaDoNivel(altura, nx, ny)
  const sombra = distanciaDoNivel(sombraNoChao(altura, nx, ny), nx, ny)
  const cumes = relevo.cumes.map((c) => naTela(c.x * hw, c.y * hh, q))
  return {
    x0,
    y0,
    nx,
    ny,
    h: altura,
    gx,
    gy,
    concavo,
    pe,
    sombra,
    maisAlto,
    caixaDoPe: caixaDe(pe, nx, ny, x0, y0, 3, 1),
    caixaDaSombra: caixaDe(sombra, nx, ny, x0, y0, 3, 1),
    cumes,
  }
}

/**
 * A SOMBRA NO CHÃO, numa varredura: o ponto está na sombra se algum ponto do relevo na direção da luz (o contrário
 * de `SOMBRA_X`/`SOMBRA_Y`, a mesma conta das sombras do motor) está mais alto que a distância até ele. Andando uma
 * coluna para a direita a sombra anda `1 / SOMBRA_X` de altura; a linha de antes é lida interpolada em y.
 */
function sombraNoChao(h: Float32Array, nx: number, ny: number): Float32Array {
  const s = new Float32Array(h)
  const descida = 1 / SOMBRA_X_DA_MONTANHA
  const dy = SOMBRA_Y_DA_MONTANHA * descida
  for (let i = 1; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const fy = j - dy
      if (fy < 0) continue
      const j0 = Math.floor(fy)
      const t = fy - j0
      const j1 = Math.min(ny - 1, j0 + 1)
      const antes = s[j0 * nx + i - 1] * (1 - t) + s[j1 * nx + i - 1] * t - descida
      const o = j * nx + i
      if (antes > s[o]) s[o] = antes
    }
  }
  return s
}

/** A direção da sombra no chão (px por px de altura): a do motor (`motor.ts`, `SOMBRA_X` e `SOMBRA_Y`). */
const SOMBRA_X_DA_MONTANHA = 0.27
const SOMBRA_Y_DA_MONTANHA = 0.21

// ---------- a 3/4: o relevo projetado ----------

/**
 * A PROJEÇÃO da 3/4 (a tela é y - z), na mesma coluna de 1 px do terreno e em linhas de 1 px: para cada pixel, o y
 * do ponto do relevo que ele mostra (NaN = chão), a distância até a silhueta e o fio entre uma crista da frente e o
 * que fica atrás dela.
 */
interface Projecao {
  readonly y0: number
  readonly nl: number
  readonly visto: Float32Array
  readonly silhueta: Float32Array
  readonly fio: Float32Array
  readonly caixa: readonly [number, number, number, number]
}

/** O salto de profundidade (px do relevo) entre dois pixels vizinhos que já é uma crista na frente de outra. */
const SALTO_DA_CRISTA = 7

function projetar(t: Terreno): Projecao {
  const { nx, ny, x0, h } = t
  const subida = Math.ceil(t.maisAlto) + 2
  const y0 = t.y0 - subida
  const nl = ny + subida
  const visto = new Float32Array(nx * nl).fill(Number.NaN)
  // m = y' + o maior (h - y) da linha y' para a frente: m >= 0 é relevo na tela, e a curva m = 0 é a silhueta.
  const m = new Float32Array(nx * nl)
  const maiorDaFrente = new Float32Array(ny)
  for (let i = 0; i < nx; i += 1) {
    let maior = -Infinity
    for (let j = ny - 1; j >= 0; j -= 1) {
      const g = h[j * nx + i] - (t.y0 + j)
      if (g > maior) maior = g
      maiorDaFrente[j] = maior
    }
    // Da frente para trás, como um pintor de relevo: cada ponto cobre as linhas da tela entre a altura dele e o topo
    // do que já foi coberto (e nunca abaixo do próprio pé).
    let topo = Infinity
    let anterior = Number.NaN
    for (let j = ny - 1; j >= 0; j -= 1) {
      const z = h[j * nx + i]
      const y = t.y0 + j
      if (z < 0) {
        anterior = Number.NaN
        continue
      }
      const p = y - z
      const ate = Math.min(topo, y + 0.5)
      for (let k = Math.ceil(p - y0); y0 + k < ate; k += 1) {
        const yl = y0 + k
        // Entre este ponto e o da frente (projeção `anterior`), o y do relevo anda em linha reta.
        const frac = anterior > p ? Math.min(1, (yl - p) / (anterior - p)) : 0
        visto[k * nx + i] = y + frac
      }
      if (p < topo) topo = p
      anterior = p
    }
    for (let k = 0; k < nl; k += 1) {
      const yl = y0 + k
      const f = yl - t.y0
      let v: number
      if (f <= 0) v = maiorDaFrente[0]
      else if (f >= ny - 1) v = h[(ny - 1) * nx + i] - (t.y0 + ny - 1)
      else {
        const j = Math.floor(f)
        const a = f - j
        const aqui = (h[j * nx + i] - (t.y0 + j)) * (1 - a) + (h[(j + 1) * nx + i] - (t.y0 + j + 1)) * a
        v = Math.max(aqui, maiorDaFrente[j + 1])
      }
      m[k * nx + i] = yl + v
    }
  }
  const silhueta = distanciaDoNivel(m, nx, nl)
  const fio = new Float32Array(nx * nl)
  for (let k = 1; k < nl; k += 1) {
    for (let i = 1; i < nx - 1; i += 1) {
      const o = k * nx + i
      const v = visto[o]
      if (Number.isNaN(v)) continue
      // A crista da frente: o pixel de cima (ou do lado) mostra um ponto bem mais ao fundo.
      const cima = visto[o - nx]
      const esquerda = visto[o - 1]
      const direita = visto[o + 1]
      let salto = 0
      if (!Number.isNaN(cima)) salto = Math.max(salto, v - cima)
      if (!Number.isNaN(esquerda)) salto = Math.max(salto, v - esquerda)
      if (!Number.isNaN(direita)) salto = Math.max(salto, v - direita)
      fio[o] = passoSuave(SALTO_DA_CRISTA * 0.6, SALTO_DA_CRISTA * 1.6, salto)
    }
  }
  return { y0, nl, visto, silhueta, fio, caixa: caixaDe(silhueta, nx, nl, x0, y0, 3, 1) }
}

/** O y do relevo que o pixel (x, y') da 3/4 mostra: interpolado entre linhas vizinhas do mesmo pedaço; no chão, o próprio y'. */
function yVisto(t: Terreno, p: Projecao, x: number, y: number): number {
  const fx = x - t.x0
  const fy = y - p.y0
  if (fx < 0 || fy < 0 || fx >= t.nx - 1 || fy >= p.nl - 1) return y
  const i = Math.round(fx)
  const k = Math.floor(fy)
  const a = p.visto[k * t.nx + i]
  const b = p.visto[(k + 1) * t.nx + i]
  if (Number.isNaN(a)) return Number.isNaN(b) ? y : b
  if (Number.isNaN(b) || Math.abs(b - a) > SALTO_DA_CRISTA) return fy - k < 0.5 || Number.isNaN(b) ? a : b
  return a + (b - a) * (fy - k)
}

// ---------- o cache ----------

/** Quantos relevos ficam guardados: as duas vistas e a neve de um tamanho e giro leem o mesmo. */
const GUARDADOS_NO_MAXIMO = 4
const GUARDADOS = new Map<string, Terreno>()

function terrenoDe(relevo: Relevo, w: number, h: number, q: number): Terreno {
  const chave = `${relevo.nome}|${w}|${h}|${q}`
  const guardado = GUARDADOS.get(chave)
  if (guardado !== undefined) {
    // O mais usado vai para o fim (o primeiro do mapa é o que sai).
    GUARDADOS.delete(chave)
    GUARDADOS.set(chave, guardado)
    return guardado
  }
  const novo = montarTerreno(relevo, w, h, q)
  GUARDADOS.set(chave, novo)
  if (GUARDADOS.size > GUARDADOS_NO_MAXIMO) GUARDADOS.delete(GUARDADOS.keys().next().value as string)
  return novo
}

function projecaoDe(t: Terreno): Projecao {
  if (t.tres === undefined) t.tres = projetar(t)
  return t.tres
}

// ---------- a cor ----------

/** A luz NA TELA (de cima à esquerda, 40 graus de altura): a mesma das rochas (`pedrasERochas.ts`). */
const LUZ_X = -0.79 * 0.77
const LUZ_Y = -0.61 * 0.77
const LUZ_Z = 0.64
/** Quanto a face virada para a luz clareia (e a outra escurece), em luz somada, e o teto dos dois lados. */
const FORCA_DA_ENCOSTA = 0.66
const LUZ_MAIS_ESCURA = -0.42
const LUZ_MAIS_CLARA = 0.22
/** O vale escurece e a crista ganha um fio de luz (pelo côncavo, na régua dele). */
const ESCURO_DO_VALE = 0.13
const LUZ_DA_CRISTA = 0.07
/** O alto fica um pouco mais claro e frio (o ar entre o olho e o pé). */
const CLARO_DO_ALTO = 0.03
/** O pé escurece (o chão encosta na rocha): até esta altura (px). */
const PE_ESCURO = 7
const LUZ_DO_PE = 0.12
/** As manchas de tom da rocha (uma mais quente, outra mais fria) e o tamanho delas (1/px). */
const MANCHA_DA_ROCHA = 0.07
const ONDA_DA_MANCHA = 0.03
/** O fio escuro da crista da frente na 3/4. */
const ESCURO_DO_FIO = 0.2

/** A neve no sol e na sombra (azulada, contida). */
const NEVE_NO_SOL: Rgb = [0xe4, 0xe6, 0xe5]
const NEVE_NA_SOMBRA: Rgb = [0xa8, 0xb3, 0xbf]
/** A linha da neve (fração do cume mais alto) e o que a mexe: o côncavo segura, a face a prumo solta, a sombra guarda. */
const LINHA_DA_NEVE = 0.56
const NEVE_NO_CONCAVO = 0.16
const NEVE_ESCORRE_DE = 0.95
const NEVE_ESCORRE_ATE = 1.7
const NEVE_NA_FACE_A_PRUMO = 0.2
const NEVE_NA_SOMBRA_GUARDA = 0.1
const RASGO_DA_NEVE = 0.08
/** A borda da neve (fração do cume mais alto, de cada lado): estreita, a neve tem beira. */
const BEIRA_DA_NEVE = 0.018
/** Na neve o grão da pedra quase some; a luz da encosta fica mais branda. */
const GRAO_NA_NEVE = 0.2
const LUZ_NA_NEVE = 0.75

/** O mato baixo do pé: até que altura (fração do cume mais alto), em que inclinação ele some, quanto toma da cor e o limiar das manchas. */
const ALTURA_DO_MATO = 0.16
const INCLINACAO_DO_MATO = 1.2
const COR_DO_MATO = 0.42
const LIMIAR_DO_MATO = -0.02
/** O verde-oliva do Meio-Termo puxado para a pedra, para não gritar em cima do cinza (o musgo das rochas). */
const TOM_DO_MATO: Rgb = rgb(tomDoMeio('musgo', 0.8))
const QUANTO_DE_PEDRA_NO_MATO = 0.25

/** Quanto a rocha puxa para o escuro da pedra. */
const ESCURECE_A_ROCHA = 0.14
/** O escuro em que o pixel escuro demais é levantado (o piso de luz da pedra: cinza quente). */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

interface Clima {
  readonly neve: boolean
  readonly maisAlto: number
  readonly rocha: Rgb
  readonly quente: Rgb
  readonly fria: Rgb
  readonly mato: Rgb
  readonly daPedra: Textura | null
}

/**
 * A COR de um ponto (x, y) do relevo em `s` (a conta do pintor: cor, luz somada, emissão, alfa, pontilhado): a
 * rocha com o grão da pedra e as manchas, a luz pela normal, o vale e a crista, o pé, o mato e a neve.
 */
function sombrear(t: Terreno, clima: Clima, u: number, v: number, x: number, y: number, peca: Peca, s: Float32Array, escala: number): void {
  const mancha = ruido(x * ONDA_DA_MANCHA + 11, y * ONDA_DA_MANCHA + 3) * 2
  const tom = mancha > 0 ? clima.quente : clima.fria
  const k = Math.abs(mancha) * MANCHA_DA_ROCHA * 4
  s[0] = clima.rocha[0] + (tom[0] - clima.rocha[0]) * k
  s[1] = clima.rocha[1] + (tom[1] - clima.rocha[1]) * k
  s[2] = clima.rocha[2] + (tom[2] - clima.rocha[2]) * k
  if (clima.daPedra !== null) clima.daPedra(u, v, x, y, peca, s, escala)
  lerTerreno(t, x, y)
  const h = LIDO[0]
  const gx = LIDO[1]
  const gy = LIDO[2]
  const concavo = LIDO[3]
  const inclinacao = Math.sqrt(gx * gx + gy * gy)
  const sol = (-gx * LUZ_X - gy * LUZ_Y + LUZ_Z) / Math.sqrt(inclinacao * inclinacao + 1) - LUZ_Z
  const relativa = h / clima.maisAlto
  let luz = FORCA_DA_ENCOSTA * sol
  luz -= ESCURO_DO_VALE * passoSuave(0.15, 1.1, concavo)
  luz += LUZ_DA_CRISTA * passoSuave(0.15, 1.1, -concavo)
  luz += CLARO_DO_ALTO * relativa
  luz -= LUZ_DO_PE * (1 - passoSuave(0, PE_ESCURO, h))
  luz = luz < LUZ_MAIS_ESCURA ? LUZ_MAIS_ESCURA : luz > LUZ_MAIS_CLARA ? LUZ_MAIS_CLARA : luz
  s[3] += luz
  // O mato baixo, em manchas, no pé que não é a prumo.
  if (relativa < ALTURA_DO_MATO) {
    const manchaDoMato = ruido(x * 0.05 + 5, y * 0.05) + ruido(x * 0.17, y * 0.17 + 9) * 0.45
    const mato = (1 - passoSuave(ALTURA_DO_MATO * 0.4, ALTURA_DO_MATO, relativa)) * (1 - passoSuave(INCLINACAO_DO_MATO * 0.6, INCLINACAO_DO_MATO, inclinacao)) * passoSuave(LIMIAR_DO_MATO, LIMIAR_DO_MATO + 0.12, manchaDoMato)
    if (mato > 0) {
      const q = COR_DO_MATO * mato
      s[0] += (clima.mato[0] - s[0]) * q
      s[1] += (clima.mato[1] - s[1]) * q
      s[2] += (clima.mato[2] - s[2]) * q
    }
  }
  if (!clima.neve || relativa < LINHA_DA_NEVE - 0.35) return
  // A linha da neve: desce nas canaletas, foge da face a prumo, fica mais na sombra e se rasga no ruído.
  const rasgo = ruido(x * 0.07 + 3, y * 0.07 + 41) * 1.3 + ruido(x * 0.23 + 7, y * 0.23) * 0.7
  const prumo = passoSuave(NEVE_ESCORRE_DE, NEVE_ESCORRE_ATE, inclinacao)
  const excesso = relativa - LINHA_DA_NEVE + NEVE_NO_CONCAVO * Math.max(-0.5, Math.min(1.5, concavo)) - NEVE_NA_FACE_A_PRUMO * prumo - NEVE_NA_SOMBRA_GUARDA * sol * 3 + RASGO_DA_NEVE * rasgo
  const neve = passoSuave(-BEIRA_DA_NEVE, BEIRA_DA_NEVE, excesso)
  if (neve <= 0) return
  const sombra = limitar01(-sol * 2.2)
  s[0] += (NEVE_NO_SOL[0] + (NEVE_NA_SOMBRA[0] - NEVE_NO_SOL[0]) * sombra - s[0]) * neve
  s[1] += (NEVE_NO_SOL[1] + (NEVE_NA_SOMBRA[1] - NEVE_NO_SOL[1]) * sombra - s[1]) * neve
  s[2] += (NEVE_NO_SOL[2] + (NEVE_NA_SOMBRA[2] - NEVE_NO_SOL[2]) * sombra - s[2]) * neve
  s[6] *= 1 - neve * (1 - GRAO_NA_NEVE)
  s[3] -= neve * (1 - LUZ_NA_NEVE) * luz
}

// ---------- a cena ----------

/** A beira escura em volta do pé: quanto passa da curva (px) e o tom. */
const BEIRA = 0.8
const TOM_DA_BEIRA = 0.5
/** O contorno de dentro do corpo (o escurecido do último px). */
const CONTORNO_DO_CORPO = 0.12
/** A sombra no chão: a força e o borrão (px). */
const FORCA_DA_SOMBRA = 0.24
const BORRAO_DA_SOMBRA = 2.6
/** Quantos raios procuram o pé em volta de cada cume. */
const RAIOS_DO_PE = 96

/** Um ponto do pé, na tela: onde a altura cruza zero indo do cume para fora, e o rumo. */
interface PontoDoPe {
  readonly x: number
  readonly y: number
  readonly a: number
  readonly i: number
}

function pontosDoPe(t: Terreno): PontoDoPe[] {
  const pontos: PontoDoPe[] = []
  t.cumes.forEach(([cx, cy], ci) => {
    for (let i = 0; i < RAIOS_DO_PE; i += 1) {
      const a = (i / RAIOS_DO_PE) * 2 * Math.PI + ci
      const [c, s] = [Math.cos(a), Math.sin(a)]
      let r = 0
      const limite = Math.max(t.nx, t.ny)
      while (r < limite) {
        lerTerreno(t, cx + c * r, cy + s * r)
        if (LIDO[0] < 0) break
        r += 1
      }
      if (r >= limite || r === 0) continue
      pontos.push({ x: cx + c * r, y: cy + s * r, a, i: ci * RAIOS_DO_PE + i })
    }
  })
  return pontos
}

/** Um tufo de mato: um punhado de bolinhas sorteadas na mancha (px), cada uma com o seu tom. */
function tufoDeMato(c: ContextoDoMovel, L: Peca[], mx: number, my: number, raio: number, cor: MaterialDaPeca, sem: number): void {
  const bolinhas = 4 + Math.round(hash(sem, 1, 2201) * 4)
  for (let i = 0; i < bolinhas; i += 1) {
    const t = hash(i, sem, 2202) * 2 * Math.PI
    const longe = hash(i, sem, 2203) * raio
    const r = 1.3 * (0.7 + 0.7 * hash(i, sem, 2204))
    const bolinha = elipseGirada(mx + Math.cos(t) * longe, my + Math.sin(t) * longe * 0.75, r, r * 0.86, t)
    L.push(c.peca(bolinha, cor, { bisel: r * 0.7, contorno: 0.26, tom: 0.8 + 0.3 * hash(i, sem, 2205), semente: 2300 + sem * 11 + i }))
  }
}

/** A forma lida de uma grade de distâncias, com a caixa dada (fora da grade, longe). */
function formaDaGrade(g: Float32Array, nx: number, ny: number, x0: number, y0: number, caixa: readonly [number, number, number, number], afasta = 0): Forma {
  return { b: [caixa[0] - afasta, caixa[1] - afasta, caixa[2] + afasta, caixa[3] + afasta], d: (x, y) => naGrade(g, nx, ny, x0, y0, x, y, 50) - afasta }
}

function montarRelevo(relevo: Relevo, c: ContextoDoMovel, cena: Cena): void {
  const q = quartosDoGiro(c.giro)
  const t = terrenoDe(relevo, c.w, c.h, q)
  const tres = c.vista === 'tres-quartos'
  const p = tres ? projecaoDe(t) : null
  const pedra = c.m.pedra
  const clima: Clima = {
    neve: montanhaComNeve(c.variante),
    maisAlto: t.maisAlto,
    // A rocha um tanto mais escura que a pedra do material: a encosta inteira de pedra clara lia como reboco.
    rocha: misturar(pedra.rgb, ESCURO_DA_PEDRA, ESCURECE_A_ROCHA),
    quente: misturar(pedra.rgb, [0xa8, 0x90, 0x74], 0.5),
    fria: misturar(pedra.rgb, [0x7c, 0x86, 0x8e], 0.5),
    mato: misturar(TOM_DO_MATO, pedra.rgb, QUANTO_DE_PEDRA_NO_MATO),
    daPedra: texturaDaClasse('pedra'),
  }
  const mato: MaterialDaPeca = { classe: 'folha', rgb: misturar(TOM_DO_MATO, pedra.rgb, QUANTO_DE_PEDRA_NO_MATO * 0.6) }
  const tela: Cena = { partes: [], sombras: [], corDoPiso: ESCURO_DA_PEDRA }
  const L = tela.partes
  const P = c.peca
  const escala = Math.sqrt(Math.min(c.w / (relevo.casasW * G), c.h / (relevo.casasH * G)))

  // No chão (as duas vistas): a sombra do relevo e o contato do pé.
  const pe = formaDaGrade(t.pe, t.nx, t.ny, t.x0, t.y0, t.caixaDoPe)
  tela.sombras.push({ forma: formaDaGrade(t.sombra, t.nx, t.ny, t.x0, t.y0, t.caixaDaSombra), z: 0, suave: BORRAO_DA_SOMBRA, forca: FORCA_DA_SOMBRA }, contato(pe, 0.3))

  // O corpo: de cima, a curva do pé; na 3/4, a silhueta do relevo projetado. A cor é a mesma conta.
  const corpo = p === null ? pe : formaDaGrade(p.silhueta, t.nx, p.nl, t.x0, p.y0, p.caixa)
  const textura: Textura =
    p === null
      ? (u, v, x, y, peca, s, e) => sombrear(t, clima, u, v, x, y, peca, s, e)
      : (u, v, x, y, peca, s, e) => {
          sombrear(t, clima, u, v, x, yVisto(t, p, x, y), peca, s, e)
          s[3] -= ESCURO_DO_FIO * naGrade(p.fio, t.nx, p.nl, t.x0, p.y0, x, y, 0)
        }
  const beira: Forma = { b: [corpo.b[0] - BEIRA, corpo.b[1] - BEIRA, corpo.b[2] + BEIRA, corpo.b[3] + BEIRA], d: (x, y) => corpo.d(x, y) - BEIRA }
  L.push(P(beira, pedra, { tabua: 0, bisel: 0.8, contorno: 0.3, tom: TOM_DA_BEIRA, semente: 2150 }))

  // O cascalho na boca dos vales (no chão: na 3/4 só o que nenhuma encosta da frente cobre).
  const seixos: Peca[] = []
  const pontos = pontosDoPe(t)
  for (const ponto of pontos) {
    lerTerreno(t, ponto.x - Math.cos(ponto.a) * 4, ponto.y - Math.sin(ponto.a) * 4)
    if (LIDO[3] < 0.35 || hash(ponto.i, 0, 2101) > 0.5) continue
    for (let k = 0; k < 3; k += 1) {
      const longe = 2.5 + 7 * hash(ponto.i, k, 2102)
      const desvio = (hash(ponto.i, k, 2103) - 0.5) * 0.5
      const [x, y] = [ponto.x + Math.cos(ponto.a + desvio) * longe, ponto.y + Math.sin(ponto.a + desvio) * longe]
      lerTerreno(t, x, y)
      if (LIDO[0] > -1.2 || Math.abs(x) > t.nx / 2 - MARGEM || Math.abs(y) > t.ny / 2 - MARGEM) continue
      if (p !== null) {
        const v = yVisto(t, p, x, y)
        if (v > y + 1) continue
      }
      const r = (1.8 + 2.4 * hash(ponto.i, k, 2104)) * escala
      const seixo = elipseGirada(x, y, r, r * 0.72, hash(ponto.i, k, 2105) * 2 * Math.PI)
      tela.sombras.push({ forma: seixo, z: r * 0.8, forca: 0.26 }, contato(seixo, 0.24))
      seixos.push(P(seixo, pedra, { tabua: 0, bisel: r * 0.75, contorno: 0.32, tom: 0.82 + 0.26 * hash(ponto.i, k, 2106), semente: 2110 + ponto.i * 3 + k }))
    }
  }
  L.push(...seixos)
  L.push(P(corpo, pedra, { tabua: 0, bisel: 0, contorno: CONTORNO_DO_CORPO, textura, semente: 2200 }))

  // Os tufos de mato no pé (por cima do corpo; na 3/4, subidos pela altura do relevo e só os que se veem).
  for (const ponto of pontos) {
    if (hash(ponto.i, 1, 2210) > 0.3) continue
    const dentro = 3 + 9 * hash(ponto.i, 1, 2211)
    const [x, y] = [ponto.x - Math.cos(ponto.a) * dentro, ponto.y - Math.sin(ponto.a) * dentro]
    lerTerreno(t, x, y)
    const z = LIDO[0]
    if (z < 1.5 || z > ALTURA_DO_MATO * t.maisAlto || Math.hypot(LIDO[1], LIDO[2]) > INCLINACAO_DO_MATO) continue
    if (p !== null && Math.abs(yVisto(t, p, x, y - z) - y) > 2.5) continue
    tufoDeMato(c, L, x, p === null ? y : y - z, (2.2 + 2 * hash(ponto.i, 1, 2212)) * escala, mato, ponto.i)
  }

  if (q === 0) {
    cena.partes.push(...tela.partes)
    cena.sombras.push(...tela.sombras)
    cena.corDoPiso = tela.corDoPiso
  } else desgirarCena(tela, q, cena)
}

export const montarMontanhaPequena: MontarMovel = (c, cena) => montarRelevo(RELEVOS.pequena, c, cena)
export const montarMontanhaMedia: MontarMovel = (c, cena) => montarRelevo(RELEVOS.media, c, cena)
export const montarMontanhaGrande: MontarMovel = (c, cena) => montarRelevo(RELEVOS.grande, c, cena)
