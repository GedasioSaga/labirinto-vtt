import { temMaximo } from '../ajusteDaFicha'
import { recursoDoEscudo } from '../batalha/leituraDaFicha'
import { MODIFICADOR_DA_REACAO_MAX } from '../batalha/combate'
import { novoPersonagem, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import { VIDA_INFINITA, type AjustesDoBoneco } from './tipos'

/**
 * O JUDGE-BONECO (seção 4.3 do plano da arena): o alvo do modo "Contra o
 * Judge-boneco". Uma ficha NPC "Judge" com a vida (infinita ou o HP pedido) e
 * o Escudo, máximos iguais ao atual, Agilidade 0 e nenhuma técnica: ele não
 * age, só apanha. Ajustar o boneco troca a ficha direto, sem linha no
 * registro (é ajuste do laboratório, não da luta).
 *
 * Puro: sem store.
 */

export const NOME_DO_BONECO = 'Judge'

/** HP e Escudo inteiros e não negativos; HP no mínimo 1 (vivo) e no teto da vida infinita. */
function inteiroEntre(valor: number, min: number, max: number, padrao: number): number {
  if (!Number.isFinite(valor)) return padrao
  return Math.min(max, Math.max(min, Math.trunc(valor)))
}

/** Os ajustes com cada número no lugar: HP 1..`VIDA_INFINITA`, Escudo 0..`VIDA_INFINITA`, modificador no teto da reação. */
export function ajustesValidos(ajustes: AjustesDoBoneco): AjustesDoBoneco {
  return {
    infinito: ajustes.infinito,
    hp: inteiroEntre(ajustes.hp, 1, VIDA_INFINITA, 1),
    escudo: inteiroEntre(ajustes.escudo, 0, VIDA_INFINITA, 0),
    modificador: inteiroEntre(ajustes.modificador, -MODIFICADOR_DA_REACAO_MAX, MODIFICADOR_DA_REACAO_MAX, 0),
    reage: ajustes.reage === 'parado' ? 'parado' : 'd20',
  }
}

/** A vida que a ficha do boneco recebe: `VIDA_INFINITA` com "HP ∞", senão o HP. */
export function vidaDoBoneco(ajustes: AjustesDoBoneco): number {
  return ajustes.infinito ? VIDA_INFINITA : ajustes.hp
}

/** O personagem com o recurso no valor (e o máximo igual, quando o recurso tem máximo). */
function comRecurso(personagem: Personagem, sistema: SistemaDeRpg, recursoId: string, valor: number): Personagem {
  const maximos = temMaximo(sistema, recursoId) ? { ...personagem.maximos, [recursoId]: valor } : personagem.maximos
  return { ...personagem, recursos: { ...personagem.recursos, [recursoId]: valor }, maximos }
}

/**
 * A ficha do boneco. Sistema sem recurso de vida: entra sem vida (não cai);
 * sem Escudo: o Escudo pedido fica de fora.
 */
export function fichaDoBoneco(sistema: SistemaDeRpg, ajustes: AjustesDoBoneco, id: string): Personagem {
  const base: Personagem = { ...novoPersonagem(sistema, 'npc', NOME_DO_BONECO), id }
  return comAjustesDoBoneco(base, sistema, ajustes, { vida: true, escudo: true })
}

/**
 * Regrava a vida e/ou o Escudo da ficha do boneco pelos ajustes (só as partes
 * pedidas: trocar o Escudo no meio da luta não enche a vida de volta).
 */
export function comAjustesDoBoneco(personagem: Personagem, sistema: SistemaDeRpg, ajustes: AjustesDoBoneco, partes: { vida: boolean; escudo: boolean }): Personagem {
  let ficha = personagem
  const vida = recursoDeVida(sistema)
  if (partes.vida && vida !== null) ficha = comRecurso(ficha, sistema, vida.id, vidaDoBoneco(ajustes))
  const escudo = recursoDoEscudo(sistema)
  if (partes.escudo && escudo !== null) ficha = comRecurso(ficha, sistema, escudo.id, ajustes.escudo)
  return ficha
}
