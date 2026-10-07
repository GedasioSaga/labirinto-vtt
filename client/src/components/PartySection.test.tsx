import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { partyDestinations, partyMembers, PARTY_CENTER_LABEL } from '../lib/party'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { MapData, Pin, Token } from '../types/map'
import { FOLLOW_LABEL, MIRROR_LABEL, mirrorLabel, SEND_TO_LABEL, sendDestinationsFor, type PartySectionProps } from './PartySection'
import { abrirFicha, linhaDoJogador } from './grupoTeste'
import { RoomPanel, roomPanelTokensOf } from './RoomPanel'

function ficha(id: string, color: string | undefined, x = 100, y = 100): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, color }
}

const ESCADA: Pin = { id: 'escada', x: 700, y: 200, kind: 'viagem', description: 'Escada que sobe', image: null, destino: null }
const SEM_NOME: Pin = { id: 'alcapao', x: 300, y: 200, kind: 'viagem', description: '  ', image: null, destino: null }
const ESTATUA: Pin = { id: 'estatua', x: 400, y: 200, kind: 'exclamacao', description: 'Estátua', image: null }

function mundo(): HostWorld {
  const salao: MapData = { ...createEmptyMap('m-a', 'Salao', 30, 10, 50), tokens: [ficha('lanterna', '#3cff00', 120, 80), ficha('cajado', undefined)] }
  const cripta: MapData = { ...createEmptyMap('m-b', 'Cripta', 30, 10, 50), tokens: [ficha('machado', '#ff5a00', 725, 225)], pins: [ESCADA, SEM_NOME, ESTATUA] }
  return { open: { sceneId: 's-a', name: 'Salao', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta', map: cripta }] }
}

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: 'X', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...over }
}

const JOGADORES: PlayerInfo[] = [
  jogador({ playerId: 'ana', name: 'Ana', tokenIds: ['lanterna'], sceneId: 's-a', sceneName: 'Salao' }),
  jogador({ playerId: 'bruno', name: 'Bruno', tokenIds: ['machado'], sceneId: 's-b', sceneName: 'Cripta', connected: false, clientId: null }),
  jogador({ playerId: 'carla', name: 'Carla', status: 'waiting', tokenIds: [] }),
]

describe('lib/party', () => {
  it('uma linha por jogador, com a cor e a posição da ficha NA CENA em que ele está', () => {
    const linhas = partyMembers(JOGADORES, mundo())
    expect(linhas.map((m) => [m.name, m.sceneName, m.token?.color ?? null, m.token?.x ?? null])).toEqual([
      ['Ana', 'Salao', '#3cff00', 120],
      ['Bruno', 'Cripta', '#ff5a00', 725],
      ['Carla', null, null, null],
    ])
  })

  it('ficha sem cor própria usa a cor de fábrica do disco, a mesma do mapa', () => {
    const [linha] = partyMembers([jogador({ tokenIds: ['cajado'], sceneId: 's-a', sceneName: 'Salao' })], mundo())
    expect(linha?.token?.color).toBe('#5a8fd6')
  })

  it('destinos: as cenas da aventura, com os pinos de VIAGEM como chegada (resumo quando não há descrição)', () => {
    const destinos = partyDestinations(mundo())
    expect(destinos.map((d) => [d.sceneId, d.arrivals.map((a) => a.pinId)])).toEqual([
      ['s-a', []],
      ['s-b', ['escada', 'alcapao']],
    ])
    expect(destinos[1]?.arrivals[0]?.label).toBe('Escada que sobe')
    expect(destinos[1]?.arrivals[1]?.label.trim()).not.toBe('')
  })

  it('mapa solto não tem para onde mandar', () => {
    const solto = createEmptyMap('m', 'Solto', 10, 10, 50)
    expect(partyDestinations({ open: { sceneId: null, name: 'Solto', map: solto }, background: [] })).toEqual([])
  })

  it('o jogador não é mandado para a cena em que já está', () => {
    const [ana] = partyMembers(JOGADORES, mundo())
    if (ana === undefined) throw new Error('Ana deveria ter linha')
    expect(sendDestinationsFor(ana, partyDestinations(mundo())).map((d) => d.sceneId)).toEqual(['s-b'])
  })
})

/*
 * O Grupo é a lista única da aba Jogo (RoomPanel): uma linha por jogador em
 * jogo, agrupada por cena, e quem espera personagem num cartão aberto em
 * "Chegando", acima delas. Dora joga, mas a ficha dela não está em cena nenhuma.
 */
describe('Grupo na aba Jogo', () => {
  const NA_MESA: PlayerInfo[] = [...JOGADORES, jogador({ playerId: 'dora', name: 'Dora', tokenIds: ['sumida'], sceneId: 's-a', sceneName: 'Salao' })]
  const IDLE: TunnelState = { kind: 'idle' }
  const noop = vi.fn()
  const handlers = {
    onStart: noop,
    onStop: noop,
    onStartTunnel: noop,
    onStopTunnel: noop,
    onAssign: noop,
    onUnassign: noop,
    onKick: noop,
    onVisionRadiusChange: noop,
    onVisionFactorChange: noop,
    onRevealPlan: noop,
    onHidePlan: noop,
    clues: { rows: [], onCenter: noop, onToggle: noop },
  }

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

  function grupo(extra: Partial<PartySectionProps> = {}): void {
    const world = mundo()
    const party: PartySectionProps = { members: partyMembers(NA_MESA, world), destinations: partyDestinations(world), onGoTo: vi.fn(), onSend: vi.fn(() => true), ...extra }
    act(() =>
      root.render(<RoomPanel room={{ code: 'GRUPO1', urls: [], qrSvg: '<svg/>' }} players={NA_MESA} tokens={roomPanelTokensOf(world)} party={party} tunnel={IDLE} {...handlers} />),
    )
  }

  /** Nome acessível: `aria-label`, ou o texto sem o que é `aria-hidden`. */
  function nomes(escopo: Element): string[] {
    return Array.from(escopo.querySelectorAll('button')).map((b) => {
      const rotulo = b.getAttribute('aria-label')
      if (rotulo !== null) return rotulo
      const copia = b.cloneNode(true)
      if (!(copia instanceof Element)) return ''
      copia.querySelectorAll('[aria-hidden="true"]').forEach((e) => e.remove())
      return (copia.textContent ?? '').replace(/\s+/g, ' ').trim()
    })
  }

  /** O título da cena em que a linha está. */
  function cenaDe(nome: string): string | null | undefined {
    return linhaDoJogador(container, nome).closest('section.lb-grupo__cena')?.querySelector('.lb-grupo__cena-nome')?.textContent
  }

  it('é uma região com nome "Grupo": uma linha por jogador em jogo, e quem espera num cartão antes das cenas', () => {
    grupo()
    const html = container.innerHTML
    expect(html).toMatch(/<section class="lb-party lb-grupo" aria-labelledby="([^"]+)"><div class="lb-party__head"><h3 id="\1" class="lb-eyebrow">Grupo<\/h3>/)
    expect(container.querySelectorAll('li.lb-party__item')).toHaveLength(3)
    // Carla espera: cartão aberto em "Chegando", fora das listas, antes delas.
    expect(html.indexOf('>Carla</strong>')).toBeGreaterThan(html.indexOf('>Grupo</h3>'))
    expect(html.indexOf('>Carla</strong>')).toBeLessThan(html.indexOf('<ul class="lb-party__list lb-grupo__lista">'))
  })

  it('bolinha na cor da ficha, cada um no grupo da cena dele, "fora" só para quem caiu e o status inteiro para o leitor de tela', () => {
    grupo()
    const html = container.innerHTML
    expect(html).toContain('style="background: rgb(60, 255, 0);"')
    expect(html).toContain('style="background: rgb(255, 90, 0);"')
    expect(html).toMatch(/>Ana<\/strong><span class="lb-sr-only"> — jogando · conectado<\/span>/)
    expect(html).toMatch(/>Bruno<\/strong><span class="lb-sr-only"> — jogando · desconectado<\/span>/)
    expect(cenaDe('Ana')).toBe('Salao')
    expect(cenaDe('Bruno')).toBe('Cripta')
    expect(linhaDoJogador(container, 'Bruno').textContent).toMatch(/\bfora\b/)
    expect(linhaDoJogador(container, 'Ana').textContent).not.toMatch(/\bfora\b/)
  })

  it('"Ir lá" e "Mandar para…" só para quem tem ficha no mapa', () => {
    grupo()
    for (const nome of ['Ana', 'Bruno']) {
      const botoes = nomes(abrirFicha(container, nome))
      expect(botoes).toContain('Ir lá')
      expect(botoes).toContain(SEND_TO_LABEL)
    }
    // Dora: a linha diz que ela está sem ficha no mapa, e a ficha não tem para onde ir nem o que mandar.
    expect(linhaDoJogador(container, 'Dora').textContent).toContain('sem ficha no mapa')
    const dora = abrirFicha(container, 'Dora', 'mochila')
    expect(nomes(dora)).not.toContain('Ir lá')
    expect(nomes(dora)).not.toContain(SEND_TO_LABEL)
    expect(dora.textContent).toContain('sem ficha no mapa')
    // O formulário só abre no clique: nenhuma escolha de chegada à vista.
    expect(container.textContent).not.toContain(PARTY_CENTER_LABEL)
  })

  it('"Seguir" com nome fixo e o estado em aria-pressed, só em quem tem ficha', () => {
    grupo({ followingId: 'ana', onToggleFollow: vi.fn() })
    const seguir = (nome: string) => Array.from(abrirFicha(container, nome).querySelectorAll('button[aria-pressed]')).map((b) => [b.getAttribute('aria-pressed'), b.textContent])
    expect(seguir('Ana')).toEqual([['true', FOLLOW_LABEL]])
    expect(seguir('Bruno')).toEqual([['false', FOLLOW_LABEL]])
    expect(seguir('Dora')).toEqual([])
    // A linha fechada de quem a câmera segue diz isso.
    expect(linhaDoJogador(container, 'Ana').querySelector('.lb-grupo__linha')?.textContent).toContain('seguindo')
    // Sem o callback (quem monta o painel sem câmera), não há botão.
    grupo()
    expect(nomes(abrirFicha(container, 'Ana'))).not.toContain(FOLLOW_LABEL)
  })

  it('"Ver tela" na ficha de quem está conectado e tem ficha, com o nome do jogador no nome acessível', () => {
    grupo({ mirroringId: 'ana', onToggleMirror: vi.fn() })
    expect(mirrorLabel('Ana')).toBe('Ver tela de Ana')
    const tela = (nome: string) => Array.from(abrirFicha(container, nome).querySelectorAll('button[aria-haspopup="dialog"]'))
    const daAna = tela('Ana')
    expect(daAna.map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-expanded')])).toEqual([['Ver tela de Ana', 'true']])
    // O rótulo curto à vista começa a palavra do nome acessível (quem comanda por voz diz "tela").
    expect(MIRROR_LABEL.toLowerCase()).toContain(daAna[0]?.textContent?.trim().toLowerCase() ?? '?')
    // Bruno está fora (sem tela para ver) e a ficha de Dora não está em cena: sem o botão.
    expect(tela('Bruno')).toHaveLength(0)
    expect(tela('Dora')).toHaveLength(0)
    // Sem o callback, não há botão.
    grupo()
    expect(tela('Ana')).toHaveLength(0)
  })
})
