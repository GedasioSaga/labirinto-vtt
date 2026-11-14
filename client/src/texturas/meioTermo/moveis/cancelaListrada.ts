/**
 * CANCELA LISTRADA de cima com volume (14/11/2026, lote L05 dos objetos
 * novos, base militar): a cancela do posto de controle. Numa ponta fica o
 * POSTE de aço pintado, numa sapata de concreto rente ao chão, com o garfo do
 * eixo no alto; o BRAÇO listrado de vermelho e branco sai do eixo e atravessa
 * a passagem até o GARFO de descanso da outra ponta; para trás do eixo, o
 * braço curto com o CONTRAPESO de ferro. De cima o braço é a faixa listrada
 * que diz o que ela é; a sombra dele cai solta no chão, para baixo à direita.
 *
 * O braço corre pelo lado MAIOR da pegada (`u` ao comprido, `v` de través,
 * trocados na cancela em pé) e se REPARTE pelo comprimento: a cancela
 * esticada ganha listras, nunca listras esticadas. O poste, o contrapeso e o
 * garfo têm medida própria (por casa).
 *
 * Na 3/4 (`tresQuartos.ts`) o poste e o garfo são colunas; cada LISTRA é um
 * tampo no ar próprio, para a lateral do braço sair listrada também (a
 * beirada de um tampo leva o material da peça dele). O braço passa POR CIMA do
 * poste: as listras, o braço curto e a bochecha da frente do garfo do eixo
 * declaram a caixa até depois da base do poste, para serem pintados depois
 * dele (a 3/4 pinta as estruturas do norte para o sul pela base da caixa). A
 * sapata não é estrutura: é chão, rente.
 *
 * Sem material escolhido: o vermelho e o branco são a cara dela.
 */
import { type Rgb } from '../../ruido'
import { caixa, capsula, uniao, type Caixa, type Forma } from './formas'
import { contato, type MaterialDaPeca, type Sombra } from './motor'
import { G, PREGO, type MontarMovel } from './contexto'

/** O vermelho e o branco da tinta: contidos (saturação HSV 0,57; com o vermelho vivo, 0,7, a folha passava do teto). */
const VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0xb3, 0x58, 0x4d] }
const BRANCO: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xdd, 0xd2] }
/** O aço pintado do poste, a tampa dele e o ferro do contrapeso, do garfo e do braço curto. */
const ACO_DO_POSTE: MaterialDaPeca = { classe: 'metal', rgb: [0x92, 0x95, 0x90] }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: [0x55, 0x52, 0x4e] }
/** A sapata de concreto do poste. */
const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa9, 0xa5, 0x9c] }
/** O escuro em que o pixel escuro demais é levantado: o cinza do ferro. */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x47, 0x44]

/** O poste: o lado (casas, no máximo esta fração da fundura) e a altura do topo, em casas. */
const LADO_DO_POSTE = 0.3
const POSTE_NA_FUNDURA = 0.82
const ALTURA_DO_POSTE = 0.62
/** A sapata de concreto passa do poste esta fração do lado dele, de cada lado (na fundura, até a beira da pegada). */
const SOBRA_DA_SAPATA = 0.32
/** Onde fica o eixo (o meio do poste), em casas a partir da ponta de trás. */
const EIXO = 0.5
/** O braço: a largura e o comprimento de uma listra, em casas; a altura do alto dele, em casas (logo acima do poste). */
const LARGURA_DO_BRACO = 0.1
const LISTRA = 0.3
const ALTURA_DO_BRACO = 0.7
/** Quanto o braço passa do garfo, em casas, e a folga da ponta dele até a beira da pegada (px do protótipo). */
const PONTA_ALEM_DO_GARFO = 0.17
const FOLGA_DA_PONTA = 1.2
/** O contrapeso: o comprimento e a largura em casas, e quanto ele sobe acima do braço (px do protótipo). */
const CONTRAPESO = 0.28
const LARGURA_DO_CONTRAPESO = 0.2
const CONTRAPESO_ACIMA = 1.2
/** O garfo do eixo no alto do poste: as duas bochechas (comprimento e espessura em casas) e quanto sobem acima do braço (px). */
const BOCHECHA = 0.16
const ESPESSURA_DA_BOCHECHA = 0.035
const BOCHECHA_ACIMA = 1.4
/** O garfo de descanso: o lado da haste, a espessura dos dentes (casas) e quanto os dentes passam do braço (px). */
const HASTE_DO_GARFO = 0.08
const DENTE = 0.035
const DENTE_ACIMA = 1.6
/** Quanto a caixa declarada de quem passa por cima do poste vai além da base dele (px do protótipo). */
const DEPOIS_DO_POSTE = 0.1
/** Quanto o meio declarado da sapata fica ao sul da base do poste (px do protótipo). */
const MEIO_DA_SAPATA_ALEM = 1
/**
 * O braço começa e o curto acaba este tanto antes do eixo (px do protótipo): o meio do poste, da tampa e do
 * pino fica fora deles, e a 3/4 sobe essas peças com o poste, não com o braço.
 */
const FOLGA_DO_EIXO = 0.01
/** A sombra do braço, solta no chão. */
const FORCA_DA_SOMBRA_DO_BRACO = 0.24
const SUAVE_DA_SOMBRA_DO_BRACO = 1.1

export const montarCancelaListrada: MontarMovel = (c, cena) => {
  const P = c.peca
  const deitado = c.w >= c.h
  const meioC = (deitado ? c.w : c.h) / 2
  const meiaD = (deitado ? c.h : c.w) / 2
  const caixaDoTrecho = (u0: number, v0: number, u1: number, v1: number, raio = 0): Forma =>
    deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio)
  /** A caixa (no referencial da imagem) de u0..u1 por v0..v1. */
  const caixaDeclarada = (u0: number, v0: number, u1: number, v1: number): Caixa => (deitado ? [u0, v0, u1, v1] : [v0, u0, v1, u1])

  const meioPoste = Math.min(LADO_DO_POSTE * G, POSTE_NA_FUNDURA * 2 * meiaD) / 2
  const uEixo = Math.min(-meioC + EIXO * G, 0)
  const meioBraco = (LARGURA_DO_BRACO * G) / 2
  const zBraco = ALTURA_DO_BRACO * G
  const uPonta = meioC - FOLGA_DA_PONTA
  const uGarfo = uPonta - PONTA_ALEM_DO_GARFO * G
  /** A base do poste na 3/4 (a beira de baixo dele): quem passa por cima declara a caixa até depois dela. */
  const fimDoPoste = meioPoste + DEPOIS_DO_POSTE
  // A caixa vai até depois da base do poste nos dois sentidos: na cancela em pé a base dele é ao comprido.
  const porCimaDoPoste = (forma: Forma, u0: number, u1: number, z: number, forca?: number): Sombra => ({
    forma: { b: caixaDeclarada(u0, forma.b[deitado ? 1 : 0], Math.max(u1, uEixo + fimDoPoste), fimDoPoste), d: forma.d },
    z,
    solta: true,
    forca,
    suave: SUAVE_DA_SOMBRA_DO_BRACO,
  })

  // A sapata de concreto, rente ao chão. Fica no chão na 3/4 porque o meio da caixa dela não cai em estrutura
  // nenhuma: a caixa declarada desce até o meio ficar ao sul do poste (o meio de verdade é o do poste, que a subiria).
  const sobra = meioPoste * SOBRA_DA_SAPATA
  const meiaSapata = Math.min(meiaD, meioPoste + sobra)
  const sapata = caixaDoTrecho(uEixo - meioPoste - sobra, -meiaSapata, uEixo + meioPoste + sobra, meiaSapata, 0.8)
  const meioAoSul = fimDoPoste + MEIO_DA_SAPATA_ALEM
  const sapataNoChao: Forma = { b: caixaDeclarada(uEixo - meioPoste - sobra, -meiaSapata, uEixo + meioPoste + sobra, 2 * meioAoSul + meiaSapata), d: sapata.d }
  cena.sombras.push(contato(sapata, 0.26))
  cena.partes.push(P(sapataNoChao, CONCRETO, { tabua: 0, bisel: 0.8, contorno: 0.22, tom: 0.98, semente: 400 }))

  // O poste: a coluna de aço pintado e a tampa dele, um nada mais escura, com os quatro parafusos.
  const poste = caixaDoTrecho(uEixo - meioPoste, -meioPoste, uEixo + meioPoste, meioPoste, 1)
  cena.sombras.push({ forma: poste, z: ALTURA_DO_POSTE * G }, contato(poste, 0.32))
  cena.partes.push(P(poste, ACO_DO_POSTE, { tabua: 0, bisel: 1.3, contorno: 0.26, metal: 0.3, semente: 401 }))
  cena.partes.push(P(caixaDoTrecho(uEixo - meioPoste + 1.4, -meioPoste + 1.4, uEixo + meioPoste - 1.4, meioPoste - 1.4, 0.8), ACO_DO_POSTE, { tabua: 0, bisel: 0.6, contorno: 0.12, tom: 0.86, metal: 0.3, semente: 402 }))
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pu = uEixo + su * (meioPoste - 2.3)
    const pv = sv * (meioPoste - 2.3)
    cena.partes.push(P(caixaDoTrecho(pu - 0.6, pv - 0.6, pu + 0.6, pv + 0.6, 0.6), PREGO, { tabua: 0, bisel: 0.6, contorno: 0.1, metal: 0.4 }))
  }

  // O garfo de descanso: a haste (coluna), um nada para trás do braço (o meio dela fica fora dele, e a 3/4 a sobe
  // com a coluna dela), e os dois dentes, um de cada lado do braço.
  const meiaHaste = (HASTE_DO_GARFO * G) / 2
  const vHaste = -(meioBraco + 0.2)
  const haste = caixaDoTrecho(uGarfo - meiaHaste, vHaste - meiaHaste, uGarfo + meiaHaste, vHaste + meiaHaste, 0.6)
  cena.sombras.push({ forma: haste, z: zBraco - 1 }, contato(haste, 0.3))
  cena.partes.push(P(haste, FERRO, { tabua: 0, bisel: 0.8, contorno: 0.25, semente: 403 }))
  const dente = (DENTE * G) / 2
  const dentes = [-1, 1].map((lado) => caixaDoTrecho(uGarfo - meiaHaste, lado * (meioBraco + 0.4) - dente, uGarfo + meiaHaste, lado * (meioBraco + 0.4) + dente, 0.3))
  // O dente de trás é pintado antes do braço; o da frente, depois (a caixa declarada passa da do braço).
  cena.sombras.push({ forma: dentes[0], z: zBraco + DENTE_ACIMA, forca: 0.2 })
  cena.sombras.push(porCimaDoPoste(dentes[1], uGarfo - meiaHaste, uGarfo + meiaHaste, zBraco + DENTE_ACIMA, 0))
  cena.partes.push(P(dentes[0], FERRO, { tabua: 0, bisel: 0.4, contorno: 0.25, semente: 404 }))

  // O braço curto de ferro, do eixo para trás, e o contrapeso na ponta dele.
  const uContrapeso = Math.max(-meioC + 0.6, uEixo - meioPoste - 0.6 - CONTRAPESO * G)
  const curto = caixaDoTrecho(uContrapeso + 1, -meioBraco * 0.9, uEixo - FOLGA_DO_EIXO, meioBraco * 0.9, 0.8)
  cena.sombras.push(porCimaDoPoste(curto, uContrapeso + 1, uEixo - FOLGA_DO_EIXO, zBraco, FORCA_DA_SOMBRA_DO_BRACO))
  cena.partes.push(P(curto, FERRO, { tabua: 0, bisel: 0.9, contorno: 0.25, semente: 405 }))
  const meioContrapeso = Math.min((LARGURA_DO_CONTRAPESO * G) / 2, meiaD)
  const contrapeso = caixaDoTrecho(uContrapeso, -meioContrapeso, uEixo - meioPoste - 0.6, meioContrapeso, 1.2)
  cena.sombras.push({ forma: contrapeso, z: zBraco + CONTRAPESO_ACIMA, solta: true, forca: FORCA_DA_SOMBRA_DO_BRACO })
  cena.partes.push(P(contrapeso, FERRO, { tabua: 0, bisel: 1.6, contorno: 0.28, metal: 0.3, tom: 0.92, semente: 406, projeta: { dist: 1.2, forca: 0.3 } }))

  // O braço listrado, do eixo à ponta: cada listra é um tampo no ar com a sua peça, a ponta arredondada.
  const uBraco = uEixo + FOLGA_DO_EIXO
  const listras = Math.max(2, Math.round((uPonta - uBraco) / (LISTRA * G)))
  const passo = (uPonta - uBraco) / listras
  for (let i = 0; i < listras; i += 1) {
    const u0 = uBraco + passo * i
    const u1 = u0 + passo
    const corpo = caixaDoTrecho(u0, -meioBraco, i === listras - 1 ? u1 - meioBraco : u1, meioBraco)
    const listra = i === listras - 1 ? uniao(corpo, capsulaDoTrecho(u1 - meioBraco, meioBraco)) : corpo
    // A listra da ponta é vermelha (a ponta é a que se vê de longe).
    const cor = (listras - 1 - i) % 2 === 0 ? VERMELHO : BRANCO
    cena.sombras.push(porCimaDoPoste(listra, u0, u1, zBraco, FORCA_DA_SOMBRA_DO_BRACO))
    cena.partes.push(P(listra, cor, { tabua: 0, bisel: meioBraco * 0.7, contorno: 0.24, semente: 410 + i, projeta: { dist: 1.3, forca: 0.3, suave: 0.8 } }))
  }

  // O garfo do eixo no alto do poste: as duas bochechas, uma de cada lado do braço, e o pino atravessado.
  const meiaBochecha = Math.min((BOCHECHA * G) / 2, meioPoste)
  const espessura = (ESPESSURA_DA_BOCHECHA * G) / 2
  const bochechas = [-1, 1].map((lado) => caixaDoTrecho(uEixo - meiaBochecha, lado * (meioBraco + espessura + 0.2) - espessura, uEixo + meiaBochecha, lado * (meioBraco + espessura + 0.2) + espessura, 0.4))
  cena.sombras.push({ forma: bochechas[0], z: zBraco + BOCHECHA_ACIMA, forca: 0.2 })
  cena.sombras.push(porCimaDoPoste(bochechas[1], uEixo - meiaBochecha, uEixo + meiaBochecha, zBraco + BOCHECHA_ACIMA + 0.01, 0))
  for (const b of bochechas) cena.partes.push(P(b, FERRO, { tabua: 0, bisel: 0.5, contorno: 0.28, metal: 0.4, semente: 420 }))
  cena.partes.push(P(caixaDoTrecho(uEixo - 0.9, -meioBraco - 2 * espessura - 0.8, uEixo + 0.9, meioBraco + 2 * espessura + 0.8, 0.9), PREGO, { tabua: 0, bisel: 0.8, contorno: 0.2, metal: 0.55 }))
  // O dente da frente do garfo de descanso, por cima do braço.
  cena.partes.push(P(dentes[1], FERRO, { tabua: 0, bisel: 0.4, contorno: 0.25, semente: 421 }))
  cena.corDoPiso = ESCURO_DO_FERRO

  /** A ponta redonda do braço: um disco no referencial do trecho. */
  function capsulaDoTrecho(u: number, r: number): Forma {
    return deitado ? capsula(u, 0, u, 0, r) : capsula(0, u, 0, u, r)
  }
}
