/**
 * MESA DE SINUCA de cima com volume (lote 11 dos objetos novos, 11/11/2026): a mesa de bilhar de taverna rica. A
 * MOLDURA de madeira escura envernizada, em meia-esquadria (o veio corre ao longo de cada borda), com as MARCAS de
 * madrepérola; as TABELAS de pano mais escuro; o PANO verde feltrado; as SEIS CAÇAPAS, com a boca forrada de couro e
 * a rede de couro lá no fundo; as quinze BOLAS ainda no TRIÂNGULO no pé da mesa e a BRANCA na cabeceira; dois TACOS
 * deitados no pano em diagonal e o CUBO DE GIZ na borda de trás. O pano e as caçapas são o que diz sinuca: o pano
 * ocupa quase toda a mesa, e a bola e a caçapa são um pouco maiores que as de verdade (no tamanho certo a bola teria
 * um pixel e meio no tamanho de mesa). Sem luz nem chama.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o tampo é um tampo solto na altura da mesa, e a beirada do perfil é a SAIA de
 * madeira (`ESPESSURA_DA_SAIA`, que TEM de ser a `espessuraEmCasas` do perfil: os pés e as redes contam com ela). Os
 * PÉS TORNEADOS, as REDES das caçapas da frente e o FRISO da saia só a 3/4 mostra: desenhados de pé na tela e
 * GUARDADOS debaixo do tampo na vista de cima. Os pés não sobem com nada (a caixa deles é centrada fora da mesa):
 * saem antes do tampo, e a saia tapa o alto deles. O friso e as redes são pinos baixos, com a vez logo depois do
 * tampo, e caem por cima da saia. Os pés de trás a própria mesa tapa, e não são desenhados.
 *
 * O GIRO: os pés, as redes, o friso, a sombra das tabelas no pano e a sombra e o brilho das bolas dependem da tela,
 * então são montados para o quarto de volta que a 3/4 pinta (`c.giro`); o resto é do objeto e gira com ele. Com um
 * quarto de volta a mesa fica de pé na tela e a frente é a cabeceira ou o pé: dois pés e as redes dos dois cantos.
 * Na vista de cima o giro chega 0 (a tela gira a imagem inteira).
 *
 * Materiais: `madeira` (a moldura, a saia e os pés). O pano, o couro, as bolas, os tacos e o giz são fixos.
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { barra, caixa, dentroDe, elipse, menos, uniao, type Caixa, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- medidas ----------

/** A altura do tampo e a da saia, em casas. A saia é a beirada do perfil da 3/4: os pés e as redes contam com ela. */
const ALTURA_DA_MESA = 0.5
const ESPESSURA_DA_SAIA = 0.13

/** A moldura, em fração da meia pegada (o resto é o ar e a sombra), e o raio da quina (px). */
const MEIA_LARGURA = 0.895
const MEIA_FUNDURA = 0.94
const RAIO_DA_QUINA = 1.6
/** A borda de madeira e a tabela de pano (px). */
const BORDA = 5
const TABELA = 1.5

/** As caçapas: o raio da boca no canto e no meio, quanto ela entra na borda e o couro em volta (px). */
const BOCA_DO_CANTO = 2.5
const BOCA_DO_MEIO = 2.3
const RECUO_DO_CANTO = 0.7
const RECUO_DO_MEIO = 1.5
const COURO_EM_VOLTA = 0.65
/** A rede de couro, no fundo da boca e pendurada na 3/4: o passo do losango e a meia largura da tira (px). */
const PASSO_DA_REDE = 1.5
const MEIA_TIRA = 0.22

/** As marcas de madrepérola: a meia diagonal ao longo e através da borda (px); três entre cada par de caçapas. */
const MARCA_AO_LONGO = 0.95
const MARCA_ATRAVES = 0.6
const MARCAS_NA_METADE: readonly number[] = [0.25, 0.5, 0.75]

/** A bola (px), a meia listra e o brilho (frações do raio), e a folga entre as bolas do triângulo (px). */
const BOLA = 1.2
const MEIA_LISTRA = 0.48
const BRILHO_LONGE = 0.38
const BRILHO_RAIO = 0.3
const FOLGA_DAS_BOLAS = 0.04
/** A bola da ponta do triângulo fica na marca do pé, e a branca perto da marca da cabeceira (frações da meia mesa de pano). */
const MARCA_DO_PE = 0.5
const BRANCA = { x: -0.53, y: -0.45 } as const
/** A ordem das bolas no triângulo, fileira por fileira, da ponta para o fundo: a 8 no meio, como se arma. */
const TRIANGULO: readonly (readonly number[])[] = [[1], [9, 2], [10, 8, 3], [11, 7, 14, 4], [5, 13, 15, 6, 12]]

/** Os tacos, da coronha à ponta, em fração da meia mesa de pano, e o raio na coronha e na ponta (px). */
const TACOS: readonly (readonly [number, number, number, number])[] = [
  [-0.92, 0.78, -0.02, -0.15],
  [-0.77, 0.93, 0.1, -0.25],
]
const RAIO_DA_CORONHA = 0.8
const RAIO_DA_PONTA = 0.36
/** As partes do taco, em fração do comprimento a partir da coronha (os anéis de madrepérola, só de perto). */
const TACO = { borracha: 0.025, coronha: 0.3, aneis: [0.07, 0.28], meioAnel: 0.008, punho: 0.44, junta: 0.47, virola: 0.975, sola: 0.99 } as const
/** O passo do trançado do punho, em fração do comprimento. */
const TRANCADO = 0.012

/** O giz: o lugar na borda de trás (fração da meia mesa de pano), o lado e o giro (px, radianos) e a cova gasta (px). */
const GIZ = { x: -0.62, lado: 1.9, giro: 0.35, cova: 0.62 } as const

/** As sombras no pano: o deslocamento da sombra da bola (fração do raio) e do taco e do giz (px), a força e a da tabela (px). */
const SOMBRA_DA_BOLA = 0.5
const SOMBRA_DO_TACO = 0.55
const FORCA_DA_SOMBRA = 0.34
const SOMBRA_DA_TABELA = 1.4

/** Os pés torneados (px): o recuo debaixo da quina, ao lado e ao fundo, e quanto a caixa deles fica fora da mesa. */
const RECUO_DO_PE = 4.5
const FUNDO_DO_PE = 4
const FORA_DOS_PES = 5
/** O friso e a rede da caçapa da frente na 3/4 (px abaixo da beira do tampo; a rede passa da saia). */
const FRISO = { de: 0.7, ate: 1.5 } as const
const REDE = { de: 0.35, abaixoDaSaia: 2.6, meiaLargura: 3, aro: 0.8 } as const
/** Os pinos do friso e das redes ficam esta folga abaixo da saia: assim o desenho deles, antes de subir, cai debaixo do tampo. */
const FOLGA_DOS_PINOS = 4
/** Onde caem os pinos (px fora da mesa): um ponto só de cada um. */
const FORA_DO_FRISO = 2
const FORA_DAS_REDES = 3

/** A vez na 3/4: o friso logo depois do tampo, as redes depois do friso. */
const VEZ_DO_FRISO = 0.01
const VEZ_DAS_REDES = 0.02
/** Meia largura do pino (px): só o meio exato da caixa de uma peça cai nele. */
const MEIO_PINO = 0.001

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

// ---------- as cores ----------

/** O pano verde de bilhar, contido (saturação 0,44), e a tabela, mais escura. */
const PANO: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x7c, 0x58] }
const TABELA_DE_PANO: MaterialDaPeca = { classe: 'liso', rgb: [0x38, 0x68, 0x4a] }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x40, 0x2c] }
const FUNDO_DA_CACAPA: MaterialDaPeca = { classe: 'liso', rgb: [0x19, 0x14, 0x11] }
const TIRA_DA_REDE: Rgb = [0x7a, 0x58, 0x3a]
const MADREPEROLA: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xe0, 0xd2] }
const ROSADO: Rgb = [0xec, 0xd6, 0xda]
const ESVERDEADO: Rgb = [0xd2, 0xe6, 0xde]
const MARFIM: Rgb = [0xec, 0xe6, 0xd6]
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf6, 0xf4, 0xee] }
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x14, 0x1c, 0x16] }
/** As bolas 1 a 8 (da 9 à 15 são as mesmas, listradas), contidas: nenhuma passa de 0,62 de saturação. */
const CORES_DAS_BOLAS: readonly Rgb[] = [
  [0xc0, 0xa2, 0x56],
  [0x3c, 0x56, 0x88],
  [0x9a, 0x4a, 0x40],
  [0x5e, 0x48, 0x78],
  [0xb4, 0x78, 0x4c],
  [0x2e, 0x5e, 0x4a],
  [0x70, 0x34, 0x2e],
  [0x26, 0x24, 0x22],
]
const BORRACHA: Rgb = [0x22, 0x1e, 0x1c]
const EBANO: Rgb = [0x3a, 0x2a, 0x24]
const LINHO_DO_PUNHO: Rgb = [0xb8, 0xa8, 0x8a]
const LATAO: Rgb = [0xb0, 0x92, 0x54]
const BORDO: Rgb = [0xd6, 0xc0, 0x94]
const SOLA: Rgb = [0x5a, 0x6a, 0x80]
const GIZ_AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x56, 0x70, 0x8e] }

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** A distância até a origem: `Math.hypot` é bem mais lento, e as texturas a pedem em cada pixel. */
function distancia(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

/** A cobertura de uma linha de meia largura `meia` a `d` px do meio dela, já com a borda de um pixel. */
function naLinha(meia: number, d: number, escala: number): number {
  return limitar01((meia - d) * escala + 0.5)
}

/** Losango de meias diagonais `a` (em x) e `b` (em y); a distância é aproximada, o que basta para uma marca miúda. */
function losango(cx: number, cy: number, a: number, b: number): Forma {
  const k = Math.min(a, b)
  return { b: [cx - a, cy - b, cx + a, cy + b], d: (x, y) => (Math.abs(x - cx) / a + Math.abs(y - cy) / b - 1) * k }
}

/** O taco: de (ax, ay) na coronha a (bx, by) na ponta, afinando, com as duas pontas redondas. */
function formaDoTaco(ax: number, ay: number, bx: number, by: number): Forma {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const m = RAIO_DA_CORONHA
  return {
    b: [Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m],
    d: (x, y) => {
      const t = limitar01(((x - ax) * dx + (y - ay) * dy) / l2)
      return distancia(x - ax - dx * t, y - ay - dy * t) - (RAIO_DA_CORONHA + (RAIO_DA_PONTA - RAIO_DA_CORONHA) * t)
    },
  }
}

// ---------- o giro ----------

type Quartos = 0 | 1 | 2 | 3

/** Os quartos de volta do giro que a 3/4 pinta (na vista de cima chega 0: a tela gira a imagem). */
function quartosDoGiro(giro: number): Quartos {
  return (((Math.round(giro / 90) % 4) + 4) % 4) as Quartos
}

/** O ponto (ou a direção) da tela no referencial do objeto: o contrário do giro da 3/4 (`girarCena`). */
function noObjeto(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

/** O ponto do objeto na tela: o giro da 3/4. */
function naTela(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

function caixaNoObjeto(b: Caixa, q: Quartos): Caixa {
  return q === 1 ? [b[1], -b[2], b[3], -b[0]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : q === 3 ? [-b[3], b[0], -b[1], b[2]] : b
}

/** A forma da tela no referencial do objeto: o ponto do objeto é girado para a tela e lido lá. */
function formaNoObjeto(f: Forma, q: Quartos): Forma {
  const b = caixaNoObjeto(f.b, q)
  if (q === 1) return { b, d: (x, y) => f.d(-y, x) }
  if (q === 2) return { b, d: (x, y) => f.d(-x, -y) }
  if (q === 3) return { b, d: (x, y) => f.d(y, -x) }
  return f
}

/** A peça da tela no referencial do objeto; a textura própria continua lendo o ponto da tela. */
function pecaNoObjeto(p: Peca, q: Quartos): Peca {
  if (q === 0) return p
  const [dx, dy] = noObjeto(p.dx, p.dy, q)
  const tex = p.tex
  const doObjeto: Textura | null =
    tex === null
      ? null
      : q === 1
        ? (u, v, x, y, _doObjeto, s, escala) => tex(u, v, -y, x, p, s, escala)
        : q === 2
          ? (u, v, x, y, _doObjeto, s, escala) => tex(u, v, -x, -y, p, s, escala)
          : (u, v, x, y, _doObjeto, s, escala) => tex(u, v, y, -x, p, s, escala)
  return { ...p, forma: formaNoObjeto(p.forma, q), dx, dy, eixo: p.eixo - q * QUARTO, tex: doObjeto }
}

/** Leva para `cena`, no referencial do objeto, o que foi montado na tela. */
function cenaNoObjeto(tela: Cena, q: Quartos, cena: Cena): void {
  for (const p of tela.partes) cena.partes.push(pecaNoObjeto(p, q))
  for (const s of tela.sombras) cena.sombras.push(q === 0 ? s : { ...s, forma: formaNoObjeto(s.forma, q) })
}

// ---------- a vez na 3/4 ----------

/** Um PINO: a estrutura da 3/4 do tamanho de um ponto; só a peça com o meio da caixa em (x, y) sobe com ele. */
function pino(x: number, y: number, base: number): Forma {
  return {
    b: [x - MEIO_PINO, Math.min(y, base) - MEIO_PINO, x + MEIO_PINO, base],
    d: (px, py) => (Math.abs(px - x) <= MEIO_PINO && Math.abs(py - y) <= MEIO_PINO ? -MEIO_PINO : 1),
  }
}

/** A mesma forma com a caixa de pintura espelhada em volta de (mx, my): o desenho não muda, e o meio da caixa cai ali. */
function centrada(f: Forma, mx: number, my: number): Forma {
  const ax = Math.max(Math.abs(f.b[0] - mx), Math.abs(f.b[2] - mx))
  const ay = Math.max(Math.abs(f.b[1] - my), Math.abs(f.b[3] - my))
  return { b: [mx - ax, my - ay, mx + ax, my + ay], d: f.d }
}

// ---------- a geometria ----------

/** As meias medidas da moldura (E), da beira da tabela (R) e do pano em que a bola corre (B). */
interface Mesa {
  readonly xE: number
  readonly yE: number
  readonly xR: number
  readonly yR: number
  readonly xB: number
  readonly yB: number
}

function mesaDe(c: ContextoDoMovel): Mesa {
  const xE = MEIA_LARGURA * c.hw
  const yE = MEIA_FUNDURA * c.hh
  return { xE, yE, xR: xE - BORDA, yR: yE - BORDA, xB: xE - BORDA - TABELA, yB: yE - BORDA - TABELA }
}

/** A mesa na tela com um quarto de volta: de pé. */
function deitada(m: Mesa): Mesa {
  return { xE: m.yE, yE: m.xE, xR: m.yR, yR: m.xR, xB: m.yB, yB: m.xB }
}

// ---------- o tampo: a moldura, as tabelas, o pano, as caçapas e as marcas ----------

/** A moldura em meia-esquadria: nas bordas da cabeceira e do pé o veio corre de pé (a madeira com u e v trocados). */
function texDaMoldura(m: Mesa): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    const ax = Math.abs(x) - m.xR
    const ay = Math.abs(y) - m.yR
    if (madeira !== null) {
      if (ax > ay) madeira(v, u, x, y, p, s, escala)
      else madeira(u, v, x, y, p, s, escala)
    }
    // A emenda da esquadria, do canto da tabela ao canto da moldura.
    if (ax > -0.5 && ay > -0.5 && escala >= ESCALA_DO_DETALHE) s[3] -= 0.14 * naLinha(0.16, Math.abs(ax - ay) * Math.SQRT1_2, escala)
  }
}

/**
 * O pano: o feltro (o pelo miúdo e o mosqueado largo, sem trama), a sombra das tabelas de cima e da esquerda NA
 * TELA (a luz vem de lá) e as duas marcas de marfim, a da cabeceira e a do pé (esta debaixo da bola da ponta).
 */
function texDoPano(m: Mesa, ms: Mesa, q: Quartos): Textura {
  const marca = MARCA_DO_PE * m.xB
  return (_u, _v, x, y, _p, s, escala) => {
    s[3] += ruido(x * 0.9 + 3.1, y * 0.9 + 7.7) * (escala >= ESCALA_DO_DETALHE ? 0.04 : 0.015) + ruido(x * 0.1 + 11.3, y * 0.1 + 2.9) * 0.06
    const [tx, ty] = naTela(x, y, q)
    const perto = Math.min(tx + ms.xB, ty + ms.yB)
    if (perto < SOMBRA_DA_TABELA) s[3] -= 0.16 * (1 - perto / SOMBRA_DA_TABELA)
    const dm = distancia(Math.abs(x) - marca, y)
    if (dm < 1) misturarEm(s, MARFIM, 0.8 * naLinha(0.35, dm, escala))
  }
}

/** A boca da caçapa: o escuro do fundo e a rede de couro em losango, que pega luz perto da boca e some no fundo. */
function texDaCacapa(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const dx = x - cx
    const dy = y - cy
    const fundo = limitar01(distancia(dx, dy) / r)
    if (escala >= ESCALA_DO_DETALHE) {
      const a = (dx + dy) / PASSO_DA_REDE
      const b = (dx - dy) / PASSO_DA_REDE
      const tira = Math.max(naLinha(MEIA_TIRA, Math.abs(a - Math.round(a)) * PASSO_DA_REDE, escala), naLinha(MEIA_TIRA, Math.abs(b - Math.round(b)) * PASSO_DA_REDE, escala))
      misturarEm(s, TIRA_DA_REDE, tira * (0.3 + 0.5 * fundo))
    }
    s[3] -= 0.22 * (1 - fundo)
  }
}

/** O brilho de madrepérola: um quase nada de rosa e de verde, mudando de um ponto a outro. */
const texDaMadreperola: Textura = (_u, _v, x, y, _p, s) => {
  const t = ruido(x * 1.3 + 5.5, y * 1.3 + 1.7)
  misturarEm(s, t > 0 ? ROSADO : ESVERDEADO, Math.abs(t))
  s[3] += 0.06
}

function montarTampo(c: ContextoDoMovel, cena: Cena, m: Mesa, ms: Mesa, q: Quartos): void {
  const { peca: P } = c
  const L = cena.partes
  const mad = c.m.madeira
  L.push(P(caixa(-m.xE, -m.yE, m.xE, m.yE, RAIO_DA_QUINA), mad, { tabua: 0, bisel: 1.4, contorno: 0.3, tom: 0.9, metal: 0.12, textura: texDaMoldura(m), semente: 8001 }))
  L.push(P(menos(caixa(-m.xR, -m.yR, m.xR, m.yR), caixa(-m.xB, -m.yB, m.xB, m.yB)), TABELA_DE_PANO, { bisel: 0.9, contorno: 0.22, semente: 8002 }))
  L.push(P(caixa(-m.xB, -m.yB, m.xB, m.yB), PANO, { bisel: 0, contorno: 0, textura: texDoPano(m, ms, q), semente: 8003 }))
  // As caçapas: as quatro dos cantos e as duas do meio das bordas compridas.
  const bocas: (readonly [number, number, number])[] = [[0, -(m.yB + RECUO_DO_MEIO), BOCA_DO_MEIO], [0, m.yB + RECUO_DO_MEIO, BOCA_DO_MEIO]]
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) bocas.push([sx * (m.xB + RECUO_DO_CANTO), sy * (m.yB + RECUO_DO_CANTO), BOCA_DO_CANTO])
  bocas.forEach(([x, y, r], i) => {
    L.push(P(elipse(x, y, r + COURO_EM_VOLTA, r + COURO_EM_VOLTA), COURO, { bisel: 0.6, contorno: 0.25, semente: 8010 + i }))
    L.push(P(elipse(x, y, r, r), FUNDO_DA_CACAPA, { bisel: 0, contorno: 0.3, textura: texDaCacapa(x, y, r), semente: 8020 + i }))
  })
  // As marcas: três entre cada par de caçapas, no meio da borda.
  const meioDaBordaX = m.xR + BORDA / 2
  const meioDaBordaY = m.yR + BORDA / 2
  let semente = 8030
  for (const f of MARCAS_NA_METADE) {
    for (const lado of [-1, 1]) {
      for (const sy of [-1, 1]) L.push(P(losango(lado * f * m.xB, sy * meioDaBordaY, MARCA_AO_LONGO, MARCA_ATRAVES), MADREPEROLA, { bisel: 0.45, contorno: 0.22, textura: texDaMadreperola, semente: semente++ }))
      L.push(P(losango(lado * meioDaBordaX, (2 * f - 1) * m.yB, MARCA_ATRAVES, MARCA_AO_LONGO), MADREPEROLA, { bisel: 0.45, contorno: 0.22, textura: texDaMadreperola, semente: semente++ }))
    }
  }
}

// ---------- as bolas, os tacos e o giz ----------

/** A bola listrada: a faixa da cor dela atravessando o marfim, cada uma num giro. */
function texDaListra(cx: number, cy: number, cor: Rgb, angulo: number): Textura {
  const co = Math.cos(angulo)
  const si = Math.sin(angulo)
  return (_u, _v, x, y, _p, s, escala) => {
    misturarEm(s, cor, naLinha(MEIA_LISTRA * BOLA, Math.abs(-(x - cx) * si + (y - cy) * co), escala))
  }
}

/** A sombra que cai no pano: a direção de baixo à direita NA TELA, no referencial do objeto, já unitária. */
function direcaoDaSombra(q: Quartos): [number, number] {
  const [x, y] = noObjeto(SOMBRA_X, SOMBRA_Y, q)
  const l = distancia(x, y)
  return [x / l, y / l]
}

function montarBolas(c: ContextoDoMovel, cena: Cena, m: Mesa, q: Quartos): void {
  const { peca: P } = c
  const L = cena.partes
  const [ox, oy] = direcaoDaSombra(q)
  const [bx, by] = noObjeto(-BRILHO_LONGE * BOLA, -BRILHO_LONGE * BOLA, q)
  const passo = 2 * BOLA + FOLGA_DAS_BOLAS
  const triangulo: (readonly [number, number, number])[] = []
  TRIANGULO.forEach((fileira, k) => {
    fileira.forEach((n, j) => triangulo.push([MARCA_DO_PE * m.xB + k * passo * Math.cos(Math.PI / 6), (j - k / 2) * passo, n]))
  })
  const branca: readonly [number, number, number] = [BRANCA.x * m.xB, BRANCA.y * m.yB, 0]
  const sombraDe = (bolas: readonly (readonly [number, number, number])[]): Forma =>
    bolas.map(([x, y]) => elipse(x + ox * SOMBRA_DA_BOLA * BOLA, y + oy * SOMBRA_DA_BOLA * BOLA, BOLA, BOLA)).reduce((a, b) => uniao(a, b))
  L.push(P(sombraDe(triangulo), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA, suave: 0.5 }))
  L.push(P(sombraDe([branca]), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA, suave: 0.5 }))
  ;[...triangulo, branca].forEach(([x, y, n], i) => {
    const forma = elipse(x, y, BOLA, BOLA)
    const opcoes = { bisel: BOLA, contorno: 0.32, semente: 8100 + i }
    if (n === 0 || n > CORES_DAS_BOLAS.length) {
      const listra = n === 0 ? undefined : texDaListra(x, y, CORES_DAS_BOLAS[n - 1 - CORES_DAS_BOLAS.length], hash(n, 3, 8131) * Math.PI)
      L.push(P(forma, { classe: 'liso', rgb: MARFIM }, listra === undefined ? opcoes : { ...opcoes, textura: listra }))
    } else {
      L.push(P(forma, { classe: 'liso', rgb: CORES_DAS_BOLAS[n - 1] }, opcoes))
    }
    L.push(P(elipse(x + bx, y + by, BRILHO_RAIO * BOLA, BRILHO_RAIO * BOLA), BRILHO, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.2 }))
  })
}

/** O taco por partes, da coronha à ponta: a borracha, o ébano com dois anéis de madrepérola, o punho trançado, a junta de latão, o bordo, a virola e a sola com giz. */
function texDoTaco(ax: number, ay: number, bx: number, by: number): Textura {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  return (_u, _v, x, y, _p, s, escala) => {
    const t = limitar01(((x - ax) * dx + (y - ay) * dy) / l2)
    let cor: Rgb = BORDO
    if (t < TACO.borracha) cor = BORRACHA
    else if (t < TACO.coronha) {
      const anel = escala >= ESCALA_DO_DETALHE && TACO.aneis.some((a) => Math.abs(t - a) < TACO.meioAnel)
      cor = anel ? MADREPEROLA.rgb : EBANO
    } else if (t < TACO.punho) {
      cor = LINHO_DO_PUNHO
      if (escala >= ESCALA_DO_DETALHE) {
        const f = t / TRANCADO
        s[3] -= 0.1 * naLinha(0.18, Math.abs(f - Math.round(f)) * TRANCADO * Math.sqrt(l2), escala)
      }
    } else if (t < TACO.junta) cor = LATAO
    else if (t >= TACO.sola) cor = SOLA
    else if (t >= TACO.virola) cor = MARFIM
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
  }
}

function montarTacosEGiz(c: ContextoDoMovel, cena: Cena, m: Mesa, q: Quartos): void {
  const { peca: P } = c
  const L = cena.partes
  const [ox, oy] = direcaoDaSombra(q)
  // O giz, na borda de trás: um cubo azul com a cova gasta em cima.
  const gx = GIZ.x * m.xB
  const gy = -(m.yR + BORDA / 2)
  const meio = GIZ.lado / 2
  const co = Math.cos(GIZ.giro)
  const si = Math.sin(GIZ.giro)
  const giz = (dx: number, dy: number): Forma => barra(gx - co * meio + dx, gy - si * meio + dy, gx + co * meio + dx, gy + si * meio + dy, GIZ.lado)
  L.push(P(giz(ox * SOMBRA_DO_TACO, oy * SOMBRA_DO_TACO), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA, suave: 0.5 }))
  L.push(
    P(giz(0, 0), GIZ_AZUL, {
      bisel: 0.4,
      contorno: 0.3,
      textura: (_u, _v, x, y, _p, s) => {
        s[3] -= 0.2 * (1 - limitar01(distancia(x - gx, y - gy) / GIZ.cova))
      },
      semente: 8200,
    }),
  )
  // Os tacos deitados no pano, com a sombra fina deles.
  TACOS.forEach(([fa, ga, fb, gb], i) => {
    const ax = fa * m.xB
    const ay = ga * m.yB
    const bx = fb * m.xB
    const by = gb * m.yB
    const sd = SOMBRA_DO_TACO
    L.push(P(formaDoTaco(ax + ox * sd, ay + oy * sd, bx + ox * sd, by + oy * sd), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA, suave: 0.45 }))
    L.push(P(formaDoTaco(ax, ay, bx, by), { classe: 'liso', rgb: BORDO }, { bisel: 0.55, contorno: 0.3, textura: texDoTaco(ax, ay, bx, by), semente: 8210 + i }))
  })
}

// ---------- os pés, o friso e as redes (só a 3/4 mostra) ----------

/** O pé torneado de pé na tela, do pé em (lx, yPe) até `alto` acima: o bloco, o pescoço, o bojo, o anel e a sapata. */
function peTorneado(lx: number, yPe: number, alto: number): Forma {
  const y = (t: number): number => yPe - alto + t * alto
  const partes: Forma[] = [
    caixa(lx - 2.7, y(0), lx + 2.7, y(0.13), 0.3),
    caixa(lx - 1.7, y(0.1), lx + 1.7, y(0.26)),
    elipse(lx, y(0.42), 3.3, 0.2 * alto),
    caixa(lx - 1.5, y(0.58), lx + 1.5, y(0.86)),
    elipse(lx, y(0.75), 2.0, 0.045 * alto),
    elipse(lx, y(0.9), 2.3, 0.075 * alto),
    caixa(lx - 1.9, y(0.9), lx + 1.9, y(1), 0.4),
  ]
  return partes.reduce((a, b) => uniao(a, b))
}

/** A madeira do pé com o brilho do torneado: de pé, um pouco à esquerda do meio (a luz vem de lá); a direita escurece. */
function texDoPe(lx: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const k = (x - lx) / 2.6
    s[3] += 0.1 * (1 - limitar01(Math.abs(k + 0.3) / 0.45)) - 0.08 * limitar01(k)
  }
}

/** A rede pendurada: o escuro da bolsa, as tiras de couro em losango e o aro de couro da boca, em cima. */
function texDaRede(cx: number, topo: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const a = (x - cx + y) / PASSO_DA_REDE
    const b = (x - cx - y) / PASSO_DA_REDE
    const tira =
      escala >= ESCALA_DO_DETALHE
        ? Math.max(naLinha(MEIA_TIRA, Math.abs(a - Math.round(a)) * PASSO_DA_REDE, escala), naLinha(MEIA_TIRA, Math.abs(b - Math.round(b)) * PASSO_DA_REDE, escala))
        : 0.45
    misturarEm(s, FUNDO_DA_CACAPA.rgb, 1 - tira)
    if (y - topo < REDE.aro) {
      misturarEm(s, COURO.rgb, 1)
      s[3] += 0.06
    }
  }
}

/**
 * Os pés da frente (e o do meio, quando a borda comprida está de frente), o friso da saia e as redes das caçapas
 * da frente, de pé na tela. Cada peça fica, antes de subir, debaixo do tampo: a vista de cima não as vê.
 */
function montarPesERedes(c: ContextoDoMovel, tela: Cena, ms: Mesa, q: Quartos): void {
  const { g, peca: P } = c
  const mad = c.m.madeira
  const zMesa = ALTURA_DA_MESA * g
  const saia = ESPESSURA_DA_SAIA * g
  const deFrenteAComprida = q % 2 === 0
  const yPe = ms.yE - FUNDO_DO_PE
  const pes = [-(ms.xE - RECUO_DO_PE), ms.xE - RECUO_DO_PE]
  if (deFrenteAComprida) pes.push(0)
  pes.forEach((lx, i) => {
    tela.partes.push(
      P(centrada(peTorneado(lx, yPe, zMesa - saia), lx, ms.yE + FORA_DOS_PES), mad, { eixo: QUARTO, tabua: 0, bisel: 1.4, contorno: 0.26, tom: 0.88, metal: 0.1, textura: texDoPe(lx), semente: 8300 + i }),
    )
    tela.sombras.push(contato(elipse(lx, yPe, 2.6, 0.9), 0.4))
  })
  // A beira do tampo na tela, já na 3/4, e o quanto os pinos baixos sobem.
  const beira = ms.yE - zMesa
  const zPinos = zMesa - saia - FOLGA_DOS_PINOS
  const friso = caixa(-ms.xE + 1, beira + FRISO.de + zPinos, ms.xE - 1, beira + FRISO.ate + zPinos)
  tela.sombras.push({ forma: pino(0.5, ms.yE + FORA_DO_FRISO, ms.yE + VEZ_DO_FRISO), z: zPinos, solta: true, forca: 0 })
  tela.partes.push(P(centrada(friso, 0.5, ms.yE + FORA_DO_FRISO), mad, { tabua: 0, bisel: 0.45, contorno: 0.2, tom: 1.12, metal: 0.1, semente: 8320 }))
  const bocas = [-(ms.xB + RECUO_DO_CANTO), ms.xB + RECUO_DO_CANTO]
  if (deFrenteAComprida) bocas.push(0)
  bocas.forEach((nx, i) => {
    const de = beira + REDE.de + zPinos
    const ate = beira + saia + REDE.abaixoDaSaia + zPinos
    const bolsa = dentroDe(elipse(nx, de, REDE.meiaLargura, ate - de), caixa(nx - REDE.meiaLargura, de, nx + REDE.meiaLargura, ate))
    tela.sombras.push({ forma: pino(nx, ms.yE + FORA_DAS_REDES, ms.yE + VEZ_DAS_REDES), z: zPinos, solta: true, forca: 0 })
    tela.partes.push(P(centrada(bolsa, nx, ms.yE + FORA_DAS_REDES), COURO, { bisel: 1.2, contorno: 0.3, textura: texDaRede(nx, de), semente: 8330 + i }))
  })
}

// ---------- a mesa ----------

export const montarMesaDeSinuca: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const m = mesaDe(c)
  const ms = q % 2 === 1 ? deitada(m) : m
  // Primeiro o que a vista de cima não vê: os pés, o friso e as redes, guardados debaixo do tampo.
  const tela: Cena = { partes: [], sombras: [] }
  montarPesERedes(c, tela, ms, q)
  cenaNoObjeto(tela, q, cena)
  // O tampo solto e a sombra dele no chão; e o escuro debaixo da mesa, que a 3/4 mostra entre os pés.
  cena.sombras.push(
    { forma: caixa(-m.xE, -m.yE, m.xE, m.yE, RAIO_DA_QUINA), z: ALTURA_DA_MESA * c.g, solta: true },
    { forma: caixa(-m.xE + 2, -m.yE + 2, m.xE - 2, m.yE - 1, 2), z: 0, suave: 2.6, forca: 0.3 },
  )
  montarTampo(c, cena, m, ms, q)
  montarTacosEGiz(c, cena, m, q)
  montarBolas(c, cena, m, q)
}
