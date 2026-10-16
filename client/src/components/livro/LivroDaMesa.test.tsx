import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_CHAT_UNREAD, type ChatUnread } from '../MasterChatPanel'
import { useLivroDaMesaStore } from '../../stores/livroDaMesaStore'
import { LivroDaMesa, type LivroDaMesaProps } from './LivroDaMesa'

/*
 * O LIVRO DA MESA (fatia 4 do design consolidado): lombada com Grupo, Chat,
 * Cenas e Mesa e os contadores, o topo da Sala fixo, uma folha por página
 * (todas montadas, só a aberta à vista) e o recolher para dentro da lombada,
 * também pelo Shift+J.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useLivroDaMesaStore.setState({ pagina: 'grupo', trocaAnimada: false })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function montar(props: Partial<LivroDaMesaProps> = {}) {
  const onAbertoChange = vi.fn()
  act(() =>
    root.render(
      <LivroDaMesa
        aberto
        onAbertoChange={onAbertoChange}
        topo={<p>topo da sala</p>}
        grupo={<button type="button">no grupo</button>}
        chat={<p>conversa</p>}
        mesa={<p>ferramentas</p>}
        cenas={<p>lista de cenas</p>}
        pedidos={0}
        naoLidas={NO_CHAT_UNREAD}
        {...props}
      />,
    ),
  )
  return onAbertoChange
}

const marcador = (nome: string) => {
  const achado = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((aba) => aba.textContent?.startsWith(nome))
  if (achado === undefined) throw new Error(`sem o marcador ${nome}`)
  return achado
}
const folha = (pagina: string) => container.querySelector<HTMLElement>(`[data-pagina="${pagina}"]`)

describe('LivroDaMesa', () => {
  it('quatro marcadores na ordem do protótipo; só a folha aberta à vista, as outras montadas', () => {
    montar()
    expect([...container.querySelectorAll('[role="tab"]')].map((aba) => aba.textContent)).toEqual(['Grupo', 'Chat', 'Cenas', 'Mesa'])
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Páginas do livro da mesa')
    expect(folha('grupo')?.hidden).toBe(false)
    expect(folha('mesa')?.hidden).toBe(true)
    expect(folha('mesa')?.textContent).toBe('ferramentas')
    act(() => marcador('Mesa').click())
    expect(useLivroDaMesaStore.getState().pagina).toBe('mesa')
    expect(folha('mesa')?.hidden).toBe(false)
    expect(folha('grupo')?.hidden).toBe(true)
    // O topo da Sala fica acima de todas as páginas.
    expect(container.querySelector('.gr-pagina__topo')?.textContent).toBe('topo da sala')
  })

  it('contadores: pedidos no Grupo e não lidas no Chat (com o @ da menção), lidos pelo nome do marcador', () => {
    const naoLidas: ChatUnread = { count: 3, mention: true }
    montar({ pedidos: 1, naoLidas })
    expect(marcador('Grupo').querySelector('.gr-marcador__conta')?.textContent).toBe('1')
    expect(marcador('Grupo').textContent).toBe('Grupo1, 1 pedido')
    expect(marcador('Chat').querySelector('.gr-marcador__conta')?.textContent).toBe('@3')
    expect(marcador('Chat').textContent).toContain('3 novas, menciona você')
    montar({ pedidos: 0, naoLidas: NO_CHAT_UNREAD })
    expect(container.querySelector('.gr-marcador__conta')).toBeNull()
  })

  it('recolher: a página fica inerte, a lombada fica; um marcador abre de novo', () => {
    const onAbertoChange = montar({ aberto: false })
    const livro = container.querySelector('aside[aria-label="Livro da mesa"]')
    expect(livro?.classList.contains('gr-e-recolhido')).toBe(true)
    expect(container.querySelector('.gr-pagina-trilho')?.hasAttribute('inert')).toBe(true)
    const abrir = container.querySelector<HTMLButtonElement>('button[aria-label="Abrir a página"]')
    expect(abrir?.getAttribute('aria-expanded')).toBe('false')
    // Pelo ponteiro (`detail` 1) a página desliza; pelo teclado (Enter, `detail` 0) troca na hora.
    act(() => {
      abrir?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    expect(onAbertoChange).toHaveBeenLastCalledWith(true)
    expect(livro?.getAttribute('data-troca')).toBeNull()
    act(() => {
      abrir?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    })
    expect(livro?.getAttribute('data-troca')).toBe('teclado')
    act(() => marcador('Chat').click())
    expect(onAbertoChange).toHaveBeenLastCalledWith(true)
    expect(useLivroDaMesaStore.getState().pagina).toBe('chat')
  })

  it('Shift+J recolhe; com o foco dentro da página, o foco vai para o botão da lombada (a página fica inerte)', () => {
    const onAbertoChange = montar()
    const dentro = [...container.querySelectorAll('button')].find((b) => b.textContent === 'no grupo')
    dentro?.focus()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(onAbertoChange).toHaveBeenLastCalledWith(false)
    // Pela tecla, a página troca parada (sem a transição da gaveta).
    expect(container.querySelector('aside')?.getAttribute('data-troca')).toBe('teclado')
    // O alvo do evento foi o body: o foco só muda quando a tecla nasce dentro da página.
    dentro?.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Recolher a página')
  })

  it('sem sala possível (navegador puro): só a página Cenas, sem topo, com a região "Cenas"', () => {
    montar({ topo: undefined, grupo: undefined, chat: undefined, mesa: undefined })
    expect([...container.querySelectorAll('[role="tab"]')].map((aba) => aba.textContent)).toEqual(['Cenas'])
    expect(container.querySelector('.gr-pagina__topo')).toBeNull()
    expect(container.querySelector('[role="region"][aria-label="Cenas"]')?.closest('[hidden]')).toBeNull()
    expect(container.querySelector('#lb-rail-panel-room')).toBeNull()
  })

  it('os ids de antes ficam para as jornadas: a página da sala e a folha do Chat', () => {
    montar()
    expect(container.querySelector('#lb-rail-panel-room')?.classList.contains('gr-pagina')).toBe(true)
    expect(container.querySelector('#lb-rail-panel-chat')?.getAttribute('data-pagina')).toBe('chat')
  })
})
