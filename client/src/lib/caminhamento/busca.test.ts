/**
 * MOTOR DE CAMINHAMENTO — a busca: contorna parede e sala, atravessa porta
 * destrancada marcando onde abrir e fechar, para na trancada com o motivo,
 * não passa por janela nem por vão estreito, não corta quina, desvia das
 * outras fichas sem nunca encostar, e devolve sempre o mesmo caminho.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { caminhoAgora, CacheDeMalhas } from './agenda'
import { acharCaminhoNaMalha, avancarBusca, type ConsultaDeCaminho, type FichaNoCaminho, iniciarBusca, type ResultadoDoCaminho } from './busca'
import { confereCaminho, GRID, inicioEFim, mapa, parede, paredeComVao, porta } from './caminho.fixture'
import { distanciaAteParede, folgaDaParede } from './malha'
import { montarMalha } from './marcos'

const R1 = GRID / 2
const R2 = GRID

function caminho(walls: Wall[], de: Point, para: Point, raio = R1, fichas: FichaNoCaminho[] = [], largura = 15, altura = 10): ResultadoDoCaminho {
  return caminhoAgora(new CacheDeMalhas(), mapa(walls, largura, altura), raio, { de, para, fichas })
}

function pontosDe(r: ResultadoDoCaminho) {
  if (r.tipo !== 'caminho') throw new Error(`sem caminho: ${r.motivo}`)
  return r.pontos
}

describe('busca: paredes, salas e quinas', () => {
  it('reta livre: o próprio traço', () => {
    expect(pontosDe(caminho([], { x: 96, y: 96 }, { x: 608, y: 352 }))).toEqual([
      { x: 96, y: 96 },
      { x: 608, y: 352 },
    ])
  })

  it('parede no meio: contorna pela ponta, sem atravessar, com poucas curvas', () => {
    const walls = [parede('w', 384, 128, 384, 320)]
    const pontos = pontosDe(caminho(walls, { x: 224, y: 224 }, { x: 608, y: 224 }))
    expect(inicioEFim(pontos)).toEqual([{ x: 224, y: 224 }, { x: 608, y: 224 }])
    expect(pontos.length).toBeGreaterThan(2)
    expect(pontos.length).toBeLessThanOrEqual(4)
    confereCaminho(pontos, walls, R1)
  })

  it('sala com a abertura do outro lado: dá a volta e entra pela abertura', () => {
    // Caixa de (256,128) a (576,448); a única abertura é na parede da direita, y 256..320.
    const walls = [
      parede('n', 256, 128, 576, 128),
      parede('s', 256, 448, 576, 448),
      parede('o', 256, 128, 256, 448),
      parede('l1', 576, 128, 576, 256),
      parede('l2', 576, 320, 576, 448),
    ]
    const pontos = pontosDe(caminho(walls, { x: 160, y: 288 }, { x: 416, y: 288 }))
    confereCaminho(pontos, walls, R1)
    expect(pontos.some((p) => p.x > 576)).toBe(true)
  })

  it('não corta quina: fora das pernas, todo traço guarda a folga das paredes', () => {
    const walls = [parede('v', 384, 128, 384, 320), parede('h', 384, 320, 576, 320)]
    const pontos = pontosDe(caminho(walls, { x: 352, y: 352 }, { x: 416, y: 288 }))
    confereCaminho(pontos, walls, R1)
    const folga = folgaDaParede(R1, GRID)
    for (let i = 2; i < pontos.length - 1; i += 1) {
      const a = pontos[i - 1]
      const b = pontos[i]
      if (a === undefined || b === undefined) continue
      for (const w of walls) expect(distanciaAteParede(a, b, w)).toBeGreaterThanOrEqual(folga - 1e-9)
    }
  })

  it('sala fechada: sem caminho, com o motivo', () => {
    const walls = [parede('n', 256, 128, 576, 128), parede('s', 256, 448, 576, 448), parede('o', 256, 128, 256, 448), parede('l', 576, 128, 576, 448)]
    expect(caminho(walls, { x: 96, y: 96 }, { x: 416, y: 288 })).toEqual({ tipo: 'sem-caminho', motivo: 'sem-caminho', portas: [], fichas: [] })
  })
})

describe('busca: portas, janelas e vãos', () => {
  const de = { x: 224, y: 96 }
  const para = { x: 608, y: 96 }

  it('porta fechada e destrancada: atravessa, abrindo diante dela e fechando logo depois', () => {
    const walls = paredeComVao(384, 256, 320, 10, { door: porta() })
    const r = caminho(walls, de, para)
    const pontos = pontosDe(r)
    expect(r.tipo === 'caminho' && r.portas).toBe(1)
    const abrir = pontos.findIndex((p) => p.abrir === 'vao')
    expect(abrir).toBeGreaterThan(0)
    const antes = pontos[abrir]
    const depois = pontos[abrir + 1]
    expect(antes?.x).toBeLessThan(384)
    expect(depois?.fechar).toBe('vao')
    expect(depois?.x).toBeGreaterThan(384)
    confereCaminho(pontos, walls, R1)
  })

  it('porta aberta: passa sem abrir nem fechar', () => {
    const walls = paredeComVao(384, 256, 320, 10, { door: porta({ open: true }) })
    const r = caminho(walls, de, para)
    expect(pontosDe(r).some((p) => p.abrir !== undefined || p.fechar !== undefined)).toBe(false)
    expect(r.tipo === 'caminho' && r.portas).toBe(0)
  })

  it('porta trancada: sem caminho, motivo porta trancada, com a porta', () => {
    for (const door of [porta({ locked: true }), porta({ open: true, locked: true })]) {
      expect(caminho(paredeComVao(384, 256, 320, 10, { door }), de, para)).toEqual({ tipo: 'sem-caminho', motivo: 'porta-trancada', portas: ['vao'], fichas: [] })
    }
  })

  it('porta trancada com outra volta aberta: vai pela volta', () => {
    const walls = [parede('cima', 384, 0, 384, 256), parede('vao', 384, 256, 384, 320, { door: porta({ locked: true }) }), parede('baixo', 384, 320, 384, 512)]
    const pontos = pontosDe(caminho(walls, de, para))
    expect(pontos.some((p) => p.y > 512)).toBe(true)
    confereCaminho(pontos, walls, R1)
  })

  it('porta secreta é parede: sem caminho, sem entregar que é porta', () => {
    const walls = paredeComVao(384, 256, 320, 10, { door: porta({ locked: true, secret: true }) })
    expect(caminho(walls, de, para)).toEqual({ tipo: 'sem-caminho', motivo: 'sem-caminho', portas: [], fichas: [] })
  })

  it('porta de um lado: fechada, só abre de quem está do lado certo', () => {
    // Na porta (384,256)->(384,320), quem está a oeste (x < 384) está do lado 'right' (`sideOfWall`).
    const walls = paredeComVao(384, 256, 320, 10, { door: porta({ opensFrom: 'right' }) })
    expect(caminho(walls, de, para).tipo).toBe('caminho')
    expect(caminho(walls, para, de)).toEqual({ tipo: 'sem-caminho', motivo: 'sem-caminho', portas: [], fichas: [] })
  })

  it('janela barra o passo, marcada ou não como "barra movimento"', () => {
    for (const blocksMove of [true, false]) {
      const walls = paredeComVao(384, 256, 320, 10, { janela: true, blocksMove })
      expect(caminho(walls, de, para)).toEqual({ tipo: 'sem-caminho', motivo: 'sem-caminho', portas: [], fichas: [] })
    }
  })

  it('vão mais estreito que a ficha não é usado; do tamanho dela, é', () => {
    // Ficha de 1 casa: vão de 3/4 de casa não, de 1 casa sim.
    expect(caminho(paredeComVao(384, 256, 304, 10), de, para).tipo).toBe('sem-caminho')
    confereCaminho(pontosDe(caminho(paredeComVao(384, 256, 320, 10), de, para)), paredeComVao(384, 256, 320, 10), R1)
    // Ficha de 2 casas (anda pelos cantos da grade): vão de 1 casa não, de 2 sim.
    const de2 = { x: 256, y: 128 }
    const para2 = { x: 576, y: 128 }
    expect(caminho(paredeComVao(384, 256, 320, 10), de2, para2, R2).tipo).toBe('sem-caminho')
    const largo = paredeComVao(384, 256, 384, 10)
    confereCaminho(pontosDe(caminho(largo, de2, para2, R2)), largo, R2)
  })
})

describe('busca: outras fichas', () => {
  // Corredor horizontal de y 192 a 384 (3 casas de largura), o mapa todo de comprido.
  const corredorLargo = [parede('n', 0, 192, 960, 192), parede('s', 0, 384, 960, 384)]
  // Corredor de 1 casa: y 256 a 320.
  const corredorEstreito = [parede('n', 0, 256, 960, 256), parede('s', 0, 320, 960, 320)]

  it('ficha no meio do corredor largo: contorna, sem encostar', () => {
    const fichas = [{ id: 't', x: 480, y: 288, raio: R1 }]
    const r = caminho(corredorLargo, { x: 96, y: 288 }, { x: 864, y: 288 }, R1, fichas)
    const pontos = pontosDe(r)
    confereCaminho(pontos, corredorLargo, R1, fichas)
    expect(r.tipo === 'caminho' && r.comprimento).toBeGreaterThan(768)
  })

  it('ficha no corredor estreito: sem caminho, ocupado, com a ficha', () => {
    const fichas = [{ id: 't', x: 480, y: 288, raio: R1 }]
    expect(caminho(corredorEstreito, { x: 96, y: 288 }, { x: 864, y: 288 }, R1, fichas)).toEqual({ tipo: 'sem-caminho', motivo: 'ocupado', portas: [], fichas: ['t'] })
  })

  it('ficha em cima do destino: ocupado', () => {
    const fichas = [{ id: 'dono', x: 864, y: 288, raio: R1 }]
    expect(caminho([], { x: 96, y: 288 }, { x: 864, y: 288 }, R1, fichas)).toMatchObject({ tipo: 'sem-caminho', motivo: 'ocupado', fichas: ['dono'] })
  })

  it('ficha encostada no ponto de saída não prende o NPC', () => {
    const fichas = [{ id: 'colada', x: 100, y: 288, raio: R1 }]
    expect(caminho([], { x: 96, y: 288 }, { x: 864, y: 288 }, R1, fichas).tipo).toBe('caminho')
  })

  it('ficha no corredor E porta trancada no fim: o motivo é a porta, não a ficha', () => {
    const walls = [...corredorEstreito, parede('fundo', 640, 256, 640, 320, { door: porta({ locked: true }) })]
    const fichas = [{ id: 't', x: 352, y: 288, raio: R1 }]
    expect(caminho(walls, { x: 96, y: 288 }, { x: 864, y: 288 }, R1, fichas)).toEqual({ tipo: 'sem-caminho', motivo: 'porta-trancada', portas: ['fundo'], fichas: [] })
  })
})

describe('busca: determinismo', () => {
  const walls = [
    parede('a', 192, 0, 192, 448),
    parede('b', 384, 192, 384, 640),
    parede('c', 576, 0, 576, 256, {}),
    parede('d', 576, 256, 576, 320, { door: porta() }),
    parede('e', 576, 320, 576, 512),
    parede('f', 768, 128, 768, 640),
  ]
  const consulta: ConsultaDeCaminho = { de: { x: 96, y: 96 }, para: { x: 864, y: 96 }, fichas: [{ id: 'x', x: 480, y: 96, raio: R1 }] }

  it('mesma entrada, mesmo caminho; fatiado ou de uma vez', () => {
    const inteiro = acharCaminhoNaMalha(montarMalha(mapa(walls), R1), walls, consulta)
    expect(inteiro.tipo).toBe('caminho')
    expect(acharCaminhoNaMalha(montarMalha(mapa(walls), R1), walls, consulta)).toEqual(inteiro)
    const b = iniciarBusca(montarMalha(mapa(walls), R1), walls, consulta)
    let fatias = 0
    while (!avancarBusca(b, 3)) fatias += 1
    expect(fatias).toBeGreaterThan(5)
    expect(b.resultado).toEqual(inteiro)
    confereCaminho(pontosDe(inteiro), walls, R1, consulta.fichas)
  })
})
