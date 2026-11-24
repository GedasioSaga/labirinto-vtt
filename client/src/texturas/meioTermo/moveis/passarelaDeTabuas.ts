/**
 * PASSARELA DE TÁBUAS de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a construção de chão, versão
 * pobre do deck de madeira, `deckDeMadeira.ts`). Tiras de tábua SOLTAS jogadas em cima da lama para ligar uma porta à
 * outra: duas ou três FIADAS ao comprido, cada uma de tábuas de comprimentos desencontrados, um nada tortas, umas com
 * fresta na emenda, outras deitadas por cima da vizinha; entre as fiadas, a lama do mapa aparece. Por baixo, os
 * DORMENTES de través, mais escuros, afundados, com a lama subindo nas pontas. Os pregos onde a tábua cruza o dormente,
 * a beira de baixo de cada tábua molhada, respingos de lama, uma tábua rachada e, na fiada do meio, uma que FALTA.
 *
 * A 25% de zoom sobram as tiras claras paralelas com os vãos escuros entre elas: caminho de tábua (o deck é o tablado
 * fechado com moldura e pilares).
 *
 * Objeto de chão: o token anda em cima e não barra. Na 3/4 (DERIVADO) fica rente, como o deck sem os pilares: nenhuma
 * sombra com altura, só o contato. Esticada ao comprido, a passarela ganha mais tábuas e mais dormentes (nada estica);
 * mais larga, mais fiadas (uma a cada `LARGURA_DA_FIADA` casa, de 1 a 6). Material: `madeira` (a madeira velha de
 * partida: cinza de chuva, lê bem na lama escura e no chão claro).
 */
import { hash } from '../../ruido'
import { caixa, capsula, elipse, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, PREGO, QUARTO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'

/** Uma fiada a cada tanto de casa, e quanto da fiada a tábua ocupa (o resto é o vão de lama). */
const LARGURA_DA_FIADA = 0.32
const TABUA_NA_FIADA = 0.8
/** Um dormente a cada tanto de casa. */
const PASSO_DO_DORMENTE = 1.05
/** O comprimento de uma tábua (casas): do mais curto ao mais comprido. */
const TABUA_CURTA = 0.7
const TABUA_COMPRIDA = 1.5
/** A sobra mínima no fim da fiada (casas): menos que isto, a tábua de antes vai até o fim. */
const SOBRA_MINIMA = 0.35
/** A lama (respingo, a que sobe no dormente e a beira molhada) e a racha. */
const LAMA: MaterialDaPeca = { classe: 'liso', rgb: [0x4b, 0x3d, 0x2e] }
const RACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x2a, 0x22] }

export const montarPassarelaDeTabuas: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const k = Math.min(h / G, w / (3 * G))
  const fiadas = Math.max(1, Math.min(6, Math.round(h / (LARGURA_DA_FIADA * g))))
  const passo = h / fiadas
  const largura = passo * TABUA_NA_FIADA

  // Os DORMENTES de través, por baixo de tudo: escuros, afundados, com a lama subindo nas pontas.
  const nD = Math.max(2, Math.round(w / (PASSO_DO_DORMENTE * g)) + 1)
  const dormentes = Array.from({ length: nD }, (_, j) => -hw + 4 * k + ((w - 8 * k) * j) / (nD - 1) + (hash(j, 1, 8900) - 0.5) * 4 * k)
  dormentes.forEach((x, j) => {
    const dormente = girar(caixa(x - 1.9 * k, -hh + 0.4, x + 1.9 * k, hh - 0.4, 0.9 * k), x, 0, (hash(j, 2, 8900) - 0.5) * 0.12)
    cena.sombras.push(contato(dormente, 0.34))
    L.push(P(dormente, mad, { eixo: QUARTO, tabua: 0, bisel: 1.1 * k, tom: 0.6, contorno: 0.3, semente: 8901 + j }))
    for (const lado of [-1, 1]) {
      L.push(P(elipse(x + (hash(j, lado, 8902) - 0.5) * 1.6 * k, lado * (hh - 1.6 * k), 3.4 * k, 2 * k), LAMA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, suave: 1.3 * k, semente: 8903 }))
    }
  })

  // As FIADAS de tábuas soltas, cada uma andando da beira da esquerda até a da direita. Primeiro o corte de cada fiada
  // (de onde a onde vai cada tábua); na do meio, uma tábua do meio falta e deixa a poça de lama à mostra.
  for (let f = 0; f < fiadas; f += 1) {
    const yc = -hh + passo * (f + 0.5)
    const cortes: Array<readonly [number, number]> = []
    let x = -hw + 0.6 + hash(f, 0, 8910) * 2 * k
    for (let i = 0; x < hw - 4 * k; i += 1) {
      let xb = Math.min(hw - 0.6, x + (TABUA_CURTA + (TABUA_COMPRIDA - TABUA_CURTA) * hash(f, i, 8911)) * g)
      if (hw - 0.6 - xb < SOBRA_MINIMA * g) xb = hw - 0.6
      cortes.push([x, xb])
      // A emenda: ou a próxima deita por cima desta (sobra um palmo), ou fica uma fresta. A que chegou ao fim fecha a
      // fiada (sem isto, numa passarela estreita a sobreposição voltava para trás do fim para sempre).
      if (xb >= hw - 0.6) break
      const junta = hash(f, i, 8930)
      x = junta > 0.72 ? xb - 2.4 * k : xb + (0.8 + 2 * junta) * k
    }
    const falta = fiadas >= 3 && f === Math.floor(fiadas / 2) && cortes.length >= 3 ? 1 + Math.floor(hash(f, 9, 8910) * (cortes.length - 2)) : -1
    if (falta >= 0) {
      const [fa, fb] = cortes[falta]
      L.push(P(elipse((fa + fb) / 2, yc, (fb - fa) * 0.38, largura * 0.4), LAMA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, suave: 2 * k, semente: 8909 }))
    }
    cortes.forEach(([x, xb], i) => {
      if (i === falta) return
      const ang = (hash(f, i, 8912) - 0.5) * 0.05
      const dy = (hash(f, i, 8913) - 0.5) * 1.6 * k
      const lw = largura * (0.86 + 0.14 * hash(f, i, 8914))
      const [y0, y1] = [yc + dy - lw / 2, yc + dy + lw / 2]
      const [mx, my] = [(x + xb) / 2, yc + dy]
      const torta = (forma: Forma): Forma => girar(forma, mx, my, ang)
      const tabua = torta(caixa(x, y0, xb, y1, 0.7 * k))
      cena.sombras.push(contato(tabua, 0.3))
      const sem = 8920 + f * 40 + i
      L.push(P(tabua, mad, { eixo: ang, tabua: 0, bisel: 1 * k, tom: 0.84 + 0.22 * hash(f, i, 8915), contorno: 0.26, semente: sem, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.6 * k } }))
      // A beira de baixo molhada e um respingo de lama perto de uma das pontas.
      L.push(P(torta(caixa(x + 0.6, y1 - 1.3 * k, xb - 0.6, y1 - 0.2, 0.4 * k)), LAMA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 0.8 * k, semente: sem }))
      const pontaDaLama = hash(f, i, 8916) > 0.5 ? x + 4 * k : xb - 4 * k
      L.push(P(elipse(pontaDaLama, my + (hash(f, i, 8917) - 0.5) * lw * 0.4, (2.4 + 2 * hash(f, i, 8918)) * k, lw * 0.3), LAMA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.4 * k, semente: sem }))
      // A racha numa tábua aqui e ali.
      if (hash(f, i, 8919) > 0.82) {
        const [ra, rb] = [x + (xb - x) * 0.22, x + (xb - x) * 0.58]
        L.push(P(torta(capsula(ra, my - lw * 0.12, rb, my - lw * 0.05, 0.3 * k)), RACHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: sem }))
      }
      // Os pregos onde a tábua cruza um dormente.
      for (const xd of dormentes) {
        if (xd < x + 2 * k || xd > xb - 2 * k) continue
        for (const v of [-0.28, 0.28]) L.push(P(elipse(xd, my + v * lw, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.25, semente: sem }))
      }
    })
  }
}
