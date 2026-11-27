import type { CondicaoPropria, RegraDaCondicao, TokenCondition } from '../../types/map'
import { CURA_REDUZIDA_PADRAO, DANO_DO_SANGRAMENTO, NOME_DA_CURA_REDUZIDA } from '../batalha/condicoes'
import { chaveDaCondicao } from '../condicaoPorNome'
import { CORES_DE_CONDICAO, lerCondicaoPropria } from '../condicoesProprias'
import type { GatilhoDaCondicao } from '../itens/modelo'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_ORDER } from '../tokenConditions'

/**
 * O CATÁLOGO DE CONDIÇÕES (sistema de itens refeito, docs/design/itens-rework/PLANO.md §1.5,
 * decisão 10; etapa E4a). Um lugar só diz o que cada condição É: o nome, a pastilha e a regra
 * (vida, cura ou narra) com o número dela. A condição POSTA em alguém mora na ficha
 * (`Personagem.condicoes`, `lib/condicoes/naFicha.ts`) e aponta para cá pelo `condId`.
 *
 * Duas origens:
 *  - as de FÁBRICA: as seis pastilhas de sempre (`TokenCondition`, o id é o mesmo) mais
 *    Sangrando, Queimando e Cura reduzida, que até aqui só existiam como selo da batalha;
 *  - as CRIADAS pelo mestre (`CondicaoPropria`, `stores/condicoesPropriasStore.ts`), com a regra
 *    que ele escolheu (ausente = narra).
 *
 * Mesmo nome nas duas: a de fábrica vence na lista (a regra de `marcaDoNome`), mas a criada
 * continua achada pelo id, para a ficha que já a leva não perder a marca.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** A pastilha da condição: uma de fábrica (desenho de `TOKEN_CONDITION_SYMBOLS`) ou no molde das criadas (cor e desenho da biblioteca). */
export type PastilhaDoCatalogo = { tipo: 'fabrica'; condicao: TokenCondition } | { tipo: 'propria'; condicao: CondicaoPropria }

export interface CondicaoDoCatalogo {
  /** O `condId` que a ficha guarda. */
  id: string
  nome: string
  regra: RegraDaCondicao
  /** Vida por vez (`vida`) ou % da cura cortada (`cura`); 0 em `narra`. A condição posta pode trazer o próprio (`CondicaoNaFicha.n`). */
  n: number
  pastilha: PastilhaDoCatalogo
  /** Criada pelo mestre (pode ser editada e apagada); `false` = de fábrica. */
  criada: boolean
  /** Pedido de 26/11: o "depois de X turnos" da criada (`CondicaoPropria.gatilho`). As de fábrica não têm: o gatilho delas vem da peça que as põe. */
  gatilho?: GatilhoDaCondicao
}

/** Queimando tira o mesmo que a tabela dos selos da batalha (`COMPORTAMENTOS_DOS_SELOS`, `lib/batalha/condicoes.ts`). */
const VIDA_DO_QUEIMANDO = 10
/** Envenenado não tinha número de fábrica (o prazo de cada armadilha trazia o seu); 3 é o do protótipo aprovado. */
const VIDA_DO_ENVENENADO = 3

/** A regra das seis de sempre: só o Envenenado tira vida. */
const REGRA_DAS_PASTILHAS: Record<TokenCondition, { regra: RegraDaCondicao; n: number }> = {
  envenenado: { regra: 'vida', n: VIDA_DO_ENVENENADO },
  caido: { regra: 'narra', n: 0 },
  dormindo: { regra: 'narra', n: 0 },
  atordoado: { regra: 'narra', n: 0 },
  invisivel: { regra: 'narra', n: 0 },
  lento: { regra: 'narra', n: 0 },
}

function corDaPaleta(nome: string): string {
  return CORES_DE_CONDICAO.find((cor) => cor.nome === nome)?.valor ?? CORES_DE_CONDICAO[0].valor
}

/**
 * As três que nasceram selo: pastilha no molde das criadas (cor da paleta e desenho da
 * biblioteca), para o mapa e a tela de quem joga as desenharem sem nada novo.
 */
const NOVAS_DE_FABRICA: readonly CondicaoDoCatalogo[] = [
  {
    id: 'sangrando',
    nome: 'Sangrando',
    regra: 'vida',
    n: DANO_DO_SANGRAMENTO,
    pastilha: { tipo: 'propria', condicao: { id: 'sangrando', nome: 'Sangrando', cor: corDaPaleta('Vermelho'), simbolo: 'gota' } },
    criada: false,
  },
  {
    id: 'queimando',
    nome: 'Queimando',
    regra: 'vida',
    n: VIDA_DO_QUEIMANDO,
    pastilha: { tipo: 'propria', condicao: { id: 'queimando', nome: 'Queimando', cor: corDaPaleta('Laranja'), simbolo: 'chama' } },
    criada: false,
  },
  {
    id: 'cura-reduzida',
    nome: NOME_DA_CURA_REDUZIDA,
    regra: 'cura',
    n: CURA_REDUZIDA_PADRAO,
    pastilha: { tipo: 'propria', condicao: { id: 'cura-reduzida', nome: NOME_DA_CURA_REDUZIDA, cor: corDaPaleta('Rosa'), simbolo: 'cruz' } },
    criada: false,
  },
]

/** As de fábrica, na ordem da lista: as seis pastilhas de sempre, depois as três que eram só selo. */
export const CONDICOES_DE_FABRICA: readonly CondicaoDoCatalogo[] = [
  ...TOKEN_CONDITION_ORDER.map((condicao): CondicaoDoCatalogo => ({
    id: condicao,
    nome: TOKEN_CONDITION_LABELS[condicao],
    ...REGRA_DAS_PASTILHAS[condicao],
    pastilha: { tipo: 'fabrica', condicao },
    criada: false,
  })),
  ...NOVAS_DE_FABRICA,
]

const DE_FABRICA_POR_ID: ReadonlyMap<string, CondicaoDoCatalogo> = new Map(CONDICOES_DE_FABRICA.map((condicao) => [condicao.id, condicao]))
const CHAVES_DE_FABRICA: ReadonlySet<string> = new Set(CONDICOES_DE_FABRICA.map((condicao) => chaveDaCondicao(condicao.nome)))

/** Uma condição criada no formato do catálogo. Sem regra = o mestre narra. */
export function condicaoCriadaNoCatalogo(propria: CondicaoPropria): CondicaoDoCatalogo {
  const regra = propria.regra ?? 'narra'
  const base: CondicaoDoCatalogo = { id: propria.id, nome: propria.nome, regra, n: regra === 'narra' ? 0 : (propria.n ?? 0), pastilha: { tipo: 'propria', condicao: propria }, criada: true }
  return propria.gatilho === undefined ? base : { ...base, gatilho: propria.gatilho }
}

/**
 * A lista para escolher (a tela Condições e o "Pôr condição"): as de fábrica e depois as
 * criadas, na ordem do mestre. A criada com nome de uma de fábrica fica de fora da lista.
 */
export function catalogoDeCondicoes(criadas: readonly CondicaoPropria[]): CondicaoDoCatalogo[] {
  const lista = [...CONDICOES_DE_FABRICA]
  const vistas = new Set(CHAVES_DE_FABRICA)
  for (const crua of criadas) {
    const propria = lerCondicaoPropria(crua)
    if (propria === null || DE_FABRICA_POR_ID.has(propria.id)) continue
    const chave = chaveDaCondicao(propria.nome)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    lista.push(condicaoCriadaNoCatalogo(propria))
  }
  return lista
}

/** A condição de um `condId`: de fábrica, ou criada. `null` = a criada foi apagada (a ficha a guarda, ninguém a desenha). */
export function condicaoDoCatalogo(condId: string, criadas: readonly CondicaoPropria[]): CondicaoDoCatalogo | null {
  const deFabrica = DE_FABRICA_POR_ID.get(condId)
  if (deFabrica !== undefined) return deFabrica
  const propria = criadas.find((candidata) => candidata.id === condId)
  const lida = propria === undefined ? null : lerCondicaoPropria(propria)
  return lida === null ? null : condicaoCriadaNoCatalogo(lida)
}

/**
 * A condição de um NOME ("caido", "Cura reduzida", "Ferida por prata" não): a de fábrica vence,
 * depois a primeira criada de mesmo nome. É a ponte com o que ainda guarda condição pelo nome
 * (o prazo do token, o selo da batalha). `null` = nome fora do catálogo.
 */
export function condicaoDoCatalogoPeloNome(nome: string, criadas: readonly CondicaoPropria[]): CondicaoDoCatalogo | null {
  const chave = chaveDaCondicao(nome)
  if (chave === '') return null
  const deFabrica = CONDICOES_DE_FABRICA.find((condicao) => chaveDaCondicao(condicao.nome) === chave)
  if (deFabrica !== undefined) return deFabrica
  const propria = criadas.find((candidata) => chaveDaCondicao(candidata.nome) === chave)
  const lida = propria === undefined ? null : lerCondicaoPropria(propria)
  return lida === null ? null : condicaoCriadaNoCatalogo(lida)
}
