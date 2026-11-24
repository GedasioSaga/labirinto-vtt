/**
 * JAULA DE CHÃO de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão
 * de chão da gaiola suspensa): a jaula baixa de barras de ferro, pousada no chão da masmorra, alta só o bastante
 * para um preso AGACHADO. Por cima, a GRADE do teto: o quadro de barras chatas, as barras finas de norte a sul e
 * duas travessas finas, com os rebites onde as barras de pé passam; nos cantos, os POSTES quadrados. Pelos vãos se
 * vê o PRESO encolhido, abraçando os joelhos com a cabeça baixa, sentado no NINHO de palha amassada (embaixo e atrás
 * dele, nunca palha solta pelo chão) e a CORRENTE que prende o tornozelo ao poste do canto. Na frente (o lado de
 * baixo), as duas dobradiças da porta e o CADEADO.
 *
 * O que diz "jaula" a 25% de zoom é o quadrado riscado de barras escuras com a mancha do preso dentro e a sombra
 * em grade que ela faz no chão. Várias lado a lado viram as gaiolas empilhadas da masmorra.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) cada barra de pé e cada poste é uma coluna da altura da jaula, e o quadro e as
 * barras do teto são tampos soltos no alto dela, de beirada fina (`ESPESSURA_DA_JAULA_DE_CHAO`). As duas travessas
 * NÃO são tampos: sobem com a barra do teto em que se apoiam (`comMeioEm`), sem beirada própria (com beirada, liam
 * como prateleiras soltas no meio do alto). O que fica no chão (o preso, a palha e a corrente) tem o meio num vão
 * entre as barras (`noChao`): não sobe com o teto e fica atrás das barras da frente.
 *
 * Esticada, a jaula acompanha a pegada e ganha barras (uma a cada `PASSO_DA_BARRA`), nunca barras mais grossas; o
 * preso e o ninho têm o tamanho do menor lado. Material: `grade` (o ferro). O preso e a palha são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { capsula, caixa, elipse, elipseGirada, menos, uniao, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas ----------

/** A altura da jaula (px do protótipo): a de um preso agachado. */
const ALTURA_DA_JAULA = 0.58 * G
/** A beirada das barras do teto na 3/4 (px): o ferro chato. */
export const ESPESSURA_DA_JAULA_DE_CHAO = 2.2
/** O quanto a jaula entra da beira da pegada e o passo entre as barras de pé (px). */
const RECUO = 2.6
const PASSO_DA_BARRA = 7.2
/** A meia largura do quadro do teto, o raio das barras de pé, o das barras do teto e o meio lado do poste (px). */
const MEIO_QUADRO = 1.55
const RAIO_DA_BARRA = 1.15
const RAIO_DO_TETO = 0.95
/** As travessas do teto: metade da grossura das barras e mais apagadas. */
const RAIO_DA_TRAVESSA = RAIO_DO_TETO * 0.5
const TOM_DA_TRAVESSA = 0.75
/** A borda borrada da faixa de sombra de cada barra no chão (px): a média da do motor, do pé (0,8) ao topo (3,7). */
const SUAVE_DA_FAIXA = 2.2
const MEIO_POSTE = 1.9
/** O menor lado da pegada de partida (1 casa): o preso, o ninho e a corrente são medidos nele. */
const LADO_DE_PARTIDA = G
/** O ninho de palha: quantos fiapos, o rumo comum deles (rad), o tom e a transparência. */
const FIAPOS = 48
const RUMO_DA_PALHA = 0.42
const TOM_DA_PALHA = 0.7
const ALFA_DA_PALHA = 0.75

// ---------- os materiais fixos ----------

const PELE: MaterialDaPeca = { classe: 'liso', rgb: [0xa3, 0x7e, 0x66] }
const TRAPO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x7c, 0x6e, 0x58] }
const CALCA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x5d, 0x54, 0x47] }
/** O cabelo, escuro, para a cabeça baixa saltar entre as barras. */
const CABELO: Rgb = [0x35, 0x2a, 0x22]
const PALHA = materialDaPeca('palha')
const BURACO_DA_CHAVE: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x27, 0x22] }
/**
 * O escuro em que o pixel escuro demais é levantado: cinza-ferro frio. Com o da nogueira, a beirada das barras do
 * teto na 3/4 (na sombra delas mesmas) saía marrom de ferrugem.
 */
const ESCURO_DO_FERRO: Rgb = [0x40, 0x43, 0x47]

/** O cabelo visto de cima: os fios saindo do redemoinho, sem listra (o ruído corre ao longo do raio). */
function texCabelo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const a = Math.atan2(y - cy, x - cx)
    const r = Math.hypot(x - cx, y - cy)
    s[0] = CABELO[0]
    s[1] = CABELO[1]
    s[2] = CABELO[2]
    s[3] += ruido(a * 7.5, r * 0.35) * 0.16 + ruido(a * 19, r * 0.9) * 0.06
  }
}

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 decide pela caixa de quem a peça é. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

/** O meio do vão entre duas linhas em que `v` cai (as linhas em ordem, com as duas beiras). */
function meioDoVao(v: number, linhas: readonly number[]): number {
  for (let i = 1; i < linhas.length; i += 1) if (v <= linhas[i]) return (linhas[i - 1] + linhas[i]) / 2
  return (linhas[linhas.length - 2] + linhas[linhas.length - 1]) / 2
}

/** Um elo de corrente girado `a`: deitado (anel) ou de pé (a fita vista de lado). */
function elo(cx: number, cy: number, a: number, deitado: boolean, k: number): Forma {
  if (!deitado) return capsula(cx - Math.cos(a) * 1.5 * k, cy - Math.sin(a) * 1.5 * k, cx + Math.cos(a) * 1.5 * k, cy + Math.sin(a) * 1.5 * k, 0.55 * k)
  return menos(elipseGirada(cx, cy, 2.1 * k, 1.35 * k, a), elipseGirada(cx, cy, 1.2 * k, 0.5 * k, a))
}

export const montarJaulaDeChao: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const ferro = c.m.grade
  const L = cena.partes
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const ax = hw - RECUO
  const ay = hh - RECUO
  const H = ALTURA_DA_JAULA
  const nx = Math.max(3, Math.round((ax * 2) / PASSO_DA_BARRA))
  const ny = Math.max(3, Math.round((ay * 2) / PASSO_DA_BARRA))
  const xs = Array.from({ length: nx + 1 }, (_, i) => -ax + (i * ax * 2) / nx)
  const ys = Array.from({ length: ny + 1 }, (_, j) => -ay + (j * ay * 2) / ny)
  const travessas = [-ay + (ay * 2) / 3, -ay + (ay * 4) / 3]
  const linhasY = [-ay, ...travessas, ay]
  const noChao = (f: Forma): Forma => comMeioEm(f, meioDoVao((f.b[0] + f.b[2]) / 2, xs), meioDoVao((f.b[1] + f.b[3]) / 2, linhasY))
  cena.corDoPiso = ESCURO_DO_FERRO

  // ---------- as sombras: as barras de pé e os postes (colunas), o teto (tampos soltos) e o contato ----------
  cena.sombras.push(contato(caixa(-ax, -ay, ax, ay, 1), 0.16))
  const pes: { x: number; y: number; poste: boolean }[] = []
  xs.forEach((x, i) => {
    for (const y of [-ay, ay]) pes.push({ x, y, poste: i === 0 || i === nx })
  })
  ys.slice(1, -1).forEach((y) => {
    for (const x of [-ax, ax]) pes.push({ x, y, poste: false })
  })
  // Cada barra entra duas vezes: a coluna de força zero só dá a altura da 3/4 (o motor pula a passada) e a faixa no
  // chão já vai arrastada, uma cápsula do pé até a sombra do topo, com z = 0. Arrastadas pelo motor, as 24 barras
  // mediam a forma 13 vezes por pixel cada uma, numa caixa quase toda vazia. Os 4 postes, quadrados, seguem no motor.
  for (const p of pes) {
    if (p.poste) {
      const forma = caixa(p.x - MEIO_POSTE, p.y - MEIO_POSTE, p.x + MEIO_POSTE, p.y + MEIO_POSTE, 0.4)
      cena.sombras.push({ forma, z: H, forca: 0.22 }, contato(forma, 0.3))
      continue
    }
    const pe = elipse(p.x, p.y, RAIO_DA_BARRA, RAIO_DA_BARRA)
    const faixa = capsula(p.x, p.y, p.x + SOMBRA_X * H, p.y + SOMBRA_Y * H, RAIO_DA_BARRA)
    cena.sombras.push({ forma: pe, z: H, forca: 0 }, { forma: faixa, z: 0, forca: 0.22, suave: SUAVE_DA_FAIXA }, contato(pe, 0.3))
  }
  const quadro: Forma[] = [
    caixa(-ax - MEIO_QUADRO, -ay - MEIO_QUADRO, ax + MEIO_QUADRO, -ay + MEIO_QUADRO, 0.5),
    caixa(-ax - MEIO_QUADRO, ay - MEIO_QUADRO, ax + MEIO_QUADRO, ay + MEIO_QUADRO, 0.5),
    caixa(-ax - MEIO_QUADRO, -ay + MEIO_QUADRO, -ax + MEIO_QUADRO, ay - MEIO_QUADRO, 0.3),
    caixa(ax - MEIO_QUADRO, -ay + MEIO_QUADRO, ax + MEIO_QUADRO, ay - MEIO_QUADRO, 0.3),
  ]
  const teto: Forma[] = xs.slice(1, -1).map((x) => capsula(x, -ay, x, ay, RAIO_DO_TETO))
  for (const f of [...quadro, ...teto]) cena.sombras.push({ forma: f, z: H, solta: true, forca: 0.2 })
  // As travessas não são estrutura (a 3/4 não lhes dá beirada): a sombra delas vai pronta no chão, já deslocada.
  for (const y of travessas) {
    cena.sombras.push({ forma: capsula(-ax + SOMBRA_X * H, y + SOMBRA_Y * H, ax + SOMBRA_X * H, y + SOMBRA_Y * H, RAIO_DA_TRAVESSA), z: 0, forca: 0.16, suave: SUAVE_DA_FAIXA })
  }

  // ---------- no chão: o ninho de palha, o preso e a corrente ----------
  const px = -2.2 * k
  const py = 1.6 * k
  // O ninho: um monte só, embaixo e atrás do preso, de fiapos curtos quase paralelos (espalhada, a palha virava
  // confete; solta e clara, palitos de fósforo).
  const [nmx, nmy, nrx, nry] = [px + 0.6 * k, py - 5.2 * k, 12.6 * k, 9.2 * k]
  const ninho = uniao(uniao(elipse(nmx, nmy, nrx, nry), elipse(nmx - 5 * k, nmy + 4.6 * k, 6.4 * k, 5.2 * k)), elipse(nmx + 5.6 * k, nmy + 3.8 * k, 6 * k, 4.8 * k))
  L.push(P(noChao(ninho), PALHA, { eixo: RUMO_DA_PALHA, bisel: 0.6, contorno: 0.1, tom: TOM_DA_PALHA * 0.82, alfa: 0.6, suave: 1.1, semente: 9301 }))
  for (let i = 0; i < FIAPOS; i += 1) {
    const ang = hash(i, 1, 9302) * Math.PI * 2
    const r = Math.sqrt(hash(i, 2, 9302)) * 0.92
    const fx = nmx + Math.cos(ang) * nrx * r
    const fy = nmy + Math.sin(ang) * nry * r * 0.94
    const rumo = RUMO_DA_PALHA + (hash(i, 3, 9302) - 0.5) * 0.5
    const meio = (1.1 + hash(i, 4, 9302) * 0.9) * k
    const fiapo = capsula(fx - Math.cos(rumo) * meio, fy - Math.sin(rumo) * meio, fx + Math.cos(rumo) * meio, fy + Math.sin(rumo) * meio, 0.3 * k)
    L.push(P(noChao(fiapo), PALHA, { eixo: rumo, bisel: 0.25, contorno: 0.16, tom: TOM_DA_PALHA + (hash(i, 5, 9302) - 0.5) * 0.14, alfa: ALFA_DA_PALHA, semente: 9310 + (i % 24) }))
  }

  // O preso: encolhido de frente para o sul, a cabeça baixa sobre os joelhos e os braços em volta deles. Os ombros e
  // a nuca vão claros, num anel em volta da cabeça escura, para ela saltar entre as barras.
  cena.sombras.push(contato(elipse(px, py + 1.8 * k, 10.5 * k, 11.5 * k), 0.32))
  for (const lado of [-1, 1]) {
    L.push(P(noChao(elipse(px + lado * 4.6 * k, py + 11.6 * k, 1.8 * k, 2.4 * k)), PELE, { bisel: 0.8, contorno: 0.3, tom: 0.8, semente: 9330 + lado }))
    L.push(P(noChao(elipse(px + lado * 3.5 * k, py + 7.8 * k, 3.1 * k, 2.7 * k)), CALCA, { bisel: 1.2, contorno: 0.3, tom: 1, semente: 9332 + lado }))
  }
  L.push(P(noChao(elipse(px, py - 4.4 * k, 8.8 * k, 7 * k)), TRAPO, { bisel: 2.4, contorno: 0.3, tom: 1.1, ruga: 0.5, semente: 9334 }))
  L.push(P(noChao(elipse(px, py - 2.7 * k, 2.7 * k, 1.9 * k)), PELE, { bisel: 0.9, contorno: 0.26, tom: 1.1, semente: 9335 }))
  for (const lado of [-1, 1]) {
    const braco = capsula(px + lado * 7.2 * k, py - 3.6 * k, px + lado * 3 * k, py + 7 * k, 2.05 * k)
    L.push(P(noChao(braco), PELE, { eixo: QUARTO, bisel: 1.2, contorno: 0.3, tom: 0.98, semente: 9336 + lado, projeta: { dist: 1, forca: 0.35 } }))
  }
  L.push(P(noChao(elipse(px, py + 8.4 * k, 2.6 * k, 1.8 * k)), PELE, { bisel: 0.9, contorno: 0.3, tom: 0.98, semente: 9338 }))
  const cabeca = elipse(px, py + 1.2 * k, 4.4 * k, 4.8 * k)
  L.push(P(noChao(cabeca), PELE, { textura: texCabelo(px - 0.6 * k, py - 0.4 * k), bisel: 1.8, contorno: 0.36, semente: 9339, projeta: { dist: 1.4, forca: 0.45 } }))

  // A corrente: do tornozelo direito até o poste do canto de baixo à direita.
  const ex = px + 5.4 * k
  const ey = py + 12.4 * k
  const elos = 6
  for (let i = 0; i < elos; i += 1) {
    const t = (i + 0.5) / elos
    const cx = ex + (ax - 1.6 - ex) * t
    const cy = ey + (ay - 1.6 - ey) * t + Math.sin(t * Math.PI) * 1.6 * k
    const a = Math.atan2(ay - ey, ax - ex)
    L.push(P(noChao(elo(cx, cy, a, i % 2 === 0, k)), ferro, { tabua: 0, bisel: 0.5, contorno: 0.34, tom: 0.92, metal: 0.5, semente: 9340 + i }))
  }

  // ---------- o teto: as barras finas, as travessas, o quadro, os rebites e os postes ----------
  const sombraDoTeto = { dist: 5.2, forca: 0.34, suave: 1.1 }
  teto.forEach((f, i) => {
    L.push(P(f, ferro, { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_TETO, contorno: 0.32, tom: 1, metal: 0.4, semente: 9350 + i, projeta: sombraDoTeto }))
  })
  // As travessas, finas e apagadas, apoiadas na segunda barra do teto: sobem com ela na 3/4.
  const apoio = xs[Math.min(1, xs.length - 1)]
  travessas.forEach((y, i) => {
    L.push(P(comMeioEm(capsula(-ax, y, ax, y, RAIO_DA_TRAVESSA), apoio, y), ferro, { tabua: 0, bisel: RAIO_DA_TRAVESSA, contorno: 0.3, tom: TOM_DA_TRAVESSA, metal: 0.3, semente: 9360 + i, projeta: { dist: 4.6, forca: 0.24, suave: 1.1 } }))
  })
  quadro.forEach((f, i) => {
    L.push(P(f, ferro, { eixo: i < 2 ? 0 : QUARTO, tabua: 0, bisel: 1, contorno: 0.32, tom: 0.84, metal: 0.38, semente: 9370 + i, projeta: sombraDoTeto }))
  })
  for (const p of pes) {
    if (p.poste) continue
    L.push(P(elipse(p.x, p.y, 1.05, 1.05), ferro, { bisel: 0.7, contorno: 0.3, tom: 1.14, metal: 0.55, semente: 9380 }))
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx * ax
      const y = sy * ay
      L.push(P(caixa(x - MEIO_POSTE, y - MEIO_POSTE, x + MEIO_POSTE, y + MEIO_POSTE, 0.4), ferro, { tabua: 0, bisel: 0.9, contorno: 0.34, tom: 0.96, metal: 0.45, semente: 9385 }))
      L.push(P(elipse(x, y, 0.8, 0.8), ferro, { bisel: 0.5, contorno: 0.3, tom: 1.2, metal: 0.55, semente: 9386 }))
    }
  }

  // ---------- a porta da frente: as dobradiças e o cadeado pendurado para fora ----------
  const porta = xs[Math.floor(nx / 2)]
  for (const dx of [-5.4 * k, -1.8 * k]) {
    L.push(P(caixa(porta + dx - 1.2 * k, ay - MEIO_QUADRO - 0.6, porta + dx + 1.2 * k, ay + MEIO_QUADRO + 0.6, 0.4), ferro, { tabua: 0, bisel: 0.6, contorno: 0.34, tom: 0.74, semente: 9390 }))
  }
  const cx = porta + 3.2 * k
  const cadeado = caixa(cx - 2.2 * k, ay + 2.2 * k, cx + 2.2 * k, ay + 5.6 * k, 0.9 * k)
  const argola = menos(elipse(cx, ay + 2.2 * k, 1.6 * k, 1.9 * k), elipse(cx, ay + 2.2 * k, 0.8 * k, 1.1 * k))
  L.push(P(comMeioEm(argola, cx, ay), ferro, { tabua: 0, bisel: 0.5, contorno: 0.34, tom: 1.08, metal: 0.55, semente: 9391 }))
  L.push(P(comMeioEm(cadeado, cx, ay), ferro, { tabua: 0, bisel: 0.9, contorno: 0.36, tom: 0.9, metal: 0.5, semente: 9392, projeta: { dist: 1, forca: 0.4 } }))
  L.push(P(comMeioEm(elipse(cx, ay + 4.2 * k, 0.45 * k, 0.75 * k), cx, ay), BURACO_DA_CHAVE, { bisel: 0, contorno: 0, tom: 1, semente: 9393 }))
}
