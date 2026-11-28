/**
 * A ARTE DO PAINEL EM RELEVO (28/11): a parede, a moldura de metal e os seis
 * relevos de fábrica, desenhados por código, originais. Arte do app, nunca
 * texto de usuário: o SVG vai para `src` de `<img>` como dado e é rasterizado
 * uma vez por painel (`puzzles/relevo/raster.ts`).
 *
 * O painel inteiro mora num `viewBox` de 1600 x 1000 (o 16:10 do quadro do
 * puzzle). O relevo ocupa `AREA_DO_RELEVO`; as placas (`placas.ts`) cortam
 * essa área numa grade de 4 x 3, com bordas tortas.
 *
 * COMO É FEITO: a moldura e a cena são um MAPA DE ALTURA em cinza
 * (`cenas/comum.ts`); um filtro só (`filtroDoMetal`) transforma a altura em
 * metal fundido — três escalas de desfoque arredondam os volumes, a luz vem de
 * cima à esquerda (difusa + especular), a pátina (ruído de semente fixa) se
 * acumula onde é baixo e nos vincos, e o que é alto fica gasto e mais claro.
 * Tudo interno ao SVG, determinístico e sem texto (funciona como `<img>`).
 */
import type { CenaDoRelevo, MetalDoRelevo } from '../tipos'
import { relevoCavaleiro } from './cenas/cavaleiro'
import { relevoDragao } from './cenas/dragao'
import { relevoLeao } from './cenas/leao'
import { relevoNavio } from './cenas/navio'
import { relevoSerpente } from './cenas/serpente'
import { relevoSolELua } from './cenas/solELua'
import { DOMO_CUPULA, alt, circulo, cheio, defsDeAltura, elipse, friso, mecha, polar, reiniciarDomos, tubo, vinco } from './cenas/comum'

export const LARGURA_DO_PAINEL = 1600
export const ALTURA_DO_PAINEL = 1000

/** Onde o relevo (ou a imagem do mestre) fica no painel, em unidades do `viewBox`. */
export const AREA_DO_RELEVO = { x: 200, y: 160, largura: 1200, altura: 720 } as const

export const NOME_DA_CENA: Readonly<Record<CenaDoRelevo, string>> = {
  cavaleiro: 'Cavaleiro contra a fera',
  dragao: 'Dragão',
  navio: 'Navio na tempestade',
  leao: 'Leão coroado',
  serpente: 'Serpente marinha',
  solELua: 'Sol e lua',
}

export const NOME_DO_METAL: Readonly<Record<MetalDoRelevo, string>> = { bronze: 'Bronze', ferro: 'Ferro', prata: 'Prata velha' }

/** As 12 placas de cada cena, da que mais importa para a que menos: as N primeiras faltam por padrão. */
export const ORDEM_DAS_PLACAS: Readonly<Record<CenaDoRelevo, readonly number[]>> = {
  cavaleiro: [5, 3, 10, 0, 6, 11, 4, 7, 8, 9, 1, 2],
  dragao: [1, 7, 9, 4, 3, 8, 6, 5, 10, 2, 11, 0],
  navio: [6, 3, 4, 9, 7, 0, 5, 1, 2, 10, 11, 8],
  leao: [1, 9, 3, 4, 11, 5, 7, 6, 0, 10, 2, 8],
  serpente: [3, 4, 6, 0, 7, 5, 2, 10, 1, 9, 8, 11],
  solELua: [4, 6, 11, 2, 9, 5, 7, 0, 10, 1, 3, 8],
}

/** O que cada placa mostra (pelo índice da placa, linha a linha), curto: vira o nome do item. */
export const DESCRICAO_DAS_PLACAS: Readonly<Record<CenaDoRelevo, readonly string[]>> = {
  cavaleiro: [
    'o castelo no morro',
    'o penacho do elmo',
    'os pássaros no céu',
    'a cabeça da fera',
    'a cauda do cavalo',
    'o cavaleiro e o escudo',
    'a cabeça do cavalo',
    'a juba da fera',
    'o casco de trás',
    'a barriga do cavalo',
    'o casco da frente',
    'as patas da fera',
  ],
  dragao: [
    'as chamas da torre',
    'a cabeça do dragão',
    'o osso da asa',
    'a ponta da asa',
    'o sopro de fogo',
    'o pescoço do dragão',
    'o corpo escamado',
    'a ponta da cauda',
    'a porta da torre',
    'a garra no rochedo',
    'a pata de trás',
    'a curva da cauda',
  ],
  navio: [
    'a nuvem em espiral',
    'as velas de cima',
    'o topo do mastro',
    'o raio',
    'a crista da onda',
    'a proa do navio',
    'as velas do meio',
    'o farol',
    'o pé da onda',
    'o casco do navio',
    'as ondas sob a popa',
    'o rochedo do farol',
  ],
  leao: [
    'a estrela do canto',
    'a coroa do leão',
    'a estrela menor',
    'o tufo da cauda',
    'o focinho e a língua',
    'o olho do leão',
    'o dorso do leão',
    'a anca do leão',
    'a flor no chão',
    'a pata erguida',
    'a barriga e as patas',
    'a pata de trás',
  ],
  serpente: [
    'a lua cheia',
    'a nuvem perto da lua',
    'a nuvem do meio',
    'a cabeça da serpente',
    'a barbatana da cauda',
    'a corcova pequena',
    'a corcova grande',
    'o barquinho à vela',
    'o rabo na água',
    'as ondas do meio',
    'o pescoço na água',
    'as ondas sob o barco',
  ],
  solELua: [
    'os raios do alto',
    'os raios da direita',
    'a ponta de cima da lua',
    'a estrela do alto',
    'o olho esquerdo do sol',
    'o olho direito do sol',
    'o rosto da lua',
    'a bochecha da lua',
    'a nuvem pequena',
    'a nuvem grande',
    'a ponta de baixo da lua',
    'a estrela de baixo',
  ],
}

/** O desenho em altura de cada cena, em coordenadas locais (1200 x 720). */
const DESENHO_DA_CENA: Readonly<Record<CenaDoRelevo, () => string>> = {
  cavaleiro: relevoCavaleiro,
  dragao: relevoDragao,
  navio: relevoNavio,
  leao: relevoLeao,
  serpente: relevoSerpente,
  solELua: relevoSolELua,
}

// ------------------------------------------------------------------ o metal

interface Metal {
  /** Cor do metal pela altura (9 paradas, do rebaixo com pátina ao alto gasto). */
  tabela: readonly string[]
  /** Cor do brilho especular. */
  brilho: string
  ks: number
  expoente: number
  kd: number
}

const METAIS: Readonly<Record<MetalDoRelevo, Metal>> = {
  // Pátina verde-azulada nos rebaixos, bronze escuro no corpo, dourado gasto no alto.
  bronze: { tabela: ['#33493d', '#4a6553', '#3a4636', '#3b3226', '#4f3a23', '#6a4c2a', '#86632f', '#a37c3f', '#c09858'], brilho: '#f3d3a0', ks: 0.55, expoente: 20, kd: 1.3 },
  // Quase preto, ferrugem marrom nos rebaixos, cinza-esverdeado gasto no alto.
  ferro: { tabela: ['#4f2a18', '#5a3320', '#35271f', '#232321', '#282927', '#30322f', '#3d403a', '#53564d', '#74766a'], brilho: '#c8d2c8', ks: 0.36, expoente: 16, kd: 1.3 },
  // Cinza azulado, oxidação quase preta nos rebaixos.
  prata: { tabela: ['#17171a', '#222226', '#2f3035', '#3f4248', '#52565d', '#686d75', '#80868e', '#9ba1a8', '#bcc1c6'], brilho: '#e8eefa', ks: 0.75, expoente: 24, kd: 1.3 },
}

/** Os valores de um canal (0 = R, 1 = G, 2 = B) da tabela do metal, para `feFunc*`. */
function canal(tabela: readonly string[], c: 0 | 1 | 2): string {
  return tabela.map((h) => (parseInt(h.slice(1 + c * 2, 3 + c * 2), 16) / 255).toFixed(3)).join(' ')
}

/** Matriz que põe um canal (0 = R … 3 = A) no alfa e zera a cor: imagem "só altura". */
const PARA_ALFA = ['0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0'] as const
/** Matriz que copia o alfa para R, G e B, opaca: "só altura" vira cinza. */
const ALFA_PARA_CINZA = '0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1'

function filtroDoMetal(metal: MetalDoRelevo): string {
  const m = METAIS[metal]
  const luz = '<feDistantLight azimuth="225" elevation="38"/>'
  const cm = (entrada: string, valores: string, saida: string) => `<feColorMatrix in="${entrada}" type="matrix" values="${valores}" result="${saida}"/>`
  const ar = (a: string, b: string, k: string, saida: string) => `<feComposite in="${a}" in2="${b}" operator="arithmetic" ${k} result="${saida}"/>`
  return [
    `<filter id="rlv-metal" filterUnits="userSpaceOnUse" x="100" y="0" width="1400" height="1000" color-interpolation-filters="sRGB">`,
    // a altura, arredondada em três escalas (aresta nítida + almofada + monte)
    cm('SourceGraphic', PARA_ALFA[0], 'h0'),
    '<feGaussianBlur in="h0" stdDeviation="1.3" result="b1"/>',
    '<feGaussianBlur in="h0" stdDeviation="6" result="b2"/>',
    '<feGaussianBlur in="h0" stdDeviation="24" result="b3"/>',
    ar('b1', 'b2', 'k2="0.55" k3="0.27"', 'ha'),
    ar('ha', 'b3', 'k2="1" k3="0.18"', 'hs'),
    // grão de fundição (ruído fino)
    '<feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="2" seed="11" result="gt"/>',
    cm('gt', PARA_ALFA[0], 'gr'),
    ar('hs', 'gr', 'k2="1" k3="0.03" k4="-0.015"', 'h'),
    // cavidade: o que está abaixo da vizinhança (vincos, pé das figuras)
    ar('h', 'b3', 'k2="2.2" k3="-2.2" k4="0.6"', 'cav'),
    // índice da pátina: baixo + manchas + cavidade = mais pátina; o fundo
    // fica no metal escuro (~0,35), as figuras no metal (~0,7), o alto gasto (~0,9)
    '<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="pt"/>',
    cm('pt', PARA_ALFA[0], 'nz'),
    ar('h', 'nz', 'k2="0.55" k3="0.75" k4="-0.135"', 'p1'),
    ar('p1', 'cav', 'k2="1" k3="1" k4="-0.6"', 'p'),
    cm('p', ALFA_PARA_CINZA, 'pg'),
    `<feComponentTransfer in="pg" result="alb"><feFuncR type="table" tableValues="${canal(m.tabela, 0)}"/><feFuncG type="table" tableValues="${canal(m.tabela, 1)}"/><feFuncB type="table" tableValues="${canal(m.tabela, 2)}"/></feComponentTransfer>`,
    // luz
    `<feDiffuseLighting in="h" surfaceScale="14" diffuseConstant="${m.kd}" lighting-color="#fff" result="dif">${luz}</feDiffuseLighting>`,
    `<feSpecularLighting in="h" surfaceScale="14" specularConstant="${m.ks}" specularExponent="${m.expoente}" lighting-color="${m.brilho}" result="esp">${luz}</feSpecularLighting>`,
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

// ------------------------------------------------------------------ parede e sombra

const FILTRO_DA_PAREDE = [
  '<filter id="rlv-parede" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000" color-interpolation-filters="sRGB">',
  '<feTurbulence type="fractalNoise" baseFrequency="0.022 0.034" numOctaves="4" seed="5" result="t"/>',
  '<feColorMatrix in="t" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.3 0 0 0 -0.5" result="escuro"/>',
  '<feColorMatrix in="t" type="matrix" values="0 0 0 0 1 0 0 0 0 0.9 0 0 0 0 0.8 0 0.7 0 0 -0.36" result="claro"/>',
  '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="escuro"/><feMergeNode in="claro"/></feMerge>',
  '</filter>',
  '<filter id="rlv-sombra" x="-0.05" y="-0.05" width="1.1" height="1.12"><feGaussianBlur stdDeviation="13"/></filter>',
  // vinheta sem degradê (o primeiro degradê custa compilação de shader): uma
  // moldura preta larga, desfocada
  '<filter id="rlv-vinheta" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"><feGaussianBlur stdDeviation="70"/></filter>',
].join('')

function parede(): string {
  let juntas = ''
  for (let i = 0; i < 8; i++) {
    const y = 40 + i * 140
    juntas += `M0,${y}H1600`
    for (let x = i % 2 === 0 ? 0 : 130; x < 1600; x += 260) juntas += `M${x},${y}V${y + 140}`
  }
  return [
    '<g filter="url(#rlv-parede)">',
    '<rect width="1600" height="1000" fill="#2a2521"/>',
    `<path d="${juntas}" fill="none" stroke="#3c352e" stroke-width="2" transform="translate(2 4)"/>`,
    `<path d="${juntas}" fill="none" stroke="#14110f" stroke-width="5"/>`,
    '</g>',
    '<rect x="-60" y="-60" width="1720" height="1120" fill="none" stroke="#000" stroke-width="300" opacity="0.6" filter="url(#rlv-vinheta)"/>',
  ].join('')
}

// ------------------------------------------------------------------ a moldura

const BASE_DA_MOLDURA = '<rect x="112" y="72" width="1376" height="896" rx="8"/>'
const COSTAS_DA_CRISTA = 'M586,100C596,62 646,40 700,44C730,20 770,6 800,6C830,6 870,20 900,44C954,40 1004,62 1014,100Z'
const BASE_DA_FAIXA = '<rect x="142" y="948" width="1316" height="44" rx="8"/>'

/** A silhueta da moldura inteira, preta e desfocada, deslocada para baixo e à direita. */
function sombraDaMoldura(): string {
  return `<g filter="url(#rlv-sombra)" opacity="0.85"><g transform="translate(18 24)" fill="#000">${BASE_DA_MOLDURA}<path d="${COSTAS_DA_CRISTA}"/>${BASE_DA_FAIXA}</g></g>`
}

/** Um anel retangular em volta da área, a `d` unidades dela. */
function anel(d: number, largura: number, v: number, extra = ''): string {
  const { x, y, largura: l, altura: a } = AREA_DO_RELEVO
  return `<rect x="${x - d}" y="${y - d}" width="${l + 2 * d}" height="${a + 2 * d}" fill="none" stroke="${alt(v)}" stroke-width="${largura}"${extra}/>`
}

function roseta(cx: number, cy: number, r: number): string {
  let s = circulo(cx, cy, r, 0.6)
  for (let i = 0; i < 8; i++) {
    const [px, py] = polar(cx, cy, r * 0.56, i * 45 + 22.5)
    s += elipse(px, py, r * 0.44, r * 0.24, 0.88, i * 45 + 22.5)
  }
  return s + circulo(cx, cy, r * 0.34, DOMO_CUPULA) + vinco(`M${cx - r * 0.34},${cy}a${r * 0.34},${r * 0.34} 0 1,0 ${r * 0.68},0a${r * 0.34},${r * 0.34} 0 1,0 ${-r * 0.68},0`, 2.5, 0.3)
}

function crista(): string {
  // folhas de acanto nas volutas, espelhadas no eixo x = 800
  const folhas: [number, number, number, number, number, number][] = [
    [706, 50, -34, -22, 18, 8],
    [680, 44, -40, -4, 16, 6],
    [660, 56, -34, 16, 14, 4],
  ]
  let acanto = ''
  for (const [x, y, dx, dy, l, c] of folhas) acanto += mecha(x, y, dx, dy, l, c, 0.8) + mecha(1600 - x, y, -dx, dy, l, -c, 0.8)
  return [
    cheio(COSTAS_DA_CRISTA, 0.5),
    tubo('M742,112C690,122 630,106 590,120C570,128 572,146 590,146', 12, 0.58, 0.86),
    tubo('M858,112C910,122 970,106 1010,120C1030,128 1028,146 1010,146', 12, 0.58, 0.86),
    acanto,
    tubo('M742,74C700,32 640,30 622,62C608,88 630,108 650,100C664,94 662,78 650,78', 18, 0.6, 0.92),
    tubo('M858,74C900,32 960,30 978,62C992,88 970,108 950,100C936,94 938,78 950,78', 18, 0.6, 0.92),
    cheio('M742,16H858V70C858,108 832,130 800,144C768,130 742,108 742,70Z', DOMO_CUPULA),
    vinco('M750,24H850V70C850,104 828,122 800,134C772,122 750,104 750,70Z', 3, 0.35),
    // um labirinto pequeno gravado no escudo: a assinatura da casa
    vinco('M772,40H828V100H780V54H816V88H792V66H804V78', 5, 0.42),
    circulo(800, 10, 7, DOMO_CUPULA),
  ].join('')
}

function faixaDaBase(): string {
  return [
    `<rect x="142" y="948" width="1316" height="44" rx="8" fill="${alt(0.6)}"/>`,
    friso('M152,955H1448M152,985H1448', 3, 0.4),
    '<rect x="196" y="959" width="1208" height="22" fill="url(#rlv-greca)"/>',
    circulo(170, 970, 15, DOMO_CUPULA),
    circulo(1430, 970, 15, DOMO_CUPULA),
  ].join('')
}

function moldura(): string {
  const { x, y, largura: l, altura: a } = AREA_DO_RELEVO
  return [
    `<rect x="112" y="72" width="1376" height="896" rx="8" fill="${alt(0.44)}"/>`,
    anel(84, 8, 0.56),
    anel(74, 13, 0.8),
    anel(62, 9, 0.5),
    anel(45, 26, 0.66),
    anel(45, 12, 0.92, ' stroke-dasharray="0 30" stroke-linecap="round"'),
    anel(45, 4, 0.82, ' stroke-dasharray="9 21" stroke-dashoffset="-10"'),
    anel(30, 6, 0.5),
    anel(20, 14, 0.76),
    anel(11, 4, 0.9),
    anel(5, 10, 0.55),
    roseta(x - 45, y - 45, 26),
    roseta(x + l + 45, y - 45, 26),
    roseta(x - 45, y + a + 45, 26),
    roseta(x + l + 45, y + a + 45, 26),
    elipse(x - 45, y + a / 2, 16, 30, DOMO_CUPULA),
    elipse(x + l + 45, y + a / 2, 16, 30, DOMO_CUPULA),
    crista(),
    faixaDaBase(),
  ].join('')
}

/** O padrão da faixa da base: uma greca (gancho quadrado), gravada. */
const GRECA = '<pattern id="rlv-greca" patternUnits="userSpaceOnUse" x="196" y="959" width="28" height="22"><path d="M0,20H28M4,20V3H24V15H11V9H18" fill="none" stroke="#000" stroke-opacity="0.42" stroke-width="3"/></pattern>'

/** O painel inteiro em SVG (parede, moldura e, com cena, o relevo), com `width` e `height` para o rasterizador. */
export function svgDoPainel(cena: CenaDoRelevo | null, metal: MetalDoRelevo): string {
  const { x, y, largura, altura } = AREA_DO_RELEVO
  reiniciarDomos()
  const contorno = moldura()
  const miolo = cena === null ? `<rect width="${largura}" height="${altura}" fill="${alt(0.14)}"/>` : DESENHO_DA_CENA[cena]()
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA_DO_PAINEL} ${ALTURA_DO_PAINEL}" width="${LARGURA_DO_PAINEL}" height="${ALTURA_DO_PAINEL}">`,
    '<defs>',
    defsDeAltura(),
    GRECA,
    filtroDoMetal(metal),
    FILTRO_DA_PAREDE,
    `<clipPath id="rlv-area"><rect width="${largura}" height="${altura}"/></clipPath>`,
    '</defs>',
    parede(),
    sombraDaMoldura(),
    '<g filter="url(#rlv-metal)">',
    contorno,
    `<g transform="translate(${x} ${y})" clip-path="url(#rlv-area)">${miolo}</g>`,
    '</g>',
    '</svg>',
  ].join('')
}
