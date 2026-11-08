/**
 * CONSERTO DAS FICHAS F1, fatia S2 (bug 11 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): numa pasta publicada, a
 * gravação que o Lobby recusaria não entra e não conta como feita — o ajuste
 * rápido devolve `false`, e o "Dar a…" da mochila não mexe no mapa sem ter
 * mexido na ficha. A recusa vem do funil do emissor (`prepararEmissao`), aqui
 * no lugar do teto do Lobby. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from '../types/map'
import type { ItemParaDar } from '../lib/items'
import type { Personagem } from '../lib/personagem'
import type { Emissao } from '../net/nuvem/emissor'

const lobby = vi.hoisted(() => ({ recusar: false }))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (caminho: string) => caminho.slice(0, caminho.lastIndexOf('/'))),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async (caminho: string) => {
    throw new Error(`arquivo não existe: ${caminho}`)
  }),
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('../net/nuvem/emissor', async (importOriginal) => {
  const original = await importOriginal<typeof import('../net/nuvem/emissor')>()
  const RECUSA: Emissao = { ok: false, motivo: 'O Lobby não aceita esta mudança (teto do teste). A ficha ficou como estava.', problema: 'teto do teste' }
  return { ...original, prepararEmissao: (...args: Parameters<typeof original.prepararEmissao>): Emissao => (lobby.recusar ? RECUSA : original.prepararEmissao(...args)) }
})

const { useAdventureStore, applyItemsInScene, personagensAtivos } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { darDoAcervoChange } = await import('../lib/items')
const { novoPersonagem } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
const { useToastStore } = await import('./toastStore')
type PastaAberta = import('../lib/pastasDeMapas').PastaAberta
type OpenedMapFile = import('../lib/mapFileIO').OpenedMapFile

const SKY = 's_sky'
const POCAO: ItemParaDar = { itemId: 'acervo_pocao', nome: 'Poção', empilhavel: true }
const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'p_luffy', recursos: { hp: 500, sp: 60, escudo: 0 } }
const BONECO: Token = { id: 't_luffy', characterId: LUFFY.id, name: 'Luffy', x: 96, y: 96, size: 1, image: null }

/** A aventura One Piece com as fichas na pasta publicada (mochila já na ficha). */
async function abrirNaPasta(): Promise<void> {
  const entrada = { id: SKY, name: 'Sky Lagoon', file: 'map.json' }
  const sky: MapData = { ...createEmptyMap('map_sky', 'Sky Lagoon', 20, 16, 64), tokens: [BONECO] }
  const aberto: OpenedMapFile = {
    path: 'C:/appdata/maps/adv_op/map.json',
    map: sky,
    adventure: { version: 1, id: 'adv_op', name: 'One Piece', startSceneId: SKY, scenes: [entrada], sistemaDeRpg: SISTEMA_ONE_PIECE.id },
    adventureDir: 'C:/appdata/maps/adv_op',
    activeSceneId: SKY,
    scenes: [{ entry: entrada, status: 'ok', map: sky }],
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  }
  const pasta: PastaAberta = { chave: 'adv_op', pastaId: 'pasta_op', nome: 'One Piece', sistemaDeRpg: SISTEMA_ONE_PIECE.id, proprio: false, personagens: [LUFFY], mochilaMigrada: 1 }
  await useAdventureStore.getState().open(aberto, pasta)
}

const luffy = (): Personagem | undefined => personagensAtivos(useAdventureStore.getState()).find((personagem) => personagem.id === LUFFY.id)
const ultimoAviso = (): string | undefined => useToastStore.getState().toasts.at(-1)?.text

beforeEach(() => {
  lobby.recusar = false
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vazio', 'Vazio', 20, 16, 64))
  useSessionStore.getState().markSaved()
  useToastStore.setState({ toasts: [] })
})

describe('bug 11: o que o Lobby recusa não conta como feito', () => {
  it('o −/+ do mestre na ficha da pasta publicada: a recusa devolve false, avisa, e o HP fica', async () => {
    await abrirNaPasta()
    lobby.recusar = true

    const ok = useAdventureStore.getState().ajustarPersonagem(LUFFY.id, (atual) => ({ ...atual, recursos: { ...atual.recursos, hp: 460 } }))

    expect(ok).toBe(false)
    expect(luffy()?.recursos.hp).toBe(500)
    expect(ultimoAviso()).toContain('O Lobby não aceita esta mudança')
  })

  it('"Dar a…" uma Poção ao Luffy com a ficha recusada: devolve false, e nem a ficha nem o boneco ganham a Poção', async () => {
    await abrirNaPasta()
    const boneco = useMapStore.getState().map.tokens.find((token) => token.id === BONECO.id)
    if (boneco === undefined) throw new Error('sem o boneco do Luffy')
    const change = darDoAcervoChange(boneco, POCAO, 1, 'vaga_pocao')
    if (change === null) throw new Error('a Poção tem nome: dar tinha de valer')
    const mapaAntes = useMapStore.getState().map
    lobby.recusar = true

    expect(applyItemsInScene(change)).toBe(false)

    expect(luffy()?.mochila ?? []).toEqual([])
    expect(useMapStore.getState().map).toBe(mapaAntes)
  })
})
