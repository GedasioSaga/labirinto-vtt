/**
 * TIQUE DOS NPCS — a ponte entre o motor e quem anda sozinho: o pedido que não
 * sai dentro do tique segue na agenda com o trabalho que o tique já fez (não
 * recomeça nem vai para o fim da fila).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../../types/map'
import { createEmptyMap } from '../mapFactory'
import type { AgendaDeCaminhos } from './agenda'
import { GRID, parede } from './caminho.fixture'
import { agendaDeFatias, passoDaRotina } from './simulacao.fixture'
import { type MotorDosNpcs, TiqueDosNpcs } from './tiqueDosNpcs'

const R1 = GRID / 2
const PASSO = passoDaRotina(GRID)
/** Fatias que a agenda de relógio falso anda num tique (cada leitura do relógio vale 1 ms). */
const FATIAS_NO_TIQUE = 3
const PONTOS_POR_FATIA = 4

/** Sala com a única abertura do outro lado (a do `agenda.test.ts`): a busca anda várias fatias pequenas. */
const SALA = [
  parede('n', 256, 128, 576, 128),
  parede('s', 256, 448, 576, 448),
  parede('o', 256, 128, 256, 448),
  parede('l1', 576, 128, 576, 256),
  parede('l2', 576, 320, 576, 448),
]
const DE = { x: 160, y: 288 }
const PARA = { x: 416, y: 288 }
const NPC: Token = { id: 'npc', characterId: null, name: 'NPC', x: DE.x, y: DE.y, size: 1, image: null, npc: true }

function mesa(tokens: Token[], walls = SALA): MapData {
  return { ...createEmptyMap('m', 'M', 15, 10, GRID), walls, tokens }
}

/** Fatias até o pedido `chave` sair da fila, uma por `rodar`. */
function fatiasAte(agenda: AgendaDeCaminhos, chave: string): number {
  let fatias = 0
  while (agenda.pendente(chave) && fatias < 10_000) {
    agenda.rodar(1)
    fatias += 1
  }
  return fatias
}

function motorDeFatias(orcamentoDoTique: number): MotorDosNpcs {
  return { agenda: agendaDeFatias({ pontosPorFatia: PONTOS_POR_FATIA }), orcamentoDoTique }
}

describe('tique dos NPCs: o pedido que não cabe no tique', () => {
  it('segue na agenda com o trabalho do tique: o resto leva só as fatias que faltavam, e o próximo tique anda', () => {
    // O mesmo pedido do zero, noutra agenda igual: quantas fatias ele leva.
    const sozinha = agendaDeFatias({ pontosPorFatia: PONTOS_POR_FATIA })
    sozinha.pedir('npc', { walls: SALA, grid: GRID, width: 15, height: 10 }, R1, { de: DE, para: PARA, fichas: [] })
    const total = fatiasAte(sozinha, 'npc')
    expect(total).toBeGreaterThan(FATIAS_NO_TIQUE + 1)

    const motor = motorDeFatias(FATIAS_NO_TIQUE)
    const map = mesa([NPC])
    const primeiro = new TiqueDosNpcs(motor, 0).andar('npc', 'm', map, 'npc', PARA, undefined, PASSO)
    expect(primeiro?.situacao).toBe('planejando')
    expect(primeiro?.para).toEqual(DE)
    expect(motor.agenda.pendente('npc')).toBe(true)
    // Pedir de novo jogaria fora a busca andada: sobrariam `total - 1` (só a malha montada ficaria).
    expect(fatiasAte(motor.agenda, 'npc')).toBe(total - FATIAS_NO_TIQUE)

    const segundo = new TiqueDosNpcs(motor, 200).andar('npc', 'm', map, 'npc', PARA, primeiro?.andarilho, PASSO)
    expect(segundo?.situacao).toBe('andando')
    expect(segundo?.para).not.toEqual(DE)
    expect(motor.agenda.temTrabalho).toBe(false)
  })

  it('a resposta sai dentro do tique (orçamento de sobra): anda no mesmo tique e não deixa pedido na fila', () => {
    const motor = motorDeFatias(10_000)
    const tique = new TiqueDosNpcs(motor, 0).andar('npc', 'm', mesa([NPC]), 'npc', PARA, undefined, PASSO)
    expect(tique?.situacao).toBe('andando')
    expect(tique?.para).not.toEqual(DE)
    expect(motor.agenda.temTrabalho).toBe(false)
  })
})
