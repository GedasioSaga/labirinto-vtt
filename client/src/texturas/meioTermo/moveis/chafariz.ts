/**
 * CHAFARIZ de praça de cima com volume (02/11/2026): a bacia de pedra cheia
 * d'água, a coluna no meio e o prato em cima dela, com o bico de onde sai o
 * jato. Duas formas (`lib/mobilia/chafariz.ts`):
 * - REDONDO: a borda da bacia em anel de pedras com junta entre elas;
 * - QUADRADO: a bacia oitavada (o quadrado de cantos cortados), em lajes, e o
 *   plinto quadrado debaixo do prato, aparecendo nos cantos.
 *
 * Esticado, a bacia acompanha a pegada (a redonda vira oval, a oitavada fica
 * comprida) e as pedras da borda se repetem no tamanho delas, como as tábuas
 * do aparador; o prato e o bico ficam redondos, na régua do lado menor.
 *
 * A água é fixa, o azul-petróleo do Meio-Termo, a mesma família do poço e do
 * balde (mais clara que a boca do poço: a bacia é rasa e pega luz). Com a água
 * LIGADA a imagem tem o prato cheio, a borda dele molhada e a espuma clara na
 * bacia em volta do prato (onde a água cai); o jato, as gotas e os anéis são a
 * camada animada (`pixi/aguaDosChafarizes.ts`). DESLIGADA, a água da bacia
 * fica parada e mais escura, com o reflexo mais firme, e o prato com pouca
 * água no fundo. Material: `pedra`.
 */
import { lerVarianteDoChafariz, medidasDoChafariz, CHAFARIZ } from '../../../lib/mobilia/chafariz'
import { anel, caixa, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Altura da borda da bacia e do prato, em casas (a sombra no chão). */
const ALTURA_DA_BACIA = 0.42
/** A água da bacia: ligada pega a luz do jato; desligada, parada e mais funda. */
const AGUA_LIGADA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.82)) }
const AGUA_PARADA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.74)) }
/** A água do prato: cheia e clara com a água ligada; o resto no fundo, desligada. */
const AGUA_DO_PRATO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.96)) }
const FUNDO_DO_PRATO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.66)) }
/** O claro da água: o reflexo do céu e a espuma onde a água cai (o mesmo do poço e do balde). */
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }
/** Comprimento de uma pedra da borda, em casas: a bacia esticada ganha mais pedras, não pedras maiores. */
const PEDRA_DA_BORDA_EM_CASAS = 0.5
/** Junta entre as pedras (px do protótipo). */
const JUNTA = 0.9
/** Tom mínimo de cada pedra da borda: o topo pega a luz e lê bem mais claro que a água. */
const TOM_DAS_PEDRAS = 0.98

/** 0..1 fixo por pedra: o tom de cada uma. */
function tomDaPedra(i: number): number {
  const s = Math.sin(i * 12.9898 + 41.17) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Uma pedra da borda REDONDA: o setor do anel da elipse de meio-eixos (ax, ay)
 * na linha do meio da borda, com `meia` de meia espessura, do ângulo `a0` ao
 * `a0 + da` (no espaço da elipse normalizada). A distância é aproximada pelo
 * raio local da elipse: boa perto da borda, onde o chanfro lê.
 */
function pedraDoAnel(ax: number, ay: number, meia: number, a0: number, da: number): Forma {
  const am = a0 + da / 2
  const xs: number[] = []
  const ys: number[] = []
  for (const a of [a0, am, a0 + da]) {
    for (const s of [-1, 1]) {
      const fx = (ax + s * meia) * Math.cos(a)
      const fy = (ay + s * meia) * Math.sin(a)
      xs.push(fx)
      ys.push(fy)
    }
  }
  const b: [number, number, number, number] = [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2]
  return {
    b,
    d(x, y) {
      const u = x / ax
      const v = y / ay
      const rho = Math.hypot(u, v)
      const theta = Math.atan2(v, u)
      const raioLocal = Math.hypot(ax * Math.cos(theta), ay * Math.sin(theta))
      let a = theta - am
      a -= 2 * Math.PI * Math.round(a / (2 * Math.PI))
      const radial = Math.abs(rho - 1) * raioLocal - meia
      const angular = (Math.abs(a) - da / 2) * rho * raioLocal + JUNTA / 2
      return Math.max(radial, angular)
    },
  }
}

/** Os oito cantos do oitavado de meia largura `x`, meia altura `y` e canto cortado `c`, do alto à esquerda no sentido horário. */
function oitavado(x: number, y: number, c: number): Ponto[] {
  return [[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]]
}

function entre(a: Ponto, b: Ponto, t: number): Ponto {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Encolhe o quadrilátero `q` meia junta para o centro dele: a junta entre as lajes. */
function comJunta(q: readonly Ponto[]): Ponto[] {
  const cx = q.reduce((s, p) => s + p[0], 0) / q.length
  const cy = q.reduce((s, p) => s + p[1], 0) / q.length
  return q.map(([x, y]) => {
    const dx = cx - x
    const dy = cy - y
    const l = Math.hypot(dx, dy) || 1
    return [x + (dx / l) * JUNTA * 0.7, y + (dy / l) * JUNTA * 0.7]
  })
}

/** A borda de pedra da bacia: as pedras do anel (redondo) ou as lajes dos oito lados (quadrado). */
function bordaDaBacia(c: ContextoDoMovel, L: Peca[], quadrado: boolean, fora: Forma, bx: number, by: number, borda: number, canto: number): void {
  const P = c.peca
  const pedra = c.m.pedra
  const comprimento = PEDRA_DA_BORDA_EM_CASAS * c.g
  // O fundo da borda inteira, mais escuro: é o que aparece nas juntas.
  const dentro = quadrado ? poligono(oitavado(bx - borda, by - borda, Math.max(0.5, canto - borda * 0.414))) : elipse(0, 0, bx - borda, by - borda)
  L.push(P(menos(fora, dentro), pedra, { tabua: 0, bisel: 0.8, tom: 0.6, contorno: 0.24, semente: 701 }))
  if (!quadrado) {
    const ax = bx - borda / 2
    const ay = by - borda / 2
    const perimetro = Math.PI * (3 * (ax + ay) - Math.sqrt((3 * ax + ay) * (ax + 3 * ay)))
    const n = Math.max(10, Math.round(perimetro / comprimento))
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * 2 * Math.PI + 0.21
      L.push(P(pedraDoAnel(ax, ay, borda / 2, a0, (2 * Math.PI) / n), pedra, { tabua: 0, bisel: borda * 0.36, tom: TOM_DAS_PEDRAS + 0.14 * tomDaPedra(i), contorno: 0.26, semente: 710 + i }))
    }
    return
  }
  const de = oitavado(bx, by, canto)
  const ate = oitavado(bx - borda, by - borda, Math.max(0.5, canto - borda * 0.414))
  let k = 0
  for (let lado = 0; lado < 8; lado += 1) {
    const prox = (lado + 1) % 8
    const comprimentoDoLado = Math.hypot(de[prox][0] - de[lado][0], de[prox][1] - de[lado][1])
    const lajes = Math.max(1, Math.round(comprimentoDoLado / comprimento))
    for (let j = 0; j < lajes; j += 1) {
      const t0 = j / lajes
      const t1 = (j + 1) / lajes
      const q = comJunta([entre(de[lado], de[prox], t0), entre(de[lado], de[prox], t1), entre(ate[lado], ate[prox], t1), entre(ate[lado], ate[prox], t0)])
      L.push(P(poligono(q), pedra, { tabua: 0, bisel: borda * 0.34, tom: TOM_DAS_PEDRAS + 0.14 * tomDaPedra(k), contorno: 0.26, semente: 740 + k }))
      k += 1
    }
  }
}

export const montarChafariz: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const medidas = medidasDoChafariz(w, h)
  if (medidas === null) return
  const { forma, agua } = lerVarianteDoChafariz(c.variante)
  const quadrado = forma === 'quadrado'
  const ligada = agua === 'ligada'
  const menor = Math.min(hw, hh)
  const k = menor / 56
  const pedra = c.m.pedra
  const { baciaX: bx, baciaY: by, prato, aguaDoPrato, bico } = medidas
  const borda = bx - medidas.aguaX
  const canto = Math.min(menor * CHAFARIZ.cantoDoQuadrado, bx * 0.45, by * 0.45)
  const fora = quadrado ? poligono(oitavado(bx, by, canto)) : elipse(0, 0, bx, by)
  // A água vai um pouco por baixo da borda, para a junta não abrir no chão.
  const formaDaAgua = quadrado
    ? poligono(oitavado(bx - borda + 0.8, by - borda + 0.8, Math.max(0.5, canto - borda * 0.414)))
    : elipse(0, 0, bx - borda + 0.8, by - borda + 0.8)

  cena.sombras.push({ forma: fora, z: g * ALTURA_DA_BACIA }, contato(fora, 0.3))
  const L = cena.partes

  // A ÁGUA DA BACIA: a borda faz sombra nela do lado da luz (cima à esquerda), numa faixa estreita.
  const sombraX = 4.5 * k
  const sombraY = 3.6 * k
  const texAgua: Textura = (_u, _v, x, y, _p, s) => {
    const d = formaDaAgua.d(x - sombraX, y - sombraY)
    s[3] += -(ligada ? 0.34 : 0.4) * Math.max(0, Math.min(1, 0.5 + d / (3 * k))) + ruido(x * 0.25, y * 0.25) * (ligada ? 0.07 : 0.04)
  }
  L.push(P(formaDaAgua, ligada ? AGUA_LIGADA : AGUA_PARADA, { bisel: 0, contorno: 0, textura: texAgua, semente: 720 }))
  // O reflexo do céu na água, embaixo à direita (a luz vem de cima à esquerda): parada, mais firme.
  const rx = Math.max(menor * 0.2, (bx - borda) * 0.3)
  const ry = Math.max(menor * 0.07, (by - borda) * 0.09)
  L.push(P(elipse((bx - borda) * 0.42, (by - borda) * 0.62, rx, ry), REFLEXO, { bisel: 0, contorno: 0, alfa: ligada ? 0.12 : 0.2, suave: 2.4 * k, semente: 721 }))
  // Ligada: a espuma clara em volta do prato, onde a água cai (os anéis andam por cima, na camada animada).
  if (ligada) L.push(P(anel(0, 0, prato * 1.32, prato * 1.32, prato * 0.98, prato * 0.98), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.2, suave: 2.6 * k, semente: 722 }))

  // A borda da bacia, por cima da água.
  bordaDaBacia(c, L, quadrado, fora, bx, by, borda, canto)

  // O PLINTO quadrado (só no Quadrado): a base da coluna dentro da água, aparecendo nos cantos do prato.
  if (quadrado) {
    const p = menor * CHAFARIZ.plinto
    L.push(P(caixa(-p, -p, p, p, 1.2 * k), pedra, { tabua: 0, bisel: 1.8 * k, tom: 0.92, contorno: 0.26, semente: 760, projeta: { dist: 2.4 * k, forca: 0.3 } }))
  }

  // O PRATO: a pedra redonda em cima da coluna, que faz sombra na água da bacia (está alto).
  L.push(P(elipse(0, 0, prato, prato), pedra, { tabua: 0, bisel: 2.4 * k, tom: 1.04, contorno: 0.28, semente: 770, projeta: { dist: 5.5 * k, forca: 0.34 } }))
  if (ligada) {
    // Cheio até a borda, com a beira molhada (a água passando por cima dela).
    L.push(P(elipse(0, 0, aguaDoPrato, aguaDoPrato), AGUA_DO_PRATO, { bisel: 0, contorno: 0.16, recesso: { k: 1.1 * k, forca: 0.24 }, semente: 771 }))
    L.push(P(anel(0, 0, prato + 0.4, prato + 0.4, prato - 1.2 * k, prato - 1.2 * k), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.16, suave: 0.9 * k, semente: 772 }))
  } else {
    // Seco na beira, um resto de água parada no fundo.
    L.push(P(elipse(0, 0, aguaDoPrato, aguaDoPrato), pedra, { tabua: 0, bisel: 0, tom: 0.7, contorno: 0.14, recesso: { k: 1.6 * k, forca: 0.32 }, semente: 773 }))
    L.push(P(elipse(0.6 * k, 0.6 * k, aguaDoPrato * 0.66, aguaDoPrato * 0.66), FUNDO_DO_PRATO, { bisel: 0, contorno: 0.1, suave: 0.8 * k, semente: 774 }))
  }
  L.push(P(elipse(aguaDoPrato * 0.34, aguaDoPrato * 0.44, aguaDoPrato * 0.3, aguaDoPrato * 0.1), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.18, suave: 1 * k, semente: 775 }))
  // O BICO no meio do prato: a pedra torneada de onde sai o jato.
  L.push(P(elipse(0, 0, bico, bico), pedra, { tabua: 0, bisel: bico * 0.6, tom: 1.08, contorno: 0.3, semente: 776, projeta: { dist: 1.6 * k, forca: 0.3 } }))
}
