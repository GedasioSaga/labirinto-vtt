/**
 * PRELÚDIO, F2b: o copiar e colar (e o arrastar de uma seção para outra) passa
 * pelo HTML do esquema. A @menção tem de voltar com o verbete e a imagem com a
 * largura; antes, os dois voltavam vazios. Dados inventados (repositório público).
 */
import { Editor, type JSONContent } from '@tiptap/core'
import { afterEach, expect, it } from 'vitest'
import { PECAS_DO_TEXTO } from '../../lib/preparo/tipos'
import { extensoesDoTexto } from './extensoes'

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

it('a menção e a largura da imagem voltam iguais depois de ir ao HTML e voltar (o caminho do colar)', () => {
  editor = new Editor({
    extensions: extensoesDoTexto({
      convite: 'Escreva aqui',
      imagem: { urlDe: (midia) => (midia === null ? null : `teste://${midia}`) },
      mencao: { tituloDe: (id) => (id === 'vb-capitao-inventado' ? 'Capitã Inventada' : undefined), aoAbrir: () => undefined, sugestao: { items: () => [] } },
    }),
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Fala com ' },
            { type: PECAS_DO_TEXTO.mencao, attrs: { verbeteId: 'vb-capitao-inventado', rotulo: 'Capitã Inventada' } },
            { type: 'text', text: ' e com ' },
            { type: PECAS_DO_TEXTO.mencao, attrs: { verbeteId: 'vb-que-sumiu', rotulo: 'Grumete Sumido' } },
          ],
        },
        { type: 'image', attrs: { midia: 'midia/abcdef0123456789.png', alt: 'Mapa do porto', largura: 320 } },
      ],
    },
  })
  const antes = editor.getJSON()

  editor.commands.setContent(editor.getHTML())

  const depois: JSONContent = editor.getJSON()
  expect(depois).toEqual(antes)
  const mencoes = (depois.content?.[0]?.content ?? []).filter((no) => no.type === PECAS_DO_TEXTO.mencao)
  expect(mencoes.map((no) => no.attrs?.verbeteId)).toEqual(['vb-capitao-inventado', 'vb-que-sumiu'])
  expect(depois.content?.[1]?.attrs?.largura).toBe(320)
})
