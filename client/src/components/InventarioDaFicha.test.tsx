import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolverComBase } from '../lib/midia'
import type { CarriedItem } from '../types/map'
import { ImagemDaMesa } from './ImagemDaMesa'
import { InventarioDaFicha } from './InventarioDaFicha'

/**
 * INVENTÁRIO NA FICHA: a grade de imagens com o selo da quantidade, o item
 * aberto grande com descrição, categoria, preço e as ações de quem olha. A
 * imagem sai pelo resolvedor da tela: o jogador busca na sala (`/media/<id>`),
 * o mestre na ponte de arquivos.
 */

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const ID = `${'e'.repeat(64)}.webp`
const POCAO: CarriedItem = { id: 'a', nome: 'Poção', itemId: 'item_pocao', imagem: `midia:${ID}`, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 1200, quantidade: 3, empilhavel: true }
const CHAVE: CarriedItem = { id: 'b', nome: 'Chave de Rubi' }

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function montar(no: ReactNode): void {
  act(() => root.render(no))
}

function vaga(nome: string): HTMLButtonElement {
  const achada = Array.from(host.querySelectorAll<HTMLButtonElement>('.lb-inv__vaga')).find((botao) => botao.getAttribute('aria-label')?.startsWith(nome) === true)
  if (achada === undefined) throw new Error(`sem a vaga ${nome}`)
  return achada
}

describe('InventarioDaFicha', () => {
  it('jogador: a imagem vem da rota da sala, com o selo da pilha; sem imagem, as iniciais', () => {
    montar(<InventarioDaFicha itens={[POCAO, CHAVE]} />)
    const imagem = vaga('Poção').querySelector('img')
    expect(imagem?.getAttribute('src')).toBe(`/media/${ID}`)
    expect(vaga('Poção').getAttribute('aria-label')).toBe('Poção, 3')
    expect(vaga('Poção').querySelector('.lb-inv__qtd')?.textContent).toBe('×3')
    expect(vaga('Chave de Rubi').querySelector('img')).toBeNull()
    expect(vaga('Chave de Rubi').querySelector('.lb-inv__qtd')).toBeNull()
    expect(host.querySelector('.lb-inv__conta')?.textContent).toBe('4')
  })

  it('mestre: a mesma grade busca na ponte de arquivos', () => {
    montar(
      <ImagemDaMesa.Provider value={resolverComBase('http://asset.localhost/C%3A%5Cmidia%5C')}>
        <InventarioDaFicha itens={[POCAO]} />
      </ImagemDaMesa.Provider>,
    )
    expect(vaga('Poção').querySelector('img')?.getAttribute('src')).toBe(`http://asset.localhost/C%3A%5Cmidia%5C${ID}`)
  })

  it('vazio diz que está vazio', () => {
    montar(<InventarioDaFicha itens={[]} vazio="Nada com Luffy." />)
    expect(host.querySelector('.lb-inv__vazio')?.textContent).toBe('Nada com Luffy.')
    expect(host.querySelector('.lb-inv__grade')).toBeNull()
  })

  it('tocar abre o item grande com descrição, categoria, preço e as ações; Esc fecha só o detalhe', () => {
    const tirar = vi.fn()
    // A janela da ficha ouve o Esc num ancestral (React): o do detalhe não pode chegar lá.
    const fora = vi.fn()
    montar(
      <div onKeyDown={fora}>
      <InventarioDaFicha
        itens={[POCAO, CHAVE]}
        acoes={(item) => (
          <button type="button" onClick={() => tirar(item.id)}>
            Tirar
          </button>
        )}
      />
      </div>,
    )
    act(() => vaga('Poção').click())
    const detalhe = host.querySelector<HTMLElement>('.lb-inv__detalhe')
    expect(detalhe?.getAttribute('aria-label')).toBe('Item: Poção')
    expect(detalhe?.textContent).toContain('Cura 50 HP.')
    expect(detalhe?.textContent).toContain('Consumível')
    expect(detalhe?.textContent).toContain('1.200 berries')
    expect(vaga('Poção').getAttribute('aria-pressed')).toBe('true')

    const botao = Array.from(detalhe?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Tirar')
    act(() => botao?.click())
    expect(tirar).toHaveBeenCalledWith('a')

    act(() => {
      detalhe?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(host.querySelector('.lb-inv__detalhe')).toBeNull()
    expect(fora).not.toHaveBeenCalled()
  })

  it('o item que sai da mochila fecha o detalhe sozinho', () => {
    montar(<InventarioDaFicha itens={[POCAO, CHAVE]} />)
    act(() => vaga('Chave de Rubi').click())
    expect(host.querySelector('.lb-inv__detalhe')).not.toBeNull()
    montar(<InventarioDaFicha itens={[POCAO]} />)
    expect(host.querySelector('.lb-inv__detalhe')).toBeNull()
  })
})
