/**
 * PILHA DE FATIAS (utensílios do banheiro moderno, desenhista B, 15/11/2026): o apoio com que a lixeira de pedal,
 * o suporte de papel, o toalheiro, o cesto de roupa e a prateleira de frascos montam as duas vistas. Não é um
 * objeto: não tem registro nem ficha.
 *
 * O objeto é desenhado em FATIAS DEITADAS, como um corte: cada fatia é a forma dele naquela altura, vista de cima.
 * Empilhadas, de cima aparece a fatia mais alta (e a beira das de baixo onde o objeto afina para cima, como o ombro
 * de um frasco); na 3/4 cada fatia sobe a altura dela e só a faixa da frente de cada uma fica à mostra: juntas, elas
 * desenham a frente de verdade (o cilindro da lixeira com o friso da tampa, o rolo deitado, a toalha pendurada).
 *
 * COMO A 3/4 SOBE CADA FATIA. A 3/4 (`tresQuartos.ts`) sobe a peça com a estrutura mais alta que contém o meio da
 * caixa dela e pinta as estruturas pela base da caixa, do norte para o sul. Aqui cada fatia tem a sua ÂNCORA: uma
 * estrutura solta, sem sombra no chão, cuja forma só contém o meio (exato) da caixa da própria fatia e nunca pinta
 * nada. A caixa da âncora é outra: um ponto escolhido NA TELA, já com o giro, que dá a ordem de pintura da 3/4. O
 * giro vira a caixa e a forma juntas (`girarForma`), então a ordem vale com o objeto girado.
 *
 * A ORDEM DA 3/4: primeiro a `camada` que o desenho der (o que está apoiado em cima de algo vem numa camada depois
 * do apoio: o frasco depois da tábua); dentro dela, pela profundidade de cada fatia NA TELA, o y do meio dela mais a
 * altura (a coisa mais ao sul ou mais alta fica na frente; para a vista inclinada da 3/4 as duas contam igual).
 * Na vista de cima as fatias ficam na lista pela altura: a mais alta por cima.
 *
 * Quem usa a pilha: o perfil da 3/4 tem de ser `{ modo: 'derivado', espessura: 0 }` (com beirada, cada âncora
 * desceria um fio) e nenhuma outra sombra com altura pode conter o meio de uma fatia (ela subiria com essa). As
 * sombras no chão são de altura zero, já desenhadas para o lado da sombra NA TELA (`sombraDoCilindro`, `sombraNoAr`).
 */
import { capsula, type Forma } from './formas'
import { SOMBRA_X, SOMBRA_Y, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Sombra } from './motor'
import { quartosDoGiro } from './pipaDeitada'

/** A fatia não tem deslocamento (a 3/4 é quem o põe) nem projeta sombra (a ordem da 3/4 não é a da lista). */
export type OpcoesDaFatia = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta'>

// ---------- o giro ----------

/** O ponto do objeto NA TELA depois do quarto de volta que as duas vistas pintam (`girarCena`; y para baixo). */
export function naTela(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** O ponto da tela de volta no objeto. */
export function noObjeto(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

// ---------- a pilha ----------

/** Quanto a base da caixa de uma âncora anda para a seguinte, NA TELA (px do protótipo). */
const PASSO_DA_ORDEM = 0.01
/** Quanto o meio da caixa de cada fatia anda para o da seguinte (px): cada âncora contém um meio só, e a caixa quase não cresce. */
const PASSO_DO_MEIO = 1e-4
const RAIO_DA_ANCORA = 1e-6
const LONGE_DA_ANCORA = 1e3
/** A 3/4 só faz estrutura da sombra com altura acima de zero: a fatia do chão fica um nada acima dele. */
const ALTURA_MINIMA = 1e-3
/** A borda da "sombra" da âncora: ela não pinta nada, mas a caixa da imagem conta com a borda. */
const BORDA_DA_ANCORA = 0.1

interface Guardada {
  readonly camada: number
  readonly z: number
  readonly fundo: number
  readonly i: number
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFatia
}

export interface Fatiador {
  /** O quarto de volta do objeto (0 a 3): a luz desenhada nas texturas fica no lado certo NA TELA. */
  readonly q: number
  /** Uma fatia deitada na altura `z` (px a partir do chão), no referencial do objeto. */
  fatia(camada: number, z: number, forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFatia): void
  /** Põe as peças na cena (pela altura, para a vista de cima) e as âncoras (na ordem da 3/4). */
  fechar(): void
}

/** A forma com a caixa crescida até o meio dela cair em (mx, my): a 3/4 lê o meio da caixa. */
function comMeioEm(f: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - f.b[0], f.b[2] - mx)
  const ey = Math.max(my - f.b[1], f.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: f.d }
}

/** O fatiador do objeto: `peca` e `cena` do montador, `giro` do contexto. */
export function novoFatiador(peca: CriarPeca, cena: Cena, giro: number): Fatiador {
  const q = quartosDoGiro(giro)
  const guardadas: Guardada[] = []
  return {
    q,
    fatia(camada, z, forma, mat, o) {
      const meioX = (forma.b[0] + forma.b[2]) / 2
      const meioY = (forma.b[1] + forma.b[3]) / 2
      guardadas.push({ camada, z, fundo: naTela(meioX, meioY, q)[1] + z, i: guardadas.length, forma, mat, o })
    },
    fechar() {
      const da34 = [...guardadas].sort((a, b) => a.camada - b.camada || a.fundo - b.fundo || a.z - b.z || a.i - b.i)
      const meios = new Map<Guardada, readonly [number, number]>()
      da34.forEach((g, k) => {
        const mx = (g.forma.b[0] + g.forma.b[2]) / 2
        const my = (g.forma.b[1] + g.forma.b[3]) / 2 + k * PASSO_DO_MEIO
        meios.set(g, [mx, my])
        const [ax, ay] = noObjeto(0, k * PASSO_DA_ORDEM, q)
        const ancora: Forma = {
          b: [ax, ay, ax, ay],
          d: (x, y) => (Math.abs(x - mx) < RAIO_DA_ANCORA && Math.abs(y - my) < RAIO_DA_ANCORA ? -1 : LONGE_DA_ANCORA),
        }
        cena.sombras.push({ forma: ancora, z: Math.max(ALTURA_MINIMA, g.z), solta: true, forca: 0, suave: BORDA_DA_ANCORA })
      })
      const deCima = [...guardadas].sort((a, b) => a.z - b.z || a.camada - b.camada || a.i - b.i)
      for (const g of deCima) {
        const meio = meios.get(g)
        if (meio !== undefined) cena.partes.push(peca(comMeioEm(g.forma, meio[0], meio[1]), g.mat, g.o))
      }
    },
  }
}

/** As alturas de `de` a `ate` (as duas inclusas) em passos de no máximo `passo`. */
export function alturas(de: number, ate: number, passo: number): number[] {
  const n = Math.max(1, Math.ceil((ate - de) / passo - 1e-9))
  return Array.from({ length: n + 1 }, (_, i) => de + ((ate - de) * i) / n)
}

// ---------- a luz desenhada ----------

function suave01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/**
 * A luz da frente de um CILINDRO DE PÉ, NA TELA: `t` vai de -1 (a beira esquerda) a 1. A esquerda pega a luz
 * (vem de cima à esquerda, como no motor), as beiras escurecem (o contorno, que a fatia não tem: cada corte ganharia
 * um risco) e, um pouco à esquerda do meio, o reflexo da janela, na força `brilho` (0 = fosco).
 */
export function luzDoCilindro(t: number, brilho: number): number {
  const reflexo = Math.exp(-(((t + 0.4) / 0.16) ** 2)) - 0.45 * Math.exp(-(((t - 0.5) / 0.22) ** 2))
  return -0.11 * t - 0.26 * suave01((Math.abs(t) - 0.7) / 0.3) + brilho * reflexo
}

/**
 * A luz de um CILINDRO DEITADO pela altura: `t` vai de -1 (embaixo) a 1 (em cima). Em cima pega a luz e embaixo
 * escurece; de cima (a vista de cima mostra as fatias altas) e de frente (a 3/4 mostra a faixa de cada uma) dá o
 * mesmo rolo.
 */
export function luzDoDeitado(t: number, brilho: number): number {
  return 0.1 * t - 0.22 * suave01((-t - 0.55) / 0.45) + brilho * Math.exp(-(((t - 0.55) / 0.2) ** 2))
}

// ---------- sombras no chão ----------

/** Quanto anda a sombra por px de altura, NO OBJETO (o motor a põe para baixo à direita NA TELA; aqui ela é desenhada). */
export function rumoDaSombra(q: number): [number, number] {
  return noObjeto(SOMBRA_X, SOMBRA_Y, q)
}

/** A sombra no chão de um cilindro de pé de raio `r` e altura `z`: a cápsula do pé até o topo, sem andar o arrasto. */
export function sombraDoCilindro(cx: number, cy: number, r: number, z: number, q: number, forca: number, suave: number): Sombra {
  const [rx, ry] = rumoDaSombra(q)
  return { forma: capsula(cx, cy, cx + rx * z, cy + ry * z, r), z: 0, forca, suave }
}

/** A sombra no chão de uma coisa solta no ar (a tábua na parede): a forma afastada até a altura `z`, sem arrasto. */
export function sombraNoAr(f: Forma, z: number, q: number, forca: number, suave: number): Sombra {
  const [rx, ry] = rumoDaSombra(q)
  const dx = rx * z
  const dy = ry * z
  return { forma: { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }, z: 0, forca, suave }
}
