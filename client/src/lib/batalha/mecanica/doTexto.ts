import { CAMPO_DO_DANO, normalizar } from '../formula'
import { lerTipo } from '../tiposDaHabilidade'
import type { CartaoDaFicha } from '../../personagem'
import { CAMPO_DO_EFEITO } from '../leituraDaFicha'
import type { IdDoModelo } from './modelos'

/**
 * MONTAR A PARTIR DO TEXTO (EDITOR.md §3.5): o modelo que o texto do cartão pede. O modelo traz as
 * peças; o custo, a ação e o dano escritos entram nele por `mecanicaDoModeloNoCartao` (o mesmo do
 * "Começar de um modelo"). `null` = a técnica é passiva: fica no texto (a batalha não usa passiva).
 */
export function modeloDoTexto(cartao: Pick<CartaoDaFicha, 'campos' | 'mecanica'>): IdDoModelo | null {
  const tipo = lerTipo({ campos: cartao.campos }).tipo
  const temDano = (cartao.campos[CAMPO_DO_DANO] ?? '').trim() !== ''
  const efeito = normalizar(cartao.campos[CAMPO_DO_EFEITO] ?? '')
  switch (tipo) {
    case 'passiva':
      return null
    case 'reacao':
      return temDano ? 'contraGolpe' : 'esquivaPerfeita'
    case 'buff':
      return 'buff'
    case 'debuff':
      return 'debuff'
    default:
      return !temDano && /\bcur[ao]/.test(efeito) ? 'cura' : 'golpe'
  }
}
