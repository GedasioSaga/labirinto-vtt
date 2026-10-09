/**
 * INVENTÁRIO NA FICHA DO JOGADOR: a mochila do token ligado ao personagem,
 * em grade, com a imagem buscada por URL da sala (`/media/<id>`) e o retrato
 * também por referência; "Dar a…" pede ao host pelo mesmo `item.give` do "Comigo".
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { CarriedItem } from '../types/map'
import { PlayerFicha, type InventarioDoJogador, type PlayerFichaProps } from './PlayerFicha'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const ID_RETRATO = `${'7'.repeat(64)}.webp`
const ID_POCAO = `${'8'.repeat(64)}.webp`
const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy', retrato: `midia:${ID_RETRATO}` }
const POCAO: CarriedItem = { id: 'a', nome: 'Poção', itemId: 'item_pocao', imagem: `midia:${ID_POCAO}`, descricao: 'Cura 50 HP.', quantidade: 2, empilhavel: true }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(inventarioDe: PlayerFichaProps['inventarioDe'], onDarItem?: PlayerFichaProps['onDarItem']): void {
  const props: PlayerFichaProps = {
    sistema: SISTEMA_ONE_PIECE,
    personagens: [LUFFY],
    tokens: [{ tokenId: 'tok-luffy', nome: 'Luffy', personagemId: LUFFY.id }],
    envio: undefined,
    onCriar: vi.fn(() => true),
    onSalvar: vi.fn(() => ({ ok: true as const, nada: false })),
    onClose: vi.fn(),
    escolherImagem: vi.fn(async () => null),
    inventarioDe,
    onDarItem,
  }
  act(() => root.render(<PlayerFicha {...props} />))
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === nome || b.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

describe('PlayerFicha: inventário', () => {
  it('a grade e o retrato carregam por URL da sala, não embutidos', () => {
    const inventario: InventarioDoJogador = { itens: [POCAO], colegas: [] }
    render((personagemId) => (personagemId === LUFFY.id ? inventario : undefined))
    expect(container.querySelector('.lb-inv__vaga img')?.getAttribute('src')).toBe(`/media/${ID_POCAO}`)
    expect(container.querySelector('.lb-ficha__retrato img')?.getAttribute('src')).toBe(`/media/${ID_RETRATO}`)
    expect(botao('Poção, 2').querySelector('.lb-inv__qtd')?.textContent).toBe('×2')
  })

  it('"Dar a…" lista os colegas encostados e pede ao host', () => {
    const onDarItem = vi.fn()
    render(() => ({ itens: [POCAO], colegas: [{ tokenId: 'tok-zoro', name: 'Zoro' }] }), onDarItem)
    act(() => botao('Poção, 2').click())
    act(() => botao('Dar a…').click())
    act(() => botao('Zoro').click())
    expect(onDarItem).toHaveBeenCalledWith('a', 'tok-zoro')
    expect(container.textContent).toContain('Pedido enviado: Poção para Zoro.')
  })

  it('ninguém encostado: diz como passar o item', () => {
    render(() => ({ itens: [POCAO], colegas: [] }), vi.fn())
    act(() => botao('Poção, 2').click())
    act(() => botao('Dar a…').click())
    expect(container.textContent).toContain('Ninguém encostado em você agora.')
  })

  it('token fora desta tela: a ficha abre sem a seção de inventário', () => {
    render(() => undefined)
    expect(container.querySelector('.lb-inv')).toBeNull()
  })
})
