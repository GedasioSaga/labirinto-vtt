import { open } from '@tauri-apps/plugin-dialog'
import { readFile, readTextFile } from '@tauri-apps/plugin-fs'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { pickImageFile } from './imageImport'
import { buildTokenPhotoData } from './tokenPhoto'

/**
 * Arquivos que a ficha de personagem pede ao disco do mestre: o JSON de um
 * sistema (o "+" da grade), o JSON de fichas do projeto-rpg-v2 e a imagem do
 * retrato ou da transformação. Mesmo caminho de "Escolher imagem..." do token
 * (`lib/imageImport.ts`): diálogo do sistema, `grant_fs_access` na pasta
 * escolhida e leitura pelo plugin de arquivos.
 */

export const ARQUIVO_SO_NO_APP = 'abrir arquivo só funciona no aplicativo instalado do Labirinto — no navegador a página não tem acesso aos arquivos do computador'

/**
 * Pede um `.json` e devolve o texto dele; `null` quando a pessoa cancela.
 * Lança fora do aplicativo (sem diálogo de arquivo) e quando a leitura falha —
 * cancelar não é falha, por isso os dois casos não se confundem.
 */
export async function escolherTextoJson(titulo: string, nomeDoFiltro: string): Promise<string | null> {
  if (!isTauri()) throw new Error(ARQUIVO_SO_NO_APP)
  const caminho = await open({ title: titulo, multiple: false, filters: [{ name: nomeDoFiltro, extensions: ['json'] }] })
  if (typeof caminho !== 'string') return null
  await invoke('grant_fs_access', { path: await dirname(caminho) })
  return readTextFile(caminho)
}

/**
 * Pede uma imagem e devolve a cópia pequena e embutida (`buildTokenPhotoData`:
 * até 256 px, cabe numa mensagem da mesa) — o retrato não engorda o
 * `adventure.json` e já está pronto para a entrega 2 levá-lo ao jogador.
 * `null` quando a pessoa cancela.
 */
export async function escolherImagemDaFicha(): Promise<string | null> {
  const caminho = await pickImageFile()
  if (caminho === null) return null
  await invoke('grant_fs_access', { path: await dirname(caminho) })
  const bytes = await readFile(caminho)
  return buildTokenPhotoData(new Blob([bytes]))
}
