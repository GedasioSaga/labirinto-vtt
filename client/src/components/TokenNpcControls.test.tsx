import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { pecaDoAcervo } from '../lib/tokenLibrary'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import { colocarPecaDoAcervo } from '../stores/criarToken'
import { useMapStore } from '../stores/mapStore'
import type { Token } from '../types/map'
import { RoomPanel, roomPanelTokensOf } from './RoomPanel'
import { TOKEN_NPC_HINT, TokenNpcControls } from './TokenNpcControls'

/*
 * O mestre precisa conseguir marcar NPC pelo app. Antes, o campo `npc` só era
 * lido: a ficha do acervo nascia sem a marca e o painel não tinha controle —
 * o Mordomo recém-colocado virava o primeiro "Atribuir" do card da Gina.
 */

const ROOM = { code: 'LIVR01', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

function jogador(overrides: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: '?', status: 'waiting', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...overrides }
}

const JOGANDO: PlayerInfo[] = ['Lanterna', 'Machado', 'Cajado', 'Arco', 'Adaga', 'Escudo'].map((ficha, i) =>
  jogador({ clientId: `c${i + 1}`, playerId: `p${i + 1}`, name: `J${i + 1}`, status: 'playing', tokenIds: [`tok-${ficha.toLowerCase()}`] }),
)
const GINA = jogador({ clientId: 'c7', playerId: 'p7', name: 'Gina' })

function ficha(id: string, name: string): Token {
  return { id, characterId: null, name, x: 0, y: 0, size: 1, image: null }
}

const FICHAS_COM_DONO = JOGANDO.flatMap((j) => j.tokenIds).map((id) => ficha(id, id.slice(4)))

function mundo(cozinha: Token[]): HostWorld {
  return {
    open: { sceneId: 's1', name: 'Cozinha', map: { ...createEmptyMap('m1', 'Casa', 10, 10, 50), tokens: cozinha } },
    background: [{ sceneId: 's2', name: 'Biblioteca', map: { ...createEmptyMap('m2', 'Bib', 10, 10, 50), tokens: [ficha('tok-livro', 'Livro')] } }],
  }
}

describe('marca de NPC gravada pelo app', () => {
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

  function renderSala(world: HostWorld): void {
    const noop = (): void => {}
    act(() =>
      root.render(
        <RoomPanel
          room={ROOM}
          players={[...JOGANDO, GINA]}
          tokens={roomPanelTokensOf(world)}
          tunnel={IDLE}
          onStart={noop}
          onStop={noop}
          onStartTunnel={noop}
          onStopTunnel={noop}
          onAssign={noop}
          onUnassign={noop}
          onKick={noop}
          onVisionRadiusChange={noop}
          onVisionFactorChange={noop}
          onRevealPlan={noop}
          onHidePlan={noop}
          clues={{ rows: [], onCenter: noop, onToggle: noop }}
        />,
      ),
    )
  }

  /** Botões "Atribuir ..." do card da Gina, pelo nome acessível (sem a bolinha `aria-hidden`). */
  function botoesDaGina(): string[] {
    const cardGina = Array.from(container.querySelectorAll<HTMLElement>('.lb-field')).find((el) => (el.textContent ?? '').includes('Gina —'))
    if (cardGina === undefined) throw new Error('sem card da Gina')
    return Array.from(cardGina.querySelectorAll('button'))
      .map((botao) => {
        const copia = botao.cloneNode(true)
        if (!(copia instanceof HTMLElement)) return ''
        copia.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
        return (copia.textContent ?? '').replace(/\s+/g, ' ').trim()
      })
      .filter((texto) => /Atribuir /.test(texto))
  }

  it('a peça trazida do acervo nasce NPC, com id, tamanho e foto do item', () => {
    expect(pecaDoAcervo({ tamanho: 2 }, 'tk-1', { image: 'C:/m/token_tk-1.webp', imageData: null })).toEqual({
      id: 'tk-1',
      size: 2,
      image: 'C:/m/token_tk-1.webp',
      imageData: null,
      npc: true,
    })
  })

  it('Mordomo trazido do acervo para a Cozinha não vira botão: o card da Gina oferece só "Biblioteca · Atribuir Livro"', () => {
    // Pelo mesmo `colocarPecaDoAcervo` que `handlePlaceFromLibrary` (App.tsx) chama.
    useMapStore.setState({ map: { ...createEmptyMap('m1', 'Casa', 20, 20, 50), tokens: FICHAS_COM_DONO }, selection: [], past: [], future: [] })
    expect(colocarPecaDoAcervo({ nome: 'Mordomo', tamanho: 1 }, 'tok-mordomo', { image: null, imageData: null }, { x: 300, y: 300 }, null)).toBe('tok-mordomo')
    renderSala(mundo(useMapStore.getState().map.tokens))
    expect(botoesDaGina()).toEqual(['Biblioteca · Atribuir Livro'])
  })

  it('o interruptor "Ficha de NPC" começa desligado em ficha sem o campo e anuncia o que muda', () => {
    act(() => root.render(<TokenNpcControls npc={false} onNpcChange={vi.fn()} />))
    const caixa = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(caixa?.checked).toBe(false)
    const dicaId = caixa?.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(dicaId)?.textContent).toBe(TOKEN_NPC_HINT)
    expect(container.querySelector('label')?.textContent).toContain('Ficha de NPC')
  })

  it('ligar "Ficha de NPC" no painel grava a marca no mapa (com desfazer) e tira o Mordomo dos botões; desligar devolve', () => {
    const mordomo = ficha('tok-mordomo', 'Mordomo')
    useMapStore.setState({ map: { ...useMapStore.getState().map, tokens: [...FICHAS_COM_DONO, mordomo] }, selection: [], past: [], future: [] })
    const worldDoStore = (): HostWorld => mundo(useMapStore.getState().map.tokens)
    const tokenNoStore = (): Token | undefined => useMapStore.getState().map.tokens.find((t) => t.id === 'tok-mordomo')

    // Campo ausente: o Mordomo (cena aberta) vem antes do Livro — é o defeito.
    renderSala(worldDoStore())
    expect(botoesDaGina()).toEqual(['Atribuir Mordomo', 'Biblioteca · Atribuir Livro'])

    const onNpcChange = (npc: boolean): void => useMapStore.getState().updateToken('tok-mordomo', { npc })
    act(() => root.render(<TokenNpcControls npc={tokenNoStore()?.npc === true} onNpcChange={onNpcChange} />))
    act(() => container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click())
    expect(tokenNoStore()?.npc).toBe(true)
    expect(useMapStore.getState().past.length).toBe(1)

    renderSala(worldDoStore())
    expect(botoesDaGina()).toEqual(['Biblioteca · Atribuir Livro'])

    act(() => root.render(<TokenNpcControls npc={tokenNoStore()?.npc === true} onNpcChange={onNpcChange} />))
    const caixa = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(caixa?.checked).toBe(true)
    act(() => caixa?.click())
    expect(tokenNoStore()?.npc).toBe(false)

    renderSala(worldDoStore())
    expect(botoesDaGina()).toEqual(['Atribuir Mordomo', 'Biblioteca · Atribuir Livro'])
  })
})
