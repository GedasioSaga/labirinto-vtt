/**
 * BARREIRA DE CONCRETO de cima com volume (14/11/2026, lote L05 dos objetos
 * novos, base militar): o bloco de concreto de perfil "New Jersey" que fecha a
 * estrada da base, posto em fila. O mestre estica o trecho em linha, como a
 * cerca e o muro baixo de pedra: a fila ganha mais BLOCOS (um a cada
 * `BLOCO` casas), nunca blocos esticados, e entre dois blocos fica a junta com
 * a GRAPA de ferro que os prende.
 *
 * O perfil é o que diz o que ela é: o PÉ largo rente ao chão, a RAMPA que sobe
 * inclinada, a FACE quase de pé e o TOPO estreito. De cima, cada um é uma
 * faixa ao comprido, com a luz de cima à esquerda: a rampa e a face do lado da
 * luz (o norte, ou o oeste no trecho em pé) claras, as do outro lado escuras.
 * No topo, os dois FUROS de içar; nas quinas, as LASCAS claras do concreto
 * batido; na rampa, a SUJEIRA de chuva e lama, mais forte embaixo.
 *
 * Na 3/4 o perfil aparece em degraus. Cada faixa é uma coluna de altura própria
 * (o pé baixo, a rampa até a quebra, o miolo até o topo), e a 3/4
 * (`tresQuartos.ts`) pinta as colunas do norte para o sul: a face do miolo
 * sobe acima da rampa, a rampa acima do pé. A grapa é um tampo no ar, sem
 * sombra, com a caixa declarada até a beira do miolo, para ser pintada depois
 * dele.
 *
 * O trecho corre pelo lado MAIOR da pegada (`u` ao comprido, `v` de través,
 * trocados no trecho em pé). Sem material escolhido: o concreto é fixo.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** O concreto: cinza claro um nada quente, com o grão do granito fazendo a brita. */
const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xae, 0xaa, 0xa1] }
/** O fundo dos furos de içar e a sujeira: o concreto bem escuro, sem textura. */
const FUNDO_DO_FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x4f, 0x4c, 0x47] }
const SUJEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x66, 0x5a] }
/** A grapa de ferro da junta. */
const FERRO_DA_GRAPA: MaterialDaPeca = { classe: 'metal', rgb: [0x5a, 0x55, 0x50] }
/** O escuro em que o pixel escuro demais é levantado: o cinza do concreto (com a nogueira, a junta saía marrom). */
const ESCURO_DO_CONCRETO: Rgb = [0x4c, 0x4a, 0x46]

/** O comprimento de um bloco, em casas (3 m). */
const BLOCO = 2
/** A junta entre dois blocos (px do protótipo). */
const JUNTA = 0.9
/** Onde cada faixa acaba, em fração da meia fundura, do eixo para fora: o topo, a face e a rampa (o pé vai até a beira). */
const TOPO = 0.26
const FACE = 0.4
const RAMPA = 0.86
/** As alturas, em casas: o pé, a quebra entre a rampa e a face, e o topo (0,8 m). */
const ALTURA_DO_PE = 0.06
const ALTURA_DA_QUEBRA = 0.24
const ALTURA_DO_TOPO = 0.55
/** O tom de cada faixa de cima: do lado da luz e do lado da sombra. */
const TOM_DO_TOPO = 1.04
const TOM_DA_FACE_NA_LUZ = 1.12
/** A rampa da luz e a da sombra bem separadas (rodada 3): no tamanho de mesa é o que faz ler a cumeeira do perfil. */
const TOM_DA_FACE_NA_SOMBRA = 0.7
const TOM_DA_RAMPA_NA_LUZ = 1.14
const TOM_DA_RAMPA_NA_SOMBRA = 0.78
const TOM_DO_PE = 0.94
/** O canto do bloco (px do protótipo): o concreto é desformado com a quina quebrada. */
const CANTO = 0.9
/** Os furos de içar: a quanto do bloco ficam das pontas (fração do bloco) e o tamanho (px do protótipo). */
const LUGAR_DO_FURO = 0.24
const FURO_AO_COMPRIDO = 2.8
const FURO_DE_TRAVES = 1.9
/** O vão de escoamento no pé de cada bloco: a largura (casas) e a tira dele além da frente da pegada (px do protótipo). */
const VAO_DE_ESCOAMENTO = 0.3
const TIRA_DO_VAO = 0.3
/** As lascas: quantas por bloco e o tamanho (px do protótipo). */
const LASCAS_POR_BLOCO = 5
const LASCA = 1.6
const TOM_DA_LASCA = 1.2
const BEIRA_DA_LASCA = 0.93
/** A sujeira da rampa: quantas manchas por casa de bloco, de que tamanho (px do protótipo) e quão forte. */
const MANCHAS_POR_CASA = 3
const MANCHA = 3.2
const ALFA_DA_SUJEIRA = 0.22
/** A grapa: comprimento ao longo do trecho e largura (px do protótipo), e quanto ela fica acima do topo. */
const GRAPA_AO_COMPRIDO = 3.4
const GRAPA_DE_TRAVES = 0.5
const GRAPA_ACIMA = 0.6
/** A sombra deitada que o bloco faz no chão, para baixo à direita, em fração da altura do topo, e a força. */
const SOMBRA_DEITADA = 0.62
const FORCA_DA_SOMBRA_DEITADA = 0.24
const SUAVE_DA_SOMBRA_DEITADA = 2.4

export const montarBarreiraDeConcreto: MontarMovel = (c, cena) => {
  const P = c.peca
  const deitado = c.w >= c.h
  const meioC = (deitado ? c.w : c.h) / 2
  const meiaD = (deitado ? c.h : c.w) / 2
  const caixaDoTrecho = (u0: number, v0: number, u1: number, v1: number, raio = 0): Forma =>
    deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio)
  const pt = (u: number, v: number): Ponto => (deitado ? [u, v] : [v, u])
  const blocos = Math.max(1, Math.round((2 * meioC) / (BLOCO * G)))
  const passo = (2 * meioC) / blocos

  // A sombra deitada do trecho inteiro: um retângulo empurrado para baixo à direita, no chão (z 0: não é estrutura).
  const sx = SOMBRA_X * ALTURA_DO_TOPO * G * SOMBRA_DEITADA
  const sy = SOMBRA_Y * ALTURA_DO_TOPO * G * SOMBRA_DEITADA
  const [x0, y0] = pt(-meioC, -meiaD)
  const [x1, y1] = pt(meioC, meiaD)
  cena.sombras.push(
    { forma: caixa(x0 + sx, y0 + sy, x1 + sx, y1 + sy, 2), z: 0, suave: SUAVE_DA_SOMBRA_DEITADA, forca: FORCA_DA_SOMBRA_DEITADA },
    contato(caixaDoTrecho(-meioC, -meiaD, meioC, meiaD, CANTO)),
  )

  for (let b = 0; b < blocos; b += 1) {
    const u0 = -meioC + passo * b + (b > 0 ? JUNTA / 2 : 0)
    const u1 = -meioC + passo * (b + 1) - (b < blocos - 1 ? JUNTA / 2 : 0)
    const s = 300 + b * 40
    /** As faixas, de fora para dentro de cada lado: [onde começa, onde acaba (fração), altura, tom, contorno]. */
    const faixas: readonly (readonly [number, number, number, number, number])[] = [
      [-1, -RAMPA, ALTURA_DO_PE, TOM_DO_PE, 0.28],
      [-RAMPA, -FACE, ALTURA_DA_QUEBRA, TOM_DA_RAMPA_NA_LUZ, 0.1],
      [-FACE, FACE, ALTURA_DO_TOPO, 1, 0.14],
      [FACE, RAMPA, ALTURA_DA_QUEBRA, TOM_DA_RAMPA_NA_SOMBRA, 0.1],
      [RAMPA, 1, ALTURA_DO_PE, TOM_DO_PE * 0.92, 0.28],
    ]
    faixas.forEach(([va, vb, z, tom, contorno], i) => {
      const forma = caixaDoTrecho(u0, va * meiaD, u1, vb * meiaD, CANTO * 0.6)
      cena.sombras.push({ forma, z: z * G })
      cena.partes.push(P(forma, CONCRETO, { tabua: 0, bisel: 0.9, contorno, tom, semente: s + i }))
    })
    // A face quase de pé de cada lado do topo e o topo por cima dela (a face é a beira da faixa do miolo).
    cena.partes.push(
      P(caixaDoTrecho(u0, -FACE * meiaD, u1, -TOPO * meiaD, CANTO * 0.4), CONCRETO, { tabua: 0, bisel: 0.5, contorno: 0.06, tom: TOM_DA_FACE_NA_LUZ, semente: s + 6 }),
      P(caixaDoTrecho(u0, TOPO * meiaD, u1, FACE * meiaD, CANTO * 0.4), CONCRETO, { tabua: 0, bisel: 0.5, contorno: 0.06, tom: TOM_DA_FACE_NA_SOMBRA, semente: s + 7 }),
      P(caixaDoTrecho(u0 + 0.4, -TOPO * meiaD, u1 - 0.4, TOPO * meiaD, CANTO * 0.4), CONCRETO, { tabua: 0, bisel: 0.7, contorno: 0.08, tom: TOM_DO_TOPO, semente: s + 8 }),
    )
    // O vão de escoamento no pé da frente, que só a 3/4 mostra: um tampo no ar raso colado na frente da pegada, da
    // altura do pé, com a peça escura dele (de cima, um fio na beira). Na barreira em pé a frente é a ponta: sem vão.
    if (deitado) {
      const meioVao = (VAO_DE_ESCOAMENTO * G) / 2
      const um = (u0 + u1) / 2
      cena.sombras.push({ forma: caixa(um - meioVao, meiaD - 0.2, um + meioVao, meiaD + TIRA_DO_VAO, 0.4), z: ALTURA_DO_PE * G, solta: true, forca: 0 })
      cena.partes.push(P(caixa(um - meioVao, meiaD, um + meioVao, meiaD + TIRA_DO_VAO), FUNDO_DO_FURO, { tabua: 0, bisel: 0, contorno: 0, semente: s + 9 }))
    }
    // A sujeira na rampa de cada lado, mais junto do pé.
    const manchas = Math.max(2, Math.round(((u1 - u0) / G) * MANCHAS_POR_CASA))
    for (let k = 0; k < manchas; k += 1) {
      const lado = k % 2 === 0 ? -1 : 1
      const u = u0 + ((k + 0.5 + (hash(b, k, 51) - 0.5) * 0.8) / manchas) * (u1 - u0)
      const v = lado * meiaD * (RAMPA - 0.08 - hash(b, k, 52) * 0.22)
      const r = MANCHA * (0.6 + hash(b, k, 53) * 0.7)
      cena.partes.push(P(caixaDoTrecho(u - r, v - r * 0.35, u + r, v + r * 0.35, r * 0.35), SUJEIRA, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_SUJEIRA, suave: 1.2, semente: s + 10 + k }))
    }
    // Os dois furos de içar no topo.
    for (const f of [LUGAR_DO_FURO, 1 - LUGAR_DO_FURO]) {
      const u = u0 + (u1 - u0) * f
      cena.partes.push(P(caixaDoTrecho(u - FURO_AO_COMPRIDO / 2, -FURO_DE_TRAVES / 2, u + FURO_AO_COMPRIDO / 2, FURO_DE_TRAVES / 2, 0.5), FUNDO_DO_FURO, { tabua: 0, bisel: 0.4, contorno: 0.2, recesso: { k: 1.2, forca: 0.4 }, semente: s + 20 }))
    }
    // As lascas claras nas quinas do topo e do pé.
    for (let k = 0; k < LASCAS_POR_BLOCO; k += 1) {
      const u = u0 + 2 + hash(b, k, 61) * (u1 - u0 - 4)
      // A lasca da beira do pé fica um nada para dentro: não sai do contorno do bloco.
      const quinas = [-TOPO, TOPO, -BEIRA_DA_LASCA, BEIRA_DA_LASCA, -RAMPA, RAMPA]
      const v = quinas[Math.floor(hash(b, k, 62) * quinas.length)] * meiaD
      const r = LASCA * (0.6 + hash(b, k, 63) * 0.6)
      const giro = hash(b, k, 64) * Math.PI
      const pontos: Ponto[] = [0, 1, 2, 3, 4].map((j) => {
        const a = giro + (j / 5) * Math.PI * 2
        const rr = r * (0.6 + hash(k, j, 65 + b) * 0.5)
        return pt(u + Math.cos(a) * rr, v + Math.sin(a) * rr * 0.6)
      })
      cena.partes.push(P(poligono(pontos), CONCRETO, { tabua: 0, bisel: 0.4, contorno: 0, tom: TOM_DA_LASCA, alfa: 0.85, semente: s + 30 + k }))
    }
  }

  // A grapa de ferro em cada junta, por cima do topo dos dois blocos.
  for (let b = 1; b < blocos; b += 1) {
    const u = -meioC + passo * b
    const grapa = caixaDoTrecho(u - GRAPA_AO_COMPRIDO / 2, -GRAPA_DE_TRAVES * meiaD * 0.5, u + GRAPA_AO_COMPRIDO / 2, GRAPA_DE_TRAVES * meiaD * 0.5, 0.4)
    // A caixa declarada vai até a beira do miolo: a 3/4 pinta a grapa depois do topo dos blocos, e não por baixo dele.
    const [bx0, by0] = pt(u - GRAPA_AO_COMPRIDO / 2, -FACE * meiaD)
    const [bx1, by1] = pt(u + GRAPA_AO_COMPRIDO / 2, FACE * meiaD + 0.1)
    const declarada: Caixa = [Math.min(bx0, bx1), Math.min(by0, by1), Math.max(bx0, bx1), Math.max(by0, by1)]
    cena.sombras.push({ forma: { b: declarada, d: grapa.d }, z: ALTURA_DO_TOPO * G + GRAPA_ACIMA, solta: true, forca: 0 })
    cena.partes.push(P(grapa, FERRO_DA_GRAPA, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.4, semente: 390 + b, projeta: { dist: 0.9, forca: 0.35, suave: 0.6 } }))
  }
  cena.corDoPiso = ESCURO_DO_CONCRETO
}
