/**
 * NOME PARA OS JOGADORES: a cena pode ter, além do nome do mestre, um nome
 * público opcional ("1º andar"). Ele mora na entrada da cena do
 * `adventure.json`; vazio = a cena não tem nome para o jogador.
 */
import { describe, expect, it } from 'vitest'
import { SCENE_PUBLIC_NAME_MAX_LENGTH, cleanPublicSceneName, parseAdventure, serializeAdventure, type Adventure } from './adventure'

function aventuraCom(scenes: unknown[]): string {
  return JSON.stringify({ version: 1, id: 'adv', name: 'Mansao', startSceneId: 's-t', scenes })
}

describe('cleanPublicSceneName', () => {
  it('apara as pontas e devolve o texto; vazio ou só espaço vira "sem nome público"', () => {
    expect(cleanPublicSceneName('  1º andar ')).toBe('1º andar')
    expect(cleanPublicSceneName('')).toBeUndefined()
    expect(cleanPublicSceneName('   ')).toBeUndefined()
  })

  it('corta no teto, sem deixar meia letra no fim', () => {
    expect(cleanPublicSceneName('a'.repeat(SCENE_PUBLIC_NAME_MAX_LENGTH + 10))).toBe('a'.repeat(SCENE_PUBLIC_NAME_MAX_LENGTH))
    // Emoji (2 unidades UTF-16) atravessando o teto sai inteiro, não pela metade.
    const cortado = cleanPublicSceneName('a'.repeat(SCENE_PUBLIC_NAME_MAX_LENGTH - 1) + '🏰')
    expect(cortado).toBe('a'.repeat(SCENE_PUBLIC_NAME_MAX_LENGTH - 1))
  })
})

describe('adventure.json com nome para os jogadores', () => {
  it('lê o nome público de cada cena; ausente, vazio ou de outro tipo fica sem', () => {
    const aventura = parseAdventure(
      aventuraCom([
        { id: 's-t', name: 'Terreo do cofre', file: 'scenes/s-t/map.json', publicName: ' Térreo ' },
        { id: 's-1', name: 'Andar do vilao', file: 'scenes/s-1/map.json', publicName: '1º andar' },
        { id: 's-p', name: 'Porao do culto', file: 'scenes/s-p/map.json', publicName: '   ' },
        { id: 's-x', name: 'Sotao', file: 'scenes/s-x/map.json', publicName: 42 },
        { id: 's-y', name: 'Jardim', file: 'scenes/s-y/map.json' },
      ]),
    )
    expect(aventura.scenes.map((s) => s.publicName)).toEqual(['Térreo', '1º andar', undefined, undefined, undefined])
    expect(aventura.scenes.filter((s) => 'publicName' in s).map((s) => s.id)).toEqual(['s-t', 's-1'])
  })

  it('grava e relê igual (ida e volta)', () => {
    const aventura: Adventure = {
      version: 1,
      id: 'adv',
      name: 'Mansao',
      startSceneId: 's-t',
      scenes: [
        { id: 's-t', name: 'Terreo do cofre', file: 'scenes/s-t/map.json', publicName: 'Térreo' },
        { id: 's-p', name: 'Porao do culto', file: 'scenes/s-p/map.json' },
      ],
    }
    expect(parseAdventure(serializeAdventure(aventura))).toEqual(aventura)
  })
})
