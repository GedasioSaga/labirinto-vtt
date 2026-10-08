import { CATALOGOS_DO_LIVRO, type ChaveDoCatalogo } from './livroDeRegras'
import { textoSemMarcacao } from './marcacaoLeve'
import type { CapituloDoLivro, CatalogosDoSistema } from './sistemaDeRpg'

/**
 * BUSCA DO LIVRO DE REGRAS: procura a frase nos capítulos e nos catálogos sem
 * ligar para acento nem maiúscula ("pericia" acha "Perícia") — quem digita no
 * celular raramente põe acento. Os espaços (inclusive quebra de linha) contam
 * como um só.
 */

/** Consulta com menos que isto (já sem acento e espaço) não busca: "a" acharia o livro inteiro. */
export const BUSCA_MINIMO = 2
/** Quantos achados de cada grupo a busca devolve. */
export const BUSCA_MAX_POR_GRUPO = 30
/** Caracteres de contexto de cada lado do trecho achado. */
const CONTEXTO = 60

const MARCA_DE_ACENTO = /\p{M}/gu
const ESPACO = /\s/u

/** Sem acento, minúsculo e com cada sequência de espaços virando um espaço só. */
export function normalizarParaBusca(texto: string): string {
  return texto.normalize('NFD').replace(MARCA_DE_ACENTO, '').toLowerCase().replace(/\s+/gu, ' ').trim()
}

/**
 * O texto normalizado E, para cada caractere dele, a posição de onde veio no
 * original: a busca acha na versão sem acento e recorta o trecho do original,
 * com acento. Normalizar caractere por caractere é o que deixa a conta exata
 * ("é" vira "e", espaços seguidos viram um, o emoji ocupa duas unidades).
 */
export interface TextoIndexado {
  original: string
  normalizado: string
  posicoes: number[]
}

export function indexarTexto(original: string): TextoIndexado {
  let normalizado = ''
  const posicoes: number[] = []
  let indice = 0
  for (const caractere of original) {
    const parte = ESPACO.test(caractere) ? ' ' : caractere.normalize('NFD').replace(MARCA_DE_ACENTO, '').toLowerCase()
    for (const unidade of parte) {
      // Espaços seguidos contam como um: "dano\n\nfísico" acha "dano físico".
      if (unidade === ' ' && normalizado.endsWith(' ')) continue
      normalizado += unidade
      for (let k = 0; k < unidade.length; k += 1) posicoes.push(indice)
    }
    indice += caractere.length
  }
  return { original, normalizado, posicoes }
}

/** O trecho achado e um pouco de cada lado, numa linha só ("…" onde cortou). */
export interface TrechoAchado {
  antes: string
  achado: string
  depois: string
}

function umaLinha(texto: string): string {
  return texto.replace(/\s+/gu, ' ')
}

function trechoEm(indexado: TextoIndexado, posicao: number, tamanho: number): TrechoAchado {
  const { original, posicoes } = indexado
  const inicio = posicoes[posicao]
  const proximo = posicao + tamanho
  const fim = proximo < posicoes.length ? posicoes[proximo] : original.length
  const de = Math.max(0, inicio - CONTEXTO)
  const ate = Math.min(original.length, fim + CONTEXTO)
  return {
    antes: `${de > 0 ? '…' : ''}${umaLinha(original.slice(de, inicio)).trimStart()}`,
    achado: umaLinha(original.slice(inicio, fim)),
    depois: `${umaLinha(original.slice(fim, ate)).trimEnd()}${ate < original.length ? '…' : ''}`,
  }
}

/** Quantas vezes a consulta aparece (sem sobreposição). */
function contar(normalizado: string, consulta: string): number {
  let vezes = 0
  for (let at = normalizado.indexOf(consulta); at !== -1; at = normalizado.indexOf(consulta, at + consulta.length)) vezes += 1
  return vezes
}

/** Os pedaços de um texto com a consulta marcada: o leitor pinta os achados do capítulo aberto pela busca. */
export function partesComDestaque(texto: string, consultaNormalizada: string): { texto: string; achado: boolean }[] {
  if (consultaNormalizada.length < BUSCA_MINIMO) return [{ texto, achado: false }]
  const indexado = indexarTexto(texto)
  const partes: { texto: string; achado: boolean }[] = []
  let desde = 0
  for (let at = indexado.normalizado.indexOf(consultaNormalizada); at !== -1; at = indexado.normalizado.indexOf(consultaNormalizada, at + consultaNormalizada.length)) {
    const inicio = indexado.posicoes[at]
    const proximo = at + consultaNormalizada.length
    const fim = proximo < indexado.posicoes.length ? indexado.posicoes[proximo] : texto.length
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), achado: false })
    partes.push({ texto: texto.slice(inicio, fim), achado: true })
    desde = fim
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), achado: false })
  return partes
}

/** Um item de qualquer catálogo, como a busca e a lista o veem. */
export interface ItemDoLivro {
  nome: string
  descricao?: string
  efeito?: string
  atributos?: string[]
}

/** Os itens de um catálogo; catálogo ausente = lista vazia. */
export function itensDoCatalogo(catalogos: CatalogosDoSistema | undefined, chave: ChaveDoCatalogo): readonly ItemDoLivro[] {
  return catalogos === undefined ? [] : catalogos[chave]
}

/** O que a busca precisa de cada capítulo e item, indexado uma vez só (a busca roda a cada tecla). */
export interface IndiceDoLivro {
  capitulos: { capitulo: CapituloDoLivro; titulo: string; texto: TextoIndexado }[]
  itens: { chave: ChaveDoCatalogo; item: ItemDoLivro; nome: string; texto: TextoIndexado }[]
}

export function indexarLivro(livro: readonly CapituloDoLivro[], catalogos: CatalogosDoSistema | undefined): IndiceDoLivro {
  return {
    capitulos: livro.map((capitulo) => ({ capitulo, titulo: normalizarParaBusca(capitulo.titulo), texto: indexarTexto(textoSemMarcacao(capitulo.texto)) })),
    itens: CATALOGOS_DO_LIVRO.flatMap(({ chave }) =>
      itensDoCatalogo(catalogos, chave).map((item) => ({
        chave,
        item,
        nome: normalizarParaBusca(item.nome),
        texto: indexarTexto([item.descricao ?? '', item.efeito ?? ''].filter((parte) => parte.length > 0).join('\n')),
      })),
    ),
  }
}

export interface AchadoNoCapitulo {
  capitulo: CapituloDoLivro
  /** A consulta está no título do capítulo. */
  noTitulo: boolean
  ocorrencias: number
  /** O primeiro achado no texto; `null` = só o título casou. */
  trecho: TrechoAchado | null
}

export interface AchadoNoCatalogo {
  chave: ChaveDoCatalogo
  item: ItemDoLivro
  noNome: boolean
  trecho: TrechoAchado | null
}

export interface ResultadoDaBusca {
  /** A consulta normalizada; vazia = a busca não rodou (curta demais). */
  consulta: string
  capitulos: AchadoNoCapitulo[]
  itens: AchadoNoCatalogo[]
}

/**
 * Busca a frase em todo o livro. Ordem: quem tem a consulta no título/nome
 * primeiro; depois os capítulos com mais ocorrências; os itens na ordem do
 * catálogo. No máximo `BUSCA_MAX_POR_GRUPO` de cada grupo.
 */
export function buscarNoLivro(indice: IndiceDoLivro, consulta: string): ResultadoDaBusca {
  const procurada = normalizarParaBusca(consulta)
  if (procurada.length < BUSCA_MINIMO) return { consulta: '', capitulos: [], itens: [] }
  const capitulos = indice.capitulos
    .map(({ capitulo, titulo, texto }): AchadoNoCapitulo | null => {
      const noTitulo = titulo.includes(procurada)
      const primeiro = texto.normalizado.indexOf(procurada)
      if (!noTitulo && primeiro === -1) return null
      return { capitulo, noTitulo, ocorrencias: contar(texto.normalizado, procurada), trecho: primeiro === -1 ? null : trechoEm(texto, primeiro, procurada.length) }
    })
    .filter((achado): achado is AchadoNoCapitulo => achado !== null)
    .sort((a, b) => Number(b.noTitulo) - Number(a.noTitulo) || b.ocorrencias - a.ocorrencias)
    .slice(0, BUSCA_MAX_POR_GRUPO)
  const itens = indice.itens
    .map(({ chave, item, nome, texto }): AchadoNoCatalogo | null => {
      const noNome = nome.includes(procurada)
      const primeiro = texto.normalizado.indexOf(procurada)
      if (!noNome && primeiro === -1) return null
      return { chave, item, noNome, trecho: primeiro === -1 ? null : trechoEm(texto, primeiro, procurada.length) }
    })
    .filter((achado): achado is AchadoNoCatalogo => achado !== null)
    .sort((a, b) => Number(b.noNome) - Number(a.noNome))
    .slice(0, BUSCA_MAX_POR_GRUPO)
  return { consulta: procurada, capitulos, itens }
}

/** O filtro da lista de um catálogo: nome, descrição ou efeito com a frase; quem casa no nome vem antes. */
export function filtrarItens<T extends ItemDoLivro>(itens: readonly T[], filtro: string): T[] {
  const procurada = normalizarParaBusca(filtro)
  if (procurada.length === 0) return [...itens]
  const noNome: T[] = []
  const noTexto: T[] = []
  for (const item of itens) {
    if (normalizarParaBusca(item.nome).includes(procurada)) noNome.push(item)
    else if (normalizarParaBusca(`${item.descricao ?? ''} ${item.efeito ?? ''}`).includes(procurada)) noTexto.push(item)
  }
  return [...noNome, ...noTexto]
}
