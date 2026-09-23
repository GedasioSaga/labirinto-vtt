/**
 * CENAS EM PASTAS (`lib/adventure.ts`): cena dentro de cena — região > cidade
 * > bairro > casa. O que se cobra aqui é o dado, sem tela: o `adventure.json`
 * guarda a cena "de fora" de cada uma (`parentId`), a aventura antiga (sem o
 * campo) abre tudo no primeiro nível, arquivo editado à mão não trava a lista
 * (pai que não existe, que é ela mesma ou que fecha um ciclo sai), e pôr uma
 * cena dentro de outra nunca a põe dentro dela mesma.
 */
import { describe, expect, it } from 'vitest'
import {
  canNestScene,
  nestScene,
  parseAdventure,
  sceneAncestorIds,
  sceneSubtreeIds,
  sceneTrail,
  sceneTree,
  serializeAdventure,
  type Adventure,
  type SceneEntry,
} from './adventure'

function cena(id: string, name: string, parentId?: string): SceneEntry {
  return parentId === undefined ? { id, name, file: `scenes/${id}/map.json` } : { id, name, file: `scenes/${id}/map.json`, parentId }
}

/** A viagem entre cidades da simulação: região > cidade > bairro > casa, e duas "Taverna". */
const VIAGEM: SceneEntry[] = [
  cena('costa', 'Costa Norte'),
  cena('porto', 'Porto Cinza', 'costa'),
  cena('mercado', 'Mercado', 'porto'),
  cena('tav-porto', 'Taverna', 'mercado'),
  cena('estrada', 'Estrada Velha'),
  cena('vila', 'Vila do Vau'),
  cena('tav-vila', 'Taverna', 'vila'),
]

function aventura(scenes: unknown[]): string {
  return JSON.stringify({ version: 1, id: 'adv_1', name: 'Viagem', startSceneId: 'costa', scenes })
}

describe('parseAdventure: a cena de fora de cada cena', () => {
  it('guarda o parentId de cada cena e salva e reabre igual', () => {
    const lida = parseAdventure(aventura(VIAGEM))
    expect(lida.scenes.map((s) => [s.id, s.parentId ?? null])).toEqual([
      ['costa', null],
      ['porto', 'costa'],
      ['mercado', 'porto'],
      ['tav-porto', 'mercado'],
      ['estrada', null],
      ['vila', null],
      ['tav-vila', 'vila'],
    ])
    const reaberta: Adventure = parseAdventure(serializeAdventure(lida))
    expect(reaberta).toEqual(lida)
  })

  it('aventura antiga, sem parentId, abre tudo no primeiro nível', () => {
    const antiga = aventura([
      { id: 'vale', name: 'Vale', file: 'map.json' },
      { id: 'cripta', name: 'Cripta', file: 'scenes/cripta/map.json' },
    ])
    const lida = parseAdventure(antiga)
    expect(lida.scenes).toEqual([
      { id: 'vale', name: 'Vale', file: 'map.json' },
      { id: 'cripta', name: 'Cripta', file: 'scenes/cripta/map.json' },
    ])
    expect(sceneTree(lida.scenes).map((row) => [row.entry.id, row.depth])).toEqual([
      ['vale', 0],
      ['cripta', 0],
    ])
    // Gravar de novo não inventa campo: o arquivo antigo continua do mesmo jeito.
    expect(serializeAdventure(lida)).not.toContain('parentId')
  })

  it('pai que não existe, que é a própria cena ou que não é texto sai: a cena volta ao primeiro nível', () => {
    const lida = parseAdventure(
      aventura([
        { id: 'a', name: 'A', file: 'a.json', parentId: 'sumiu' },
        { id: 'b', name: 'B', file: 'b.json', parentId: 'b' },
        { id: 'c', name: 'C', file: 'c.json', parentId: 42 },
        { id: 'd', name: 'D', file: 'd.json', parentId: '' },
        { id: 'e', name: 'E', file: 'e.json', parentId: 'a' },
      ]),
    )
    expect(lida.scenes.map((s) => [s.id, s.parentId ?? null])).toEqual([
      ['a', null],
      ['b', null],
      ['c', null],
      ['d', null],
      ['e', 'a'],
    ])
  })

  it('ciclo escrito à mão (A dentro de B, B dentro de A) é cortado: toda cena aparece uma vez', () => {
    const lida = parseAdventure(
      aventura([
        { id: 'a', name: 'A', file: 'a.json', parentId: 'b' },
        { id: 'b', name: 'B', file: 'b.json', parentId: 'a' },
        { id: 'c', name: 'C', file: 'c.json', parentId: 'c' },
      ]),
    )
    const arvore = sceneTree(lida.scenes)
    expect(arvore.map((row) => row.entry.id).sort()).toEqual(['a', 'b', 'c'])
    // Sobrou exatamente um pai entre A e B: um dentro do outro, nunca os dois.
    expect(lida.scenes.filter((s) => s.parentId !== undefined)).toHaveLength(1)
    for (const s of lida.scenes) expect(sceneAncestorIds(lida.scenes, s.id)).not.toContain(s.id)
  })
})

describe('sceneTree: a lista na ordem da árvore', () => {
  it('cada cena seguida das de dentro dela, com o nível e quem está dentro', () => {
    const arvore = sceneTree(VIAGEM)
    expect(arvore.map((row) => [row.entry.name, row.depth])).toEqual([
      ['Costa Norte', 0],
      ['Porto Cinza', 1],
      ['Mercado', 2],
      ['Taverna', 3],
      ['Estrada Velha', 0],
      ['Vila do Vau', 0],
      ['Taverna', 1],
    ])
    expect(arvore.find((row) => row.entry.id === 'porto')?.childIds).toEqual(['mercado'])
    expect(arvore.find((row) => row.entry.id === 'tav-vila')?.parentId).toBe('vila')
    expect(arvore.find((row) => row.entry.id === 'estrada')?.childIds).toEqual([])
  })

  it('filha que vem antes da mãe na lista continua embaixo dela', () => {
    const arvore = sceneTree([cena('casa', 'Casa', 'rua'), cena('rua', 'Rua')])
    expect(arvore.map((row) => [row.entry.id, row.depth])).toEqual([
      ['rua', 0],
      ['casa', 1],
    ])
  })
})

describe('caminho e parentes', () => {
  it('sceneTrail: os nomes das cenas de fora, da mais de fora para a mais de dentro', () => {
    expect(sceneTrail(VIAGEM, 'tav-porto')).toEqual(['Costa Norte', 'Porto Cinza', 'Mercado'])
    expect(sceneTrail(VIAGEM, 'tav-vila')).toEqual(['Vila do Vau'])
    expect(sceneTrail(VIAGEM, 'estrada')).toEqual([])
  })

  it('sceneAncestorIds e sceneSubtreeIds', () => {
    expect(sceneAncestorIds(VIAGEM, 'tav-porto')).toEqual(['costa', 'porto', 'mercado'])
    expect([...sceneSubtreeIds(VIAGEM, 'porto')].sort()).toEqual(['mercado', 'porto', 'tav-porto'])
    expect([...sceneSubtreeIds(VIAGEM, 'estrada')]).toEqual(['estrada'])
  })
})

describe('nestScene: pôr uma cena dentro de outra', () => {
  it('Mercado dentro de Estrada Velha: vira a última de dentro dela e leva a Taverna junto', () => {
    const depois = nestScene(VIAGEM, 'mercado', 'estrada')
    expect(depois).not.toBeNull()
    const lista = depois ?? []
    expect(lista.find((s) => s.id === 'mercado')?.parentId).toBe('estrada')
    expect(lista.find((s) => s.id === 'tav-porto')?.parentId).toBe('mercado')
    expect(lista.map((s) => s.id).at(-1)).toBe('mercado')
    expect(sceneTree(lista).map((row) => [row.entry.id, row.depth])).toEqual([
      ['costa', 0],
      ['porto', 1],
      ['estrada', 0],
      ['mercado', 1],
      ['tav-porto', 2],
      ['vila', 0],
      ['tav-vila', 1],
    ])
    // Não mexe na lista de quem chamou.
    expect(VIAGEM.find((s) => s.id === 'mercado')?.parentId).toBe('porto')
  })

  it('primeiro nível (null) tira o campo, e o arquivo gravado fica como o de uma cena solta', () => {
    const depois = nestScene(VIAGEM, 'tav-vila', null) ?? []
    const taverna = depois.find((s) => s.id === 'tav-vila')
    expect(taverna).toEqual({ id: 'tav-vila', name: 'Taverna', file: 'scenes/tav-vila/map.json' })
    expect(sceneTrail(depois, 'tav-vila')).toEqual([])
  })

  it('recusa pôr a cena dentro dela mesma ou de uma cena que está dentro dela', () => {
    expect(canNestScene(VIAGEM, 'porto', 'porto')).toBe(false)
    expect(canNestScene(VIAGEM, 'porto', 'tav-porto')).toBe(false)
    expect(canNestScene(VIAGEM, 'porto', 'vila')).toBe(true)
    expect(canNestScene(VIAGEM, 'porto', null)).toBe(true)
    expect(nestScene(VIAGEM, 'porto', 'mercado')).toBeNull()
    expect(nestScene(VIAGEM, 'porto', 'porto')).toBeNull()
  })

  it('cena ou pasta que não existe, ou nada a mudar: null', () => {
    expect(canNestScene(VIAGEM, 'sumiu', null)).toBe(false)
    expect(canNestScene(VIAGEM, 'porto', 'sumiu')).toBe(false)
    expect(nestScene(VIAGEM, 'porto', 'sumiu')).toBeNull()
    expect(nestScene(VIAGEM, 'mercado', 'porto')).toBeNull()
    expect(nestScene(VIAGEM, 'estrada', null)).toBeNull()
  })
})
