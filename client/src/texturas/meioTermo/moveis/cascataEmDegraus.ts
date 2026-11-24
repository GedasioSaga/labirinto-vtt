/**
 * CASCATA EM DEGRAUS (lote L08 de 24/11/2026, item 75: construção nova, o rio que desce em degraus do mapa 6 e a
 * cachoeira do lago do mapa 2; desenho próprio, só a ideia do objeto). A QUEDA D'ÁGUA PARADA vista de cima: a água
 * entra pelo lado de cima da pegada e desce em QUEDAS para o lado de baixo, entre dois PAREDÕES de rocha facetada.
 * Cada degrau tem três partes, de cima para baixo:
 * - a POÇA calma e escura (mais escura logo depois da queda de cima);
 * - o LÁBIO: o fio claro e liso da água que escorre pela beira, um nada curvo;
 * - a CORTINA: a face da queda, clara, riscada de pé (riscas curtas, mais claras no meio, no rumo da água).
 * A última queda é a MAIOR, e só ela tem o VÉU DE ESPUMA no pé, que se desfaz numa renda na poça de baixo. A água
 * acaba num corte limpo: reto em cima (emenda com o rio) e, embaixo, na borda de espuma. Nos quatro cantos os paredões
 * dobram para dentro (a margem de pedra também em cima e embaixo), e uma pedra parte cada lábio.
 *
 * As MARGENS são blocos de rocha facetada de tamanhos variados (`rochaFacetada`, a família de `_rochaFacetada.ts`),
 * com o musgo em tufos e as samambaias nas frestas.
 *
 * É desenho parado (a correnteza animada é sistema novo). Esticada, o comprimento ganha quedas (não quedas mais
 * compridas) e a largura ganha água (as margens ficam na régua da casa). A água corre do lado de cima para o de baixo
 * da pegada; o mestre gira para o rumo que quiser.
 *
 * AS DUAS VISTAS SAEM DO MESMO DESENHO (perfil `{ modo: 'derivado', propria: true }`, a vista de `piramideEmDegraus.ts`):
 * a água é chata nas duas (o rio da ferramenta Água é chato), e na 3/4 só as rochas sobem, com a face da frente
 * crescendo. Girada, é o mesmo desenho virado, com as mesmas quedas; a luz das rochas fica no lugar NA TELA.
 * Lê `c.giro` e `c.vista`. Material: `pedra` (as margens); a água e a espuma são fixas. Escreve `cena.corDoPiso`. Não
 * barra, não tapa.
 */
import type { Rgb } from '../../ruido'
import { caixa } from './formas'
import { ruido, type Cena, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import { acasoDoTemplo, caixaNaTela, capim, entregarNaTela, ESCURO_DA_PEDRA_DO_TEMPLO, pontoNaTela, rochaFacetada, samambaia, texNoObjeto, tingir, tufoDeMusgo, vistaDoTemplo, type ParaARocha } from './piramideEmDegraus'

/** A água do rio na poça calma, a da poça funda logo depois da queda, o claro da cortina e a espuma branco-gelo. */
const POCA: Rgb = [0x44, 0x7a, 0x96]
const POCA_FUNDA: Rgb = [0x34, 0x62, 0x7e]
const CORTINA: Rgb = [0xa4, 0xcc, 0xd8]
const CORTINA_CLARA: Rgb = [0xd2, 0xe6, 0xe8]
const CORTINA_ESCURA: Rgb = [0x74, 0xa8, 0xc0]
const LABIO: Rgb = [0xc6, 0xe0, 0xe4]
export const ESPUMA_DA_CASCATA: Rgb = [0xe2, 0xee, 0xf0]
/** O material da água (a textura pinta tudo por cima dele). */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: POCA }
/** A margem de rocha (casas), o pé (a última queda, o véu e a poça de baixo, em casas) e o degrau de cima (casas). */
const MARGEM = 0.3
const PE = 1.25
const DEGRAU = 0.9
/** A cortina das quedas de cima (casas; cada uma um pouco maior que a anterior) e a da última, a maior (casas). */
const CORTINA_DE_CIMA = 0.19
const CORTINA_A_MAIS = 0.3
const ULTIMA_CORTINA = 0.46
/** O véu de espuma no pé da última queda (casas). */
const VEU = 0.26
/** O quanto o lábio embarriga para baixo no meio (px). */
const BARRIGA = 4

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Uma queda: onde fica o lábio no meio da água (px, no objeto) e o tamanho da cortina (px). */
interface Queda {
  readonly labio: number
  readonly cortina: number
}

export const montarCascataEmDegraus: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  if (!(hw > 0) || !(hh > 0)) return
  const v = vistaDoTemplo(c)
  const pedra = c.m.pedra
  const tela: Cena = { partes: [], sombras: [], corDoPiso: ESCURO_DA_PEDRA_DO_TEMPLO }
  const L = tela.partes
  const margem = Math.min(g * MARGEM, hw * 0.36)
  const wc = hw - margem

  // ---------- as QUEDAS: as de cima, pequenas e crescendo, e a última, a maior, com o pé ----------
  const pe = Math.min(g * PE, hh * 0.9)
  const quantas = Math.max(1, Math.round((2 * hh - pe) / (g * DEGRAU)))
  const ultima = Math.min(g * ULTIMA_CORTINA, pe * 0.4)
  const veu = Math.min(g * VEU, pe * 0.22)
  const cortinas = Array.from({ length: quantas }, (_, i) => g * CORTINA_DE_CIMA * (1 + CORTINA_A_MAIS * i))
  const poca = Math.max(6, (2 * hh - pe - cortinas.reduce((soma, x) => soma + x, 0)) / (quantas + 1))
  const quedas: Queda[] = []
  let y = -hh
  for (const cortina of cortinas) {
    y += poca
    quedas.push({ labio: y, cortina })
    y += cortina
  }
  quedas.push({ labio: hh - pe, cortina: ultima })
  const fimDoVeu = hh - pe + ultima + veu
  /** O lábio da queda `i` em x: embarriga no meio e ondula um nada. */
  const labioEm = (i: number, x: number): number => quedas[i].labio + BARRIGA * (1 - (x / wc) * (x / wc)) + 1.1 * Math.sin(x * 0.21 + i * 1.9)
  /** A borda de espuma de baixo: o corte limpo e recortado onde a água acaba. */
  const bordaEm = (x: number): number => hh - 2.2 - 3 * (ruido(x * 0.23 + 3, 9.5) + 0.5) - 1.6 * Math.abs(Math.sin(x * 0.46 + 1))

  // ---------- a ÁGUA: uma peça só, pintada no referencial do objeto ----------
  const daAgua = texNoObjeto(v, 0, (x, yy, _p, s) => {
    // Em que parte está: acima do lábio `i` é a poça `i`; entre o lábio e o fim da cortina, a cortina `i`.
    let i = 0
    while (i < quedas.length && yy > labioEm(i, x) + quedas[i].cortina) i += 1
    const noPe = i === quedas.length
    const depoisDaQueda = i === 0 ? 99 : yy - (labioEm(i - 1, x) + quedas[i - 1].cortina)
    let luz = ruido(x * 0.09 + 7, yy * 0.14 + i * 3) * 0.08
    if (!noPe && yy > labioEm(i, x)) {
      // A CORTINA: riscas de pé, curtas, mais claras no meio dela; a água corre de cima para baixo.
      const q = quedas[i]
      const t = (yy - labioEm(i, x)) / q.cortina
      const noMeio = Math.sin(Math.PI * limitar01(t))
      s[0] = CORTINA[0]
      s[1] = CORTINA[1]
      s[2] = CORTINA[2]
      const risca = ruido(x * 0.95 + i * 13, yy * 0.11 + i * 5) + 0.5 * ruido(x * 2.1 + 3, yy * 0.3 + i)
      if (risca > 0.04) tingir(s, CORTINA_CLARA, limitar01((risca - 0.04) * 3.4) * (0.35 + 0.65 * noMeio))
      else if (risca < -0.12) tingir(s, CORTINA_ESCURA, limitar01((-risca - 0.12) * 3) * 0.8)
      // O alto da cortina ainda é a cor da água dobrando; o pé já clareia para a espuma.
      if (t < 0.2) tingir(s, POCA, (1 - t / 0.2) * 0.4)
      if (t > 0.8 && i === quedas.length - 1) tingir(s, ESPUMA_DA_CASCATA, ((t - 0.8) / 0.2) * 0.7)
      s[3] += luz * 0.5
      return
    }
    // A POÇA: calma, mais escura logo depois da queda de cima.
    s[0] = POCA[0]
    s[1] = POCA[1]
    s[2] = POCA[2]
    if (depoisDaQueda < 9) tingir(s, POCA_FUNDA, (1 - depoisDaQueda / 9) * 0.95)
    // As rugas mansas da água, deitadas de través do rio.
    luz += ruido(x * 0.05 + i * 9, yy * 0.42 + 3) * 0.07
    if (noPe) {
      const doVeu = yy - (fimDoVeu - veu + BARRIGA * (1 - (x / wc) * (x / wc)))
      if (doVeu < veu) {
        // O VÉU: a espuma cheia no pé da última queda, de borda roída.
        const cheio = 1 - limitar01(doVeu / veu)
        const bolha = ruido(x * 0.42 + 5, yy * 0.42) + 0.5 * ruido(x * 1.2, yy * 1.2 + 9)
        tingir(s, ESPUMA_DA_CASCATA, limitar01((bolha + cheio * 1.7 - 0.5) * 2.4) * 0.96)
        luz += bolha * 0.06
      } else {
        // A RENDA: a espuma que se desfaz em manchas de fios, rareando para baixo.
        const longe = limitar01((doVeu - veu) / Math.max(8, hh - fimDoVeu))
        const renda = Math.abs(ruido(x * 0.2 + 11, yy * 0.2 + 5)) * 2 + 0.4 * ruido(x * 0.7, yy * 0.7 + 3)
        const fio = limitar01((0.13 * (1 - 0.8 * longe) - Math.abs(renda - 0.36)) * 8)
        if (fio > 0) tingir(s, ESPUMA_DA_CASCATA, fio * (0.7 - 0.4 * longe))
        // Umas manchas cheias de espuma junto do véu, que somem logo.
        const mancha = ruido(x * 0.33 + 21, yy * 0.4 + 2) - 0.16 - 0.5 * longe
        if (mancha > 0) tingir(s, ESPUMA_DA_CASCATA, limitar01(mancha * 5) * 0.8)
      }
      // A borda de espuma: o corte limpo onde a água acaba.
      const daBorda = bordaEm(x) - yy
      if (daBorda < 3.4) tingir(s, ESPUMA_DA_CASCATA, limitar01(1 - (daBorda - 1) / 2.4) * 0.92)
      s[5] = limitar01(daBorda / 1.1)
    } else {
      // Perto do lábio a água alisa e clareia; no lábio, o fio claro; logo antes dele, a dobra escura.
      const ate = labioEm(i, x) - yy
      if (ate < 7) tingir(s, CORTINA, (1 - ate / 7) * 0.34)
      if (ate < 3.2 && ate >= 1.9) luz -= 0.07
      if (ate < 1.9) tingir(s, LABIO, 0.94)
      // O risco fino de espuma no pé das quedas de cima (o véu é só da última).
      if (depoisDaQueda < 2.2 && ruido(x * 0.5 + i * 7, 3.3) > -0.12) tingir(s, ESPUMA_DA_CASCATA, (1 - depoisDaQueda / 2.2) * 0.74)
    }
    s[3] += luz
  })
  const leito = caixaNaTela(v, -wc - 4, -hh, wc + 4, hh)
  L.push(P(caixa(leito[0], leito[1], leito[2], leito[3]), AGUA, { bisel: 0, contorno: 0, textura: daAgua, semente: 6200 }))

  // ---------- as ROCHAS: os dois paredões, os cantos que dobram para dentro e as pedras que partem os lábios ----------
  interface Rocha {
    readonly x: number
    readonly y: number
    readonly rx: number
    readonly ry: number
    readonly alto: number
    readonly semente: number
    readonly tom: number
  }
  const rochas: Rocha[] = []
  for (const lado of [-1, 1]) {
    // O leito escuro e molhado debaixo do paredão: a fresta entre duas rochas mostra pedra, e não água.
    const faixa = caixaNaTela(v, lado < 0 ? -hw + 3.4 : wc + 2, -hh + 6, lado < 0 ? -wc - 2 : hw - 3.4, hh - 6)
    L.push(P(caixa(faixa[0], faixa[1], faixa[2], faixa[3], 4), pedra, { bisel: 0, contorno: 0.2, tom: 0.56, semente: 6290 + lado }))
    let yy = -hh + 2
    for (let i = 0; yy < hh - 3; i += 1) {
      const sal = i * 3 + (lado + 1) * 40
      // Blocos de tamanhos variados: um grande que avança na água, um médio, um miúdo.
      const tamanho = [1, 0.62, 0.8, 0.5, 0.92, 0.66][(i + (lado > 0 ? 2 : 0)) % 6] * (0.9 + 0.2 * acasoDoTemplo(sal, 87))
      const rx = margem * (0.5 + 0.34 * tamanho)
      const ry = margem * (0.42 + 0.5 * tamanho) * (0.9 + 0.3 * acasoDoTemplo(sal, 88))
      yy += ry * 0.84
      rochas.push({ x: lado * (hw - rx * 0.92 - 0.8), y: Math.min(hh - ry * 0.7, yy), rx, ry, alto: 3 + rx * 0.62, semente: sal, tom: 0.9 + 0.16 * acasoDoTemplo(sal, 91) })
      // Atrás do bloco miúdo, um outro encostado na beira de fora (o paredão não fica fino).
      if (tamanho < 0.7) rochas.push({ x: lado * (hw - margem * 0.3), y: Math.min(hh - 4, yy + ry * 0.2), rx: margem * 0.36, ry: margem * 0.44, alto: 3.6, semente: sal + 500, tom: 0.84 })
      yy += ry * 0.84
    }
    // Os cantos de cima e de baixo dobram para dentro: a margem de pedra também nas pontas.
    rochas.push({ x: lado * (wc - margem * 0.3), y: -hh + margem * 0.42, rx: margem * 0.66, ry: margem * 0.44, alto: 5, semente: 700 + lado, tom: 0.94 })
    rochas.push({ x: lado * (wc - margem * 0.42), y: hh - margem * 0.44, rx: margem * 0.74, ry: margem * 0.46, alto: 5.4, semente: 710 + lado, tom: 0.9 })
  }
  // Uma pedra parte cada lábio (alternando o lado); na última queda, duas.
  quedas.forEach((_queda, i) => {
    const postos = i === quedas.length - 1 ? [-0.5, 0.42] : [i % 2 === 0 ? 0.3 : -0.26]
    postos.forEach((f, j) => {
      const r = 4.2 + 2.4 * acasoDoTemplo(i * 5 + j, 82)
      rochas.push({ x: f * wc, y: labioEm(i, f * wc) + 0.5 - (i === quedas.length - 1 ? 0 : 1), rx: r * 1.2, ry: r * 0.86, alto: 2.6 + r * 0.5, semente: 800 + i * 5 + j, tom: 0.88 })
    })
  })
  // De trás para a frente NA TELA: a rocha mais ao sul tapa a de trás.
  const paraARocha: ParaARocha = { v, P, L, pedra }
  rochas
    .map((r) => ({ r, base: pontoNaTela(v, r.x, r.y)[1] + (v.q % 2 === 1 ? r.rx : r.ry) }))
    .sort((a, b) => a.base - b.base)
    .forEach(({ r }) => {
      const planta = rochaFacetada(paraARocha, r.x, r.y, r.rx, r.ry, r.alto, r.semente, r.tom)
      // A sombra no chão do mapa (para baixo e para a direita), curta: os blocos são baixos.
      if (Math.abs(r.x) > wc - 2) tela.sombras.push({ forma: planta, z: r.alto * 1.4, forca: 0.3 })
    })

  // ---------- o verde nas frestas: o musgo em tufos, as samambaias e um capim ----------
  const verde: readonly (readonly [number, number, number, 'musgo' | 'samambaia' | 'capim'])[] = [
    [-1, -0.72, 4, 'musgo'], [-1, -0.2, 5.4, 'samambaia'], [-1, 0.26, 3.4, 'musgo'], [-1, 0.74, 4.6, 'capim'], [-1, 0.5, 3, 'musgo'],
    [1, -0.5, 5, 'samambaia'], [1, -0.86, 3.2, 'musgo'], [1, 0.06, 4.2, 'musgo'], [1, 0.52, 5.2, 'samambaia'], [1, 0.84, 3.4, 'musgo'],
  ]
  verde.forEach(([lado, fy, r, qual], i) => {
    const [x, yy] = pontoNaTela(v, lado * (hw - margem * (0.3 + 0.5 * acasoDoTemplo(i, 93))), fy * hh, v.sobe > 0 ? 4 : 0)
    if (qual === 'musgo') tufoDeMusgo(L, P, x, yy, r, 700 + i)
    else if (qual === 'samambaia') samambaia(L, P, x, yy, r, 720 + i, 5, Math.atan2(pontoNaTela(v, -lado, 0.4)[1], pontoNaTela(v, -lado, 0.4)[0]), 2.4)
    else capim(L, P, x, yy, r, 740 + i, 6)
  })

  entregarNaTela(v, tela, cena)
}
