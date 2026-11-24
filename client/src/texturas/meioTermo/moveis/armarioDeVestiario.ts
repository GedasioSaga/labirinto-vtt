/**
 * ARMÁRIO DE VESTIÁRIO de cima com volume (lote L10 de 24/11/2026, presídio moderno; versão do armário de ferro):
 * a fileira de QUATRO armários estreitos de aço, um por preso, pintados de cinza-azulado de repartição. De cima
 * aparecem o tampo de chapa com a dobra em volta e a junta entre um armário e outro, a TOALHA dobrada em cima do
 * segundo e a CAIXA de sapato em cima do quarto; na beira da frente despontam os puxadores.
 *
 * NA 3/4 A FRENTE É DESENHADA (`soNaTresQuartos`, sem giro): as quatro portas estreitas, cada uma com as VENEZIANAS
 * de respiro em cima e embaixo (a fresta escura e a aba clara que pega a luz, de contraste baixo para não listrar a
 * porta), a PLAQUINHA com o número (1 a 4, em
 * traço de sete segmentos), o PUXADOR de alavanca e, em três delas, o CADEADO de latão no ferrolho; as dobradiças do
 * outro lado e o rodapé escuro. O corpo é uma coluna do chão ao tampo, e a caixa de sapato sobe num tampo solto
 * (a beirada dela é a lateral do papelão). Com giro a frente desenhada some e a 3/4 mostra a lateral ou as costas
 * lisas, que é o que se veria; o puxador visto de cima sobe num pino na altura dele.
 *
 * Uma porta a cada `LARGURA_DA_PORTA` casas (quatro no tamanho de partida, 1 x 0,4). Sem material escolhido: a
 * pintura, o cromo, o latão, a toalha e o papelão são fixos.
 */
import type { Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import { pino, solta } from './andaimeDaTresQuartos'
import { soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** A pintura do aço: cinza-azulado de repartição (saturação HSV ~0,17), metal fosco. */
const PINTURA: MaterialDaPeca = { classe: 'metal', rgb: [0x6c, 0x7a, 0x83] }
/** O rodapé, o fundo das venezianas e das juntas: a pintura bem escura. */
const ESCURO_DA_PINTURA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x41, 0x46] }
const CROMO: MaterialDaPeca = { classe: 'metal', rgb: [0xb6, 0xb8, 0xb4] }
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xa3, 0x8b, 0x57] }
const CARTAO: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xd7, 0xc8] }
const TINTA_DO_NUMERO: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x3d, 0x40] }
/** A toalha (algodão cru) com as listras, e o papelão da caixa de sapato. */
const TOALHA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xd8, 0xd3, 0xc5] }
const LISTRA: MaterialDaPeca = { classe: 'liso', rgb: [0x6f, 0x80, 0x8c] }
const PAPELAO: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0x8c, 0x66] }
/** O escuro em que o pixel escuro demais é levantado: o cinza-azulado escuro da pintura. */
const ESCURO_DO_ARMARIO: Rgb = [0x42, 0x49, 0x4e]

/** A altura do armário (1,8 m), uma porta a cada tanto de largura (casas), o rodapé (casas). */
const ALTURA = 1.2
const LARGURA_DA_PORTA = 0.25
const ALTURA_DO_RODAPE = 0.07
/** A dobra da chapa em volta do tampo e a meia junta entre dois armários (px). */
const DOBRA = 1.6
const MEIA_JUNTA = 0.35
/** As venezianas: quantas aletas em cima e embaixo, o passo, o recuo dos lados e onde começam (px). */
const ALETAS_DE_CIMA = 5
const ALETAS_DE_BAIXO = 4
const PASSO_DA_ALETA = 2.3
const RECUO_DA_ALETA = 3
/**
 * O contraste das venezianas, 25% mais baixo que o da primeira prova (lá elas listravam a porta): a cobertura da
 * fresta escura e o tom da aba clara (a porta tem o tom 0,86).
 */
const VENEZIANA = { fresta: 0.68, aba: 1.025 } as const
/** O puxador: a altura (fração do armário) e a distância da beira da porta (px). */
const ALTURA_DO_PUXADOR = 0.52
const PUXADOR_DA_BEIRA = 2.5
/** A plaquinha do número: quanto desce do alto (px). */
const PLACA_DO_ALTO = 18
/** A caixa de sapato sobe isto acima do tampo (px). */
const ALTURA_DA_CAIXA = 3.4

/** Os sete segmentos de cada algarismo (a em cima, b e c à direita, d embaixo, e e f à esquerda, g no meio). */
const SEGMENTOS: Readonly<Record<string, string>> = { 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc' }

/** A mesma forma com a base da caixa em `base` (só para baixo): sai depois na ordem da 3/4 sem alargar a imagem. */
function comBaseEm(f: Forma, base: number): Forma {
  return { b: [f.b[0], f.b[1], f.b[2], Math.max(f.b[3], base)], d: f.d }
}

/** O algarismo em traço de sete segmentos, de meia largura `mx` e meia altura `my`, em volta de (cx, cy). */
function algarismo(n: number, cx: number, cy: number, mx: number, my: number, r: number): Forma | null {
  const pontas: Readonly<Record<string, readonly [number, number, number, number]>> = {
    a: [-mx, -my, mx, -my], b: [mx, -my, mx, 0], c: [mx, 0, mx, my], d: [-mx, my, mx, my], e: [-mx, 0, -mx, my], f: [-mx, -my, -mx, 0], g: [-mx, 0, mx, 0],
  }
  const tracos = [...(SEGMENTOS[String(n)] ?? '')].map((s) => {
    const [ax, ay, bx, by] = pontas[s]
    return capsula(cx + ax, cy + ay, cx + bx, cy + by, r)
  })
  return tracos.length === 0 ? null : tracos.reduce(uniao)
}

export const montarArmarioDeVestiario: MontarMovel = (c, cena) => {
  const { hw, hh, w, g, peca: P } = c
  cena.corDoPiso = ESCURO_DO_ARMARIO
  const H = ALTURA * g
  const portas = Math.max(1, Math.round(w / (LARGURA_DA_PORTA * g)))
  const larguraDaPorta = w / portas
  const corpo = caixa(-hw, -hh, hw, hh, 0.9)
  cena.sombras.push({ forma: corpo, z: H }, contato(corpo, 0.32))
  const L = cena.partes
  const liso = { tabua: 0, bisel: 0, contorno: 0 }
  const pintura = { tabua: 0, metal: 0.25 }
  const meioDaPorta = (p: number): number => -hw + larguraDaPorta * (p + 0.5)
  const xDoPuxador = (p: number): number => -hw + larguraDaPorta * (p + 1) - PUXADOR_DA_BEIRA

  // O TAMPO: a chapa com a dobra em volta e a junta entre os armários.
  L.push(P(corpo, PINTURA, { ...pintura, bisel: 1.5, contorno: 0.3, semente: 10001 }))
  L.push(P(caixa(-hw + DOBRA, -hh + DOBRA, hw - DOBRA, hh - DOBRA, 0.6), PINTURA, { ...pintura, bisel: 0.6, contorno: 0.1, tom: 0.95, semente: 10002 }))
  for (let k = 1; k < portas; k += 1) {
    const x = -hw + larguraDaPorta * k
    L.push(P(caixa(x - MEIA_JUNTA, -hh + 0.5, x + MEIA_JUNTA, hh - 0.5), ESCURO_DA_PINTURA, { ...liso, alfa: 0.75, semente: 10003 + k }))
  }

  // A TOALHA dobrada em cima do segundo armário: o pano grosso, a dobra clara e as duas listras de uma ponta.
  if (portas >= 2) {
    const xm = meioDaPorta(1)
    const mx = Math.min(4.6, larguraDaPorta * 0.36)
    L.push(P(caixa(xm - mx, -hh + 3, xm + mx, hh - 3.2, 1.6), TOALHA, { bisel: 1.6, ruga: 0.8, contorno: 0.2, semente: 10010, projeta: { dist: 0.9, forca: 0.3, suave: 1 } }))
    for (const y of [hh - 6.4, hh - 5.2]) L.push(P(caixa(xm - mx + 0.3, y - 0.3, xm + mx - 0.3, y + 0.3), LISTRA, { ...liso, alfa: 0.55, semente: 10011 }))
    L.push(P(capsula(xm - mx + 0.8, -hh + 3.8, xm + mx - 0.8, -hh + 3.8, 0.45), TOALHA, { ...liso, tom: 1.08, alfa: 0.7, suave: 0.4, semente: 10012 }))
  }
  // A CAIXA DE SAPATO em cima do último: sobe num tampo solto (a beirada é a lateral de papelão).
  if (portas >= 3) {
    const xm = meioDaPorta(portas - 1)
    const mx = Math.min(5.4, larguraDaPorta * 0.42)
    const tampa = caixa(xm - mx, -hh + 2.4, xm + mx, hh - 2.6, 0.5)
    // A base da caixa de pintura passa da frente do corpo: na 3/4 a caixa sai depois do tampo, e não debaixo dele.
    cena.sombras.push({ forma: comBaseEm(tampa, hh + 0.1), z: H + ALTURA_DA_CAIXA, solta: true, forca: 0 })
    L.push(P(tampa, PAPELAO, { tabua: 0, bisel: 0.5, contorno: 0.28, semente: 10020, projeta: { dist: 1.2, forca: 0.32, suave: 0.8 } }))
    L.push(P(caixa(xm - mx + 1, -hh + 3.4, xm + mx - 1, hh - 3.6, 0.3), PAPELAO, { tabua: 0, bisel: 0.3, contorno: 0.12, tom: 1.06, semente: 10021 }))
    L.push(P(caixa(xm + mx - 4.2, hh - 6.4, xm + mx - 1.6, hh - 4.6, 0.2), CARTAO, { tabua: 0, bisel: 0.2, contorno: 0.16, semente: 10022 }))
  }

  // Os puxadores despontando na beira da frente: cada um num pino na altura dele (na 3/4 cai no puxador desenhado).
  const zPuxador = ALTURA_DO_PUXADOR * H
  for (let p = 0; p < portas; p += 1) {
    const xp = xDoPuxador(p)
    cena.sombras.push(solta(pino(xp, hh + 0.3), zPuxador))
    L.push(P(caixa(xp - 0.7, hh - 0.25, xp + 0.7, hh + 0.85, 0.3), CROMO, { tabua: 0, bisel: 0.4, contorno: 0.26, metal: 0.6, semente: 10030 + p }))
  }

  // A FRENTE, que só a 3/4 vê (o chão da frente em hh, para cima negativo).
  const topo = hh - H
  const rodape = ALTURA_DO_RODAPE * g
  const frente: PecaDaTela[] = [
    { forma: caixa(-hw + 0.4, hh - rodape, hw - 0.4, hh - 0.15, 0.3), mat: ESCURO_DA_PINTURA, o: { tabua: 0, bisel: 0.3, contorno: 0.2, semente: 10040 } },
  ]
  const yPuxador = hh - zPuxador
  for (let p = 0; p < portas; p += 1) {
    const x0 = -hw + larguraDaPorta * p
    const x1 = x0 + larguraDaPorta
    const xm = (x0 + x1) / 2
    const xp = xDoPuxador(p)
    const recuo = Math.min(RECUO_DA_ALETA, larguraDaPorta * 0.22)
    frente.push({ forma: caixa(x0 + 0.55, topo + 1.2, x1 - 0.55, hh - rodape - 0.5, 0.5), mat: PINTURA, o: { ...pintura, bisel: 0.6, tom: 0.86, contorno: 0.24, semente: 10041 + p } })
    const aleta = (y: number): void => {
      frente.push({ forma: caixa(x0 + recuo, y - 0.42, x1 - recuo, y + 0.42, 0.35), mat: ESCURO_DA_PINTURA, o: { ...liso, alfa: VENEZIANA.fresta, semente: 10050 } })
      frente.push({ forma: caixa(x0 + recuo, y + 0.42, x1 - recuo, y + 0.9, 0.2), mat: PINTURA, o: { ...liso, tom: VENEZIANA.aba, semente: 10051 } })
    }
    for (let a = 0; a < ALETAS_DE_CIMA; a += 1) aleta(topo + 5 + a * PASSO_DA_ALETA)
    for (let a = 0; a < ALETAS_DE_BAIXO; a += 1) aleta(hh - rodape - 4 - a * PASSO_DA_ALETA)
    // A plaquinha com o número.
    const yPlaca = topo + PLACA_DO_ALTO
    frente.push({ forma: caixa(xm - 2.6, yPlaca - 1.7, xm + 2.6, yPlaca + 1.7, 0.3), mat: CARTAO, o: { tabua: 0, bisel: 0.3, contorno: 0.26, semente: 10060 } })
    const numero = algarismo(p + 1, xm, yPlaca, 0.75, 1.1, 0.24)
    if (numero !== null) frente.push({ forma: numero, mat: TINTA_DO_NUMERO, o: { ...liso, alfa: 0.9, semente: 10061 } })
    // As dobradiças do lado de lá e o puxador de alavanca na sua cova.
    for (const y of [yPuxador - H * 0.3, yPuxador + H * 0.3]) frente.push({ forma: caixa(x0 + 0.7, y - 1.3, x0 + 1.3, y + 1.3, 0.2), mat: ESCURO_DA_PINTURA, o: { ...liso, alfa: 0.6, semente: 10062 } })
    frente.push({ forma: caixa(xp - 1, yPuxador - 3.8, xp + 1, yPuxador + 3.8, 0.5), mat: ESCURO_DA_PINTURA, o: { ...liso, alfa: 0.35, suave: 0.3, semente: 10063 } })
    frente.push({ forma: capsula(xp, yPuxador - 3, xp, yPuxador + 3, 0.6), mat: CROMO, o: { tabua: 0, bisel: 0.5, contorno: 0.26, metal: 0.65, semente: 10064 } })
    // O cadeado de latão no ferrolho (um dos armários está sem).
    if (p % 4 !== 1) {
      const y = yPuxador + 4.6
      frente.push({ forma: cadeia([[xp - 0.75, y + 0.3], [xp - 0.75, y - 1], [xp + 0.75, y - 1], [xp + 0.75, y + 0.3]], 0.3), mat: CROMO, o: { tabua: 0, bisel: 0.2, contorno: 0.26, metal: 0.6, semente: 10065 } })
      frente.push({ forma: caixa(xp - 1.3, y, xp + 1.3, y + 3, 0.9), mat: LATAO, o: { tabua: 0, bisel: 0.7, contorno: 0.28, metal: 0.55, semente: 10066 } })
      frente.push({ forma: elipse(xp, y + 1.7, 0.3, 0.45), mat: ESCURO_DA_PINTURA, o: { ...liso, alfa: 0.8, semente: 10067 } })
    }
  }
  soNaTresQuartos(P, cena, 0, hh + 1.2, frente)
}
