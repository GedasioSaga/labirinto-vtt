/**
 * OBJETO QUE BARRA e que o jogador NÃO ESTÁ VENDO, no FIO (auditoria da
 * 0.5.60). O moinho barra visto ou não (é físico, como a parede que o jogador
 * também não vê), mas a recusa "objeto" ('Objeto no caminho') só sai quando o
 * moinho está na tela que ESTE jogador recebeu. Fora dela (névoa, escuro), a
 * recusa é `wall`, a mesma da parede que ele não vê: o texto não conta que ali
 * há um objeto. A prova é a sessão de verdade do mestre: o pacote que ela
 * entrega e a resposta dela ao passo.
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40, sem Chão e sem parede):
 * a ficha na casa (7, 11), centro (300, 460); o MOINHO (2 x 2 casas) com o
 * centro em (480, 480), a 140 px da ficha no ponto mais perto.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const GRADE = 40
/** Raio de visão que não chega ao moinho, e o que chega. */
const VISAO_CURTA = 60
const VISAO_LONGA = 700
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 300, y: 460, size: 1, image: null }
const MOINHO: Prop = { id: 'moinho', src: '', x: 480, y: 480, width: 2 * GRADE, height: 2 * GRADE, linkedMapPath: null, mobilia: 'moinho' }
const DENTRO = { x: 480, y: 480 }
const DO_OUTRO_LADO = { x: 700, y: 460 }

const CENA: MapData = { ...createEmptyMap('m', 'M', 25, 25, GRADE), tokens: [HEROI], props: [MOINHO] }

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

/** A mesa com a Ana na ficha e a tela dela entregue. Devolve a sessão e os objetos que a tela dela tem. */
function mesa(visionRadius: number, batalha = false): { s: HostSession; objetosNaTela: string[] } {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius, now: () => 0, randomId: () => `id-${(n += 1)}`, getBatalha: () => batalha })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, CENA).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'heroi')
  return { s, objetosNaTela: snapshotPara(s.broadcast(CENA), 'c1').map.props.map((p) => p.id) }
}

function andar(s: HostSession, para: { x: number; y: number }): HostMessage | undefined {
  return s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: para.x, y: para.y }, CENA).outbound[0]?.msg
}

describe('objeto que barra, fora do que o jogador está vendo, pela rede', () => {
  it('moinho fora da tela dele: barra, e a recusa é a da parede; moinho à vista: barra, e a recusa é "objeto"', () => {
    const noEscuro = mesa(VISAO_CURTA)
    expect(noEscuro.objetosNaTela).toEqual([])
    for (const para of [DO_OUTRO_LADO, DENTRO]) {
      const recusa = andar(noEscuro.s, para)
      expect(recusa?.type).toBe('token.move.rejected')
      if (recusa?.type === 'token.move.rejected') expect(recusa.reason).toBe('wall')
    }

    const aVista = mesa(VISAO_LONGA)
    expect(aVista.objetosNaTela).toEqual(['moinho'])
    const recusa = andar(aVista.s, DO_OUTRO_LADO)
    expect(recusa?.type).toBe('token.move.rejected')
    if (recusa?.type === 'token.move.rejected') expect(recusa.reason).toBe('objeto')
  })

  it('em batalha: o moinho fora da tela para a ficha antes dele, sem recusa; à vista, a casa dentro dele recusa com "objeto"', () => {
    const noEscuro = mesa(VISAO_CURTA, true)
    expect(noEscuro.objetosNaTela).toEqual([])
    const aceito = andar(noEscuro.s, DENTRO)
    expect(aceito?.type).toBe('token.move.accepted')
    // Parou fora da caixa do moinho (que começa em x = 440).
    if (aceito?.type === 'token.move.accepted') expect(aceito.x).toBeLessThan(440)

    const aVista = mesa(VISAO_LONGA, true)
    expect(aVista.objetosNaTela).toEqual(['moinho'])
    const recusa = andar(aVista.s, DENTRO)
    expect(recusa?.type).toBe('token.move.rejected')
    if (recusa?.type === 'token.move.rejected') expect(recusa.reason).toBe('objeto')
  })
})
