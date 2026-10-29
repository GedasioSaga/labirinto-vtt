/**
 * A MESA DE PROVA DOS MÓVEIS (onda 4, CONTRATO.md seção 10): monta móveis REAIS
 * com o motor dos móveis do app (montarCena + pintarCena do client da main, só
 * leitura, empacotado por ferramentas/construir.mjs) e troca só a superfície da
 * classe do material pela do Desenhado (ferramentas/material.ts). O Atual é o
 * mesmo motor sem a troca. Grava os painéis a 100% (64 px por casa, a imagem do
 * nível 1 do app, 50 px por casa, esticada como a tela estica) e os closes a
 * 300% (192 px por casa, nível 3); a mesa do Godot (comum/mesa_material.gd)
 * arruma a folha e reduz para 50% e 25%.
 *
 * Uso: node ferramentas/.build/moveis.mjs --textura=<exportado/<id>> --saida=<paineis> [--sem-atual]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { escalaDoNivel, montarCena, type DesenhoDoMovel, type TipoComTextura } from '@cliente/texturas/meioTermo/moveis'
import * as motor from '@cliente/texturas/meioTermo/moveis/motor'
import type { Cena, ClasseDaPeca, Textura } from '@cliente/texturas/meioTermo/moveis/motor'
import { materialDaPeca } from '@cliente/texturas/meioTermo/moveis/contexto'
import { caixa } from '@cliente/texturas/meioTermo/moveis/formas'
import { LUGARES_DE_MATERIAL, MATERIAIS, oklabDoRgb, type IdDoMaterial } from '@cliente/texturas/meioTermo/materiais'
import { FICHAS_DAS_PECAS_NOVAS, type PecaNova } from '@cliente/lib/mobilia/pecasNovas'
import { rgb, type Rgb } from '@cliente/texturas/ruido'
import { gravarPng, lerPng, type Imagem } from './png'
import { G, niveisDe, TEXEL_POR_PROTO, texturaDoMaterial, type ImagemDoMaterial, type MaterialCarregado, type Tingir } from './material'

const { criarPecas, pintarCena } = motor

/**
 * Troca a função de textura de uma classe na tabela TEXTURA do motor. Existe só no
 * pacote: construir.mjs acrescenta ao motor.ts lido (o client fica intocado), por isso
 * o tipo é declarado aqui.
 */
type TrocarTextura = (classe: ClasseDaPeca, t: Textura | null) => Textura | null
const trocaDoPacote = (motor as unknown as { __trocarTexturaDaClasse?: TrocarTextura }).__trocarTexturaDaClasse
if (trocaDoPacote === undefined) throw new Error('rode pelo ferramentas/construir.mjs: o motor sem a troca da superfície')
const __trocarTexturaDaClasse: TrocarTextura = trocaDoPacote

/** O chão padrão das salas do app (contexto.ts, L_DO_CHAO_PADRAO 0,615). */
const CHAO: Rgb = rgb('#a8776a')
const CASA_100 = 64
const CASA_300 = 192
const NIVEL_100 = 1
const NIVEL_300 = 3

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '1' : a.slice(i + 1))
  }
  return m
}

// ---------- o material exportado ----------

interface ParametrosLidos {
  readonly classe: ClasseDaPeca
  readonly imagens: readonly { readonly nome: string; readonly arquivo: string }[]
  readonly tingir: Tingir
}

function carregar(pasta: string): { m: MaterialCarregado; cruas: { nome: string; img: Imagem }[] } {
  const t = JSON.parse(readFileSync(join(pasta, 'textura.json'), 'utf8')) as ParametrosLidos
  const cruas = t.imagens.map(({ nome, arquivo }) => ({ nome, img: lerPng(join(pasta, arquivo)) }))
  const imagens: ImagemDoMaterial[] = cruas.map(({ nome, img }) => {
    const v = new Float32Array(img.w * img.h)
    for (let i = 0; i < v.length; i += 1) v[i] = img.px[i * 4] / 255
    return { nome, niveis: niveisDe(img.w, img.h, v) }
  })
  const n0 = imagens[0].niveis[0]
  return { m: { classe: t.classe, imagens, tingir: t.tingir, periodoProto: [n0.w / TEXEL_POR_PROTO, n0.h / TEXEL_POR_PROTO] }, cruas }
}

// ---------- as cenas ----------

/** Um móvel posto na cena: centro (x, y) e pegada em casas. */
interface Posto {
  readonly tipo: TipoComTextura
  readonly casas: readonly [number, number]
  readonly x: number
  readonly y: number
  readonly lado?: 'frente' | 'lado'
  readonly curva?: number
  readonly vista?: 'tres-quartos'
  readonly variante?: number
}

/** O tamanho de partida de uma peça nova, lido da ficha do app (a forma de partida, nos troncos e no feno). */
function tamanhoDaFicha(tipo: PecaNova): readonly [number, number] {
  const { largura, altura } = FICHAS_DAS_PECAS_NOVAS[tipo].tamanho
  return [largura, altura]
}

/** Tamanho padrão (frente) de cada tipo, em casas (lib/mobilia.ts e lib/mobilia/pecasNovas.ts). */
const TAMANHO: Readonly<Record<TipoComTextura, readonly [number, number]>> = {
  barril: [0.7, 0.7], caixa: [0.8, 0.8], bau: [1, 0.6], catre: [1, 2], mesa: [2, 1], cadeira: [0.5, 0.5],
  cerca: [2, 0.25], armario: [1, 0.5], aparador: [2, 0.5], fogueira: [1, 1], tapete: [3, 2],
  mesaQuadrada: [1, 1], mesaRedonda: [1.25, 1.25], lapide: [0.6, 0.35], vaso: [0.5, 0.5], lampiao: [0.5, 0.5],
  quadroDeAvisos: [1, 0.4], poco: [1.5, 1.5], barraca: [2, 2], carroca: [2, 1.25], sebe: [2, 0.5],
  jardineira: [1, 0.5], arcoDoPortao: [2, 0.5], placaDeSeta: [0.5, 0.5], tapeteLongo: [1, 4], fogo: [1, 1],
  fogao: [1, 1], geladeira: [1, 0.75], pia: [1, 0.6], balcao: [2, 0.6], pratos: [0.5, 0.5], privada: [0.5, 0.6],
  sofa: [2, 1], poltrona: [1, 1],
  // Os 6 de 29/10 (commits b2a03426 e 17cc4871 da main), pela ficha do app.
  lareira: tamanhoDaFicha('lareira'), fornalha: tamanhoDaFicha('fornalha'), bigorna: tamanhoDaFicha('bigorna'),
  balde: tamanhoDaFicha('balde'), troncos: tamanhoDaFicha('troncos'), feno: tamanhoDaFicha('feno'),
}

const CENA_CASAS: readonly [number, number] = [16, 10]
const TONS_CASAS: readonly [number, number] = [16, 3.2]
const TRESQ_CASAS: readonly [number, number] = [16, 3.6]
/** O close a 300%: 3 x 3 casas a partir deste canto (em casas). */
const PERTO = { x0: 2.7, y0: 0.6, casas: 3 }

function p(tipo: TipoComTextura, x: number, y: number, o: Partial<Posto> = {}): Posto {
  return { tipo, casas: o.casas ?? TAMANHO[tipo], x, y, ...o }
}

/** A sala da madeira: a mesa com cadeiras, as mesas, o catre, o baú, a caixa, o barril, os esticados e as cercas. */
const SALA_DA_MADEIRA: readonly Posto[] = [
  p('cadeira', 3.1, 0.62), p('cadeira', 4.1, 0.62),
  p('mesa', 3.6, 1.55),
  p('cadeira', 3.1, 2.45), p('cadeira', 4.1, 2.45),
  p('barril', 5.3, 2.75),
  p('mesaRedonda', 7.4, 1.6), p('cadeira', 7.4, 2.75),
  p('mesaQuadrada', 9.6, 1.6),
  p('catre', 11.5, 1.9),
  p('bau', 13.3, 1.1), p('bau', 13.3, 2.35, { lado: 'lado', casas: [0.6, 0.6] }),
  p('caixa', 14.9, 1.1), p('caixa', 14.9, 2.3),
  p('barril', 1.3, 1.2), p('barril', 1.5, 2.3),
  p('aparador', 3.6, 4.3, { casas: [6, 0.5] }),
  p('aparador', 9.0, 4.3),
  p('armario', 11.3, 4.3), p('armario', 12.8, 4.55, { lado: 'lado', casas: [1, 1.5] }),
  p('quadroDeAvisos', 14.6, 4.2),
  p('balcao', 3.1, 6.4, { casas: [5, 0.6] }),
  p('geladeira', 6.5, 6.4),
  p('carroca', 9.0, 6.6),
  p('jardineira', 11.3, 6.4), p('placaDeSeta', 12.5, 6.4), p('privada', 13.5, 6.4),
  p('cerca', 1.6, 8.6), p('cerca', 3.6, 8.6), p('cerca', 5.6, 8.6),
  p('cerca', 8.6, 8.4, { curva: 90 }),
  p('arcoDoPortao', 12.4, 8.6),
]

/** Um grupo pequeno de cada tom, lado a lado (as 5 madeiras). */
function grupoDosTons(i: number): Posto[] {
  const x0 = i * 3.2
  return [
    p('mesa', x0 + 1.25, 0.85), p('cadeira', x0 + 1.0, 1.75),
    p('barril', x0 + 2.75, 0.6), p('bau', x0 + 2.55, 1.65),
    p('aparador', x0 + 1.55, 2.7),
  ]
}

const TRES_QUARTOS_DA_MADEIRA: readonly Posto[] = [
  p('cadeira', 1.0, 2.4, { vista: 'tres-quartos' }), p('cadeira', 2.0, 2.4, { vista: 'tres-quartos' }),
  p('mesa', 1.6, 1.9, { vista: 'tres-quartos' }),
  p('bau', 4.2, 2.4, { vista: 'tres-quartos' }),
  p('armario', 6.0, 2.5, { vista: 'tres-quartos' }),
  p('aparador', 8.6, 2.5, { vista: 'tres-quartos', casas: [3, 0.5] }),
  p('barril', 10.8, 2.5, { vista: 'tres-quartos' }),
  p('caixa', 12.0, 2.5, { vista: 'tres-quartos' }),
  p('catre', 14.6, 2.0, { vista: 'tres-quartos', casas: [2, 1] }),
]

/** Nas outras classes, a faixa dos tons: os 2 primeiros móveis da galeria, um sobre o outro, na coluna do tom. */
function grupoDaGaleria(da: readonly Posto[], i: number): Posto[] {
  const x0 = i * 3.2
  return da.slice(0, 2).map((q, j) => {
    const k = Math.min(1, 2.8 / q.casas[0], 1.4 / q.casas[1])
    return { ...q, x: x0 + 1.6, y: 0.85 + j * 1.55, casas: [q.casas[0] * k, q.casas[1] * k] as const }
  })
}

/** Para as outras classes: todos os tipos que têm um lugar desta classe, em grade (5 por linha). */
function galeria(classe: ClasseDaPeca): Posto[] {
  const tipos = (Object.keys(LUGARES_DE_MATERIAL) as TipoComTextura[]).filter((t) =>
    LUGARES_DE_MATERIAL[t].some((l) => l.opcoes.some((o) => o in MATERIAIS && MATERIAIS[o as IdDoMaterial].classe === classe)),
  )
  return tipos.slice(0, 20).map((t, i) => {
    const [w, h] = TAMANHO[t]
    const k = Math.min(1, 2.6 / w, 2.2 / h)
    return p(t, 1.6 + (i % 5) * 3.2, 1.3 + Math.floor(i / 5) * 2.5, { casas: [w * k, h * k] })
  })
}

function desenhoDe(posto: Posto, tom: IdDoMaterial, semente: number): DesenhoDoMovel {
  const lugares = LUGARES_DE_MATERIAL[posto.tipo]
  const materiais = lugares.map((l) => (l.opcoes.includes(tom) ? tom : l.padrao))
  return {
    tipo: posto.tipo, lado: posto.lado ?? 'frente', materiais, casasW: posto.casas[0], casasH: posto.casas[1], semente,
    ...(posto.curva !== undefined ? { curva: posto.curva } : {}),
    ...(posto.vista !== undefined ? { vista: posto.vista } : {}),
    ...(posto.variante !== undefined ? { variante: posto.variante } : {}),
  }
}

// ---------- a tela ----------

interface Tela {
  readonly w: number
  readonly h: number
  /** RGBA pré-multiplicado, 0..255. */
  readonly px: Float32Array
}

function novaTela(w: number, h: number): Tela {
  const px = new Float32Array(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    px[i * 4] = CHAO[0]
    px[i * 4 + 1] = CHAO[1]
    px[i * 4 + 2] = CHAO[2]
    px[i * 4 + 3] = 255
  }
  return { w, h, px }
}

/**
 * Põe o móvel pintado (RGBA de cor pura, como pintarCena devolve) por cima da
 * tela: o centro em (cx, cy) casas, a tela começando em (ox, oy) casas, com
 * `casa` px por casa; amostra bilinear pré-multiplicada (o que a placa faz).
 */
function porCima(tela: Tela, d: DesenhoDoMovel, nivel: number, cx: number, cy: number, ox: number, oy: number, casa: number): void {
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarCena(montarCena(d), S)
  const f = casa / (S * G)
  const esq = (cx - ox) * casa + (limites.x0 / G) * casa
  const topo = (cy - oy) * casa + (limites.y0 / G) * casa
  const X0 = Math.max(0, Math.floor(esq))
  const Y0 = Math.max(0, Math.floor(topo))
  const X1 = Math.min(tela.w, Math.ceil(esq + limites.W * f))
  const Y1 = Math.min(tela.h, Math.ceil(topo + limites.H * f))
  const { W, H } = limites
  const ler = (ix: number, iy: number, k: number): number => {
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return 0
    const o = (iy * W + ix) * 4
    const a = pixels[o + 3] / 255
    return k === 3 ? a * 255 : pixels[o + k] * a
  }
  for (let Y = Y0; Y < Y1; Y += 1) {
    for (let X = X0; X < X1; X += 1) {
      const fx = (X + 0.5 - esq) / f - 0.5
      const fy = (Y + 0.5 - topo) / f - 0.5
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      const tx = fx - ix
      const ty = fy - iy
      const o = (Y * tela.w + X) * 4
      const c = [0, 0, 0, 0]
      for (let k = 0; k < 4; k += 1) {
        const a = ler(ix, iy, k)
        const b = ler(ix + 1, iy, k)
        const cc = ler(ix, iy + 1, k)
        const dd = ler(ix + 1, iy + 1, k)
        c[k] = a + (b - a) * tx + (cc - a) * ty + (a - b - cc + dd) * tx * ty
      }
      const resta = 1 - c[3] / 255
      if (c[3] <= 0) continue
      for (let k = 0; k < 4; k += 1) tela.px[o + k] = c[k] + tela.px[o + k] * resta
    }
  }
}

function emImagem(t: Tela): Imagem {
  const px = new Uint8ClampedArray(t.w * t.h * 4)
  for (let i = 0; i < t.w * t.h; i += 1) {
    const a = t.px[i * 4 + 3] / 255
    for (let k = 0; k < 3; k += 1) px[i * 4 + k] = a > 0 ? Math.round(t.px[i * 4 + k] / a) : 0
    px[i * 4 + 3] = 255
  }
  return { w: t.w, h: t.h, px }
}

/** Ordem de pintura: a base mais embaixo por último (como emOrdemDoTresQuartos). */
function emOrdem(postos: readonly Posto[]): Posto[] {
  return [...postos].sort((a, b) => a.y + a.casas[1] / 2 - (b.y + b.casas[1] / 2))
}

function montar(postos: readonly Posto[], tom: IdDoMaterial, casasW: number, casasH: number, casa: number, nivel: number, ox = 0, oy = 0): Imagem {
  const tela = novaTela(Math.round(casasW * casa), Math.round(casasH * casa))
  emOrdem(postos).forEach((posto) => {
    const semente = 101 + postos.indexOf(posto) * 17
    const [w, h] = posto.casas
    if (posto.x + w < ox - 1 || posto.x - w > ox + casasW + 1 || posto.y + h < oy - 1 || posto.y - h > oy + casasH + 1) return
    porCima(tela, desenhoDe(posto, tom, semente), nivel, posto.x, posto.y, ox, oy, casa)
  })
  return emImagem(tela)
}

// ---------- medidas ----------

interface Medida {
  readonly L: number
  readonly a: number
  readonly b: number
  /** Desvio da luz OKLab dentro da peça: quanto a superfície varia. */
  readonly dpL: number
}

/**
 * A cor média (OKLab) e o desvio da luz no MIOLO do tampo da mesa sozinha (o
 * meio da pegada, 70% x 50%: sem o chanfro, as pernas e a borda clara), a 300%
 * (nível 3): o que a superfície dá, com as frestas das tábuas.
 */
function medirMesa(tom: IdDoMaterial): Medida {
  const [w, h] = TAMANHO.mesa
  return medirCena(montarCena(desenhoDe(p('mesa', 0, 0), tom, 101)), 0.35 * w * G, 0.25 * h * G)
}

/**
 * Nas outras classes: uma amostra de 2 x 1 casa só do material (u ao longo de x,
 * sem chanfro nem contorno), medida no mesmo miolo de 70% x 50%, a 300%.
 */
function medirAmostra(tom: IdDoMaterial): Medida {
  const peca = criarPecas(101)
  const cena: Cena = { partes: [peca(caixa(-G, -G / 2, G, G / 2), materialDaPeca(tom), { bisel: 0, contorno: 0 })], sombras: [] }
  return medirCena(cena, 0.7 * G, 0.25 * G)
}

function medirCena(cena: Cena, meiaX: number, meiaY: number): Medida {
  const S = escalaDoNivel(NIVEL_300)
  const { limites, pixels } = pintarCena(cena, S)
  let n = 0
  let sL = 0
  let sa = 0
  let sb = 0
  let sLL = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const px = (i / 4) % limites.W
    const py = Math.floor(i / 4 / limites.W)
    const x = limites.x0 + (px + 0.5) / S
    const y = limites.y0 + (py + 0.5) / S
    if (Math.abs(x) > meiaX || Math.abs(y) > meiaY || pixels[i + 3] < 255) continue
    const [L, a, b] = oklabDoRgb(pixels[i], pixels[i + 1], pixels[i + 2])
    n += 1
    sL += L
    sa += a
    sb += b
    sLL += L * L
  }
  const L = sL / n
  return { L, a: sa / n, b: sb / n, dpL: Math.sqrt(Math.max(0, sLL / n - L * L)) }
}

function menorDistancia(medidas: readonly { id: string; m: Medida }[]): { valor: number; par: string } {
  let melhor = { valor: Infinity, par: '' }
  for (let i = 0; i < medidas.length; i += 1) {
    for (let j = i + 1; j < medidas.length; j += 1) {
      const a = medidas[i].m
      const b = medidas[j].m
      const d = Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b)
      if (d < melhor.valor) melhor = { valor: d, par: `${medidas[i].id} x ${medidas[j].id}` }
    }
  }
  return melhor
}

// ---------- os arquivos ----------

/** A imagem repetida 2 x 2, reduzida à metade (média de 2 x 2): a emenda no meio. */
function repetida2x2(img: Imagem): Imagem {
  const { w, h } = img
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let s = 0
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const X = (2 * x + dx) % w
        const Y = (2 * y + dy) % h
        s += img.px[(Y * w + X) * 4]
      }
      const o = (y * w + x) * 4
      px[o] = px[o + 1] = px[o + 2] = s / 4
      px[o + 3] = 255
    }
  }
  return { w, h, px }
}

// ---------- principal ----------

function principal(): void {
  const args = argumentos()
  const pasta = args.get('textura')
  const saida = args.get('saida')
  if (pasta === undefined || saida === undefined) {
    console.error('uso: --textura=<exportado/<id>> --saida=<pasta> [--sem-atual]')
    process.exit(2)
  }
  mkdirSync(saida, { recursive: true })
  const { m, cruas } = carregar(pasta)
  const classe = m.classe
  const tons = (Object.keys(MATERIAIS) as IdDoMaterial[]).filter((id) => MATERIAIS[id].classe === classe)
  const tresTons = classe === 'madeira' ? (['carvalho', 'nogueira', 'pinho'] as IdDoMaterial[]) : tons.slice(0, 3)
  const cena = classe === 'madeira' ? SALA_DA_MADEIRA : galeria(classe)
  const tresQuartos = classe === 'madeira' ? TRES_QUARTOS_DA_MADEIRA : galeria(classe).slice(0, 5).map((q, i) => ({ ...q, x: 1.6 + i * 3.2, y: 2, vista: 'tres-quartos' as const }))
  const daClasse = classe === 'madeira' ? [] : galeria(classe)
  const gruposDosTons = tons.slice(0, 5).map((_t, i) => (classe === 'madeira' ? grupoDosTons(i) : grupoDaGaleria(daClasse, i)))
  const medir = classe === 'madeira' ? medirMesa : medirAmostra
  const onde = classe === 'madeira'
    ? 'o miolo do tampo da mesa sozinha (70% x 50% da pegada, a 300%)'
    : 'uma amostra de 2 x 1 casa só do material, sem chanfro (o miolo de 70% x 50%, a 300%)'
  const semAtual = args.has('sem-atual')
  const desenhada = texturaDoMaterial(m)
  const lados: { nome: 'desenhado' | 'atual'; tex: Textura | null }[] = [{ nome: 'desenhado', tex: desenhada }]
  const original = __trocarTexturaDaClasse(classe, desenhada)
  __trocarTexturaDaClasse(classe, original)
  if (!semAtual) lados.push({ nome: 'atual', tex: original })
  const medidas: Record<string, { id: string; m: Medida }[]> = { desenhado: [], atual: [] }
  for (const lado of lados) {
    __trocarTexturaDaClasse(classe, lado.tex)
    tresTons.forEach((tom, k) => {
      gravarPng(join(saida, `cena-${k}-${lado.nome}.png`), montar(cena, tom, CENA_CASAS[0], CENA_CASAS[1], CASA_100, NIVEL_100), true)
      gravarPng(join(saida, `perto-${k}-${lado.nome}.png`), montar(cena, tom, PERTO.casas, PERTO.casas, CASA_300, NIVEL_300, PERTO.x0, PERTO.y0), true)
    })
    // As 5 madeiras: o mesmo grupo em cada tom (cada grupo com o seu).
    const telaTons = novaTela(Math.round(TONS_CASAS[0] * CASA_100), Math.round(TONS_CASAS[1] * CASA_100))
    tons.slice(0, 5).forEach((tom, i) => {
      emOrdem(gruposDosTons[i]).forEach((posto, j) => porCima(telaTons, desenhoDe(posto, tom, 301 + 17 * j), NIVEL_100, posto.x, posto.y, 0, 0, CASA_100))
      medidas[lado.nome].push({ id: tom, m: medir(tom) })
    })
    gravarPng(join(saida, `tons-${lado.nome}.png`), emImagem(telaTons), true)
    gravarPng(join(saida, `tresq-${lado.nome}.png`), montar(tresQuartos, tresTons[0], TRESQ_CASAS[0], TRESQ_CASAS[1], CASA_100, NIVEL_100), true)
  }
  __trocarTexturaDaClasse(classe, original)
  const arquivos: string[] = []
  for (const { nome, img } of cruas) {
    gravarPng(join(saida, `arquivo-${nome}.png`), img, true)
    gravarPng(join(saida, `arquivo-${nome}-2x2.png`), repetida2x2(img), true)
    arquivos.push(`arquivo-${nome}.png`, `arquivo-${nome}-2x2.png`)
  }
  const nomes = (id: string): string => MATERIAIS[id as IdDoMaterial].nome
  const paineis = {
    classe,
    cliente: 'o client da main (empacotado só para leitura)',
    chao: '#a8776a',
    tresTons: tresTons.map((id) => ({ id, nome: nomes(id), hex: MATERIAIS[id].hex, tom: MATERIAIS[id].tom })),
    tons: tons.slice(0, 5).map((id) => ({ id, nome: nomes(id), tom: MATERIAIS[id].tom })),
    cena: { casas: CENA_CASAS, perto: PERTO, moveis: cena.length, tipos: [...new Set(cena.map((q) => q.tipo))] },
    medidas: {
      onde,
      porTom: tons.slice(0, 5).map((id, i) => ({ id, nome: nomes(id), desenhado: medidas.desenhado[i]?.m, atual: medidas.atual[i]?.m })),
      menorDistancia: { desenhado: menorDistancia(medidas.desenhado), atual: semAtual ? null : menorDistancia(medidas.atual) },
    },
    atual: !semAtual,
    arquivos,
  }
  writeFileSync(join(saida, 'paineis.json'), JSON.stringify(paineis, null, 2))
  const md = paineis.medidas.menorDistancia
  // Sem acento: o Godot lê a saída do node como Latin-1 e a imprime embaralhada.
  console.log(`moveis: ${cena.length} moveis, ${tresTons.length} tons; menor distancia OKLab entre os tons: Desenhado ${md.desenhado.valor.toFixed(3)} (${md.desenhado.par})` + (md.atual ? `, Atual ${md.atual.valor.toFixed(3)} (${md.atual.par})` : ''))
}

principal()
