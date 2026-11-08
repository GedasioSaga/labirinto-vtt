import { ehRegistro } from '../molde'
import { chaveDoCaminho, extensaoDe, type LeitorDoCofre } from './cofre'
import { inventariar, type ArquivoInventariado } from './inventario'

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
  /** Mesmos campos, valores diferentes (a cópia é uma versão mais velha ou mais nova). */
  | 'soDiferencas'
  /** A cópia tem campos que o original não tem: pode haver algo a recuperar. */
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
  /** Campos (folhas do JSON) da cópia que o original não tem. */
  readonly aMais: number
  /** Campos dos dois lados com valor diferente. */
  readonly diferentes: number
  readonly motivo?: string
}

export interface CopiasDeConflito {
  readonly arquivos: number
  readonly comparacoes: readonly ComparacaoDaCopia[]
  readonly comCoisaAMais: number
}

const SUFIXO_DO_CONFLITO = / \(conflito[^)]*\)( \(\d+\))?/giu

/** O caminho do original: o mesmo, sem o sufixo de conflito em cada parte. */
export function originalDaCopia(caminho: string): string {
  return caminho.replace(SUFIXO_DO_CONFLITO, '')
}

/** O que muda entre a cópia e o original sem ser conteúdo: id novo, nome com sufixo, datas, a vista do tldraw. */
const FORA_DA_COMPARACAO: ReadonlySet<string> = new Set(['.id', '.nome', '.criadoEm', '.modificadoEm', '.documento.session'])

/** Cada valor do JSON por caminho; lista de objetos com `id` é indexada pelo id (a ordem não conta). */
function folhas(valor: unknown, caminho: string, saida: Map<string, string>): void {
  if (FORA_DA_COMPARACAO.has(caminho)) return
  if (Array.isArray(valor)) {
    const porId = valor.length > 0 && valor.every((elemento) => ehRegistro(elemento) && typeof elemento.id === 'string')
    if (valor.length === 0) saida.set(caminho, '[]')
    valor.forEach((elemento: unknown, posicao) => {
      const chave = porId && ehRegistro(elemento) ? `id=${String(elemento.id)}` : String(posicao)
      folhas(elemento, `${caminho}[${chave}]`, saida)
    })
    return
  }
  if (ehRegistro(valor)) {
    const chaves = Object.keys(valor)
    if (chaves.length === 0) saida.set(caminho, '{}')
    for (const chave of chaves) folhas(valor[chave], `${caminho}.${chave}`, saida)
    return
  }
  saida.set(caminho, JSON.stringify(valor) ?? 'undefined')
}

function folhasDe(json: unknown): Map<string, string> {
  const saida = new Map<string, string>()
  folhas(json, '', saida)
  return saida
}

function lerJson(texto: string): { ok: true; valor: unknown } | { ok: false } {
  try {
    return { ok: true, valor: JSON.parse(texto) }
  } catch {
    return { ok: false }
  }
}

function comparar(copia: unknown, original: unknown): { aMais: number; diferentes: number } {
  const daOriginal = folhasDe(original)
  let aMais = 0
  let diferentes = 0
  for (const [caminho, valor] of folhasDe(copia)) {
    const noOriginal = daOriginal.get(caminho)
    if (noOriginal === undefined) aMais += 1
    else if (noOriginal !== valor) diferentes += 1
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
  const { arquivos } = await inventariar(copias)
  const naLixeira = lixeiraPorCauda(noCofre)
  const comparacoes = await Promise.all(arquivos.map((copia) => compararUma(copia, copias, cofre, noCofre, naLixeira)))
  return { arquivos: arquivos.length, comparacoes, comCoisaAMais: comparacoes.filter((comparacao) => comparacao.situacao === 'temCoisaAMais').length }
}
