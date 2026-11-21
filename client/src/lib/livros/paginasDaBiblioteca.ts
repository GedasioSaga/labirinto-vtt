import { ehCategoriaDeMunicao } from '../acervoDeItens'
import { normalizarParaBusca } from '../buscaNoLivro'
import { lerMecanica, type MecanicaV1 } from '../batalha/mecanica/modelo'
import { lerTipo } from '../batalha/tiposDaHabilidade'
import { ehDoAcervo, type EntradaDoAcervo } from './acervoNoLivro'
import { ehDoLivro, type EntradaParaFicha, type ItemDoCatalogo, type TipoDeEntrada } from './catalogo'

/**
 * A BIBLIOTECA EM DUAS PÁGINAS (Fase 1 de docs/design/habilidades/SISTEMA.md
 * §7, protótipo aprovado docs/design/habilidades/prototipo.html): o marcador
 * "Itens e habilidades" virou "Itens" e "Habilidades". Aqui fica o que é de
 * cada página (os tipos, a frase do topo, os filtros) e em que filtro cada
 * entrada cai. Puro: sem store, sem disco.
 */

export type PaginaDaBiblioteca = 'itens' | 'habilidades'

/** Os tipos de entrada de cada página. Arma fica em Itens; perícia, vantagem e desvantagem em Habilidades (decisão C10). */
export const TIPOS_DA_PAGINA: Readonly<Record<PaginaDaBiblioteca, readonly TipoDeEntrada[]>> = {
  itens: ['arma', 'item'],
  habilidades: ['habilidade', 'pericia', 'vantagem', 'desvantagem'],
}

/** O título e a frase do topo, palavra por palavra (decisão C11). */
export const TOPO_DA_PAGINA: Readonly<Record<PaginaDaBiblioteca, { titulo: string; frase: string }>> = {
  itens: {
    titulo: 'Itens',
    frase: 'As coisas que os personagens carregam e usam: poção, arma, granada, chave. Crie o item, diga o que ele faz, teste e dê a uma ficha.',
  },
  habilidades: {
    titulo: 'Habilidades',
    frase: 'Os golpes e poderes das fichas. Monte por um modelo, teste no boneco e ponha na ficha de quem vai usar.',
  },
}

export type FiltroDeHabilidade = 'todos' | 'ataque' | 'reacao' | 'condicao' | 'apoio' | 'livro'
export type FiltroDeItem = 'todos' | 'efeito' | 'armas' | 'consumiveis' | 'municao' | 'outros'
export type FiltroDaPagina = FiltroDeHabilidade | FiltroDeItem

/** Os filtros na ordem do protótipo (Reação logo depois de Ataque: decisão 4 das notas do protótipo). */
export const FILTROS_DA_PAGINA: Readonly<Record<PaginaDaBiblioteca, readonly { filtro: FiltroDaPagina; rotulo: string }[]>> = {
  habilidades: [
    { filtro: 'todos', rotulo: 'Tudo' },
    { filtro: 'ataque', rotulo: 'Ataque' },
    { filtro: 'reacao', rotulo: 'Reação' },
    { filtro: 'condicao', rotulo: 'Condição' },
    { filtro: 'apoio', rotulo: 'Cura e apoio' },
    { filtro: 'livro', rotulo: 'Do livro' },
  ],
  itens: [
    { filtro: 'todos', rotulo: 'Tudo' },
    { filtro: 'efeito', rotulo: 'Com efeito' },
    { filtro: 'armas', rotulo: 'Armas' },
    { filtro: 'consumiveis', rotulo: 'Consumíveis' },
    { filtro: 'municao', rotulo: 'Munição' },
    { filtro: 'outros', rotulo: 'Outros' },
  ],
}

/** O que a página lista: uma entrada do catálogo ou do livro, ou uma coisa do Acervo do app. */
export type EntradaDaBiblioteca = EntradaParaFicha | EntradaDoAcervo

/** As peças da entrada do catálogo; `null` = sem mecânica (ou torta, ou de app mais novo: vale o texto da entrada). */
export function pecasDaEntrada(entrada: EntradaDaBiblioteca): MecanicaV1 | null {
  if (ehDoAcervo(entrada) || ehDoLivro(entrada) || entrada.mecanica === undefined) return null
  const lida = lerMecanica(entrada.mecanica)
  return lida.tipo === 'pecas' ? lida.mecanica : null
}

/** A entrada do catálogo que tem mecânica guardada (mesmo torta): é a que o "Testar" roda. */
export function temMecanica(entrada: EntradaDaBiblioteca): entrada is ItemDoCatalogo & { mecanica: NonNullable<ItemDoCatalogo['mecanica']> } {
  return !ehDoAcervo(entrada) && !ehDoLivro(entrada) && entrada.mecanica !== undefined
}

const PALAVRAS_DE_CURA = /\b(cura|curar|recupera|regenera|revive|reviver|escudo|barreira|protege)\w*/u

/**
 * O grupo da habilidade. Com peças: dano = Ataque; cura, limpeza ou ajuda
 * (em si, num aliado) = Cura e apoio; só condição = Condição. Pelo texto:
 * o Tipo da ficha (Reação, Buff, Debuff) e, sem ele, o Dano escrito.
 */
export function grupoDaHabilidade(entrada: EntradaParaFicha): Exclude<FiltroDeHabilidade, 'todos'> {
  if (ehDoLivro(entrada)) return 'livro'
  const pecas = pecasDaEntrada(entrada)
  if (pecas !== null) {
    if (pecas.dano !== undefined) return 'ataque'
    const ajuda = pecas.alvo.quem === 'aliados' || pecas.alvo.quem === 'si' || pecas.efeitos.some((efeito) => efeito.tipo === 'cura' || efeito.tipo === 'tirarSelos')
    if (ajuda) return 'apoio'
    return pecas.efeitos.some((efeito) => efeito.tipo === 'selo') ? 'condicao' : 'ataque'
  }
  const { tipo, tambemReacao } = lerTipo({ campos: entrada.campos, mecanica: entrada.mecanica })
  if (tipo === 'reacao' || tambemReacao) return 'reacao'
  if (tipo === 'buff' || tipo === 'passiva') return 'apoio'
  if (tipo === 'debuff') return 'condicao'
  if ((entrada.campos.dano ?? '').trim().length > 0) return 'ataque'
  const texto = normalizarParaBusca([entrada.texto, ...Object.values(entrada.campos)].join(' '))
  return PALAVRAS_DE_CURA.test(texto) ? 'apoio' : 'ataque'
}

/** A categoria do Acervo da entrada (a da coisa ligada, no catálogo); `null` = sem coisa. */
function categoriaDaEntrada(entrada: EntradaDaBiblioteca, acervo: ReadonlyMap<string, { categoria: string }>): string | null {
  if (ehDoAcervo(entrada)) return entrada.acervo.categoria
  if (ehDoLivro(entrada) || entrada.acervoId === undefined) return null
  return acervo.get(entrada.acervoId)?.categoria ?? null
}

/** Os filtros da página Itens em que a entrada cai (além do Tudo): a categoria e, com mecânica, "Com efeito". */
export function filtrosDoItem(entrada: EntradaDaBiblioteca, acervo: ReadonlyMap<string, { categoria: string }>): ReadonlySet<FiltroDeItem> {
  const filtros = new Set<FiltroDeItem>()
  if (temMecanica(entrada)) filtros.add('efeito')
  const categoria = categoriaDaEntrada(entrada, acervo)
  const normal = categoria === null ? '' : normalizarParaBusca(categoria)
  if (entrada.tipo === 'arma') filtros.add('armas')
  else if (categoria !== null && ehCategoriaDeMunicao(categoria)) filtros.add('municao')
  else if (normal === 'consumivel' || normal === 'consumiveis') filtros.add('consumiveis')
  else filtros.add('outros')
  return filtros
}

/** A entrada cai no filtro da página? */
export function passaNoFiltro(pagina: PaginaDaBiblioteca, entrada: EntradaDaBiblioteca, filtro: FiltroDaPagina, acervo: ReadonlyMap<string, { categoria: string }>): boolean {
  if (filtro === 'todos') return true
  if (pagina === 'habilidades') return !ehDoAcervo(entrada) && grupoDaHabilidade(entrada) === filtro
  // O conjunto só guarda filtros de item: perguntar por um da outra página dá "não".
  const doItem: ReadonlySet<FiltroDaPagina> = filtrosDoItem(entrada, acervo)
  return doItem.has(filtro)
}
