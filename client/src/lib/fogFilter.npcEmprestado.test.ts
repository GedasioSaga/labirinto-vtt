/**
 * NPC EMPRESTADO, lado do RECORTE: a ficha de NPC do mestre (`npc: true`) que
 * está na posse de um jogador sai para ELE com a marca de fio `emprestada` —
 * a tela usa a marca para não oferecer nome nem foto. A marca de NPC em si
 * continua sem atravessar. Quem não segura a ficha, a tela da mesa e a ficha
 * própria do jogador nunca recebem a marca, e `emprestada` gravada no mapa do
 * mestre nunca atravessa.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenContract } from '../types/map'
import { allPlayerTokens, filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 300

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

/** Gui (espada, x=100) segura o menino (NPC, x=1300); Bruno (machado, x=1250) está ao lado do menino. */
function vila(extraEspada: Partial<Token> = {}, extraMachado: Partial<Token> = {}): MapData {
  return {
    ...createEmptyMap('m-vila', 'Vila', 30, 10, 50),
    tokens: [ficha('espada', 'Espada', 100, extraEspada), ficha('menino', 'Menino', 1300, { npc: true }), ficha('machado', 'Machado', 1250, extraMachado)],
  }
}

const POSSE = { gui: ['espada', 'menino'], bruno: ['machado'] }

function tokenDe(view: ReturnType<typeof filterMapForPlayer>, id: string): Token | undefined {
  return view.map.tokens.find((t) => t.id === id)
}

describe('recorte do NPC emprestado pelo "Atribuir"', () => {
  it('quem segura o NPC o recebe com a marca emprestada e sem a marca de NPC; a ficha própria vem sem marca', () => {
    const view = filterMapForPlayer(vila(), 'gui', POSSE, RAIO)
    const menino = tokenDe(view, 'menino')
    expect(menino?.emprestada).toBe(true)
    expect(menino !== undefined && 'npc' in menino).toBe(false)
    const espada = tokenDe(view, 'espada')
    expect(espada?.name).toBe('Espada')
    expect(espada !== undefined && 'emprestada' in espada).toBe(false)
    // Emprestado anda e dá visão: as duas fichas do Gui são olhos dele.
    expect(view.vision).toHaveLength(2)
  })

  it('quem só vê o NPC (Bruno) recebe a ficha sem marca nenhuma', () => {
    const view = filterMapForPlayer(vila(), 'bruno', POSSE, RAIO)
    const menino = tokenDe(view, 'menino')
    expect(menino?.name).toBe('Menino')
    expect(JSON.stringify(view.map)).not.toContain('emprestada')
    expect(menino !== undefined && 'npc' in menino).toBe(false)
  })

  it('a tela da mesa (sem jogador) nunca recebe a marca', () => {
    const view = filterMapForGroup(vila(), [{ tokenIds: POSSE.gui, visionRadius: RAIO }], undefined, undefined, allPlayerTokens(POSSE))
    expect(view.map.tokens.some((t) => t.id === 'menino')).toBe(true)
    expect(JSON.stringify(view.map)).not.toContain('emprestada')
  })

  it('"emprestada" gravada no mapa do mestre não atravessa: nem na ficha própria nem na de outro', () => {
    const forjado = vila({ emprestada: true }, { emprestada: true })
    const doGui = filterMapForPlayer(forjado, 'gui', POSSE, RAIO)
    const espada = tokenDe(doGui, 'espada')
    expect(espada?.name).toBe('Espada')
    expect(espada !== undefined && 'emprestada' in espada).toBe(false)
    expect(tokenDe(doGui, 'menino')?.emprestada).toBe(true)
    const doBruno = filterMapForPlayer(forjado, 'bruno', POSSE, RAIO)
    expect(doBruno.map.tokens.map((t) => t.id).sort()).toEqual(['machado', 'menino'])
    expect(JSON.stringify(doBruno.map)).not.toContain('emprestada')
  })

  it('NPC do ajudante contratado leva o acordo, não a marca emprestada (a tela já lê o acordo)', () => {
    const acordo: TokenContract = { tarefa: 'vigiar', ate: null, visao: true }
    const view = filterMapForPlayer(vila(), 'gui', POSSE, RAIO, undefined, undefined, undefined, undefined, new Map([['menino', acordo]]))
    const menino = tokenDe(view, 'menino')
    expect(menino?.contrato).toEqual(acordo)
    expect(menino !== undefined && 'emprestada' in menino).toBe(false)
  })
})
