/**
 * A BIBLIOTECA DE SONS NA MEMÓRIA (`stores/bibliotecaDeSonsStore.ts`), GLOBAL
 * desde 29/10/2026: uma só em `<appData>/sons`, em qualquer aventura; grava
 * sozinha 400 ms depois da última mudança, fora do Ctrl+Z e sem deixar o mapa
 * "não salvo"; o `sons.json` de cada aventura migra UMA vez, sem repetir som
 * e sem ser apagado; o áudio importado vai para `<appData>/sons/midia`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('../lib/sons/discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('../lib/sons/discoFalso.fixture')).pathFalso)

const { APPDATA, arquivos, bytesDe, criarPastasAte, fsFalso, limparDisco, MIDIA_DO_APP, textoDe, wav } = await import('../lib/sons/discoFalso.fixture')
const { useToastStore } = await import('./toastStore')
const { hasUnsavedWork, useAdventureStore } = await import('./adventureStore')
const { idDoAudio, refDoId } = await import('../lib/midia')
const { ehVideoDoYoutube, bibliotecaDeSonsVazia, bibliotecaDoTexto, comEfeitoNovo, comPastaNova, serializarBiblioteca } = await import('../lib/sons/biblioteca')
const { ESPERA_PARA_GRAVAR_SONS_MS, ligarBibliotecaGlobal, SONS_AINDA_LENDO, SONS_NAO_GRAVAVEIS, useBibliotecaDeSonsStore } = await import('./bibliotecaDeSonsStore')
type FonteDoSom = import('../lib/sons/biblioteca').FonteDoSom
type BibliotecaDeSons = import('../lib/sons/biblioteca').BibliotecaDeSons

const GLOBAL = `${APPDATA}/sons`
const SONS_GLOBAL = `${GLOBAL}/sons.json`
const MIGRACAO = `${GLOBAL}/migracao.json`
const NAVIO = `${APPDATA}/maps/map_navio`
const PORTO = `${APPDATA}/maps/map_porto`
const FORA = 'C:/aventuras/castelo'

function youtube(video: string, inicioS?: number): FonteDoSom {
  if (!ehVideoDoYoutube(video)) throw new Error(`vídeo inválido no teste: ${video}`)
  return inicioS === undefined ? { tipo: 'youtube', video } : { tipo: 'youtube', video, inicioS }
}

/** Uma biblioteca de aventura: a categoria Batalha em Músicas e os sons dados, nela. */
function bibliotecaDaAventura(sons: { id: string; nome: string; fonte: FonteDoSom; loop?: boolean }[], sugeridas = false): BibliotecaDeSons {
  const comPasta = comPastaNova(bibliotecaDeSonsVazia(), 'Batalha', `pasta_${sons[0]?.id ?? 'x'}`, 'musicas')
  if (comPasta === null) throw new Error('o teste não montou a pasta')
  let biblioteca: BibliotecaDeSons = sugeridas ? { ...comPasta.biblioteca, categoriasSugeridas: true } : comPasta.biblioteca
  for (const som of sons) {
    const passo = comEfeitoNovo(biblioteca, { nome: som.nome, fonte: som.fonte, loop: som.loop ?? false, pastaId: comPasta.pasta.id, parte: 'musicas' }, som.id)
    if (passo === null) throw new Error(`o teste não montou o som ${som.id}`)
    biblioteca = passo.biblioteca
  }
  return biblioteca
}

function aventuraNoDisco(pasta: string, biblioteca: BibliotecaDeSons): void {
  criarPastasAte(pasta)
  arquivos.set(`${pasta}/adventure.json`, '{}')
  arquivos.set(`${pasta}/sons.json`, serializarBiblioteca(biblioteca))
}

function globalNoDisco(): BibliotecaDeSons {
  const lido = bibliotecaDoTexto(textoDe(SONS_GLOBAL))
  if (!lido.ok) throw new Error('o sons.json global não é legível')
  return lido.biblioteca
}

const loja = () => useBibliotecaDeSonsStore.getState()
const nomes = () => loja().biblioteca.efeitos.map((efeito) => efeito.nome)

beforeEach(() => {
  limparDisco()
  criarPastasAte(`${APPDATA}/maps`)
  useToastStore.setState({ toasts: [] })
  useBibliotecaDeSonsStore.setState(useBibliotecaDeSonsStore.getInitialState())
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  useAdventureStore.setState({ adventure: null, dir: null })
})

describe('leitura e salvamento sozinho', () => {
  it('nasce lendo (nada muda antes da primeira leitura); sem sons.json global abre vazia com as categorias sugeridas e a pasta pronta', async () => {
    expect(loja().adicionarEfeito({ nome: 'Cedo', fonte: youtube('dQw4w9WgXcQ') })).toBeNull()
    await loja().carregar()
    expect(loja()).toMatchObject({ carregando: false, podeGravar: true, aviso: null, pasta: GLOBAL })
    expect(loja().biblioteca.pastas.map((pasta) => pasta.nome)).toEqual(['Ambiente', 'Batalha', 'Taverna', 'Combate', 'Magia', 'Natureza'])
    // Só as sugestões: nada vai para o disco até a primeira mudança do mestre.
    expect(arquivos.has(SONS_GLOBAL)).toBe(false)
  })

  it(`grava ${ESPERA_PARA_GRAVAR_SONS_MS} ms depois da ÚLTIMA mudança, uma vez só, em <appData>/sons, sem sujar o mapa`, async () => {
    await loja().carregar()
    expect(hasUnsavedWork()).toBe(false)
    loja().adicionarEfeito({ nome: 'Sino', fonte: youtube('dQw4w9WgXcQ') })
    loja().adicionarEfeito({ nome: 'Ondas', fonte: youtube('aaaaaaaaaaa') })
    expect(loja().pendente).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_PARA_GRAVAR_SONS_MS)
    expect(fsFalso.writeTextFile.mock.calls.filter(([caminho]) => caminho === `${SONS_GLOBAL}.tmp`)).toHaveLength(1)
    expect(globalNoDisco().efeitos.map((efeito) => efeito.nome)).toEqual(['Sino', 'Ondas'])
    expect(hasUnsavedWork()).toBe(false)
  })

  it('sons.json global de versão mais nova: mostra vazio, recusa mudar e não grava por cima', async () => {
    criarPastasAte(GLOBAL)
    arquivos.set(SONS_GLOBAL, JSON.stringify({ versao: 2, pastas: [], efeitos: [] }))
    await loja().carregar()
    expect(loja()).toMatchObject({ podeGravar: false, carregando: false })
    expect(loja().criarPasta('Nova')).toBeNull()
    await expect(loja().importarArquivoDeSom('a.wav', wav(64, 1))).rejects.toThrow(SONS_NAO_GRAVAVEIS)
    expect(textoDe(SONS_GLOBAL)).toContain('"versao":2')
  })

  it('importar enquanto lê é recusado com a frase pronta', async () => {
    await expect(loja().importarArquivoDeSom('a.wav', wav(64, 1))).rejects.toThrow(SONS_AINDA_LENDO)
  })

  it('o áudio importado vai para <appData>/sons/midia, e não para <appData>/midia', async () => {
    await loja().carregar()
    const bytes = wav(64, 9)
    const id = await idDoAudio(bytes)
    if (id === null) throw new Error('bytes de teste')
    const efeito = await loja().importarArquivoDeSom('C:/Users/x/trovão.wav', bytes)
    expect(efeito.nome).toBe('trovão')
    expect(bytesDe(`${GLOBAL}/midia/${id}`)).toEqual(bytes)
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
  })
})

describe('migração das aventuras', () => {
  it('as aventuras de <appData>/maps entram uma vez, sem repetir o mesmo vídeo, com parte, categoria e repetir; o sons.json delas fica', async () => {
    const navio = bibliotecaDaAventura([
      { id: 'som_a', nome: 'Abertura', fonte: youtube('aaaaaaaaaaa'), loop: false },
      { id: 'som_b', nome: 'Duelo', fonte: youtube('bbbbbbbbbbb'), loop: true },
    ])
    const porto = bibliotecaDaAventura([
      { id: 'som_c', nome: 'Duelo de novo', fonte: youtube('bbbbbbbbbbb'), loop: true },
      { id: 'som_d', nome: 'Duelo do meio', fonte: youtube('bbbbbbbbbbb', 90), loop: true },
    ])
    aventuraNoDisco(NAVIO, navio)
    aventuraNoDisco(PORTO, porto)
    const textoDoNavio = textoDe(`${NAVIO}/sons.json`)

    await loja().carregar()
    // Mesmo vídeo com o mesmo trecho é um som só; o mesmo vídeo em outro trecho é outro som.
    expect(nomes().sort()).toEqual(['Abertura', 'Duelo', 'Duelo do meio'])
    const batalhas = loja().biblioteca.pastas.filter((pasta) => pasta.nome === 'Batalha')
    expect(batalhas).toHaveLength(1)
    expect(batalhas[0]?.parte).toBe('musicas')
    expect(loja().biblioteca.efeitos.every((efeito) => efeito.parte === 'musicas' && efeito.pastaId === batalhas[0]?.id)).toBe(true)
    expect(loja().biblioteca.efeitos.find((efeito) => efeito.nome === 'Duelo')?.loop).toBe(true)
    expect(loja().biblioteca.efeitos.find((efeito) => efeito.nome === 'Abertura')?.loop).toBe(false)
    // Gravou a global e anotou as duas; a pasta da aventura não foi escrita.
    expect(globalNoDisco().efeitos).toHaveLength(3)
    expect(textoDe(MIGRACAO)).toContain('map_navio')
    expect(textoDe(MIGRACAO)).toContain('map_porto')
    expect(textoDe(`${NAVIO}/sons.json`)).toBe(textoDoNavio)
    expect(fsFalso.writeTextFile.mock.calls.some(([caminho]) => caminho.startsWith(`${APPDATA}/maps/`))).toBe(false)

    // O mestre apaga um som da global; ao abrir de novo ele não volta da aventura.
    const duelo = loja().biblioteca.efeitos.find((efeito) => efeito.nome === 'Duelo')
    if (duelo === undefined) throw new Error('o Duelo não entrou')
    loja().apagarEfeito(duelo.id)
    await loja().gravarAgora()
    useBibliotecaDeSonsStore.setState(useBibliotecaDeSonsStore.getInitialState())
    await loja().carregar()
    expect(nomes().sort()).toEqual(['Abertura', 'Duelo do meio'])
  })

  it('a marca de categorias sugeridas da aventura vem junto: a sugerida apagada lá não volta, e a de mesmo nome não se repete', async () => {
    aventuraNoDisco(NAVIO, bibliotecaDaAventura([{ id: 'som_a', nome: 'Abertura', fonte: youtube('aaaaaaaaaaa') }], true))
    await loja().carregar()
    expect(loja().biblioteca.categoriasSugeridas).toBe(true)
    expect(loja().biblioteca.pastas.map((pasta) => pasta.nome)).toEqual(['Batalha'])
  })

  it('o áudio de arquivo vai da midia da aventura para a da biblioteca, conferido', async () => {
    const bytes = wav(64, 5)
    const id = await idDoAudio(bytes)
    if (id === null) throw new Error('bytes de teste')
    aventuraNoDisco(NAVIO, bibliotecaDaAventura([{ id: 'som_a', nome: 'Sino', fonte: { tipo: 'arquivo', ref: refDoId(id), bytes: 64 } }]))
    criarPastasAte(`${NAVIO}/midia`)
    arquivos.set(`${NAVIO}/midia/${id}`, bytes)
    await loja().carregar()
    expect(bytesDe(`${GLOBAL}/midia/${id}`)).toEqual(bytes)
    expect(bytesDe(`${NAVIO}/midia/${id}`)).toEqual(bytes)
  })

  it('a aventura aberta de outra pasta migra quando abre, uma vez', async () => {
    aventuraNoDisco(FORA, bibliotecaDaAventura([{ id: 'som_x', nome: 'Muralha', fonte: youtube('xxxxxxxxxxx') }]))
    const desligar = ligarBibliotecaGlobal()
    try {
      await loja().carregar()
      expect(nomes()).toEqual([])
      useAdventureStore.setState({ dir: FORA })
      await vi.waitFor(() => expect(nomes()).toEqual(['Muralha']))
      await vi.waitFor(() => expect(textoDe(MIGRACAO)).toContain('c:/aventuras/castelo'))
      await loja().migrarAventura(FORA)
      expect(nomes()).toEqual(['Muralha'])
    } finally {
      desligar()
    }
  })

  it('sons.json de aventura ilegível não migra nem é copiado na pasta dela', async () => {
    criarPastasAte(NAVIO)
    arquivos.set(`${NAVIO}/sons.json`, '{ quebrado')
    await loja().carregar()
    expect(nomes()).toEqual([])
    expect([...arquivos.keys()].filter((caminho) => caminho.startsWith(`${NAVIO}/`))).toEqual([`${NAVIO}/sons.json`])
  })
})
