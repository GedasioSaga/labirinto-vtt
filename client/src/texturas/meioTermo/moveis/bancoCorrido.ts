/**
 * BANCO CORRIDO de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão de refeitório dos bancos de
 * capela, `bancosDeCapela.ts`). O banco comprido de tábua, SEM ENCOSTO, em que se senta de lado e de costas para a
 * mesa: o ASSENTO de duas tábuas grossas ao comprido, com a fresta no meio e as pontas boleadas; por baixo, os PÉS de
 * cavalete, uma tábua de través em cada ponta (e mais no meio quando o banco é comprido), que sai um pouco para fora do
 * assento dos dois lados, como pé aberto. Gasto de uso: o claro polido onde as pessoas sentam, os riscos de faca, um nó
 * e os pregos em cima de cada pé.
 *
 * A 25% de zoom sobram a faixa comprida e clara do assento e os tocos escuros dos pés saindo dos dois lados: banco de
 * refeitório (o de capela tem encosto, cabeceira com voluta e genuflexório).
 *
 * Na 3/4 (DERIVADO) o assento é o tampo no ar e cada pé é uma coluna debaixo dele; as pontas que saem do assento ficam
 * no chão, abertas. Esticado ao comprido, o banco ganha mais pés (um a cada `VAO_ENTRE_PES` casa) e mais lugares
 * gastos. Material: `madeira` (o carvalho de partida). As medidas saem da largura do banco (0,45 casa de partida).
 */
import { hash } from '../../ruido'
import { caixa, capsula, elipse, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, PREGO, QUARTO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'

/** A altura do assento (casas). */
const ALTURA_DO_ASSENTO = 0.3
/** O assento recua das beiras de cima e de baixo (fração da largura): ali aparecem os pés abertos. */
const RECUO_DO_ASSENTO = 0.15
/** De um pé ao outro, no máximo (casas), e quanto o pé da ponta fica para dentro (casas). */
const VAO_ENTRE_PES = 1.5
const PE_PARA_DENTRO = 0.17
/** Um lugar gasto a cada tanto de casa. */
const PASSO_DO_LUGAR = 0.55
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x24] }

export const montarBancoCorrido: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const k = Math.min(h / (0.45 * G), w / (2 * G))
  const zS = g * ALTURA_DO_ASSENTO
  const [x0, x1] = [-hw + 0.6, hw - 0.6]
  const [y0, y1] = [-hh + RECUO_DO_ASSENTO * h, hh - RECUO_DO_ASSENTO * h]
  const ym = (y0 + y1) / 2
  const assento = caixa(x0, y0, x1, y1, 1.8 * k)

  // Os PÉS: onde ficam, ao comprido. Os das pontas um pouco para dentro; no meio, quantos o comprimento pedir.
  const xPonta = hw - PE_PARA_DENTRO * g
  const vaos = Math.max(1, Math.ceil((2 * xPonta) / (VAO_ENTRE_PES * g)))
  const pes = Array.from({ length: vaos + 1 }, (_, i) => -xPonta + (2 * xPonta * i) / vaos)
  const meioPe = 2.3 * k

  // As sombras: o assento no ar, o escuro do chão debaixo dele, a coluna de cada pé e o contato das pontas no chão.
  cena.sombras.push({ forma: assento, z: zS, solta: true }, { forma: caixa(x0 + 2, y0, x1 - 2, y1 + 1.2, 1.5), z: 0, suave: 1.6, forca: 0.26 })
  // Os pés um nada mais baixos que o assento: na 3/4 o tampo fica com as tábuas (a coluna mais alta ganha o meio
  // delas) e é pintado depois dos pés, por cima da frente deles.
  for (const x of pes) {
    cena.sombras.push({ forma: caixa(x - meioPe, y0, x + meioPe, y1, 0.6), z: zS - 0.6, forca: 0.28 })
    for (const [a, b] of [[-hh, y0 + 0.6], [y1 - 0.6, hh]] as const) cena.sombras.push(contato(caixa(x - meioPe - 0.4, a, x + meioPe + 0.4, b, 0.6), 0.34))
  }

  // As PONTAS DOS PÉS que saem do assento, no chão: a tábua de través, mais escura, um nada aberta para fora.
  pes.forEach((x, i) => {
    for (const [a, b, abre] of [[-hh + 0.3, y0 + 0.8, -1], [y1 - 0.8, hh - 0.3, 1]] as const) {
      const pe: Forma = girar(caixa(x - meioPe, a, x + meioPe, b, 0.5), x, (a + b) / 2, abre * 0.06)
      L.push(P(pe, mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.74, contorno: 0.3, semente: 8601 + i * 2 + (abre + 1) / 2 }))
    }
  })

  // O ASSENTO: a fresta escura (só a tira do meio: a maior peça do móvel tem de ser tábua, que é o material da frente
  // dos pés na 3/4) e as duas tábuas, cada uma no tom dela, com o veio ao comprido.
  const fresta = 0.35 * k
  L.push(P(caixa(x0 + 1, ym - fresta - 0.4, x1 - 1, ym + fresta + 0.4), VAO, { tabua: 0, bisel: 0, contorno: 0, semente: 8610 }))
  const sombraNosPes = { dist: 1.4 * k, forca: 0.3, suave: 1 * k }
  L.push(P(caixa(x0, y0, x1, ym - fresta, 1.8 * k), mad, { eixo: 0, tabua: 0, bisel: 1.3 * k, tom: 1.02, contorno: 0.24, semente: 8611, projeta: sombraNosPes }))
  L.push(P(caixa(x0 + 0.4, ym + fresta, x1 - 0.2, y1, 1.8 * k), mad, { eixo: 0, tabua: 0, bisel: 1.5 * k, tom: 0.95, contorno: 0.24, semente: 8612, projeta: sombraNosPes }))

  // Os LUGARES gastos: o claro polido de quem senta, mais forte no meio de cada lugar.
  const lugares = Math.max(1, Math.round((x1 - x0) / (PASSO_DO_LUGAR * g)))
  for (let i = 0; i < lugares; i += 1) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / lugares + (hash(i, 2, 8620) - 0.5) * 3 * k
    L.push(P(elipse(x, ym + 0.4 * k, ((x1 - x0) / lugares) * 0.3, (y1 - y0) * 0.3), mad, { tabua: 0, bisel: 0, contorno: 0, tom: 1.16, alfa: 0.3, suave: 3.2 * k, semente: 8621 + i }))
  }

  // Os RISCOS de faca (curtos, em ângulos soltos) e um NÓ na tábua de cima.
  const riscos = Math.max(3, Math.round((x1 - x0) / (0.42 * g)))
  for (let i = 0; i < riscos; i += 1) {
    const x = x0 + 5 * k + (x1 - x0 - 10 * k) * hash(i, 7, 8630)
    const y = y0 + 2 * k + (y1 - y0 - 4 * k) * hash(i, 8, 8630)
    const ang = (hash(i, 9, 8630) - 0.5) * 1.6
    const l = (1.6 + 2.2 * hash(i, 10, 8630)) * k
    L.push(P(capsula(x - Math.cos(ang) * l, y - Math.sin(ang) * l, x + Math.cos(ang) * l, y + Math.sin(ang) * l, 0.22 * k), VAO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.42, semente: 8631 + i }))
  }
  const xNo = x0 + (x1 - x0) * 0.31
  L.push(P(elipse(xNo, y0 + (ym - y0) * 0.48, 2.2 * k, 1.1 * k), mad, { tabua: 0, bisel: 0.4, tom: 0.62, contorno: 0.12, semente: 8640 }))

  // Os PREGOS em cima de cada pé: dois por tábua.
  for (const x of pes) {
    for (const y of [y0 + (ym - y0) * 0.5, ym + (y1 - ym) * 0.5]) {
      for (const dx of [-1.1 * k, 1.1 * k]) L.push(P(elipse(x + dx, y, 0.55, 0.55), PREGO, { bisel: 0.5, contorno: 0, metal: 0.25, semente: 8650 }))
    }
  }
}
