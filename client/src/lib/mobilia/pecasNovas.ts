/**
 * PEÇAS NOVAS do Meio-Termo, lote 1 (fatia MT4 do plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`): mesa quadrada,
 * mesa redonda, lápide, vaso, lampião, quadro de avisos, poço, barraca de
 * feira e carroça. Aqui mora o registro de cada uma (nome, artigo, tamanho
 * padrão em casas, vista, silhueta e o desenho de linhas provisório) e o
 * CATÁLOGO que o painel oferece. `lib/mobilia.ts` junta este registro ao dos
 * 11 móveis de antes.
 *
 * As peças novas saem SEMPRE com o desenho de textura (a chave de obra só vale
 * para os 11 de antes, `pixi/drawPropSilhouettes.ts`). O desenho de linhas
 * daqui é o provisório que aparece enquanto a imagem não fica pronta.
 *
 * Sem import de `types/map.ts` (o tipo vem de `tipos.ts`), para não criar ciclo.
 */
import { TIPOS_MOBILIA, type TipoMobilia } from './tipos'

/** As 9 peças do lote 1, na ordem em que entram no catálogo (a do plano). */
export const PECAS_NOVAS = ['mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca'] as const satisfies readonly TipoMobilia[]

export type PecaNova = (typeof PECAS_NOVAS)[number]

/** Peças novas com vista de lado (Frente | Lado): a barraca e a carroça. */
export type PecaNovaComVista = Extract<PecaNova, 'barraca' | 'carroca'>

export function ehPecaNova(tipo: TipoMobilia | undefined): tipo is PecaNova {
  return PECAS_NOVAS.some((peca) => peca === tipo)
}

interface Casas {
  readonly largura: number
  readonly altura: number
}

export interface FichaDaPecaNova {
  /** Nome na setinha e no seletor de tipo. */
  readonly rotulo: string
  /** Artigo + nome, para a dica ("Clique no mapa para pôr uma lápide."). */
  readonly artigo: string
  /** Tamanho padrão em casas (largura x altura, sem giro), de frente. */
  readonly tamanho: Casas
  /** Silhueta redonda (a elipse inscrita) vista de cima. */
  readonly redonda: boolean
}

/**
 * Tamanhos do plano. O vaso leva "de planta" no nome e a barraca "de feira":
 * "Vaso" e "Barraca" sozinhos não dizem o que são no meio dos móveis.
 */
export const FICHAS_DAS_PECAS_NOVAS: Readonly<Record<PecaNova, FichaDaPecaNova>> = {
  mesaQuadrada: { rotulo: 'Mesa quadrada', artigo: 'uma mesa quadrada', tamanho: { largura: 1, altura: 1 }, redonda: false },
  mesaRedonda: { rotulo: 'Mesa redonda', artigo: 'uma mesa redonda', tamanho: { largura: 1.25, altura: 1.25 }, redonda: true },
  lapide: { rotulo: 'Lápide', artigo: 'uma lápide', tamanho: { largura: 0.6, altura: 0.35 }, redonda: false },
  vaso: { rotulo: 'Vaso de planta', artigo: 'um vaso de planta', tamanho: { largura: 0.5, altura: 0.5 }, redonda: true },
  lampiao: { rotulo: 'Lampião', artigo: 'um lampião', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  quadroDeAvisos: { rotulo: 'Quadro de avisos', artigo: 'um quadro de avisos', tamanho: { largura: 1, altura: 0.4 }, redonda: false },
  poco: { rotulo: 'Poço', artigo: 'um poço', tamanho: { largura: 1.5, altura: 1.5 }, redonda: true },
  barraca: { rotulo: 'Barraca de feira', artigo: 'uma barraca de feira', tamanho: { largura: 2, altura: 2 }, redonda: false },
  carroca: { rotulo: 'Carroça', artigo: 'uma carroça', tamanho: { largura: 2, altura: 1.25 }, redonda: false },
}

/** Um valor por peça nova, lido da ficha (o nome, o artigo, o tamanho), para juntar às tabelas de `lib/mobilia.ts`. */
export function porPecaNova<T>(valor: (ficha: FichaDaPecaNova) => T): Readonly<Record<PecaNova, T>> {
  const f = FICHAS_DAS_PECAS_NOVAS
  return {
    mesaQuadrada: valor(f.mesaQuadrada),
    mesaRedonda: valor(f.mesaRedonda),
    lapide: valor(f.lapide),
    vaso: valor(f.vaso),
    lampiao: valor(f.lampiao),
    quadroDeAvisos: valor(f.quadroDeAvisos),
    poco: valor(f.poco),
    barraca: valor(f.barraca),
    carroca: valor(f.carroca),
  }
}

/** Pegada de LADO em casas: a barraca de lado é o perfil do toldo sobre o balcão; a carroça, a roda e a caixa. */
export const TAMANHO_DE_LADO_DAS_PECAS_NOVAS: Readonly<Record<PecaNovaComVista, Casas>> = {
  barraca: { largura: 2, altura: 2 },
  carroca: { largura: 2, altura: 1.25 },
}

export const PECAS_NOVAS_COM_VISTA: readonly PecaNovaComVista[] = ['barraca', 'carroca']

/**
 * As peças novas PRONTAS: desenho com textura feito e medido. Só elas entram
 * na setinha e no seletor de tipo; a que não está aqui ainda abre de um
 * arquivo (o tipo existe), mas o painel não a oferece.
 */
export const PECAS_NOVAS_PRONTAS: readonly PecaNova[] = []

/** O catálogo do painel de Objetos: os 11 de antes, na ordem de sempre, e as peças novas prontas. */
export const TIPOS_NO_CATALOGO: readonly TipoMobilia[] = [...TIPOS_MOBILIA.filter((tipo) => !ehPecaNova(tipo)), ...PECAS_NOVAS_PRONTAS]

/** O catálogo e, se não estiver nele, o tipo do móvel selecionado (o seletor sempre mostra o que o móvel é). */
export function catalogoComOTipo(tipo: TipoMobilia): readonly TipoMobilia[] {
  return TIPOS_NO_CATALOGO.includes(tipo) ? TIPOS_NO_CATALOGO : [...TIPOS_NO_CATALOGO, tipo]
}

// ---------- variação da lápide ----------

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619
export const VARIANTES_DA_LAPIDE = 3

/**
 * A lápide tem 3 desenhos (arco, reta com quina partida e cruz). O desenho
 * sai do id do objeto: o mesmo objeto sempre igual, no editor e no jogador
 * (o recorte leva o id), e lápides vizinhas diferentes sem o mestre escolher.
 */
export function varianteDaLapide(id: string | undefined): number {
  if (id === undefined || id === '') return 0
  let h = FNV_BASE
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), FNV_PRIMO)
  return (h >>> 0) % VARIANTES_DA_LAPIDE
}

// ---------- desenho de linhas (o provisório) ----------

/** Um traço reto, em px de mundo, centro do objeto na origem (o `TracoDoGlifo` de `lib/mobilia.ts`). */
interface Traco {
  x1: number
  y1: number
  x2: number
  y2: number
}

const LADOS_DO_ARO = 24

function aro(largura: number, altura: number, cx = 0, cy = 0): Traco[] {
  const tracos: Traco[] = []
  for (let i = 0; i < LADOS_DO_ARO; i += 1) {
    const a0 = (2 * Math.PI * i) / LADOS_DO_ARO
    const a1 = (2 * Math.PI * (i + 1)) / LADOS_DO_ARO
    tracos.push({ x1: cx + (largura / 2) * Math.cos(a0), y1: cy + (altura / 2) * Math.sin(a0), x2: cx + (largura / 2) * Math.cos(a1), y2: cy + (altura / 2) * Math.sin(a1) })
  }
  return tracos
}

function quadro(x0: number, y0: number, x1: number, y1: number): Traco[] {
  return [
    { x1: x0, y1: y0, x2: x1, y2: y0 },
    { x1: x1, y1: y0, x2: x1, y2: y1 },
    { x1: x1, y1: y1, x2: x0, y2: y1 },
    { x1: x0, y1: y1, x2: x0, y2: y0 },
  ]
}

function linha(x0: number, y: number, x1: number): Traco {
  return { x1: x0, y1: y, x2: x1, y2: y }
}

/** Glifo de frente (de cima) da peça nova: poucos traços que dizem o que ela é. */
function tracosDeFrente(tipo: PecaNova, largura: number, altura: number): Traco[] {
  const hw = largura / 2
  const hh = altura / 2
  switch (tipo) {
    case 'mesaQuadrada': {
      const recuo = Math.min(largura, altura) * 0.12
      return quadro(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo)
    }
    case 'mesaRedonda':
      return aro(largura * 0.78, altura * 0.78)
    case 'lapide':
      return [linha(-hw, -hh + altura * 0.45, hw)]
    case 'vaso':
      return aro(largura * 0.66, altura * 0.66)
    case 'lampiao':
      return quadro(-hw * 0.55, -hh * 0.55, hw * 0.55, hh * 0.55)
    case 'quadroDeAvisos':
      // Os três papéis pregados: duas divisas de pé.
      return [
        { x1: -hw / 3, y1: -hh * 0.6, x2: -hw / 3, y2: hh * 0.6 },
        { x1: hw / 3, y1: -hh * 0.6, x2: hw / 3, y2: hh * 0.6 },
      ]
    case 'poco':
      return [...aro(largura * 0.62, altura * 0.62), linha(-hw, 0, hw)]
    case 'barraca':
      return [linha(-hw, -hh * 0.15, hw), linha(-hw, hh * 0.62, hw)]
    case 'carroca':
      return quadro(-hw * 0.4, -hh * 0.75, hw * 0.98, hh * 0.75)
  }
}

/** Glifo de lado da barraca (a beira do toldo e o tampo do balcão) e da carroça (a roda). */
function tracosDaVistaDeLado(tipo: PecaNovaComVista, largura: number, altura: number): Traco[] {
  const hw = largura / 2
  const hh = altura / 2
  if (tipo === 'barraca') return [linha(-hw, -hh + altura * 0.4, hw), linha(-hw * 0.9, hh - altura * 0.3, hw * 0.9)]
  // A roda cabe na caixa em qualquer proporção: o diâmetro é o menor entre 62% da altura e 60% da largura.
  const roda = Math.min(altura * 0.62, largura * 0.6)
  return aro(roda, roda, hw * 0.12, hh - roda / 2)
}

export function tracosDaPecaNova(tipo: PecaNova, largura: number, altura: number, deLado: boolean): Traco[] {
  if (deLado && (tipo === 'barraca' || tipo === 'carroca')) return tracosDaVistaDeLado(tipo, largura, altura)
  return tracosDeFrente(tipo, largura, altura)
}

/** Contorno de lado (barraca e carroça): o retângulo do objeto, no sentido horário a partir do canto de cima à esquerda. */
export function contornoDaPecaNovaDeLado(largura: number, altura: number): { x: number; y: number }[] {
  const hw = largura / 2
  const hh = altura / 2
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ]
}
