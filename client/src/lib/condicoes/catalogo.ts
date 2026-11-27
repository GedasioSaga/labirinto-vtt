import type { CondicaoPropria, RegraDaCondicao, TokenCondition } from '../../types/map'
import { lerCondicaoPropria } from '../condicoesProprias'
import type { GatilhoDaCondicao } from '../itens/modelo'
import { condicaoDaFabrica, condicaoDaFabricaPeloApelido, ehDaFabrica, ehDeHoje, IDS_DE_HOJE, LISTA_DA_FABRICA, pastilhaDaFabrica, pastilhaDeFabricaDoMapa, type CondicaoDeFabrica } from './fabrica'
import { chaveDaCondicao, type CondicaoMontada } from './modelo'
import { gatilhoDeHoje, montarCondicao, regraDeHoje } from './montadaDaAntiga'

/**
 * O CATÁLOGO DE CONDIÇÕES (sistema de itens refeito, docs/design/itens-rework/PLANO.md §1.5,
 * decisão 10; etapa E4a). Um lugar só diz o que cada condição É: o nome, a pastilha e a regra
 * (vida, cura ou narra) com o número dela. A condição POSTA em alguém mora na ficha
 * (`Personagem.condicoes`, `lib/condicoes/naFicha.ts`) e aponta para cá pelo `condId`.
 *
 * Rework das condições (docs/design/condicoes-rework/PLANO.md §2 e D5, E1): toda condição vem MONTADA
 * (`montada`: o tipo, as peças, o prazo e as saídas), e a `regra` e o `n` de antes saem dela
 * (`regraDeHoje`) para quem ainda os lê (a ficha fora da batalha). A criada de antes, sem peças, guarda a
 * regra e o número dela como estavam.
 *
 * Duas origens:
 *  - as 35 de FÁBRICA (`lib/condicoes/fabrica.ts`): as 10 de antes do rework, com o mesmo id e na mesma
 *    ordem (as seis pastilhas de sempre, `TokenCondition`, com o desenho do mapa; Sangrando, Queimando,
 *    Cura reduzida e Fadiga), e depois as 25 novas (`nova`);
 *  - as CRIADAS pelo mestre (`CondicaoPropria`, `stores/condicoesPropriasStore.ts`).
 *
 * Mesmo nome (D5): a de fábrica de antes vence a criada (a criada sai da lista, como era); a criada vence
 * as 25 novas (a nova sai da lista, `sombreada`, e só aparece para "Usar como modelo"). Pelo id, cada uma
 * continua achada: a ficha que já a leva não perde a marca.
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
  /** O "depois de X turnos" da condição (a peça Gatilho; na criada de antes, `CondicaoPropria.gatilho`). Ausente = nenhum. */
  gatilho?: GatilhoDaCondicao
  /** Rework das condições: a condição montada (o tipo, as peças, o prazo e as saídas), o que as frases, a tradução e o boneco leem. */
  montada: CondicaoMontada
  /** Uma das 25 de fábrica que o rework trouxe (as 10 de antes não têm). */
  nova?: true
  /** De fábrica com o nome de uma criada: a criada vale pelo nome (D5); esta só aparece com `comSombreadas` ("Usar como modelo"). */
  sombreada?: true
}

/** As opções da lista. */
export interface OpcoesDoCatalogo {
  /** Põe também as de fábrica que uma criada de mesmo nome encobre, marcadas `sombreada` (o "(de fábrica)" do "Usar como modelo"). */
  comSombreadas?: boolean
}

/** Uma de fábrica no formato do catálogo: as seis de sempre com o desenho do mapa; as outras no molde das criadas. */
function deFabricaNoCatalogo(condicao: CondicaoDeFabrica): CondicaoDoCatalogo {
  const doMapa = pastilhaDeFabricaDoMapa(condicao.id)
  const gatilho = gatilhoDeHoje(condicao)
  const base: CondicaoDoCatalogo = {
    id: condicao.id,
    nome: condicao.nome,
    ...regraDeHoje(condicao),
    pastilha: doMapa === null ? { tipo: 'propria', condicao: pastilhaDaFabrica(condicao) } : { tipo: 'fabrica', condicao: doMapa },
    criada: false,
    montada: { id: condicao.id, nome: condicao.nome, tipo: condicao.tipo, pecas: condicao.pecas, prazo: condicao.prazo, saidas: condicao.saidas },
  }
  if (gatilho !== undefined) base.gatilho = gatilho
  if (!ehDeHoje(condicao.id)) base.nova = true
  return base
}

/** As 10 de antes, na ordem da lista de hoje (`IDS_DE_HOJE`: as seis pastilhas, Sangrando, Queimando, Cura reduzida, Fadiga). */
const DE_ANTES: readonly CondicaoDeFabrica[] = IDS_DE_HOJE.flatMap((id) => {
  const condicao = condicaoDaFabrica(id)
  return condicao === null ? [] : [condicao]
})

/** As 35 de fábrica: as 10 de antes primeiro (a lista de hoje não muda de lugar), depois as 25 novas na ordem do protótipo. */
export const CONDICOES_DE_FABRICA: readonly CondicaoDoCatalogo[] = [...DE_ANTES, ...LISTA_DA_FABRICA.filter((condicao) => !ehDeHoje(condicao.id))].map(deFabricaNoCatalogo)

const DE_FABRICA_POR_ID: ReadonlyMap<string, CondicaoDoCatalogo> = new Map(CONDICOES_DE_FABRICA.map((condicao) => [condicao.id, condicao]))
/** As chaves dos nomes das 10 de antes: a criada com um destes nomes fica de fora da lista (como era). */
const CHAVES_DE_ANTES: ReadonlySet<string> = new Set(DE_ANTES.map((condicao) => chaveDaCondicao(condicao.nome)))

/** Uma condição criada no formato do catálogo. A de antes (sem peças) guarda a regra e o número dela; a com peças os tira das peças. */
export function condicaoCriadaNoCatalogo(propria: CondicaoPropria): CondicaoDoCatalogo {
  const montada = montarCondicao(propria)
  const regraDeAntes = propria.regra ?? 'narra'
  const deHoje = propria.pecas === undefined ? { regra: regraDeAntes, n: regraDeAntes === 'narra' ? 0 : (propria.n ?? 0) } : regraDeHoje(montada)
  const gatilho = propria.pecas === undefined ? propria.gatilho : gatilhoDeHoje(montada)
  const base: CondicaoDoCatalogo = { id: propria.id, nome: propria.nome, ...deHoje, pastilha: { tipo: 'propria', condicao: propria }, criada: true, montada }
  return gatilho === undefined ? base : { ...base, gatilho }
}

/** As criadas que entram na lista: lidas, sem as tortas, sem id de fábrica, sem o nome de uma de antes e sem repetir nome (vale a 1ª, na ordem do mestre). */
function criadasDaLista(criadas: readonly CondicaoPropria[]): CondicaoPropria[] {
  const lidas: CondicaoPropria[] = []
  const vistas = new Set(CHAVES_DE_ANTES)
  for (const crua of criadas) {
    const propria = lerCondicaoPropria(crua)
    if (propria === null || ehDaFabrica(propria.id)) continue
    const chave = chaveDaCondicao(propria.nome)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    lidas.push(propria)
  }
  return lidas
}

/**
 * A lista para escolher (a tela Condições e o "Pôr condição"): as de fábrica e depois as criadas, na
 * ordem do mestre. A criada com o nome de uma de fábrica de antes fica de fora (como era); a de fábrica
 * nova com o nome de uma criada fica de fora (D5), ou entra marcada `sombreada` com `comSombreadas`.
 */
export function catalogoDeCondicoes(criadas: readonly CondicaoPropria[], opcoes: OpcoesDoCatalogo = {}): CondicaoDoCatalogo[] {
  const valem = criadasDaLista(criadas)
  const chavesDasCriadas = new Set(valem.map((propria) => chaveDaCondicao(propria.nome)))
  const lista: CondicaoDoCatalogo[] = []
  for (const condicao of CONDICOES_DE_FABRICA) {
    const encoberta = condicao.nova === true && chavesDasCriadas.has(chaveDaCondicao(condicao.nome))
    if (!encoberta) lista.push(condicao)
    else if (opcoes.comSombreadas === true) lista.push({ ...condicao, sombreada: true })
  }
  for (const propria of valem) lista.push(condicaoCriadaNoCatalogo(propria))
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
 * A condição de um NOME ("caido", "Cura reduzida", "Congelado"). Precedência (D5): a de fábrica de antes
 * do rework; depois a primeira criada de mesmo nome; depois a de fábrica nova; por fim o apelido de uma
 * de fábrica ("Atordoada", "Ferida por prata", "Eletrizado"). É a ponte com o que ainda guarda condição
 * pelo nome (o prazo do token, o selo da batalha). `null` = nome fora do catálogo.
 */
export function condicaoDoCatalogoPeloNome(nome: string, criadas: readonly CondicaoPropria[]): CondicaoDoCatalogo | null {
  const chave = chaveDaCondicao(nome)
  if (chave === '') return null
  const deFabrica = CONDICOES_DE_FABRICA.find((condicao) => chaveDaCondicao(condicao.nome) === chave)
  if (deFabrica !== undefined && deFabrica.nova !== true) return deFabrica
  const propria = criadas.find((candidata) => chaveDaCondicao(candidata.nome) === chave)
  const lida = propria === undefined ? null : lerCondicaoPropria(propria)
  if (lida !== null) return condicaoCriadaNoCatalogo(lida)
  if (deFabrica !== undefined) return deFabrica
  const peloApelido = condicaoDaFabricaPeloApelido(nome)
  return peloApelido === null ? null : (DE_FABRICA_POR_ID.get(peloApelido.id) ?? null)
}
