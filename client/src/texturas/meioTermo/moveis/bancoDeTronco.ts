/**
 * BANCO DE TRONCO (L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e
 * fazenda): o banco rústico do quintal, da beira do fogo e da porta do celeiro. Duas versões:
 *
 * - TRONCO (a 1ª): meia tora deitada no chão, com o corte para cima. De cima aparece o ASSENTO lavrado (a madeira
 *   clara, os anéis do crescimento cortados ao comprido em faixas tortas, duas rachaduras saindo das pontas e um
 *   nó) e, dos dois lados, a CASCA da tora descendo para o chão.
 * - TÁBUA SOBRE TOCOS: uma tábua larga, de duas peças, deitada em dois tocos de árvore. Os tocos são mais largos que
 *   a tábua: de cada lado dela sobra a casca e um nada do corte com os anéis.
 *
 * A meia tora e os tocos são colunas na 3/4 (perfil derivado): a frente varrida é a casca. A tábua é um tampo solto
 * em cima dos tocos, pintado depois deles (a caixa da estrutura dela desce além da base dos tocos); as peças de cada
 * toco têm o meio da caixa na beira de baixo dele, fora da tábua, e sobem com o toco.
 *
 * Materiais: `lenha` (a casca da tora e dos tocos: a lenha da fogueira, carvalho, pinho ou bétula) e `madeira` (o
 * assento lavrado, o corte dos tocos e a tábua). Pegada: 1,5 x 0,5 casa.
 */
import { comMeioEm, crescida } from './andaimeDaTresQuartos'
import { caixa, capsula, elipse, uniao } from './formas'
import { contato, ruido, type Textura } from './motor'
import { BURACO, type MontarMovel } from './contexto'

/** A altura do assento da meia tora e a do tampo da tábua sobre os tocos (casas). */
const ALTURA_DO_TRONCO = 0.34
const ALTURA_DOS_TOCOS = 0.3
const ALTURA_DA_TABUA = 0.37
/** A meia largura do assento, em fração do raio da tora (o corte passa acima do eixo: a casca aparece dos lados). */
const ASSENTO = 0.8
/** A meia largura da tábua (casas) e o raio dos tocos (fração da meia altura da pegada). */
const MEIA_TABUA = 0.18
const TOCO = 0.92
/** O quanto a caixa da tábua passa da base dos tocos (px): a fila da 3/4 a pinta depois deles. */
const ORDEM_DA_TABUA = 0.3

/**
 * O assento lavrado: os anéis da tora cortados ao comprido viram faixas largas e tortas (nunca listra fina), o veio
 * miúdo ao longo e as manchas do machado.
 */
function texDoAssento(semente: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const anel = Math.sin((Math.abs(y + 1.5) + ruido(x * 0.05 + semente, y * 0.04) * 4 + x * 0.015) * 1.05)
    s[3] += anel * 0.04 + ruido(x * 0.1 + p.semente, y * 0.85) * 0.06 + ruido(x * 0.35, y * 0.35 + semente) * 0.04
  }
}

/** O corte do toco: anéis em volta do miolo (um nada fora do meio) e uma rachadura do miolo para a beira. */
function texDoCorte(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx - 0.8, y - cy + 0.5) + ruido(x * 0.25 + p.semente, y * 0.25) * 1.4
    s[3] += Math.sin(longe * 2.4) * 0.05 + ruido(x * 0.6, y * 0.6) * 0.04
  }
}

/** A meia tora deitada, com o corte para cima. */
export const montarBancoDeTronco: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const r = hh - 0.8
  const x0 = -hw + 2.2
  const x1 = hw - 2.2
  const ponta = 2.6
  const tora = uniao(caixa(x0, -r, x1, r, 2), uniao(elipse(x0, 0, ponta, r * 0.96), elipse(x1, 0, ponta, r * 0.96)))
  cena.sombras.push({ forma: tora, z: g * ALTURA_DO_TRONCO }, contato(tora, 0.34))
  // A casca: a tora inteira por baixo (de cima só os dois lados dela aparecem, descendo para o chão).
  cena.partes.push(P(tora, c.m.lenha, { eixo: 0, bisel: r * 0.55, tom: 0.9, contorno: 0.26, semente: 10 }))
  // O assento lavrado, com a beira um nada gasta (o canto quebrado do machado).
  const f = r * ASSENTO
  const assento = caixa(x0 + 1.2, -f, x1 - 1.2, f, 2.2)
  cena.partes.push(P(assento, c.m.madeira, { eixo: 0, tabua: 0, bisel: 1.2, tom: 1.02, contorno: 0.22, textura: texDoAssento(3), semente: 11 }))
  // As rachaduras que saem das pontas e o nó (escuros, finos, meio transparentes).
  const rachas: readonly (readonly [number, number, number, number, number])[] = [
    [x0 + 1.6, -2.4, x0 + 17, -1.4, 0.42],
    [x1 - 1.6, 3.2, x1 - 11, 2.5, 0.36],
    [x1 - 1.6, -5.2, x1 - 6.5, -5.6, 0.3],
  ]
  for (const [k, [ax, ay, bx, by, raio]] of rachas.entries()) {
    cena.partes.push(P(capsula(ax, ay, bx, by, raio), BURACO, { bisel: 0.3, contorno: 0, alfa: 0.62, semente: 12 + k }))
  }
  cena.partes.push(P(elipse(x0 + (x1 - x0) * 0.62, 4.6, 2.2, 1.5), c.m.madeira, { tabua: 0, bisel: 1, tom: 0.6, contorno: 0.3, textura: texDoCorte(x0 + (x1 - x0) * 0.62, 4.6), semente: 16 }))
}

/** A tábua larga deitada sobre dois tocos. */
export const montarBancoDeTroncoTabuaSobreTocos: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const rt = hh * TOCO
  const xs = [-hw + rt + 1.2, hw - rt - 1.2]
  const meia = g * MEIA_TABUA
  const tabua = caixa(-hw + 0.8, -meia, hw - 0.8, meia, 1.3)
  const tocos = xs.map((x) => elipse(x, 0, rt, rt * 0.97))
  for (const toco of tocos) cena.sombras.push({ forma: toco, z: g * ALTURA_DOS_TOCOS }, contato(toco, 0.34))
  // A tábua vem depois dos tocos na fila da 3/4 (a caixa dela desce além da base deles): ela se deita POR CIMA do
  // corte dos tocos, e não o corte por cima dela.
  const baseDosTocos = Math.max(...tocos.map((t) => t.b[3]))
  cena.sombras.push({ forma: crescida(tabua, Math.max(0, baseDosTocos - tabua.b[3]) + ORDEM_DA_TABUA), z: g * ALTURA_DA_TABUA, solta: true, forca: 0.3 })
  // Os tocos: a casca em volta e o corte com os anéis (só a beira dele aparece dos lados da tábua). O meio da caixa
  // das duas peças vai para a beira de baixo do toco, fora da tábua: a 3/4 as sobe com o toco, não com a tábua.
  xs.forEach((x, i) => {
    const meio: [number, number] = [x, Math.max(rt * 0.9, Math.min(meia + 0.6, rt * 0.96))]
    cena.partes.push(P(comMeioEm(tocos[i], ...meio), c.m.lenha, { polar: { cx: x, cy: 0, r: rt }, bisel: 1.2, tom: 0.86, contorno: 0.28, semente: 20 + i }))
    cena.partes.push(P(comMeioEm(elipse(x, 0, rt * 0.84, rt * 0.82), ...meio), c.m.madeira, { tabua: 0, bisel: 0.8, tom: 1.04, contorno: 0.2, textura: texDoCorte(x, 0), semente: 22 + i }))
  })
  // A tábua, de duas peças ao comprido, com a beira gasta.
  cena.partes.push(P(tabua, c.m.madeira, { eixo: 0, tabua: meia, bisel: 1.1, tom: 0.98, contorno: 0.28, projeta: { dist: 1.4, forca: 0.32, suave: 0.9 }, semente: 24 }))
}
