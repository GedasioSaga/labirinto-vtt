import { describe, expect, it } from 'vitest'
import { andar6, GUARDA } from './__fixtures__/andar6'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * FACÇÃO E ALERTA NO ARQUIVO: os dois campos são NOVOS e OPCIONAIS. Salvar e
 * abrir devolve a facção de cada sala e o alerta da cena; mapa de antes abre
 * sem os campos (calmo, ninguém manda); lixo editado à mão sai.
 */
describe('mapFile — facção e alerta', () => {
  it('salvar e abrir preserva a facção das salas e o alerta da cena', () => {
    const aberto = deserializeMap(serializeMap(andar6()))
    expect(aberto.alerta).toBe('cacada')
    expect(aberto.regions.find((r) => r.id === 'd-norte')?.room?.faccao).toBe(GUARDA)
    const quartel = aberto.regions.find((r) => r.id === 's-quartel')
    expect(quartel?.room !== undefined && 'faccao' in quartel.room).toBe(false)
  })

  it('mapa de antes dos campos abre sem eles', () => {
    const { alerta: _alerta, ...semAlerta } = andar6()
    const aberto = deserializeMap(serializeMap(semAlerta))
    expect('alerta' in aberto).toBe(false)
  })

  it('valor inválido no arquivo sai: alerta desconhecido e facção que não é texto', () => {
    const cru: { alerta: unknown; regions: { id: string; room?: { faccao?: unknown } }[] } = JSON.parse(serializeMap(andar6()))
    cru.alerta = 'panico'
    const norte = cru.regions.find((r) => r.id === 'd-norte')
    if (norte?.room) norte.room.faccao = { nome: 'objeto' }
    const aberto = deserializeMap(JSON.stringify(cru))
    expect('alerta' in aberto).toBe(false)
    const norteAberto = aberto.regions.find((r) => r.id === 'd-norte')
    expect(norteAberto?.room?.name).toBe('Distrito Norte')
    expect(norteAberto?.room !== undefined && 'faccao' in norteAberto.room).toBe(false)
  })
})
