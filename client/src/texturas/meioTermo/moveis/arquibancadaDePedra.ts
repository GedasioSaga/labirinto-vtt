/**
 * ARQUIBANCADA DE PEDRA CURVA (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; construção nova). Um QUARTO
 * DE ANEL de degraus de pedra escura e lisa em volta de um fosso: três DEGRAUS largos (cabe um token sentado em cada
 * um), que sobem do meio para fora, e atrás deles a MURETA de capeamento. Cada degrau é de pedras compridas ao longo
 * do arco, com as juntas desencontradas de um degrau para o outro, o miolo da pisada gasto e mais claro, o focinho
 * arredondado, o pé do degrau de cima juntando sombra e uns veios finos. Pela diagonal sobe a ESCADA do corredor:
 * em cada degrau, a metade da frente vira um meio-degrau (dois passos por degrau).
 *
 * O meio do anel fica no canto de BAIXO À DIREITA da pegada no giro 0: quatro peças giradas (0, 90, 180 e 270)
 * fecham o anel inteiro. Com 4 x 4 casas o raio de dentro tem 2 casas e abraça o Fosso de arena de 4 x 4
 * (`fossoDeArena.ts`). É onde se senta: NÃO barra, e é objeto de chão (o token fica em cima).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): cada degrau é um quarto de anel em fatias. De cima
 * aparece a pisada de cada um; a sombra que o degrau de cima faz no de baixo é pintada na pisada, para o lado da
 * sombra NA TELA (o desenho lê `c.giro`), e a luz do focinho sai do chanfro do motor: o anel fechado tem um lado
 * aceso e o outro na sombra, como uma coisa só. Na 3/4 cada fatia sobe a altura dela e aparece o espelho de cada
 * degrau (ou o paredão de trás, nas peças de baixo do anel), com as juntas de pé, a fiada de cada degrau e a luz de
 * para onde a face olha. A ordem dos anéis na 3/4 sai do giro: o de dentro na frente nas peças de cima do anel, o
 * de fora na frente nas de baixo.
 *
 * Para a 3/4 caber no tempo, só vai em fatias o que alguma vista mostra: de cada degrau, do alto do degrau de baixo
 * até o alto dele (o resto fica atrás do degrau da frente) e as duas pontas cortadas, do chão para cima; da mureta,
 * tudo. As fatias de dentro são pintadas só em janelas de caixa justa (a conta da forma não corre no canto vazio do
 * quarto). As duas pontas de cada quarto são o corte da caixa, sem chanfro, contorno nem sombra no chão: lado a lado,
 * as quatro peças emendam sem risco, como um anel só (a peça sozinha fica com as pontas cortadas secas).
 *
 * As medidas saem do menor lado (o raio de fora é ele). Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`.
 * Material: `pedra` (sugestão: ardósia, a pedra escura do mapa). Nada é fixo além da pedra.
 */
import { hash } from '../../ruido'
import { dentroDe, menos, type Caixa, type Forma } from './formas'
import { ruido, texturaDaClasse, type Sombra, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, noObjeto, novoFatiador, rumoDaSombra, type OpcoesDaFatia } from './pilhaDeFatias'
import { lisa, luzDaNormal } from './apoioDasReferencias'
import { anelExato, escuroDe, passo } from './fossoDeArena'

/** Os raios, em fração do menor lado: a beira de dentro, o fim de cada um dos três degraus e a beira de fora da mureta. */
const RAIOS = [0.5, 0.655, 0.81, 0.965, 1] as const
/** A altura de um degrau e a da mureta acima do último (casas). */
const ALTURA_DO_DEGRAU = 0.17
const ALTURA_DA_MURETA = 0.13
/** O corredor da escada, pela diagonal: a meia largura (casas). */
const MEIO_CORREDOR = 0.3
/** O comprimento de uma pedra do degrau, pelo arco (casas). */
const PEDRA = 1.15
/** O passo das fatias (px do protótipo) e a fundura da ponta cortada que vai em fatias (px: mais que o passo). */
const PASSO = 2
const PONTA = 3.2
/** O tom da pisada de cada degrau (o de cima pega mais luz: de cima, o anel lê como uma bacia), do espelho e da mureta. */
const TOM = { pisada: [0.9, 0.96, 1.02], espelho: 0.84, mureta: 1.08 } as const
/** A sombra pintada do degrau de cima: quantas vezes o rumo da sombra do motor ela anda por px de altura, e a força. */
const SOMBRA = { alonga: 2.3, forca: 0.28 } as const
const RAIZ_DE_MEIO = Math.SQRT1_2
const QUARTO_DE_VOLTA = Math.PI / 2

export const montarArquibancadaDePedra: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const daPedra = texturaDaClasse(pedra.classe)
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = escuroDe(pedra)
  const lado = 2 * Math.min(hw, hh)
  const [cx, cy] = [hw, hh]
  const raio = RAIOS.map((r) => r * lado)
  const dz = g * ALTURA_DO_DEGRAU
  const zMureta = 3 * dz + g * ALTURA_DA_MURETA
  const meioCorredor = g * MEIO_CORREDOR
  const pegada: Caixa = [-hw, -hh, hw, hh]
  /** A distância (com sinal) do ponto à beira do corredor da escada: a faixa da diagonal que sai do meio do anel. */
  const aoCorredor = (x: number, y: number, meia: number): number => Math.abs((x - cx - (y - cy)) * RAIZ_DE_MEIO) - meia
  const corredor = (meia: number): Forma => ({ b: pegada, d: (x, y) => aoCorredor(x, y, meia) })
  /**
   * O quarto de anel entre `r0` e `r1`: o anel inteiro, pintado só na caixa do quarto. As duas pontas são o corte da
   * caixa, sem chanfro nem contorno: quatro peças lado a lado emendam sem risco, como um anel só.
   */
  const quarto = (r0: number, r1: number): Forma => ({
    b: [cx - r1, cy - r1, cx, cy],
    d(x, y) {
      const r = Math.hypot(x - cx, y - cy)
      return Math.max(r0 - r, r - r1)
    },
  })
  const [rx, ry] = rumoDaSombra(q)
  /** Para onde fica "para baixo na tela", no referencial do objeto. */
  const paraBaixo = noObjeto(0, 1, q)

  /** O quanto do arco o ponto já andou, de 0 (a ponta de baixo, a oeste do meio) a 1 (a ponta da direita, ao norte). */
  const noArco = (x: number, y: number): number => {
    const a = Math.atan2(y - cy, x - cx)
    return ((a > 0 ? a - 2 * Math.PI : a) + Math.PI) / QUARTO_DE_VOLTA
  }
  /** As pedras do degrau `i` (1 a 4, a mureta): quantas cabem no arco. */
  const pedrasDo = (i: number): number => Math.max(2, Math.round((QUARTO_DE_VOLTA * (raio[i - 1] + raio[i])) / 2 / (g * PEDRA)) + (i === 4 ? 1 : 0))
  /** A junta de pé mais perto do ponto, em px pelo arco, e a pedra em que ele está (as juntas desencontram de um degrau para o outro). */
  const junta = (x: number, y: number, i: number): [number, number] => {
    const n = pedrasDo(i)
    const k = noArco(x, y) * n + (i % 2 === 0 ? 0.5 : 0)
    const rr = Math.hypot(x - cx, y - cy)
    return [Math.abs(k - Math.round(k)) * ((QUARTO_DE_VOLTA * rr) / n), Math.floor(k)]
  }

  /** O escuro que o que é mais alto faz no ponto, na pisada do degrau `i` (ou no meio-degrau dele): 0 a 1. */
  const sombraDoAlto = (x: number, y: number, i: number, meio: boolean): number => {
    const altura = meio || (i < 3 && aoCorredor(x, y, meioCorredor) < 0) ? dz / 2 : i < 3 ? dz : zMureta - 3 * dz
    const [px, py] = [x - rx * altura * SOMBRA.alonga, y - ry * altura * SOMBRA.alonga]
    const rr = Math.hypot(px - cx, py - cy)
    const fundo = meio ? Math.max(rr - (raio[i - 1] + raio[i]) / 2, aoCorredor(px, py, meioCorredor)) : rr - raio[i]
    return passo(-0.5, 1.1, fundo)
  }

  /** A PISADA do degrau `i`: as juntas, o tom de cada pedra, o miolo gasto, o focinho, o pé do de cima e a sombra dele. */
  const pisada = (i: number, meio: boolean): Textura => {
    const [r0, r1] = meio ? [raio[i - 1], (raio[i - 1] + raio[i]) / 2] : [raio[i - 1], raio[i]]
    return (u, v, x, y, p, s, escala) => {
      if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
      const rr = Math.hypot(x - cx, y - cy)
      const [ate, qual] = junta(x, y, i)
      let luz = (hash(qual, i, 5103) - 0.5) * 0.09
      if (!meio) luz -= ate < 0.5 ? 0.2 : ate < 1.5 ? 0.05 : 0
      const t = (rr - r0) / (r1 - r0)
      luz += 0.06 * Math.exp(-(((t - 0.4) / 0.2) ** 2))
      luz += 0.07 * passo(r0 + 2.2, r0 + 0.4, rr) - 0.1 * passo(r1 - 3.4, r1, rr)
      // Os veios finos da pedra lisa: a linha onde um ruído largo passa pelo zero, só em alguns trechos.
      if (Math.abs(ruido(x * 0.045 + i * 7.3, y * 0.045)) < 0.011 && ruido(x * 0.02 + 3.7, y * 0.02 + i) > 0.04) luz -= 0.08
      luz -= SOMBRA.forca * sombraDoAlto(x, y, i, meio)
      s[3] += luz
    }
  }

  /**
   * A FACE de uma fatia de dentro (o espelho do degrau, o paredão, a ponta cortada): a luz de para onde ela olha na
   * tela, o grão ao longo da face e pela altura (a textura do material, lida deitada, repetia igual em cada fatia e
   * virava hachura), a junta de pé, a fiada de cada degrau, o focinho e o pé.
   */
  const face = (i: number, z: number, forma: Forma, topo: number): Textura => (_u, _v, x, y, _p, s) => {
    // A ponta cortada olha para fora da pegada (o corte é o da caixa, a forma não sabe dele); o resto, para onde a
    // forma manda. O que a 3/4 mostra de cada fatia é a faixa logo acima da beira que fica embaixo NA TELA: a face é
    // a da ponta quando, um passo para baixo na tela, o ponto já saiu da caixa.
    const [embaixo, naDireita] = [y + paraBaixo[1] * (PASSO + 0.6) > hh, x + paraBaixo[0] * (PASSO + 0.6) > hw]
    let [nx, ny] = [naDireita ? 1 : 0, embaixo ? 1 : 0]
    if (!embaixo && !naDireita) {
      const gx = forma.d(x + 0.5, y) - forma.d(x - 0.5, y)
      const gy = forma.d(x, y + 0.5) - forma.d(x, y - 0.5)
      const gl = Math.hypot(gx, gy) || 1
      nx = gx / gl
      ny = gy / gl
    }
    let luz = luzDaNormal(nx, ny, 0, q) * 1.3
    const ao = x + y
    luz += ruido(ao * 0.05 + i * 3.1, z * 0.2) * 0.09 + ruido(ao * 0.28, z * 0.45 + 9) * 0.035
    // Na ponta cortada não há junta de pé: ela é o corte da própria pedra.
    if (!embaixo && !naDireita && junta(x, y, i)[0] < 0.5) luz -= 0.14
    const naFiada = z - Math.floor(z / dz + 1e-6) * dz
    if (z > 0.5 && naFiada < 0.8 && z < 3 * dz + 0.5) luz -= 0.1
    luz += 0.06 * passo(topo - 2.4, topo, z) - 0.05 * passo(2.5, 0, z)
    s[3] += luz
  }

  /**
   * As JANELAS de pintura do quarto de anel entre `r0` e `r1`: a caixa justa de cada um de `n` gomos. A fatia de
   * dentro é pintada só nelas (a mesma forma, com a caixa menor): a conta da forma não corre no canto vazio do quarto.
   */
  const janelasDe = (r0: number, r1: number, n: number): Caixa[] =>
    Array.from({ length: n }, (_, j) => {
      const b = [Infinity, Infinity, -Infinity, -Infinity]
      for (let i = 0; i <= 6; i += 1) {
        const a = Math.PI + ((j + i / 6) * QUARTO_DE_VOLTA) / n
        for (const r of [r0, r1]) {
          b[0] = Math.min(b[0], cx + Math.cos(a) * r)
          b[1] = Math.min(b[1], cy + Math.sin(a) * r)
          b[2] = Math.max(b[2], cx + Math.cos(a) * r)
          b[3] = Math.max(b[3], cy + Math.sin(a) * r)
        }
      }
      return [b[0] - 1, b[1] - 1, Math.min(cx, b[2] + 1), Math.min(cy, b[3] + 1)] as const
    })
  /** Uma fatia de dentro (sem chanfro nem contorno), pintada só nas janelas dadas. */
  const deDentro = (camada: number, z: number, forma: Forma, janelas: readonly Caixa[], o: OpcoesDaFatia): void => {
    for (const janela of janelas) f.fatia(camada, z, { b: janela, d: forma.d }, pedra, o)
  }
  /** As janelas das duas pontas cortadas do anel entre `r0` e `r1`: a de baixo (olha para baixo) e a da direita. */
  const pontas = (r0: number, r1: number): Caixa[] => [[cx - r1 - 1, hh - PONTA, cx - r0 + 1, hh], [hw - PONTA, cy - r1 - 1, hw, cy - r0 + 1]]

  // Os três DEGRAUS, de dentro para fora, e a ordem deles na 3/4: nas peças de cima do anel (giros 0 e 90) o de
  // dentro fica na frente; nas de baixo (180 e 270), o de fora.
  const camadaDo = (i: number): number => 10 * (q < 2 ? 4 - i : i)
  for (let i = 1; i <= 3; i += 1) {
    const [zBase, zi] = [(i - 1) * dz, i * dz]
    const zMeio = zi - dz / 2
    const rMeio = (raio[i - 1] + raio[i]) / 2
    const cheio = quarto(raio[i - 1], raio[i] + 2)
    // No corredor, a metade da frente do degrau é um meio-degrau: o degrau de cima tem esse vão recortado.
    const vao = dentroDe(anelExato(cx, cy, raio[i - 1] - 6, rMeio), corredor(meioCorredor))
    const recortado = menos(cheio, vao)
    // A caixa do meio-degrau é só a do trecho do corredor (a do anel inteiro custava um quarto de pegada por fatia).
    const [lx, ly] = [cx - rMeio * RAIZ_DE_MEIO, cy - rMeio * RAIZ_DE_MEIO]
    const folga = (raio[i] - raio[i - 1]) / 2 + meioCorredor + 3
    const noCorredor = dentroDe(anelExato(cx, cy, raio[i - 1], rMeio + 1.6), corredor(meioCorredor + 1.2))
    const meioDegrau: Forma = { b: [lx - folga, ly - folga, lx + folga, ly + folga], d: noCorredor.d }
    const K = camadaDo(i)
    const janelas = janelasDe(raio[i - 1], raio[i] + 2, 3)
    // As pontas cortadas, do chão até o alto do degrau de baixo (o miolo fica atrás do degrau da frente).
    // Vão numa camada ANTES das fatias do degrau: dentro da camada a ordem sai do meio da caixa, e a caixa da ponta
    // fica mais embaixo que a do degrau (a ponta seria pintada por cima da fatia mais alta que ela).
    if (i > 1) for (const z of alturas(0, zBase, PASSO).slice(0, -1)) deDentro(K - 0.1, z, cheio, pontas(raio[i - 1], raio[i] + 2), lisa(TOM.espelho, face(i, z, cheio, zMeio), 5110 + i))
    for (const z of alturas(zBase, zMeio, PASSO)) deDentro(K, z, cheio, janelas, lisa(TOM.espelho, face(i, z, cheio, zMeio), 5110 + i))
    f.fatia(K + 0.1, zMeio, meioDegrau, pedra, { tabua: 0, bisel: 1, tom: TOM.pisada[i - 1] * 1.03, contorno: 0.22, textura: pisada(i, true), semente: 5120 + i })
    const deCima = alturas(zMeio, zi, PASSO).slice(1)
    deCima.forEach((z, k) => {
      if (k < deCima.length - 1) deDentro(K + 0.2, z, recortado, janelas, lisa(TOM.espelho, face(i, z, recortado, zi), 5110 + i))
      // A pisada vai numa camada depois das fatias de dentro: a ordem da 3/4 dentro da camada sai do meio da caixa de
      // cada fatia, e as janelas têm caixas diferentes da pisada.
      else f.fatia(K + 0.3, z, recortado, pedra, { tabua: 0, arco: { cx, cy, r: rMeio, a0: -Math.PI * 0.75 }, bisel: 1.4, tom: TOM.pisada[i - 1], contorno: 0.24, textura: pisada(i, false), semente: 5130 + i })
    })
  }

  // A MURETA de capeamento, atrás do último degrau: o paredão inteiro, do chão para cima.
  const mureta = quarto(raio[3], raio[4] - 0.4)
  const capa: Textura = (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
    const [ate, qual] = junta(x, y, 4)
    s[3] += (hash(qual, 4, 5103) - 0.5) * 0.09 - (ate < 0.5 ? 0.2 : 0)
  }
  const janelasDaMureta = janelasDe(raio[3], raio[4], 6)
  const fiadas = alturas(0, zMureta, PASSO)
  fiadas.forEach((z, k) => {
    if (k < fiadas.length - 1) deDentro(camadaDo(4), z, mureta, janelasDaMureta, lisa(TOM.espelho, face(4, z, mureta, zMureta), 5141))
    else f.fatia(camadaDo(4) + 0.3, z, mureta, pedra, { tabua: 0, arco: { cx, cy, r: (raio[3] + raio[4]) / 2, a0: -Math.PI * 0.75 }, bisel: 1.5, tom: TOM.mureta, contorno: 0.26, textura: capa, semente: 5140 })
  })
  f.fechar()

  // As SOMBRAS no chão, já desenhadas para o lado da sombra na tela: o pé do anel e o arrasto da mureta (para fora) e
  // do primeiro degrau (para o fosso), em janelas justas. Todas acabam ANTES das duas pontas cortadas (a borda
  // esfumada inteira fica dentro da pegada): a sombra de uma peça não cai em cima da vizinha, e o anel emenda limpo.
  const sombras: Sombra[] = []
  const noChao = (anel: Forma, janela: Caixa, z: number, suave: number): void => {
    const n = Math.max(1, Math.ceil(z / 7))
    const [ox, oy] = [rx * z, ry * z]
    const forma: Forma = {
      b: [janela[0] + Math.min(0, ox), janela[1] + Math.min(0, oy), Math.min(cx, janela[2] + Math.max(0, ox)), Math.min(cy, janela[3] + Math.max(0, oy))],
      d(x, y) {
        let menor = Infinity
        for (let j = 0; j <= n; j += 1) {
          const v = anel.d(x - (ox * j) / n, y - (oy * j) / n)
          if (v < menor) menor = v
        }
        return Math.max(menor, x - cx + suave * 2, y - cy + suave * 2)
      },
    }
    sombras.push({ forma, z: 0, forca: 0.3, suave })
  }
  noChao(quarto(raio[0], raio[4] - 0.4), [cx - raio[4], cy - raio[4], cx, cy], 0, 1.3)
  for (const janela of janelasDaMureta) noChao(quarto(raio[3], raio[4] - 0.4), janela, zMureta, 1.2 + 0.07 * zMureta)
  for (const janela of janelasDe(raio[0], raio[1], 3)) noChao(quarto(raio[0], raio[1]), janela, dz, 1.2 + 0.07 * dz)
  cena.sombras.push(...sombras)
}
