import { describe, expect, it } from 'vitest'
import type { HostWorld } from '../net/hostSession'
import type { MapData, Pin } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { PARTY_CENTER_LABEL, partyDestinations } from './party'

/**
 * "Mandar para… > Chegada" na torre de 7 andares: cada andar tem duas escadas
 * com o mesmo texto, e o cartão do pino é um parágrafo que o jogador lê — o
 * mestre via a mesma frase comprida duas vezes e não sabia qual escada era.
 */

function viagem(id: string, over: Partial<Pin> = {}): Pin {
  return { id, x: 100, y: 100, kind: 'viagem', description: '', image: null, destino: null, ...over }
}

function cena(sceneId: string, name: string, pins: Pin[]): HostWorld['open'] {
  const map: MapData = { ...createEmptyMap(`m-${sceneId}`, name, 20, 10, 50), pins }
  return { sceneId, name, map }
}

/** Os rótulos da Chegada da cena `sceneId`, na ordem do select. */
function rotulos(world: HostWorld, sceneId: string): string[] {
  const destino = partyDestinations(world).find((d) => d.sceneId === sceneId)
  if (destino === undefined) throw new Error(`cena ${sceneId} deveria ser destino`)
  return destino.arrivals.map((a) => a.label)
}

const PARAGRAFO = 'Escada de pedra em caracol. Os degraus estão gastos e úmidos, e o corrimão de ferro range quando alguém se apoia nele.'

describe('partyDestinations — rótulo curto da chegada', () => {
  it('usa o nome que o mestre deu à passagem (rotulo) antes da descrição do cartão', () => {
    const world: HostWorld = {
      open: cena('s-1', 'Andar 1', []),
      background: [cena('s-2', 'Andar 2', [viagem('e', { rotulo: 'Escada norte', description: PARAGRAFO })])],
    }
    expect(rotulos(world, 's-2')).toEqual(['Escada norte'])
  })

  it('sem rotulo, a primeira frase da descrição, nunca o parágrafo inteiro do cartão', () => {
    const world: HostWorld = { open: cena('s-1', 'Andar 1', []), background: [cena('s-2', 'Andar 2', [viagem('e', { description: PARAGRAFO })])] }
    const [rotulo] = rotulos(world, 's-2')
    expect(rotulo).toBe('Escada de pedra em caracol')
  })

  it('descrição de uma frase só e longa é cortada com reticências', () => {
    const longa = 'Porta de carvalho reforçada com tiras de bronze e um brasão raspado no meio'
    const world: HostWorld = { open: cena('s-1', 'Andar 1', []), background: [cena('s-2', 'Andar 2', [viagem('p', { description: longa })])] }
    const [rotulo] = rotulos(world, 's-2')
    expect(rotulo?.endsWith('…')).toBe(true)
    expect(rotulo?.length ?? 0).toBeLessThanOrEqual(40)
    expect(rotulo?.startsWith('Porta de carvalho')).toBe(true)
  })

  it('só a primeira linha da descrição entra no rótulo', () => {
    const world: HostWorld = { open: cena('s-1', 'Andar 1', []), background: [cena('s-2', 'Andar 2', [viagem('a', { description: 'Alçapão\nEscondido sob o tapete' })])] }
    expect(rotulos(world, 's-2')).toEqual(['Alçapão'])
  })

  it('texto repetido na mesma cena ganha a cena para onde o pino leva', () => {
    const world: HostWorld = {
      open: cena('s-1', 'Andar 1', []),
      background: [
        cena('s-2', 'Andar 2', [
          viagem('sobe', { description: PARAGRAFO, destino: { sceneId: 's-3', pinId: 'desce' } }),
          viagem('desce', { description: PARAGRAFO, destino: { sceneId: 's-1', pinId: 'x' } }),
        ]),
        cena('s-3', 'Andar 3', []),
      ],
    }
    expect(rotulos(world, 's-2')).toEqual(['Escada de pedra em caracol — para Andar 3', 'Escada de pedra em caracol — para Andar 1'])
  })

  it('repetidos sem destino (ou com o mesmo destino) são numerados; nenhum texto se repete no select', () => {
    const world: HostWorld = {
      open: cena('s-1', 'Andar 1', []),
      background: [
        cena('s-2', 'Andar 2', [
          viagem('a', { description: 'Porta' }),
          viagem('b', { description: 'porta ' }),
          viagem('c', { description: 'Janela', destino: { sceneId: 's-1', pinId: 'x' } }),
          viagem('d', { description: 'Janela', destino: { sceneId: 's-1', pinId: 'y' } }),
          viagem('e', { description: '   ' }),
          viagem('f', { description: '' }),
        ]),
      ],
    }
    const lista = rotulos(world, 's-2')
    expect(lista).toEqual(['Porta (1)', 'porta (2)', 'Janela — para Andar 1 (1)', 'Janela — para Andar 1 (2)', 'Pino de viagem (1)', 'Pino de viagem (2)'])
    const comCentro = [PARTY_CENTER_LABEL, ...lista].map((r) => r.toLocaleLowerCase())
    expect(new Set(comCentro).size).toBe(comCentro.length)
  })

  it('pino chamado igual ao "Centro da cena" não se confunde com o centro', () => {
    const world: HostWorld = { open: cena('s-1', 'Andar 1', []), background: [cena('s-2', 'Andar 2', [viagem('c', { description: PARTY_CENTER_LABEL })])] }
    const [rotulo] = rotulos(world, 's-2')
    expect(rotulo).not.toBe(PARTY_CENTER_LABEL)
    expect(rotulo?.startsWith(PARTY_CENTER_LABEL)).toBe(true)
  })

  it('texto único fica como está, sem sufixo; destino para cena que não abriu não vira sufixo', () => {
    const world: HostWorld = {
      open: cena('s-1', 'Andar 1', []),
      background: [
        cena('s-2', 'Andar 2', [
          viagem('a', { description: 'Escada', destino: { sceneId: 's-1', pinId: 'x' } }),
          viagem('b', { description: 'Poço', destino: { sceneId: 's-sumiu', pinId: 'x' } }),
          viagem('c', { description: 'Poço', destino: { sceneId: 's-sumiu', pinId: 'y' } }),
        ]),
      ],
    }
    expect(rotulos(world, 's-2')).toEqual(['Escada', 'Poço (1)', 'Poço (2)'])
  })

  it('cada cena desambigua só as próprias chegadas', () => {
    const world: HostWorld = {
      open: cena('s-1', 'Andar 1', [viagem('a', { description: 'Escada' })]),
      background: [cena('s-2', 'Andar 2', [viagem('b', { description: 'Escada' })])],
    }
    expect(rotulos(world, 's-1')).toEqual(['Escada'])
    expect(rotulos(world, 's-2')).toEqual(['Escada'])
  })
})
