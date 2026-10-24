/**
 * BLOCOS DO MODO BATALHA — o contrato da fatia B1 (docs/planos/modo-batalha-2026-10-24.md):
 * a diagonal custa 1 (5 diagonais = 5 blocos; 3 leste + 2 diagonais = 5), o
 * menor movimento em campo livre conta max(|dx|, |dy|), e a diagonal que
 * raspa a quina de uma parede é recusada (decisão 8) — o movimento dá a volta.
 */
import { describe, expect, it } from 'vitest'
import type { DoorState, Wall } from '../../types/map'
import { isDoorPassable } from '../collision'
import { GRID, inteiro, parede, porta, sorteador } from './batalha.fixture'
import {
  blocosDoCaminho,
  blocosEntre,
  type Casa,
  casaDoPonto,
  centroDaCasa,
  conferirPasso,
  type MapaDosBlocos,
  menorCaminhoEmBlocos,
  montarMapaDosBlocos,
  paredeBarraOPasso,
} from './blocos'

const c = (col: number, row: number): Casa => ({ col, row })
const campoLivre = (colunas: number, linhas: number): MapaDosBlocos => montarMapaDosBlocos([], GRID, colunas, linhas)
const SEM_LIMITE = Number.POSITIVE_INFINITY

/** Começa em `de`, termina em `para` e anda um bloco por passo. */
function caminhoDePassosUnitarios(caminho: readonly Casa[], de: Casa, para: Casa): boolean {
  const primeira = caminho[0]
  const ultima = caminho[caminho.length - 1]
  if (primeira === undefined || ultima === undefined) return false
  if (blocosEntre(primeira, de) !== 0 || blocosEntre(ultima, para) !== 0) return false
  for (let k = 1; k < caminho.length; k += 1) {
    const a = caminho[k - 1]
    const b = caminho[k]
    if (a === undefined || b === undefined || blocosEntre(a, b) !== 1) return false
  }
  return true
}

describe('contagem: a diagonal custa 1', () => {
  it('5 diagonais = 5 blocos', () => {
    const caminho = [0, 1, 2, 3, 4, 5].map((k) => c(k, k))
    expect(blocosDoCaminho(caminho)).toBe(5)
    const mapa = campoLivre(10, 10)
    expect(menorCaminhoEmBlocos(mapa, c(0, 0), c(5, 5), SEM_LIMITE)?.blocos).toBe(5)
    expect(menorCaminhoEmBlocos(mapa, c(5, 5), c(0, 0), SEM_LIMITE)?.blocos).toBe(5)
    expect(menorCaminhoEmBlocos(mapa, c(0, 5), c(5, 0), SEM_LIMITE)?.blocos).toBe(5)
    expect(menorCaminhoEmBlocos(mapa, c(5, 0), c(0, 5), SEM_LIMITE)?.blocos).toBe(5)
  })

  it('3 leste + 2 diagonais = 5 blocos', () => {
    const caminho = [c(0, 0), c(1, 0), c(2, 0), c(3, 0), c(4, 1), c(5, 2)]
    expect(blocosDoCaminho(caminho)).toBe(5)
    expect(menorCaminhoEmBlocos(campoLivre(10, 10), c(0, 0), c(5, 2), SEM_LIMITE)?.blocos).toBe(5)
  })

  it('entre duas casas é max(|dx|, |dy|); caminho vazio ou de uma casa não anda', () => {
    expect(blocosEntre(c(2, 3), c(2, 3))).toBe(0)
    expect(blocosEntre(c(0, 0), c(4, 1))).toBe(4)
    expect(blocosEntre(c(4, 1), c(0, 0))).toBe(4)
    expect(blocosEntre(c(-2, 7), c(1, 0))).toBe(7)
    expect(blocosDoCaminho([])).toBe(0)
    expect(blocosDoCaminho([c(3, 3)])).toBe(0)
    // Ir e voltar conta os dois trechos: é o caminho andado, não o deslocamento.
    expect(blocosDoCaminho([c(0, 0), c(1, 1), c(0, 0)])).toBe(2)
  })

  it('10.000 movimentos em campo livre, semente fixa: 100% contam max(|dx|, |dy|)', () => {
    const sorteio = sorteador(20261024)
    const TOTAL = 10_000
    let certos = 0
    for (let k = 0; k < TOTAL; k += 1) {
      const colunas = inteiro(sorteio, 1, 40)
      const linhas = inteiro(sorteio, 1, 40)
      const de = c(inteiro(sorteio, 0, colunas - 1), inteiro(sorteio, 0, linhas - 1))
      const para = c(inteiro(sorteio, 0, colunas - 1), inteiro(sorteio, 0, linhas - 1))
      const esperado = Math.max(Math.abs(para.col - de.col), Math.abs(para.row - de.row))
      const movimento = menorCaminhoEmBlocos(campoLivre(colunas, linhas), de, para, SEM_LIMITE)
      if (
        movimento !== null &&
        movimento.blocos === esperado &&
        movimento.caminho.length === esperado + 1 &&
        blocosDoCaminho(movimento.caminho) === esperado &&
        caminhoDePassosUnitarios(movimento.caminho, de, para)
      ) {
        certos += 1
      }
    }
    expect(certos).toBe(TOTAL)
  })

  it('com paredes ao acaso nunca conta menos que max(|dx|, |dy|), e todo passo do caminho é livre', () => {
    const sorteio = sorteador(7)
    let comVolta = 0
    let semSaida = 0
    for (let k = 0; k < 500; k += 1) {
      const colunas = inteiro(sorteio, 3, 16)
      const linhas = inteiro(sorteio, 3, 16)
      const paredes: Wall[] = []
      const quantas = inteiro(sorteio, 1, 25)
      for (let w = 0; w < quantas; w += 1) {
        const x = inteiro(sorteio, 0, colunas)
        const y = inteiro(sorteio, 0, linhas)
        const comprimento = inteiro(sorteio, 1, 4)
        paredes.push(sorteio() < 0.5 ? parede(`h${w}`, x, y, x + comprimento, y) : parede(`v${w}`, x, y, x, y + comprimento))
      }
      const mapa = montarMapaDosBlocos(paredes, GRID, colunas, linhas)
      const de = c(inteiro(sorteio, 0, colunas - 1), inteiro(sorteio, 0, linhas - 1))
      const para = c(inteiro(sorteio, 0, colunas - 1), inteiro(sorteio, 0, linhas - 1))
      const movimento = menorCaminhoEmBlocos(mapa, de, para, SEM_LIMITE)
      if (movimento === null) {
        semSaida += 1
        continue
      }
      expect(movimento.blocos).toBeGreaterThanOrEqual(blocosEntre(de, para))
      if (movimento.blocos > blocosEntre(de, para)) comVolta += 1
      expect(caminhoDePassosUnitarios(movimento.caminho, de, para)).toBe(true)
      for (let p = 1; p < movimento.caminho.length; p += 1) {
        const a = movimento.caminho[p - 1]
        const b = movimento.caminho[p]
        if (a === undefined || b === undefined) throw new Error('caminho com buraco')
        expect(conferirPasso(mapa, a, b)).toBe('livre')
      }
    }
    // As paredes ao acaso precisam forçar volta (e fechar casa) de verdade, senão o teste não diz nada.
    expect(comVolta).toBeGreaterThan(20)
    expect(semSaida).toBeGreaterThan(0)
  })
})

describe('passo reto: parede e porta', () => {
  const comParedeEntre = (extra: Partial<Wall>): MapaDosBlocos =>
    montarMapaDosBlocos([parede('entre', 1, 0, 1, 1, extra)], GRID, 4, 4)

  it('parede entre as casas barra; parede que não barra o passo, não', () => {
    expect(conferirPasso(comParedeEntre({}), c(0, 0), c(1, 0))).toBe('parede')
    expect(conferirPasso(comParedeEntre({}), c(1, 0), c(0, 0))).toBe('parede')
    expect(conferirPasso(comParedeEntre({ blocksMove: false }), c(0, 0), c(1, 0))).toBe('livre')
    // A mesma parede não barra a casa de baixo.
    expect(conferirPasso(comParedeEntre({}), c(0, 1), c(1, 1))).toBe('livre')
  })

  it('porta: só aberta, destrancada e não secreta deixa passar (a regra de lib/collision.ts)', () => {
    expect(conferirPasso(comParedeEntre({ door: porta({ open: true }) }), c(0, 0), c(1, 0))).toBe('livre')
    expect(conferirPasso(comParedeEntre({ door: porta() }), c(0, 0), c(1, 0))).toBe('parede')
    expect(conferirPasso(comParedeEntre({ door: porta({ open: true, locked: true }) }), c(0, 0), c(1, 0))).toBe('parede')
    expect(conferirPasso(comParedeEntre({ door: porta({ open: true, secret: true }) }), c(0, 0), c(1, 0))).toBe('parede')
  })

  it('paredeBarraOPasso é blocksMove && !isDoorPassable em todas as combinações', () => {
    const portas: Array<DoorState | null> = [null]
    for (const open of [false, true]) for (const locked of [false, true]) for (const secret of [undefined, false, true]) portas.push(porta({ open, locked, secret }))
    for (const blocksMove of [false, true]) {
      for (const door of portas) {
        const w = parede('w', 0, 0, 1, 0, { blocksMove, door })
        expect(paredeBarraOPasso(w)).toBe(w.blocksMove && !isDoorPassable(w.door))
      }
    }
  })

  it('parede que sai do mapa vale onde passa; parede corrompida não trava', () => {
    const atravessaOMundo = { x1: -1e6, y1: GRID, x2: 1e6, y2: GRID, blocksMove: true, door: null }
    const comAtravessa = montarMapaDosBlocos([atravessaOMundo], GRID, 4, 4)
    expect(conferirPasso(comAtravessa, c(0, 0), c(0, 1))).toBe('parede')
    expect(conferirPasso(comAtravessa, c(3, 0), c(3, 1))).toBe('parede')
    expect(conferirPasso(comAtravessa, c(0, 1), c(0, 2))).toBe('livre')

    const corrompidas = [
      { x1: 0, y1: 0, x2: 1e308, y2: 1e308, blocksMove: true, door: null },
      { x1: -1e308, y1: 1e308, x2: 1e308, y2: -1e308, blocksMove: true, door: null },
      { x1: Number.NaN, y1: 0, x2: GRID, y2: GRID, blocksMove: true, door: null },
      { x1: 0, y1: 0, x2: Number.POSITIVE_INFINITY, y2: GRID, blocksMove: true, door: null },
      { x1: 99 * GRID, y1: 99 * GRID, x2: 120 * GRID, y2: 99 * GRID, blocksMove: true, door: null },
    ]
    const mapa = montarMapaDosBlocos(corrompidas.slice(2), GRID, 4, 4)
    expect(conferirPasso(mapa, c(2, 2), c(3, 3))).toBe('livre')
    expect(menorCaminhoEmBlocos(mapa, c(3, 3), c(1, 1), SEM_LIMITE)?.blocos).toBe(2)
    // Com as de 1e308 montar e buscar terminam. A que sai de (0,0) recorta exata e barra
    // onde passa; a outra (a diferença estoura o double) não tem geometria que valha.
    const comEnormes = montarMapaDosBlocos(corrompidas, GRID, 300, 300)
    expect(conferirPasso(comEnormes, c(0, 1), c(1, 0))).toBe('parede')
    expect(['livre', 'parede', 'quina']).toContain(conferirPasso(comEnormes, c(150, 150), c(151, 149)))
    // A diagonal x = y passa no centro de (299,299); (299,298) fica do mesmo lado de (299,0).
    expect(menorCaminhoEmBlocos(comEnormes, c(299, 0), c(299, 298), SEM_LIMITE)?.blocos).toBe(298)
  })

  it('passo que não é de 1 bloco, ou sai do mapa, é inválido', () => {
    const mapa = campoLivre(4, 4)
    expect(conferirPasso(mapa, c(0, 0), c(2, 0))).toBe('invalido')
    expect(conferirPasso(mapa, c(1, 1), c(1, 1))).toBe('invalido')
    expect(conferirPasso(mapa, c(3, 3), c(4, 3))).toBe('invalido')
    expect(conferirPasso(mapa, c(0, 0), c(-1, -1))).toBe('invalido')
    expect(conferirPasso(mapa, c(0.5, 0), c(1.5, 0))).toBe('invalido')
    expect(conferirPasso(mapa, c(Number.NaN, 0), c(1, 0))).toBe('invalido')
    expect(conferirPasso(montarMapaDosBlocos([], 0, 4, 4), c(0, 0), c(1, 0))).toBe('invalido')
  })
})

/**
 * A fixture das quinas: cada caso é um desenho de parede e os vértices (em
 * casas) onde ela tem quina — ponta, canto, junção, batente — ou passa raspando.
 * Cada vértice dá 4 passos diagonais (2 diagonais, nos dois sentidos).
 */
interface CasoDeQuina {
  nome: string
  paredes: Wall[]
  quinas: Array<[number, number]>
}

const LADO_DA_FIXTURE = 8

const CASOS_DE_QUINA: CasoDeQuina[] = [
  { nome: 'canto em L', paredes: [parede('a', 3, 3, 3, 6), parede('b', 3, 3, 6, 3)], quinas: [[3, 3], [3, 6], [6, 3]] },
  { nome: 'ponta solta', paredes: [parede('a', 3, 2, 3, 6)], quinas: [[3, 2], [3, 6]] },
  { nome: 'junção em T', paredes: [parede('a', 2, 4, 6, 4), parede('b', 4, 4, 4, 7)], quinas: [[2, 4], [6, 4], [4, 4], [4, 7]] },
  { nome: 'cruz', paredes: [parede('a', 2, 4, 6, 4), parede('b', 4, 2, 4, 6)], quinas: [[2, 4], [6, 4], [4, 2], [4, 6], [4, 4]] },
  {
    nome: 'batente de porta fechada',
    paredes: [parede('a', 4, 1, 4, 3), parede('p', 4, 3, 4, 4, { door: porta() }), parede('b', 4, 4, 4, 7)],
    quinas: [[4, 1], [4, 3], [4, 4], [4, 7]],
  },
  {
    nome: 'batente de porta aberta (a diagonal não entra pela porta)',
    paredes: [parede('a', 4, 1, 4, 3), parede('p', 4, 3, 4, 4, { door: porta({ open: true }) }), parede('b', 4, 4, 4, 7)],
    quinas: [[4, 1], [4, 3], [4, 4], [4, 7]],
  },
  {
    nome: 'porta secreta aberta continua parede',
    paredes: [parede('p', 4, 2, 4, 5, { door: porta({ open: true, secret: true }) })],
    quinas: [[4, 2], [4, 3], [4, 4], [4, 5]],
  },
  { nome: 'parede diagonal de vértice a vértice', paredes: [parede('a', 1, 1, 4, 4)], quinas: [[1, 1], [2, 2], [3, 3], [4, 4]] },
  { nome: 'toco curto a 0,1 casa do vértice', paredes: [parede('a', 4, 3.7, 4, 3.9)], quinas: [[4, 4]] },
  { nome: 'meia parede barra o reto ao lado da quina', paredes: [parede('a', 4, 3, 4, 3.5)], quinas: [[4, 3], [4, 4]] },
  { nome: 'desenho torto: ponta a 0,05 casa do vértice', paredes: [parede('a', 4.03, 7, 4.03, 4.04)], quinas: [[4, 4]] },
]

/** Os 4 passos diagonais que atravessam o vértice (vx, vy). */
function diagonaisPelo(vx: number, vy: number): Array<[Casa, Casa]> {
  return [
    [c(vx - 1, vy - 1), c(vx, vy)],
    [c(vx, vy), c(vx - 1, vy - 1)],
    [c(vx, vy - 1), c(vx - 1, vy)],
    [c(vx - 1, vy), c(vx, vy - 1)],
  ]
}

/** Menor distância, em px, do vértice (vx, vy) às paredes que barram. */
function distanciaDoVertice(vx: number, vy: number, paredes: readonly Wall[]): number {
  let menor = Number.POSITIVE_INFINITY
  for (const w of paredes) {
    if (!paredeBarraOPasso(w)) continue
    const px = vx * GRID
    const py = vy * GRID
    const dx = w.x2 - w.x1
    const dy = w.y2 - w.y1
    const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / (dx * dx + dy * dy)))
    menor = Math.min(menor, Math.hypot(px - (w.x1 + dx * t), py - (w.y1 + dy * t)))
  }
  return menor
}

describe('quina de parede: a diagonal que raspa é recusada (decisão 8)', () => {
  it('100% dos passos diagonais pelas quinas da fixture são recusados', () => {
    let total = 0
    let recusados = 0
    const aceitos: string[] = []
    for (const caso of CASOS_DE_QUINA) {
      const mapa = montarMapaDosBlocos(caso.paredes, GRID, LADO_DA_FIXTURE, LADO_DA_FIXTURE)
      for (const [vx, vy] of caso.quinas) {
        for (const [de, para] of diagonaisPelo(vx, vy)) {
          total += 1
          const veredito = conferirPasso(mapa, de, para)
          if (veredito === 'quina' || veredito === 'parede') recusados += 1
          else aceitos.push(`${caso.nome}: (${de.col},${de.row})→(${para.col},${para.row}) = ${veredito}`)
        }
      }
    }
    expect(aceitos).toEqual([])
    expect(total).toBe(CASOS_DE_QUINA.reduce((soma, caso) => soma + caso.quinas.length * 4, 0))
    expect(recusados).toBe(total)
  })

  it('raspar a ponta é "quina"; atravessar a parede no meio é "parede"', () => {
    const ponta = montarMapaDosBlocos([parede('a', 3, 2, 3, 6)], GRID, LADO_DA_FIXTURE, LADO_DA_FIXTURE)
    expect(conferirPasso(ponta, c(2, 1), c(3, 2))).toBe('quina')
    const cruz = montarMapaDosBlocos([parede('a', 2, 4, 6, 4), parede('b', 4, 2, 4, 6)], GRID, LADO_DA_FIXTURE, LADO_DA_FIXTURE)
    expect(conferirPasso(cruz, c(3, 3), c(4, 4))).toBe('parede')
    const toco = montarMapaDosBlocos([parede('a', 4, 3.7, 4, 3.9)], GRID, LADO_DA_FIXTURE, LADO_DA_FIXTURE)
    expect(conferirPasso(toco, c(3, 3), c(4, 4))).toBe('quina')
  })

  it('longe de parede (1 casa ou mais do vértice) a diagonal passa', () => {
    let livres = 0
    for (const caso of CASOS_DE_QUINA) {
      const mapa = montarMapaDosBlocos(caso.paredes, GRID, LADO_DA_FIXTURE, LADO_DA_FIXTURE)
      for (let vy = 1; vy < LADO_DA_FIXTURE; vy += 1) {
        for (let vx = 1; vx < LADO_DA_FIXTURE; vx += 1) {
          if (distanciaDoVertice(vx, vy, caso.paredes) < GRID) continue
          for (const [de, para] of diagonaisPelo(vx, vy)) {
            expect(conferirPasso(mapa, de, para), `${caso.nome} pelo vértice (${vx},${vy})`).toBe('livre')
            livres += 1
          }
        }
      }
    }
    expect(livres).toBeGreaterThan(100)
  })

  it('o movimento contorna a quina: a volta custa mais e nunca usa passo recusado', () => {
    // Parede entre (0,0) e (1,0) com a ponta no vértice (1,1): a diagonal (0,0)→(1,1) raspa.
    const mapa = montarMapaDosBlocos([parede('a', 1, 0, 1, 1)], GRID, 4, 4)
    const movimento = menorCaminhoEmBlocos(mapa, c(0, 0), c(1, 1), SEM_LIMITE)
    expect(movimento?.blocos).toBe(2)
    expect(movimento?.caminho).toEqual([c(0, 0), c(0, 1), c(1, 1)])

    for (const caso of CASOS_DE_QUINA) {
      const fixture = montarMapaDosBlocos(caso.paredes, GRID, LADO_DA_FIXTURE, LADO_DA_FIXTURE)
      for (const [vx, vy] of caso.quinas) {
        for (const [de, para] of diagonaisPelo(vx, vy)) {
          const volta = menorCaminhoEmBlocos(fixture, de, para, SEM_LIMITE)
          if (volta === null) continue
          expect(volta.blocos, `${caso.nome} pelo vértice (${vx},${vy})`).toBeGreaterThanOrEqual(2)
          for (let p = 1; p < volta.caminho.length; p += 1) {
            const a = volta.caminho[p - 1]
            const b = volta.caminho[p]
            if (a === undefined || b === undefined) throw new Error('caminho com buraco')
            expect(conferirPasso(fixture, a, b)).toBe('livre')
          }
        }
      }
    }
  })
})

describe('limites do movimento', () => {
  it('além do limite, fora do mapa ou sem saída não há movimento', () => {
    const mapa = campoLivre(10, 10)
    expect(menorCaminhoEmBlocos(mapa, c(0, 0), c(5, 5), 4)).toBeNull()
    expect(menorCaminhoEmBlocos(mapa, c(0, 0), c(5, 5), 5)?.blocos).toBe(5)
    expect(menorCaminhoEmBlocos(mapa, c(0, 0), c(10, 0), SEM_LIMITE)).toBeNull()
    expect(menorCaminhoEmBlocos(mapa, c(0, 0), c(Number.NaN, 0), SEM_LIMITE)).toBeNull()
    expect(menorCaminhoEmBlocos(mapa, c(0, 0), c(3, 3), Number.NaN)).toBeNull()
    expect(menorCaminhoEmBlocos(mapa, c(2, 2), c(2, 2), 0)).toEqual({ blocos: 0, caminho: [c(2, 2)] })
    // Sala fechada de (4,4) a (6,6): de fora não se chega.
    const sala = montarMapaDosBlocos(
      [parede('n', 4, 4, 6, 4), parede('s', 4, 6, 6, 6), parede('o', 4, 4, 4, 6), parede('l', 6, 4, 6, 6)],
      GRID,
      10,
      10,
    )
    expect(menorCaminhoEmBlocos(sala, c(0, 0), c(5, 5), SEM_LIMITE)).toBeNull()
  })

  it('a volta pode passar do deslocamento, mas não do limite', () => {
    // Parede de (2,0) a (2,4) num mapa 5x5: de (1,0) a (3,0) só por baixo, pela
    // linha 4, e reto — a diagonal (1,3)→(2,4) raspa a ponta da parede. 4 + 1 + 4 = 9.
    const mapa = montarMapaDosBlocos([parede('a', 2, 0, 2, 4)], GRID, 5, 5)
    const movimento = menorCaminhoEmBlocos(mapa, c(1, 0), c(3, 0), SEM_LIMITE)
    expect(movimento?.blocos).toBe(9)
    expect(menorCaminhoEmBlocos(mapa, c(1, 0), c(3, 0), 8)).toBeNull()
    expect(menorCaminhoEmBlocos(mapa, c(1, 0), c(3, 0), 9)?.blocos).toBe(9)
  })
})

describe('casa e ponto', () => {
  it('o centro da casa volta para a mesma casa', () => {
    expect(centroDaCasa(c(3, 2), GRID)).toEqual({ x: 3 * GRID + GRID / 2, y: 2 * GRID + GRID / 2 })
    expect(casaDoPonto({ x: 3 * GRID + 10, y: 2 * GRID + 63 }, GRID)).toEqual(c(3, 2))
    expect(casaDoPonto({ x: 3 * GRID, y: 0 }, GRID)).toEqual(c(3, 0))
    for (const casa of [c(0, 0), c(7, 1), c(12, 30)]) expect(casaDoPonto(centroDaCasa(casa, GRID), GRID)).toEqual(casa)
  })
})
