/**
 * CRÂNIO (lote 17 dos objetos novos, 12/11/2026; grupo Destroços e sucata, junto dos ossos; pedido do mestre:
 * "Outro objeto cranio"): um crânio velho de masmorra, sozinho no chão, com a MANDÍBULA solta caída ao lado.
 * Sem sangue e sem carne: só o osso, de cenário de aventura.
 *
 * DESENHADO DE FRENTE nas duas vistas, como a lápide (perfil `EM_PE`), visto um pouco de cima e um nada de lado
 * (a cara vira um tico para a direita: a órbita de lá sai mais estreita, a maçã do rosto menor e os dentes mais
 * finos). Do alto, um crânio é um ovo claro e não diz nada; o que diz "crânio" é a cara: a CÚPULA grande e
 * redonda em cima, as duas ÓRBITAS escuras e fundas (com a beira de cima clara, o osso da sobrancelha), o NARIZ
 * em pera de cabeça para baixo, as MAÇÃS DO ROSTO saltadas e a fileira de DENTES de cima (falta um) na faixa
 * escura da boca. Na cúpula, as SUTURAS finas (quase somem a 1x) e uma RACHADURA em zigue-zague na testa, com a
 * beira clara. O osso é o marfim velho dos ossos (`ossos.ts`: a mesma cor, o mesmo grão e as mesmas manchas),
 * mais sujo embaixo, onde ele encosta no chão. A MANDÍBULA, em U com os dois côndilos, caiu à esquerda, na
 * frente: o pé dela fica quase na altura do pé do crânio, e a sombra de baixo da 3/4 cai debaixo dos dois.
 *
 * A luz é a de sempre (de cima à esquerda): o bisel largo arredonda a cúpula e a cara escurece um pouco para
 * baixo (a cúpula vira para a luz, a frente do osso vira para quem olha). A sombra no chão sai da base do crânio
 * e da mandíbula, curta, para baixo à direita. O giro deita a imagem inteira, como na lápide.
 *
 * O desenho é feito em 28 x 28 px (meia casa) e cresce pelo menor lado da pegada, centrado: esticado, o crânio
 * continua redondo. Sem material no painel: não existe osso na tabela, a cor é fixa (a dos ossos).
 */
import type { Rgb } from '../../ruido'
import { cadeia, caixa, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

/** O lado do desenho (px do protótipo): meia casa. */
const LADO_DO_DESENHO = 28

// ---------- as cores (fixas, as dos ossos) ----------

/** O osso velho: marfim amarelado, e a mancha de terra e de tempo que ele pega. */
const TOM_DO_OSSO: Rgb = [0xd2, 0xc6, 0xaa]
const MANCHA_DO_OSSO: Rgb = [0xa8, 0x93, 0x70]
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_OSSO }
/** O escuro de dentro das órbitas, do nariz, da boca e da rachadura. */
const OCO: MaterialDaPeca = { classe: 'liso', rgb: [0x54, 0x47, 0x3a] }
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): o pardo acinzentado dos ossos. Com o escuro
 * de sempre (o da nogueira), a beira do osso na sombra saía avermelhada.
 */
const ESCURO_DO_OSSO: Rgb = [0x4a, 0x42, 0x3a]

// ---------- o osso ----------

/** A partir de quanto o ruído vira mancha no osso, a largura da passagem e o quanto a mancha cobre no miolo. */
const LIMIAR_DA_MANCHA = 0.06
const BEIRA_DA_MANCHA = 0.22
const MANCHA_CHEIA = 0.45
/** A sujeira a mais no pé do crânio (onde ele encosta no chão): de onde até onde (y do desenho) e o quanto. */
const SUJO_DE = 2
const SUJO_ATE = 9.5
const SUJO_A_MAIS = 0.28
/** A luz da cúpula para a cara: o quanto clareia no alto e escurece no pé (luz somada), entre estes y do desenho. */
const LUZ_DA_CUPULA = 0.05
const SOMBRA_DA_CARA = 0.07
const ALTO_DA_CUPULA = -12
const PE_DA_CARA = 9.5

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave(a: number, b: number, t: number): number {
  const u = limitar((t - a) / (b - a), 0, 1)
  return u * u * (3 - 2 * u)
}

/**
 * O osso: o grão miúdo (em px, como nos ossos) e as manchas de tempo (no desenho: o crânio maior tem as mesmas
 * manchas, maiores). `comCara` = a peça do crânio: a luz cai da cúpula para a cara e o pé fica mais sujo.
 */
function texDoOsso(k: number, comCara: boolean): Textura {
  return (_u, _v, x, y, p, s) => {
    s[3] += ruido(x * 0.33 + p.su, y * 0.33 + p.sv) * 0.07 + ruido(x * 1.2 + p.sv, y * 1.2) * 0.03
    const xd = x / k
    const yd = y / k
    let suja = ruido(xd * 0.12 + p.sv, yd * 0.12 + p.su)
    if (comCara) {
      const desce = limitar((yd - ALTO_DA_CUPULA) / (PE_DA_CARA - ALTO_DA_CUPULA), 0, 1)
      s[3] += LUZ_DA_CUPULA - (LUZ_DA_CUPULA + SOMBRA_DA_CARA) * desce
      suja += suave(SUJO_DE, SUJO_ATE, yd) * SUJO_A_MAIS
    }
    if (suja <= LIMIAR_DA_MANCHA) return
    const t = Math.min(1, (suja - LIMIAR_DA_MANCHA) / BEIRA_DA_MANCHA) * MANCHA_CHEIA
    s[0] += (MANCHA_DO_OSSO[0] - s[0]) * t
    s[1] += (MANCHA_DO_OSSO[1] - s[1]) * t
    s[2] += (MANCHA_DO_OSSO[2] - s[2]) * t
  }
}

// ---------- as medidas (px do desenho de 28 x 28, com o meio da pegada em 0, 0) ----------

/** A cúpula: o meio e os raios. */
const CUPULA = { x: 2, y: -3.6, rx: 9.4, ry: 8.6 }
/** O meio da cara: um tico à direita do meio da cúpula (a cara vira um nada para a direita). */
const MEIO_DA_CARA = 2.8
/**
 * As maçãs do rosto (x a partir do meio da cara, y, raios): a da direita, mais longe, sai menor. Emendam na cúpula
 * pela união macia (`EMENDA_DAS_MACAS` px): coladas com quina, elas liam como orelhas redondas.
 */
const MACAS: readonly (readonly [number, number, number, number])[] = [
  [-6, 2.9, 2.5, 1.4],
  [5.1, 3, 1.7, 1.3],
]
const EMENDA_DAS_MACAS = 2.2
/** O maxilar, debaixo do nariz (x a partir do meio da cara): de onde até onde, o raio do canto e a emenda na cúpula. */
const MAXILAR = { x0: -4.3, x1: 4, y0: 1, y1: 8.4, raio: 2.4, emenda: 1.4 }
/** As órbitas (x a partir do meio da cara, y, raios e o giro): a da direita, mais longe, mais estreita. */
const ORBITAS: readonly (readonly [number, number, number, number, number])[] = [
  [-3.4, 0.4, 2.7, 2.35, -0.18],
  [3, 0.5, 2.25, 2.3, 0.22],
]
/** A beira clara de cima da órbita (o osso da sobrancelha): o quanto ela passa da órbita e para onde vai. */
const BEIRA_DA_ORBITA = { aMais: 0.55, dx: -0.3, dy: -0.4 }
/** O nariz: a pera de cabeça para baixo, em volta do meio da cara (x a partir dele). */
const NARIZ: readonly Ponto[] = [
  [0.05, 2.5],
  [0.75, 3.7],
  [1.4, 5.3],
  [0.8, 6.1],
  [0, 5.6],
  [-0.8, 6.1],
  [-1.45, 5.3],
  [-0.8, 3.7],
]
/** A faixa escura da boca, atrás dos dentes (x a partir do meio da cara). */
const BOCA = { x0: -4.1, x1: 3.7, y0: 7.3, y1: 9.9, raio: 1.1 }
/**
 * Os dentes de cima: o x de cada um (a partir do meio da cara) e a meia largura (os da direita, mais longe, mais
 * finos). O arco dos dentes volta para trás nos lados: o dente de lado sobe `CURVA_DOS_DENTES` vezes o x ao quadrado.
 */
const DENTES: readonly (readonly [number, number])[] = [
  [-3.45, 0.46],
  [-2.3, 0.47],
  [-1.15, 0.48],
  [0, 0.48],
  [1.15, 0.46],
  [2.2, 0.42],
  [3.1, 0.36],
]
/** O dente que caiu (o índice em `DENTES`). */
const DENTE_QUE_FALTA = 5
const DENTE_DE = 7.1
const DENTE_ATE = 9.65
const CURVA_DOS_DENTES = 0.09
/** As suturas da cúpula: a coronal, de lado a lado, e a sagital, dela para trás (para cima na tela). */
const CORONAL: readonly Ponto[] = [[-5, -6.2], [-2.4, -7.9], [1, -8.7], [4.6, -8.5], [7.6, -7.3], [9.4, -5.6]]
const SAGITAL: readonly Ponto[] = [[1.4, -8.7], [1.1, -10.2], [1.3, -11.5]]
/** O dente da sutura: quantos por pedaço e o quanto ele sai para o lado (px do desenho). */
const DENTES_DA_SUTURA = 3
const SERRA_DA_SUTURA = 0.34
/**
 * A rachadura na testa, a grossura dela e a beira clara (o lado de cima à esquerda, que pega a luz). Fina e meio
 * apagada: grossa e preta, ela era um raio de desenho animado.
 */
const RACHADURA: readonly Ponto[] = [[5.4, -7.6], [6, -6.5], [5.3, -5.5], [6.1, -4.5]]
const GROSSURA_DA_RACHADURA = 0.2
const BEIRA_DA_RACHADURA: Ponto = [-0.32, -0.28]

/**
 * A mandíbula caída de lado, vista de perfil (o queixo para a direita, para o crânio): o corpo com a fileira de
 * dentes em cima e, atrás, o ramo largo que sobe com as duas pontas (a do côndilo, redonda, e a coronoide, rombuda).
 * Em U, vista de cima, ela lia como um cano torto; de perfil fino, com o côndilo num pescoço, como um pente com
 * alfinete. Onde caiu (o meio dela) e o quanto está virada.
 */
const MANDIBULA = { x: -8, y: 6.2, ang: 0.08 }
const CORPO_DA_MANDIBULA: readonly Ponto[] = [
  [5.2, 2],
  [5.6, 0.6],
  [5.2, -0.8],
  [1.2, -1],
  [-1.6, -1.1],
  [-2.1, -2.6],
  [-2.3, -4.6],
  [-3, -4],
  [-3.6, -3.3],
  [-4.2, -4],
  [-5.4, -3.6],
  [-5.6, -1],
  [-5.2, 1.8],
  [-4.2, 2.9],
  [-1, 2.8],
  [2.8, 3],
]
/** A cabeça do côndilo, na ponta de trás do ramo. */
const CONDILO = { x: -4.8, y: -4.2, rx: 1.1, ry: 0.8 }
/**
 * Os dentes de baixo: o x de cada um, a meia largura e até onde sobe (o canino mais alto, os molares de trás mais
 * largos e baixos: iguais, eles liam como um pente); todos saem do mesmo pé, escondido no osso.
 */
const DENTES_DE_BAIXO: readonly (readonly [number, number, number])[] = [
  [4.7, 0.38, -1.9],
  [3.8, 0.4, -1.95],
  [2.85, 0.45, -2.3],
  [1.75, 0.48, -1.95],
  [0.5, 0.58, -1.8],
  [-0.8, 0.6, -1.75],
]
const DENTE_DE_BAIXO_DE = -0.5

/** As alturas (px do desenho) com que a sombra no chão sai da base: o crânio e a mandíbula deitada. */
const ALTURA_DO_CRANIO = 9
const ALTURA_DA_MANDIBULA = 2
/** A base do crânio no chão (o que a sombra arrasta), vista de cima à frente: uma elipse achatada debaixo dele. */
const BASE_DO_CRANIO = { x: 2.4, y: 4.6, rx: 8.8, ry: 5 }

// ---------- as formas ----------

/** A forma desenhada em volta de (0, 0), aumentada `k`, girada `ang` radianos e levada para (cx, cy). */
function levada(f: Forma, cx: number, cy: number, ang: number, k: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const [x0, y0, x1, y1] = f.b
  const cantos: readonly Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const xs = cantos.map(([x, y]) => cx + (x * co - y * si) * k)
  const ys = cantos.map(([x, y]) => cy + (x * si + y * co) * k)
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d(x, y) {
      const dx = (x - cx) / k
      const dy = (y - cy) / k
      return f.d(dx * co + dy * si, -dx * si + dy * co) * k
    },
  }
}

/**
 * A união macia: onde as duas formas chegam perto (menos de `r` px), o vão entre elas é preenchido numa curva, sem
 * quina (o mínimo suave de dois campos de distância). A caixa cresce um tico, pelo que a emenda pode passar dela.
 */
function uniaoMacia(a: Forma, b: Forma, r: number): Forma {
  const folga = r * 0.25
  return {
    b: [Math.min(a.b[0], b.b[0]) - folga, Math.min(a.b[1], b.b[1]) - folga, Math.max(a.b[2], b.b[2]) + folga, Math.max(a.b[3], b.b[3]) + folga],
    d(x, y) {
      const da = a.d(x, y)
      const db = b.d(x, y)
      const h = limitar(0.5 + (0.5 * (db - da)) / r, 0, 1)
      return db + (da - db) * h - r * h * (1 - h)
    },
  }
}

/** A linha serrilhada pelos pontos: cada pedaço em `dentes` passos, um para cada lado, `serra` px para fora. */
function serrilhada(pontos: readonly Ponto[], dentes: number, serra: number): Ponto[] {
  const saida: Ponto[] = [pontos[0]]
  let lado = 1
  for (let i = 1; i < pontos.length; i += 1) {
    const [ax, ay] = pontos[i - 1]
    const [bx, by] = pontos[i]
    const l = Math.hypot(bx - ax, by - ay) || 1
    const nx = -(by - ay) / l
    const ny = (bx - ax) / l
    for (let j = 1; j < dentes; j += 1) {
      const t = j / dentes
      saida.push([ax + (bx - ax) * t + nx * serra * lado, ay + (by - ay) * t + ny * serra * lado])
      lado = -lado
    }
    saida.push(pontos[i])
  }
  return saida
}

/** Os pontos levados (dx, dy). */
function deslocados(pontos: readonly Ponto[], dx: number, dy: number): Ponto[] {
  return pontos.map(([x, y]): Ponto => [x + dx, y + dy])
}

export const montarCranio: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
  const noDesenho = (f: Forma): Forma => levada(f, 0, 0, 0, k)
  const xm = MEIO_DA_CARA
  const osso = texDoOsso(k, false)
  cena.corDoPiso = ESCURO_DO_OSSO

  // A mandíbula, caída de lado: o corpo com o ramo e o côndilo numa peça só e, em cima, os dentes de baixo.
  const [mx, my] = [MANDIBULA.x * k, MANDIBULA.y * k]
  const naMandibula = (f: Forma): Forma => levada(f, mx, my, MANDIBULA.ang, k)
  const mandibula = naMandibula(uniao(poligono(CORPO_DA_MANDIBULA), elipse(CONDILO.x, CONDILO.y, CONDILO.rx, CONDILO.ry)))
  cena.sombras.push(contato(mandibula, 0.3), { forma: mandibula, z: ALTURA_DA_MANDIBULA * k, suave: 0.8, forca: 0.24 })
  DENTES_DE_BAIXO.forEach(([x, meia, ate], i) => {
    const dente = naMandibula(caixa(x - meia, ate, x + meia, DENTE_DE_BAIXO_DE, Math.min(0.35, meia * 0.7)))
    cena.partes.push(P(dente, OSSO, { bisel: 0.3 * k, tom: 1.06, contorno: 0.2, textura: osso, semente: 1751 + i }))
  })
  cena.partes.push(P(mandibula, OSSO, { bisel: 1.3 * k, tom: 0.97, contorno: 0.3, textura: osso, semente: 1749 }))

  // O crânio: a cúpula, as maçãs do rosto e o maxilar numa peça só (um contorno só), emendados sem quina.
  const base = noDesenho(elipse(BASE_DO_CRANIO.x, BASE_DO_CRANIO.y, BASE_DO_CRANIO.rx, BASE_DO_CRANIO.ry))
  cena.sombras.push(contato(base, 0.32), { forma: base, z: ALTURA_DO_CRANIO * k, suave: 1.2, forca: 0.3 })
  const maxilar = caixa(xm + MAXILAR.x0, MAXILAR.y0, xm + MAXILAR.x1, MAXILAR.y1, MAXILAR.raio)
  let cranio = uniaoMacia(elipse(CUPULA.x, CUPULA.y, CUPULA.rx, CUPULA.ry), maxilar, MAXILAR.emenda)
  for (const [x, y, rx, ry] of MACAS) cranio = uniaoMacia(cranio, elipse(xm + x, y, rx, ry), EMENDA_DAS_MACAS)
  cena.partes.push(P(noDesenho(cranio), OSSO, { bisel: 4.4 * k, tom: 1.03, contorno: 0.3, textura: texDoOsso(k, true), semente: 1753 }))

  // As suturas, finas e meio apagadas, e a rachadura da testa com a beira clara por baixo dela.
  for (const linha of [CORONAL, SAGITAL]) {
    cena.partes.push(P(noDesenho(cadeia(serrilhada(linha, DENTES_DA_SUTURA, SERRA_DA_SUTURA), 0.16)), OCO, { bisel: 0, contorno: 0, alfa: 0.42, semente: 1754 }))
  }
  const [bx, by] = BEIRA_DA_RACHADURA
  cena.partes.push(P(noDesenho(cadeia(deslocados(RACHADURA, bx, by), GROSSURA_DA_RACHADURA)), OSSO, { bisel: 0, contorno: 0, tom: 1.12, alfa: 0.7, semente: 1755 }))
  cena.partes.push(P(noDesenho(cadeia(RACHADURA, GROSSURA_DA_RACHADURA)), OCO, { bisel: 0, contorno: 0, alfa: 0.78, semente: 1756 }))

  // As órbitas: a beira clara de cima (pintada antes, sobra só a lua de cima à esquerda) e o oco fundo.
  const beira = BEIRA_DA_ORBITA
  for (const [x, y, rx, ry, giro] of ORBITAS) {
    cena.partes.push(P(noDesenho(elipseGirada(xm + x + beira.dx, y + beira.dy, rx + beira.aMais, ry + beira.aMais, giro)), OSSO, { bisel: 0.6 * k, contorno: 0, tom: 1.1, alfa: 0.85, semente: 1757 }))
    cena.partes.push(P(noDesenho(elipseGirada(xm + x, y, rx, ry, giro)), OCO, { bisel: 0.4, contorno: 0.2, recesso: { k: 0.9, forca: 0.34 }, semente: 1758 }))
  }
  cena.partes.push(P(noDesenho(poligono(deslocados(NARIZ, xm, 0))), OCO, { bisel: 0.3, contorno: 0.2, recesso: { k: 0.7, forca: 0.3 }, semente: 1759 }))

  // A boca: a faixa escura e, por cima, os dentes (o escuro que sobra entre eles é o vão; um caiu).
  cena.partes.push(P(noDesenho(caixa(xm + BOCA.x0, BOCA.y0, xm + BOCA.x1, BOCA.y1, BOCA.raio)), OCO, { bisel: 0, contorno: 0.2, semente: 1760 }))
  DENTES.forEach(([x, meia], i) => {
    if (i === DENTE_QUE_FALTA) return
    const sobe = CURVA_DOS_DENTES * x * x
    const dente = caixa(xm + x - meia, DENTE_DE - sobe * 0.4, xm + x + meia, DENTE_ATE - sobe, Math.min(0.35, meia * 0.7))
    cena.partes.push(P(noDesenho(dente), OSSO, { bisel: 0.35 * k, tom: 1.06, contorno: 0.2, textura: osso, semente: 1761 + i }))
  })
}
