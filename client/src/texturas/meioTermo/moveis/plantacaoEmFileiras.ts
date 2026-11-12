/**
 * PLANTAÇÃO EM FILEIRAS de cima (lote 10 dos objetos novos, 11/11/2026, pedido
 * do mestre: "plantação em fileiras (no chão, como o campinho)"): um pedaço de
 * roça, para o mestre esticar e encostar outros até fazer um campo. A TERRA
 * ARADA em leiras ao comprido (o lombo de cada leira com a encosta virada para
 * a luz clara, o sulco escuro entre duas, os torrões) e, em cima de cada leira,
 * uma fileira de MILHO NOVO na altura do joelho: cada pé uma estrela de folhas
 * compridas e pontudas, com a nervura clara, as de cima mais novas e mais
 * claras, e a sombra de cada pé caindo no sulco. Sem cerca nem tábua em volta
 * (é o que separa da horta, que é um canteiro cercado de hortaliças redondas): a
 * terra acaba numa beira irregular que some no chão.
 *
 * O desenho se reparte pelo tamanho: as leiras e os pés têm medida própria, e o
 * pedaço esticado ganha mais leiras e mais pés por leira, nunca um pé esticado.
 * As leiras correm ao longo do lado maior; a primeira e a última começam num
 * sulco na beira e os pés ficam a meio passo da ponta, então dois pedaços do
 * mesmo tamanho encostados emendam no mesmo passo (a beira de cada um passa um
 * pouco da pegada e cobre a junta).
 *
 * É objeto de CHÃO RENTE, como o campinho: nenhuma sombra tem altura, então a
 * 3/4 sai igual à vista de cima e nada sobe; mora por baixo dos outros objetos
 * e das fichas. A sombra do motor fica por baixo de todas as peças (na terra ela
 * não apareceria): a sombra de cada pé é PINTADA na terra. A terra inteira é uma
 * peça só, com textura própria (leira, sulco, torrão e beira num passo por
 * pixel), como o gramado do campinho: uma peça por leira custaria a distância
 * de cada uma em cada pixel.
 *
 * Lê `c.giro` (o quarto de volta que a 3/4 pinta, e que só chega nela): a
 * encosta clara das leiras e a sombra dos pés ficam no lugar NA TELA.
 *
 * Sem material no painel: a terra e o milho são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { caixa, type Forma } from './formas'
import { ruido, SOMBRA_X, SOMBRA_Y, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

const VOLTA = Math.PI * 2

// ---------- a terra ----------

/** A terra arada: castanho úmido, mais escuro que a terra do caminho e mais claro que a da horta. */
const TERRA_ARADA: Rgb = rgb('#86664a')
/** Uma leira a cada tanto e um pé a cada tanto ao longo dela, em casas. */
const PASSO_DAS_LEIRAS = 0.43
const PASSO_DOS_PES = 0.25
/** A luz da encosta da leira e o escuro do sulco. */
const LUZ_DA_LEIRA = 0.15
const ESCURO_DO_SULCO = 0.2
/**
 * O quanto a linha da leira entorta (px do protótipo): leira aberta no arado, não na régua. Some perto
 * das pontas, para a leira chegar na beira no mesmo lugar do pedaço vizinho.
 */
const TORTO_DA_LEIRA = 1.6
/** Até onde (casas) a leira vai endireitando antes da ponta. */
const ENDIREITA_NA_PONTA = 0.5
/**
 * A beira (px do protótipo): a terra passa um pouco da pegada (`FORA`), em ondas largas e tufos miúdos, e
 * some no chão numa rampa de `RAMPA` px. Dois pedaços encostados ficam quase opacos na junta.
 */
const FORA_DA_BEIRA = 1.6
const ONDA_DA_BEIRA = 3.4
const TUFO_DA_BEIRA = 1.4
const RAMPA_DA_BEIRA = 2.2
/** Até onde a peça da terra passa da pegada: a beira mais longe que o ruído alcança. */
const ALCANCE_DA_BEIRA = FORA_DA_BEIRA + (ONDA_DA_BEIRA + TUFO_DA_BEIRA) / 2 + 0.5
/** A terra perto da beira fica um nada mais clara: seca e esfarelada, onde o arado não revolveu. */
const SECA_NA_BEIRA = 0.05

/** De onde vem a luz do motor, no chão (cima à esquerda, na tela). */
const LUZ_NO_CHAO: readonly [number, number] = [-0.62, -0.48]

/** Os quartos de volta do giro que a 3/4 pinta (0 fora dela). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** A direção (x, y) NA TELA vista do desenho, depois do quarto de volta que a 3/4 pinta (a luz fica onde está). */
function desgirada(x: number, y: number, quartos: number): readonly [number, number] {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** O campo no referencial das leiras: `X` ao longo delas, `Y` através. */
interface Campo {
  /** As leiras correm em x (a pegada deitada) ou em y. */
  readonly deitado: boolean
  readonly meioComprimento: number
  readonly meiaLargura: number
  readonly leira: number
  readonly passo: number
  /** Até onde (px do protótipo) a leira vai endireitando antes da ponta. */
  readonly endireita: number
  readonly hw: number
  readonly hh: number
  /** A luz no chão, no desenho: o quanto ela vem do lado de Y menor (através das leiras). */
  readonly luzAtraves: number
}

/** O lombo da leira: a encosta virada para a luz clareia, a outra escurece, e o fundo do sulco é escuro. */
function luzDaLeira(campo: Campo, X: number, Y: number): number {
  const ponta = Math.max(0, Math.min(1, (campo.meioComprimento - Math.abs(X)) / campo.endireita))
  const torto = ruido(X * 0.035 + 17, Y * 0.03 + 3) * TORTO_DA_LEIRA * ponta
  const noLombo = (Y + campo.meiaLargura + torto) / campo.leira
  const volta = (noLombo - Math.floor(noLombo) - 0.5) * VOLTA
  const sulco = (1 - Math.cos(volta)) / 2
  // Antes do lombo (Y menor) a encosta sobe para +Y e olha para -Y: clara quando a luz vem de lá.
  return -Math.sin(volta) * LUZ_DA_LEIRA * campo.luzAtraves - ESCURO_DO_SULCO * sulco * sulco * sulco
}

/**
 * A terra arada num passo só por pixel: as leiras, os torrões e os grãos soltos e a beira irregular (o alfa),
 * que passa um pouco da pegada e some no chão.
 */
function texDaTerraArada(campo: Campo): Textura {
  const { deitado, hw, hh } = campo
  return (_u, _v, x, y, _p, s) => {
    const X = deitado ? x : y
    const Y = deitado ? y : x
    let luz = luzDaLeira(campo, X, Y)
    luz += ruido(x * 0.28 + 41, y * 0.36 + 7) * 0.14 + ruido(x * 0.85 + 5, y * 0.85 + 13) * 0.07
    const grao = hash(Math.floor(x * 0.9), Math.floor(y * 0.9), 57)
    if (grao > 0.95) luz -= 0.1
    else if (grao < 0.04) luz += 0.09
    // A beira: só perto dela o ruído é calculado (o miolo é sempre terra cheia).
    const borda = Math.min(hw - Math.abs(x), hh - Math.abs(y))
    if (borda < RAMPA_DA_BEIRA + ALCANCE_DA_BEIRA) {
      const beira = (borda + FORA_DA_BEIRA + ruido(x * 0.3 + 71, y * 0.3 + 13) * ONDA_DA_BEIRA + ruido(x * 1.1 + 9, y * 1.1) * TUFO_DA_BEIRA) / RAMPA_DA_BEIRA
      if (beira < 1) {
        s[5] = beira <= 0 ? 0 : beira
        luz += SECA_NA_BEIRA * (1 - s[5])
      }
    }
    s[3] += luz
  }
}

// ---------- o milho ----------

/** Círculo com a distância exata (a plantação tem mais de cem pés, e a conta da elipse custa mais). */
function circulo(cx: number, cy: number, r: number): Forma {
  return { b: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r }
}

/**
 * A folha de milho: o fuso pontudo de (ax, ay) a (bx, by), de meia largura `meia` no meio, entre dois arcos
 * de círculo (a interseção de dois discos). Pontuda nas duas pontas, como a folha comprida da gramínea.
 */
function fuso(ax: number, ay: number, bx: number, by: number, meia: number): Forma {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const metade = Math.hypot(bx - ax, by - ay) / 2
  const nx = -(by - ay) / (2 * metade)
  const ny = (bx - ax) / (2 * metade)
  const raio = (metade * metade + meia * meia) / (2 * meia)
  const recuo = raio - meia
  const c1x = mx + nx * recuo
  const c1y = my + ny * recuo
  const c2x = mx - nx * recuo
  const c2y = my - ny * recuo
  return {
    b: [Math.min(ax, bx) - meia, Math.min(ay, by) - meia, Math.max(ax, bx) + meia, Math.max(ay, by) + meia],
    d: (x, y) => Math.max(Math.sqrt((x - c1x) * (x - c1x) + (y - c1y) * (y - c1y)) - raio, Math.sqrt((x - c2x) * (x - c2x) + (y - c2y) * (y - c2y)) - raio),
  }
}

/** As folhas: a velha de baixo, verde mais escuro; a nova de cima, verde-claro; e o olho do pé, o cartucho que ainda vai abrir. */
const FOLHA_VELHA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#6a9449') }
const FOLHA_NOVA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#86ad58') }
const OLHO_DO_PE: MaterialDaPeca = { classe: 'liso', rgb: rgb('#a9c472') }
/** A sombra pintada na terra. */
const COR_DA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [14, 11, 8] }

/** O pé de milho, em casas: o comprimento da maior folha, a meia largura dela e a altura do pé (a sombra). */
const PE = { folha: 0.17, meiaLargura: 0.014, altura: 0.36 } as const
/** Onde a folha nasce: um nada fora do meio do pé (px do protótipo). */
const NASCE_A = 0.7
/** A nervura do meio: a meia largura (px do protótipo) e a luz. */
const NERVURA = { meia: 0.32, luz: 0.11 } as const
/**
 * As folhas de um pé, de baixo para cima: o giro em volta do pé (as folhas do milho saem alternadas, uma
 * de cada lado, com o pé torcendo um pouco a cada uma), o comprimento e a largura (frações da maior) e o tom.
 */
const FOLHAS_DO_PE: readonly { readonly giro: number; readonly comp: number; readonly larg: number; readonly nova: boolean; readonly tom: number }[] = [
  { giro: 0, comp: 1, larg: 1, nova: false, tom: 0.9 },
  { giro: Math.PI + 0.3, comp: 0.95, larg: 1, nova: false, tom: 0.96 },
  { giro: 0.62, comp: 0.82, larg: 0.92, nova: false, tom: 1.04 },
  { giro: Math.PI + 0.95, comp: 0.74, larg: 0.88, nova: true, tom: 0.96 },
  { giro: 1.55, comp: 0.5, larg: 0.8, nova: true, tom: 1.06 },
]
/** O quanto cada folha sai do giro dela, ao acaso, e o tamanho do pé (fração do de partida). */
const TORTO_DA_FOLHA = 0.32
const MENOR_PE = 0.84
const MAIOR_PE = 1.12
/** Uma falha na fileira de vez em quando: o pé que não nasceu. */
const FALHA = 0.06
/** O quanto o pé sai do lugar dele, ao acaso (fração do passo ao longo, e da leira através). */
const SOLTO_AO_LONGO = 0.22
const SOLTO_ATRAVES = 0.1
/** A sombra pintada de cada pé: o raio (fração da maior folha), o alfa e a borda borrada (px do protótipo). */
const SOMBRA_DO_PE = { raio: 0.62, alfa: 0.22, suave: 2.2 } as const

/** A folha: a nervura clara do pé (ax, ay) para a ponta, ao longo de (ux, uy), e a luz manchada. */
function texDaFolha(ax: number, ay: number, ux: number, uy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const atraves = Math.abs(-(x - ax) * uy + (y - ay) * ux)
    s[3] += ruido(x * 0.6 + p.su, y * 0.6 + p.sv) * 0.07 + (atraves < NERVURA.meia ? NERVURA.luz * (1 - atraves / NERVURA.meia) : 0)
  }
}

function plantarPe(L: Peca[], P: CriarPeca, g: number, x: number, y: number, sem: number): void {
  const tamanho = MENOR_PE + (MAIOR_PE - MENOR_PE) * hash(sem, 1, 91)
  const comprida = g * PE.folha * tamanho
  const meia = g * PE.meiaLargura * (0.9 + 0.2 * hash(sem, 2, 91))
  const fase = hash(sem, 3, 91) * VOLTA
  FOLHAS_DO_PE.forEach((f, k) => {
    const a = fase + f.giro + (hash(sem, 10 + k, 92) - 0.5) * TORTO_DA_FOLHA
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const ax = x + ux * NASCE_A
    const ay = y + uy * NASCE_A
    const fim = comprida * f.comp
    L.push(P(fuso(ax, ay, x + ux * fim, y + uy * fim, meia * f.larg), f.nova ? FOLHA_NOVA : FOLHA_VELHA, {
      bisel: 0.45,
      contorno: 0.24,
      tom: f.tom * (0.95 + 0.1 * hash(sem, 20 + k, 93)),
      textura: texDaFolha(ax, ay, ux, uy),
      semente: sem + k,
    }))
  })
  L.push(P(circulo(x, y, 1.05), OLHO_DO_PE, { bisel: 0.6, contorno: 0.2, semente: sem + 9 }))
}

export const montarPlantacaoEmFileiras: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const quartos = quartosDoGiro(c.giro)
  const deitado = c.w >= c.h
  const comprimento = deitado ? c.w : c.h
  const largura = deitado ? c.h : c.w
  const leiras = Math.max(1, Math.round(largura / (g * PASSO_DAS_LEIRAS)))
  const pes = Math.max(1, Math.round(comprimento / (g * PASSO_DOS_PES)))
  const [lx, ly] = desgirada(LUZ_NO_CHAO[0], LUZ_NO_CHAO[1], quartos)
  const campo: Campo = {
    deitado,
    meioComprimento: comprimento / 2,
    meiaLargura: largura / 2,
    leira: largura / leiras,
    passo: comprimento / pes,
    endireita: g * ENDIREITA_NA_PONTA,
    hw,
    hh,
    // A encosta que olha para -Y fica clara quando a luz vem de lá: o componente da luz em -Y, normalizado pelo do chão.
    luzAtraves: -(deitado ? ly : lx) / Math.hypot(lx, ly),
  }

  // A terra: uma peça só, sem chanfro nem contorno (a beira é o alfa da textura).
  const fora = ALCANCE_DA_BEIRA + 0.5
  L.push(P(caixa(-hw - fora, -hh - fora, hw + fora, hh + fora), { classe: 'liso', rgb: TERRA_ARADA }, { bisel: 0, contorno: 0, textura: texDaTerraArada(campo), semente: 9001 }))

  // Os pés, leira por leira: primeiro todas as sombras (na terra, por baixo das folhas), depois as folhas.
  const lugares: [number, number, number][] = []
  for (let i = 0; i < leiras; i += 1) {
    for (let j = 0; j < pes; j += 1) {
      const sem = 9100 + i * 211 + j * 17
      if (hash(i, j, 9003) < FALHA) continue
      const X = -campo.meioComprimento + (j + 0.5 + (hash(i, j, 9004) - 0.5) * SOLTO_AO_LONGO) * campo.passo
      const Y = -campo.meiaLargura + (i + 0.5 + (hash(i, j, 9005) - 0.5) * SOLTO_ATRAVES) * campo.leira
      lugares.push(deitado ? [X, Y, sem] : [Y, X, sem])
    }
  }
  // A sombra de cada pé cai para baixo à direita NA TELA, com a plantação girada ou não.
  const [sx, sy] = desgirada(SOMBRA_X, SOMBRA_Y, quartos)
  const alto = g * PE.altura * 0.5
  for (const [x, y, sem] of lugares) {
    const raio = g * PE.folha * SOMBRA_DO_PE.raio * (0.9 + 0.2 * hash(sem, 4, 91))
    L.push(P(circulo(x + sx * alto, y + sy * alto, raio), COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: SOMBRA_DO_PE.alfa, suave: SOMBRA_DO_PE.suave }))
  }
  for (const [x, y, sem] of lugares) plantarPe(L, P, g, x, y, sem)
}
