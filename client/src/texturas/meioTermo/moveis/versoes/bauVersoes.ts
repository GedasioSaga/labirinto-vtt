/**
 * As VERSÕES do baú (L01 do plano de arte por tema, 28/11/2026): a 1ª, Fechado, é o desenho de `MONTADORES`
 * (`../bau.ts`); as outras duas são o baú ABERTO, com a tampa virada para trás no gonzo e o corpo à vista por dentro:
 *
 * - **Aberto com tesouro:** o corpo cheio de moedas de ouro (as do monte de moedas, `tesouroDeOuro.ts`), mais alto no
 *   meio, com três pedras em tons contidos (rubi, safira e esmeralda), um cálice e dois brilhos; duas moedas
 *   escorregaram para a beira da frente.
 * - **Aberto vazio:** o fundo de tábuas no escuro, o pano de forro amassado num canto e duas moedas esquecidas no
 *   outro: o baú saqueado.
 *
 * DE CIMA o corpo é a caixa de sempre (a mesma pegada, as cintas e as cantoneiras), vista por dentro: a borda das
 * quatro paredes, clara, e o fundo afundado. A TAMPA aberta, um pouco além do prumo, fica atrás do corpo, fora da
 * pegada: a face de fora dela, em arco, vista do alto numa faixa (`faixaDaTampa`), com as cintas, os rebites, as
 * cantoneiras da ponta e o fecho pendurado da beira. NA 3/4 o corpo sobe a altura dele (o terço de baixo do baú
 * fechado) com a frente desenhada (as tábuas, as cintas, as cantoneiras e a chapa da fechadura) e a tampa sobe atrás
 * dele mostrando a face de dentro; girado, a 3/4 varre a madeira das duas. DE LADO, o corpo com a alça e a tampa em
 * arco virada para trás no gonzo. Lugares de material: `madeira` e `ferragens`, os do baú.
 */
import type { VersoesDesenhadas } from '.'
import { hash } from '../../../ruido'
import { BURACO, QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { anel, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Ponto } from '../formas'
import { CANTONEIRA as BEIRA_DA_FACE, fatiar, FRESTA, naFaixa, type PecaDaFrente } from '../guardaRoupa'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca, type Peca } from '../motor'
import { MASSA_DO_OURO, OURO, paraALuz, pintarBrilho, pintarMoedaDeOuro, type MoedaDeOuro } from '../tesouroDeOuro'
import { quartosDeVolta } from '../varalDeBandeirinhas'

/** A altura do baú fechado (casas) e a parte dela que é o corpo, as de `../bau.ts`. */
const ALTURA = 0.55
const COSTURA = 0.64
/** A grossura das paredes vista de cima (px do protótipo). */
const PAREDE = 2.4
/** O quanto a tampa abriu: um pouco além do prumo, apoiada para trás. */
const ABERTURA = (105 * Math.PI) / 180
/** As cintas (o meio, em fração da largura, e a meia largura) e as cantoneiras (braços em frações da largura e da fundura). */
const CINTA = { meio: 0.3, meiaLargura: 0.045 } as const
const CANTONEIRA = { deitada: 0.13, dePe: 0.2 } as const
/** O fecho, pendurado da beira da frente da tampa (a meia largura em fração da largura e o comprimento em px). */
const FECHO = { meiaLargura: 0.065, comprido: 4.6 } as const
/** As alturas dos rebites da frente do corpo, em fração da altura dele. */
const REBITES_DO_CORPO: readonly number[] = [0.78, 0.42, 0.12]

type Conteudo = 'tesouro' | 'vazio'

/** O que a tampa ocupa de cima (px atrás da beira de trás) e a altura da ponta dela, aberta (px). */
function faixaDaTampa(c: ContextoDoMovel): { readonly fundura: number; readonly alto: number; readonly corpo: number } {
  const corpo = c.g * ALTURA * COSTURA
  const arco = c.g * ALTURA * (1 - COSTURA)
  return {
    fundura: c.h * Math.abs(Math.cos(ABERTURA)) + arco * Math.sin(ABERTURA),
    alto: corpo + c.h * Math.sin(ABERTURA),
    corpo,
  }
}

// ---------- de cima: o corpo aberto ----------

/** As quatro paredes vistas de cima, em meia-esquadria, mais claras que o fundo (é a beira que pega a luz). */
function paredes(c: ContextoDoMovel, L: Peca[]): void {
  const { hw, hh, peca: P } = c
  const t = PAREDE
  const lados: readonly (readonly [readonly Ponto[], number])[] = [
    [[[-hw, -hh], [hw, -hh], [hw - t, -hh + t], [-hw + t, -hh + t]], 0],
    [[[-hw, hh], [-hw + t, hh - t], [hw - t, hh - t], [hw, hh]], 0],
    [[[-hw, -hh], [-hw + t, -hh + t], [-hw + t, hh - t], [-hw, hh]], QUARTO],
    [[[hw, -hh], [hw, hh], [hw - t, hh - t], [hw - t, -hh + t]], QUARTO],
  ]
  lados.forEach(([pontos, eixo], i) => L.push(P(poligono(pontos), c.m.madeira, { eixo, tabua: 0, bisel: 0.7, tom: 1.02, contorno: 0.28, semente: 5200 + i })))
}

/** As ferragens na beira: as pontas das duas cintas nas paredes da frente e de trás, as cantoneiras dos cantos e a chapa da fechadura. */
function ferragensDaBeira(c: ContextoDoMovel, L: Peca[]): void {
  const { hw, hh, w, h, peca: P } = c
  const fer = c.m.ferragens
  const t = PAREDE
  const m = CINTA.meiaLargura * w
  for (const sx of [-1, 1]) {
    const xc = sx * CINTA.meio * w
    for (const sy of [-1, 1]) {
      const [y0, y1] = sy < 0 ? [-hh, -hh + t] : [hh - t, hh]
      L.push(P(caixa(xc - m, y0, xc + m, y1, 0.3), fer, { bisel: 0.6, contorno: 0.22, tom: 0.95, semente: 5210 + sx + sy * 3 }))
      L.push(P(elipse(xc, (y0 + y1) / 2, 0.75, 0.75), fer, { bisel: 0.7, contorno: 0.1, tom: 1.08, semente: 5220 }))
    }
  }
  const cw = CANTONEIRA.deitada * w
  const ch = CANTONEIRA.dePe * h
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const xa = sx * hw
    const ya = sy * hh
    const deitada = caixa(Math.min(xa, xa - sx * cw), Math.min(ya, ya - sy * t), Math.max(xa, xa - sx * cw), Math.max(ya, ya - sy * t), 0.3)
    const dePe = caixa(Math.min(xa, xa - sx * t), Math.min(ya, ya - sy * ch), Math.max(xa, xa - sx * t), Math.max(ya, ya - sy * ch), 0.3)
    L.push(P(uniao(deitada, dePe), fer, { bisel: 0.6, contorno: 0.24, tom: 0.92, semente: 5230 + sx + sy * 3 }))
  }
  // A chapa da fechadura, no alto da parede da frente (a lingueta do fecho entra nela).
  L.push(P(caixa(-2.6, hh - t - 0.3, 2.6, hh + 0.4, 0.5), fer, { bisel: 0.7, contorno: 0.26, tom: 0.9, semente: 5240 }))
  L.push(P(caixa(-0.9, hh - t * 0.62, 0.9, hh - t * 0.18, 0.3), BURACO, { bisel: 0, contorno: 0, tom: 0.8, semente: 5241 }))
}

/** O fundo do corpo, de tábuas no escuro, com a sombra das paredes de cima e da esquerda caindo para dentro. */
function fundo(c: ContextoDoMovel, L: Peca[]): void {
  const { hw, hh, peca: P } = c
  const t = PAREDE
  L.push(P(caixa(-hw + t, -hh + t, hw - t, hh - t, 0.6), c.m.madeira, { eixo: 0, tabua: (c.h - 2 * t) / 3, bisel: 0.4, tom: 0.56, contorno: 0.2, recesso: { k: 4.8, forca: 0.5 }, semente: 5250 }))
}

/** As pedras de cor contida (saturação HSL até 0,4) e o reflexo delas. */
const PEDRAS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x9a, 0x45, 0x4c] },
  { classe: 'liso', rgb: [0x4a, 0x62, 0x94] },
  { classe: 'liso', rgb: [0x3f, 0x80, 0x62] },
]
const REFLEXO_DA_PEDRA: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xea, 0xe4] }
const VINHO_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x3a, 0x30] }

/** O tesouro: a massa de ouro por baixo, as moedas inclinadas (o meio por cima), as pedras, o cálice e os brilhos. */
function tesouro(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const t = PAREDE
  const luz = paraALuz(c.giro)
  const [x0, y0, x1, y1] = [-hw + t + 0.4, -hh + t + 0.4, hw - t - 0.4, hh - t - 0.4]
  L.push(P(caixa(x0, y0, x1, y1, 1.4), MASSA_DO_OURO, { tabua: 0, bisel: 2.2, tom: 0.92, contorno: 0.16, semente: 5300 }))
  const passo = 4.1
  const moedas: MoedaDeOuro[] = []
  let i = 0
  for (let y = y0 + 1.6; y <= y1 - 1.2; y += passo * 0.8) {
    for (let x = x0 + 1.6 + (Math.round(y) % 2) * passo * 0.5; x <= x1 - 1.2; x += passo) {
      const jx = (hash(i, 1, 5301) - 0.5) * 2
      const jy = (hash(i, 2, 5301) - 0.5) * 1.6
      moedas.push({
        x: x + jx,
        y: y + jy,
        r: 2.3 + 0.6 * hash(i, 3, 5301),
        achatado: 0.6 + 0.4 * hash(i, 4, 5301),
        ang: hash(i, 5, 5301) * Math.PI,
        tom: 0.86 + 0.26 * hash(i, 6, 5301),
        detalhe: 'miolo',
        projeta: 0.55,
        semente: 5400 + i * 2,
      })
      i += 1
    }
  }
  // O monte é mais alto no meio: as moedas de perto da beira saem primeiro, as do meio por cima delas.
  const longe = (m: MoedaDeOuro): number => Math.hypot(m.x / hw, m.y / hh)
  moedas.sort((a, b) => longe(b) - longe(a)).forEach((m) => pintarMoedaDeOuro(P, cena, m, luz))
  // As três pedras, o cálice e os brilhos.
  const pedras: readonly (readonly [number, number, number])[] = [
    [-0.2, 0.05, 0.4],
    [0.14, 0.22, 1.9],
    [0.3, -0.16, 2.6],
  ]
  pedras.forEach(([fx, fy, ang], k) => {
    const x = fx * c.w
    const y = fy * c.h
    L.push(P(elipseGirada(x, y, 2.7, 2.05, ang), PEDRAS[k], { tabua: 0, bisel: 1.5, tom: 1, metal: 0.3, contorno: 0.32, projeta: { dist: 0.8, forca: 0.36 }, semente: 5600 + k }))
    L.push(P(elipse(x - 0.8, y - 0.7, 0.7, 0.55), REFLEXO_DA_PEDRA, { bisel: 0, contorno: 0, alfa: 0.75, suave: 0.4, semente: 5610 + k }))
  })
  const [gx, gy] = [-0.34 * c.w, -0.14 * c.h]
  L.push(P(elipse(gx, gy, 4, 4), OURO, { tabua: 0, bisel: 1.1, metal: 0.5, tom: 1, contorno: 0.3, projeta: { dist: 1.1, forca: 0.4 }, semente: 5620 }))
  L.push(P(elipse(gx + 0.2, gy + 0.2, 2.8, 2.8), VINHO_VELHO, { tabua: 0, bisel: 0, contorno: 0.14, tom: 1, recesso: { k: 1.4, forca: 0.4 }, semente: 5621 }))
  L.push(P(anel(gx, gy, 4, 4, 3.15, 3.15), OURO, { tabua: 0, bisel: 0.5, metal: 0.55, tom: 1.14, contorno: 0.22, semente: 5622 }))
  pintarBrilho(P, cena, 0.05 * c.w, -0.08 * c.h, 2.4, 5630)
  pintarBrilho(P, cena, -0.08 * c.w, 0.26 * c.h, 1.8, 5640)
}

/** As duas moedas que escorregaram até a beira da frente (por cima da parede, depois dela). */
const MOEDAS_NA_BEIRA: readonly (readonly [number, number, number])[] = [
  [-0.17, 0.55, 0.95],
  [0.21, 0.35, 0.7],
]

function moedasNaBeira(c: ContextoDoMovel, cena: Cena): void {
  const luz = paraALuz(c.giro)
  MOEDAS_NA_BEIRA.forEach(([fx, fy, achatado], k) => {
    const moeda: MoedaDeOuro = { x: fx * c.w, y: c.hh - PAREDE * fy, r: 2.5, achatado, ang: 0.3, tom: 1.02, detalhe: 'beira', projeta: 0.7, semente: 5650 + k * 2 }
    pintarMoedaDeOuro(c.peca, cena, moeda, luz)
  })
}

const PANO_DO_FORRO: MaterialDaPeca = { classe: 'tecido', rgb: [0x6c, 0x45, 0x47], fio: 'la' }
const POEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x9c, 0x88] }

/** O baú saqueado: o pano do forro amassado num canto, as duas moedas esquecidas no outro e a poeira. */
function vazio(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const t = PAREDE
  const [cx, cy] = [-hw + t + 0.22 * c.w, -hh + t + 0.3 * c.h]
  const contornoDoPano: Ponto[] = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2
    const r = 0.72 + 0.34 * hash(i, 1, 5700)
    return [cx + Math.cos(a) * 9 * r, cy + Math.sin(a) * 5.6 * r]
  })
  L.push(P(poligono(contornoDoPano), PANO_DO_FORRO, { tabua: 0, bisel: 1.8, tom: 0.9, contorno: 0.28, ruga: 2.4, projeta: { dist: 1, forca: 0.36 }, semente: 5701 }))
  L.push(P(capsula(cx - 4.5, cy + 0.6, cx + 3.8, cy - 1.4, 0.8), PANO_DO_FORRO, { tabua: 0, bisel: 0.7, tom: 0.66, contorno: 0, alfa: 0.8, semente: 5702 }))
  L.push(P(capsula(cx - 1.5, cy + 2.6, cx + 5.2, cy + 1.8, 0.6), PANO_DO_FORRO, { tabua: 0, bisel: 0.5, tom: 1.12, contorno: 0, alfa: 0.7, semente: 5703 }))
  const luz = paraALuz(c.giro)
  pintarMoedaDeOuro(P, cena, { x: hw - t - 6.5, y: hh - t - 4.6, r: 2.5, achatado: 1, ang: 0, tom: 0.98, detalhe: 'beira', projeta: 0.7, semente: 5710 }, luz)
  pintarMoedaDeOuro(P, cena, { x: hw - t - 11.2, y: hh - t - 3.2, r: 2.4, achatado: 0.72, ang: 2.2, tom: 0.92, detalhe: 'beira', projeta: 0.7, semente: 5712 }, luz)
  for (let i = 0; i < 9; i += 1) {
    const x = -hw + t + 2 + (c.w - 2 * t - 4) * hash(i, 1, 5720)
    const y = -hh + t + 2 + (c.h - 2 * t - 4) * hash(i, 2, 5720)
    L.push(P(elipse(x, y, 0.5 + 0.5 * hash(i, 3, 5720), 0.4), POEIRA, { bisel: 0, contorno: 0, alfa: 0.32, suave: 0.4, semente: 5721 + i }))
  }
}

// ---------- de cima: a tampa aberta, atrás do corpo ----------

/** A tampa aberta vista do alto: a face de fora em arco, as cintas, os rebites, as cantoneiras da ponta, o fecho e o gonzo. */
function tampaAberta(c: ContextoDoMovel, L: Peca[], fundura: number): void {
  const { hw, hh, w, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const [ya, yb] = [-hh - fundura, -hh]
  const arco = { c: (ya + yb) / 2, r: fundura * 0.62, forca: 0.5 }
  L.push(P(caixa(-hw, ya, hw, yb + 0.2, 1.6), mad, { eixo: 0, tabua: fundura / 3, bisel: 1.1, tom: 0.94, curvaY: arco, contorno: 0.28, semente: 5800 }))
  const m = CINTA.meiaLargura * w
  for (const sx of [-1, 1]) {
    const xc = sx * CINTA.meio * w
    L.push(P(caixa(xc - m, ya, xc + m, yb, 0.4), fer, { bisel: 0.8, curvaY: arco, contorno: 0.24, projeta: { dist: 0.7, forca: 0.25, suave: 0.7 }, semente: 5801 + sx }))
    for (const f of [0.28, 0.72]) L.push(P(elipse(xc, ya + fundura * f, 0.85, 0.85), fer, { bisel: 0.9, contorno: 0.1, tom: 0.9, semente: 5804 }))
    // O gonzo: o canudo na junta da tampa com a parede de trás.
    L.push(P(capsula(xc - m - 0.8, yb + 0.1, xc + m + 0.8, yb + 0.1, 1.05), fer, { eixo: 0, tabua: 0, bisel: 0.95, contorno: 0.26, tom: 0.98, semente: 5806 + sx }))
  }
  const cw = CANTONEIRA.deitada * w
  const ch = Math.min(fundura * 0.5, 6)
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    L.push(P(poligono([[xa, ya], [xa - sx * cw, ya], [xa, ya + ch]]), fer, { bisel: 0.7, curvaY: arco, contorno: 0.2, semente: 5810 + sx }))
  }
  const mf = FECHO.meiaLargura * w
  L.push(P(caixa(-mf, ya - 1.4, mf, ya + FECHO.comprido, 0.8), fer, { bisel: 0.9, contorno: 0.28, projeta: { dist: 0.8, forca: 0.3 }, semente: 5813 }))
  L.push(P(caixa(-0.7, ya - 0.9, 0.7, ya + 0.6, 0.3), BURACO, { bisel: 0, contorno: 0, tom: 0.85, semente: 5814 }))
}

// ---------- na 3/4: as faces de frente do corpo e da tampa ----------

/** A frente do corpo, desenhada de frente (y = 0 no chão, negativo para cima): as tábuas, a beira, as cintas, as cantoneiras e a chapa. */
function frenteDoCorpo(c: ContextoDoMovel, H: number): PecaDaFrente[] {
  const { hw, w } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const m = CINTA.meiaLargura * w
  const pecas: PecaDaFrente[] = [
    { forma: caixa(-hw, -H, hw, 0, 0.8), mat: mad, o: { eixo: 0, tabua: H / 3, bisel: 0.9, tom: 0.8, semente: 5900 } },
    { forma: caixa(-hw, -H, hw, -H + 1.3, 0.4), mat: mad, o: { eixo: 0, tabua: 0, bisel: 0.5, tom: 1.02, semente: 5901 } },
  ]
  for (const sx of [-1, 1]) {
    const xc = sx * CINTA.meio * w
    pecas.push({ forma: caixa(xc - m, -H, xc + m, 0, 0.4), mat: fer, o: { bisel: 0.8, contorno: 0.22, semente: 5902 } })
    for (const f of REBITES_DO_CORPO) pecas.push({ forma: elipse(xc, -H * f, 0.9, 0.9), mat: fer, o: { bisel: 0.9, contorno: 0.1, tom: 0.9 } })
  }
  const cw = CANTONEIRA.deitada * w
  const ch = CANTONEIRA.dePe * H * 1.6
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    pecas.push({ forma: poligono([[xa, 0], [xa - sx * cw, 0], [xa, -ch]]), mat: fer, o: { bisel: 0.7, contorno: 0.2 } })
    pecas.push({ forma: poligono([[xa, -H], [xa - sx * cw, -H], [xa, -H + ch]]), mat: fer, o: { bisel: 0.7, contorno: 0.2 } })
  }
  pecas.push({ forma: caixa(-2.6, -H + 0.4, 2.6, -H + 6.2, 0.7), mat: fer, o: { bisel: 0.8, contorno: 0.26, tom: 0.92, semente: 5903 } })
  pecas.push({ forma: uniao(elipse(0, -H + 2.8, 0.75, 0.75), capsula(0, -H + 2.8, 0, -H + 4.4, 0.36)), mat: BURACO, o: { bisel: 0, contorno: 0, semente: 5904 } })
  return pecas
}

/** A face de dentro da tampa aberta, de frente (o alto dela em `-alto`, o gonzo em `-corpo`): as tábuas, a beira e o fecho no alto. */
function dentroDaTampa(c: ContextoDoMovel, alto: number, corpo: number): PecaDaFrente[] {
  const { hw, w } = c
  const mad = c.m.madeira
  const mf = FECHO.meiaLargura * w
  return [
    { forma: caixa(-hw, -corpo, hw, 0, 0.6), mat: mad, o: { eixo: 0, tabua: 0, bisel: 0, tom: 0.5, semente: 5910 } },
    { forma: caixa(-hw, -alto, hw, -corpo + 0.6, 1.2), mat: mad, o: { eixo: 0, tabua: 6.5, bisel: 1, tom: 0.72, semente: 5911 } },
    { forma: caixa(-hw, -alto, hw, -alto + 1.8, 0.8), mat: mad, o: { eixo: 0, tabua: 0, bisel: 0.7, tom: 0.98, semente: 5912 } },
    { forma: caixa(-mf, -alto - 0.6, mf, -alto + FECHO.comprido, 0.8), mat: c.m.ferragens, o: { bisel: 0.9, contorno: 0.28, semente: 5913 } },
  ]
}

/** O corpo de uma face NA PEGADA: de `xa` a `xb`, do fundo `y0` à beira da frente `y1`, e o raio do canto da sombra. */
interface CorpoDaFace {
  readonly xa: number
  readonly xb: number
  readonly y0: number
  readonly y1: number
  readonly raio: number
}

/**
 * Guarda a face desenhada de frente debaixo do que fica por cima dela na vista de cima, em faixas, como o baú de
 * hoje guarda a frente (`guardarAFrente` de `../bau.ts`, com `fatiar` e `naFaixa` do guarda-roupa): a coluna até as
 * frestas, as duas beiradas de lado e a fresta de cada faixa, e as cópias da face. Vem antes das peças de cima na
 * lista, para elas a cobrirem de cima. (O `guardarFaceGirada` do guarda-roupa é para o objeto girado.)
 */
function guardarFace(P: CriarPeca, cena: Cena, H: number, corpo: CorpoDaFace, desenho: readonly PecaDaFrente[]): void {
  const { xa, xb, y0, y1, raio } = corpo
  const { faixas, frente } = fatiar(H, 0, 0, y1 - y0, y1)
  cena.sombras.push({ forma: caixa(xa, y0, xb, frente, raio), z: H })
  for (const x of [xa, xb - BEIRA_DA_FACE]) cena.sombras.push({ forma: caixa(x, frente, x + BEIRA_DA_FACE, y1), z: H })
  for (const fx of faixas) {
    if (fx.topo > fx.pe) cena.sombras.push({ forma: caixa(xa + BEIRA_DA_FACE, fx.base, xb - BEIRA_DA_FACE, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  }
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(P, peca, fx)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

// ---------- de lado ----------

/** De Lado: o corpo com a cinta e a alça, e a tampa em arco virada para trás no gonzo (o canto de cima à direita). */
function montarAbertoDeLado(c: ContextoDoMovel, cena: Cena, conteudo: Conteudo): void {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const L = cena.partes
  const costura = -hh + h * 0.4
  const raio = costura + hh
  const corpo = caixa(-hw, costura, hw, hh, 0.6)
  const giro = (x: number, y: number): Ponto => {
    const [dx, dy] = [x - hw, y - costura]
    return [hw + dx * Math.cos(ABERTURA) - dy * Math.sin(ABERTURA), costura + dx * Math.sin(ABERTURA) + dy * Math.cos(ABERTURA)]
  }
  const arco = (rx: number, ry: number): Ponto[] => Array.from({ length: 25 }, (_, i) => giro(rx * Math.cos((Math.PI * i) / 24), costura - ry * Math.sin((Math.PI * i) / 24)))
  const tampa = poligono(arco(hw, raio))
  const cinta = poligono([...arco(hw, raio), ...arco(hw - 2.4, raio - 2.4).reverse()])
  sombraDeLado(cena, uniao(corpo, tampa), 12)
  L.push(P(tampa, mad, { tabua: raio / 2, eixo: ABERTURA, bisel: 1, tom: 0.9, semente: 5950 }))
  L.push(P(cinta, fer, { bisel: 0.8, contorno: 0.25, semente: 5951 }))
  if (conteudo === 'tesouro') {
    const monte = poligono(Array.from({ length: 13 }, (_, i): Ponto => [-hw + 2.5 + ((c.w - 5) * i) / 12, costura + 0.4 - 4.2 * Math.sin((Math.PI * i) / 12) * (0.8 + 0.25 * hash(i, 1, 5952))]))
    L.push(P(monte, MASSA_DO_OURO, { tabua: 0, bisel: 1.2, tom: 1, contorno: 0.2, semente: 5953 }))
    for (let i = 0; i < 6; i += 1) {
      const x = -hw + 6 + ((c.w - 12) * (i + 0.5)) / 6
      L.push(P(elipse(x, costura - 1.2 - 2.2 * Math.sin((Math.PI * (i + 0.5)) / 6), 1.9, 0.75), OURO, { tabua: 0, bisel: 0.5, metal: 0.55, tom: 1.05, contorno: 0.2, semente: 5954 + i }))
    }
  }
  L.push(P(corpo, mad, { tabua: (hh - costura) / 3, bisel: 0.9, semente: 5960 }))
  L.push(P(caixa(-hw, costura - 0.4, hw, costura + 1.6, 0.3), fer, { bisel: 0.6, tom: 0.92, semente: 5961 }))
  const ya = costura + (hh - costura) * 0.5
  L.push(P(caixa(-3.4, ya - 3.4, 3.4, ya - 1.6, 0.5), fer, { bisel: 0.6, semente: 5962 }))
  L.push(P(anel(0, ya + 0.2, 3.1, 3.1, 1.9, 1.9), fer, { bisel: 0.6, projeta: { dist: 0.8, forca: 0.3 }, semente: 5963 }))
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    L.push(P(poligono([[xa, hh], [xa - sx * 5, hh], [xa, hh - 5]]), fer, { bisel: 0.6, semente: 5964 }))
  }
}

// ---------- o baú aberto ----------

function montarAberto(conteudo: Conteudo): MontarMovel {
  return (c, cena) => {
    if (c.lado === 'lado') {
      montarAbertoDeLado(c, cena, conteudo)
      return
    }
    const { hw, hh, peca: P } = c
    const { fundura, alto, corpo } = faixaDaTampa(c)
    const caixaDoCorpo = caixa(-hw, -hh, hw, hh, 2)
    const caixaDaTampa = caixa(-hw, -hh - fundura, hw, -hh, 1.6)
    cena.sombras.push(contato(caixaDoCorpo))
    // Sem giro, a frente do corpo e a face de dentro da tampa são desenhadas e guardadas debaixo delas; girado, a
    // 3/4 varre a madeira das duas (as colunas, só).
    if (quartosDeVolta(c.giro) === 0) {
      guardarFace(P, cena, alto, { xa: -hw, xb: hw, y0: -hh - fundura, y1: -hh, raio: 1.6 }, dentroDaTampa(c, alto, corpo))
      guardarFace(P, cena, corpo, { xa: -hw, xb: hw, y0: -hh, y1: hh, raio: 2 }, frenteDoCorpo(c, corpo))
    } else {
      cena.sombras.push({ forma: caixaDaTampa, z: alto }, { forma: caixaDoCorpo, z: corpo })
    }
    const L = cena.partes
    tampaAberta(c, L, fundura)
    fundo(c, L)
    if (conteudo === 'tesouro') tesouro(c, cena)
    else vazio(c, cena)
    paredes(c, L)
    ferragensDaBeira(c, L)
    if (conteudo === 'tesouro') moedasNaBeira(c, cena)
  }
}

/** Para a ordem do painel: `comTesouro` -> "Aberto com tesouro", `vazio` -> "Aberto vazio" (a 1ª, Fechado, é a de hoje). */
export const versoesDoBau: VersoesDesenhadas = {
  comTesouro: montarAberto('tesouro'),
  vazio: montarAberto('vazio'),
}

