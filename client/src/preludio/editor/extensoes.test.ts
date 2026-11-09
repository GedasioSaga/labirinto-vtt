/**
 * PRELÚDIO, F2b: o copiar e colar (e o arrastar de uma seção para outra) passa
 * pelo HTML do esquema. A @menção tem de voltar com o verbete e a imagem com a
 * largura; antes, os dois voltavam vazios. Dados inventados (repositório público).
 */
import { Editor, type JSONContent } from '@tiptap/core'
import { afterEach, expect, it } from 'vitest'
import { PECAS_DO_TEXTO } from '../../lib/preparo/tipos'
import { extensoesDoTexto, reavaliarSoNome } from './extensoes'

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
      mencao: { tituloDe: (id) => (id === 'vb-capitao-inventado' ? 'Capitã Inventada' : undefined), aoAbrir: () => undefined, soNome: () => false, sugestao: { items: () => [] } },
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

it('F2c: a menção que o jogador lê só pelo nome ganha marca própria (fora do bloco de segredo), e a marca sai sem mexer no texto', () => {
  const titulos: Readonly<Record<string, string>> = { 'vb-sombra-inventada': 'Sombra Inventada', 'vb-porto-inventado': 'Porto Inventado' }
  let soNome: ReadonlySet<string> = new Set(['vb-sombra-inventada'])
  const mencao = (verbeteId: string) => ({ type: PECAS_DO_TEXTO.mencao, attrs: { verbeteId, rotulo: titulos[verbeteId] } })
  editor = new Editor({
    element: document.createElement('div'),
    extensions: extensoesDoTexto({
      convite: 'Escreva aqui',
      imagem: { urlDe: () => null },
      mencao: { tituloDe: (id) => titulos[id], aoAbrir: () => undefined, soNome: (id) => soNome.has(id), sugestao: { items: () => [] } },
    }),
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [mencao('vb-sombra-inventada'), { type: 'text', text: ' viu ' }, mencao('vb-porto-inventado')] },
        { type: PECAS_DO_TEXTO.segredo, content: [{ type: 'paragraph', content: [mencao('vb-sombra-inventada')] }] },
      ],
    },
  })
  const atual = editor
  const mencoesNaTela = () => [...atual.view.dom.querySelectorAll<HTMLElement>('[data-mencao]')].map((no) => ({ marcada: no.classList.contains('pr-mencao--so-nome'), dica: no.title }))
  let edicoes = 0
  atual.on('update', () => {
    edicoes += 1
  })
  const texto = JSON.stringify(atual.getJSON())

  expect(mencoesNaTela()).toEqual([
    { marcada: true, dica: 'Abrir Sombra Inventada. O jogador lê só o nome, sem link.' },
    { marcada: false, dica: 'Abrir Porto Inventado' },
    // Dentro do segredo o jogador não lê nada: nem o nome.
    { marcada: false, dica: 'Abrir Sombra Inventada' },
  ])

  // Revelado o mencionado: a marca sai, a dica de abrir fica, e não houve edição.
  soNome = new Set()
  reavaliarSoNome(atual)
  expect(mencoesNaTela()).toEqual([
    { marcada: false, dica: 'Abrir Sombra Inventada' },
    { marcada: false, dica: 'Abrir Porto Inventado' },
    { marcada: false, dica: 'Abrir Sombra Inventada' },
  ])
  expect(edicoes).toBe(0)
  expect(JSON.stringify(atual.getJSON())).toBe(texto)
  expect(atual.can().undo()).toBe(false)
})
