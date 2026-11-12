import { ehBaseDeMidiaLocal } from '../../lib/midia'
import type { CampoDoPedido, FichaParaTeste, ModoDoTeste, PedidoDoTeste } from './tipos'

/**
 * O que passa entre a janela principal (o host de teste, `visaoDeTeste.ts`) e
 * a janela da Visão de jogador (`player/visaoDeTeste/entrada.tsx`) pelo canal
 * (`canal.ts`). Pelo canal só anda o protocolo da LAN, embrulhado: a conexão
 * `conexao` faz o papel do WebSocket de um jogador.
 *
 * O canal é aberto a qualquer página do app (mesma origem): por isso toda
 * mensagem diz de que lado veio (`de`) e de que sessão é, e quem recebe valida
 * a forma antes de usar. Mensagem torta ou de outra sessão é ignorada.
 */

/** Formato da sessão: o mesmo que o comando Rust `abrir_visao_jogador` aceita. */
export const SESSAO_VALIDA = /^[A-Za-z0-9-]{8,64}$/

export type MensagemDoHost =
  /** Quem a janela é: o código da sala de teste, o nome com que entra e a ficha. `geracao` nova = recomeçar a conexão. */
  | {
      de: 'host'
      tipo: 'config'
      sessao: string
      geracao: number
      codigo: string
      nome: string
      ficha: FichaParaTeste
      fichas: FichaParaTeste[]
      fichaSelecionadaId: string | null
      /**
       * MÍDIA DA MESA: o começo das URLs das imagens (item, retrato) neste
       * computador, pela ponte de arquivos do Tauri — a janela de teste não tem
       * sala para buscar `/media`. Ausente = só as imagens embutidas aparecem.
       */
      midia?: string
      /**
       * O modo em que a janela passa a ficar: a página nova (abrir, recarregar)
       * e o "Ver tela" do Grupo, que abre no Olhar. Ausente = a janela fica no
       * modo em que está ("Trocar ficha" não muda o modo).
       */
      modo?: ModoDoTeste
    }
  /** A lista do "Trocar ficha" mudou (o mestre editou a cena aberta ou a seleção). */
  | { de: 'host'; tipo: 'fichas'; sessao: string; fichas: FichaParaTeste[]; fichaSelecionadaId: string | null }
  /** A conexão `conexao` abriu: o socket da janela dispara o `onopen`. */
  | { de: 'host'; tipo: 'aberto'; sessao: string; conexao: number }
  /** Mensagem do host (protocolo da LAN) para a conexão `conexao`. */
  | { de: 'host'; tipo: 'msg'; sessao: string; conexao: number; msg: object }
  /** O host derrubou a conexão (`net_kick`): o socket da janela fecha. */
  | { de: 'host'; tipo: 'derrubar'; sessao: string; conexao: number }
  /** Prova de vida: a janela responde `pong` na hora. */
  | { de: 'host'; tipo: 'ping'; sessao: string }
  /** O teste acabou: a janela larga a conexão e mostra que encerrou. */
  | { de: 'host'; tipo: 'encerrar'; sessao: string }
  /** Os pedidos que esperam o mestre (caça J6), a lista inteira a cada mudança. Só valem na `geracao` deles. */
  | { de: 'host'; tipo: 'pedidos'; sessao: string; geracao: number; pedidos: PedidoDoTeste[] }

export type MensagemDaJanela =
  /** A janela carregou (ou recarregou): o host (re)começa a sessão e manda o `config`. */
  | { de: 'janela'; tipo: 'ola'; sessao: string }
  /** Conexão nova da `geracao` atual (o `createSocket` do cliente). */
  | { de: 'janela'; tipo: 'abrir'; sessao: string; geracao: number; conexao: number }
  /** Mensagem do jogador (o texto que iria pelo WebSocket). */
  | { de: 'janela'; tipo: 'msg'; sessao: string; conexao: number; data: string }
  /** O cliente fechou a conexão (`socket.close()`). */
  | { de: 'janela'; tipo: 'fechar-conexao'; sessao: string; conexao: number }
  | { de: 'janela'; tipo: 'pong'; sessao: string }
  /** "Trocar ficha" da barra da janela. */
  | { de: 'janela'; tipo: 'trocar-ficha'; sessao: string; tokenId: string }
  /** "Esquecer tudo" da barra da janela: a memória do jogador de teste volta a zero, em todas as cenas. */
  | { de: 'janela'; tipo: 'esquecer'; sessao: string }
  /** "Fechar" da barra da janela. */
  | { de: 'janela'; tipo: 'pedir-fechar'; sessao: string }
  /** A janela ficou escondida (minimizada) ou voltou: escondida, o host não manda o recorte agendado. */
  | { de: 'janela'; tipo: 'visibilidade'; sessao: string; oculta: boolean }
  /** O mestre respondeu um pedido na janela de teste: `botao` = posição em `botoes`; `null` = o campo `responder`. */
  | { de: 'janela'; tipo: 'responder-pedido'; sessao: string; id: string; botao: number | null; texto: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Número de conexão ou de geração: inteiro positivo (o contador de quem o criou). */
function contador(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function ehModoDoTeste(value: unknown): value is ModoDoTeste {
  return value === 'olhar' || value === 'jogar'
}

function textoOuNull(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' ? value : undefined
}

function lerFicha(value: unknown): FichaParaTeste | null {
  if (!isRecord(value)) return null
  const { id, nome, retrato, cor, dono, npc } = value
  if (typeof id !== 'string' || typeof nome !== 'string' || typeof cor !== 'string' || typeof npc !== 'boolean') return null
  const retratoLido = textoOuNull(retrato)
  const donoLido = textoOuNull(dono)
  if (retratoLido === undefined || donoLido === undefined) return null
  return { id, nome, retrato: retratoLido, cor, dono: donoLido, npc }
}

function lerFichas(value: unknown): FichaParaTeste[] | null {
  if (!Array.isArray(value)) return null
  const fichas: FichaParaTeste[] = []
  for (const item of value) {
    const ficha = lerFicha(item)
    if (ficha === null) return null
    fichas.push(ficha)
  }
  return fichas
}

/** Teto de texto que a janela de teste aceita num pedido ou devolve numa resposta. */
const TEXTO_DO_PEDIDO_MAX = 2000
/** Teto de pedidos numa lista: o que passar disso é mensagem torta. */
const PEDIDOS_MAX = 50

function textoCurto(value: unknown): value is string {
  return typeof value === 'string' && value.length <= TEXTO_DO_PEDIDO_MAX
}

/** Campo de um pedido: `undefined` = ausente, `null` = torto. */
function lerCampoDoPedido(value: unknown): CampoDoPedido | null | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) return null
  const { rotulo, maxLength } = value
  const tamanho = contador(maxLength)
  if (!textoCurto(rotulo) || tamanho === null || tamanho > TEXTO_DO_PEDIDO_MAX) return null
  return { rotulo, maxLength: tamanho }
}

function lerPedido(value: unknown): PedidoDoTeste | null {
  if (!isRecord(value)) return null
  const { id, texto, botoes } = value
  if (!textoCurto(id) || !textoCurto(texto) || !Array.isArray(botoes) || !botoes.every(textoCurto)) return null
  const campo = lerCampoDoPedido(value.campo)
  const responder = lerCampoDoPedido(value.responder)
  if (campo === null || responder === null) return null
  const pedido: PedidoDoTeste = { id, texto, botoes: [...botoes] }
  if (campo !== undefined) pedido.campo = campo
  if (responder !== undefined) pedido.responder = responder
  return pedido
}

function lerPedidos(value: unknown): PedidoDoTeste[] | null {
  if (!Array.isArray(value) || value.length > PEDIDOS_MAX) return null
  const pedidos: PedidoDoTeste[] = []
  for (const item of value) {
    const pedido = lerPedido(item)
    if (pedido === null) return null
    pedidos.push(pedido)
  }
  return pedidos
}

/** Posição de botão: inteiro de 0 em diante; `null` = o campo do pedido; `undefined` = torto. */
function lerBotao(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

/** Mensagem do host para a janela da sessão `sessao`, ou `null` (torta, de outra sessão ou do outro lado). */
export function lerMensagemDoHost(dado: unknown, sessao: string): MensagemDoHost | null {
  if (!isRecord(dado) || dado.de !== 'host' || dado.sessao !== sessao) return null
  switch (dado.tipo) {
    case 'config': {
      const { geracao, codigo, nome, ficha, fichas, fichaSelecionadaId, midia, modo } = dado
      const geracaoLida = contador(geracao)
      const fichaLida = lerFicha(ficha)
      const fichasLidas = lerFichas(fichas)
      const selecionada = textoOuNull(fichaSelecionadaId)
      if (geracaoLida === null || typeof codigo !== 'string' || typeof nome !== 'string') return null
      if (fichaLida === null || fichasLidas === null || selecionada === undefined) return null
      // Base que não é da ponte de arquivos sai calada: a janela não carrega imagem de fora.
      const comMidia = ehBaseDeMidiaLocal(midia) ? { midia } : {}
      // Modo que esta versão não conhece sai calado: a janela fica no modo em que está.
      const comModo = ehModoDoTeste(modo) ? { modo } : {}
      return { de: 'host', tipo: 'config', sessao, geracao: geracaoLida, codigo, nome, ficha: fichaLida, fichas: fichasLidas, fichaSelecionadaId: selecionada, ...comMidia, ...comModo }
    }
    case 'fichas': {
      const fichas = lerFichas(dado.fichas)
      const selecionada = textoOuNull(dado.fichaSelecionadaId)
      if (fichas === null || selecionada === undefined) return null
      return { de: 'host', tipo: 'fichas', sessao, fichas, fichaSelecionadaId: selecionada }
    }
    case 'aberto':
    case 'derrubar': {
      const conexao = contador(dado.conexao)
      return conexao === null ? null : { de: 'host', tipo: dado.tipo, sessao, conexao }
    }
    case 'msg': {
      const conexao = contador(dado.conexao)
      const { msg } = dado
      if (conexao === null || typeof msg !== 'object' || msg === null) return null
      return { de: 'host', tipo: 'msg', sessao, conexao, msg }
    }
    case 'ping':
    case 'encerrar':
      return { de: 'host', tipo: dado.tipo, sessao }
    case 'pedidos': {
      const geracao = contador(dado.geracao)
      const pedidos = lerPedidos(dado.pedidos)
      return geracao === null || pedidos === null ? null : { de: 'host', tipo: 'pedidos', sessao, geracao, pedidos }
    }
    default:
      return null
  }
}

/** Mensagem da janela da sessão `sessao` para o host, ou `null` (torta, de outra sessão ou do outro lado). */
export function lerMensagemDaJanela(dado: unknown, sessao: string): MensagemDaJanela | null {
  if (!isRecord(dado) || dado.de !== 'janela' || dado.sessao !== sessao) return null
  switch (dado.tipo) {
    case 'ola':
    case 'pong':
    case 'esquecer':
    case 'pedir-fechar':
      return { de: 'janela', tipo: dado.tipo, sessao }
    case 'abrir': {
      const geracao = contador(dado.geracao)
      const conexao = contador(dado.conexao)
      return geracao === null || conexao === null ? null : { de: 'janela', tipo: 'abrir', sessao, geracao, conexao }
    }
    case 'msg': {
      const conexao = contador(dado.conexao)
      const { data } = dado
      return conexao === null || typeof data !== 'string' ? null : { de: 'janela', tipo: 'msg', sessao, conexao, data }
    }
    case 'fechar-conexao': {
      const conexao = contador(dado.conexao)
      return conexao === null ? null : { de: 'janela', tipo: 'fechar-conexao', sessao, conexao }
    }
    case 'trocar-ficha': {
      const { tokenId } = dado
      return typeof tokenId === 'string' ? { de: 'janela', tipo: 'trocar-ficha', sessao, tokenId } : null
    }
    case 'visibilidade': {
      const { oculta } = dado
      return typeof oculta === 'boolean' ? { de: 'janela', tipo: 'visibilidade', sessao, oculta } : null
    }
    case 'responder-pedido': {
      const { id, texto } = dado
      const botao = lerBotao(dado.botao)
      if (!textoCurto(id) || !textoCurto(texto) || botao === undefined) return null
      return { de: 'janela', tipo: 'responder-pedido', sessao, id, botao, texto }
    }
    default:
      return null
  }
}
