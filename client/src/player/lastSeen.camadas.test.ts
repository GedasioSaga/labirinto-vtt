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

const LIVRE: CamadaId = 'livre_19e8b9d7'
const BIA: Token = { id: 'bia', characterId: null, name: 'Bia', x: 100, y: 100, size: 1, image: null, camada: LIVRE }

type Pacote = Pick<MapData, 'id' | 'tokens' | 'camadasDoJogador' | 'hiddenLayers'>
const lista = (ids: readonly CamadaId[]) => ids.map((id) => ({ id }))
const CARLOS: Token = { id: 'carlos', characterId: null, name: 'Carlos', x: 300, y: 100, size: 1, image: null, camada: LIVRE }

describe('lastSeen com camada escondida (decisão do usuário: camada escondida APAGA o avistamento)', () => {
  it('a ficha da livre que o mestre escondeu NÃO vira contorno (a livre sai da lista)', () => {
    const comLivre: Pacote = { id: 'm1', tokens: [BIA], hiddenLayers: [], camadasDoJogador: lista([...CAMADAS_PADRAO, LIVRE]) }
    // O mestre escondeu a livre: o host não manda a ficha nem a camada na lista (o resto na ordem padrão: lista ausente).
    const semLivre: Pacote = { id: 'm1', tokens: [], hiddenLayers: [] }
    const antes = rememberSnapshot(EMPTY_LAST_SEEN, comLivre, [], 1000)
    expect(liveGhosts(rememberSnapshot(antes, semLivre, [], 2000), 2000)).toEqual([])
  })

  it('a ficha que SAI DA VISÃO com a camada dela ainda na lista continua virando contorno', () => {
    const doisNaLivre: Pacote = { id: 'm1', tokens: [BIA, CARLOS], hiddenLayers: [], camadasDoJogador: lista([...CAMADAS_PADRAO, LIVRE]) }
    const soCarlos: Pacote = { ...doisNaLivre, tokens: [CARLOS] }
    const antes = rememberSnapshot(EMPTY_LAST_SEEN, doisNaLivre, [], 1000)
    expect(liveGhosts(rememberSnapshot(antes, soCarlos, [], 2000), 2000).map((g) => g.tokenId)).toEqual(['bia'])
  })

  it('Tokens escondida dos jogadores com a lista no pacote (algo mais difere do padrão): a ficha sem camada escolhida não vira contorno', () => {
    const ana: Token = { id: 'ana', characterId: null, name: 'Ana', x: 10, y: 10, size: 1, image: null }
    const antes = rememberSnapshot(EMPTY_LAST_SEEN, { id: 'm1', tokens: [ana], hiddenLayers: [] }, [], 1000)
    const semTokens: Pacote = { id: 'm1', tokens: [], hiddenLayers: [], camadasDoJogador: lista(CAMADAS_PADRAO.filter((id) => id !== 'tokens')) }
    expect(liveGhosts(rememberSnapshot(antes, semTokens, [], 2000), 2000)).toEqual([])
  })

  it('mapa de antes com Tokens oculta (hiddenLayers no sentido antigo): não vira contorno; sem ocultar, vira', () => {
    const ana: Token = { id: 'ana', characterId: null, name: 'Ana', x: 10, y: 10, size: 1, image: null }
    const antes = rememberSnapshot(EMPTY_LAST_SEEN, { id: 'm1', tokens: [ana], hiddenLayers: [] }, [], 1000)
    expect(liveGhosts(rememberSnapshot(antes, { id: 'm1', tokens: [], hiddenLayers: ['tokens'] }, [], 2000), 2000)).toEqual([])
    expect(liveGhosts(rememberSnapshot(antes, { id: 'm1', tokens: [], hiddenLayers: [] }, [], 2000), 2000).map((g) => g.tokenId)).toEqual(['ana'])
  })

  it('o contorno que já existia some quando a camada da ficha some da lista depois', () => {
    const doisNaLivre: Pacote = { id: 'm1', tokens: [BIA, CARLOS], hiddenLayers: [], camadasDoJogador: lista([...CAMADAS_PADRAO, LIVRE]) }
    const saiuDaVisao = rememberSnapshot(rememberSnapshot(EMPTY_LAST_SEEN, doisNaLivre, [], 1000), { ...doisNaLivre, tokens: [CARLOS] }, [], 2000)
    expect(liveGhosts(saiuDaVisao, 2000).map((g) => g.tokenId)).toEqual(['bia'])
    const escondida = rememberSnapshot(saiuDaVisao, { id: 'm1', tokens: [], hiddenLayers: [] }, [], 3000)
    expect(liveGhosts(escondida, 3000)).toEqual([])
  })
})
