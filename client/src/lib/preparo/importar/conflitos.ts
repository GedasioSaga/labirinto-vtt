import { ehRegistro } from '../molde'
import { chaveDoCaminho, extensaoDe, type LeitorDoCofre } from './cofre'
import { inventariar, type ArquivoInventariado, type PastaIlegivel } from './inventario'

/**
 * AS CÓPIAS DE CONFLITO DE 14/08 (plano §4, passo 9): não entram na
 * importação. O relatório só compara cada uma com o original do cofre e avisa
 * quando a cópia tem algo que o original não tem.
 *
 * A pasta das cópias repete os caminhos do cofre, com " (conflito — Grimorio
 * dd-mm hhHmm)" no nome do arquivo ou da pasta do cenário (às vezes seguido de
 * " (2)"). Tirando isso, sobra o caminho do original.
 */

export type SituacaoDaCopia =
  | 'igual'
  /** Valores diferentes, sem nada novo: a cópia tem só o que o original já tem (versão mais velha, ou com menos). */
  | 'soDiferencas'
  /** A cópia tem campo, item ou palavra que o original não tem: pode haver algo a recuperar. */
  | 'temCoisaAMais'
  | 'semOriginal'
  /** Só na nuvem, atalho, JSON quebrado ou erro de leitura. */
  | 'naoLida'

export interface ComparacaoDaCopia {
  readonly copia: string
  /** O caminho do original no cofre. */
  readonly original: string
  /** O original foi achado na lixeira do Grimório (`.lixeira/<id>/…`), e não no lugar dele. */
  readonly naLixeira: boolean
  readonly situacao: SituacaoDaCopia
  /** Campos (folhas do JSON) da cópia que o original não tem, ou textos com palavra que o original não tem. */
  readonly aMais: number
  /** Campos dos dois lados com valor diferente, sem nada novo na cópia. */
  readonly diferentes: number
  readonly motivo?: string
}

export interface CopiasDeConflito {
  readonly arquivos: number
  readonly comparacoes: readonly ComparacaoDaCopia[]
  readonly comCoisaAMais: number
  /** Cópias com valores diferentes do original, mas sem nada novo. */
  readonly soDiferencas: number
  /** Cópias que não deu para comparar (só na nuvem, atalho, JSON quebrado, erro de leitura, não é JSON). */
  readonly naoLidas: number
  /** Pastas das cópias que não deu para listar: o que há dentro delas não foi comparado. */
  readonly pastasIlegiveis: readonly PastaIlegivel[]
}

const SUFIXO_DO_CONFLITO = / \(conflito[^)]*\)( \(\d+\))?/giu

/** O caminho do original: o mesmo, sem o sufixo de conflito em cada parte. */
export function originalDaCopia(caminho: string): string {
  return caminho.replace(SUFIXO_DO_CONFLITO, '')
}

/** O que muda entre a cópia e o original sem ser conteúdo: id novo, datas, a vista do tldraw. */
const FORA_DA_COMPARACAO: ReadonlySet<string> = new Set(['.id', '.criadoEm', '.modificadoEm', '.documento.session'])
/** O nome da cópia ganhou a marca de conflito: é comparado sem ela. */
const CAMPO_DO_NOME = '.nome'
/** A marca no nome: "(conflito) Nome" no JSON, "Nome (conflito — Grimorio dd-mm hhHmm) (2)" no arquivo. */
const MARCA_DE_CONFLITO = /\(conflito[^)]*\)( \(\d+\))?/giu

/** O nome sem a marca de conflito, nos dois formatos, com os espaços arrumados. */
function nomeSemMarcaDeConflito(nome: string): string {
  return nome.replace(MARCA_DE_CONFLITO, ' ').replace(/\s+/gu, ' ').trim()
}
/** Marcas de lista e objeto vazios: nenhum valor do JSON é igual a elas. */
const LISTA_VAZIA = Symbol('[]')
const OBJETO_VAZIO = Symbol('{}')

interface Folhas {
  /** Cada valor (texto, número, sim/não, null, ou a marca de vazio) pelo caminho. */
  readonly valores: Map<string, unknown>
  /** Os caminhos que são lista ou objeto, com ou sem conteúdo. */
  readonly conteineres: Set<string>
}

/** Cada valor do JSON por caminho; lista de objetos com `id` é indexada pelo id (a ordem não conta). */
function folhas(valor: unknown, caminho: string, saida: Folhas): void {
  if (FORA_DA_COMPARACAO.has(caminho)) return
  if (Array.isArray(valor)) {
    saida.conteineres.add(caminho)
    const porId = valor.length > 0 && valor.every((elemento) => ehRegistro(elemento) && typeof elemento.id === 'string')
    if (valor.length === 0) saida.valores.set(caminho, LISTA_VAZIA)
    valor.forEach((elemento: unknown, posicao) => {
      const chave = porId && ehRegistro(elemento) ? `id=${String(elemento.id)}` : String(posicao)
      folhas(elemento, `${caminho}[${chave}]`, saida)
    })
    return
  }
  if (ehRegistro(valor)) {
    saida.conteineres.add(caminho)
    const chaves = Object.keys(valor)
    if (chaves.length === 0) saida.valores.set(caminho, OBJETO_VAZIO)
    for (const chave of chaves) folhas(valor[chave], `${caminho}.${chave}`, saida)
    return
  }
  saida.valores.set(caminho, caminho === CAMPO_DO_NOME && typeof valor === 'string' ? nomeSemMarcaDeConflito(valor) : valor)
}

function folhasDe(json: unknown): Folhas {
  const saida: Folhas = { valores: new Map(), conteineres: new Set() }
  folhas(json, '', saida)
  return saida
}

/** As palavras de um texto, sem as etiquetas do HTML nem as entidades (`&nbsp;`), em minúsculas. */
function palavrasDe(texto: string): Set<string> {
  const semHtml = texto.replace(/<[^>]*>/g, ' ').replace(/&#?\w+;/g, ' ')
  return new Set(semHtml.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) ?? [])
}

/**
 * Os campos de texto escrito pelo mestre: nome e título, as abas da ficha, o
 * corpo da página, a legenda, a nota do vínculo e o texto do quadro. Caminho de
 * imagem, URL e id do tldraw ficam de fora: mudam sozinhos (organizar imagens,
 * outro PC) e cada pedaço novo pareceria "palavra nova".
 */
const CAMPOS_DE_TEXTO: ReadonlySet<string> = new Set([
  'nome', 'titulo', 'resumo', 'descricao', 'informacao', 'historia', 'extras', 'anotacoes', 'eventos', 'itens', 'efeito', 'corpo', 'legenda', 'notas', 'text',
])

function ehCampoDeTexto(caminho: string): boolean {
  return CAMPOS_DE_TEXTO.has(caminho.slice(caminho.lastIndexOf('.') + 1))
}

/** O texto da cópia tem palavra que o do original não tem: algo foi escrito nela. */
function temPalavraAMais(daCopia: string, doOriginal: string): boolean {
  const doOriginalPalavras = palavrasDe(doOriginal)
  for (const palavra of palavrasDe(daCopia)) if (!doOriginalPalavras.has(palavra)) return true
  return false
}

function lerJson(texto: string): { ok: true; valor: unknown } | { ok: false } {
  try {
    return { ok: true, valor: JSON.parse(texto) }
  } catch {
    return { ok: false }
  }
}

/**
 * Conta o que a cópia tem a mais e o que só difere. Lista ou objeto vazio onde
 * o original tem conteúdo é a cópia com MENOS (difere, não é "a mais"); texto
 * com palavra que o original não tem é "a mais", mesmo no mesmo campo.
 */
function comparar(copia: unknown, original: unknown): { aMais: number; diferentes: number } {
  const daOriginal = folhasDe(original)
  let aMais = 0
  let diferentes = 0
  for (const [caminho, valor] of folhasDe(copia).valores) {
    if (!daOriginal.valores.has(caminho)) {
      const vazioOndeOOriginalTemConteudo = (valor === LISTA_VAZIA || valor === OBJETO_VAZIO) && daOriginal.conteineres.has(caminho)
      if (vazioOndeOOriginalTemConteudo) diferentes += 1
      else aMais += 1
      continue
    }
    const noOriginal = daOriginal.valores.get(caminho)
    if (Object.is(noOriginal, valor)) continue
    if (typeof valor === 'string' && typeof noOriginal === 'string' && ehCampoDeTexto(caminho) && temPalavraAMais(valor, noOriginal)) aMais += 1
    else diferentes += 1
  }
  return { aMais, diferentes }
}

function situacaoDe(aMais: number, diferentes: number): SituacaoDaCopia {
  if (aMais > 0) return 'temCoisaAMais'
  return diferentes > 0 ? 'soDiferencas' : 'igual'
}

/** Arquivos com nome de pasta (o cenário é a pasta dele): o fim do caminho que identifica o original. */
const NOMES_DE_PASTA: ReadonlySet<string> = new Set(['cenario.json', 'pasta.json', 'campanha.json'])
const PASTA_DA_LIXEIRA = '.lixeira/'

function caudaDe(caminho: string): string {
  const partes = chaveDoCaminho(caminho).split('/')
  return partes.slice(NOMES_DE_PASTA.has(partes[partes.length - 1]) ? -2 : -1).join('/')
}

/** O que está na lixeira do Grimório, pelo fim do caminho (a lixeira guarda o arquivo com o nome que ele tinha). */
function lixeiraPorCauda(noCofre: ReadonlyMap<string, ArquivoInventariado>): Map<string, ArquivoInventariado> {
  const porCauda = new Map<string, ArquivoInventariado>()
  for (const [chave, arquivo] of noCofre) {
    if (!chave.startsWith(PASTA_DA_LIXEIRA)) continue
    const cauda = caudaDe(arquivo.caminho)
    if (!porCauda.has(cauda)) porCauda.set(cauda, arquivo)
  }
  return porCauda
}

async function compararUma(
  copia: ArquivoInventariado,
  copias: LeitorDoCofre,
  cofre: LeitorDoCofre,
  noCofre: ReadonlyMap<string, ArquivoInventariado>,
  naLixeira: ReadonlyMap<string, ArquivoInventariado>,
): Promise<ComparacaoDaCopia> {
  const original = originalDaCopia(copia.caminho)
  const base = { copia: copia.caminho, original, naLixeira: false, aMais: 0, diferentes: 0 }
  if (extensaoDe(copia.caminho) !== 'json') return { ...base, situacao: 'naoLida', motivo: 'não é JSON' }
  if (copia.estado !== 'local') return { ...base, situacao: 'naoLida', motivo: `a cópia não foi lida (${copia.estado})` }
  const noLugar = noCofre.get(chaveDoCaminho(original))
  const daLixeira = noLugar === undefined ? naLixeira.get(caudaDe(original)) : undefined
  const doCofre = noLugar ?? daLixeira
  if (doCofre === undefined) return { ...base, situacao: 'semOriginal' }
  base.naLixeira = daLixeira !== undefined
  if (doCofre.estado !== 'local') return { ...base, original: doCofre.caminho, situacao: 'naoLida', motivo: `o original não foi lido (${doCofre.estado})` }
  try {
    const [daCopia, doOriginal] = await Promise.all([copias.lerTexto(copia.caminho), cofre.lerTexto(doCofre.caminho)])
    const jsonDaCopia = lerJson(daCopia)
    const jsonDoOriginal = lerJson(doOriginal)
    if (!jsonDaCopia.ok || !jsonDoOriginal.ok) return { ...base, original: doCofre.caminho, situacao: 'naoLida', motivo: 'JSON quebrado' }
    const { aMais, diferentes } = comparar(jsonDaCopia.valor, jsonDoOriginal.valor)
    return { ...base, original: doCofre.caminho, aMais, diferentes, situacao: situacaoDe(aMais, diferentes) }
  } catch (erro) {
    return { ...base, original: doCofre.caminho, situacao: 'naoLida', motivo: erro instanceof Error ? erro.message : String(erro) }
  }
}

/** `noCofre`: o inventário do cofre por `chaveDoCaminho` (o Windows não distingue maiúscula). */
export async function compararCopiasDeConflito(
  copias: LeitorDoCofre,
  cofre: LeitorDoCofre,
  noCofre: ReadonlyMap<string, ArquivoInventariado>,
): Promise<CopiasDeConflito> {
  const { arquivos, pastasIlegiveis } = await inventariar(copias)
  const naLixeira = lixeiraPorCauda(noCofre)
  const comparacoes = await Promise.all(arquivos.map((copia) => compararUma(copia, copias, cofre, noCofre, naLixeira)))
  const quantas = (situacao: SituacaoDaCopia) => comparacoes.filter((comparacao) => comparacao.situacao === situacao).length
  return {
    arquivos: arquivos.length,
    comparacoes,
    comCoisaAMais: quantas('temCoisaAMais'),
    soDiferencas: quantas('soDiferencas'),
    naoLidas: quantas('naoLida'),
    pastasIlegiveis,
  }
}
