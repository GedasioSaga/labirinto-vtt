import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawingTool } from '../types/tools'
import { Toolbar } from './Toolbar'
import type { ToolVariantBindings } from './ToolVariantMenu'
import { ESPERA_DO_BALAO_MS } from './grimorio/comum'

/**
 * BALÃO COM ATALHO na barra de ferramentas (fatia 6 do design consolidado; o
 * catálogo de convenções, "Dica de ferramenta": pairar espera, e o vizinho
 * aparece na hora). Desde a fatia 6 o balão é o do grimório (`Balao`): o nome,
 * a letra como tecla e o grupo da barra. O primeiro espera
 * `ESPERA_DO_BALAO_MS`; logo depois de um fechar, o vizinho abre sem esperar.
 */

let container: HTMLDivElement
let root: Root
/** Cada teste num instante bem longe do anterior: a janela "quente" do balão é global. */
let relogio = 0

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function bindings(): ToolVariantBindings {
  const vazio = vi.fn()
  return {
    doorKind: { value: 'normal', onChange: vazio },
    wallKind: { value: undefined, onChange: vazio },
    wallFeitio: { value: 'pedra', onChange: vazio },
    estiloDoMapa: { value: 'atual' },
    regionFillPattern: { value: 'solid', onChange: vazio },
    polygonSides: { value: 6, onChange: vazio },
    stairSizePreset: { value: 'medium', onChange: vazio },
    drawTexture: { value: 'pen', onChange: vazio },
    brushMode: { value: 'traco', onChange: vazio },
    eraseMode: { value: 'objeto', onChange: vazio },
    floorShapeKind: { value: 'rect', onChange: vazio },
    floorOp: { value: 'add', onChange: vazio },
    floorPolygonSides: { value: 6, onChange: vazio },
    floorBrushSize: { value: 1, onChange: vazio },
    floorCamada: { value: 'chao', onChange: vazio },
    mobiliaTipo: { value: 'mesa', onChange: vazio },
    roomFreeKind: { value: 'sala', onChange: vazio },
    roomFreeRounded: { value: false, onChange: vazio },
    drawShape: { value: 'brush', onChange: vazio },
  }
}

function montar(activeTool: DrawingTool = 'select') {
  act(() => root.render(<Toolbar activeTool={activeTool} onSelectTool={vi.fn()} lastDrawingTool="brush" variantBindings={bindings()} />))
  // Só os relógios de espera e a hora: o resto (quadros de animação da placa e da dica) segue real.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  relogio += 1
  vi.setSystemTime(new Date(2030, 0, relogio))
}

function icone(nome: string): HTMLButtonElement {
  const botao = container.querySelector<HTMLButtonElement>(`.lb-toolbar button.lb-ferr[aria-label="${nome}"]`)
  if (!botao) throw new Error(`a barra deveria ter o ícone "${nome}"`)
  return botao
}

/** O ponteiro passa de `de` para `para`, como o navegador conta: sai de um, entra no outro. */
function mover(de: Element | null, para: Element | null, pointerType = 'mouse') {
  act(() => {
    if (de) de.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType, relatedTarget: para }))
    if (para) para.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType, relatedTarget: de }))
  })
}

const esperar = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const balao = () => document.body.querySelector<HTMLElement>('[role="tooltip"].gr-balao')
const parte = (seletor: string) => balao()?.querySelector(seletor)?.textContent

describe('Toolbar — balão com atalho', () => {
  it('o primeiro balão espera, e mostra o nome, a letra como tecla e o grupo da barra', () => {
    montar()
    mover(null, icone('Parede'))
    esperar(ESPERA_DO_BALAO_MS - 1)
    expect(balao()).toBeNull()
    esperar(1)
    expect(parte('span')).toBe('Parede')
    expect(parte('kbd')).toBe('W')
    expect(parte('small')).toBe('Construir')
    // O nome acessível continua sendo só o rótulo; o balão entra como descrição.
    expect(icone('Parede').getAttribute('aria-describedby')).toBe(balao()?.id)
  })

  it('logo depois de um balão fechar, o do vizinho abre na hora e sem animação', () => {
    montar()
    mover(null, icone('Parede'))
    esperar(ESPERA_DO_BALAO_MS)
    mover(icone('Parede'), icone('Porta'))
    expect(parte('span')).toBe('Porta')
    expect(balao()?.classList.contains('gr-instantaneo')).toBe(true)
  })

  it('o botão que agrupa diz a ferramenta que o clique arma, com a letra dela', () => {
    montar('roomCircle')
    mover(null, icone('Sala'))
    esperar(ESPERA_DO_BALAO_MS)
    expect(parte('span')).toBe('Sala: Circular')
    expect(parte('kbd')).toBe('J')
  })

  it('ferramenta sem letra não promete tecla', () => {
    montar()
    mover(null, icone('Caminho'))
    esperar(ESPERA_DO_BALAO_MS)
    expect(parte('span')).toBe('Caminho')
    expect(balao()?.querySelector('kbd')).toBeNull()
  })

  it('toque não abre balão: no dedo não existe pairar', () => {
    montar()
    mover(null, icone('Parede'), 'touch')
    esperar(ESPERA_DO_BALAO_MS * 3)
    expect(balao()).toBeNull()
  })

  it('o cantinho de variantes não tem balão próprio', () => {
    montar()
    const cantinho = container.querySelector('button[aria-label="Opções de Parede"]')
    mover(null, cantinho)
    esperar(ESPERA_DO_BALAO_MS * 3)
    expect(balao()).toBeNull()
  })

  it('desmontar a barra limpa os relógios pendentes', () => {
    montar()
    mover(null, icone('Parede'))
    act(() => root.render(<></>))
    expect(vi.getTimerCount()).toBe(0)
  })
})
