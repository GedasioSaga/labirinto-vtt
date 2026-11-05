/**
 * JSON DO LOBBY — o valor que viaja numa operação (docs/planos/lobby-jogadores-2026-11-05.md
 * §4.6-4.7). Puro: roda no app, no site e no Worker, sem DOM, sem Tauri, sem store.
 *
 * Três chaves nunca entram em lugar nenhum (`__proto__`, `prototype`,
 * `constructor`): escrever por chave com elas mexeria no protótipo do objeto.
 * A leitura do fio descarta as três em qualquer nível (`lerJsonSeguro`), e o
 * esquema recusa o valor que ainda as trouxer (`problemaNoValor`).
 */

export type Json = null | boolean | number | string | Json[] | { [chave: string]: Json }

export const CHAVES_PROIBIDAS: ReadonlySet<string> = new Set(['__proto__', 'prototype', 'constructor'])

/** Fundura máxima de um valor: cartão com subcartões cabe com folga; mais que isso é ataque à pilha. */
export const PROFUNDIDADE_MAX = 32

export function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

/** Objeto literal ou de `JSON.parse`; `Date`, `Map` e afins não são JSON. */
function ehObjetoSimples(valor: object): boolean {
  const prototipo: unknown = Object.getPrototypeOf(valor)
  return prototipo === Object.prototype || prototipo === null
}

/** A chave do registro, só se for dele: `registro['toString']` não pode devolver a função do protótipo. */
export function proprio<T>(registro: Readonly<Record<string, T>>, chave: string): T | undefined {
  return Object.hasOwn(registro, chave) ? registro[chave] : undefined
}

/**
 * Por que o valor não é JSON aceitável; `null` = bom. Recusa número que não é
 * finito (NaN, Infinity), chave proibida em qualquer nível, `undefined` dentro
 * de lista ou objeto, objeto que não é literal e fundura acima do teto.
 */
export function problemaNoValor(valor: unknown, profundidade = 0): string | null {
  if (profundidade > PROFUNDIDADE_MAX) return 'Valor fundo demais'
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? null : 'Número inválido (NaN ou infinito)'
  if (Array.isArray(valor)) {
    // `Array.from` visita os buracos da lista como `undefined`; o `for…of` também, mas deixa explícito.
    for (const item of Array.from(valor)) {
      const problema = problemaNoValor(item, profundidade + 1)
      if (problema !== null) return problema
    }
    return null
  }
  if (typeof valor !== 'object' || valor === null || !ehObjetoSimples(valor)) return 'Valor que não é JSON'
  for (const [chave, item] of Object.entries(valor)) {
    if (CHAVES_PROIBIDAS.has(chave)) return `Chave proibida no valor: ${chave}`
    const problema = problemaNoValor(item, profundidade + 1)
    if (problema !== null) return problema
  }
  return null
}

/** Guarda de tipo do valor que veio do fio; o motivo da recusa é `problemaNoValor`. */
export function ehJson(valor: unknown): valor is Json {
  return problemaNoValor(valor) === null
}

function descartarChavesProibidas(chave: string, valor: unknown): unknown {
  // Devolver `undefined` no reviver apaga a chave do objeto que está sendo montado.
  return CHAVES_PROIBIDAS.has(chave) ? undefined : valor
}

/** `JSON.parse` do fio: as três chaves proibidas somem em qualquer nível. Texto torto lança `SyntaxError`. */
export function lerJsonSeguro(texto: string): unknown {
  return JSON.parse(texto, descartarChavesProibidas)
}

/**
 * Cópia JSON de um valor do app (ficha, cartão, item): objetos novos, nada
 * compartilhado com o store — a op guardada na fila não muda quando a ficha
 * muda depois. Chave com `undefined` some (como no `JSON.stringify`). Número
 * não finito passa como está, para o esquema recusá-lo com o motivo certo.
 * Função, símbolo e objeto que não é literal lançam `TypeError`: é erro de
 * programa, não de dado.
 */
export function paraJson(valor: unknown): Json {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean' || typeof valor === 'number') return valor
  if (Array.isArray(valor)) return Array.from(valor, (item: unknown) => (item === undefined ? null : paraJson(item)))
  if (typeof valor === 'object' && ehObjetoSimples(valor)) {
    // `Object.fromEntries` cria propriedade própria mesmo com a chave `__proto__`; atribuir `copia[chave]` trocaria o protótipo.
    return Object.fromEntries(
      Object.entries(valor)
        .filter((par) => par[1] !== undefined)
        .map(([chave, item]) => [chave, paraJson(item)]),
    )
  }
  throw new TypeError(`paraJson: valor que não é JSON (${typeof valor})`)
}

function chavesDefinidas(registro: object): string[] {
  return Object.entries(registro)
    .filter((par) => par[1] !== undefined)
    .map(([chave]) => chave)
}

/** Igualdade de valor JSON: ordem das chaves não conta, chave com `undefined` vale ausente, NaN é igual a NaN. */
export function jsonIgual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b)
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item: unknown, indice) => jsonIgual(item, b[indice]))
  }
  if (!ehRegistro(a) || !ehRegistro(b)) return false
  const chavesDeA = chavesDefinidas(a)
  if (chavesDeA.length !== chavesDefinidas(b).length) return false
  return chavesDeA.every((chave) => Object.hasOwn(b, chave) && jsonIgual(a[chave], b[chave]))
}

const codificador = new TextEncoder()

/** Tamanho do valor no fio, em bytes UTF-8 do JSON. Ausente = 0. */
export function bytesDoJson(valor: unknown): number {
  if (valor === undefined) return 0
  return codificador.encode(JSON.stringify(valor)).length
}

/** Tamanho de um texto em bytes UTF-8 (os tetos em KiB da tabela 4.7). */
export function bytesDoTexto(texto: string): number {
  return codificador.encode(texto).length
}
