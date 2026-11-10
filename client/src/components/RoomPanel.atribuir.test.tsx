import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'
import { gruposDeAtribuir } from './AtribuirToken'
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

  /** O campo "Atribuir token" do card: o botão que abre a lista. */
  function campo(nome: string): HTMLButtonElement {
    const botao = card(nome).querySelector<HTMLButtonElement>('.lb-atribuir__campo')
    if (botao === null) throw new Error(`sem o campo "Atribuir token" no card de ${nome}`)
    return botao
  }

  /** Abre a lista do card e devolve as linhas dela (a lista mora no `body`), na ordem da tela. */
  function linhasDaLista(nome: string): HTMLElement[] {
    if (campo(nome).getAttribute('aria-expanded') !== 'true') act(() => campo(nome).click())
    return Array.from(document.body.querySelectorAll<HTMLElement>('.lb-atribuir [role="option"]'))
  }

  function escolhe(nome: string, tokenId: string): void {
    const linha = linhasDaLista(nome).find((el) => el.id.endsWith(`-${tokenId}`))
    if (linha === undefined) throw new Error(`sem a linha de ${tokenId} na lista de ${nome}`)
    act(() => linha.click())
  }

  /** Digita na busca da lista aberta. */
  function busca(texto: string): HTMLInputElement {
    const entrada = document.body.querySelector<HTMLInputElement>('.lb-atribuir input')
    if (entrada === null) throw new Error('sem a busca da lista')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(entrada, texto)
      entrada.dispatchEvent(new Event('input', { bubbles: true }))
    })
    return entrada
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

  it('a lista diz de quem é cada ficha, põe as livres antes das com dono e separa a outra cena num grupo', () => {
    render([...JOGANDO, GINA])
    const rotulos = linhasDaLista('Gina').map((el) => el.getAttribute('aria-label') ?? '')
    expect(rotulos).toContain('Machado, de Bruno')
    // Nesta cena: o Mordomo (NPC, sem jogador) vem antes das fichas que já têm dono.
    expect(rotulos[0]).toBe('Mordomo, NPC, sem jogador')
    // A outra cena é o último grupo, com o nome dela no título.
    expect(rotulos.at(-1)).toBe('Livro, sem jogador, na cena Biblioteca')
    const titulos = Array.from(document.body.querySelectorAll('.lb-atribuir__cena-nome')).map((el) => el.textContent)
    expect(titulos).toEqual(['Nesta cena', 'Biblioteca'])
  })

  it('só há ficha em OUTRA cena: o grupo único continua com o nome da cena no título', () => {
    render([GINA], [{ id: 'tok-livro', name: 'Livro', sceneName: 'Biblioteca' }])
    linhasDaLista('Gina')
    const titulos = Array.from(document.body.querySelectorAll('.lb-atribuir__cena-nome')).map((el) => el.textContent)
    expect(titulos).toEqual(['Biblioteca'])
  })

  it('quatro "Alce" na cena: cada um tem o seu número, e buscar "alce 3" com Enter atribui o terceiro', () => {
    const alces: RoomPanelToken[] = ['a', 'b', 'c', 'd'].map((letra) => ({ id: `tok-alce-${letra}`, name: 'Alce', npc: true }))
    const tokens: RoomPanelToken[] = [...alces.slice(0, 2), { id: 'tok-urso', name: 'Urso', npc: true }, ...alces.slice(2)]
    render([GINA], tokens)
    expect(linhasDaLista('Gina').map((el) => el.getAttribute('aria-label'))).toEqual([
      'Alce 1, NPC, sem jogador',
      'Alce 2, NPC, sem jogador',
      'Alce 3, NPC, sem jogador',
      'Alce 4, NPC, sem jogador',
      'Urso, NPC, sem jogador',
    ])
    const entrada = busca('alce 3')
    act(() => {
      entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onAssign).toHaveBeenCalledWith('p7', 'tok-alce-c')
    expect(document.body.querySelector('.lb-atribuir')).toBeNull()
  })

  it('gruposDeAtribuir: o número é o mesmo no card de qualquer jogador e pula o nome que já existe', () => {
    const tokens: RoomPanelToken[] = [
      { id: 'l1', name: 'Lobo' },
      { id: 'l2', name: 'Lobo 2' },
      { id: 'l3', name: 'lobo' },
      { id: 'f1', name: 'Lobo', sceneName: 'Floresta' },
    ]
    const nomes = (tokenIds: string[]): string[][] => gruposDeAtribuir(tokens, { tokenIds }, new Map()).map((grupo) => grupo.linhas.map((linha) => linha.nome))
    // "Lobo 2" já é nome de outro token: o segundo lobo vira "lobo 3". O da Floresta é o único de lá: sem número.
    expect(nomes([])).toEqual([['Lobo 1', 'Lobo 2', 'lobo 3'], ['Lobo']])
    // Quem já tem o primeiro lobo continua vendo o outro como "lobo 3".
    expect(nomes(['l1'])).toEqual([['Lobo 2', 'lobo 3'], ['Lobo']])
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
    expect(document.activeElement).toBe(campo('Gina'))
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
    // A cor é a do disco no mapa (a de fábrica, aqui): o retrato sem foto da lista de atribuir.
    const cor = roomPanelTokensOf(world)[0]?.cor
    expect(cor).toMatch(/^#[0-9a-f]{6}$/)
    expect(roomPanelTokensOf(world)).toEqual([
      { id: 'a', name: 'Machado', cor },
      { id: 'm', name: 'Mordomo', npc: true, cor },
      { id: 'l', name: 'Livro', sceneName: 'Biblioteca', cor },
    ])
  })
})
