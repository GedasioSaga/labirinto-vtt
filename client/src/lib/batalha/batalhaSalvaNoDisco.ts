import { exists, readTextFile, remove, stat } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { writeTextFileSafely } from '../mapFileIO'
import type { BatalhaLidaDoDisco } from '../../stores/batalhaSalvaNaMesa'
import { ARQUIVO_DA_BATALHA_SALVA, batalhaSalvaDoTexto, textoDaBatalhaSalva, type BatalhaSalva } from './batalhaSalva'

/**
 * A BATALHA SALVA NO DISCO (conserto das fichas F1, fatia S5): o arquivo
 * `batalha-em-andamento.json` na pasta da aventura (ou do mapa solto). A pasta
 * fica em `<appData>/maps` (o escopo de `desktop/src-tauri/capabilities/default.json`)
 * ou onde o mestre abriu o mapa (`loadMapFromDisk` libera a pasta dele). Nem
 * sempre: o disco pode recusar a pasta, e aí a leitura devolve `sem-acesso`
 * em vez do erro, como o `readIfExists` do mapa. A gravação é a segura de
 * sempre (`writeTextFileSafely`): uma queda no meio não deixa meio arquivo.
 *
 * Fora a recusa da pasta, as três operações lançam o erro do disco: quem chama
 * (`stores/batalhaSalvaNaMesa.ts`) mostra o aviso uma vez.
 */

/** 300 linhas de registro com fichas e tokens dentro cabem com folga; acima disto o arquivo não entra na memória. */
export const BATALHA_SALVA_MAX_BYTES = 16 * 1024 * 1024

const SEM_ACESSO: BatalhaLidaDoDisco = { ok: false, motivo: 'sem-acesso' }

function caminhoDaBatalha(pasta: string): Promise<string> {
  return join(pasta, ARQUIVO_DA_BATALHA_SALVA)
}

/** O plugin de arquivos recusou o caminho por estar fora do escopo do app (o texto do erro do Tauri). */
function ehRecusaDaPasta(erro: unknown): boolean {
  const texto = erro instanceof Error ? erro.message : String(erro)
  return /forbidden path|not allowed/i.test(texto)
}

/** `null` = não há batalha salva nesta pasta. Arquivo grande demais conta como ilegível. */
export async function lerBatalhaSalva(pasta: string): Promise<BatalhaLidaDoDisco> {
  const caminho = await caminhoDaBatalha(pasta)
  let existe: boolean
  try {
    existe = await exists(caminho)
  } catch (erro) {
    if (ehRecusaDaPasta(erro)) return SEM_ACESSO
    throw erro
  }
  if (!existe) return null
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
