/**
 * PONTE DE PEDRA QUEBRADA (lote L07 "Selva: ruína e água", 24/11/2026; versão da `ponte` de pedra, só a ideia).
 * O tabuleiro de LAJES grandes de arenito, de mureta a mureta, com um BURACO irregular no meio: as lajes em volta
 * dele partidas (a beira de baixo da quebra acesa, rachaduras correndo do buraco para fora), a FACE CORTADA do
 * tabuleiro à mostra na beira de cima do buraco (a laje é grossa) e, pelo buraco, o que está embaixo da ponte (a
 * água do mapa), com a sombra do tabuleiro caindo nele. A MURETA de blocos dos dois lados, mais alta e mais escura
 * que o tabuleiro, de juntas escuras, com o pilar maior em cada ponta; do lado da frente, dois blocos caíram junto
 * com o tabuleiro: um ficou tombado em cima das lajes, e as lascas caem pela beira do buraco. Musgo verde-escuro nas
 * juntas, mais do lado da sombra.
 *
 * Corre ao longo do lado MAIOR da pegada, como a ponte (4 x 1 de partida). O buraco não barra só ele: a ponte é uma
 * peça só, então NÃO BARRA, e o mestre decide quem passa. Perfil da 3/4: o da ponte (`EM_PE`). Material: `pedra`.
 */
import { hash } from '../../ruido'
import { menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { noObjeto } from './pilhaDeFatias'
import { quartosDoGiro } from './pipaDeitada'
import { ladoMaior, lascar, manchaDeMusgo, musgar, musgoDoAlto, pedraDeLaje, rumoUnitario, sombraDaBeira } from './muroEmRuina'

/** Alturas em casas (a sombra): o tabuleiro sobre a água, a mureta acima dele e o pilar das pontas. */
const ALTURA_DO_TABULEIRO = 0.42
const ALTURA_DA_MURETA = 0.24
const ALTURA_DO_PILAR = 0.32
/** A força da sombra do tabuleiro na água. */
const FORCA_DA_SOMBRA = 0.26
/** A mureta (px, no máximo, e fração da meia largura), o pilar das pontas (px) e o bloco da mureta (casas). */
const MURETA = 11
const MURETA_NA_LARGURA = 0.36
const PILAR = 12
const BLOCO = 0.42
/** O bloco da mureta: o tom (abaixo do tabuleiro claro, para saltar dele), a junta entre dois (px) e a projeção. */
const TOM_DA_MURETA = 0.98
const JUNTA_DA_MURETA = 1.6
const PROJECAO_DA_MURETA = { dist: 3.4, forca: 0.4 } as const
/** A laje do tabuleiro: o comprimento ao longo (casas) e a meia folga entre duas (px). */
const LAJE = 0.42
const FOLGA = 0.35
/** O buraco: onde fica ao longo (fração do meio comprimento), o meio comprimento (casas) e a meia largura (fração do vão entre as muretas). */
const BURACO = { onde: 0.1, comprido: 0.34, largo: 0.62, pontas: 15 } as const
/** A face cortada do tabuleiro na beira de cima do buraco (px e tom) e o fio aceso da beira de baixo (px e luz). */
const FACE_CORTADA = { alto: 3, tom: 0.5 } as const
const BEIRA_ACESA = { largura: 1, luz: 0.15 } as const
/** As rachaduras que saem do buraco: quantas e o comprimento (px, de partida e quanto varia). */
const RACHAS = 6
const RACHA = { comprimento: 9, varia: 10 } as const
/** As lascas: o raio (px, de partida e quanto varia); as primeiras `CAINDO` caem pela beira para dentro do buraco. */
const LASCA = { raio: 2.2, varia: 1.3 } as const
const LASCAS = 6
const CAINDO = 3

/** A régua da ponte: `u` ao longo, `v` de través, centro na origem (deitada, u é x; em pé, u é y). */
interface Regua {
  readonly C: number
  readonly A: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly quadra: (u0: number, v0: number, u1: number, v1: number) => Ponto[]
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  const ponto = (u: number, v: number): Ponto => (deitada ? [u, v] : [-v, u])
  return {
    C: deitada ? c.hw : c.hh,
    A: deitada ? c.hh : c.hw,
    ponto,
    quadra: (u0, v0, u1, v1) => [ponto(u0, v0), ponto(u1, v0), ponto(u1, v1), ponto(u0, v1)],
  }
}

/** A distância do ponto ao segmento. */
function aoSegmento(x: number, y: number, s: readonly [number, number, number, number]): number {
  const [ax, ay, bx, by] = s
  const dx = bx - ax
  const dy = by - ay
  let h = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)
  h = h < 0 ? 0 : h > 1 ? 1 : h
  return Math.hypot(x - ax - dx * h, y - ay - dy * h)
}

/**
 * Um caco de pedra em volta de (cx, cy): cinco pontas em ângulos e raios desencontrados, mais comprido num sentido
 * (com seis pontas iguais, o caco lia como porca de parafuso).
 */
function caco(cx: number, cy: number, raio: number, k: number): Ponto[] {
  const pontos: Ponto[] = []
  const giro = hash(k, 9, 6293) * Math.PI
  const comprido = 1.15 + 0.3 * hash(k, 8, 6293)
  for (let j = 0; j < 5; j += 1) {
    const b = ((j + (hash(k, j, 6290) - 0.5) * 0.55) / 5) * 2 * Math.PI
    const r = raio * (0.55 + 0.5 * hash(k, j, 6291))
    const [px, py] = [Math.cos(b) * r * comprido, Math.sin(b) * r / comprido]
    pontos.push([cx + px * Math.cos(giro) - py * Math.sin(giro), cy + px * Math.sin(giro) + py * Math.cos(giro)])
  }
  return pontos
}

export const montarPonteDePedraQuebrada: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.C > 0) || !(r.A > 0)) return
  const { g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const { C, A } = r
  const q = quartosDoGiro(c.giro)
  const rumo = rumoUnitario(q)
  // O "para baixo" da tela no objeto: a beira de perto de quem olha.
  const [bx0, by0] = noObjeto(0, 1, q)
  const mureta = Math.min(MURETA, A * MURETA_NA_LARGURA)
  const dentro = A - mureta

  // O BURACO: um contorno serrilhado, um pouco fora do meio.
  const uB = C * BURACO.onde
  const ru = g * BURACO.comprido
  const rv = dentro * BURACO.largo
  const contornoDoBuraco: Ponto[] = []
  for (let k = 0; k < BURACO.pontas; k += 1) {
    const a = (k / BURACO.pontas) * 2 * Math.PI
    const raio = (0.74 + 0.36 * hash(k, 1, 6201)) * (k % 2 === 1 ? 0.84 : 1)
    contornoDoBuraco.push(r.ponto(uB + Math.cos(a) * ru * raio, Math.sin(a) * rv * raio))
  }
  const buraco = poligono(contornoDoBuraco)
  // As rachaduras: de pontos da beira do buraco para fora, em três pernas tortas.
  const rachas: (readonly [number, number, number, number])[] = []
  for (let k = 0; k < RACHAS; k += 1) {
    const a = (k / RACHAS) * 2 * Math.PI + 0.5 + hash(k, 2, 6202) * 0.5
    let [pu, pv] = [uB + Math.cos(a) * ru * 0.86, Math.sin(a) * rv * 0.86]
    const comprimento = RACHA.comprimento + RACHA.varia * hash(k, 3, 6203)
    for (let j = 0; j < 3; j += 1) {
      const desvio = (hash(k, 4 + j, 6204) - 0.5) * 0.9
      const nu = pu + Math.cos(a + desvio) * (comprimento / 3)
      const nv = Math.max(-dentro + 1, Math.min(dentro - 1, pv + Math.sin(a + desvio) * (comprimento / 3)))
      const [ax, ay] = r.ponto(pu, pv)
      const [bx, by] = r.ponto(nu, nv)
      rachas.push([ax, ay, bx, by])
      ;[pu, pv] = [nu, nv]
    }
  }

  // O tabuleiro faz sombra solta na água, com o buraco nela (a luz passa por ele). Mais fraca que a da ponte (0,32):
  // a 3/4 em pé põe a sombra de baixo (0,34) por cima desta, e as sobrepostas ficam com a mais forte.
  const tudo = poligono(r.quadra(-C, -A, C, A))
  cena.sombras.push({ forma: menos(tudo, buraco), z: g * ALTURA_DO_TABULEIRO, forca: FORCA_DA_SOMBRA, solta: true })

  // A FACE CORTADA do tabuleiro: dentro do buraco, a faixa de baixo da beira de cima (o buraco menos ele mesmo
  // descido FACE_CORTADA.alto px na tela). Escura, um nada mais clara junto da beira: a laje é grossa, não é papel.
  const descido = poligono(contornoDoBuraco.map(([x, y]): Ponto => [x + bx0 * FACE_CORTADA.alto, y + by0 * FACE_CORTADA.alto]))
  const faceCortada = menos(buraco, descido)
  const pedraDaFace = pedraDeLaje(pedra, 6205, ladoMaior(buraco))
  const texDaFace: Textura = (u, v, x, y, p, s, escala) => {
    pedraDaFace(u, v, x, y, p, s, escala)
    // Quanto mais funda (longe da beira de cima), mais escura.
    const fundo = Math.min(1, Math.max(0, -buraco.d(x, y)) / FACE_CORTADA.alto)
    s[3] += 0.05 - 0.1 * fundo
  }
  L.push(P(faceCortada, pedra, { tabua: 0, bisel: 0, tom: FACE_CORTADA.tom, contorno: 0.18, textura: texDaFace, semente: 6206 }))

  // O leito das juntas (escuro) e as LAJES de mureta a mureta, uma ou duas por fileira.
  L.push(P(menos(poligono(r.quadra(-C + 0.4, -dentro - 0.5, C - 0.4, dentro + 0.5)), buraco), pedra, { tabua: 0, bisel: 0.5, tom: 0.56, contorno: 0.22, semente: 6210 }))
  const laje = (forma: Forma, tom: number, semente: number): void => {
    const daPedra = pedraDeLaje(pedra, semente, ladoMaior(forma))
    const textura: Textura = (u, v, x, y, p, s, escala) => {
      daPedra(u, v, x, y, p, s, escala)
      let luz = 0
      // A beira da quebra: a de baixo (a de perto) pega a luz num fio de 1 px; nas outras, a pedra nova um nada clara.
      const aoBuraco = buraco.d(x, y)
      if (aoBuraco < BEIRA_ACESA.largura && buraco.d(x - bx0 * 1.8, y - by0 * 1.8) < 0) luz += BEIRA_ACESA.luz
      else if (aoBuraco < 1.8) luz += 0.06 * (1 - aoBuraco / 1.8)
      if (aoBuraco < RACHA.comprimento + RACHA.varia + 2) {
        let perto = Infinity
        for (const s2 of rachas) perto = Math.min(perto, aoSegmento(x, y, s2))
        if (perto < 0.45) luz -= 0.32
        else if (perto < 0.95) luz -= 0.07
      }
      s[3] += luz
      // O musgo nas juntas, mais do lado da sombra; no alto da laje, só uns pontos.
      const m = manchaDeMusgo(x, y, 6211, -0.05)
      if (m > 0) musgar(s, musgoDoAlto(m, -forma.d(x, y), sombraDaBeira(forma, x, y, rumo), x, y, semente), x, y)
    }
    L.push(P(forma, pedra, { tabua: 0, bisel: 1.4, tom, contorno: 0.24, textura, semente }))
  }
  const fileiras = Math.max(2, Math.round((2 * C) / (g * LAJE)))
  const passo = (2 * C) / fileiras
  for (let i = 0; i < fileiras; i += 1) {
    const u0 = -C + i * passo + FOLGA
    const u1 = u0 + passo - 2 * FOLGA
    const cortes = hash(i, 1, 6220) < 0.55 ? [(hash(i, 2, 6220) - 0.5) * dentro * 0.7] : []
    const limites = [-dentro, ...cortes, dentro]
    for (let j = 0; j + 1 < limites.length; j += 1) {
      const v0 = limites[j] + (j > 0 ? FOLGA : 0)
      const v1 = limites[j + 1] - (j + 2 < limites.length ? FOLGA : 0)
      let pontos = r.quadra(u0, v0, u1, v1)
      if (hash(i, j + 3, 6221) < 0.3) pontos = lascar(pontos, Math.floor(hash(i, j + 4, 6221) * 4), 2.4)
      let forma: Forma = poligono(pontos)
      const b = forma.b
      if (b[0] < buraco.b[2] && b[2] > buraco.b[0] && b[1] < buraco.b[3] && b[3] > buraco.b[1]) forma = menos(forma, buraco)
      laje(forma, 0.88 + 0.16 * hash(i, j + 5, 6222), 6230 + i * 3 + j)
    }
  }

  // A MURETA dos dois lados; na da frente faltam os blocos de perto do buraco. Cada bloco assenta numa junta escura
  // um nada mais comprida que ele: entre dois blocos ela aparece, e na ponta do que sobrou fica o resto da argamassa.
  const zMureta = g * (ALTURA_DO_TABULEIRO + ALTURA_DA_MURETA)
  const blocos = Math.max(2, Math.round((2 * C - 2 * PILAR) / (g * BLOCO)))
  const comprimento = (2 * C - 2 * PILAR) / blocos
  for (const lado of [-1, 1]) {
    const v0 = lado < 0 ? -A + 0.5 : A - mureta
    const v1 = lado < 0 ? -A + mureta : A - 0.5
    for (let j = 0; j < blocos; j += 1) {
      const u0 = -C + PILAR + j * comprimento + JUNTA_DA_MURETA / 2
      const u1 = u0 + comprimento - JUNTA_DA_MURETA
      const meio = (u0 + u1) / 2
      if (lado > 0 && meio > uB - g * 0.62 && meio < uB + g * 0.4) continue
      const forma = poligono(r.quadra(u0, v0, u1, v1))
      cena.sombras.push({ forma, z: zMureta })
      L.push(P(poligono(r.quadra(u0 - JUNTA_DA_MURETA * 0.6, v0 + 0.3, u1 + JUNTA_DA_MURETA * 0.6, v1 - 0.3)), pedra, { tabua: 0, bisel: 0.3, tom: 0.42, contorno: 0.2, semente: 6245 + j * 2 + (lado + 1) / 2 }))
      const semente = 6250 + j * 2 + (lado + 1) / 2
      const daPedra = pedraDeLaje(pedra, semente, ladoMaior(forma))
      const doAlto: Textura = (u, v, x, y, p, s, escala) => {
        daPedra(u, v, x, y, p, s, escala)
        const m = manchaDeMusgo(x, y, 6240, 0.02)
        if (m > 0) musgar(s, musgoDoAlto(m, -forma.d(x, y), sombraDaBeira(forma, x, y, rumo), x, y, semente), x, y)
      }
      L.push(P(forma, pedra, { tabua: 0, bisel: 2, tom: TOM_DA_MURETA + 0.08 * hash(j, lado + 2, 6241), contorno: 0.3, textura: doAlto, semente, projeta: PROJECAO_DA_MURETA }))
    }
    // O pilar de cada ponta, mais largo que a mureta.
    for (const ponta of [-1, 1]) {
      const u0 = ponta < 0 ? -C + 0.5 : C - PILAR
      const u1 = ponta < 0 ? -C + PILAR : C - 0.5
      const pilar = poligono(r.quadra(u0, lado < 0 ? -A + 0.5 : A - mureta - 2, u1, lado < 0 ? -A + mureta + 2 : A - 0.5))
      const semente = 6270 + ponta + lado * 3
      cena.sombras.push({ forma: pilar, z: g * (ALTURA_DO_TABULEIRO + ALTURA_DO_PILAR) }, contato(pilar, 0.24))
      L.push(P(pilar, pedra, { tabua: 0, bisel: 2.2, tom: 1.02, contorno: 0.3, textura: pedraDeLaje(pedra, semente, ladoMaior(pilar)), semente, projeta: { dist: 3.4, forca: 0.36 } }))
    }
  }

  // O bloco da mureta que tombou em cima das lajes.
  const [bx, by] = r.ponto(uB - g * 0.5, dentro - mureta * 0.9)
  const deLado = c.w >= c.h ? 0 : Math.PI / 2
  const tombado = poligono(lascar([[-comprimento * 0.42, -mureta * 0.55], [comprimento * 0.42, -mureta * 0.55], [comprimento * 0.42, mureta * 0.55], [-comprimento * 0.42, mureta * 0.55]].map(([px, py]): Ponto => {
    const a = 0.38 + deLado
    return [bx + px * Math.cos(a) - py * Math.sin(a), by + px * Math.sin(a) + py * Math.cos(a)]
  }), 1, 2.4))
  cena.sombras.push({ forma: tombado, z: g * (ALTURA_DO_TABULEIRO + 0.12) })
  L.push(P(tombado, pedra, { tabua: 0, bisel: 1.8, tom: 0.98, contorno: 0.3, textura: pedraDeLaje(pedra, 6280, ladoMaior(tombado)), semente: 6280, projeta: { dist: 2.4, forca: 0.38 } }))

  // As LASCAS: as primeiras caem pela beira para dentro do buraco (no escuro, a sombra longe); as outras ficam no
  // tabuleiro, em volta da quebra.
  for (let k = 0; k < LASCAS; k += 1) {
    const raio = LASCA.raio + LASCA.varia * hash(k, 1, 6290)
    const caindo = k < CAINDO
    const a = caindo ? -2.3 + k * 0.75 + hash(k, 4, 6290) * 0.3 : (k / LASCAS) * 2 * Math.PI + 1.1
    const longe = caindo ? 0.8 : 1 + (3 + 4 * hash(k, 2, 6290)) / ru
    const [cx, cy] = r.ponto(uB + Math.cos(a) * ru * longe, Math.sin(a) * Math.min(rv * longe, dentro - 3))
    const forma = poligono(caco(cx, cy, raio, k))
    const semente = 6293 + k
    L.push(P(forma, pedra, { tabua: 0, bisel: 0.9, tom: caindo ? 0.84 : 1 + 0.08 * hash(k, 3, 6290), contorno: 0.3, textura: pedraDeLaje(pedra, semente, ladoMaior(forma)), semente, projeta: caindo ? { dist: 2.6, forca: 0.34 } : { dist: 1.2, forca: 0.32 } }))
  }
}
