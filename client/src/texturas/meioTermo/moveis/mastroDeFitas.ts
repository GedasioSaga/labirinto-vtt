/**
 * MASTRO DE FITAS de cima com volume (L09 dos objetos novos, 14/11/2026,
 * grupo Taverna e festa): o mastro da dança de roda da festa da primavera. O
 * MASTRO alto de madeira com a COROA de folhas e flores no topo e a bola
 * torneada na ponta; de baixo da coroa saem as doze FITAS coloridas, esticadas
 * em leque até as ESTACAS fincadas em roda, cada uma com o nó e a ponta solta
 * da fita caída na grama, esperando os dançarinos.
 *
 * De cima é uma roda de raios coloridos em volta da coroa verde (o guarda-sol
 * aberto visto do alto): é o que lê a 25% de zoom. No chão, a sombra comprida
 * do mastro, a da coroa, longe, e o risco fraco de cada fita.
 *
 * NA 3/4 (perfil `{ modo: 'derivado', espessura: 0 }`) o mastro é uma coluna
 * da altura toda, e cada fita, inclinada do alto do mastro até a estaca, é
 * cortada em PEDAÇOS curtos ao comprido, cada um preso num pino na altura
 * dele (a regra das pernas da banqueta). Cada pedaço é desenhado meio
 * corrigido: deslocado metade do quanto a altura da fita muda dentro dele, no
 * sentido que a 3/4 sobe na tela. Assim o desvio fica dividido: menos de um
 * quarto de px de cima e na 3/4, em vez de meio px numa vista só. As fitas do
 * norte ficam atrás do mastro e as do sul na frente (a 3/4 pinta do norte
 * para o sul pela base de cada estrutura). As peças da coroa usam `comMeioEm`
 * para subir com o mastro.
 *
 * As medidas saem do menor meio lado da pegada (2,2 x 2,2 casas de partida); as
 * alturas são em casas. Lê `c.giro` só para o rumo da sombra e da correção das
 * fitas, desgirados para a tela. Material: `madeira` (o mastro e as estacas);
 * as fitas, a coroa e as flores são fixas.
 */
import { rgb, type Rgb } from '../../ruido'
import { anel, capsula, caixa, cadeia, elipse, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, QUARTO, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { circulo, comMeioEm, CORES_DE_FESTA, desgirado, estrutura, naCaixa, quartosDeVolta } from './varalDeBandeirinhas'

/** As alturas em casas: o topo do mastro (a coroa), onde as fitas saem e a cabeça da estaca. */
const ALTURA_DO_MASTRO = 2.1
const SAIDA_DAS_FITAS = 2.02
const ALTURA_DA_ESTACA = 0.12

// ---------- as medidas, em frações do menor meio lado ----------

/** O mastro e a bola da ponta. */
const RAIO_DO_MASTRO = 0.05
const RAIO_DA_BOLA = 0.065
/** A coroa: o raio de fora e o de dentro do anel de folhas. */
const COROA_FORA = 0.17
const COROA_DENTRO = 0.07
/** De onde as fitas saem (debaixo da coroa) e onde as estacas ficam. */
const RAIO_DA_SAIDA = 0.1
const RAIO_DAS_ESTACAS = 0.8
/** A estaca: o raio da cabeça. */
const RAIO_DA_ESTACA = 0.028
/** A ponta solta de cada fita, caída na grama além da estaca: o comprimento e quanto ela ondula. */
const PONTA_SOLTA = 0.1
const ONDA_DA_PONTA = 0.014

/** Quantas fitas e a meia largura de cada uma (px do protótipo na pegada de partida). */
const FITAS = 12
const MEIA_FITA = 1.1
/** O pedaço de fita (px do protótipo) e quanto da correção de altura ele leva (metade: o desvio se divide entre as duas vistas). */
const PEDACO = 0.4
const CORRECAO = 0.5
/** Meia medida do pino de cada pedaço (px). */
const PINO = 0.1

/** O brilho de cetim da fita: a faixa clara no meio, o escuro nas beiras e a torção de tempos em tempos. */
const CETIM = { meio: 0.1, beira: 0.06, passoDaTorcao: 0.32, torcao: 0.05 } as const
/** O contorno da fita, pintado: de que fração da meia largura começa e quanto escurece na beira. */
const BEIRA_DA_FITA = { de: 0.7, forca: 0.26 } as const
/** O peso do claro e do escuro do través na fita que corre de leste a oeste (a norte-sul leva o peso cheio). */
const PESO_DO_TRAVES = { minimo: 0.2 } as const

/** As flores da coroa: quantas, o raio e as cores (as da festa, mais o branco). */
const FLORES = 9
const RAIO_DA_FLOR = 0.026
const BRANCO: Rgb = [0xe8, 0xe2, 0xd2]
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('ocre', 1.12)) }

/** As sombras: a da coroa no chão e o risco de cada fita, fracos (a coroa está a duas casas do chão). */
const SOMBRA_DA_COROA = { suave: 2.4, forca: 0.18 } as const
const SOMBRA_DA_FITA = { raio: 0.7, suave: 1.4, forca: 0.1 } as const

/** A madeira de cima do mastro: os anéis do topo cortado, como o mourão. */
function texDoTopo(): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x, y) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(longe * 4.2) * 0.04 + 0.05
  }
}

/** O cetim da fita: a faixa clara do meio, as beiras escuras e a torção. `a` = o rumo da fita (ela passa pelo meio do mastro). */
function texDaFita(a: number, meia: number): Textura {
  const tecido = texturaDaClasse('tecido')
  const nx = -Math.sin(a)
  const ny = Math.cos(a)
  // Na 3/4 cada pedaço sobe a altura dele: na fita que corre de leste a oeste o través é o y, e o claro e o
  // escuro do través viravam degraus. O través pesa pelo quanto ele corre em x (cheio nas fitas norte-sul).
  const peso = PESO_DO_TRAVES.minimo + (1 - PESO_DO_TRAVES.minimo) * nx * nx
  return (u, v, x, y, p, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, p, s, escala)
    const atravessa = Math.min(1, Math.abs(x * nx + y * ny) / meia)
    const ao = x * ny - y * nx
    let traves = CETIM.meio * (1 - atravessa * atravessa) - CETIM.beira * atravessa * atravessa
    // O contorno da fita, pela distância à linha dela (os pedaços não têm contorno próprio, senão cada corte ganhava um risco).
    if (atravessa > BEIRA_DA_FITA.de) traves -= BEIRA_DA_FITA.forca * ((atravessa - BEIRA_DA_FITA.de) / (1 - BEIRA_DA_FITA.de))
    s[3] += traves * peso + Math.sin(ao * CETIM.passoDaTorcao) * CETIM.torcao
  }
}

export const montarMastroDeFitas: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const L = cena.partes
  const mad = c.m.madeira
  const quartos = quartosDeVolta(c.giro)
  const [sx, sy] = desgirado(SOMBRA_X, SOMBRA_Y, quartos)
  // O rumo no desenho que a 3/4 sobe NA TELA (para cima): a correção dos pedaços vai por ele.
  const [ux, uy] = desgirado(0, -1, quartos)
  const zTopo = g * ALTURA_DO_MASTRO
  const zSaida = g * SAIDA_DAS_FITAS
  const zEstaca = g * ALTURA_DA_ESTACA
  const rMastro = RAIO_DO_MASTRO * R
  const rSaida = RAIO_DA_SAIDA * R
  const rEstacas = RAIO_DAS_ESTACAS * R
  const rEstaca = RAIO_DA_ESTACA * R
  const k = R / (1.1 * g)
  const meia = MEIA_FITA * k

  // As SOMBRAS do que está no alto, pintadas no chão: a de cada fita (da estaca até a sombra da saída) e a da coroa.
  for (let j = 0; j < FITAS; j += 1) {
    const a = (2 * Math.PI * j) / FITAS + Math.PI / FITAS
    const [cx, cy] = [Math.cos(a), Math.sin(a)]
    cena.sombras.push({ forma: capsula(cx * rEstacas + sx * zEstaca, cy * rEstacas + sy * zEstaca, cx * rSaida + sx * zSaida, cy * rSaida + sy * zSaida, SOMBRA_DA_FITA.raio * k), z: 0, suave: SOMBRA_DA_FITA.suave, forca: SOMBRA_DA_FITA.forca })
  }
  cena.sombras.push({ forma: anel(sx * zTopo, sy * zTopo, COROA_FORA * R, COROA_FORA * R, COROA_DENTRO * R, COROA_DENTRO * R), z: 0, ...SOMBRA_DA_COROA })

  // O MASTRO: uma coluna da altura toda (a sombra comprida e o contato no pé).
  const mastro = circulo(0, 0, rMastro)
  cena.sombras.push({ forma: mastro, z: zTopo, suave: 1.5, forca: 0.24 }, contato(mastro, 0.3))

  // As PONTAS SOLTAS na grama, por baixo de tudo: da estaca para fora, ondulando.
  for (let j = 0; j < FITAS; j += 1) {
    const a = (2 * Math.PI * j) / FITAS + Math.PI / FITAS
    const [cx, cy] = [Math.cos(a), Math.sin(a)]
    const [nx, ny] = [-cy, cx]
    const pontos: Ponto[] = []
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6
      const r = rEstacas + rEstaca + t * PONTA_SOLTA * R
      const lado = Math.sin(t * Math.PI * 1.6 + j) * ONDA_DA_PONTA * R * t
      pontos.push([cx * r + nx * lado, cy * r + ny * lado])
    }
    const cor: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: CORES_DE_FESTA[j % CORES_DE_FESTA.length] }
    const ponta = cadeia(pontos, meia * 0.85)
    cena.sombras.push(contato(ponta, 0.18))
    L.push(P(ponta, cor, { eixo: a, bisel: 0.5, contorno: 0.24, tom: 0.92, semente: 9400 + j }))
  }

  // As FITAS, em pedaços presos cada um num pino na altura dele: do alto (debaixo da coroa) até a cabeça da estaca.
  const comprimento = rEstacas - rSaida
  const pedacos = Math.max(8, Math.ceil(comprimento / PEDACO))
  const passo = comprimento / pedacos
  const zEm = (r: number): number => zSaida + ((zEstaca - zSaida) * (r - rSaida)) / comprimento
  for (let j = 0; j < FITAS; j += 1) {
    const a = (2 * Math.PI * j) / FITAS + Math.PI / FITAS
    const [cx, cy] = [Math.cos(a), Math.sin(a)]
    const cor: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: CORES_DE_FESTA[j % CORES_DE_FESTA.length] }
    const textura = texDaFita(a, meia)
    for (let i = 0; i < pedacos; i += 1) {
      const ra = rSaida + i * passo
      const rb = ra + passo
      const rm = (ra + rb) / 2
      const zm = zEm(rm)
      // Meio corrigido: cada ponta vai metade do quanto a altura dela difere da do pino, no rumo que a 3/4 sobe.
      const da = CORRECAO * (zEm(ra) - zm)
      const db = CORRECAO * (zEm(rb) - zm)
      const [mx, my] = [cx * rm, cy * rm]
      cena.sombras.push(estrutura(caixa(mx - PINO, my - PINO, mx + PINO, my + PINO), zm))
      const pedaco = capsula(cx * ra + ux * da, cy * ra + uy * da, cx * rb + ux * db, cy * rb + uy * db, meia)
      L.push(P(comMeioEm(pedaco, mx, my), cor, { eixo: a, bisel: 0, contorno: 0, textura, semente: 9420 + j }))
    }
  }

  // As ESTACAS: colunas baixas, a cabeça batida e o nó da fita em volta.
  for (let j = 0; j < FITAS; j += 1) {
    const a = (2 * Math.PI * j) / FITAS + Math.PI / FITAS
    const [cx, cy] = [Math.cos(a) * rEstacas, Math.sin(a) * rEstacas]
    const estaca = circulo(cx, cy, rEstaca)
    cena.sombras.push({ forma: estaca, z: zEstaca, suave: 0.9, forca: 0.26 }, contato(estaca, 0.3))
    const cor: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: CORES_DE_FESTA[j % CORES_DE_FESTA.length] }
    L.push(P(naCaixa(estaca, [cx - rEstaca * 2.2, cy - rEstaca * 2.2, cx + rEstaca * 2.2, cy + rEstaca * 2.2]), mad, { eixo: QUARTO, tabua: 0, bisel: rEstaca * 0.6, contorno: 0.3, tom: 0.85, textura: texDoTopo(), semente: 9460 + j }))
    L.push(P(comMeioEm(anel(cx, cy, rEstaca * 1.9, rEstaca * 1.9, rEstaca * 0.9, rEstaca * 0.9), cx, cy), cor, { bisel: 0.5, contorno: 0.26, semente: 9480 + j }))
  }

  // O TOPO do mastro: a coroa de folhas, as flores, a madeira do topo e a bola torneada.
  // O topo leva a maior caixa: é da maior peça que a 3/4 tira o material da frente do mastro (a madeira, e não as folhas).
  const folhas = materialDaPeca('buxo')
  L.push(P(anel(0, 0, COROA_FORA * R, COROA_FORA * R, COROA_DENTRO * R, COROA_DENTRO * R), folhas, { bisel: COROA_FORA * R * 0.35, contorno: 0.26, semente: 9500 }))
  for (let i = 0; i < FLORES; i += 1) {
    const a = (2 * Math.PI * i) / FLORES + 0.3
    const r = ((COROA_FORA + COROA_DENTRO) / 2) * R * (i % 2 === 0 ? 1.08 : 0.92)
    const [fx, fy] = [Math.cos(a) * r, Math.sin(a) * r]
    const cor = i % 3 === 2 ? BRANCO : CORES_DE_FESTA[(i * 2) % CORES_DE_FESTA.length]
    const flor = elipse(fx, fy, RAIO_DA_FLOR * R, RAIO_DA_FLOR * R)
    L.push(P(comMeioEm(flor, 0, 0), { classe: 'tecido', fio: 'la', rgb: cor }, { bisel: RAIO_DA_FLOR * R * 0.7, contorno: 0.24, semente: 9510 + i }))
    L.push(P(comMeioEm(elipse(fx, fy, RAIO_DA_FLOR * R * 0.38, RAIO_DA_FLOR * R * 0.38), 0, 0), MIOLO_DA_FLOR, { bisel: 0.3, contorno: 0.1, semente: 9530 + i }))
  }
  const alcance = COROA_FORA * R * 1.2
  L.push(P(naCaixa(elipse(0, 0, RAIO_DA_BOLA * R, RAIO_DA_BOLA * R), [-alcance, -alcance, alcance, alcance]), mad, { tabua: 0, bisel: RAIO_DA_BOLA * R * 0.7, contorno: 0.28, tom: 1.05, textura: texDoTopo(), semente: 9550 }))
}
