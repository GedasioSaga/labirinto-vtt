import { describe, expect, it } from 'vitest'
import { andar6, GUARDA, SINDICATO } from './__fixtures__/andar6'
import {
  alertaDaCena,
  coresDasFaccoes,
  FACCAO_MAX_LENGTH,
  faccaoDaSala,
  faccaoHerdada,
  lerAlerta,
  lerFaccao,
  normalizarFaccao,
  pinturaDeFaccoes,
  ROTULO_ALERTA,
} from './faccoes'
import { setRoomFaccao, setSceneAlerta } from './mapFactory'

/**
 * FACÇÃO POR TERRITÓRIO E NÍVEL DE ALERTA — a regra pura: quem manda em cada
 * sala (a própria facção, ou a do distrito onde ela está), a cor do filtro
 * "Quem manda aqui" e o alerta da cena (calmo, atento, caçada).
 */
describe('faccaoDaSala', () => {
  it('a facção da própria sala vale e não é herdada', () => {
    expect(faccaoDaSala(andar6().regions, 'd-norte')).toEqual({ faccao: GUARDA, herdada: false })
    expect(faccaoDaSala(andar6().regions, 's-esconderijo')).toEqual({ faccao: SINDICATO, herdada: false })
  })

  it('a sala sem facção dentro de um distrito herda a do distrito', () => {
    expect(faccaoDaSala(andar6().regions, 's-quartel')).toEqual({ faccao: GUARDA, herdada: true })
  })

  it('sala sem facção fora de distrito, região comum e id que não existe: ninguém manda', () => {
    const regions = andar6().regions
    expect(faccaoDaSala(regions, 'd-mercado')).toBeNull()
    expect(faccaoDaSala(regions, 'r-praca')).toBeNull()
    expect(faccaoDaSala(regions, 'nao-existe')).toBeNull()
  })

  it('faccaoHerdada só responde para quem herda: o Quartel herda a Guarda; o Esconderijo tem a própria', () => {
    const regions = andar6().regions
    expect(faccaoHerdada(regions, 's-quartel')).toBe(GUARDA)
    expect(faccaoHerdada(regions, 's-esconderijo')).toBeUndefined()
    expect(faccaoHerdada(regions, 'd-mercado')).toBeUndefined()
  })

  it('ciclo de parentId (arquivo editado à mão) não trava', () => {
    const regions = andar6().regions.map((r) =>
      r.id === 'd-mercado' ? { ...r, parentId: 's-loop' } : r,
    )
    const loop = { ...regions[4], id: 's-loop', parentId: 'd-mercado' }
    expect(faccaoDaSala([...regions, loop], 'd-mercado')).toBeNull()
  })
})

describe('pinturaDeFaccoes — o filtro "Quem manda aqui" no andar 6', () => {
  it('pinta os dois distritos com facção, cada facção com a sua cor', () => {
    const pintura = pinturaDeFaccoes(andar6())
    const norte = pintura.find((p) => p.regionId === 'd-norte')
    const sul = pintura.find((p) => p.regionId === 'd-sul')
    expect(norte?.faccao).toBe(GUARDA)
    expect(sul?.faccao).toBe(SINDICATO)
    expect(norte?.cor).not.toBe(sul?.cor)
    expect(norte?.points).toEqual(andar6().regions[0].points)
  })

  it('o Esconderijo do Sindicato dentro do Norte ganha a cor do Sindicato; o Quartel já está coberto pelo Norte', () => {
    const pintura = pinturaDeFaccoes(andar6())
    const sul = pintura.find((p) => p.regionId === 'd-sul')
    expect(pintura.find((p) => p.regionId === 's-esconderijo')?.cor).toBe(sul?.cor)
    expect(pintura.map((p) => p.regionId)).toEqual(['d-norte', 's-esconderijo', 'd-sul'])
  })

  it('sala sem facção e região comum não são pintadas', () => {
    const ids = pinturaDeFaccoes(andar6()).map((p) => p.regionId)
    expect(ids).not.toContain('d-mercado')
    expect(ids).not.toContain('r-praca')
  })

  it('camada Salas escondida ou sala oculta no editor: nada a pintar dela', () => {
    const map = andar6()
    expect(pinturaDeFaccoes({ ...map, hiddenLayers: ['salas'] })).toEqual([])
    const semNorte = { ...map, regions: map.regions.map((r) => (r.id === 'd-norte' ? { ...r, hidden: true } : r)) }
    const ids = pinturaDeFaccoes(semNorte).map((p) => p.regionId)
    expect(ids).toEqual(['s-quartel', 's-esconderijo', 'd-sul'])
  })

  it('mapa sem facção nenhuma: pintura vazia', () => {
    const map = andar6()
    const semFaccao = { ...map, regions: map.regions.map((r) => (r.room ? { ...r, room: { shape: r.room.shape, name: r.room.name } } : r)) }
    expect(pinturaDeFaccoes(semFaccao)).toEqual([])
  })
})

describe('coresDasFaccoes — a legenda do filtro', () => {
  it('uma cor por facção, na ordem alfabética, com quantas salas cada uma manda', () => {
    const legenda = coresDasFaccoes(andar6().regions)
    expect(legenda.map((l) => l.faccao)).toEqual([GUARDA, SINDICATO])
    expect(legenda.map((l) => l.salas)).toEqual([2, 2])
    expect(new Set(legenda.map((l) => l.cor)).size).toBe(2)
  })
})

describe('normalizarFaccao / lerFaccao', () => {
  it('apara espaços, corta no teto e texto vazio vira sem facção', () => {
    expect(normalizarFaccao('  Guarda Carmesim  ')).toBe(GUARDA)
    expect(normalizarFaccao('   ')).toBeUndefined()
    expect(normalizarFaccao('x'.repeat(FACCAO_MAX_LENGTH + 10))).toHaveLength(FACCAO_MAX_LENGTH)
  })

  it('do arquivo: só texto não vazio volta', () => {
    expect(lerFaccao(GUARDA)).toBe(GUARDA)
    expect(lerFaccao(42)).toBeUndefined()
    expect(lerFaccao({ nome: 'x' })).toBeUndefined()
    expect(lerFaccao('')).toBeUndefined()
  })
})

describe('alerta da cena', () => {
  it('mapa sem o campo está calmo; os três níveis têm rótulo', () => {
    const { alerta: _alerta, ...calmo } = andar6()
    expect(alertaDaCena(calmo)).toBe('calmo')
    expect(alertaDaCena(andar6())).toBe('cacada')
    expect(ROTULO_ALERTA).toEqual({ calmo: 'Calmo', atento: 'Atento', cacada: 'Caçada' })
  })

  it('do arquivo: só um dos três níveis volta', () => {
    expect(lerAlerta('atento')).toBe('atento')
    expect(lerAlerta('panico')).toBeUndefined()
    expect(lerAlerta(2)).toBeUndefined()
  })
})

describe('mapFactory — facção da sala e alerta da cena', () => {
  it('setRoomFaccao grava o que foi digitado (o espaço entre palavras não some no meio da digitação); quem manda é lido aparado', () => {
    const map = andar6()
    const comFaccao = setRoomFaccao(map, 'd-mercado', 'Mercadores ')
    expect(comFaccao.regions.find((r) => r.id === 'd-mercado')?.room?.faccao).toBe('Mercadores ')
    expect(faccaoDaSala(comFaccao.regions, 'd-mercado')).toEqual({ faccao: 'Mercadores', herdada: false })
    const longa = setRoomFaccao(map, 'd-mercado', 'y'.repeat(FACCAO_MAX_LENGTH + 5))
    expect(longa.regions.find((r) => r.id === 'd-mercado')?.room?.faccao).toHaveLength(FACCAO_MAX_LENGTH)
  })

  it('setRoomFaccao com texto vazio ou só espaço tira o campo', () => {
    const map = andar6()
    for (const vazio of ['', '   ']) {
      const norte = setRoomFaccao(map, 'd-norte', vazio).regions.find((r) => r.id === 'd-norte')
      expect(norte?.room?.name).toBe('Distrito Norte')
      expect(norte?.room !== undefined && 'faccao' in norte.room).toBe(false)
    }
  })

  it('setRoomFaccao sem mudança, região comum ou id inexistente devolve o mesmo mapa', () => {
    const map = andar6()
    expect(setRoomFaccao(map, 'd-norte', GUARDA)).toBe(map)
    expect(setRoomFaccao(map, 'r-praca', GUARDA)).toBe(map)
    expect(setRoomFaccao(map, 'nao-existe', GUARDA)).toBe(map)
  })

  it('setSceneAlerta sobe o alerta; voltar a calmo tira o campo', () => {
    const map = andar6()
    expect(setSceneAlerta(map, 'cacada')).toBe(map)
    const atento = setSceneAlerta(map, 'atento')
    expect(atento.alerta).toBe('atento')
    const calmo = setSceneAlerta(map, 'calmo')
    expect('alerta' in calmo).toBe(false)
    expect(alertaDaCena(calmo)).toBe('calmo')
  })
})
