import { isTauri } from '@tauri-apps/api/core'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ensureDir, writeTextFileSafely } from '../mapFileIO'
import { ehModeloGemini, MODELO_PADRAO, type ModeloGemini } from './portaDaIa'

/**
 * O QUE A IA GUARDA NO DISCO (M4): só o modelo escolhido, que não é segredo.
 *
 *   <appData>/livros/ia.json   { formato: 1, modelo }
 *
 * A chave NUNCA vem para cá: mora no Cofre do Windows (desktop/src-tauri/src/ia.rs).
 * A conversa também não: vive em memória e some ao fechar o app.
 */

const PASTA_DOS_LIVROS = 'livros'
const ARQUIVO_DA_IA = 'ia.json'
const FORMATO_DA_IA = 1

async function caminhoDaIa(): Promise<{ pasta: string; arquivo: string }> {
  const pasta = await join(await appDataDir(), PASTA_DOS_LIVROS)
  return { pasta, arquivo: await join(pasta, ARQUIVO_DA_IA) }
}

/** O modelo guardado; arquivo ausente, ilegível ou com modelo fora da lista = o padrão. Nunca lança. */
export async function lerModeloDaIa(): Promise<ModeloGemini> {
  if (!isTauri()) return MODELO_PADRAO
  try {
    const { arquivo } = await caminhoDaIa()
    if (!(await exists(arquivo))) return MODELO_PADRAO
    const lido: unknown = JSON.parse(await readTextFile(arquivo))
    if (lido !== null && typeof lido === 'object' && 'modelo' in lido && ehModeloGemini(lido.modelo)) return lido.modelo
    return MODELO_PADRAO
  } catch {
    return MODELO_PADRAO
  }
}

let filaDaIa: Promise<void> = Promise.resolve()

/** Grava o modelo escolhido, uma gravação depois da outra. Fora do app não há disco: não faz nada. Lança com a frase pronta. */
export function gravarModeloDaIa(modelo: ModeloGemini): Promise<void> {
  if (!isTauri()) return Promise.resolve()
  const resultado = filaDaIa.then(async () => {
    try {
      const { pasta, arquivo } = await caminhoDaIa()
      await ensureDir(pasta)
      await writeTextFileSafely(arquivo, `${JSON.stringify({ formato: FORMATO_DA_IA, modelo }, null, 2)}\n`)
    } catch (erro) {
      throw new Error(`Não foi possível guardar o modelo da IA: ${erro instanceof Error ? erro.message : String(erro)}.`)
    }
  })
  filaDaIa = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}
