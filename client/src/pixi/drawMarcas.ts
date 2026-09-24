import type { Graphics } from 'pixi.js'
import type { MarcaNoLugar } from '../types/map'
import { RUMO_GRAUS } from '../lib/marcas'

/**
 * BILHETE NO LUGAR no canvas (editor do mestre e tela do jogador): tudo vetor,
 * num `Graphics` só e sem `Text` — nada de sprite nem de hachura, estilo
 * minimapa. O texto do bilhete não vai ao mapa: o jogador o lê tocando o
 * papel (cartão), e o mestre no aviso de quando foi deixado.
 *
 * - Bilhete: papel chapado com canto dobrado e contorno fino escuro, pequeno
 *   como a porta do minimapa, com duas linhas de "escrita".
 * - Seta de giz: traço claro fino com ponta, no rumo que o jogador escolheu.
 */

/** Papel claro: salta do chão marrom e da névoa sem virar pergaminho (chapado, sem textura). */
export const BILHETE_PAPEL = 0xe9e2cf
/** Contorno e linhas de escrita: o mesmo escuro do contorno do pino. */
const BILHETE_TINTA = 0x1b1208
/** Giz: claro como a parede do minimapa. */
export const GIZ_COR = 0xf1efe8

/** Meia largura e meia altura do papel, em px de mundo. */
const PAPEL_MEIA_LARGURA = 7
const PAPEL_MEIA_ALTURA = 5.5
/** Lado do canto dobrado. */
const DOBRA = 4
const CONTORNO = 1
/** Seta: comprimento total (centrado no ponto), largura do traço e tamanho da ponta. */
const SETA_COMPRIMENTO = 22
const SETA_TRACO = 2
const SETA_PONTA = 6

function desenharBilhete(g: Graphics, x: number, y: number): void {
  const esquerda = x - PAPEL_MEIA_LARGURA
  const direita = x + PAPEL_MEIA_LARGURA
  const topo = y - PAPEL_MEIA_ALTURA
  const base = y + PAPEL_MEIA_ALTURA
  // Canto de cima à direita dobrado: é o que faz o retângulo ler como papel.
  g.poly([esquerda, topo, direita - DOBRA, topo, direita, topo + DOBRA, direita, base, esquerda, base])
    .fill({ color: BILHETE_PAPEL })
    .stroke({ width: CONTORNO, color: BILHETE_TINTA, join: 'round' })
  g.moveTo(direita - DOBRA, topo).lineTo(direita - DOBRA, topo + DOBRA).lineTo(direita, topo + DOBRA).stroke({ width: CONTORNO, color: BILHETE_TINTA })
  // Duas linhas de escrita.
  g.moveTo(esquerda + 2.5, y - 1).lineTo(direita - 3, y - 1).stroke({ width: CONTORNO, color: BILHETE_TINTA, alpha: 0.55 })
  g.moveTo(esquerda + 2.5, y + 2).lineTo(x + 1, y + 2).stroke({ width: CONTORNO, color: BILHETE_TINTA, alpha: 0.55 })
}

function desenharSeta(g: Graphics, marca: MarcaNoLugar): void {
  const graus = marca.rumo === undefined ? 0 : RUMO_GRAUS[marca.rumo]
  const rad = (graus * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const meio = SETA_COMPRIMENTO / 2
  const ponta = { x: marca.x + dx * meio, y: marca.y + dy * meio }
  const cauda = { x: marca.x - dx * meio, y: marca.y - dy * meio }
  const traco = { width: SETA_TRACO, color: GIZ_COR, cap: 'round', join: 'round' } as const
  g.moveTo(cauda.x, cauda.y).lineTo(ponta.x, ponta.y).stroke(traco)
  // Ponta: duas farpas a 150° do rumo.
  for (const lado of [-1, 1]) {
    const a = rad + Math.PI + lado * (Math.PI / 6)
    g.moveTo(ponta.x, ponta.y).lineTo(ponta.x + Math.cos(a) * SETA_PONTA, ponta.y + Math.sin(a) * SETA_PONTA).stroke(traco)
  }
}

/** Limpa e redesenha todas as marcas. Marca com ponto não finito (arquivo torto) é pulada. */
export function drawMarcas(g: Graphics, marcas: readonly MarcaNoLugar[]): void {
  g.clear()
  for (const marca of marcas) {
    if (!Number.isFinite(marca.x) || !Number.isFinite(marca.y)) continue
    if (marca.tipo === 'bilhete') desenharBilhete(g, marca.x, marca.y)
    else desenharSeta(g, marca)
  }
}
