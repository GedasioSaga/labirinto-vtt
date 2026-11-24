/**
 * PEDESTAL COM CRISTAL (lote L06 de 24/11/2026, item 54, dos cantos da nave da cripta do mapa 8; desenho próprio, só a
 * ideia do objeto). A base de CANTO: três degraus em quarto de círculo, de blocos de pedra em leque, encostados nas
 * duas paredes (o canto da sala é o canto de cima à esquerda da pegada), e no patamar de cima o NINHO DE CRISTAIS
 * ciano: o grande quase em pé e os outros abrindo para dentro da sala. Os cristais acendem a pedra em volta (o banho
 * de luz fria pintado nos degraus); a luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): cada degrau é o quarto de disco em fatias, e a 3/4
 * mostra o espelho curvo com as juntas de pé; cada cristal é um prisma sextavado em fatias, inclinado, que afina até
 * a ponta. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`; o ciano e o musgo são fixos.
 *
 * ESTE ARQUIVO TAMBÉM É O APOIO DO LOTE L06 ("Cripta: cristal e chama fria"): o CIANO FRIO, o prisma em fatias
 * (`fatiarCristal`), o ninho (`ninhoDeCristais`), o halo e o banho de luz fria na pedra. O sarcófago de cristais, o
 * relicário, a laje tumular acesa, a arandela, o braseiro de chama fria, o arcossólio e o selo de cristal importam
 * daqui, para a cripta ler como um conjunto.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, rumoDaSombra, sombraNoAr, type Fatiador } from './pilhaDeFatias'
import { disco, ESCURO_DA_PEDRA, lisa, luzDaNormal } from './apoioDasReferencias'

// ---------- o ciano frio do lote L06 ----------

/**
 * O CIANO FRIO do lote, do fundo da face na sombra ao reflexo da quina: contido (saturação HSV de 0,05 a 0,55, abaixo
 * do teto de 0,62 dos móveis), puxado para o azul-acinzentado, nunca neon.
 */
export const CIANO = {
  fundo: [0x3a, 0x72, 0x80],
  escuro: [0x52, 0x94, 0xa2],
  meio: [0x7a, 0xbc, 0xc7],
  claro: [0xae, 0xe0, 0xe5],
  reflexo: [0xe6, 0xf6, 0xf4],
} as const satisfies Record<string, Rgb>

/** A luz fria que o cristal joga em volta: o tom do halo e do banho na pedra. */
export const LUZ_FRIA: Rgb = [0x9c, 0xdc, 0xe6]
/** O material das peças de cristal e de luz: a cor sai da textura. */
export const CRISTAL: MaterialDaPeca = { classe: 'liso', rgb: CIANO.meio }
/** A sombra pintada em cima da pedra (a fatia não projeta): o escuro frio da cripta. */
export const SOMBRA_PINTADA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x30, 0x34] }
/** O musgo do túmulo de pedra e da laje tumular. */
export const MUSGO_DA_CRIPTA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }

const VOLTA = Math.PI * 2
const SEXTO = Math.PI / 3

/** O tom do cristal pela luz da face, de 0 (a face no escuro) a 1 (a face acesa). */
export function tomDoCristal(t: number): Rgb {
  const k = limitar01(t)
  if (k < 0.25) return misturar(CIANO.fundo, CIANO.escuro, k / 0.25)
  if (k < 0.6) return misturar(CIANO.escuro, CIANO.meio, (k - 0.25) / 0.35)
  return misturar(CIANO.meio, CIANO.claro, (k - 0.6) / 0.4)
}

// ---------- o prisma em fatias ----------

/** Um cristal: o pé (px, no objeto), o raio do sextavado, a altura, a inclinação (px por px de altura) e o giro das faces. */
export interface Cristal {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly alto: number
  readonly ix: number
  readonly iy: number
  readonly fase: number
}

/**
 * O passo das fatias do prisma de pé (px; o tombado ganha fatias mais juntas, senão a beira sai em serrilha) e de que
 * fração da altura para cima ele afina até a ponta.
 */
const PASSO_DO_CRISTAL = 0.6
const OMBRO = 0.58
/** A fatia mais fina que ainda entra (px de raio): menor que isto some no pixel. */
const RAIO_MINIMO = 0.3
/** Quanto a luz da face (±0,13 de `luzDaNormal`) abre o tom, e o tom da face de lado. */
const CONTRASTE_DAS_FACES = 5
const TOM_DE_LADO = 0.35
/** O pé é mais fundo (a luz de dentro sobe para a ponta): quanto escurece e até que fração da altura. */
const PE_ESCURO = 0.3
const ATE_ONDE_O_PE = 0.34
/** A ponta acende: o que soma ao tom no ombro e no bico. */
const TOM_DA_PONTA: readonly [number, number] = [0.05, 0.22]
/** O fio de reflexo na quina entre duas faces: a meia largura (px) e a força na quina mais acesa. */
const FIO_DA_QUINA = 0.42
const FORCA_DO_FIO = 0.6
/** Quanto do cristal é emissão: essa parte não pega a sombra de cima (ele é a luz). */
const EMISSAO_DO_CRISTAL = 0.55

/** As seis faces de uma fatia: o tom de cada uma pela direção em 3D e o fio de reflexo de cada quina. */
function texDaFatia(cr: Cristal, cx: number, cy: number, t: number, q: number, apagado: number): Textura {
  const naPonta = t >= OMBRO
  const subida = naPonta ? (t - OMBRO) / (1 - OMBRO) : 0
  const tons: number[] = []
  for (let k = 0; k < 6; k += 1) {
    const a = cr.fase + (k + 0.5) * SEXTO
    const nx = Math.cos(a)
    const ny = Math.sin(a)
    // A face de costas para a inclinação olha para cima; as da ponta, todas.
    const nz = naPonta ? 0.9 : -0.6 * (nx * cr.ix + ny * cr.iy)
    const daPonta = naPonta ? TOM_DA_PONTA[0] + (TOM_DA_PONTA[1] - TOM_DA_PONTA[0]) * subida : 0.08 * t - PE_ESCURO * (1 - limitar01(t / ATE_ONDE_O_PE))
    tons.push(TOM_DE_LADO + luzDaNormal(nx, ny, nz, q) * CONTRASTE_DAS_FACES + daPonta)
  }
  const cores = tons.map((tom) => tomDoCristal(tom * (1 - apagado * 0.45)))
  // A quina k fica entre a face k - 1 e a face k: acende mais onde as duas faces são claras.
  const fios = tons.map((tom, k) => FORCA_DO_FIO * limitar01(0.25 + 0.75 * Math.max(tom, tons[(k + 5) % 6])) * (1 - apagado))
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    const volta = (Math.atan2(dy, dx) - cr.fase) / SEXTO
    const inteiro = Math.floor(volta)
    const k = ((inteiro % 6) + 6) % 6
    const dentro = volta - inteiro
    const cor = cores[k]
    let r = cor[0]
    let g = cor[1]
    let b = cor[2]
    const quina = dentro < 0.5 ? k : (k + 1) % 6
    const ateAQuina = (dentro < 0.5 ? dentro : 1 - dentro) * SEXTO * Math.sqrt(dx * dx + dy * dy)
    if (ateAQuina < FIO_DA_QUINA) {
      const w = (1 - ateAQuina / FIO_DA_QUINA) * fios[quina]
      r += (CIANO.reflexo[0] - r) * w
      g += (CIANO.reflexo[1] - g) * w
      b += (CIANO.reflexo[2] - b) * w
    }
    s[0] = r
    s[1] = g
    s[2] = b
    s[4] = EMISSAO_DO_CRISTAL * (1 - apagado)
  }
}

/**
 * O cristal em FATIAS na pilha `f`, com o pé na altura `z0`: o sextavado sobe pela inclinação e afina do ombro ao
 * bico. `apagado` (0 a 1) tira a luz de dentro (o cristal morto, só pedra azulada).
 */
export function fatiarCristal(f: Fatiador, camada: number, z0: number, cr: Cristal, semente: number, apagado = 0): void {
  const passo = PASSO_DO_CRISTAL / (1 + 0.9 * Math.hypot(cr.ix, cr.iy))
  for (const h of alturas(0, cr.alto, passo)) {
    const t = h / cr.alto
    const r = t < OMBRO ? cr.r : cr.r * (1 - (t - OMBRO) / (1 - OMBRO))
    if (r < RAIO_MINIMO) continue
    const cx = cr.x + cr.ix * h
    const cy = cr.y + cr.iy * h
    const pontos: Ponto[] = []
    for (let k = 0; k < 6; k += 1) pontos.push([cx + Math.cos(cr.fase + k * SEXTO) * r, cy + Math.sin(cr.fase + k * SEXTO) * r])
    f.fatia(camada, z0 + h, poligono(pontos), CRISTAL, lisa(1, texDaFatia(cr, cx, cy, t, f.q, apagado), semente))
  }
}

/** O ninho: o meio, o raio em que os pés se espalham, a altura do maior, quantos e para onde abrem. */
export interface Ninho {
  readonly cx: number
  readonly cy: number
  readonly raio: number
  readonly alto: number
  readonly quantos: number
  readonly semente: number
  /** O arco de azimutes (radianos; 0 = para a direita, pi/2 = para baixo) em que os de fora abrem. Ausente = a volta toda. */
  readonly de?: number
  readonly ate?: number
  /** Quanto os de fora tombam para fora (px por px de altura). */
  readonly tombo?: number
}

/**
 * Os cristais de um ninho, sempre os mesmos para a mesma semente: o GRANDE no meio, quase em pé (pende um pouco para
 * o meio do arco), e os outros em volta, menores e tombados para fora, um deles o segundo maior.
 */
export function ninhoDeCristais(n: Ninho): Cristal[] {
  const de = n.de ?? 0
  const ate = n.ate ?? VOLTA
  const meio = (de + ate) / 2
  const fechado = ate - de < VOLTA - 0.01
  const pende = fechado ? 0.26 : 0.08
  const tombo = n.tombo ?? 0.8
  const lista: Cristal[] = [
    {
      x: n.cx,
      y: n.cy,
      r: n.raio * 0.4,
      alto: n.alto,
      ix: Math.cos(meio) * pende + (hash(1, 0, n.semente) - 0.5) * 0.1,
      iy: Math.sin(meio) * pende + (hash(2, 0, n.semente) - 0.5) * 0.1,
      fase: hash(3, 0, n.semente) * SEXTO,
    },
  ]
  const fora = n.quantos - 1
  for (let i = 0; i < fora; i += 1) {
    const fracao = fechado ? (i + 0.5 + (hash(i, 4, n.semente) - 0.5) * 0.5) / fora : (i + (hash(i, 4, n.semente) - 0.5) * 0.5) / fora
    const a = de + (ate - de) * fracao
    const d = n.raio * (0.55 + 0.35 * hash(i, 5, n.semente))
    // O segundo maior é o primeiro de fora; os outros, de 0,36 a 0,62 do grande.
    const tamanho = i === 0 ? 0.74 : 0.36 + 0.26 * hash(i, 6, n.semente)
    const abre = tombo * (0.75 + 0.5 * hash(i, 7, n.semente))
    lista.push({
      x: n.cx + Math.cos(a) * d,
      y: n.cy + Math.sin(a) * d,
      r: n.raio * (0.24 + 0.1 * hash(i, 8, n.semente)) * (i === 0 ? 1.15 : 1),
      alto: n.alto * tamanho,
      ix: Math.cos(a) * abre,
      iy: Math.sin(a) * abre,
      fase: hash(i, 9, n.semente) * SEXTO,
    })
  }
  return lista
}

/** A lasca de rocha em volta do pé de um cristal: seis quinas de raio sorteado (o corte reto do prisma não aparece). */
export function lascaDeRocha(cr: Cristal, semente: number): Forma {
  const pontos: Ponto[] = []
  for (let k = 0; k < 6; k += 1) {
    const a = k * SEXTO + hash(k, 1, semente) * 0.6
    const d = cr.r * (1.25 + 0.5 * hash(k, 2, semente))
    pontos.push([cr.x + Math.cos(a) * d, cr.y + Math.sin(a) * d])
  }
  return poligono(pontos)
}

/** A sombra de um cristal no plano em que ele pisa: do pé até a sombra do bico, para o lado da sombra NA TELA. */
export function sombraDoCristal(cr: Cristal, q: number): Forma {
  const [rx, ry] = rumoDaSombra(q)
  return capsula(cr.x, cr.y, cr.x + (cr.ix + rx) * cr.alto, cr.y + (cr.iy + ry) * cr.alto, cr.r * 0.85)
}

// ---------- a luz fria ----------

/** O halo frio: a luz do cristal com alfa que cai suave do meio (cx, cy) até os raios rx, ry. Toda emissão. */
export function texHaloFrio(cx: number, cy: number, rx: number, ry: number, alfa: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const d2 = Math.min(1, dx * dx + dy * dy)
    s[0] = LUZ_FRIA[0]
    s[1] = LUZ_FRIA[1]
    s[2] = LUZ_FRIA[2]
    s[4] = 1
    s[5] = alfa * (1 - d2) * (1 - d2)
  }
}

/** Uma fonte de luz fria na pedra: o meio, o raio em que ela cai a um terço e a força no meio (0 a 1). */
export interface FonteFria {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly forca: number
}

/** Teto do banho: a pedra nunca vira cristal. */
const BANHO_MAXIMO = 0.55

/** Quanto da luz fria das fontes chega ao ponto (0 a `BANHO_MAXIMO`). */
export function luzFriaEm(x: number, y: number, fontes: readonly FonteFria[]): number {
  let w = 0
  for (const f of fontes) {
    const d2 = ((x - f.x) * (x - f.x) + (y - f.y) * (y - f.y)) / (f.r * f.r)
    if (d2 < 4) w += f.forca * Math.exp(-d2 * 1.1)
  }
  return w > BANHO_MAXIMO ? BANHO_MAXIMO : w
}

/**
 * A textura `base` BANHADA pela luz fria das `fontes`: a cor da peça puxa para a luz perto delas, e essa parte não
 * escurece com a sombra (emissão). É o que diz "o cristal acende a pedra" sem depender da luz do mapa.
 */
export function banhada(base: Textura | null, fontes: readonly FonteFria[]): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const w = luzFriaEm(x, y, fontes)
    if (w <= 0.004) return
    s[0] += (LUZ_FRIA[0] - s[0]) * w
    s[1] += (LUZ_FRIA[1] - s[1]) * w
    s[2] += (LUZ_FRIA[2] - s[2]) * w
    if (w * 0.7 > s[4]) s[4] = w * 0.7
  }
}

/**
 * A textura `base` numa fatia de DENTRO da pilha, na altura `z`: o grão anda com a altura. Sem isso toda fatia lê o
 * mesmo ponto do grão e, na frente da 3/4, ele vira riscas de pé.
 */
export function graoNaAltura(base: Textura | null, z: number): Textura | null {
  if (base === null) return null
  return (u, v, x, y, p, s, escala) => base(u + z * 3.7, v + z * 5.3, x, y, p, s, escala)
}

// ---------- o pedestal ----------

/** Os três degraus: o raio (fração do menor lado da pegada), o alto (casas) e os blocos em leque de cada um. */
const DEGRAUS = [
  { raio: 0.98, alto: 0.1, blocos: 7, tom: 0.86 },
  { raio: 0.71, alto: 0.2, blocos: 5, tom: 0.93 },
  { raio: 0.45, alto: 0.31, blocos: 3, tom: 1 },
] as const
/** O passo das fatias dos degraus (px) e a meia largura da junta entre os blocos (px). */
const PASSO = 0.8
const JUNTA = 0.42
/** O friso gravado no patamar (px a partir da beira) e a meia largura dele. */
const FRISO = 3.6
const MEIO_FRISO = 0.55
/** O ninho: onde fica no patamar (fração do raio dele, pela diagonal), o raio (fração do raio do patamar) e a altura (casas). */
const NINHO = { em: 0.5, raio: 0.36, alto: 0.56, quantos: 6 } as const
/** Para onde os cristais abrem: para dentro da sala (do leste ao sul, com folga). */
const ARCO_DO_NINHO: readonly [number, number] = [-0.35, Math.PI / 2 + 0.35]
const SEMENTE = 5400

export const montarPedestalComCristal: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const lado = Math.min(c.w, c.h)
  // O canto da sala: o canto de cima à esquerda da pegada.
  const [ox, oy] = [-hw, -hh]
  const pegada = caixa(-hw, -hh, hw, hh)
  const quarto = (r: number): Forma => dentroDe(disco(ox, oy, r), pegada)
  const raios = DEGRAUS.map((d) => d.raio * lado - 0.5)
  const altos = DEGRAUS.map((d) => d.alto * g)
  const [sx, sy] = rumoDaSombra(q)

  // O ninho no patamar e as fontes de luz fria (o ninho inteiro e o cristal grande).
  const rPatamar = raios[2]
  const zPatamar = altos[2]
  const meio = rPatamar * NINHO.em * Math.SQRT1_2
  const cristais = ninhoDeCristais({ cx: ox + meio, cy: oy + meio, raio: rPatamar * NINHO.raio, alto: NINHO.alto * g, quantos: NINHO.quantos, de: ARCO_DO_NINHO[0], ate: ARCO_DO_NINHO[1], semente: SEMENTE })
  const fontes: FonteFria[] = [{ x: ox + meio, y: oy + meio, r: rPatamar * 0.9, forca: 0.36 }]

  const comPedra = (luz: (x: number, y: number) => number, grao: Textura | null = daPedra): Textura => (u, v, x, y, p, s, escala) => {
    if (grao !== null) grao(u, v, x, y, p, s, escala)
    s[3] += luz(x, y)
  }
  /** A junta de pé mais perto do ponto, num degrau de `blocos` blocos: a distância ao longo do arco (px) e o bloco. */
  const noLeque = (x: number, y: number, blocos: number): readonly [number, number] => {
    const volta = (Math.atan2(y - oy, x - ox) / (Math.PI / 2)) * blocos
    const bloco = Math.floor(volta)
    const dentro = volta - bloco
    return [Math.min(dentro, 1 - dentro) * (Math.PI / 2 / blocos) * Math.hypot(x - ox, y - oy), bloco]
  }

  DEGRAUS.forEach((d, k) => {
    const r = raios[k]
    const z0 = k === 0 ? 0 : altos[k - 1]
    const z1 = altos[k]
    const forma = quarto(r)
    // O ESPELHO curvo: a luz da face, as juntas de pé e o pé mais escuro.
    const espelho = (z: number): Textura =>
      banhada(
        comPedra((x, y) => {
          const a = Math.atan2(y - oy, x - ox)
          const [ateAJunta, bloco] = noLeque(x, y, d.blocos)
          return luzDaNormal(Math.cos(a), Math.sin(a), 0, q) + (ateAJunta < JUNTA ? -0.2 : 0) + 0.05 * (hash(bloco, k, SEMENTE + 1) - 0.5) - (z < z0 + 1 ? 0.08 : 0)
        }, graoNaAltura(daPedra, z)),
        fontes,
      )
    // O PISO do degrau: os blocos em leque, a sombra do degrau de cima, o pé dele e a beira gasta.
    const piso = banhada(
      comPedra((x, y) => {
        const rr = Math.hypot(x - ox, y - oy)
        const [ateAJunta, bloco] = noLeque(x, y, d.blocos)
        let luz = 0.08 * (hash(bloco, k, SEMENTE + 2) - 0.5) + (ateAJunta < JUNTA ? -0.26 : 0)
        if (k < 2) {
          const dz = altos[k + 1] - z1
          const naSombra = raios[k + 1] - Math.hypot(x - ox - sx * dz * 1.6, y - oy - sy * dz * 1.6)
          luz -= 0.17 * limitar01(0.5 + naSombra / 1.6)
          luz -= 0.1 * limitar01(1 - (rr - raios[k + 1]) / 1.8)
        } else if (Math.abs(rr - (r - FRISO)) < MEIO_FRISO) {
          luz -= 0.22
        }
        if (rr > r - 1.5) luz += 0.05 + 0.05 * ruido(x * 0.5 + 3, y * 0.5)
        return luz
      }),
      fontes,
    )
    for (const z of alturas(z0, z1, PASSO)) {
      const topo = z >= z1 - 1e-6
      f.fatia(0, z, forma, pedra, topo ? { tabua: 0, bisel: 1.1, tom: d.tom, contorno: 0.26, textura: piso, semente: SEMENTE + 10 + k } : lisa(0.78, espelho(z), SEMENTE + 20 + k))
    }
  })

  // O MUSGO nos cantos da parede (em cima dos degraus de baixo).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.5, suave: 0.9 }
  f.fatia(1, altos[0] + 0.2, dentroDe(elipse(ox + raios[0] * 0.86, oy + 1.6, 4.6, 2.2), menos(quarto(raios[0]), disco(ox, oy, raios[1]))), MUSGO_DA_CRIPTA, { ...musgo, semente: SEMENTE + 30 })
  f.fatia(1, altos[1] + 0.2, dentroDe(elipse(ox + 1.4, oy + raios[1] * 0.84, 2, 3.8), menos(quarto(raios[1]), disco(ox, oy, raios[2]))), MUSGO_DA_CRIPTA, { ...musgo, alfa: 0.42, semente: SEMENTE + 31 })

  // No patamar: o halo frio, a sombra pintada de cada cristal e as lascas de rocha dos pés.
  const patamar = quarto(rPatamar)
  const rHalo = rPatamar * 0.92
  f.fatia(1, zPatamar + 0.1, dentroDe(elipse(ox + meio, oy + meio, rHalo, rHalo), patamar), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(ox + meio, oy + meio, rHalo, rHalo, 0.22), semente: SEMENTE + 40 })
  cristais.forEach((cr, i) => {
    f.fatia(1, zPatamar + 0.2, dentroDe(sombraDoCristal(cr, q), patamar), SOMBRA_PINTADA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 1.1, semente: SEMENTE + 50 + i })
    f.fatia(2, zPatamar + 0.5, lascaDeRocha(cr, SEMENTE + 60 + i), pedra, { tabua: 0, bisel: 0.7, tom: 0.84 + 0.12 * hash(i, 3, SEMENTE), contorno: 0.24, textura: banhada(daPedra, fontes), semente: SEMENTE + 70 + i })
  })
  // A sombra do cristal grande passa do patamar e cai no degrau do meio, mais longe (ele é mais baixo).
  const dz = zPatamar - altos[1]
  const grande = sombraDoCristal(cristais[0], q)
  const caida: Forma = { b: [grande.b[0] + sx * dz, grande.b[1] + sy * dz, grande.b[2] + sx * dz, grande.b[3] + sy * dz], d: (x, y) => grande.d(x - sx * dz, y - sy * dz) }
  f.fatia(1, altos[1] + 0.3, dentroDe(caida, menos(quarto(raios[1]), disco(ox, oy, rPatamar))), SOMBRA_PINTADA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.18, suave: 1.3, semente: SEMENTE + 58 })

  // Os CRISTAIS.
  cristais.forEach((cr, i) => fatiarCristal(f, 3, zPatamar + 0.5, cr, SEMENTE + 80 + i))
  f.fechar()

  // No chão: a sombra dos degraus (para o lado da sombra na tela) e o contato.
  cena.sombras.push(sombraNoAr(quarto(raios[0]), altos[0], q, 0.24, 1.4), sombraNoAr(quarto(raios[1]), altos[1], q, 0.16, 2), contato(quarto(raios[0]), 0.32))
}
