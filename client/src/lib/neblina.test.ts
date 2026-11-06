import { describe, expect, it } from 'vitest'
import type { PinceladaDeNeblina } from '../types/map'
import { intensidadeDoMapaInteiro, lerNeblina, lerNeblinaPintada, neblinaParaJogador, somarPinceladaDeNeblina, temNeblina } from './neblina'
import { LADO_DO_RUIDO, pixelsDoRuido } from '../pixi/drawNeblina'

const pincel = (id: string, x0: number, x1: number): PinceladaDeNeblina => ({
  id,
  tipo: 'pincel',
  forca: 0.6,
  raio: 20,
  pontos: [
    { x: x0, y: 50 },
    { x: x1, y: 50 },
  ],
})

describe('neblina', () => {
  it('mapa antigo abre sem neblina; o arquivo torto cai fora; o jogador só recebe a pintada que encosta no que conhece', () => {
    // Sem os campos: nada a desenhar.
    expect(lerNeblina(undefined)).toBeUndefined()
    expect(lerNeblinaPintada(undefined)).toBeUndefined()
    expect(temNeblina({})).toBe(false)
    // Chave lida e presa em 0..100; desligada não cobre.
    expect(lerNeblina({ ligada: true, intensidade: 250 })).toEqual({ ligada: true, intensidade: 100 })
    expect(intensidadeDoMapaInteiro({ neblina: { ligada: false, intensidade: 80 } })).toBe(0)
    expect(intensidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: 40 } })).toBeCloseTo(0.4)
    // Passo sem pontos ou de tipo desconhecido sai; o bom fica.
    const lidos = lerNeblinaPintada([pincel('a', 0, 100), { id: 'b', tipo: 'balde', forca: 1, raio: 5, pontos: [{ x: 0, y: 0 }] }, { ...pincel('c', 0, 1), pontos: [] }])
    expect(lidos?.map((p) => p.id)).toEqual(['a'])
    // Recorte: o jogador conhece só x < 300. A pincelada lá longe (x 1000..1200) não vai; a de perto vai.
    const conhece = (p: { x: number }) => p.x < 300
    const recorte = neblinaParaJogador([pincel('perto', 0, 100), pincel('longe', 1000, 1200)], conhece, () => false)
    expect(recorte?.some((p) => p.id.startsWith('perto'))).toBe(true)
    expect(recorte?.some((p) => p.id.startsWith('longe'))).toBe(false)
    // Borracha num piso sem neblina pintada não vira passo.
    expect(somarPinceladaDeNeblina([], { ...pincel('x', 0, 10), tipo: 'borracha' }).resultado).toBe('sem-neblina')
  })

  it('o ruído da bruma repete sem emenda: a última coluna e a última linha encostam na primeira', () => {
    const px = pixelsDoRuido()
    const lado = LADO_DO_RUIDO
    const r = (x: number, y: number) => px[(y * lado + x) * 4]
    let maiorSalto = 0
    let saltoNaEmenda = 0
    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado - 1; x += 1) maiorSalto = Math.max(maiorSalto, Math.abs(r(x + 1, y) - r(x, y)))
      saltoNaEmenda = Math.max(saltoNaEmenda, Math.abs(r(0, y) - r(lado - 1, y)), Math.abs(r(y, 0) - r(y, lado - 1)))
    }
    // A emenda não pula mais do que o maior passo de dentro do ladrilho.
    expect(saltoNaEmenda).toBeLessThanOrEqual(maiorSalto)
    // E o ruído usa a faixa toda (contraste para os novelos aparecerem).
    expect(Math.min(...Array.from({ length: lado * lado }, (_, i) => px[i * 4]))).toBe(0)
    expect(Math.max(...Array.from({ length: lado * lado }, (_, i) => px[i * 4]))).toBe(255)
  })
})
