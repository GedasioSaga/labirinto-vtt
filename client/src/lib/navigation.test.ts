import { describe, expect, it } from 'vitest'
import { SCREEN_PARENT, parentScreen } from './navigation'
import type { Screen } from '../types/screen'

describe('parentScreen', () => {
  it('menu é ponto fixo — voltar no topo não explode', () => {
    expect(parentScreen('menu')).toBe('menu')
  })

  it('map-type volta para menu', () => {
    expect(parentScreen('map-type')).toBe('menu')
  })

  it('new-dungeon volta para map-type', () => {
    expect(parentScreen('new-dungeon')).toBe('map-type')
  })

  it('load-map volta para menu', () => {
    expect(parentScreen('load-map')).toBe('menu')
  })

  it('options volta para menu', () => {
    expect(parentScreen('options')).toBe('menu')
  })

  it('editor volta para menu', () => {
    expect(parentScreen('editor')).toBe('menu')
  })

  it('SCREEN_PARENT cobre as 6 telas', () => {
    const screens: Screen[] = ['menu', 'map-type', 'new-dungeon', 'load-map', 'options', 'editor']
    for (const screen of screens) {
      expect(SCREEN_PARENT[screen]).toBeDefined()
    }
  })
})
