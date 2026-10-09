/**
 * CONTAS DOS JOGADORES no disco e na store: criar grava em
 * `appData/contas/contas.json` só hashes (nunca o PIN); a store relida
 * reencontra as mesmas contas; o arquivo ilegível vira `.invalido` e as
 * contas recomeçam vazias; o de uma versão mais nova não é regravado por cima.
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
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
  }),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => true }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

const { lerContas } = await import('./contasNoDisco')
const { useContasStore } = await import('../stores/contasStore')

const CAMINHO = 'C:/appdata/contas/contas.json'

describe('contas no disco', () => {
  beforeEach(() => {
    arquivos.clear()
  })

  it('sem arquivo: nenhuma conta, e dá para gravar', async () => {
    await expect(lerContas()).resolves.toEqual({ arquivo: { soComConta: false, contas: [] }, aviso: null, lido: true })
  })

  it('criar e trocar o PIN gravam só hashes; relida, a conta volta igual; nome repetido é recusado', async () => {
    await useContasStore.getState().recarregar()
    await useContasStore.getState().criarConta('  Ana ', '135790')
    const gravado = arquivos.get(CAMINHO) ?? ''
    expect(gravado).toContain('"nome": "Ana"')
    expect(gravado).not.toContain('135790')
    await expect(useContasStore.getState().criarConta('ANA', '2468')).rejects.toThrow('Já existe uma conta com esse nome.')
    const [ana] = useContasStore.getState().arquivo.contas
    await useContasStore.getState().trocarPin(ana.id, '864200')
    expect(arquivos.get(CAMINHO)).not.toContain('864200')
    expect(arquivos.get(`${CAMINHO}.anterior`)).toBe(gravado)
    const relidas = await lerContas()
    expect(relidas.arquivo).toEqual(useContasStore.getState().arquivo)
  })

  it('arquivo ilegível vira .invalido e as contas recomeçam vazias', async () => {
    arquivos.set(CAMINHO, '{ quebrado')
    const lidas = await lerContas()
    expect(lidas).toMatchObject({ arquivo: { soComConta: false, contas: [] }, lido: true })
    expect(arquivos.get(`${CAMINHO}.invalido`)).toBe('{ quebrado')
  })

  it('arquivo de versão mais nova: lido como vazio e a store NÃO grava por cima', async () => {
    const futuro = JSON.stringify({ formato: 99, contas: [] })
    arquivos.set(CAMINHO, futuro)
    await useContasStore.getState().recarregar()
    expect(useContasStore.getState().podeGravar).toBe(false)
    await expect(useContasStore.getState().criarConta('Bia', '1234')).rejects.toThrow()
    expect(arquivos.get(CAMINHO)).toBe(futuro)
  })
})
