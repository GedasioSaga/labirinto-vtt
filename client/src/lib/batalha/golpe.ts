import type { Ajuste } from '../ajusteDaFicha'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { AlvoDoGolpe, CombateDoPersonagem, ContraAtaque, GolpeDaBatalha, PedidoDeAcao, SaidaDaReacao } from './combate'
import type { Equipe } from './equipes'
import type { BatalhaEmTurnos } from './ponte'
import { danoFinal } from './reacao'
import type { RegrasDaBatalha } from './regrasDoCampo'
import type { AutorDaAcao, CartaDaOrdem, GastoDaVez, TurnosDaCena } from './turnos'

/**
 * O GOLPE, F2 (seção 3.5 de docs/planos/batalha-one-piece-f2-plano.md e
 * respostas Q4 e Q6): os reducers que a store chama para agir e reagir. A
 * store aplica os ajustes pela aventura, escreve a linha e solta os efeitos;
 * aqui só a regra.
 *
 * FASE 0 (contrato): `podeAgir` recusa tudo ("ainda não"), `lancarGolpe`
 * lança erro e `sugestaoParaNpc` não sugere; a fase 1 troca os corpos sem
 * mudar as assinaturas. `rolarReacao` e `resolverAlvo` já valem.
 *
 * Puro: sem store, sem rede. Ids e d20 entram por parâmetro.
 */

/** O que a regra do golpe precisa saber de quem age e da mesa. */
export interface ContextoDoGolpe {
  turnos: TurnosDaCena
  /** A carta de quem age: a da vez, ou (contra-ataque, Q6) uma carta da ficha que ganhou a ação. */
  carta: CartaDaOrdem
  /** O personagem da carta; `null` = ficha sem personagem (só Atacar, sem custo). */
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  regras: RegrasDaBatalha | null
  autor: AutorDaAcao
  personagens: readonly Personagem[]
  /** tokenId → personagemId de cada ficha da cena (os alvos possíveis); `null` = ficha sem personagem; `undefined` = fora da cena. */
  personagemDoToken: (tokenId: string) => string | null | undefined
}

/** O que `lancarGolpe` devolve para a store aplicar. */
export interface GolpeLancado {
  /** O golpe com os alvos que ainda esperam a reação; `null` = nada a esperar (Concentrar, Mover, ou todos resolvidos). */
  golpe: GolpeDaBatalha | null
  /** Os alvos já resolvidos (sem reação: Surpresa, Overload), para a store aplicar o dano agora. */
  resolvidos: readonly AlvoDoGolpe[]
  /** O gasto novo da carta; `null` = não gastou ação da vez (contra-ataque). */
  gasto: GastoDaVez | null
  /** O combate novo do personagem; `null` = não mudou. */
  combate: CombateDoPersonagem | null
  /** O custo de quem age (SP ou HP), para `aplicarAjustes`. */
  custo: readonly Ajuste[]
  /** Q6: o contra-ataque que este pedido gastou; `null` = nenhum. */
  contraUsado: ContraAtaque | null
}

/** O que a sugestão do NPC precisa: a mesa inteira. */
export interface ContextoDaMesa {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
  equipes: readonly Equipe[] | undefined
  /** Os tokens com vida 0 (não são alvo). */
  caidos: ReadonlySet<string>
}

export interface SugestaoDoNpc {
  cartaoId: string | null
  armaId: string | null
  alvoTokenId: string | null
}

/** Por que o pedido não vale, ou `null` (pode). Fase 0: nada vale ainda. */
export function podeAgir(_ctx: ContextoDoGolpe, _pedido: PedidoDeAcao): string | null {
  return 'Ainda não'
}

/** O golpe lançado. Só depois de `podeAgir` devolver `null`. Fase 0: não existe ainda. */
export function lancarGolpe(_ctx: ContextoDoGolpe, _pedido: PedidoDeAcao, _ids: { golpe: string; linha: string }): GolpeLancado {
  throw new Error('lancarGolpe: chega na fase 1 da F2')
}

function comAlvo(golpe: GolpeDaBatalha, tokenId: string, mudar: (alvo: AlvoDoGolpe) => AlvoDoGolpe | null): GolpeDaBatalha {
  const indice = golpe.alvos.findIndex((alvo) => alvo.tokenId === tokenId)
  const alvo = golpe.alvos[indice]
  if (alvo === undefined) return golpe
  const novo = mudar(alvo)
  if (novo === null) return golpe
  const alvos = [...golpe.alvos]
  alvos[indice] = novo
  return { ...golpe, alvos }
}

/** A rolagem (ou rerolagem) do alvo. Alvo resolvido ou que não reage: o MESMO golpe. */
export function rolarReacao(golpe: GolpeDaBatalha, tokenId: string, modificador: number, d20: number): GolpeDaBatalha {
  return comAlvo(golpe, tokenId, (alvo) => {
    if (alvo.danoFinal !== undefined || !alvo.podeReagir) return null
    return { ...alvo, rolagem: { d20, modificador, total: d20 + modificador, vezes: (alvo.rolagem?.vezes ?? 0) + 1 } }
  })
}

/**
 * O alvo resolvido com a saída: o dano final (contra-ataque = 0, Q6). Quem
 * confere se a saída foi liberada pelo dado é `podeAgir`/a store. Já
 * resolvido: o MESMO golpe.
 */
export function resolverAlvo(golpe: GolpeDaBatalha, tokenId: string, saida: SaidaDaReacao): GolpeDaBatalha {
  return comAlvo(golpe, tokenId, (alvo) => {
    if (alvo.danoFinal !== undefined) return null
    return { ...alvo, saida, danoFinal: alvo.dano === null ? 0 : danoFinal(alvo.dano, saida) }
  })
}

/** O golpe ainda tem alvo esperando? */
export function golpePendente(golpe: GolpeDaBatalha): boolean {
  return golpe.alvos.some((alvo) => alvo.danoFinal === undefined)
}

/** A técnica, a arma e o alvo que o painel do NPC já marca (decisão 17). Fase 0: nenhum. */
export function sugestaoParaNpc(_npc: Personagem, _cena: BatalhaEmTurnos, _ctx: ContextoDaMesa): SugestaoDoNpc {
  return { cartaoId: null, armaId: null, alvoTokenId: null }
}
