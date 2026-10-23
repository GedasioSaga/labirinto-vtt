/**
 * SEBE de cima com volume (peça nova da MT5): desenho original inspirado na
 * `folhagem` do Estilo Mother da vila (`docs/design/vila-estilo-mother/
 * prototipo/mother.js:274`): UMA massa de folha com um contorno só por fora,
 * por cima dela as copas no tom de base (puxadas para a luz e recortadas pela
 * massa, então a massa escura só aparece embaixo à direita de cada uma) e um
 * realce em 60% delas; mais umas florzinhas. Material: `folhas` (buxo ou
 * alfeneiro); as flores são fixas.
 *
 * Revisão de design da MT5: cada copinha tinha chanfro e contorno próprios, o
 * escuro das bordas caía abaixo do piso de luz e virava marrom (20 a 26% da
 * sebe), e ela lia como colar de contas. Agora são 3 tons chapados (massa 0,80,
 * copa 1,0, realce 1,16), sem chanfro, e o escuro levantado é verde
 * (`PISO_DA_FOLHA`).
 *
 * A geometria é a da CERCA (`geometriaDaCerca` de `lib/mobilia.ts`): o eixo
 * pela reta ou pelo ARCO da sebe curva, com as pontas onde a cerca põe os
 * mourões das pontas. As copas se repartem pelo comprimento do arco a ~0,36
 * da espessura, então a sebe esticada ganha mais copas, nunca copas esticadas,
 * e a seleção e o clique (que leem a mesma faixa) caem em cima do desenho. A
 * sebe longa sai em ladrilhos (`pixi/rasterDosMoveis.ts`), como a cerca.
 */
import { geometriaDaCerca } from '../../../lib/mobilia'
import { hash, rgb } from '../../ruido'
import type { StairArc } from '../../../lib/stairCurve'
import { elipse, type Forma, type Ponto } from './formas'
import { contato, PISO_DA_FOLHA, texFolhagem, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Altura da sebe em casas (a sombra no chão). */
const ALTURA_DA_SEBE = 0.55
/** Passo entre copas e o raio delas, em fração da espessura (`mother.js`: 8 px e 6 a 8,2 px numa sebe de 22). */
const PASSO_DAS_COPAS = 0.36
const RAIO_MINIMO = 0.3
const RAIO_VARIA = 0.07
/** Quanto a copa sai do eixo para cada lado (fração da espessura). */
const DESVIO = 0.055
/** A MASSA: meia espessura 0,40 da espessura, ondulando ±0,05 com período de 0,42 (a borda da união das copinhas). */
const MASSA = 0.4
const ONDA = 0.05
const PERIODO_DA_ONDA = 0.42
const TOM_DA_MASSA = 0.8
const CONTORNO_DA_MASSA = 0.2
/** A COPA no tom de base: 0,88 do raio, puxada para a luz (-0,15 r, -0,17 r), como em `folhagem`. */
const COPA = 0.88
const PUXA_X = 0.15
const PUXA_Y = 0.17
/** O REALCE: raio 0,3 r em (-0,36 r, -0,4 r), no tom 1,16, em 60% das copas. */
const REALCE = 0.3
const TOM_DO_REALCE = 1.16
const COM_REALCE = 0.6

/** Flores fixas, tons contidos da vila (saturação HSV até 0,48). */
const FLORES: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: rgb('#ece6d6') },
  { classe: 'liso', rgb: rgb('#d49ab4') },
  { classe: 'liso', rgb: rgb('#d8c070') },
]
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: rgb('#c9a24f') }

interface Onda {
  /** Amplitude e período, em px do protótipo. */
  readonly amp: number
  readonly periodo: number
}

/**
 * A faixa de raio `r` em volta do eixo, com a borda ondulada por `onda`: a
 * cápsula na sebe reta e, na curva, a distância exata ao ARCO (|distância ao
 * centro - raio|, e as pontas como círculos). Uma conta por pixel: a `cadeia`
 * dos pontos das copinhas olhava os ~22 pedaços em cada pixel da caixa inteira
 * (o miolo vazio do arco incluso) e a sebe curva de 4 casas levava ~160 ms a 3x.
 * A onda anda pelo comprimento do eixo, defasada um quarto de período de um
 * lado para o outro (com a mesma fase dos dois lados ela lia como contas).
 */
function faixa(eixo: readonly Ponto[], arco: StairArc | null, r: number, onda: Onda | null = null, rapida = false): Forma {
  const [ax, ay] = eixo[0]
  const [bx, by] = eixo[eixo.length - 1]
  const amp = onda?.amp ?? 0
  const k = onda === null ? 0 : (Math.PI * 2) / onda.periodo
  const borda = (s: number, lado: number): number => r + amp * Math.sin(k * s + lado)
  const QUARTO = Math.PI / 2
  if (arco === null) {
    const L = Math.hypot(bx - ax, by - ay) || 1
    const ux = (bx - ax) / L
    const uy = (by - ay) / L
    const f = r + amp + 0.5
    return {
      b: [Math.min(ax, bx) - f, Math.min(ay, by) - f, Math.max(ax, bx) + f, Math.max(ay, by) + f],
      d(x, y) {
        const px = x - ax
        const py = y - ay
        const ao = px * ux + py * uy
        const s = ao < 0 ? 0 : ao > L ? L : ao
        const cruz = px * uy - py * ux
        return Math.hypot(px - ux * s, py - uy * s) - borda(s, cruz >= 0 ? 0 : QUARTO)
      },
    }
  }
  const { x: cx, y: cy } = arco.center
  const R = arco.radius
  const inicio = arco.startAngle
  const giro = Math.abs(arco.sweep)
  const sentido = Math.sign(arco.sweep) || 1
  const volta = Math.PI * 2
  const xs = eixo.map(([x]) => x)
  const ys = eixo.map(([, y]) => y)
  // O arco passa um pouco por fora da corda entre dois pontos vizinhos do eixo.
  const folga = r + amp + R * (1 - Math.cos(giro / (eixo.length - 1) / 2)) + 0.5
  return {
    b: [Math.min(...xs) - folga, Math.min(...ys) - folga, Math.max(...xs) + folga, Math.max(...ys) + folga],
    d(x, y) {
      const doCentro = Math.hypot(x - cx, y - cy)
      const radial = Math.abs(doCentro - R)
      // Longe do anel (o miolo vazio do arco e o canto de fora da caixa), a distância é no mínimo
      // radial - r - amp, no arco e nas pontas (que estão no anel): devolve esse limite sem o ângulo.
      // Acima de LONGE_DA_BORDA ele já não pinta (cobertura 0,5 - d x S, S >= 50/56) nem muda o
      // sombreado (que satura), então a imagem é a mesma. Só a massa pintada usa; a sombra lê a
      // distância exata (o borrão dela vai mais longe).
      if (rapida && radial - r - amp > LONGE_DA_BORDA) return radial - r - amp
      const rel = ((((Math.atan2(y - cy, x - cx) - inicio) * sentido) % volta) + volta) % volta
      if (rel <= giro) return radial - borda(rel * R, doCentro >= R ? 0 : QUARTO)
      const daPonta = Math.hypot(x - ax, y - ay)
      const daOutra = Math.hypot(x - bx, y - by)
      return daPonta <= daOutra ? daPonta - borda(0, 0) : daOutra - borda(giro * R, 0)
    },
  }
}

/** Além desta distância (px do protótipo) fora da copa, o pixel nunca pinta: o recorte não precisa da massa. */
const LONGE_DA_COPA = 1.5
/** Além desta distância (px do protótipo) da borda da massa, o pixel nunca pinta nem muda de sombreado. */
const LONGE_DA_BORDA = 2

/**
 * A copa recortada pela massa (o `dentroDe` de `formas.ts`), sem ler a massa
 * no pixel que já está longe da copa: o resultado é o mesmo (fora continua
 * fora) e a sebe curva de 4 casas não paga o arco da massa no canto vazio da
 * caixa de cada copa.
 */
function recortadaPelaMassa(copa: Forma, massa: Forma): Forma {
  return {
    b: [Math.max(copa.b[0], massa.b[0]), Math.max(copa.b[1], massa.b[1]), Math.min(copa.b[2], massa.b[2]), Math.min(copa.b[3], massa.b[3])],
    d(x, y) {
      const daCopa = copa.d(x, y)
      if (daCopa > LONGE_DA_COPA) return daCopa
      const daMassa = massa.d(x, y)
      return daCopa > daMassa ? daCopa : daMassa
    },
  }
}

interface Copa {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly i: number
}

export const montarSebe: MontarMovel = (c, cena) => {
  const geometria = geometriaDaCerca(c.w, c.h, c.curva)
  if (geometria === null) return
  const esp = Math.min(c.w, c.h)
  const primeiro = geometria.mouroes[0]
  const ultimo = geometria.mouroes[geometria.mouroes.length - 1]
  const arco = geometria.arco
  const comprimento = arco === null ? Math.hypot(ultimo.x - primeiro.x, ultimo.y - primeiro.y) : arco.radius * Math.abs(arco.sweep)
  const n = Math.max(2, Math.round(comprimento / (PASSO_DAS_COPAS * esp)))
  // Variação por sebe (não por pixel): o tamanho entra, então duas sebes do mesmo tamanho são iguais.
  const sorteio = Math.round(c.w + 7 * c.h)
  const eixo: Ponto[] = []
  const copas: Copa[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    let x: number
    let y: number
    let nx: number
    let ny: number
    if (arco === null) {
      x = primeiro.x + (ultimo.x - primeiro.x) * t
      y = primeiro.y + (ultimo.y - primeiro.y) * t
      const l = comprimento || 1
      nx = -(ultimo.y - primeiro.y) / l
      ny = (ultimo.x - primeiro.x) / l
    } else {
      const a = arco.startAngle + arco.sweep * t
      nx = Math.cos(a)
      ny = Math.sin(a)
      x = arco.center.x + nx * arco.radius
      y = arco.center.y + ny * arco.radius
    }
    eixo.push([x, y])
    const desvio = (hash(i, sorteio, 17) - 0.5) * 2 * DESVIO * esp
    copas.push({ x: x + nx * desvio, y: y + ny * desvio, r: esp * (RAIO_MINIMO + RAIO_VARIA * hash(i, sorteio, 18)), i })
  }
  const massa = faixa(eixo, arco, MASSA * esp, { amp: ONDA * esp, periodo: PERIODO_DA_ONDA * esp }, true)
  // Sombra SOLTA (sem as amostras arrastadas do pé até a ponta): a sebe é uma massa fechada que
  // cobre o próprio pé, e o contato escurece a base. Arrastada, a sombra lia a forma até 1 + n vezes
  // por pixel e a sebe curva de 4 casas levava ~120 ms só de sombra a 3x.
  const pe = faixa(eixo, arco, MASSA * esp)
  cena.sombras.push({ forma: pe, z: c.g * ALTURA_DA_SEBE, solta: true }, contato(pe, 0.26))
  // O escuro levantado da folha é verde, não o marrom da nogueira.
  cena.corDoPiso = PISO_DA_FOLHA
  const P = c.peca
  const folhas = c.m.folhas
  const L = cena.partes
  // De baixo para cima (a última fica por cima): a massa, as copas, os realces, as flores.
  L.push(P(massa, folhas, { textura: texFolhagem, bisel: 0, contorno: CONTORNO_DA_MASSA, tom: TOM_DA_MASSA, semente: 30 }))
  for (const copa of copas) {
    const r = copa.r * COPA
    L.push(P(recortadaPelaMassa(elipse(copa.x - PUXA_X * copa.r, copa.y - PUXA_Y * copa.r, r, r), massa), folhas, { textura: texFolhagem, bisel: 0, contorno: 0, tom: 1, semente: 40 + copa.i }))
  }
  for (const copa of copas) {
    if (hash(copa.i, sorteio, 19) >= COM_REALCE) continue
    const r = copa.r * REALCE
    L.push(P(recortadaPelaMassa(elipse(copa.x - 0.36 * copa.r, copa.y - 0.4 * copa.r, r, r), massa), folhas, { textura: texFolhagem, bisel: 0, contorno: 0, tom: TOM_DO_REALCE, semente: 60 + copa.i }))
  }
  for (const copa of copas) {
    if (hash(copa.i, sorteio, 21) >= 0.3) continue
    const fr = 0.075 * esp
    const fx = copa.x - copa.r * 0.3
    const fy = copa.y - copa.r * 0.3
    L.push(P(elipse(fx, fy, fr, fr), FLORES[copa.i % FLORES.length], { bisel: fr * 0.7, contorno: 0.14, semente: 70 + copa.i }))
    L.push(P(elipse(fx, fy, fr * 0.38, fr * 0.38), MIOLO_DA_FLOR, { bisel: 0, contorno: 0, semente: 80 + copa.i }))
  }
}
