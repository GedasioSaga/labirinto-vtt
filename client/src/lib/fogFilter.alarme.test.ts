/**
 * ALARME PARA VÁRIAS CENAS, no recorte do jogador: o alarme só existe para
 * quem está numa das cenas escolhidas, e o que viaja é só o id e o texto —
 * nunca a lista de cenas (ela diria que as outras existem).
 */
import { describe, expect, it } from 'vitest'
import { alarmForPlayer, type SceneAlarm } from './fogFilter'

const ALARME: SceneAlarm = { id: 'a1', text: 'O sino da torre tocou!', sceneIds: ['s-salao', 's-cripta'] }

describe('alarmForPlayer', () => {
  it('quem está numa das cenas escolhidas recebe só id e texto', () => {
    const recorte = alarmForPlayer(ALARME, 's-cripta')
    expect(recorte).toEqual({ id: 'a1', text: 'O sino da torre tocou!' })
    expect(Object.keys(recorte ?? {}).sort()).toEqual(['id', 'text'])
    expect(JSON.stringify(recorte)).not.toContain('s-salao')
  })

  it('quem está em outra cena, sem cena, ou sem alarme: nada', () => {
    expect(alarmForPlayer(ALARME, 's-porao')).toBeNull()
    expect(alarmForPlayer(ALARME, null)).toBeNull()
    expect(alarmForPlayer(null, 's-salao')).toBeNull()
  })

  it('campo a mais no alarme do mestre não vai ao jogador', () => {
    const comExtra = { ...ALARME, nomesDasCenas: ['Salao Norte', 'Cripta Rubra'] }
    expect(JSON.stringify(alarmForPlayer(comExtra, 's-salao'))).not.toContain('Salao Norte')
  })
})
