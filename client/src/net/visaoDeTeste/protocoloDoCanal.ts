import type { FichaParaTeste } from './tipos'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Número de conexão ou de geração: inteiro positivo (o contador de quem o criou). */
function contador(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
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

/** Mensagem do host para a janela da sessão `sessao`, ou `null` (torta, de outra sessão ou do outro lado). */
export function lerMensagemDoHost(dado: unknown, sessao: string): MensagemDoHost | null {
  if (!isRecord(dado) || dado.de !== 'host' || dado.sessao !== sessao) return null
  switch (dado.tipo) {
    case 'config': {
      const { geracao, codigo, nome, ficha, fichas, fichaSelecionadaId } = dado
      const geracaoLida = contador(geracao)
      const fichaLida = lerFicha(ficha)
      const fichasLidas = lerFichas(fichas)
      const selecionada = textoOuNull(fichaSelecionadaId)
      if (geracaoLida === null || typeof codigo !== 'string' || typeof nome !== 'string') return null
      if (fichaLida === null || fichasLidas === null || selecionada === undefined) return null
      return { de: 'host', tipo: 'config', sessao, geracao: geracaoLida, codigo, nome, ficha: fichaLida, fichas: fichasLidas, fichaSelecionadaId: selecionada }
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
    default:
      return null
  }
}
