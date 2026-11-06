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

const { useAdventureStore, applyItemsInScene, personagensAtivos, bonecoVaiSerGuardado, bonecoQueVoltaDaGuarda, ouvirBonecosSeparados, fichasDonasDoProprioMapa } = await import('./adventureStore')
const { avisarJogadoresDosBonecosSeparados } = await import('../net/mochilaNaSala')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap, removeToken } = await import('../lib/mapFactory')
const { hostPlayerChanges } = await import('../net/playerChanges')
const { serializeMap } = await import('../lib/mapFile')
const { darDoAcervoChange, removeItemChange } = await import('../lib/items')
const { payCoinsChange } = await import('../lib/troca')
const { novoPersonagem } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
const { restoreRecoveryCopy, startRecoveryAutosave } = await import('./recoveryAutosave')
const { useToastStore } = await import('./toastStore')
const { parseRecoveryCopy, serializeRecoveryCopy } = await import('../lib/recoveryCopy')
type RecoveryCopy = import('../lib/recoveryCopy').RecoveryCopy
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
  /** "Configurar só neste mapa": as fichas da pasta, que este mapa não usa (padrão: um Luffy com o mesmo id). */
  fichasDaPasta?: Personagem[]
  /** `false` = antes da migração (sem o marcador `mochilaMigrada`). */
  migrada?: boolean
  /** A Sky Lagoon como está no disco. */
  sky?: MapData
  /** O Reino de Goa como está no disco. */
  goa?: MapData
  /** Como o Reino de Goa chega: junto com a abertura (padrão), depois, do disco, ou nunca. */
  goaChega?: 'junto' | 'do disco' | 'indisponivel'
}

/** Abre a aventura One Piece (Sky Lagoon aberta, Reino de Goa ao fundo) com as fichas em `onde`. */
async function abrir(onde: Onde, opcoes: Abertura = {}): Promise<void> {
  const { aberto, pasta } = doDisco(onde, opcoes)
  await useAdventureStore.getState().open(aberto, pasta)
}

/** O que o disco devolve ao abrir a aventura One Piece: o arquivo lido e a pasta dele. Objetos novos a cada chamada. */
function doDisco(onde: Onde, opcoes: Abertura = {}): { aberto: OpenedMapFile; pasta: PastaAberta | null } {
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
          { ...daPasta, proprio: true, personagens: opcoes.fichasDaPasta ?? [ficha('p_luffy', 'Luffy da pasta')], mochilaMigrada: 1 }
  const sky =
    opcoes.sky ??
    cena('map_sky', 'Sky Lagoon', [boneco('t_luffy_sky', 'p_luffy'), boneco('t_zoro_sky', 'p_zoro', { x: 160 }), boneco('t_vendedor', null, { x: 224, mochila: [CORDA] })])
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
  return { aberto, pasta }
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
  // O aviso repetido troca no lugar (`toastStore`): sem limpar, o "último aviso" seria o do teste anterior.
  useToastStore.setState({ toasts: [] })
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

/** A cópia de recuperação que o salvamento automático grava agora (como no app: um intervalo curto, e espera o disco). */
async function copiaDoSalvamentoAutomatico(): Promise<RecoveryCopy> {
  const gravadas: RecoveryCopy[] = []
  // O "Salvar" aceso pelo mapa mexido, como no app (`App.tsx` liga isto na raiz).
  const pararSujeira = subscribeToDirtyFlag()
  const autosave = startRecoveryAutosave({
    storage: { write: async (copia) => void gravadas.push(copia), clear: async () => undefined },
    getLooseMapPath: () => null,
    intervalMs: 1,
  })
  try {
    // Uma mudança qualquer depois de ligar: é ela que agenda a cópia.
    useMapStore.getState().moveToken('t_zoro_sky', 288, 96)
    await new Promise((resolve) => setTimeout(resolve, 20))
    await autosave.idle()
  } finally {
    autosave.stop()
    pararSujeira()
  }
  const copia = gravadas.at(-1)
  if (copia === undefined) throw new Error('havia trabalho não salvo: o salvamento automático tinha de gravar a cópia')
  // Pelo disco, como no app: a cópia é lida do arquivo que ficou.
  const lida = parseRecoveryCopy(serializeRecoveryCopy(copia))
  if (lida === null) throw new Error('a cópia gravada tinha de ser legível')
  return lida
}

/** O app caiu: nada do que estava na memória sobra. */
function queda(): void {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vazio', 'Vazio', 20, 16, 64))
  useSessionStore.getState().markSaved()
}

describe.each<Onde>(['pasta', 'aventura sem pasta', 'Configurar só neste mapa'])('Recuperar depois de uma queda (%s)', (onde) => {
  it('o Luffy pega uma Poção, o app cai, o mestre recupera e troca de cena: a Poção está na ficha e nos dois bonecos', async () => {
    await abrir(onde)
    expect(darPocao('t_luffy_sky')).toBe(true)
    const copia = await copiaDoSalvamentoAutomatico()
    expect(copia.mochilaNaFicha).toBe(true)

    queda()
    // O disco continua do último Salvar: a ficha sem a Poção.
    const disco = doDisco(onde)
    await restoreRecoveryCopy(copia, async () => disco.aberto, async () => disco.pasta)
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x1'])
    expect(useAdventureStore.getState().hasPendingScenes()).toBe(true)

    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(itens(bonecoDa('t_luffy_goa').mochila)).toEqual(['Poção x1'])
    expect(useAdventureStore.getState().switchScene(SKY)).toBe(true)
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
  })
})

describe('Recuperar: só a cópia feita com a mochila na ficha leva os bonecos às fichas', () => {
  it('cópia de antes da migração (sem a marca): a migração da abertura já juntou os bonecos, e a recuperação não mexe nas fichas', async () => {
    await abrir('pasta', { migrada: false })
    darPocao('t_luffy_sky')
    const copia = await copiaDoSalvamentoAutomatico()
    expect(copia.mochilaNaFicha).toBeUndefined()

    queda()
    // A migração da abertura já rodou com a cópia: a ficha tem a Poção e uma Corda de uma cena mais antiga.
    const migradas = [ficha('p_luffy', 'Luffy', { mochila: [{ ...VAGA_DA_POCAO, id: 'vaga_migrada' }, CORDA] }), ficha('p_zoro', 'Zoro')]
    const disco = doDisco('pasta', { personagens: migradas })
    await restoreRecoveryCopy(copia, async () => disco.aberto, async () => disco.pasta)
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x1', 'Corda x1'])
    // E o boneco recuperado já mostra a ficha: a próxima mudança não grava a mochila velha dele por cima.
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1', 'Corda x1'])
    expect(itens(bonecoDa('t_luffy_goa', GOA).mochila)).toEqual(['Poção x1', 'Corda x1'])
  })
})

describe('trocar "Configurar só neste mapa" e "Usar o da pasta" com o mapa aberto', () => {
  const MAPA_DE_GOA: CarriedItem = { id: 'vaga_mapa', nome: 'Mapa de Goa' }
  /** O Luffy de teste (as fichas do próprio mapa) e o Luffy da campanha (as da pasta). */
  const doisLuffys = (): Abertura => ({
    personagens: [ficha('p_luffy', 'Luffy de teste', { mochila: [CORDA] }), ficha('p_zoro', 'Zoro')],
    fichasDaPasta: [ficha('p_luffy', 'Luffy da campanha', { mochila: [MAPA_DE_GOA] })],
  })
  const luffyDeTeste = (): Personagem | undefined => useAdventureStore.getState().adventure?.personagens?.find((p) => p.id === 'p_luffy')
  const luffyDaCampanha = (): Personagem | undefined => useAdventureStore.getState().pasta?.personagens.find((p) => p.id === 'p_luffy')

  it('"Usar o da pasta": os bonecos e o desfazer mostram o Luffy da campanha na hora, e a Poção soma à mochila dele', async () => {
    await abrir('Configurar só neste mapa', doisLuffys())
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Corda x1'])
    moverNoEditor('t_luffy_sky', 352)

    expect(useAdventureStore.getState().definirProprio(false)).toBe(true)
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Mapa de Goa x1'])
    expect(itens(bonecoDa('t_luffy_goa', GOA).mochila)).toEqual(['Mapa de Goa x1'])

    darPocao('t_luffy_sky')
    expect(itens(luffyDaCampanha()?.mochila)).toEqual(['Mapa de Goa x1', 'Poção x1'])
    expect(itens(luffyDeTeste()?.mochila)).toEqual(['Corda x1'])
    useMapStore.getState().undo()
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Mapa de Goa x1', 'Poção x1'])
  })

  it('a volta, "Configurar só neste mapa": os bonecos mostram o Luffy de teste, e a Poção dada depois não chega à campanha', async () => {
    await abrir('Configurar só neste mapa', doisLuffys())
    useAdventureStore.getState().definirProprio(false)
    darPocao('t_luffy_sky')
    expect(itens(luffyDaCampanha()?.mochila)).toEqual(['Mapa de Goa x1', 'Poção x1'])

    expect(useAdventureStore.getState().definirProprio(true)).toBe(true)
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Corda x1'])
    expect(itens(bonecoDa('t_luffy_goa', GOA).mochila)).toEqual(['Corda x1'])
    darPocao('t_luffy_sky')
    expect(itens(luffyDeTeste()?.mochila)).toEqual(['Corda x1', 'Poção x1'])
    expect(itens(luffyDaCampanha()?.mochila)).toEqual(['Mapa de Goa x1', 'Poção x1'])
  })

  it('o RPG da pasta muda com o mapa aberto (a lista nova): os bonecos mostram a ficha nova', async () => {
    await abrir('pasta')
    const comMapa = (p: Personagem): Personagem => (p.id === 'p_luffy' ? { ...p, mochila: [MAPA_DE_GOA] } : p)
    expect(useAdventureStore.getState().mudarRpgDaPasta('pasta_op', (rpg) => ({ ...rpg, personagens: rpg.personagens.map(comMapa) }))).toBe(true)
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Mapa de Goa x1'])
    expect(itens(bonecoDa('t_luffy_goa', GOA).mochila)).toEqual(['Mapa de Goa x1'])
    darPocao('t_luffy_sky')
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Mapa de Goa x1', 'Poção x1'])
  })
})

describe('ficha de vários bonecos que volta a ter um só', () => {
  const ESPADA: ItemParaDar = { itemId: 'acervo_espada', nome: 'Espada' }
  const comBandidos = (bandidos: Token[]): Abertura => ({
    personagens: [ficha('p_luffy', 'Luffy'), ficha('p_zoro', 'Zoro'), ficha('p_bandido', 'Bandido')],
    sky: cena('map_sky', 'Sky Lagoon', [boneco('t_luffy_sky', 'p_luffy'), ...bandidos]),
  })
  function darEspada(tokenId: string): void {
    const change = darDoAcervoChange(bonecoDa(tokenId), ESPADA, 1, `vaga_${crypto.randomUUID()}`)
    if (change === null) throw new Error('a Espada tem nome: dar tinha de valer')
    expect(applyItemsInScene(change)).toBe(true)
  }

  it('o mestre dá uma Espada ao Bandido 1 e apaga o Bandido 2: a Espada vai para a ficha e continua lá depois de trocar de cena', async () => {
    await abrir('pasta', comBandidos([boneco('t_bandido_1', 'p_bandido', { x: 288 }), boneco('t_bandido_2', 'p_bandido', { x: 352 })]))
    const antes = fichaAtiva('p_bandido')
    darEspada('t_bandido_1')
    // Ainda são dois: a Espada mora no boneco.
    expect(fichaAtiva('p_bandido')).toBe(antes)

    useMapStore.getState().removeToken('t_bandido_2')
    expect(itens(fichaAtiva('p_bandido')?.mochila)).toEqual(['Espada x1'])
    // O mestre fica sabendo que a mochila do boneco passou para a ficha.
    expect(useToastStore.getState().toasts.at(-1)?.text).toContain('Bandido')
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(useAdventureStore.getState().switchScene(SKY)).toBe(true)
    expect(itens(bonecoDa('t_bandido_1').mochila)).toEqual(['Espada x1'])
  })

  it('Ctrl+Z que desfaz a duplicação: a Espada dada depois fica, sem duplicar no Ctrl+Y nem no Ctrl+Z seguinte', async () => {
    await abrir('aventura sem pasta', comBandidos([boneco('t_bandido_1', 'p_bandido', { x: 288 })]))
    useMapStore.getState().addToken(boneco('t_bandido_2', 'p_bandido', { x: 352 }))
    darEspada('t_bandido_1')
    expect(fichaAtiva('p_bandido')?.mochila).toBeUndefined()

    useMapStore.getState().undo()
    expect(bonecoDa('t_bandido_1').mochila?.length).toBe(1)
    expect(itens(fichaAtiva('p_bandido')?.mochila)).toEqual(['Espada x1'])
    useMapStore.getState().redo()
    useMapStore.getState().undo()
    expect(itens(fichaAtiva('p_bandido')?.mochila)).toEqual(['Espada x1'])
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(useAdventureStore.getState().switchScene(SKY)).toBe(true)
    expect(itens(bonecoDa('t_bandido_1').mochila)).toEqual(['Espada x1'])
  })
})

/** O texto do último aviso ao mestre. */
function ultimoAviso(): string | undefined {
  return useToastStore.getState().toasts.at(-1)?.text
}

describe('ligar um boneco que carrega coisas a uma ficha (C1)', () => {
  /** As 2 Poções do marujo: a mesma Poção do acervo, noutra vaga — somam na vaga da ficha. */
  const DUAS_POCOES: CarriedItem = { id: 'vaga_do_marujo', itemId: 'acervo_pocao', nome: 'Poção', empilhavel: true, quantidade: 2 }
  const comMarujos = (): Abertura => ({
    personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro', { mochila: [VAGA_DA_POCAO], moedas: 10 })],
    sky: cena('map_sky', 'Sky Lagoon', [
      boneco('t_luffy_sky', 'p_luffy'),
      boneco('t_marujo', null, { name: 'Marujo', x: 160, mochila: [DUAS_POCOES], moedas: 30 }),
      boneco('t_vendedor', null, { x: 224, mochila: [CORDA] }),
    ]),
    goa: cena('map_goa', 'Reino de Goa', [
      boneco('t_zoro_goa', 'p_zoro'),
      boneco('t_marujo_goa', null, { name: 'Marujo de Goa', x: 160, mochila: [DUAS_POCOES], moedas: 30 }),
      boneco('t_guarda', null, { x: 224, mochila: [CORDA] }),
    ]),
  })

  it.each<Onde>(['pasta', 'aventura sem pasta', 'Configurar só neste mapa'])(
    'pelo painel ou pela ficha (%s): 2 Poções + a ficha do Zoro com 1 = 3, aviso, e a troca de cena não apaga nada',
    async (onde) => {
      await abrir(onde, comMarujos())
      useMapStore.getState().updateToken('t_marujo', { characterId: 'p_zoro' })
      expect([itens(fichaAtiva('p_zoro')?.mochila), fichaAtiva('p_zoro')?.moedas]).toEqual([['Poção x3'], 40])
      expect(ultimoAviso()).toBe('Poção ×2 e 30 moedas do boneco Marujo foram para a mochila de Zoro.')
      expect([itens(bonecoDa('t_marujo').mochila), bonecoDa('t_marujo').moedas]).toEqual([['Poção x3'], 40])
      // O Zoro do Reino de Goa (de fundo) já mostra a ficha nova; o Luffy não muda.
      expect(itens(bonecoDa('t_zoro_goa', GOA).mochila)).toEqual(['Poção x3'])
      expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x1'])
      // NPC sem ficha intocado, nas duas cenas.
      expect(bonecoDa('t_vendedor').mochila).toEqual([CORDA])
      expect(bonecoDa('t_guarda', GOA).mochila).toEqual([CORDA])
      // O achado da auditoria: a próxima troca de cena apagava a mochila do boneco ligado.
      expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
      expect(useAdventureStore.getState().switchScene(SKY)).toBe(true)
      expect(itens(bonecoDa('t_marujo').mochila)).toEqual(['Poção x3'])
      expect(itens(fichaAtiva('p_zoro')?.mochila)).toEqual(['Poção x3'])
    },
  )

  it('Ctrl+Z do "ligar": a ficha fica com 3 e o boneco sem cópia; o Ctrl+Y não soma de novo', async () => {
    await abrir('pasta', comMarujos())
    useMapStore.getState().updateToken('t_marujo', { characterId: 'p_zoro' })
    useMapStore.getState().undo()
    expect(bonecoDa('t_marujo').characterId).toBeNull()
    expect([bonecoDa('t_marujo').mochila, bonecoDa('t_marujo').moedas]).toEqual([undefined, undefined])
    expect([itens(fichaAtiva('p_zoro')?.mochila), fichaAtiva('p_zoro')?.moedas]).toEqual([['Poção x3'], 40])
    expect(ultimoAviso()).toBe('O boneco Marujo não mostra mais a ficha de Zoro: a mochila e a bolsa continuam na ficha.')
    useMapStore.getState().redo()
    expect([itens(fichaAtiva('p_zoro')?.mochila), fichaAtiva('p_zoro')?.moedas]).toEqual([['Poção x3'], 40])
    expect(itens(bonecoDa('t_marujo').mochila)).toEqual(['Poção x3'])
  })

  it('pela sala LAN, na cena aberta ("Criar minha ficha"): a ficha nova nasce com as 2 Poções e as 30 moedas do boneco, com aviso', async () => {
    await abrir('pasta', comMarujos())
    hostPlayerChanges.applyPersonagem({ personagem: ficha('p_nami', 'Nami'), ligarTokenId: 't_marujo', criadoPor: 'Bia' })
    expect([itens(fichaAtiva('p_nami')?.mochila), fichaAtiva('p_nami')?.moedas]).toEqual([['Poção x2'], 30])
    expect(ultimoAviso()).toBe('Poção ×2 e 30 moedas do boneco Marujo foram para a mochila de Nami.')
    expect([itens(bonecoDa('t_marujo').mochila), bonecoDa('t_marujo').moedas]).toEqual([['Poção x2'], 30])
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(useAdventureStore.getState().switchScene(SKY)).toBe(true)
    expect(itens(bonecoDa('t_marujo').mochila)).toEqual(['Poção x2'])
  })

  it('pela sala LAN, numa cena de fundo, à ficha do Luffy que já tem 1 Poção: 3, aviso, e o Luffy da cena aberta mostra 3', async () => {
    await abrir('pasta', comMarujos())
    const luffy = fichaAtiva('p_luffy')
    if (luffy === undefined) throw new Error('o Luffy está na pasta')
    hostPlayerChanges.applyPersonagem({ personagem: luffy, ligarTokenId: 't_marujo_goa', sceneId: GOA })
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x3'], 40])
    expect(ultimoAviso()).toBe('Poção ×2 e 30 moedas do boneco Marujo de Goa foram para a mochila de Luffy.')
    expect([itens(bonecoDa('t_marujo_goa', GOA).mochila), bonecoDa('t_marujo_goa', GOA).moedas]).toEqual([['Poção x3'], 40])
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x3'])
    expect(useAdventureStore.getState().dirty[GOA]).toBe(true)
    expect(bonecoDa('t_guarda', GOA).mochila).toEqual([CORDA])
  })
})

describe('ficha com vários bonecos no mesmo mapa (C1)', () => {
  const FACA: CarriedItem = { id: 'vaga_faca', nome: 'Faca' }
  const tresMarinheiros = (cenaId: string): Token[] => [
    boneco(`${cenaId}_m1`, 'p_marinheiro', { name: 'Marinheiro 1', x: 288, mochila: [{ ...VAGA_DA_POCAO, id: `${cenaId}_vaga_m1` }] }),
    boneco(`${cenaId}_m2`, 'p_marinheiro', { name: 'Marinheiro 2', x: 352, mochila: [CORDA] }),
    boneco(`${cenaId}_m3`, 'p_marinheiro', { name: 'Marinheiro 3', x: 416, moedas: 5 }),
  ]
  const comMarinheiros = (): Abertura => ({
    personagens: [ficha('p_luffy', 'Luffy'), ficha('p_zoro', 'Zoro'), ficha('p_marinheiro', 'Marinheiro', { mochila: [FACA] })],
    sky: cena('map_sky', 'Sky Lagoon', [boneco('t_luffy_sky', 'p_luffy'), ...tresMarinheiros('sky'), boneco('t_vendedor', null, { x: 224, mochila: [CORDA] })]),
    goa: cena('map_goa', 'Reino de Goa', [boneco('t_luffy_goa', 'p_luffy'), ...tresMarinheiros('goa')]),
  })

  it('3 Marinheiros na mesma ficha mantêm cada um a sua: dar ao Marinheiro 2 não mexe na ficha nem nos outros', async () => {
    await abrir('pasta', comMarinheiros())
    const antes = fichaAtiva('p_marinheiro')
    expect(itens(bonecoDa('sky_m1').mochila)).toEqual(['Poção x1'])
    expect(itens(bonecoDa('sky_m2').mochila)).toEqual(['Corda x1'])
    expect(darPocao('sky_m2')).toBe(true)
    expect(fichaAtiva('p_marinheiro')).toBe(antes)
    expect(itens(bonecoDa('sky_m2').mochila)).toEqual(['Corda x1', 'Poção x1'])
    expect(itens(bonecoDa('sky_m1').mochila)).toEqual(['Poção x1'])
    expect(bonecoDa('sky_m3').moedas).toBe(5)
    expect(itens(bonecoDa('goa_m2', GOA).mochila)).toEqual(['Corda x1'])
  })

  it('tirar 2 deles na cena aberta: o último herda a mochila da ficha somada com a dele, e a troca de cena não perde nada', async () => {
    await abrir('pasta', comMarinheiros())
    useMapStore.getState().removeToken('sky_m2')
    // De 3 para 2: continuam vários, a ficha não muda.
    expect(fichaAtiva('p_marinheiro')?.mochila).toEqual([FACA])
    useMapStore.getState().removeToken('sky_m3')
    expect(itens(fichaAtiva('p_marinheiro')?.mochila)).toEqual(['Faca x1', 'Poção x1'])
    expect(itens(bonecoDa('sky_m1').mochila)).toEqual(['Faca x1', 'Poção x1'])
    expect(ultimoAviso()).toBe('Poção do boneco Marinheiro 1 foi para a mochila de Marinheiro.')
    // No Reino de Goa continuam três, cada um com a sua; o NPC sem ficha não muda.
    expect(itens(bonecoDa('goa_m1', GOA).mochila)).toEqual(['Poção x1'])
    expect(bonecoDa('t_vendedor').mochila).toEqual([CORDA])
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(useAdventureStore.getState().switchScene(SKY)).toBe(true)
    expect(itens(bonecoDa('sky_m1').mochila)).toEqual(['Faca x1', 'Poção x1'])
  })

  it('tirar 2 deles numa cena de fundo: o último herda a ficha somada com a dele, e os três da cena aberta ficam como estavam', async () => {
    await abrir('pasta', comMarinheiros())
    useAdventureStore.getState().updateBackgroundScene(GOA, (map) => removeToken(removeToken(map, 'goa_m1'), 'goa_m2'))
    expect([itens(fichaAtiva('p_marinheiro')?.mochila), fichaAtiva('p_marinheiro')?.moedas]).toEqual([['Faca x1'], 5])
    expect([itens(bonecoDa('goa_m3', GOA).mochila), bonecoDa('goa_m3', GOA).moedas]).toEqual([['Faca x1'], 5])
    expect(ultimoAviso()).toBe('5 moedas do boneco Marinheiro 3 foram para a mochila de Marinheiro.')
    expect(itens(bonecoDa('sky_m1').mochila)).toEqual(['Poção x1'])
    expect(itens(bonecoDa('sky_m2').mochila)).toEqual(['Corda x1'])
  })

  it('de 1 para 2 (duplicar o Luffy) e de volta a 1: a ficha guarda tudo, a Poção dada no meio entra, nada some nem dobra', async () => {
    await abrir('pasta', { personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro')] })
    expect(itens(bonecoDa('t_luffy_sky').mochila)).toEqual(['Poção x1'])
    useMapStore.getState().setSelection([{ kind: 'token', id: 't_luffy_sky' }])
    useMapStore.getState().duplicateSelected()
    const doLuffy = (): Token[] => useMapStore.getState().map.tokens.filter((token) => token.characterId === 'p_luffy')
    expect(doLuffy().map((token) => [token.mochila, token.moedas])).toEqual([
      [undefined, undefined],
      [undefined, undefined],
    ])
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 10])
    expect(ultimoAviso()).toContain('Luffy tem 2 bonecos nesta cena')
    // No Reino de Goa o Luffy é um só: continua mostrando a ficha.
    expect(itens(bonecoDa('t_luffy_goa', GOA).mochila)).toEqual(['Poção x1'])

    // Enquanto são dois, a Poção dada ao original é dele; o Ctrl+Z da duplicação a leva para a ficha.
    expect(darPocao('t_luffy_sky')).toBe(true)
    expect(itens(fichaAtiva('p_luffy')?.mochila)).toEqual(['Poção x1'])
    useMapStore.getState().undo()
    expect(doLuffy()).toHaveLength(1)
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x2'], 10])
    expect([itens(bonecoDa('t_luffy_sky').mochila), bonecoDa('t_luffy_sky').moedas]).toEqual([['Poção x2'], 10])
    useMapStore.getState().redo()
    useMapStore.getState().undo()
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x2'], 10])
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(itens(bonecoDa('t_luffy_goa').mochila)).toEqual(['Poção x2'])
  })

  it('o Luffy atravessa para o Reino de Goa, onde já há outro boneco dele, e volta: a ficha guarda tudo, as moedas não dobram', async () => {
    await abrir('pasta', { personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro')] })
    expect(useAdventureStore.getState().transferToken('t_luffy_sky', SKY, GOA, 320, 96)).toBe(true)
    // No Reino de Goa são dois Luffys: cada um com a sua, e a da ficha fica nela.
    expect([bonecoDa('t_luffy_sky', GOA).mochila, bonecoDa('t_luffy_goa', GOA).mochila]).toEqual([undefined, undefined])
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 10])
    expect(ultimoAviso()).toContain('Luffy tem 2 bonecos nesta cena')
    expect(useAdventureStore.getState().transferToken('t_luffy_sky', GOA, SKY, 96, 96)).toBe(true)
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 10])
    expect([itens(bonecoDa('t_luffy_sky').mochila), bonecoDa('t_luffy_sky').moedas]).toEqual([['Poção x1'], 10])
    expect([itens(bonecoDa('t_luffy_goa', GOA).mochila), bonecoDa('t_luffy_goa', GOA).moedas]).toEqual([['Poção x1'], 10])
  })

  it('o Luffy atravessa para o Reino de Goa e o mestre dá um Ctrl+Z lá: nenhum dos dois ganha a mochila da ficha, e a volta não dobra as moedas', async () => {
    await abrir('pasta', { personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro')] })
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    // Um passo no desfazer do Reino de Goa, com o Luffy de lá mostrando a ficha.
    moverNoEditor('t_guarda', 288)
    expect(useAdventureStore.getState().transferToken('t_luffy_sky', SKY, GOA, 320, 96)).toBe(true)
    // A travessia pôs o Luffy que chegou nesse passo também: lá, como no mapa, ninguém fica com a cópia.
    const doLuffy = (map: MapData): unknown[] => map.tokens.filter((token) => token.characterId === 'p_luffy').map((token) => [token.id, token.mochila, token.moedas])
    const passo = useMapStore.getState().past.at(-1)
    if (passo === undefined) throw new Error('o passo do mover está no desfazer')
    expect(doLuffy(passo)).toEqual([
      ['t_luffy_goa', undefined, undefined],
      ['t_luffy_sky', undefined, undefined],
    ])
    useMapStore.getState().undo()
    expect(doLuffy(useMapStore.getState().map)).toEqual([
      ['t_luffy_goa', undefined, undefined],
      ['t_luffy_sky', undefined, undefined],
    ])
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 10])
    expect(useAdventureStore.getState().transferToken('t_luffy_sky', GOA, SKY, 96, 96)).toBe(true)
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 10])
    expect([itens(bonecoDa('t_luffy_goa').mochila), bonecoDa('t_luffy_goa').moedas]).toEqual([['Poção x1'], 10])
    expect([itens(bonecoDa('t_luffy_sky', SKY).mochila), bonecoDa('t_luffy_sky', SKY).moedas]).toEqual([['Poção x1'], 10])
    // E o desfazer do Reino de Goa, com o Luffy de lá sozinho de novo, também mostra a ficha.
    for (const step of [...useMapStore.getState().past, ...useMapStore.getState().future]) {
      expect(doLuffy(step)).toEqual([['t_luffy_goa', [VAGA_DA_POCAO], 10]])
    }
  })

  it('dois Marujos duplicados (a mesma vaga da Poção), cada um ligado à ficha numa cena: a ficha fica com as 4 Poções', async () => {
    const pocaoP1: CarriedItem = { id: 'p1', nome: 'Poção', quantidade: 2 }
    await abrir('pasta', {
      personagens: [ficha('p_luffy', 'Luffy'), ficha('p_zoro', 'Zoro'), ficha('p_marinheiro', 'Marinheiro')],
      sky: cena('map_sky', 'Sky Lagoon', [boneco('t_luffy_sky', 'p_luffy'), boneco('t_marujo_1', null, { name: 'Marujo', x: 160, mochila: [pocaoP1] })]),
      goa: cena('map_goa', 'Reino de Goa', [boneco('t_luffy_goa', 'p_luffy'), boneco('t_marujo_2', null, { name: 'Marujo 2', x: 160, mochila: [pocaoP1] })]),
    })
    useMapStore.getState().updateToken('t_marujo_1', { characterId: 'p_marinheiro' })
    expect(itens(fichaAtiva('p_marinheiro')?.mochila)).toEqual(['Poção x2'])
    useAdventureStore.getState().updateBackgroundScene(GOA, (map) => ({ ...map, tokens: map.tokens.map((token) => (token.id === 't_marujo_2' ? { ...token, characterId: 'p_marinheiro' } : token)) }))
    expect(itens(fichaAtiva('p_marinheiro')?.mochila)).toEqual(['Poção x2', 'Poção x2'])
    expect(ultimoAviso()).toBe('Poção ×2 do boneco Marujo 2 foram para a mochila de Marinheiro.')
    expect(itens(bonecoDa('t_marujo_2', GOA).mochila)).toEqual(['Poção x2', 'Poção x2'])
    expect(itens(bonecoDa('t_marujo_1').mochila)).toEqual(['Poção x2', 'Poção x2'])
  })
})

describe('o boneco que sai do mapa e volta depois não traz a cópia velha da ficha (C1)', () => {
  /** O Luffy só na Sky Lagoon; no Reino de Goa, só o guarda. */
  const soNaSky = (): Abertura => ({
    personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro')],
    goa: cena('map_goa', 'Reino de Goa', [boneco('t_guarda', null, { x: 224, mochila: [CORDA] })]),
  })

  /** O Luffy bebe a Poção e paga 3 moedas ao Zoro: a ficha fica sem Poção e com 7. */
  function beberEPagar(): void {
    const beber = removeItemChange(bonecoDa('t_luffy_sky'), VAGA_DA_POCAO.id)
    const pagar = payCoinsChange(bonecoDa('t_luffy_sky'), bonecoDa('t_zoro_sky'), 3)
    if (beber === null || pagar === null) throw new Error('o Luffy tem a Poção e 10 moedas')
    expect(applyItemsInScene(beber)).toBe(true)
    expect(applyItemsInScene(pagar)).toBe(true)
    expect([fichaAtiva('p_luffy')?.mochila, fichaAtiva('p_luffy')?.moedas]).toEqual([undefined, 7])
  }

  it('Ctrl+C no Luffy, ele bebe a Poção e paga 3, Ctrl+V no Reino de Goa: a ficha fica sem Poção e com 7, e o colado mostra isso', async () => {
    await abrir('pasta', soNaSky())
    useMapStore.getState().setSelection([{ kind: 'token', id: 't_luffy_sky' }])
    expect(useMapStore.getState().copySelected()).toBe(true)
    beberEPagar()
    expect(useAdventureStore.getState().switchScene(GOA)).toBe(true)
    expect(useMapStore.getState().pasteClipboardAt({ x: 320, y: 320 })).toBe(true)
    expect([fichaAtiva('p_luffy')?.mochila, fichaAtiva('p_luffy')?.moedas]).toEqual([undefined, 7])
    const colado = useMapStore.getState().map.tokens.filter((token) => token.characterId === 'p_luffy')
    expect(colado.map((token) => [token.mochila, token.moedas])).toEqual([[undefined, 7]])
    // O guarda (NPC sem ficha) não muda.
    expect(bonecoDa('t_guarda').mochila).toEqual([CORDA])
  })

  it('Ctrl+X e Ctrl+V do Luffy depois de a ficha mudar: também não volta nada', async () => {
    await abrir('pasta', soNaSky())
    useMapStore.getState().setSelection([{ kind: 'token', id: 't_luffy_sky' }])
    expect(useMapStore.getState().cutSelected()).toBe(true)
    // A ficha muda enquanto ele está recortado (o "Dar a…" da ficha, fora do mapa, faz o mesmo).
    useAdventureStore.getState().ajustarPersonagem('p_luffy', (luffy) => ({ ...luffy, moedas: 4 }))
    expect(useMapStore.getState().pasteClipboardAt({ x: 320, y: 320 })).toBe(true)
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 4])
  })

  it('"Guardar ficha" de quem foi embora: a ficha muda enquanto ele está fora, e na volta o boneco mostra a ficha de agora', async () => {
    await abrir('pasta', soNaSky())
    const guardado = bonecoDa('t_luffy_sky')
    bonecoVaiSerGuardado(guardado.id)
    useMapStore.getState().removeToken(guardado.id)
    useAdventureStore.getState().ajustarPersonagem('p_luffy', (luffy) => ({ ...luffy, moedas: 7 }))
    useMapStore.getState().addToken(bonecoQueVoltaDaGuarda(guardado))
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 7])
    expect([itens(bonecoDa('t_luffy_sky').mochila), bonecoDa('t_luffy_sky').moedas]).toEqual([['Poção x1'], 7])
  })

  it('"Guardar ficha" de um boneco de ficha com vários no mapa: ele volta com o que é dele', async () => {
    await abrir('pasta', {
      ...soNaSky(),
      sky: cena('map_sky', 'Sky Lagoon', [boneco('t_luffy_sky', 'p_luffy'), boneco('t_luffy_2', 'p_luffy', { x: 160, mochila: [CORDA] }), boneco('t_zoro_sky', 'p_zoro', { x: 224 })]),
    })
    const guardado = bonecoDa('t_luffy_2')
    bonecoVaiSerGuardado(guardado.id)
    expect(bonecoQueVoltaDaGuarda(guardado)).toBe(guardado)
  })
})

describe('o jogador da sala dono do boneco que ficou vazio também é avisado (decisão de 05/11/2026)', () => {
  const DUAS_POCOES: CarriedItem = { id: 'vaga_do_marujo', itemId: 'acervo_pocao', nome: 'Poção', empilhavel: true, quantidade: 2 }
  const AVISO_DO_LUFFY = 'Luffy tem 2 bonecos nesta cena: cada um tem a sua mochila. A mochila e a bolsa da ficha continuam nela e voltam quando ficar um boneco só.'

  /** A ponte da sala de mentira: quem joga com qual boneco, e os recados que saíram. */
  function salaDeTeste(donos: Record<string, string[]>): { recados: { playerId: string; texto: string }[]; desligar: () => void } {
    const recados: { playerId: string; texto: string }[] = []
    const ponte = {
      players: () => Object.entries(donos).map(([playerId, tokenIds]) => ({ playerId, tokenIds })),
      playerNote: (playerId: string, texto: string) => {
        recados.push({ playerId, texto })
      },
    }
    const desligar = ouvirBonecosSeparados((separadas) => avisarJogadoresDosBonecosSeparados(ponte, separadas))
    return { recados, desligar }
  }

  it('Bia liga o Marujo (com as coisas dele) ao Luffy pela sala: o Luffy da Ana fica vazio, e a Ana recebe o mesmo aviso do mestre', async () => {
    await abrir('pasta', {
      personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro')],
      sky: cena('map_sky', 'Sky Lagoon', [boneco('t_luffy_sky', 'p_luffy'), boneco('t_marujo', null, { name: 'Marujo', x: 160, mochila: [DUAS_POCOES], moedas: 30 })]),
    })
    const luffy = fichaAtiva('p_luffy')
    if (luffy === undefined) throw new Error('o Luffy está na pasta')
    const sala = salaDeTeste({ ana: ['t_luffy_sky'], bia: ['t_marujo'] })
    try {
      hostPlayerChanges.applyPersonagem({ personagem: luffy, ligarTokenId: 't_marujo', criadoPor: 'Bia' })
    } finally {
      sala.desligar()
    }
    expect([bonecoDa('t_luffy_sky').mochila, bonecoDa('t_luffy_sky').moedas]).toEqual([undefined, undefined])
    expect([itens(bonecoDa('t_marujo').mochila), bonecoDa('t_marujo').moedas]).toEqual([['Poção x2'], 30])
    expect([itens(fichaAtiva('p_luffy')?.mochila), fichaAtiva('p_luffy')?.moedas]).toEqual([['Poção x1'], 10])
    expect(ultimoAviso()).toBe(AVISO_DO_LUFFY)
    // Só a Ana: o Marujo da Bia ficou com as coisas dele.
    expect(sala.recados).toEqual([{ playerId: 'ana', texto: AVISO_DO_LUFFY }])
  })

  it('o Luffy da Ana atravessa para o Reino de Goa, onde está o Luffy do Caio: os dois ficam vazios e os dois jogadores são avisados', async () => {
    await abrir('pasta', { personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro')] })
    const sala = salaDeTeste({ ana: ['t_luffy_sky'], caio: ['t_luffy_goa'], bia: ['t_zoro_sky'] })
    try {
      expect(useAdventureStore.getState().transferToken('t_luffy_sky', SKY, GOA, 320, 96)).toBe(true)
    } finally {
      sala.desligar()
    }
    expect([bonecoDa('t_luffy_sky', GOA).mochila, bonecoDa('t_luffy_goa', GOA).mochila]).toEqual([undefined, undefined])
    expect(sala.recados.map((recado) => recado.playerId).sort()).toEqual(['ana', 'caio'])
    expect(sala.recados.every((recado) => recado.texto === AVISO_DO_LUFFY)).toBe(true)
  })

  it('sem ninguém ouvindo (sala fechada), o mestre continua com o aviso e nada mais sai', async () => {
    await abrir('pasta', { personagens: [ficha('p_luffy', 'Luffy', { mochila: [VAGA_DA_POCAO], moedas: 10 }), ficha('p_zoro', 'Zoro')] })
    const sala = salaDeTeste({})
    try {
      useMapStore.getState().setSelection([{ kind: 'token', id: 't_luffy_sky' }])
      useMapStore.getState().duplicateSelected()
    } finally {
      sala.desligar()
    }
    expect(ultimoAviso()).toBe(AVISO_DO_LUFFY)
    expect(sala.recados).toEqual([])
  })
})

describe('as fichas do próprio mapa que mandam na mochila (fichasDonasDoProprioMapa, para o "Usar o da pasta")', () => {
  const idsDasDonas = (): string[] => fichasDonasDoProprioMapa(useAdventureStore.getState()).map((personagem) => personagem.id)

  it('"Configurar só neste mapa" com a aventura migrada: as fichas da aventura', async () => {
    await abrir('Configurar só neste mapa')
    expect(idsDasDonas()).toEqual(['p_luffy', 'p_zoro'])
  })

  it('o mapa que herda da pasta: nenhuma (quem manda são as fichas da pasta)', async () => {
    await abrir('pasta')
    expect(idsDasDonas()).toEqual([])
  })

  it('antes da migração: nenhuma (a mochila ainda mora nos bonecos)', async () => {
    await abrir('Configurar só neste mapa', { migrada: false })
    expect(idsDasDonas()).toEqual([])
  })
})
