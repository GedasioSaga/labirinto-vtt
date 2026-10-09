/**
 * PASTAS DE MAPAS no editor (`stores/adventureStore.ts` + `stores/rpgDaPasta.ts`):
 * o mapa que herda usa a cópia ÚNICA da pasta — mexer num mapa aparece no
 * outro —, "Configurar só neste mapa" volta para o que é do mapa sem apagar
 * nada, e o mapa solto que herda tem ficha sem virar aventura.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'
import type { Personagem } from '../lib/personagem'

const APPDATA = 'C:/appdata'
const textos = new Map<string, string>()

function pai(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf('/'))
}

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (caminho: string) => pai(caminho)),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (caminho: string) => textos.has(caminho)),
  mkdir: vi.fn(async () => undefined),
  readTextFile: vi.fn(async (caminho: string) => {
    const texto = textos.get(caminho)
    if (texto === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return texto
  }),
  writeTextFile: vi.fn(async (caminho: string, texto: string) => {
    textos.set(caminho, texto)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const texto = textos.get(de)
    if (texto === undefined) throw new Error(`arquivo não existe: ${de}`)
    textos.set(para, texto)
    textos.delete(de)
  }),
  remove: vi.fn(async (caminho: string) => {
    textos.delete(caminho)
  }),
  readDir: vi.fn(async (caminho: string) => {
    throw new Error(`não deu para listar ${caminho}`)
  }),
  readFile: vi.fn(async () => new Uint8Array()),
  writeFile: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
  stat: vi.fn(async (caminho: string) => {
    throw new Error(`não existe: ${caminho}`)
  }),
}))

const { useAdventureStore, personagensAtivos, sistemaAtivo, herdaDaPasta, temRpgNoMapa, hasUnsavedWork, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { acompanharIndice, editarRpgDaPasta, trocarModoDoMapa } = await import('./rpgDaPasta')
const { garantirAventura } = await import('./virarAventura')
const { createEmptyMap } = await import('../lib/mapFactory')
const { novoPersonagem } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
const { apagarPasta, criarPasta, gravarRpgDaPasta, lerRpgDaPasta, moverMapa, mudarIndiceDasPastas, pastaAbertaDoArquivo } = await import('../lib/pastasDeMapas')
type PastaAberta = import('../lib/pastasDeMapas').PastaAberta
type OpenedMapFile = import('../lib/mapFileIO').OpenedMapFile
type Adventure = import('../lib/adventure').Adventure

const MAPS = `${APPDATA}/maps`
const GOA = `${MAPS}/adv_goa/map.json`
const SKY = `${MAPS}/map_sky/map.json`
/** O id do sistema próprio da aventura de Goa: outro que o da pasta, para saber de quem é a ficha. */
const SISTEMA_DE_GOA = 'sistema-de-goa'

function personagem(id: string, nome: string): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id }
}

const LUFFY = personagem('p_luffy', 'Luffy')
const ZORO = personagem('p_zoro', 'Zoro')

function mapa(id: string, nome: string): MapData {
  return createEmptyMap(id, nome, 20, 16, 64)
}

/** A aventura do Reino de Goa, com o sistema e o personagem PRÓPRIOS dela. */
function aberturaDeGoa(): OpenedMapFile {
  const map = mapa('map_goa', 'Reino de Goa')
  const adventure: Adventure = {
    version: 1,
    id: 'adv_goa',
    name: 'Reino de Goa',
    startSceneId: 's_goa',
    scenes: [{ id: 's_goa', name: 'Reino de Goa', file: 'map.json' }],
    sistemaDeRpg: SISTEMA_DE_GOA,
    personagens: [ZORO],
  }
  return {
    path: GOA,
    map,
    adventure,
    adventureDir: `${MAPS}/adv_goa`,
    activeSceneId: 's_goa',
    scenes: [{ entry: adventure.scenes[0], status: 'ok', map }],
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  }
}

/** A Sky Lagoon: mapa SOLTO, sem aventura. */
function aberturaDeSky(): OpenedMapFile {
  return { path: SKY, map: mapa('map_sky', 'Sky Lagoon'), adventure: null, adventureDir: null, activeSceneId: null, scenes: [], changedSceneIds: [], adventureChanged: false, legacySources: [] }
}

function pastaEmMemoria(extra: Partial<PastaAberta> = {}): PastaAberta {
  return { chave: 'adv_goa', pastaId: 'pasta_goa', nome: 'Campanha', proprio: false, sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [LUFFY], ...extra }
}

/** Grava no disco a pasta "Campanha" com Goa e Sky dentro, o sistema universal e o Luffy. Devolve o id. */
async function pastaNoDisco(): Promise<string> {
  const indice = await mudarIndiceDasPastas((atual) => {
    const { indice: comPasta, pasta } = criarPasta(atual, 'Campanha')
    return moverMapa(moverMapa(comPasta, 'adv_goa', pasta.id), 'map_sky', pasta.id)
  })
  const pastaId = indice.pastas[0].id
  await gravarRpgDaPasta(pastaId, { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [LUFFY] })
  return pastaId
}

function comVida(atual: Personagem, vida: number): Personagem {
  return { ...atual, recursos: { ...atual.recursos, vida } }
}

function nomesAtivos(): string[] {
  return personagensAtivos(useAdventureStore.getState()).map((p) => p.nome)
}

beforeEach(() => {
  textos.clear()
  useAdventureStore.getState().reset()
})

describe('o mapa que herda usa a pasta', () => {
  it('o sistema, os personagens e o que o host serve vêm da pasta; os do mapa ficam guardados', async () => {
    await useAdventureStore.getState().open(aberturaDeGoa(), pastaEmMemoria())
    const state = useAdventureStore.getState()
    expect(herdaDaPasta(state)).toBe(true)
    expect(sistemaAtivo(state)).toBe(SISTEMA_ONE_PIECE.id)
    expect(nomesAtivos()).toEqual(['Luffy'])
    expect(state.adventure?.personagens?.map((p) => p.nome)).toEqual(['Zoro'])
    const mundo = hostWorldOf(state, useMapStore.getState().map, [SISTEMA_ONE_PIECE])
    expect(mundo.rpg?.sistema?.id).toBe(SISTEMA_ONE_PIECE.id)
    expect(mundo.rpg?.personagens.map((p) => p.nome)).toEqual(['Luffy'])
  })

  it('mexer na ficha mexe na cópia da pasta: o arquivo da aventura não muda e o Salvar acende', async () => {
    await useAdventureStore.getState().open(aberturaDeGoa(), pastaEmMemoria())
    expect(hasUnsavedWork()).toBe(false)
    expect(useAdventureStore.getState().ajustarPersonagem('p_luffy', (atual) => comVida(atual, 7))).toBe(true)
    expect(useAdventureStore.getState().salvarPersonagem(personagem('p_nami', 'Nami'))).toBe(true)
    const state = useAdventureStore.getState()
    // `vida` é o recurso que o teste inventou: a Nami, que ninguém mexeu, não o tem.
    expect(state.pasta?.personagens.map((p) => [p.nome, p.recursos.vida ?? null])).toEqual([
      ['Luffy', 7],
      ['Nami', null],
    ])
    expect(state.adventure?.personagens).toEqual([ZORO])
    expect(state.structureDirty).toBe(false)
    expect(state.pastaSuja).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
  })

  it('pasta sem sistema universal só organiza: o mapa usa o próprio', async () => {
    await useAdventureStore.getState().open(aberturaDeGoa(), pastaEmMemoria({ sistemaDeRpg: undefined }))
    expect(herdaDaPasta(useAdventureStore.getState())).toBe(false)
    expect(sistemaAtivo(useAdventureStore.getState())).toBe(SISTEMA_DE_GOA)
    expect(nomesAtivos()).toEqual(['Zoro'])
  })
})

describe('"Configurar só neste mapa" e "Usar o da pasta"', () => {
  it('troca o que o editor usa sem apagar nenhuma lista, e o modo fica gravado no índice', async () => {
    await pastaNoDisco()
    await useAdventureStore.getState().open(aberturaDeGoa(), await pastaAbertaDoArquivo(GOA))
    useAdventureStore.getState().ajustarPersonagem('p_luffy', (atual) => comVida(atual, 3))

    await trocarModoDoMapa(true)
    expect(herdaDaPasta(useAdventureStore.getState())).toBe(false)
    expect(sistemaAtivo(useAdventureStore.getState())).toBe(SISTEMA_DE_GOA)
    expect(nomesAtivos()).toEqual(['Zoro'])
    // Agora a ficha é a do mapa: o personagem novo entra na aventura, não na pasta.
    useAdventureStore.getState().salvarPersonagem(personagem('p_usopp', 'Usopp'))
    expect(useAdventureStore.getState().adventure?.personagens?.map((p) => p.nome)).toEqual(['Zoro', 'Usopp'])
    expect(useAdventureStore.getState().pasta?.personagens.map((p) => [p.nome, p.recursos.vida])).toEqual([['Luffy', 3]])
    expect((await pastaAbertaDoArquivo(GOA))?.proprio).toBe(true)

    await trocarModoDoMapa(false)
    expect(nomesAtivos()).toEqual(['Luffy'])
    // Os do mapa continuam guardados na aventura, para quando ele voltar a ser "só neste mapa".
    expect(useAdventureStore.getState().adventure?.personagens?.map((p) => p.nome)).toEqual(['Zoro', 'Usopp'])
    expect((await pastaAbertaDoArquivo(GOA))?.proprio).toBe(false)
  })
})

describe('uma cópia só para os mapas da pasta', () => {
  it('o HP perdido no Reino de Goa continua perdido na Sky Lagoon', async () => {
    await pastaNoDisco()
    await useAdventureStore.getState().open(aberturaDeGoa(), await pastaAbertaDoArquivo(GOA))
    useAdventureStore.getState().ajustarPersonagem('p_luffy', (atual) => comVida(atual, 4))
    await useAdventureStore.getState().gravarPasta()
    expect(useAdventureStore.getState().pastaSuja).toBe(false)

    await useAdventureStore.getState().open(aberturaDeSky(), await pastaAbertaDoArquivo(SKY))
    expect(personagensAtivos(useAdventureStore.getState()).map((p) => [p.nome, p.recursos.vida])).toEqual([['Luffy', 4]])
  })

  it('o mapa solto que herda tem ficha sem virar aventura: nada pergunta, e a pasta guarda por ele', async () => {
    await pastaNoDisco()
    await useAdventureStore.getState().open(aberturaDeSky(), await pastaAbertaDoArquivo(SKY))
    expect(useAdventureStore.getState().adventure).toBeNull()
    expect(temRpgNoMapa(useAdventureStore.getState())).toBe(true)
    const perguntar = vi.fn(async () => true)
    expect(await garantirAventura({ perguntar, caminhoDoMapaSolto: () => SKY })).toBe(true)
    expect(perguntar).not.toHaveBeenCalled()
    expect(useAdventureStore.getState().salvarPersonagem(personagem('p_nami', 'Nami'))).toBe(true)
    expect(useAdventureStore.getState().adventure).toBeNull()
    expect(hasUnsavedWork()).toBe(true)
    await useAdventureStore.getState().gravarPasta()
    const lido = await lerRpgDaPasta(useAdventureStore.getState().pasta?.pastaId ?? '')
    expect(lido.ok && lido.rpg.personagens.map((p) => p.nome)).toEqual(['Luffy', 'Nami'])
  })

  it('a configuração da pasta grava no disco e chega à cópia aberta sem levar o HP ainda não salvo', async () => {
    const pastaId = await pastaNoDisco()
    await useAdventureStore.getState().open(aberturaDeGoa(), await pastaAbertaDoArquivo(GOA))
    useAdventureStore.getState().ajustarPersonagem('p_luffy', (atual) => comVida(atual, 2))
    await editarRpgDaPasta(pastaId, (rpg) => ({ ...rpg, personagens: [...rpg.personagens, ZORO] }))

    const disco = await lerRpgDaPasta(pastaId)
    expect(disco.ok && disco.rpg.personagens.map((p) => [p.nome, p.recursos.vida ?? 0])).toEqual([
      ['Luffy', 0],
      ['Zoro', 0],
    ])
    const aberta = useAdventureStore.getState()
    expect(aberta.pasta?.personagens.map((p) => [p.nome, p.recursos.vida ?? 0])).toEqual([
      ['Luffy', 2],
      ['Zoro', 0],
    ])
    expect(aberta.pastaSuja).toBe(true)
  })

  it('apagar a pasta do mapa aberto grava a ficha pendente antes de soltar, e o mapa volta ao próprio', async () => {
    const pastaId = await pastaNoDisco()
    await useAdventureStore.getState().open(aberturaDeGoa(), await pastaAbertaDoArquivo(GOA))
    useAdventureStore.getState().ajustarPersonagem('p_luffy', (atual) => comVida(atual, 1))
    await acompanharIndice(await mudarIndiceDasPastas((atual) => apagarPasta(atual, pastaId)))

    expect(useAdventureStore.getState().pasta).toBeNull()
    expect(nomesAtivos()).toEqual(['Zoro'])
    const disco = await lerRpgDaPasta(pastaId)
    expect(disco.ok && disco.rpg.personagens.map((p) => [p.nome, p.recursos.vida])).toEqual([['Luffy', 1]])
  })
})
