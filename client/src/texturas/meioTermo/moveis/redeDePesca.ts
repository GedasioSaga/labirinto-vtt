/**
 * REDE DE PESCA secando (lote 12 dos objetos novos, 11/11/2026; grupo Porto e
 * navio, a campanha é de piratas). A rede esticada em três ou quatro ESTACAS,
 * com a VARA amarrada em cima delas: a tralha de cima com as cortiças corre ao
 * longo da vara, e a de baixo, com os chumbos, fica a um palmo do chão, puxada
 * um pouco para trás (para o norte), de modo que o pano desce inclinado. A
 * malha é de losangos de fio de cânhamo, com os nós. Num canto, no chão, o resto
 * da rede amontoado, com cortiças e chumbos aparecendo, uma boia de vidro
 * esverdeada na rede de corda dela e dois peixes esquecidos.
 *
 * Coisa fina em pé, a rede tem duas vistas desenhadas. De cima se vê a vara, as
 * pontas das estacas, as cortiças dos dois lados da vara e o pano em escorço
 * (a faixa da inclinação, com a malha achatada e os chumbos na beira de trás),
 * e no chão a sombra da malha em losangos, que a luz de cima à esquerda joga
 * para baixo à direita. Na 3/4 o pano aparece de frente, de estaca a estaca, da
 * vara até perto do chão: cada vista tem as suas peças, e a da outra vista some
 * (o truque do gancho com carne: a peça só é pintada no lugar em que nasceu, e
 * a âncora da 3/4 traz as de frente de volta ao lugar delas). Girada, a cena só
 * serve à 3/4: o pano é montado já na tela (de costas, a rede vista do outro
 * lado; de lado, a faixa estreita do pano visto de ponta) e devolvido ao
 * referencial do objeto.
 *
 * As estacas se repartem pelo comprimento (um vão de ~0,9 casa entre cada par);
 * o monte, a boia e os peixes ficam no canto de baixo à esquerda.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, capsula, elipse, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo) ----------

/** A linha da vara, em fração da altura da pegada a partir do meio (um pouco para o norte: o monte e a sombra ficam embaixo). */
const LINHA_DA_VARA = -0.07
/** As estacas: a folga nas pontas, o vão de partida, o raio e a altura; a vara: a altura, o raio e o quanto passa da estaca da ponta. */
const FOLGA_DAS_ESTACAS = 6
const VAO_DE_PARTIDA = 0.9 * G
const RAIO_DA_ESTACA = 2.6
const ALTURA_DA_ESTACA = 1.22 * G
const ALTURA_DA_VARA = 1.12 * G
const RAIO_DA_VARA = 1.9
const SOBRA_DA_VARA = 5
/** O pano: a tralha de cima logo abaixo da vara, a de baixo a um palmo do chão, puxada para trás. */
const ABAIXO_DA_VARA = 3.2
const ALTURA_DO_PE = 4
const RECUO_DO_PE = 16
/** A malha: os dois lados do losango no pano (px), a grossura do fio e o raio do nó. */
const MALHA_X = 7
const MALHA_Y = 9
const FIO = 0.75
const RAIO_DO_NO = 0.62
const GRADIENTE_DA_MALHA = Math.hypot(1 / MALHA_X, 1 / MALHA_Y)
/** As cortiças da tralha de cima e os chumbos da de baixo: o passo, o meio comprimento e o raio. */
const BOIA = { passo: 13, meio: 1.6, raio: 1.7 }
/** De cima, o quanto as cortiças descem pelo pano (fração da queda): saem do lado de lá da vara. */
const BOIAS_DESCEM_DE_CIMA = 0.12
const CHUMBO = { passo: 7.5, meio: 1.3, raio: 0.95 }
const RAIO_DA_TRALHA = 0.7
/** A sombra da malha no chão: a meia grossura do fio na sombra, a borda e a força. */
const FIO_NA_SOMBRA = 0.55
const SOMBRA_DA_MALHA = { suave: 0.5, forca: 0.3 }
/** O monte de rede no canto: o meio (frações da meia pegada) e a altura na 3/4 (baixa: mais alto, virava um pufe). */
const MONTE: Ponto = [-0.63, 0.57]
const ALTURA_DO_MONTE = 0.065 * G
/** As cortiças que aparecem por cima do monte, menores que as da tralha esticada (meio comprimento e raio). */
const CORTICA_NO_MONTE = { meio: 2, raio: 1.8 }
/** A boia de vidro: o raio e o lugar a partir do meio do monte. */
const RAIO_DA_BOIA_DE_VIDRO = 4.8
const BOIA_DE_VIDRO: Ponto = [22, 3]
/** A peça de uma vista só: a âncora só contém o ponto dela; o que só aparece de cima sobe quase nada na 3/4 e some. */
const RAIO_DA_ANCORA = 1e-6
const FORA_DA_ANCORA = 1e3
const BORDA_DA_ANCORA = 0.05
const QUASE_NADA = 0.02
const VOLTA_INTEIRA = Math.PI * 2

// ---------- as cores fixas ----------

/** O fio da rede (cânhamo claro, que se lê sobre a própria sombra) e o das tralhas, mais grosso e escuro. */
const REDE: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xb0, 0x88] }
const TRALHA: MaterialDaPeca = { classe: 'liso', rgb: [0xa2, 0x8a, 0x5e] }
const CORTICA: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0x7c, 0x54] }
const CHUMBADA: MaterialDaPeca = { classe: 'metal', rgb: [0x6a, 0x6c, 0x70] }
/** O vidro da boia (verde do mar, transparente), a luz que ele junta do outro lado e o brilho. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x8c, 0x7e] }
const LUZ_NO_VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xd6, 0xc2] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xee, 0xf2, 0xee] }
/** O peixe (as cores do barril de peixe): o flanco prateado, o lombo azulado, a barriga clara, o rabo e o olho. */
const FLANCO: Rgb = [0xa6, 0xb2, 0xb4]
const LOMBO: Rgb = [0x50, 0x64, 0x72]
const BARRIGA: Rgb = [0xe4, 0xe6, 0xdf]
const RABO: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x86, 0x8a] }
const IRIS: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd8, 0xcc] }
const PUPILA: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x28, 0x26] }
const GUELRA: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x46, 0x4a] }
/** O chão molhado embaixo dos peixes. */
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('nogueira', 0.55)) }

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

// ---------- o giro ----------

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Caixa = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

/** A forma com outra caixa (a 3/4 tira o material da frente da peça de maior caixa). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/** A mesma forma com a caixa centrada em (cx, cy): a 3/4 lê o meio da caixa para saber com quem a peça sobe. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return naCaixa(forma, [cx - mx, cy - my, cx + mx, cy + my])
}

// ---------- a peça de uma vista só ----------

/** A peça só é pintada no lugar em que foi desenhada (`dy` zero): a 3/4 mexe no `dy` de tudo o que sobe. */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** A âncora de um grupo no ponto (x, y) do chão NA TELA: um tampo solto de um ponto só, sem sombra. */
function ancorar(cena: Cena, q: number, x: number, y: number, z: number): void {
  const ponto: Forma = {
    b: [x, y, x, y],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - y) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: girarForma(ponto, (4 - q) % 4), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
}

type OpcoesDaVista = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>
/** Põe uma peça num grupo. */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaVista) => void

/** O grupo que só aparece de cima, com a âncora em (x, y), fora de toda estrutura: sobe quase nada na 3/4 e some. */
function grupoDeCima(P: CriarPeca, cena: Cena, x: number, y: number): Por {
  ancorar(cena, 0, x, y, QUASE_NADA)
  return (forma, mat, o = {}) => {
    cena.partes.push(P(presa(forma, x, y), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
}

/**
 * O grupo que só aparece na 3/4, desenhado em coordenadas da TELA: a âncora no
 * ponto (x, base) do chão e as caixas centradas em (x, meio), acima dele. Sem
 * giro a peça nasce descida (`dy`) e escondida, e a 3/4 a sobe de volta; girada,
 * a cena só serve à 3/4 e a peça sai desgirada, para a volta da 3/4 a pôr no lugar.
 */
function grupoDeFrente(P: CriarPeca, cena: Cena, q: number, x: number, base: number, meio: number): Por {
  const z = base - meio
  ancorar(cena, q, x, base, z)
  const volta = (4 - q) % 4
  const [dx, dy] = girarPonto(0, z, volta)
  return (forma, mat, o = {}) => {
    const noMeio = presa(forma, x, meio)
    if (q === 0) {
      cena.partes.push(P(noMeio, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
      return
    }
    const textura = o.textura
    cena.partes.push(
      P(girarForma(noMeio, volta), mat, {
        ...o,
        dx,
        dy,
        eixo: (o.eixo ?? 0) - q * QUARTO,
        textura:
          textura === undefined
            ? undefined
            : (u, v, tx, ty, p, s, escala) => {
                const [sx, sy] = girarPonto(tx, ty, q)
                textura(u, v, sx, sy, p, s, escala)
              },
      }),
    )
  }
}

// ---------- o pano e as vistas dele ----------

/** O pano no referencial do objeto: de `x0` a `x1`, a tralha de cima na linha da vara e a de baixo recuada. */
interface Rede {
  readonly x0: number
  readonly x1: number
  readonly y: number
  readonly recuo: number
  readonly zTopo: number
  readonly zPe: number
  /** O comprimento do pano da tralha de cima à de baixo. */
  readonly queda: number
}

/** De onde se olha um ponto no espaço (x, y, z) do objeto: o lugar dele na imagem. */
type Olhar = (x: number, y: number, z: number) => Ponto

const DE_CIMA: Olhar = (x, y) => [x, y]

function deFrente(q: number): Olhar {
  return (x, y, z) => {
    const [tx, ty] = girarPonto(x, y, q)
    return [tx, ty - z]
  }
}

function naSombra(q: number): Olhar {
  return (x, y, z) => {
    const [tx, ty] = girarPonto(x, y, q)
    return [tx + SOMBRA_X * z, ty + SOMBRA_Y * z]
  }
}

/**
 * Uma VISTA do pano: o ponto (x ao longo da rede, t de 0 na tralha de cima a 1
 * na de baixo) vai para a imagem por uma conta linear, que se desfaz para achar
 * a malha em cada pixel.
 */
interface Vista {
  readonly ax: number
  readonly bx: number
  readonly cx: number
  readonly ay: number
  readonly by: number
  readonly cy: number
  /** Px da imagem por px do pano (a média das duas direções). */
  readonly escala: number
}

function vistaDoPano(r: Rede, olhar: Olhar): Vista {
  const em = (x: number, t: number): Ponto => olhar(x, r.y - r.recuo * t, r.zTopo + (r.zPe - r.zTopo) * t)
  const [x0, y0] = em(0, 0)
  const [x1, y1] = em(1, 0)
  const [x2, y2] = em(0, 1)
  const ax = x1 - x0
  const bx = x2 - x0
  const ay = y1 - y0
  const by = y2 - y0
  return { ax, bx, cx: x0, ay, by, cy: y0, escala: Math.sqrt(Math.abs(ax * by - bx * ay) / r.queda) }
}

function naVista(v: Vista, x: number, t: number): Ponto {
  return [v.ax * x + v.bx * t + v.cx, v.ay * x + v.by * t + v.cy]
}

/** O ponto do pano (x, t) que cai no ponto (px, py) da imagem. */
function noPano(v: Vista, px: number, py: number): Ponto {
  const det = v.ax * v.by - v.bx * v.ay
  const dx = px - v.cx
  const dy = py - v.cy
  return [(dx * v.by - v.bx * dy) / det, (v.ax * dy - dx * v.ay) / det]
}

/** O pano inteiro numa vista (o quadrilátero das quatro pontas). */
function panoNaVista(v: Vista, r: Rede): Forma {
  return poligono([naVista(v, r.x0, 0), naVista(v, r.x1, 0), naVista(v, r.x1, 1), naVista(v, r.x0, 1)])
}

/** A distância (px do pano) ao fio mais perto e ao nó mais perto, no ponto (x, l) do pano; `saida` = [fio, nó]. */
function malhaEm(x: number, l: number, saida: Float32Array): void {
  const a = x / MALHA_X + l / MALHA_Y
  const b = x / MALHA_X - l / MALHA_Y
  const da = Math.abs(a - Math.round(a))
  const db = Math.abs(b - Math.round(b))
  saida[0] = Math.min(da, db) / GRADIENTE_DA_MALHA
  saida[1] = Math.hypot(da, db) / GRADIENTE_DA_MALHA
}

const MALHA = new Float32Array(2)

/** O pano não fica liso: os losangos ondulam um pouco (px do pano), como a rede que secou amarrotada. */
const ONDA_DA_MALHA = 0.9

/** O x do pano com a onda, no ponto (x, l): a mesma onda no pano e na sombra dele. */
function comOnda(x: number, l: number): number {
  return x + Math.sin(l * 0.11 + x * 0.05) * ONDA_DA_MALHA + Math.sin(x * 0.17 + l * 0.04) * ONDA_DA_MALHA * 0.5
}

/** O pano: só o fio e os nós são pintados (o resto fica transparente); fino demais, o fio vira um véu. */
function texDoPano(v: Vista, r: Rede): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    const [mx, t] = noPano(v, x, y)
    malhaEm(comOnda(mx, t * r.queda), t * r.queda, MALHA)
    const px = escala * v.escala
    const fio = limitar(0.5 + (FIO / 2 - MALHA[0]) * px, 0, 1)
    const no = limitar(0.5 + (RAIO_DO_NO - MALHA[1]) * px, 0, 1)
    const cobre = Math.max(fio, no)
    s[5] = cobre
    if (cobre <= 0) return
    s[3] += (no > fio ? -0.08 : 0.03) + ruido(mx * 0.35 + p.semente, t * 7) * 0.06
  }
}

/** A sombra da malha no chão: os fios, as tralhas e as cortiças, na vista da sombra. */
function sombraDoPano(v: Vista, r: Rede): Forma {
  const regiao = panoNaVista(v, r)
  const boias: Ponto[] = []
  for (let x = r.x0 + BOIA.passo / 2; x < r.x1; x += BOIA.passo) boias.push(naVista(v, x, 0))
  const raioDaBoia = BOIA.raio * v.escala
  return {
    b: [regiao.b[0] - raioDaBoia, regiao.b[1] - raioDaBoia, regiao.b[2] + raioDaBoia, regiao.b[3] + raioDaBoia],
    d(x, y) {
      let d = FORA_DA_ANCORA
      for (const [bx, by] of boias) d = Math.min(d, Math.hypot(x - bx, y - by) - raioDaBoia)
      const fora = regiao.d(x, y)
      if (fora > 2) return Math.min(d, fora)
      const [mx, t] = noPano(v, x, y)
      malhaEm(comOnda(mx, t * r.queda), t * r.queda, MALHA)
      // As tralhas: as beiras de cima e de baixo do pano, mais grossas que o fio.
      const tralha = Math.min(Math.abs(t), Math.abs(1 - t)) * r.queda * v.escala - RAIO_DA_TRALHA
      return Math.min(d, Math.max(fora, Math.min(MALHA[0] * v.escala - FIO_NA_SOMBRA, tralha)))
    },
  }
}

/** A cortiça: os poros escuros e o furo da tralha ao comprido. */
const texDaCortica: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.9 + p.semente, y * 0.9) * 0.08
  if (hash(Math.floor(x * 1.6), Math.floor(y * 1.6), p.semente) > 0.84) s[3] -= 0.16
}

/**
 * As peças do pano numa vista: o pano, a tralha de baixo com os chumbos, as das
 * pontas e as cortiças. De cima a tralha de cima fica debaixo da vara e as
 * cortiças descem um tico pelo pano, para aparecer do lado de lá dela.
 */
function porPano(por: Por, v: Vista, r: Rede, deCima: boolean, semente: number): void {
  por(panoNaVista(v, r), REDE, { tabua: 0, bisel: 0.2, contorno: 0, semente, textura: texDoPano(v, r) })
  const linha = (t0: number, t1: number, x0: number, x1: number, raio: number, sem: number): void => {
    const [ax, ay] = naVista(v, x0, t0)
    const [bx, by] = naVista(v, x1, t1)
    por(capsula(ax, ay, bx, by, raio), TRALHA, { tabua: 0, bisel: raio, contorno: 0.24, semente: sem })
  }
  linha(1, 1, r.x0, r.x1, RAIO_DA_TRALHA, semente + 1)
  for (let x = r.x0 + CHUMBO.passo / 2, i = 0; x < r.x1; x += CHUMBO.passo, i += 1) {
    const [ax, ay] = naVista(v, x - CHUMBO.meio, 1)
    const [bx, by] = naVista(v, x + CHUMBO.meio, 1)
    por(capsula(ax, ay, bx, by, CHUMBO.raio), CHUMBADA, { tabua: 0, bisel: 0.8, contorno: 0.3, metal: 0.3, semente: semente + 10 + i })
  }
  if (!deCima) linha(0, 0, r.x0, r.x1, RAIO_DA_TRALHA, semente + 2)
  linha(0, 1, r.x0, r.x0, RAIO_DA_TRALHA * 0.8, semente + 3)
  linha(0, 1, r.x1, r.x1, RAIO_DA_TRALHA * 0.8, semente + 4)
  const tDasBoias = deCima ? BOIAS_DESCEM_DE_CIMA : 0
  for (let x = r.x0 + BOIA.passo / 2, i = 0; x < r.x1; x += BOIA.passo, i += 1) {
    const [ax, ay] = naVista(v, x - BOIA.meio, tDasBoias)
    const [bx, by] = naVista(v, x + BOIA.meio, tDasBoias)
    por(capsula(ax, ay, bx, by, BOIA.raio), CORTICA, { tabua: 0, bisel: 1.4, contorno: 0.3, tom: 0.94 + hash(i, 3, semente) * 0.14, semente: semente + 40 + i, textura: texDaCortica })
  }
}

// ---------- as estacas e a vara ----------

/** O topo cortado da estaca: os anéis e a medula. */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.3 + p.semente, y * 0.3) * 0.6
    s[3] += Math.sin(longe * 4.4) * 0.05 + 0.04
  }
}

function montarArmacao(c: ContextoDoMovel, cena: Cena, estacas: readonly number[], yv: number): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  for (const [i, xe] of estacas.entries()) {
    const topo = elipse(xe, yv, RAIO_DA_ESTACA, RAIO_DA_ESTACA)
    cena.sombras.push({ forma: topo, z: ALTURA_DA_ESTACA, forca: 0.26 }, contato(topo, 0.3))
    // O topo leva a maior caixa da estaca: a frente dela na 3/4 sai de madeira, e não da corda da amarração.
    const caixa: Caixa = [xe - RAIO_DA_ESTACA * 1.9, yv - RAIO_DA_ESTACA * 1.9, xe + RAIO_DA_ESTACA * 1.9, yv + RAIO_DA_ESTACA * 1.9]
    L.push(P(naCaixa(topo, caixa), mad, { tabua: 0, bisel: 1.2, tom: 0.9, contorno: 0.3, semente: 7700 + i, textura: texDoTopo(xe, yv), projeta: { dist: 1, forca: 0.3 } }))
  }
  // A vara, amarrada logo abaixo da ponta das estacas: a caixa dela tem o meio entre duas estacas (fora delas).
  const xa = estacas[0] - SOBRA_DA_VARA
  const xb = estacas[estacas.length - 1] + SOBRA_DA_VARA
  const vara = capsula(xa, yv, xb, yv, RAIO_DA_VARA)
  cena.sombras.push({ forma: vara, z: ALTURA_DA_VARA, solta: true, forca: 0.22 })
  L.push(P(presa(vara, (estacas[0] + estacas[1]) / 2, yv), mad, { eixo: 0, tabua: 0, bisel: RAIO_DA_VARA, tom: 1.02, contorno: 0.3, semente: 7720, projeta: { dist: 1.2, forca: 0.3 } }))
  // A amarração em cada estaca: duas voltas de corda em xis por cima da vara.
  for (const [i, xe] of estacas.entries()) {
    for (const lado of [-1, 1]) {
      L.push(P(capsula(xe - 2.4, yv - lado * 2.6, xe + 2.4, yv + lado * 2.6, 0.75), TRALHA, { tabua: 0, bisel: 0.7, contorno: 0.28, semente: 7730 + i * 2 + (lado > 0 ? 1 : 0) }))
    }
  }
}

// ---------- o monte, a boia de vidro e os peixes ----------

/** A rede amontoada: as dobras grandes e, de perto, o fio em losangos tortos, com o fundo do monte na sombra. */
const texDoMonte: Textura = (_u, _v, x, y, p, s, escala) => {
  s[3] += ruido(x * 0.16 + p.semente, y * 0.16) * 0.24
  if (escala < 1.2) return
  const wx = x + ruido(x * 0.09 + p.semente, y * 0.09) * 7
  const wy = y + ruido(x * 0.09, y * 0.09 + p.semente) * 7
  const a = wx / (MALHA_X * 0.7) + wy / (MALHA_Y * 0.5)
  const b = wx / (MALHA_X * 0.7) - wy / (MALHA_Y * 0.5)
  const fio = Math.min(Math.abs(a - Math.round(a)), Math.abs(b - Math.round(b)))
  s[3] += limitar(1 - fio / 0.14, 0, 1) * 0.3 - 0.12
}

/** A rede de corda da boia de vidro vista de cima: oito meridianos finos do alto até a beira e um anel no meio. */
function texDaRedeDaBoia(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const dx = x - cx
    const dy = y - cy
    const longe = Math.hypot(dx, dy)
    const f = (Math.atan2(dy, dx) / VOLTA_INTEIRA) * 8
    const meridiano = Math.abs(f - Math.round(f)) * (VOLTA_INTEIRA / 8) * longe
    const anel = Math.abs(longe - r * 0.62)
    s[5] = limitar(0.5 + (0.3 - Math.min(meridiano, anel)) * escala, 0, 1) * 0.85
  }
}

interface Peixe {
  readonly x: number
  readonly y: number
  readonly ang: number
  readonly comprimento: number
  readonly largura: number
}

/** O contorno do corpo do peixe e o rabo, em frações (como no barril de peixe). */
const CORPO_DO_PEIXE: readonly Ponto[] = [[-0.36, 0.12], [-0.2, 0.32], [0, 0.46], [0.15, 0.5], [0.32, 0.42], [0.44, 0.24], [0.5, 0.04]]
const RABO_DO_PEIXE: readonly Ponto[] = [[-0.34, 0.08], [-0.52, 0.46], [-0.47, 0], [-0.52, -0.46], [-0.34, -0.08]]

/** O flanco: o lombo escuro de um lado, a barriga clara do outro e, de perto, as fileiras de escamas. */
function texDoPeixe(f: Peixe): Textura {
  const co = Math.cos(f.ang)
  const si = Math.sin(f.ang)
  const meia = f.largura * 0.5
  return (_u, _v, x, y, _p, s, escala) => {
    const ao = (x - f.x) * co + (y - f.y) * si
    const atraves = (-(x - f.x) * si + (y - f.y) * co) / meia
    misturarEm(s, LOMBO, limitar01((atraves - 0.12) / 0.62) * 0.88)
    misturarEm(s, BARRIGA, limitar01((-atraves - 0.22) / 0.55) * 0.75)
    if (escala < 1.5) return
    const fileira = Math.floor((atraves + 1) * 3.2)
    const fase = ao / 1.05 + (fileira & 1) * 0.5
    if (fase - Math.floor(fase) < 0.24) s[3] -= 0.08
  }
}

function limitar01(t: number): number {
  return limitar(t, 0, 1)
}

function montarPeixe(P: CriarPeca, L: Peca[], f: Peixe, semente: number): void {
  const co = Math.cos(f.ang)
  const si = Math.sin(f.ang)
  const em = ([ao, atraves]: Ponto): Ponto => {
    const a = ao * f.comprimento
    const t = atraves * f.largura
    return [f.x + a * co - t * si, f.y + a * si + t * co]
  }
  const projeta = { dist: 0.9, forca: 0.32, suave: 0.7 }
  L.push(P(poligono(RABO_DO_PEIXE.map(em)), RABO, { bisel: 0.4, contorno: 0.28, semente, projeta }))
  const contorno = [...CORPO_DO_PEIXE.map(em), ...[...CORPO_DO_PEIXE].reverse().map(([ao, t]) => em([ao, -t]))]
  L.push(P(poligono(contorno), { classe: 'liso', rgb: FLANCO }, { bisel: f.largura * 0.42, contorno: 0.3, metal: 0.32, semente: semente + 1, textura: texDoPeixe(f), projeta }))
  const [gx, gy] = em([0.27, 0])
  L.push(P(elipseGirada(gx, gy, f.largura * 0.08, f.largura * 0.4, f.ang), GUELRA, { bisel: 0, contorno: 0, alfa: 0.55, semente: semente + 2 }))
  const [ox, oy] = em([0.36, 0.1])
  const raio = f.largura * 0.26
  L.push(P(elipse(ox, oy, raio, raio), IRIS, { bisel: 0.2, contorno: 0.12, semente: semente + 3 }))
  L.push(P(elipse(ox, oy, raio * 0.6, raio * 0.6), PUPILA, { bisel: 0, contorno: 0 }))
}

function montarCanto(c: ContextoDoMovel, cena: Cena, q: number): void {
  const P = c.peca
  const L = cena.partes
  const cx = MONTE[0] * c.hw
  const cy = MONTE[1] * c.hh
  // O monte: quatro bolos de rede, um por cima do outro; a caixa é a do maior, para a frente na 3/4 ser de rede.
  const monte = uniao(uniao(elipse(cx, cy, 15, 9.5), elipse(cx - 8, cy + 2, 8, 6)), uniao(elipse(cx + 9, cy - 2.5, 8.5, 6.2), elipse(cx + 3, cy + 4, 9, 5.5)))
  cena.sombras.push({ forma: monte, z: ALTURA_DO_MONTE, forca: 0.3 }, contato(monte, 0.34))
  L.push(P(monte, { classe: 'liso', rgb: REDE.rgb }, { tabua: 0, bisel: 5, tom: 0.8, contorno: 0.26, semente: 7800, textura: texDoMonte }))
  // Cortiças e um pedaço da tralha de chumbo aparecendo por cima do monte.
  const pedacos: readonly (readonly [number, number, number])[] = [[-6, -2.5, 0.5], [4, 3, -0.4]]
  pedacos.forEach(([bx, by, a], i) => {
    const ux = Math.cos(a) * CORTICA_NO_MONTE.meio
    const uy = Math.sin(a) * CORTICA_NO_MONTE.meio
    L.push(P(capsula(cx + bx - ux, cy + by - uy, cx + bx + ux, cy + by + uy, CORTICA_NO_MONTE.raio), CORTICA, { tabua: 0, bisel: 1.4, contorno: 0.3, semente: 7810 + i, textura: texDaCortica, projeta: { dist: 0.8, forca: 0.3 } }))
  })
  L.push(P(cadeia([[cx + 8, cy + 3.5], [cx + 11, cy + 1], [cx + 13, cy + 3.8]], RAIO_DA_TRALHA), TRALHA, { bisel: 0.6, contorno: 0.26, semente: 7815 }))
  for (const [i, [bx, by]] of ([[cx + 9.4, cy + 2.2], [cx + 12.2, cy + 2.2]] as const).entries()) {
    L.push(P(capsula(bx - CHUMBO.meio, by, bx + CHUMBO.meio, by, CHUMBO.raio), CHUMBADA, { tabua: 0, bisel: 0.8, contorno: 0.3, metal: 0.3, semente: 7816 + i }))
  }
  // A boia de vidro: a bola esverdeada, a luz que o vidro junta do lado de baixo à direita NA TELA, o brilho e a rede de corda.
  const r = RAIO_DA_BOIA_DE_VIDRO
  const vx = cx + BOIA_DE_VIDRO[0]
  const vy = cy + BOIA_DE_VIDRO[1]
  const bola = elipse(vx, vy, r, r)
  // Solta na altura do meio: na 3/4 a bola é o mesmo círculo subido um raio, encostando no chão (sem a coluna, que a fazia lata).
  cena.sombras.push({ forma: bola, z: r, solta: true, forca: 0.26 }, contato(bola, 0.34))
  L.push(P(bola, VIDRO, { tabua: 0, bisel: r, contorno: 0.3, metal: 0.6, alfa: 0.94, semente: 7820 }))
  const [lx, ly] = girarPonto(1.7, 1.9, (4 - q) % 4)
  L.push(P(elipse(vx + lx, vy + ly, r * 0.36, r * 0.36), LUZ_NO_VIDRO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 1, semente: 7821 }))
  const [bx, by] = girarPonto(-1.8, -2, (4 - q) % 4)
  L.push(P(elipse(vx + bx, vy + by, 0.8, 0.8), BRILHO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.9, semente: 7822 }))
  L.push(P(bola, TRALHA, { tabua: 0, bisel: 0.3, contorno: 0, semente: 7823, textura: texDaRedeDaBoia(vx, vy, r) }))
  // Os dois peixes esquecidos no chão, com a mancha molhada embaixo.
  const peixes: readonly Peixe[] = [
    { x: cx + 37, y: cy + 4.5, ang: 0.35, comprimento: 15, largura: 5 },
    { x: cx + 49, y: cy - 1, ang: -2.6, comprimento: 13, largura: 4.4 },
  ]
  // Na rede encolhida (1 casa) o segundo peixe sairia da pegada: só entra o que cabe.
  peixes.filter((f) => f.x + f.comprimento * 0.55 < c.hw).forEach((f, i) => {
    L.push(P(elipseGirada(f.x, f.y, f.comprimento * 0.6, f.largura * 0.9, f.ang), MOLHADO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.28, suave: 1.6, semente: 7830 + i }))
    cena.sombras.push(contato(elipseGirada(f.x, f.y, f.comprimento * 0.46, f.largura * 0.45, f.ang), 0.3))
    montarPeixe(P, L, f, 7840 + i * 8)
  })
}

export const montarRedeDePesca: MontarMovel = (c, cena) => {
  const { hw, h } = c
  const P = c.peca
  const q = quartosDoGiro(c.giro)
  const yv = LINHA_DA_VARA * h
  // As estacas repartem o comprimento em vãos de ~0,9 casa (três estacas em 2 casas, quatro em 3).
  const vaos = Math.max(1, Math.round((c.w - 2 * FOLGA_DAS_ESTACAS) / VAO_DE_PARTIDA))
  const passo = (c.w - 2 * FOLGA_DAS_ESTACAS) / vaos
  const estacas = Array.from({ length: vaos + 1 }, (_, i) => -hw + FOLGA_DAS_ESTACAS + i * passo)
  const zTopo = ALTURA_DA_VARA - ABAIXO_DA_VARA
  const rede: Rede = {
    x0: estacas[0] + RAIO_DA_ESTACA,
    x1: estacas[estacas.length - 1] - RAIO_DA_ESTACA,
    y: yv,
    recuo: RECUO_DO_PE,
    zTopo,
    zPe: ALTURA_DO_PE,
    queda: Math.hypot(RECUO_DO_PE, zTopo - ALTURA_DO_PE),
  }
  const meioX = (rede.x0 + rede.x1) / 2
  montarCanto(c, cena, q)
  // A sombra da malha no chão, calculada na tela e devolvida ao referencial do objeto (girada, a 3/4 gira a cena depois).
  cena.sombras.push({ forma: girarForma(sombraDoPano(vistaDoPano(rede, naSombra(q)), rede), (4 - q) % 4), z: 0, suave: SOMBRA_DA_MALHA.suave, forca: SOMBRA_DA_MALHA.forca })
  // De cima (só sem giro): o pano em escorço, com a âncora no meio da faixa, fora das estacas e da vara.
  if (q === 0) porPano(grupoDeCima(P, cena, meioX, yv - RECUO_DO_PE / 2), vistaDoPano(rede, DE_CIMA), rede, true, 7600)
  montarArmacao(c, cena, estacas, yv)
  // De frente (só na 3/4): a âncora no chão debaixo do meio da tralha de baixo, as caixas em volta do meio do pano.
  const [bx, by] = girarPonto(meioX, yv - RECUO_DO_PE, q)
  const meioDaAltura = (zTopo + ALTURA_DO_PE) / 2
  porPano(grupoDeFrente(P, cena, q, bx, by, by - meioDaAltura), vistaDoPano(rede, deFrente(q)), rede, false, 7650)
}
