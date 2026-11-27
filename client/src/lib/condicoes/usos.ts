import type { CarriedItem, CondicaoPropria, PecasDoEfeito, ValorDasPecas } from '../../types/map'
import { CONDICAO_DO_TIPO } from '../batalha/mecanica/golpe'
import { TIPOS_QUE_BATEM, TIPOS_QUE_CAUSAM } from '../batalha/mecanica/modelo'
import { NOME_DA_FADIGA } from '../batalha/mecanica/pecas'
import type { CondicaoNaFicha, GatilhoDaCondicao, PecaDoGatilho } from '../itens/modelo'
import type { ItemDoCatalogo, TipoDoCatalogo } from '../livros/catalogo'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { catalogoDeCondicoes, condicaoDoCatalogo, condicaoDoCatalogoPeloNome } from './catalogo'
import { condicaoDaFabricaDoSelo } from './fabrica'
import { chaveDaCondicao } from './modelo'

/**
 * QUEM PÕE OU CITA UMA CONDIÇÃO (rework das condições, docs/design/condicoes-rework/PLANO.md D5, etapa
 * E2): as fichas da pasta (os cartões, a mochila e o gatilho das condições postas), o catálogo do livro e
 * as outras condições. É o "Quem põe ou cita agora" da página, o "Apagar só sem uso" e o aviso de
 * renomear ("Renomear também nos N lugares", `renomear.ts`).
 *
 * O nome continua sendo a chave (D5): cada nome achado vale para a condição que a batalha acharia por
 * ele (`condicaoDoCatalogoPeloNome`, com a precedência do catálogo; o selo "Atordoado 2" acha o de
 * fábrica pela tolerância do nome do selo). A Aura e a Contra-condição apontam o id: contam como uso,
 * mas renomear não as muda.
 *
 * Um percurso só, para listar e para trocar (`nomesNaFicha`, `nomesNoItemDoCatalogo`, `nomesNaCriada`):
 * os lugares que guardam nome de condição, na forma em que o disco os guarda (a mecânica da técnica de
 * v1 a v5 e as peças do item são JSON): o selo dos Efeitos, o "Tira condições" pelo nome, o "só vale em
 * quem tem", a peça Condição e o "tira" do gatilho, a condição das peças v5 (Pergunta, Imbuir, Gatilho),
 * o Diminui e a Marca, a Fadiga da forma e o tipo do golpe (estes dois pela tabela do sistema).
 *
 * Puro: nada grava; sem mudança, volta a MESMA referência.
 *
 * API pública: `ComoUsaACondicao`, `PorQueNaoRenomeia`, `NomeAchado`, `AoAcharONome`, `LugarDoUso`,
 * `UsoDaCondicao`, `FontesDosUsos`, `nomesNaFicha`, `nomesNoItemDoCatalogo`, `nomesNaCriada`,
 * `resolvedorDeNomes`, `usosDaCondicao`, `textoDoUso`, `nomeDaCondicaoPosta`, `fichaTocaEmCondicao`.
 */

/** Como o lugar usa a condição: põe, tira, só vale em quem tem (`exige`), apaga (Contra-condição) ou põe pela aura. */
export type ComoUsaACondicao = 'poe' | 'tira' | 'exige' | 'apaga' | 'aura'

/**
 * Por que renomear não troca o nome naquele lugar: a tabela do sistema dá o nome (o tipo do golpe põe
 * Atordoado, a forma põe a Fadiga), o lugar aponta o id (Aura e Contra-condição seguem a condição
 * sozinhas), ou o lugar é uma condição de fábrica (não se edita).
 */
export type PorQueNaoRenomeia = 'tipoDoGolpe' | 'fadiga' | 'peloId' | 'deFabrica'

/** Um nome de condição achado num lugar. `fixo` = vem da tabela do sistema, não está gravado ali. */
export interface NomeAchado {
  nome: string
  como: 'poe' | 'tira' | 'exige'
  fixo?: 'tipoDoGolpe' | 'fadiga'
}

/** O que fazer com cada nome achado: o nome novo, ou `null` para deixar como está. */
export type AoAcharONome = (achado: NomeAchado, lugar: LugarDoUso) => string | null

/** Onde mora o uso. */
export type LugarDoUso =
  | { tipo: 'cartao'; personagemId: string; personagemNome: string; cartaoId: string; cartaoNome: string; proposta?: true }
  | { tipo: 'item'; personagemId: string; personagemNome: string; itemId: string; itemNome: string }
  | { tipo: 'posta'; personagemId: string; personagemNome: string; postaId: string; condId: string }
  | { tipo: 'catalogo'; itemId: string; itemNome: string; itemTipo: TipoDoCatalogo }
  | { tipo: 'condicao'; condicaoId: string; condicaoNome: string; criada: boolean }

/** Um lugar que põe ou cita a condição. Sem `naoRenomeia`, o nome está gravado ali e renomear o troca. */
export interface UsoDaCondicao {
  lugar: LugarDoUso
  como: ComoUsaACondicao
  naoRenomeia?: PorQueNaoRenomeia
}

/** De onde vêm os usos: as fichas da pasta, o catálogo do livro e as criadas (que também resolvem os nomes, D5). */
export interface FontesDosUsos {
  personagens?: readonly Personagem[]
  catalogo?: readonly ItemDoCatalogo[]
  criadas?: readonly CondicaoPropria[]
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function ehValorDasPecas(valor: unknown): valor is ValorDasPecas {
  if (valor === null || typeof valor === 'boolean' || typeof valor === 'number' || typeof valor === 'string') return true
  if (Array.isArray(valor)) return valor.every(ehValorDasPecas)
  return ehRegistro(valor) && Object.values(valor).every(ehValorDasPecas)
}

function ehPecasDoEfeito(valor: unknown): valor is PecasDoEfeito {
  return ehRegistro(valor) && Object.values(valor).every(ehValorDasPecas)
}

/** Os tipos do golpe (o `golpe` da mecânica v4: `{ tipo, regra }`). */
const TIPOS_DO_GOLPE: ReadonlySet<string> = new Set<string>([...TIPOS_QUE_BATEM, ...TIPOS_QUE_CAUSAM])

/** A condição que cada tipo do golpe põe, pelo id do tipo (o Outro guarda o nome na regra; o Perfurante não põe). */
const CONDICAO_DO_TIPO_POR_ID: ReadonlyMap<string, string> = new Map(Object.entries(CONDICAO_DO_TIPO))

/** O nome novo para o achado, se ele mudou; `null` = fica. */
type Troca = (achado: NomeAchado) => string | null

/**
 * Passa por um JSON guardado (a mecânica da técnica, as peças do item) e acha cada nome de condição
 * pela forma do lugar. Devolve o MESMO valor quando `trocar` não muda nada; senão, uma cópia só dos
 * galhos que mudaram.
 */
function percorrer(valor: unknown, trocar: Troca): unknown {
  if (Array.isArray(valor)) {
    let mudou = false
    const lista = valor.map((item: unknown) => {
      const novo = percorrer(item, trocar)
      if (novo !== item) mudou = true
      return novo
    })
    return mudou ? lista : valor
  }
  if (!ehRegistro(valor)) return valor
  let registro: Record<string, unknown> = valor
  const por = (chave: string, novo: unknown): void => {
    if (registro === valor) registro = { ...valor }
    registro[chave] = novo
  }
  const nomeNaChave = (chave: string, como: NomeAchado['como']): void => {
    const atual = valor[chave]
    if (typeof atual !== 'string') return
    const novo = trocar({ nome: atual, como })
    if (novo !== null && novo !== atual) por(chave, novo)
  }
  const tipo = valor.tipo
  // O selo dos Efeitos, a peça Condição do gatilho e do item, o Diminui e a Marca (v5): o `nome` é a condição.
  if (tipo === 'selo' || tipo === 'condicao' || tipo === 'diminui' || tipo === 'marca') nomeNaChave('nome', 'poe')
  if (tipo === 'tirar') nomeNaChave('nome', 'tira')
  // "Tira condições" pelo nome.
  const quais = valor.quais
  if (tipo === 'tirarSelos' && ehRegistro(quais) && Array.isArray(quais.nomes)) {
    let mudou = false
    const nomes = quais.nomes.map((nome: unknown) => {
      if (typeof nome !== 'string') return nome
      const novo = trocar({ nome, como: 'tira' })
      if (novo === null || novo === nome) return nome
      mudou = true
      return novo
    })
    if (mudou) por('quais', { ...quais, nomes })
  }
  // A forma deixa a Fadiga quando acaba (o nome é da fábrica).
  if (tipo === 'transformacao' && valor.fadiga === true) trocar({ nome: NOME_DA_FADIGA, como: 'poe', fixo: 'fadiga' })
  // O tipo do golpe (v4): a tabela dá a condição; só o Outro guarda o nome.
  const regra = valor.regra
  if (typeof tipo === 'string' && TIPOS_DO_GOLPE.has(tipo) && ehRegistro(regra)) {
    const daTabela = CONDICAO_DO_TIPO_POR_ID.get(tipo)
    if (tipo === 'outro' && typeof regra.nome === 'string') {
      const novo = trocar({ nome: regra.nome, como: 'poe' })
      if (novo !== null && novo !== regra.nome) por('regra', { ...regra, nome: novo })
    } else if (daTabela !== undefined) {
      trocar({ nome: daTabela, como: 'poe', fixo: 'tipoDoGolpe' })
    }
  }
  // "Só vale em quem tem este selo" (o alvo da mecânica).
  nomeNaChave('exigeSelo', 'exige')
  // A condição das peças v5 (`{ nome, turnos }`: a resposta da Pergunta, o elemento do Imbuir, o efeito do Gatilho).
  const condicao = valor.condicao
  if (ehRegistro(condicao) && typeof condicao.nome === 'string' && typeof condicao.turnos === 'number') {
    const novo = trocar({ nome: condicao.nome, como: 'poe' })
    if (novo !== null && novo !== condicao.nome) por('condicao', { ...condicao, nome: novo })
  }
  for (const [chave, filho] of Object.entries(registro)) {
    if (typeof filho !== 'object' || filho === null) continue
    const novo = percorrer(filho, trocar)
    if (novo !== filho) por(chave, novo)
  }
  return registro
}

/** A mecânica guardada com os nomes trocados (a MESMA sem troca). */
function mecanicaTrocada(mecanica: Readonly<Record<string, unknown>>, trocar: Troca): Readonly<Record<string, unknown>> {
  const nova = percorrer(mecanica, trocar)
  return ehRegistro(nova) ? nova : mecanica
}

/** As peças do item guardadas com os nomes trocados (as MESMAS sem troca). */
function pecasDoEfeitoTrocadas(pecas: PecasDoEfeito, trocar: Troca): PecasDoEfeito {
  const novas = percorrer(pecas, trocar)
  return novas !== pecas && ehPecasDoEfeito(novas) ? novas : pecas
}

/** O gatilho com os nomes da peça Condição e do "tira" trocados (o MESMO sem troca). */
function gatilhoTrocado(gatilho: GatilhoDaCondicao, trocar: Troca): GatilhoDaCondicao {
  let mudou = false
  const pecas = gatilho.pecas.map((peca): PecaDoGatilho => {
    if ((peca.tipo !== 'condicao' && peca.tipo !== 'tirar') || peca.nome === null) return peca
    const novo = trocar({ nome: peca.nome, como: peca.tipo === 'condicao' ? 'poe' : 'tira' })
    if (novo === null || novo === peca.nome) return peca
    mudou = true
    return { ...peca, nome: novo }
  })
  return mudou ? { ...gatilho, pecas } : gatilho
}

/** A lista com cada item passado por `trocar`; a MESMA lista quando nenhum mudou. */
function mapaSemCopia<T>(lista: readonly T[], trocar: (item: T) => T): T[] | null {
  let mudou = false
  const nova = lista.map((item) => {
    const novo = trocar(item)
    if (novo !== item) mudou = true
    return novo
  })
  return mudou ? nova : null
}

function nomeDaFicha(personagem: Personagem): string {
  return personagem.nome.trim() || 'Personagem sem nome'
}

function cartaoTrocado(cartao: CartaoDaFicha, personagem: Personagem, aoAchar: AoAcharONome): CartaoDaFicha {
  const lugar: LugarDoUso = { tipo: 'cartao', personagemId: personagem.id, personagemNome: nomeDaFicha(personagem), cartaoId: cartao.id, cartaoNome: cartao.nome.trim() || 'Cartão sem nome' }
  let novo = cartao
  if (cartao.mecanica !== undefined) {
    const mecanica = mecanicaTrocada(cartao.mecanica, (achado) => aoAchar(achado, lugar))
    if (mecanica !== cartao.mecanica) novo = { ...novo, mecanica }
  }
  if (cartao.mecanicaProposta !== undefined) {
    const daProposta: LugarDoUso = { ...lugar, proposta: true }
    const proposta = mecanicaTrocada(cartao.mecanicaProposta, (achado) => aoAchar(achado, daProposta))
    if (proposta !== cartao.mecanicaProposta) novo = { ...novo, mecanicaProposta: proposta }
  }
  const subcartoes = mapaSemCopia(cartao.subcartoes, (sub) => cartaoTrocado(sub, personagem, aoAchar))
  return subcartoes === null ? novo : { ...novo, subcartoes }
}

function itemTrocado(item: CarriedItem, personagem: Personagem, aoAchar: AoAcharONome): CarriedItem {
  const lugar: LugarDoUso = { tipo: 'item', personagemId: personagem.id, personagemNome: nomeDaFicha(personagem), itemId: item.id, itemNome: item.nome.trim() || 'Item sem nome' }
  const trocar: Troca = (achado) => aoAchar(achado, lugar)
  let novo = item
  if (item.efeito !== undefined) {
    const mecanica = pecasDoEfeitoTrocadas(item.efeito.mecanica, trocar)
    if (mecanica !== item.efeito.mecanica) novo = { ...novo, efeito: { ...item.efeito, mecanica } }
  }
  // Das peças guardadas do item, só o "Ao acertar" e o "Ao usar" põem condição.
  const regra = item.regra
  if (regra !== undefined) {
    const aoAcertar = regra.aoAcertar === undefined ? undefined : pecasDoEfeitoTrocadas(regra.aoAcertar, trocar)
    const aoUsar = regra.aoUsar === undefined ? undefined : pecasDoEfeitoTrocadas(regra.aoUsar, trocar)
    if (aoAcertar !== regra.aoAcertar || aoUsar !== regra.aoUsar) novo = { ...novo, regra: { ...regra, ...(aoAcertar === undefined ? {} : { aoAcertar }), ...(aoUsar === undefined ? {} : { aoUsar }) } }
  }
  return novo
}

function postaTrocada(posta: CondicaoNaFicha, personagem: Personagem, aoAchar: AoAcharONome): CondicaoNaFicha {
  if (posta.gatilho === undefined) return posta
  const lugar: LugarDoUso = { tipo: 'posta', personagemId: personagem.id, personagemNome: nomeDaFicha(personagem), postaId: posta.id, condId: posta.condId }
  const gatilho = gatilhoTrocado(posta.gatilho, (achado) => aoAchar(achado, lugar))
  return gatilho === posta.gatilho ? posta : { ...posta, gatilho }
}

/**
 * Todo lugar da ficha que guarda nome de condição: os cartões (a mecânica e a proposta, com os de
 * dentro), a mochila (o efeito de usar, o "Ao acertar" e o "Ao usar") e o gatilho das condições postas.
 * `aoAchar` devolve o nome novo, ou `null`. A MESMA ficha quando nada muda.
 */
export function nomesNaFicha(personagem: Personagem, aoAchar: AoAcharONome): Personagem {
  let nova = personagem
  let abas: Record<string, CartaoDaFicha[]> | null = null
  for (const [aba, cartoes] of Object.entries(personagem.abas)) {
    const trocados = mapaSemCopia(cartoes, (cartao) => cartaoTrocado(cartao, personagem, aoAchar))
    if (trocados === null) continue
    abas = { ...(abas ?? personagem.abas), [aba]: trocados }
  }
  if (abas !== null) nova = { ...nova, abas }
  const mochila = personagem.mochila === undefined ? null : mapaSemCopia(personagem.mochila, (item) => itemTrocado(item, personagem, aoAchar))
  if (mochila !== null) nova = { ...nova, mochila }
  const condicoes = personagem.condicoes === undefined ? null : mapaSemCopia(personagem.condicoes, (posta) => postaTrocada(posta, personagem, aoAchar))
  if (condicoes !== null) nova = { ...nova, condicoes }
  return nova
}

/** O item do catálogo do livro (a arma, a habilidade, o item): a mecânica guardada. O MESMO quando nada muda. */
export function nomesNoItemDoCatalogo(item: ItemDoCatalogo, aoAchar: AoAcharONome): ItemDoCatalogo {
  if (item.mecanica === undefined) return item
  const lugar: LugarDoUso = { tipo: 'catalogo', itemId: item.id, itemNome: item.nome.trim() || 'Sem nome', itemTipo: item.tipo }
  const mecanica = mecanicaTrocada(item.mecanica, (achado) => aoAchar(achado, lugar))
  return mecanica === item.mecanica ? item : { ...item, mecanica }
}

/**
 * A criada: os nomes que o gatilho guarda (o `gatilho` de antes e a peça Depois de X turnos). A Aura e a
 * Contra-condição apontam ids e não passam por aqui. A MESMA quando nada muda.
 */
export function nomesNaCriada(propria: CondicaoPropria, aoAchar: AoAcharONome): CondicaoPropria {
  const lugar: LugarDoUso = { tipo: 'condicao', condicaoId: propria.id, condicaoNome: propria.nome, criada: true }
  const trocar: Troca = (achado) => aoAchar(achado, lugar)
  let nova = propria
  if (propria.gatilho !== undefined) {
    const gatilho = gatilhoTrocado(propria.gatilho, trocar)
    if (gatilho !== propria.gatilho) nova = { ...nova, gatilho }
  }
  if (propria.pecas !== undefined) {
    const pecas = mapaSemCopia(propria.pecas, (peca) => {
      if (peca.tipo !== 'gatilho') return peca
      const gatilho = gatilhoTrocado(peca.gatilho, trocar)
      return gatilho === peca.gatilho ? peca : { ...peca, gatilho }
    })
    if (pecas !== null) nova = { ...nova, pecas }
  }
  return nova
}

/**
 * O id da condição que a batalha acharia por um nome (D5): pelo catálogo, com a precedência dele, e,
 * sem ele, a de fábrica pela tolerância do nome do selo ("Atordoado 2"). `null` = nenhuma (nome livre).
 */
export function resolvedorDeNomes(criadas: readonly CondicaoPropria[]): (nome: string) => string | null {
  const vistos = new Map<string, string | null>()
  return (nome) => {
    const chave = chaveDaCondicao(nome)
    const ja = vistos.get(chave)
    if (ja !== undefined) return ja
    const peloCatalogo = condicaoDoCatalogoPeloNome(nome, criadas)
    const id = peloCatalogo !== null ? peloCatalogo.id : (condicaoDaFabricaDoSelo(nome)?.id ?? null)
    vistos.set(chave, id)
    return id
  }
}

function chaveDoLugar(lugar: LugarDoUso): string {
  switch (lugar.tipo) {
    case 'cartao':
      return `cartao:${lugar.personagemId}:${lugar.cartaoId}:${lugar.proposta === true ? 'proposta' : ''}`
    case 'item':
      return `item:${lugar.personagemId}:${lugar.itemId}`
    case 'posta':
      return `posta:${lugar.personagemId}:${lugar.postaId}`
    case 'catalogo':
      return `catalogo:${lugar.itemId}`
    case 'condicao':
      return `condicao:${lugar.condicaoId}`
  }
}

/**
 * Os lugares que põem ou citam a condição, sem repetir (o mesmo lugar, do mesmo jeito, conta uma vez):
 * os das fichas, os do catálogo do livro, e as outras condições (de fábrica e criadas) que a apagam, a
 * põem pela aura, ou a põem ou tiram pelo gatilho.
 */
export function usosDaCondicao(condicao: Pick<CondicaoPropria, 'id' | 'nome'>, fontes: FontesDosUsos): UsoDaCondicao[] {
  const criadas = fontes.criadas ?? []
  const idDoNome = resolvedorDeNomes(criadas)
  const usos: UsoDaCondicao[] = []
  const vistos = new Set<string>()
  const anotar = (uso: UsoDaCondicao): void => {
    const chave = `${chaveDoLugar(uso.lugar)}:${uso.como}:${uso.naoRenomeia ?? ''}`
    if (vistos.has(chave)) return
    vistos.add(chave)
    usos.push(uso)
  }
  const aoAchar: AoAcharONome = (achado, lugar) => {
    if (idDoNome(achado.nome) !== condicao.id) return null
    const uso: UsoDaCondicao = { lugar, como: achado.como }
    if (achado.fixo !== undefined) uso.naoRenomeia = achado.fixo
    anotar(uso)
    return null
  }
  for (const personagem of fontes.personagens ?? []) nomesNaFicha(personagem, aoAchar)
  for (const item of fontes.catalogo ?? []) nomesNoItemDoCatalogo(item, aoAchar)
  for (const outra of catalogoDeCondicoes(criadas)) {
    if (outra.id === condicao.id) continue
    const lugar: LugarDoUso = { tipo: 'condicao', condicaoId: outra.id, condicaoNome: outra.nome, criada: outra.criada }
    for (const peca of outra.montada.pecas) {
      if (peca.tipo === 'contra' && peca.apaga.includes(condicao.id)) anotar({ lugar, como: 'apaga', naoRenomeia: 'peloId' })
      if (peca.tipo === 'aura' && peca.cond === condicao.id) anotar({ lugar, como: 'aura', naoRenomeia: 'peloId' })
      if (peca.tipo !== 'gatilho') continue
      gatilhoTrocado(peca.gatilho, (achado) => {
        if (idDoNome(achado.nome) !== condicao.id) return null
        const uso: UsoDaCondicao = { lugar, como: achado.como }
        if (!outra.criada) uso.naoRenomeia = 'deFabrica'
        anotar(uso)
        return null
      })
    }
  }
  return usos
}

const ROTULO_DO_TIPO_DO_CATALOGO: Readonly<Record<TipoDoCatalogo, string>> = { arma: 'arma', habilidade: 'habilidade', item: 'item' }

/** O jeito de usar, na frase de uma outra condição ("Molhado (apaga)"). */
const COMO_NA_OUTRA_CONDICAO: Readonly<Record<ComoUsaACondicao, string>> = {
  poe: 'põe pelo gatilho',
  tira: 'tira pelo gatilho',
  exige: 'só vale em quem tem',
  apaga: 'apaga',
  aura: 'põe pela aura',
}

/** O que vem depois do lugar na frase: como usa (quando não é pôr) e de onde vem o nome fixo. */
function complementoDoUso(uso: UsoDaCondicao): string {
  const partes: string[] = []
  if (uso.como === 'tira') partes.push('tira')
  if (uso.como === 'exige') partes.push('só vale em quem tem')
  if (uso.naoRenomeia === 'tipoDoGolpe') partes.push('pelo tipo do golpe')
  if (uso.naoRenomeia === 'fadiga') partes.push('a Fadiga da forma')
  return partes.length === 0 ? '' : ` (${partes.join(', ')})`
}

/**
 * O uso em frase, para a lista "Quem põe ou cita agora" ("Rajada de Fogo, na ficha de Aira"; "Molhado
 * (apaga)"). `nomeDaCondicao` dá o nome da condição posta numa ficha (o gatilho dela cita esta).
 */
export function textoDoUso(uso: UsoDaCondicao, nomeDaCondicao: (condId: string) => string | null = () => null): string {
  const { lugar } = uso
  switch (lugar.tipo) {
    case 'cartao':
      return `${lugar.cartaoNome}, na ficha de ${lugar.personagemNome}${lugar.proposta === true ? ' (proposta)' : ''}${complementoDoUso(uso)}`
    case 'item':
      return `${lugar.itemNome}, item de ${lugar.personagemNome}${complementoDoUso(uso)}`
    case 'posta':
      return `o gatilho de ${nomeDaCondicao(lugar.condId) ?? 'uma condição'}, em ${lugar.personagemNome}${complementoDoUso(uso)}`
    case 'catalogo':
      return `${lugar.itemNome}, ${ROTULO_DO_TIPO_DO_CATALOGO[lugar.itemTipo]} do livro${complementoDoUso(uso)}`
    case 'condicao':
      return `${lugar.condicaoNome} (${COMO_NA_OUTRA_CONDICAO[uso.como]})`
  }
}

/** O nome da condição posta, pelo catálogo (as de fábrica e as `criadas`): o `nomeDaCondicao` de `textoDoUso`. */
export function nomeDaCondicaoPosta(criadas: readonly CondicaoPropria[]): (condId: string) => string | null {
  return (condId) => condicaoDoCatalogo(condId, criadas)?.nome ?? null
}

/** A ficha tem condição posta, ou algum cartão ou item que põe ou cita condição? (o que faz valer a cópia do arquivo das fichas). */
export function fichaTocaEmCondicao(personagem: Personagem): boolean {
  if (personagem.condicoes !== undefined && personagem.condicoes.length > 0) return true
  let achou = false
  nomesNaFicha(personagem, () => {
    achou = true
    return null
  })
  return achou
}
