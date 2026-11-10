/**
 * O AVISO "CENA SEM FOGO" NO RECORTE (`MapData.particulasSemFogo`, segunda
 * auditoria de 09/11/2026). O jogador só recebe os fogos que enxerga, então é
 * o host quem diz que a cena inteira não tem fogo e a fumaça nasce espalhada.
 * Aviso a mais cobre a tela (e a névoa) de fumaça numa cena cheia de fogos fora
 * da vista; aviso a menos deixa a cena sem fogo sem partícula nenhuma. Dados
 * inventados.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const HEROI = { x: 600, y: 400 }
/** A visão do jogador nesta cena: 6 casas. */
const VISAO = 6 * GRID
/** Longe de qualquer visão e de qualquer luz. */
const FOGO_FORA_DA_VISTA: Prop = { id: 'longe', src: '', x: HEROI.x + 45 * GRID, y: HEROI.y, width: GRID, height: GRID, linkedMapPath: null, mobilia: 'fogo' }
const HEROI_NO_MAPA: Token = { id: 'heroi', characterId: null, name: 'Aira', x: HEROI.x, y: HEROI.y, size: 1, image: null }

function pantano(mudancas: Partial<MapData>): MapData {
  return { ...createEmptyMap('pantano', 'Pântano', 120, 40, GRID), tokens: [HEROI_NO_MAPA], particulas: { fumaca: 'media' }, ...mudancas }
}

/** O recorte que o host manda ao jogador dono do herói. */
function recorteDoJogador(map: MapData): MapData {
  return filterMapForPlayer(map, 'ana', { ana: ['heroi'] }, VISAO).map
}

describe('recorte do jogador: o aviso de cena sem fogo', () => {
  it('fogo fora da vista: sem aviso; cena sem fogo nenhum: aviso; e o aviso nunca vem pronto do mapa', () => {
    const comFogoLonge = recorteDoJogador(pantano({ props: [FOGO_FORA_DA_VISTA] }))
    expect(comFogoLonge.props).toEqual([])
    expect(comFogoLonge.particulasSemFogo).toBeUndefined()

    expect(recorteDoJogador(pantano({ props: [] })).particulasSemFogo).toBe(true)

    // Efeito desligado: não há o que espalhar.
    expect(recorteDoJogador(pantano({ props: [], particulas: undefined })).particulasSemFogo).toBeUndefined()

    // Mapa que já chega com o aviso (arquivo editado à mão): quem decide é o host, pelos objetos da cena.
    expect(recorteDoJogador(pantano({ props: [FOGO_FORA_DA_VISTA], particulasSemFogo: true })).particulasSemFogo).toBeUndefined()
  })
})
