/**
 * CORRENTE PENDURADA (L01 do plano de arte por tema, 28/11/2026, temas Dungeons e Prisão; fila de 24/11): a corrente
 * grossa que desce do teto da masmorra. Em cima, a CHAPA chumbada no teto com dois cravos e a ARGOLA; dela descem os
 * ELOS (os da corrente de chão: um de frente, o oval vazado, o seguinte de lado, a barra fina) até a ponta. Duas
 * versões no mesmo tipo (`versoes/correntePenduradaVersoes.ts`):
 * - COM GANCHO (a 1ª, `montarCorrentePendurada`): na ponta, o GANCHO de açougue, com o olho, a haste, a curva e a
 *   ponta afiada. Limpo: nada pendurado nele;
 * - COM GRILHÃO (`montarCorrentePenduradaComGrilhao`): na ponta, a ALGEMA aberta dos grilhões de parede.
 *
 * DE CIMA a corrente vem de frente para quem olha: do ponto onde ela pende sobram a cruz de dois elos e a ponta que
 * sai para o lado (a curva do gancho, ou o aro da algema quase de cutelo). O que diz "pendurada" é a SOMBRA no chão,
 * pintada da geometria de verdade e longe do ponto, para baixo à direita (a luz de cima à esquerda, `SOMBRA_X` e
 * `SOMBRA_Y`): o risco comprido da corrente e o desenho do gancho (ou do aro) deitado. A regra do lustre.
 *
 * NA 3/4 a corrente aparece em pé, de frente: cada elo, o gancho (ou a algema), a argola e a chapa são desenhados na
 * tela (a altura vira o `y`) em volta do ponto onde ela pende, e cada um sobe por um PINO (um ponto sem tamanho nem
 * tinta, na fila da beira de baixo da pegada) até a altura dele. De cima essas peças não pintam (`p.dy` zero); as de
 * cima ficam presas a um pino de um fio e somem na 3/4. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`.
 *
 * Pegada de partida 1 x 1 casa; as medidas, inclusive as alturas, têm o tamanho do menor lado (preso entre 0,8 e
 * 1,5). Material: `metal` (os elos, o gancho, a argola e a chapa). A algema é a dos grilhões, de ferro fixo, e a
 * sombra pintada é fixa.
 */
import { anel, cadeia, caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo } from './corrente'
import { algemaAberta, montarAlgema } from './grilhoesDeParede'
import { rebite } from './cadeiraDeFerro'
import { comMeioEm } from './varalDeBandeirinhas'

const ESCALA_MINIMA = 0.8
const ESCALA_MAXIMA = 1.5
/** As alturas, em casas: a chapa do teto e a ponta de baixo da corrente (o olho do gancho, a dobradiça da algema). */
const ALTURA_DO_TETO = 1.9
const ALTURA_DA_PONTA = 0.95
/** O passo dos elos (o dos grilhões de parede, px de partida) e a ferrugem deles. */
const PASSO_DOS_ELOS = 4.6
const FERRUGEM_DOS_ELOS = 0.3
/** Onde a corrente pende, px de partida a partir do meio da pegada: em cima à esquerda, para a sombra cair dentro. */
const PENDE_EM: Ponto = [-4, -7]
/** A chapa do teto (meia largura e meia altura) e a argola debaixo dela (raio e arame), px de partida. */
const CHAPA = { meia: 3.8, alta: 1 } as const
const ARGOLA = { raio: 2.3, arame: 1 } as const
/**
 * O gancho de frente, px de partida a partir do meio do olho (x para a direita, z para cima): a haste desce, a curva
 * vai para a direita e sobe até a ponta. De cima, a mesma curva achatada, para o lado.
 */
const CURVA_DO_GANCHO: readonly Ponto[] = [
  [0, -1.3],
  [0, -5.6],
  [0.36, -6.95],
  [1.3, -7.9],
  [2.6, -8.25],
  [3.9, -7.9],
  [4.84, -6.95],
  [5.2, -5.6],
  [5.1, -4.3],
]
const GANCHO_DE_CIMA: readonly Ponto[] = [
  [0.5, 0.5],
  [1.6, 1.5],
  [3, 1.8],
  [4.3, 1.2],
  [5, 0],
]
const RAIO_DO_GANCHO = 0.72
const OLHO_DO_GANCHO = { raio: 1.55, furo: 0.75 } as const
/** A algema da ponta (px de partida): o raio, a faixa e quanto a metade solta abriu (rad). */
const ALGEMA = { raio: 4.4, faixa: 1.9, abertura: 0.7 } as const
/** A sombra pintada no chão (o escuro da sombra da cela) e o pino que sobe as peças só de cima (um fio). */
const SOMBRA_NO_CHAO: MaterialDaPeca = { classe: 'liso', rgb: [0x1d, 0x1b, 0x19] }
const ALFA_DA_SOMBRA = 0.3
const ALTURA_DO_PINO_DE_CIMA = 0.05

type Ponta = 'gancho' | 'grilhao'

interface Desenho {
  readonly P: CriarPeca
  readonly cena: Cena
  readonly k: number
  /** O ponto do chão debaixo de onde a corrente pende. */
  readonly x0: number
  readonly y0: number
  readonly metal: MaterialDaPeca
  /** A fila de pinos na beira de baixo da pegada: onde fica o próximo. */
  readonly fila: { n: number; readonly x: number; readonly y: number }
}

/** A peça só na vista de cima (`dy` zero) ou só na 3/4 (a peça subiu). */
function soNaVista(textura: Textura | null, deCima: boolean): Textura {
  return (u, v, x, y, p, s, escala) => {
    if ((p.dy === 0) !== deCima) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** Um pino novo na altura `z` e o criador das peças que sobem com ele (já postas na cena), cada uma só numa das vistas. */
function subindo(d: Desenho, z: number, deCima: boolean): CriarPeca {
  const px = d.fila.x + d.fila.n * 0.5
  const py = d.fila.y
  d.fila.n += 1
  d.cena.sombras.push({ forma: elipse(px, py, 0.1, 0.1), z, solta: true, forca: 0 })
  return (forma, mat, o = {}) => {
    const peca = d.P(comMeioEm(forma, px, py), mat, { ...o, textura: soNaVista(o.textura ?? texturaDaClasse(mat.classe), deCima) })
    d.cena.partes.push(peca)
    return peca
  }
}

/** O ponto do chão onde cai a sombra de (dx, z): dx ao lado do ponto onde a corrente pende, z de altura. */
function naSombra(d: Desenho, dx: number, z: number): Ponto {
  return [d.x0 + dx + SOMBRA_X * z, d.y0 + SOMBRA_Y * z]
}

function sombraNoChao(d: Desenho, forma: Forma, semente: number): void {
  d.cena.partes.push(d.P(forma, SOMBRA_NO_CHAO, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA, suave: 1.2, semente }))
}

/** A forma desenhada de frente: (dx, z) vira o ponto do chão que, subido `zMeio`, cai no lugar dele na tela. */
function deFrente(d: Desenho, zMeio: number): (dx: number, z: number) => Ponto {
  return (dx, z) => [d.x0 + dx, d.y0 + zMeio - z]
}

/** Os elos de `zBaixo` a `zAlto`, de frente, cada um no pino da altura dele. */
function elos(d: Desenho, zBaixo: number, zAlto: number): void {
  const n = Math.max(2, Math.round((zAlto - zBaixo) / (PASSO_DOS_ELOS * d.k)))
  const passo = (zAlto - zBaixo) / n
  for (let i = 0; i < n; i += 1) {
    const P = subindo(d, zBaixo + passo * (i + 0.5), false)
    const [elo] = elosAoLongo([[d.x0, d.y0 - passo / 2], [d.x0, d.y0 + passo / 2]], passo, i % 2 === 0)
    const opcoes = elo.deitado ? { bisel: 0.5 * d.k, tom: 1 } : { bisel: 0.7 * d.k, tom: 1.12 }
    P(elo.forma, d.metal, { tabua: 0, ...opcoes, metal: 0.4, contorno: 0.3, textura: texDoElo(elo, FERRUGEM_DOS_ELOS), semente: 3300 + i })
  }
}

/** A chapa do teto com os dois cravos e a argola presa nela, de frente. */
function chapaEArgola(d: Desenho, zAlto: number): void {
  const k = d.k
  const zMeio = zAlto + ARGOLA.raio * k
  const P = subindo(d, zMeio, false)
  const em = deFrente(d, zMeio)
  const [ax, ay] = em(0, zMeio)
  P(anel(ax, ay, ARGOLA.raio * k, ARGOLA.raio * k, (ARGOLA.raio - ARGOLA.arame) * k, (ARGOLA.raio - ARGOLA.arame) * k), d.metal, { tabua: 0, bisel: 0.5 * k, tom: 1.04, metal: 0.42, contorno: 0.3, semente: 3340 })
  const [c0x, c0y] = em(-CHAPA.meia * k, zMeio + (ARGOLA.raio + 2 * CHAPA.alta) * k)
  const [c1x, c1y] = em(CHAPA.meia * k, zMeio + (ARGOLA.raio - 0.3) * k)
  P(caixa(c0x, c0y, c1x, c1y, 0.4 * k), d.metal, { tabua: 0, bisel: 0.5 * k, tom: 0.8, metal: 0.3, contorno: 0.3, semente: 3341 })
  for (const lado of [-1, 1]) {
    const [rx, ry] = em(lado * (CHAPA.meia - 1.2) * k, zMeio + (ARGOLA.raio + CHAPA.alta * 0.85) * k)
    P(elipse(rx, ry, 0.62 * k, 0.62 * k), d.metal, { tabua: 0, bisel: 0.5 * k, tom: 1.24, metal: 0.5, contorno: 0.22, semente: 3342 + lado })
  }
}

/** O gancho de frente, com o olho em `zOlho`, e a sombra dele deitada no chão. */
function gancho(d: Desenho, zOlho: number): void {
  const k = d.k
  const zMeio = zOlho - 3.6 * k
  const P = subindo(d, zMeio, false)
  const em = deFrente(d, zMeio)
  const curva = CURVA_DO_GANCHO.map(([x, z]) => em(x * k, zOlho + z * k))
  const [ox, oy] = em(0, zOlho)
  P(anel(ox, oy, OLHO_DO_GANCHO.raio * k, OLHO_DO_GANCHO.raio * k, OLHO_DO_GANCHO.furo * k, OLHO_DO_GANCHO.furo * k), d.metal, { tabua: 0, bisel: 0.5 * k, tom: 1.04, metal: 0.42, contorno: 0.3, semente: 3350 })
  P(cadeia(curva, RAIO_DO_GANCHO * k), d.metal, { tabua: 0, bisel: 0.6 * k, tom: 1, metal: 0.45, contorno: 0.3, semente: 3351 })
  P(poligono([em(4.45 * k, zOlho - 4.4 * k), em(5.75 * k, zOlho - 4.4 * k), em(5.2 * k, zOlho - 2.7 * k)]), d.metal, { tabua: 0, bisel: 0.3 * k, tom: 1.18, metal: 0.55, contorno: 0.26, semente: 3352 })
  sombraNoChao(d, cadeia(CURVA_DO_GANCHO.map(([x, z]) => naSombra(d, x * k, zOlho + z * k)), RAIO_DO_GANCHO * k * 1.1), 3353)
  sombraNoChao(d, elipse(...naSombra(d, 0, zOlho), OLHO_DO_GANCHO.raio * k, OLHO_DO_GANCHO.raio * k * 0.6), 3354)
}

/** A algema de frente, pendurada pela dobradiça em `zDobradica`, e a sombra do aro deitada no chão. */
function grilhao(d: Desenho, zDobradica: number): void {
  const k = d.k
  const r = ALGEMA.raio * k
  const faixa = ALGEMA.faixa * k
  const zMeio = zDobradica - (r - faixa / 2)
  const P = subindo(d, zMeio, false)
  // O `P` daqui já põe cada peça na cena: a lista que a algema pede fica de lado.
  montarAlgema(P, [], () => undefined, algemaAberta(d.x0, d.y0, r, faixa, -Math.PI / 2, ALGEMA.abertura), faixa, 3360)
  const [sx, sy] = naSombra(d, 0, zMeio)
  sombraNoChao(d, anel(sx, sy, r, r * 0.4, r - faixa, (r - faixa) * 0.4), 3375)
}

/** Vista de cima: a cruz dos dois elos que vêm de frente e a ponta saindo para o lado. */
function deCima(d: Desenho, ponta: Ponta): void {
  const k = d.k
  const P = subindo(d, ALTURA_DO_PINO_DE_CIMA, true)
  const { x0, y0 } = d
  if (ponta === 'gancho') {
    const curva = GANCHO_DE_CIMA.map(([x, y]): Ponto => [x0 + x * k, y0 + y * k])
    P(cadeia(curva, RAIO_DO_GANCHO * k), d.metal, { tabua: 0, bisel: 0.6 * k, tom: 0.98, metal: 0.45, contorno: 0.3, semente: 3380 })
    P(poligono([[x0 + 4.4 * k, y0 + 0.1 * k], [x0 + 5.7 * k, y0 + 0.1 * k], [x0 + 5.2 * k, y0 - 1.5 * k]]), d.metal, { tabua: 0, bisel: 0.3 * k, tom: 1.18, metal: 0.55, contorno: 0.26, semente: 3381 })
  } else {
    const r = ALGEMA.raio * k
    const faixa = ALGEMA.faixa * k
    P(anel(x0, y0 + 0.4 * k, r, 1.7 * k, r - faixa, 0.55 * k), d.metal, { tabua: 0, bisel: 0.4 * k, tom: 0.94, metal: 0.4, contorno: 0.3, semente: 3382 })
    rebite(P, x0, y0 - 1.1 * k, 0.5 * k, 3383, 1.24)
  }
  P(capsula(x0 - 2.1 * k, y0, x0 + 2.1 * k, y0, 0.8 * k), d.metal, { tabua: 0, bisel: 0.6 * k, tom: 1, metal: 0.42, contorno: 0.3, semente: 3384 })
  P(capsula(x0, y0 - 1.5 * k, x0, y0 + 1.5 * k, 0.62 * k), d.metal, { tabua: 0, bisel: 0.5 * k, tom: 1.14, metal: 0.45, contorno: 0.28, semente: 3385 })
}

function montarCorrente(c: ContextoDoMovel, cena: Cena, ponta: Ponta): void {
  const k = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, Math.min(c.w, c.h) / G))
  const d: Desenho = { P: c.peca, cena, k, x0: PENDE_EM[0] * k, y0: PENDE_EM[1] * k, metal: c.m.metal, fila: { n: 0, x: -c.hw + 1.2, y: c.hh - 1.2 } }
  const zTeto = ALTURA_DO_TETO * G * k
  const zPonta = ALTURA_DA_PONTA * G * k
  const zArgola = zTeto - 2 * ARGOLA.raio * k
  // A sombra comprida da corrente, do pé dela até onde a argola ainda faz sombra.
  sombraNoChao(d, capsula(...naSombra(d, 0, zPonta), ...naSombra(d, 0, zArgola), 0.8 * k), 3390)
  deCima(d, ponta)
  if (ponta === 'gancho') gancho(d, zPonta)
  else grilhao(d, zPonta)
  elos(d, zPonta, zArgola)
  chapaEArgola(d, zArgola)
}

export const montarCorrentePendurada: MontarMovel = (c, cena) => {
  montarCorrente(c, cena, 'gancho')
}

export const montarCorrentePenduradaComGrilhao: MontarMovel = (c, cena) => {
  montarCorrente(c, cena, 'grilhao')
}
