import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { Equipe } from './equipes'

/**
 * A MESA DA BATALHA (fase 0 de docs/planos/batalha-arena-de-testes-plano.md,
 * seção 4.2): de onde a store da batalha lê as fichas e onde grava o que a
 * luta muda nelas. A store (`criarBatalhaStore` em `stores/batalhaStore.ts`)
 * recebe uma mesa e não conhece mais nada: a batalha da mesa de verdade usa a
 * aventura (`stores/mesaDaAventura.ts`); a arena de testes usa as cópias dela,
 * e nada chega às fichas de verdade.
 *
 * Toda leitura é na hora (a ficha de AGORA): a store pergunta de novo a cada
 * ação, nunca guarda a lista.
 *
 * Só o contrato: sem store, sem disco.
 */
export interface MesaDaBatalha {
  /** Os personagens em uso; referência estável enquanto nada muda. */
  personagens(): readonly Personagem[]
  /** O sistema em uso; `null` = sem sistema (a batalha não mexe em ficha). */
  sistema(): SistemaDeRpg | null
  /** As equipes em uso (o membro é personagem). */
  equipes(): readonly Equipe[]
  /**
   * Troca o personagem pelo que `ajustar` devolve; `ajustar` recebe o de
   * AGORA. Devolver o mesmo = nada muda. `false` = personagem que não existe
   * (ou não há onde gravar).
   */
  ajustarPersonagem(personagemId: string, ajustar: (atual: Personagem) => Personagem): boolean
  /** Põe o personagem na equipe `equipeId` (ou em nenhuma, `null`). `false` = não deu (equipe que não existe, nada onde gravar). */
  trocarEquipe(personagemId: string, equipeId: string | null): boolean
}
