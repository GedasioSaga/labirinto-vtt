/**
 * TOPO DO TEMPLO (lote L08 de 24/11/2026, item 72: construção nova, o santuário do alto da pirâmide do mapa 6; desenho
 * próprio, só a ideia do objeto). A LAJE do alto, baixa e de moldura gravada, com a ENTRADA do templo: a escadinha
 * que começa na frente (o lado de baixo da pegada), no nível da laje, e DESCE para o norte entre dois parapeitos, cada
 * pisada mais escura que a outra, até sumir no VÃO ESCURO debaixo do muro do fundo, que leva a cresta de três blocos
 * em degrau. Dois marcos entalhados na boca da escada e duas piras de pedra apagadas nos cantos da frente. Tem 2 x 2
 * casas: o tamanho certo para ir em cima do patamar da pirâmide em degraus (item 71).
 *
 * De cima, o que diz "entrada que desce" são as pisadas escurecendo para dentro, a sombra dos muros caindo no poço
 * e o fundo quase preto encostado no muro do norte. Não barra a passagem (anda-se na laje) e não tapa a visão.
 *
 * NA 3/4 (derivada, com a beirada do perfil): a laje é a coluna baixa; os muros, os marcos e as piras são TAMPOS
 * SOLTOS de um andar (a beirada do perfil é a altura do muro acima da laje, `ESPESSURA_DO_MURO_DO_TOPO_DO_TEMPLO`),
 * e a cresta, tampos de dois andares em cima do muro do fundo. Como estão em cima da laje, saem depois dela na ordem
 * de pintura (`emOrdemNaTela`), do norte para o sul NA TELA: lê `c.giro` para essa ordem valer com o objeto girado. Sem
 * giro, o muro do fundo ganha a PORTA escura na face da frente (um tampo fino, da cor do vão).
 * Material: `pedra`. Escreve `cena.corDoPiso`.
 */
import { hash } from '../../ruido'
import { comMeioEm, solta } from './andaimeDaTresQuartos'
import { caixa, elipse, elipseGirada, menos, type Caixa, type Forma } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import {
  acasoDoTemplo,
  baseNaTelaDoTemplo,
  cipo,
  DA_PEDRA,
  emOrdemNaTela,
  ESCURO_DA_PEDRA_DO_TEMPLO,
  musgoNoPonto,
  MUSGO_DO_TEMPLO,
  quartosDoGiroDoTemplo,
  roseta,
  texDaPedraDoTemplo,
  texDasLajesDoTemplo,
  tingir,
  TOM_DO_MUSGO_DO_TEMPLO,
} from './piramideEmDegraus'

/** A altura da laje e a dos muros acima dela (casas). A segunda é a beirada do perfil da 3/4. */
const ALTURA_DA_LAJE = 0.14
const ALTURA_DO_MURO = 0.3
export const ESPESSURA_DO_MURO_DO_TOPO_DO_TEMPLO = ALTURA_DO_MURO * G
/** O poço da escada: a meia largura (fração da meia largura), e de onde a onde vai (frações da meia altura). */
const MEIO_POCO = 0.34
const FUNDO_DO_POCO = -0.2
const BOCA_DO_POCO = 0.68
/** O muro do fundo vai até aqui para o norte (fração da meia altura). */
const NORTE_DO_MURO = -0.74
/** O parapeito (casas, nunca mais que esta fração da meia largura) e a pisada (casas). */
const PARAPEITO = 0.13
const FRACAO_DO_PARAPEITO = 0.14
const PISADA = 0.145
/** O escuro do vão (levantado até o piso de luz pelo motor) e a cinza das piras. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x2a, 0x27] }
const CINZA_DA_PIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x63, 0x5e, 0x56] }
const CARVAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x36, 0x32] }
const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x80, 0x52] }

/** Os blocos do muro: a junta fina de través, a cada `passo` px, e o musgo. */
function texDoMuro(passo: number, musgo: number, semente: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    const b = p.forma.b
    const deitado = b[2] - b[0] > b[3] - b[1]
    const t = (deitado ? x : y) / passo + semente * 0.37
    const junta = Math.abs(t - Math.round(t)) * passo
    if (junta < 0.55) s[3] -= 0.2 * (1 - junta / 0.55)
    s[3] += (hash(Math.round(t), semente, 931) - 0.5) * 0.08
    const t2 = musgoNoPonto(x, y, 0.3 - 0.34 * musgo, semente + 90) * 0.66
    if (t2 > 0) tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t2)
  }
}

/** O que está em cima da laje: a planta, a caixa de quem o apoia (a ordem na tela) e o andar (1 ou 2). */
interface Bloco {
  readonly forma: Forma
  readonly apoio: Caixa
  readonly andar: number
  /** Altura a menos que o andar inteiro (px): a porta, um tampo mais baixo que o muro. */
  readonly menos?: number
}

export const montarTopoDoTemplo: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  if (!(hw > 0) || !(hh > 0)) return
  const pedra = c.m.pedra
  const L = cena.partes
  const q = quartosDoGiroDoTemplo(c.giro)
  cena.corDoPiso = ESCURO_DA_PEDRA_DO_TEMPLO
  const zLaje = g * ALTURA_DA_LAJE
  const zMuro = g * ALTURA_DO_MURO
  const wv = hw * MEIO_POCO
  const pt = Math.min(g * PARAPEITO, hw * FRACAO_DO_PARAPEITO)
  const [yN, yS, yM] = [hh * FUNDO_DO_POCO, hh * BOCA_DO_POCO, hh * NORTE_DO_MURO]
  const k = Math.min(hw, hh) / G

  // ---------- a LAJE ----------
  const laje = caixa(-hw, -hh, hw, hh, 2 * k)
  cena.sombras.push({ forma: laje, z: zLaje }, contato(laje, 0.32))
  L.push(P(laje, pedra, { tabua: 0, bisel: 1.6, tom: 0.98, contorno: 0.26, textura: texDasLajesDoTemplo(g * 0.5), semente: 5600 }))
  // A moldura gravada: dois sulcos finos por dentro da beira.
  for (const [recuo, largo] of [[3.6 * k, 1.3], [6.6 * k, 0.8]] as const) {
    L.push(P(menos(caixa(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo, 1.2), caixa(-hw + recuo + largo, -hh + recuo + largo, hw - recuo - largo, hh - recuo - largo, 0.8)), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.7, semente: 5601 }))
  }

  // ---------- o POÇO da escada: o fundo, as pisadas que escurecem e o escuro do vão ----------
  const poco = caixa(-wv, yN, wv, yS)
  L.push(P(poco, pedra, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.4, recesso: { k: 2.2, forca: 0.3 }, semente: 5610 }))
  const n = Math.max(3, Math.round((yS - yN) / (g * PISADA)))
  const passo = (yS - yN) / n
  for (let j = 0; j < n; j += 1) {
    // j = 0 é a de cima (a da boca, no sul); cada uma mais funda e mais escura.
    const y1 = yS - j * passo
    const fundo = j / (n - 1)
    L.push(P(caixa(-wv + 0.5, y1 - passo + 0.9, wv - 0.5, y1 - 0.2, 0.6), pedra, { tabua: 0, bisel: 0.8, tom: 1.02 - 0.5 * fundo + 0.04 * acasoDoTemplo(j, 41), contorno: 0.2, textura: texDaPedraDoTemplo(0.3, 41 + j), semente: 5620 + j }))
  }
  // O escuro que cresce para o fundo, por cima das pisadas.
  const texDoEscuro: Textura = (_u, _v, _x, y, _p, s) => {
    const t = Math.max(0, Math.min(1, (yS - y) / (yS - yN)))
    s[5] = Math.min(0.94, 1.05 * t * t)
  }
  L.push(P(poco, VAO, { bisel: 0, contorno: 0, textura: texDoEscuro, semente: 5640 }))
  // Umas folhas secas caídas na escada.
  for (let i = 0; i < 5; i += 1) {
    const [x, y] = [(acasoDoTemplo(i, 42) - 0.5) * 1.6 * wv, yS - (0.08 + 0.5 * acasoDoTemplo(i, 43)) * (yS - yN)]
    L.push(P(elipseGirada(x, y, 1.7 * k, 0.85 * k, acasoDoTemplo(i, 44) * Math.PI), FOLHA_SECA, { bisel: 0.5, contorno: 0.2, alfa: 0.8, tom: 0.84 + 0.3 * acasoDoTemplo(i, 45), semente: 5650 + i }))
  }

  // O musgo nos cantos da laje e uma planta no canto do fundo.
  const tufos: readonly (readonly [number, number, number])[] = [[-0.8, -0.82, 5], [0.84, -0.6, 4], [-0.84, 0.3, 3.6], [0.7, 0.2, 3.4], [0.2, -0.88, 3.6]]
  tufos.forEach(([fx, fy, r], i) => {
    L.push(P(elipseGirada(fx * hw, fy * hh, r * 1.3 * k, r * 0.8 * k, acasoDoTemplo(i, 46) * Math.PI), MUSGO_DO_TEMPLO, { bisel: r * 0.4, contorno: 0.12, alfa: 0.6, suave: 0.9, tom: 0.92 + 0.16 * acasoDoTemplo(i, 47), semente: 5660 + i }))
  })

  // ---------- o que está EM CIMA da laje ----------
  const blocos: Bloco[] = []
  const muro = { tabua: 0, bisel: 1.7, contorno: 0.26 }
  const sombraDoMuro = { dist: 6.5 * k, forca: 0.44, suave: 1.6 }

  // Os dois PARAPEITOS da escada, com o marco entalhado na boca.
  for (const lado of [-1, 1]) {
    const [x0, x1] = lado < 0 ? [-wv - pt, -wv] : [wv, wv + pt]
    const parapeito = caixa(x0, yN, x1, yS - pt * 1.2)
    blocos.push({ forma: parapeito, apoio: parapeito.b, andar: 1 })
    L.push(P(parapeito, pedra, { ...muro, tom: 0.6, bisel: 0, contorno: 0.16, semente: 5700 + lado }))
    L.push(P(caixa(x0 + 0.4, yN + 0.4, x1 - 0.4, yS - pt * 1.2 - 0.4, 1), pedra, { ...muro, tom: 1.06, textura: texDoMuro(12 * k, 0.4, 3 + lado), semente: 5702 + lado, projeta: sombraDoMuro }))
    const lm = pt * 1.5
    const meio = (x0 + x1) / 2
    const marco = caixa(meio - lm / 2, yS - lm, meio + lm / 2, yS, 1)
    blocos.push({ forma: marco, apoio: marco.b, andar: 1 })
    L.push(P(marco, pedra, { ...muro, bisel: 1.9, tom: 1.14, contorno: 0.28, semente: 5710 + lado, projeta: sombraDoMuro }))
    L.push(P(caixa(meio - lm * 0.24, yS - lm * 0.74, meio + lm * 0.24, yS - lm * 0.26, 0.6), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.85, recesso: { k: 0.8, forca: 0.3 }, semente: 5712 + lado }))
  }

  // O MURO DO FUNDO, por cima do vão, e a CRESTA de três blocos em degrau.
  const fundo = caixa(-wv - pt - 2 * k, yM, wv + pt + 2 * k, yN)
  blocos.push({ forma: fundo, apoio: fundo.b, andar: 1 })
  const larguraDaCresta = (2 * (wv + pt)) / 4.4
  const [cy0, cy1] = [yM + (yN - yM) * 0.2, yM + (yN - yM) * 0.78]
  // O meio da caixa do muro fica no vão entre dois blocos da cresta: debaixo de um deles, o muro subiria com ele na 3/4.
  const [vx, vy] = [larguraDaCresta * 0.7, (yM + yN) / 2]
  L.push(P(comMeioEm(fundo, vx, vy), pedra, { ...muro, tom: 0.6, bisel: 0, contorno: 0.16, semente: 5720 }))
  L.push(P(comMeioEm(caixa(fundo.b[0] + 0.4, yM + 0.4, fundo.b[2] - 0.4, yN - 0.4, 1.2), vx, vy), pedra, { ...muro, bisel: 2, tom: 1.04, textura: texDoMuro(14 * k, 0.5, 7), semente: 5721, projeta: { dist: 7.5 * k, forca: 0.5, suave: 1.6 } }))
  for (let i = -1; i <= 1; i += 1) {
    const cx = i * larguraDaCresta * 1.4
    const bloco = caixa(cx - larguraDaCresta / 2, cy0, cx + larguraDaCresta / 2, cy1, 1)
    blocos.push({ forma: bloco, apoio: fundo.b, andar: 2 })
    L.push(P(bloco, pedra, { ...muro, bisel: 1.8, tom: 1.12, contorno: 0.28, textura: texDaPedraDoTemplo(0.3, 20 + i), semente: 5730 + i, projeta: { dist: 3.4 * k, forca: 0.36 } }))
    const d = larguraDaCresta * 0.24
    L.push(P(caixa(cx - larguraDaCresta / 2 + d, cy0 + d, cx + larguraDaCresta / 2 - d, cy1 - d, 0.8), pedra, { ...muro, bisel: 1.3, tom: 1.22, contorno: 0.24, semente: 5740 + i, projeta: { dist: 1.2 * k, forca: 0.24 } }))
  }
  // A PORTA na face da frente do muro do fundo (só sem giro: de lado e de costas ela não se vê).
  if (q === 0) {
    // Logo ao sul do muro: o meio da caixa cai no poço, e a peça sobe com o tampo da porta (não com o muro).
    const porta = caixa(-wv + 1, yN + 0.2, wv - 1, yN + 1.4)
    blocos.push({ forma: porta, apoio: fundo.b, andar: 3, menos: zMuro * 0.26 })
    L.push(P(porta, VAO, { bisel: 0, contorno: 0, semente: 5750 }))
  }

  // As duas PIRAS de pedra apagadas nos cantos da frente: a bacia, a cinza e uns carvões.
  for (const lado of [-1, 1]) {
    const [px, py] = [lado * hw * 0.72, hh * 0.7]
    const r = Math.min(7.4 * k, hw * 0.16)
    const bacia = elipse(px, py, r, r)
    blocos.push({ forma: bacia, apoio: bacia.b, andar: 1 })
    L.push(P(bacia, pedra, { tabua: 0, bisel: r * 0.36, tom: 1.08, contorno: 0.28, semente: 5760 + lado, projeta: { dist: 4.6 * k, forca: 0.4 } }))
    L.push(P(elipse(px, py, r * 0.68, r * 0.68), CINZA_DA_PIRA, { bisel: 0, contorno: 0.2, recesso: { k: 1.4, forca: 0.36 }, semente: 5762 + lado }))
    for (let i = 0; i < 4; i += 1) {
      const a = acasoDoTemplo(i + (lado + 1) * 4, 48) * Math.PI * 2
      const d = r * 0.34 * acasoDoTemplo(i + (lado + 1) * 4, 49)
      L.push(P(comMeioEm(elipseGirada(px + Math.cos(a) * d, py + Math.sin(a) * d, r * 0.2, r * 0.11, a * 1.7), px, py), CARVAO, { bisel: 0.4, contorno: 0.1, semente: 5770 + i + (lado + 1) * 4 }))
    }
  }

  // A ordem de pintura da 3/4: do norte para o sul na tela pela base de quem apoia; em cima do mesmo apoio, o andar.
  const emFila = blocos.map((b, i) => ({ b, i })).sort((a, b) => baseNaTelaDoTemplo(a.b.apoio, q) - baseNaTelaDoTemplo(b.b.apoio, q) || a.b.andar - b.b.andar || a.i - b.i)
  emOrdemNaTela(emFila.map(({ b }) => b.forma), q, Math.max(hw, hh) + 1).forEach((forma, i) => {
    const b = emFila[i].b
    cena.sombras.push(solta(forma, b.menos === undefined ? zLaje + zMuro * b.andar : zLaje + zMuro - b.menos))
  })

  // Os cipós que saem do pé do muro do fundo e se arrastam pela laje, e a planta do canto.
  cipo(L, P, fundo.b[0] - 1.5 * k, yM + 6 * k, -0.7, 0.7, 12 * k, 500)
  cipo(L, P, fundo.b[2] + 1.5 * k, yN - 8 * k, 0.8, 0.6, 10 * k, 501)
  roseta(L, P, -hw * 0.76, -hh * 0.5, 6.2 * k, 510)
}
