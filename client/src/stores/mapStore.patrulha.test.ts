import { beforeEach, describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * ROTA DE PATRULHA, lado do HISTÓRICO. Marcar ponto e avançar a patrulha são
 * decisões do mestre sobre o mapa: cada clique é um Ctrl+Z. Clique que não
 * muda nada (sem rota para andar, ficha que não existe) não gasta entrada do
 * desfazer — senão o próximo Ctrl+Z "não faz nada" aos olhos dele.
 */
const GUARDA: Token = {
  id: 'guarda',
  characterId: null,
  name: 'Guarda',
  x: 300,
  y: 400,
  size: 1,
  image: null,
  patrulha: { pontos: [{ x: 100, y: 100 }, { x: 300, y: 400 }], atual: 1 },
}
const HEROI: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 50, y: 50, size: 1, image: null }

const fichaDoMapa = (id: string): Token | undefined => useMapStore.getState().map.tokens.find((t) => t.id === id)

describe('mapStore patrolAction', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [GUARDA, HEROI], regions: [], walls: [], lights: [] },
      past: [],
      future: [],
    })
  })

  it('Avançar patrulha anda o NPC; o desfazer devolve a ficha EXATAMENTE como era', () => {
    useMapStore.getState().patrolAction('guarda', 'avancar')
    expect([fichaDoMapa('guarda')?.x, fichaDoMapa('guarda')?.y]).toEqual([100, 100])
    expect(fichaDoMapa('guarda')?.patrulha?.atual).toBe(0)
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(fichaDoMapa('guarda')).toEqual(GUARDA)
  })

  it('Marcar ponto aqui grava a posição atual da ficha no store (não a de uma cópia velha)', () => {
    useMapStore.getState().setTokenPosition('heroi', 75, 80)
    useMapStore.getState().patrolAction('heroi', 'marcar')
    expect(fichaDoMapa('heroi')?.patrulha).toEqual({ pontos: [{ x: 75, y: 80 }], atual: 0 })
  })

  it('sem para onde andar, ou ficha que não existe: o mapa fica igual e o histórico não cresce', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().patrolAction('heroi', 'avancar')
    useMapStore.getState().patrolAction('nao-existe', 'marcar')
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
