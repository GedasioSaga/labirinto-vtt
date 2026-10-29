import { FORNALHA, LAREIRA } from '../../lib/mobilia/fogoDeCasa'
import { BRASA_QUENTE } from '../meioTermo/moveis/fogueira'
import { ehMaterial, MATERIAIS, type OpcaoDeMaterial } from '../meioTermo/materiais'
import { abrirFonteDoDesenhado, ehIdDoDesenhado, type IdDoDesenhado } from './fonte'
import {
  CacheDosTingidos,
  lerParamsDoMovel,
  pintarMovel,
  rgbDoHex,
  sombraDoCorpo,
  vistaUsada,
  type Camada,
  type ImagemDoPacote,
  type MovelCarregado,
  type ParamsDoMovel,
  type PlanoDoMovel,
  type Rgb,
  type Vista,
} from './movel'

/**
 * OS MÓVEIS DO DESENHADO (plano de 29/10/2026, F3; CONTRATO.md 10.8): o carregador
 * das imagens de cada móvel do pacote e os halos que continuam do app.
 *
 * - **Só o que o mapa usa** (10.8, itens 2 e 9): cada (tipo, vista) carrega na
 *   primeira vez que um móvel dele aparece no Desenhado, e só as formas daquela
 *   vista (a Frente/Lado do mestre). Teto de 24 MiB das imagens decodificadas no
 *   mapa; passou, saem as que nenhum móvel pediu há mais tempo. Enquanto não
 *   chega, o móvel sai no Atual; quando chega, os ouvintes repintam.
 * - **As formas tingidas** (Float32 com os níveis 2 x 2) ficam numa guarda LRU
 *   à parte, de 16 MiB: os móveis iguais dividem a mesma.
 * - **Os halos** (o lampião e o fogo aceso da lareira e da fornalha): no Atual
 *   moram na imagem do motor; no Desenhado a imagem só tem o móvel, e o app
 *   pinta o mesmo halo na camada do móvel (o do lampião por baixo, o do fogo por
 *   cima), como a mesa de prova (`ferramentas/mesa_movel.ts`). A chama animada
 *   não muda: é a do app.
 *
 * O carregador do chão (`carregador.ts`) e o dos carimbos (`carimbos.ts`) são
 * outros, de propósito: cada um guarda a forma que a sua conta lê.
 */

/** F3a: os 25 que não esticam. */
const TIPOS_DA_F3A = [
  'armario', 'balde', 'barraca', 'barril', 'bau', 'bigorna', 'cadeira', 'caixa', 'carroca', 'catre', 'feno', 'fogao', 'fogo',
  'fogueira', 'fornalha', 'geladeira', 'lampiao', 'lareira', 'pia', 'placaDeSeta', 'poco', 'poltrona', 'pratos', 'privada',
  'quadroDeAvisos',
] as const

/** F3b: os que esticam (meio liso, meio que repete, centro fixo, tapete em xy), a cerca por peças e a lápide. */
const TIPOS_DA_F3B = ['aparador', 'arcoDoPortao', 'balcao', 'cerca', 'lapide', 'mesa', 'mesaQuadrada', 'mesaRedonda', 'sofa', 'tapete', 'tapeteLongo', 'troncos'] as const

const TIPOS_DESENHADOS: ReadonlySet<string> = new Set<string>([...TIPOS_DA_F3A, ...TIPOS_DA_F3B])

/** O id do pacote do móvel do app (`mesaQuadrada` → `movel-mesa-quadrada`), ou `null` se ele não tem desenho. */
export function idDoMovelDesenhado(tipo: string | undefined): IdDoDesenhado | null {
  if (tipo === undefined || !TIPOS_DESENHADOS.has(tipo)) return null
  const id = `movel-${tipo.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
  return ehIdDoDesenhado(id) ? id : null
}

const MEBIBYTE = 1024 * 1024
/**
 * Teto das imagens decodificadas de UM mapa, as vistas de frente e de lado somadas (CONTRATO
 * 10.1, item 6): 48 MiB desde 29/10/2026 (era 24; a Frente dos 37 sozinha dá 28,4 MiB e a Lado
 * mais 6,3, então um mapa com todos os tipos deixava 5 no Atual).
 */
export const TETO_DOS_MOVEIS_POR_MAPA = 48 * MEBIBYTE
/** Teto das formas tingidas guardadas (Float32 com os níveis). */
export const TETO_DOS_TINGIDOS = 16 * MEBIBYTE
/** Quanto tempo uma vista pedida fica protegida da poda (ms): a da passada que está pintando não sai. */
const PROTECAO_DA_VISTA_MS = 3000

export const tingidos = new CacheDosTingidos(TETO_DOS_TINGIDOS)

type Estado =
  | { readonly tipo: 'carregando'; readonly bytes: number }
  | { readonly tipo: 'pronto'; readonly movel: MovelCarregado; readonly bytes: number }
  | { readonly tipo: 'falhou' }
  | { readonly tipo: 'recusado' }

interface Entrada {
  estado: Estado
  usado: number
}

const entradas = new Map<string, Entrada>()
const ouvintes = new Set<() => void>()

function bytesDe(e: Entrada): number {
  return e.estado.tipo === 'pronto' || e.estado.tipo === 'carregando' ? e.estado.bytes : 0
}

/** Memória comum dos móveis do Desenhado agora: as imagens decodificadas mais as formas tingidas. */
export function bytesDosMoveisDesenhados(): number {
  let soma = tingidos.bytes
  for (const e of entradas.values()) soma += bytesDe(e)
  return soma
}

/** Avisado quando um móvel fica pronto (quem pintou o Atual no lugar dele repinta). */
export function assinarMoveisDesenhados(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

function avisar(): void {
  for (const o of [...ouvintes]) o()
}

/** Os carregadores das plantas (`trecho.ts`, `vaso.ts`) avisam pelos mesmos ouvintes: o raster repinta quem esperava. */
export function avisarMoveisDesenhados(): void {
  avisar()
}

/** Abre espaço soltando as vistas que ninguém pediu há mais tempo; `false` = nem assim cabe. */
function abrirEspaco(bytes: number, agora: number): boolean {
  let total = 0
  for (const e of entradas.values()) total += bytesDe(e)
  if (total + bytes <= TETO_DOS_MOVEIS_POR_MAPA) return true
  const velhas = [...entradas].filter(([, e]) => e.estado.tipo === 'pronto' && agora - e.usado > PROTECAO_DA_VISTA_MS).sort((a, b) => a[1].usado - b[1].usado)
  for (const [chave, e] of velhas) {
    if (total + bytes <= TETO_DOS_MOVEIS_POR_MAPA) break
    total -= bytesDe(e)
    entradas.delete(chave)
    const [id, vista] = chave.split('#')
    tingidos.soltarDoMovel(`${id}|${vista}-`)
  }
  return total + bytes <= TETO_DOS_MOVEIS_POR_MAPA
}

/** Um PNG da fonte em RGBA (alfa reto, como a tela 2D devolve). */
export async function decodificar(url: string): Promise<ImagemDoPacote | null> {
  const resposta = await fetch(url)
  if (!resposta.ok) return null
  const bitmap = await createImageBitmap(await resposta.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  try {
    const { width, height } = bitmap
    if (width === 0 || height === 0) return null
    const g = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true }) : criarTela(width, height)
    if (g === null) return null
    g.drawImage(bitmap, 0, 0)
    return { w: width, h: height, px: g.getImageData(0, 0, width, height).data }
  } finally {
    bitmap.close()
  }
}

function criarTela(largura: number, altura: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  return tela.getContext('2d', { willReadFrequently: true })
}

/** Os arquivos da vista (as formas dela e as das variantes), com o tamanho que o `textura.json` diz. */
function arquivosDaVista(p: ParamsDoMovel, vista: Vista): { nome: string; w: number; h: number }[] {
  const lista: { nome: string; w: number; h: number }[] = []
  for (const f of p.formas) {
    if (f.vista !== vista) continue
    for (const nome of [f.valor, f.partes, f.cor]) if (nome !== undefined) lista.push({ nome, w: f.larguraPx, h: f.alturaPx })
  }
  return lista
}

/** As imagens da vista com os níveis de mipmap (a conta do teto do contrato: 4/3). */
const FATOR_DO_MIPMAP = 4 / 3

async function carregar(id: IdDoDesenhado, vista: Vista, chave: string, entrada: Entrada): Promise<void> {
  try {
    const fonte = await abrirFonteDoDesenhado()
    const p = lerParamsDoMovel(await fonte.textura(id))
    if (p === null) {
      entrada.estado = { tipo: 'falhou' }
      console.warn(`[desenhado] o textura.json de '${id}' não serve; fica o Atual`)
      return
    }
    if (entradas.get(chave) !== entrada) return
    const usada = vistaUsada(p, vista)
    const arquivos = arquivosDaVista(p, usada)
    const bytes = arquivos.reduce((s, a) => s + a.w * a.h * 4, 0)
    // O teto do contrato é por vista, com o mipmap (10.1, item 6): o exportador já mede; aqui só não confia.
    if (bytes * FATOR_DO_MIPMAP > p.tetoPorVista * 1.01 || !abrirEspaco(bytes, performance.now())) {
      entrada.estado = { tipo: 'recusado' }
      console.warn(`[desenhado] '${id}' (${usada}) não cabe no teto de ${Math.round(TETO_DOS_MOVEIS_POR_MAPA / MEBIBYTE)} MiB dos móveis deste mapa; fica o Atual`)
      return
    }
    entrada.estado = { tipo: 'carregando', bytes }
    const imagens = await Promise.all(
      arquivos.map(async (a) => {
        const url = fonte.urlDe(id, a.nome)
        const img = url === undefined ? null : await decodificar(url)
        return img !== null && img.w === a.w && img.h === a.h ? ([a.nome, img] as const) : null
      }),
    )
    const prontas = new Map<string, ImagemDoPacote>()
    for (const par of imagens) if (par !== null) prontas.set(par[0], par[1])
    if (prontas.size !== arquivos.length) {
      entrada.estado = { tipo: 'falhou' }
      console.warn(`[desenhado] as imagens de '${id}' não abriram; fica o Atual`)
      return
    }
    if (entradas.get(chave) !== entrada) return
    entrada.estado = { tipo: 'pronto', movel: { p, imagens: prontas }, bytes }
    avisar()
  } catch (erro: unknown) {
    entrada.estado = { tipo: 'falhou' }
    console.warn(`[desenhado] '${id}' não carregou; fica o Atual`, erro)
  }
}

/** O que o pedido devolve: o móvel pronto, ou `'esperando'` (sai o Atual até o aviso), ou `null` (fica o Atual). */
export type MovelPedido = MovelCarregado | 'esperando' | null

/** O móvel Desenhado do tipo, na vista do mestre; começa a carregar na primeira vez. */
export function pedirMovelDesenhado(tipo: string | undefined, vista: Vista): MovelPedido {
  const id = idDoMovelDesenhado(tipo)
  if (id === null) return null
  const chave = `${id}#${vista}`
  const agora = performance.now()
  const existente = entradas.get(chave)
  if (existente !== undefined) {
    existente.usado = agora
    const e = existente.estado
    if (e.tipo === 'pronto') return e.movel
    return e.tipo === 'carregando' ? 'esperando' : null
  }
  const entrada: Entrada = { estado: { tipo: 'carregando', bytes: 0 }, usado: agora }
  entradas.set(chave, entrada)
  void carregar(id, vista, chave, entrada)
  return 'esperando'
}

// ---------- os halos do app (no Desenhado, fora da imagem do móvel) ----------

/** O halo do lampião, o de `meioTermo/moveis/lampiao.ts` (COR_DO_HALO, ALFA_DO_HALO, HALO_EM_RAIOS). */
const HALO_DO_LAMPIAO: { readonly cor: Rgb; readonly alfa: number; readonly raios: number } = { cor: [226, 170, 96], alfa: 0.1, raios: 4.8 }

/** O raio do halo do lampião em px, para a camada caber nele. */
export function raioDoHaloDoLampiao(casasW: number, casasH: number, pxPorCasa: number): number {
  return ((HALO_DO_LAMPIAO.raios * Math.min(casasW, casasH)) / 2) * pxPorCasa
}

/**
 * Pinta o halo do lampião POR BAIXO do corpo (o chão ilumina, o móvel cobre), na camada
 * pré-multiplicada `fundo` (a sombra), com o meio em (cx, cy).
 */
export function pintarHaloDoLampiao(fundo: Camada, cx: number, cy: number, raio: number): void {
  const { w, h, px } = fundo
  for (let y = Math.max(0, Math.floor(cy - raio)); y < Math.min(h, Math.ceil(cy + raio)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - raio)); x < Math.min(w, Math.ceil(cx + raio)); x += 1) {
      const q = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (raio * raio)
      if (q >= 1) continue
      const a = HALO_DO_LAMPIAO.alfa * (1 - q) * (1 - q)
      const o = (y * w + x) * 4
      for (let k = 0; k < 3; k += 1) px[o + k] = HALO_DO_LAMPIAO.cor[k] * a + px[o + k] * (1 - a)
      px[o + 3] = 255 * a + px[o + 3] * (1 - a)
    }
  }
}

interface HaloDoFogo {
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  readonly alfa: number
  readonly caixa: readonly [number, number, number, number]
}

/** Os halos do fogo aceso (casas, no referencial do móvel), os mesmos da mesa de prova. */
function halosDoFogo(tipo: 'lareira' | 'fornalha', w: number, h: number): HaloDoFogo[] {
  if (tipo === 'lareira') {
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

/**
 * Pinta o halo do fogo aceso POR CIMA do corpo (a imagem só tem a brasa), recortado onde
 * o Atual o deixa aparecer. `giroPintado` é o quarto de volta que a camada já traz: a
 * tela gira o resto, então aqui o halo gira só o pintado.
 */
export function pintarHaloDoFogo(corpo: Camada, tipo: 'lareira' | 'fornalha', casasW: number, casasH: number, cx: number, cy: number, giroPintado: number, pxPorCasa: number): void {
  const halos = halosDoFogo(tipo, casasW, casasH)
  const raio = Math.hypot(casasW, casasH) * 0.5 * pxPorCasa
  const g = (-giroPintado * Math.PI) / 180
  const co = Math.cos(g)
  const si = Math.sin(g)
  const { w, h, px } = corpo
  for (let y = Math.max(0, Math.floor(cy - raio)); y < Math.min(h, Math.ceil(cy + raio)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - raio)); x < Math.min(w, Math.ceil(cx + raio)); x += 1) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const u = (co * dx - si * dy) / pxPorCasa
      const v = (si * dx + co * dy) / pxPorCasa
      let a = 0
      for (const hl of halos) {
        if (u < hl.caixa[0] || u > hl.caixa[2] || v < hl.caixa[1] || v > hl.caixa[3]) continue
        const q = Math.min(1, ((u - hl.cx) / hl.rx) ** 2 + ((v - hl.cy) / hl.ry) ** 2)
        a = Math.max(a, hl.alfa * (1 - q) * (1 - q))
      }
      if (a <= 0) continue
      const o = (y * w + x) * 4
      for (let k = 0; k < 3; k += 1) px[o + k] = BRASA_QUENTE[k] * a + px[o + k] * (1 - a)
      px[o + 3] = 255 * a + px[o + 3] * (1 - a)
    }
  }
}

// ---------- o pedido e a imagem pronta ----------

/** O tom de um lugar: "mesma" e "varas" pegam a madeira do móvel (a mesa de prova faz igual). */
export function tomDoLugar(opcoes: readonly OpcaoDeMaterial[], i: number, lugares: readonly string[]): Rgb {
  const o = opcoes[i]
  if (ehMaterial(o)) return rgbDoHex(MATERIAIS[o].tom)
  const madeira = opcoes[lugares.indexOf('madeira')]
  return rgbDoHex(MATERIAIS[madeira !== undefined && ehMaterial(madeira) ? madeira : 'carvalho'].tom)
}

/** O que o app pinta em volta do móvel: o halo do lampião (por baixo) ou o do fogo aceso (por cima). */
export type HaloDoMovel = 'lampiao' | 'lareira' | 'fornalha' | null

/** Bytes de trabalho por px do Desenhado: o corpo e o fundo em Float32 (32) e a sombra com o desfoque (12). */
export const BYTES_DE_TRABALHO_DO_DESENHADO = 44

/**
 * Pinta o móvel Desenhado nos bytes da imagem (RGBA pré-multiplicado, W x H do plano), em
 * passos: o corpo pela conta do pacote, a sombra pela silhueta, os halos do app (o do
 * lampião por baixo, o do fogo aceso por cima). É o que o raster dos móveis sobe para a
 * placa, e o que a conferência compara com a mesa de prova do pacote.
 *
 * Com `sombraPx` (F3d), a sombra sai À PARTE, a cobertura sem o alfa (0..255 nos 4 canais,
 * branco pré-multiplicado): o palco a põe na camada única das sombras dos móveis, a 0,25,
 * e duas sombras que se cruzam não escurecem em dobro (como a mesa de prova:
 * `ferramentas/mesa_movel.ts`, `pintarSombra`). Sem ele, a sombra vai na imagem, como antes.
 */
export function* pintarMovelDesenhado(plano: PlanoDoMovel, halo: HaloDoMovel, pixels: Uint8ClampedArray, sombraPx?: Uint8ClampedArray): Generator<void, void, void> {
  const corpo = yield* pintarMovel(plano, tingidos)
  const sb = plano.m.p.sombra
  const sombra = yield* sombraDoCorpo(sb, corpo, plano.pxPorCasa)
  const { W, H } = plano
  const fundo = { w: W, h: H, px: new Float32Array(W * H * 4) }
  if (sombra !== null && sombraPx !== undefined) {
    // A cobertura: a conta devolve já com o alfa do pacote (a mesa divide por ele também).
    const alfa = sb.alfa > 0 ? sb.alfa : 1
    for (let i = 0; i < W * H; i += 1) {
      const v = Math.min(1, sombra[i] / alfa) * 255
      sombraPx[i * 4] = v
      sombraPx[i * 4 + 1] = v
      sombraPx[i * 4 + 2] = v
      sombraPx[i * 4 + 3] = v
    }
  } else if (sombra !== null) {
    for (let i = 0; i < W * H; i += 1) {
      const s = sombra[i]
      if (s <= 0) continue
      fundo.px[i * 4] = sb.cor[0] * s
      fundo.px[i * 4 + 1] = sb.cor[1] * s
      fundo.px[i * 4 + 2] = sb.cor[2] * s
      fundo.px[i * 4 + 3] = 255 * s
    }
  }
  const { casasW, casasH } = plano.pedido
  if (halo === 'lampiao') pintarHaloDoLampiao(fundo, plano.cx, plano.cy, raioDoHaloDoLampiao(casasW, casasH, plano.pxPorCasa))
  yield
  const c = corpo.px
  for (let o = 0; o < c.length; o += 4) {
    const resto = 1 - c[o + 3] / 255
    if (resto <= 0) continue
    c[o] += resto * fundo.px[o]
    c[o + 1] += resto * fundo.px[o + 1]
    c[o + 2] += resto * fundo.px[o + 2]
    c[o + 3] += resto * fundo.px[o + 3]
  }
  if (halo === 'lareira' || halo === 'fornalha') pintarHaloDoFogo(corpo, halo, casasW, casasH, plano.cx, plano.cy, plano.giroPintado, plano.pxPorCasa)
  yield
  // O Uint8ClampedArray arredonda para o mais perto e corta em 0..255.
  for (let o = 0; o < c.length; o += 1) pixels[o] = c[o]
}
