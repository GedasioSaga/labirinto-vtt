/**
 * MOCHILA NA FICHA — a cola do app do "Importar personagens…"/"Copiar de um
 * mapa" (`fichasEntramNaPasta`) com o mapa da pasta ABERTO no editor: o
 * espelho esvazia os bonecos dele assim que o `rpg.json` grava, então o
 * pendente tem de estar no relatório antes. O Tauri, o store do editor e a
 * cópia do trabalho são falsos; o disco é um mapa em memória montado como uma
 * cópia do appData. Nunca toca o disco de verdade. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { serializeMap } from '../../lib/mapFile'
import { rpgDoArquivo, serializarIndice, serializarRpg, type RpgDaPasta } from '../../lib/pastasDeMapas'
import { novoPersonagem, type Personagem } from '../../lib/personagem'
import type { RecoveryCopy } from '../../lib/recoveryCopy'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { useToastStore } from '../../stores/toastStore'
import type { CarriedItem, MapData, Token } from '../../types/map'
import type { DiscoDaMigracao } from './migracaoDaMochila'
import { fichasEntramNaPasta } from './mochilaPendenteNoApp'

const falso = vi.hoisted(() => {
  const APPDATA = 'C:/appdata'
  const estado: { arquivos: Map<string, string>; relatorioTrava: boolean; copia: RecoveryCopy | null } = { arquivos: new Map(), relatorioTrava: false, copia: null }
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
  return { APPDATA, estado, disco }
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
  useAdventureStore: { getState: () => ({ pasta: { chave: 'going-merry', pastaId: 'pasta_one-piece', nome: 'One Piece', proprio: false, personagens: [] } }) },
}))

const PASTA_ID = 'pasta_one-piece'
const MAPS = `${falso.APPDATA}/maps`
const RPG = `${falso.APPDATA}/pastas/${PASTA_ID}/rpg.json`
const RELATORIO = `${falso.APPDATA}/pastas/${PASTA_ID}/migracao-da-mochila.json`
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

function linhasDoRelatorio(): unknown[] {
  const texto = falso.estado.arquivos.get(RELATORIO)
  if (texto === undefined) return []
  const linhas: unknown = JSON.parse(texto).itensDeMapasQueEntraram
  return Array.isArray(linhas) ? linhas : []
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
  arquivos.set(`${falso.APPDATA}/pastas/indice.json`, serializarIndice({ pastas: [{ id: PASTA_ID, nome: 'One Piece' }], mapas: [{ chave: 'going-merry', pastaId: PASTA_ID }] }))
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
