import type { MaterialDaParede } from '../../types/map'

/**
 * O CATÁLOGO DOS MATERIAIS DA PAREDE (pedido de 07/11/2026) e o LUGAR ÚNICO das
 * imagens deles: `texturas/paredes/imagens/<material>.png`, as texturas do
 * estúdio aprovadas pelo usuário em 07/11/2026 (o gerador e a folha ficam no
 * projeto `jogos/texturas-labirinto`, `prova/paredes-RESUMO.md`). Trocar uma
 * textura é trocar o PNG ali, com o mesmo nome; material novo é uma linha no
 * catálogo abaixo e um PNG com o id dele.
 *
 * O formato (`FORMATO_DA_IMAGEM`): PNG de 512 x 512 px que repete nos dois
 * sentidos, 1 texel = 1 px do mundo a 64 px por casa (512 px = 8 casas), o x da
 * imagem AO LONGO da parede e o y atravessando a espessura, na cor natural do
 * material (sem tingir).
 *
 * As imagens vão dentro do app pelo Vite (arquivo próprio em `assets/` com hash
 * no nome), como as do Desenhado: o jogador as recebe pela mesma rota.
 */
export const FORMATO_DA_IMAGEM = {
  /** Lado do ladrilho em texels (= px do mundo a 64 px por casa). */
  lado: 512,
  /** A casa em que 1 texel vale 1 px do mundo; noutra grade a textura escala junto. */
  casa: 64,
} as const

export interface MaterialDoCatalogo {
  readonly id: MaterialDaParede
  readonly nome: string
  readonly descricao: string
  /**
   * A linha da imagem (texel) que cai no MEIO do traço: o meio de uma fiada, de
   * uma tábua, de um colmo. A parede fina mostra só a faixa em volta dela, e
   * assim a faixa sai inteira dentro da peça em vez de cortar uma junta.
   */
  readonly meioY: number
}

/** A ordem é a da tela: o castelo primeiro (o pedido do usuário), as pedras, o barro, as fibras, o metal. */
export const MATERIAIS_DA_PAREDE: readonly MaterialDoCatalogo[] = [
  { id: 'castelo', nome: 'Castelo', descricao: 'Pedra aparelhada em fiadas, junta cinza.', meioY: 32 },
  { id: 'pedra-rustica', nome: 'Pedra rústica', descricao: 'Pedras irregulares, fenda escura entre elas.', meioY: 32 },
  { id: 'tijolo', nome: 'Tijolo', descricao: 'Tijolos de barro em fiadas alternadas.', meioY: 16 },
  { id: 'madeira', nome: 'Madeira', descricao: 'Tábuas ao longo da parede, com emendas e nós.', meioY: 32 },
  { id: 'bambu', nome: 'Bambu', descricao: 'Colmos de bambu lado a lado, com os nós.', meioY: 64 },
  { id: 'palha', nome: 'Palha', descricao: 'Feixes de palha amarrados com barbante.', meioY: 32 },
  { id: 'ferro', nome: 'Ferro', descricao: 'Chapas de ferro rebitadas.', meioY: 64 },
]

/** O material que a ferramenta lembra antes de qualquer escolha. */
export const MATERIAL_PADRAO: MaterialDaParede = 'castelo'

const POR_ID = new Map<string, MaterialDoCatalogo>(MATERIAIS_DA_PAREDE.map((m) => [m.id, m]))

/** Texto do map.json (editado à mão, versão nova com material que esta não conhece) é material do catálogo? */
export function ehMaterialDaParede(valor: unknown): valor is MaterialDaParede {
  return typeof valor === 'string' && POR_ID.has(valor)
}

export function materialDoCatalogo(material: MaterialDaParede): MaterialDoCatalogo {
  return POR_ID.get(material) ?? MATERIAIS_DA_PAREDE[0]
}
