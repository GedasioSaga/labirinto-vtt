/**
 * CERCA DE ALAMBRADO de cima com volume (lote L10 de 24/11/2026, presídio moderno, o pátio e a quadra; versão da
 * cerca de ferro): um TRECHO de tela de arame galvanizado em losango, esticada entre MOURÕES de tubo com tampa, com o
 * tubo de cima (o travessão) e o arame liso de baixo. Barra a passagem e não tapa a visão: é quase toda vão.
 *
 * De cima a cerca é uma LINHA: o travessão, a ourela torcida da tela despontando ao lado dele (o ziguezague das
 * pontas), as amarras de arame (poucas: uma junto de cada mourão e as do meio bem espaçadas) e as tampas dos
 * mourões. O que diz "tela" é a SOMBRA: uma faixa rala arrastada na direção da luz com o LOSANGO do fio riscado nela
 * (mais aberto do que a conta daria, para ler de cima), a linha mais escura do travessão no fim e a risca de cada
 * mourão. Na 3/4 o losango é largo (um fio mais grosso, cinza mais escuro que o tubo) e cada fio tem a luz só do lado
 * de cima: a tela lê como arame, e não como chuvisco.
 *
 * O desenho se REPARTE pelo comprimento, como a cerca de ferro: um vão a cada `PASSO_DOS_MOUROES` casa (o trecho de
 * duas casas ganha o mourão do meio), nunca vãos mais largos. Cada mourão da ponta tem o MEIO na ponta da pegada:
 * dois trechos encostados põem os mourões um em cima do outro, e a emenda vira um mourão só. A cerca corre pelo lado
 * MAIOR da pegada.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): cada mourão é uma coluna com a tampa em cima; o travessão sobe num ponto só
 * dele (uma estrutura do tamanho de um ponto não pinta beirada nenhuma); a TELA é uma pilha de faixas de 2 px, cada
 * uma subida num ponto só dela, logo atrás da linha da cerca (sai antes do travessão e dos mourões). A textura de
 * cada faixa desenha o losango na altura dela (a conta lê o giro: de costas a altura corre para o outro lado; de lado
 * a tela fica de topo) e deixa transparente o vão entre os fios, junto com o arame liso de baixo. De cima as faixas
 * ficam debaixo do travessão.
 *
 * Sem material escolhido: o zinco do arame e dos tubos é fixo.
 */
import type { Rgb } from '../../ruido'
import { cadeia, capsula, caixa, elipse, type Forma, type Ponto } from './formas'
import { ruido, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Sombra, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { caixaArrastada, comMeioEm, deslocada, solta } from './andaimeDaTresQuartos'
import { REFLEXO } from './apoioDoBanheiroModerno'

/** As alturas, em casas: o travessão (1,9 m) e o mourão acima dele. */
const ALTURA_DO_TRAVESSAO = 1.27
const MOURAO_ACIMA = 0.04
/** Um vão a cada tanto de casa: é o que reparte o trecho (o de duas casas ganha o mourão do meio). */
const PASSO_DOS_MOUROES = 1
/** Os raios (px): o mourão (mais grosso que o travessão, como na cerca de verdade), a tampa dele, o travessão e o arame liso de baixo. */
const RAIO_DO_MOURAO = 1.6
const RAIO_DA_TAMPA = 2.2
const RAIO_DO_TRAVESSAO = 1.4
const RAIO_DO_ARAME_LISO = 0.3
/** A altura do arame liso de baixo (px): a tela começa nele. */
const ALTURA_DO_ARAME_LISO = 2
/** A tela: a largura do losango (px), o raio do fio, o quanto o fio cobre e a altura de cada faixa (px). */
const PASSO_DA_TELA = 4.5
const RAIO_DO_FIO = 0.26
const ALFA_DO_FIO = 0.85
const FAIXA = 2
/** A luz do fio: o lado de cima (virado para a luz) clareia, o de baixo escurece um nada. */
const LUZ_DO_FIO = { claro: 0.12, escuro: -0.06 } as const
/** O passo (px) entre os pontos das faixas, atrás da linha da cerca: cada uma tem o seu. */
const PASSO_DO_PONTO = 0.01
/** A ourela torcida: o quanto o ziguezague desponta ao lado do travessão (px). */
const OURELA = 0.55
/** As amarras de arame no travessão: o passo das do meio e o quanto a de cada ponta fica do mourão (px). */
const PASSO_DAS_AMARRAS = 22
const AMARRA_DO_MOURAO = 3
/** A cinta de cada amarra: a meia largura ao longo do tubo e o quanto passa dele de cada lado (px). */
const AMARRA = { meia: 0.4, sobra: 0.2 } as const
/** O losango na sombra: a largura ao comprido (a da tela) e a altura de través (px no chão), a meia grossura do fio e a força. */
const LOSANGO_DA_SOMBRA = { ao: PASSO_DA_TELA, atraves: 3, forca: 0.26 } as const
const FIO_DA_SOMBRA = 0.3

/** O zinco do arame (o fio, mais escuro que o tubo) e dos tubos: cinza frio, quase sem cor. */
const ARAME: MaterialDaPeca = { classe: 'liso', rgb: [0x7e, 0x84, 0x86] }
const ZINCO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0xa1, 0xa2] }
/** O escuro em que o pixel escuro demais é levantado: o cinza frio da sombra do zinco. */
const PISO_DA_CERCA: Rgb = [0x45, 0x49, 0x4b]

/** Uma estrutura do tamanho de um ponto: a peça com o meio nele sobe até a altura dela; nada dela pinta. */
function ponto(x: number, y: number): Forma {
  return { b: [x, y, x, y], d: (px, py) => (Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6 ? -1 : 1e3) }
}

/** A direção do desenho que fica PARA CIMA na tela depois do giro da 3/4 (a conta da cerca de ferro). */
function paraCima(giro: number): Ponto {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [-1, 0] : quartos === 2 ? [0, 1] : quartos === 3 ? [1, 0] : [0, -1]
}

/**
 * A tela na faixa de altura `z`: o losango de fio, transparente no vão, e o arame liso de baixo. `sobe` diz quanto a
 * altura cresce por px de través (o giro: de frente, de costas ou de topo); `ao` diz se a cerca corre em x.
 */
function texturaDaTela(z: number, sobe: number, ao: boolean): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    const ua = ao ? x : y
    const h = z + sobe * (ao ? y : x)
    const a = (ua + h) / PASSO_DA_TELA
    const b = (ua - h) / PASSO_DA_TELA
    const da = Math.abs(a - Math.round(a)) * PASSO_DA_TELA * Math.SQRT1_2
    const db = Math.abs(b - Math.round(b)) * PASSO_DA_TELA * Math.SQRT1_2
    const liso = Math.abs(h - ALTURA_DO_ARAME_LISO) + RAIO_DO_FIO - RAIO_DO_ARAME_LISO
    const d = Math.min(da, db, liso)
    const fio = Math.max(0, Math.min(1, (RAIO_DO_FIO + 0.5 / escala - d) * escala))
    s[5] *= fio * ALFA_DO_FIO
    // O lado de cima de cada fio pega a luz: o do "\" é o de cima à direita, o do "/" o de cima à esquerda.
    const claro = d === liso ? h > ALTURA_DO_ARAME_LISO : da < db ? a > Math.round(a) : b < Math.round(b)
    s[3] += (claro ? LUZ_DO_FIO.claro : LUZ_DO_FIO.escuro) + ruido(ua * 0.2 + p.semente, h * 0.2) * 0.04
  }
}

/**
 * O losango da tela na sombra, no chão: a faixa arrastada da linha da cerca (`v` = 0) até a altura `z`, com o fio em
 * losango. Desenhado mais aberto do que a conta daria (com o sol alto a sombra da tela de verdade esmaga o losango
 * num cinza liso): é ele que diz "tela" de cima.
 */
function sombraEmLosango(L: number, z: number, ao: boolean): Forma {
  const fundo = (ao ? SOMBRA_Y : SOMBRA_X) * z
  const desliza = (ao ? SOMBRA_X : SOMBRA_Y) / (ao ? SOMBRA_Y : SOMBRA_X)
  const gradiente = Math.hypot(1 / LOSANGO_DA_SOMBRA.ao, 1 / LOSANGO_DA_SOMBRA.atraves)
  const [ax, ay] = ao ? [SOMBRA_X * z, fundo] : [fundo, SOMBRA_Y * z]
  return {
    b: ao ? [-L, -1, L + ax, ay + 1] : [-1, -L, ax + 1, L + ay],
    d(x, y) {
      // s: o quanto o ponto já desceu na direção da sombra; u: onde ele cai ao longo da cerca, tirado o deslize.
      const s = ao ? y : x
      const u = (ao ? x : y) - s * desliza
      const fora = Math.max(-s, s - fundo, Math.abs(u) - L)
      const a = u / LOSANGO_DA_SOMBRA.ao + s / LOSANGO_DA_SOMBRA.atraves
      const b = u / LOSANGO_DA_SOMBRA.ao - s / LOSANGO_DA_SOMBRA.atraves
      const fio = Math.min(Math.abs(a - Math.round(a)), Math.abs(b - Math.round(b))) / gradiente - FIO_DA_SOMBRA
      return Math.max(fora, fio)
    },
  }
}

export const montarCercaDeAlambrado: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DA_CERCA
  // A cerca corre pelo lado maior: `u` ao comprido, `v` de través.
  const ao = w >= h
  const L = ao ? hw : hh
  const xy = (u: number, v: number): Ponto => (ao ? [u, v] : [v, u])
  const tubo = (u0: number, u1: number, v: number, r: number): Forma => {
    const [x0, y0] = xy(u0, v)
    const [x1, y1] = xy(u1, v)
    return capsula(x0, y0, x1, y1, r)
  }
  const zTravessao = g * ALTURA_DO_TRAVESSAO
  const zMourao = zTravessao + g * MOURAO_ACIMA
  const vaos = Math.max(1, Math.round((2 * L) / (PASSO_DOS_MOUROES * g)))
  const passo = (2 * L) / vaos
  const mouroes = Array.from({ length: vaos + 1 }, (_, i) => -L + i * passo)
  const [ux, uy] = paraCima(c.giro)
  const sobe = ao ? uy : ux
  const faixas = Math.ceil((zTravessao - ALTURA_DO_ARAME_LISO + 1) / FAIXA)

  // As sombras: a faixa rala da tela, a linha do travessão no fim dela e os mourões em coluna.
  const [ax0, ay0] = xy(-L, -0.4)
  const [ax1, ay1] = xy(L, 0.4)
  const sombraDaTela: Sombra = { forma: caixaArrastada(Math.min(ax0, ax1), Math.min(ay0, ay1), Math.max(ax0, ax1), Math.max(ay0, ay1), zTravessao), z: 0, suave: 1.2, forca: 0.06 }
  const losangos: Sombra = { forma: sombraEmLosango(L, zTravessao, ao), z: 0, suave: 0.45, forca: LOSANGO_DA_SOMBRA.forca }
  const travessao = tubo(-L, L, 0, RAIO_DO_TRAVESSAO)
  cena.sombras.push(sombraDaTela, losangos, { forma: deslocada(travessao, SOMBRA_X * zTravessao, SOMBRA_Y * zTravessao), z: 0, suave: 1.3, forca: 0.2 })
  const pes = mouroes.map((u) => {
    const [x, y] = xy(u, 0)
    return elipse(x, y, RAIO_DO_MOURAO, RAIO_DO_MOURAO)
  })
  for (const pe of pes) cena.sombras.push({ forma: pe, z: zMourao, forca: 0.24 })

  const partes = cena.partes
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  for (let i = 0; i < vaos; i += 1) {
    const u0 = mouroes[i]
    const u1 = mouroes[i + 1]
    const meio = (u0 + u1) / 2
    // A TELA: as faixas, cada uma no ponto dela (atrás da linha da cerca, antes do travessão na ordem).
    for (let k = 0; k < faixas; k += 1) {
      const z = ALTURA_DO_ARAME_LISO + FAIXA * (k + 0.5) - 1
      const v = -PASSO_DO_PONTO * (k + 1)
      const [px, py] = xy(meio, v)
      cena.sombras.push(solta(ponto(px, py), z))
      const [x0, y0] = xy(u0, -FAIXA / 2)
      const [x1, y1] = xy(u1, FAIXA / 2)
      const faixa = caixa(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1))
      partes.push(P(comMeioEm(faixa, px, py), ARAME, { ...liso, textura: texturaDaTela(z, sobe, ao), semente: 10501 + k }))
    }
    // O TRAVESSÃO do vão, a ourela torcida despontando ao lado e as amarras: tudo sobe no ponto do travessão.
    const [tx, ty] = xy(meio, 0)
    cena.sombras.push(solta(ponto(tx, ty), zTravessao))
    partes.push(P(tubo(u0, u1, 0, RAIO_DO_TRAVESSAO), ZINCO, { tabua: 0, bisel: RAIO_DO_TRAVESSAO, metal: 0.4, contorno: 0.28, semente: 10560 + i, projeta: { dist: 0.6, forca: 0.22 } }))
    const pontas: Ponto[] = []
    const n = Math.max(2, Math.round((u1 - u0) / (PASSO_DA_TELA / 2)))
    for (let j = 0; j <= n; j += 1) pontas.push(xy(u0 + ((u1 - u0) * j) / n, RAIO_DO_TRAVESSAO + (j % 2 === 0 ? 0.05 : OURELA)))
    partes.push(P(comMeioEm(cadeia(pontas, 0.16), tx, ty), ARAME, { tabua: 0, bisel: 0, contorno: 0.18, semente: 10565 + i }))
    // As amarras: uma junto de cada mourão e as do meio repartidas, bem espaçadas.
    const doMeio = Math.max(1, Math.round((u1 - u0) / PASSO_DAS_AMARRAS))
    const amarras = [u0 + AMARRA_DO_MOURAO, ...Array.from({ length: doMeio - 1 }, (_, j) => u0 + ((u1 - u0) * (j + 1)) / doMeio), u1 - AMARRA_DO_MOURAO]
    for (const a of amarras) {
      // A amarra é uma volta de arame: uma cinta estreita atravessando o tubo, um nada mais larga que ele.
      const [bx0, by0] = xy(a - AMARRA.meia, -RAIO_DO_TRAVESSAO - AMARRA.sobra)
      const [bx1, by1] = xy(a + AMARRA.meia, RAIO_DO_TRAVESSAO + AMARRA.sobra)
      const cinta = caixa(Math.min(bx0, bx1), Math.min(by0, by1), Math.max(bx0, bx1), Math.max(by0, by1), 0.3)
      partes.push(P(comMeioEm(cinta, tx, ty), ARAME, { tabua: 0, bisel: 0.3, tom: 1.04, contorno: 0.26, semente: 10570 + i }))
      const [mx, my] = xy(a, -RAIO_DO_TRAVESSAO * 0.4)
      partes.push(P(comMeioEm(elipse(mx, my, 0.25, 0.25), tx, ty), REFLEXO, { ...liso, alfa: 0.3, semente: 10575 }))
    }
    partes.push(P(comMeioEm(tubo(u0 + 1.8, u1 - 1.8, -RAIO_DO_TRAVESSAO * 0.43, 0.32), tx, ty), REFLEXO, { ...liso, alfa: 0.22, suave: 0.3, semente: 10578 }))
  }

  // Os MOURÕES: a tampa de cima, com o brilho (a peça de cada coluna).
  pes.forEach((pe, i) => {
    const [cx, cy] = [(pe.b[0] + pe.b[2]) / 2, (pe.b[1] + pe.b[3]) / 2]
    partes.push(P(elipse(cx, cy, RAIO_DA_TAMPA, RAIO_DA_TAMPA), ZINCO, { tabua: 0, bisel: RAIO_DA_TAMPA, metal: 0.45, contorno: 0.3, semente: 10580 + i, projeta: { dist: 0.6, forca: 0.26 } }))
    partes.push(P(elipse(cx - 0.65, cy - 0.65, 0.7, 0.56), REFLEXO, { ...liso, alfa: 0.45, suave: 0.3, semente: 10590 + i }))
  })
}
