import { describe, expect, it } from 'vitest'
import { rotaDaCampanha } from '../../../../lobby/nuvem/src/rotas'
import { caminhoDaRota, lerRota } from './rotas'

/**
 * GALERIA DE CUTSCENES (14/11/2026): a aba do site (`/c/:id/galeria`) e as
 * rotas do vídeo no Worker (`lobby/nuvem/src/rotas.ts`), que levam o id na
 * forma exata `<sha256>.<mp4|webm>`.
 */

const HASH = 'a'.repeat(64)

describe('Galeria: rota do site', () => {
  it('/c/:id/galeria abre a Galeria e volta ao mesmo caminho; com mais um pedaço é página não achada', () => {
    expect(lerRota('/c/camp_1/galeria')).toEqual({ tela: 'galeria', campanhaId: 'camp_1' })
    expect(caminhoDaRota({ tela: 'galeria', campanhaId: 'camp 1' })).toBe('/c/camp%201/galeria')
    expect(lerRota(caminhoDaRota({ tela: 'galeria', campanhaId: 'camp_1' }))).toEqual({ tela: 'galeria', campanhaId: 'camp_1' })
    expect(lerRota('/c/camp_1/galeria/video')).toEqual({ tela: 'nao-achada' })
  })
})

describe('Galeria: rotas do vídeo no Worker', () => {
  it('lê ver, subir pedaço, fechar, listar e tirar; id fora da forma não é rota', () => {
    expect(rotaDaCampanha('/api/c/camp_1/galeria')).toEqual({ campanhaId: 'camp_1', nome: 'galeria' })
    expect(rotaDaCampanha(`/api/c/camp_1/video/${HASH}.mp4`)).toEqual({ campanhaId: 'camp_1', nome: 'video', videoId: `${HASH}.mp4` })
    expect(rotaDaCampanha(`/api/c/camp_1/video/${HASH}.webm/parte/37`)).toEqual({ campanhaId: 'camp_1', nome: 'videoParte', videoId: `${HASH}.webm`, parte: 37 })
    expect(rotaDaCampanha(`/api/c/camp_1/video/${HASH}.mp4/fechar`)).toEqual({ campanhaId: 'camp_1', nome: 'videoFechar', videoId: `${HASH}.mp4` })
    expect(rotaDaCampanha(`/api/c/camp_1/galeria/${HASH}.mp4/tirar`)).toEqual({ campanhaId: 'camp_1', nome: 'galeriaTirar', videoId: `${HASH}.mp4` })
    for (const torto of [
      `/api/c/camp_1/video/${HASH}.png`,
      `/api/c/camp_1/video/${'A'.repeat(64)}.mp4`,
      `/api/c/camp_1/video/${HASH}.mp4/parte/12345`,
      `/api/c/camp_1/video/${HASH}.mp4/parte/-1`,
      `/api/c/camp_1/video/${HASH}.mp4/apagar`,
      `/api/c/camp_1/galeria/${HASH}.mp4`,
      '/api/c/camp_1/galeria/',
      `/api/c/camp%2F1/video/${HASH}.mp4`,
    ]) {
      expect(rotaDaCampanha(torto)).toBeNull()
    }
  })
})
