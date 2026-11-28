/**
 * A ARTE DAS PEÇAS DESLIZANTES (28/11), toda nossa e toda em SVG, sem filtro de
 * luz (só gradientes): a parede de blocos das peças giratórias, a bandeja de
 * madeira entalhada ou de bronze com o poço onde as peças correm, a moldura de
 * cada peça e os blocos lisos do modo chave (a peça-chave dourada, com a chave
 * em relevo). A saída do modo chave é um encaixe gravado no fundo do poço e
 * uma seta no aro, do lado mais perto.
 *
 * Unidades do quadro (1600 x 1000), como os outros puzzles. As URLs ficam em
 * cache (cada SVG é montado uma vez por material e tamanho).
 */
import { FILTROS_DA_PAREDE, parede } from '../giratorias/arte'
import type { MaterialDasDeslizantes } from '../tipos'

export const LARGURA_DO_QUADRO = 1600
export const ALTURA_DO_QUADRO = 1000

/** A bandeja (o aro de fora) e o poço onde as peças correm, em unidades do quadro. */
export const BANDEJA = { x: 372, y: 78, lado: 844 } as const
const ARO = 66
export const POCO = { x: BANDEJA.x + ARO, y: BANDEJA.y + ARO, lado: BANDEJA.lado - 2 * ARO } as const
/** A plaqueta com a figura pronta, à direita da bandeja (só no modo figura). */
export const PLAQUETA = { x: 1262, y: 360, lado: 236 } as const

const SVG = 'xmlns="http://www.w3.org/2000/svg"'

interface Paleta {
  claro: string
  base: string
  escuro: string
  veio: string
  fundo: string
  fio: string
  campoClaro: string
  campoEscuro: string
}

const PALETAS: Readonly<Record<MaterialDasDeslizantes, Paleta>> = {
  madeira: { claro: '#9a6a3e', base: '#64412a', escuro: '#2f1c10', veio: '#3d2616', fundo: '#170f09', fio: '#c79a5a', campoClaro: '#8c5f38', campoEscuro: '#5a3a22' },
  bronze: { claro: '#e0b866', base: '#8f6a33', escuro: '#47321a', veio: '#6b4d24', fundo: '#1d1710', fio: '#f0d38a', campoClaro: '#b88c48', campoEscuro: '#76552a' },
}

function emUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function n(valor: number): string {
  return String(Math.round(valor * 10) / 10)
}

/** O veio da madeira: traços finos e ondulados numa faixa. */
function veios(x: number, y: number, largura: number, altura: number, deitado: boolean, cor: string, semente: number): string {
  let d = ''
  const linhas = Math.max(3, Math.round((deitado ? altura : largura) / 9))
  for (let i = 0; i < linhas; i++) {
    const t = (i + 0.5) / linhas
    const onda = 2.2 + ((semente * 7 + i * 13) % 5)
    if (deitado) {
      const yy = y + t * altura
      d += `M${n(x)} ${n(yy)}c${n(largura * 0.3)} ${n(-onda)} ${n(largura * 0.6)} ${n(onda)} ${n(largura)} 0`
    } else {
      const xx = x + t * largura
      d += `M${n(xx)} ${n(y)}c${n(-onda)} ${n(altura * 0.3)} ${n(onda)} ${n(altura * 0.6)} 0 ${n(altura)}`
    }
  }
  return `<path d="${d}" fill="none" stroke="${cor}" stroke-width="1.6" opacity=".45"/>`
}

/** Um número de 0 a 1 que só depende de `i` e da semente (o escovado sai igual em toda pintura). */
function sorteio(i: number, semente: number): number {
  const s = Math.sin(i * 12.9898 + semente * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/**
 * O escovado do bronze (28/11, no lugar do veio ondulado, que lia como
 * madeira): riscos retos e finos, colados um no outro, ao longo da faixa, cada
 * um de um comprimento e de um brilho. Quatro tons (dois claros, dois escuros)
 * em quatro caminhos, para o SVG continuar leve.
 */
function escovado(x: number, y: number, largura: number, altura: number, deitado: boolean, semente: number): string {
  const PASSO = 1.9
  const total = Math.floor((deitado ? altura : largura) / PASSO)
  const comprimento = deitado ? largura : altura
  const tons = ['', '', '', '']
  for (let i = 0; i < total; i++) {
    const meio = (deitado ? y : x) + (i + 0.5) * PASSO
    const inicio = sorteio(i, semente) * 0.3 * comprimento
    const fim = comprimento - sorteio(i + 101, semente) * 0.3 * comprimento
    const tom = Math.floor(sorteio(i + 211, semente) * 4)
    tons[tom] += deitado ? `M${n(x + inicio)} ${n(meio)}H${n(x + fim)}` : `M${n(meio)} ${n(y + inicio)}V${n(y + fim)}`
  }
  const estilo = [
    ['#fff4d8', '.07'],
    ['#fff4d8', '.15'],
    ['#2a1806', '.09'],
    ['#2a1806', '.17'],
  ] as const
  return tons.map((d, k) => (d === '' ? '' : `<path d="${d}" fill="none" stroke="${estilo[k]?.[0]}" stroke-width=".8" opacity="${estilo[k]?.[1]}"/>`)).join('')
}

/** A textura da faixa: o veio na madeira, o escovado no bronze. */
function textura(material: MaterialDasDeslizantes, x: number, y: number, largura: number, altura: number, aoComprido: boolean, p: Paleta, semente: number): string {
  return material === 'bronze' ? escovado(x, y, largura, altura, aoComprido, semente) : veios(x, y, largura, altura, aoComprido, p.veio, semente)
}

/** O ornamento de canto: uma rosácea entalhada na madeira, um cravo no bronze. */
function canto(cx: number, cy: number, material: MaterialDasDeslizantes, p: Paleta): string {
  if (material === 'bronze') {
    return `<circle cx="${n(cx)}" cy="${n(cy)}" r="15" fill="${p.escuro}" opacity=".6"/><circle cx="${n(cx - 1.5)}" cy="${n(cy - 1.5)}" r="11" fill="url(#dz-cravo)"/>`
  }
  const petalas = Array.from({ length: 6 }, (_, i) => `<ellipse cx="${n(cx)}" cy="${n(cy - 10)}" rx="4.2" ry="8.5" transform="rotate(${i * 60} ${n(cx)} ${n(cy)})"/>`).join('')
  return `<g fill="${p.escuro}" opacity=".75">${petalas}</g><circle cx="${n(cx)}" cy="${n(cy)}" r="5" fill="${p.claro}" opacity=".7"/><circle cx="${n(cx + 1)}" cy="${n(cy + 1)}" r="5" fill="none" stroke="${p.escuro}" stroke-width="1.5" opacity=".6"/>`
}

/** A seta gravada no aro, do lado do poço mais perto da saída. */
function setaDaSaida(alvo: number, lado: number, p: Paleta): string {
  const passo = POCO.lado / lado
  const linha = Math.floor(alvo / lado)
  const coluna = alvo % lado
  const cx = POCO.x + (coluna + 0.5) * passo
  const cy = POCO.y + (linha + 0.5) * passo
  const distancias = [linha, lado - 1 - coluna, lado - 1 - linha, coluna]
  const lado0 = distancias.indexOf(Math.min(...distancias))
  const meioDoAro = ARO / 2
  const [x, y, giro]: [number, number, number] =
    lado0 === 0 ? [cx, BANDEJA.y + meioDoAro, 0] : lado0 === 1 ? [BANDEJA.x + BANDEJA.lado - meioDoAro, cy, 90] : lado0 === 2 ? [cx, BANDEJA.y + BANDEJA.lado - meioDoAro, 180] : [BANDEJA.x + meioDoAro, cy, 270]
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${giro})"><path d="M0 -17L15 9H6V17H-6V9H-15Z" fill="${p.escuro}" opacity=".7" transform="translate(1.5 2)"/><path d="M0 -17L15 9H6V17H-6V9H-15Z" fill="${p.fio}"/></g>`
}

/** O encaixe da saída, gravado no fundo do poço: um quadrado com o buraco da fechadura. */
function encaixeDaSaida(alvo: number, lado: number, p: Paleta): string {
  const passo = POCO.lado / lado
  const x = POCO.x + (alvo % lado) * passo
  const y = POCO.y + Math.floor(alvo / lado) * passo
  const m = passo * 0.14
  const cx = x + passo / 2
  const cy = y + passo / 2
  const r = passo * 0.11
  return [
    `<rect x="${n(x + m)}" y="${n(y + m)}" width="${n(passo - 2 * m)}" height="${n(passo - 2 * m)}" rx="${n(passo * 0.08)}" fill="none" stroke="${p.fio}" stroke-width="3" stroke-dasharray="10 7" opacity=".75"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy - r * 0.4)}" r="${n(r)}" fill="#000" opacity=".8"/>`,
    `<path d="M${n(cx - r * 0.55)} ${n(cy)}L${n(cx + r * 0.55)} ${n(cy)}L${n(cx + r * 0.85)} ${n(cy + r * 2.2)}L${n(cx - r * 0.85)} ${n(cy + r * 2.2)}Z" fill="#000" opacity=".8"/>`,
  ].join('')
}

function svgDaBase(material: MaterialDasDeslizantes, lado: number, alvo: number | null, comPlaqueta: boolean): string {
  const p = PALETAS[material]
  const { x, y, lado: l } = BANDEJA
  const passo = POCO.lado / lado
  let juntas = ''
  for (let i = 1; i < lado; i++) juntas += `M${n(POCO.x + i * passo)} ${POCO.y}V${POCO.y + POCO.lado}M${POCO.x} ${n(POCO.y + i * passo)}H${POCO.x + POCO.lado}`
  const metal = material === 'bronze'
  const plaqueta = comPlaqueta
    ? [
        `<g filter="url(#grt-sombra)" opacity=".8"><rect x="${PLAQUETA.x + 8}" y="${PLAQUETA.y + 12}" width="${PLAQUETA.lado}" height="${PLAQUETA.lado + 46}" rx="10" fill="#000"/></g>`,
        `<rect x="${PLAQUETA.x}" y="${PLAQUETA.y}" width="${PLAQUETA.lado}" height="${PLAQUETA.lado + 46}" rx="10" fill="url(#dz-aro)"/>`,
        `<rect x="${PLAQUETA.x + 14}" y="${PLAQUETA.y + 14}" width="${PLAQUETA.lado - 28}" height="${PLAQUETA.lado - 28}" fill="${p.fundo}"/>`,
        `<rect x="${PLAQUETA.x + 5}" y="${PLAQUETA.y + 5}" width="${PLAQUETA.lado - 10}" height="${PLAQUETA.lado + 36}" rx="7" fill="none" stroke="${p.fio}" stroke-width="2" opacity=".6"/>`,
        `<text x="${PLAQUETA.x + PLAQUETA.lado / 2 + 1.5}" y="${PLAQUETA.y + PLAQUETA.lado + 26.5}" text-anchor="middle" font-family="Georgia, serif" font-size="21" font-weight="700" letter-spacing="4" fill="${p.escuro}" opacity=".8">A FIGURA</text>`,
        `<text x="${PLAQUETA.x + PLAQUETA.lado / 2}" y="${PLAQUETA.y + PLAQUETA.lado + 25}" text-anchor="middle" font-family="Georgia, serif" font-size="21" font-weight="700" letter-spacing="4" fill="${p.fio}">A FIGURA</text>`,
      ].join('')
    : ''
  return [
    `<svg ${SVG} viewBox="0 0 ${LARGURA_DO_QUADRO} ${ALTURA_DO_QUADRO}" width="${LARGURA_DO_QUADRO}" height="${ALTURA_DO_QUADRO}">`,
    '<defs>',
    FILTROS_DA_PAREDE,
    `<linearGradient id="dz-aro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.claro}"/><stop offset=".45" stop-color="${p.base}"/><stop offset="1" stop-color="${p.escuro}"/></linearGradient>`,
    `<linearGradient id="dz-poco" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".18" stop-color="${p.fundo}"/><stop offset="1" stop-color="${p.fundo}"/></linearGradient>`,
    `<radialGradient id="dz-cravo" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="${p.fio}"/><stop offset=".6" stop-color="${p.base}"/><stop offset="1" stop-color="${p.escuro}"/></radialGradient>`,
    metal ? '<linearGradient id="dz-brilho" x1="0" y1="0" x2="1" y2="1"><stop offset=".18" stop-color="#fff6dc" stop-opacity="0"/><stop offset=".3" stop-color="#fff6dc" stop-opacity=".22"/><stop offset=".38" stop-color="#fff6dc" stop-opacity="0"/><stop offset=".66" stop-color="#fff6dc" stop-opacity="0"/><stop offset=".72" stop-color="#fff6dc" stop-opacity=".1"/><stop offset=".8" stop-color="#fff6dc" stop-opacity="0"/></linearGradient>' : '',
    '</defs>',
    parede(),
    `<g filter="url(#grt-sombra)" opacity=".9"><rect x="${x + 16}" y="${y + 24}" width="${l}" height="${l}" rx="20" fill="#000"/></g>`,
    `<rect x="${x}" y="${y}" width="${l}" height="${l}" rx="20" fill="url(#dz-aro)"/>`,
    textura(material, x + 10, y + 8, l - 20, ARO - 16, true, p, 1),
    textura(material, x + 10, y + l - ARO + 8, l - 20, ARO - 16, true, p, 2),
    textura(material, x + 8, y + ARO, ARO - 16, l - 2 * ARO, false, p, 3),
    textura(material, x + l - ARO + 8, y + ARO, ARO - 16, l - 2 * ARO, false, p, 4),
    // O bronze ganha um reflexo largo e frio na diagonal: é o que faz o escovado ler como metal.
    metal ? `<rect x="${x}" y="${y}" width="${l}" height="${l}" rx="20" fill="url(#dz-brilho)"/>` : '',
    // O chanfro: luz em cima e à esquerda, sombra embaixo e à direita, e o fio embutido no meio do aro.
    `<rect x="${x + 3}" y="${y + 3}" width="${l - 6}" height="${l - 6}" rx="18" fill="none" stroke="${p.claro}" stroke-width="3" opacity=".55"/>`,
    `<rect x="${x + 26}" y="${y + 26}" width="${l - 52}" height="${l - 52}" rx="10" fill="none" stroke="${p.fio}" stroke-width="2.5" opacity=".55"/>`,
    `<rect x="${POCO.x - 14}" y="${POCO.y - 14}" width="${POCO.lado + 28}" height="${POCO.lado + 28}" rx="8" fill="none" stroke="${p.escuro}" stroke-width="12" opacity=".85"/>`,
    `<path d="M${POCO.x - 20} ${POCO.y + POCO.lado + 20}H${POCO.x + POCO.lado + 20}V${POCO.y - 20}" fill="none" stroke="${p.claro}" stroke-width="2.5" opacity=".5"/>`,
    canto(x + ARO / 2, y + ARO / 2, material, p),
    canto(x + l - ARO / 2, y + ARO / 2, material, p),
    canto(x + ARO / 2, y + l - ARO / 2, material, p),
    canto(x + l - ARO / 2, y + l - ARO / 2, material, p),
    // O poço: fundo escuro com a sombra do aro em cima, e os sulcos por onde as peças correm.
    `<rect x="${POCO.x}" y="${POCO.y}" width="${POCO.lado}" height="${POCO.lado}" fill="url(#dz-poco)"/>`,
    `<path d="${juntas}" stroke="#000" stroke-width="3" opacity=".55"/>`,
    alvo === null ? '' : encaixeDaSaida(alvo, lado, p) + setaDaSaida(alvo, lado, p),
    plaqueta,
    '</svg>',
  ].join('')
}

const bases = new Map<string, string>()

/** A parede com a bandeja (e a saída, no modo chave; a plaqueta da figura, no modo figura). */
export function urlDaBaseDasDeslizantes(material: MaterialDasDeslizantes, lado: number, alvo: number | null, comPlaqueta: boolean): string {
  const chave = `${material}|${lado}|${alvo ?? '-'}|${comPlaqueta ? 1 : 0}`
  const pronta = bases.get(chave)
  if (pronta !== undefined) return pronta
  const url = emUrl(svgDaBase(material, lado, alvo, comPlaqueta))
  bases.set(chave, url)
  return url
}

const molduras = new Map<string, string>()

/** A moldura de cada peça (o centro vazado, a figura aparece por baixo): o chanfro de luz e sombra do material. */
export function urlDaMolduraDaPeca(material: MaterialDasDeslizantes): string {
  const pronta = molduras.get(material)
  if (pronta !== undefined) return pronta
  const p = PALETAS[material]
  const url = emUrl(
    [
      `<svg ${SVG} viewBox="0 0 100 100" preserveAspectRatio="none">`,
      `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.claro}"/><stop offset=".5" stop-color="${p.base}"/><stop offset="1" stop-color="${p.escuro}"/></linearGradient></defs>`,
      '<path fill-rule="evenodd" fill="url(#b)" d="M0 0H100V100H0ZM7 7V93H93V7Z"/>',
      '<path d="M7.6 92.4V7.6H92.4" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="1.6"/>',
      `<path d="M7.6 92.4H92.4V7.6" fill="none" stroke="${p.claro}" stroke-opacity=".5" stroke-width="1.2"/>`,
      `<path d="M.8 99.2V.8H99.2" fill="none" stroke="${p.claro}" stroke-opacity=".8" stroke-width="1.6"/>`,
      '<path d="M.8 99.2H99.2V.8" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>',
      '</svg>',
    ].join(''),
  )
  molduras.set(material, url)
  return url
}

const blocos = new Map<string, string>()

/** O bloco liso do modo chave: o campo entalhado com um losango; a peça-chave, dourada, com a chave em relevo. */
export function urlDoBloco(material: MaterialDasDeslizantes, ehChave: boolean): string {
  const chave = `${material}|${ehChave ? 1 : 0}`
  const pronta = blocos.get(chave)
  if (pronta !== undefined) return pronta
  const p = PALETAS[material]
  const [claro, escuro] = ehChave ? ['#f3d98a', '#a77b2c'] : [p.campoClaro, p.campoEscuro]
  const motivo = ehChave
    ? [
        '<g transform="rotate(-35 50 50)">',
        '<g fill="#3b2a10" opacity=".55" transform="translate(1.6 1.8)"><circle cx="50" cy="30" r="12"/><rect x="46.5" y="38" width="7" height="38" rx="2"/><rect x="53" y="62" width="12" height="6" rx="1.5"/><rect x="53" y="71" width="9" height="5" rx="1.5"/></g>',
        '<g fill="#fff3c8"><circle cx="50" cy="30" r="12"/><rect x="46.5" y="38" width="7" height="38" rx="2"/><rect x="53" y="62" width="12" height="6" rx="1.5"/><rect x="53" y="71" width="9" height="5" rx="1.5"/></g>',
        '<circle cx="50" cy="30" r="5.5" fill="#a77b2c"/>',
        '</g>',
      ].join('')
    : `<path d="M50 30L70 50L50 70L30 50Z" fill="none" stroke="${p.escuro}" stroke-width="3" opacity=".6"/><path d="M50 37L63 50L50 63L37 50Z" fill="${p.escuro}" opacity=".25"/>`
  const url = emUrl(
    [
      `<svg ${SVG} viewBox="0 0 100 100" preserveAspectRatio="none">`,
      // No bronze, o campo tem uma faixa de luz no meio do degradê (metal), e não só o claro e o escuro.
      `<defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${claro}"/>${material === 'bronze' ? `<stop offset=".42" stop-color="${ehChave ? '#fbe7ae' : '#cfa25a'}"/><stop offset=".56" stop-color="${ehChave ? '#d9ac52' : p.campoClaro}"/>` : ''}<stop offset="1" stop-color="${escuro}"/></linearGradient></defs>`,
      '<rect width="100" height="100" fill="url(#c)"/>',
      ehChave ? '' : textura(material, 4, 4, 92, 92, true, p, 5),
      motivo,
      '</svg>',
    ].join(''),
  )
  blocos.set(chave, url)
  return url
}

/**
 * Onde a figura aparece numa peça (o `background-position` em %): a peça da
 * coluna `k` de `lado`, com a figura `escala` vezes mais larga que o quadrado
 * (a imagem do mestre que não é quadrada, cortada no meio como um `cover`).
 */
export function posicaoNaFigura(k: number, lado: number, escala: number): number {
  const largura = lado * escala
  return largura <= 1 ? 0 : (((largura - lado) / 2 + k) / (largura - 1)) * 100
}
