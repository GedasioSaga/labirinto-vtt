/**
 * SALVAR SEM PERDER — Salvar só marca como salvo o que foi gravado.
 *
 * Gravar no disco leva tempo, e o mestre continua mexendo enquanto isso: o
 * editor não trava. O que ele mudou DURANTE a gravação não está no arquivo,
 * então tem que continuar pendente — senão fechar a janela logo depois não
 * pergunta nada e a mudança some.
 *
 * O disco aqui é um dublê que só termina quando o teste manda (`liberarDisco`),
 * para dar para editar "no meio" da gravação.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Token } from '../types/map'

interface GravacaoPresa {
  adventure: unknown
  writes: { file: string; map: MapData }[]
  liberar: () => void
}

const gravacoes: GravacaoPresa[] = []

vi.mock('../lib/mapFileIO', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/mapFileIO')>()
  return {
    ...original,
    mapDirFor: vi.fn(async (mapId: string) => `C:/appdata/maps/${mapId}`),
    scenePath: vi.fn(async (dir: string, file: string) => `${dir}/${file}`),
    saveAdventureToDisk: vi.fn(
      (_dir: string, adventure: unknown, writes: { file: string; map: MapData }[]) =>
        new Promise<void>((resolve) => {
          gravacoes.push({ adventure, writes, liberar: resolve })
        }),
    ),
  }
})
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore, hasUnsavedWork } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag, saveOpenMap } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

subscribeToDirtyFlag()

function token(id: string): Token {
  return { id, characterId: null, name: id, x: 64, y: 64, size: 1, image: null }
}

/** Espera o `flush` chegar ao disco (ele resolve a pasta antes, com `await`). */
async function discoOcupado(): Promise<GravacaoPresa> {
  await vi.waitFor(() => expect(gravacoes).toHaveLength(1))
  return gravacoes[0]
}

/** Vale (cena aberta) e Cripta (cena de fundo), tudo já gravado uma vez. */
async function aventuraGravada(): Promise<{ vale: string; cripta: string }> {
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vale)
  const primeira = useAdventureStore.getState().flush()
  ;(await discoOcupado()).liberar()
  await primeira
  gravacoes.length = 0
  expect(hasUnsavedWork()).toBe(false)
  return { vale, cripta }
}

beforeEach(() => {
  gravacoes.length = 0
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 30, 20, 64))
  useSessionStore.getState().markSaved()
})

describe('mapa solto: Salvar (Ctrl+S, Início, "Salvar e continuar")', () => {
  it('edição feita enquanto o disco grava continua como não salva', async () => {
    useMapStore.getState().addToken(token('grog'))
    let liberar: () => void = () => undefined
    const gravado: MapData[] = []

    const salvando = saveOpenMap(
      (map) =>
        new Promise<string>((resolve) => {
          gravado.push(map)
          liberar = () => resolve('C:/mesa/vale.json')
        }),
    )
    // Durante a gravação o mestre põe outro token.
    useMapStore.getState().addToken(token('esqueleto'))
    liberar()

    expect(await salvando).toBe('C:/mesa/vale.json')
    expect(gravado.map((m) => m.tokens.map((t) => t.id))).toEqual([['grog']])
    expect(useSessionStore.getState().isDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('sem edição no meio, o que foi gravado fica salvo — e desfazer até a versão gravada volta a "salvo"', async () => {
    useMapStore.getState().addToken(token('grog'))
    await saveOpenMap(async () => 'C:/mesa/vale.json')
    expect(useSessionStore.getState().isDirty).toBe(false)

    useMapStore.getState().addToken(token('esqueleto'))
    expect(useSessionStore.getState().isDirty).toBe(true)
    useMapStore.getState().undo()
    expect(useSessionStore.getState().isDirty).toBe(false)
  })

  it('gravação que falha não marca nada como salvo', async () => {
    useMapStore.getState().addToken(token('grog'))
    await expect(saveOpenMap(async () => Promise.reject(new Error('disco cheio')))).rejects.toThrow('disco cheio')
    expect(useSessionStore.getState().isDirty).toBe(true)
  })
})

describe('aventura: flush', () => {
  it('mudança numa cena de fundo feita durante a gravação continua pendente', async () => {
    const { cripta } = await aventuraGravada()
    useMapStore.getState().addToken(token('grog'))

    const salvando = useAdventureStore.getState().flush()
    const disco = await discoOcupado()
    // Durante a gravação, algo muda a Cripta (ex.: jogador atravessou, guardião do pino).
    useAdventureStore.getState().updateBackgroundScene(cripta, (map) => ({ ...map, tokens: [...map.tokens, token('zumbi')] }))
    disco.liberar()
    await salvando

    expect(disco.writes).toHaveLength(1)
    expect(useAdventureStore.getState().dirty[cripta]).toBe(true)
    expect(useAdventureStore.getState().hasPendingScenes()).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('cena de fundo mudada ANTES e de novo DURANTE a gravação: a segunda mudança continua pendente', async () => {
    const { cripta } = await aventuraGravada()
    useAdventureStore.getState().updateBackgroundScene(cripta, (map) => ({ ...map, tokens: [token('zumbi')] }))

    const salvando = useAdventureStore.getState().flush()
    const disco = await discoOcupado()
    useAdventureStore.getState().updateBackgroundScene(cripta, (map) => ({ ...map, tokens: [...map.tokens, token('lich')] }))
    disco.liberar()
    await salvando

    expect(disco.writes.map((w) => w.map.tokens.map((t) => t.id))).toContainEqual(['zumbi'])
    expect(useAdventureStore.getState().dirty[cripta]).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('renomear uma cena durante a gravação continua pendente (a lista gravada tinha o nome antigo)', async () => {
    const { cripta } = await aventuraGravada()

    const salvando = useAdventureStore.getState().flush()
    const disco = await discoOcupado()
    useAdventureStore.getState().renameScene(cripta, 'Catacumba')
    disco.liberar()
    await salvando

    expect(useAdventureStore.getState().structureDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('edição na cena aberta durante a gravação continua não salva', async () => {
    await aventuraGravada()
    useMapStore.getState().addToken(token('grog'))

    const salvando = useAdventureStore.getState().flush()
    const disco = await discoOcupado()
    useMapStore.getState().addToken(token('esqueleto'))
    disco.liberar()
    await salvando

    expect(useSessionStore.getState().isDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('sem nada no meio, tudo o que foi gravado sai de pendente', async () => {
    const { cripta } = await aventuraGravada()
    useMapStore.getState().addToken(token('grog'))
    useAdventureStore.getState().updateBackgroundScene(cripta, (map) => ({ ...map, tokens: [token('zumbi')] }))
    useAdventureStore.getState().renameScene(cripta, 'Catacumba')

    const salvando = useAdventureStore.getState().flush()
    ;(await discoOcupado()).liberar()
    await salvando

    expect(useAdventureStore.getState().dirty).toEqual({})
    expect(useAdventureStore.getState().structureDirty).toBe(false)
    expect(hasUnsavedWork()).toBe(false)
  })

  it('trocar de cena durante a gravação: a cena que saiu, sem mudança nova, conta como gravada', async () => {
    const { cripta } = await aventuraGravada()
    useMapStore.getState().addToken(token('grog'))

    const salvando = useAdventureStore.getState().flush()
    const disco = await discoOcupado()
    useAdventureStore.getState().switchScene(cripta)
    disco.liberar()
    await salvando

    expect(hasUnsavedWork()).toBe(false)
  })

  it('gravação que falha deixa tudo pendente', async () => {
    const { cripta } = await aventuraGravada()
    useAdventureStore.getState().updateBackgroundScene(cripta, (map) => ({ ...map, tokens: [token('zumbi')] }))
    const { saveAdventureToDisk } = await import('../lib/mapFileIO')
    vi.mocked(saveAdventureToDisk).mockRejectedValueOnce(new Error('disco cheio'))

    await expect(useAdventureStore.getState().flush()).rejects.toThrow('disco cheio')

    expect(useAdventureStore.getState().dirty[cripta]).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })
})
