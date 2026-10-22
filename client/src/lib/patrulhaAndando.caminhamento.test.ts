/**
 * PATRULHA PELO MOTOR DE CAMINHOS, em várias velocidades: de meia casa a 8
 * casas por segundo, o guarda atravessa a porta (abre diante dele e fecha
 * atrás, uma vez cada), contorna a ficha parada no meio do caminho e chega ao
 * ponto, sem nunca andar num tique mais que a velocidade dele permite (sem
 * teleporte) e sem cruzar parede. A porta que ele mexe é a do mapa: a vigia
 * de outro guarda enxerga por ela enquanto está aberta.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenPatrol, Wall } from '../types/map'
import { comPortasDoNpc, type MudancaDePorta } from './caminhamento/tiqueDosNpcs'
import { segmentsIntersect, wallBlocksToken } from './collision'
import { createEmptyMap } from './mapFactory'
import { guardSightings } from './npcWatch'
import { darPassoDaPatrulha, ligarPatrulha, moverPatrulhas, PASSO_DA_PATRULHA_MS, type PatrulhasAndando } from './patrulhaAndando'
import { passoEmPx } from './rotinaAndando'

const G = 50
const VELOCIDADES = [0.5, 1, 2, 4, 8]

/** Parede em x = 300 com a porta no vão y 50..150; o barril parado em (450,100), na reta do guarda. */
function mesa(velocidade: number): MapData {
  const porta = { open: false, locked: false, kind: 'normal' } as const
  const walls: Wall[] = [
    { id: 'p-norte', x1: 300, y1: 0, x2: 300, y2: 50, blocksLight: true, blocksMove: true, door: null },
    { id: 'porta', x1: 300, y1: 50, x2: 300, y2: 150, blocksLight: true, blocksMove: true, door: porta },
    { id: 'p-sul', x1: 300, y1: 150, x2: 300, y2: 1000, blocksLight: true, blocksMove: true, door: null },
  ]
  const rota: TokenPatrol = { pontos: [{ x: 100, y: 100 }, { x: 600, y: 100 }], atual: 0, velocidade }
  const guarda: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 100, y: 100, size: 1, image: null, npc: true, patrulha: rota }
  const barril: Token = { id: 'barril', characterId: null, name: 'Barril', x: 450, y: 100, size: 1, image: null }
  return { ...createEmptyMap('m', 'M', 20, 20, G), walls, tokens: [guarda, barril] }
}

function guarda(map: MapData): Token {
  const t = map.tokens.find((token) => token.id === 'guarda')
  if (t === undefined) throw new Error('sem o guarda')
  return t
}

describe('patrulha pelo motor, em cada velocidade', () => {
  for (const velocidade of VELOCIDADES) {
    it(`${velocidade} casa(s)/s: atravessa a porta e contorna o barril sem pular, e chega`, () => {
      const passo = passoEmPx(G, velocidade)
      let map = mesa(velocidade)
      let andando: PatrulhasAndando = ligarPatrulha(new Map(), map, 'guarda', 0)
      const portas: MudancaDePorta[] = []
      const erros: string[] = []
      const maxTiques = Math.ceil((4 * 600) / passo) + 50
      let chegou = false
      for (let i = 0; i < maxTiques && !chegou; i += 1) {
        const antes = guarda(map)
        const r = darPassoDaPatrulha(map, andando, i * PASSO_DA_PATRULHA_MS)
        const depoisDoPasso = comPortasDoNpc(moverPatrulhas(map, r.movimentos), r.portas)
        const depois = guarda(depoisDoPasso)
        if (Math.hypot(depois.x - antes.x, depois.y - antes.y) > passo + 1e-9) erros.push(`tique ${i}: pulou`)
        for (const w of map.walls) if (wallBlocksToken(w) && segmentsIntersect(antes, depois, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) erros.push(`tique ${i}: cruzou ${w.id}`)
        portas.push(...r.portas)
        chegou = r.movimentos.some((m) => m.atual === 1)
        map = depoisDoPasso
        andando = r.andando
      }
      expect(erros).toEqual([])
      expect(chegou).toBe(true)
      expect(guarda(map)).toMatchObject({ x: 600, y: 100 })
      expect(portas).toEqual([
        { wallId: 'porta', aberta: true },
        { wallId: 'porta', aberta: false },
      ])
      expect(map.tokens.find((t) => t.id === 'barril')).toMatchObject({ x: 450, y: 100 })
      expect(andando.get('guarda')?.aviso).toBeUndefined()
    })
  }
})

describe('vigia e a porta que o NPC mexe', () => {
  it('a sentinela vê o herói do outro lado só enquanto a porta que o guarda abriu está aberta; fechada atrás dele, corta de novo', () => {
    const sentinela: Token = { id: 'sentinela', characterId: null, name: 'Sentinela', x: 100, y: 100, size: 1, image: null, npc: true, vigia: { direcao: 0, abertura: 60, alcance: 12 } }
    const heroi: Token = { id: 'heroi', characterId: 'pc-heroi', name: 'Herói', x: 550, y: 100, size: 1, image: null }
    const base = mesa(2)
    const rota: TokenPatrol = { pontos: [{ x: 200, y: 250 }, { x: 450, y: 250 }], atual: 0 }
    const patrulheiro = { ...guarda(base), x: 200, y: 250, patrulha: rota }
    let map: MapData = { ...base, tokens: [patrulheiro, sentinela, heroi] }
    let andando: PatrulhasAndando = ligarPatrulha(new Map(), map, 'guarda', 0)
    const alvos = new Set(['heroi'])
    const viu: boolean[] = []
    let chegou = false
    for (let i = 0; i < 200 && !chegou; i += 1) {
      const r = darPassoDaPatrulha(map, andando, i * PASSO_DA_PATRULHA_MS)
      map = comPortasDoNpc(moverPatrulhas(map, r.movimentos), r.portas)
      andando = r.andando
      chegou = r.movimentos.some((m) => m.atual === 1)
      const aberta = map.walls.find((w) => w.id === 'porta')?.door?.open === true
      const vendo = guardSightings(map, alvos).some((s) => s.guardId === 'sentinela')
      expect(vendo, `tique ${i}`).toBe(aberta)
      viu.push(vendo)
    }
    expect(chegou).toBe(true)
    expect(viu.some((v) => v)).toBe(true)
    expect(viu[viu.length - 1]).toBe(false)
  })
})
