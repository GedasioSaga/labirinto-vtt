/**
 * BIBLIOTECA DE SISTEMAS no disco do app (`<appData>/sistemas/<id>.json`):
 * o One Piece está sempre lá, o arquivo ilegível vira aviso sem derrubar a
 * grade, e importar grava sem sobrescrever o embutido.
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
  readDir: vi.fn(async (pasta: string) =>
    [...arquivos.keys()]
      .filter((caminho) => caminho.startsWith(`${pasta}/`))
      .map((caminho) => ({ name: caminho.slice(pasta.length + 1), isFile: true, isDirectory: false, isSymlink: false })),
  ),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { importarSistema, listarSistemas, sistemaParaGravar } = await import('./bibliotecaDeSistemas')
const { SISTEMA_ONE_PIECE } = await import('./sistemaOnePiece')
const { serializarSistema } = await import('./sistemaDeRpg')

const PASTA = 'C:/appdata/sistemas'
const CASA = { id: 'casa', nome: 'Sistema da Casa', versao: '2', atributos: [{ id: 'for', nome: 'Força' }] }

beforeEach(() => {
  arquivos.clear()
})

describe('listarSistemas', () => {
  it('primeira execução (sem pasta): só o One Piece, sem aviso', async () => {
    expect(await listarSistemas()).toEqual({ sistemas: [SISTEMA_ONE_PIECE], avisos: [] })
  })

  it('lê os .json da pasta depois dos embutidos; o ilegível vira aviso com o nome do arquivo', async () => {
    arquivos.set(PASTA, '<pasta>')
    arquivos.set(`${PASTA}/casa.json`, JSON.stringify(CASA))
    arquivos.set(`${PASTA}/quebrado.json`, '{nada')
    arquivos.set(`${PASTA}/leia-me.txt`, 'não é sistema')
    // Arquivo com o id do embutido não toma o lugar dele.
    arquivos.set(`${PASTA}/falso.json`, JSON.stringify({ ...CASA, id: 'one-piece', nome: 'Falso' }))
    const { sistemas, avisos } = await listarSistemas()
    expect(sistemas.map((sistema) => sistema.nome)).toEqual(['One Piece', 'Sistema da Casa'])
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain('quebrado.json')
  })
})

describe('importarSistema', () => {
  it('grava o arquivo na pasta pelo id e devolve o sistema lido', async () => {
    const sistema = await importarSistema(JSON.stringify(CASA))
    expect(sistema.nome).toBe('Sistema da Casa')
    expect(arquivos.get(`${PASTA}/casa.json`)).toBe(serializarSistema(sistema))
  })

  it('id do embutido vira "-importado"; reimportar o mesmo arquivo atualiza a cópia em vez de empilhar', async () => {
    const texto = serializarSistema({ ...SISTEMA_ONE_PIECE, versao: '2' })
    const primeira = await importarSistema(texto)
    const segunda = await importarSistema(texto)
    expect(primeira.id).toBe('one-piece-importado')
    expect(primeira.nome).toBe('One Piece (importado)')
    expect(segunda.id).toBe(primeira.id)
    expect([...arquivos.keys()].filter((caminho) => caminho.endsWith('.json'))).toEqual([`${PASTA}/one-piece-importado.json`])
  })

  it('arquivo que não é sistema lança com a razão e não grava nada', async () => {
    await expect(importarSistema('{"id":"x"}')).rejects.toThrow('não é um sistema de RPG')
    expect([...arquivos.keys()]).toEqual([])
  })

  it('sistemaParaGravar não mexe em id que não é de embutido', () => {
    const sistema = { ...SISTEMA_ONE_PIECE, id: 'outro' }
    expect(sistemaParaGravar(sistema, new Set(['one-piece']))).toBe(sistema)
  })
})
