// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S2 (bug 5 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): o "−" rápido do jogador diz de
 * onde partiu, e um golpe que entra antes de o pedido chegar não some. Ficha
 * inventada com os números do relatório (HP 365, Escudo 12, golpe de 112).
 */
import { describe, expect, it } from 'vitest'
import { comAjustes, type Ajuste } from '../lib/ajusteDaFicha'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'

const CODIGO = 'ABC123'
const CACADOR: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Caçador'), id: 'pers_cacador', recursos: { hp: 365, sp: 60, escudo: 12 }, maximos: { hp: 400, sp: 60 } }

function mesa() {
  const tokens: Token[] = [{ id: 'tok-ana', characterId: CACADOR.id, name: 'Ana', x: 100, y: 100, size: 1, image: null }]
  let personagens: readonly Personagem[] = [CACADOR]
  const mundo = (): HostWorld => ({ open: { sceneId: 'cena-1', name: 'Navio', map: { ...createEmptyMap('m1', 'Navio', 40, 40, 50), tokens } }, background: [], rpg: { sistema: SISTEMA_ONE_PIECE, personagens } })
  let ids = 0
  const session = createHostSession({ code: CODIGO, visionRadius: 2000, now: () => 1_000, randomId: () => `id-${++ids}` })
  const r = session.handleMessage('c1', { type: 'join', code: CODIGO, name: 'Ana' }, mundo())
  const welcome = r.outbound.find((o) => o.msg.type === 'welcome')
  if (welcome === undefined || welcome.msg.type !== 'welcome') throw new Error('join não devolveu welcome')
  session.assignToken(welcome.msg.playerId, 'tok-ana')
  session.broadcast(mundo())
  return {
    /** O mestre mexe na ficha (o golpe que entrou): a ficha do mundo muda, sem passar pelo jogador. */
    mestreMuda: (mudar: (atual: Personagem) => Personagem) => {
      personagens = personagens.map(mudar)
    },
    ajustar: (ajustes: unknown[]) => {
      const resposta = session.handleMessage('c1', { type: 'personagem.ajustar', reqId: 'a1', personagemId: CACADOR.id, ajustes }, mundo())
      const aplicado = resposta.applyPersonagem
      if (aplicado !== undefined) personagens = personagens.map((p) => (p.id === aplicado.personagem.id ? aplicado.personagem : p))
      return resposta
    },
    hp: () => personagens.find((p) => p.id === CACADOR.id)?.recursos.hp,
  }
}

describe('bug 5: o −/+ rápido com um golpe no meio', () => {
  it('dez "−" (365 → 355) pendentes, golpe de 112 entra (Escudo 12 → 0, HP 365 → 265), o pedido chega: HP 255, os 100 do golpe ficam', () => {
    const t = mesa()
    t.mestreMuda((p) => ({ ...p, recursos: { ...p.recursos, hp: 265, escudo: 0 } }))

    const r = t.ajustar([{ parte: 'recurso', chave: 'hp', valor: 355, de: 365 }])

    expect(r.applyPersonagem?.ajustadoPor).toBe('Ana')
    expect(t.hp()).toBe(255)
  })

  it('a ficha otimista do jogador: o que ainda está na fila vai pela diferença por cima da que chegou (265 → 255); sem golpe, o valor dele (355)', () => {
    const naFila: Ajuste[] = [{ parte: 'recurso', chave: 'hp', valor: 355, de: 365 }]
    const comGolpe: Personagem = { ...CACADOR, recursos: { ...CACADOR.recursos, hp: 265, escudo: 0 } }
    expect(comAjustes(comGolpe, SISTEMA_ONE_PIECE, naFila).recursos.hp).toBe(255)
    expect(comAjustes(CACADOR, SISTEMA_ONE_PIECE, naFila).recursos.hp).toBe(355)
  })
})
