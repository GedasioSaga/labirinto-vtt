/**
 * BANHEIRA MODERNA de cima com volume (banheiro moderno, pedido do mestre de 15/11/2026): a banheira RETANGULAR
 * EMBUTIDA, branca, cheia, com a TORNEIRA de CROMO. De cima se vê o DECK liso em volta (mais largo nas duas pontas),
 * a BACIA de cantos macios com a parede de dentro na sombra do deck do lado da luz e o encosto inclinado à esquerda
 * (sobra mais parede acima da água), a ÁGUA clara com a beira rasa e dois reflexos, o RALO e o LADRÃO de cromo na
 * ponta dos pés e, no deck dessa ponta, a bica larga em cascata, o misturador monocomando e o chuveirinho deitado.
 * No deck da cabeceira, a TOALHA dobrada. A banheira de pés (a antiga) é a louça roliça com espuma e pés de garra;
 * esta é o retângulo branco reto, e o que diz "banheira" de longe é a água clara no meio do branco.
 *
 * NA 3/4 a frente mostra o AVENTAL do embutido, desenhado de frente e guardado em faixas debaixo do deck (a frente em
 * faixas do guarda-roupa, `guardaRoupa.ts`): o painel branco, a beira redonda do deck que pega a luz, a sombra
 * dela no painel e o rodapé recuado no pé. Girada, a 3/4 mostra embaixo a ponta (um quarto de volta) ou o avental
 * de trás (meia volta), desenhados do mesmo jeito (`guardarFaceGirada`). O perfil da 3/4 é sem beirada
 * (`tresQuartos.ts`), como o da geladeira.
 *
 * Material: `toalha` (a toalha dobrada). A louça, a água e o cromo são fixos.
 */
import { limitar01, type Rgb } from '../../ruido'
import { caixa, capsula, elipse, type Forma } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { LENCOL, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, fatiar, guardarFaceGirada, naFaixa, type Faixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { quartosDoGiro } from './pipaDeitada'
import { BRILHO_DO_CROMO, CROMO, ESCURO, LOUCA, PISO_DO_BANHEIRO, REFLEXO, texLouca } from './apoioDoBanheiroModerno'

/** A altura do deck, em casas. */
const ALTURA = 0.4
/** O deck visto de cima (px do protótipo): nos lados compridos e nas duas pontas (a da cabeceira leva a toalha, a dos pés a torneira). */
const DECK_DO_LADO = 5
const DECK_DA_PONTA = 10.5
/** O raio dos cantos da bacia, a parede que aparece acima da água e o que o encosto inclinado tem a mais (px). */
const RAIO_DA_BACIA = 11
const PAREDE = 2.4
const ENCOSTO = 6

/** A água do banho: clara e meio transparente (a louça branca do fundo aparece), e a beira rasa junto da parede. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x8f, 0xb9, 0xbd] }
const AGUA_RASA: Rgb = [0xc6, 0xdc, 0xd9]
const ALFA_DA_AGUA = 0.72
/** Para o lado da luz, no chão (os números do motor): o deck desse lado faz sombra na água. */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
const SOMBRA_DO_DECK = 3
const FORCA_DA_SOMBRA = 0.24
const RASO = 4.5

/** A água: a sombra do deck do lado da luz, a beira rasa e as marolas ao comprido. */
function texDaAgua(agua: Forma): Textura {
  return (_u, _v, x, y, p, s) => {
    const naSombra = limitar01(0.5 + agua.d(x + PARA_A_LUZ_X * SOMBRA_DO_DECK, y + PARA_A_LUZ_Y * SOMBRA_DO_DECK) / 2)
    const rasa = limitar01(1 + agua.d(x, y) / RASO)
    const t = rasa * rasa * 0.6
    s[0] += (AGUA_RASA[0] - s[0]) * t
    s[1] += (AGUA_RASA[1] - s[1]) * t
    s[2] += (AGUA_RASA[2] - s[2]) * t
    s[3] += ruido(x * 0.07 + p.su, y * 0.4) * 0.06 + ruido(x * 0.3, y * 0.7 + p.sv) * 0.025 - FORCA_DA_SOMBRA * naSombra
  }
}

// ---------- o avental, desenhado de frente ----------

/** O avental: a beira do deck (px), a sombra dela no painel e o rodapé recuado no pé (px). */
const BEIRA_DO_DECK = 2
const SOMBRA_DA_BEIRA = 2.4
const RODAPE = 2.2
/** O painel branco de frente: na sombra, mas mais claro que a frente lisa que a 3/4 varreria (0,74). */
const TOM_DO_PAINEL = 0.82
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x2f, 0x32] }

/** O avental de `meia` px de meia largura e `H` de altura, de frente: x na tela, y = 0 no chão e negativo para cima. */
function desenharAvental(meia: number, H: number): PecaDaFrente[] {
  const pecas: PecaDaFrente[] = []
  const por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente): void => {
    pecas.push({ forma, mat, o })
  }
  por(caixa(-meia, -H, meia, 0, 0.6), LOUCA, { tabua: 0, bisel: 0.9, tom: TOM_DO_PAINEL, contorno: 0.2, textura: texLouca, semente: 9330 })
  // O rodapé recuado, escuro, e a beira do painel por cima dele.
  por(caixa(-meia + 1, -RODAPE, meia - 1, 0, 0.3), LOUCA, { tabua: 0, bisel: 0.3, tom: 0.46, contorno: 0.1, recesso: { k: 1, forca: 0.3 }, semente: 9331 })
  // A sombra da beira do deck no alto do painel e a beira redonda, que pega a luz.
  por(caixa(-meia + 0.6, -H + BEIRA_DO_DECK - 0.4, meia - 0.6, -H + BEIRA_DO_DECK + SOMBRA_DA_BEIRA), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.2 })
  por(caixa(-meia, -H, meia, -H + BEIRA_DO_DECK, 0.7), LOUCA, { eixo: 0, tabua: 0, bisel: 0.9, tom: 1, contorno: 0.18, textura: texLouca, semente: 9332 })
  return pecas
}

export const montarBanheiraModerna: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  const toalha = c.m.toalha
  cena.corDoPiso = PISO_DO_BANHEIRO
  const H = g * ALTURA
  const L = cena.partes

  // O embutido: sem giro, a coluna até a frente e o avental guardado em faixas debaixo do deck; girado, a ponta ou
  // o avental de trás, guardados do mesmo jeito (`guardarFaceGirada`).
  const quartos = quartosDoGiro(c.giro)
  if (quartos === 0) {
    const { faixas, frente } = fatiar(H, 0, 0, h, hh)
    cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H })
    for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
    const avental = desenharAvental(hw, H)
    const guardar = (fx: Faixa): void => {
      if (fx.topo <= fx.pe) return
      cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
      for (const peca of avental) {
        const copia = naFaixa(P, peca, fx)
        if (copia !== null) L.push(copia)
      }
    }
    faixas.forEach(guardar)
  } else if (quartos % 2 === 1) {
    guardarFaceGirada(P, cena, quartos, H, { xa: -hh, xb: hh, y0: -hw, y1: hw, raio: 1 }, desenharAvental(hh, H))
  } else {
    guardarFaceGirada(P, cena, quartos, H, { xa: -hw, xb: hw, y0: -hh, y1: hh, raio: 1 }, desenharAvental(hw, H))
  }
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1), 0.3))

  // O DECK.
  L.push(P(caixa(-hw, -hh, hw, hh, 1.6), LOUCA, { bisel: 1.6, contorno: 0.24, textura: texLouca, semente: 9300 }))
  // A BACIA: a parede de dentro, na sombra do deck do lado da luz.
  const bx0 = -hw + DECK_DA_PONTA
  const bx1 = hw - DECK_DA_PONTA
  const by0 = -hh + DECK_DO_LADO
  const by1 = hh - DECK_DO_LADO
  L.push(P(caixa(bx0, by0, bx1, by1, RAIO_DA_BACIA), LOUCA, { bisel: 0.6, tom: 0.9, contorno: 0.26, recesso: { k: 3.4, forca: 0.36 }, textura: texLouca, semente: 9301 }))
  // A ÁGUA, com o encosto inclinado à esquerda (sobra mais parede acima dela).
  const ax0 = bx0 + PAREDE + ENCOSTO
  const ax1 = bx1 - PAREDE
  const agua = caixa(ax0, by0 + PAREDE, ax1, by1 - PAREDE, RAIO_DA_BACIA - PAREDE)
  // O ralo no fundo, visto pela água (fica por baixo dela).
  const xRalo = ax1 - 8
  L.push(P(elipse(xRalo, 0, 2.3, 2.3), CROMO, { bisel: 1.2, contorno: 0.26, metal: BRILHO_DO_CROMO, semente: 9302 }))
  for (const dy of [-0.9, 0, 0.9]) L.push(P(caixa(xRalo - 1.2, dy - 0.22, xRalo + 1.2, dy + 0.22), ESCURO, { bisel: 0, contorno: 0, alfa: 0.7, semente: 9303 }))
  L.push(P(agua, AGUA, { bisel: 0, contorno: 0.12, alfa: ALFA_DA_AGUA, textura: texDaAgua(agua), semente: 9304 }))
  // Os reflexos na água.
  const meioDaAgua = (ax0 + ax1) / 2
  const reflexos: readonly (readonly [number, number, number, number])[] = [
    [-0.42, -0.42, 14, 0.9],
    [0.12, -0.18, 7, 0.7],
    [-0.08, 0.38, 5, 0.6],
  ]
  reflexos.forEach(([fx, fy, meio, alta], i) => {
    const x = meioDaAgua + fx * (ax1 - ax0) * 0.5
    const y = fy * (by1 - by0) * 0.5
    L.push(P(elipse(x, y, meio, alta), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 1, semente: 9305 + i }))
  })
  // O LADRÃO na parede da ponta dos pés, acima da água.
  L.push(P(elipse(bx1 - 1.3, 0, 1.2, 2), CROMO, { bisel: 0.9, contorno: 0.26, metal: BRILHO_DO_CROMO, semente: 9308 }))

  // A TORNEIRA no deck dos pés: a bica larga em cascata (passa da beira sobre a água), o misturador e o chuveirinho.
  const xDeck = (bx1 + hw) / 2
  L.push(P(caixa(bx1 - 4.6, -2.6, xDeck + 1.2, 2.6, 1.2), CROMO, { eixo: 0, tabua: 0, bisel: 1.1, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9310, projeta: { dist: 1.6, forca: 0.3 } }))
  L.push(P(caixa(bx1 - 4.2, -1.6, bx1 - 3.4, 1.6), ESCURO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 9311 }))
  const yMisturador = -hh + DECK_DO_LADO + 5
  L.push(P(capsula(xDeck, yMisturador, xDeck + 3.6, yMisturador - 1.2, 0.7), CROMO, { bisel: 0.65, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9312, projeta: { dist: 1, forca: 0.28 } }))
  L.push(P(elipse(xDeck, yMisturador, 2.2, 2.2), CROMO, { bisel: 1.7, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9313, projeta: { dist: 1, forca: 0.28 } }))
  const yChuveirinho = hh - DECK_DO_LADO - 4
  L.push(P(capsula(xDeck, yChuveirinho - 3.8, xDeck, yChuveirinho + 3, 0.95), CROMO, { bisel: 0.9, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9314, projeta: { dist: 0.8, forca: 0.26 } }))
  L.push(P(elipse(xDeck, yChuveirinho - 4.6, 1.9, 1.6), CROMO, { bisel: 1.4, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9315, projeta: { dist: 0.8, forca: 0.26 } }))

  // A TOALHA dobrada no deck da cabeceira, com as duas listras da barra.
  const xt0 = -hw + 1.4
  const xt1 = bx0 - 1.2
  L.push(P(caixa(xt0, -8, xt1, 8, 1.1), toalha, { eixo: Math.PI / 2, bisel: 1.1, ruga: 0.5, contorno: 0.24, semente: 9320, projeta: { dist: 1, forca: 0.28 } }))
  for (const y of [5.2, 6.6]) L.push(P(caixa(xt0 + 0.5, y - 0.4, xt1 - 0.5, y + 0.4), LENCOL, { bisel: 0, contorno: 0, alfa: 0.85, semente: 9321 }))
}
