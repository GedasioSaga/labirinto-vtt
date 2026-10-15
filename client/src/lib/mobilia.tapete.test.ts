import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import {
  aceitaVista,
  contornoDoTapete,
  criarMovel,
  desenhoDoTapete,
  ehMovelRedondo,
  ehMovelVazado,
  emOrdemDeDesenho,
  formaDoTapete,
  FORMAS_DO_TAPETE,
  movelComOutraForma,
  movelComOutraVista,
  movelComOutroTipo,
  NOME_COM_ARTIGO,
  normalizarFormaDoTapete,
  propMobiliaFromFile,
  ROTULO_FORMA,
  ROTULO_MOBILIA,
  TIPOS_MOBILIA,
  tracosDoGlifo,
  type TracoDoGlifo,
} from './mobilia'

/**
 * TAPETE: o móvel que fica no chão, com "Forma" (retangular ou redondo) e
 * vista de lado. Aqui sem tela: catálogo, tamanhos, a porta da forma (disco,
 * troca de tipo, de vista e de forma), a ordem de desenho e a geometria.
 */

const GRADE = 40
const CENTRO = { x: 300, y: 200 }

function tapete(extra: Partial<Prop> = {}): Prop {
  return { ...criarMovel('tapete', CENTRO, GRADE, 't1'), ...extra }
}

function horizontal(t: TracoDoGlifo): boolean {
  return t.y1 === t.y2
}

/** Igual a menos do arredondamento da conta em ponto flutuante. */
function quase(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

describe('tapete — catálogo e tamanho', () => {
  it('é o último do catálogo, "Tapete", "um tapete", com vista; não é redondo nem vazado', () => {
    expect(TIPOS_MOBILIA[TIPOS_MOBILIA.length - 1]).toBe('tapete')
    expect(ROTULO_MOBILIA.tapete).toBe('Tapete')
    expect(NOME_COM_ARTIGO.tapete).toBe('um tapete')
    expect(aceitaVista('tapete')).toBe(true)
    expect(ehMovelRedondo('tapete')).toBe(false)
    expect(ehMovelVazado('tapete')).toBe(false)
    expect(FORMAS_DO_TAPETE.map((forma) => ROTULO_FORMA[forma])).toEqual(['Retangular', 'Redondo'])
  })

  it('o clique põe o retangular de 3 x 2 casas, sem o campo da forma', () => {
    const t = tapete()
    expect([t.width, t.height]).toEqual([3 * GRADE, 2 * GRADE])
    expect(t).not.toHaveProperty('mobiliaForma')
    expect(formaDoTapete(t)).toBe('retangular')
  })

  it('trocar a forma põe o tamanho padrão da forma nova; centro, giro e cor ficam', () => {
    const girado = tapete({ rotation: 30, mobiliaCor: '#806040' })
    const redondo = movelComOutraForma(girado, 'redondo', GRADE)
    expect(redondo).toEqual({ ...girado, mobiliaForma: 'redondo', width: 2 * GRADE, height: 2 * GRADE })
    const deVolta = movelComOutraForma(redondo, 'retangular', GRADE)
    expect(deVolta).toEqual(girado)
  })

  it('de lado: 3 x 0,25 no retangular e 2 x 0,25 no redondo; trocar a forma de lado fica de lado', () => {
    const deLado = movelComOutraVista(tapete(), 'lado', GRADE)
    expect([deLado.width, deLado.height, deLado.mobiliaVista]).toEqual([3 * GRADE, 0.25 * GRADE, 'lado'])
    const redondoDeLado = movelComOutraForma(deLado, 'redondo', GRADE)
    expect([redondoDeLado.width, redondoDeLado.height, redondoDeLado.mobiliaVista]).toEqual([2 * GRADE, 0.25 * GRADE, 'lado'])
    const redondoDeFrente = movelComOutraVista(redondoDeLado, 'frente', GRADE)
    expect([redondoDeFrente.width, redondoDeFrente.height]).toEqual([2 * GRADE, 2 * GRADE])
    expect(redondoDeFrente).not.toHaveProperty('mobiliaVista')
    expect(redondoDeFrente.mobiliaForma).toBe('redondo')
  })

  it('a forma é só do tapete: outro tipo devolve o mesmo objeto, e virar outro tipo tira a forma', () => {
    const mesa = criarMovel('mesa', CENTRO, GRADE, 'm1')
    expect(movelComOutraForma(mesa, 'redondo', GRADE)).toBe(mesa)
    const virouMesa = movelComOutroTipo(tapete({ mobiliaForma: 'redondo' }), 'mesa', GRADE)
    expect(virouMesa).not.toHaveProperty('mobiliaForma')
    expect([virouMesa.width, virouMesa.height]).toEqual([2 * GRADE, 1 * GRADE])
    const virouTapete = movelComOutroTipo(mesa, 'tapete', GRADE)
    expect([virouTapete.width, virouTapete.height]).toEqual([3 * GRADE, 2 * GRADE])
  })
})

describe('tapete — a porta da forma', () => {
  it('só "redondo" no tapete passa; o resto (padrão, texto torto, outro tipo) vira ausente', () => {
    expect(normalizarFormaDoTapete('tapete', 'redondo')).toBe('redondo')
    for (const valor of ['retangular', 'REDONDO', ' redondo', 1, null, undefined, {}]) {
      expect(normalizarFormaDoTapete('tapete', valor), String(valor)).toBeUndefined()
    }
    expect(normalizarFormaDoTapete('mesa', 'redondo')).toBeUndefined()
    expect(normalizarFormaDoTapete(undefined, 'redondo')).toBeUndefined()
  })

  it('leitura do disco: forma torta some, forma em outro tipo some, o redondo fica no mesmo objeto', () => {
    const redondo = tapete({ mobiliaForma: 'redondo' })
    expect(propMobiliaFromFile(redondo)).toBe(redondo)
    const torto = JSON.parse(JSON.stringify({ ...tapete(), mobiliaForma: 'oval' })) as Prop // arquivo editado à mão: o JSON não segue o tipo
    expect(propMobiliaFromFile(torto)).not.toHaveProperty('mobiliaForma')
    expect(propMobiliaFromFile({ ...criarMovel('mesa', CENTRO, GRADE, 'm1'), mobiliaForma: 'redondo' })).not.toHaveProperty('mobiliaForma')
    // Objeto comum (sem tipo de móvel) perde a forma junto com o resto.
    const comum: Prop = { id: 'c', src: 'x.png', x: 0, y: 0, width: 10, height: 10, linkedMapPath: null, mobiliaForma: 'redondo' }
    expect(propMobiliaFromFile(comum)).not.toHaveProperty('mobiliaForma')
  })
})

describe('tapete — ordem de desenho', () => {
  it('os tapetes vêm primeiro, na ordem da lista; o resto na ordem de sempre', () => {
    const lista = [{ id: 'cadeira', mobilia: 'cadeira' as const }, { id: 't1', mobilia: 'tapete' as const }, { id: 'img' }, { id: 't2', mobilia: 'tapete' as const }]
    expect(emOrdemDeDesenho(lista).map((p) => p.id)).toEqual(['t1', 't2', 'cadeira', 'img'])
  })

  it('sem tapete, a mesma lista', () => {
    const lista = [{ id: 'a', mobilia: 'mesa' as const }, { id: 'b' }]
    expect(emOrdemDeDesenho(lista)).toBe(lista)
  })
})

describe('tapete — geometria', () => {
  it('tamanho não desenhável: sem contorno e sem desenho', () => {
    for (const [w, h] of [
      [0, 80],
      [-1, 80],
      [Number.NaN, 80],
      [120, Number.POSITIVE_INFINITY],
    ]) {
      expect(contornoDoTapete('retangular', w, h, 'frente')).toBeNull()
      expect(desenhoDoTapete('retangular', w, h, 'frente')).toEqual({ regioes: [], tracos: [] })
      expect(desenhoDoTapete('redondo', w, h, 'lado')).toEqual({ regioes: [], tracos: [] })
    }
  })

  it('retangular deitado: a silhueta recua a franja nas pontas curtas (esquerda e direita)', () => {
    const contorno = contornoDoTapete('retangular', 120, 80, 'frente')
    const franja = 80 * 0.06
    expect(contorno).toEqual([
      { x: -60 + franja, y: -40 },
      { x: 60 - franja, y: -40 },
      { x: 60 - franja, y: 40 },
      { x: -60 + franja, y: 40 },
    ])
  })

  it('retangular: 12 fios em cada ponta curta, que seguem o esticar (em pé, a franja vai para cima e para baixo)', () => {
    const deitado = desenhoDoTapete('retangular', 120, 80, 'frente').tracos
    const fiosDeitado = deitado.filter((t) => horizontal(t) && Math.abs(t.x2) > Math.abs(t.x1) && quase(Math.abs(t.x2), 60))
    expect(fiosDeitado).toHaveLength(24)

    const emPe = desenhoDoTapete('retangular', 80, 120, 'frente').tracos
    const fiosEmPe = emPe.filter((t) => t.x1 === t.x2 && quase(Math.abs(t.y2), 60))
    expect(fiosEmPe).toHaveLength(24)
    expect(fiosEmPe.every((t) => quase(Math.abs(t.y1), 60 - 80 * 0.06))).toBe(true)
  })

  it('redondo não tem franja: nenhum traço sai da elipse, e a silhueta é a elipse', () => {
    const { tracos, regioes } = desenhoDoTapete('redondo', 80, 80, 'frente')
    const raio = 40 + 1e-9
    expect(tracos.every((t) => Math.hypot(t.x1, t.y1) <= raio && Math.hypot(t.x2, t.y2) <= raio)).toBe(true)
    expect(regioes.map((r) => r.tom)).toEqual(['escuro', 'escuro'])
    expect(contornoDoTapete('redondo', 80, 80, 'frente')).toHaveLength(32)
  })

  it('borda e medalhão são as áreas escuras; o glifo é o que tracosDoGlifo desenha', () => {
    const { regioes, tracos } = desenhoDoTapete('retangular', 120, 80, 'frente')
    expect(regioes).toHaveLength(2)
    // O anel da borda: volta de fora (4) + fecho + volta de dentro (4) + fecho, num polígono só.
    expect(regioes[0]?.pontos).toHaveLength(10)
    expect(regioes[1]?.pontos).toHaveLength(4)
    expect(tracosDoGlifo('tapete', 120, 80)).toEqual(tracos)
    expect(tracosDoGlifo('tapete', 120, 80, 'frente', 0, 'redondo')).toEqual(desenhoDoTapete('redondo', 120, 80, 'frente').tracos)
  })

  it('de lado: a faixa vai de 60% da altura ao chão; retangular com dois fios por ponta, redondo sem', () => {
    const faixa = contornoDoTapete('retangular', 120, 10, 'lado') ?? []
    expect(faixa.map((p, i) => quase(p.y, [1, 1, 5, 5][i] ?? Number.NaN))).toEqual([true, true, true, true])
    const corpo = 60 - 120 * 0.04
    expect(faixa.map((p) => Math.abs(p.x))).toEqual([corpo, corpo, corpo, corpo])
    expect(contornoDoTapete('redondo', 80, 10, 'lado')?.map((p) => Math.abs(p.x))).toEqual([40, 40, 40, 40])
    expect(desenhoDoTapete('retangular', 120, 10, 'lado').tracos).toHaveLength(6)
    expect(desenhoDoTapete('redondo', 80, 10, 'lado').tracos).toHaveLength(2)
    expect(desenhoDoTapete('retangular', 120, 10, 'lado').regioes).toHaveLength(2)
    expect(tracosDoGlifo('tapete', 120, 10, 'lado')).toEqual(desenhoDoTapete('retangular', 120, 10, 'lado').tracos)
  })
})
