import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneListItem } from '../../stores/adventureStore'
import { ChipDaCena, OUTRAS_CENAS, trechosDoMenu, type ChipDaCenaProps } from './ChipDaCena'

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
  vi.restoreAllMocks()
})

const cena = (id: string, name: string, extra: Partial<SceneListItem> = {}): SceneListItem => ({
  id,
  name,
  tokenCount: 0,
  available: true,
  active: false,
  renamable: true,
  ...extra,
})

/** Porto (pasta) > Porto de Tasmaturi, Armazém 3 > Cofre; Cidade Alta (pasta) > Torre; Estrada solta. */
const AVENTURA: SceneListItem[] = [
  cena('porto', 'Porto'),
  cena('tasmaturi', 'Porto de Tasmaturi', { parentId: 'porto', active: true, start: true }),
  cena('armazem', 'Armazém 3', { parentId: 'porto' }),
  cena('cofre', 'Cofre', { parentId: 'armazem' }),
  cena('estrada', 'Estrada'),
  cena('cidade', 'Cidade Alta'),
  cena('torre', 'Torre do sino', { parentId: 'cidade', available: false }),
]

function montar(props: Partial<ChipDaCenaProps> = {}) {
  const onTrocar = vi.fn()
  const onVerTodas = vi.fn()
  act(() => root.render(<ChipDaCena cenas={AVENTURA} onTrocar={onTrocar} onVerTodas={onVerTodas} {...props} />))
  return { onTrocar, onVerTodas }
}

const nomeDoChip = () => {
  const achado = container.querySelector<HTMLButtonElement>('.gr-chip-cena__nome')
  if (!achado) throw new Error('não achei o nome do chip')
  return achado
}
const itens = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menu"] [role="menuitem"]'))
const item = (nome: string) => {
  const achado = itens().find((b) => b.querySelector('span')?.firstChild?.textContent === nome)
  if (!achado) throw new Error(`não achei o item ${nome}`)
  return achado
}
const clicar = (el: HTMLElement) => act(() => el.click())

describe('trechosDoMenu', () => {
  it('agrupa por pasta como a Visão geral: a pasta com tudo o que tem dentro, e as soltas em "Outras cenas" no fim', () => {
    const trechos = trechosDoMenu(AVENTURA)
    expect(trechos.map((t) => t.rotulo)).toEqual(['Porto', 'Cidade Alta', OUTRAS_CENAS])
    expect(trechos[0].cenas.map((c) => c.cena.name)).toEqual(['Porto', 'Porto de Tasmaturi', 'Armazém 3', 'Cofre'])
    // Do 2º nível para dentro, a linha diz a cena de fora; o 1º nível já está dito pela pasta.
    expect(trechos[0].cenas.map((c) => c.dentroDe)).toEqual([null, null, null, 'Armazém 3'])
    expect(trechos[2].cenas.map((c) => c.cena.name)).toEqual(['Estrada'])
    // Nenhuma cena some nem aparece duas vezes.
    expect(trechos.flatMap((t) => t.cenas.map((c) => c.cena.id)).sort()).toEqual(AVENTURA.map((c) => c.id).sort())
  })

  it('aventura sem pastas (e mapa solto) é um trecho só, sem rótulo', () => {
    expect(trechosDoMenu([cena('a', 'A', { active: true }), cena('b', 'B')])).toEqual([
      { chave: 'todas', rotulo: null, cenas: [{ cena: cena('a', 'A', { active: true }), dentroDe: null }, { cena: cena('b', 'B'), dentroDe: null }] },
    ])
    expect(trechosDoMenu([cena('', 'Mapa solto', { active: true, renamable: false })])).toHaveLength(1)
  })

  it('duas pastas com o mesmo nome continuam dois trechos', () => {
    const trechos = trechosDoMenu([cena('a', 'Casa'), cena('a1', 'Sala', { parentId: 'a' }), cena('b', 'Casa'), cena('b1', 'Porão', { parentId: 'b' })])
    expect(trechos.map((t) => t.chave)).toEqual(['pasta:a', 'pasta:b'])
  })
})

describe('ChipDaCena', () => {
  it('mostra o nome inteiro da cena aberta e "cena inicial" só quando é ela', () => {
    montar()
    expect(nomeDoChip().textContent).toBe('Porto de Tasmaturicena inicial')
    act(() => root.render(<ChipDaCena cenas={AVENTURA.map((c) => ({ ...c, active: c.id === 'estrada' }))} onTrocar={vi.fn()} onVerTodas={vi.fn()} />))
    expect(nomeDoChip().textContent).toBe('Estrada')
  })

  it('a seta de voltar só aparece quando há para onde voltar, e volta', () => {
    montar()
    expect(container.querySelector('[aria-label="Voltar à cena anterior"]')).toBeNull()
    const onVoltar = vi.fn()
    montar({ onVoltar })
    const seta = container.querySelector<HTMLButtonElement>('[aria-label="Voltar à cena anterior"]')
    if (!seta) throw new Error('sem a seta de voltar')
    clicar(seta)
    expect(onVoltar).toHaveBeenCalledTimes(1)
  })

  it('o nome abre o menu de cenas por pasta; escolher outra cena troca, a aberta e a que não abriu não fazem nada', () => {
    const { onTrocar } = montar()
    expect(nomeDoChip().getAttribute('aria-expanded')).toBe('false')
    clicar(nomeDoChip())
    expect(nomeDoChip().getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Trocar de cena')
    expect(Array.from(document.querySelectorAll('.gr-menu__rot')).map((r) => r.textContent)).toEqual(['Porto', 'Cidade Alta', OUTRAS_CENAS])
    expect(item('Cofre').textContent).toBe('CofreDentro de Armazém 3')
    expect(item('Torre do sino').disabled).toBe(true)
    clicar(item('Porto de Tasmaturi'))
    expect(onTrocar).not.toHaveBeenCalled()
    clicar(nomeDoChip())
    clicar(item('Armazém 3'))
    expect(onTrocar).toHaveBeenCalledWith('armazem')
    // Escolher fecha o menu e devolve o foco ao nome.
    expect(nomeDoChip().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(nomeDoChip())
  })

  it('"Ver todas as cenas" fica no fim do menu e abre a Visão geral', () => {
    const { onVerTodas } = montar()
    clicar(nomeDoChip())
    const ultimo = itens().at(-1)
    expect(ultimo?.textContent).toBe('Ver todas as cenas')
    if (!ultimo) throw new Error('menu vazio')
    clicar(ultimo)
    expect(onVerTodas).toHaveBeenCalledTimes(1)
  })

  it('nome longo corta só no chip, e o balão mostra o nome inteiro', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('gr-chip-cena__texto') ? 500 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('gr-chip-cena__texto') ? 360 : 0
    })
    montar()
    act(() => {
      nomeDoChip().dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    })
    act(() => vi.advanceTimersByTime(400))
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Porto de Tasmaturi')
  })

  it('nome que cabe: o balão diz o que o botão faz', () => {
    montar()
    act(() => {
      nomeDoChip().dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    })
    act(() => vi.advanceTimersByTime(400))
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Trocar de cena')
  })
})
