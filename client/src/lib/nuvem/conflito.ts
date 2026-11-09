import type { CarriedItem } from '../../types/map'
import { quantidadeDe } from '../items'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { alvoDoCaminho, chaveDaEtiqueta } from './caminho'
import { paraJson, proprio, type Json } from './json'
import type { Conflito, Mudanca, OpGravada } from './tipos'

/**
 * CONFLITO (docs/planos/lobby-jogadores-2026-11-05.md §5.2). Existe quando há
 * op gravada da mesma ficha com `rev > baseRev`, num caminho que SOBREPÕE o
 * da op nova (igual, ou um é prefixo do outro: apagar o cartão × mudar um
 * campo dele) e com CHAVE DE AUTORIA diferente, `(clienteId, autor efetivo)`:
 *
 * - a fila offline do mesmo aparelho passa em sequência;
 * - o mesmo jogador no celular e no PC conflita;
 * - o mestre no app e no site conflita consigo;
 * - dois jogadores na mesa LAN (mesmo app, autor declarado diferente) conflitam.
 *
 * Campos diferentes nunca brigam. Quem chega em segundo recebe as duas
 * escolhas: ficar com a do outro ou usar a sua.
 */

export interface ChaveDeAutoria {
  clienteId: string
  /** O autor efetivo: quem mandou, ou o jogador que o app declarou. */
  autorContaId: string
}

export function mesmaAutoria(a: ChaveDeAutoria, b: ChaveDeAutoria): boolean {
  return a.clienteId === b.clienteId && a.autorContaId === b.autorContaId
}

/** Um caminho é prefixo do outro (ou são iguais): mexer num pode desfazer o outro. */
export function caminhosSeSobrepoem(a: readonly string[], b: readonly string[]): boolean {
  const menor = a.length <= b.length ? a : b
  const maior = menor === a ? b : a
  return menor.every((segmento, indice) => segmento === maior[indice])
}

/**
 * A op que bate com a nova: a MAIS RECENTE gravada depois da base, na mesma
 * ficha, em caminho sobreposto e de outra autoria. `null` = sem conflito.
 * `gravadas` são as ops da ficha com `rev > baseRev` (o leitor do DO já filtra).
 */
export function opConcorrente(nova: Pick<Mudanca, 'fichaId' | 'caminho'> & { baseRev: number }, autoria: ChaveDeAutoria, gravadas: readonly OpGravada[]): OpGravada | null {
  let achada: OpGravada | null = null
  for (const gravada of gravadas) {
    if (gravada.fichaId !== nova.fichaId || gravada.rev <= nova.baseRev) continue
    if (!caminhosSeSobrepoem(gravada.caminho, nova.caminho) || mesmaAutoria(gravada, autoria)) continue
    if (achada === null || gravada.rev > achada.rev) achada = gravada
  }
  return achada
}

function comoJson(valor: unknown): Json | undefined {
  return valor === undefined ? undefined : paraJson(valor)
}

/** O cartão no fim da trilha de ids (subcartões no meio). */
function cartaoPelaTrilha(lista: readonly CartaoDaFicha[], trilha: readonly string[]): CartaoDaFicha | undefined {
  let cartoes = lista
  let achado: CartaoDaFicha | undefined
  for (const id of trilha) {
    achado = cartoes.find((cartao) => cartao.id === id)
    if (achado === undefined) return undefined
    cartoes = achado.subcartoes
  }
  return achado
}

function vagaDe(doc: Personagem, vagaId: string): CarriedItem | undefined {
  return (doc.mochila ?? []).find((vaga) => vaga.id === vagaId)
}

/**
 * O valor gravado agora no caminho, sem depender de a op nova ser aplicável
 * (comer 1 de uma pilha que já está em 1 continua mostrando o 1). Ausente =
 * o campo, o cartão, a vaga ou a ficha não existem mais. Quantidade e moedas
 * ausentes valem 1 e 0 (`quantidadeDe`, `Personagem.moedas`).
 */
export function valorNoCaminho(doc: Personagem | null, caminho: readonly string[]): Json | undefined {
  const alvo = alvoDoCaminho(caminho)
  if (doc === null || alvo === null) return undefined
  if ('aba' in alvo) {
    // Aba que a ficha não tem é lista vazia (como `cartoesDaAba`).
    const lista = proprio(doc.abas, alvo.aba) ?? []
    if (alvo.regra === 'ordemDosCartoes') {
      const dona = alvo.trilha.length === 0 ? lista : cartaoPelaTrilha(lista, alvo.trilha)?.subcartoes
      return dona === undefined ? undefined : dona.map((cartao) => cartao.id)
    }
    const cartao = cartaoPelaTrilha(lista, alvo.trilha)
    if (cartao === undefined) return undefined
    if (alvo.regra === 'cartao') return paraJson(cartao)
    if (alvo.regra === 'campoDoCartao') return comoJson(cartao[alvo.campo])
    if (alvo.regra === 'imagemDoCartao') return cartao.imagem
    if (alvo.regra === 'mecanicaDoCartao') return comoJson(cartao.mecanica)
    return proprio(cartao.campos, alvo.campoId)
  }
  switch (alvo.regra) {
    case 'ficha':
      return paraJson(doc)
    case 'texto':
      return doc[alvo.campo]
    case 'retrato':
      return doc.retrato
    case 'etiqueta':
      return doc.etiquetas.find((etiqueta) => chaveDaEtiqueta(etiqueta) === alvo.chave)
    case 'escolha':
      return proprio(doc.escolhas, alvo.chave)
    case 'numero':
      return proprio(doc[alvo.mapa], alvo.chave)
    case 'cartaoAtivo':
      return doc.cartoesAtivos.includes(alvo.cartaoId)
    case 'vaga':
      return comoJson(vagaDe(doc, alvo.vagaId))
    case 'quantidade': {
      const vaga = vagaDe(doc, alvo.vagaId)
      return vaga === undefined ? undefined : quantidadeDe(vaga)
    }
    case 'campoDoItem': {
      const vaga = vagaDe(doc, alvo.vagaId)
      return vaga === undefined ? undefined : comoJson(vaga[alvo.campo])
    }
    case 'moedas':
      return doc.moedas === undefined ? 0 : doc.moedas
    case 'dbt':
      return doc.dbt === undefined ? undefined : comoJson(doc.dbt[alvo.campo])
    case 'npcDoDbt':
      return doc.dbt === undefined ? undefined : comoJson(doc.dbt.npc)
    case 'doMestre':
      return comoJson(doc[alvo.campo])
  }
}

/** "O mestre acabou de mudar Vida para 25. Você pôs 28." O `valorAtual` é o de agora no caminho de quem chegou em segundo. */
export function montarConflito(opId: string, concorrente: OpGravada, valorAtual: Json | undefined, revAtual: number): Conflito {
  const conflito: Conflito = { opId, quem: concorrente.autorNome, quando: concorrente.quando, revAtual }
  if (valorAtual !== undefined) conflito.valorAtual = valorAtual
  return conflito
}

/** Op numa ficha apagada: o conflito tem a escolha "recriar" (§5.2). `apagou` = a op que a apagou. */
export function conflitoDeFichaApagada(opId: string, apagou: OpGravada | undefined, revAtual: number): Conflito {
  return { opId, quem: apagou === undefined ? 'Mestre' : apagou.autorNome, quando: apagou === undefined ? 0 : apagou.quando, revAtual, fichaApagada: true }
}
