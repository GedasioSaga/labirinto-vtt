import { describe, expect, it } from 'vitest'
import type { RoomMeta } from '../types/map'
import {
  ROOM_LABEL_DEFAULT_COLOR,
  ROOM_LABEL_SCALE_MAX,
  ROOM_LABEL_SCALE_MIN,
  roomLabelStyleOf,
  sanitizeRoomLabelStyle,
  withRoomLabelStyle,
} from './roomLabelStyle'

const SALA: RoomMeta = { shape: 'rect', name: 'Âncora Prateada' }

describe('roomLabelStyleOf — o visual de sempre quando nada foi escolhido', () => {
  it('sala sem estilo: com fundo, 100%, grafite, horizontal', () => {
    expect(roomLabelStyleOf(SALA)).toEqual({ plate: true, scale: 1, color: ROOM_LABEL_DEFAULT_COLOR, vertical: false })
    expect(roomLabelStyleOf(undefined)).toEqual({ plate: true, scale: 1, color: ROOM_LABEL_DEFAULT_COLOR, vertical: false })
  })

  it('lê o que foi escolhido, com a cor em minúscula e o tamanho dentro da régua', () => {
    const sala: RoomMeta = { ...SALA, labelPlate: false, labelScale: 9, labelColor: '#FFAA00', labelVertical: true }
    expect(roomLabelStyleOf(sala)).toEqual({ plate: false, scale: ROOM_LABEL_SCALE_MAX, color: '#ffaa00', vertical: true })
  })

  it('cor ou tamanho sem forma válida caem no padrão', () => {
    const sala = { ...SALA, labelScale: Number.NaN, labelColor: 'vermelho' } as RoomMeta
    expect(roomLabelStyleOf(sala)).toMatchObject({ scale: 1, color: ROOM_LABEL_DEFAULT_COLOR })
  })
})

describe('withRoomLabelStyle — grava só o que foge do padrão', () => {
  it('tirar o fundo grava false; devolver o fundo apaga o campo', () => {
    const semFundo = withRoomLabelStyle(SALA, { plate: false })
    expect(semFundo.labelPlate).toBe(false)
    expect('labelPlate' in withRoomLabelStyle(semFundo, { plate: true })).toBe(false)
  })

  it('tamanho: prende na régua, arredonda a 0,01 e 100% apaga o campo', () => {
    expect(withRoomLabelStyle(SALA, { scale: 0.1 }).labelScale).toBe(ROOM_LABEL_SCALE_MIN)
    expect(withRoomLabelStyle(SALA, { scale: 0.7512 }).labelScale).toBe(0.75)
    expect('labelScale' in withRoomLabelStyle({ ...SALA, labelScale: 0.5 }, { scale: 1 })).toBe(false)
  })

  it('cor: grava em minúscula, a cor padrão apaga o campo, cor inválida não mexe', () => {
    expect(withRoomLabelStyle(SALA, { color: '#AABBCC' }).labelColor).toBe('#aabbcc')
    expect('labelColor' in withRoomLabelStyle({ ...SALA, labelColor: '#aabbcc' }, { color: ROOM_LABEL_DEFAULT_COLOR })).toBe(false)
    expect(withRoomLabelStyle({ ...SALA, labelColor: '#aabbcc' }, { color: 'azul' }).labelColor).toBe('#aabbcc')
  })

  it('vertical grava true; horizontal apaga o campo', () => {
    const vertical = withRoomLabelStyle(SALA, { vertical: true })
    expect(vertical.labelVertical).toBe(true)
    expect('labelVertical' in withRoomLabelStyle(vertical, { vertical: false })).toBe(false)
  })

  it('não mexe no resto da sala nem na sala de entrada', () => {
    const antes: RoomMeta = { ...SALA, nameHiddenFromPlayers: true }
    const depois = withRoomLabelStyle(antes, { plate: false, vertical: true })
    expect(depois.name).toBe('Âncora Prateada')
    expect(depois.nameHiddenFromPlayers).toBe(true)
    expect(antes.labelPlate).toBeUndefined()
  })
})

describe('sanitizeRoomLabelStyle — arquivo aberto', () => {
  it('descarta campo sem forma válida e prende o tamanho na régua', () => {
    const doArquivo = { ...SALA, labelPlate: 'sim', labelScale: 40, labelColor: 'red', labelVertical: 1 } as unknown as RoomMeta
    const limpa = sanitizeRoomLabelStyle(doArquivo)
    expect('labelPlate' in limpa).toBe(false)
    expect(limpa.labelScale).toBe(ROOM_LABEL_SCALE_MAX)
    expect('labelColor' in limpa).toBe(false)
    expect('labelVertical' in limpa).toBe(false)
  })

  it('mantém o que é válido', () => {
    const doArquivo: RoomMeta = { ...SALA, labelPlate: false, labelScale: 0.6, labelColor: '#336699', labelVertical: true }
    expect(sanitizeRoomLabelStyle(doArquivo)).toEqual(doArquivo)
  })
})
