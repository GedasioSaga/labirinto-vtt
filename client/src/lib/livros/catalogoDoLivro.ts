import { normalizarParaBusca } from '../buscaNoLivro'
import { CATALOGO_ITENS_MAX, CATALOGO_TEXTO_MAX, type CapituloDoLivro, type SistemaDeRpg } from '../sistemaDeRpg'
import { DADOS_DO_TIPO, TIPOS_DO_LIVRO, type EntradaDoLivro, type TipoDoLivro } from './catalogo'

/**
 * PERÍCIAS, VANTAGENS E DESVANTAGENS "DO LIVRO" (M3 do mundo do livro de
 * regras): lidas dos capítulos do livro do sistema, sem disco e sem digitar
 * nada. Puro.
 *
 * O formato que o livro do One Piece usa (lib/livroOnePiece.ts), um parágrafo
 * por entrada:
 *   perícia:      **Nome:** texto **(Atributo)**
 *   vantagem:     **Nome:** texto            (linha seguinte) **o efeito em negrito**
 *   desvantagem:  **Nome:** texto            (linha seguinte) **(o efeito entre parênteses)**
 *
 * O texto veio do Discord e tem negrito torto ("**Natação: **", "**Dança**Você",
 * "**Narcisista**: ", "**Intuição**" sem parênteses). O leitor aceita essas
 * variações e o que ele não entende NÃO entra: melhor faltar que inventar.
 */

/** Caracteres invisíveis de preenchimento que o Discord deixou no texto. */
const INVISIVEIS = /[​-‏⁠﻿]/gu
const PARAGRAFO = /\n[ \t]*\n/u
/**
 * O começo da entrada: negrito com o nome e o separador, que pode ser
 * ":**", ": **", "**:" ou só "**" (sem dois-pontos, como "**Dança**Você").
 * Grupos: 1 = nome, 2 = separador, 3 = o resto da linha.
 */
const CABECALHO = /^\*\*\s*([^*\n]{1,80}?)\s*(:\s*\*\*|\*\*\s*:|\*\*)\s*(.*)$/u
/** O atributo da perícia no fim do parágrafo: "**(Intuição)**", "** (Agilidade)**", "**Intuição**". */
const MARCA_DE_ATRIBUTO = /\*\*\s*\(?\s*([^*()]{1,60}?)\s*\)?\s*\*\*\s*$/u
/** "Força e/ou Percepção", "Percepção/Intuição", "Força, Agilidade", "Força ou Agilidade". */
const SEPARADOR_DE_ATRIBUTOS = /\s*(?:\/|,|\s+e\s+|\s+ou\s+)\s*/u
const E_OU = /\s+e\s*\/\s*ou\s+/gu
/** Linha inteira em negrito (o efeito da vantagem). */
const LINHA_EM_NEGRITO = /^\*\*(.+?)\*\*$/u
const ENTRE_PARENTESES = /^\((.*)\)$/su
const NEGRITO = /\*\*/gu
const COMECA_COM_LETRA = /^\p{L}/u
const SEM_LETRA_OU_NUMERO = /[^a-z0-9]+/gu
const NOME_DO_LIVRO_MAX = 60
const PALAVRAS_DO_NOME_MAX = 6
const CAMPO_DO_EFEITO = 'efeito'

/** Corta em `max` unidades UTF-16 sem partir um par substituto. */
function cortar(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

/** O capítulo do tipo: pelo id da aba ("pericias") ou pelo título sem acento ("Perícias"). */
export function capituloDoTipo(livro: readonly CapituloDoLivro[], tipo: TipoDoLivro): CapituloDoLivro | undefined {
  const { aba, nome } = DADOS_DO_TIPO[tipo]
  const titulo = normalizarParaBusca(nome)
  return livro.find((capitulo) => capitulo.id === aba) ?? livro.find((capitulo) => normalizarParaBusca(capitulo.titulo) === titulo)
}

/** Nome que parece nome de entrada: começa com letra, curto, sem parênteses, sem ponto final. */
function nomeAceito(nome: string): boolean {
  return (
    nome.length > 0 &&
    nome.length <= NOME_DO_LIVRO_MAX &&
    COMECA_COM_LETRA.test(nome) &&
    !nome.includes('(') &&
    !nome.includes(')') &&
    !nome.endsWith('.') &&
    nome.split(/\s+/u).length <= PALAVRAS_DO_NOME_MAX
  )
}

/** Texto sem as marcas de negrito, cada linha aparada, linhas vazias fora. */
function textoLimpo(linhas: readonly string[]): string {
  return linhas
    .map((linha) => linha.replace(NEGRITO, '').trim())
    .filter((linha) => linha.length > 0)
    .join('\n')
}

/** O efeito sem negrito e sem os parênteses de fora. */
function efeitoLimpo(bruto: string): string {
  const semNegrito = bruto.replace(NEGRITO, '').trim()
  const dentro = ENTRE_PARENTESES.exec(semNegrito)?.[1]
  return (dentro ?? semNegrito).trim()
}

/** Os ids dos atributos citados na marca, pelo nome, id ou abreviação sem acento. Nome que não casa sai. */
function atributosDaMarca(marca: string, sistema: SistemaDeRpg): string[] {
  const ids: string[] = []
  for (const parte of marca.replace(E_OU, '/').split(SEPARADOR_DE_ATRIBUTOS)) {
    const chave = normalizarParaBusca(parte)
    if (chave.length === 0) continue
    const atributo = sistema.atributos.find(
      (candidato) => normalizarParaBusca(candidato.nome) === chave || candidato.id === chave || normalizarParaBusca(candidato.abreviacao) === chave,
    )
    if (atributo !== undefined && !ids.includes(atributo.id)) ids.push(atributo.id)
  }
  return ids
}

interface EntradaLida {
  nome: string
  texto: string
  campos: Record<string, string>
  atributos: string[]
}

/** A perícia: o atributo sai da marca do fim; marca que não casa com atributo nenhum fica no texto. */
function lerPericia(nome: string, linhas: string[], sistema: SistemaDeRpg): EntradaLida {
  const ultima = linhas.length - 1
  const marca = MARCA_DE_ATRIBUTO.exec(linhas[ultima] ?? '')
  const atributos = marca?.[1] === undefined ? [] : atributosDaMarca(marca[1], sistema)
  if (marca !== null && atributos.length > 0) linhas[ultima] = (linhas[ultima] ?? '').slice(0, marca.index)
  return { nome, texto: textoLimpo(linhas), campos: {}, atributos }
}

/** Vantagem e desvantagem: a última linha, inteira em negrito ou entre parênteses, é o efeito. */
function lerTraco(nome: string, linhas: string[]): EntradaLida {
  const ultima = linhas[linhas.length - 1]
  const ehEfeito = linhas.length >= 2 && ultima !== undefined && (LINHA_EM_NEGRITO.test(ultima) || ENTRE_PARENTESES.test(ultima))
  if (!ehEfeito) return { nome, texto: textoLimpo(linhas), campos: {}, atributos: [] }
  const efeito = cortar(efeitoLimpo(ultima), CATALOGO_TEXTO_MAX)
  return { nome, texto: textoLimpo(linhas.slice(0, -1)), campos: efeito.length > 0 ? { [CAMPO_DO_EFEITO]: efeito } : {}, atributos: [] }
}

/** Um parágrafo como entrada, ou `null` se ele não tem a cara de uma. */
function entradaDoParagrafo(paragrafo: string, tipo: TipoDoLivro, sistema: SistemaDeRpg): EntradaLida | null {
  const [primeira = '', ...resto] = paragrafo.split('\n').map((linha) => linha.trim())
  const cabecalho = CABECALHO.exec(primeira)
  if (cabecalho === null) return null
  const [, nomeBruto = '', separador = '', depois = ''] = cabecalho
  const nome = nomeBruto.trim()
  // Sem dois-pontos só vale com o texto colado na mesma linha ("**Dança**Você..."): linha inteira em negrito é efeito ou título.
  if (!nomeAceito(nome) || (!separador.includes(':') && depois.trim().length === 0)) return null
  const linhas = [depois, ...resto].map((linha) => linha.trim()).filter((linha) => linha.length > 0)
  if (linhas.length === 0) return null
  const lida = tipo === 'pericia' ? lerPericia(nome, linhas, sistema) : lerTraco(nome, linhas)
  if (lida.texto.length === 0) return null
  return { ...lida, nome: cortar(nome, NOME_DO_LIVRO_MAX), texto: cortar(lida.texto, CATALOGO_TEXTO_MAX) }
}

/** As entradas de um capítulo, na ordem do livro. Nome repetido fica o primeiro. */
export function lerCapituloDoLivro(texto: string, tipo: TipoDoLivro, sistema: SistemaDeRpg): EntradaDoLivro[] {
  const limpo = texto.replace(INVISIVEIS, '').replace(/\r\n?/gu, '\n')
  const nomes = new Set<string>()
  const ids = new Set<string>()
  const entradas: EntradaDoLivro[] = []
  for (const paragrafo of limpo.split(PARAGRAFO)) {
    if (entradas.length === CATALOGO_ITENS_MAX) break
    const lida = entradaDoParagrafo(paragrafo.trim(), tipo, sistema)
    if (lida === null) continue
    const chave = normalizarParaBusca(lida.nome)
    if (nomes.has(chave)) continue
    nomes.add(chave)
    const base = `livro-${tipo}-${chave.replace(SEM_LETRA_OU_NUMERO, '-').replace(/^-+|-+$/gu, '') || 'entrada'}`
    let id = base
    for (let n = 2; ids.has(id); n += 1) id = `${base}-${n}`
    ids.add(id)
    entradas.push({ id, tipo, ...lida })
  }
  return entradas
}

/**
 * Todas as perícias, vantagens e desvantagens do livro do sistema, nessa
 * ordem. Sistema sem livro ou sem o capítulo: o tipo não tem entrada (e a
 * página esconde o filtro dele).
 */
export function entradasDoLivro(sistema: SistemaDeRpg): EntradaDoLivro[] {
  const livro = sistema.livro ?? []
  return TIPOS_DO_LIVRO.flatMap((tipo) => {
    const capitulo = capituloDoTipo(livro, tipo)
    return capitulo === undefined ? [] : lerCapituloDoLivro(capitulo.texto, tipo, sistema)
  })
}
