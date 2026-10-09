/**
 * A IMAGEM DO ITEM pelos três caminhos da imagem do token (`lib/imagemDoItem.ts`):
 * colar e soltar chegam como Blob; "Escolher imagem…" vem do diálogo. Todos
 * reduzem e gravam a mídia. O canvas e o disco são de mentira (jsdom não tem
 * canvas): o que se confere é o caminho e as recusas.
 */
import { describe, expect, it, vi } from 'vitest'
import { MAX_TOKEN_IMAGE_BYTES, TOKEN_IMAGE_SIZE_MESSAGE } from './imageImport'
import { escolherImagemDoItem, IMAGEM_DO_ITEM_TIPO, imagemDoItemDoBlob, type CaminhoDaImagem } from './imagemDoItem'

const REF = `midia:${'c'.repeat(64)}.webp`
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])

function caminhoDeMentira(): CaminhoDaImagem & { reduzidas: Blob[]; guardados: Uint8Array[] } {
  const reduzidas: Blob[] = []
  const guardados: Uint8Array[] = []
  return {
    reduzidas,
    guardados,
    reduzir: async (fonte) => {
      reduzidas.push(fonte)
      return new Blob([WEBP.slice().buffer], { type: 'image/webp' })
    },
    guardar: async (bytes) => {
      guardados.push(bytes)
      return REF
    },
  }
}

describe('colar ou soltar (Blob)', () => {
  it('reduz e grava: o item guarda a referência da mídia', async () => {
    const caminho = caminhoDeMentira()
    const colada = new File([Uint8Array.from([1, 2, 3])], 'colada.png', { type: 'image/png' })
    expect(await imagemDoItemDoBlob(colada, caminho)).toBe(REF)
    expect(caminho.reduzidas).toEqual([colada])
    expect(caminho.guardados).toEqual([WEBP])
  })

  it('recusa tipo fora da lista antes de decodificar', async () => {
    const caminho = caminhoDeMentira()
    await expect(imagemDoItemDoBlob(new Blob(['<svg/>'], { type: 'image/svg+xml' }), caminho)).rejects.toThrow(IMAGEM_DO_ITEM_TIPO)
    expect(caminho.reduzidas).toEqual([])
  })

  it('recusa arquivo gigante (um arrasto errado)', async () => {
    const caminho = caminhoDeMentira()
    // Um Blob que DIZ ter 25 MB e um byte, sem alocar 25 MB no teste.
    class BlobGigante extends Blob {
      override get size(): number {
        return MAX_TOKEN_IMAGE_BYTES + 1
      }
    }
    const gigante = new BlobGigante([Uint8Array.from([1])], { type: 'image/png' })
    await expect(imagemDoItemDoBlob(gigante, caminho)).rejects.toThrow(TOKEN_IMAGE_SIZE_MESSAGE)
    expect(caminho.reduzidas).toEqual([])
  })
})

describe('"Escolher imagem…" (diálogo)', () => {
  it('cancelar devolve null sem ler nada', async () => {
    const ler = vi.fn()
    expect(await escolherImagemDoItem({ escolher: async () => null, ler }, caminhoDeMentira())).toBeNull()
    expect(ler).not.toHaveBeenCalled()
  })

  it('lê o arquivo escolhido e segue o mesmo caminho, com o tipo pela extensão', async () => {
    const caminho = caminhoDeMentira()
    const ref = await escolherImagemDoItem({ escolher: async () => 'C:/Imagens/Espada.JPEG', ler: async () => Uint8Array.from([9, 9]) }, caminho)
    expect(ref).toBe(REF)
    expect(caminho.reduzidas[0]?.type).toBe('image/jpeg')
    expect(caminho.reduzidas[0]?.size).toBe(2)
  })
})
