import type { MaterialDoBarranco } from '../../types/map'
import { misturar, rgb, type Rgb } from '../ruido'
import { contornoDoTom, PERFIL_DO_BARRANCO, TONS_DO_BARRANCO, type TonsDoBarranco } from './barranco'
import { PALETA_MEIO_TERMO } from './paleta'

/**
 * BARRANCO PELO CHÃO (pedido de 17/11/2026: "queria também uma melhoria no
 * barranco porque ele só levanta terra, eu queria que desse para colocar um
 * relevo dependendo da textura no chão"). A face, a rampa e a beira do
 * barranco do Meio-Termo ganham o material do chão do lado ALTO:
 *
 * - Terra: a de hoje, idêntica (`TONS_DO_BARRANCO`, a rampa de `PALETA.terra`
 *   e o fio de luz de `drawBarranco.ts`): ligar esta tabela não muda nada em
 *   mapa nenhum que não tenha outro chão no alto;
 * - Pedra: rocha cinza quente, a rampa no tom da Serra;
 * - Areia: ocre, a rampa no tom da areia;
 * - Neve: face cinza-azulada com a borda branca da neve;
 * - Grama: a terra de hoje com a borda verde da grama.
 *
 * Material automático pelo chão pintado (`materialDoChao`) ou escolhido no
 * painel (`EscolhaDoMaterial`). Regras do estilo (`docs/design/ESTILO-DO-RPG.md`):
 * preenchimento liso com realce, sem hachura, cores contidas, contorno no tom
 * escuro da própria cor (`contornoDoTom`), nunca preto.
 *
 * Folha aprovada pelo mestre em 17/11/2026
 * (`tmp/pedidos-2026-11-17/barranco-folha/`). Só a tabela: nada aqui desenha
 * nem sorteia. Quem escolhe o material de cada barranco é
 * `lib/materialDoBarranco.ts`; quem pinta é `pixi/drawBarranco.ts`: a face com
 * `corDaFacePorChao(tons.face, …)` e o contorno `tons.face.contorno`, a rampa
 * com `tons.rampa`, os traços com `afina` depois da parede e ANTES da rampa (a
 * rampa cobre a ponta deles no vão) e os sem `afina` (o fio de hoje) no fim. O
 * véu de cima da Área alta continua o de hoje.
 */

// O tipo mora em `types/map.ts` (é campo do risco e do quadrado alto); quem já o importava daqui continua valendo.
export type { MaterialDoBarranco }

/** O que o painel oferece: Automático (pelo chão do lado alto) ou um material fixo. */
export type EscolhaDoMaterial = 'automatico' | MaterialDoBarranco

/** A ordem do painel ("Material: Automático / Terra / Pedra / Areia / Neve / Grama"). */
export const ESCOLHAS_DO_MATERIAL: readonly EscolhaDoMaterial[] = ['automatico', 'terra', 'pedra', 'areia', 'neve', 'grama']

export const NOME_DA_ESCOLHA: Readonly<Record<EscolhaDoMaterial, string>> = {
  automatico: 'Automático',
  terra: 'Terra',
  pedra: 'Pedra',
  areia: 'Areia',
  neve: 'Neve',
  grama: 'Grama',
}

/**
 * Um traço ao longo da beira de cima, em px do protótipo (o desenho multiplica
 * por `escalaDoBarranco`). `recuo` é quanto o meio do traço entra no lado
 * ALTO a partir da beira (0 = em cima da beira, metade sobre a face).
 * `afina`: o traço é uma faixa que afina junto com a face nas pontas do risco
 * (onde a parede morre no chão); sem ele, o traço de largura fixa de hoje.
 */
export interface TracoDaBeira {
  readonly cor: Rgb
  readonly alfa: number
  readonly largura: number
  readonly recuo: number
  readonly afina?: boolean
}

/** Até que fração da espessura cheia a borda que `afina` ainda está afinando (só as pontas; a face do norte, a 36%, fica inteira). */
export const AFINA_ATE = 0.3

/** Os três tons do vão da rampa (o claro em cima, o fundo embaixo), como `PALETA.terra` hoje. */
export interface TonsDaRampa {
  readonly realce: Rgb
  readonly base: Rgb
  readonly sombra: Rgb
}

export interface TonsDoBarrancoPorChao {
  /** A face: o perfil liso de `corDaFacePorChao` e o contorno do pé. */
  readonly face: TonsDoBarranco
  readonly rampa: TonsDaRampa
  /** Os traços da beira, na ordem de pintar (o de baixo primeiro). */
  readonly beira: readonly TracoDaBeira[]
}

/** O fio de luz da beira de hoje (`LUZ` e `pintarBeira` de `pixi/drawBarranco.ts`). */
const FIO_DE_HOJE: TracoDaBeira = { cor: rgb('#fff3dc'), alfa: 0.45, largura: 1.7, recuo: 0.9 }

function faceDe(base: string, realce: string, sombra: string): TonsDoBarranco {
  return { base: rgb(base), realce: rgb(realce), sombra: rgb(sombra), contorno: contornoDoTom(rgb(base)) }
}

function rampaDe(realce: string, base: string, sombra: string): TonsDaRampa {
  return { realce: rgb(realce), base: rgb(base), sombra: rgb(sombra) }
}

const TERRA = PALETA_MEIO_TERMO.terra

export const TONS_POR_CHAO: Readonly<Record<MaterialDoBarranco, TonsDoBarrancoPorChao>> = {
  terra: {
    face: TONS_DO_BARRANCO,
    rampa: rampaDe(TERRA.realce, TERRA.base, TERRA.sombra),
    beira: [FIO_DE_HOJE],
  },
  // Rocha: o cinza quente da Serra (média #998a7b no app, matiz 30°), um degrau mais escuro e menos saturado na face.
  pedra: {
    face: faceDe('#8c8378', '#a59c90', '#72695f'),
    rampa: rampaDe('#b3a799', '#a29586', '#8c7f71'),
    beira: [FIO_DE_HOJE],
  },
  // Ocre: a areia (média #d2bd83) e a duna (#c7a862) vistas de lado, na sombra.
  areia: {
    face: faceDe('#bb9862', '#cdae7a', '#a1804f'),
    rampa: rampaDe('#e0cd98', '#d3bd85', '#bea56d'),
    beira: [FIO_DE_HOJE],
  },
  // Cinza-azulado com a borda branca: a neve (média #dee7ef) que debruça na beira.
  neve: {
    face: faceDe('#a6b1bc', '#c3ccd5', '#8b98a6'),
    rampa: rampaDe('#eef3f7', '#dfe7ee', '#c7d3df'),
    beira: [{ cor: rgb('#f5f8fb'), alfa: 1, largura: 3.4, recuo: 0.3, afina: true }],
  },
  // A terra de hoje com a borda verde: a grama do alto (média #83c15d) que debruça na beira.
  grama: {
    face: TONS_DO_BARRANCO,
    rampa: rampaDe(TERRA.realce, TERRA.base, TERRA.sombra),
    beira: [
      { cor: rgb('#6fa94c'), alfa: 1, largura: 3, recuo: 0.3, afina: true },
      { cor: rgb('#a7d488'), alfa: 0.55, largura: 1.2, recuo: 1.5, afina: true },
    ],
  },
}

function limitar(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

/** Curva suave de 0 a 1 (`smoothstep`), a mesma de `barranco.ts`. */
function suave(t: number): number {
  const x = limitar(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/**
 * A cor da face a `fracao` da altura (0 = lábio, 1 = pé), com os tons de um
 * material: a mesma conta de `corDoBarranco` (o mesmo `PERFIL_DO_BARRANCO`).
 * Com os tons da Terra dá exatamente `corDoBarranco(fracao)`.
 */
export function corDaFacePorChao(tons: TonsDoBarranco, fracao: number): [number, number, number] {
  const { realceAte, realceSome, sombraDe, sombraCheia } = PERFIL_DO_BARRANCO
  const f = limitar(fracao, 0, 1)
  const realce = 1 - suave((f - realceAte) / (realceSome - realceAte))
  const sombra = suave((f - sombraDe) / (sombraCheia - sombraDe))
  const cor = misturar(misturar(tons.base, tons.realce, realce), tons.sombra, sombra)
  return [Math.round(cor[0]), Math.round(cor[1]), Math.round(cor[2])]
}

/**
 * O material de cada chão do catálogo (`texturas/embutidas.ts`), para o
 * Automático. Chão fora da lista, chão liso por cor, piso de sala ou nenhum
 * chão = Terra (o barranco de hoje): as matas, o Campo amarelo e o Campo morto
 * ficam Terra, e o Cascalho e os Pisos de pedra viram Pedra (respostas do
 * mestre de 17/11/2026). `barrancoPorChao.test.ts` confere o grupo dos Pisos
 * de pedra contra o catálogo.
 */
export const MATERIAL_DO_CHAO: Readonly<Record<string, MaterialDoBarranco>> = {
  pedra: 'pedra',
  cascalho: 'pedra',
  paralelepipedo: 'pedra',
  marmore: 'pedra',
  'pedra-musgo': 'pedra',
  'laje-de-templo': 'pedra',
  'rocha-de-caverna': 'pedra',
  'basalto-hexagonal': 'pedra',
  'pedras-com-lama': 'pedra',
  'marmore-negro': 'pedra',
  'moldura-entalhada': 'pedra',
  areia: 'areia',
  duna: 'areia',
  neve: 'neve',
  grama: 'grama',
  'grama-escura': 'grama',
  terra: 'terra',
}

/** O material automático pelo id da textura do chão do lado alto (`null` = sem chão pintado). */
export function materialDoChao(idDaTextura: string | null | undefined): MaterialDoBarranco {
  if (idDaTextura === null || idDaTextura === undefined) return 'terra'
  return MATERIAL_DO_CHAO[idDaTextura] ?? 'terra'
}

/** O material que vale: o escolhido no painel ou, no Automático, o do chão do lado alto. */
export function materialDaEscolha(escolha: EscolhaDoMaterial, chaoNoAlto: string | null | undefined): MaterialDoBarranco {
  return escolha === 'automatico' ? materialDoChao(chaoNoAlto) : escolha
}
