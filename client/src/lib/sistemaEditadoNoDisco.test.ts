/**
 * O sistema EDITADO no disco (entrega 6): salvar e reler a biblioteca dá o
 * mesmo sistema; o embutido só muda por cópia; apagar tira o arquivo (e o de
 * mesmo id posto à mão); exportar e importar de volta dá o mesmo arquivo,
 * byte a byte.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  readFile: vi.fn(async () => new Uint8Array()),
  readDir: vi.fn(async (pasta: string) =>
    [...arquivos.keys()]
      .filter((caminho) => caminho.startsWith(`${pasta}/`))
      .map((caminho) => ({ name: caminho.slice(pasta.length + 1), isFile: true, isDirectory: false, isSymlink: false })),
  ),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
  }),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => 'C:/pendrive/casa.json'), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => true }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { apagarSistema, gravarSistema, importarSistema, listarSistemas } = await import('./bibliotecaDeSistemas')
const { salvarTextoJson } = await import('./arquivosDaFicha')
const { nomeDaCopia, rascunhoDaCopia, rascunhoDoSistema, sistemaDoRascunho } = await import('./editorDeSistema')
const { serializarSistema } = await import('./sistemaDeRpg')
const { SISTEMA_ONE_PIECE } = await import('./sistemaOnePiece')
const { useRpgStore } = await import('../stores/rpgStore')

const PASTA = 'C:/appdata/sistemas'

beforeEach(() => {
  arquivos.clear()
  useRpgStore.setState({ biblioteca: [SISTEMA_ONE_PIECE], avisosDaBiblioteca: [], bibliotecaLida: false })
})

/** O "Editar" do embutido: a cópia, com o nome mexido e a Força renomeada, salva pelo editor. */
async function salvarCopiaEditada() {
  const rascunho = rascunhoDaCopia(SISTEMA_ONE_PIECE, nomeDaCopia(SISTEMA_ONE_PIECE.nome, [SISTEMA_ONE_PIECE.nome]))
  const editado = { ...rascunho, nome: 'One Piece da Mesa', atributos: rascunho.atributos.map((atributo) => (atributo.id === 'forca' ? { ...atributo, nome: 'Poder' } : atributo)) }
  const resultado = sistemaDoRascunho(editado, new Set(useRpgStore.getState().biblioteca.map((sistema) => sistema.id)))
  if (!resultado.ok) throw new Error(resultado.erros.map((erro) => erro.texto).join(' | '))
  await useRpgStore.getState().salvarSistema(resultado.sistema)
  return resultado.sistema
}

describe('salvar e reler', () => {
  it('o sistema salvo pelo editor volta igual da pasta, e salvar de novo sobrescreve o MESMO arquivo', async () => {
    const salvo = await salvarCopiaEditada()
    expect(salvo.id).toBe('one-piece-da-mesa')
    expect([...arquivos.keys()].filter((caminho) => caminho.startsWith(`${PASTA}/`))).toEqual([`${PASTA}/one-piece-da-mesa.json`])
    expect((await listarSistemas()).sistemas).toEqual([SISTEMA_ONE_PIECE, salvo])

    // Segunda edição do mesmo sistema (o rascunho já travado): mesmo id, mesmo arquivo.
    const rascunho = rascunhoDoSistema(salvo)
    const resultado = sistemaDoRascunho({ ...rascunho, descricao: 'Regras da casa.' }, new Set([SISTEMA_ONE_PIECE.id, salvo.id]))
    if (!resultado.ok) throw new Error('a segunda edição deveria salvar')
    await useRpgStore.getState().salvarSistema(resultado.sistema)
    expect(resultado.sistema.id).toBe(salvo.id)
    const relida = await listarSistemas()
    expect(relida.sistemas.map((sistema) => [sistema.id, sistema.descricao])).toEqual([
      [SISTEMA_ONE_PIECE.id, SISTEMA_ONE_PIECE.descricao],
      [salvo.id, 'Regras da casa.'],
    ])
    expect(useRpgStore.getState().biblioteca.map((sistema) => sistema.id)).toEqual([SISTEMA_ONE_PIECE.id, salvo.id])
  })

  it('salvar troca o objeto na biblioteca: é a troca de referência que leva o sistema à sala', async () => {
    const salvo = await salvarCopiaEditada()
    const antes = useRpgStore.getState().biblioteca
    await useRpgStore.getState().salvarSistema({ ...salvo, versao: '2' })
    const depois = useRpgStore.getState().biblioteca
    expect(depois).not.toBe(antes)
    expect(depois.find((sistema) => sistema.id === salvo.id)).not.toBe(salvo)
  })
})

describe('o embutido não muda no lugar', () => {
  it('gravar por cima do One Piece é recusado; "Duplicar" grava a cópia com id próprio', async () => {
    await expect(gravarSistema({ ...SISTEMA_ONE_PIECE, nome: 'Outro' })).rejects.toThrow('vem com o Labirinto e não muda')
    expect(arquivos.size).toBe(0)
    const copia = await useRpgStore.getState().duplicarSistema(SISTEMA_ONE_PIECE)
    expect(copia).toEqual({ ...SISTEMA_ONE_PIECE, id: 'one-piece-copia', nome: 'One Piece (cópia)' })
    expect(arquivos.get(`${PASTA}/one-piece-copia.json`)).toBe(serializarSistema(copia))
    expect(useRpgStore.getState().biblioteca.map((sistema) => sistema.id)).toEqual(['one-piece', 'one-piece-copia'])
  })
})

describe('apagar', () => {
  it('tira o arquivo do sistema e o de mesmo id posto à mão com outro nome; os outros ficam', async () => {
    const salvo = await salvarCopiaEditada()
    arquivos.set(`${PASTA}/copia-manual.json`, serializarSistema(salvo))
    arquivos.set(`${PASTA}/outro.json`, serializarSistema({ ...salvo, id: 'outro', nome: 'Outro' }))
    arquivos.set(`${PASTA}/quebrado.json`, '{ não é json')
    await useRpgStore.getState().apagarSistema(salvo.id)
    expect([...arquivos.keys()].filter((caminho) => caminho.startsWith(`${PASTA}/`)).sort()).toEqual([`${PASTA}/outro.json`, `${PASTA}/quebrado.json`])
    expect(useRpgStore.getState().biblioteca.map((sistema) => sistema.id)).toEqual(['one-piece'])
  })

  it('o embutido não sai; id torto não vira caminho', async () => {
    await expect(apagarSistema('one-piece')).rejects.toThrow('não pode ser apagado')
    await expect(apagarSistema('../maps')).rejects.toThrow('não serve de nome de arquivo')
  })
})

describe('exportar e importar', () => {
  it('o arquivo exportado é o da biblioteca, e importá-lo de volta dá o mesmo sistema e o mesmo arquivo', async () => {
    const salvo = await salvarCopiaEditada()
    const daBiblioteca = arquivos.get(`${PASTA}/${salvo.id}.json`)
    expect(await salvarTextoJson('Exportar', 'Sistema de RPG', salvo.id, serializarSistema(salvo))).toBe(true)
    const exportado = arquivos.get('C:/pendrive/casa.json')
    expect(exportado).toBe(daBiblioteca)
    if (exportado === undefined) return

    // Outro computador: biblioteca vazia, o arquivo entra pelo "Importar arquivo…".
    arquivos.clear()
    expect(await importarSistema(exportado)).toEqual(salvo)
    expect(arquivos.get(`${PASTA}/${salvo.id}.json`)).toBe(exportado)
  })
})
