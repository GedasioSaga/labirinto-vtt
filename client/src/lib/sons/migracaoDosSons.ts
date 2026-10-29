import { exists, readDir, readTextFile, stat } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { defaultMapsDir, writeTextFileSafely } from '../mapFileIO'
import { idDoAudio, refDoId } from '../midia'
import { guardarAudioNaPasta, lerAudioDaPasta, pastaDaMidiaDaAventura } from '../midiaDaPasta'
import { lerAudioGuardado } from '../midiaNoDisco'
import { ARQUIVO_DE_SONS, bibliotecaDoTexto, idsDeAudioDaBiblioteca, SONS_JSON_MAX_BYTES, type BibliotecaDeSons } from './biblioteca'
import { pastaDaBibliotecaGlobal, pastaDaMidiaDaBiblioteca } from './bibliotecaNoDisco'

/**
 * MIGRAÇÃO PARA A BIBLIOTECA GLOBAL (29/10/2026): o `sons.json` de cada
 * aventura entra UMA vez na biblioteca de `<appData>/sons` (a regra de juntar
 * sem repetir é `comBibliotecaJuntada`, em `biblioteca.ts`).
 *
 * - Quais: as pastas de `<appData>/maps` ao abrir o app, e a aventura aberta
 *   de qualquer outra pasta, quando ela abre.
 * - A pasta da aventura é SÓ LIDA: o `sons.json` dela fica como está (o app
 *   antigo segue lendo ele, e ele é o backup), e nem a cópia do ilegível é
 *   gravada lá — o `sons.json` torto só não migra.
 * - Os áudios vão de `<aventura>/midia` (ou do `<appData>/midia` de antes da
 *   F5) para `<appData>/sons/midia`, conferidos pelo hash.
 * - Não roda de novo: a aventura que migrou fica anotada em
 *   `<appData>/sons/migracao.json`, depois de o `sons.json` global gravar. Sem
 *   a nota, o som que o mestre apagou da global voltaria da aventura.
 */

export const ARQUIVO_DA_MIGRACAO = 'migracao.json'
const VERSAO_DA_MIGRACAO = 1
/** Teto da lista de aventuras anotadas: a nota nunca cresce sem fim. */
const AVENTURAS_MIGRADAS_MAX = 2000

/** A pasta da aventura como a nota guarda: barras normais, sem a do fim e sem caixa (o Windows não diferencia). */
export function chaveDaPastaDaAventura(pasta: string): string {
  return pasta.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLocaleLowerCase('pt-BR')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** As aventuras já migradas. Nota que falta ou torta = nenhuma: migrar de novo não repete som, só devolveria o que o mestre apagou. */
export async function lerAventurasMigradas(): Promise<Set<string>> {
  try {
    const caminho = await join(await pastaDaBibliotecaGlobal(), ARQUIVO_DA_MIGRACAO)
    if (!(await exists(caminho)) || (await stat(caminho)).size > SONS_JSON_MAX_BYTES) return new Set()
    const bruto: unknown = JSON.parse(await readTextFile(caminho))
    if (!isRecord(bruto) || !Array.isArray(bruto.aventuras)) return new Set()
    return new Set(bruto.aventuras.filter((chave): chave is string => typeof chave === 'string').slice(-AVENTURAS_MIGRADAS_MAX))
  } catch {
    return new Set()
  }
}

/** Soma `novas` à nota. Lança se o disco recusar. */
export async function anotarAventurasMigradas(novas: readonly string[]): Promise<void> {
  if (novas.length === 0) return
  const todas = await lerAventurasMigradas()
  for (const chave of novas) todas.add(chave)
  const aventuras = [...todas].slice(-AVENTURAS_MIGRADAS_MAX)
  await writeTextFileSafely(await join(await pastaDaBibliotecaGlobal(), ARQUIVO_DA_MIGRACAO), `${JSON.stringify({ versao: VERSAO_DA_MIGRACAO, aventuras }, null, 2)}\n`)
}

/** O `sons.json` da aventura, só lido. `null` = não há, passa do teto, é ilegível ou de versão mais nova (esse não migra). Nunca lança. */
export async function lerSonsDaAventura(pastaDaAventura: string): Promise<BibliotecaDeSons | null> {
  try {
    const caminho = await join(pastaDaAventura, ARQUIVO_DE_SONS)
    if (!(await exists(caminho)) || (await stat(caminho)).size > SONS_JSON_MAX_BYTES) return null
    const lido = bibliotecaDoTexto(await readTextFile(caminho))
    return lido.ok ? lido.biblioteca : null
  } catch {
    return null
  }
}

/** O áudio de antes da F5, em `<appData>/midia`, se ele ainda é o que o nome diz. Nunca lança. */
async function audioDeAntes(id: string): Promise<Uint8Array | null> {
  try {
    const bytes = await lerAudioGuardado(refDoId(id))
    return bytes !== null && (await idDoAudio(bytes)) === id ? bytes : null
  } catch {
    return null
  }
}

/** Leva os áudios dos sons de arquivo para `<appData>/sons/midia`; devolve quantos não foram achados (ou o disco recusou). Nunca lança. */
async function levarAudiosParaABiblioteca(pastaDaAventura: string, origem: BibliotecaDeSons): Promise<number> {
  const ids = idsDeAudioDaBiblioteca(origem)
  if (ids.length === 0) return 0
  let destino: string
  let daAventura: string
  try {
    destino = await pastaDaMidiaDaBiblioteca()
    daAventura = await pastaDaMidiaDaAventura(pastaDaAventura)
  } catch {
    return ids.length
  }
  let faltaram = 0
  // Um por vez: são arquivos de até 15 MB, e a migração corre uma vez só.
  for (const id of ids) {
    try {
      const bytes = (await lerAudioDaPasta(daAventura, id)) ?? (await audioDeAntes(id))
      if (bytes === null) faltaram += 1
      else await guardarAudioNaPasta(destino, bytes)
    } catch {
      faltaram += 1
    }
  }
  return faltaram
}

/** Uma aventura pronta para entrar na biblioteca global: o que ela tinha, e os áudios já na `midia` da global. */
export interface AventuraParaMigrar {
  chave: string
  origem: BibliotecaDeSons
  /** Áudios que não foram achados: o botão entra, mas o som não toca até ser importado de novo. */
  audiosQueFaltaram: number
}

/** Lê o `sons.json` da aventura e leva os áudios. `null` = nada a migrar agora (sem `sons.json`, ou ilegível). Nunca lança. */
export async function prepararAventuraParaMigrar(pastaDaAventura: string): Promise<AventuraParaMigrar | null> {
  const origem = await lerSonsDaAventura(pastaDaAventura)
  if (origem === null) return null
  const audiosQueFaltaram = await levarAudiosParaABiblioteca(pastaDaAventura, origem)
  return { chave: chaveDaPastaDaAventura(pastaDaAventura), origem, audiosQueFaltaram }
}

/** As pastas de aventura em `<appData>/maps` (atalho fica de fora). Nunca lança: sem a lista, nenhuma. */
export async function pastasDasAventurasDoApp(): Promise<string[]> {
  try {
    const raiz = await defaultMapsDir()
    if (!(await exists(raiz))) return []
    const entradas = await readDir(raiz)
    return await Promise.all(entradas.filter((entrada) => entrada.isDirectory && !entrada.isSymlink).map((entrada) => join(raiz, entrada.name)))
  } catch {
    return []
  }
}
