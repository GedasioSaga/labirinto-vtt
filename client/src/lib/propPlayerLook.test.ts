import { describe, expect, it } from 'vitest'
import { PROP_PLAYER_LABEL_MAX, propPlayerImage, propPlayerLabel } from './propPlayerLook'

/** Menor PNG que passa na regra da foto da ficha (`isTokenPhotoData`). */
const IMAGEM_DO_PIANO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('propPlayerLabel — o rótulo que o jogador lê na silhueta', () => {
  it('aparas nas pontas e espaço repetido no meio saem; o texto do mestre fica', () => {
    expect(propPlayerLabel('  Guarda-roupa  ')).toBe('Guarda-roupa')
    expect(propPlayerLabel('Baú   de   ferro')).toBe('Baú de ferro')
  })

  it('vazio, só espaço, ausente ou que não é texto: sem rótulo', () => {
    expect(propPlayerLabel('')).toBeUndefined()
    expect(propPlayerLabel('   ')).toBeUndefined()
    expect(propPlayerLabel(undefined)).toBeUndefined()
    expect(propPlayerLabel(42)).toBeUndefined()
    expect(propPlayerLabel({ texto: 'Piano' })).toBeUndefined()
  })

  it('rótulo curto: texto longo de arquivo editado à mão é cortado no teto', () => {
    const longo = 'x'.repeat(PROP_PLAYER_LABEL_MAX + 50)
    const cortado = propPlayerLabel(longo)
    expect(cortado).toBe('x'.repeat(PROP_PLAYER_LABEL_MAX))
    expect(cortado?.length).toBe(PROP_PLAYER_LABEL_MAX)
  })
})

describe('propPlayerImage — só a cópia auto-contida atravessa', () => {
  it('data URL de imagem passa inteira', () => {
    expect(propPlayerImage(IMAGEM_DO_PIANO)).toBe(IMAGEM_DO_PIANO)
  })

  it('caminho do disco do mestre, endereço de rede, script e lixo não passam', () => {
    expect(propPlayerImage('C:\\Users\\mestre\\props\\piano.png')).toBeUndefined()
    expect(propPlayerImage('http://10.0.0.2/piano.png')).toBeUndefined()
    expect(propPlayerImage('javascript:alert(1)')).toBeUndefined()
    expect(propPlayerImage('')).toBeUndefined()
    expect(propPlayerImage(undefined)).toBeUndefined()
    expect(propPlayerImage(7)).toBeUndefined()
  })
})
