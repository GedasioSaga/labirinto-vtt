/**
 * A ARTE DOS INTERRUPTORES COM ESTADO (28/11): um painel de latão ou de ferro
 * cravado na parede, com uma fileira (ou grade) de lampiões a gás, cada um com
 * a sua alavanca embaixo. Desenhado por código, original. Tudo vira dado de
 * `<img>` (o navegador lê cada SVG uma vez e reaproveita em todos os lampiões):
 *
 * - A BASE (`urlDaBaseDoPainel`): a parede, a chapa rebitada (mapa de altura e
 *   o filtro de metal das peças giratórias), o cartucho de cada lampião com a
 *   roseta do gancho, a fenda da alavanca e o número gravado, e a plaqueta do
 *   desenho, quando o mestre a pôs.
 * - O LAMPIÃO, em camadas: o vidro frio, o vidro aceso, a chama (que tremula
 *   sozinha), o corpo de metal com a gaiola por cima e o reflexo quente da
 *   chama no metal. Acender é trocar a opacidade das camadas acesas.
 * - O CLARÃO: a luz que a chama joga na chapa, somada por cima (`screen`).
 * - A ALAVANCA: a haste (que encurta e vira, como quem a vê de frente passar
 *   pela fenda) e o punho de madeira.
 *
 * Nenhum degradê radial (o primeiro custa caro para compilar no Edge frio): o
 * que é redondo e brilha sai de elipses borradas.
 */
import { DOMO_CUPULA, DOMO_MEIO, alt, circulo, defsDeAltura, friso, num, polar, reiniciarDomos, tubo } from '../relevo/cenas/comum'
import { FILTROS_DA_PAREDE, LUZ_DE_LADO, MATERIAIS, filtroDeMetal, parede, type Material } from '../giratorias/arte'
import type { MaterialDosInterruptores } from '../tipos'
import { colunasDoPainel } from './interruptores'

// ------------------------------------------------------------------ a geometria (em unidades do quadro, 1600 x 1000)

export const LARGURA_DO_QUADRO = 1600
export const ALTURA_DO_QUADRO = 1000

/** Os dois arranjos da célula: o lampião em cima da alavanca (uma ou duas fileiras) ou ao lado dela (três). */
export type ArranjoDaCelula = 'empe' | 'lado'

interface Molde {
  largura: number
  altura: number
  /** O canto da caixa do lampião (120 x 240 no molde, vezes `escalaDoLampiao`). */
  lampiao: { x: number; y: number }
  /** O lampião deitado ao lado da alavanca encolhe para o gancho e o pé caberem na moldura. */
  escalaDoLampiao: number
  /** O eixo da alavanca e o número gravado (à direita da fenda, na altura do eixo). */
  eixo: { x: number; y: number }
  numero: { x: number; y: number }
}

/**
 * As células no tamanho de referência; o painel as escala para caber. O gancho
 * sobe uns 32 acima da argola e a moldura fica a 13 da borda: o lampião começa
 * em y >= 34 e o espelho da fenda termina antes de altura - 13.
 */
const MOLDES: Readonly<Record<ArranjoDaCelula, Molde>> = {
  empe: { largura: 240, altura: 470, lampiao: { x: 60, y: 36 }, escalaDoLampiao: 1, eixo: { x: 120, y: 372 }, numero: { x: 186, y: 383 } },
  lado: { largura: 330, altura: 250, lampiao: { x: 51, y: 34 }, escalaDoLampiao: 0.82, eixo: { x: 238, y: 125 }, numero: { x: 293, y: 136 } },
}

export const LARGURA_DO_LAMPIAO = 120
export const ALTURA_DO_LAMPIAO = 240
/** Do eixo ao centro do punho, e o tamanho do punho e da haste (no molde). */
export const BRACO_DA_ALAVANCA = 58
export const LADO_DO_PUNHO = 46
export const LARGURA_DA_HASTE = 12
/** O centro da chama no lampião (o clarão nasce dele). */
const CHAMA_NO_LAMPIAO = { x: 60, y: 132 }
export const LADO_DO_CLARAO = 620

export interface Caixa {
  x: number
  y: number
  largura: number
  altura: number
}

export interface CelulaDoPainel extends Caixa {
  /** Quanto o molde foi escalado (o lampião e a alavanca acompanham). */
  escala: number
  lampiao: Caixa
  haste: Caixa
  punho: Caixa
  clarao: Caixa
  numero: { x: number; y: number }
  eixo: { x: number; y: number }
}

export interface GeometriaDoPainel {
  arranjo: ArranjoDaCelula
  colunas: number
  linhas: number
  placa: Caixa
  /** A plaqueta do desenho, em cima das células; `null` = sem plaqueta. */
  plaqueta: Caixa | null
  celulas: CelulaDoPainel[]
}

const BORDA_DA_PLACA = 54
const LARGURA_UTIL = 1340
const ALTURA_UTIL = 900

function alturaDaPlaqueta(linhas: number): number {
  return 34 + linhas * 36
}

/** Onde cada coisa do painel fica, para `quantos` lampiões (com a plaqueta do desenho ou sem). */
export function geometriaDoPainel(quantos: number, comPlaqueta: boolean): GeometriaDoPainel {
  const colunas = colunasDoPainel(quantos)
  const linhas = Math.ceil(quantos / colunas)
  const arranjo: ArranjoDaCelula = linhas >= 3 ? 'lado' : 'empe'
  const molde = MOLDES[arranjo]
  const faixaDaPlaqueta = comPlaqueta ? alturaDaPlaqueta(linhas) + 26 : 0
  const escala = Math.min(1.1, (LARGURA_UTIL - 2 * BORDA_DA_PLACA) / (colunas * molde.largura), (ALTURA_UTIL - 2 * BORDA_DA_PLACA - faixaDaPlaqueta) / (linhas * molde.altura))
  // A célula ganha a folga da largura (o alvo de toque cresce), mas o lampião fica do tamanho da escala.
  const largura = Math.min(molde.largura * escala * 1.35, (LARGURA_UTIL - 2 * BORDA_DA_PLACA) / colunas)
  const altura = molde.altura * escala
  const placa: Caixa = {
    largura: colunas * largura + 2 * BORDA_DA_PLACA,
    altura: linhas * altura + 2 * BORDA_DA_PLACA + faixaDaPlaqueta,
    x: 0,
    y: 0,
  }
  placa.x = (LARGURA_DO_QUADRO - placa.largura) / 2
  placa.y = (ALTURA_DO_QUADRO - placa.altura) / 2
  const larguraDaPlaqueta = colunas * 40 + 52
  const plaqueta = comPlaqueta ? { x: LARGURA_DO_QUADRO / 2 - larguraDaPlaqueta / 2, y: placa.y + BORDA_DA_PLACA - 14, largura: larguraDaPlaqueta, altura: alturaDaPlaqueta(linhas) } : null
  const celulas = Array.from({ length: quantos }, (_, i): CelulaDoPainel => {
    const x = placa.x + BORDA_DA_PLACA + (i % colunas) * largura
    const y = placa.y + BORDA_DA_PLACA + faixaDaPlaqueta + Math.floor(i / colunas) * altura
    // O molde fica no meio da célula (a folga da largura sobra dos dois lados).
    const ox = x + (largura - molde.largura * escala) / 2
    const em = (px: number, py: number) => ({ x: ox + px * escala, y: y + py * escala })
    const lampiao = em(molde.lampiao.x, molde.lampiao.y)
    const eixo = em(molde.eixo.x, molde.eixo.y)
    const kl = molde.escalaDoLampiao
    const chama = em(molde.lampiao.x + CHAMA_NO_LAMPIAO.x * kl, molde.lampiao.y + CHAMA_NO_LAMPIAO.y * kl)
    const ladoDoClarao = LADO_DO_CLARAO * escala * kl
    return {
      x,
      y,
      largura,
      altura,
      escala,
      lampiao: { ...lampiao, largura: LARGURA_DO_LAMPIAO * escala * kl, altura: ALTURA_DO_LAMPIAO * escala * kl },
      haste: { x: eixo.x - (LARGURA_DA_HASTE * escala) / 2, y: eixo.y - BRACO_DA_ALAVANCA * escala, largura: LARGURA_DA_HASTE * escala, altura: BRACO_DA_ALAVANCA * escala },
      punho: { x: eixo.x - (LADO_DO_PUNHO * escala) / 2, y: eixo.y - BRACO_DA_ALAVANCA * escala - (LADO_DO_PUNHO * escala) / 2, largura: LADO_DO_PUNHO * escala, altura: LADO_DO_PUNHO * escala },
      clarao: { x: chama.x - ladoDoClarao / 2, y: chama.y - ladoDoClarao / 2, largura: ladoDoClarao, altura: ladoDoClarao },
      numero: em(molde.numero.x, molde.numero.y),
      eixo,
    }
  })
  return { arranjo, colunas, linhas, placa, plaqueta, celulas }
}

// ------------------------------------------------------------------ os metais

/** O latão: amarelo de ouro velho, com verdete nas fendas (o bronze das peças giratórias é mais escuro e esverdeado). */
const LATAO: Material = {
  tabela: ['#2d3a2a', '#3d4a2f', '#4a4526', '#5f5226', '#7a6528', '#977c2f', '#b3963d', '#cdb055', '#e6cd7c'],
  brilho: '#fff1c4',
  ks: 0.62,
  expoente: 22,
}

export const METAL_DA_CHAPA: Readonly<Record<MaterialDosInterruptores, Material>> = { latao: LATAO, ferro: MATERIAIS.ferro }

/** As cores do metal dos lampiões e da haste (desenho direto, sem o filtro): escuro, meio, claro, brilho. */
export const TINTA_DO_METAL: Readonly<Record<MaterialDosInterruptores, readonly [string, string, string, string]>> = {
  latao: ['#4a3816', '#8a6a2a', '#d4b260', '#fff0c2'],
  ferro: ['#1f1e1c', '#4a4844', '#8f8a80', '#e4e0d6'],
}

// ------------------------------------------------------------------ a base: parede, chapa, cartuchos, fendas, números e a plaqueta

export function retangulo(caixa: Caixa, raio: number, extra: string): string {
  return `<rect x="${num(caixa.x)}" y="${num(caixa.y)}" width="${num(caixa.largura)}" height="${num(caixa.altura)}" rx="${num(raio)}" ${extra}/>`
}

/** A chapa em altura: o corpo, a moldura levantada com um friso, o sulco de dentro e os rebites. */
export function chapa(placa: Caixa): string {
  const dentro = (d: number): Caixa => ({ x: placa.x + d, y: placa.y + d, largura: placa.largura - 2 * d, altura: placa.altura - 2 * d })
  const partes = [
    retangulo(placa, 26, `fill="${alt(0.46)}"`),
    retangulo(dentro(9), 20, `fill="none" stroke="${alt(0.74)}" stroke-width="18"`),
    retangulo(dentro(6), 22, `fill="none" stroke="${alt(0.9)}" stroke-width="4"`),
    retangulo(dentro(30), 12, `fill="none" stroke="#000" stroke-opacity="0.42" stroke-width="5"`),
  ]
  // Rebites na moldura, um a cada ~86 unidades, os quatro cantos garantidos.
  const r = dentro(9)
  const porLado = (comprimento: number) => Math.max(2, Math.round(comprimento / 86))
  const nx = porLado(r.largura)
  const ny = porLado(r.altura)
  for (let i = 0; i <= nx; i++) {
    const x = r.x + 14 + ((r.largura - 28) * i) / nx
    partes.push(circulo(x, r.y + 2, 8, DOMO_CUPULA), circulo(x, r.y + r.altura - 2, 8, DOMO_CUPULA))
  }
  for (let j = 1; j < ny; j++) {
    const y = r.y + 14 + ((r.altura - 28) * j) / ny
    partes.push(circulo(r.x + 2, y, 8, DOMO_CUPULA), circulo(r.x + r.largura - 2, y, 8, DOMO_CUPULA))
  }
  return partes.join('')
}

/** O cartucho de um lampião: a moldura rasa, a roseta e o gancho do lampião, a fenda da alavanca e o número. */
function cartucho(celula: CelulaDoPainel, n: number): string {
  const k = celula.escala
  const margem = 10 * k
  const moldura: Caixa = { x: celula.x + margem, y: celula.y + margem, largura: celula.largura - 2 * margem, altura: celula.altura - 2 * margem }
  // O gancho acompanha o tamanho do lampião (a argola dele pendura ali).
  const kl = celula.lampiao.altura / ALTURA_DO_LAMPIAO
  const roseta = { x: celula.lampiao.x + celula.lampiao.largura / 2, y: celula.lampiao.y + 14 * kl }
  const meia = (BRACO_DA_ALAVANCA + 12) * k
  const fenda: Caixa = { x: celula.eixo.x - 12 * k, y: celula.eixo.y - meia, largura: 24 * k, altura: 2 * meia }
  const em = (d: number): Caixa => ({ x: fenda.x - d, y: fenda.y - d, largura: fenda.largura + 2 * d, altura: fenda.altura + 2 * d })
  return [
    retangulo(moldura, 14 * k, `fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="${num(4 * k)}"`),
    retangulo({ ...moldura, x: moldura.x + 3 * k, y: moldura.y + 3 * k }, 14 * k, `fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="${num(2 * k)}"`),
    // a roseta onde o gancho entra na chapa
    circulo(roseta.x, roseta.y, 26 * kl, DOMO_MEIO),
    circulo(roseta.x, roseta.y, 12 * kl, DOMO_CUPULA),
    // o gancho: sobe da roseta e faz a curva onde a argola do lampião pendura
    tubo(`M${num(roseta.x)},${num(roseta.y)}C${num(roseta.x + 30 * kl)},${num(roseta.y - 26 * kl)} ${num(roseta.x + 8 * kl)},${num(roseta.y - 40 * kl)} ${num(roseta.x - 4 * kl)},${num(roseta.y - 22 * kl)}`, 9 * kl, 0.55, 0.95),
    // a fenda: o espelho levantado em volta e o vão fundo
    retangulo(em(14 * k), 22 * k, `fill="${alt(0.72)}"`),
    retangulo(em(9 * k), 18 * k, `fill="none" stroke="${alt(0.9)}" stroke-width="${num(3 * k)}"`),
    retangulo(fenda, 12 * k, `fill="${alt(0.04)}"`),
    circulo(fenda.x + fenda.largura / 2, fenda.y - 7 * k, 5 * k, DOMO_CUPULA),
    circulo(fenda.x + fenda.largura / 2, fenda.y + fenda.altura + 7 * k, 5 * k, DOMO_CUPULA),
    // o número, gravado (afunda o metal)
    `<text x="${num(celula.numero.x)}" y="${num(celula.numero.y)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${num(30 * k)}" font-weight="700" fill="#000" fill-opacity="0.5">${n}</text>`,
  ].join('')
}

/** A plaqueta do desenho: sóis em relevo onde o lampião precisa estar aceso, argolas fundas onde apagado. */
function plaquetaDoDesenho(plaqueta: Caixa, desenho: readonly boolean[], colunas: number): string {
  const partes = [retangulo(plaqueta, 12, `fill="${alt(0.6)}"`), retangulo({ x: plaqueta.x + 6, y: plaqueta.y + 6, largura: plaqueta.largura - 12, altura: plaqueta.altura - 12 }, 8, `fill="none" stroke="${alt(0.86)}" stroke-width="4"`)]
  desenho.forEach((acesa, i) => {
    const cx = plaqueta.x + 26 + 20 + (i % colunas) * 40
    const cy = plaqueta.y + 17 + 18 + Math.floor(i / colunas) * 36
    if (acesa) {
      partes.push(circulo(cx, cy, 8, DOMO_CUPULA))
      let raios = ''
      for (let r = 0; r < 8; r++) {
        const [x1, y1] = polar(cx, cy, 11, r * 45)
        const [x2, y2] = polar(cx, cy, 15, r * 45)
        raios += `M${num(x1)},${num(y1)}L${num(x2)},${num(y2)}`
      }
      partes.push(friso(raios, 2.6, 0.55))
    } else {
      partes.push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="9" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="3.4"/>`)
    }
  })
  return partes.join('')
}

function svgDaBase(material: MaterialDosInterruptores, quantos: number, desenho: readonly boolean[] | null): string {
  reiniciarDomos()
  const g = geometriaDoPainel(quantos, desenho !== null)
  const caixaDoFiltro = `x="${num(g.placa.x - 12)}" y="${num(g.placa.y - 12)}" width="${num(g.placa.largura + 24)}" height="${num(g.placa.altura + 24)}"`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA_DO_QUADRO} ${ALTURA_DO_QUADRO}" width="${LARGURA_DO_QUADRO}" height="${ALTURA_DO_QUADRO}">`,
    '<defs>',
    FILTROS_DA_PAREDE,
    defsDeAltura(),
    filtroDeMetal('int-chapa', METAL_DA_CHAPA[material], LUZ_DE_LADO, caixaDoFiltro),
    '</defs>',
    parede(),
    // a sombra da chapa na parede (a luz vem de cima à esquerda)
    `<g filter="url(#grt-sombra)" opacity="0.85">${retangulo({ ...g.placa, x: g.placa.x + 18, y: g.placa.y + 24 }, 26, 'fill="#000"')}</g>`,
    `<g filter="url(#int-chapa)">${chapa(g.placa)}${g.celulas.map((celula, i) => cartucho(celula, i + 1)).join('')}${g.plaqueta !== null && desenho !== null ? plaquetaDoDesenho(g.plaqueta, desenho, g.colunas) : ''}</g>`,
    '</svg>',
  ].join('')
}

const bases = new Map<string, string>()

/** A base do painel como dado de `<img>`, guardada por material, tamanho e desenho da plaqueta. */
export function urlDaBaseDoPainel(material: MaterialDosInterruptores, quantos: number, desenho: readonly boolean[] | null): string {
  const chave = `${material}|${quantos}|${desenho === null ? '-' : desenho.map((acesa) => (acesa ? 1 : 0)).join('')}`
  const pronta = bases.get(chave)
  if (pronta !== undefined) return pronta
  const url = paraUrl(svgDaBase(material, quantos, desenho))
  bases.set(chave, url)
  return url
}

// ------------------------------------------------------------------ o lampião, em camadas (120 x 240)

export function paraUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function svgDoLampiao(conteudo: string, defs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA_DO_LAMPIAO} ${ALTURA_DO_LAMPIAO}" width="${LARGURA_DO_LAMPIAO * 2}" height="${ALTURA_DO_LAMPIAO * 2}"><defs>${defs}</defs>${conteudo}</svg>`
}

/** O vidro do lampião: um bojo que alarga no meio e estreita na boca. */
const BOJO = 'M36,70C22,92 20,150 34,184H86C100,150 98,92 84,70Z'

/** O degradê de um lado ao outro (esquerda para a direita): a luz corre pelo metal redondo do lampião. */
function degradeDeLado(id: string, paradas: readonly (readonly [number, string, number?])[]): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${paradas.map(([p, cor, op]) => `<stop offset="${p}" stop-color="${cor}"${op === undefined ? '' : ` stop-opacity="${op}"`}/>`).join('')}</linearGradient>`
}

/** O vidro frio: fumê, com o reflexo comprido da sala e o pavio apagado lá dentro. */
function svgDoVidroApagado(): string {
  return svgDoLampiao(
    [
      `<path d="${BOJO}" fill="url(#v)"/>`,
      // o pavio e o queimador, escuros
      '<rect x="53" y="150" width="14" height="32" rx="2" fill="#16110c"/>',
      '<rect x="57" y="140" width="6" height="12" rx="2" fill="#0c0906"/>',
      // o reflexo frio da sala, comprido, à esquerda; um mais curto à direita
      '<path d="M38,84C31,104 30,140 37,168" fill="none" stroke="#dfe7ee" stroke-opacity="0.28" stroke-width="5" stroke-linecap="round"/>',
      '<path d="M82,96C86,112 86,130 83,146" fill="none" stroke="#dfe7ee" stroke-opacity="0.12" stroke-width="3" stroke-linecap="round"/>',
    ].join(''),
    degradeDeLado('v', [
      [0, '#3a3a38', 0.92],
      [0.45, '#141413', 0.94],
      [1, '#2e2d2a', 0.92],
    ]),
  )
}

/** O vidro aceso: o bojo inteiro em brasa, mais claro no meio, com o reflexo quente da chama no vidro. */
function svgDoVidroAceso(): string {
  return svgDoLampiao(
    [
      `<path d="${BOJO}" fill="url(#a)"/>`,
      '<g filter="url(#b)"><ellipse cx="60" cy="128" rx="24" ry="40" fill="#fff4cf" fill-opacity="0.9"/></g>',
      '<rect x="53" y="156" width="14" height="26" rx="2" fill="#3b1d08" fill-opacity="0.75"/>',
      '<path d="M38,84C31,104 30,140 37,168" fill="none" stroke="#fff8e6" stroke-opacity="0.5" stroke-width="4" stroke-linecap="round"/>',
    ].join(''),
    [
      degradeDeLado('a', [
        [0, '#d06a1c', 0.95],
        [0.28, '#ffb44c', 0.96],
        [0.5, '#ffe2a0', 0.97],
        [0.72, '#ffae46', 0.96],
        [1, '#c45f17', 0.95],
      ]),
      '<filter id="b" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="9"/></filter>',
    ].join(''),
  )
}

/** A chama sozinha, no centro do bojo: um pingo branco por dentro, laranja por fora, azul no pé. */
function svgDaChama(): string {
  const gota = (escala: number) => `M60,${num(132 - 40 * escala)}C${num(60 + 16 * escala)},${num(132 - 12 * escala)} ${num(60 + 17 * escala)},${num(132 + 14 * escala)} 60,${num(132 + 22 * escala)}C${num(60 - 17 * escala)},${num(132 + 14 * escala)} ${num(60 - 16 * escala)},${num(132 - 12 * escala)} 60,${num(132 - 40 * escala)}Z`
  return svgDoLampiao(
    [
      `<g filter="url(#h)"><path d="${gota(1.25)}" fill="#ff8a24" fill-opacity="0.8"/></g>`,
      `<path d="${gota(1)}" fill="url(#c)"/>`,
      `<path d="${gota(0.55)}" fill="#fffbea"/>`,
      '<ellipse cx="60" cy="150" rx="7" ry="4" fill="#7fb6ff" fill-opacity="0.75"/>',
    ].join(''),
    [
      '<linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a12"/><stop offset="0.45" stop-color="#ffbe45"/><stop offset="0.85" stop-color="#fff0bb"/><stop offset="1" stop-color="#ffd68a"/></linearGradient>',
      '<filter id="h" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="5"/></filter>',
    ].join(''),
  )
}

/** O corpo de metal: a argola, o chapéu, o colar, a gaiola por cima do vidro, o depósito com o registro do gás. */
function svgDoCorpo(material: MaterialDosInterruptores): string {
  const [escuro, meio, claro, brilho] = TINTA_DO_METAL[material]
  const metal = degradeDeLado('m', [
    [0, escuro],
    [0.3, claro],
    [0.42, brilho],
    [0.6, meio],
    [1, escuro],
  ])
  const barra = (x: number, curva: number) => `<path d="M${x},72C${x + curva},104 ${x + curva},150 ${x},184" fill="none" stroke="url(#m)" stroke-width="4.2" stroke-linecap="round"/>`
  return svgDoLampiao(
    [
      // a argola de pendurar
      `<circle cx="60" cy="13" r="9" fill="none" stroke="url(#m)" stroke-width="4.5"/>`,
      // o chapéu: um telhado com respiros
      `<path d="M22,66L44,28H76L98,66Z" fill="url(#m)"/>`,
      `<path d="M42,33H78" stroke="${brilho}" stroke-opacity="0.45" stroke-width="2"/>`,
      `<path d="M48,48h6M58,48h6M68,48h6" stroke="${escuro}" stroke-width="4" stroke-linecap="round"/>`,
      `<rect x="56" y="20" width="8" height="10" rx="2" fill="url(#m)"/>`,
      // o colar e a gaiola
      `<rect x="26" y="62" width="68" height="11" rx="3" fill="url(#m)"/>`,
      barra(36, -8),
      barra(60, 0),
      barra(84, 8),
      `<path d="M28,128C40,132 80,132 92,128" fill="none" stroke="url(#m)" stroke-width="3.6"/>`,
      // o depósito, o pé e o registro do gás à direita
      `<path d="M28,182H92L85,216H35Z" fill="url(#m)"/>`,
      `<path d="M30,186H90" stroke="${brilho}" stroke-opacity="0.35" stroke-width="2"/>`,
      `<rect x="44" y="215" width="32" height="10" rx="3" fill="url(#m)"/>`,
      `<rect x="50" y="224" width="20" height="9" rx="3" fill="${escuro}"/>`,
      // a haste do registro é retângulo: um traço reto tem caixa de altura zero e o degradê nele some
      `<rect x="86" y="197.5" width="16" height="5" rx="2.5" fill="url(#m)"/>`,
      `<circle cx="104" cy="200" r="7" fill="url(#m)"/>`,
      `<circle cx="104" cy="200" r="2.4" fill="${escuro}"/>`,
    ].join(''),
    metal,
  )
}

/** O reflexo da chama no metal: o miolo da gaiola e a barriga do chapéu esquentam (somado por cima). */
function svgDoReflexo(): string {
  return svgDoLampiao(
    [
      '<path d="M36,72C28,104 28,150 36,184M60,72V184M84,72C92,104 92,150 84,184" fill="none" stroke="#ffcf86" stroke-opacity="0.75" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M26,66H94" stroke="#ffbe6a" stroke-opacity="0.7" stroke-width="4"/>',
      '<path d="M30,184H90" stroke="#ffbe6a" stroke-opacity="0.8" stroke-width="3"/>',
    ].join(''),
  )
}

/** O clarão que a chama joga em volta: elipses borradas, do largo e fraco ao pequeno e forte. */
function svgDoClarao(): string {
  const c = LADO_DO_CLARAO / 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO_DO_CLARAO} ${LADO_DO_CLARAO}" width="${LADO_DO_CLARAO / 2}" height="${LADO_DO_CLARAO / 2}">`,
    '<defs><filter id="l" x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="54"/></filter><filter id="m" x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="26"/></filter></defs>',
    `<g filter="url(#l)"><circle cx="${c}" cy="${c + 10}" r="190" fill="#ff8f33" fill-opacity="0.42"/></g>`,
    `<g filter="url(#m)"><ellipse cx="${c}" cy="${c}" rx="78" ry="112" fill="#ffc46e" fill-opacity="0.55"/></g>`,
    '</svg>',
  ].join('')
}

/** A haste da alavanca: um cilindro de metal (de pé; a tela o encurta e vira ao puxar). */
function svgDaHaste(material: MaterialDosInterruptores): string {
  const [escuro, meio, claro, brilho] = TINTA_DO_METAL[material]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 58" width="24" height="116" preserveAspectRatio="none"><defs>${degradeDeLado('m', [
    [0, escuro],
    [0.35, claro],
    [0.5, brilho],
    [0.7, meio],
    [1, escuro],
  ])}</defs><rect x="0" y="0" width="12" height="58" rx="5" fill="url(#m)"/></svg>`
}

/** O punho: uma bola de madeira escura envernizada, com o brilho da sala em cima à esquerda. */
function svgDoPunho(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 46" width="92" height="92">',
    '<defs><linearGradient id="p" x1="0.15" y1="0.1" x2="0.85" y2="0.95"><stop offset="0" stop-color="#8a4a26"/><stop offset="0.45" stop-color="#4a2312"/><stop offset="1" stop-color="#160a05"/></linearGradient>',
    '<filter id="s" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.6"/></filter></defs>',
    '<circle cx="23" cy="23" r="21" fill="url(#p)"/>',
    '<circle cx="23" cy="23" r="20.5" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1.2"/>',
    '<g filter="url(#s)"><ellipse cx="16" cy="14" rx="7" ry="4.5" fill="#ffe9cf" fill-opacity="0.55" transform="rotate(-32 16 14)"/></g>',
    '</svg>',
  ].join('')
}

// ------------------------------------------------------------------ as URLs, uma vez cada

const prontas = new Map<string, string>()

function guardada(chave: string, svg: () => string): string {
  const pronta = prontas.get(chave)
  if (pronta !== undefined) return pronta
  const url = paraUrl(svg())
  prontas.set(chave, url)
  return url
}

export interface ArteDoLampiao {
  vidro: string
  aceso: string
  chama: string
  corpo: string
  reflexo: string
  clarao: string
  haste: string
  punho: string
}

/** As camadas do lampião e da alavanca no material do painel. */
export function arteDoLampiao(material: MaterialDosInterruptores): ArteDoLampiao {
  return {
    vidro: guardada('vidro', svgDoVidroApagado),
    aceso: guardada('aceso', svgDoVidroAceso),
    chama: guardada('chama', svgDaChama),
    corpo: guardada(`corpo|${material}`, () => svgDoCorpo(material)),
    reflexo: guardada('reflexo', svgDoReflexo),
    clarao: guardada('clarao', svgDoClarao),
    haste: guardada(`haste|${material}`, () => svgDaHaste(material)),
    punho: guardada('punho', svgDoPunho),
  }
}

/** Só para a página de prova da arte: os SVGs crus. */
export const arteParaProva = { svgDaBase, svgDoCorpo, svgDoVidroAceso }
