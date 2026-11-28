/**
 * A ARTE DAS PEÇAS GIRATÓRIAS (28/11): o medalhão de anéis, desenhado por
 * código, original. Duas imagens SVG, cada uma dado de `<img>` (o navegador as
 * desenha fora da linha principal, como o painel em relevo):
 *
 * - O DISCO (`urlDoDisco`): tudo o que gira — a cena recortada num círculo, ou
 *   os anéis de símbolos —, num quadrado de 1000 x 1000. A tela empilha a MESMA
 *   imagem uma vez por anel, cada cópia recortada no círculo do seu anel e
 *   girada sozinha: o navegador lê o SVG uma vez só.
 * - A BASE (`urlDaBase`): a parede e o aro fixo com a marca, no 16:10 do quadro.
 *
 * A LUZ: o que gira não pode trazer a sombra junto (uma letra em relevo girada
 * 180 graus pareceria cavada). Por isso o disco é aceso de cima (luz a pino,
 * igual em qualquer giro): a altura vira cor (pátina no fundo, metal gasto no
 * alto) e os declives escurecem por igual. A luz de cima à esquerda mora no que
 * não gira: o aro da base e o brilho das juntas, por cima (`DiscoNoQuadro`).
 *
 * Mesma técnica do painel em relevo (`puzzles/relevo/arte.ts`): mapa de altura
 * em cinza e um filtro que o transforma em metal fundido ou pedra.
 */
import { relevoCavaleiro } from '../relevo/cenas/cavaleiro'
import { alt, circulo, defsDeAltura, DOMO_CUPULA, estrela, friso, num, polar, reiniciarDomos, tubo, vinco } from '../relevo/cenas/comum'
import { relevoDragao } from '../relevo/cenas/dragao'
import { relevoLeao } from '../relevo/cenas/leao'
import { relevoNavio } from '../relevo/cenas/navio'
import { relevoSerpente } from '../relevo/cenas/serpente'
import { relevoSolELua } from '../relevo/cenas/solELua'
import { PASSOS_DO_GIRO, SIMBOLOS_DO_ANEL } from '../tipos'
import type { CenaDoRelevo, MaterialDasGiratorias, SimboloDoAnel } from '../tipos'
import { DESLOCAMENTO_DO_ANEL } from './giratorias'

// ------------------------------------------------------------------ a geometria (em unidades do disco, 0 a 1000)

export const LADO_DO_DISCO = 1000
const CENTRO = LADO_DO_DISCO / 2
/** O raio de fora do anel de fora. */
export const RAIO_DO_DISCO = 440
/** O miolo fixo no meio. */
export const RAIO_DO_MIOLO = 96

/** O disco no quadro (1600 x 1000): 92% da altura, no meio. */
export const LARGURA_DA_BASE = 1600
export const ALTURA_DA_BASE = 1000
export const ESCALA_DO_DISCO_NA_BASE = 0.92

export interface RaiosDoAnel {
  fora: number
  dentro: number
}

/** Os raios de cada anel, de fora para dentro, todos da mesma largura. */
export function raiosDosAneis(aneis: number): RaiosDoAnel[] {
  const largura = (RAIO_DO_DISCO - RAIO_DO_MIOLO) / aneis
  return Array.from({ length: aneis }, (_, k) => ({ fora: RAIO_DO_DISCO - k * largura, dentro: RAIO_DO_DISCO - (k + 1) * largura }))
}

// ------------------------------------------------------------------ os materiais

interface Material {
  /** Cor pela altura (9 paradas, do fundo com pátina ao alto gasto). */
  tabela: readonly string[]
  brilho: string
  ks: number
  expoente: number
}

const MATERIAIS: Readonly<Record<MaterialDasGiratorias, Material>> = {
  // Os três metais do painel em relevo, para os dois combinarem na mesma sala.
  bronze: { tabela: ['#33493d', '#4a6553', '#3a4636', '#3b3226', '#4f3a23', '#6a4c2a', '#86632f', '#a37c3f', '#c09858'], brilho: '#f3d3a0', ks: 0.55, expoente: 20 },
  ferro: { tabela: ['#4f2a18', '#5a3320', '#35271f', '#232321', '#282927', '#30322f', '#3d403a', '#53564d', '#74766a'], brilho: '#c8d2c8', ks: 0.36, expoente: 16 },
  prata: { tabela: ['#17171a', '#222226', '#2f3035', '#3f4248', '#52565d', '#686d75', '#80868e', '#9ba1a8', '#bcc1c6'], brilho: '#e8eefa', ks: 0.75, expoente: 24 },
  // Pedra de templo: musgo escuro nas fendas, cinza no corpo, calcário gasto no alto.
  pedra: { tabela: ['#20241d', '#2d3326', '#3b4033', '#4b4c40', '#5d5b4c', '#716d5b', '#87816b', '#9d967d', '#b5ad92'], brilho: '#efe6cf', ks: 0.12, expoente: 8 },
}

function canal(tabela: readonly string[], c: 0 | 1 | 2): string {
  return tabela.map((h) => (parseInt(h.slice(1 + c * 2, 3 + c * 2), 16) / 255).toFixed(3)).join(' ')
}

const PARA_ALFA = '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0'
const ALFA_PARA_CINZA = '0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1'

interface Luz {
  /** `feDistantLight`: a pino (90) no que gira, de cima à esquerda no que não gira. */
  elevacao: number
  /** O difuso e o especular, ajustados à elevação (a pino, o plano recebe a luz toda). */
  kd: number
  fatorDoBrilho: number
}

const LUZ_A_PINO: Luz = { elevacao: 90, kd: 0.86, fatorDoBrilho: 0.14 }
const LUZ_DE_LADO: Luz = { elevacao: 38, kd: 1.3, fatorDoBrilho: 1 }

/** O filtro que transforma o mapa de altura em metal (ou pedra): relevo arredondado, pátina, luz. */
function filtroDoMaterial(id: string, material: MaterialDasGiratorias, luz: Luz, caixa: string): string {
  const m = MATERIAIS[material]
  const fonte = `<feDistantLight azimuth="225" elevation="${luz.elevacao}"/>`
  const cm = (entrada: string, valores: string, saida: string) => `<feColorMatrix in="${entrada}" type="matrix" values="${valores}" result="${saida}"/>`
  const ar = (a: string, b: string, k: string, saida: string) => `<feComposite in="${a}" in2="${b}" operator="arithmetic" ${k} result="${saida}"/>`
  return [
    `<filter id="${id}" filterUnits="userSpaceOnUse" ${caixa} color-interpolation-filters="sRGB">`,
    cm('SourceGraphic', PARA_ALFA, 'h0'),
    '<feGaussianBlur in="h0" stdDeviation="1.2" result="b1"/>',
    '<feGaussianBlur in="h0" stdDeviation="5" result="b2"/>',
    '<feGaussianBlur in="h0" stdDeviation="20" result="b3"/>',
    ar('b1', 'b2', 'k2="0.55" k3="0.27"', 'ha'),
    ar('ha', 'b3', 'k2="1" k3="0.18"', 'hs'),
    '<feTurbulence type="fractalNoise" baseFrequency="0.34" numOctaves="2" seed="13" result="gt"/>',
    cm('gt', PARA_ALFA, 'gr'),
    ar('hs', 'gr', `k2="1" k3="${material === 'pedra' ? '0.07' : '0.03'}" k4="${material === 'pedra' ? '-0.035' : '-0.015'}"`, 'h'),
    ar('h', 'b3', 'k2="2.2" k3="-2.2" k4="0.6"', 'cav'),
    '<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="9" result="pt"/>',
    cm('pt', PARA_ALFA, 'nz'),
    ar('h', 'nz', 'k2="0.55" k3="0.75" k4="-0.135"', 'p1'),
    ar('p1', 'cav', 'k2="1" k3="1" k4="-0.6"', 'p'),
    cm('p', ALFA_PARA_CINZA, 'pg'),
    `<feComponentTransfer in="pg" result="alb"><feFuncR type="table" tableValues="${canal(m.tabela, 0)}"/><feFuncG type="table" tableValues="${canal(m.tabela, 1)}"/><feFuncB type="table" tableValues="${canal(m.tabela, 2)}"/></feComponentTransfer>`,
    `<feDiffuseLighting in="h" surfaceScale="14" diffuseConstant="${luz.kd}" lighting-color="#fff" result="dif">${fonte}</feDiffuseLighting>`,
    `<feSpecularLighting in="h" surfaceScale="14" specularConstant="${(m.ks * luz.fatorDoBrilho).toFixed(3)}" specularExponent="${m.expoente}" lighting-color="${m.brilho}" result="esp">${fonte}</feSpecularLighting>`,
    cm('cav', ALFA_PARA_CINZA, 'cg'),
    cm('h', ALFA_PARA_CINZA, 'hg'),
    ar('alb', 'dif', 'k1="1"', 'c1'),
    ar('c1', 'cg', 'k1="0.75" k2="0.4"', 'c2'),
    ar('esp', 'hg', 'k1="1.1"', 'e2'),
    ar('c2', 'e2', 'k2="1" k3="1"', 'c3'),
    '<feComposite in="c3" in2="SourceAlpha" operator="in"/>',
    '</filter>',
  ].join('')
}

// ------------------------------------------------------------------ o disco: a cena

const DESENHO_DA_CENA: Readonly<Record<CenaDoRelevo, () => string>> = {
  cavaleiro: relevoCavaleiro,
  dragao: relevoDragao,
  navio: relevoNavio,
  leao: relevoLeao,
  serpente: relevoSerpente,
  solELua: relevoSolELua,
}

/** O círculo de cada cena (centro e raio nas coordenadas dela, 1200 x 720): o que cabe no medalhão. */
const RECORTE_DA_CENA: Readonly<Record<CenaDoRelevo, readonly [number, number, number]>> = {
  cavaleiro: [660, 380, 440],
  dragao: [550, 390, 380],
  navio: [600, 360, 380],
  leao: [610, 380, 390],
  serpente: [600, 360, 400],
  solELua: [600, 360, 560],
}

/** A altura do fundo das cenas (`fundo(0.2)`): fora do retângulo da cena, a chapa continua igual. */
const FUNDO_DA_CENA = 0.2

function cenaNoDisco(cena: CenaDoRelevo): string {
  const [cx, cy, r] = RECORTE_DA_CENA[cena]
  const escala = RAIO_DO_DISCO / r
  return [
    `<rect width="${LADO_DO_DISCO}" height="${LADO_DO_DISCO}" fill="${alt(FUNDO_DA_CENA)}"/>`,
    `<g transform="translate(${CENTRO} ${CENTRO}) scale(${num(escala)}) translate(${-cx} ${-cy})">${DESENHO_DA_CENA[cena]()}</g>`,
  ].join('')
}

// ------------------------------------------------------------------ o disco: os símbolos

/** Os 8 símbolos como traço, numa caixa de -40 a 40 com o "para cima" em -y. */
const TRACO_DO_SIMBOLO: Readonly<Record<SimboloDoAnel, string>> = {
  sol: (() => {
    let d = 'M12,0A12,12 0 1,0 -12,0A12,12 0 1,0 12,0'
    for (let i = 0; i < 8; i++) {
      const [x1, y1] = polar(0, 0, 19, i * 45)
      const [x2, y2] = polar(0, 0, 31, i * 45)
      d += `M${num(x1)},${num(y1)}L${num(x2)},${num(y2)}`
    }
    return d
  })(),
  lua: 'M6,-27A27,27 0 1,0 6,27A20,20 0 0,1 6,-27Z',
  estrela: (() => {
    let d = ''
    for (let i = 0; i < 10; i++) {
      const [x, y] = polar(0, 2, i % 2 === 0 ? 30 : 12.5, -90 + i * 36)
      d += `${i === 0 ? 'M' : 'L'}${num(x)},${num(y)}`
    }
    return `${d}Z`
  })(),
  olho: 'M-32,0Q0,-25 32,0Q0,25 -32,0ZM8,0A8,8 0 1,0 -8,0A8,8 0 1,0 8,0',
  peixe: 'M-24,0Q-2,-21 18,0Q-2,21 -24,0ZM18,0L31,-12V12ZM-12,-2V-2',
  coroa: 'M-27,17H27V-7L15,5L7,-19L0,2L-7,-19L-15,5L-27,-7Z',
  chave: 'M0,-31A10,10 0 1,0 0.1,-31ZM0,-21V30M0,19H11M0,28H8',
  ancora: 'M0,-31A5,5 0 1,0 0.1,-31ZM0,-26V29M-12,-14H12M-24,9Q-20,29 0,29Q20,29 24,9M-24,9l-5,7M24,9l5,7',
}

/** O ângulo de cada símbolo no anel (graus, 0 = em cima, horário): o anel `k` começa `k * 3` posições adiante. */
export function anguloDoSimbolo(simbolo: number, anel: number): number {
  return -(((simbolo + anel * DESLOCAMENTO_DO_ANEL) % PASSOS_DO_GIRO) * 360) / PASSOS_DO_GIRO
}

function anelDeSimbolos(k: number, raios: RaiosDoAnel): string {
  const { fora, dentro } = raios
  const largura = fora - dentro
  const meio = (fora + dentro) / 2
  // o símbolo ocupa três quartos da largura do anel (o traço dele tem uns 64 de lado)
  const lado = Math.min(largura * 0.74, ((2 * Math.PI * meio) / PASSOS_DO_GIRO) * 0.6)
  const escala = lado / 64
  const partes: string[] = []
  // a chapa do anel, um pouco abaixo da borda; as bordas levantadas, como de uma peça torneada
  partes.push(`<circle cx="${CENTRO}" cy="${CENTRO}" r="${num(meio)}" fill="none" stroke="${alt(0.4)}" stroke-width="${num(largura)}"/>`)
  partes.push(`<circle cx="${CENTRO}" cy="${CENTRO}" r="${num(fora - 7)}" fill="none" stroke="${alt(0.62)}" stroke-width="5"/>`)
  partes.push(`<circle cx="${CENTRO}" cy="${CENTRO}" r="${num(dentro + 7)}" fill="none" stroke="${alt(0.58)}" stroke-width="4"/>`)
  // contas na borda de fora: uma a cada 7,5 graus
  const contas = Math.round((2 * Math.PI * (fora - 16)) / 26)
  for (let i = 0; i < contas; i++) {
    const [x, y] = polar(CENTRO, CENTRO, fora - 16, (i * 360) / contas)
    partes.push(circulo(x, y, Math.min(4.2, largura * 0.06), 0.74))
  }
  // os riscos entre um símbolo e outro
  for (let i = 0; i < PASSOS_DO_GIRO; i++) {
    const a = -90 + (i + 0.5) * (360 / PASSOS_DO_GIRO)
    const [x1, y1] = polar(CENTRO, CENTRO, dentro + 12, a)
    const [x2, y2] = polar(CENTRO, CENTRO, fora - 24, a)
    partes.push(vinco(`M${num(x1)},${num(y1)}L${num(x2)},${num(y2)}`, 3, 0.32))
  }
  // os símbolos, em relevo, com o "para cima" virado para fora
  SIMBOLOS_DO_ANEL.forEach((simbolo, i) => {
    const angulo = anguloDoSimbolo(i, k)
    const [x, y] = polar(CENTRO, CENTRO, meio - largura * 0.04, angulo - 90)
    partes.push(`<g transform="translate(${num(x)} ${num(y)}) rotate(${num(angulo)}) scale(${escala.toFixed(3)})">${tubo(TRACO_DO_SIMBOLO[simbolo], 9, 0.5, 0.94)}</g>`)
  })
  return partes.join('')
}

/** O miolo dos símbolos: uma rosa dos ventos com a ponta para a marca de cima. */
function rosaDoMiolo(): string {
  return [
    circulo(CENTRO, CENTRO, RAIO_DO_MIOLO, 0.46),
    estrela(CENTRO, CENTRO, RAIO_DO_MIOLO * 0.86, RAIO_DO_MIOLO * 0.28, 4, 0.7, -90),
    estrela(CENTRO, CENTRO, RAIO_DO_MIOLO * 0.5, RAIO_DO_MIOLO * 0.2, 4, 0.6, -45),
    tubo(`M${CENTRO},${CENTRO - RAIO_DO_MIOLO * 0.9}L${CENTRO},${CENTRO - RAIO_DO_MIOLO * 0.2}`, 7, 0.75, 0.98),
    circulo(CENTRO, CENTRO, RAIO_DO_MIOLO * 0.16, DOMO_CUPULA),
  ].join('')
}

function simbolosNoDisco(aneis: number): string {
  return [`<rect width="${LADO_DO_DISCO}" height="${LADO_DO_DISCO}" fill="${alt(0.3)}"/>`, ...raiosDosAneis(aneis).map((raios, k) => anelDeSimbolos(k, raios)), rosaDoMiolo()].join('')
}

// ------------------------------------------------------------------ o disco inteiro

/** As juntas entre os anéis: um sulco fundo (o mesmo em qualquer giro, porque é um círculo). */
function juntas(aneis: number): string {
  const raios = raiosDosAneis(aneis)
  return [...raios.map((r) => r.dentro), RAIO_DO_DISCO].map((r) => vinco(`M${CENTRO - r},${CENTRO}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`, 7, 0.55)).join('')
}

function svgDoDisco(desenho: 'cena' | 'simbolos', cena: CenaDoRelevo, material: MaterialDasGiratorias, aneis: number): string {
  reiniciarDomos()
  const miolo = desenho === 'cena' ? cenaNoDisco(cena) : simbolosNoDisco(aneis)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO_DO_DISCO} ${LADO_DO_DISCO}" width="${LADO_DO_DISCO}" height="${LADO_DO_DISCO}">`,
    '<defs>',
    defsDeAltura(),
    filtroDoMaterial('grt-disco', material, LUZ_A_PINO, `x="40" y="40" width="${LADO_DO_DISCO - 80}" height="${LADO_DO_DISCO - 80}"`),
    `<clipPath id="grt-circulo"><circle cx="${CENTRO}" cy="${CENTRO}" r="${RAIO_DO_DISCO + 4}"/></clipPath>`,
    '</defs>',
    `<g filter="url(#grt-disco)"><g clip-path="url(#grt-circulo)">${miolo}${juntas(aneis)}</g></g>`,
    '</svg>',
  ].join('')
}

const discos = new Map<string, string>()

/** O disco como dado de `<img>`: a mesma URL para todos os anéis (o navegador lê o SVG uma vez). */
export function urlDoDisco(desenho: 'cena' | 'simbolos', cena: CenaDoRelevo, material: MaterialDasGiratorias, aneis: number): string {
  const chave = `${desenho}|${desenho === 'cena' ? cena : aneis}|${material}`
  const pronta = discos.get(chave)
  if (pronta !== undefined) return pronta
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoDisco(desenho, cena, material, aneis))}`
  discos.set(chave, url)
  return url
}

// ------------------------------------------------------------------ a base: parede, sombra e o aro com a marca

const FILTROS_DA_PAREDE = [
  '<filter id="grt-parede" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000" color-interpolation-filters="sRGB">',
  '<feTurbulence type="fractalNoise" baseFrequency="0.024 0.036" numOctaves="4" seed="21" result="t"/>',
  '<feColorMatrix in="t" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.3 0 0 0 -0.5" result="escuro"/>',
  '<feColorMatrix in="t" type="matrix" values="0 0 0 0 1 0 0 0 0 0.9 0 0 0 0 0.8 0 0.7 0 0 -0.36" result="claro"/>',
  '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="escuro"/><feMergeNode in="claro"/></feMerge>',
  '</filter>',
  '<filter id="grt-sombra" x="-0.1" y="-0.1" width="1.2" height="1.2"><feGaussianBlur stdDeviation="16"/></filter>',
  '<filter id="grt-vinheta" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"><feGaussianBlur stdDeviation="70"/></filter>',
].join('')

/** A parede de blocos (fiadas desencontradas), como a do painel em relevo, e a vinheta. */
function parede(): string {
  let juntasDaParede = ''
  for (let i = 0; i < 8; i++) {
    const y = 40 + i * 140
    juntasDaParede += `M0,${y}H1600`
    for (let x = i % 2 === 0 ? 0 : 130; x < 1600; x += 260) juntasDaParede += `M${x},${y}V${y + 140}`
  }
  return [
    '<g filter="url(#grt-parede)">',
    '<rect width="1600" height="1000" fill="#2a2521"/>',
    `<path d="${juntasDaParede}" fill="none" stroke="#3c352e" stroke-width="2" transform="translate(2 4)"/>`,
    `<path d="${juntasDaParede}" fill="none" stroke="#14110f" stroke-width="5"/>`,
    '</g>',
    '<rect x="-60" y="-60" width="1720" height="1120" fill="none" stroke="#000" stroke-width="300" opacity="0.6" filter="url(#grt-vinheta)"/>',
  ].join('')
}

/** O raio de fora do aro fixo, em unidades do disco. */
const RAIO_DO_ARO = 498

/** O aro em altura: molduras torneadas, contas, oito cravos e a caixa da marca em cima. */
function aro(): string {
  const circ = (r: number, largura: number, v: number, extra = '') => `<circle cx="${CENTRO}" cy="${CENTRO}" r="${num(r)}" fill="none" stroke="${alt(v)}" stroke-width="${num(largura)}"${extra}/>`
  const partes = [
    `<circle cx="${CENTRO}" cy="${CENTRO}" r="${RAIO_DO_ARO}" fill="${alt(0.42)}"/>`,
    circ(492, 10, 0.56),
    circ(482, 12, 0.8),
    circ(468, 14, 0.62),
    circ(468, 9, 0.9, ' stroke-dasharray="0 24" stroke-linecap="round"'),
    circ(454, 10, 0.7),
    circ(446, 6, 0.86),
  ]
  for (let i = 0; i < 8; i++) {
    if (i === 0) continue
    const [x, y] = polar(CENTRO, CENTRO, 468, -90 + i * 45)
    partes.push(circulo(x, y, 15, 0.5), circulo(x, y, 11, DOMO_CUPULA))
  }
  // a caixa da marca: uma aba lisa que desce sobre o anel de fora
  partes.push(`<path d="M452,0H548L536,46H464Z" fill="${alt(0.66)}"/>`)
  partes.push(friso('M458,6H542', 4, 0.3))
  partes.push(circulo(CENTRO, 22, 9, DOMO_CUPULA))
  return partes.join('')
}

function svgDaBase(material: MaterialDasGiratorias): string {
  reiniciarDomos()
  const x = LARGURA_DA_BASE / 2 - (LADO_DO_DISCO * ESCALA_DO_DISCO_NA_BASE) / 2
  const y = ALTURA_DA_BASE / 2 - (LADO_DO_DISCO * ESCALA_DO_DISCO_NA_BASE) / 2
  const noDisco = `translate(${num(x)} ${num(y)}) scale(${ESCALA_DO_DISCO_NA_BASE})`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA_DA_BASE} ${ALTURA_DA_BASE}" width="${LARGURA_DA_BASE}" height="${ALTURA_DA_BASE}">`,
    '<defs>',
    FILTROS_DA_PAREDE,
    filtroDoMaterial('grt-aro', material, LUZ_DE_LADO, `x="${num(x - 10)}" y="${num(y - 10)}" width="${num(LADO_DO_DISCO * ESCALA_DO_DISCO_NA_BASE + 20)}" height="${num(LADO_DO_DISCO * ESCALA_DO_DISCO_NA_BASE + 20)}"`),
    '</defs>',
    parede(),
    `<g transform="${noDisco}"><g filter="url(#grt-sombra)" opacity="0.9"><circle cx="${CENTRO + 16}" cy="${CENTRO + 22}" r="${RAIO_DO_ARO}" fill="#000"/></g></g>`,
    `<g filter="url(#grt-aro)"><g transform="${noDisco}">${aro()}</g></g>`,
    '</svg>',
  ].join('')
}

const bases = new Map<string, string>()

export function urlDaBase(material: MaterialDasGiratorias): string {
  const pronta = bases.get(material)
  if (pronta !== undefined) return pronta
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDaBase(material))}`
  bases.set(material, url)
  return url
}

/** Só para a página de prova da arte: os SVGs crus. */
export const arteParaProva = { svgDoDisco, svgDaBase }
