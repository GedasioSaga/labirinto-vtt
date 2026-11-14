/**
 * GLOBO TERRESTRE de cima com volume (lote L12 dos objetos novos, 14/11/2026, "Descanso e brincadeira"): o globo
 * de chão de biblioteca. A ESFERA pintada (o mar azul acinzentado e as terras cor de pergaminho, com a linha da
 * costa a tinta e a rede dos paralelos e meridianos, o equador mais forte) gira num eixo inclinado; o MERIDIANO de
 * metal passa por cima dela de ponta a ponta, com o botão do polo; em volta, na altura do equador, o anel do
 * HORIZONTE, de madeira, com a faixa de papel das graduações (os riscos de 10 em 10 graus e os de 30 mais
 * compridos). Embaixo, quatro PÉS curvos saem do anel em X, e a cruzeta os liga rente ao chão. As terras são de um
 * mundo inventado (o ruído na esfera), como um mapa de RPG.
 *
 * A 25% de zoom sobram o círculo azul com as manchas claras e o risco de metal atravessado, dentro do aro de madeira
 * com papel: é o que diz globo, e não mesa redonda ou poço (o aro largo e claro em volta de uma bola sombreada).
 *
 * Na 3/4 (`tresQuartos.ts`, derivado, beirada de `ESPESSURA_DO_GLOBO`): as PERNAS são colunas até o anel; o ANEL é
 * cortado em oito pedaços, cada um um tampo solto na altura do equador, para que a metade de trás saia ANTES da
 * esfera e a da frente DEPOIS (o anel abraça a bola: por trás ela o tapa, na frente ele passa diante dela). Cada
 * pedaço é a forma inteira do anel, pintada só no setor dele (sem emenda de chanfro). A ESFERA é um tampo solto um
 * pouco acima do anel, com o meridiano e o botão dela. Os pés e a cruzeta ficam no chão, sem estrutura. As sombras
 * do anel e da esfera no chão são as formas afastadas pela altura.
 *
 * Materiais: `madeira` (o pé e o anel) e `meridiano` (o meridiano e o botão). O mar, as terras e o papel são fixos.
 */
import { limitar01, misturar, type Rgb } from '../../ruido'
import { anel, capsula, caixa, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A beirada dos tampos soltos na 3/4 (px): o anel é fino. */
export const ESPESSURA_DO_GLOBO = 0.035 * G

/** O desenho foi medido em 0,8 casa (22,4 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_PEGADA = 0.4 * G
const GRAUS = Math.PI / 180

/** Frações do menor meio lado: o raio da esfera. Frações do raio da esfera: o anel (dentro e fora), as pernas e o alcance dos pés. */
const RAIO_DA_ESFERA = 0.66
const ANEL_DE_DENTRO = 1.1
const ANEL_DE_FORA = 1.42
const RAIO_DAS_PERNAS = 1.26
const ALCANCE_DOS_PES = 1.58
/** A altura do anel (casas) e quanto a esfera sobe acima dele na 3/4 (fração do raio dela). */
const ALTURA_DO_ANEL = 0.5
const ESFERA_ACIMA_DO_ANEL = 0.3

/** O eixo: a inclinação (graus) e o rumo do polo norte na planta (graus); o giro das terras em volta dele. */
const INCLINACAO_DO_EIXO = 23.5
const RUMO_DO_POLO = -112
const GIRO_DAS_TERRAS = 0.8

/** As cores do globo: o mar, a terra, a tinta da costa e da rede, e o equador. */
const MAR: Rgb = [0x6f, 0x8f, 0x99]
const TERRA: Rgb = [0xd1, 0xbf, 0x91]
const TINTA: Rgb = [0x5e, 0x4c, 0x3c]
const EQUADOR: Rgb = [0x8a, 0x52, 0x44]
const PAPEL: Rgb = [0xdb, 0xcd, 0xa8]
/** O nível do ruído acima do qual é terra, e a meia largura da costa (no mesmo ruído). */
const NIVEL_DA_TERRA = 0.05
const COSTA = 0.04
/** A rede de 30 em 30 graus e a meia largura das linhas (px de partida). */
const PASSO_DA_REDE = 30 * GRAUS
const MEIA_LINHA = 0.32

const PEDACOS_DO_ANEL = 8
/** Quanto cada pedaço do anel pinta além do setor dele (radianos). */
const SOBRA_DO_SETOR = 0.03

/** O mar é a cor de partida da esfera (a textura pinta as terras por cima). */
const MAR_DA_PECA: MaterialDaPeca = { classe: 'liso', rgb: MAR }

/** A distância (radianos) do ângulo `a` ao múltiplo de `passo` mais perto. */
function aoMultiplo(a: number, passo: number): number {
  const r = a / passo
  return Math.abs(r - Math.round(r)) * passo
}

/** A esfera: o ponto na casca, as terras (o ruído em três pares de eixos, sem emenda), a costa, a rede e o equador. */
function texDaEsfera(raio: number, k: number): Textura {
  const s0 = Math.sin(INCLINACAO_DO_EIXO * GRAUS)
  const c0 = Math.cos(INCLINACAO_DO_EIXO * GRAUS)
  const mx = Math.cos(RUMO_DO_POLO * GRAUS)
  const my = Math.sin(RUMO_DO_POLO * GRAUS)
  // O eixo (a), e duas direções de través (e1 na horizontal, e2 = a x e1).
  const a: readonly [number, number, number] = [s0 * mx, s0 * my, c0]
  const e1: readonly [number, number, number] = [-my, mx, 0]
  const e2: readonly [number, number, number] = [-c0 * mx, -c0 * my, s0]
  return (_u, _v, x, y, p, s) => {
    const px = x / raio
    const py = y / raio
    const rr = px * px + py * py
    const pz = Math.sqrt(rr < 1 ? 1 - rr : 0)
    const q1 = px * e1[0] + py * e1[1] + pz * e1[2]
    const q2 = px * e2[0] + py * e2[1] + pz * e2[2]
    const q3 = px * a[0] + py * a[1] + pz * a[2]
    const lat = Math.asin(q3 > 1 ? 1 : q3 < -1 ? -1 : q3)
    const lon = Math.atan2(q2, q1) + GIRO_DAS_TERRAS
    const n = ruido(q1 * 2.6 + 3.1, q2 * 2.6) + ruido(q2 * 2.6 + 9.4, q3 * 2.6 + 2) + ruido(q3 * 2.6 + 5.5, q1 * 2.6 + 7) + 0.5 * ruido(q1 * 5.5 + 1, q2 * 5.5 + q3 * 3)
    let cor: Rgb = n > NIVEL_DA_TERRA ? TERRA : MAR
    const naCosta = 1 - limitar01(Math.abs(n - NIVEL_DA_TERRA) / COSTA)
    if (naCosta > 0) cor = misturar(cor, TINTA, naCosta * 0.75)
    const linha = (MEIA_LINHA * k) / raio
    if (Math.abs(lat) < linha * 1.4) cor = misturar(cor, EQUADOR, 0.75)
    else if (aoMultiplo(lat, PASSO_DA_REDE) < linha || (Math.abs(lat) < 80 * GRAUS && aoMultiplo(lon, PASSO_DA_REDE) * Math.cos(lat) < linha)) cor = misturar(cor, TINTA, 0.32)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[3] += ruido(x * 0.5 + p.su, y * 0.5) * 0.04
  }
}

/** O anel do horizonte: a madeira nas duas beiras e, no meio, a faixa de papel com as graduações. */
function texDoAnel(dentro: number, fora: number, k: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    const r = Math.hypot(x, y)
    const f = (r - dentro) / (fora - dentro)
    if (f < 0.2 || f > 0.8) {
      if (madeira !== null) madeira(u, v, x, y, p, s, escala)
      return
    }
    s[0] = PAPEL[0]
    s[1] = PAPEL[1]
    s[2] = PAPEL[2]
    const angulo = Math.atan2(y, x)
    const nasBeiras = f < 0.27 || f > 0.73
    const risco30 = aoMultiplo(angulo, 30 * GRAUS) * r < 0.3 * k
    const risco10 = f < 0.46 && aoMultiplo(angulo, 10 * GRAUS) * r < 0.22 * k
    if (nasBeiras || risco30 || risco10) {
      s[0] += (TINTA[0] - s[0]) * 0.6
      s[1] += (TINTA[1] - s[1]) * 0.6
      s[2] += (TINTA[2] - s[2]) * 0.6
    }
    s[3] += ruido(x * 0.4 + p.su, y * 0.4) * 0.04
  }
}

/**
 * A textura só no setor de `a0` a `a1` (radianos, em volta do meio), um pouco além das duas beiras: os pedaços
 * vizinhos se cobrem na emenda (estão na mesma altura, a mesma pintura duas vezes não muda nada).
 */
function soNoSetor(textura: Textura, a0: number, a1: number): Textura {
  const meio = (a0 + a1) / 2
  const meiaAbertura = (a1 - a0) / 2 + SOBRA_DO_SETOR
  return (u, v, x, y, p, s, escala) => {
    let t = Math.atan2(y, x) - meio
    t -= Math.round(t / (2 * Math.PI)) * 2 * Math.PI
    if (Math.abs(t) > meiaAbertura) {
      s[5] = 0
      return
    }
    textura(u, v, x, y, p, s, escala)
  }
}

/** A forma `f` andada de (dx, dy): a sombra do anel no chão. */
function andada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

export const montarGloboTerrestre: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const meridiano = c.m.meridiano
  const L = cena.partes
  const menor = Math.min(hw, hh)
  const k = menor / MEIA_PEGADA
  const R = menor * RAIO_DA_ESFERA
  const ri = R * ANEL_DE_DENTRO
  const ro = R * ANEL_DE_FORA
  const zAnel = g * ALTURA_DO_ANEL
  const zEsfera = zAnel + R * ESFERA_ACIMA_DO_ANEL
  const rPerna = 1.3 * k
  const diagonais = [45, 135, 225, 315].map((graus) => graus * GRAUS)
  const naDiagonal = (a: number, raio: number): Ponto => [Math.cos(a) * raio, Math.sin(a) * raio]

  // No chão, por baixo de tudo: a CRUZETA que liga os pés (a esfera a tapa de cima) e os quatro PÉS curvos.
  for (const a of diagonais.slice(0, 2)) {
    const [xa, ya] = naDiagonal(a, R * RAIO_DAS_PERNAS)
    const barra = capsula(xa, ya, -xa, -ya, 0.9 * k)
    cena.sombras.push(contato(barra, 0.26))
    L.push(P(barra, mad, { eixo: a, tabua: 0, bisel: 0.9 * k, tom: 0.82, contorno: 0.28, semente: 7800 }))
  }
  L.push(P(elipse(0, 0, 2.2 * k, 2.2 * k), mad, { bisel: 1.6 * k, tom: 0.9, contorno: 0.28, semente: 7801 }))
  diagonais.forEach((a, i) => {
    const [x0, y0] = naDiagonal(a, R * RAIO_DAS_PERNAS)
    const [x1, y1] = naDiagonal(a, R * ALCANCE_DOS_PES)
    const curva = a + 0.28
    const [xm, ym] = [x0 + (x1 - x0) * 0.55 + Math.cos(curva + Math.PI / 2) * 0.5 * k, y0 + (y1 - y0) * 0.55 + Math.sin(curva + Math.PI / 2) * 0.5 * k]
    const pe = uniao(uniao(capsula(x0, y0, xm, ym, rPerna), capsula(xm, ym, x1, y1, rPerna * 0.85)), elipse(x1, y1, rPerna * 1.15, rPerna * 1.15))
    cena.sombras.push(contato(pe, 0.32))
    L.push(P(pe, mad, { eixo: a, tabua: 0, bisel: rPerna, tom: 0.88, contorno: 0.3, semente: 7802 + i }))
  })

  // As PERNAS: colunas até o anel (o topo delas é a peça de cada uma, que o anel tapa de cima).
  diagonais.forEach((a, i) => {
    const [x, y] = naDiagonal(a, R * RAIO_DAS_PERNAS)
    const perna = caixa(x - rPerna, y - rPerna, x + rPerna, y + rPerna, rPerna * 0.5)
    cena.sombras.push({ forma: perna, z: zAnel }, contato(perna, 0.3))
    L.push(P(perna, mad, { tabua: 0, bisel: rPerna, tom: 0.86, semente: 7810 + i }))
  })

  // O ANEL do horizonte em oito pedaços, cada um um tampo solto (âncora), pintado só no setor dele; a sombra no chão.
  const formaDoAnel = anel(0, 0, ro, ro, ri, ri)
  cena.sombras.push({ forma: andada(formaDoAnel, SOMBRA_X * zAnel, SOMBRA_Y * zAnel), z: 0, suave: 0.8 + 0.09 * zAnel, forca: 0.26 })
  const texAnel = texDoAnel(ri, ro, k)
  const arco = { cx: 0, cy: 0, r: (ri + ro) / 2, a0: 0 }
  for (let i = 0; i < PEDACOS_DO_ANEL; i += 1) {
    const a0 = -Math.PI + (2 * Math.PI * i) / PEDACOS_DO_ANEL
    const a1 = a0 + (2 * Math.PI) / PEDACOS_DO_ANEL
    const longe = ro * 1.6
    const setor = poligono([[0, 0], naDiagonal(a0, longe), naDiagonal((a0 + a1) / 2, longe), naDiagonal(a1, longe)])
    cena.sombras.push({ forma: { b: caixaDoSetor(ri, ro, a0, a1), d: (x, y) => Math.max(formaDoAnel.d(x, y), setor.d(x, y)) }, z: zAnel, solta: true, forca: 0, suave: 0.1 })
    L.push(P({ b: caixaDoSetor(ri, ro, a0 - SOBRA_DO_SETOR, a1 + SOBRA_DO_SETOR), d: formaDoAnel.d }, mad, { arco, tabua: 0, bisel: 0.9 * k, contorno: 0.28, textura: soNoSetor(texAnel, a0, a1), semente: 7820, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  }

  // A ESFERA, tampo solto um pouco acima do anel (a sombra dela no chão é a afastada), o MERIDIANO e o botão do polo.
  const esfera = elipse(0, 0, R, R)
  cena.sombras.push({ forma: esfera, z: zEsfera, solta: true, forca: 0.24 })
  L.push(P(esfera, MAR_DA_PECA, { bisel: R * 0.98, contorno: 0.26, metal: 0.18, textura: texDaEsfera(R, k), semente: 7830 }))
  const mx = Math.cos(RUMO_DO_POLO * GRAUS)
  const my = Math.sin(RUMO_DO_POLO * GRAUS)
  const ponta = ri * 0.99
  L.push(P(capsula(-mx * ponta, -my * ponta, mx * ponta, my * ponta, 0.85 * k), meridiano, { eixo: RUMO_DO_POLO * GRAUS, tabua: 0, bisel: 0.85 * k, contorno: 0.3, metal: 0.55, semente: 7831, projeta: { dist: 1.4 * k, forca: 0.32 } }))
  const polo = R * Math.sin(INCLINACAO_DO_EIXO * GRAUS)
  L.push(P(elipse(mx * polo, my * polo, 1.5 * k, 1.5 * k), meridiano, { bisel: 1.5 * k, tom: 1.1, contorno: 0.3, metal: 0.6, semente: 7832, projeta: { dist: 1 * k, forca: 0.3 } }))
}

/** A caixa do setor do anel entre os ângulos `a0` e `a1`: as pontas dos dois raios e a volta, a cada 5 graus. */
function caixaDoSetor(dentro: number, fora: number, a0: number, a1: number): Caixa {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const passos = Math.ceil((a1 - a0) / (5 * GRAUS))
  for (let i = 0; i <= passos; i += 1) {
    const a = a0 + ((a1 - a0) * i) / passos
    for (const r of [dentro, fora]) {
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  return [x0, y0, x1, y1]
}
