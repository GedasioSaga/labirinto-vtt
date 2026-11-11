/**
 * VARAL DE ROUPA de cima com volume (lote 7 dos objetos novos, 11/11/2026):
 * dois POSTES de madeira com a CORDA esticada entre eles e a roupa pendurada
 * com pregadores: uma CAMISA, um LENÇOL dobrado por cima da corda, uma CALÇA e
 * um PANO LISTRADO de franja. É fino e alto.
 *
 * De cima aparecem o topo dos postes (com a laçada e a ponta solta da corda),
 * a corda e a roupa EM ESCORÇO: o alto de cada peça (os pregadores, a gola, o
 * cós) no lugar e no tamanho dele, e o resto do pano encolhido para a frente,
 * como roupa balançando de leve. No chão, a sombra comprida: o risco de cada
 * poste, o da corda e a faixa da sombra das roupas, caída longe (a corda está
 * acima da cabeça).
 *
 * NA 3/4 A ROUPA APARECE DE FRENTE, pendurada da corda até a barra. A 3/4
 * (`tresQuartos.ts`; o perfil tem de ser `{ modo: 'derivado', espessura: 0 }`)
 * só sabe SUBIR cada peça pela altura da estrutura que contém o meio da caixa
 * dela. Então cada roupa é desenhada de frente e cortada em FAIXAS deitadas,
 * cada uma com a FRESTA dela (um tampo solto minúsculo, sem sombra, escondido
 * debaixo da própria faixa). De cima as faixas ficam quase uma em cima da
 * outra (cada uma mostra só a beira de baixo: é o escorço); na 3/4 cada uma
 * sobe um pouco menos que a de cima e a roupa se abre inteira, como uma
 * sanfona. É a ideia da sanefa do toldo listrado e das prateleiras da estante,
 * com muitas faixas. Os pregadores são pintados na própria roupa.
 *
 * Girado um quarto de volta na 3/4 (`c.giro`, que só chega nela), o varal é
 * visto DE PONTA: a corda corre para o fundo e cada roupa é uma fita de pano
 * ao longo dela, com a da frente caindo até a barra. Com meia volta, a roupa
 * é montada de frente para o outro lado (o desenho é feito na tela e desgirado).
 *
 * As roupas têm medida própria: o varal esticado ganha mais roupas (a fila
 * repete), nunca roupa esticada. Materiais: `madeira` (os postes) e `pano` (o
 * pano listrado; as listras são de linho cru, ou de vinho no pano de linho).
 * A corda, os pregadores, a camisa, o lençol e a calça são fixos.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, capsula, elipse, poligono, type Caixa, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, TOM_DA_CORDA, type CriarPeca, type MaterialDaPeca, type Peca, type Sombra, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'

// ---------- as medidas do varal ----------

/** Alturas em casas: os postes e a corda, amarrada logo abaixo do topo deles (acima da cabeça de quem passa). */
const ALTURA_DO_POSTE = 1.38
const ALTURA_DA_CORDA = 1.32
/** O poste: o raio (casas), a distância do meio dele à ponta da pegada e a da corda ao fundo dela (px do protótipo). */
const RAIO_DO_POSTE = 0.046
const POSTE_DA_PONTA = 3.4
const CORDA_DO_FUNDO = 5.4
/** A corda (a palha clara da corda da cerca, com a torção): o raio, a folga da laçada e a ponta solta (px do protótipo). */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const RAIO_DA_CORDA = 0.7
const LACADA = 0.9
const PONTA_SOLTA = { raio: 0.6, sai: 1.8, cai: 3.1 } as const
/** A folga entre o poste e a primeira roupa e a menor folga entre duas roupas (px do protótipo). */
const FOLGA_DO_POSTE = 3.2
const FOLGA_ENTRE_ROUPAS = 2

/** A sombra de cada poste no chão (um risco firme) e as das roupas e da corda: o borrão (px do protótipo) e a força. */
const SOMBRA_DO_POSTE = { suave: 1.5, forca: 0.22 } as const
const SOMBRA_DA_ROUPA = { suave: 2.2, forca: 0.2 } as const
const SOMBRA_DA_CORDA = { raio: 0.45, suave: 1.8, forca: 0.14 } as const

// ---------- a sanfona ----------

/**
 * A altura de cada faixa da roupa de frente (px do protótipo) e o quanto ela
 * entra debaixo da seguinte (sem fresta de chão entre duas). Com faixas de 2 px
 * a beira inclinada da manga saía em dentes na vista de cima.
 */
const FAIXA = 1.25
const TRANSPASSE = 1
/** O escorço: de cima, cada faixa desce só este tanto da altura dela em relação à de cima. */
const ESCORCO = 0.3
/**
 * A fresta de cada faixa (px do protótipo): cabe debaixo de um pregador, e a
 * altura dela é menor que o passo das faixas na vista de cima (`FAIXA *
 * ESCORCO`), para uma fresta não encostar na outra.
 */
const FRESTA = { meiaLargura: 0.6, meiaAltura: 0.08 } as const
/** O pino da corda (px do protótipo): na linha dela, mais baixo que a distância até a fresta da primeira faixa. */
const PINO_DA_CORDA = { meiaLargura: 1, meiaAltura: 0.06 } as const
/** O pregador (px do protótipo): a meia largura, quanto passa acima da corda e quanto desce no pano. */
const PREGADOR = { meiaLargura: 0.8, acima: 1.5, abaixo: 2.6, canto: 0.3 } as const
const COR_DO_PREGADOR: Rgb = rgb(tomDoMeio('pinho', 1.04))
/**
 * O meio da caixa de cada faixa, a partir do alto dela (px do protótipo): de
 * cima, o meio da primeira cai meio passo depois da linha da corda, e os das
 * outras, de passo em passo. Assim nenhum cai no pino da corda (que está na
 * linha dela) e todas as frestas ficam ao sul dele: na 3/4 a corda é pintada
 * antes das roupas. Tem de ser menor que `FAIXA + TRANSPASSE`, para a fresta
 * ficar escondida debaixo da própria faixa.
 */
const MEIO_DA_FAIXA = (FAIXA * ESCORCO) / 2 + PREGADOR.acima
/** O pano que sobra para a última faixa, embaixo do primeiro pregador: a fresta dela não pode passar da barra. */
const SOBRA_DA_ULTIMA_FAIXA = MEIO_DA_FAIXA + 0.5

/** O contorno da roupa, pintado na textura (as faixas não têm contorno próprio, senão cada corte ganhava um risco). */
const BEIRA = { larga: 0.85, forca: 0.24 } as const
/** As dobras do pano pendurado: o passo delas, o quanto entortam e a luz no alto e embaixo (elas abrem para a barra). */
const DOBRA = { passo: 0.62, torta: 3, luzNoAlto: 0.035, luzEmbaixo: 0.13 } as const
/** O pano é um pouco mais claro do lado da luz (a esquerda) que do outro. */
const LUZ_DE_LADO = 0.045

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** Mistura a cor `cor` em `s` (a saída da textura), na medida `t`. */
function tingir(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** As dobras de pé do pano pendurado, mais fundas para a barra. */
function dobras(x: number, y: number, comprimento: number, sem: number): number {
  const baixo = limitar(y / comprimento, 0, 1)
  const fase = x * DOBRA.passo + ruido(x * 0.07 + sem, y * 0.035 + sem) * DOBRA.torta
  return Math.sin(fase) * (DOBRA.luzNoAlto + (DOBRA.luzEmbaixo - DOBRA.luzNoAlto) * baixo) + ruido(x * 0.55 + sem, y * 0.55) * 0.035
}

// ---------- formas e caixas ----------

/** Círculo com a distância exata (a sombra do poste alto mede a forma vinte vezes por pixel). */
function circulo(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r,
  }
}

/** A união de várias formas numa só. */
function varias(formas: readonly Forma[]): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const f of formas) {
    x0 = Math.min(x0, f.b[0])
    y0 = Math.min(y0, f.b[1])
    x1 = Math.max(x1, f.b[2])
    y1 = Math.max(y1, f.b[3])
  }
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      let menor = Infinity
      for (const f of formas) {
        const v = f.d(x, y)
        if (v < menor) menor = v
      }
      return menor
    },
  }
}

/** A mesma forma com outra caixa de pintura (tem de conter a forma inteira). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/** A forma com a caixa crescida até o meio dela cair em (cx, cy): a 3/4 lê o meio da caixa para saber com quem a peça sobe. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return naCaixa(f, [cx - mx, cy - my, cx + mx, cy + my])
}

/** A forma com meia volta em torno da origem (a roupa de frente para o outro lado). */
function emMeiaVolta(f: Forma): Forma {
  return { b: [-f.b[2], -f.b[3], -f.b[0], -f.b[1]], d: (x, y) => f.d(-x, -y) }
}

/** A textura com meia volta em torno da origem. */
function texEmMeiaVolta(tex: Textura): Textura {
  return (u, v, x, y, p, s, escala) => tex(u, v, -x, -y, p, s, escala)
}

/** Só a altura, para a 3/4: uma estrutura que não faz sombra no chão. */
function estrutura(forma: Forma, z: number): Sombra {
  return { forma, z, solta: true, forca: 0, suave: 0.1 }
}

/** Os quartos de volta (0 a 3) do giro que a 3/4 pinta. */
function quartosDeVolta(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta, como no biombo. */
function desgirado(dx: number, dy: number, quartos: number): [number, number] {
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

// ---------- as roupas, de frente ----------

/** O que é pintado no pano além das dobras e da beira (as listras, a costura, os botões): soma em `s`. */
type Detalhe = (x: number, y: number, s: Float32Array) => void

/** Um trecho da roupa para a sombra no chão: de onde até onde ao longo da corda e da corda para baixo. */
interface Trecho {
  readonly x0: number
  readonly x1: number
  readonly alto: number
  readonly baixo: number
}

/** Uma roupa DE FRENTE: x a partir do meio dela, y da corda para baixo (px do protótipo). */
interface Roupa {
  readonly meiaLargura: number
  /** Da corda ao ponto mais baixo da barra. */
  readonly comprimento: number
  /** A silhueta, sem os pregadores. */
  readonly silhueta: Forma
  readonly pano: MaterialDaPeca
  readonly detalhe: Detalhe
  /** Onde ficam os pregadores. Debaixo do primeiro o pano desce inteiro até `comprimentoNoPregador`: as frestas ficam ali. */
  readonly pregadores: readonly number[]
  readonly comprimentoNoPregador: number
  readonly trechos: readonly Trecho[]
}

/** A camisa: o azul lavado do pano, o osso dos botões e as medidas (px do protótipo). */
const PANO_DA_CAMISA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb('#8196ae') }
const BOTAO: Rgb = rgb('#e2dccb')
const CAMISA = {
  corpo: 7,
  comprimento: 30,
  /** Quanto a fralda desce mais no meio que dos lados. */
  fralda: 1.6,
  /** A manga: do ombro ao punho (o meio dela) e a largura. */
  manga: { deX: 5.8, deY: 3, ateX: 11.4, ateY: 14.5, larga: 5.2 },
  gola: { rx: 2.7, ry: 2.6, sobe: 0.3 },
  botoes: [6.5, 12, 17.5, 23] as readonly number[],
} as const

function camisa(): Roupa {
  const { corpo, comprimento, fralda, manga, gola } = CAMISA
  const tronco = caixa(-corpo, 0, corpo, comprimento + 2, 1)
  const mangas = [-1, 1].map((lado) => barra(lado * manga.deX, manga.deY, lado * manga.ateX, manga.ateY, manga.larga))
  const decote = elipse(0, -gola.sobe, gola.rx, gola.ry)
  const barraDaFralda = (x: number): number => comprimento - fralda * (x / corpo) * (x / corpo)
  const meiaLargura = Math.max(...mangas.map((m) => m.b[2]))
  const fimDaManga = Math.max(...mangas.map((m) => m.b[3]))
  const silhueta: Forma = {
    b: [-meiaLargura, 0, meiaLargura, comprimento],
    d(x, y) {
      const noTronco = Math.max(tronco.d(x, y), y - barraDaFralda(x))
      return Math.max(Math.min(noTronco, mangas[0].d(x, y), mangas[1].d(x, y)), -decote.d(x, y))
    },
  }
  // A manga, do ombro ao punho: o punho é o último trecho dela.
  const aoLongo = Math.hypot(manga.ateX - manga.deX, manga.ateY - manga.deY)
  const ux = (manga.ateX - manga.deX) / aoLongo
  const uy = (manga.ateY - manga.deY) / aoLongo
  const detalhe: Detalhe = (x, y, s) => {
    const ax = Math.abs(x)
    // A carcela, com os botões de osso.
    if (ax < 0.4 && y > gola.ry) s[3] -= 0.1
    for (const yb of CAMISA.botoes) {
      const longe = Math.hypot(x, y - yb)
      if (longe < 0.8) tingir(s, BOTAO, limitar((0.8 - longe) / 0.3, 0, 1))
    }
    // A costura da cava e o punho.
    if (Math.abs(ax - corpo + 0.3) < 0.35 && y < manga.ateY - 3) s[3] -= 0.07
    if (ax > corpo) {
      const naManga = ((ax - manga.deX) * ux + (y - manga.deY) * uy) / aoLongo
      if (naManga > 0.84) s[3] -= 0.09
    }
  }
  const pregador = corpo - 1.6
  return {
    meiaLargura,
    comprimento,
    silhueta,
    pano: PANO_DA_CAMISA,
    detalhe,
    pregadores: [-pregador, pregador],
    comprimentoNoPregador: barraDaFralda(pregador),
    trechos: [
      { x0: -meiaLargura, x1: meiaLargura, alto: manga.deY - 1.5, baixo: fimDaManga },
      { x0: -corpo, x1: corpo, alto: 0, baixo: comprimento },
    ],
  }
}

/** O lençol: o branco da vila um pouco baixo (não estoura no zoom) e as medidas (px do protótipo). */
const PANO_DO_LENCOL: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb(tomDoMeio('branco', 0.93)) }
const LENCOL_NO_VARAL = {
  meiaLargura: 13,
  comprimento: 46,
  /** A barra ondula este tanto, e os lados, este outro. */
  ondaDaBarra: 0.9,
  ondaDoLado: 0.45,
  /** A aba de cá, dobrada por cima da corda, acaba nesta fração do comprimento. */
  aba: 0.6,
} as const

function lencol(): Roupa {
  const { meiaLargura, comprimento, ondaDaBarra, ondaDoLado, aba } = LENCOL_NO_VARAL
  const barraDoLencol = (x: number): number => comprimento - ondaDaBarra + ondaDaBarra * Math.sin(x * 0.62 + 1)
  const silhueta: Forma = {
    b: [-meiaLargura, 0, meiaLargura, comprimento],
    d: (x, y) => Math.max(Math.abs(x) - (meiaLargura - ondaDoLado + ondaDoLado * Math.cos(y * 0.32)), y - barraDoLencol(x), -y),
  }
  const detalhe: Detalhe = (x, y, s) => {
    // A aba da frente acaba antes da de trás: a barra dela, a sombra que ela faz e a aba de trás um tom abaixo.
    const fimDaAba = comprimento * aba + Math.sin(x * 0.5) * 0.8
    if (y > fimDaAba) s[3] -= 0.05 + (y < fimDaAba + 2.4 ? 0.13 * (1 - (y - fimDaAba) / 2.4) : 0)
    else if (y > fimDaAba - 0.6) s[3] += 0.05
  }
  const pregador = meiaLargura - 4
  return {
    meiaLargura,
    comprimento,
    silhueta,
    pano: PANO_DO_LENCOL,
    detalhe,
    // O primeiro pregador fica onde a barra ondulada desce mais.
    pregadores: [0.92, -pregador, pregador],
    comprimentoNoPregador: barraDoLencol(0.92),
    trechos: [{ x0: -meiaLargura, x1: meiaLargura, alto: 0, baixo: comprimento }],
  }
}

/** A calça: a lã castanha e as medidas (px do protótipo). */
const PANO_DA_CALCA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: rgb('#8a6b4f') }
const CALCA = {
  cintura: 6.6,
  comprimento: 40,
  /** O cós e o gancho (onde as pernas se separam). */
  cos: 2.6,
  gancho: 13,
  /** A perna na barra: a beira de fora e a de dentro (o vão entre as duas abre para baixo). */
  foraNaBarra: 6.2,
  dentroNoGancho: 0.3,
  dentroNaBarra: 1.3,
  bainha: 2.2,
} as const

function calca(): Roupa {
  const { cintura, comprimento, cos, gancho, foraNaBarra, dentroNoGancho, dentroNaBarra, bainha } = CALCA
  const quadril = caixa(-cintura, 0, cintura, gancho + 0.5, 0.7)
  const pernas = [-1, 1].map((lado) =>
    poligono([[lado * cintura, gancho - 5], [lado * dentroNoGancho, gancho - 5], [lado * dentroNaBarra, comprimento], [lado * foraNaBarra, comprimento]]),
  )
  const silhueta: Forma = {
    b: [-cintura, 0, cintura, comprimento],
    d: (x, y) => Math.min(quadril.d(x, y), pernas[0].d(x, y), pernas[1].d(x, y)),
  }
  const detalhe: Detalhe = (x, y, s) => {
    // O cós, a braguilha e a bainha de cada perna.
    if (y < cos) s[3] -= 0.06
    if (Math.abs(y - cos) < 0.3) s[3] -= 0.1
    if (Math.abs(x) < 0.3 && y > cos && y < gancho) s[3] -= 0.09
    if (Math.abs(y - (comprimento - bainha)) < 0.3) s[3] -= 0.1
  }
  const pregador = cintura - 2.4
  return {
    meiaLargura: cintura,
    comprimento,
    silhueta,
    pano: PANO_DA_CALCA,
    detalhe,
    pregadores: [-pregador, pregador],
    comprimentoNoPregador: comprimento,
    trechos: [{ x0: -cintura, x1: cintura, alto: 0, baixo: comprimento }],
  }
}

/** O pano listrado (px do protótipo): as listras de pé, a franja e a beira macia entre uma listra e a outra. */
const PANO_LISTRADO = { meiaLargura: 7.4, comprimento: 24, listras: 5, franja: 1.1, dentesDaFranja: 2.1, beiraDaListra: 0.3 } as const

/** A cor das listras: linho cru; no pano de linho, vinho (linho sobre linho dava um pano liso), como no toldo. */
function listraDoPano(pano: MaterialDaPeca): MaterialDaPeca {
  return materialDaPeca(pano.fio === 'linho' ? 'vinho' : 'linho')
}

function panoListrado(pano: MaterialDaPeca): Roupa {
  const { meiaLargura, comprimento, listras, franja, dentesDaFranja, beiraDaListra } = PANO_LISTRADO
  const listra = listraDoPano(pano).rgb
  const barraDaFranja = (x: number): number => comprimento - franja + franja * Math.abs(Math.sin(x * dentesDaFranja))
  const silhueta: Forma = {
    b: [-meiaLargura, 0, meiaLargura, comprimento],
    d: (x, y) => Math.max(Math.abs(x) - meiaLargura, y - barraDaFranja(x), -y),
  }
  const larga = (2 * meiaLargura) / listras
  const detalhe: Detalhe = (x, y, s) => {
    // As listras de pé (a primeira e a última da cor do pano) e a franja, toda da cor da listra.
    const f = limitar((x + meiaLargura) / larga, 0, listras - 0.001)
    const i = Math.floor(f)
    const ate = Math.min(f - i, 1 - (f - i)) * larga
    const naListra = limitar(0.5 + (((i & 1) === 1 ? 1 : -1) * ate) / (2 * beiraDaListra), 0, 1)
    tingir(s, listra, y > comprimento - franja - 0.4 ? 1 : naListra)
    if (Math.abs(y - (comprimento - franja - 0.4)) < 0.3) s[3] -= 0.1
  }
  const pregador = meiaLargura - 3
  return {
    meiaLargura,
    comprimento,
    silhueta,
    pano,
    detalhe,
    pregadores: [-pregador, pregador],
    comprimentoNoPregador: barraDaFranja(-pregador),
    trechos: [{ x0: -meiaLargura, x1: meiaLargura, alto: 0, baixo: comprimento }],
  }
}

/** Os pregadores da roupa: uma forma só. */
function pregadoresDe(roupa: Roupa): Forma {
  return varias(roupa.pregadores.map((x) => caixa(x - PREGADOR.meiaLargura, -PREGADOR.acima, x + PREGADOR.meiaLargura, PREGADOR.abaixo, PREGADOR.canto)))
}

/**
 * A pintura da roupa de frente: o pano com o detalhe dele, as dobras e a
 * beira escura em volta da silhueta; e os pregadores de madeira, com a fenda
 * no meio e a sombra deles no pano.
 */
function texDaRoupa(roupa: Roupa, inteira: Forma, pregadores: Forma, sem: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dentro = -inteira.d(x, y)
    let luz = dentro < BEIRA.larga ? -BEIRA.forca * (1 - Math.max(0, dentro) / BEIRA.larga) : 0
    const doPregador = pregadores.d(x, y)
    if (doPregador < 0) {
      s[0] = COR_DO_PREGADOR[0]
      s[1] = COR_DO_PREGADOR[1]
      s[2] = COR_DO_PREGADOR[2]
      // A beira do pregador e a fenda entre as duas metades dele.
      if (doPregador > -0.3) luz -= 0.16
      for (const xp of roupa.pregadores) if (Math.abs(x - xp) < 0.16 && y > -PREGADOR.acima + 0.5) luz -= 0.14
      s[3] += luz
      return
    }
    roupa.detalhe(x, y, s)
    if (doPregador < 0.7) luz -= 0.1 * (1 - doPregador / 0.7)
    s[3] += luz + dobras(x, y, roupa.comprimento, sem) - LUZ_DE_LADO * (x / roupa.meiaLargura)
  }
}

// ---------- pendurar ----------

/** O que as roupas e o varal precisam para pôr peças na cena. */
interface Obra {
  readonly L: Peca[]
  readonly sombras: Sombra[]
  readonly P: CriarPeca
  readonly yCorda: number
  readonly zCorda: number
}

/**
 * A roupa DE FRENTE, em sanfona, com o meio dela em `x` na corda. `sinal`: 1
 * para a frente do desenho, -1 para o varal com meia volta (a frente NA TELA).
 * As faixas vão da barra para a corda na lista: de cima, cada uma cobre a de
 * baixo e deixa à mostra só a beira dela.
 */
function pendurarDeFrente(o: Obra, roupa: Roupa, x: number, sinal: number, sem: number): void {
  const { L, sombras, P, yCorda, zCorda } = o
  const pregadores = pregadoresDe(roupa)
  const inteira = varias([roupa.silhueta, pregadores])
  const pintura = texDaRoupa(roupa, inteira, pregadores, sem)
  const textura = sinal > 0 ? pintura : texEmMeiaVolta(pintura)
  const alto = -PREGADOR.acima
  const xDaFresta = roupa.pregadores[0]
  const meia = roupa.meiaLargura + Math.abs(xDaFresta) + 1
  const faixas = Math.max(1, Math.ceil((roupa.comprimentoNoPregador - alto - SOBRA_DA_ULTIMA_FAIXA) / FAIXA))
  for (let k = faixas - 1; k >= 0; k -= 1) {
    const y0 = alto + k * FAIXA
    const y1 = k === faixas - 1 ? roupa.comprimento + 1 : y0 + FAIXA + TRANSPASSE
    // A caixa da faixa é centrada na fresta dela.
    const meio = y0 + MEIO_DA_FAIXA
    const meiaAltura = Math.max(meio - y0, y1 - meio)
    const fatia: Forma = {
      b: [xDaFresta - meia, meio - meiaAltura, xDaFresta + meia, meio + meiaAltura],
      d: (px, py) => Math.max(inteira.d(px, py), y0 - py, py - y1),
    }
    // De cima a faixa fica `sobe` px acima do lugar dela de frente; na 3/4 ela sobe esse tanto a menos que a corda.
    const sobe = k * FAIXA * (1 - ESCORCO)
    const fx = x + sinal * xDaFresta
    const fy = yCorda + sinal * (meio - sobe)
    sombras.push(estrutura(caixa(fx - FRESTA.meiaLargura, fy - FRESTA.meiaAltura, fx + FRESTA.meiaLargura, fy + FRESTA.meiaAltura), zCorda - sobe))
    L.push(P(sinal > 0 ? fatia : emMeiaVolta(fatia), roupa.pano, { bisel: 0, contorno: 0, textura, dx: x, dy: yCorda - sinal * sobe, semente: sem }))
  }
}

/** A meia largura da fita de pano da roupa vista de ponta (px do protótipo) e o raio do pino dela. */
const MEIA_FITA = 1.25
const PINO_DA_FITA = 0.3

/** A roupa vista DE PONTA (o varal com um quarto de volta na 3/4): uma fita de pano ao longo da corda, caindo até a barra para o lado `sul` (1 ou -1, ao longo da corda). */
function pendurarDePonta(o: Obra, roupa: Roupa, x: number, sul: number, sem: number): void {
  const { L, sombras, P, yCorda, zCorda } = o
  const de = x - roupa.meiaLargura + (sul < 0 ? -roupa.comprimento : 0)
  const ate = x + roupa.meiaLargura + (sul > 0 ? roupa.comprimento : 0)
  const fita = caixa(de, yCorda - MEIA_FITA, ate, yCorda + MEIA_FITA, MEIA_FITA * 0.7)
  sombras.push(estrutura(circulo((de + ate) / 2, yCorda, PINO_DA_FITA), zCorda))
  const pintura: Textura = (_u, _v, px, py, _p, s) => {
    s[3] += ruido(px * 0.5 + sem, py * 0.5) * 0.07
  }
  L.push(P(fita, roupa.pano, { bisel: 0.8, contorno: 0.24, textura: pintura, semente: sem }))
}

/** As roupas que cabem na corda entre `de` e `ate` (a fila repete enquanto couber), com o meio de cada uma, repartidas por igual. */
function repartir(fila: readonly Roupa[], de: number, ate: number): { roupa: Roupa; x: number }[] {
  const cabem: Roupa[] = []
  let largura = 0
  for (let i = 0; ; i += 1) {
    const roupa = fila[i % fila.length]
    const mais = 2 * roupa.meiaLargura + (cabem.length > 0 ? FOLGA_ENTRE_ROUPAS : 0)
    if (largura + mais > ate - de) break
    cabem.push(roupa)
    largura += mais
  }
  const sobra = (ate - de - largura) / (cabem.length + 1)
  let x = de
  return cabem.map((roupa, i) => {
    x += sobra + (i > 0 ? FOLGA_ENTRE_ROUPAS : 0)
    const meio = x + roupa.meiaLargura
    x += 2 * roupa.meiaLargura
    return { roupa, x: meio }
  })
}

/** Topo de madeira cortada: anéis em volta do meio do poste (como o mourão da cerca). */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(longe * 4.2) * 0.04 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

export const montarVaralDeRoupa: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const quartos = quartosDeVolta(c.giro)
  const yCorda = -hh + CORDA_DO_FUNDO
  const zCorda = g * ALTURA_DA_CORDA
  const zPoste = g * ALTURA_DO_POSTE
  const raio = g * RAIO_DO_POSTE
  const xPoste = hw - POSTE_DA_PONTA
  const o: Obra = { L, sombras: cena.sombras, P, yCorda, zCorda }
  const naCorda = xPoste - raio - FOLGA_DO_POSTE
  const roupas = repartir([camisa(), lencol(), calca(), panoListrado(c.m.pano)], -naCorda, naCorda)

  // A SOMBRA comprida no chão: a de cada trecho de roupa (da barra à corda) e o risco da corda. Cai para baixo à direita NA TELA.
  const [sx, sy] = desgirado(SOMBRA_X, SOMBRA_Y, quartos)
  for (const { roupa, x } of roupas) {
    for (const t of roupa.trechos) {
      const zAlto = zCorda - t.alto
      const zBaixo = zCorda - t.baixo
      const faixa = poligono([
        [x + t.x0 + sx * zBaixo, yCorda + sy * zBaixo],
        [x + t.x1 + sx * zBaixo, yCorda + sy * zBaixo],
        [x + t.x1 + sx * zAlto, yCorda + sy * zAlto],
        [x + t.x0 + sx * zAlto, yCorda + sy * zAlto],
      ])
      cena.sombras.push({ forma: faixa, z: 0, suave: SOMBRA_DA_ROUPA.suave, forca: SOMBRA_DA_ROUPA.forca })
    }
  }
  const riscoDaCorda = capsula(-xPoste + sx * zCorda, yCorda + sy * zCorda, xPoste + sx * zCorda, yCorda + sy * zCorda, SOMBRA_DA_CORDA.raio)
  cena.sombras.push({ forma: riscoDaCorda, z: 0, suave: SOMBRA_DA_CORDA.suave, forca: SOMBRA_DA_CORDA.forca })

  // A CORDA, de poste a poste, com o pino dela escondido debaixo (na linha dela, no meio).
  cena.sombras.push(estrutura(caixa(-PINO_DA_CORDA.meiaLargura, yCorda - PINO_DA_CORDA.meiaAltura, PINO_DA_CORDA.meiaLargura, yCorda + PINO_DA_CORDA.meiaAltura), zCorda))
  L.push(P(capsula(-xPoste, yCorda, xPoste, yCorda, RAIO_DA_CORDA), CORDA, { bisel: 0.6, contorno: 0.26, semente: 7801 }))

  // As ROUPAS. Com um quarto de volta na 3/4, de ponta: a de mais ao sul na tela por último.
  if (quartos % 2 === 1) {
    const sul = quartos === 1 ? 1 : -1
    const doNorteParaOSul = sul > 0 ? roupas : [...roupas].reverse()
    for (const [i, { roupa, x }] of doNorteParaOSul.entries()) pendurarDePonta(o, roupa, x, sul, 7810 + i)
  } else {
    for (const [i, { roupa, x }] of roupas.entries()) pendurarDeFrente(o, roupa, x, quartos === 2 ? -1 : 1, 7810 + i)
  }

  // Os POSTES: o risco da sombra, a ponta solta da corda, a laçada e o topo cortado.
  for (const lado of [-1, 1]) {
    const px = lado * xPoste
    const poste = circulo(px, yCorda, raio)
    cena.sombras.push({ forma: poste, z: zPoste, ...SOMBRA_DO_POSTE }, contato(poste, 0.3))
    const ponta = capsula(px + lado * raio * 0.5, yCorda + raio * 0.7, px + lado * (raio * 0.5 + PONTA_SOLTA.sai), yCorda + raio * 0.7 + PONTA_SOLTA.cai, PONTA_SOLTA.raio)
    L.push(P(comMeioEm(ponta, px, yCorda), CORDA, { eixo: Math.atan2(PONTA_SOLTA.cai, lado * PONTA_SOLTA.sai), bisel: 0.5, tom: 0.96, contorno: 0.26, semente: 7802 + lado }))
    L.push(P(anel(px, yCorda, raio + LACADA, raio + LACADA, raio - 0.3, raio - 0.3), CORDA, { arco: { cx: px, cy: yCorda, r: raio, a0: 0 }, bisel: 0.7, contorno: 0.26, semente: 7805 + lado }))
    // O topo leva a maior caixa do poste: é da maior peça que a 3/4 tira o material da frente dele (madeira, e não a corda da laçada).
    const emVolta = raio * 0.7 + PONTA_SOLTA.cai + PONTA_SOLTA.raio + 0.5
    L.push(P(naCaixa(poste, [px - emVolta, yCorda - emVolta, px + emVolta, yCorda + emVolta]), c.m.madeira, { tabua: 0, bisel: 0.8, contorno: 0.28, textura: texDoTopo(px, yCorda), semente: 7808 + lado }))
  }
}
