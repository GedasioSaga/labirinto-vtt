/**
 * A MESA DA CERCA POR PEÇAS (onda 4, lote 12; CONTRATO.md 10.12). Só roda para o móvel que
 * tem `pecas` no textura.json (a cerca): comum/mesa_movel.gd chama depois do
 * ferramentas/mesa_movel.ts e põe estes painéis na folha. O Desenhado sai da conta de
 * referência (comporMovel com a geometria do app, ferramentas/movel.ts); o Atual, do motor
 * dos móveis do client da main (montarCena + pintarCena, só leitura, com a mesma volta).
 * A geometria dos dois é a mesma: geometriaDaCerca de lib/mobilia.ts.
 *
 * Uso: node ferramentas/.build/mesa_curva.mjs --textura=<exportado/movel-cerca> --saida=<paineis> [--sem-atual]
 * Grava curva-desenhado-100.png, curva-atual-100.png (a Godot reduz para 50%) e curva.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { escalaDoNivel, montarCena, type TipoComTextura } from '@cliente/texturas/meioTermo/moveis'
import { pintarCena } from '@cliente/texturas/meioTermo/moveis/motor'
import { MATERIAIS, type IdDoMaterial, type OpcaoDeMaterial } from '@cliente/texturas/meioTermo/materiais'
import { geometriaDaCerca } from '@cliente/lib/mobilia'
import { rgb } from '@cliente/texturas/ruido'
import { gravarPng, lerPng, type Imagem } from './png'
import { comporMovel, type Camada, type GeometriaDaCercaEmCasas, type MovelCarregado, type ParamsDoMovel, type Rgb } from './movel'

/** O chão padrão das salas do app (o mesmo da mesa dos móveis). */
const CHAO: Rgb = rgb('#a8776a')
const SOMBRA_COR: Rgb = rgb('#0a1c28')
const CASA = 64
/** A geometria do app trabalha em px do mundo; 64 por casa, como o mapa. */
const PX_DO_MUNDO = 64
const ESPESSURA = 0.25

interface Objeto {
  readonly rotulo: string
  readonly x: number
  readonly y: number
  readonly comprimento: number
  readonly giro: number
  readonly volta: number
  readonly opcoes: readonly OpcaoDeMaterial[]
}

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '1' : a.slice(i + 1))
  }
  return m
}

function carregar(pasta: string): MovelCarregado {
  const p = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as ParamsDoMovel
  const imagens = new Map<string, Imagem>()
  for (const f of p.formas) for (const nome of [f.valor, f.partes, f.cor]) if (nome !== undefined) imagens.set(nome, lerPng(join(pasta, nome)))
  return { p, imagens }
}

/** A geometria do app, em casas (o app mede em px do mundo). */
function geometria(o: Objeto): GeometriaDaCercaEmCasas {
  const g = geometriaDaCerca(o.comprimento * PX_DO_MUNDO, ESPESSURA * PX_DO_MUNDO, o.volta)
  if (g === null) throw new Error(`cerca de ${o.comprimento} casas não tem geometria`)
  const k = 1 / PX_DO_MUNDO
  return {
    mouroes: g.mouroes.map((q) => ({ x: q.x * k, y: q.y * k })),
    raio: g.raio * k,
    arco: g.arco === null ? null : { center: { x: g.arco.center.x * k, y: g.arco.center.y * k }, radius: g.arco.radius * k, startAngle: g.arco.startAngle, sweep: g.arco.sweep },
  }
}

function tom(opcoes: readonly OpcaoDeMaterial[], i: number): Rgb {
  const o = opcoes[i]
  if (o === 'varas' || o === 'mesma') return rgb(MATERIAIS[opcoes[0] as IdDoMaterial].tom)
  return rgb(MATERIAIS[o as IdDoMaterial].tom)
}

// ---------- a tela (RGBA pré-multiplicado) ----------

interface Tela {
  readonly w: number
  readonly h: number
  readonly px: Float32Array
  readonly sombra: Float32Array
}

function novaTela(w: number, h: number): Tela {
  const px = new Float32Array(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = CHAO[k]
    px[i * 4 + 3] = 255
  }
  return { w, h, px, sombra: new Float32Array(w * h) }
}

/** Bilinear de uma camada pré-multiplicada; fora é transparente. */
function amostra(c: Camada, u: number, v: number, s: number[]): void {
  const fu = u - 0.5
  const fv = v - 0.5
  const iu = Math.floor(fu)
  const iv = Math.floor(fv)
  const tu = fu - iu
  const tv = fv - iv
  for (let k = 0; k < 4; k += 1) s[k] = 0
  for (const [dx, dy, p] of [[0, 0, (1 - tu) * (1 - tv)], [1, 0, tu * (1 - tv)], [0, 1, (1 - tu) * tv], [1, 1, tu * tv]] as const) {
    const x = iu + dx
    const y = iv + dy
    if (x < 0 || y < 0 || x >= c.w || y >= c.h || p === 0) continue
    const o = (y * c.w + x) * 4
    for (let k = 0; k < 4; k += 1) s[k] += c.px[o + k] * p
  }
}

/** Põe a camada com o ponto (cx, cy) dela em (X, Y) da tela, escalada f e girada giro graus. */
function pousar(t: Tela, c: Camada, cx: number, cy: number, X: number, Y: number, f: number, giro: number, soAlfa = false): void {
  const r = (giro * Math.PI) / 180
  const co = Math.cos(r)
  const si = Math.sin(r)
  const raio = (Math.hypot(c.w, c.h) * f) / 2 + Math.hypot(c.w / 2 - cx, c.h / 2 - cy) * f + 2
  const s = [0, 0, 0, 0]
  for (let y = Math.max(0, Math.floor(Y - raio)); y < Math.min(t.h, Math.ceil(Y + raio)); y += 1) {
    for (let x = Math.max(0, Math.floor(X - raio)); x < Math.min(t.w, Math.ceil(X + raio)); x += 1) {
      const dx = (x + 0.5 - X) / f
      const dy = (y + 0.5 - Y) / f
      const u = cx + dx * co + dy * si
      const v = cy - dx * si + dy * co
      if (u < -1 || v < -1 || u > c.w + 1 || v > c.h + 1) continue
      amostra(c, u, v, s)
      const o = y * t.w + x
      const a = s[3] / 255
      if (soAlfa) {
        if (a > 0) t.sombra[o] = t.sombra[o] + a * (1 - t.sombra[o])
        continue
      }
      if (a <= 0) continue
      for (let k = 0; k < 3; k += 1) t.px[o * 4 + k] = s[k] + t.px[o * 4 + k] * (1 - a)
    }
  }
}

function emImagem(t: Tela): Imagem {
  const px = new Uint8ClampedArray(t.w * t.h * 4)
  for (let i = 0; i < t.w * t.h; i += 1) {
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = Math.round(t.px[i * 4 + k])
    px[i * 4 + 3] = 255
  }
  return { w: t.w, h: t.h, px }
}

function pintarSombra(t: Tela, alfa: number): void {
  for (let i = 0; i < t.w * t.h; i += 1) {
    const s = t.sombra[i] * alfa
    if (s <= 0) continue
    for (let k = 0; k < 3; k += 1) t.px[i * 4 + k] = t.px[i * 4 + k] * (1 - s) + SOMBRA_COR[k] * s
    t.sombra[i] = 0
  }
}

// ---------- os dois lados ----------

function painelDesenhado(m: MovelCarregado, objs: readonly Objeto[], w: number, h: number): Imagem {
  const t = novaTela(Math.round(w * CASA), Math.round(h * CASA))
  const comps = objs.map((o) => {
    const tons = o.opcoes.map((_x, i) => tom(o.opcoes, i))
    return { o, c: comporMovel(m, { vista: 'frente', opcoes: o.opcoes, tons, casasW: o.comprimento, casasH: ESPESSURA, giro: o.giro, cerca: geometria(o) }, CASA) }
  })
  // A sombra de todos numa camada só (CONTRATO 9.4), depois os corpos.
  for (const { o, c } of comps) {
    if (c.sombra === null) continue
    const alfa = m.p.sombra.alfa
    const sb = c.sombra
    const silhueta: Camada = { w: c.corpo.w, h: c.corpo.h, px: new Float32Array(c.corpo.w * c.corpo.h * 4).map((_v, i) => (i % 4 === 3 ? (sb[i >> 2] / alfa) * 255 : 0)) }
    pousar(t, silhueta, c.cx, c.cy, o.x * CASA, o.y * CASA, 1, c.resto, true)
  }
  pintarSombra(t, m.p.sombra.alfa)
  for (const { o, c } of comps) pousar(t, c.corpo, c.cx, c.cy, o.x * CASA, o.y * CASA, 1, c.resto)
  return emImagem(t)
}

function painelAtual(objs: readonly Objeto[], w: number, h: number): Imagem {
  const t = novaTela(Math.round(w * CASA), Math.round(h * CASA))
  const S = escalaDoNivel(1)
  objs.forEach((o, i) => {
    const cena = montarCena({ tipo: 'cerca' as TipoComTextura, lado: 'frente', materiais: o.opcoes, casasW: o.comprimento, casasH: ESPESSURA, semente: 101 + 17 * i, curva: o.volta })
    const { limites, pixels } = pintarCena(cena, S)
    const px = new Float32Array(limites.W * limites.H * 4)
    for (let k = 0; k < limites.W * limites.H; k += 1) {
      const a = pixels[k * 4 + 3] / 255
      for (let q = 0; q < 3; q += 1) px[k * 4 + q] = pixels[k * 4 + q] * a
      px[k * 4 + 3] = pixels[k * 4 + 3]
    }
    const pxPorCasa = S * 56
    pousar(t, { w: limites.W, h: limites.H, px }, -limites.x0 * S, -limites.y0 * S, o.x * CASA, o.y * CASA, CASA / pxPorCasa, o.giro)
  })
  return emImagem(t)
}

// ---------- principal ----------

function principal(): void {
  const args = argumentos()
  const pasta = args.get('textura')
  const saida = args.get('saida')
  if (pasta === undefined || saida === undefined) {
    console.error('uso: --textura=<exportado/movel-cerca> --saida=<paineis> [--sem-atual]')
    process.exit(2)
  }
  const m = carregar(pasta)
  if (m.p.pecas === undefined) {
    console.log(`mesa_curva: ${m.p.id} nao tem pecas; nada a fazer`)
    return
  }
  // As retas de 2, 4 e 8 casas (e a de 4 em pé), o quarto de círculo, o S (duas de volta
  // 90 e -90 emendadas no mourão) e a meia volta, nas 3 ligações.
  const V = (m2: IdDoMaterial, lig: OpcaoDeMaterial): OpcaoDeMaterial[] => [m2, lig]
  const vao3 = 3 - 2 * 0.45 * ESPESSURA
  const objs: Objeto[] = [
    { rotulo: 'reta de 8, varas', x: 4.6, y: 0.8, comprimento: 8, giro: 0, volta: 0, opcoes: V('carvalho', 'varas') },
    { rotulo: 'reta de 4, corda', x: 2.6, y: 1.9, comprimento: 4, giro: 0, volta: 0, opcoes: V('nogueira', 'corda') },
    { rotulo: 'reta de 2, arame', x: 6.6, y: 1.9, comprimento: 2, giro: 0, volta: 0, opcoes: V('pinho', 'arame') },
    { rotulo: 'reta de 4 em pe, varas', x: 11.0, y: 2.6, comprimento: 4, giro: 90, volta: 0, opcoes: V('carvalho', 'varas') },
    { rotulo: 'quarto de circulo (4 casas, volta 90), varas', x: 2.6, y: 3.0, comprimento: 4, giro: 0, volta: 90, opcoes: V('carvalho', 'varas') },
    { rotulo: 'S (3 + 3 casas, volta 90 e -90), corda', x: 5.9, y: 3.6, comprimento: 3, giro: 0, volta: 90, opcoes: V('nogueira', 'corda') },
    { rotulo: 'S, a segunda', x: 5.9 + vao3, y: 3.6, comprimento: 3, giro: 0, volta: -90, opcoes: V('nogueira', 'corda') },
    { rotulo: 'quarto de circulo para cima (3 casas, volta -90), arame', x: 2.2, y: 6.3, comprimento: 3, giro: 0, volta: -90, opcoes: V('pinho', 'arame') },
    { rotulo: 'meia volta (3 casas, volta 180), varas', x: 6.4, y: 5.3, comprimento: 3, giro: 0, volta: 180, opcoes: V('cerejeira', 'varas') },
    { rotulo: 'quarto de circulo girado 45 graus, arame', x: 9.9, y: 5.6, comprimento: 3, giro: 45, volta: 90, opcoes: V('pinho', 'arame') },
  ]
  const W = 11.6
  const H = 7.2
  gravarPng(join(saida, 'curva-desenhado-100.png'), painelDesenhado(m, objs, W, H), true)
  const semAtual = args.has('sem-atual')
  if (!semAtual) gravarPng(join(saida, 'curva-atual-100.png'), painelAtual(objs, W, H), true)
  const mouroes = objs.map((o) => geometria(o).mouroes.length)
  writeFileSync(join(saida, 'curva.json'), JSON.stringify({ casas: [W, H], atual: !semAtual, objetos: objs.map((o, i) => ({ ...o, mouroes: mouroes[i] })) }, null, 2))
  console.log(`mesa_curva: ${m.p.id}, ${objs.length} cercas (${mouroes.join(', ')} mouroes)`)
}

principal()
