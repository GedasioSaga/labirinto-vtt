/**
 * GATILHO DE ÁREA — regra pura. O mestre marca uma Região/Sala como armadilha
 * ou alarme; a ficha de JOGADOR que ENTRA no polígono gera um aviso para o
 * mestre. Ficar parado dentro não repete; gatilho recém-armado em cima de quem
 * já estava lá não dispara; ficha que acabou de virar de jogador também não.
 */
import { describe, expect, it } from 'vitest'
import type { AreaTrigger } from '../types/map'
import { ficha, torre } from './__fixtures__/hazardTower'
import {
  areaTriggerAreas,
  areaTriggerEntryLine,
  areaTriggerOfRegion,
  areaTriggerPresence,
  areaTriggersOf,
  newAreaTriggerEntries,
  parsePlayerAreaTriggers,
  readAreaTriggers,
  regionAreaName,
  setRegionTrigger,
  setRegionTriggerRevealed,
} from './areaTriggers'
import { deserializeMap, serializeMap } from './mapFile'

const gatilho = (id: string, kind: AreaTrigger['kind'], regionId: string, revealed = false): AreaTrigger => ({ id, kind, regionId, revealed })

describe('setRegionTrigger — o mestre marca a área', () => {
  it('marca, troca o tipo mantendo o id e limpa tirando o campo', () => {
    const base = torre()
    const marcado = setRegionTrigger(base, 'sala-b', 'armadilha', () => 'g-1')
    expect(areaTriggersOf(marcado)).toEqual([gatilho('g-1', 'armadilha', 'sala-b')])
    const revelado = setRegionTriggerRevealed(marcado, 'sala-b', true)
    const trocado = setRegionTrigger(revelado, 'sala-b', 'alarme', () => 'g-novo')
    // Trocar o tipo não rearma nem esconde de novo: é o mesmo gatilho.
    expect(areaTriggerOfRegion(trocado, 'sala-b')).toEqual(gatilho('g-1', 'alarme', 'sala-b', true))
    const limpo = setRegionTrigger(trocado, 'sala-b', null, () => 'x')
    expect('gatilhos' in limpo).toBe(false)
  })

  it('nada muda: devolve o MESMO mapa (sem entrada de histórico à toa)', () => {
    const marcado = setRegionTrigger(torre(), 'sala-a', 'alarme', () => 'g-1')
    expect(setRegionTrigger(marcado, 'sala-a', 'alarme', () => 'g-2')).toBe(marcado)
    expect(setRegionTriggerRevealed(marcado, 'sala-a', false)).toBe(marcado)
    // Região que não existe e revelar área sem gatilho também não mexem.
    expect(setRegionTrigger(marcado, 'nao-existe', 'armadilha', () => 'g-3')).toBe(marcado)
    expect(setRegionTriggerRevealed(marcado, 'sala-c', true)).toBe(marcado)
  })

  it('área comum (Região sem Sala) também pode ser gatilho', () => {
    const base = torre()
    const area = { ...base.regions[0], id: 'area-1', room: undefined, tag: 'Pátio' }
    const map = setRegionTrigger({ ...base, regions: [...base.regions, area] }, 'area-1', 'armadilha', () => 'g-1')
    expect(areaTriggerOfRegion(map, 'area-1')?.kind).toBe('armadilha')
    expect(regionAreaName(area)).toBe('Pátio')
  })
})

describe('areaTriggerPresence / newAreaTriggerEntries — quem ENTROU', () => {
  const comGatilho = (xAna: number, extra: AreaTrigger[] = [gatilho('g-1', 'armadilha', 'sala-c')]) => ({
    ...torre({ tokens: [ficha('ana', xAna, 200), ficha('ogro', 1250, 200)] }),
    gatilhos: extra,
  })

  it('Ana anda para dentro: uma entrada; parada lá dentro: nenhuma', () => {
    const fora = areaTriggerPresence(comGatilho(250), ['ana'])
    const dentro = areaTriggerPresence(comGatilho(1250), ['ana'])
    expect(newAreaTriggerEntries(fora, dentro)).toEqual([{ tokenId: 'ana', triggerId: 'g-1', kind: 'armadilha', regionId: 'sala-c' }])
    expect(newAreaTriggerEntries(dentro, areaTriggerPresence(comGatilho(1250), ['ana']))).toEqual([])
  })

  it('primeira leitura não dispara nada: é a linha de base', () => {
    expect(newAreaTriggerEntries(undefined, areaTriggerPresence(comGatilho(1250), ['ana']))).toEqual([])
  })

  it('gatilho armado em cima de quem já estava lá não dispara; sair e voltar dispara', () => {
    const antes = areaTriggerPresence(comGatilho(1250, []), ['ana'])
    const armado = areaTriggerPresence(comGatilho(1250), ['ana'])
    expect(newAreaTriggerEntries(antes, armado)).toEqual([])
    const saiu = areaTriggerPresence(comGatilho(250), ['ana'])
    expect(newAreaTriggerEntries(armado, saiu)).toEqual([])
    expect(newAreaTriggerEntries(saiu, areaTriggerPresence(comGatilho(1250), ['ana']))).toHaveLength(1)
  })

  it('NPC dentro da armadilha não dispara; ficha que acabou de ganhar dono também não', () => {
    const antes = areaTriggerPresence(comGatilho(250), ['ana'])
    const ogroVirouJogador = areaTriggerPresence(comGatilho(250), ['ana', 'ogro'])
    expect(newAreaTriggerEntries(antes, ogroVirouJogador)).toEqual([])
    expect(areaTriggerPresence(comGatilho(250), ['ana']).inside.size).toBe(0)
  })

  it('ficha que CHEGA na cena já dentro da área (viagem) conta como entrada', () => {
    const semAna = areaTriggerPresence({ ...comGatilho(250), tokens: [] }, ['ana'])
    const chegou = areaTriggerPresence(comGatilho(1250), ['ana'])
    expect(newAreaTriggerEntries(semAna, chegou).map((e) => e.tokenId)).toEqual(['ana'])
  })

  it('gatilho de região apagada não dispara e não é desenhado', () => {
    const map = { ...comGatilho(1250), gatilhos: [gatilho('g-orfao', 'alarme', 'sumiu')] }
    expect(areaTriggerPresence(map, ['ana']).inside.size).toBe(0)
    expect(areaTriggerAreas(map)).toEqual([])
  })
})

describe('linha do aviso do mestre', () => {
  it('diz o tipo, o jogador, a área e a cena quando ela não é a aberta', () => {
    expect(areaTriggerEntryLine('Ana', 'armadilha', 'Corredor')).toBe('Armadilha: Ana entrou em Corredor')
    expect(areaTriggerEntryLine('Bia', 'alarme', 'Cripta', 'Torre')).toBe('Alarme: Bia entrou em Cripta — Torre')
  })

  it('área sem nome: o aviso usa o nome genérico', () => {
    const base = torre().regions[0]
    expect(regionAreaName({ ...base, room: { shape: 'rect', name: '  ' }, tag: '' })).toBe('área sem nome')
    expect(regionAreaName({ ...base, room: { shape: 'rect', name: 'Adega' } })).toBe('Adega')
  })
})

describe('disco e rede', () => {
  it('o gatilho volta do disco; lixo sai; mapa sem gatilho continua sem o campo', () => {
    const map = { ...torre(), gatilhos: [gatilho('g-1', 'armadilha', 'sala-a', true)] }
    expect(areaTriggersOf(deserializeMap(serializeMap(map)))).toEqual([gatilho('g-1', 'armadilha', 'sala-a', true)])
    expect('gatilhos' in deserializeMap(serializeMap(torre()))).toBe(false)
    expect(readAreaTriggers([{ id: 'x', kind: 'mina', regionId: 'a', revealed: false }, 'lixo'])).toBeUndefined()
    // Duas marcas na mesma região: vale a primeira. `revealed` que não é booleano nasce escondido.
    expect(readAreaTriggers([gatilho('a', 'alarme', 'r'), gatilho('b', 'armadilha', 'r'), { id: 'c', kind: 'alarme', regionId: 's', revealed: 'sim' }])).toEqual([
      gatilho('a', 'alarme', 'r'),
      gatilho('c', 'alarme', 's'),
    ])
  })

  it('parsePlayerAreaTriggers aceita só tipo conhecido e ponto numérico', () => {
    const ok = [{ kind: 'alarme', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }]
    expect(parsePlayerAreaTriggers(ok)).toEqual(ok)
    expect(parsePlayerAreaTriggers([{ kind: 'mina', points: [] }])).toBeNull()
    expect(parsePlayerAreaTriggers([{ kind: 'alarme', points: [{ x: 'a', y: 0 }] }])).toBeNull()
    expect(parsePlayerAreaTriggers('lixo')).toBeNull()
  })
})
