/**
 * ACERVO DE ITENS no disco (`lib/acervoDeItens.ts`) e na tela
 * (`stores/acervoDeItensStore.ts`): leitura tolerante, as defesas do índice
 * (ilegível guardado, leitura falhada não deixa gravar) e criar, editar,
 * apagar e as categorias.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const APPDATA = 'C:/Users/test/AppData/Roaming/labirinto'
const PASTA = `${APPDATA}/itens`
const INDICE = `${PASTA}/itens.json`
const textos = new Map<string, string>()
const pastas = new Set<string>()
const leituraFalhaEm = new Set<string>()
const escritaFalhaEm = new Set<string>()

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => textos.has(path) || pastas.has(path)),
  mkdir: vi.fn(async (path: string) => {
    pastas.add(path)
  }),
  readTextFile: vi.fn(async (path: string) => {
    if (leituraFalhaEm.has(path)) throw new Error('Access is denied. (os error 5)')
    const conteudo = textos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  writeTextFile: vi.fn(async (path: string, data: string) => {
    if (escritaFalhaEm.has(path) || escritaFalhaEm.has(path.replace(/\.tmp$/, ''))) throw new Error('disco cheio')
    textos.set(path, data)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const conteudo = textos.get(de)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${de}`)
    textos.set(para, conteudo)
    textos.delete(de)
  }),
  remove: vi.fn(async (path: string) => {
    textos.delete(path)
  }),
}))

const { acervoDoTexto, CATEGORIAS_PADRAO, itemParaDar, lerAcervoDeItens, novoItemDoCatalogo, serializarAcervo, gravarAcervoDeItens } = await import('./acervoDeItens')
const { useAcervoDeItensStore } = await import('../stores/acervoDeItensStore')

const HASH = 'b'.repeat(64)
const IMAGEM = `midia:${HASH}.webp`

function pocao(extra: Record<string, unknown> = {}) {
  return { id: 'item_pocao', nome: 'Poção', imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 120, empilhavel: true, ...extra }
}

beforeEach(() => {
  textos.clear()
  pastas.clear()
  leituraFalhaEm.clear()
  escritaFalhaEm.clear()
  useAcervoDeItensStore.setState({ itens: [], categorias: [...CATEGORIAS_PADRAO], aviso: null, podeGravar: false })
})

describe('leitura tolerante do índice', () => {
  it('lê o item inteiro e as categorias', () => {
    const lido = acervoDoTexto(JSON.stringify({ version: 1, categorias: ['Arma', 'Fruta'], itens: [pocao()] }))
    expect(lido).toEqual({ itens: [pocao()], categorias: ['Arma', 'Fruta'] })
  })

  it('campo torto vira o padrão; item sem id e id repetido saem', () => {
    const lido = acervoDoTexto(
      JSON.stringify({
        itens: [
          pocao({ imagem: 'C:/Users/mestre/pocao.png', preco: -3, nome: '   ', empilhavel: 'sim', descricao: 7 }),
          pocao({ nome: 'Repetida' }),
          { nome: 'Sem id' },
          { id: '../fora', nome: 'Id torto' },
        ],
      }),
    )
    expect(lido?.itens).toEqual([{ id: 'item_pocao', nome: 'Item sem nome', imagem: null, descricao: '', categoria: 'Consumível', preco: null, empilhavel: false }])
    // Sem a lista no arquivo, as categorias padrão.
    expect(lido?.categorias).toEqual([...CATEGORIAS_PADRAO])
  })

  it('categorias limpas, sem repetir por caixa', () => {
    expect(acervoDoTexto(JSON.stringify({ itens: [], categorias: [' Arma ', 'arma', '', 3, 'Fruta'] }))?.categorias).toEqual(['Arma', 'Fruta'])
  })

  it('o que não é acervo é null (vai para .invalido)', () => {
    expect(acervoDoTexto('{ quebrado')).toBeNull()
    expect(acervoDoTexto('[]')).toBeNull()
  })

  it('gravar e ler devolve o mesmo acervo', () => {
    const acervo = { itens: [pocao(), { ...novoItemDoCatalogo('Arma'), nome: 'Espada' }], categorias: ['Arma'] }
    expect(acervoDoTexto(serializarAcervo(acervo))).toEqual(acervo)
  })
})

describe('disco', () => {
  it('sem arquivo ainda: acervo vazio, lido (pode gravar)', async () => {
    expect(await lerAcervoDeItens()).toEqual({ acervo: { itens: [], categorias: [...CATEGORIAS_PADRAO] }, aviso: null, lido: true })
  })

  it('índice ilegível é guardado como .invalido antes de recomeçar', async () => {
    textos.set(INDICE, '{ quebrado')
    const lido = await lerAcervoDeItens()
    expect(lido.lido).toBe(true)
    expect(lido.aviso).toContain('itens.json.invalido')
    expect(textos.get(`${PASTA}/itens.json.invalido`)).toBe('{ quebrado')
  })

  it('leitura que falha por I/O não deixa gravar por cima', async () => {
    textos.set(INDICE, serializarAcervo({ itens: [pocao()], categorias: [] }))
    leituraFalhaEm.add(INDICE)
    const lido = await lerAcervoDeItens()
    expect(lido.lido).toBe(false)
    expect(lido.aviso).toContain('negou o acesso')
  })

  it('gravar guarda uma cópia do índice de antes', async () => {
    await gravarAcervoDeItens({ itens: [pocao()], categorias: ['Consumível'] })
    await gravarAcervoDeItens({ itens: [], categorias: ['Consumível'] })
    expect(acervoDoTexto(textos.get(`${PASTA}/itens.json.anterior`) ?? '')?.itens).toEqual([pocao()])
    expect(acervoDoTexto(textos.get(INDICE) ?? '')?.itens).toEqual([])
  })
})

describe('store do acervo: criar, editar, apagar', () => {
  it('cria, edita e apaga, gravando cada passo; categoria nova entra na lista', async () => {
    const store = useAcervoDeItensStore.getState()
    await store.recarregar()
    expect(useAcervoDeItensStore.getState().podeGravar).toBe(true)
    const espada = { ...novoItemDoCatalogo('Arma'), nome: 'Espada' }
    await useAcervoDeItensStore.getState().salvarItem(espada)
    await useAcervoDeItensStore.getState().salvarItem({ ...pocao(), categoria: 'Remédio' })
    expect(acervoDoTexto(textos.get(INDICE) ?? '')?.itens.map((item) => item.nome)).toEqual(['Espada', 'Poção'])
    expect(useAcervoDeItensStore.getState().categorias).toEqual([...CATEGORIAS_PADRAO, 'Remédio'])

    await useAcervoDeItensStore.getState().salvarItem({ ...espada, nome: 'Espada longa', preco: 300 })
    expect(useAcervoDeItensStore.getState().itens.find((item) => item.id === espada.id)?.nome).toBe('Espada longa')

    await useAcervoDeItensStore.getState().apagarItem(espada.id)
    expect(acervoDoTexto(textos.get(INDICE) ?? '')?.itens.map((item) => item.id)).toEqual(['item_pocao'])
  })

  it('a lista de categorias é editável', async () => {
    await useAcervoDeItensStore.getState().recarregar()
    await useAcervoDeItensStore.getState().definirCategorias(['Arma', 'Relíquia', 'arma'])
    expect(acervoDoTexto(textos.get(INDICE) ?? '')?.categorias).toEqual(['Arma', 'Relíquia'])
  })

  it('com a leitura falhada, nada grava', async () => {
    textos.set(INDICE, serializarAcervo({ itens: [pocao()], categorias: [] }))
    leituraFalhaEm.add(INDICE)
    await useAcervoDeItensStore.getState().recarregar()
    await expect(useAcervoDeItensStore.getState().salvarItem(novoItemDoCatalogo())).rejects.toThrow('nada foi gravado')
    expect(acervoDoTexto(textos.get(INDICE) ?? '')?.itens).toEqual([pocao()])
  })

  it('gravação que falha volta a tela ao que o disco tem e sobe o erro', async () => {
    await useAcervoDeItensStore.getState().recarregar()
    escritaFalhaEm.add(INDICE)
    await expect(useAcervoDeItensStore.getState().salvarItem(pocao())).rejects.toThrow('Não foi possível gravar o acervo de itens')
    expect(useAcervoDeItensStore.getState().itens).toEqual([])
  })
})

describe('itemParaDar', () => {
  it('leva o que a mochila guarda; vazio e nulo ficam de fora', () => {
    expect(itemParaDar({ ...pocao(), imagem: IMAGEM })).toEqual({ nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 120, empilhavel: true })
    expect(itemParaDar({ ...novoItemDoCatalogo(), id: 'item_x', nome: 'Pedra' })).toEqual({ nome: 'Pedra', itemId: 'item_x' })
  })
})
