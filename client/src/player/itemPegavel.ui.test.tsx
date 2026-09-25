import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls } from '../components/PinControls'
import { RoomPanel, roomPanelTokensOf } from '../components/RoomPanel'
import { createEmptyMap, buildPin } from '../lib/mapFactory'
import { partyMembers } from '../lib/party'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { Pin } from '../types/map'
import { PlayerBackpack } from './PlayerBackpack'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * ITEM PEGÁVEL nas telas: o cartão do pino oferece "Pegar"; o painel do
 * jogador mostra o que está "Comigo" e deixa dar a um colega encostado; o
 * Grupo do mestre mostra a mochila de cada um; o painel do pino liga o item.
 */

const CHAVE: Pin = { ...buildPin('chave', { x: 100, y: 100 }, 'exclamacao'), description: 'Uma chave pesada.', item: { nome: 'Chave do Escudo' } }

describe('telas do item pegável', () => {
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

  const botao = (texto: string): HTMLButtonElement => {
    const achado = [...container.querySelectorAll('button')].find((b) => b.textContent === texto || b.getAttribute('aria-label') === texto)
    if (achado === undefined) throw new Error(`sem botão "${texto}" em: ${container.textContent ?? ''}`)
    return achado
  }

  it('cartão: o pino pegável diz o nome do item e "Pegar" manda o pedido', () => {
    const onTake = vi.fn()
    act(() => root.render(<PlayerPinCard pin={CHAVE} stairs={[]} onClose={vi.fn()} onTakeItem={onTake} />))
    expect(container.textContent).toContain('Chave do Escudo')
    act(() => botao('Pegar').click())
    expect(onTake).toHaveBeenCalledTimes(1)
  })

  it('cartão: pino que só se lê não tem "Pegar"', () => {
    const { item: _item, ...soLeitura } = CHAVE
    act(() => root.render(<PlayerPinCard pin={soLeitura} stairs={[]} onClose={vi.fn()} onTakeItem={vi.fn()} />))
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Pegar')
  })

  it('Comigo: lista o que o jogador carrega; vazio diz que não há nada', () => {
    act(() => root.render(<PlayerBackpack items={[]} colleagues={[]} onGive={vi.fn()} />))
    expect(container.textContent).toContain('Comigo')
    expect(container.textContent).toContain('Nada com você.')
    act(() => root.render(<PlayerBackpack items={[{ id: 'chave', nome: 'Chave do Escudo' }]} colleagues={[]} onGive={vi.fn()} />))
    expect(container.textContent).toContain('Chave do Escudo')
  })

  it('Dar a…: abre os colegas encostados e passa o item para quem foi escolhido', () => {
    const onGive = vi.fn()
    act(() =>
      root.render(
        <PlayerBackpack
          items={[{ id: 'chave', nome: 'Chave do Escudo' }]}
          colleagues={[
            { tokenId: 'carla', name: 'Carla' },
            { tokenId: 'bruno', name: 'Bruno' },
          ]}
          onGive={onGive}
        />,
      ),
    )
    act(() => botao('Dar Chave do Escudo a…').click())
    act(() => botao('Carla').click())
    expect(onGive).toHaveBeenCalledWith('chave', 'carla')
  })

  it('Dar a… sem ninguém encostado explica em vez de abrir lista vazia', () => {
    act(() => root.render(<PlayerBackpack items={[{ id: 'chave', nome: 'Chave do Escudo' }]} colleagues={[]} onGive={vi.fn()} />))
    act(() => botao('Dar Chave do Escudo a…').click())
    expect(container.textContent).toContain('Ninguém encostado em você.')
  })

  it('painel do pino: liga "Item pegável" com nome e "Pega sem pedir"', () => {
    const onItemChange = vi.fn()
    const base = {
      kind: 'exclamacao' as const,
      onKindChange: vi.fn(),
      description: '',
      onDescriptionChange: vi.fn(),
      locked: false,
      onLockedChange: vi.fn(),
      marco: false,
      onMarcoChange: vi.fn(),
      lerDePerto: null,
      onLerDePertoChange: vi.fn(),
      image: null,
      onChooseImage: vi.fn(),
      onClearImage: vi.fn(),
      onDelete: vi.fn(),
    }
    // O interruptor é o `Toggle` da casa: checkbox nativo dentro do rótulo.
    const interruptor = (texto: string): HTMLInputElement => {
      const rotulo = [...container.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === texto)
      const input = rotulo?.querySelector('input')
      if (!(input instanceof HTMLInputElement)) throw new Error(`sem interruptor "${texto}"`)
      return input
    }
    act(() => root.render(<PinControls {...base} item={{ value: null, onChange: onItemChange }} />))
    expect(interruptor('Item pegável').checked).toBe(false)
    act(() => interruptor('Item pegável').click())
    expect(onItemChange).toHaveBeenLastCalledWith({ nome: 'Item' })
    act(() => root.render(<PinControls {...base} item={{ value: { nome: 'Chave do Escudo' }, onChange: onItemChange }} />))
    const campo = container.querySelector('input[aria-label="Nome do item"]')
    expect(campo instanceof HTMLInputElement ? campo.value : null).toBe('Chave do Escudo')
    act(() => interruptor('Pega sem pedir ao mestre').click())
    expect(onItemChange).toHaveBeenLastCalledWith({ nome: 'Chave do Escudo', livre: true })
    act(() => interruptor('Item pegável').click())
    expect(onItemChange).toHaveBeenLastCalledWith(null)
  })
})

describe('Grupo do mestre: a mochila de cada um', () => {
  it('"Mochila: 1" com o nome do item; quem não carrega nada não ganha linha de mochila', () => {
    const mansao = {
      ...createEmptyMap('m', 'Mansão', 30, 10, 50),
      tokens: [
        { id: 'diego', characterId: null, name: 'Diego', x: 100, y: 100, size: 1, image: null, mochila: [{ id: 'chave', nome: 'Chave do Escudo' }] },
        { id: 'bruno', characterId: null, name: 'Bruno', x: 150, y: 100, size: 1, image: null },
      ],
    }
    const world: HostWorld = { open: { sceneId: 's-m', name: 'Mansão', map: mansao }, background: [] }
    const jogador = (playerId: string, tokenId: string): PlayerInfo => ({
      clientId: playerId,
      playerId,
      name: playerId === 'p-diego' ? 'Diego' : 'Bruno',
      status: 'playing',
      connected: true,
      tokenIds: [tokenId],
      visionRadius: 700,
      visionFactor: 1,
      sceneId: 's-m',
      sceneName: 'Mansão',
    })
    const players = [jogador('p-diego', 'diego'), jogador('p-bruno', 'bruno')]
    const members = partyMembers(players, world)
    expect(members.map((m) => m.mochila.map((i) => i.nome))).toEqual([['Chave do Escudo'], []])
    // O Grupo é a lista única da aba Jogo (RoomPanel): a mochila sai na linha do jogador.
    const handlers = {
      onStart: vi.fn(),
      onStop: vi.fn(),
      onStartTunnel: vi.fn(),
      onStopTunnel: vi.fn(),
      onAssign: vi.fn(),
      onUnassign: vi.fn(),
      onKick: vi.fn(),
      onVisionRadiusChange: vi.fn(),
      onVisionFactorChange: vi.fn(),
      onRevealPlan: vi.fn(),
      onHidePlan: vi.fn(),
      clues: { rows: [], onCenter: vi.fn(), onToggle: vi.fn() },
    }
    const party = { members, destinations: [], onGoTo: vi.fn(), onSend: () => true }
    const html = renderToStaticMarkup(
      <RoomPanel room={{ code: 'MOCHI2', urls: [], qrSvg: '<svg/>' }} players={players} tokens={roomPanelTokensOf(world)} party={party} tunnel={{ kind: 'idle' }} {...handlers} />,
    )
    expect(html).toContain('Mochila: 1')
    expect(html).toContain('Chave do Escudo')
    expect(html.match(/Mochila:/g)).toHaveLength(1)
  })
})
