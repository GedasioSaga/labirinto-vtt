/**
 * MACRO POR PONTO da patrulha: cada ponto guarda a lista de passos que a ficha
 * faz ao chegar nele. Chega crua do disco: mapa antigo (ponto sem passos)
 * continua igual e se comporta como [Esperar 2 s]; passo torto some; valores
 * presos em faixas sensatas; fala com teto de tamanho.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, PassoDaPatrulha, Token, TokenPatrol } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  applyPatrolOp,
  ESPERA_MAXIMA_S,
  FALA_MAX_LETRAS,
  PASSOS_MAX_POR_PONTO,
  PASSO_PADRAO,
  passosDoPonto,
  readTokenPatrol,
  setPassosDoPonto,
  VELOCIDADE_MAXIMA,
} from './npcPatrol'

function mesa(patrulha?: TokenPatrol): MapData {
  const ficha: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 500, y: 500, size: 1, image: null, ...(patrulha === undefined ? {} : { patrulha }) }
  return { ...createEmptyMap('m', 'M', 1000, 1000, 50), tokens: [ficha] }
}

function passosLidos(passos: unknown): PassoDaPatrulha[] | undefined {
  return readTokenPatrol({ pontos: [{ x: 1, y: 1, passos }, { x: 2, y: 2 }], atual: 0 })?.pontos[0]?.passos
}

describe('passos do ponto — leitura', () => {
  it('mapa antigo: ponto sem passos fica sem o campo e vale [Esperar 2 s]', () => {
    const rota = readTokenPatrol({ pontos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], atual: 0 })
    expect(rota).toEqual({ pontos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], atual: 0 })
    expect(PASSO_PADRAO).toEqual({ tipo: 'esperar', segundos: 2 })
    expect(passosDoPonto({ x: 1, y: 1 })).toEqual([PASSO_PADRAO])
  })

  it('lista vazia é escolha do mestre: segue direto', () => {
    expect(passosLidos([])).toEqual([])
    expect(passosDoPonto({ x: 1, y: 1, passos: [] })).toEqual([])
  })

  it('guarda os 7 tipos, na ordem, com repetição', () => {
    const passos: PassoDaPatrulha[] = [
      { tipo: 'esperar', segundos: 3 },
      { tipo: 'olhar', graus: 90 },
      { tipo: 'velocidade', casas: 4 },
      { tipo: 'falar', texto: 'Quem vem lá?' },
      { tipo: 'sumir' },
      { tipo: 'aparecer' },
      { tipo: 'esperarMestre' },
      { tipo: 'esperar', segundos: 1 },
    ]
    expect(passosLidos(passos)).toEqual(passos)
  })

  it('passo torto some; o resto fica', () => {
    expect(
      passosLidos([
        { tipo: 'dançar' },
        { tipo: 'esperar', segundos: 'muito' },
        { tipo: 'falar', texto: 7 },
        null,
        'esperar',
        { tipo: 'sumir' },
      ]),
    ).toEqual([{ tipo: 'sumir' }])
  })

  it('valores presos em faixas sensatas', () => {
    expect(passosLidos([{ tipo: 'esperar', segundos: -5 }])).toEqual([{ tipo: 'esperar', segundos: 0 }])
    expect(passosLidos([{ tipo: 'esperar', segundos: 1e9 }])).toEqual([{ tipo: 'esperar', segundos: ESPERA_MAXIMA_S }])
    expect(passosLidos([{ tipo: 'olhar', graus: 450 }])).toEqual([{ tipo: 'olhar', graus: 90 }])
    expect(passosLidos([{ tipo: 'olhar', graus: -90 }])).toEqual([{ tipo: 'olhar', graus: 270 }])
    expect(passosLidos([{ tipo: 'velocidade', casas: 100 }])).toEqual([{ tipo: 'velocidade', casas: VELOCIDADE_MAXIMA }])
  })

  it('fala com teto de tamanho', () => {
    const lida = passosLidos([{ tipo: 'falar', texto: 'a'.repeat(FALA_MAX_LETRAS + 50) }])
    expect(lida).toEqual([{ tipo: 'falar', texto: 'a'.repeat(FALA_MAX_LETRAS) }])
  })

  it('teto de passos por ponto', () => {
    const muitos = Array.from({ length: PASSOS_MAX_POR_PONTO + 5 }, () => ({ tipo: 'sumir' }))
    expect(passosLidos(muitos)).toHaveLength(PASSOS_MAX_POR_PONTO)
  })
})

describe('passos do ponto — edição', () => {
  it('"Marcar ponto aqui" nasce com [Esperar 2 s]', () => {
    const marcado = applyPatrolOp(mesa(), 'guarda', 'marcar')
    expect(marcado.tokens[0]?.patrulha?.pontos[0]).toEqual({ x: 500, y: 500, passos: [{ tipo: 'esperar', segundos: 2 }] })
  })

  it('"Avançar patrulha" só move: não mexe nos passos nem em nada da ficha', () => {
    const rota: TokenPatrol = { pontos: [{ x: 1, y: 1 }, { x: 300, y: 300, passos: [{ tipo: 'sumir' }] }], atual: 0 }
    const depois = applyPatrolOp(mesa(rota), 'guarda', 'avancar').tokens[0]
    expect(depois).toMatchObject({ x: 300, y: 300 })
    expect(depois?.hidden).toBeUndefined()
    expect(depois?.patrulha?.pontos[1]?.passos).toEqual([{ tipo: 'sumir' }])
  })

  it('setPassosDoPonto troca a lista do ponto, lida pela mesma regra', () => {
    const rota: TokenPatrol = { pontos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], atual: 0 }
    const depois = setPassosDoPonto(mesa(rota), 'guarda', 1, [{ tipo: 'olhar', graus: 360 }, { tipo: 'esperarMestre' }])
    expect(depois.tokens[0]?.patrulha?.pontos[1]).toEqual({ x: 2, y: 2, passos: [{ tipo: 'olhar', graus: 0 }, { tipo: 'esperarMestre' }] })
    expect(depois.tokens[0]?.patrulha?.pontos[0]).toEqual({ x: 1, y: 1 })
  })

  it('nada muda (mesma lista, ponto que não existe, ficha sem rota): o MESMO mapa', () => {
    const map = mesa({ pontos: [{ x: 1, y: 1, passos: [{ tipo: 'sumir' }] }, { x: 2, y: 2 }], atual: 0 })
    expect(setPassosDoPonto(map, 'guarda', 0, [{ tipo: 'sumir' }])).toBe(map)
    expect(setPassosDoPonto(map, 'guarda', 5, [])).toBe(map)
    const semRota = mesa()
    expect(setPassosDoPonto(semRota, 'guarda', 0, [])).toBe(semRota)
  })
})
