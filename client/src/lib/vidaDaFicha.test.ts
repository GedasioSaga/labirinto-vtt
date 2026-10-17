/**
 * BARRA DE VIDA DA FICHA DO SISTEMA (fatia 10, decisão D): o token não guarda
 * mais vida; a barra lê o HP da ficha ligada. Regras: sem ficha, sem barra;
 * sistema sem recurso de vida, sem barra e sem erro; o jogador recebe só a
 * proporção, da ficha de jogador e da que ele controla (decisão 4.3).
 */
import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { personagemDoArquivo, type Personagem } from './personagem'
import type { SistemaDeRpg } from './sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'
import {
  barrasParaJogador,
  barraVistaPeloJogador,
  ESCALA_DO_JOGADOR,
  mesmaVida,
  proporcaoParaJogador,
  recursoDeVida,
  vidaDoPersonagem,
  vidasDaCena,
} from './vidaDaFicha'

function personagem(id: string, tipo: 'jogador' | 'npc', hp: number, extra: Record<string, unknown> = {}): Personagem {
  const lido = personagemDoArquivo({ id, tipo, nome: id, recursos: { hp }, ...extra })
  if (lido === null) throw new Error(`personagem ${id} inválido`)
  return lido
}

function token(id: string, characterId: string | null): Token {
  return { id, characterId, name: id, x: 0, y: 0, size: 1, image: null }
}

const HP = recursoDeVida(SISTEMA_ONE_PIECE)

function hp(): NonNullable<typeof HP> {
  if (HP === null) throw new Error('o One Piece deveria ter recurso de vida')
  return HP
}

const SO_ENERGIA: SistemaDeRpg = { ...SISTEMA_ONE_PIECE, id: 'so-energia', recursos: [{ id: 'mana', nome: 'Mana', tom: 'energia', atualEMaximo: true }] }

describe('recursoDeVida — qual recurso a barra lê', () => {
  it('o HP do One Piece (vida, com atual e máximo)', () => {
    expect(HP?.id).toBe('hp')
  })

  it('sem sistema, sistema sem vida, ou vida de um número só: nenhum', () => {
    expect(recursoDeVida(null)).toBeNull()
    expect(recursoDeVida(SO_ENERGIA)).toBeNull()
    expect(recursoDeVida({ ...SISTEMA_ONE_PIECE, recursos: [{ id: 'pv', nome: 'PV', tom: 'vida' }] })).toBeNull()
  })
})

describe('vidaDoPersonagem — atual e máximo efetivo', () => {
  it('atual e máximo base', () => {
    expect(vidaDoPersonagem(personagem('og', 'npc', 173, { maximos: { hp: 419 } }), hp())).toEqual({ atual: 173, maximo: 419 })
  })

  it('o modificador entra no máximo (HP 600 +100 = 700)', () => {
    const ficha = personagem('lu', 'jogador', 450, { maximos: { hp: 600 }, modificadoresDosRecursos: { hp: 100 } })
    expect(vidaDoPersonagem(ficha, hp())).toEqual({ atual: 450, maximo: 700 })
  })

  it('ficha de antes, com um número só: o máximo é o próprio atual', () => {
    expect(vidaDoPersonagem(personagem('rato', 'npc', 12), hp())).toEqual({ atual: 12, maximo: 12 })
  })

  it('atual acima do máximo (o máximo caiu) fica no máximo; abaixo de zero fica em zero', () => {
    expect(vidaDoPersonagem(personagem('a', 'npc', 900, { maximos: { hp: 600 } }), hp())).toEqual({ atual: 600, maximo: 600 })
    expect(vidaDoPersonagem(personagem('b', 'npc', -5, { maximos: { hp: 10 } }), hp())).toEqual({ atual: 0, maximo: 10 })
  })

  it('máximo zerado (ficha nova, 0/0) não tem barra', () => {
    expect(vidaDoPersonagem(personagem('novo', 'jogador', 0), hp())).toBeNull()
    expect(vidaDoPersonagem(personagem('penalizado', 'npc', 5, { maximos: { hp: 10 }, modificadoresDosRecursos: { hp: -20 } }), hp())).toBeNull()
  })
})

describe('vidasDaCena — o que o mestre vê', () => {
  const lu = personagem('p-lu', 'jogador', 6, { maximos: { hp: 10 } })
  const og = personagem('p-og', 'npc', 173, { maximos: { hp: 419 } })

  it('cada token com ficha ligada ganha a vida dela, jogador ou NPC', () => {
    const vidas = vidasDaCena([token('tok-lu', 'p-lu'), token('tok-og', 'p-og')], [lu, og], SISTEMA_ONE_PIECE)
    expect(vidas.get('tok-lu')).toEqual({ atual: 6, maximo: 10 })
    expect(vidas.get('tok-og')).toEqual({ atual: 173, maximo: 419 })
  })

  it('sem ficha ligada, ou com o personagem apagado: sem barra', () => {
    const vidas = vidasDaCena([token('solto', null), token('orfao', 'p-apagado')], [lu, og], SISTEMA_ONE_PIECE)
    expect(vidas.size).toBe(0)
  })

  it('sistema sem recurso de vida, ou nenhum sistema: sem barra e sem erro', () => {
    expect(vidasDaCena([token('tok-lu', 'p-lu')], [lu], SO_ENERGIA).size).toBe(0)
    expect(vidasDaCena([token('tok-lu', 'p-lu')], [lu], null).size).toBe(0)
  })

  it('dois tokens da mesma ficha mostram a mesma vida; id de personagem repetido, vale o primeiro', () => {
    const copia = personagem('p-lu', 'jogador', 1, { maximos: { hp: 10 } })
    const vidas = vidasDaCena([token('a', 'p-lu'), token('b', 'p-lu')], [lu, copia], SISTEMA_ONE_PIECE)
    expect(vidas.get('a')).toEqual({ atual: 6, maximo: 10 })
    expect(vidas.get('b')).toEqual({ atual: 6, maximo: 10 })
  })
})

describe('proporcaoParaJogador — só a proporção, sem mentir o estado', () => {
  it('173 de 419 vira 41 de 100', () => {
    expect(proporcaoParaJogador({ atual: 173, maximo: 419 })).toEqual({ current: 41, max: ESCALA_DO_JOGADOR, shownToPlayers: true })
  })

  it('vivo nunca chega como 0; ferido nunca chega como cheio; zerado e cheio são o que são', () => {
    expect(proporcaoParaJogador({ atual: 1, maximo: 419 }).current).toBe(1)
    expect(proporcaoParaJogador({ atual: 418, maximo: 419 }).current).toBe(99)
    expect(proporcaoParaJogador({ atual: 0, maximo: 10 }).current).toBe(0)
    expect(proporcaoParaJogador({ atual: 10, maximo: 10 }).current).toBe(100)
  })

  it('ficha com número grande (HP de 600 mil) dá a proporção certa', () => {
    expect(proporcaoParaJogador({ atual: 500_000, maximo: 600_000 }).current).toBe(83)
  })
})

describe('barrasParaJogador e barraVistaPeloJogador — quem vê (decisão 4.3)', () => {
  const lu = personagem('p-lu', 'jogador', 6, { maximos: { hp: 10 } })
  const og = personagem('p-og', 'npc', 173, { maximos: { hp: 419 } })
  const barras = barrasParaJogador([token('tok-lu', 'p-lu'), token('tok-og', 'p-og')], [lu, og], SISTEMA_ONE_PIECE)

  it('a ficha de jogador é vista por todo jogador; a de NPC, só por quem a controla', () => {
    expect(barraVistaPeloJogador(barras.get('tok-lu'), false)).toEqual({ current: 60, max: 100, shownToPlayers: true })
    expect(barraVistaPeloJogador(barras.get('tok-og'), false)).toBeUndefined()
    expect(barraVistaPeloJogador(barras.get('tok-og'), true)).toEqual({ current: 41, max: 100, shownToPlayers: true })
  })

  it('o que vai ao recorte não carrega os pontos', () => {
    const texto = JSON.stringify([...barras.values()])
    expect(texto).not.toContain('173')
    expect(texto).not.toContain('419')
  })

  it('token sem barra: nada; e cada recorte recebe a sua cópia', () => {
    expect(barraVistaPeloJogador(undefined, true)).toBeUndefined()
    const uma = barraVistaPeloJogador(barras.get('tok-lu'), false)
    expect(uma).not.toBe(barras.get('tok-lu')?.proporcao)
  })
})

describe('mesmaVida', () => {
  it('compara por valor', () => {
    expect(mesmaVida({ atual: 3, maximo: 10 }, { atual: 3, maximo: 10 })).toBe(true)
    expect(mesmaVida({ atual: 3, maximo: 10 }, { atual: 4, maximo: 10 })).toBe(false)
    expect(mesmaVida(null, null)).toBe(true)
    expect(mesmaVida(null, { atual: 3, maximo: 10 })).toBe(false)
  })
})
