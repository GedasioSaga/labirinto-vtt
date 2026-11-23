import { CAMPO_DO_DANO, normalizar } from '../formula'
import { lerTipo } from '../tiposDaHabilidade'
import type { CartaoDaFicha } from '../../personagem'
import { CAMPO_DA_ACAO, CAMPO_DO_EFEITO, lerAcao } from '../leituraDaFicha'
import type { IdDoModelo } from './modelos'

/**
 * MONTAR A PARTIR DO TEXTO (EDITOR.md §3.5): o modelo que o texto do cartão pede. O modelo traz as
 * peças; a ação, o custo, o tempo, o dano, a cura e o alcance escritos entram nele por
 * `mecanicaDoModeloNoCartao` (o mesmo do "Começar de um modelo"). `null` = a técnica é passiva: fica
 * no texto (a batalha não usa passiva).
 */
export function modeloDoTexto(cartao: Pick<CartaoDaFicha, 'campos' | 'mecanica'>): IdDoModelo | null {
  const tipo = lerTipo({ campos: cartao.campos }).tipo
  // "-" no Dano é "sem dano", como o `lerDano` lê.
  const dano = (cartao.campos[CAMPO_DO_DANO] ?? '').trim()
  const temDano = dano !== '' && dano !== '-'
  const cura = /\bcur[ao]/.test(normalizar(cartao.campos[CAMPO_DO_EFEITO] ?? ''))
  // A Ação "Reação" sozinha é só no lugar da reação, como o Tipo Reação (`lerAcao`, `soReacao`).
  const soReacao = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '').soReacao === true
  if (tipo === 'passiva') return null
  if (tipo === 'reacao' || soReacao) return temDano ? 'contraGolpe' : 'esquivaPerfeita'
  switch (tipo) {
    case 'buff':
      // O Buff que cura é a Cura (o Fortalecido diria outra coisa que o texto).
      return cura ? 'cura' : 'buff'
    case 'debuff':
      return 'debuff'
    default:
      return !temDano && cura ? 'cura' : 'golpe'
  }
}
