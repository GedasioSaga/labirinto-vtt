/**
 * PRELÚDIO F3a: a foto do quadro vista sem o tldraw (contar as formas e dar às
 * imagens do Grimório o endereço da mídia do Prelúdio). Dados inventados (o
 * repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { caminhosSemMidia, contarFormas, ehPlanta, fotoComMidia, midiaNaTabela } from './quadros'
import type { Quadro } from './tipos'

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

    const planta: Quadro = { formato: 1, nome: 'Masmorra inventada', tldraw: foto([forma('p1', 'sala-mapa'), forma('p2', 'porta-mapa')]) }
    const mapaMental: Quadro = { formato: 1, nome: 'Sessão inventada', tldraw: original }
    expect(ehPlanta(planta)).toBe(true)
    expect(contarFormas(planta.tldraw).salas).toBe(1)
    expect(ehPlanta(mapaMental)).toBe(false)
  })
})
