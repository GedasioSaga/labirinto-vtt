/**
 * CASINHA DE CACHORRO (L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e
 * fazenda): a casinha de tábuas do quintal, de telhado de duas águas com a cumeeira para o fundo e a porta em arco na
 * empena da frente. Duas versões:
 *
 * - VAZIA (a 1ª): a casinha, com a palha de forrar aparecendo no pé da porta e a terra gasta na frente dela, onde o
 *   cachorro deita.
 * - COM TIGELA: a mesma, com a tigela de lata na frente, à direita da porta, cheia de ração.
 *
 * É desenhada DE PÉ, como se vê na 3/4 (perfil `EM_PE` de `tresQuartos.ts`, o da barraca e da lápide): as duas águas
 * do telhado vistas de cima e de frente (a da esquerda na luz, a da direita na sombra), a empena da frente com as
 * tábuas de pé e a porta, e as testeiras do beiral por cima da empena. Vista só de cima, a casinha seria um telhado
 * de duas águas igual ao de um galpão: é a porta em arco que diz "cachorro".
 *
 * As contas saem de um desenho em 3D simples, posto na tela com a altura subindo (x, y - z): a casinha ocupa o fundo
 * da pegada, e a frente fica livre para a tigela. Materiais: `madeira` (as paredes e a moldura da porta) e
 * `telhado` (as tábuas do telhado, a cumeeira e as testeiras). A palha, a terra, a lata e a ração são fixas.
 * Pegada: 1 x 1 casa.
 */
import { caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { hash } from '../../ruido'

/** A casinha em px do protótipo (a casa de 56): meia largura, o plano da frente e o do fundo, e as alturas. */
const MEIA_LARGURA = 16
const FRENTE = 7
const FUNDO = -7
const ALTURA_DA_PAREDE = 11
const ALTURA_DA_CUMEEIRA = 19
/** O beiral: quanto o telhado passa das paredes dos lados e da frente e do fundo (px). */
const BEIRAL_DO_LADO = 3
const BEIRAL_DA_FRENTE = 2
/** A porta em arco: a meia largura e onde começa o arco (px, na tela). */
const MEIA_PORTA = 5.4
const PE_DO_ARCO = -1.4
/** Os tons: a água da esquerda pega a luz, a da direita fica na sombra; a empena olha para a frente. */
const TOM_DA_AGUA_NA_LUZ = 1.04
const TOM_DA_AGUA_NA_SOMBRA = 0.78
const TOM_DA_EMPENA = 0.86
/** A tábua do telhado e a da parede (px). */
const TABUA_DO_TELHADO = 4.2
const TABUA_DA_PAREDE = 4.6

const DENTRO: MaterialDaPeca = { classe: 'liso', rgb: [0x36, 0x2c, 0x26] }
const PALHA: MaterialDaPeca = { classe: 'palha', rgb: [0xb4, 0x9d, 0x6b] }
const TERRA_GASTA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x4b, 0x3a] }
const LATA: MaterialDaPeca = { classe: 'metal', rgb: [0x8a, 0x93, 0x98] }
const RACAO: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x62, 0x44] }

/** O ponto 3D (x, y no chão, z para cima) na tela. */
function naTela(x: number, y: number, z: number): Ponto {
  return [x, y - z]
}

/** A altura do telhado em x (a água desce da cumeeira até a parede e continua no beiral). */
function alturaDoTelhado(x: number): number {
  return ALTURA_DA_CUMEEIRA - (Math.abs(x) / MEIA_LARGURA) * (ALTURA_DA_CUMEEIRA - ALTURA_DA_PAREDE)
}

/** A borda mole (a terra gasta): a distância ganha um ruído largo. */
function borrada(f: Forma, amplitude: number, semente: number): Forma {
  return { b: [f.b[0] - amplitude, f.b[1] - amplitude, f.b[2] + amplitude, f.b[3] + amplitude], d: (x, y) => f.d(x, y) - ruido(x * 0.3 + semente, y * 0.3) * 2 * amplitude }
}

/** A ração: grãos redondos, cada um com o seu claro e o seu escuro. */
const texDaRacao: Textura = (_u, _v, x, y, _p, s) => {
  const gx = Math.floor(x * 1.1)
  const gy = Math.floor(y * 1.4)
  const fx = x * 1.1 - gx - 0.5
  const fy = y * 1.4 - gy - 0.5
  const dentroDoGrao = fx * fx + fy * fy < 0.16
  s[3] += dentroDoGrao ? (0.12 - (fx + fy) * 0.25) * (0.7 + 0.6 * hash(gx, gy, 913)) : -0.16
}

function montarCasinha(c: ContextoDoMovel, cena: Cena): void {
  const P = c.peca
  const mad = c.m.madeira
  const tel = c.m.telhado
  const W = MEIA_LARGURA
  const eave = W + BEIRAL_DO_LADO
  const frenteDoTelhado = FRENTE + BEIRAL_DA_FRENTE
  const fundoDoTelhado = FUNDO - BEIRAL_DA_FRENTE

  // A terra gasta na frente da porta, por baixo de tudo, e a sombra da casinha (a base arrastada até a cumeeira).
  cena.partes.push(P(borrada(elipse(0.6, FRENTE + 4.6, 10.5, 3.6), 1.2, 5), TERRA_GASTA, { bisel: 2, contorno: 0, alfa: 0.42, semente: 70 }))
  const base = caixa(-W, FUNDO, W, FRENTE, 0.8)
  cena.sombras.push({ forma: base, z: c.g * 0.34 }, contato(caixa(-W - 0.5, FRENTE - 3.2, W + 0.5, FRENTE + 0.8, 1), 0.36))

  // As duas águas do telhado, do fundo para a frente: cada uma um quadrilátero da cumeeira ao beiral.
  for (const lado of [-1, 1] as const) {
    const agua = poligono([
      naTela(0, frenteDoTelhado, ALTURA_DA_CUMEEIRA),
      naTela(lado * eave, frenteDoTelhado, alturaDoTelhado(eave)),
      naTela(lado * eave, fundoDoTelhado, alturaDoTelhado(eave)),
      naTela(0, fundoDoTelhado, ALTURA_DA_CUMEEIRA),
    ])
    const [ex, ey] = naTela(lado * eave, 0, alturaDoTelhado(eave))
    const [cx, cy] = naTela(0, 0, ALTURA_DA_CUMEEIRA)
    cena.partes.push(P(agua, tel, { eixo: Math.atan2(ey - cy, ex - cx), tabua: TABUA_DO_TELHADO, bisel: 0.9, tom: lado < 0 ? TOM_DA_AGUA_NA_LUZ : TOM_DA_AGUA_NA_SOMBRA, contorno: 0.3, semente: 10 + (lado + 1) }))
  }
  // A cumeeira: a tábua dobrada em cima, do fundo à frente.
  const [rx0, ry0] = naTela(0, fundoDoTelhado, ALTURA_DA_CUMEEIRA)
  const [rx1, ry1] = naTela(0, frenteDoTelhado, ALTURA_DA_CUMEEIRA)
  cena.partes.push(P(capsula(rx0, ry0 + 0.6, rx1, ry1 - 0.4, 1.5), tel, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.92, contorno: 0.3, semente: 14 }))

  // A empena da frente: o retângulo da parede e o triângulo até a cumeeira, as tábuas de pé.
  const empena = poligono([
    naTela(-W, FRENTE, 0),
    naTela(W, FRENTE, 0),
    naTela(W, FRENTE, ALTURA_DA_PAREDE),
    naTela(0, FRENTE, ALTURA_DA_CUMEEIRA),
    naTela(-W, FRENTE, ALTURA_DA_PAREDE),
  ])
  cena.partes.push(P(empena, mad, { eixo: QUARTO, tabua: TABUA_DA_PAREDE, bisel: 0.7, tom: TOM_DA_EMPENA, contorno: 0.3, semente: 20 }))
  // A porta em arco: o escuro de dentro, a palha no pé e a moldura.
  const porta = uniao(caixa(-MEIA_PORTA, PE_DO_ARCO, MEIA_PORTA, FRENTE - 0.2), elipse(0, PE_DO_ARCO, MEIA_PORTA, MEIA_PORTA))
  const moldura = menos(uniao(caixa(-MEIA_PORTA - 1.3, PE_DO_ARCO, MEIA_PORTA + 1.3, FRENTE - 0.2), elipse(0, PE_DO_ARCO, MEIA_PORTA + 1.3, MEIA_PORTA + 1.3)), porta)
  cena.partes.push(P(porta, DENTRO, { bisel: 0.4, contorno: 0.3, recesso: { k: 2.6, forca: 0.4 }, semente: 21 }))
  cena.partes.push(P(caixa(-MEIA_PORTA + 0.4, FRENTE - 2.6, MEIA_PORTA - 0.4, FRENTE - 0.3, 0.8), PALHA, { eixo: 0, bisel: 0.6, tom: 0.78, contorno: 0.2, semente: 22 }))
  for (let k = 0; k < 4; k += 1) {
    const x = -MEIA_PORTA + 1.2 + k * 2.9 + hash(k, 1, 914) * 0.8
    cena.partes.push(P(capsula(x, FRENTE - 2.4, x + 1.6 - hash(k, 2, 914) * 3.2, FRENTE - 3.6 - hash(k, 3, 914), 0.32), PALHA, { bisel: 0.3, tom: 0.92, contorno: 0.2, semente: 23 + k }))
  }
  cena.partes.push(P(moldura, mad, { tabua: 0, bisel: 0.6, tom: 1.06, contorno: 0.3, semente: 28 }))
  // As testeiras do beiral, por cima da empena: duas tábuas da cumeeira até o canto do beiral.
  for (const lado of [-1, 1] as const) {
    const [ax, ay] = naTela(0, frenteDoTelhado, ALTURA_DA_CUMEEIRA)
    const [bx, by] = naTela(lado * eave, frenteDoTelhado, alturaDoTelhado(eave))
    cena.partes.push(P(capsula(ax, ay + 0.2, bx, by, 1.35), tel, { eixo: Math.atan2(by - ay, bx - ax), tabua: 0, bisel: 0.9, tom: lado < 0 ? 0.98 : 0.84, contorno: 0.32, semente: 30 + (lado + 1) }))
  }
}

/** A casinha vazia: só ela, a palha na porta e a terra gasta. */
export const montarCasinhaDeCachorro: MontarMovel = (c, cena) => {
  montarCasinha(c, cena)
}

/** A casinha com a tigela de lata cheia de ração, na frente, à direita da porta. */
export const montarCasinhaDeCachorroComTigela: MontarMovel = (c, cena) => {
  montarCasinha(c, cena)
  const P = c.peca
  const x = 11.5
  const y = FRENTE + 8
  const rx = 4.8
  const ry = 2.9
  const fundo = 1.9
  cena.sombras.push(contato(elipse(x + 0.4, y + fundo * 0.6, rx + 0.4, ry * 0.9), 0.34), { forma: elipse(x, y + fundo, rx, ry), z: c.g * 0.05, forca: 0.22 })
  // O corpo da tigela (a borda arrastada para baixo: a lata de lado), a borda e a ração dentro.
  cena.partes.push(P(uniao(caixa(x - rx, y, x + rx, y + fundo), elipse(x, y + fundo, rx * 0.92, ry * 0.86)), LATA, { eixo: QUARTO, bisel: 0.8, tom: 0.74, contorno: 0.3, metal: 0.5, semente: 40 }))
  cena.partes.push(P(elipse(x, y, rx, ry), LATA, { bisel: 0.7, tom: 1.02, contorno: 0.3, metal: 0.5, semente: 41 }))
  cena.partes.push(P(elipse(x, y + 0.15, rx - 1, ry - 0.8), RACAO, { bisel: 0.6, contorno: 0.2, recesso: { k: 0.9, forca: 0.24 }, textura: texDaRacao, semente: 42 }))
}
