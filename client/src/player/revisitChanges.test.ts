import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, markRings } from '../lib/exploration'
import type { MapData, Prop, RegionPoint, Wall } from '../types/map'
import { createRevisitMemory, observeRevisit } from './revisitChanges'

/**
 * MAPA LEMBRADO — "Mudou desde a sua última visita". O jogador viu o corredor,
 * foi embora, o mestre jogou entulho lá, e o jogador volta: a área do entulho
 * pisca UMA vez, na primeira vez que ele o vê. Tudo aqui sai do que o jogador
 * já recebe (mapa recortado + visão); nada do mestre entra na conta.
 */

/** 25 x 25 células de 40 px: mundo de 1000 x 1000. */
function pacote(props: Prop[] = [], walls: Wall[] = [], id = 'm-cripta'): MapData {
  return { ...createEmptyMap(id, '', 25, 25, 40), props, walls }
}

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** A lanterna no corredor de cima, à esquerda. */
const NO_CORREDOR = [retangulo(0, 0, 400, 400)]
/** A lanterna longe, no salão de baixo, à direita. */
const NO_SALAO = [retangulo(600, 600, 1000, 1000)]
/** Onde o jogador nunca pôs o olho nesta sessão. */
const NA_ADEGA = [retangulo(600, 0, 1000, 400)]

const ENTULHO: Prop = { id: 'entulho', x: 200, y: 200, width: 60, height: 40, src: '', linkedMapPath: null }

function contem(area: { minX: number; minY: number; maxX: number; maxY: number }, x: number, y: number): boolean {
  return area.minX <= x && x <= area.maxX && area.minY <= y && y <= area.maxY
}

describe('observeRevisit — o que mudou desde a última visita pisca ao ser revisto', () => {
  it('o entulho pisca na primeira vez que é visto, e só nela', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_CORREDOR })).toEqual([])
    // Foi embora; o mestre joga o entulho no corredor (o recorte não manda: está fora da visão).
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])

    const volta = observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })
    expect(volta).toHaveLength(1)
    expect(contem(volta[0], 200, 200)).toBe(true)
    // A área cobre o entulho inteiro (60 x 40 em volta de 200, 200), não só o centro.
    expect(contem(volta[0], 170, 180)).toBe(true)
    expect(contem(volta[0], 230, 220)).toBe(true)

    // Continua olhando: não pisca de novo.
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })).toEqual([])
    // Sai e volta, entulho igual: nada mudou desde a última visita.
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })).toEqual([])
  })

  it('lugar que o jogador nunca viu nesta sessão não pisca: é novidade, não mudança', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    const adega: Prop = { ...ENTULHO, id: 'barril', x: 800, y: 200 }
    expect(observeRevisit(memoria, { map: pacote([adega]), vision: NA_ADEGA })).toEqual([])
  })

  it('o que aparece enquanto o jogador está olhando não pisca: ele viu acontecer', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_CORREDOR })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })).toEqual([])
  })

  it('o que sumiu desde a última visita pisca onde estava', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    const volta = observeRevisit(memoria, { map: pacote(), vision: NO_CORREDOR })
    expect(volta).toHaveLength(1)
    expect(contem(volta[0], 200, 200)).toBe(true)
    // Já mostrou que sumiu: a próxima volta não repete.
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_CORREDOR })).toEqual([])
  })

  it('o entulho que mudou de lugar pisca no lugar novo quando o jogador o revê', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    const empurrado: Prop = { ...ENTULHO, x: 300, y: 300 }
    const volta = observeRevisit(memoria, { map: pacote([empurrado]), vision: NO_CORREDOR })
    expect(volta).toHaveLength(1)
    expect(contem(volta[0], 300, 300)).toBe(true)
  })

  it('parede nova num trecho revisto também pisca', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_CORREDOR })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    const desabou: Wall = { id: 'desabou', x1: 100, y1: 250, x2: 300, y2: 250, blocksLight: true, blocksMove: true, door: null }
    const volta = observeRevisit(memoria, { map: pacote([], [desabou]), vision: NO_CORREDOR })
    expect(volta).toHaveLength(1)
    expect(contem(volta[0], 200, 250)).toBe(true)
  })

  it('a porta que outro jogador abriu não conta como trecho mudado: é o estado, não a planta', () => {
    const fechada: Wall = { id: 'porta', x1: 100, y1: 250, x2: 160, y2: 250, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
    const aberta: Wall = { ...fechada, blocksLight: false, blocksMove: false, door: { open: true, locked: false, kind: 'normal' } }
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote([], [fechada]), vision: NO_CORREDOR })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote([], [fechada]), vision: NO_SALAO })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote([], [aberta]), vision: NO_CORREDOR })).toEqual([])
  })

  it('debaixo de zona oculta nada pisca: o preto do mestre não vira pista', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    const zona = [retangulo(150, 150, 250, 250)]
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_CORREDOR, concealed: zona })).toEqual([])
    // A zona sai e o entulho continua lá: igual ao que ele lembrava, nada pisca.
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_SALAO })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })).toEqual([])
  })

  it('o que o mestre fez o jogador esquecer ("Esconder de novo") não pisca', () => {
    const memoria = createRevisitMemory()
    const mapa = pacote()
    const mundo = { width: 1000, height: 1000, grid: 40 }
    const lembra = createExploration(mundo)
    markRings(lembra, NO_CORREDOR)
    markRings(lembra, NO_SALAO)
    expect(observeRevisit(memoria, { map: mapa, vision: NO_CORREDOR, explored: lembra })).toEqual([])
    // O mestre zerou a memória: o explorado que chega só tem o salão.
    const esqueceu = createExploration(mundo)
    markRings(esqueceu, NO_SALAO)
    expect(observeRevisit(memoria, { map: mapa, vision: NO_SALAO, explored: esqueceu })).toEqual([])
    const depois = createExploration(mundo)
    markRings(depois, NO_SALAO)
    markRings(depois, NO_CORREDOR)
    expect(observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR, explored: depois })).toEqual([])
  })

  it('cada cena tem a própria lembrança: a viagem de volta revê o que mudou lá', () => {
    const memoria = createRevisitMemory()
    expect(observeRevisit(memoria, { map: pacote(), vision: NO_CORREDOR })).toEqual([])
    // Viajou para outra cena; o corredor de lá é outro lugar.
    expect(observeRevisit(memoria, { map: pacote([], [], 'm-torre'), vision: NO_SALAO })).toEqual([])
    expect(observeRevisit(memoria, { map: pacote([ENTULHO], [], 'm-torre'), vision: NO_CORREDOR })).toEqual([])
    // Voltou à cripta: lá ele tinha visto o corredor, e agora tem entulho.
    const volta = observeRevisit(memoria, { map: pacote([ENTULHO]), vision: NO_CORREDOR })
    expect(volta).toHaveLength(1)
    expect(contem(volta[0], 200, 200)).toBe(true)
  })

  it('o mesmo snapshot redesenhado (brilho, nomes) não conta como volta', () => {
    const memoria = createRevisitMemory()
    const mapa = pacote()
    expect(observeRevisit(memoria, { map: mapa, vision: NO_CORREDOR })).toEqual([])
    expect(observeRevisit(memoria, { map: mapa, vision: NO_SALAO })).toEqual([])
    const comEntulho = pacote([ENTULHO])
    expect(observeRevisit(memoria, { map: comEntulho, vision: NO_CORREDOR })).toHaveLength(1)
    expect(observeRevisit(memoria, { map: comEntulho, vision: NO_CORREDOR })).toEqual([])
  })
})
