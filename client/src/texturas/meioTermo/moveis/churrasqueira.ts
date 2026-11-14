/**
 * CHURRASQUEIRA de cima com volume (lote L10 dos objetos de 14/11/2026, grupo Taverna e festa; pedido do
 * mestre: "churrasqueira"). A churrasqueira de quintal, de TIJOLO aparente: as paredes em U (a de trás e a da
 * esquerda, mais altas que a grelha, quebram o vento) com o rejunte claro entre os tijolos, e o vão do fogo
 * entre elas. No fundo do vão, o leito de CINZA com as BRASAS acesas e o halo quente (pintados: não há chama
 * animada); por cima, a GRELHA de ferro (a moldura, as varetas de frente para trás e as duas travessas), e na
 * grelha o churrasco: três LINGUIÇAS curvas, duas fatias de PICANHA com a capa de gordura e as marcas da grelha
 * e uma ESPIGA de milho tostada. À direita, a BANCADA de granito em cima de um pilar de tijolo, com a tábua de
 * carne (a peça crua e a faca), a tigela de sal grosso e o pegador.
 *
 * Não é o braseiro (a bacia redonda no tripé) nem a fogueira (lenha no chão): aqui o fogo fica num caixote de
 * tijolo, debaixo de uma grelha com carne. A 25% de zoom sobram o U vermelho de tijolo, a grade escura sobre o
 * brilho laranja com as manchas marrons da carne, e a laje cinza da bancada: é o que diz "churrasqueira".
 *
 * Na 3/4 (perfil derivado) cada parede é uma coluna, o vão do fogo é uma coluna mais baixa (a grelha e a carne
 * sobem até ela) e a bancada é outra; a frente de cada uma sai de tijolo. Sem material escolhido: o tijolo, o
 * rejunte, o granito, o ferro, a carne e o fogo são fixos. As medidas saem de frações da pegada (1,5 x 1 casa de
 * partida); a carne e as brasas têm tamanho fixo.
 */
import { hash } from '../../ruido'
import { barra, cadeia, caixa, capsula, elipse, menos, poligono, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { CINZA, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { brasas, FOGO_PARADO, texCinza, texHalo } from './fogoDeCasa'

/** As alturas, em casas: as paredes do U, o vão do fogo (onde fica a grelha) e a bancada. */
const ALTURA_DA_PAREDE = 1
const ALTURA_DA_GRELHA = 0.72
const ALTURA_DA_BANCADA = 0.82

/** As divisas, em frações da meia pegada: a parede de trás, a da esquerda, a do meio e a bancada. */
const FUNDO_Y0 = -0.95
const FUNDO_Y1 = -0.6
const FRENTE_Y = 0.95
const ESQUERDA_X0 = -0.97
const ESQUERDA_X1 = -0.8
const MEIO_X0 = 0.2
const MEIO_X1 = 0.37
const BANCADA_X1 = 0.97

/** O tijolo (px do protótipo): comprimento e largura, e a grossura do rejunte. */
const TIJOLO_COMPRIDO = 6.4
const TIJOLO_LARGO = 3.1
const REJUNTE = 0.7
/**
 * O fogo parado debaixo da grelha: quantas brasas, o raio (px) e o alfa do halo. Mais forte que o da lareira: a
 * grelha e a carne tapam quase tudo, e só o que passa entre as varetas diz "aceso".
 */
const BRASAS = 34
const RAIO_DA_BRASA = 1.75
const FORCA_DO_HALO = 0.46
/** A grelha: o passo das varetas e a grossura (px do protótipo). */
const PASSO_DA_GRELHA = 3.1
const VARETA = 0.5

// ---------- as cores ----------

const TIJOLO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa6, 0x66, 0x50] }
const REJUNTE_CLARO: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0xac, 0x9a] }
const GRANITO = materialDaPeca('granito')
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: [0x4a, 0x48, 0x46] }
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0xaa, 0xac] }
/** A carne tostada, a gordura dourada, a carne crua da tábua e a linguiça. */
const CARNE_ASSADA: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x5a, 0x42] }
const GORDURA: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xc0, 0x92] }
const CARNE_CRUA: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0x5e, 0x56] }
const GORDURA_CRUA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd6, 0xc2] }
const LINGUICA: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x5c, 0x46] }
const MILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xd0, 0xae, 0x5c] }
/** A tábua de carne (madeira clara), o cabo da faca, a tigela de barro e o sal grosso. */
const TABUA: MaterialDaPeca = materialDaPeca('pinho')
const CABO: MaterialDaPeca = materialDaPeca('nogueira')
const BARRO = materialDaPeca('barro')
const SAL: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xe2, 0xd8] }

/** A marca da grelha na carne: as faixas escuras de través, a cada `passo` px, e a luz miúda da carne. */
function texMarcasDaGrelha(passo: number, inclina: number): Textura {
  return (u, v, x, y, p, s) => {
    const f = (u + v * inclina) / passo
    const t = f - Math.floor(f)
    s[3] += (t < 0.22 ? -0.32 : 0) + ruido(x * 0.6 + p.su, y * 0.6) * 0.05
  }
}

/** Os grãos da espiga: a grade de caroços (o vão entre eles mais escuro) e uma ou outra queimada. */
function texEspiga(u: number, v: number, x: number, y: number, p: Peca, s: Float32Array): void {
  const fu = u / 1.3 - Math.floor(u / 1.3)
  const fv = v / 1.1 - Math.floor(v / 1.1)
  const vao = Math.min(fu, 1 - fu) < 0.14 || Math.min(fv, 1 - fv) < 0.14
  s[3] += (vao ? -0.16 : 0.03) + (ruido(x * 0.35 + p.su, y * 0.35) > 0.32 ? -0.34 : 0)
}

/** O sal grosso: grãos claros em cima do fundo da tigela. */
function texSal(_u: number, _v: number, x: number, y: number, _p: Peca, s: Float32Array): void {
  const h = hash(Math.floor(x * 1.6), Math.floor(y * 1.6), 61)
  s[3] += h > 0.6 ? 0.08 : h < 0.25 ? -0.1 : 0
}

/**
 * Uma faixa de parede de tijolo, vista de cima: o rejunte claro (a forma inteira) e os tijolos assentados ao
 * comprido da faixa (a mais comprida das duas medidas), em fiadas desencontradas.
 */
function parede(c: ContextoDoMovel, cena: Cena, x0: number, y0: number, x1: number, y1: number, altura: number, sem: number): void {
  const P = c.peca
  const L = cena.partes
  const forma = caixa(x0, y0, x1, y1, 0.6)
  cena.sombras.push({ forma, z: c.g * altura }, contato(forma, 0.32))
  // O tijolo inteiro por baixo é a maior peça da parede: a frente da 3/4 sai de tijolo.
  L.push(P(forma, TIJOLO, { tabua: 0, bisel: 0.8, tom: 0.7, contorno: 0.3, semente: sem }))
  L.push(P(caixa(x0 + 0.4, y0 + 0.4, x1 - 0.4, y1 - 0.4, 0.4), REJUNTE_CLARO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.92, semente: sem + 1 }))
  const deitada = x1 - x0 >= y1 - y0
  const comp = deitada ? x1 - x0 : y1 - y0
  const larg = deitada ? y1 - y0 : x1 - x0
  const fiadas = Math.max(1, Math.round(larg / TIJOLO_LARGO))
  const porFiada = Math.max(1, Math.round(comp / TIJOLO_COMPRIDO))
  const passoComp = comp / porFiada
  const passoLarg = larg / fiadas
  for (let f = 0; f < fiadas; f += 1) {
    const desencontro = f % 2 === 1 ? passoComp / 2 : 0
    for (let i = -1; i <= porFiada; i += 1) {
      const a = Math.max(REJUNTE / 2, i * passoComp + desencontro + REJUNTE / 2)
      const b = Math.min(comp - REJUNTE / 2, (i + 1) * passoComp + desencontro - REJUNTE / 2)
      if (b - a < REJUNTE * 2) continue
      const la = f * passoLarg + REJUNTE / 2
      const lb = (f + 1) * passoLarg - REJUNTE / 2
      const tijolo = deitada ? caixa(x0 + a, y0 + la, x0 + b, y0 + lb, 0.5) : caixa(x0 + la, y0 + a, x0 + lb, y0 + b, 0.5)
      L.push(P(tijolo, TIJOLO, { tabua: 0, eixo: deitada ? 0 : QUARTO, bisel: 0.7, contorno: 0.2, tom: 0.9 + 0.2 * hash(f, i, sem), semente: sem + 2 + f * 11 + i }))
    }
  }
}

/** Uma linguiça curva de `a` a `b`, com a barriga `curva` px para o lado, e as pontas amarradas. */
function linguica(c: ContextoDoMovel, L: Peca[], a: Ponto, b: Ponto, curva: number, r: number, sem: number): void {
  const P = c.peca
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy)
  const nx = -dy / l
  const ny = dx / l
  const pontos: Ponto[] = []
  const passos = 6
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos
    const barriga = curva * 4 * t * (1 - t)
    pontos.push([a[0] + dx * t + nx * barriga, a[1] + dy * t + ny * barriga])
  }
  L.push(P(cadeia(pontos, r), LINGUICA, { tabua: 0, eixo: Math.atan2(dy, dx), bisel: r * 0.85, contorno: 0.3, metal: 0.12, textura: texMarcasDaGrelha(PASSO_DA_GRELHA, 0.5), semente: sem, projeta: { dist: 0.9, forca: 0.36 } }))
  for (const [px, py] of [pontos[0], pontos[passos]]) L.push(P(elipse(px, py, r * 0.32, r * 0.32), GORDURA, { tabua: 0, bisel: 0.3, contorno: 0.25, tom: 0.8, semente: sem + 1 }))
}

/** Uma fatia de picanha deitada: o meio, o tamanho, o giro; a capa de gordura corre numa beira comprida. */
function picanha(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, a: number, b: number, ang: number, crua: boolean, sem: number): void {
  const P = c.peca
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const em = (x: number, y: number): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  const contornoDaFatia: Ponto[] = [em(-a, -b * 0.7), em(-a * 0.4, -b), em(a * 0.6, -b * 0.92), em(a, -b * 0.4), em(a * 0.9, b), em(-a * 0.8, b * 0.9)]
  const fatia = poligono(contornoDaFatia)
  const capa = poligono([em(-a * 0.82, b * 0.42), em(a * 0.92, b * 0.5), em(a * 0.9, b), em(-a * 0.8, b * 0.9)])
  const carne = crua ? CARNE_CRUA : CARNE_ASSADA
  const textura = crua ? undefined : texMarcasDaGrelha(PASSO_DA_GRELHA, 0.5)
  L.push(P(fatia, carne, { tabua: 0, eixo: ang, bisel: 1.1, contorno: 0.3, metal: crua ? 0.18 : 0.1, textura, semente: sem, projeta: { dist: 0.9, forca: 0.36 } }))
  L.push(P(capa, crua ? GORDURA_CRUA : GORDURA, { tabua: 0, eixo: ang, bisel: 0.8, contorno: 0.2, textura, semente: sem + 1 }))
}

/** A grelha: o leito de cinza, as brasas e o halo por baixo; a moldura, as varetas e as travessas por cima. */
function montarFogoEGrelha(c: ContextoDoMovel, cena: Cena, x0: number, y0: number, x1: number, y1: number): void {
  const P = c.peca
  const L = cena.partes
  const vao = caixa(x0, y0, x1, y1, 0.6)
  cena.sombras.push({ forma: vao, z: c.g * ALTURA_DA_GRELHA }, contato(vao, 0.3))
  // O caixote do fogo: o tijolo (a maior peça do vão: a frente da 3/4) e o leito de cinza, na sombra das paredes.
  L.push(P(vao, TIJOLO, { tabua: 0, bisel: 0.6, tom: 0.62, contorno: 0.3, semente: 6600 }))
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2
  const ry = (y1 - y0) / 2
  L.push(P(caixa(x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6, 0.4), CINZA, { tabua: 0, bisel: 0, contorno: 0, textura: texCinza(cx, cy, Math.max(rx, ry)), recesso: { k: 2.4, forca: 0.36 }, tom: 0.82, semente: 6601 }))
  brasas(c, L, cx, cy, rx * 0.86, ry * 0.84, BRASAS, RAIO_DA_BRASA, true, 6610)
  L.push(P(caixa(x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6, 0.4), FOGO_PARADO, { textura: texHalo(cx, cy + ry * 0.08, rx * 1.05, ry * 1.05, FORCA_DO_HALO), bisel: 0, contorno: 0, semente: 6650 }))

  // A grelha: as varetas de frente para trás, as duas travessas por baixo delas e a moldura em volta.
  const gx0 = x0 + 1.2
  const gx1 = x1 - 1.2
  const gy0 = y0 + 1.2
  const gy1 = y1 - 1.2
  const ferro = { tabua: 0, bisel: 0.4, contorno: 0.32, metal: 0.3 }
  for (const f of [0.3, 0.72]) {
    const y = gy0 + (gy1 - gy0) * f
    L.push(P(caixa(gx0, y - 0.7, gx1, y + 0.7, 0.3), FERRO, { ...ferro, tom: 0.85, semente: 6660, projeta: { dist: 0.6, forca: 0.3 } }))
  }
  const varetas = Math.max(2, Math.round((gx1 - gx0) / PASSO_DA_GRELHA))
  const passo = (gx1 - gx0) / varetas
  for (let i = 1; i < varetas; i += 1) {
    const x = gx0 + passo * i
    L.push(P(capsula(x, gy0, x, gy1, VARETA), FERRO, { ...ferro, eixo: QUARTO, semente: 6661 + i, projeta: { dist: 0.6, forca: 0.32 } }))
  }
  L.push(P(menos(caixa(gx0 - 0.4, gy0 - 0.4, gx1 + 0.4, gy1 + 0.4, 0.8), caixa(gx0 + 0.8, gy0 + 0.8, gx1 - 0.8, gy1 - 0.8, 0.3)), FERRO, { ...ferro, tom: 1.05, semente: 6690, projeta: { dist: 0.7, forca: 0.32 } }))

  // O churrasco: três linguiças à esquerda, duas picanhas no meio e a espiga na frente à direita.
  const w = gx1 - gx0
  const h = gy1 - gy0
  const em = (fx: number, fy: number): Ponto => [gx0 + w * fx, gy0 + h * fy]
  linguica(c, L, em(0.08, 0.14), em(0.12, 0.58), -2.2, 1.9, 6700)
  linguica(c, L, em(0.22, 0.12), em(0.25, 0.6), -1.8, 1.9, 6705)
  linguica(c, L, em(0.36, 0.16), em(0.37, 0.62), -1.4, 1.85, 6710)
  picanha(c, L, ...em(0.68, 0.26), 6.2, 4.2, 0.12, false, 6720)
  picanha(c, L, ...em(0.7, 0.62), 5.8, 4, -0.2, false, 6725)
  const [ex0, ey0] = em(0.12, 0.84)
  const [ex1, ey1] = em(0.44, 0.88)
  L.push(P(capsula(ex0, ey0, ex1, ey1, 2.3), MILHO, { tabua: 0, eixo: Math.atan2(ey1 - ey0, ex1 - ex0), bisel: 1.8, contorno: 0.3, textura: texEspiga, semente: 6730, projeta: { dist: 0.9, forca: 0.36 } }))
}

/** A bancada: o pilar de tijolo, a laje de granito por cima e, nela, a tábua com a carne crua, a faca, o sal e o pegador. */
function montarBancada(c: ContextoDoMovel, cena: Cena, x0: number, y0: number, x1: number, y1: number): void {
  const P = c.peca
  const L = cena.partes
  const laje = caixa(x0, y0, x1, y1, 0.9)
  cena.sombras.push({ forma: laje, z: c.g * ALTURA_DA_BANCADA }, contato(caixa(x0 + 1, y0 + 1, x1 - 1, y1 - 1), 0.3))
  // A laje é a maior peça da bancada, mas a frente da 3/4 é o pilar de tijolo: o tijolo vai numa forma maior por baixo.
  L.push(P(caixa(x0 - 0.01, y0 - 0.01, x1 + 0.01, y1 + 0.01, 0.9), TIJOLO, { tabua: 0, bisel: 0.6, tom: 0.7, contorno: 0.3, semente: 6800 }))
  L.push(P(laje, GRANITO, { tabua: 0, bisel: 1, tom: 1.16, contorno: 0.3, semente: 6801 }))
  const w = x1 - x0
  const h = y1 - y0
  const em = (fx: number, fy: number): Ponto => [x0 + w * fx, y0 + h * fy]

  // A tábua de carne, com o furo da alça, a peça crua e a faca.
  const [tx0, ty0] = em(0.12, 0.08)
  const [tx1, ty1] = em(0.88, 0.5)
  const tabua = menos(caixa(tx0, ty0, tx1, ty1, 2), elipse(tx1 - 2.6, (ty0 + ty1) / 2, 0.9, 0.9))
  L.push(P(tabua, TABUA, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: 1.04, semente: 6810, projeta: { dist: 0.8, forca: 0.32 } }))
  picanha(c, L, tx0 + (tx1 - tx0) * 0.4, (ty0 + ty1) / 2 - 0.4, 5.4, 4, -0.08, true, 6811)
  const [fx0, fy0] = em(0.18, 0.62)
  const [fx1, fy1] = em(0.86, 0.56)
  const meio: Ponto = [fx0 + (fx1 - fx0) * 0.55, fy0 + (fy1 - fy0) * 0.55]
  L.push(P(poligono([[fx0, fy0 - 0.9], [meio[0], meio[1] - 1.2], [meio[0], meio[1] + 0.7], [fx0 + 1, fy0 + 0.5]]), ACO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.6, semente: 6812, projeta: { dist: 0.5, forca: 0.3 } }))
  L.push(P(barra(meio[0], meio[1] - 0.25, fx1, fy1, 1.7), CABO, { tabua: 0, eixo: Math.atan2(fy1 - fy0, fx1 - fx0), bisel: 0.7, contorno: 0.3, semente: 6813, projeta: { dist: 0.6, forca: 0.3 } }))

  // A tigela de sal grosso e o pegador de ferro (as duas hastes abertas e o elo do cabo).
  const [sx, sy] = em(0.3, 0.83)
  const r = Math.min(w, h) * 0.17
  L.push(P(elipse(sx, sy, r, r), BARRO, { tabua: 0, bisel: r * 0.5, contorno: 0.3, semente: 6820, projeta: { dist: 0.8, forca: 0.32 } }))
  L.push(P(elipse(sx, sy, r * 0.72, r * 0.72), SAL, { tabua: 0, bisel: r * 0.4, contorno: 0.1, textura: texSal, recesso: { k: 1, forca: 0.24 }, semente: 6821 }))
  const [p0x, p0y] = em(0.62, 0.95)
  const [p1x, p1y] = em(0.84, 0.66)
  const [p2x, p2y] = em(0.94, 0.74)
  const pegador = { tabua: 0, bisel: 0.35, contorno: 0.3, metal: 0.5, projeta: { dist: 0.6, forca: 0.3 } }
  L.push(P(capsula(p0x, p0y, p1x, p1y, 0.55), ACO, { ...pegador, semente: 6830 }))
  L.push(P(capsula(p0x, p0y, p2x, p2y, 0.55), ACO, { ...pegador, semente: 6831 }))
  L.push(P(elipse(p0x, p0y, 1, 1), ACO, { ...pegador, bisel: 0.6, semente: 6832 }))
}

export const montarChurrasqueira: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  const yFundo0 = FUNDO_Y0 * hh
  const yFundo1 = FUNDO_Y1 * hh
  const yFrente = FRENTE_Y * hh
  const xEsq0 = ESQUERDA_X0 * hw
  const xEsq1 = ESQUERDA_X1 * hw
  const xMeio0 = MEIO_X0 * hw
  const xMeio1 = MEIO_X1 * hw
  // A bancada primeiro (é a mais baixa ao lado da parede do meio), depois o vão do fogo e as paredes do U.
  montarBancada(c, cena, xMeio1 - 0.4, yFundo0 + 0.6, BANCADA_X1 * hw, yFrente - 0.2)
  montarFogoEGrelha(c, cena, xEsq1, yFundo1, xMeio0, yFrente)
  parede(c, cena, xEsq0, yFundo0, xMeio1, yFundo1, ALTURA_DA_PAREDE, 6900)
  parede(c, cena, xEsq0, yFundo1, xEsq1, yFrente, ALTURA_DA_PAREDE, 6950)
  parede(c, cena, xMeio0, yFundo1, xMeio1, yFrente, ALTURA_DA_PAREDE, 6970)
}
