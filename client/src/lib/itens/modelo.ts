import type { PecasDoEfeito } from '../../types/map'

/**
 * SISTEMA DE ITENS REFEITO (docs/design/itens-rework/PLANO.md §1, etapa E1): o modelo novo do item.
 *
 * Três donos, cada um de uma coisa só: o item do Acervo diz o que o item É (o tipo e os blocos
 * abaixo); a vaga da mochila diz quem TEM, quantos, se está equipado e o pente; a condição mora na
 * ficha (`CondicaoNaFicha`). Tudo aqui é `type` (não `interface`): a vaga viaja como JSON da nuvem
 * (`lib/nuvem/json.ts`), e só o alias aceita a assinatura de índice, como a luz e o efeito.
 *
 * Na E1 os blocos só passam a existir (a conversão os preenche na leitura); as telas e a batalha
 * continuam lendo os campos antigos, que ficam no arquivo até a E7.
 */

/** O tipo do item: decide os blocos que o editor mostra e as ações da mochila. */
export type TipoDoItem = 'corpo' | 'fogo' | 'hibrida' | 'municao' | 'arremesso' | 'consumivel' | 'equipamento' | 'outros'

export const TIPOS_DO_ITEM: readonly TipoDoItem[] = ['corpo', 'fogo', 'hibrida', 'municao', 'arremesso', 'consumivel', 'equipamento', 'outros']

export const ROTULO_DO_TIPO: Readonly<Record<TipoDoItem, string>> = {
  corpo: 'Corpo a corpo',
  fogo: 'De fogo',
  hibrida: 'Híbrida',
  municao: 'Munição',
  arremesso: 'Arremesso',
  consumivel: 'Consumível',
  equipamento: 'Equipamento',
  outros: 'Outros',
}

/** Os tipos que empilham sozinhos (a pilha é o padrão; o mestre pode mudar). */
export const TIPOS_QUE_EMPILHAM: ReadonlySet<TipoDoItem> = new Set<TipoDoItem>(['municao', 'arremesso', 'consumivel'])

/** Os tipos que se equipam (contam no limite "Armas por batalha", menos o equipamento). */
export const TIPOS_QUE_EQUIPAM: ReadonlySet<TipoDoItem> = new Set<TipoDoItem>(['corpo', 'fogo', 'hibrida', 'arremesso', 'equipamento'])

/** Os tipos que são arma: contam no limite "Armas por batalha" (uma pilha de granadas conta 1, decisão 5). */
export const TIPOS_DE_ARMA: ReadonlySet<TipoDoItem> = new Set<TipoDoItem>(['corpo', 'fogo', 'hibrida', 'arremesso'])

/** Os tipos que têm pente (decisão 2: um tipo de bala por vez). */
export const TIPOS_COM_PENTE: ReadonlySet<TipoDoItem> = new Set<TipoDoItem>(['fogo', 'hibrida'])

/**
 * A forma do alcance (`FormaDoAlcance`, lib/batalha/alcance/forma.ts) guardada opaca, como no cartão
 * da ficha: quem lê e confere é o leitor do alcance; aqui ela só não se perde.
 */
export type AlcanceNoItem = PecasDoEfeito

/** Quanto tempo a recarga leva: a ação que gasta e em quantas rodadas fica pronta (0 = na hora). */
export type RecargaDoItem = {
  /** O texto da ação, como o campo Ação do cartão ("Ação Padrão", "Ação Livre"). */
  acao: string
  rodadas: 0 | 1 | 2
}

/** O ataque do item (Corpo a corpo, De fogo, o tiro da Híbrida, Arremesso). */
export type AtaqueDoItem = {
  dano: number
  /** O id do atributo que soma ao dano; vazio = nenhum. */
  soma: string
  acao: string
  /** Quantos alvos; 1 = um só. */
  alvos: number
  alcance?: AlcanceNoItem
}

/** A parte que bate da Híbrida (o `ataque` é o tiro). */
export type GolpeDoItem = {
  dano: number
  soma: string
  acao: string
  alcance?: AlcanceNoItem
}

/** O pente da arma de fogo e da Híbrida: quantas cabem, que balas aceita e o tempo de recarga. */
export type PenteDoItem = {
  capacidade: number
  /** Ids dos itens de Munição aceitos (substitui `ItemDoCatalogo.municoes`). */
  aceita: string[]
  recarga?: RecargaDoItem
}

/** O arremesso: o tempo até o próximo estar na mão (decisão 7) e se volta (boomerang). */
export type ArremessoDoItem = {
  recarga?: RecargaDoItem
  volta?: true
}

/**
 * O que a bala faz no tiro (substitui `TiroDaMunicao`): `soma` = soma ao dano da arma ("+15");
 * `troca` = troca o dano da arma ("40"); `atributo` = pelo atributo de quem atira ("+Percepção / 2").
 */
export type BalaDoItem = {
  modo: 'soma' | 'troca' | 'atributo'
  valor: number
  atributo?: string
  divisor?: number
}

/** O uso do consumível: a ação, o alcance e onde vale. */
export type UsoDoItem = {
  acao: string
  alcance?: AlcanceNoItem
  onde: { batalha: boolean; fora: boolean }
}

export type ParteDoEquipamento = 'corpo' | 'cabeca' | 'maos' | 'pes' | 'acessorio'

export const PARTES_DO_EQUIPAMENTO: readonly ParteDoEquipamento[] = ['corpo', 'cabeca', 'maos', 'pes', 'acessorio']

/** Um bônus da roupa: CA, Escudo, Vantagem, Desvantagem ou um atributo (`em` = o id dele). Sem "Defesa" inventada. */
export type BonusDoEquipamento = {
  campo: 'ca' | 'escudo' | 'vantagem' | 'desvantagem' | 'atributo'
  n: number
  em?: string
}

export type EquipamentoDoItem = {
  parte: ParteDoEquipamento
  bonus: BonusDoEquipamento[]
}

/**
 * Um aviso "Confira" da conversão (PLANO §2.1, regra 4): o que não virou campo com certeza, com os
 * números lado a lado e de onde veio. O mestre apaga ao conferir.
 */
export type ConfiraDoItem = {
  texto: string
  antes?: string
  depois?: string
  origem?: string
}

/**
 * Os blocos de regra do item, todos opcionais. Trocar o tipo no editor esconde os que não servem,
 * sem apagá-los. `aoAcertar` e `aoUsar` são as MESMAS peças das técnicas (`lerMecanica`), opacas
 * aqui; o "onde vale" e o "gasta" do uso moram no bloco `uso`.
 */
export type BlocosDoItem = {
  ataque?: AtaqueDoItem
  golpe?: GolpeDoItem
  pente?: PenteDoItem
  arremesso?: ArremessoDoItem
  bala?: BalaDoItem
  uso?: UsoDoItem
  equipamento?: EquipamentoDoItem
  aoAcertar?: PecasDoEfeito
  aoUsar?: PecasDoEfeito
}

/** As chaves dos blocos, na ordem em que se gravam. */
export const CHAVES_DOS_BLOCOS: readonly (keyof BlocosDoItem)[] = ['ataque', 'golpe', 'pente', 'arremesso', 'bala', 'uso', 'equipamento', 'aoAcertar', 'aoUsar']

/**
 * A REGRA na vaga (A1): o instantâneo dos blocos do item, sem a imagem, para o Worker do Lobby, que
 * roda a batalha do treino sem o Acervo. Só o app do mestre escreve.
 */
export type RegraDaVaga = BlocosDoItem

/** O pente carregado da vaga: que bala e quantas. Vazio = sem o campo. As balas do pente não contam na vaga da munição. */
export type PenteDaVaga = {
  balaId: string
  n: number
}

/**
 * Uma condição na ficha (PLANO §1.5): `condId` aponta para o catálogo de condições (as de fábrica e
 * as criadas); `turnos: null` = até alguém tirar. Só o mestre escreve (decisão 18).
 */
export type CondicaoNaFicha = {
  id: string
  condId: string
  turnos: number | null
  n?: number
  origem?: string
  contadoNaCarta?: true
}
