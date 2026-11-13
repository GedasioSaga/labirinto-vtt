/**
 * "Fora do Chão" (`MapData.offFloor`) é campo NOVO e OPCIONAL: vai e volta do
 * disco com os dois valores, cena salva antes dele abre sem o campo (bloqueado,
 * a cena de sempre) e grava sem ele, e valor torto de arquivo editado à mão
 * vira ausente, nunca livre.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap, setSceneOffFloor } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

describe('offFloor no arquivo da cena', () => {
  it('livre e bloqueado fazem ida e volta; o mapa lido grava igual', () => {
    for (const offFloor of ['free', 'blocked'] as const) {
      const cena = { ...createEmptyMap('convés', 'Convés', 20, 20, 64), offFloor }
      const lida = deserializeMap(serializeMap(cena))
      expect(lida.offFloor).toBe(offFloor)
      expect(lida).toEqual(cena)
      // O arquivo de um mapa lido, lido e gravado de novo, sai byte a byte igual.
      const arquivo = serializeMap(lida)
      // Sem indentação desde 12/11/2026 (caça, O8).
      expect(arquivo).toContain(`"offFloor":"${offFloor}"`)
      expect(serializeMap(deserializeMap(arquivo))).toBe(arquivo)
    }
  })

  it('cena salva antes do campo abre sem ele e grava sem ele; valor torto volta ausente', () => {
    // Cena de antes COM Chão de antes (peça lisa): sem o campo, vale bloqueada (`foraDoChaoLivre`).
    const antiga = deserializeMap('{"id": "antiga", "floor": [{"id": "chao", "op": "add", "modifiers": {}, "shape": {"kind": "rect", "cx": 100, "cy": 100, "w": 200, "h": 200}}]}')
    expect(antiga.floor).toHaveLength(1)
    expect('offFloor' in antiga).toBe(false)
    expect(serializeMap(antiga)).not.toContain('offFloor')
    for (const torto of ['true', '1', '"livre"', '"FREE"', 'null', '{}']) {
      expect('offFloor' in deserializeMap(`{"id": "torta", "offFloor": ${torto}}`)).toBe(false)
    }
    // Escolher Bloqueado na cena de antes (que já é bloqueada) não cria o campo.
    expect(setSceneOffFloor(antiga, 'blocked')).toBe(antiga)
    // Livre grava; voltar para Bloqueado guarda a escolha (o andar novo herda).
    const livre = setSceneOffFloor(antiga, 'free')
    expect(livre.offFloor).toBe('free')
    expect(setSceneOffFloor(livre, 'free')).toBe(livre)
    expect(setSceneOffFloor(livre, 'blocked').offFloor).toBe('blocked')
  })
})
