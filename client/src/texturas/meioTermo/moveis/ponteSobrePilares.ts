/**
 * PONTE SOBRE PILARES (lote L08 de 24/11/2026, item 76: construção, versão larga da ponte de pedra; as pontes que
 * cruzam a cascata do mapa 6; desenho próprio, só a ideia do objeto). O TABULEIRO largo de lajes de pedra em fiadas de
 * través, gasto no meio por onde se passa, a MURETA de blocos dos dois lados, com o capeamento mais claro, e os quatro
 * pilaretes entalhados nas pontas. Por baixo, os PILARES: cada um passa do tabuleiro para os dois lados num TALHA-MAR
 * em ponta (o bico que corta a correnteza), de duas águas, com o musgo na pedra molhada e a ESPUMA branco-gelo que a
 * água faz ao bater nele. Entre um pilar e outro o tabuleiro fica no ar: a sombra dele cai solta na água.
 *
 * A ponte corre ao longo do lado MAIOR da pegada (como a ponte e o arco do portão): a de partida, 5 x 2 casas,
 * deitada. Esticada, ganha lajes, blocos de mureta e pilares (um vão a cada casa e meia, mais ou menos); as medidas de
 * través (a mureta, o bico) ficam na régua da casa.
 *
 * NA 3/4 (derivada, com a beirada do perfil, `ESPESSURA_DA_PONTE_SOBRE_PILARES`): os pilares são COLUNAS do chão até
 * debaixo do tabuleiro; o tabuleiro é um TAMPO SOLTO da espessura do perfil; a mureta, outro tampo em cima dele, e
 * os pilaretes, mais um. O tabuleiro e o que está em cima dele saem depois dos pilares na ordem de pintura
 * (`emOrdemNaTela`, lê `c.giro`): de frente se vê a faixa do tabuleiro, os pilares embaixo e o chão (a água) entre eles.
 * Lê `c.giro` também para a luz das duas águas de cada bico ficar do lado certo NA TELA.
 * Material: `pedra`; o musgo e a espuma são fixos. Escreve `cena.corDoPiso`. Anda-se em cima dela: não barra, não tapa.
 */
import { hash } from '../../ruido'
import { solta } from './andaimeDaTresQuartos'
import { caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'
import {
  acasoDoTemplo,
  baseNaTelaDoTemplo,
  cipo,
  DA_PEDRA,
  emOrdemNaTela,
  ESCURO_DA_PEDRA_DO_TEMPLO,
  luzDaFaceDoTemplo,
  moita,
  musgoNoPonto,
  quartosDoGiroDoTemplo,
  texDaPedraDoTemplo,
  tingir,
  TOM_DO_MUSGO_DO_TEMPLO,
} from './piramideEmDegraus'

/** A espessura do tabuleiro, a altura da mureta em cima dele e a do pilarete em cima dela (casas): a beirada do perfil. */
const ESPESSURA = 0.2
export const ESPESSURA_DA_PONTE_SOBRE_PILARES = ESPESSURA * G
/** A altura do alto do pilar (debaixo do tabuleiro), em casas. */
const ALTURA_DO_PILAR = 0.32
/** O bico do talha-mar para fora do tabuleiro, a meia largura do pilar e a mureta (casas). */
const BICO = 0.29
const MEIO_PILAR = 0.23
const MURETA = 0.125
/** O vão entre dois pilares (casas), a fiada de lajes (casas) e o bloco da mureta (casas). */
const VAO = 1.6
const FIADA = 0.25
const BLOCO = 0.42
/** A espuma branco-gelo em volta do bico. */
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xeb, 0xe7] }

/** A régua da ponte: `u` ao longo, `v` de través, centro na origem. Deitada, u é x; em pé, u é y. */
interface Regua {
  /** Meio comprimento e meia largura (px). */
  readonly C: number
  readonly A: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly retangulo: (u0: number, v0: number, u1: number, v1: number, raio?: number) => Forma
  readonly poligono: (pontos: readonly Ponto[]) => Forma
  /** A direção (du, dv) da régua no referencial do objeto. */
  readonly direcao: (du: number, dv: number) => Ponto
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  const ponto = (u: number, v: number): Ponto => (deitada ? [u, v] : [-v, u])
  return {
    C: deitada ? c.hw : c.hh,
    A: deitada ? c.hh : c.hw,
    ponto,
    retangulo: (u0, v0, u1, v1, raio = 0) => (deitada ? caixa(u0, v0, u1, v1, raio) : caixa(-v1, u0, -v0, u1, raio)),
    poligono: (pontos) => poligono(pontos.map(([u, v]) => ponto(u, v))),
    direcao: ponto,
  }
}

/** O musgo e o limo da pedra molhada do pilar: mais musgo perto da água (a ponta do bico). */
function texDoPilar(semente: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    DA_PEDRA(u, v, x, y, p, s, escala)
    const t = musgoNoPonto(x, y, 0.02, semente) * 0.72
    if (t > 0) tingir(s, TOM_DO_MUSGO_DO_TEMPLO, t)
  }
}

export const montarPonteSobrePilares: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.C > 0) || !(r.A > 0)) return
  const { g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const q = quartosDoGiroDoTemplo(c.giro)
  cena.corDoPiso = ESCURO_DA_PEDRA_DO_TEMPLO
  const { C } = r
  const bico = Math.min(g * BICO, r.A * 0.3)
  /** A meia largura do tabuleiro: a pegada menos o bico dos pilares de cada lado. */
  const A = r.A - bico
  const mureta = Math.min(g * MURETA, A * 0.2)
  const pista = A - mureta
  const zPilar = g * ALTURA_DO_PILAR
  const zTabuleiro = zPilar + g * ESPESSURA

  // ---------- os PILARES: a coluna com os dois bicos, de duas águas cada um, e a espuma na água ----------
  const vaos = Math.max(2, Math.round((2 * C) / (g * VAO)))
  const pw = Math.min(g * MEIO_PILAR, C / vaos / 2.4)
  for (let i = 1; i < vaos; i += 1) {
    const u = -C + ((2 * C) * i) / vaos
    const planta = r.poligono([[u - pw, -A - 1], [u, -A - bico], [u + pw, -A - 1], [u + pw, A + 1], [u, A + bico], [u - pw, A + 1]])
    cena.sombras.push({ forma: planta, z: zPilar, forca: 0.3 }, contato(planta, 0.34))
    for (const lado of [-1, 1]) {
      // A espuma que a água faz no bico: dois riscos em V e uns flocos, no chão (não sobem na 3/4).
      for (const banda of [-1, 1]) {
        const [fx, fy] = r.ponto(u + banda * (pw * 0.9 + 2.4), lado * (A + bico * 0.42))
        const [du, dv] = r.direcao(banda * 0.5, lado * -1)
        L.push(P(elipse(fx, fy, 2.2 + Math.abs(du) * 3.4, 2.2 + Math.abs(dv) * 3.4), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.46, suave: 1.6, semente: 7000 + i * 8 + lado * 2 + banda }))
        for (let j = 0; j < 3; j += 1) {
          const sal = i * 40 + (lado + 1) * 10 + (banda + 1) * 3 + j
          const [bx, by] = r.ponto(u + banda * (pw * 0.4 + 2 + 5 * acasoDoTemplo(sal, 95)), lado * (A + bico * (0.9 - 0.62 * acasoDoTemplo(sal, 96)) + 1.5))
          const rb = 0.9 + 1.1 * acasoDoTemplo(sal, 97)
          L.push(P(elipse(bx, by, rb, rb * 0.86), ESPUMA, { bisel: rb * 0.5, contorno: 0, alfa: 0.86, suave: 0.6, semente: 7020 + sal }))
        }
      }
      const [px, py] = r.ponto(u, lado * (A + bico + 1.6))
      L.push(P(elipse(px, py, 3, 2.2), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.6, suave: 1.2, semente: 7010 + i * 2 + lado }))
    }
    // O fundo do pilar (a junta) e as duas águas de cada bico: a que olha para a luz, clara; a outra, escura.
    L.push(P(planta, pedra, { tabua: 0, bisel: 0, tom: 0.56, contorno: 0.24, semente: 7100 + i }))
    for (const lado of [-1, 1]) {
      for (const banda of [-1, 1]) {
        const agua = r.poligono([[u, lado * (A - 2)], [u + banda * (pw - 0.5), lado * (A - 2)], [u + banda * (pw - 0.5), lado * (A + 1)], [u, lado * (A + bico - 0.7)]])
        const [nx, ny] = r.direcao(banda * 0.82, lado * 0.57)
        L.push(P(agua, pedra, { tabua: 0, bisel: 0.7, tom: 0.94, contorno: 0.2, luz: luzDaFaceDoTemplo(nx, ny, q), textura: texDoPilar(i * 4 + lado + banda), semente: 7110 + i * 8 + lado * 2 + banda }))
      }
    }
  }

  // ---------- o TABULEIRO: o leito escuro, as lajes em fiadas de través e a faixa gasta do meio ----------
  const tabuleiro = r.retangulo(-C, -A, C, A, 1.4)
  L.push(P(tabuleiro, pedra, { tabua: 0, bisel: 0.6, tom: 0.56, contorno: 0.22, semente: 7200 }))
  const fiadas = Math.max(2, Math.round((2 * C - 1) / (g * FIADA)))
  const passo = (2 * C - 1) / fiadas
  const daLaje = texDaPedraDoTemplo(0.26, 77)
  let n = 0
  for (let f = 0; f < fiadas; f += 1) {
    const u0 = -C + 0.5 + f * passo
    let v = -pista + (f % 2 === 0 ? 0 : -9)
    while (v < pista) {
      const comprido = 15 + 9 * acasoDoTemplo(n, 98)
      const v0 = Math.max(-pista, v)
      const v1 = Math.min(pista, v + comprido)
      if (v1 - v0 > 3.4) {
        // Gasta no meio, por onde se passa: mais clara e mais lisa.
        const gasto = 0.07 * Math.exp(-(((v0 + v1) / 2 / (pista * 0.5)) ** 2))
        L.push(P(r.retangulo(u0 + 0.5, v0 + 0.5, u0 + passo - 0.5, v1 - 0.5, 1.6), pedra, { tabua: 0, bisel: 1.2, tom: 0.9 + gasto + 0.12 * acasoDoTemplo(n, 99), contorno: 0.2, textura: daLaje, semente: 7210 + (n % 600) }))
      }
      n += 1
      v += comprido
    }
  }

  // ---------- a MURETA dos dois lados (blocos com o capeamento claro) e os quatro PILARETES das pontas ----------
  const emCima: { forma: Forma; andar: number }[] = []
  const lp = Math.min(mureta * 1.9, C * 0.2)
  const blocos = Math.max(2, Math.round((2 * C - 2 * lp) / (g * BLOCO)))
  const comprimento = (2 * C - 2 * lp) / blocos
  for (const lado of [-1, 1]) {
    const [v0, v1] = lado < 0 ? [-A, -A + mureta] : [A - mureta, A]
    emCima.push({ forma: r.retangulo(-C, v0, C, v1, 1), andar: 1 })
    L.push(P(r.retangulo(-C + 0.4, v0 + 0.3, C - 0.4, v1 - 0.3, 1), pedra, { tabua: 0, bisel: 0, tom: 0.6, contorno: 0.2, semente: 7300 + lado }))
    for (let j = 0; j < blocos; j += 1) {
      const u0 = -C + lp + j * comprimento
      L.push(P(r.retangulo(u0 + 0.5, v0 + 0.3, u0 + comprimento - 0.5, v1 - 0.3, 1.3), pedra, { tabua: 0, bisel: 1.8, tom: 1.06 + 0.1 * hash(j, lado + 2, 7301), contorno: 0.26, textura: texDaPedraDoTemplo(0.36, 30 + j + lado), semente: 7310 + j * 2 + (lado + 1) / 2, projeta: { dist: 3, forca: 0.36 } }))
    }
    for (const ponta of [-1, 1]) {
      const [u0, u1] = ponta < 0 ? [-C, -C + lp] : [C - lp, C]
      const [w0, w1] = lado < 0 ? [-A - 0.6, -A + mureta + 1.4] : [A - mureta - 1.4, A + 0.6]
      const pilarete = r.retangulo(u0, w0, u1, w1, 1.4)
      emCima.push({ forma: pilarete, andar: 2 })
      L.push(P(pilarete, pedra, { tabua: 0, bisel: 2, tom: 1.14, contorno: 0.28, semente: 7400 + ponta + lado * 3, projeta: { dist: 3.6, forca: 0.36 } }))
      const [mu, mv] = [(u0 + u1) / 2, (w0 + w1) / 2]
      const e = Math.min(u1 - u0, w1 - w0) * 0.24
      L.push(P(r.retangulo(mu - e, mv - e, mu + e, mv + e, 0.6), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.85, recesso: { k: 0.8, forca: 0.3 }, semente: 7410 + ponta + lado * 3 }))
    }
  }

  // ---------- a ordem da 3/4: depois dos pilares, o tabuleiro; em cima dele a mureta; em cima dela os pilaretes ----------
  const fila = emCima.map((b, i) => ({ b, i })).sort((a, b) => a.b.andar - b.b.andar || baseNaTelaDoTemplo(a.b.forma.b, q) - baseNaTelaDoTemplo(b.b.forma.b, q) || a.i - b.i)
  const [primeiro, ...resto] = emOrdemNaTela([tabuleiro, ...fila.map(({ b }) => b.forma)], q, Math.max(c.hw, c.hh) + 1)
  // Só o tabuleiro faz sombra no chão: ela cai solta na água, entre os pilares.
  cena.sombras.push({ forma: primeiro, z: zTabuleiro, solta: true, forca: 0.3 })
  resto.forEach((forma, i) => cena.sombras.push(solta(forma, zTabuleiro + g * ESPESSURA * fila[i].b.andar)))

  // ---------- o TEMPO: dois cipós pendurados da mureta da frente e uma moita numa ponta da de trás ----------
  const [c1x, c1y] = r.ponto(-C * 0.36, A - mureta * 0.5)
  const [d1x, d1y] = r.direcao(0.12, 1)
  cipo(L, P, c1x, c1y, d1x, d1y, mureta + 7, 720)
  const [c2x, c2y] = r.ponto(C * 0.56, A - mureta * 0.5)
  const [d2x, d2y] = r.direcao(-0.1, 1)
  cipo(L, P, c2x, c2y, d2x, d2y, mureta + 4, 721)
  const [mx, my] = r.ponto(-C + lp + 6, -A + mureta * 0.6)
  moita(L, P, mx, my, 4.6, 722, 4)
}
