/**
 * CLICAR PARA ANDAR com a cena em "Fora do Chão: bloqueado" (`lib/offFloor.ts`):
 * o clique num ponto que o jogador VÊ, mas que está fora do Chão, dizia "Você
 * não conhece o caminho", o que é falso (ele conhece; o Chão é que barra).
 * Agora diz "Fora do chão", a frase que o arrasto para o mesmo ponto recebe.
 *
 * No ESCURO o aviso continua o de antes: senão o texto contaria ao jogador
 * onde o Chão acaba debaixo da névoa.
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40, sem parede): o Chão é a
 * metade esquerda (x de 0 a 500); a ficha fica em (200, 200), dentro dele.
 */
import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, RegionPoint, Token } from '../types/map'
import { latestActionNotice } from '../player/moveNotice'
import { planejarCaminhada } from './cliqueParaAndar'
import type { KnownArea } from './knownPath'
import { createEmptyMap } from './mapFactory'

const GRADE = 40
const CHAO: FloorPiece = { id: 'chao', shape: { kind: 'rect', cx: 250, cy: 500, w: 500, h: 1000 }, op: 'add', modifiers: {} }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 200, y: 200, size: 1, image: null }
/** Fora do Chão, 300 px além da borda dele. */
const LA_FORA = { x: 800, y: 200 }

function cena(patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, GRADE), floor: [CHAO], tokens: [HEROI], ...patch }
}

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** O jogador vê o mapa inteiro agora. */
const VE_TUDO: KnownArea = { explored: undefined, vision: [retangulo(0, 0, 1000, 1000)], concealed: [] }
/** O jogador só vê o lado do Chão: o destino de fora fica no escuro. */
const VE_SO_O_CHAO: KnownArea = { explored: undefined, vision: [retangulo(0, 0, 500, 1000)], concealed: [] }

describe('clique fora do Chão em cena bloqueada', () => {
  it('destino à vista e fora do Chão: o aviso é "Fora do chão" (campo ausente e bloqueado); cena livre anda', () => {
    for (const mapa of [cena(), cena({ offFloor: 'blocked' })]) {
      const plano = planejarCaminhada(mapa, HEROI, LA_FORA, VE_TUDO)
      expect(plano).toEqual({ tipo: 'aviso', motivo: 'outside_floor' })
      if (plano.tipo === 'aviso') expect(latestActionNotice(undefined, { id: 1, reason: plano.motivo })?.text).toBe('Fora do chão')
    }
    expect(planejarCaminhada(cena({ offFloor: 'free' }), HEROI, LA_FORA, VE_TUDO).tipo).toBe('andar')
  })

  it('destino no escuro ou em zona oculta: o aviso continua "Você não conhece o caminho" (não conta onde o Chão acaba)', () => {
    const desconhecido = { tipo: 'aviso', motivo: 'caminho_desconhecido' }
    expect(planejarCaminhada(cena(), HEROI, LA_FORA, VE_SO_O_CHAO)).toEqual(desconhecido)
    const comZonaOculta: KnownArea = { ...VE_TUDO, concealed: [retangulo(700, 100, 900, 300)] }
    expect(planejarCaminhada(cena(), HEROI, LA_FORA, comZonaOculta)).toEqual(desconhecido)
    // No Chão, mas no escuro: a frase de sempre.
    expect(planejarCaminhada(cena(), HEROI, { x: 200, y: 800 }, { ...VE_TUDO, vision: [retangulo(0, 0, 500, 400)] })).toEqual(desconhecido)
  })
})
