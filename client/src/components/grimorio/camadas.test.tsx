import { act, useRef, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Balao } from './Balao'
import { Dialogo } from './Dialogo'
import { MenuItem, Pop } from './Pop'
import { Torrada } from './Torrada'

/*
 * O que flutua por cima do livro: pop/menu, diálogo, balão e torrada. Tudo é
 * portal no <body>, então as buscas vão no documento inteiro.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  // o balão lembra quando o último fechou; cada teste começa longe dessa janela
  vi.setSystemTime(Date.now() + 60_000)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

const montar = (no: ReactNode) => act(() => root.render(no))
const no = <T extends Element = HTMLElement>(seletor: string): T | null => document.querySelector<T>(seletor)
const um = <T extends Element = HTMLElement>(seletor: string): T => {
  const achado = no<T>(seletor)
  if (!achado) throw new Error(`não achei ${seletor}`)
  return achado
}
const botao = (nome: string) => {
  const achado = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  if (!achado) throw new Error(`não achei o botão ${nome}`)
  return achado
}
const passar = (ms: number) => act(() => vi.advanceTimersByTime(ms))
function teclar(el: Element, key: string, extra: KeyboardEventInit = {}): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
  })
}
function ponteiro(el: Element, tipo: 'pointerover' | 'pointerout', pointerType = 'mouse'): void {
  act(() => {
    el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, pointerType, relatedTarget: tipo === 'pointerout' ? document.body : null }))
  })
}

function MenuDeTeste({ aoEscolher }: { aoEscolher: (acao: string) => void }) {
  const gatilho = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button ref={gatilho} type="button" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        Mais ações
      </button>
      <button type="button">Fora</button>
      <Pop aberto={aberto} gatilho={gatilho} onFechar={() => setAberto(false)} rotulo="Mais ações da porta">
        <MenuItem onClick={() => aoEscolher('abrir')}>Abrir agora</MenuItem>
        <MenuItem disabled onClick={() => aoEscolher('trancar')}>
          Trancar
        </MenuItem>
        <MenuItem perigo atalho="Del" onClick={() => aoEscolher('apagar')}>
          Apagar
        </MenuItem>
      </Pop>
    </>
  )
}

describe('Pop (menu)', () => {
  it('abre com o foco no primeiro item; as setas pulam o desabilitado e dão a volta; Home/End', () => {
    montar(<MenuDeTeste aoEscolher={vi.fn()} />)
    act(() => botao('Mais ações').click())
    const menu = um('[role="menu"]')
    expect(menu.getAttribute('aria-label')).toBe('Mais ações da porta')
    const ativo = () => document.activeElement?.textContent
    expect(ativo()).toBe('Abrir agora')
    teclar(menu, 'ArrowDown')
    expect(ativo()).toBe('ApagarDel')
    teclar(menu, 'ArrowDown')
    expect(ativo()).toBe('Abrir agora')
    teclar(menu, 'ArrowUp')
    expect(ativo()).toBe('ApagarDel')
    teclar(menu, 'Home')
    expect(ativo()).toBe('Abrir agora')
    teclar(menu, 'End')
    expect(ativo()).toBe('ApagarDel')
  })

  it('Esc fecha, devolve o foco ao gatilho e o pop some depois da saída', () => {
    montar(<MenuDeTeste aoEscolher={vi.fn()} />)
    act(() => botao('Mais ações').click())
    teclar(um('[role="menu"]'), 'Escape')
    expect(document.activeElement).toBe(botao('Mais ações'))
    expect(botao('Mais ações').getAttribute('aria-expanded')).toBe('false')
    expect(um('.gr-pop').classList.contains('gr-sai')).toBe(true)
    passar(110)
    expect(no('.gr-pop')).toBeNull()
  })

  it('escolher um item age, fecha e devolve o foco; clicar fora fecha sem agir', () => {
    const aoEscolher = vi.fn()
    montar(<MenuDeTeste aoEscolher={aoEscolher} />)
    act(() => botao('Mais ações').click())
    act(() => botao('ApagarDel').click())
    expect(aoEscolher).toHaveBeenCalledWith('apagar')
    expect(document.activeElement).toBe(botao('Mais ações'))
    passar(110)
    act(() => botao('Mais ações').click())
    act(() => {
      botao('Fora').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(botao('Mais ações').getAttribute('aria-expanded')).toBe('false')
    expect(aoEscolher).toHaveBeenCalledTimes(1)
  })
})

function DialogoDeTeste({ alerta }: { alerta?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const cancelar = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Configurações do mapa
      </button>
      <Dialogo aberto={aberto} titulo="Configurações" alerta={alerta} focoInicial={alerta ? cancelar : undefined} onFechar={() => setAberto(false)}>
        <input aria-label="Colunas" />
        <button ref={cancelar} type="button">
          Cancelar
        </button>
      </Dialogo>
    </>
  )
}

/** Clique de mouse no navegador: o botão ganha o foco e depois recebe o clique. */
function abrirDialogo(): void {
  const abridor = botao('Configurações do mapa')
  act(() => {
    abridor.focus()
    abridor.click()
  })
}

describe('Dialogo', () => {
  it('modal com título; o foco entra no primeiro campo e o Tab dá a volta só dentro', () => {
    montar(<DialogoDeTeste />)
    abrirDialogo()
    const dialogo = um('[role="dialog"]')
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(dialogo.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Configurações')
    expect(document.activeElement).toBe(um('input[aria-label="Colunas"]'))
    act(() => botao('Cancelar').focus())
    teclar(dialogo, 'Tab')
    expect(document.activeElement).toBe(botao('Fechar'))
    teclar(dialogo, 'Tab', { shiftKey: true })
    expect(document.activeElement).toBe(botao('Cancelar'))
  })

  it('Esc fecha e devolve o foco a quem abriu; clicar no fundo também fecha', () => {
    montar(<DialogoDeTeste />)
    abrirDialogo()
    teclar(um('[role="dialog"]'), 'Escape')
    expect(document.activeElement).toBe(botao('Configurações do mapa'))
    expect(um('.gr-dlg-fundo').classList.contains('gr-sai')).toBe(true)
    passar(140)
    expect(no('.gr-dlg-fundo')).toBeNull()
    abrirDialogo()
    act(() => {
      um('.gr-dlg-fundo').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    passar(140)
    expect(no('[role="dialog"]')).toBeNull()
  })

  it('alerta: alertdialog que começa no botão seguro e ignora o clique no fundo', () => {
    montar(<DialogoDeTeste alerta />)
    abrirDialogo()
    expect(no('[role="alertdialog"]')).not.toBeNull()
    expect(document.activeElement).toBe(botao('Cancelar'))
    act(() => {
      um('.gr-dlg-fundo').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    passar(140)
    expect(no('[role="alertdialog"]')).not.toBeNull()
  })
})

function DoisBaloes() {
  return (
    <>
      <Balao texto="Desfazer" atalho="Ctrl Z">
        {(gatilho) => (
          <button type="button" aria-label="Desfazer" {...gatilho}>
            d
          </button>
        )}
      </Balao>
      <Balao texto="Refazer" atalho="Ctrl Y">
        {(gatilho) => (
          <button type="button" aria-label="Refazer" {...gatilho}>
            r
          </button>
        )}
      </Balao>
    </>
  )
}

describe('Balao', () => {
  it('pairar com o mouse espera 320 ms; o balão descreve o gatilho e mostra a tecla', () => {
    montar(<DoisBaloes />)
    ponteiro(botao('Desfazer'), 'pointerover')
    passar(300)
    expect(no('[role="tooltip"]')).toBeNull()
    passar(20)
    const balao = um('[role="tooltip"]')
    expect(balao.textContent).toBe('DesfazerCtrl Z')
    expect(balao.querySelector('kbd')?.textContent).toBe('Ctrl Z')
    expect(botao('Desfazer').getAttribute('aria-describedby')).toBe(balao.id)
  })

  it('logo depois de um balão fechar, o vizinho aparece na hora e sem animação', () => {
    montar(<DoisBaloes />)
    ponteiro(botao('Desfazer'), 'pointerover')
    passar(320)
    ponteiro(botao('Desfazer'), 'pointerout')
    expect(botao('Desfazer').hasAttribute('aria-describedby')).toBe(false)
    ponteiro(botao('Refazer'), 'pointerover')
    const balao = um('[role="tooltip"]')
    expect(balao.textContent).toBe('RefazerCtrl Y')
    expect(balao.classList.contains('gr-instantaneo')).toBe(true)
    expect(balao.classList.contains('gr-vis')).toBe(true)
    // abrir o vizinho tira o anterior na hora: nunca duas caixas
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1)
  })

  it('toque não abre; foco pelo teclado abre sem esperar e Esc fecha', () => {
    montar(<DoisBaloes />)
    ponteiro(botao('Desfazer'), 'pointerover', 'touch')
    passar(1000)
    expect(no('[role="tooltip"]')).toBeNull()
    // o jsdom não sabe se o foco veio do teclado: aqui ele veio
    const original = Element.prototype.matches
    const espiao = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, seletor: string) {
      return seletor === ':focus-visible' || original.call(this, seletor)
    })
    act(() => botao('Refazer').focus())
    expect(um('[role="tooltip"]').textContent).toBe('RefazerCtrl Y')
    teclar(botao('Refazer'), 'Escape')
    passar(140)
    expect(no('[role="tooltip"]')).toBeNull()
    espiao.mockRestore()
  })
})

describe('Torrada', () => {
  it('status que some sozinho: 2,6 s, depois a saída, depois onFechar', () => {
    const onFechar = vi.fn()
    montar(<Torrada mensagem="Mapa salvo." onFechar={onFechar} />)
    const torrada = um('[role="status"]')
    expect(torrada.textContent).toBe('Mapa salvo.')
    passar(2599)
    expect(torrada.classList.contains('gr-sai')).toBe(false)
    passar(1)
    expect(torrada.classList.contains('gr-sai')).toBe(true)
    expect(onFechar).not.toHaveBeenCalled()
    passar(160)
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('com Desfazer fica 5,2 s, e o Desfazer age e fecha na hora', () => {
    const desfazer = vi.fn()
    const onFechar = vi.fn()
    montar(<Torrada mensagem="Porta apagada." acao={{ rotulo: 'Desfazer', onClick: desfazer }} onFechar={onFechar} />)
    passar(5000)
    expect(um('.gr-torrada').classList.contains('gr-sai')).toBe(false)
    act(() => botao('Desfazer').click())
    expect(desfazer).toHaveBeenCalledTimes(1)
    expect(um('.gr-torrada').classList.contains('gr-sai')).toBe(true)
    passar(160)
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('ponteiro em cima segura; ao sair, o prazo recomeça', () => {
    const onFechar = vi.fn()
    montar(<Torrada mensagem="Mapa salvo." onFechar={onFechar} />)
    passar(2000)
    ponteiro(um('.gr-torrada'), 'pointerover')
    passar(8000)
    expect(um('.gr-torrada').classList.contains('gr-sai')).toBe(false)
    ponteiro(um('.gr-torrada'), 'pointerout')
    passar(2600 + 160)
    expect(onFechar).toHaveBeenCalledTimes(1)
  })
})
