/**
 * SACOS DE AREIA de cima com volume (14/11/2026, a base militar): um TRECHO
 * de mureta de sacos de areia, que o mestre estica e emenda como a cerca. São
 * três fiadas, cada uma mais estreita que a de baixo (a mureta é mais larga no
 * pé, como se monta), trocando o jeito de deitar o saco: a de baixo e a de
 * cima com os sacos DE TRAVÉS (cada um de uma beira à outra), desencontradas
 * meio saco; a do meio com os sacos AO COMPRIDO, em duas filas
 * desencontradas. De cima aparecem a fiada de cima inteira, cada saco gordo
 * com a boca dobrada e amarrada para um lado (trocando de lado de saco para
 * saco), e a beira das outras duas sobrando dos dois lados. O pano é a estopa
 * grossa, empoeirada de areia, com as rugas do saco cheio e o franzido da boca.
 *
 * A 25% de zoom sobra a fila de almofadas de través com o risco escuro entre
 * elas e a beira das de baixo dos dois lados: é o que diz "sacos de areia" e
 * não "muro" nem "sacos de grão" (a pilha de quatro, um aberto). O desenho
 * corre pelo lado MAIOR da pegada (2 x 0,6 casas de partida) e se REPARTE por
 * ele: esticado ganha sacos, nunca sacos mais compridos. As pontas acabam
 * rentes à pegada, cortadas no meio de um saco: dois trechos encostados
 * emendam como a mesma mureta.
 *
 * Na 3/4 (`tresQuartos.ts`) cada SACO é um tampo solto na altura da fiada
 * dele, com a beirada da espessura de uma fiada
 * (`ESPESSURA_DA_FIADA_DE_SACOS`, que o perfil da 3/4 usa): a face da mureta
 * sai saco por saco, as pontas redondas dos de través e os lados compridos dos
 * do meio, desencontrados, e não uma parede lisa. Nos sacos das fiadas de
 * baixo o tampo é só a FAIXA da beira, como as pedras da face do muro baixo:
 * o saco inteiro varreria a beirada dele por cima das fiadas de cima, pintadas
 * antes (a base delas é mais ao norte). A peça sobe com o tampo mais alto que
 * contém o meio da caixa dela, por isso cada saco das fiadas de baixo é
 * pintado só na beira que sobra (o meio dela cai na faixa). As sombras dos
 * tampos fazem a sombra da mureta no chão.
 *
 * Material: `pano` (os sacos). A poeira da areia, a costura e a amarra são fixas.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, capsula, dentroDe, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A poeira da areia que cobre o pano: bege acinzentado. Ela tira o vivo do ocre e do musgo, como areia de verdade. */
const POEIRA: Rgb = [0xb9, 0xab, 0x8c]
const POEIRA_NO_PANO = 0.22
/** A amarra da boca: o barbante escuro. */
const BARBANTE: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x4c, 0x36] }
/** O escuro em que o pixel escuro demais é levantado: o pano na sombra (com a nogueira, a junta saía vermelha). */
const ESCURO_DO_PANO: Rgb = [0x56, 0x4c, 0x3a]

/** A altura de uma fiada, em casas e em px do protótipo. O perfil da mureta em `tresQuartos.ts` usa o valor em px. */
const FIADA_EM_CASAS = 0.16
export const ESPESSURA_DA_FIADA_DE_SACOS = FIADA_EM_CASAS * G
/** A fundura de cada fiada, em fração da fundura da pegada, de baixo para cima. */
const FUNDURAS = [1, 0.86, 0.72]
/** A largura de um saco de través ao comprido da mureta e o comprimento de um saco ao comprido, em casas. */
const LARGURA_DO_SACO = 0.26
const COMPRIMENTO_DO_SACO = 0.44
/** A meia junta entre dois sacos (px do protótipo): o vão escuro que separa as almofadas. */
const MEIA_JUNTA = 0.55
/** O torto de cada saco: quanto gira (radianos) e quanto ele sai do lugar (px), no máximo. */
const TORTO = 0.05
const FORA_DO_LUGAR = 0.5
/** Quanto o tampo de um saco das fiadas de baixo entra por baixo da fiada de cima (px do protótipo): o meio da beira cai nele. */
const ENCAIXE = 1
/** A fundura do tampo da ponta da mureta de topo (px do protótipo): só a face, como a pedra da face do muro baixo. */
const FAIXA_DA_PONTA = 2.2
/** A sombra que cada fiada faz no chão (as três somadas fazem a da mureta). */
const FORCAS_DA_SOMBRA = [0.3, 0.24, 0.22]

/** A estopa: o tamanho do fio (px do protótipo); abaixo desta escala a trama vira chuvisco. */
const FIO = 1.1
const ESCALA_DO_DETALHE = 1.5

/** O referencial da mureta: `u` ao comprido, `v` de través, trocados quando a pegada é mais alta que larga. */
interface Regua {
  readonly ao: boolean
  readonly L: number
  readonly D: number
  readonly p: (u: number, v: number) => Ponto
}

function regua(c: ContextoDoMovel): Regua {
  const ao = c.w >= c.h
  return { ao, L: ao ? c.w : c.h, D: ao ? c.h : c.w, p: (u, v) => (ao ? [u, v] : [v, u]) }
}

function caixaUV(R: Regua, u0: number, v0: number, u1: number, v1: number, raio = 0): Forma {
  return R.ao ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio)
}

/**
 * Um saco cheio: a almofada de meio comprimento `a` (ao longo do eixo `ang`) e meia largura `b`, com os lados
 * estufados e os cantos apertados (o saco cheio de areia não é caixa), em volta de (cx, cy).
 */
function almofada(cx: number, cy: number, a: number, b: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const pontos: Ponto[] = []
  const passos = 28
  for (let i = 0; i < passos; i += 1) {
    const t = (i / passos) * 2 * Math.PI
    const c = Math.cos(t)
    const s = Math.sin(t)
    // A superelipse: o expoente baixo deixa o saco quadradão, com a volta macia nos cantos.
    const x = Math.sign(c) * Math.abs(c) ** 0.42 * a
    const y = Math.sign(s) * Math.abs(s) ** 0.5 * b
    pontos.push([cx + x * co - y * si, cy + x * si + y * co])
  }
  return poligono(pontos)
}

/**
 * O pano do saco: a trama da estopa, a poeira da areia, as rugas ao comprido do saco cheio e o franzido da
 * boca (as pregas que convergem na amarra, de um lado só). `boca` = de que lado do eixo ela fica (+1, -1, ou
 * 0 = sem boca à vista).
 */
function texDoSaco(cx: number, cy: number, a: number, ang: number, boca: number, sem: number): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return (u, v, x, y, _p, s, escala) => {
    const lx = (x - cx) * co + (y - cy) * si
    const ly = -(x - cx) * si + (y - cy) * co
    const i = Math.floor(u / FIO)
    const j = Math.floor(v / FIO)
    const atravessa = (((i + j) & 1) === 0 ? v : u) / FIO
    const trama = (Math.sin((atravessa - Math.floor(atravessa)) * Math.PI) - 0.64) * 0.07 + (hash(i, j, 87) - 0.5) * 0.03
    s[3] += escala < ESCALA_DO_DETALHE ? trama * 0.3 : trama
    const p = POEIRA_NO_PANO + ruido(x * 0.12 + sem, y * 0.12) * 0.2
    s[0] += (POEIRA[0] - s[0]) * p
    s[1] += (POEIRA[1] - s[1]) * p
    s[2] += (POEIRA[2] - s[2]) * p
    // As rugas do saco cheio: ondas compridas ao longo dele, tortas pelo ruído.
    const ruga = Math.sin(ly * 0.9 + ruido(lx * 0.12 + sem, ly * 0.2) * 3)
    s[3] += (ruga > 0.7 ? -(ruga - 0.7) * 0.3 : 0) + ruido(x * 0.3, y * 0.3 + sem) * 0.05
    if (boca === 0) return
    // O franzido da boca: as pregas em leque a partir da amarra, que somem no meio do saco.
    const dx = a * 0.95 - lx * boca
    const perto = 1 - dx / (a * 0.7)
    if (dx > 0 && perto > 0) {
      const onda = Math.sin(Math.atan2(ly, dx) * 7 + sem)
      s[3] += perto * perto * (onda > 0 ? -0.2 * onda * onda : -0.05 * onda)
    }
  }
}

interface Saco {
  /** O saco inteiro, cortado na pegada: o tampo dele na 3/4. */
  readonly forma: Forma
  readonly cx: number
  readonly cy: number
  readonly a: number
  readonly b: number
  readonly ang: number
  readonly tom: number
  readonly sem: number
}

/** O saco `k` de uma fiada, com o torto e o tom dele. `angDaFiada` = 0 ao comprido, `QUARTO` de través. */
function saco(R: Regua, pegada: Forma, u: number, v: number, a: number, b: number, angDaFiada: number, k: number, sem: number): Saco {
  const giro = (hash(k, sem, 97) - 0.5) * 2 * TORTO
  const du = (hash(k, sem + 1, 97) - 0.5) * 2 * FORA_DO_LUGAR
  const dv = (hash(k, sem + 2, 97) - 0.5) * 2 * FORA_DO_LUGAR
  const [cx, cy] = R.p(u + du, v + dv)
  const ang = (R.ao ? angDaFiada : QUARTO - angDaFiada) + giro
  return { forma: dentroDe(almofada(cx, cy, a, b, ang), pegada), cx, cy, a, b, ang, tom: 0.9 + hash(k, sem + 3, 97) * 0.16, sem: sem + k }
}

/** Pinta o saco (só a parte dele dentro de `so`) com a boca do lado `boca`. */
function pintarSaco(c: ContextoDoMovel, cena: Cena, s: Saco, so: Forma, boca: number, projeta: boolean): void {
  const forma = dentroDe(s.forma, so)
  // O saco de uma fila que não chega a esta beira não tem o que pintar nela.
  if (forma.b[0] >= forma.b[2] || forma.b[1] >= forma.b[3]) return
  cena.partes.push(c.peca(forma, c.m.pano, {
    eixo: s.ang,
    tabua: 0,
    bisel: s.b * 0.9,
    tom: s.tom,
    contorno: 0.3,
    ruga: 0.6,
    textura: texDoSaco(s.cx, s.cy, s.a, s.ang, boca, s.sem),
    semente: 8800 + s.sem,
    projeta: projeta ? { dist: 2.2, forca: 0.4, suave: 1.2 } : undefined,
  }))
}

/**
 * Uma fiada de sacos de través, de uma beira da fiada à outra: `desencontro` = meio saco a mais (0 ou 0,5).
 * Devolve os sacos para quem pinta escolher o que aparece.
 */
function sacosDeTraves(c: ContextoDoMovel, R: Regua, pegada: Forma, fundura: number, desencontro: number, sem: number): Saco[] {
  const n = Math.max(1, Math.round(R.L / (c.g * LARGURA_DO_SACO)))
  const larg = R.L / n
  const lista: Saco[] = []
  for (let k = -1; k <= n; k += 1) {
    const u = -R.L / 2 + (k + 0.5 + desencontro) * larg
    if (u - larg / 2 >= R.L / 2 || u + larg / 2 <= -R.L / 2) continue
    lista.push(saco(R, pegada, u, 0, fundura / 2, larg / 2 - MEIA_JUNTA, QUARTO, k + 1, sem))
  }
  return lista
}

/** A fiada do meio: duas filas de sacos ao comprido, desencontradas meio saco. */
function sacosAoComprido(c: ContextoDoMovel, R: Regua, pegada: Forma, fundura: number, sem: number): Saco[] {
  const n = Math.max(1, Math.round(R.L / (c.g * COMPRIMENTO_DO_SACO)))
  const comp = R.L / n
  const b = fundura / 4 - MEIA_JUNTA
  const lista: Saco[] = []
  for (const fila of [-1, 1]) {
    const desencontro = fila < 0 ? 0 : 0.5
    for (let k = -1; k <= n; k += 1) {
      const u = -R.L / 2 + (k + 0.5 + desencontro) * comp
      if (u - comp / 2 >= R.L / 2 || u + comp / 2 <= -R.L / 2) continue
      lista.push(saco(R, pegada, u, (fila * fundura) / 4, comp / 2 - MEIA_JUNTA, b, 0, k + 1, sem + (fila < 0 ? 0 : 10)))
    }
  }
  return lista
}

/**
 * Que ponta da mureta fica embaixo NA TELA quando ela corre de cima para baixo (+1 = a de `u` positivo, -1 =
 * a outra), ou 0 quando ela corre de lado a lado (aí as pontas não são face nenhuma). A 3/4 gira a cena o
 * quarto de volta antes de subir os tampos (`girarCena`), no sentido horário da tela.
 */
function pontaDeBaixoNaTela(c: ContextoDoMovel, R: Regua): number {
  const quartos = ((Math.round(c.giro / 90) % 4) + 4) % 4
  const [x, y] = R.p(R.L / 2, 0)
  const yNaTela = quartos === 0 ? y : quartos === 1 ? x : quartos === 2 ? -y : -x
  return Math.abs(yNaTela) < 1e-6 ? 0 : Math.sign(yNaTela)
}

/** A amarra: o barbante que aperta a boca dobrada do saco de través, perto da ponta do lado `boca`. */
function amarrar(c: ContextoDoMovel, cena: Cena, s: Saco, pegada: Forma, boca: number, k: number): void {
  const co = Math.cos(s.ang)
  const si = Math.sin(s.ang)
  const ax = s.cx + co * s.a * 0.8 * boca
  const ay = s.cy + si * s.a * 0.8 * boca
  const meia = s.b * 0.62
  const amarra = capsula(ax - si * meia, ay + co * meia, ax + si * meia, ay - co * meia, 0.55)
  cena.partes.push(c.peca(dentroDe(amarra, pegada), BARBANTE, { eixo: s.ang + QUARTO, tabua: 0, bisel: 0.5, contorno: 0.14, semente: 8890 + k, projeta: { dist: 0.5, forca: 0.24 } }))
}

export const montarSacosDeAreia: MontarMovel = (c, cena) => {
  const R = regua(c)
  const pegada = caixaUV(R, -R.L / 2, -R.D / 2, R.L / 2, R.D / 2)
  const [f1, f2, f3] = FUNDURAS.map((f) => R.D * f)
  const fiadas = [
    sacosDeTraves(c, R, pegada, f1, 0.5, 10),
    sacosAoComprido(c, R, pegada, f2, 20),
    sacosDeTraves(c, R, pegada, f3, 0, 40),
  ]
  cena.corDoPiso = ESCURO_DO_PANO
  cena.sombras.push(contato(pegada, 0.34))
  // Das fiadas de baixo, só a beira que sobra da fiada de cima delas, dos dois lados. O tampo de cada saco é
  // a FAIXA da beira (um pouco mais funda que ela): o saco inteiro varreria a beirada por cima das fiadas de cima.
  for (const [i, acima] of [[0, f2], [1, f3]] as const) {
    const fundura = i === 0 ? f1 : f2
    const faixa = (fundura - acima) / 2 + ENCAIXE
    const beiras = [caixaUV(R, -R.L / 2, -fundura / 2, R.L / 2, -acima / 2), caixaUV(R, -R.L / 2, acima / 2, R.L / 2, fundura / 2)]
    const faixas = [caixaUV(R, -R.L / 2, -fundura / 2, R.L / 2, -fundura / 2 + faixa), caixaUV(R, -R.L / 2, fundura / 2 - faixa, R.L / 2, fundura / 2)]
    for (const s of fiadas[i]) {
      for (const f of faixas) {
        const tampo = dentroDe(s.forma, f)
        if (tampo.b[0] < tampo.b[2] && tampo.b[1] < tampo.b[3]) cena.sombras.push({ forma: tampo, z: ESPESSURA_DA_FIADA_DE_SACOS * (i + 1), solta: true, forca: FORCAS_DA_SOMBRA[i] })
      }
      for (const beira of beiras) pintarSaco(c, cena, s, beira, 0, false)
    }
  }
  // A mureta de topo na tela (em pé, ou deitada com um quarto de volta): a face de baixo é a da ponta, e as
  // fiadas de baixo ganham ali o tampo da faixa da ponta (rente, sem degrau: o trecho emenda no vizinho).
  const ponta = pontaDeBaixoNaTela(c, R)
  if (ponta !== 0) {
    const faixaDaPonta = ponta > 0 ? caixaUV(R, R.L / 2 - FAIXA_DA_PONTA, -R.D / 2, R.L / 2, R.D / 2) : caixaUV(R, -R.L / 2, -R.D / 2, -R.L / 2 + FAIXA_DA_PONTA, R.D / 2)
    for (const i of [0, 1]) {
      for (const s of fiadas[i]) {
        const tampo = dentroDe(s.forma, faixaDaPonta)
        if (tampo.b[0] < tampo.b[2] && tampo.b[1] < tampo.b[3]) cena.sombras.push({ forma: tampo, z: ESPESSURA_DA_FIADA_DE_SACOS * (i + 1), solta: true, forca: 0 })
      }
    }
  }
  for (const s of fiadas[2]) cena.sombras.push({ forma: s.forma, z: ESPESSURA_DA_FIADA_DE_SACOS * 3, solta: true, forca: FORCAS_DA_SOMBRA[2] })
  fiadas[2].forEach((s, k) => {
    const boca = k % 2 === 0 ? 1 : -1
    pintarSaco(c, cena, s, pegada, boca, true)
    amarrar(c, cena, s, pegada, boca, k)
  })
}
