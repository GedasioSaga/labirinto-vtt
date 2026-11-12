/**
 * BARRIL QUEBRADO de cima com volume (lote 11 dos objetos novos, 11/11/2026): o barril (`barril.ts`) depois
 * de arrebentar. Metade das ADUELAS continua de pé, em meia-lua, presa por um ARO TORTO que escapou pelo
 * lado aberto; dentro dela aparece o FUNDO de tábuas, molhado. A outra metade caiu no chão em LEQUE: cada
 * aduela é curva e tem a luz de través (a cara de fora é bojuda; a que caiu de costas mostra a de dentro,
 * côncava, tingida, com o sulco do fundo). Os dois aros de baixo estão SOLTOS no chão, um amassado e o outro
 * aberto; a TAMPA rachou em duas metades; e o que vazou fez a POÇA escura.
 *
 * O que diz "barril" a 25% de zoom é a meia-lua com o aro e as tábuas curvas saindo dela como pétalas, mais
 * os anéis de ferro no chão; o que diz "quebrado" é o leque e a poça. A poça é de vinho, roxo-escuro puxado
 * para o violeta (nunca o vermelho do sangue), com o céu refletido na beira de cima: é o reflexo que diz
 * "líquido" e não "mancha".
 *
 * Materiais: `madeira` e `aros`, os do barril. O vinho, a terra encharcada e o reflexo são fixos. As medidas
 * saem do menor lado da pegada (1 x 1 casa de partida) e as posições, de frações dela: esticado, os
 * cacos se espalham, a poça estica junto e o barril continua redondo.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { barra, cadeia, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { BURACO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

/** A madeira de dentro, na quebra: o cerne claro dos destroços (`destrocos.ts`). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.55
/** O vinho: roxo-escuro de matiz ~318° (o do sangue é ~0°), meio transparente sobre o chão. */
const VINHO_RGB: Rgb = [0x50, 0x28, 0x44]
const VINHO: MaterialDaPeca = { classe: 'liso', rgb: VINHO_RGB }
/** A terra encharcada em volta da poça: o escuro do vinho, bem transparente (o chão aparece por baixo). */
const ENCHARCADO: MaterialDaPeca = { classe: 'liso', rgb: [0x42, 0x28, 0x38] }
/** O céu refletido na poça, um pouco puxado para o tom do vinho. */
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xcc, 0xd6] }
/** Quanto o vinho tinge a madeira que ficou de molho: a cara de dentro das aduelas e o fundo. */
const TINTA_DO_VINHO = 0.3

// ---------- a luz ----------

/** De onde vem a luz no chão (a do motor: de cima à esquerda). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
/** A luz de través da aduela caída: quanto o tom muda de uma beira à outra e quanto as duas beiras caem. */
const FORCA_DO_BOJO = 0.34
const BEIRA_DO_BOJO = 0.16

// ---------- o barril de pé (frações da meia pegada e do menor meio lado, R) ----------

/** O meio do barril, em frações da meia pegada: no alto à esquerda, do lado da luz, com o leque saindo para baixo à direita. */
const MEIO_DO_BARRIL: Ponto = [-0.36, -0.32]
/** O raio do bojo (a barriga, a parte mais larga) e o da boca (onde as aduelas acabam), em frações de R. */
const RAIO_DO_BOJO = 0.47
const RAIO_DA_BOCA = 0.39
/** A grossura da aduela, que é a largura da borda de topo, em fração de R. */
const GROSSURA_DA_ADUELA = 0.068
/** As aduelas que ficaram de pé vão deste ângulo àquele (radianos; 0 = direita, π/2 = baixo): a meia-lua de cima à esquerda. */
const DE_PE: readonly [number, number] = [2.3, 5.68]
/** A altura do barril de pé (casas): a das aduelas. */
const ALTURA_DO_BARRIL = 0.42
/** A largura de uma aduela no meio, em fração de R (as pontas são mais estreitas: `PONTA_DA_ADUELA`). */
const LARGURA_DA_ADUELA = 0.22
const PONTA_DA_ADUELA = 0.7
/**
 * O aro torto: o raio dele na meia-lua (sobre o bojo, fração de R), quanto ele cede no lado aberto (fração do
 * raio) e quanto ele escorrega para lá (fração de R). Cede pouco: largo, ele virava um anel solto por cima do leque.
 */
const RAIO_DO_ARO_TORTO = 0.44
const FOLGA_DO_ARO = 0.16
const ESCORREGA_O_ARO = 0.07

// ---------- o que caiu ----------

/** Como a ponta da aduela acabou: inteira (o chanfro de fábrica) ou lascada (quebrou na queda). */
type Ponta = 'inteira' | 'lascada'

interface AduelaCaida {
  /** A direção em que ela caiu, do pé (junto do fundo) para a ponta (radianos). */
  readonly ang: number
  /** O comprimento, em fração de R (a lascada é mais curta: perdeu a ponta). */
  readonly comp: number
  /** Quanto ela entorta no meio, em fração de R (o sinal diz para que lado). */
  readonly flecha: number
  readonly ponta: Ponta
  /** Caiu de costas: a cara de dentro, côncava e tingida de vinho, para cima. */
  readonly avesso: boolean
  readonly tom: number
}

/** O leque, de cima à direita até embaixo à esquerda: as aduelas que se soltaram, cada uma num ângulo. */
const LEQUE: readonly AduelaCaida[] = [
  { ang: -0.3, comp: 0.84, flecha: 0.07, ponta: 'inteira', avesso: false, tom: 1.02 },
  { ang: 0.24, comp: 0.9, flecha: -0.06, ponta: 'inteira', avesso: false, tom: 0.94 },
  { ang: 0.8, comp: 0.7, flecha: 0.06, ponta: 'lascada', avesso: true, tom: 0.92 },
  { ang: 1.36, comp: 0.86, flecha: -0.07, ponta: 'inteira', avesso: false, tom: 1.06 },
  { ang: 1.94, comp: 0.72, flecha: 0.06, ponta: 'lascada', avesso: false, tom: 0.96 },
]
/** Dentes da ponta lascada e o fundo deles (em meias larguras): a fibra da aduela quebra em lascas compridas. */
const DENTES = 3
const FUNDO_DOS_DENTES = 2.2

/** Uma metade da tampa: o meio do lado reto (frações da meia pegada), a direção do lado reto e o tom. */
interface MetadeDaTampa {
  readonly x: number
  readonly y: number
  readonly ang: number
  readonly tom: number
}
/** A tampa rachada, as duas metades por cima das pontas do leque: uma no canto de baixo à direita, a outra embaixo à esquerda. */
const TAMPA: readonly MetadeDaTampa[] = [
  { x: 0.6, y: 0.5, ang: 2.5, tom: 0.98 },
  { x: -0.64, y: 0.58, ang: -0.95, tom: 0.9 },
]
/** As tábuas da tampa: três no diâmetro inteiro. */
const TABUAS_DA_TAMPA = 3

/** Um amassado no aro solto: onde (ângulo), quanto entra (fração do raio) e a largura (radianos). */
type Amassado = readonly [number, number, number]
/** O aro solto amassado, no alto à direita (meio em frações da meia pegada, raio em fração de R), com duas pancadas. */
const ARO_AMASSADO = { x: 0.56, y: -0.6, raio: 0.36, amassados: [[0.9, 0.16, 0.42], [3.9, 0.1, 0.36]] as readonly Amassado[] }
/** O aro aberto, embaixo, por baixo do leque: rompeu no rebite e as pontas se desencontraram (de um ângulo a outro, e quanto o raio cresce até a ponta). */
const ARO_ABERTO = { x: 0.02, y: 0.62, raio: 0.3, de: 0.5, ate: 5.9, abre: 0.16 }
/** A largura da cinta de ferro dos aros (px do protótipo). */
const CINTA = 1.7

/** As lascas soltas: o meio (frações da meia pegada), o comprimento (fração de R) e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [0.84, 0.12, 0.1, 1.2],
  [-0.2, 0.86, 0.09, -0.4],
  [0.3, -0.3, 0.08, 2.1],
]

/**
 * Os lóbulos da poça (meio e raios em frações da meia pegada): saem do pé do barril pelo lado aberto. Os raios
 * esticam com a pegada, como os meios: com os raios presos ao menor lado, a poça esticada se partia em gotas.
 */
const POCA: readonly (readonly [number, number, number, number])[] = [
  [-0.04, 0.02, 0.36, 0.3],
  [0.34, 0.26, 0.32, 0.24],
  [-0.1, 0.44, 0.24, 0.22],
  [0.5, -0.06, 0.2, 0.16],
  [0.16, 0.6, 0.18, 0.14],
]

// ---------- ajudantes ----------

/** Pontos locais (x ao longo, y através) girados `ang` e postos em (cx, cy). */
function girados(pontos: readonly Ponto[], cx: number, cy: number, ang: number): Ponto[] {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return pontos.map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co])
}

/** O setor de anel entre os raios `dentro` e `fora`, do ângulo `a0` ao `a1` (a meia-lua das aduelas de pé). */
function setor(cx: number, cy: number, fora: number, dentro: number, a0: number, a1: number): Forma {
  const n = 32
  const pontos: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n
    pontos.push([cx + Math.cos(a) * fora, cy + Math.sin(a) * fora])
  }
  for (let i = n; i >= 0; i -= 1) {
    const a = a0 + ((a1 - a0) * i) / n
    pontos.push([cx + Math.cos(a) * dentro, cy + Math.sin(a) * dentro])
  }
  return poligono(pontos)
}

/** A meia largura da aduela a `t` do pé (0) à ponta (1): mais larga no meio, como a barriga do barril. */
function meiaLargura(meia: number, t: number): number {
  return meia * (PONTA_DA_ADUELA + (1 - PONTA_DA_ADUELA) * Math.sin(Math.PI * t))
}

/** O contorno da aduela no referencial dela (x do pé à ponta, y através), curva pela `flecha`; a ponta lascada em dentes. */
function contornoDaAduela(comp: number, meia: number, flecha: number, ponta: Ponta, sem: number): Ponto[] {
  const n = 12
  const meio = (t: number): number => flecha * 4 * t * (1 - t)
  const deUmLado: Ponto[] = []
  const doOutro: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    deUmLado.push([t * comp, meio(t) - meiaLargura(meia, t)])
    doOutro.push([t * comp, meio(t) + meiaLargura(meia, t)])
  }
  doOutro.reverse()
  if (ponta === 'inteira') return [...deUmLado, ...doOutro]
  // A ponta lascada: de uma beira à outra, os dentes saem (a fibra que ficou) e entram (a que foi embora).
  const m = meiaLargura(meia, 1)
  const dentes: Ponto[] = []
  for (let k = 1; k < DENTES * 2; k += 1) {
    const entra = k % 2 === 1 ? 0.45 + 0.55 * hash(k, sem, 31) : 0.15 * hash(k, sem, 32)
    dentes.push([comp - m * FUNDO_DOS_DENTES * entra, -m + (2 * m * k) / (DENTES * 2)])
  }
  return [...deUmLado, ...dentes, ...doOutro]
}

/**
 * A luz de través da aduela caída (como a do tambor deitado da sucata): a cara de fora é bojuda e clareia do
 * lado da luz; a de dentro é côncava e clareia do outro. Por baixo, o veio da madeira.
 */
function texDaAduela(pe: Ponto, ang: number, comp: number, meia: number, flecha: number, avesso: boolean): Textura {
  const madeira = texturaDaClasse('madeira')
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const paraALuz = (avesso ? -1 : 1) * FORCA_DO_BOJO * (-si * LUZ_X + co * LUZ_Y)
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const lx = (x - pe[0]) * co + (y - pe[1]) * si
    const ly = -(x - pe[0]) * si + (y - pe[1]) * co
    const t = Math.min(1, Math.max(0, lx / comp))
    const q = Math.min(1, Math.max(-1, (ly - flecha * 4 * t * (1 - t)) / meiaLargura(meia, t)))
    s[3] += paraALuz * q - BEIRA_DO_BOJO * q * q * q * q
  }
}

/** A faixa atravessada na peça, de `de` a `ate` ao longo dela (px), girada com ela: recorta a quebra. */
function faixa(cx: number, cy: number, ang: number, de: number, ate: number, larg: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return barra(cx + de * co, cy + de * si, cx + ate * co, cy + ate * si, larg)
}

/** A boca de um aro: a roda com os amassados entrando; `k` encolhe (a beira de dentro da cinta). */
function voltaAmassada(cx: number, cy: number, raio: number, amassados: readonly Amassado[], k: number): Ponto[] {
  const pontos: Ponto[] = []
  const n = 40
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    let fundo = 0
    for (const [onde, quanto, largura] of amassados) {
      let d = t - onde
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
      fundo += quanto * Math.exp(-(d * d) / (largura * largura))
    }
    const r = raio * k * (1 - fundo)
    pontos.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r])
  }
  return pontos
}

// ---------- as partes ----------

function montarAduelaCaida(c: ContextoDoMovel, cena: Cena, L: Peca[], a: AduelaCaida, pe0: Ponto, k: number): void {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const comp = a.comp * R
  const meia = (LARGURA_DA_ADUELA * R) / 2
  const flecha = a.flecha * R
  const pe: Ponto = [pe0[0] + Math.cos(a.ang) * RAIO_DA_BOCA * R * 0.92, pe0[1] + Math.sin(a.ang) * RAIO_DA_BOCA * R * 0.92]
  const forma = poligono(girados(contornoDaAduela(comp, meia, flecha, a.ponta, 50 + k), pe[0], pe[1], a.ang))
  cena.sombras.push({ forma, z: 1.4, forca: 0.26 }, contato(forma, 0.24))
  const mad = c.m.madeira
  const face: MaterialDaPeca = a.avesso ? { ...mad, rgb: misturar(mad.rgb, VINHO_RGB, TINTA_DO_VINHO) } : mad
  L.push(P(forma, face, { eixo: a.ang, tabua: 0, bisel: 1.1, tom: a.tom * (a.avesso ? 0.92 : 1), contorno: 0.26, textura: texDaAduela(pe, a.ang, comp, meia, flecha, a.avesso), semente: 4100 + k * 3, projeta: { dist: 0.7, forca: 0.26 } }))
  if (a.ponta === 'lascada') {
    const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
    const m = meiaLargura(meia, 1)
    L.push(P(dentroDe(forma, faixa(pe[0], pe[1], a.ang, comp - m * FUNDO_DOS_DENTES * 1.15, comp + 1, meia * 2 + 2)), quebra, { eixo: a.ang, tabua: 0, bisel: 0.5, contorno: 0.16, semente: 4101 + k * 3 }))
  }
  if (a.avesso) {
    // A cara de dentro mostra o sulco onde o fundo encaixava, perto do pé: diz "aduela", e não "tábua".
    const [x0, y0] = girados([[comp * 0.09, -meia * 0.62]], pe[0], pe[1], a.ang)[0]
    const [x1, y1] = girados([[comp * 0.09, meia * 0.62]], pe[0], pe[1], a.ang)[0]
    L.push(P(capsula(x0, y0, x1, y1, 0.4), BURACO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.4, semente: 4102 + k * 3 }))
  }
}

/** A metade da tampa: o meio disco de tábuas com o lado reto rachado (a madeira de dentro, clara, nos dentes). */
function montarMetadeDaTampa(c: ContextoDoMovel, cena: Cena, L: Peca[], t: MetadeDaTampa, raio: number, k: number): void {
  const P = c.peca
  const cx = t.x * c.hw
  const cy = t.y * c.hh
  const pontos: Ponto[] = []
  const n = 18
  // O arco da beira (o chanfro da tampa) e, de volta, o lado reto rachado ao longo do veio, com farpas.
  for (let i = 0; i <= n; i += 1) {
    const a = (Math.PI * i) / n
    pontos.push([Math.cos(a) * raio, Math.sin(a) * raio])
  }
  const farpas = 7
  for (let i = 1; i < farpas; i += 1) {
    const x = -raio + (2 * raio * i) / farpas
    pontos.push([x, -(hash(i, k, 61) - 0.3) * 1.2])
  }
  const forma = poligono(girados(pontos, cx, cy, t.ang))
  cena.sombras.push({ forma, z: 1.6, forca: 0.26 }, contato(forma, 0.24))
  const mad = c.m.madeira
  L.push(P(forma, mad, { eixo: t.ang, tabua: (raio * 2) / TABUAS_DA_TAMPA, bisel: 1.2, tom: t.tom, contorno: 0.26, semente: 4200 + k * 2, projeta: { dist: 0.8, forca: 0.28 } }))
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  const [ox, oy] = girados([[0, raio * 0.08]], cx, cy, t.ang)[0]
  L.push(P(dentroDe(forma, faixa(ox, oy, t.ang, -raio - 1, raio + 1, raio * 0.22)), quebra, { eixo: t.ang, tabua: 0, bisel: 0.4, contorno: 0.14, semente: 4201 + k * 2 }))
}

/** O barril de pé: o fundo molhado, a meia-lua das aduelas (o bojo e a borda de topo) e o aro torto. */
function montarBarrilDePe(c: ContextoDoMovel, cena: Cena, L: Peca[], bx: number, by: number): void {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const mad = c.m.madeira
  const bojo = RAIO_DO_BOJO * R
  const boca = RAIO_DA_BOCA * R
  const grossura = GROSSURA_DA_ADUELA * R
  const [a0, a1] = DE_PE
  const parede = setor(bx, by, bojo, boca - grossura, a0, a1)
  cena.sombras.push({ forma: parede, z: c.g * ALTURA_DO_BARRIL, forca: 0.3 }, contato(parede, 0.28))

  // O fundo, no chão: tábuas de molho no vinho, fundas (a parede de pé faz sombra nele).
  const fundo = elipse(bx, by, boca - grossura * 0.6, boca - grossura * 0.6)
  const molhada: MaterialDaPeca = { ...mad, rgb: misturar(mad.rgb, VINHO_RGB, TINTA_DO_VINHO) }
  cena.sombras.push(contato(fundo, 0.24))
  L.push(P(fundo, molhada, { eixo: 0.5, tabua: (boca * 2) / TABUAS_DA_TAMPA, bisel: 0.9, tom: 0.8, contorno: 0.24, recesso: { k: 2.6, forca: 0.3 }, semente: 4300 }))
  L.push(P(elipseGirada(bx + boca * 0.2, by + boca * 0.24, boca * 0.56, boca * 0.42, 0.6), VINHO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 1.2, semente: 4301 }))
  L.push(P(elipseGirada(bx + boca * 0.02, by + boca * 0.06, boca * 0.24, boca * 0.06, 0.6), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 0.6, semente: 4302 }))

  // As aduelas de pé: o bojo visto de cima (as aduelas saindo do meio, como no barril) e a borda de topo.
  const polar = { cx: bx, cy: by, r: bojo }
  const tabua = LARGURA_DA_ADUELA * R
  L.push(P(parede, mad, { polar, tabua, bisel: (bojo - boca + grossura) * 0.75, contorno: 0.26, semente: 4310, projeta: { dist: 3.2, forca: 0.38 } }))
  L.push(P(setor(bx, by, boca, boca - grossura, a0, a1), mad, { polar, tabua, bisel: 0.8, luz: 0.08, contorno: 0.22, semente: 4311 }))

  // O aro torto, na meia-lua: por cima do bojo (o lado aberto dele, escorregado, vai por baixo do leque).
  L.push(P(cadeia(voltaDoAroTorto(bx, by, R, 'de pe'), CINTA / 2), c.m.aros, { bisel: 0.7, contorno: 0.3, metal: 0.32, semente: 4320, projeta: { dist: 1, forca: 0.32 } }))
}

/**
 * Os pontos do aro torto: abraça a meia-lua sobre o bojo e, do lado sem aduelas, cedeu e escorregou um pouco
 * para fora. O lado de pé é pintado com o barril; o aberto, antes do leque, para as aduelas caídas passarem por
 * cima dele: com o aro inteiro por cima, o barril parecia inteiro e só sem tampa.
 */
function voltaDoAroTorto(bx: number, by: number, R: number, parte: 'de pe' | 'aberta'): Ponto[] {
  const [a0, a1] = DE_PE
  const vao = a0 + 2 * Math.PI - a1
  const meioDoVao = a1 + vao / 2
  const rAro = RAIO_DO_ARO_TORTO * R
  const [de, ate] = parte === 'de pe' ? [a0, a1] : [a1, a0 + 2 * Math.PI]
  const n = 28
  const pontos: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const a = de + ((ate - de) * i) / n
    const aberto = parte === 'aberta' ? Math.sin((Math.PI * (a - a1)) / vao) : 0
    const r = rAro * (1 + FOLGA_DO_ARO * aberto)
    const escorrega = ESCORREGA_O_ARO * R * aberto
    pontos.push([bx + Math.cos(a) * r + Math.cos(meioDoVao) * escorrega, by + Math.sin(a) * r + Math.sin(meioDoVao) * escorrega])
  }
  return pontos
}

export const montarBarrilQuebrado: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const L = cena.partes
  const bx = MEIO_DO_BARRIL[0] * hw
  const by = MEIO_DO_BARRIL[1] * hh

  // A terra encharcada e a poça, primeiro: ficam no chão, por baixo de tudo.
  const lobulos = POCA.map(([fx, fy, rx, ry]): Forma => elipse(fx * hw, fy * hh, rx * hw, ry * hh))
  const poca = lobulos.reduce(uniao)
  const borda = POCA.map(([fx, fy, rx, ry]): Forma => elipse(fx * hw, fy * hh, rx * hw * 1.3 + 2, ry * hh * 1.3 + 2))
  L.push(P(borda.reduce(uniao), ENCHARCADO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 2.2, semente: 4000 }))
  L.push(P(poca, VINHO, { bisel: 0, contorno: 0.2, alfa: 0.74, suave: 0.8, semente: 4001 }))
  POCA.forEach(([fx, fy, rx, ry], i) => {
    // O céu refletido na beira de cima de cada lóbulo (a beira do lado da luz).
    L.push(P(elipseGirada(fx * hw - rx * hw * 0.3, fy * hh - ry * hh * 0.52, rx * hw * 0.42, Math.max(0.5, ry * hh * 0.1), -0.2), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.7, semente: 4010 + i }))
  })

  // O aro amassado, por baixo da aduela de cima do leque.
  const amassado = ARO_AMASSADO
  const [ax, ay, rA] = [amassado.x * hw, amassado.y * hh, amassado.raio * R]
  const cinta = menos(poligono(voltaAmassada(ax, ay, rA, amassado.amassados, 1)), poligono(voltaAmassada(ax, ay, rA, amassado.amassados, 1 - CINTA / rA)))
  cena.sombras.push({ forma: cinta, z: 1, forca: 0.24 }, contato(cinta, 0.22))
  L.push(P(cinta, c.m.aros, { bisel: 0.6, contorno: 0.3, metal: 0.3, semente: 4020 }))

  // As lascas, no chão.
  LASCAS.forEach(([fx, fy, comp, ang], k) => {
    const meio = (comp * R) / 2
    const lasca = capsula(fx * hw - Math.cos(ang) * meio, fy * hh - Math.sin(ang) * meio, fx * hw + Math.cos(ang) * meio, fy * hh + Math.sin(ang) * meio, 0.7)
    cena.sombras.push(contato(lasca, 0.2))
    L.push(P(lasca, { classe: 'madeira', rgb: misturar(c.m.madeira.rgb, CERNE, QUANTO_DE_CERNE) }, { eixo: ang, tabua: 0, bisel: 0.5, contorno: 0.24, semente: 4030 + k }))
  })

  // O aro aberto, por baixo do leque: rompeu e as pontas se desencontraram.
  const aberto = ARO_ABERTO
  const pontos: Ponto[] = []
  const n = 36
  for (let i = 0; i <= n; i += 1) {
    const f = i / n
    const a = aberto.de + (aberto.ate - aberto.de) * f
    const r = aberto.raio * R * (1 + aberto.abre * f)
    pontos.push([aberto.x * hw + Math.cos(a) * r, aberto.y * hh + Math.sin(a) * r * 0.86])
  }
  const arco = cadeia(pontos, CINTA / 2)
  cena.sombras.push({ forma: arco, z: 1, forca: 0.24 }, contato(arco, 0.22))
  L.push(P(arco, c.m.aros, { bisel: 0.6, contorno: 0.3, metal: 0.3, semente: 4040 }))

  // O lado aberto do aro torto, escorregado até o chão; o leque das aduelas caídas por cima dele; as duas
  // metades da tampa por cima das pontas do leque; o barril de pé por último.
  const caido = cadeia(voltaDoAroTorto(bx, by, R, 'aberta'), CINTA / 2)
  cena.sombras.push(contato(caido, 0.22))
  L.push(P(caido, c.m.aros, { bisel: 0.7, contorno: 0.3, metal: 0.32, semente: 4321 }))
  LEQUE.forEach((aduela, k) => montarAduelaCaida(c, cena, L, aduela, [bx, by], k))
  const raioDaTampa = (RAIO_DA_BOCA - GROSSURA_DA_ADUELA * 0.6) * R
  TAMPA.forEach((metade, k) => montarMetadeDaTampa(c, cena, L, metade, raioDaTampa, k))
  montarBarrilDePe(c, cena, L, bx, by)
}
