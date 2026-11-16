/**
 * CARIMBO QUE TAPA, À VISTA (auditoria de 16/11/2026): o pé do carimbo com "Tapa a
 * visão" mora DENTRO da pegada que segura o olhar, e o raio para na borda dela.
 * O recorte perguntava só pelo pé, que nunca fica à vista nem vira explorado:
 * o jogador recebia a sombra da árvore e não a árvore. Agora a pegada que ele
 * enxerga (a borda virada para ele, ao vivo ou lembrada) entrega o carimbo; o
 * escondido continua fora (camada, zona oculta, sala secreta), e o carimbo que
 * não tapa (inclusive o que só barra a passagem) segue a regra do pé, como antes.
 * Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { Carimbo, MapData, Region, RegionPoint, Token } from '../types/map'
import { createExploration, markRings, type Exploration } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const SO_ANA: Record<string, string[]> = { ana: ['ryoko'] }
/** Raio da visão em px: da Ryoko em (3; 5) até x = 750. */
const RAIO = 12 * GRID

const P = (x: number, y: number): RegionPoint => ({ x: x * GRID, y: y * GRID })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: `nome-${id}`, x: x * GRID, y: y * GRID, size: 1, image: null })

type Chave = 'tapa' | 'barra' | 'nenhuma'
const arvore = (chave: Chave, tamanho: number, x = 8 * GRID): Carimbo => ({
  id: 'arvore',
  tipo: 'pinheiro',
  x,
  y: 5 * GRID,
  tamanho,
  giro: 0,
  ...(chave === 'tapa' ? { tapaVisao: true } : chave === 'barra' ? { barra: true } : {}),
})

/** 0,8 casa (o menor natural), 1 casa, e o 200 px em que o defeito apareceu (pegada de 2 casas). */
const TAMANHOS = [0.8 * GRID, GRID, 4 * GRID] as const

const COFRE: Region = { id: 'cofre', tag: 'region', fillColor: '#444444', fillPattern: 'solid', data: {}, secret: true, room: { shape: 'rect', name: 'Cofre' }, points: rect(7, 4, 9, 6) }

type Esconderijo = 'nenhum' | 'zona' | 'sala-secreta' | 'camada'

function cena(carimbo: Carimbo | null, esconderijo: Esconderijo = 'nenhum', ryokoX = 3): MapData {
  return {
    ...createEmptyMap('mata', 'Mata', 30, 10, GRID),
    externa: true,
    tokens: [ficha('ryoko', ryokoX, 5), ficha('guarda', 12, 5)],
    carimbos: carimbo === null ? [] : [carimbo],
    concealZones: esconderijo === 'zona' ? [{ id: 'zona', name: 'Mata', revealed: false, points: rect(7, 4, 9, 6) }] : [],
    regions: esconderijo === 'sala-secreta' ? [COFRE] : [],
    ...(esconderijo === 'camada' ? { versaoDasCamadas: 2, hiddenLayers: [], ocultasDoJogador: ['terreno'] } : {}),
  }
}

function pacote(map: MapData, explorado?: Exploration) {
  const view = filterMapForPlayer(map, 'ana', SO_ANA, RAIO, explorado)
  return { vision: view.vision, tokens: view.map.tokens.map((t) => t.id).sort(), carimbos: (view.map.carimbos ?? []).map((c) => c.id) }
}

describe('carimbo com "Tapa a visão" à vista do jogador', () => {
  it('a árvore que tapa chega no pacote ao vivo, em todo tamanho, e continua fazendo sombra', () => {
    const semNada = pacote(cena(null))
    for (const tamanho of TAMANHOS) {
      const com = pacote(cena(arvore('tapa', tamanho)))
      expect(com.carimbos, `tamanho ${tamanho}`).toEqual(['arvore'])
      expect(com.vision, `tamanho ${tamanho}`).not.toEqual(semNada.vision)
    }
    // A de 200 px (pegada de 2 casas) esconde o guarda atrás dela; a pequena só faz uma sombra fina.
    expect(pacote(cena(arvore('tapa', 4 * GRID))).tokens).not.toContain('guarda')
  })

  it('lembrada: com a Ryoko longe, a borda que ela viu (o explorado) ainda entrega a árvore', () => {
    for (const tamanho of TAMANHOS) {
      const perto = cena(arvore('tapa', tamanho))
      const explorado = createExploration({ width: perto.width * perto.grid, height: perto.height * perto.grid, grid: perto.grid })
      markRings(explorado, pacote(perto).vision)
      // Em x = 27 casas, a árvore (x = 8) fica a mais de 900 px: fora do raio de 600.
      const longe = pacote(cena(arvore('tapa', tamanho), 'nenhum', 27), explorado)
      expect(longe.carimbos, `tamanho ${tamanho}`).toEqual(['arvore'])
      // Controle: sem a lembrança, de longe ela não chega.
      expect(pacote(cena(arvore('tapa', tamanho), 'nenhum', 27)).carimbos, `tamanho ${tamanho}`).toEqual([])
    }
  })

  it('escondida (zona oculta, sala secreta, camada que os jogadores não veem) continua fora do pacote e não tapa', () => {
    for (const esconderijo of ['zona', 'sala-secreta', 'camada'] as const) {
      const com = pacote(cena(arvore('tapa', 4 * GRID), esconderijo))
      expect(com.carimbos, esconderijo).toEqual([])
      expect(com.tokens, esconderijo).toContain('guarda')
      expect(com, esconderijo).toEqual(pacote(cena(null, esconderijo)))
    }
  })

  it('na beira do raio: a pegada que tapa entra pela borda à vista; o carimbo que não tapa segue pelo pé', () => {
    // Pé em x = 780 (fora do raio, que vai até 750); a pegada de 200 px começa em 730.
    const naBeira = 780
    expect(pacote(cena(arvore('tapa', 4 * GRID, naBeira))).carimbos).toEqual(['arvore'])
    expect(pacote(cena(arvore('nenhuma', 4 * GRID, naBeira))).carimbos).toEqual([])
    expect(pacote(cena(arvore('barra', 4 * GRID, naBeira))).carimbos).toEqual([])
  })
})

describe('guarda: carimbo que não tapa a visão, igual a antes', () => {
  it('sem chave ou só com "Barra a passagem": chega pelo pé, não faz sombra e não esconde o guarda', () => {
    const semNada = pacote(cena(null))
    for (const chave of ['nenhuma', 'barra'] as const) {
      for (const tamanho of TAMANHOS) {
        const com = pacote(cena(arvore(chave, tamanho)))
        expect(com.carimbos, `${chave} ${tamanho}`).toEqual(['arvore'])
        expect(com.tokens, `${chave} ${tamanho}`).toContain('guarda')
        expect(com.vision, `${chave} ${tamanho}`).toEqual(semNada.vision)
      }
    }
  })

  it('só com "Barra a passagem", escondido (zona, sala secreta, camada): fora do pacote, como antes', () => {
    for (const esconderijo of ['zona', 'sala-secreta', 'camada'] as const) {
      expect(pacote(cena(arvore('barra', 4 * GRID), esconderijo)).carimbos, esconderijo).toEqual([])
    }
  })
})
