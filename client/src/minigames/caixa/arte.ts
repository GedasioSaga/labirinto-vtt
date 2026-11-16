/**
 * ARTE DA CAIXA: a caixa de pinho com tábuas pregadas, postes de carvalho e
 * cantoneiras de ferro; o pé de cabra enfiado na fresta da tábua da frente,
 * que inclina com a força; o medidor de força à esquerda, com a faixa verde;
 * as trincas que crescem a cada estágio e a tábua quebrada caindo. Tela lógica
 * de 240x135, só retângulos (sem texto no canvas). As partes fixas ficam numa
 * tela fora da página; sem ela (teste em Node), tudo é pintado direto.
 */
import { CENTRO_X, CHAO_Y, desenharFundo, desenharLuz, desenharVela, novaTela } from '../abrir/cenario'
import { COR, H, W, bloco, contorno, luz, misturar, pix } from '../abrir/desenho'
import { rngDe } from '../abrir/rng'
import type { OpcoesDeDesenho } from '../abrir/tipos'
import { DURACAO_ABRIR, ESTAGIOS, abertura, faixaAtual } from './sim'
import type { Estado, Tranco } from './sim'

/** Caixa de 100 x 70 px, centrada na cena, com a base no chão. */
export const CAIXA_L = 100
export const CAIXA_A = 70
export const CAIXA_X = CENTRO_X - CAIXA_L / 2
export const CAIXA_Y = CHAO_Y - CAIXA_A
/** Tampa vista de leve por cima, sobrando 2 px de cada lado. */
const TAMPA_A = 5
const BEIRAL = 2
const POSTE_L = 8
/** Tábua da frente (a do pé de cabra): entre os postes, logo abaixo da tampa. */
export const TABUA_X = CAIXA_X + POSTE_L
export const TABUA_Y = CAIXA_Y + TAMPA_A
export const TABUA_L = CAIXA_L - 2 * POSTE_L
export const TABUA_A = 16
/** Tábuas fixas abaixo da da frente: [y a partir do topo da caixa, altura]; 1 px de fresta entre elas. */
const TABUAS_FIXAS: readonly (readonly [number, number])[] = [[22, 16], [39, 16], [56, 14]]

/** Ponta do pé de cabra na fresta embaixo da tábua da frente: o pivô da alavanca. */
export const PONTA: readonly [number, number] = [146, TABUA_Y + TABUA_A]
/** Boca: centro do buraco que a tábua deixa ao cair; a armadilha sai daqui. */
export const BOCA: readonly [number, number] = [CENTRO_X, TABUA_Y + TABUA_A / 2]

/** Pé de cabra: comprimento em px e ângulo abaixo da horizontal, em rad, em repouso e a mais com força 1. */
const PE_COMPRIMENTO = 46
const PUNHO = 9
const ANG_REPOUSO = 0.5
const ANG_FORCA = 0.42
/** Com o pé de cabra todo fora da fresta (escorregão), a ponta anda isto, em px e rad. */
const FORA_X = 8
const FORA_Y = 4
const FORA_ANG = 0.35
/** Fora da fresta enquanto reposiciona depois de um tranco fraco ou de um racha (fração do escorregão). */
const FORA_REPOSICIONANDO = 0.35
/** Tempos do movimento do pé de cabra, em s: sai rápido, volta suave, o cabo recua curto. */
const SAI_S = 0.1
const VOLTA_S = 0.2
const RECUO_S = 0.12

/** Tremor da tábua e do pé de cabra no racha: duração em s, amplitude em px, frequência em rad/s. */
const TREMOR_S = 0.3
const TREMOR_PX = 1.5
const TREMOR_FREQ = 70

/** Medidor de força: moldura e interior, em px. */
const MED_X = 49
const MED_Y = 36
const MED_L = 9
const MED_A = 62
const MED_IN_X = MED_X + 1
const MED_IN_Y = MED_Y + 1
const MED_IN_L = MED_L - 2
const MED_IN_A = MED_A - 2
/** Quanto acima da faixa o nível chega a brasa pura. */
export const PASSOU_TOTAL = 0.08
/** s que a marca da última soltura fica no medidor. */
const MARCA_S = 0.6

const SOMBRA_NO_CHAO = 'rgba(18,13,10,0.5)'

const lim01 = (k: number): number => Math.min(1, Math.max(0, k))
/** Ease-out cúbico: começa rápido, a resposta aparece na hora. */
const saida = (k: number): number => 1 - Math.pow(1 - lim01(k), 3)
/** Ease-in-out cúbico: para movimento que vai e volta na tela. */
const vaiEVem = (k: number): number => {
  const x = lim01(k)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/* ---------- Cache das partes fixas (tela fora da página) ---------- */

type Pintor = (g: CanvasRenderingContext2D, ox: number, oy: number) => void

/** null = sem tela fora da página (Node): pinta direto a cada quadro. */
const cache = new Map<string, CanvasImageSource | null>()

function comCache(g: CanvasRenderingContext2D, chave: string, w: number, h: number, x: number, y: number, pintar: Pintor): void {
  let img = cache.get(chave)
  if (img === undefined) {
    const t = novaTela(w, h)
    if (t !== null) pintar(t.g, 0, 0)
    img = t === null ? null : t.tela
    cache.set(chave, img)
  }
  if (img === null) pintar(g, x, y)
  else g.drawImage(img, x, y)
}

/* ---------- Madeira e ferro ---------- */

/** Veios da madeira: traços curtos um tom abaixo, determinísticos pela chave. */
function veios(g: CanvasRenderingContext2D, cor: string, x: number, y: number, w: number, h: number, chave: string): void {
  const r = rngDe('caixa|veio|' + chave)
  const n = Math.max(2, Math.round((w * h) / 160))
  const tom = luz(cor, 0.88)
  for (let k = 0; k < n; k++) pix(g, tom, x + 2 + Math.floor(r() * (w - 12)), y + 2 + Math.floor(r() * (h - 4)), 4 + Math.floor(r() * 8), 1)
}

function prego(g: CanvasRenderingContext2D, x: number, y: number): void {
  pix(g, contorno(COR.ferro), x, y, 2, 2)
  pix(g, luz(COR.ferro, 1.5), x, y, 1, 1)
}

/** Tábua com volume, veios e dois pregos em cada ponta. */
function tabua(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, chave: string): void {
  bloco(g, COR.pinho, x, y, w, h)
  veios(g, COR.pinho, x, y, w, h, chave)
  for (const px of [x + 2, x + w - 4]) {
    prego(g, px, y + 3)
    prego(g, px, y + h - 5)
  }
}

/** Interior escuro atrás da tábua da frente: sombra da tampa, fundo de tábuas e palha. */
function pintarInterior(g: CanvasRenderingContext2D, x: number, y: number): void {
  pix(g, COR.sombra, x, y, TABUA_L, TABUA_A + 1)
  pix(g, misturar(COR.sombra, COR.argamassa, 0.6), x, y, TABUA_L, 4)
  for (let i = 10; i < TABUA_L; i += 14) pix(g, luz(COR.nogueira, 0.45), x + i, y + 4, 1, TABUA_A - 7)
  const r = rngDe('caixa|palha')
  for (let k = 0; k < 22; k++) {
    const cor = misturar(COR.palha, COR.sombra, 0.5 + r() * 0.25)
    pix(g, cor, x + Math.floor(r() * (TABUA_L - 4)), y + TABUA_A - 4 + Math.floor(r() * 4), 2 + Math.floor(r() * 3), 1)
  }
}

/** Cantoneira de ferro em L no canto do poste, com dois rebites. `dir` = 1 à esquerda, -1 à direita; `baixo` vira o L. */
function cantoneira(g: CanvasRenderingContext2D, x: number, y: number, dir: number, baixo: boolean): void {
  const borda = contorno(COR.ferro)
  const xBraco = dir > 0 ? x : x - 2
  const xBase = dir > 0 ? x : x - POSTE_L + 1
  const yBase = baixo ? y + 9 : y
  pix(g, borda, xBraco, y, 3, 12)
  pix(g, borda, xBase, yBase, POSTE_L, 3)
  pix(g, COR.ferro, xBraco + 1, y + 1, 1, 10)
  pix(g, COR.ferro, xBase + 1, yBase + 1, POSTE_L - 2, 1)
  pix(g, luz(COR.ferro, 1.5), xBraco + 1, baixo ? y + 2 : y + 7, 1, 1)
  pix(g, luz(COR.ferro, 1.5), dir > 0 ? xBase + 5 : xBase + 2, yBase + 1, 1, 1)
}

/** A caixa sem a tábua da frente (com o interior que ela esconde): tudo o que não muda. */
function pintarCaixaFixa(g: CanvasRenderingContext2D, ox: number, oy: number): void {
  const cx = ox + BEIRAL
  const frenteX = cx + POSTE_L
  pix(g, COR.sombra, frenteX, oy + TAMPA_A, TABUA_L, CAIXA_A - TAMPA_A)
  pintarInterior(g, frenteX, oy + TAMPA_A)
  for (const [dy, h] of TABUAS_FIXAS) tabua(g, frenteX, oy + dy, TABUA_L, h, 'fixa' + dy)
  for (const px of [cx, cx + CAIXA_L - POSTE_L]) {
    bloco(g, COR.carvalho, px, oy + TAMPA_A, POSTE_L, CAIXA_A - TAMPA_A)
    veios(g, COR.carvalho, px, oy + TAMPA_A, POSTE_L, CAIXA_A - TAMPA_A, 'poste' + px)
  }
  const direita = cx + CAIXA_L - 1
  cantoneira(g, cx, oy + TAMPA_A, 1, false)
  cantoneira(g, direita, oy + TAMPA_A, -1, false)
  cantoneira(g, cx, oy + CAIXA_A - 12, 1, true)
  cantoneira(g, direita, oy + CAIXA_A - 12, -1, true)
  const tampa = luz(COR.pinho, 1.06)
  bloco(g, tampa, ox, oy, CAIXA_L + 2 * BEIRAL, TAMPA_A)
  veios(g, tampa, ox, oy, CAIXA_L + 2 * BEIRAL, TAMPA_A, 'tampa')
}

/* ---------- Trincas ---------- */

/**
 * Caminho da trinca, em px relativos à tábua da frente: nasce junto da ponta
 * do pé de cabra e corre para a esquerda pelo veio, subindo devagar.
 */
const TRINCA: readonly (readonly [number, number])[] = (() => {
  const r = rngDe('caixa|trinca')
  const pontos: [number, number][] = []
  let y = TABUA_A - 3
  for (let x = PONTA[0] - TABUA_X - 2; x >= 1; x--) {
    pontos.push([x, y])
    const sorte = r()
    if (sorte < 0.22) y = Math.max(4, y - 1)
    else if (sorte > 0.9) y = Math.min(TABUA_A - 3, y + 1)
  }
  return pontos
})()

/** Pontos do caminho desenhados em cada estágio: trinca fina, racha, quebra de ponta a ponta. */
const ALCANCE: readonly number[] = [0, 18, 40, TRINCA.length]
/** Farpas que saltam da trinca: [índice no caminho, estágio a partir do qual aparece]. */
const FARPAS: readonly (readonly [number, number])[] = [[7, 2], [10, 2], [26, 3], [33, 3], [48, 3], [58, 3]]

function pintarTrincas(g: CanvasRenderingContext2D, ox: number, oy: number, estagio: number): void {
  if (estagio <= 0) return
  const fina = contorno(COR.pinho)
  const funda = COR.sombra
  const farpa = luz(COR.pinho, 1.22)
  const n = Math.min(TRINCA.length, ALCANCE[Math.min(estagio, ESTAGIOS)])
  for (let i = 0; i < n; i++) {
    const [x, y] = TRINCA[i]
    const larga = estagio >= 3 || (estagio === 2 && i < 22)
    pix(g, fina, ox + x, oy + y, 1, larga ? 2 : 1)
    if (estagio >= 3 || (estagio === 2 && i < 9)) pix(g, funda, ox + x, oy + y, 1, 1)
  }
  if (estagio >= 2) {
    // Galho da racha, subindo na diagonal.
    const [bx, by] = TRINCA[22]
    for (let k = 1; k <= 5; k++) pix(g, fina, ox + bx - k, oy + by - k, 1, 1)
  }
  if (estagio >= 3) {
    // Quebra: a trinca atravessa também até a ponta da direita.
    const [x0, y0] = TRINCA[0]
    for (let x = x0 + 1; x < TABUA_L - 1; x++) {
      pix(g, fina, ox + x, oy + y0, 1, 2)
      pix(g, funda, ox + x, oy + y0, 1, 1)
    }
  }
  for (const [i, desde] of FARPAS) {
    if (estagio < desde || i >= TRINCA.length) continue
    const [x, y] = TRINCA[i]
    pix(g, farpa, ox + x, oy + y - 2, 1, 2)
    pix(g, farpa, ox + x + 1, oy + y - 3, 1, 1)
  }
}

function pintarTabuaDaFrente(g: CanvasRenderingContext2D, ox: number, oy: number, estagio: number): void {
  tabua(g, ox, oy, TABUA_L, TABUA_A, 'frente')
  pintarTrincas(g, ox, oy, estagio)
}

/* ---------- Movimento (funções puras, testadas) ---------- */

/** Deslocamento horizontal da tábua e do pé de cabra no racha, em px. Sempre 0 no movimento reduzido. */
export function tremorDoRacha(e: Readonly<Estado>, reduzido: boolean): number {
  if (reduzido || e.fim !== null) return 0
  const dt = e.t - e.tRacha
  if (dt < 0 || dt >= TREMOR_S) return 0
  return Math.round(Math.sin(dt * TREMOR_FREQ) * TREMOR_PX * (1 - dt / TREMOR_S))
}

/**
 * Quanto o pé de cabra está fora da fresta, 0..1, enquanto não pode segurar:
 * todo fora no escorregão, um pouco ao reposicionar. Sai rápido, fica e volta
 * suave até assentar; no movimento reduzido troca de posição sem pulo (fora o
 * tempo todo da espera, dentro quando assenta).
 */
export function afastamento(e: Readonly<Estado>, reduzido: boolean): number {
  if (e.fim !== null || e.ultimoTranco === null || e.t >= e.livreEm) return 0
  const alvo = e.ultimoTranco === 'escorregou' ? 1 : FORA_REPOSICIONANDO
  if (reduzido) return alvo
  return alvo * saida((e.t - e.tSolta) / SAI_S) * vaiEVem((e.livreEm - e.t) / VOLTA_S)
}

/** Ponta do pé de cabra (px) e ângulo do cabo abaixo da horizontal (rad). */
export interface PoseDoPe {
  x: number
  y: number
  ang: number
}

/** Pose do pé de cabra: inclina com a força (alavanca), recua ao soltar, pula fora no escorregão, treme no racha. */
export function poseDoPe(e: Readonly<Estado>, reduzido: boolean): PoseDoPe {
  const k = afastamento(e, reduzido)
  let ang = ANG_REPOUSO + ANG_FORCA * e.forca
  const dt = e.t - e.tSolta
  // Recuo do cabo em todo tranco: volta da força solta ao repouso sem salto de ângulo (no escorregão, soma com o
  // pulo para fora, e o cabo não dá um tranco para baixo antes de subir). No reduzido, vai direto.
  if (!reduzido && e.ultimoTranco !== null && dt >= 0 && dt < RECUO_S) {
    ang += ANG_FORCA * e.ultimaSolta * (1 - saida(dt / RECUO_S))
  }
  return {
    x: PONTA[0] + tremorDoRacha(e, reduzido) + Math.round(FORA_X * k),
    y: PONTA[1] + Math.round(FORA_Y * k),
    ang: ang + FORA_ANG * k,
  }
}

/** Cor do nível do medidor: âmbar até o topo da faixa; acima dela, vai a brasa. */
export function corDoNivel(f: number, max: number): string {
  if (f <= max) return COR.ambar
  return misturar(COR.ambar, COR.brasa, lim01((f - max) / PASSOU_TOTAL))
}

const COR_DA_MARCA: Readonly<Record<Tranco, string>> = { racha: COR.verdeClaro, fraco: COR.ambar, escorregou: COR.brasa }

/* ---------- Peças desenhadas a cada quadro ---------- */

function desenharPe(g: CanvasRenderingContext2D, p: PoseDoPe): void {
  const cos = Math.cos(p.ang)
  const sin = Math.sin(p.ang)
  const borda = contorno(COR.ferro)
  const aco = luz(COR.ferro, 1.3)
  const punho = luz(COR.nogueira, 0.95)
  const bordaPunho = contorno(COR.nogueira)
  // Unha dentro da fresta, apontando para a esquerda.
  pix(g, borda, p.x - 3, p.y, 4, 1)
  for (let s = 0; s <= PE_COMPRIMENTO; s++) {
    const cabo = s > PE_COMPRIMENTO - PUNHO
    pix(g, cabo ? bordaPunho : borda, p.x + cos * s - 1, p.y + sin * s - 1, 3, 3)
  }
  for (let s = 0; s <= PE_COMPRIMENTO; s++) {
    const cabo = s > PE_COMPRIMENTO - PUNHO
    pix(g, cabo ? punho : aco, p.x + cos * s, p.y + sin * s, 1, 1)
  }
}

/** Fresta se abrindo junto da ponta quando a força passa da metade: a tábua cede. */
function desenharFrestaAbrindo(g: CanvasRenderingContext2D, forca: number): void {
  if (forca < 0.4) return
  const linhas = forca >= 0.75 ? 2 : 1
  const x = PONTA[0] - 14
  const y = TABUA_Y + TABUA_A - linhas
  pix(g, COR.sombra, x, y, 16, linhas)
  pix(g, luz(COR.pinho, 0.8), x, y - 1, 16, 1)
}

/** Lascas que saltam da ponta no racha, por 0,3 s (não existem no movimento reduzido). */
function desenharLascas(g: CanvasRenderingContext2D, e: Readonly<Estado>): void {
  const dt = e.t - e.tRacha
  if (dt < 0 || dt >= TREMOR_S) return
  const cor = luz(COR.pinho, 1.2)
  for (let i = 0; i < 3; i++) {
    const x = PONTA[0] - 4 - i * 3 + (-20 - i * 15) * dt
    const y = TABUA_Y + 12 + (-60 + i * 12) * dt + 250 * dt * dt
    pix(g, cor, x, y, 2, 1)
  }
}

/** Farpas da quebra: [x, y, vx, vy] na saída, em px e px/s. */
const FARPAS_DA_QUEBRA: readonly (readonly [number, number, number, number])[] = (() => {
  const r = rngDe('caixa|farpas')
  return Array.from({ length: 8 }, (): readonly [number, number, number, number] => [TABUA_X + 8 + r() * 68, TABUA_Y + 8, (r() - 0.5) * 90, -40 - r() * 50])
})()
const GRAVIDADE = 900

/**
 * A tábua quebrada cai em duas tiras e deita no chão, com farpas. Queda com
 * aceleração (é um objeto caindo); no movimento reduzido, as tiras e as
 * farpas já aparecem no chão, sem queda.
 */
function desenharQueda(g: CanvasRenderingContext2D, a: number, reduzido: boolean): void {
  const q = reduzido ? 1 : a * a
  const tiras: readonly (readonly [number, number, number, number])[] = [
    // [y inicial, y no chão, deriva em x, sentido da inclinação]
    [TABUA_Y, CHAO_Y + 12, 5, -1],
    [TABUA_Y + 8, CHAO_Y + 6, -6, 1],
  ]
  for (const [y0, y1, dx, sentido] of tiras) {
    const y = y0 + (y1 - y0) * q
    const x = TABUA_X + dx * q
    const h = Math.round(8 - 3 * q)
    const inclinacao = reduzido ? 0 : sentido * 0.08 * Math.sin(Math.PI * a)
    for (let i = 0; i < TABUA_L; i += 6) {
      const sy = y + Math.round(inclinacao * (i - TABUA_L / 2))
      pix(g, contorno(COR.pinho), x + i, sy, 6, h)
      pix(g, COR.pinho, x + i, sy + 1, 6, h - 2)
    }
  }
  const tau = (reduzido ? 1 : a) * DURACAO_ABRIR
  const cor = luz(COR.pinho, 1.2)
  FARPAS_DA_QUEBRA.forEach(([x0, y0, vx, vy], i) => {
    const chao = CHAO_Y + 3 + (i % 4) * 3
    const y = Math.min(chao, y0 + vy * tau + 0.5 * GRAVIDADE * tau * tau)
    pix(g, cor, x0 + vx * tau, y, 2, 1)
  })
}

function yDaForca(f: number): number {
  return MED_IN_Y + MED_IN_A - Math.round(lim01(f) * MED_IN_A)
}

/** Medidor vertical: faixa verde, nível da força, marca da última soltura e um pino por estágio rachado. */
function desenharMedidor(g: CanvasRenderingContext2D, e: Readonly<Estado>): void {
  const [min, max] = faixaAtual(e)
  bloco(g, COR.nogueira, MED_X, MED_Y, MED_L, MED_A)
  const assentado = e.fim === null && e.t >= e.livreEm
  pix(g, assentado ? COR.sombra : misturar(COR.sombra, COR.argamassa, 0.7), MED_IN_X, MED_IN_Y, MED_IN_L, MED_IN_A)
  const yTopo = yDaForca(max)
  const yBase = Math.max(yTopo + 1, yDaForca(min))
  pix(g, COR.verde, MED_IN_X, yTopo, MED_IN_L, yBase - yTopo)
  // Colchete da faixa por fora da moldura: continua legível quando o nível cobre a faixa.
  pix(g, COR.verde, MED_X + MED_L, yTopo, 1, yBase - yTopo)
  if (e.forca > 0) {
    const cor = corDoNivel(e.forca, max)
    const yNivel = yDaForca(e.forca)
    const fundo = MED_IN_Y + MED_IN_A
    pix(g, cor, MED_IN_X + 1, yNivel, MED_IN_L - 2, fundo - yNivel)
    pix(g, luz(cor, 1.2), MED_IN_X + 1, yNivel, MED_IN_L - 2, 1)
  }
  pix(g, COR.verdeClaro, MED_IN_X, yTopo, MED_IN_L, 1)
  pix(g, COR.verdeClaro, MED_IN_X, yBase - 1, MED_IN_L, 1)
  if (e.ultimoTranco !== null && e.t - e.tSolta < MARCA_S) {
    pix(g, COR_DA_MARCA[e.ultimoTranco], MED_X - 2, yDaForca(e.ultimaSolta), MED_L + 4, 1)
  }
  for (let i = 0; i < ESTAGIOS; i++) pix(g, i < e.estagio ? COR.ouro : luz(COR.ferro, 0.8), MED_IN_X + i * 3, MED_Y + MED_A + 2, 2, 2)
}

/* ---------- Cena ---------- */

/** Desenha a cena inteira na tela lógica de 240x135. */
export function desenhar(g: CanvasRenderingContext2D, e: Readonly<Estado>, op: OpcoesDeDesenho): void {
  const reduzido = op.reduzido
  desenharFundo(g)
  pix(g, SOMBRA_NO_CHAO, CAIXA_X - 4, CHAO_Y, CAIXA_L + 8, 3)
  comCache(g, 'caixa', CAIXA_L + 2 * BEIRAL, CAIXA_A, CAIXA_X - BEIRAL, CAIXA_Y, pintarCaixaFixa)
  const a = abertura(e)
  if (e.fim === 'abriu' && a > 0) desenharQueda(g, a, reduzido)
  else {
    const estagio = e.estagio
    comCache(g, 'tabua' + estagio, TABUA_L, TABUA_A, TABUA_X + tremorDoRacha(e, reduzido), TABUA_Y, (gg, x, y) => pintarTabuaDaFrente(gg, x, y, estagio))
    if (e.enchendo) desenharFrestaAbrindo(g, e.forca)
    if (!reduzido && e.fim === null) desenharLascas(g, e)
  }
  desenharPe(g, poseDoPe(e, reduzido))
  desenharLuz(g, e.t, reduzido)
  desenharMedidor(g, e)
  // A vela marca o tempo da tentativa: para no fim, enquanto a animação de abrir segue.
  desenharVela(g, e.fim === null ? e.t : e.tFim, reduzido)
}

/** Alvo do toque: a tela toda segura o pé de cabra (0); fora da tela, nada. */
export function alvoEm(x: number, y: number, _e: Readonly<Estado>): number {
  return x >= 0 && x <= W && y >= 0 && y <= H ? 0 : -1
}
