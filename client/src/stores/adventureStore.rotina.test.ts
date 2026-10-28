/**
 * ROTINA DO NPC no editor do mestre: o apito é um ESTADO DO MUNDO ("Apito:
 * Aurora, Meio, Brasa"). Desde a Caminhos F4, trocar o valor NÃO tira ficha do
 * lugar: avisa quem assina `subscribeToApito` (a rotina andando liga a
 * caminhada de cada uma). O teleporte antigo ficou só em "Pular para o posto"
 * (`pularParaOPosto`): dentro da cena, ou para outra cena, sem duplicar a
 * ficha. Ficha que um jogador segura fica onde está. Gravar o posto é edição
 * do mestre e entra no Ctrl+Z; o apito e o pulo são mudança de mesa e não entram.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from '../types/map'

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

const { subscribeToApito, useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

function fichaDe(map: MapData, id: string): Token | undefined {
  return map.tokens.find((t) => t.id === id)
}

function fundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error('cena de fundo fora do ar')
  return slot.map
}

/**
 * Capela (fundo) e Confessionário (aberta). O Tobias começa na cena aberta;
 * posto do Meio na Capela, da Brasa no próprio Confessionário.
 */
function montar(): { capela: string; conf: string; apito: string } {
  useMapStore.getState().loadMap(createEmptyMap('map_capela', 'Capela', 30, 20, 50))
  useSessionStore.getState().markSaved()
  const conf = useAdventureStore.getState().createScene('Confessionário', null)
  const capela = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  const apito = useAdventureStore.getState().criarEstadoDoMundo('Apito', 'Aurora, Meio, Brasa')
  if (apito === null) throw new Error('não criou o estado')
  const tobias: Token = {
    id: 'tobias',
    characterId: null,
    name: 'Irmão Tobias',
    x: 100,
    y: 100,
    size: 1,
    image: null,
    npc: true,
    rotina: {
      estadoId: apito,
      postos: [
        { valor: 'Meio', sceneId: capela, x: 400, y: 300 },
        { valor: 'Brasa', sceneId: conf, x: 600, y: 500 },
      ],
    },
  }
  useMapStore.getState().addToken(tobias)
  return { capela, conf, apito }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('apito (Caminhos F4): ninguém pula, as fichas vão andando', () => {
  it('posto em outra cena: o apito não tira a ficha da cena aberta; conta 1 ficha a caminho', () => {
    const m = montar()
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Meio')
    expect(resumo).toEqual({ elementos: 0, cenas: 2, fichas: 1 })
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100, y: 100 }))
    expect(fichaDe(fundo(m.capela), 'tobias')).toBeUndefined()
  })

  it('posto na mesma cena: o apito deixa a ficha no lugar (a rotina andando a leva depois)', () => {
    const m = montar()
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Brasa')
    expect(resumo).toEqual({ elementos: 0, cenas: 1, fichas: 1 })
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100, y: 100 }))
  })

  it('quem assina o apito recebe quem vai ao posto, depois de o estado mudar', () => {
    const m = montar()
    const recebidos: { valor: string; ids: string[]; atual: string | undefined }[] = []
    const parar = subscribeToApito(({ valor, movimentos }) => {
      const atual = useAdventureStore.getState().adventure?.estados?.find((e) => e.id === m.apito)?.atual
      recebidos.push({ valor, ids: movimentos.map((mv) => mv.tokenId), atual })
    })
    useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Brasa')
    // Ficha na mão de jogador: ninguém vai, ninguém é avisado.
    useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Meio', new Set(['tobias']))
    parar()
    expect(recebidos).toEqual([{ valor: 'Brasa', ids: ['tobias'], atual: 'Brasa' }])
  })

  it('ficha que um jogador segura fica onde está', () => {
    const m = montar()
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Meio', new Set(['tobias']))
    expect(resumo).toEqual({ elementos: 0, cenas: 0 })
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 100, y: 100 }))
  })
})

describe('"Pular para o posto": o teleporte do apito antigo, só por botão', () => {
  it('posto em outra cena: a ficha sai da cena aberta e chega na Capela, uma vez só', () => {
    const m = montar()
    useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Meio')
    useMapStore.getState().setSelection([{ kind: 'token', id: 'tobias' }])
    const pularam = useAdventureStore.getState().pularParaOPosto(m.apito)
    expect(pularam.map((mv) => mv.tokenId)).toEqual(['tobias'])
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toBeUndefined()
    // A seleção não fica apontando para a ficha que saiu da cena.
    expect(useMapStore.getState().selection).toEqual([])
    expect(fichaDe(fundo(m.capela), 'tobias')).toEqual(expect.objectContaining({ x: 400, y: 300 }))
    // A rotina anda com a ficha: o próximo apito a acha lá.
    expect(fichaDe(fundo(m.capela), 'tobias')?.rotina?.estadoId).toBe(m.apito)
    expect(useAdventureStore.getState().dirty[m.capela]).toBe(true)
  })

  it('posto na mesma cena: a ficha cai no posto e o Ctrl+Z do mestre não a devolve', () => {
    const m = montar()
    useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Brasa')
    useMapStore.getState().addToken({ id: 'banco', characterId: null, name: 'Banco', x: 0, y: 0, size: 1, image: null })
    expect(useAdventureStore.getState().pularParaOPosto(m.apito)).toHaveLength(1)
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 600, y: 500 }))
    useMapStore.getState().undo()
    // O desfazer tirou o banco (edição do mestre), mas o Tobias segue no posto.
    expect(fichaDe(useMapStore.getState().map, 'banco')).toBeUndefined()
    expect(fichaDe(useMapStore.getState().map, 'tobias')).toEqual(expect.objectContaining({ x: 600, y: 500 }))
  })

  it('vale o valor ATUAL do estado; ficha segura e ficha já no posto não pulam', () => {
    const m = montar()
    // Aurora (o valor de partida) não tem posto: ninguém pula.
    expect(useAdventureStore.getState().pularParaOPosto(m.apito)).toEqual([])
    useAdventureStore.getState().trocarEstadoDoMundo(m.apito, 'Brasa')
    expect(useAdventureStore.getState().pularParaOPosto(m.apito, new Set(['tobias']))).toEqual([])
    expect(useAdventureStore.getState().pularParaOPosto(m.apito)).toHaveLength(1)
    expect(useAdventureStore.getState().pularParaOPosto(m.apito)).toEqual([])
    expect(useAdventureStore.getState().pularParaOPosto('estado-que-nao-existe')).toEqual([])
  })
})

describe('rotina no painel', () => {
  it('gravar a rotina pelo painel entra no Ctrl+Z', () => {
    montar()
    useMapStore.getState().setTokenRotina('tobias', undefined)
    expect(fichaDe(useMapStore.getState().map, 'tobias')?.rotina).toBeUndefined()
    useMapStore.getState().undo()
    expect(fichaDe(useMapStore.getState().map, 'tobias')?.rotina?.postos).toHaveLength(2)
  })
})
