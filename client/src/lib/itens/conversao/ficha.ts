import { ITEM_SEM_NOME, itemParaDar, type ItemDoCatalogo } from '../../acervoDeItens'
import { ABA_DAS_ARMAS, CAMPO_DA_CAPACIDADE, CAMPO_DA_CATEGORIA, CAMPO_DA_QUANTIDADE, CAMPO_DO_EFEITO, lerCategoria, limiteDeArmas, type CategoriaDaArma } from '../../batalha/leituraDaFicha'
import { ATAQUE_SEM_ATRIBUTO, ATAQUE_SO_DE_EFEITO } from '../../batalha/formula'
import { ITEM_DESCRICAO_MAX, ITEM_QUANTIDADE_MAX } from '../../leituraDoItem'
import { ehRefDeMidia } from '../../midia'
import { nomesDeMunicaoIguais } from '../../mochila/municao'
import type { CartaoDaFicha, Personagem } from '../../personagem'
import type { CarriedItem } from '../../../types/map'
import { pecasGuardadas } from '../leitura'
import { TIPOS_COM_PENTE, TIPOS_DE_ARMA, TIPOS_QUE_EMPILHAM, type BlocosDoItem, type ConfiraDoItem, type TipoDoItem } from '../modelo'
import { balaDoDano, falaDeCuraReduzida, ORIGEM_DO_PALPITE_DO_TIPO } from './acervo'
import { comConfira, ehNomeQueVolta, hashEstavel, idDaVagaConvertida, idDoItemConvertido, normalizado, primeiroNumero } from './comum'

/**
 * CONVERSÃO DA FICHA (PLANO §2.2): os cartões das abas Armas e Itens e os "Tipos de bala" viram
 * vagas da mochila; a arma "em uso" vira `equipado`. Puro: devolve a ficha nova e os itens que o
 * Acervo precisa criar ou completar (`novos`); quem grava é `stores/conversaoDosItens.ts`.
 *
 * Idempotente pelo estado E pela marca: o cartão já levado tem `naMochila`; sem a marca (o app de
 * antes a apagou), a vaga que já está na mochila vence e nada se soma (R1: Prata 12, nunca 24).
 */

export const ABA_DOS_ITENS = 'itens'
const CAMPO_DO_DANO = 'dano'
const CAMPO_DA_ACAO = 'acao'
const CAMPO_DA_DESCRICAO = 'descricao'
const CAMPO_DO_MODIFICADOR = 'modificador'
/** "Atributo do ataque" da arma ("Percepção", "Nada"): o que soma ao dano. */
const CAMPO_DO_ATRIBUTO_DO_ATAQUE = 'atributoDoAtaque'

/** O atributo que o cartão sem "Soma no ataque" somava: a Força (`ATRIBUTO_PADRAO_DO_ATAQUE` da batalha), no id do motor. */
const SOMA_PADRAO_DO_ATAQUE = 'forca'

/**
 * O atributo que soma ao dano, como id sem acento ("Percepção" -> "percepcao"); "Nada" = nenhum. Bug de 28/11/2026:
 * vazio (o cartão antigo sem o campo) somava a Força, e o vazio do item é "Nada"; então o vazio vira a Força.
 */
function somaDoAtaque(atributo: string): string {
  const id = idDoAtributoDoAtaque(atributo)
  if (id === '') return SOMA_PADRAO_DO_ATAQUE
  // Rodada 3 (28/11/2026): o "Sem atributo" do cartão (`ATAQUE_SEM_ATRIBUTO`) é só o dano da arma, e não um atributo "sematributo" (que caía na Força).
  return id === 'nada' || id === 'nenhum' || id === ID_DO_SEM_ATRIBUTO ? '' : id.slice(0, 40)
}

/** "Percepção" -> "percepcao", "Sem atributo" -> "sematributo": o texto do cartão como id, para comparar. */
function idDoAtributoDoAtaque(atributo: string): string {
  return normalizado(atributo).replace(/[^a-z0-9]/g, '')
}

const ID_DO_SEM_ATRIBUTO = idDoAtributoDoAtaque(ATAQUE_SEM_ATRIBUTO)
const ID_DO_SO_DE_EFEITO = idDoAtributoDoAtaque(ATAQUE_SO_DE_EFEITO)
const RECARGA_NA_HORA = { acao: 'Ação Livre', rodadas: 0 } as const

/** O que a conversão de uma ou várias fichas precisa e o que ela junta. */
export interface ContextoDaConversao {
  /** O Acervo de agora (já convertido na leitura). */
  acervo: readonly ItemDoCatalogo[]
  /** Os itens que a conversão cria ou completa, pelo id: o mesmo cartão em fichas diferentes vira UM item. */
  novos: Map<string, ItemDoCatalogo>
}

/** O que mudou numa ficha, para o relatório e o aviso. */
export interface RelatorioDaFicha {
  personagemId: string
  nome: string
  /** As vagas que nasceram, com o item e quantos. */
  vagasNovas: { nome: string; itemId: string; quantidade: number }[]
  /** As vagas que ganharam o `itemId` (a de antes, só com o nome). */
  ligadas: number
  equipadas: number
  /** Frases para o mestre conferir (a arma que passou do limite, a quantidade que não era número). */
  confira: string[]
}

export function novoContexto(acervo: readonly ItemDoCatalogo[]): ContextoDaConversao {
  return { acervo, novos: new Map() }
}

/** O item de agora pelo id: o que a conversão já mexeu vence o do Acervo. */
function itemPeloId(ctx: ContextoDaConversao, id: string): ItemDoCatalogo | undefined {
  return ctx.novos.get(id) ?? ctx.acervo.find((item) => item.id === id)
}

function todos(ctx: ContextoDaConversao): ItemDoCatalogo[] {
  const ids = new Set(ctx.novos.keys())
  return [...ctx.acervo.filter((item) => !ids.has(item.id)), ...ctx.novos.values()]
}

function itemPeloNome(ctx: ContextoDaConversao, nome: string, aceita: (item: ItemDoCatalogo) => boolean = () => true): ItemDoCatalogo | undefined {
  const chave = normalizado(nome)
  if (chave === '') return undefined
  return todos(ctx).find((item) => normalizado(item.nome) === chave && aceita(item))
}

function guardar(ctx: ContextoDaConversao, item: ItemDoCatalogo): ItemDoCatalogo {
  ctx.novos.set(item.id, item)
  return item
}

function texto(cartao: CartaoDaFicha, campo: string): string {
  return (cartao.campos[campo] ?? '').trim()
}

function cortado(valor: string, max: number): string {
  return valor.length <= max ? valor : valor.slice(0, max)
}

/** A Descrição do item novo: a do cartão, mais o texto que não virou campo (Efeito, Modificador). Nada se perde (regra 4). */
export function descricaoDoCartao(cartao: CartaoDaFicha): { descricao: string; sobrou: boolean } {
  const partes = [texto(cartao, CAMPO_DA_DESCRICAO)]
  const efeito = texto(cartao, CAMPO_DO_EFEITO)
  const modificador = texto(cartao, CAMPO_DO_MODIFICADOR)
  if (efeito !== '') partes.push(`Efeito: ${efeito}`)
  if (modificador !== '') partes.push(`Modificador: ${modificador}`)
  for (const extra of cartao.extras) if (extra.valor.trim() !== '') partes.push(`${extra.nome}: ${extra.valor.trim()}`)
  return { descricao: cortado(partes.filter((parte) => parte !== '').join('\n'), ITEM_DESCRICAO_MAX), sobrou: efeito !== '' || modificador !== '' || cartao.extras.length > 0 }
}

/** A categoria da arma (Branca, De fogo...) -> o tipo. Sem categoria: com balas, De fogo; sem, Corpo a corpo (palpite). */
export function tipoDaArma(categoria: CategoriaDaArma | null, temBalas: boolean): { tipo: TipoDoItem; palpite: boolean } {
  switch (categoria) {
    case 'branca':
    case 'natural':
      return { tipo: 'corpo', palpite: false }
    case 'deFogo':
      return { tipo: 'fogo', palpite: false }
    case 'hibrida':
      return { tipo: 'hibrida', palpite: false }
    case 'arremesso':
      return { tipo: 'arremesso', palpite: false }
    case null:
      return { tipo: temBalas ? 'fogo' : 'corpo', palpite: true }
  }
}

/** Os blocos de regra que o cartão da arma diz, com os "Confira" do que não virou número. */
export function blocosDaArma(cartao: CartaoDaFicha, tipo: TipoDoItem, balas: readonly string[], origem: string): { blocos: BlocosDoItem; confira: ConfiraDoItem[] } {
  const confira: ConfiraDoItem[] = []
  const danoTexto = texto(cartao, CAMPO_DO_DANO)
  const dano = /^\d{1,7}$/.test(danoTexto) ? Number.parseInt(danoTexto, 10) : primeiroNumero(danoTexto)
  if (danoTexto !== '' && !/^\d{1,7}$/.test(danoTexto)) confira.push({ texto: 'O dano do cartão não era só um número: confira o dano', antes: danoTexto, depois: String(dano ?? 0), origem })
  const alcance = cartao.alcance === undefined ? undefined : pecasGuardadas(cartao.alcance)
  const atributo = texto(cartao, CAMPO_DO_ATRIBUTO_DO_ATAQUE)
  const soma = somaDoAtaque(atributo)
  // Rodada 3 (28/11/2026): o cartão "Nada" era a arma só de efeito da C8 (o Atacar não dava dano, venha o número que vier).
  // No item, só de efeito é o dano 0 (o "Ao acertar" faz o resto); o número de antes fica no Confira.
  const soDeEfeito = idDoAtributoDoAtaque(atributo) === ID_DO_SO_DE_EFEITO
  if (soDeEfeito && (dano ?? 0) > 0) confira.push({ texto: 'O cartão dizia "Nada" no Soma no ataque (só efeito, sem dano): o dano ficou 0', antes: String(dano), depois: '0', origem })
  const ataque = { dano: soDeEfeito ? 0 : (dano ?? 0), soma, acao: cortado(texto(cartao, CAMPO_DA_ACAO), 40), alvos: 1, ...(alcance === undefined ? {} : { alcance }) }
  const blocos: BlocosDoItem = {}
  if (TIPOS_DE_ARMA.has(tipo)) blocos.ataque = ataque
  if (tipo === 'hibrida') {
    blocos.golpe = { dano: ataque.dano, soma, acao: ataque.acao }
    confira.push({ texto: 'Híbrida: o golpe e o tiro começaram com o mesmo dano; confira os dois', origem })
  }
  if (TIPOS_COM_PENTE.has(tipo)) {
    // A capacidade escrita só na Descrição ("Capacidade de 10 Balas", a Rosa Fúnebre) também vale.
    const naDescricao = /capacidade de (\d{1,4})/.exec(normalizado(texto(cartao, CAMPO_DA_DESCRICAO)))
    const capacidadeTexto = texto(cartao, CAMPO_DA_CAPACIDADE) || (naDescricao === null ? '' : naDescricao[1])
    const capacidade = primeiroNumero(capacidadeTexto)
    if (capacidade !== null && capacidade >= 1) blocos.pente = { capacidade: Math.min(capacidade, 1000), aceita: [...balas] }
    // Sem nada escrito, sem o "Antes:" vazio no aviso.
    else confira.push({ texto: 'Sem a capacidade do pente: diga quantas balas cabem', ...(capacidadeTexto === '' ? {} : { antes: capacidadeTexto }), origem })
  }
  if (tipo === 'arremesso') blocos.arremesso = { recarga: { ...RECARGA_NA_HORA }, ...(ehNomeQueVolta(cartao.nome) ? { volta: true as const } : {}) }
  if (cartao.mecanica !== undefined) confira.push({ texto: 'O cartão tinha "O que ela faz" montado: confira o Ao acertar (o dano não pode dobrar)', origem })
  return { blocos, confira }
}

/** A "regra" do cartão em texto, para saber se dois cartões de mesmo nome são a mesma arma (mesmo nome e mesma regra = um item). */
function assinaturaDoCartao(cartao: CartaoDaFicha): string {
  const campos = Object.entries(cartao.campos)
    .filter(([, valor]) => valor.trim() !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  const balas = cartao.subcartoes.map((bala) => [normalizado(bala.nome), texto(bala, CAMPO_DO_DANO)])
  return JSON.stringify([normalizado(cartao.nome), campos, balas, cartao.mecanica ?? null, cartao.alcance ?? null])
}

/** O prefixo dos ids que a conversão cria (`idDoItemConvertido`). */
const PREFIXO_DO_CONVERTIDO = 'item_conv_'

/** O id do item que nasce do cartão: o mesmo para o mesmo nome e a mesma regra, em qualquer ficha. */
function idDoItemDoCartao(cartao: CartaoDaFicha): string {
  return idDoItemConvertido(`cartao:${hashEstavel(assinaturaDoCartao(cartao))}`)
}

function itemNovoDoCartao(ctx: ContextoDaConversao, personagem: Personagem, aba: string, cartao: CartaoDaFicha, balas: readonly string[]): ItemDoCatalogo {
  const id = idDoItemDoCartao(cartao)
  const ja = itemPeloId(ctx, id)
  if (ja !== undefined) return ja
  const origem = `cartão ${aba}: ${personagem.nome} / ${cartao.nome}`
  const nomeBase = cartao.nome.trim() || ITEM_SEM_NOME
  // Regra diferente com o mesmo nome (de outra ficha): item à parte, "Nome (de Fulano)".
  const nome = itemPeloNome(ctx, nomeBase) === undefined ? nomeBase : cortado(`${nomeBase} (de ${personagem.nome})`, 60)
  const { descricao, sobrou } = descricaoDoCartao(cartao)
  const ehArma = aba === ABA_DAS_ARMAS
  const { tipo, palpite } = ehArma ? tipoDaArma(lerCategoria(texto(cartao, CAMPO_DA_CATEGORIA)), cartao.subcartoes.length > 0) : { tipo: 'outros' as const, palpite: false }
  const { blocos, confira } = ehArma ? blocosDaArma(cartao, tipo, balas, origem) : { blocos: {}, confira: [] }
  const quantidade = ehArma ? 1 : primeiroNumero(texto(cartao, CAMPO_DA_QUANTIDADE)) ?? 1
  const requisitos = cartao.requisitos === undefined ? undefined : pecasGuardadas(cartao.requisitos)
  const avisos: ConfiraDoItem[] = [
    { texto: `Item novo, feito do cartão da aba ${ehArma ? 'Armas' : 'Itens'} de ${personagem.nome}`, origem },
    ...(palpite ? [{ texto: 'Sem a categoria da arma: o tipo é um palpite', origem: ORIGEM_DO_PALPITE_DO_TIPO }] : []),
    ...(sobrou ? [{ texto: 'O texto do cartão que não virou campo foi para a Descrição', origem }] : []),
    ...confira,
  ]
  const item: ItemDoCatalogo = {
    id,
    nome,
    imagem: ehRefDeMidia(cartao.imagem) ? cartao.imagem : null,
    descricao,
    categoria: ehArma ? 'Arma' : '',
    preco: null,
    empilhavel: TIPOS_QUE_EMPILHAM.has(tipo) || quantidade > 1,
    ...blocos,
    tipo,
    ...(requisitos === undefined ? {} : { requisitos }),
    ...(comConfira(undefined, avisos) === undefined ? {} : { confira: comConfira(undefined, avisos) }),
  }
  return guardar(ctx, item)
}

/**
 * O item do Acervo que a regra do cartão completa: o tipo que saiu de palpite passa a ser o da
 * categoria do cartão, e o ataque e o pente que faltam vêm do cartão. Nada a completar: o MESMO item.
 */
function completadoPeloCartao(ctx: ContextoDaConversao, item: ItemDoCatalogo, personagem: Personagem, cartao: CartaoDaFicha, balas: readonly string[]): ItemDoCatalogo {
  const categoria = lerCategoria(texto(cartao, CAMPO_DA_CATEGORIA))
  const palpite = item.confira?.some((confira) => confira.origem === ORIGEM_DO_PALPITE_DO_TIPO) === true
  const tipo = palpite && categoria !== null ? tipoDaArma(categoria, false).tipo : item.tipo
  if (tipo === undefined || !TIPOS_DE_ARMA.has(tipo)) return item
  const { blocos, confira } = blocosDaArma(cartao, tipo, balas, `cartão Armas: ${personagem.nome} / ${cartao.nome}`)
  const faltam: BlocosDoItem = {}
  if (item.ataque === undefined && blocos.ataque !== undefined) faltam.ataque = blocos.ataque
  if (item.golpe === undefined && blocos.golpe !== undefined) faltam.golpe = blocos.golpe
  if (item.pente === undefined && blocos.pente !== undefined) faltam.pente = blocos.pente
  if (item.arremesso === undefined && blocos.arremesso !== undefined) faltam.arremesso = blocos.arremesso
  if (tipo === item.tipo && Object.keys(faltam).length === 0) return item
  const semPalpite = tipo === item.tipo ? item.confira : item.confira?.filter((aviso) => aviso.origem !== ORIGEM_DO_PALPITE_DO_TIPO)
  const avisos = comConfira(semPalpite, Object.keys(faltam).length === 0 ? [] : confira)
  const { confira: _antes, ...semConfira } = item
  return guardar(ctx, { ...semConfira, ...faltam, tipo, ...(avisos === undefined ? {} : { confira: avisos }) })
}

/** A vaga da mochila que já é deste item: pelo `itemId`, ou a de antes só com o nome. */
function vagaDoItem(mochila: readonly CarriedItem[], item: ItemDoCatalogo, nomeDoCartao: string): CarriedItem | undefined {
  const nomes = [normalizado(item.nome), normalizado(nomeDoCartao)]
  return mochila.find((vaga) => vaga.itemId === item.id) ?? mochila.find((vaga) => vaga.itemId === undefined && nomes.includes(normalizado(vaga.nome)))
}

function vagaNova(ctx: ContextoDaConversao, personagem: Personagem, origem: string, item: ItemDoCatalogo, quantidade: number): CarriedItem {
  const n = Math.max(1, Math.min(quantidade, ITEM_QUANTIDADE_MAX))
  return { id: idDaVagaConvertida(`${personagem.id}/${origem}`), ...itemParaDar(item, todos(ctx)), ...(n > 1 && item.empilhavel ? { quantidade: n } : {}) }
}

/** A munição de um "Tipo de bala": a do `itemId` do subcartão, ou a de mesmo nome, ou uma nova por nome (`bala:<nome>`). */
function municaoDaBala(ctx: ContextoDaConversao, bala: CartaoDaFicha): ItemDoCatalogo {
  const doId = bala.itemId === undefined ? undefined : itemPeloId(ctx, bala.itemId)
  if (doId !== undefined) return doId
  const nome = bala.nome.trim() || 'Bala sem nome'
  const doNome = itemPeloNome(ctx, nome, (item) => item.tipo === 'municao')
  if (doNome !== undefined) return doNome
  const id = idDoItemConvertido(`bala:${normalizado(nome)}`)
  const ja = itemPeloId(ctx, id)
  if (ja !== undefined) return ja
  const dano = texto(bala, CAMPO_DO_DANO)
  const efeito = texto(bala, CAMPO_DO_EFEITO)
  const lida = balaDoDano(dano)
  const origem = `tipo de bala: ${nome}`
  const avisos = comConfira(undefined, [
    { texto: 'Munição nova, feita do "Tipos de bala" de uma arma', origem },
    ...(lida === null ? [{ texto: 'O dano da bala não virou número: confira a bala', antes: dano, origem }] : []),
    ...(efeito !== '' ? [{ texto: 'O efeito da bala ficou só em texto: confira o Ao acertar', antes: efeito, origem }] : []),
  ])
  return guardar(ctx, {
    id,
    nome,
    imagem: null,
    descricao: '',
    categoria: 'Munição',
    preco: null,
    empilhavel: true,
    // O tiro de antes fica, para a batalha de hoje (que ainda o lê) atirar igual.
    ...(dano !== '' || efeito !== '' ? { tiro: { dano, efeito } } : {}),
    ...(lida === null || lida === undefined ? {} : { bala: lida }),
    tipo: 'municao',
    ...(avisos === undefined ? {} : { confira: avisos }),
  })
}

/**
 * "Ferido por prata" ou a cura pela metade escrita no tipo de bala (PLANO §2.2): a munição ganha o aviso
 * "Ao acertar: Cura reduzida 50%". A peça montada nasce no editor do item (E2); a batalha de hoje segue o texto.
 */
function avisarCuraReduzida(ctx: ContextoDaConversao, municao: ItemDoCatalogo, efeito: string): void {
  if (!falaDeCuraReduzida(efeito)) return
  const confira = comConfira(municao.confira, [{ texto: 'Ao acertar: Cura reduzida 50% até o fim da batalha', antes: efeito, origem: 'conversão: o tiro da munição' }])
  if ((confira?.length ?? 0) === (municao.confira?.length ?? 0)) return
  guardar(ctx, { ...municao, ...(confira === undefined ? {} : { confira }) })
}

/** Há na mochila uma vaga ligada a esta bala (pelo item ou pelo nome)? A ligada já é a verdade: o cartão nunca descontou. */
function temVagaDaBala(mochila: readonly CarriedItem[], bala: CartaoDaFicha, municao: ItemDoCatalogo): boolean {
  const nome = bala.nome.trim()
  return mochila.some((vaga) => vaga.itemId === municao.id || (bala.itemId !== undefined && vaga.itemId === bala.itemId) || ((bala.itemId === undefined || vaga.itemId === undefined) && nome !== '' && nomesDeMunicaoIguais(vaga.nome, nome)))
}

interface Passo {
  personagem: Personagem
  mochila: CarriedItem[]
  relatorio: RelatorioDaFicha
}

/** Os "Tipos de bala" de uma arma: cada um vira munição; as N do texto vão para a mochila só sem vaga ligada. */
function converterBalas(ctx: ContextoDaConversao, passo: Passo, arma: CartaoDaFicha): { subcartoes: CartaoDaFicha[]; ids: string[] } {
  const ids: string[] = []
  const subcartoes = arma.subcartoes.map((bala) => {
    const municao = municaoDaBala(ctx, bala)
    ids.push(municao.id)
    if (bala.naMochila === true) return bala
    avisarCuraReduzida(ctx, municao, texto(bala, CAMPO_DO_EFEITO))
    if (!temVagaDaBala(passo.mochila, bala, municao)) {
      const quantidadeTexto = texto(bala, CAMPO_DA_QUANTIDADE)
      const n = primeiroNumero(quantidadeTexto)
      if (quantidadeTexto !== '' && !/^\d{1,7}$/.test(quantidadeTexto)) passo.relatorio.confira.push(`${arma.nome} / ${bala.nome}: a quantidade "${quantidadeTexto}" ${n === null ? 'não era número e não foi para a mochila' : `virou ${n} na mochila`}`)
      if (n !== null && n > 0) {
        const vaga = vagaNova(ctx, passo.personagem, `bala/${arma.id}/${bala.id}`, municao, n)
        passo.mochila.push(vaga)
        passo.relatorio.vagasNovas.push({ nome: vaga.nome, itemId: municao.id, quantidade: vaga.quantidade ?? 1 })
      }
    }
    // Sem `itemId`, a bala segue ligada pelo nome mesmo quando a vaga zera (o tiro com 0 continua bloqueado, D1).
    return { ...bala, naMochila: true as const, ...(bala.itemId === undefined ? { municaoPeloNome: true as const } : {}) }
  })
  return { subcartoes, ids }
}

/** Um cartão da aba Armas ou Itens: a vaga na mochila (se ainda não houver). Devolve o cartão marcado e a vaga dele. */
function converterCartao(ctx: ContextoDaConversao, passo: Passo, aba: string, cartao: CartaoDaFicha): { cartao: CartaoDaFicha; vaga: CarriedItem | undefined } {
  const ehArma = aba === ABA_DAS_ARMAS
  const comBalas = ehArma && cartao.subcartoes.length > 0 ? converterBalas(ctx, passo, cartao) : { subcartoes: cartao.subcartoes, ids: [] }
  const marcado = { ...cartao, subcartoes: comBalas.subcartoes }
  const doId = cartao.itemId === undefined ? undefined : itemPeloId(ctx, cartao.itemId)
  // O item que a conversão já fez deste mesmo cartão (mesmo nome e mesma regra), em outra ficha ou numa conversão de antes.
  const daAssinatura = itemPeloId(ctx, idDoItemDoCartao(cartao))
  // Pelo nome, só o item que o mestre cadastrou: o que a conversão fez de outro cartão só casa pela assinatura (regra diferente = item à parte).
  const achado = doId ?? daAssinatura ?? itemPeloNome(ctx, cartao.nome, (item) => !item.id.startsWith(PREFIXO_DO_CONVERTIDO))
  const item = achado === undefined ? itemNovoDoCartao(ctx, passo.personagem, aba, cartao, comBalas.ids) : ehArma ? completadoPeloCartao(ctx, achado, passo.personagem, cartao, comBalas.ids) : achado
  if (cartao.naMochila === true) return { cartao: marcado, vaga: vagaDoItem(passo.mochila, item, cartao.nome) }
  let vaga = vagaDoItem(passo.mochila, item, cartao.nome)
  if (vaga === undefined) {
    const quantidade = ehArma ? 1 : primeiroNumero(texto(cartao, CAMPO_DA_QUANTIDADE)) ?? 1
    vaga = vagaNova(ctx, passo.personagem, `${aba}/${cartao.id}`, item, quantidade)
    passo.mochila.push(vaga)
    passo.relatorio.vagasNovas.push({ nome: vaga.nome, itemId: item.id, quantidade: vaga.quantidade ?? 1 })
  } else if (vaga.itemId === undefined) {
    // A vaga de antes, só com o nome, passa a apontar para a coisa do cartão.
    const ligada: CarriedItem = { ...vaga, itemId: item.id, ...(item.tipo === undefined ? {} : { tipo: item.tipo }) }
    passo.mochila[passo.mochila.indexOf(vaga)] = ligada
    passo.relatorio.ligadas += 1
    vaga = ligada
  }
  // O cartão passa a apontar para a coisa: o Atacar acha a vaga pelo id e não mostra a arma duas vezes.
  return { cartao: { ...marcado, naMochila: true, itemId: item.id }, vaga }
}

/** A vaga de antes, só com o nome (pino "!", mochila antiga): casa pelo nome com o Acervo; sem casar, item novo do tipo Outros. */
function ligarVagaSemItem(ctx: ContextoDaConversao, vaga: CarriedItem): CarriedItem {
  if (vaga.itemId !== undefined) return vaga
  const achado = itemPeloNome(ctx, vaga.nome)
  const item =
    achado ??
    guardar(ctx, {
      id: idDoItemConvertido(`vaga:${normalizado(vaga.nome)}`),
      nome: vaga.nome,
      imagem: vaga.imagem ?? null,
      descricao: vaga.descricao ?? '',
      categoria: vaga.categoria ?? '',
      preco: vaga.preco ?? null,
      empilhavel: vaga.empilhavel === true,
      ...(vaga.luz === undefined ? {} : { luz: { ...vaga.luz } }),
      tipo: 'outros',
      ...(vaga.categoria === undefined ? {} : { categoriaAntiga: vaga.categoria }),
      confira: [{ texto: 'Item novo, feito de uma vaga da mochila que só tinha o nome', origem: `vaga: ${vaga.nome}` }],
    })
  return { ...vaga, itemId: item.id, ...(item.tipo === undefined ? {} : { tipo: item.tipo }) }
}

/** A vaga dada antes do tipo ganha o do item do Acervo (é cópia de exibição, como a categoria). Já tem, ou sem item: a MESMA vaga. */
function comTipoDoAcervo(ctx: ContextoDaConversao, vaga: CarriedItem): CarriedItem {
  if (vaga.itemId === undefined || vaga.tipo !== undefined) return vaga
  const tipo = itemPeloId(ctx, vaga.itemId)?.tipo
  return tipo === undefined ? vaga : { ...vaga, tipo }
}


/** O mesmo conteúdo (para devolver a MESMA ficha quando nada mudou). */
function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Converte UMA ficha. Os itens a criar ou completar ficam em `ctx.novos`. Nada mudou: a MESMA ficha.
 * O cartão fica na ficha (só para ler até a E7): é dele que a batalha de hoje ainda lê o ataque.
 */
export function converterFicha(ctx: ContextoDaConversao, personagem: Personagem): { personagem: Personagem; relatorio: RelatorioDaFicha } {
  const relatorio: RelatorioDaFicha = { personagemId: personagem.id, nome: personagem.nome, vagasNovas: [], ligadas: 0, equipadas: 0, confira: [] }
  // Os cartões primeiro: a vaga de antes só com o nome da arma do cartão é dele (senão viraria um item Outros à parte).
  const passo: Passo = { personagem, mochila: [...(personagem.mochila ?? [])], relatorio }
  const abas = { ...personagem.abas }
  const armas: CarriedItem[] = []
  for (const aba of [ABA_DAS_ARMAS, ABA_DOS_ITENS]) {
    const cartoes = personagem.abas[aba]
    if (cartoes === undefined || cartoes.length === 0) continue
    abas[aba] = cartoes.map((cartao) => {
      const { cartao: novo, vaga } = converterCartao(ctx, passo, aba, cartao)
      if (aba === ABA_DAS_ARMAS && vaga !== undefined && cartao.naMochila !== true) armas.push(vaga)
      return novo
    })
  }
  // A arma "em uso": as primeiras N pela ordem dos cartões, N = "Armas por batalha"; o resto fica guardado.
  const limite = limiteDeArmas(personagem) ?? armas.length
  const equipar = new Set(armas.slice(0, limite).map((vaga) => vaga.id))
  if (armas.length > limite) relatorio.confira.push(`${armas.length} armas e "Armas por batalha" ${limite}: ficaram em uso as ${limite} primeiras`)
  const final = passo.mochila.map((vaga) => {
    // Depois dos cartões: a vaga que ainda só tem o nome casa com o Acervo (ou vira item Outros), e a de antes do tipo ganha o dele.
    // A nota da vaga (A4) nasce com o fim do editor de vaga (E3): comparar agora acusaria toda vaga de item renomeado no Acervo.
    const ligada = ligarVagaSemItem(ctx, vaga)
    if (ligada !== vaga) relatorio.ligadas += 1
    const comTipo = comTipoDoAcervo(ctx, ligada)
    if (!equipar.has(comTipo.id) || comTipo.equipado === true) return comTipo
    relatorio.equipadas += 1
    return { ...comTipo, equipado: true as const }
  })
  const nova: Personagem = { ...personagem, abas, ...(final.length === 0 ? {} : { mochila: final }) }
  return { personagem: igual(nova, personagem) ? personagem : nova, relatorio }
}

/** Converte as fichas de uma pasta ou aventura, na ordem. Nenhuma mudou: a MESMA lista. */
export function converterFichas(acervo: readonly ItemDoCatalogo[], personagens: readonly Personagem[]): { personagens: readonly Personagem[]; novos: ItemDoCatalogo[]; relatorios: RelatorioDaFicha[] } {
  const ctx = novoContexto(acervo)
  const relatorios: RelatorioDaFicha[] = []
  let mudou = false
  const lista = personagens.map((personagem) => {
    const feito = converterFicha(ctx, personagem)
    relatorios.push(feito.relatorio)
    if (feito.personagem !== personagem) mudou = true
    return feito.personagem
  })
  return { personagens: mudou ? lista : personagens, novos: [...ctx.novos.values()], relatorios }
}
