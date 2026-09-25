import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { partyDestinations, partyMembers, PARTY_CENTER_LABEL } from '../lib/party'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { MapData, Pin, Token } from '../types/map'
import { FOLLOW_LABEL, MIRROR_LABEL, mirrorLabel, SEND_TO_LABEL, sendDestinationsFor, type PartySectionProps } from './PartySection'
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
  return { clientId: 'c', playerId: 'p', name: 'X', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, ...over }
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
 * jogo, e quem espera personagem num cartão aberto acima dela. Dora joga, mas
 * a ficha dela não está em cena nenhuma.
 */
describe('Grupo na aba Jogo', () => {
  const NA_MESA: PlayerInfo[] = [...JOGADORES, jogador({ playerId: 'dora', name: 'Dora', tokenIds: ['sumida'], sceneId: 's-a', sceneName: 'Salao' })]
  const IDLE: TunnelState = { kind: 'idle' }
  const noop = vi.fn()
  const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onRevealPlan: noop, onHidePlan: noop }

  function grupo(extra: Partial<PartySectionProps> = {}): string {
    const world = mundo()
    const party: PartySectionProps = { members: partyMembers(NA_MESA, world), destinations: partyDestinations(world), onGoTo: vi.fn(), onSend: vi.fn(() => true), ...extra }
    return renderToStaticMarkup(
      <RoomPanel room={{ code: 'GRUPO1', urls: [], qrSvg: '<svg/>' }} players={NA_MESA} tokens={roomPanelTokensOf(world)} party={party} tunnel={IDLE} {...handlers} />,
    )
  }
  const html = grupo()

  it('é uma região com nome "Grupo": uma linha por jogador em jogo, e quem espera num cartão antes da lista', () => {
    expect(html).toMatch(/<section class="lb-party" aria-labelledby="([^"]+)"><div class="lb-party__head"><h3 id="\1" class="lb-eyebrow">Grupo<\/h3>/)
    expect(html.split('<li class="lb-party__item').length - 1).toBe(3)
    // Carla espera: cartão aberto, fora da lista, antes dela.
    expect(html.indexOf('>Carla</strong>')).toBeGreaterThan(html.indexOf('>Grupo</h3>'))
    expect(html.indexOf('>Carla</strong>')).toBeLessThan(html.indexOf('<ul class="lb-party__list">'))
  })

  it('bolinha na cor da ficha, a cena à vista, "fora" só para quem caiu e o status inteiro para o leitor de tela', () => {
    expect(html).toContain('style="background:#3cff00"')
    expect(html).toContain('style="background:#ff5a00"')
    expect(html).toMatch(/>Ana<\/strong><span class="lb-sr-only"> — jogando · conectado<\/span>/)
    expect(html).toMatch(/<span class="lb-sr-only">online <\/span>Salao<\/span>/)
    expect(html).toMatch(/>Bruno<\/strong><span class="lb-sr-only"> — jogando · desconectado<\/span>/)
    expect(html).toMatch(/<span class="lb-player__away" aria-hidden="true">fora · <\/span>Cripta<\/span>/)
  })

  it('"Ir lá" e "Mandar para…" só para quem tem ficha no mapa', () => {
    expect(html.split('>Ir lá<').length - 1).toBe(2)
    expect(html.split(`>${SEND_TO_LABEL}<`).length - 1).toBe(2)
    expect(html).toContain('sem ficha no mapa')
    // O formulário só abre no clique: nenhuma escolha de chegada à vista.
    expect(html).not.toContain(PARTY_CENTER_LABEL)
  })

  it('"Seguir" com nome fixo e o estado em aria-pressed, só em quem tem ficha', () => {
    const seguindo = grupo({ followingId: 'ana', onToggleFollow: vi.fn() })
    const botoes = [...seguindo.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[1], m[2]])
    expect(botoes).toEqual([
      ['true', FOLLOW_LABEL],
      ['false', FOLLOW_LABEL],
    ])
    // Sem o callback (quem monta o painel sem câmera), não há botão.
    expect(html).not.toContain(`>${FOLLOW_LABEL}<`)
  })

  it('"Ver tela" na linha de quem está conectado e tem ficha, com o nome do jogador no nome acessível', () => {
    const espelhando = grupo({ mirroringId: 'ana', onToggleMirror: vi.fn() })
    expect(mirrorLabel('Ana')).toBe('Ver tela de Ana')
    const botoes = [...espelhando.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*aria-expanded="(true|false)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[1], m[2], m[3]])
    // Bruno está fora (sem tela para ver), Carla não tem ficha e a de Dora não está em cena: só a linha de Ana.
    expect(botoes).toEqual([['Ver tela de Ana', 'true', MIRROR_LABEL]])
    expect(espelhando).toContain('aria-haspopup="dialog"')
    // Sem o callback, não há botão.
    expect(html).not.toContain(`>${MIRROR_LABEL}<`)
  })
})
