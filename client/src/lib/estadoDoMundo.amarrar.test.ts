import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { amarrarAoEstado, aplicarEstadoNoMapa, efeitoDaLuz, efeitoDaPorta, efeitoDaZona } from './estadoDoMundo'
import type { ConcealZone, DoorState, EfeitoNaPorta, Light, MapData, Pin, RegraDeEstado, Wall } from '../types/map'

/**
 * AMARRAR pelo painel: o mestre escolhe "Depende do estado: Maré" na porta, no
 * pino, na zona ou na luz, e diz o efeito de cada valor. `amarrarAoEstado`
 * grava a regra no elemento e já põe o elemento no efeito do valor ATUAL.
 */
const MARE = 'estado_mare'

function parede(id: string, door: DoorState | null): Wall {
  return { id, x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door }
}

const portaFechada: DoorState = { open: false, locked: false, kind: 'normal' }
const alcapao: Pin = { id: 'alcapao', x: 100, y: 100, kind: 'viagem', description: '', image: null }
const galeria: ConcealZone = { id: 'galeria', name: 'Galeria', revealed: false, points: [] }
const lampada: Light = { id: 'lampada', x: 10, y: 10, radius: 100, color: '#fff', intensity: 1 }

/** A regra da porta para a Maré, com o efeito de cada valor na ordem dada. */
function regraDaPorta(...efeitos: [string, EfeitoNaPorta][]): RegraDeEstado<EfeitoNaPorta> {
  return { estadoId: MARE, efeitos: efeitos.map(([valor, efeito]) => ({ valor, efeito })) }
}

function cena(): MapData {
  return {
    ...createEmptyMap('m', 'Cena', 1000, 1000, 50),
    walls: [parede('comporta', portaFechada), parede('muro', null)],
    pins: [alcapao],
    concealZones: [galeria],
    lights: [lampada],
  }
}

describe('amarrarAoEstado: a regra entra pelo painel, sem editar o arquivo à mão', () => {
  it('porta: grava a regra; com a maré ALTA agora e "alta → fechada", a porta segue fechada', () => {
    const regra = regraDaPorta(['alta', 'fechada'], ['baixa', 'aberta'])
    const depois = amarrarAoEstado(cena(), { alvo: 'porta', id: 'comporta', regra }, 'alta')
    const door = depois.walls.find((w) => w.id === 'comporta')?.door
    expect(door?.porEstado).toEqual(regra)
    expect(door?.open).toBe(false)
    // E a troca de estado, que só lê a regra do elemento, agora abre a porta.
    expect(aplicarEstadoNoMapa(depois, MARE, 'baixa').walls.find((w) => w.id === 'comporta')?.door?.open).toBe(true)
  })

  it('o efeito do valor ATUAL vale na hora: maré baixa agora e "baixa → aberta" abre a porta ao amarrar', () => {
    const regra = regraDaPorta(['baixa', 'aberta'])
    const depois = amarrarAoEstado(cena(), { alvo: 'porta', id: 'comporta', regra }, 'baixa')
    expect(depois.walls.find((w) => w.id === 'comporta')?.door).toEqual({ open: true, locked: false, kind: 'normal', porEstado: regra })
  })

  it('pino, zona e luz ganham a regra e o efeito do valor atual', () => {
    let map = cena()
    map = amarrarAoEstado(map, { alvo: 'pino', id: 'alcapao', regra: { estadoId: MARE, efeitos: [{ valor: 'baixa', efeito: 'livre' }] } }, 'baixa')
    map = amarrarAoEstado(map, { alvo: 'zona', id: 'galeria', regra: { estadoId: MARE, efeitos: [{ valor: 'baixa', efeito: 'revelada' }] } }, 'baixa')
    map = amarrarAoEstado(map, { alvo: 'luz', id: 'lampada', regra: { estadoId: MARE, efeitos: [{ valor: 'baixa', efeito: 'apagada' }] } }, 'baixa')
    expect(map.pins[0].passagem).toBe('livre')
    expect(map.pins[0].porEstado?.estadoId).toBe(MARE)
    expect(map.concealZones[0].revealed).toBe(true)
    expect(map.concealZones[0].porEstado?.estadoId).toBe(MARE)
    expect(map.lights[0].apagada).toBe(true)
    expect(map.lights[0].porEstado?.estadoId).toBe(MARE)
  })

  it('sem valor atual (estado que não existe na aventura): grava a regra e não mexe no efeito', () => {
    const regra = regraDaPorta(['baixa', 'aberta'])
    const depois = amarrarAoEstado(cena(), { alvo: 'porta', id: 'comporta', regra }, null)
    expect(depois.walls[0].door).toEqual({ ...portaFechada, porEstado: regra })
  })

  it('regra ausente DESAMARRA: a chave some e o estado real fica como está', () => {
    const regra = regraDaPorta(['baixa', 'aberta'])
    const amarrada = amarrarAoEstado(cena(), { alvo: 'porta', id: 'comporta', regra }, 'baixa')
    const solta = amarrarAoEstado(amarrada, { alvo: 'porta', id: 'comporta', regra: undefined }, 'baixa')
    const door = solta.walls[0].door
    expect(door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(door !== null && 'porEstado' in door).toBe(false)
  })

  it('mesma regra, id que não existe ou parede sem porta: devolve o MESMO mapa (sem entrada vazia no desfazer)', () => {
    const regra = regraDaPorta(['alta', 'fechada'])
    const amarrada = amarrarAoEstado(cena(), { alvo: 'porta', id: 'comporta', regra }, 'alta')
    expect(amarrarAoEstado(amarrada, { alvo: 'porta', id: 'comporta', regra: { ...regra, efeitos: [...regra.efeitos] } }, 'alta')).toBe(amarrada)
    const map = cena()
    expect(amarrarAoEstado(map, { alvo: 'porta', id: 'nao-existe', regra }, 'alta')).toBe(map)
    expect(amarrarAoEstado(map, { alvo: 'porta', id: 'muro', regra }, 'alta')).toBe(map)
    expect(amarrarAoEstado(map, { alvo: 'luz', id: 'lampada', regra: undefined }, 'alta')).toBe(map)
  })
})

describe('efeito de agora: o que o painel pré-escolhe ao amarrar', () => {
  it('porta trancada, aberta e fechada; zona; luz', () => {
    expect(efeitoDaPorta({ ...portaFechada, locked: true })).toBe('trancada')
    expect(efeitoDaPorta({ ...portaFechada, open: true })).toBe('aberta')
    expect(efeitoDaPorta(portaFechada)).toBe('fechada')
    expect(efeitoDaZona(galeria)).toBe('oculta')
    expect(efeitoDaZona({ ...galeria, revealed: true })).toBe('revelada')
    expect(efeitoDaLuz(lampada)).toBe('acesa')
    expect(efeitoDaLuz({ ...lampada, apagada: true })).toBe('apagada')
  })
})
