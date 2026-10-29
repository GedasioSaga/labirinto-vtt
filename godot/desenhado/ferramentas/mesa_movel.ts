/**
 * A MESA DE PROVA DOS MÓVEIS DESENHADOS (onda 4, CONTRATO.md seção 10). O Desenhado sai
 * da conta de referência (ferramentas/movel.ts) com as imagens que o Godot exportou; o
 * Atual sai do motor dos móveis do client da MAIN (montarCena + pintarCena, só leitura,
 * empacotado por ferramentas/construir.mjs). Grava os painéis a 100% (64 px por casa) e a
 * 300% (192 px por casa); a mesa do Godot (comum/mesa_movel.gd) arruma a folha e reduz
 * para 50% e 25%.
 *
 * Uso: node ferramentas/.build/mesa_movel.mjs --textura=<exportado/movel-x> --exportado=<exportado/>
 *        --saida=<paineis> [--sem-atual]
 * Lê em <paineis>: chao-familia-100.png e chao-familia-300.png (a grama aprovada, que o
 * Godot pinta antes). A cena de família usa todos os exportado/movel-* que existirem e os
 * carimbos da onda 3 (arvore, arvore-redonda, arbusto, pedras, tronco-caido).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { escalaDoNivel, montarCena, type DesenhoDoMovel, type TipoComTextura } from '@cliente/texturas/meioTermo/moveis'
import { pintarCena } from '@cliente/texturas/meioTermo/moveis/motor'
import { LUGARES_DE_MATERIAL, MATERIAIS, type IdDoMaterial, type OpcaoDeMaterial } from '@cliente/texturas/meioTermo/materiais'
import { rgb } from '@cliente/texturas/ruido'
import { gravarPng, lerPng, type Imagem } from './png'
import { comporMovel, desfocar, oklab, type Camada, type MovelCarregado, type ParamsDoMovel, type Rgb, type Vista } from './movel'

const G = 56
/** O chão padrão das salas do app (contexto.ts, L_DO_CHAO_PADRAO 0,615). */
const CHAO: Rgb = rgb('#a8776a')
const CASA_100 = 64
const CASA_300 = 192
/** O mapa de referência dos carimbos (CONTRATO 9): 200 x 200 casas. */
const UNIDADE_REF = (200 * 64) / 1242
const SOMBRA_COR: Rgb = rgb('#0a1c28')

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '1' : a.slice(i + 1))
  }
  return m
}

// ---------- carregar ----------

function carregarMovel(pasta: string): MovelCarregado {
  const p = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as ParamsDoMovel
  const imagens = new Map<string, Imagem>()
  for (const f of p.formas) {
    for (const nome of [f.valor, f.partes, f.cor]) if (nome !== undefined) imagens.set(nome, lerPng(join(pasta, nome)))
  }
  const doApp = LUGARES_DE_MATERIAL[p.idDoApp as TipoComTextura]
  if (doApp === undefined) throw new Error(`${p.id}: idDoApp "${p.idDoApp}" não é um tipo de móvel do app`)
  const ids = doApp.map((l) => l.id)
  if (ids.join(',') !== p.lugares.join(',')) throw new Error(`${p.id}: "lugares" tem de ser ${JSON.stringify(ids)} (LUGARES_DE_MATERIAL do app), é ${JSON.stringify(p.lugares)}`)
  return { p, imagens }
}

// ---------- a tela (RGBA pré-multiplicado, 0..255) ----------

interface Tela {
  readonly w: number
  readonly h: number
  readonly px: Float32Array
  /** A sombra acumulada (cobertura 0..1) que ainda não foi pintada. */
  readonly sombra: Float32Array
}

function novaTela(w: number, h: number, chao: Imagem | Rgb): Tela {
  const px = new Float32Array(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    if (Array.isArray(chao)) {
      for (let k = 0; k < 3; k += 1) px[i * 4 + k] = (chao as Rgb)[k]
    } else {
      const img = chao as Imagem
      const x = Math.min(img.w - 1, i % w)
      const y = Math.min(img.h - 1, Math.floor(i / w))
      for (let k = 0; k < 3; k += 1) px[i * 4 + k] = img.px[(y * img.w + x) * 4 + k]
    }
    px[i * 4 + 3] = 255
  }
  return { w, h, px, sombra: new Float32Array(w * h) }
}

function emImagem(t: Tela): Imagem {
  const px = new Uint8ClampedArray(t.w * t.h * 4)
  for (let i = 0; i < t.w * t.h; i += 1) {
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = Math.round(t.px[i * 4 + k])
    px[i * 4 + 3] = 255
  }
  return { w: t.w, h: t.h, px }
}

/** Pinta a sombra acumulada (uma camada só, com o alfa já dentro) e zera. */
function pintarSombra(t: Tela, alfa: number): void {
  for (let i = 0; i < t.w * t.h; i += 1) {
    const s = t.sombra[i] * alfa
    if (s <= 0) continue
    for (let k = 0; k < 3; k += 1) t.px[i * 4 + k] = t.px[i * 4 + k] * (1 - s) + SOMBRA_COR[k] * s
    t.sombra[i] = 0
  }
}

/** Matriz do Canvas [a, b, c, d, e, f]: (x, y) da imagem -> (a x + c y + e, b x + d y + f). */
type Matriz = readonly [number, number, number, number, number, number]

function inversa(m: Matriz): Matriz {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

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

/**
 * Põe a camada (pré-multiplicada) na tela pela matriz, bilinear no nível do mipmap que a
 * escala pede. soAlfa: só soma a cobertura na sombra da tela (a silhueta).
 */
function porAfim(t: Tela, nv: Niveis, m: Matriz, soAlfa = false, cobertura = 1): void {
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
      for (let k = 0; k < 4; k += 1) s[k] = 0
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
        t.sombra[o] = t.sombra[o] + a * cobertura * (1 - t.sombra[o])
        continue
      }
      for (let k = 0; k < 3; k += 1) t.px[o * 4 + k] = s[k] + t.px[o * 4 + k] * (1 - a)
    }
  }
}

// ---------- o Atual (o motor de hoje) ----------

interface Objeto {
  readonly tipo: TipoComTextura
  readonly x: number
  readonly y: number
  readonly casas: readonly [number, number]
  readonly giro: number
  readonly opcoes: readonly OpcaoDeMaterial[]
  readonly vista: Vista
}

function camadaDoAtual(o: Objeto, nivel: number, semente: number): { c: Camada; cx: number; cy: number; pxPorCasa: number } {
  const d: DesenhoDoMovel = { tipo: o.tipo, lado: o.vista, materiais: o.opcoes, casasW: o.casas[0], casasH: o.casas[1], semente }
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarCena(montarCena(d), S)
  const px = new Float32Array(limites.W * limites.H * 4)
  for (let i = 0; i < limites.W * limites.H; i += 1) {
    const a = pixels[i * 4 + 3] / 255
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = pixels[i * 4 + k] * a
    px[i * 4 + 3] = pixels[i * 4 + 3]
  }
  return { c: { w: limites.W, h: limites.H, px }, cx: -limites.x0 * S, cy: -limites.y0 * S, pxPorCasa: S * G }
}

/** A matriz que põe o meio (cx, cy) da camada em (X, Y) da tela, escalada e girada (graus). */
function matrizDoMeio(cx: number, cy: number, X: number, Y: number, f: number, giro: number): Matriz {
  const r = (giro * Math.PI) / 180
  const co = Math.cos(r) * f
  const si = Math.sin(r) * f
  return [co, si, -si, co, X - (co * cx - si * cy), Y - (si * cx + co * cy)]
}

// ---------- o Desenhado ----------

function tomDaOpcao(opcoes: readonly OpcaoDeMaterial[], i: number, lugares: readonly string[]): Rgb {
  const o = opcoes[i]
  if (o === 'mesma' || o === 'varas') {
    const im = lugares.indexOf('madeira')
    const mad = im >= 0 ? (opcoes[im] as IdDoMaterial) : 'carvalho'
    return rgb(MATERIAIS[mad].tom)
  }
  return rgb(MATERIAIS[o].tom)
}

type Lado = 'desenhado' | 'atual'

function porObjeto(t: Tela, lado: Lado, moveis: ReadonlyMap<string, MovelCarregado>, o: Objeto, casa: number, ox: number, oy: number, semente: number, passo: 'sombra' | 'corpo'): void {
  const X = (o.x - ox) * casa
  const Y = (o.y - oy) * casa
  const m = moveis.get(o.tipo)
  if (lado === 'desenhado' && m !== undefined) {
    const tons = m.p.lugares.map((_l, i) => tomDaOpcao(o.opcoes, i, m.p.lugares))
    const comp = comporMovel(m, { vista: o.vista, opcoes: o.opcoes, tons, casasW: o.casas[0], casasH: o.casas[1], giro: o.giro }, casa)
    const mat = matrizDoMeio(comp.cx, comp.cy, X, Y, 1, comp.resto)
    if (passo === 'sombra') {
      if (comp.sombra === null) return
      const s = comp.sombra
      const alfa = m.p.sombra.alfa
      const c: Camada = { w: comp.corpo.w, h: comp.corpo.h, px: new Float32Array(comp.corpo.w * comp.corpo.h * 4).map((_v, i) => (i % 4 === 3 ? (s[i >> 2] / alfa) * 255 : 0)) }
      porAfim(t, { n: [c] }, mat, true)
    } else porAfim(t, { n: [comp.corpo] }, mat)
    return
  }
  // O Atual: a imagem do motor já traz a sombra; a tela gira a imagem inteira.
  if (passo === 'sombra') return
  const nivel = casa > 100 ? 3 : 1
  const a = camadaDoAtual(o, nivel, semente)
  porAfim(t, niveisDe(a.c), matrizDoMeio(a.cx, a.cy, X, Y, casa / a.pxPorCasa, o.giro))
}

function montar(objetos: readonly Objeto[], lado: Lado, moveis: ReadonlyMap<string, MovelCarregado>, casasW: number, casasH: number, casa: number, chao: Imagem | Rgb = CHAO, ox = 0, oy = 0, carimbos: readonly Carimbo[] = [], arte: ReadonlyMap<string, ArteDoCarimbo> = new Map()): Imagem {
  const t = novaTela(Math.round(casasW * casa), Math.round(casasH * casa), chao)
  const ordem = [...objetos].sort((a, b) => a.y + a.casas[1] / 2 - (b.y + b.casas[1] / 2))
  // A sombra de tudo numa camada só (como os carimbos, CONTRATO 9.4), depois os corpos.
  const cs = [...carimbos].sort((a, b) => a.y - b.y)
  for (const c of cs) porCarimbo(t, arte, c, casa, ox, oy, 'sombra')
  ordem.forEach((o, i) => porObjeto(t, lado, moveis, o, casa, ox, oy, 101 + 17 * i, 'sombra'))
  pintarSombra(t, 0.25)
  const todos: { y: number; pintar: () => void }[] = [
    ...cs.map((c) => ({ y: c.y, pintar: () => porCarimbo(t, arte, c, casa, ox, oy, 'corpo') })),
    ...ordem.map((o, i) => ({ y: o.y + o.casas[1] / 2, pintar: () => porObjeto(t, lado, moveis, o, casa, ox, oy, 101 + 17 * i, 'corpo') })),
  ]
  todos.sort((a, b) => a.y - b.y).forEach((q) => q.pintar())
  return emImagem(t)
}

// ---------- os carimbos da onda 3 (a cena de família; CONTRATO 9.4) ----------

interface ArteDoCarimbo {
  readonly p: { sprite: { ladoPx: number; unidadePx: number; ancoraPx: [number, number] }; formas: { variacoes: number; espelho?: string }; sombra: { jeito: string; direcao: [number, number]; deslocamento?: number; comprimento?: number; borrao: number }; tamanhoDoApp: number }
  readonly sprites: Niveis[]
}

interface Carimbo { readonly id: string; readonly x: number; readonly y: number; readonly escolha: number; readonly giro: number }

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

function porCarimbo(t: Tela, arte: ReadonlyMap<string, ArteDoCarimbo>, c: Carimbo, casa: number, ox: number, oy: number, passo: 'sombra' | 'corpo'): void {
  const a = arte.get(c.id)
  if (a === undefined) return
  const sp = a.p.sprite
  const zoom = casa / 64
  const tamanho = Math.max(a.p.tamanhoDoApp * UNIDADE_REF, 0.8 * 64) * c.escolha * zoom
  const k = ((Math.round(c.giro / 45) % 8) + 8) % 8
  const n = a.p.formas.variacoes
  const espelho = (a.p.formas.espelho ?? 'diagonal') === 'diagonal' && Math.floor(k / n) % 2 === 1
  const arq = a.sprites[k % n]
  const s = tamanho / sp.unidadePx
  const X = (c.x - ox) * casa
  const Y = (c.y - oy) * casa
  const [ax, ay] = sp.ancoraPx
  const corpo: Matriz = espelho ? [0, s, s, 0, X - s * ax, Y - s * ay] : [s, 0, 0, s, X - s * ax, Y - s * ay]
  if (passo === 'corpo') {
    porAfim(t, arq, corpo)
    return
  }
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
  // A silhueta desfocada borrao x tamanho, somada na camada da sombra.
  const tmp = novaTela(t.w, t.h, [0, 0, 0])
  porAfim(tmp, arq, m, true)
  const borrada = desfocar(tmp.sombra, t.w, t.h, sb.borrao * tamanho)
  for (let i = 0; i < t.w * t.h; i += 1) t.sombra[i] = t.sombra[i] + borrada[i] * (1 - t.sombra[i])
}

// ---------- as medidas ----------

interface Medida { readonly L: number; readonly a: number; readonly b: number; readonly dpL: number }

/** A cor média OKLab do miolo (50% x 30% da pegada) do móvel sozinho a 300%. */
function medir(img: Imagem, casasW: number, casasH: number, mx: number, my: number): Medida {
  let n = 0
  let sL = 0
  let sa = 0
  let sb = 0
  let sLL = 0
  const cx = img.w / 2
  const cy = img.h / 2
  for (let y = Math.round(cy - casasH * my * CASA_300); y < cy + casasH * my * CASA_300; y += 1) {
    for (let x = Math.round(cx - casasW * mx * CASA_300); x < cx + casasW * mx * CASA_300; x += 1) {
      const o = (y * img.w + x) * 4
      const [L, a, b] = oklab([img.px[o], img.px[o + 1], img.px[o + 2]])
      n += 1
      sL += L
      sa += a
      sb += b
      sLL += L * L
    }
  }
  const L = sL / n
  return { L, a: sa / n, b: sb / n, dpL: Math.sqrt(Math.max(0, sLL / n - L * L)) }
}

function menorDistancia(ms: readonly { id: string; m: Medida }[]): { valor: number; par: string } {
  let melhor = { valor: Infinity, par: '' }
  for (let i = 0; i < ms.length; i += 1) for (let j = i + 1; j < ms.length; j += 1) {
    const d = Math.hypot(ms[i].m.L - ms[j].m.L, ms[i].m.a - ms[j].m.a, ms[i].m.b - ms[j].m.b)
    if (d < melhor.valor) melhor = { valor: d, par: `${ms[i].id} x ${ms[j].id}` }
  }
  return melhor
}

// ---------- principal ----------

function opcoesDoCombo(tipo: TipoComTextura, c: number): OpcaoDeMaterial[] {
  return LUGARES_DE_MATERIAL[tipo].map((l) => l.opcoes[(l.opcoes.indexOf(l.padrao) + c) % l.opcoes.length])
}

function opcoesDoTom(tipo: TipoComTextura, madeira: IdDoMaterial): OpcaoDeMaterial[] {
  return LUGARES_DE_MATERIAL[tipo].map((l, i) => (i === 0 && l.opcoes.includes(madeira) ? madeira : l.opcoes.includes('mesma') ? 'mesma' : l.padrao))
}

function nomeDasOpcoes(o: readonly OpcaoDeMaterial[]): string {
  return o.map((x) => (x === 'mesma' ? 'assento de madeira' : x === 'varas' ? 'varas' : MATERIAIS[x].nome)).join(' + ')
}

function principal(): void {
  const args = argumentos()
  const pasta = args.get('textura')
  const exportado = args.get('exportado')
  const saida = args.get('saida')
  if (pasta === undefined || saida === undefined || exportado === undefined) {
    console.error('uso: --textura=<exportado/movel-x> --exportado=<exportado/> --saida=<pasta> [--sem-atual]')
    process.exit(2)
  }
  mkdirSync(saida, { recursive: true })
  const este = carregarMovel(pasta)
  const tipo = este.p.idDoApp as TipoComTextura
  const moveis = new Map<string, MovelCarregado>()
  for (const nome of readdirSync(exportado)) {
    if (!nome.startsWith('movel-') || !existsSync(join(exportado, nome, 'textura.json'))) continue
    const m = nome === este.p.id ? este : carregarMovel(join(exportado, nome))
    moveis.set(m.p.idDoApp, m)
  }
  moveis.set(tipo, este)
  const lados: Lado[] = args.has('sem-atual') ? ['desenhado'] : ['desenhado', 'atual']
  const frente = este.p.vistas.frente
  if (frente === undefined) throw new Error('sem a vista frente')
  const [cw, ch] = frente.casas
  const cel = [Math.max(1.5, cw + 1), Math.max(1.5, ch + 1)]
  const ob = (x: number, y: number, o: Partial<Objeto> = {}): Objeto => ({ tipo, x, y, casas: [cw, ch], giro: 0, opcoes: opcoesDoCombo(tipo, 0), vista: 'frente', ...o })
  const combos = [0, 1, 2].map((c) => opcoesDoCombo(tipo, c))
  const madeiras = (['carvalho', 'nogueira', 'pinho', 'cerejeira', 'velha'] as IdDoMaterial[])
  const temMadeira = LUGARES_DE_MATERIAL[tipo][0]?.opcoes.includes('carvalho') ?? false
  const medidas: Record<Lado, { id: string; m: Medida }[]> = { desenhado: [], atual: [] }
  for (const lado of lados) {
    // Os 3 combos lado a lado a 100% e o primeiro sozinho a 300%.
    const objs = combos.map((o, i) => ob(cel[0] * (i + 0.5), cel[1] / 2, { opcoes: o }))
    gravarPng(join(saida, `combos-${lado}-100.png`), montar(objs, lado, moveis, cel[0] * 3, cel[1], CASA_100), true)
    gravarPng(join(saida, `sozinho-${lado}-300.png`), montar([ob(cel[0] / 2, cel[1] / 2)], lado, moveis, cel[0], cel[1], CASA_300), true)
    // Os 5 tons de madeira (o resto padrão, o assento de madeira).
    if (temMadeira) {
      const ts = madeiras.map((md, i) => ob(cel[0] * (i + 0.5), cel[1] / 2, { opcoes: opcoesDoTom(tipo, md) }))
      gravarPng(join(saida, `tons-${lado}.png`), montar(ts, lado, moveis, cel[0] * 5, cel[1], CASA_100), true)
      for (const md of madeiras) {
        const img = montar([ob(cel[0] / 2, cel[1] / 2, { opcoes: opcoesDoTom(tipo, md) })], lado, moveis, cel[0], cel[1], CASA_300)
        medidas[lado].push({ id: md, m: medir(img, cw, ch, 0.25, 0.15) })
      }
    }
    // As 4 viradas (e as da vista de lado, se houver).
    const giros = [0, 90, 180, 270]
    const lado2 = este.p.vistas.lado
    const linhas: Objeto[] = []
    const q = Math.max(cel[0], cel[1])
    giros.forEach((g, i) => linhas.push(ob(q * (i + 0.5), q / 2, { giro: g })))
    if (lado2 !== undefined) giros.forEach((g, i) => linhas.push(ob(q * (i + 0.5), q * 1.5, { giro: g, vista: 'lado', casas: lado2.casas })))
    gravarPng(join(saida, `viradas-${lado}.png`), montar(linhas, lado, moveis, q * 4, q * (lado2 !== undefined ? 2 : 1), CASA_100), true)
    // Esticada: 4 comprimentos e a de 1 x 2 sem giro (o lado maior).
    if (frente.esticar !== undefined) {
      const comps = [1.4, 2, 3, 5]
      let x = 0.6
      const es: Objeto[] = []
      for (const L of comps) {
        es.push(ob(x + L / 2, 1, { casas: [L, ch] }))
        x += L + 0.6
      }
      es.push(ob(x + ch / 2, 1.5, { casas: [ch, 2] }))
      gravarPng(join(saida, `esticada-${lado}.png`), montar(es, lado, moveis, x + ch + 0.6, 3, CASA_100), true)
    }
  }
  // A cena de família: a mesa com as cadeiras e os barris numa clareira da grama aprovada,
  // com árvores, arbustos, pedras e um tronco caído da onda 3 (os Desenhados exportados).
  const raizExp = exportado
  const arte = new Map<string, ArteDoCarimbo>()
  for (const id of ['arvore', 'arvore-redonda', 'arbusto', 'pedras', 'tronco-caido']) if (existsSync(join(raizExp, id, 'textura.json'))) arte.set(id, carregarCarimbo(join(raizExp, id)))
  const familiaObjs: Objeto[] = [
    { tipo: 'mesa', x: 6, y: 6.3, casas: [2, 1], giro: 0, opcoes: ['carvalho'], vista: 'frente' },
    { tipo: 'cadeira', x: 5.5, y: 5.45, casas: [0.5, 0.5], giro: 0, opcoes: ['carvalho', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 6.5, y: 5.45, casas: [0.5, 0.5], giro: 0, opcoes: ['carvalho', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 5.5, y: 7.15, casas: [0.5, 0.5], giro: 180, opcoes: ['carvalho', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 6.5, y: 7.15, casas: [0.5, 0.5], giro: 180, opcoes: ['carvalho', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 4.55, y: 6.3, casas: [0.5, 0.5], giro: 270, opcoes: ['nogueira', 'mesma'], vista: 'frente' },
    { tipo: 'barril', x: 8.25, y: 5.6, casas: [0.7, 0.7], giro: 0, opcoes: ['carvalho', 'ferro'], vista: 'frente' },
    { tipo: 'barril', x: 8.95, y: 6.25, casas: [0.7, 0.7], giro: 0, opcoes: ['nogueira', 'latao'], vista: 'frente' },
    { tipo: 'barril', x: 8.2, y: 7.0, casas: [0.7, 0.7], giro: 0, opcoes: ['pinho', 'ferro'], vista: 'frente' },
  ]
  const carimbos: Carimbo[] = [
    { id: 'arvore', x: 2.3, y: 3.6, escolha: 1, giro: 0 }, { id: 'arvore', x: 10.2, y: 3.0, escolha: 1.1, giro: 90 },
    { id: 'arvore-redonda', x: 2.4, y: 10.6, escolha: 1, giro: 45 }, { id: 'arvore-redonda', x: 10.6, y: 10.9, escolha: 0.9, giro: 180 },
    { id: 'arbusto', x: 4.1, y: 2.4, escolha: 1, giro: 0 }, { id: 'arbusto', x: 9.6, y: 9.0, escolha: 1.2, giro: 135 }, { id: 'arbusto', x: 1.2, y: 6.8, escolha: 0.9, giro: 270 },
    { id: 'pedras', x: 10.6, y: 7.4, escolha: 1, giro: 0 }, { id: 'pedras', x: 3.2, y: 8.3, escolha: 0.7, giro: 90 },
    { id: 'tronco-caido', x: 6.3, y: 10.0, escolha: 1, giro: 0 },
  ]
  const chao100 = join(saida, 'chao-familia-100.png')
  const chao300 = join(saida, 'chao-familia-300.png')
  const FAMILIA = 12
  const PERTO = { x0: 4.0, y0: 4.3, casas: 4 }
  if (existsSync(chao100) && existsSync(chao300)) {
    const g100 = lerPng(chao100)
    const g300 = lerPng(chao300)
    for (const lado of lados) {
      gravarPng(join(saida, `familia-${lado}-100.png`), montar(familiaObjs, lado, moveis, FAMILIA, FAMILIA, CASA_100, g100, 0, 0, carimbos, arte), true)
      gravarPng(join(saida, `familia-${lado}-300.png`), montar(familiaObjs, lado, moveis, PERTO.casas, PERTO.casas, CASA_300, g300, PERTO.x0, PERTO.y0, carimbos, arte), true)
    }
  }
  const md = { desenhado: menorDistancia(medidas.desenhado), atual: lados.includes('atual') ? menorDistancia(medidas.atual) : null }
  const paineis = {
    id: este.p.id,
    tipo,
    chao: '#a8776a',
    celula: cel,
    combos: combos.map((o) => nomeDasOpcoes(o)),
    tons: temMadeira ? madeiras.map((id) => ({ id, nome: MATERIAIS[id].nome, tom: MATERIAIS[id].tom })) : [],
    medidas: { onde: 'o miolo (50% x 30% da pegada) do móvel sozinho a 300%', porTom: madeiras.map((id, i) => ({ id, nome: MATERIAIS[id].nome, desenhado: medidas.desenhado[i]?.m, atual: medidas.atual[i]?.m })), menorDistancia: md },
    lado: este.p.vistas.lado !== undefined,
    esticar: frente.esticar !== undefined,
    familia: { casas: FAMILIA, perto: PERTO, moveis: [...moveis.keys()], carimbos: [...arte.keys()], desenhados: familiaObjs.filter((o) => moveis.has(o.tipo)).length, total: familiaObjs.length },
    atual: lados.includes('atual'),
    formas: este.p.formas.map((f) => ({ nome: f.nome, valor: f.valor, partes: f.partes })),
  }
  writeFileSync(join(saida, 'paineis.json'), JSON.stringify(paineis, null, 2))
  // Sem acento: o Godot lê a saída do node como Latin-1.
  console.log(`mesa_movel: ${este.p.id}, familia com ${paineis.familia.desenhados} de ${paineis.familia.total} moveis desenhados e ${arte.size} carimbos` + (md.desenhado.valor < Infinity ? `; menor distancia entre as madeiras: Desenhado ${md.desenhado.valor.toFixed(3)}` + (md.atual ? `, Atual ${md.atual.valor.toFixed(3)}` : '') : ''))
}

principal()
