/**
 * MESA DO CARCEREIRO de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a
 * versão rústica da escrivaninha): a mesa de tábuas grossas onde o carcereiro anota quem entra e quem sai. O TAMPO
 * de tábuas ao comprido, preso por duas CINTAS de ferro rebitadas perto das pontas; em cima, o LIVRO DE REGISTRO
 * aberto, de capa de couro, riscado em TABELA (a coluna da data separada da do nome por um risco vinho apagado; na
 * folha da direita, os grupos de RISCOS DE CONTAGEM, quatro traços e um cortando) e a fita marcadora caindo para
 * fora; o TINTEIRO de barro escuro com um borrão de tinta na madeira; à direita, o TOCO DE VELA de sebo, apagado,
 * num pires de lata com a alça de dedo, e o MOLHO DE CHAVES grandes num aro de ferro, uma delas de latão.
 *
 * O que diz "mesa do carcereiro" a 25% de zoom é o retângulo de madeira escura com as duas faixas de ferro e o
 * livro claro aberto no meio; de perto, a tabela do registro, as chaves e a vela.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o tampo é um tampo solto na altura da mesa e as quatro pernas, colunas; o
 * livro, o tinteiro, a vela e as chaves têm o meio dentro do tampo e sobem com ele.
 *
 * Esticada, as tábuas e as cintas acompanham a pegada; o livro, o tinteiro, a vela e as chaves têm o tamanho do
 * menor lado (não esticam). Materiais: `madeira` (o tampo e as pernas) e `ferragens` (as cintas, os rebites e as
 * chaves). O couro, o pergaminho, a tinta, o barro, o sebo, a lata e a chave de latão são fixos.
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
/** As cintas de ferro: a distância da ponta do tampo, a meia largura (px) e o tom (abaixo do livro, para não brigar). */
const RECUO_DA_CINTA = 7.2
const MEIA_CINTA = 2.2
const TOM_DA_CINTA = 0.72
/** Os dois nós do tampo: discretos (com raio maior e escuros, liam como buraco). */
const NOS: readonly (readonly [number, number, number])[] = [
  [-0.62, -0.48, 1.05],
  [0.18, 0.62, 0.85],
]
/** O menor lado da pegada de partida (0,8 casa): o livro, o tinteiro, a vela e as chaves são medidos nele. */
const LADO_DE_PARTIDA = 0.8 * G
/** O livro aberto: o meio (frações da meia pegada), o giro, a meia capa e a meia folha (px no tamanho de partida). */
const MEIO_DO_LIVRO: Ponto = [-0.16, 0.06]
const GIRO_DO_LIVRO = -0.07
const MEIA_CAPA: Ponto = [17.6, 12.2]
const MEIA_FOLHA: Ponto = [16.4, 10.9]
/** A tabela do registro: a primeira linha, o passo, quantas linhas e a margem (px no tamanho de partida). */
const PRIMEIRA_LINHA = -8.4
const PASSO_DA_LINHA = 2.45
const LINHAS = 7
const MARGEM = 1.2
/** O risco que separa a data do nome: a ~30% da folha, a partir da beira da esquerda. */
const FRACAO_DA_COLUNA = 0.3
/** Os riscos de contagem: o espaço entre os traços e entre os grupos (px no tamanho de partida). */
const ESPACO_DO_TRACO = 0.72
const ESPACO_DO_GRUPO = 1.5
/** O tinteiro (meio em frações da meia pegada, raio em px). */
const TINTEIRO: Ponto = [0.42, -0.38]
const RAIO_DO_TINTEIRO = 4.2
/** A vela no pires: o meio (frações), o raio do pires e o do toco (px no tamanho de partida). */
const VELA: Ponto = [0.66, -0.42]
const RAIO_DO_PIRES = 3.2
const RAIO_DO_TOCO = 1.85
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
/** O risco da coluna: vinho apagado. */
const VINHO_APAGADO: Rgb = [0x6d, 0x33, 0x37]
const BORRAO_DE_TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x2c] }
const FITA: MaterialDaPeca = { classe: 'liso', rgb: [0x6d, 0x33, 0x37] }
const BARRO_ESCURO: MaterialDaPeca = { classe: 'pedra', rgb: [0x55, 0x4d, 0x47], pedra: 'ardosia' }
const BOCA_DO_TINTEIRO: MaterialDaPeca = { classe: 'liso', rgb: [0x2b, 0x29, 0x2b] }
const LATA: MaterialDaPeca = { classe: 'metal', rgb: [0x8c, 0x8a, 0x84] }
const SEBO: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xc3, 0xa6] }
const PAVIO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x28, 0x24] }
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

/** Distância do ponto (px, py) ao segmento de (ax, ay) a (bx, by). */
function distanciaAoTraco(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)))
  return Math.hypot(px - ax - vx * t, py - ay - vy * t)
}

/** Quanto do pixel um traço de meia largura `m` cobre a `d` do eixo dele (`e` = pixels por px do protótipo). */
function cobertura(d: number, m: number, e: number): number {
  const visivel = Math.max(m, 0.5 / e)
  return Math.max(0, Math.min(1, (visivel - d) * e + 0.5)) * (m / visivel)
}

/** Puxa a cor do pixel para `cor` na fração `t`. */
function tingir(s: Float32Array, cor: Rgb, t: number): void {
  if (t <= 0) return
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** Um grupo de contagem (quatro traços de pé e um cortando) com o canto de cima à esquerda em (u0, v0). */
function grupoDeContagem(u: number, v: number, u0: number, v0: number, alto: number, k: number): number {
  const passo = ESPACO_DO_TRACO * k
  let d = Infinity
  for (let j = 0; j < 4; j += 1) {
    const x = u0 + j * passo
    d = Math.min(d, distanciaAoTraco(u, v, x + 0.12 * k, v0, x - 0.1 * k, v0 + alto))
  }
  return Math.min(d, distanciaAoTraco(u, v, u0 - 0.45 * k, v0 + alto * 0.82, u0 + 3 * passo + 0.5 * k, v0 + alto * 0.16))
}

/**
 * A folha do livro de registro: as linhas da tabela, a coluna da data separada da do nome pelo risco vinho, as
 * anotações curtas (palavras partidas) e, na folha da direita, os riscos de contagem; a dobra escurece perto da
 * lombada. `lado` = -1 a folha da esquerda, 1 a da direita.
 */
function texFolha(cx: number, cy: number, a: number, lado: number, k: number): Textura {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const largura = MEIA_FOLHA[0] * k
  const coluna = FRACAO_DA_COLUNA * largura
  const topo = PRIMEIRA_LINHA * k
  const passo = PASSO_DA_LINHA * k
  const fundo = topo + LINHAS * passo
  return (_u, _v, x, y, p, sx, escala) => {
    const dx = x - cx
    const dy = y - cy
    const lx = (dx * c + dy * s) * lado
    const ly = -dx * s + dy * c
    // u: da beira da esquerda da folha para a da direita, nas duas folhas.
    const u = lado > 0 ? lx - 0.3 * k : largura + 0.3 * k - lx
    let luz = ruido(x * 0.45 + p.su, y * 0.45 + p.sv) * 0.05
    if (lx < 4.2 * k) luz -= 0.2 * (1 - Math.max(0, lx) / (4.2 * k))
    else if (lx > 14.5 * k) luz += 0.04
    sx[3] += luz
    if (u < MARGEM * 0.5 * k || u > largura - MARGEM * 0.5 * k) return
    // As linhas da tabela: um fio de tinta bem apagado no pé de cada linha.
    if (ly >= topo - 0.3 * k && ly <= fundo + 0.3 * k) {
      const resto = (ly - topo) / passo
      const fio = Math.abs(resto - Math.round(resto)) * passo
      tingir(sx, TINTA, cobertura(fio, 0.09 * k, escala) * 0.2)
    }
    // A coluna: o risco vinho apagado que separa a data do nome.
    if (ly >= topo - 1.1 * k && ly <= fundo) tingir(sx, VINHO_APAGADO, cobertura(Math.abs(u - coluna), 0.15 * k, escala) * 0.5)
    const linha = (ly - topo) / passo
    const i = Math.floor(linha)
    if (i < 0 || i >= LINHAS) return
    const f = linha - i
    // Na folha da direita, as duas primeiras faixas de duas linhas guardam os riscos de contagem.
    if (lado > 0 && i < 4 && u > coluna + 0.6 * k) {
      const faixa = Math.floor(i / 2)
      const v0 = topo + faixa * 2 * passo + 0.55 * k
      const alto = 2 * passo - 1.1 * k
      const grupos = faixa === 0 ? 2 : 1
      let d = Infinity
      for (let gI = 0; gI < grupos; gI += 1) {
        const u0 = coluna + 1.3 * k + gI * (3 * ESPACO_DO_TRACO + ESPACO_DO_GRUPO) * k
        d = Math.min(d, grupoDeContagem(u, ly, u0, v0, alto, k))
      }
      tingir(sx, TINTA, cobertura(d, 0.16 * k, escala) * 0.72)
      return
    }
    // As anotações: a data curta antes do risco e o nome depois dele, em palavras partidas.
    if (lado > 0 && i >= 5) return
    if (f < 0.38 || f > 0.72) return
    const naData = u < coluna
    const de = naData ? MARGEM * k : coluna + 0.7 * k
    const cabe = (naData ? coluna - 0.6 * k : largura - MARGEM * k) - de
    const ate = de + cabe * (naData ? 0.62 + hash(i, lado + 2, 9116) * 0.32 : 0.42 + hash(i, lado + 2, 9113) * 0.5)
    if (u > de && u < ate && ruido(u * 0.85 + i * 13.1 + lado * 7, i * 3.3) > -0.2) tingir(sx, TINTA, 0.62)
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

  // ---------- o tampo: tábuas grossas ao comprido, com dois nós discretos ----------
  L.push(P(tampo, mad, { tabua: TABUA, bisel: 1.6, contorno: 0.32, tom: 0.9, semente: 9101 }))
  for (const [nx, ny, r] of NOS) {
    L.push(P(elipseGirada(nx * hw, ny * hh, r * 1.6, r, 0.1), mad, { tabua: 0, bisel: 0.4, contorno: 0.06, tom: 0.78, alfa: 0.5, suave: 0.5, semente: 9105 }))
  }

  // ---------- as cintas de ferro, dobradas pela beira, com os rebites ----------
  for (const lado of [-1, 1]) {
    const x = lado * (tx - RECUO_DA_CINTA)
    L.push(P(caixa(x - MEIA_CINTA, -ty - 0.5, x + MEIA_CINTA, ty + 0.5, 0.5), ferro, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: TOM_DA_CINTA, contorno: 0.32, semente: 9110 + lado, projeta: { dist: 0.9, forca: 0.45, suave: 0.6 } }))
    for (const f of [-0.7, 0, 0.7]) {
      L.push(P(elipse(x, f * ty, 0.95, 0.95), ferro, { bisel: 0.7, contorno: 0.3, tom: 1.05, metal: 0.5, semente: 9113, projeta: { dist: 0.6, forca: 0.4 } }))
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

  // ---------- o tinteiro e o borrão de tinta ----------
  const ix = TINTEIRO[0] * hw
  const iy = TINTEIRO[1] * hh
  const ri = RAIO_DO_TINTEIRO * k
  // O borrão é comprido e ralo: o pingo redondo e escuro lia como furo na madeira.
  L.push(P(elipseGirada(ix - 5.4 * k, iy + 4.9 * k, 2.7 * k, 0.75 * k, 0.62), BORRAO_DE_TINTA, { bisel: 0, contorno: 0, alfa: 0.45, suave: 0.5, semente: 9130 }))
  L.push(P(elipse(ix, iy, ri, ri), BARRO_ESCURO, { tabua: 0, bisel: 1.6, contorno: 0.34, tom: 1, semente: 9132, projeta: { dist: 1.5, forca: 0.5, suave: 0.8 } }))
  L.push(P(elipse(ix - 0.2 * k, iy - 0.2 * k, ri * 0.48, ri * 0.48), BOCA_DO_TINTEIRO, { bisel: 0.4, contorno: 0.3, recesso: { k: 1.6, forca: 0.5 }, semente: 9133 }))

  // ---------- o toco de vela de sebo, apagado, no pires de lata ----------
  const vx = VELA[0] * hw
  const vy = VELA[1] * hh
  const rp = RAIO_DO_PIRES * k
  const rv = RAIO_DO_TOCO * k
  const alca = -2.05
  const [hx, hy] = [vx + Math.cos(alca) * (rp + 0.7 * k), vy + Math.sin(alca) * (rp + 0.7 * k)]
  L.push(P(anel(hx, hy, 1.25 * k, 1.25 * k, 0.6 * k, 0.6 * k), LATA, { tabua: 0, bisel: 0.4, contorno: 0.32, tom: 0.88, metal: 0.35, semente: 9136, projeta: { dist: 0.8, forca: 0.4 } }))
  L.push(P(elipse(vx, vy, rp, rp), LATA, { tabua: 0, bisel: 0.9, contorno: 0.34, tom: 0.96, metal: 0.35, semente: 9137, projeta: { dist: 1.1, forca: 0.45, suave: 0.8 } }))
  L.push(P(elipse(vx, vy, rp - 0.75 * k, rp - 0.75 * k), LATA, { tabua: 0, bisel: 0.5, contorno: 0.18, tom: 0.84, metal: 0.25, recesso: { k: 0.9, forca: 0.35 }, semente: 9138 }))
  // Os pingos de sebo escorridos no pires.
  for (const [ang, dist, rx, ry] of [[0.55, 1.05, 0.95, 0.6], [2.4, 1.1, 0.7, 0.5]] as const) {
    L.push(P(elipseGirada(vx + Math.cos(ang) * rv * dist, vy + Math.sin(ang) * rv * dist, rx * k, ry * k, ang), SEBO, { bisel: 0.3, contorno: 0.2, tom: 0.95, semente: 9139 }))
  }
  L.push(P(elipse(vx + 0.15 * k, vy - 0.1 * k, rv, rv), SEBO, { bisel: 0.9, contorno: 0.3, tom: 1, semente: 9140, projeta: { dist: 1, forca: 0.4, suave: 0.6 } }))
  L.push(P(elipse(vx + 0.1 * k, vy - 0.2 * k, rv * 0.6, rv * 0.6), SEBO, { bisel: 0.3, contorno: 0.1, tom: 0.9, recesso: { k: 0.7, forca: 0.3 }, semente: 9141 }))
  L.push(P(elipse(vx + 0.12 * k, vy - 0.18 * k, 0.3 * k, 0.3 * k), PAVIO, { bisel: 0.2, contorno: 0, semente: 9142 }))

  // ---------- o molho de chaves ----------
  const ax = ARO[0] * hw
  const ay = ARO[1] * hh
  CHAVES.forEach(([ang, compr], i) => {
    const ra = RAIO_DO_ARO * k
    const ch = chave(ax + Math.cos(ang) * ra, ay + Math.sin(ang) * ra, ang, compr, k)
    const mat = i === 1 ? LATAO : ferro
    const tom = 0.96 + hash(i, 4, 9140) * 0.1
    for (const f of [ch.haste, ch.palhetao, ch.anel]) {
      L.push(P(f, mat, { tabua: 0, bisel: 0.7, contorno: 0.34, tom, metal: 0.5, semente: 9143 + i, projeta: { dist: 0.9, forca: 0.45, suave: 0.6 } }))
    }
  })
  L.push(P(anel(ax, ay, RAIO_DO_ARO * k, RAIO_DO_ARO * k, (RAIO_DO_ARO - 0.95) * k, (RAIO_DO_ARO - 0.95) * k), ferro, { tabua: 0, bisel: 0.6, contorno: 0.34, tom: 1.04, metal: 0.55, semente: 9150, projeta: { dist: 0.9, forca: 0.45, suave: 0.6 } }))
}
