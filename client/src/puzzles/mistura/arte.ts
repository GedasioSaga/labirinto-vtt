/**
 * A ARTE DA MISTURA DE LÍQUIDOS (28/11): uma bancada de laboratório velho na
 * parede, desenhada por código, original. A BASE vira dado de `<img>` (o
 * navegador lê o SVG uma vez), guardada por metal, torneira, plaqueta e
 * capacidades:
 *
 * - a parede das peças giratórias;
 * - a prateleira de madeira escura com as mãos-francesas de ferro;
 * - em metal (o mapa de altura e o filtro de metal dos outros painéis): a
 *   torneira com o volante, a pia de latão com o sifão, o receptáculo (funil,
 *   gargalo e o pedestal com o visor redondo), a plaqueta do alvo e a plaquinha
 *   de cada recipiente na frente da prateleira.
 *
 * Os RECIPIENTES não moram aqui: são SVG vivos no painel (o nível, a cor, o
 * menisco e o brilho mudam a cada gesto). Daqui saem só a geometria deles.
 *
 * Nenhum degradê radial (o primeiro custa caro para compilar no Edge frio).
 */
import { DOMO_CUPULA, DOMO_MEIO, alt, circulo, defsDeAltura, friso, num, polar, reiniciarDomos, tubo } from '../relevo/cenas/comum'
import { FILTROS_DA_PAREDE, LUZ_DE_LADO, filtroDeMetal, parede } from '../giratorias/arte'
import { ALTURA_DO_QUADRO, LARGURA_DO_QUADRO, METAL_DA_CHAPA, paraUrl, retangulo, type Caixa } from '../interruptores/arte'
import type { MaterialDosInterruptores } from '../tipos'

export { ALTURA_DO_QUADRO, LARGURA_DO_QUADRO, type Caixa }

// ------------------------------------------------------------------ a geometria (em unidades do quadro, 1600 x 1000)

/** O tampo da prateleira (onde os pés pousam) e a frente dela. */
const TAMPO = { x: 322, y: 862, largura: 956, altura: 34 }
const FRENTE = { x: 322, y: 896, largura: 956, altura: 30 }
/** Onde os pés dos recipientes pousam no tampo. */
const CHAO_DOS_RECIPIENTES = 884
/** A faixa da prateleira onde os recipientes se repartem. */
const FAIXA = { x: 346, largura: 908 }

/** O recipiente por dentro (unidades do quadro): o aro de metal em cima, o pé embaixo e a espessura do vidro. */
export const ARO_DO_RECIPIENTE = 26
export const PE_DO_RECIPIENTE = 32
export const VIDRO_DO_RECIPIENTE = 10
const LARGURA_MAX_DO_RECIPIENTE = 158
const ALTURA_SEM_LITROS = 186
const ALTURA_POR_LITRO = 44

export interface RecipienteNaBancada {
  /** O desenho do recipiente (vidro, aro e pé). */
  caixa: Caixa
  /** O alvo de toque: o recipiente com folga em volta (nunca abaixo de 44 px). */
  alvo: Caixa
  /** A plaquinha na frente da prateleira (o "2 de 5 L"). */
  plaquinha: Caixa
}

export interface GeometriaDaBancada {
  plaqueta: Caixa
  recomecar: Caixa
  dica: Caixa
  torneira: Caixa | null
  /** De onde a água da torneira cai (o bico). */
  bico: { x: number; y: number }
  pia: Caixa
  receptaculo: Caixa
  /** O visor redondo do pedestal (acende quando a mistura certa desce). */
  visor: Caixa
  recipientes: RecipienteNaBancada[]
}

export function geometriaDaBancada(capacidades: readonly number[], fonte: boolean): GeometriaDaBancada {
  const vao = FAIXA.largura / Math.max(1, capacidades.length)
  const largura = Math.min(LARGURA_MAX_DO_RECIPIENTE, vao * 0.64)
  const recipientes = capacidades.map((capacidade, i): RecipienteNaBancada => {
    const altura = ALTURA_SEM_LITROS + capacidade * ALTURA_POR_LITRO
    const centro = FAIXA.x + vao * (i + 0.5)
    const caixa = { x: centro - largura / 2, y: CHAO_DOS_RECIPIENTES - altura, largura, altura }
    const folga = Math.min(22, (vao - largura) / 2)
    return {
      caixa,
      alvo: { x: caixa.x - folga, y: caixa.y - 34, largura: largura + 2 * folga, altura: altura + 34 + 12 },
      plaquinha: { x: centro - Math.min(70, vao * 0.46), y: FRENTE.y + 3, largura: Math.min(140, vao * 0.92), altura: 24 },
    }
  })
  return {
    plaqueta: { x: 470, y: 30, largura: 660, altura: 156 },
    recomecar: { x: 1300, y: 52, largura: 262, altura: 92 },
    dica: { x: 330, y: 934, largura: 940, altura: 52 },
    torneira: fonte ? { x: 64, y: 150, largura: 236, altura: 400 } : null,
    bico: { x: 254, y: 400 },
    pia: { x: 36, y: 600, largura: 280, altura: 330 },
    receptaculo: { x: 1306, y: 286, largura: 262, altura: 650 },
    visor: { x: 1383, y: 752, largura: 104, altura: 104 },
    recipientes,
  }
}

// ------------------------------------------------------------------ a base

/** A prateleira: tampo e frente de madeira escura com veio, as mãos-francesas de ferro e a sombra na parede. */
function prateleira(): string {
  const veios = [0.22, 0.48, 0.71]
    .map((t, i) => {
      const y = TAMPO.y + 6 + t * (TAMPO.altura - 10)
      return `<path d="M${TAMPO.x + 6},${num(y)}C${TAMPO.x + 260},${num(y - 4 + i * 2)} ${TAMPO.x + 520},${num(y + 5)} ${TAMPO.x + TAMPO.largura - 6},${num(y - 2)}" fill="none" stroke="#24160b" stroke-opacity="0.34" stroke-width="1.6"/>`
    })
    .join('')
  const maoFrancesa = (x: number) =>
    `<path d="M${x - 10},${FRENTE.y + FRENTE.altura}h20v18l-10,52h-10z" fill="url(#mx-ferro)"/><path d="M${x - 10},${FRENTE.y + FRENTE.altura + 2}h4v62h-4z" fill="#fff" fill-opacity="0.12"/>`
  return [
    `<g filter="url(#grt-sombra)" opacity="0.8"><rect x="${TAMPO.x + 14}" y="${TAMPO.y + 22}" width="${TAMPO.largura}" height="${TAMPO.altura + FRENTE.altura + 10}" fill="#000"/></g>`,
    maoFrancesa(TAMPO.x + 96),
    maoFrancesa(TAMPO.x + TAMPO.largura - 96),
    retangulo(TAMPO, 3, 'fill="url(#mx-tampo)"'),
    veios,
    `<path d="M${TAMPO.x},${TAMPO.y + 1}h${TAMPO.largura}" stroke="#c49a6c" stroke-opacity="0.5" stroke-width="2"/>`,
    retangulo(FRENTE, 2, 'fill="url(#mx-frente)"'),
    `<path d="M${FRENTE.x},${FRENTE.y + 0.5}h${FRENTE.largura}" stroke="#000" stroke-opacity="0.45" stroke-width="1.5"/>`,
  ].join('')
}

/** A torneira: o cano que desce da parede, a braçadeira, o volante de raios e o bico curvo. */
function torneira(): string {
  const cx = 182
  const [rx, ry] = [cx, 262]
  const raios = Array.from({ length: 5 }, (_, i) => {
    const [x, y] = polar(rx, ry, 40, i * 72 - 90)
    return `M${num(rx)},${num(ry)}L${num(x)},${num(y)}`
  }).join('')
  return [
    tubo(`M${cx},-10V318Q${cx},356 ${cx + 38},356H${cx + 62}`, 46, 0.42, 0.96),
    tubo(`M${cx + 70},352V398`, 30, 0.5, 1),
    circulo(cx + 70, 398, 15, DOMO_CUPULA),
    retangulo({ x: cx - 40, y: 92, largura: 80, altura: 26 }, 8, `fill="${alt(0.66)}"`),
    circulo(cx - 28, 105, 6, DOMO_CUPULA),
    circulo(cx + 28, 105, 6, DOMO_CUPULA),
    `<circle cx="${rx}" cy="${ry}" r="46" fill="none" stroke="${alt(0.58)}" stroke-width="15"/>`,
    `<circle cx="${rx}" cy="${ry}" r="46" fill="none" stroke="${alt(0.9)}" stroke-width="5"/>`,
    tubo(raios, 10, 0.55, 0.9),
    circulo(rx, ry, 16, DOMO_CUPULA),
  ].join('')
}

/** A pia de latão: a boca vista de frente, a bacia, a braçadeira na parede e o sifão. */
function pia(): string {
  const cx = 176
  return [
    tubo(`M${cx},880V930Q${cx},962 ${cx + 34},962H${cx + 150}`, 34, 0.4, 0.92),
    `<path d="M58,664H294Q290,846 ${cx},884Q62,846 58,664Z" fill="${alt(0.6)}"/>`,
    friso(`M74,690Q86,824 ${cx},858`, 10, 0.32),
    `<path d="M282,690Q270,824 ${cx},858" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="10" stroke-linecap="round"/>`,
    `<ellipse cx="${cx}" cy="662" rx="142" ry="24" fill="${alt(0.86)}"/>`,
    `<ellipse cx="${cx}" cy="662" rx="124" ry="15" fill="${alt(0.1)}"/>`,
    `<ellipse cx="${cx}" cy="667" rx="22" ry="5" fill="${alt(0.02)}"/>`,
    friso(`M42,660Q${cx},628 310,660`, 3, 0.55),
    retangulo({ x: cx - 46, y: 884, largura: 92, altura: 18 }, 6, `fill="${alt(0.7)}"`),
  ].join('')
}

/** O receptáculo: o funil de boca larga, o gargalo e o pedestal com o visor redondo. */
function receptaculo(g: GeometriaDaBancada): string {
  const cx = g.visor.x + g.visor.largura / 2
  const cy = g.visor.y + g.visor.altura / 2
  return [
    `<path d="M1314,330H1560L1466,514H1408Z" fill="${alt(0.56)}"/>`,
    friso('M1332,342L1418,508', 8, 0.3),
    `<path d="M1542,342L1458,508" fill="none" stroke="#000" stroke-opacity="0.24" stroke-width="8"/>`,
    `<ellipse cx="1437" cy="330" rx="123" ry="20" fill="${alt(0.86)}"/>`,
    `<ellipse cx="1437" cy="330" rx="106" ry="12" fill="${alt(0.08)}"/>`,
    tubo('M1437,508V700', 52, 0.44, 0.96),
    circulo(1437, 600, 34, DOMO_MEIO),
    retangulo({ x: 1342, y: 690, largura: 190, altura: 222 }, 18, `fill="${alt(0.5)}"`),
    retangulo({ x: 1352, y: 700, largura: 170, altura: 202 }, 12, `fill="none" stroke="${alt(0.86)}" stroke-width="5"`),
    circulo(cx, cy, 64, DOMO_MEIO),
    `<circle cx="${cx}" cy="${cy}" r="${g.visor.largura / 2}" fill="${alt(0.06)}"/>`,
    ...[0, 90, 180, 270].map((graus) => {
      const [x, y] = polar(cx, cy, 58, graus + 45)
      return circulo(x, y, 6, DOMO_CUPULA)
    }),
    retangulo({ x: 1322, y: 906, largura: 230, altura: 28 }, 8, `fill="${alt(0.7)}"`),
  ].join('')
}

/** A plaqueta do alvo: moldura levantada, o campo fundo onde o alvo aparece, os quatro rebites. */
function plaqueta(caixa: Caixa): string {
  const campo = { x: caixa.x + 24, y: caixa.y + 22, largura: caixa.largura - 48, altura: caixa.altura - 44 }
  return [
    retangulo(caixa, 18, `fill="${alt(0.52)}"`),
    retangulo({ x: caixa.x + 7, y: caixa.y + 7, largura: caixa.largura - 14, altura: caixa.altura - 14 }, 13, `fill="none" stroke="${alt(0.88)}" stroke-width="4"`),
    retangulo(campo, 8, `fill="${alt(0.3)}"`),
    ...[
      [caixa.x + 13, caixa.y + 13],
      [caixa.x + caixa.largura - 13, caixa.y + 13],
      [caixa.x + 13, caixa.y + caixa.altura - 13],
      [caixa.x + caixa.largura - 13, caixa.y + caixa.altura - 13],
    ].map(([x, y]) => circulo(x ?? 0, y ?? 0, 7, DOMO_CUPULA)),
  ].join('')
}

/** A plaquinha de cada recipiente na frente da prateleira (o número vai por cima, vivo). */
function plaquinhas(g: GeometriaDaBancada): string {
  return g.recipientes
    .map(({ plaquinha: p }) => [retangulo(p, 6, `fill="${alt(0.68)}"`), circulo(p.x + 9, p.y + p.altura / 2, 4, DOMO_CUPULA), circulo(p.x + p.largura - 9, p.y + p.altura / 2, 4, DOMO_CUPULA)].join(''))
    .join('')
}

function degrades(material: MaterialDosInterruptores): string {
  const ferro = material === 'ferro' ? ['#1c1b19', '#3e3c38', '#232220'] : ['#1f1a14', '#433a2e', '#26201a']
  return [
    '<linearGradient id="mx-tampo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e4b2d"/><stop offset="1" stop-color="#523621"/></linearGradient>',
    '<linearGradient id="mx-frente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c2716"/><stop offset="1" stop-color="#24170c"/></linearGradient>',
    `<linearGradient id="mx-ferro" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${ferro[0]}"/><stop offset="0.45" stop-color="${ferro[1]}"/><stop offset="1" stop-color="${ferro[2]}"/></linearGradient>`,
  ].join('')
}

function svgDaBase(material: MaterialDosInterruptores, capacidades: readonly number[], fonte: boolean, comPlaqueta: boolean): string {
  reiniciarDomos()
  const g = geometriaDaBancada(capacidades, fonte)
  const caixaDoFiltro = `x="0" y="0" width="${LARGURA_DO_QUADRO}" height="${ALTURA_DO_QUADRO}"`
  const sombraDe = (d: string) => `<g filter="url(#grt-sombra)" opacity="0.75" transform="translate(16 22)">${d}</g>`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA_DO_QUADRO} ${ALTURA_DO_QUADRO}" width="${LARGURA_DO_QUADRO}" height="${ALTURA_DO_QUADRO}">`,
    '<defs>',
    FILTROS_DA_PAREDE,
    defsDeAltura(),
    degrades(material),
    filtroDeMetal('mx-metal', METAL_DA_CHAPA[material], LUZ_DE_LADO, caixaDoFiltro),
    '</defs>',
    parede(),
    // As sombras do metal na parede (a luz vem de cima à esquerda).
    sombraDe(
      [
        fonte ? `<path d="M160,0h44v330h-44z" fill="#000"/>` : '',
        '<path d="M58,650H294Q290,846 176,884Q62,846 58,650Z" fill="#000"/>',
        '<path d="M1314,330H1560L1466,514V912H1342V514Z" fill="#000"/>',
        comPlaqueta ? retangulo(g.plaqueta, 18, 'fill="#000"') : '',
      ].join(''),
    ),
    prateleira(),
    `<g filter="url(#mx-metal)">${fonte ? torneira() : ''}${pia()}${receptaculo(g)}${comPlaqueta ? plaqueta(g.plaqueta) : ''}${plaquinhas(g)}</g>`,
    '</svg>',
  ].join('')
}

const bases = new Map<string, string>()

/** A base da bancada como dado de `<img>`, guardada por metal, capacidades, torneira e plaqueta. */
export function urlDaBaseDaBancada(material: MaterialDosInterruptores, capacidades: readonly number[], fonte: boolean, comPlaqueta: boolean): string {
  const chave = `${material}|${capacidades.join(',')}|${fonte ? 1 : 0}|${comPlaqueta ? 1 : 0}`
  const pronta = bases.get(chave)
  if (pronta !== undefined) return pronta
  const url = paraUrl(svgDaBase(material, capacidades, fonte, comPlaqueta))
  bases.set(chave, url)
  return url
}
