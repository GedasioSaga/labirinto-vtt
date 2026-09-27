/**
 * A RELEITURA do acervo contra a tela adiantada (`stores/tokenLibraryStore.ts`).
 *
 * Mover um token de pasta e recolher uma pasta mudam a tela na hora
 * (`marcarPasta`, `marcarRecolhida`) e só depois gravam. `recarregar` relê o
 * disco e troca a lista da tela pelo que leu. Defeito achado em revisão
 * (27/09/2026): a releitura corria FORA da fila de gravação do índice e trocava
 * a lista sem conferir nada, então uma leitura que começou antes de um arrasto
 * devolvia o token para a pasta antiga na tela, com o disco certo. Arrastar de
 * volta virava "já está lá", e nada era gravado.
 *
 * Os handlers de App.tsx moram dentro do componente; `moverComoOApp` e
 * `recolherComoOApp` repetem o que eles fazem, passo por passo.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { IndiceLido } from '../lib/tokenLibrary'

/** Disco de mentira: caminho → conteúdo, o mesmo molde de `lib/tokenLibrary.test.ts`. */
const textos = new Map<string, string>()
const binarios = new Map<string, Uint8Array>()
const pastasDoDisco = new Set<string>()

const APPDATA = 'C:/Users/test/AppData/Roaming/labirinto'
const PASTA = `${APPDATA}/tokens`
const INDICE = `${PASTA}/acervo.json`

/**
 * Onde o teste segura o disco: na consulta "a foto ainda existe?" que a
 * leitura faz para CADA token (a janela do defeito, que cresce com o acervo),
 * ou na troca do índice gravado (o último passo de toda gravação).
 */
type PontoDeTrava = 'fotoExiste' | 'indiceTroca'

interface TravaArmada {
  ponto: PontoDeTrava
  avisarChegada: () => void
  soltura: Promise<void>
}

let travaArmada: TravaArmada | null = null

/**
 * Segura a PRIMEIRA operação que passar por `ponto` até o teste chamar
 * `soltar`. Uma vez só: as seguintes passam direto, e é isso que deixa a
 * operação concorrente andar enquanto a primeira está parada. Sem relógio: a
 * ordem dos passos é decidida pelo teste, não pela sorte do agendador.
 */
function armarTrava(ponto: PontoDeTrava): { chegou: Promise<void>; soltar: () => void } {
  let avisarChegada = (): void => {}
  let soltar = (): void => {}
  const chegou = new Promise<void>((resolve) => {
    avisarChegada = resolve
  })
  const soltura = new Promise<void>((resolve) => {
    soltar = resolve
  })
  travaArmada = { ponto, avisarChegada, soltura }
  return { chegou, soltar }
}

async function passarPelaTrava(ponto: PontoDeTrava): Promise<void> {
  const trava = travaArmada
  if (trava === null || trava.ponto !== ponto) return
  travaArmada = null
  trava.avisarChegada()
  await trava.soltura
}

vi.mock('@tauri-apps/api/core', () => ({
  // A store só relê o disco dentro do app de mesa; aqui o teste É o app de mesa.
  isTauri: vi.fn(() => true),
  invoke: vi.fn(async () => undefined),
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => {
    if (path.endsWith('.webp')) await passarPelaTrava('fotoExiste')
    return textos.has(path) || binarios.has(path) || pastasDoDisco.has(path)
  }),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = textos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  writeTextFile: vi.fn(async (path: string, data: string) => {
    textos.set(path, data)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    if (para === INDICE) await passarPelaTrava('indiceTroca')
    const conteudo = textos.get(de)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${de}`)
    textos.set(para, conteudo)
    textos.delete(de)
  }),
  mkdir: vi.fn(async (path: string) => {
    pastasDoDisco.add(path)
  }),
}))

/** O importador de imagem não entra nestes caminhos; o mock só evita carregar o de verdade. */
vi.mock('../lib/imageImport', () => ({
  importTokenImage: vi.fn(async () => ({ destPath: '', sourcePath: '' })),
  buildTokenSharedPhoto: vi.fn(async () => 'data:image/webp;base64,AAAA'),
}))

const { useTokenLibraryStore } = await import('./tokenLibraryStore')
const { apagarPastaDoAcervo, itensDoIndice, moverNoAcervo, recolherPastaNoAcervo, PASTA_NAO_ENCONTRADA } =
  await import('../lib/tokenLibrary')

/**
 * Índice no formato 2: as três pastas padrão, uma pasta vazia (a que o mestre
 * apaga) e dois tokens fora de pasta, com as fotos no disco.
 */
function semearAcervo(): void {
  const indice = {
    versao: 2,
    pastas: [
      { id: 'npcs', nome: 'NPCs' },
      { id: 'veiculos', nome: 'Veículos' },
      { id: 'jogadores', nome: 'Jogadores' },
      { id: 'vazia', nome: 'Pasta nova' },
    ],
    itens: [
      { id: 'goblin', nome: 'Goblin', tamanho: 1, arquivo: 'token_goblin.webp' },
      { id: 'bandido', nome: 'Bandido', tamanho: 1, arquivo: 'token_bandido.webp' },
    ],
  }
  textos.set(INDICE, JSON.stringify(indice, null, 2))
  for (const item of indice.itens) binarios.set(`${PASTA}/${item.arquivo}`, new Uint8Array([9]))
  pastasDoDisco.add(PASTA)
}

/** O índice gravado agora, lido pelo mesmo validador que o app usa ao abrir. */
function indiceGravado(): IndiceLido {
  const texto = textos.get(INDICE)
  if (texto === undefined) throw new Error('o acervo.json não está no disco')
  const indice = itensDoIndice(texto)
  if (indice === null) throw new Error('o acervo.json gravado não é um índice de acervo')
  return indice
}

function pastaGravada(itemId: string): string | null {
  const item = indiceGravado().itens.find((outro) => outro.id === itemId)
  if (item === undefined) throw new Error(`o token ${itemId} sumiu do disco`)
  return item.pasta
}

function pastaNaTela(itemId: string): string | null {
  const item = useTokenLibraryStore.getState().itens.find((outro) => outro.id === itemId)
  if (item === undefined) throw new Error(`o token ${itemId} sumiu da tela`)
  return item.pasta
}

function recolhidaGravada(pastaId: string): boolean {
  const pasta = indiceGravado().pastas.find((outra) => outra.id === pastaId)
  if (pasta === undefined) throw new Error(`a pasta ${pastaId} sumiu do disco`)
  return pasta.recolhida
}

function recolhidaNaTela(pastaId: string): boolean {
  const pasta = useTokenLibraryStore.getState().pastas.find((outra) => outra.id === pastaId)
  if (pasta === undefined) throw new Error(`a pasta ${pastaId} sumiu da tela`)
  return pasta.recolhida
}

/** O que `reportFileError` mostraria no App; aqui fica anotado para o teste conferir. */
const errosRelatados: unknown[] = []

/** `handleMoverNoAcervo` de App.tsx: marca na tela, grava, e só relê o disco se a gravação falhar. */
async function moverComoOApp(itemId: string, pasta: string | null): Promise<void> {
  useTokenLibraryStore.getState().marcarPasta(itemId, pasta)
  try {
    await moverNoAcervo(itemId, pasta)
  } catch (erro) {
    errosRelatados.push(erro)
    await useTokenLibraryStore.getState().recarregar()
  }
}

/** `handleRecolherPasta` de App.tsx, com o mesmo desenho. */
async function recolherComoOApp(pastaId: string, recolhida: boolean): Promise<void> {
  useTokenLibraryStore.getState().marcarRecolhida(pastaId, recolhida)
  try {
    await recolherPastaNoAcervo(pastaId, recolhida)
  } catch (erro) {
    errosRelatados.push(erro)
    await useTokenLibraryStore.getState().recarregar()
  }
}

beforeEach(async () => {
  textos.clear()
  binarios.clear()
  pastasDoDisco.clear()
  travaArmada = null
  errosRelatados.length = 0
  useTokenLibraryStore.setState({ itens: [], pastas: [], aviso: null, podeOrganizar: false })
  semearAcervo()
  // O painel aberto com o acervo como está no disco: o ponto de partida do mestre.
  await useTokenLibraryStore.getState().recarregar()
})

describe('recarregar contra a tela adiantada', () => {
  it('a releitura do "apagar pasta" que termina depois de um arrasto não devolve o token para a pasta antiga', async () => {
    // O mestre apaga a pasta vazia; o `finally` de handleApagarPasta relê o disco.
    await apagarPastaDoAcervo('vazia')
    const foto = armarTrava('fotoExiste')
    const releitura = useTokenLibraryStore.getState().recarregar()
    // A releitura já passou do índice e está no meio das fotos quando o
    // goblin é arrastado para NPCs.
    await foto.chegou
    const arrasto = moverComoOApp('goblin', 'npcs')
    foto.soltar()
    await Promise.all([releitura, arrasto])

    expect(errosRelatados).toEqual([])
    expect(pastaGravada('goblin')).toBe('npcs')
    expect(pastaNaTela('goblin')).toBe('npcs')
    // A pasta apagada sai da tela: a releitura foi aproveitada, não jogada fora.
    expect(useTokenLibraryStore.getState().pastas.map((pasta) => pasta.id)).toEqual(['npcs', 'veiculos', 'jogadores'])
  })

  it('a releitura de um arrasto recusado espera o arrasto seguinte terminar de gravar', async () => {
    const gravacao = armarTrava('indiceTroca')
    // Primeiro arrasto: para uma pasta que já não existe (apagada entre o menu
    // abrir e o clique). A gravação é recusada e o `catch` relê o disco.
    const recusado = moverComoOApp('goblin', 'pasta-apagada')
    // Segundo arrasto, logo atrás na fila: esse grava de verdade.
    const aceito = moverComoOApp('bandido', 'npcs')
    await gravacao.chegou
    // Tudo o que não depende da gravação travada anda até o fim antes da
    // soltura: é aqui que uma releitura fora da fila lê o disco de antes.
    await new Promise((resolve) => setTimeout(resolve, 0))
    gravacao.soltar()
    await Promise.all([recusado, aceito])

    expect(errosRelatados).toHaveLength(1)
    expect(String(errosRelatados[0])).toContain(PASTA_NAO_ENCONTRADA)
    expect(pastaGravada('bandido')).toBe('npcs')
    expect(pastaNaTela('bandido')).toBe('npcs')
    // O arrasto recusado volta atrás na tela, que é o trabalho desta releitura.
    expect(pastaNaTela('goblin')).toBeNull()
  })

  it('a releitura que termina depois de recolher uma pasta não reabre a pasta na tela', async () => {
    // Qualquer releitura serve (salvar, criar ou apagar pasta relêem no fim).
    const foto = armarTrava('fotoExiste')
    const releitura = useTokenLibraryStore.getState().recarregar()
    await foto.chegou
    const recolher = recolherComoOApp('npcs', true)
    foto.soltar()
    await Promise.all([releitura, recolher])

    expect(errosRelatados).toEqual([])
    expect(recolhidaGravada('npcs')).toBe(true)
    expect(recolhidaNaTela('npcs')).toBe(true)
  })
})
