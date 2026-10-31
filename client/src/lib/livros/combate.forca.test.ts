/**
 * A FORÇA DO NPC E O HP ATUAL (defeito do passeio de 31/10/2026: NPC com
 * força começa a batalha ferido). Pelo plano (docs/planos/livros-de-regras-plano.md
 * §2.1): o máximo NÃO é gravado multiplicado, a força entra na leitura
 * (`maximoComposto`); o atual é gravado e `trocarForca` o reescala. NPC cheio
 * continua cheio e o ferido mantém a proporção, em qualquer sequência de
 * forças (o "Deixar Justo" e o Desfazer do Comparar trocam duas vezes).
 */
import { describe, expect, it } from 'vitest'
import { maximoComposto } from '../ajusteDaFicha'
import { novoPersonagem, RECURSO_QUE_A_FORCA_MULTIPLICA, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { trocarForca } from './combate'

const HP = RECURSO_QUE_A_FORCA_MULTIPLICA

function npc(atual: number, maximo: number): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'npc', 'Vera'), id: 'p-vera', recursos: { hp: atual, sp: 100, escudo: 0 }, maximos: { hp: maximo, sp: 100 }, combate: { forca: 1 } }
}

/** [atual, máximo] como a ficha, a batalha e a arena mostram. */
const vida = (personagem: Personagem): [number | undefined, number] => [personagem.recursos[HP], maximoComposto(personagem, HP).total]

/** A força trocada em sequência, como o deslizante, o "Deixar ..." e o Desfazer gravam. */
const emSequencia = (personagem: Personagem, forcas: readonly number[]): Personagem => forcas.reduce(trocarForca, personagem)

describe('trocarForca: o HP atual acompanha a força', () => {
  it('NPC cheio continua cheio depois de Deixar Justo (×1,15 → ×0,5) e do Desfazer (→ ×1,15)', () => {
    const cheio = npc(1001, 1001)
    const passos = [1.15, 0.5, 1.15]
    const vidas = passos.map((_, i) => vida(emSequencia(cheio, passos.slice(0, i + 1))))
    expect(vidas).toEqual([
      [1151, 1151],
      [501, 501],
      [1151, 1151],
    ])
  })

  it('NPC cheio de 800 a ×1,5 fica 1.200/1.200, e de volta a ×1 fica 800/800', () => {
    const cheio = npc(800, 800)
    expect(vida(trocarForca(cheio, 1.5))).toEqual([1200, 1200])
    expect(vida(emSequencia(cheio, [1.5, 1]))).toEqual([800, 800])
  })

  it('NPC ferido mantém a proporção: 400/800 a ×1,5 fica 600/1.200', () => {
    expect(vida(trocarForca(npc(400, 800), 1.5))).toEqual([600, 1200])
  })

  it('ficha de um número só (sem máximo gravado) é cheia: 800 a ×1,5 fica 1.200/1.200', () => {
    const umNumero: Personagem = { ...npc(800, 800), maximos: {} }
    expect(vida(trocarForca(umNumero, 1.5))).toEqual([1200, 1200])
  })

  it('NPC sem HP (0/0) e jogador ficam como estavam', () => {
    expect(vida(trocarForca(npc(0, 0), 1.5))).toEqual([0, 0])
    const jogador: Personagem = { ...npc(800, 800), tipo: 'jogador' }
    expect(trocarForca(jogador, 1.5)).toBe(jogador)
  })
})
