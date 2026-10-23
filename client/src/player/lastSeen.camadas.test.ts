/**
 * ÚLTIMO AVISTAMENTO E CAMADA ESCONDIDA (revisão da fatia 4): a ficha que some
 * do pacote porque o mestre escondeu a camada dela dos jogadores vira contorno
 * "visto por último" por 2 min, igual à ficha que sai da visão. Decisão
 * pendente no plano (`docs/planos/camadas-fase3-2026-10-22.md`, fatia 4):
 * sugestão de descartar o contorno quando a camada da ficha some da lista.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData, Token } from '../types/map'
import { CAMADAS_PADRAO } from '../lib/camadas/padrao'
import { EMPTY_LAST_SEEN, liveGhosts, rememberSnapshot } from './lastSeen'

const LIVRE: CamadaId = 'livre_k3j9x2'
const BIA: Token = { id: 'bia', characterId: null, name: 'Bia', x: 100, y: 100, size: 1, image: null, camada: LIVRE }

describe('lastSeen com camada escondida', () => {
  it('LIMITACAO ATUAL: a ficha da camada que o mestre escondeu vira contorno por 2 min (a decisão pendente pode apagá-lo)', () => {
    const comLivre: Pick<MapData, 'id' | 'tokens' | 'camadasDoJogador'> = { id: 'm1', tokens: [BIA], camadasDoJogador: [...CAMADAS_PADRAO.map((id) => ({ id })), { id: LIVRE }] }
    // O mestre escondeu a livre: o host não manda a ficha nem a camada na lista.
    const semLivre: Pick<MapData, 'id' | 'tokens' | 'camadasDoJogador'> = { id: 'm1', tokens: [] }
    const antes = rememberSnapshot(EMPTY_LAST_SEEN, comLivre, [], 1000)
    const depois = rememberSnapshot(antes, semLivre, [], 2000)
    expect(liveGhosts(depois, 2000).map((g) => g.tokenId)).toEqual(['bia'])
  })
})
