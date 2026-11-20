/**
 * A COMBINAÇÃO (plano `docs/design/puzzles/PLANO.md` §1.6, a leva 2 que o dono
 * antecipou em 20/11): rodas de números, rodas de símbolos, ponteiros de
 * relógio e sequência de botões, com as regras do protótipo aprovado
 * (`prototipo-v2.html`: `girarRodaPz`, `tentarPz`, `relogioPor`,
 * `apertarBotaoPz`; o editor em `htmlFichaResposta`).
 *
 * Mora no lugar que o plano previu, `Puzzle.futuro = { tipo: 'combinacao',
 * forma, resposta }`: assim um app de antes desta leva guarda o puzzle como
 * veio ("versão mais nova") em vez de apagá-lo ao salvar o mapa. Por isso o
 * `futuro` é sempre LIDO por aqui (`combinacaoDoPuzzle`), nunca usado cru: o
 * que não se reconhece como combinação é a mecânica de uma leva futura.
 *
 * O progresso fica em `ProgressoDoPuzzle.controles`: `rodas` (o valor de cada
 * roda), `relogio` (minutos depois das 12h) e `sequencia` (toques certos).
 *
 * Puro: sem React, sem rede.
 */
import {
  BOTOES_MAX,
  BOTOES_MIN,
  FORMAS_DA_COMBINACAO,
  MINUTOS_NO_MOSTRADOR,
  PASSO_DO_RELOGIO,
  RODAS_MAX,
  RODAS_MIN,
  ROTULO_DO_BOTAO_MAX,
  SEQUENCIA_MAX,
  SIMBOLOS_DA_RODA,
} from './tipos'
import type { AcaoNoPuzzle, CombinacaoDoPuzzle, CombinacaoNaVista, FormaDaCombinacao, ProgressoDoPuzzle, Puzzle, SimboloDaRoda } from './tipos'

export const NOME_DA_COMBINACAO: Readonly<Record<FormaDaCombinacao, string>> = {
  numeros: 'Rodas de números',
  simbolos: 'Rodas de símbolos',
  relogio: 'Relógio',
  botoes: 'Sequência de botões',
}

export const NOME_DO_SIMBOLO: Readonly<Record<SimboloDaRoda, string>> = {
  ancora: 'âncora',
  estrela: 'estrela',
  peixe: 'peixe',
  coroa: 'coroa',
  chave: 'chave',
  olho: 'olho',
}

/** Uma roda de números vai de 0 a 9. */
export const ALGARISMOS = 10

/** As respostas de todo puzzle novo, as do `respostaPadrao` do v2 (o Cofre do Capitão abre com 318). */
const NUMEROS_PADRAO: readonly number[] = [3, 1, 8]
const SIMBOLOS_PADRAO: readonly SimboloDaRoda[] = ['estrela', 'peixe', 'ancora']
/** 2:50. */
const HORA_PADRAO = 2 * 60 + 50
const ROTULOS_PADRAO: readonly string[] = ['I', 'II', 'III', 'IV']
const SEQUENCIA_PADRAO: readonly number[] = [1, 3, 0, 2]

/** As chaves do progresso (`ProgressoDoPuzzle.controles`). */
const CHAVE_DAS_RODAS = 'rodas'
const CHAVE_DO_RELOGIO = 'relogio'
const CHAVE_DA_SEQUENCIA = 'sequencia'

export function combinacaoPadrao(forma: FormaDaCombinacao): CombinacaoDoPuzzle {
  switch (forma) {
    case 'numeros':
      return { tipo: 'combinacao', forma, resposta: [...NUMEROS_PADRAO] }
    case 'simbolos':
      return { tipo: 'combinacao', forma, resposta: [...SIMBOLOS_PADRAO] }
    case 'relogio':
      return { tipo: 'combinacao', forma, resposta: HORA_PADRAO }
    case 'botoes':
      return { tipo: 'combinacao', forma, rotulos: [...ROTULOS_PADRAO], resposta: [...SEQUENCIA_PADRAO] }
  }
}

// ------------------------------------------------------------------ a leitura (o `futuro` é entrada hostil)

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** `n` dentro de `[0, tamanho)`, também para negativos. */
export function modulo(n: number, tamanho: number): number {
  return ((n % tamanho) + tamanho) % tamanho
}

function inteiroEm(valor: unknown, tamanho: number): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor < tamanho ? valor : null
}

function ehSimbolo(valor: unknown): valor is SimboloDaRoda {
  return SIMBOLOS_DA_RODA.some((simbolo) => simbolo === valor)
}

/** As rodas que se leem; menos que `RODAS_MIN` completa com o padrão, mais que `RODAS_MAX` corta. */
function rodasLidas<T extends number | string>(valor: unknown, ler: (item: unknown) => T | null, padrao: readonly T[]): T[] {
  if (!Array.isArray(valor)) return [...padrao]
  const lidas = valor.flatMap((item) => {
    const lido = ler(item)
    return lido === null ? [] : [lido]
  })
  for (let i = lidas.length; i < RODAS_MIN; i++) {
    const completa = padrao[i % padrao.length]
    if (completa !== undefined) lidas.push(completa)
  }
  return lidas.slice(0, RODAS_MAX)
}

/** Corta sem deixar meio emoji no fim (como o leitor do puzzle). */
function cortado(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const ultima = texto.charCodeAt(max - 1)
  return texto.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

function rotulosLidos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [...ROTULOS_PADRAO]
  const rotulos = valor.flatMap((item) => (typeof item === 'string' && item.trim() !== '' ? [cortado(item.trim(), ROTULO_DO_BOTAO_MAX)] : [])).slice(0, BOTOES_MAX)
  return rotulos.length < BOTOES_MIN ? [...ROTULOS_PADRAO] : rotulos
}

/** Os minutos no mostrador: de 5 em 5, de 0 (12:00) a 715 (11:55). */
export function minutosNoMostrador(minutos: number): number {
  return modulo(Math.round(minutos / PASSO_DO_RELOGIO) * PASSO_DO_RELOGIO, MINUTOS_NO_MOSTRADOR)
}

/**
 * A combinação guardada, campo a campo (campo torto vira o padrão). `null` =
 * não é uma combinação que este app joga (outro `tipo`, ou uma `forma` de uma
 * leva futura): quem chama trata como "versão mais nova".
 */
export function lerCombinacao(valor: unknown): CombinacaoDoPuzzle | null {
  if (!isRecord(valor) || valor.tipo !== 'combinacao') return null
  const forma = FORMAS_DA_COMBINACAO.find((candidata) => candidata === valor.forma)
  switch (forma) {
    case undefined:
      return null
    case 'numeros':
      return { tipo: 'combinacao', forma, resposta: rodasLidas(valor.resposta, (item) => inteiroEm(item, ALGARISMOS), NUMEROS_PADRAO) }
    case 'simbolos':
      return { tipo: 'combinacao', forma, resposta: rodasLidas(valor.resposta, (item) => (ehSimbolo(item) ? item : null), SIMBOLOS_PADRAO) }
    case 'relogio':
      return { tipo: 'combinacao', forma, resposta: typeof valor.resposta === 'number' && Number.isFinite(valor.resposta) ? minutosNoMostrador(valor.resposta) : HORA_PADRAO }
    case 'botoes': {
      const rotulos = rotulosLidos(valor.rotulos)
      const lida: readonly unknown[] = Array.isArray(valor.resposta) ? valor.resposta : SEQUENCIA_PADRAO
      const resposta = lida.flatMap((item) => {
        const botao = inteiroEm(item, rotulos.length)
        return botao === null ? [] : [botao]
      })
      return { tipo: 'combinacao', forma, rotulos, resposta: resposta.slice(0, SEQUENCIA_MAX) }
    }
  }
}

/** A combinação do puzzle; `null` = ele é de encaixes (ou de uma leva futura). */
export function combinacaoDoPuzzle(puzzle: Pick<Puzzle, 'futuro'>): CombinacaoDoPuzzle | null {
  return puzzle.futuro === undefined ? null : lerCombinacao(puzzle.futuro)
}

/** O puzzle traz uma mecânica que este app não joga: o "Este puzzle é de uma versão mais nova do app". */
export function mecanicaDesconhecida(puzzle: Pick<Puzzle, 'futuro'>): boolean {
  return puzzle.futuro !== undefined && combinacaoDoPuzzle(puzzle) === null
}

/** As ações que não olham o `rev`: girar, mexer o ponteiro e apertar valem sobre o que o HOST tem, e o fio as entrega em ordem. */
export function acaoDeControle(acao: AcaoNoPuzzle): boolean {
  return acao.tipo === 'girar' || acao.tipo === 'ponteiro' || acao.tipo === 'apertar'
}

// ------------------------------------------------------------------ o progresso

/** Quantas posições a roda tem: 10 algarismos, ou os 6 glifos. */
export function tamanhoDaRoda(forma: 'numeros' | 'simbolos'): number {
  return forma === 'numeros' ? ALGARISMOS : SIMBOLOS_DA_RODA.length
}

function controleDe(progresso: Pick<ProgressoDoPuzzle, 'controles'>, chave: string): number | number[] | undefined {
  const controles = progresso.controles
  return controles !== undefined && Object.hasOwn(controles, chave) ? controles[chave] : undefined
}

/** O valor de cada roda agora; a que ninguém girou está no 0 (o v2 começa todas no 0 e na âncora). */
export function rodasNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'controles'>, quantas: number, tamanho: number): number[] {
  const guardadas = controleDe(progresso, CHAVE_DAS_RODAS)
  const lista = Array.isArray(guardadas) ? guardadas : []
  return Array.from({ length: quantas }, (_, i) => (i < lista.length ? modulo(Math.round(lista[i]), tamanho) : 0))
}

/** A hora dos ponteiros, em minutos depois das 12h; ninguém mexeu = 12:00 (o v2). */
export function minutosNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'controles'>): number {
  const guardado = controleDe(progresso, CHAVE_DO_RELOGIO)
  return typeof guardado === 'number' ? minutosNoMostrador(guardado) : 0
}

/** Quantos toques da sequência já acenderam (de 0 a `total`). */
export function certosNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'controles'>, total: number): number {
  const guardado = controleDe(progresso, CHAVE_DA_SEQUENCIA)
  return typeof guardado === 'number' && Number.isInteger(guardado) ? Math.min(total, Math.max(0, guardado)) : 0
}

/** O progresso com o controle `chave` trocado (cópia rasa: o motor já trabalha numa cópia). */
function comControle(progresso: ProgressoDoPuzzle, chave: string, valor: number | number[]): ProgressoDoPuzzle {
  return { ...progresso, controles: { ...progresso.controles, [chave]: valor } }
}

export function comRodas(progresso: ProgressoDoPuzzle, rodas: number[]): ProgressoDoPuzzle {
  return comControle(progresso, CHAVE_DAS_RODAS, rodas)
}

export function comMinutos(progresso: ProgressoDoPuzzle, minutos: number): ProgressoDoPuzzle {
  return comControle(progresso, CHAVE_DO_RELOGIO, minutosNoMostrador(minutos))
}

export function comCertos(progresso: ProgressoDoPuzzle, certos: number): ProgressoDoPuzzle {
  return comControle(progresso, CHAVE_DA_SEQUENCIA, certos)
}

/** O "Tentar" das rodas e do relógio: o que está nos controles é a resposta? */
export function combinacaoCerta(combinacao: CombinacaoDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'controles'>): boolean {
  switch (combinacao.forma) {
    case 'numeros': {
      const rodas = rodasNoProgresso(progresso, combinacao.resposta.length, ALGARISMOS)
      return combinacao.resposta.every((certo, i) => rodas[i] === certo)
    }
    case 'simbolos': {
      const rodas = rodasNoProgresso(progresso, combinacao.resposta.length, SIMBOLOS_DA_RODA.length)
      return combinacao.resposta.every((certo, i) => SIMBOLOS_DA_RODA[rodas[i]] === certo)
    }
    case 'relogio':
      return minutosNoProgresso(progresso) === combinacao.resposta
    case 'botoes':
      return combinacao.resposta.length > 0 && certosNoProgresso(progresso, combinacao.resposta.length) === combinacao.resposta.length
  }
}

/** O controle para o jogador, por lista branca: nada da resposta além de quantas rodas e quantos toques. */
export function combinacaoNaVista(combinacao: CombinacaoDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'controles'>, lugar: Puzzle['controle']): CombinacaoNaVista {
  const { x, y, s } = lugar
  switch (combinacao.forma) {
    case 'numeros':
    case 'simbolos':
      return { x, y, s, forma: combinacao.forma, rodas: rodasNoProgresso(progresso, combinacao.resposta.length, tamanhoDaRoda(combinacao.forma)) }
    case 'relogio':
      return { x, y, s, forma: 'relogio', minutos: minutosNoProgresso(progresso) }
    case 'botoes':
      return { x, y, s, forma: 'botoes', rotulos: [...combinacao.rotulos], total: combinacao.resposta.length, certos: certosNoProgresso(progresso, combinacao.resposta.length) }
  }
}

/** "2:50": a hora como o editor e o mestre a leem. */
export function textoDaHora(minutos: number): string {
  const certo = minutosNoMostrador(minutos)
  const hora = Math.floor(certo / 60) || 12
  return `${hora}:${String(certo % 60).padStart(2, '0')}`
}
