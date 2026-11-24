/**
 * ÍDOLO DOURADO (lote L08 de 24/11/2026, item 74: objeto novo, o "tesouro do templo" do tema do mapa 6; desenho próprio,
 * só a ideia do objeto). Uma ESTATUETA DE OURO ANTIGO atarracada, sentada de pernas cruzadas, com as mãos na barriga, a
 * cabeça grande de OLHOS AMENDOADOS com a incrustação escura de obsidiana (o contorno no marrom do próprio ouro), a boca
 * num risco, as rodelas nas orelhas e a COROA EM DEGRAUS (a pirâmide do templo em miniatura), em cima de um PEDESTAL
 * de pedra de dois degraus com o painel rebaixado na face, o musgo em tufos no pé e umas folhas secas.
 *
 * O brilho é CONTIDO, sem estrela e sem halo: o ouro é escuro e quente (a base perto de 176, 136, 72 e os vincos
 * perto de 112, 84, 46), o realce é pequeno e só em cima à esquerda (a luz do chanfro e um brilho de metal baixo), e a
 * luz que ele devolve é DERRAMADA: um poço morno pequeno em cima do pedestal e outro no chão à frente, a 18% (emitem:
 * não escurecem na sombra). Nada atrás da cabeça. O ouro pedido (176, 128, 48) tem saturação 0,73, acima do teto de
 * 0,62 do portão dos objetos: fica o mesmo tom e a mesma luz com a saturação que o teto deixa.
 * Quem ilumina a sala é a entrada em `LUZ_DOS_OBJETOS`, que o integrador registra (sugestão no lote-L08.json).
 *
 * Para ler numa casa são poucas massas, separadas por vincos escuros: a coroa, a cabeça, o tronco com os braços e as
 * pernas cruzadas, em cima do pedestal claro.
 *
 * Figura desenhada de uma vista só, DE FRENTE: de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a sombra de baixo
 * (`EM_PE` em `tresQuartos.ts`); o giro gira a imagem inteira. O desenho é feito numa meia pegada de 28 px e escala com
 * o menor lado. Material: `pedra` (o pedestal, de partida o arenito do templo); o ouro é fixo. Escreve `cena.corDoPiso`.
 */
import { cadeia, caixa, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { acasoDoTemplo, ESCURO_DA_PEDRA_DO_TEMPLO, pedraDoTemplo, texDaPedraDoTemplo, tufoDeMusgo } from './piramideEmDegraus'

/** A meia pegada em que o ídolo é desenhado (px do protótipo). */
const MEIA_PEGADA = 28
/** O ouro antigo: a base escura e quente, o vinco no marrom do próprio ouro e a obsidiana dos olhos. */
const OURO: MaterialDaPeca = { classe: 'metal', rgb: [176, 136, 72] }
const VINCO_DO_OURO: MaterialDaPeca = { classe: 'liso', rgb: [112, 84, 46] }
const OBSIDIANA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x29, 0x26] }
/** A luz morna que o ouro derrama (o poço em cima do pedestal e o do chão à frente) e a força dela. */
const LUZ_DERRAMADA: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xc4, 0x84] }
const FORCA_DA_LUZ_DERRAMADA = 0.18
const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x80, 0x52] }
/** O brilho do metal do ouro: baixo, para o realce ficar pequeno e só do lado da luz. */
const BRILHO_DO_METAL = 0.2
/** A altura do conjunto para a sombra no chão (px no desenho de 28). */
const ALTURA_DA_SOMBRA = 26

/** A luz derramada emite: não pega a luz do chanfro nem a sombra. */
const texDaLuz: Textura = (_u, _v, _x, _y, _p, s) => {
  s[4] = 1
}

export const montarIdoloDourado: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIA_PEGADA
  if (!(k > 0)) return
  const pedra = pedraDoTemplo(c.m.pedra)
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA_DO_TEMPLO

  const cx = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => caixa(x0 * k, y0 * k, x1 * k, y1 * k, raio * k)
  const el = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * k, y * k, rx * k, ry * k)
  const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(([x, y]): Ponto => [x * k, y * k]))
  const fio = (pontos: readonly Ponto[], r: number): Forma => cadeia(pontos.map(([x, y]): Ponto => [x * k, y * k]), r * k)
  const ouro = { metal: BRILHO_DO_METAL, contorno: 0.34 }
  const vinco = (forma: Forma, semente: number, alfa = 0.92): void => {
    L.push(P(forma, VINCO_DO_OURO, { bisel: 0, contorno: 0, alfa, semente }))
  }

  cena.sombras.push({ forma: el(0, 21.5, 16, 4), z: ALTURA_DA_SOMBRA * k }, contato(el(0, 23, 19, 3.6), 0.32))

  // ---------- a LUZ DERRAMADA no chão à frente (por baixo de tudo) ----------
  L.push(P(el(0, 25.2, 16, 3.2), LUZ_DERRAMADA, { bisel: 0, contorno: 0, alfa: FORCA_DA_LUZ_DERRAMADA, suave: 2.6 * k, textura: texDaLuz, semente: 6000 }))

  // ---------- o PEDESTAL: o degrau de baixo, o dado com o painel rebaixado e a tampa ----------
  const daPedra = texDaPedraDoTemplo(0.5, 61)
  L.push(P(cx(-19, 16.5, 19, 24.5, 1.6), pedra, { bisel: 1.8 * k, tom: 0.84, contorno: 0.3, textura: daPedra, semente: 6010 }))
  L.push(P(cx(-14, 7, 14, 18, 1.2), pedra, { bisel: 1.6 * k, tom: 0.94, contorno: 0.28, textura: daPedra, semente: 6011, projeta: { dist: 1.6 * k, forca: 0.36 } }))
  L.push(P(cx(-8.4, 9.6, 8.4, 15.6, 0.8), pedra, { bisel: 0, tom: 0.72, contorno: 0.14, recesso: { k: 1 * k, forca: 0.36 }, semente: 6012 }))
  L.push(P(cx(-16, 3.4, 16, 8.4, 1.6), pedra, { bisel: 1.9 * k, tom: 1.08, contorno: 0.3, textura: daPedra, semente: 6014, projeta: { dist: 1.8 * k, forca: 0.38 } }))
  // A luz derramada em cima do pedestal, em volta do pé da estatueta.
  L.push(P(el(0, 4.6, 13, 2.2), LUZ_DERRAMADA, { bisel: 0, contorno: 0, alfa: FORCA_DA_LUZ_DERRAMADA, suave: 1.6 * k, textura: texDaLuz, semente: 6016 }))
  // O musgo em tufos de dois tons no pé e as folhas secas.
  tufoDeMusgo(L, P, -16 * k, 22.4 * k, 4.2 * k, 61, 0.5)
  tufoDeMusgo(L, P, 15.4 * k, 23.4 * k, 3.4 * k, 62, 0.5)
  tufoDeMusgo(L, P, 12 * k, 16.6 * k, 2.4 * k, 63, 0.5)
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = [-21 + 42 * acasoDoTemplo(i, 61), 23.6 + 2.2 * acasoDoTemplo(i, 62)]
    L.push(P(elipseGirada(x * k, y * k, 1.8 * k, 0.9 * k, acasoDoTemplo(i, 63) * Math.PI), FOLHA_SECA, { bisel: 0.5, contorno: 0.2, alfa: 0.85, tom: 0.86 + 0.3 * acasoDoTemplo(i, 64), semente: 6030 + i }))
  }

  // ---------- a ESTATUETA: as pernas cruzadas, o tronco, os braços e as mãos na barriga ----------
  L.push(P(uniao(el(-4.8, 1.6, 6.8, 3.1), el(4.8, 1.6, 6.8, 3.1)), OURO, { ...ouro, bisel: 2.2 * k, tom: 0.88, semente: 6040, projeta: { dist: 1.3 * k, forca: 0.4 } }))
  vinco(fio([[-0.2, -0.6], [0.4, 3.6]], 0.5), 6038)
  L.push(P(pol([[-6.6, -9], [6.6, -9], [8.8, 0.2], [6, 2.2], [-6, 2.2], [-8.8, 0.2]]), OURO, { ...ouro, bisel: 3.4 * k, tom: 0.96, semente: 6041 }))
  for (const lado of [-1, 1]) {
    L.push(P(pol([[lado * 6.2, -8.6], [lado * 10.2, -6], [lado * 10, -0.4], [lado * 6.4, 0.6]]), OURO, { ...ouro, bisel: 1.5 * k, tom: 1, semente: 6043 + lado, projeta: { dist: 0.9 * k, forca: 0.36 } }))
    vinco(fio([[lado * 6.2, -7.6], [lado * 6.6, 0]], 0.42), 6044 + lado, 0.8)
    L.push(P(el(lado * 3.2, -1.2, 3.5, 1.9), OURO, { ...ouro, bisel: 1.5 * k, tom: 1.06, semente: 6046 + lado, projeta: { dist: 0.8 * k, forca: 0.34 } }))
  }
  // O peitoral: uma placa redonda no lugar das contas miúdas (lê numa casa).
  L.push(P(el(0, -6, 2.5, 2.1), OURO, { ...ouro, bisel: 1.2 * k, tom: 1.1, contorno: 0.3, semente: 6050, projeta: { dist: 0.7 * k, forca: 0.3 } }))

  // ---------- a CABEÇA grande: as rodelas das orelhas, o rosto e a coroa em degraus ----------
  // O vinco do pescoço separa a cabeça do tronco.
  vinco(cx(-6.6, -9.6, 6.6, -8, 0.6), 6052)
  for (const lado of [-1, 1]) L.push(P(el(lado * 9, -13.4, 2.5, 3), OURO, { ...ouro, bisel: 1.4 * k, tom: 0.92, semente: 6055 + lado }))
  L.push(P(cx(-8, -20.4, 8, -8.6, 4.4), OURO, { ...ouro, bisel: 4 * k, tom: 1.02, semente: 6060, projeta: { dist: 1.3 * k, forca: 0.4 } }))
  // Os OLHOS amendoados: o contorno no marrom do ouro e a incrustação escura de obsidiana.
  for (const lado of [-1, 1]) {
    const giro = lado * -0.2
    L.push(P(elipseGirada(lado * 3.7 * k, -14.9 * k, 3 * k, 1.75 * k, giro), VINCO_DO_OURO, { bisel: 0, contorno: 0, semente: 6062 + lado }))
    L.push(P(elipseGirada(lado * 3.7 * k, -14.8 * k, 2.3 * k, 1.1 * k, giro), OBSIDIANA, { bisel: 0, contorno: 0, semente: 6064 + lado }))
  }
  L.push(P(pol([[-0.9, -15.4], [0.9, -15.4], [1.8, -11.8], [-1.8, -11.8]]), OURO, { ...ouro, bisel: 0.9 * k, tom: 1.1, contorno: 0.26, semente: 6066, projeta: { dist: 0.7 * k, forca: 0.32 } }))
  vinco(fio([[-3.2, -10.2], [0, -9.9], [3.2, -10.2]], 0.5), 6067)
  // A coroa: três degraus, cada um mais estreito, separados pela sombra do de cima.
  L.push(P(cx(-9.6, -22.6, 9.6, -19, 0.9), OURO, { ...ouro, bisel: 1.5 * k, tom: 1.04, semente: 6070, projeta: { dist: 1.2 * k, forca: 0.42 } }))
  L.push(P(cx(-6.4, -25.4, 6.4, -21.8, 0.9), OURO, { ...ouro, bisel: 1.5 * k, tom: 1.08, semente: 6071, projeta: { dist: 1 * k, forca: 0.36 } }))
  L.push(P(cx(-3.3, -28, 3.3, -24.6, 0.9), OURO, { ...ouro, bisel: 1.4 * k, tom: 1.12, semente: 6072, projeta: { dist: 0.9 * k, forca: 0.34 } }))
  L.push(P(el(0, -20.8, 1.3, 1.3), OBSIDIANA, { bisel: 0, contorno: 0, alfa: 0.9, recesso: { k: 0.5 * k, forca: 0.3 }, semente: 6073 }))
}
