/**
 * O nome da cena como o jogador pode recebê-lo: SÓ o nome público que o
 * mestre escreveu para os jogadores. Sem ele, nada — o nome interno da cena
 * nunca entra nesta função, então nunca sai dela.
 */
import { describe, expect, it } from 'vitest'
import { SCENE_PUBLIC_NAME_MAX_LENGTH } from './adventure'
import { sceneNameForPlayer } from './fogFilter'

describe('sceneNameForPlayer', () => {
  it('nome público preenchido sai limpo', () => {
    expect(sceneNameForPlayer({ publicName: '  1º andar ' })).toBe('1º andar')
  })

  it('sem nome público (ausente, vazio, só espaço) não sai nada', () => {
    expect(sceneNameForPlayer({})).toBeUndefined()
    expect(sceneNameForPlayer({ publicName: '' })).toBeUndefined()
    expect(sceneNameForPlayer({ publicName: '   ' })).toBeUndefined()
  })

  it('nome acima do teto sai cortado no teto', () => {
    const nome = sceneNameForPlayer({ publicName: 'x'.repeat(SCENE_PUBLIC_NAME_MAX_LENGTH * 2) })
    expect(nome?.length).toBe(SCENE_PUBLIC_NAME_MAX_LENGTH)
  })
})
