/**
 * CEGUEIRA — o que sai pelo FIO. A sessão do host inteira: a jogadora da Aira
 * (ficha com Cegueira) entra e o `broadcast` manda a cena. O Urso está a 5
 * casas: fora da metade do raio (3), dentro do raio normal (6). Ela recebe só
 * a posição da onda; o nome, o id e o personagem do Urso não saem em nenhum
 * frame. Sem a Cegueira, o mesmo Urso sai como ficha comum e não há onda.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'

const CODE = 'CEGA01'
const AIRA = 'tok-aira'
const URSO = 'tok-urso-escondido'
const NOME_DO_URSO = 'Urso Pardo de Prata'

function personagem(id: string, tipo: 'jogador' | 'npc', cega: boolean): Personagem {
  const lido = personagemDoArquivo({ id, tipo, nome: id, ...(cega ? { caracteristicas: [{ tipo: 'cegueira', id: 'car-1' }] } : {}) })
  if (lido === null) throw new Error(`personagem ${id} inválido`)
  return lido
}

function ficha(id: string, x: number, characterId: string, name: string): Token {
  return { id, characterId, name, x, y: 300, size: 1, image: null }
}

/** Frames que a jogadora recebeu no broadcast, já em texto (o que o fio entrega). */
function mesa(cega: boolean): { frames: string[]; snapshot: unknown } {
  const tokens = [ficha(AIRA, 400, 'p-aira', 'Aira'), ficha(URSO, 650, 'p-urso-escondido', NOME_DO_URSO)]
  const mundo = (): HostWorld => ({
    open: { sceneId: 'cena-1', name: 'Caverna', map: { ...createEmptyMap('m-cega', 'Caverna', 20, 12, 50), tokens } },
    background: [],
    rpg: { sistema: SISTEMA_ONE_PIECE, personagens: [personagem('p-aira', 'jogador', cega), personagem('p-urso-escondido', 'npc', false)] },
  })
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 300, now: () => 1_000, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, mundo())
  const welcome = entrou.outbound.find((o) => o.msg.type === 'welcome')?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, AIRA)
  const r = s.broadcast(mundo())
  const meus = r.outbound.filter((o) => o.clientId === 'c1')
  return { frames: meus.map((o) => JSON.stringify(o.msg)), snapshot: meus.find((o) => o.msg.type === 'snapshot')?.msg }
}

describe('hostSession: cegueira no fio', () => {
  it('a cega recebe só a posição da onda; nem nome, nem id, nem personagem de quem é sentido', () => {
    const { frames, snapshot } = mesa(true)
    expect(snapshot).toMatchObject({ type: 'snapshot', ondas: [{ x: 650, y: 300 }] })
    const fio = frames.join('\n')
    for (const segredo of [URSO, NOME_DO_URSO, 'p-urso-escondido', 'urso-escondido']) expect(fio).not.toContain(segredo)
  })

  it('sem Cegueira o Urso sai como ficha e nenhuma onda vai', () => {
    const { frames, snapshot } = mesa(false)
    expect(snapshot).not.toHaveProperty('ondas')
    expect(frames.join('\n')).toContain(URSO)
  })
})
