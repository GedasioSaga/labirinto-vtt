import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMovel } from '../../lib/mobilia'
import { MATERIAIS } from '../../texturas/meioTermo/materiais'
import type { Prop } from '../../types/map'
import { FichaDoObjeto, type FichaDoObjetoProps } from './FichaDoObjeto'

/*
 * O resumo da ficha "Aparência" (o que aparece com ela fechada). Na PEÇA NOVA
 * (MT4) a aparência é o material de cada lugar, então o resumo diz o nome dele
 * ("Granito, Carvalho"), escolhido ou não; "Padrão", "Cor própria" e "Sem
 * fundo" ficam para os 11 móveis de antes, que têm cor livre e "Preencher".
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const ligacoes = (): Omit<FichaDoObjetoProps, 'prop'> => ({
  mobilia: { onTipoChange: vi.fn(), onVistaChange: vi.fn(), onFormaChange: vi.fn(), onAparenciaChange: vi.fn() },
  transform: { onRotationChange: vi.fn(), onLockedChange: vi.fn(), onHiddenChange: vi.fn(), onSecretChange: vi.fn() },
  player: { onLabelChange: vi.fn(), onShowImageChange: vi.fn() },
})

function resumoDaAparencia(prop: Prop): string | null {
  act(() => root.render(<FichaDoObjeto prop={prop} {...ligacoes()} />))
  const ficha = Array.from(container.querySelectorAll('.gr-ficha')).find((f) => f.querySelector('.gr-ficha__tit')?.textContent === 'Aparência')
  return ficha?.querySelector('.gr-ficha__resumo')?.textContent ?? null
}

const CENTRO = { x: 300, y: 200 }

describe('FichaDoObjeto: resumo da Aparência', () => {
  it('peça nova sem material escolhido (nenhum campo de cor): o nome do material padrão de cada lugar', () => {
    expect(resumoDaAparencia(criarMovel('poco', CENTRO, 64, 'p1'))).toBe('Granito, Carvalho')
    expect(resumoDaAparencia(criarMovel('lapide', CENTRO, 64, 'l1'))).toBe('Granito')
    expect(resumoDaAparencia(criarMovel('barraca', CENTRO, 64, 'b1'))).toBe('Lã vinho, Pinho')
  })

  it('peça nova com material escolhido: o nome dele, não "Cor própria"', () => {
    const poco: Prop = { ...criarMovel('poco', CENTRO, 64, 'p1'), mobiliaCor: MATERIAIS.ardosia.hex, mobiliaCorDaLinha: MATERIAIS.nogueira.hex }
    expect(resumoDaAparencia(poco)).toBe('Ardósia, Nogueira')
    // Cor livre de um mapa antigo: o material mais perto dela no lugar (o que o desenho pinta).
    const vaso: Prop = { ...criarMovel('vaso', CENTRO, 64, 'v1'), mobiliaCor: '#9b8768' }
    expect(resumoDaAparencia(vaso)).toBe('Arenito')
  })

  it('peça nova com "Preencher" desligado vindo de outro tipo: o material, não "Sem fundo" (a peça nova sai sempre com textura)', () => {
    const lampiao: Prop = { ...criarMovel('lampiao', CENTRO, 64, 'la1'), mobiliaPreenchido: false, mobiliaCor: MATERIAIS.latao.hex }
    expect(resumoDaAparencia(lampiao)).toBe('Latão')
  })

  it('os 11 móveis de antes seguem como eram: Padrão, Cor própria e Sem fundo', () => {
    const mesa = criarMovel('mesa', CENTRO, 64, 'm1')
    expect(resumoDaAparencia(mesa)).toBe('Padrão')
    expect(resumoDaAparencia({ ...mesa, mobiliaCor: '#8b4513' })).toBe('Cor própria')
    expect(resumoDaAparencia({ ...mesa, mobiliaPreenchido: false, mobiliaCor: '#8b4513' })).toBe('Sem fundo')
  })
})
