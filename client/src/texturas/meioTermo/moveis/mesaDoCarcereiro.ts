/**
 * MESA DO CARCEREIRO de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a
 * versão rústica da escrivaninha): a mesa de tábuas grossas onde o carcereiro anota quem entra e quem sai. O TAMPO
 * de tábuas ao comprido, preso por duas CINTAS de ferro rebitadas perto das pontas; em cima, o LIVRO DE REGISTRO
 * aberto, de capa de couro, com as folhas de pergaminho riscadas pela escrita e a fita marcadora caindo para fora;
 * o TINTEIRO de barro escuro com a pena espetada e um pingo de tinta na madeira; à direita, o MOLHO DE CHAVES
 * grandes num aro de ferro, uma delas de latão.
 *
 * O que diz "mesa do carcereiro" a 25% de zoom é o retângulo de madeira escura com as duas faixas de ferro e o
 * livro claro aberto no meio; de perto, as chaves e o tinteiro.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o tampo é um tampo solto na altura da mesa e as quatro pernas, colunas; o
 * livro, o tinteiro, a pena e as chaves têm o meio dentro do tampo e sobem com ele.
 *
 * Esticada, as tábuas e as cintas acompanham a pegada; o livro, o tinteiro e as chaves têm o tamanho do menor lado
 * (não esticam). Materiais: `madeira` (o tampo e as pernas) e `ferragens` (as cintas, os rebites e as chaves). O
 * couro, o pergaminho, a tinta, o barro, a pena e a chave de latão são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, capsula, caixa, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas ----------

/** A altura do tampo (px do protótipo). */
const ALTURA_DA_MESA = 0.5 * G
/** A largura de cada tábua do tampo (px). */
const TABUA = 8.6
/** A perna quadrada (meio lado, px) e o quanto ela entra da beira do tampo. */
const MEIA_PERNA = 2
const RECUO_DA_PERNA = 3.4
/** As cintas de ferro: a distância da ponta do tampo e a meia largura (px). */
const RECUO_DA_CINTA = 7.2
const MEIA_CINTA = 2.2
/** O menor lado da pegada de partida (0,8 casa): o livro, o tinteiro e as chaves são medidos nele. */
const LADO_DE_PARTIDA = 0.8 * G
/** O livro aberto: o meio (frações da meia pegada), o giro, a meia capa e a meia folha (px no tamanho de partida). */
const MEIO_DO_LIVRO: Ponto = [-0.16, 0.06]
const GIRO_DO_LIVRO = -0.07
const MEIA_CAPA: Ponto = [17.6, 12.2]
const MEIA_FOLHA: Ponto = [16.4, 10.9]
/** As linhas da escrita: o passo, a primeira, quantas e a margem (px no tamanho de partida). */
const PASSO_DA_LINHA = 2.45
const PRIMEIRA_LINHA = -8.4
const LINHAS = 7
const MARGEM = 2.4
/** O tinteiro (meio em frações da meia pegada, raio em px) e a pena. */
const TINTEIRO: Ponto = [0.42, -0.38]
const RAIO_DO_TINTEIRO = 4.2
const GIRO_DA_PENA = -0.72
const COMPRIMENTO_DA_PENA = 8.4
/** O molho de chaves: o meio do aro (frações), o raio dele (px) e cada chave (ângulo, comprimento em px). */
const ARO: Ponto = [0.69, 0.22]
const RAIO_DO_ARO = 3.9
const CHAVES: readonly (readonly [number, number])[] = [
  [2.05, 12.6],
  [2.75, 10.8],
  [1.25, 10.2],
]

// ---------- os materiais fixos ----------

const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x3b, 0x2c] }
const PERGAMINHO: MaterialDaPeca = { classe: 'liso', rgb: [0xcb, 0xbd, 0x9b] }
/** A tinta de galha: marrom quase preto, nunca o preto do papel. */
const TINTA: Rgb = [0x3c, 0x33, 0x2d]
const PINGO_DE_TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x2c] }
const FITA: MaterialDaPeca = { classe: 'liso', rgb: [0x6d, 0x33, 0x37] }
const BARRO_ESCURO: MaterialDaPeca = { classe: 'pedra', rgb: [0x55, 0x4d, 0x47], pedra: 'ardosia' }
const BOCA_DO_TINTEIRO: MaterialDaPeca = { classe: 'liso', rgb: [0x2b, 0x29, 0x2b] }
const PENA: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xc1, 0xb2] }
const CANHAO_DA_PENA: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x84, 0x72] }
const LATAO = materialDaPeca('latao')
/** A sombra da lombada, onde as folhas descem para a costura. */
const LOMBADA: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x5a, 0x48] }

/** Retângulo girado `a` em volta do meio (cx, cy), de meios lados (mx, my). */
function caixaGirada(cx: number, cy: number, mx: number, my: number, a: number): Forma {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const p = (x: number, y: number): Ponto => [cx + x * c - y * s, cy + x * s + y * c]
  return poligono([p(-mx, -my), p(mx, -my), p(mx, my), p(-mx, my)])
}

/**
 * A folha do livro: a escrita em linhas curtas e partidas (palavras), a dobra que escurece perto da lombada e a
 * beira de fora um pouco mais clara. `lado` = -1 a folha da esquerda, 1 a da direita.
 */
function texFolha(cx: number, cy: number, a: number, lado: number, k: number): Textura {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return (_u, _v, x, y, p, sx) => {
    const dx = x - cx
    const dy = y - cy
    const lx = (dx * c + dy * s) * lado
    const ly = -dx * s + dy * c
    let luz = ruido(x * 0.45 + p.su, y * 0.45 + p.sv) * 0.05
    if (lx < 4.2 * k) luz -= 0.2 * (1 - Math.max(0, lx) / (4.2 * k))
    else if (lx > 14.5 * k) luz += 0.04
    const linha = (ly - PRIMEIRA_LINHA * k) / (PASSO_DA_LINHA * k)
    const i = Math.floor(linha)
    const f = linha - i
    if (i >= 0 && i < LINHAS && f > 0.36 && f < 0.74) {
      const fim = MARGEM * k + (9.2 + hash(i, lado + 2, 9113) * 3.6) * k
      if (lx > MARGEM * k + 1.2 * k && lx < fim && ruido(lx * 0.85 + i * 13.1 + lado * 7, i * 3.3) > -0.2) {
        const t = 0.62
        sx[0] += (TINTA[0] - sx[0]) * t
        sx[1] += (TINTA[1] - sx[1]) * t
        sx[2] += (TINTA[2] - sx[2]) * t
      }
    }
    sx[3] += luz
  }
}

/** Uma chave grande: o anel (no aro), a haste e o palhetão com dois dentes, no rumo `a` a partir de (ox, oy). */
function chave(ox: number, oy: number, a: number, comp: number, k: number): { anel: Forma; haste: Forma; palhetao: Forma } {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const p = (t: number, n: number): Ponto => [ox + c * t - s * n, oy + s * t + c * n]
  const [ax, ay] = p(2.3 * k, 0)
  const [hx0, hy0] = p(4.2 * k, 0)
  const [hx1, hy1] = p(comp * k, 0)
  const palhetao = poligono([p((comp - 3.4) * k, 0.4 * k), p(comp * k, 0.4 * k), p(comp * k, 3.4 * k), p((comp - 1.1) * k, 3.4 * k), p((comp - 1.1) * k, 2.3 * k), p((comp - 2.2) * k, 2.3 * k), p((comp - 2.2) * k, 3.4 * k), p((comp - 3.4) * k, 3.4 * k)])
  return { anel: anel(ax, ay, 2.3 * k, 2.3 * k, 1.2 * k, 1.2 * k), haste: capsula(hx0, hy0, hx1, hy1, 0.85 * k), palhetao }
}

export const montarMesaDoCarcereiro: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const ferro = c.m.ferragens
  const L = cena.partes
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const tx = hw - 0.8
  const ty = hh - 1.4
  const tampo = caixa(-tx, -ty, tx, ty, 1.4)

  // ---------- as sombras: o tampo no alto e as quatro pernas ----------
  cena.sombras.push({ forma: tampo, z: ALTURA_DA_MESA, solta: true, forca: 0.3 })
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = sx * (tx - RECUO_DA_PERNA)
      const py = sy * (ty - RECUO_DA_PERNA)
      const perna = caixa(px - MEIA_PERNA, py - MEIA_PERNA, px + MEIA_PERNA, py + MEIA_PERNA, 0.5)
      cena.sombras.push({ forma: perna, z: ALTURA_DA_MESA, forca: 0.3 }, contato(perna, 0.34))
    }
  }

  // ---------- o tampo: tábuas grossas ao comprido, com dois nós ----------
  L.push(P(tampo, mad, { tabua: TABUA, bisel: 1.6, contorno: 0.32, tom: 0.9, semente: 9101 }))
  for (const [nx, ny, r] of [[-0.62, -0.48, 1.7], [0.18, 0.62, 1.3]] as const) {
    L.push(P(elipseGirada(nx * hw, ny * hh, r * 1.6, r, 0.1), mad, { tabua: 0, bisel: 0.5, contorno: 0.12, tom: 0.62, alfa: 0.75, suave: 0.6, semente: 9105 }))
  }

  // ---------- as cintas de ferro, dobradas pela beira, com os rebites ----------
  for (const lado of [-1, 1]) {
    const x = lado * (tx - RECUO_DA_CINTA)
    L.push(P(caixa(x - MEIA_CINTA, -ty - 0.5, x + MEIA_CINTA, ty + 0.5, 0.5), ferro, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.84, contorno: 0.32, semente: 9110 + lado, projeta: { dist: 0.9, forca: 0.45, suave: 0.6 } }))
    for (const f of [-0.7, 0, 0.7]) {
      L.push(P(elipse(x, f * ty, 0.95, 0.95), ferro, { bisel: 0.7, contorno: 0.3, tom: 1.18, metal: 0.55, semente: 9113, projeta: { dist: 0.6, forca: 0.4 } }))
    }
  }

  // ---------- o livro de registro aberto ----------
  const lx = MEIO_DO_LIVRO[0] * hw
  const ly = MEIO_DO_LIVRO[1] * hh
  const a = GIRO_DO_LIVRO
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  L.push(P(caixaGirada(lx, ly, MEIA_CAPA[0] * k, MEIA_CAPA[1] * k, a), COURO, { tabua: 0, bisel: 0.9, contorno: 0.34, tom: 1, semente: 9120, projeta: { dist: 1.1, forca: 0.5, suave: 0.8 } }))
  // A fita marcadora sai da lombada por baixo do livro.
  const [fx0, fy0] = [lx - sa * MEIA_CAPA[1] * k * 0.8, ly + ca * MEIA_CAPA[1] * k * 0.8]
  L.push(P(capsula(fx0, fy0, fx0 + 1.2 * k, fy0 + 6.2 * k, 0.8 * k), FITA, { bisel: 0.4, contorno: 0.24, tom: 1, semente: 9121 }))
  for (const lado of [-1, 1]) {
    const mx = (MEIA_FOLHA[0] * k) / 2 + 0.3 * k
    const cx = lx + ca * lado * mx
    const cy = ly + sa * lado * mx
    const folha = caixaGirada(cx, cy, (MEIA_FOLHA[0] * k) / 2, MEIA_FOLHA[1] * k, a)
    L.push(P(folha, PERGAMINHO, { textura: texFolha(lx, ly, a, lado, k), bisel: 0.7, contorno: 0.2, tom: lado < 0 ? 0.97 : 1.02, semente: 9122 + lado }))
  }
  L.push(P(caixaGirada(lx, ly, 0.55 * k, MEIA_FOLHA[1] * k, a), LOMBADA, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.7, semente: 9124 }))

  // ---------- o tinteiro, o pingo de tinta e a pena ----------
  const ix = TINTEIRO[0] * hw
  const iy = TINTEIRO[1] * hh
  const ri = RAIO_DO_TINTEIRO * k
  L.push(P(elipseGirada(ix - 4.6 * k, iy + 4.4 * k, 1.9 * k, 1.2 * k, 0.5), PINGO_DE_TINTA, { bisel: 0.5, contorno: 0.1, alfa: 0.78, suave: 0.3, semente: 9130 }))
  L.push(P(elipse(ix - 6.4 * k, iy + 5.6 * k, 0.6 * k, 0.6 * k), PINGO_DE_TINTA, { bisel: 0.3, contorno: 0, alfa: 0.7, semente: 9131 }))
  L.push(P(elipse(ix, iy, ri, ri), BARRO_ESCURO, { tabua: 0, bisel: 1.6, contorno: 0.34, tom: 1, semente: 9132, projeta: { dist: 1.5, forca: 0.5, suave: 0.8 } }))
  L.push(P(elipse(ix - 0.2 * k, iy - 0.2 * k, ri * 0.48, ri * 0.48), BOCA_DO_TINTEIRO, { bisel: 0.4, contorno: 0.3, recesso: { k: 1.6, forca: 0.5 }, semente: 9133 }))
  const cp = Math.cos(GIRO_DA_PENA)
  const sp = Math.sin(GIRO_DA_PENA)
  const comp = COMPRIMENTO_DA_PENA * k
  L.push(P(capsula(ix, iy, ix + cp * comp * 0.5, iy + sp * comp * 0.5, 0.45 * k), CANHAO_DA_PENA, { bisel: 0.3, contorno: 0.3, semente: 9134 }))
  L.push(P(elipseGirada(ix + cp * comp * 1.05, iy + sp * comp * 1.05, comp * 0.68, 1.55 * k, GIRO_DA_PENA), PENA, { eixo: GIRO_DA_PENA, tabua: 0, bisel: 0.9, contorno: 0.26, tom: 1, ruga: 0.4, semente: 9135, projeta: { dist: 2.6, forca: 0.42, suave: 1 } }))

  // ---------- o molho de chaves ----------
  const ax = ARO[0] * hw
  const ay = ARO[1] * hh
  CHAVES.forEach(([ang, compr], i) => {
    const ra = RAIO_DO_ARO * k
    const ch = chave(ax + Math.cos(ang) * ra, ay + Math.sin(ang) * ra, ang, compr, k)
    const mat = i === 1 ? LATAO : ferro
    const tom = 0.96 + hash(i, 4, 9140) * 0.1
    for (const f of [ch.haste, ch.palhetao, ch.anel]) {
      L.push(P(f, mat, { tabua: 0, bisel: 0.7, contorno: 0.34, tom, metal: 0.5, semente: 9141 + i, projeta: { dist: 0.9, forca: 0.45, suave: 0.6 } }))
    }
  })
  L.push(P(anel(ax, ay, RAIO_DO_ARO * k, RAIO_DO_ARO * k, (RAIO_DO_ARO - 0.95) * k, (RAIO_DO_ARO - 0.95) * k), ferro, { tabua: 0, bisel: 0.6, contorno: 0.34, tom: 1.04, metal: 0.55, semente: 9150, projeta: { dist: 0.9, forca: 0.45, suave: 0.6 } }))
}
