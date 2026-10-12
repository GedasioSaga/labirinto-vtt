import { describe, expect, it } from 'vitest'
import {
  avancarPoeira,
  chaoDoNivel,
  COLEGAS_NO_PALCO,
  dancar,
  DIM,
  estadoPorta,
  geometriaDoPalco,
  intensidadeDoHolofote,
  medidasDoPalco,
  nivelDoCombo,
  novoDancarino,
  ordemDosColegas,
  PORTA_DUR,
  POSE_CAIU,
  POSE_OPS,
  POSE_PARADA,
  poseDe,
  poseNoTempo,
  pontosFigura,
  runasAcesas,
  soltarPoeira,
  suavizarHolofote,
  VISUAL_COLEGAS,
  VISUAL_VOCE,
  visualDoColega,
} from './palco'
import type { TrilhaDanca } from './tipos'

const pose = (...lanes: TrilhaDanca[]) => poseDe(new Set(lanes), 1)

describe('poses', () => {
  it('uma seta por vez', () => {
    expect(pose(0)).toMatchObject({ bE: 'fora', bD: 'quadril', incl: -1, agacha: 0, pulo: 0 })
    expect(pose(3)).toMatchObject({ bE: 'quadril', bD: 'fora', incl: 1 })
    expect(pose(1)).toMatchObject({ bE: 'quadril', bD: 'quadril', agacha: 1, quadril: 1 })
    expect(poseDe(new Set<TrilhaDanca>([1]), -1).quadril).toBe(-1)
    expect(pose(2)).toMatchObject({ bE: 'cima', bD: 'cima', pulo: 1, incl: 0 })
  })

  it('saltos fazem a pose combinada', () => {
    expect(pose(0, 3)).toMatchObject({ bE: 'fora', bD: 'fora', incl: 0 })
    expect(pose(0, 2)).toMatchObject({ bE: 'diag', bD: 'cima', incl: 0, pulo: 1 })
    expect(pose(2, 3)).toMatchObject({ bE: 'cima', bD: 'diag' })
    expect(pose(1, 2)).toMatchObject({ bE: 'cima', bD: 'cima', agacha: 1, pulo: 0 })
    expect(pose(1, 3)).toMatchObject({ bE: 'quadril', bD: 'fora', agacha: 1, incl: 1 })
  })
})

describe('pontos da figura', () => {
  it('parada: quadril e ombro na altura das dimensões, braços simétricos', () => {
    const P = pontosFigura(0, 0, DIM.grande, POSE_PARADA)
    expect(P.qY).toBe(-13)
    expect(P.oY).toBe(-27)
    expect(P.qX).toBe(0)
    expect(P.esq.mao[0]).toBeCloseTo(-P.dir.mao[0], 9)
    expect(P.esq.mao[1]).toBeCloseTo(P.dir.mao[1], 9)
    expect(P.dir.mao[1]).toBeGreaterThan(P.dir.ombro[1])
  })

  it('agachar desce 30% da perna; caído, 55%; pulo sobe 1 px; balanço desce 1 px', () => {
    expect(pontosFigura(0, 0, DIM.grande, pose(1)).ag).toBe(4)
    expect(pontosFigura(0, 0, DIM.grande, POSE_CAIU).ag).toBe(7)
    expect(pontosFigura(0, 0, DIM.grande, pose(2)).qY).toBe(-14)
    expect(pontosFigura(0, 0, DIM.grande, POSE_PARADA, 1).qY).toBe(-12)
    expect(pontosFigura(0, 0, DIM.pequeno, POSE_PARADA).qY).toBe(-9)
  })

  it('↑ levanta as mãos acima da cabeça; inclinação anda o topo do tronco', () => {
    const P = pontosFigura(0, 0, DIM.grande, pose(2))
    expect(P.dir.mao[1]).toBeLessThan(P.oY - DIM.grande.cab)
    expect(pontosFigura(0, 0, DIM.grande, pose(0)).dxTopo).toBe(-2)
    expect(pontosFigura(0, 0, DIM.grande, pose(3)).cabX).toBeGreaterThan(0)
  })
})

describe('dançarino no tempo', () => {
  const ritmo = { batidaS: 0.5, grade0: 0 }

  it('duas setas a menos de 60 ms são o mesmo salto', () => {
    const d = novoDancarino()
    dancar(d, 0, 1, 0.5)
    dancar(d, 3, 1.05, 0.5)
    expect(d.pose).toMatchObject({ bE: 'fora', bD: 'fora' })
    dancar(d, 2, 1.2, 0.5)
    expect(d.pose).toMatchObject({ bE: 'cima', bD: 'cima', pulo: 1 })
  })

  it('↓ alterna o lado do quadril', () => {
    const d = novoDancarino()
    dancar(d, 1, 1, 0.5)
    const primeiro = d.pose.quadril
    dancar(d, 1, 2, 0.5)
    expect(d.pose.quadril).toBe(-primeiro)
  })

  it('a pose dura 3/4 de batida (mínimo 0,24 s) e depois volta a parada, balançando no começo da batida', () => {
    const d = novoDancarino()
    dancar(d, 0, 1, 0.5)
    expect(d.ate).toBeCloseTo(1.375, 9)
    expect(poseNoTempo(d, 1.3, ritmo, true).pose).toBe(d.pose)
    expect(poseNoTempo(d, 1.5, ritmo, true)).toEqual({ pose: POSE_PARADA, bob: 1 })
    expect(poseNoTempo(d, 1.7, ritmo, true)).toEqual({ pose: POSE_PARADA, bob: 0 })
    expect(poseNoTempo(d, 1.5, ritmo, false).bob).toBe(0)
    const rapido = novoDancarino()
    dancar(rapido, 0, 1, 0.2)
    expect(rapido.ate).toBeCloseTo(1.24, 9)
  })

  it('erro no Expert tropeça (é a hora da poeira); na Diversão só "ops"', () => {
    const d = novoDancarino()
    expect(dancar(d, 0, 1, 0.5, 'tropeco')).toBe(true)
    expect(d.pose.tropeco).toBe(-1)
    expect(d.ate).toBeCloseTo(1.42, 9)
    expect(dancar(d, 0, 2, 0.5, 'ops')).toBe(false)
    expect(d.pose).toBe(POSE_OPS)
  })

  it('caído fica caído', () => {
    const d = novoDancarino()
    d.caiu = true
    expect(dancar(d, 0, 1, 0.5)).toBe(false)
    expect(poseNoTempo(d, 1, ritmo, true)).toEqual({ pose: POSE_CAIU, bob: 0 })
  })
})

describe('porta', () => {
  it('fechada antes de abrir', () => {
    expect(estadoPorta(null, false)).toEqual({ runas: [0, 0, 0, 0], fresta: 0, abre: 0, luz: 0 })
    expect(estadoPorta(-0.1, false).abre).toBe(0)
  })

  it('runas uma a uma, fresta de luz, depois as folhas, em 2,4 s', () => {
    expect(estadoPorta(0.16, false).runas).toEqual([1, expect.closeTo(0.25, 9), 0, 0])
    expect(estadoPorta(0.52, false).runas).toEqual([1, 1, 1, 1])
    expect(estadoPorta(0.75, false).fresta).toBeCloseTo(0.5, 9)
    expect(estadoPorta(0.9, false).abre).toBe(0)
    const aberta = estadoPorta(PORTA_DUR, false)
    expect(aberta.abre).toBe(1)
    expect(aberta.luz).toBe(1)
    let antes = 0
    for (let s = 0; s <= PORTA_DUR; s += 0.05) {
      const a = estadoPorta(s, false).abre
      expect(a).toBeGreaterThanOrEqual(antes)
      antes = a
    }
  })

  it('com movimento reduzido, tudo junto em 0,4 s', () => {
    expect(estadoPorta(0.2, true)).toEqual({ runas: [0.5, 0.5, 0.5, 0.5], fresta: 0, abre: 0.5, luz: 0.5 })
    expect(estadoPorta(1, true).abre).toBe(1)
  })
})

describe('combo, holofote, chão e runas', () => {
  it('holofote abre no combo 10, 25 e 50', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 300].map(nivelDoCombo)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect([0, 1, 2, 3].map(chaoDoNivel)).toEqual([0, 0, 0.7, 1])
  })

  it('troca de nível suave, ~0,12 s', () => {
    expect(suavizarHolofote(0, 1, 0)).toBe(0)
    expect(suavizarHolofote(0, 1, 0.12)).toBeCloseTo(1 - Math.exp(-1), 9)
    expect(suavizarHolofote(0, 1, 5)).toBeCloseTo(1, 6)
  })

  it('runas acendem por quarto da música só com a nota passando', () => {
    expect(runasAcesas(true, 0.3)).toEqual([1, 1, 0, 0])
    expect(runasAcesas(false, 0.9)).toEqual([0, 0, 0, 0])
  })

  it('holofote mais forte nos pés que no alto, e mais forte a cada nível', () => {
    const geo = { w: 200, peY: 135 }
    expect(intensidadeDoHolofote(100, 134, geo, 0)).toBeGreaterThan(intensidadeDoHolofote(100, 20, geo, 0))
    expect(intensidadeDoHolofote(100, 60, geo, 3)).toBeGreaterThan(intensidadeDoHolofote(100, 60, geo, 0))
    expect(intensidadeDoHolofote(0, 60, geo, 3)).toBe(0)
  })

  it('poeira cai e some', () => {
    let graos = soltarPoeira({ w: 200, peY: 135 })
    expect(graos).toHaveLength(6)
    for (let i = 0; i < 10; i += 1) graos = avancarPoeira(graos, 0.05)
    expect(graos).toHaveLength(0)
  })
})

describe('geometria do palco', () => {
  it('escala inteira pela altura, nunca menor que 2', () => {
    expect(medidasDoPalco(390, 300)).toEqual({ esc: 2, w: 195, h: 150 })
    expect(medidasDoPalco(1440, 450)).toEqual({ esc: 3, w: 480, h: 150 })
    expect(medidasDoPalco(5, 300)).toBeNull()
  })

  it('os dois colegas de perto ficam onde ficavam Iara e Tomé no protótipo', () => {
    for (const [w, h] of [[195, 150], [480, 150]]) {
      const geo = geometriaDoPalco(w, h)
      const botY = Math.round(geo.base + (geo.peY - geo.base) * 0.42)
      const off = Math.min(w * 0.3, 70)
      expect(geo.colegas[0]).toEqual({ x: Math.round(w / 2 - off), y: botY })
      expect(geo.colegas[1]).toEqual({ x: Math.round(w / 2 + off), y: botY })
    }
  })

  it('4 lugares simétricos ao redor de você, dentro do palco, os de trás mais perto da parede', () => {
    for (const [w, h] of [[195, 150], [480, 150], [800, 200]]) {
      const geo = geometriaDoPalco(w, h)
      expect(geo.colegas).toHaveLength(COLEGAS_NO_PALCO)
      expect(geo.colegas[0].x + geo.colegas[1].x).toBeCloseTo(w, 0)
      expect(geo.colegas[2].x + geo.colegas[3].x).toBeCloseTo(w, 0)
      for (const c of geo.colegas) {
        expect(c.x).toBeGreaterThan(10)
        expect(c.x).toBeLessThan(w - 10)
        expect(c.y).toBeGreaterThan(geo.base)
        expect(c.y).toBeLessThan(geo.peY)
      }
      expect(geo.colegas[2].y).toBeLessThan(geo.colegas[0].y)
      expect(Math.abs(geo.colegas[2].x - w / 2)).toBeGreaterThan(Math.abs(geo.colegas[0].x - w / 2))
    }
  })

  it('desenha os de trás primeiro e nunca mais de 4', () => {
    const geo = geometriaDoPalco(480, 150)
    expect(ordemDosColegas(geo, 0)).toEqual([])
    expect(ordemDosColegas(geo, 1)).toEqual([0])
    expect(ordemDosColegas(geo, 2)).toEqual([0, 1])
    expect(ordemDosColegas(geo, 3)).toEqual([2, 0, 1])
    expect(ordemDosColegas(geo, 7)).toEqual([2, 3, 0, 1])
  })

  it('o chão cobre da parede até embaixo, de borda a borda', () => {
    const geo = geometriaDoPalco(195, 150)
    expect(geo.fileiras[0].y).toBe(geo.base)
    const ultima = geo.fileiras[geo.fileiras.length - 1]
    expect(ultima.y + ultima.alt).toBeGreaterThanOrEqual(geo.h)
    for (const f of geo.fileiras) {
      expect(f.ladrilhos[0].x - 1).toBeLessThanOrEqual(0)
      const fim = f.ladrilhos[f.ladrilhos.length - 1]
      expect(fim.x + fim.w).toBeGreaterThanOrEqual(geo.w)
    }
  })

  it('a porta fica centrada, com o vão acima do chão', () => {
    const geo = geometriaDoPalco(195, 150)
    expect(geo.porta.cx).toBe(98)
    expect(geo.porta.topo).toBe(geo.base - geo.porta.alt)
    expect(geo.porta.x0 + geo.porta.larg / 2).toBe(geo.porta.cx)
  })
})

describe('paletas', () => {
  it('quatro colegas com túnicas diferentes entre si e da sua; só você usa lenço', () => {
    const tunicas = new Set(VISUAL_COLEGAS.map((v) => v.tunica))
    expect(tunicas.size).toBe(4)
    expect(tunicas.has(VISUAL_VOCE.tunica)).toBe(false)
    expect(VISUAL_VOCE.lenco).not.toBeNull()
    for (const v of VISUAL_COLEGAS) expect(v.lenco).toBeNull()
    expect(new Set(VISUAL_COLEGAS.map((v) => v.estilo)).size).toBe(4)
  })

  it('o índice dá a volta', () => {
    expect(visualDoColega(0)).toBe(VISUAL_COLEGAS[0])
    expect(visualDoColega(5)).toBe(VISUAL_COLEGAS[1])
    expect(visualDoColega(-1)).toBe(VISUAL_COLEGAS[3])
  })
})
