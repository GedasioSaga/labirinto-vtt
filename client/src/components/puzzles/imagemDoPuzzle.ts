import { escolherImagemDoItem, imagemDoItemDoBlob, type CaminhoDaImagem } from '../../lib/imagemDoItem'
import { guardarMidia } from '../../lib/midiaNoDisco'

/**
 * A IMAGEM PRÓPRIA do puzzle (plano dos puzzles, §5.2): o fundo vai para a
 * mídia da mesa reduzido a 1600 px no lado maior, em WebP, e o mapa guarda só
 * `midia:<id>`. Os caminhos de entrada são os da imagem do item (escolher no
 * computador ou soltar o arquivo sobre o quadro), com outro tamanho.
 */
const LADO_MAX_DO_FUNDO = 1600
const QUALIDADE_DO_FUNDO = 0.86

async function fundoEmWebp(fonte: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(fonte)
  const escala = Math.min(1, LADO_MAX_DO_FUNDO / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('não deu para preparar a imagem (sem canvas)')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error('não deu para gravar a imagem em WebP')) : resolve(blob)), 'image/webp', QUALIDADE_DO_FUNDO)
  })
}

const CAMINHO_DO_FUNDO: CaminhoDaImagem = { reduzir: fundoEmWebp, guardar: guardarMidia }

/** "Imagem própria": escolhe no computador. `null` = cancelou; lança com a frase pronta. */
export function escolherFundoDoPuzzle(): Promise<string | null> {
  return escolherImagemDoItem(undefined, CAMINHO_DO_FUNDO)
}

/** O arquivo solto sobre o quadro do editor. */
export function fundoDoPuzzleDoArquivo(arquivo: Blob): Promise<string> {
  return imagemDoItemDoBlob(arquivo, CAMINHO_DO_FUNDO)
}
