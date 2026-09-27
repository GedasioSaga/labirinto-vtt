import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classificarDicas } from '../lib/dicaDoPainel'
import { TerritorioControls, type TerritorioControlsProps } from './TerritorioControls'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * FACÇÃO E ALERTA, lado do mestre: o bloco "Território" (filtro "Quem manda
 * aqui", legenda das facções e o alerta da cena) e o campo "Facção" no painel
 * da Sala.
 *
 * Peça mapa-inteiro-enxuto (laudo do painel, rodada 2): o alerta é o
 * segmentado do projeto (`.lb-seg`, rádios com nome), sem o rádio nativo azul
 * de 13 px; e a frase de estado "Nenhuma sala tem facção" explica o
 * interruptor que ela afeta, como dica sob demanda, em vez de ocupar a coluna.
 */

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

function renderTerritorio(overrides: Partial<TerritorioControlsProps> = {}): TerritorioControlsProps {
  const props: TerritorioControlsProps = {
    filtroLigado: false,
    onFiltroChange: vi.fn(),
    legenda: [
      { faccao: 'Guarda Carmesim', cor: '#c0504d', salas: 2 },
      { faccao: 'Sindicato das Cinzas', cor: '#4f81bd', salas: 1 },
    ],
    alerta: 'calmo',
    onAlertaChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<TerritorioControls {...props} />))
  return props
}

function interruptor(rotulo: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(rotulo))
  const input = label?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`sem o interruptor "${rotulo}"`)
  return input
}

/** O grupo do alerta da cena: um `radiogroup` de verdade, não um fieldset de rádios nativos. */
function grupoDoAlerta(): HTMLElement {
  const grupo = container.querySelector<HTMLElement>('[role="radiogroup"]')
  if (grupo === null) throw new Error('o alerta da cena não é um grupo de rádios (role="radiogroup")')
  return grupo
}

/** Nome acessível do grupo: o texto do rótulo apontado por `aria-labelledby`, ou o `aria-label`. */
function nomeDoGrupo(grupo: HTMLElement): string {
  const ids = (grupo.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter((id) => id !== '')
  if (ids.length === 0) return grupo.getAttribute('aria-label') ?? ''
  return ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ')
}

function opcao(rotulo: string): HTMLButtonElement {
  const botao = [...grupoDoAlerta().querySelectorAll<HTMLButtonElement>('button[role="radio"]')].find((b) => b.textContent?.trim() === rotulo)
  if (botao === undefined) throw new Error(`sem a opção "${rotulo}" no alerta da cena`)
  return botao
}

/** As frases que o controle aponta em `aria-describedby`, na ordem. */
function descricoes(controle: Element): HTMLElement[] {
  return (controle.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id))
    .filter((frase): frase is HTMLElement => frase !== null)
}

describe('TerritorioControls', () => {
  it('ligar "Quem manda aqui" avisa o callback', () => {
    const props = renderTerritorio()
    const filtro = interruptor('Quem manda aqui')
    expect(filtro.checked).toBe(false)
    act(() => filtro.click())
    expect(props.onFiltroChange).toHaveBeenCalledWith(true)
  })

  it('a legenda lista cada facção com a cor e quantas salas ela manda', () => {
    renderTerritorio({ filtroLigado: true })
    const itens = [...container.querySelectorAll('[data-testid="legenda-faccao"]')]
    expect(itens.map((i) => i.textContent)).toEqual(['Guarda Carmesim · 2 salas', 'Sindicato das Cinzas · 1 sala'])
    const amostra = itens[0].querySelector('[data-testid="cor-faccao"]')
    expect(amostra instanceof HTMLElement ? amostra.style.backgroundColor : '').toBe('rgb(192, 80, 77)')
  })

  it('sem facção nenhuma, a frase que diz onde escolher uma explica o "Quem manda aqui" (dica sob demanda, não linha da coluna)', () => {
    renderTerritorio({ legenda: [] })
    expect(container.querySelector('[data-testid="legenda-faccao"]')).toBeNull()
    const semFaccao = descricoes(interruptor('Quem manda aqui')).find((frase) => frase.textContent?.includes('Nenhuma sala tem facção'))
    expect(semFaccao, 'a frase de estado tem de ficar ligada ao interruptor que ela explica').toBeDefined()
    expect(semFaccao?.textContent).toContain('campo Facção do painel da Sala')
    expect(semFaccao?.classList.contains('lb-field__hint')).toBe(true)
    expect(classificarDicas(container).sobDemanda, 'ligada a um controle ativo, a frase vira balão e sai do fluxo').toContain(semFaccao)
  })

  it('com facções, a frase de estado some e o interruptor explica só o que ele faz', () => {
    renderTerritorio()
    expect(container.textContent).not.toContain('Nenhuma sala tem facção')
    expect(descricoes(interruptor('Quem manda aqui')).map((frase) => frase.textContent)).toEqual([
      'Pinta cada sala e distrito com a cor da facção. Só no seu editor.',
    ])
  })

  it('o alerta da cena é o segmentado do projeto: três rádios com nome, a atual marcada, nenhum rádio nativo', () => {
    renderTerritorio({ alerta: 'atento' })
    const grupo = grupoDoAlerta()
    expect(nomeDoGrupo(grupo)).toBe('Alerta da cena')
    expect(grupo.classList.contains('lb-seg')).toBe(true)
    const opcoes = [...grupo.querySelectorAll<HTMLButtonElement>('button[role="radio"]')]
    expect(opcoes.map((b) => b.textContent?.trim())).toEqual(['Calmo', 'Atento', 'Caçada'])
    expect(opcoes.every((b) => b.type === 'button' && b.classList.contains('lb-seg__option'))).toBe(true)
    expect(opcoes.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(container.querySelectorAll('input[type="radio"]'), 'rádio nativo (13 px, azul do navegador) não entra na coluna').toHaveLength(0)
  })

  it('escolher Caçada sobe o alerta', () => {
    const props = renderTerritorio()
    act(() => opcao('Caçada').click())
    expect(props.onAlertaChange).toHaveBeenCalledWith('cacada')
  })

  it('o painel diz que facção e alerta nunca vão para os jogadores; a linha dessa dica é o campo, com o "?" logo depois do rótulo', () => {
    renderTerritorio()
    const grupo = grupoDoAlerta()
    const [dica] = descricoes(grupo)
    expect(dica?.textContent).toMatch(/jogadores não/i)
    const campo = grupo.closest<HTMLElement>('.lb-field')
    expect(campo, 'rótulo e segmentado moram no mesmo campo').not.toBeNull()
    expect(campo?.firstElementChild?.classList.contains('lb-label')).toBe(true)
    expect(classificarDicas(container).linhas.get(campo as HTMLElement)).toEqual([dica])
  })
})

function renderSala(overrides: Partial<RoomControlsProps> = {}): RoomControlsProps {
  const props: RoomControlsProps = {
    name: 'Quartel',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 300,
    height: 300,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    faccao: '',
    onFaccaoChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
  return props
}

function campoFaccao(): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Facção')
  const alvo = label ? document.getElementById(label.htmlFor) : null
  if (!(alvo instanceof HTMLInputElement)) throw new Error('o painel da sala não tem o campo "Facção"')
  return alvo
}

function digitar(alvo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(alvo, valor)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('RoomControls: campo Facção', () => {
  it('mostra a facção gravada e digitar avisa o callback', () => {
    const props = renderSala({ faccao: 'Guarda Carmesim' })
    const campo = campoFaccao()
    expect(campo.value).toBe('Guarda Carmesim')
    digitar(campo, 'Sindicato')
    expect(props.onFaccaoChange).toHaveBeenLastCalledWith('Sindicato')
  })

  it('sala sem facção dentro de distrito mostra de quem herda', () => {
    renderSala({ faccaoHerdada: 'Guarda Carmesim' })
    const campo = campoFaccao()
    expect(campo.value).toBe('')
    const dica = document.getElementById(campo.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('Guarda Carmesim')
  })

  it('sugere as facções que já existem no mapa', () => {
    renderSala({ faccoesConhecidas: ['Guarda Carmesim', 'Sindicato das Cinzas'] })
    const lista = document.getElementById(campoFaccao().getAttribute('list') ?? '')
    expect([...(lista?.querySelectorAll('option') ?? [])].map((o) => o.value)).toEqual(['Guarda Carmesim', 'Sindicato das Cinzas'])
  })

  it('sem o callback, o campo não aparece', () => {
    renderSala({ onFaccaoChange: undefined })
    expect([...container.querySelectorAll('label')].some((l) => l.textContent?.trim() === 'Facção')).toBe(false)
  })
})
