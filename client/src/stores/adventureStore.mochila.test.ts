/**
 * MOCHILA NA FICHA em jogo (`stores/adventureStore.ts`: `applyItemsInScene` e
 * o espelho; fatia A3 de docs/planos/lobby-jogadores-2026-11-05.md §8.1, teste
 * liberado na 12.18 d). Depois da migração a ficha é a dona da mochila e da
 * bolsa: dar, pegar, pagar e trocar mudam a ficha, e o boneco dela mostra o
 * mesmo em toda cena — na pasta, na aventura sem pasta e no mapa em
 * "Configurar só neste mapa". Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarriedItem, MapData, Token } from '../types/map'
import type { ItemChange, ItemParaDar } from '../lib/items'
import type { Personagem } from '../lib/personagem'

const textos = new Map<string, string>()

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (caminho: string) => caminho.slice(0, caminho.lastIndexOf('/'))),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (caminho: string) => textos.has(caminho)),
  readTextFile: vi.fn(async (caminho: string) => {
    const texto = textos.get(caminho)
    if (texto === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return texto
  }),
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  copyFile: vi.fn(async () => undefined),
}))

const { useAdventureStore, applyItemsInScene, personagensAtivos } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { serializeMap } = await import('../lib/mapFile')
const { darDoAcervoChange } = await import('../lib/items')
const { payCoinsChange } = await import('../lib/troca')
const { novoPersonagem } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
type PastaAberta = import('../lib/pastasDeMapas').PastaAberta
type OpenedMapFile = import('../lib/mapFileIO').OpenedMapFile
type SceneLoad = import('../lib/mapFileIO').SceneLoad
type Adventure = import('../lib/adventure').Adventure

const DIR = 'C:/appdata/maps/adv_op'
const SKY = 's_sky'
const GOA = 's_goa'
/** A Poção do acervo: empilha, então dar de novo soma na mesma vaga. */
const POCAO: ItemParaDar = { itemId: 'acervo_pocao', nome: 'Poção', empilhavel: true }
const VAGA_DA_POCAO: CarriedItem = { id: 'vaga_pocao', itemId: 'acervo_pocao', nome: 'Poção', empilhavel: true }
const CORDA: CarriedItem = { id: 'vaga_corda', nome: 'Corda' }

function ficha(id: string, nome: string, extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id, ...extra }
}

function boneco(id: string, characterId: string | null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name: id, x: 96, y: 96, size: 1, image: null, ...extra }
}

function cena(id: string, nome: string, bonecos: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 20, 16, 64), tokens: bonecos }
}

/** Onde moram as fichas do mapa aberto. */
type Onde = 'pasta' | 'aventura sem pasta' | 'Configurar só neste mapa'

interface Abertura {
  personagens?: Personagem[]
  /** `false` = antes da migração (sem o marcador `mochilaMigrada`). */
  migrada?: boolean
  /** O Reino de Goa como está no disco. */
  goa?: MapData
  /** Como o Reino de Goa chega: junto com a abertura (padrão), depois, do disco, ou nunca. */
  goaChega?: 'junto' | 'do disco' | 'indisponivel'
}

/** Abre a aventura One Piece (Sky Lagoon aberta, Reino de Goa ao fundo) com as fichas em `onde`. */
async function abrir(onde: Onde, opcoes: Abertura = {}): Promise<void> {
  const fichas = opcoes.personagens ?? [ficha('p_luffy', 'Luffy'), ficha('p_zoro', 'Zoro')]
  const marcador = opcoes.migrada === false ? {} : { mochilaMigrada: 1 }
  const entradas = [
    { id: SKY, name: 'Sky Lagoon', file: 'map.json' },
    { id: GOA, name: 'Reino de Goa', file: 'scenes/s_goa/map.json' },
  ]
  const adventure: Adventure = {
    version: 1,
    id: 'adv_op',
    name: 'One Piece',
    startSceneId: SKY,
    scenes: entradas,
    sistemaDeRpg: SISTEMA_ONE_PIECE.id,
    ...(onde === 'pasta' ? {} : { personagens: fichas, ...marcador }),
  }
  const daPasta = { chave: 'adv_op', pastaId: 'pasta_op', nome: 'One Piece', sistemaDeRpg: SISTEMA_ONE_PIECE.id }
  const pasta: PastaAberta | null =
    onde === 'aventura sem pasta'
      ? null
      : onde === 'pasta'
        ? { ...daPasta, proprio: false, personagens: fichas, ...marcador }
        : // As fichas da pasta, que este mapa NÃO usa: um Luffy com o mesmo id, para saber de quem é a Poção.
          { ...daPasta, proprio: true, personagens: [ficha('p_luffy', 'Luffy da pasta')], mochilaMigrada: 1 }
  const sky = cena('map_sky', 'Sky Lagoon', [
    boneco('t_luffy_sky', 'p_luffy'),
    boneco('t_zoro_sky', 'p_zoro', { x: 160 }),
    boneco('t_vendedor', null, { x: 224, mochila: [CORDA] }),
  ])
  const goa = opcoes.goa ?? cena('map_goa', 'Reino de Goa', [boneco('t_luffy_goa', 'p_luffy'), boneco('t_guarda', null, { x: 224, mochila: [CORDA] })])
  const chega = opcoes.goaChega ?? 'junto'
  if (chega === 'do disco') textos.set(`${DIR}/scenes/s_goa/map.json`, serializeMap(goa))
  const loadDeGoa: SceneLoad =
    chega === 'junto' ? { entry: entradas[1], status: 'ok', map: goa } : chega === 'do disco' ? { entry: entradas[1], status: 'pendente' } : { entry: entradas[1], status: 'indisponivel', reason: 'sem disco' }
  const aberto: OpenedMapFile = {
    path: `${DIR}/map.json`,
    map: sky,
    adventure,
    adventureDir: DIR,
    activeSceneId: SKY,
    scenes: [{ entry: entradas[0], status: 'ok', map: sky }, loadDeGoa],
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  }
  await useAdventureStore.getState().open(aberto, pasta)
}

function fichaAtiva(id: string): Personagem | undefined {
  return personagensAtivos(useAdventureStore.getState()).find((personagem) => personagem.id === id)
}

/** O mapa de agora da cena: a aberta (ausente) ou uma de fundo já lida. */
function mapaDa(sceneId?: string): MapData {
  if (sceneId === undefined) return useMapStore.getState().map
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot === undefined || slot.status !== 'ok') throw new Error(`a cena ${sceneId} não está aberta`)
  return slot.map
}

function bonecoDa(tokenId: string, sceneId?: string): Token {
  const token = mapaDa(sceneId).tokens.find((candidato) => candidato.id === tokenId)
  if (token === undefined) throw new Error(`sem o boneco ${tokenId}`)
  return token
}

/** "Poção x1", "Corda x1": o que o mestre vê na mochila. */
function itens(mochila: readonly CarriedItem[] | undefined): string[] {
  return (mochila ?? []).map((item) => `${item.nome} x${item.quantidade ?? 1}`)
}

/** O "Dar a…" do acervo: uma Poção ao boneco `tokenId`, calculada do boneco como o app faz, na cena `sceneId` (ausente = a aberta). */
function darPocao(tokenId: string, sceneId?: string): boolean {
  const change = darDoAcervoChange(bonecoDa(tokenId, sceneId), POCAO, 1, `vaga_${crypto.randomUUID()}`)
  if (change === null) throw new Error('a Poção tem nome: dar tinha de valer')
  return applyItemsInScene(sceneId === undefined ? change : { ...change, sceneId })
}

/** Move o boneco: um passo no Ctrl+Z da cena aberta. */
function moverNoEditor(tokenId: string, x: number): void {
  const passos = useMapStore.getState().past.length
  useMapStore.getState().moveToken(tokenId, x, 96)
  expect(useMapStore.getState().past.length).toBe(passos + 1)
}

beforeEach(() => {
  textos.clear()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vazio', 'Vazio', 20, 16, 64))
  useSessionStore.getState().markSaved()
})

describe.each<Onde>(['pasta', 'aventura sem pasta', 'Configurar só neste mapa'])('a Poção acompanha o Luffy de cena (%s)', (onde) => {
  it('dar na Sky Lagoon, trocar para o Reino de Goa: a Poção está na ficha e no boneco de lá', async () => {
    await abrir(onde)
    expect(darPocao('t_luffy_sky')).toBe(true)
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x1'])
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])

    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(itens(bonecoDa('t_luffy_goa').mochila)).toEqual(['Poção x1'])
    // E dar de novo no Reino de Goa soma na mesma vaga da ficha.
    expect(darPocao('t_luffy_goa')).toBe(true)
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x2'])
    expect(itens(bonecoDa('t_luffy_sky', SKY).mochila)).toEqual(['Poção x2'])
  })
})

describe('de quem é a ficha que muda', () => {
  it('"Configurar só neste mapa": muda a ficha do mapa; a ficha da pasta, que este mapa não usa, fica como estava', async () => {
    await abrir('Configurar só neste mapa')
    darPocao('t_luffy_sky')
    const state = useAdventureStore.getState()
    expect(itens(state.adventure?.personagens?.find((p) => p.id === 'p_luffy')?.mochila)).toEqual(['Poção x1'])
    expect(state.pasta?.personagens.map((p) => [p.nome, p.mochila])).toEqual([['Luffy da pasta', undefined]])
    expect(state.structureDirty).toBe(true)
    expect(state.pastaSuja).toBe(false)
  })

  it('pasta: muda a cópia da pasta e acende o Salvar dela; a aventura não ganha fichas', async () => {
    await abrir('pasta')
    darPocao('t_luffy_sky')
    const state = useAdventureStore.getState()
    expect(itens(state.pasta?.personagens.find((p) => p.id === 'p_luffy')?.mochila)).toEqual(['Poção x1'])
    expect(state.adventure?.personagens).toBeUndefined()
    expect(state.pastaSuja).toBe(true)
  })

  it('antes da migração (sem o marcador) a mochila continua só no boneco, como antes', async () => {
    await abrir('aventura sem pasta', { migrada: false })
    const antes = personagensAtivos(useAdventureStore.getState())
    darPocao('t_luffy_sky')
    expect(personagensAtivos(useAdventureStore.getState())).toBe(antes)
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
    expect(itens(bonecoDa('t_luffy_goa', GOA).mochila)).toEqual([])
  })
})

describe('a ficha vence o boneco ao carregar a cena', () => {
  const comPocao = (quantidade: number): CarriedItem => ({ ...VAGA_DA_POCAO, ...(quantidade > 1 ? { quantidade } : {}) })
  /** O Reino de Goa gravado quando o Luffy ainda tinha 3 Poções e 50 moedas; a ficha já gastou duas e tem 20. */
  const goaVelho = (): MapData => cena('map_goa', 'Reino de Goa', [boneco('t_luffy_goa', 'p_luffy', { mochila: [comPocao(3)], moedas: 50 }), boneco('t_guarda', null, { mochila: [CORDA] })])
  const fichasDeAgora = (): Personagem[] => [ficha('p_luffy', 'Luffy', { mochila: [comPocao(1)], moedas: 20 }), ficha('p_zoro', 'Zoro')]

  it('cena lida na abertura: o boneco mostra a Poção x1 da ficha, não a x3 velha, sem acender o Salvar', async () => {
    await abrir('pasta', { personagens: fichasDeAgora(), goa: goaVelho() })
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(itens(bonecoDa('t_luffy_goa').mochila)).toEqual(['Poção x1'])
    expect(bonecoDa('t_luffy_goa').moedas).toBe(20)
    expect(itens(bonecoDa('t_guarda').mochila)).toEqual(['Corda x1'])
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x1'])
    expect(useAdventureStore.getState().hasPendingScenes()).toBe(false)
  })

  it('cena que chega do disco depois da abertura: também vence a ficha, e a cena não fica suja', async () => {
    await abrir('aventura sem pasta', { personagens: fichasDeAgora(), goa: goaVelho(), goaChega: 'do disco' })
    expect(itens(bonecoDa('t_luffy_goa', GOA).mochila)).toEqual(['Poção x1'])
    expect(bonecoDa('t_luffy_goa', GOA).moedas).toBe(20)
    expect(useAdventureStore.getState().dirty[GOA]).toBeUndefined()
  })

  it('a cena aberta e o desfazer dela também: o boneco do Luffy na Sky Lagoon já abre com a mochila da ficha', async () => {
    await abrir('pasta', { personagens: fichasDeAgora() })
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
    expect(bonecoDa('t_zoro_sky').mochila).toBeUndefined()
    expect(itens(bonecoDa('t_vendedor').mochila)).toEqual(['Corda x1'])
  })
})

describe('NPC sem ficha', () => {
  it('dar ao vendedor sem ficha não mexe em ficha nenhuma, e o guarda do Reino de Goa fica como estava', async () => {
    await abrir('pasta')
    const antes = personagensAtivos(useAdventureStore.getState())
    const goaAntes = mapaDa(GOA)
    expect(darPocao('t_vendedor')).toBe(true)
    expect(personagensAtivos(useAdventureStore.getState())).toBe(antes)
    expect(useAdventureStore.getState().pastaSuja).toBe(false)
    expect(itens(bonecoDa('t_vendedor').mochila)).toEqual(['Corda x1', 'Poção x1'])
    expect(mapaDa(GOA)).toBe(goaAntes)
  })
})

describe('troca e pagamento entre dois personagens', () => {
  const ricos = (): Personagem[] => [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 100 }), ficha('p_zoro', 'Zoro', { moedas: 5 })]

  /** O Luffy paga 30 ao Zoro e passa a Poção para ele, numa mudança só. */
  function pagarEPassar(): ItemChange {
    const pagamento = payCoinsChange(bonecoDa('t_luffy_sky'), bonecoDa('t_zoro_sky'), 30)
    if (pagamento === null) throw new Error('o Luffy tem 100 moedas: pagar 30 tinha de valer')
    return {
      mochilas: [
        { tokenId: 't_luffy_sky', mochila: [] },
        { tokenId: 't_zoro_sky', mochila: [VAGA_DA_POCAO] },
      ],
      bolsas: pagamento.bolsas,
    }
  }

  it('as duas fichas mudam juntas, numa gravação só: ninguém vê uma sem a outra', async () => {
    await abrir('pasta', { personagens: ricos() })
    expect(bonecoDa('t_luffy_sky').moedas).toBe(100)
    const vistos: [number | undefined, number | undefined][] = []
    const parar = useAdventureStore.subscribe((state) => {
      const fichas = personagensAtivos(state)
      vistos.push([fichas.find((p) => p.id === 'p_luffy')?.moedas, fichas.find((p) => p.id === 'p_zoro')?.moedas])
    })
    try {
      expect(applyItemsInScene(pagarEPassar())).toBe(true)
    } finally {
      parar()
    }
    expect(vistos[0]).toEqual([70, 35])
    expect(vistos.filter(([luffy, zoro]) => (luffy === 70) !== (zoro === 35))).toEqual([])
    expect([fichaAtiva('p_luffy')?.mochila, fichaAtiva('p_zoro')?.mochila]).toEqual([undefined, [VAGA_DA_POCAO]])
    // O Luffy do Reino de Goa mostra a bolsa e a mochila novas.
    expect([bonecoDa('t_luffy_goa', GOA).moedas, bonecoDa('t_luffy_goa', GOA).mochila]).toEqual([70, undefined])
  })

  it('cena que não está disponível: nada muda, nem as fichas', async () => {
    await abrir('pasta', { personagens: ricos(), goaChega: 'indisponivel' })
    const antes = personagensAtivos(useAdventureStore.getState())
    const troca: ItemChange = { mochilas: [{ tokenId: 't_luffy_goa', mochila: [] }], bolsas: [{ tokenId: 't_luffy_goa', moedas: 0 }] }
    expect(applyItemsInScene({ ...troca, sceneId: GOA })).toBe(false)
    expect(personagensAtivos(useAdventureStore.getState())).toBe(antes)
    expect(useAdventureStore.getState().pastaSuja).toBe(false)
  })
})

describe('Ctrl+Z do mapa não duplica nem perde item', () => {
  it('na mesma cena: desfazer depois de dar não tira a Poção, e dar de novo soma uma (x2, não x1 nem x3)', async () => {
    await abrir('pasta')
    moverNoEditor('t_luffy_sky', 352)
    darPocao('t_luffy_sky')
    useMapStore.getState().undo()
    expect(bonecoDa('t_luffy_sky').x).toBe(96)
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
    darPocao('t_luffy_sky')
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x2'])
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x2'])
  })

  it('noutra cena: o desfazer do Reino de Goa, feito antes da Poção, já a mostra', async () => {
    await abrir('aventura sem pasta')
    useAdventureStore.getState().switchScene(GOA)
    moverNoEditor('t_luffy_goa', 352)
    useAdventureStore.getState().switchScene(SKY)
    darPocao('t_luffy_sky')
    useAdventureStore.getState().switchScene(GOA)
    useMapStore.getState().undo()
    expect(bonecoDa('t_luffy_goa').x).toBe(96)
    expect(itens(bonecoDa('t_luffy_goa').mochila)).toEqual(['Poção x1'])
    darPocao('t_luffy_goa')
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x2'])
  })

  it('Poção pega numa cena de fundo (jogador na sala): o boneco da cena aberta e o desfazer dela mostram, e as duas cenas ficam para gravar', async () => {
    await abrir('Configurar só neste mapa')
    moverNoEditor('t_luffy_sky', 352)
    expect(darPocao('t_luffy_goa', GOA)).toBe(true)
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x1'])
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
    useMapStore.getState().undo()
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
    useMapStore.getState().redo()
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
    expect(useAdventureStore.getState().dirty[GOA]).toBe(true)
  })
})
