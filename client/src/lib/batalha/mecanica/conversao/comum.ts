import type { CartaoDaFicha, MecanicaGuardada, Personagem } from '../../../personagem'
import type { SistemaDeRpg } from '../../../sistemaDeRpg'
import { golpeQueVale, lerMecanica, precisaDaVersao5, type MecanicaV2 } from '../modelo'
import { guardarMecanica } from '../modelos'
import { pecasParaGuardar } from '../pecas'

/**
 * CONVERSÃO DAS HABILIDADES ANTIGAS (rework do editor de habilidades, E2; PLANO.md D11): as peças
 * comuns. Puro: sem disco, sem store. Quem grava é o editor quando o mestre salva; a cópia de
 * segurança ao abrir mora em `stores/conversaoDasHabilidades.ts`.
 *
 * API pública (para a E6 e a E7):
 * - as linhas "Confira" da Descrição: `PREFIXO_DO_CONFIRA`, `linhasDoConfira`, `temConfira` (a etiqueta
 *   "Convertida: confira" da lista), `confiraDoTexto` (o mesmo no `texto` da entrada do catálogo),
 *   `semConfira` (o botão "Conferida") e `comConfira`;
 * - os tipos do relatório (`RelatorioDoCartao`, `RelatorioDaFicha`) e do resultado de um cartão.
 */

/** O campo da Descrição ("Descrição para ambientar", o único texto livre do cartão). */
export const CAMPO_DA_DESCRICAO = 'descricao'

/** O começo de cada linha que a conversão deixa na Descrição: o que o leitor não entendeu. */
export const PREFIXO_DO_CONFIRA = 'Confira: '

/** Teto de linhas "Confira" num cartão (texto torto não vira uma página de avisos). */
export const CONFIRA_POR_CARTAO_MAX = 8

/** Teto de letras de uma linha "Confira" (o texto inteiro de antes está no extra "Texto de antes"). */
const CONFIRA_TEXTO_MAX = 240

export function ehLinhaDoConfira(linha: string): boolean {
  return linha.startsWith(PREFIXO_DO_CONFIRA)
}

/** Os "Confira" de uma Descrição (a do cartão, ou o `texto` da entrada do catálogo), sem o prefixo, na ordem em que estão. */
export function confiraDoTexto(descricao: string): string[] {
  return descricao
    .split('\n')
    .filter(ehLinhaDoConfira)
    .map((linha) => linha.slice(PREFIXO_DO_CONFIRA.length))
}

/** Os "Confira" da Descrição do cartão, sem o prefixo, na ordem em que estão. */
export function linhasDoConfira(cartao: Pick<CartaoDaFicha, 'campos'>): string[] {
  return confiraDoTexto(cartao.campos[CAMPO_DA_DESCRICAO] ?? '')
}

/** O cartão ainda tem "Confira" na Descrição: a lista mostra "Convertida: confira" (nenhuma marca nova, D11). */
export function temConfira(cartao: Pick<CartaoDaFicha, 'campos'>): boolean {
  return linhasDoConfira(cartao).length > 0
}

/** Uma linha só, aparada e no teto. */
function textoDoConfira(texto: string): string {
  const numaLinha = texto.replace(/\s+/g, ' ').trim()
  return numaLinha.length <= CONFIRA_TEXTO_MAX ? numaLinha : `${numaLinha.slice(0, CONFIRA_TEXTO_MAX - 1).trimEnd()}…`
}

/** A Descrição com os "Confira" novos no fim (sem repetir os que já estão), no teto. Nada novo: o MESMO cartão. */
export function comConfira<T extends Pick<CartaoDaFicha, 'campos'>>(cartao: T, textos: readonly string[]): T {
  const atual = cartao.campos[CAMPO_DA_DESCRICAO] ?? ''
  const ja = new Set(linhasDoConfira(cartao))
  const novas: string[] = []
  for (const texto of textos) {
    const linha = textoDoConfira(texto)
    if (linha === '' || ja.has(linha)) continue
    if (ja.size + novas.length >= CONFIRA_POR_CARTAO_MAX) break
    ja.add(linha)
    novas.push(linha)
  }
  if (novas.length === 0) return cartao
  const linhas = novas.map((linha) => `${PREFIXO_DO_CONFIRA}${linha}`).join('\n')
  const descricao = atual.trimEnd() === '' ? linhas : `${atual.trimEnd()}\n${linhas}`
  return { ...cartao, campos: { ...cartao.campos, [CAMPO_DA_DESCRICAO]: descricao } }
}

/** O botão "Conferida": os "Confira" saem da Descrição; o resto fica como estava. Sem "Confira": o MESMO cartão. */
export function semConfira<T extends Pick<CartaoDaFicha, 'campos'>>(cartao: T): T {
  const atual = cartao.campos[CAMPO_DA_DESCRICAO]
  if (atual === undefined) return cartao
  const linhas = atual.split('\n')
  const ficam = linhas.filter((linha) => !ehLinhaDoConfira(linha))
  if (ficam.length === linhas.length) return cartao
  return { ...cartao, campos: { ...cartao.campos, [CAMPO_DA_DESCRICAO]: ficam.join('\n').trimEnd() } }
}

// ─── O resultado e o relatório ──────────────────────────────────────────────

/** A ficha de quem tem o cartão (o custo, o dano e a ação se leem com ela). */
export interface ContextoDaConversao {
  personagem: Personagem
  sistema: SistemaDeRpg
}

/** O que a conversão fez com o cartão. */
export type DeQueConverteu = 'tecnica' | 'reacao' | 'passiva' | 'forma' | 'acumulador'

export interface OpcoesDaConversao {
  /**
   * Só o editor (o mestre olhando o cartão): monta mesmo quando a batalha leria o custo, a ação, o
   * Tempo ou o dano diferente do texto, com um "Confira" por diferença. Ausente: o cartão que a
   * batalha leria diferente fica no texto (a lista e a gravação da ficha nunca mudam o número calado).
   */
  mesmoComDiferenca?: boolean
}

export type ResultadoDoCartao =
  | { tipo: 'convertido'; cartao: CartaoDaFicha; deQue: DeQueConverteu; confira: readonly string[] }
  /** O cartão segue pelo texto, como hoje; `porque` em português simples. */
  | { tipo: 'noTexto'; porque: string }

/** Uma linha do relatório: um cartão que a conversão mudou, ou que ficou no texto e o mestre pode montar à mão. */
export interface RelatorioDoCartao {
  cartaoId: string
  nome: string
  /** A aba do cartão (o subcartão leva a do cartão de fora). */
  aba: string
  resultado: 'convertido' | 'noTexto'
  /** Só no convertido: o que virou. */
  deQue?: DeQueConverteu
  /** Os "Confira" que a conversão pôs na Descrição. */
  confira: readonly string[]
  /** Só no que ficou no texto: o porquê. */
  porque?: string
}

/** O relatório de uma ficha: o que converteu e o que pede "Confira" (a lista e o editor mostram). */
export interface RelatorioDaFicha {
  personagemId: string
  nome: string
  /** Os cartões convertidos (montados, ou só com o acumulador do contador de antes). */
  convertidos: number
  /** Dos convertidos, os que têm "Confira". */
  comConfira: number
  /** Os que ficaram no texto, com o porquê. */
  noTexto: number
  cartoes: readonly RelatorioDoCartao[]
}

// ─── Gravar a mecânica convertida ───────────────────────────────────────────

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Versão 5 (D1): as peças só com o que difere do padrão; o tipo do golpe como a escolha que vale. Cópia funda, só JSON. */
function guardarNaVersao5(mecanica: MecanicaV2): MecanicaGuardada {
  const { pecas, golpe: _golpe, ...resto } = mecanica
  const golpe = golpeQueVale(mecanica.golpe)
  const comGolpe = golpe === undefined ? resto : { ...resto, golpe }
  const versionada = pecas === undefined || pecas.length === 0 ? { ...comGolpe, versao: 5 } : { ...comGolpe, pecas: pecasParaGuardar(pecas), versao: 5 }
  const copia: unknown = JSON.parse(JSON.stringify(versionada))
  return ehObjeto(copia) ? { ...copia } : {}
}

/**
 * A mecânica convertida como o cartão a guarda: 1 a 4 pelo `guardarMecanica` de hoje; com peça nova ou
 * uso novo, a 5 (o `guardarMecanica` de hoje ainda para na 4; a E6 o estende). `null` = o leitor
 * recusaria (o cartão fica no texto: nunca gravar mecânica que ninguém lê).
 */
export function guardarConvertida(mecanica: MecanicaV2): MecanicaGuardada | null {
  const guardada = precisaDaVersao5(mecanica) ? guardarNaVersao5(mecanica) : guardarMecanica(mecanica)
  return lerMecanica(guardada).tipo === 'pecas' ? guardada : null
}
