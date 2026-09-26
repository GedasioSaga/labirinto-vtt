import { describe, expect, it } from 'vitest'
import type { Perigo } from '../types/map'
import { deserializeMap, serializeMap } from './mapFile'
import {
  apagarPerigo,
  avancarPerigo,
  perigoDaSala,
  perigosFromFile,
  porPerigoNaSala,
  salasLigadasPorPortaAberta,
  salasQueOAvancoAtinge,
} from './perigo'
import { ADEGA, casa, CORREDOR, COZINHA, DESPENSA, sala } from './perigoPlanta.fixture'

/**
 * PERIGO QUE SE ALASTRA — o fogo (ou a água) preso a uma sala passa às
 * vizinhas por PORTA ABERTA a cada "Avançar" do mestre. O fogo deixa cinza
 * para trás; a água fica onde estava e soma as vizinhas.
 */
const fogoNaCozinha: Perigo = { id: 'perigo-1', tipo: 'fogo', salas: [COZINHA] }

describe('vizinhança por porta aberta', () => {
  it('liga as salas dos dois lados de cada porta aberta, e só delas', () => {
    const vizinhas = salasLigadasPorPortaAberta(casa({ cozinhaCorredor: true, corredorAdega: false, cozinhaDespensa: true }))
    expect([...(vizinhas.get(COZINHA) ?? [])].sort()).toEqual([CORREDOR, DESPENSA].sort())
    expect([...(vizinhas.get(CORREDOR) ?? [])]).toEqual([COZINHA])
    expect(vizinhas.has(ADEGA)).toBe(false)
  })

  it('sub-sala: a porta liga à sala MAIS INTERNA do lado de lá', () => {
    const map = casa()
    const armario = sala('r-armario', 'Armário', 300, 100, 400, 200, { parentId: CORREDOR })
    const vizinhas = salasLigadasPorPortaAberta({ ...map, regions: [...map.regions, armario] })
    expect(vizinhas.get(COZINHA)?.has('r-armario')).toBe(true)
    expect(vizinhas.get(COZINHA)?.has(CORREDOR)).toBe(false)
  })
})

describe('avançar o fogo', () => {
  it('prevê as salas que o próximo avanço atinge, na ordem das salas do mapa', () => {
    const map = casa({ perigos: [fogoNaCozinha] })
    expect(salasQueOAvancoAtinge(map, fogoNaCozinha)).toEqual([CORREDOR, DESPENSA])
  })

  it('toma as vizinhas por porta aberta e deixa cinza onde queimava', () => {
    const depois = avancarPerigo(casa({ perigos: [fogoNaCozinha] }), 'perigo-1')
    expect(depois.perigos).toEqual([{ id: 'perigo-1', tipo: 'fogo', salas: [CORREDOR, DESPENSA], cinzas: [COZINHA] }])
  })

  it('porta fechada segura o fogo; aberta depois, o avanço seguinte passa e não volta à cinza', () => {
    const um = avancarPerigo(casa({ perigos: [fogoNaCozinha], cozinhaDespensa: false }), 'perigo-1')
    expect(um.perigos?.[0]?.salas).toEqual([CORREDOR])
    const abriu = { ...um, walls: casa({ corredorAdega: true }).walls }
    const dois = avancarPerigo(abriu, 'perigo-1')
    // Cozinha é cinza: não queima de novo. Despensa, agora com a porta aberta, está longe do Corredor.
    expect(dois.perigos?.[0]).toEqual({ id: 'perigo-1', tipo: 'fogo', salas: [ADEGA], cinzas: [COZINHA, CORREDOR] })
  })

  it('fogo sem vizinha para tomar se apaga e fica só a cinza', () => {
    const cercado = casa({ perigos: [fogoNaCozinha], cozinhaCorredor: false, cozinhaDespensa: false })
    expect(salasQueOAvancoAtinge(cercado, fogoNaCozinha)).toEqual([])
    const depois = avancarPerigo(cercado, 'perigo-1')
    expect(depois.perigos).toEqual([{ id: 'perigo-1', tipo: 'fogo', salas: [], cinzas: [COZINHA] }])
  })
})

describe('dois perigos no mesmo mapa: um não passa por cima do outro', () => {
  const fogoA: Perigo = { id: 'fogo-a', tipo: 'fogo', salas: [COZINHA] }
  const fogoB: Perigo = { id: 'fogo-b', tipo: 'fogo', salas: [CORREDOR] }

  it('a cinza de um fogo não queima de novo pelo outro, e nenhuma sala fica com dois perigos', () => {
    const inicio = casa({ perigos: [fogoA, fogoB] })
    // B só tem a Cozinha de vizinha, e a Cozinha é do A: B se apaga no Corredor.
    expect(salasQueOAvancoAtinge(inicio, fogoB)).toEqual([])
    const bAvancou = avancarPerigo(inicio, 'fogo-b')
    expect(bAvancou.perigos).toEqual([fogoA, { id: 'fogo-b', tipo: 'fogo', salas: [], cinzas: [CORREDOR] }])
    // A não entra no Corredor (cinza de B): só a Despensa.
    const aAvancou = avancarPerigo(bAvancou, 'fogo-a')
    expect(aAvancou.perigos).toEqual([
      { id: 'fogo-a', tipo: 'fogo', salas: [DESPENSA], cinzas: [COZINHA] },
      { id: 'fogo-b', tipo: 'fogo', salas: [], cinzas: [CORREDOR] },
    ])
    const alcancadas = (aAvancou.perigos ?? []).flatMap((p) => [...p.salas, ...(p.cinzas ?? [])])
    expect(new Set(alcancadas).size).toBe(alcancadas.length)
  })

  it('a água não alaga a sala em chamas, e o fogo não entra na sala alagada', () => {
    const agua: Perigo = { id: 'agua-1', tipo: 'agua', salas: [CORREDOR] }
    const map = casa({ perigos: [fogoA, agua] })
    expect(salasQueOAvancoAtinge(map, agua)).toEqual([])
    expect(avancarPerigo(map, 'agua-1')).toBe(map)
    const fogoAvancou = avancarPerigo(map, 'fogo-a')
    expect(fogoAvancou.perigos?.[0]).toEqual({ id: 'fogo-a', tipo: 'fogo', salas: [DESPENSA], cinzas: [COZINHA] })
    expect(perigoDaSala(fogoAvancou, CORREDOR)).toEqual({ perigo: agua, estado: 'tomada' })
  })
})

describe('avançar a água', () => {
  it('a água soma as vizinhas e continua onde estava, sem cinza', () => {
    const agua: Perigo = { id: 'perigo-2', tipo: 'agua', salas: [COZINHA] }
    const depois = avancarPerigo(casa({ perigos: [agua] }), 'perigo-2')
    expect(depois.perigos).toEqual([{ id: 'perigo-2', tipo: 'agua', salas: [COZINHA, CORREDOR, DESPENSA] }])
  })

  it('água sem vizinha nova devolve o MESMO mapa (Ctrl+Z não ganha passo vazio)', () => {
    const map = casa({ perigos: [{ id: 'perigo-2', tipo: 'agua', salas: [COZINHA] }], cozinhaCorredor: false, cozinhaDespensa: false })
    expect(avancarPerigo(map, 'perigo-2')).toBe(map)
  })
})

describe('pôr e apagar', () => {
  it('pôr fogo numa sala cria o perigo preso a ela; mapa sem o campo ganha a lista', () => {
    const map = casa()
    expect('perigos' in map).toBe(false)
    const depois = porPerigoNaSala(map, CORREDOR, 'fogo', 'perigo-9')
    expect(depois.perigos).toEqual([{ id: 'perigo-9', tipo: 'fogo', salas: [CORREDOR] }])
    expect(perigoDaSala(depois, CORREDOR)).toEqual({ perigo: depois.perigos?.[0], estado: 'tomada' })
  })

  it('sala já tomada, cinza ou que não é Sala não recebe outro perigo', () => {
    const map = casa({ perigos: [{ id: 'perigo-1', tipo: 'fogo', salas: [CORREDOR], cinzas: [COZINHA] }] })
    expect(porPerigoNaSala(map, CORREDOR, 'agua', 'x')).toBe(map)
    expect(porPerigoNaSala(map, COZINHA, 'agua', 'x')).toBe(map)
    expect(porPerigoNaSala(map, 'nao-existe', 'agua', 'x')).toBe(map)
    expect(perigoDaSala(map, COZINHA)?.estado).toBe('cinza')
    expect(perigoDaSala(map, ADEGA)).toBeNull()
  })

  it('apagar tira o perigo; o último apagado tira o campo', () => {
    const map = casa({ perigos: [fogoNaCozinha] })
    const depois = apagarPerigo(map, 'perigo-1')
    expect('perigos' in depois).toBe(false)
    expect(apagarPerigo(depois, 'perigo-1')).toBe(depois)
  })
})

describe('arquivo: mapa velho abre igual, perigo torto some', () => {
  it('mapa salvo sem perigos abre sem o campo', () => {
    const lido = deserializeMap(serializeMap(casa()))
    expect('perigos' in lido).toBe(false)
  })

  it('round-trip preserva o perigo', () => {
    const map = casa({ perigos: [{ id: 'perigo-1', tipo: 'fogo', salas: [CORREDOR], cinzas: [COZINHA] }] })
    expect(deserializeMap(serializeMap(map)).perigos).toEqual(map.perigos)
  })

  it('tipo desconhecido, id vazio e lista torta saem; o resto fica', () => {
    const lidos = perigosFromFile([
      { id: 'ok', tipo: 'agua', salas: [COZINHA, 7], cinzas: 'nada' },
      { id: 'lava', tipo: 'lava', salas: [COZINHA] },
      { id: '', tipo: 'fogo', salas: [] },
      null,
      'texto',
    ])
    expect(lidos).toEqual([{ id: 'ok', tipo: 'agua', salas: [COZINHA] }])
    expect(perigosFromFile('nada')).toBeUndefined()
    expect(perigosFromFile(undefined)).toBeUndefined()
  })
})
