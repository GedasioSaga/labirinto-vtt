/**
 * OBJETO QUE BARRA e que o jogador NÃO ESTÁ VENDO (`TokenMoveOptions.objetoAVista`,
 * auditoria da 0.5.60). O objeto é físico: barra visto ou não, como a parede
 * que ele também não vê. Mas a recusa "objeto" ('Objeto no caminho') contaria
 * que há um OBJETO no escuro ou na névoa: ela só sai do objeto que o jogador
 * está recebendo. Do outro, a recusa é `wall`, a mesma da parede que ele não vê.
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40, sem Chão e sem parede):
 * a ficha na casa (7, 11), centro (300, 460); o MOINHO (2 x 2 casas, redondo)
 * com o centro em (480, 480), no traço reto até o outro lado (700, 460).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Token } from '../types/map'
import { paredesParaAndar } from './barranco'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove, type TokenMoveOptions } from './moveValidation'

const GRADE = 40
const POSSE = { p1: ['heroi'] }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 300, y: 460, size: 1, image: null }
const MOINHO: Prop = { id: 'moinho', src: '', x: 480, y: 480, width: 2 * GRADE, height: 2 * GRADE, linkedMapPath: null, mobilia: 'moinho' }
const DENTRO = { x: 480, y: 480 }
const DO_OUTRO_LADO = { x: 700, y: 460 }
const PAREDE = { ok: false, reason: 'wall' }
const OBJETO = { ok: false, reason: 'objeto' }

function cena(props: Prop[] = [MOINHO]): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, GRADE), tokens: [HEROI], props }
}

function arrastar(map: MapData, para: { x: number; y: number }, opcoes: TokenMoveOptions): ReturnType<typeof validateTokenMove> {
  return validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: para.x, y: para.y }, POSSE, opcoes)
}

/** O que o host diz: este jogador só está recebendo o objeto `id`. */
const soVe = (id: string): TokenMoveOptions => ({ objetoAVista: (prop) => prop.id === id })

describe('objeto que barra, fora do que o jogador está vendo', () => {
  it('barra igual, mas a recusa é a da parede; o objeto à vista continua respondendo "objeto"', () => {
    expect(arrastar(cena(), DO_OUTRO_LADO, soVe('nenhum'))).toEqual(PAREDE)
    expect(arrastar(cena(), DENTRO, soVe('nenhum'))).toEqual(PAREDE)
    expect(arrastar(cena(), DO_OUTRO_LADO, soVe('moinho'))).toEqual(OBJETO)
    // Sem a opção (a tela do próprio jogador, onde o mapa já é o recorte): todo objeto está à vista.
    expect(arrastar(cena(), DO_OUTRO_LADO, {})).toEqual(OBJETO)
    // Dois no mesmo traço, um à vista e o outro não: quem responde é o que ele vê.
    const dois = cena([MOINHO, { ...MOINHO, id: 'no-escuro', x: 600 }])
    expect(arrastar(dois, DO_OUTRO_LADO, soVe('moinho'))).toEqual(OBJETO)
    expect(arrastar(dois, DO_OUTRO_LADO, soVe('no-escuro'))).toEqual(OBJETO)
    expect(arrastar(dois, DO_OUTRO_LADO, soVe('nenhum'))).toEqual(PAREDE)
  })

  it('em batalha: sem o moinho no que o jogador conhece, a ficha anda e para antes dele, sem recusa que o denuncie', () => {
    const map = cena()
    const passo = arrastar(map, DENTRO, { ...soVe('nenhum'), batalha: { paredesDoJogador: paredesParaAndar(map.walls, map, 0) } })
    expect(passo.ok).toBe(true)
    // Parou fora da caixa do moinho (que começa em x = 440).
    if (passo.ok) expect(passo.x).toBeLessThan(440)
  })
})
