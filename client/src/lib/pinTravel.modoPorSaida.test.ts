import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { deserializeMap, serializeMap } from './mapFile'
import { createEmptyMap, updatePin } from './mapFactory'
import { acceptsLockedExitRequest, exitPassageOf, playerExitPassageOf, readPinExits, sameExits, setExitPassage } from './pinTravel'

/**
 * MODO POR SAÍDA da encruzilhada: cada saída extra pode ser livre, pedir ou
 * trancada. A principal é o modo do pino (`passagem`); a extra sem modo
 * próprio segue o da principal — mapa gravado antes disto abre igual.
 */

const CRUZ: Pin = {
  id: 'cruz',
  x: 64,
  y: 64,
  kind: 'viagem',
  description: 'Encruzilhada',
  image: null,
  destino: { sceneId: 'scene_b', pinId: 'b' },
  rotulo: 'Porta da cripta',
  saidas: [
    { id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: 'scene_c', pinId: 'c' }, passagem: 'livre' },
    { id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: 'scene_d', pinId: 'd' }, passagem: 'trancada' },
    { id: 'saida_ponte', rotulo: 'Ponte', destino: { sceneId: 'scene_e', pinId: 'e' } },
  ],
}

describe('pinTravel: modo por saída', () => {
  it('a principal usa o modo do pino; a extra usa o dela; sem o dela, o da principal', () => {
    expect(exitPassageOf(CRUZ)).toBe('pede')
    expect(exitPassageOf(CRUZ, 'principal')).toBe('pede')
    expect(exitPassageOf(CRUZ, 'saida_torre')).toBe('livre')
    expect(exitPassageOf(CRUZ, 'saida_poco')).toBe('trancada')
    expect(exitPassageOf(CRUZ, 'saida_ponte')).toBe('pede')
    // A extra sem modo segue a principal quando ela muda.
    expect(exitPassageOf({ ...CRUZ, passagem: 'livre' }, 'saida_ponte')).toBe('livre')
    // Saída que não é deste pino: o modo do pino, como antes (o host recusa a saída depois).
    expect(exitPassageOf({ ...CRUZ, passagem: 'trancada' }, 'inventada')).toBe('trancada')
  })

  it('modo torto (arquivo editado à mão) não vale: cai no da principal, nunca num que deixa passar', () => {
    const torto = { ...CRUZ, saidas: [{ id: 'saida_x', rotulo: '', destino: { sceneId: 's', pinId: 'p' }, passagem: 'escancarada' }] }
    // O cast imita o arquivo editado à mão: o tipo não deixa escrever o valor torto.
    expect(exitPassageOf(torto as unknown as Pin, 'saida_x')).toBe('pede')
  })

  it('setExitPassage: extra ganha ou perde o modo próprio; a principal troca o do pino', () => {
    expect(setExitPassage(CRUZ, 'saida_ponte', 'trancada').saidas?.[2]).toEqual({
      id: 'saida_ponte',
      rotulo: 'Ponte',
      destino: { sceneId: 'scene_e', pinId: 'e' },
      passagem: 'trancada',
    })
    const semModo = setExitPassage(CRUZ, 'saida_torre', undefined).saidas?.[0]
    expect(semModo).toEqual({ id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: 'scene_c', pinId: 'c' } })
    expect(semModo !== undefined && 'passagem' in semModo).toBe(false)
    expect(setExitPassage(CRUZ, 'principal', 'livre')).toEqual({ passagem: 'livre' })
    expect(setExitPassage(CRUZ, 'inventada', 'livre')).toEqual({})
  })

  it('updatePin: trocar o modo de uma saída é mudança (entra no desfazer); gravar o mesmo não é', () => {
    const map = { ...createEmptyMap('m', 'M', 5, 5, 64), pins: [CRUZ] }
    const trocado = updatePin(map, 'cruz', setExitPassage(CRUZ, 'saida_torre', 'trancada'))
    expect(trocado).not.toBe(map)
    expect(exitPassageOf(trocado.pins[0], 'saida_torre')).toBe('trancada')
    expect(updatePin(map, 'cruz', setExitPassage(CRUZ, 'saida_torre', 'livre'))).toBe(map)
    expect(sameExits(CRUZ, { ...CRUZ, saidas: CRUZ.saidas?.map((s) => ({ ...s, passagem: undefined })) })).toBe(false)
  })

  it('disco: o modo de cada saída faz ida e volta; valor torto some e a saída fica', () => {
    const map = { ...createEmptyMap('map_v', 'V', 5, 5, 64), pins: [CRUZ] }
    expect(deserializeMap(serializeMap(map)).pins).toEqual([CRUZ])
    const lidas = readPinExits([{ id: 'x', rotulo: 'X', destino: { sceneId: 's', pinId: 'p' }, passagem: 'passe' }])
    expect(lidas).toEqual([{ id: 'x', rotulo: 'X', destino: { sceneId: 's', pinId: 'p' } }])
  })

  it('pedido pela saída trancada que aceita tentativas vai ao mestre; mudo, não', () => {
    expect(acceptsLockedExitRequest(CRUZ, 'saida_poco')).toBe(true)
    expect(acceptsLockedExitRequest({ ...CRUZ, mudo: true }, 'saida_poco')).toBe(false)
    expect(acceptsLockedExitRequest(CRUZ, 'saida_torre')).toBe(false)
    expect(acceptsLockedExitRequest(CRUZ, 'principal')).toBe(false)
  })

  it('lado do jogador: lê o modo da escolha; ausente ou torto = o do pino', () => {
    const doJogador: Pick<Pin, 'passagem' | 'escolhas'> = {
      passagem: 'pede',
      escolhas: [
        { id: 'principal', rotulo: 'Porta' },
        { id: 'saida_torre', rotulo: 'Escada', passagem: 'livre' },
      ],
    }
    expect(playerExitPassageOf(doJogador, 'saida_torre')).toBe('livre')
    expect(playerExitPassageOf(doJogador, 'principal')).toBe('pede')
    expect(playerExitPassageOf(doJogador)).toBe('pede')
    const torto = { passagem: 'trancada', escolhas: [{ id: 'y', rotulo: 'Y', passagem: 'aberta' }] }
    // O cast imita o pacote de um host de versão futura: o tipo não deixa escrever o valor torto.
    expect(playerExitPassageOf(torto as unknown as Pick<Pin, 'passagem' | 'escolhas'>, 'y')).toBe('trancada')
  })
})
