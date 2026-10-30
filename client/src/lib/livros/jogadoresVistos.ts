import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { nomeDoJogadorLimpo } from '../personagem'
import { chaveDoNome } from '../contasDosJogadores'
import { ensureDir, writeTextFileSafely } from '../mapFileIO'

/**
 * NOMES VISTOS NA MESA (M1 do mundo do livro de regras): quem já entrou na
 * sala, para o seletor da página Jogadores ("contas primeiro, depois nomes já
 * vistos") e a lista "Entraram na mesa e não têm ficha". É do APP, como as
 * contas: o mesmo beto joga em qualquer campanha.
 *
 *   <appData>/livros/jogadores-vistos.json   lista { nome, vistoEm }, o mais recente primeiro
 *
 * Não é dado sensível nem crítico: arquivo ilegível começa vazio, sem cópia.
 */

export interface JogadorVisto {
  /** Como ele digitou, já limpo (`nomeDoJogadorLimpo`). */
  nome: string
  /** `Date.now()` da última vez que a mesa o viu. */
  vistoEm: number
}

/** Passou, sai o visto há mais tempo. */
export const JOGADORES_VISTOS_MAX = 64
/**
 * Quem continua na sala só renova o "visto em" depois disso: o App chama
 * `registrarVistos` a cada mudança da lista da sala, e sem esse piso cada
 * chamada gravaria o disco à toa. "Visto hoje" não precisa de minuto.
 */
export const VISTO_RENOVA_MS = 10 * 60 * 1000
/** O maior instante que `Date` representa. */
const DATA_MAX_MS = 8.64e15
const PASTA_DOS_LIVROS = 'livros'
const ARQUIVO_DOS_VISTOS = 'jogadores-vistos.json'
const AVISO = 'Não foi possível ler os jogadores vistos na mesa'

/**
 * Junta os nomes da sala agora à lista: nome novo entra, nome que já estava
 * (pelo esqueleto, `chaveDoNome`) renova o `vistoEm` e o nome escrito. Ordem
 * do mais recente para o mais velho, no máximo `JOGADORES_VISTOS_MAX`.
 * Devolve a MESMA lista quando nada muda (quem chama grava só se mudou).
 */
export function registrarVistos(lista: readonly JogadorVisto[], nomes: readonly string[], agora: number): readonly JogadorVisto[] {
  const porChave = new Map(lista.map((visto) => [chaveDoNome(visto.nome), visto]))
  let mudou = false
  for (const bruto of nomes) {
    const nome = nomeDoJogadorLimpo(bruto)
    const chave = chaveDoNome(nome)
    if (chave.length === 0) continue
    const antes = porChave.get(chave)
    if (antes !== undefined && antes.nome === nome && agora - antes.vistoEm < VISTO_RENOVA_MS) continue
    porChave.set(chave, { nome, vistoEm: agora })
    mudou = true
  }
  if (!mudou) return lista
  return [...porChave.values()].sort((a, b) => b.vistoEm - a.vistoEm).slice(0, JOGADORES_VISTOS_MAX)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function vistoDoArquivo(value: unknown): JogadorVisto | null {
  if (!isRecord(value)) return null
  const { nome, vistoEm } = value
  if (typeof nome !== 'string' || typeof vistoEm !== 'number' || !Number.isFinite(vistoEm) || Math.abs(vistoEm) > DATA_MAX_MS) return null
  const limpo = nomeDoJogadorLimpo(nome)
  return limpo.length === 0 ? null : { nome: limpo, vistoEm }
}

/** A lista do disco, tolerante: item torto sai, nome repetido fica o mais recente, teto aplicado. */
export function jogadoresVistosDoArquivo(value: unknown): JogadorVisto[] {
  if (!Array.isArray(value)) return []
  const lidos = value.map(vistoDoArquivo).filter((visto): visto is JogadorVisto => visto !== null)
  const chaves = new Set<string>()
  const vistos: JogadorVisto[] = []
  for (const visto of lidos.sort((a, b) => b.vistoEm - a.vistoEm)) {
    const chave = chaveDoNome(visto.nome)
    if (chaves.has(chave)) continue
    chaves.add(chave)
    vistos.push(visto)
    if (vistos.length === JOGADORES_VISTOS_MAX) break
  }
  return vistos
}

export function serializarJogadoresVistos(vistos: readonly JogadorVisto[]): string {
  return `${JSON.stringify(vistos, null, 2)}\n`
}

async function caminhoDosVistos(): Promise<{ pasta: string; arquivo: string }> {
  const pasta = await join(await appDataDir(), PASTA_DOS_LIVROS)
  return { pasta, arquivo: await join(pasta, ARQUIVO_DOS_VISTOS) }
}

/** Lê a lista. Nunca lança: o erro vira `aviso` e a lista começa vazia. */
export async function lerJogadoresVistos(): Promise<{ vistos: JogadorVisto[]; aviso: string | null }> {
  try {
    const { arquivo } = await caminhoDosVistos()
    if (!(await exists(arquivo))) return { vistos: [], aviso: null }
    return { vistos: jogadoresVistosDoArquivo(JSON.parse(await readTextFile(arquivo))), aviso: null }
  } catch (erro) {
    return { vistos: [], aviso: `${AVISO}: ${erro instanceof Error ? erro.message : String(erro)}.` }
  }
}

let filaDosVistos: Promise<void> = Promise.resolve()

/** Grava a lista INTEIRA, uma gravação depois da outra. Lança com a frase pronta. */
export function gravarJogadoresVistos(vistos: readonly JogadorVisto[]): Promise<void> {
  const resultado = filaDosVistos.then(async () => {
    try {
      const { pasta, arquivo } = await caminhoDosVistos()
      await ensureDir(pasta)
      await writeTextFileSafely(arquivo, serializarJogadoresVistos(vistos))
    } catch (erro) {
      throw new Error(`Não foi possível gravar os jogadores vistos na mesa: ${erro instanceof Error ? erro.message : String(erro)}.`)
    }
  })
  filaDosVistos = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}
