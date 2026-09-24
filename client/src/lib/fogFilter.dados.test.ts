/**
 * O RECORTE da rolagem de dado: o que o mestre rola ESCONDIDO não existe para
 * o jogador, e a aberta sai só com os campos que a mesa lê — nada de cena, de
 * posição ou de id interno de jogador.
 */
import { describe, expect, it } from 'vitest'
import { diceRollForPlayer } from './fogFilter'

const ABERTA = { id: 'r-9', from: 'Mestre', master: true as const, count: 1, sides: 20 as const, modifier: 0, results: [17], total: 17, at: 5 }

describe('fogFilter: rolagem de dado para o jogador', () => {
  it('rolagem escondida do mestre não sai', () => {
    expect(diceRollForPlayer({ ...ABERTA, hidden: true })).toBeNull()
  })

  it('rolagem aberta sai inteira, sem a marca de escondida', () => {
    expect(diceRollForPlayer(ABERTA)).toEqual(ABERTA)
  })

  it('campo que o host carregasse a mais (id de jogador, cena) não vai junto', () => {
    const comSobras = { ...ABERTA, master: undefined, from: 'Ana', playerId: 'p-1', sceneId: 's-cripta', sceneName: 'Cripta Rubra' }
    const saiu = diceRollForPlayer(comSobras)
    expect(saiu).toEqual({ id: 'r-9', from: 'Ana', count: 1, sides: 20, modifier: 0, results: [17], total: 17, at: 5 })
    expect(JSON.stringify(saiu)).not.toContain('Cripta')
  })
})
