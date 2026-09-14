/**
 * Lê os pixels RGBA de uma imagem por URL, via canvas 2D do navegador. Único
 * pedaço com DOM do "Chão a partir da imagem de fundo" — a vetorização em si
 * (`lib/traceImage.ts`) é pura e recebe só o array.
 */
export interface ImagePixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function loadImagePixels(url: string): Promise<ImagePixels> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Sem isto, imagem servida por outra origem (asset:// do Tauri) "suja" o
    // canvas e getImageData lança SecurityError.
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (width === 0 || height === 0) {
        reject(new Error('a imagem está vazia'))
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('canvas 2D indisponível'))
        return
      }
      try {
        context.drawImage(image, 0, 0)
        resolve({ data: context.getImageData(0, 0, width, height).data, width, height })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    image.onerror = () => reject(new Error('a imagem de fundo não carregou'))
    image.src = url
  })
}
