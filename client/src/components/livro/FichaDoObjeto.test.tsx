import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { criarMovel } from '../../lib/mobilia'
import { useMapStore } from '../../stores/mapStore'
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

  it('os 11 móveis de antes com textura (Meio-Termo, MT12): o material; a cor livre de antes vira o mais perto', () => {
    const mesa = criarMovel('mesa', CENTRO, 64, 'm1')
    expect(resumoDaAparencia(mesa)).toBe('Carvalho')
    expect(resumoDaAparencia({ ...mesa, mobiliaCor: MATERIAIS.nogueira.hex })).toBe('Nogueira')
    const cerca = criarMovel('cerca', CENTRO, 64, 'c1')
    expect(resumoDaAparencia(cerca)).toBe('Carvalho, Varas')
  })

  it('os 11 móveis de antes EM LINHAS seguem como eram: Padrão, Cor própria e Sem fundo', () => {
    const mesa: Prop = { ...criarMovel('mesa', CENTRO, 64, 'm1'), mobiliaDesenho: 'linhas' }
    expect(resumoDaAparencia(mesa)).toBe('Padrão')
    expect(resumoDaAparencia({ ...mesa, mobiliaCor: '#8b4513' })).toBe('Cor própria')
    expect(resumoDaAparencia({ ...mesa, mobiliaPreenchido: false, mobiliaCor: '#8b4513' })).toBe('Sem fundo')
  })
})

/*
 * "BARRA A PASSAGEM" (12/11/2026, `lib/obstaculosDeObjeto.ts`), na ficha "No
 * mapa": ligado no objeto que barra por padrão (o moinho), desligado no resto
 * (a mesa, a imagem solta). A troca vai para a cena aberta com UM Ctrl+Z, e o
 * campo só fica gravado quando difere do padrão do tipo.
 */
describe('FichaDoObjeto: "Barra a passagem"', () => {
  const EXPLICACAO = 'A ficha do jogador não atravessa este objeto. Você, mestre, atravessa sempre.'

  function chave(prop: Prop): HTMLInputElement | null {
    useMapStore.setState({ map: { ...createEmptyMap('m', 'M', 20, 20, 64), props: [prop] }, past: [], future: [] })
    act(() => root.render(<FichaDoObjeto prop={prop} {...ligacoes()} />))
    return Array.from(container.querySelectorAll('input')).find((input) => Array.from(input.labels ?? []).some((rotulo) => rotulo.textContent?.includes('Barra a passagem') === true)) ?? null
  }

  it('o moinho nasce ligado e a mesa desligada, com a linha que explica; desligar grava na cena e um Ctrl+Z desfaz', () => {
    expect(chave(criarMovel('mesa', CENTRO, 64, 'me1'))?.checked).toBe(false)
    const doMoinho = chave(criarMovel('moinho', CENTRO, 64, 'mo1'))
    expect(doMoinho?.checked).toBe(true)
    expect(container.textContent).toContain(EXPLICACAO)
    act(() => doMoinho?.click())
    expect(useMapStore.getState().map.props[0]?.barraPassagem).toBe(false)
    act(() => useMapStore.getState().undo())
    const desfeito = useMapStore.getState().map.props[0]
    expect(desfeito !== undefined && Object.hasOwn(desfeito, 'barraPassagem')).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('objeto de chão e item no chão não mostram o controle (a ficha pisa neles)', () => {
    expect(chave(criarMovel('tapete', CENTRO, 64, 't1'))).toBeNull()
    expect(chave({ id: 'i1', src: '', x: 300, y: 200, width: 64, height: 64, linkedMapPath: null, item: { nome: 'Espada' } })).toBeNull()
    expect(container.textContent).not.toContain(EXPLICACAO)
  })
})
