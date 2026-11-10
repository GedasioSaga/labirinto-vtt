/**
 * EDITAR E EXCLUIR UMA CONDIÇÃO CRIADA VALE PARA TODAS AS CENAS da aventura
 * aberta, e não só para a que está na tela. A cena que não abriu não é
 * alcançada: ela é contada, para o aviso dizer. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CondicaoPropria, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { alcanceDaCondicao, tirarCondicaoDeTodasAsCenas, trocarCondicaoEmTodasAsCenas } = await import('./condicoesNasCenas')
const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

const QUEIMANDO: CondicaoPropria = { id: 'cond_queimando', nome: 'Queimando', cor: '#ff8a5c', simbolo: 'chama' }
const EM_BRASA: CondicaoPropria = { id: 'cond_queimando', nome: 'Em brasa', cor: '#7fb8f0', simbolo: 'chama', texto: '🔥' }
const MARCADO: CondicaoPropria = { id: 'cond_marcado', nome: 'Marcado', cor: '#7fb8f0', simbolo: 'alvo', texto: 'M' }

function ficha(id: string, condicoesProprias: CondicaoPropria[]): Token {
  return { id, characterId: null, name: id, x: 64, y: 64, size: 1, image: null, condicoesProprias }
}

/** As condições criadas de cada ficha de uma cena de fundo que abriu. */
function condicoesNoFundo(cenaId: string): Record<string, CondicaoPropria[] | undefined> {
  const slot = useAdventureStore.getState().cache[cenaId]
  if (slot === undefined || slot.status !== 'ok') throw new Error(`a cena ${cenaId} não está aberta no fundo`)
  return Object.fromEntries(slot.map.tokens.map((token) => [token.id, token.condicoesProprias]))
}

function condicoesNaAberta(): Record<string, CondicaoPropria[] | undefined> {
  return Object.fromEntries(useMapStore.getState().map.tokens.map((token) => [token.id, token.condicoesProprias]))
}

/** O Vale (com o Grog queimando) vai para o fundo; a Cripta nasce aberta, com a Lia queimando e marcada. Devolve os ids. */
function valeNoFundoECriptaAberta(): { vale: string; cripta: string } {
  useMapStore.getState().addToken(ficha('grog', [QUEIMANDO]))
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0]?.id ?? ''
  useMapStore.getState().addToken(ficha('lia', [QUEIMANDO, MARCADO]))
  return { vale, cripta }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 30, 20, 64))
  useSessionStore.getState().markSaved()
})

describe('condição criada em todas as cenas', () => {
  it('editar troca o nome, a cor e o símbolo nas fichas da cena aberta E da cena de fundo, que fica marcada para o Salvar', () => {
    const { vale } = valeNoFundoECriptaAberta()
    expect(alcanceDaCondicao(QUEIMANDO.id)).toEqual({ fichas: 2, cenas: 2, cenasFechadas: 0 })

    trocarCondicaoEmTodasAsCenas(EM_BRASA)

    expect(condicoesNaAberta()).toEqual({ lia: [EM_BRASA, MARCADO] })
    expect(condicoesNoFundo(vale)).toEqual({ grog: [EM_BRASA] })
    expect(useAdventureStore.getState().dirty[vale]).toBe(true)
    // A condição continua nas mesmas fichas: editar não tira nem põe marca.
    expect(alcanceDaCondicao(QUEIMANDO.id)).toEqual({ fichas: 2, cenas: 2, cenasFechadas: 0 })
  })

  it('excluir tira a marca de todas as cenas que abriram; a cena que não abriu é contada e fica como está', () => {
    const { vale } = valeNoFundoECriptaAberta()
    const porao = useAdventureStore.getState().createScene('Porão', null)
    // O Porão está aberto agora, sem fichas; a Cripta foi para o fundo e o arquivo dela sumiu.
    const cripta = useAdventureStore.getState().adventure?.scenes.find((cena) => cena.name === 'Cripta')?.id ?? ''
    const { cache } = useAdventureStore.getState()
    useAdventureStore.setState({ cache: { ...cache, [cripta]: { status: 'indisponivel', reason: 'arquivo não existe' } } })
    expect(useAdventureStore.getState().activeSceneId).toBe(porao)
    expect(alcanceDaCondicao(QUEIMANDO.id)).toEqual({ fichas: 1, cenas: 1, cenasFechadas: 1 })

    tirarCondicaoDeTodasAsCenas(QUEIMANDO.id)

    expect(condicoesNoFundo(vale).grog ?? []).toEqual([])
    expect(useAdventureStore.getState().dirty[vale]).toBe(true)
    expect(useAdventureStore.getState().cache[cripta]).toEqual({ status: 'indisponivel', reason: 'arquivo não existe' })
    expect(alcanceDaCondicao(QUEIMANDO.id)).toEqual({ fichas: 0, cenas: 0, cenasFechadas: 1 })
  })
})
