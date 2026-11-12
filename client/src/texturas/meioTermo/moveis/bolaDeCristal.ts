/**
 * BOLA DE CRISTAL de cima com volume (lote 13 dos objetos novos, 11/11/2026):
 * a mesinha redonda da adivinha, coberta até o chão por um pano escuro de
 * veludo ameixa, bordado de estrelas, com a franja de ocre na bainha; no
 * meio, a bola de cristal num suporte de latão em garra e, ao lado, um leque
 * de cartas viradas e um pêndulo de quartzo na corrente. É o que vai dentro
 * da tenda de adivinha (`tendaDeAdivinha.ts`): o veludo, o anil das cartas e
 * o ocre do bordado são os panos dela.
 *
 * A BOLA é vidro, não bola opaca. A textura dela (`texDaBola`) pinta o pano
 * visto pelo vidro, de ponta-cabeça e esticado para a beira (as estrelas do
 * bordado aparecem invertidas lá dentro), a névoa clara em espiral, o lado
 * da luz mais claro e o outro mais escuro, a beira clara do reflexo, a janela
 * de luz forte em cima à esquerda e o crescente da luz que atravessa e junta
 * do outro lado. Em volta, um brilho frio pintado (emissão com alfa), que não
 * ilumina nada: a bola não é fonte de luz.
 *
 * Na 3/4 (`tresQuartos.ts`):
 * - a MESA é uma coluna da altura do tampo com a pegada da bainha: a frente
 *   que a 3/4 varre é o veludo caindo até o chão. A franja fica no chão, fora
 *   da coluna, e aparece embaixo da frente;
 * - a BOLA é um tampo solto na altura do meio dela, sem sombra no chão, com a
 *   caixa esticada até o sul da pegada (`naOrdemDaFrente`), para a 3/4 a
 *   pintar depois da mesa;
 * - o que só a 3/4 mostra (as pregas, as estrelas e a barra da frente do
 *   pano; a haste, a taça e as garras do suporte) nasce deslocado para baixo
 *   a altura da estrutura dele e só é pintado quando a 3/4 o sobe de volta ao
 *   lugar (`soNoLugar`, a conta da prateleira de potes). De cima ele some.
 *
 * Com o objeto girado, a luz da bola e a sombra dela no pano ficam no lugar
 * NA TELA (`desgirado`, a conta do altar). O que só a 3/4 mostra não sai na
 * 3/4 girada (a cena girada passa à textura a peça de antes do giro): a bola
 * fica na base de latão, sem as garras, e a frente do pano sai lisa.
 *
 * Tudo tem o tamanho do menor lado (a mesa é redonda); as alturas são em
 * casas. Sem material a escolher: os panos, o latão e o vidro são fixos.
 * Escreve `cena.corDoPiso` (o escuro do veludo).
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'

// ---------- as medidas: frações do raio da pegada (a mesa é redonda); as alturas em casas ----------

/** A bainha do pano no chão e o tampo da mesa debaixo dele; entre os dois o pano cai em pregas. */
const RAIO_DA_BAINHA = 0.84
const RAIO_DO_TAMPO = 0.6
/** A altura do tampo, em casas. */
const ALTURA_DA_MESA = 0.5
/** A bola e a base de latão em volta dela; o pé do suporte, do tampo até a bola, em casas. */
const RAIO_DA_BOLA = 0.27
const RAIO_DA_BASE = 0.35
const PE_DO_SUPORTE = 0.07
/** O brilho frio em volta da bola: o raio (em raios da bola) e o alfa no meio. */
const RAIO_DO_BRILHO = 2.4
const ALFA_DO_BRILHO = 0.42
/** A franja: os fios em volta da bainha, o comprimento e a grossura de cada um. */
const FIOS_DA_FRANJA = 72
const COMPRIMENTO_DA_FRANJA = 0.085
const GROSSURA_DO_FIO = 0.013
/** As pregas do pano que cai, vistas de cima: quantas em volta, o fundo delas e o quanto o caimento escurece até a bainha. */
const PREGAS = 15
const FUNDO_DA_PREGA = 0.1
const SOMBRA_DO_CAIMENTO = 0.06

/** As estrelas bordadas no tampo: o raio do lugar (fração do raio), o ângulo (graus) e o tamanho. Fora do leque e do pêndulo. */
const ESTRELAS_DO_TAMPO: readonly (readonly [number, number, number])[] = [
  [0.47, -118, 0.06],
  [0.49, -160, 0.052],
  [0.46, 174, 0.056],
  [0.47, 24, 0.055],
  [0.49, 62, 0.05],
  [0.45, 96, 0.048],
]
/** As do caimento, miúdas, em roda entre a beira do tampo e a bainha. */
const ESTRELAS_DO_CAIMENTO = 13
const RAIO_DAS_ESTRELAS_DO_CAIMENTO = 0.72
const TAMANHO_DAS_ESTRELAS_DO_CAIMENTO = 0.036
/** O miolo da estrela de cinco pontas, em fração da ponta. */
const MIOLO_DA_ESTRELA = 0.42

/** O leque de cartas viradas: o meio (frações do raio), para onde abre (radianos), quantas, o passo entre elas e as meias medidas de uma carta. */
const LEQUE = { x: -0.37, y: 0.34, giro: 2.4, cartas: 5, passo: 0.27, meiaLargura: 0.08, meiaAltura: 0.122 }
/** A moldura de ocre do verso da carta: o recuo da beira e a grossura (px do protótipo). */
const RECUO_DA_MOLDURA = 0.45
const MOLDURA = 0.5

/** O pêndulo: a corrente da argola ao cristal (frações do raio), a grossura dela, o passo das contas e o cristal. */
const CORRENTE_DO_PENDULO: readonly Ponto[] = [[0.05, -0.43], [0.13, -0.5], [0.24, -0.5], [0.33, -0.44], [0.39, -0.35]]
const GROSSURA_DA_CORRENTE = 0.011
const PASSO_DAS_CONTAS = 1.1
const ARGOLA = 0.035
const CRISTAL = { comprimento: 0.15, meiaLargura: 0.046 }

/** A frente do pano na 3/4: as pregas (quantas e até que ângulo da frente vão), a barra da bainha e as estrelas (ângulo e altura em fração do tampo). */
const PREGAS_DA_FRENTE = 11
const ABERTURA_DAS_PREGAS = 1.25
const BARRA_DA_BAINHA = 1.5
const ESTRELAS_DA_FRENTE: readonly (readonly [number, number])[] = [[-0.98, 0.56], [-0.48, 0.42], [0.04, 0.6], [0.52, 0.44], [1.0, 0.58]]
const TAMANHO_DAS_ESTRELAS_DA_FRENTE = 0.048

/**
 * As garras do suporte na 3/4, em raios da bola a partir do meio dela (y
 * para baixo): da taça, contornando a metade de baixo da bola, e a ponta de
 * cada uma, virada para dentro. A da frente passa na frente do vidro.
 */
const GARRAS: readonly (readonly Ponto[])[] = [
  [[-0.3, 1.0], [-0.74, 0.86], [-1.02, 0.52], [-1.0, 0.2]],
  [[0.3, 1.0], [0.74, 0.86], [1.02, 0.52], [1.0, 0.2]],
  [[0, 1.05], [0.1, 0.84], [0.07, 0.6]],
]
const PONTAS_DAS_GARRAS: readonly Ponto[] = [[-0.84, 0.04], [0.84, 0.04], [-0.05, 0.4]]
const GROSSURA_DA_GARRA = 0.1
/**
 * A base do suporte na 3/4: o disco de latão visto de lado, achatado (a
 * fração da altura dele na largura), e a grossura da beira, em raios da bola.
 */
const ACHATADO_DA_BASE = 0.34
const BEIRA_DA_BASE = 0.16
/**
 * Os dedos da garra vistos de cima, em raios da bola: saem da base, passam
 * rente à beira e acabam por cima dela; a curva é o quanto giram até a ponta
 * (radianos) e a grossura, uma fração do raio da pegada.
 */
const DEDOS = { de: 1.3, beira: 1.04, ate: 0.8, curva: 0.16, grossura: 0.034 }

const SEMENTE = 7300

// ---------- os materiais (fixos: os panos e as cores da tenda de adivinha) ----------

/** O veludo ameixa da toalha da mesinha da tenda, de lã fofa. */
const VELUDO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x6a, 0x46, 0x62] }
/** O bordado das estrelas, a barra da bainha e a franja: o ocre velho da tenda. */
const OCRE: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xa4, 0x66] }
/** O verso das cartas: o anil de noite da tenda. */
const ANIL: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x50, 0x72] }
const LATAO = materialDaPeca('latao')
/** O cristal do pêndulo: quartzo violeta, claro. */
const QUARTZO: MaterialDaPeca = { classe: 'liso', rgb: [0xb2, 0xa6, 0xc6] }
/** A sombra pintada no pano (a da bola e o fundo das pregas da frente). */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x16, 0x1e] }
/** O vidro: só o tom de partida; a textura da bola e a do brilho pintam a cor de cada ponto. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xd4, 0xdc] }
/** O escuro em que o pixel escuro demais é levantado: ameixa de noite, de luminância linear 0,05 (acima do piso de 0,045). */
const ESCURO_DO_VELUDO: Rgb = [0x4a, 0x3a, 0x4c]

/** As cores que a bola mistura: o gelo do vidro, a névoa, o reflexo, as estrelas vistas pelo vidro e o brilho em volta. */
const COR_DO_GELO: Rgb = [0xcf, 0xdc, 0xe4]
const COR_DA_NEVOA: Rgb = [0xe6, 0xeb, 0xf0]
const COR_DO_REFLEXO: Rgb = [0xfb, 0xfc, 0xfa]
const COR_DA_ESTRELA_NA_BOLA: Rgb = [0xd8, 0xc2, 0x8c]
const COR_DO_BRILHO: Rgb = [0xc8, 0xdc, 0xea]
/** Quanto o pano visto pelo vidro clareia (o vidro junta a luz) e a volta da espiral da névoa. */
const LUZ_DO_PANO_NA_BOLA = 1.18
const FASE_DA_NEVOA = 1.1
/** A janela de luz forte e o ponto menor ao lado dela (raios, em raios da bola). */
const RAIO_DA_JANELA = 0.24
const RAIO_DO_PONTO_DE_LUZ = 0.09

/** Para onde fica a luz NA TELA: a direção de onde vem a luz do motor (em cima à esquerda). */
const LUZ_X = -0.79
const LUZ_Y = -0.61

// ---------- as contas de lugar ----------

function polar(raio: number, angulo: number): [number, number] {
  return [raio * Math.cos(angulo), raio * Math.sin(angulo)]
}

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber com que estrutura a peça sobe, cai onde se quer.
 */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** A mesma forma com a caixa esticada para o sul até `sul`: a 3/4 pinta as estruturas do norte para o sul pela base da caixa. */
function naOrdemDaFrente(forma: Forma, sul: number): Forma {
  return { b: [forma.b[0], forma.b[1], forma.b[2], sul], d: (x, y) => forma.d(x, y) }
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de
 * volta que a 3/4 pinta (`giro`, em graus): a conta do altar (`altar.ts`).
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/**
 * A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero): a que só a
 * 3/4 mostra nasce deslocada para baixo a altura da estrutura dela e aparece
 * quando a 3/4 a sobe de volta; de cima ela fica fora do lugar e some.
 */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** Retângulo girado `ang` radianos em volta do meio (cx, cy), de meias medidas `mx` e `my`. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

/** A estrela de cinco pontas de meio (cx, cy) e ponta `r`, com a largura vezes `achatada` (a estrela na curva do pano). */
function estrela(cx: number, cy: number, r: number, achatada = 1): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const k = i % 2 === 0 ? r : r * MIOLO_DA_ESTRELA
    pontos.push([cx + Math.cos(a) * k * achatada, cy + Math.sin(a) * k])
  }
  return poligono(pontos)
}

/** Mistura `cor` na cor do ponto com o peso `k` (0 a 1). */
function misturar(s: Float32Array, cor: Rgb, k: number): void {
  s[0] += (cor[0] - s[0]) * k
  s[1] += (cor[1] - s[1]) * k
  s[2] += (cor[2] - s[2]) * k
}

// ---------- as texturas ----------

interface Estrela {
  readonly x: number
  readonly y: number
  readonly r: number
}

/** A bola no referencial do desenho: o meio, o raio, para onde fica a luz (unitário) e o pano que o vidro mostra. */
interface Bola {
  readonly cx: number
  readonly cy: number
  readonly r: number
  readonly lx: number
  readonly ly: number
  /** Até que raio do pano o vidro mostra, de ponta-cabeça. */
  readonly alcance: number
  readonly estrelas: readonly Estrela[]
}

/** O vidro da bola, ponto a ponto, em emissão (a cor é a da conta, sem a luz do chanfro). */
function texDaBola(b: Bola): Textura {
  const [vr, vg, vb] = VELUDO.rgb
  // O ponto de luz menor fica ao lado da janela, puxado para a beira.
  const [px, py] = [b.lx * 0.66 - b.ly * 0.28, b.ly * 0.66 + b.lx * 0.28]
  return (_u, _v, x, y, _p, s) => {
    const nx = (x - b.cx) / b.r
    const ny = (y - b.cy) / b.r
    const rho2 = Math.min(1, nx * nx + ny * ny)
    const rho = Math.sqrt(rho2)
    const lado = nx * b.lx + ny * b.ly
    // O pano visto pelo vidro: de ponta-cabeça, ampliado no meio e apertado na beira.
    const alcance = b.alcance * (0.45 + 0.55 * rho2)
    const ox = b.cx - nx * alcance
    const oy = b.cy - ny * alcance
    s[0] = vr * LUZ_DO_PANO_NA_BOLA
    s[1] = vg * LUZ_DO_PANO_NA_BOLA
    s[2] = vb * LUZ_DO_PANO_NA_BOLA
    for (const e of b.estrelas) {
      const dx = ox - e.x
      const dy = oy - e.y
      if (dx * dx + dy * dy < e.r * e.r * 1.6) {
        misturar(s, COR_DA_ESTRELA_NA_BOLA, 0.75)
        break
      }
    }
    misturar(s, COR_DO_GELO, 0.2 + 0.3 * rho2)
    // A névoa em espiral, mais densa no meio.
    const onda = Math.sin(2 * Math.atan2(ny, nx) + 8 * rho + FASE_DA_NEVOA)
    misturar(s, COR_DA_NEVOA, ((onda > 0 ? onda * onda * 0.62 : 0) + 0.14) * (1 - rho2))
    // O lado da luz mais claro, o outro mais escuro.
    const tom = 0.92 + 0.22 * lado * rho
    s[0] *= tom
    s[1] *= tom
    s[2] *= tom
    // A beira clara do reflexo, mais forte do lado da luz.
    if (rho > 0.72) {
      const f = (rho - 0.72) / 0.28
      misturar(s, COR_DO_REFLEXO, f * f * (0.28 + 0.36 * Math.max(0, lado)))
    }
    // A luz que atravessa o vidro e junta do outro lado, num crescente.
    if (lado < -0.25) {
      const k = ((-lado - 0.25) / 0.75) * Math.max(0, 1 - Math.abs(rho - 0.7) / 0.16)
      misturar(s, COR_DO_REFLEXO, 0.5 * k)
    }
    // A janela de luz forte em cima à esquerda e o ponto menor ao lado.
    const dj = Math.hypot(nx - b.lx * 0.44, ny - b.ly * 0.44)
    if (dj < RAIO_DA_JANELA) misturar(s, COR_DO_REFLEXO, Math.min(1, (1 - dj / RAIO_DA_JANELA) * 2.2) * 0.95)
    const dp = Math.hypot(nx - px, ny - py)
    if (dp < RAIO_DO_PONTO_DE_LUZ) misturar(s, COR_DO_REFLEXO, Math.min(1, (1 - dp / RAIO_DO_PONTO_DE_LUZ) * 2) * 0.85)
    // A beira de fora escura: a bola não some no pano.
    if (rho > 0.9) {
      const k = 1 - (0.42 * (rho - 0.9)) / 0.1
      s[0] *= k
      s[1] *= k
      s[2] *= k
    }
    s[4] = 1
  }
}

/** O brilho frio em volta da bola: a cor com alfa que cai suave do meio até `r`, sem pegar luz nem sombra. */
function texDoBrilho(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    s[0] = COR_DO_BRILHO[0]
    s[1] = COR_DO_BRILHO[1]
    s[2] = COR_DO_BRILHO[2]
    s[4] = 1
    s[5] = ALFA_DO_BRILHO * (1 - q) * (1 - q)
  }
}

/** O pano visto de cima: liso no tampo e, da beira do tampo à bainha, as pregas em leque, cada vez mais fundas. */
function texDoPano(rTampo: number, rBainha: number): Textura {
  const daLa = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (daLa !== null) daLa(u, v, x, y, p, s, escala)
    const r = Math.sqrt(x * x + y * y)
    if (r <= rTampo) return
    const t = Math.min(1, (r - rTampo) / (rBainha - rTampo))
    const a = Math.atan2(y, x)
    const prega = Math.sin(a * PREGAS + Math.sin(a * 4 + 1.3) * 1.1)
    s[3] += (prega * FUNDO_DA_PREGA - SOMBRA_DO_CAIMENTO) * t
  }
}

// ---------- o que fica no pano ----------

/** O leque de cartas viradas, uma por cima da outra: o verso de anil, a moldura e o losango de ocre. */
function lequeDeCartas(L: Peca[], P: CriarPeca, R: number, naMesa: (f: Forma) => Forma): void {
  const { x, y, giro, cartas, passo, meiaLargura, meiaAltura } = LEQUE
  const [mx, my] = [meiaLargura * R, meiaAltura * R]
  // O pivô, onde as cartas se juntam, fica atrás do meio do leque.
  const [px, py] = [x * R - Math.cos(giro) * my * 0.5, y * R - Math.sin(giro) * my * 0.5]
  for (let i = 0; i < cartas; i += 1) {
    const a = giro + (i - (cartas - 1) / 2) * passo
    const [cx, cy] = [px + Math.cos(a) * my * 0.85, py + Math.sin(a) * my * 0.85]
    const ang = a - Math.PI / 2
    const semente = SEMENTE + 40 + i * 4
    L.push(P(naMesa(girado(cx, cy, mx, my, ang)), ANIL, { bisel: 0.35, contorno: 0.32, tom: 0.92 + 0.12 * hash(i, 1, semente), semente, projeta: { dist: 0.7, forca: 0.3, suave: 0.5 } }))
    const fora = girado(cx, cy, mx - RECUO_DA_MOLDURA, my - RECUO_DA_MOLDURA, ang)
    const dentro = girado(cx, cy, mx - RECUO_DA_MOLDURA - MOLDURA, my - RECUO_DA_MOLDURA - MOLDURA, ang)
    L.push(P(naMesa(menos(fora, dentro)), OCRE, { bisel: 0, contorno: 0, tom: 0.88, semente: semente + 1 }))
    const [co, si] = [Math.cos(ang), Math.sin(ang)]
    const no = (lx: number, ly: number): Ponto => [cx + lx * co - ly * si, cy + lx * si + ly * co]
    L.push(P(naMesa(poligono([no(0, -my * 0.42), no(mx * 0.48, 0), no(0, my * 0.42), no(-mx * 0.48, 0)])), OCRE, { bisel: 0.2, contorno: 0.12, semente: semente + 2 }))
  }
}

/** O pêndulo largado no pano: a argola, a corrente de contas e o cristal de quartzo com o capuz de latão. */
function pendulo(L: Peca[], P: CriarPeca, R: number, naMesa: (f: Forma) => Forma): void {
  const pontos = CORRENTE_DO_PENDULO.map(([x, y]): Ponto => [x * R, y * R])
  const fio = GROSSURA_DA_CORRENTE * R
  L.push(P(naMesa(cadeia(pontos, fio)), LATAO, { bisel: fio, contorno: 0.24, tom: 0.9, semente: SEMENTE + 60, projeta: { dist: 0.5, forca: 0.26, suave: 0.4 } }))
  // As contas da corrente, de passo em passo pelo caminho.
  let sobra = 0
  for (let i = 1; i < pontos.length; i += 1) {
    const [ax, ay] = pontos[i - 1]
    const [bx, by] = pontos[i]
    const comprimento = Math.hypot(bx - ax, by - ay)
    for (let t = sobra; t < comprimento; t += PASSO_DAS_CONTAS) {
      const [x, y] = [ax + ((bx - ax) * t) / comprimento, ay + ((by - ay) * t) / comprimento]
      L.push(P(naMesa(elipse(x, y, fio * 1.45, fio * 1.45)), LATAO, { bisel: fio, contorno: 0.2, tom: 1.06, semente: SEMENTE + 61 }))
      sobra = t + PASSO_DAS_CONTAS - comprimento
    }
  }
  const [x0, y0] = pontos[0]
  const argola = ARGOLA * R
  L.push(P(naMesa(anel(x0 - argola * 0.8, y0, argola, argola, argola * 0.55, argola * 0.55)), LATAO, { bisel: argola * 0.3, contorno: 0.26, semente: SEMENTE + 62, projeta: { dist: 0.5, forca: 0.26, suave: 0.4 } }))
  // O cristal, apontado para onde a corrente vinha.
  const [ax, ay] = pontos[pontos.length - 2]
  const [bx, by] = pontos[pontos.length - 1]
  const n = Math.hypot(bx - ax, by - ay) || 1
  const [ux, uy] = [(bx - ax) / n, (by - ay) / n]
  const [c, w] = [CRISTAL.comprimento * R, CRISTAL.meiaLargura * R]
  const em = (ao: number, de: number): Ponto => [bx + ux * ao * c - uy * de * w, by + uy * ao * c + ux * de * w]
  L.push(P(naMesa(poligono([em(0, 0), em(0.2, 0.72), em(0.4, 1), em(1, 0), em(0.4, -1), em(0.2, -0.72)])), QUARTZO, { bisel: w * 0.8, contorno: 0.3, metal: 0.6, semente: SEMENTE + 63, projeta: { dist: 0.8, forca: 0.3, suave: 0.5 } }))
  L.push(P(naMesa(capsula(...em(0.26, 0.32), ...em(0.62, 0.2), w * 0.16)), VIDRO, { bisel: 0, contorno: 0, alfa: 0.7, semente: SEMENTE + 64 }))
  L.push(P(naMesa(elipse(bx, by, fio * 2, fio * 2)), LATAO, { bisel: fio, contorno: 0.24, tom: 1.08, semente: SEMENTE + 65 }))
}

// ---------- a bola de cristal ----------

export const montarBolaDeCristal: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_VELUDO
  const rBainha = RAIO_DA_BAINHA * R
  const rTampo = RAIO_DO_TAMPO * R
  const rBola = RAIO_DA_BOLA * R
  const rBase = RAIO_DA_BASE * R
  const zMesa = ALTURA_DA_MESA * c.g
  const pe = PE_DO_SUPORTE * c.g
  const zBola = zMesa + pe + rBola
  // As peças da mesa sobem com ela: o meio da caixa de cada uma vai para um ponto da mesa fora da bola.
  const yDaMesa = (rBola + rTampo) / 2
  const naMesa = (f: Forma): Forma => comMeioEm(f, 0, yDaMesa)
  const [lx, ly] = desgirado(LUZ_X, LUZ_Y, c.giro)

  // A MESA é a coluna do pano até o tampo; a BOLA, um tampo solto na altura do meio dela, sem sombra no chão.
  cena.sombras.push(
    contato(elipse(0, 0, rBainha + 1, rBainha + 1), 0.3),
    { forma: elipse(0, 0, rBainha, rBainha), z: zMesa },
    { forma: naOrdemDaFrente(elipse(0, 0, rBola, rBola), R), z: zBola, solta: true, forca: 0 },
  )

  // A FRANJA, no chão em volta da bainha: o meio de cada fio fica fora da coluna, então ela não sobe.
  for (let i = 0; i < FIOS_DA_FRANJA; i += 1) {
    const a = ((i + 0.5 * hash(i, 1, SEMENTE)) / FIOS_DA_FRANJA) * 2 * Math.PI
    const comprimento = COMPRIMENTO_DA_FRANJA * R * (0.75 + 0.5 * hash(i, 2, SEMENTE))
    const [x0, y0] = polar(rBainha - 0.5, a)
    const [x1, y1] = polar(rBainha + comprimento, a)
    L.push(P(capsula(x0, y0, x1, y1, GROSSURA_DO_FIO * R), OCRE, { bisel: 0.3, contorno: 0.26, tom: 0.76 + 0.22 * hash(i, 3, SEMENTE), semente: SEMENTE + 100 + i }))
  }

  // O PANO: o tampo liso e o caimento em pregas até a bainha (o chanfro largo é a curva do pano na beira da mesa).
  L.push(P(naMesa(elipse(0, 0, rBainha, rBainha)), VELUDO, { tabua: 0, bisel: rBainha - rTampo, contorno: 0.3, ruga: 0.6, textura: texDoPano(rTampo, rBainha), semente: SEMENTE + 1 }))
  const estrelas: Estrela[] = ESTRELAS_DO_TAMPO.map(([raio, graus, tamanho]) => {
    const [x, y] = polar(raio * R, (graus * Math.PI) / 180)
    return { x, y, r: tamanho * R }
  })
  for (const [i, e] of estrelas.entries()) L.push(P(naMesa(estrela(e.x, e.y, e.r)), OCRE, { bisel: 0.3, contorno: 0.18, tom: 0.94 + 0.1 * hash(i, 4, SEMENTE), semente: SEMENTE + 10 + i }))
  // As do caimento, mais apagadas do lado que foge da luz.
  for (let i = 0; i < ESTRELAS_DO_CAIMENTO; i += 1) {
    const a = ((i + 0.6 * hash(i, 5, SEMENTE)) / ESTRELAS_DO_CAIMENTO) * 2 * Math.PI
    const [x, y] = polar(RAIO_DAS_ESTRELAS_DO_CAIMENTO * R, a)
    const r = TAMANHO_DAS_ESTRELAS_DO_CAIMENTO * R
    estrelas.push({ x, y, r })
    const deFrente = Math.cos(a) * lx + Math.sin(a) * ly
    L.push(P(naMesa(estrela(x, y, r)), OCRE, { bisel: 0.2, contorno: 0.14, tom: 0.74 + 0.24 * deFrente, semente: SEMENTE + 20 + i }))
  }

  lequeDeCartas(L, P, R, naMesa)
  pendulo(L, P, R, naMesa)

  // A sombra da bola no pano, caída para baixo à direita NA TELA, e a BASE de latão com os dedos da garra, só de
  // cima: na 3/4 o disco inteiro subiria como um prato em pé debaixo da bola, e lá a base é desenhada achatada.
  // Nenhuma delas projeta sombra: a sombra projetada não some com a peça e cairia no pano da 3/4.
  const [sx, sy] = desgirado(SOMBRA_X * (pe + rBola), SOMBRA_Y * (pe + rBola), c.giro)
  const deCima = soNoLugar(texturaDaClasse('metal'))
  L.push(P(naMesa(elipse(sx, sy, rBase * 1.02, rBase * 0.96)), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.34, suave: 1.4, textura: soNoLugar(null), semente: SEMENTE + 70 }))
  L.push(P(naMesa(elipse(0, 0, rBase, rBase)), LATAO, { bisel: rBase * 0.3, contorno: 0.3, textura: deCima, semente: SEMENTE + 71 }))
  L.push(P(naMesa(elipse(0, 0, rBase * 0.8, rBase * 0.8)), LATAO, { bisel: 0, tom: 0.84, contorno: 0.12, recesso: { k: 1, forca: 0.3 }, textura: deCima, semente: SEMENTE + 72 }))

  // A FRENTE DO PANO, só na 3/4: nasce deslocada a altura da mesa e é desenhada em coordenadas da TELA (a frente vai
  // da bainha no chão, y = yb(x), até a beira do tampo, yb(x) menos a altura). O meio da caixa fica na beira sul da
  // mesa, perto do desenho: a caixa sai menor que a do veludo, que tem de ser a maior peça (a frente leva o material dela).
  const naFrente = (f: Forma): Forma => comMeioEm(f, 0, rBainha - 1 - zMesa)
  const yb = (x: number): number => Math.sqrt(Math.max(0, rBainha * rBainha - x * x))
  for (let j = 0; j < PREGAS_DA_FRENTE; j += 1) {
    const th = -ABERTURA_DAS_PREGAS + (2 * ABERTURA_DAS_PREGAS * (j + 0.5)) / PREGAS_DA_FRENTE + (hash(j, 6, SEMENTE) - 0.5) * 0.16
    const x = rBainha * Math.sin(th)
    const larg = (0.45 + 0.5 * hash(j, 7, SEMENTE)) * Math.cos(th)
    const [alto, baixo] = [yb(x) - zMesa + 1.5 + 2 * hash(j, 8, SEMENTE), yb(x) - BARRA_DA_BAINHA]
    L.push(P(naFrente(caixa(x - larg, alto, x + larg, baixo, larg)), SOMBRA, { dy: zMesa, bisel: 0, contorno: 0, alfa: 0.12 + 0.08 * hash(j, 9, SEMENTE), suave: 0.9, textura: soNoLugar(null), semente: SEMENTE + 80 + j }))
    L.push(P(naFrente(caixa(x - 2.8 * larg, alto + 1, x - 1.4 * larg, baixo, larg)), VELUDO, { dy: zMesa, bisel: 0, contorno: 0, tom: 1.3, alfa: 0.18, suave: 0.9, textura: soNoLugar(null), semente: SEMENTE + 90 + j }))
  }
  L.push(P(naFrente(menos(elipse(0, 0, rBainha, rBainha), elipse(0, -BARRA_DA_BAINHA, rBainha, rBainha))), OCRE, { dy: zMesa, bisel: 0.3, contorno: 0.2, tom: 0.9, textura: soNoLugar(null), semente: SEMENTE + 75 }))
  for (const [i, [th, f]] of ESTRELAS_DA_FRENTE.entries()) {
    const x = rBainha * Math.sin(th)
    L.push(P(naFrente(estrela(x, yb(x) - f * zMesa, TAMANHO_DAS_ESTRELAS_DA_FRENTE * R, Math.cos(th))), OCRE, { dy: zMesa, bisel: 0.3, contorno: 0.18, tom: 0.9, textura: soNoLugar(null), semente: SEMENTE + 30 + i }))
  }

  // A BOLA: o brilho frio por baixo, a haste e a taça do suporte (só na 3/4), o vidro e as garras (só na 3/4).
  const rBrilho = RAIO_DO_BRILHO * rBola
  L.push(P(elipse(0, 0, rBrilho, rBrilho), VIDRO, { bisel: 0, contorno: 0, textura: texDoBrilho(0, 0, rBrilho), semente: SEMENTE + 2 }))
  // Na tela da 3/4 o meio da bola fica a `zBola` acima do meio da pegada; as peças dela nascem deslocadas isso.
  const naTelaDaBola = (f: Forma): Forma => comMeioEm(f, 0, -zBola)
  const tb = ([bx, by]: Ponto): Ponto => [bx * rBola, by * rBola - zBola]
  const doSuporte = { dy: zBola, textura: soNoLugar(texturaDaClasse('metal')) }
  // A base achatada no tampo (a beira mais escura embaixo, o disco por cima), a haste e a taça.
  const [rxBase, ryBase, beira] = [rBase * 0.92, rBase * ACHATADO_DA_BASE, rBola * BEIRA_DA_BASE]
  L.push(P(naTelaDaBola(elipse(rBase * 0.06, beira - zMesa + 0.6, rxBase * 1.08, ryBase * 1.1)), SOMBRA, { dy: zBola, bisel: 0, contorno: 0, alfa: 0.34, suave: 1.2, textura: soNoLugar(null), semente: SEMENTE + 76 }))
  L.push(P(naTelaDaBola(elipse(0, beira - zMesa, rxBase, ryBase)), LATAO, { ...doSuporte, bisel: 0.6, contorno: 0.3, tom: 0.72, semente: SEMENTE + 77 }))
  L.push(P(naTelaDaBola(elipse(0, -zMesa, rxBase, ryBase)), LATAO, { ...doSuporte, bisel: ryBase * 0.5, contorno: 0.26, semente: SEMENTE + 78 }))
  L.push(P(naTelaDaBola(capsula(0, rBola * 0.95 - zBola, 0, -zMesa, rBola * 0.1)), LATAO, { ...doSuporte, bisel: rBola * 0.1, contorno: 0.26, semente: SEMENTE + 3 }))
  L.push(P(naTelaDaBola(elipse(0, rBola * 0.97 - zBola, rBola * 0.36, rBola * 0.13)), LATAO, { ...doSuporte, bisel: rBola * 0.1, contorno: 0.28, semente: SEMENTE + 4 }))
  L.push(P(elipse(0, 0, rBola, rBola), VIDRO, { bisel: 0, contorno: 0, textura: texDaBola({ cx: 0, cy: 0, r: rBola, lx, ly, alcance: rTampo, estrelas }), semente: SEMENTE + 5 }))
  // Os dedos da garra vistos de cima: saem da base, sobem rente à bola e a agarram por cima da beira, com a unha
  // virada para o meio. Só de cima (na 3/4 as garras são as de frente).
  for (let i = 0; i < 3; i += 1) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3
    const grossura = DEDOS.grossura * R
    const dedo: Ponto[] = [polar(DEDOS.de * rBola, a), polar(DEDOS.beira * rBola, a + DEDOS.curva * 0.5), polar(DEDOS.ate * rBola, a + DEDOS.curva)]
    L.push(P(naMesa(cadeia(dedo, grossura)), LATAO, { bisel: grossura, contorno: 0.3, tom: 1.06, textura: deCima, semente: SEMENTE + 73 + i }))
    const [ax, ay] = dedo[2]
    const [bx, by] = polar((DEDOS.ate - 0.2) * rBola, a + DEDOS.curva * 1.3)
    const n = Math.hypot(bx - ax, by - ay) || 1
    const [nx, ny] = [(-(by - ay) / n) * grossura, ((bx - ax) / n) * grossura]
    L.push(P(naMesa(poligono([[ax + nx, ay + ny], [bx, by], [ax - nx, ay - ny]])), LATAO, { bisel: grossura * 0.6, contorno: 0.3, tom: 1.1, textura: deCima, semente: SEMENTE + 76 + i }))
  }
  for (const [i, garra] of GARRAS.entries()) {
    const pontos = garra.map(tb)
    const grossura = GROSSURA_DA_GARRA * rBola
    L.push(P(naTelaDaBola(cadeia(pontos, grossura)), LATAO, { ...doSuporte, bisel: grossura, contorno: 0.3, tom: 1.04, semente: SEMENTE + 6 + i }))
    // A unha: um bico do fim da garra até a ponta, virado para dentro da bola.
    const [ax, ay] = pontos[pontos.length - 1]
    const [px, py] = tb(PONTAS_DAS_GARRAS[i])
    const n = Math.hypot(px - ax, py - ay) || 1
    const [nx, ny] = [(-(py - ay) / n) * grossura, ((px - ax) / n) * grossura]
    L.push(P(naTelaDaBola(poligono([[ax + nx, ay + ny], [px, py], [ax - nx, ay - ny]])), LATAO, { ...doSuporte, bisel: grossura * 0.6, contorno: 0.3, tom: 1.08, semente: SEMENTE + 9 + i }))
  }
}
