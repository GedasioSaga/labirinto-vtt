/**
 * G6 — o chamado de cena de fundo. O defeito que a régua
 * `e2e/task-jornada-chamado-de-fundo.spec.ts` revelou: o sinal de quem está
 * numa cena de FUNDO era desenhado como ping na cena ABERTA, nas coordenadas
 * da outra cena. A primeira metade prova a sessão (o sinal diz de onde veio);
 * a segunda, quem recebe (ping só da cena aberta; de fundo, um aviso).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import { createSignalRouter } from './chamadoDeFundo'
import { createHostSession, type HostSignal, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

describe('handleSignal: o sinal diz a cena de fundo de onde veio', () => {
  const salao = mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100)])
  const cripta = mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 700, 200)])
  const mundo: HostWorld = { open: { sceneId: 's-a', name: 'Salao Norte', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: cripta }] }

  function mesa() {
    let n = 0
    let agora = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => (agora += 10_000), randomId: () => `id-${(n += 1)}` })
    const entrar = (clientId: string, nome: string, tokenId: string): void => {
      const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, mundo).outbound[0]?.msg
      if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
      s.assignToken(welcome.playerId, tokenId)
    }
    entrar('c1', 'Ana', 'lanterna')
    entrar('c2', 'Bruno', 'machado')
    return s
  }

  it('da cena de fundo: leva o sceneId e o nome da cena', () => {
    const r = mesa().handleMessage('c2', { type: 'signal', x: 700, y: 270 }, mundo)
    expect(r.signal).toMatchObject({ name: 'Bruno', x: 700, y: 270, background: { sceneId: 's-b', name: 'Cripta Rubra' } })
  })

  it('da cena aberta: sem o campo, como sempre', () => {
    const r = mesa().handleMessage('c1', { type: 'signal', x: 100, y: 170 }, mundo)
    expect(r.signal).toBeDefined()
    expect(r.signal).not.toHaveProperty('background')
  })
})

describe('createSignalRouter: ping só da cena aberta, aviso da de fundo', () => {
  const doSalao: HostSignal = { playerId: 'p-ana', name: 'Ana', color: '#3cff00', x: 100, y: 170 }
  const daCripta = (x: number, y: number): HostSignal => ({
    playerId: 'p-bruno',
    name: 'Bruno',
    color: '#ff5a00',
    x,
    y,
    background: { sceneId: 's-b', name: 'Cripta Rubra' },
  })

  function roteador() {
    const deps = { drawPing: vi.fn(), beep: vi.fn(), goTo: vi.fn() }
    return { deps, rotear: createSignalRouter(deps) }
  }

  beforeEach(() => {
    for (const t of useToastStore.getState().toasts) useToastStore.getState().dismiss(t.id)
  })

  it('sinal de fundo: NÃO desenha ping e cria o aviso "chamou em" com "Ir lá", sem prazo', () => {
    const { deps, rotear } = roteador()
    rotear(daCripta(700, 270))
    expect(deps.drawPing).not.toHaveBeenCalled()
    const avisos = useToastStore.getState().toasts
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({ kind: 'info', text: 'Bruno chamou em Cripta Rubra' })
    expect(avisos[0]?.actions?.map((a) => a.label)).toEqual(['Ir lá'])
    expect(deps.beep).toHaveBeenCalledTimes(1)
  })

  it('sinal da cena aberta: desenha o ping e não cria aviso', () => {
    const { deps, rotear } = roteador()
    rotear(doSalao)
    expect(deps.drawPing).toHaveBeenCalledWith(doSalao)
    expect(useToastStore.getState().toasts).toHaveLength(0)
    expect(deps.beep).toHaveBeenCalledTimes(1)
  })

  it('dois sinais do mesmo jogador: UM aviso, com o ponto do último', () => {
    const { deps, rotear } = roteador()
    rotear(daCripta(700, 270))
    rotear(daCripta(750, 300))
    const avisos = useToastStore.getState().toasts.filter((t) => t.text.startsWith('Bruno chamou'))
    expect(avisos).toHaveLength(1)
    avisos[0]?.actions?.[0]?.run()
    expect(deps.goTo).toHaveBeenCalledWith('s-b', 750, 300)
  })

  it('jogadores diferentes: um aviso de cada', () => {
    const { rotear } = roteador()
    rotear(daCripta(700, 270))
    rotear({ ...daCripta(10, 10), playerId: 'p-caio', name: 'Caio' })
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Bruno chamou em Cripta Rubra', 'Caio chamou em Cripta Rubra'])
  })

  it('disfarce: o aviso do mestre traz a jogadora e a ficha ("Bruno (Contínua do 9)"); ficha de mesmo nome não repete', () => {
    const { rotear } = roteador()
    rotear({ ...daCripta(700, 270), tokenName: 'Contínua do 9' })
    rotear({ ...daCripta(10, 10), playerId: 'p-caio', name: 'Caio', tokenName: 'Caio' })
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Bruno (Contínua do 9) chamou em Cripta Rubra', 'Caio chamou em Cripta Rubra'])
  })

  it('"Ir lá" chama goTo com a cena e o ponto do sinal', () => {
    const { deps, rotear } = roteador()
    rotear(daCripta(700, 270))
    useToastStore.getState().toasts[0]?.actions?.[0]?.run()
    expect(deps.goTo).toHaveBeenCalledTimes(1)
    expect(deps.goTo).toHaveBeenCalledWith('s-b', 700, 270)
  })
})
