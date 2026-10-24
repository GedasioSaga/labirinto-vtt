import { afterEach, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { luminanciaDoRgb } from '../texturas/meioTermo/barranco'
import { drawWalls, type WallWithStyle } from './drawWalls'
import { CORES_DA_GRADE, geometriaDaGrade } from './gradeDePrisao'

/**
 * GRADE DE PRISÃO no desenho (MT10): com a obra do Meio-Termo ligada, a
 * parede `janela` com `grade` vira barras de ferro vistas de cima (o trilho
 * e a cabeça de cada barra), na cor da paleta, com contorno escuro que nunca
 * é preto. Com a chave DESLIGADA nada muda: a mesma janela de traço duplo.
 */

afterEach(() => trocarObraNoTeste(false))

function janela(extra: Partial<WallWithStyle> = {}): WallWithStyle {
  return { id: 'j', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, janela: true, ...extra }
}

/** As instruções do Graphics num texto comparável (ação, estilo e o caminho). */
function resumo(g: Graphics): string {
  return JSON.stringify(
    g.context.instructions.map((i) => {
      if (i.action !== 'fill' && i.action !== 'stroke') return { acao: i.action }
      return {
        acao: i.action,
        cor: i.data.style.color,
        alfa: i.data.style.alpha,
        largura: 'width' in i.data.style ? i.data.style.width : undefined,
        caminho: i.data.path.instructions.map((p) => [p.action, ...p.data.filter((v: unknown) => typeof v === 'number')]),
      }
    }),
  )
}

function desenhar(walls: WallWithStyle[], escala = 1): Graphics {
  const g = new Graphics()
  drawWalls(g, walls, null, escala, 1)
  return g
}

function rgbDe(cor: number): [number, number, number] {
  return [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255]
}

describe('drawWalls: grade de prisão', () => {
  it('chave DESLIGADA: a janela com grade sai igual à janela sem grade', () => {
    for (const escala of [0.25, 1, 3]) {
      expect(resumo(desenhar([janela({ grade: true })], escala))).toBe(resumo(desenhar([janela()], escala)))
    }
  })

  it('chave ligada: vira barras de ferro (preenchidas) ao longo da parede, sem o traço duplo da janela', () => {
    trocarObraNoTeste(true)
    const comGrade = desenhar([janela({ grade: true })])
    const semGrade = desenhar([janela()])
    expect(resumo(comGrade)).not.toBe(resumo(semGrade))
    const preenchidas = comGrade.context.instructions.filter((i) => i.action === 'fill')
    const cores = new Set(preenchidas.map((i) => (i.action === 'fill' ? i.data.style.color : -1)))
    expect(cores.has(CORES_DA_GRADE.base)).toBe(true)
    const geo = geometriaDaGrade(janela({ grade: true }), 1)
    expect(geo.barras.length).toBeGreaterThanOrEqual(8)
    for (const b of geo.barras) {
      expect(Math.abs(b.y)).toBeLessThan(1e-9)
      expect(b.x).toBeGreaterThan(0)
      expect(b.x).toBeLessThan(100)
    }
  })

  it('o contorno é o tom escuro do ferro, nunca preto (luminância >= 0,06), e há o realce da luz', () => {
    expect(luminanciaDoRgb(rgbDe(CORES_DA_GRADE.contorno))).toBeGreaterThanOrEqual(0.06)
    expect(luminanciaDoRgb(rgbDe(CORES_DA_GRADE.realce))).toBeGreaterThan(luminanciaDoRgb(rgbDe(CORES_DA_GRADE.base)))
    trocarObraNoTeste(true)
    const g = desenhar([janela({ grade: true })])
    for (const i of g.context.instructions) {
      if (i.action !== 'fill' && i.action !== 'stroke') continue
      expect(luminanciaDoRgb(rgbDe(i.data.style.color))).toBeGreaterThanOrEqual(0.06)
    }
  })

  it('MT10b: em 4 zooms, trilho de pelo menos 2 px de tela, barra de 2 px de raio e passo de 7 px', () => {
    for (const escala of [0.25, 0.5, 1, 3]) {
      const geo = geometriaDaGrade(janela({ x2: 400 }), escala)
      expect(geo.raio * escala).toBeGreaterThanOrEqual(2)
      expect(geo.trilho * escala).toBeGreaterThanOrEqual(2)
      const xs = geo.barras.map((b) => b.x)
      const passos = xs.slice(1).map((x, k) => x - xs[k])
      expect(Math.min(...passos) * escala).toBeGreaterThanOrEqual(7)
      // Espaçadas por igual: o mesmo passo do começo ao fim.
      expect(Math.max(...passos) - Math.min(...passos)).toBeLessThan(1e-6)
    }
  })

  it('MT10b: lê como trilho contínuo com contas a 50%, 100% e 300% (contas maiores que o trilho, sem se encostarem)', () => {
    for (const escala of [0.5, 1, 3]) {
      const geo = geometriaDaGrade(janela({ x2: 400 }), escala)
      const conta = 2 * geo.raio + 2 * geo.contorno
      const trilho = geo.trilho + 2 * geo.contorno
      const passo = geo.barras[1].x - geo.barras[0].x
      // A conta sai do trilho dos dois lados: o diâmetro dela passa de 1,4 vezes a largura do trilho.
      expect(conta / trilho).toBeGreaterThanOrEqual(1.4)
      // Entre duas contas sobra trilho à vista: pelo menos 1 px de tela.
      expect((passo - conta) * escala).toBeGreaterThanOrEqual(1)
    }
    // O reforço a 100% que o usuário pediu (24/10): o trilho de antes tinha 1,6 px e a barra 1,9 px de raio.
    const a100 = geometriaDaGrade(janela({ x2: 400 }), 1)
    expect(a100.trilho).toBeGreaterThanOrEqual(2.4)
    expect(a100.raio).toBeGreaterThanOrEqual(2.4)
  })

  it('grade sem janela, ou parede com porta, não vira grade (a regra da MT9)', () => {
    trocarObraNoTeste(true)
    const { janela: _j, ...comum } = janela()
    const semJanela: WallWithStyle = { ...comum, grade: true }
    expect(resumo(desenhar([semJanela]))).toBe(resumo(desenhar([comum])))
    const porta: Wall['door'] = { open: false, locked: false, kind: 'normal' }
    expect(resumo(desenhar([janela({ door: porta, grade: true })]))).toBe(resumo(desenhar([janela({ door: porta })])))
  })

  it('a parede invisível continua invisível (o mesmo de sem grade)', () => {
    trocarObraNoTeste(true)
    const g1 = new Graphics()
    drawWalls(g1, [janela({ hidden: true, grade: true })], null, 1, 1, null, true)
    const g2 = new Graphics()
    drawWalls(g2, [janela({ hidden: true })], null, 1, 1, null, true)
    expect(resumo(g1)).toBe(resumo(g2))
  })
})
