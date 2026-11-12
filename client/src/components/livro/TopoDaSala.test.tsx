import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerInfo } from '../../net/hostSession'
import { useToastStore } from '../../stores/toastStore'
import { FIREWALL_HINT } from '../RoomPanel'
import { TopoDaSala, avisoDeFecharASala, type TopoDaSalaProps } from './TopoDaSala'

/*
 * O TOPO DA SALA do livro da mesa (fatia 4): fechada, Abrir mesa online, Visão de
 * jogador e Rede; aberta, o código que copia, o "Mais da mesa online" (Visão, Pausar
 * NPCs, Fechar mesa online com confirmação), Laser, Som e Convidar.
 */

const ROOM = { code: 'K7Q2XM', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }

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
  vi.restoreAllMocks()
})

function jogador(nome: string, connected: boolean): PlayerInfo {
  return { clientId: connected ? `c-${nome}` : null, playerId: `p-${nome}`, name: nome, status: 'playing', connected, tokenIds: [], visionRadius: 700, visionFactor: 1 }
}

function montar(props: Partial<TopoDaSalaProps> = {}) {
  const chamadas = { onStart: vi.fn(), onStop: vi.fn(), onStartTunnel: vi.fn(), onStopTunnel: vi.fn() }
  act(() => root.render(<TopoDaSala room={ROOM} players={[]} tunnel={{ kind: 'idle' }} {...chamadas} {...props} />))
  return chamadas
}

const botao = (nome: string, onde: ParentNode = container): HTMLButtonElement => {
  const achado = [...onde.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === nome || b.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`sem o botão ${nome}`)
  return achado
}
const item = (nome: string): HTMLButtonElement => {
  const achado = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent === nome)
  if (achado === undefined) throw new Error(`sem o item ${nome}`)
  return achado
}

describe('TopoDaSala', () => {
  it('fechada: título, "Fechada", Abrir mesa online e o pop Rede com a dica do firewall', () => {
    const { onStart } = montar({ room: null })
    expect(container.querySelector('h2')?.textContent).toBe('Mesa online')
    expect(container.textContent).toContain('Fechada')
    act(() => botao('Abrir mesa online').click())
    expect(onStart).toHaveBeenCalledWith(false)
    act(() => botao('Rede').click())
    const pop = document.querySelector('[role="dialog"][aria-label="Rede local"]')
    expect(pop?.textContent).toContain(FIREWALL_HINT)
    // Sem campo dentro, o foco vai à própria caixa: o Esc fecha.
    expect(document.activeElement).toBe(pop)
  })

  it('aberta: Fechar mesa online mora no "Mais da mesa online" e pergunta antes; "Continuar jogando" desiste e Fechar mesa online fecha', () => {
    const { onStop } = montar({ players: [jogador('Ana', true), jogador('Bia', false), jogador('Caio', true)] })
    expect(botao('Mais da mesa online').getAttribute('aria-haspopup')).toBe('menu')
    act(() => botao('Mais da mesa online').click())
    act(() => item('Fechar mesa online…').click())
    const dialogo = document.querySelector('[role="alertdialog"]')
    expect(dialogo?.textContent).toContain('Fechar a mesa online?')
    expect(dialogo?.textContent).toContain(avisoDeFecharASala(2))
    expect(document.activeElement?.textContent).toBe('Continuar jogando')
    act(() => botao('Continuar jogando', document).click())
    expect(onStop).not.toHaveBeenCalled()
    act(() => botao('Mais da mesa online').click())
    act(() => item('Fechar mesa online…').click())
    act(() => botao('Fechar mesa online', document.querySelector('[role="alertdialog"]') ?? document).click())
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('o aviso diz quem sai da mesa', () => {
    expect(avisoDeFecharASala(0)).toBe('Ninguém está conectado agora. O mapa e as fichas ficam como estão.')
    expect(avisoDeFecharASala(1)).toBe('O jogador conectado sai da mesa. O mapa e as fichas ficam como estão.')
    expect(avisoDeFecharASala(4)).toBe('Os 4 jogadores conectados saem da mesa. O mapa e as fichas ficam como estão.')
  })

  it('o "Mais da mesa online" pausa os NPCs só quando há alguém andando sozinho', () => {
    const onAlternar = vi.fn()
    montar({ npcs: { pausados: false, onAlternar } })
    act(() => botao('Mais da mesa online').click())
    act(() => item('Pausar todos os NPCs').click())
    expect(onAlternar).toHaveBeenCalledOnce()
    montar({ npcs: undefined })
    act(() => botao('Mais da mesa online').click())
    expect([...document.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent)).toEqual(['Fechar mesa online…'])
  })

  it('a placa copia o código e avisa; sem área de transferência, o aviso diz o código', async () => {
    const escrever = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: escrever } })
    const avisar = vi.spyOn(useToastStore.getState(), 'push')
    montar()
    const placa = container.querySelector<HTMLButtonElement>('button[aria-label="Código da mesa online K7Q2XM. Clique para copiar"]')
    expect(placa?.textContent).toBe('K7Q2XM')
    // Acabou de abrir: o reflexo corre uma vez.
    expect(placa?.classList.contains('gr-brilha')).toBe(true)
    await act(async () => placa?.click())
    expect(escrever).toHaveBeenCalledWith('K7Q2XM')
    expect(avisar).toHaveBeenCalledWith('info', 'Código K7Q2XM copiado.')
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    await act(async () => placa?.click())
    expect(avisar).toHaveBeenLastCalledWith('error', 'Não deu para copiar. O código da mesa online é K7Q2XM.')
    vi.unstubAllGlobals()
  })
})
