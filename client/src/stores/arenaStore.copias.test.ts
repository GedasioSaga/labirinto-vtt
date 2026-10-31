// @vitest-environment node
/**
 * ARENA — a carta da vez age com a PRÓPRIA cópia (passeio de 31/10/2026:
 * "Ilo 1", variação de força ×1, teria agido como "Ilo", o modelo de ×1,5).
 * Montagem do passeio: Bruno no Lado A contra Ilo e Ilo 1, empatados na
 * Agilidade, desempate no d20. O d20 decide quem abre; a vez, o nome no
 * registro e a força têm de ser os da cópia que ganhou o desempate.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTOR_DA_ARENA } from '../lib/arena/estadoDaArena'
import { CENA_DA_ARENA } from '../lib/arena/tipos'
import { cartaDaVez } from '../lib/batalha/turnos'
import { forcaDe, novoPersonagem, type Personagem, type TipoDePersonagem } from '../lib/personagem'
import { ID_ONE_PIECE, SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { batalhaDaArena, useArenaStore } from './arenaStore'

/** Os d20 do desempate, na ordem em que a store rola (Ilo, depois Ilo 1: a ordem da montagem). */
const rolagens: number[] = []
vi.mock('../lib/dice', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/dice')>()
  return { ...original, secureRollDie: () => rolagens.shift() ?? 10 }
})

function ficha(id: string, nome: string, tipo: TipoDePersonagem, agilidade: number, combate?: Personagem['combate']): Personagem {
  const base = novoPersonagem(SISTEMA_ONE_PIECE, tipo, nome)
  const personagem: Personagem = { ...base, id, atributos: { ...base.atributos, forca: 80, agilidade }, recursos: { hp: 600, sp: 100, escudo: 0 }, maximos: { hp: 600, sp: 100 } }
  if (combate !== undefined) personagem.combate = combate
  return personagem
}

const BRUNO = ficha('p-bruno', 'Bruno', 'jogador', 10)
const ILO = ficha('p-ilo', 'Ilo', 'npc', 60, { forca: 1.5 })
const ILO_1 = ficha('p-ilo-1', 'Ilo 1', 'npc', 60, { forca: 1, modeloId: ILO.id })
const FICHAS = [BRUNO, ILO, ILO_1]

/** Monta Bruno x (Ilo, Ilo 1), rola o desempate com `d20Ilo` e `d20Ilo1` e devolve a cópia da carta da vez. */
function lutar(d20Ilo: number, d20Ilo1: number) {
  const arena = useArenaStore.getState()
  arena.abrir(ID_ONE_PIECE)
  arena.escolher(BRUNO.id, 'a')
  arena.escolher(ILO.id, 'b')
  arena.escolher(ILO_1.id, 'b')
  rolagens.push(d20Ilo, d20Ilo1)
  expect(useArenaStore.getState().lutar(FICHAS)).toBe(true)
  const sessao = useArenaStore.getState().sessao
  const turnos = batalhaDaArena.getState().cenas[CENA_DA_ARENA]?.turnos
  const vez = turnos === undefined ? null : cartaDaVez(turnos)
  const copia = sessao?.copias.find((candidata) => candidata.id === vez?.personagemId)
  const tokenDoBruno = sessao?.tokens.find((token) => token.name === 'Bruno')?.id
  if (turnos === undefined || vez === null || copia === undefined || sessao === null || tokenDoBruno === undefined) throw new Error('a luta não começou')
  return { turnos, vez, copia, sessao, tokenDoBruno }
}

afterEach(() => {
  useArenaStore.getState().sair()
  rolagens.length = 0
})

describe('arena: a carta da vez age com a própria cópia', () => {
  it.each([
    { d20Ilo: 3, d20Ilo1: 12, nome: 'Ilo 1', forca: 1 },
    { d20Ilo: 15, d20Ilo1: 4, nome: 'Ilo', forca: 1.5 },
  ])('d20 Ilo $d20Ilo x Ilo 1 $d20Ilo1: abre $nome, com força ×$forca e o maior d20', ({ d20Ilo, d20Ilo1, nome, forca }) => {
    const { turnos, vez, copia } = lutar(d20Ilo, d20Ilo1)
    expect([copia.nome, forcaDe(copia), turnos.d20[vez.id]]).toEqual([nome, forca, Math.max(d20Ilo, d20Ilo1)])
  })

  it('o golpe da vez entra no registro com o nome da cópia da vez', () => {
    const { turnos, vez, tokenDoBruno } = lutar(3, 12)
    const pedido = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: tokenDoBruno, dano: 80 }], surpresa: false, perfurante: false } satisfies Parameters<ReturnType<typeof batalhaDaArena.getState>['agir']>[3]
    expect(batalhaDaArena.getState().agir(CENA_DA_ARENA, AUTOR_DA_ARENA, { cartaId: vez.id, rodada: turnos.rodada }, pedido)).toBe(true)
    expect(batalhaDaArena.getState().cenas[CENA_DA_ARENA]?.registro.at(-1)?.texto).toMatch(/^Ilo 1 usa Ataque em Bruno/)
  })

  it('cada cópia é uma ficha à parte: id próprio (nem o real, nem o da outra) e a força da ficha de origem', () => {
    const { sessao } = lutar(3, 12)
    const ids = sessao.copias.map((copia) => copia.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => FICHAS.some((real) => real.id === id))).toBe(false)
    expect(sessao.copias.filter((copia) => copia.tipo === 'npc').map((copia) => [copia.nome, forcaDe(copia)])).toEqual([
      ['Ilo', 1.5],
      ['Ilo 1', 1],
    ])
  })
})
