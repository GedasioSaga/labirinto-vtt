import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { RoomPanel } from './RoomPanel'

/**
 * REMOVER QUEM SAIU E PASSAR FICHAS E MAPA, o card do jogador: quem foi
 * embora ganha "Passar fichas e mapa a", que pergunta antes de agir e só então
 * chama o mestre com os dois ids. Cancelar (ou Esc) não muda nada.
 */

const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }
const TOKENS = [
  { id: 'f-escudo', name: 'Escudo' },
  { id: 'f-lirio', name: 'Lírio' },
]

const FABIO_FORA: PlayerInfo = { clientId: null, playerId: 'p-fabio', name: 'Fábio', status: 'playing', connected: false, tokenIds: ['f-escudo'], visionRadius: 700 }
const ANA: PlayerInfo = { clientId: 'c1', playerId: 'p-ana', name: 'Ana', status: 'playing', connected: true, tokenIds: ['f-lirio'], visionRadius: 700 }

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

function render(players: PlayerInfo[], onHandOver: ((playerId: string, heirId: string) => void) | undefined) {
  const noop = vi.fn()
  act(() => {
    root.render(
      <RoomPanel
        room={ROOM}
        players={players}
        tokens={TOKENS}
        tunnel={IDLE}
        onStart={noop}
        onStop={noop}
        onStartTunnel={noop}
        onStopTunnel={noop}
        onAssign={noop}
        onUnassign={noop}
        onKick={noop}
        onVisionRadiusChange={noop}
        onRevealPlan={noop}
        onHidePlan={noop}
        onDismiss={noop}
        onHandOver={onHandOver}
      />,
    )
  })
}

function botao(label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent === label)
}

function listaPassar(): HTMLSelectElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent === 'Passar fichas e mapa a')
  const id = label?.htmlFor
  if (id === undefined || id === '') return null
  const el = document.getElementById(id)
  return el instanceof HTMLSelectElement ? el : null
}

function escolher(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('RoomPanel: passar fichas e mapa de quem saiu', () => {
  it('escolher a Ana pergunta antes; "Passar e remover" chama o mestre com Fábio e Ana', () => {
    const onHandOver = vi.fn()
    render([ANA, FABIO_FORA], onHandOver)
    const select = listaPassar()
    if (select === null) throw new Error('esperava a lista "Passar fichas e mapa a"')
    // Só os outros jogadores: o próprio Fábio não é opção.
    expect([...select.options].map((o) => o.textContent)).toEqual(['Escolher…', 'Ana'])
    escolher(select, 'p-ana')
    // Ainda não agiu: primeiro a pergunta, com o foco no botão seguro.
    expect(onHandOver).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Tirar Fábio da mesa e passar as fichas e o mapa dele a Ana?')
    expect(document.activeElement).toBe(botao('Cancelar'))
    const confirmar = botao('Passar e remover')
    if (confirmar === undefined) throw new Error('esperava "Passar e remover"')
    act(() => confirmar.click())
    expect(onHandOver).toHaveBeenCalledWith('p-fabio', 'p-ana')
    expect(onHandOver).toHaveBeenCalledTimes(1)
  })

  it('Cancelar e Esc desfazem a escolha sem chamar o mestre', () => {
    const onHandOver = vi.fn()
    render([ANA, FABIO_FORA], onHandOver)
    const select = listaPassar()
    if (select === null) throw new Error('esperava a lista "Passar fichas e mapa a"')
    escolher(select, 'p-ana')
    const cancelar = botao('Cancelar')
    if (cancelar === undefined) throw new Error('esperava "Cancelar"')
    act(() => cancelar.click())
    expect(botao('Passar e remover')).toBeUndefined()
    const denovo = listaPassar()
    if (denovo === null) throw new Error('a lista deveria voltar')
    expect(denovo.value).toBe('')
    escolher(denovo, 'p-ana')
    const pergunta = botao('Cancelar')
    if (pergunta === undefined) throw new Error('esperava "Cancelar"')
    act(() => {
      pergunta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(botao('Passar e remover')).toBeUndefined()
    expect(onHandOver).not.toHaveBeenCalled()
  })

  it('sem outro jogador na mesa, ou sem o mestre ter como passar: sem a lista', () => {
    render([FABIO_FORA], vi.fn())
    expect(listaPassar()).toBeNull()
    render([ANA, FABIO_FORA], undefined)
    expect(listaPassar()).toBeNull()
    // Conectado não tem a lista: ele mesmo está jogando.
    render([ANA], vi.fn())
    expect(listaPassar()).toBeNull()
    expect(botao('Dispensar')).toBeUndefined()
  })
})
