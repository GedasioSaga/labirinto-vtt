/**
 * XADREZ GIGANTE DE JARDIM de cima com volume (lote L11 dos objetos novos,
 * 14/11/2026, "Descanso e brincadeira"): o tabuleiro de LAJES no chão, oito
 * por oito, as claras de pedra creme e as escuras da pedra escolhida, com o
 * rejunte entre elas, dentro de um MEIO-FIO de madeira; em cima, uma partida
 * pela metade, com as PEÇAS grandes de madeira torneada (as claras pintadas
 * de creme, as escuras da madeira escolhida): de cada lado o rei, a rainha,
 * uma torre, um cavalo, um bispo e três peões.
 *
 * Vista de cima a peça é um disco (a base larga e o corpo), e o que diz qual
 * peça é o alto dela: o peão, a bola; a torre, as ameias em volta do miolo
 * oco; o cavalo, a cabeça comprida com a crina e as orelhas, virada para o
 * outro lado; o bispo, a mitra com o corte de través e a bolinha; a rainha, a
 * coroa de bolinhas; o rei, a coroa com a cruz. A 25% de zoom sobram o
 * quadriculado e os discos espalhados: é o que diz "xadrez".
 *
 * Na 3/4 as lajes ficam no chão (o meio do tabuleiro, o canto das quatro casas
 * do centro, fica livre de peça de propósito) e o meio-fio sobe um pouco. Cada
 * peça é a coluna do corpo (fina, da altura da peça), com o alto em cima
 * dela, de pé num disco largo no chão, a base. A base vista de cima leva a
 * caixa puxada para o sul (`naCaixa`), para sair da coluna do corpo e ficar no
 * chão. Perfil derivado.
 *
 * Desenhado em 3 x 3 casas; o tabuleiro sai do menor lado da pegada.
 * Materiais: `pedra` (as lajes escuras) e `madeira` (as peças escuras e o
 * meio-fio). A pedra creme das lajes claras e o creme das peças claras são
 * fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, barra, caixa, capsula, elipse, menos, uniao, type Caixa, type Forma } from './formas'
import { contato, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { circulo } from './tampoEmFatias'

/** O tabuleiro: o lado (fração do menor lado da pegada) e o meio-fio (casas). */
const LADO_DO_TABULEIRO = 0.96
const MEIO_FIO = 0.07
const ALTURA_DO_MEIO_FIO = 0.05
/** A pedra das lajes claras: a pedra creme, com o grão e a luz da pedra escolhida. */
const PEDRA_CLARA: Rgb = [0xd6, 0xcc, 0xb2]
/** O rejunte, em px do protótipo, e o chanfro pintado de cada laje (a beira de cima clara, a de baixo escura). */
const REJUNTE = 0.55
const CHANFRO_DA_LAJE = 1.8
/** O creme das peças claras: madeira pintada. */
const CREME: MaterialDaPeca = { classe: 'madeira', rgb: [0xe0, 0xd5, 0xba] }

/** O raio da base de toda peça (fração da casa do tabuleiro). */
const RAIO_DA_BASE = 0.41

type Tipo = 'peao' | 'torre' | 'cavalo' | 'bispo' | 'rainha' | 'rei'

/**
 * O corpo de cada tipo: o raio (fração da casa do tabuleiro) e a altura da peça (casas). Bem mais fino que a base
 * (0,41): na 3/4 a base aparece como o pé largo da peça. Mais altas que isto (o rei de 0,5 casa), as peças viravam
 * colunas que tapavam meio tabuleiro na 3/4.
 */
const CORPO: Readonly<Record<Tipo, { readonly raio: number; readonly altura: number }>> = {
  peao: { raio: 0.2, altura: 0.16 },
  torre: { raio: 0.27, altura: 0.22 },
  cavalo: { raio: 0.24, altura: 0.25 },
  bispo: { raio: 0.22, altura: 0.28 },
  rainha: { raio: 0.25, altura: 0.32 },
  rei: { raio: 0.26, altura: 0.36 },
}

/** A partida: tipo, clara (true) ou escura, coluna (0 = a) e fileira (1 a 8; as claras jogam do sul). */
const PECAS: readonly (readonly [Tipo, boolean, number, number])[] = [
  ['rei', false, 6, 8],
  ['torre', false, 4, 8],
  ['rainha', false, 3, 7],
  ['bispo', false, 1, 7],
  ['peao', false, 5, 7],
  ['peao', false, 7, 7],
  ['cavalo', false, 2, 6],
  ['peao', false, 6, 6],
  ['bispo', true, 2, 4],
  ['peao', true, 7, 3],
  ['cavalo', true, 5, 3],
  ['peao', true, 5, 2],
  ['peao', true, 6, 2],
  ['rainha', true, 4, 2],
  ['torre', true, 5, 1],
  ['rei', true, 6, 1],
]

/** A mesma forma com outra caixa de pintura (a 3/4 lê o meio da caixa para saber com quem a peça sobe). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: f.d }
}

/**
 * AS LAJES: a cor de cada casa (a clara, a creme), um tom sorteado por laje, o rejunte escuro e o chanfro pintado
 * (a beira do norte e do oeste clara, a do sul e do leste escura).
 */
function texDasLajes(x0: number, y0: number, casa: number): Textura {
  const pedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (pedra !== null) pedra(u, v, x, y, p, s, escala)
    const fi = (x - x0) / casa
    const fj = (y - y0) / casa
    const i = Math.floor(fi)
    const j = Math.floor(fj)
    if ((i + j) % 2 === 0) for (let k = 0; k < 3; k += 1) s[k] = PEDRA_CLARA[k]
    const ex = (fi - i) * casa
    const ey = (fj - j) * casa
    const perto = Math.min(ex, ey, casa - ex, casa - ey)
    let luz = (hash(i, j, 931) - 0.5) * 0.1
    if (perto < REJUNTE) luz -= 0.32 * (1 - perto / REJUNTE)
    else {
      if (ex < CHANFRO_DA_LAJE || ey < CHANFRO_DA_LAJE) luz += 0.06
      if (casa - ex < CHANFRO_DA_LAJE || casa - ey < CHANFRO_DA_LAJE) luz -= 0.07
    }
    s[3] += luz
  }
}

/** Monta uma PEÇA na casa de meio (x, y), com `s` = o lado da casa do tabuleiro. */
function montarPeca(c: ContextoDoMovel, cena: Cena, tipo: Tipo, clara: boolean, x: number, y: number, s: number, semente: number): void {
  const P = c.peca
  const mat = clara ? CREME : c.m.madeira
  const frente = clara ? -1 : 1
  const rb = s * RAIO_DA_BASE
  const { raio, altura } = CORPO[tipo]
  const rc = s * raio
  const base = circulo(x, y, rb)
  const corpo = circulo(x, y, rc)
  // A base é um disco no chão, sem coluna: com coluna própria ela vinha depois da do corpo (a beira sul dela fica
  // mais ao sul) e o disco erguido tapava o corpo inteiro na 3/4. A caixa puxada para o sul tira o meio dela do
  // corpo, e ela fica no chão, aos pés da coluna do corpo.
  cena.sombras.push({ forma: corpo, z: c.g * altura }, contato(circulo(x, y, rb * 1.05), 0.36))
  cena.partes.push(P(naCaixa(base, [x - rb, y - rb, x + rb, y + rb * 2.4]), mat, { eixo: 0.5, tabua: 0, bisel: 1.4, contorno: 0.3, tom: 0.88, semente }))
  cena.partes.push(P(corpo, mat, { eixo: 0.5, tabua: 0, bisel: rc * 0.55, contorno: 0.28, semente: semente + 1, projeta: { dist: 1.2, forca: 0.32, suave: 1 } }))
  const alto = { eixo: 0.5, tabua: 0, contorno: 0.28, tom: 1.06, projeta: { dist: 0.8, forca: 0.3, suave: 0.7 } }
  switch (tipo) {
    case 'peao':
      cena.partes.push(P(circulo(x, y, s * 0.17), mat, { ...alto, bisel: s * 0.17, semente: semente + 2 }))
      return
    case 'torre': {
      // As ameias: o anel com quatro vãos em X, e o miolo oco.
      cena.partes.push(P(anel(x, y, rc * 0.96, rc * 0.96, rc * 0.56, rc * 0.56), mat, { ...alto, bisel: 1, semente: semente + 2 }))
      for (const a of [0.785, 2.356, 3.927, 5.498]) {
        const vao = barra(x + Math.cos(a) * rc * 0.5, y + Math.sin(a) * rc * 0.5, x + Math.cos(a) * rc * 1.02, y + Math.sin(a) * rc * 1.02, s * 0.1)
        cena.partes.push(P(vao, mat, { bisel: 0.4, contorno: 0.2, tom: 0.62, semente: semente + 3 }))
      }
      cena.partes.push(P(circulo(x, y, rc * 0.56), mat, { bisel: 0.5, contorno: 0.24, tom: 0.7, recesso: { k: 1.6, forca: 0.45 }, semente: semente + 4 }))
      return
    }
    case 'cavalo': {
      // A cabeça comprida virada para o outro lado, a crina pelas costas e as duas orelhas.
      const ponta = y + frente * s * 0.36
      const nuca = y - frente * s * 0.12
      cena.partes.push(P(capsula(x, nuca, x, ponta, s * 0.12), mat, { ...alto, eixo: Math.PI / 2, bisel: s * 0.1, semente: semente + 2 }))
      cena.partes.push(P(capsula(x, nuca - frente * s * 0.05, x, y + frente * s * 0.1, s * 0.05), mat, { bisel: 0.5, contorno: 0.24, tom: 0.62, semente: semente + 3 }))
      for (const lado of [-1, 1]) cena.partes.push(P(elipse(x + lado * s * 0.08, nuca + frente * s * 0.02, s * 0.045, s * 0.07), mat, { bisel: 0.5, contorno: 0.26, tom: 0.96, semente: semente + 4 }))
      cena.partes.push(P(circulo(x - s * 0.05, ponta - frente * s * 0.05, s * 0.025), BURACO, { bisel: 0, contorno: 0, semente: semente + 5 }))
      return
    }
    case 'bispo': {
      // A mitra, o corte de través e a bolinha do alto.
      cena.partes.push(P(elipse(x, y, rc * 0.7, rc * 0.84), mat, { ...alto, bisel: rc * 0.6, semente: semente + 2 }))
      cena.partes.push(P(barra(x - rc * 0.5, y - rc * 0.08, x + rc * 0.2, y - rc * 0.56, s * 0.06), BURACO, { bisel: 0, contorno: 0, alfa: 0.8, semente: semente + 3 }))
      cena.partes.push(P(circulo(x + rc * 0.06, y + rc * 0.1, s * 0.07), mat, { ...alto, bisel: s * 0.07, semente: semente + 4 }))
      return
    }
    case 'rainha': {
      // A coroa de oito bolinhas e a bola do meio.
      cena.partes.push(P(circulo(x, y, rc * 0.8), mat, { bisel: 0.6, contorno: 0.24, tom: 0.8, recesso: { k: 1.2, forca: 0.3 }, semente: semente + 2 }))
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4
        cena.partes.push(P(circulo(x + Math.cos(a) * rc * 0.72, y + Math.sin(a) * rc * 0.72, s * 0.055), mat, { ...alto, bisel: s * 0.055, semente: semente + 3 + i }))
      }
      cena.partes.push(P(circulo(x, y, s * 0.11), mat, { ...alto, bisel: s * 0.11, semente: semente + 11 }))
      return
    }
    case 'rei': {
      // A coroa (o anel), e por cima a cruz.
      cena.partes.push(P(anel(x, y, rc * 0.86, rc * 0.86, rc * 0.6, rc * 0.6), mat, { ...alto, bisel: 1, semente: semente + 2 }))
      const braco = s * 0.2
      const grossura = s * 0.05
      const cruz = uniao(caixa(x - braco, y - grossura, x + braco, y + grossura, 0.4), caixa(x - grossura, y - braco, x + grossura, y + braco, 0.4))
      cena.partes.push(P(cruz, mat, { ...alto, bisel: s * 0.04, tom: 1.1, projeta: { dist: 1.3, forca: 0.36, suave: 0.8 }, semente: semente + 3 }))
      return
    }
  }
}

export const montarXadrezDeJardim: MontarMovel = (c, cena) => {
  const P = c.peca
  const lado = Math.min(c.w, c.h) * LADO_DO_TABULEIRO
  const meioFio = c.g * MEIO_FIO
  const meio = lado / 2
  const dentro = meio - meioFio
  const s = (2 * dentro) / 8

  // As lajes, rentes ao chão, e o meio-fio em volta, um pouco mais alto.
  const lajes = caixa(-dentro, -dentro, dentro, dentro)
  cena.partes.push(P(lajes, c.m.pedra, { bisel: 0, contorno: 0.16, tabua: 0, semente: 6600, textura: texDasLajes(-dentro, -dentro, s) }))
  const fio = menos(caixa(-meio, -meio, meio, meio, 1.2), caixa(-dentro, -dentro, dentro, dentro))
  cena.sombras.push({ forma: fio, z: c.g * ALTURA_DO_MEIO_FIO }, contato(caixa(-meio, -meio, meio, meio, 1.2), 0.26))
  cena.partes.push(P(fio, c.m.madeira, { tabua: 0, bisel: 1.2, contorno: 0.28, tom: 0.9, semente: 6601 }))

  // As peças, do norte para o sul (as do sul por cima das sombras das do norte).
  PECAS.forEach(([tipo, clara, coluna, fileira], i) => {
    const x = -dentro + (coluna + 0.5) * s
    const y = -dentro + (8 - fileira + 0.5) * s
    montarPeca(c, cena, tipo, clara, x, y, s, 6610 + i * 20)
  })
}
