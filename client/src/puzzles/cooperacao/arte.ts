/**
 * A ARTE DA COOPERAÇÃO EM DOIS LUGARES (28/11): uma chapa de latão ou de ferro
 * cravada na parede, com uma coluna por ponto do mapa. Em cada coluna, de cima
 * para baixo: a plaqueta com o nome do ponto (o texto é da tela), o lampião a
 * gás pendurado no gancho, o mostrador da janela (o anel que esvazia enquanto o
 * lampião fica aceso) e o controle daquele lugar: a alavanca na fenda, a placa
 * de pressão no poço ou o botão no painel. Um cano de latão liga os
 * mostradores: é o mecanismo que só cede com todos acesos. Desenhado por
 * código, original; tudo vira dado de `<img>`.
 *
 * Reaproveita o lampião, a haste e o punho dos interruptores (o mesmo gás, a
 * mesma oficina) e a parede e o filtro de metal das peças giratórias. Nenhum
 * degradê radial (caro de compilar no Edge frio): o que brilha é elipse borrada.
 */
import { DOMO_CUPULA, DOMO_MEIO, alt, circulo, defsDeAltura, num, reiniciarDomos, tubo } from '../relevo/cenas/comum'
import { FILTROS_DA_PAREDE, LUZ_DE_LADO, filtroDeMetal, parede } from '../giratorias/arte'
import { ALTURA_DO_LAMPIAO, LARGURA_DO_LAMPIAO, METAL_DA_CHAPA, TINTA_DO_METAL, chapa, paraUrl, retangulo, type Caixa } from '../interruptores/arte'
import type { ArteDoPonto, MaterialDosInterruptores } from '../tipos'

export { arteDoLampiao } from '../interruptores/arte'

export const LARGURA_DO_QUADRO = 1600
export const ALTURA_DO_QUADRO = 1000

/** O braço da alavanca grande (do eixo ao centro do punho), o punho e a haste: o dobro da do painel de lampiões. */
export const BRACO_DA_ALAVANCA = 112
export const LADO_DO_PUNHO = 88
const LARGURA_DA_HASTE = 22
/** O lado do clarão da chama na chapa. */
const LADO_DO_CLARAO = 560
/** Onde a chama fica no lampião (120 x 240). */
const CHAMA_NO_LAMPIAO = { x: 60, y: 132 }

export interface CelulaDoPonto extends Caixa {
  rotulo: Caixa
  lampiao: Caixa
  clarao: Caixa
  mostrador: { x: number; y: number; r: number }
  /** A área do controle: o alvo de toque inteiro. */
  controle: Caixa
  eixo: { x: number; y: number }
  haste: Caixa
  punho: Caixa
  /** A placa de pressão (a tampa que afunda) e o botão (a cúpula que desce). */
  placa: Caixa
  botao: Caixa
}

export interface GeometriaDaCooperacao {
  placa: Caixa
  celulas: CelulaDoPonto[]
}

const PLACA: Caixa = { x: 120, y: 44, largura: 1360, altura: 912 }
const MARGEM = 46
const VAO = 34

/** Onde cada coisa fica, para 2 ou 3 pontos. */
export function geometriaDaCooperacao(quantos: number): GeometriaDaCooperacao {
  const largura = (PLACA.largura - 2 * MARGEM - (quantos - 1) * VAO) / quantos
  const altura = PLACA.altura - 2 * MARGEM
  const celulas = Array.from({ length: quantos }, (_, i): CelulaDoPonto => {
    const x = PLACA.x + MARGEM + i * (largura + VAO)
    const y = PLACA.y + MARGEM
    const meio = x + largura / 2
    const lampiao: Caixa = { x: meio - LARGURA_DO_LAMPIAO / 2, y: y + 106, largura: LARGURA_DO_LAMPIAO, altura: ALTURA_DO_LAMPIAO }
    const chama = { x: lampiao.x + CHAMA_NO_LAMPIAO.x, y: lampiao.y + CHAMA_NO_LAMPIAO.y }
    const eixo = { x: meio, y: y + 640 }
    const larguraDoRotulo = Math.min(largura - 44, 360)
    return {
      x,
      y,
      largura,
      altura,
      rotulo: { x: meio - larguraDoRotulo / 2, y: y + 20, largura: larguraDoRotulo, altura: 62 },
      lampiao,
      clarao: { x: chama.x - LADO_DO_CLARAO / 2, y: chama.y - LADO_DO_CLARAO / 2, largura: LADO_DO_CLARAO, altura: LADO_DO_CLARAO },
      mostrador: { x: meio, y: y + 408, r: 40 },
      controle: { x: x + 14, y: y + 470, largura: largura - 28, altura: altura - 484 },
      eixo,
      haste: { x: eixo.x - LARGURA_DA_HASTE / 2, y: eixo.y - BRACO_DA_ALAVANCA, largura: LARGURA_DA_HASTE, altura: BRACO_DA_ALAVANCA },
      punho: { x: eixo.x - LADO_DO_PUNHO / 2, y: eixo.y - BRACO_DA_ALAVANCA - LADO_DO_PUNHO / 2, largura: LADO_DO_PUNHO, altura: LADO_DO_PUNHO },
      placa: { x: meio - 150, y: eixo.y - 70, largura: 300, altura: 170 },
      botao: { x: meio - 74, y: eixo.y - 74, largura: 148, altura: 148 },
    }
  })
  return { placa: PLACA, celulas }
}

// ------------------------------------------------------------------ a base: parede, chapa, nichos, mostradores, o cano e os assentos

/** O assento do controle na chapa (em altura): a fenda com o espelho, o poço da placa ou o painel do botão. */
function assento(celula: CelulaDoPonto, arte: ArteDoPonto): string {
  const { eixo } = celula
  if (arte === 'alavanca') {
    const meia = BRACO_DA_ALAVANCA + 18
    const fenda: Caixa = { x: eixo.x - 18, y: eixo.y - meia, largura: 36, altura: 2 * meia }
    const em = (d: number): Caixa => ({ x: fenda.x - d, y: fenda.y - d, largura: fenda.largura + 2 * d, altura: fenda.altura + 2 * d })
    return [
      retangulo(em(30), 34, `fill="${alt(0.7)}"`),
      retangulo(em(22), 28, `fill="none" stroke="${alt(0.9)}" stroke-width="4"`),
      retangulo(fenda, 16, `fill="${alt(0.04)}"`),
      circulo(eixo.x, fenda.y - 14, 8, DOMO_CUPULA),
      circulo(eixo.x, fenda.y + fenda.altura + 14, 8, DOMO_CUPULA),
      // as marcas de cima e de baixo: em cima, parado; embaixo, puxado
      `<path d="M${num(eixo.x + 46)},${num(fenda.y + 10)}h22M${num(eixo.x + 46)},${num(fenda.y + fenda.altura - 10)}h22" stroke="${alt(0.92)}" stroke-width="5" stroke-linecap="round"/>`,
    ].join('')
  }
  if (arte === 'placa') {
    // O poço visto de cima e de frente: um trapézio fundo, com a borda chanfrada.
    const p = celula.placa
    const poco = (d: number) => `M${num(p.x - d - 18)},${num(p.y + p.altura + d)}L${num(p.x + 24 - d)},${num(p.y - d)}H${num(p.x + p.largura - 24 + d)}L${num(p.x + p.largura + d + 18)},${num(p.y + p.altura + d)}Z`
    return [`<path d="${poco(22)}" fill="${alt(0.68)}"/>`, `<path d="${poco(14)}" fill="none" stroke="${alt(0.88)}" stroke-width="4"/>`, `<path d="${poco(4)}" fill="${alt(0.06)}"/>`].join('')
  }
  // O painel do botão: um quadro levantado, rebitado, com o aro fundo onde a cúpula desce.
  const b = celula.botao
  const painel: Caixa = { x: b.x - 46, y: b.y - 46, largura: b.largura + 92, altura: b.altura + 92 }
  const cx = b.x + b.largura / 2
  const cy = b.y + b.altura / 2
  return [
    retangulo(painel, 22, `fill="${alt(0.7)}"`),
    retangulo({ x: painel.x + 8, y: painel.y + 8, largura: painel.largura - 16, altura: painel.altura - 16 }, 16, `fill="none" stroke="${alt(0.9)}" stroke-width="4"`),
    ...[
      [painel.x + 22, painel.y + 22],
      [painel.x + painel.largura - 22, painel.y + 22],
      [painel.x + 22, painel.y + painel.altura - 22],
      [painel.x + painel.largura - 22, painel.y + painel.altura - 22],
    ].map(([x, y]) => circulo(x ?? 0, y ?? 0, 8, DOMO_CUPULA)),
    circulo(cx, cy, b.largura / 2 + 16, DOMO_MEIO),
    circulo(cx, cy, b.largura / 2 + 4, alt(0.05)),
  ].join('')
}

/** O nicho de um ponto: a moldura rasa, o rebaixo da plaqueta, a roseta do gancho, o mostrador e o assento. */
function nicho(celula: CelulaDoPonto, arte: ArteDoPonto): string {
  const moldura: Caixa = { x: celula.x + 6, y: celula.y + 6, largura: celula.largura - 12, altura: celula.altura - 12 }
  const roseta = { x: celula.lampiao.x + celula.lampiao.largura / 2, y: celula.lampiao.y + 14 }
  const m = celula.mostrador
  return [
    retangulo(moldura, 18, `fill="none" stroke="#000" stroke-opacity="0.24" stroke-width="5"`),
    retangulo({ ...moldura, x: moldura.x + 3, y: moldura.y + 3 }, 18, `fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="2"`),
    // o rebaixo da plaqueta do nome (o nome é da tela, por cima)
    retangulo(celula.rotulo, 12, `fill="${alt(0.3)}"`),
    retangulo({ x: celula.rotulo.x + 5, y: celula.rotulo.y + 5, largura: celula.rotulo.largura - 10, altura: celula.rotulo.altura - 10 }, 8, `fill="none" stroke="${alt(0.62)}" stroke-width="3"`),
    // a roseta e o gancho do lampião
    circulo(roseta.x, roseta.y, 26, DOMO_MEIO),
    circulo(roseta.x, roseta.y, 12, DOMO_CUPULA),
    tubo(`M${num(roseta.x)},${num(roseta.y)}C${num(roseta.x + 30)},${num(roseta.y - 26)} ${num(roseta.x + 8)},${num(roseta.y - 40)} ${num(roseta.x - 4)},${num(roseta.y - 22)}`, 9, 0.55, 0.95),
    // o mostrador: o aro levantado e o fundo escuro onde o anel de luz corre
    circulo(m.x, m.y, m.r + 18, DOMO_MEIO),
    circulo(m.x, m.y, m.r + 4, alt(0.1)),
    circulo(m.x, m.y, 9, DOMO_CUPULA),
    assento(celula, arte),
  ].join('')
}

/** O cano que liga os mostradores: passa por trás de cada um, de ponta a ponta da chapa. */
function cano(g: GeometriaDaCooperacao): string {
  const primeiro = g.celulas[0]
  const ultimo = g.celulas[g.celulas.length - 1]
  if (primeiro === undefined || ultimo === undefined) return ''
  const y = primeiro.mostrador.y
  const ida = `M${num(g.placa.x + 30)},${num(y)}H${num(g.placa.x + g.placa.largura - 30)}`
  const bracadeiras = g.celulas.slice(0, -1).map((celula) => {
    const x = celula.x + celula.largura + VAO / 2
    return circulo(x, y, 15, DOMO_CUPULA)
  })
  return [tubo(ida, 22, 0.5, 0.97), ...bracadeiras].join('')
}

function svgDaBase(material: MaterialDosInterruptores, artes: readonly ArteDoPonto[]): string {
  reiniciarDomos()
  const g = geometriaDaCooperacao(artes.length)
  const caixaDoFiltro = `x="${num(g.placa.x - 12)}" y="${num(g.placa.y - 12)}" width="${num(g.placa.largura + 24)}" height="${num(g.placa.altura + 24)}"`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA_DO_QUADRO} ${ALTURA_DO_QUADRO}" width="${LARGURA_DO_QUADRO}" height="${ALTURA_DO_QUADRO}">`,
    '<defs>',
    FILTROS_DA_PAREDE,
    defsDeAltura(),
    filtroDeMetal('coop-chapa', METAL_DA_CHAPA[material], LUZ_DE_LADO, caixaDoFiltro),
    '</defs>',
    parede(),
    `<g filter="url(#grt-sombra)" opacity="0.85">${retangulo({ ...g.placa, x: g.placa.x + 18, y: g.placa.y + 24 }, 26, 'fill="#000"')}</g>`,
    `<g filter="url(#coop-chapa)">${chapa(g.placa)}${cano(g)}${g.celulas.map((celula, i) => nicho(celula, artes[i] ?? 'alavanca')).join('')}</g>`,
    '</svg>',
  ].join('')
}

const bases = new Map<string, string>()

/** A base como dado de `<img>`, guardada por material e pelas artes dos pontos. */
export function urlDaBaseDaCooperacao(material: MaterialDosInterruptores, artes: readonly ArteDoPonto[]): string {
  const chave = `${material}|${artes.join(',')}`
  const pronta = bases.get(chave)
  if (pronta !== undefined) return pronta
  const url = paraUrl(svgDaBase(material, artes))
  bases.set(chave, url)
  return url
}

// ------------------------------------------------------------------ as peças que se mexem: a tampa da placa e a cúpula do botão

function degradeDeCima(id: string, paradas: readonly (readonly [number, string])[]): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${paradas.map(([p, cor]) => `<stop offset="${p}" stop-color="${cor}"/>`).join('')}</linearGradient>`
}

/** A tampa da placa de pressão: chapa grossa com o xadrez de losangos antiderrapante, quatro parafusos e a borda gasta de tanto pé. */
function svgDaPlaca(material: MaterialDosInterruptores): string {
  const [escuro, meio, claro, brilho] = TINTA_DO_METAL[material]
  const losangos: string[] = []
  for (let linha = 0; linha < 5; linha++) {
    for (let coluna = 0; coluna < 9; coluna++) {
      const x = 46 + coluna * 26 + (linha % 2) * 13
      const y = 34 + linha * 22
      losangos.push(`<path d="M${x},${y - 6}l9,6l-9,6l-9,-6Z"/>`)
    }
  }
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170" width="600" height="340">',
    `<defs>${degradeDeCima('t', [
      [0, claro],
      [0.35, meio],
      [1, escuro],
    ])}<filter id="b" x="-0.2" y="-0.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="3"/></filter></defs>`,
    // o corpo da tampa: o mesmo trapézio do poço, um pouco menor
    '<path d="M6,166L34,8H266L294,166Z" fill="url(#t)"/>',
    `<path d="M34,8H266" stroke="${brilho}" stroke-opacity="0.55" stroke-width="3"/>`,
    `<path d="M6,166L34,8M294,166L266,8" stroke="${escuro}" stroke-opacity="0.6" stroke-width="3"/>`,
    `<g fill="${escuro}" fill-opacity="0.5">${losangos.join('')}</g>`,
    `<g fill="${brilho}" fill-opacity="0.16" transform="translate(0,-2)">${losangos.join('')}</g>`,
    // o gasto no meio: o metal brilha onde se pisa
    `<g filter="url(#b)"><ellipse cx="150" cy="96" rx="78" ry="30" fill="${brilho}" fill-opacity="0.2"/></g>`,
    ...[
      [44, 26],
      [256, 26],
      [26, 148],
      [274, 148],
    ].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${meio}" stroke="${escuro}" stroke-width="2"/><path d="M${(x ?? 0) - 4},${y}h8" stroke="${escuro}" stroke-width="2"/>`),
    '</svg>',
  ].join('')
}

/** A cúpula do botão: latão (ou ferro) torneado, com o anel de aperto e o brilho da sala em cima à esquerda. */
function svgDoBotao(material: MaterialDosInterruptores): string {
  const [escuro, meio, claro, brilho] = TINTA_DO_METAL[material]
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 148 148" width="296" height="296">',
    `<defs>${degradeDeCima('c', [
      [0, brilho],
      [0.22, claro],
      [0.62, meio],
      [1, escuro],
    ])}${degradeDeCima('a', [
      [0, escuro],
      [0.5, meio],
      [1, claro],
    ])}<filter id="s" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4"/></filter></defs>`,
    '<circle cx="74" cy="74" r="72" fill="url(#a)"/>',
    '<circle cx="74" cy="74" r="58" fill="url(#c)"/>',
    `<circle cx="74" cy="74" r="58" fill="none" stroke="${escuro}" stroke-opacity="0.55" stroke-width="2.5"/>`,
    `<circle cx="74" cy="74" r="40" fill="none" stroke="${escuro}" stroke-opacity="0.28" stroke-width="2"/>`,
    `<g filter="url(#s)"><ellipse cx="54" cy="46" rx="22" ry="12" fill="#fff8e6" fill-opacity="0.6" transform="rotate(-30 54 46)"/></g>`,
    '</svg>',
  ].join('')
}

/** O brilho que o lampião aceso joga no controle do ponto: um calor por cima, somado. */
function svgDoCalor(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">',
    '<defs><filter id="l" x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="22"/></filter></defs>',
    '<g filter="url(#l)"><ellipse cx="100" cy="100" rx="70" ry="56" fill="#ffb760" fill-opacity="0.5"/></g>',
    '</svg>',
  ].join('')
}

function svgDoClarao(): string {
  const c = LADO_DO_CLARAO / 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO_DO_CLARAO} ${LADO_DO_CLARAO}" width="${LADO_DO_CLARAO / 2}" height="${LADO_DO_CLARAO / 2}">`,
    '<defs><filter id="l" x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="50"/></filter><filter id="m" x="-0.5" y="-0.5" width="2" height="2"><feGaussianBlur stdDeviation="24"/></filter></defs>',
    `<g filter="url(#l)"><circle cx="${c}" cy="${c + 10}" r="170" fill="#ff8f33" fill-opacity="0.42"/></g>`,
    `<g filter="url(#m)"><ellipse cx="${c}" cy="${c}" rx="72" ry="104" fill="#ffc46e" fill-opacity="0.55"/></g>`,
    '</svg>',
  ].join('')
}

const prontas = new Map<string, string>()

function guardada(chave: string, svg: () => string): string {
  const pronta = prontas.get(chave)
  if (pronta !== undefined) return pronta
  const url = paraUrl(svg())
  prontas.set(chave, url)
  return url
}

export interface ArteDosControles {
  placa: string
  botao: string
  calor: string
  clarao: string
}

export function arteDosControles(material: MaterialDosInterruptores): ArteDosControles {
  return {
    placa: guardada(`placa|${material}`, () => svgDaPlaca(material)),
    botao: guardada(`botao|${material}`, () => svgDoBotao(material)),
    calor: guardada('calor', svgDoCalor),
    clarao: guardada('clarao', svgDoClarao),
  }
}

/** Só para a página de prova da arte: os SVGs crus. */
export const arteParaProva = { svgDaBase, svgDaPlaca, svgDoBotao }
