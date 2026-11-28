import type { CenaDoRelevo, MetalDoRelevo } from '../tipos'
import { svgDoPainel } from './arte'

/**
 * O PAINEL EM RELEVO COMO IMAGEM (28/11): o SVG do painel como dado, para um
 * `<img>`: o quadro do jogador e do editor, as placas postas, a escolha da cena
 * e o cartão de Meus puzzles. O navegador desenha o vetor no tamanho de cada
 * um, fora da linha principal (o canvas do painel travava a abertura por 0,3 a
 * 0,5 s). A mesma URL para tudo: o navegador lê o SVG uma vez só.
 */

const miniaturas = new Map<string, string>()

export function urlDoSvgDoPainel(cena: CenaDoRelevo | null, metal: MetalDoRelevo): string {
  const chave = `${cena ?? 'moldura'}|${metal}`
  const pronta = miniaturas.get(chave)
  if (pronta !== undefined) return pronta
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoPainel(cena, metal))}`
  miniaturas.set(chave, url)
  return url
}
