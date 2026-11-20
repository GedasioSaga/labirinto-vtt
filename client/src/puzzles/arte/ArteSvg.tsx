/**
 * A ARTE DOS MODELOS NA TELA: monta a árvore de `modelos.ts` com o React,
 * elemento por elemento. Nada vira marcação em texto: o React escreve cada
 * atributo e cada texto escapado, e a árvore só admite as etiquetas e os
 * atributos do SVG que a arte usa (os tipos de `modelos.ts`).
 *
 * O SVG fica no documento (e não numa imagem) porque as partes `qpz-*` são
 * animadas pelo CSS da página (`QuadroDoPuzzle.css`).
 */
import { createElement, memo, type ReactNode } from 'react'
import type { FilhoDaArte, NoDaArte, ValorDoAtributo } from './modelos'

/** O nome que o React espera para os atributos do SVG com hífen (os outros já são iguais). */
const NOME_NO_REACT: Readonly<Partial<Record<string, string>>> = {
  class: 'className',
  'clip-path': 'clipPath',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
  'text-anchor': 'textAnchor',
}

function montar(filho: FilhoDaArte): ReactNode {
  if (typeof filho === 'string') return filho
  const props: Record<string, ValorDoAtributo | undefined> = {}
  for (const [nome, valor] of Object.entries<ValorDoAtributo | undefined>(filho.atributos)) props[NOME_NO_REACT[nome] ?? nome] = valor
  return createElement(filho.tag, props, ...filho.filhos.map(montar))
}

/** O SVG da arte. Memoizado pela árvore: quem chama guarda a mesma árvore enquanto o visual não muda. */
export const ArteSvg = memo(function ArteSvg({ arte }: { arte: NoDaArte }) {
  return montar(arte)
})
