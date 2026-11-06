/**
 * FILA ÚNICA DA PASTA (A5, revisão): o gravador leve do Lobby e o
 * ler-mudar-gravar do `editarRpgDaPasta` nunca se intercalam no `rpg.json` —
 * senão a mudança remota que o gravador grava no meio some por baixo da
 * gravação do outro. O disco é um mapa em memória atrás do Tauri falso.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const APPDATA = 'C:/appdata'
const textos = new Map<string, string>()

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...partes: string[]) => partes.join('/')),
  dirname: vi.fn(async (caminho: string) => caminho.slice(0, caminho.lastIndexOf('/'))),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (caminho: string) => textos.has(caminho)),
  mkdir: vi.fn(async () => undefined),
  readTextFile: vi.fn(async (caminho: string) => {
    const texto = textos.get(caminho)
    if (texto === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return texto
  }),
  writeTextFile: vi.fn(async (caminho: string, texto: string) => {
    textos.set(caminho, texto)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const texto = textos.get(de)
    if (texto === undefined) throw new Error(`arquivo não existe: ${de}`)
    textos.set(para, texto)
    textos.delete(de)
  }),
  remove: vi.fn(async (caminho: string) => {
    textos.delete(caminho)
  }),
  readDir: vi.fn(async (caminho: string) => {
    throw new Error(`não deu para listar ${caminho}`)
  }),
  readFile: vi.fn(async () => new Uint8Array()),
  writeFile: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
  stat: vi.fn(async (caminho: string) => {
    throw new Error(`não existe: ${caminho}`)
  }),
}))

const { editarRpgDaPasta } = await import('../../stores/rpgDaPasta')
const { gravarRpgDaPasta, lerRpgDaPasta, novoIdDePasta } = await import('../../lib/pastasDeMapas')
const { gravarRpgLeve } = await import('./gravadorLeve')
const { novoPersonagem } = await import('../../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../../lib/sistemaOnePiece')

describe('fila única da pasta (A5)', () => {
  beforeEach(() => {
    textos.clear()
  })

  it('o gravador leve não grava no meio do editarRpgDaPasta: o nome do Carregar Mapa e a Vida que veio do site ficam os dois', async () => {
    const pastaId = novoIdDePasta()
    const luffy = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'p_luffy' }
    await gravarRpgDaPasta(pastaId, { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [luffy] })

    // O Carregar Mapa renomeia enquanto o gravador leve leva ao `rpg.json` a Vida que o jogador mudou no site.
    const renomeado = editarRpgDaPasta(pastaId, (rpg) => ({ ...rpg, personagens: rpg.personagens.map((ficha) => ({ ...ficha, nome: 'Monkey D. Luffy' })) }))
    const doSite = gravarRpgLeve(pastaId, (personagens) => personagens.map((ficha) => ({ ...ficha, recursos: { ...ficha.recursos, hp: 15 } })))
    await Promise.all([renomeado, doSite])

    const lido = await lerRpgDaPasta(pastaId)
    expect(lido.ok ? lido.rpg.personagens.map((ficha) => [ficha.nome, ficha.recursos.hp]) : lido.motivo).toEqual([['Monkey D. Luffy', 15]])
  })
})
