/**
 * MOCHILA NA FICHA — a cola do app com o mapa da pasta ABERTO no editor:
 * "Importar personagens…"/"Copiar de um mapa" (`fichasEntramNaPasta`), "Usar
 * o da pasta" (`trocarModoDoMapa(false)`) e a volta do Sistema universal
 * (`trocarSistemaDaPasta`). Nos três, o espelho esvazia os bonecos dele assim
 * que o disco grava, então o pendente tem de estar no relatório antes. O
 * Tauri, o store do editor, a cópia do trabalho e as gravações do índice e do
 * `rpg.json` são falsos; o disco é um mapa em memória montado como uma cópia do
 * appData. Nunca toca o disco de verdade. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { serializeAdventure, type Adventure } from '../../lib/adventure'
import { quantidadeDe } from '../../lib/items'
import { createEmptyMap } from '../../lib/mapFactory'
import { serializeMap } from '../../lib/mapFile'
import { mapaComAsFichas } from '../../lib/mochila/espelho'
import { indiceDoArquivo, rpgComSistema, rpgDoArquivo, serializarIndice, serializarRpg, type IndiceDasPastas, type RpgDaPasta, type RpgLido } from '../../lib/pastasDeMapas'
import { novoPersonagem, type Personagem } from '../../lib/personagem'
import type { RecoveryCopy } from '../../lib/recoveryCopy'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { trocarModoDoMapa } from '../../stores/rpgDaPasta'
import { useToastStore } from '../../stores/toastStore'
import type { CarriedItem, MapData, Token } from '../../types/map'
import type { DiscoDaMigracao } from './migracaoDaMochila'
import { conferirMochilaAoAbrir, fichasEntramNaPasta, marcarMapaImportado, trocarSistemaDaPasta } from './mochilaPendenteNoApp'

/** A cópia da pasta aberta no editor, como o store a guarda (só o que a cola lê). */
interface PastaDoEditor {
  chave: string
  pastaId: string
  nome: string
  proprio: boolean
  personagens: Personagem[]
  mochilaMigrada?: number
}

const falso = vi.hoisted(() => {
  const APPDATA = 'C:/appdata'
  const INDICE = `${APPDATA}/pastas/indice.json`
  const RELATORIO = `${APPDATA}/pastas/pasta_one-piece/migracao-da-mochila.json`
  const estado: {
    arquivos: Map<string, string>
    relatorioTrava: boolean
    indiceTrava: boolean
    copia: RecoveryCopy | null
    pasta: PastaDoEditor
    /** As fichas do próprio mapa que mandam na mochila (a aventura dele já migrada); vazio = a mochila mora nos bonecos. */
    fichasDoMapa: Personagem[]
    /** O relatório no instante em que o editor trocou o modo (o espelho), ou `null` = não trocou. */
    relatorioNoEspelho: string | null
  } = {
    arquivos: new Map(),
    relatorioTrava: false,
    indiceTrava: false,
    copia: null,
    pasta: { chave: 'going-merry', pastaId: 'pasta_one-piece', nome: 'One Piece', proprio: false, personagens: [] },
    fichasDoMapa: [],
    relatorioNoEspelho: null,
  }
  const disco: DiscoDaMigracao = {
    pastaDoApp: async () => APPDATA,
    ler: async (caminho) => {
      if (estado.relatorioTrava && caminho.endsWith('/migracao-da-mochila.json')) throw new Error('o disco travou')
      return estado.arquivos.get(caminho) ?? null
    },
    gravar: async (caminho, texto) => {
      estado.arquivos.set(caminho, texto)
    },
    gravadoEm: async () => 1,
    juntar: async (...partes) => partes.join('/'),
    pai: async (caminho) => caminho.slice(0, caminho.lastIndexOf('/')),
  }
  return { APPDATA, INDICE, RELATORIO, estado, disco }
})

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn(async () => undefined) }))
vi.mock('./migracaoDaMochila', async (importOriginal) => ({ ...(await importOriginal<typeof import('./migracaoDaMochila')>()), discoDoApp: falso.disco }))
vi.mock('../../stores/recoveryAutosave', () => ({
  captureEditorWork: async () => {
    if (falso.estado.copia === null) throw new Error('nada aberto')
    return falso.estado.copia
  },
}))
vi.mock('../../stores/adventureStore', () => ({
  useAdventureStore: {
    getState: () => ({
      pasta: falso.estado.pasta,
      // O editor troca o modo e o espelho põe as fichas da pasta nos bonecos: aqui, só anota o relatório daquele instante.
      definirProprio: (proprio: boolean) => {
        falso.estado.relatorioNoEspelho = falso.estado.arquivos.get(falso.RELATORIO) ?? ''
        falso.estado.pasta = { ...falso.estado.pasta, proprio }
        return true
      },
      mudarRpgDaPasta: () => true,
    }),
  },
  fichasDonasDoProprioMapa: () => falso.estado.fichasDoMapa,
}))
// O índice e o rpg.json que o app grava pelo plugin do Tauri: aqui, no disco falso.
vi.mock('../../lib/pastasDeMapas', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/pastasDeMapas')>()
  const rpgDe = (pastaId: string): string => `${falso.APPDATA}/pastas/${pastaId}/rpg.json`
  return {
    ...original,
    mudarIndiceDasPastas: async (mudar: (indice: IndiceDasPastas) => IndiceDasPastas): Promise<IndiceDasPastas> => {
      if (falso.estado.indiceTrava) throw new Error('Não deu para guardar as pastas: sem espaço no disco.')
      const novo = mudar(original.indiceDoArquivo(JSON.parse(falso.estado.arquivos.get(falso.INDICE) ?? '{}')))
      falso.estado.arquivos.set(falso.INDICE, original.serializarIndice(novo))
      return novo
    },
    lerRpgDaPasta: async (pastaId: string): Promise<RpgLido> => {
      const texto = falso.estado.arquivos.get(rpgDe(pastaId))
      return texto === undefined ? { ok: false, motivo: 'sem o rpg.json' } : { ok: true, rpg: original.rpgDoArquivo(JSON.parse(texto)) }
    },
    gravarRpgDaPasta: async (pastaId: string, rpg: RpgDaPasta): Promise<void> => {
      falso.estado.arquivos.set(rpgDe(pastaId), original.serializarRpg(rpg))
    },
  }
})

const PASTA_ID = 'pasta_one-piece'
const MAPS = `${falso.APPDATA}/maps`
const RPG = `${falso.APPDATA}/pastas/${PASTA_ID}/rpg.json`
const RELATORIO = falso.RELATORIO
const MERRY = `${MAPS}/going-merry/map.json`
const POCAO_DO_USOPP: CarriedItem = { id: 'vaga_pocao_usopp', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true, quantidade: 2 }
const CORDA: CarriedItem = { id: 'pino_corda', nome: 'Corda' }
const AVISOS = ['Poção ×2 do boneco Usopp (Going Merry) não estão na mochila de Usopp.', 'Corda do boneco Usopp (Going Merry) não está na mochila de Usopp.']

function ficha(id: string, nome: string, extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id, ...extra }
}

function boneco(id: string, characterId: string | null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name: id, x: 0, y: 0, size: 1, image: null, ...extra }
}

function goingMerry(usopp: Partial<Token>): MapData {
  return { ...createEmptyMap('merry', 'Going Merry', 10, 10, 64), tokens: [boneco('Usopp', 'p_usopp', usopp), boneco('Vendedor', null, { mochila: [CORDA] })] }
}

const USOPP = ficha('p_usopp', 'Usopp')

function rpgNoDisco(): RpgDaPasta {
  const texto = falso.estado.arquivos.get(RPG)
  if (texto === undefined) throw new Error('sem o rpg.json')
  return rpgDoArquivo(JSON.parse(texto))
}

/** As linhas de pendente de um texto do relatório; sem texto, nenhuma. */
function linhasDe(texto: string | null | undefined): unknown[] {
  if (texto === null || texto === undefined || texto === '') return []
  const linhas: unknown = JSON.parse(texto).itensDeMapasQueEntraram
  return Array.isArray(linhas) ? linhas : []
}

function linhasDoRelatorio(): unknown[] {
  return linhasDe(falso.estado.arquivos.get(RELATORIO))
}

/** "Importar personagens…" como o app grava: o rpg.json com a ficha nova (e, aqui, o espelho esvaziando o Usopp aberto). */
async function gravarOUsopp(): Promise<void> {
  const rpg = rpgNoDisco()
  falso.estado.arquivos.set(RPG, serializarRpg({ ...rpg, personagens: [...rpg.personagens, USOPP] }))
}

function toasts(): { kind: string; text: string }[] {
  return useToastStore.getState().toasts.map(({ kind, text }) => ({ kind, text }))
}

beforeEach(() => {
  const { arquivos } = falso.estado
  arquivos.clear()
  falso.estado.relatorioTrava = false
  falso.estado.indiceTrava = false
  falso.estado.relatorioNoEspelho = null
  falso.estado.fichasDoMapa = []
  falso.estado.pasta = { chave: 'going-merry', pastaId: PASTA_ID, nome: 'One Piece', proprio: false, personagens: [], mochilaMigrada: 1 }
  arquivos.set(falso.INDICE, serializarIndice({ pastas: [{ id: PASTA_ID, nome: 'One Piece' }], mapas: [{ chave: 'going-merry', pastaId: PASTA_ID }] }))
  arquivos.set(RPG, serializarRpg({ sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [ficha('p_luffy', 'Luffy')], mochilaMigrada: 1 }))
  arquivos.set(RELATORIO, JSON.stringify({ versao: 1 }))
  // No disco, a Poção ×2; no editor (sem salvar), também a Corda.
  arquivos.set(MERRY, serializeMap(goingMerry({ mochila: [POCAO_DO_USOPP] })))
  falso.estado.copia = { savedAtMs: 1, mapPath: MERRY, map: goingMerry({ mochila: [POCAO_DO_USOPP, CORDA] }), scenes: {} }
  useToastStore.setState({ toasts: [] })
})

describe('"Importar personagens…" com o mapa da pasta aberto (fichasEntramNaPasta)', () => {
  it('tudo certo: o aviso de cada item do boneco aberto aparece, sem erro', async () => {
    await fichasEntramNaPasta(PASTA_ID, [USOPP], gravarOUsopp)
    expect(toasts()).toEqual(AVISOS.map((text) => ({ kind: 'instrucao', text })))
    expect(linhasDoRelatorio()).toHaveLength(2)
  })

  it('a conferência de depois cai: os avisos do mapa aberto aparecem mesmo assim e já estão no relatório; o erro não promete o que não vale', async () => {
    const gravar = async (): Promise<void> => {
      await gravarOUsopp()
      falso.estado.relatorioTrava = true
    }
    await fichasEntramNaPasta(PASTA_ID, [USOPP], gravar)
    expect(linhasDoRelatorio()).toHaveLength(2)
    const avisos = toasts()
    expect(avisos.filter((toast) => toast.kind === 'instrucao').map((toast) => toast.text)).toEqual(AVISOS)
    expect(avisos.filter((toast) => toast.kind === 'error')).toEqual([
      {
        kind: 'error',
        text: 'Não deu para conferir a mochila dos bonecos das fichas novas (o disco travou). O que os bonecos do mapa aberto carregavam ficou anotado antes de a ficha valer nele; os outros mapas da pasta conferem ao abrir, antes de a ficha valer neles.',
      },
    ])
  })

  it('o rpg.json não grava: lança, a ficha não entrou e o aviso falso sai do relatório', async () => {
    const gravar = async (): Promise<void> => {
      throw new Error('sem espaço no disco')
    }
    await expect(fichasEntramNaPasta(PASTA_ID, [USOPP], gravar)).rejects.toThrow('sem espaço no disco')
    expect(rpgNoDisco().personagens.map((personagem) => personagem.id)).toEqual(['p_luffy'])
    expect(linhasDoRelatorio()).toEqual([])
    expect(toasts()).toEqual([])
  })

  it('o trabalho do mapa aberto não deu para copiar: a conferência caindo manda não salvar', async () => {
    falso.estado.copia = null
    const gravar = async (): Promise<void> => {
      await gravarOUsopp()
      falso.estado.relatorioTrava = true
    }
    await fichasEntramNaPasta(PASTA_ID, [USOPP], gravar)
    expect(toasts().find((toast) => toast.kind === 'error')?.text).toContain('Não salve o mapa aberto: feche sem salvar e abra de novo')
  })
})

function indiceNoDisco(): IndiceDasPastas {
  return indiceDoArquivo(JSON.parse(falso.estado.arquivos.get(falso.INDICE) ?? '{}'))
}

function merryEmProprio(): boolean {
  return indiceNoDisco().mapas.find((lugar) => lugar.chave === 'going-merry')?.proprio === true
}

function mochilaDoUsoppNaPasta(): [string, number][] {
  const usopp = rpgNoDisco().personagens.find((personagem) => personagem.id === 'p_usopp')
  return (usopp?.mochila ?? []).map((item) => [item.nome, quantidadeDe(item)])
}

function moedasDoUsoppNaPasta(): number | undefined {
  return rpgNoDisco().personagens.find((personagem) => personagem.id === 'p_usopp')?.moedas
}

/** A Poção do Usopp depois de beber uma, sem salvar: a mesma vaga da ×2 do disco. */
const UMA_POCAO_DO_USOPP: CarriedItem = { id: 'vaga_pocao_usopp', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true }

/** Os ids das linhas de pendente do relatório, na ordem. */
function idsDoRelatorio(): unknown[] {
  return linhasDoRelatorio().map((linha) => (typeof linha === 'object' && linha !== null && 'id' in linha ? linha.id : null))
}

/** O "Trazer para a ficha" de cada aviso `textos`, pego antes de clicar o primeiro (o clique troca a caixa). */
function acoesDeTrazer(textos: readonly string[]): (() => void)[] {
  return textos.map((texto) => {
    const aviso = useToastStore.getState().toasts.find((toast) => toast.text === texto)
    const trazer = aviso?.actions?.find((acao) => acao.label === 'Trazer para a ficha')
    if (trazer === undefined) throw new Error(`sem o "Trazer para a ficha" de "${texto}"`)
    return trazer.run
  })
}

describe('"Usar o da pasta" com o mapa aberto em "Configurar só neste mapa" (trocarModoDoMapa(false))', () => {
  /** A Poção ×1 da pasta, noutra vaga: a ficha da pasta de mesmo id que vai vencer o boneco do Usopp. */
  const POCAO_DA_PASTA: CarriedItem = { id: 'vaga_pocao_pasta', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true }

  beforeEach(() => {
    const { arquivos } = falso.estado
    falso.estado.pasta = { ...falso.estado.pasta, proprio: true }
    arquivos.set(falso.INDICE, serializarIndice({ pastas: [{ id: PASTA_ID, nome: 'One Piece' }], mapas: [{ chave: 'going-merry', pastaId: PASTA_ID, proprio: true }] }))
    arquivos.set(RPG, serializarRpg({ sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [ficha('p_luffy', 'Luffy'), ficha('p_usopp', 'Usopp', { mochila: [POCAO_DA_PASTA] })], mochilaMigrada: 1 }))
  })

  it('o Usopp do mapa carregando Poção ×2: os pendentes entram no relatório ANTES do espelho; salvar e reabrir mostra a Poção ×2, e Trazer deixa a ficha da pasta com a soma', async () => {
    await trocarModoDoMapa(false)
    expect(merryEmProprio()).toBe(false)
    expect(falso.estado.pasta.proprio).toBe(false)
    // O relatório já tinha os dois pendentes quando o editor trocou o modo (e o espelho esvaziou o Usopp).
    expect(linhasDe(falso.estado.relatorioNoEspelho)).toHaveLength(2)
    expect(toasts()).toEqual(AVISOS.map((text) => ({ kind: 'instrucao', text })))

    // Salvar: o editor grava o mapa como o espelho deixou — o Usopp com a Poção ×1 da pasta, sem a ×2 dele nem a Corda.
    const copia = falso.estado.copia
    if (copia === null) throw new Error('sem a cópia do trabalho')
    const salvo = mapaComAsFichas(copia.map, rpgNoDisco().personagens)
    expect(salvo.tokens.find((token) => token.id === 'Usopp')?.mochila).toEqual([POCAO_DA_PASTA])
    falso.estado.arquivos.set(MERRY, serializeMap(salvo))

    // Reabrir: a abertura confere o mapa marcado, não anota de novo, e mostra os dois avisos.
    useToastStore.setState({ toasts: [] })
    await conferirMochilaAoAbrir(MERRY)
    expect(toasts()).toEqual(AVISOS.map((text) => ({ kind: 'instrucao', text })))
    expect(linhasDoRelatorio()).toHaveLength(2)

    const pocao = useToastStore.getState().toasts.find((toast) => toast.text === AVISOS[0])
    const trazer = pocao?.actions?.find((acao) => acao.label === 'Trazer para a ficha')
    if (trazer === undefined) throw new Error('sem o "Trazer para a ficha" da Poção')
    trazer.run()
    await vi.waitFor(() => expect(mochilaDoUsoppNaPasta()).toEqual([['Poção', 3]]))
  })

  it('sem a cópia do trabalho aberto: recusa, e o mapa continua no próprio sem pendente nenhum', async () => {
    falso.estado.copia = null
    await expect(trocarModoDoMapa(false)).rejects.toThrow('o que os bonecos deste mapa carregam não pôde ser anotado (não deu para copiar o trabalho do mapa aberto)')
    expect(merryEmProprio()).toBe(true)
    expect(falso.estado.relatorioNoEspelho).toBeNull()
    expect(linhasDoRelatorio()).toEqual([])
  })

  it('o relatório não grava: recusa, e o índice nem é tocado', async () => {
    falso.estado.relatorioTrava = true
    await expect(trocarModoDoMapa(false)).rejects.toThrow('não pôde ser anotado (o disco travou)')
    expect(merryEmProprio()).toBe(true)
    expect(falso.estado.relatorioNoEspelho).toBeNull()
  })

  it('o índice não grava: lança, o mapa continua no próprio e os avisos falsos saem do relatório', async () => {
    falso.estado.indiceTrava = true
    await expect(trocarModoDoMapa(false)).rejects.toThrow('sem espaço no disco')
    expect(merryEmProprio()).toBe(true)
    expect(falso.estado.relatorioNoEspelho).toBeNull()
    expect(linhasDoRelatorio()).toEqual([])
    expect(toasts()).toEqual([])
  })

  it('fechar sem salvar e reabrir: a mesma vaga e a mesma bolsa continuam UM pendente cada, com o que o disco tem, e Trazer soma uma vez', async () => {
    // No disco, a Poção ×2 e 45 moedas; no editor, sem salvar, o Usopp bebeu uma e pagou 15.
    falso.estado.arquivos.set(MERRY, serializeMap(goingMerry({ mochila: [POCAO_DO_USOPP], moedas: 45 })))
    falso.estado.copia = { savedAtMs: 1, mapPath: MERRY, map: goingMerry({ mochila: [UMA_POCAO_DO_USOPP], moedas: 30 }), scenes: {} }
    await trocarModoDoMapa(false)
    expect(toasts().map((toast) => toast.text)).toEqual(['Poção do boneco Usopp (Going Merry) não está na mochila de Usopp.', '30 moedas do boneco Usopp (Going Merry) não estão na bolsa de Usopp.'])
    const idsDoTrabalho = idsDoRelatorio()

    // Fechar sem salvar: o disco segue com a Poção ×2 e as 45 moedas, e a abertura confere o mapa marcado.
    useToastStore.setState({ toasts: [] })
    await conferirMochilaAoAbrir(MERRY)
    const avisos = ['Poção ×2 do boneco Usopp (Going Merry) não estão na mochila de Usopp.', '45 moedas do boneco Usopp (Going Merry) não estão na bolsa de Usopp.']
    expect(toasts()).toEqual(avisos.map((text) => ({ kind: 'instrucao', text })))
    expect(idsDoRelatorio()).toEqual(idsDoTrabalho)
    expect(JSON.parse(falso.estado.arquivos.get(RELATORIO) ?? '{}').mapasPorConferir).toEqual([])

    for (const trazer of acoesDeTrazer(avisos)) trazer()
    // A ficha da pasta tinha a Poção ×1: ×3, não ×4; e 45 moedas, não 75.
    await vi.waitFor(() => expect([mochilaDoUsoppNaPasta(), moedasDoUsoppNaPasta()]).toEqual([[['Poção', 3]], 45]))
  })

  it('Trazer a Poção ×1 do trabalho não salvo, fechar sem salvar e reabrir com ×2 no disco: o aviso novo é só a Poção que faltava, e Trazer deixa o total que existiu', async () => {
    // No disco, a Poção ×2 (o `beforeEach`); no editor, sem salvar, o Usopp bebeu uma.
    falso.estado.copia = { savedAtMs: 1, mapPath: MERRY, map: goingMerry({ mochila: [UMA_POCAO_DO_USOPP] }), scenes: {} }
    const umaPocao = 'Poção do boneco Usopp (Going Merry) não está na mochila de Usopp.'
    const instrucoes = (): string[] => toasts().filter((toast) => toast.kind === 'instrucao').map((toast) => toast.text)
    await trocarModoDoMapa(false)
    expect(instrucoes()).toEqual([umaPocao])
    for (const trazer of acoesDeTrazer([umaPocao])) trazer()
    // A ficha da pasta tinha a Poção ×1 noutra vaga: ×2.
    await vi.waitFor(() => expect(mochilaDoUsoppNaPasta()).toEqual([['Poção', 2]]))

    // Fechar sem salvar e reabrir: o disco ainda tem ×2 na vaga já trazida com ×1 — o aviso novo é a diferença, ×1.
    useToastStore.setState({ toasts: [] })
    await conferirMochilaAoAbrir(MERRY)
    expect(instrucoes()).toEqual([umaPocao])
    expect(linhasDoRelatorio()).toHaveLength(2)
    for (const trazer of acoesDeTrazer([umaPocao])) trazer()
    // A pasta tinha ×1 e o boneco ×2: ×3, o total que existiu — não ×4.
    await vi.waitFor(() => expect(mochilaDoUsoppNaPasta()).toEqual([['Poção', 3]]))

    // Marcado de novo (uma importação) e reaberto: a pilha igual à já decidida (×1 + ×1) não avisa nada.
    useToastStore.setState({ toasts: [] })
    await marcarMapaImportado('going-merry')
    expect(JSON.parse(falso.estado.arquivos.get(RELATORIO) ?? '{}').mapasPorConferir).toEqual(['going-merry'])
    await conferirMochilaAoAbrir(MERRY)
    expect(instrucoes()).toEqual([])
    expect(linhasDoRelatorio()).toHaveLength(2)
    expect(mochilaDoUsoppNaPasta()).toEqual([['Poção', 3]])
  })

  it('aventura já migrada: o que só a ficha do próprio mapa tem vira pendente antes do espelho, e o boneco velho de uma cena salva antes não vira outro', async () => {
    // A ficha própria do Usopp tem a Poção ×2; o boneco dele só está no Porão, salvo antes, ainda com a ×3 velha da mesma vaga.
    falso.estado.fichasDoMapa = [ficha('p_usopp', 'Usopp', { mochila: [POCAO_DO_USOPP] })]
    const aventura: Adventure = {
      version: 1,
      id: 'adv_merry',
      name: 'Going Merry',
      startSceneId: 'conves',
      scenes: [
        { id: 'conves', name: 'Convés', file: 'map.json' },
        { id: 'porao', name: 'Porão', file: 'scenes/porao/map.json' },
      ],
    }
    falso.estado.arquivos.set(`${MAPS}/going-merry/adventure.json`, serializeAdventure(aventura))
    const conves: MapData = { ...createEmptyMap('conves', 'Convés', 10, 10, 64), tokens: [boneco('Vendedor', null, { mochila: [CORDA] })] }
    const porao: MapData = { ...createEmptyMap('porao', 'Porão', 10, 10, 64), tokens: [boneco('Usopp', 'p_usopp', { mochila: [{ ...POCAO_DO_USOPP, quantidade: 3 }] })] }
    falso.estado.arquivos.set(MERRY, serializeMap(conves))
    falso.estado.arquivos.set(`${MAPS}/going-merry/scenes/porao/map.json`, serializeMap(porao))
    falso.estado.copia = { savedAtMs: 1, mapPath: MERRY, map: conves, scenes: {} }

    await trocarModoDoMapa(false)
    const aviso = 'Poção ×2 do boneco Usopp (Going Merry › ficha própria do mapa) não estão na mochila de Usopp.'
    expect(linhasDe(falso.estado.relatorioNoEspelho)).toHaveLength(1)
    expect(toasts()).toEqual([{ kind: 'instrucao', text: aviso }])
    for (const trazer of acoesDeTrazer([aviso])) trazer()
    await vi.waitFor(() => expect(mochilaDoUsoppNaPasta()).toEqual([['Poção', 3]]))
  })
})

describe('a volta do Sistema universal com o mapa da pasta aberto (trocarSistemaDaPasta)', () => {
  const comOnePiece = (rpg: RpgDaPasta): RpgDaPasta => rpgComSistema(rpg, SISTEMA_ONE_PIECE.id)
  /** O relatório no instante em que o rpg.json grava (o espelho esvazia o Usopp aberto). */
  let relatorioAoGravar: string | null = null

  /** O "Configurar pasta" como o app grava: o rpg.json com a mudança. */
  const gravarNoDisco = async (mudar: (rpg: RpgDaPasta) => RpgDaPasta): Promise<void> => {
    relatorioAoGravar = falso.estado.arquivos.get(RELATORIO) ?? ''
    falso.estado.arquivos.set(RPG, serializarRpg(mudar(rpgNoDisco())))
  }

  beforeEach(() => {
    relatorioAoGravar = null
    // Pasta convertida e sem sistema: no editor, o Usopp ganhou a Poção ×2 e a Corda, que a ficha da pasta não tem.
    falso.estado.arquivos.set(RPG, serializarRpg({ personagens: [ficha('p_luffy', 'Luffy'), USOPP], mochilaMigrada: 1 }))
  })

  it('a conferência de depois cai: os pendentes do mapa aberto já estavam no relatório antes do rpg.json, e aparecem; o erro diz o que vale', async () => {
    const gravar = async (mudar: (rpg: RpgDaPasta) => RpgDaPasta): Promise<void> => {
      await gravarNoDisco(mudar)
      falso.estado.relatorioTrava = true
    }
    await trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravar)
    expect(rpgNoDisco().sistemaDeRpg).toBe(SISTEMA_ONE_PIECE.id)
    expect(linhasDe(relatorioAoGravar)).toHaveLength(2)
    expect(JSON.parse(relatorioAoGravar ?? '{}').mapasPorConferir).toEqual(['going-merry'])
    const avisos = toasts()
    expect(avisos.filter((toast) => toast.kind === 'instrucao').map((toast) => toast.text)).toEqual(AVISOS)
    expect(avisos.filter((toast) => toast.kind === 'error')).toEqual([
      {
        kind: 'error',
        text: 'Não deu para conferir a mochila dos bonecos desta pasta (o disco travou). O que os bonecos do mapa aberto carregavam ficou anotado antes de a ficha valer nele; cada mapa da pasta salvo sem o sistema ficou marcado e confere ao abrir.',
      },
    ])
  })

  it('tudo certo: os avisos aparecem uma vez só, sem erro', async () => {
    await trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravarNoDisco)
    expect(toasts()).toEqual(AVISOS.map((text) => ({ kind: 'instrucao', text })))
    expect(linhasDoRelatorio()).toHaveLength(2)
  })

  it('não deu para anotar antes: recusa a troca, e o rpg.json fica sem sistema', async () => {
    falso.estado.relatorioTrava = true
    await expect(trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravarNoDisco)).rejects.toThrow(
      'O que os bonecos desta pasta carregam não pôde ser anotado (o disco travou): nada foi gravado, e o sistema não mudou.',
    )
    expect(relatorioAoGravar).toBeNull()
    expect(rpgNoDisco().sistemaDeRpg).toBeUndefined()
  })

  it('sem a cópia do trabalho aberto: recusa a troca', async () => {
    falso.estado.copia = null
    await expect(trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravarNoDisco)).rejects.toThrow('não deu para copiar o trabalho do mapa aberto')
    expect(rpgNoDisco().sistemaDeRpg).toBeUndefined()
  })

  it('o rpg.json não grava: lança, e os avisos falsos saem do relatório', async () => {
    const gravar = async (): Promise<void> => {
      throw new Error('sem espaço no disco')
    }
    await expect(trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravar)).rejects.toThrow('sem espaço no disco')
    expect(linhasDoRelatorio()).toEqual([])
    expect(toasts()).toEqual([])
  })

  it('a mudança que não traz sistema (copiar de um mapa sem sistema): nenhum pendente, porque o espelho não toca os bonecos', async () => {
    await trocarSistemaDaPasta(PASTA_ID, true, (rpg) => rpg, gravarNoDisco)
    expect(linhasDoRelatorio()).toEqual([])
    expect(toasts()).toEqual([])
  })

  it('fechar sem salvar depois da volta e reabrir: a mesma vaga continua UM pendente, com a pilha do disco', async () => {
    // No disco, a Poção ×2; no editor, sem salvar, o Usopp bebeu uma.
    falso.estado.copia = { savedAtMs: 1, mapPath: MERRY, map: goingMerry({ mochila: [UMA_POCAO_DO_USOPP] }), scenes: {} }
    await trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravarNoDisco)
    expect(toasts().map((toast) => toast.text)).toEqual(['Poção do boneco Usopp (Going Merry) não está na mochila de Usopp.'])
    const idsDoTrabalho = idsDoRelatorio()

    useToastStore.setState({ toasts: [] })
    await conferirMochilaAoAbrir(MERRY)
    expect(toasts().map((toast) => toast.text)).toEqual(['Poção ×2 do boneco Usopp (Going Merry) não estão na mochila de Usopp.'])
    expect(idsDoRelatorio()).toEqual(idsDoTrabalho)
  })

  it('aventura já migrada: o que só a ficha do próprio mapa tem (o boneco foi apagado) vira pendente antes do rpg.json', async () => {
    falso.estado.fichasDoMapa = [ficha('p_usopp', 'Usopp', { mochila: [POCAO_DO_USOPP] })]
    const semOUsopp: MapData = { ...createEmptyMap('merry', 'Going Merry', 10, 10, 64), tokens: [boneco('Vendedor', null, { mochila: [CORDA] })] }
    falso.estado.copia = { savedAtMs: 1, mapPath: MERRY, map: semOUsopp, scenes: {} }
    await trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravarNoDisco)
    expect(linhasDe(relatorioAoGravar)).toHaveLength(1)
    expect(toasts()).toEqual([{ kind: 'instrucao', text: 'Poção ×2 do boneco Usopp (Going Merry › ficha própria do mapa) não estão na mochila de Usopp.' }])
  })

  it('aventura já migrada e a ficha própria mudada sem salvar: a conferência logo depois da volta usa a ficha do editor, não a do disco', async () => {
    // No disco, a ficha própria do Usopp com a Poção ×2; no editor, sem salvar, ele bebeu uma. Nenhum boneco o mostra.
    falso.estado.fichasDoMapa = [ficha('p_usopp', 'Usopp', { mochila: [UMA_POCAO_DO_USOPP] })]
    const aventura: Adventure = {
      version: 1,
      id: 'adv_merry',
      name: 'Going Merry',
      startSceneId: 'conves',
      scenes: [{ id: 'conves', name: 'Convés', file: 'map.json' }],
      personagens: [ficha('p_usopp', 'Usopp', { mochila: [POCAO_DO_USOPP] })],
      mochilaMigrada: 1,
    }
    falso.estado.arquivos.set(`${MAPS}/going-merry/adventure.json`, serializeAdventure(aventura))
    const semOUsopp: MapData = { ...createEmptyMap('conves', 'Convés', 10, 10, 64), tokens: [boneco('Vendedor', null, { mochila: [CORDA] })] }
    falso.estado.arquivos.set(MERRY, serializeMap(semOUsopp))
    falso.estado.copia = { savedAtMs: 1, mapPath: MERRY, map: semOUsopp, scenes: {} }
    await trocarSistemaDaPasta(PASTA_ID, true, comOnePiece, gravarNoDisco)
    expect(toasts()).toEqual([{ kind: 'instrucao', text: 'Poção do boneco Usopp (Going Merry › ficha própria do mapa) não está na mochila de Usopp.' }])
    expect(linhasDoRelatorio()).toHaveLength(1)
  })
})
