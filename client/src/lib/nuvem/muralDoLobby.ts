import { cleanChatText } from '../chat'
import { ehRefDeMidia } from '../midia'
import type { Personagem } from '../personagem'
import { segmentoValido } from './caminho'
import { mencoesDaSala } from './chatDoLobby'
import { ehRegistro, proprio, type Json } from './json'
import type { MembroProjetado, OpGravada } from './tipos'

/**
 * MURAL DO LOBBY (plano do Lobby §8.2, fatia M1; pedido do usuário de
 * 06/11/2026): o protocolo que o DO Campanha fala com o site pela MESMA
 * conexão WebSocket das fichas (mensagens `mural.*`), e as regras puras que o
 * servidor aplica. O site (M2) usa os mesmos tipos.
 *
 * - NOTÍCIAS: só o mestre posta, edita, apaga e fixa (§6.4). Texto pelo
 *   `cleanChatText` e menções pelo `findMentions`, os mesmos do chat; imagem
 *   opcional só por `midia:` (a da W3). Apagar deixa lápide.
 * - AVISOS: notícia fixada no topo. Cada conta marca como lida; o lido vale
 *   para a VERSÃO da notícia (editar ou fixar de novo sobe a versão, e o aviso
 *   volta a aparecer).
 * - REAÇÕES: um emoji de `MURAL_REACOES` por pessoa e notícia.
 * - MODIFICAÇÕES: o histórico de ops em frases simples, montadas SÓ a partir
 *   da op já projetada para quem lê (`projetarOpParaJogador`) e de nomes
 *   públicos da ficha (nome, cartões, mochila): nunca de campo do mestre.
 */

/** Teto do texto de uma notícia, depois da limpeza (pedido do usuário: até 4.000 caracteres). */
export const MURAL_TEXTO_MAX = 4000

/** Notícias por página do `mural.antes`. */
export const MURAL_PAGINA_MAX = 50

/** Notícias no `mural.estado` de quem entra (as fixadas vêm todas, à parte). */
export const MURAL_PAGINA_DO_ESTADO = 20

/** Modificações por página do `mural.modificacoes`. */
export const MURAL_MODIFICACOES_PAGINA_MAX = 50

/** A lista fixa e curta de reações (pedido do usuário). Fora dela é pedido fora do formato. */
export const MURAL_REACOES = ['👍', '❤️', '😂', '😮', '😢', '🔥'] as const

export type ReacaoDoMural = (typeof MURAL_REACOES)[number]

export interface ContagemDaReacao {
  reacao: ReacaoDoMural
  total: number
}

/** Uma notícia como QUEM RECEBE a vê (`minhaReacao` e `lida` são dele). */
export interface NoticiaDoMural {
  /** Crescente (a ordem de chegada no servidor). */
  id: number
  autorContaId: string
  /** O nome de quem postou, quando postou. */
  autorNome: string
  /** Vazio na lápide. */
  texto: string
  /** `midia:<sha256>.<ext>` (rota de mídia da campanha), ou `null`. */
  imagem: string | null
  /** ContaIds mencionados com `@Nome` (`'mestre'` para `@mestre`). */
  mencoes: string[]
  /** Fixada no topo = AVISO. */
  fixada: boolean
  /** Sobe ao editar e ao fixar: o lido é desta versão. */
  versao: number
  criadaEm: number
  editadaEm: number | null
  /** `null` = de pé; número = lápide (o texto e a imagem somem). */
  apagadaEm: number | null
  /** Só as reações com total > 0, na ordem de `MURAL_REACOES`; vazio na lápide. */
  reacoes: ContagemDaReacao[]
  minhaReacao: ReacaoDoMural | null
  /** Quem recebe já marcou ESTA versão como lida (só faz diferença na fixada). */
  lida: boolean
}

/** Uma linha do feed de modificações, já pela projeção de quem lê. */
export interface ModificacaoDoMural {
  rev: number
  quando: number
  fichaId: string
  fichaNome: string
  autorContaId: string
  autorNome: string
  /** "Ana mudou Vida de 30 para 24". Texto de usuário dentro: o site mostra sempre literal. */
  frase: string
  /** A op desfaz outra. */
  desfazendo?: true
}

export type PedidoDoMural =
  /** Só o mestre. `idDoCliente` torna o reenvio idempotente. */
  | { t: 'mural.postar'; texto: string; imagem: string | null; idDoCliente: string }
  /** Só o mestre. `imagem: null` tira a imagem. */
  | { t: 'mural.editar'; id: number; texto: string; imagem: string | null }
  /** Só o mestre: vira lápide. */
  | { t: 'mural.apagar'; id: number }
  /** Só o mestre: fixa (aviso) ou desafixa. */
  | { t: 'mural.fixar'; id: number; fixada: boolean }
  /** Todo membro: `null` tira a reação. */
  | { t: 'mural.reagir'; id: number; reacao: ReacaoDoMural | null }
  /** Todo membro: marca o aviso (na versão vista) como lido. */
  | { t: 'mural.lido'; id: number; versao: number }
  /** Sem `antesDeId` = as mais novas. A lista vem da mais nova para a mais velha. */
  | { t: 'mural.antes'; antesDeId: number | null; limite: number }
  /** Filtro por ficha e por autor (`null` = todos); paginado por rev, da mais nova para a mais velha. */
  | { t: 'mural.modificacoes'; fichaId: string | null; autorContaId: string | null; antesDeRev: number | null; limite: number }

export type TipoDoPedidoDoMural = PedidoDoMural['t']

/**
 * `formato` = pedido torto (conta como violação, §6.5); `texto` = vazio depois
 * da limpeza ou acima do teto; `imagem` = `midia:` que a campanha não guarda;
 * `sem-permissao` = jogador tentando o que é do mestre; `apagada` = notícia
 * que já é lápide; `ritmo`/`cota` = espere `tentarDepoisDe`.
 */
export type MotivoDoMuralRecusado = 'formato' | 'texto' | 'imagem' | 'nao-existe' | 'sem-permissao' | 'apagada' | 'ritmo' | 'cota'

export type MensagemDoMuralDoServidor =
  /** Logo depois de cada `ola`: os avisos (todas as fixadas) e a primeira página. */
  | { t: 'mural.estado'; fixadas: NoticiaDoMural[]; noticias: NoticiaDoMural[]; temMaisAntigas: boolean }
  /** Só para o socket que postou (o site tira o "enviando…"). */
  | { t: 'mural.ok'; idDoCliente: string; noticia: NoticiaDoMural }
  /** Nova, editada, fixada, desafixada, lápide, reação ou lido: a notícia inteira, vista por quem recebe. */
  | { t: 'mural.noticia'; noticia: NoticiaDoMural }
  | { t: 'mural.lista'; noticias: NoticiaDoMural[]; temMaisAntigas: boolean }
  /** `proximaAntesDeRev` = mande de novo com este `antesDeRev` para a página seguinte; `null` = acabou. */
  | { t: 'mural.modificacoes'; fichaId: string | null; autorContaId: string | null; lista: ModificacaoDoMural[]; proximaAntesDeRev: number | null }
  | { t: 'mural.recusado'; pedido: TipoDoPedidoDoMural | 'mural'; idDoCliente?: string; motivo: MotivoDoMuralRecusado; tentarDepoisDe?: number }

/** O pedido lido; fora do formato, o tipo (se conhecido) e o `idDoCliente` (se legível) para a resposta. */
export type LeituraDoPedidoDoMural = { ok: true; pedido: PedidoDoMural } | { ok: false; pedido: TipoDoPedidoDoMural | 'mural'; idDoCliente?: string }

const TIPOS_DO_PEDIDO: readonly TipoDoPedidoDoMural[] = [
  'mural.postar',
  'mural.editar',
  'mural.apagar',
  'mural.fixar',
  'mural.reagir',
  'mural.lido',
  'mural.antes',
  'mural.modificacoes',
]

/** O que só o mestre pode pedir (§6.4). */
export const PEDIDOS_DO_MESTRE: ReadonlySet<TipoDoPedidoDoMural> = new Set(['mural.postar', 'mural.editar', 'mural.apagar', 'mural.fixar'])

function tipoDoPedido(valor: unknown): TipoDoPedidoDoMural | null {
  return TIPOS_DO_PEDIDO.find((tipo) => tipo === valor) ?? null
}

export function ehReacaoDoMural(valor: unknown): valor is ReacaoDoMural {
  return MURAL_REACOES.some((reacao) => reacao === valor)
}

function idValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1
}

/** `null`/ausente = sem; senão só `midia:<id>` na forma exata. `undefined` = fora do formato. */
function lerImagem(valor: unknown): string | null | undefined {
  if (valor === null || valor === undefined) return null
  return ehRefDeMidia(valor) ? valor : undefined
}

/** `null`/ausente = sem filtro; senão um segmento válido. `undefined` = fora do formato. */
function lerFiltro(valor: unknown): string | null | undefined {
  if (valor === null || valor === undefined) return null
  return segmentoValido(valor) ? valor : undefined
}

/** `null`/ausente = do começo (o mais novo); senão um id/rev ≥ 1. `undefined` = fora do formato. */
function lerCursor(valor: unknown): number | null | undefined {
  if (valor === null || valor === undefined) return null
  return idValido(valor) ? valor : undefined
}

function lerLimite(valor: unknown, maximo: number): number | null {
  return idValido(valor) ? Math.min(valor, maximo) : null
}

function lerTextoEImagem(registro: Record<string, unknown>): { texto: string; imagem: string | null } | null {
  const texto = proprio(registro, 'texto')
  const imagem = lerImagem(proprio(registro, 'imagem'))
  return typeof texto === 'string' && imagem !== undefined ? { texto, imagem } : null
}

function lerPostar(registro: Record<string, unknown>): PedidoDoMural | null {
  const conteudo = lerTextoEImagem(registro)
  const idDoCliente = proprio(registro, 'idDoCliente')
  return conteudo !== null && segmentoValido(idDoCliente) ? { t: 'mural.postar', ...conteudo, idDoCliente } : null
}

function lerEditar(registro: Record<string, unknown>, id: number): PedidoDoMural | null {
  const conteudo = lerTextoEImagem(registro)
  return conteudo === null ? null : { t: 'mural.editar', id, ...conteudo }
}

function lerReagir(registro: Record<string, unknown>, id: number): PedidoDoMural | null {
  const reacao = proprio(registro, 'reacao')
  if (reacao === null) return { t: 'mural.reagir', id, reacao: null }
  return ehReacaoDoMural(reacao) ? { t: 'mural.reagir', id, reacao } : null
}

function lerAntes(registro: Record<string, unknown>): PedidoDoMural | null {
  const antesDeId = lerCursor(proprio(registro, 'antesDeId'))
  const limite = lerLimite(proprio(registro, 'limite'), MURAL_PAGINA_MAX)
  return antesDeId === undefined || limite === null ? null : { t: 'mural.antes', antesDeId, limite }
}

function lerModificacoes(registro: Record<string, unknown>): PedidoDoMural | null {
  const fichaId = lerFiltro(proprio(registro, 'fichaId'))
  const autorContaId = lerFiltro(proprio(registro, 'autorContaId'))
  const antesDeRev = lerCursor(proprio(registro, 'antesDeRev'))
  const limite = lerLimite(proprio(registro, 'limite'), MURAL_MODIFICACOES_PAGINA_MAX)
  if (fichaId === undefined || autorContaId === undefined || antesDeRev === undefined || limite === null) return null
  return { t: 'mural.modificacoes', fichaId, autorContaId, antesDeRev, limite }
}

/** Os pedidos que apontam uma notícia pelo `id`. */
function lerPedidoDaNoticia(tipo: TipoDoPedidoDoMural, registro: Record<string, unknown>, id: number): PedidoDoMural | null {
  switch (tipo) {
    case 'mural.editar':
      return lerEditar(registro, id)
    case 'mural.apagar':
      return { t: tipo, id }
    case 'mural.fixar': {
      const fixada = proprio(registro, 'fixada')
      return typeof fixada === 'boolean' ? { t: tipo, id, fixada } : null
    }
    case 'mural.reagir':
      return lerReagir(registro, id)
    case 'mural.lido': {
      const versao = proprio(registro, 'versao')
      return idValido(versao) ? { t: tipo, id, versao } : null
    }
    default:
      return null
  }
}

function pedidoDoRegistro(tipo: TipoDoPedidoDoMural, registro: Record<string, unknown>): PedidoDoMural | null {
  if (tipo === 'mural.postar') return lerPostar(registro)
  if (tipo === 'mural.antes') return lerAntes(registro)
  if (tipo === 'mural.modificacoes') return lerModificacoes(registro)
  const id = proprio(registro, 'id')
  return idValido(id) ? lerPedidoDaNoticia(tipo, registro, id) : null
}

/** Um frame `mural.*` do site. Fora do formato não lança: devolve o que dá para responder. */
export function lerPedidoDoMural(registro: Record<string, unknown>): LeituraDoPedidoDoMural {
  const tipo = tipoDoPedido(proprio(registro, 't'))
  if (tipo === null) return { ok: false, pedido: 'mural' }
  const pedido = pedidoDoRegistro(tipo, registro)
  if (pedido !== null) return { ok: true, pedido }
  const idDoCliente = proprio(registro, 'idDoCliente')
  return segmentoValido(idDoCliente) ? { ok: false, pedido: tipo, idDoCliente } : { ok: false, pedido: tipo }
}

/** O texto como os outros vão ler; `null` = não vai (vazio depois da limpeza ou acima do teto). */
export function textoDoMural(bruto: string): string | null {
  const limpo = cleanChatText(bruto)
  return limpo === '' || limpo.length > MURAL_TEXTO_MAX ? null : limpo
}

/** As menções da notícia: a mesma regra da sala do chat (`findMentions`, `@mestre`). */
export function mencoesDoMural(texto: string, membros: readonly MembroProjetado[]): string[] {
  return mencoesDaSala(texto, membros)
}

// ── Frases das modificações ─────────────────────────────────────────────────

/** Os nomes que o sistema dá às chaves da ficha (Vida para `hp`). Sem o nome, a frase usa a chave. */
export interface RotulosDoSistema {
  recursos: ReadonlyMap<string, string>
  atributos: ReadonlyMap<string, string>
  escolhas: ReadonlyMap<string, string>
  abas: ReadonlyMap<string, string>
}

function mapaDosNomes(lista: unknown, campoDoNome: 'nome' | 'rotulo'): ReadonlyMap<string, string> {
  const itens: unknown[] = Array.isArray(lista) ? Array.from(lista) : []
  const mapa = new Map<string, string>()
  for (const item of itens) {
    if (!ehRegistro(item)) continue
    const id = proprio(item, 'id')
    const nome = proprio(item, campoDoNome)
    if (typeof id === 'string' && typeof nome === 'string') mapa.set(id, nome)
  }
  return mapa
}

/** Lê só os nomes do sistema publicado (Json do `meta`), tolerante: o que não estiver no formato fica de fora. */
export function rotulosDoSistema(sistema: unknown): RotulosDoSistema {
  const registro = ehRegistro(sistema) ? sistema : {}
  return {
    recursos: mapaDosNomes(proprio(registro, 'recursos'), 'nome'),
    atributos: mapaDosNomes(proprio(registro, 'atributos'), 'nome'),
    escolhas: mapaDosNomes(proprio(registro, 'escolhas'), 'rotulo'),
    abas: mapaDosNomes(proprio(registro, 'abas'), 'nome'),
  }
}

/**
 * O que a frase pode ler da ficha: SÓ o nome, o nome dos cartões e o dos
 * itens da mochila (o que todo membro da mesa já vê). Nunca o doc inteiro:
 * campo do mestre não tem por onde entrar na frase.
 */
export interface FichaDaFrase {
  nome: string
  cartao(cartaoId: string): string | null
  item(vagaId: string): string | null
}

export function fichaDaFrase(doc: Personagem): FichaDaFrase {
  return {
    nome: doc.nome,
    cartao(cartaoId) {
      for (const cartoes of Object.values(doc.abas)) {
        const achado = cartoes.find((cartao) => cartao.id === cartaoId)
        if (achado !== undefined) return achado.nome
      }
      return null
    },
    // Mochila ausente = vazia (ficha de antes da migração da mochila).
    item: (vagaId) => doc.mochila?.find((item) => item.id === vagaId)?.nome ?? null,
  }
}

const TEXTO_NA_FRASE_MAX = 40

function numeroNaFrase(numero: number): string {
  return numero.toLocaleString('pt-BR')
}

function textoNaFrase(texto: string): string {
  const curto = texto.length > TEXTO_NA_FRASE_MAX ? `${texto.slice(0, TEXTO_NA_FRASE_MAX - 1)}…` : texto
  return `“${curto}”`
}

/** O valor de um campo dentro da frase. */
function valorNaFrase(valor: Json | undefined): string {
  if (typeof valor === 'number') return numeroNaFrase(valor)
  if (typeof valor === 'string') return valor === '' ? 'vazio' : textoNaFrase(valor)
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
  return valor === undefined || valor === null ? 'vazio' : 'outro valor'
}

function nomeDoValor(valor: Json | undefined): string | null {
  const nome = ehRegistro(valor) ? proprio(valor, 'nome') : undefined
  return typeof nome === 'string' && nome !== '' ? nome : null
}

function rotulo(mapa: ReadonlyMap<string, string>, chave: string | undefined): string {
  if (chave === undefined) return 'um campo'
  return mapa.get(chave) ?? chave
}

/** "mudou Vida de 30 para 24"; sem valor novo = tirou; sem valor antigo = pôs. */
function mudou(campo: string, op: OpGravada): string {
  if (op.acao === 'somar' && op.delta !== undefined) {
    return op.delta >= 0 ? `somou ${numeroNaFrase(op.delta)} em ${campo}` : `tirou ${numeroNaFrase(-op.delta)} de ${campo}`
  }
  if (op.valor === undefined) return `apagou ${campo}`
  if (op.antes === undefined) return `pôs ${campo} em ${valorNaFrase(op.valor)}`
  return `mudou ${campo} de ${valorNaFrase(op.antes)} para ${valorNaFrase(op.valor)}`
}

function quantidadeDoItem(valor: Json | undefined): number {
  const quantidade = ehRegistro(valor) ? proprio(valor, 'quantidade') : undefined
  // Ausente vale 1 (`quantidadeDe`, lib/items.ts).
  return typeof quantidade === 'number' ? quantidade : 1
}

function fraseDaMochila(op: OpGravada, vagaId: string | undefined, resto: readonly string[], ficha: FichaDaFrase): string {
  if (resto.length === 0) {
    if (op.acao === 'criar') return `pegou ${numeroNaFrase(quantidadeDoItem(op.valor))}× ${nomeDoValor(op.valor) ?? 'um item'}`
    if (op.acao === 'apagar') return `tirou ${nomeDoValor(op.antes) ?? 'um item'} da mochila`
  }
  const nome = (vagaId === undefined ? null : ficha.item(vagaId)) ?? 'um item'
  if (resto[0] === 'quantidade' && op.acao === 'somar' && op.delta !== undefined) {
    return op.delta >= 0 ? `pegou ${numeroNaFrase(op.delta)}× ${nome}` : `tirou ${numeroNaFrase(-op.delta)}× ${nome} da mochila`
  }
  if (resto[0] === 'quantidade') return mudou(`a quantidade de ${nome}`, op)
  return `mudou ${nome} na mochila`
}

function fraseDasMoedas(op: OpGravada): string {
  if (op.acao !== 'somar' || op.delta === undefined) return mudou('as moedas', op)
  const quantas = Math.abs(op.delta)
  const moedas = quantas === 1 ? 'moeda' : 'moedas'
  return `${op.delta >= 0 ? 'ganhou' : 'gastou'} ${numeroNaFrase(quantas)} ${moedas}`
}

function fraseDoCartao(op: OpGravada, aba: string | undefined, resto: readonly string[], ficha: FichaDaFrase, rotulos: RotulosDoSistema): string {
  const nomeDaAba = rotulo(rotulos.abas, aba)
  const [cartaoId] = resto
  if (cartaoId === '#ordem') return `reordenou ${nomeDaAba}`
  if (resto.length === 1 && op.acao === 'criar') return `adicionou ${textoNaFrase(nomeDoValor(op.valor) ?? 'um cartão')} em ${nomeDaAba}`
  if (resto.length === 1 && op.acao === 'apagar') return `tirou ${textoNaFrase(nomeDoValor(op.antes) ?? 'um cartão')} de ${nomeDaAba}`
  const nome = (cartaoId === undefined ? null : ficha.cartao(cartaoId)) ?? 'um cartão'
  return `mudou ${textoNaFrase(nome)} em ${nomeDaAba}`
}

function fraseDoCartaoAtivo(op: OpGravada, cartaoId: string | undefined, ficha: FichaDaFrase): string {
  const nome = textoNaFrase((cartaoId === undefined ? null : ficha.cartao(cartaoId)) ?? 'um cartão')
  return op.valor === true ? `ativou ${nome}` : `desativou ${nome}`
}

/** A parte da frase depois do nome de quem mudou. */
function oQueMudou(op: OpGravada, ficha: FichaDaFrase, rotulos: RotulosDoSistema): string {
  const [topo, chave, ...resto] = op.caminho
  switch (topo) {
    case undefined:
      return op.acao === 'apagar' ? 'apagou a ficha' : 'criou a ficha'
    case 'nome':
      return mudou('o nome', op)
    case 'descricao':
      return 'mudou a descrição'
    case 'retrato':
      return 'trocou o retrato'
    case 'etiquetas':
      return op.acao === 'apagar' ? `tirou a etiqueta ${textoNaFrase(chave ?? '')}` : `pôs a etiqueta ${textoNaFrase(chave ?? '')}`
    case 'escolhas':
      return mudou(rotulo(rotulos.escolhas, chave), op)
    case 'recursos':
      return mudou(rotulo(rotulos.recursos, chave), op)
    case 'maximos':
      return mudou(`o máximo de ${rotulo(rotulos.recursos, chave)}`, op)
    case 'modificadoresDosRecursos':
      return mudou(`o modificador de ${rotulo(rotulos.recursos, chave)}`, op)
    case 'atributos':
      return mudou(rotulo(rotulos.atributos, chave), op)
    case 'modificadoresDosAtributos':
      return mudou(`o modificador de ${rotulo(rotulos.atributos, chave)}`, op)
    case 'cartoesAtivos':
      return fraseDoCartaoAtivo(op, chave, ficha)
    case 'abas':
      return fraseDoCartao(op, chave, resto, ficha, rotulos)
    case 'mochila':
      return fraseDaMochila(op, chave, resto, ficha)
    case 'moedas':
      return fraseDasMoedas(op)
    // Campos do mestre: a op só chega aqui no feed do próprio mestre (a projeção tira do jogador).
    case 'notaDoMestre':
      return 'mudou a nota do mestre'
    case 'dono':
      return 'mudou o dono da ficha'
    default:
      // Os outros campos do mestre e o bloco Dragon Ball (fora da v1): sem detalhe.
      return 'mudou a ficha'
  }
}

/**
 * A linha do feed para `op`, que JÁ vem projetada para quem lê (o servidor
 * chama `projetarOpParaJogador` antes; op que não vai ao jogador nem chega
 * aqui). A frase lê só a op e a `FichaDaFrase`.
 */
export function modificacaoDoMural(op: OpGravada, ficha: FichaDaFrase, rotulos: RotulosDoSistema): ModificacaoDoMural {
  const linha: ModificacaoDoMural = {
    rev: op.rev,
    quando: op.quando,
    fichaId: op.fichaId,
    fichaNome: ficha.nome,
    autorContaId: op.autorContaId,
    autorNome: op.autorNome,
    frase: `${op.autorNome} ${oQueMudou(op, ficha, rotulos)}`,
  }
  if (op.desfaz !== undefined) linha.desfazendo = true
  return linha
}
