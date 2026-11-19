import type { ItemDoMenuDaCarta } from '../components/batalha/MenuDaCarta'
import type { ItemDaCartaNoEspelho, RespostaDaMesa } from './tipos'

/**
 * O MENU DA CARTA na mesa da batalha: os itens da faixa do mestre viram dado
 * (o espelho atravessa o fio até a janela à parte) e o pedido `itemDaCarta`
 * volta a ser o item, remontado na principal com a batalha de agora.
 */

/** Os itens sem a função, para o espelho. */
export function itensNoEspelho(itens: readonly ItemDoMenuDaCarta[]): ItemDaCartaNoEspelho[] {
  return itens.map((item) => ({
    id: item.id,
    rotulo: item.rotulo,
    detalhe: item.detalhe ?? null,
    secao: item.secao ?? null,
    perigo: item.perigo === true,
    desabilitado: item.desabilitado === true,
    marcado: item.marcado ?? null,
    cor: item.cor ?? null,
    abreNoApp: item.abreNoApp === true,
  }))
}

/**
 * Aplica o item `id` do menu remontado agora. O item que sumiu (a carta mudou
 * desde o espelho) ou desligou volta com a frase; `recusaDoMotor` diz se o
 * motor recusou a ação que o item mandou (Dragon Ball), `null` = aceitou.
 */
export function escolherItemDaCarta(itens: readonly ItemDoMenuDaCarta[], id: string, recusaDoMotor: () => string | null = () => null): RespostaDaMesa {
  const item = itens.find((candidato) => candidato.id === id)
  if (item === undefined) return { ok: false, motivo: 'Este item não está mais no menu da carta: abra de novo.' }
  if (item.desabilitado === true) return { ok: false, motivo: item.detalhe ?? 'Este item não vale agora.' }
  item.onEscolher()
  const motivo = recusaDoMotor()
  return motivo === null ? { ok: true, motivo: null } : { ok: false, motivo }
}
