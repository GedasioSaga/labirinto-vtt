import { describe, expect, it } from 'vitest'
import { chaveDaCorDaPorta, corPropriaDaPorta, normalizarCorDaPorta, portaComCor } from './corDaPorta'
import type { DoorState } from '../types/map'

const porta: DoorState = { open: false, locked: true, kind: 'normal', animacao: 'girar' }

describe('corDaPorta: o que entra no campo', () => {
  it('só #rrggbb entra, em minúscula', () => {
    expect(normalizarCorDaPorta('#79A9CC')).toBe('#79a9cc')
    for (const torta of ['red', '#12', '#1234567', 'javascript:alert(1)', '#79a9cc;', ' #79a9cc', 12, null, undefined, {}]) {
      expect(normalizarCorDaPorta(torta), String(torta)).toBeUndefined()
    }
  })

  it('escolher grava a cor; "Cor padrão" e cor torta tiram o campo, o resto da porta fica', () => {
    const azul = portaComCor(porta, '#79A9CC')
    expect(azul).toEqual({ ...porta, cor: '#79a9cc' })
    expect(portaComCor(azul, null)).toEqual(porta)
    expect('cor' in portaComCor(azul, null)).toBe(false)
    expect(portaComCor(azul, 'url(x)')).toEqual(porta)
  })

  it('a cor própria em número do Pixi, ou null sem cor (ou torta)', () => {
    expect(corPropriaDaPorta({ cor: '#79a9cc' })).toBe(0x79a9cc)
    expect(corPropriaDaPorta({})).toBeNull()
    expect(corPropriaDaPorta({ cor: 'red' })).toBeNull()
  })

  it('só o arrasto do seletor agrupa, por porta; paleta e "Cor padrão" são um passo cada', () => {
    expect(chaveDaCorDaPorta('w1', true)).toBe('porta-cor:w1')
    expect(chaveDaCorDaPorta('w2', true)).not.toBe(chaveDaCorDaPorta('w1', true))
    expect(chaveDaCorDaPorta('w1', false)).toBeUndefined()
  })
})
