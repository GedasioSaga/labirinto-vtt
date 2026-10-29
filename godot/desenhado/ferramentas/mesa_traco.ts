/**
 * A MESA DE PROVA DOS TRAÇOS (onda 5, CONTRATO.md seção 11.9). O Desenhado sai da conta de
 * referência (ferramentas/traco.ts) com as imagens que o Godot exportou; o Atual sai do
 * mesmo desenho de pixi/drawBarranco.ts (Meio-Termo). A geometria é a do app
 * (geosDoBarranco de client/src/lib/barranco.ts, do client da MAIN, só leitura).
 *
 * Uso, em duas vezes (a mesa do Godot, comum/mesa_traco.gd, faz as duas):
 *   node mesa_traco.mjs --plano=<paineis>/plano.json
 *       grava os chões que o Godot tem de pintar (a grama aprovada, origem e zoom);
 *   node mesa_traco.mjs --textura=<exportado/id> --exportado=<exportado/> --saida=<paineis> [--sem-atual]
 *       lê os chões e grava os painéis a 100% e os recortes a 300%, e paineis.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { geosDoBarranco, type GeoDoBarranco } from '@cliente/lib/barranco'
import type { AlturaDoBarranco, BarrancoDoMapa, QuadradoAlto, RiscoDeBarranco } from '@cliente/types/map'
import { MATERIAIS, type IdDoMaterial, type OpcaoDeMaterial } from '@cliente/texturas/meioTermo/materiais'
import { geometriaDaCerca } from '@cliente/lib/mobilia'
import { rgb } from '@cliente/texturas/ruido'
import { gravarPng, lerPng, type Imagem } from './png'
import { comporMovel, type Camada, type MovelCarregado, type ParamsDoMovel, type Rgb } from './movel'
import { carregarBorda, carregarFace, desfocar, imagemDe, pintarAtual, pintarDesenhado, telaDe, type Altura, type BordaCarregada, type FaceCarregada, type OpcoesDoTraco, type Tela } from './traco'

const CASA = 64
const MUNDO_CASAS = 40 // o chão de 100% que o Godot pinta: 40 x 40 casas a partir de (0, 0)
const UNIDADE_REF = (200 * 64) / 1242
const SOMBRA_COR = rgb('#0a1c28').map((v) => v / 255)

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '1' : a.slice(i + 1))
  }
  return m
}

// ---------- as cenas (casas do mundo; 64 px por casa a 100%) ----------

interface Cena {
  readonly nome: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** O barranco em casas, a partir de (x, y). */
  readonly riscos: readonly { id: string; pontos: readonly (readonly [number, number])[]; altura: AlturaDoBarranco }[]
  readonly quadrados: readonly { x: number; y: number; alturas: AlturaDoBarranco[] }[]
}

const COLUNAS = ['reta', 'curva', 'quina', 'S'] as const
const FILAS: readonly AlturaDoBarranco[] = ['baixo', 'medio', 'alto']

function linhaDe(f: (x: number) => number, x0: number, x1: number): [number, number][] {
  const out: [number, number][] = []
  for (let x = x0; x <= x1 + 1e-9; x += 0.25) out.push([x, f(x)])
  return out
}

function formaDa(coluna: (typeof COLUNAS)[number]): [number, number][] {
  if (coluna === 'reta') return linhaDe(() => 1.5, 0.7, 6.3)
  if (coluna === 'curva') return linhaDe((x) => 1.2 + 0.9 * Math.sin((Math.PI * (x - 0.7)) / 5.6), 0.7, 6.3)
  if (coluna === 'quina') {
    const a = linhaDe(() => 2.2, 0.7, 4.4)
    for (let y = 1.95; y >= 0.4 - 1e-9; y -= 0.25) a.push([4.4, y])
    return a
  }
  return linhaDe((x) => 1.6 + 0.75 * Math.sin((2 * Math.PI * (x - 0.7)) / 5.6), 0.7, 6.3)
}

function cenaDasFormas(): Cena {
  const riscos: Cena['riscos'][number][] = []
  FILAS.forEach((alt, r) => COLUNAS.forEach((col, c) => {
    riscos.push({ id: `${col}-${alt}`, altura: alt, pontos: formaDa(col).map(([x, y]) => [7 * c + x, 4 * r + y]) })
  }))
  return { nome: 'formas', x: 0, y: 0, w: 28, h: 12, riscos, quadrados: [] }
}

function cenaDoParedao(): Cena {
  const alto = linhaDe((x) => 1.4 + 0.22 * Math.sin(x / 3.1) + 0.12 * Math.sin(x / 1.3 + 1), 0.8, 39.2)
  const baixo = linhaDe((x) => 3.6 + 0.18 * Math.sin(x / 2.3 + 2), 0.8, 39.2)
  return { nome: 'paredao', x: 0, y: 12, w: 40, h: 5, riscos: [{ id: 'paredao-alto', altura: 'alto', pontos: alto }, { id: 'paredao-baixo', altura: 'baixo', pontos: baixo }], quadrados: [] }
}

/** O morro da família: um platô Médio com um alto no meio, e um barranco Baixo embaixo. */
function cenaDaFamilia(): Cena {
  const linhas: Record<number, [number, number]> = { 2: [3, 9], 3: [2, 10], 4: [2, 11], 5: [3, 11], 6: [4, 11] }
  const quadrados: Cena['quadrados'][number][] = []
  for (const [y, [x0, x1]] of Object.entries(linhas)) {
    for (let x = x0; x <= x1; x += 1) {
      const topo = (Number(y) === 3 && x >= 5 && x <= 7) || (Number(y) === 4 && x >= 5 && x <= 8)
      quadrados.push({ x, y: Number(y), alturas: topo ? ['medio', 'alto'] : ['medio'] })
    }
  }
  const banco = linhaDe((x) => 9.3 + 0.35 * Math.sin((x - 9.5) / 1.4), 9.6, 15.6)
  return { nome: 'familia', x: 0, y: 17, w: 16, h: 12, riscos: [{ id: 'familia-banco', altura: 'baixo', pontos: banco }], quadrados }
}

const CENAS: readonly Cena[] = [cenaDasFormas(), cenaDoParedao(), cenaDaFamilia()]

/** Os recortes a 300% (casas do mundo, 4 x 3). */
const PERTOS = [
  { nome: 'quina', cena: 'formas', x: 16.6, y: 9.3, w: 4, h: 3, titulo: 'a quina de 90 graus, Alto' },
  { nome: 's', cena: 'formas', x: 22.4, y: 4.7, w: 4, h: 3, titulo: 'o S, Médio' },
  { nome: 'familia', cena: 'familia', x: 4.4, y: 21.6, w: 4, h: 3, titulo: 'o platô da família, Médio e Alto' },
] as const

function barrancoDe(c: Cena, grid: number): BarrancoDoMapa {
  const riscos: RiscoDeBarranco[] = c.riscos.map((r) => ({ id: r.id, lado: 1, altura: r.altura, pontos: r.pontos.map(([x, y]) => ({ x: (c.x + x) * grid, y: (c.y + y) * grid })) }))
  const quadrados: QuadradoAlto[] = c.quadrados.map((q) => ({ x: q.x, y: q.y, alturas: q.alturas }))
  return { quadrado: grid, origem: { x: c.x * grid, y: c.y * grid }, riscos, quadrados, rampas: [] }
}

function alturaDaGeo(c: Cena): (g: GeoDoBarranco) => Altura {
  return (g) => {
    if (g.tipo === 'risco') return (c.riscos.find((r) => r.id === g.id)?.altura ?? 'medio') as Altura
    return g.nivel >= 2 ? 'alto' : 'medio'
  }
}

// ---------- a família: carimbos da onda 3 e móveis da onda 4 (as contas de 9.4 e 10) ----------

interface Niveis { readonly n: Camada[] }

function niveisDe(c: Camada): Niveis {
  const n = [c]
  let a = c
  while (a.w > 2 && a.h > 2) {
    const w = a.w >> 1
    const h = a.h >> 1
    const px = new Float32Array(w * h * 4)
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) for (let k = 0; k < 4; k += 1) {
      px[(y * w + x) * 4 + k] = (a.px[(2 * y * a.w + 2 * x) * 4 + k] + a.px[(2 * y * a.w + 2 * x + 1) * 4 + k] + a.px[((2 * y + 1) * a.w + 2 * x) * 4 + k] + a.px[((2 * y + 1) * a.w + 2 * x + 1) * 4 + k]) / 4
    }
    a = { w, h, px }
    n.push(a)
  }
  return { n }
}

type Matriz = readonly [number, number, number, number, number, number]

function inversa(m: Matriz): Matriz {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

/** A camada (pré-multiplicada, 0..255) na tela pela matriz; soAlfa soma a silhueta em "sombra". */
function porAfim(t: Tela, sombra: Float32Array, nv: Niveis, m: Matriz, soAlfa = false): void {
  const base = nv.n[0]
  const escala = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))
  const nivel = Math.min(nv.n.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, 1 / escala)))))
  const c = nv.n[nivel]
  const kx = c.w / base.w
  const ky = c.h / base.h
  const inv = inversa(m)
  const cantos = [[0, 0], [base.w, 0], [0, base.h], [base.w, base.h]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]])
  const X0 = Math.max(0, Math.floor(Math.min(...cantos.map((p) => p[0]))))
  const X1 = Math.min(t.w, Math.ceil(Math.max(...cantos.map((p) => p[0]))))
  const Y0 = Math.max(0, Math.floor(Math.min(...cantos.map((p) => p[1]))))
  const Y1 = Math.min(t.h, Math.ceil(Math.max(...cantos.map((p) => p[1]))))
  const s = [0, 0, 0, 0]
  for (let Y = Y0; Y < Y1; Y += 1) {
    for (let X = X0; X < X1; X += 1) {
      const u = (inv[0] * (X + 0.5) + inv[2] * (Y + 0.5) + inv[4]) * kx - 0.5
      const v = (inv[1] * (X + 0.5) + inv[3] * (Y + 0.5) + inv[5]) * ky - 0.5
      const iu = Math.floor(u)
      const iv = Math.floor(v)
      const tu = u - iu
      const tv = v - iv
      s[0] = s[1] = s[2] = s[3] = 0
      for (const [dx, dy, p] of [[0, 0, (1 - tu) * (1 - tv)], [1, 0, tu * (1 - tv)], [0, 1, (1 - tu) * tv], [1, 1, tu * tv]] as const) {
        const x = iu + dx
        const y = iv + dy
        if (x < 0 || y < 0 || x >= c.w || y >= c.h || p === 0) continue
        const o = (y * c.w + x) * 4
        for (let k = 0; k < 4; k += 1) s[k] += c.px[o + k] * p
      }
      const a = s[3] / 255
      if (a <= 0) continue
      const o = Y * t.w + X
      if (soAlfa) {
        sombra[o] = sombra[o] + a * (1 - sombra[o])
        continue
      }
      for (let k = 0; k < 3; k += 1) t.px[o * 3 + k] = s[k] / 255 + t.px[o * 3 + k] * (1 - a)
    }
  }
}

interface ArteDoCarimbo {
  readonly p: { sprite: { ladoPx: number; unidadePx: number; ancoraPx: [number, number] }; formas: { variacoes: number; espelho?: string }; sombra: { jeito: string; direcao: [number, number]; deslocamento?: number; comprimento?: number; borrao: number }; tamanhoDoApp: number }
  readonly sprites: Niveis[]
}

function carregarCarimbo(pasta: string): ArteDoCarimbo {
  const p = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8'))
  const sprites = (p.sprite.arquivos as string[]).map((a) => {
    const img = lerPng(join(pasta, a))
    const px = new Float32Array(img.w * img.h * 4)
    for (let i = 0; i < img.w * img.h; i += 1) {
      const al = img.px[i * 4 + 3] / 255
      for (let k = 0; k < 3; k += 1) px[i * 4 + k] = img.px[i * 4 + k] * al
      px[i * 4 + 3] = img.px[i * 4 + 3]
    }
    return niveisDe({ w: img.w, h: img.h, px })
  })
  return { p, sprites }
}

interface Carimbo { readonly id: string; readonly x: number; readonly y: number; readonly escolha: number; readonly giro: number }

function porCarimbo(t: Tela, sombra: Float32Array, a: ArteDoCarimbo, c: Carimbo, casa: number, ox: number, oy: number, passo: 'sombra' | 'corpo'): void {
  const sp = a.p.sprite
  const tamanho = Math.max(a.p.tamanhoDoApp * UNIDADE_REF, 0.8 * 64) * c.escolha * (casa / 64)
  const k = ((Math.round(c.giro / 45) % 8) + 8) % 8
  const n = a.p.formas.variacoes
  const espelho = (a.p.formas.espelho ?? 'diagonal') === 'diagonal' && Math.floor(k / n) % 2 === 1
  const arq = a.sprites[k % n]
  const s = tamanho / sp.unidadePx
  const X = c.x * casa - ox
  const Y = c.y * casa - oy
  const [ax, ay] = sp.ancoraPx
  const corpo: Matriz = espelho ? [0, s, s, 0, X - s * ax, Y - s * ay] : [s, 0, 0, s, X - s * ax, Y - s * ay]
  if (passo === 'corpo') return porAfim(t, sombra, arq, corpo)
  const sb = a.p.sombra
  if (sb.jeito === 'nenhuma') return
  const nd = Math.hypot(sb.direcao[0], sb.direcao[1])
  const dx = sb.direcao[0] / nd
  const dy = sb.direcao[1] / nd
  let m: Matriz
  if (sb.jeito === 'em-pe') {
    const l = sb.comprimento ?? 0.78
    const [aa, b, cc, d, e, f]: Matriz = espelho ? [0, s, s, 0, -s * ax, -s * ay] : [s, 0, 0, s, -s * ax, -s * ay]
    m = [aa - l * dx * b, -l * dy * b, cc - l * dx * d, -l * dy * d, X + e - l * dx * f, Y - l * dy * f]
  } else {
    const desl = (sb.deslocamento ?? 0) * tamanho
    m = [corpo[0], corpo[1], corpo[2], corpo[3], corpo[4] + dx * desl, corpo[5] + dy * desl]
  }
  const tmp = new Float32Array(t.w * t.h)
  porAfim(t, tmp, arq, m, true)
  const b = desfocar(tmp, t.w, t.h, sb.borrao * tamanho)
  for (let i = 0; i < t.w * t.h; i += 1) sombra[i] = sombra[i] + b[i] * (1 - sombra[i])
}

interface Movel { readonly tipo: string; readonly x: number; readonly y: number; readonly casas: readonly [number, number]; readonly giro: number; readonly opcoes: readonly OpcaoDeMaterial[]; readonly volta?: number }

function carregarMovel(pasta: string): MovelCarregado {
  const p = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as ParamsDoMovel
  const imagens = new Map<string, Imagem>()
  for (const f of p.formas) for (const nome of [f.valor, f.partes, f.cor]) if (nome !== undefined) imagens.set(nome, lerPng(join(pasta, nome)))
  return { p, imagens }
}

function tomDe(o: OpcaoDeMaterial, opcoes: readonly OpcaoDeMaterial[], lugares: readonly string[]): Rgb {
  if (o === 'mesma' || o === 'varas') {
    const im = lugares.indexOf('madeira')
    return rgb(MATERIAIS[(im >= 0 ? opcoes[im] : 'carvalho') as IdDoMaterial].tom)
  }
  return rgb(MATERIAIS[o].tom)
}

function porMovel(t: Tela, sombra: Float32Array, m: MovelCarregado, o: Movel, casa: number, ox: number, oy: number, passo: 'sombra' | 'corpo'): void {
  const tons = m.p.lugares.map((_l, i) => tomDe(o.opcoes[i], o.opcoes, m.p.lugares))
  let cerca
  if (m.p.pecas !== undefined && o.tipo === 'cerca') {
    const g = geometriaDaCerca(o.casas[0] * CASA, o.casas[1] * CASA, o.volta ?? 0)
    if (g !== null) cerca = { mouroes: g.mouroes.map((q) => ({ x: q.x / CASA, y: q.y / CASA })), raio: g.raio / CASA, arco: g.arco === null ? null : { center: { x: g.arco.center.x / CASA, y: g.arco.center.y / CASA }, radius: g.arco.radius / CASA, startAngle: g.arco.startAngle, sweep: g.arco.sweep } }
  }
  const comp = comporMovel(m, { vista: 'frente', opcoes: o.opcoes, tons, casasW: o.casas[0], casasH: o.casas[1], giro: o.giro, ...(cerca !== undefined ? { cerca } : {}) }, casa)
  const r = (comp.resto * Math.PI) / 180
  const co = Math.cos(r)
  const si = Math.sin(r)
  const X = o.x * casa - ox
  const Y = o.y * casa - oy
  const mat: Matriz = [co, si, -si, co, X - (co * comp.cx - si * comp.cy), Y - (si * comp.cx + co * comp.cy)]
  if (passo === 'sombra') {
    if (comp.sombra === null) return
    const s = comp.sombra
    const alfa = m.p.sombra.alfa
    const c: Camada = { w: comp.corpo.w, h: comp.corpo.h, px: new Float32Array(comp.corpo.w * comp.corpo.h * 4).map((_v, i) => (i % 4 === 3 ? (s[i >> 2] / alfa) * 255 : 0)) }
    return porAfim(t, sombra, { n: [c] }, mat, true)
  }
  porAfim(t, sombra, { n: [comp.corpo] }, mat)
}

const CARIMBOS_DA_FAMILIA: readonly Carimbo[] = [
  { id: 'arvore', x: 4.4, y: 20.9, escolha: 1, giro: 0 },
  { id: 'arvore', x: 10.3, y: 21.6, escolha: 1.1, giro: 90 },
  { id: 'arvore-redonda', x: 13.4, y: 19.6, escolha: 1, giro: 45 },
  { id: 'arvore-redonda', x: 1.6, y: 26.6, escolha: 0.9, giro: 180 },
  { id: 'arbusto', x: 2.6, y: 21.4, escolha: 1, giro: 0 },
  { id: 'arbusto', x: 9.6, y: 24.7, escolha: 1.1, giro: 135 },
  { id: 'pedras', x: 6.3, y: 24.6, escolha: 1, giro: 0 },
  { id: 'pedras', x: 12.2, y: 27.1, escolha: 0.8, giro: 90 },
  { id: 'tronco-caido', x: 7.0, y: 27.4, escolha: 1, giro: 0 },
]
const MOVEIS_DA_FAMILIA: readonly Movel[] = [
  { tipo: 'cerca', x: 3.6, y: 25.9, casas: [4, 0.25], giro: 0, opcoes: ['carvalho', 'varas'] },
  { tipo: 'poco', x: 10.2, y: 22.8, casas: [1.5, 1.5], giro: 0, opcoes: ['granito', 'carvalho'] },
]

function pintarFamilia(t: Tela, exportado: string, casa: number, ox: number, oy: number, avisos: string[]): void {
  const arte = new Map<string, ArteDoCarimbo>()
  for (const id of ['arvore', 'arvore-redonda', 'arbusto', 'pedras', 'tronco-caido']) {
    if (existsSync(join(exportado, id, 'textura.json'))) arte.set(id, carregarCarimbo(join(exportado, id)))
    else avisos.push(`sem o carimbo ${id} exportado`)
  }
  const moveis = new Map<string, MovelCarregado>()
  for (const [tipo, pasta] of [['cerca', 'movel-cerca'], ['poco', 'movel-poco']] as const) {
    try {
      if (existsSync(join(exportado, pasta, 'textura.json'))) moveis.set(tipo, carregarMovel(join(exportado, pasta)))
    } catch (e) {
      avisos.push(`${pasta} não carregou: ${String(e)}`)
    }
  }
  const sombra = new Float32Array(t.w * t.h)
  for (const c of CARIMBOS_DA_FAMILIA) { const a = arte.get(c.id); if (a !== undefined) porCarimbo(t, sombra, a, c, casa, ox, oy, 'sombra') }
  for (const o of MOVEIS_DA_FAMILIA) { const m = moveis.get(o.tipo); if (m !== undefined) porMovel(t, sombra, m, o, casa, ox, oy, 'sombra') }
  for (let i = 0; i < t.w * t.h; i += 1) {
    const s = sombra[i] * 0.25
    if (s > 0) for (let k = 0; k < 3; k += 1) t.px[i * 3 + k] = t.px[i * 3 + k] * (1 - s) + SOMBRA_COR[k] * s
  }
  const todos = [
    ...CARIMBOS_DA_FAMILIA.map((c) => ({ y: c.y, pintar: () => { const a = arte.get(c.id); if (a !== undefined) porCarimbo(t, sombra, a, c, casa, ox, oy, 'corpo') } })),
    ...MOVEIS_DA_FAMILIA.map((o) => ({ y: o.y + o.casas[1] / 2, pintar: () => { const m = moveis.get(o.tipo); if (m !== undefined) porMovel(t, sombra, m, o, casa, ox, oy, 'corpo') } })),
  ]
  todos.sort((a, b) => a.y - b.y).forEach((q) => q.pintar())
}

// ---------- principal ----------

function recortarChao(chao: Imagem, x0: number, y0: number, w: number, h: number): Imagem {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const o = ((y0 + y) * chao.w + (x0 + x)) * 4
    for (let k = 0; k < 4; k += 1) px[(y * w + x) * 4 + k] = chao.px[o + k]
  }
  return { w, h, px }
}

function principal(): void {
  const args = argumentos()
  const plano = args.get('plano')
  if (plano !== undefined) {
    const chaos = [{ nome: 'chao-100', origem: [0, 0], zoom: 1, lado: MUNDO_CASAS * CASA }, ...PERTOS.map((p) => ({ nome: `chao-300-${p.nome}`, origem: [p.x * CASA, p.y * CASA], zoom: 3, lado: p.w * CASA * 3 }))]
    writeFileSync(plano, JSON.stringify({ chaos }, null, 2))
    return
  }
  const pasta = args.get('textura')
  const exportado = args.get('exportado')
  const saida = args.get('saida')
  if (pasta === undefined || exportado === undefined || saida === undefined) {
    console.error('uso: --plano=<arquivo> | --textura=<exportado/id> --exportado=<exportado/> --saida=<paineis> [--sem-atual]')
    process.exit(2)
  }
  mkdirSync(saida, { recursive: true })
  const avisos: string[] = []
  const tipo = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as { id: string; parte: string; borda: string | null }
  // A face e a borda andam juntas: a folha da face pega a borda dela; a da borda pega o penhasco.
  const idFace = tipo.parte === 'face' ? tipo.id : 'penhasco'
  const pastaFace = tipo.parte === 'face' ? pasta : join(exportado, 'penhasco')
  if (!existsSync(join(pastaFace, 'textura.json'))) throw new Error(`a borda precisa de uma face exportada (${pastaFace})`)
  const face: FaceCarregada = carregarFace(pastaFace)
  const idBorda = tipo.parte === 'borda' ? tipo.id : face.p.borda
  let borda: BordaCarregada | null = null
  if (idBorda !== null) {
    const pb = tipo.parte === 'borda' ? pasta : join(exportado, idBorda)
    if (existsSync(join(pb, 'textura.json'))) borda = carregarBorda(pb)
    else avisos.push(`a borda ${idBorda} ainda não foi exportada: a face sai sem ela`)
  }
  const chao100 = lerPng(join(saida, 'chao-100.png'))
  const lados = args.has('sem-atual') ? (['desenhado'] as const) : (['desenhado', 'atual'] as const)
  const montarCena = (c: Cena, lado: 'desenhado' | 'atual', grid: number, x0: number, y0: number, w: number, h: number, chao: Imagem): Imagem => {
    const t = telaDe(chao)
    const geos = geosDoBarranco(barrancoDe(c, grid), 0, grid)
    const o: OpcoesDoTraco = { alturaDe: alturaDaGeo(c), bordaDe: () => 'grama', grid, ox: x0 * grid, oy: y0 * grid }
    if (lado === 'desenhado') pintarDesenhado(t, geos, face, borda, o)
    else pintarAtual(t, geos, o)
    if (c.nome === 'familia') pintarFamilia(t, exportado, grid, x0 * grid, y0 * grid, avisos)
    void w
    void h
    return imagemDe(t)
  }
  const tempos: Record<string, number> = {}
  for (const c of CENAS) {
    for (const lado of lados) {
      const t0 = Date.now()
      const chao = recortarChao(chao100, c.x * CASA, c.y * CASA, c.w * CASA, c.h * CASA)
      gravarPng(join(saida, `${c.nome}-${lado}-100.png`), montarCena(c, lado, CASA, c.x, c.y, c.w, c.h, chao), true)
      tempos[`${c.nome}-${lado}`] = Date.now() - t0
    }
  }
  for (const p of PERTOS) {
    const c = CENAS.find((q) => q.nome === p.cena)
    if (c === undefined) continue
    const chao300 = lerPng(join(saida, `chao-300-${p.nome}.png`))
    const chao = recortarChao(chao300, 0, 0, p.w * CASA * 3, p.h * CASA * 3)
    for (const lado of lados) gravarPng(join(saida, `perto-${p.nome}-${lado}-300.png`), montarCena(c, lado, CASA * 3, p.x, p.y, p.w, p.h, chao), true)
  }
  const seq = face.p.face.modulos.map((m) => m.casas)
  writeFileSync(join(saida, 'paineis.json'), JSON.stringify({ face: idFace, borda: idBorda, bordaExportada: borda !== null, atual: lados.length > 1, modulosCasas: seq, pertos: PERTOS, cenas: CENAS.map((c) => ({ nome: c.nome, w: c.w, h: c.h })), avisos, tempos }, null, 2))
  console.log(`mesa dos traços: ${CENAS.length} cenas e ${PERTOS.length} recortes, ${avisos.length} aviso(s)`)
}

principal()
