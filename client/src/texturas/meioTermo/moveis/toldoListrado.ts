/**
 * TOLDO LISTRADO de cima com volume (lote 3 dos objetos novos, 11/11/2026): a
 * cobertura de pano da feira, ESTICADA NO AR entre quatro estacas. De cima
 * aparece o pano de listras largas (a cor do toldo e o linho cru), com as
 * beiras cedendo para dentro entre um canto e o outro (pano puxado só pelos
 * cantos), a BARRIGA no meio (a luz ao contrário de um monte: o lado da luz
 * fica na sombra e o outro, claro), as pregas que saem de cada canto amarrado
 * e a bainha costurada. Nas duas beiras em que as listras acabam, a FRANJA: a
 * sanefa recortada em gomos, cada um da cor da listra dele, com o debrum da
 * outra cor e uma borla entre um gomo e o outro. Em cada canto, o reforço de
 * lona com o ilhós de latão, a corda até a estaca, a laçada em volta dela, a
 * ponta solta e o topo cortado da estaca. No chão, a sombra do pano, caída
 * longe (ele está alto), e o risco da sombra de cada estaca.
 *
 * Não é a barraca (`barraca.ts`): lá o toldo tem duas águas com cumeeira e um
 * balcão embaixo; aqui é um pano só, quadrado, solto no ar, sem balcão.
 *
 * Na 3/4 (`tresQuartos.ts`; o perfil tem de ser `{ modo: 'derivado',
 * espessura: 0 }`, porque a sanefa é desenhada aqui): o pano é um tampo solto
 * na altura das estacas e cada estaca é uma coluna do chão até o canto dele;
 * por baixo, o chão com a sombra. A 3/4 lê o MEIO DA CAIXA de cada peça para
 * saber com quem ela sobe, então várias peças levam uma caixa de pintura
 * escolhida (`naCaixa`):
 * - a corda de cada canto fica entre o pano e a estaca, fora dos dois: a caixa
 *   dela fica em volta do ilhós, e ela sobe com o pano;
 * - o topo da estaca leva a maior caixa da estaca, para a frente dela sair de
 *   madeira, e não da corda da laçada;
 * - a SANEFA de cada uma das duas beiras (a faixa de pano que cai da beira e
 *   os gomos na ponta dela): de cima a faixa fica escondida debaixo do pano e
 *   só os gomos aparecem, para fora da beira; os dois sobem um pouco menos
 *   que o pano (a fresta do lado: uma tira de um terço de px ao longo da
 *   beira, um tampo sem sombra, só para dizer a altura). Na 3/4, a sanefa da
 *   beira que está na frente aparece pendurada nela, com os gomos embaixo; a
 *   do fundo desce para trás do pano, que é pintado depois e a esconde. Assim
 *   o toldo de costas (meia volta) mostra a outra sanefa, igual. Com um
 *   quarto de volta (o `giro`, que só chega na 3/4) as listras acabam nos
 *   lados e não há sanefa de frente: os gomos sobem com o pano, sem fresta
 *   nem faixa.
 *
 * A 25% de zoom sobram o quadrado de listras com os quatro pontos das estacas
 * e a sombra deslocada: é o que diz "toldo" e não "tapete". Materiais: `toldo`
 * (o pano; as listras são de linho cru, ou de vinho no toldo de linho) e
 * `madeira` (as estacas). A corda e o latão são fixos.
 */
import type { Rgb } from '../../ruido'
import { anel, capsula, dentroDe, elipse, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, TOM_DA_CORDA, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'

/** Altura do pano e do alto das estacas, em casas: passa por cima de quem está de pé. */
const ALTURA = 1.45

/** As estacas: onde ficam (fração da meia pegada, nos quatro cantos) e o raio (casas). */
const LUGAR_DA_ESTACA = 0.93
const RAIO_DA_ESTACA = 0.046
/** A sombra de cada estaca no chão: o borrão (px do protótipo) e a força. */
const BORRAO_DA_SOMBRA_DA_ESTACA = 1.5
const FORCA_DA_SOMBRA_DA_ESTACA = 0.22
/** Os cantos do pano (fração da meia pegada) e o quanto cada beira cede para dentro no meio (fração do menor meio lado). */
const CANTO_DO_PANO = 0.84
const FLECHA = 0.085
/** As listras: largas, a primeira e a última da cor do toldo. */
const LISTRAS = 5

/** A corda das amarras (a palha clara da corda da cerca, com a torção) e o latão dos ilhoses. */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const LATAO = materialDaPeca('latao')

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A cor das listras: linho cru; no toldo de linho, vinho (linho sobre linho dava um toldo liso). */
function listraDoToldo(toldo: MaterialDaPeca): MaterialDaPeca {
  return materialDaPeca(toldo.fio === 'linho' ? 'vinho' : 'linho')
}

/**
 * A mesma forma com outra caixa de pintura. A 3/4 lê o meio da caixa para saber em que estrutura a peça está
 * (e a maior caixa de cada estrutura dá o material da frente dela): a caixa escolhida põe a peça onde ela tem
 * de subir. Tem de conter a forma inteira.
 */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/**
 * O círculo de raio `r` (a estaca), com a distância exata: a sombra da estaca alta mede a forma vinte vezes por
 * pixel, e a conta da elipse custa várias vezes mais.
 */
function circulo(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r,
  }
}

/** A caixa de meio lado (`mx`, `my`) em volta do ponto. */
function emVoltaDe(x: number, y: number, mx: number, my: number): Caixa {
  return [x - mx, y - my, x + mx, y + my]
}

// ---------- o pano ----------

/** As medidas do pano: os cantos em (±px, ±py) e a flecha de cada beira. */
interface Pano {
  readonly px: number
  readonly py: number
  readonly flecha: number
}

/** Quanto a beira cede para dentro no ponto `ao` do lado de meio comprimento `meio`: uma parábola, zero nos cantos. */
function cede(ao: number, meio: number, flecha: number): number {
  const t = ao / meio
  return flecha * (1 - t * t)
}

/**
 * A distância com sinal (positiva para fora) à beira de um lado do pano: `ao` corre ao longo do lado (meio
 * comprimento `meio`) e `fora` cresce para fora dele, a partir do meio do pano (o canto fica em `canto`).
 */
function ateABeira(ao: number, meio: number, fora: number, canto: number, flecha: number): number {
  const t = ao / meio
  const inclinacao = (2 * flecha * t) / meio
  return (fora - canto + flecha * (1 - t * t)) / Math.sqrt(1 + inclinacao * inclinacao)
}

/** A distância à beira de baixo (`lado` = 1) ou de cima (-1) do pano. */
function ateABeiraDasListras({ px, py, flecha }: Pano, lado: number, x: number, y: number): number {
  return ateABeira(x, px, lado * y, py, flecha)
}

/**
 * O pano: as quatro beiras em parábola, de canto a canto. A distância é a da beira mais próxima (direto pela
 * conta da parábola: um polígono de 60 lados custava seis vezes mais por pixel, e o pano é a peça grande).
 */
function formaDoPano(pano: Pano): Forma {
  const { px, py, flecha } = pano
  return {
    b: [-px, -py, px, py],
    d: (x, y) => Math.max(ateABeira(x, px, -y, py, flecha), ateABeira(x, px, y, py, flecha), ateABeira(y, py, x, px, flecha), ateABeira(y, py, -x, px, flecha)),
  }
}

/** Para onde a luz NÃO chega, no chão (o contrário da direção da luz do motor): o lado claro da barriga. */
const CONTRA_A_LUZ_X = 0.79
const CONTRA_A_LUZ_Y = 0.61
/** A barriga: quanto a luz muda de um canto ao outro do pano, e o quanto o fundo dela (o meio) escurece. */
const LUZ_DA_BARRIGA = 0.21
const FUNDO_DA_BARRIGA = 0.06
/** As pregas de cada canto amarrado: quantas em uma volta, até onde chegam (fração do raio do pano) e a luz. */
const PREGAS_DO_CANTO = 15
const ALCANCE_DAS_PREGAS = 0.64
const LUZ_DAS_PREGAS = 0.11
/** A bainha: a largura dela e a meia largura da linha da costura (px do protótipo). */
const BAINHA = 2
const COSTURA = 0.38
/** A beira macia entre uma listra e a outra, e a meia largura da emenda dos panos (px do protótipo). */
const BEIRA_DA_LISTRA = 0.35
const EMENDA = 0.45

/** A distância do último ponto medido por `naListra` à emenda mais próxima (px do protótipo); infinita na beira de fora do pano. */
const ATE_A_EMENDA = new Float64Array(1)

/** Quanto da cor da listra entra no ponto `x`: 0 = a cor do toldo, 1 = a da listra. Deixa em `ATE_A_EMENDA` a distância à emenda. */
function naListra(x: number, meiaLargura: number): number {
  const banda = (2 * meiaLargura) / LISTRAS
  const f = limitar((x + meiaLargura) / banda, 0, LISTRAS - 0.001)
  const i = Math.floor(f)
  const ate = Math.min(f - i, 1 - (f - i)) * banda
  const daListra = (i & 1) === 1
  // Na beira de fora da primeira e da última listra não há emenda nem outra cor: o pano acaba ali.
  if ((i === 0 && f - i < 0.5) || (i === LISTRAS - 1 && f - i >= 0.5)) {
    ATE_A_EMENDA[0] = Infinity
    return daListra ? 1 : 0
  }
  ATE_A_EMENDA[0] = ate
  return limitar(0.5 + ((daListra ? 1 : -1) * ate) / (2 * BEIRA_DA_LISTRA), 0, 1)
}

/**
 * O pano: as listras de cima a baixo (com a emenda entre um pano e o outro), o tecido, a barriga, as pregas
 * que saem de cada canto e a bainha em volta.
 */
function texDoPano(forma: Forma, pano: Pano, cantos: readonly Ponto[], listra: Rgb, sem: number): Textura {
  const raio = Math.hypot(pano.px, pano.py)
  const alcance = raio * ALCANCE_DAS_PREGAS
  // Só perto da beira vale a pena medir a distância a ela (a bainha): no miolo ela não muda nada.
  const miolo = pano.flecha + BAINHA + COSTURA + 0.5
  // O pano é a peça grande do toldo: aqui as contas por pixel vão por `Math.sqrt` (o `Math.hypot` custa várias vezes mais).
  return (_u, _v, x, y, _p, s, escala) => {
    const t = naListra(x, pano.px)
    s[0] += (listra[0] - s[0]) * t
    s[1] += (listra[1] - s[1]) * t
    s[2] += (listra[2] - s[2]) * t
    const fino = escala >= ESCALA_DO_DETALHE
    let luz = ruido(x * 0.5 + sem, y * 0.5) * 0.05 + ruido(x * 0.11, y * 0.11 + sem) * 0.06
    if (fino && ATE_A_EMENDA[0] < EMENDA) luz -= 0.08 * (1 - ATE_A_EMENDA[0] / EMENDA)
    // A barriga: o pano desce para o meio, então a metade do lado da luz olha para longe dela.
    const longe = Math.min(1, Math.sqrt(x * x + y * y) / raio)
    luz += LUZ_DA_BARRIGA * ((x * CONTRA_A_LUZ_X + y * CONTRA_A_LUZ_Y) / raio) * (0.35 + 0.65 * longe) - FUNDO_DA_BARRIGA * (1 - longe) * (1 - longe)
    for (let k = 0; k < cantos.length; k += 1) {
      const dx = x - cantos[k][0]
      const dy = y - cantos[k][1]
      const d2 = dx * dx + dy * dy
      if (d2 >= alcance * alcance) continue
      const perto = 1 - Math.sqrt(d2) / alcance
      luz += Math.sin(Math.atan2(dy, dx) * PREGAS_DO_CANTO + k * 1.7 + ruido(dx * 0.06 + sem, dy * 0.06 + k) * 2.4) * LUZ_DAS_PREGAS * perto * Math.sqrt(perto)
    }
    if (Math.abs(x) > pano.px - miolo || Math.abs(y) > pano.py - miolo) {
      const d = forma.d(x, y)
      if (d > -BAINHA) luz += 0.04
      if (fino && Math.abs(d + BAINHA) < COSTURA) luz -= 0.12 * (1 - Math.abs(d + BAINHA) / COSTURA)
    }
    s[3] += luz
  }
}

// ---------- a sanefa (a franja) ----------

/** Os gomos da sanefa: quantos por listra, o quanto cada um passa da beira e a parte de fora dele que é debrum (px do protótipo e fração do raio). */
const GOMOS_POR_LISTRA = 2
const GOMO = 3.3
const DEBRUM = 0.74
/** A borla entre um gomo e o outro: a meia largura, o meio comprimento e o quanto ela fica para fora da beira (px do protótipo). */
const BORLA = { larga: 0.75, comprida: 1.25, fora: 1.5 } as const
/** A sanefa na 3/4: quanto de pano cai da beira até os gomos (px do protótipo). */
const SANEFA = 6.4
/** A sanefa entra este tanto debaixo da beira do pano, na 3/4, para não abrir fresta (px do protótipo). */
const SANEFA_SOB_O_PANO = 0.6
/**
 * A fresta que diz à 3/4 a altura de quem tem o meio da caixa nela: a largura da tira, a distância dela à beira
 * do pano e o quanto ela acaba antes de cada canto (px do protótipo). O borrão é o da sombra dela, que não
 * escurece nada (força zero): curto, para a pintura da sombra não varrer o chão à toa.
 */
const FRESTA = 0.33
const FOLGA_DA_FRESTA = 1
const RECUO_DA_FRESTA = 0.5
const BORRAO_DA_FRESTA = 0.2
/** Sem fresta (a sanefa de lado), a caixa dos gomos e das borlas fica este tanto para dentro da beira do pano (px do protótipo). */
const CAIXA_DENTRO_DO_PANO = 2

/**
 * O gomo: o pano da cor da listra dele e, na beira de fora (`lado` = 1 para baixo, -1 para cima), o debrum da
 * outra cor. A metade de dentro não tem debrum: na 3/4 ela aparece, e o gomo inteiro debruado virava uma argola.
 */
function texDoGomo(cx: number, cy: number, rx: number, ry: number, lado: number, debrum: Rgb, sem: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[3] += ruido(x * 0.5 + sem, y * 0.5) * 0.05
    if (lado * (y - cy) < 0) return
    const q = Math.hypot((x - cx) / rx, (y - cy) / ry)
    const t = limitar((q - DEBRUM) / 0.08, 0, 1)
    s[0] += (debrum[0] - s[0]) * t
    s[1] += (debrum[1] - s[1]) * t
    s[2] += (debrum[2] - s[2]) * t
  }
}

/** A faixa de pano da sanefa: as listras do pano continuam nela, com as pregas de pano pendurado. */
function texDaSanefa(meiaLargura: number, listra: Rgb, sem: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = naListra(x, meiaLargura)
    s[0] += (listra[0] - s[0]) * t
    s[1] += (listra[1] - s[1]) * t
    s[2] += (listra[2] - s[2]) * t
    s[3] += ruido(x * 0.5 + sem, y * 0.5) * 0.05 + Math.sin(x * 0.85 + ruido(x * 0.1, sem) * 3) * 0.05
  }
}

// ---------- as estacas e as amarras ----------

/** O reforço de lona de cada canto (o raio dele, a partir da ponta) e o ilhós (a distância da ponta e os raios), em px do protótipo. */
const REFORCO = 6.4
const LUGAR_DO_ILHOS = 3.3
const RAIO_DO_ILHOS = 1.25
const FURO_DO_ILHOS = 0.55
/** A corda: o raio dela, a folga da laçada em volta da estaca e o comprimento da ponta solta (px do protótipo). */
const RAIO_DA_CORDA = 0.72
const LACADA = 1
const PONTA_SOLTA = 3.6

/** Topo de madeira cortada: anéis em volta do centro da estaca (como o mourão da cerca). */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(longe * 4.2) * 0.04 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

export const montarToldoListrado: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const toldo = c.m.toldo
  const mad = c.m.madeira
  const listra = listraDoToldo(toldo)
  const L = cena.partes
  const z = g * ALTURA
  const pano: Pano = { px: hw * CANTO_DO_PANO, py: hh * CANTO_DO_PANO, flecha: Math.min(hw, hh) * FLECHA }
  const { px, py, flecha } = pano
  const cantos: readonly Ponto[] = [[-px, -py], [px, -py], [px, py], [-px, py]]
  const forma = formaDoPano(pano)
  cena.sombras.push({ forma, z, solta: true, forca: 0.3 })

  // A SANEFA das duas beiras, por baixo do pano. Cada lado tem a fresta dele, logo depois da beira, e todas as
  // peças do lado levam a caixa em volta de um ponto dela: sobem um pouco menos que o pano.
  // Na 3/4 com um quarto de volta (o `giro` só chega aqui na 3/4) as listras acabam nos LADOS, e a sanefa
  // não cai de frente: os gomos e as borlas sobem com o pano (a caixa deles fica dentro dele), sem fresta nem
  // faixa. Com a fresta, a faixa descia ao longo da beira e sobrava uma aba em cada canto de baixo.
  const sanefaDeLado = Math.abs(Math.round(c.giro / 90)) % 2 === 1
  const lugarDaCaixa = sanefaDeLado ? -CAIXA_DENTRO_DO_PANO : FOLGA_DA_FRESTA
  const gomos = LISTRAS * GOMOS_POR_LISTRA
  const larguraDoGomo = (2 * px) / gomos
  for (const lado of [1, -1]) {
    // A fresta: uma tira fina ao longo da beira, um pouco para fora dela. Na 3/4 a da beira da frente fica
    // atrás dos gomos e das borlas, e a do fundo, atrás do pano.
    const fresta: Forma = {
      b: lado > 0 ? [-px, py - flecha, px, py + FOLGA_DA_FRESTA + FRESTA] : [-px, -py - FOLGA_DA_FRESTA - FRESTA, px, -py + flecha],
      d: (x, y) => Math.max(Math.abs(ateABeiraDasListras(pano, lado, x, y) - FOLGA_DA_FRESTA) - FRESTA / 2, Math.abs(x) - px + RECUO_DA_FRESTA),
    }
    if (!sanefaDeLado) cena.sombras.push({ forma: fresta, z: z - SANEFA + SANEFA_SOB_O_PANO, solta: true, forca: 0, suave: BORRAO_DA_FRESTA })
    /**
     * A caixa de uma peça deste lado: em volta do ponto que fica a `lugarDaCaixa` px da beira (na fresta, ou
     * dentro do pano) em `x`, com a meia largura dada e a altura para a peça, que vai de `de` a `ate` px da
     * beira (para fora dela, positivo).
     */
    const naFresta = (x: number, meiaLargura: number, de: number, ate: number): Caixa =>
      emVoltaDe(x, lado * (py - cede(x, px, flecha) + lugarDaCaixa), meiaLargura + 0.5, Math.max(Math.abs(de - lugarDaCaixa), Math.abs(ate - lugarDaCaixa)) + 0.5)
    for (let i = 0; i < gomos; i += 1) {
      const xc = -px + (i + 0.5) * larguraDoGomo
      const yc = lado * (py - cede(xc, px, flecha))
      const daListra = (Math.floor(i / GOMOS_POR_LISTRA) & 1) === 1
      const gomo = elipse(xc, yc, larguraDoGomo / 2 + 0.15, GOMO)
      L.push(P(naCaixa(gomo, naFresta(xc, larguraDoGomo / 2 + 0.15, -GOMO, GOMO)), daListra ? listra : toldo, {
        tabua: 0,
        bisel: 1,
        tom: 0.9,
        contorno: 0.26,
        textura: texDoGomo(xc, yc, larguraDoGomo / 2 + 0.15, GOMO, lado, (daListra ? toldo : listra).rgb, 6160 + i),
        semente: 6160 + i + (lado > 0 ? 0 : 40),
      }))
    }
    if (!sanefaDeLado) {
      // A faixa que cai da beira, por cima da metade de dentro dos gomos: de cima fica escondida debaixo do pano.
      const faixa: Forma = {
        b: lado > 0 ? [-px, py - flecha - SANEFA, px, py] : [-px, -py, px, -py + flecha + SANEFA],
        d(x, y) {
          const d = ateABeiraDasListras(pano, lado, x, y)
          return Math.max(d + 0.3, -d - SANEFA, ateABeira(y, py, x, px, flecha), ateABeira(y, py, -x, px, flecha))
        },
      }
      L.push(P(naCaixa(faixa, naFresta(0, px, -SANEFA, flecha)), toldo, { tabua: 0, bisel: 0.5, tom: 0.84, contorno: 0.16, textura: texDaSanefa(px, listra.rgb, 6150), semente: 6150 + (lado > 0 ? 0 : 1) }))
    }
    for (let i = 1; i < gomos; i += 1) {
      const xb = -px + i * larguraDoGomo
      const yb = lado * (py - cede(xb, px, flecha) + BORLA.fora)
      const borla = elipse(xb, yb, BORLA.larga, BORLA.comprida)
      L.push(P(naCaixa(borla, naFresta(xb, BORLA.larga, BORLA.fora - BORLA.comprida, BORLA.fora + BORLA.comprida)), listra, { tabua: 0, bisel: 0.6, tom: 1.02, contorno: 0.3, semente: 6200 + i }))
    }
  }

  // O PANO.
  L.push(P(forma, toldo, { tabua: 0, bisel: 1.5, ruga: 0.9, contorno: 0.24, textura: texDoPano(forma, pano, cantos, listra.rgb, 6101), semente: 6101 }))

  // Em cada canto: o reforço de lona, o ilhós, a corda até a estaca, a laçada, a ponta solta e o topo da estaca.
  const r = g * RAIO_DA_ESTACA
  cantos.forEach(([cx, cy], k) => {
    const sx = Math.sign(cx)
    const sy = Math.sign(cy)
    const sem = 6110 + k * 10
    L.push(P(dentroDe(forma, elipse(cx, cy, REFORCO, REFORCO)), listra, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.24, semente: sem }))
    const ix = cx - sx * LUGAR_DO_ILHOS * Math.SQRT1_2
    const iy = cy - sy * LUGAR_DO_ILHOS * Math.SQRT1_2
    L.push(P(anel(ix, iy, RAIO_DO_ILHOS, RAIO_DO_ILHOS, FURO_DO_ILHOS, FURO_DO_ILHOS), LATAO, { bisel: 0.4, contorno: 0.3, semente: sem + 1 }))

    const ex = sx * hw * LUGAR_DA_ESTACA
    const ey = sy * hh * LUGAR_DA_ESTACA
    const estaca = circulo(ex, ey, r)
    // A sombra da estaca é um risco fino e firme: com o borrão que a altura dela daria, sumia no chão.
    cena.sombras.push({ forma: estaca, z, suave: BORRAO_DA_SOMBRA_DA_ESTACA, forca: FORCA_DA_SOMBRA_DA_ESTACA }, contato(estaca, 0.3))
    // A corda sai do ilhós e chega à estaca; a caixa dela fica em volta do ilhós, que está dentro do pano.
    const corda = capsula(ix, iy, ex - sx * r * 0.6, ey - sy * r * 0.6, RAIO_DA_CORDA)
    const meia = Math.max(Math.abs(ex - ix), Math.abs(ey - iy)) + RAIO_DA_CORDA + 0.5
    L.push(P(naCaixa(corda, emVoltaDe(ix, iy, meia, meia)), CORDA, { eixo: Math.atan2(ey - iy, ex - ix), bisel: 0.6, contorno: 0.26, semente: sem + 2, projeta: { dist: 0.8, forca: 0.26, suave: 0.6 } }))

    // Na estaca: a ponta solta da corda, a laçada e o topo cortado (a maior caixa, para a frente da estaca sair de madeira).
    const emVolta = r + PONTA_SOLTA + 1
    const ponta = capsula(ex + sx * r * 0.5, ey - sy * r * 0.7, ex + sx * (r * 0.5 + PONTA_SOLTA * 0.5), ey - sy * (r * 0.7 + PONTA_SOLTA * 0.86), RAIO_DA_CORDA * 0.85)
    L.push(P(naCaixa(ponta, emVoltaDe(ex, ey, emVolta - 0.5, emVolta - 0.5)), CORDA, { eixo: Math.atan2(-sy * 0.86, sx * 0.5), bisel: 0.5, tom: 0.96, contorno: 0.26, semente: sem + 3 }))
    L.push(P(anel(ex, ey, r + LACADA, r + LACADA, r - 0.3, r - 0.3), CORDA, { arco: { cx: ex, cy: ey, r, a0: 0 }, bisel: 0.7, contorno: 0.26, semente: sem + 4 }))
    L.push(P(naCaixa(estaca, emVoltaDe(ex, ey, emVolta, emVolta)), mad, { tabua: 0, bisel: 0.8, contorno: 0.28, textura: texDoTopo(ex, ey), semente: sem + 5 }))
  })
}
