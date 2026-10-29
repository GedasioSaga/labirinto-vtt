import { describe, expect, it } from 'vitest'
import { aceitaVista, criarMovel, ehMovelRedondo, ehTipoMobilia, movelComOutraVista, NOME_COM_ARTIGO, ROTULO_MOBILIA, TIPOS_MOBILIA, tracosDoGlifo } from '../mobilia'
import { TIPOS_COM_TEXTURA } from '../../texturas/meioTermo/moveis'
import { ehPecaNova, PECAS_NOVAS, TIPOS_NO_CATALOGO, varianteDaLapide } from './pecasNovas'

/**
 * Registro das PEÇAS NOVAS do lote 1 (MT4): tamanho padrão em casas (o do
 * plano), nome e artigo da setinha, vista de lado só na barraca e na carroça,
 * silhueta redonda na mesa redonda, e o catálogo do painel, que só oferece a
 * peça cujo desenho já existe (nada de botão com rascunho).
 */
const GRADE = 50

const TAMANHOS: Readonly<Record<string, readonly [number, number]>> = {
  mesaQuadrada: [1, 1],
  mesaRedonda: [1.25, 1.25],
  lapide: [0.6, 0.35],
  vaso: [0.5, 0.5],
  lampiao: [0.5, 0.5],
  quadroDeAvisos: [1, 0.4],
  poco: [1.5, 1.5],
  barraca: [2, 2],
  carroca: [2, 1.25],
  sebe: [2, 0.5],
  jardineira: [1, 0.5],
  arcoDoPortao: [2, 0.5],
  placaDeSeta: [0.5, 0.5],
  tapeteLongo: [1, 4],
  // Objeto Fogo (27/10/2026): nasce na Chama; Fogaréu e Incêndio são escolhas do painel.
  fogo: [1, 1],
}

const NOMES: Readonly<Record<string, readonly [string, string]>> = {
  mesaQuadrada: ['Mesa quadrada', 'uma mesa quadrada'],
  mesaRedonda: ['Mesa redonda', 'uma mesa redonda'],
  lapide: ['Lápide', 'uma lápide'],
  vaso: ['Vaso de planta', 'um vaso de planta'],
  lampiao: ['Lampião', 'um lampião'],
  quadroDeAvisos: ['Quadro de avisos', 'um quadro de avisos'],
  poco: ['Poço', 'um poço'],
  barraca: ['Barraca de feira', 'uma barraca de feira'],
  carroca: ['Carroça', 'uma carroça'],
  sebe: ['Sebe', 'uma sebe'],
  jardineira: ['Jardineira', 'uma jardineira'],
  arcoDoPortao: ['Arco do portão', 'um arco do portão'],
  placaDeSeta: ['Placa de seta', 'uma placa de seta'],
  tapeteLongo: ['Tapete longo', 'um tapete longo'],
  fogo: ['Fogo', 'um fogo'],
}

describe('peças novas: registro', () => {
  it('os 14 tipos dos lotes 1 e 2 e o Fogo estão no catálogo de tipos, depois dos 11 de antes', () => {
    expect(PECAS_NOVAS).toEqual(Object.keys(TAMANHOS))
    expect(TIPOS_MOBILIA.slice(0, 11)).toEqual(['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete'])
    for (const tipo of PECAS_NOVAS) {
      expect(ehTipoMobilia(tipo), tipo).toBe(true)
      expect(ehPecaNova(tipo), tipo).toBe(true)
    }
    expect(ehPecaNova('mesa')).toBe(false)
    expect(ehPecaNova(undefined)).toBe(false)
  })

  it('cada peça nasce no tamanho do plano, centrada no clique', () => {
    for (const tipo of PECAS_NOVAS) {
      const [w, h] = TAMANHOS[tipo]
      const movel = criarMovel(tipo, { x: 100, y: 80 }, GRADE, `id-${tipo}`)
      expect([movel.width / GRADE, movel.height / GRADE], tipo).toEqual([w, h])
      expect(movel.x).toBe(100)
      expect(movel.mobilia).toBe(tipo)
    }
  })

  it('nome e artigo de cada peça (a setinha e a dica do clique)', () => {
    for (const tipo of PECAS_NOVAS) {
      expect(ROTULO_MOBILIA[tipo], tipo).toBe(NOMES[tipo][0])
      expect(NOME_COM_ARTIGO[tipo], tipo).toBe(NOMES[tipo][1])
    }
  })

  it('vista de lado só na barraca e na carroça; a de lado tem pegada própria', () => {
    for (const tipo of PECAS_NOVAS) expect(aceitaVista(tipo), tipo).toBe(tipo === 'barraca' || tipo === 'carroca')
    const barraca = movelComOutraVista(criarMovel('barraca', { x: 0, y: 0 }, GRADE, 'b'), 'lado', GRADE)
    expect([barraca.width / GRADE, barraca.height / GRADE]).toEqual([2, 2])
    expect(barraca.mobiliaVista).toBe('lado')
    const carroca = movelComOutraVista(criarMovel('carroca', { x: 0, y: 0 }, GRADE, 'c'), 'lado', GRADE)
    expect([carroca.width / GRADE, carroca.height / GRADE]).toEqual([2, 1.25])
  })

  it('silhueta redonda: a mesa redonda, o poço e o vaso; o resto é retângulo', () => {
    const redondos = PECAS_NOVAS.filter((tipo) => ehMovelRedondo(tipo))
    expect(redondos).toEqual(['mesaRedonda', 'vaso', 'poco'])
  })

  it('cada peça tem desenho de linhas (o provisório antes da imagem), nas duas vistas quando tem vista', () => {
    for (const tipo of PECAS_NOVAS) {
      const [w, h] = TAMANHOS[tipo]
      expect(tracosDoGlifo(tipo, w * GRADE, h * GRADE).length, tipo).toBeGreaterThan(0)
      if (aceitaVista(tipo)) expect(tracosDoGlifo(tipo, w * GRADE, h * GRADE, 'lado').length, `${tipo} de lado`).toBeGreaterThan(0)
      // Tamanho torto não tem traço nem derruba o desenho.
      expect(tracosDoGlifo(tipo, 0, h * GRADE)).toEqual([])
    }
  })

  it('lápide: a variação sai do id, com valor fixo (as lápides salvas não mudam), e ids diferentes dão as 3 variações', () => {
    // Valores FIXOS de 3 ids: trocar o hash ou VARIANTES_DA_LAPIDE mudaria as lápides já salvas.
    expect([varianteDaLapide('lapide-0'), varianteDaLapide('lapide-1'), varianteDaLapide('lapide-3'), varianteDaLapide('a3f9c2e1-0b44-4c1d-9e2a-5d6f7a8b9c0d')]).toEqual([0, 1, 2, 0])
    const vistas = new Set(Array.from({ length: 30 }, (_, i) => varianteDaLapide(`p${i}`)))
    expect([...vistas].sort()).toEqual([0, 1, 2])
    expect(varianteDaLapide(undefined)).toBe(0)
  })
})

describe('catálogo do painel: só peça com desenho pronto', () => {
  it('os 11 de antes na ordem de sempre, as mesas novas logo depois da Mesa, e cada peça nova do catálogo tem desenho com textura', () => {
    expect(TIPOS_NO_CATALOGO.filter((tipo) => TIPOS_MOBILIA.slice(0, 11).includes(tipo))).toEqual(TIPOS_MOBILIA.slice(0, 11))
    const mesa = TIPOS_NO_CATALOGO.indexOf('mesa')
    expect(TIPOS_NO_CATALOGO.slice(mesa, mesa + 3)).toEqual(['mesa', 'mesaQuadrada', 'mesaRedonda'])
    const cerca = TIPOS_NO_CATALOGO.indexOf('cerca')
    expect(TIPOS_NO_CATALOGO.slice(cerca, cerca + 3)).toEqual(['cerca', 'sebe', 'jardineira'])
    const tapete = TIPOS_NO_CATALOGO.indexOf('tapete')
    expect(TIPOS_NO_CATALOGO.slice(tapete, tapete + 2)).toEqual(['tapete', 'tapeteLongo'])
    // O Fogo logo depois da Fogueira (o móvel continua como estava).
    const fogueira = TIPOS_NO_CATALOGO.indexOf('fogueira')
    expect(TIPOS_NO_CATALOGO.slice(fogueira, fogueira + 2)).toEqual(['fogueira', 'fogo'])
    expect(TIPOS_NO_CATALOGO.slice(-2)).toEqual(['arcoDoPortao', 'placaDeSeta'])
    // 26 de antes, os 8 móveis de casa de 28/10/2026 (fogão, geladeira, pia, balcão, pratos, privada, sofá, poltrona)
    // e os 4 de 29/10/2026 (lareira, fornalha, bigorna, balde).
    expect(TIPOS_NO_CATALOGO).toHaveLength(38)
    for (const tipo of TIPOS_NO_CATALOGO) expect(TIPOS_COM_TEXTURA.some((t) => t === tipo), tipo).toBe(true)
    expect(new Set(TIPOS_NO_CATALOGO).size).toBe(TIPOS_NO_CATALOGO.length)
  })
})
