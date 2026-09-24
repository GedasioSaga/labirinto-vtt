import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { partyDestinations, PARTY_CENTER_LABEL, type PartyDestination, type PartyMember } from '../lib/party'
import type { SceneEntry } from '../lib/adventure'
import type { HostWorld } from '../net/hostSession'
import type { Pin } from '../types/map'
import { sendDestinationsFor } from './PartySection'
import { SceneSendForm } from './SceneSendForm'

/**
 * BUSCA NOS SELETORES DE CENA — "Mandar para…" (e o "Levar para…" da ficha,
 * que é o mesmo formulário): com muitas cenas, o campo de busca vem com o
 * foco, cada cena achada mostra o caminho em cinza, as setas andam pelas
 * achadas e Enter escolhe — e aí a lista de chegada já é a dos pinos dela.
 */

function destino(sceneId: string, name: string, trail: string[] = [], arrivals: PartyDestination['arrivals'] = []): PartyDestination {
  return { sceneId, name, arrivals, ...(trail.length > 0 ? { trail } : {}) }
}

const SOBRADO = destino('sobrado', 'Sobrado', ['Bairro Vellano'], [
  { pinId: 'porta-fundos', label: 'Porta dos fundos' },
  { pinId: 'janela', label: 'Janela do sótão' },
])

/** Oito cenas, duas Tavernas: o seletor sem busca é uma lista comprida. */
const MUITAS: PartyDestination[] = [
  destino('porto', 'Porto Cinza'),
  destino('taverna-porto', 'Taverna', ['Porto Cinza']),
  destino('vila', 'Bairro Vellano'),
  destino('taverna-vila', 'Taverna', ['Bairro Vellano']),
  SOBRADO,
  destino('mercado', 'Mercado', ['Porto Cinza']),
  destino('farol', 'Farol'),
  destino('cripta', 'Cripta'),
]

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

function montar(destinations: PartyDestination[], onSend = vi.fn(() => true), onClose = vi.fn()) {
  act(() =>
    root.render(
      <SceneSendForm title="Mandar Ana para…" ariaLabel="Mandar Ana para outra cena" submitLabel="Mandar" failedText="Não deu" destinations={destinations} onSend={onSend} onClose={onClose} />,
    ),
  )
  return { onSend, onClose }
}

function campoDeBusca(): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('input[type="search"]')
}

function listaPorRotulo(rotulo: string): HTMLSelectElement {
  const label = Array.from(container.querySelectorAll('label')).find((el) => el.textContent === rotulo)
  const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
  if (!(alvo instanceof HTMLSelectElement)) throw new Error(`sem a lista "${rotulo}"`)
  return alvo
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(alvo: Element, key: string): void {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

/** Os botões das cenas achadas, pelo nome acessível (o caminho inteiro numa linha). */
function achadas(): string[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('.lb-travel__choice')).map((botao) => botao.getAttribute('aria-label') ?? botao.textContent ?? '')
}

describe('"Mandar para…" com busca', () => {
  it('com muitas cenas, o foco nasce no campo de busca, e ele não se chama "Cena" (esse é o da lista)', () => {
    montar(MUITAS)
    const campo = campoDeBusca()
    expect(campo).not.toBeNull()
    expect(document.activeElement).toBe(campo)
    const rotulo = container.querySelector(`label[for="${campo?.id ?? ''}"]`)
    expect(rotulo?.textContent).toBe('Buscar destino')
    expect(listaPorRotulo('Cena').value).toBe('porto')
  })

  it('"vell s" deixa só o Sobrado, com "Bairro Vellano" em cinza embaixo do nome', () => {
    montar(MUITAS)
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'vell s')
    expect(achadas()).toEqual(['Bairro Vellano › Sobrado'])
    const botao = container.querySelector('.lb-travel__choice')
    expect(botao?.querySelector('.lb-travel__choice-nome')?.textContent).toBe('Sobrado')
    expect(botao?.querySelector('.lb-travel__caminho')?.textContent).toBe('Bairro Vellano')
    expect(botao?.getAttribute('data-enter')).toBe('true')
  })

  it('Enter escolhe o Sobrado sem mandar: a Cena passa a ser ele e o foco vai para a Chegada, que lista os pinos de lá', () => {
    const { onSend, onClose } = montar(MUITAS)
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'vell s')
    tecla(campo, 'Enter')
    expect(onSend).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(listaPorRotulo('Cena').value).toBe('sobrado')
    const chegada = listaPorRotulo('Chegada')
    expect(document.activeElement).toBe(chegada)
    expect(Array.from(chegada.options).map((option) => option.textContent)).toEqual([PARTY_CENTER_LABEL, 'Porta dos fundos', 'Janela do sótão'])
    // A busca fecha: a lista das achadas some e o campo volta vazio.
    expect(campo.value).toBe('')
    expect(achadas()).toEqual([])
  })

  it('depois do Enter, "Mandar" leva ao Sobrado pela chegada escolhida', () => {
    const { onSend } = montar(MUITAS)
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'sobr')
    tecla(campo, 'Enter')
    const chegada = listaPorRotulo('Chegada')
    act(() => {
      chegada.value = 'janela'
      chegada.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const form = container.querySelector('form')
    act(() => form?.requestSubmit())
    expect(onSend).toHaveBeenCalledWith('sobrado', 'janela')
  })

  it('"tav" acha as duas Tavernas, cada uma com o seu caminho; as setas descem por elas e sobem de volta ao campo', () => {
    montar(MUITAS)
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'tav')
    expect(achadas()).toEqual(['Porto Cinza › Taverna', 'Bairro Vellano › Taverna'])
    const botoes = Array.from(container.querySelectorAll<HTMLButtonElement>('.lb-travel__choice'))
    tecla(campo, 'ArrowDown')
    expect(document.activeElement).toBe(botoes[0])
    tecla(botoes[0] ?? campo, 'ArrowDown')
    expect(document.activeElement).toBe(botoes[1])
    tecla(botoes[1] ?? campo, 'ArrowUp')
    tecla(botoes[0] ?? campo, 'ArrowUp')
    expect(document.activeElement).toBe(campo)
  })

  it('clicar numa achada escolhe a cena, como o Enter', () => {
    montar(MUITAS)
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'tav')
    const segunda = container.querySelectorAll<HTMLButtonElement>('.lb-travel__choice')[1]
    act(() => segunda?.click())
    expect(listaPorRotulo('Cena').value).toBe('taverna-vila')
  })

  it('sem nada achado diz "Nenhuma cena com “zzz”", e Enter não escolhe nem manda', () => {
    const { onSend } = montar(MUITAS)
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'zzz')
    expect(achadas()).toEqual([])
    expect(container.textContent).toContain('Nenhuma cena com “zzz”')
    tecla(campo, 'Enter')
    expect(onSend).not.toHaveBeenCalled()
    expect(listaPorRotulo('Cena').value).toBe('porto')
  })

  it('Esc com texto limpa a busca e o formulário fica; o segundo Esc fecha', () => {
    const { onClose } = montar(MUITAS)
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'tav')
    tecla(campo, 'Escape')
    expect(campo.value).toBe('')
    expect(onClose).not.toHaveBeenCalled()
    tecla(campo, 'Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('com poucas cenas não há busca: o foco fica na lista "Cena", como sempre', () => {
    montar(MUITAS.slice(0, 3))
    expect(campoDeBusca()).toBeNull()
    expect(document.activeElement).toBe(listaPorRotulo('Cena'))
  })
})

function membro(playerId: string, sceneId: string | null, connected = true): PartyMember {
  return { playerId, name: playerId, connected, sceneId, sceneName: null, token: null, travelPending: false, mochila: [] }
}

describe('"Mandar para…": ordem e caminho', () => {
  it('cenas com gente primeiro; quem caiu não conta, nem o próprio jogador; o resto na ordem da lista', () => {
    const ana = membro('ana', 'porto')
    const membros = [ana, membro('bruno', 'cripta'), membro('carla', 'farol', false), membro('duda', 'mercado')]
    const ordem = sendDestinationsFor(ana, MUITAS, membros).map((d) => d.sceneId)
    expect(ordem).toEqual(['mercado', 'cripta', 'taverna-porto', 'vila', 'taverna-vila', 'sobrado', 'farol'])
  })

  it('o destino leva o caminho da lista de cenas da aventura; sem a lista, fica sem caminho', () => {
    const pino: Pin = { id: 'porta', x: 10, y: 10, kind: 'viagem', description: 'Porta', image: null, destino: null }
    const world: HostWorld = {
      open: { sceneId: 'vila', name: 'Bairro Vellano', map: createEmptyMap('m-vila', 'Bairro Vellano', 10, 10, 50) },
      background: [{ sceneId: 'sobrado', name: 'Sobrado', map: { ...createEmptyMap('m-sobrado', 'Sobrado', 10, 10, 50), pins: [pino] } }],
    }
    const lista: SceneEntry[] = [
      { id: 'vila', name: 'Bairro Vellano', file: 'scenes/vila/map.json' },
      { id: 'sobrado', name: 'Sobrado', file: 'scenes/sobrado/map.json', parentId: 'vila' },
    ]
    expect(partyDestinations(world, lista).map((d) => [d.sceneId, d.trail ?? []])).toEqual([
      ['vila', []],
      ['sobrado', ['Bairro Vellano']],
    ])
    expect(partyDestinations(world).map((d) => d.trail ?? [])).toEqual([[], []])
  })
})
