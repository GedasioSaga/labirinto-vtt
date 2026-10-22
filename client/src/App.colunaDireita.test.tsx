import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostBridge } from './net/hostBridge'

/**
 * O editor com o LIVRO DA MESA (fatia 4 do design consolidado) na borda
 * direita: as Cenas são uma página dele, o livro do mestre da esquerda não tem
 * as abas Jogo e Chat, o botão "Chat" flutuante saiu e a página recolhe para
 * dentro da lombada (Shift+J). Fora do Tauri não há sala, então o livro fica
 * só com a página Cenas.
 */

// O canvas de verdade precisa de WebGL.
vi.mock('./pixi/PixiCanvas', () => ({
  PixiCanvas: () => <div className="duble-do-canvas" />,
}))

/*
 * A sala só existe no app (Tauri). O teste liga o `isTauri` DEPOIS que o
 * editor montou, para os efeitos de montagem (janela, cópia de recuperação)
 * seguirem no modo navegador, e a ponte da sala é de mentira: abrir responde
 * com um código, fechar só resolve.
 */
const tauri = vi.hoisted(() => ({ ligado: false }))
vi.mock('@tauri-apps/api/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tauri-apps/api/core')>()),
  isTauri: () => tauri.ligado,
}))
const SALA = { code: 'MESA42', urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
function ponteDeMentira(): HostBridge {
  const conhecidas: Record<string, unknown> = { start: async () => SALA, stop: async () => undefined, tableKey: () => 'chave-da-mesa' }
  const ponte: object = new Proxy({}, { get: (_alvo, chave) => (typeof chave === 'string' && chave in conhecidas ? conhecidas[chave] : () => undefined) })
  return ponte as HostBridge
}
vi.mock('./net/hostBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./net/hostBridge')>()),
  createHostBridge: () => ponteDeMentira(),
}))

const { default: App } = await import('./App')
const { abertoPelaJanela } = await import('./components/livro/LivroDaMesa')

let container: HTMLDivElement
let root: Root
/** A largura da janela que o App lê; 1440 é a tela de referência do design (o jsdom diz 1024). */
let largura = 1440

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  tauri.ligado = false
  largura = 1440
  vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => largura)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

function redimensionar(nova: number) {
  largura = nova
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function botao(nome: string, exato: boolean, dentro: ParentNode = container): HTMLButtonElement | undefined {
  return [...dentro.querySelectorAll('button')].find((b) => {
    const texto = (b.textContent ?? '').trim()
    return exato ? texto === nome : texto.startsWith(nome)
  })
}

/** O caminho do menu inicial, o mesmo do e2e (`e2e/helpers/enterEditor.ts`). */
async function abrirOEditor() {
  await act(async () => root.render(<App />))
  await act(async () => botao('Criar Mapas', false)?.click())
  await act(async () => botao('Criar mapa', true)?.click())
  if (container.querySelector('.duble-do-canvas') === null) throw new Error('o editor não abriu')
}

const editor = () => container.querySelector<HTMLElement>('.lb-editor')
const livroDaMesa = () => container.querySelector<HTMLElement>('aside[aria-label="Livro da mesa"]')
const livro = () => container.querySelector<HTMLElement>('aside[aria-label="Livro do mestre"]')

describe('App: livro da mesa', () => {
  it('as Cenas são a página do livro da mesa; a esquerda é o livro do mestre, sem as abas Jogo e Chat', async () => {
    await abrirOEditor()
    const direita = livroDaMesa()
    expect(direita).not.toBeNull()
    expect(direita?.classList.contains('gr-e-recolhido')).toBe(false)
    const cenas = direita?.querySelector<HTMLElement>('[role="region"][aria-label="Cenas"]')
    expect(cenas?.closest('[hidden]')).toBeNull()
    expect(botao('Cenas', false, cenas ?? container)).toBeDefined()
    // A esquerda: o livro do mestre, sem as Cenas; as abas dele são as páginas, não Jogo e Chat.
    expect(livro()).not.toBeNull()
    expect(botao('Cenas', false, livro() ?? container)).toBeUndefined()
    const abas = Array.from(livro()?.querySelectorAll('[role="tab"]') ?? []).map((aba) => aba.textContent)
    expect(abas).toEqual(['Ficha', 'Cena', 'Aventura', 'Acervo'])
    // Navegador puro: sem sala, o livro da mesa só tem o marcador Cenas e nenhum topo da Sala.
    expect(Array.from(direita?.querySelectorAll('[role="tab"]') ?? []).map((aba) => aba.textContent)).toEqual(['Cenas'])
    expect(direita?.querySelector('.gr-pagina__topo')).toBeNull()
    expect(editor()?.dataset.coldir).toBe('aberta')
  })

  it('o botão "Chat" flutuante saiu do mapa', async () => {
    await abrirOEditor()
    expect(container.querySelector('.lb-mchat__toggle')).toBeNull()
    expect(botao('Chat', false)).toBeUndefined()
  })

  it('Shift+J recolhe a página para dentro da lombada (que fica, com o botão de abrir); de novo, ela volta', async () => {
    await abrirOEditor()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(livroDaMesa()?.classList.contains('gr-e-recolhido')).toBe(true)
    expect(livroDaMesa()?.querySelector('.gr-pagina-trilho')?.hasAttribute('inert')).toBe(true)
    expect(editor()?.dataset.coldir).toBe('escondida')
    expect(livroDaMesa()?.querySelector('button[aria-label="Abrir a página"]')?.getAttribute('aria-expanded')).toBe('false')
    // A escolha fica lembrada, como a da coluna de antes.
    expect(window.localStorage.getItem('lb-coldir:aberta')).toBe('0')
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(livroDaMesa()?.classList.contains('gr-e-recolhido')).toBe(false)
    expect(editor()?.dataset.coldir).toBe('aberta')
  })
})

/** Decisão 7 do PLANO.md: abaixo de 1366 px, com a sala fechada e sem escolha lembrada, o livro da mesa recolhe sozinho. */
describe('App: livro da mesa em janela menor que 1366', () => {
  const recolhido = () => livroDaMesa()?.classList.contains('gr-e-recolhido')

  it('a regra sem escolha: aberto a partir de 1366; entre 1024 e 1365 só com a sala aberta; abaixo de 1024, recolhido', () => {
    expect([1920, 1366, 1365, 1280, 1024, 1023].map((l) => abertoPelaJanela(l, false))).toEqual([true, true, false, false, false, false])
    expect([1920, 1366, 1365, 1280, 1024, 1023].map((l) => abertoPelaJanela(l, true))).toEqual([true, true, true, true, true, false])
  })

  it('a 1280 com a sala fechada o livro nasce recolhido; a 1366 nasce aberto', async () => {
    largura = 1280
    await abrirOEditor()
    expect(recolhido()).toBe(true)
    expect(editor()?.dataset.coldir).toBe('escondida')
    act(() => root.unmount())
    root = createRoot(container)
    largura = 1366
    await abrirOEditor()
    expect(recolhido()).toBe(false)
  })

  it('sem escolha, o livro segue a janela ao redimensionar', async () => {
    await abrirOEditor()
    expect(recolhido()).toBe(false)
    redimensionar(1365)
    expect(recolhido()).toBe(true)
    redimensionar(1920)
    expect(recolhido()).toBe(false)
  })

  it('a escolha lembrada vence a janela, ao abrir e ao redimensionar', async () => {
    window.localStorage.setItem('lb-coldir:aberta', '1')
    largura = 1280
    await abrirOEditor()
    expect(recolhido()).toBe(false)
    redimensionar(1100)
    expect(recolhido()).toBe(false)
  })

  it('o mestre que abre a página a 1280 a vê ficar aberta (a escolha passa a valer)', async () => {
    largura = 1280
    await abrirOEditor()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(recolhido()).toBe(false)
    expect(window.localStorage.getItem('lb-coldir:aberta')).toBe('1')
    redimensionar(1200)
    expect(recolhido()).toBe(false)
  })

  /*
   * A 1280 o "Abrir sala" mora na página recolhida (inerte): sem escolha, a
   * sala aberta a 1280 vem de uma janela que estreitou com a sala aberta. O
   * livro segue a sala, e nada disso vira escolha lembrada.
   */
  it('a 1280, sem escolha: sala fechada recolhe; a sala aberta mantém o livro aberto; fechar a sala recolhe de novo', async () => {
    largura = 1280
    await abrirOEditor()
    expect(recolhido()).toBe(true)
    tauri.ligado = true
    await act(async () => root.render(<App />))
    const topo = () => livroDaMesa()?.querySelector<HTMLElement>('.gr-pagina__topo') ?? container
    expect(botao('Abrir sala', true, topo())).toBeDefined()
    // A sala abre na janela larga, onde a página está à vista.
    redimensionar(1440)
    expect(recolhido()).toBe(false)
    await act(async () => botao('Abrir sala', true, topo())?.click())
    expect(topo().textContent).toContain(SALA.code)
    redimensionar(1280)
    expect(recolhido()).toBe(false)
    expect(editor()?.dataset.coldir).toBe('aberta')
    // Fechar a sala pelo "Mais da sala" (o menu e a pergunta vão para o body).
    act(() => livroDaMesa()?.querySelector<HTMLButtonElement>('button[aria-label="Mais da sala"]')?.click())
    await act(async () => botao('Fechar sala…', true, document.body)?.click())
    const fechar = botao('Fechar sala', true, document.querySelector('[role="alertdialog"]') ?? container)
    expect(fechar).toBeDefined()
    await act(async () => fechar?.click())
    expect(botao('Abrir sala', true, topo())).toBeDefined()
    expect(recolhido()).toBe(true)
    expect(editor()?.dataset.coldir).toBe('escondida')
    expect(window.localStorage.getItem('lb-coldir:aberta')).toBeNull()
  })
})
