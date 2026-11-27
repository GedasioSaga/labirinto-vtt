import { acumuladoresNaFicha } from '../../../../components/batalha/acumulador/acumuladoresDaFicha'
import { ENTRADA_TEXTO_MAX, type ItemDoCatalogo } from '../../../livros/catalogo'
import { NOME_DO_TEXTO_DE_ANTES, novoCartao, novoPersonagem, type CartaoDaFicha, type Personagem } from '../../../personagem'
import type { SistemaDeRpg } from '../../../sistemaDeRpg'
import { lerContador } from '../../contador'
import { ABA_DAS_TECNICAS } from '../../leituraDaFicha'
import { temLinhaNaTabela } from '../../mecanicasAMao'
import { acumuladorParaGuardar } from '../../requisitos/ler'
import { lerTipo } from '../../tiposDaHabilidade'
import { camposDoTextoDeAntes, camposGeradosDaAba } from '../textoGerado'
import {
  CAMPO_DA_DESCRICAO,
  comConfira,
  linhasDoConfira,
  type ContextoDaConversao,
  type OpcoesDaConversao,
  type RelatorioDaFicha,
  type RelatorioDoCartao,
} from './comum'
import { converterForma, converterPassiva } from './passivaEForma'
import { converterTecnica } from './tecnica'

/**
 * CONVERSÃO DAS HABILIDADES ANTIGAS NA LEITURA (rework do editor de habilidades, E2; PLANO.md D11).
 * Pura e idempotente: roda na lista e no editor, não grava nada (grava quando o mestre salva, ou o
 * dono, como proposta). A segunda passada devolve a MESMA referência (o cartão convertido já tem
 * `mecanica` ou `acumulador`, e o que ficou no texto volta igual).
 *
 * Fica intocado, com os subcartões: o cartão montado (qualquer versão, também a de app mais novo), o
 * da tabela à mão e a cópia dele (`temLinhaNaTabela`: a regra à mão continua valendo), o golpe à mão
 * de propósito e o que tem proposta do dono esperando. O sem texto nenhum também fica (só os
 * subcartões dele podem converter). Só as abas Habilidades e as que ligam (Transformações, e os
 * subcartões dela como técnicas); Perícias, Vantagens, Desvantagens, armas e itens não mudam (D17).
 *
 * Nenhum texto some: depois de converter, todo campo de antes está no cartão, no extra "Texto de
 * antes" (`montarCartao`) ou na Descrição; senão, o cartão fica no texto. O que o leitor não entendeu
 * vira uma linha "Confira: ..." no fim da Descrição (`comum.ts`), e é por ela que a lista mostra
 * "Convertida: confira" (nenhuma marca nova).
 *
 * API pública: `converterCartao`, `converterFicha`, `converterFichas`, `converterItemDoCatalogo`,
 * `converterCatalogo` e o tipo `FichaConvertida`.
 */

/** Onde o cartão mora: técnica (aba Habilidades ou subcartão da forma) ou forma (aba que liga). */
type OndeMora = 'tecnica' | 'forma'

/** O cartão que ninguém reconverte, com a frase do relatório; `null` = segue para a conversão. `porque: null` = não vai ao relatório (o normal). */
function foraDaConversao(cartao: CartaoDaFicha, onde: OndeMora, ctx: ContextoDaConversao): { porque: string | null; intocado: boolean } | null {
  if (cartao.mecanica !== undefined) return { porque: null, intocado: true }
  if (temLinhaNaTabela(cartao.id)) return { porque: 'regra escrita à mão: continua valendo (monte em peças quando quiser)', intocado: true }
  if (cartao.aMao === true) return { porque: 'golpe à mão de propósito: o número segue digitado na batalha', intocado: true }
  if (cartao.mecanicaProposta !== undefined) return { porque: 'proposta do dono esperando o mestre', intocado: true }
  // Sem texto: nada a converter nele, mas os subcartões (as técnicas da forma) ainda podem ter.
  return temTexto(cartao, onde, ctx.sistema) ? null : { porque: null, intocado: false }
}

/** "-" é o "sem" das fichas: conta como vazio. */
function escrito(valor: string | undefined): boolean {
  return (valor ?? '').trim().replace(/^-$/, '') !== ''
}

/** O cartão diz alguma coisa para converter: a técnica, um campo que a batalha lê (fora o Tipo); a forma, qualquer campo fora a Descrição, ou modificadores. */
function temTexto(cartao: CartaoDaFicha, onde: OndeMora, sistema: SistemaDeRpg): boolean {
  if (onde === 'forma') return cartao.modificadores.length > 0 || Object.entries(cartao.campos).some(([campo, valor]) => campo !== CAMPO_DA_DESCRICAO && escrito(valor))
  return camposGeradosDaAba(sistema).some((campo) => campo !== 'tipo' && escrito(cartao.campos[campo]))
}

/** A aba dos subcartões da forma ("Técnicas da forma"); só os da aba Habilidades são técnicas a converter. */
function abaDosSubcartoes(aba: string, sistema: SistemaDeRpg): string | null {
  return sistema.abas.find((candidata) => candidata.id === aba)?.subcartoes?.aba ?? null
}

/** O campo de antes que sumiria no cartão convertido; `null` = todo texto ficou (no cartão, no "Texto de antes" ou na Descrição). */
function textoQueSumiria(antes: CartaoDaFicha, depois: CartaoDaFicha): string | null {
  const extra = depois.extras.find((candidato) => candidato.nome === NOME_DO_TEXTO_DE_ANTES)
  // Só o "Texto de antes" que a conversão escreveu guarda o texto de agora (um que já estava é de outra montagem).
  const guardados = extra === undefined || antes.extras.includes(extra) ? null : camposDoTextoDeAntes(extra.valor)
  for (const [campo, valor] of Object.entries(antes.campos)) {
    if (valor.trim() === '') continue
    const agora = depois.campos[campo]
    if (agora === valor) continue
    if (campo === CAMPO_DA_DESCRICAO && agora !== undefined && agora.startsWith(valor.trimEnd())) continue
    if (guardados !== null && guardados.get(campo) === valor) continue
    return campo
  }
  if (antes.extras.some((extraDeAntes) => !depois.extras.some((agora) => agora.nome === extraDeAntes.nome && agora.valor === extraDeAntes.valor))) return 'os campos extras'
  if (antes.subcartoes.length !== depois.subcartoes.length || antes.modificadores.length !== depois.modificadores.length) return 'os subcartões ou os modificadores'
  return null
}

function linhaNoTexto(cartao: CartaoDaFicha, aba: string, porque: string): RelatorioDoCartao {
  return { cartaoId: cartao.id, nome: cartao.nome, aba, resultado: 'noTexto', confira: [], porque }
}

/**
 * UM cartão convertido (os subcartões da forma também, como técnicas), com as linhas do relatório em
 * `linhas`. Sem mudança: o MESMO cartão.
 */
function converterNoLugar(cartao: CartaoDaFicha, onde: OndeMora, aba: string, ctx: ContextoDaConversao, opcoes: OpcoesDaConversao, linhas: RelatorioDoCartao[]): CartaoDaFicha {
  const fora = foraDaConversao(cartao, onde, ctx)
  // O montado, o da tabela, o à mão e o com proposta saem intocados, com os subcartões (o editor converte cada um que abrir).
  if (fora !== null && fora.intocado) {
    if (fora.porque !== null) linhas.push(linhaNoTexto(cartao, aba, fora.porque))
    return cartao
  }
  const abaDosSub = onde === 'forma' ? abaDosSubcartoes(aba, ctx.sistema) : null
  const subcartoes = abaDosSub === ABA_DAS_TECNICAS ? cartao.subcartoes.map((sub) => converterNoLugar(sub, 'tecnica', abaDosSub, ctx, opcoes, linhas)) : cartao.subcartoes
  const comSubcartoes = subcartoes.some((sub, indice) => sub !== cartao.subcartoes[indice]) ? { ...cartao, subcartoes } : cartao
  if (fora !== null) return comSubcartoes
  const resultado = onde === 'forma' ? converterForma(comSubcartoes, ctx) : lerTipo(comSubcartoes).tipo === 'passiva' ? converterPassiva(comSubcartoes, ctx) : converterTecnica(comSubcartoes, ctx, opcoes)
  if (resultado.tipo === 'noTexto') {
    linhas.push(linhaNoTexto(comSubcartoes, aba, resultado.porque))
    return comSubcartoes
  }
  const convertido = comConfira(resultado.cartao, resultado.confira)
  const sumiria = textoQueSumiria(comSubcartoes, convertido)
  if (sumiria !== null) {
    linhas.push(linhaNoTexto(comSubcartoes, aba, `o texto de "${sumiria}" sumiria: segue pelo texto`))
    return comSubcartoes
  }
  const jaHavia = new Set(linhasDoConfira(comSubcartoes))
  linhas.push({ cartaoId: cartao.id, nome: cartao.nome, aba, resultado: 'convertido', deQue: resultado.deQue, confira: linhasDoConfira(convertido).filter((linha) => !jaHavia.has(linha)) })
  return convertido
}

/** As abas que a conversão lê: Habilidades e as que ligam (Transformações). */
function ondeMoraAAba(abaId: string, sistema: SistemaDeRpg): OndeMora | null {
  if (sistema.abas.some((aba) => aba.id === abaId && aba.modificadores === true)) return 'forma'
  return abaId === ABA_DAS_TECNICAS ? 'tecnica' : null
}

/**
 * Um cartão de uma ficha, na aba dada (o editor abre um cartão só). Sem mudança: o MESMO cartão, e a
 * linha do relatório diz por quê (ou nenhuma, no cartão montado).
 */
export function converterCartao(cartao: CartaoDaFicha, aba: string, ctx: ContextoDaConversao, opcoes: OpcoesDaConversao = {}): { cartao: CartaoDaFicha; relatorio: readonly RelatorioDoCartao[] } {
  const onde = ondeMoraAAba(aba, ctx.sistema)
  if (onde === null) return { cartao, relatorio: [] }
  const linhas: RelatorioDoCartao[] = []
  return { cartao: converterNoLugar(cartao, onde, aba, ctx, opcoes, linhas), relatorio: linhas }
}

// ─── O contador de antes vira o acumulador (D9) ─────────────────────────────

/** As técnicas da aba Habilidades e os subcartões delas: onde a batalha procura o contador de antes (`acumuladoresDaFicha.ts`). */
function tecnicasDoContador(personagem: Pick<Personagem, 'abas'>): CartaoDaFicha[] {
  const todas: CartaoDaFicha[] = []
  const juntar = (cartao: CartaoDaFicha): void => {
    todas.push(cartao)
    cartao.subcartoes.forEach(juntar)
  }
  for (const cartao of personagem.abas[ABA_DAS_TECNICAS] ?? []) juntar(cartao)
  return todas
}

/** O cartão `cartaoId` trocado na aba Habilidades (ou num subcartão dela). */
function comOCartaoTrocado(cartoes: readonly CartaoDaFicha[], cartaoId: string, trocar: (cartao: CartaoDaFicha) => CartaoDaFicha): CartaoDaFicha[] {
  return cartoes.map((cartao) => {
    if (cartao.id === cartaoId) return trocar(cartao)
    const subcartoes = comOCartaoTrocado(cartao.subcartoes, cartaoId, trocar)
    return subcartoes.some((sub, indice) => sub !== cartao.subcartoes[indice]) ? { ...cartao, subcartoes } : cartao
  })
}

/**
 * O contador de antes (a Polaridade dos extras, `contador.ts`) gravado como o acumulador do cartão, com
 * o MESMO id e as mesmas regras que a batalha já usa hoje em memória (`acumuladoresNaFicha`). Lido na
 * ficha de ANTES (o texto do cartão montado agora é outro). Só com um contador de antes na ficha: com
 * dois, a batalha de hoje usa só o primeiro, e gravar um faria o segundo passar a valer.
 */
function comOContadorDeAntes(antes: Personagem, depois: Personagem, linhas: RelatorioDoCartao[]): Personagem {
  const doTexto = acumuladoresNaFicha(antes).find((acumulador) => acumulador.origem === 'texto')
  if (doTexto === undefined) return depois
  const comContador = tecnicasDoContador(antes).filter((cartao) => cartao.acumulador === undefined && lerContador(cartao) !== null)
  const cartao = comContador.find((candidato) => candidato.id === doTexto.cartaoId)
  if (cartao === undefined) return depois
  if (comContador.length > 1) {
    linhas.push(linhaNoTexto(cartao, ABA_DAS_TECNICAS, 'mais de um contador de antes na ficha: seguem como hoje (só o primeiro vale)'))
    return depois
  }
  if (cartao.mecanica !== undefined || temLinhaNaTabela(cartao.id)) return depois
  const acumulador = acumuladorParaGuardar(doTexto.acumulador)
  const tecnicas = comOCartaoTrocado(depois.abas[ABA_DAS_TECNICAS] ?? [], cartao.id, (atual) => ({ ...atual, acumulador }))
  linhas.push({ cartaoId: cartao.id, nome: cartao.nome, aba: ABA_DAS_TECNICAS, resultado: 'convertido', deQue: 'acumulador', confira: [] })
  return { ...depois, abas: { ...depois.abas, [ABA_DAS_TECNICAS]: tecnicas } }
}

// ─── A ficha, as fichas e o catálogo ────────────────────────────────────────

export interface FichaConvertida {
  /** A ficha como a lista e o editor a mostram; sem mudança, a MESMA. */
  personagem: Personagem
  relatorio: RelatorioDaFicha
}

function resumoDasLinhas(personagem: Personagem, linhas: readonly RelatorioDoCartao[]): RelatorioDaFicha {
  const convertidos = linhas.filter((linha) => linha.resultado === 'convertido')
  return {
    personagemId: personagem.id,
    nome: personagem.nome,
    convertidos: convertidos.length,
    comConfira: convertidos.filter((linha) => linha.confira.length > 0).length,
    noTexto: linhas.filter((linha) => linha.resultado === 'noTexto').length,
    cartoes: linhas,
  }
}

/** A ficha inteira convertida na leitura. Pura; a segunda passada devolve a MESMA ficha. */
export function converterFicha(personagem: Personagem, sistema: SistemaDeRpg, opcoes: OpcoesDaConversao = {}): FichaConvertida {
  const ctx: ContextoDaConversao = { personagem, sistema }
  const linhas: RelatorioDoCartao[] = []
  let abas = personagem.abas
  for (const [abaId, cartoes] of Object.entries(personagem.abas)) {
    const onde = ondeMoraAAba(abaId, sistema)
    if (onde === null) continue
    const novos = cartoes.map((cartao) => converterNoLugar(cartao, onde, abaId, ctx, opcoes, linhas))
    if (novos.some((cartao, indice) => cartao !== cartoes[indice])) abas = { ...abas, [abaId]: novos }
  }
  const comAbas = abas === personagem.abas ? personagem : { ...personagem, abas }
  const convertida = comOContadorDeAntes(personagem, comAbas, linhas)
  return { personagem: convertida, relatorio: resumoDasLinhas(personagem, linhas) }
}

/** As fichas de um arquivo; sem mudança em nenhuma, a MESMA lista. O relatório só traz as fichas com linha. */
export function converterFichas(personagens: readonly Personagem[], sistema: SistemaDeRpg, opcoes: OpcoesDaConversao = {}): { personagens: readonly Personagem[]; relatorios: readonly RelatorioDaFicha[] } {
  const feitas = personagens.map((personagem) => converterFicha(personagem, sistema, opcoes))
  const mudou = feitas.some((feita, indice) => feita.personagem !== personagens[indice])
  return { personagens: mudou ? feitas.map((feita) => feita.personagem) : personagens, relatorios: feitas.map((feita) => feita.relatorio).filter((relatorio) => relatorio.cartoes.length > 0) }
}

/**
 * O "Texto de antes" numa linha da Descrição (o catálogo não guarda extras); `null` = o cartão não
 * tem. Não é linha de "Confira": no cartão o extra também não pede conferência.
 */
function textoDeAntesNumaLinha(cartao: CartaoDaFicha): string | null {
  const extra = cartao.extras.find((candidato) => candidato.nome === NOME_DO_TEXTO_DE_ANTES)
  return extra === undefined ? null : `${NOME_DO_TEXTO_DE_ANTES}: ${extra.valor.split('\n').join(' | ')}`
}

/**
 * Uma entrada de habilidade do catálogo do livro, convertida como o cartão de uma ficha de prévia
 * (sem atributos). O catálogo não guarda extras: o "Texto de antes" vai inteiro numa linha da
 * Descrição (`texto`); sem caber no teto dela, a entrada fica no texto. Sem mudança: a MESMA entrada.
 */
export function converterItemDoCatalogo(item: ItemDoCatalogo, sistema: SistemaDeRpg, opcoes: OpcoesDaConversao = {}): { item: ItemDoCatalogo; relatorio: readonly RelatorioDoCartao[] } {
  if (item.tipo !== 'habilidade' || item.mecanica !== undefined) return { item, relatorio: [] }
  const cartao: CartaoDaFicha = { ...novoCartao(item.nome), id: item.id, campos: { ...item.campos, [CAMPO_DA_DESCRICAO]: item.texto }, ...(item.alcance === undefined ? {} : { alcance: item.alcance }) }
  const ctx: ContextoDaConversao = { personagem: novoPersonagem(sistema, 'npc', item.nome), sistema }
  const feito = converterCartao(cartao, ABA_DAS_TECNICAS, ctx, opcoes)
  if (feito.cartao === cartao || feito.cartao.mecanica === undefined) return { item, relatorio: feito.relatorio }
  const deAntes = textoDeAntesNumaLinha(feito.cartao)
  const descricao = feito.cartao.campos[CAMPO_DA_DESCRICAO] ?? ''
  const texto = deAntes === null ? descricao : `${descricao.trimEnd()}\n${deAntes}`.replace(/^\n/, '')
  if (texto.length > ENTRADA_TEXTO_MAX) return { item, relatorio: [linhaNoTexto(cartao, ABA_DAS_TECNICAS, 'o texto de antes não cabe na descrição da entrada: segue pelo texto')] }
  const campos = Object.fromEntries(Object.entries(feito.cartao.campos).filter(([campo, valor]) => campo !== CAMPO_DA_DESCRICAO && valor.trim() !== ''))
  return { item: { ...item, texto, campos, mecanica: feito.cartao.mecanica }, relatorio: feito.relatorio }
}

/** O catálogo do livro; sem mudança em nenhuma entrada, a MESMA lista. */
export function converterCatalogo(itens: readonly ItemDoCatalogo[], sistema: SistemaDeRpg, opcoes: OpcoesDaConversao = {}): { itens: readonly ItemDoCatalogo[]; relatorio: readonly RelatorioDoCartao[] } {
  const feitos = itens.map((item) => converterItemDoCatalogo(item, sistema, opcoes))
  const mudou = feitos.some((feito, indice) => feito.item !== itens[indice])
  return { itens: mudou ? feitos.map((feito) => feito.item) : itens, relatorio: feitos.flatMap((feito) => feito.relatorio) }
}
