import { categoriaDaMecanica } from '../batalha/mecanica/categoria'
import { lerTipo } from '../batalha/tiposDaHabilidade'
import { normalizarParaBusca } from '../buscaNoLivro'
import { cartoesDaAba, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { ehDoAcervo } from './acervoNoLivro'
import { abaDeDestino, chaveDoNomeDaEntrada, ehDoLivro, type TipoDeEntrada } from './catalogo'
import { filtrosDoItem, grupoDaHabilidade, pecasDaEntrada, type EntradaDaBiblioteca, type PaginaDaBiblioteca } from './paginasDaBiblioteca'

/**
 * A BIBLIOTECA ORGANIZADA (protótipo aprovado em 23/11, docs/design/biblioteca/):
 * a lista agrupada por UM eixo, o que a coisa é (Ataque, Apoio, Reação,
 * Passiva e, do livro, Perícias, Vantagens, Desvantagens; nos Itens, Armas,
 * Consumíveis, Munição, Outros). De onde ela está (em fichas ou só no livro)
 * mora na coluna Fichas, contada aqui por `donosDasEntradas`.
 *
 * Puro: sem store, sem disco.
 */

export type GrupoDaBiblioteca = 'ataque' | 'apoio' | 'reacao' | 'passiva' | 'pericia' | 'vantagem' | 'desvantagem' | 'arma' | 'consumivel' | 'municao' | 'outro'

export interface DadosDoGrupo {
  id: GrupoDaBiblioteca
  nome: string
  /** A frase curta ao lado do nome do grupo ("golpes contra inimigos, com ou sem dano"). */
  dica: string
  /** Vem do livro de regras do sistema (perícia, vantagem, desvantagem): fica depois do fio. */
  doLivro: boolean
}

/** Os grupos de cada página, na ordem da lista (as do livro depois do fio "Do livro de regras do sistema"). */
export const GRUPOS_DA_PAGINA: Readonly<Record<PaginaDaBiblioteca, readonly DadosDoGrupo[]>> = {
  habilidades: [
    { id: 'ataque', nome: 'Ataque', dica: 'golpes contra inimigos, com ou sem dano', doLivro: false },
    { id: 'apoio', nome: 'Apoio', dica: 'cura, buff e forma, em si ou num aliado', doLivro: false },
    { id: 'reacao', nome: 'Reação', dica: 'no lugar do d20, quando atacam', doLivro: false },
    { id: 'passiva', nome: 'Passiva', dica: 'ligam sozinhas; o app lê a descrição', doLivro: false },
    { id: 'pericia', nome: 'Perícias', dica: 'teste de um atributo', doLivro: true },
    { id: 'vantagem', nome: 'Vantagens', dica: 'vantagem em testes', doLivro: true },
    { id: 'desvantagem', nome: 'Desvantagens', dica: 'desvantagem ou interpretação', doLivro: true },
  ],
  itens: [
    { id: 'arma', nome: 'Armas', dica: 'o Atacar da ficha usa', doLivro: false },
    { id: 'consumivel', nome: 'Consumíveis', dica: 'gastam ao usar', doLivro: false },
    { id: 'municao', nome: 'Munição', dica: 'a arma de fogo gasta', doLivro: false },
    { id: 'outro', nome: 'Outros', dica: 'ferramentas, chaves, mapas', doLivro: false },
  ],
}

const GRUPO_DO_LIVRO: Readonly<Partial<Record<TipoDeEntrada, GrupoDaBiblioteca>>> = { pericia: 'pericia', vantagem: 'vantagem', desvantagem: 'desvantagem' }

/**
 * Em que grupo da lista a entrada cai. Habilidade com peças: a reação (só nela
 * ou também na vez) é Reação; ajuda e cura são Apoio; o resto, Ataque (a
 * condição sem dano também é golpe contra inimigo). Sem peças: o Tipo da ficha
 * (Passiva, Reação, Buff) e, sem ele, o que o texto diz.
 */
export function grupoNaBiblioteca(entrada: EntradaDaBiblioteca, acervo: ReadonlyMap<string, { categoria: string }>): GrupoDaBiblioteca {
  if (entrada.tipo === 'arma' || entrada.tipo === 'item' || ehDoAcervo(entrada)) {
    const filtros = filtrosDoItem(entrada, acervo)
    if (filtros.has('armas')) return 'arma'
    if (filtros.has('municao')) return 'municao'
    if (filtros.has('consumiveis')) return 'consumivel'
    return 'outro'
  }
  const doLivro = GRUPO_DO_LIVRO[entrada.tipo]
  if (doLivro !== undefined) return doLivro
  const pecas = pecasDaEntrada(entrada)
  if (pecas !== null) {
    if (categoriaDaMecanica(pecas) === 'reacao') return 'reacao'
    return grupoDaHabilidade(entrada) === 'apoio' ? 'apoio' : 'ataque'
  }
  if (!ehDoLivro(entrada) && lerTipo({ campos: entrada.campos, mecanica: entrada.mecanica }).tipo === 'passiva') return 'passiva'
  const grupo = grupoDaHabilidade(entrada)
  if (grupo === 'reacao' || grupo === 'apoio') return grupo
  return 'ataque'
}

/** Quem pode receber, nos grupos da coluna Fichas: jogadores, NPCs de combate e os de cenário (as variações herdam do modelo). */
export interface GrupoDeFichas {
  rotulo: string
  fichas: Personagem[]
}

type VagaDaMochila = NonNullable<Personagem['mochila']>[number]

/** A vaga pela chave que a liga a uma entrada: a coisa do Acervo pelo `itemId`; a vaga solta, pelo nome. */
function chaveDaVaga(vaga: Pick<VagaDaMochila, 'itemId' | 'nome'>): string {
  return vaga.itemId === undefined ? `nome:${chaveDoNomeDaEntrada(vaga.nome)}` : `id:${vaga.itemId}`
}

/**
 * A vaga da mochila que é desta entrada, pela mesma chave: a coisa do Acervo
 * (ou a ligada à regra) pelo `itemId`; o item solto do livro pelo nome, numa
 * vaga sem `itemId` (é assim que o "Dar" o põe, `itemParaDarDaRegra`).
 * `null` = a entrada não vai para a mochila (habilidade, arma solta, o livro).
 */
function chaveDaVagaDaEntrada(entrada: EntradaDaBiblioteca): string | null {
  if (ehDoAcervo(entrada)) return `id:${entrada.acervo.id}`
  if (ehDoLivro(entrada)) return null
  if (entrada.acervoId !== undefined) return `id:${entrada.acervoId}`
  return entrada.tipo === 'item' ? `nome:${chaveDoNomeDaEntrada(entrada.nome)}` : null
}

/** A vaga é desta entrada? (o "Tirar da ficha" tira estas; `donosDasEntradas` conta por elas). */
export function vagaDaEntrada(entrada: EntradaDaBiblioteca, vaga: Pick<VagaDaMochila, 'itemId' | 'nome'>): boolean {
  const chave = chaveDaVagaDaEntrada(entrada)
  return chave !== null && chave === chaveDaVaga(vaga)
}

/** O que cada ficha tem, lido uma vez: os nomes de cada aba (sem acento, sem caixa) e as chaves das vagas da mochila. */
interface OQueAFichaTem {
  nomesPorAba: Map<string, Set<string>>
  naMochila: Set<string>
}

function lerFicha(personagem: Personagem, abas: readonly string[]): OQueAFichaTem {
  const nomesPorAba = new Map<string, Set<string>>()
  for (const abaId of abas) nomesPorAba.set(abaId, new Set(cartoesDaAba(personagem, abaId).map((cartao) => chaveDoNomeDaEntrada(cartao.nome))))
  return { nomesPorAba, naMochila: new Set((personagem.mochila ?? []).map(chaveDaVaga)) }
}

/**
 * QUEM TEM CADA ENTRADA (a coluna Fichas, as bolinhas da linha e o "Quem tem"
 * do papel): a entrada do livro está na ficha quando a aba de destino tem um
 * cartão de mesmo nome (a mesma regra do "Já está em"); a coisa do Acervo e o
 * item, quando a mochila tem uma vaga dele (`vagaDaEntrada`); a arma ligada a
 * uma coisa vale pelas duas. Devolve, por id da entrada, as fichas na ordem
 * recebida.
 */
export function donosDasEntradas(entradas: readonly EntradaDaBiblioteca[], fichas: readonly Personagem[], sistema: SistemaDeRpg): Map<string, Personagem[]> {
  const abaPorTipo = new Map<TipoDeEntrada, string>()
  for (const entrada of entradas) {
    if (ehDoAcervo(entrada) || abaPorTipo.has(entrada.tipo)) continue
    const aba = abaDeDestino(sistema, entrada.tipo)
    if (aba !== undefined) abaPorTipo.set(entrada.tipo, aba.id)
  }
  const lidas = fichas.map((ficha) => ({ ficha, tem: lerFicha(ficha, [...abaPorTipo.values()]) }))
  const donos = new Map<string, Personagem[]>()
  for (const entrada of entradas) {
    const naMochila = chaveDaVagaDaEntrada(entrada)
    const abaId = ehDoAcervo(entrada) ? undefined : abaPorTipo.get(entrada.tipo)
    const nome = chaveDoNomeDaEntrada(entrada.nome)
    const quem: Personagem[] = []
    for (const { ficha, tem } of lidas) {
      const temOCartao = abaId !== undefined && tem.nomesPorAba.get(abaId)?.has(nome) === true
      if (temOCartao || (naMochila !== null && tem.naMochila.has(naMochila))) quem.push(ficha)
    }
    donos.set(entrada.id, quem)
  }
  return donos
}

/**
 * A IMAGEM DA LINHA da lista (BUG do dono, 25/11: a Rosa Fúnebre tinha foto na
 * aba Armas da ficha e a lista só mostrava o ícone). A entrada do catálogo não
 * guarda imagem: quem a tem é o CARTÃO na ficha (`cartao.imagem`, o mesmo campo
 * que a aba mostra). Vale o primeiro cartão com imagem de quem tem a entrada
 * (`donos`, de `donosDasEntradas`), achado pela mesma regra (mesmo nome na aba
 * de destino) ou pela ligação (`itemId` = `acervoId`); sem ele, a foto da coisa
 * do Acervo ligada; a coisa do Acervo usa a sua. Só arma e item (a habilidade
 * segue com o ícone do golpe). `null` = sem imagem: a linha fica com o ícone.
 */
export function imagemDaEntrada(entrada: EntradaDaBiblioteca, donos: readonly Personagem[], sistema: SistemaDeRpg, acervo: ReadonlyMap<string, { imagem: string | null }>): string | null {
  if (ehDoAcervo(entrada)) return entrada.acervo.imagem
  if (ehDoLivro(entrada) || (entrada.tipo !== 'arma' && entrada.tipo !== 'item')) return null
  const aba = abaDeDestino(sistema, entrada.tipo)
  if (aba !== undefined) {
    const nome = chaveDoNomeDaEntrada(entrada.nome)
    const ehDela = (cartao: { nome: string; itemId?: string }) => (entrada.acervoId !== undefined && cartao.itemId === entrada.acervoId) || chaveDoNomeDaEntrada(cartao.nome) === nome
    for (const ficha of donos) {
      const cartao = cartoesDaAba(ficha, aba.id).find((atual) => atual.imagem !== null && ehDela(atual))
      if (cartao !== undefined) return cartao.imagem
    }
  }
  return entrada.acervoId === undefined ? null : (acervo.get(entrada.acervoId)?.imagem ?? null)
}

export type OrdemDaBiblioteca = 'livro' | 'nome' | 'fichas' | 'sp'

export const ORDENS_DA_BIBLIOTECA: readonly { ordem: OrdemDaBiblioteca; rotulo: string }[] = [
  { ordem: 'livro', rotulo: 'Como no livro' },
  { ordem: 'nome', rotulo: 'Nome, de A a Z' },
  { ordem: 'fichas', rotulo: 'Em mais fichas primeiro' },
  { ordem: 'sp', rotulo: 'Mais SP primeiro' },
]

const NUMERO_DO_SP = /(\d+)\s*(?:de\s+)?sp\b/u

/** O SP que a entrada gasta ao usar: o das peças, ou o escrito no Custo ("35 de SP"); `null` = não gasta SP (ou não diz). */
export function spDaEntrada(entrada: EntradaDaBiblioteca): number | null {
  const pecas = pecasDaEntrada(entrada)
  if (pecas !== null) {
    const custo = pecas.custos.find((atual) => atual.quando === 'aoUsar' && atual.recurso === 'sp')
    return custo !== undefined && 'fixo' in custo.quanto ? custo.quanto.fixo : null
  }
  if (ehDoAcervo(entrada) || ehDoLivro(entrada)) return null
  const achado = normalizarParaBusca(entrada.campos.custo ?? '').match(NUMERO_DO_SP)
  return achado === null ? null : Number(achado[1])
}

/**
 * A lista na ordem escolhida. "Como no livro" mantém a ordem recebida; as
 * outras ordenam dentro do grupo (os grupos têm ordem própria na tela), com o
 * nome como desempate para a lista não pular entre duas leituras.
 */
export function ordenarNaBiblioteca<T extends EntradaDaBiblioteca>(entradas: readonly T[], ordem: OrdemDaBiblioteca, quantosDonos: (entrada: T) => number): T[] {
  const lista = [...entradas]
  if (ordem === 'livro') return lista
  const porNome = (a: T, b: T) => a.nome.localeCompare(b.nome, 'pt-BR')
  if (ordem === 'nome') return lista.sort(porNome)
  if (ordem === 'fichas') return lista.sort((a, b) => quantosDonos(b) - quantosDonos(a) || porNome(a, b))
  return lista.sort((a, b) => (spDaEntrada(b) ?? -1) - (spDaEntrada(a) ?? -1) || porNome(a, b))
}
