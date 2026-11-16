/**
 * BOX DE CHUVEIRO de cima com volume (banheiro moderno, pedido do mestre de 15/11/2026): o box de VIDRO de uma casa,
 * encostado na parede do fundo (a beira de cima), com o PISO do box de pedra clara, o RALO quadrado de cromo no
 * meio, a DUCHA de teto (o cano de cromo na parede, o braço e o chuveiro redondo) com o misturador no cano, e o vidro
 * nos outros três lados: o fixo dos dois lados e, na frente, o fixo e a PORTA, com o puxador.
 *
 * DE CIMA aparecem o piso claro com a borda, o ralo, o fio verde-água do vidro nos três lados (com a fresta da porta
 * e o puxador) e, junto da parede, o chuveiro redondo, que faz sombra no piso. NA 3/4 o vidro da frente é
 * desenhado de frente e guardado em faixas debaixo do piso (a frente em faixas do guarda-roupa, `guardaRoupa.ts`),
 * meio transparente: o chuveiro, o cano e o ralo aparecem através dele, com o perfil de cromo em cima e embaixo, os
 * reflexos em diagonal, as dobradiças e o puxador. O vidro de lado aparece de quina (a chapa fina em pé e o fio de
 * cima), e o do fundo só pelo fio de cima: em pé, a face dele taparia o box. O cano, o misturador e o chuveiro são
 * pintados depois do piso, cada um na vez do lugar dele (o de trás primeiro).
 *
 * O desenho é montado JÁ NA TELA (`montadaNaTela`): a face guardada é sempre a de baixo, e o giro só decide o que
 * cada lado da tela tem. Com um quarto de volta, embaixo fica um vidro fixo do lado (com as presilhas na ponta da
 * parede); de costas, embaixo fica a parede da ducha, sem vidro.
 *
 * Sem material escolhido: a pedra clara, o vidro e o cromo são fixos.
 */
import { caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma } from './formas'
import { contato, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, fatiar, naFaixa, type PecaDaFrente } from './guardaRoupa'
import { comMeioEm, montadaNaTela, pino, solta } from './andaimeDaTresQuartos'
import { quartosDoGiro } from './pipaDeitada'
import { BRILHO_DO_CROMO, CROMO, ESCURO, PEDRA_CLARA, PISO_DO_BANHEIRO, REFLEXO, VIDRO, texPedraClara } from './apoioDoBanheiroModerno'

/** O que fica em cada lado do OBJETO, na ordem do relógio (fundo, direita, frente, esquerda). */
type Lado = 'ducha' | 'vidro' | 'porta'
const LADOS: readonly Lado[] = ['ducha', 'vidro', 'porta', 'vidro']
/** Os lados da tela, na mesma ordem do relógio. */
const FUNDO = 0
const DIREITA = 1
const FRENTE = 2
const ESQUERDA = 3

/** Alturas em casas: o piso do box, o vidro, a ducha, o misturador e o puxador. */
const ALTURA_DO_PISO = 0.05
const ALTURA_DO_VIDRO = 1.3
const ALTURA_DA_DUCHA = 1.42
const ALTURA_DO_MISTURADOR = 0.72
const ALTURA_DO_PUXADOR = 0.5
/** O vidro de cima (px): o recuo da beira e a grossura. De cima ele é meio transparente; de frente, bem mais. */
const VIDRO_DE_CIMA = { recuo: 0.6, grossura: 1.3 } as const
const ALFA_DE_CIMA = 0.55
const ALFA_DE_FRENTE = 0.24
/** A porta: a parte da frente que ela ocupa (o resto é o vidro fixo), a fresta e onde fica o puxador (px da ponta). */
const PORTA = { parte: 0.58, fresta: 1, puxador: 4 } as const
/** A borda do piso do box, a meia largura do ralo e as fendas dele (px). */
const BORDA_DO_PISO = 1.8
const RALO = { meio: 3.2, fendas: 4 } as const
/** A ducha (px): o cano na parede, o braço até o chuveiro e o raio dele; o misturador no cano. */
const DUCHA = { recuo: 1.3, cano: 0.9, braco: 10, raio: 5.5, misturador: 1.9 } as const
/** O puxador de cima (o par de botões dos dois lados do vidro) e a sobra dele para dentro do box (px). */
const BOTAO = { comprido: 2.6, raio: 0.7, paraDentro: 2.2 } as const
/** O canto de cromo onde dois vidros se encontram (meio lado, px). */
const CANTO = 0.9
/** As peças da parede (o cano, o misturador, o chuveiro) são pintadas logo depois do piso, nesta faixa de ordem. */
const ORDEM_DA_PAREDE = { depois: 0.05, faixa: 0.15 } as const

// ---------- o giro, feito na tela ----------

/** O ponto do objeto na tela: um quarto de volta leva o fundo para a direita. */
function girar(x: number, y: number, q: number): [number, number] {
  if (q === 1) return [-y, x]
  if (q === 2) return [-x, -y]
  if (q === 3) return [y, -x]
  return [x, y]
}

function caixaNaTela(x0: number, y0: number, x1: number, y1: number, raio: number, q: number): Forma {
  const [ax, ay] = girar(x0, y0, q)
  const [bx, by] = girar(x1, y1, q)
  return caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), raio)
}

function capsulaNaTela(ax: number, ay: number, bx: number, by: number, r: number, q: number): Forma {
  const a = girar(ax, ay, q)
  const b = girar(bx, by, q)
  return capsula(a[0], a[1], b[0], b[1], r)
}

function elipseNaTela(cx: number, cy: number, rx: number, ry: number, q: number): Forma {
  const [x, y] = girar(cx, cy, q)
  return q % 2 === 1 ? elipse(x, y, ry, rx) : elipse(x, y, rx, ry)
}

/**
 * A fresta de uma faixa guardada, sem a espessura da fresta (`FRESTA`): a 3/4 pinta a forma de cada tampo solto na
 * altura dele (a beirada de espessura zero), e atrás do vidro meio transparente a fresta de um quarto de px aparecia
 * como um risco escuro de lado a lado. Esta só contém a linha do meio, onde fica o meio de cada cópia (`naFaixa`):
 * a cópia sobe com ela. Fora da linha a distância salta para longe (a âncora de `soNaTresQuartos`): uma distância
 * contínua, por fina que fosse, ainda ganhava meio pixel de cobertura na beira e deixava o fio à vista.
 */
const FIO_DA_FRESTA = 1e-6
const LONGE_DA_FRESTA = 1e3
function frestaSemFio(meiaLargura: number, meio: number): Forma {
  return {
    b: [-meiaLargura, meio - FIO_DA_FRESTA, meiaLargura, meio + FIO_DA_FRESTA],
    d: (x, y) => (Math.abs(y - meio) < FIO_DA_FRESTA && Math.abs(x) <= meiaLargura ? -1 : LONGE_DA_FRESTA),
  }
}

/** A forma com a caixa esticada até `sul`: a 3/4 a pinta nessa vez (a ordem é pela beira de baixo da caixa). */
function naVezDe(forma: Forma, sul: number): Forma {
  return { b: [forma.b[0], forma.b[1], forma.b[2], Math.max(forma.b[3], sul)], d: forma.d }
}

// ---------- o vidro da frente, de frente ----------

/** As opções de uma peça de cromo vista de frente. */
const cromoDeFrente = (semente: number, bisel = 0.5) => ({ tabua: 0, bisel, contorno: 0.24, metal: BRILHO_DO_CROMO, semente })

/**
 * Onde duas faixas guardadas se encontram, as cópias passam uma por cima da outra (`EMENDA` de `guardaRoupa.ts`, 0,2
 * px para cada lado): no vidro meio transparente isso dobrava a cor e riscava uma linha de lado a lado. Ali cada
 * cópia pinta com meia transparência, e as duas somadas dão o vidro igual ao resto.
 */
const EMENDA_DAS_FAIXAS = 0.2
function semEmenda(cortes: readonly number[]): Textura {
  return (_u, _v, _x, y, _p, s) => {
    for (const t of cortes) if (Math.abs(y + t) < EMENDA_DAS_FAIXAS) s[5] *= 0.5
  }
}

/** Um vidro de frente (de `x0` a `x1`, do pé `pe` ao alto `topo`, y < 0): a chapa, a quina acesa e dois reflexos. */
function chapa(x0: number, x1: number, topo: number, pe: number, cortes: readonly number[], semente: number): PecaDaFrente[] {
  const vidro = caixa(x0 + 0.5, topo, x1 - 0.5, pe)
  const largura = x1 - x0
  const alto = pe - topo
  const textura = semEmenda(cortes)
  const reflexo = (xa: number, larg: number): Forma =>
    dentroDe(poligono([[xa, topo + alto * 0.08], [xa + larg, topo + alto * 0.08], [xa + larg - alto * 0.26, topo + alto * 0.42], [xa - alto * 0.26, topo + alto * 0.42]]), vidro)
  return [
    { forma: caixa(x0, topo, x1, pe, 0.3), mat: VIDRO, o: { tabua: 0, bisel: 0, contorno: 0.16, alfa: ALFA_DE_FRENTE, textura, semente } },
    { forma: caixa(x0, topo, x0 + 0.6, pe), mat: REFLEXO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, textura, semente: semente + 1 } },
    { forma: reflexo(x0 + largura * 0.42, 4.5), mat: REFLEXO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 0.8, semente: semente + 2 } },
    { forma: reflexo(x0 + largura * 0.42 + 7, 1.8), mat: REFLEXO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.16, suave: 0.6, semente: semente + 3 } },
  ]
}

/**
 * O VIDRO DE BAIXO NA TELA, de frente (x de `-hx` a `hx`, y = 0 no chão e negativo para cima): a beira do piso de
 * pedra, as chapas (a fixa e a porta, ou uma só), o perfil de cromo em cima e embaixo e as ferragens: as dobradiças
 * e o puxador da porta, ou as presilhas do vidro fixo na ponta da parede (`parede` = -1 à esquerda, 1 à direita).
 */
function desenharVidroDeFrente(hx: number, H: number, piso: number, porta: boolean, parede: -1 | 1, cortes: readonly number[]): PecaDaFrente[] {
  const x0 = -hx + VIDRO_DE_CIMA.recuo
  const x1 = hx - VIDRO_DE_CIMA.recuo
  const topo = -H
  const pe = -piso
  const pecas: PecaDaFrente[] = [
    { forma: caixa(-hx, -piso, hx, 0, 0.4), mat: PEDRA_CLARA, o: { tabua: 0, bisel: 0.5, tom: 0.84, contorno: 0.2, textura: texPedraClara, semente: 9630 } },
  ]
  if (porta) {
    const xd = x0 + (x1 - x0) * (1 - PORTA.parte)
    pecas.push(...chapa(x0, xd - PORTA.fresta / 2, topo + 1, pe - 0.9, cortes, 9631))
    pecas.push(...chapa(xd + PORTA.fresta / 2, x1, topo + 1, pe - 0.9, cortes, 9635))
    // As dobradiças de vidro com vidro e o puxador de pé junto da ponta livre da porta.
    for (const y of [topo + H * 0.18, pe - H * 0.18]) pecas.push({ forma: caixa(xd - 1.6, y - 1.4, xd + 1.6, y + 1.4, 0.4), mat: CROMO, o: cromoDeFrente(9640) })
    const xp = x1 - PORTA.puxador
    const meio = -H * ALTURA_DO_PUXADOR
    for (const y of [meio - 5, meio + 5]) pecas.push({ forma: caixa(xp - 0.8, y - 0.5, xp + 0.8, y + 0.5, 0.2), mat: CROMO, o: cromoDeFrente(9641, 0.3) })
    pecas.push({ forma: capsula(xp, meio - 6.5, xp, meio + 6.5, 0.65), mat: CROMO, o: cromoDeFrente(9642, 0.6) })
  } else {
    pecas.push(...chapa(x0, x1, topo + 1, pe - 0.9, cortes, 9645))
    const xc = parede === 1 ? x1 - 1.4 : x0 + 1.4
    for (const y of [topo + H * 0.22, pe - H * 0.22]) pecas.push({ forma: caixa(xc - 1.4, y - 1.2, xc + 1.4, y + 1.2, 0.3), mat: CROMO, o: cromoDeFrente(9646) })
  }
  pecas.push({ forma: caixa(x0, topo, x1, topo + 1.1, 0.3), mat: CROMO, o: cromoDeFrente(9650) })
  pecas.push({ forma: caixa(x0, pe - 0.9, x1, pe, 0.2), mat: CROMO, o: cromoDeFrente(9651, 0.3) })
  return pecas
}

// ---------- o box ----------

const montarNaTela: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  cena.corDoPiso = PISO_DO_BANHEIRO
  const q = quartosDoGiro(c.giro)
  // As meias medidas do OBJETO (a tela é a pegada dele girada) e o que cada lado da tela tem.
  const ow = q % 2 === 1 ? hh : hw
  const oh = q % 2 === 1 ? hw : hh
  const naTela = (lado: number): Lado => LADOS[(lado - q + 4) % 4]
  const piso = g * ALTURA_DO_PISO
  const H = g * ALTURA_DO_VIDRO
  const L = cena.partes
  const { recuo, grossura } = VIDRO_DE_CIMA

  // O PISO do box: com vidro embaixo na tela, a coluna vai até as frestas e o vidro de frente fica guardado em faixas.
  const vidroEmbaixo = naTela(FRENTE) !== 'ducha'
  let sul = hh
  if (vidroEmbaixo) {
    const { faixas, frente } = fatiar(H, 0, 0, h, hh)
    sul = frente
    cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1.2), z: piso })
    for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: piso })
    for (const fx of faixas) {
      if (fx.topo > fx.pe) cena.sombras.push({ forma: frestaSemFio(hw - CANTONEIRA, fx.base + FRESTA / 2), z: fx.z, solta: true, forca: 0 })
    }
    const porta = naTela(FRENTE) === 'porta'
    const parede = naTela(DIREITA) === 'ducha' ? 1 : -1
    const cortes = faixas.filter((fx) => fx.topo > fx.pe && fx.topo < H).map((fx) => fx.topo)
    const desenho = desenharVidroDeFrente(hw, H, piso, porta, parede, cortes)
    for (const fx of faixas) {
      for (const peca of desenho) {
        const copia = naFaixa(P, peca, fx)
        if (copia !== null) L.push(copia)
      }
    }
  } else {
    cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1.2), z: piso })
  }
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1.2), 0.3))

  // O piso de pedra clara: a borda e, um degrau abaixo, o chão do box, e o ralo quadrado no meio.
  L.push(P(caixa(-hw, -hh, hw, hh, 1.2), PEDRA_CLARA, { bisel: 1.2, tom: 1.02, contorno: 0.24, textura: texPedraClara, semente: 9600 }))
  L.push(P(caixa(-hw + BORDA_DO_PISO, -hh + BORDA_DO_PISO, hw - BORDA_DO_PISO, hh - BORDA_DO_PISO, 1), PEDRA_CLARA, { bisel: 0.6, tom: 0.95, contorno: 0.14, recesso: { k: 2.4, forca: 0.22 }, textura: texPedraClara, semente: 9601 }))
  L.push(P(caixa(-RALO.meio, -RALO.meio, RALO.meio, RALO.meio, 0.6), CROMO, { bisel: 0.9, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9602 }))
  for (let i = 0; i < RALO.fendas; i += 1) {
    const y = -RALO.meio + 1.2 + (i * (2 * RALO.meio - 2.4)) / (RALO.fendas - 1)
    L.push(P(caixa(-RALO.meio + 1, y - 0.25, RALO.meio - 1, y + 0.25), ESCURO, { bisel: 0, contorno: 0, alfa: 0.75, semente: 9603 }))
  }

  // O VIDRO de cima, nos três lados: embaixo na tela ele sobe com o piso (o perfil do pé); dos lados é a chapa em pé
  // (coluna até as frestas); no fundo, só o fio de cima (a face em pé taparia o box).
  // A tira de cada lado do objeto, na tela: a da frente do objeto é o vidro fixo e a porta, com a fresta entre os dois.
  const linha = oh - recuo - grossura
  const xPorta = -ow + recuo + (2 * ow - 2 * recuo) * (1 - PORTA.parte)
  const tiraDoObjeto = (lado: Lado, ladoDoObjeto: number): Forma => {
    if (lado === 'porta') {
      const fixo = caixaNaTela(-ow + recuo, linha, xPorta - PORTA.fresta / 2, oh - recuo, 0, q)
      return uniao(fixo, caixaNaTela(xPorta + PORTA.fresta / 2, linha, ow - recuo, oh - recuo, 0, q))
    }
    // O vidro fixo de lado: a tira na direita ou na esquerda do objeto.
    const x0 = ladoDoObjeto === DIREITA ? ow - recuo - grossura : -ow + recuo
    return caixaNaTela(x0, -oh + recuo, x0 + grossura, oh - recuo, 0, q)
  }
  // Dos lados da tela a tira para nas frestas da face guardada (a peça com o meio ali subiria a altura do vidro).
  const ateAsFrestas = caixa(-hw - 1, -hh - 1, hw + 1, sul)
  const ferragens: Forma[] = []
  for (const lado of [FUNDO, DIREITA, FRENTE, ESQUERDA]) {
    const oQueTem = naTela(lado)
    if (oQueTem === 'ducha') continue
    const ladoDoObjeto = (lado - q + 4) % 4
    let tira = tiraDoObjeto(oQueTem, ladoDoObjeto)
    if (lado === DIREITA || lado === ESQUERDA) {
      tira = dentroDe(tira, ateAsFrestas)
      cena.sombras.push({ forma: tira, z: H, forca: 0.08 })
    }
    if (lado === FUNDO) cena.sombras.push(solta(tira, H))
    L.push(P(tira, VIDRO, { bisel: 0.3, contorno: 0.3, alfa: ALFA_DE_CIMA, semente: 9610 + lado }))
    if (oQueTem === 'porta') {
      // O par de botões do puxador, dos dois lados do vidro, preso num pino na altura da mão, um nada para dentro.
      const xb = ow - recuo - PORTA.puxador
      const yb = linha + grossura / 2
      const [px, py] = girar(xb, yb - BOTAO.paraDentro, q)
      cena.sombras.push(solta(pino(px, py), g * ALTURA_DO_PUXADOR))
      ferragens.push(comMeioEm(capsulaNaTela(xb, yb - BOTAO.comprido, xb, yb + BOTAO.comprido, BOTAO.raio, q), px, py))
    }
  }
  for (const forma of ferragens) L.push(P(forma, CROMO, { bisel: 0.6, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9611, projeta: { dist: 0.6, forca: 0.22 } }))
  // Os cantos de cromo onde dois vidros se encontram (os da frente do objeto): sobem com a chapa em pé do lado.
  for (const sx of [-1, 1]) {
    const [x, y] = girar(sx * (ow - recuo - grossura / 2), oh - recuo - grossura / 2, q)
    L.push(P(caixa(x - CANTO, y - CANTO, x + CANTO, y + CANTO, 0.3), CROMO, { bisel: 0.5, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9612 }))
  }

  // A DUCHA na parede do fundo do objeto: o cano em pé (do chão ao braço), o misturador nele e o chuveiro no braço.
  // Com a parede atrás na tela, a vez natural (antes do piso) esconde o pé do cano atrás da beira do piso; nos outros
  // giros eles são pintados depois do piso, na ordem do lugar deles na tela (o de trás primeiro): senão o piso,
  // pintado por último, cobriria metade do cano.
  const paredeAtras = naTela(FUNDO) === 'ducha'
  const naOrdem = (forma: Forma): Forma => {
    if (paredeAtras) return forma
    const meio = (forma.b[1] + forma.b[3]) / 2
    return naVezDe(forma, sul + ORDEM_DA_PAREDE.depois + (ORDEM_DA_PAREDE.faixa * (meio + hh)) / (2 * hh))
  }
  const yCano = -oh + DUCHA.recuo
  const cano = elipseNaTela(0, yCano, DUCHA.cano, DUCHA.cano, q)
  cena.sombras.push({ forma: naOrdem(cano), z: g * ALTURA_DA_DUCHA, forca: 0.2 })
  // O misturador fica ao lado do cano (com o meio fora do braço: senão subiria com o chuveiro).
  const [mx, my] = girar(DUCHA.misturador + 0.5, yCano + 0.4, q)
  const misturador = elipse(mx, my, DUCHA.misturador, DUCHA.misturador)
  cena.sombras.push({ forma: naOrdem(misturador), z: g * ALTURA_DO_MISTURADOR, solta: true, forca: 0.15 })
  const chuveiro = elipseNaTela(0, yCano + DUCHA.braco, DUCHA.raio, DUCHA.raio, q)
  const braco = capsulaNaTela(0, yCano, 0, yCano + DUCHA.braco, 0.7, q)
  cena.sombras.push({ forma: naOrdem(uniao(chuveiro, braco)), z: g * ALTURA_DA_DUCHA, solta: true, forca: 0.22 })

  L.push(P(cano, CROMO, { bisel: 0.8, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9620 }))
  L.push(P(misturador, CROMO, { bisel: 1.2, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9621 }))
  const alavanca = capsulaNaTela(DUCHA.misturador + 0.8, yCano + 0.6, DUCHA.misturador + 3.6, yCano + 2.2, 0.55, q)
  L.push(P(comMeioEm(alavanca, mx, my), CROMO, { bisel: 0.5, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9622 }))
  L.push(P(braco, CROMO, { bisel: 0.6, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9623 }))
  L.push(P(chuveiro, CROMO, { bisel: 1.8, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9624 }))
  L.push(P(elipseNaTela(0, yCano + DUCHA.braco, DUCHA.raio - 1.6, DUCHA.raio - 1.6, q), CROMO, { bisel: 0.8, tom: 1.06, contorno: 0.12, metal: BRILHO_DO_CROMO, semente: 9625 }))
}

export const montarBoxDeChuveiro: MontarMovel = montadaNaTela(montarNaTela)
