import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_CHAT_UNREAD, type ChatUnread } from '../MasterChatPanel'
import { useLivroDaMesaStore } from '../../stores/livroDaMesaStore'
import { LivroDaMesa, useLivroDaMesaAberto, type LivroDaMesaProps } from './LivroDaMesa'

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
/** Os marcadores do livro: só os da lista dele (a página Sons tem abas próprias, Músicas e Efeitos sonoros). */
const marcadores = () =>
  [...container.querySelectorAll('[role="tablist"][aria-label="Páginas do livro da mesa"] [role="tab"]')].map((aba) => aba.textContent)

describe('LivroDaMesa', () => {
  it('seis marcadores: os quatro do protótipo, Batalha (F2) depois de Cenas e Sons no fim; só a folha aberta à vista, as outras montadas', () => {
    montar()
    expect(marcadores()).toEqual(['Grupo', 'Chat', 'Cenas', 'Batalha', 'Mesa', 'Sons'])
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

  it('sem sala possível (navegador puro): só as páginas Cenas, Batalha e Sons, sem topo, com a região "Cenas"', () => {
    montar({ topo: undefined, grupo: undefined, chat: undefined, mesa: undefined })
    expect(marcadores()).toEqual(['Cenas', 'Batalha', 'Sons'])
    expect(container.querySelector('.gr-pagina__topo')).toBeNull()
    expect(container.querySelector('[role="region"][aria-label="Cenas"]')?.closest('[hidden]')).toBeNull()
    expect(container.querySelector('#lb-rail-panel-room')).toBeNull()
    // O som local não depende de sala: a página Sons abre sem ela.
    act(() => marcador('Sons').click())
    expect(folha('sons')?.hidden).toBe(false)
    expect(folha('cenas')?.hidden).toBe(true)
  })

  it('a folha Sons fica montada com qualquer página aberta (os atalhos 1 a 9 moram nela) e traz a página Sons', () => {
    montar()
    expect(folha('grupo')?.hidden).toBe(false)
    expect(folha('sons')?.hidden).toBe(true)
    expect(folha('sons')?.querySelector('[role="region"][aria-label="Sons"]')).not.toBeNull()
    act(() => marcador('Sons').click())
    expect(useLivroDaMesaStore.getState().pagina).toBe('sons')
    expect(folha('sons')?.hidden).toBe(false)
    // Sem sala a página guardada Sons continua valendo (Grupo, Chat e Mesa é que caem nas Cenas).
    montar({ topo: undefined, grupo: undefined, chat: undefined, mesa: undefined })
    expect(folha('sons')?.hidden).toBe(false)
  })

  it('os ids de antes ficam para as jornadas: a página da sala e a folha do Chat', () => {
    montar()
    expect(container.querySelector('#lb-rail-panel-room')?.classList.contains('gr-pagina')).toBe(true)
    expect(container.querySelector('#lb-rail-panel-chat')?.getAttribute('data-pagina')).toBe('chat')
  })
})

/*
 * O dono do hook é o App (4 mil linhas): arrastar a borda da janela não pode
 * renderizá-lo a cada pixel. Só cruzar 1024 ou 1366 muda o livro sem escolha.
 */
describe('useLivroDaMesaAberto ao redimensionar', () => {
  let largura = 1440
  let renderizacoes = 0
  let abertoVisto: boolean | null = null

  function Sonda({ salaAberta }: { salaAberta: boolean }) {
    renderizacoes += 1
    abertoVisto = useLivroDaMesaAberto(salaAberta)[0]
    return null
  }

  /** Um evento por pixel, cada um no seu `act`, como os quadros de um arrasto de verdade (sem juntar as atualizações). */
  function arrastarAte(alvo: number) {
    const passo = alvo < largura ? -1 : 1
    while (largura !== alvo) {
      largura += passo
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
    }
  }

  beforeEach(() => {
    largura = 1440
    renderizacoes = 0
    window.localStorage.clear()
    vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => largura)
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('74 pixels de arrasto dentro da faixa larga não renderizam; cruzar 1366 renderiza uma vez e recolhe', () => {
    act(() => root.render(<Sonda salaAberta={false} />))
    expect(renderizacoes).toBe(1)
    expect(abertoVisto).toBe(true)
    arrastarAte(1366)
    expect(renderizacoes).toBe(1)
    arrastarAte(1365)
    expect(renderizacoes).toBe(2)
    expect(abertoVisto).toBe(false)
  })

  it('com a sala aberta, de 1365 a 1024 (341 eventos) o livro segue aberto sem renderizar; abaixo de 1024 recolhe', () => {
    largura = 1365
    act(() => root.render(<Sonda salaAberta />))
    expect(abertoVisto).toBe(true)
    arrastarAte(1024)
    expect(renderizacoes).toBe(1)
    arrastarAte(1023)
    expect(abertoVisto).toBe(false)
    expect(renderizacoes).toBe(2)
  })
})
