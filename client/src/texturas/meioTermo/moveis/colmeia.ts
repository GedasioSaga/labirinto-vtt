/**
 * COLMEIA de cima com volume (lote 10 dos objetos novos, 11/11/2026): o
 * CORTIÇO de palha, a colmeia antiga, uma cúpula de rolo de palha enrolado em
 * espiral e costurado com tiras de cana, em cima de um BANCO baixo e redondo
 * de tábuas, de três pés. Na frente, rente ao banco, a BOCA de entrada; ao lado
 * do cortiço, um pedaço de FAVO cortado, com o mel escorrendo no banco; e umas
 * poucas ABELHAS em volta (o corpo listrado, as asinhas claras), quase todas na
 * boca.
 *
 * De cima se vê a espiral da palha subindo até o topo: as voltas de baixo, de
 * parede quase em pé, ficam espremidas na beira, e as de cima abrem; a cúpula
 * tem a luz de esfera, e o rolo de cada volta, o sulco escuro e as amarras de
 * cana desencontradas de uma volta para a outra (só de perto).
 *
 * NA 3/4 a cúpula sobe em voltas, pelo que `tresQuartos.ts` faz com as sombras:
 * cada volta é um tampo solto (a sombra dela, que no chão desenha a sombra da
 * cúpula), um disco do tamanho da volta na altura do alto dela, e a beirada do
 * tampo (a espessura da volta, `ESPESSURA_DA_ESPIRA`, que o perfil usa) é a face
 * da volta vista de frente; cada volta de cima é pintada depois da de baixo (a
 * caixa de todas vai até a mesma frente, então elas saem por altura). O banco é
 * outro tampo, mais baixo, com a beirada da grossura da tábua, sobre três pés
 * (colunas). A boca é desenhada de frente e presa a um pino (uma estrutura sem
 * tamanho nem tinta, como no cesto de vime): sobe até a base da volta de baixo;
 * de cima, sobra só a beira dela, escura, rente à base. O favo é um tampo baixo
 * no banco e as abelhas que voam têm cada uma o seu pino, na altura do voo.
 * Girada na 3/4 (`c.giro`), a boca (desenhada de frente) não entra, a luz da
 * cúpula e as sombras pintadas ficam no lugar na tela, e a caixa das voltas, do
 * favo e dos pinos vai até a frente NA TELA (esticada no desenho, girada ela
 * iria para o lado, e o banco seria pintado por cima da palha).
 *
 * A 25% de zoom sobram o disco de palha com os anéis, o banco escuro em volta e
 * a mancha dourada do favo. As medidas saem do menor lado da pegada (0,8 x 0,8
 * casa de partida); as alturas, de casas. Material: `madeira` (o banco); a
 * palha, a cana, o favo, o mel e as abelhas são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, dentroDe, elipse, elipseGirada, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2

/** A grossura de uma volta do rolo de palha, em px do protótipo: a beirada de todo tampo da colmeia na 3/4. */
export const ESPESSURA_DA_ESPIRA = 0.055 * G

/** O banco: o raio (fração do menor meio lado), a altura do tampo (casas) e a largura de cada tábua (px). */
const RAIO_DO_BANCO = 0.91
const ALTURA_DO_BANCO = 0.2
const TABUA_DO_BANCO = 6.6
/** Os três pés: o rumo (graus, 90 = a frente), a distância do meio (fração do raio do banco) e o raio (px). */
const PES_DO_BANCO: readonly (readonly [graus: number, longe: number])[] = [
  [70, 0.86],
  [130, 0.86],
  [290, 0.86],
]
const RAIO_DO_PE = 1.7
/**
 * A cúpula: o raio da base (fração do menor meio lado), o meio dela (puxado para trás e para a esquerda, para
 * o favo caber na frente), a altura (casas) e o expoente do perfil: o raio na altura t (0 a base, 1 o alto) é
 * `raio * sqrt(1 - t^PERFIL)`, a parede quase em pé embaixo e o alto arredondado, como o cortiço de verdade.
 */
const RAIO_DA_CUPULA = 0.6
const MEIO_DA_CUPULA: Ponto = [-0.16, -0.19]
const ALTURA_DA_CUPULA = 0.48
const PERFIL = 2.5
/** O pegador do alto: o raio (fração do raio da cúpula). */
const RAIO_DO_PEGADOR = 0.17
/** As amarras de cana por volta e a meia largura de cada uma (fração do intervalo entre duas). */
const AMARRAS = 15
const MEIA_AMARRA = 0.09
/** A luz de esfera da cúpula e até onde ela inclina (o quadrado do raio). */
const FORCA_DA_ESFERA = 0.32
const BEIRA_DA_ESFERA = 0.9
/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo vira chuvisco: fica mais fraco. */
const ESCALA_DO_DETALHE = 1.5
const DETALHE_DE_LONGE = 0.4

/** A palha do cortiço: dourada e contida (da classe corda: a face das voltas na 3/4 sai torcida). */
const PALHA: MaterialDaPeca = { classe: 'corda', rgb: [0xc8, 0xa6, 0x66] }
/** A cana das amarras, mais escura e mais fria que a palha. */
const TOM_DA_CANA: Rgb = [0x8a, 0x70, 0x48]
const QUANTO_DE_CANA = 0.55
/** A boca: o escuro de dentro da colmeia. */
const ESCURO_DA_BOCA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x24] }
/** O favo: a cera (as paredes dos alvéolos), o mel dentro deles e o mel escorrido. */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xb4, 0x6a] }
const TOM_DO_MEL: Rgb = [0xb8, 0x80, 0x3c]
const MEL: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0x7e, 0x3e] }
/** As abelhas: o amarelo do corpo, o escuro das listras e da cabeça, e as asas. */
const AMARELO_DA_ABELHA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xae, 0x52] }
const TOM_DA_LISTRA: Rgb = [0x46, 0x38, 0x2c]
const CABECA_DA_ABELHA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x3c, 0x30] }
const ASA: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xec, 0xea] }
const ALFA_DA_ASA = 0.62
/** A sombra pintada no banco (o motor só põe sombra no chão, por baixo das peças). */
const COR_DA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [14, 11, 8] }

/** O favo: o meio (fração do menor meio lado), os dois raios e o giro. O alvéolo tem este raio (px). */
const FAVO = { x: 0.44, y: 0.42, rx: 0.18, ry: 0.115, giro: -0.6 } as const
const ALVEOLO = 0.95
/** O mel escorrido do favo para o banco: a distância do meio do favo (no raio menor dele, para a frente) e os raios (px). */
const ESCORRIDO = { longe: 1.55, rx: 1.7, ry: 1.05 } as const
/**
 * Um ponto do banco à esquerda, fora da cúpula, do favo e dos pés (frações do menor meio lado): o meio do banco
 * fica debaixo da cúpula, e a peça do banco (e as sombras pintadas nele) subiriam com uma volta da palha.
 */
const ANCORA_DO_BANCO: Ponto = [-0.8, 0.25]

/**
 * As abelhas: o lugar (o ponto em volta da cúpula, em frações do menor meio lado), o rumo da cabeça e a altura
 * do voo acima do banco (casas; `null` = andando no favo).
 */
const ABELHAS: readonly { readonly x: number; readonly y: number; readonly rumo: number; readonly voo: number | null }[] = [
  { x: -0.06, y: 0.6, rumo: -1.9, voo: 0.06 },
  { x: -0.37, y: 0.66, rumo: -0.6, voo: 0.17 },
  { x: 0.5, y: 0.38, rumo: 2.6, voo: null },
  { x: 0.55, y: -0.36, rumo: 2.2, voo: 0.52 },
  { x: -0.86, y: -0.42, rumo: -0.4, voo: 0.38 },
]
/** A abelha (px do protótipo): o comprimento e a largura do corpo, o raio da cabeça e as asas. */
const ABELHA = { comp: 2.9, larg: 1.7, cabeca: 0.62, asa: 1.15, larguraDaAsa: 0.6 } as const

// ---------- formas ----------

/** Círculo com a distância exata. */
function circulo(cx: number, cy: number, r: number): Forma {
  return { b: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r }
}

/** A mesma forma com a caixa de pintura trocada por `b` (que tem de conter a forma). */
function comCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/**
 * A mesma forma com a caixa de pintura espelhada em volta de (mx, my): o desenho não muda, e o meio da caixa,
 * que é o que a 3/4 lê para saber em que estrutura a peça está, cai ali.
 */
function centrada(f: Forma, mx: number, my: number): Forma {
  const ax = Math.max(Math.abs(f.b[0] - mx), Math.abs(f.b[2] - mx))
  const ay = Math.max(Math.abs(f.b[1] - my), Math.abs(f.b[3] - my))
  return comCaixa(f, [mx - ax, my - ay, mx + ax, my + ay])
}

/** Meia largura do pino (px do protótipo): só o meio exato da caixa de uma peça cai nele. */
const MEIO_PINO = 0.001

/**
 * Um PINO (o do cesto de vime): a estrutura da 3/4 sem tamanho nem tinta. Só a peça com o meio da caixa em (x, y)
 * sobe com ele; a frente da caixa, por onde a 3/4 ordena as estruturas, vem de `comFrenteNaTela`.
 */
function pino(x: number, y: number): Forma {
  return {
    b: [x - MEIO_PINO, y - MEIO_PINO, x + MEIO_PINO, y + MEIO_PINO],
    d: (px, py) => (Math.abs(px - x) <= MEIO_PINO && Math.abs(py - y) <= MEIO_PINO ? -MEIO_PINO : 1),
  }
}

/** Os quartos de volta do giro que a 3/4 pinta (0 fora dela). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto (ou a direção) da tela de volta no desenho, antes do quarto de volta que a 3/4 pinta. */
function desgirada(x: number, y: number, quartos: number): readonly [number, number] {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** O ponto do desenho NA TELA, depois do quarto de volta que a 3/4 pinta (o `girarPonto` de `tresQuartos.ts`). */
function naTela(x: number, y: number, quartos: number): readonly [number, number] {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

/** A caixa levada por `leva` (um quarto de volta leva caixa em caixa). */
function caixaLevada(b: Caixa, leva: (x: number, y: number) => readonly [number, number]): Caixa {
  const [ax, ay] = leva(b[0], b[1])
  const [bx, by] = leva(b[2], b[3])
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
}

/**
 * A forma com a caixa esticada até `frente` NA TELA, depois do giro da 3/4: ela é pintada depois de tudo que vai
 * até antes (o banco). Esticada no desenho, girada a caixa iria para o lado e a palha sairia por baixo do banco.
 */
function comFrenteNaTela(f: Forma, quartos: number, frente: number): Forma {
  const t = caixaLevada(f.b, (x, y) => naTela(x, y, quartos))
  return comCaixa(f, caixaLevada([t[0], t[1], t[2], Math.max(t[3], frente)], (x, y) => desgirada(x, y, quartos)))
}

// ---------- texturas ----------

/** O raio da cúpula (fração do da base) na altura t (0 a base, 1 o alto). */
function perfilDaCupula(t: number): number {
  return Math.sqrt(Math.max(0, 1 - Math.pow(t, PERFIL)))
}

/**
 * A palha em espiral, vista do alto: a altura de cada ponto sai do perfil (a volta de baixo, quase em pé, fica
 * espremida na beira), o rolo de cada volta clareia no meio e escurece no sulco, as amarras de cana cruzam o
 * rolo desencontradas de uma volta para a outra, e a cúpula pega a luz de esfera (luzX, luzY: de onde a luz
 * vem no desenho).
 */
function texDaCupula(cx: number, cy: number, raio: number, voltas: number, luzX: number, luzY: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const dx = (x - cx) / raio
    const dy = (y - cy) / raio
    const rho2 = dx * dx + dy * dy
    const t = Math.pow(Math.max(0, 1 - rho2), 1 / PERFIL)
    const angulo = Math.atan2(dy, dx) / VOLTA
    const espira = t * voltas + angulo
    const f = espira - Math.floor(espira)
    const detalhe = escala < ESCALA_DO_DETALHE ? DETALHE_DE_LONGE : 1
    let luz = (Math.sqrt(Math.sin(f * Math.PI)) - 0.74) * 0.36
    // As fibras da palha ao longo do rolo.
    luz += ruido(angulo * 260 + t * 13, f * 3.2 + t * 40) * 0.08 * detalhe
    // As amarras: meia volta de desencontro de uma volta para a outra, contínuas na emenda do ângulo.
    const amarra = angulo * AMARRAS + 0.5 * t * voltas
    const na = Math.abs(amarra - Math.floor(amarra) - 0.5)
    if (na < MEIA_AMARRA) {
      const q = (1 - na / MEIA_AMARRA) * QUANTO_DE_CANA * detalhe
      s[0] += (TOM_DA_CANA[0] - s[0]) * q
      s[1] += (TOM_DA_CANA[1] - s[1]) * q
      s[2] += (TOM_DA_CANA[2] - s[2]) * q
    }
    luz += FORCA_DA_ESFERA * (dx * luzX + dy * luzY + (Math.sqrt(1 - Math.min(BEIRA_DA_ESFERA, rho2)) - 1) * 0.62)
    s[3] += luz
  }
}

/** O pegador do alto: o rolo torcido em volta do meio. */
function texDoPegador(cx: number, cy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const onda = Math.sin(Math.atan2(y - cy, x - cx) * 7 + Math.hypot(x - cx, y - cy) * 1.6)
    s[3] += onda > 0 ? 0.08 * onda : 0.22 * onda
  }
}

/**
 * O favo: os alvéolos sextavados (a parede de cera clara, o mel escuro e brilhante dentro, uns fechados com a
 * tampa de cera). De longe, só a mancha de mel com a cera salpicada.
 */
function texDoFavo(): Textura {
  const passoX = Math.sqrt(3) * ALVEOLO
  const passoY = 3 * ALVEOLO
  const raioDentro = (Math.sqrt(3) / 2) * ALVEOLO
  return (_u, _v, x, y, _p, s, escala) => {
    // O alvéolo mais perto: o melhor de duas grades retangulares desencontradas.
    const ia = Math.round(x / passoX)
    const ja = Math.round(y / passoY)
    const ib = Math.round((x - passoX / 2) / passoX)
    const jb = Math.round((y - passoY / 2) / passoY)
    const ax = x - ia * passoX
    const ay = y - ja * passoY
    const bx = x - ib * passoX - passoX / 2
    const by = y - jb * passoY - passoY / 2
    const usaA = ax * ax + ay * ay <= bx * bx + by * by
    const qx = usaA ? ax : bx
    const qy = usaA ? ay : by
    const id = usaA ? ia * 7 + ja * 131 : ib * 7 + jb * 131 + 61
    const hexa = Math.max(Math.abs(qx), Math.abs(qx) * 0.5 + Math.abs(qy) * (Math.sqrt(3) / 2))
    const parede = raioDentro - hexa
    const detalhe = escala < ESCALA_DO_DETALHE ? DETALHE_DE_LONGE : 1
    const fechado = hash(id, 3, 4401) > 0.62
    if (parede > 0.22 && !fechado) {
      // O mel dentro: escuro no fundo, com o brilho do lado da luz.
      const q = 0.75 * detalhe
      s[0] += (TOM_DO_MEL[0] - s[0]) * q
      s[1] += (TOM_DO_MEL[1] - s[1]) * q
      s[2] += (TOM_DO_MEL[2] - s[2]) * q
      s[3] += (-(qx * 0.62 + qy * 0.48) / ALVEOLO) * 0.18 * detalhe
    } else if (parede > 0.22) s[3] += 0.05 * detalhe
    else s[3] += (0.06 - Math.max(0, 0.22 - parede) * 0.3) * detalhe
  }
}

/** O corpo da abelha: as listras escuras atravessadas, ao longo de (ux, uy) a partir de (x, y). */
function texDaAbelha(x0: number, y0: number, ux: number, uy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const ao = (x - x0) * ux + (y - y0) * uy
    if (Math.sin(ao * 4.4 + 0.8) > 0.25) {
      s[0] += (TOM_DA_LISTRA[0] - s[0]) * 0.85
      s[1] += (TOM_DA_LISTRA[1] - s[1]) * 0.85
      s[2] += (TOM_DA_LISTRA[2] - s[2]) * 0.85
    }
  }
}

// ---------- montagem ----------

/** Uma abelha com o meio em (x, y) e a cabeça para `rumo`; cada peça com a caixa centrada no meio (o pino dela). */
function abelha(L: Peca[], c: ContextoDoMovel, x: number, y: number, rumo: number, sem: number): void {
  const P = c.peca
  const ux = Math.cos(rumo)
  const uy = Math.sin(rumo)
  L.push(P(centrada(elipseGirada(x, y, ABELHA.comp / 2, ABELHA.larg / 2, rumo), x, y), AMARELO_DA_ABELHA, { bisel: 0.6, contorno: 0.3, textura: texDaAbelha(x, y, ux, uy), semente: sem }))
  const hx = x + ux * (ABELHA.comp / 2 + ABELHA.cabeca * 0.55)
  const hy = y + uy * (ABELHA.comp / 2 + ABELHA.cabeca * 0.55)
  L.push(P(centrada(circulo(hx, hy, ABELHA.cabeca), x, y), CABECA_DA_ABELHA, { bisel: 0.4, contorno: 0.2, semente: sem + 1 }))
  // As asas abertas para os lados, um pouco para trás, claras e meio transparentes.
  for (const lado of [-1, 1]) {
    const a = rumo + lado * 1.95
    const wx = x + Math.cos(a) * ABELHA.asa * 0.95 + ux * 0.2
    const wy = y + Math.sin(a) * ABELHA.asa * 0.95 + uy * 0.2
    L.push(P(centrada(elipseGirada(wx, wy, ABELHA.asa, ABELHA.larguraDaAsa, a), x, y), ASA, { bisel: 0.3, contorno: 0.18, alfa: ALFA_DA_ASA, semente: sem + 2 }))
  }
}

export const montarColmeia: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const L = cena.partes
  const E = ESPESSURA_DA_ESPIRA
  const quartos = quartosDoGiro(c.giro)
  const [luzX, luzY] = desgirada(-0.62, -0.48, quartos)
  const [sx, sy] = desgirada(SOMBRA_X, SOMBRA_Y, quartos)

  const raioDoBanco = RAIO_DO_BANCO * R
  const zBanco = g * ALTURA_DO_BANCO
  const raio = RAIO_DA_CUPULA * R
  const cx = MEIO_DA_CUPULA[0] * R
  const cy = MEIO_DA_CUPULA[1] * R
  const voltas = Math.max(3, Math.round((g * ALTURA_DA_CUPULA) / E))
  const alto = zBanco + voltas * E
  /** Até onde vai a caixa das voltas, na tela: depois do banco, então elas são pintadas depois dele, de baixo para cima. */
  const frente = raioDoBanco + 1
  const ateAFrente = (f: Forma, alem: number): Forma => comFrenteNaTela(f, quartos, frente + alem)

  // ---------- o banco ----------
  const banco = circulo(0, 0, raioDoBanco)
  cena.sombras.push({ forma: banco, z: zBanco, solta: true, forca: 0.26 })
  // Os pés: colunas da altura do tampo (o empate com o banco fica com a menor, a do pé).
  PES_DO_BANCO.forEach(([graus, longe], i) => {
    const px = Math.cos((graus * Math.PI) / 180) * longe * raioDoBanco
    const py = Math.sin((graus * Math.PI) / 180) * longe * raioDoBanco
    const pe = circulo(px, py, RAIO_DO_PE)
    cena.sombras.push({ forma: pe, z: zBanco, forca: 0.24 }, contato(pe, 0.3))
    L.push(P(pe, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_PE * 0.8, tom: 0.82, contorno: 0.26, semente: 4500 + i }))
  })
  // O meio do banco fica debaixo da cúpula: a peça dele, e as pintadas nele, vão para a âncora (fora da cúpula e do favo).
  const ax = ANCORA_DO_BANCO[0] * R
  const ay = ANCORA_DO_BANCO[1] * R
  L.push(P(centrada(banco, ax, ay), c.m.madeira, { tabua: TABUA_DO_BANCO, bisel: 1.3, contorno: 0.28, semente: 4510 }))
  const fx = FAVO.x * R
  const fy = FAVO.y * R
  const foraDaCupula = (x: number, y: number, folga: number): boolean => Math.hypot(x - cx, y - cy) > raio + folga
  const foraDoFavo = (x: number, y: number): boolean => Math.hypot(x - fx, y - fy) > FAVO.rx * R * 1.2
  // Os pregos das travessas de baixo, dois por tábua (os debaixo da cúpula e do favo não aparecem).
  for (let j = 0; j * TABUA_DO_BANCO < 2 * raioDoBanco; j += 1) {
    const ty = -raioDoBanco + (j + 0.5) * TABUA_DO_BANCO
    const meia = Math.sqrt(Math.max(0, raioDoBanco * raioDoBanco - ty * ty))
    if (meia < raioDoBanco * 0.5) continue
    for (const lado of [-1, 1]) {
      const px = lado * meia * 0.72
      if (foraDaCupula(px, ty, 1) && foraDoFavo(px, ty)) L.push(P(circulo(px, ty, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
    }
  }
  // A sombra da cúpula no banco, para baixo à direita na tela.
  const meioDaSombra = alto * 0.42 - zBanco * 0.4
  const sombraDaCupula = dentroDe(circulo(cx + sx * meioDaSombra, cy + sy * meioDaSombra, raio * 1.02), banco)
  L.push(P(centrada(sombraDaCupula, ax, ay), COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 2.4 }))

  // ---------- a boca (de cima, a beira escura rente à base) ----------
  const bocaDeFrente = quartos === 0
  if (bocaDeFrente) {
    // Desenhada de frente: a meia elipse em pé, com a base na linha do banco na tela; sobe pelo pino até lá.
    const zPino = zBanco + 2
    const baseNaTela = cy + raio - zBanco
    const boca = dentroDe(elipse(cx, baseNaTela + zPino, 3, 3.3), caixa(cx - 3.2, baseNaTela + zPino - 3.4, cx + 3.2, baseNaTela + zPino))
    // O pino da boca fica no banco, à esquerda da cúpula (fora dela, para a boca não subir com uma volta).
    const bx = cx - raio - 1.4
    const by = cy + raio * 0.2
    cena.sombras.push({ forma: ateAFrente(pino(bx, by), 1), z: zPino, solta: true, forca: 0 })
    L.push(P(centrada(boca, bx, by), ESCURO_DA_BOCA, { bisel: 0.6, contorno: 0.3, recesso: { k: 1.2, forca: 0.3 }, semente: 4520 }))
  }

  // ---------- a cúpula, volta por volta ----------
  const texCupula = texDaCupula(cx, cy, raio, voltas, luzX, luzY)
  for (let k = 0; k < voltas; k += 1) {
    const r = raio * perfilDaCupula(k / voltas)
    const proximo = raio * perfilDaCupula((k + 1) / voltas)
    const disco = circulo(cx, cy, r)
    cena.sombras.push({ forma: ateAFrente(disco, 0), z: zBanco + (k + 1) * E, solta: true, forca: 0.14 })
    // O meio da caixa fica na faixa desta volta (dentro do disco dela e fora do da de cima): sobe com ela.
    L.push(P(centrada(disco, cx, cy + (r + proximo) / 2), PALHA, { bisel: k === 0 ? 1.4 : 0, contorno: k === 0 ? 0.28 : 0, textura: texCupula, semente: 4530 + k }))
  }
  // O pegador do alto: um tampo um nada mais alto que a última volta.
  const pegador = circulo(cx, cy, RAIO_DO_PEGADOR * raio)
  cena.sombras.push({ forma: ateAFrente(pegador, 0), z: alto + E, solta: true, forca: 0.14 })
  L.push(P(pegador, PALHA, { bisel: RAIO_DO_PEGADOR * raio * 0.7, tom: 0.92, contorno: 0.28, textura: texDoPegador(cx, cy), semente: 4560, projeta: { dist: 1.4, forca: 0.32 } }))

  // ---------- o favo e o mel escorrido ----------
  const pontosDoFavo: Ponto[] = []
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * VOLTA
    const solto = 0.86 + 0.24 * hash(i, 5, 4402)
    const u = Math.cos(a) * FAVO.rx * R * solto
    const v = Math.sin(a) * FAVO.ry * R * solto
    pontosDoFavo.push([fx + u * Math.cos(FAVO.giro) - v * Math.sin(FAVO.giro), fy + u * Math.sin(FAVO.giro) + v * Math.cos(FAVO.giro)])
  }
  const favo = poligono(pontosDoFavo)
  // O mel escorrido sai da beira da frente do favo (fora dele: o favo é um tampo, e o mel fica no banco).
  const rumoDoMel = FAVO.giro + Math.PI / 2
  const mx = fx + Math.cos(rumoDoMel) * FAVO.ry * R * ESCORRIDO.longe
  const my = fy + Math.sin(rumoDoMel) * FAVO.ry * R * ESCORRIDO.longe
  L.push(P(elipseGirada(mx, my, ESCORRIDO.rx, ESCORRIDO.ry, rumoDoMel), MEL, { bisel: 0.9, contorno: 0.24, metal: 0.5, semente: 4570 }))
  L.push(P(centrada(elipseGirada(fx + sx * 2.5, fy + sy * 2.5, FAVO.rx * R * 1.02, FAVO.ry * R * 1.02, FAVO.giro), ax, ay), COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: 0.32, suave: 1.2 }))
  cena.sombras.push({ forma: ateAFrente(favo, 0.5), z: zBanco + E, solta: true, forca: 0 })
  L.push(P(favo, CERA, { bisel: 0.9, contorno: 0.3, textura: texDoFavo(), semente: 4571 }))

  // ---------- as abelhas ----------
  ABELHAS.forEach((a, i) => {
    const x = a.x * R
    const y = a.y * R
    if (a.voo !== null) {
      const z = zBanco + g * a.voo
      cena.sombras.push({ forma: ateAFrente(pino(x, y), 1.5), z, solta: true, forca: 0 })
      // A sombra da abelha no banco, longe dela o quanto ela voa.
      const subida = g * a.voo
      const sombra = circulo(x + sx * subida, y + sy * subida, ABELHA.comp * 0.4)
      L.push(P(sombra, COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: 0.26, suave: 0.5 + subida * 0.06 }))
    }
    abelha(L, c, x, y, a.rumo, 4600 + i * 10)
  })
}
