/**
 * RÁDIO DE CAMPANHA de cima com volume (14/11/2026, lote L05 dos objetos
 * novos, base militar): a mesa de campanha do radioperador, com o rádio e os
 * fones. A MESA é de tábua (a madeira que o mestre escolher) sobre quatro
 * pernas de ferro verde. Em cima dela, no fundo à esquerda, o RÁDIO: a caixa
 * verde-oliva com o painel de comando no alto (a janela da frequência, os dois
 * botões grandes com o risco, os dois pequenos, o mostrador redondo, as
 * tomadas), a alça de lona atrás e a ANTENA de vara no canto. Do lado dele, os
 * FONES deitados (as duas conchas com a almofada, o arco e o fio até o
 * rádio); na frente, o MONOFONE com o fio enrolado, o BLOCO de anotações com o
 * lápis e a CANECA de ágata.
 *
 * Na 3/4 (`tresQuartos.ts`) a mesa é um tampo no ar sobre as pernas, e o
 * rádio, um tampo no ar acima dela, com a caixa declarada até depois da base
 * da mesa (para ser pintado depois dela). A FRENTE do rádio, que a 3/4 não
 * teria, é desenhada de frente e GUARDADA debaixo da tampa dele na vista de
 * cima (a ideia da escrivaninha): as peças dela declaram a caixa com o meio um
 * nada à frente do rádio, onde só a mesa as contém, e sobem com a mesa; o
 * rádio sobe a altura dele e as deixa à mostra. A antena é uma coluna fina; a
 * bolinha da ponta é a peça dela, e a base, um nada fora dela, fica com o
 * rádio.
 *
 * As coisas em cima da mesa têm medida própria (por casa): a mesa esticada
 * ganha tampo, não um rádio maior; só encolhem juntos na mesa menor que a de
 * partida. Material: `madeira` (o tampo). O resto é fixo.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, capsula, caixa, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Sombra } from './motor'
import { PREGO, type MontarMovel } from './contexto'

/** A caixa do rádio, as pernas da mesa e a baquelite dos botões e dos fones. */
const OLIVA: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x62, 0x45] }
const FERRO_VERDE: MaterialDaPeca = { classe: 'metal', rgb: [0x55, 0x59, 0x46] }
const BAQUELITE: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x32, 0x2f] }
/** A almofada de couro dos fones e a lona da alça. */
const COURO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x4a, 0x44, 0x3c] }
const LONA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x8a, 0x84, 0x66] }
/** A janela da frequência e o mostrador (vidro sobre a escala clara), o papel do bloco, o lápis, a ágata da caneca e o café. */
const ESCALA: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xca, 0xa8] }
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xe3, 0xdd, 0xcb] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x4c, 0x55] }
const LAPIS: MaterialDaPeca = { classe: 'madeira', rgb: [0xb7, 0x96, 0x55] }
const AGATA: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xd6, 0xcc] }
const CAFE: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x2c, 0x22] }
/** O escuro em que o pixel escuro demais é levantado: o verde-escuro do rádio (com a nogueira, a baquelite saía marrom). */
const ESCURO_DO_RADIO: Rgb = [0x3c, 0x3d, 0x35]

/** A mesa: a altura do tampo, o recuo dele e o lado da perna (casas), a tábua (casas) e a espessura que aparece embaixo (px). */
const ALTURA_DA_MESA = 0.48
const RECUO_DO_TAMPO = 0.06
const LADO_DA_PERNA = 0.09
const TABUA = 0.2
const ESPESSURA_DO_TAMPO = 1.8
/** O tamanho de partida da mesa, em casas: abaixo dele o que está em cima encolhe junto. */
const LARGURA_DE_PARTIDA = 1.5
const FUNDO_DE_PARTIDA = 1
/** O rádio: largura, fundura e altura (casas), e a folga dele até a beira de trás e a da esquerda do tampo (casas). */
const LARGURA_DO_RADIO = 0.62
const FUNDO_DO_RADIO = 0.36
const ALTURA_DO_RADIO = 0.22
const FOLGA_DO_RADIO = 0.06
/** A antena: a altura da ponta (casas, do chão) e o raio da vara (px). */
const ALTURA_DA_ANTENA = 1.55
const RAIO_DA_ANTENA = 0.75
/** O meio declarado das peças da frente guardada fica este tanto à frente do rádio (px). */
const MEIO_DA_FRENTE = 0.6
/** A sombra da tampa do rádio e das coisas em cima da mesa no tampo. */
const SOMBRA_DO_RADIO = { dist: 2.6, forca: 0.38, suave: 1.4 } as const
const SOMBRA_NA_MESA = { dist: 1.1, forca: 0.32, suave: 0.8 } as const

export const montarRadioDeCampanha: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const k = Math.min(1, w / (LARGURA_DE_PARTIDA * g), h / (FUNDO_DE_PARTIDA * g))
  const casa = g * k
  const zMesa = ALTURA_DA_MESA * g
  const L = cena.partes

  // ---------- a mesa ----------
  const recuo = RECUO_DO_TAMPO * casa
  const tampo = caixa(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo, 1.6)
  const lado = LADO_DA_PERNA * casa
  const pernas = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
    const x0 = sx < 0 ? -hw : hw - lado
    const y0 = sy < 0 ? -hh : hh - lado
    return caixa(x0, y0, x0 + lado, y0 + lado, 0.8)
  })
  const sombras: Sombra[] = [
    { forma: caixa(-hw + recuo - 1.4, -hh + recuo - 1.4, hw - recuo + 1.4, hh - recuo + 1.4, 3), z: 0, suave: 1.4, forca: 0.38 },
    { forma: tampo, z: zMesa, solta: true, suave: 1.8, forca: 0.22 },
  ]
  for (const p of pernas) sombras.push(contato(p, 0.34), { forma: p, z: zMesa, suave: 0.9, forca: 0.3 })
  cena.sombras.push(...sombras)
  for (const [i, p] of pernas.entries()) L.push(P(p, FERRO_VERDE, { tabua: 0, bisel: 0.9, contorno: 0.2, tom: 0.7, metal: 0.25, semente: 700 + i }))
  L.push(P(tampo, mad, { dx: 0.4, dy: ESPESSURA_DO_TAMPO, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.64, semente: 704 }))
  L.push(P(tampo, mad, { tabua: TABUA * casa, bisel: 1.5, contorno: 0.1, semente: 705 }))

  // ---------- o rádio: onde fica, a frente guardada, a tampa ----------
  const rx0 = -hw + recuo + FOLGA_DO_RADIO * casa
  const rx1 = rx0 + LARGURA_DO_RADIO * casa
  const ry0 = -hh + recuo + FOLGA_DO_RADIO * casa
  const ry1 = ry0 + FUNDO_DO_RADIO * casa
  const altura = ALTURA_DO_RADIO * casa
  const radio = caixa(rx0, ry0, rx1, ry1, 1.6)
  // A caixa declarada vai até depois da base da mesa: a 3/4 pinta o rádio depois dela.
  cena.sombras.push({ forma: { b: [rx0, ry0, rx1, hh - recuo + 0.1], d: radio.d }, z: zMesa + altura, solta: true, forca: 0 })

  // A frente, de frente (y do chão do rádio, `ry1`, para cima), guardada debaixo da tampa: sobe com a mesa na 3/4.
  const meio = ry1 + MEIO_DA_FRENTE
  const guardada = (f: Forma): Forma => ({ b: [f.b[0], f.b[1], f.b[2], 2 * meio - f.b[1]], d: f.d })
  const fy = (t: number): number => ry1 - t * altura
  L.push(P(guardada(caixa(rx0, fy(1), rx1, ry1, 1.2)), OLIVA, { tabua: 0, bisel: 1, contorno: 0.3, metal: 0.2, tom: 0.9, semente: 710 }))
  L.push(P(guardada(caixa(rx0 + 0.6, fy(0.4) - 0.35, rx1 - 0.6, fy(0.4) + 0.35)), BAQUELITE, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: 711 }))
  for (const f of [0.22, 0.78]) {
    const x = rx0 + (rx1 - rx0) * f
    L.push(P(guardada(caixa(x - 1.4, fy(0.52), x + 1.4, fy(0.2), 0.4)), PREGO, { tabua: 0, bisel: 0.5, contorno: 0.25, metal: 0.5, tom: 1.3 }))
  }
  const xPlaca = (rx0 + rx1) / 2
  L.push(P(guardada(caixa(xPlaca - 4, fy(0.9), xPlaca + 4, fy(0.58), 0.3)), ESCALA, { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 0.92, semente: 712 }))
  L.push(P(guardada(caixa(rx0 + 1, fy(0.1), rx1 - 1, ry1, 0.4)), BAQUELITE, { tabua: 0, bisel: 0.3, contorno: 0.1, tom: 1.2, semente: 713 }))

  // A tampa: a caixa (com a sombra na mesa), o painel afundado e os comandos.
  L.push(P(radio, OLIVA, { tabua: 0, bisel: 1.6, contorno: 0.3, metal: 0.22, semente: 720, projeta: SOMBRA_DO_RADIO }))
  const painel = caixa(rx0 + 2.2, ry0 + 2.2, rx1 - 2.2, ry1 - 2.2, 0.8)
  L.push(P(painel, OLIVA, { tabua: 0, bisel: 0.6, contorno: 0.14, metal: 0.15, tom: 0.84, recesso: { k: 1.6, forca: 0.3 }, semente: 721 }))
  const pw = rx1 - rx0
  const ph = ry1 - ry0
  // A janela da frequência, com a escala riscada.
  const jx0 = rx0 + pw * 0.12
  const jx1 = rx0 + pw * 0.56
  const jy0 = ry0 + ph * 0.22
  const jy1 = ry0 + ph * 0.44
  L.push(P(caixa(jx0, jy0, jx1, jy1, 0.5), ESCALA, { tabua: 0, bisel: 0.5, contorno: 0.3, recesso: { k: 0.8, forca: 0.3 }, semente: 722 }))
  const riscos = 7
  for (let i = 1; i < riscos; i += 1) {
    const x = jx0 + ((jx1 - jx0) * i) / riscos
    L.push(P(caixa(x - 0.18, jy0 + 0.5, x + 0.18, i % 2 === 0 ? jy1 - 0.5 : (jy0 + jy1) / 2), TINTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8 }))
  }
  L.push(P(caixa(jx0 + (jx1 - jx0) * 0.62 - 0.25, jy0 + 0.3, jx0 + (jx1 - jx0) * 0.62 + 0.25, jy1 - 0.3), { classe: 'liso', rgb: [0x9a, 0x4a, 0x3c] }, { tabua: 0, bisel: 0, contorno: 0 }))
  // Os botões grandes (a saia de metal, a baquelite e o risco) e os pequenos.
  const botao = (x: number, y: number, r: number, s: number): void => {
    L.push(P(elipse(x, y, r * 1.22, r * 1.22), PREGO, { tabua: 0, bisel: r * 0.3, contorno: 0.25, metal: 0.5, tom: 1.1, semente: s }))
    L.push(P(elipse(x, y, r, r), BAQUELITE, { tabua: 0, bisel: r * 0.55, contorno: 0.2, semente: s + 1, projeta: { dist: 0.9, forca: 0.35, suave: 0.6 } }))
    const a = hash(s, 1, 77) * Math.PI * 2
    L.push(P(capsula(x, y, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, 0.32), ESCALA, { tabua: 0, bisel: 0, contorno: 0 }))
  }
  const rBotao = Math.min(3.1, ph * 0.16)
  botao(rx0 + pw * 0.2, ry0 + ph * 0.7, rBotao, 730)
  botao(rx0 + pw * 0.46, ry0 + ph * 0.7, rBotao, 733)
  botao(rx0 + pw * 0.66, ry0 + ph * 0.32, rBotao * 0.5, 736)
  botao(rx0 + pw * 0.66, ry0 + ph * 0.7, rBotao * 0.5, 739)
  // O mostrador redondo, com o ponteiro.
  const mx = rx0 + pw * 0.83
  const my = ry0 + ph * 0.66
  const rm = rBotao * 0.95
  L.push(P(elipse(mx, my, rm, rm), ESCALA, { tabua: 0, bisel: 0.5, contorno: 0.35, recesso: { k: 0.9, forca: 0.3 }, semente: 742 }))
  L.push(P(capsula(mx, my + rm * 0.5, mx + rm * 0.55, my - rm * 0.55, 0.22), TINTA, { tabua: 0, bisel: 0, contorno: 0 }))
  // As tomadas dos fios, na beira direita do painel.
  const tomadas: Ponto[] = [[rx1 - 3.4, ry0 + ph * 0.28], [rx1 - 3.4, ry0 + ph * 0.5]]
  for (const [x, y] of tomadas) L.push(P(elipse(x, y, 1.1, 1.1), PREGO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.55 }))
  // A alça de lona atrás, presa por duas argolas.
  const ya = ry0 + 1.1
  L.push(P(capsula(rx0 + pw * 0.3, ya, rx0 + pw * 0.7, ya, 1), LONA, { eixo: 0, tabua: 0, bisel: 0.7, contorno: 0.3, semente: 744, projeta: { dist: 0.9, forca: 0.3 } }))
  for (const f of [0.28, 0.72]) L.push(P(elipse(rx0 + pw * f, ya, 1, 1), PREGO, { tabua: 0, bisel: 0.5, contorno: 0.25, metal: 0.5 }))

  // A antena: a base no canto (fica com o rádio: o meio dela sai da vara) e a vara, coluna até a ponta.
  const ax = rx1 - 3.2
  const ay = ry0 + 3.2
  L.push(P(elipse(ax + 0.9, ay + 0.9, 2, 2), PREGO, { tabua: 0, bisel: 1, contorno: 0.3, metal: 0.5, tom: 0.85, projeta: { dist: 0.8, forca: 0.3 } }))
  const vara = elipse(ax, ay, RAIO_DA_ANTENA, RAIO_DA_ANTENA)
  cena.sombras.push({ forma: vara, z: ALTURA_DA_ANTENA * g, forca: 0.2, suave: 0.6 })
  L.push(P(elipse(ax, ay, RAIO_DA_ANTENA * 1.3, RAIO_DA_ANTENA * 1.3), PREGO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.6, tom: 0.75 }))

  // ---------- em cima da mesa ----------
  const tx1 = hw - recuo
  const ty1 = hh - recuo
  // Os fones, deitados à direita do rádio: as conchas com a almofada, o arco entre elas e o fio até a tomada de cima.
  const fx = rx1 + (tx1 - rx1) * 0.36
  const conchas: Ponto[] = [[fx, ry0 + 0.24 * casa], [fx + 0.2 * casa, ry0 + 0.2 * casa]]
  const arco: Ponto[] = []
  const passos = 9
  const [c1x, c1y] = conchas[0]
  const [c2x, c2y] = conchas[1]
  const ax0 = (c1x + c2x) / 2
  const ay0 = (c1y + c2y) / 2
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos
    const a = Math.PI * (1 + t)
    arco.push([ax0 + Math.cos(a) * (c2x - c1x) * 0.55, ay0 + (c2y - c1y) * (t - 0.5) + Math.sin(a) * 0.17 * casa])
  }
  L.push(P(cadeia(enroscado([[c1x, c1y + 2], [c1x - 3, c1y + 6], [rx1 + 2, tomadas[0][1] + 6], [rx1 + 0.2, tomadas[0][1]]], 0), 0.5), BAQUELITE, { tabua: 0, bisel: 0.3, contorno: 0.2, semente: 750, projeta: SOMBRA_NA_MESA }))
  L.push(P(cadeia(arco, 0.9), PREGO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.5, semente: 751, projeta: SOMBRA_NA_MESA }))
  conchas.forEach(([x, y], i) => {
    const rx = 0.08 * casa
    const ry = 0.095 * casa
    L.push(P(elipse(x, y, rx, ry), COURO, { tabua: 0, bisel: rx * 0.5, contorno: 0.3, semente: 752 + i, projeta: { dist: 1.4, forca: 0.36, suave: 1 } }))
    L.push(P(elipse(x, y, rx * 0.62, ry * 0.62), BAQUELITE, { tabua: 0, bisel: rx * 0.4, contorno: 0.15, semente: 754 + i }))
  })

  // O monofone na frente, à direita, com o fio enrolado até a tomada de baixo.
  const mx0 = rx1 + (tx1 - rx1) * 0.2
  const mx1 = tx1 - 0.08 * casa
  const myy = ry1 + (ty1 - ry1) * 0.38
  const fone = uniao(capsula(mx0, myy, mx1, myy - 1.5, 1.6), uniao(elipse(mx0, myy, 3.2, 2.9), elipse(mx1, myy - 1.5, 3, 2.7)))
  L.push(P(cadeia(enroscado([[mx0 - 2, myy + 1], [mx0 - 6, myy - 6], [rx1 + 3, tomadas[1][1] + 4], [rx1 + 0.2, tomadas[1][1]]], 1.1), 0.5), BAQUELITE, { tabua: 0, bisel: 0.3, contorno: 0.25, semente: 760, projeta: SOMBRA_NA_MESA }))
  L.push(P(fone, BAQUELITE, { tabua: 0, bisel: 1.4, contorno: 0.25, tom: 1.25, semente: 761, projeta: { dist: 1.5, forca: 0.36, suave: 1 } }))
  L.push(P(caixa((mx0 + mx1) / 2 - 1.2, myy - 1.6, (mx0 + mx1) / 2 + 1.2, myy, 0.4), PREGO, { tabua: 0, bisel: 0.4, contorno: 0.2, metal: 0.5 }))
  for (const [x, y] of [[mx0, myy], [mx1, myy - 1.5]] as const) L.push(P(elipse(x, y, 1.5, 1.4), BAQUELITE, { tabua: 0, bisel: 0.6, contorno: 0.1, tom: 0.85 }))

  // O bloco de anotações à esquerda, na frente, um nada torto, com as linhas escritas e o lápis.
  const bx = rx0 + 0.12 * casa
  const by = ry1 + (ty1 - ry1) * 0.22
  const bw = 0.34 * casa
  const bh = 0.26 * casa
  const torto = 0.09
  const giro = (x: number, y: number): Ponto => [bx + bw / 2 + (x - bw / 2) * Math.cos(torto) - (y - bh / 2) * Math.sin(torto), by + bh / 2 + (x - bw / 2) * Math.sin(torto) + (y - bh / 2) * Math.cos(torto)]
  L.push(P(poligono([giro(0, 0), giro(bw, 0), giro(bw, bh), giro(0, bh)]), PAPEL, { tabua: 0, bisel: 0.6, contorno: 0.25, semente: 770, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(poligono([giro(0, 0), giro(bw, 0), giro(bw, bh * 0.12), giro(0, bh * 0.12)]), OLIVA, { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 0.9 }))
  for (let i = 0; i < 4; i += 1) {
    const y = bh * (0.3 + i * 0.16)
    const fim = bw * (0.6 + hash(i, 2, 71) * 0.3)
    const [x0, y0] = giro(bw * 0.12, y)
    const [x1, y1] = giro(fim, y)
    L.push(P(capsula(x0, y0, x1, y1, 0.3), TINTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55 }))
  }
  const [lx0, ly0] = giro(bw * 0.7, bh * 1.05)
  const [lx1, ly1] = giro(bw * 1.25, bh * 0.35)
  L.push(P(capsula(lx0, ly0, lx1, ly1, 0.8), LAPIS, { eixo: Math.atan2(ly1 - ly0, lx1 - lx0), tabua: 0, bisel: 0.5, contorno: 0.3, semente: 771, projeta: SOMBRA_NA_MESA }))
  L.push(P(elipse(lx0, ly0, 0.7, 0.7), TINTA, { tabua: 0, bisel: 0.3, contorno: 0.1 }))

  // A caneca de ágata no canto da frente, à direita, debaixo do monofone: a borda escura, o café e a asa.
  const cx = tx1 - 0.15 * casa
  const cy = ty1 - 0.12 * casa
  const rc = 0.07 * casa
  L.push(P(capsula(cx + rc * 0.9, cy, cx + rc * 1.55, cy, 0.7), AGATA, { tabua: 0, bisel: 0.4, contorno: 0.3, projeta: SOMBRA_NA_MESA }))
  L.push(P(elipse(cx, cy, rc, rc), AGATA, { tabua: 0, bisel: rc * 0.3, contorno: 0.32, semente: 780, projeta: { dist: 1.3, forca: 0.34, suave: 1 } }))
  L.push(P(anel(cx, cy, rc * 0.92, rc * 0.92, rc * 0.74, rc * 0.74), TINTA, { tabua: 0, bisel: 0.2, contorno: 0, tom: 1.1 }))
  L.push(P(elipse(cx, cy, rc * 0.74, rc * 0.74), CAFE, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 1, forca: 0.35 } }))
  cena.corDoPiso = ESCURO_DO_RADIO
}

/**
 * O caminho de um fio pelos pontos, com a mola do fio enrolado: a cada passo
 * miúdo o fio sai `mola` px para um lado e para o outro (0 = o fio liso, só
 * um nada ondulado).
 */
function enroscado(pontos: readonly Ponto[], mola: number): Ponto[] {
  const saida: Ponto[] = []
  const PASSO = 0.9
  for (let i = 1; i < pontos.length; i += 1) {
    const [x0, y0] = pontos[i - 1]
    const [x1, y1] = pontos[i]
    const d = Math.hypot(x1 - x0, y1 - y0) || 1
    const n = Math.max(1, Math.round(d / PASSO))
    for (let j = i === 1 ? 0 : 1; j <= n; j += 1) {
      const t = j / n
      const lado = mola > 0 ? (j % 2 === 0 ? 1 : -1) * mola : Math.sin(t * Math.PI) * 0.4
      saida.push([x0 + (x1 - x0) * t - ((y1 - y0) / d) * lado, y0 + (y1 - y0) * t + ((x1 - x0) / d) * lado])
    }
  }
  return saida
}
