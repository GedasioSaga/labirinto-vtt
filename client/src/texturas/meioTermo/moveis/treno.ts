/**
 * TRENÓ (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Neve). Corre pelo
 * lado MAIOR da pegada, com a FRENTE (as pontas enroladas dos patins e a corda de puxar) para o norte no trenó em pé e
 * para o oeste no deitado. Tudo é montado no referencial dele (`u` ao comprido, negativo para a frente; `v` de través,
 * negativo para o lado da luz), como o muro baixo de pedra.
 *
 * - DE CARGA (`montarTreno`, a 1ª versão): o trenó comprido de transporte. Os dois PATINS de madeira passam um nada da
 *   beira do estrado (a sapata de ferro à mostra dos dois lados) e sobem na frente até a PONTA ENROLADA, com a barra
 *   de puxar entre as duas e a corda largada no chão; o ESTRADO de tábuas de través com as duas longarinas; a CARGA:
 *   o fardo de lona amarrado (duas cordas de través e uma ao comprido, a dobra da lona), um saco de boca amarrada,
 *   um rolo de corda e, atrás, a caixa de tábuas.
 * - PEQUENO (`montarTrenoPequeno`, em `versoes/trenoVersoes.ts`): o trenó leve de uma pessoa, estreito e encostado
 *   atrás na pegada, de três ripas ao comprido, com a barra de guiar na frente, as pontas dos patins enroladas, a
 *   corda de puxar frouxa entre elas e a manta dobrada atrás.
 *
 * Na 3/4 (derivada) cada peça sobe com a estrutura mais alta que contém o meio dela, e as estruturas são pintadas do
 * norte para o sul pela base: os patins são colunas baixas que acabam antes do estrado, as pontas enroladas sobem
 * mais, a carga são colunas e o estrado é um tampo solto em TRECHOS, só onde não há carga (um tampo inteiro, de base
 * ao sul de tudo, seria pintado por cima do fardo). O saco, o rolo e a manta vão no tampo, sem estrutura própria.
 * Materiais: `madeira` (patins, estrado, caixa), `patins` (as sapatas, a barra, os pregos; um metal) e `carga` (a
 * lona, o saco e a manta; um tecido). A corda é fixa.
 */
import { hash, type Rgb } from '../../ruido'
import { cadeia, caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, TOM_DA_CORDA, type Cena, type CriarPeca, type MaterialDaPeca } from './motor'
import { BURACO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas em casas: o alto dos patins e da ponta enrolada, o estrado, a longarina e o alto da carga. */
const ALTO_DO_PATIM = 0.1
const ALTO_DA_PONTA = 0.3
const ALTO_DO_ESTRADO = 0.2
const ALTO_DA_LONGARINA = 0.24
const ALTO_DO_FARDO = 0.56
const ALTO_DA_CAIXA = 0.44
/** Meia largura do estrado do de carga, em fração da meia fundura, e quanto o patim passa da beira dele (px). */
const ESTRADO = 0.84
const PATIM_FORA = 1.3
/** A largura do patim e da sapata (px) e quanto a ponta enrolada vai à frente do estrado (fração do comprimento). */
const PATIM = 3.2
const SAPATA = 1.3
const CURVA = 0.11
/** A tábua do estrado (px ao comprido) e o vão entre duas. */
const TABUA = 6.4
const VAO = 0.9
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
/** O escuro em que o pixel escuro demais é levantado: o da madeira na sombra. */
const ESCURO_DA_MADEIRA: Rgb = [0x47, 0x3e, 0x37]

/** O referencial do trenó: `u` ao comprido (negativo = a frente), `v` de través (negativo = o lado da luz). */
interface Referencial {
  ret(u0: number, v0: number, u1: number, v1: number, raio?: number): Forma
  pol(pontos: readonly Ponto[]): Forma
  oval(u: number, v: number, ru: number, rv: number): Forma
  fio(pontos: readonly Ponto[], raio: number): Forma
  veio(angulo: number): number
}

function referencial(aoComprido: boolean): Referencial {
  if (aoComprido) {
    return {
      ret: (u0, v0, u1, v1, raio = 0) => caixa(u0, v0, u1, v1, raio),
      pol: (pontos) => poligono(pontos),
      oval: (u, v, ru, rv) => elipse(u, v, ru, rv),
      fio: (pontos, raio) => cadeia(pontos, raio),
      veio: (angulo) => angulo,
    }
  }
  const trocado = ([u, v]: Ponto): Ponto => [v, u]
  return {
    ret: (u0, v0, u1, v1, raio = 0) => caixa(v0, u0, v1, u1, raio),
    pol: (pontos) => poligono(pontos.map(trocado)),
    oval: (u, v, ru, rv) => elipse(v, u, rv, ru),
    fio: (pontos, raio) => cadeia(pontos.map(trocado), raio),
    veio: (angulo) => QUARTO - angulo,
  }
}

interface Medidas {
  readonly R: Referencial
  readonly mc: number
  readonly mf: number
  readonly g: number
}

function medidasDo(c: ContextoDoMovel): Medidas {
  const aoComprido = c.w >= c.h
  return { R: referencial(aoComprido), mc: (aoComprido ? c.w : c.h) / 2, mf: (aoComprido ? c.h : c.w) / 2, g: c.g }
}

/** A curva de `a` a `b` puxada para `meio` (de segundo grau), em `n` lances: a corda frouxa. */
function curvaDe(a: Ponto, meio: Ponto, b: Ponto, n = 12): Ponto[] {
  return Array.from({ length: n + 1 }, (_, i): Ponto => {
    const t = i / n
    const s = 1 - t
    return [s * s * a[0] + 2 * s * t * meio[0] + t * t * b[0], s * s * a[1] + 2 * s * t * meio[1] + t * t * b[1]]
  })
}

/**
 * Os dois patins de `uFrente` a `uTras`, com a ponta que sobe até `uPonta` e se enrola (de cima, o rolo da madeira
 * com o vão escuro no meio) e, no de carga, a sapata de ferro do lado de fora.
 */
function patins(P: CriarPeca, cena: Cena, me: Medidas, madeira: MaterialDaPeca, ferro: MaterialDaPeca, uFrente: number, uTras: number, uPonta: number, bitola: number, semente: number, comSapata: boolean): void {
  const { R, g } = me
  const L = cena.partes
  for (const lado of [-1, 1]) {
    const v = lado * bitola
    const reto = R.ret(uFrente, v - PATIM / 2, uTras, v + PATIM / 2, 1.2)
    const ponta = R.fio([[uFrente + 2.4, v], [uPonta + 1.2, v]], PATIM / 2)
    cena.sombras.push({ forma: reto, z: g * ALTO_DO_PATIM }, contato(reto, 0.3))
    cena.sombras.push({ forma: ponta, z: g * ALTO_DA_PONTA, solta: true, forca: 0.24 })
    L.push(P(reto, madeira, { eixo: R.veio(0), tabua: 0, bisel: 1.2, contorno: 0.3, tom: 0.94, semente: semente + lado }))
    L.push(P(ponta, madeira, { eixo: R.veio(0), tabua: 0, bisel: 1.3, contorno: 0.3, tom: 1.04, semente: semente + 2 + lado }))
    L.push(P(R.oval(uPonta + 1.6, v, 1.9, PATIM * 0.62), madeira, { eixo: R.veio(QUARTO), tabua: 0, bisel: 1, contorno: 0.32, tom: 1.1, semente: semente + 4 + lado }))
    L.push(P(R.oval(uPonta + 1.6, v, 0.75, PATIM * 0.24), BURACO, { bisel: 0, contorno: 0, alfa: 0.7, semente: semente + 6 + lado }))
    if (comSapata) {
      const fora = v + lado * (PATIM / 2 - SAPATA / 2)
      L.push(P(R.ret(uFrente + 1, fora - SAPATA / 2, uTras - 0.4, fora + SAPATA / 2, 0.5), ferro, { bisel: 0.5, contorno: 0.2, metal: 0.35, semente: semente + 8 + lado }))
    }
  }
}

/**
 * O estrado: as tábuas de través de `u0` a `u1` fora dos trechos `cobertos` pela carga, com o vão escuro entre duas e
 * o prego nas pontas de cada uma. Cada trecho livre é um tampo solto à parte na 3/4: o tampo inteiro, pintado depois
 * da carga (a base dele é a mais ao sul), cobriria o fardo e a caixa; em trechos, a carga fica entre eles e aparece.
 */
function estrado(P: CriarPeca, cena: Cena, me: Medidas, madeira: MaterialDaPeca, ferro: MaterialDaPeca, u0: number, u1: number, meia: number, semente: number, cobertos: readonly (readonly [number, number])[]): void {
  const { R, g } = me
  const L = cena.partes
  const livres: [number, number][] = []
  let de = u0
  for (const [a, b] of [...cobertos].sort((x, y) => x[0] - y[0])) {
    if (a > de) livres.push([de, a])
    de = Math.max(de, b)
  }
  if (u1 > de) livres.push([de, u1])
  livres.forEach(([t0, t1], t) => {
    cena.sombras.push({ forma: R.ret(t0, -meia, t1, meia, 1), z: g * ALTO_DO_ESTRADO, solta: true })
    const n = Math.max(1, Math.round((t1 - t0) / TABUA))
    const passo = (t1 - t0) / n
    for (let k = 0; k < n; k += 1) {
      const a = t0 + k * passo + VAO / 2
      const b = t0 + (k + 1) * passo - VAO / 2
      const s = semente + t * 20 + k
      if (k > 0) L.push(P(R.ret(a - VAO - 0.3, -meia + 0.8, a + 0.3, meia - 0.8), BURACO, { bisel: 0, contorno: 0, alfa: 0.6, semente: s + 400 }))
      const torto = (hash(k, 1 + t, semente) - 0.5) * 0.8
      L.push(P(R.ret(a, -meia + torto, b, meia + torto * 0.5, 0.8), madeira, { eixo: R.veio(QUARTO), tabua: 0, bisel: 1, contorno: 0.28, tom: 0.98 + 0.1 * (hash(k, 2 + t, semente) - 0.5), semente: s }))
      for (const lado of [-1, 1]) L.push(P(R.oval((a + b) / 2, lado * (meia - 2.4), 0.55, 0.55), ferro, { bisel: 0.5, contorno: 0, metal: 0.25, semente: s + 200 }))
    }
  })
}

/** A corda: o fio torcido de `pontos`, no chão (z 0) ou no ar, com a sombra dela. */
function corda(P: CriarPeca, cena: Cena, R: Referencial, pontos: readonly Ponto[], raio: number, z: number, semente: number): void {
  const forma = R.fio(pontos, raio)
  if (z > 0) cena.sombras.push({ forma, z, solta: true, forca: 0.22 })
  else cena.sombras.push(contato(forma, 0.18))
  cena.partes.push(P(forma, CORDA, { bisel: raio * 0.8, contorno: 0.26, semente }))
}

/** O DE CARGA: os patins compridos, o estrado com as longarinas, o fardo de lona, o saco, o rolo e a caixa. */
export const montarTreno: MontarMovel = (c, cena) => {
  const me = medidasDo(c)
  const { R, mc, mf, g } = me
  const P = c.peca
  const L = cena.partes
  const madeira = c.m.madeira
  const ferro = c.m.patins
  const lona = c.m.carga
  cena.corDoPiso = ESCURO_DA_MADEIRA
  const meia = mf * ESTRADO
  const bitola = meia + PATIM_FORA
  const uTras = mc - 2
  const uPonta = -mc + 2 * mc * 0.06
  const uFrente = uPonta + 2 * mc * CURVA

  // A corda de puxar, da barra até o chão na frente, com o nó na ponta.
  const fim: Ponto = [-mc + 1.8, -bitola * 0.66]
  corda(P, cena, R, curvaDe([uPonta + 4, 0], [-mc + 2.6, 1.5], fim), 0.75, 0, 7101)
  L.push(P(R.oval(fim[0], fim[1], 1.2, 1.2), CORDA, { bisel: 0.9, contorno: 0.26, semente: 7102 }))

  // Os patins acabam antes da ponta de trás do estrado: na 3/4 a base deles fica ao norte da do estrado e da longarina,
  // que são pintados depois e ficam por cima.
  patins(P, cena, me, madeira, ferro, uFrente, uTras - 1.2, uPonta, bitola, 7110, true)
  const barra = R.ret(uPonta + 3, -bitola, uPonta + 5, bitola, 0.9)
  cena.sombras.push({ forma: barra, z: g * ALTO_DA_PONTA * 0.75, solta: true, forca: 0.26 })
  L.push(P(barra, ferro, { bisel: 0.9, contorno: 0.26, metal: 0.4, semente: 7109 }))

  // A carga, de frente para trás: o fardo, o saco com o rolo ao lado e a caixa, de longarina a longarina.
  const fardo = { u0: uFrente + 4, u1: uFrente + 4 + (uTras - uFrente) * 0.46, meiaV: meia - 1.6 }
  const uCaixa = uTras - 2 * mc * 0.2
  const caixaDaCarga = { u0: uCaixa, u1: uTras, meiaV: meia - 1.6 }
  estrado(P, cena, me, madeira, ferro, uFrente - 1, uTras, meia, 7300, [[fardo.u0, fardo.u1], [caixaDaCarga.u0, caixaDaCarga.u1]])
  for (const lado of [-1, 1]) {
    const longarina = R.ret(uFrente - 1, lado * meia - 1.6, uTras, lado * meia + 1.6, 1)
    cena.sombras.push({ forma: longarina, z: g * ALTO_DA_LONGARINA, solta: true, forca: 0.26 })
    L.push(P(longarina, madeira, { eixo: R.veio(0), tabua: 0, bisel: 1, contorno: 0.3, tom: 1.05, semente: 7140 + lado }))
  }

  const formaDoFardo = R.ret(fardo.u0, -fardo.meiaV, fardo.u1, fardo.meiaV, 3.2)
  const zFardo = g * ALTO_DO_FARDO
  cena.sombras.push({ forma: formaDoFardo, z: zFardo })
  L.push(P(formaDoFardo, lona, { bisel: 3.4, contorno: 0.28, ruga: 0.8, tom: 1, semente: 7150, projeta: { dist: 1.4, forca: 0.2 } }))
  // A dobra da lona, ao comprido, do lado da sombra.
  L.push(P(R.fio([[fardo.u0 + 3, fardo.meiaV * 0.38], [fardo.u1 - 3, fardo.meiaV * 0.3]], 0.4), lona, { bisel: 0, contorno: 0, tom: 0.8, suave: 0.5, semente: 7152 }))
  const longo = fardo.u1 - fardo.u0
  for (const t of [0.24, 0.74]) {
    const u = fardo.u0 + longo * t
    corda(P, cena, R, [[u, -fardo.meiaV - 0.4], [u - 0.7, 0], [u, fardo.meiaV + 0.4]], 0.7, zFardo + 0.5, 7160 + Math.round(t * 10))
  }
  corda(P, cena, R, [[fardo.u0 - 0.4, -1.2], [fardo.u0 + longo * 0.5, -0.6], [fardo.u1 + 0.4, -1]], 0.65, zFardo + 0.6, 7169)

  // O saco de boca amarrada, deitado com a boca para trás, e o rolo de corda do outro lado. Os dois vão no tampo do
  // estrado (sem estrutura própria): com base ao norte da do trecho livre, uma coluna deles sairia por baixo do tampo.
  const uSaco = (fardo.u1 + uCaixa) / 2
  const vSaco = -meia * 0.38
  const raioDoSaco = Math.min(7, (uCaixa - fardo.u1) * 0.36)
  L.push(P(R.oval(uSaco - 1, vSaco, raioDoSaco, meia * 0.27), lona, { bisel: 3.2, contorno: 0.28, ruga: 0.6, tom: 0.9, semente: 7175, projeta: { dist: 1.6, forca: 0.24 } }))
  L.push(P(R.oval(uSaco + raioDoSaco - 0.4, vSaco, 1.6, 2.3), lona, { bisel: 1, contorno: 0.28, ruga: 0.6, tom: 0.82, semente: 7176 }))
  cena.partes.push(P(R.fio([[uSaco + raioDoSaco - 2.6, vSaco - 2.6], [uSaco + raioDoSaco - 2.2, vSaco + 2.6]], 0.5), CORDA, { bisel: 0.4, contorno: 0.26, semente: 7177 }))
  const rolo: Ponto = [uSaco, meia * 0.42]
  L.push(P(R.oval(rolo[0], rolo[1], 3.6, 3.6), CORDA, { bisel: 2.4, contorno: 0.26, semente: 7171, projeta: { dist: 1, forca: 0.2 } }))
  L.push(P(R.oval(rolo[0], rolo[1], 1.4, 1.4), BURACO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 7172 }))

  const formaDaCaixa = R.ret(caixaDaCarga.u0, -caixaDaCarga.meiaV, caixaDaCarga.u1, caixaDaCarga.meiaV, 1)
  cena.sombras.push({ forma: formaDaCaixa, z: g * ALTO_DA_CAIXA })
  L.push(P(formaDaCaixa, madeira, { eixo: R.veio(QUARTO), tabua: 5.5, bisel: 1.3, contorno: 0.3, tom: 0.92, semente: 7170 }))
}

/**
 * O PEQUENO: o trenó leve e estreito, encostado atrás na pegada, de três ripas ao comprido, com a barra de guiar na
 * frente, as pontas dos patins enroladas, a corda frouxa entre elas e a manta dobrada atrás.
 */
export const montarTrenoPequeno: MontarMovel = (c, cena) => {
  const me = medidasDo(c)
  const { R, mc, mf, g } = me
  const P = c.peca
  const L = cena.partes
  const madeira = c.m.madeira
  const ferro = c.m.patins
  const manta = c.m.carga
  cena.corDoPiso = ESCURO_DA_MADEIRA
  const bitola = mf * 0.42
  const meia = mf * 0.56
  const uTras = mc - 3
  const comprimento = 2 * mc * 0.78
  const uPonta = uTras + 2.5 - comprimento
  const uFrente = uPonta + comprimento * 0.16
  const u0 = uFrente + 1.5
  const u1 = uTras + 0.4
  const zEstrado = g * 0.15

  // A corda de puxar, frouxa, de uma ponta enrolada à outra.
  corda(P, cena, R, curvaDe([uPonta + 1.2, -bitola], [uPonta - 13, bitola * 0.3], [uPonta + 1.2, bitola], 16), 0.7, 0, 7201)
  patins(P, cena, me, madeira, ferro, uFrente, u1 - 1.4, uPonta, bitola, 7210, false)

  // As três ripas ao comprido, com o vão escuro entre elas e os pregos nas pontas.
  cena.sombras.push({ forma: R.ret(u0, -meia, u1, meia, 1.5), z: zEstrado, solta: true })
  const ripas = 3
  const passo = (2 * meia) / ripas
  for (let k = 0; k < ripas; k += 1) {
    const v0 = -meia + k * passo + VAO * 0.7
    const v1 = -meia + (k + 1) * passo - VAO * 0.7
    if (k > 0) L.push(P(R.ret(u0 + 1, v0 - VAO * 1.4 - 0.3, u1 - 1, v0 + 0.3), BURACO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 7290 + k }))
    const torto = (hash(k, 1, 7220) - 0.5) * 1.2
    L.push(P(R.ret(u0 + torto, v0, u1 + torto * 0.6, v1, 1.6), madeira, { eixo: R.veio(0), tabua: 0, bisel: 1.1, contorno: 0.28, tom: 1 + 0.1 * (hash(k, 2, 7220) - 0.5), semente: 7220 + k }))
    for (const u of [u0 + 4, u1 - 4]) L.push(P(R.oval(u, (v0 + v1) / 2, 0.55, 0.55), ferro, { bisel: 0.5, contorno: 0, metal: 0.25, semente: 7250 + k }))
  }

  // A barra de guiar, de través na frente, por cima dos patins.
  const guiar = R.ret(u0 - 3.6, -meia - 2.4, u0 - 0.8, meia + 2.4, 1.2)
  cena.sombras.push({ forma: guiar, z: zEstrado + g * 0.03, solta: true, forca: 0.26 })
  L.push(P(guiar, madeira, { eixo: R.veio(QUARTO), tabua: 0, bisel: 1.1, contorno: 0.3, tom: 1.06, semente: 7230 }))

  // A manta dobrada, um nada torta, atrás, no tampo das ripas (sem estrutura própria, como o saco do de carga).
  const uManta = uTras - 9.5
  const dobrada = R.ret(uManta - 6, -meia * 0.72, uManta + 6, meia * 0.6, 2.2)
  L.push(P(dobrada, manta, { eixo: R.veio(0.05), bisel: 2.2, contorno: 0.28, ruga: 0.5, semente: 7240, projeta: { dist: 1.1, forca: 0.22 } }))
  L.push(P(R.ret(uManta - 6, -meia * 0.72, uManta - 3.2, meia * 0.6, 1.6), manta, { bisel: 1.2, contorno: 0.26, tom: 0.9, ruga: 0.5, semente: 7241 }))
}
