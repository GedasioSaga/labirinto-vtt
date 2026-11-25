import { ajusteSobreOAtual, valorDaParte, type Ajuste } from '../ajusteDaFicha'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'

/**
 * DANO PELA FICHA (levantamento das mecânicas duplicadas, Nº 4; a fonte é a
 * batalha): com a ficha numa batalha, o ajuste rápido que DESCE a vida ("-50",
 * o "−", o número exato menor) é o "Dar dano" dela (Escudo, redução, registro
 * com Desfazer, lembrete de vida baixa, queda), e não o número mexido direto.
 * Quem leva à batalha é o mestre (`darDanoPelaFicha`) e o host, pelo jogador
 * (`batalhaNoHost`). Fora da batalha, igual a antes.
 *
 * Puro: sem store, sem rede.
 */

/**
 * Quanto o ajuste tira da vida: do atual de agora até o valor pedido, sem
 * parar no 0 (o Escudo da batalha pode segurar parte). `null` = não é dano só
 * na vida (cura, máximo, outra parte, mais de uma parte, sistema sem vida): o
 * caminho de sempre.
 */
export function danoDoAjusteNaVida(personagem: Personagem, ajustes: readonly Ajuste[], sistema: SistemaDeRpg): number | null {
  const vida = recursoDeVida(sistema)
  const [ajuste, ...outros] = ajustes
  if (vida === null || ajuste === undefined || outros.length > 0 || ajuste.parte !== 'recurso' || ajuste.chave !== vida.id) return null
  const dano = valorDaParte(personagem, 'recurso', vida.id) - ajusteSobreOAtual(personagem, ajuste).valor
  return dano > 0 ? dano : null
}
