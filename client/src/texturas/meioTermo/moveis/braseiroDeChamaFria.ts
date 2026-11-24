/**
 * BRASEIRO DE CHAMA FRIA (lote L06 de 24/11/2026, item 56: versão do `braseiro`, dos mapas 4 e 8; desenho próprio, só
 * a ideia do objeto). A BACIA larga de ferro batido, com a borda chata rebitada, erguida no TRIPÉ de ferro forjado
 * (duas pernas abertas para a frente, uma para trás, com o pé de bola), como o braseiro de sempre. Dentro, no lugar
 * do carvão, o leito de LASCAS DE CRISTAL que ardem com a CHAMA FRIA: línguas de fogo ciano, quase brancas no pé.
 * A borda pega a luz fria por dentro e o chão em volta ganha um claro discreto.
 *
 * A chama é PINTADA (parada): a chama animada do fogo de casa é laranja e não serve aqui, então este tipo NÃO entra
 * em `lib/mobilia/fogoDeCasa.ts`. A luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`), fria e sem fumaça.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): as pernas inclinadas, o bojo redondo da bacia e as
 * línguas de fogo, cada uma em fatias; de cima a chama é um clarão macio sobre as lascas. Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Tudo sai do menor lado da pegada (0,8 x 0,8 casa de partida, como o
 * braseiro). Material: `metal` (a bacia e o tripé); as lascas e o fogo são fixos.
 */
import { BRASEIRO } from '../../../lib/mobilia/fogoDeCasa'
import { hash, limitar01, type Rgb } from '../../ruido'
import { anel, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, texturaDaClasse, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { alturas, novoFatiador, rumoDaSombra, sombraNoAr } from './pilhaDeFatias'
import { disco, lisa, luzDaNormal } from './apoioDasReferencias'
import { banhada, CRISTAL, graoNaAltura, texHaloFrio, tomDoCristal, type FonteFria } from './pedestalComCristal'

/** O braseiro foi medido no tamanho de partida (0,8 casa): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.4 * G
const GRAUS = Math.PI / 180
/** Os raios da bacia, em fração do menor meio lado: a borda por fora e por dentro, os rebites, o leito e o bojo. */
const BORDA_DE_FORA = 0.82
const BORDA_DE_DENTRO = 0.675
const RAIO_DOS_REBITES = 0.748
const REBITES = 14
const RAIO_DO_LEITO = 0.7
const RAIO_DO_BOJO = 0.8
/** A fundura do bojo abaixo da borda (fração do menor meio lado) e o raio do fundo dele (fração do bojo). */
const FUNDURA_DO_BOJO = 0.44
const FUNDO_DO_BOJO = 0.36
/** As pernas: o ângulo de cada uma (90 = a frente), o raio no chão e no alto, e a grossura. */
const PERNAS: readonly number[] = [30, 150, 270]
const PERNA_NO_CHAO = 0.98
const PERNA_NO_ALTO = 0.84
const GROSSURA_DA_PERNA = 0.085
const RAIO_DA_BOLA = 0.1
/** As lascas do leito: quantas, até onde vão e o tamanho (px de partida). */
const LASCAS = 34
const ALCANCE_DAS_LASCAS = 0.6
const TAMANHO_DA_LASCA = 2.5
const ANGULO_DOURADO = 2.39996
/** As línguas de fogo: x e y (fração do menor meio lado), o raio do pé (idem), a altura (idem) e a fase do balanço. */
const LINGUAS: readonly (readonly [number, number, number, number, number])[] = [
  [0.03, -0.02, 0.3, 1.16, 0.3],
  [-0.34, -0.1, 0.22, 0.74, 1.7],
  [0.27, -0.2, 0.17, 0.58, 2.9],
  [-0.08, 0.3, 0.2, 0.66, 4.1],
  [0.31, 0.2, 0.15, 0.5, 5.2],
  [0.05, -0.4, 0.13, 0.44, 0.9],
]
const PASSO_DA_CHAMA = 0.7
/** Quanto as línguas de fora abrem para fora na ponta (fração do menor meio lado). */
const ABRE_DA_LINGUA = 0.22
/** E quanto elas torcem de lado ao subir (idem): sem a torção, de cima o fogo lia como uma flor de pétalas iguais. */
const TORCE_DA_LINGUA = 0.13
const TOM_DO_FERRO = { bojo: 0.74, borda: 1.02, rebite: 1.34, perna: 0.92, pe: 0.8 } as const
const BRILHO_DO_FERRO = 0.3
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** O miolo da chama: quase branco, um nada azul. */
const MIOLO_DA_CHAMA: Rgb = [0xf2, 0xfb, 0xfb]
const SEMENTE = 5600

const DO_METAL = texturaDaClasse('metal')

/** Uma lasca do leito: um polígono de cinco ou seis pontas de raio sorteado. */
function lasca(cx: number, cy: number, r: number, semente: number): Forma {
  const lados = 5 + (hash(semente, 0, 5601) < 0.5 ? 0 : 1)
  const giro = hash(semente, 1, 5601) * Math.PI * 2
  const pontos: Ponto[] = []
  for (let i = 0; i < lados; i += 1) {
    const a = giro + (i / lados) * Math.PI * 2
    const raio = r * (0.7 + 0.55 * hash(semente, i + 2, 5601))
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio])
  }
  return poligono(pontos)
}

/** Os rebites numa forma só: uma cabeça redonda de raio `r` em cada ponto. */
function rebites(pontos: readonly Ponto[], r: number): Forma {
  return pontos.map(([x, y]): Forma => disco(x, y, r)).reduce((a, b) => uniao(a, b))
}

export const montarBraseiroDeChamaFria: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const ferro = c.m.metal
  const L = cena.partes
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DO_FERRO
  const altura = 2 * R * BRASEIRO.alturaDaBorda
  const [sx, sy] = rumoDaSombra(q)
  const fontes: FonteFria[] = [{ x: 0, y: 0, r: R * 0.72, forca: 0.5 }]

  /** O ferro batido: as covinhas do martelo por cima do metal, com a luz desenhada. */
  const ferroBatido = (luz: (x: number, y: number) => number, z?: number): Textura => {
    const grao = z === undefined ? DO_METAL : graoNaAltura(DO_METAL, z)
    return (u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += (0.14 - Math.abs(ruido(x * 0.6 + p.su, y * 0.6 + p.sv))) * 0.2 + luz(x, y)
    }
  }

  // ---------- no chão: o claro frio, os pés e as sombras (a bacia erguida deixa a sombra longe) ----------
  const rHalo = R * 1.22
  L.push(P(elipse(0, 0, rHalo, rHalo), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, 0, rHalo, rHalo, 0.3), semente: SEMENTE }))
  const pernas = PERNAS.map((graus) => {
    const [co, si] = [Math.cos(graus * GRAUS), Math.sin(graus * GRAUS)]
    return { pe: [co * PERNA_NO_CHAO * R, si * PERNA_NO_CHAO * R] as const, topo: [co * PERNA_NO_ALTO * R, si * PERNA_NO_ALTO * R] as const, co, si }
  })
  cena.sombras.push(sombraNoAr(disco(0, 0, BORDA_DE_FORA * R), altura, q, 0.26, bordaDaSombra({ z: altura })))
  pernas.forEach(({ pe, topo }, i) => {
    cena.sombras.push({ forma: capsula(pe[0], pe[1], topo[0] + sx * altura, topo[1] + sy * altura, GROSSURA_DA_PERNA * R), z: 0, forca: 0.28, suave: 1.2 })
    const bola = elipse(pe[0], pe[1], RAIO_DA_BOLA * R, RAIO_DA_BOLA * R)
    cena.sombras.push(contato(bola, 0.3))
    L.push(P(bola, ferro, { tabua: 0, bisel: RAIO_DA_BOLA * R * 0.9, tom: TOM_DO_FERRO.pe, metal: BRILHO_DO_FERRO, contorno: 0.26, semente: SEMENTE + 1 + i }))
  })

  // ---------- as PERNAS inclinadas, do pé até a borda ----------
  pernas.forEach(({ pe, topo }, i) => {
    for (const z of alturas(0.6, altura, 1)) {
      const t = z / altura
      const [x, y] = [pe[0] + (topo[0] - pe[0]) * t, pe[1] + (topo[1] - pe[1]) * t]
      // O nó forjado a meia altura: a perna engrossa num anel curto.
      const r = GROSSURA_DA_PERNA * R * (Math.abs(t - 0.46) < 0.035 ? 1.5 : 1)
      const redonda = ferroBatido((px, py) => {
        const a = Math.atan2(py - y, px - x)
        return luzDaNormal(Math.cos(a), Math.sin(a), 0, q) * 1.5
      }, z)
      f.fatia(0, z, disco(x, y, r), ferro, lisa(TOM_DO_FERRO.perna, redonda, SEMENTE + 10 + i))
    }
  })

  // ---------- o BOJO da bacia: redondo por baixo, do fundo até a borda ----------
  const zFundo = altura - FUNDURA_DO_BOJO * R
  for (const z of alturas(zFundo, altura - 0.4, 0.8)) {
    const t = (z - zFundo) / (altura - zFundo)
    const r = RAIO_DO_BOJO * R * (FUNDO_DO_BOJO + (1 - FUNDO_DO_BOJO) * Math.sqrt(1 - (1 - t) * (1 - t)))
    const barriga = ferroBatido((x, y) => {
      const a = Math.atan2(y, x)
      return luzDaNormal(Math.cos(a), Math.sin(a), -0.8 * (1 - t), q) * 1.6 - 0.1 * (1 - t)
    }, z)
    f.fatia(0, z, disco(0, 0, r), ferro, lisa(TOM_DO_FERRO.bojo, barriga, SEMENTE + 20))
  }

  // ---------- a boca: o leito, as lascas de cristal, a borda rebitada e a cabeça das pernas ----------
  const rLeito = RAIO_DO_LEITO * R
  const leito: Textura = (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x, y) / rLeito
    const cor = tomDoCristal(0.5 * (1 - d) + 0.3 * ruido(x * 0.42 + 3, y * 0.42 + 7))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 0.8
  }
  f.fatia(0, altura - 1.4 * k, disco(0, 0, rLeito), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 2.4 * k, forca: 0.4 }, textura: leito, semente: SEMENTE + 30 })
  for (let i = 0; i < LASCAS; i += 1) {
    const a = i * ANGULO_DOURADO + (hash(i, 1, SEMENTE) - 0.5) * 0.5
    const d = Math.sqrt((i + 0.5) / LASCAS) * ALCANCE_DAS_LASCAS
    const [x, y] = [Math.cos(a) * d * R, Math.sin(a) * d * R]
    const r = TAMANHO_DA_LASCA * k * (0.8 + 0.5 * hash(i, 2, SEMENTE))
    // As do miolo ardem (quase brancas); as da beira são cristal frio, com uma face clara e outra escura.
    const quente = 1 - limitar01(d / ALCANCE_DAS_LASCAS)
    const corte = hash(i, 3, SEMENTE) * Math.PI
    const [nx, ny] = [Math.cos(corte), Math.sin(corte)]
    const face: Textura = (_u, _v, px, py, _p, s) => {
      const lado = (px - x) * nx + (py - y) * ny > 0 ? 0.24 : -0.16
      const cor = tomDoCristal(0.34 + 0.56 * quente + lado)
      const w = 0.5 * quente * quente
      s[0] = cor[0] + (MIOLO_DA_CHAMA[0] - cor[0]) * w
      s[1] = cor[1] + (MIOLO_DA_CHAMA[1] - cor[1]) * w
      s[2] = cor[2] + (MIOLO_DA_CHAMA[2] - cor[2]) * w
      s[4] = 0.45 + 0.45 * quente
    }
    f.fatia(1, altura - 1 * k + 1.8 * k * quente, lasca(x, y, r, SEMENTE + 40 + i), CRISTAL, { tabua: 0, bisel: 0, contorno: 0.14, textura: face, semente: SEMENTE + 40 + i })
  }
  const borda = anel(0, 0, BORDA_DE_FORA * R, BORDA_DE_FORA * R, BORDA_DE_DENTRO * R, BORDA_DE_DENTRO * R)
  // A borda escurece para dentro (a fuligem de antes) e pega a luz fria na beira de dentro.
  const naBorda = banhada(ferroBatido((x, y) => -0.2 * limitar01((BORDA_DE_FORA - Math.hypot(x, y) / R) / (BORDA_DE_FORA - BORDA_DE_DENTRO))), fontes)
  f.fatia(2, altura, borda, ferro, { tabua: 0, bisel: 1.3 * k, tom: TOM_DO_FERRO.borda, metal: BRILHO_DO_FERRO, contorno: 0.3, textura: naBorda, semente: SEMENTE + 80 })
  const roda: Ponto[] = []
  for (let i = 0; i < REBITES; i += 1) {
    const a = ((i + 0.5) / REBITES) * Math.PI * 2
    roda.push([Math.cos(a) * RAIO_DOS_REBITES * R, Math.sin(a) * RAIO_DOS_REBITES * R])
  }
  f.fatia(3, altura + 0.2, rebites(roda, 1.05 * k), ferro, { tabua: 0, bisel: 1.05 * k, tom: TOM_DO_FERRO.rebite, metal: 0.55, contorno: 0.2, semente: SEMENTE + 81 })
  pernas.forEach(({ topo }, i) => {
    f.fatia(3, altura + 0.3, disco(topo[0], topo[1], 0.1 * R), ferro, { tabua: 0, bisel: 0.09 * R, tom: 1.12, metal: 0.45, contorno: 0.26, semente: SEMENTE + 82 + i })
  })

  // ---------- a CHAMA FRIA: as línguas em fatias, quase brancas no pé e ciano na ponta ----------
  LINGUAS.forEach(([fx, fy, fr, fh, fase], i) => {
    const alto = fh * R
    const r0 = fr * R
    const longe = Math.hypot(fx, fy)
    const [ux, uy] = longe > 0.1 ? [fx / longe, fy / longe] : [0, 0]
    for (const h of alturas(0, alto, PASSO_DA_CHAMA)) {
      const t = h / alto
      // A língua engorda logo acima do pé e afina até a ponta; o meio dela balança.
      const r = r0 * (0.72 + 0.5 * Math.sin(Math.min(1, t * 2.6) * Math.PI * 0.5) - 0.22) * Math.pow(1 - t, 0.75)
      if (r < 0.35) continue
      // As de fora abrem para fora ao subir: de cima, cada uma é uma gota que aponta para longe do meio.
      const abre = ABRE_DA_LINGUA * R * Math.pow(t, 1.3)
      const torce = TORCE_DA_LINGUA * R * t * t * (i % 2 === 0 ? 1 : -0.6)
      const [x, y] = [fx * R + ux * abre - uy * torce + Math.sin(t * 4.2 + fase) * r0 * 0.3 * t, fy * R + uy * abre + ux * torce + Math.cos(t * 3.4 + fase * 1.7) * r0 * 0.2 * t]
      const cor = tomDoCristal(1 - 0.5 * t)
      const w = (1 - t) * (1 - t) * 0.92
      const [cr, cg, cb] = [cor[0] + (MIOLO_DA_CHAMA[0] - cor[0]) * w, cor[1] + (MIOLO_DA_CHAMA[1] - cor[1]) * w, cor[2] + (MIOLO_DA_CHAMA[2] - cor[2]) * w]
      const alfa = 0.92 - 0.5 * t
      const fogo: Textura = (_u, _v, px, py, _p, s) => {
        const d2 = ((px - x) * (px - x) + (py - y) * (py - y)) / (r * r)
        s[0] = cr
        s[1] = cg
        s[2] = cb
        s[4] = 1
        // A beira da língua some no ar: de cima as línguas fundem num clarão só, e não em bolhas.
        s[5] = alfa * (1 - limitar01(d2)) * (1.6 - 0.6 * limitar01(d2))
      }
      f.fatia(4, altura + 0.6 * k + h, disco(x, y, r), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: 0.6, textura: fogo, semente: SEMENTE + 90 + i })
    }
  })
  // O clarão da chama no leito e na borda, visto de cima.
  const rClarao = BORDA_DE_FORA * R
  f.fatia(3, altura + 0.25, disco(0, 0, rClarao), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, 0, rClarao, rClarao, 0.3), semente: SEMENTE + 99 })
  f.fechar()
}
