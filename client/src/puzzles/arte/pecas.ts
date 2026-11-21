/**
 * AS PEÇAS DESENHADAS: as 13 do protótipo aprovado
 * (`docs/design/puzzles/prototipo-v2.html`, os `<symbol id="i-...">` e o
 * gerador `engrenagem`), portadas traço por traço, e o catálogo grande de
 * 21/11 (`pecasDeEncaixe.ts`, `metades.ts`, `chaves.ts`), no mesmo traço.
 * Mudar um número aqui muda a peça que o mestre já pôs no acervo só na
 * próxima vez que ele a puser de novo: o item guarda o PNG, não o desenho.
 *
 * Cada peça é o miolo de um SVG de 48 x 48 (`viewBox="0 0 48 48"`), sem
 * `<use>`: o medalhão leva a base dentro dele, porque o SVG solto (o `<img>` e
 * o rasterizador, `puzzles/arte/rasterizar.ts`) não enxerga os `<symbol>` da página.
 *
 * Puro: sem React, sem disco. Arte do app, nunca texto de usuário: pode ir
 * para `src` de `<img>` como dado SVG.
 */
import type { IdDaChave, IdDaMetade, IdDaPecaDeEncaixe, IdDaPecaDesenhada, TipoDaPecaDesenhada } from '../tipos'
import { ARTE_DAS_CHAVES } from './chaves'
import { ARTE_DAS_METADES, PARES_DE_METADES } from './metades'
import { ARTE_DAS_PECAS_DE_ENCAIXE } from './pecasDeEncaixe'
import { BASE_DO_MEDALHAO, COR_DO_VAO, engrenagem, escudo, joia } from './tracos'

export { engrenagem, tom } from './tracos'

/** O lado do quadro de toda peça, em unidades do `viewBox`. */
export const LADO_DA_ARTE_DA_PECA = 48

/** As chaves de um registro de arte, na ordem em que foram escritas (o registro é completo: o `tsc` cobra cada id). */
function idsDe<K extends string>(registro: Readonly<Record<K, string>>): K[] {
  return Object.keys(registro) as K[]
}

/**
 * As peças de cada tipo, na ordem da biblioteca: primeiro as do v2 (na ordem
 * do `PECAS_BASE`), depois as novas. As duas chaves do v2 vão com as chaves.
 */
export const IDS_DAS_PECAS_DO_TIPO: Readonly<Record<TipoDaPecaDesenhada, readonly IdDaPecaDesenhada[]>> = {
  encaixe: [
    'bra-carvalho',
    'bra-lobo',
    'bra-lua',
    'bra-sol',
    'engr-bronze',
    'engr-ferro',
    'joia-ambar',
    'joia-safira',
    'med-garca',
    'med-sapo',
    'med-junco',
    ...idsDe<IdDaPecaDeEncaixe>(ARTE_DAS_PECAS_DE_ENCAIXE),
  ],
  metade: PARES_DE_METADES.flatMap((par): IdDaMetade[] => [...par.metades]),
  chave: ['chave-jardim', 'chave-latao', ...idsDe<IdDaChave>(ARTE_DAS_CHAVES)],
}

/** Os tipos na ordem da biblioteca. */
export const TIPOS_DA_PECA_DESENHADA: readonly TipoDaPecaDesenhada[] = ['encaixe', 'metade', 'chave']

/** Todas as peças desenhadas, na ordem da biblioteca (por tipo). */
export const IDS_DAS_PECAS_DESENHADAS: readonly IdDaPecaDesenhada[] = TIPOS_DA_PECA_DESENHADA.flatMap((tipo) => IDS_DAS_PECAS_DO_TIPO[tipo])

const TIPO_DA_PECA: ReadonlyMap<IdDaPecaDesenhada, TipoDaPecaDesenhada> = new Map(TIPOS_DA_PECA_DESENHADA.flatMap((tipo) => IDS_DAS_PECAS_DO_TIPO[tipo].map((id) => [id, tipo] as const)))

/** Para que serve a peça desenhada (agrupa a biblioteca, o seletor e a vitrine do acervo). */
export function tipoDaPecaDesenhada(id: IdDaPecaDesenhada): TipoDaPecaDesenhada {
  return TIPO_DA_PECA.get(id) ?? 'encaixe'
}

/** A peça inteira que as duas metades formam, em qualquer ordem; `null` = não são um par. */
export function inteiraDasMetades(a: IdDaPecaDesenhada | null, b: IdDaPecaDesenhada | null): IdDaPecaDesenhada | null {
  if (a === null || b === null) return null
  const par = PARES_DE_METADES.find(({ metades }) => (metades[0] === a && metades[1] === b) || (metades[0] === b && metades[1] === a))
  return par?.inteira ?? null
}

/** O miolo do SVG de cada peça (sem a tag `<svg>`), no quadro de 48 x 48. As 13 do v2 aqui; as novas, dos arquivos de cada tipo. */
export const ARTE_DAS_PECAS: Readonly<Record<IdDaPecaDesenhada, string>> = {
  'bra-carvalho':
    escudo('#7f9a64', '#4c5c3c', '#a3bb88') +
    '<path d="M24 25.5v8" stroke="#e9e3cf" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M17.4 21.6a4 4 0 0 1 2-6.4 5 5 0 0 1 9.4-1 4.2 4.2 0 0 1 2.9 7.1 3.6 3.6 0 0 1-3.3 4.3h-8.2a3.8 3.8 0 0 1-2.8-4z" fill="#e9e3cf" stroke="#4c5c3c" stroke-width="1.8"/>',
  'bra-lobo':
    escudo('#7189a6', '#445263', '#9aadc3') +
    '<path d="M16.5 14.5l3.6 5h7.8l3.6-5 1 11-8.5 7.5-8.5-7.5z" fill="#e9e3cf" stroke="#445263" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<circle cx="21" cy="23.5" r="1.3" fill="#445263"/><circle cx="27" cy="23.5" r="1.3" fill="#445263"/><path d="M22.6 28h2.8L24 29.7z" fill="#445263"/>',
  'bra-lua':
    escudo('#b9bec3', '#6f7378', '#dde1e4') +
    '<path d="M27.5 13.5a9.5 9.5 0 1 0 0 17.6 7.6 7.6 0 1 1 0-17.6z" fill="#f3efe2" stroke="#6f7378" stroke-width="1.8"/>',
  'bra-sol':
    escudo('#b56e50', '#6d4230', '#d1937a') +
    '<path d="M24 12.5v3M24 29.5v3M14 22.5h3M31 22.5h3M17 15.5l2.1 2.1M28.9 27.4l2.1 2.1M31 15.5l-2.1 2.1M19.1 27.4 17 29.5" stroke="#f0d266" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="24" cy="22.5" r="5.2" fill="#f0d266" stroke="#6d4230" stroke-width="1.8"/>',
  'chave-jardim':
    '<circle cx="16" cy="17" r="7" fill="none" stroke="#383a3c" stroke-width="6.5"/><circle cx="16" cy="17" r="7" fill="none" stroke="#8a8f93" stroke-width="3.5"/>' +
    '<path d="M21 22l14 14M29.5 30.5l3.5-3.5M33 34l3.5-3.5" stroke="#383a3c" stroke-width="6.5" stroke-linecap="round"/><path d="M21 22l14 14M29.5 30.5l3.5-3.5M33 34l3.5-3.5" stroke="#8a8f93" stroke-width="3.5" stroke-linecap="round"/>',
  'chave-latao':
    '<path d="M15 10.5a5.5 5.5 0 0 1 7.6 4.6 5.5 5.5 0 0 1-2.4 9.6 5.5 5.5 0 0 1-9.6-2.4 5.5 5.5 0 0 1 4.4-11.8z" fill="#d1b06c" stroke="#6e5931" stroke-width="2.2" stroke-linejoin="round"/>' +
    `<circle cx="16.6" cy="18.6" r="2.6" fill="${COR_DO_VAO}" stroke="#6e5931" stroke-width="1.4"/>` +
    '<path d="M21.5 23.5 37 39" stroke="#6e5931" stroke-width="6" stroke-linecap="round"/><path d="M21.5 23.5 37 39" stroke="#d1b06c" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M31.2 33.2l3.6-3.6 2 2-3.6 3.6M34.6 36.6l2.6-2.6" stroke="#6e5931" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '<path d="M12.6 14.2a4 4 0 0 1 3-2" stroke="#efd9a2" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  // Os mesmos números do v2: engrenagem('engr-bronze', 8, 19, 14.5, '#b07a45', false) e ('engr-ferro', 6, 16, 12, '#8a8f93', true).
  'engr-bronze': engrenagem(8, 19, 14.5, '#b07a45', false),
  'engr-ferro': engrenagem(6, 16, 12, '#8a8f93', true),
  'joia-ambar': joia('#e0a24e', '#86612f', '#f8d9a4'),
  'joia-safira': joia('#6f8fb8', '#3d5373', '#c9daf0'),
  'med-garca':
    BASE_DO_MEDALHAO +
    '<path d="M27 14c-2.6 0-4 1.8-4 3.8 0 2.2 2.2 3.2 2.2 5.2 0 2.6-5.2 4.4-5.2 8.6 0 1.6 1 2.9 2.6 2.9h5.2M27 14l5.5 1.3-5.1 1.3M23.6 34.5v3.2M27 34.5v3.2" fill="none" stroke="#5e4a26" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  'med-sapo':
    BASE_DO_MEDALHAO +
    '<path d="M15.5 30.5c0-5.6 3.8-9.5 8.5-9.5s8.5 3.9 8.5 9.5c0 2.6-3.8 3.8-8.5 3.8s-8.5-1.2-8.5-3.8z" fill="#a98b4f" stroke="#5e4a26" stroke-width="2"/>' +
    '<circle cx="19.8" cy="21.4" r="2.6" fill="#d8bb7c" stroke="#5e4a26" stroke-width="1.8"/><circle cx="28.2" cy="21.4" r="2.6" fill="#d8bb7c" stroke="#5e4a26" stroke-width="1.8"/>' +
    '<path d="M20.5 29.5q3.5 1.8 7 0" stroke="#5e4a26" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  'med-junco':
    BASE_DO_MEDALHAO +
    '<path d="M18.5 35c0-7 .6-13 2.2-19M24 35V12.5M29.5 35c0-7-.6-13-2.2-19" stroke="#5e4a26" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="20.9" cy="14.6" rx="1.8" ry="4" fill="#5e4a26" transform="rotate(12 20.9 14.6)"/><ellipse cx="24" cy="11.4" rx="1.8" ry="4" fill="#5e4a26"/><ellipse cx="27.1" cy="14.6" rx="1.8" ry="4" fill="#5e4a26" transform="rotate(-12 27.1 14.6)"/>',
  ...ARTE_DAS_PECAS_DE_ENCAIXE,
  ...ARTE_DAS_METADES,
  ...ARTE_DAS_CHAVES,
}

/**
 * O SVG inteiro de uma peça, sozinho. `lado` = a largura e a altura em px:
 * sem elas o navegador dá ao SVG solto um tamanho seu (300 x 150), e o
 * rasterizador esticaria a peça.
 */
export function svgDaPeca(id: IdDaPecaDesenhada, lado: number = LADO_DA_ARTE_DA_PECA): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO_DA_ARTE_DA_PECA} ${LADO_DA_ARTE_DA_PECA}" width="${lado}" height="${lado}">${ARTE_DAS_PECAS[id]}</svg>`
}

/** A peça como endereço de `<img>` (dado SVG): a vitrine mostra o desenho sem gravar nada. */
export function urlDaPeca(id: IdDaPecaDesenhada): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDaPeca(id))}`
}
