/**
 * ALARME PARA VÁRIAS CENAS no cliente do jogador: `scene.alarm` vira
 * `state.alarm`, que fica até o MESTRE encerrar (`scene.alarm.end` com o mesmo
 * id) — o jogador não tem como fechar. Forma errada: a mensagem inteira cai.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { ALARM_MAX_LENGTH, parseSceneAlarm, parseSceneAlarmEnd } from '../net/protocol'
import { createPlayerConnection, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

function conectado() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Ana',
    storage: null,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (!socket) throw new Error('socket não criado')
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
  return { connection, socket, sockets }
}

function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return mesa
}

describe('parseSceneAlarm / parseSceneAlarmEnd', () => {
  it('aceita id e texto dentro do teto, e devolve só os campos conhecidos', () => {
    expect(parseSceneAlarm({ type: 'scene.alarm', id: 'a1', text: 'Fogo!', sceneIds: ['s-salao'] })).toEqual({ type: 'scene.alarm', id: 'a1', text: 'Fogo!' })
    expect(parseSceneAlarm({ type: 'scene.alarm', id: 'a1', text: 'x'.repeat(ALARM_MAX_LENGTH) })?.text.length).toBe(ALARM_MAX_LENGTH)
    expect(parseSceneAlarmEnd({ type: 'scene.alarm.end', id: 'a1', extra: 1 })).toEqual({ type: 'scene.alarm.end', id: 'a1' })
  })

  it('recusa forma errada e texto acima do teto', () => {
    expect(parseSceneAlarm({ type: 'scene.alarm', id: 'a1', text: 'x'.repeat(ALARM_MAX_LENGTH + 1) })).toBeNull()
    expect(parseSceneAlarm({ type: 'scene.alarm', id: 'a1', text: '' })).toBeNull()
    expect(parseSceneAlarm({ type: 'scene.alarm', id: '', text: 'oi' })).toBeNull()
    expect(parseSceneAlarm({ type: 'scene.alarm', text: 'oi' })).toBeNull()
    expect(parseSceneAlarm({ type: 'scene.note', id: 'a1', text: 'oi' })).toBeNull()
    expect(parseSceneAlarm(null)).toBeNull()
    expect(parseSceneAlarmEnd({ type: 'scene.alarm.end' })).toBeNull()
    expect(parseSceneAlarmEnd({ type: 'scene.alarm.end', id: 7 })).toBeNull()
    expect(parseSceneAlarmEnd(['scene.alarm.end'])).toBeNull()
  })
})

describe('alarme no cliente do jogador', () => {
  it('guarda o alarme, o novo substitui, e só o encerrar do MESMO id tira', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.alarm', id: 'a1', text: 'O sino tocou!' })
    expect(connection.getState().alarm).toEqual({ id: 'a1', text: 'O sino tocou!' })
    socket.receive({ type: 'scene.alarm', id: 'a2', text: 'Desabamento!' })
    expect(connection.getState().alarm).toEqual({ id: 'a2', text: 'Desabamento!' })
    // Encerrar atrasado do alarme antigo não apaga o novo.
    socket.receive({ type: 'scene.alarm.end', id: 'a1' })
    expect(connection.getState().alarm).toEqual({ id: 'a2', text: 'Desabamento!' })
    socket.receive({ type: 'scene.alarm.end', id: 'a2' })
    expect(connection.getState().alarm).toBeUndefined()
  })

  it('malformado não aparece nem apaga o aberto; o recado do mestre não mexe no alarme', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.alarm', id: 'a1', text: 'fica' })
    socket.receive({ type: 'scene.alarm', id: 'a2', text: 'x'.repeat(ALARM_MAX_LENGTH + 1) })
    socket.receive({ type: 'scene.alarm', id: 'a3' })
    socket.receive({ type: 'scene.alarm.end' })
    socket.receive({ type: 'scene.note', id: 'n1', text: 'recado' })
    connection.dismissNote()
    expect(connection.getState().alarm).toEqual({ id: 'a1', text: 'fica' })
  })

  it('fora do jogo o alarme é ignorado; voltar à espera ou reconectar limpa o aberto', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'lobby.waiting' })
    socket.receive({ type: 'scene.alarm', id: 'a1', text: 'oi' })
    expect(connection.getState().alarm).toBeUndefined()

    const mesa = jogando()
    mesa.socket.receive({ type: 'scene.alarm', id: 'a1', text: 'oi' })
    mesa.socket.receive({ type: 'lobby.waiting' })
    expect(mesa.connection.getState().alarm).toBeUndefined()

    const outra = jogando()
    outra.socket.receive({ type: 'scene.alarm', id: 'a1', text: 'oi' })
    outra.connection.reconnect()
    // O host manda de novo, depois do mapa, se ele ainda estiver numa cena com alarme.
    expect(outra.connection.getState().alarm).toBeUndefined()
  })
})
