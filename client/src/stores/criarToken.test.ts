import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION, selectionOfItem } from '../lib/selectionModel'
import { IMAGEM_SUMIU_DO_ACERVO } from '../lib/tokenLibrary'
import type { Token } from '../types/map'
import { colocarPecaDoAcervo, criarToken } from './criarToken'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/*
 * O acervo é a estante de NPCs prontos do mestre. A peça que sai dele passa
 * por `colocarPecaDoAcervo` — o MESMO código que `handlePlaceFromLibrary`
 * (App.tsx) chama depois de copiar a foto — e tem de chegar ao mapa com a
 * marca de NPC, senão vira o primeiro "Atribuir" do card de quem espera
 * personagem.
 */

const MORDOMO = { nome: 'Mordomo', tamanho: 2 }
const FOTO = { image: 'C:/mapas/m1/token_tok-mordomo.webp', imageData: null }

function tokenNoMapa(id: string): Token | undefined {
  return useMapStore.getState().map.tokens.find((t) => t.id === id)
}

describe('peça nova no mapa (stores/criarToken)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: createEmptyMap('m1', 'Casa', 20, 20, 50),
      camera: { x: 0, y: 0, scale: 1 },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
    useToastStore.setState({ toasts: [] })
  })

  it('item do acervo vira ficha gravada no mapa com npc: true, tamanho e foto do item, selecionada e com um desfazer', () => {
    const id = colocarPecaDoAcervo(MORDOMO, 'tok-mordomo', FOTO, { x: 300, y: 300 }, null)

    expect(id).toBe('tok-mordomo')
    const mordomo = tokenNoMapa('tok-mordomo')
    expect(mordomo?.npc).toBe(true)
    expect(mordomo?.name).toBe('Mordomo')
    expect(mordomo?.size).toBe(2)
    expect(mordomo?.image).toBe(FOTO.image)
    expect(useMapStore.getState().selection).toEqual(selectionOfItem({ kind: 'token', id: 'tok-mordomo' }))
    expect(useMapStore.getState().past.length).toBe(1)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('foto sumida do disco: a peça do acervo nasce NPC assim mesmo, e o aviso diz o que sumiu', () => {
    const id = colocarPecaDoAcervo(MORDOMO, 'tok-mordomo', { image: null, imageData: null }, undefined, { width: 800, height: 600 })

    expect(id).toBe('tok-mordomo')
    const mordomo = tokenNoMapa('tok-mordomo')
    expect(mordomo?.npc).toBe(true)
    expect(mordomo?.image).toBe(null)
    expect(useToastStore.getState().toasts.map((t) => [t.kind, t.text])).toEqual([['error', IMAGEM_SUMIU_DO_ACERVO]])
  })

  it('ficha comum (botão Adicionar token) nasce sem o campo npc, igual ao mapa salvo antes dele existir', () => {
    const id = criarToken('Gina', { at: { x: 300, y: 300 } }, null)

    expect(id).not.toBe(null)
    const gina = useMapStore.getState().map.tokens.find((t) => t.id === id)
    expect(gina?.name).toBe('Gina')
    expect(gina !== undefined && 'npc' in gina).toBe(false)
  })
})
