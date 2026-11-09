/**
 * PRELÚDIO F3a: a foto de um quadro do Grimório abre no tldraw do Prelúdio. Os
 * cartões e as peças de planta têm de estar registrados com o esquema e as
 * migrações do Grimório, letra por letra: o tldraw recusa a foto que tem um
 * tipo que ele não conhece. Dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { createTLStore, defaultShapeUtils, loadSnapshot, type TLAnyShapeUtilConstructor, type TLEditorSnapshot } from 'tldraw'
import { contarFormas } from '../../lib/preparo/quadros'
import { UTILS_DOS_CARTOES } from './cartoes'
import { UTILS_DA_PLANTA } from './planta'
import { SalaMapaShapeUtil } from './planta/SalaMapaShape'

const COM_TUDO: TLAnyShapeUtilConstructor[] = [...defaultShapeUtils, ...UTILS_DOS_CARTOES, ...UTILS_DA_PLANTA]
const SEM_PLANTA: TLAnyShapeUtilConstructor[] = [...defaultShapeUtils, ...UTILS_DOS_CARTOES]

const PAGINA = 'page:pagina-inventada'

function forma(id: string, type: string, props: Record<string, unknown>): Record<string, unknown> {
  return { id: `shape:${id}`, typeName: 'shape', type, x: 0, y: 0, rotation: 0, index: 'a1', parentId: PAGINA, isLocked: false, opacity: 1, meta: {}, props }
}

/**
 * Uma foto como o Grimório gravava antes de o cartão de personagem ganhar
 * "informações ao lado" (versão 3) e o tamanho da letra (versão 4).
 */
function fotoAntiga(): Partial<TLEditorSnapshot> {
  const esquema = createTLStore({ shapeUtils: COM_TUDO }).schema.serialize()
  const registros = [
    { id: 'document:document', typeName: 'document', gridSize: 10, name: '', meta: {} },
    { id: PAGINA, typeName: 'page', name: 'Página 1', index: 'a1', meta: {} },
    forma('cartao', 'character-card', { w: 240, h: 320, personagemId: 'verbete-inventado', expandido: false, infoExpandido: true }),
    forma('sala', 'sala-mapa', new SalaMapaShapeUtil({} as never).getDefaultProps()),
  ]
  return {
    document: {
      store: Object.fromEntries(registros.map((registro) => [registro.id, registro])),
      schema: { ...esquema, sequences: { ...esquema.sequences, 'com.tldraw.shape.character-card': 2 } },
    },
  } as unknown as Partial<TLEditorSnapshot>
}

describe('a foto do Grimório no quadro', () => {
  it('abre com os cartões e a planta, e o cartão antigo ganha os campos novos pela migração do Grimório', () => {
    const store = createTLStore({ shapeUtils: COM_TUDO })
    loadSnapshot(store, fotoAntiga())
    const cartao = store.get('shape:cartao' as never) as unknown as { props: Record<string, unknown> } | undefined
    expect(cartao?.props).toMatchObject({ personagemId: 'verbete-inventado', infoExpandido: true, infoAoLado: false, fonteEscala: 1 })
    expect(contarFormas({ document: store.getStoreSnapshot() })).toMatchObject({ formas: 2, cartoes: 1, salas: 1 })

    // Sem as peças de planta registradas, a mesma foto não abre: é por isso que elas vieram do Grimório.
    expect(() => loadSnapshot(createTLStore({ shapeUtils: SEM_PLANTA }), fotoAntiga())).toThrow()
  })
})
