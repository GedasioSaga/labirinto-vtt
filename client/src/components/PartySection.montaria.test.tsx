/**
 * MONTARIA E FAMILIAR no painel Grupo: ficha do jogador que ficou em OUTRA
 * cena (a Faísca de Bruno, esquecida na Vila) aparece na linha dele — "Faísca
 * ficou em outra cena" — com "Trazer", que a põe ao lado dele. Dado só do
 * mestre: nada disto vai pela rede.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { awayTokenLabel, partyMembers } from '../lib/party'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'
import { BRING_FAILED, PartySection } from './PartySection'

function ficha(id: string, name: string, x = 100, y = 100): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function mundo(): HostWorld {
  const estrada = { ...createEmptyMap('m-a', 'Estrada', 30, 10, 50), tokens: [ficha('bruno', 'Bruno'), ficha('ana', 'Ana', 200, 100), ficha('gato', '  ', 250, 100)] }
  const vila = { ...createEmptyMap('m-b', 'Vila', 30, 10, 50), tokens: [ficha('faisca', 'Faísca', 700, 200), ficha('coruja', '', 750, 200)] }
  return { open: { sceneId: 's-a', name: 'Estrada', map: estrada }, background: [{ sceneId: 's-b', name: 'Vila', map: vila }] }
}

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: 'X', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, ...over }
}

const JOGADORES: PlayerInfo[] = [
  jogador({ playerId: 'bruno', name: 'Bruno', tokenIds: ['bruno', 'faisca', 'coruja'], sceneId: 's-a', sceneName: 'Estrada' }),
  jogador({ playerId: 'ana', name: 'Ana', tokenIds: ['ana', 'gato'], sceneId: 's-a', sceneName: 'Estrada' }),
  // Esperando: não tem cena, então não há "outra cena" para avisar.
  jogador({ playerId: 'caio', name: 'Caio', status: 'waiting', tokenIds: ['faisca-velha'] }),
]

describe('lib/party: fichas do jogador em outra cena', () => {
  it('a linha de Bruno lista a Faísca e a coruja (sem nome) da Vila; Ana, com tudo na cena dela, não lista nada', () => {
    const [bruno, ana, caio] = partyMembers(JOGADORES, mundo())
    expect(bruno?.awayTokens).toEqual([
      { tokenId: 'faisca', name: 'Faísca', sceneId: 's-b', sceneName: 'Vila' },
      { tokenId: 'coruja', name: '', sceneId: 's-b', sceneName: 'Vila' },
    ])
    expect(ana?.awayTokens).toBeUndefined()
    expect(caio?.awayTokens).toBeUndefined()
  })

  it('o aviso: "Faísca ficou em outra cena"; ficha sem nome não some do aviso', () => {
    expect(awayTokenLabel('Faísca')).toBe('Faísca ficou em outra cena')
    expect(awayTokenLabel('  ')).toBe('Uma ficha ficou em outra cena')
  })
})

describe('PartySection: "Trazer"', () => {
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

  const render = (onBring: (playerId: string, tokenId: string) => boolean) => {
    act(() => {
      root.render(<PartySection members={partyMembers(JOGADORES, mundo())} destinations={[]} onGoTo={vi.fn()} onSend={vi.fn(() => true)} onBring={onBring} />)
    })
  }

  const trazer = (nome: string): HTMLButtonElement => {
    const botao = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === `Trazer ${nome} para perto de Bruno`)
    if (botao === undefined) throw new Error(`deveria haver "Trazer" para ${nome}`)
    return botao
  }

  it('a linha de Bruno avisa a Faísca, e "Trazer" pede a Faísca DELE', () => {
    const onBring = vi.fn(() => true)
    render(onBring)
    const linhaBruno = [...container.querySelectorAll('li')].find((li) => li.textContent?.includes('Bruno') === true)
    expect(linhaBruno?.textContent).toContain('Faísca ficou em outra cena')
    expect(linhaBruno?.textContent).toContain('Uma ficha ficou em outra cena')
    const linhaAna = [...container.querySelectorAll('li')].find((li) => li.textContent?.startsWith('Ana') === true)
    expect(linhaAna?.textContent).not.toContain('ficou em outra cena')
    const botao = trazer('Faísca')
    expect(botao.textContent).toBe('Trazer')
    act(() => botao.click())
    expect(onBring).toHaveBeenCalledWith('bruno', 'faisca')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('"Trazer" que não deu avisa na linha', () => {
    render(vi.fn(() => false))
    act(() => trazer('Faísca').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(BRING_FAILED)
  })
})
