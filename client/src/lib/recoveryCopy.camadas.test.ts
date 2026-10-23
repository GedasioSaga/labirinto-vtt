/**
 * CÓPIA DE RECUPERAÇÃO com camadas (fatia 2 de
 * `docs/planos/camadas-fase3-2026-10-22.md`): o mapa e as cenas vão pelo
 * `serializeMap` (o modelo de camadas, com os nomes das livres, fica fora do
 * mapa), e o modelo da aventura vai à parte para a camada livre ainda não
 * salva não se perder.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, ModeloDeCamadas } from '../types/map'
import { MODELO_PADRAO } from './camadas/padrao'
import { parede } from './__fixtures__/itensDeCamada'
import { createEmptyMap } from './mapFactory'
import { parseRecoveryCopy, serializeRecoveryCopy, type RecoveryCopy } from './recoveryCopy'

const NOME_SECRETO = 'Segredo do Lich'
const MODELO: ModeloDeCamadas = { ordem: [...MODELO_PADRAO.ordem, { id: 'livre_x', nome: NOME_SECRETO }] }

function mapaComCamadaLivre(id: string): MapData {
  return {
    ...createEmptyMap(id, 'Cripta', 10, 10, 64),
    walls: [{ ...parede, camada: 'livre_x' }],
    ocultasDoJogador: ['livre_x'],
    versaoDasCamadas: 2,
    modeloCamadas: MODELO,
  }
}

function copia(): RecoveryCopy {
  return { savedAtMs: 1_700_000_000_000, mapPath: null, map: mapaComCamadaLivre('m-aberto'), scenes: { 'cena-2': mapaComCamadaLivre('m-fundo') } }
}

describe('cópia de recuperação com camada livre', () => {
  it('o mapa e as cenas na cópia não levam o modelo (nem o nome da camada livre); o modelo vai à parte', () => {
    const gravado: unknown = JSON.parse(serializeRecoveryCopy(copia()))
    if (typeof gravado !== 'object' || gravado === null || !('map' in gravado) || !('scenes' in gravado) || !('camadas' in gravado)) throw new Error('cópia fora do formato')
    expect(JSON.stringify(gravado.map)).not.toContain(NOME_SECRETO)
    expect(JSON.stringify(gravado.map)).not.toContain('modeloCamadas')
    expect(JSON.stringify(gravado.scenes)).not.toContain(NOME_SECRETO)
    expect(JSON.stringify(gravado.scenes)).not.toContain('modeloCamadas')
    expect(gravado.camadas).toEqual(MODELO)
  })

  it('a volta reaplica o modelo no mapa e nas cenas, e a parede continua na camada livre', () => {
    const volta = parseRecoveryCopy(serializeRecoveryCopy(copia()))
    expect(volta?.map.modeloCamadas).toEqual(MODELO)
    expect(volta?.scenes['cena-2']?.modeloCamadas).toEqual(MODELO)
    expect(volta?.map.walls[0]?.camada).toBe('livre_x')
    expect(volta?.map.ocultasDoJogador).toEqual(['livre_x'])
    expect(volta?.map.versaoDasCamadas).toBe(2)
  })

  it('mapa sem modelo: a cópia não ganha o campo e a volta continua sem ele', () => {
    const semModelo: RecoveryCopy = { savedAtMs: 1, mapPath: 'C:/mapas/a.json', map: createEmptyMap('m', 'A', 5, 5, 50), scenes: {} }
    const texto = serializeRecoveryCopy(semModelo)
    expect(texto).not.toContain('"camadas"')
    const volta = parseRecoveryCopy(texto)
    expect(volta?.mapPath).toBe('C:/mapas/a.json')
    expect(volta?.scenes).toEqual({})
    expect(volta?.map.modeloCamadas).toBeUndefined()
  })

  it('modelo torto na cópia vira ausente, sem derrubar a recuperação', () => {
    const texto = serializeRecoveryCopy(copia()).replace(NOME_SECRETO, '')
    const torto = JSON.stringify({ ...JSON.parse(texto), camadas: { ordem: 'nada' } })
    const volta = parseRecoveryCopy(torto)
    expect(volta).not.toBeNull()
    expect(volta?.map.modeloCamadas).toBeUndefined()
  })
})
