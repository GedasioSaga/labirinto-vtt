/**
 * PRELÚDIO F3a: mexer e desfazer num quadro importado do Grimório não o muda
 * para a reimportação. A foto do tldraw de agora nunca é a do arquivo (esquema
 * do Prelúdio, cartão migrado, `meta.midia` nas imagens), e gravá-la daria o
 * quadro como editado no Prelúdio. Quadro inventado no formato do Grimório (o
 * repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { createShapeId, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot, type TLAnyShapeUtilConstructor, type TLEditorSnapshot } from 'tldraw'
import { hashDoQuadro, quadroComHash } from '../../lib/preparo/importar/reimportar'
import { fotoComMidia, midiaNaTabela } from '../../lib/preparo/quadros'
import type { Quadro } from '../../lib/preparo/tipos'
import { UTILS_DOS_CARTOES } from './cartoes'
import { criarGravadorDoQuadro } from './gravadorDoQuadro'
import { UTILS_DA_PLANTA } from './planta'

const COM_TUDO: TLAnyShapeUtilConstructor[] = [...defaultShapeUtils, ...UTILS_DOS_CARTOES, ...UTILS_DA_PLANTA]
const PAGINA = 'page:pagina-inventada'
const IMAGEM_NO_COFRE = 'campanhas/ilha-inventada/imagens/farol.png'

function forma(id: string, type: string, props: Record<string, unknown>): Record<string, unknown> {
  return { id: `shape:${id}`, typeName: 'shape', type, x: 0, y: 0, rotation: 0, index: 'a1', parentId: PAGINA, isLocked: false, opacity: 1, meta: {}, props }
}

/**
 * Um canvas de sessão como o Grimório grava e a importação guarda (com o hash
 * em `origem`): esquema mais velho, sem as peças de planta, o cartão de lugar
 * de antes da faixa de itens e uma imagem que aponta para o cofre.
 */
function quadroDoGrimorio(): Promise<Quadro> {
  const esquema = createTLStore({ shapeUtils: COM_TUDO }).schema.serialize()
  const sequencias = Object.fromEntries(Object.entries(esquema.sequences).filter(([nome]) => !nome.endsWith('-mapa')))
  const registros = [
    { id: 'document:document', typeName: 'document', gridSize: 10, name: '', meta: {} },
    { id: PAGINA, typeName: 'page', name: 'Página 1', index: 'a1', meta: {} },
    forma('heroi', 'character-card', { w: 240, h: 320, personagemId: 'verbete-inventado', expandido: false, infoExpandido: false, infoAoLado: false, fonteEscala: 1 }),
    forma('lugar', 'cenario-card', {
      w: 240,
      h: 320,
      cenarioId: 'lugar-inventado',
      expandido: false,
      infoExpandido: false,
      infoAoLado: false,
      eventosExpandido: false,
      eventosAoLado: false,
      itensExpandido: false,
      itensAoLado: false,
      fonteEscala: 1,
    }),
    { id: 'asset:farol', typeName: 'asset', type: 'image', props: { w: 64, h: 64, name: 'farol.png', isAnimated: false, mimeType: 'image/png', src: `asset://cofre/${IMAGEM_NO_COFRE}` }, meta: { rel: IMAGEM_NO_COFRE } },
    forma('foto', 'image', { w: 64, h: 64, playing: true, url: '', assetId: 'asset:farol', crop: null, flipX: false, flipY: false, altText: '' }),
  ]
  const tldraw = {
    document: {
      store: Object.fromEntries(registros.map((registro) => [registro.id, registro])),
      schema: { ...esquema, sequences: { ...sequencias, 'com.tldraw.shape.cenario-card': 2 } },
    },
  }
  return quadroComHash({ formato: 1, nome: 'Sessão inventada', tldraw, origem: { grimorio: { id: 'grim-inventado', caminho: 'campanhas/ilha-inventada/canvases/sessao-1.json' } } })
}

describe('gravar o quadro importado do Grimório', () => {
  it('mexer e desfazer não toca no arquivo, e a reimportação continua vendo o quadro como não mexido', async () => {
    const quadro = await quadroDoGrimorio()
    const daImportacao = quadro.origem?.grimorio?.hash
    expect(await hashDoQuadro(quadro)).toBe(daImportacao)

    // Abrir como o editor abre: a imagem ganha `meta.midia` e o tldraw migra a foto.
    const { foto } = fotoComMidia(quadro.tldraw, (rel) => midiaNaTabela(new Map([[IMAGEM_NO_COFRE, 'midia/farol-inventado.png']]), rel))
    const store = createTLStore({ shapeUtils: COM_TUDO })
    loadSnapshot(store, foto as Partial<TLEditorSnapshot>)
    // A causa: sem mudança nenhuma, a foto de agora já não bate com o hash da importação.
    expect(await hashDoQuadro({ ...quadro, tldraw: getSnapshot(store) })).not.toBe(daImportacao)

    const noDisco: Quadro[] = []
    const gravador = criarGravadorDoQuadro({
      id: 'quadro-inventado',
      quadro,
      noDisco: true,
      foto: () => getSnapshot(store),
      nome: () => quadro.nome,
      gravarNoDisco: async (novo) => {
        noDisco.push(novo)
      },
    })
    gravador.marcarAbertura()
    expect(await gravador.gravar()).toBeNull()

    // Arrastar o cartão é mudança de verdade: a foto do Prelúdio vai ao disco.
    const cartao = store.get(createShapeId('heroi'))
    if (cartao === undefined) throw new Error('o cartão devia ter aberto')
    store.put([{ ...cartao, x: 120 }])
    const arrastado = await gravador.gravar()
    expect(arrastado).not.toBeNull()
    expect(await hashDoQuadro(noDisco[0])).not.toBe(daImportacao)

    // Ctrl+Z: o quadro como abriu volta ao disco, com o hash da importação.
    store.put([cartao])
    expect(await gravador.gravar()).toBe(quadro)
    expect(noDisco).toHaveLength(2)
    expect(await hashDoQuadro(noDisco[1])).toBe(daImportacao)
    // Daí em diante, sem mudança, o arquivo fica quieto.
    expect(await gravador.gravar()).toBeNull()
    expect(noDisco).toHaveLength(2)
  })
})
