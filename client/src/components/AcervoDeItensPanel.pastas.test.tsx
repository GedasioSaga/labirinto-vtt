import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AcervoDeItens, ItemDoCatalogo, PastaDeItens } from '../lib/acervoDeItens'

/**
 * PASTAS NO ACERVO DE ITENS (pedido de 18/11/2026, "Pastas como no
 * Prelúdio"): arrastar o item e a pasta, a recusa do laço, o Desfazer pelo
 * Ctrl+Z, a subpasta pelo "⋯" e a busca igual à do acervo de tokens. O disco é
 * de mentira; `elementFromPoint` (que o jsdom não tem) diz o que está sob o ponteiro.
 */

const POCAO: ItemDoCatalogo = { id: 'item_pocao', nome: 'Poção', imagem: null, descricao: '', categoria: 'Consumível', preco: null, empilhavel: true, pasta: 'pasta_pocoes' }
const ESPADA: ItemDoCatalogo = { id: 'item_espada', nome: 'Espada', imagem: null, descricao: '', categoria: 'Arma', preco: null, empilhavel: false, pasta: 'pasta_arma' }
// Consumível > Poções; Arma.
const PASTAS: PastaDeItens[] = [
  { id: 'pasta_consumivel', nome: 'Consumível' },
  { id: 'pasta_pocoes', nome: 'Poções', paiId: 'pasta_consumivel' },
  { id: 'pasta_arma', nome: 'Arma' },
]

let noDisco: AcervoDeItens = { itens: [], categorias: [], pastas: [] }
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

const { AcervoDeItensPanel } = await import('./AcervoDeItensPanel')
const { useToastStore } = await import('../stores/toastStore')

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

let host: HTMLDivElement
let root: Root
let sobOPonteiro: Element | null = null

beforeEach(() => {
  noDisco = { itens: [POCAO, ESPADA], categorias: [], pastas: PASTAS }
  gravados.length = 0
  sobOPonteiro = null
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => sobOPonteiro })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  Reflect.deleteProperty(document, 'elementFromPoint')
})

async function montar() {
  await act(async () => {
    root.render(<AcervoDeItensPanel alvos={[]} onDar={vi.fn(() => true)} />)
  })
}

function linhaDaPasta(id: string): HTMLElement {
  const linha = host.querySelector<HTMLElement>(`[data-pasta-id="${id}"] > .lb-acervo__pasta-topo > .lb-acervo__pasta-botao`)
  if (linha === null) throw new Error(`sem a pasta ${id}`)
  return linha
}

function botao(rotulo: string): HTMLButtonElement {
  const achado = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.getAttribute('aria-label') === rotulo || b.textContent?.trim() === rotulo)
  if (achado === undefined) throw new Error(`sem o botão ${rotulo}`)
  return achado
}

/** Aperta em `de`, anda até `ate` (que fica sob o ponteiro) e solta. */
function arrastar(de: HTMLElement, ate: HTMLElement, soltar = true): void {
  act(() => void de.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true, pointerId: 5, clientX: 10, clientY: 10 })))
  sobOPonteiro = ate
  act(() => void window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 5, clientX: 40, clientY: 90 })))
  if (soltar) act(() => void window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: 40, clientY: 90 })))
}

function digitar(campo: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('AcervoDeItensPanel — pastas', () => {
  it('o item arrastado até outra pasta muda de pasta e avisa com Desfazer; o Ctrl+Z no painel desfaz', async () => {
    await montar()
    arrastar(botao('Abrir Poção'), linhaDaPasta('pasta_arma'))
    // O aviso sai depois de a gravação terminar.
    await act(async () => {})
    expect(gravados.at(-1)?.itens.find((item) => item.id === POCAO.id)?.pasta).toBe('pasta_arma')
    const aviso = useToastStore.getState().toasts.at(-1)
    expect([aviso?.text, aviso?.actions?.map((acao) => acao.label)]).toEqual(['“Poção” foi para Arma.', ['Desfazer']])

    const espada = botao('Abrir Espada')
    espada.focus()
    act(() => void espada.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })))
    await act(async () => {})
    expect(gravados.at(-1)?.itens.find((item) => item.id === POCAO.id)?.pasta).toBe('pasta_pocoes')
  })

  it('a pasta não entra numa das de dentro dela (o fantasma diz por quê, nada grava); dentro de outra, vai', async () => {
    await montar()
    arrastar(linhaDaPasta('pasta_consumivel'), linhaDaPasta('pasta_pocoes'), false)
    expect(document.body.querySelector('.lb-itens__fantasma-alvo')?.textContent).toBe('Uma pasta não entra numa das pastas de dentro dela.')
    expect(host.querySelector('[data-pasta-id="pasta_pocoes"]')?.getAttribute('data-alvo')).toBe('recusa')
    act(() => void window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: 40, clientY: 90 })))
    expect(gravados).toHaveLength(0)

    arrastar(linhaDaPasta('pasta_consumivel'), linhaDaPasta('pasta_arma'))
    expect(gravados.at(-1)?.pastas.find((pasta) => pasta.id === 'pasta_consumivel')?.paiId).toBe('pasta_arma')
    expect(linhaDaPasta('pasta_arma').getAttribute('aria-label')).toBe('Arma (2)')
  })

  it('"⋯ › Nova pasta dentro" cria a subpasta na pasta, aberta', async () => {
    await montar()
    act(() => botao('Ações da pasta Arma').click())
    act(() => botao('Nova pasta dentro').click())
    const campo = host.querySelector<HTMLInputElement>('input[aria-label="Nome da nova pasta dentro de Arma"]')
    if (campo === null) throw new Error('sem o campo do nome')
    digitar(campo, '  Armas de fogo ')
    act(() => campo.form?.requestSubmit())
    const criada = gravados.at(-1)?.pastas.at(-1)
    expect([criada?.nome, criada?.paiId]).toEqual(['Armas de fogo', 'pasta_arma'])
    expect(host.querySelector(`[data-pasta-id="pasta_arma"] .lb-itens__dentro [data-pasta-id="${criada?.id}"]`)).not.toBeNull()
  })

  it('a busca acha sem acento, abre na tela só a pasta com achado (sem gravar) e conta; sem achado, diz o termo', async () => {
    noDisco = { ...noDisco, pastas: PASTAS.map((pasta) => (pasta.id === 'pasta_consumivel' ? { ...pasta, recolhida: true } : pasta)) }
    await montar()
    const campo = host.querySelector<HTMLInputElement>('input[aria-label="Buscar item"]')
    if (campo === null) throw new Error('sem a busca')
    digitar(campo, 'POCAO')
    expect(linhaDaPasta('pasta_consumivel').getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('[data-pasta-id="pasta_arma"]')).toBeNull()
    expect(host.querySelector('.lb-acervo__resultado')?.textContent).toBe('1 de 2 itens')
    expect(gravados).toHaveLength(0)
    digitar(campo, 'xyz')
    expect(host.querySelector('.lb-acervo__resultado')?.textContent).toBe('Nada com “xyz”.')
  })
})
