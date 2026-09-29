import { describe, expect, it } from 'vitest'
import {
  aceitaVista,
  comAparenciaDoMovel,
  contornoDeLado,
  criarMovel,
  ehMovelRedondo,
  ehTipoMobilia,
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

describe('vista do móvel — frente ou lado, só na cadeira e no baú', () => {
  it('só cadeira e baú aceitam vista; as vistas são Frente e Lado, nessa ordem', () => {
    expect([...TIPOS_COM_VISTA]).toEqual(['cadeira', 'bau'])
    expect(TIPOS_MOBILIA.filter((tipo) => aceitaVista(tipo))).toEqual(['bau', 'cadeira'])
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
