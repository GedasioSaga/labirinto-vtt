/**
 * As versões do BARRIL (L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e
 * fazenda). A 1ª, FECHADO, é o desenho de hoje (`montarBarril`); aqui ficam as outras duas:
 *
 * - ABERTO COM ÁGUA: o mesmo barril de pé, sem as tábuas do tampo. Dentro do aro e do topo das aduelas aparece a
 *   parede de dentro, escura, e a água parada um dedo abaixo da borda: escura e fria, com o claro do céu que ela
 *   reflete e a sombra da borda do lado da luz; boiando, duas folhas secas. É o barril de chuva do quintal.
 * - TOMBADO: o barril deitado no chão, de comprido (o fundo para trás e a boca para a frente), sem berço; a boca
 *   perdeu uma tábua, e o que tinha dentro escorreu numa mancha molhada na terra, na frente dele. De cima aparece o
 *   dorso, com as aduelas ao comprido e os quatro aros atravessados; na 3/4, a boca de frente, com a falha da tábua.
 *
 * O barril aberto monta o de hoje e põe por cima, no pino do tampo (o mesmo de `barril.ts`), a parede de dentro e a
 * água: na 3/4 os dois sobem com o tampo. O tombado é uma pipa deitada (`pipaDeitada.ts`), como os barris deitados:
 * o corpo da 3/4 é desenhado à parte, já no lugar da tela, e guardado em fatias debaixo do dorso; girado na 3/4, de
 * costas é a mesma pipa e de lado é o bojo de lado (`bojoDeLado`), montados na tela e devolvidos ao objeto.
 *
 * A pegada e os lugares de material são os do barril: `madeira` (as aduelas, o tampo, a parede de dentro) e `aros`.
 * A água, as folhas e a mancha molhada são fixas.
 */
import { montarBarril } from '../barril'
import { caixa, dentroDe, elipse, elipseGirada, type Forma } from '../formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from '../motor'
import type { ContextoDoMovel, MontarMovel } from '../contexto'
import {
  bojoDeLado,
  desgirarCena,
  montarPipaDePe,
  noPino,
  pendurar,
  pinoNoLugar,
  pregar,
  quartosDoGiro,
  sombraNoAr,
  texDoBojoDeLado,
  type Aro,
  type PecaDoQuadro,
  type Pino,
  type Pipa,
} from '../pipaDeitada'
import type { VersoesDesenhadas } from '.'

// ---------- as medidas do barril (as de `barril.ts`) ----------

const ALTURA = 0.62
const PONTA = 0.84
const ADUELAS = 9
const ARO_DA_PONTA = 2.4
const ARO_DO_QUARTO = 2.1
const LUGAR_DO_ARO_DO_QUARTO = 0.22
const ARO_DO_TAMPO = 1
const TOPO_DAS_ADUELAS = 1.6

function arosDoBarril(H: number): Aro[] {
  const ponta = ARO_DA_PONTA / 2 / H
  return [
    { em: ponta, largura: ARO_DA_PONTA },
    { em: LUGAR_DO_ARO_DO_QUARTO, largura: ARO_DO_QUARTO },
    { em: 1 - LUGAR_DO_ARO_DO_QUARTO, largura: ARO_DO_QUARTO },
    { em: 1 - ponta, largura: ARO_DA_PONTA },
  ]
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta. */
function desgirado(dx: number, dy: number, quartos: number): [number, number] {
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

// ---------- aberto com água ----------

/** A água de chuva parada: escura e fria (verde-acinzentado, contido), e as folhas secas boiando. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x4b, 0x66, 0x6c] }
const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x86, 0x50] }
const FOLHA_VELHA: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x7a, 0x52] }
/** A parede de dentro que aparece entre o topo das aduelas e a água (px do protótipo), e o tom dela. */
const PAREDE_DE_DENTRO = 1.1
const TOM_DA_PAREDE_DE_DENTRO = 0.56

/**
 * A água: o claro do céu numa faixa larga e mole (do lado oposto ao da sombra da borda), uns anéis fracos de uma gota
 * e o ruído miúdo da superfície. `luz` = para onde fica o claro, já desgirado (o lado da tela).
 */
function texDaAgua(rx: number, ry: number, luz: readonly [number, number]): Textura {
  return (_u, _v, x, y, p, s) => {
    const u = x / rx
    const v = y / ry
    const ceu = Math.max(0, 1 - Math.abs(u * luz[1] - v * luz[0] + 0.05) * 2.2) * Math.max(0, 0.55 + 0.45 * (u * luz[0] + v * luz[1]))
    const gota = Math.hypot(x + rx * 0.3, y - ry * 0.2)
    const anel = Math.max(0, 1 - gota / (rx * 0.5)) * Math.sin(gota * 2.4) * 0.03
    s[3] += ceu * 0.16 + anel + ruido(x * 0.7 + p.semente, y * 0.7) * 0.04
  }
}

/** A folha seca deitada na água: o miolo claro ao comprido. */
function texDaFolhaSeca(cx: number, cy: number, a: number): Textura {
  const co = Math.cos(a)
  const si = Math.sin(a)
  return (_u, _v, x, y, p, s) => {
    const atraves = Math.abs(-(x - cx) * si + (y - cy) * co)
    s[3] += (atraves < 0.35 ? 0.1 : 0) + ruido(x * 0.9 + p.semente, y * 0.9) * 0.06
  }
}

const montarBarrilAberto: MontarMovel = (c, cena) => {
  montarBarril(c, cena)
  const P = c.peca
  const quartos = quartosDoGiro(c.giro)
  // O pino do tampo de `barril.ts`: no meio, na altura do barril (o centro gira em si mesmo).
  const pino: Pino = { x: 0, y: 0, z: c.g * ALTURA, ordem: (quartos % 2 === 1 ? c.hw : c.hh) - 1 }
  const R = Math.min(c.hw, c.hh)
  const fundo = ARO_DO_TAMPO + TOPO_DAS_ADUELAS
  const px = c.hw * PONTA - fundo + 0.3
  const py = c.hh * PONTA - fundo + 0.3
  // A parede de dentro: o fundo das aduelas, escuro, com a sombra da borda (cobre as tábuas e o batoque de hoje).
  cena.partes.push(P(noPino(elipse(0, 0, px, py), pino), c.m.madeira, { polar: { cx: 0, cy: 0, r: R }, tabua: (Math.PI * R) / ADUELAS, bisel: 0.3, tom: TOM_DA_PAREDE_DE_DENTRO, contorno: 0.22, recesso: { k: 2.4, forca: 0.42 }, semente: 21 }))
  // A água, um dedo abaixo da borda: a parede aparece numa tira, mais larga do lado da luz (a sombra da borda).
  const ax = px - PAREDE_DE_DENTRO
  const ay = py - PAREDE_DE_DENTRO
  const [ox, oy] = desgirado(0.35, 0.4, quartos)
  const claro = desgirado(0.6, 0.55, quartos)
  cena.partes.push(P(noPino(elipse(ox, oy, ax - 0.2, ay - 0.2), pino), AGUA, { bisel: 0.15, contorno: 0.2, recesso: { k: 1.6, forca: 0.36 }, textura: texDaAgua(ax, ay, claro), semente: 22 }))
  // As folhas secas, pequenas, uma inteira e uma meio afundada (mais escura).
  const folhas: readonly (readonly [number, number, number, number, MaterialDaPeca])[] = [
    [-ax * 0.3, -ay * 0.22, 2.3, 0.7, FOLHA_SECA],
    [ax * 0.32, ay * 0.3, 1.7, -0.9, FOLHA_VELHA],
  ]
  for (const [k, [fx, fy, r, a, mat]] of folhas.entries()) {
    const forma = elipseGirada(fx, fy, r, r * 0.46, a)
    cena.partes.push(P(noPino(forma, pino), mat, { bisel: 0.5, contorno: 0.24, tom: k === 0 ? 1 : 0.9, textura: texDaFolhaSeca(fx, fy, a), semente: 23 + k }))
  }
}

// ---------- tombado ----------

/** A mancha molhada na terra: escuro meio transparente e o brilho frio fraco de por cima. */
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [22, 18, 14] }
const BRILHO_DO_MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x7c, 0x80] }
/** O tampo da boca de frente: o aro da ponta, o topo das aduelas e as tábuas (px do protótipo e tons, os dos barris deitados). */
const ARO_DA_BOCA = 1.5
const TOM_DO_TOPO_DAS_ADUELAS = 0.84
const TOM_DO_TAMPO = 0.8
/** O buraco da tábua que caiu: o escuro de dentro do barril. */
const DENTRO_DO_BARRIL: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x2e, 0x26] }

/** A borda mole da mancha: a distância ganha um ruído largo. */
function borrada(f: Forma, amplitude: number, escala: number, semente: number): Forma {
  return {
    b: [f.b[0] - amplitude, f.b[1] - amplitude, f.b[2] + amplitude, f.b[3] + amplitude],
    d: (x, y) => f.d(x, y) - ruido(x * escala + semente, y * escala) * 2 * amplitude,
  }
}

/** A boca de frente, em volta de (cx, y) na tela: o aro, o topo das aduelas, as tábuas e a falha de uma tábua. */
function bocaDeFrente(pipa: Pipa, cx: number, y: number): PecaDoQuadro[] {
  const r = pipa.raioDaPonta
  const dentro = r - ARO_DA_BOCA
  const fundo = dentro - TOPO_DAS_ADUELAS
  const tabua = r * 0.55
  return [
    { forma: elipse(cx, y, r, r), mat: pipa.ferro, o: { bisel: 0.9, contorno: 0.3, semente: 31 } },
    { forma: elipse(cx, y, dentro, dentro), mat: pipa.madeira, o: { polar: { cx, cy: y, r }, tabua: (Math.PI * pipa.raio) / pipa.aduelas, bisel: 0.6, tom: TOM_DO_TOPO_DAS_ADUELAS, contorno: 0.2, semente: 32 } },
    { forma: elipse(cx, y, fundo, fundo), mat: pipa.madeira, o: { tabua, bisel: 0.5, recesso: { k: 1.6, forca: 0.3 }, tom: TOM_DO_TAMPO, contorno: 0.24, semente: 33 } },
    // A tábua que caiu: uma faixa da largura de uma tábua, de cima a baixo do tampo, aberta para o escuro de dentro.
    { forma: dentroDe(caixa(cx - tabua * 0.35, y - fundo, cx + tabua * 0.62, y + fundo, 0.3), elipse(cx, y, fundo - 0.3, fundo - 0.3)), mat: DENTRO_DO_BARRIL, o: { bisel: 0.4, contorno: 0.3, recesso: { k: 1.4, forca: 0.4 }, semente: 34 } },
  ]
}

/** O barril com o eixo de pé na tela (sem giro, e de costas: a pipa é a mesma dos dois lados). */
function tombadoDePe(c: ContextoDoMovel, cena: Cena, pipa: Pipa): void {
  const yN = -pipa.comprimento / 2
  const yS = yN + pipa.comprimento
  cena.sombras.push(contato(elipse(0, 0, pipa.raio * 0.62, pipa.comprimento * 0.48), 0.36))
  montarPipaDePe(c.peca, cena, pipa, 0, yN, bocaDeFrente(pipa, 0, yS - pipa.eixo), [])
}

/** O barril de lado na tela (o quarto de volta da 3/4): o bojo deitado, já no lugar, pendurado num pino. */
function tombadoDeLado(c: ContextoDoMovel, tela: Cena, pipa: Pipa): void {
  const { comprimento, raio, eixo } = pipa
  const xO = -comprimento / 2
  const yEixo = -eixo
  tela.sombras.push(
    sombraNoAr(caixa(xO, -raio * 0.7, xO + comprimento, raio * 0.7, raio * 0.4), eixo),
    { forma: caixa(xO + 1, -raio * 0.5, xO + comprimento - 1, raio * 0.6, raio * 0.3), z: 0, suave: 2.2, forca: 0.42 },
  )
  const pino = pinoNoLugar(0, -eixo, raio)
  pregar(tela, pino)
  pendurar(c.peca, tela.partes, { forma: bojoDeLado(pipa, xO, yEixo), mat: pipa.madeira, o: { bisel: 0.9, contorno: 0.26, textura: texDoBojoDeLado(pipa, xO, yEixo), semente: pipa.semente } }, pino)
}

/**
 * Deitado, o barril ocupa a pegada de ponta a ponta e fica mais comprido que largo (o comprimento é 2,5 raios). Com o
 * raio do barril de pé (a pegada inteira) e a altura dele de comprimento, de cima ele saía mais largo que comprido e
 * lia como um barril de pé visto de lado.
 */
const RAIOS_NO_COMPRIMENTO = 2.5

const montarBarrilTombado: MontarMovel = (c, cena) => {
  const quartos = quartosDoGiro(c.giro)
  const comprimento = 2 * (Math.min(c.hw, c.hh) - 0.6)
  const raio = comprimento / RAIOS_NO_COMPRIMENTO
  const pipa: Pipa = { comprimento, raio, raioDaPonta: raio * PONTA, eixo: raio, aduelas: ADUELAS, aros: arosDoBarril(comprimento), madeira: c.m.madeira, ferro: c.m.aros, semente: 0 }
  // A mancha molhada no chão, na frente da boca (no referencial do objeto: gira com ele), por baixo de tudo.
  const yS = comprimento / 2
  const mancha = borrada(elipse(1.5, yS + 1.2, raio * 0.66, Math.min(c.hh - yS + 2.2, raio * 0.42)), 1.3, 0.22, 7)
  cena.partes.push(c.peca(mancha, MOLHADO, { bisel: 2.2, contorno: 0, alfa: 0.36, semente: 41 }))
  cena.partes.push(c.peca(borrada(elipse(3.2, yS + 0.6, raio * 0.34, 2.2), 0.8, 0.3, 9), BRILHO_DO_MOLHADO, { bisel: 1.6, contorno: 0, alfa: 0.22, semente: 42 }))
  if (quartos === 0) {
    tombadoDePe(c, cena, pipa)
    return
  }
  const tela: Cena = { partes: [], sombras: [] }
  if (quartos === 2) tombadoDePe(c, tela, pipa)
  else tombadoDeLado(c, tela, pipa)
  desgirarCena(tela, quartos, cena)
}

export const versoesDoBarril: VersoesDesenhadas = {
  aberto: montarBarrilAberto,
  tombado: montarBarrilTombado,
}
