/**
 * LANTERNA DE PEDRA JAPONESA de cima com volume (lote L08 dos objetos de 14/11/2026, grupo Mar e piratas; pedido
 * do mestre: "lanterna de pedra japonesa"). A lanterna de jardim de templo, de seis lados, de baixo para cima: a
 * BASE sextavada, o POSTE redondo, a MESA do meio, a CASA DO FOGO com a janela, o TELHADO largo de seis águas com
 * as quinas viradas em CARACOL, e no alto o COLAR de pétalas com a JOIA em ponta.
 *
 * De cima só aparece o telhado: as seis águas, cada uma com a luz dela (a do alto à esquerda clara, a do sul à
 * direita escura), as seis arestas claras do meio às quinas, a aba da beira, os caracóis das quinas, o musgo
 * velho nas águas e, no meio, o colar com a joia. A sombra comprida do poste e a do telhado, solta, dizem a altura.
 * A 25% de zoom sobra o sextavado de pedra com a estrela das arestas e o botão no meio.
 *
 * Na 3/4 (derivado) o telhado é um tampo solto alto, com a beirada da grossura dele (`ESPESSURA_DO_TELHADO_DA_
 * LANTERNA`, que o perfil da 3/4 usa), o poste é uma coluna do chão até a joia (o pedaço que passa do telhado fica
 * debaixo dele) e a base, uma coluna baixa. O que fica debaixo do telhado (o topo da base, o poste, a mesa do meio
 * e a casa do fogo com a janela) e a joia de pé são desenhados de frente, NA TELA, só para a 3/4: entram no
 * telhado (o meio da caixa deles cai num ponto dele, `ANCORA`, e eles nascem descidos a altura dele) e a textura
 * os esconde na vista de cima. Girado na 3/4 (`c.giro`), a cena é montada na tela e devolvida ao objeto
 * (`desgirarCena`): a lanterna é a mesma de qualquer lado. A lanterna não acende (não é das que iluminam).
 * Escreve `cena.corDoPiso` (um escuro cinza de pedra: com a nogueira, a janela e a beira do poste ficavam ruivas).
 *
 * O telhado enche a pegada (0,9 x 0,9 casa de partida); os raios saem do menor lado. Material: `pedra` (o
 * granito de partida). O musgo é fixo.
 */
import type { Rgb } from '../../ruido'
import { cadeia, capsula, caixa, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { desgirarCena, quartosDoGiro } from './pipaDeitada'

/** As alturas, em casas: o topo da base, o do poste, o da mesa do meio, o do telhado e o da joia. */
const Z_BASE = 0.1
const Z_POSTE = 0.5
const Z_MESA = 0.57
const Z_TELHADO = 1
const Z_JOIA = 1.18
/** A grossura do telhado (px do protótipo): a beirada dele na 3/4. O perfil da lanterna em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DO_TELHADO_DA_LANTERNA = 0.11 * G

/** O raio do telhado (de quina), em fração do menor meio lado, e os outros raios, em fração do raio do telhado. */
const TELHADO = 0.97
const BASE = 0.72
const POSTE = 0.2
const MESA = 0.62
const CASA_DO_FOGO = 0.5
const COLAR = 0.26
const JOIA = 0.16
/** O peitoril da janela, em fração da altura da casa do fogo (o resto da janela some debaixo do telhado). */
const ALTURA_DO_PEITORIL = 0.18
/** A aba da beira do telhado, as arestas (de onde a onde, e a grossura) e o caracol da quina, em fração do raio. */
const ABA = 0.88
const ARESTA_DE = 0.28
const ARESTA_ATE = 0.92
const GROSSURA_DA_ARESTA = 0.05
const CARACOL = 0.085

/** Onde vem a luz, no chão (do alto à esquerda), e quanto a água virada para ela clareia. */
const LUZ_X = -0.78
const LUZ_Y = -0.62
const LUZ_DA_AGUA = 0.2
/** A luz de cada face de pé de um prisma na 3/4: a da esquerda pega a luz, a da direita fica na sombra. */
const TOM_DA_ESQUERDA = 0.92
const TOM_DA_FRENTE = 0.8
const TOM_DA_DIREITA = 0.64

/** As manchas de musgo no telhado: o meio (fração do raio), os raios e o ângulo. */
const MUSGOS: readonly (readonly [number, number, number, number, number])[] = [
  [-0.5, 0.36, 0.2, 0.09, 0.5],
  [0.36, -0.52, 0.16, 0.08, -0.9],
  [0.66, 0.3, 0.13, 0.07, 1.2],
  [-0.62, -0.18, 0.1, 0.06, -0.3],
]

const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x7c, 0x4a] }
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x38, 0x36] }
/**
 * O escuro em que o pixel escuro demais é levantado: cinza-pardo de pedra (luminância linear ~0,057). Com o de
 * sempre (a nogueira) a janela e a beira do poste, na sombra, saíam avermelhadas.
 */
const ESCURO_DA_PEDRA: Rgb = [0x48, 0x45, 0x42]

/** O musgo: a cobertura falhada, mais cheia no miolo. */
const texDoMusgo: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 1.1 + p.su, y * 1.1) * 0.12
  s[5] *= 0.55 + ruido(x * 0.5 + p.sv, y * 0.5 + p.su) * 0.9
}

/** O vértice `i` do sextavado de raio `r` em volta de (cx, cy): as quinas em 0°, 60°... (o lado de baixo é reto). */
function quina(cx: number, cy: number, r: number, i: number): Ponto {
  const a = (i * Math.PI) / 3
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function sextavado(cx: number, cy: number, r: number): Forma {
  return poligono([0, 1, 2, 3, 4, 5].map((i) => quina(cx, cy, r, i)))
}

/** O ponto `p` subido `z` na tela. */
function subido([x, y]: Ponto, z: number): Ponto {
  return [x, y - z]
}

/** As três faces de pé de um prisma sextavado de raio `r` que a 3/4 mostra, entre as alturas `z0` e `z1` (px). */
function facesDoPrisma(r: number, z0: number, z1: number): readonly [Forma, number][] {
  const face = (i: number, j: number): Forma => {
    const a = quina(0, 0, r, i)
    const b = quina(0, 0, r, j)
    return poligono([subido(a, z1), subido(b, z1), subido(b, z0), subido(a, z0)])
  }
  return [[face(0, 1), TOM_DA_DIREITA], [face(1, 2), TOM_DA_FRENTE], [face(2, 3), TOM_DA_ESQUERDA]]
}

/** A textura só da 3/4: esconde a peça na vista de cima, onde ela ainda está descida a altura do telhado. */
function soNaTresQuartos(textura: Textura | null, girada: boolean): Textura {
  return (u, v, x, y, p, s, escala) => {
    // Girada, a cena só existe para a 3/4 (de cima o giro é sempre 0); sem giro, a peça já subiu se não tem mais desvio.
    if (!girada && p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** O contrário: a peça de cima que a 3/4 não mostra (na 3/4 ela subiu, e tem desvio; girada, é sempre 3/4). */
function soDeCima(textura: Textura | null, girada: boolean): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (girada || p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

export const montarLanternaDePedra: MontarMovel = (c, cena) => {
  const P = c.peca
  const quartos = quartosDoGiro(c.giro)
  const tela: Cena = { partes: [], sombras: [] }
  const L = tela.partes
  const pedra = c.m.pedra
  const daPedra = texturaDaClasse('pedra')
  const R = TELHADO * Math.min(c.hw, c.hh)
  const zb = Z_BASE * c.g
  const zp = Z_POSTE * c.g
  const zm = Z_MESA * c.g
  const zt = Z_TELHADO * c.g
  const zj = Z_JOIA * c.g
  const e = ESPESSURA_DO_TELHADO_DA_LANTERNA
  const rp = POSTE * R

  // As estruturas: a base (coluna baixa), o poste (coluna até a joia) e o telhado (tampo solto).
  const base = sextavado(0, 0, BASE * R)
  const telhado = sextavado(0, 0, R)
  tela.sombras.push({ forma: base, z: zb, forca: 0.28 }, contato(base, 0.3))
  tela.sombras.push({ forma: elipse(0, 0, rp, rp), z: zj, forca: 0.3 })
  tela.sombras.push({ forma: telhado, z: zt, solta: true, forca: 0.3 })

  // O que só a 3/4 mostra entra no telhado: o meio da caixa cai na âncora (dentro do telhado, fora do poste) depois
  // da subida, e a peça nasce descida a altura dele. Embaixo, nada passa por cima da beirada do telhado.
  const ancora: Ponto = [0, 0.6 * R]
  const yDaBeirada0 = -(zt - e)
  const yDaBeirada1 = 0.866 * R - (zt - e)
  const debaixoDoTelhado = poligono([[-R - 2, yDaBeirada0], [-0.5 * R, yDaBeirada1], [0.5 * R, yDaBeirada1], [R + 2, yDaBeirada0], [R + 2, R], [-R - 2, R]])
  const naTela = (f: Forma, cortar = true): Forma => {
    const g = cortar ? dentroDe(f, debaixoDoTelhado) : f
    const mx = Math.max(Math.abs(g.b[0] - ancora[0]), Math.abs(g.b[2] - ancora[0]))
    const yAncora = ancora[1] - zt
    const my = Math.max(Math.abs(g.b[1] - yAncora), Math.abs(g.b[3] - yAncora))
    return { b: [ancora[0] - mx, yAncora - my, ancora[0] + mx, yAncora + my], d: g.d }
  }
  const girada = quartos !== 0
  const daTela = (o: OpcoesDaPeca, textura: Textura | null = daPedra): OpcoesDaPeca => ({ ...o, dy: zt, textura: soNaTresQuartos(textura, girada) })

  // O topo da base, o poste com a sombra da mesa nele, a mesa do meio e a casa do fogo com a janela.
  L.push(P(naTela(sextavado(0, -zb, BASE * R)), pedra, daTela({ bisel: 1.2, contorno: 0.28, tom: 1.02, semente: 8801 })))
  L.push(P(naTela(uniao(caixa(-rp, -zp, rp, -zb), elipse(0, -zb, rp, rp * 0.62))), pedra, daTela({ bisel: rp * 0.8, contorno: 0.28, tom: 0.86, semente: 8802 })))
  L.push(P(naTela(caixa(-rp, -zp, rp, -zp + 3, 1)), ESCURO, daTela({ bisel: 0, contorno: 0, alfa: 0.32, suave: 1.2 }, null)))
  L.push(P(naTela(sextavado(0, -zm, MESA * R)), pedra, daTela({ bisel: 1, contorno: 0.28, tom: 1.04, semente: 8803 })))
  facesDoPrisma(MESA * R, zp, zm).forEach(([f, tom], i) => L.push(P(naTela(f), pedra, daTela({ bisel: 0.6, contorno: 0.28, tom, semente: 8804 + i }))))
  const rf = CASA_DO_FOGO * R
  const faces = facesDoPrisma(rf, zm, zt - e)
  faces.forEach(([f, tom], i) => L.push(P(naTela(f), pedra, daTela({ bisel: 0.6, contorno: 0.28, tom, semente: 8808 + i }))))
  // A janela da frente: o vão escuro, que sobe até debaixo do telhado, e o peitoril claro embaixo dele.
  const yFrente = 0.866 * rf
  const peitoril = yFrente - zm - (zt - e - zm) * ALTURA_DO_PEITORIL
  L.push(P(naTela(caixa(-0.3 * rf, yFrente - (zt - e), 0.3 * rf, peitoril, 0.4)), ESCURO, daTela({ bisel: 0.4, contorno: 0.2, recesso: { k: 1.4, forca: 0.4 }, semente: 8812 }, null)))
  L.push(P(naTela(caixa(-0.36 * rf, peitoril - 0.4, 0.36 * rf, peitoril + 1, 0.3)), pedra, daTela({ bisel: 0.4, contorno: 0.24, tom: 1.08, semente: 8813 })))
  // A sombra do telhado na casa do fogo: a faixa escura logo debaixo da beirada.
  const sombraDoTelhado = dentroDe(caixa(-rf - 1, yDaBeirada1 - 1, rf + 1, yDaBeirada1 + 3.4), uniao(uniao(faces[0][0], faces[1][0]), faces[2][0]))
  L.push(P(naTela(sombraDoTelhado), ESCURO, daTela({ bisel: 0, contorno: 0, alfa: 0.36, suave: 1.2 }, null)))

  // O TELHADO, visto de cima: as seis águas, cada uma com a luz dela, a aba da beira, as arestas e os caracóis.
  for (let i = 0; i < 6; i += 1) {
    const a = ((i + 0.5) * Math.PI) / 3
    const tom = 1 + LUZ_DA_AGUA * (Math.cos(a) * LUZ_X + Math.sin(a) * LUZ_Y)
    const agua = poligono([[0, 0], quina(0, 0, R, i), quina(0, 0, R, i + 1)])
    L.push(P(agua, pedra, { bisel: 0.7, contorno: 0.26, tom, semente: 8820 + i }))
    const aba = poligono([quina(0, 0, R, i), quina(0, 0, R, i + 1), quina(0, 0, ABA * R, i + 1), quina(0, 0, ABA * R, i)])
    L.push(P(aba, pedra, { bisel: 0.8, contorno: 0.2, tom: tom * 0.92, semente: 8826 + i }))
  }
  MUSGOS.forEach(([x, y, rx, ry, ang], i) => {
    L.push(P(elipseGirada(x * R, y * R, rx * R, ry * R, ang), MUSGO, { bisel: 0, contorno: 0, alfa: 0.8, suave: 0.06 * R, textura: texDoMusgo, semente: 8840 + i }))
  })
  for (let i = 0; i < 6; i += 1) {
    const [ax, ay] = quina(0, 0, ARESTA_DE * R, i)
    const [bx, by] = quina(0, 0, ARESTA_ATE * R, i)
    L.push(P(capsula(ax, ay, bx, by, GROSSURA_DA_ARESTA * R), pedra, { bisel: GROSSURA_DA_ARESTA * R, contorno: 0.24, tom: 1.14, semente: 8850 + i }))
    // O caracol da quina: a ponta da aba que sobe e enrola para fora, em gota ao longo da aresta, com a volta
    // marcada. Tudo com o meio dentro do telhado, para subir com ele na 3/4.
    const a = (i * Math.PI) / 3
    const [qx, qy] = quina(0, 0, R * (1 - CARACOL), i)
    L.push(P(elipseGirada(qx, qy, CARACOL * 1.5 * R, CARACOL * 0.8 * R, a), pedra, { bisel: CARACOL * 0.6 * R, contorno: 0.28, tom: 1.1, projeta: { dist: 0.8, forca: 0.3 }, semente: 8856 + i }))
    const volta: Ponto[] = [0, 1, 2, 3, 4].map((j) => {
      const t = a + Math.PI * 0.3 + j * 0.9
      const r = CARACOL * R * (0.6 - j * 0.1)
      return [qx + Math.cos(a) * CARACOL * 0.35 * R + r * Math.cos(t), qy + Math.sin(a) * CARACOL * 0.35 * R + r * Math.sin(t)]
    })
    L.push(P(cadeia(volta, 0.018 * R), ESCURO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 8862 + i }))
  }
  // O colar de pétalas e a joia no meio, só de cima (na 3/4 a joia é a de pé, desenhada na tela).
  const colar = COLAR * R
  const deCima = soDeCima(daPedra, girada)
  L.push(P(sextavado(0, 0, colar), pedra, { bisel: 1, contorno: 0.28, tom: 1.04, textura: deCima, projeta: { dist: 1.4, forca: 0.32 }, semente: 8870 }))
  for (let i = 0; i < 6; i += 1) {
    const [px, py] = quina(0, 0, colar * 0.86, i + 0.5)
    L.push(P(elipse(px, py, colar * 0.36, colar * 0.36), pedra, { bisel: colar * 0.24, contorno: 0.22, tom: 1.08, textura: deCima, semente: 8871 + i }))
  }
  const joia = JOIA * R
  L.push(P(elipse(0, 0, joia, joia), pedra, { bisel: joia * 0.8, contorno: 0.3, tom: 1.16, textura: deCima, projeta: { dist: 1.2, forca: 0.34 }, semente: 8878 }))

  // A joia de pé, na 3/4: o colar em leque sentado no telhado e a joia em gota por cima.
  const yColar = -zt + 1
  const altoDoColar = (zj - zt) * 0.38
  L.push(P(naTela(poligono([[-colar * 0.95, yColar], [colar * 0.95, yColar], [colar * 0.7, yColar - altoDoColar], [-colar * 0.7, yColar - altoDoColar]]), false), pedra, daTela({ bisel: 0.6, contorno: 0.28, tom: 0.9, semente: 8880 })))
  const yJoia = yColar - altoDoColar - joia * 0.8
  L.push(P(naTela(uniao(elipse(0, yJoia, joia, joia * 0.92), poligono([[-joia * 0.55, yJoia - joia * 0.6], [0, -zj], [joia * 0.55, yJoia - joia * 0.6]])), false), pedra, daTela({ bisel: joia * 0.7, contorno: 0.3, tom: 1.06, semente: 8881 })))

  tela.corDoPiso = ESCURO_DA_PEDRA
  if (girada) desgirarCena(tela, quartos, cena)
  else {
    cena.partes.push(...tela.partes)
    cena.sombras.push(...tela.sombras)
    cena.corDoPiso = tela.corDoPiso
  }
}
