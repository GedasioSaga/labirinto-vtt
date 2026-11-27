import type { ItemDoCatalogo } from '../../lib/livros/catalogo'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { HabilidadeDoCatalogo } from '../habilidades/HabilidadeDoCatalogo'
import './mundo.css'
import './itens.css'

/**
 * "+ Nova habilidade" e "Editar" do catálogo do livro, na página Habilidades da Biblioteca. Desde o
 * rework das habilidades (E7; decisão 1 do protótipo aprovado, "uma tela só") abrem o editor da
 * habilidade DIRETO: a janela de antes, com Ação, Tipo, Efeito, Custo, Tempo e Dano escritos em cima
 * e as peças dentro do editor, dizia a mesma coisa em dois lugares (pedido do dono de 26/11 23:01).
 * Arma e item se editam no editor do item, na coisa do Acervo (itens refeitos, UMA COISA, UM LUGAR):
 * a página nunca manda arma nem item para cá.
 */

/** A "nova" é sempre habilidade (a página Habilidades a abre); a editada é a habilidade escolhida na lista. */
export type ModoDaEntrada = { tipo: 'nova' } | { tipo: 'editar'; item: ItemDoCatalogo }

export interface EntradaDoCatalogoDialogProps {
  modo: ModoDaEntrada
  sistema: SistemaDeRpg
  onClose: () => void
  /** Gravou: a entrada como ficou no catálogo e se é nova. */
  onSalvou: (item: ItemDoCatalogo, nova: boolean) => void
}

export function EntradaDoCatalogoDialog({ modo, sistema, onClose, onSalvou }: EntradaDoCatalogoDialogProps) {
  const item = modo.tipo === 'editar' ? modo.item : null
  // Arma e item não chegam aqui (vão ao editor do item): sem um lugar certo para eles, a janela não abre.
  if (item !== null && item.tipo !== 'habilidade') return null
  return <HabilidadeDoCatalogo item={item} sistema={sistema} onClose={onClose} onSalvou={onSalvou} />
}
