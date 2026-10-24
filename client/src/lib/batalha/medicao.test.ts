/**
 * MEDIÇÃO DO MODO BATALHA — o contrato da fatia B2 (docs/planos/modo-batalha-2026-10-24.md):
 * círculo quadrado (decisão 4: raio 2 = 25 blocos), cone em 8 direções
 * (decisão 5) e linha de visão de centro a centro de casa. A visão confere com
 * uma referência escrita aqui, por outro algoritmo, em 200 de 200 mapas, e
 * esconder paredes no mapa do mestre muda 0 respostas.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { MapData, Wall } from '../../types/map'
import { alternarOlhoDoMestre, alternarOlhoDosJogadores, definirOpacidade, paraVersao2 } from '../camadas/estado'
import { visibleWalls } from '../layers'
import { createEmptyMap } from '../mapFactory'
import { hasLineOfSight, type Segment, visionSegments } from '../visibility'
import { GRID, inteiro, parede, porta, sorteador } from './batalha.fixture'
import { blocosEntre, type Casa, centroDaCasa } from './blocos'
import {
  casasNoCirculo,
  casasNoCone,
  type Direcao8,
  DIRECOES_EM_ORDEM,
  direcaoMaisPerto,
  type LimitesDaGrade,
  linhaDeVisao,
  linhaDeVisaoEntreCasas,
  PASSO_DA_DIRECAO,
} from './medicao'

const c = (col: number, row: number): Casa => ({ col, row })
const GRADE_GRANDE: LimitesDaGrade = { colunas: 41, linhas: 41 }
const MEIO = c(20, 20)

/** As casas como texto "col,row", relativas a `origem` e em ordem: comparação de conjunto. */
function relativas(casas: readonly Casa[], origem: Casa): string[] {
  return casas.map((casa) => `${casa.col - origem.col},${casa.row - origem.row}`).sort()
}

describe('círculo quadrado (decisão 4)', () => {
  it('raio 0, 1, 2 e 3 pegam 1, 9, 25 e 49 casas', () => {
    expect(casasNoCirculo(MEIO, 0, GRADE_GRANDE)).toEqual([MEIO])
    expect(casasNoCirculo(MEIO, 1, GRADE_GRANDE)).toHaveLength(9)
    expect(casasNoCirculo(MEIO, 2, GRADE_GRANDE)).toHaveLength(25)
    expect(casasNoCirculo(MEIO, 3, GRADE_GRANDE)).toHaveLength(49)
  })

  it('é toda casa a até `raio` blocos (diagonal = 1), e só ela', () => {
    for (const raio of [0, 1, 2, 5, 9]) {
      const circulo = casasNoCirculo(MEIO, raio, GRADE_GRANDE)
      for (const casa of circulo) expect(blocosEntre(MEIO, casa)).toBeLessThanOrEqual(raio)
      expect(new Set(relativas(circulo, MEIO)).size).toBe((2 * raio + 1) ** 2)
    }
  })

  it('a borda do mapa corta; raio quebrado arredonda para baixo; entrada ruim não dá casa', () => {
    expect(casasNoCirculo(c(0, 0), 2, { colunas: 10, linhas: 10 })).toHaveLength(9)
    expect(casasNoCirculo(c(9, 9), 1, { colunas: 10, linhas: 10 })).toHaveLength(4)
    expect(casasNoCirculo(MEIO, 2.7, GRADE_GRANDE)).toHaveLength(25)
    expect(casasNoCirculo(MEIO, -1, GRADE_GRANDE)).toEqual([])
    expect(casasNoCirculo(MEIO, Number.NaN, GRADE_GRANDE)).toEqual([])
    expect(casasNoCirculo(c(0.5, 0), 1, GRADE_GRANDE)).toEqual([])
    expect(casasNoCirculo(MEIO, 2, { colunas: Number.NaN, linhas: 10 })).toEqual([])
    // Raio sem fim pega o mapa todo e termina.
    expect(casasNoCirculo(c(1, 1), Number.POSITIVE_INFINITY, { colunas: 6, linhas: 4 })).toHaveLength(24)
  })
})

describe('cone em 8 direções (decisão 5)', () => {
  it('para leste, comprimento 3: 7 casas, a largura cresce com a distância', () => {
    expect(relativas(casasNoCone(MEIO, 'leste', 3, GRADE_GRANDE), MEIO)).toEqual(
      ['1,0', '2,-1', '2,0', '2,1', '3,-1', '3,0', '3,1'].sort(),
    )
  })

  it('para nordeste, comprimento 3: 9 casas', () => {
    expect(relativas(casasNoCone(MEIO, 'nordeste', 3, GRADE_GRANDE), MEIO)).toEqual(
      ['1,-1', '2,-1', '1,-2', '2,-2', '3,-1', '1,-3', '3,-2', '2,-3', '3,-3'].sort(),
    )
  })

  it('reto: a distância d tem 2·⌊d/2⌋ + 1 casas; quem mede nunca está no cone', () => {
    const cone = casasNoCone(MEIO, 'sul', 6, GRADE_GRANDE)
    for (let d = 1; d <= 6; d += 1) {
      expect(cone.filter((casa) => casa.row - MEIO.row === d)).toHaveLength(2 * Math.floor(d / 2) + 1)
    }
    expect(cone).toHaveLength(1 + 3 + 3 + 5 + 5 + 7)
    expect(cone.some((casa) => blocosEntre(casa, MEIO) === 0)).toBe(false)
    expect(cone.every((casa) => blocosEntre(casa, MEIO) <= 6)).toBe(true)
  })

  it('girar 90° leva o cone de uma direção ao da direção duas adiante, nas 8', () => {
    // A ordem é a dos ponteiros do relógio na tela (y para baixo).
    expect(DIRECOES_EM_ORDEM).toEqual(['leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste'])
    for (let k = 0; k < 8; k += 1) {
      const aqui: Direcao8 | undefined = DIRECOES_EM_ORDEM[k]
      const adiante: Direcao8 | undefined = DIRECOES_EM_ORDEM[(k + 2) % 8]
      if (aqui === undefined || adiante === undefined) throw new Error('direção faltando')
      for (const comprimento of [1, 2, 4, 7]) {
        const girado = casasNoCone(MEIO, aqui, comprimento, GRADE_GRANDE).map((casa) => c(MEIO.col - (casa.row - MEIO.row), MEIO.row + (casa.col - MEIO.col)))
        expect(relativas(girado, MEIO)).toEqual(relativas(casasNoCone(MEIO, adiante, comprimento, GRADE_GRANDE), MEIO))
      }
    }
  })

  it('comprimento 0 ou ruim não dá casa; a borda do mapa corta', () => {
    expect(casasNoCone(MEIO, 'norte', 0, GRADE_GRANDE)).toEqual([])
    expect(casasNoCone(MEIO, 'norte', Number.NaN, GRADE_GRANDE)).toEqual([])
    expect(casasNoCone(MEIO, 'norte', -3, GRADE_GRANDE)).toEqual([])
    expect(relativas(casasNoCone(c(0, 0), 'leste', 2, { colunas: 10, linhas: 10 }), c(0, 0))).toEqual(['1,0', '2,0', '2,1'])
  })
})

describe('direção mais perto do ponteiro', () => {
  it('cada uma das 8 direções cobre 45°, com y para baixo', () => {
    expect(direcaoMaisPerto(5, 1)).toBe('leste')
    expect(direcaoMaisPerto(2, 1)).toBe('sudeste')
    expect(direcaoMaisPerto(0, 3)).toBe('sul')
    expect(direcaoMaisPerto(-1, 2)).toBe('sudoeste')
    expect(direcaoMaisPerto(-4, -1)).toBe('oeste')
    expect(direcaoMaisPerto(-3, -2)).toBe('noroeste')
    expect(direcaoMaisPerto(1, -9)).toBe('norte')
    expect(direcaoMaisPerto(3, -2)).toBe('nordeste')
    for (const nome of DIRECOES_EM_ORDEM) {
      const [dc, dr] = PASSO_DA_DIRECAO[nome]
      expect(direcaoMaisPerto(dc, dr)).toBe(nome)
      expect(direcaoMaisPerto(dc * 7, dr * 7)).toBe(nome)
    }
  })

  it('sem direção (ponteiro em cima de quem mede, ou número ruim) não escolhe nenhuma', () => {
    expect(direcaoMaisPerto(0, 0)).toBeNull()
    expect(direcaoMaisPerto(Number.NaN, 1)).toBeNull()
    expect(direcaoMaisPerto(Number.POSITIVE_INFINITY, 1)).toBeNull()
  })
})

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => ({ x1: x1 * GRID, y1: y1 * GRID, x2: x2 * GRID, y2: y2 * GRID })

describe('linha de visão de centro a centro', () => {
  it('sem obstáculo, livre; parede no meio barra no ponto onde a linha a corta', () => {
    expect(linhaDeVisaoEntreCasas(c(0, 0), c(5, 3), [], GRID)).toEqual({ livre: true })
    const parede = seg(3, 0, 3, 6)
    expect(linhaDeVisaoEntreCasas(c(0, 2), c(5, 2), [seg(0, 9, 9, 9), parede], GRID)).toEqual({
      livre: false,
      ponto: { x: 3 * GRID, y: 2.5 * GRID },
      obstaculo: 1,
    })
  })

  it('a primeira parede que a linha encontra é a que barra', () => {
    const resposta = linhaDeVisaoEntreCasas(c(0, 2), c(9, 2), [seg(6, 0, 6, 6), seg(2, 0, 2, 6), seg(4, 0, 4, 6)], GRID)
    expect(resposta).toEqual({ livre: false, ponto: { x: 2 * GRID, y: 2.5 * GRID }, obstaculo: 1 })
  })

  it('encostar na quina barra; parede colinear, na origem ou embaixo do alvo não barra (como a névoa)', () => {
    // A diagonal de (0,0) a (2,2) passa pelo vértice (1,1), onde a parede termina.
    expect(linhaDeVisaoEntreCasas(c(0, 0), c(2, 2), [seg(1, 1, 1, 3)], GRID)).toMatchObject({ livre: false, ponto: { x: GRID, y: GRID } })
    // Parede inteira em cima da linha da diagonal: a visão desliza ao longo dela.
    expect(linhaDeVisaoEntreCasas(c(0, 0), c(3, 3), [seg(1, 1, 2, 2)], GRID)).toEqual({ livre: true })
    // Parede que passa pelo centro da casa de quem olha não o cega; pelo do alvo, o alvo conta como visto.
    expect(linhaDeVisaoEntreCasas(c(0, 0), c(3, 0), [seg(0.5, 0, 0.5, 1)], GRID)).toEqual({ livre: true })
    expect(linhaDeVisaoEntreCasas(c(0, 0), c(3, 0), [seg(3.5, 0, 3.5, 1)], GRID)).toEqual({ livre: true })
    expect(linhaDeVisaoEntreCasas(c(4, 4), c(4, 4), [seg(4.5, 4, 4.5, 5)], GRID)).toEqual({ livre: true })
  })

  it('casa ou ponto que não é número não tem resposta', () => {
    expect(linhaDeVisaoEntreCasas(c(0.5, 0), c(3, 0), [], GRID)).toBeNull()
    expect(linhaDeVisaoEntreCasas(c(0, 0), c(Number.NaN, 0), [], GRID)).toBeNull()
    expect(linhaDeVisaoEntreCasas(c(0, 0), c(3, 0), [], 0)).toBeNull()
    expect(linhaDeVisao({ x: 0, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 0 }, [])).toBeNull()
  })
})

/**
 * REFERÊNCIA INDEPENDENTE da linha de visão: predicados de orientação (exatos
 * em coordenada inteira, sem divisão) decidem se cruza, e a interseção das
 * retas em coordenadas homogêneas dá o ponto. A regra é a da névoa
 * (`hasLineOfSight`): parede colinear não barra; tocar só a origem ou só o alvo
 * não barra; tocar a ponta da parede em qualquer outro ponto barra.
 */
interface Degeneracoes {
  colineares: number
  naOrigemOuNoAlvo: number
  pontaNaLinha: number
}

function orientacao(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function produtoVetorial(u: readonly [number, number, number], v: readonly [number, number, number]): [number, number, number] {
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
}

function visaoDeReferencia(a: Point, b: Point, obstaculos: readonly Segment[], contagem: Degeneracoes): { livre: true } | { livre: false; ponto: Point } {
  let melhor: Point | null = null
  let melhorDistancia = Number.POSITIVE_INFINITY
  for (const s of obstaculos) {
    const o1 = orientacao(a.x, a.y, b.x, b.y, s.x1, s.y1)
    const o2 = orientacao(a.x, a.y, b.x, b.y, s.x2, s.y2)
    if (o1 === 0 && o2 === 0) {
      contagem.colineares += 1
      continue
    }
    const o3 = orientacao(s.x1, s.y1, s.x2, s.y2, a.x, a.y)
    const o4 = orientacao(s.x1, s.y1, s.x2, s.y2, b.x, b.y)
    if (o1 * o2 > 0 || o3 * o4 > 0) continue
    if (o3 === 0 || o4 === 0) {
      contagem.naOrigemOuNoAlvo += 1
      continue
    }
    if (o1 === 0 || o2 === 0) contagem.pontaNaLinha += 1
    const reta = produtoVetorial([a.x, a.y, 1], [b.x, b.y, 1])
    const parede = produtoVetorial([s.x1, s.y1, 1], [s.x2, s.y2, 1])
    const [hx, hy, hw] = produtoVetorial(reta, parede)
    const ponto = { x: hx / hw, y: hy / hw }
    const distancia = Math.hypot(ponto.x - a.x, ponto.y - a.y)
    if (distancia < melhorDistancia) {
      melhorDistancia = distancia
      melhor = ponto
    }
  }
  return melhor === null ? { livre: true } : { livre: false, ponto: melhor }
}

/** Mapa ao acaso, tudo em px inteiros: paredes na grade, diagonais de vértice a vértice e traços soltos. */
function mapaAoAcaso(sorteio: () => number): { colunas: number; linhas: number; obstaculos: Segment[] } {
  const colunas = inteiro(sorteio, 4, 30)
  const linhas = inteiro(sorteio, 4, 30)
  const obstaculos: Segment[] = []
  const quantos = inteiro(sorteio, 0, 60)
  for (let k = 0; k < quantos; k += 1) {
    const tipo = sorteio()
    const x = inteiro(sorteio, 0, colunas)
    const y = inteiro(sorteio, 0, linhas)
    const n = inteiro(sorteio, 1, 5)
    if (tipo < 0.5) obstaculos.push(sorteio() < 0.5 ? seg(x, y, x + n, y) : seg(x, y, x, y + n))
    else if (tipo < 0.7) obstaculos.push(seg(x, y, x + n, sorteio() < 0.5 ? y + n : y - n))
    else {
      obstaculos.push({
        x1: inteiro(sorteio, 0, colunas * GRID),
        y1: inteiro(sorteio, 0, linhas * GRID),
        x2: inteiro(sorteio, 0, colunas * GRID),
        y2: inteiro(sorteio, 0, linhas * GRID),
      })
    }
  }
  return { colunas, linhas, obstaculos }
}

/** Pares de casas: metade ao acaso, metade alinhada (mesma linha, coluna ou diagonal exata), onde moram os vértices. */
function paresDeCasas(sorteio: () => number, colunas: number, linhas: number, quantos: number): Array<[Casa, Casa]> {
  const pares: Array<[Casa, Casa]> = []
  for (let k = 0; k < quantos; k += 1) {
    const a = c(inteiro(sorteio, 0, colunas - 1), inteiro(sorteio, 0, linhas - 1))
    if (k % 2 === 0) {
      pares.push([a, c(inteiro(sorteio, 0, colunas - 1), inteiro(sorteio, 0, linhas - 1))])
      continue
    }
    const passo = inteiro(sorteio, 1, Math.min(colunas, linhas))
    const alinhamentos: ReadonlyArray<readonly [number, number]> = [
      [passo, 0],
      [0, passo],
      [passo, passo],
      [passo, -passo],
      [-passo, passo],
    ]
    const [dc, dr] = alinhamentos[inteiro(sorteio, 0, alinhamentos.length - 1)]
    const b = c(Math.min(colunas - 1, Math.max(0, a.col + dc)), Math.min(linhas - 1, Math.max(0, a.row + dr)))
    pares.push([a, b])
  }
  return pares
}

describe('linha de visão contra a referência independente', () => {
  it('200 de 200 mapas ao acaso, semente fixa, dão a mesma resposta (e a mesma da névoa)', () => {
    const sorteio = sorteador(20261024)
    const MAPAS = 200
    const contagem: Degeneracoes = { colineares: 0, naOrigemOuNoAlvo: 0, pontaNaLinha: 0 }
    let mapasIguais = 0
    let barradas = 0
    let livres = 0
    const divergencias: string[] = []
    for (let m = 0; m < MAPAS; m += 1) {
      const { colunas, linhas, obstaculos } = mapaAoAcaso(sorteio)
      let igual = true
      for (const [a, b] of paresDeCasas(sorteio, colunas, linhas, 60)) {
        const resposta = linhaDeVisaoEntreCasas(a, b, obstaculos, GRID)
        const pa = centroDaCasa(a, GRID)
        const pb = centroDaCasa(b, GRID)
        const referencia = visaoDeReferencia(pa, pb, obstaculos, contagem)
        let confere = resposta !== null && resposta.livre === referencia.livre && resposta.livre === hasLineOfSight(pa, pb, obstaculos)
        if (confere && resposta !== null && !resposta.livre && !referencia.livre) {
          confere = Math.abs(resposta.ponto.x - referencia.ponto.x) < 1e-6 && Math.abs(resposta.ponto.y - referencia.ponto.y) < 1e-6
        }
        if (!confere) {
          igual = false
          if (divergencias.length < 5) divergencias.push(`mapa ${m}: (${a.col},${a.row})→(${b.col},${b.row}) ${JSON.stringify(resposta)} x ${JSON.stringify(referencia)}`)
        }
        if (referencia.livre) livres += 1
        else barradas += 1
      }
      if (igual) mapasIguais += 1
    }
    expect(divergencias).toEqual([])
    expect(mapasIguais).toBe(MAPAS)
    // Os dois lados e os casos de fio de navalha aconteceram de verdade.
    expect(barradas).toBeGreaterThan(2000)
    expect(livres).toBeGreaterThan(2000)
    expect(contagem.colineares).toBeGreaterThan(20)
    expect(contagem.naOrigemOuNoAlvo).toBeGreaterThan(20)
    expect(contagem.pontaNaLinha).toBeGreaterThan(20)
  })
})

describe('esconder paredes no mapa do mestre', () => {
  /** Mesa 20x15 com parede comum, janela, parede que não barra a luz, porta de todo tipo e parede invisível. */
  function mesaComParedes(sorteio: () => number): MapData {
    const walls: Wall[] = []
    for (let k = 0; k < 70; k += 1) {
      const x = inteiro(sorteio, 0, 20)
      const y = inteiro(sorteio, 0, 15)
      const n = inteiro(sorteio, 1, 4)
      const [x2, y2] = sorteio() < 0.5 ? [x + n, y] : [x, y + n]
      const tipo = inteiro(sorteio, 0, 7)
      const extra: Partial<Wall> =
        tipo === 0
          ? { janela: true }
          : tipo === 1
            ? { blocksLight: false }
            : tipo === 2
              ? { door: porta({ open: sorteio() < 0.5 }) }
              : tipo === 3
                ? { door: porta({ open: true, locked: true }) }
                : tipo === 4
                  ? { door: porta({ open: sorteio() < 0.5, secret: true }) }
                  : tipo === 5
                    ? { door: porta({ kind: 'gate' }) }
                    : tipo === 6
                      ? { hidden: true }
                      : {}
      walls.push(parede(`w${k}`, x, y, x2, y2, extra))
    }
    return { ...createEmptyMap('mesa', 'Mesa', 20, 15, GRID), walls }
  }

  /** Todas as respostas de visão da mesa para os pares dados: o que o modo batalha mostraria. */
  function respostas(mapa: MapData, pares: ReadonlyArray<[Casa, Casa]>): string[] {
    const obstaculos = visionSegments(mapa)
    return pares.map(([a, b]) => JSON.stringify(linhaDeVisaoEntreCasas(a, b, obstaculos, GRID)))
  }

  it('olho do mestre, olho dos jogadores, opacidade 0 e parede invisível mudam 0 respostas', () => {
    const sorteio = sorteador(424242)
    const mesa = mesaComParedes(sorteio)
    const pares = paresDeCasas(sorteio, 20, 15, 600)
    const antes = respostas(mesa, pares)
    const escondidas: Array<[string, MapData]> = [
      ['olho do mestre em Paredes (mapa de antes)', alternarOlhoDoMestre(mesa, 'paredes')],
      ['olho do mestre em Paredes e Portas (mapa de antes)', alternarOlhoDoMestre(alternarOlhoDoMestre(mesa, 'paredes'), 'portas')],
      ['olho do mestre em Paredes e Portas (mapa v2)', alternarOlhoDoMestre(alternarOlhoDoMestre(paraVersao2(mesa), 'paredes'), 'portas')],
      ['olho dos jogadores em Paredes', alternarOlhoDosJogadores(mesa, 'paredes')],
      ['opacidade 0 em Paredes e Portas', definirOpacidade(definirOpacidade(mesa, 'paredes', 0), 'portas', 0)],
      ['toda parede invisível', { ...mesa, walls: mesa.walls.map((w) => ({ ...w, hidden: true })) }],
    ]
    let mudadas = 0
    for (const [nome, mapa] of escondidas) {
      const depois = respostas(mapa, pares)
      const desta = depois.filter((resposta, k) => resposta !== antes[k]).length
      expect(desta, nome).toBe(0)
      mudadas += desta
    }
    expect(mudadas).toBe(0)
    // As respostas dizem algo: há visão livre e barrada na mesa.
    expect(antes.filter((r) => r.includes('"livre":true')).length).toBeGreaterThan(50)
    expect(antes.filter((r) => r.includes('"livre":false')).length).toBeGreaterThan(50)
    // Controle: a fonte errada (só as paredes que o mestre está vendo) mudaria respostas — o teste tem dentes.
    const soAsVistas = (mapa: MapData): MapData => ({ ...mapa, walls: visibleWalls(mapa.walls, mapa) })
    const escondida = alternarOlhoDoMestre(mesa, 'paredes')
    const pelaFonteErrada = respostas(soAsVistas(escondida), pares)
    expect(pelaFonteErrada.filter((resposta, k) => resposta !== antes[k]).length).toBeGreaterThan(50)
  })
})
