/**
 * FORNALHA de ferreiro de cima com volume (29/10/2026). A frente é o lado de
 * baixo: o ferreiro trabalha de frente para ela. A BANCADA de pedra em fiadas,
 * com o LEITO de carvão afundado no meio e o FOGAREIRO (a cova redonda das
 * brasas, de aro de ferro); a COIFA da chaminé de pedra no fundo, por cima do
 * fogo; à esquerda, o FOLE de madeira e couro, soprando na cova pelo bico de
 * ferro; e a tenaz deitada na beira da frente. A cova é um MONTE de carvão
 * (pedras miúdas com volume), não um disco: o disco com o bico de ferro saindo
 * dele lia como uma frigideira. A disposição mora em
 * `lib/mobilia/fogoDeCasa.ts` (a chama animada lê a mesma).
 *
 * ACESA (variante 0): a cova cheia de brasas, o halo quente no leito. APAGADA
 * (variante 1): o carvão escuro e a cinza. A chama não entra na imagem. A 25%
 * de zoom sobram o bloco de pedra, o ponto quente no meio e a gota do fole ao
 * lado: é o que diz "fornalha" e não "poço". Materiais: `pedra` (a bancada e
 * a coifa) e `madeira` (o fole).
 */
import { FORNALHA } from '../../../lib/mobilia/fogoDeCasa'
import { caixa, capsula, elipse, poligono, uniao, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, CINZA, PREGO, type MontarMovel } from './contexto'
import { alvenaria, brasas, FOGO_PARADO, texCinza, texHalo } from './fogoDeCasa'

/** O couro do fole, fixo: castanho escuro e fosco, as pregas no ruído. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x4c, 0x38] }
/** Altura do fole (em fração do lado menor) e a da coifa (em casas). */
const ALTURA_DO_FOLE = 0.36
const ALTURA_DA_COIFA = 1.4
const ALFA_DO_HALO = 0.22

/** As pregas do couro: faixas mais escuras atravessando, um pouco tortas. */
const texCouro: Textura = (_u, _v, x, y, _p, s) => {
  s[3] += Math.sin(x * 1.1 + ruido(x * 0.2, y * 0.2) * 2) * 0.09 + ruido(x * 0.6, y * 0.6) * 0.06
}

export const montarFornalha: MontarMovel = (c, cena) => {
  const { w, h, g, peca: P } = c
  const pedra = c.m.pedra
  const mad = c.m.madeira
  const ferro = PREGO
  const acesa = c.variante !== 1
  const R = Math.min(w, h)
  const X = (f: number): number => f * w
  const Y = (f: number): number => f * h
  const { bancada: ba, chamine: ch, fogareiro: fg, fole: fo } = FORNALHA

  const formaBancada = caixa(X(ba.de), Y(ba.topo), X(ba.ate), Y(ba.base), 1.6)
  const formaCoifa = caixa(X(ch.x - ch.meiaLargura), Y(ch.de), X(ch.x + ch.meiaLargura), Y(ch.ate), 1.4)
  // O fole visto de cima: a gota, larga na ponta de fora e afinando até o bico.
  const yf = Y(fo.y)
  const meia = R * fo.meiaLargura
  const gota = (k: number): Ponto[] => {
    const x0 = X(fo.de)
    const x1 = X(fo.ate)
    const dx = x1 - x0
    return [
      [x1, yf],
      [x0 + dx * 0.62, yf - meia * 0.78 * k],
      [x0 + dx * 0.25, yf - meia * k],
      [x0 + dx * 0.04, yf - meia * 0.72 * k],
      [x0 + dx * (0.04 - 0.04 * (k - 1)), yf],
      [x0 + dx * 0.04, yf + meia * 0.72 * k],
      [x0 + dx * 0.25, yf + meia * k],
      [x0 + dx * 0.62, yf + meia * 0.78 * k],
    ]
  }
  const formaCouro = poligono(gota(1))
  const formaTabua = poligono(gota(0.84))

  cena.sombras.push(
    { forma: formaBancada, z: R * FORNALHA.alturaDaBancada },
    { forma: formaCoifa, z: g * ALTURA_DA_COIFA },
    { forma: formaCouro, z: R * ALTURA_DO_FOLE, forca: 0.26 },
    contato(uniao(formaBancada, formaCoifa)),
    contato(formaCouro, 0.24),
  )
  const L = cena.partes

  // A BANCADA: as pedras em fiadas, e o leito de carvão afundado no meio.
  alvenaria(c, L, formaBancada, X(ba.de), Y(ba.topo), X(ba.ate), Y(ba.base), 4, 3, pedra, 701)
  const beira = R * 0.09
  const formaLeito = caixa(X(ba.de) + beira, Y(ba.topo) + beira, X(ba.ate) - beira, Y(ba.base) - beira, 2)
  // O leito: a cinza clara do fundo, afundada na borda de pedra (escura, ela tomava a bancada inteira).
  L.push(P(formaLeito, CINZA, { tabua: 0, bisel: 0.8, tom: 1.18, contorno: 0.12, recesso: { k: 2.4, forca: 0.36 }, textura: texCinza(X(fg.x), Y(fg.y), R * 0.4), semente: 760 }))
  // O FOGAREIRO: a cova rasa, o monte de carvão em volta e, acesa, o halo e as brasas no miolo.
  const cx = X(fg.x)
  const cy = Y(fg.y)
  const r = R * fg.raio
  L.push(P(elipse(cx, cy, r * 1.05, r), CINZA, { tabua: 0, bisel: 0.5, tom: 0.8, contorno: 0, recesso: { k: 1.4, forca: 0.3 }, semente: 762 }))
  brasas(c, L, cx, cy, r * 1.15, r * 1.05, 18, Math.max(1.2, R * 0.03), false, 765)
  if (acesa) {
    L.push(P(elipse(cx, cy, r * 2, r * 1.8), FOGO_PARADO, { textura: texHalo(cx, cy, r * 2, r * 1.8, ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 761 }))
    brasas(c, L, cx, cy, r * 0.62, r * 0.56, 9, Math.max(1.1, R * 0.024), true, 770)
  } else {
    L.push(P(elipse(cx + r * 0.05, cy + r * 0.05, r * 0.42, r * 0.36), CINZA, { tabua: 0, bisel: 0.6, tom: 1.25, contorno: 0, textura: texCinza(cx, cy, r * 0.42), semente: 771 }))
  }
  // A COIFA da chaminé, de pedra, por cima do fundo da bancada, e a boca escura dela.
  alvenaria(c, L, formaCoifa, X(ch.x - ch.meiaLargura), Y(ch.de), X(ch.x + ch.meiaLargura), Y(ch.ate), 2, 3, pedra, 720)
  const bx = X(ch.x)
  const by = (Y(ch.de) + Y(ch.ate)) / 2
  L.push(P(caixa(bx - R * 0.08, by - R * 0.055, bx + R * 0.08, by + R * 0.055, 1), BURACO, { bisel: 0.6, contorno: 0.15, recesso: { k: 1.2, forca: 0.35 }, semente: 740 }))
  // O bico de ferro do fole: atravessa a borda de pedra e some debaixo do carvão.
  L.push(P(capsula(X(fo.ate) - 2, yf, X(ba.de) + beira + 1.5, yf, Math.max(1.2, R * 0.022)), ferro, { bisel: 1, contorno: 0.2, projeta: { dist: 0.8, forca: 0.28 }, semente: 750 }))
  // O FOLE: o couro em volta e a tábua de cima, com o cabo e os cravos.
  L.push(P(formaCouro, COURO, { bisel: 1.2, contorno: 0.25, textura: texCouro, semente: 751 }))
  L.push(P(formaTabua, mad, { tabua: 0, eixo: 0, bisel: 1.1, contorno: 0.2, semente: 752, projeta: { dist: 1, forca: 0.28 } }))
  const xCabo = X(fo.de) + (X(fo.ate) - X(fo.de)) * 0.12
  L.push(P(capsula(xCabo, yf, X(fo.de) + (X(fo.ate) - X(fo.de)) * 0.5, yf, Math.max(1.1, R * 0.02)), mad, { bisel: 1, tom: 0.78, contorno: 0.2, projeta: { dist: 0.8, forca: 0.28 }, semente: 753 }))
  for (const k of [-1, 1]) L.push(P(elipse(X(fo.de) + (X(fo.ate) - X(fo.de)) * 0.32, yf + k * meia * 0.5, 0.9, 0.9), ferro, { bisel: 0.8, contorno: 0.15, semente: 754 + k }))
  // A tenaz deitada na beira da frente, à direita: as duas hastes e o rebite.
  const t0: Ponto = [X(0.2), Y(0.3)]
  const t1: Ponto = [X(0.4), Y(0.38)]
  const grossura = Math.max(0.8, R * 0.012)
  L.push(P(capsula(t0[0], t0[1], t1[0], t1[1], grossura), ferro, { bisel: 0.7, contorno: 0.2, projeta: { dist: 0.6, forca: 0.3 }, semente: 756 }))
  L.push(P(capsula(t0[0] + 1.6, t0[1] - 1.4, t1[0], t1[1] - 2.2, grossura), ferro, { bisel: 0.7, contorno: 0.2, projeta: { dist: 0.6, forca: 0.3 }, semente: 757 }))
  L.push(P(elipse(t0[0] + (t1[0] - t0[0]) * 0.3, t0[1] + (t1[1] - t0[1]) * 0.3 - 0.8, 1, 1), ferro, { bisel: 0.8, contorno: 0.2, semente: 758 }))
}
