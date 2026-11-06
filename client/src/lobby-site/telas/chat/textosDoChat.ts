import { CHAT_MASTER_MENTION, mentionSpans } from '../../../lib/chat'
import { CHAT_NAO_LIDAS_MAX, type MensagemDoChat, type MotivoDoChatRecusado } from '../../../lib/nuvem/chatDoLobby'
import { CONTA_DO_MESTRE, type MembroProjetado } from '../../../lib/nuvem/tipos'
import type { SituacaoDoEnvio } from '../../dados/chatDaCampanha'

/**
 * OS TEXTOS DO CHAT (fatia C2), puros: o aviso do privado (texto aprovado na
 * 12.19 do plano, literal), o nome de cada conversa, o motivo de uma recusa,
 * os pedaços da mensagem com as menções e o arquivo de "baixar minha conversa".
 */

/**
 * O aviso honesto do privado entre dois jogadores (plano do Lobby, 12.19,
 * aprovado pelo usuário em 05/11/2026): uma vez ao abrir o primeiro privado e
 * sempre no rodapé dele. Não trocar uma palavra sem o usuário.
 */
export const AVISO_DO_PRIVADO =
  'O mestre não vê esta conversa no app nem no site. Ela fica guardada no servidor da mesa, que é do mestre; quem controla o servidor poderia mudá-lo. Se a conversa sumir de repente, a conta do outro lado mudou de e-mail: confirme com a pessoa antes de continuar. Não escreva aqui nada que você não diria perto da mesa.'

/** Duas mensagens seguidas da mesma pessoa a menos disto viram um bloco só (nome e foto uma vez). */
const JUNTAR_ATE_MS = 5 * 60_000

/** "Rafa (mestre)", "Você", "Caio". */
export function nomeNoChat(autorContaId: string, autorNome: string, eu: string | null): string {
  if (autorContaId === eu) return 'Você'
  return autorContaId === CONTA_DO_MESTRE ? `${autorNome} (mestre)` : autorNome
}

/** "99", e "100+" no teto do servidor (a contagem para ali). */
export function contagemDeNaoLidas(n: number): string {
  return n >= CHAT_NAO_LIDAS_MAX ? `${CHAT_NAO_LIDAS_MAX}+` : n.toLocaleString('pt-BR')
}

/** O privado é entre dois jogadores (o único que leva o aviso: o do mestre com um jogador o mestre lê, claro). */
export function privadoEntreJogadores(eu: MembroProjetado | null, outro: string): boolean {
  return eu !== null && eu.papel === 'jogador' && outro !== CONTA_DO_MESTRE
}

export function textoDaSituacao(situacao: SituacaoDoEnvio, agora: number): string {
  switch (situacao.t) {
    case 'enviando':
      return 'enviando…'
    case 'esperando': {
      const segundos = Math.max(1, Math.ceil((situacao.ate - agora) / 1000))
      if (situacao.motivo === 'ritmo') return `Devagar: vai sozinha em ${segundos} s`
      return segundos < 120 ? `Limite do dia: vai sozinha em ${segundos} s` : `Limite de mensagens de hoje: vai sozinha às ${horaCurta(situacao.ate)}`
    }
    case 'recusada':
      return textoDoMotivo(situacao.motivo)
  }
}

export function textoDoMotivo(motivo: MotivoDoChatRecusado): string {
  switch (motivo) {
    case 'texto':
      return 'Não foi: a mensagem ficou vazia ou passou de 1.000 caracteres.'
    case 'canal':
      return 'Não foi: esta pessoa não está mais na mesa.'
    case 'sem-permissao':
      return 'Não foi: o servidor não deixou.'
    case 'nao-existe':
      return 'Não foi: a mensagem não existe mais.'
    case 'formato':
      return 'Não foi: o servidor não entendeu o pedido. Recarregue a página.'
    case 'ritmo':
      return 'Devagar: espere um instante.'
    case 'cota':
      return 'Limite de mensagens de hoje atingido.'
  }
}

/** Um pedaço do texto da mensagem: texto corrido ou uma menção (`@Nome`), marcada quando é a quem lê. */
export type PedacoDoTexto = { t: 'texto'; texto: string } | { t: 'mencao'; texto: string; aMim: boolean }

/**
 * O texto em pedaços, com as menções no lugar (pela mesma regra do
 * servidor, `findMentions`). `meuNome` = o nome de quem lê, ou `mestre` quando
 * é o mestre (o `@mestre` também é dele).
 */
export function pedacosDoTexto(texto: string, membros: readonly MembroProjetado[], eu: MembroProjetado | null): PedacoDoTexto[] {
  const nomes = [CHAT_MASTER_MENTION, ...membros.map((membro) => membro.nome)]
  const meus = new Set<string>()
  if (eu !== null) {
    meus.add(eu.nome.toLowerCase())
    if (eu.papel === 'mestre') meus.add(CHAT_MASTER_MENTION)
  }
  const pedacos: PedacoDoTexto[] = []
  let desde = 0
  for (const span of mentionSpans(texto, nomes)) {
    // Um nome com "@" dentro pode cobrir o começo da menção seguinte: essa fica como texto.
    if (span.start < desde) continue
    if (span.start > desde) pedacos.push({ t: 'texto', texto: texto.slice(desde, span.start) })
    pedacos.push({ t: 'mencao', texto: texto.slice(span.start, span.end), aMim: meus.has(span.name.toLowerCase()) })
    desde = span.end
  }
  if (desde < texto.length) pedacos.push({ t: 'texto', texto: texto.slice(desde) })
  return pedacos
}

/** A mensagem continua o bloco da anterior (mesma pessoa, pouco depois, mesmo dia, nenhuma das duas apagada). */
export function continuaOBloco(anterior: MensagemDoChat | undefined, atual: MensagemDoChat): boolean {
  if (anterior === undefined || anterior.autorContaId !== atual.autorContaId) return false
  if (atual.criadaEm - anterior.criadaEm > JUNTAR_ATE_MS) return false
  return new Date(anterior.criadaEm).toDateString() === new Date(atual.criadaEm).toDateString()
}

function horaCurta(t: number): string {
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function dataEHora(t: number): string {
  return new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export interface CabecaDoArquivo {
  nomeDaMesa: string
  nomeDaConversa: string
  quemBaixou: string
  agora: number
}

/**
 * "Baixar minha conversa": texto puro, uma mensagem por linha com a data e
 * quem disse; a continuação de uma mensagem de várias linhas vem recuada; a
 * apagada fica como "(mensagem apagada)". Nada é interpretado: é o texto como
 * foi dito.
 */
export function textoDoArquivo(cabeca: CabecaDoArquivo, mensagens: readonly MensagemDoChat[], eu: string | null): string {
  const linhas = [
    `Lobby do Labirinto: ${cabeca.nomeDaMesa}`,
    `Conversa: ${cabeca.nomeDaConversa}`,
    `Baixada em ${dataEHora(cabeca.agora)} por ${cabeca.quemBaixou}`,
    `${mensagens.length} ${mensagens.length === 1 ? 'mensagem' : 'mensagens'}`,
    '',
  ]
  for (const msg of mensagens) {
    const quem = nomeNoChat(msg.autorContaId, msg.autorNome, eu)
    const texto = msg.apagadaEm === null ? msg.texto : '(mensagem apagada)'
    const [primeira, ...resto] = texto.split('\n')
    linhas.push(`[${dataEHora(msg.criadaEm)}] ${quem}: ${primeira}`)
    for (const linha of resto) linhas.push(`    ${linha}`)
  }
  return `${linhas.join('\r\n')}\r\n`
}

/** Nome de arquivo seguro: só letras sem acento, números e hífen. */
export function nomeDoArquivo(nomeDaMesa: string, nomeDaConversa: string, agora: number): string {
  const limpar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40)
  const dia = new Date(agora)
  const data = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
  return `chat-${limpar(nomeDaMesa) || 'mesa'}-${limpar(nomeDaConversa) || 'conversa'}-${data}.txt`
}
