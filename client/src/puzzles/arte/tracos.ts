/**
 * OS TRAÇOS DAS PEÇAS DESENHADAS: as formas que mais de uma peça usa (o
 * escudo, a lapidação, a engrenagem, a base do medalhão) e os metais. As cinco
 * primeiras vieram de `pecas.ts` sem mudar um número: as 13 peças do v2 saem
 * iguais, traço por traço.
 *
 * Tudo devolve o miolo de um SVG de 48 x 48 em texto. Arte do app, nunca
 * texto de usuário: vai só para `src` de `<img>` (dado SVG) e para o
 * rasterizador, onde cada peça é um documento sozinho (os `id` de recorte e
 * de filtro não encontram os de outra peça).
 *
 * Puro: sem React, sem disco.
 */

const CANAL_MAX = 255

/** Escurece (`fator` < 1) ou clareia (> 1) uma cor `#rrggbb`, o `tom` do v2: o contorno do Meio-Termo é a própria cor a ~60%. */
export function tom(hex: string, fator: number): string {
  const n = Number.parseInt(hex.slice(1), 16) || 0
  const canais = [(n >> 16) & CANAL_MAX, (n >> 8) & CANAL_MAX, n & CANAL_MAX].map((valor) => Math.max(0, Math.min(CANAL_MAX, Math.round(valor * fator))))
  return `#${((1 << 24) | (canais[0] << 16) | (canais[1] << 8) | canais[2]).toString(16).slice(1)}`
}

/** O fundo do furo da engrenagem e do olho da chave de latão (o vão escuro do v2). */
export const COR_DO_VAO = '#2a2620'

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
export const BASE_DO_MEDALHAO =
  '<circle cx="24" cy="24" r="19.5" fill="#b89552" stroke="#6e5931" stroke-width="2.5"/>' +
  '<circle cx="24" cy="24" r="14.8" fill="#c7a768" stroke="#8a6f3d" stroke-width="1.5"/>' +
  '<path d="M12.5 16a13.5 13.5 0 0 1 9.5-6" stroke="#ead29c" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>'

/** O escudo dos brasões: a mesma forma, com a cor, o contorno e o filete de cada um. */
export function escudo(cor: string, contorno: string, filete: string): string {
  return (
    `<path d="M9 8.5h30v13.5c0 9.6-6.4 15.7-15 18.7C15.4 37.7 9 31.6 9 22z" fill="${cor}" stroke="${contorno}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M12.5 11.5h23v10.5c0 7.6-5 12.4-11.5 14.9-6.5-2.5-11.5-7.3-11.5-14.9z" fill="none" stroke="${filete}" stroke-width="1.4"/>`
  )
}

/** A lapidação das duas joias do v2: a mesma forma, com a cor, o contorno e o brilho de cada uma. */
export function joia(cor: string, contorno: string, brilho: string): string {
  return (
    `<path d="M24 7.5l12.5 11.5L24 40.5 11.5 19z" fill="${cor}" stroke="${contorno}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M11.5 19h25M24 7.5 19 19l5 21.5 5-21.5z" stroke="${contorno}" stroke-width="1.3" fill="none" opacity=".8" stroke-linejoin="round"/>` +
    `<path d="M18.5 18.2l4.6-9" stroke="${brilho}" stroke-width="2" stroke-linecap="round"/>`
  )
}

// ------------------------------------------------------------------ o que as peças novas (21/11) usam

/** Um metal (ou pedra, ou osso): a cor do corpo, o contorno e o risco de luz. */
export interface Metal {
  cor: string
  escuro: string
  luz: string
}

/** Os metais das chaves e das peças novas. Paleta contida: todos já estavam no app ou são o mesmo tom um passo ao lado. */
export const METAIS = {
  ferro: { cor: '#8a8f93', escuro: '#383a3c', luz: '#c3c8cb' },
  ferroNegro: { cor: '#5f6468', escuro: '#232527', luz: '#9aa0a4' },
  bronze: { cor: '#b07a45', escuro: '#5e3f22', luz: '#dcae7c' },
  latao: { cor: '#d1b06c', escuro: '#6e5931', luz: '#efd9a2' },
  ouro: { cor: '#d8b24c', escuro: '#6b5220', luz: '#f5e3a0' },
  prata: { cor: '#c3c8cc', escuro: '#5f6468', luz: '#f0f2f3' },
  pedra: { cor: '#9a958a', escuro: '#4f4b44', luz: '#c9c4b8' },
  osso: { cor: '#e0d6bd', escuro: '#7a6e56', luz: '#f7f1e2' },
  verdete: { cor: '#7f9d86', escuro: '#3d5446', luz: '#bcd2c1' },
} as const satisfies Record<string, Metal>

/** A base de um medalhão novo, no mesmo desenho da de latão do v2 (`BASE_DO_MEDALHAO`), em outra liga. */
export interface LigaDoMedalhao {
  fora: string
  contornoFora: string
  dentro: string
  contornoDentro: string
  luz: string
  /** O relevo: o traço, o preenchimento e o claro (olhos, brilho). */
  relevo: string
  relevoCheio: string
  relevoClaro: string
}

export const LIGAS_DO_MEDALHAO = {
  latao: { fora: '#b89552', contornoFora: '#6e5931', dentro: '#c7a768', contornoDentro: '#8a6f3d', luz: '#ead29c', relevo: '#5e4a26', relevoCheio: '#a98b4f', relevoClaro: '#d8bb7c' },
  prata: { fora: '#a9aeb2', contornoFora: '#5a5f63', dentro: '#bcc1c5', contornoDentro: '#7b8084', luz: '#eef1f2', relevo: '#474c50', relevoCheio: '#9aa0a4', relevoClaro: '#dde1e4' },
  bronze: { fora: '#a46d3e', contornoFora: '#5a3b20', dentro: '#b47c48', contornoDentro: '#7a5230', luz: '#e2b583', relevo: '#4d321b', relevoCheio: '#94603a', relevoClaro: '#cf9a68' },
} as const satisfies Record<string, LigaDoMedalhao>

export function baseDeMedalhao(liga: LigaDoMedalhao): string {
  return (
    `<circle cx="24" cy="24" r="19.5" fill="${liga.fora}" stroke="${liga.contornoFora}" stroke-width="2.5"/>` +
    `<circle cx="24" cy="24" r="14.8" fill="${liga.dentro}" stroke="${liga.contornoDentro}" stroke-width="1.5"/>` +
    `<path d="M12.5 16a13.5 13.5 0 0 1 9.5-6" stroke="${liga.luz}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>`
  )
}

/** Um número curto para o SVG (duas casas, sem zero sobrando). */
function n(valor: number): string {
  return String(Math.round(valor * 100) / 100)
}

/** A estrela de `pontas` pontas em volta de (cx, cy), com a primeira ponta para cima (girada `giro` radianos). */
export function caminhoDaEstrela(cx: number, cy: number, pontas: number, raioDeFora: number, raioDeDentro: number, giro = 0): string {
  const passo = Math.PI / pontas
  let d = ''
  for (let k = 0; k < pontas * 2; k++) {
    const raio = k % 2 === 0 ? raioDeFora : raioDeDentro
    const angulo = giro + k * passo
    d += `${k === 0 ? 'M' : 'L'}${n(cx + Math.sin(angulo) * raio)} ${n(cy - Math.cos(angulo) * raio)}`
  }
  return `${d}Z`
}

/** O polígono regular de `lados` lados em volta de (cx, cy), girado `giro` radianos. */
export function caminhoDoPoligono(cx: number, cy: number, lados: number, raio: number, giro = 0): string {
  let d = ''
  for (let k = 0; k < lados; k++) {
    const angulo = giro + (k * Math.PI * 2) / lados
    d += `${k === 0 ? 'M' : 'L'}${n(cx + Math.sin(angulo) * raio)} ${n(cy - Math.cos(angulo) * raio)}`
  }
  return `${d}Z`
}

/** O contorno dentado de uma roda pequena (a argola da chave da roda), no mesmo desenho dos dentes da `engrenagem`. */
export function caminhoDaRoda(cx: number, cy: number, dentes: number, raioDeFora: number, raioDeDentro: number): string {
  const passo = (Math.PI * 2) / dentes
  const ponto = (raio: number, angulo: number) => `${n(cx + Math.sin(angulo) * raio)} ${n(cy - Math.cos(angulo) * raio)}`
  let d = ''
  for (let k = 0; k < dentes; k++) {
    const base = k * passo
    d += `${k === 0 ? 'M' : 'L'}${ponto(raioDeDentro, base)}L${ponto(raioDeFora, base + passo * 0.14)}L${ponto(raioDeFora, base + passo * 0.4)}L${ponto(raioDeDentro, base + passo * 0.54)}`
  }
  return `${d}Z`
}

/**
 * Várias formas como uma peça só: o contorno escuro por trás (cada forma com
 * traço largo) e o corpo por cima, sem traço. As formas vêm sem `fill` e sem
 * `stroke`: herdam do grupo. É o jeito da chave de ferro do v2 (traço largo
 * escuro, traço fino claro por cima), para formas cheias.
 */
export function uniao(formas: string, cor: string, escuro: string, contorno = 2): string {
  return (
    `<g fill="${escuro}" stroke="${escuro}" stroke-width="${n(contorno * 2)}" stroke-linejoin="round" stroke-linecap="round">${formas}</g>` +
    `<g fill="${cor}">${formas}</g>`
  )
}

/** A mesma forma, menor, em volta de (cx, cy): o furo com o desenho da argola. */
export function furoDaForma(d: string, cx: number, cy: number, escala: number): string {
  return `<path d="${d}" fill="${COR_DO_VAO}" transform="translate(${n(cx)} ${n(cy)}) scale(${n(escala)}) translate(${n(-cx)} ${n(-cy)})"/>`
}
