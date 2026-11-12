/**
 * BARRA DE OURO de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do mestre:
 * "coloque Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): o lingote de fundição sozinho,
 * deitado no chão. Tronco de pirâmide comprido: a face de cima menor que a base e as quatro rampas em volta,
 * cada uma pegando a luz pelo lado para onde olha (a da ponta e a do lado da luz claras, quase amarelas; as do
 * outro lado no marrom da sombra), os cantos amaciados, a MARCA DE PUNÇÃO na face de cima (um sol num
 * cartucho redondo e os três riscos do ensaiador, inventados) e os riscos de uso. Sombra curta.
 *
 * Não é o lingote da pilha do ferreiro (`pilhaDeLingotes.ts`): lá é ferro, cobre e estanho empilhados num
 * estrado; aqui é uma peça só, de ouro, maior e com a marca. O desenho da barra é o de `tesouroDeOuro.ts`, o
 * mesmo das barras do monte de ouro.
 *
 * Na 3/4 a barra fica como de cima (perfil em pé, como a âncora): é ouro deitado no chão, baixo, e derivada a
 * frente varrida virava um pedestal debaixo das rampas. Lê `c.giro` para a luz das rampas e o lado claro da
 * marca ficarem do lado da luz NA TELA. Sem material no painel; sem luz.
 * Esticada, a barra estica junto (é uma peça só); a marca e os riscos ficam do tamanho da largura.
 */
import { contato } from './motor'
import type { MontarMovel } from './contexto'
import { baseDaBarra, ESCURO_DO_OURO, paraALuz, pintarBarraDeOuro, type BarraDeOuro } from './tesouroDeOuro'

/** A base ocupa esta fração da pegada (o resto é a sombra curta para baixo à direita). */
const OCUPA_AO_COMPRIDO = 0.95
const OCUPA_DE_TRAVES = 0.88
/** A altura da barra deitada (casas): a da sombra curta. */
const ALTURA = 0.08
/** A força do contato no pé e a da sombra curta. */
const CONTATO = 0.32
const FORCA_DA_SOMBRA = 0.3

export const montarBarraDeOuro: MontarMovel = (c, cena) => {
  const deitada = c.w >= c.h
  const barra: BarraDeOuro = {
    x: 0,
    y: 0,
    ang: deitada ? 0 : Math.PI / 2,
    a: (deitada ? c.hw : c.hh) * OCUPA_AO_COMPRIDO,
    b: (deitada ? c.hh : c.hw) * OCUPA_DE_TRAVES,
    tom: 1,
    marca: true,
    projeta: 0,
    semente: 1700,
  }
  const base = baseDaBarra(barra)
  cena.sombras.push({ forma: base, z: c.g * ALTURA, forca: FORCA_DA_SOMBRA }, contato(base, CONTATO))
  pintarBarraDeOuro(c.peca, cena, barra, paraALuz(c.giro))
  cena.corDoPiso = ESCURO_DO_OURO
}
