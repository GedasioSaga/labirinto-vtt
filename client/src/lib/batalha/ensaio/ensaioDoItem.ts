import type { EfeitoDoItem } from '../../../types/map'
import { fichaDoBoneco } from '../../arena/boneco'
import type { AjustesDoBoneco } from '../../arena/tipos'
import { novoCartao, type Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { lerMecanica } from '../mecanica/modelo'
import { fraseDoGastoNoTestar } from '../mecanica/resumoDoItem'
import { ensaiar, type PassoDoEnsaio, type ResultadoDoEnsaio } from './ensaio'

/**
 * O TESTAR DO ITEM (Fase 7 de docs/design/habilidades/SISTEMA.md): o efeito
 * do item roda no MESMO ensaio da técnica (a mesa em memória, o boneco Judge,
 * o motor de verdade), como uma técnica sem custo na mão de quem usa; no fim,
 * o passo do gasto ("Gasta 1: tinha 1, fica 0"). Nada grava: a mochila de
 * verdade só muda no "Usar item" da Fase 8.
 */

export interface PedidoDeEnsaioDoItem {
  /** O nome do item como está na tela (o rascunho). */
  nome: string
  /** O efeito como está na tela: as peças do rascunho (a mecânica guardada do editor) e o gasto. */
  efeito: Pick<EfeitoDoItem, 'gasta' | 'onde'> & { mecanica: Readonly<Record<string, unknown>> }
  /** A ficha escolhida em "Quem usa"; `null` = quem usa de treino (uma ficha de boneco, de pé). */
  quemUsa: Personagem | null
  sistema: SistemaDeRpg
  semente: number
  /** Quantos a pilha tem antes do uso (o item novo tem 1). */
  quantos: number
  /** O d20 fixo do boneco; ausente = sorteado pela semente. */
  d20Fixo?: number
}

/** Quem usa de treino: a ficha de fábrica do boneco, de pé e com vida, com outro nome e outro id. */
const QUEM_USA_DE_TREINO: AjustesDoBoneco = { infinito: false, hp: 500, escudo: 0, modificador: 0, reage: 'd20' }
const ID_DE_QUEM_USA_DE_TREINO = 'ensaio-do-item-quem-usa'
const NOME_DE_QUEM_USA_DE_TREINO = 'Ajudante de treino'
/** O id do cartão que leva o item à ficha (só na cópia do ensaio). */
const ID_DO_CARTAO_DO_ITEM = 'ensaio-do-item'

export function quemUsaDeTreino(sistema: SistemaDeRpg): Personagem {
  return { ...fichaDoBoneco(sistema, QUEM_USA_DE_TREINO, ID_DE_QUEM_USA_DE_TREINO), nome: NOME_DE_QUEM_USA_DE_TREINO }
}

/** Testa o item uma vez. Nunca lança: o que o motor recusa vira o passo "Não saiu", e aí nada se gasta. */
export function ensaiarItem(pedido: PedidoDeEnsaioDoItem): ResultadoDoEnsaio {
  const { efeito, sistema } = pedido
  const lida = lerMecanica(efeito.mecanica)
  if (lida.tipo !== 'pecas') {
    const texto = lida.tipo === 'futura' ? 'O efeito é de uma versão mais nova do app: atualize para testar.' : lida.tipo === 'invalida' ? `O efeito tem uma peça torta: ${lida.motivo}.` : 'O item não tem efeito.'
    return { passos: [{ tipo: 'recusa', titulo: 'Não saiu', texto }], barras: [], passarUmaVez: null }
  }
  const cartao = { ...novoCartao(pedido.nome.trim() || 'Item'), id: ID_DO_CARTAO_DO_ITEM, mecanica: efeito.mecanica }
  // O item não gasta SP: "tudo cheio" só tira do caminho a ficha escolhida que está sem vida para agir.
  const resultado = ensaiar({ cartao, quemUsa: pedido.quemUsa ?? quemUsaDeTreino(sistema), sistema, semente: pedido.semente, recursosCheios: true, ...(pedido.d20Fixo === undefined ? {} : { d20Fixo: pedido.d20Fixo }) })
  if (resultado.passos.some((passo) => passo.tipo === 'recusa')) return resultado
  const onde: PassoDoEnsaio[] = efeito.onde === 'soFora' ? [{ tipo: 'arrumou', titulo: 'Onde', texto: 'Este item vale só fora da batalha: o teste mostra o que ele faria.' }] : []
  const gasto: PassoDoEnsaio = { tipo: 'gasto', titulo: 'Item', texto: fraseDoGastoNoTestar(efeito, lida.mecanica, pedido.quantos, sistema) }
  return { ...resultado, passos: [...onde, ...resultado.passos, gasto] }
}
