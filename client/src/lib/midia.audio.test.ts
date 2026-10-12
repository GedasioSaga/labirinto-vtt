/**
 * ÁUDIO DA MESA, regras puras (`lib/midia.ts`): a música importada do minigame
 * tem contrato próprio — assinatura, id e referência de áudio — espelho do Rust
 * (`net/media.rs`, `tipo_dos_bytes` e `MIDIA_AUDIO_MAX_BYTES`). O contrato da
 * imagem não pode passar a aceitar áudio, nem o contrário.
 */
import { describe, expect, it } from 'vitest'
import {
  ehIdDeAudio,
  ehIdDeMidia,
  ehImagemDaMesa,
  ehRefDeAudio,
  ehRefDeMidia,
  idDaRef,
  idDaRefDeAudio,
  idDoAudio,
  idDosBytes,
  MIDIA_AUDIO_MAX_BYTES,
  refDoId,
  tipoDoAudio,
  tipoDosBytes,
} from './midia'

const HASH = 'a'.repeat(64)
const bytes = (...valores: number[]): Uint8Array => Uint8Array.from(valores)
const texto = (s: string): Uint8Array => new TextEncoder().encode(s)

const MP3_ID3 = bytes(0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0)
const MP3_QUADRO = bytes(0xff, 0xfb, 0x90, 0x64, 0, 0)
const OGG = bytes(0x4f, 0x67, 0x67, 0x53, 0, 0x02, 0, 0)
const WAV = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20)
const M4A = bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13)
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0)

describe('tipo do áudio pela assinatura', () => {
  it('reconhece mp3 (ID3 e quadro MPEG), ogg, wav e m4a', () => {
    expect(tipoDoAudio(MP3_ID3)).toBe('mp3')
    expect(tipoDoAudio(MP3_QUADRO)).toBe('mp3')
    // Os 3 bits altos do 2º byte, e só eles, contam: FF E0 já é quadro.
    expect(tipoDoAudio(bytes(0xff, 0xe0))).toBe('mp3')
    expect(tipoDoAudio(OGG)).toBe('ogg')
    expect(tipoDoAudio(WAV)).toBe('wav')
    expect(tipoDoAudio(M4A)).toBe('m4a')
  })

  it('o quase-áudio e o vazio não passam', () => {
    for (const ruim of [
      bytes(0xff, 0xc0, 0, 0), // sincronia com um bit faltando
      bytes(0xff), // FF sozinho: falta o 2º byte
      bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x41, 0x56), // RIFF....WAV curto
      texto('ftyp\x00\x00\x00\x20M4A '), // ftyp fora do lugar
      texto('ID'),
      texto('Ogg'),
      new Uint8Array(),
    ]) {
      expect(tipoDoAudio(ruim)).toBeNull()
    }
  })

  it('imagem não é áudio, e áudio não é imagem', () => {
    for (const imagem of [PNG, WEBP, JPEG, texto('GIF89a...')]) expect(tipoDoAudio(imagem)).toBeNull()
    for (const audio of [MP3_ID3, MP3_QUADRO, OGG, WAV, M4A]) expect(tipoDosBytes(audio)).toBeNull()
  })
})

describe('id e referência de áudio', () => {
  it('o id junta hash e tipo; imagem e texto não ganham id de áudio', async () => {
    const id = await idDoAudio(MP3_ID3)
    expect(id).toMatch(/^[0-9a-f]{64}\.mp3$/)
    expect(await idDoAudio(MP3_ID3.slice())).toBe(id)
    expect(await idDoAudio(OGG)).toMatch(/\.ogg$/)
    expect(await idDoAudio(WAV)).toMatch(/\.wav$/)
    expect(await idDoAudio(M4A)).toMatch(/\.m4a$/)
    expect(await idDoAudio(PNG)).toBeNull()
    expect(await idDoAudio(texto('<svg onload=alert(1)>'))).toBeNull()
    // E o id de imagem segue recusando áudio.
    expect(await idDosBytes(MP3_ID3)).toBeNull()
  })

  it('aceita só 64 hex minúsculos com extensão de áudio', () => {
    for (const ext of ['mp3', 'ogg', 'wav', 'm4a']) expect(ehIdDeAudio(`${HASH}.${ext}`)).toBe(true)
    for (const ruim of [`${HASH}.MP3`, `${HASH}.mp4`, `${HASH}.aac`, `${HASH}.png`, `${HASH}.mp3.png`, `../${HASH}.mp3`, `${HASH.slice(1)}.mp3`, '', 42, null]) {
      expect(ehIdDeAudio(ruim)).toBe(false)
    }
  })

  it('a referência de áudio não serve de imagem, e a de imagem não serve de áudio', () => {
    const refAudio = refDoId(`${HASH}.mp3`)
    expect(ehRefDeAudio(refAudio)).toBe(true)
    expect(idDaRefDeAudio(refAudio)).toBe(`${HASH}.mp3`)
    expect(ehRefDeMidia(refAudio)).toBe(false)
    expect(ehIdDeMidia(`${HASH}.mp3`)).toBe(false)
    expect(ehImagemDaMesa(refAudio)).toBe(false)
    expect(idDaRef(refAudio)).toBeNull()

    const refImagem = refDoId(`${HASH}.png`)
    expect(ehRefDeAudio(refImagem)).toBe(false)
    expect(idDaRefDeAudio(refImagem)).toBeNull()
    expect(idDaRefDeAudio(`midia:../${HASH}.mp3`)).toBeNull()
    expect(idDaRefDeAudio('C:/musica.mp3')).toBeNull()
  })

  it('o teto é o mesmo do Rust: 15 MB', () => {
    expect(MIDIA_AUDIO_MAX_BYTES).toBe(15 * 1024 * 1024)
  })
})
