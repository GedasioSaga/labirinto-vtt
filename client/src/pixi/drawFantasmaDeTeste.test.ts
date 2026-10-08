import { describe, expect, it } from 'vitest'
import { Graphics, type FillInstruction, type StrokeInstruction } from 'pixi.js'
import type { FantasmaDeTeste } from '../net/visaoDeTeste/tipos'
import type { MapData, Token } from '../types/map'
import {
  ANEL_FIO_SCREEN_PX,
  ANEL_LARGURA_SCREEN_PX,
  LIGACAO_FOLGA_SCREEN_PX,
  LIGACAO_PASSO_SCREEN_PX,
  TINTA_APAGADA_DO_TESTE,
  TINTA_CLARA_DO_TESTE,
  TINTA_ESCURA_DO_TESTE,
  drawAnelDoTeste,
  drawEtiquetaDoTeste,
  drawLigacaoDoTeste,
  fantasmaNaCena,
  raioDoFantasma,
} from './drawFantasmaDeTeste'
import { tokenCircleRadius } from './drawTokens'

/**
 * Visão de jogador, entrega 3 — o DESENHO do fantasma da ficha de teste: onde
 * ele existe (só na cena aberta, com a ficha à vista) e a geometria das três
 * marcas do teste (anel, ligação, etiqueta), em px de tela onde é traço.
 */

function ficha(sobra: Partial<Token> = {}): Token {
  return { id: 'aria', characterId: null, name: 'Aria', x: 160, y: 160, size: 1, image: null, ...sobra }
}

function cena(sobra: Partial<Pick<MapData, 'id' | 'tokens' | 'hiddenLayers'>> = {}): Pick<MapData, 'id' | 'tokens' | 'hiddenLayers'> {
  return { id: 'cripta', tokens: [ficha()], hiddenLayers: [], ...sobra }
}

const NO_TESTE: FantasmaDeTeste = { tokenId: 'aria', mapId: 'cripta', x: 480, y: 160 }

function tracos(g: Graphics): StrokeInstruction[] {
  return g.context.instructions.filter((i): i is StrokeInstruction => i.action === 'stroke')
}

function preenchimentos(g: Graphics): FillInstruction[] {
  return g.context.instructions.filter((i): i is FillInstruction => i.action === 'fill')
}

/** Centros dos círculos de um preenchimento, na ordem em que foram desenhados. */
function centros(fill: FillInstruction | undefined): { x: number; y: number; r: number }[] {
  return (fill?.data.path.instructions ?? [])
    .filter((i) => i.action === 'circle')
    .map((i) => ({ x: Number(i.data[0]), y: Number(i.data[1]), r: Number(i.data[2]) }))
}

describe('fantasmaNaCena — o fantasma só existe na cena aberta, com a ficha à vista', () => {
  it('sem fantasma, nada', () => {
    expect(fantasmaNaCena(null, cena())).toBeNull()
  })

  it('na cena do teste, com a ficha nela: a ficha de verdade e o ponto do teste', () => {
    const map = cena()
    expect(fantasmaNaCena(NO_TESTE, map)).toEqual({ ficha: map.tokens[0], x: 480, y: 160 })
  })

  it('a ficha está no teste em OUTRA cena: nada nesta', () => {
    expect(fantasmaNaCena({ ...NO_TESTE, mapId: 'torre' }, cena())).toBeNull()
  })

  it('a ficha não está na cena aberta (apagada, ou de outra cena): nada, sem cara para copiar', () => {
    expect(fantasmaNaCena(NO_TESTE, cena({ tokens: [ficha({ id: 'outra' })] }))).toBeNull()
  })

  it('camada Fichas oculta: o fantasma some junto com as fichas', () => {
    expect(fantasmaNaCena(NO_TESTE, cena({ hiddenLayers: ['tokens'] }))).toBeNull()
  })

  it('no mesmo ponto da ficha de verdade não há o que mostrar', () => {
    expect(fantasmaNaCena({ ...NO_TESTE, x: 160, y: 160 }, cena())).toBeNull()
  })

  it('ponto inválido (NaN, infinito) não desenha', () => {
    expect(fantasmaNaCena({ ...NO_TESTE, x: Number.NaN }, cena())).toBeNull()
    expect(fantasmaNaCena({ ...NO_TESTE, y: Number.POSITIVE_INFINITY }, cena())).toBeNull()
  })
})

describe('raioDoFantasma — o mesmo tamanho da ficha de verdade', () => {
  it('o raio do contorno do círculo genérico, para qualquer tamanho', () => {
    for (const size of [0.5, 1, 2, 3]) expect(raioDoFantasma(64, size)).toBe(tokenCircleRadius(64, size))
  })
})

describe('drawAnelDoTeste — fio escuro contínuo e tracejado claro, em px de tela', () => {
  it('dois traços: o fio escuro por baixo e os traços claros por cima', () => {
    const g = new Graphics()
    drawAnelDoTeste(g, 30, 1)
    const [fio, claro, ...resto] = tracos(g)
    expect(resto).toHaveLength(0)
    expect(fio?.data.style).toMatchObject({ color: TINTA_ESCURA_DO_TESTE, width: ANEL_FIO_SCREEN_PX })
    expect(claro?.data.style).toMatchObject({ color: TINTA_CLARA_DO_TESTE, width: ANEL_LARGURA_SCREEN_PX })
  })

  it('a espessura na tela não muda com o zoom', () => {
    for (const escala of [0.5, 1, 2]) {
      const g = new Graphics()
      drawAnelDoTeste(g, 30, escala)
      const [fio, claro] = tracos(g)
      expect((fio?.data.style.width ?? 0) * escala).toBeCloseTo(ANEL_FIO_SCREEN_PX)
      expect((claro?.data.style.width ?? 0) * escala).toBeCloseTo(ANEL_LARGURA_SCREEN_PX)
    }
  })

  it('o ritmo do tracejado é de tela: mais traços com zoom, nunca menos de 8', () => {
    const longe = drawAnelDoTeste(new Graphics(), 30, 0.5)
    const perto = drawAnelDoTeste(new Graphics(), 30, 2)
    expect(perto).toBeGreaterThan(longe)
    expect(drawAnelDoTeste(new Graphics(), 2, 0.1)).toBe(8)
  })

  it('raio zero ou inválido: só limpa', () => {
    const g = new Graphics()
    drawAnelDoTeste(g, 30, 1)
    expect(drawAnelDoTeste(g, 0, 1)).toBe(0)
    expect(g.context.instructions).toHaveLength(0)
  })
})

describe('drawLigacaoDoTeste — pontos da ficha de verdade até o fantasma', () => {
  const DE = { x: 160, y: 160, raio: 32 }

  it('casas vizinhas: não cabe ponto no vão, nada é desenhado', () => {
    const g = new Graphics()
    expect(drawLigacaoDoTeste(g, DE, { x: 224, y: 160, raio: 32 }, 1)).toBe(0)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('longe: pontos meio-tom com halo escuro, só no vão entre as bordas, no passo de tela', () => {
    const g = new Graphics()
    const pontos = drawLigacaoDoTeste(g, DE, { x: 480, y: 160, raio: 32 }, 1)
    expect(pontos).toBeGreaterThan(2)
    const [halo, claro] = preenchimentos(g)
    expect(halo?.data.style.color).toBe(TINTA_ESCURA_DO_TESTE)
    expect(claro?.data.style.color).toBe(TINTA_APAGADA_DO_TESTE)
    const lista = centros(claro)
    expect(lista).toHaveLength(pontos)
    expect(lista.every((c) => c.y === 160)).toBe(true)
    expect(lista[0].x).toBeGreaterThanOrEqual(160 + 32 + LIGACAO_FOLGA_SCREEN_PX)
    expect(lista[lista.length - 1].x).toBeLessThanOrEqual(480 - 32 - LIGACAO_FOLGA_SCREEN_PX)
    expect(lista[1].x - lista[0].x).toBeCloseTo(LIGACAO_PASSO_SCREEN_PX)
    // Centrada no vão: sobra igual dos dois lados.
    expect(lista[0].x - (160 + 32)).toBeCloseTo(480 - 32 - lista[lista.length - 1].x)
  })

  it('o passo é de tela: com zoom 2 os pontos ficam a meio passo de mundo', () => {
    const g = new Graphics()
    drawLigacaoDoTeste(g, DE, { x: 480, y: 160, raio: 32 }, 2)
    const lista = centros(preenchimentos(g)[1])
    expect((lista[1].x - lista[0].x) * 2).toBeCloseTo(LIGACAO_PASSO_SCREEN_PX)
  })

  it('na diagonal, todos os pontos ficam na reta entre os dois centros', () => {
    const g = new Graphics()
    drawLigacaoDoTeste(g, DE, { x: 480, y: 480, raio: 32 }, 1)
    for (const c of centros(preenchimentos(g)[1])) expect(c.x - 160).toBeCloseTo(c.y - 160)
  })
})

describe('drawEtiquetaDoTeste — a pílula "Teste" do selo da janela', () => {
  it('pedra quase opaca com a borda tracejada clara, por dentro da pílula', () => {
    const placa = new Graphics()
    const { largura, altura } = drawEtiquetaDoTeste(placa, 30)
    expect(largura).toBe(44)
    expect(altura).toBe(17)
    const [fundo] = preenchimentos(placa)
    expect(fundo?.data.style.color).toBe(TINTA_ESCURA_DO_TESTE)
    const [borda] = tracos(placa)
    expect(borda?.data.style).toMatchObject({ color: 0xffffff, alpha: 0.26, width: 1 })
    // Tracejada: um moveTo por traço, e todos os pontos dentro da pílula.
    const caminho = borda?.data.path.instructions ?? []
    expect(caminho.filter((i) => i.action === 'moveTo').length).toBeGreaterThan(10)
    for (const i of caminho) {
      expect(Math.abs(Number(i.data[0]))).toBeLessThanOrEqual(largura / 2)
      expect(Number(i.data[1])).toBeGreaterThanOrEqual(0)
      expect(Number(i.data[1])).toBeLessThanOrEqual(altura)
    }
  })

  it('texto curtíssimo ainda dá uma pílula redonda, nunca mais estreita que alta', () => {
    const { largura, altura } = drawEtiquetaDoTeste(new Graphics(), 0)
    expect(largura).toBeGreaterThanOrEqual(altura)
  })
})
