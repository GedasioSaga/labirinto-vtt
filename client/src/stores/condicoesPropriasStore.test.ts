/**
 * A LISTA DE CONDIÇÕES CRIADAS NA PASTA ABERTA: gravada no `condicoes.json` ao
 * lado do arquivo das fichas e relida igual; lixo no arquivo não derruba; a
 * lista que estava neste computador migra para a pasta uma vez só. Dados
 * inventados; o disco é um mapa em memória.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CondicaoPropria } from '../types/map'

const arquivos = new Map<string, string>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    arquivos.set(path, data)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
    arquivos.delete(from)
  }),
  mkdir: vi.fn(async (path: string) => {
    arquivos.set(path, '<pasta>')
  }),
  exists: vi.fn(async (path: string) => arquivos.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
  }),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => true }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useCondicoesPropriasStore, lugarDasCondicoesAberto } = await import('./condicoesPropriasStore')
const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { ARQUIVO_DAS_CONDICOES, serializarCondicoes } = await import('../lib/condicoesNoDisco')

const CHAVE_DO_COMPUTADOR = 'lb-condicoes-proprias'
const QUEIMANDO: CondicaoPropria = { id: 'cond_queimando', nome: 'Queimando', cor: '#ff8a5c', simbolo: 'chama' }
const MARCADO: CondicaoPropria = { id: 'cond_marcado', nome: 'Marcado', cor: '#7fb8f0', simbolo: 'alvo', texto: '🎯M' }

const PASTA_DE_GOA = 'C:/appdata/pastas/pasta_goa'
const PASTA_DO_FAROL = 'C:/appdata/maps/farol'
const NA_PASTA_DE_GOA = { chave: 'pasta:pasta_goa', pasta: async () => PASTA_DE_GOA }
const NA_PASTA_DO_FAROL = { chave: `aventura:${PASTA_DO_FAROL}`, pasta: async () => PASTA_DO_FAROL }
const NO_COMPUTADOR = { chave: 'computador', pasta: null }
const ARQUIVO_DE_GOA = `${PASTA_DE_GOA}/${ARQUIVO_DAS_CONDICOES}`
const ARQUIVO_DO_FAROL = `${PASTA_DO_FAROL}/${ARQUIVO_DAS_CONDICOES}`

const loja = () => useCondicoesPropriasStore.getState()

function condicoesGravadasEm(caminho: string): unknown {
  const texto = arquivos.get(caminho)
  return texto === undefined ? undefined : JSON.parse(texto).condicoes
}

beforeEach(async () => {
  arquivos.clear()
  window.localStorage.clear()
  // Um lugar só do teste, sem pasta: a lista recomeça do computador (vazio) e nenhuma pasta de antes fica ligada.
  await loja().mudarDeLugar({ chave: 'reinicio', pasta: null })
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 30, 20, 64))
})

describe('a lista de condições criadas mora na pasta aberta', () => {
  it('criar grava no condicoes.json da pasta, com a cópia de antes; reabrir a pasta traz a lista igual', async () => {
    await loja().mudarDeLugar(NA_PASTA_DE_GOA)
    expect(loja().salvar(QUEIMANDO)).toBe(true)
    await vi.waitFor(() => expect(condicoesGravadasEm(ARQUIVO_DE_GOA)).toEqual([QUEIMANDO]))
    expect(loja().salvar(MARCADO)).toBe(true)
    await vi.waitFor(() => expect(condicoesGravadasEm(ARQUIVO_DE_GOA)).toEqual([QUEIMANDO, MARCADO]))
    expect(condicoesGravadasEm(`${ARQUIVO_DE_GOA}.anterior`)).toEqual([QUEIMANDO])
    // A pasta é a fonte: nada disto foi para o armazenamento do computador.
    expect(window.localStorage.getItem(CHAVE_DO_COMPUTADOR)).toBeNull()

    await loja().mudarDeLugar(NO_COMPUTADOR)
    expect(loja().catalogo).toEqual([])
    await loja().mudarDeLugar(NA_PASTA_DE_GOA)
    expect(loja().catalogo).toEqual([QUEIMANDO, MARCADO])
  })

  it('lixo no arquivo não derruba: volta a cópia anterior; sem cópia, o lixo é posto de lado e a lista recomeça', async () => {
    arquivos.set(ARQUIVO_DE_GOA, '{ quebrado')
    arquivos.set(`${ARQUIVO_DE_GOA}.anterior`, serializarCondicoes([QUEIMANDO]))
    await loja().mudarDeLugar(NA_PASTA_DE_GOA)
    expect(loja().catalogo).toEqual([QUEIMANDO])

    // Arquivo que abre, com uma condição torta no meio: só ela fica de fora.
    arquivos.set(ARQUIVO_DO_FAROL, JSON.stringify({ versao: 1, condicoes: [MARCADO, { id: 'sem nome' }, 'lixo'] }))
    await loja().mudarDeLugar(NA_PASTA_DO_FAROL)
    expect(loja().catalogo).toEqual([MARCADO])

    arquivos.set(ARQUIVO_DO_FAROL, 'isto não é json')
    await loja().mudarDeLugar(NO_COMPUTADOR)
    await loja().mudarDeLugar(NA_PASTA_DO_FAROL)
    expect(loja().catalogo).toEqual([])
    expect(arquivos.get(`${ARQUIVO_DO_FAROL}.invalido`)).toBe('isto não é json')
    // E a pasta volta a gravar por cima do arquivo que foi posto de lado.
    expect(loja().salvar(QUEIMANDO)).toBe(true)
    await vi.waitFor(() => expect(condicoesGravadasEm(ARQUIVO_DO_FAROL)).toEqual([QUEIMANDO]))
  })

  it('migração: a lista do computador entra na pasta que ainda não tem arquivo, uma vez só, e não some do computador', async () => {
    window.localStorage.setItem(CHAVE_DO_COMPUTADOR, JSON.stringify([QUEIMANDO, MARCADO]))
    await loja().mudarDeLugar(NA_PASTA_DE_GOA)
    expect(loja().catalogo).toEqual([QUEIMANDO, MARCADO])
    expect(condicoesGravadasEm(ARQUIVO_DE_GOA)).toEqual([QUEIMANDO, MARCADO])

    loja().excluir(QUEIMANDO.id)
    await vi.waitFor(() => expect(condicoesGravadasEm(ARQUIVO_DE_GOA)).toEqual([MARCADO]))
    // O computador continua com as duas (é a lista do mapa solto)...
    await loja().mudarDeLugar(NO_COMPUTADOR)
    expect(loja().catalogo).toEqual([QUEIMANDO, MARCADO])
    // ...mas a pasta já tem o arquivo: a excluída não volta.
    await loja().mudarDeLugar(NA_PASTA_DE_GOA)
    expect(loja().catalogo).toEqual([MARCADO])
    expect(condicoesGravadasEm(ARQUIVO_DE_GOA)).toEqual([MARCADO])
  })

  it('o lugar segue o que está aberto: a pasta do Carregar Mapa, a pasta da aventura, ou o computador', async () => {
    expect(lugarDasCondicoesAberto().chave).toBe('computador')

    // Aventura salva, fora de pasta: a lista fica ao lado do adventure.json.
    useAdventureStore.getState().createScene('Cripta', null)
    expect(lugarDasCondicoesAberto().chave).toBe('computador')
    useAdventureStore.setState({ dir: PASTA_DO_FAROL })
    const daAventura = lugarDasCondicoesAberto()
    expect(daAventura.chave).toBe(`aventura:${PASTA_DO_FAROL}`)
    await expect(daAventura.pasta?.()).resolves.toBe(PASTA_DO_FAROL)

    // O mapa entrou numa pasta do Carregar Mapa: a lista é da pasta, ao lado do rpg.json.
    useAdventureStore.setState({ pasta: { chave: 'adv_goa', pastaId: 'pasta_goa', nome: 'Reino de Goa', proprio: false, personagens: [] } })
    const daPasta = lugarDasCondicoesAberto()
    expect(daPasta.chave).toBe('pasta:pasta_goa')
    await expect(daPasta.pasta?.()).resolves.toBe(PASTA_DE_GOA)
  })
})
