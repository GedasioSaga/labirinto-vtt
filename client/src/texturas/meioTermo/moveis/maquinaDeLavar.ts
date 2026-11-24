/**
 * MÁQUINA DE LAVAR de cima com volume (lote L10 de 24/11/2026, presídio moderno; objeto novo): a lavadora
 * INDUSTRIAL da lavanderia, de abrir pela frente, toda de inox escovado. De cima aparecem o tampo com a caixa do sabão
 * de quatro tampinhas (atrás, à esquerda) e a grade de respiro (atrás, à direita), os parafusos dos cantos e, na
 * frente, o PAINEL escuro um degrau mais alto: o seletor redondo, o visor verde apagado marcando 40, os quatro botões
 * e o botão vermelho de EMERGÊNCIA no aro amarelo. Na beira da frente desponta o aro de cromo da porta redonda.
 *
 * NA 3/4 A FRENTE É DESENHADA (`soNaTresQuartos`, sem giro): a PORTA REDONDA de vidro no aro grosso de cromo, a
 * borracha, o tambor furadinho lá dentro com a roupa caída no fundo (o cáqui e o cinza do uniforme), o reflexo curvo
 * do vidro, a dobradiça à esquerda, o puxador à direita, a etiqueta de instruções e o rodapé com o respiro. O corpo é
 * uma coluna do chão ao tampo; o painel, outra um degrau mais alta (a beirada dele aparece em cima da frente); o aro
 * visto de cima sobe num pino até o alto da porta. Com giro a frente desenhada some e a 3/4 mostra a lateral ou as
 * costas lisas, que é o que se veria. Várias em fila fazem a lavanderia.
 *
 * Sem material escolhido: o inox, o cromo, o painel e a roupa são fixos.
 */
import { anel, caixa, capsula, dentroDe, elipse, uniao, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { pino, solta } from './andaimeDaTresQuartos'
import { ESCURO, ESCURO_DO_INOX, INOX, texEscovado } from './geladeira'
import { BRILHO_DO_CROMO, CROMO, REFLEXO, VIDRO, soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** A altura da máquina (1,4 m) e o degrau do painel acima do tampo, em casas. */
const ALTURA = 0.95
const DEGRAU_DO_PAINEL = 0.045
/** O quanto a porta sai da frente do corpo (px) e a fundura do painel de cima (px). */
const SAIDA_DA_PORTA = 2.4
const FUNDURA_DO_PAINEL = 12
/** A porta: o raio do aro, a grossura do cromo e da borracha (px) e a altura do meio (fração da altura). */
const PORTA = { raio: 16.5, cromo: 3.6, borracha: 1.4, meio: 0.46 } as const
/** O passo dos furos do tambor e o raio de cada furo (px). */
const FURO = { passo: 1.8, raio: 0.36 } as const
const BRILHO_DO_ACO = 0.38

/** O painel (plástico grafite), a borracha, o visor de cristal líquido apagado, o tambor e as tintas do painel. */
const GRAFITE: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x5d, 0x61] }
const BORRACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x3c, 0x3e] }
const VISOR: MaterialDaPeca = { classe: 'liso', rgb: [0x78, 0x88, 0x6f] }
const TINTA_DO_VISOR: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x45, 0x3a] }
const TAMBOR: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x72, 0x76] }
const VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0xa3, 0x55, 0x4b] }
const AMARELO: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0xa3, 0x5c] }
const ETIQUETA: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xc9, 0x9e] }
/** A roupa no tambor: o cáqui alaranjado do uniforme e uma peça cinza. */
const UNIFORME: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa6, 0x7c, 0x5c] }
const CINZA_DA_ROUPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x8c, 0x90, 0x93] }

/** Os sete segmentos de cada algarismo do visor (a em cima, b e c à direita, d embaixo, e e f à esquerda, g no meio). */
const SEGMENTOS: Readonly<Record<string, string>> = { 0: 'abcdef', 4: 'fgbc' }

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

/** O tambor visto pelo vidro: a chapa furadinha, mais escura para a beira (é fundo e côncavo). */
function texturaDoTambor(cx: number, cy: number, raio: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const fx = (x + 1000) / FURO.passo
    const fy = (y + 1000) / FURO.passo + (Math.floor(fx) % 2) * 0.5
    const dx = (fx - Math.round(fx)) * FURO.passo
    const dy = (fy - Math.round(fy)) * FURO.passo
    const furo = Math.max(0, Math.min(1, (FURO.raio + 0.5 / escala - Math.hypot(dx, dy)) * escala))
    const r = Math.hypot(x - cx, y - cy) / raio
    s[3] += furo * 0.16 - r * r * 0.28 + ruido(x * 0.3, y * 0.3) * 0.02
  }
}

export const montarMaquinaDeLavar: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = ESCURO_DO_INOX
  const H = g * ALTURA
  const yFrente = hh - SAIDA_DA_PORTA
  const corpo = caixa(-hw + 0.6, -hh + 0.6, hw - 0.6, yFrente, 1.6)
  const painel = caixa(-hw + 0.6, yFrente - FUNDURA_DO_PAINEL, hw - 0.6, yFrente, 1.2)
  const yPorta = yFrente - H * PORTA.meio
  const R = PORTA.raio
  // O aro visto de cima, na beira da frente: sobe num pino até o alto da porta.
  const yAro = hh - 1.3
  const zAro = yAro - (yPorta - R)
  cena.sombras.push({ forma: corpo, z: H }, { forma: painel, z: H + g * DEGRAU_DO_PAINEL, forca: 0.1 }, contato(corpo, 0.34), solta(pino(0, yAro), zAro))

  const L = cena.partes
  const aco = { tabua: 0, metal: BRILHO_DO_ACO, textura: texEscovado }
  const cromo = { tabua: 0, metal: BRILHO_DO_CROMO }
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  // O TAMPO escovado, os parafusos dos cantos, a caixa do sabão com as quatro tampinhas e a grade de respiro.
  L.push(P(corpo, INOX, { ...aco, eixo: 0, bisel: 1.6, contorno: 0.28, semente: 10201 }))
  for (const sx of [-1, 1]) {
    for (const y of [-hh + 2.2, yFrente - FUNDURA_DO_PAINEL - 2]) L.push(P(elipse(sx * (hw - 2.2), y, 0.7, 0.7), ESCURO, { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 1.3, semente: 10202 }))
  }
  const [cx0, cx1] = [-hw + 4.2, -hw + 23]
  const [cy0, cy1] = [-hh + 4, -hh + 14]
  L.push(P(caixa(cx0, cy0, cx1, cy1, 1.2), INOX, { ...aco, eixo: 0, bisel: 0.6, tom: 0.9, contorno: 0.26, recesso: { k: 1, forca: 0.2 }, semente: 10203 }))
  const tampinha = (cx1 - cx0 - 1.2) / 4
  for (let k = 0; k < 4; k += 1) {
    const x0 = cx0 + 0.6 + k * tampinha
    L.push(P(caixa(x0 + 0.3, cy0 + 1, x0 + tampinha - 0.3, cy1 - 0.8, 0.6), INOX, { ...aco, eixo: QUARTO, bisel: 0.6, tom: 1.04, contorno: 0.24, semente: 10204 + k, projeta: { dist: 0.4, forca: 0.2 } }))
    L.push(P(caixa(x0 + 0.8, cy0 + 1.4, x0 + tampinha - 0.8, cy0 + 1.9), ESCURO, { ...liso, alfa: 0.45, semente: 10208 }))
    L.push(P(elipse(x0 + tampinha / 2, cy1 - 2.6, 0.55, 0.55), ESCURO, { ...liso, alfa: 0.35 + k * 0.1, semente: 10209 }))
  }
  for (let k = 0; k < 7; k += 1) {
    const x = 6 + k * 2.2
    L.push(P(caixa(x, -hh + 4.5, x + 0.8, -hh + 13, 0.3), ESCURO, { tabua: 0, bisel: 0, contorno: 0.1, alfa: 0.72, semente: 10210 }))
  }

  // O PAINEL, um degrau acima: o seletor, o visor marcando 40, os quatro botões e o botão de emergência.
  const yP = yFrente - FUNDURA_DO_PAINEL / 2
  L.push(P(caixa(-hw + 1.2, yFrente - FUNDURA_DO_PAINEL + 0.6, hw - 1.2, yFrente - 0.6, 1), GRAFITE, { tabua: 0, bisel: 0.8, contorno: 0.26, semente: 10220, projeta: { dist: 0.5, forca: 0.22 } }))
  L.push(P(elipse(-17, yP, 3.4, 3.4), INOX, { ...cromo, bisel: 1.8, contorno: 0.3, semente: 10221, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(capsula(-17, yP, -15.6, yP - 2.2, 0.35), ESCURO, { ...liso, alfa: 0.8, semente: 10222 }))
  for (let k = 0; k < 6; k += 1) {
    const a = -Math.PI * 0.9 + (k * Math.PI * 0.8) / 5
    L.push(P(elipse(-17 + Math.cos(a) * 4.5, yP + Math.sin(a) * 4.5, 0.3, 0.3), REFLEXO, { ...liso, alfa: 0.55, semente: 10223 }))
  }
  L.push(P(caixa(-10.5, yP - 2.2, -0.5, yP + 2.2, 0.4), VISOR, { tabua: 0, bisel: 0.3, contorno: 0.3, recesso: { k: 0.6, forca: 0.25 }, semente: 10224 }))
  for (const [n, x] of [[4, -7.6], [0, -4.6]] as const) {
    const traco = algarismo(n, x, yP, 0.8, 1.3, 0.22)
    if (traco !== null) L.push(P(traco, TINTA_DO_VISOR, { ...liso, alfa: 0.85, semente: 10225 }))
  }
  for (let k = 0; k < 4; k += 1) {
    const x = 3 + k * 3
    L.push(P(elipse(x, yP + 0.6, 1.1, 1.1), GRAFITE, { tabua: 0, bisel: 0.7, tom: 1.3, contorno: 0.28, semente: 10226 + k }))
  }
  L.push(P(elipse(3, yP - 2.4, 0.45, 0.45), AMARELO, { ...liso, tom: 1.1, semente: 10230 }))
  L.push(P(elipse(19.5, yP, 3.3, 3.3), AMARELO, { tabua: 0, bisel: 0.6, contorno: 0.28, semente: 10231 }))
  L.push(P(elipse(19.5, yP, 2.3, 2.3), VERMELHO, { tabua: 0, bisel: 1.8, contorno: 0.3, semente: 10232, projeta: { dist: 0.7, forca: 0.3 } }))

  // O aro de cromo da porta despontando na beira da frente (sobe no pino até o alto da porta).
  L.push(P(dentroDe(elipse(0, yAro, R, 1.9), caixa(-R, yFrente - 0.6, R, hh)), CROMO, { ...cromo, bisel: 0.9, contorno: 0.3, semente: 10240 }))

  // A FRENTE, que só a 3/4 vê (o chão da frente em `yFrente`, para cima negativo).
  const topo = yFrente - H
  const rTambor = R - PORTA.cromo - PORTA.borracha
  const tambor = elipse(0, yPorta, rTambor, rTambor)
  const roupa = dentroDe(uniao(uniao(elipse(-3.5, yPorta + rTambor * 0.78, rTambor * 0.62, rTambor * 0.36), elipse(5, yPorta + rTambor * 0.7, rTambor * 0.42, rTambor * 0.3)), elipse(-7.5, yPorta + rTambor * 0.5, rTambor * 0.3, rTambor * 0.22)), tambor)
  const frente: PecaDaTela[] = [
    { forma: caixa(-hw + 1.1, topo + 0.6, hw - 1.1, yFrente - 0.2, 1.2), mat: INOX, o: { ...aco, eixo: QUARTO, bisel: 0.6, tom: 0.8, contorno: 0.2, semente: 10250 } },
    { forma: caixa(-hw + 1.1, yFrente - 4.6, hw - 1.1, yFrente - 0.2, 0.6), mat: GRAFITE, o: { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.24, semente: 10251 } },
    { forma: caixa(13, topo + 8.5, 23, topo + 15, 0.4), mat: ETIQUETA, o: { tabua: 0, bisel: 0.3, contorno: 0.24, semente: 10252 } },
    { forma: elipse(0.9, yPorta + 1.5, R + 0.6, R + 0.6), mat: ESCURO, o: { ...liso, alfa: 0.28, suave: 1.6, semente: 10253 } },
    { forma: caixa(-R - 2.4, yPorta - 5.5, -R + 0.6, yPorta + 5.5, 1), mat: CROMO, o: { ...cromo, bisel: 0.8, contorno: 0.28, tom: 0.92, semente: 10254 } },
    { forma: anel(0, yPorta, R, R, R - PORTA.cromo, R - PORTA.cromo), mat: CROMO, o: { ...cromo, bisel: 1.6, contorno: 0.28, semente: 10255 } },
    { forma: anel(0, yPorta, R - PORTA.cromo + 0.2, R - PORTA.cromo + 0.2, rTambor, rTambor), mat: BORRACHA, o: { tabua: 0, bisel: 0.6, contorno: 0.2, semente: 10256 } },
    { forma: tambor, mat: TAMBOR, o: { tabua: 0, bisel: 0, contorno: 0.2, textura: texturaDoTambor(0, yPorta, rTambor), semente: 10257 } },
    { forma: roupa, mat: UNIFORME, o: { bisel: 1.6, ruga: 1.4, contorno: 0.24, semente: 10258 } },
    { forma: dentroDe(elipse(6.5, yPorta + rTambor * 0.82, rTambor * 0.34, rTambor * 0.2), tambor), mat: CINZA_DA_ROUPA, o: { bisel: 1.2, ruga: 1.2, contorno: 0.24, semente: 10259 } },
    { forma: tambor, mat: VIDRO, o: { ...liso, alfa: 0.2, semente: 10260 } },
    { forma: dentroDe(anel(0, yPorta, rTambor - 1.4, rTambor - 1.4, rTambor - 3.2, rTambor - 3.2), caixa(-R, yPorta - R, -1, yPorta - 1)), mat: REFLEXO, o: { ...liso, alfa: 0.45, suave: 0.4, semente: 10261 } },
    { forma: elipse(-4.6, yPorta - 5.6, 1.2, 0.9), mat: REFLEXO, o: { ...liso, alfa: 0.6, suave: 0.3, semente: 10262 } },
    { forma: capsula(R + 1.7, yPorta - 4.5, R + 1.7, yPorta + 4.5, 1.1), mat: GRAFITE, o: { tabua: 0, bisel: 0.9, contorno: 0.28, tom: 1.1, semente: 10263 } },
  ]
  for (let k = 0; k < 3; k += 1) frente.push({ forma: caixa(14.2, topo + 10 + k * 1.6, 22 - (k === 2 ? 3 : 0), topo + 10.5 + k * 1.6), mat: ESCURO, o: { ...liso, alfa: 0.45, semente: 10264 } })
  for (const x of [-15, -7.5, 0, 7.5, 15]) frente.push({ forma: capsula(x - 2.2, yFrente - 2.4, x + 2.2, yFrente - 2.4, 0.4), mat: ESCURO, o: { ...liso, alfa: 0.7, semente: 10265 } })
  soNaTresQuartos(P, cena, 0, hh + 0.6, frente)
}
