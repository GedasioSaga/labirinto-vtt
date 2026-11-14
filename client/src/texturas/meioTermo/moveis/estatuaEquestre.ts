/**
 * ESTÁTUA EQUESTRE de praça de cima com volume (construção do lote L15,
 * 14/11/2026, grupo Monumentos e colunas): o PEDESTAL comprido de pedra no
 * soco, e em cima o CAVALO de bronze a passo, virado para a direita (a cabeça
 * baixa, a crina, o rabo), com o CAVALEIRO de capa e elmo de penacho e a ESPADA
 * apontada para a frente. O bronze tem a pátina verde do tempo nas dobras.
 * Ninguém de verdade, nenhum brasão.
 *
 * De cima: o lombo comprido do cavalo, o pescoço com a crina, a cabeça e as
 * orelhas, o rabo, as botas do cavaleiro dos dois lados, a capa aberta para
 * trás, o elmo e a espada; a sombra da estátua pintada no tampo do pedestal.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado com a beirada
 * `ESPESSURA_DA_FATIA_DA_ESTATUA`, a de uma fatia):
 * - as quatro PERNAS são colunas do chão; o pedestal vai em três faixas (a do
 *   fundo, antes das pernas de trás; a do meio, entre as de trás e as da frente;
 *   a da frente, por último) e o soco em duas: cada faixa cobre o pé das pernas
 *   que ficam atrás dela;
 * - o corpo, o pescoço, o rabo, o tronco do cavaleiro, a capa e as pernas dele
 *   são pilhas de FATIAS (tampos soltos finos), de baixo para cima: o corpo
 *   estreita embaixo e em cima (fica roliço), o pescoço anda para a frente a
 *   cada fatia (sobe inclinado), a perna do cavaleiro desce do lombo. A frente
 *   de cada fatia sai de bronze pela PEÇA DE REFERÊNCIA (um ponto invisível
 *   com a maior caixa do móvel: a fatia sem peça pega o material dela);
 * - a CABEÇA do cavalo, o ELMO e a ESPADA são peças levantadas por PINOS: a
 *   cabeça é desenhada de perfil na planta (a boca para baixo), e na 3/4 o
 *   perfil fica de pé. O fio da frente do pino some no bronze;
 * - a ordem de pintura é dada à mão (`emOrdem`).
 *
 * Planta em fração da pegada (2 x 1 casas de partida: o cavalo ao comprido),
 * alturas em casas do menor lado (o meio do comprido). Material: `pedra`; o
 * bronze e a pátina são fixos.
 */
import { caixa, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { arrastada, colunaSemSombra, comMeioEm, crescida, emOrdem, pino, solta, texturaComSombra, type QueFazSombra } from './andaimeDaTresQuartos'

/** A espessura de uma fatia (casas e px do protótipo): a beirada de todo tampo solto da estátua. O perfil usa. */
const FATIA_EM_CASAS = 0.12
export const ESPESSURA_DA_FATIA_DA_ESTATUA = FATIA_EM_CASAS * G
/**
 * As pilhas de fatias, de baixo para cima, em casas: [x do meio, meio comprimento, meia largura, alto acima do
 * pedestal]. O corpo roliço, o pescoço subindo para a frente e o tronco do cavaleiro.
 */
type Fatia = readonly [number, number, number, number]
// A barriga mais estreita embaixo; as duas de cima iguais (a de cima cobre o tampo da do meio: sem degrau no lombo).
const FATIAS_DO_CORPO: readonly Fatia[] = [[0, 0.4, 0.12, 0.5], [0, 0.5, 0.165, 0.62], [0, 0.5, 0.165, 0.72]]
const FATIAS_DO_PESCOCO: readonly Fatia[] = [[0.45, 0.12, 0.1, 0.8], [0.5, 0.11, 0.095, 0.9], [0.55, 0.1, 0.09, 1.0]]
const FATIAS_DO_TRONCO: readonly Fatia[] = [[-0.02, 0.1, 0.12, 0.86], [-0.02, 0.1, 0.125, 0.98], [-0.02, 0.09, 0.115, 1.07]]
/** A perna do cavaleiro do lado da frente (a coxa e a canela com a bota), descendo do lombo: [x0, x1, alto]. */
const PERNA_DO_CAVALEIRO: readonly (readonly [number, number, number])[] = [[-0.04, 0.12, 0.74], [0.04, 0.12, 0.62], [0.06, 0.15, 0.5]]
/** A capa caída sobre a garupa: uma fatia só, logo acima do lombo (alta, ela virava um encosto de cadeira). */
const ALTOS_DA_CAPA = [0.8]

/** O soco e o pedestal, em fração da meia pegada; as alturas em casas. */
const SOCO = { x: 0.98, y: 0.98 }
const PEDESTAL = { x: 0.86, y: 0.76 }
const ALTURA_DO_SOCO = 0.1
const ALTURA_DO_PEDESTAL = 0.72
/**
 * O cavalo em casas, com o meio do pedestal na origem e a frente para +x: as pernas (x, y, raio), o alto delas
 * (acima do pedestal), o corpo, o pescoço, o rabo, a cabeça de perfil e as alturas do lombo, do pescoço e da nuca.
 */
const PERNAS: readonly (readonly [number, number])[] = [[-0.46, -0.1], [0.44, -0.1], [-0.42, 0.1], [0.48, 0.1]]
const RAIO_DA_PERNA = 0.05
const ALTO_DAS_PERNAS = 0.4
const CORPO = { rx: 0.5, ry: 0.165 }
const ALTO_DO_LOMBO = 0.72
/** Um x do lombo fora do cavaleiro e do pescoço (casas): o meio da caixa do corpo e da sela, para subirem com o corpo. */
const LOMBO_LIVRE = 0.18
const PESCOCO = { de: [0.36, 0] as Ponto, ate: [0.6, 0] as Ponto, r: 0.1 }
const ALTO_DO_PESCOCO = 1.0
const RABO = { de: [-0.5, 0] as Ponto, ate: [-0.66, 0.03] as Ponto, r: 0.045 }
const ALTO_DO_RABO = 0.66
const NUCA: Ponto = [0.62, -0.06]
const FOCINHO: Ponto = [0.84, 0.12]
const ALTO_DA_NUCA = 1.1
/** O cavaleiro em casas: o tronco, as pernas (botas) dos lados, a capa, o elmo, a espada e as alturas. */
const TRONCO = { x: -0.02, rx: 0.1, ry: 0.125 }
const ALTO_DOS_OMBROS = 1.07
const BOTA = { x: 0.04, y: 0.205, rx: 0.08, ry: 0.035 }
const CAPA: readonly Ponto[] = [[-0.06, -0.15], [-0.32, -0.21], [-0.36, 0], [-0.32, 0.21], [-0.06, 0.15]]
const ELMO = { r: 0.07, penacho: 0.05 }
const ALTO_DO_ELMO = 1.24
const ESPADA = { mao: [0.1, 0.13] as Ponto, ponta: [0.56, 0.02] as Ponto }
const ALTO_DA_ESPADA = 0.98
/** A sombra no chão e a pintada no tampo do pedestal. */
const FORCA_DA_SOMBRA = 0.32
const BORDA_DA_SOMBRA = 2.2
const BORDA_DA_SOMBRA_PINTADA = 1.5
const FORCA_DA_SOMBRA_PINTADA = 0.3
/** A pátina: o verde, o tamanho das manchas (px) e quanto ela toma do bronze. */
const VERDE_DA_PATINA: readonly [number, number, number] = [0x6c, 0x8c, 0x78]
const TAMANHO_DA_PATINA = 5
const FORCA_DA_PATINA = 0.55

const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: [0x6e, 0x60, 0x48] }
const DA_PEDRA = texturaDaClasse('pedra')
const DO_METAL = texturaDaClasse('metal')

/** O bronze com a pátina verde em manchas (mais nas dobras, onde a chuva escorre). */
const texPatina: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  const n = ruido(x / TAMANHO_DA_PATINA + 31, y / TAMANHO_DA_PATINA) + 0.5 * ruido(x / 2, y / 2 + 17)
  const t = Math.min(1, Math.max(0, (n + 0.05) * 2.4)) * FORCA_DA_PATINA
  if (t <= 0) return
  s[0] += (VERDE_DA_PATINA[0] - s[0]) * t
  s[1] += (VERDE_DA_PATINA[1] - s[1]) * t
  s[2] += (VERDE_DA_PATINA[2] - s[2]) * t
}

export const montarEstatuaEquestre: MontarMovel = (c, cena) => {
  const P = c.peca
  const { hw, hh } = c
  const k = Math.min(hw, c.h)
  const q = (v: number): number => v * k
  const pt = ([x, y]: Ponto): Ponto => [q(x), q(y)]
  const pedra = c.m.pedra
  const L = cena.partes
  const S = cena.sombras
  const bronze = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1.6, contorno: 0.3, metal: 0.45, textura: texPatina, semente, ...mais })
  const [sx, sy, ex, ey] = [SOCO.x * hw, SOCO.y * hh, PEDESTAL.x * hw, PEDESTAL.y * hh]
  const [zSoco, zp] = [q(ALTURA_DO_SOCO), q(ALTURA_DO_PEDESTAL)]
  const acima = (v: number): number => zp + q(v)
  const rp = q(RAIO_DA_PERNA)
  const pernas = PERNAS.map(([x, y]) => elipse(q(x), q(y), rp, rp))
  const corpo = elipse(0, 0, q(CORPO.rx), q(CORPO.ry))
  const pescoco = capsula(q(PESCOCO.de[0]), q(PESCOCO.de[1]), q(PESCOCO.ate[0]), q(PESCOCO.ate[1]), q(PESCOCO.r))
  const rabo = capsula(q(RABO.de[0]), q(RABO.de[1]), q(RABO.ate[0]), q(RABO.ate[1]), q(RABO.r))
  const tronco = elipse(q(TRONCO.x), 0, q(TRONCO.rx), q(TRONCO.ry))
  const botas = [-1, 1].map((s) => elipse(q(BOTA.x), s * q(BOTA.y), q(BOTA.rx), q(BOTA.ry)))
  const capa = poligono(CAPA.map(pt))
  // As faixas do pedestal: até o pé das pernas de trás, até o pé das da frente, e a da frente.
  const [corteDeTras, corteDaFrente] = [q(PERNAS[0][1]) + rp, q(PERNAS[2][1]) + rp]

  // ---------- as sombras no chão (só a vista de cima as vê) ----------
  S.push(contato(caixa(-sx, -sy, sx, sy), 0.36))
  S.push({ forma: arrastada(caixa(-ex, -ey, ex, ey), zp), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  for (const [forma, alto] of [[corpo, ALTO_DO_LOMBO], [pescoco, ALTO_DO_PESCOCO], [tronco, ALTO_DOS_OMBROS]] as const) {
    S.push({ forma: arrastada(forma, acima(alto)), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  }

  // ---------- as estruturas da 3/4, na ordem de pintura ----------
  const zCorpo = acima(ALTO_DO_LOMBO)
  const pinoDaCabeca = pino(q(NUCA[0] + 0.1), q(NUCA[1] + 0.06))
  const pinoDoElmo = pino(q(TRONCO.x), q(0.01))
  const pinoDaEspada = pino(q((ESPADA.mao[0] + ESPADA.ponta[0]) / 2), q((ESPADA.mao[1] + ESPADA.ponta[1]) / 2))
  const fatias = (lista: readonly Fatia[]): (readonly [Forma, number, boolean])[] =>
    lista.map(([x, rx, ry, alto]) => [elipse(q(x), 0, q(rx), q(ry)), acima(alto), false] as const)
  const estruturas: readonly (readonly [Forma, number, boolean])[] = [
    [caixa(-sx, -sy, sx, ey), zSoco, true],
    [caixa(-ex, -ey, ex, corteDeTras), zp, true],
    [pernas[0], acima(ALTO_DAS_PERNAS), true],
    [pernas[1], acima(ALTO_DAS_PERNAS), true],
    [caixa(-ex, corteDeTras, ex, corteDaFrente), zp, true],
    [pernas[2], acima(ALTO_DAS_PERNAS), true],
    [pernas[3], acima(ALTO_DAS_PERNAS), true],
    [rabo, acima(ALTO_DO_RABO), false],
    [botas[0], zCorpo, false],
    ...fatias(FATIAS_DO_CORPO),
    ...fatias(FATIAS_DO_PESCOCO),
    [pinoDaCabeca, acima(ALTO_DA_NUCA), false],
    ...ALTOS_DA_CAPA.map((alto) => [capa, acima(alto), false] as const),
    ...fatias(FATIAS_DO_TRONCO),
    ...PERNA_DO_CAVALEIRO.map(([x0, x1, alto]) => [capsula(q(x0), q(BOTA.y), q(x1), q(BOTA.y), q(BOTA.ry) * 1.15), acima(alto), false] as const),
    [pinoDoElmo, acima(ALTO_DO_ELMO), false],
    [pinoDaEspada, acima(ALTO_DA_ESPADA), false],
    [caixa(-ex, corteDaFrente, ex, ey), zp, true],
    [caixa(-sx, ey, sx, sy), zSoco, true],
  ]
  const naOrdem = emOrdem(
    estruturas.map(([forma]) => forma),
    hh + 1,
  )
  estruturas.forEach(([, z, coluna], i) => S.push(coluna ? colunaSemSombra(naOrdem[i], z) : solta(naOrdem[i], z)))

  // ---------- o soco e o pedestal, com a sombra da estátua pintada no tampo ----------
  const sobreOTampo = (alto: number): number => q(alto)
  const sombrasNoTampo: QueFazSombra[] = [
    ...pernas.map((forma) => ({ forma, de: 0, ate: sobreOTampo(ALTO_DAS_PERNAS) })),
    { forma: corpo, de: sobreOTampo(ALTO_DAS_PERNAS), ate: sobreOTampo(ALTO_DO_LOMBO) },
    { forma: pescoco, de: sobreOTampo(ALTO_DO_LOMBO), ate: sobreOTampo(ALTO_DO_PESCOCO) },
    { forma: rabo, de: sobreOTampo(ALTO_DO_RABO - FATIA_EM_CASAS), ate: sobreOTampo(ALTO_DO_RABO) },
    { forma: tronco, de: sobreOTampo(ALTO_DO_LOMBO), ate: sobreOTampo(ALTO_DOS_OMBROS) },
    { forma: elipse(q(TRONCO.x), 0, q(ELMO.r), q(ELMO.r)), de: sobreOTampo(ALTO_DOS_OMBROS), ate: sobreOTampo(ALTO_DO_ELMO) },
  ]
  const tampo = texturaComSombra(DA_PEDRA, sombrasNoTampo, BORDA_DA_SOMBRA_PINTADA, FORCA_DA_SOMBRA_PINTADA)
  const daPedra = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1.4, contorno: 0.28, semente, ...mais })
  L.push(P(comMeioEm(caixa(-sx, -sy, sx, ey, 1), 0, -(sy + ey) / 2), pedra, daPedra(18400, { tom: 0.84 })))
  L.push(P(comMeioEm(caixa(-sx, ey, sx, sy, 1), 0, (sy + ey) / 2), pedra, daPedra(18401, { tom: 0.84 })))
  const faixas: readonly (readonly [number, number])[] = [[-ey, corteDeTras], [corteDeTras, corteDaFrente], [corteDaFrente, ey]]
  faixas.forEach(([y0, y1], i) => {
    // O meio de cada faixa na ponta de trás do pedestal, longe do cavalo (o mais alto, que levaria a peça).
    L.push(P(comMeioEm(caixa(-ex, y0, ex, y1, i === 1 ? 0 : 1.2), -ex + 2, (y0 + y1) / 2), pedra, daPedra(18402 + i, { bisel: 1.6, tom: 1, textura: tampo })))
  })

  // ---------- o cavalo: o rabo, as botas de baixo, o corpo, o pescoço com a crina e a cabeça de perfil ----------
  // A peça de referência: um ponto invisível no lombo com a maior caixa do móvel (a frente das fatias sai de bronze).
  L.push(P(crescida(elipse(q(LOMBO_LIVRE), 0, 0.2, 0.2), hw), BRONZE, { bisel: 0, contorno: 0, alfa: 0, semente: 18409 }))
  L.push(P(rabo, BRONZE, bronze(18410, { tom: 0.82, eixo: 0 })))
  for (let i = 0; i < 3; i += 1) {
    const dy = (i - 1) * q(0.022)
    L.push(P(capsula(q(RABO.de[0] - 0.02), q(RABO.de[1]) + dy, q(RABO.ate[0]), q(RABO.ate[1]) + dy * 1.6, 0.5), BRONZE, { bisel: 0, contorno: 0, tom: 0.62, semente: 18411 + i }))
  }
  L.push(P(botas[0], BRONZE, bronze(18414, { tom: 0.86 })))
  // Um pingo de bronze em cada perna, fora do corpo: a frente da perna sai de bronze.
  PERNAS.forEach(([x, y], i) => {
    const [px, py] = [q(x) + Math.sign(x) * rp * 0.6, q(y) + Math.sign(y) * rp * 0.6]
    L.push(P(elipse(px, py, 0.25, 0.25), BRONZE, { bisel: 0, contorno: 0, semente: 18415 + i }))
  })
  // O corpo e a sela sobem com o corpo: o meio da caixa entre o cavaleiro e o pescoço (o cavaleiro é mais alto).
  const noLombo: Ponto = [q(LOMBO_LIVRE), 0]
  L.push(P(comMeioEm(corpo, noLombo[0], noLombo[1]), BRONZE, bronze(18420, { bisel: q(CORPO.ry) * 0.7 })))
  L.push(P(comMeioEm(elipse(q(TRONCO.x - 0.02), 0, q(0.17), q(0.155)), noLombo[0], noLombo[1]), BRONZE, bronze(18421, { tom: 0.8, bisel: 1.2 })))
  L.push(P(pescoco, BRONZE, bronze(18422, { bisel: q(PESCOCO.r) * 0.7 })))
  // A crina: a crista do pescoço, mais escura, em mechas.
  for (let i = 0; i < 5; i += 1) {
    const x = q(PESCOCO.de[0] + 0.02 + i * 0.05)
    L.push(P(elipseGirada(x, -q(0.01), q(0.035), q(0.016), -0.5), BRONZE, { bisel: 0.6, contorno: 0.26, tom: 0.66, textura: texPatina, semente: 18423 + i }))
  }
  // A cabeça de perfil (a nuca, a cara descendo até o focinho, as orelhas em pé): sobe com o pino dela.
  const [nx, ny] = pt(NUCA)
  const [fx, fy] = pt(FOCINHO)
  const cabeca = uniao(uniao(capsula(nx, ny, fx, fy, q(0.055)), elipse(fx, fy + q(0.005), q(0.05), q(0.042))), elipse(nx + q(0.02), ny + q(0.02), q(0.065), q(0.06)))
  const pinoNaCabeca: Ponto = [q(NUCA[0] + 0.1), q(NUCA[1] + 0.06)]
  L.push(P(comMeioEm(cabeca, pinoNaCabeca[0], pinoNaCabeca[1]), BRONZE, bronze(18430, { bisel: q(0.04) })))
  for (const [dx, sem] of [[-0.035, 18431], [0.01, 18432]] as const) {
    const orelha = poligono([[nx + q(dx), ny - q(0.02)], [nx + q(dx + 0.012), ny - q(0.1)], [nx + q(dx + 0.035), ny - q(0.02)]])
    L.push(P(comMeioEm(orelha, pinoNaCabeca[0], pinoNaCabeca[1]), BRONZE, bronze(sem, { bisel: 0.6, tom: 0.9 })))
  }
  L.push(P(comMeioEm(elipse(nx + q(0.07), ny + q(0.035), 0.9, 0.9), pinoNaCabeca[0], pinoNaCabeca[1]), BRONZE, { bisel: 0, contorno: 0.3, tom: 0.45, semente: 18433 }))

  // ---------- o cavaleiro: a capa, o tronco com os braços, a bota da frente, a espada e o elmo ----------
  L.push(P(capa, BRONZE, bronze(18440, { tom: 0.72, bisel: 1.4 })))
  L.push(P(tronco, BRONZE, bronze(18441, { bisel: q(TRONCO.rx) * 0.7, tom: 1.06 })))
  const [mx, my] = pt(ESPADA.mao)
  const pinoNaEspada: Ponto = [q((ESPADA.mao[0] + ESPADA.ponta[0]) / 2), q((ESPADA.mao[1] + ESPADA.ponta[1]) / 2)]
  // O braço da espada sobe com ela (o pino); o das rédeas fica baixo, no lombo.
  L.push(P(comMeioEm(capsula(q(TRONCO.x + 0.03), q(0.1), mx, my, q(0.03)), pinoNaEspada[0], pinoNaEspada[1]), BRONZE, bronze(18442, { bisel: 1, tom: 1.02 })))
  L.push(P(capsula(q(TRONCO.x + 0.03), -q(0.1), q(0.12), -q(0.04), q(0.03)), BRONZE, bronze(18443, { bisel: 1, tom: 0.96 })))
  L.push(P(botas[1], BRONZE, bronze(18444, { tom: 0.92 })))
  const [ax, ay] = pt(ESPADA.ponta)
  L.push(P(comMeioEm(capsula(mx, my, ax, ay, q(0.014)), pinoNaEspada[0], pinoNaEspada[1]), BRONZE, bronze(18445, { bisel: 0.7, tom: 1.25, metal: 0.6, projeta: { dist: 1, forca: 0.3 } })))
  L.push(P(comMeioEm(capsula(mx - q(0.01), my - q(0.045), mx + q(0.01), my + q(0.045), q(0.012)), pinoNaEspada[0], pinoNaEspada[1]), BRONZE, bronze(18446, { bisel: 0.6, tom: 1.1 })))
  const elmo = elipse(q(TRONCO.x), q(0.01), q(ELMO.r), q(ELMO.r))
  L.push(P(comMeioEm(elmo, q(TRONCO.x), q(0.01)), BRONZE, bronze(18447, { bisel: q(ELMO.r) * 0.8, tom: 1.08, projeta: { dist: 1, forca: 0.3 } })))
  L.push(P(comMeioEm(capsula(q(TRONCO.x - 0.05), q(0.01), q(TRONCO.x + 0.05), q(0.01), q(ELMO.penacho) * 0.5), q(TRONCO.x), q(0.01)), BRONZE, bronze(18448, { bisel: 1, tom: 0.78 })))
}
