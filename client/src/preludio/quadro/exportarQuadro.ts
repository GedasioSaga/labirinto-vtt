import { invoke, isTauri } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import type { Editor } from 'tldraw'

/**
 * EXPORTAR O QUADRO como PNG ou SVG, como no Grimório (`exportarCanvas.ts`):
 * a seleção, ou o quadro inteiro sem seleção, no fundo escuro do quadro. O
 * arquivo vai para onde o mestre escolher (janela de salvar do sistema); fora
 * do app, o navegador baixa.
 */

export type FormatoDeExportacao = 'png' | 'svg'

const FILTRO: Readonly<Record<FormatoDeExportacao, { name: string; extensions: string[] }>> = {
  png: { name: 'Imagem PNG', extensions: ['png'] },
  svg: { name: 'Imagem SVG', extensions: ['svg'] },
}

const TIPO: Readonly<Record<FormatoDeExportacao, string>> = { png: 'image/png', svg: 'image/svg+xml' }

/** O PNG sai com o dobro de pixels: o texto dos cartões continua lendo bem ao ampliar. */
const ESCALA_DO_PNG = 2

/** Folga antes de soltar o blob: soltar no mesmo tique cancela o download em alguns navegadores. */
const ESPERA_PARA_SOLTAR_MS = 1000

/** Caracteres que o Windows não aceita em nome de arquivo. */
const PROIBIDOS_NO_NOME = /[<>:"/\\|?*\u0000-\u001f]/g

/** O nome do quadro como nome de arquivo: sem o que o Windows recusa, nunca vazio. */
export function nomeDoArquivo(nome: string, formato: FormatoDeExportacao): string {
  const limpo = nome.replace(PROIBIDOS_NO_NOME, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '')
  return `${limpo || 'Quadro'}.${formato}`
}

async function bytesDoQuadro(editor: Editor, formato: FormatoDeExportacao): Promise<Uint8Array> {
  const selecionadas = editor.getSelectedShapeIds()
  const ids = selecionadas.length > 0 ? selecionadas : [...editor.getCurrentPageShapeIds()]
  if (ids.length === 0) throw new Error('O quadro está vazio.')
  if (formato === 'png') {
    const { blob } = await editor.toImage(ids, { format: 'png', background: true, scale: ESCALA_DO_PNG, darkMode: true })
    return new Uint8Array(await blob.arrayBuffer())
  }
  const svg = await editor.getSvgString(ids, { background: true, darkMode: true })
  if (svg === undefined) throw new Error('O tldraw não montou o SVG.')
  return new TextEncoder().encode(svg.svg)
}

function baixarNoNavegador(bytes: Uint8Array, nome: string, formato: FormatoDeExportacao): void {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: TIPO[formato] }))
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), ESPERA_PARA_SOLTAR_MS)
}

/** Exporta e devolve onde gravou; `null` quando o mestre cancelou a janela. Lança quando o quadro está vazio ou o disco recusa. */
export async function exportarQuadro(editor: Editor, nome: string, formato: FormatoDeExportacao): Promise<string | null> {
  const bytes = await bytesDoQuadro(editor, formato)
  const sugerido = nomeDoArquivo(nome, formato)
  if (!isTauri()) {
    baixarNoNavegador(bytes, sugerido, formato)
    return sugerido
  }
  const escolhido = await save({ title: `Exportar ${formato.toUpperCase()}`, defaultPath: sugerido, filters: [FILTRO[formato]] })
  if (escolhido === null) return null
  const caminho = escolhido.toLowerCase().endsWith(`.${formato}`) ? escolhido : `${escolhido}.${formato}`
  // A pasta escolhida fica fora do AppData: o app ganha acesso a ela só para gravar este arquivo (como na ficha).
  await invoke('grant_fs_access', { path: await dirname(caminho) })
  await writeFile(caminho, bytes)
  return caminho
}
