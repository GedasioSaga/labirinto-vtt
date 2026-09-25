import { describe, expect, it } from 'vitest'
import type { MapData, Region, RoomMeta, Token } from '../types/map'
import { filterFloorMemory, filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { createExploration, markAll } from './exploration'
import { createEmptyMap } from './mapFactory'

/**
 * DADOS INTERNOS DA SALA NÃO VÃO AO JOGADOR — da `Region` só sai o que a tela
 * dele desenha. `data` (dado livre do mestre, ex.: o `endereco` de cada cômodo
 * da torre), `tag` (o rótulo que o mestre dá à região e que nomeia a área no
 * aviso de gatilho) e `locked` (trava do editor) ficam no mestre: nada em
 * `player/` nem em `pixi/` os lê, e cada um custava bytes em todo pacote.
 */
const RADIUS = 700
const ownership = { p1: ['ana'] }
const ENDERECO = 'A05-D07-Q01-P10-C6'
const ROTULO = 'Fosso-com-estacas'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function regiao(id: string, x: number, y: number, w: number, h: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
    ...extra,
  }
}

function sala(id: string, nome: string, x: number, y: number, w: number, h: number, room: Partial<RoomMeta> = {}, extra: Partial<Region> = {}): Region {
  return regiao(id, x, y, w, h, { room: { shape: 'rect', name: nome, ...room }, ...extra })
}

/** Os três campos internos, com o que a torre de verdade guarda neles. */
const INTERNOS: Partial<Region> = {
  tag: ROTULO,
  data: { endereco: ENDERECO, nivel: 7, notaInterna: { quem: 'Guarda da Coroa' } },
  locked: true,
}

/** Ana dentro do Albergue; uma região comum (pátio) ao lado, também à vista. */
function mapa(regions: Region[]): MapData {
  return { ...createEmptyMap('m-albergue', 'Albergue', 1500, 600, 50), tokens: [ficha('ana', 250, 250)], regions }
}

function regioesDoJogador(map: MapData): Region[] {
  return filterMapForPlayer(map, 'p1', ownership, RADIUS).map.regions
}

describe('dados internos da sala não vão ao jogador', () => {
  it('sala à vista: data, tag e locked não saem; o que a tela desenha continua saindo', () => {
    const map = mapa([sala('albergue', 'Albergue Santa Balaustrada', 100, 100, 300, 300, {}, { ...INTERNOS, strokeWidth: 3, filled: false })])
    const [enviada] = regioesDoJogador(map)
    expect(enviada?.id).toBe('albergue')
    expect(enviada?.data).toEqual({})
    expect(enviada?.tag).toBe('')
    expect(enviada && 'locked' in enviada).toBe(false)
    // O que a tela usa: contorno, cor, espessura, fundo e o nome da sala.
    expect(enviada?.points).toEqual(map.regions[0]?.points)
    expect(enviada?.fillColor).toBe('#3a7ad0')
    expect(enviada?.strokeWidth).toBe(3)
    expect(enviada?.filled).toBe(false)
    expect(enviada?.room?.name).toBe('Albergue Santa Balaustrada')
  })

  it('região comum (sem sala) à vista: o rótulo e os dados do mestre não saem', () => {
    const map = mapa([regiao('patio', 100, 100, 300, 300, INTERNOS)])
    const [enviada] = regioesDoJogador(map)
    expect(enviada?.id).toBe('patio')
    expect(enviada?.data).toEqual({})
    expect(enviada?.tag).toBe('')
    expect(enviada && 'locked' in enviada).toBe(false)
  })

  it('sala com texto de entrada (o caminho que reescreve a sala): os internos também não saem', () => {
    const map = mapa([sala('cozinha', 'Cozinha', 100, 100, 300, 300, { textoAoEntrar: 'Cheiro de pão.', notaDoMestre: 'mímico' }, INTERNOS)])
    const [enviada] = regioesDoJogador(map)
    expect(enviada?.room?.name).toBe('Cozinha')
    expect(enviada?.data).toEqual({})
    expect(enviada?.tag).toBe('')
  })

  it('o pacote inteiro não carrega endereço, rótulo nem nada de data, em nenhum caminho do recorte', () => {
    const map = mapa([
      sala('albergue', 'Albergue', 100, 100, 300, 300, {}, INTERNOS),
      sala('quarto', 'Quarto do Hospedeiro', 150, 150, 100, 100, { nameHiddenFromPlayers: true }, { ...INTERNOS, parentId: 'albergue' }),
      regiao('patio', 450, 100, 300, 300, INTERNOS),
    ])
    const exp = createExploration(map)
    markAll(exp)
    const recortes = [
      filterMapForPlayer(map, 'p1', ownership, RADIUS, exp).map,
      // TELA DA MESA: o recorte do grupo.
      filterMapForGroup(map, [{ tokenIds: ['ana'], visionRadius: RADIUS }]).map,
      // Mapa-mundi (caravana): o mesmo recorte por outro caminho.
      filterMapForPlayer({ ...map, worldMap: true }, 'p1', ownership, RADIUS).map,
    ]
    for (const recorte of recortes) {
      expect(recorte.regions.map((r) => r.id).sort()).toEqual(['albergue', 'patio', 'quarto'])
      const pacote = JSON.stringify(recorte)
      expect(pacote).not.toContain(ENDERECO)
      expect(pacote).not.toContain('endereco')
      expect(pacote).not.toContain(ROTULO)
      expect(pacote).not.toContain('Guarda da Coroa')
      expect(pacote).not.toContain('"locked":true')
    }
  })

  it('memória de outro andar (sem ninguém olhando) também sai sem os internos', () => {
    const map = mapa([regiao('patio', 100, 100, 300, 300, INTERNOS)])
    const exp = createExploration(map)
    // O andar inteiro já foi explorado: a memória do andar mostra a planta toda.
    markAll(exp)
    const memoria = filterFloorMemory(map, exp, new Map())
    expect(memoria.map.regions.map((r) => r.id)).toEqual(['patio'])
    expect(JSON.stringify(memoria.map)).not.toContain(ENDERECO)
    expect(JSON.stringify(memoria.map)).not.toContain(ROTULO)
  })

  it('região sem nenhum campo opcional (sem sala, sem data, sem rótulo) sai igual', () => {
    const crua = regiao('crua', 100, 100, 300, 300)
    const [enviada] = regioesDoJogador(mapa([crua]))
    expect(enviada).toEqual(crua)
  })

  it('o mapa do mestre não é alterado pelo recorte', () => {
    const map = mapa([sala('albergue', 'Albergue', 100, 100, 300, 300, {}, INTERNOS)])
    regioesDoJogador(map)
    expect(map.regions[0]?.data).toEqual(INTERNOS.data)
    expect(map.regions[0]?.tag).toBe(ROTULO)
    expect(map.regions[0]?.locked).toBe(true)
  })
})
