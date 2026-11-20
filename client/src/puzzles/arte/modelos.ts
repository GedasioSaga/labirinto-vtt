/**
 * A ARTE DOS 4 MODELOS (Fonte, Porta de brasões, Cofre, Altar) e da MOLDURA
 * PORTA de cada um: o SVG do protótipo aprovado
 * (`docs/design/puzzles/prototipo-v2.html`, commit 577060ed, versão Porta),
 * portado traço por traço, com as cores e a inscrição do mestre.
 *
 * O quadro é sempre 1600 x 1000 (16:10) e os encaixes moram em % dele
 * (`puzzles/padroes.ts`): a moldura Porta é desenhada EM VOLTA das mesmas
 * posições, então trocar a moldura nunca move um encaixe.
 *
 * As partes que se mexem ao resolver levam classe própria (`qpz-*`), e quem as
 * anima é `puzzles/QuadroDoPuzzle.css`: a água da fonte, as folhas da porta,
 * a porta do cofre, a gaveta do altar e as folhas da moldura Porta.
 *
 * SEGURANÇA. O SVG vai para a tela como HTML (`QuadroDoPuzzle.tsx`), e cor e
 * inscrição vêm do mestre pelo arquivo do mapa e pela rede. Por isso esta é a
 * única porta de entrada, e ela só monta: números; cores que passaram por
 * `corSegura` (`#rrggbb` exato, senão a cor do modelo); texto que passou por
 * `escaparXml`; e o prefixo dos ids por `prefixoSeguro`. Nada chega cru.
 *
 * Puro: sem React, sem disco.
 */
import { PADROES_DOS_MODELOS } from '../padroes'
import type { CoresDoModelo, ModeloDoPuzzle, MolduraDoPuzzle, VisualDoPuzzle } from '../tipos'

/** O quadro inteiro, em unidades do `viewBox`: 16:10, como o `.qpz`. */
export const LARGURA_DA_ARTE = 1600
export const ALTURA_DA_ARTE = 1000

export interface ArteDoModelo {
  modelo: ModeloDoPuzzle
  moldura: MolduraDoPuzzle
  cores: CoresDoModelo
  inscricao: string
}

// ------------------------------------------------------------------ o sanitizador

const COR_HEX = /^#[0-9a-fA-F]{6}$/

/** A cor do mestre só entra no SVG se for `#rrggbb` exato; o resto vira a `reserva` (a cor do modelo). */
export function corSegura(valor: string, reserva: string): string {
  return COR_HEX.test(valor) ? valor.toLowerCase() : reserva
}

const ENTIDADE: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Texto do mestre dentro do SVG: os 5 caracteres que abrem marcação viram entidade (o `esc` do v2). */
export function escaparXml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ENTIDADE[c] ?? c)
}

/** O prefixo dos ids do SVG (gradiente, recorte): só letra, número, `_` e `-`, para não fechar o `url(#...)`. */
export function prefixoSeguro(prefixo: string): string {
  const limpo = prefixo.replace(/[^A-Za-z0-9_-]/g, '')
  return `pz${limpo}`
}

// ------------------------------------------------------------------ utilidades do v2

/** O gerador de números com semente do v2 (mulberry32): a mesma parede a cada desenho. */
function rng(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CANAL_MAX = 255

/** Escurece (< 1) ou clareia (> 1) uma cor `#rrggbb`. O contorno do Meio-Termo é a própria cor a ~60%. */
function tom(hex: string, fator: number): string {
  const n = Number.parseInt(hex.slice(1), 16) || 0
  const canais = [(n >> 16) & CANAL_MAX, (n >> 8) & CANAL_MAX, n & CANAL_MAX].map((valor) => Math.max(0, Math.min(CANAL_MAX, Math.round(valor * fator))))
  return `#${((1 << 24) | (canais[0] << 16) | (canais[1] << 8) | canais[2]).toString(16).slice(1)}`
}

const ABRE_SVG = `<svg viewBox="0 0 ${LARGURA_DA_ARTE} ${ALTURA_DA_ARTE}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`

/** A parede de blocos, em fiadas desencontradas. */
function parede(semente: number, y0: number, y1: number, base: string): string {
  const r = rng(semente)
  let s = `<rect y="${y0}" width="1600" height="${y1 - y0}" fill="${tom(base, 0.62)}"/>`
  const alt = 66
  for (let y = y0, fila = 0; y < y1; y += alt, fila++) {
    let x = -(fila % 2) * 70 - r() * 40
    while (x < 1600) {
      const w = 120 + r() * 100
      s += `<rect x="${x.toFixed(1)}" y="${y + 3}" width="${(w - 6).toFixed(1)}" height="${Math.min(alt, y1 - y) - 6}" rx="8" fill="${tom(base, 0.88 + r() * 0.22)}"/>`
      x += w
    }
  }
  return s
}

/** O chão de lajes, maiores perto de quem olha. */
function chao(semente: number, y0: number, base: string): string {
  const r = rng(semente)
  let s = `<rect y="${y0}" width="1600" height="${1000 - y0}" fill="${tom(base, 0.6)}"/>`
  for (let y = y0, fila = 0; y < 1000; fila++) {
    const alt = 70 + fila * 18
    let x = -r() * 120
    while (x < 1600) {
      const w = 190 + r() * 120 + fila * 30
      s += `<rect x="${x.toFixed(1)}" y="${y + 4}" width="${(w - 8).toFixed(1)}" height="${alt - 8}" rx="10" fill="${tom(base, 0.86 + r() * 0.2)}"/>`
      x += w
    }
    y += alt
  }
  return s
}

/** A luz de lampião e o véu escuro das bordas. */
function luz(p: string, cx = 0.5, cy = 0.4): string {
  return `<defs>
  <radialGradient id="${p}l" cx="${cx}" cy="${cy}" r="0.7"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".3"/><stop offset=".65" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
  <radialGradient id="${p}v" cx=".5" cy=".5" r=".78"><stop offset=".55" stop-color="#0c0a08" stop-opacity="0"/><stop offset="1" stop-color="#0c0a08" stop-opacity=".72"/></radialGradient>
</defs>`
}

function veu(p: string): string {
  return `<rect width="1600" height="1000" fill="url(#${p}l)"/><rect width="1600" height="1000" fill="url(#${p}v)"/>`
}

function musgo(pontos: readonly (readonly [number, number, number])[]): string {
  return pontos.map(([x, y, rx]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.45}" fill="#7a9a5e" stroke="#4c5c3c" stroke-width="3"/>`).join('')
}

/** Largura média de um caractere na fonte da inscrição, em fração do tamanho (a conta do v2). */
const LARGURA_DO_CARACTERE = 0.5
const ENTRELINHA = 1.2

/** Texto do mestre gravado na arte: quebra em linhas pela largura e encolhe se precisar. Escapado aqui. */
function textoSvg(texto: string, x: number, y: number, tam: number, cor: string, largura: number, maxLinhas = 1): string {
  const txt = texto.trim()
  if (!txt) return ''
  const porLinha = Math.max(6, Math.floor(largura / (tam * LARGURA_DO_CARACTERE)))
  const linhas: string[] = []
  let atual = ''
  for (const palavra of txt.split(/\s+/)) {
    if (`${atual} ${palavra}`.trim().length > porLinha && atual) {
      linhas.push(atual)
      atual = palavra
    } else atual = `${atual} ${palavra}`.trim()
  }
  if (atual) linhas.push(atual)
  const usadas = linhas.slice(0, maxLinhas)
  if (linhas.length > maxLinhas) usadas[maxLinhas - 1] = usadas[maxLinhas - 1].replace(/.{0,2}$/, '…')
  const maior = Math.max(...usadas.map((linha) => linha.length))
  const tt = tam * Math.min(1, porLinha / maior)
  const tspans = usadas.map((linha, i) => `<tspan x="${x}" dy="${i ? tt * ENTRELINHA : 0}">${escaparXml(linha)}</tspan>`).join('')
  return `<text x="${x}" y="${y - ((usadas.length - 1) * tt * ENTRELINHA) / 2}" text-anchor="middle" style="font:400 ${tt.toFixed(1)}px 'Sitka Banner', Constantia, Georgia, serif" fill="${cor}">${tspans}</text>`
}

/** A garça de pedra da fonte (o bico de onde sai a água). */
function garca(x: number, espelho: boolean, cor: string): string {
  const t = espelho ? `translate(${x} 222) scale(-1 1)` : `translate(${x} 222)`
  return `<g transform="${t}"><path d="M24 118C21 76 36 50 19 24 9 7-21 5-31 20l-34 23 40-9c12 13 0 50 2 84z" fill="${tom(cor, 1.1)}" stroke="${tom(cor, 0.58)}" stroke-width="6" stroke-linejoin="round"/>
    <circle cx="-14" cy="21" r="5" fill="#4f4c44"/><path d="M8 34c6 10 6 24 2 38" stroke="${tom(cor, 0.92)}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`
}

// ------------------------------------------------------------------ os 4 modelos (moldura Original)

function arteFonte(p: string, k: CoresDoModelo, insc: string): string {
  const o = k.objeto
  const c1 = tom(o, 0.58)
  const c2 = tom(o, 0.92)
  const c3 = tom(o, 0.76)
  return `${ABRE_SVG}${luz(p, 0.5, 0.38)}
  ${parede(11, 0, 660, k.parede)}${chao(12, 660, k.chao)}
  <path d="M500 800V330Q500 230 630 212Q800 168 970 212Q1100 230 1100 330V800Z" fill="${o}" stroke="${c1}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M548 770V340Q548 270 650 256Q800 222 950 256Q1052 270 1052 340V770Z" fill="${c2}" stroke="${c3}" stroke-width="4"/>
  <path d="M600 640h400M640 690h320" stroke="${c3}" stroke-width="4" stroke-linecap="round"/>
  ${garca(592, false, o)}${garca(800, false, o)}${garca(1008, true, o)}
  <ellipse cx="800" cy="812" rx="470" ry="74" fill="${tom(o, 0.8)}" stroke="${c1}" stroke-width="6"/>
  <ellipse cx="800" cy="812" rx="428" ry="56" fill="#3b3e3b"/>
  <ellipse class="qpz-agua qpz-agua--bacia" cx="800" cy="816" rx="424" ry="52" fill="#8fbcc4" stroke="#567176" stroke-width="4"/>
  <path class="qpz-agua qpz-agua--fio" d="M527 265C480 300 452 420 446 800" stroke="#a9cfd6" stroke-width="16" fill="none" stroke-linecap="round"/>
  <path class="qpz-agua qpz-agua--fio" d="M735 265C690 300 668 420 664 800" stroke="#a9cfd6" stroke-width="16" fill="none" stroke-linecap="round"/>
  <path class="qpz-agua qpz-agua--fio" d="M1073 265C1120 300 1148 420 1154 800" stroke="#a9cfd6" stroke-width="16" fill="none" stroke-linecap="round"/>
  <path d="M330 812V900Q330 950 800 962Q1270 950 1270 900V812Q1270 884 800 888Q330 884 330 812Z" fill="${o}" stroke="${c1}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M330 812Q330 884 800 888Q1270 884 1270 812" stroke="${tom(o, 1.16)}" stroke-width="9" fill="none"/>
  ${textoSvg(insc, 800, 930, 38, c1, 760)}
  ${musgo([[540, 792, 34], [1090, 790, 26], [420, 900, 30], [1180, 915, 22]])}
  ${veu(p)}</svg>`
}

function artePorta(p: string, k: CoresDoModelo, insc: string): string {
  const o = k.objeto
  const c1 = tom(o, 0.6)
  const c2 = tom(o, 0.78)
  const c3 = tom(o, 0.89)
  const tabuas = (x0: number, x1: number) => {
    let s = ''
    for (let x = x0 + 66; x < x1 - 20; x += 66) s += `<path d="M${x} 168V898" stroke="${c2}" stroke-width="4"/>`
    return s
  }
  const veios = (x0: number) => [0, 1, 2].map((n) => `<path d="M${x0 + 30 + n * 96} 300c10 60-8 120 4 190s-6 150 6 230" stroke="${c3}" stroke-width="2.5" fill="none" opacity=".7"/>`).join('')
  const rebites = (x0: number, x1: number, y: number) => {
    let s = ''
    for (let x = x0 + 30; x < x1; x += 70) s += `<circle cx="${x}" cy="${y}" r="7" fill="#7f8488" stroke="#383a3c" stroke-width="2.5"/>`
    return s
  }
  const folha = (lado: 'e' | 'd', x0: number, x1: number) => {
    const argola = lado === 'e' ? x1 - 34 : x0 + 34
    return `<g class="qpz-folha-${lado}"><rect x="${x0}" y="164" width="${x1 - x0}" height="736" fill="${o}" stroke="${c1}" stroke-width="6"/>
    ${tabuas(x0, x1)}${veios(x0)}
    <rect x="${x0}" y="230" width="${x1 - x0}" height="34" fill="#5d6164" stroke="#383a3c" stroke-width="4"/>${rebites(x0, x1, 247)}
    <rect x="${x0}" y="800" width="${x1 - x0}" height="34" fill="#5d6164" stroke="#383a3c" stroke-width="4"/>${rebites(x0, x1, 817)}
    <rect x="${x0}" y="364" width="${x1 - x0}" height="132" fill="#565a5e" stroke="#383a3c" stroke-width="5"/>
    <circle cx="${argola}" cy="610" r="22" fill="none" stroke="#383a3c" stroke-width="9"/><circle cx="${argola}" cy="610" r="22" fill="none" stroke="#8a8f93" stroke-width="4"/></g>`
  }
  return `${ABRE_SVG}${luz(p, 0.5, 0.36)}
  ${parede(21, 0, 700, k.parede)}${chao(22, 700, k.chao)}
  <rect x="400" y="90" width="800" height="830" fill="${tom(k.parede, 1.35)}" stroke="${tom(k.parede, 0.85)}" stroke-width="7"/>
  <rect x="372" y="62" width="856" height="110" rx="6" fill="${tom(k.parede, 1.6)}" stroke="${tom(k.parede, 0.85)}" stroke-width="7"/>
  <rect x="460" y="164" width="680" height="736" fill="#15120f"/>
  <ellipse cx="800" cy="560" rx="260" ry="320" fill="#ffd9a0" opacity=".06"/>
  ${folha('e', 460, 800)}${folha('d', 800, 1140)}
  <g class="qpz-some"><rect x="600" y="656" width="400" height="94" rx="6" fill="#b89552" stroke="#6e5931" stroke-width="5"/>
  ${textoSvg(insc, 800, 712, 32, '#4a3b1f', 360, 2)}</g>
  ${musgo([[420, 905, 26], [1188, 900, 30]])}
  ${veu(p)}</svg>`
}

function arteCofre(p: string, k: CoresDoModelo, insc: string): string {
  const o = k.objeto
  const c1 = tom(o, 0.55)
  const c2 = tom(o, 1.25)
  let rebites = ''
  for (let x = 450; x <= 1150; x += 58) {
    rebites += `<circle cx="${x}" cy="154" r="7" fill="${c2}" stroke="${c1}" stroke-width="2.5"/><circle cx="${x}" cy="866" r="7" fill="${c2}" stroke="${c1}" stroke-width="2.5"/>`
  }
  return `${ABRE_SVG}${luz(p, 0.5, 0.4)}
  ${parede(31, 0, 720, k.parede)}${chao(32, 720, k.chao)}
  <g transform="rotate(-4 260 390)"><rect x="140" y="240" width="240" height="290" fill="#e9dfc8" stroke="#8b8270" stroke-width="4"/>
  ${textoSvg(insc, 260, 390, 26, '#5a4a32', 200, 6)}
  <circle cx="260" cy="254" r="10" fill="#c4574a" stroke="#7a241d" stroke-width="3"/></g>
  <rect x="420" y="130" width="760" height="760" rx="20" fill="${o}" stroke="${c1}" stroke-width="7"/>
  <rect x="434" y="144" width="732" height="732" rx="14" fill="none" stroke="${c2}" stroke-width="4"/>${rebites}
  <rect x="470" y="180" width="660" height="660" rx="12" fill="#1b1a18"/>
  <path d="M480 560h640" stroke="#3a3833" stroke-width="10"/>
  <rect x="560" y="440" width="96" height="120" rx="6" fill="#775739" stroke="#473422" stroke-width="4"/>
  <ellipse cx="760" cy="548" rx="54" ry="16" fill="#c7a768" stroke="#6e5931" stroke-width="4"/><ellipse cx="760" cy="532" rx="54" ry="16" fill="#d1b06c" stroke="#6e5931" stroke-width="4"/>
  <g class="qpz-porta-cofre"><rect x="470" y="180" width="660" height="660" rx="12" fill="${tom(o, 0.92)}" stroke="${c1}" stroke-width="6"/>
  <rect x="520" y="230" width="560" height="400" rx="16" fill="${tom(o, 0.84)}" stroke="${c1}" stroke-width="5"/>
  <circle cx="800" cy="730" r="62" fill="${tom(o, 0.75)}" stroke="${c1}" stroke-width="6"/>
  <path d="M500 690h120M980 690h120" stroke="${tom(o, 0.7)}" stroke-width="5" stroke-linecap="round"/></g>
  ${veu(p)}</svg>`
}

function arteAltar(p: string, k: CoresDoModelo, insc: string): string {
  const o = k.objeto
  const c1 = tom(o, 0.62)
  const c2 = tom(o, 0.92)
  const c3 = tom(o, 0.8)
  const vela = (x: number) => `<rect x="${x - 15}" y="420" width="30" height="80" rx="4" fill="#efe6d0" stroke="#9a927f" stroke-width="4"/>
    <ellipse cx="${x}" cy="398" rx="11" ry="20" fill="#f3ba66" stroke="#c17a2c" stroke-width="3"/><circle cx="${x}" cy="400" r="70" fill="#ffd9a0" opacity=".09"/>`
  return `${ABRE_SVG}${luz(p, 0.45, 0.42)}
  ${parede(41, 0, 640, k.parede)}${chao(42, 640, k.chao)}
  <path d="M380 470V200Q380 110 690 110Q1000 110 1000 200V470Z" fill="${tom(k.parede, 0.62)}" stroke="${tom(k.parede, 0.9)}" stroke-width="6"/>
  <rect x="300" y="560" width="780" height="330" fill="${o}" stroke="${c1}" stroke-width="7"/>
  <rect x="340" y="600" width="200" height="240" rx="6" fill="${c2}" stroke="${c3}" stroke-width="4"/>
  <rect x="840" y="600" width="200" height="240" rx="6" fill="${c2}" stroke="${c3}" stroke-width="4"/>
  <rect x="570" y="752" width="240" height="96" fill="#2a2620"/>
  <g class="qpz-gaveta"><rect x="570" y="700" width="240" height="96" rx="4" fill="${tom(o, 0.9)}" stroke="${c1}" stroke-width="5"/>
  <rect x="660" y="738" width="60" height="16" rx="6" fill="${c1}"/></g>
  <rect x="260" y="500" width="860" height="66" rx="10" fill="${tom(o, 1.12)}" stroke="${c1}" stroke-width="7"/>
  ${textoSvg(insc, 690, 543, 30, c1, 760)}
  ${vela(300)}${vela(1080)}
  <rect x="1090" y="296" width="350" height="44" rx="6" fill="${tom(o, 1.12)}" stroke="${c1}" stroke-width="6"/>
  <rect x="1116" y="340" width="298" height="570" fill="${tom(o, 1.03)}" stroke="${c1}" stroke-width="6"/>
  ${musgo([[330, 885, 30], [1060, 892, 26], [1130, 905, 22], [1420, 900, 28]])}
  ${veu(p)}</svg>`
}

// ------------------------------------------------------------------ a moldura Porta (o objeto vira uma passagem de pedra)

interface Passagem {
  x0: number
  x1: number
  y0: number
  pedra: string
  folha: string
  /** Duas folhas que giram, ou uma que corre para dentro da parede. */
  folhas: 1 | 2
}

/** A base de toda passagem: a soleira fica em y = 900. */
const BASE_DA_PASSAGEM = 900

/** Batente, verga, soleira, o escuro do outro lado e as folhas (recortadas no vão, para correr para dentro da parede). */
function passagem(p: string, g: Passagem): string {
  const { x0, x1, y0, pedra, folha, folhas } = g
  const y1 = BASE_DA_PASSAGEM
  const cx = (x0 + x1) / 2
  const c1 = tom(pedra, 0.6)
  const c2 = tom(pedra, 0.82)
  const c3 = tom(pedra, 1.12)
  const blocos = (x: number, w: number) => {
    let s = ''
    for (let y = y0 + 90; y < y1; y += 110) s += `<path d="M${x} ${y}h${w}" stroke="${c2}" stroke-width="4"/>`
    return s
  }
  const painel = (a: number, b: number) => `<rect x="${a + 34}" y="${y0 + 40}" width="${b - a - 68}" height="${(y1 - y0) * 0.38}" rx="8" fill="none" stroke="${tom(folha, 0.72)}" stroke-width="5"/>
    <rect x="${a + 34}" y="${y0 + 60 + (y1 - y0) * 0.42}" width="${b - a - 68}" height="${(y1 - y0) * 0.46}" rx="8" fill="none" stroke="${tom(folha, 0.72)}" stroke-width="5"/>`
  const yArgola = y0 + (y1 - y0) * 0.6
  const umaFolha = (lado: 'e' | 'd', a: number, b: number, argola: number) => `<g class="qpz-pf-${lado}"><rect x="${a}" y="${y0}" width="${b - a}" height="${y1 - y0}" fill="${folha}" stroke="${tom(folha, 0.58)}" stroke-width="6"/>
    ${painel(a, b)}<path d="M${a + 10} ${y0 + 8}h${b - a - 20}" stroke="${tom(folha, 1.18)}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${argola}" cy="${yArgola}" r="20" fill="none" stroke="${tom(folha, 0.5)}" stroke-width="8"/><circle cx="${argola}" cy="${yArgola}" r="20" fill="none" stroke="${tom(folha, 1.25)}" stroke-width="3"/></g>`
  const rebites = Array.from({ length: Math.floor((x1 - x0 - 40) / 56) + 1 }, (_, i) => x0 + 20 + i * 56)
    .map((x) => `<circle cx="${x}" cy="${y0 + 22}" r="6" fill="${tom(folha, 1.3)}" stroke="${tom(folha, 0.5)}" stroke-width="2"/><circle cx="${x}" cy="${y1 - 22}" r="6" fill="${tom(folha, 1.3)}" stroke="${tom(folha, 0.5)}" stroke-width="2"/>`)
    .join('')
  const travessas = [0.18, 0.5, 0.82].map((f) => `<path d="M${x0} ${y0 + (y1 - y0) * f}h${x1 - x0}" stroke="${tom(folha, 0.72)}" stroke-width="10"/>`).join('')
  const asFolhas =
    folhas === 2
      ? umaFolha('e', x0, cx, cx - 40) + umaFolha('d', cx, x1, cx + 40)
      : `<g class="qpz-pf-correr"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${folha}" stroke="${tom(folha, 0.55)}" stroke-width="6"/>
        ${travessas}${rebites}
        <rect x="${x0 + 18}" y="${y0 + (y1 - y0) * 0.56}" width="22" height="120" rx="8" fill="${tom(folha, 0.6)}"/></g>`
  const degraus = [0, 1, 2, 3].map((n) => `<path d="M${cx - 150 + n * 26} ${y1 - 18 - n * 34}h${300 - n * 52}" stroke="#3a3027" stroke-width="7" stroke-linecap="round"/>`).join('')
  return `<defs><clipPath id="${p}vao"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/></clipPath>
    <linearGradient id="${p}fundo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0b09"/><stop offset="1" stop-color="#231c15"/></linearGradient></defs>
  <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="url(#${p}fundo)"/>
  <g class="qpz-pf-luz"><path d="M${x0 + 40} ${y1}L${cx - 60} ${y0 + (y1 - y0) * 0.55}h120L${x1 - 40} ${y1}Z" fill="#ffd9a0" opacity=".07"/>
    ${degraus}</g>
  <g clip-path="url(#${p}vao)">${asFolhas}</g>
  <rect x="${x0 - 72}" y="${y0 - 6}" width="72" height="${y1 - y0 + 12}" fill="${pedra}" stroke="${c1}" stroke-width="6"/>${blocos(x0 - 72, 72)}
  <rect x="${x1}" y="${y0 - 6}" width="72" height="${y1 - y0 + 12}" fill="${pedra}" stroke="${c1}" stroke-width="6"/>${blocos(x1, 72)}
  <path d="M${x0 - 4} ${y0 - 6}V${y1 + 6}M${x1 + 4} ${y0 - 6}V${y1 + 6}" stroke="${c3}" stroke-width="4"/>
  <rect x="${x0 - 96}" y="${y1}" width="${x1 - x0 + 192}" height="40" rx="6" fill="${tom(pedra, 0.9)}" stroke="${c1}" stroke-width="6"/>`
}

/** A verga sobre o vão. */
function verga(x0: number, x1: number, yTopo: number, yBase: number, pedra: string): string {
  const c1 = tom(pedra, 0.6)
  return `<rect x="${x0 - 104}" y="${yTopo}" width="${x1 - x0 + 208}" height="${yBase - yTopo}" rx="8" fill="${pedra}" stroke="${c1}" stroke-width="7"/>
    <path d="M${x0 - 92} ${yTopo + 12}h${x1 - x0 + 184}" stroke="${tom(pedra, 1.14)}" stroke-width="5" stroke-linecap="round"/>`
}

function fontePorta(p: string, k: CoresDoModelo, insc: string): string {
  const o = k.objeto
  const c1 = tom(o, 0.58)
  const x0 = 470
  const x1 = 1130
  const y0 = 372
  return `${ABRE_SVG}${luz(p, 0.5, 0.38)}
  ${parede(11, 0, 760, k.parede)}${chao(12, 760, k.chao)}
  ${passagem(p, { x0, x1, y0, pedra: o, folha: tom(o, 0.94), folhas: 2 })}
  ${verga(x0, x1, 116, y0, o)}
  <path d="M${x0 - 92} 344h${x1 - x0 + 184}" stroke="${c1}" stroke-width="5"/>
  ${textoSvg(insc, 800, 176, 42, tom(o, 0.4), 640)}
  ${garca(592, false, o)}${garca(800, false, o)}${garca(1008, true, o)}
  <path class="qpz-agua qpz-agua--fio" d="M527 265C480 300 452 420 446 900" stroke="#a9cfd6" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path class="qpz-agua qpz-agua--fio" d="M1073 265C1120 300 1148 420 1154 900" stroke="#a9cfd6" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path d="M300 930H1300V962Q800 990 300 962Z" fill="${tom(o, 0.86)}" stroke="${c1}" stroke-width="6" stroke-linejoin="round"/>
  <ellipse class="qpz-agua qpz-agua--bacia" cx="800" cy="936" rx="490" ry="12" fill="#8fbcc4" stroke="#567176" stroke-width="3"/>
  ${musgo([[400, 905, 26], [1210, 908, 30], [330, 950, 20]])}
  ${veu(p)}</svg>`
}

function cofrePorta(p: string, k: CoresDoModelo, insc: string): string {
  const pedra = tom(k.parede, 1.38)
  const x0 = 470
  const x1 = 1130
  const y0 = 190
  const rebites = Array.from({ length: 13 }, (_, i) => 400 + i * 66.6)
    .map((x) => `<circle cx="${x.toFixed(1)}" cy="150" r="8" fill="${tom(k.objeto, 1.25)}" stroke="${tom(k.objeto, 0.55)}" stroke-width="3"/>`)
    .join('')
  return `${ABRE_SVG}${luz(p, 0.5, 0.4)}
  ${parede(31, 0, 780, k.parede)}${chao(32, 780, k.chao)}
  <g transform="rotate(-4 250 420)"><rect x="140" y="270" width="230" height="290" fill="#e9dfc8" stroke="#8b8270" stroke-width="4"/>
  ${textoSvg(insc, 255, 420, 26, '#5a4a32', 190, 6)}
  <circle cx="255" cy="284" r="10" fill="#c4574a" stroke="#7a241d" stroke-width="3"/></g>
  ${passagem(p, { x0, x1, y0, pedra, folha: k.objeto, folhas: 1 })}
  ${verga(x0, x1, 70, y0, pedra)}
  ${rebites}
  ${musgo([[410, 905, 24], [1196, 902, 28]])}
  ${veu(p)}</svg>`
}

function altarPorta(p: string, k: CoresDoModelo, insc: string): string {
  const o = k.objeto
  const c1 = tom(o, 0.62)
  const x0 = 380
  const x1 = 1000
  const y0 = 312
  const vela = (x: number) => `<rect x="${x - 34}" y="500" width="68" height="18" rx="4" fill="${tom(o, 0.9)}" stroke="${c1}" stroke-width="4"/><rect x="${x - 15}" y="420" width="30" height="80" rx="4" fill="#efe6d0" stroke="#9a927f" stroke-width="4"/>
    <ellipse cx="${x}" cy="398" rx="11" ry="20" fill="#f3ba66" stroke="#c17a2c" stroke-width="3"/><circle cx="${x}" cy="400" r="70" fill="#ffd9a0" opacity=".09"/>`
  return `${ABRE_SVG}${luz(p, 0.45, 0.42)}
  ${parede(41, 0, 760, k.parede)}${chao(42, 760, k.chao)}
  <path d="M${x0 - 104} 210Q${x0 - 104} 60 690 60Q${x1 + 104} 60 ${x1 + 104} 210Z" fill="${tom(k.parede, 0.62)}" stroke="${tom(k.parede, 0.9)}" stroke-width="6"/>
  ${passagem(p, { x0, x1, y0, pedra: o, folha: tom(o, 0.92), folhas: 2 })}
  ${verga(x0, x1, 200, y0, o)}
  ${textoSvg(insc, 690, 264, 36, tom(o, 0.4), 620)}
  ${vela(250)}${vela(1130)}
  <rect x="1190" y="296" width="290" height="44" rx="6" fill="${tom(o, 1.12)}" stroke="${c1}" stroke-width="6"/>
  <rect x="1214" y="340" width="242" height="570" fill="${tom(o, 1.03)}" stroke="${c1}" stroke-width="6"/>
  ${musgo([[300, 905, 26], [1060, 902, 24], [1440, 905, 26]])}
  ${veu(p)}</svg>`
}

// ------------------------------------------------------------------ a entrada

type Desenho = (prefixo: string, cores: CoresDoModelo, inscricao: string) => string

const ARTE_ORIGINAL: Readonly<Record<ModeloDoPuzzle, Desenho>> = { fonte: arteFonte, porta: artePorta, cofre: arteCofre, altar: arteAltar }

/** A Porta de brasões já é porta: não tem versão Porta, e a moldura Porta nela desenha a original (como o `htmlArte` do v2). */
const ARTE_PORTA: Readonly<Partial<Record<ModeloDoPuzzle, Desenho>>> = { fonte: fontePorta, cofre: cofrePorta, altar: altarPorta }

/** O visual desenha a moldura Porta de verdade (um modelo que não é a Porta de brasões, com moldura Porta). */
export function temMolduraPorta(visual: VisualDoPuzzle): boolean {
  return visual.tipo === 'modelo' && visual.modelo !== 'porta' && visual.moldura === 'porta'
}

/**
 * O SVG inteiro do modelo, na moldura dele. `prefixo` distingue os ids de
 * dois quadros na mesma página (gradientes e o recorte do vão). Cor e
 * inscrição passam pelo sanitizador aqui dentro: quem chama pode mandar o que
 * veio do arquivo ou da rede.
 */
export function svgDoModelo(arte: ArteDoModelo, prefixo: string): string {
  const padrao = PADROES_DOS_MODELOS[arte.modelo].cores
  const cores: CoresDoModelo = {
    parede: corSegura(arte.cores.parede, padrao.parede),
    chao: corSegura(arte.cores.chao, padrao.chao),
    objeto: corSegura(arte.cores.objeto, padrao.objeto),
  }
  const p = prefixoSeguro(prefixo)
  const desenho = (arte.moldura === 'porta' ? ARTE_PORTA[arte.modelo] : undefined) ?? ARTE_ORIGINAL[arte.modelo]
  return desenho(p, cores, arte.inscricao)
}
