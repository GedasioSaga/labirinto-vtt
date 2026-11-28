/**
 * As VERSÕES do lustre de velas (L03 do plano de arte por tema, 28/11/2026): a 1ª, Aceso, é o desenho de `MONTADORES`
 * (`../lustreDeVelas.ts`).
 *
 * - APAGADO: o mesmo lustre pendurado, sem as chamas e sem os halos: as velas mostram o pavio queimado e a cera que
 *   escorreu. Sai do desenho de hoje com uma fábrica de peças que marca as peças das chamas e dos halos (as sementes
 *   de `SEMENTES_DO_FOGO`) e as tira da cena; o resto sai igual.
 * - CAÍDO NO CHÃO: a roda caiu e ficou no chão, um pouco torta, partida num ponto (o pedaço solto ao lado); metade
 *   das velas ainda de pé nos pratinhos, as outras rolaram (uma partida em duas), um pratinho virado no chão, as
 *   correntes frouxas até a argola e a corrente do teto estirada para fora, respingos de cera e lascas do reboco que
 *   caiu junto. A sombra é rente (nada fica no ar), e a 3/4 só levanta as velas de pé e a grossura da roda.
 *
 * As duas versões não iluminam: a luz do lustre é a linha do integrador, que deve desligar pela versão. Material:
 * `metal` (o de hoje); a cera, o pavio e o reboco são fixos.
 */
import { anel, capsula, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from '../formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from '../motor'
import { BURACO, materialDaPeca, type MontarMovel } from '../contexto'
import { ALTURA_DA_VELA_DO_LUSTRE, montarLustreDeVelas } from '../lustreDeVelas'
import type { VersoesDesenhadas } from '.'

/** As peças do fogo no desenho de hoje (`../lustreDeVelas.ts`): os halos (300 a 307) e as chamas (310 a 317). */
const SEMENTES_DO_FOGO = { de: 300, ate: 317 }

/** As medidas de cima do lustre de hoje, em fração do menor meio lado (as de `../lustreDeVelas.ts`). */
const RAIO_DA_RODA = 0.72
const MEIA_GROSSURA_DA_RODA = 0.055
const RAIO_DO_PRATO = 0.15
const RAIO_DA_VELA = 0.085
const RAIO_DA_ARGOLA = 0.15
const MEIA_GROSSURA_DA_ARGOLA = 0.045
const MEIA_GROSSURA_DA_CORRENTE = 0.035
const PONTA_DA_FOLHA = 0.98
const MEIA_FOLHA = 0.06
const RAIO_DA_BOLINHA = 0.045
const VELAS = 8
const PASSO_DO_ELO = 2.4
const FRESTA_DO_ELO = 0.3
const PASSO_DA_TORCAO = 2.6
/** A cera (a de hoje) e o pavio queimado. */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
const PAVIO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x40, 0x38] }
/** O reboco que caiu do teto junto com o gancho: o granito do Meio-Termo, claro. */
const REBOCO: MaterialDaPeca = { ...materialDaPeca('granito'), rgb: [0xb4, 0xab, 0x9c] }
/** A grossura da roda deitada no chão (px do protótipo): o que a 3/4 levanta dela. */
const GROSSURA_NO_CHAO = 1.6

function polar(cx: number, cy: number, raio: number, angulo: number): Ponto {
  return [cx + raio * Math.cos(angulo), cy + raio * Math.sin(angulo)]
}

function texTorcao(cx: number, cy: number, raio: number): Textura {
  const voltas = Math.max(1, Math.round((2 * Math.PI * raio) / PASSO_DA_TORCAO))
  return (_u, _v, x, y, _p, s) => {
    const f = (Math.atan2(y - cy, x - cx) * voltas) / (2 * Math.PI) + Math.hypot(x - cx, y - cy) / PASSO_DA_TORCAO
    s[3] += f - Math.floor(f) < 0.3 ? -0.16 : 0.05
  }
}

function texCorrente(ax: number, ay: number, ux: number, uy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = (x - ax) * ux + (y - ay) * uy
    const k = Math.floor(t / PASSO_DO_ELO)
    const f = t / PASSO_DO_ELO - k
    const atravessa = Math.abs((x - ax) * -uy + (y - ay) * ux)
    if (f < FRESTA_DO_ELO) s[3] -= 0.32
    else if (k % 2 === 1 && atravessa > 0.45) s[3] -= 0.22
    else s[3] += 0.06
  }
}

/** O lustre de hoje sem as chamas nem os halos, com o pavio queimado de pé em cada vela. */
const montarLustreApagado: MontarMovel = (c, cena) => {
  const doFogo = new Set<Peca>()
  const peca: CriarPeca = (forma, mat, o) => {
    const p = c.peca(forma, mat, o)
    const s = o?.semente ?? 0
    if (s >= SEMENTES_DO_FOGO.de && s <= SEMENTES_DO_FOGO.ate) doFogo.add(p)
    return p
  }
  montarLustreDeVelas({ ...c, peca }, cena)
  for (let i = cena.partes.length - 1; i >= 0; i -= 1) if (doFogo.has(cena.partes[i])) cena.partes.splice(i, 1)
  // O pavio queimado no meio de cada vela (por cima do buraco do pavio do desenho de hoje).
  const R = Math.min(c.hw, c.hh)
  for (let i = 0; i < VELAS; i += 1) {
    const [x, y] = polar(0, 0, RAIO_DA_RODA * R, -Math.PI / 2 + (i * 2 * Math.PI) / VELAS)
    cena.partes.push(c.peca(capsula(x, y, x + R * 0.012, y - R * 0.035, R * 0.014), PAVIO, { bisel: 0.3, contorno: 0.15, semente: 500 + i }))
  }
}

type EstadoDaVela = 'dePe' | 'caiu' | 'partida' | 'semPrato'
const ESTADOS: readonly EstadoDaVela[] = ['dePe', 'caiu', 'dePe', 'partida', 'dePe', 'semPrato', 'dePe', 'caiu']

const montarLustreCaido: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const metal = c.m.metal
  const L = cena.partes
  // A roda caiu um pouco fora do meio e torta (a elipse é a roda que pousou meio de lado).
  const [cx, cy] = [R * 0.05, R * 0.07]
  const rRoda = RAIO_DA_RODA * R
  const mg = MEIA_GROSSURA_DA_RODA * R
  const achatada = 0.93
  const angulos = Array.from({ length: VELAS }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / VELAS)
  const naRoda = (a: number, r = rRoda): Ponto => [cx + r * Math.cos(a), cy + r * Math.sin(a) * achatada]

  // A quebra da roda: a cunha entre a 5ª e a 6ª vela; o pedaço que saiu fica no chão, um pouco para fora.
  const aQuebra = (angulos[4] + angulos[5]) / 2
  const cunha = (a0: number, a1: number): Forma => poligono([[cx, cy], polar(cx, cy, R * 1.4, a0), polar(cx, cy, R * 1.4, (a0 + a1) / 2), polar(cx, cy, R * 1.4, a1)])
  const roda = anel(cx, cy, rRoda + mg, (rRoda + mg) * achatada, rRoda - mg, (rRoda - mg) * achatada)
  const vao = cunha(aQuebra - 0.2, aQuebra + 0.06)
  const formaDaRoda = menos(roda, vao)
  const [px, py] = [Math.cos(aQuebra - 0.05) * R * 0.1, Math.sin(aQuebra - 0.05) * R * 0.1]
  const pedaco = menos(anel(cx + px, cy + py, rRoda + mg, (rRoda + mg) * achatada, rRoda - mg, (rRoda - mg) * achatada), menos(roda, cunha(aQuebra - 0.17, aQuebra - 0.02)))

  // A sombra rente: o contato da roda, do pedaço e das velas caídas; a grossura da roda e as velas de pé sobem na 3/4.
  cena.sombras.push(contato(roda, 0.34), contato(pedaco, 0.3), { forma: formaDaRoda, z: GROSSURA_NO_CHAO, forca: 0.2 })

  // As lascas do reboco que caiu junto, os respingos de cera e a corrente do teto, estirada até fora da roda.
  const lascas: readonly (readonly [number, number, number, number])[] = [[-0.62, -0.7, 0.07, 0.3], [-0.78, -0.5, 0.05, 1.2], [0.7, -0.76, 0.06, 2], [0.86, 0.58, 0.05, 0.6], [-0.2, 0.9, 0.045, 1.6], [0.42, -0.9, 0.04, 2.6]]
  for (const [i, [fx, fy, fr, giro]] of lascas.entries()) {
    const [x, y] = [fx * R, fy * R]
    const forma = poligono([0, 1, 2, 3, 4].map((k): Ponto => polar(x, y, fr * R * (0.7 + 0.3 * ((k * 7 + i) % 3) / 2), giro + (k * 2 * Math.PI) / 5)))
    cena.sombras.push(contato(forma, 0.28))
    L.push(P(forma, REBOCO, { bisel: 0.6, contorno: 0.3, tom: 0.92 + 0.04 * (i % 3), semente: 600 + i }))
  }
  const respingos: readonly (readonly [number, number, number, number])[] = [[-0.5, 0.55, 0.06, 0.04], [0.62, 0.3, 0.05, 0.035], [0.15, -0.55, 0.045, 0.03]]
  for (const [i, [fx, fy, rx, ry]] of respingos.entries()) L.push(P(elipse(fx * R, fy * R, rx * R, ry * R), CERA, { bisel: 0.3, tom: 0.94, contorno: 0.16, semente: 610 + i }))

  // A ARGOLA puxada para o lado e as CORRENTES frouxas da roda até ela; a do teto sai da argola para fora.
  const [ax, ay] = [cx - R * 0.14, cy - R * 0.12]
  const elo = MEIA_GROSSURA_DA_CORRENTE * R
  const trecho = (de: Ponto, para: Ponto, semente: number): void => {
    const comp = Math.max(0.01, Math.hypot(para[0] - de[0], para[1] - de[1]))
    const [ux, uy] = [(para[0] - de[0]) / comp, (para[1] - de[1]) / comp]
    cena.sombras.push(contato(capsula(de[0], de[1], para[0], para[1], elo), 0.22))
    L.push(P(capsula(de[0], de[1], para[0], para[1], elo), metal, { eixo: Math.atan2(uy, ux), bisel: elo * 0.8, contorno: 0.28, textura: texCorrente(de[0], de[1], ux, uy), semente }))
  }
  const doTeto: readonly Ponto[] = [[ax, ay], [-R * 0.42, -R * 0.36], [-R * 0.5, -R * 0.62], [-R * 0.78, -R * 0.74], [-R * 0.96, -R * 0.98]]
  for (let i = 1; i < doTeto.length; i += 1) trecho(doTeto[i - 1], doTeto[i], 620 + i)
  for (let k = 0; k < 4; k += 1) {
    const a = -Math.PI / 2 + Math.PI / VELAS + (k * 2 * Math.PI) / 4
    const presa = naRoda(a)
    const meio: Ponto = [(presa[0] + ax) / 2 + Math.cos(a + 1.2) * R * 0.1, (presa[1] + ay) / 2 + Math.sin(a + 1.2) * R * 0.1]
    trecho(presa, meio, 630 + k * 2)
    trecho(meio, [ax, ay], 631 + k * 2)
  }
  const mgA = MEIA_GROSSURA_DA_ARGOLA * R
  const rA = RAIO_DA_ARGOLA * R
  L.push(P(anel(ax, ay, rA + mgA, rA + mgA, rA - mgA, rA - mgA), metal, { bisel: mgA * 0.9, contorno: 0.3, metal: 0.55, semente: 640 }))

  // As FOLHAS de ferro entre as velas (a do lado da quebra torta), a RODA partida e o pedaço solto.
  for (const [i, a] of angulos.entries()) {
    const m = a + Math.PI / VELAS + (i === 4 ? 0.25 : 0)
    const comprida = (PONTA_DA_FOLHA * R - rRoda) / 2
    const [mx, my] = naRoda(m, rRoda + comprida * 0.8)
    const [tx, ty] = naRoda(m, PONTA_DA_FOLHA * R - RAIO_DA_BOLINHA * R)
    L.push(P(elipseGirada(mx, my, comprida, MEIA_FOLHA * R, m), metal, { eixo: m, bisel: MEIA_FOLHA * R * 0.8, tom: 0.92, contorno: 0.28, semente: 650 + i }))
    L.push(P(elipse(tx, ty, RAIO_DA_BOLINHA * R, RAIO_DA_BOLINHA * R), metal, { bisel: RAIO_DA_BOLINHA * R * 0.8, contorno: 0.26, metal: 0.55, semente: 660 + i }))
  }
  L.push(P(formaDaRoda, metal, { bisel: mg * 0.9, contorno: 0.3, textura: texTorcao(cx, cy, rRoda), semente: 670, projeta: { dist: 0.9, forca: 0.3 } }))
  L.push(P(pedaco, metal, { bisel: mg * 0.9, contorno: 0.3, tom: 0.94, textura: texTorcao(cx + px, cy + py, rRoda), semente: 671, projeta: { dist: 0.8, forca: 0.3 } }))

  // Os PRATINHOS, as VELAS de pé e as que caíram: rolaram para fora, uma partida em duas, um pratinho virado.
  const rPrato = RAIO_DO_PRATO * R
  const rVela = RAIO_DA_VELA * R
  const velaDeitada = (x0: number, y0: number, a: number, comp: number, semente: number, toco = false): void => {
    const [x1, y1] = [x0 + Math.cos(a) * comp, y0 + Math.sin(a) * comp]
    const forma = capsula(x0, y0, x1, y1, rVela * 0.92)
    cena.sombras.push(contato(forma, 0.3), { forma, z: rVela * 1.6, forca: 0.18 })
    L.push(P(forma, CERA, { eixo: a, bisel: rVela * 0.8, contorno: 0.24, semente }))
    if (!toco) L.push(P(capsula(x1, y1, x1 + Math.cos(a) * rVela * 0.5, y1 + Math.sin(a) * rVela * 0.5, rVela * 0.18), PAVIO, { bisel: 0.3, contorno: 0.12, semente: semente + 1 }))
  }
  for (const [i, a] of angulos.entries()) {
    const [x, y] = naRoda(a)
    const estado = ESTADOS[i]
    if (estado !== 'semPrato') {
      L.push(P(elipse(x, y, rPrato, rPrato * achatada), metal, { bisel: rPrato * 0.35, contorno: 0.28, semente: 680 + i, projeta: { dist: 1, forca: 0.3 } }))
      L.push(P(elipse(x, y, rPrato * 0.72, rPrato * 0.72 * achatada), metal, { bisel: 0, tom: 0.78, contorno: 0.1, recesso: { k: 0.9, forca: 0.3 }, semente: 690 + i }))
    } else {
      // O pratinho que se soltou, de boca para baixo no chão, mais para fora.
      const [vx, vy] = naRoda(a + 0.1, rRoda + R * 0.2)
      cena.sombras.push(contato(elipse(vx, vy, rPrato, rPrato * 0.9), 0.3))
      L.push(P(elipse(vx, vy, rPrato, rPrato * 0.9), metal, { bisel: rPrato * 0.6, contorno: 0.28, tom: 0.9, semente: 700 }))
    }
    const fora = a + Math.PI * 0.1
    if (estado === 'dePe') {
      const alto = elipse(x, y, rVela, rVela)
      cena.sombras.push({ forma: alto, z: GROSSURA_NO_CHAO + ALTURA_DA_VELA_DO_LUSTRE, forca: 0.24 })
      L.push(P(alto, CERA, { bisel: rVela * 0.4, contorno: 0.22, semente: 710 + i }))
      L.push(P(elipse(x, y, rVela * 0.56, rVela * 0.56), CERA, { bisel: 0, tom: 0.92, contorno: 0, recesso: { k: 0.5, forca: 0.2 }, semente: 720 + i }))
      L.push(P(elipse(x, y, rVela * 0.2, rVela * 0.2), PAVIO, { bisel: 0, contorno: 0, semente: 730 + i }))
    } else if (estado === 'partida') {
      const [x0, y0] = naRoda(a, rRoda + R * 0.12)
      velaDeitada(x0, y0, fora, R * 0.13, 740 + i, true)
      velaDeitada(x0 + Math.cos(fora) * R * 0.2 + R * 0.04, y0 + Math.sin(fora) * R * 0.2, fora + 0.5, R * 0.1, 750 + i)
    } else {
      const longe = estado === 'caiu' && i === 7 ? R * 0.3 : R * 0.16
      const [x0, y0] = naRoda(a, rRoda + longe)
      velaDeitada(x0, y0, fora + (i % 2 === 0 ? 0.6 : -0.7), R * 0.24, 760 + i)
    }
  }
  L.push(P(elipse(ax, ay, mgA * 1.3, mgA * 1.3), BURACO, { bisel: 0, contorno: 0, semente: 641 }))
}

export const versoesDoLustreDeVelas: VersoesDesenhadas = {
  apagado: montarLustreApagado,
  caido: montarLustreCaido,
}
