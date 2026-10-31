import { cartoesQueLigam } from '../ajusteDaFicha'
import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { motivoDaAcao, type AcoesDaVez } from './acoes'
import type { AcaoDaForma, FormaNaBatalha, NumeroDaForma } from './combate'
import { CAMPO_DA_ACAO, lerAcao } from './leituraDaFicha'

/**
 * TRANSFORMAÇÃO NA BATALHA, F3 fatia T (seção 3.2 de
 * docs/planos/batalha-one-piece-f3-plano.md; decisão 16 e respostas Q1 a Q3):
 * a tira Transformação do menu da vez. Ativar liga o cartão, gasta a ação do
 * campo Ação (vazio = Completa) e o ATUAL de cada recurso com atual e máximo
 * ganha a diferença do máximo (Q1: HP e SP). Desfazer a forma é ação livre.
 * Ligar pela FICHA no meio da batalha continua manual (Q2); ao encerrar, a
 * forma segue ligada e só a imagem volta (Q3).
 *
 * FASE 0 (o contrato): `formasNoMenu` devolve as formas apagadas com
 * `MOTIVO_AINDA_NAO`; `ativarForma` e `desfazerForma` devolvem `null` (não
 * fizeram nada). A regra chega na fase 1 (T-A). `acaoDaForma`,
 * `aparenciaDaForma` e `nomeDaFormaLigada` já valem: o recorte do jogador
 * depende delas.
 *
 * Puro: sem store, sem rede.
 */

export interface FormaNoMenu {
  cartao: CartaoDaFicha
  ligada: boolean
  /** O campo Ação; vazio ou ilegível = "completa". */
  acaoDaFicha: AcaoDaForma
  imagem: string | null
  /** A prévia do que muda (modificadores, máximos, atual). */
  numeros: NumeroDaForma[]
  /** Nomes dos subcartões (entram nas Habilidades quando ligada: já é a F2). */
  tecnicas: string[]
  /** Apagada e por quê; `null` = pode ativar. */
  motivo: string | null
}

/** Fase 0: o motivo de toda forma apagada até a regra chegar. */
export const MOTIVO_AINDA_NAO = 'Transformação ainda não disponível na batalha'

/** A ação que Ativar a forma gasta, pelo campo Ação: Simples, Completa ou Bônus; o resto (vazio, Livre, ilegível) = Completa. */
export function acaoDaForma(cartao: CartaoDaFicha): AcaoDaForma {
  const { acao } = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  return acao === 'simples' || acao === 'bonus' ? acao : 'completa'
}

/**
 * As formas da ficha para a tira Transformação (os cartões das abas que
 * ligam, `cartoesQueLigam`). FASE 0: sem prévia (`numeros` vazio) e toda
 * forma desligada apagada com `MOTIVO_AINDA_NAO`.
 */
export function formasNoMenu(personagem: Personagem, sistema: SistemaDeRpg, _acoes: AcoesDaVez | null): FormaNoMenu[] {
  return cartoesQueLigam(personagem, sistema).map((cartao) => {
    const ligada = personagem.cartoesAtivos.includes(cartao.id)
    return {
      cartao,
      ligada,
      acaoDaFicha: acaoDaForma(cartao),
      imagem: cartao.imagem,
      numeros: [],
      tecnicas: cartao.subcartoes.map((subcartao) => subcartao.nome),
      motivo: ligada ? null : MOTIVO_AINDA_NAO,
    }
  })
}

/** O motivo de Ativar apagado com a ação ESCOLHIDA na tela (o seletor troca a da ficha). `null` = pode. */
export function motivoDaForma(forma: FormaNoMenu, acao: AcaoDaForma, acoes: AcoesDaVez | null): string | null {
  if (forma.motivo !== null) return forma.motivo
  return acoes === null ? null : motivoDaAcao(acoes, acao)
}

/**
 * Ativar: liga o cartão e soma ao atual a diferença do máximo de cada recurso
 * que a forma aumenta, pelo `aplicarAjustes` (histórico da ficha em nome de
 * `quem`). `null` = não ativou (cartão que não liga, ou já ligado). FASE 0:
 * sempre `null`.
 */
export function ativarForma(
  _personagem: Personagem,
  _sistema: SistemaDeRpg,
  _cartaoId: string,
  _quem: string,
  _quando: number,
): { personagem: Personagem; numeros: NumeroDaForma[] } | null {
  return null
}

/** "Desfazer a forma" (ação livre): desliga o cartão; o corte do máximo já resolve o atual. `null` = não estava ligada. FASE 0: sempre `null`. */
export function desfazerForma(_personagem: Personagem, _sistema: SistemaDeRpg, _cartaoId: string, _quem: string, _quando: number): Personagem | null {
  return null
}

/** A imagem da forma para o token e o retrato: só enquanto o cartão segue ligado (R5: desligou pela ficha, a imagem volta sozinha). */
export function aparenciaDaForma(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null {
  if (forma === undefined || personagem === undefined || !personagem.cartoesAtivos.includes(forma.cartaoId)) return null
  return forma.imagem
}

/** O nome da forma ativada pelo menu, enquanto o cartão segue ligado (a carta mostra "PUNHO NEGRO"). */
export function nomeDaFormaLigada(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null {
  if (forma === undefined || personagem === undefined || !personagem.cartoesAtivos.includes(forma.cartaoId)) return null
  for (const cartoes of Object.values(personagem.abas)) {
    const cartao = cartoes.find((candidato) => candidato.id === forma.cartaoId)
    if (cartao !== undefined) return cartao.nome
  }
  return null
}
