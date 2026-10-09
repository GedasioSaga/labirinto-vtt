/**
 * MÍDIA DA MESA, regras puras (`lib/midia.ts`): a forma do id e da referência
 * (a MESMA que o Rust aceita em `/media/{id}`), o tipo pela assinatura, o hash
 * do conteúdo e o resolvedor que transforma a referência em `src`.
 */
import { describe, expect, it } from 'vitest'
import {
  bytesDaDataUrl,
  ehBaseDeMidiaLocal,
  ehIdDeMidia,
  ehImagemDaMesa,
  ehRefDeMidia,
  hashHex,
  idDaRef,
  idDosBytes,
  refDoId,
  resolverComBase,
  resolverSoEmbutida,
  tipoDosBytes,
  URL_DA_MIDIA_NA_SALA,
} from './midia'

const HASH = 'a'.repeat(64)
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
const DATA_PNG = 'data:image/png;base64,iVBORw0KGgoAAAAN'

describe('id e referência de mídia', () => {
  it('aceita só 64 hex minúsculos com extensão da lista', () => {
    expect(ehIdDeMidia(`${HASH}.webp`)).toBe(true)
    expect(ehIdDeMidia(`${HASH}.jpg`)).toBe(true)
    for (const ruim of [`${HASH}.svg`, `${HASH.toUpperCase()}.png`, `${HASH.slice(1)}.png`, `../${HASH}.png`, `${HASH}.png/x`, `${HASH}`, '', 42, null]) {
      expect(ehIdDeMidia(ruim)).toBe(false)
    }
  })

  it('a referência é midia:<id>, e só ela devolve id', () => {
    const ref = refDoId(`${HASH}.png`)
    expect(ref).toBe(`midia:${HASH}.png`)
    expect(ehRefDeMidia(ref)).toBe(true)
    expect(idDaRef(ref)).toBe(`${HASH}.png`)
    expect(ehRefDeMidia(`midia:../${HASH}.png`)).toBe(false)
    expect(ehRefDeMidia('C:/Users/mestre/retrato.png')).toBe(false)
    expect(idDaRef('https://exemplo.com/x.png')).toBeNull()
  })

  it('a imagem da mesa é a referência ou a embutida de antes; caminho e URL não', () => {
    expect(ehImagemDaMesa(`midia:${HASH}.webp`)).toBe(true)
    expect(ehImagemDaMesa(DATA_PNG)).toBe(true)
    expect(ehImagemDaMesa('C:/retrato.png')).toBe(false)
    expect(ehImagemDaMesa('https://exemplo.com/x.png')).toBe(false)
  })
})

describe('conteúdo', () => {
  it('o tipo vem da assinatura dos bytes', () => {
    expect(tipoDosBytes(PNG)).toBe('png')
    expect(tipoDosBytes(WEBP)).toBe('webp')
    expect(tipoDosBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
    expect(tipoDosBytes(new TextEncoder().encode('GIF89a...'))).toBe('gif')
    expect(tipoDosBytes(new TextEncoder().encode('<svg xmlns="x">'))).toBeNull()
    expect(tipoDosBytes(new Uint8Array())).toBeNull()
  })

  it('o hash é o SHA-256 que o Rust confere', async () => {
    expect(await hashHex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('o id junta hash e tipo; o que não é imagem não ganha id', async () => {
    const id = await idDosBytes(PNG)
    expect(id).toMatch(/^[0-9a-f]{64}\.png$/)
    expect(await idDosBytes(PNG)).toBe(id)
    expect(await idDosBytes(new TextEncoder().encode('texto'))).toBeNull()
  })

  it('a embutida vira bytes; o resto não', () => {
    const bytes = bytesDaDataUrl(`data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`)
    expect(bytes).toEqual(PNG)
    expect(bytesDaDataUrl('C:/retrato.png')).toBeNull()
    expect(bytesDaDataUrl(`midia:${HASH}.png`)).toBeNull()
  })
})

describe('resolvedor de imagem', () => {
  it('o jogador busca a referência na rota da sala; a embutida passa como veio', () => {
    const resolver = resolverComBase(URL_DA_MIDIA_NA_SALA)
    expect(resolver(`midia:${HASH}.webp`)).toBe(`/media/${HASH}.webp`)
    expect(resolver(DATA_PNG)).toBe(DATA_PNG)
  })

  it('caminho de disco, URL de fora e vazio não viram src', () => {
    const resolver = resolverComBase('http://asset.localhost/C%3A%5Cmidia%5C')
    expect(resolver('C:/Users/mestre/retrato.png')).toBeNull()
    expect(resolver('https://exemplo.com/espiao.png')).toBeNull()
    expect(resolver(null)).toBeNull()
    expect(resolver(undefined)).toBeNull()
    expect(resolver(`midia:${HASH}.png`)).toBe(`http://asset.localhost/C%3A%5Cmidia%5C${HASH}.png`)
  })

  it('antes de saber a base, só a embutida aparece', () => {
    expect(resolverSoEmbutida(`midia:${HASH}.png`)).toBeNull()
    expect(resolverSoEmbutida(DATA_PNG)).toBe(DATA_PNG)
  })

  it('a janela de teste só aceita base da ponte de arquivos do Tauri', () => {
    expect(ehBaseDeMidiaLocal('http://asset.localhost/C%3A%5Cmidia%5C')).toBe(true)
    expect(ehBaseDeMidiaLocal('asset://localhost/%2Fhome%2Fmidia%2F')).toBe(true)
    expect(ehBaseDeMidiaLocal('https://espiao.example/')).toBe(false)
    expect(ehBaseDeMidiaLocal('http://asset.localhost/"onerror="x')).toBe(false)
    expect(ehBaseDeMidiaLocal(42)).toBe(false)
  })
})
