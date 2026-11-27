import { CONDICAO_DO_TIPO } from '../../../lib/batalha/mecanica/golpe'
import { catalogoDeCondicoes } from '../../../lib/condicoes/catalogo'
import type { CondicaoPropria } from '../../../types/map'
import { ABA_DAS_TECNICAS } from '../../../lib/batalha/leituraDaFicha'
import type { ContextoDosRequisitos } from '../../../lib/batalha/requisitos/contexto'
import { comoJson, lerMarcas, mesmaMarca, requisitosParaGuardar } from '../../../lib/batalha/requisitos/ler'
import { VERSAO_DOS_REQUISITOS, type AcumuladorDaFicha, type ObjetoJson, type RequisitosDoCartao, type ValorJson } from '../../../lib/batalha/requisitos/modelo'
import { cartoesDaAba, numeroDaFicha, type CartaoDaFicha, type Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { ehObjetoJson, type OpcoesDasFontes } from '../blocos/requisitosNaTela'
import type { ListasDosRequisitos } from '../blocos/BlocoDosRequisitos'
import { acumuladoresNaFicha } from '../acumulador/acumuladoresDaFicha'

/**
 * OS REQUISITOS DO CARTÃO NO EDITOR (ED5 = fase F de REQUISITOS.md): onde as linhas Requisitos e
 * Evolução leem e gravam o campo `requisitos` (fora da mecânica, EDITOR.md §3.6). O editor mexe no
 * JSON guardado; o que ele não conhece (as chaves `aoUsar` e `forma`, peça de app mais novo) fica
 * como veio. Quem julga é `lerRequisitos` e o avaliador da B1.
 */

/** O bloco como o cartão o guarda, em JSON; sem bloco = `null`. */
export function blocoCru(cartao: CartaoDaFicha): ObjetoJson | null {
  const json = comoJson(cartao.requisitos)
  return ehObjetoJson(json) ? json : null
}

/** A raiz "Todos estes" de `usar` (ou do `evoluir`) como o disco a guarda. */
export function todosCru(bloco: ObjetoJson | null, qual: 'usar' | 'evoluir'): ValorJson[] {
  const grupo = qual === 'usar' ? bloco?.usar : ehObjetoJson(bloco?.evoluir) ? bloco.evoluir.grupo : undefined
  return ehObjetoJson(grupo) && Array.isArray(grupo.todos) ? [...grupo.todos] : []
}

/** O cartão sem a chave `requisitos`. */
function semRequisitos(cartao: CartaoDaFicha): CartaoDaFicha {
  const { requisitos: _fora, ...resto } = cartao
  return resto
}

/** O cartão com o bloco novo; bloco sem nada além da versão = a chave sai (o cartão volta a ser como antes). */
function comBloco(cartao: CartaoDaFicha, bloco: ObjetoJson): CartaoDaFicha {
  const { v: _v, ...resto } = bloco
  return Object.keys(resto).length === 0 ? semRequisitos(cartao) : { ...cartao, requisitos: bloco }
}

/** O cartão com a raiz de `usar` trocada; vazia = sem `usar`. */
export function comUsar(cartao: CartaoDaFicha, todos: readonly ValorJson[]): CartaoDaFicha {
  const { usar: _antes, ...resto } = blocoCru(cartao) ?? { v: VERSAO_DOS_REQUISITOS }
  return comBloco(cartao, todos.length === 0 ? resto : { ...resto, usar: { todos: [...todos] } })
}

/** O cartão com o grupo de evoluir trocado (`null` = a técnica não pede nada para evoluir: a chave sai). */
export function comEvoluir(cartao: CartaoDaFicha, todos: readonly ValorJson[] | null): CartaoDaFicha {
  const { evoluir: _antes, ...resto } = blocoCru(cartao) ?? { v: VERSAO_DOS_REQUISITOS }
  return comBloco(cartao, todos === null ? resto : { ...resto, evoluir: { grupo: { todos: [...todos] }, dura: 'umUso' } })
}

/** O bloco lido num cartão de mentira, para a frase, o "Falta:" e as peças tortas da tela. */
export function blocoParaLer(todos: readonly ValorJson[], qual: 'usar' | 'evoluir'): ObjetoJson {
  const grupo: ObjetoJson = { todos: [...todos] }
  return qual === 'usar' ? { v: VERSAO_DOS_REQUISITOS, usar: grupo } : { v: VERSAO_DOS_REQUISITOS, evoluir: { grupo, dura: 'umUso' } }
}

/** O bloco lido já pronto para gravar de novo (o mesmo JSON que `requisitosParaGuardar` dá). */
export function blocoGuardado(bloco: RequisitosDoCartao): ObjetoJson {
  return requisitosParaGuardar(bloco)
}

/**
 * Os acumuladores da ficha: os definidos nos cartões (a B2 os põe no cartão) e, ED6, o contador de
 * antes convertido em memória (a Polaridade do texto do Vagn), com o id que ele ganha ao ser gravado.
 */
export function acumuladoresDaFicha(personagem: Personagem): AcumuladorDaFicha[] {
  return acumuladoresNaFicha(personagem).map((item) => item.acumulador)
}

/** As opções dos campos que apontam outra coisa: as técnicas, as formas, os atributos, os acumuladores, a mochila. */
export function fontesDaFicha(personagem: Personagem, sistema: SistemaDeRpg, tecnicas: readonly CartaoDaFicha[], cartaoId: string): OpcoesDasFontes {
  const nomeado = (cartao: CartaoDaFicha) => cartao.nome.trim() !== ''
  const formas = sistema.abas.filter((aba) => aba.modificadores === true && aba.id !== ABA_DAS_TECNICAS).flatMap((aba) => cartoesDaAba(personagem, aba.id))
  return {
    tecnica: tecnicas.filter((cartao) => cartao.id !== cartaoId && nomeado(cartao)).map((cartao) => ({ id: cartao.id, nome: cartao.nome.trim() })),
    forma: formas.filter(nomeado).map((cartao) => ({ id: cartao.id, nome: cartao.nome.trim() })),
    atributo: sistema.atributos.map((atributo) => ({ id: atributo.id, nome: atributo.nome })),
    acumulador: acumuladoresDaFicha(personagem).map((acumulador) => ({ id: acumulador.id, nome: acumulador.nome })),
    item: (personagem.mochila ?? []).map((vaga) => ({ nome: vaga.nome })),
    arma: [],
  }
}

/**
 * As sugestões dos campos de texto: as condições do catálogo (rework das condições, E7: as de fábrica e,
 * com `criadas`, as do mestre), as do tipo do golpe e as marcas das fichas.
 */
export function listasDaFicha(personagem: Personagem, criadas: readonly CondicaoPropria[] = []): ListasDosRequisitos {
  const selos = [...catalogoDeCondicoes(criadas).map((condicao) => condicao.nome), ...Object.values(CONDICAO_DO_TIPO)].filter((nome, indice, todos) => todos.findIndex((outro) => mesmaMarca(outro, nome)) === indice)
  const marcas: string[] = []
  for (const cartoes of Object.values(personagem.abas)) for (const cartao of cartoes) for (const marca of lerMarcas(cartao.marcas)) if (!marcas.some((outra) => mesmaMarca(outra, marca))) marcas.push(marca)
  return { selos, marcas }
}

/**
 * O retrato "com a ficha de agora" (protótipo, tela 1: "No menu da batalha, com a ficha de agora"):
 * fora da batalha, quem usa tem o SP, a vida e o Escudo da ficha, a reação livre, nenhum selo, nada
 * ligado e cada acumulador no nível 0. O que só a batalha sabe (alvo, aliados, rodada, rastro) fica
 * de fora: o avaliador diz "o mestre confere".
 */
export function contextoDaFicha(personagem: Personagem, custoEmSp: number): ContextoDosRequisitos {
  const { recursos, maximos } = personagem
  return {
    quemUsa: {
      tokenId: 'editor',
      nome: personagem.nome,
      sp: numeroDaFicha(recursos, 'sp'),
      vida: { atual: numeroDaFicha(recursos, 'hp'), max: maximos.hp ?? numeroDaFicha(recursos, 'hp') },
      escudo: numeroDaFicha(recursos, 'escudo'),
      acumuladores: acumuladoresDaFicha(personagem).map((acumulador) => ({ id: acumulador.id, nome: acumulador.nome, nivel: 0 })),
      carga: 0,
      reacaoLivre: true,
      ligadas: [],
      selos: [],
      formas: [],
    },
    custoEmSp,
  }
}
