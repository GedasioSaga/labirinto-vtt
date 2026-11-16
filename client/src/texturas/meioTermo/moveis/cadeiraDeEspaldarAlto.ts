/**
 * CADEIRA DE ESPALDAR ALTO (lote L2 das referências, 16/11/2026, das parciais: versão original, só a ideia). A
 * cadeira de sala de jantar antiga: quatro pernas com as travessas embaixo, o assento estofado com a beira de madeira
 * e o ESPALDAR que sobe bem acima da cabeça de quem senta, com os dois montantes terminando num pomo torneado, o
 * painel estofado com os botões em losango e o COROAMENTO de madeira entalhado em arco. A frente é o lado de baixo
 * da pegada; o espaldar fica atrás.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): de cima aparecem o assento e o alto do coroamento; na
 * 3/4 o espaldar sobe e mostra a frente estofada (a textura de cada fatia desenha o painel naquela altura: a moldura,
 * os botões, o estofado), ou as costas lisas quando o giro as vira para quem olha. O assento fica na altura da
 * cadeira de sempre (0,27 casa). Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Materiais: `madeira` e
 * `estofado`.
 */
import { caixa, elipse } from './formas'
import { contato, ruido, texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, sombraNoAr, type Fatiador } from './pilhaDeFatias'
import { disco, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'

/** As alturas (casas): o assento, o alto do estofado dele, o painel do espaldar e o alto do coroamento. */
const Z = { assento: 0.25, estofado: 0.3, painelDe: 0.4, painelAte: 0.95, coroa: 1.06, pomo: 1.13 } as const
/** As medidas em px do protótipo: a perna, o montante, a grossura do espaldar e o recuo das pernas. */
const PERNA = 2.3
const MONTANTE = 2.6
const ESPALDAR = 2.2
const RECUO = 1.2
/** As travessas de baixo (altura em px) e o passo das fatias. */
const TRAVESSA = 4.2
const PASSO = 0.8
/** Os botões do estofado: o passo do losango (px). */
const BOTAO = 4.4

export const montarCadeiraDeEspaldarAlto: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const madeira = c.m.madeira
  const estofado = c.m.estofado
  const f: Fatiador = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daMadeira = texturaDaClasse(madeira.classe)
  const doPano = texturaDaClasse(estofado.classe)
  const [zAssento, zEstofado, zPainel0, zPainel1, zCoroa, zPomo] = [g * Z.assento, g * Z.estofado, g * Z.painelDe, g * Z.painelAte, g * Z.coroa, g * Z.pomo]
  const [x0, x1, y0, y1] = [-hw + RECUO, hw - RECUO, -hh + RECUO, hh - RECUO]
  const yEspaldar0 = y0 + 0.3
  const yEspaldar1 = yEspaldar0 + ESPALDAR

  /** Madeira de pé (o veio corre na altura: na 3/4 a frente de cada fatia lê outra linha do veio). */
  const dePe = (z: number, nx: number, ny: number): Textura => (_u, v, x, y, p, s, escala) => {
    if (daMadeira !== null) daMadeira(z * 1.7, v, x, y, p, s, escala)
    s[3] += luzDaNormal(nx, ny, 0, q)
  }
  const madeiraLisa = (z: number) => lisa(0.92, dePe(z, 0, 1), 5800)

  // As PERNAS da frente e as TRAVESSAS de baixo (camada 0: o assento vem por cima delas na 3/4).
  for (const sx of [-1, 1]) {
    const px = sx < 0 ? x0 + PERNA / 2 : x1 - PERNA / 2
    for (const z of alturas(0, zAssento, 1)) f.fatia(0, z, disco(px, y1 - PERNA / 2, PERNA / 2), madeira, lisa(0.9, dePe(z, sx * 0.5, 0.8), 5801))
  }
  const travessas = [caixa(x0 + 1, y1 - PERNA * 0.8, x1 - 1, y1 - PERNA * 0.2), caixa(x0, y0 + 2, x0 + PERNA * 0.7, y1 - 2), caixa(x1 - PERNA * 0.7, y0 + 2, x1, y1 - 2)]
  for (const t of travessas) for (const z of alturas(TRAVESSA - 0.8, TRAVESSA + 0.8, PASSO)) f.fatia(0, z, t, madeira, madeiraLisa(z))

  // O ASSENTO: a tábua com a beira de madeira e o estofado abaulado por cima.
  const tabua = caixa(x0 - 0.4, y0 + 0.6, x1 + 0.4, y1 + 0.4, 1.2)
  for (const z of alturas(zAssento - 1.6, zAssento, PASSO)) {
    const topo = z >= zAssento - 1e-6
    f.fatia(1, z, tabua, madeira, topo ? { eixo: 0, tabua: 0, bisel: 0.8, tom: 0.98, contorno: 0.26, semente: 5810 } : madeiraLisa(z))
  }
  const almofada = (z: number) => {
    const t = (z - zAssento) / (zEstofado - zAssento)
    const encolhe = 1.2 + 2.2 * t * t
    return caixa(x0 + encolhe, y0 + 1 + encolhe, x1 - encolhe, y1 - encolhe * 0.8, 2.6)
  }
  const doAssento: Textura = (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    s[3] += 0.06 * ruido(x * 0.3, y * 0.3)
  }
  for (const z of alturas(zAssento, zEstofado, 0.6)) {
    const topo = z >= zEstofado - 1e-6
    f.fatia(1, z, almofada(z), estofado, topo ? { tabua: 0, bisel: 2.4, tom: 1, contorno: 0.24, textura: doAssento, semente: 5815 } : lisa(0.86, doAssento, 5816))
  }

  // O ESPALDAR: os dois montantes (as pernas de trás que sobem até o pomo), o painel estofado entre eles e o
  // coroamento em arco. A frente do painel (o lado do assento) tem a moldura e os botões; as costas são lisas.
  for (const sx of [-1, 1]) {
    const mx = sx < 0 ? x0 + MONTANTE / 2 : x1 - MONTANTE / 2
    const montante = caixa(mx - MONTANTE / 2, yEspaldar0 - 0.2, mx + MONTANTE / 2, yEspaldar1 + 0.4, 0.5)
    for (const z of alturas(0, zCoroa, 1)) f.fatia(1, z, montante, madeira, lisa(0.95, dePe(z, sx * 0.6, 0.7), 5820))
    // O pomo torneado no alto.
    for (const z of alturas(zCoroa, zPomo, 0.5)) {
      const t = (z - zCoroa) / (zPomo - zCoroa)
      const r = MONTANTE * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15)))
      f.fatia(1, z, disco(mx, (yEspaldar0 + yEspaldar1) / 2, Math.max(0.4, r)), madeira, z >= zPomo - 1e-6 ? { tabua: 0, bisel: 0.9, tom: 1.04, contorno: 0.22, semente: 5821 } : lisa(0.96, dePe(z, sx * 0.6, 0.7), 5822))
    }
  }
  const xm0 = x0 + MONTANTE
  const xm1 = x1 - MONTANTE
  const meio = (yEspaldar0 + yEspaldar1) / 2
  const painel = caixa(xm0 - 0.2, yEspaldar0 + 0.3, xm1 + 0.2, yEspaldar1 - 0.2)
  const frenteDoPainel = (z: number): Textura => (u, v, x, y, p, s, escala) => {
    // As costas (o lado de trás do espaldar): o pano liso.
    if (y < meio) {
      if (doPano !== null) doPano(u, v + z * 2.1, x, y, p, s, escala)
      s[3] += luzDaNormal(0, -1, 0, q) - 0.04
      return
    }
    // A frente: a moldura de madeira em volta e o estofado com os botões em losango.
    const borda = Math.min(x - xm0, xm1 - x, z - zPainel0, zPainel1 - z)
    if (borda < 1.3) {
      if (daMadeira !== null) daMadeira(z * 1.7, v, x, y, p, s, escala)
      s[0] = madeira.rgb[0] * 0.92
      s[1] = madeira.rgb[1] * 0.92
      s[2] = madeira.rgb[2] * 0.92
      s[3] += luzDaNormal(0, 1, 0, q) + (borda < 0.5 ? 0.1 : 0)
      return
    }
    if (doPano !== null) doPano(u, v + z * 2.1, x, y, p, s, escala)
    const [bu, bv] = [x / BOTAO, (z - zPainel0) / BOTAO]
    const [iu, iv] = [Math.round(bu + bv), Math.round(bv - bu)]
    const [cu, cv] = [(iu - iv) / 2, (iu + iv) / 2]
    const perto = Math.hypot((bu - cu) * BOTAO, (bv - cv) * BOTAO)
    // O botão afunda o estofado em volta (sombra) e brilha um nada no meio.
    s[3] += luzDaNormal(0, 1, 0, q) + (perto < 0.55 ? -0.05 : perto < 1.7 ? -0.12 * (1 - perto / 1.7) : 0.03)
  }
  for (const z of alturas(zAssento, zPainel1, PASSO)) {
    if (z < zPainel0 - 1e-6) {
      // Entre o assento e o painel, a travessa de baixo do espaldar.
      if (z > zEstofado) f.fatia(1, z, painel, madeira, lisa(0.9, dePe(z, 0, 1), 5830))
      continue
    }
    f.fatia(1, z, painel, estofado, lisa(0.96, frenteDoPainel(z), 5831))
  }
  // O COROAMENTO: a tábua de madeira em arco, entalhada (os sulcos de pé e a voluta do meio).
  const coroamento: Textura = (u, v, x, y, p, s, escala) => {
    if (daMadeira !== null) daMadeira(u, v, x, y, p, s, escala)
    const sulco = Math.abs(Math.sin(x * 0.9)) < 0.18 && Math.abs(x) > 3.2 ? -0.12 : 0
    s[3] += luzDaNormal(0, y < meio ? -1 : 1, 0, q) + sulco + (Math.abs(x) < 3 ? 0.06 : 0)
  }
  for (const z of alturas(zPainel1, zCoroa + 2.4, 0.6)) {
    // O arco: no meio sobe 2,4 px acima dos montantes; nas pontas, até o alto deles.
    const sobe = z - zCoroa
    const meia = sobe <= 0 ? (xm1 - xm0) / 2 + 0.2 : ((xm1 - xm0) / 2) * Math.sqrt(Math.max(0, 1 - sobe / 2.4))
    if (meia < 0.6) continue
    const topo = z >= zCoroa + 2.4 - 0.6
    f.fatia(1, z, caixa(-meia, yEspaldar0 + 0.1, meia, yEspaldar1, 0.4), madeira, topo ? { eixo: 0, tabua: 0, bisel: 0.6, tom: 1.02, contorno: 0.2, semente: 5840 } : lisa(0.95, coroamento, 5841))
  }
  f.fechar()

  // A sombra do espaldar alto e a do assento, desenhadas para o lado da sombra NA TELA, e o contato das pernas.
  cena.sombras.push(
    sombraVarrida(x0 + 0.5, yEspaldar0, x1 - 0.5, yEspaldar1, zCoroa * 0.62, q, 0.2, 2.4),
    sombraNoAr(caixa(x0, y0, x1, y1, 1.4), zAssento * 0.6, q, 0.24, 1.8),
    contato(elipse(0, 0, hw * 0.9, hh * 0.9), 0.2),
  )
}
