import { describe, expect, it } from 'vitest'
import { Graphics, type GraphicsPath } from 'pixi.js'
import {
  DOOR_COLOR,
  DOOR_EDGE_COLOR,
  DOOR_EDGE_SCREEN_PX,
  DOOR_LOCKED_COLOR,
  DOOR_LOCKED_RING_SCREEN_PX,
  DOOR_PADLOCK_BODY_H_SCREEN_PX,
  DOOR_PADLOCK_BODY_W_SCREEN_PX,
  DOOR_PADLOCK_FILL,
  DOOR_THICKNESS_SCREEN_PX,
  SECRET_DOOR_DASHES,
  corDaPortaNoMapa,
  drawDoors,
} from './drawDoors'
import { SELECTION_COLOR } from './constants'
import { COR_DA_PORTA_PADRAO } from '../lib/corDaPorta'
import { parseHexColor } from '../lib/tokenColor'
import type { DoorState, Wall } from '../types/map'

/**
 * COR DA PORTA (fatia 22): com cor própria a porta é pintada nela nos três
 * estados, e a trancada ganha contorno vermelho por fora e cadeado. Sem cor (ou
 * com cor torta) o desenho é EXATAMENTE o de sempre, instrução por instrução.
 */
const AZUL = '#79a9cc'
const AZUL_PIXI = 0x79a9cc

function porta(door: Partial<DoorState>, wall: Partial<Wall> = {}): Wall {
  return { id: 'p', x1: 100, y1: 200, x2: 200, y2: 200, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', ...door }, ...wall }
}

function desenhar(walls: Wall[], selecionada: string | null = null, escala = 1): Graphics {
  const g = new Graphics()
  drawDoors(g, walls, selecionada, escala)
  return g
}

/** O desenho inteiro em dado comparável: ação, cor, largura e o path de cada instrução. */
function desenho(g: Graphics): unknown[] {
  return g.context.instructions.map((instrucao) => {
    if (instrucao.action === 'texture') return { action: 'texture' }
    const largura = instrucao.action === 'stroke' ? instrucao.data.style.width : null
    const caminho = JSON.stringify(instrucao.data.path.instructions.map((p) => [p.action, p.data]))
    return { action: instrucao.action, color: instrucao.data.style.color, alpha: instrucao.data.style.alpha, largura, caminho }
  })
}

function preenchimentos(g: Graphics) {
  return g.context.instructions.flatMap((i) => (i.action === 'fill' ? [i] : []))
}

function tracos(g: Graphics) {
  return g.context.instructions.flatMap((i) => (i.action === 'stroke' ? [i] : []))
}

/** Caixa do primeiro `poly` (ou `rect`) do path, em mundo. */
function caixa(instrucao: { data: { path: GraphicsPath } }) {
  const forma = instrucao.data.path.instructions.find((p) => p.action === 'poly' || p.action === 'rect')
  if (forma === undefined) throw new Error('instrução sem poly nem rect')
  if (forma.action === 'rect') return { w: Number(forma.data[2]), h: Number(forma.data[3]) }
  const pontos = Array.isArray(forma.data[0]) ? forma.data[0].map(Number) : []
  const xs = pontos.filter((_, i) => i % 2 === 0)
  const ys = pontos.filter((_, i) => i % 2 === 1)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

describe('drawDoors — cor própria da porta', () => {
  it('fechada com cor: a folha na cor dela, com o contorno escuro, sem anel nem cadeado', () => {
    const g = desenhar([porta({ cor: AZUL })])
    expect(preenchimentos(g).map((f) => f.data.style.color)).toEqual([DOOR_EDGE_COLOR, AZUL_PIXI])
    expect(tracos(g)).toHaveLength(0)
  })

  it('aberta com cor: o batente na cor dela e na mesma caixa da aberta de sempre', () => {
    const comCor = desenhar([porta({ open: true, cor: AZUL })])
    const deSempre = desenhar([porta({ open: true })])
    expect(preenchimentos(comCor).map((f) => f.data.style.color)).toEqual([DOOR_EDGE_COLOR, AZUL_PIXI, DOOR_EDGE_COLOR])
    expect(tracos(comCor)).toHaveLength(0)
    expect(preenchimentos(comCor).map(caixa)).toEqual(preenchimentos(deSempre).map(caixa))
  })

  it('trancada com cor: cheia na cor dela, contorno vermelho POR FORA do escuro e cadeado opaco no meio', () => {
    const g = desenhar([porta({ locked: true, cor: AZUL })])
    const [fora, folha] = preenchimentos(g)
    expect(fora.data.style.color).toBe(DOOR_EDGE_COLOR)
    expect(folha.data.style.color).toBe(AZUL_PIXI)
    expect(caixa(fora).h).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX + DOOR_EDGE_SCREEN_PX, 9)
    // O contorno vermelho: a borda de dentro encosta no contorno escuro, a de fora sai da porta.
    const aro = tracos(g).find((s) => s.data.style.color === DOOR_LOCKED_COLOR && s.data.path.instructions.some((p) => p.action === 'poly'))
    if (aro === undefined) throw new Error('trancada com cor sem o contorno vermelho')
    const largura = aro.data.style.width
    expect(largura).toBeGreaterThanOrEqual(DOOR_LOCKED_RING_SCREEN_PX)
    expect(caixa(aro).h - largura).toBeCloseTo(DOOR_THICKNESS_SCREEN_PX + DOOR_EDGE_SCREEN_PX, 9)
    // O cadeado: corpo creme com traço vermelho e a alça — tudo opaco.
    expect(preenchimentos(g).some((f) => f.data.style.color === DOOR_PADLOCK_FILL)).toBe(true)
    expect(tracos(g).some((s) => s.data.path.instructions.some((p) => p.action === 'arc'))).toBe(true)
    for (const instrucao of [...preenchimentos(g), ...tracos(g)]) expect(instrucao.data.style.alpha).toBe(1)
  })

  it('o cadeado tem 6 por 5 px fixos na TELA: o corpo mede o mesmo em px de tela a 100%, 250% e 400%', () => {
    expect([DOOR_PADLOCK_BODY_W_SCREEN_PX, DOOR_PADLOCK_BODY_H_SCREEN_PX]).toEqual([6, 5])
    for (const escala of [1, 2.5, 4]) {
      const corpo = preenchimentos(desenhar([porta({ locked: true, cor: AZUL })], null, escala)).find((f) => f.data.style.color === DOOR_PADLOCK_FILL)
      if (corpo === undefined) throw new Error(`sem cadeado a ${escala}x`)
      expect(caixa(corpo).w * escala).toBeCloseTo(6, 9)
      expect(caixa(corpo).h * escala).toBeCloseTo(5, 9)
    }
  })

  it('selecionada e trancada com cor: a moldura de seleção fica por fora do contorno vermelho', () => {
    const g = desenhar([porta({ locked: true, cor: AZUL })], 'p')
    const [moldura] = tracos(g)
    expect(moldura.data.style.color).toBe(SELECTION_COLOR)
    const aro = tracos(g).find((s) => s.data.style.color === DOOR_LOCKED_COLOR && s.data.path.instructions.some((p) => p.action === 'poly'))
    if (aro === undefined) throw new Error('sem o contorno vermelho')
    // Borda de dentro da moldura = borda de fora do aro.
    expect(caixa(moldura).h - moldura.data.style.width).toBeCloseTo(caixa(aro).h + aro.data.style.width, 9)
  })

  it('secreta com cor: os traços na cor dela, cada um com o contorno; trancada NUNCA leva cadeado nem anel', () => {
    const solta = desenhar([porta({ secret: true, cor: AZUL })])
    const escuros = Array.from({ length: SECRET_DOOR_DASHES }, () => DOOR_EDGE_COLOR)
    const azuis = Array.from({ length: SECRET_DOOR_DASHES }, () => AZUL_PIXI)
    expect(preenchimentos(solta).map((f) => f.data.style.color)).toEqual([...escuros, ...azuis])
    const trancada = desenhar([porta({ secret: true, locked: true, cor: AZUL })])
    expect(preenchimentos(trancada).map((f) => f.data.style.color)).toEqual([...escuros, ...azuis])
    expect(preenchimentos(trancada).some((f) => f.data.style.color === DOOR_PADLOCK_FILL)).toBe(false)
    expect(tracos(trancada)).toHaveLength(0)
  })

  it('a seta da porta de um lado sai na cor dela, com o contorno escuro', () => {
    const g = desenhar([porta({ cor: AZUL, opensFrom: 'right' })])
    expect(preenchimentos(g).map((f) => f.data.style.color)).toEqual([DOOR_EDGE_COLOR, AZUL_PIXI, AZUL_PIXI])
    expect(tracos(g).map((s) => s.data.style.color)).toEqual([DOOR_EDGE_COLOR])
  })
})

describe('drawDoors — sem cor própria, o desenho de sempre', () => {
  const estados: [string, Partial<DoorState>, Partial<Wall>?][] = [
    ['fechada', {}],
    ['aberta', { open: true }],
    ['trancada', { locked: true }],
    ['secreta trancada', { secret: true, locked: true }],
    ['de um lado', { opensFrom: 'left' }],
    ['dupla', { kind: 'double' }],
  ]

  it('trancada sem cor: a folha vermelha com o contorno escuro e mais nada (nem cadeado, nem anel)', () => {
    const g = desenhar([porta({ locked: true })])
    expect(desenho(g)).toHaveLength(2)
    expect(preenchimentos(g).map((f) => f.data.style.color)).toEqual([DOOR_EDGE_COLOR, DOOR_LOCKED_COLOR])
  })

  /*
   * O desenho NOVO travado, instrução por instrução (valores de ouro conferidos
   * à mão contra o `.mapa .porta-folha` do protótipo consolidado: rect de vão x 4
   * com stroke de 1 centrado → 101 x 5 escuro por fora, 99 x 3 creme por dentro).
   */
  it('sem cor: fechada, aberta e trancada no desenho novo, caixa por caixa', () => {
    const forma = (g: Graphics) => preenchimentos(g).map((f) => ({ cor: f.data.style.color, ...caixa(f) }))
    const perto = (v: number) => Math.round(v * 1e6) / 1e6
    const arredondar = (l: { cor: number; w: number; h: number }[]) => l.map((c) => ({ cor: c.cor, w: perto(c.w), h: perto(c.h) }))
    expect(arredondar(forma(desenhar([porta({})])))).toEqual([
      { cor: 0x15181a, w: 101, h: 5 },
      { cor: 0xd9d2c0, w: 99, h: 3 },
    ])
    expect(arredondar(forma(desenhar([porta({ open: true })])))).toEqual([
      { cor: 0x15181a, w: 101, h: 5 },
      { cor: 0xd9d2c0, w: 99, h: 3 },
      { cor: 0x15181a, w: 97, h: 1 },
    ])
    expect(arredondar(forma(desenhar([porta({ locked: true, open: true })])))).toEqual([
      { cor: 0x15181a, w: 101, h: 5 },
      { cor: 0xe2645a, w: 99, h: 3 },
    ])
  })

  it('cor torta (nome, hex curto, javascript:) desenha igual à porta sem cor, em todo estado', () => {
    for (const [nome, door] of estados) {
      const deSempre = desenho(desenhar([porta(door)], 'p'))
      for (const torta of ['red', '#12', 'javascript:alert(1)', '#79a9cg', '']) {
        expect(desenho(desenhar([porta({ ...door, cor: torta })], 'p')), `${nome}, cor ${torta}`).toEqual(deSempre)
      }
    }
  })

  it('a cor de cada estado continua a de sempre', () => {
    expect(corDaPortaNoMapa({ locked: false })).toBe(DOOR_COLOR)
    expect(corDaPortaNoMapa({ locked: true })).toBe(DOOR_LOCKED_COLOR)
    expect(corDaPortaNoMapa({ locked: true, cor: AZUL })).toBe(AZUL_PIXI)
    // O padrão em CSS ("Outra cor…", miniatura do jogador) é o mesmo creme do Pixi.
    expect(parseHexColor(COR_DA_PORTA_PADRAO)).toBe(DOOR_COLOR)
    expect(COR_DA_PORTA_PADRAO).toBe('#d9d2c0')
  })
})
