import { exists, readTextFile, remove, stat } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { writeTextFileSafely } from '../mapFileIO'
import { ARQUIVO_DA_BATALHA_SALVA, batalhaSalvaDoTexto, textoDaBatalhaSalva, type BatalhaSalva, type TextoDaBatalhaSalva } from './batalhaSalva'

/**
 * A BATALHA SALVA NO DISCO (conserto das fichas F1, fatia S5): o arquivo
 * `batalha-em-andamento.json` na pasta da aventura (ou do mapa solto), dentro
 * de `<appData>/maps`, o escopo que o app já tem
 * (`desktop/src-tauri/capabilities/default.json`). A gravação é a segura de
 * sempre (`writeTextFileSafely`): uma queda no meio não deixa meio arquivo.
 *
 * As três operações lançam o erro do disco: quem chama (`stores/batalhaSalvaNaMesa.ts`)
 * mostra o aviso uma vez.
 */

/** 300 linhas de registro com fichas e tokens dentro cabem com folga; acima disto o arquivo não entra na memória. */
export const BATALHA_SALVA_MAX_BYTES = 16 * 1024 * 1024

function caminhoDaBatalha(pasta: string): Promise<string> {
  return join(pasta, ARQUIVO_DA_BATALHA_SALVA)
}

/** `null` = não há batalha salva nesta pasta. Arquivo grande demais conta como ilegível. */
export async function lerBatalhaSalva(pasta: string): Promise<TextoDaBatalhaSalva | null> {
  const caminho = await caminhoDaBatalha(pasta)
  if (!(await exists(caminho))) return null
  if ((await stat(caminho)).size > BATALHA_SALVA_MAX_BYTES) return { ok: false, motivo: 'ilegivel' }
  return batalhaSalvaDoTexto(await readTextFile(caminho))
}

export async function gravarBatalhaSalva(pasta: string, salva: BatalhaSalva): Promise<void> {
  await writeTextFileSafely(await caminhoDaBatalha(pasta), textoDaBatalhaSalva(salva))
}

/** A batalha acabou: o arquivo sai. Sem arquivo, nada. */
export async function apagarBatalhaSalva(pasta: string): Promise<void> {
  const caminho = await caminhoDaBatalha(pasta)
  if (await exists(caminho)) await remove(caminho)
}
