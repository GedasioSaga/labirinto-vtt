import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComSaida, type ComSaidaFilho } from './ComSaida'
import { SAIDA_DO_POP_MS } from './comum'
import { MenuItem, Pop } from './Pop'

/**
 * Fatia 20: pop e menus antigos entram e saem em 120 a 160 ms com a curva do
 * app; reabrir no meio da saída mostra o MESMO nó (a transição volta do ponto
 * em que estava, sem piscar); com movimento reduzido, troca na hora.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const passar = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const reduzirMovimento = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

function MenuAntigo({ rotulo, saindo = false }: { rotulo: string } & ComSaidaFilho) {
  return (
    <div className={saindo ? 'menu gr-anima gr-sai' : 'menu gr-anima'} inert={saindo}>
      {rotulo}
    </div>
  )
}

const menu = () => container.querySelector<HTMLElement>('.menu')

describe('ComSaida — a saída dos menus antigos', () => {
  const montar = (aberto: boolean, rotulo = 'Abrir') =>
    act(() => root.render(<ComSaida>{aberto && <MenuAntigo rotulo={rotulo} />}</ComSaida>))

  it('fechado, o menu fica a saída inteira com gr-sai e inerte, com o rótulo de quando fechou, e então some', () => {
    montar(true, 'Fechar')
    montar(false)
    expect(menu()?.classList.contains('gr-sai')).toBe(true)
    expect(menu()?.hasAttribute('inert')).toBe(true)
    expect(menu()?.textContent).toBe('Fechar')
    passar(SAIDA_DO_POP_MS - 1)
    expect(menu()).not.toBeNull()
    passar(1)
    expect(menu()).toBeNull()
  })

  it('reabrir no meio da saída usa o mesmo nó, sem gr-sai: a transição volta de onde estava', () => {
    montar(true)
    const antes = menu()
    montar(false)
    passar(SAIDA_DO_POP_MS / 2)
    montar(true)
    expect(menu()).toBe(antes)
    expect(menu()?.classList.contains('gr-sai')).toBe(false)
    passar(SAIDA_DO_POP_MS * 2)
    expect(menu()).toBe(antes)
  })

  it('com movimento reduzido, sai na hora', () => {
    reduzirMovimento()
    montar(true)
    montar(false)
    expect(menu()).toBeNull()
  })
})

function MenuDoPop() {
  const [aberto, setAberto] = useState(false)
  const gatilho = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={gatilho} type="button" onClick={() => setAberto((a) => !a)}>
        Mais
      </button>
      <Pop aberto={aberto} gatilho={gatilho} onFechar={() => setAberto(false)} rotulo="Mais ações">
        <MenuItem onClick={() => {}}>Abrir agora</MenuItem>
      </Pop>
    </>
  )
}

describe('Pop — reabrir durante a saída', () => {
  const pop = () => document.body.querySelector<HTMLElement>('.gr-pop')
  const mais = () => {
    const botao = container.querySelector<HTMLButtonElement>('button')
    if (botao === null) throw new Error('sem o gatilho')
    return botao
  }

  it('o mesmo nó volta, sem gr-sai, e fica', () => {
    act(() => root.render(<MenuDoPop />))
    act(() => mais().click())
    const antes = pop()
    act(() => mais().click())
    expect(pop()?.classList.contains('gr-sai')).toBe(true)
    passar(SAIDA_DO_POP_MS / 2)
    act(() => mais().click())
    expect(pop()).toBe(antes)
    expect(pop()?.classList.contains('gr-sai')).toBe(false)
    passar(SAIDA_DO_POP_MS * 2)
    expect(pop()).toBe(antes)
  })

  it('com movimento reduzido, fecha na hora', () => {
    reduzirMovimento()
    act(() => root.render(<MenuDoPop />))
    act(() => mais().click())
    act(() => mais().click())
    expect(pop()).toBeNull()
  })
})

/** O grimorio.css como está no disco (ver `Toggle.test.tsx`: `?raw` e `new URL` não leem o arquivo). */
async function lerGrimorioCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grimorio.css'), 'utf8')
}

describe('grimorio.css — tempos e curva da entrada e da saída', () => {
  let css = ''
  // No beforeAll, e não no teste: o beforeEach do arquivo liga o relógio falso.
  beforeAll(async () => {
    css = (await lerGrimorioCss()).replace(/\s+/g, ' ')
  })

  it('pop e menus antigos entram por transição de 150 ms na curva do app e saem em 120 ms', () => {
    expect(css).toContain('.gr-anima { transform-origin: var(--gr-origem, 0 0); transition: opacity 150ms var(--lb-gr-ease-out), transform 150ms var(--lb-gr-ease-out); }')
    expect(css).toContain('transition: opacity 150ms var(--lb-gr-ease-out), transform 150ms var(--lb-gr-ease-out); }')
    expect(css).toContain('@starting-style { .gr-pop, .gr-anima { opacity: 0; transform: scale(0.96); } }')
    expect(css).toContain('.gr-pop.gr-sai, .gr-anima.gr-sai { opacity: 0; transform: scale(0.97); transition-duration: 120ms; }')
    // O JS desmonta quando a transição do CSS acaba: os dois números são o mesmo.
    expect(SAIDA_DO_POP_MS).toBe(120)
  })

  it('com movimento reduzido, pop e menus não têm transição nem ponto de partida', () => {
    const reduzido = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduzido).toContain('.gr-pop, .gr-anima { transition: none; }')
    expect(reduzido).toContain('@starting-style { .gr-pop, .gr-anima { opacity: 1; transform: none; } }')
  })

  it('a Atalhos abre parada: nem o fundo nem a caixa entram animados', () => {
    expect(css).toContain('.gr-dlg-fundo--parado, .gr-dlg-fundo--parado .gr-dlg { animation: none; }')
  })
})
