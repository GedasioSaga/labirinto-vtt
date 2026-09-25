import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'
import { RoomPanel, roomPanelTokensOf, type RoomPanelToken } from './RoomPanel'

/*
 * A mesa de 7 da simulação: seis fichas da Cozinha já têm dono, o Mordomo é
 * NPC e o Livro está sozinho na Biblioteca (cena de fundo). Gina chegou por
 * último e espera personagem.
 */
const JOGADORES = [
  { nome: 'Ana', ficha: 'Lanterna' },
  { nome: 'Bruno', ficha: 'Machado' },
  { nome: 'Carla', ficha: 'Cajado' },
  { nome: 'Duda', ficha: 'Arco' },
  { nome: 'Enzo', ficha: 'Adaga' },
  { nome: 'Fabio', ficha: 'Escudo' },
] as const

const idDe = (ficha: string): string => `tok-${ficha.toLowerCase()}`

const TOKENS: RoomPanelToken[] = [
  ...JOGADORES.map((j) => ({ id: idDe(j.ficha), name: j.ficha })),
  { id: 'tok-mordomo', name: 'Mordomo', npc: true },
  { id: 'tok-livro', name: 'Livro', sceneName: 'Biblioteca' },
]

function jogador(overrides: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: '?', status: 'waiting', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...overrides }
}

const JOGANDO: PlayerInfo[] = JOGADORES.map((j, i) =>
  jogador({ clientId: `c${i + 1}`, playerId: `p${i + 1}`, name: j.nome, status: 'playing', tokenIds: [idDe(j.ficha)] }),
)
const GINA = jogador({ clientId: 'c7', playerId: 'p7', name: 'Gina' })

const ROOM = { code: 'LIVR01', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

describe('RoomPanel: atribuir ficha — livres primeiro, de qualquer cena, sem tirar a de quem joga', () => {
  let container: HTMLDivElement
  let root: Root
  let onAssign: ReturnType<typeof vi.fn<(playerId: string, tokenId: string) => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onAssign = vi.fn<(playerId: string, tokenId: string) => void>()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(players: PlayerInfo[], tokens: RoomPanelToken[] = TOKENS): void {
    const noop = (): void => {}
    act(() =>
      root.render(
        <RoomPanel
          room={ROOM}
          players={players}
          tokens={tokens}
          tunnel={IDLE}
          onStart={noop}
          onStop={noop}
          onStartTunnel={noop}
          onStopTunnel={noop}
          onAssign={onAssign}
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

  /** O card do jogador: o `.lb-field` cujo rótulo começa por "<nome> —" (o mesmo da régua e2e). */
  function card(nome: string): HTMLElement {
    const achado = Array.from(container.querySelectorAll<HTMLElement>('.lb-field')).find((el) => (el.textContent ?? '').includes(`${nome} —`))
    if (achado === undefined) throw new Error(`sem card de ${nome}`)
    return achado
  }

  /** Nome acessível de um botão: o texto sem o que é `aria-hidden` (a bolinha). */
  function nomeAcessivel(botao: HTMLElement): string {
    const copia = botao.cloneNode(true)
    if (!(copia instanceof HTMLElement)) return ''
    copia.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
    return (copia.textContent ?? '').replace(/\s+/g, ' ').trim()
  }

  function botoesDeUmClique(nome: string): string[] {
    return Array.from(card(nome).querySelectorAll('button'))
      .map(nomeAcessivel)
      .filter((texto) => /Atribuir /.test(texto))
  }

  function lista(nome: string): HTMLSelectElement {
    const select = card(nome).querySelector('select')
    if (select === null) throw new Error(`sem lista "Atribuir token" no card de ${nome}`)
    return select
  }

  function escolhe(nome: string, tokenId: string): void {
    const select = lista(nome)
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    act(() => {
      setter?.call(select, tokenId)
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function botaoNoCard(nome: string, texto: string): HTMLButtonElement | undefined {
    return Array.from(card(nome).querySelectorAll('button')).find((b) => nomeAcessivel(b) === texto)
  }

  it('card da Gina: o único botão de um clique é "Biblioteca · Atribuir Livro" — nada com dono, nada de NPC', () => {
    render([...JOGANDO, GINA])
    expect(botoesDeUmClique('Gina')).toEqual(['Biblioteca · Atribuir Livro'])
  })

  it('um clique no botão atribui o Livro da outra cena à Gina', () => {
    render([...JOGANDO, GINA])
    const botao = botaoNoCard('Gina', 'Biblioteca · Atribuir Livro')
    expect(botao).toBeDefined()
    act(() => botao?.click())
    expect(onAssign).toHaveBeenCalledWith('p7', 'tok-livro')
  })

  it('livres da cena aberta vêm antes das de outra cena; só fichas livres e não-NPC viram botão', () => {
    const tokens: RoomPanelToken[] = [
      { id: 'tok-livro', name: 'Livro', sceneName: 'Biblioteca' },
      { id: 'tok-machado', name: 'Machado' },
      { id: 'tok-mordomo', name: 'Mordomo', npc: true },
      { id: 'tok-arco', name: 'Arco' },
    ]
    const bruno = jogador({ clientId: 'c2', playerId: 'p2', name: 'Bruno', status: 'playing', tokenIds: ['tok-machado'] })
    render([bruno, GINA], tokens)
    expect(botoesDeUmClique('Gina')).toEqual(['Atribuir Arco', 'Biblioteca · Atribuir Livro'])
  })

  it('a lista marca a ficha de outro jogador com o dono ("Machado — de Bruno") e põe as livres primeiro', () => {
    render([...JOGANDO, GINA])
    const textos = Array.from(lista('Gina').options).map((o) => o.textContent ?? '')
    expect(textos).toContain('● Machado — de Bruno')
    const livro = textos.findIndex((t) => t.includes('Livro'))
    const machado = textos.indexOf('● Machado — de Bruno')
    expect(livro).toBeGreaterThan(0)
    expect(livro).toBeLessThan(machado)
    expect(textos.find((t) => t.includes('Livro'))).toBe('● Biblioteca · Livro')
  })

  it('escolher a ficha de outro jogador pede confirmação com foco em Cancelar; Cancelar mantém a ficha com o dono', () => {
    render([...JOGANDO, GINA])
    escolhe('Gina', 'tok-machado')
    expect(onAssign).not.toHaveBeenCalled()
    const confirmacao = card('Gina').querySelector('[role="alertdialog"]')
    expect(confirmacao).not.toBeNull()
    expect(confirmacao?.textContent).toContain('Machado é de Bruno')
    const cancelar = botaoNoCard('Gina', 'Cancelar')
    expect(cancelar).toBeDefined()
    expect(document.activeElement).toBe(cancelar)
    act(() => cancelar?.click())
    expect(onAssign).not.toHaveBeenCalled()
    expect(card('Gina').querySelector('[role="alertdialog"]')).toBeNull()
    expect(document.activeElement).toBe(lista('Gina'))
  })

  it('Esc na confirmação também cancela', () => {
    render([...JOGANDO, GINA])
    escolhe('Gina', 'tok-machado')
    const cancelar = botaoNoCard('Gina', 'Cancelar')
    act(() => {
      cancelar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(card('Gina').querySelector('[role="alertdialog"]')).toBeNull()
    expect(onAssign).not.toHaveBeenCalled()
  })

  it('confirmar dá a ficha de outro jogador à Gina', () => {
    render([...JOGANDO, GINA])
    escolhe('Gina', 'tok-machado')
    const dar = botaoNoCard('Gina', 'Dar a Gina')
    expect(dar).toBeDefined()
    act(() => dar?.click())
    expect(onAssign).toHaveBeenCalledWith('p7', 'tok-machado')
    expect(card('Gina').querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('escolher ficha livre na lista atribui na hora, sem confirmação', () => {
    render([...JOGANDO, GINA])
    escolhe('Gina', 'tok-mordomo')
    expect(onAssign).toHaveBeenCalledWith('p7', 'tok-mordomo')
    expect(card('Gina').querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('sem ficha livre, o card de quem espera diz que a lista tem as dos outros', () => {
    const soComDono: RoomPanelToken[] = JOGADORES.map((j) => ({ id: idDe(j.ficha), name: j.ficha }))
    render([...JOGANDO, GINA], soComDono)
    expect(botoesDeUmClique('Gina')).toEqual([])
    expect(card('Gina').textContent).toContain('Nenhuma ficha livre')
  })
})

describe('roomPanelTokensOf: fichas de todas as cenas para o painel', () => {
  function ficha(id: string, name: string, extra: Partial<Token> = {}): Token {
    return { id, characterId: null, name, x: 0, y: 0, size: 1, image: null, ...extra }
  }

  it('cena aberta sem nome de cena; cenas de fundo com o nome; marca de NPC atravessa', () => {
    const cozinha = { ...createEmptyMap('m1', 'Casa', 10, 10, 50), tokens: [ficha('a', 'Machado'), ficha('m', 'Mordomo', { npc: true })] }
    const biblioteca = { ...createEmptyMap('m2', 'Bib', 10, 10, 50), tokens: [ficha('l', 'Livro')] }
    const world: HostWorld = {
      open: { sceneId: 's1', name: 'Cozinha', map: cozinha },
      background: [{ sceneId: 's2', name: 'Biblioteca', map: biblioteca }],
    }
    expect(roomPanelTokensOf(world)).toEqual([
      { id: 'a', name: 'Machado' },
      { id: 'm', name: 'Mordomo', npc: true },
      { id: 'l', name: 'Livro', sceneName: 'Biblioteca' },
    ])
  })
})
