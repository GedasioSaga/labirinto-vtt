/**
 * PONTE DE CORRENTE de cima com volume (lote L04 de 24/11/2026, a Fortaleza do
 * ritual; versão da ponte). A ponte suspensa de uma fortaleza sobre o abismo:
 * as TÁBUAS velhas e soltas, com vão entre elas (o que está embaixo aparece),
 * presas por grampos de ferro em duas CORRENTES DE CARGA que passam por
 * baixo; as duas CORRENTES DE MÃO dos lados, com uns poucos TIRANTES de
 * corrente que descem delas até as tábuas; em cada ponta, a SOLEIRA de
 * madeira pousada na beira do abismo; e, nos quatro cantos, um PILARETE de
 * pedra com a ARGOLA de ferro onde a corrente de mão prende.
 *
 * O que a separa da ponte de corda: lá é palha clara torcida e poste de
 * madeira; aqui é ferro escuro, elo por elo (o elo deitado é uma argola
 * comprida, o de pé é um traço), com ferrugem aqui e ali, e pedra nos cantos.
 *
 * Revisão do diretor de arte (24/11/2026): as tábuas iguais, em passo certo,
 * entre duas correntes retas e quatro chapas quadradas nos cantos liam como
 * trilho de trem dentro de uma moldura de quadro. Agora:
 * - cada tábua tem a sua largura (20% para mais ou para menos), o seu vão e o
 *   seu torto (de 1 a 3 graus); uma FALTA e outra está PARTIDA em duas;
 * - a madeira é velha, puxada para o cinza, e o tom quase não muda de uma
 *   tábua para a outra (a listra marrom forte sumiu);
 * - a ponte CEDE: no meio do vão as correntes de mão curvam para dentro e o
 *   tabuleiro fica 8% mais estreito;
 * - os cantos são pilaretes redondos de pedra, soltos da soleira (a travessa
 *   de ferro de poste a poste, que fechava a moldura, saiu);
 * - a sombra do que está no ar cai bem afastada e macia, e a do que está
 *   pousado (a soleira, os pilaretes) fica junto do pé: é o que diz abismo.
 *
 * A ponte corre ao longo do lado MAIOR da pegada, como a ponte de sempre: a de
 * partida, 4 x 1, deitada; esticada para ficar mais alta que larga, em pé. As
 * medidas de través (as correntes, a tábua, os elos) ficam em px do protótipo:
 * a ponte esticada fica mais longa ou mais larga, nunca com o elo maior.
 *
 * Na 3/4 fica como de cima, em pé (`EM_PE`), como a ponte. Materiais:
 * `madeira` (as tábuas e as soleiras) e `metal` (as correntes, os grampos e as
 * argolas). A pedra dos pilaretes e a ferrugem são fixas.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Sombra, type Textura } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

const GRAUS = Math.PI / 180

/** Alturas em casas (a sombra): o tabuleiro sobre o abismo, as correntes de mão, os pilaretes e a soleira pousada. */
const ALTURA_DO_TABULEIRO = 0.4
const ALTURA_DAS_CORRENTES = 0.62
const ALTURA_DOS_PILARETES = 0.46
const ALTURA_DA_SOLEIRA = 0.07
/**
 * A sombra do que está NO AR (as tábuas, as correntes de mão): cai afastada (0,4 casa de altura dá perto de 7 px
 * para baixo à direita) e bem mais macia e fraca que a de um objeto pousado (a borda em px e a força).
 */
const BORDA_DA_SOMBRA_NO_AR = 3.4
const FORCA_DA_SOMBRA_NO_AR = 0.24

/** Um elo: o passo de um ao outro, os meios eixos do elo deitado (ao longo e de través) e a meia grossura do ferro (px). */
interface Elo {
  readonly passo: number
  readonly aoLongo: number
  readonly deTraves: number
  readonly fio: number
}
const ELO_DE_CARGA: Elo = { passo: 6.6, aoLongo: 4.4, deTraves: 2.7, fio: 1 }
const ELO_DE_MAO: Elo = { passo: 5.2, aoLongo: 3.5, deTraves: 2.15, fio: 0.8 }
const ELO_DO_TIRANTE: Elo = { passo: 4.1, aoLongo: 2.75, deTraves: 1.7, fio: 0.62 }

/** O ferro: os tons, o brilho (ferro velho) e a ferrugem, que pega até este tanto do elo. A plataforma de ritual usa os mesmos nas argolas. */
const TOM_DA_CARGA = 0.78
export const TOM_DO_FERRO_DA_PONTE = 1.04
const TOM_DO_TIRANTE = 0.94
const TOM_DO_GRAMPO = 0.86
export const BRILHO_DO_FERRO_DA_PONTE = 0.32
const FERRUGEM: Rgb = [0x8a, 0x5c, 0x40]
const QUANTO_DE_FERRUGEM = 0.42
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]

/**
 * As tábuas: o passo médio (a tábua mais o vão), o vão médio, o quanto a largura de cada uma muda (para mais e para
 * menos) e o torto de cada uma, em graus (de e até, para um lado ou para o outro).
 */
const PASSO_DAS_TABUAS = 10.4
const VAO_ENTRE_TABUAS = 2.6
const VARIA_A_LARGURA = 0.2
const TORTO_DA_TABUA: readonly [number, number] = [1, 3]
/**
 * A folga de cada lado do tabuleiro até a corrente de mão; o raio da cabeça do cravo que prende cada tábua em cada
 * corrente de carga (um ponto escuro, e não uma chapa clara: duas chapas por tábua faziam uma fileira de botões) e
 * o grampo da soleira (meia largura e meio comprimento).
 */
const FOLGA_DO_TABULEIRO = 10
const CRAVO = 1.05
const GRAMPO: readonly [number, number] = [1.4, 2.4]
/** A madeira velha: o cinza para onde ela é puxada, o quanto, e o tom de cada tábua (de e até: quase igual). */
const CINZA_DA_MADEIRA_VELHA: Rgb = [0x88, 0x84, 0x7c]
const QUANTO_DE_CINZA = 0.62
const TOM_DAS_TABUAS: readonly [number, number] = [0.92, 1.05]
/**
 * A ponte CEDE no meio do vão: o tabuleiro fica `ESTREITA_NO_MEIO` mais estreito e as correntes de mão curvam
 * `SELA_DA_CORRENTE` px para dentro (um pouco mais que as tábuas, para a curva aparecer).
 */
const ESTREITA_NO_MEIO = 0.08
const SELA_DA_CORRENTE = 4.4
/** Onde as correntes de carga passam debaixo das tábuas (fração do meio tabuleiro) e a corrente de mão (px da beira). */
const CARGA_EM = 0.62
const MAO_DA_BEIRA = 5.4
/** Os pilaretes de pedra dos cantos: quanto ficam da ponta (px), o raio do pé e o do fuste; e a argola de ferro, do lado do vão. */
const RECUO_DO_PILARETE = 5.6
const PE_DO_PILARETE = 5
const RAIO_DO_PILARETE = 3.9
const ARGOLA: readonly [number, number] = [2.5, 1.25]
const ARGOLA_PARA_O_VAO = 2.6
/** A soleira de cada ponta, pousada na beira do abismo: onde fica o meio dela (px da ponta) e a meia largura. Solta dos pilaretes. */
const SOLEIRA_EM = 13
const MEIA_SOLEIRA = 2.9
/** Quanto do salpico do granito fica na pedra dos pilaretes: a metade (a regra do lote). */
const SALPICO_DA_PEDRA = 0.5

const DO_METAL = texturaDaClasse('metal')
const DA_PEDRA = texturaDaClasse('pedra')

/** 0..1 fixo por peça (a largura, o vão, o torto e o tom de cada tábua). */
function acaso(i: number, sal: number): number {
  return hash(i, sal, 4040)
}

/**
 * A régua da ponte, como a da ponte de sempre: `u` ao longo (do começo ao fim), `v` de través, centro na
 * origem. Deitada, u é x; em pé, u é y.
 */
interface Regua {
  readonly meioC: number
  readonly meiaL: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly retangulo: (u0: number, v0: number, u1: number, v1: number, raio: number) => Forma
  readonly poligono: (pontos: readonly Ponto[]) => Forma
  /** O veio de través da ponte (as tábuas e a soleira). */
  readonly deTraves: number
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  const ponto = (u: number, v: number): Ponto => (deitada ? [u, v] : [-v, u])
  return {
    meioC: deitada ? c.hw : c.hh,
    meiaL: deitada ? c.hh : c.hw,
    ponto,
    retangulo: (u0, v0, u1, v1, raio) => (deitada ? caixa(u0, v0, u1, v1, raio) : caixa(-v1, u0, -v0, u1, raio)),
    poligono: (pontos) => poligono(pontos.map(([u, v]) => ponto(u, v))),
    deTraves: deitada ? QUARTO : 0,
  }
}

/**
 * A CORRENTE de (ax, ay) a (bx, by) numa forma só: os elos se alternam, um deitado (a argola comprida, vista de
 * cima) e um de pé (visto de quina: um traço que entra no furo dos dois vizinhos). A distância olha o elo do
 * ponto e os dois do lado. `sela` (px, com sinal) curva a corrente de través, em parábola: zero nas pontas e
 * `sela` no meio (a ponte que cede). A curva é rasa (poucos px em uma centena), e o elo não entorta com ela.
 */
function corrente(ax: number, ay: number, bx: number, by: number, e: Elo, sela = 0): Forma {
  const l = Math.hypot(bx - ax, by - ay) || 1
  const [ux, uy] = [(bx - ax) / l, (by - ay) / l]
  // Número ímpar de elos: a corrente começa e acaba num elo deitado.
  const n = Math.max(1, Math.round((l / e.passo - 1) / 2) * 2 + 1)
  const passo = l / n
  const fora = e.deTraves + 0.5 + Math.abs(sela)
  const b: Caixa = [Math.min(ax, bx) - fora, Math.min(ay, by) - fora, Math.max(ax, bx) + fora, Math.max(ay, by) + fora]
  const [a, c] = [e.aoLongo, e.deTraves]
  const meioDoTraco = passo - a + 2 * e.fio + 0.3
  return {
    b,
    d(x, y) {
      const px = x - ax
      const py = y - ay
      const s = px * ux + py * uy
      const noVao = (2 * s) / l - 1
      const t = -px * uy + py * ux - sela * (1 - noVao * noVao)
      const i = Math.floor(s / passo)
      let menor = Infinity
      for (let j = i - 1; j <= i + 1; j += 1) {
        if (j < 0 || j >= n) continue
        const ls = s - (j + 0.5) * passo
        let d: number
        if (j % 2 === 0) {
          // O elo deitado: o anel entre a elipse de fora e a de dentro (a de fora menos a grossura do ferro).
          const k0 = Math.sqrt((ls * ls) / (a * a) + (t * t) / (c * c))
          const k1 = Math.sqrt((ls * ls) / (a * a * a * a) + (t * t) / (c * c * c * c))
          const daElipse = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -c
          d = Math.max(daElipse, -(daElipse + 2 * e.fio))
        } else {
          const alem = Math.abs(ls) - meioDoTraco
          d = Math.hypot(alem > 0 ? alem : 0, t) - e.fio * 0.92
        }
        if (d < menor) menor = d
      }
      return menor
    },
  }
}

/**
 * O ferro velho da ponte: o grão do metal e a ferrugem em manchas (mais onde o ruído manda), puxando a cor para o
 * castanho. As argolas da plataforma de ritual usam a mesma, com `TOM_DO_FERRO_DA_PONTE` e `BRILHO_DO_FERRO_DA_PONTE`.
 */
export const texDoFerroDaPonte: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  const n = ruido(x * 0.11 + p.su, y * 0.11 + p.sv) + 0.5 * ruido(x * 0.45 + 9, y * 0.45 + 3)
  const t = Math.min(1, Math.max(0, (n - 0.02) * 2.4)) * QUANTO_DE_FERRUGEM
  if (t <= 0) return
  s[0] += (FERRUGEM[0] - s[0]) * t
  s[1] += (FERRUGEM[1] - s[1]) * t
  s[2] += (FERRUGEM[2] - s[2]) * t
}

/** A pedra dos pilaretes: a do granito, com o salpico à metade (multiplicado na cor: o tom escuro dela, nunca preto). */
const texDaPedraDoPilarete: Textura = (u, v, x, y, p, s, escala) => {
  if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
  s[6] *= SALPICO_DA_PEDRA
}

/** As opções de uma peça de ferro. */
function doFerro(tom: number, bisel: number, semente: number, comFerrugem = true) {
  return { tabua: 0, bisel, tom, metal: BRILHO_DO_FERRO_DA_PONTE, contorno: 0.3, textura: comFerrugem ? texDoFerroDaPonte : undefined, semente }
}

/** Onde cada tábua fica ao longo da ponte: de onde até onde (px), já com a largura e o vão de cada uma. */
function tabuasDoVao(util: number): { u0: number; u1: number }[] {
  const n = Math.max(3, Math.round(util / PASSO_DAS_TABUAS))
  const larguras = Array.from({ length: n }, (_, i) => 1 + (acaso(i, 3) - 0.5) * 2 * VARIA_A_LARGURA)
  const vaos = Array.from({ length: n + 1 }, (_, i) => 0.45 + 1.1 * acaso(i, 4))
  const soma = (lista: readonly number[]): number => lista.reduce((a, b) => a + b, 0)
  // As larguras e os vãos sorteados são esticados juntos para encher o vão de soleira a soleira.
  const k = util / (soma(larguras) * (PASSO_DAS_TABUAS - VAO_ENTRE_TABUAS) + soma(vaos) * VAO_ENTRE_TABUAS)
  const tabuas: { u0: number; u1: number }[] = []
  let u = -util / 2
  for (let i = 0; i < n; i += 1) {
    u += vaos[i] * VAO_ENTRE_TABUAS * k
    const largura = larguras[i] * (PASSO_DAS_TABUAS - VAO_ENTRE_TABUAS) * k
    tabuas.push({ u0: u, u1: u + largura })
    u += largura
  }
  return tabuas
}

function montar(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const madeira: MaterialDaPeca = { ...c.m.madeira, rgb: misturar(c.m.madeira.rgb, CINZA_DA_MADEIRA_VELHA, QUANTO_DE_CINZA) }
  const ferro: MaterialDaPeca = c.m.metal
  const pedra = materialDaPeca('granito')
  const { meioC: C, meiaL: A } = r
  const L: Peca[] = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const linhaDaMao = Math.max(2.5, A - MAO_DA_BEIRA)
  const deck = Math.max(5, A - FOLGA_DO_TABULEIRO)
  const ponta = Math.max(1, C - RECUO_DO_PILARETE)
  const sela = Math.min(SELA_DA_CORRENTE, linhaDaMao * 0.2)
  /** Quanto a ponte é mais estreita em `u`: 1 nas pontas, menos `ESTREITA_NO_MEIO` no meio do vão. */
  const cintura = (u: number): number => 1 - ESTREITA_NO_MEIO * (1 - Math.min(1, (u / ponta) * (u / ponta)))
  /** Onde a corrente de mão passa em `u` (de través, sem o lado): reta nas pontas, `sela` px para dentro no meio. */
  const mao = (u: number): number => linhaDaMao - sela * (1 - Math.min(1, (u / ponta) * (u / ponta)))
  const noAr = (forma: Forma, altura: number, forca = FORCA_DA_SOMBRA_NO_AR): Sombra => ({ forma, z: c.g * altura, forca, suave: BORDA_DA_SOMBRA_NO_AR, solta: true })

  // ---------- as duas correntes de carga, por baixo das tábuas: aparecem nos vãos e no buraco da tábua que falta ----------
  for (const lado of [-1, 1]) {
    // De soleira a soleira: é nelas que a corrente de carga prende.
    const v = lado * deck * CARGA_EM
    const [ax, ay] = r.ponto(-(C - SOLEIRA_EM), v)
    const [bx, by] = r.ponto(C - SOLEIRA_EM, v)
    L.push(P(corrente(ax, ay, bx, by, ELO_DE_CARGA, -v * ESTREITA_NO_MEIO), ferro, doFerro(TOM_DA_CARGA, ELO_DE_CARGA.fio * 0.9, 4000 + lado)))
  }

  // ---------- as tábuas velhas: cada uma com a sua largura, o seu vão e o seu torto; uma falta, outra está partida ----------
  const tabuas = tabuasDoVao(2 * Math.max(8, C - SOLEIRA_EM - MEIA_SOLEIRA))
  const n = tabuas.length
  const falta = n >= 7 ? Math.floor(n * 0.36) : -1
  const partida = n >= 5 ? Math.floor(n * 0.68) : -1
  tabuas.forEach(({ u0, u1 }, i) => {
    if (i === falta) return
    const um = (u0 + u1) / 2
    const torto = (acaso(i, 9) < 0.5 ? -1 : 1) * (TORTO_DA_TABUA[0] + (TORTO_DA_TABUA[1] - TORTO_DA_TABUA[0]) * acaso(i, 5)) * GRAUS
    const meia = (deck + 1) * cintura(um)
    const desliza = (acaso(i, 7) - 0.5) * 2
    const v0 = -meia + desliza
    const v1 = meia + desliza * 0.5 - acaso(i, 8) * 1.6
    /** O canto (u, v) da tábua, girado `giro` em volta do meio dela e empurrado `du` ao longo da ponte. */
    const canto = (u: number, v: number, giro = torto, du = 0): Ponto => [um + du + (u - um) * Math.cos(giro) - v * Math.sin(giro), (u - um) * Math.sin(giro) + v * Math.cos(giro)]
    // A partida quebrou perto do meio: as duas metades acabam em dente, e a de baixo cedeu (mais torta e fora do lugar).
    const quebra = meia * 0.16
    const cedeu = torto + (torto < 0 ? -1 : 1) * 3.5 * GRAUS
    const pedacos: readonly (readonly Ponto[])[] = i === partida
      ? [
          [canto(u0, v0), canto(u1, v0), canto(u1, quebra - 1.9), canto(um + (u1 - u0) * 0.12, quebra - 0.5), canto(u0, quebra - 1.4)],
          [canto(u0, quebra + 0.5, cedeu, 0.9), canto(um + (u1 - u0) * 0.12, quebra + 1.5, cedeu, 0.9), canto(u1, quebra + 0.1, cedeu, 0.9), canto(u1, v1, cedeu, 0.9), canto(u0, v1, cedeu, 0.9)],
        ]
      : [[canto(u0, v0), canto(u1, v0), canto(u1, v1), canto(u0, v1)]]
    const tom = TOM_DAS_TABUAS[0] + (TOM_DAS_TABUAS[1] - TOM_DAS_TABUAS[0]) * acaso(i, 10)
    pedacos.forEach((pontos, j) => {
      const tabua = r.poligono(pontos)
      cena.sombras.push(noAr(tabua, ALTURA_DO_TABULEIRO))
      L.push(P(tabua, madeira, { tabua: 0, eixo: r.deTraves, bisel: 1, tom, contorno: 0.24, semente: 4010 + i * 2 + j, projeta: { dist: 1.2, forca: 0.2 } }))
    })
    for (const lado of [-1, 1]) {
      const [gu, gv] = canto(um, lado * deck * CARGA_EM * cintura(um), i === partida && lado > 0 ? cedeu : torto, i === partida && lado > 0 ? 0.9 : 0)
      const [cx, cy] = r.ponto(gu, gv)
      L.push(P(elipse(cx, cy, CRAVO, CRAVO), ferro, { ...doFerro(TOM_DO_GRAMPO, CRAVO * 0.8, 4100 + i * 2 + (lado + 1) / 2, false), contorno: 0.36 }))
    }
  })

  // ---------- os poucos tirantes: a corrente fina que desce da corrente de mão até a ponta de uma tábua ----------
  const comTirante = [...new Set([Math.floor(n * 0.2), Math.floor(n * 0.52), Math.floor(n * 0.82)])].filter((i) => i !== falta)
  for (const lado of [-1, 1]) {
    for (const i of comTirante) {
      const um = (tabuas[i].u0 + tabuas[i].u1) / 2
      const [ax, ay] = r.ponto(um, lado * (mao(um) - 0.4))
      const [bx, by] = r.ponto(um - 0.8, lado * ((deck + 1) * cintura(um) - 1.6))
      L.push(P(corrente(ax, ay, bx, by, ELO_DO_TIRANTE), ferro, doFerro(TOM_DO_TIRANTE, ELO_DO_TIRANTE.fio * 0.9, 4200 + i * 2 + (lado + 1) / 2)))
    }
  }

  // ---------- a soleira de cada ponta, pousada na beira do abismo: é nela que as correntes de carga prendem ----------
  for (const sinal of [-1, 1]) {
    const um = sinal * (C - SOLEIRA_EM)
    const soleira = r.retangulo(um - MEIA_SOLEIRA, -deck - 0.5, um + MEIA_SOLEIRA, deck + 0.5, 0.9)
    cena.sombras.push(contato(soleira, 0.3), { forma: soleira, z: c.g * ALTURA_DA_SOLEIRA, forca: 0.28 })
    L.push(P(soleira, madeira, { tabua: 0, eixo: r.deTraves, bisel: 1.3, tom: 0.8, contorno: 0.28, semente: 4300 + sinal, projeta: { dist: 1, forca: 0.22 } }))
    for (const lado of [-1, 1]) {
      const [gu, gv] = [um, lado * deck * CARGA_EM]
      L.push(P(r.retangulo(gu - MEIA_SOLEIRA - 0.5, gv - GRAMPO[0], gu + MEIA_SOLEIRA + 0.5, gv + GRAMPO[0], 0.6), ferro, { ...doFerro(TOM_DO_GRAMPO, 0.7, 4310 + sinal + lado * 3, false), projeta: { dist: 0.7, forca: 0.24 } }))
    }
  }

  // ---------- as correntes de mão dos dois lados, de pilarete a pilarete, no ar: curvam para dentro no meio do vão ----------
  for (const lado of [-1, 1]) {
    const [ax, ay] = r.ponto(-ponta, lado * linhaDaMao)
    const [bx, by] = r.ponto(ponta, lado * linhaDaMao)
    const curva = [-1, -0.5, 0, 0.5, 1].map((q): Ponto => r.ponto(q * ponta, lado * mao(q * ponta)))
    cena.sombras.push(noAr(cadeia(curva, ELO_DE_MAO.deTraves * 0.7), ALTURA_DAS_CORRENTES, 0.18))
    L.push(P(corrente(ax, ay, bx, by, ELO_DE_MAO, -lado * sela), ferro, { ...doFerro(TOM_DO_FERRO_DA_PONTE, ELO_DE_MAO.fio * 0.9, 4400 + lado), projeta: { dist: 1.8, forca: 0.22 } }))
  }

  // ---------- os quatro pilaretes de pedra dos cantos: o pé, o fuste redondo e a argola de ferro onde a corrente prende ----------
  let j = 0
  for (const sinal of [-1, 1]) {
    for (const lado of [-1, 1]) {
      const [x, y] = r.ponto(sinal * ponta, lado * linhaDaMao)
      const pe = elipse(x, y, PE_DO_PILARETE, PE_DO_PILARETE)
      const fuste = elipse(x, y, RAIO_DO_PILARETE, RAIO_DO_PILARETE)
      cena.sombras.push(contato(pe, 0.32), { forma: fuste, z: c.g * ALTURA_DOS_PILARETES })
      L.push(P(pe, pedra, { tabua: 0, bisel: 1, tom: 0.8, contorno: 0.3, textura: texDaPedraDoPilarete, semente: 4500 + j }))
      L.push(P(fuste, pedra, { tabua: 0, bisel: RAIO_DO_PILARETE * 0.75, tom: 1.05, contorno: 0.3, textura: texDaPedraDoPilarete, semente: 4510 + j, projeta: { dist: 2.4, forca: 0.3 } }))
      const [ax, ay] = r.ponto(sinal * (ponta - ARGOLA_PARA_O_VAO), lado * linhaDaMao)
      L.push(P(anel(ax, ay, ARGOLA[0], ARGOLA[0], ARGOLA[1], ARGOLA[1]), ferro, { ...doFerro(1.2, 0.7, 4520 + j, false), metal: 0.45, projeta: { dist: 0.8, forca: 0.3 } }))
      j += 1
    }
  }
}

export const montarPonteDeCorrente: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.meioC > 0) || !(r.meiaL > 0)) return
  montar(c, cena, r)
}
