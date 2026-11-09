import type { CarriedItem } from '../../types/map'
import { lerFichaDBT } from '../dbt/modelo'
import { ITEM_QUANTIDADE_MAX, quantidadeDe } from '../items'
import type { CampoDaFichaDBT, CartaoDaFicha, Personagem } from '../personagem'
import { MOEDAS_MAX } from '../troca'
import {
  chaveDaEtiqueta,
  itemPeloLeitor,
  lerMudanca,
  TETOS_DO_CAMINHO,
  type CampoDeOculta,
  type CampoDoMestre,
  type MudancaLida,
  type MudancaNoCartao,
} from './caminho'
import { bytesDoJson, jsonIgual, paraJson, proprio, type Json } from './json'
import type { MotivoDaRecusa, Mudanca } from './tipos'

/**
 * APLICAR (docs/planos/lobby-jogadores-2026-11-05.md §4.7, §5.1): põe uma
 * mudança pequena na ficha. A MESMA função roda no app, no site e no
 * servidor, então os três chegam à mesma ficha a partir das mesmas ops.
 *
 * Nunca muda a ficha recebida: devolve uma nova, copiando só o caminho
 * tocado (o resto é compartilhado, como no store). Toda mudança passa antes
 * pelo esquema (`lerMudanca`). Op que não entra volta como recusa com motivo:
 * nada some em silêncio.
 *
 * Criar o que já existe e apagar o que já foi tirado dão `semEfeito` (o eco
 * da própria op, "já foi tirado"). `somar` não é idempotente: quem reaplica
 * ops (fila, diário) tem de pular as já aplicadas pela rev ou pelo `opId`.
 */

export interface Aplicada {
  ok: true
  doc: Personagem | null
  /** O valor no caminho antes; ausente = o campo não existia. Vira `OpGravada.antes`. */
  antes?: Json
  /** O valor no caminho depois (com o teto já aplicado na soma). */
  depois?: Json
  /** Nada mudou: criar o que já existe, apagar o que não existe mais. */
  semEfeito?: true
  /** O que aconteceu de fato, quando não é o pedido: criar item empilhável que somou na vaga que já existia. */
  efetiva?: Mudanca
}

export interface RecusaDaAplicacao {
  ok: false
  motivo: MotivoDaRecusa
  detalhe: string
}

export type ResultadoDaAplicacao = Aplicada | RecusaDaAplicacao

export interface RecusaNoLote {
  mudanca: Mudanca
  motivo: MotivoDaRecusa
  detalhe: string
}

export interface ResultadoDoLote {
  doc: Personagem | null
  /** Na ordem em que chegaram; vazia = tudo entrou. */
  recusadas: RecusaNoLote[]
}

/** Um passo dentro da ficha: o pedaço novo e o valor (do app) no caminho antes e depois. */
type Passo<T> = { ok: true; novo: T; antes?: unknown; depois?: unknown; semEfeito?: true; efetiva?: Mudanca } | RecusaDaAplicacao

function recusar(motivo: MotivoDaRecusa, detalhe: string): RecusaDaAplicacao {
  return { ok: false, motivo, detalhe }
}

function inexistente(detalhe: string): RecusaDaAplicacao {
  return recusar('alvo-inexistente', detalhe)
}

function semEfeito<T>(novo: T, atual: unknown): Passo<T> {
  return { ok: true, novo, antes: atual, depois: atual, semEfeito: true }
}

/**
 * Aplica as mudanças em ordem; a recusada não para as outras (campo diferente
 * nunca é derrubado por outro, §5.2). A exceção são as `atomico` seguidas:
 * tudo ou nada — a ficha trocada inteira (apagar + criar) nunca fica só
 * apagada porque o criar não entrou.
 */
export function aplicar(doc: Personagem | null, mudancas: readonly Mudanca[]): ResultadoDoLote {
  let atual = doc
  const recusadas: RecusaNoLote[] = []
  for (const grupo of emGrupos(mudancas)) {
    const resultado = aplicarGrupo(atual, grupo)
    atual = resultado.doc
    recusadas.push(...resultado.recusadas)
  }
  return { doc: atual, recusadas }
}

/** Cada mudança solta é um grupo; as `atomico` seguidas formam um grupo só. */
function emGrupos(mudancas: readonly Mudanca[]): Mudanca[][] {
  const grupos: Mudanca[][] = []
  let anteriorAtomica = false
  for (const mudanca of mudancas) {
    const atomica = mudanca.atomico === true
    const ultimo = grupos.at(-1)
    if (atomica && anteriorAtomica && ultimo !== undefined) ultimo.push(mudanca)
    else grupos.push([mudanca])
    anteriorAtomica = atomica
  }
  return grupos
}

/** O grupo inteiro ou nada dele: na primeira recusa, a ficha volta à de antes do grupo e todas as mudanças dele voltam recusadas. */
function aplicarGrupo(doc: Personagem | null, grupo: readonly Mudanca[]): ResultadoDoLote {
  let atual = doc
  for (const mudanca of grupo) {
    const resultado = aplicarOp(atual, mudanca)
    if (!resultado.ok) {
      const { motivo, detalhe } = resultado
      const junto = `Vai junto com outra mudança recusada: ${detalhe}`
      return { doc, recusadas: grupo.map((outra) => ({ mudanca: outra, motivo, detalhe: outra === mudanca ? detalhe : junto })) }
    }
    atual = resultado.doc
  }
  return { doc: atual, recusadas: [] }
}

export function aplicarOp(doc: Personagem | null, mudanca: Mudanca): ResultadoDaAplicacao {
  // `lerMudanca` confere a forma também: o que veio do fio sem respeitar o tipo vira recusa, não erro.
  const leitura = lerMudanca(mudanca)
  if (!leitura.ok) return leitura
  const { lida } = leitura
  const fichaId = leitura.mudanca.fichaId
  if (lida.regra === 'ficha') return finalizado(naFichaInteira(doc, fichaId, lida))
  if (doc === null) return inexistente('A ficha não existe (foi apagada?)')
  if (doc.id !== fichaId) return inexistente('A op é de outra ficha')
  const passo = naFicha(doc, lida, fichaId)
  if (passo.ok && passo.semEfeito !== true && bytesDoJson(passo.novo) > TETOS_DO_CAMINHO.docBytes) {
    return recusar('doc-grande', 'Ficha grande demais: máximo 256 KiB')
  }
  return finalizado(passo)
}

function finalizado(passo: Passo<Personagem | null>): ResultadoDaAplicacao {
  if (!passo.ok) return passo
  const aplicada: Aplicada = { ok: true, doc: passo.novo }
  if (passo.antes !== undefined) aplicada.antes = paraJson(passo.antes)
  if (passo.depois !== undefined) aplicada.depois = paraJson(passo.depois)
  if (passo.semEfeito === true) aplicada.semEfeito = true
  if (passo.efetiva !== undefined) aplicada.efetiva = passo.efetiva
  return aplicada
}

function naFichaInteira(doc: Personagem | null, fichaId: string, lida: Extract<MudancaLida, { regra: 'ficha' }>): Passo<Personagem | null> {
  if (doc !== null && doc.id !== fichaId) return inexistente('A op é de outra ficha')
  if (lida.acao === 'criar') return doc === null ? { ok: true, novo: lida.doc, depois: lida.doc } : semEfeito(doc, doc)
  return doc === null ? semEfeito(null, undefined) : { ok: true, novo: null, antes: doc }
}

/** Registro com a chave trocada; valor ausente tira a chave. Nunca muda o registro recebido. */
function comChave<T>(registro: Readonly<Record<string, T>>, chave: string, valor: T | undefined): Record<string, T> {
  if (valor !== undefined) return { ...registro, [chave]: valor }
  return Object.fromEntries(Object.entries(registro).filter(([outra]) => outra !== chave))
}

type CampoOpcional = 'mochila' | 'moedas' | 'ocultas' | CampoDoMestre

/** Ficha com o campo opcional trocado; ausente tira a chave (nada de `campo: undefined` gravado no disco). */
function comOpcional<K extends CampoOpcional>(doc: Personagem, campo: K, valor: Personagem[K] | undefined): Personagem {
  const copia: Personagem = { ...doc }
  if (valor === undefined) delete copia[campo]
  else copia[campo] = valor
  return copia
}

function naFicha(doc: Personagem, lida: Exclude<MudancaLida, { regra: 'ficha' }>, fichaId: string): Passo<Personagem> {
  switch (lida.regra) {
    case 'texto': {
      const novo = lida.campo === 'nome' ? { ...doc, nome: lida.valor } : { ...doc, descricao: lida.valor }
      return { ok: true, novo, antes: doc[lida.campo], depois: lida.valor }
    }
    case 'retrato':
      return { ok: true, novo: { ...doc, retrato: lida.valor }, antes: doc.retrato, depois: lida.valor }
    case 'etiqueta':
      return naEtiqueta(doc, lida)
    case 'escolha':
      return { ok: true, novo: { ...doc, escolhas: comChave(doc.escolhas, lida.chave, lida.valor) }, antes: proprio(doc.escolhas, lida.chave), depois: lida.valor }
    case 'numero':
      return {
        ok: true,
        novo: { ...doc, [lida.mapa]: comChave(doc[lida.mapa], lida.chave, lida.valor) },
        antes: proprio(doc[lida.mapa], lida.chave),
        depois: lida.valor,
      }
    case 'cartaoAtivo': {
      const ligado = doc.cartoesAtivos.includes(lida.cartaoId)
      const outros = doc.cartoesAtivos.filter((id) => id !== lida.cartaoId)
      const cartoesAtivos = lida.valor ? (ligado ? doc.cartoesAtivos : [...doc.cartoesAtivos, lida.cartaoId]) : outros
      return { ok: true, novo: { ...doc, cartoesAtivos }, antes: ligado, depois: lida.valor }
    }
    case 'cartao':
    case 'ordemDosCartoes':
    case 'campoDoCartao':
    case 'imagemDoCartao':
    case 'mecanicaDoCartao':
    case 'ocultaDoCartao':
    case 'textoDoCartao':
      return nasAbas(doc, lida)
    case 'vaga':
    case 'quantidade':
    case 'campoDoItem':
      return naMochila(doc, lida, fichaId)
    case 'moedas':
      return nasMoedas(doc, lida)
    case 'dbt':
      return noDbt(doc, lida.campo, lida.valor)
    case 'doMestre':
      return { ok: true, novo: comOpcional(doc, lida.mudar.campo, lida.mudar.valor), antes: doc[lida.mudar.campo], depois: lida.mudar.valor }
    case 'ocultas':
      return { ok: true, novo: comOpcional(doc, 'ocultas', lida.valor), antes: doc.ocultas, depois: lida.valor }
  }
}

function naEtiqueta(doc: Personagem, lida: Extract<MudancaLida, { regra: 'etiqueta' }>): Passo<Personagem> {
  const chave = lida.chave
  const iguais = doc.etiquetas.filter((etiqueta) => chaveDaEtiqueta(etiqueta) === chave)
  if (lida.acao === 'criar') {
    if (iguais.length > 0) return semEfeito(doc, iguais[0])
    if (doc.etiquetas.length >= TETOS_DO_CAMINHO.etiquetas) return recusar('acima-do-teto', `Etiquetas demais: máximo ${TETOS_DO_CAMINHO.etiquetas}`)
    return { ok: true, novo: { ...doc, etiquetas: [...doc.etiquetas, lida.texto] }, depois: lida.texto }
  }
  if (iguais.length === 0) return semEfeito(doc, undefined)
  return { ok: true, novo: { ...doc, etiquetas: doc.etiquetas.filter((etiqueta) => chaveDaEtiqueta(etiqueta) !== chave) }, antes: iguais[0] }
}

// ── Cartões (abas e subcartões) ─────────────────────────────────────────────

type MudancaNasAbas = Extract<MudancaLida, { aba: string }>

function nasAbas(doc: Personagem, lida: MudancaNasAbas): Passo<Personagem> {
  // Aba que a ficha ainda não tem é lista vazia (como `cartoesDaAba`): criar abre a aba, o resto não acha o cartão.
  const lista = proprio(doc.abas, lida.aba) ?? []
  const passo = mudarLista(lista, lida)
  if (!passo.ok) return passo
  if (passo.semEfeito === true) return { ...passo, novo: doc }
  return { ...passo, novo: { ...doc, abas: { ...doc.abas, [lida.aba]: passo.novo } } }
}

function donoDa(trilha: readonly string[]): string[] {
  return trilha.slice(0, -1)
}

function alvoDa(trilha: readonly string[]): string {
  return trilha[trilha.length - 1]
}

function mudarLista(lista: CartaoDaFicha[], lida: MudancaNasAbas): Passo<CartaoDaFicha[]> {
  switch (lida.regra) {
    case 'cartao': {
      if (lida.acao === 'apagar') {
        const id = alvoDa(lida.trilha)
        return naListaDona(lista, donoDa(lida.trilha), (cartoes) => apagarCartao(cartoes, id))
      }
      const cartao = lida.cartao
      return naListaDona(lista, donoDa(lida.trilha), (cartoes) => criarCartao(cartoes, cartao))
    }
    case 'ordemDosCartoes': {
      const ids = lida.ids
      return naListaDona(lista, lida.trilha, (cartoes) => ordenarCartoes(cartoes, ids))
    }
    case 'campoDoCartao': {
      const mudar = lida.mudar
      return noCartao(lista, lida.trilha, (cartao) => mudarCampoDoCartao(cartao, mudar))
    }
    case 'imagemDoCartao': {
      const imagem = lida.valor
      return noCartao(lista, lida.trilha, (cartao) => ({ ok: true, novo: { ...cartao, imagem }, antes: cartao.imagem, depois: imagem }))
    }
    case 'mecanicaDoCartao': {
      const mecanica = lida.valor
      return noCartao(lista, lida.trilha, (cartao) => {
        // Sem valor, a chave sai (o cartão volta ao texto), como o leitor do disco guarda.
        const { mecanica: antes, ...semMecanica } = cartao
        return { ok: true, novo: mecanica === undefined ? semMecanica : { ...semMecanica, mecanica }, antes, depois: mecanica }
      })
    }
    case 'ocultaDoCartao': {
      const { campo, valor } = lida
      return noCartao(lista, lida.trilha, (cartao) => ({ ok: true, novo: comMarcaDeOculta(cartao, campo, valor), antes: cartao[campo], depois: valor }))
    }
    case 'textoDoCartao': {
      const { campoId, valor } = lida
      return noCartao(lista, lida.trilha, (cartao) => ({
        ok: true,
        novo: { ...cartao, campos: comChave(cartao.campos, campoId, valor) },
        antes: proprio(cartao.campos, campoId),
        depois: valor,
      }))
    }
  }
}

/** O cartão com a marca de oculta trocada (fatia C7); sem valor, a chave sai, como o leitor do disco guarda. */
function comMarcaDeOculta(cartao: CartaoDaFicha, campo: CampoDeOculta, valor: true | undefined): CartaoDaFicha {
  const copia: CartaoDaFicha = { ...cartao }
  if (valor === undefined) delete copia[campo]
  else copia[campo] = valor
  return copia
}

/** Desce pelos subcartões até a lista dona (`dono` vazio = a lista de cima) e a troca pelo que `mudar` devolver. */
function naListaDona(lista: CartaoDaFicha[], dono: readonly string[], mudar: (cartoes: CartaoDaFicha[]) => Passo<CartaoDaFicha[]>): Passo<CartaoDaFicha[]> {
  if (dono.length === 0) return mudar(lista)
  const [primeiro, ...resto] = dono
  const indice = lista.findIndex((cartao) => cartao.id === primeiro)
  if (indice < 0) return inexistente('O cartão não existe mais')
  const pai = lista[indice]
  const passo = naListaDona(pai.subcartoes, resto, mudar)
  if (!passo.ok) return passo
  if (passo.semEfeito === true) return { ...passo, novo: lista }
  const subcartoes = passo.novo
  return { ...passo, novo: lista.map((cartao, i) => (i === indice ? { ...pai, subcartoes } : cartao)) }
}

function noCartao(lista: CartaoDaFicha[], trilha: readonly string[], mudar: (cartao: CartaoDaFicha) => Passo<CartaoDaFicha>): Passo<CartaoDaFicha[]> {
  const id = alvoDa(trilha)
  return naListaDona(lista, donoDa(trilha), (cartoes) => {
    const indice = cartoes.findIndex((cartao) => cartao.id === id)
    if (indice < 0) return inexistente('O cartão não existe mais')
    const passo = mudar(cartoes[indice])
    if (!passo.ok) return passo
    const novo = passo.novo
    return { ...passo, novo: cartoes.map((cartao, i) => (i === indice ? novo : cartao)) }
  })
}

function criarCartao(cartoes: CartaoDaFicha[], cartao: CartaoDaFicha): Passo<CartaoDaFicha[]> {
  const existente = cartoes.find((outro) => outro.id === cartao.id)
  if (existente !== undefined) return semEfeito(cartoes, existente)
  // Entra no fim; quem quer outra posição manda o `ordenar` junto (`diferencas` faz isso).
  return { ok: true, novo: [...cartoes, cartao], depois: cartao }
}

function apagarCartao(cartoes: CartaoDaFicha[], id: string): Passo<CartaoDaFicha[]> {
  const existente = cartoes.find((cartao) => cartao.id === id)
  if (existente === undefined) return semEfeito(cartoes, undefined)
  return { ok: true, novo: cartoes.filter((cartao) => cartao.id !== id), antes: existente }
}

/**
 * Ordem pedida, tolerante ao que mudou no meio: id que não existe mais é
 * pulado, e cartão criado por outro (fora da lista pedida) fica no fim, na
 * ordem em que já estava. Ninguém some por causa de uma reordenação.
 */
function ordenarCartoes(cartoes: CartaoDaFicha[], ids: readonly string[]): Passo<CartaoDaFicha[]> {
  const porId = new Map(cartoes.map((cartao): [string, CartaoDaFicha] => [cartao.id, cartao]))
  const pedidos = ids.flatMap((id) => {
    const cartao = porId.get(id)
    return cartao === undefined ? [] : [cartao]
  })
  const citados = new Set(ids)
  const novo = [...pedidos, ...cartoes.filter((cartao) => !citados.has(cartao.id))]
  return { ok: true, novo, antes: cartoes.map((cartao) => cartao.id), depois: novo.map((cartao) => cartao.id) }
}

function mudarCampoDoCartao(cartao: CartaoDaFicha, mudar: MudancaNoCartao): Passo<CartaoDaFicha> {
  switch (mudar.campo) {
    case 'nome':
      return { ok: true, novo: { ...cartao, nome: mudar.valor }, antes: cartao.nome, depois: mudar.valor }
    case 'aMao': {
      const { aMao: _antigo, ...semAMao } = cartao
      return { ok: true, novo: mudar.valor === true ? { ...semAMao, aMao: true } : semAMao, antes: cartao.aMao, depois: mudar.valor }
    }
    case 'extras':
      return { ok: true, novo: { ...cartao, extras: mudar.valor }, antes: cartao.extras, depois: mudar.valor }
    case 'modificadores':
      return { ok: true, novo: { ...cartao, modificadores: mudar.valor }, antes: cartao.modificadores, depois: mudar.valor }
    case 'atributos':
      return { ok: true, novo: { ...cartao, atributos: mudar.valor }, antes: cartao.atributos, depois: mudar.valor }
    case 'mecanicaProposta': {
      const { mecanicaProposta: antes, ...semProposta } = cartao
      return { ok: true, novo: mudar.valor === undefined ? semProposta : { ...semProposta, mecanicaProposta: mudar.valor }, antes, depois: mudar.valor }
    }
  }
}

// ── Mochila e moedas ────────────────────────────────────────────────────────

type MudancaNaMochila = Extract<MudancaLida, { regra: 'vaga' | 'quantidade' | 'campoDoItem' }>

function naMochila(doc: Personagem, lida: MudancaNaMochila, fichaId: string): Passo<Personagem> {
  // Ausente = mochila vazia (`Personagem.mochila`); vazia de novo, a chave sai (como o leitor do disco faz).
  const mochila = doc.mochila ?? []
  const passo = mudarMochila(mochila, lida, fichaId)
  if (!passo.ok) return passo
  if (passo.semEfeito === true) return { ...passo, novo: doc }
  return { ...passo, novo: comOpcional(doc, 'mochila', passo.novo.length === 0 ? undefined : passo.novo) }
}

function trocarVaga(mochila: CarriedItem[], nova: CarriedItem): CarriedItem[] {
  return mochila.map((vaga) => (vaga.id === nova.id ? nova : vaga))
}

/** A vaga com a quantidade; 1 não é gravado (é o ausente, como no leitor do disco). */
function comQuantidade(vaga: CarriedItem, quantidade: number): CarriedItem {
  const { quantidade: _antiga, ...semQuantidade } = vaga
  return quantidade === 1 ? semQuantidade : { ...semQuantidade, quantidade }
}

function somarNaVaga(mochila: CarriedItem[], vaga: CarriedItem, delta: number): Passo<CarriedItem[]> {
  const soma = quantidadeDe(vaga) + delta
  if (soma < 1) return recusar('acima-do-teto', `Só há ${quantidadeDe(vaga)} na mochila`)
  const nova = comQuantidade(vaga, Math.min(soma, ITEM_QUANTIDADE_MAX))
  return { ok: true, novo: trocarVaga(mochila, nova), antes: vaga.quantidade, depois: nova.quantidade }
}

function mudarMochila(mochila: CarriedItem[], lida: MudancaNaMochila, fichaId: string): Passo<CarriedItem[]> {
  if (lida.regra === 'vaga') {
    if (lida.acao === 'criar') return criarItem(mochila, lida.item, fichaId)
    const vagaId = lida.vagaId
    const tirada = mochila.find((item) => item.id === vagaId)
    return tirada === undefined ? semEfeito(mochila, undefined) : { ok: true, novo: mochila.filter((item) => item.id !== vagaId), antes: tirada }
  }
  const vagaId = lida.vagaId
  const vaga = mochila.find((item) => item.id === vagaId)
  if (vaga === undefined) return inexistente('Esse item já foi tirado da mochila')
  if (lida.regra === 'quantidade') {
    if (lida.acao === 'somar') return somarNaVaga(mochila, vaga, lida.delta)
    const nova = comQuantidade(vaga, lida.valor)
    return { ok: true, novo: trocarVaga(mochila, nova), antes: vaga.quantidade, depois: nova.quantidade }
  }
  return mudarCampoDoItem(mochila, vaga, lida.campo, lida.valor)
}

/**
 * Item novo na mochila. Empilhável com o mesmo `itemId` já presente vira
 * soma na vaga que existe (a regra do "Dar a…", `darDoAcervoChange`), e a
 * resposta diz isso em `efetiva` — é ela que entra no histórico e no desfazer.
 * O `delta` de `efetiva` é o que entrou de fato, depois do teto da pilha
 * (9990 + 20 grava +9), para o histórico mostrar o que mudou e a volta
 * (`somar -delta`) deixar a pilha no valor de antes.
 */
function criarItem(mochila: CarriedItem[], item: CarriedItem, fichaId: string): Passo<CarriedItem[]> {
  const existente = mochila.find((vaga) => vaga.id === item.id)
  if (existente !== undefined) return semEfeito(mochila, existente)
  const pilha = item.empilhavel === true && item.itemId !== undefined ? mochila.find((vaga) => vaga.itemId === item.itemId) : undefined
  if (pilha === undefined) return { ok: true, novo: [...mochila, item], depois: item }
  const antes = quantidadeDe(pilha)
  const pedido = quantidadeDe(item)
  const passo = somarNaVaga(mochila, pilha, pedido)
  if (!passo.ok) return passo
  const entrou = Math.min(antes + pedido, ITEM_QUANTIDADE_MAX) - antes
  return { ...passo, efetiva: { fichaId, caminho: ['mochila', pilha.id, 'quantidade'], acao: 'somar', delta: entrou } }
}

function mudarCampoDoItem(mochila: CarriedItem[], vaga: CarriedItem, campo: string, valor: Json | undefined): Passo<CarriedItem[]> {
  const candidato = comChave<unknown>({ ...vaga }, campo, valor)
  const lido = itemPeloLeitor(candidato)
  // O leitor da mochila é o juiz da vaga inteira: o que ele não guardaria igual não entra.
  if (lido === null || !jsonIgual(lido, candidato)) return recusar('fora-do-esquema', 'Valor fora do formato do item')
  return { ok: true, novo: trocarVaga(mochila, lido), antes: proprio<unknown>({ ...vaga }, campo), depois: valor }
}

function nasMoedas(doc: Personagem, lida: Extract<MudancaLida, { regra: 'moedas' }>): Passo<Personagem> {
  // Ausente = zero (`Personagem.moedas`); zero de novo, a chave sai.
  const atual = doc.moedas ?? 0
  let nova = 0
  if (lida.acao === 'somar') {
    const soma = atual + lida.delta
    if (soma < 0) return recusar('acima-do-teto', `Só há ${atual} moedas`)
    nova = Math.min(soma, MOEDAS_MAX)
  } else {
    nova = lida.valor
  }
  const moedas = nova === 0 ? undefined : nova
  return { ok: true, novo: comOpcional(doc, 'moedas', moedas), antes: doc.moedas, depois: moedas }
}

// ── Dragon Ball ─────────────────────────────────────────────────────────────

/**
 * Campo de topo da ficha Dragon Ball. O leitor dela (`lerFichaDBT`) é o juiz:
 * o valor tem de sair dele igual. A ficha inteira passa pelo leitor (como em
 * `aplicarCamposDBT`), então a transformação ligada que sumiu volta ao normal.
 */
function noDbt(doc: Personagem, campo: CampoDaFichaDBT, valor: Json | undefined): Passo<Personagem> {
  const atual = doc.dbt
  if (atual === undefined) return inexistente('A ficha não é de Dragon Ball')
  const copia: Record<string, unknown> = { ...atual }
  const lida = lerFichaDBT(comChave<unknown>(copia, campo, valor))
  if (lida === null || !jsonIgual(lida[campo], valor)) return recusar('fora-do-esquema', 'Valor fora do formato da ficha Dragon Ball')
  return { ok: true, novo: { ...doc, dbt: lida }, antes: atual[campo], depois: lida[campo] }
}
