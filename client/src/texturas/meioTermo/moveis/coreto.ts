/**
 * CORETO de cima com volume (lote L17 de 14/11/2026, construção do grupo Cidade e porto): o palanque da banda na
 * praça. O PÓDIO de pedra em oito lados com DOIS DEGRAUS na frente (a frente do coreto é o lado dos degraus), o
 * ASSOALHO de tábuas, o GUARDA-CORPO de balaústres brancos em volta (aberto nos degraus), OITO COLUNAS brancas nos
 * cantos e o TELHADO de oito águas com telhas, a FAIXA branca do beiral e o PINÁCULO de latão com a bola.
 * Entra-se nele (não barra): o pódio é a pegada, mas o meio é chão de andar.
 *
 * De cima: as oito águas do telhado (as do lado da luz mais claras) com a faixa branca em volta, um fio do
 * assoalho, o guarda-corpo branco em anel aberto na frente, a beira do pódio, os degraus, e a SOMBRA do telhado
 * para baixo à direita com o risco de cada coluna até ela. São o anel branco aberto, os degraus e a sombra das
 * colunas que dizem "coreto", e não quiosque (fechado, redondo) nem tenda.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DO_CORETO`, a espessura do perfil):
 * - o pódio e os degraus são colunas do chão; tudo o que fica em cima deles tem a caixa esticada para a frente NA
 *   TELA, para sair depois, nesta ordem: o guarda-corpo do fundo, as colunas, o guarda-corpo da frente, o telhado;
 * - o guarda-corpo são dois tampos de balaústres (o de baixo um tico mais largo, com um pingo branco nesse tico);
 * - cada coluna são discos empilhados do assoalho ao beiral, cada um com um pingo branco (`discosAoLongo`); o
 *   beiral tem um furo em cima de cada coluna, para os pingos não subirem com ele;
 * - o telhado são seis tampos em degrau, cada um com as oito águas dele, e a faixa branca do beiral (só a da frente
 *   NA TELA) sai por cima da beira de baixo.
 * Por isso o desenho lê `c.giro`. Medidas de cima pelo menor meio lado (o coreto continua de oito lados quando
 * esticado), alturas em casas. Materiais: `pedra` (pódio e degraus), `madeira` (assoalho) e `telhado` (pedra ou
 * pano, pintado como chapa). O branco, o latão e as telhas são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, capsula, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'
import {
  anguloDoDesenho,
  capsulaAfunilada,
  coluna,
  comMeioEm,
  deslocada,
  desvio,
  discosAoLongo,
  doDesenho,
  esticadaAte,
  furada,
  naTela,
  pingo,
  poligonoRegular,
  quartosDoGiro,
  solta,
  vara,
} from './apoioDaCidadeEPorto'

/** A beirada de cada tampo do coreto (px do protótipo): a altura de cada fiada de balaústres e de cada degrau do telhado. */
export const ESPESSURA_DO_CORETO = 0.1 * G

/** Medidas de cima em fração do menor meio lado (raio do canto do octógono, salvo o que diz "apótema"). */
const PODIO = 0.92
const DEGRAUS: readonly (readonly [number, number])[] = [[0.84, 0.92], [0.91, 0.99]]
const MEIA_LARGURA_DOS_DEGRAUS = 0.24
/** O guarda-corpo, em apótemas (a distância do meio a cada lado do octógono). */
const GUARDA: readonly [number, number] = [0.77, 0.81]
/** O tico a mais do tampo de baixo do guarda-corpo (px): o pingo branco dele fica ali. */
const TICO_DO_GUARDA = 0.35
const BALAUSTRES_POR_LADO = 6
const CHEIO_DO_BALAUSTRE = 0.36
const COLUNAS_EM = 0.7
const RAIO_DA_COLUNA = 0.036
/** As seis camadas do telhado (raio do canto) e quanto cada uma sobe acima da de baixo, em espessuras. */
const CAMADAS: readonly number[] = [0.8, 0.66, 0.52, 0.39, 0.26, 0.13]
const SUBIDA_DA_CAMADA = 0.9
/** A cumeeira (o canto entre duas águas): o meio da largura (px) e o tom, mais claro que as águas. */
const LARGURA_DA_CUMEEIRA = 0.9
const TOM_DA_CUMEEIRA = 1.16
/** A faixa branca do beiral: quanto passa do telhado (apótema, px). */
const FAIXA_PASSA = 1.4
/** O pináculo: o raio, a altura acima da camada de cima (espessuras) e a bola. */
const RAIO_DO_PINACULO = 0.03
const ALTURA_DO_PINACULO = 2.4
const RAIO_DA_BOLA = 0.055
/** Alturas em casas: o pódio e o beiral. */
const ALTURA_DO_PODIO = 0.32
const ALTURA_DO_BEIRAL = 1.75
/** As telhas: a fiada e a largura de cada uma (px). */
const FIADA_DA_TELHA = 0.05 * G
const LARGURA_DA_TELHA = 0.075 * G
/** A sombra: quanto anda por px de altura (para baixo à direita NA TELA) e a força. */
const SOMBRA_POR_ALTURA: readonly [number, number] = [0.27, 0.21]
const FORCA_DA_SOMBRA = 0.3
/** A vez de cada parte na 3/4 (fração do menor meio lado), todas depois do pódio e dos degraus. */
const VEZ_DO_GUARDA_DO_FUNDO = 1.0
const VEZ_DAS_COLUNAS = 1.002
const VEZ_DO_GUARDA_DA_FRENTE = 1.004
const VEZ_DO_TELHADO = 1.006
const VEZ_DA_FAIXA = 1.02
const VEZ_DO_PINACULO = 1.022

/** O branco da pintura das colunas, dos balaústres e da faixa. */
const BRANCO: MaterialDaPeca = { classe: 'madeira', rgb: [0xe4, 0xde, 0xd0] }
const LATAO = materialDaPeca('latao')
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** A apótema do octógono de lado chato na frente: a maior das oito projeções (o "raio" que mede a faixa). */
function apotema(x: number, y: number): number {
  const k = Math.SQRT1_2
  const a = Math.abs(x)
  const b = Math.abs(y)
  return Math.max(a, b, (a + b) * k)
}

/** O octógono pela apótema `a` (a distância vale perto dos lados; nos cantos é a das retas). */
function octogono(a: number): Forma {
  const r = a / Math.cos(Math.PI / 8)
  return { b: [-r, -r, r, r], d: (x, y) => apotema(x, y) - a }
}

/** O telhado: o tom do material, pintado como chapa quando é pano. */
function doTelhado(m: MaterialDaPeca): MaterialDaPeca {
  return m.classe === 'tecido' ? { classe: 'liso', rgb: m.rgb } : m
}

/** As telhas de uma água de normal (nx, ny): fiadas paralelas ao beiral, juntas desencontradas, a sombra da de cima. */
function texDasTelhas(nx: number, ny: number, base: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const subida = -(x * nx + y * ny) / FIADA_DA_TELHA
    const fiada = Math.floor(subida)
    const ao = (x * -ny + y * nx) / LARGURA_DA_TELHA + (fiada % 2) * 0.5
    const telha = Math.floor(ao)
    const t = subida - fiada
    s[3] += (hash(telha, fiada, 9611) - 0.5) * 0.1
    // A beira de baixo de cada telha faz sombra na de baixo dela; a junta de lado é um risco fino.
    if (t > 0.78) s[3] -= 0.26 * ((t - 0.78) / 0.22)
    const junta = Math.abs(ao - telha - 0.5)
    if (junta > 0.44) s[3] -= 0.14
  }
}

export const montarCoreto: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const e = ESPESSURA_DO_CORETO
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  const S = cena.sombras
  cena.corDoPiso = ESCURO_DA_PEDRA
  const f = (v: number): number => v * R
  const pedra = c.m.pedra
  const madeira = c.m.madeira
  const telhado = doTelhado(c.m.telhado)
  const texDoTelhado = texturaDaClasse(telhado.classe)
  const zPodio = ALTURA_DO_PODIO * G
  const zBeiral = ALTURA_DO_BEIRAL * G
  const zCamada = (i: number): number => zBeiral + e * (1 + SUBIDA_DA_CAMADA * i)
  const zTopo = zCamada(CAMADAS.length - 1)
  const daTela = (x: number, y: number): Ponto => doDesenho(x, y, quartos)
  const sombraEm = (z: number): Ponto => daTela(SOMBRA_POR_ALTURA[0] * z, SOMBRA_POR_ALTURA[1] * z)
  const frente = Math.PI / 2
  /** O vão do guarda-corpo é o lado da frente (o dos degraus), que anda com o giro. */
  const noVao = (x: number, y: number): boolean => Math.abs(desvio(x, y, frente)) < Math.PI / 8

  // ---------- as sombras no chão: o pódio, o telhado que afina para a ponta e o risco de cada coluna ----------
  const podio = poligonoRegular(0, 0, f(PODIO), 8, Math.PI / 8)
  const colunas: readonly Ponto[] = Array.from({ length: 8 }, (_, i) => [Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * f(COLUNAS_EM), Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * f(COLUNAS_EM)])
  const [bx, by] = sombraEm(zBeiral + e)
  const [px, py] = sombraEm(zTopo + ALTURA_DO_PINACULO * e)
  S.push(contato(podio, 0.32), { forma: deslocada(podio, ...sombraEm(zPodio)), z: 0, suave: 1.6, forca: 0.22 })
  S.push({ forma: deslocada(poligonoRegular(0, 0, f(CAMADAS[0]), 8, Math.PI / 8), bx, by), z: 0, suave: 3, forca: FORCA_DA_SOMBRA })
  S.push({ forma: capsulaAfunilada(bx, by, f(CAMADAS[1]), px, py, f(RAIO_DA_BOLA)), z: 0, suave: 3, forca: FORCA_DA_SOMBRA * 0.8 })
  for (const [x, y] of colunas) S.push({ forma: vara(x, y, x + bx, y + by, f(RAIO_DA_COLUNA)), z: 0, suave: 1.4, forca: 0.24 })

  // ---------- o pódio de pedra, os degraus e o assoalho ----------
  S.push(coluna(podio, zPodio))
  // O meio da pedra fica na beira de trás: no meio, ela subiria com o telhado.
  L.push(P(comMeioEm(podio, 0, -f(0.84)), pedra, { tabua: 0, bisel: 1.6, contorno: 0.28, tom: 0.9, semente: 9601 }))
  DEGRAUS.forEach(([y0, y1], i) => {
    const degrau = caixa(-f(MEIA_LARGURA_DOS_DEGRAUS), f(y0), f(MEIA_LARGURA_DOS_DEGRAUS), f(y1), 1)
    S.push(coluna(degrau, zPodio * (1 - (i + 1) / (DEGRAUS.length + 1))), contato(degrau, 0.26))
    L.push(P(degrau, pedra, { tabua: 0, bisel: 1.3, contorno: 0.3, tom: 0.96 + 0.05 * i, projeta: { dist: 1, forca: 0.26 }, semente: 9602 + i }))
  })
  const assoalho = poligonoRegular(0, 0, f(GUARDA[0] + 0.03) / Math.cos(Math.PI / 8), 8, Math.PI / 8)
  // O meio do assoalho fica no vão do guarda-corpo, fora do telhado.
  L.push(P(comMeioEm(assoalho, 0, f((GUARDA[0] + GUARDA[1]) / 2)), madeira, { tabua: 6, eixo: 0, bisel: 0.6, contorno: 0.26, tom: 0.94, semente: 9604 }))

  // ---------- o guarda-corpo: dois tampos de balaústres, aberto no vão; o corrimão branco de cada metade ----------
  const passo = (2 * Math.PI) / (8 * BALAUSTRES_POR_LADO)
  const meiaDoBalaustre = (passo * CHEIO_DO_BALAUSTRE) / 2
  const [a0, a1] = [f(GUARDA[0]), f(GUARDA[1])]
  const faixaDoGuarda = (tico: number, lado: -1 | 1, comBalaustres: boolean): Forma => {
    const r = (a1 + tico) / Math.cos(Math.PI / 8) + 1
    return {
      b: [-r, -r, r, r],
      d(x, y) {
        const ap = apotema(x, y)
        let d = Math.max(ap - a1 - tico, a0 - ap, -lado * naTela(x, y, quartos)[1])
        if (noVao(x, y)) d = Math.max(d, 1)
        if (comBalaustres) {
          const t = Math.atan2(y, x) / passo - 0.5
          d = Math.max(d, (Math.abs(t - Math.round(t)) * passo - meiaDoBalaustre) * ap)
        }
        return d
      },
    }
  }
  /** O meio de um balaústre do lado `lado` NA TELA (à frente ou atrás, a 45° do eixo), à apótema `a`. */
  const balaustreEm = (lado: -1 | 1, a: number): Ponto => {
    const alvo = anguloDoDesenho(lado > 0 ? Math.PI / 4 : (5 * Math.PI) / 4, quartos)
    const ang = (Math.round(alvo / passo - 0.5) + 0.5) * passo
    const [cx, cy] = [Math.cos(ang), Math.sin(ang)]
    const k = a / apotema(cx, cy)
    return [cx * k, cy * k]
  }
  const guarda = (lado: -1 | 1, vez: number, semente: number): void => {
    S.push(solta(esticadaAte(faixaDoGuarda(TICO_DO_GUARDA, lado, true), f(vez), quartos), zPodio + e))
    S.push(solta(esticadaAte(faixaDoGuarda(0, lado, true), f(vez) + 0.5, quartos), zPodio + 2 * e))
    const [tx, ty] = balaustreEm(lado, a1 + TICO_DO_GUARDA / 2)
    L.push(pingo(P, tx, ty, BRANCO, semente))
    const [mx, my] = balaustreEm(lado, (a0 + a1) / 2)
    L.push(P(comMeioEm(faixaDoGuarda(0, lado, false), mx, my), BRANCO, { tabua: 0, bisel: 0.7, contorno: 0.3, tom: 1, projeta: { dist: 1.2, forca: 0.3 }, semente: semente + 1 }))
  }
  guarda(-1, VEZ_DO_GUARDA_DO_FUNDO, 9610)

  // ---------- as oito colunas: discos do assoalho ao beiral, cada um com o pingo branco ----------
  const furos: Ponto[] = []
  colunas.forEach(([x, y], i) => {
    const pingos = discosAoLongo(S, [x, y, zPodio + e], [x, y, zBeiral], f(RAIO_DA_COLUNA), e, f(VEZ_DAS_COLUNAS) + 0.01 * i, quartos)
    pingos.forEach(([qx, qy], k) => L.push(pingo(P, qx, qy, BRANCO, 9620 + i * 40 + k)))
    furos.push([x - f(RAIO_DA_COLUNA) + 1.13, y])
  })

  guarda(1, VEZ_DO_GUARDA_DA_FRENTE, 9612)

  // ---------- o telhado: seis camadas em degrau, cada uma com as oito águas dela ----------
  CAMADAS.forEach((raio, i) => {
    const a = f(raio) * Math.cos(Math.PI / 8)
    const proxima = i + 1 < CAMADAS.length ? f(CAMADAS[i + 1]) : 0
    const forma = i === 0 ? furada(octogono(a), furos, 1.3) : octogono(a)
    S.push(solta(esticadaAte(forma, f(VEZ_DO_TELHADO) + 0.5 * i, quartos), zCamada(i)))
    for (let j = 0; j < 8; j += 1) {
      const n = (j * Math.PI) / 4
      const [nx, ny] = [Math.cos(n), Math.sin(n)]
      const canto = (r: number, s: number): Ponto => [Math.cos(n + (s * Math.PI) / 8) * r, Math.sin(n + (s * Math.PI) / 8) * r]
      const agua = poligono(proxima > 0 ? [canto(f(raio), -1), canto(f(raio), 1), canto(proxima, 1), canto(proxima, -1)] : [canto(f(raio), -1), canto(f(raio), 1), [0, 0]])
      const meio = (a + proxima * Math.cos(Math.PI / 8)) / 2
      const [sx, sy] = naTela(nx, ny, quartos)
      const tom = 0.92 - 0.13 * (sx * 0.62 + sy * 0.78)
      L.push(P(comMeioEm(agua, nx * meio, ny * meio), telhado, { tabua: 0, bisel: 0.6, contorno: 0.2, tom, textura: texDasTelhas(nx, ny, texDoTelhado), projeta: { dist: 1.4, forca: 0.3 }, semente: 9700 + i * 8 + j }))
    }
    // As cumeeiras: o canto entre duas águas, um friso mais claro que desenha a ponta do telhado.
    for (let j = 0; j < 8; j += 1) {
      const n = (j * Math.PI) / 4 + Math.PI / 8
      const [nx, ny] = [Math.cos(n), Math.sin(n)]
      const [r0, r1] = [f(raio) - 0.6, proxima]
      const cumeeira = capsula(nx * r0, ny * r0, nx * r1, ny * r1, LARGURA_DA_CUMEEIRA)
      // O meio fica na ponta de fora: no meio da cumeeira de baixo ficaria em cima de uma coluna e subiria com ela.
      const rm = r0 - 1.5
      L.push(P(comMeioEm(cumeeira, nx * rm, ny * rm), telhado, { tabua: 0, bisel: 0.5, contorno: 0.25, tom: TOM_DA_CUMEEIRA, projeta: { dist: 0.8, forca: 0.24 }, semente: 9760 + i * 8 + j }))
    }
  })

  // ---------- a faixa branca do beiral (só a da frente NA TELA) ----------
  const aBeiral = f(CAMADAS[0]) * Math.cos(Math.PI / 8)
  const corte = -0.3 * R
  const faixa: Forma = {
    b: [-aBeiral - FAIXA_PASSA - 1, -aBeiral - FAIXA_PASSA - 1, aBeiral + FAIXA_PASSA + 1, aBeiral + FAIXA_PASSA + 1],
    d(x, y) {
      const ap = apotema(x, y)
      return Math.max(ap - aBeiral - FAIXA_PASSA, aBeiral - 0.2 - ap, corte - naTela(x, y, quartos)[1])
    },
  }
  // Na altura da camada de baixo: a frente branca cobre a beira dela, e o anel de cima a contorna.
  S.push(solta(esticadaAte(faixa, f(VEZ_DA_FAIXA), quartos), zCamada(0)))
  const [fx, fy] = daTela(0, aBeiral + FAIXA_PASSA * 0.6)
  const faixaDeCima: Forma = { b: faixa.b, d: (x, y) => Math.max(apotema(x, y) - aBeiral - FAIXA_PASSA, aBeiral - 0.2 - apotema(x, y)) }
  L.push(P(comMeioEm(faixaDeCima, fx, fy), BRANCO, { tabua: 0, bisel: 0.4, contorno: 0.3, tom: 1.02, semente: 9790 }))

  // ---------- o pináculo de latão e a bola ----------
  const pingosDoPinaculo = discosAoLongo(S, [0, 0, zTopo + e * 0.6], [0, 0, zTopo + ALTURA_DO_PINACULO * e], f(RAIO_DO_PINACULO), e, f(VEZ_DO_PINACULO), quartos)
  pingosDoPinaculo.forEach(([qx, qy], k) => L.push(pingo(P, qx, qy, LATAO, 9791 + k)))
  const bola = poligonoRegular(0, 0, f(RAIO_DA_BOLA), 12, 0)
  // A bola tem um furinho em cada pingo do pináculo, que fica debaixo dela.
  S.push(solta(esticadaAte(furada(bola, pingosDoPinaculo), f(VEZ_DO_PINACULO) + 1, quartos), zTopo + (ALTURA_DO_PINACULO + 0.8) * e))
  L.push(P(bola, LATAO, { tabua: 0, bisel: f(RAIO_DA_BOLA) * 0.8, contorno: 0.3, metal: 0.55, projeta: { dist: 1.2, forca: 0.32 }, semente: 9799 }))
}
