import { describe, expect, it } from 'vitest'
import { isTokenPhotoData, tokenPhotoLabel, tokenPhotoRef, TOKEN_PHOTO_MAX_CHARS } from './tokenPhoto'
import type { Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const DISCO_WINDOWS = 'C:\\Users\\mestre\\AppData\\Roaming\\labirinto\\maps\\m1\\token_x.webp'

describe('isTokenPhotoData — a fronteira do que pode viajar', () => {
  it('aceita a referência auto-contida que o próprio app produz', () => {
    expect(isTokenPhotoData(FOTO)).toBe(true)
    expect(isTokenPhotoData('data:image/webp;base64,UklGRg==')).toBe(true)
  })

  it('recusa tudo que levaria o jogador para fora da mensagem', () => {
    // Cada linha é um jeito real de vazar: caminho do mestre, busca na rede
    // do mestre, execução de script na página do jogador.
    expect(isTokenPhotoData(DISCO_WINDOWS)).toBe(false)
    expect(isTokenPhotoData('/home/mestre/.local/share/labirinto/token.webp')).toBe(false)
    expect(isTokenPhotoData('http://192.168.0.10/token.png')).toBe(false)
    expect(isTokenPhotoData('file:///C:/fotos/heroi.png')).toBe(false)
    expect(isTokenPhotoData('javascript:alert(1)')).toBe(false)
    expect(isTokenPhotoData('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    expect(isTokenPhotoData('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isTokenPhotoData(null)).toBe(false)
    expect(isTokenPhotoData(undefined)).toBe(false)
  })

  it('recusa acima do teto de tamanho, mesmo com a forma certa', () => {
    const gigante = `data:image/png;base64,${'A'.repeat(TOKEN_PHOTO_MAX_CHARS)}`
    expect(isTokenPhotoData(gigante)).toBe(false)
  })
})

describe('tokenPhotoRef / tokenPhotoLabel', () => {
  it('o arquivo do mestre vem primeiro; a cópia embutida é o que sobra', () => {
    expect(tokenPhotoRef({ image: DISCO_WINDOWS, imageData: FOTO })).toBe(DISCO_WINDOWS)
    expect(tokenPhotoRef({ image: null, imageData: FOTO })).toBe(FOTO)
    expect(tokenPhotoRef({ image: null, imageData: null })).toBeNull()
  })

  it('token que atravessou o type-checker por fora (sem os campos) devolve null, não undefined', () => {
    const legado = {} as Pick<Token, 'image' | 'imageData'>
    expect(tokenPhotoRef(legado)).toBeNull()
  })

  it('caminho vira nome de arquivo; foto embutida não tem nome para mostrar', () => {
    expect(tokenPhotoLabel(DISCO_WINDOWS)).toBe('token_x.webp')
    expect(tokenPhotoLabel(FOTO)).toBe('Foto escolhida')
    expect(tokenPhotoLabel(null)).toBe('')
  })
})

describe('recorte do jogador — a foto viaja, o caminho do disco não', () => {
  const JOGADOR = 'jogador'
  const POSSE = { [JOGADOR]: ['meu'] }

  function mapaCom(tokens: Token[]) {
    return { ...createEmptyMap('m1', 'Mesa', 40, 40, 50), tokens }
  }

  it('a foto embutida chega ao jogador; o caminho do disco do mestre vira null', () => {
    const { map } = filterMapForPlayer(
      mapaCom([{ id: 'meu', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: DISCO_WINDOWS, imageData: FOTO }]),
      JOGADOR,
      POSSE,
      400,
    )

    const token = map.tokens.find((t) => t.id === 'meu')
    expect(token?.image).toBeNull()
    expect(token?.imageData).toBe(FOTO)
  })

  it('foto embutida em `image` (mapa montado assim) também atravessa: o critério é a FORMA, não o nome do campo', () => {
    const { map } = filterMapForPlayer(
      mapaCom([{ id: 'meu', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: FOTO }]),
      JOGADOR,
      POSSE,
      400,
    )

    expect(map.tokens.find((t) => t.id === 'meu')?.image).toBe(FOTO)
  })

  it('CONTROLE: caminho de disco em `imageData` (campo trocado por engano) é apagado igual', () => {
    // Sem este caso, bastaria alguém gravar o caminho no campo "que viaja"
    // para o recorte entregar a pasta do mestre ao jogador.
    const { map } = filterMapForPlayer(
      mapaCom([{ id: 'meu', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null, imageData: DISCO_WINDOWS }]),
      JOGADOR,
      POSSE,
      400,
    )

    expect(map.tokens.find((t) => t.id === 'meu')?.imageData).toBeNull()
  })
})
