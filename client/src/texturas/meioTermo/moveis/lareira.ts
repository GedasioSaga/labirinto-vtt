/**
 * LAREIRA de pedra de cima com volume (29/10/2026). A frente é o lado de
 * baixo, como no fogão: o mestre encosta o fundo na parede e gira. De trás
 * para a frente: o PEITO DA CHAMINÉ de pedra em fiadas, com a boca escura da
 * chaminé no meio; o CONSOLO de madeira por cima da boca; as duas OMBREIRAS
 * de pedra; o LAR entre elas (o chão da boca, escurecido de fuligem no fundo),
 * com o leito de cinza, os cães de ferro e duas toras; e a SOLEIRA de lajes,
 * rente ao chão, na frente. A disposição mora em `lib/mobilia/fogoDeCasa.ts`
 * (a chama animada lê a mesma).
 *
 * ACESA (variante 0): as toras queimam no meio, as brasas acendem entre elas,
 * o halo quente fica no lar e um halo mais fraco pega a soleira. APAGADA
 * (variante 1): a lenha fria, a cinza e uns carvões escuros. A chama não
 * entra na imagem. A 25% de zoom sobram o bloco de pedra, a faixa de madeira
 * e a boca escura com o ponto quente: é o que diz "lareira" e não "fogão".
 * Materiais: `pedra` (tudo de pedra) e `madeira` (o consolo).
 */
import { LAREIRA } from '../../../lib/mobilia/fogoDeCasa'
import { caixa, capsula, dentroDe, elipse } from './formas'
import { contato } from './motor'
import { BURACO, CINZA, materialDaPeca, PREGO, type MontarMovel } from './contexto'
import { alvenaria, brasas, FOGO_PARADO, texCinza, texFuligem, texHalo, texLenhaQueimada } from './fogoDeCasa'

/** Alturas em casas: o peito da chaminé, o consolo (solto, a boca fica embaixo), as ombreiras e a soleira. */
const ALTURA_DA_CHAMINE = 1.1
const ALTURA_DO_CONSOLO = 0.95
const ALTURA_DA_OMBREIRA = 0.88
const ALTURA_DA_SOLEIRA = 0.06
/** O halo no lar e o que pega a soleira, alfa no centro (o da fogueira é 0,2). */
const ALFA_DO_HALO = 0.22
const ALFA_DO_HALO_NA_SOLEIRA = 0.11

export const montarLareira: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const pedra = c.m.pedra
  const mad = c.m.madeira
  const ferro = PREGO
  const lenha = materialDaPeca('lenhaCarvalho')
  const acesa = c.variante !== 1
  const R = Math.min(w / 2, h)
  const X = (f: number): number => f * w
  const Y = (f: number): number => f * h
  const { chamine: ch, consolo: co, ombreira: om, lar, soleira: so, fogo } = LAREIRA

  const formaChamine = caixa(-X(ch.meiaLargura), Y(ch.de), X(ch.meiaLargura), Y(ch.ate), 1.4)
  const formaConsolo = caixa(-X(co.meiaLargura), Y(co.de), X(co.meiaLargura), Y(co.ate), 1)
  const ombreiras = [-1, 1].map((lado) => {
    const a = lado * X(om.de)
    const b = lado * X(om.ate)
    return { lado, forma: caixa(Math.min(a, b), Y(lar.de), Math.max(a, b), Y(lar.ate), 1.2), x0: Math.min(a, b), x1: Math.max(a, b) }
  })
  const formaLar = caixa(-X(lar.meiaLargura), Y(lar.de), X(lar.meiaLargura), Y(lar.ate), 0.6)
  const formaSoleira = caixa(-X(so.meiaLargura), Y(so.de), X(so.meiaLargura), Y(so.ate), 1.2)

  cena.sombras.push(
    { forma: formaChamine, z: g * ALTURA_DA_CHAMINE },
    { forma: formaConsolo, z: g * ALTURA_DO_CONSOLO, solta: true, forca: 0.26 },
    ...ombreiras.map((o) => ({ forma: o.forma, z: g * ALTURA_DA_OMBREIRA })),
    { forma: formaSoleira, z: g * ALTURA_DA_SOLEIRA, forca: 0.22 },
    contato(formaChamine),
    contato(formaSoleira, 0.2),
  )
  const L = cena.partes

  // O LAR: a pedra do chão da boca, escura de fuligem no fundo.
  L.push(P(formaLar, pedra, { tabua: 0, bisel: 0.6, tom: 0.6, contorno: 0.1, textura: texFuligem(Y(lar.de), Y(lar.ate), 0.42), semente: 801 }))
  const fx = X(fogo.x)
  const fy = Y(fogo.y)
  L.push(P(elipse(fx, fy + Y(0.02), X(0.2), Y(0.17)), CINZA, { textura: texCinza(fx, fy, X(0.2)), bisel: 0, contorno: 0, suave: 0.8, semente: 802 }))
  if (acesa) L.push(P(elipse(fx, fy, X(0.24), Y(0.3)), FOGO_PARADO, { textura: texHalo(fx, fy, X(0.24), Y(0.3), ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 803 }))
  // Os cães de ferro, do fundo à frente, com a bolinha na ponta: a lenha deita em cima deles.
  for (const lado of [-1, 1]) {
    const x = lado * X(0.13)
    L.push(P(capsula(x, Y(-0.06), x, Y(0.22), 0.9), ferro, { bisel: 0.8, contorno: 0.2, semente: 810 + lado }))
    L.push(P(elipse(x, Y(0.23), 1.5, 1.5), ferro, { bisel: 1.2, contorno: 0.2, projeta: { dist: 0.6, forca: 0.25 }, semente: 812 + lado }))
  }
  // Duas toras atravessadas nos cães, a de trás um pouco mais alta; queimadas no meio quando acesa.
  const raio = Math.max(2.4, Y(0.065))
  const queima = acesa ? 0.55 : 0.35
  const toras: [number, number, number, number][] = [
    [X(-0.2), Y(0.03), X(0.17), Y(0.0)],
    [X(-0.16), Y(0.12), X(0.21), Y(0.15)],
  ]
  toras.forEach(([ax, ay, bx, by], k) => {
    L.push(P(capsula(ax, ay, bx, by, raio), lenha, {
      eixo: Math.atan2(by - ay, bx - ax),
      textura: texLenhaQueimada(fx, fy, X(0.15), queima),
      bisel: raio,
      contorno: 0.2,
      semente: 820 + k,
      projeta: { dist: 1, forca: 0.3 },
    }))
  })
  // As brasas no colo das toras (acesas) ou o carvão frio (apagada).
  brasas(c, L, fx, fy + Y(0.05), X(0.12), Y(0.08), acesa ? 6 : 4, Math.max(1.1, R * 0.03), acesa, 830)

  // As OMBREIRAS de pedra, em fiadas.
  ombreiras.forEach((o, i) => alvenaria(c, L, o.forma, o.x0, Y(lar.de), o.x1, Y(lar.ate), 3, 1, pedra, 840 + i * 20))
  // A SOLEIRA: lajes largas, rentes ao chão, e o halo fraco do fogo pegando nelas.
  alvenaria(c, L, formaSoleira, -X(so.meiaLargura), Y(so.de), X(so.meiaLargura), Y(so.ate), 1, 4, pedra, 880)
  if (acesa) {
    const hy = Y(so.de)
    L.push(P(dentroDe(elipse(fx, hy, X(0.34), Y(0.26)), formaSoleira), FOGO_PARADO, { textura: texHalo(fx, hy, X(0.34), Y(0.26), ALFA_DO_HALO_NA_SOLEIRA), bisel: 0, contorno: 0, semente: 890 }))
  }
  // O PEITO DA CHAMINÉ, em fiadas, e a boca escura dela no meio.
  alvenaria(c, L, formaChamine, -X(ch.meiaLargura), Y(ch.de), X(ch.meiaLargura), Y(ch.ate), 2, 5, pedra, 900)
  const bocaX = X(0.09)
  L.push(P(caixa(-bocaX, Y(-0.43), bocaX, Y(-0.29), 1), BURACO, { bisel: 0.6, contorno: 0.15, recesso: { k: 1.2, forca: 0.35 }, semente: 930 }))
  // O CONSOLO de madeira por cima da boca: a tábua grossa com a beira da frente.
  L.push(P(formaConsolo, mad, { tabua: 0, eixo: 0, bisel: 1.4, contorno: 0.25, semente: 940, projeta: { dist: 1.6, forca: 0.32 } }))
  L.push(P(caixa(-X(co.meiaLargura) + 1, Y(co.ate) - 1.6, X(co.meiaLargura) - 1, Y(co.ate) - 0.5, 0.5), mad, { tabua: 0, eixo: 0, bisel: 0.4, tom: 0.8, contorno: 0, semente: 941 }))
}
