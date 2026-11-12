/**
 * BOTE A REMO de cima (lote 12 dos objetos novos, 11/11/2026; grupo Porto e
 * navio, a campanha é de piratas). O casco de tábuas, a proa em ponta e a popa
 * quadrada (o painel de popa); a borda grossa por cima de tudo, com as duas
 * forquetas de ferro do banco do meio e a roda de proa; por dentro o forro em
 * fiadas que desce até o fundo, as cavernas de través (de borda a borda) e a
 * sobrequilha no meio, duas tábuas rachadas e um remendo pregado, um pouco de
 * água empoçada entre os bancos; três bancos de través, dois remos deitados por
 * cima deles (encostados num lado, com o couro onde passam na forqueta), um
 * rolo de corda na proa, amarrado num olhal, e um balde de madeira na popa.
 *
 * Deitado ao comprido (3 x 1,5 casas de partida, a proa à direita): a 3/4
 * mostra o costado. Esticado de pé (pegada mais alta que larga), ele fica de pé
 * na pegada, com a proa para baixo (`montarBote`). Os tokens ficam dentro: o meio fica livre (os remos vão
 * encostados no lado de baixo, o balde e a corda nas pontas). O casco é uma
 * forma só, a distância à borda de fora (`distanciaAoCasco`), da qual saem por
 * recuo a borda, o forro e o fundo. A luz do forro (o lado de lá na sombra, o de
 * cá na luz) e a sombra que a borda faz dentro do bote são pintadas na textura,
 * com a direção da luz já desgirada quando a 3/4 gira a cena.
 *
 * Na 3/4 a borda é uma estrutura em ANEL, em duas metades (cortadas ao comprido
 * ou de través, conforme o giro, para a linha do corte cair deitada na tela): a
 * metade de trás varre a face de dentro do costado de lá, que aparece por cima
 * do fundo, e vem antes dos bancos, que passam na frente dela; a da frente varre
 * o costado de fora. O fundo, o forro, a água, a corda e o olhal ficam no chão do
 * bote; os bancos, os remos e o balde sobem cada um à sua altura.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Sombra, type Textura } from './motor'
import { BURACO, G, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { desgirarCena } from './pipaDeitada'

// ---------- as medidas (px do protótipo; as frações são do comprimento do casco, da popa para a proa) ----------

const MARGEM = 2
/** A meia largura do painel de popa (fração da boca), onde fica a boca (a parte mais larga) e o afinar da proa. */
const POPA = 0.74
const LUGAR_DA_BOCA = 0.4
const AFINA_PROA = 1.7
/** A borda (a régua grossa por cima do costado) e o forro que se vê de cima, do pé da borda até o fundo. */
const BORDA = 3.4
const FORRO = 7.5
/** As alturas na 3/4: a borda, o banco, o remo deitado nele e o balde. */
const ALTURA_DA_BORDA = 0.32 * G
const ALTURA_DO_BANCO = 0.19 * G
const GROSSURA_DO_REMO = 2.6
const ALTURA_DO_BALDE = 0.22 * G
/** A largura das fiadas do forro, das tábuas do fundo e o passo e a largura das cavernas. */
const TABUA_DO_FORRO = 3.8
const TABUA_DO_FUNDO = 6.4
const PASSO_DA_CAVERNA = 0.2 * G
const LARGURA_DA_CAVERNA = 2.3
/** Um ponto do fundo fora dos bancos (fração do comprimento), onde fica o meio da caixa do que está no chão do bote. */
const LUGAR_DO_CHAO = 0.6
/** Onde as cavernas param perto da proa (o fundo ali é estreito demais). */
const CAVERNAS_ATE_A_PROA = 14
/** Os três bancos, a largura de cada um e o quanto entram no forro (fração dele). */
const BANCOS: readonly number[] = [0.2, 0.47, 0.72]
const LARGURA_DO_BANCO = 0.19 * G
const BANCO_NO_FORRO = 0.45
/** A forqueta fica atrás do banco do meio (quem rema olha para a popa). */
const FORQUETA_ATRAS_DO_BANCO = 0.2 * G
/** Os remos: [fração do comprimento, fração da boca] do punho e da ponta da pá, encostados no lado de baixo. */
const REMOS: readonly (readonly [Ponto, Ponto])[] = [
  [[0.13, 0.62], [0.7, 0.41]],
  [[0.21, 0.44], [0.79, 0.27]],
]
const PUNHO = 8
const RAIO_DO_PUNHO = 1.1
const RAIO_DO_CABO_DO_REMO = 1.55
const COMPRIMENTO_DA_PA = 28
const LARGURA_DA_PA = 6.6
/** O couro em volta do cabo, onde o remo passa na forqueta (fração do remo a partir do punho) e o comprimento dele. */
const LUGAR_DO_COURO = 0.3
const COMPRIMENTO_DO_COURO = 7
/** O balde: o lugar [fração do comprimento, fração da boca], o raio e as aduelas. */
const BALDE: Ponto = [0.105, 0.12]
const RAIO_DO_BALDE = 6.2
const ADUELAS = 14
/** O rolo de corda: o meio (fração do comprimento), o raio da corda, o de dentro e as voltas; o olhal na proa. */
const ROLO = 0.8
const RAIO_DA_CORDA = 1.15
const RAIO_DE_DENTRO_DO_ROLO = 1.2
const VOLTAS_DO_ROLO = 2.5
const PASSO_DO_ROLO = 0.3
const OLHAL_ANTES_DA_PROA = 14
/** A sombra que a borda faz dentro do bote: a força e a borda dela. */
const FORCA_DA_SOMBRA_DA_PAREDE = 0.3
const BORDA_DA_SOMBRA_DA_PAREDE = 1.4
/** O quanto o forro clareia virado para a luz (e escurece do outro lado). */
const INCLINACAO_DO_FORRO = 0.22
/** A beira clara da água empoçada e a faixa do reflexo do céu nela. */
const BEIRA_DA_AGUA = 1.1
const LARGURA_DO_REFLEXO = 2.4
const VOLTA_INTEIRA = Math.PI * 2

// ---------- as cores fixas ----------

/** A luz do motor (de cima à esquerda), em x e y. */
const LUZ: Ponto = [-0.62, -0.48]
/** O remo: freixo claro, que se destaca dos bancos. O couro da forqueta, a água e o ferro. */
const REMO: MaterialDaPeca = { classe: 'madeira', rgb: rgb(tomDoMeio('pinho', 1.04)) }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x42, 0x2e] }
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.72)) }
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** O cânhamo da corda (o do vergueiro do canhão) e a cor da torção. */
const TOM_DO_CABO: Rgb = [0xc4, 0xac, 0x7e]
const TORCAO_DO_CABO: Rgb = [0x8e, 0x76, 0x50]
const CABO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_CABO }

const VEIO = texturaDaClasse('madeira')

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

// ---------- o casco ----------

interface Casco {
  /** O x do painel de popa e o da ponta da proa, e a meia largura na boca. */
  readonly popa: number
  readonly proa: number
  readonly boca: number
  /**
   * A meia largura e o fator da inclinação do costado, de `PASSO_DA_TABELA` em
   * `PASSO_DA_TABELA` px a partir da popa: a distância ao casco é pedida milhões
   * de vezes (a sombra arrastada, a frente varrida da 3/4), e a conta com seno e
   * potência a cada vez fazia o bote passar de 1,5 s.
   */
  readonly meia: Float32Array
  readonly fator: Float32Array
}

const PASSO_DA_TABELA = 0.25

/** A meia largura do casco (por fora) no x: da popa quadrada sobe até a boca e afina até a ponta da proa. */
function meiaBocaNaConta(popa: number, proa: number, boca: number, x: number): number {
  const t = limitar((x - popa) / (proa - popa), 0, 1)
  if (t <= LUGAR_DA_BOCA) return boca * (POPA + (1 - POPA) * Math.sin((Math.PI / 2) * (t / LUGAR_DA_BOCA)))
  const s = (t - LUGAR_DA_BOCA) / (1 - LUGAR_DA_BOCA)
  return boca * (1 - Math.pow(s, AFINA_PROA))
}

function novoCasco(popa: number, proa: number, boca: number): Casco {
  const n = Math.ceil((proa - popa) / PASSO_DA_TABELA) + 2
  const meia = new Float32Array(n)
  const fator = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    const x = popa + i * PASSO_DA_TABELA
    meia[i] = meiaBocaNaConta(popa, proa, boca, x)
    const inclinacao = meiaBocaNaConta(popa, proa, boca, x + 0.5) - meiaBocaNaConta(popa, proa, boca, x - 0.5)
    fator[i] = 1 / Math.sqrt(1 + inclinacao * inclinacao)
  }
  return { popa, proa, boca, meia, fator }
}

/** O lugar de x na tabela: o índice e a fração até o próximo. */
function naTabela(k: Casco, x: number, saida: Float32Array): void {
  const ultimo = k.meia.length - 1
  const f = limitar((x - k.popa) / PASSO_DA_TABELA, 0, ultimo)
  const i = Math.min(ultimo - 1, Math.floor(f))
  saida[0] = i
  saida[1] = f - i
}

const LUGAR = new Float32Array(2)

function meiaBoca(k: Casco, x: number): number {
  naTabela(k, x, LUGAR)
  const i = LUGAR[0]
  return k.meia[i] + (k.meia[i + 1] - k.meia[i]) * LUGAR[1]
}

/** A distância (negativa dentro) à borda de fora do casco: a do lado, vezes o fator da inclinação, quase exata. */
function distanciaAoCasco(k: Casco, x: number, y: number): number {
  naTabela(k, x, LUGAR)
  const i = LUGAR[0]
  const t = LUGAR[1]
  const meia = k.meia[i] + (k.meia[i + 1] - k.meia[i]) * t
  const fator = k.fator[i] + (k.fator[i + 1] - k.fator[i]) * t
  return Math.max((Math.abs(y) - meia) * fator, k.popa - x, x - k.proa)
}

function caixaRecuada(k: Casco, recuo: number): Caixa {
  return [k.popa + recuo, -k.boca + recuo, k.proa - recuo, k.boca - recuo]
}

/** O casco recuado `recuo` px para dentro. */
function cascoRecuado(k: Casco, recuo: number): Forma {
  return { b: caixaRecuada(k, recuo), d: (x, y) => distanciaAoCasco(k, x, y) + recuo }
}

/** A faixa entre os recuos `de` e `ate` (a borda, o forro). */
function faixaDoCasco(k: Casco, de: number, ate: number): Forma {
  return {
    b: caixaRecuada(k, de),
    d: (x, y) => {
      const d = distanciaAoCasco(k, x, y)
      return Math.max(d + de, -(d + ate))
    },
  }
}

/** A forma com outra caixa (a 3/4 ordena as estruturas pela base da caixa delas). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/** A mesma forma com a caixa centrada em (cx, cy): a 3/4 lê o meio da caixa para saber com quem a peça sobe. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** Só a altura, para a 3/4: uma estrutura que não faz sombra no chão (o que está dentro do bote faz sombra nas peças). */
function estrutura(forma: Forma, z: number): Sombra {
  return { forma, z, solta: true, forca: 0, suave: 0.1 }
}

// ---------- o giro ----------

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** Uma direção da TELA no referencial do bote girado `q` quartos de volta (o `desgirarPonto` de `tresQuartos.ts`). */
function desgirar([x, y]: Ponto, q: number): Ponto {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

/** O que cada parte do bote recebe. */
interface Bote {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  readonly k: Casco
  readonly q: number
  /** A luz e o deslocamento da sombra da borda, no referencial do bote. */
  readonly luz: Ponto
  readonly sombra: Ponto
  /** O x de uma fração do comprimento, da popa para a proa. */
  readonly em: (t: number) => number
}

// ---------- as texturas ----------

/** A sombra da borda dentro do bote: o ponto em direção à luz cai na borda (ou fora do casco). */
function sombraDaParede(b: Bote, x: number, y: number, s: Float32Array): void {
  const d = distanciaAoCasco(b.k, x - b.sombra[0], y - b.sombra[1]) + BORDA
  s[3] -= FORCA_DA_SOMBRA_DA_PAREDE * limitar(0.5 + d / BORDA_DA_SOMBRA_DA_PAREDE, 0, 1)
}

/** O fundo, as cavernas e a sobrequilha: o veio do material e a sombra da borda. */
function texDeDentro(b: Bote): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (VEIO !== null) VEIO(u, v, x, y, p, s, escala)
    sombraDaParede(b, x, y, s)
  }
}

/** O forro: as fiadas correm junto da borda (a fresta a cada fiada para dentro), claro do lado virado para a luz. */
function texDoForro(b: Bote): Textura {
  return (u, _v, x, y, p, s, escala) => {
    const d = distanciaAoCasco(b.k, x, y)
    if (VEIO !== null) VEIO(u, -d - BORDA + p.sv, x, y, p, s, escala)
    const gx = distanciaAoCasco(b.k, x + 0.5, y) - distanciaAoCasco(b.k, x - 0.5, y)
    const gy = distanciaAoCasco(b.k, x, y + 0.5) - distanciaAoCasco(b.k, x, y - 0.5)
    const n = Math.hypot(gx, gy) || 1
    s[3] -= (INCLINACAO_DO_FORRO * (gx * b.luz[0] + gy * b.luz[1])) / n
    sombraDaParede(b, x, y, s)
  }
}

/** A água parada: a beira clara (o menisco), a marola miúda e a faixa do reflexo do céu. */
function texDaAgua(b: Bote, comParede: boolean): Textura {
  return (_u, _v, x, y, p, s) => {
    const dentro = -p.forma.d(x, y)
    if (dentro < BEIRA_DA_AGUA) s[3] += 0.14 * (1 - dentro / BEIRA_DA_AGUA)
    s[3] += ruido(x * 0.3 + p.semente, y * 0.3) * 0.06
    const faixa = (x * 0.55 - y + p.semente * 0.01) / LARGURA_DO_REFLEXO
    s[3] += 0.2 * Math.exp(-faixa * faixa)
    if (comParede) sombraDaParede(b, x, y, s)
  }
}

/** A madeira com pregos nos pontos dados (o banco, o remendo). */
function texComPregos(pregos: readonly Ponto[]): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (VEIO !== null) VEIO(u, v, x, y, p, s, escala)
    for (const [px, py] of pregos) {
      const dx = x - px
      const dy = y - py
      if (dx * dx + dy * dy > 0.62) continue
      s[0] = PREGO.rgb[0]
      s[1] = PREGO.rgb[1]
      s[2] = PREGO.rgb[2]
      s[3] = dx + dy < 0 ? 0.14 : -0.1
      return
    }
  }
}

/** A boca do balde: as frestas das aduelas em raio e o topo cortado delas. */
function texDoBalde(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const f = (Math.atan2(y - cy, x - cx) / VOLTA_INTEIRA) * ADUELAS
    const fresta = Math.abs(f - Math.round(f))
    if (fresta < 0.08) s[3] -= 0.3 * (1 - fresta / 0.08)
    s[3] += ruido(x * 0.8 + p.semente, y * 0.8) * 0.06
  }
}

/** A torção da corda ao longo do caminho dela (a do vergueiro do canhão). */
function texDoCabo(caminho: readonly Ponto[], raio: number): Textura {
  const ate: number[] = [0]
  for (let i = 1; i < caminho.length; i += 1) ate.push(ate[i - 1] + Math.hypot(caminho[i][0] - caminho[i - 1][0], caminho[i][1] - caminho[i - 1][1]))
  return (_u, _v, x, y, _p, s) => {
    let menor = Infinity
    let aoLongo = 0
    let atraves = 0
    for (let i = 1; i < caminho.length; i += 1) {
      const [ax, ay] = caminho[i - 1]
      const dx = caminho[i][0] - ax
      const dy = caminho[i][1] - ay
      const comprimento = ate[i] - ate[i - 1] || 1e-9
      const h = limitar(((x - ax) * dx + (y - ay) * dy) / (comprimento * comprimento), 0, 1)
      const qx = x - ax - dx * h
      const qy = y - ay - dy * h
      const d2 = qx * qx + qy * qy
      if (d2 >= menor) continue
      menor = d2
      aoLongo = ate[i - 1] + h * comprimento
      atraves = (qy * dx - qx * dy) / comprimento
    }
    const t = limitar((Math.sin((aoLongo / 3.4) * VOLTA_INTEIRA + (atraves / raio) * 1.2) - 0.2) / 0.8, 0, 1)
    s[0] += (TORCAO_DO_CABO[0] - s[0]) * t
    s[1] += (TORCAO_DO_CABO[1] - s[1]) * t
    s[2] += (TORCAO_DO_CABO[2] - s[2]) * t
    s[3] += 0.06
  }
}

// ---------- o chão do bote ----------

function montarDentro(b: Bote): void {
  const { c, cena, k, em } = b
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const fundo = cascoRecuado(k, BORDA + FORRO - 0.5)
  // O que fica no chão do bote tem a caixa centrada num ponto do fundo fora dos bancos: com o meio da caixa no
  // meio do bote, o fundo inteiro subia na 3/4 com o banco do meio e tapava as cavernas, a água e a corda.
  const noChao = em(LUGAR_DO_CHAO)
  L.push(P(presa(fundo, noChao, 0), mad, { eixo: 0, tabua: TABUA_DO_FUNDO, bisel: 0.6, tom: 0.8, contorno: 0.2, semente: 8800, textura: texDeDentro(b) }))
  L.push(P(presa(faixaDoCasco(k, BORDA - 0.4, BORDA + FORRO), noChao, 0), mad, { eixo: 0, tabua: TABUA_DO_FORRO, bisel: 0.8, tom: 0.88, contorno: 0.3, semente: 8801, textura: texDoForro(b) }))
  // As rachas: uma na tábua do fundo, entre o banco do meio e o da frente, e uma na fiada de lá do forro, perto da popa.
  const naTabua: Ponto[] = [0.53, 0.56, 0.59, 0.62, 0.655].map((t, i) => [em(t), -5.4 + (i % 2 === 0 ? 0 : i === 1 ? 0.7 : -0.6)])
  const naFiada: Ponto[] = [0.07, 0.1, 0.13, 0.16, 0.19].map((t, i) => [em(t), -(meiaBoca(k, em(t)) - BORDA - 3.4) + (i % 2 === 0 ? 0 : 0.5)])
  for (const [i, racha] of [naTabua, naFiada].entries()) L.push(P(cadeia(racha, 0.42), BURACO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 8802 + i }))
  // O remendo pregado por cima de outra racha do fundo.
  const [r0, r1, ry0, ry1] = [em(0.555), em(0.625), 4.2, 10.2]
  const pregos: Ponto[] = [[r0 + 1.4, ry0 + 1.3], [r1 - 1.4, ry0 + 1.3], [r0 + 1.4, ry1 - 1.3], [r1 - 1.4, ry1 - 1.3]]
  L.push(P(caixa(r0, ry0, r1, ry1, 0.6), mad, { eixo: 0, tabua: 0, bisel: 0.8, tom: 1.12, contorno: 0.28, semente: 8804, textura: texComPregos(pregos), projeta: { dist: 0.6, forca: 0.25 } }))
  // As cavernas de borda a borda (por cima do forro e do fundo) e a sobrequilha por cima delas, no meio.
  const dentroDaBorda = cascoRecuado(k, BORDA - 0.3)
  for (let x = k.popa + BORDA + 4, i = 0; x < k.proa - CAVERNAS_ATE_A_PROA; x += PASSO_DA_CAVERNA, i += 1) {
    const caverna = dentroDe(caixa(x - LARGURA_DA_CAVERNA / 2, -k.boca, x + LARGURA_DA_CAVERNA / 2, k.boca), dentroDaBorda)
    // A caixa centrada na ponta de lá da caverna, no forro além da ponta dos bancos: a caverna fica no chão na 3/4.
    L.push(P(presa(caverna, x, -(meiaBoca(k, x) - BORDA - 1.6)), mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.98, contorno: 0.3, semente: 8810 + i, textura: texDeDentro(b), projeta: { dist: 0.7, forca: 0.22 } }))
  }
  L.push(P(presa(dentroDe(caixa(em(0.07), -1.7, em(0.86), 1.7, 0.8), fundo), noChao, 0), mad, { eixo: 0, tabua: 0, bisel: 0.8, tom: 0.9, contorno: 0.26, semente: 8830, textura: texDeDentro(b), projeta: { dist: 0.6, forca: 0.2 } }))
  // A água empoçada entre o banco de trás e o do meio, em cima das cavernas (que aparecem por baixo dela).
  const poca = uniao(uniao(elipse(em(0.31), -2, 9, 5.2), elipse(em(0.365), 1.2, 7.5, 4.4)), elipse(em(0.265), 1.6, 5, 3.3))
  // Rala: o tabuado do fundo aparece por baixo da água (com mais, a poça virava uma mancha de tinta).
  L.push(P(dentroDe(poca, fundo), AGUA, { tabua: 0, bisel: 0, contorno: 0.08, alfa: 0.52, semente: 8831, textura: texDaAgua(b, true) }))
  // O olhal na proa, onde a corda está amarrada.
  const xo = k.proa - OLHAL_ANTES_DA_PROA
  L.push(P(anel(xo, 0, 1.9, 1.9, 0.95, 0.95), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1, contorno: 0.28, metal: 0.45, semente: 8832 }))
}

/** O rolo de corda deitado no fundo, perto da proa, e a ponta que vai até o olhal. */
function montarCorda(b: Bote): void {
  const { c, cena, k, em } = b
  const cx = em(ROLO)
  const caminho: Ponto[] = []
  const passo = 2 * RAIO_DA_CORDA + 0.1
  const fim = VOLTAS_DO_ROLO * VOLTA_INTEIRA
  for (let a = 0; a <= fim; a += PASSO_DO_ROLO) {
    const r = RAIO_DE_DENTRO_DO_ROLO + (passo * a) / VOLTA_INTEIRA
    caminho.push([cx + Math.cos(a) * r, Math.sin(a) * r])
  }
  const [ux, uy] = caminho[caminho.length - 1]
  const xo = k.proa - OLHAL_ANTES_DA_PROA
  caminho.push([(ux + xo) / 2 + 1, uy * 0.4 + 1.2], [xo - 1.6, 0])
  cena.partes.push(c.peca(cadeia(caminho, RAIO_DA_CORDA), CABO, { bisel: RAIO_DA_CORDA, contorno: 0.3, textura: texDoCabo(caminho, RAIO_DA_CORDA), semente: 8840, projeta: { dist: 0.8, forca: 0.3 } }))
}

/** O balde de madeira na popa: a boca das aduelas, o aro de ferro, o fundo escuro com água e a alça deitada. */
function montarBalde(b: Bote, meio: number): void {
  const { c, cena, k, em } = b
  const P = c.peca
  const L = cena.partes
  const cx = em(BALDE[0])
  const cy = BALDE[1] * k.boca
  const r = RAIO_DO_BALDE
  const corpo = elipse(cx, cy, r + 0.5, r + 0.5)
  // A caixa vai até o meio do bote: girado de lado, ele vem depois da metade de trás da borda na 3/4.
  cena.sombras.push({ forma: naCaixa(corpo, [corpo.b[0], corpo.b[1], Math.max(corpo.b[2], meio + 1), corpo.b[3]]), z: ALTURA_DO_BALDE, forca: 0 })
  // O corpo leva a maior caixa do balde: a frente dele na 3/4 sai de aduela, e não do aro de ferro.
  const corpoMaior: Caixa = [cx - r - 1.5, cy - r - 1.5, cx + r + 1.5, cy + r + 1.5]
  L.push(P(naCaixa(elipse(cx, cy, r, r), corpoMaior), c.m.madeira, { tabua: 0, bisel: 1.1, tom: 0.98, contorno: 0.3, semente: 8850, textura: texDoBalde(cx, cy), projeta: { dist: 2.2, forca: 0.34 } }))
  L.push(P(anel(cx, cy, r + 0.45, r + 0.45, r - 0.5, r - 0.5), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 0.92, contorno: 0.28, metal: 0.35, semente: 8851 }))
  L.push(P(elipse(cx, cy, r - 1.5, r - 1.5), c.m.madeira, { tabua: 0, bisel: 0.6, tom: 0.62, contorno: 0.3, semente: 8852, recesso: { k: 2.4, forca: 0.45 } }))
  L.push(P(elipse(cx, cy, r - 2.6, r - 2.6), AGUA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.88, semente: 8853, textura: texDaAgua(b, false) }))
  const alca: Ponto[] = [[cx - r + 0.6, cy + 0.6], [cx - r * 0.7, cy + r + 1.6], [cx, cy + r + 3], [cx + r * 0.7, cy + r + 1.6], [cx + r - 0.6, cy + 0.6]]
  L.push(P(cadeia(alca, 0.55), FERRAGEM, { bisel: 0.5, contorno: 0.3, metal: 0.4, semente: 8854, projeta: { dist: 0.7, forca: 0.3 } }))
}

// ---------- os bancos e os remos ----------

function montarBancos(b: Bote): void {
  const { c, cena, k, em } = b
  const recuo = BORDA + FORRO * BANCO_NO_FORRO
  const dentro = cascoRecuado(k, recuo)
  BANCOS.forEach((t, i) => {
    const x = em(t)
    const forma = dentroDe(caixa(x - LARGURA_DO_BANCO / 2, -k.boca, x + LARGURA_DO_BANCO / 2, k.boca, 0.8), dentro)
    const ponta = meiaBoca(k, x) - recuo - 2.6
    const pregos: Ponto[] = [[x - 2.8, -ponta], [x + 2.8, -ponta], [x - 2.8, ponta], [x + 2.8, ponta]]
    cena.sombras.push(estrutura(forma, ALTURA_DO_BANCO))
    cena.partes.push(c.peca(forma, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: 1.1, contorno: 0.26, semente: 8860 + i, textura: texComPregos(pregos), projeta: { dist: 2.6, forca: 0.32, suave: 1 } }))
  })
}

function montarRemos(b: Bote): void {
  const { c, cena, k, em } = b
  const P = c.peca
  // A caixa de cada remo cobre o bote todo: em qualquer giro a 3/4 o pinta depois dos bancos em que ele se deita.
  const todoOBote: Caixa = caixaRecuada(k, 1)
  REMOS.forEach(([[t0, f0], [t1, f1]], i) => {
    const a: Ponto = [em(t0), f0 * k.boca]
    const ponta: Ponto = [em(t1), f1 * k.boca]
    const comprimento = Math.hypot(ponta[0] - a[0], ponta[1] - a[1])
    const ux = (ponta[0] - a[0]) / comprimento
    const uy = (ponta[1] - a[1]) / comprimento
    const ao = (f: number): Ponto => [a[0] + ux * f, a[1] + uy * f]
    const eixo = Math.atan2(uy, ux)
    const [px, py] = ao(PUNHO)
    const [qx, qy] = ao(comprimento - COMPRIMENTO_DA_PA)
    const [mx, my] = ao(comprimento - COMPRIMENTO_DA_PA / 2)
    const remo = uniao(uniao(capsula(a[0], a[1], px, py, RAIO_DO_PUNHO), capsula(px, py, qx, qy, RAIO_DO_CABO_DO_REMO)), elipseGirada(mx, my, COMPRIMENTO_DA_PA / 2, LARGURA_DA_PA / 2, eixo))
    cena.sombras.push(estrutura(naCaixa(remo, todoOBote), ALTURA_DO_BANCO + GROSSURA_DO_REMO))
    cena.partes.push(P(remo, REMO, { eixo, tabua: 0, bisel: 1.2, contorno: 0.3, semente: 8870 + i, projeta: { dist: 2.2, forca: 0.32, suave: 0.9 } }))
    const [cx0, cy0] = ao(comprimento * LUGAR_DO_COURO)
    const [cx1, cy1] = ao(comprimento * LUGAR_DO_COURO + COMPRIMENTO_DO_COURO)
    cena.partes.push(P(capsula(cx0, cy0, cx1, cy1, RAIO_DO_CABO_DO_REMO + 0.35), COURO, { bisel: 1, contorno: 0.3, semente: 8874 + i }))
  })
}

// ---------- a borda ----------

/**
 * A borda em duas metades, cada uma uma estrutura da altura da borda. O corte
 * fica deitado NA TELA: ao comprido sem giro ou com meia volta, de través com um
 * quarto de volta. Cada metade sobe com as peças cuja caixa tem o meio nela.
 */
function montarBorda(b: Bote, meio: number): void {
  const { c, cena, k, q, em } = b
  const P = c.peca
  const mad = c.m.madeira
  const faixa = faixaDoCasco(k, 0, BORDA)
  const grande = 4 * (k.proa - k.popa)
  const deTraves = q % 2 === 1
  const xBoca = em(LUGAR_DA_BOCA)
  const noMeioDaBorda = meiaBoca(k, xBoca) - BORDA / 2
  const metades = deTraves
    ? [
        { lado: caixa(-grande, -grande, meio, grande), meio: [k.popa + BORDA / 2, 0] as Ponto },
        { lado: caixa(meio, -grande, grande, grande), meio: [k.proa - 2.2, 0] as Ponto },
      ]
    : [
        { lado: caixa(-grande, -grande, grande, 0), meio: [xBoca, -noMeioDaBorda] as Ponto },
        { lado: caixa(-grande, 0, grande, grande), meio: [xBoca, noMeioDaBorda] as Ponto },
      ]
  for (const [i, metade] of metades.entries()) {
    const forma = dentroDe(faixa, metade.lado)
    cena.sombras.push({ forma, z: ALTURA_DA_BORDA })
    cena.partes.push(P(presa(forma, metade.meio[0], metade.meio[1]), mad, { eixo: 0, tabua: 0, bisel: 1.3, tom: 1.06, contorno: 0.3, semente: 8880 + i, projeta: { dist: 1.3, forca: 0.3 } }))
  }
  cena.sombras.push(contato(cascoRecuado(k, 0), 0.26))
  // As forquetas, atrás do banco do meio, uma em cada borda: a chapa e os dois chifres de ferro.
  const xf = em(BANCOS[1]) - FORQUETA_ATRAS_DO_BANCO
  for (const lado of [-1, 1]) {
    const yf = lado * (meiaBoca(k, xf) - BORDA / 2)
    cena.partes.push(P(elipse(xf, yf, 2.1, 1.7), FERRAGEM, { tabua: 0, bisel: 0.6, tom: 0.8, contorno: 0.3, metal: 0.3, semente: 8884 + lado }))
    for (const chifre of [-1, 1]) cena.partes.push(P(elipse(xf + chifre * 1.5, yf, 0.95, 0.95), FERRAGEM, { tabua: 0, bisel: 0.9, tom: 1.12, contorno: 0.3, metal: 0.55, projeta: { dist: 0.9, forca: 0.32 } }))
  }
  // A roda de proa, por cima da ponta da borda: vai com a metade da frente na tela (com meia volta, a de cima no bote).
  const lado = q === 2 ? -0.6 : 0.6
  cena.partes.push(P(presa(capsula(k.proa - 8.5, 0, k.proa - 4, 0, 1.6), k.proa - 3.2, lado), mad, { eixo: 0, tabua: 0, bisel: 1.4, tom: 0.84, contorno: 0.3, semente: 8888, projeta: { dist: 1, forca: 0.3 } }))
}

/** O bote deitado na pegada: o comprimento ao longo de x, a proa à direita. */
const montarDeitado: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const k = novoCasco(-c.hw + MARGEM, c.hw - MARGEM, c.hh - MARGEM)
  const [sx, sy] = desgirar([SOMBRA_X, SOMBRA_Y], q)
  const b: Bote = {
    c,
    cena,
    k,
    q,
    luz: desgirar(LUZ, q),
    sombra: [sx * ALTURA_DA_BORDA, sy * ALTURA_DA_BORDA],
    em: (t) => k.popa + t * (k.proa - k.popa),
  }
  const meio = (k.popa + k.proa) / 2
  montarDentro(b)
  montarCorda(b)
  montarBalde(b, meio)
  montarBancos(b)
  montarRemos(b)
  montarBorda(b, meio)
}

/**
 * O bote. Na pegada mais alta que larga (esticado de pé) ele é montado deitado
 * e girado um quarto de volta, com a proa para baixo: o casco nunca sai gordo e
 * curto. O quarto de volta entra no giro de dentro, para a borda e a sombra das
 * paredes saberem onde fica a frente na tela.
 */
export const montarBote: MontarMovel = (c, cena) => {
  if (c.h <= c.w) {
    montarDeitado(c, cena)
    return
  }
  const tela: Cena = { partes: [], sombras: [] }
  montarDeitado({ ...c, w: c.h, h: c.w, hw: c.hh, hh: c.hw, giro: c.giro + 90 }, tela)
  // Girar um quarto de volta é desfazer três (`desgirarCena` desfaz o giro que a 3/4 aplica).
  desgirarCena(tela, 3, cena)
}
