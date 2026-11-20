import { escolherImagemDoItem, type CaminhoDaImagem } from '../../lib/imagemDoItem'
import { guardarMidia } from '../../lib/midiaNoDisco'

/**
 * A IMAGEM DE UM DOCUMENTO (a da página e a do papel "Imagem própria"; plano
 * dos puzzles, §1.1 e §5.2): vai para a mídia da mesa reduzida a 1200 px no
 * lado maior, em WebP, e o documento guarda só `midia:<id>`. O caminho de
 * escolha é o da imagem do item, com outro tamanho (como o fundo do puzzle).
 */
const LADO_MAX = 1200
const QUALIDADE = 0.86

async function emWebp(fonte: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(fonte)
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('não deu para preparar a imagem (sem canvas)')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error('não deu para gravar a imagem em WebP')) : resolve(blob)), 'image/webp', QUALIDADE)
  })
}

const CAMINHO: CaminhoDaImagem = { reduzir: emWebp, guardar: guardarMidia }

/** "Escolher imagem": `null` = cancelou; lança com a frase pronta. */
export function escolherImagemDoDocumento(): Promise<string | null> {
  return escolherImagemDoItem(undefined, CAMINHO)
}
