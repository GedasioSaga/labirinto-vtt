/**
 * GUINCHO DE CORRENTE (lote L03 de 24/11/2026, Tortura e fogo; desenho
 * ORIGINAL, só a ideia da "roda dentada de parede" dos mapas de referência):
 * o guincho chumbado na parede da masmorra. Uma TÁBUA de montagem aparafusada,
 * a chapa do mancal, o TAMBOR e, na frente dele, a RODA DENTADA de ferro (a
 * coroa de dentes, cinco raios e o cubo), travada pela LINGUETA presa em cima,
 * com a MANIVELA de punho de madeira. De trás da roda saem quatro CORRENTES
 * esticadas em LEQUE até as ARGOLAS chumbadas no chão.
 *
 * Os elos se leem como elos (um deitado, o seguinte em pé: `elosAoLongo` da
 * corrente). O ferro é velho: ferrugem em manchas nos raios e na chapa, brilho
 * só no cubo e nos dentes, onde a lingueta roça.
 *
 * Figura de parede, desenhada de frente nas duas vistas, como o quadro de
 * avisos: de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a sombra de baixo
 * (`EM_PE` em `tresQuartos.ts`). Desenho em px de uma pegada de 1,5 x 1,5 casa
 * (84 x 84, y cresce para baixo: a parede em cima, o chão embaixo).
 *
 * A 25% de zoom sobram o disco dentado escuro em cima e o leque das quatro
 * correntes abrindo para baixo: é o que diz "guincho de corrente", e não roda
 * de carroça, relógio ou corrente largada. Materiais: `metal` e `madeira`.
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { anel, barra, caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo } from './corrente'

/** A pegada em que o desenho foi medido (px do protótipo): 1,5 x 1,5 casa. */
const LADO = 1.5 * G

/** A tábua de montagem na parede. */
const TABUA = { x0: -21, y0: -39, x1: 21, y1: 3 }
/** A roda: o meio, o raio da ponta e do pé dos dentes, quantos dentes, o raio de dentro da coroa, o cubo e os raios. */
const RODA = { x: 0, y: -17, ponta: 15.6, pe: 12.7, dentes: 14, coroa: 9.4, cubo: 4.3, raios: 5, larguraDoRaio: 2.6 }
/** O tambor atrás da roda (aparece nos vãos entre os raios). */
const RAIO_DO_TAMBOR = 8.6
/** A lingueta: o pino dela e a ponta que trava no dente. */
const LINGUETA: readonly Ponto[] = [[-16.4, -36.6], [-12.8, -37.6], [-8.4, -29.4], [-10.6, -27.6]]
const PINO_DA_LINGUETA: Ponto = [-14.4, -36.2]
/** A manivela: do cubo até o punho. */
const PUNHO: Ponto = [16.5, -6.5]
/** As correntes: de onde sai cada uma (atrás da roda) e a argola do chão em que acaba. */
const CORRENTES: readonly (readonly [Ponto, Ponto])[] = [
  [[-6, -11], [-34, 31]],
  [[-2.2, -9], [-12.5, 36]],
  [[2.2, -9], [12.5, 36]],
  [[6, -11], [34, 31]],
]
const PASSO_DA_CORRENTE = 4.2
const ARGOLA = { fora: 3, dentro: 1.7 }

const TOM_DO_REBITE = 1.32
const BRILHO_DO_FERRO = 0.32
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
const FERRUGEM: Rgb = [0x7c, 0x58, 0x42]
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x2c, 0x28] }

const DO_METAL = texturaDaClasse('metal')

/** O ferro velho: o metal e a ferrugem em manchas (`quanto` de 0 a 1). */
function texFerroVelho(quanto: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const t = limitar01((ruido(x * 0.42 + p.su, y * 0.42 + p.sv) + 0.08) * 1.9) * quanto
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
  }
}

/** A coroa dentada: o polígono dos dentes (cada um um trapézio) em volta do meio. */
function coroaDentada(cx: number, cy: number): Forma {
  const pontos: Ponto[] = []
  const passo = (Math.PI * 2) / RODA.dentes
  for (let i = 0; i < RODA.dentes; i += 1) {
    const a = i * passo
    for (const [f, r] of [[0, RODA.pe], [0.2, RODA.ponta], [0.52, RODA.ponta], [0.72, RODA.pe]] as const) {
      pontos.push([cx + Math.cos(a + f * passo) * r, cy + Math.sin(a + f * passo) * r])
    }
  }
  return poligono(pontos)
}

export const montarGuinchoDeCorrente: MontarMovel = (c, cena) => {
  const e = Math.min(c.w, c.h) / LADO
  const na = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    cena.partes.push(c.peca(na(f), mat, { ...o, bisel: (o.bisel ?? 1) * e }))
  }
  const ferro = c.m.metal
  const madeira = c.m.madeira
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.8, contorno: 0.3, metal: BRILHO_DO_FERRO, textura: texFerroVelho(0.5), semente, ...mais })
  const sombraMiuda = { dist: 0.9 * e, forca: 0.3 }
  cena.corDoPiso = ESCURO_DO_FERRO

  // ---------- as sombras: a tábua um nada descolada da parede, cada corrente e as argolas no chão ----------
  const tabua = caixa(TABUA.x0, TABUA.y0, TABUA.x1, TABUA.y1, 1.4)
  cena.sombras.push({ forma: na(tabua), z: 6 * e, solta: true, suave: 1.5 * e, forca: 0.28 })
  for (const [[ax, ay], [bx, by]] of CORRENTES) {
    cena.sombras.push({ forma: na(capsula(ax, Math.max(ay, TABUA.y1), bx, by, 1.3)), z: 3 * e, solta: true, suave: 1.3 * e, forca: 0.24 })
    cena.sombras.push(contato(na(caixa(bx - 3.8, by + 0.4, bx + 3.8, by + 4.4, 1)), 0.32))
  }

  // ---------- a tábua de montagem, os parafusos e a chapa do mancal ----------
  por(tabua, madeira, { tabua: 10.5, bisel: 1.3, contorno: 0.3, tom: 0.92, semente: 24801 })
  for (const x of [TABUA.x0 + 3.6, TABUA.x1 - 3.6]) {
    for (const y of [TABUA.y0 + 3.6, TABUA.y1 - 3.6]) {
      por(elipse(x, y, 1.5, 1.5), ferro, doFerro(24802 + x + y * 3, { bisel: 1.2, tom: 1.12, textura: undefined, projeta: sombraMiuda }))
    }
  }
  por(caixa(-6, TABUA.y0 + 0.8, 6, TABUA.y1 - 0.8, 1), ferro, doFerro(24810, { tom: 0.86, textura: texFerroVelho(0.8), projeta: sombraMiuda }))

  // ---------- as argolas chumbadas no chão (por baixo das correntes) ----------
  CORRENTES.forEach(([, [bx, by]], i) => {
    por(caixa(bx - 3.6, by + 1, bx + 3.6, by + 4.2, 0.9), ferro, doFerro(24820 + i, { tom: 0.9, textura: texFerroVelho(0.7) }))
    for (const lado of [-1, 1]) por(elipse(bx + lado * 2.4, by + 2.6, 0.7, 0.7), ferro, doFerro(24824 + i * 2 + lado, { bisel: 0.6, tom: TOM_DO_REBITE, contorno: 0.2, textura: undefined }))
    por(anel(bx, by - 0.4, ARGOLA.fora, ARGOLA.fora, ARGOLA.dentro, ARGOLA.dentro), ferro, doFerro(24832 + i, { bisel: 0.65, metal: 0.42, projeta: sombraMiuda }))
  })

  // ---------- as correntes em leque: os elos de cada uma, do tambor à argola ----------
  CORRENTES.forEach(([[ax, ay], [bx, by]], i) => {
    const caminho: readonly Ponto[] = [[ax * e, ay * e], [bx * e, (by - ARGOLA.fora + 0.6) * e]]
    elosAoLongo(caminho, PASSO_DA_CORRENTE * e, i % 2 === 0).forEach((elo, j) => {
      const tom = 0.98 + 0.14 * hash(i, j, 24840)
      cena.partes.push(c.peca(elo.forma, ferro, {
        tabua: 0,
        bisel: (elo.deitado ? 0.55 : 0.6) * e,
        contorno: 0.3,
        tom,
        metal: 0.4,
        textura: texDoElo(elo, 0.45),
        semente: 24840 + i * 40 + j,
        projeta: elo.deitado ? undefined : { dist: 0.6 * e, forca: 0.24 },
      }))
    })
  })

  // ---------- o tambor atrás da roda, a roda dentada, o cubo e a manivela ----------
  por(elipse(RODA.x, RODA.y, RAIO_DO_TAMBOR, RAIO_DO_TAMBOR), madeira, { tabua: 0, bisel: 2.4, contorno: 0.3, tom: 0.66, polar: { cx: RODA.x, cy: RODA.y, r: RAIO_DO_TAMBOR }, semente: 24900 })
  let miolo: Forma = elipse(RODA.x, RODA.y, RODA.cubo, RODA.cubo)
  for (let i = 0; i < RODA.raios; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / RODA.raios
    miolo = uniao(miolo, barra(RODA.x, RODA.y, RODA.x + Math.cos(a) * (RODA.coroa + 1), RODA.y + Math.sin(a) * (RODA.coroa + 1), RODA.larguraDoRaio))
  }
  const roda = uniao(menos(coroaDentada(RODA.x, RODA.y), elipse(RODA.x, RODA.y, RODA.coroa, RODA.coroa)), miolo)
  por(roda, ferro, doFerro(24901, { bisel: 1, tom: 1, metal: 0.4, textura: texFerroVelho(0.55), projeta: { dist: 2 * e, forca: 0.36, suave: 1.3 * e } }))
  // O vinco da coroa (onde os dentes nascem) e o cubo com a porca.
  por(anel(RODA.x, RODA.y, RODA.pe - 0.9, RODA.pe - 0.9, RODA.pe - 1.5, RODA.pe - 1.5), VAO, { bisel: 0, contorno: 0, alfa: 0.4, semente: 24902 })
  por(elipse(RODA.x, RODA.y, 3, 3), ferro, doFerro(24903, { bisel: 1.6, tom: 1.2, metal: 0.5, textura: undefined, projeta: sombraMiuda }))
  por(barra(RODA.x, RODA.y, PUNHO[0], PUNHO[1], 2.6), ferro, doFerro(24904, { bisel: 1, tom: 1.08, textura: texFerroVelho(0.3), projeta: { dist: 1.4 * e, forca: 0.32 } }))
  por(elipse(RODA.x, RODA.y, 1.5, 1.5), ferro, doFerro(24905, { bisel: 1.2, tom: TOM_DO_REBITE, metal: 0.55, contorno: 0.2, textura: undefined }))
  por(elipse(PUNHO[0], PUNHO[1], 3.2, 3.2), madeira, { tabua: 0, bisel: 2.2, contorno: 0.3, tom: 1.12, polar: { cx: PUNHO[0], cy: PUNHO[1], r: 3 }, semente: 24906, projeta: { dist: 1.6 * e, forca: 0.32 } })

  // ---------- a lingueta que trava a roda, presa na tábua pelo pino ----------
  por(poligono(LINGUETA), ferro, doFerro(24910, { bisel: 0.8, tom: 1.1, textura: texFerroVelho(0.3), projeta: sombraMiuda }))
  por(elipse(PINO_DA_LINGUETA[0], PINO_DA_LINGUETA[1], 1.3, 1.3), ferro, doFerro(24911, { bisel: 1, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2, textura: undefined }))
}
