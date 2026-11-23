import type { CarriedItem, Token } from '../../types/map'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { Casa, Direcao } from './area'
import type { MapaDoAlcance } from './alcance/quemEntra'
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
   * (ou não há onde gravar, ou a gravação foi recusada: a pasta publicada que o
   * Lobby não aceitaria). Com `false` a ficha ficou como estava.
   */
  ajustarPersonagem(personagemId: string, ajustar: (atual: Personagem) => Personagem): boolean
  /** Põe o personagem na equipe `equipeId` (ou em nenhuma, `null`). `false` = não deu (equipe que não existe, nada onde gravar). */
  trocarEquipe(personagemId: string, equipeId: string | null): boolean
  /**
   * Grava a lista inteira de equipes: por aqui a equipe automática dos
   * jogadores nasce e some (`lib/batalha/equipes.ts`). `false` = não há onde
   * gravar. Opcional: a mesa de equipes fixas (a arena, o treino) não troca
   * o lado de ninguém.
   */
  salvarEquipes?(equipes: readonly Equipe[]): boolean
  /**
   * INVOCAÇÃO (docs/planos/batalha-invocacao-plano.md): o personagem
   * temporário e o token do invocado entram juntos na cena `sceneKey` (o que
   * já existe com o mesmo id fica como está; `null` = só o outro). `false` =
   * não deu, e nada fica. Opcional: a mesa que não tem onde pôr o token não
   * invoca. A arena invoca no palco dela, com cópias em memória.
   */
  criarInvocado?(sceneKey: string, personagem: Personagem | null, token: Token | null): boolean
  /** Invocação: tira o token e o personagem temporário. Devolve como estavam (`null` = já não existia). */
  tirarInvocado?(sceneKey: string, personagemId: string, tokenId: string): { personagem: Personagem | null; token: Token | null }
  /** Invocação, fim da batalha: tira todo personagem temporário nascido nesta cena (`invocadoNaCena`) e os tokens ligados a eles. */
  limparInvocados?(sceneKey: string): void
  /**
   * F2 (fatia B, o "perto" do Aplauso): a casa do token na grade da cena e
   * para onde ele olha (`null` = o mestre nunca deu frente). `null` = token
   * ou cena fora de alcance. Opcional: a mesa sem mapa (a arena, o duelo) não
   * sabe onde ninguém está, e nada depende de "perto" lá.
   */
  posicaoDoToken?(sceneKey: string, tokenId: string): PosicaoNaGrade | null
  /**
   * Fase C do alcance (ALCANCE.md §5): as paredes (da visão) e a grade da cena no piso de
   * `tokenId`, para o host conferir as casas acesas. O mapa inteiro: o pedido do jogador chega com
   * a tela dele (`TelaDoPedido`), que vence isto. Opcional: sem ele, só a distância (a Arena).
   */
  mapaDoAlcance?(sceneKey: string, tokenId: string): MapaDoAlcance | null
  /**
   * REQUISITOS E5: a ficha `tokenId` está na luz agora (o mapa inteiro da cena, `lib/luzNaFicha.ts`).
   * `null` = ficha ou cena fora de alcance. Opcional: sem ele o requisito de luz sai "não sei".
   */
  naLuz?(sceneKey: string, tokenId: string): boolean | null
  /**
   * Fase C (prazo das condições, `lib/prazoDaCondicao.ts`): a ficha `tokenId`
   * da cena como está AGORA, para a vida por turno no começo da vez e o
   * desconto do prazo no fim. `null` = ficha ou cena fora de alcance.
   * Opcional: a mesa sem mapa (a arena, o duelo) não tem prazo.
   */
  fichaDaCena?(sceneKey: string, tokenId: string): Token | null
  /**
   * Todas as fichas da cena como estão AGORA (18/11/2026): na virada da rodada, o prazo das condições de quem
   * está FORA da ordem (o refém envenenado) também anda. Opcional, como `fichaDaCena`: sem ele, só a ordem anda.
   */
  fichasDaCena?(sceneKey: string): readonly Token[]
  /**
   * Fase C: troca a ficha pelo que `mudar` devolve, FORA do Ctrl+Z do mestre
   * (como a ponte das condições). `mudar` é reaplicado nos passos guardados do
   * Ctrl+Z: precisa valer para qualquer versão da ficha (pôr campos, não somar).
   */
  mudarFichaDaCena?(sceneKey: string, tokenId: string, mudar: (token: Token) => Token): void
  /**
   * MUNIÇÃO na aventura que ainda não migrou a mochila para a ficha
   * (`mochilaMigrada` ausente): lá a dona é a mochila do BONECO `tokenId` da
   * cena, e a da ficha não vale. `null` = quem manda é a ficha (ou o boneco
   * não está na cena). Opcional: a mesa sem mapa (a arena, o duelo) só tem a
   * ficha.
   */
  mochilaDoBoneco?(sceneKey: string, tokenId: string): readonly CarriedItem[] | null
  /** Grava a mochila do boneco dono (aventura não migrada), pelo mesmo caminho dos itens do mapa. `false` = não gravou. */
  gravarMochilaDoBoneco?(sceneKey: string, tokenId: string, mochila: CarriedItem[]): boolean
}

/** F2 (fatia B): onde o token está na grade e para onde olha. */
export interface PosicaoNaGrade {
  casa: Casa
  direcao: Direcao | null
}
