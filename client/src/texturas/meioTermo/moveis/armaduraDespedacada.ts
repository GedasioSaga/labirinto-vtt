/**
 * ARMADURA DESPEDAÇADA de cima com volume (lote 15 dos objetos novos,
 * 12/11/2026), feita do mesmo jeito que os OSSOS: a armadura de placas de um
 * cavaleiro que caiu ali e se desfez, as peças espalhadas na forma do corpo
 * caído, só que de aço e vazias. O ELMO caiu de costas e tombou para o lado no
 * canto de cima à esquerda (onde fica o crânio), com o queixo para o peito e a
 * VISEIRA levantada sobre a testa; embaixo dela, a cara aberta mostra o oco
 * escuro de dentro. Embaixo dele, o GORJAL solto, aberto em C (onde fica a
 * mandíbula). O PEITORAL rachou ao meio
 * pela quina e as duas metades abriram em V a partir da cintura, amassadas e
 * riscadas de golpes; embaixo, a FRALDA, com a lâmina de baixo solta e torta.
 * Uma OMBREIRA ainda está no ombro; a outra caiu longe. Nos braços abertos, o
 * BRAÇAL, a COTOVELEIRA e o ANTEBRAÇO; a MANOPLA de cima ficou na ponta do
 * braço e a de baixo voou para além dos joelhos. Nas pernas, o COXOTE, a
 * JOELHEIRA, a GREVA e o PÉ DE FERRO: a de cima dobrada, com a greva voltando
 * para a cabeça como a canela do esqueleto; a de baixo esticada. O ESCUDO
 * partido em dois ficou debaixo do braço de baixo. Por todo lado, as TIRAS de
 * couro arrebentadas, os REBITES e as lascas de aço soltos e o PÓ, por baixo e
 * em montinhos por cima.
 *
 * É o aço do manequim com armadura (a mesma armadura): o peitoral com a quina
 * e o reflexo comprido, as ombreiras em três lâminas, as juntas com a quina e
 * os rebites de latão. Aço de batalha: riscado, amassado e com o
 * brilho contido, mas limpo; nada de ferrugem nem de capim, que são da armadura
 * enferrujada (um monte de peças velhas no mato). Sem corpo dentro, sem ossos e
 * sem sangue: o vazio está no oco do elmo, no V do peito e nas bocas escuras
 * dos tubos.
 *
 * O desenho é feito em 84 x 56 px (1,5 x 1 casas), como os ossos: as posições
 * saem de frações da pegada (o objeto esticado espalha as peças) e o tamanho de
 * cada peça, do menor lado (a peça não entorta). A luz do aço (a cúpula, o
 * cilindro, a quina, as covas dos amassados e os sulcos dos riscos) é pintada
 * na textura, no rumo da luz do motor; como a 3/4 pinta o quarto de volta na
 * cena, o rumo é desgirado por `c.giro`, e as sombras pintadas também.
 *
 * Na vista 3/4 a armadura é rente ao chão, como os ossos: sobe inteira a
 * espessura de uma peça (perfil derivado com `alturaSolta` de 0,03 casa) e a
 * sombra fica no chão. Por isso nenhuma sombra daqui tem altura: a de cada peça
 * é pintada afastada pela altura dela (`assentar`). Sem material no painel: o
 * aço, o couro, o latão, o escudo e o pó são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** O tamanho em que a armadura é desenhada (px do protótipo): 1,5 x 1 casas, o dos ossos. */
const LARGURA_DO_DESENHO = 84
const ALTURA_DO_DESENHO = 56

// ---------- os materiais fixos ----------

/** O aço de batalha: o do manequim um tom abaixo (não é o polido de vitrine), e o vão escuro de dentro das peças. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x9e, 0xa4, 0xa9] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x31, 0x30] }
/** O couro das tiras e o latão dos rebites e das fivelas (os do manequim). */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x4a, 0x33] }
const LATAO = materialDaPeca('latao')
/**
 * O escudo: as tábuas de pinho, a pintura gasta e a asna clara do escudo do manequim. A pintura é azul, e não
 * o vinho do manequim: no chão, ao lado de uma armadura caída, uma mancha vermelha podia passar por sangue.
 */
const TABUAS_DO_ESCUDO = materialDaPeca('pinho')
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x41, 0x55, 0x72] }
const TINTA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0xd0, 0xc3, 0x9c] }
/**
 * O pó dos ossos: o de baixo (a mancha em que a armadura está) mais escuro que a lajota clara e mais cinza que
 * a terra, para o aço claro ler nos dois chãos; o de cima (os montinhos que cobrem as peças) mais claro.
 */
const PO_DE_BAIXO: MaterialDaPeca = { classe: 'liso', rgb: [0x90, 0x81, 0x6b] }
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x9a, 0x82] }
/** O escuro em que o pixel escuro demais é levantado: o do ferro (o do canhão e do manequim, em que a nogueira do padrão deixava a fresta do elmo vermelha). */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')

// ---------- a luz do aço ----------

/** De onde vem a luz (a do motor) e o meio-caminho entre ela e o olho, onde o metal brilha. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const MEIO_X = -0.344
const MEIO_Y = -0.267
const MEIO_Z = 0.9
/** Quanto o relevo de cada peça muda a luz, e o quanto o ponto de brilho é pequeno. */
const FORCA_DO_RELEVO = 0.8
const EXPOENTE_DO_REFLEXO = 26
/** O brilho que o motor soma no chanfro: contido (o do manequim polido é 0,6). */
const BRILHO_DO_CHANFRO = 0.32
/** O ponto de brilho de cada peça vale um quarto menos: o aço de batalha é riscado e opaco, não espelho. */
const OPACO_DO_ACO = 0.75
/** O sulco de um risco de golpe: a meia largura (px do desenho), o escuro da parede que dá as costas para a luz, o fio claro da outra e o quanto as pontas afinam. */
const MEIO_RISCO = 0.34
const FUNDO_DO_RISCO = 0.22
const FIO_DO_RISCO = 0.2
const PONTA_DO_RISCO = 1.2

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0, quem gira é a imagem pronta), como nos ossos.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O rumo da luz e o do brilho no referencial do desenho (desgirados). */
interface Luz {
  readonly x: number
  readonly y: number
  readonly mx: number
  readonly my: number
}

function luzDoDesenho(giro: number): Luz {
  const [x, y] = desgirado(LUZ_X, LUZ_Y, giro)
  const [mx, my] = desgirado(MEIO_X, MEIO_Y, giro)
  return { x, y, mx, my }
}

// ---------- o lugar de cada peça ----------

/** Onde a peça foi posta na pegada: o meio, o giro (cosseno e seno) e o tamanho (px da pegada por px do desenho). */
interface Lugar {
  readonly cx: number
  readonly cy: number
  readonly co: number
  readonly si: number
  readonly k: number
}

/** A forma desenhada em volta de (0, 0) levada para o lugar: girada e aumentada `k` (o `levada` dos ossos). */
function noLugar(l: Lugar, f: Forma): Forma {
  const [x0, y0, x1, y1] = f.b
  const cantos: readonly Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const xs = cantos.map(([x, y]) => l.cx + (x * l.co - y * l.si) * l.k)
  const ys = cantos.map(([x, y]) => l.cy + (x * l.si + y * l.co) * l.k)
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d(x, y) {
      const dx = (x - l.cx) / l.k
      const dy = (y - l.cy) / l.k
      return f.d(dx * l.co + dy * l.si, -dx * l.si + dy * l.co) * l.k
    },
  }
}

/** O ponto do desenho da peça na pegada. */
function pontoNoLugar(l: Lugar, [x, y]: Ponto): Ponto {
  return [l.cx + (x * l.co - y * l.si) * l.k, l.cy + (x * l.si + y * l.co) * l.k]
}

/** O lugar de uma parte que saiu do lugar dentro da peça: levada para `desvio` e girada `ang` no desenho dela. */
function lugarDentro(l: Lugar, ang: number, desvio: Ponto): Lugar {
  const [cx, cy] = pontoNoLugar(l, desvio)
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return { cx, cy, co: l.co * co - l.si * si, si: l.si * co + l.co * si, k: l.k }
}

/** O lugar de uma parte girada `ang` em volta do `pivo` (no desenho da peça) e afastada `extra` (a metade do peito, a viseira). */
function giradoEm(l: Lugar, ang: number, [px, py]: Ponto, [ex, ey]: Ponto): Lugar {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return lugarDentro(l, ang, [px - (px * co - py * si) + ex, py - (px * si + py * co) + ey])
}

// ---------- a textura do aço de batalha ----------

/**
 * O relevo da peça no ponto (lx, ly) do desenho dela: a inclinação da superfície em `saida[0]` e `saida[1]` (de
 * -1 a 1, no rumo em que ela olha) e uma luz a somar em `saida[2]` (o fio da quina).
 */
type Relevo = (lx: number, ly: number, saida: Float64Array) => void
const RELEVO = new Float64Array(3)

/** As marcas de batalha de uma peça, no desenho dela: os amassados [x, y, raio, fundo] e os riscos [de x, de y, até x, até y]. */
interface Marcas {
  readonly amassados: readonly (readonly [number, number, number, number])[]
  readonly riscos: readonly (readonly [number, number, number, number])[]
}
const SEM_MARCAS: Marcas = { amassados: [], riscos: [] }

/**
 * O AÇO DE BATALHA: a luz do relevo da peça (desgirada para o desenho), as covas dos amassados (a parede do lado
 * da luz fica na sombra e a de lá pega luz, o contrário de um calombo), os sulcos dos riscos (a parede que dá as
 * costas para a luz escura, a outra com um fio claro) e o ponto de brilho.
 */
function texDoAco(l: Lugar, relevo: Relevo, luz: Luz, reflexo: number, marcas: Marcas): Textura {
  // O rumo da luz no desenho da peça: de que lado de cada risco fica a parede escura.
  const luzX = luz.x * l.co + luz.y * l.si
  const luzY = -luz.x * l.si + luz.y * l.co
  const riscos = marcas.riscos.map(([ax, ay, bx, by]) => {
    const comp = Math.hypot(bx - ax, by - ay) || 1
    const ex = (bx - ax) / comp
    const ey = (by - ay) / comp
    return { ax, ay, ex, ey, comp, ladoDaLuz: -ey * luzX + ex * luzY }
  })
  return (_u, _v, x, y, p, s) => {
    const dx = (x - l.cx) / l.k
    const dy = (y - l.cy) / l.k
    const lx = dx * l.co + dy * l.si
    const ly = -dx * l.si + dy * l.co
    RELEVO[0] = 0
    RELEVO[1] = 0
    RELEVO[2] = 0
    relevo(lx, ly, RELEVO)
    let ax = RELEVO[0]
    let ay = RELEVO[1]
    for (const [mx, my, raio, fundo] of marcas.amassados) {
      const qx = (lx - mx) / raio
      const qy = (ly - my) / raio
      const r2 = qx * qx + qy * qy
      if (r2 >= 1) continue
      const parede = 4 * fundo * (1 - r2)
      ax -= parede * qx
      ay -= parede * qy
    }
    const nx = ax * l.co - ay * l.si
    const ny = ax * l.si + ay * l.co
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))
    let luzAqui = FORCA_DO_RELEVO * (nx * luz.x + ny * luz.y + nz * LUZ_Z - LUZ_Z) + RELEVO[2]
    for (const r of riscos) {
      const wx = lx - r.ax
      const wy = ly - r.ay
      const ao = wx * r.ex + wy * r.ey
      if (ao <= 0 || ao >= r.comp) continue
      const lado = -wx * r.ey + wy * r.ex
      const d = Math.abs(lado)
      if (d >= MEIO_RISCO) continue
      const t = (1 - d / MEIO_RISCO) * Math.min(1, ao / PONTA_DO_RISCO, (r.comp - ao) / PONTA_DO_RISCO)
      luzAqui += lado * r.ladoDaLuz > 0 ? -FUNDO_DO_RISCO * t : FIO_DO_RISCO * t
    }
    s[3] += luzAqui + ruido(x * 0.16 + p.su, y * 0.16) * 0.07 + ruido(x * 0.8, y * 0.8 + p.sv) * 0.03
    const brilho = OPACO_DO_ACO * reflexo * Math.pow(Math.max(0, nx * luz.mx + ny * luz.my + nz * MEIO_Z), EXPOENTE_DO_REFLEXO)
    s[0] += brilho
    s[1] += brilho
    s[2] += brilho
  }
}

/** A cúpula de meio (cx, cy) e raios (rx, ry) no desenho da peça; `achata` encolhe a curva para o lado de y positivo. */
function cupula(cx: number, cy: number, rx: number, ry: number, forca: number, achata = 1): Relevo {
  return (lx, ly, saida) => {
    let nx = (lx - cx) / rx
    let ny = (ly - cy) / ry
    if (ny > 0) ny *= achata
    const r = Math.hypot(nx, ny)
    if (r > 1) {
      nx /= r
      ny /= r
    }
    saida[0] = nx * forca
    saida[1] = ny * forca
  }
}

/** O cilindro deitado ao longo de x no desenho da peça (a lâmina, o dedo), de meia largura `meia` em volta de y = `cy`. */
function cilindro(cy: number, meia: number, forca: number): Relevo {
  return (_lx, ly, saida) => {
    saida[1] = limitar((ly - cy) / meia, -1, 1) * forca
  }
}

/** A chapa plana (a beira de aço do escudo deitado): só o brilho do chanfro e o grão. */
const PLANO: Relevo = () => undefined

/** O anel (as lâminas do gorjal): a normal sai da linha do meio da lâmina para fora e para dentro. */
function anelDeLamina(cy: number, rx: number, ry: number, meia: number, forca: number): Relevo {
  return (lx, ly, saida) => {
    const px = lx / rx
    const py = (ly - cy) / ry
    const rho = Math.hypot(px, py) || 1
    const q = limitar(((rho - 1) * Math.min(rx, ry)) / meia, -1, 1) * forca
    saida[0] = (px / rho) * q
    saida[1] = (py / rho) * q
  }
}

// ---------- a montagem ----------

/** As medidas do desenho na pegada. */
interface Regua {
  /** O ponto do desenho (px de 84 x 56) na pegada. */
  readonly em: (x: number, y: number) => Ponto
  /** O tamanho sai do menor lado: a peça continua inteira no objeto esticado. */
  readonly k: number
}

/** O que a montagem passa a cada peça. */
interface Obra {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  readonly regua: Regua
  readonly luz: Luz
}

/** A forma afastada (dx, dy): onde cai a sombra dela. */
function afastada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * A sombra de uma peça de altura `z` (px do desenho) no chão: o contato no pé e a forma afastada como o motor
 * afasta a sombra dessa altura, mas com altura ZERO (sombra com altura vira coluna na 3/4 e a peça subiria
 * sozinha, com uma frente lisa embaixo). O afastamento é desgirado pelo `giro`: cai para baixo à direita na tela.
 */
function assentar(o: Obra, forma: Forma, z: number, forca = 0.26): void {
  const h = z * o.regua.k
  const [dx, dy] = desgirado(SOMBRA_X * h, SOMBRA_Y * h, o.c.giro)
  o.cena.sombras.push({ forma: afastada(forma, dx, dy), z: 0, suave: 0.9 + 0.12 * h, forca }, contato(forma, 0.3))
}

/** O lugar de uma peça no ponto (x, y) do desenho, girada `ang`. */
function lugarDe(r: Regua, x: number, y: number, ang: number): Lugar {
  const [cx, cy] = r.em(x, y)
  return { cx, cy, co: Math.cos(ang), si: Math.sin(ang), k: r.k }
}

/** Põe uma peça desenhada no referencial do lugar. */
function por(o: Obra, l: Lugar, f: Forma, mat: MaterialDaPeca, op: OpcoesDaPeca): void {
  o.cena.partes.push(o.c.peca(noLugar(l, f), mat, op))
}

/** Como pintar uma peça de aço: o relevo, o ponto de brilho, o chanfro, o tom, as marcas e a sombra nas de baixo (px do desenho). */
interface Aco {
  readonly relevo: Relevo
  readonly reflexo: number
  readonly bisel: number
  readonly tom?: number
  readonly marcas?: Marcas
  readonly projeta?: number
}

function porAco(o: Obra, l: Lugar, f: Forma, a: Aco, semente: number): void {
  const k = o.regua.k
  por(o, l, f, ACO, {
    tabua: 0,
    bisel: a.bisel * k,
    tom: a.tom ?? 1,
    contorno: 0.3,
    metal: BRILHO_DO_CHANFRO,
    textura: texDoAco(l, a.relevo, o.luz, a.reflexo, a.marcas ?? SEM_MARCAS),
    semente,
    projeta: a.projeta === undefined ? undefined : { dist: a.projeta * k, forca: 0.3 },
  })
}

/** Um rebite (no desenho da peça): a cabecinha redonda, com a sombra miúda nas de baixo. */
function porRebite(o: Obra, l: Lugar, [x, y]: Ponto, r: number, mat: MaterialDaPeca, semente: number): void {
  const k = o.regua.k
  por(o, l, elipse(x, y, r, r), mat, { bisel: r * k, tom: 1.12, contorno: 0.2, metal: 0.5, semente, projeta: { dist: 0.4 * k, forca: 0.3, suave: 0.4 * k } })
}

// ---------- o pó ----------

/** O pó: grão em duas escalas e a cobertura falhada (mais cheio aqui, mais ralo ali), o dos ossos. */
const texDoPo: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5) * 0.08 + ruido(x * 1.7, y * 1.7 + p.sv) * 0.04
  s[5] *= 0.82 + ruido(x * 0.16 + p.sv, y * 0.16 + p.su) * 0.36
}

/** O contorno irregular de uma mancha de pó: `n` pontos em volta de (cx, cy). */
function mancha(cx: number, cy: number, rx: number, ry: number, n: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    const f = 0.8 + 0.24 * hash(i, sem, 94)
    pontos.push([cx + Math.cos(t) * rx * f, cy + Math.sin(t) * ry * f])
  }
  return pontos
}

function montarPoPorBaixo(o: Obra): void {
  const { hw, hh, peca: P } = o.c
  const R = Math.min(hw, hh)
  // A mancha larga e rala e a do meio, mais cheia, as duas de borda desfeita (as dos ossos).
  o.cena.partes.push(P(poligono(mancha(0, 0.02 * hh, hw * 1.02, hh * 0.98, 18, 1)), PO_DE_BAIXO, { bisel: 0, contorno: 0, alfa: 0.42, suave: R * 0.22, textura: texDoPo, semente: 6100 }))
  o.cena.partes.push(P(poligono(mancha(-0.04 * hw, 0.03 * hh, hw * 0.76, hh * 0.68, 14, 2)), PO_DE_BAIXO, { bisel: 0, contorno: 0, tom: 0.94, alfa: 0.5, suave: R * 0.16, textura: texDoPo, semente: 6101 }))
}

/** Os montinhos de pó por cima das peças (o meio, os dois raios e o ângulo): cada um enterra a beira de uma peça. */
const MONTES_DE_PO: readonly (readonly [number, number, number, number, number])[] = [
  [-38.6, 21.4, 3.4, 2.4, 0.4],
  [-13.6, 27.0, 4.6, 1.9, 0.05],
  [9.4, 27.0, 4.2, 1.9, -0.1],
  [41.2, -1.2, 2.4, 3.0, 0.2],
  [35.6, -27.2, 3.4, 1.7, 0],
  [21.0, 20.6, 3.0, 2.0, 0.5],
]

function montarPoPorCima(o: Obra): void {
  const { regua, c } = o
  MONTES_DE_PO.forEach(([x, y, rx, ry, ang], i) => {
    const [cx, cy] = regua.em(x, y)
    o.cena.partes.push(c.peca(elipseGirada(cx, cy, rx * regua.k, ry * regua.k, ang), PO, { bisel: 0, contorno: 0, tom: 1.05, alfa: 0.92, suave: 2.2 * regua.k, textura: texDoPo, semente: 6110 + i }))
  })
}

// ---------- o miúdo: os rebites e as lascas soltos, as tiras arrebentadas ----------

/** Os rebites que saltaram [x, y, raio] e as lascas de aço [x, y, raio, ângulo], no chão. */
const REBITES_SOLTOS: readonly (readonly [number, number, number])[] = [
  [-37.6, 3.4, 0.62],
  [3.6, -12.4, 0.55],
  [18.6, 3.4, 0.6],
  [-27.2, 24.8, 0.6],
  [15.4, 26.6, 0.55],
  [-4.6, 15.6, 0.5],
]
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [-20.2, -3.2, 1.0, 0.5],
  [6.6, -6.8, 0.8, 2.1],
  [-3.6, 11.0, 0.9, -0.7],
  [24.8, 7.4, 0.8, 1.2],
]

function montarMiudo(o: Obra): void {
  const { regua, c, cena } = o
  const k = regua.k
  REBITES_SOLTOS.forEach(([x, y, r], i) => {
    const [cx, cy] = regua.em(x, y)
    const forma = elipse(cx, cy, r * k, r * k)
    cena.sombras.push(contato(forma, 0.3))
    cena.partes.push(c.peca(forma, i % 3 === 0 ? LATAO : ACO, { bisel: r * k, tom: 1.1, contorno: 0.24, metal: 0.5, semente: 6200 + i }))
  })
  LASCAS.forEach(([x, y, r, ang], i) => {
    const l = lugarDe(regua, x, y, ang)
    const lasca = poligono([[-r * 1.6, -r * 0.5], [r * 0.4, -r * 0.9], [r * 1.6, r * 0.3], [-r * 0.5, r * 0.8]])
    assentar(o, noLugar(l, lasca), 0.8)
    porAco(o, l, lasca, { relevo: PLANO, reflexo: 30, bisel: 0.4, tom: 0.96 + 0.1 * hash(i, 7, 61) }, 6210 + i)
  })
}

/** A tira de couro: grão, manchas de suor e de chuva e as rachas de través do couro dobrado. */
const texDoCouro: Textura = (u, v, x, y, p, s) => {
  s[3] += ruido(x * 0.4 + p.su, y * 0.4 + p.sv) * 0.12 + ruido(x * 1.3, y * 1.3 + p.su) * 0.05
  if (Math.sin(u * 1.5 + ruido(u * 0.2, v * 0.6 + p.sv) * 4) > 0.95) s[3] -= 0.12
}

const RAIO_DA_TIRA = 0.95

/** Uma tira de couro arrebentada pelos pontos (px da pegada): a tira e, na última ponta, os fios do rasgo abertos em leque. */
function porTira(o: Obra, pontos: readonly Ponto[], semente: number): void {
  const { c, cena } = o
  const k = o.regua.k
  const forma = cadeia(pontos, RAIO_DA_TIRA * k)
  const [ax, ay] = pontos[pontos.length - 2]
  const [bx, by] = pontos[pontos.length - 1]
  const rumo = Math.atan2(by - ay, bx - ax)
  cena.sombras.push(contato(forma, 0.26))
  cena.partes.push(c.peca(forma, COURO, { eixo: Math.atan2(pontos[1][1] - pontos[0][1], pontos[1][0] - pontos[0][0]), bisel: 0.45 * k, contorno: 0.28, textura: texDoCouro, semente }))
  for (let i = 0; i < 3; i += 1) {
    const a = rumo + (i - 1) * 0.5
    const comp = (1.0 + 0.6 * hash(i, semente, 62)) * k
    const fio = capsula(bx, by, bx + Math.cos(a) * comp, by + Math.sin(a) * comp, 0.32 * k)
    cena.partes.push(c.peca(fio, COURO, { bisel: 0.2 * k, contorno: 0.2, tom: 1.1, semente: semente + 1 + i }))
  }
}

/** A tira solta no chão, com a fivela de latão no começo (px do desenho). */
const TIRA_SOLTA: readonly Ponto[] = [[17.6, 21.2], [21.0, 23.4], [24.8, 23.2], [28.2, 25.2]]

function montarTiraSolta(o: Obra): void {
  const { regua } = o
  const k = regua.k
  porTira(o, TIRA_SOLTA.map(([x, y]) => regua.em(x, y)), 6300)
  // A fivela: o aro e o fuzilhão, atravessados na tira.
  const l = lugarDe(regua, TIRA_SOLTA[0][0], TIRA_SOLTA[0][1], Math.atan2(TIRA_SOLTA[1][1] - TIRA_SOLTA[0][1], TIRA_SOLTA[1][0] - TIRA_SOLTA[0][0]))
  por(o, l, menos(caixa(-1.3, -1.6, 1.3, 1.6, 0.45), caixa(-0.6, -0.9, 0.6, 0.9, 0.15)), LATAO, { bisel: 0.45 * k, tom: 1.06, contorno: 0.24, metal: 0.6, semente: 6305, projeta: { dist: 0.5 * k, forca: 0.3 } })
  por(o, l, capsula(-0.6, 0, 1.5, 0, 0.24), LATAO, { bisel: 0.2 * k, tom: 0.94, contorno: 0.16, metal: 0.5, semente: 6306 })
}

// ---------- o escudo partido ----------

/** O escudo de bico do manequim (x de través, y de cima para baixo) e a quebra que o partiu em dois, de cima ao bico. */
const ESCUDO: readonly Ponto[] = [[-6.6, -7.0], [6.6, -7.0], [6.5, -2.7], [5.7, 1.4], [3.8, 4.6], [0, 7.3], [-3.8, 4.6], [-5.7, 1.4], [-6.5, -2.7]]
const QUEBRA_DO_ESCUDO: readonly Ponto[] = [[0.9, -7.0], [-0.2, -4.6], [1.0, -2.4], [-0.3, 0.2], [0.8, 2.6], [-0.4, 4.8], [0.3, 7.0]]
const METADE_ESQUERDA: readonly Ponto[] = [[-6.6, -7.0], ...QUEBRA_DO_ESCUDO, [-3.8, 4.6], [-5.7, 1.4], [-6.5, -2.7]]
const METADE_DIREITA: readonly Ponto[] = [[6.6, -7.0], [6.5, -2.7], [5.7, 1.4], [3.8, 4.6], [0.2, 7.3], ...[...QUEBRA_DO_ESCUDO].reverse()]
/** A asna clara (o V de cabeça para baixo) e os rebites das alças (o do meio saltou na quebra). */
const ASNA: readonly Ponto[] = [[-7, 1.2], [0, -3.8], [7, 1.2], [7, 4.2], [0, -0.8], [-7, 4.2]]
const REBITES_DO_ESCUDO: readonly Ponto[] = [[-3.8, -5.4], [3.8, -5.4]]
/** A beira de aço (px do desenho) e o quanto a pintura lascou junto da quebra, mostrando a madeira crua. */
const BEIRA_DO_ESCUDO = 0.9
const LASCADO_DA_PINTURA = 0.6
/**
 * Onde o escudo caiu [x, y, giro] (deitado debaixo do braço, o bico para as pernas) e o quanto cada metade se
 * abriu: girada em volta do bico e afastada de través, como um escudo rachado por um machado de cima.
 */
const ESCUDO_NO_CHAO = [0.4, 20.8, -1.62] as const
const BICO_DO_ESCUDO: Ponto = [0, 7.3]
const METADES_DO_ESCUDO: readonly (readonly [number, number])[] = [
  [-0.07, -0.5],
  [0.11, 0.8],
]

/** A pintura do escudo deitado: gasta, falhando aqui e ali onde bateram nela. */
const texDaTinta: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.2 + p.sv, y * 0.2) * 0.08
  s[5] = limitar(0.92 + ruido(x * 0.55 + p.su, y * 0.55 + p.sv) * 0.9, 0.5, 1)
}

function montarEscudo(o: Obra): void {
  const { regua } = o
  const k = regua.k
  const inteiro = poligono(ESCUDO)
  const campoInteiro: Forma = { b: inteiro.b, d: (x, y) => inteiro.d(x, y) + BEIRA_DO_ESCUDO }
  const asna = poligono(ASNA)
  const base = lugarDe(regua, ESCUDO_NO_CHAO[0], ESCUDO_NO_CHAO[1], ESCUDO_NO_CHAO[2])
  METADES_DO_ESCUDO.forEach(([giro, desvio], i) => {
    const ang = ESCUDO_NO_CHAO[2] + giro
    const l = giradoEm(base, giro, BICO_DO_ESCUDO, [desvio, 0])
    const metade = poligono(i === 0 ? METADE_ESQUERDA : METADE_DIREITA)
    // A madeira vai até a quebra (sem beira de aço nela) e a pintura para um pouco antes, lascada.
    const campo = dentroDe(campoInteiro, metade)
    const pintura = dentroDe(campo, { b: metade.b, d: (px, py) => metade.d(px, py) + LASCADO_DA_PINTURA })
    const semente = 6400 + i * 10
    assentar(o, noLugar(l, metade), 1.6)
    porAco(o, l, metade, { relevo: PLANO, reflexo: 24, bisel: 0.8, tom: 0.9, projeta: 0.8 }, semente)
    por(o, l, campo, TABUAS_DO_ESCUDO, { eixo: ang + QUARTO, tabua: 3.3 * k, bisel: 0.5 * k, tom: 0.9, contorno: 0.2, semente: semente + 1 })
    por(o, l, pintura, TINTA, { bisel: 0, contorno: 0, textura: texDaTinta, semente: semente + 2 })
    por(o, l, dentroDe(asna, pintura), TINTA_CLARA, { bisel: 0, contorno: 0.1, textura: texDaTinta, semente: semente + 3 })
    porRebite(o, l, REBITES_DO_ESCUDO[i], 0.55, ACO, semente + 4)
  })
}

// ---------- os braços e as pernas ----------

/** Um tubo de braço ou de perna: de onde até onde (px do desenho), a meia largura em cada ponta, a barriga do meio e as marcas. */
interface Tubo {
  readonly de: Ponto
  readonly ate: Ponto
  readonly largura: readonly [number, number, number]
  /** A peça tem a quina ao comprido (a greva na canela, o coxote na coxa); o braço é redondo. */
  readonly quina: boolean
  readonly marcas: Marcas
}

/** A forma do tubo deitado ao longo de x, de 0 a `comp`, com os cantos das bocas quebrados. */
function formaDoTubo(comp: number, w0: number, w1: number, barriga: number): Forma {
  const meio = comp * 0.4
  const wm = (w0 + w1) / 2 + barriga
  const q0 = w0 * 0.3
  const q1 = w1 * 0.3
  return poligono([[0, -w0 + q0], [q0, -w0], [meio, -wm], [comp - q1, -w1], [comp, -w1 + q1], [comp, w1 - q1], [comp - q1, w1], [meio, wm], [q0, w0], [0, w0 - q0]])
}

/**
 * O tubo de través: redondo no braço; na perna, duas abas quase planas que se encontram na quina do meio (o
 * degrau de luz e o fio claro), que é o que separa a peça de armadura de um cano. A meia largura muda ao longo
 * dele (afina e tem barriga), e a curva acompanha.
 */
function relevoDoTubo(comp: number, w0: number, w1: number, barriga: number, quina: boolean): Relevo {
  const meio = comp * 0.4
  const wm = (w0 + w1) / 2 + barriga
  return (lx, ly, saida) => {
    const t = limitar(lx, 0, comp)
    const w = t < meio ? w0 + ((wm - w0) * t) / meio : wm + ((w1 - wm) * (t - meio)) / (comp - meio)
    const q = limitar(ly / w, -1, 1)
    if (!quina) {
      saida[1] = q * 0.85
      return
    }
    saida[1] = q * 0.55 + (ly < 0 ? -ABA_DA_QUINA : ABA_DA_QUINA) * Math.min(1, Math.abs(ly) / 0.5)
    const naQuina = ly / 0.4
    saida[2] = FIO_DA_QUINA * Math.exp(-naQuina * naQuina)
  }
}

/** O quanto cada aba da peça de perna se inclina para o seu lado da quina. */
const ABA_DA_QUINA = 0.3
/** A altura de um tubo deitado (px do desenho), para a sombra: a grossura dele. */
const ALTURA_DO_TUBO = 4.2

/** O tubo: a peça, o oco escuro e a beira virada da boca larga (vazio por dentro). */
function porTubo(o: Obra, t: Tubo, semente: number): void {
  const { regua } = o
  const k = regua.k
  const [ax, ay] = regua.em(t.de[0], t.de[1])
  const [bx, by] = regua.em(t.ate[0], t.ate[1])
  const comp = Math.hypot(bx - ax, by - ay) / k
  const ang = Math.atan2(by - ay, bx - ax)
  const l: Lugar = { cx: ax, cy: ay, co: Math.cos(ang), si: Math.sin(ang), k }
  const [w0, w1, barriga] = t.largura
  const forma = formaDoTubo(comp, w0, w1, barriga)
  assentar(o, noLugar(l, forma), ALTURA_DO_TUBO)
  porAco(o, l, forma, { relevo: relevoDoTubo(comp, w0, w1, barriga, t.quina), reflexo: 44, bisel: 1.0, marcas: t.marcas, projeta: 0.7 }, semente)
  por(o, l, dentroDe(elipse(-0.3, 0, 1.0, w0 * 0.72), forma), VAO, { bisel: 0, contorno: 0, alfa: 0.85, semente: semente + 1 })
  por(o, l, capsula(0.6, -w0 + 0.6, 0.6, w0 - 0.6, 0.42), ACO, { bisel: 0.4 * k, tom: 1.14, contorno: 0.18, metal: 0.4, semente: semente + 2 })
}

/**
 * A concha da cotoveleira ou da joelheira, comprida ao longo do braço ou da perna (x), com a quina do meio: uma
 * cúpula baixa, e não uma bola (as bolas nas juntas liam como um boneco de robô).
 */
function relevoDaConcha(rx: number, ry: number): Relevo {
  return (lx, ly, saida) => {
    const nx = limitar(lx / rx, -1, 1)
    saida[0] = nx * 0.7
    saida[1] = limitar(ly / ry, -1, 1) * 0.5 + (ly < 0 ? -ABA_DA_QUINA : ABA_DA_QUINA) * Math.min(1, Math.abs(ly) / 0.5)
    const naQuina = ly / 0.4
    saida[2] = FIO_DA_QUINA * Math.exp(-naQuina * naQuina) * (1 - nx * nx)
  }
}

/** A cotoveleira ou a joelheira: a concha comprida com a quina e, para o lado de fora (y positivo), a asa em leque com os vincos. */
function porConcha(o: Obra, x: number, y: number, ang: number, r: number, semente: number): void {
  const { regua } = o
  const l = lugarDe(regua, x, y, ang)
  const asa = elipse(0, r * 0.78, r * 1.0, r * 0.62)
  const concha = elipse(0, 0, r * 1.3, r * 0.78)
  assentar(o, noLugar(l, uniao(asa, concha)), r * 1.2)
  porAco(o, l, asa, { relevo: cupula(0, r * 0.78, r * 1.0, r * 0.62, 0.55), reflexo: 30, bisel: 0.6, tom: 0.9, projeta: 0.5 }, semente)
  for (const a of [-0.6, 0, 0.6]) {
    por(o, l, capsula(Math.sin(a) * r * 0.4, r * 0.72, Math.sin(a) * r * 0.95, r * 1.25, 0.15), VAO, { bisel: 0, contorno: 0, alfa: 0.45, semente: semente + 1 })
  }
  porAco(o, l, concha, { relevo: relevoDaConcha(r * 1.3, r * 0.78), reflexo: 50, bisel: 0.9, projeta: 0.7 }, semente + 2)
  for (const lado of [-1, 1]) porRebite(o, l, [lado * r * 0.98, 0], 0.4, ACO, semente + 3)
}

/** Os dedos da manopla: [y da raiz, comprimento] (px do desenho da manopla). */
const DEDOS: readonly (readonly [number, number])[] = [
  [-1.8, 3.4],
  [-0.6, 4.0],
  [0.6, 3.8],
  [1.8, 3.2],
]
const RAIO_DO_DEDO = 0.6

/** A manopla deitada, ao longo de x: o punho em sino na boca, o dorso em lâminas, os nós, os dedos e o polegar; `fechada` = os dedos dobrados. */
function montarManopla(o: Obra, x: number, y: number, ang: number, fechada: boolean, semente: number): void {
  const { regua } = o
  const k = regua.k
  const l = lugarDe(regua, x, y, ang)
  const sino = poligono([[0, -3.4], [4.6, -2.5], [4.6, 2.5], [0, 3.4]])
  const dorso = caixa(4.2, -2.6, 8.8, 2.6, 1.1)
  const polegar = capsula(5.6, -2.5, 8.2, -4.3, 0.85)
  const dedos = DEDOS.map(([dy, comp]) => capsula(9.2, dy, 9.2 + (fechada ? comp * 0.48 : comp), dy * 1.08, RAIO_DO_DEDO))
  const fim = 9.2 + 4.0 * (fechada ? 0.48 : 1)
  assentar(o, noLugar(l, uniao(uniao(sino, dorso), uniao(polegar, caixa(8.6, -2.4, fim, 2.4, 0.6)))), 3.6)
  dedos.forEach((dedo, i) => {
    const dy = DEDOS[i][0]
    porAco(o, l, dedo, { relevo: cilindro(dy, RAIO_DO_DEDO, 0.6), reflexo: 30, bisel: 0.55, tom: 0.94 }, semente + i)
    // A dobra de cada dedo; o dedo dobrado mostra a ponta escura, virada para o chão.
    const meio = 9.2 + DEDOS[i][1] * (fechada ? 0.3 : 0.5)
    por(o, l, capsula(meio, dy - 0.5, meio, dy + 0.5, 0.16), VAO, { bisel: 0, contorno: 0, alfa: 0.6, semente: semente + 4 })
    if (fechada) por(o, l, elipse(9.2 + DEDOS[i][1] * 0.48, dy * 1.08, 0.5, 0.55), VAO, { bisel: 0, contorno: 0, alfa: 0.55, semente: semente + 5 })
  })
  porAco(o, l, polegar, { relevo: cupula(6.9, -3.4, 1.8, 1.8, 0.6), reflexo: 30, bisel: 0.7, tom: 0.96 }, semente + 6)
  porAco(o, l, dorso, { relevo: cupula(6.5, 0, 3.0, 3.0, 0.7), reflexo: 44, bisel: 0.9, projeta: 0.6 }, semente + 7)
  for (const lx of [5.7, 7.2]) por(o, l, capsula(lx, -2.3, lx, 2.3, 0.18), VAO, { bisel: 0, contorno: 0, alfa: 0.5, semente: semente + 8 })
  porAco(o, l, capsula(8.8, -2.4, 8.8, 2.4, 0.75), { relevo: cilindro(0, 2.4, 0.3), reflexo: 40, bisel: 0.6, tom: 1.06, projeta: 0.4 }, semente + 9)
  porAco(o, l, sino, { relevo: cupula(2.3, 0, 3.4, 3.4, 0.7), reflexo: 48, bisel: 0.9, projeta: 0.7 }, semente + 10)
  por(o, l, capsula(0.5, -3.1, 0.5, 3.1, 0.45), ACO, { bisel: 0.4 * k, tom: 1.14, contorno: 0.2, metal: 0.4, semente: semente + 11 })
  por(o, l, dentroDe(elipse(-0.3, 0, 1.0, 2.6), sino), VAO, { bisel: 0, contorno: 0, alfa: 0.85, semente: semente + 12 })
}

/**
 * O pé de ferro tombado de lado, de perfil (x do tornozelo para o bico, y do peito do pé para a sola): a bota
 * com o calcanhar, o peito do pé em lâminas e o bico.
 */
const BOTA: readonly Ponto[] = [[-2.2, -2.8], [-1.4, -3.7], [1.6, -3.8], [3.8, -2.5], [6.2, -1.5], [8.4, -0.7], [9.6, 0.5], [9.1, 1.6], [4.0, 1.95], [-0.6, 1.95], [-2.4, 1.3], [-2.7, -0.8]]
/** As juntas das lâminas do peito do pé, do alto para baixo [de x, de y, até x, até y]. */
const LAMINAS_DA_BOTA: readonly (readonly [number, number, number, number])[] = [
  [1.4, -3.4, 1.9, 0.8],
  [3.0, -2.7, 3.5, 1.0],
  [4.6, -2.0, 5.0, 1.1],
  [6.3, -1.4, 6.6, 1.2],
]
/** A sola de couro, embaixo. */
const SOLA: readonly Ponto[] = [[-2.0, 1.45], [4.0, 1.6], [8.7, 1.3]]

/** O pé de ferro: a bota, as juntas das lâminas, a sola de couro e a boca escura do tornozelo; `lado` espelha o perfil. */
function montarPe(o: Obra, x: number, y: number, ang: number, lado: 1 | -1, semente: number): void {
  const { regua } = o
  const l = lugarDe(regua, x, y, ang)
  const espelho = (pontos: readonly Ponto[]): Ponto[] => pontos.map(([px, py]): Ponto => [px, py * lado])
  const bota = poligono(espelho(BOTA))
  assentar(o, noLugar(l, bota), 3.6)
  porAco(o, l, bota, { relevo: cupula(3.6, -0.6 * lado, 6.6, 3.2, 0.75), reflexo: 40, bisel: 0.9, projeta: 0.6 }, semente)
  LAMINAS_DA_BOTA.forEach(([ax, ay, bx, by]) => por(o, l, capsula(ax, ay * lado, bx, by * lado, 0.17), VAO, { bisel: 0, contorno: 0, alfa: 0.55, semente: semente + 1 }))
  por(o, l, cadeia(espelho(SOLA), 0.42), COURO, { bisel: 0.3 * regua.k, contorno: 0.2, tom: 0.85, semente: semente + 2 })
  por(o, l, elipse(0.1, -3.2 * lado, 1.6, 0.55), VAO, { bisel: 0, contorno: 0, alfa: 0.85, semente: semente + 3 })
}

/** Os braços: o braçal (do ombro ao cotovelo), a cotoveleira e o antebraço, o de cima e o de baixo (px do desenho). */
const BRACAL_DE_CIMA: Tubo = { de: [-9.6, -18.2], ate: [-2.4, -21.4], largura: [2.5, 2.2, 0], quina: false, marcas: { amassados: [], riscos: [[1.6, -1.6, 5.8, 0.6]] } }
const ANTEBRACO_DE_CIMA: Tubo = { de: [1.6, -22.2], ate: [10.0, -20.8], largura: [2.2, 1.85, 0], quina: false, marcas: { amassados: [[4.2, -0.8, 1.8, 0.14]], riscos: [] } }
const BRACAL_DE_BAIXO: Tubo = { de: [-17.8, 11.8], ate: [-20.2, 19.6], largura: [2.5, 2.2, 0], quina: false, marcas: SEM_MARCAS }
const ANTEBRACO_DE_BAIXO: Tubo = { de: [-18.6, 23.8], ate: [-8.8, 24.6], largura: [2.2, 1.85, 0], quina: false, marcas: { amassados: [], riscos: [[2.0, 1.2, 7.4, -0.8]] } }
const COTOVELOS: readonly (readonly [number, number, number])[] = [
  [-0.4, -22.6, -0.4],
  [-20.8, 22.0, 2.4],
]

/** As pernas: o coxote (do quadril ao joelho), a joelheira, a greva e o pé; a de cima dobrada, a de baixo esticada. */
const COXOTE_DE_CIMA: Tubo = { de: [10.2, -4.6], ate: [24.4, -10.6], largura: [3.3, 2.6, 0], quina: true, marcas: { amassados: [[8.6, 1.2, 2.2, 0.14]], riscos: [[2.4, -2.2, 8.0, 0.4]] } }
const GREVA_DE_CIMA: Tubo = { de: [28.6, -13.8], ate: [27.9, -21.6], largura: [2.3, 1.9, 0.5], quina: true, marcas: SEM_MARCAS }
const COXOTE_DE_BAIXO: Tubo = { de: [9.0, 9.6], ate: [22.6, 15.6], largura: [3.3, 2.6, 0], quina: true, marcas: { amassados: [], riscos: [[3.0, 1.8, 9.6, -1.0]] } }
const GREVA_DE_BAIXO: Tubo = { de: [27.4, 17.6], ate: [35.8, 20.2], largura: [2.3, 1.9, 0.5], quina: true, marcas: { amassados: [[5.4, 0.8, 1.9, 0.14]], riscos: [] } }
const JOELHOS: readonly (readonly [number, number, number])[] = [
  [26.8, -12.0, -0.5],
  [25.0, 16.6, 0.6],
]
/**
 * Os pés, tombados de lado como as pernas: [x, y do tornozelo, giro, lado]. O peito do pé fica para o joelho e
 * a sola para fora (`lado` espelha o perfil): o de cima com o bico para a direita, o de baixo com o bico para o alto.
 */
const PES: readonly (readonly [number, number, number, 1 | -1])[] = [
  [28.4, -24.4, 0, -1],
  [38.6, 20.4, -Math.PI / 2, 1],
]
/** A manopla que ficou na ponta do braço de cima e a que voou para além dos joelhos [x, y, giro]. */
const MANOPLA_NO_LUGAR = [10.6, -20.6, 0.05] as const
const MANOPLA_LONGE = [39.8, -4.6, 2.2] as const

function montarPernas(o: Obra): void {
  PES.forEach(([x, y, ang, lado], i) => montarPe(o, x, y, ang, lado, 6500 + i * 10))
  porTubo(o, GREVA_DE_BAIXO, 6520)
  porTubo(o, GREVA_DE_CIMA, 6525)
  JOELHOS.forEach(([x, y, ang], i) => porConcha(o, x, y, ang, 3.0, 6530 + i * 5))
  porTubo(o, COXOTE_DE_BAIXO, 6540)
  porTubo(o, COXOTE_DE_CIMA, 6545)
}

function montarBracos(o: Obra): void {
  porTubo(o, ANTEBRACO_DE_BAIXO, 6600)
  montarManopla(o, MANOPLA_NO_LUGAR[0], MANOPLA_NO_LUGAR[1], MANOPLA_NO_LUGAR[2], false, 6605)
  porTubo(o, ANTEBRACO_DE_CIMA, 6620)
  COTOVELOS.forEach(([x, y, ang], i) => porConcha(o, x, y, ang, 2.6, 6625 + i * 5))
  porTubo(o, BRACAL_DE_BAIXO, 6640)
  porTubo(o, BRACAL_DE_CIMA, 6645)
}

// ---------- as ombreiras ----------

/** As lâminas da ombreira, de baixo para cima: [meio x, meio y, raio x, raio y, tom] (as do manequim, em volta do meio). */
const OMBREIRA: readonly (readonly [number, number, number, number, number])[] = [
  [0.5, 5.4, 5.8, 2.9, 0.86],
  [0.1, 3.0, 6.3, 3.4, 0.94],
  [-0.5, 0, 6.2, 4.6, 1.02],
]
const REBITES_DA_OMBREIRA: readonly Ponto[] = [[2.7, -1.9], [-3.9, 1.4], [3.9, 2.2], [3.5, 4.5]]
/** A que ficou no ombro e a que caiu longe [x, y, giro], com os amassados e os riscos da lâmina de cima. */
const OMBREIRA_NO_OMBRO = [-14.0, -15.0, -0.3] as const
const OMBREIRA_CAIDA = [-33.4, 17.0, 2.6] as const
const MARCAS_DA_OMBREIRA_NO_OMBRO: Marcas = { amassados: [[-2.4, -1.6, 2.4, 0.14]], riscos: [[-4.6, 1.8, 2.6, -2.8]] }
const MARCAS_DA_OMBREIRA_CAIDA: Marcas = { amassados: [[2.0, -0.6, 2.6, 0.15]], riscos: [] }
/** A correia arrebentada que ficou presa na ombreira caída (no desenho dela). */
const CORREIA_DA_OMBREIRA: readonly Ponto[] = [[5.6, 1.2], [8.8, 2.8], [11.6, 2.2]]

function montarOmbreira(o: Obra, [x, y, ang]: readonly [number, number, number], marcas: Marcas, correia: boolean, semente: number): void {
  const l = lugarDe(o.regua, x, y, ang)
  if (correia) porTira(o, CORREIA_DA_OMBREIRA.map((p) => pontoNoLugar(l, p)), semente + 8)
  assentar(o, noLugar(l, uniao(elipse(0.5, 5.4, 5.8, 2.9), elipse(-0.5, 0, 6.2, 4.6))), 4.6)
  OMBREIRA.forEach(([mx, my, rx, ry, tom], i) => {
    porAco(o, l, elipse(mx, my, rx, ry), { relevo: cupula(mx, my, rx, ry, 0.8), reflexo: 46, bisel: 1.4, tom, marcas: i === OMBREIRA.length - 1 ? marcas : SEM_MARCAS, projeta: 1 }, semente + i)
  })
  REBITES_DA_OMBREIRA.forEach((ponto, i) => porRebite(o, l, ponto, 0.55, ACO, semente + 4 + i))
}

// ---------- o peitoral rachado e a fralda ----------

/** O peitoral, só a metade da direita, do meio do pescoço ao bico de baixo (a do manequim). */
const MEIO_PEITORAL: readonly Ponto[] = [
  [0, -14.6],
  [2.2, -15.0],
  [3.9, -16.2],
  [6.0, -16.6],
  [8.8, -15.6],
  [10.6, -12.8],
  [10.9, -9.0],
  [10.5, -5.0],
  [9.6, -1.5],
  [8.5, 1.4],
  [8.2, 2.8],
  [5.0, 3.4],
  [2.0, 4.4],
  [0, 5.0],
]
/** O flanco da esquerda, afundado pelo golpe (os pontos do contorno espelhado que ele entortou, pelo índice). */
const AMASSOS_DA_ESQUERDA: Readonly<Partial<Record<number, Ponto>>> = { 7: [-9.4, -5.4], 8: [-8.7, -2.0] }
/** A rachadura da quina, do bico de baixo ao pescoço: a beira rasgada que as duas metades dividem. */
const RACHADURA: readonly Ponto[] = [[0, 5.0], [0.4, 2.2], [0.1, -0.8], [0.7, -3.6], [-0.1, -6.8], [0.4, -10.4], [0, -14.6]]
/** O quanto cada metade abriu em volta do bico (radianos), o bico e o quanto elas se afastaram de través. */
const ABERTURA_DO_V = 0.085
const PIVO_DO_V: Ponto = [0, 4.4]
const AFASTAMENTO_DO_V = 0.55
/** A meia largura do peito em cada altura [y, meia largura]: a luz de través anda por ela. */
const LARGURA_DO_PEITO: readonly (readonly [number, number])[] = [
  [-16.6, 9.0],
  [-12.8, 10.6],
  [-9.0, 10.9],
  [-5.0, 10.5],
  [-1.5, 9.6],
  [1.4, 8.5],
  [9.8, 9.7],
]
/** O alto do peito (o ponto mais perto de quem olha) e a queda dele para o pescoço e para a cintura. */
const ALTO_DO_PEITO = -7
const QUEDA_DO_PEITO = 11
/** A quina do meio: o degrau de luz entre as duas metades e o fio claro dela. */
const DEGRAU_DA_QUINA = 0.1
const FIO_DA_QUINA = 0.12
/** As beiras viradas do pescoço, da cava e da cintura, só a metade da direita (a da esquerda é o espelho). */
const BEIRA_DO_PESCOCO: readonly Ponto[] = [[0.5, -14.2], [2.0, -14.6], [3.8, -15.3], [5.7, -16.0]]
const BEIRA_DA_CAVA: readonly Ponto[] = [[6.7, -16.2], [8.8, -15.1], [10.2, -12.6], [10.5, -9.4]]
const BEIRA_DA_CINTURA: readonly Ponto[] = [[0.6, 4.5], [2.4, 4.0], [5.2, 3.0], [7.8, 2.4]]
const RAIO_DA_BEIRA = 0.68
/** Os amassados e os riscos de cada metade (no desenho do peitoral). */
const MARCAS_DA_DIREITA: Marcas = {
  amassados: [[5.2, -8.6, 4.0, 0.13], [7.0, -1.8, 2.4, 0.12]],
  riscos: [[2.0, -12.4, 8.8, -6.0], [2.8, -3.6, 8.2, -0.4]],
}
const MARCAS_DA_ESQUERDA: Marcas = {
  amassados: [[-4.6, -9.0, 3.4, 0.16]],
  riscos: [[-9.0, -11.4, -3.0, -6.2], [-7.8, -2.4, -2.2, 1.6], [-6.4, -14.2, -1.8, -11.8]],
}
/** As duas lâminas da fralda, a de baixo primeiro (essa saltou dos rebites e entortou). */
const FRALDA: readonly (readonly Ponto[])[] = [
  [[-8.9, 3.6], [8.9, 3.6], [9.7, 8.4], [4.8, 9.0], [0, 9.8], [-4.8, 9.0], [-9.7, 8.4]],
  [[-8.4, 1.2], [8.4, 1.2], [9.1, 5.6], [4.6, 6.2], [0, 7.0], [-4.6, 6.2], [-9.1, 5.6]],
]
const GIRO_DA_LAMINA_SOLTA = 0.2
const PIVO_DA_LAMINA_SOLTA: Ponto = [9.0, 6.0]
const DESVIO_DA_LAMINA_SOLTA: Ponto = [0.6, 1.6]
/** O peitoral na pegada: o meio da cintura (px do desenho) e o giro (o pescoço para o elmo, a cintura para as pernas). */
const PEITO = [-1.5, 0.8, -1.37] as const
/** As correias do flanco, arrebentadas: a da direita e a da esquerda (no desenho do peitoral). */
const CORREIAS_DO_FLANCO: readonly (readonly Ponto[])[] = [
  [[9.4, -3.6], [13.2, -3.0], [16.4, -4.2]],
  [[-9.0, -3.2], [-12.8, -2.2], [-15.8, -3.4]],
]

/** A meia largura do peito na altura `y` (px do desenho). */
function meiaLarguraDoPeito(y: number): number {
  if (y <= LARGURA_DO_PEITO[0][0]) return LARGURA_DO_PEITO[0][1]
  for (let i = 1; i < LARGURA_DO_PEITO.length; i += 1) {
    const [y1, m1] = LARGURA_DO_PEITO[i]
    if (y <= y1) {
      const [y0, m0] = LARGURA_DO_PEITO[i - 1]
      return m0 + ((m1 - m0) * (y - y0)) / (y1 - y0)
    }
  }
  return LARGURA_DO_PEITO[LARGURA_DO_PEITO.length - 1][1]
}

/** O peito deitado: redondo de través, com a quina no meio (o degrau e o fio claro), alto no peito e caindo para as pontas. */
const relevoDoPeito: Relevo = (lx, ly, saida) => {
  const q = limitar(lx / meiaLarguraDoPeito(ly), -1, 1)
  saida[0] = 0.7 * q + (lx < 0 ? -DEGRAU_DA_QUINA : DEGRAU_DA_QUINA) * Math.min(1, Math.abs(lx) / 0.8)
  saida[1] = 0.45 * limitar((ly - ALTO_DO_PEITO) / QUEDA_DO_PEITO, -1, 1)
  const naQuina = lx / 0.45
  saida[2] = FIO_DA_QUINA * Math.exp(-naQuina * naQuina) * (ly < 3 ? 1 : 0)
}

/** A lâmina da fralda: a faixa que dá a volta no quadril, alta no meio e caindo para os lados. */
const relevoDaLamina: Relevo = (lx, _ly, saida) => {
  saida[0] = 0.6 * limitar(lx / 9.5, -1, 1)
  saida[1] = 0.16
}

/** O espelho de uma linha da metade da direita. */
function espelhada(pontos: readonly Ponto[]): Ponto[] {
  return pontos.map(([x, y]): Ponto => [-x, y])
}

function montarFralda(o: Obra, peito: Lugar): void {
  const k = o.regua.k
  FRALDA.forEach((lamina, i) => {
    const l = i === 0 ? giradoEm(peito, GIRO_DA_LAMINA_SOLTA, PIVO_DA_LAMINA_SOLTA, DESVIO_DA_LAMINA_SOLTA) : peito
    const forma = poligono(lamina)
    assentar(o, noLugar(l, forma), 2.6)
    porAco(o, l, forma, { relevo: relevoDaLamina, reflexo: 30, bisel: 1.1, tom: 0.86 + i * 0.06, projeta: 0.8 }, 6700 + i * 4)
    for (const lado of [-1, 1]) {
      const [x, y] = pontoNoLugar(l, [lado * 7.8, i === 0 ? 4.7 : 2.3])
      o.cena.partes.push(o.c.peca(elipse(x, y, 0.55 * k, 0.55 * k), LATAO, { bisel: 0.55 * k, tom: 1.08, contorno: 0.2, metal: 0.5, semente: 6702 + i * 4 }))
    }
  })
}

/** O PEITORAL rachado: as correias do flanco por baixo, a fralda, as duas metades abertas em V com as beiras viradas e os rebites do pescoço. */
function montarPeitoral(o: Obra): void {
  const { regua } = o
  const peito = lugarDe(regua, PEITO[0], PEITO[1], PEITO[2])
  CORREIAS_DO_FLANCO.forEach((correia, i) => porTira(o, correia.map((p) => pontoNoLugar(peito, p)), 6710 + i * 5))
  montarFralda(o, peito)
  const direita = poligono([...MEIO_PEITORAL, ...RACHADURA.slice(1, -1)])
  const esquerda = poligono([...MEIO_PEITORAL.map((p, i): Ponto => AMASSOS_DA_ESQUERDA[i] ?? [-p[0], p[1]]), ...RACHADURA.slice(1, -1)])
  const metades = [
    { forma: direita, lado: 1, marcas: MARCAS_DA_DIREITA },
    { forma: esquerda, lado: -1, marcas: MARCAS_DA_ESQUERDA },
  ] as const
  metades.forEach(({ forma, lado, marcas }, i) => {
    const l = giradoEm(peito, lado * ABERTURA_DO_V, PIVO_DO_V, [lado * AFASTAMENTO_DO_V, 0])
    const semente = 6730 + i * 10
    assentar(o, noLugar(l, forma), 6)
    porAco(o, l, forma, { relevo: relevoDoPeito, reflexo: 46, bisel: 1.5, marcas, projeta: 1.1 }, semente)
    const beiras: readonly (readonly Ponto[])[] = [BEIRA_DO_PESCOCO, BEIRA_DA_CAVA, BEIRA_DA_CINTURA]
    const linhas: readonly (readonly Ponto[])[] = lado > 0 ? beiras : beiras.map(espelhada)
    linhas.forEach((beira, j) => porAco(o, l, cadeia(beira, RAIO_DA_BEIRA), { relevo: relevoDoPeito, reflexo: 40, bisel: 0.55, tom: 1.1 }, semente + 1 + j))
    porRebite(o, l, [lado * 3.4, -13.0], 0.5, LATAO, semente + 5)
  })
}

// ---------- o gorjal ----------

/** O gorjal: onde caiu [x, y, giro] e o vão de trás que o deixa aberto em C. */
const GORJAL = [-24.4, 7.4, 0.35] as const

function montarGorjal(o: Obra): void {
  const l = lugarDe(o.regua, GORJAL[0], GORJAL[1], GORJAL[2])
  const vao = caixa(-2.3, 1.0, 2.3, 6.6, 0.5)
  const fora = menos(menos(elipse(0, 0, 6.6, 5.2), elipse(0, 0.5, 4.5, 3.3)), vao)
  const dentro = menos(menos(elipse(0, 0.25, 5.2, 4.0), elipse(0, 0.6, 3.5, 2.5)), vao)
  assentar(o, noLugar(l, fora), 2.8)
  porAco(o, l, fora, { relevo: anelDeLamina(0.2, 5.6, 4.3, 1.05, 0.8), reflexo: 40, bisel: 0.9, tom: 0.92, projeta: 0.6 }, 6800)
  porAco(o, l, dentro, { relevo: anelDeLamina(0.45, 4.35, 3.25, 0.85, 0.8), reflexo: 44, bisel: 0.8, tom: 1.02, marcas: { amassados: [], riscos: [[-3.6, -2.4, 0.4, -3.6]] }, projeta: 0.5 }, 6801)
  for (const lado of [-1, 1]) porRebite(o, l, [lado * 3.3, 2.6], 0.45, LATAO, 6802)
}

// ---------- o elmo e a viseira ----------

/**
 * O elmo caído de costas e tombado para o lado: onde caiu [x, y, giro] (o queixo para o peito) e a altura dele
 * deitado, para a sombra. O desenho é de frente (x de través, y da calota para o queixo): a calota, as faces que
 * descem estreitando até o queixo, a viseira levantada sobre a testa, a cara aberta embaixo dela e a queixeira.
 */
const ELMO = [-29.0, -8.4, -1.14] as const
const ALTURA_DO_ELMO = 8
const CALOTA = { x: 0, y: -1.6, rx: 6.2, ry: 6.4 } as const
const FACES: readonly Ponto[] = [[-6.0, -1.6], [6.0, -1.6], [5.9, 1.4], [5.0, 4.4], [3.0, 6.8], [0, 7.8], [-3.0, 6.8], [-5.0, 4.4], [-5.9, 1.4]]
/** A queixeira, com a quina de pé no meio e os furos de respirar de um lado. */
const QUEIXEIRA: readonly Ponto[] = [[-5.5, 2.2], [5.5, 2.2], [5.0, 4.4], [3.0, 6.8], [0, 7.8], [-3.0, 6.8], [-5.0, 4.4]]
const RESPIROS: readonly Ponto[] = [[2.3, 3.7], [3.3, 3.4], [2.3, 4.9], [3.3, 4.6]]
/** A cara aberta (o vão em que a viseira fechava), entre a viseira e a queixeira. */
const CARA = { x0: -4.3, y0: -1.6, x1: 4.3, y1: 2.8 } as const
/** A viseira levantada sobre a testa: a placa de bico, a fresta dos olhos dos dois lados da quina e os pinos. */
const VISEIRA: readonly Ponto[] = [[-5.7, -1.2], [-5.3, -4.6], [-3.1, -6.3], [0, -6.9], [3.1, -6.3], [5.3, -4.6], [5.7, -1.2], [2.6, -0.5], [0, 0], [-2.6, -0.5]]
const FRESTAS: readonly (readonly [number, number, number, number])[] = [
  [-4.3, -3.2, -0.8, -3.7],
  [0.8, -3.7, 4.3, -3.2],
]
const PINOS_DA_VISEIRA: readonly Ponto[] = [[-5.8, -1.3], [5.8, -1.3]]
const MARCAS_DO_ELMO: Marcas = { amassados: [[-3.6, 1.0, 2.2, 0.14]], riscos: [[3.2, -7.6, 5.6, -4.4]] }
const MARCAS_DA_VISEIRA: Marcas = { amassados: [[2.8, -4.6, 2.2, 0.15]], riscos: [[-5.0, -5.2, -1.6, -1.6]] }

/** A placa de pé com a quina no meio (a viseira, a queixeira): convexa de través, com o degrau e o fio claro da quina. */
function relevoDeQuina(meia: number, cy: number, altura: number): Relevo {
  return (lx, ly, saida) => {
    saida[0] = 0.55 * limitar(lx / meia, -1, 1) + (lx < 0 ? -DEGRAU_DA_QUINA : DEGRAU_DA_QUINA) * Math.min(1, Math.abs(lx) / 0.6)
    saida[1] = 0.35 * limitar((ly - cy) / altura, -1, 1)
    const naQuina = lx / 0.4
    saida[2] = FIO_DA_QUINA * Math.exp(-naQuina * naQuina)
  }
}

function montarElmo(o: Obra): void {
  const { regua } = o
  const k = regua.k
  const l = lugarDe(regua, ELMO[0], ELMO[1], ELMO[2])
  const casco = uniao(elipse(CALOTA.x, CALOTA.y, CALOTA.rx, CALOTA.ry), poligono(FACES))
  assentar(o, noLugar(l, casco), ALTURA_DO_ELMO, 0.3)
  porAco(o, l, casco, { relevo: cupula(0, -0.6, 6.6, 8.4, 0.85), reflexo: 56, bisel: 1.6, marcas: MARCAS_DO_ELMO, projeta: 1.1 }, 6900)
  // A cara aberta: o oco escuro de dentro (vazio).
  por(o, l, dentroDe(caixa(CARA.x0, CARA.y0, CARA.x1, CARA.y1, 1.1), casco), VAO, { bisel: 0, contorno: 0.12, recesso: { k: 1.2 * k, forca: 0.35 }, semente: 6902 })
  // A queixeira, com a quina, os respiros e a beira virada de cima.
  const queixeira = poligono(QUEIXEIRA)
  porAco(o, l, queixeira, { relevo: relevoDeQuina(5.5, 5.0, 3.0), reflexo: 50, bisel: 1.0, projeta: 0.8 }, 6903)
  porAco(o, l, capsula(-4.9, 2.5, 4.9, 2.5, 0.5), { relevo: cilindro(2.5, 0.5, 0.5), reflexo: 40, bisel: 0.45, tom: 1.1 }, 6904)
  RESPIROS.forEach(([x, y]) => por(o, l, elipse(x, y, 0.3, 0.3), VAO, { bisel: 0, contorno: 0, alfa: 0.85, semente: 6905 }))
  // A VISEIRA levantada: a placa de bico com a quina, as frestas dos olhos e os pinos em que ela gira.
  const viseira = poligono(VISEIRA)
  assentar(o, noLugar(l, viseira), 2)
  porAco(o, l, viseira, { relevo: relevoDeQuina(5.7, -3.4, 3.4), reflexo: 50, bisel: 1.0, marcas: MARCAS_DA_VISEIRA, projeta: 0.9 }, 6910)
  FRESTAS.forEach(([ax, ay, bx, by]) => por(o, l, capsula(ax, ay, bx, by, 0.36), VAO, { bisel: 0, contorno: 0.1, recesso: { k: 0.5 * k, forca: 0.3 }, semente: 6911 }))
  PINOS_DA_VISEIRA.forEach((pino) => porRebite(o, l, pino, 0.8, ACO, 6913))
}

export const montarArmaduraDespedacada: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DO_DESENHO
  const sy = c.h / ALTURA_DO_DESENHO
  const regua: Regua = { em: (x, y) => [x * sx, y * sy], k: Math.min(sx, sy) }
  const o: Obra = { c, cena, regua, luz: luzDoDesenho(c.giro) }
  cena.corDoPiso = ESCURO_DO_FERRO
  montarPoPorBaixo(o)
  montarTiraSolta(o)
  montarMiudo(o)
  montarEscudo(o)
  montarManopla(o, MANOPLA_LONGE[0], MANOPLA_LONGE[1], MANOPLA_LONGE[2], true, 6150)
  montarPernas(o)
  montarBracos(o)
  montarOmbreira(o, OMBREIRA_CAIDA, MARCAS_DA_OMBREIRA_CAIDA, true, 6160)
  montarPeitoral(o)
  montarOmbreira(o, OMBREIRA_NO_OMBRO, MARCAS_DA_OMBREIRA_NO_OMBRO, false, 6170)
  montarGorjal(o)
  montarElmo(o)
  montarPoPorCima(o)
}
