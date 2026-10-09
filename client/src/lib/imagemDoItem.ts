import { readFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { MAX_TOKEN_IMAGE_BYTES, pickImageFile, pinSizedWebp, TOKEN_IMAGE_SIZE_MESSAGE } from './imageImport'
import { guardarMidia } from './midiaNoDisco'

/**
 * A IMAGEM DO ITEM do acervo, pelos três caminhos da imagem do token: colar
 * (Ctrl+V), soltar arrastando, ou escolher no computador. Os dois primeiros
 * chegam como `Blob` (`PinImageDrop`), o terceiro pelo diálogo de arquivo
 * (`pickImageFile`). Todos acabam no mesmo lugar: reduzida ao tamanho do
 * cartão do pino (`pinSizedWebp`, 640 px WebP) e gravada na mídia da mesa,
 * que devolve a referência `midia:<id>` que o item guarda.
 */

/** Os tipos que colar e soltar aceitam: os mesmos do diálogo de imagem. */
const TIPOS_ACEITOS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export const IMAGEM_DO_ITEM_TIPO = 'essa imagem não é PNG, JPG, WebP nem GIF — os formatos que o item aceita'

/** O que o caminho usa de fora; o teste troca por um de mentira (não há canvas no jsdom). */
export interface CaminhoDaImagem {
  reduzir: (fonte: Blob) => Promise<Blob>
  guardar: (bytes: Uint8Array) => Promise<string>
}

const CAMINHO_DO_APP: CaminhoDaImagem = { reduzir: pinSizedWebp, guardar: guardarMidia }

/** Colar ou soltar: confere tipo e tamanho ANTES de decodificar (um arrasto errado pode trazer qualquer coisa). */
export async function imagemDoItemDoBlob(fonte: Blob, caminho: CaminhoDaImagem = CAMINHO_DO_APP): Promise<string> {
  if (!TIPOS_ACEITOS.has(fonte.type)) throw new Error(IMAGEM_DO_ITEM_TIPO)
  if (fonte.size > MAX_TOKEN_IMAGE_BYTES) throw new Error(TOKEN_IMAGE_SIZE_MESSAGE)
  const reduzida = await caminho.reduzir(fonte)
  return caminho.guardar(new Uint8Array(await reduzida.arrayBuffer()))
}

/** O que o "Escolher imagem…" usa do disco; o teste troca. */
export interface DialogoDaImagem {
  escolher: () => Promise<string | null>
  ler: (arquivo: string) => Promise<Uint8Array>
}

const DIALOGO_DO_APP: DialogoDaImagem = {
  escolher: pickImageFile,
  ler: async (arquivo) => {
    // A pasta escolhida no diálogo é liberada para leitura, como no "Escolher imagem…" do token.
    await invoke('grant_fs_access', { path: await dirname(arquivo) })
    return readFile(arquivo)
  },
}

/** Tipo pela extensão do arquivo escolhido: o diálogo só oferece estas. */
function tipoDoArquivo(arquivo: string): string {
  const extensao = arquivo.slice(arquivo.lastIndexOf('.') + 1).toLowerCase()
  return extensao === 'jpg' || extensao === 'jpeg' ? 'image/jpeg' : `image/${extensao}`
}

/** "Escolher imagem…": `null` quando a pessoa cancela. */
export async function escolherImagemDoItem(dialogo: DialogoDaImagem = DIALOGO_DO_APP, caminho: CaminhoDaImagem = CAMINHO_DO_APP): Promise<string | null> {
  const arquivo = await dialogo.escolher()
  if (arquivo === null) return null
  const bytes = await dialogo.ler(arquivo)
  return imagemDoItemDoBlob(new Blob([bytes.slice().buffer], { type: tipoDoArquivo(arquivo) }), caminho)
}
