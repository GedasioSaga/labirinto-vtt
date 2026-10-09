import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AcervoDeItens, ItemDoCatalogo } from '../lib/acervoDeItens'
import type { AlvoDoAcervo } from '../lib/party'

/**
 * O ACERVO DE ITENS no painel do mestre: a grade por categoria, a janela do
 * item (criar com imagem colada, editar) e o "Dar a…" que entrega a um
 * personagem com a quantidade. O disco e a imagem são de mentira.
 */

const REF_COLADA = `midia:${'1'.repeat(64)}.webp`
const POCAO: ItemDoCatalogo = { id: 'item_pocao', nome: 'Poção', imagem: `midia:${'2'.repeat(64)}.webp`, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 120, empilhavel: true }
const ESPADA: ItemDoCatalogo = { id: 'item_espada', nome: 'Espada', imagem: null, descricao: '', categoria: 'Arma', preco: null, empilhavel: false }
const ALVOS: AlvoDoAcervo[] = [
  { tokenId: 'luffy', sceneId: 'c1', nome: 'Luffy', cena: 'Porto' },
  { tokenId: 'zoro', sceneId: null, nome: 'Zoro', cena: 'Mapa' },
]

let noDisco: AcervoDeItens = { itens: [], categorias: [] }
const gravados: AcervoDeItens[] = []

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn(), convertFileSrc: (caminho: string) => caminho }))

vi.mock('../lib/acervoDeItens', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/acervoDeItens')>()
  return {
    ...original,
    lerAcervoDeItens: vi.fn(async () => ({ acervo: noDisco, aviso: null, lido: true })),
    gravarAcervoDeItens: vi.fn(async (acervo: AcervoDeItens) => {
      gravados.push(acervo)
      noDisco = acervo
    }),
  }
})

vi.mock('../lib/imagemDoItem', () => ({
  imagemDoItemDoBlob: vi.fn(async () => REF_COLADA),
  escolherImagemDoItem: vi.fn(async () => null),
}))

const { AcervoDeItensPanel, itensPorCategoria } = await import('./AcervoDeItensPanel')
const { imagemDoItemDoBlob } = await import('../lib/imagemDoItem')

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  noDisco = { itens: [POCAO, ESPADA], categorias: ['Arma', 'Consumível'] }
  gravados.length = 0
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

async function montar(onDar = vi.fn(() => true), alvos: readonly AlvoDoAcervo[] = ALVOS) {
  await act(async () => {
    root.render(<AcervoDeItensPanel alvos={alvos} onDar={onDar} />)
  })
  return onDar
}

function botao(texto: string, dentro: ParentNode = document.body): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === texto || b.getAttribute('aria-label') === texto)
  if (achado === undefined) throw new Error(`sem o botão ${texto}`)
  return achado
}

function janela(): HTMLElement {
  const achada = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (achada === null) throw new Error('a janela do item não abriu')
  return achada
}

function digitar(campo: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('AcervoDeItensPanel', () => {
  it('a grade é por categoria, na ordem da lista do acervo', async () => {
    await montar()
    const grupos = Array.from(host.querySelectorAll('.lb-itens__grupo')).map((grupo) => grupo.getAttribute('aria-label'))
    expect(grupos).toEqual(['Arma', 'Consumível'])
    expect(host.querySelector('.lb-itens__item img')?.getAttribute('src')).toBe(`/media/${'2'.repeat(64)}.webp`)
    expect(itensPorCategoria([{ ...ESPADA, categoria: '' }, { ...POCAO, categoria: 'Outra' }], ['Arma'])).toEqual([
      { categoria: 'Outra', itens: [{ ...POCAO, categoria: 'Outra' }] },
      { categoria: 'Sem categoria', itens: [{ ...ESPADA, categoria: '' }] },
    ])
  })

  it('"Dar a…" do item empilhável entrega ao personagem escolhido, com a quantidade', async () => {
    const onDar = await montar()
    act(() => botao('Abrir Poção', host).click())
    const dialogo = janela()
    const alvo = dialogo.querySelector<HTMLSelectElement>('select[aria-label="Personagem que recebe o item"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, 'c1|luffy')
      alvo?.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const quantidade = dialogo.querySelector<HTMLInputElement>('input[aria-label="Quantidade"]')
    if (quantidade === null) throw new Error('sem a quantidade no empilhável')
    digitar(quantidade, '3')
    act(() => botao('Dar', dialogo).click())
    expect(onDar).toHaveBeenCalledWith(POCAO, ALVOS[0], 3)
    expect(dialogo.querySelector('.lb-item-janela__resultado')?.textContent).toBe('Dado a Luffy (×3).')
  })

  it('o não empilhável vai um por vez, sem campo de quantidade', async () => {
    const onDar = await montar()
    act(() => botao('Abrir Espada', host).click())
    expect(janela().querySelector('input[aria-label="Quantidade"]')).toBeNull()
    act(() => botao('Dar', janela()).click())
    expect(onDar).toHaveBeenCalledWith(ESPADA, ALVOS[0], 1)
  })

  it('sem personagem com token, a janela diz como ligar um', async () => {
    await montar(vi.fn(() => true), [])
    act(() => botao('Abrir Poção', host).click())
    expect(janela().textContent).toContain('Nenhum personagem com token nas cenas abertas')
  })

  it('"+ Item" cria com a imagem COLADA, e o item entra na grade', async () => {
    await montar()
    act(() => botao('Novo item', host).click())
    const dialogo = janela()
    const area = dialogo.querySelector<HTMLElement>('[role="region"][aria-label="Colar ou soltar imagem do item"]')
    if (area === null) throw new Error('sem a área de colar')
    const png = new File(['x'], 'espada.png', { type: 'image/png' })
    const colagem = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(colagem, 'clipboardData', { value: { files: [png], items: [], types: ['Files'] } })
    await act(async () => {
      area.dispatchEvent(colagem)
    })
    expect(imagemDoItemDoBlob).toHaveBeenCalledWith(png)
    expect(dialogo.querySelector('.lb-item-janela__imagem img')?.getAttribute('src')).toBe(`/media/${'1'.repeat(64)}.webp`)

    const nome = dialogo.querySelector<HTMLInputElement>('input[maxlength="60"]')
    if (nome === null) throw new Error('sem o nome')
    digitar(nome, 'Lança')
    const categoria = dialogo.querySelector<HTMLInputElement>('input[list]')
    if (categoria === null) throw new Error('sem a categoria')
    digitar(categoria, 'Relíquia')
    await act(async () => {
      botao('Criar item', dialogo).click()
    })
    const salvo = gravados.at(-1)
    expect(salvo?.itens.at(-1)).toMatchObject({ nome: 'Lança', imagem: REF_COLADA, categoria: 'Relíquia', empilhavel: false, preco: null })
    // Categoria nova entra na lista que o campo sugere.
    expect(salvo?.categorias).toEqual(['Arma', 'Consumível', 'Relíquia'])
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(Array.from(host.querySelectorAll('.lb-itens__grupo')).map((grupo) => grupo.getAttribute('aria-label'))).toEqual(['Arma', 'Consumível', 'Relíquia'])
  })
})
