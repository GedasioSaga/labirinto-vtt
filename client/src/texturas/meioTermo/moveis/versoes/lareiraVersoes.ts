/**
 * As VERSÕES da lareira (L03 do plano de arte por tema, 28/11/2026): a 1ª, Simples, é o desenho de `MONTADORES`
 * (`../lareira.ts`). A outra é a LAREIRA DE SALÃO, a do castelo: mais larga e mais alta, toda de pedra lavrada (as
 * pedras em fiadas regulares, de quina chanfrada), o PEITO da chaminé com a moldura em volta e o BRASÃO de pedra em
 * relevo no meio (o escudo com a asna), as duas MÍSULAS de pedra em voluta que seguram o CONSOLO de madeira
 * grosso, as OMBREIRAS como pilastras com base e capitel, os CÃES de ferro altos com a bola e a SOLEIRA de três lajes
 * grandes com a beira moldurada.
 *
 * O FOGO continua o da lareira ("Fogo": Aceso | Apagado, a `variante`, separada da versão): o lar fica no mesmo lugar
 * (`LAREIRA.fogo` de `lib/mobilia/fogoDeCasa.ts`), de modo que as línguas animadas e a luz nascem em cima das brasas
 * pintadas aqui, sem mudar nada da animação. Acesa: as toras queimam, as brasas acendem e o halo pega o lar e a
 * soleira. Apagada: a lenha fria, a cinza e o carvão.
 *
 * Lugares de material (os da lareira): `pedra` (toda a pedra) e `madeira` (o consolo).
 */
import { LAREIRA } from '../../../../lib/mobilia/fogoDeCasa'
import { caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma } from '../formas'
import { contato } from '../motor'
import { BURACO, CINZA, materialDaPeca, PREGO, type MontarMovel } from '../contexto'
import { alvenaria, brasas, FOGO_PARADO, texCinza, texFuligem, texHalo, texLenhaQueimada } from '../fogoDeCasa'
import type { VersoesDesenhadas } from '.'

/** As alturas, em casas: o peito da chaminé, o consolo (solto), as ombreiras e a soleira. Mais altas que as da simples. */
const ALTURA_DA_CHAMINE = 1.3
const ALTURA_DO_CONSOLO = 1.08
const ALTURA_DA_OMBREIRA = 1
const ALTURA_DA_SOLEIRA = 0.07
const ALFA_DO_HALO = 0.22
const ALFA_DO_HALO_NA_SOLEIRA = 0.11

/** A planta da lareira de salão, em fração da pegada (centro na origem, frente embaixo). O lar é o da lareira. */
const PEITO = { meiaLargura: 0.45, de: -0.5, ate: -0.2 }
const CONSOLO = { meiaLargura: 0.495, de: -0.255, ate: -0.115 }
const OMBREIRA = { de: 0.3, ate: 0.475 }
const LAR = { meiaLargura: 0.3, de: -0.13, ate: 0.3 }
const SOLEIRA = { meiaLargura: 0.5, de: 0.28, ate: 0.5 }
/** O brasão no peito: o meio (fração da altura) e a meia largura do escudo (fração da largura). */
const Y_DO_BRASAO = -0.37
const MEIO_DO_BRASAO = 0.066

export const montarLareiraDeSalao: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const pedra = c.m.pedra
  const mad = c.m.madeira
  const ferro = PREGO
  const lenha = materialDaPeca('lenhaCarvalho')
  const acesa = c.variante !== 1
  const R = Math.min(w / 2, h)
  const X = (f: number): number => f * w
  const Y = (f: number): number => f * h
  const fx = X(LAREIRA.fogo.x)
  const fy = Y(LAREIRA.fogo.y)

  const formaPeito = caixa(-X(PEITO.meiaLargura), Y(PEITO.de), X(PEITO.meiaLargura), Y(PEITO.ate), 1.6)
  const formaConsolo = caixa(-X(CONSOLO.meiaLargura), Y(CONSOLO.de), X(CONSOLO.meiaLargura), Y(CONSOLO.ate), 1.2)
  const ombreiras = [-1, 1].map((lado) => {
    const [a, b] = [lado * X(OMBREIRA.de), lado * X(OMBREIRA.ate)]
    const [x0, x1] = [Math.min(a, b), Math.max(a, b)]
    return { lado, x0, x1, forma: caixa(x0, Y(LAR.de), x1, Y(LAR.ate), 1.2) }
  })
  const formaLar = caixa(-X(LAR.meiaLargura), Y(LAR.de), X(LAR.meiaLargura), Y(LAR.ate), 0.6)
  const formaSoleira = caixa(-X(SOLEIRA.meiaLargura), Y(SOLEIRA.de), X(SOLEIRA.meiaLargura), Y(SOLEIRA.ate), 1.4)

  cena.sombras.push(
    { forma: formaPeito, z: g * ALTURA_DA_CHAMINE },
    { forma: formaConsolo, z: g * ALTURA_DO_CONSOLO, solta: true, forca: 0.26 },
    ...ombreiras.map((o) => ({ forma: o.forma, z: g * ALTURA_DA_OMBREIRA })),
    { forma: formaSoleira, z: g * ALTURA_DA_SOLEIRA, forca: 0.22 },
    contato(formaPeito),
    contato(formaSoleira, 0.2),
  )
  const L = cena.partes

  // O LAR: a pedra do chão da boca, escura de fuligem no fundo; a cinza, o halo, os cães de ferro e as toras.
  L.push(P(formaLar, pedra, { tabua: 0, bisel: 0.6, tom: 0.58, contorno: 0.1, textura: texFuligem(Y(LAR.de), Y(LAR.ate), 0.45), semente: 801 }))
  L.push(P(elipse(fx, fy + Y(0.02), X(0.22), Y(0.18)), CINZA, { textura: texCinza(fx, fy, X(0.22)), bisel: 0, contorno: 0, suave: 0.8, semente: 802 }))
  if (acesa) L.push(P(elipse(fx, fy, X(0.26), Y(0.32)), FOGO_PARADO, { textura: texHalo(fx, fy, X(0.26), Y(0.32), ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 803 }))
  for (const lado of [-1, 1]) {
    const x = lado * X(0.15)
    L.push(P(capsula(x, Y(-0.07), x, Y(0.22), 1), ferro, { bisel: 0.9, contorno: 0.2, semente: 810 + lado }))
    L.push(P(capsula(x - lado * 1.6, Y(0.22), x + lado * 1.6, Y(0.22), 0.8), ferro, { bisel: 0.6, contorno: 0.2, semente: 814 + lado }))
    L.push(P(elipse(x, Y(0.2), 2.1, 2.1), ferro, { bisel: 1.5, contorno: 0.22, metal: 0.5, projeta: { dist: 0.7, forca: 0.26 }, semente: 812 + lado }))
  }
  const raio = Math.max(2.6, Y(0.068))
  const queima = acesa ? 0.55 : 0.35
  const toras: [number, number, number, number][] = [
    [X(-0.23), Y(0.02), X(0.2), Y(-0.01)],
    [X(-0.19), Y(0.12), X(0.24), Y(0.15)],
    [X(-0.08), Y(0.05), X(0.1), Y(0.2)],
  ]
  toras.forEach(([ax, ay, bx, by], k) => {
    L.push(P(capsula(ax, ay, bx, by, k === 2 ? raio * 0.8 : raio), lenha, { eixo: Math.atan2(by - ay, bx - ax), textura: texLenhaQueimada(fx, fy, X(0.16), queima), bisel: raio, contorno: 0.2, semente: 820 + k, projeta: { dist: 1, forca: 0.3 } }))
  })
  brasas(c, L, fx, fy + Y(0.05), X(0.13), Y(0.08), acesa ? 7 : 5, Math.max(1.1, R * 0.03), acesa, 830)

  // As OMBREIRAS em pilastra: o fuste em fiadas, o capitel saliente atrás e a base na frente.
  ombreiras.forEach((o, i) => {
    alvenaria(c, L, o.forma, o.x0, Y(LAR.de), o.x1, Y(LAR.ate), 4, 1, pedra, 840 + i * 20)
    L.push(P(caixa(o.x0 - 0.8, Y(LAR.ate) - Y(0.07), o.x1 + 0.8, Y(LAR.ate), 0.8), pedra, { tabua: 0, bisel: 1, tom: 1.06, contorno: 0.26, semente: 858 + i * 20, projeta: { dist: 0.8, forca: 0.28 } }))
  })
  // A SOLEIRA: três lajes grandes, a beira moldurada (o filete claro) e o halo do fogo pegando nelas.
  alvenaria(c, L, formaSoleira, -X(SOLEIRA.meiaLargura), Y(SOLEIRA.de), X(SOLEIRA.meiaLargura), Y(SOLEIRA.ate), 1, 3, pedra, 880)
  L.push(P(caixa(-X(SOLEIRA.meiaLargura) + 1, Y(SOLEIRA.ate) - 1.8, X(SOLEIRA.meiaLargura) - 1, Y(SOLEIRA.ate) - 0.8, 0.5), pedra, { tabua: 0, bisel: 0.4, tom: 1.12, contorno: 0, semente: 886 }))
  if (acesa) {
    const hy = Y(SOLEIRA.de)
    L.push(P(dentroDe(elipse(fx, hy, X(0.36), Y(0.28)), formaSoleira), FOGO_PARADO, { textura: texHalo(fx, hy, X(0.36), Y(0.28), ALFA_DO_HALO_NA_SOLEIRA), bisel: 0, contorno: 0, semente: 890 }))
  }

  // O PEITO DA CHAMINÉ em pedra lavrada: as fiadas regulares, a moldura em volta, a boca no fundo e o brasão no meio.
  alvenaria(c, L, formaPeito, -X(PEITO.meiaLargura), Y(PEITO.de), X(PEITO.meiaLargura), Y(PEITO.ate), 2, 6, pedra, 900)
  const m = 2.2
  const moldura = caixa(-X(PEITO.meiaLargura) + 0.6, Y(PEITO.de) + 0.6, X(PEITO.meiaLargura) - 0.6, Y(PEITO.ate) - 0.6, 1.4)
  const vaoDaMoldura = caixa(-X(PEITO.meiaLargura) + m, Y(PEITO.de) + m, X(PEITO.meiaLargura) - m, Y(PEITO.ate) - m, 1)
  L.push(P({ b: moldura.b, d: (x, y) => Math.max(moldura.d(x, y), -vaoDaMoldura.d(x, y)) }, pedra, { tabua: 0, bisel: 0.8, tom: 1.08, contorno: 0.22, semente: 930 }))
  for (const lado of [-1, 1]) {
    L.push(P(caixa(lado * X(0.3) - X(0.06), Y(-0.47), lado * X(0.3) + X(0.06), Y(-0.41), 1), BURACO, { bisel: 0.5, contorno: 0.15, recesso: { k: 1.1, forca: 0.35 }, semente: 931 + lado }))
  }
  const ye = Y(Y_DO_BRASAO)
  const me = X(MEIO_DO_BRASAO)
  const alto = me * 2.2
  const escudo = (k: number): Forma => poligono([[-me + k, ye - alto * 0.45 + k], [me - k, ye - alto * 0.45 + k], [me - k, ye + alto * 0.08], [me * 0.5, ye + alto * 0.38 - k * 0.5], [0, ye + alto * 0.55 - k * 1.2], [-me * 0.5, ye + alto * 0.38 - k * 0.5], [-me + k, ye + alto * 0.08]])
  L.push(P(escudo(0), pedra, { tabua: 0, bisel: 1, tom: 1.1, contorno: 0.3, semente: 940, projeta: { dist: 1.1, forca: 0.32 } }))
  L.push(P(escudo(1.4), pedra, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.12, recesso: { k: 0.8, forca: 0.25 }, semente: 941 }))
  const asna = dentroDe(poligono([[-me, ye + alto * 0.2], [0, ye - alto * 0.16], [me, ye + alto * 0.2], [me, ye + alto * 0.38], [0, ye + alto * 0.04], [-me, ye + alto * 0.38]]), escudo(1.4))
  L.push(P(asna, pedra, { tabua: 0, bisel: 0.6, tom: 1.12, contorno: 0.2, semente: 942 }))

  // As MÍSULAS de pedra em voluta nas pontas, debaixo do consolo, e o CONSOLO de madeira grosso com a beira moldurada.
  for (const lado of [-1, 1]) {
    const x = lado * X((OMBREIRA.de + OMBREIRA.ate) / 2)
    const misula = uniao(caixa(x - X(0.07), Y(-0.15), x + X(0.07), Y(-0.07), 1), elipse(x, Y(-0.06), X(0.06), Y(0.045)))
    L.push(P(misula, pedra, { tabua: 0, bisel: 1.2, tom: 1.04, contorno: 0.28, semente: 950 + lado, projeta: { dist: 1, forca: 0.3 } }))
    L.push(P(elipse(x, Y(-0.06), X(0.03), Y(0.022)), pedra, { tabua: 0, bisel: 0.6, tom: 0.84, contorno: 0.16, recesso: { k: 0.7, forca: 0.3 }, semente: 952 + lado }))
  }
  L.push(P(formaConsolo, mad, { tabua: 0, eixo: 0, bisel: 1.6, contorno: 0.26, semente: 960, projeta: { dist: 1.8, forca: 0.33 } }))
  L.push(P(caixa(-X(CONSOLO.meiaLargura) + 1, Y(CONSOLO.ate) - 2, X(CONSOLO.meiaLargura) - 1, Y(CONSOLO.ate) - 0.6, 0.5), mad, { tabua: 0, eixo: 0, bisel: 0.4, tom: 0.8, contorno: 0, semente: 961 }))
  L.push(P(caixa(-X(CONSOLO.meiaLargura) + 1.4, Y(CONSOLO.de) + 0.8, X(CONSOLO.meiaLargura) - 1.4, Y(CONSOLO.de) + 1.8, 0.4), mad, { tabua: 0, eixo: 0, bisel: 0.3, tom: 1.12, contorno: 0, semente: 962 }))
}

export const versoesDoLareira: VersoesDesenhadas = {
  salao: montarLareiraDeSalao,
}
