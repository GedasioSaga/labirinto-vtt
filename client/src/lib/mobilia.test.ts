import { describe, expect, it } from 'vitest'
import {
  aceitaVista,
  chamaDaFogueira,
  comAparenciaDoMovel,
  contornoDeLado,
  criarMovel,
  ehMovelRedondo,
  ehMovelVazado,
  ehTipoMobilia,
  geometriaDaCerca,
  LADOS_DA_ELIPSE,
  movelComOutraVista,
  movelComOutroTipo,
  NOME_COM_ARTIGO,
  normalizarCorDoMovel,
  normalizarVistaDoMovel,
  pontosDaElipse,
  propMobiliaFromFile,
  ROTULO_MOBILIA,
  ROTULO_VISTA,
  TIPOS_COM_VISTA,
  TIPOS_MOBILIA,
  tracosDoGlifo,
  vistaDoMovel,
  VISTAS_MOBILIA,
} from './mobilia'
import type { Prop, TipoMobilia } from '../types/map'

/**
 * MOBÍLIA DESENHADA — o catálogo (barril, caixa, baú, cama, mesa, cadeira, cerca), o móvel que a ferramenta
 * Objetos põe no mapa e o glifo de cada tipo, tudo sem Pixi.
 */

const GRADE = 40

describe('catálogo da mobília', () => {
  it('tem barril, caixa, baú, cama, mesa, cadeira, cerca, armário de cozinha, aparador e fogueira, nessa ordem, com o nome que a setinha mostra', () => {
    expect([...TIPOS_MOBILIA]).toEqual(['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira'])
    expect(TIPOS_MOBILIA.map((tipo) => ROTULO_MOBILIA[tipo])).toEqual(['Barril', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Cadeira', 'Cerca', 'Armário de cozinha', 'Aparador', 'Fogueira'])
  })

  it('a cama guarda o id antigo do catre: mapa salvo com catre abre com a cama', () => {
    expect(ehTipoMobilia('catre')).toBe(true)
    expect(ROTULO_MOBILIA.catre).toBe('Cama')
    expect(NOME_COM_ARTIGO.catre).toBe('uma cama')
  })

  it('reconhece só os tipos do catálogo', () => {
    for (const tipo of ['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira']) expect(ehTipoMobilia(tipo)).toBe(true)
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
  it('só o barril e a fogueira (de cima) são redondos', () => {
    expect(TIPOS_MOBILIA.filter((tipo) => ehMovelRedondo(tipo))).toEqual(['barril', 'fogueira'])
    expect(ehMovelRedondo('fogueira', 'lado')).toBe(false)
    expect(ehMovelRedondo('barril', 'lado')).toBe(true)
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

describe('cerca — mourões redondos ligados por um fio', () => {
  /** Posição de cada mourão ao longo do comprimento (x deitada, y em pé), em ordem. */
  function posicoes(largura: number, altura: number): number[] {
    const geometria = geometriaDaCerca(largura, altura)
    if (geometria === null) throw new Error('cerca sem geometria')
    const deitada = largura >= altura
    return geometria.mouroes.map((m) => (deitada ? m.x : m.y)).sort((a, b) => a - b)
  }

  it('está no catálogo com o nome da setinha e não tem vista de lado', () => {
    expect(ehTipoMobilia('cerca')).toBe(true)
    expect(ROTULO_MOBILIA.cerca).toBe('Cerca')
    expect(NOME_COM_ARTIGO.cerca).toBe('uma cerca')
    expect(aceitaVista('cerca')).toBe(false)
    expect(ehMovelRedondo('cerca')).toBe(false)
  })

  it('o trecho padrão tem 2 casas de comprimento e 1/4 de casa de espessura', () => {
    const cerca = criarMovel('cerca', { x: 100, y: 100 }, GRADE, 'c')
    expect(cerca.width).toBe(2 * GRADE)
    expect(cerca.height).toBe(0.25 * GRADE)
  })

  it('é o único móvel vazado: sem caixa de silhueta atrás, o chão aparece entre os mourões', () => {
    expect(ehMovelVazado('cerca')).toBe(true)
    for (const tipo of TIPOS_MOBILIA.filter((t) => t !== 'cerca')) expect(ehMovelVazado(tipo)).toBe(false)
    expect(ehMovelVazado(undefined)).toBe(false)
  })

  it('mourão é um círculo pequeno (diâmetro 0,2 a 0,25 casa) no eixo da cerca, dentro do trecho', () => {
    const geometria = geometriaDaCerca(2 * GRADE, GRADE / 4)
    if (geometria === null) throw new Error('cerca sem geometria')
    expect(2 * geometria.raio).toBeGreaterThanOrEqual(0.2 * GRADE)
    expect(2 * geometria.raio).toBeLessThanOrEqual(0.25 * GRADE)
    for (const m of geometria.mouroes) {
      expect(m.y).toBe(0)
      expect(Math.abs(m.x) + geometria.raio).toBeLessThanOrEqual(GRADE + 1e-9)
    }
  })

  it('2 casas: mourão nas duas pontas e um no meio, ~1 casa entre eles', () => {
    const xs = posicoes(2 * GRADE, GRADE / 4)
    expect(xs).toHaveLength(3)
    expect(xs[0]).toBeLessThan(-0.75 * GRADE)
    expect(xs[2]).toBeGreaterThan(0.75 * GRADE)
    expect(xs[1]).toBeCloseTo(0, 9)
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThan(0.75 * GRADE)
      expect(xs[i] - xs[i - 1]).toBeLessThan(1.25 * GRADE)
    }
  })

  it('esticada para 6 casas: 7 mourões, ~1 casa entre eles', () => {
    const xs = posicoes(6 * GRADE, GRADE / 4)
    expect(xs).toHaveLength(7)
    expect(xs[0]).toBeLessThan(-2.75 * GRADE)
    expect(xs[6]).toBeGreaterThan(2.75 * GRADE)
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThan(0.75 * GRADE)
      expect(xs[i] - xs[i - 1]).toBeLessThan(1.25 * GRADE)
    }
  })

  it('esticada na altura (cerca em pé), corre na vertical do mesmo jeito', () => {
    const geometria = geometriaDaCerca(GRADE / 4, 6 * GRADE)
    if (geometria === null) throw new Error('cerca sem geometria')
    expect(geometria.mouroes).toHaveLength(7)
    for (const m of geometria.mouroes) expect(m.x).toBe(0)
  })

  it('curta demais ainda tem os dois mourões das pontas', () => {
    expect(posicoes(GRADE / 2, GRADE / 4)).toHaveLength(2)
  })

  it('glifo: um círculo por mourão e UM fio no eixo, de borda a borda entre mourões vizinhos, sem ripas', () => {
    const largura = 6 * GRADE
    const altura = GRADE / 4
    const geometria = geometriaDaCerca(largura, altura)
    if (geometria === null) throw new Error('cerca sem geometria')
    const tracos = tracosDoGlifo('cerca', largura, altura)
    const fio = tracos.filter((t) => t.y1 === 0 && t.y2 === 0)
    // Fio: um pedaço entre cada par de mourões vizinhos, juntos correndo do primeiro ao último.
    expect(fio).toHaveLength(geometria.mouroes.length - 1)
    const xs = posicoes(largura, altura)
    fio
      .map((t) => [Math.min(t.x1, t.x2), Math.max(t.x1, t.x2)])
      .sort((a, b) => a[0] - b[0])
      .forEach(([de, ate], i) => {
        expect(de).toBeCloseTo(xs[i] + geometria.raio, 9)
        expect(ate).toBeCloseTo(xs[i + 1] - geometria.raio, 9)
      })
    // O resto são os círculos: todo ponto a `raio` do centro de algum mourão.
    const circulos = tracos.filter((t) => !fio.includes(t))
    expect(circulos.length).toBeGreaterThanOrEqual(geometria.mouroes.length * 8)
    for (const t of circulos) {
      for (const [x, y] of [[t.x1, t.y1], [t.x2, t.y2]]) {
        const naBorda = geometria.mouroes.some((m) => Math.abs(Math.hypot(x - m.x, y - m.y) - geometria.raio) < 1e-9)
        expect(naBorda).toBe(true)
      }
    }
    // Nenhuma ripa: nenhum traço corre o comprimento inteiro.
    for (const t of tracos) expect(Math.abs(t.x2 - t.x1)).toBeLessThan(1.25 * GRADE)
  })

  it('tamanho não desenhável não tem traço nem geometria', () => {
    expect(tracosDoGlifo('cerca', 0, 10)).toEqual([])
    expect(tracosDoGlifo('cerca', 80, Number.NaN)).toEqual([])
    expect(tracosDoGlifo('cerca', -80, 10)).toEqual([])
    expect(geometriaDaCerca(0, 10)).toBeNull()
    expect(geometriaDaCerca(80, Number.NaN)).toBeNull()
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

  it('a cadeira de lado passa igual (mesmo objeto)', () => {
    const deLado: Prop = { ...base, mobilia: 'cadeira', mobiliaVista: 'lado' }
    expect(propMobiliaFromFile(deLado)).toBe(deLado)
  })

  it('vista torta, "frente" gravada ou vista num tipo sem vista: o campo some e o móvel fica', () => {
    const torta = JSON.parse(JSON.stringify({ ...base, mobilia: 'cadeira', mobiliaVista: 'diagonal' })) as Prop // arquivo editado à mão: a vista mente de propósito
    const casos: [Prop, TipoMobilia][] = [
      [torta, 'cadeira'],
      [{ ...base, mobilia: 'bau', mobiliaVista: 'frente' }, 'bau'],
      [{ ...base, mobilia: 'mesa', mobiliaVista: 'lado' }, 'mesa'],
    ]
    for (const [movel, tipo] of casos) {
      const lido = propMobiliaFromFile(movel)
      expect(lido, tipo).toEqual({ ...base, mobilia: tipo })
      expect(lido, tipo).not.toHaveProperty('mobiliaVista')
    }
  })

  it('sem tipo válido, a vista some junto', () => {
    const torto = JSON.parse(JSON.stringify({ ...base, mobilia: 'trono', mobiliaVista: 'lado' })) as Prop // arquivo editado à mão
    expect(propMobiliaFromFile(torto)).toEqual(base)
    expect(propMobiliaFromFile(torto)).not.toHaveProperty('mobiliaVista')
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

  it('a vista de lado some num tipo sem vista e fica num tipo com vista (com o tamanho de lado dele)', () => {
    const cadeiraDeLado = movelComOutraVista(criarMovel('cadeira', { x: 300, y: 200 }, GRADE, 'c1'), 'lado', GRADE)
    expect(movelComOutroTipo(cadeiraDeLado, 'mesa', GRADE)).not.toHaveProperty('mobiliaVista')
    const bau = movelComOutroTipo(cadeiraDeLado, 'bau', GRADE)
    expect(bau.mobiliaVista).toBe('lado')
    expect({ width: bau.width, height: bau.height }).toEqual({ width: 0.6 * GRADE, height: 0.6 * GRADE })
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

/** Contorno de lado de um tipo que aceita vista (o teste falha alto se vier nulo). */
function contornoDe(tipo: TipoMobilia, largura: number, altura: number): { x: number; y: number }[] {
  const contorno = contornoDeLado(tipo, largura, altura)
  if (contorno === null) throw new Error(`${tipo} devia ter contorno de lado`)
  return contorno
}

describe('vista do móvel — frente ou lado, só nos tipos com vista', () => {
  it('só cadeira, baú, armário de cozinha, aparador e fogueira aceitam vista; as vistas são Frente e Lado, nessa ordem', () => {
    expect([...TIPOS_COM_VISTA]).toEqual(['cadeira', 'bau', 'armario', 'aparador', 'fogueira'])
    expect(TIPOS_MOBILIA.filter((tipo) => aceitaVista(tipo))).toEqual(['bau', 'cadeira', 'armario', 'aparador', 'fogueira'])
    expect(aceitaVista(undefined)).toBe(false)
    expect(VISTAS_MOBILIA.map((vista) => ROTULO_VISTA[vista])).toEqual(['Frente', 'Lado'])
  })

  it('normalizarVistaDoMovel: só "lado" num tipo com vista fica; o resto vira ausente', () => {
    expect(normalizarVistaDoMovel('cadeira', 'lado')).toBe('lado')
    expect(normalizarVistaDoMovel('bau', 'lado')).toBe('lado')
    for (const valor of ['frente', 'LADO', ' lado', '', 1, null, undefined, {}, ['lado']]) {
      expect(normalizarVistaDoMovel('cadeira', valor), JSON.stringify(valor)).toBeUndefined()
    }
    expect(normalizarVistaDoMovel('mesa', 'lado')).toBeUndefined()
    expect(normalizarVistaDoMovel(undefined, 'lado')).toBeUndefined()
  })

  it('vistaDoMovel: ausente é frente; "lado" num tipo sem vista também é frente', () => {
    expect(vistaDoMovel({ mobilia: 'cadeira' })).toBe('frente')
    expect(vistaDoMovel({ mobilia: 'cadeira', mobiliaVista: 'lado' })).toBe('lado')
    expect(vistaDoMovel({ mobilia: 'mesa', mobiliaVista: 'lado' })).toBe('frente')
  })
})

describe('movelComOutraVista — a "Vista" do painel', () => {
  const cadeira: Prop = {
    ...criarMovel('cadeira', { x: 300, y: 200 }, GRADE, 'c1'),
    rotation: 90,
    layer: 'decoracao',
    locked: true,
    hidden: true,
    playerLabel: 'Cadeira do capitão',
    mobiliaPreenchido: false,
    mobiliaCor: '#8b4513',
    mobiliaCorDaLinha: '#c0392b',
  }

  it('de lado grava "lado" e o tamanho vai para o de lado; centro, giro, camada, cores e o resto ficam', () => {
    expect(movelComOutraVista(cadeira, 'lado', GRADE)).toEqual({ ...cadeira, mobiliaVista: 'lado', width: 0.5 * GRADE, height: 0.75 * GRADE })
  })

  it('de volta à frente o campo some e o tamanho volta ao de frente', () => {
    const deVolta = movelComOutraVista(movelComOutraVista(cadeira, 'lado', GRADE), 'frente', GRADE)
    expect(deVolta).toEqual(cadeira)
    expect(deVolta).not.toHaveProperty('mobiliaVista')
  })

  it('o baú de lado é mais estreito que o de frente, com a mesma altura', () => {
    const bau = criarMovel('bau', { x: 300, y: 200 }, GRADE, 'b1')
    const deLado = movelComOutraVista(bau, 'lado', GRADE)
    expect(deLado.width).toBeLessThan(bau.width)
    expect(deLado.height).toBe(bau.height)
  })

  it('tipo sem vista devolve o mesmo móvel', () => {
    const mesa = criarMovel('mesa', { x: 300, y: 200 }, GRADE, 'm1')
    expect(movelComOutraVista(mesa, 'lado', GRADE)).toBe(mesa)
  })
})

describe('desenho de lado — cadeira em L e baú com a tampa em arco', () => {
  it('a cadeira e o baú de lado desenham outra coisa; os outros tipos ignoram a vista', () => {
    for (const tipo of TIPOS_MOBILIA) {
      if (aceitaVista(tipo)) {
        expect(tracosDoGlifo(tipo, 40, 60, 'lado'), tipo).not.toEqual(tracosDoGlifo(tipo, 40, 60, 'frente'))
        expect(contornoDeLado(tipo, 40, 60), tipo).not.toBeNull()
      } else {
        expect(tracosDoGlifo(tipo, 40, 60, 'lado'), tipo).toEqual(tracosDoGlifo(tipo, 40, 60))
        expect(contornoDeLado(tipo, 40, 60), tipo).toBeNull()
      }
    }
    expect(tracosDoGlifo('cadeira', 40, 60, 'frente')).toEqual(tracosDoGlifo('cadeira', 40, 60))
  })

  it('a cadeira de lado é um L: o encosto sobe numa ponta, o assento atravessa e tem uma perna em cada lado', () => {
    const contorno = contornoDe('cadeira', 40, 60)
    expect(contorno).toHaveLength(6)
    const topo = Math.min(...contorno.map((p) => p.y))
    expect(topo).toBe(-30)
    // Só o encosto chega ao topo, e ele fica numa ponta (a esquerda).
    for (const p of contorno.filter((q) => q.y === topo)) expect(p.x).toBeLessThan(0)
    // Na outra ponta só há o assento, bem abaixo do topo.
    const pontaDoAssento = contorno.filter((p) => p.x === 20)
    expect(pontaDoAssento.length).toBeGreaterThan(0)
    for (const p of pontaDoAssento) expect(p.y).toBeGreaterThan(topo + 20)
    const baseDoAssento = Math.max(...contorno.map((p) => p.y))
    expect(baseDoAssento).toBeLessThan(30)

    const pernas = tracosDoGlifo('cadeira', 40, 60, 'lado').filter((t) => t.x1 === t.x2)
    expect(pernas).toHaveLength(2)
    for (const perna of pernas) {
      expect(Math.min(perna.y1, perna.y2)).toBeCloseTo(baseDoAssento, 9)
      expect(Math.max(perna.y1, perna.y2)).toBe(30)
    }
    expect(pernas.map((p) => Math.sign(p.x1)).sort((a, b) => a - b)).toEqual([-1, 1])
  })

  it('o baú de lado tem a tampa em arco sobre o corpo e a costura entre os dois', () => {
    const contorno = contornoDe('bau', 36, 36)
    expect(contorno).toContainEqual({ x: -18, y: 18 })
    expect(contorno).toContainEqual({ x: 18, y: 18 })
    const maisAlto = contorno.reduce((a, b) => (b.y < a.y ? b : a))
    expect(maisAlto.x).toBeCloseTo(0, 9)
    expect(maisAlto.y).toBeCloseTo(-18, 9)
    expect(contorno.length).toBeGreaterThan(8)
    // Arco, não caixa: nenhum canto quadrado no topo.
    expect(contorno.some((p) => Math.abs(p.x) > 17.9 && p.y < -17.9)).toBe(false)

    const [costura, ...resto] = tracosDoGlifo('bau', 36, 36, 'lado')
    expect(resto).toEqual([])
    expect(costura.y1).toBe(costura.y2)
    expect([costura.x1, costura.x2]).toEqual([-18, 18])
    // A costura começa onde o arco encosta na parede do corpo.
    expect(contorno.some((p) => p.x === -18 && Math.abs(p.y - costura.y1) < 1e-9)).toBe(true)
  })

  it('todo ponto de lado fica dentro da caixa do móvel', () => {
    for (const tipo of TIPOS_COM_VISTA) {
      const pontos = [
        ...contornoDe(tipo, 40, 80),
        ...tracosDoGlifo(tipo, 40, 80, 'lado').flatMap((t) => [
          { x: t.x1, y: t.y1 },
          { x: t.x2, y: t.y2 },
        ]),
      ]
      expect(pontos.length, tipo).toBeGreaterThan(0)
      for (const p of pontos) {
        expect(Math.abs(p.x), tipo).toBeLessThanOrEqual(20 + 1e-9)
        expect(Math.abs(p.y), tipo).toBeLessThanOrEqual(40 + 1e-9)
      }
    }
  })

  it('tamanho não desenhável ou tipo sem vista não tem contorno de lado', () => {
    expect(contornoDeLado('cadeira', 0, 40)).toBeNull()
    expect(contornoDeLado('bau', Number.NaN, 40)).toBeNull()
    expect(contornoDeLado('mesa', 40, 40)).toBeNull()
    expect(contornoDeLado(undefined, 40, 40)).toBeNull()
    expect(tracosDoGlifo('cadeira', 0, 40, 'lado')).toEqual([])
  })
})

describe('armário de cozinha e aparador — encostados na parede, com vista de lado', () => {
  const novos: TipoMobilia[] = ['armario', 'aparador']

  it('estão no catálogo com o nome inteiro e o artigo; têm vista, não são redondos nem vazados', () => {
    expect(ROTULO_MOBILIA.armario).toBe('Armário de cozinha')
    expect(NOME_COM_ARTIGO.armario).toBe('um armário de cozinha')
    expect(ROTULO_MOBILIA.aparador).toBe('Aparador')
    expect(NOME_COM_ARTIGO.aparador).toBe('um aparador')
    for (const tipo of novos) {
      expect(aceitaVista(tipo), tipo).toBe(true)
      expect(ehMovelRedondo(tipo), tipo).toBe(false)
      expect(ehMovelVazado(tipo), tipo).toBe(false)
    }
  })

  it('tamanho padrão: armário 1 × 0,5 casa e aparador 2 × 0,5; de lado, 1 × 1,5 e 2 × 0,9', () => {
    const armario = criarMovel('armario', { x: 0, y: 0 }, GRADE, 'a')
    const aparador = criarMovel('aparador', { x: 0, y: 0 }, GRADE, 'p')
    expect({ width: armario.width, height: armario.height }).toEqual({ width: GRADE, height: 0.5 * GRADE })
    expect({ width: aparador.width, height: aparador.height }).toEqual({ width: 2 * GRADE, height: 0.5 * GRADE })
    const armarioDeLado = movelComOutraVista(armario, 'lado', GRADE)
    const aparadorDeLado = movelComOutraVista(aparador, 'lado', GRADE)
    expect({ width: armarioDeLado.width, height: armarioDeLado.height }).toEqual({ width: GRADE, height: 1.5 * GRADE })
    expect({ width: aparadorDeLado.width, height: aparadorDeLado.height }).toEqual({ width: 2 * GRADE, height: 0.9 * GRADE })
  })

  it('armário de cima: o degrau no meio e dois puxadores curtos subindo da frente, sem tocar o degrau', () => {
    const [degrau, ...puxadores] = tracosDoGlifo('armario', 40, 20)
    expect(degrau).toEqual({ x1: -20, y1: expect.closeTo(-1, 9), x2: 20, y2: expect.closeTo(-1, 9) })
    expect(puxadores).toHaveLength(2)
    for (const puxador of puxadores) {
      expect(puxador.x1).toBe(puxador.x2)
      expect(Math.max(puxador.y1, puxador.y2)).toBe(10)
      expect(Math.min(puxador.y1, puxador.y2)).toBeGreaterThan(degrau.y1)
    }
    expect(puxadores.map((p) => Math.sign(p.x1)).sort((a, b) => a - b)).toEqual([-1, 1])
  })

  it('aparador de cima: a borda do tampo baixa e o encontro das portas descendo dela até a frente (T invertido)', () => {
    const [frente, encontro, ...resto] = tracosDoGlifo('aparador', 80, 20)
    expect(resto).toEqual([])
    expect(frente.x1).toBe(-40)
    expect(frente.x2).toBe(40)
    expect(frente.y1).toBe(frente.y2)
    expect(frente.y1).toBeCloseTo(4.4, 9)
    expect(encontro).toEqual({ x1: 0, y1: frente.y1, x2: 0, y2: 10 })
  })

  it('armário de lado: o retângulo e a frente em 12 traços — portinha, nicho aberto, bancada, duas gavetas e rodapé', () => {
    expect(contornoDe('armario', 40, 60)).toEqual([
      { x: -20, y: -30 },
      { x: 20, y: -30 },
      { x: 20, y: 30 },
      { x: -20, y: 30 },
    ])
    const tracos = tracosDoGlifo('armario', 40, 60, 'lado')
    expect(tracos).toHaveLength(12)
    // De lado a lado: fim do armário de cima, bancada, divisão das gavetas e rodapé.
    const deLadoALado = tracos.filter((t) => t.y1 === t.y2 && Math.abs(t.x2 - t.x1) === 40).map((t) => t.y1)
    expect(deLadoALado.map((y) => y / 60 + 0.5)).toEqual([0.3, 0.56, 0.75, 0.94].map((f) => expect.closeTo(f, 9)))
    // O nicho aberto: duas laterais, do fim do armário de cima à bancada.
    const laterais = tracos.filter((t) => t.x1 === t.x2 && Math.abs(t.x1) > 16)
    expect(laterais).toHaveLength(2)
    for (const lateral of laterais) {
      expect(lateral.y1).toBeCloseTo(-12, 9)
      expect(lateral.y2).toBeCloseTo(0.56 * 60 - 30, 9)
    }
    // Um puxador curto em cada gaveta, no meio.
    const puxadores = tracos.filter((t) => t.y1 === t.y2 && Math.abs(t.x2 - t.x1) < 10)
    expect(puxadores.map((p) => p.y1 / 60 + 0.5)).toEqual([0.655, 0.845].map((f) => expect.closeTo(f, 9)))
  })

  it('aparador de lado: o tampo sobra dos dois lados do corpo e as portas se encontram no meio', () => {
    const contorno = contornoDe('aparador', 80, 36)
    expect(contorno).toHaveLength(8)
    expect(contorno.slice(0, 2)).toEqual([
      { x: -40, y: -18 },
      { x: 40, y: -18 },
    ])
    // O corpo, que desce até o chão, é mais estreito que o tampo.
    const noChao = contorno.filter((p) => p.y === 18)
    expect(noChao).toHaveLength(2)
    for (const p of noChao) expect(Math.abs(p.x)).toBeCloseTo(40 - 0.035 * 80, 9)

    const [encontro, rodape, ...puxadores] = tracosDoGlifo('aparador', 80, 36, 'lado')
    expect(encontro.x1).toBe(0)
    expect(encontro.x2).toBe(0)
    expect(rodape.y1).toBe(rodape.y2)
    expect(encontro.y2).toBeCloseTo(rodape.y1, 9)
    expect(puxadores).toHaveLength(2)
    expect(puxadores[0].x1).toBeCloseTo(-puxadores[1].x1, 9)
  })

  it('tipo desconhecido (arquivo de uma versão futura) não tem traço nem contorno de lado, em vez de derrubar o desenho', () => {
    // `JSON.parse` devolve `any`: é o tipo torto que um arquivo de outra versão traria.
    const futuro: TipoMobilia = JSON.parse('"lareira"')
    expect(tracosDoGlifo(futuro, 40, 40)).toEqual([])
    expect(tracosDoGlifo(futuro, 40, 40, 'lado')).toEqual([])
    expect(contornoDeLado(futuro, 40, 40)).toBeNull()
  })
})

describe('fogueira — roda de pedras, lenha em X e a chama', () => {
  it('está no catálogo depois do aparador, redonda de cima, com vista de lado', () => {
    expect(TIPOS_MOBILIA[TIPOS_MOBILIA.length - 1]).toBe('fogueira')
    expect(ROTULO_MOBILIA.fogueira).toBe('Fogueira')
    expect(NOME_COM_ARTIGO.fogueira).toBe('uma fogueira')
    expect(aceitaVista('fogueira')).toBe(true)
    expect(ehMovelVazado('fogueira')).toBe(false)
  })

  it('tamanho padrão: 1 × 1 casa de cima e 1 × 1,25 de lado (a chama cabe dentro)', () => {
    const fogueira = criarMovel('fogueira', { x: 0, y: 0 }, GRADE, 'f')
    expect({ width: fogueira.width, height: fogueira.height }).toEqual({ width: GRADE, height: GRADE })
    const deLado = movelComOutraVista(fogueira, 'lado', GRADE)
    expect({ width: deLado.width, height: deLado.height }).toEqual({ width: GRADE, height: 1.25 * GRADE })
  })

  it('de cima: a borda de dentro da roda, 8 juntas até a silhueta e duas toras cruzando no centro', () => {
    const tracos = tracosDoGlifo('fogueira', 40, 40)
    // 24 lados da roda + 8 juntas + 2 toras de 4 traços.
    expect(tracos).toHaveLength(40)
    const roda = tracos.slice(0, 24)
    for (const t of roda) expect(Math.hypot(t.x1, t.y1)).toBeCloseTo(14, 9)
    const juntas = tracos.slice(24, 32)
    for (const j of juntas) {
      expect(Math.hypot(j.x1, j.y1)).toBeCloseTo(14, 9)
      expect(Math.hypot(j.x2, j.y2)).toBeCloseTo(20, 9)
      // A meio caminho entre os eixos: nenhuma junta em cima do eixo da tela.
      expect(Math.abs(j.x2)).toBeGreaterThan(1)
      expect(Math.abs(j.y2)).toBeGreaterThan(1)
    }
    const lenha = tracos.slice(32)
    expect(lenha).toHaveLength(8)
    // Cada tora é simétrica em volta do centro: a soma dos 4 cantos dá zero.
    for (const tora of [lenha.slice(0, 4), lenha.slice(4)]) {
      expect(tora.reduce((soma, t) => soma + t.x1, 0)).toBeCloseTo(0, 9)
      expect(tora.reduce((soma, t) => soma + t.y1, 0)).toBeCloseTo(0, 9)
    }
  })

  it('de lado: só as pedras (4 domos sobre a faixa baixa) e a lenha em X acima delas', () => {
    const contorno = contornoDe('fogueira', 40, 50)
    expect(contorno).toHaveLength(2 + 4 * 8 + 1)
    expect(contorno[0]).toEqual({ x: -20, y: 25 })
    expect(contorno[contorno.length - 1]).toEqual({ x: 20, y: 25 })
    // Nada do contorno sobe acima do pico mais alto das pedras (0,79 da altura): o resto fica sem fundo.
    for (const p of contorno) {
      expect(p.y).toBeGreaterThanOrEqual((0.79 - 0.5) * 50 - 1e-9)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(20 + 1e-9)
    }
    expect(tracosDoGlifo('fogueira', 40, 50, 'lado')).toHaveLength(8)
  })

  it('a chama de cima nasce um pouco abaixo do centro, com 0,4 do lado menor de altura', () => {
    expect(chamaDaFogueira(40, 60)).toEqual({ ancora: { x: 0, y: 0 }, desvio: 0.18 * 40, altura: 0.4 * 40 })
  })

  it('a chama de lado nasce sobre o X da lenha e a fagulha mais alta ainda cabe no objeto', () => {
    const chama = chamaDaFogueira(40, 50, 'lado')
    if (chama === null) throw new Error('fogueira de lado devia ter chama')
    expect(chama.ancora.x).toBe(0)
    expect(chama.ancora.y).toBeCloseTo((0.68 - 0.5) * 50, 9)
    expect(chama.desvio).toBe(0)
    expect(chama.altura).toBeCloseTo(0.464 * 50, 9)
    // A fagulha sobe até 1,4 H acima da base.
    expect(chama.ancora.y - 1.4 * chama.altura).toBeGreaterThanOrEqual(-25)
  })

  it('tamanho não desenhável não tem chama', () => {
    expect(chamaDaFogueira(0, 40)).toBeNull()
    expect(chamaDaFogueira(40, Number.NaN, 'lado')).toBeNull()
  })
})
