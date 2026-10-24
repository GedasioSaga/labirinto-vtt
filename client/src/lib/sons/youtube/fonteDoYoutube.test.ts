import { describe, expect, it } from 'vitest'
import { bibliotecaDeSonsVazia, bibliotecaDoTexto, comEfeitoNovo, ehVideoDoYoutube, fonteDoSomLida, serializarBiblioteca, VERSAO_DA_BIBLIOTECA_DE_SONS, type VideoDoYoutube } from '../biblioteca'

// SONS AO VIVO, fatia F6: a fonte do YouTube no `sons.json`, com início e fim
// em segundos. O `fimS` é campo novo na MESMA versão 1: o app anterior lê a
// fonte campo a campo e só o deixa de fora (o som continua tocando do início).

function video(id: string): VideoDoYoutube {
  if (!ehVideoDoYoutube(id)) throw new Error(`vídeo inválido no teste: ${id}`)
  return id
}

describe('fonte do YouTube no sons.json', () => {
  it('vai e volta com início, fim e loop, sem mudar a versão do arquivo', () => {
    const passo = comEfeitoNovo(bibliotecaDeSonsVazia(), { nome: 'Bardo', fonte: { tipo: 'youtube', video: video('dQw4w9WgXcQ'), inicioS: 42, fimS: 102.5 }, loop: true }, 'som_bardo')
    if (passo === null) throw new Error('o efeito não entrou')
    const texto = serializarBiblioteca(passo.biblioteca)
    expect(JSON.parse(texto).versao).toBe(VERSAO_DA_BIBLIOTECA_DE_SONS)
    const lida = bibliotecaDoTexto(texto)
    expect(lida).toEqual({ ok: true, biblioteca: passo.biblioteca })
    expect(passo.efeito.fonte).toEqual({ tipo: 'youtube', video: 'dQw4w9WgXcQ', inicioS: 42, fimS: 102.5 })
    expect(passo.efeito.loop).toBe(true)
  })

  it('fim torto sai sozinho (o vídeo vai até o fim); o efeito fica', () => {
    for (const fimS of [10, 5, -1, 'meio', null, Number.NaN]) {
      expect(fonteDoSomLida({ tipo: 'youtube', video: 'dQw4w9WgXcQ', inicioS: 10, fimS })).toEqual({ tipo: 'youtube', video: 'dQw4w9WgXcQ', inicioS: 10 })
    }
    expect(fonteDoSomLida({ tipo: 'youtube', video: 'dQw4w9WgXcQ', fimS: 30 })).toEqual({ tipo: 'youtube', video: 'dQw4w9WgXcQ', fimS: 30 })
  })

  it('o link colado nunca vira fonte: só o id de 11 caracteres', () => {
    expect(fonteDoSomLida({ tipo: 'youtube', video: 'https://youtu.be/dQw4w9WgXcQ' })).toBeNull()
    expect(comEfeitoNovo(bibliotecaDeSonsVazia(), { nome: 'X', fonte: { tipo: 'youtube', video: video('dQw4w9WgXcQ'), fimS: 0 } })?.efeito.fonte).toEqual({ tipo: 'youtube', video: 'dQw4w9WgXcQ' })
  })
})
