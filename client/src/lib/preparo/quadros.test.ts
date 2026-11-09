/**
 * PRELÚDIO F3a: a foto do quadro vista sem o tldraw (contar as formas e dar às
 * imagens do Grimório o endereço da mídia do Prelúdio), o que abre só para
 * ver, a extensão da imagem colada e a tabela de mídia das importações. Dados
 * e disco inventados (o repositório é público).
 */
import { describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../features'
import { caminhosSemMidia, contarFormas, ehPlanta, esquecerTabelaDeMidia, extensaoDaImagem, fotoComMidia, lugaresDoQuadro, midiaNaTabela, tabelaDeMidiaDasImportacoes } from './quadros'
import type { Quadro } from './tipos'

/** O `<appData>` de mentira: caminho → texto. */
const discoFalso = vi.hoisted(() => new Map<string, string>())

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => 'C:/appdata-inventado',
  join: async (...partes: string[]) => partes.join('/'),
}))

vi.mock('@tauri-apps/plugin-fs', async (original) => ({
  ...(await original<typeof import('@tauri-apps/plugin-fs')>()),
  exists: async (caminho: string) => [...discoFalso.keys()].some((chave) => chave === caminho || chave.startsWith(`${caminho}/`)),
  readDir: async (caminho: string) => {
    const filhos = new Set([...discoFalso.keys()].filter((chave) => chave.startsWith(`${caminho}/`)).map((chave) => chave.slice(caminho.length + 1).split('/')[0]))
    return [...filhos].map((name) => ({ name, isDirectory: true, isFile: false, isSymlink: false }))
  },
  readTextFile: async (caminho: string) => {
    const texto = discoFalso.get(caminho)
    if (texto === undefined) throw new Error(`não existe: ${caminho}`)
    return texto
  },
}))

function forma(id: string, type: string): Record<string, unknown> {
  return { id: `shape:${id}`, typeName: 'shape', type, props: {} }
}

function imagem(id: string, rel: string): Record<string, unknown> {
  return { id: `asset:${id}`, typeName: 'asset', type: 'image', props: { src: `asset://cofre/${rel}` }, meta: { rel } }
}

/** Uma foto no formato que o Grimório grava: `{document: {store, schema}, session}`. */
function foto(registros: Record<string, unknown>[]): { document: { store: Record<string, unknown>; schema: unknown }; session: unknown } {
  return { document: { store: Object.fromEntries(registros.map((registro) => [registro.id as string, registro])), schema: { schemaVersion: 2, sequences: {} } }, session: { versao: 'qualquer' } }
}

function vindoDe(caminho: string): NonNullable<Quadro['origem']> {
  return { grimorio: { id: 'grim-inventado', caminho } }
}

describe('a foto do quadro', () => {
  it('conta cartões, setas, molduras e imagens, e dá a mídia do Prelúdio às imagens que a importação conhece, sem mexer no resto', () => {
    const original = foto([
      { id: 'document:document', typeName: 'document' },
      forma('c1', 'character-card'),
      forma('c2', 'cenario-card'),
      forma('c3', 'item-card'),
      forma('s1', 'arrow'),
      forma('m1', 'frame'),
      forma('i1', 'image'),
      forma('i2', 'image'),
      forma('t1', 'text'),
      imagem('a1', 'Campanhas/Ilha Inventada/imagens/Porto.png'),
      imagem('a2', 'campanhas/ilha-inventada/imagens/sumiu.png'),
    ])
    expect(contarFormas(original)).toEqual({ formas: 8, cartoes: 3, imagens: 2, setas: 1, molduras: 1, salas: 0, textos: 1 })
    // A foto antiga ({store, schema}, sem `document`) conta igual.
    expect(contarFormas(original.document).cartoes).toBe(3)
    expect(caminhosSemMidia(original)).toHaveLength(2)

    // A tabela da importação guarda o caminho do cofre em minúsculas: a grafia do caminho na foto não importa.
    const tabela = new Map([['campanhas/ilha inventada/imagens/porto.png', 'midia/abcdef0123456789.png']])
    const { foto: nova, semArquivo } = fotoComMidia(original, (rel) => midiaNaTabela(tabela, rel))
    expect(semArquivo).toBe(1)
    const store = (nova as typeof original).document.store
    expect(store['asset:a1']).toMatchObject({ meta: { rel: 'Campanhas/Ilha Inventada/imagens/Porto.png', midia: 'midia/abcdef0123456789.png' } })
    expect(store['asset:a2']).toBe(original.document.store['asset:a2'])
    expect(store['shape:c1']).toBe(original.document.store['shape:c1'])
    expect((nova as typeof original).session).toBe(original.session)
    // A foto recebida não muda: quem grava é o editor, só depois de uma mudança do mestre.
    expect(original.document.store['asset:a1']).not.toHaveProperty('meta.midia')

    // Só para ver é a planta do Grimório, pela origem (`mapas-soltos/`). A sala colada num quadro de sessão não trava o quadro.
    const planta: Quadro = { formato: 1, nome: 'Masmorra inventada', tldraw: foto([forma('p1', 'sala-mapa'), forma('p2', 'porta-mapa')]), origem: vindoDe('Mapas-Soltos/masmorra-inventada.json') }
    const comSalaColada: Quadro = { formato: 1, nome: 'Sessão inventada', tldraw: foto([forma('c1', 'character-card'), forma('p3', 'sala-mapa')]), origem: vindoDe('campanhas/ilha-inventada/canvases/sessao-1.json') }
    const doPreludio: Quadro = { formato: 1, nome: 'Quadro inventado', tldraw: foto([forma('p4', 'porta-mapa')]) }
    expect(ehPlanta(planta)).toBe(true)
    expect(contarFormas(planta.tldraw).salas).toBe(1)
    expect(ehPlanta(comSalaColada)).toBe(false)
    expect(ehPlanta(doPreludio)).toBe(false)
  })

  it('a imagem colada ganha a extensão da assinatura dos bytes, como na importação: o "retrato.png" que é webp não vira um segundo arquivo', () => {
    const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])
    expect(extensaoDaImagem(WEBP, 'image/png', 'retrato.png')).toBe('webp')
    expect(extensaoDaImagem(JPG, '', 'foto.png')).toBe('jpg')
    // Sem assinatura conhecida, o tipo e depois o nome.
    expect(extensaoDaImagem(new TextEncoder().encode('<svg xmlns="x">'), 'image/svg+xml', 'mapa.png')).toBe('svg')
    expect(extensaoDaImagem(new Uint8Array(), '', 'figura.jpeg')).toBe('jpg')
  })
})

describe('a tabela de mídia das importações', () => {
  it('fica guardada entre um quadro e outro, e depois de esquecida (importação aplicada, restauração) traz a imagem nova', async () => {
    const LIGADO = { ...FEATURES, preparo: true }
    const IMPORTACOES = 'C:/appdata-inventado/preparo/importacoes'
    const relatorio = (tabelaDeMidia: Record<string, string>) => JSON.stringify({ tabelaDeMidia })
    esquecerTabelaDeMidia()
    discoFalso.clear()
    discoFalso.set(`${IMPORTACOES}/2026-11-08T12-00-00Z/relatorio.json`, relatorio({ 'campanhas/ilha inventada/imagens/porto.png': 'midia/aaaa.png' }))
    expect(midiaNaTabela(await tabelaDeMidiaDasImportacoes(LIGADO), 'Campanhas/Ilha Inventada/imagens/Porto.png')).toBe('midia/aaaa.png')

    // Reimportar + Aplicar sem fechar o app: outra pasta, com a imagem nova. A tabela guardada ainda é a de antes.
    discoFalso.set(`${IMPORTACOES}/2026-11-09T08-00-00Z/relatorio.json`, relatorio({ 'campanhas/ilha inventada/imagens/farol.webp': 'midia/bbbb.webp' }))
    expect(midiaNaTabela(await tabelaDeMidiaDasImportacoes(LIGADO), 'campanhas/ilha inventada/imagens/farol.webp')).toBeNull()

    esquecerTabelaDeMidia()
    const relida = await tabelaDeMidiaDasImportacoes(LIGADO)
    expect(midiaNaTabela(relida, 'campanhas/ilha inventada/imagens/farol.webp')).toBe('midia/bbbb.webp')
    expect(midiaNaTabela(relida, 'campanhas/ilha inventada/imagens/porto.png')).toBe('midia/aaaa.png')
  })
})

describe('o que o texto pode citar num quadro (F3b)', () => {
  it('lê da foto do Grimório as molduras, na ordem de leitura, e os cartões pelo verbete de cada tipo', () => {
    const moldura = (id: string, nome: unknown, x: number, y: number) => ({ id: `shape:${id}`, typeName: 'shape', type: 'frame', x, y, props: { name: nome, w: 400, h: 300 } })
    const cartao = (id: string, type: string, props: Record<string, unknown>) => ({ id: `shape:${id}`, typeName: 'shape', type, x: 0, y: 0, props })
    const registros = [
      moldura('m-baixo', 'Cena 2: o cais', 0, 900),
      moldura('m-direita', '  Cena 1b  ', 500, 0),
      moldura('m-alto', 'Cena 1: a taverna', 0, 0),
      moldura('m-sem-nome', 7, 0, 1800),
      cartao('c1', 'character-card', { personagemId: 'per-inventado' }),
      cartao('c2', 'cenario-card', { cenarioId: 'lug-inventado' }),
      cartao('c3', 'item-card', { itemId: 'ite-inventado' }),
      cartao('c4', 'character-card', { personagemId: '' }),
      cartao('seta', 'arrow', {}),
    ]
    const foto = { document: { store: Object.fromEntries(registros.map((registro) => [registro.id, registro])), schema: {} }, session: {} }

    expect(lugaresDoQuadro(foto)).toEqual([
      { formaId: 'shape:m-alto', tipo: 'moldura', nome: 'Cena 1: a taverna' },
      { formaId: 'shape:m-direita', tipo: 'moldura', nome: 'Cena 1b' },
      { formaId: 'shape:m-baixo', tipo: 'moldura', nome: 'Cena 2: o cais' },
      { formaId: 'shape:m-sem-nome', tipo: 'moldura', nome: '' },
      { formaId: 'shape:c1', tipo: 'cartao', nome: 'per-inventado' },
      { formaId: 'shape:c2', tipo: 'cartao', nome: 'lug-inventado' },
      { formaId: 'shape:c3', tipo: 'cartao', nome: 'ite-inventado' },
    ])
    expect(lugaresDoQuadro(null)).toEqual([])
  })
})
