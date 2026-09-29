import { describe, expect, it } from 'vitest'
import {
  comAparenciaDoMovel,
  criarMovel,
  ehMovelRedondo,
  ehTipoMobilia,
  LADOS_DA_ELIPSE,
  movelComOutroTipo,
  NOME_COM_ARTIGO,
  normalizarCorDoMovel,
  pontosDaElipse,
  propMobiliaFromFile,
  ROTULO_MOBILIA,
  TIPOS_MOBILIA,
  tracosDoGlifo,
} from './mobilia'
import type { Prop } from '../types/map'

/**
 * MOBÍLIA DESENHADA — o catálogo (barril, caixa, baú, cama, mesa, cadeira), o móvel que a ferramenta
 * Objetos põe no mapa e o glifo de cada tipo, tudo sem Pixi.
 */

const GRADE = 40

describe('catálogo da mobília', () => {
  it('tem barril, caixa, baú, cama, mesa e cadeira, nessa ordem, com o nome que a setinha mostra', () => {
    expect([...TIPOS_MOBILIA]).toEqual(['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira'])
    expect(TIPOS_MOBILIA.map((tipo) => ROTULO_MOBILIA[tipo])).toEqual(['Barril', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Cadeira'])
  })

  it('a cama guarda o id antigo do catre: mapa salvo com catre abre com a cama', () => {
    expect(ehTipoMobilia('catre')).toBe(true)
    expect(ROTULO_MOBILIA.catre).toBe('Cama')
    expect(NOME_COM_ARTIGO.catre).toBe('uma cama')
  })

  it('reconhece só os tipos do catálogo', () => {
    for (const tipo of ['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira']) expect(ehTipoMobilia(tipo)).toBe(true)
    expect(ehTipoMobilia('dragão')).toBe(false)
    expect(ehTipoMobilia(undefined)).toBe(false)
    expect(ehTipoMobilia(3)).toBe(false)
  })
})

describe('criarMovel — o móvel que a ferramenta Objetos põe', () => {
  it('é um objeto sem imagem, com o tipo, no centro pedido e do tamanho padrão em casas da grade', () => {
    const catre = criarMovel('catre', { x: 250, y: 300 }, GRADE, 'movel-1')
    expect(catre).toEqual({ id: 'movel-1', src: '', x: 250, y: 300, width: GRADE, height: 2 * GRADE, linkedMapPath: null, mobilia: 'catre' })
  })

  it('a mesa é deitada (mais larga que alta) e o baú é menor que uma casa de altura', () => {
    const mesa = criarMovel('mesa', { x: 0, y: 0 }, GRADE, 'm')
    expect(mesa.width).toBe(2 * GRADE)
    expect(mesa.height).toBe(GRADE)
    const bau = criarMovel('bau', { x: 0, y: 0 }, GRADE, 'b')
    expect(bau.width).toBe(GRADE)
    expect(bau.height).toBeGreaterThan(0)
    expect(bau.height).toBeLessThan(GRADE)
  })

  it('barril, caixa e cadeira são quadrados e cabem numa casa, a cadeira o menor deles', () => {
    for (const tipo of ['barril', 'caixa', 'cadeira'] as const) {
      const movel = criarMovel(tipo, { x: 0, y: 0 }, GRADE, tipo)
      expect(movel.width).toBe(movel.height)
      expect(movel.width).toBeGreaterThan(0)
      expect(movel.width).toBeLessThan(GRADE)
    }
    const cadeira = criarMovel('cadeira', { x: 0, y: 0 }, GRADE, 'c')
    expect(cadeira.width).toBeLessThan(criarMovel('barril', { x: 0, y: 0 }, GRADE, 'b').width)
    expect(cadeira.width).toBeLessThan(criarMovel('caixa', { x: 0, y: 0 }, GRADE, 'x').width)
  })
})

describe('silhueta redonda', () => {
  it('só o barril é redondo', () => {
    expect(TIPOS_MOBILIA.filter((tipo) => ehMovelRedondo(tipo))).toEqual(['barril'])
    expect(ehMovelRedondo(undefined)).toBe(false)
  })

  it('pontosDaElipse: cada ponto na elipse inscrita, começando à direita', () => {
    const pontos = pontosDaElipse(60, 40)
    expect(pontos).toHaveLength(LADOS_DA_ELIPSE)
    expect(pontos[0].x).toBeCloseTo(30, 9)
    expect(pontos[0].y).toBeCloseTo(0, 9)
    for (const p of pontos) expect((p.x / 30) ** 2 + (p.y / 20) ** 2).toBeCloseTo(1, 9)
    // Um quarto de volta adiante é o ponto de baixo (y cresce para baixo na tela).
    expect(pontos[LADOS_DA_ELIPSE / 4].x).toBeCloseTo(0, 9)
    expect(pontos[LADOS_DA_ELIPSE / 4].y).toBeCloseTo(20, 9)
  })
})

describe('tracosDoGlifo — os traços finos dentro da silhueta', () => {
  it('cada tipo tem um desenho próprio, não vazio', () => {
    const catre = tracosDoGlifo('catre', 40, 80)
    const mesa = tracosDoGlifo('mesa', 80, 40)
    const bau = tracosDoGlifo('bau', 40, 24)
    expect(catre.length).toBeGreaterThan(0)
    expect(mesa.length).toBeGreaterThan(0)
    expect(bau.length).toBeGreaterThan(0)
    // Mesmo tamanho, desenho diferente: o jogador distingue um do outro.
    const desenhos = TIPOS_MOBILIA.map((tipo) => JSON.stringify(tracosDoGlifo(tipo, 60, 60)))
    expect(new Set(desenhos).size).toBe(TIPOS_MOBILIA.length)
  })

  it('caixa: o X de canto a canto', () => {
    expect(tracosDoGlifo('caixa', 40, 40)).toEqual([
      { x1: -20, y1: -20, x2: 20, y2: 20 },
      { x1: 20, y1: -20, x2: -20, y2: 20 },
    ])
  })

  it('cadeira: o encosto é uma linha de lado a lado no terço de cima', () => {
    const [encosto, ...resto] = tracosDoGlifo('cadeira', 40, 40)
    expect(resto).toEqual([])
    expect(encosto.x1).toBe(-20)
    expect(encosto.x2).toBe(20)
    expect(encosto.y1).toBe(encosto.y2)
    expect(encosto.y1).toBeLessThan(-20 + 40 / 3)
    expect(encosto.y1).toBeGreaterThan(-20)
  })

  it('barril: a borda da tampa é um anel fechado, menor que a silhueta e centrado', () => {
    const tampa = tracosDoGlifo('barril', 40, 40)
    expect(tampa.length).toBeGreaterThan(8)
    tampa.forEach((t, i) => {
      const proximo = tampa[(i + 1) % tampa.length]
      expect(t.x2).toBeCloseTo(proximo.x1, 9)
      expect(t.y2).toBeCloseTo(proximo.y1, 9)
      const raio = Math.hypot(t.x1, t.y1)
      expect(raio).toBeGreaterThan(5)
      expect(raio).toBeLessThan(20)
    })
  })

  it('todo traço cabe dentro do retângulo do móvel (centro na origem)', () => {
    for (const tipo of TIPOS_MOBILIA) {
      const tracos = tracosDoGlifo(tipo, 40, 80)
      expect(tracos.length).toBeGreaterThan(0)
      for (const t of tracos) {
        for (const [x, y] of [
          [t.x1, t.y1],
          [t.x2, t.y2],
        ]) {
          expect(Math.abs(x)).toBeLessThanOrEqual(20)
          expect(Math.abs(y)).toBeLessThanOrEqual(40)
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
        }
      }
    }
  })

  it('tamanho não desenhável não tem traço', () => {
    expect(tracosDoGlifo('catre', 0, 80)).toEqual([])
    expect(tracosDoGlifo('mesa', Number.NaN, 40)).toEqual([])
  })
})

describe('propMobiliaFromFile — leitura do arquivo', () => {
  const base: Prop = { id: 'p', src: '', x: 1, y: 2, width: 3, height: 4, linkedMapPath: null }

  it('objeto sem o campo passa igual, sem ganhar chave', () => {
    const lido = propMobiliaFromFile(base)
    expect(lido).toEqual(base)
    expect(lido).not.toHaveProperty('mobilia')
  })

  it('tipo do catálogo fica; tipo desconhecido some e o objeto volta a ser objeto comum', () => {
    expect(propMobiliaFromFile({ ...base, mobilia: 'mesa' })).toEqual({ ...base, mobilia: 'mesa' })
    const torto = JSON.parse(JSON.stringify({ ...base, mobilia: 'trono' })) as Prop // arquivo editado à mão: o tipo mente de propósito
    const lido = propMobiliaFromFile(torto)
    expect(lido).toEqual(base)
    expect(lido).not.toHaveProperty('mobilia')
  })

  it('aparência válida fica; móvel sem aparência passa igual (mesmo objeto)', () => {
    const pintado: Prop = { ...base, mobilia: 'mesa', mobiliaPreenchido: false, mobiliaCor: '#8b4513', mobiliaCorDaLinha: '#c0392b' }
    expect(propMobiliaFromFile(pintado)).toEqual(pintado)
    const simples: Prop = { ...base, mobilia: 'mesa' }
    expect(propMobiliaFromFile(simples)).toBe(simples)
  })

  it('cor torta some, cor curta ou maiúscula normaliza, "Preencher" só guarda o desligado', () => {
    const torto = JSON.parse(
      JSON.stringify({ ...base, mobilia: 'mesa', mobiliaPreenchido: 'nao', mobiliaCor: 'vermelho', mobiliaCorDaLinha: '#C0392B' }),
    ) as Prop // arquivo editado à mão: os tipos mentem de propósito
    expect(propMobiliaFromFile(torto)).toEqual({ ...base, mobilia: 'mesa', mobiliaCorDaLinha: '#c0392b' })
    expect(propMobiliaFromFile({ ...base, mobilia: 'mesa', mobiliaPreenchido: true })).toEqual({ ...base, mobilia: 'mesa' })
  })

  it('sem tipo válido, a aparência de móvel some junto', () => {
    const torto = JSON.parse(JSON.stringify({ ...base, mobilia: 'trono', mobiliaPreenchido: false, mobiliaCor: '#8b4513' })) as Prop // arquivo editado à mão
    expect(propMobiliaFromFile(torto)).toEqual(base)
    // Objeto comum com os campos (arquivo editado à mão): também somem.
    expect(propMobiliaFromFile({ ...base, mobiliaCorDaLinha: '#c0392b' })).toEqual(base)
  })
})

describe('normalizarCorDoMovel — só cor #rrggbb entra', () => {
  it('aceita #rrggbb e #rgb e devolve sempre #rrggbb minúsculo', () => {
    expect(normalizarCorDoMovel('#8b4513')).toBe('#8b4513')
    expect(normalizarCorDoMovel('#8B4513')).toBe('#8b4513')
    expect(normalizarCorDoMovel('#A50')).toBe('#aa5500')
  })

  it('qualquer outra coisa vira ausente', () => {
    for (const valor of ['vermelho', '#12345', '#1234567', '#ggg', ' #8b4513', '8b4513', 'url(javascript:x)', '', 12, null, undefined, {}, ['#8b4513']]) {
      expect(normalizarCorDoMovel(valor), JSON.stringify(valor)).toBeUndefined()
    }
  })
})

describe('movelComOutroTipo — o "Tipo" do painel', () => {
  const mesa: Prop = {
    ...criarMovel('mesa', { x: 300, y: 200 }, GRADE, 'm1'),
    rotation: 90,
    layer: 'decoracao',
    locked: true,
    hidden: true,
    secret: true,
    piso: 1,
    playerLabel: 'Mesa do capitão',
    mobiliaPreenchido: false,
    mobiliaCor: '#8b4513',
    mobiliaCorDaLinha: '#c0392b',
  }

  it('troca o tipo e o tamanho pelo padrão do tipo novo; o resto fica', () => {
    const bau = movelComOutroTipo(mesa, 'bau', GRADE)
    const padrao = criarMovel('bau', { x: 0, y: 0 }, GRADE, 'x')
    expect(bau).toEqual({ ...mesa, mobilia: 'bau', width: padrao.width, height: padrao.height })
  })

  it('o centro e o giro não mudam, mesmo com o tamanho novo', () => {
    const cama = movelComOutroTipo(mesa, 'catre', GRADE)
    expect({ x: cama.x, y: cama.y, rotation: cama.rotation }).toEqual({ x: 300, y: 200, rotation: 90 })
    expect({ width: cama.width, height: cama.height }).toEqual({ width: GRADE, height: 2 * GRADE })
  })
})

describe('comAparenciaDoMovel — "Preencher", "Cor" e "Cor da linha"', () => {
  const mesa = criarMovel('mesa', { x: 0, y: 0 }, GRADE, 'm1')

  it('"Preencher" desligado grava false; religado volta à ausência (o padrão)', () => {
    const vazada = comAparenciaDoMovel(mesa, { preenchido: false })
    expect(vazada.mobiliaPreenchido).toBe(false)
    const cheia = comAparenciaDoMovel(vazada, { preenchido: true })
    expect(cheia).toEqual(mesa)
    expect(cheia).not.toHaveProperty('mobiliaPreenchido')
  })

  it('cor válida grava normalizada; null volta ao padrão (tira o campo)', () => {
    const pintada = comAparenciaDoMovel(mesa, { cor: '#8B4513', corDaLinha: '#A50' })
    expect(pintada.mobiliaCor).toBe('#8b4513')
    expect(pintada.mobiliaCorDaLinha).toBe('#aa5500')
    const padrao = comAparenciaDoMovel(pintada, { cor: null, corDaLinha: null })
    expect(padrao).toEqual(mesa)
  })

  it('cor torta não entra: o campo fica como estava', () => {
    const pintada = comAparenciaDoMovel(mesa, { cor: '#8b4513' })
    expect(comAparenciaDoMovel(pintada, { cor: 'url(javascript:x)' }).mobiliaCor).toBe('#8b4513')
    expect(comAparenciaDoMovel(mesa, { corDaLinha: 'vermelho' })).not.toHaveProperty('mobiliaCorDaLinha')
  })

  it('o que não veio no pedido não muda', () => {
    const pintada = comAparenciaDoMovel(mesa, { preenchido: false, cor: '#8b4513' })
    expect(comAparenciaDoMovel(pintada, { corDaLinha: '#c0392b' })).toEqual({ ...pintada, mobiliaCorDaLinha: '#c0392b' })
  })
})
