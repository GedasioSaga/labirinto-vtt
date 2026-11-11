/**
 * FOLE de ferreiro de cima com volume (lote 10 dos objetos novos, 11/11/2026):
 * o fole grande que fica ao lado da fornalha, deitado num cavalete baixo. Duas
 * TÁBUAS em forma de pera (a de cima é a que aparece, de pranchas emendadas ao
 * comprido) com o COURO SANFONADO entre elas: de cima, as pregas são as voltas
 * claras e escuras que correm em volta da tábua, presas na beira dela por uma
 * fileira de TACHAS de latão. Na ponta estreita, a CABEÇA de madeira com a
 * cinta de ferro e o BICO de ferro, que afina até a boca e aponta para onde
 * ficaria a fornalha. Por cima, a ALAVANCA de madeira, com o cabo passando da
 * ponta larga, e a CORRENTE que desce dela até a argola da cinta da tábua.
 * Embaixo, as duas travessas do CAVALETE saem pelos dois lados.
 *
 * O que diz "fole" é o couro em pregas em volta da pera, mais o bico: sem as
 * pregas, a pera de madeira com o bico lia como uma pá ou uma raquete. A 25%
 * de zoom sobram a gota clara da tábua com a orla escura e listrada do couro,
 * o risco de ferro na ponta e os tocos do cavalete dos lados.
 *
 * Material: `madeira` (as tábuas, a cabeça, a alavanca e o cavalete). O couro,
 * o ferro e o latão das tachas são fixos. As medidas ao comprido são frações
 * da largura da pegada (1,5 x 0,7 casa de partida) e as de través, da altura:
 * o fole esticado fica mais comprido ou mais gordo; o que é redondo (as
 * tachas, os elos, o bico) sai do menor lado.
 */
import { anel, caixa, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, materialDaPeca, type MontarMovel } from './contexto'

// ---------- as medidas ----------

/** A meia pegada de partida (1,5 x 0,7 casa), em px do protótipo: o que é redondo escala pelo menor dos dois lados dela. */
const MEIA_LARGURA_DE_PARTIDA = 42
const MEIA_ALTURA_DE_PARTIDA = 19.6

/** A tábua em pera, ao comprido (frações da meia largura): da ponta larga, atrás, até a cabeça. */
const TABUA_DE = -0.84
const TABUA_ATE = 0.36
/** A meia largura da tábua no ponto mais largo, em fração da meia altura da pegada. */
const MEIA_TABUA = 0.52
/** O contorno da pera: [onde, de 0 (atrás) a 1 (na cabeça); a meia largura, em fração da maior]. Redonda atrás, afinando até a cabeça. */
const PERA: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.02, 0.4],
  [0.05, 0.62],
  [0.1, 0.82],
  [0.17, 0.94],
  [0.26, 0.995],
  [0.34, 1],
  [0.44, 0.97],
  [0.55, 0.89],
  [0.66, 0.78],
  [0.77, 0.66],
  [0.88, 0.54],
  [1, 0.44],
]
/** O couro passa da beira da tábua (fração da meia altura): tanto atrás e dos lados, quase nada junto da cabeça. */
const SOBRA_DO_COURO = 0.28
const SOBRA_DO_COURO_NA_CABECA = 0.06
/** Quão depressa a sobra encolhe para a cabeça (as pregas se juntam ali). */
const CURVA_DA_SOBRA = 1.6
/**
 * As PREGAS do couro, de fora para dentro: cada uma é uma volta da pera, com o chanfro e o contorno dela, e a
 * de dentro passa por cima da de fora. O tom de cada uma (a do meio é a crista que mais pega luz). Uma volta
 * só, com as pregas na textura, sumia: a 1x a orla virava um risco marrom liso.
 */
const TONS_DAS_PREGAS: readonly number[] = [0.88, 1.02, 0.94]
/** Dentro de cada volta: clara junto da de dentro, escura na beira de fora (a dobra que desce), mais o grão do couro. */
const LUZ_DA_DOBRA = 0.05
const ESCURO_DA_DOBRA = 0.16
const GRAO_DO_COURO = 0.05
/** O chanfro de cada volta e a sombra curta que a de dentro faz na de fora (px de partida). */
const CHANFRO_DA_PREGA = 1.5
const DEGRAU_DA_PREGA = 0.5

/** A cabeça: de onde a onde vai (frações da meia largura) e a meia largura atrás e na frente (frações da meia altura). */
const CABECA_DE = 0.3
const CABECA_ATE = 0.5
const MEIA_CABECA_ATRAS = 0.32
const MEIA_CABECA_NA_FRENTE = 0.25
/** A cinta de ferro da cabeça: a largura dela, na ponta da frente (fração da meia largura). */
const CINTA_DA_CABECA = 0.045
/** O bico: de onde a onde vai e o raio na base e na boca (px de partida, pelo menor lado). */
const BICO_DE = 0.49
const BICO_ATE = 0.965
const RAIO_DO_BICO = 3.3
const RAIO_DA_BOCA = 1.85
/** O anel de reforço do bico, logo depois da cabeça. */
const ANEL_DO_BICO = 0.52
const LARGURA_DO_ANEL = 1.8

/** As tachas de latão em volta da tábua: o passo, o recuo da beira e o raio (px de partida). */
const PASSO_DAS_TACHAS = 3.5
const RECUO_DAS_TACHAS = 1.05
const RAIO_DA_TACHA = 0.62

/** A cinta de ferro atravessada na tábua, perto da cabeça: onde fica e a largura (px de partida). */
const CINTA_DA_TABUA = 0.28
const LARGURA_DA_CINTA = 2.4

/** A alavanca: a ponta do cabo, atrás, e a ponta da frente, onde pende a corrente (frações da meia pegada). */
const PONTA_DO_CABO: readonly [number, number] = [-0.955, 0.02]
const PONTA_DA_ALAVANCA: readonly [number, number] = [0.08, -0.42]
/** Até onde vai o cabo (o fim da vara grossa), o raio da vara e o do cabo, e o da bola da ponta (px de partida). */
const FIM_DO_CABO = 0.13
const RAIO_DA_VARA = 1.9
const RAIO_DO_CABO = 1.45
const RAIO_DA_BOLA = 2
/** A alavanca é de madeira mais escura que a tábua (o óleo das mãos): assim ela se lê como peça solta, por cima. */
const TOM_DA_VARA = 0.8
const TOM_DO_CABO = 0.72
/** O passo da corrente e o elo deitado (os raios de fora e de dentro, ao comprido e de través), em px de partida. */
const PASSO_DA_CORRENTE = 2.6
const ELO_AO_COMPRIDO = 1.45
const ELO_DE_TRAVES = 1
const FURO_AO_COMPRIDO = 0.75
const FURO_DE_TRAVES = 0.38
/** O elo em pé, visto de cima: um risco do mesmo comprimento do deitado, com este raio. */
const RAIO_DO_ELO_EM_PE = 0.45

/** As duas travessas do cavalete: onde ficam (frações da meia largura), a meia largura delas e até onde saem (fração da meia altura). */
const TRAVESSAS: readonly number[] = [-0.5, 0.12]
const MEIA_TRAVESSA = 3.2
const PONTA_DA_TRAVESSA = 0.985
/** O quanto a travessa entra por baixo do couro (px), para não sobrar fresta. */
const TRAVESSA_POR_BAIXO = 1.5

/** Alturas em casas: o tampo do cavalete e a tábua de cima do fole. */
const ALTURA_DO_CAVALETE = 0.26
const ALTURA_DO_FOLE = 0.42

// ---------- os materiais fixos e a luz ----------

/** O couro do fole: castanho escuro e fosco (o mesmo do fole da fornalha). */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x4c, 0x38] }
/** O ferro do bico, das cintas e da corrente: o da tabela um pouco mais claro, para o brilho aparecer. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: [0x66, 0x69, 0x6c] }
/** O latão das tachas: o da tabela. */
const LATAO = materialDaPeca('latao')
/** A boca do bico, de frente para quem olha de cima: o aro mais claro. */
const TOM_DA_BOCA = 1.12

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/** Quanto a luz muda do lombo às beiras de uma peça redonda (a vara, o bico) e o brilho da faixa polida do ferro. */
const FORCA_NA_MADEIRA = 0.8
const FORCA_NO_FERRO = 0.62
const LUGAR_DO_REFLEXO = 0.38
const LARGURA_DO_REFLEXO = 0.16
const REFLEXO_DO_BICO = 52

const TEXTURA_DA_MADEIRA = texturaDaClasse('madeira')
const TEXTURA_DO_METAL = texturaDaClasse('metal')

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

// ---------- texturas ----------

/**
 * Uma PREGA do couro, a volta entre as frações `de` e `ate` da sobra: clara junto da volta de dentro e escura
 * na beira de fora, onde a dobra desce para a próxima.
 */
function texDaPrega(tabua: Forma, sobra: (x: number) => number, de: number, ate: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const t = limitar((tabua.d(x, y) / sobra(x) - de) / (ate - de), 0, 1)
    s[3] += LUZ_DA_DOBRA - ESCURO_DA_DOBRA * t * t + ruido(x * 0.45 + p.su, y * 0.45 + p.sv) * GRAO_DO_COURO
  }
}

/** Uma peça redonda deitada de A a B (a vara da alavanca): a luz de través, mais clara do lado que olha para a luz. */
function texDaVara(ax: number, ay: number, bx: number, by: number, r: number): Textura {
  const comp = Math.hypot(bx - ax, by - ay) || 1
  const nx = -(by - ay) / comp
  const ny = (bx - ax) / comp
  const paraALuz = nx * LUZ_X + ny * LUZ_Y
  return (u, v, x, y, p, s, escala) => {
    const q = limitar(((x - ax) * nx + (y - ay) * ny) / r, -1, 1)
    s[3] += FORCA_NA_MADEIRA * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (TEXTURA_DA_MADEIRA !== null) TEXTURA_DA_MADEIRA(u, v, x, y, p, s, escala)
  }
}

/** O bico: um cone deitado ao comprido, do raio `r0` em x0 ao `r1` em x1, com a faixa polida do lado da luz. */
function texDoBico(x0: number, x1: number, r0: number, r1: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    const r = r0 + (r1 - r0) * limitar((x - x0) / (x1 - x0), 0, 1)
    const q = limitar(y / r, -1, 1)
    s[3] += FORCA_NO_FERRO * (LUZ_Y * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    const polido = (q + LUGAR_DO_REFLEXO) / LARGURA_DO_REFLEXO
    const brilho = REFLEXO_DO_BICO * Math.exp(-polido * polido)
    s[0] += brilho
    s[1] += brilho
    s[2] += brilho
    if (TEXTURA_DO_METAL !== null) TEXTURA_DO_METAL(u, v, x, y, p, s, escala)
  }
}

// ---------- formas ----------

/** A meia largura da pera (fração da maior) em `s`, de 0 (atrás) a 1 (na cabeça). */
function peraEm(s: number): number {
  for (let i = 1; i < PERA.length; i += 1) {
    const [s1, f1] = PERA[i]
    if (s <= s1) {
      const [s0, f0] = PERA[i - 1]
      return f0 + ((f1 - f0) * (s - s0)) / (s1 - s0)
    }
  }
  return PERA[PERA.length - 1][1]
}

/**
 * Pontos a cada `passo` px ao longo do contorno fechado `pontos`, recuados `recuo` px para dentro da forma `f`
 * (as tachas em volta da tábua).
 */
function aoLongoDaBeira(pontos: readonly Ponto[], f: Forma, passo: number, recuo: number): Ponto[] {
  const saida: Ponto[] = []
  let falta = passo / 2
  for (let i = 0; i < pontos.length; i += 1) {
    const [ax, ay] = pontos[i]
    const [bx, by] = pontos[(i + 1) % pontos.length]
    const comp = Math.hypot(bx - ax, by - ay)
    if (comp <= 0) continue
    const ux = (bx - ax) / comp
    const uy = (by - ay) / comp
    let andado = falta
    while (andado <= comp) {
      const px = ax + ux * andado
      const py = ay + uy * andado
      // A normal que entra na forma: das duas, a que leva para mais fundo.
      const lado = f.d(px - uy * 0.5, py + ux * 0.5) < f.d(px + uy * 0.5, py - ux * 0.5) ? 1 : -1
      saida.push([px - uy * recuo * lado, py + ux * recuo * lado])
      andado += passo
    }
    falta = andado - comp
  }
  return saida
}

export const montarFole: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const k = Math.min(hw / MEIA_LARGURA_DE_PARTIDA, hh / MEIA_ALTURA_DE_PARTIDA)
  const X = (f: number): number => f * hw
  const Y = (f: number): number => f * hh
  const L = cena.partes

  // A TÁBUA em pera, de trás para a frente por cima e de volta por baixo.
  const xDe = X(TABUA_DE)
  const xAte = X(TABUA_ATE)
  const xDaPera = (s: number): number => xDe + s * (xAte - xDe)
  const meiaTabuaEm = (x: number): number => Y(MEIA_TABUA) * peraEm(limitar((x - xDe) / (xAte - xDe), 0, 1))
  const contornoDaTabua: Ponto[] = [
    ...PERA.map(([s, f]): Ponto => [xDaPera(s), -Y(MEIA_TABUA) * f]),
    ...PERA.slice(1).reverse().map(([s, f]): Ponto => [xDaPera(s), Y(MEIA_TABUA) * f]),
  ]
  const tabua = poligono(contornoDaTabua)
  // O COURO: a tábua engordada pela sobra, que encolhe até quase nada na cabeça.
  const sobraAtras = Y(SOBRA_DO_COURO)
  const sobraNaCabeca = Y(SOBRA_DO_COURO_NA_CABECA)
  const sobra = (x: number): number => sobraAtras + (sobraNaCabeca - sobraAtras) * Math.pow(limitar((x - xDe) / (xAte - xDe), 0, 1), CURVA_DA_SOBRA)
  /** A tábua engordada até a fração `ate` da sobra: a volta `ate` = 1 é o couro inteiro. */
  const ateA = (ate: number): Forma => ({
    b: [tabua.b[0] - sobraAtras * ate, tabua.b[1] - sobraAtras * ate, tabua.b[2] + sobraAtras * ate, tabua.b[3] + sobraAtras * ate],
    d: (x, y) => tabua.d(x, y) - sobra(x) * ate,
  })
  const couro = ateA(1)
  const cabeca = poligono([
    [X(CABECA_DE), -Y(MEIA_CABECA_ATRAS)],
    [X(CABECA_ATE), -Y(MEIA_CABECA_NA_FRENTE)],
    [X(CABECA_ATE), Y(MEIA_CABECA_NA_FRENTE)],
    [X(CABECA_DE), Y(MEIA_CABECA_ATRAS)],
  ])
  const xBico = X(BICO_DE)
  const xBoca = X(BICO_ATE)
  const r0 = RAIO_DO_BICO * k
  const r1 = RAIO_DA_BOCA * k
  const bico = uniao(poligono([[xBico, -r0], [xBoca, -r1], [xBoca, r1], [xBico, r0]]), elipse(xBoca, 0, r1 * 0.45, r1))
  // A alavanca, do cabo à ponta da frente.
  const [ax, ay] = [X(PONTA_DO_CABO[0]), Y(PONTA_DO_CABO[1])]
  const [bx, by] = [X(PONTA_DA_ALAVANCA[0]), Y(PONTA_DA_ALAVANCA[1])]
  const naAlavanca = (t: number): Ponto => [ax + (bx - ax) * t, ay + (by - ay) * t]
  const angAlavanca = Math.atan2(by - ay, bx - ax)
  const [cx, cy] = naAlavanca(FIM_DO_CABO)
  const alavanca = capsula(ax, ay, bx, by, RAIO_DA_BOLA * k)

  // As SOMBRAS: o fole é um tampo no ar, em cima das quatro pontas do cavalete (as colunas).
  cena.sombras.push({ forma: uniao(uniao(couro, cabeca), uniao(bico, alavanca)), z: g * ALTURA_DO_FOLE, solta: true, forca: 0.32 })

  // O CAVALETE: só as pontas das duas travessas aparecem, saindo de baixo do couro pelos dois lados.
  TRAVESSAS.forEach((f, i) => {
    const xt = X(f)
    const meia = MEIA_TRAVESSA * k
    const debaixo = meiaTabuaEm(xt) + sobra(xt) - TRAVESSA_POR_BAIXO
    for (const lado of [-1, 1]) {
      const [y0, y1] = lado < 0 ? [-Y(PONTA_DA_TRAVESSA), -debaixo] : [debaixo, Y(PONTA_DA_TRAVESSA)]
      const ponta = caixa(xt - meia, y0, xt + meia, y1, 0.8)
      cena.sombras.push({ forma: ponta, z: g * ALTURA_DO_CAVALETE }, contato(ponta, 0.28))
      L.push(P(ponta, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.8, contorno: 0.28, semente: 9001 + i * 2 + (lado + 1) / 2 }))
    }
  })

  // O COURO em pregas, de fora para dentro (cada volta passa por cima da de fora e faz um degrau de sombra
  // nela), a TÁBUA de pranchas por cima (faz sombra no couro) e as TACHAS em volta dela.
  const pregas = TONS_DAS_PREGAS.length
  TONS_DAS_PREGAS.forEach((tom, i) => {
    const ate = (pregas - i) / pregas
    const de = (pregas - i - 1) / pregas
    const degrau = i === 0 ? undefined : { dist: DEGRAU_DA_PREGA * k, forca: 0.26 }
    L.push(P(ateA(ate), COURO, { bisel: CHANFRO_DA_PREGA * k, tom, contorno: 0.32, textura: texDaPrega(tabua, sobra, de, ate), semente: 9010 + i, projeta: degrau }))
  })
  L.push(P(tabua, mad, { eixo: 0, tabua: 6.6 * k, bisel: 1, tom: 1.04, contorno: 0.28, semente: 9011, projeta: { dist: 1.1 * k, forca: 0.32 } }))
  const raioDaTacha = RAIO_DA_TACHA * k
  aoLongoDaBeira(contornoDaTabua, tabua, PASSO_DAS_TACHAS * k, RECUO_DAS_TACHAS * k).forEach(([tx, ty], i) => {
    L.push(P(elipse(tx, ty, raioDaTacha, raioDaTacha), LATAO, { bisel: raioDaTacha, tom: 1.04, contorno: 0.2, metal: 0.55, semente: 9100 + i, projeta: { dist: 0.4 * k, forca: 0.3 } }))
  })

  // A CABEÇA, com a cinta de ferro e os dois cravos; o BICO saindo dela, com o anel e a boca.
  L.push(P(cabeca, mad, { eixo: 0, tabua: 0, bisel: 1.2, tom: 0.8, contorno: 0.28, semente: 9020, projeta: { dist: 0.8 * k, forca: 0.28 } }))
  L.push(P(caixa(X(CABECA_ATE - CINTA_DA_CABECA), -Y(MEIA_CABECA_ATRAS) * 0.94, X(CABECA_ATE), Y(MEIA_CABECA_ATRAS) * 0.94, 0.5), FERRO, { tabua: 0, bisel: 0.7, tom: 0.98, contorno: 0.24, metal: 0.4, semente: 9021 }))
  const xCravo = X(CABECA_ATE - CINTA_DA_CABECA / 2)
  for (const lado of [-1, 1]) L.push(P(elipse(xCravo, lado * Y(MEIA_CABECA_ATRAS) * 0.55, 0.55 * k, 0.55 * k), FERRO, { bisel: 0.55 * k, tom: 1.25, contorno: 0.14, metal: 0.5, semente: 9022 }))
  L.push(P(bico, FERRO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.3, textura: texDoBico(xBico, xBoca, r0, r1), semente: 9023, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  const xAnel = X(ANEL_DO_BICO)
  L.push(P(caixa(xAnel, -r0 * 1.14, xAnel + LARGURA_DO_ANEL * k, r0 * 1.14, 0.5 * k), FERRO, { tabua: 0, bisel: 0.7, tom: 1.08, contorno: 0.26, metal: 0.45, textura: texDoBico(xBico, xBoca, r0 * 1.14, r1 * 1.14), semente: 9024 }))
  L.push(P(elipse(xBoca + r1 * 0.08, 0, r1 * 0.34, r1 * 0.96), FERRO, { tabua: 0, bisel: 0.5, tom: TOM_DA_BOCA, contorno: 0.3, metal: 0.4, semente: 9025 }))

  // A CINTA de ferro atravessada na tábua, com os cravos e a ARGOLA da corrente.
  const xCinta = X(CINTA_DA_TABUA)
  const meiaCinta = meiaTabuaEm(xCinta) + 0.4
  const larguraDaCinta = LARGURA_DA_CINTA * k
  L.push(P(caixa(xCinta - larguraDaCinta / 2, -meiaCinta, xCinta + larguraDaCinta / 2, meiaCinta, 0.5), FERRO, { tabua: 0, bisel: 0.6, tom: 0.95, contorno: 0.24, metal: 0.35, semente: 9030, projeta: { dist: 0.5 * k, forca: 0.26 } }))
  for (const f of [-0.62, 0.62]) L.push(P(elipse(xCinta, f * meiaCinta, 0.5 * k, 0.5 * k), FERRO, { bisel: 0.5 * k, tom: 1.25, contorno: 0.14, metal: 0.5, semente: 9031 }))
  const [rx, ry] = [xCinta - 0.9 * k, -0.9 * k]
  L.push(P(anel(rx, ry, 1.55 * k, 1.55 * k, 0.8 * k, 0.8 * k), FERRO, { bisel: 0.5 * k, tom: 1.1, contorno: 0.22, metal: 0.5, semente: 9032, projeta: { dist: 0.5 * k, forca: 0.3 } }))

  // A CORRENTE, da ponta da alavanca até a argola: um elo deitado (o aro) e um em pé (o risco), alternados.
  const dx = rx - bx
  const dy = ry - by
  const elos = Math.max(2, Math.round(Math.hypot(dx, dy) / (PASSO_DA_CORRENTE * k)))
  const angCorrente = Math.atan2(dy, dx)
  for (let i = 0; i < elos; i += 1) {
    const t = (i + 0.5) / elos
    const [ex, ey] = [bx + dx * t, by + dy * t]
    const meioDoRisco = (ELO_AO_COMPRIDO - RAIO_DO_ELO_EM_PE) * k
    const elo = i % 2 === 0
      ? menos(elipseGirada(ex, ey, ELO_AO_COMPRIDO * k, ELO_DE_TRAVES * k, angCorrente), elipseGirada(ex, ey, FURO_AO_COMPRIDO * k, FURO_DE_TRAVES * k, angCorrente))
      : capsula(ex - Math.cos(angCorrente) * meioDoRisco, ey - Math.sin(angCorrente) * meioDoRisco, ex + Math.cos(angCorrente) * meioDoRisco, ey + Math.sin(angCorrente) * meioDoRisco, RAIO_DO_ELO_EM_PE * k)
    L.push(P(elo, FERRO, { bisel: 0.45 * k, tom: 1.06, contorno: 0.22, metal: 0.5, semente: 9040 + i, projeta: { dist: 0.6 * k, forca: 0.3 } }))
  }

  // A ALAVANCA por cima de tudo: o cabo mais fino e gasto, com a bola na ponta e o colar, a vara e o olhal de ferro.
  const raioDaVara = RAIO_DA_VARA * k
  const [ox, oy] = naAlavanca(0.94)
  const sombraDaVara = { dist: 2.2 * k, forca: 0.34, suave: 1 }
  L.push(P(capsula(ax, ay, cx, cy, RAIO_DO_CABO * k), mad, { eixo: angAlavanca, tabua: 0, bisel: 0.6, tom: TOM_DO_CABO, contorno: 0.28, textura: texDaVara(ax, ay, cx, cy, RAIO_DO_CABO * k), semente: 9050, projeta: sombraDaVara }))
  L.push(P(elipse(ax, ay, RAIO_DA_BOLA * k, RAIO_DA_BOLA * k), mad, { tabua: 0, bisel: RAIO_DA_BOLA * k, tom: TOM_DA_VARA, contorno: 0.28, semente: 9051, projeta: sombraDaVara }))
  L.push(P(capsula(cx, cy, bx, by, raioDaVara), mad, { eixo: angAlavanca, tabua: 0, bisel: 0.6, tom: TOM_DA_VARA, contorno: 0.28, textura: texDaVara(cx, cy, bx, by, raioDaVara), semente: 9052, projeta: sombraDaVara }))
  L.push(P(elipseGirada(cx, cy, 0.9 * k, raioDaVara * 1.18, angAlavanca), mad, { tabua: 0, bisel: 0.7, tom: TOM_DO_CABO, contorno: 0.26, semente: 9053 }))
  L.push(P(elipseGirada(ox, oy, 0.8 * k, raioDaVara * 1.1, angAlavanca), FERRO, { tabua: 0, bisel: 0.6, tom: 1, contorno: 0.24, metal: 0.45, semente: 9054 }))
  L.push(P(anel(bx, by, 1.6 * k, 1.6 * k, 0.75 * k, 0.75 * k), FERRO, { bisel: 0.5 * k, tom: 1.1, contorno: 0.24, metal: 0.5, semente: 9055, projeta: { dist: 0.6 * k, forca: 0.3 } }))
}
