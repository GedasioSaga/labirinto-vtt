/**
 * SAÍDA DE ESGOTO de cima com volume (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`;
 * tema Esgotos): a boca do cano grosso que sai da parede e despeja no canal. Encostada na parede da beira de cima
 * (giro 0, como a tocha de parede): o COLAR de pedra lavrada chumbado na parede, em três blocos, com o limo escorrendo
 * da junta; dele sai o TUBO grosso de ferro (ou do metal ou do barro escolhido), com a fiada de rebites rente ao colar,
 * a ferrugem e o LÁBIO reforçado na boca; logo depois do lábio, a meia-lua escura da boca aberta. O tubo fica no alto
 * (a boca a meia casa do chão): a sombra dele vai pintada no chão, para baixo e à direita.
 *
 * As VERSÕES (`versoes/saidaDeEsgotoVersoes.ts`): SECA (`montarSaidaDeEsgoto`, a 1ª) tem embaixo da boca o LEQUE de
 * lodo seco que a água deixou, numa forma só de beira mole, com o rego escuro no meio, a crosta clara na beira, as
 * rachaduras, as manchas de limo, três pedrinhas e um graveto. ESCORRENDO (`montarSaidaDeEsgotoEscorrendo`) tem o chão
 * encharcado, a POÇA onde a água cai e a ENXURRADA que segue até perto da beira de baixo (as duas numa forma só), a
 * espuma suja em bolos na beira da poça, os brilhos compridos da correnteza e o limo em manchas nas margens.
 *
 * A PEÇA QUE MEXE (contrato do I0-e, `lib/mobilia/animadores.ts`): `montarSaidaDeEsgotoQueMexe` é só o JORRO, a
 * língua de água que sai da boca e cai na poça, com o respingo, em repouso; `ANIMACAO_DO_SAIDA_DE_ESGOTO` é o
 * `fioDeAgua` saindo do meio da boca. A ESCORRENDO registrada é a parte parada (o jorro vem do animador); a imagem com
 * o jorro parado (a de "menos movimento" e a da folha) é `montarSaidaDeEsgotoEscorrendoParada`.
 *
 * Pegada de partida 1 x 1 casa. O tubo sai do menor lado (0,27 dele de raio: um cano de oitenta centímetros). A
 * 3/4 é a DERIVADA comum (conferida na folha em 28/11/2026; `alturaSolta` 0,03 não muda nada aqui): o colar sobe como
 * um pilar de pedra encostado na parede e o tubo sai rente ao pé dele. Materiais: `cano` (o tubo, padrão ferro; os
 * metais e o barro) e `pedra` (o colar, padrão granito). O lodo, a água, a espuma, o limo, a ferrugem e as pedrinhas
 * são fixos.
 */
import { hash, rgb, valor, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, cadeia, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'
import { FORCA_NO_BARRO, FORCA_NO_METAL, SOMBRA_PINTADA, texDoTubo, type Segmento } from './cano'
import type { AnimacaoDoMovel } from '../../../lib/mobilia/animadores'

// ---------- as medidas (frações da pegada, salvo onde diz px) ----------

/** O raio do tubo: fração do menor lado da pegada. */
const RAIO_DO_TUBO = 0.27
/** O colar: a meia largura (fração da largura) e quanto sai da parede (fração da altura). */
const MEIO_COLAR = 0.44
const FUNDURA_DO_COLAR = 0.2
/** Onde fica a boca (fração da altura, a partir da beira de cima). */
const BOCA = 0.52
/** O lábio reforçado: o raio (em raios do tubo) e a largura ao longo do tubo (px). */
const RAIO_DO_LABIO = 1.08
const LARGURA_DO_LABIO = 3
/** A fiada de rebites: a distância do colar (px) e onde ficam, de través (fração do raio). */
const DISTANCIA_DOS_REBITES = 3.2
const REBITES: readonly number[] = [-0.8, -0.42, 0, 0.42, 0.8]
/** A altura da boca sobre o chão (px): a sombra pintada do tubo cai deste tanto para baixo e à direita. */
const ALTURA_DA_BOCA = 0.42 * G
/** A altura do colar (px): parte da parede. */
const ALTURA_DO_COLAR = 1.25 * G
/** Onde o jorro cai (px depois da boca) e o período do fio de água. */
const QUEDA = 8.5
const PERIODO_MS = 1200

// ---------- os materiais fixos ----------

const BOCA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x25, 0x24] }
const JUNTA: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x2a, 0x27] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x56, 0x3d] }
const LIMO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x5a, 0x34] }
const LIMO_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x38, 0x44, 0x28] }
const LODO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x46, 0x34] }
const LODO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x39, 0x37, 0x2a] }
const CROSTA: MaterialDaPeca = { classe: 'liso', rgb: [0x80, 0x79, 0x60] }
const UMIDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2b, 0x27] }
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x47, 0x40] }
const AGUA_DO_JORRO: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x78, 0x6d] }
const BEIRA_DE_LUZ: MaterialDaPeca = { classe: 'liso', rgb: [0x7e, 0x86, 0x76] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0x9e, 0xa8, 0x9f] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0xa4, 0x8e] }
const ESPUMA_SUJA: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x76, 0x60] }
const PEDRINHA: MaterialDaPeca = { classe: 'pedra', rgb: rgb(tomDoMeio('granito', 0.9)), pedra: 'granito' }
const GRAVETO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x4a, 0x34] }
/** O escuro em que o pixel escuro demais é levantado: cinza-verde de esgoto (com a nogueira, a boca saía marrom). */
const ESCURO_DO_ESGOTO: Rgb = [0x3a, 0x3e, 0x3a]

// ---------- a régua ----------

interface Medidas {
  readonly r: number
  /** O fim do colar (y) e a boca (y), em px a partir do meio. */
  readonly yColar: number
  readonly yBoca: number
  readonly xColar: number
}

function medidas(c: ContextoDoMovel): Medidas {
  const r = RAIO_DO_TUBO * Math.min(c.w, c.h)
  return { r, yColar: -c.hh + FUNDURA_DO_COLAR * c.h, yBoca: -c.hh + BOCA * c.h, xColar: MEIO_COLAR * c.w }
}

/** A forma inchada (k < 0) ou encolhida (k > 0) por k px, de cantos redondos. */
function deslocada(f: Forma, k: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const m = Math.max(0, -k)
  return { b: [x0 - m, y0 - m, x1 + m, y1 + m], d: (x, y) => f.d(x, y) + k }
}

/** A beira mole: a distância ganha um ruído suave e a beira vira lóbulos irregulares (o lodo e a água, nunca discos). */
function beiraMole(f: Forma, amplitude: number, escala: number, semente: number): Forma {
  const [x0, y0, x1, y1] = f.b
  return {
    b: [x0 - amplitude, y0 - amplitude, x1 + amplitude, y1 + amplitude],
    d: (x, y) => f.d(x, y) + amplitude * (2 * valor(x / escala, y / escala, 4096, semente) - 1),
  }
}

/** Bolhas de espuma: o corpo sujo e o ponto de luz no alto à esquerda de cada uma. */
function bolhas(c: ContextoDoMovel, cena: Cena, lista: readonly (readonly [number, number, number])[], alfa: number, semente: number): void {
  const P = c.peca
  const juntar = (formas: Forma[]): Forma => formas.reduce((soma, f) => uniao(soma, f))
  cena.partes.push(P(juntar(lista.map(([x, y, r]) => elipse(x, y, r * 1.15, r))), ESPUMA_SUJA, { bisel: 0, contorno: 0, alfa, suave: 0.35, semente }))
  cena.partes.push(P(juntar(lista.map(([x, y, r]) => elipse(x - r * 0.35, y - r * 0.35, r * 0.45, r * 0.38))), ESPUMA, { bisel: 0, contorno: 0, alfa: alfa * 0.85, suave: 0.2, semente: semente + 1 }))
}

// ---------- a parte parada comum: o colar, o tubo, os rebites, a ferrugem, o lábio e a boca ----------

function montarColarETubo(c: ContextoDoMovel, cena: Cena): Medidas {
  const { hh, peca: P } = c
  const L = cena.partes
  const M = medidas(c)
  const { r, yColar, yBoca, xColar } = M
  const pedra = c.m.pedra
  const mat = c.m.cano
  const metal = mat.classe === 'metal'
  cena.corDoPiso = ESCURO_DO_ESGOTO

  // O colar, chumbado na parede: três blocos (o do meio por cima da raiz do tubo).
  const colar = caixa(-xColar, -hh, xColar, yColar, 1)
  cena.sombras.push({ forma: colar, z: ALTURA_DO_COLAR, forca: 0.3 }, contato(colar, 0.32))
  // Os blocos se cobrem (o do meio por último): o contorno dele e um traço fino fazem a junta. Nada de fundo escuro
  // embaixo do colar (na vista 3/4 a cara sai do que está embaixo).
  const corte = r + 1.6
  const blocos: readonly Forma[] = [caixa(-xColar, -hh, -corte + 1, yColar, 1), caixa(corte - 1, -hh, xColar, yColar, 1), caixa(-corte, -hh, corte, yColar, 1)]
  blocos.forEach((bloco, k) => L.push(P(bloco, pedra, { tabua: 0, bisel: 1.5, tom: 0.92 + hash(k, 1, 13002) * 0.14, contorno: k === 2 ? 0.34 : 0.28, semente: 13003 + k })))
  for (const lado of [-1, 1]) {
    L.push(P(caixa(lado * corte - 0.3, -hh + 0.8, lado * corte + 0.3, yColar - 0.8, 0.3), JUNTA, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.3, semente: 13001 }))
  }
  // O limo que escorre das duas juntas e desce pela beira do colar.
  for (const lado of [-1, 1]) {
    const x = lado * corte
    L.push(P(dentroDe(capsula(x, yColar - 5.5, x + lado * 0.6, yColar - 0.4, 1.1), colar), LIMO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.7, semente: 13010 + lado }))
  }
  L.push(P(dentroDe(elipse(0, yColar - 0.4, xColar * 0.8, 1.5), colar), LIMO_ESCURO, { bisel: 0, contorno: 0, alfa: 0.38, suave: 0.9, semente: 13012 }))

  // A sombra pintada do tubo no chão (o tubo é da parede, alto: a sombra não toca o pé dele).
  const tubo = caixa(-r, yColar - 2, r, yBoca, 0.6)
  const z = ALTURA_DA_BOCA + r
  L.push(P(uniao(tubo, caixa(-r * RAIO_DO_LABIO, yBoca - LARGURA_DO_LABIO, r * RAIO_DO_LABIO, yBoca, 0.8)), SOMBRA_PINTADA, { dx: SOMBRA_X * z, dy: SOMBRA_Y * z, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.8, semente: 13020 }))

  // O tubo, de pé na pegada (corre em y): a luz de través vem da esquerda.
  const eixo: readonly Segmento[] = [
    [
      [0, -hh],
      [0, yBoca],
    ],
  ]
  L.push(P(tubo, mat, { tabua: 0, bisel: 0.8, tom: 1, contorno: 0.3, metal: metal ? 0.22 : 0, textura: texDoTubo(eixo, r, metal ? FORCA_NO_METAL : FORCA_NO_BARRO, metal ? 44 : 0, mat.classe), semente: 13021, projeta: { dist: 1.2, forca: 0.35, suave: 0.8 } }))
  // A ferrugem (no metal) ou a umidade (no barro) descendo pela beira da sombra, e a mancha perto da boca.
  const desgaste = metal ? FERRUGEM : UMIDO
  const fio = cadeia(
    [
      [r * 0.3, yColar + 1.5],
      [r * 0.55, yColar + 6],
      [r * 0.85, yColar + 9.5],
    ],
    0.8,
  )
  L.push(P(dentroDe(uniao(fio, elipse(r * 0.3, yColar + 1.5, 1.6, 1.4)), tubo), desgaste, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.7, semente: 13022 }))
  L.push(P(dentroDe(elipse(r * 0.55, yBoca - LARGURA_DO_LABIO - 2.5, r * 0.4, 1.8), tubo), desgaste, { bisel: 0, contorno: 0, alfa: 0.28, suave: 1.1, semente: 13023 }))
  // A fiada de rebites rente ao colar (só no metal).
  if (metal) {
    for (const q of REBITES) {
      L.push(P(elipse(q * r, yColar + DISTANCIA_DOS_REBITES, 0.85, 0.85), mat, { bisel: 0.55, tom: 1.16, contorno: 0.34, metal: 0.5, semente: 13024, projeta: { dist: 0.5, forca: 0.3 } }))
    }
  }
  // O lábio reforçado da boca e a meia-lua escura da boca aberta logo depois dele.
  const labio = caixa(-r * RAIO_DO_LABIO, yBoca - LARGURA_DO_LABIO, r * RAIO_DO_LABIO, yBoca, 0.8)
  L.push(P(labio, mat, { tabua: 0, bisel: 0.7, tom: 0.94, contorno: 0.32, metal: metal ? 0.3 : 0, textura: texDoTubo(eixo, r * RAIO_DO_LABIO, metal ? FORCA_NO_METAL : FORCA_NO_BARRO, metal ? 58 : 0, mat.classe), semente: 13025, projeta: { dist: 0.8, forca: 0.32 } }))
  const boca = dentroDe(elipse(0, yBoca, r * 0.9, 2.4), caixa(-r, yBoca, r, yBoca + 2.4))
  L.push(P(boca, BOCA_ESCURA, { bisel: 0, contorno: 0.15, alfa: 0.92, suave: 0.3, semente: 13026 }))
  return M
}

// ---------- SECA (a 1ª): o leque de lodo seco ----------

export const montarSaidaDeEsgoto: MontarMovel = (c, cena) => {
  const { w, h, hh, peca: P } = c
  const L = cena.partes
  const M = medidas(c)
  const yb = M.yBoca
  // O leque fica por baixo do tubo: vai antes dele na lista. Uma forma só, estreita na boca e abrindo para baixo, de
  // beira mole; em volta, o úmido que ainda não secou.
  const contornoDoLeque = poligono([
    [-0.1 * w, yb + 1.5],
    [0.11 * w, yb + 1.5],
    [0.28 * w, yb + 11],
    [0.35 * w, hh - 5],
    [0.06 * w, hh - 2.5],
    [-0.32 * w, hh - 4],
    [-0.26 * w, yb + 10],
  ])
  const leque = beiraMole(deslocada(contornoDoLeque, -2), 1.8, 4.5, 13100)
  L.push(P(deslocada(leque, -2.4), UMIDO, { bisel: 0, contorno: 0, alfa: 0.16, suave: 2.4, semente: 13101 }))
  L.push(P(leque, LODO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 1, semente: 13102 }))
  // O rego mais fundo e escuro no meio, por onde a água passou por último.
  const rego = beiraMole(cadeia([[0, yb + 2], [0.02 * w, yb + 8], [-0.03 * w, yb + 14], [0.01 * w, hh - 7]], 2.4), 1, 3, 13103)
  L.push(P(dentroDe(rego, leque), LODO_FUNDO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 1.2, semente: 13104 }))
  // A crosta clara: o anel de dentro da beira (a lama que secou primeiro).
  L.push(P(menos(leque, deslocada(leque, 2.4)), CROSTA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.7, semente: 13105 }))
  // As rachaduras do lodo seco: três riscos tortos em zigue-zague, longe da beira e das pedrinhas (nada de forquilha).
  const rachaduras: readonly (readonly Ponto[])[] = [
    [[-0.22 * w, yb + 11.5], [-0.17 * w, yb + 13], [-0.15 * w, yb + 15.5], [-0.1 * w, yb + 16.5]],
    [[0.05 * w, yb + 6.5], [0.1 * w, yb + 8], [0.12 * w, yb + 10.5]],
    [[-0.04 * w, hh - 8.5], [0.02 * w, hh - 9.5], [0.05 * w, hh - 7.5], [0.1 * w, hh - 8]],
  ]
  rachaduras.forEach((pontos, i) => L.push(P(dentroDe(cadeia(pontos, 0.3), deslocada(leque, 1.6)), LODO_FUNDO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.2, semente: 13106 + i })))
  for (let i = 0; i < 4; i += 1) {
    const x = (hash(i, 1, 13110) - 0.5) * 0.4 * w
    const y = yb + 6 + hash(i, 2, 13110) * 14
    const mancha = beiraMole(elipseGirada(x, y, 1.6 + hash(i, 3, 13110) * 1.4, 1, hash(i, 4, 13110) * 3), 0.6, 1.4, 13111 + i)
    L.push(P(dentroDe(mancha, leque), LIMO, { bisel: 0, contorno: 0, alfa: 0.45, suave: 0.5, semente: 13115 + i }))
  }
  // As pedrinhas e o graveto que a água trouxe.
  const pedrinhas: readonly (readonly [number, number, number])[] = [
    [-0.16, 0.34, 1.5],
    [0.19, 0.27, 1.2],
    [0.07, 0.42, 1.0],
  ]
  pedrinhas.forEach(([fx, fy, raio], i) => {
    const forma = elipseGirada(fx * w, fy * h, raio * 1.25, raio, i * 1.3)
    cena.sombras.push(contato(forma, 0.3))
    L.push(P(forma, PEDRINHA, { bisel: raio * 0.8, tom: 0.92 + i * 0.07, contorno: 0.3, semente: 13120 + i, projeta: { dist: 0.6, forca: 0.3 } }))
  })
  L.push(P(capsula(-0.27 * w, 0.2 * h, -0.13 * w, 0.27 * h, 0.55), GRAVETO, { bisel: 0.4, contorno: 0.3, semente: 13124, projeta: { dist: 0.5, forca: 0.3 } }))
  montarColarETubo(c, cena)
  // O lodo seco que ficou no lábio (o fundo da boca, onde a água passava).
  L.push(P(dentroDe(elipse(0, yb + 0.6, M.r * 0.55, 1.3), caixa(-M.r, yb - 1, M.r, yb + 2.4)), LODO, { bisel: 0, contorno: 0, alfa: 0.6, suave: 0.5, semente: 13115 }))
}

// ---------- ESCORRENDO: o chão encharcado, a poça e a enxurrada (o jorro é a peça que mexe) ----------

export const montarSaidaDeEsgotoEscorrendo: MontarMovel = (c, cena) => {
  const { w, h, hh, peca: P } = c
  const L = cena.partes
  const yb = medidas(c).yBoca
  const yq = yb + QUEDA
  // A água numa forma só, de beira mole: a poça onde o jorro cai e a enxurrada que abre até perto da beira de baixo.
  const poca = deslocada(elipse(0, yq + 0.5, 0.19 * w, 0.075 * h), -1.2)
  const leito = poligono([
    [-0.11 * w, yq + 2],
    [0.12 * w, yq + 2],
    [0.2 * w, hh - 2.5],
    [-0.19 * w, hh - 2],
  ])
  const enxurrada = deslocada(leito, -1.4)
  const agua = beiraMole(uniao(poca, enxurrada), 0.9, 5, 13200)
  // O chão encharcado em volta e o limo nas margens, em manchas (a largura varia de nada a três px).
  L.push(P(deslocada(agua, -4), UMIDO, { bisel: 0, contorno: 0, alfa: 0.28, suave: 2.2, semente: 13201 }))
  const margem = menos(beiraMole(deslocada(agua, -1.6), 1.6, 3, 13202), agua)
  L.push(P(dentroDe(margem, caixa(-w, yq + 4, w, hh + 4)), LIMO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.7, semente: 13203 }))
  // A água: a beira que pega luz, a água por cima (subida um nada) e os brilhos compridos da correnteza.
  L.push(P(agua, BEIRA_DE_LUZ, { bisel: 0, contorno: 0, alfa: 0.28, suave: 0.6, semente: 13204 }))
  L.push(P(agua, AGUA, { dy: -0.7, bisel: 0, contorno: 0, alfa: 0.78, suave: 0.8, semente: 13205 }))
  const brilhos: readonly (readonly [number, number, number])[] = [
    [-0.06, 5.5, 3.6],
    [0.06, 10, 2.8],
    [-0.02, 14.5, 3.8],
  ]
  brilhos.forEach(([fx, dy, comp], i) => {
    L.push(P(dentroDe(elipseGirada(fx * w, yq + dy, 0.5, comp, 0.08 - i * 0.07), agua), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.6, semente: 13206 + i }))
  })
  // A espuma suja na beira de baixo da poça, em bolos com falhas, e umas bolhas soltas descendo a enxurrada.
  const espuma: [number, number, number][] = []
  for (let i = 0; i < 14; i += 1) {
    if (hash(i, 9, 13210) < 0.28) continue
    const a = 0.2 + (i / 13) * (Math.PI - 0.4) + (hash(i, 1, 13210) - 0.5) * 0.14
    const longe = 1 + (hash(i, 3, 13210) - 0.3) * 0.18
    espuma.push([Math.cos(a) * 0.205 * w * longe, yq + 0.5 + Math.sin(a) * 0.085 * h * longe, 0.55 + hash(i, 2, 13210) * 0.65])
  }
  for (let i = 0; i < 4; i += 1) {
    espuma.push([(hash(i, 3, 13213) - 0.5) * 0.24 * w, yq + 7 + hash(i, 4, 13213) * 11, 0.45 + hash(i, 5, 13213) * 0.4])
  }
  bolhas(c, cena, espuma, 0.75, 13211)
  montarColarETubo(c, cena)
  // A boca molhada: o fio de água no fundo dela, por onde o jorro sai.
  const r = medidas(c).r
  L.push(P(dentroDe(elipse(0, yb + 0.8, r * 0.6, 1.4), caixa(-r, yb - 1, r, yb + 2.4)), AGUA_DO_JORRO, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.4, semente: 13215 }))
}

// ---------- a peça que mexe: o jorro, em repouso ----------

/** O JORRO: a língua de água que sai da boca e cai na poça, com o respingo e as gotas em volta. */
export const montarSaidaDeEsgotoQueMexe: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const L = cena.partes
  const { r, yBoca } = medidas(c)
  const yq = yBoca + QUEDA
  const lingua = cadeia(
    [
      [0, yBoca - 0.5],
      [0.3, yBoca + 3],
      [0.4, yBoca + 6],
      [0.2, yq - 0.5],
    ],
    1,
  )
  const corpo = uniao(lingua, uniao(elipse(0, yBoca + 1.4, r * 0.42, 2.2), elipse(0.25, yBoca + 4.5, r * 0.3, 3)))
  L.push(P(corpo, AGUA_DO_JORRO, { bisel: 0.6, contorno: 0.14, alfa: 0.82, suave: 0.35, semente: 13301 }))
  L.push(P(dentroDe(capsula(-r * 0.12, yBoca + 0.6, 0.1, yq - 2, 0.55), corpo), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.4, semente: 13302 }))
  // O respingo: o anel de espuma onde a água bate e as gotas que pulam.
  const batida = uniao(elipse(0.2, yq, r * 0.46, 2.3), elipse(-1.4, yq + 0.7, 2.2, 1.5))
  L.push(P(batida, AGUA_DO_JORRO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.6, semente: 13303 }))
  L.push(P(menos(batida, elipse(0.1, yq - 0.3, r * 0.3, 1.2)), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.62, suave: 0.5, semente: 13309 }))
  for (let i = 0; i < 6; i += 1) {
    const a = -0.4 + (i / 5) * (Math.PI + 0.8)
    const d = r * (0.55 + hash(i, 1, 13304) * 0.25)
    L.push(P(elipse(Math.cos(a) * d, yq + Math.sin(a) * d * 0.45, 0.5, 0.45), ESPUMA, { bisel: 0, contorno: 0.1, alfa: 0.7, semente: 13305 }))
  }
}

/** ESCORRENDO com o jorro parado: a imagem de "menos movimento" e a da folha. */
export const montarSaidaDeEsgotoEscorrendoParada: MontarMovel = (c, cena) => {
  montarSaidaDeEsgotoEscorrendo(c, cena)
  montarSaidaDeEsgotoQueMexe(c, cena)
}

/** O fio de água sai do meio da boca (a 1ª pegada: 1 x 1, a boca a 0,52 da altura). */
export const ANIMACAO_DO_SAIDA_DE_ESGOTO: AnimacaoDoMovel = {
  animador: 'fioDeAgua',
  pivo: { x: 0.5, y: BOCA },
  periodoMs: PERIODO_MS,
}
