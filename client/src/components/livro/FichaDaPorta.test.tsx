import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState } from '../../types/map'
import { WallDoorControls } from '../WallDoorControls'
import { FichaDaPorta } from './FichaDaPorta'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderDoor(door: DoorState | null) {
  const handlers = { onToggleDoor: vi.fn(), onToggleOpen: vi.fn(), onToggleLocked: vi.fn(), onToggleSemEspiar: vi.fn(), onToggleSecret: vi.fn(), onRevealPassage: vi.fn(), onOpensFromChange: vi.fn() }
  act(() => root.render(door === null ? <WallDoorControls door={null} {...handlers} /> : <FichaDaPorta door={door} {...handlers} onKindChange={vi.fn()} />))
  return handlers
}

function checkboxLabeled(text: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(text))
  return label?.querySelector('input[type="checkbox"]') ?? null
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent === text)
}

describe('FichaDaPorta: porta secreta', () => {
  it("'Secreta' mostra o estado e liga pelo clique", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal' })
    const secreta = checkboxLabeled('Secreta')
    expect(secreta).not.toBeNull()
    expect(secreta?.checked).toBe(false)
    act(() => secreta?.click())
    expect(handlers.onToggleSecret).toHaveBeenCalledTimes(1)
    // Porta comum não tem o que revelar.
    expect(buttonByText('Revelar passagem')).toBeUndefined()
  })

  it("porta secreta: 'Revelar passagem' aparece e dispara num clique", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal', secret: true })
    expect(checkboxLabeled('Secreta')?.checked).toBe(true)
    const revelar = buttonByText('Revelar passagem')
    expect(revelar).toBeDefined()
    act(() => revelar?.click())
    expect(handlers.onRevealPassage).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleSecret).not.toHaveBeenCalled()
    // O botão pequeno do protótipo (28 px, 11,5 px de fonte), como os da ficha.
    expect(revelar?.classList.contains('gr-bt--p')).toBe(true)
  })

  it('a ajuda da Secreta mora na linha dela, colada ao rótulo, fora do nome do interruptor', () => {
    renderDoor({ open: false, locked: false, kind: 'normal' })
    const secreta = checkboxLabeled('Secreta')
    const ajudaId = secreta?.getAttribute('aria-describedby') ?? ''
    const ajuda = ajudaId === '' ? null : document.getElementById(ajudaId)
    expect(ajuda?.textContent).toBe('Os jogadores veem parede até você revelar.')
    const linha = secreta?.closest('.lb-switch-com-ajuda')
    expect(linha).not.toBeNull()
    expect(linha?.contains(ajuda ?? null)).toBe(true)
    // Fora do <label>: o nome acessível do interruptor continua só "Secreta".
    expect(secreta?.closest('label')?.contains(ajuda ?? null)).toBe(false)
  })

  it('parede sem porta não mostra os controles de segredo', () => {
    renderDoor(null)
    expect(checkboxLabeled('Secreta')).toBeNull()
    expect(buttonByText('Revelar passagem')).toBeUndefined()
  })
})

function radioByText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === text)
}

describe('FichaDaPorta: porta de um lado', () => {
  it("'Abre por' mostra 'Os dois lados' marcado na porta comum e troca para 'Só deste lado'", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal' })
    const grupo = [...container.querySelectorAll('[role="radiogroup"]')].find((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent === 'Abre por')
    expect(grupo).not.toBeNull()
    expect(radioByText('Os dois lados')?.getAttribute('aria-checked')).toBe('true')
    expect(radioByText('Só deste lado')?.getAttribute('aria-checked')).toBe('false')
    // Sem lado escolhido, não há o que trocar.
    expect(buttonByText('Trocar o lado')).toBeUndefined()
    act(() => radioByText('Só deste lado')?.click())
    expect(handlers.onOpensFromChange).toHaveBeenCalledWith('right')
  })

  it("com um lado só: 'Só deste lado' marcado, 'Trocar o lado' inverte, 'Os dois lados' desliga", () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal', opensFrom: 'right' })
    expect(radioByText('Só deste lado')?.getAttribute('aria-checked')).toBe('true')
    expect(container.textContent).toContain('A seta no mapa mostra o lado que abre')
    act(() => buttonByText('Trocar o lado')?.click())
    expect(handlers.onOpensFromChange).toHaveBeenLastCalledWith('left')
    act(() => radioByText('Os dois lados')?.click())
    expect(handlers.onOpensFromChange).toHaveBeenLastCalledWith(null)
  })

  it('parede sem porta não mostra o controle', () => {
    renderDoor(null)
    expect(container.querySelector('[aria-label="Abre por"]')).toBeNull()
  })
})

/**
 * "Jogador pode espiar": o mestre escolhe, porta por porta, se a ficha
 * encostada espia pela fechadura. O rótulo nomeia o estado LIGADO (pode
 * espiar), então marcado = `semEspiar` ausente.
 */
describe('FichaDaPorta: jogador pode espiar', () => {
  it('porta comum: marcado, e o clique pede para desligar sem mexer no cadeado', () => {
    const handlers = renderDoor({ open: false, locked: false, kind: 'normal' })
    const espiar = checkboxLabeled('Jogador pode espiar')
    expect(espiar).not.toBeNull()
    expect(espiar?.checked).toBe(true)
    act(() => espiar?.click())
    expect(handlers.onToggleSemEspiar).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleLocked).not.toHaveBeenCalled()
  })

  it('porta marcada sem espiar: desmarcado', () => {
    renderDoor({ open: false, locked: false, kind: 'normal', semEspiar: true })
    expect(checkboxLabeled('Jogador pode espiar')?.checked).toBe(false)
  })

  it('porta trancada também oferece a escolha (espiar pela fechadura é o caso)', () => {
    renderDoor({ open: false, locked: true, kind: 'normal' })
    expect(checkboxLabeled('Jogador pode espiar')?.checked).toBe(true)
  })

  it('porta secreta: sem a escolha (para o jogador é parede)', () => {
    renderDoor({ open: false, locked: false, kind: 'normal', secret: true })
    expect(checkboxLabeled('Jogador pode espiar')).toBeNull()
  })

  it('parede sem porta: sem a escolha', () => {
    renderDoor(null)
    expect(checkboxLabeled('Jogador pode espiar')).toBeNull()
  })
})

describe('FichaDaPorta: estado, fichas e resumos (fatia 11)', () => {
  const FECHADA: DoorState = { open: false, locked: false, kind: 'normal' }
  const ligacoes = () => ({ onToggleOpen: vi.fn(), onToggleLocked: vi.fn(), onToggleSemEspiar: vi.fn(), onToggleSecret: vi.fn(), onRevealPassage: vi.fn(), onOpensFromChange: vi.fn(), onKindChange: vi.fn() })
  function radio(grupo: string, rotulo: string): HTMLButtonElement | undefined {
    const doGrupo = [...container.querySelectorAll('[role="radiogroup"]')].find((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent === grupo)
    return [...(doGrupo?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find((b) => b.textContent === rotulo)
  }
  function cabecalho(titulo: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll<HTMLButtonElement>('.gr-ficha__cab')].find((b) => b.querySelector('.gr-ficha__tit')?.textContent === titulo)
  }

  beforeEach(() => window.localStorage.clear())

  it('Estado: Aberta e Fechada no seg; o handler (que alterna) só é chamado quando a escolha muda', () => {
    const ligado = ligacoes()
    act(() => root.render(<FichaDaPorta door={FECHADA} {...ligado} />))
    expect(radio('Estado', 'Fechada')?.getAttribute('aria-checked')).toBe('true')
    act(() => radio('Estado', 'Fechada')?.click())
    expect(ligado.onToggleOpen).not.toHaveBeenCalled()
    act(() => radio('Estado', 'Aberta')?.click())
    expect(ligado.onToggleOpen).toHaveBeenCalledTimes(1)
  })

  it('as fichas nascem fechadas e dizem o que há dentro; Parede em volta e Depende do estado só quando chegam', () => {
    act(() => root.render(<FichaDaPorta door={{ ...FECHADA, locked: true, abreCom: 'Chave de ferro' }} {...ligacoes()} />))
    expect(['Quem abre', 'Aparência'].map((titulo) => cabecalho(titulo)?.getAttribute('aria-expanded'))).toEqual(['false', 'false'])
    expect(cabecalho('Quem abre')?.textContent).toContain('Chave de ferro')
    expect(cabecalho('Aparência')?.textContent).toContain('Normal, sem animação')
    expect(cabecalho('Parede em volta')).toBeUndefined()
    expect(cabecalho('Depende do estado')).toBeUndefined()

    act(() => root.render(<FichaDaPorta door={FECHADA} {...ligacoes()} paredeEmVolta={<p>espessura</p>} estadoDaPorta={<p>regra</p>} />))
    expect(cabecalho('Parede em volta')?.getAttribute('aria-expanded')).toBe('false')
    expect(cabecalho('Depende do estado')?.textContent).toContain('Sempre')
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === 'Ir para Aventura')).toBe(true)
  })

  it('Quem abre sem mentir: trancada sem item é "Só o mestre"; destrancada diz por que lado', () => {
    act(() => root.render(<FichaDaPorta door={{ ...FECHADA, locked: true }} {...ligacoes()} />))
    expect(cabecalho('Quem abre')?.textContent).toContain('Só o mestre')
    act(() => root.render(<FichaDaPorta door={{ ...FECHADA, opensFrom: 'left' }} {...ligacoes()} />))
    expect(cabecalho('Quem abre')?.textContent).toContain('Só deste lado')
  })

  it('Tipo de porta, na Aparência, troca o tipo da porta selecionada (e não repete o que já está)', () => {
    const ligado = ligacoes()
    act(() => root.render(<FichaDaPorta door={FECHADA} {...ligado} />))
    act(() => radio('Tipo de porta', 'Portão')?.click())
    expect(ligado.onKindChange).toHaveBeenCalledWith('gate')
    act(() => radio('Tipo de porta', 'Normal')?.click())
    expect(ligado.onKindChange).toHaveBeenCalledTimes(1)
  })

  it('a escolha de abrir uma ficha vale para a próxima porta (lembrada no aparelho)', () => {
    act(() => root.render(<FichaDaPorta door={FECHADA} {...ligacoes()} />))
    act(() => cabecalho('Aparência')?.click())
    act(() => root.unmount())
    root = createRoot(container)
    act(() => root.render(<FichaDaPorta door={{ ...FECHADA, kind: 'double' }} {...ligacoes()} />))
    expect(cabecalho('Aparência')?.getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem('lb-section:ficha-porta-aparencia')).toBe('1')
  })
})
