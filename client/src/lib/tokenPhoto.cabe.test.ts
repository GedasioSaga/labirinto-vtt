/**
 * FOTO DO TOKEN CABE NA MENSAGEM: o servidor da mesa (Rust) fecha o socket do
 * jogador quando uma mensagem passa de 64 KiB. A foto que o jogador escolhe
 * precisa sair da máquina dele já pequena o bastante para `token.edit` caber
 * com folga — ou ser recusada com aviso, nunca enviada para derrubá-lo.
 */
import { describe, expect, it } from 'vitest'
import { PLAYER_MESSAGE_MAX_BYTES, REQ_ID_MAX_LENGTH } from '../net/protocol'
import {
  fitTokenPhoto,
  fitsTokenPhotoSend,
  isTokenPhotoData,
  TOKEN_PHOTO_MAX_SIDE,
  TOKEN_PHOTO_SEND_MAX_CHARS,
  TOKEN_PHOTO_TOO_BIG_MESSAGE,
} from './tokenPhoto'

/** Folga exigida: a pior mensagem de foto não passa de 80% do teto do servidor. */
const FOLGA = 0.8

/** Encoder de mentira: o tamanho cresce com a área e com a qualidade, como num WebP real. */
function webpFalso(fator: number) {
  const chamadas: Array<{ lado: number; qualidade: number }> = []
  const encode = (lado: number, qualidade: number) => {
    chamadas.push({ lado, qualidade })
    return `data:image/webp;base64,${'A'.repeat(Math.round(lado * lado * qualidade * fator))}`
  }
  return { encode, chamadas }
}

describe('teto de envio da foto', () => {
  it('a pior token.edit possível (tokenId no teto + foto no teto de envio) cabe com folga no limite do servidor', () => {
    const pior = JSON.stringify({
      type: 'token.edit',
      tokenId: 'x'.repeat(REQ_ID_MAX_LENGTH),
      image: `data:image/webp;base64,${'A'.repeat(TOKEN_PHOTO_SEND_MAX_CHARS - 'data:image/webp;base64,'.length)}`,
    })
    expect(new TextEncoder().encode(pior).length).toBeLessThanOrEqual(PLAYER_MESSAGE_MAX_BYTES * FOLGA)
  })

  it('o limite do servidor espelhado no cliente é o de desktop/src-tauri/src/net/server.rs (64 KiB)', () => {
    expect(PLAYER_MESSAGE_MAX_BYTES).toBe(64 * 1024)
  })

  it('fitsTokenPhotoSend aceita a foto no teto e recusa um caractere acima', () => {
    const prefixo = 'data:image/webp;base64,'
    expect(fitsTokenPhotoSend(`${prefixo}${'A'.repeat(TOKEN_PHOTO_SEND_MAX_CHARS - prefixo.length)}`)).toBe(true)
    expect(fitsTokenPhotoSend(`${prefixo}${'A'.repeat(TOKEN_PHOTO_SEND_MAX_CHARS - prefixo.length + 1)}`)).toBe(false)
    // A forma continua valendo: caminho de disco curto não "cabe", é recusado.
    expect(fitsTokenPhotoSend('C:\\fotos\\heroi.png')).toBe(false)
  })
})

describe('fitTokenPhoto — reduz até caber', () => {
  it('foto que não cabe no lado máximo é reduzida (qualidade, depois lado) até caber no teto de envio', () => {
    const { encode, chamadas } = webpFalso(2)
    const foto = fitTokenPhoto(encode)

    expect(isTokenPhotoData(foto)).toBe(true)
    expect(foto.length).toBeLessThanOrEqual(TOKEN_PHOTO_SEND_MAX_CHARS)
    // Começa pelo lado máximo e só desce quando precisa.
    expect(chamadas[0]?.lado).toBe(TOKEN_PHOTO_MAX_SIDE)
    expect(chamadas.at(-1)?.lado).toBeLessThan(TOKEN_PHOTO_MAX_SIDE)
  })

  it('foto que já cabe sai na primeira tentativa, no lado máximo e na melhor qualidade', () => {
    const { encode, chamadas } = webpFalso(0.1)
    fitTokenPhoto(encode)
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]?.lado).toBe(TOKEN_PHOTO_MAX_SIDE)
  })

  it('navegador sem WebP (devolve PNG, que ignora a qualidade) só reduz o lado — não repete a mesma imagem', () => {
    const chamadas: number[] = []
    const foto = fitTokenPhoto((lado) => {
      chamadas.push(lado)
      return `data:image/png;base64,${'A'.repeat(lado * lado * 2)}`
    })
    expect(foto.length).toBeLessThanOrEqual(TOKEN_PHOTO_SEND_MAX_CHARS)
    // Um encode por lado: 256 e 192 não cabem, 128 cabe.
    expect(chamadas).toEqual([256, 192, 128])
  })

  it('foto que não cabe em lado nenhum é recusada com o aviso em português, sem devolver nada', () => {
    expect(() => fitTokenPhoto(() => `data:image/webp;base64,${'A'.repeat(TOKEN_PHOTO_SEND_MAX_CHARS)}`)).toThrow(
      TOKEN_PHOTO_TOO_BIG_MESSAGE,
    )
  })
})
