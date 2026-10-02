/**
 * ROTINA ANDANDO: ligada, a ficha anda sozinha de posto em posto, um passo
 * curto por vez, e recomeça do primeiro depois do último — até o mestre
 * desligar. Aqui só o agendador puro: quem anda, para onde, e quando.
 */
import { describe, expect, it } from 'vitest'
import type { EstadoDoMundo } from './estadoDoMundo'
import { findTokenPath, segmentsIntersect } from './collision'
import { createEmptyMap } from './mapFactory'
import { ESPERA_NO_POSTO_MS, PASSO_DA_ROTINA_MS, TENTAR_DE_NOVO_MS, darPassoDaRotina, desligarRotina, ligarRotina, passoEmPx, type RotinasAndando } from './rotinaAndando'
import { moverNaCena, type CenaDaRotina } from './rotinaDoNpc'
import type { MapData, Token, Wall } from '../types/map'

const APITO: EstadoDoMundo = { id: 'apito', nome: 'Apito', valores: ['Aurora', 'Meio', 'Brasa'], atual: 'Aurora' }
const ESTADOS = [APITO]
const GRID = 50
const PASSO = passoEmPx(GRID)

function tobias(x: number, y: number, postos: Token['rotina']): Token {
  return { id: 'tobias', characterId: null, name: 'Irmão Tobias', x, y, size: 1, image: null, npc: true, rotina: postos }
}

function mapa(id: string, tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap(id, id, 30, 10, GRID), tokens, walls }
}

/** Capela com o Tobias em (100, 100): Aurora ali mesmo, Meio 4 casas à direita. */
function capela(): CenaDaRotina[] {
  const rotina = {
    estadoId: 'apito',
    postos: [
      { valor: 'Meio', sceneId: 'capela', x: 300, y: 100 },
      { valor: 'Aurora', sceneId: 'capela', x: 100, y: 100 },
    ],
  }
  return [{ sceneId: 'capela', map: mapa('capela', [tobias(100, 100, rotina)]) }]
}

/** Um tique do relógio: planeja, aplica nas cenas (mesma cena só) e devolve tudo. */
function tique(cenas: CenaDaRotina[], andando: RotinasAndando, now: number, fixas?: ReadonlySet<string>) {
  const passo = darPassoDaRotina(cenas, andando, ESTADOS, now, fixas)
  const depois = cenas.map((c) => ({ sceneId: c.sceneId, map: moverNaCena(c.map, passo.movimentos) }))
  return { ...passo, cenas: depois }
}

function ondeEsta(cenas: CenaDaRotina[]): { cena: string; x: number; y: number } | undefined {
  for (const c of cenas) {
    const t = c.map.tokens.find((token) => token.id === 'tobias')
    if (t !== undefined) return { cena: c.sceneId, x: t.x, y: t.y }
  }
  return undefined
}

/** Roda `n` tiques seguidos a partir de `inicio` e anota onde o Tobias passou. */
function rodar(cenas: CenaDaRotina[], andando: RotinasAndando, inicio: number, n: number) {
  const trilha: Array<{ x: number; y: number }> = []
  let estado = { cenas, andando }
  for (let i = 0; i < n; i += 1) {
    const r = tique(estado.cenas, estado.andando, inicio + i * PASSO_DA_ROTINA_MS)
    estado = { cenas: r.cenas, andando: r.andando }
    const at = ondeEsta(r.cenas)
    if (at !== undefined) trilha.push({ x: at.x, y: at.y })
  }
  return { ...estado, trilha }
}

describe('agendador da rotina: liga', () => {
  it('ligada, a ficha sai do posto em que está rumo ao próximo turno, um passo curto por tique', () => {
    const cenas = capela()
    const andando = ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0)
    expect(andando.has('tobias')).toBe(true)
    const r = tique(cenas, andando, 0)
    // Está no posto da Aurora; o próximo turno do apito é o Meio, à direita.
    expect(r.movimentos).toEqual([{ tokenId: 'tobias', de: 'capela', para: 'capela', x: 100 + PASSO, y: 100 }])
  })

  it('o passo é curto: menos de uma casa por tique, e o tique é curto', () => {
    expect(PASSO).toBeGreaterThan(0)
    expect(PASSO).toBeLessThan(GRID)
    expect(PASSO_DA_ROTINA_MS).toBeLessThanOrEqual(250)
  })

  it('sem o mestre fazer nada, chega ao posto e para lá (não passa do ponto)', () => {
    const cenas = capela()
    const passos = Math.ceil(200 / PASSO)
    const r = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, passos)
    expect(r.trilha.at(-1)).toEqual({ x: 300, y: 100 })
    // Cada tique anda no máximo um passo, em linha reta, sempre para a frente.
    let antes = 100
    for (const p of r.trilha) {
      expect(p.y).toBe(100)
      expect(p.x - antes).toBeGreaterThan(0)
      expect(p.x - antes).toBeLessThanOrEqual(PASSO)
      antes = p.x
    }
  })

  it('ficha sem posto nenhum não liga', () => {
    const cenas = [{ sceneId: 'capela', map: mapa('capela', [tobias(100, 100, { estadoId: 'apito', postos: [] })]) }]
    expect(ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0).size).toBe(0)
    expect(ligarRotina(new Map(), cenas, 'ninguem', ESTADOS, 0).size).toBe(0)
  })

  it('ficha que um jogador segura não anda, mas a rotina continua ligada', () => {
    const cenas = capela()
    const r = tique(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, new Set(['tobias']))
    expect(r.movimentos).toEqual([])
    expect(r.andando.has('tobias')).toBe(true)
  })
})

describe('agendador da rotina: loop', () => {
  it('posto fora do pixel inteiro (grade hexagonal, casa de tamanho ímpar): chega exato, na linha, espera e volta', () => {
    // Grade de 45 px: o centro da casa é 22,5. O posto guarda o x/y cru da ficha.
    const rotina = {
      estadoId: 'apito',
      postos: [
        { valor: 'Meio', sceneId: 'capela', x: 292.5, y: 22.5 },
        { valor: 'Aurora', sceneId: 'capela', x: 22.5, y: 22.5 },
      ],
    }
    const cenas = [{ sceneId: 'capela', map: mapa('capela', [tobias(22.5, 22.5, rotina)]) }]
    const ida = Math.ceil(270 / PASSO)
    const chegou = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, ida)
    expect(ondeEsta(chegou.cenas)).toEqual({ cena: 'capela', x: 292.5, y: 22.5 })
    // Em linha reta na fileira: nada de meio pixel para fora do centro da casa.
    expect(chegou.trilha.every((p) => p.y === 22.5)).toBe(true)

    const chegada = (ida - 1) * PASSO_DA_ROTINA_MS
    const volta = rodar(chegou.cenas, chegou.andando, chegada + ESPERA_NO_POSTO_MS, ida)
    expect(volta.trilha.at(-1)).toEqual({ x: 22.5, y: 22.5 })
  })

  it('no posto, espera um pouco e segue para o próximo turno; depois do último, volta ao primeiro', () => {
    const cenas = capela()
    const ida = Math.ceil(200 / PASSO)
    const chegou = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, ida)
    expect(ondeEsta(chegou.cenas)).toEqual({ cena: 'capela', x: 300, y: 100 })
    const chegada = (ida - 1) * PASSO_DA_ROTINA_MS

    // Parado no posto do Meio durante a espera.
    const parado = tique(chegou.cenas, chegou.andando, chegada + ESPERA_NO_POSTO_MS - 1)
    expect(parado.movimentos).toEqual([])

    // Acabou a espera: o Meio é o último turno com posto antes da Brasa (sem posto),
    // então a volta é para a Aurora, o primeiro — o loop.
    const volta = rodar(chegou.cenas, chegou.andando, chegada + ESPERA_NO_POSTO_MS, ida)
    expect(volta.trilha[0]).toEqual({ x: 300 - PASSO, y: 100 })
    expect(volta.trilha.at(-1)).toEqual({ x: 100, y: 100 })

    // E de novo para o Meio: o loop não acaba sozinho.
    const outraChegada = chegada + ESPERA_NO_POSTO_MS + (ida - 1) * PASSO_DA_ROTINA_MS
    const deNovo = tique(volta.cenas, volta.andando, outraChegada + ESPERA_NO_POSTO_MS)
    expect(deNovo.movimentos).toEqual([{ tokenId: 'tobias', de: 'capela', para: 'capela', x: 100 + PASSO, y: 100 }])
  })

  it('a ordem do loop é a do estado (Aurora, Meio, Brasa), não a ordem em que os postos foram gravados', () => {
    const rotina = {
      estadoId: 'apito',
      postos: [
        { valor: 'Brasa', sceneId: 'capela', x: 100, y: 300 },
        { valor: 'Aurora', sceneId: 'capela', x: 100, y: 100 },
        { valor: 'Meio', sceneId: 'capela', x: 300, y: 100 },
      ],
    }
    const cenas = [{ sceneId: 'capela', map: mapa('capela', [tobias(100, 100, rotina)]) }]
    const r = tique(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0)
    // Na Aurora, o próximo é o Meio (direita), e não a Brasa (embaixo).
    expect(r.movimentos[0]).toEqual(expect.objectContaining({ x: 100 + PASSO, y: 100 }))
  })

  it('porta aberta no caminho: passa pelo vão em vez de atravessar a parede', () => {
    // Parede vertical em x=200 de y=0 a y=500, com porta aberta de y=250 a y=350.
    // A linha reta entre os postos (y=380) bate na parede logo abaixo do vão.
    const walls: Wall[] = [
      { id: 'w1', x1: 200, y1: 0, x2: 200, y2: 250, blocksLight: true, blocksMove: true, door: null },
      { id: 'porta', x1: 200, y1: 250, x2: 200, y2: 350, blocksLight: true, blocksMove: true, door: { open: true, locked: false, kind: 'normal' } },
      { id: 'w2', x1: 200, y1: 350, x2: 200, y2: 500, blocksLight: true, blocksMove: true, door: null },
    ]
    const rotina = {
      estadoId: 'apito',
      postos: [
        { valor: 'Aurora', sceneId: 'capela', x: 100, y: 380 },
        { valor: 'Meio', sceneId: 'capela', x: 300, y: 380 },
      ],
    }
    const cenas = [{ sceneId: 'capela', map: mapa('capela', [tobias(100, 380, rotina)], walls) }]
    const ida = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, 1)
    // Não pulou: o primeiro tique é um passo curto, não a chegada.
    expect(ida.trilha[0].x).toBeLessThan(200)
    const r = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, 20)
    expect(ondeEsta(r.cenas)).toEqual({ cena: 'capela', x: 300, y: 380 })
    // Cada passo é um traço reto que a colisão deixa passar (a mesma regra do
    // arrasto): o jogador desliza de um ponto ao outro em linha reta, então
    // nenhum passo pode dobrar a quina nem atravessar a parede.
    let antes = { x: 100, y: 380 }
    for (const p of r.trilha) {
      expect(findTokenPath(antes, p, walls, GRID)).toEqual([antes, p])
      antes = p
    }
  })
})

describe('agendador da rotina: desliga', () => {
  it('desligada no meio do caminho, a ficha para onde está e nada mais anda', () => {
    const cenas = capela()
    const meio = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, 2)
    const parou = ondeEsta(meio.cenas)
    const andando = desligarRotina(meio.andando, 'tobias')
    expect(andando.has('tobias')).toBe(false)
    const depois = rodar(meio.cenas, andando, 10_000, 5)
    expect(depois.trilha.every((p) => p.x === parou?.x && p.y === parou?.y)).toBe(true)
  })

  it('ficha apagada ou sem rotina desliga sozinha', () => {
    const cenas = capela()
    const andando = ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0)
    const semFicha = [{ sceneId: 'capela', map: mapa('capela', []) }]
    expect(tique(semFicha, andando, 0).andando.has('tobias')).toBe(false)
    const semRotina = [{ sceneId: 'capela', map: mapa('capela', [tobias(100, 100, undefined)]) }]
    expect(tique(semRotina, andando, 0).andando.has('tobias')).toBe(false)
  })
})

describe('agendador da rotina: cena trocada', () => {
  it('o mestre abriu outra cena: a ficha segue andando na cena de fundo', () => {
    const [cap] = capela()
    const conf = { sceneId: 'conf', map: mapa('conf', []) }
    const andando = ligarRotina(new Map(), [cap, conf], 'tobias', ESTADOS, 0)
    // A cena aberta agora é o Confessionário; a Capela está no fundo.
    const r = tique([conf, cap], andando, 0)
    expect(r.movimentos).toEqual([{ tokenId: 'tobias', de: 'capela', para: 'capela', x: 100 + PASSO, y: 100 }])
  })

  it('posto em outra cena: a ficha vai de uma vez para lá, espera e volta, em loop', () => {
    const rotina = {
      estadoId: 'apito',
      postos: [
        { valor: 'Aurora', sceneId: 'capela', x: 100, y: 100 },
        { valor: 'Meio', sceneId: 'conf', x: 400, y: 200 },
      ],
    }
    const cenas = [
      { sceneId: 'capela', map: mapa('capela', [tobias(100, 100, rotina)]) },
      { sceneId: 'conf', map: mapa('conf', []) },
    ]
    const andando = ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0)
    const ida = darPassoDaRotina(cenas, andando, ESTADOS, 0)
    expect(ida.movimentos).toEqual([{ tokenId: 'tobias', de: 'capela', para: 'conf', x: 400, y: 200 }])
    // A cena do outro lado aplica a travessia (no editor, `transferToken`).
    const lá = [
      { sceneId: 'capela', map: mapa('capela', []) },
      { sceneId: 'conf', map: mapa('conf', [tobias(400, 200, rotina)]) },
    ]
    expect(darPassoDaRotina(lá, ida.andando, ESTADOS, ESPERA_NO_POSTO_MS - 1).movimentos).toEqual([])
    const volta = darPassoDaRotina(lá, ida.andando, ESTADOS, ESPERA_NO_POSTO_MS)
    expect(volta.movimentos).toEqual([{ tokenId: 'tobias', de: 'conf', para: 'capela', x: 100, y: 100 }])
  })

  it('posto numa cena que não está carregada fica de fora do loop: a ficha não some de um mapa sem chegar em outro', () => {
    const rotina = {
      estadoId: 'apito',
      postos: [
        { valor: 'Aurora', sceneId: 'capela', x: 100, y: 100 },
        { valor: 'Meio', sceneId: 'porao-fora-do-ar', x: 400, y: 200 },
        { valor: 'Brasa', sceneId: 'capela', x: 300, y: 100 },
      ],
    }
    const cenas = [{ sceneId: 'capela', map: mapa('capela', [tobias(100, 100, rotina)]) }]
    const r = tique(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0)
    expect(r.movimentos).toEqual([{ tokenId: 'tobias', de: 'capela', para: 'capela', x: 100 + PASSO, y: 100 }])
  })
})

describe('agendador da rotina: desvia de parede e nunca teleporta', () => {
  const G = 64
  const PASSO_64 = passoEmPx(G)

  function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
    return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
  }

  /** Aurora em `de`, Meio em `para`, na mesma cena; o Tobias começa na Aurora. */
  function sala(walls: Wall[], de: { x: number; y: number }, para: { x: number; y: number }): CenaDaRotina[] {
    const rotina = {
      estadoId: 'apito',
      postos: [
        { valor: 'Aurora', sceneId: 'capela', x: de.x, y: de.y },
        { valor: 'Meio', sceneId: 'capela', x: para.x, y: para.y },
      ],
    }
    return [{ sceneId: 'capela', map: { ...createEmptyMap('capela', 'capela', 15, 10, G), walls, tokens: [tobias(de.x, de.y, rotina)] } }]
  }

  function comParedes(cenas: CenaDaRotina[], walls: Wall[]): CenaDaRotina[] {
    return cenas.map((c) => ({ ...c, map: { ...c.map, walls } }))
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

  it('parede sem porta entre dois postos: contorna casa a casa e chega, sem pulo', () => {
    const walls = [parede('w', 384, 128, 384, 320)]
    const cenas = sala(walls, { x: 224, y: 224 }, { x: 608, y: 224 })
    const r = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, 60)
    expect(r.trilha).toContainEqual({ x: 608, y: 224 })
    semPuloNemParede([{ x: 224, y: 224 }, ...r.trilha], walls)
  })

  it('porta fechada no único caminho: fica parada e tenta de novo; aberta a porta, segue', () => {
    const comPorta = (door: Wall['door']) => [parede('a', 384, 0, 384, 384), parede('porta', 384, 384, 384, 448, door), parede('b', 384, 448, 384, 640)]
    const fechada = comPorta({ open: false, locked: false, kind: 'normal' })
    const aberta = comPorta({ open: true, locked: false, kind: 'normal' })
    const cenas = sala(fechada, { x: 224, y: 96 }, { x: 608, y: 96 })
    const parada = darPassoDaRotina(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), ESTADOS, 0)
    expect(parada.movimentos).toEqual([])
    expect(parada.andando.get('tobias')?.esperaAte).toBe(TENTAR_DE_NOVO_MS)
    expect(darPassoDaRotina(cenas, parada.andando, ESTADOS, TENTAR_DE_NOVO_MS).movimentos).toEqual([])
    const r = rodar(comParedes(cenas, aberta), parada.andando, TENTAR_DE_NOVO_MS, 80)
    expect(r.trilha).toContainEqual({ x: 608, y: 96 })
    semPuloNemParede([{ x: 224, y: 96 }, ...r.trilha], aberta)
  })

  it('porta fecha no meio do caminho: a ficha para do lado de cá, sem atravessar', () => {
    const comPorta = (door: Wall['door']) => [parede('a', 384, 0, 384, 384), parede('porta', 384, 384, 384, 448, door), parede('b', 384, 448, 384, 640)]
    const fechada = comPorta({ open: false, locked: false, kind: 'normal' })
    const cenas = sala(comPorta({ open: true, locked: false, kind: 'normal' }), { x: 224, y: 96 }, { x: 608, y: 96 })
    const ida = rodar(cenas, ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0), 0, 3)
    const r = rodar(comParedes(ida.cenas, fechada), ida.andando, 3 * PASSO_DA_ROTINA_MS, 60)
    expect(r.trilha.every((p) => p.x < 384)).toBe(true)
    semPuloNemParede(r.trilha, fechada)
  })
})
