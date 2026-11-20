/**
 * AS 13 PEÇAS DESENHADAS (brasões, chaves, engrenagens, joias e medalhões): a
 * arte do protótipo aprovado (`docs/design/puzzles/prototipo-v2.html`, os
 * `<symbol id="i-...">` e o gerador `engrenagem`), portada traço por traço.
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
import type { IdDaPecaDesenhada } from '../tipos'

/** O lado do quadro de toda peça, em unidades do `viewBox`. */
export const LADO_DA_ARTE_DA_PECA = 48

/** As peças na ordem da biblioteca do v2 (`PECAS_BASE`). */
export const IDS_DAS_PECAS_DESENHADAS: readonly IdDaPecaDesenhada[] = [
  'bra-carvalho',
  'bra-lobo',
  'bra-lua',
  'bra-sol',
  'chave-jardim',
  'chave-latao',
  'engr-bronze',
  'engr-ferro',
  'joia-ambar',
  'joia-safira',
  'med-garca',
  'med-sapo',
  'med-junco',
]

const CANAL_MAX = 255

/** Escurece (`fator` < 1) ou clareia (> 1) uma cor `#rrggbb`, o `tom` do v2: o contorno do Meio-Termo é a própria cor a ~60%. */
export function tom(hex: string, fator: number): string {
  const n = Number.parseInt(hex.slice(1), 16) || 0
  const canais = [(n >> 16) & CANAL_MAX, (n >> 8) & CANAL_MAX, n & CANAL_MAX].map((valor) => Math.max(0, Math.min(CANAL_MAX, Math.round(valor * fator))))
  return `#${((1 << 24) | (canais[0] << 16) | (canais[1] << 8) | canais[2]).toString(16).slice(1)}`
}

/** O fundo do furo da engrenagem e do olho da chave de latão (o vão escuro do v2). */
const COR_DO_VAO = '#2a2620'

/**
 * A engrenagem desenhada por código (o `engrenagem` do v2): dentes
 * trapezoidais em volta do centro (24, 24), contorno no tom escuro da cor, um
 * anel por dentro, o furo (redondo ou quadrado) e um risco de luz no alto.
 */
export function engrenagem(dentes: number, raioDeFora: number, raioDeDentro: number, cor: string, furoQuadrado: boolean): string {
  const passo = (Math.PI * 2) / dentes
  const ponto = (raio: number, angulo: number) => `${(24 + Math.sin(angulo) * raio).toFixed(2)} ${(24 - Math.cos(angulo) * raio).toFixed(2)}`
  let contorno = ''
  for (let k = 0; k < dentes; k++) {
    const base = k * passo
    contorno += `${k === 0 ? 'M' : 'L'}${ponto(raioDeDentro, base)}L${ponto(raioDeFora, base + passo * 0.14)}L${ponto(raioDeFora, base + passo * 0.4)}L${ponto(raioDeDentro, base + passo * 0.54)}`
  }
  const escuro = tom(cor, 0.55)
  const furo = furoQuadrado
    ? `<rect x="20.5" y="20.5" width="7" height="7" rx="1" fill="${COR_DO_VAO}" stroke="${escuro}" stroke-width="1.6"/>`
    : `<circle cx="24" cy="24" r="4" fill="${COR_DO_VAO}" stroke="${escuro}" stroke-width="1.6"/>`
  const raioDaLuz = raioDeDentro - 2.5
  return (
    `<path d="${contorno}Z" fill="${cor}" stroke="${escuro}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="24" cy="24" r="${(raioDeDentro * 0.58).toFixed(1)}" fill="none" stroke="${tom(cor, 0.72)}" stroke-width="1.6"/>${furo}` +
    `<path d="M${ponto(raioDaLuz, -1.1)}A${raioDaLuz} ${raioDaLuz} 0 0 1 ${ponto(raioDaLuz, -0.25)}" stroke="${tom(cor, 1.32)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>`
  )
}

/** A base de latão dos três medalhões (`base-med` do v2). */
const BASE_DO_MEDALHAO =
  '<circle cx="24" cy="24" r="19.5" fill="#b89552" stroke="#6e5931" stroke-width="2.5"/>' +
  '<circle cx="24" cy="24" r="14.8" fill="#c7a768" stroke="#8a6f3d" stroke-width="1.5"/>' +
  '<path d="M12.5 16a13.5 13.5 0 0 1 9.5-6" stroke="#ead29c" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>'

/** O escudo dos quatro brasões: a mesma forma, com a cor, o contorno e o filete de cada um. */
function escudo(cor: string, contorno: string, filete: string): string {
  return (
    `<path d="M9 8.5h30v13.5c0 9.6-6.4 15.7-15 18.7C15.4 37.7 9 31.6 9 22z" fill="${cor}" stroke="${contorno}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M12.5 11.5h23v10.5c0 7.6-5 12.4-11.5 14.9-6.5-2.5-11.5-7.3-11.5-14.9z" fill="none" stroke="${filete}" stroke-width="1.4"/>`
  )
}

/** A lapidação das duas joias: a mesma forma, com a cor, o contorno e o brilho de cada uma. */
function joia(cor: string, contorno: string, brilho: string): string {
  return (
    `<path d="M24 7.5l12.5 11.5L24 40.5 11.5 19z" fill="${cor}" stroke="${contorno}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M11.5 19h25M24 7.5 19 19l5 21.5 5-21.5z" stroke="${contorno}" stroke-width="1.3" fill="none" opacity=".8" stroke-linejoin="round"/>` +
    `<path d="M18.5 18.2l4.6-9" stroke="${brilho}" stroke-width="2" stroke-linecap="round"/>`
  )
}

/** O miolo do SVG de cada peça (sem a tag `<svg>`), no quadro de 48 x 48. */
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
