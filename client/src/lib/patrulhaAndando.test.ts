/**
 * PATRULHA ANDANDO: ligada, a ficha anda sozinha pela rota de patrulha, casa a
 * casa, espera um pouco em cada ponto e segue — em circuito (1-2-3-1) ou em
 * vai-e-volta (1-2-3-2-1). Aqui só o agendador puro: quem anda, para onde e
 * quando. Aplicar é do editor (`stores/patrulhaAndandoStore.ts`).
 */
import { describe, expect, it } from 'vitest'
import { findTokenPath, segmentsIntersect } from './collision'
import { createEmptyMap } from './mapFactory'
import {
  adiarEsperas,
  darPassoDaPatrulha,
  desligarPatrulha,
  ESPERA_NO_PONTO_MS,
  ligarPatrulha,
  moverPatrulhas,
  PASSO_DA_PATRULHA_MS,
  proximoPonto,
  TENTAR_DE_NOVO_MS,
  type PatrulhasAndando,
} from './patrulhaAndando'
import { passoEmPx } from './rotinaAndando'
import type { MapData, Token, TokenPatrol, Wall } from '../types/map'

const GRID = 50

/** Três pontos em L: (100,100) → (300,100) → (300,300). */
const RONDA: TokenPatrol = {
  pontos: [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
  ],
  atual: 0,
}

/** `null` = ficha sem rota. */
function guarda(x: number, y: number, patrulha: TokenPatrol | null = RONDA): Token {
  return { id: 'guarda', characterId: null, name: 'Guarda', x, y, size: 1, image: null, npc: true, ...(patrulha === null ? {} : { patrulha }) }
}

function mesa(tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('m', 'M', 30, 30, GRID), tokens, walls }
}

function ondeEsta(map: MapData): { x: number; y: number; atual: number | undefined } {
  const t = map.tokens.find((token) => token.id === 'guarda')
  if (t === undefined) throw new Error('sem o guarda')
  return { x: t.x, y: t.y, atual: t.patrulha?.atual }
}

/** Um tique: planeja e aplica no mapa, como o store faz. */
function tique(map: MapData, andando: PatrulhasAndando, now: number, paradas?: ReadonlySet<string>) {
  const passo = darPassoDaPatrulha(map, andando, now, paradas)
  return { ...passo, map: moverPatrulhas(map, passo.movimentos) }
}

/** Roda até a ficha chegar a `n` pontos; devolve a sequência de `atual` em cada chegada e a trilha. */
function rodarAteChegadas(map: MapData, andando: PatrulhasAndando, n: number, limite = 2000) {
  const chegadas: number[] = []
  const trilha: Array<{ x: number; y: number }> = [ondeEsta(map)]
  let estado = { map, andando }
  for (let i = 0; i < limite && chegadas.length < n; i += 1) {
    const r = tique(estado.map, estado.andando, i * PASSO_DA_PATRULHA_MS)
    for (const m of r.movimentos) if (m.atual !== undefined) chegadas.push(m.atual)
    estado = { map: r.map, andando: r.andando }
    const agora = ondeEsta(r.map)
    const antes = trilha[trilha.length - 1]
    if (antes === undefined || antes.x !== agora.x || antes.y !== agora.y) trilha.push(agora)
  }
  return { chegadas, trilha, ...estado }
}

describe('proximoPonto — a ordem da ronda', () => {
  it('circuito: do último volta ao primeiro (1-2-3-1)', () => {
    expect(proximoPonto(0, 1, 3, 'circuito')).toEqual({ indice: 1, sentido: 1 })
    expect(proximoPonto(1, 1, 3, 'circuito')).toEqual({ indice: 2, sentido: 1 })
    expect(proximoPonto(2, 1, 3, 'circuito')).toEqual({ indice: 0, sentido: 1 })
  })

  it('vai-e-volta: bate na ponta e volta pelo mesmo caminho (1-2-3-2-1)', () => {
    expect(proximoPonto(1, 1, 3, 'vai-e-volta')).toEqual({ indice: 2, sentido: 1 })
    expect(proximoPonto(2, 1, 3, 'vai-e-volta')).toEqual({ indice: 1, sentido: -1 })
    expect(proximoPonto(1, -1, 3, 'vai-e-volta')).toEqual({ indice: 0, sentido: -1 })
    expect(proximoPonto(0, -1, 3, 'vai-e-volta')).toEqual({ indice: 1, sentido: 1 })
  })

  it('vai-e-volta com dois pontos é ida e volta entre eles', () => {
    expect(proximoPonto(0, 1, 2, 'vai-e-volta')).toEqual({ indice: 1, sentido: 1 })
    expect(proximoPonto(1, 1, 2, 'vai-e-volta')).toEqual({ indice: 0, sentido: -1 })
    expect(proximoPonto(0, -1, 2, 'vai-e-volta')).toEqual({ indice: 1, sentido: 1 })
  })
})

describe('ligarPatrulha / desligarPatrulha', () => {
  it('no ponto atual, sai rumo ao seguinte', () => {
    const andando = ligarPatrulha(new Map(), mesa([guarda(100, 100)]), 'guarda', 0)
    expect(andando.get('guarda')).toEqual({ destino: 1, sentido: 1, esperaAte: 0 })
  })

  it('em cima de outro ponto da rota, segue a partir dele', () => {
    const andando = ligarPatrulha(new Map(), mesa([guarda(300, 100)]), 'guarda', 0)
    expect(andando.get('guarda')?.destino).toBe(2)
  })

  it('fora da rota (o mestre a arrastou), volta primeiro ao ponto onde parou', () => {
    const andando = ligarPatrulha(new Map(), mesa([guarda(700, 700, { ...RONDA, atual: 1 })]), 'guarda', 0)
    expect(andando.get('guarda')?.destino).toBe(1)
  })

  it('sem rota, com um ponto só, ou ficha que não existe: não liga', () => {
    const vazio: PatrulhasAndando = new Map()
    expect(ligarPatrulha(vazio, mesa([guarda(100, 100, null)]), 'guarda', 0)).toBe(vazio)
    expect(ligarPatrulha(vazio, mesa([guarda(100, 100, { pontos: [{ x: 100, y: 100 }], atual: 0 })]), 'guarda', 0)).toBe(vazio)
    expect(ligarPatrulha(vazio, mesa([guarda(100, 100)]), 'outro', 0)).toBe(vazio)
  })

  it('desligar tira a ficha; desligar quem não anda devolve o mesmo', () => {
    const andando = ligarPatrulha(new Map(), mesa([guarda(100, 100)]), 'guarda', 0)
    expect(desligarPatrulha(andando, 'guarda').has('guarda')).toBe(false)
    const vazio: PatrulhasAndando = new Map()
    expect(desligarPatrulha(vazio, 'guarda')).toBe(vazio)
  })
})

describe('darPassoDaPatrulha — anda casa a casa', () => {
  it('cada tique anda um passo curto (2 casas/s por padrão), sem teleportar', () => {
    const map = mesa([guarda(100, 100)])
    const andando = ligarPatrulha(new Map(), map, 'guarda', 0)
    const r = tique(map, andando, 0)
    expect(ondeEsta(r.map)).toMatchObject({ x: 100 + passoEmPx(GRID, 2), y: 100 })
    expect(r.movimentos[0]?.atual).toBeUndefined()
  })

  it('a velocidade da rota muda o tamanho do passo', () => {
    const map = mesa([guarda(100, 100, { ...RONDA, velocidade: 4 })])
    const r = tique(map, ligarPatrulha(new Map(), map, 'guarda', 0), 0)
    expect(ondeEsta(r.map).x).toBe(100 + passoEmPx(GRID, 4))
    expect(passoEmPx(GRID, 4)).toBe(2 * passoEmPx(GRID, 2))
  })

  it('ao chegar, marca o ponto como atual e espera antes de seguir', () => {
    const map = mesa([guarda(100, 100)])
    const r = rodarAteChegadas(map, ligarPatrulha(new Map(), map, 'guarda', 0), 1)
    expect(r.chegadas).toEqual([1])
    expect(ondeEsta(r.map)).toEqual({ x: 300, y: 100, atual: 1 })
    const ficha = r.andando.get('guarda')
    expect(ficha?.destino).toBe(2)
    // Esperando: um tique logo depois não mexe nela.
    const chegouEm = (ficha?.esperaAte ?? 0) - ESPERA_NO_PONTO_MS
    const parado = darPassoDaPatrulha(r.map, r.andando, chegouEm + ESPERA_NO_PONTO_MS - 1)
    expect(parado.movimentos).toEqual([])
    expect(parado.andando.get('guarda')).toEqual(ficha)
    // Passada a espera, volta a andar rumo ao ponto 3.
    const seguiu = darPassoDaPatrulha(r.map, r.andando, chegouEm + ESPERA_NO_PONTO_MS)
    expect(seguiu.movimentos[0]).toMatchObject({ tokenId: 'guarda', x: 300, y: 100 + passoEmPx(GRID, 2) })
  })

  it('circuito: a ordem das chegadas é 2, 3, 1, 2', () => {
    const map = mesa([guarda(100, 100)])
    expect(rodarAteChegadas(map, ligarPatrulha(new Map(), map, 'guarda', 0), 4).chegadas).toEqual([1, 2, 0, 1])
  })

  it('vai-e-volta: a ordem das chegadas é 2, 3, 2, 1, 2', () => {
    const map = mesa([guarda(100, 100, { ...RONDA, modo: 'vai-e-volta' })])
    expect(rodarAteChegadas(map, ligarPatrulha(new Map(), map, 'guarda', 0), 5).chegadas).toEqual([1, 2, 1, 0, 1])
  })

  it('desvia da parede passando pela porta aberta, sem atravessar parede em nenhum passo', () => {
    // Parede em x=200 com porta aberta de y=250 a y=350; os dois pontos ficam em
    // lados opostos, e a linha reta entre eles (y=380) bate na parede logo abaixo do vão.
    const walls: Wall[] = [
      { id: 'w1', x1: 200, y1: 0, x2: 200, y2: 250, blocksLight: true, blocksMove: true, door: null },
      { id: 'porta', x1: 200, y1: 250, x2: 200, y2: 350, blocksLight: true, blocksMove: true, door: { open: true, locked: false, kind: 'normal' } },
      { id: 'w2', x1: 200, y1: 350, x2: 200, y2: 1500, blocksLight: true, blocksMove: true, door: null },
    ]
    const rota: TokenPatrol = { pontos: [{ x: 100, y: 380 }, { x: 300, y: 380 }], atual: 0 }
    const map = mesa([guarda(100, 380, rota)], walls)
    const r = rodarAteChegadas(map, ligarPatrulha(new Map(), map, 'guarda', 0), 1)
    expect(r.chegadas).toEqual([1])
    expect(r.trilha.length).toBeGreaterThan(4)
    for (let i = 1; i < r.trilha.length; i += 1) {
      const de = r.trilha[i - 1]
      const para = r.trilha[i]
      if (de === undefined || para === undefined) continue
      expect(findTokenPath(de, para, walls, GRID)).toHaveLength(2)
    }
  })

  it('ficha parada (segurada por jogador ou arrastada pelo mestre) não anda, mas segue ligada', () => {
    const map = mesa([guarda(100, 100)])
    const andando = ligarPatrulha(new Map(), map, 'guarda', 0)
    const r = darPassoDaPatrulha(map, andando, 0, new Set(['guarda']))
    expect(r.movimentos).toEqual([])
    expect(r.andando.get('guarda')).toEqual(andando.get('guarda'))
  })

  it('ficha removida, rota apagada ou com menos de 2 pontos: para', () => {
    const map = mesa([guarda(100, 100)])
    const andando = ligarPatrulha(new Map(), map, 'guarda', 0)
    expect(darPassoDaPatrulha(mesa([]), andando, 0).andando.size).toBe(0)
    expect(darPassoDaPatrulha(mesa([guarda(100, 100, null)]), andando, 0).andando.size).toBe(0)
    expect(darPassoDaPatrulha(mesa([guarda(100, 100, { pontos: [{ x: 1, y: 1 }], atual: 0 })]), andando, 0).andando.size).toBe(0)
  })

  it('rota encurtada enquanto anda: o destino volta para dentro dela', () => {
    const map = mesa([guarda(100, 100, { pontos: [{ x: 100, y: 100 }, { x: 300, y: 100 }], atual: 0 })])
    const andando: PatrulhasAndando = new Map([['guarda', { destino: 2, sentido: 1, esperaAte: 0 }]])
    const r = darPassoDaPatrulha(map, andando, 0)
    expect(r.movimentos[0]).toMatchObject({ x: 100 + passoEmPx(GRID, 2), y: 100 })
  })

  it('a espera de cada ponto vem de fora quando pedida (porta para a macro por ponto)', () => {
    const map = mesa([guarda(300, 100)])
    const andando: PatrulhasAndando = new Map([['guarda', { destino: 1, sentido: 1, esperaAte: 0 }]])
    const pedidas: number[] = []
    const r = darPassoDaPatrulha(map, andando, 1000, new Set(), (_rota, indice) => {
      pedidas.push(indice)
      return 5000
    })
    expect(pedidas).toEqual([1])
    expect(r.andando.get('guarda')).toEqual({ destino: 2, sentido: 1, esperaAte: 6000 })
  })
})

describe('moverPatrulhas — o passo aplicado ao mapa', () => {
  it('leva a ficha e grava o ponto atual na chegada, sem perder a configuração', () => {
    const map = mesa([guarda(100, 100, { ...RONDA, velocidade: 3, modo: 'vai-e-volta' })])
    const depois = moverPatrulhas(map, [{ tokenId: 'guarda', x: 300, y: 100, atual: 1 }])
    const t = depois.tokens[0]
    expect(t).toMatchObject({ x: 300, y: 100 })
    expect(t?.patrulha).toEqual({ ...RONDA, velocidade: 3, modo: 'vai-e-volta', atual: 1 })
  })

  it('nada a mudar: o MESMO mapa (contrato de applyPlayerChange)', () => {
    const map = mesa([guarda(100, 100)])
    expect(moverPatrulhas(map, [])).toBe(map)
    expect(moverPatrulhas(map, [{ tokenId: 'guarda', x: 100, y: 100 }])).toBe(map)
    expect(moverPatrulhas(map, [{ tokenId: 'sumiu', x: 1, y: 1 }])).toBe(map)
  })

  it('ponto que não existe mais na versão do mapa: só move, não grava atual fora da rota', () => {
    const map = mesa([guarda(100, 100, { pontos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], atual: 0 })])
    const depois = moverPatrulhas(map, [{ tokenId: 'guarda', x: 300, y: 300, atual: 5 }])
    expect(depois.tokens[0]?.patrulha?.atual).toBe(0)
    expect(depois.tokens[0]).toMatchObject({ x: 300, y: 300 })
  })
})

describe('darPassoDaPatrulha — desvia de parede e nunca teleporta', () => {
  const G = 64
  const PASSO_64 = passoEmPx(G, 2)

  function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
    return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
  }

  function sala(walls: Wall[], rota: TokenPatrol, x: number, y: number): MapData {
    return { ...createEmptyMap('s', 'S', 15, 10, G), walls, tokens: [guarda(x, y, rota)] }
  }

  /** Roda `n` tiques a partir de `inicio`; devolve a trilha de posições (uma por tique) e o estado final. */
  function rodar(map: MapData, andando: PatrulhasAndando, inicio: number, n: number) {
    const trilha = [ondeEsta(map)]
    let estado = { map, andando }
    for (let i = 0; i < n; i += 1) {
      const r = tique(estado.map, estado.andando, inicio + i * PASSO_DA_PATRULHA_MS)
      estado = { map: r.map, andando: r.andando }
      trilha.push(ondeEsta(r.map))
    }
    return { trilha, ...estado }
  }

  function semPuloNemParede(trilha: ReadonlyArray<{ x: number; y: number }>, walls: readonly Wall[]) {
    for (let i = 1; i < trilha.length; i += 1) {
      const de = trilha[i - 1]
      const para = trilha[i]
      if (de === undefined || para === undefined) continue
      expect(Math.hypot(para.x - de.x, para.y - de.y)).toBeLessThanOrEqual(PASSO_64 + 1e-9)
      for (const w of walls) {
        if (w.door !== null && w.door.open && !w.door.locked) continue
        expect(segmentsIntersect(de, para, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })).toBe(false)
      }
    }
  }

  it('parede sem porta entre dois pontos: contorna casa a casa e chega, sem pulo', () => {
    // O caso do navegador: parede x=384 de y=128 a y=320, pontos (224,224) e (608,224), grade 64.
    const walls = [parede('w', 384, 128, 384, 320)]
    const rota: TokenPatrol = { pontos: [{ x: 224, y: 224 }, { x: 608, y: 224 }], atual: 0 }
    const map = sala(walls, rota, 224, 224)
    const r = rodar(map, ligarPatrulha(new Map(), map, 'guarda', 0), 0, 60)
    expect(r.trilha.some((p) => p.x === 608 && p.y === 224 && p.atual === 1)).toBe(true)
    semPuloNemParede(r.trilha, walls)
  })

  it('porta fechada no único caminho: fica parada e tenta de novo; aberta a porta, segue', () => {
    const fechada = { open: false, locked: false, kind: 'normal' as const }
    const aberta = { open: true, locked: false, kind: 'normal' as const }
    const comPorta = (door: Wall['door']) => [parede('a', 384, 0, 384, 384), parede('porta', 384, 384, 384, 448, door), parede('b', 384, 448, 384, 640)]
    const rota: TokenPatrol = { pontos: [{ x: 224, y: 96 }, { x: 608, y: 96 }], atual: 0 }
    const map = sala(comPorta(fechada), rota, 224, 96)
    const andando = ligarPatrulha(new Map(), map, 'guarda', 0)
    expect(andando.has('guarda')).toBe(true)
    const parada = darPassoDaPatrulha(map, andando, 0)
    expect(parada.movimentos).toEqual([])
    expect(parada.andando.get('guarda')?.esperaAte).toBe(TENTAR_DE_NOVO_MS)
    // Antes de 1 s nem procura de novo; depois, ainda fechada, continua parada.
    expect(darPassoDaPatrulha(map, parada.andando, TENTAR_DE_NOVO_MS - 1).andando.get('guarda')).toEqual(parada.andando.get('guarda'))
    expect(darPassoDaPatrulha(map, parada.andando, TENTAR_DE_NOVO_MS).movimentos).toEqual([])
    // O mestre abre a porta: ela sai andando, sem pulo, e chega.
    const abriu = { ...map, walls: comPorta(aberta) }
    const r = rodar(abriu, parada.andando, TENTAR_DE_NOVO_MS, 80)
    expect(r.trilha.some((p) => p.x === 608 && p.y === 96)).toBe(true)
    semPuloNemParede(r.trilha, comPorta(aberta))
  })

  it('porta fecha no meio do caminho: a ficha para do lado de cá, sem atravessar', () => {
    const aberta = { open: true, locked: false, kind: 'normal' as const }
    const fechada = { open: false, locked: false, kind: 'normal' as const }
    const comPorta = (door: Wall['door']) => [parede('a', 384, 0, 384, 384), parede('porta', 384, 384, 384, 448, door), parede('b', 384, 448, 384, 640)]
    const rota: TokenPatrol = { pontos: [{ x: 224, y: 96 }, { x: 608, y: 96 }], atual: 0 }
    const map = sala(comPorta(aberta), rota, 224, 96)
    const ida = rodar(map, ligarPatrulha(new Map(), map, 'guarda', 0), 0, 3)
    expect(ondeEsta(ida.map).x).toBeLessThan(384)
    const fechou = { ...ida.map, walls: comPorta(fechada) }
    const r = rodar(fechou, ida.andando, 3 * PASSO_DA_PATRULHA_MS, 60)
    expect(r.trilha.every((p) => p.x < 384)).toBe(true)
    semPuloNemParede(r.trilha, comPorta(fechada))
  })
})

describe('adiarEsperas — retomar depois da pausa', () => {
  it('empurra cada espera pelo tempo pausado', () => {
    const andando: PatrulhasAndando = new Map([['guarda', { destino: 1, sentido: 1, esperaAte: 1000 }]])
    expect(adiarEsperas(andando, 500).get('guarda')?.esperaAte).toBe(1500)
  })

  it('sem tempo pausado ou sem ninguém: o mesmo mapa', () => {
    const andando: PatrulhasAndando = new Map([['guarda', { destino: 1, sentido: 1, esperaAte: 1000 }]])
    expect(adiarEsperas(andando, 0)).toBe(andando)
    const vazio: PatrulhasAndando = new Map()
    expect(adiarEsperas(vazio, 500)).toBe(vazio)
  })
})
