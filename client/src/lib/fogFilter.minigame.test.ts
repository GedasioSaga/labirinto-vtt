/**
 * MINIGAME no RECORTE DO JOGADOR. O jogador recebe o pino (tipo, nome,
 * descrição) para o cartão avisar que há um desafio, mas NUNCA o desafio em
 * si nem a porta ligada: NPC, música, prêmio e consequência são do mestre e
 * chegam só no convite, aos chamados; o id da porta diria que ela existe.
 */
import { describe, expect, it } from 'vitest'
import type { MinigamePesca } from '../minigames/pesca/tipos'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { buildPin, createEmptyMap } from './mapFactory'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x: number, door: Wall['door'] = null): Wall {
  return { id, x1: x, y1: 0, x2: x, y2: 1000, blocksLight: true, blocksMove: true, door }
}

function desafio(extra: Partial<Pin> = {}): Pin {
  const base = buildPin('jogo', { x: 200, y: 200 }, 'minigame')
  return { ...base, nome: 'Salão da Ziza', description: 'Uma pista de dança no meio da sala.', portaLigada: 'porta-cofre-9f3a', ...extra }
}

/** Herói em x=180; muro cego em x=500; a porta ligada em x=800, fora da vista. */
function mapa(pins: Pin[]): MapData {
  const fechada = { open: false, locked: false, kind: 'normal' } as const // literal: `kind` fica 'normal' (DoorKind), não string
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [ficha('heroi', 180, 200)],
    pins,
    walls: [parede('muro', 500), parede('porta-cofre-9f3a', 800, fechada)],
  }
}

const DONOS = { p1: ['heroi'] }
const RAIO = 700

describe('filterMapForPlayer — minigame', () => {
  it('o pino chega como minigame, com nome e descrição, sem o desafio e sem a porta', () => {
    const out = filterMapForPlayer(mapa([desafio()]), 'p1', DONOS, RAIO)
    const pino = out.map.pins.find((p) => p.id === 'jogo')
    expect(pino?.kind).toBe('minigame')
    expect(pino?.nome).toBe('Salão da Ziza')
    expect(pino?.description).toBe('Uma pista de dança no meio da sala.')
    expect(pino !== undefined && 'minigame' in pino).toBe(false)
    expect(pino !== undefined && 'portaLigada' in pino).toBe(false)
  })

  it('SEGURANÇA: nada do desafio aparece em lugar nenhum do pacote', () => {
    const texto = JSON.stringify(filterMapForPlayer(mapa([desafio()]), 'p1', DONOS, RAIO))
    expect(texto).toContain('"minigame"')
    for (const segredo of ['Dona Ziza', 'Chave de latão', 'Agilidade', 'ginga', 'notaMin', 'portaLigada', 'porta-cofre-9f3a', '"premio"', '"musica"']) {
      expect(texto, segredo).not.toContain(segredo)
    }
  })

  it('minigame oculto para jogadores não chega, nem a descrição dele', () => {
    const out = filterMapForPlayer(mapa([desafio({ secret: true })]), 'p1', DONOS, RAIO)
    expect(out.map.pins).toEqual([])
    expect(JSON.stringify(out)).not.toContain('pista de dança')
  })
})

/**
 * PESCA no recorte: do desafio sai só `minigameVisivel` (o jogo e como ele
 * começa), para o cartão saber se oferece "Pescar". NPC, fala, lago, lances,
 * dificuldade, prêmio e consequência ficam no mestre.
 */
const PESCA_SECRETA: MinigamePesca = {
  jogo: 'pesca',
  npc: 'Seu Tonho',
  fala: 'Quem pesca aqui paga pedágio.',
  lago: 'Brejo Escondido',
  entrada: 'pino',
  lances: 4,
  permitida: 'extremo',
  premio: { texto: 'Mapa da gruta submersa' },
  consequencia: { texto: 'Sanguessugas no tornozelo' },
}

function pinoDoJogador(pino: Pin): Pin {
  const achado = filterMapForPlayer(mapa([pino]), 'p1', DONOS, RAIO).map.pins.find((p) => p.id === pino.id)
  if (achado === undefined) throw new Error('o pino não chegou ao jogador')
  return achado
}

describe('filterMapForPlayer — minigame de pesca', () => {
  it('a pesca de "jogador toca no pino" chega como { jogo, entrada } e nada mais do desafio', () => {
    const pino = pinoDoJogador(desafio({ minigame: PESCA_SECRETA }))
    expect(pino.minigameVisivel).toEqual({ jogo: 'pesca', entrada: 'pino' })
    expect(Object.keys(pino.minigameVisivel ?? {}).sort()).toEqual(['entrada', 'jogo'])
    expect('minigame' in pino).toBe(false)
  })

  it('a pesca de "mestre chama" diz mestre', () => {
    expect(pinoDoJogador(desafio({ minigame: { ...PESCA_SECRETA, entrada: 'mestre' } })).minigameVisivel).toEqual({ jogo: 'pesca', entrada: 'mestre' })
  })

  it('a dança (e o pino sem desafio gravado, que joga a dança) sempre começa pelo mestre', () => {
    expect(pinoDoJogador(desafio()).minigameVisivel).toEqual({ jogo: 'danca', entrada: 'mestre' })
    expect(pinoDoJogador(desafio({ minigame: undefined })).minigameVisivel).toEqual({ jogo: 'danca', entrada: 'mestre' })
  })

  it('outro tipo de pino não ganha o campo', () => {
    const ponto = { ...buildPin('ponto', { x: 220, y: 200 }, 'exclamacao'), description: 'Um banco.' }
    expect('minigameVisivel' in pinoDoJogador(ponto)).toBe(false)
  })

  it('SEGURANÇA: nada da pesca além do jogo e da entrada aparece no pacote', () => {
    const texto = JSON.stringify(filterMapForPlayer(mapa([desafio({ minigame: PESCA_SECRETA })]), 'p1', DONOS, RAIO))
    for (const segredo of ['Seu Tonho', 'pedágio', 'Brejo Escondido', 'gruta submersa', 'Sanguessugas', 'extremo', '"lances"', '"lago"', '"fala"', '"premio"', '"consequencia"', '"npc"', '"permitida"']) {
      expect(texto, segredo).not.toContain(segredo)
    }
  })

  it('um `minigameVisivel` gravado no mapa do mestre não é copiado: o recorte monta o dele', () => {
    // Pino de dança com um `minigameVisivel` mentiroso (arquivo editado à mão): sai dança e mestre.
    const pino = pinoDoJogador(desafio({ minigameVisivel: { jogo: 'pesca', entrada: 'pino' } }))
    expect(pino.minigameVisivel).toEqual({ jogo: 'danca', entrada: 'mestre' })
  })
})
