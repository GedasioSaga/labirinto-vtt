import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classificarDicas, instalarDicasDoPainel } from '../lib/dicaDoPainel'
import { WALL_WIDTH_WORLD_MAX } from '../pixi/drawWalls'
import { WallStyleControls, type WallStyleControlsProps } from './WallStyleControls'

/**
 * PAINEL ENXUTO, fatia 1 (pedido de 30/09/2026: "as propriedades das
 * ferramentas as vezes ficam cheias demais", imagem 1). Com a Parede na mão,
 * uma frase de três linhas morava fixa sob o slider, e "Espessura" e
 * "Grossura" eram dois nomes para a mesma propriedade, um em cima do outro.
 *
 * Agora a frase é a dica sob demanda do campo "Espessura" (o "?" logo depois
 * do rótulo, `lib/dicaDoPainel.ts`), e o slider se chama "Ajuste fino", como o
 * de Região. Nada some: a frase continua no DOM, ligada ao grupo por
 * `aria-describedby`, e abre ao pairar ou ao chegar pelo teclado.
 */

const FRASE = `No ajuste fino a parede vai até ${WALL_WIDTH_WORLD_MAX} px, uma célula inteira de muralha. Acompanha o zoom do mapa.`

let corpo: HTMLDivElement
let root: Root
let desinstalar: (() => void) | null = null

function retangulo(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // O corpo do painel: é nele que lib/dicaDoPainel.ts procura frases e linhas.
  corpo = document.createElement('div')
  corpo.className = 'lb-inspector__body'
  document.body.appendChild(corpo)
  root = createRoot(corpo)
})

afterEach(() => {
  desinstalar?.()
  desinstalar = null
  act(() => root.unmount())
  corpo.remove()
  vi.restoreAllMocks()
})

function renderParede(overrides: Partial<WallStyleControlsProps> = {}): WallStyleControlsProps {
  const props: WallStyleControlsProps = {
    wallKind: 'exterior',
    onWallKindChange: vi.fn(),
    thickness: 'medium',
    onThicknessChange: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<WallStyleControls {...props} />))
  return props
}

function grupoEspessura(): HTMLElement {
  const grupo = corpo.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Espessura da parede"]')
  if (grupo === null) throw new Error('sem o grupo "Espessura da parede"')
  return grupo
}

function campoDe(controle: HTMLElement): HTMLElement {
  const campo = controle.closest<HTMLElement>('.lb-field')
  if (campo === null) throw new Error('o controle não mora num .lb-field')
  return campo
}

function degrau(rotulo: string): HTMLButtonElement {
  const botao = [...grupoEspessura().querySelectorAll<HTMLButtonElement>('button[role="radio"]')].find((b) => b.textContent?.trim() === rotulo)
  if (botao === undefined) throw new Error(`sem o degrau "${rotulo}"`)
  return botao
}

function slider(): HTMLInputElement {
  const input = corpo.querySelector('input[type="range"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('a seção Parede não tem slider')
  return input
}

function rotuloDe(input: HTMLInputElement): string {
  return corpo.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() ?? ''
}

/** As frases que o controle aponta em `aria-describedby`, na ordem. */
function descricoes(controle: Element): HTMLElement[] {
  return (controle.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id))
    .filter((frase): frase is HTMLElement => frase !== null)
}

/** Arrasto do slider como o React o recebe: valor novo pelo setter nativo e o evento `input`. */
function arrastarSliderPara(input: HTMLInputElement, valor: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, String(valor))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function teclar(alvo: Element, tecla: string) {
  alvo.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true }))
}

describe('WallStyleControls: a frase da grossura vira dica de "Espessura"', () => {
  it('o grupo "Espessura da parede" aponta, por aria-describedby, a frase curta do limite de 64 px', () => {
    renderParede()
    const frases = descricoes(grupoEspessura())
    expect(frases, 'o grupo tem de apontar exatamente uma frase').toHaveLength(1)
    const [frase] = frases
    expect(frase.tagName).toBe('P')
    expect(frase.classList.contains('lb-field__hint')).toBe(true)
    expect(frase.textContent).toBe(FRASE)
  })

  it('ligada a um grupo ativo, a frase sai do fluxo e é a dica da linha "Espessura", com o rótulo em primeiro (é ele que ganha o "?")', () => {
    renderParede()
    const grupo = grupoEspessura()
    const [frase] = descricoes(grupo)
    const campo = campoDe(grupo)
    expect(campo.contains(frase), 'a frase mora no campo que ela explica').toBe(true)
    expect(campo.firstElementChild?.classList.contains('lb-label')).toBe(true)
    expect(campo.firstElementChild?.textContent).toBe('Espessura')
    const { sobDemanda, linhas } = classificarDicas(corpo)
    expect(sobDemanda).toContain(frase)
    expect(linhas.get(campo)).toEqual([frase])
  })

  it('nenhuma frase sobra fixa na coluna: o campo do slider só tem rótulo, número e trilho', () => {
    renderParede()
    const { sobDemanda } = classificarDicas(corpo)
    const fixas = [...corpo.querySelectorAll<HTMLElement>('.lb-field__hint')].filter((frase) => !sobDemanda.includes(frase))
    expect(fixas.map((frase) => frase.textContent)).toEqual([])
    expect(campoDe(slider()).querySelector('.lb-field__hint')).toBeNull()
  })

  it('o slider se chama "Ajuste fino" (rótulo visível, o mesmo nome do de Região) e "Grossura" não aparece mais', () => {
    renderParede()
    expect(rotuloDe(slider())).toBe('Ajuste fino')
    expect(slider().hasAttribute('aria-label'), 'o nome acessível vem do rótulo visível').toBe(false)
    expect(corpo.textContent).not.toContain('Grossura')
  })

  it('com o handler, o grupo não se diz desligado', () => {
    renderParede()
    expect(grupoEspessura().hasAttribute('aria-disabled')).toBe(false)
  })

  it('sem onThicknessChange, o grupo diz que está desligado e a frase fica à vista, no fluxo', () => {
    renderParede({ onThicknessChange: undefined })
    const grupo = grupoEspessura()
    expect(grupo.getAttribute('aria-disabled')).toBe('true')
    const [frase] = descricoes(grupo)
    expect(frase?.textContent).toBe(FRASE)
    expect(classificarDicas(corpo).sobDemanda).not.toContain(frase)
    expect(slider().disabled).toBe(true)
  })
})

describe('WallStyleControls: os controles da espessura continuam fazendo o mesmo', () => {
  it('o degrau "Grossa" pede a parede grossa', () => {
    const props = renderParede()
    act(() => degrau('Grossa').click())
    expect(props.onThicknessChange).toHaveBeenCalledWith('thick')
  })

  it('o ajuste fino escreve px de mundo, mostra o valor e nenhum degrau fica marcado num valor contínuo', () => {
    const props = renderParede({ thickness: 40 })
    expect(slider().value).toBe('40')
    expect(campoDe(slider()).querySelector('.lb-num')?.textContent).toBe('40 px')
    expect([...grupoEspessura().querySelectorAll('[aria-checked="true"]')]).toHaveLength(0)
    arrastarSliderPara(slider(), WALL_WIDTH_WORLD_MAX)
    expect(props.onThicknessChange).toHaveBeenLastCalledWith(WALL_WIDTH_WORLD_MAX)
  })
})

describe('WallStyleControls no painel de verdade (dicas instaladas)', () => {
  beforeEach(() => {
    // O jsdom não desenha: a coluna do editor em 1280x800 vem de stub, como em dicaDoPainel.test.ts.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return this === corpo ? retangulo(17, 139, 262, 595) : retangulo(33, 200, 230, 30)
    })
    Object.defineProperty(corpo, 'clientWidth', { configurable: true, value: 262 })
    Object.defineProperty(corpo, 'clientHeight', { configurable: true, value: 595 })
  })

  it('a linha "Espessura" ganha a marca do "?" e a frase vira balão fechado, com o mesmo id e texto', () => {
    renderParede()
    desinstalar = instalarDicasDoPainel(document)
    const grupo = grupoEspessura()
    const [frase] = descricoes(grupo)
    const campo = campoDe(grupo)
    expect(campo.hasAttribute('data-dica-linha')).toBe(true)
    expect(campo.getAttribute('data-dica-ids')).toBe(frase.id)
    expect(frase.getAttribute('data-dica')).toBe('fechada')
    expect(frase.getAttribute('role')).toBe('tooltip')
    expect(frase.textContent).toBe(FRASE)
  })

  it('Tab até um degrau abre a frase na hora; andar entre os degraus não fecha; Esc fecha só o balão', () => {
    renderParede()
    desinstalar = instalarDicasDoPainel(document)
    const [frase] = descricoes(grupoEspessura())
    teclar(document.body, 'Tab')
    act(() => degrau('Fina').focus())
    expect(frase.getAttribute('data-dica')).toBe('aberta')
    teclar(degrau('Fina'), 'Tab')
    act(() => degrau('Média').focus())
    expect(frase.getAttribute('data-dica'), 'o foco andou dentro da mesma linha').toBe('aberta')
    teclar(degrau('Média'), 'Escape')
    expect(frase.getAttribute('data-dica')).toBe('fechada')
    expect(document.activeElement, 'o foco fica no degrau').toBe(degrau('Média'))
  })
})
