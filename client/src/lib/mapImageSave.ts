import { isTauri } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

const PNG_FILTER = { name: 'Imagem PNG', extensions: ['png'] }
const PNG_EXTENSION = /\.png$/i

/**
 * Grava o PNG exportado onde o mestre escolher.
 *
 * No app desktop: janela de salvar do sistema (nome sugerido = nome do mapa) e
 * gravação dos bytes nesse caminho. Devolve o caminho gravado, ou `null` se o
 * mestre cancelou a janela. Fora do app (navegador), o próprio navegador baixa
 * o arquivo e a função devolve o nome dele.
 *
 * Falha de gravação (sem permissão, disco cheio) sobe para quem chamou avisar.
 */
export async function saveMapImage(bytes: Uint8Array, fileName: string): Promise<string | null> {
  if (!isTauri()) {
    downloadInBrowser(bytes, fileName)
    return fileName
  }
  const chosen = await save({ defaultPath: fileName, filters: [PNG_FILTER] })
  if (chosen === null) return null
  const path = PNG_EXTENSION.test(chosen) ? chosen : `${chosen}.png`
  await writeFile(path, bytes)
  return path
}

/** Folga antes de soltar o blob: soltar no mesmo tique cancela o download em alguns navegadores. */
const REVOKE_DELAY_MS = 1000

function downloadInBrowser(bytes: Uint8Array, fileName: string): void {
  // `Blob` só aceita `Uint8Array<ArrayBuffer>`; os bytes de exportação nunca vêm de um SharedArrayBuffer.
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
