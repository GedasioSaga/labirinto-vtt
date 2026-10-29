/**
 * A MESA DE PROVA DOS MÓVEIS DESENHADOS (onda 4, CONTRATO.md seção 10). O Desenhado sai
 * da conta de referência (ferramentas/movel.ts) com as imagens que o Godot exportou; o
 * Atual sai do motor dos móveis do client da MAIN (montarCena + pintarCena, só leitura,
 * empacotado por ferramentas/construir.mjs). Grava os painéis a 100% (64 px por casa) e a
 * 300% (192 px por casa); a mesa do Godot (comum/mesa_movel.gd) arruma a folha e reduz
 * para 50% e 25%.
 *
 * Uso: node ferramentas/.build/mesa_movel.mjs --textura=<exportado/movel-x> --exportado=<exportado/>
 *        --saida=<paineis> [--sem-atual] [--familia=clareira|praca|sala|oficina]
 * Lê em <paineis>: chao-familia-100.png e chao-familia-300.png (a grama aprovada) e
 * chao-sala-100.png e chao-sala-300.png (o chão de sala aprovado, em cinza), as 12 x 12 casas
 * inteiras, que o Godot pinta antes. A cena de família (a clareira, a de partida; a praça da
 * vila do lote 12; a sala dos lotes 13 e 14 e da lareira; a oficina e fazenda da fornalha e
 * do lote 16) usa todos os exportado/movel-* que existirem e, nas de grama, os carimbos da
 * onda 3 (arvore, arvore-redonda, arbusto, pedras, tronco-caido); o 300% dela é o recorte de
 * 4 x 4 casas em volta do móvel da folha.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { escalaDoNivel, montarCena, type DesenhoDoMovel, type TipoComTextura } from '@cliente/texturas/meioTermo/moveis'
import { pintarCena } from '@cliente/texturas/meioTermo/moveis/motor'
import { LUGARES_DE_MATERIAL, MATERIAIS, type IdDoMaterial, type OpcaoDeMaterial } from '@cliente/texturas/meioTermo/materiais'
import { rgb } from '@cliente/texturas/ruido'
import { gravarPng, lerPng, type Imagem } from './png'
import { geometriaDaCerca, varianteDoFogo, varianteDosPratos } from '@cliente/lib/mobilia'
import { ehMovelComFogoDeCasa, FORNALHA, LAREIRA } from '@cliente/lib/mobilia/fogoDeCasa'
import { ehMovelDePilha, varianteDaPilha } from '@cliente/lib/mobilia/pilhas'
import { BRASA_QUENTE } from '@cliente/texturas/meioTermo/moveis/fogueira'
import { comporMovel, desfocar, oklab, varianteDoPedido, type Camada, type GeometriaDaCercaEmCasas, type MovelCarregado, type ParamsDoMovel, type Rgb, type Vista } from './movel'

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
  /** Só a cerca: a volta em graus (Prop.mobiliaCurva); ausente = reta. */
  readonly volta?: number
  /** Por cima de outro móvel (o lampião na mesa): soma na ordem de pintar; ausente = 0. */
  readonly z?: number
  /**
   * A forma do painel, como o mapa grava (Prop.mobiliaForma): o fogo apagado da lareira e da
   * fornalha, a forma dos pratos, dos troncos e do feno; ausente = a de partida. No Desenhado
   * ela escolhe a variante com quando.forma; no Atual vira a variante do motor (rasterDosMoveis).
   */
  readonly forma?: string
  /**
   * Só a lápide: a variação que o app sorteia pelo id (varianteDaLapide(prop.id), 0 a 2;
   * CONTRATO 10.13); ausente = 0. No Desenhado escolhe a variante com quando.variacao; no
   * Atual é a variante do motor, como rasterDosMoveis.ts a passa.
   */
  readonly variacao?: number
}

type FormaGravada = Parameters<typeof varianteDoFogo>[0]['mobiliaForma']

/** A variante do motor de hoje para a forma do objeto, como pixi/rasterDosMoveis.ts a passa (na lápide, a variação do id). */
function varianteDoAtual(o: Objeto): number | undefined {
  const prop = { mobilia: o.tipo, mobiliaForma: o.forma as FormaGravada }
  if (o.tipo === 'lapide') return o.variacao
  if (o.tipo === 'pratos') return varianteDosPratos(prop)
  if (ehMovelComFogoDeCasa(o.tipo)) return varianteDoFogo(prop)
  if (ehMovelDePilha(o.tipo)) return varianteDaPilha(o.tipo, o.forma)
  return undefined
}

/** A ordem de pintar de um objeto: a borda de baixo da pegada, mais o z de quem vai por cima. */
function ordemDe(o: Objeto): number {
  return o.y + o.casas[1] / 2 + (o.z ?? 0)
}

/** A geometria do app para a cerca (CONTRATO 10.12), em casas: geometriaDaCerca mede em px do mundo, 64 por casa. */
function geometriaDaCercaEmCasas(o: Objeto): GeometriaDaCercaEmCasas | undefined {
  const g = geometriaDaCerca(o.casas[0] * CASA_100, o.casas[1] * CASA_100, o.volta ?? 0)
  if (g === null) return undefined
  const k = 1 / CASA_100
  return {
    mouroes: g.mouroes.map((q) => ({ x: q.x * k, y: q.y * k })),
    raio: g.raio * k,
    arco: g.arco === null ? null : { center: { x: g.arco.center.x * k, y: g.arco.center.y * k }, radius: g.arco.radius * k, startAngle: g.arco.startAngle, sweep: g.arco.sweep },
  }
}

function camadaDoAtual(o: Objeto, nivel: number, semente: number): { c: Camada; cx: number; cy: number; pxPorCasa: number } {
  const variante = varianteDoAtual(o)
  // O tapete leva a forma (redondo ou retangular) no desenho, como rasterDosMoveis.ts (formaDoTapete).
  const formaDoTapete = o.tipo === 'tapete' && o.forma !== undefined ? { forma: o.forma as NonNullable<DesenhoDoMovel['forma']> } : {}
  const d: DesenhoDoMovel = { tipo: o.tipo, lado: o.vista, materiais: o.opcoes, casasW: o.casas[0], casasH: o.casas[1], semente, ...(o.volta !== undefined ? { curva: o.volta } : {}), ...(variante !== undefined ? { variante } : {}), ...formaDoTapete }
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

/** O móvel Desenhado do objeto, composto pela conta de referência (ferramentas/movel.ts). */
function comporObjeto(m: MovelCarregado, o: Objeto, casa: number): ReturnType<typeof comporMovel> {
  const tons = m.p.lugares.map((_l, i) => tomDaOpcao(o.opcoes, i, m.p.lugares))
  // A cerca por peças (10.12) recebe a geometria do app; os outros móveis, o pedido de sempre.
  const cerca = m.p.pecas !== undefined && o.tipo === 'cerca' ? geometriaDaCercaEmCasas(o) : undefined
  return comporMovel(m, { vista: o.vista, opcoes: o.opcoes, tons, casasW: o.casas[0], casasH: o.casas[1], giro: o.giro, ...(cerca !== undefined ? { cerca } : {}), ...(o.forma !== undefined ? { forma: o.forma } : {}), ...(o.variacao !== undefined ? { variacao: o.variacao } : {}) }, casa)
}

function porObjeto(t: Tela, lado: Lado, moveis: ReadonlyMap<string, MovelCarregado>, o: Objeto, casa: number, ox: number, oy: number, semente: number, passo: 'sombra' | 'corpo'): void {
  const X = (o.x - ox) * casa
  const Y = (o.y - oy) * casa
  const m = moveis.get(o.tipo)
  if (lado === 'desenhado' && m !== undefined) {
    const comp = comporObjeto(m, o, casa)
    const mat = matrizDoMeio(comp.cx, comp.cy, X, Y, 1, comp.resto)
    if (passo === 'sombra') {
      if (comp.sombra === null) return
      const s = comp.sombra
      const alfa = m.p.sombra.alfa
      const c: Camada = { w: comp.corpo.w, h: comp.corpo.h, px: new Float32Array(comp.corpo.w * comp.corpo.h * 4).map((_v, i) => (i % 4 === 3 ? (s[i >> 2] / alfa) * 255 : 0)) }
      porAfim(t, { n: [c] }, mat, true)
    } else {
      if (o.tipo === 'lampiao') pintarHaloDoLampiao(t, o, X, Y, casa)
      porAfim(t, { n: [comp.corpo] }, mat)
      if (ehMovelComFogoDeCasa(o.tipo) && o.forma !== 'apagado') pintarHaloDoFogo(t, o, X, Y, casa)
    }
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
  const ordem = [...objetos].sort((a, b) => ordemDe(a) - ordemDe(b))
  // A sombra de tudo numa camada só (como os carimbos, CONTRATO 9.4), depois os corpos.
  const cs = [...carimbos].sort((a, b) => a.y - b.y)
  for (const c of cs) porCarimbo(t, arte, c, casa, ox, oy, 'sombra')
  ordem.forEach((o, i) => porObjeto(t, lado, moveis, o, casa, ox, oy, 101 + 17 * i, 'sombra'))
  pintarSombra(t, 0.25)
  const todos: { y: number; pintar: () => void }[] = [
    ...cs.map((c) => ({ y: c.y, pintar: () => porCarimbo(t, arte, c, casa, ox, oy, 'corpo') })),
    ...ordem.map((o, i) => ({ y: ordemDe(o), pintar: () => porObjeto(t, lado, moveis, o, casa, ox, oy, 101 + 17 * i, 'corpo') })),
  ]
  todos.sort((a, b) => a.y - b.y).forEach((q) => q.pintar())
  return emImagem(t)
}

/**
 * O halo quente que o app pinta hoje no chão em volta do lampião (client lampiao.ts:
 * COR_DO_HALO (226, 170, 96), ALFA_DO_HALO 0,10 no meio, HALO_EM_RAIOS 4,8 x o meio lado
 * menor da pegada, alfa 0,10 · (1 - q)² com q = d² / r², emissão). No Desenhado o halo
 * continua do app, fora da imagem do móvel: a mesa pinta o mesmo, logo antes do corpo, como
 * a integração tem de fazer para o lampião não apagar.
 */
const HALO_DO_LAMPIAO = { cor: [226, 170, 96] as Rgb, alfa: 0.1, raios: 4.8 }

function pintarHaloDoLampiao(t: Tela, o: Objeto, X: number, Y: number, casa: number): void {
  const r = ((HALO_DO_LAMPIAO.raios * Math.min(o.casas[0], o.casas[1])) / 2) * casa
  const x0 = Math.max(0, Math.floor(X - r))
  const x1 = Math.min(t.w, Math.ceil(X + r))
  const y0 = Math.max(0, Math.floor(Y - r))
  const y1 = Math.min(t.h, Math.ceil(Y + r))
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const q = ((x + 0.5 - X) ** 2 + (y + 0.5 - Y) ** 2) / (r * r)
      if (q >= 1) continue
      const a = HALO_DO_LAMPIAO.alfa * (1 - q) * (1 - q)
      const o4 = (y * t.w + x) * 4
      for (let k = 0; k < 3; k += 1) t.px[o4 + k] = t.px[o4 + k] * (1 - a) + HALO_DO_LAMPIAO.cor[k] * a
    }
  }
}

/**
 * O halo quente do fogo aceso da lareira e da fornalha, que no Atual mora na imagem do móvel
 * (client lareira.ts e fornalha.ts: texHalo, a cor BRASA_QUENTE com alfa · (1 - q)², q = d²
 * na elipse) e no Desenhado é do app, POR CIMA do móvel (a imagem só tem a brasa). A mesa
 * pinta o mesmo halo, no mesmo lugar (lib/mobilia/fogoDeCasa.ts), recortado onde o Atual o
 * deixa aparecer: na lareira, o lar (alfa 0,22) e a soleira (0,11); na fornalha, o leito
 * dentro da borda de pedra (0,22). A chama animada não entra (não entra no Atual da mesa).
 */
interface HaloDoFogo {
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  readonly alfa: number
  /** O recorte, em casas no referencial do móvel: x0, y0, x1, y1. */
  readonly caixa: readonly [number, number, number, number]
}

function halosDoFogo(o: Objeto): HaloDoFogo[] {
  const [w, h] = o.casas
  if (o.tipo === 'lareira') {
    const { lar, soleira: so, fogo } = LAREIRA
    const fx = fogo.x * w
    const fy = fogo.y * h
    return [
      { cx: fx, cy: fy, rx: 0.24 * w, ry: 0.3 * h, alfa: 0.22, caixa: [-lar.meiaLargura * w, lar.de * h, lar.meiaLargura * w, lar.ate * h] },
      { cx: fx, cy: so.de * h, rx: 0.34 * w, ry: 0.26 * h, alfa: 0.11, caixa: [-so.meiaLargura * w, so.de * h, so.meiaLargura * w, so.ate * h] },
    ]
  }
  const { bancada: ba, fogareiro: fg } = FORNALHA
  const R = Math.min(w, h)
  const r = R * fg.raio
  const beira = R * 0.09
  return [{ cx: fg.x * w, cy: fg.y * h, rx: r * 2, ry: r * 1.8, alfa: 0.22, caixa: [ba.de * w + beira, ba.topo * h + beira, ba.ate * w - beira, ba.base * h - beira] }]
}

function pintarHaloDoFogo(t: Tela, o: Objeto, X: number, Y: number, casa: number): void {
  const halos = halosDoFogo(o)
  const raio = Math.hypot(o.casas[0], o.casas[1]) * 0.5 * casa
  const g = (-o.giro * Math.PI) / 180
  const co = Math.cos(g)
  const si = Math.sin(g)
  const x0 = Math.max(0, Math.floor(X - raio))
  const x1 = Math.min(t.w, Math.ceil(X + raio))
  const y0 = Math.max(0, Math.floor(Y - raio))
  const y1 = Math.min(t.h, Math.ceil(Y + raio))
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dx = x + 0.5 - X
      const dy = y + 0.5 - Y
      const u = (co * dx - si * dy) / casa
      const v = (si * dx + co * dy) / casa
      let a = 0
      for (const hl of halos) {
        if (u < hl.caixa[0] || u > hl.caixa[2] || v < hl.caixa[1] || v > hl.caixa[3]) continue
        const q = Math.min(1, ((u - hl.cx) / hl.rx) ** 2 + ((v - hl.cy) / hl.ry) ** 2)
        a = Math.max(a, hl.alfa * (1 - q) * (1 - q))
      }
      if (a <= 0) continue
      const o4 = (y * t.w + x) * 4
      for (let k = 0; k < 3; k += 1) t.px[o4 + k] = t.px[o4 + k] * (1 - a) + BRASA_QUENTE[k] * a
    }
  }
}

// ---------- o chão de sala tingido (a sala; PROPOSTA-TINGIR.md) ----------

function emSrgb(c: number): number {
  const u = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055
  return u * 255
}

/** sRGB 0..255 de um OKLab, ou null se sai da tela. */
function rgbDoOklab(L: number, a: number, b: number): Rgb | null {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  if (lin.some((v) => v < -1e-4 || v > 1 + 1e-4)) return null
  return [emSrgb(lin[0]), emSrgb(lin[1]), emSrgb(lin[2])]
}

function suaveDe(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * A rampa do chão de sala tingível (PROPOSTA-TINGIR.md, a conta "luz-oklab" do
 * texturas/piso/config.json): o cinza g vira a cor da sala com a luz andada
 * L' = L + 0,48 · j · (g - 0,5), j = suave(0; 0,10; L) · suave(1; 0,94; L); a e b ficam e,
 * fora da tela, encolhem juntos (busca binária).
 */
function rampaDoPiso(cor: Rgb): Rgb[] {
  const [L, a, b] = oklab(cor)
  const j = suaveDe(0, 0.1, L) * suaveDe(1, 0.94, L)
  const rampa: Rgb[] = []
  for (let g = 0; g < 256; g += 1) {
    const Lp = L + 0.48 * j * (g / 255 - 0.5)
    let c = rgbDoOklab(Lp, a, b)
    if (c === null) {
      let lo = 0
      let hi = 1
      for (let i = 0; i < 24; i += 1) {
        const k = (lo + hi) / 2
        if (rgbDoOklab(Lp, a * k, b * k) === null) hi = k
        else lo = k
      }
      c = rgbDoOklab(Lp, a * lo, b * lo) ?? [0, 0, 0]
    }
    rampa.push(c)
  }
  return rampa
}

/** O chão de sala montado em cinza (o Godot pinta) tingido com a cor da sala. */
function tingirPiso(img: Imagem, cor: Rgb): Imagem {
  const rampa = rampaDoPiso(cor)
  const px = new Uint8ClampedArray(img.w * img.h * 4)
  for (let i = 0; i < img.w * img.h; i += 1) {
    const c = rampa[img.px[i * 4]]
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = Math.round(c[k])
    px[i * 4 + 3] = 255
  }
  return { w: img.w, h: img.h, px }
}

/** Um recorte de x0, y0 (px) com w x h px. */
function recortar(img: Imagem, x0: number, y0: number, w: number, h: number): Imagem {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const xs = Math.min(img.w - 1, x0 + x)
      const ys = Math.min(img.h - 1, y0 + y)
      for (let k = 0; k < 4; k += 1) px[(y * w + x) * 4 + k] = img.px[(ys * img.w + xs) * 4 + k]
    }
  }
  return { w, h, px }
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

/**
 * A máscara do lugar `im` (0..2) do objeto na tela de w x h px a `casa` px por casa: por px, o
 * peso do canal im da imagem -partes vezes a cobertura (0..1), no mesmo lugar em que o
 * Desenhado pinta o móvel (a mesma forma, virada, esticar e giro). Sai da mesma conta de
 * referência com um móvel derivado: nenhum lugar tem peso, e a "cor fixa" é o canal em
 * cinza, que o tingir copia sem rampa; sem halo, sem sombra.
 */
function mascaraDoLugar(m: MovelCarregado, im: number, o: Objeto, casa: number, w: number, h: number): Float32Array {
  const imagens = new Map<string, Imagem>()
  const formas = m.p.formas.map((f) => {
    const valor = m.imagens.get(f.valor)
    const partes = m.imagens.get(f.partes)
    if (valor === undefined || partes === undefined) throw new Error(`${m.p.id}: falta ${f.valor} ou ${f.partes}`)
    const n = valor.w * valor.h
    const cinza = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n; i += 1) {
      for (let k = 0; k < 3; k += 1) cinza[i * 4 + k] = partes.px[i * 4 + im]
      cinza[i * 4 + 3] = 255
    }
    imagens.set(f.valor, valor)
    imagens.set(`${f.nome}#sem-peso`, { w: valor.w, h: valor.h, px: new Uint8ClampedArray(n * 4) })
    imagens.set(`${f.nome}#mascara`, { w: valor.w, h: valor.h, px: cinza })
    return { ...f, partes: `${f.nome}#sem-peso`, cor: `${f.nome}#mascara` }
  })
  // Outro id: a camada tingida fica guardada pelo id do móvel (ferramentas/movel.ts).
  const derivado: MovelCarregado = { p: { ...m.p, id: `${m.p.id}#mascara-${im}`, formas }, imagens }
  const comp = comporObjeto(derivado, o, casa)
  const t = novaTela(w, h, [0, 0, 0])
  porAfim(t, { n: [comp.corpo] }, matrizDoMeio(comp.cx, comp.cy, o.x * casa, o.y * casa, 1, comp.resto))
  const peso = new Float32Array(w * h)
  for (let i = 0; i < w * h; i += 1) peso[i] = t.px[i * 4] / 255
  return peso
}

/**
 * A cor média OKLab do lugar de madeira do móvel sozinho a 300%: cada px pesado pela
 * máscara do lugar (mascaraDoLugar). O Atual é medido com a mesma máscara (o mesmo móvel no
 * mesmo lugar e na mesma pegada). Sem peso nenhum, undefined.
 */
function medir(img: Imagem, peso: Float32Array): Medida | undefined {
  let n = 0
  let sL = 0
  let sa = 0
  let sb = 0
  let sLL = 0
  for (let i = 0; i < img.w * img.h; i += 1) {
    const p = peso[i]
    if (p <= 0) continue
    const [L, a, b] = oklab([img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]])
    n += p
    sL += p * L
    sa += p * a
    sb += p * b
    sLL += p * L * L
  }
  if (n < 1) return undefined
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

/** O primeiro lugar de madeira do tipo (o que aceita carvalho), ou -1: é nele que os 5 tons andam. */
function lugarDaMadeira(tipo: TipoComTextura): number {
  return LUGARES_DE_MATERIAL[tipo].findIndex((l) => l.opcoes.includes('carvalho'))
}

function opcoesDoTom(tipo: TipoComTextura, madeira: IdDoMaterial): OpcaoDeMaterial[] {
  const im = lugarDaMadeira(tipo)
  return LUGARES_DE_MATERIAL[tipo].map((l, i) => (i === im && l.opcoes.includes(madeira) ? madeira : l.opcoes.includes('mesma') ? 'mesma' : l.padrao))
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
  // As formas do painel (variantes com quando.forma: o fogo apagado, os pratos, as pilhas, o
  // tapete redondo) e as variações do id (quando.variacao: a lápide): a de partida e as
  // outras, uma por combo e por virada, para a folha mostrar todas ao lado do Atual. Cada
  // forma entra uma vez só (os troncos têm duas variantes de Lenha, uma por madeira). Quem
  // não tem forma nem variação sai como sempre.
  const formasDoPainel: Partial<Objeto>[] = [{}]
  const jaVistas = new Set<string>()
  for (const v of este.p.variantes) {
    const f = v.quando.forma
    const va = v.quando.variacao
    if (f === undefined && va === undefined) continue
    const chave = `${f ?? ''}|${va ?? ''}`
    if (jaVistas.has(chave)) continue
    jaVistas.add(chave)
    const casas = v.vistas?.frente?.casas
    formasDoPainel.push({ ...(f !== undefined ? { forma: f } : {}), ...(va !== undefined ? { variacao: Number(va) } : {}), ...(casas !== undefined ? { casas: [casas[0], casas[1]] as const } : {}) })
  }
  const naForma = (i: number): Partial<Objeto> => (formasDoPainel.length > 1 ? formasDoPainel[i % formasDoPainel.length] : {})
  // A célula das 3 combinações cabe a maior forma delas (o incêndio do fogo tem 3 casas).
  const celCombo = [0, 1, 2].reduce((c, i) => {
    const casas = naForma(i).casas ?? frente.casas
    return [Math.max(c[0], casas[0] + 1), Math.max(c[1], casas[1] + 1)]
  }, cel)
  // O nome de cada combinação: os materiais e, com formas, a variante que o Desenhado escolhe.
  const nomeDoCombo = (o: readonly OpcaoDeMaterial[], i: number): string => {
    if (formasDoPainel.length <= 1) return nomeDasOpcoes(o)
    const f = naForma(i)
    const nome = varianteDoPedido(este.p, o, f.forma, f.variacao)
    return `${nomeDasOpcoes(o) || 'sem material'} (${nome})`
  }
  const madeiras = (['carvalho', 'nogueira', 'pinho', 'cerejeira', 'velha'] as IdDoMaterial[])
  // Por qualquer lugar de madeira (o poço tem as pedras no lugar 1 e a madeira no 2).
  const temMadeira = lugarDaMadeira(tipo) >= 0
  const medidas: Record<Lado, { id: string; m: Medida }[]> = { desenhado: [], atual: [] }
  let mascaraDaMadeira: Float32Array | undefined
  for (const lado of lados) {
    // Os 3 combos lado a lado a 100% e o primeiro sozinho a 300%.
    const objs = combos.map((o, i) => ob(celCombo[0] * (i + 0.5), celCombo[1] / 2, { opcoes: o, ...naForma(i) }))
    gravarPng(join(saida, `combos-${lado}-100.png`), montar(objs, lado, moveis, celCombo[0] * 3, celCombo[1], CASA_100), true)
    gravarPng(join(saida, `sozinho-${lado}-300.png`), montar([ob(cel[0] / 2, cel[1] / 2)], lado, moveis, cel[0], cel[1], CASA_300), true)
    // Os 5 tons de madeira (o resto padrão, o assento de madeira), medidos nos px do lugar de
    // madeira (o canal dele na -partes), a mesma máscara para o Desenhado e o Atual.
    if (temMadeira) {
      const ts = madeiras.map((md, i) => ob(cel[0] * (i + 0.5), cel[1] / 2, { opcoes: opcoesDoTom(tipo, md) }))
      gravarPng(join(saida, `tons-${lado}.png`), montar(ts, lado, moveis, cel[0] * 5, cel[1], CASA_100), true)
      const sozinho = ob(cel[0] / 2, cel[1] / 2, { opcoes: opcoesDoTom(tipo, madeiras[0]) })
      if (mascaraDaMadeira === undefined) {
        const w = Math.round(cel[0] * CASA_300)
        const h = Math.round(cel[1] * CASA_300)
        const peso = mascaraDoLugar(este, lugarDaMadeira(tipo), sozinho, CASA_300, w, h)
        mascaraDaMadeira = peso
        // A máscara em cinza (branco = o lugar de madeira inteiro), para conferir onde se mede.
        const px = new Uint8ClampedArray(w * h * 4)
        for (let i = 0; i < w * h; i += 1) {
          for (let k = 0; k < 3; k += 1) px[i * 4 + k] = Math.round(peso[i] * 255)
          px[i * 4 + 3] = 255
        }
        gravarPng(join(saida, 'mascara-madeira-300.png'), { w, h, px }, true)
      }
      for (const md of madeiras) {
        const img = montar([ob(cel[0] / 2, cel[1] / 2, { opcoes: opcoesDoTom(tipo, md) })], lado, moveis, cel[0], cel[1], CASA_300)
        const m = medir(img, mascaraDaMadeira)
        if (m !== undefined) medidas[lado].push({ id: md, m })
      }
    }
    // As 4 viradas (e as da vista de lado, se houver).
    const giros = [0, 90, 180, 270]
    const lado2 = este.p.vistas.lado
    const linhas: Objeto[] = []
    const q = Math.max(cel[0], cel[1])
    giros.forEach((g, i) => linhas.push(ob(q * (i + 0.5), q / 2, { giro: g, ...naForma(i) })))
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
  // com árvores, arbustos, pedras e um tronco caído da onda 3 (os Desenhados exportados), e
  // os móveis dos lotes 10, 11 e 15 em volta.
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
    // Lote 10: um canto de depósito em volta da clareira.
    { tipo: 'mesaQuadrada', x: 6.9, y: 3.5, casas: [1, 1], giro: 0, opcoes: ['carvalho'], vista: 'frente' },
    { tipo: 'caixa', x: 8.4, y: 3.6, casas: [0.8, 0.8], giro: 0, opcoes: ['pinho'], vista: 'frente' },
    { tipo: 'armario', x: 5.2, y: 3.4, casas: [1, 0.5], giro: 0, opcoes: ['pinho', 'latao'], vista: 'frente' },
    { tipo: 'bau', x: 5.0, y: 8.6, casas: [1, 0.6], giro: 0, opcoes: ['nogueira', 'ferro'], vista: 'frente' },
    { tipo: 'mesaRedonda', x: 7.9, y: 8.7, casas: [1.25, 1.25], giro: 0, opcoes: ['cerejeira'], vista: 'frente' },
    // Lote 11: a cama, o balcão de taverna e o aparador esticados, o quadro e a placa da vila.
    { tipo: 'catre', x: 10.8, y: 5.2, casas: [1, 2], giro: 0, opcoes: ['carvalho', 'vinho', 'linho'], vista: 'frente' },
    { tipo: 'balcao', x: 7.2, y: 1.7, casas: [4, 0.6], giro: 0, opcoes: ['carvalho', 'latao'], vista: 'frente' },
    { tipo: 'aparador', x: 3.0, y: 7.3, casas: [3, 0.5], giro: 0, opcoes: ['pinho', 'ferro'], vista: 'frente' },
    { tipo: 'quadroDeAvisos', x: 4.75, y: 4.75, casas: [1, 0.4], giro: 0, opcoes: ['nogueira'], vista: 'frente' },
    { tipo: 'placaDeSeta', x: 3.6, y: 6.3, casas: [0.5, 0.5], giro: 30, opcoes: ['pinho'], vista: 'frente' },
    // Lote 15: a fogueira e um fogo pequeno (a chama) no chão de baixo, e um cantinho de
    // cemitério no alto, entre a árvore e o balcão, com 3 lápides, cada uma com a sua variação do id (o arco, a
    // reta e a cruz, como varianteDaLapide sortearia para três ids).
    { tipo: 'fogueira', x: 8.7, y: 10.5, casas: [1, 1], giro: 0, opcoes: ['granito', 'lenhaCarvalho'], vista: 'frente' },
    { tipo: 'fogo', x: 4.4, y: 10.8, casas: [1, 1], giro: 0, opcoes: [], vista: 'frente' },
    { tipo: 'lapide', x: 3.8, y: 0.75, casas: [0.6, 0.35], giro: 0, opcoes: ['granito'], vista: 'frente', variacao: 0 },
    { tipo: 'lapide', x: 4.6, y: 0.75, casas: [0.6, 0.35], giro: 0, opcoes: ['granito'], vista: 'frente', variacao: 1 },
    { tipo: 'lapide', x: 5.4, y: 0.75, casas: [0.6, 0.35], giro: 0, opcoes: ['ardosia'], vista: 'frente', variacao: 2 },
  ]
  const carimbos: Carimbo[] = [
    { id: 'arvore', x: 2.3, y: 3.6, escolha: 1, giro: 0 }, { id: 'arvore', x: 10.2, y: 3.0, escolha: 1.1, giro: 90 },
    { id: 'arvore-redonda', x: 2.4, y: 10.6, escolha: 1, giro: 45 }, { id: 'arvore-redonda', x: 10.6, y: 10.9, escolha: 0.9, giro: 180 },
    { id: 'arbusto', x: 4.1, y: 2.4, escolha: 1, giro: 0 }, { id: 'arbusto', x: 9.6, y: 9.0, escolha: 1.2, giro: 135 }, { id: 'arbusto', x: 1.2, y: 6.8, escolha: 0.9, giro: 270 },
    { id: 'pedras', x: 10.6, y: 7.4, escolha: 1, giro: 0 }, { id: 'pedras', x: 3.2, y: 8.3, escolha: 0.7, giro: 90 },
    { id: 'tronco-caido', x: 6.3, y: 10.0, escolha: 1, giro: 0 },
  ]
  // A SEGUNDA cena de família, a PRAÇA DA VILA (lote 12): na mesma grama e no mesmo recorte
  // de 300%, a entrada embaixo pelo arco do portão esticado a 3 casas, a cerca saindo dos
  // dois lados do arco e curvando para cima (um quarto de círculo de raio 3 de cada lado,
  // pela geometria do app), o poço no meio, a barraca de feira e a carroça vistas de cima,
  // barris, caixas, a placa de seta e o quadro de avisos; árvores, arbustos e pedras da onda
  // 3 nas bordas. Vale para os móveis do lote 12 ou com --familia=praca (--familia=clareira
  // força a de sempre).
  const pracaObjs: Objeto[] = [
    { tipo: 'arcoDoPortao', x: 6, y: 10.6, casas: [3, 0.5], giro: 0, opcoes: ['nogueira', 'pinho'], vista: 'frente' },
    { tipo: 'cerca', x: 3.02, y: 9.0, casas: [3 * Math.SQRT2 + 0.225, 0.25], giro: 45, volta: 90, opcoes: ['carvalho', 'varas'], vista: 'frente' },
    { tipo: 'cerca', x: 8.98, y: 9.0, casas: [3 * Math.SQRT2 + 0.225, 0.25], giro: -45, volta: 90, opcoes: ['carvalho', 'varas'], vista: 'frente' },
    { tipo: 'poco', x: 6, y: 6.3, casas: [1.5, 1.5], giro: 0, opcoes: ['granito', 'carvalho'], vista: 'frente' },
    { tipo: 'barraca', x: 9.3, y: 4.5, casas: [2, 2], giro: 0, opcoes: ['vinho', 'pinho'], vista: 'frente' },
    { tipo: 'carroca', x: 2.9, y: 4.85, casas: [2, 1.25], giro: 0, opcoes: ['nogueira', 'ferro'], vista: 'frente' },
    { tipo: 'barril', x: 10.85, y: 6.15, casas: [0.7, 0.7], giro: 0, opcoes: ['carvalho', 'ferro'], vista: 'frente' },
    { tipo: 'barril', x: 10.05, y: 6.45, casas: [0.7, 0.7], giro: 0, opcoes: ['nogueira', 'latao'], vista: 'frente' },
    { tipo: 'barril', x: 7.7, y: 4.8, casas: [0.7, 0.7], giro: 0, opcoes: ['pinho', 'ferro'], vista: 'frente' },
    { tipo: 'caixa', x: 1.75, y: 6.25, casas: [0.8, 0.8], giro: 0, opcoes: ['pinho'], vista: 'frente' },
    { tipo: 'caixa', x: 2.75, y: 6.45, casas: [0.8, 0.8], giro: 0, opcoes: ['carvalho'], vista: 'frente' },
    { tipo: 'placaDeSeta', x: 4.95, y: 9.45, casas: [0.5, 0.5], giro: 0, opcoes: ['pinho'], vista: 'frente' },
    { tipo: 'quadroDeAvisos', x: 7.7, y: 8.75, casas: [1, 0.4], giro: 0, opcoes: ['nogueira'], vista: 'frente' },
  ]
  const pracaCarimbos: Carimbo[] = [
    { id: 'arvore', x: 1.5, y: 3.0, escolha: 1, giro: 0 }, { id: 'arvore', x: 10.6, y: 2.75, escolha: 1.05, giro: 90 },
    { id: 'arvore-redonda', x: 6.0, y: 2.5, escolha: 0.9, giro: 45 },
    { id: 'arbusto', x: 0.8, y: 11.2, escolha: 1, giro: 0 }, { id: 'arbusto', x: 11.2, y: 11.25, escolha: 1.1, giro: 135 }, { id: 'arbusto', x: 3.9, y: 2.9, escolha: 0.8, giro: 270 },
    { id: 'pedras', x: 11.3, y: 9.6, escolha: 0.8, giro: 0 }, { id: 'pedras', x: 0.7, y: 9.3, escolha: 0.7, giro: 90 },
  ]
  // A TERCEIRA cena de família, a SALA (lotes 13 e 14, os móveis de dentro de casa): 12 x 12
  // casas no chão de sala aprovado (texturas/piso, montado em cinza pelo Godot e tingido com
  // a cor padrão das salas do app, #a8776a, pela conta de PROPOSTA-TINGIR.md). A sala de
  // estar no meio (o tapete de 3 x 2, o sofá de 3 casas atrás dele, as 2 poltronas dos lados
  // de frente para ele, um lampião em pé ao lado do sofá e outro na mesinha), a mesa de
  // jantar com 5 cadeiras e os pratos em cima à direita, a mesinha redonda do café, a caixa e o
  // barril da entrada, o armário na parede da direita, o
  // quarto embaixo à direita (a cama no canto e o baú no pé), o corredor embaixo à esquerda
  // (o tapete longo e o aparador ao longo), a cozinha embaixo no meio (a geladeira, o fogão
  // e a pia) e o banheiro na parede da esquerda (a pia, a privada e o balde). Sem carimbos: é
  // dentro de casa. Vale para os móveis dos lotes 13 e 14 ou com --familia=sala.
  const salaObjs: Objeto[] = [
    // O primeiro de cada tipo é o do recorte de 300% (o lampião em pé, ao lado do sofá).
    { tipo: 'lampiao', x: 8.15, y: 3.5, casas: [0.5, 0.5], giro: 0, opcoes: ['ferro'], vista: 'frente' },
    // A sala de estar no meio: o tapete, o sofá atrás dele e as poltronas dos lados, de frente para ele.
    { tipo: 'tapete', x: 5.75, y: 5.6, casas: [3, 2], giro: 0, opcoes: ['azul'], vista: 'frente' },
    { tipo: 'sofa', x: 5.75, y: 3.5, casas: [3, 1], giro: 0, opcoes: ['vinho', 'nogueira'], vista: 'frente' },
    { tipo: 'poltrona', x: 3.2, y: 5.6, casas: [1, 1], giro: 270, opcoes: ['ocre', 'nogueira'], vista: 'frente' },
    { tipo: 'poltrona', x: 8.3, y: 5.6, casas: [1, 1], giro: 90, opcoes: ['ocre', 'nogueira'], vista: 'frente' },
    { tipo: 'mesaQuadrada', x: 3.3, y: 3.5, casas: [1, 1], giro: 0, opcoes: ['carvalho'], vista: 'frente' },
    { tipo: 'lampiao', x: 3.3, y: 3.5, casas: [0.5, 0.5], giro: 0, opcoes: ['latao'], vista: 'frente', z: 1 },
    // A mesa de jantar em cima à direita, com os pratos.
    { tipo: 'mesa', x: 9.7, y: 1.6, casas: [2, 1], giro: 0, opcoes: ['nogueira'], vista: 'frente' },
    { tipo: 'cadeira', x: 9.2, y: 0.75, casas: [0.5, 0.5], giro: 0, opcoes: ['nogueira', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 10.2, y: 0.75, casas: [0.5, 0.5], giro: 0, opcoes: ['nogueira', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 9.2, y: 2.45, casas: [0.5, 0.5], giro: 180, opcoes: ['nogueira', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 10.2, y: 2.45, casas: [0.5, 0.5], giro: 180, opcoes: ['nogueira', 'palha'], vista: 'frente' },
    { tipo: 'cadeira', x: 8.25, y: 1.6, casas: [0.5, 0.5], giro: 270, opcoes: ['nogueira', 'mesma'], vista: 'frente' },
    { tipo: 'pratos', x: 9.2, y: 1.6, casas: [0.5, 0.5], giro: 0, opcoes: [], vista: 'frente', z: 1 },
    { tipo: 'pratos', x: 10.2, y: 1.6, casas: [0.5, 0.5], giro: 0, opcoes: [], vista: 'frente', z: 1 },
    // A mesinha redonda do café, entre a sala e a cozinha.
    { tipo: 'mesaRedonda', x: 6.4, y: 8.7, casas: [1.25, 1.25], giro: 0, opcoes: ['cerejeira'], vista: 'frente' },
    { tipo: 'cadeira', x: 5.4, y: 8.7, casas: [0.5, 0.5], giro: 270, opcoes: ['cerejeira', 'mesma'], vista: 'frente' },
    { tipo: 'cadeira', x: 7.4, y: 8.7, casas: [0.5, 0.5], giro: 90, opcoes: ['cerejeira', 'mesma'], vista: 'frente' },
    // A entrada em cima à esquerda: a caixa e o barril.
    { tipo: 'caixa', x: 1.2, y: 1.0, casas: [0.8, 0.8], giro: 0, opcoes: ['pinho'], vista: 'frente' },
    { tipo: 'barril', x: 2.3, y: 0.85, casas: [0.7, 0.7], giro: 0, opcoes: ['carvalho', 'ferro'], vista: 'frente' },
    // O quarto embaixo à direita: o armário na parede, a cama no canto e o baú no pé dela.
    { tipo: 'armario', x: 11.45, y: 6.3, casas: [1, 0.5], giro: 90, opcoes: ['pinho', 'latao'], vista: 'frente' },
    { tipo: 'catre', x: 10.95, y: 8.65, casas: [1, 2], giro: 0, opcoes: ['carvalho', 'azul', 'linho'], vista: 'frente' },
    { tipo: 'bau', x: 10.95, y: 10.45, casas: [1, 0.6], giro: 0, opcoes: ['nogueira', 'ferro'], vista: 'frente' },
    // O corredor embaixo à esquerda: o tapete longo e o aparador ao longo dele.
    { tipo: 'tapeteLongo', x: 1.1, y: 9.4, casas: [1, 4], giro: 0, opcoes: ['vinho'], vista: 'frente' },
    { tipo: 'aparador', x: 2.45, y: 9.4, casas: [3, 0.5], giro: 90, opcoes: ['nogueira', 'latao'], vista: 'frente' },
    // A cozinha embaixo no meio (lote 14), encostada na parede de baixo, de frente para a sala.
    { tipo: 'geladeira', x: 5.6, y: 11.2, casas: [1, 0.75], giro: 180, opcoes: ['carvalho', 'latao'], vista: 'frente' },
    { tipo: 'fogao', x: 7.0, y: 11.1, casas: [1, 1], giro: 180, opcoes: ['ferro', 'latao'], vista: 'frente' },
    { tipo: 'pia', x: 8.4, y: 11.3, casas: [1, 0.6], giro: 180, opcoes: ['granito', 'carvalho'], vista: 'frente' },
    // O cantinho de banheiro (lote 14) na parede da esquerda, entre a entrada e o corredor, com
    // tudo de costas para a parede: a pia de lavar, a privada com a caixa na parede e o balde
    // de água ao lado dela. Depois da cozinha, para a pia da cozinha continuar a primeira (o
    // recorte de 300% da folha da pia).
    { tipo: 'pia', x: 0.4, y: 3.6, casas: [1, 0.6], giro: 270, opcoes: ['granito', 'nogueira'], vista: 'frente' },
    { tipo: 'privada', x: 0.4, y: 4.55, casas: [0.5, 0.6], giro: 270, opcoes: ['nogueira', 'latao'], vista: 'frente' },
    { tipo: 'balde', x: 0.45, y: 5.35, casas: [0.5, 0.5], giro: 0, opcoes: ['pinho', 'ferro'], vista: 'frente' },
    // A lareira (lote 15) no meio da parede de cima, de frente para a sala, entre a entrada e a
    // mesa de jantar, com a lenha empilhada ao lado (os troncos na forma Lenha, lote 16).
    { tipo: 'lareira', x: 5.75, y: 0.55, casas: [2, 1], giro: 0, opcoes: ['arenito', 'nogueira'], vista: 'frente' },
    { tipo: 'troncos', x: 3.75, y: 0.4, casas: [1.5, 0.5], giro: 0, opcoes: ['lenhaCarvalho'], vista: 'frente', forma: 'lenha' },
  ]
  // A QUARTA cena de família, a OFICINA E FAZENDA (lotes 15 e 16): 12 x 12 casas da grama
  // aprovada (o chão de terra não tem painel na mesa do Godot, comum/mesa_movel.gd), a
  // metade da esquerda uma oficina de ferreiro e a da direita um celeiro. Na oficina, a
  // fornalha no alto com a lenha empilhada do lado do fole, a bigorna no toco na frente dela,
  // o balde de água entre as duas, uma caixa e um barril; no celeiro, os fardos e o monte de
  // feno, a carroça, a pilha de toras e a cerca de um curral embaixo, com outro monte de
  // feno dentro; árvores, arbustos, pedras e o tronco caído da onda 3 nas bordas. Vale para
  // a fornalha e os móveis do lote 16 ou com --familia=oficina (a lareira usa a sala).
  const oficinaObjs: Objeto[] = [
    // O primeiro de cada tipo é o do recorte de 300% (a fornalha, a bigorna, o balde, a lenha, os fardos).
    { tipo: 'fornalha', x: 2.2, y: 2.0, casas: [1.5, 1.5], giro: 0, opcoes: ['granito', 'carvalho'], vista: 'frente' },
    { tipo: 'troncos', x: 0.65, y: 2.1, casas: [1.5, 0.5], giro: 90, opcoes: ['lenhaCarvalho'], vista: 'frente', forma: 'lenha' },
    { tipo: 'bigorna', x: 2.3, y: 4.05, casas: [1, 0.5], giro: 0, opcoes: ['ferro', 'carvalho'], vista: 'frente' },
    { tipo: 'balde', x: 3.55, y: 3.05, casas: [0.5, 0.5], giro: 0, opcoes: ['pinho', 'ferro'], vista: 'frente' },
    { tipo: 'caixa', x: 4.65, y: 1.45, casas: [0.8, 0.8], giro: 0, opcoes: ['pinho'], vista: 'frente' },
    { tipo: 'barril', x: 4.75, y: 2.65, casas: [0.7, 0.7], giro: 0, opcoes: ['carvalho', 'ferro'], vista: 'frente' },
    // O celeiro: o feno no alto, a carroça e as toras no meio, o curral embaixo, com a entrada
    // no canto (a cerca de cima começa uma casa depois da do lado, para os postes não se tocarem).
    { tipo: 'feno', x: 7.55, y: 1.5, casas: [1.5, 1], giro: 0, opcoes: [], vista: 'frente' },
    { tipo: 'feno', x: 9.35, y: 1.6, casas: [1, 1], giro: 0, opcoes: [], vista: 'frente', forma: 'monte' },
    { tipo: 'carroca', x: 7.95, y: 3.8, casas: [2, 1.25], giro: 0, opcoes: ['nogueira', 'ferro'], vista: 'frente' },
    { tipo: 'troncos', x: 10.65, y: 3.7, casas: [2, 1], giro: 0, opcoes: ['lenhaPinho'], vista: 'frente' },
    { tipo: 'cerca', x: 9.85, y: 5.75, casas: [4, 0.25], giro: 0, opcoes: ['carvalho', 'varas'], vista: 'frente' },
    { tipo: 'cerca', x: 6.9, y: 8.55, casas: [5, 0.25], giro: 90, opcoes: ['carvalho', 'varas'], vista: 'frente' },
    { tipo: 'feno', x: 9.4, y: 8.4, casas: [1, 1], giro: 0, opcoes: [], vista: 'frente', forma: 'monte' },
  ]
  const oficinaCarimbos: Carimbo[] = [
    { id: 'arvore', x: 11.05, y: 1.25, escolha: 1, giro: 0 }, { id: 'arvore-redonda', x: 1.7, y: 8.4, escolha: 1, giro: 45 },
    { id: 'arvore-redonda', x: 10.9, y: 10.7, escolha: 0.9, giro: 180 },
    { id: 'arbusto', x: 0.8, y: 6.0, escolha: 1, giro: 0 }, { id: 'arbusto', x: 5.4, y: 7.6, escolha: 0.9, giro: 135 }, { id: 'arbusto', x: 8.3, y: 10.9, escolha: 1.1, giro: 270 },
    { id: 'pedras', x: 4.5, y: 5.3, escolha: 0.8, giro: 0 }, { id: 'pedras', x: 0.9, y: 11.1, escolha: 0.7, giro: 90 },
    { id: 'tronco-caido', x: 3.7, y: 10.7, escolha: 1, giro: 0 },
  ]
  const LOTE_12 = new Set(['movel-cerca', 'movel-arco-do-portao', 'movel-poco', 'movel-carroca', 'movel-barraca'])
  const LOTES_DA_SALA = new Set(['movel-tapete', 'movel-tapete-longo', 'movel-sofa', 'movel-poltrona', 'movel-lampiao', 'movel-fogao', 'movel-geladeira', 'movel-pia', 'movel-pratos', 'movel-privada', 'movel-lareira'])
  const LOTES_DA_OFICINA = new Set(['movel-fornalha', 'movel-bigorna', 'movel-balde', 'movel-troncos', 'movel-feno'])
  const pedida = args.get('familia')
  const cena: 'clareira' | 'praca' | 'sala' | 'oficina' =
    pedida === 'clareira' || pedida === 'praca' || pedida === 'sala' || pedida === 'oficina'
      ? pedida
      : LOTE_12.has(este.p.id) ? 'praca' : LOTES_DA_SALA.has(este.p.id) ? 'sala' : LOTES_DA_OFICINA.has(este.p.id) ? 'oficina' : 'clareira'
  const CENAS = {
    clareira: { objs: familiaObjs, carimbos, chao: 'chao-familia', titulo: 'a clareira, na grama aprovada, com árvores, arbustos, pedras e o tronco caído', meio: { x: 6, y: 6.3 } },
    praca: { objs: pracaObjs, carimbos: pracaCarimbos, chao: 'chao-familia', titulo: 'a praça da vila, na grama aprovada, com o arco, a cerca, o poço e a onda 3', meio: { x: 6, y: 6.3 } },
    sala: { objs: salaObjs, carimbos: [] as Carimbo[], chao: 'chao-sala', titulo: 'a sala, no chão de sala aprovado tingido com a cor padrão do app (#a8776a)', meio: { x: 5.75, y: 4.6 } },
    oficina: { objs: oficinaObjs, carimbos: oficinaCarimbos, chao: 'chao-familia', titulo: 'a oficina de ferreiro e o celeiro, na grama aprovada, com a onda 3 nas bordas', meio: { x: 6, y: 4 } },
  }
  const escolhida = CENAS[cena]
  const famObjs = escolhida.objs
  const famCarimbos = escolhida.carimbos
  const chao100 = join(saida, `${escolhida.chao}-100.png`)
  const chao300 = join(saida, `${escolhida.chao}-300.png`)
  const FAMILIA = 12
  // O recorte de 300%: 4 x 4 casas em volta do primeiro móvel do tipo da folha na cena (ou
  // do meio da cena, se ele não está nela), sem sair das 12 x 12.
  const CASAS_PERTO = 4
  const doTipo = famObjs.find((o) => o.tipo === tipo)
  const alvo = doTipo ?? escolhida.meio
  // Os móveis ficam no ponto exato; o chão (liso) é recortado no px mais perto.
  const dentroDaCena = (v: number): number => Math.min(FAMILIA - CASAS_PERTO, Math.max(0, v - CASAS_PERTO / 2))
  const PERTO = { x0: dentroDaCena(alvo.x), y0: dentroDaCena(alvo.y), casas: CASAS_PERTO, movel: doTipo !== undefined ? tipo : null }
  if (existsSync(chao100) && existsSync(chao300)) {
    let g100 = lerPng(chao100)
    let g300 = lerPng(chao300)
    if (cena === 'sala') {
      g100 = tingirPiso(g100, CHAO)
      g300 = tingirPiso(g300, CHAO)
    }
    const perto300 = recortar(g300, Math.round(PERTO.x0 * CASA_300), Math.round(PERTO.y0 * CASA_300), CASAS_PERTO * CASA_300, CASAS_PERTO * CASA_300)
    for (const lado of lados) {
      gravarPng(join(saida, `familia-${lado}-100.png`), montar(famObjs, lado, moveis, FAMILIA, FAMILIA, CASA_100, g100, 0, 0, famCarimbos, arte), true)
      gravarPng(join(saida, `familia-${lado}-300.png`), montar(famObjs, lado, moveis, PERTO.casas, PERTO.casas, CASA_300, perto300, PERTO.x0, PERTO.y0, famCarimbos, arte), true)
    }
  }
  const md = { desenhado: menorDistancia(medidas.desenhado), atual: lados.includes('atual') ? menorDistancia(medidas.atual) : null }
  const paineis = {
    id: este.p.id,
    tipo,
    chao: '#a8776a',
    celula: cel,
    combos: combos.map((o, i) => nomeDoCombo(o, i)),
    tons: temMadeira ? madeiras.map((id) => ({ id, nome: MATERIAIS[id].nome, tom: MATERIAIS[id].tom })) : [],
    semMadeira: !temMadeira,
    medidas: {
      onde: temMadeira ? `os px do lugar de madeira (${este.p.lugares[lugarDaMadeira(tipo)]}, o canal ${lugarDaMadeira(tipo) + 1} da -partes pesado pela cobertura) do móvel sozinho a 300%; o Atual com a mesma máscara` : 'sem madeira (o móvel não tem lugar de madeira)',
      porTom: (temMadeira ? madeiras : []).map((id) => ({ id, nome: MATERIAIS[id].nome, desenhado: medidas.desenhado.find((x) => x.id === id)?.m, atual: medidas.atual.find((x) => x.id === id)?.m })),
      menorDistancia: md,
    },
    lado: este.p.vistas.lado !== undefined,
    esticar: frente.esticar !== undefined,
    familia: { cena, titulo: escolhida.titulo, casas: FAMILIA, perto: PERTO, moveis: [...moveis.keys()], carimbos: [...arte.keys()], desenhados: famObjs.filter((o) => moveis.has(o.tipo)).length, total: famObjs.length },
    atual: lados.includes('atual'),
    formas: este.p.formas.map((f) => ({ nome: f.nome, valor: f.valor, partes: f.partes })),
  }
  writeFileSync(join(saida, 'paineis.json'), JSON.stringify(paineis, null, 2))
  // Sem acento: o Godot lê a saída do node como Latin-1.
  console.log(`mesa_movel: ${este.p.id}, familia com ${paineis.familia.desenhados} de ${paineis.familia.total} moveis desenhados e ${arte.size} carimbos` + (md.desenhado.valor < Infinity ? `; menor distancia entre as madeiras: Desenhado ${md.desenhado.valor.toFixed(3)}` + (md.atual ? `, Atual ${md.atual.valor.toFixed(3)}` : '') : ''))
}

principal()
