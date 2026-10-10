import type { Drawing, PinceladaDeTextura, Region, RegionPoint } from '../types/map'
import { formaDoBalde, type FormaDoBalde } from './baldeDeTextura'
import { caixaDoCaminho, caixasSeTocam, type Caixa } from './texturas'

/**
 * PLANO DA PINTURA DAS TEXTURAS (`lib/texturas.ts`): de passos do mapa para
 * camadas na tela, sem canvas (o teste confere a conta; `pixi/texturasRaster.ts`
 * só executa).
 *
 * Cada CAMADA é uma textura repetida (`TilingSprite`) vista através de uma
 * máscara (o quanto ela cobre em cada ponto). As camadas são compostas uma
 * por cima da outra, como a tinta: o passo de depois cobre o de antes na
 * força dele. Um passo entra numa camada já existente da MESMA textura quando
 * nenhuma camada de outra textura criada depois dela encosta nele — a ordem
 * entre coisas que não se tocam não muda o resultado. Assim o mapa típico
 * (floresta aqui, areia ali) tem uma camada por textura, e repintar campo por
 * cima da floresta abre uma camada nova só onde precisa.
 *
 * A borracha tira, na força dela, de todas as camadas que já existiam.
 */

/** Uma camada: textura e o retângulo de mundo que a máscara dela cobre (já na grade de pixels). */
export interface CamadaDoPlano {
  textura: string
  caixa: Caixa
  /** Tamanho da máscara, em pixels. */
  largura: number
  altura: number
}

export type FormaDoPasso = { tipo: 'caminho'; pontos: RegionPoint[]; raio: number } | { tipo: 'balde'; forma: FormaDoBalde }

export interface PassoDoPlano {
  /** Índice da camada em que a tinta cai; `null` = borracha. */
  camada: number | null
  /** Borracha: as camadas que já existiam quando ela passou (e encostam nela). */
  apagaDe: number[]
  forca: number
  forma: FormaDoPasso
  /** Onde o passo pinta, com a margem da borda macia (mundo, na grade de pixels). */
  caixa: Caixa
}

export interface PlanoDasTexturas {
  /** Pixels de máscara por px de mundo (o mesmo para todas as camadas). */
  escala: number
  camadas: CamadaDoPlano[]
  passos: PassoDoPlano[]
}

/**
 * Borda macia do pincel: o miolo vai até `MIOLO` do raio, e a borda esfuma
 * até perto de `ALCANCE` (o resto é a cauda da gaussiana, que some). A
 * margem da caixa é o alcance: nada da pincelada cai fora dela.
 */
export const MIOLO_DO_PINCEL = 0.8
export const ALCANCE_DO_PINCEL = 1.15

/**
 * Teto de memória das máscaras: a soma dos pixels de todas (4 bytes cada, na
 * placa e na tela 2D). Três texturas de 2048 × 2048: dá para pintar o
 * continente inteiro de bioma em bioma, e o celular aguenta.
 */
export const ORCAMENTO_DAS_MASCARAS = 2048 * 2048 * 3
/** Lado máximo de uma máscara (o mesmo teto da textura do relevo). */
export const LADO_MAXIMO_DA_MASCARA = 2048
/** Mais fino que 1 pixel de máscara por px de mundo não acrescenta nada (a borda já é macia). */
export const ESCALA_MAXIMA = 1
/** Camadas demais pesam no quadro (cada uma é uma passada de máscara): a partir daqui, a mesma textura volta para a camada dela. */
export const CAMADAS_MAXIMAS = 24

interface Opcoes {
  orcamento?: number
  ladoMaximo?: number
}

function unir(a: Caixa, b: Caixa): Caixa {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }
}

function area(c: Caixa): number {
  return Math.max(0, c.maxX - c.minX) * Math.max(0, c.maxY - c.minY)
}

/** A caixa nos pixels da máscara (a grade parte da origem do mundo: camadas e passos casam pixel a pixel). */
function naGrade(c: Caixa, escala: number): Caixa {
  return {
    minX: Math.floor(c.minX * escala) / escala,
    minY: Math.floor(c.minY * escala) / escala,
    maxX: Math.ceil(c.maxX * escala) / escala,
    maxY: Math.ceil(c.maxY * escala) / escala,
  }
}

interface PassoBruto {
  textura: string | null
  forca: number
  forma: FormaDoPasso
  caixa: Caixa
}

/**
 * O plano dos passos. `disponivel` diz quais texturas esta tela tem (a do
 * pacote que ainda não chegou fica de fora; a borracha vale sempre).
 * `null` = nada a pintar.
 */
export function planoDasTexturas(
  passos: readonly PinceladaDeTextura[] | undefined,
  regioes: readonly Region[],
  desenhos: readonly Drawing[],
  disponivel: (textura: string) => boolean,
  opcoes: Opcoes = {},
): PlanoDasTexturas | null {
  if (passos === undefined || passos.length === 0) return null
  const brutos: PassoBruto[] = []
  for (const passo of passos) {
    if (passo.tipo === 'balde') {
      if (!disponivel(passo.textura)) continue
      const forma = formaDoBalde(passo.alvo, regioes, desenhos)
      if (forma === null) continue
      brutos.push({ textura: passo.textura, forca: passo.forca, forma: { tipo: 'balde', forma }, caixa: forma.caixa })
      continue
    }
    if (passo.tipo === 'pincel' && !disponivel(passo.textura)) continue
    brutos.push({
      textura: passo.tipo === 'pincel' ? passo.textura : null,
      forca: passo.forca,
      forma: { tipo: 'caminho', pontos: passo.pontos, raio: passo.raio },
      caixa: caixaDoCaminho(passo.pontos, passo.raio * ALCANCE_DO_PINCEL),
    })
  }

  // Camadas (em mundo, antes da grade): onde cada passo de tinta cai.
  const camadas: { textura: string; caixa: Caixa }[] = []
  const destino: (number | null)[] = []
  const apagaDe: number[][] = []
  for (const passo of brutos) {
    if (passo.textura === null) {
      destino.push(null)
      apagaDe.push(camadas.flatMap((camada, i) => (caixasSeTocam(camada.caixa, passo.caixa) ? [i] : [])))
      continue
    }
    apagaDe.push([])
    let alvo = -1
    for (let i = camadas.length - 1; i >= 0; i -= 1) {
      if (camadas[i].textura === passo.textura) {
        alvo = i
        break
      }
      if (caixasSeTocam(camadas[i].caixa, passo.caixa)) break
    }
    if (alvo < 0 && camadas.length >= CAMADAS_MAXIMAS) alvo = camadas.map((c) => c.textura).lastIndexOf(passo.textura)
    if (alvo < 0) {
      camadas.push({ textura: passo.textura, caixa: passo.caixa })
      alvo = camadas.length - 1
    } else {
      camadas[alvo].caixa = unir(camadas[alvo].caixa, passo.caixa)
    }
    destino.push(alvo)
  }
  // Borracha sem nenhuma camada antes dela não muda nada; camada sem tinta não existe.
  if (camadas.length === 0) return null

  const ladoMaximo = opcoes.ladoMaximo ?? LADO_MAXIMO_DA_MASCARA
  const orcamento = opcoes.orcamento ?? ORCAMENTO_DAS_MASCARAS
  const somaDasAreas = camadas.reduce((soma, c) => soma + area(c.caixa), 0)
  const maiorLado = Math.max(...camadas.map((c) => Math.max(c.caixa.maxX - c.caixa.minX, c.caixa.maxY - c.caixa.minY)))
  // Dois pixels de folga no lado: a caixa ainda cresce até um pixel em cada ponta ao cair na grade (`naGrade`).
  const escala = Math.min(ESCALA_MAXIMA, (ladoMaximo - 2) / Math.max(1, maiorLado), Math.sqrt(orcamento / Math.max(1, somaDasAreas)))

  return {
    escala,
    camadas: camadas.map((c) => {
      const caixa = naGrade(c.caixa, escala)
      return {
        textura: c.textura,
        caixa,
        largura: Math.max(1, Math.round((caixa.maxX - caixa.minX) * escala)),
        altura: Math.max(1, Math.round((caixa.maxY - caixa.minY) * escala)),
      }
    }),
    passos: brutos.map((passo, i) => ({ camada: destino[i], apagaDe: apagaDe[i], forca: passo.forca, forma: passo.forma, caixa: naGrade(passo.caixa, escala) })),
  }
}

/** Pixels de todas as máscaras do plano (o que a medida de desempenho e o teste de memória leem). */
export function pixelsDoPlano(plano: PlanoDasTexturas): number {
  return plano.camadas.reduce((soma, c) => soma + c.largura * c.altura, 0)
}
