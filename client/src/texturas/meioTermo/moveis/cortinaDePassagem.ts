/**
 * CORTINA DE PASSAGEM de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; objeto novo). O pano
 * pendurado no vão da porta, rente à parede: a VARA de madeira de ponta a ponta, com as duas pontas torneadas, e o PANO
 * franzido nela em PREGAS de larguras desencontradas que vão e voltam. De cima, o pano é a faixa grossa e franzida por
 * baixo da vara: as pregas que vêm para a frente pegam a luz, as de trás ficam na sombra, com o vinco entre elas; as
 * ARGOLAS prendem o pano na vara, uma a cada duas pregas. A beira da direita foi PUXADA para o lado: o pano para antes
 * da ponta da vara e deixa a ABERTURA escura do vão. Não barra a passagem (é pano) e tapa a visão: serve ao trapo da
 * porta do cortiço e ao reposteiro do castelo.
 *
 * A 25% de zoom sobra a fita franzida e clara atravessada no vão, com o risco escuro da vara por cima: cortina (a porta
 * é a folha lisa de tábua com o batente).
 *
 * NA 3/4 (DERIVADO) cada prega é uma coluna da altura da porta, da beira de trás da faixa até a BAINHA reta e um nada
 * torta: as faces se alternam clara e escura, com o vinco entre elas, e embaixo corre a faixa ENCARDIDA (uma coluna baixa
 * por prega, um décimo da altura). Na beira puxada o canto da bainha subiu e, atrás dela, a coluna escura do vão; a
 * sombra do chão corre rente à bainha. A vara é o tampo solto em cima de tudo, com as pontas. Material: `pano` (um dos
 * tecidos; o linho cru de partida, o pano cru do pedido). A vara, as argolas e o escuro do vão são fixos. Esticada, a
 * cortina ganha mais pregas (uma a cada `PASSO_DA_PREGA` px, em média), do mesmo tamanho.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'
import { ESCURO_DO_CORTICO } from './catreDesarrumado'

/** A altura do pano (casas): o vão da porta. A vara fica um nada acima. */
const ALTURA_DO_PANO = 0.9
const FOLGA_DA_VARA = 0.03
/** O passo médio de uma prega (px da pegada de partida, 1 x 0,25 casa) e a largura de cada uma, em partes do passo. */
const PASSO_DA_PREGA = 5.4
const LARGURA_DA_PREGA: readonly [number, number] = [0.7, 1.3]
/** De cima, o pano é uma faixa grossa (meia grossura, px) que ondula este tanto: a fita franzida lê a 25%. */
const ONDA_DE_CIMA = 2.6
const MEIA_GROSSURA_DO_PANO = 3.8
/** A abertura que a beira puxada deixou antes da ponta da vara (px). */
const ABERTURA = 3.4
/** A bainha: o quanto cada vinco sobe da linha reta (px, ao acaso) e o canto da beira puxada, que subiu mais. */
const BAINHA_TORTA = 0.7
const CANTO_ERGUIDO = 1.9
/** A faixa encardida da barra, em parte da altura do pano. */
const ALTURA_DO_ENCARDIDO = 0.1
/** As colunas das pregas passam um nada da vizinha (px): sem isto, a 3/4 abria fresta clara entre elas. */
const SOBREPOSTO = 0.3
/** Quantos pontos desenham a beira de cada prega na faixa de cima e a beira de trás da coluna dela. */
const PASSOS_DA_PREGA = 8
const PASSOS_DA_COLUNA = 4
/** A prega da frente puxada para a luz e a de trás para a sombra (a alternância forte que dá o franzido). */
const LUZ: Rgb = [0xee, 0xe6, 0xd4]
const SOMBRA: Rgb = [0x2e, 0x28, 0x22]
const MISTURA_DA_LUZ = 0.22
const MISTURA_DA_SOMBRA = 0.42
/** O encardido da barra (a sujeira do chão sobe pelo pano). */
const ENCARDIDO_DA_BARRA: Rgb = [0x4a, 0x40, 0x33]
const MISTURA_DO_ENCARDIDO = 0.45
/** A vara de madeira escura, as pontas torneadas, as argolas de ferro e o escuro do vão atrás da beira puxada. */
const VARA: MaterialDaPeca = { classe: 'madeira', rgb: [0x5f, 0x47, 0x33] }
const ARGOLA: MaterialDaPeca = { classe: 'metal', rgb: [0x6a, 0x6b, 0x6c] }
const VAO_DA_PORTA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x19, 0x15] }

export const montarCortinaDePassagem: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const pano = c.m.pano
  const L = cena.partes
  const k = Math.min(w / G, h / (0.25 * G))
  const zPano = g * ALTURA_DO_PANO
  const zVara = g * (ALTURA_DO_PANO + FOLGA_DA_VARA)
  const claro: MaterialDaPeca = { ...pano, rgb: misturar(pano.rgb, LUZ, MISTURA_DA_LUZ) }
  const escuro: MaterialDaPeca = { ...pano, rgb: misturar(pano.rgb, SOMBRA, MISTURA_DA_SOMBRA) }
  const encardido = (m: MaterialDaPeca): MaterialDaPeca => ({ ...m, rgb: misturar(m.rgb, ENCARDIDO_DA_BARRA, MISTURA_DO_ENCARDIDO) })
  cena.corDoPiso = ESCURO_DO_CORTICO

  // As PREGAS, de larguras desencontradas, da ponta da esquerda até a BEIRA SOLTA, puxada para o lado.
  const [xa, xb] = [-hw + 2.8 * k, hw - 2.8 * k]
  const xc = xb - ABERTURA * k
  const n = Math.max(4, Math.round((xc - xa) / (PASSO_DA_PREGA * k)))
  const beiraSolta = n - 1
  const [menor, maior] = LARGURA_DA_PREGA
  const pesos = Array.from({ length: n }, (_, i) => (i === beiraSolta ? menor : menor + (maior - menor) * hash(i, n, 8701)))
  const soma = pesos.reduce((s, p) => s + p, 0)
  const vincos = pesos.reduce<number[]>((v, p) => [...v, v[v.length - 1] + ((xc - xa) * p) / soma], [xa])
  const meia = MEIA_GROSSURA_DO_PANO * k
  const amplitude = pesos.map((p) => ONDA_DE_CIMA * k * Math.min(1.15, 0.55 + 0.5 * p))
  // O meio da faixa na prega i: meia onda para a frente (par) ou para trás (ímpar); a beira solta vira para trás em
  // quarto de onda (foi puxada).
  const meio = (i: number, x: number): number => {
    const t = (x - vincos[i]) / (vincos[i + 1] - vincos[i])
    if (i === beiraSolta) return -amplitude[i] * Math.sin((Math.PI / 2) * t)
    return (i % 2 === 0 ? 1 : -1) * amplitude[i] * Math.sin(Math.PI * t)
  }
  const amostras = (i: number, passos: number): number[] => Array.from({ length: passos + 1 }, (_, j) => vincos[i] + ((vincos[i + 1] - vincos[i]) * j) / passos)
  const materialDaPrega = (i: number): MaterialDaPeca => (i === beiraSolta ? pano : i % 2 === 0 ? claro : escuro)
  // A BAINHA na 3/4: reta na frente das pregas, cada vinco um nada acima ou abaixo; o canto da beira puxada subiu.
  const yBainha = Math.min(hh - 0.5, ONDA_DE_CIMA * k * 1.15 + meia)
  const bainha = vincos.map((_, j) => yBainha - (j === n ? CANTO_ERGUIDO * k : BAINHA_TORTA * k * hash(j, 3, 8703)))

  // A ABERTURA: o escuro do vão atrás da beira puxada. Na 3/4 é a coluna escura entre a beira e a ponta da vara, que
  // começa na vara (por cima dela é parede); de cima, só a sombra mansa no vão.
  const xFim = hw - 1.4 * k
  cena.sombras.push({ forma: caixa(xc - 0.6, -0.5 * k, xFim, 3 * k), z: zPano, forca: 0.04 })
  L.push(P(caixa(xc - 0.2, 0.8 * k, xFim - 0.4 * k, 2.8 * k, 0.8 * k), VAO_DA_PORTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35, suave: 1.2 * k, semente: 8700 }))

  // A FAIXA franzida inteira, bege, de beira mole: de cima é ela que lê fita a 25%. A caixa dela é a da faixa posta em
  // pé no meio da vara (a forma é a mesma): na 3/4 ela mora na vara e cobre o alto das pregas, como a cabeça do pano.
  const pontosDaFaixa = vincos.slice(0, n).flatMap((_, i) => amostras(i, PASSOS_DA_PREGA).slice(i === 0 ? 0 : 1).map((x) => [i, x] as const))
  const contornoDaFaixa = poligono([...pontosDaFaixa.map(([i, x]): Ponto => [x, meio(i, x) + meia]), ...[...pontosDaFaixa].reverse().map(([i, x]): Ponto => [x, meio(i, x) - meia])])
  const alto = Math.max(-contornoDaFaixa.b[1], contornoDaFaixa.b[3])
  const faixa: Forma = { b: [contornoDaFaixa.b[0], -alto, contornoDaFaixa.b[2], alto], d: contornoDaFaixa.d }
  cena.sombras.push(contato(faixa, 0.3), { forma: caixa(xa, yBainha - 1.2 * k, xc, yBainha + 1.2 * k, 1 * k), z: 0, suave: 1.6 * k, forca: 0.22 })
  L.push(P(faixa, pano, { eixo: QUARTO, tabua: 0, bisel: 0.7 * k, ruga: 0.7, contorno: 0.24, semente: 8705, projeta: { dist: 1 * k, forca: 0.28, suave: 0.8 * k } }))

  // Cada PREGA: na 3/4, a coluna (da beira de trás da faixa até a bainha) e, na frente dela, a coluna baixa do encardido;
  // de cima, a luz mansa na prega que vem para a frente (com o fio de luz na crista) e a sombra funda na de trás (com o
  // vale). A cor de cada uma é também a da face dela na 3/4.
  for (let i = 0; i < n; i += 1) {
    const m = materialDaPrega(i)
    const [x0, x1] = [vincos[i] - SOBREPOSTO, vincos[i + 1] + SOBREPOSTO]
    const beiraDeTras = amostras(i, PASSOS_DA_COLUNA).map((x): Ponto => [x, meio(i, x) - meia])
    const coluna = poligono([[x0, beiraDeTras[0][1]], ...beiraDeTras, [x1, beiraDeTras[beiraDeTras.length - 1][1]], [x1, bainha[i + 1]], [x0, bainha[i]]])
    const barra = poligono([[x0, bainha[i] - 0.3], [x1, bainha[i + 1] - 0.3], [x1, bainha[i + 1] + 0.9], [x0, bainha[i] + 0.9]])
    cena.sombras.push({ forma: coluna, z: zPano, forca: 0.2 }, { forma: barra, z: zPano * ALTURA_DO_ENCARDIDO, forca: 0.04 })

    const xs = amostras(i, PASSOS_DA_PREGA)
    const face = poligono([...xs.map((x): Ponto => [x, meio(i, x) + meia]), ...[...xs].reverse().map((x): Ponto => [x, meio(i, x) - meia])])
    const vemParaFrente = i % 2 === 0 && i !== beiraSolta
    const forcaDaPrega = i === beiraSolta ? 0.3 : vemParaFrente ? 0.42 : 0.66
    L.push(P(face, m, { eixo: QUARTO, tabua: 0, bisel: 0, ruga: 0.8, contorno: 0, alfa: forcaDaPrega, suave: 1.1 * k, semente: 8710 + i }))
    if (i !== beiraSolta) {
      const miolo = xs.slice(2, PASSOS_DA_PREGA - 1)
      const linha = miolo.map((x): Ponto => [x, meio(i, x) + (vemParaFrente ? -0.3 : 0.25) * meia])
      L.push(P(cadeia(linha, 0.6 * k), m, { tabua: 0, bisel: 0, contorno: 0, tom: vemParaFrente ? 1.12 : 0.74, alfa: 0.5, suave: 0.7 * k, semente: 8730 + i }))
    }
    // A cor da barra encardida na 3/4 (de cima ela fica debaixo da faixa: a peça é quase transparente).
    L.push(P(barra, encardido(m), { tabua: 0, bisel: 0, contorno: 0, alfa: 0.04, semente: 8750 + i }))
  }

  // A VARA e as pontas torneadas, no alto (o tampo solto em cima do pano), com as argolas onde o pano cruza a vara, uma
  // sim, uma não, e a da beira solta.
  const yVara = 0
  const xPonta = hw - 1.5 * k
  const vara = capsula(-xPonta, yVara, xPonta, yVara, 0.5 * k)
  const pontas = [-1, 1].map((lado) => elipse(lado * xPonta, yVara, 1.5 * k, 1.5 * k))
  const tudo = [vara, ...pontas].reduce((a, b) => uniao(a, b))
  // A 3/4 pinta as estruturas pela beira de baixo da caixa: a da vara vai até a beira da pegada, para a vara sair
  // depois das pregas e da barra e ficar por cima delas (a forma é a mesma; só a caixa é mais funda).
  const naFrente: Forma = { b: [tudo.b[0], tudo.b[1], tudo.b[2], hh + 0.5], d: tudo.d }
  cena.sombras.push({ forma: naFrente, z: zVara, solta: true, forca: 0.24 })
  L.push(P(vara, VARA, { tabua: 0, bisel: 0.8 * k, contorno: 0.3, semente: 8720, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.6 * k } }))
  const argolas = [...vincos.filter((_, i) => i % 2 === 1 && i < n), xc]
  argolas.forEach((x, i) => {
    L.push(P(anel(x, yVara, 0.95 * k, 1.05 * k, 0.45 * k, 0.55 * k), ARGOLA, { tabua: 0, bisel: 0.3 * k, metal: 0.45, contorno: 0.26, semente: 8760 + i }))
  })
  pontas.forEach((ponta, i) => L.push(P(ponta, VARA, { tabua: 0, bisel: 1.3 * k, tom: 1.08, contorno: 0.3, semente: 8740 + i })))
}
