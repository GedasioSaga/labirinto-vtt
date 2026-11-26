import { ABA_DAS_ARMAS } from '../batalha/leituraDaFicha'
import { ITEM_DESCRICAO_MAX, type ItemParaDar } from '../items'
import { darNaFicha, tirarDaMochilaDaFicha } from '../mochila/darNaFicha'
import { cartoesDaAba, type Personagem } from '../personagem'
import type { AbaDoSistema, SistemaDeRpg } from '../sistemaDeRpg'
import { chaveDoNomeDaEntrada, DADOS_DO_TIPO, ehDoLivro, podeReceber, porNaFicha, tirarDaFicha, type EntradaParaFicha, type ItemDoCatalogo } from './catalogo'

/**
 * COISA x REGRA, UM INVENTÁRIO SÓ (Fase 5 da melhoria geral,
 * tmp/auditoria-ferramentas-2026-11-15/2-dados-que-nao-conversam.md §5.3-5.5):
 *
 *   COISA (o que se carrega, se vê, se vende) mora no Acervo do app e cai na
 *   MOCHILA da ficha. REGRA (dano, ação, efeito, balas) mora no catálogo do
 *   livro e aponta para a coisa (`ItemDoCatalogo.acervoId`). O cartão da aba
 *   Armas guarda o mesmo `itemId` da vaga da mochila.
 *
 * Aqui mora o "Pôr em" das duas pontas. A passagem dos cartões antigos das abas
 * Armas e Itens para a mochila é a conversão ao abrir (`lib/itens/conversao/`,
 * ITENS REFEITOS E1). Puro: sem store, sem disco.
 */

/** A aba da ficha que o catálogo enchia com itens; agora a tela dela mostra a mochila. */
export const ABA_DOS_ITENS = DADOS_DO_TIPO.item.aba

/** O que um "Pôr" deixou na ficha: o Desfazer tira exatamente isto. */
export interface PostoNaFicha {
  /** O cartão novo, quando a regra virou cartão (arma, habilidade, perícia...). */
  cartao: { abaId: string; cartaoId: string } | null
  /** A vaga da mochila que recebeu e quantos entraram, quando a coisa foi para a mochila. */
  vaga: { vagaId: string; entraram: number } | null
}

export type ResultadoDoPor =
  | ({
      ok: true
      personagem: Personagem
      passaDoLimiteDeArmas: boolean
      /** O que foi para a mochila (quem chama aplica igual na cópia do editor, com a mesma vaga); `null` = nada. */
      coisa: ItemParaDar | null
    } & PostoNaFicha)
  | { ok: false; motivo: 'semAba' | 'jaTem' | 'variacao' | 'cheia' }

/** "Dano: 35" por linha, na ordem da aba (o rótulo dela); campo que a aba não conhece sai com a chave. */
function linhasDosCampos(campos: Readonly<Record<string, string>>, aba: AbaDoSistema | undefined, fora: ReadonlySet<string>): string[] {
  const rotulos = new Map((aba?.campos ?? []).map((campo) => [campo.id, campo.rotulo]))
  const ordem = [...(aba?.campos ?? []).map((campo) => campo.id), ...Object.keys(campos).filter((chave) => !rotulos.has(chave))]
  return ordem.flatMap((chave) => {
    const valor = (campos[chave] ?? '').trim()
    return fora.has(chave) || valor.length === 0 ? [] : [`${rotulos.get(chave) ?? chave}: ${valor}`]
  })
}

const CAMPO_DA_DESCRICAO = 'descricao'
const CAMPO_DA_QUANTIDADE = 'quantidade'

/**
 * A entrada de ITEM do catálogo que não tem coisa ligada, como vaga de mochila:
 * o nome, e a descrição com o texto e os campos ("Efeito: cura 50"). Sem
 * `itemId`: não empilha com nada (é o mesmo item solto do pino "!").
 */
export function itemParaDarDaRegra(entrada: ItemDoCatalogo, aba: AbaDoSistema | undefined): ItemParaDar {
  const linhas = [entrada.texto.trim(), ...linhasDosCampos(entrada.campos, aba, new Set([CAMPO_DA_DESCRICAO, CAMPO_DA_QUANTIDADE]))].filter((linha) => linha.length > 0)
  const descricao = linhas.join('\n').slice(0, ITEM_DESCRICAO_MAX)
  return descricao.length === 0 ? { nome: entrada.nome } : { nome: entrada.nome, descricao }
}

/** A ficha já tem o cartão desta regra na aba Armas (pelo `itemId` ou, no cartão solto, pelo nome)? */
function temOCartaoDaArma(personagem: Personagem, itemId: string | undefined, nome: string): boolean {
  const chave = chaveDoNomeDaEntrada(nome)
  return cartoesDaAba(personagem, ABA_DAS_ARMAS).some((cartao) => (itemId !== undefined && cartao.itemId === itemId) || chaveDoNomeDaEntrada(cartao.nome) === chave)
}

/**
 * "PÔR EM" DE UMA ENTRADA DO CATÁLOGO (ou do livro):
 *  - ITEM: vai para a MOCHILA (a aba Itens não recebe mais cartão). Ligado a
 *    uma coisa do Acervo (`coisa`), vai a coisa inteira (foto, pilha, preço);
 *    solto, uma vaga com o nome e o texto. A variação recebe (a mochila é de
 *    cada boneco, decisão do mestre de 15/11).
 *  - ARMA: o cartão na aba Armas (como antes, agora com o `itemId` da coisa)
 *    e, ligada, a coisa na mochila. Na variação só a coisa (o cartão seria
 *    apagado pelo modelo); arma solta em variação é recusada.
 *  - O resto (habilidade, perícia...): só o cartão, como antes.
 * `vagaId` é o id da vaga nova, fixo por quem chama (disco e editor recebem a mesma).
 */
export function porEntradaNaFicha(personagem: Personagem, entrada: EntradaParaFicha, sistema: SistemaDeRpg, coisa: ItemParaDar | undefined, vagaId: string): ResultadoDoPor {
  if (!ehDoLivro(entrada) && entrada.tipo === 'item') {
    const dada = coisa ?? itemParaDarDaRegra(entrada, undefined)
    const deu = darNaFicha(personagem, dada, 1, vagaId)
    if (deu === null) return { ok: false, motivo: 'cheia' }
    return { ok: true, personagem: deu.personagem, passaDoLimiteDeArmas: false, coisa: dada, cartao: null, vaga: { vagaId: deu.vagaId, entraram: deu.entraram } }
  }
  const ehArma = !ehDoLivro(entrada) && entrada.tipo === 'arma'
  if (ehArma && coisa !== undefined && !podeReceber(personagem)) return porSoACoisa(personagem, coisa, vagaId)
  const resultado = porNaFicha(personagem, entrada, sistema)
  if (!resultado.ok) return resultado
  const cartao = { abaId: resultado.abaId, cartaoId: resultado.cartaoId }
  if (!ehArma || coisa === undefined) return { ok: true, personagem: resultado.personagem, passaDoLimiteDeArmas: resultado.passaDoLimiteDeArmas, coisa: null, cartao, vaga: null }
  const deu = darNaFicha(resultado.personagem, coisa, 1, vagaId)
  return {
    ok: true,
    personagem: deu === null ? resultado.personagem : deu.personagem,
    passaDoLimiteDeArmas: resultado.passaDoLimiteDeArmas,
    coisa: deu === null ? null : coisa,
    cartao,
    vaga: deu === null ? null : { vagaId: deu.vagaId, entraram: deu.entraram },
  }
}

function porSoACoisa(personagem: Personagem, coisa: ItemParaDar, vagaId: string): ResultadoDoPor {
  const deu = darNaFicha(personagem, coisa, 1, vagaId)
  if (deu === null) return { ok: false, motivo: 'cheia' }
  return { ok: true, personagem: deu.personagem, passaDoLimiteDeArmas: false, coisa, cartao: null, vaga: { vagaId: deu.vagaId, entraram: deu.entraram } }
}

/**
 * "PÔR EM" DE UMA COISA DO ACERVO: a coisa na mochila (`darNaFicha`) e, se o
 * livro tem uma ARMA ligada a ela (`regra`) e a ficha ainda não tem o cartão,
 * o cartão da arma também — é ele que diz o dano na batalha. Sem regra, a
 * arma da mochila ataca com o dano digitado (`armasDe`).
 */
export function porCoisaNaFicha(personagem: Personagem, coisa: ItemParaDar, regra: ItemDoCatalogo | undefined, sistema: SistemaDeRpg, vagaId: string): ResultadoDoPor {
  const deu = darNaFicha(personagem, coisa, 1, vagaId)
  if (deu === null) return { ok: false, motivo: 'cheia' }
  const vaga = { vagaId: deu.vagaId, entraram: deu.entraram }
  if (regra === undefined || regra.tipo !== 'arma' || !podeReceber(deu.personagem) || temOCartaoDaArma(deu.personagem, coisa.itemId, regra.nome)) {
    return { ok: true, personagem: deu.personagem, passaDoLimiteDeArmas: false, coisa, cartao: null, vaga }
  }
  const comCartao = porNaFicha(deu.personagem, regra, sistema)
  if (!comCartao.ok) return { ok: true, personagem: deu.personagem, passaDoLimiteDeArmas: false, coisa, cartao: null, vaga }
  return { ok: true, personagem: comCartao.personagem, passaDoLimiteDeArmas: comCartao.passaDoLimiteDeArmas, coisa, cartao: { abaId: comCartao.abaId, cartaoId: comCartao.cartaoId }, vaga }
}

/** O DESFAZER de qualquer "Pôr": tira o cartão e o que entrou na vaga, sobre a ficha como ela está agora. */
export function desfazerPosto(personagem: Personagem, posto: PostoNaFicha): Personagem {
  const semCartao = posto.cartao === null ? personagem : tirarDaFicha(personagem, posto.cartao.abaId, posto.cartao.cartaoId)
  return posto.vaga === null ? semCartao : tirarDaMochilaDaFicha(semCartao, posto.vaga.vagaId, posto.vaga.entraram)
}
