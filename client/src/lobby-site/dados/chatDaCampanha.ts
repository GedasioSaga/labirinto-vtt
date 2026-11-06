import { CHAT_SEND_MIN_INTERVAL_MS, chatChannelKey } from '../../lib/chat'
import {
  CHAT_NAO_LIDAS_MAX,
  CHAT_PAGINA_MAX,
  textoDoChat,
  type CanalDoChat,
  type MensagemDoChat,
  type MensagemDoChatDoServidor,
  type MotivoDoChatRecusado,
  type PedidoDoChat,
  type ResumoDoCanal,
} from '../../lib/nuvem/chatDoLobby'
import { RELOGIO_DO_NAVEGADOR, type Relogio } from './fonte'
import type { ParteDoCanal } from './sessaoDaCampanha'

/**
 * O CHAT DE UMA CAMPANHA no site (plano do Lobby §8.2, fatia C2), sem React:
 * o lado do navegador do protocolo `chat.*` que o DO Campanha fala
 * (`lib/nuvem/chatDoLobby.ts`, `lobby/nuvem/src/chat.ts`), pelo MESMO canal
 * das fichas (a sessão o chama como `ParteDoCanal`).
 *
 * - Cada conversa (a sala e um privado por conta) guarda as mensagens que a
 *   tela já pediu, em ordem de id, e as PENDENTES: o que a pessoa mandou e o
 *   servidor ainda não confirmou ("enviando…" até o `chat.ok`). A pendente
 *   volta com o MESMO `idDoCliente` depois de uma queda, e o servidor responde
 *   com a mensagem já gravada em vez de gravar outra (nada duplica).
 * - Na volta, `chat.desde` com o maior `mudou` visto: o resumo (não lidas) e
 *   o que mudou desde então (mensagens novas e lápides). Longe demais, o
 *   servidor manda recomeçar, e a conversa aberta é pedida de novo.
 * - O cursor só anda pelo ao vivo depois de alcançar o resumo: assim uma
 *   queda no meio da volta não pula o que ainda não chegou.
 * - O DO passa TODO frame da conta pelo ritmo (fichas inclusive): o
 *   `chat.lida` sai uma vez por leitura, um por vez, e nunca repete o que já
 *   saiu (achado da revisão da C2).
 */

/** Mensagens por página na tela; para baixar a conversa inteira, a página maior do servidor. */
export const PAGINA_DO_CHAT = 50
/** Folga depois do `tentarDepoisDe`, para não chegar um instante antes e ser segurado de novo. */
const FOLGA_DA_ESPERA_MS = 50
/** Sem `tentarDepoisDe` na recusa por ritmo (não deveria faltar): espera isto. */
const ESPERA_SEM_HORA_MS = 1_000
/** O `chat.lida` sai depois de um instante parado: rolar a conversa não vira uma rajada de frames. */
const ESPERA_DA_LIDA_MS = 400

export type SituacaoDoEnvio =
  | { t: 'enviando' }
  /** Segurada pelo servidor (ritmo, ou a cota do dia): vai sozinha em `ate`. */
  | { t: 'esperando'; motivo: 'ritmo' | 'cota'; ate: number }
  /** O servidor não aceita esta: a pessoa descarta (ou tenta de novo). */
  | { t: 'recusada'; motivo: MotivoDoChatRecusado }

export interface MensagemPendente {
  idDoCliente: string
  /** O texto como vai (já passou pelo `cleanChatText`). */
  texto: string
  criadaEm: number
  situacao: SituacaoDoEnvio
}

export interface ConversaDoChat {
  /** `chatChannelKey` do canal: `'sala'` ou `'dm:<contaId>'`. */
  chave: string
  canal: CanalDoChat
  /** Em ordem de id; só o que a tela já pediu (a última página e as anteriores carregadas). */
  mensagens: readonly MensagemDoChat[]
  pendentes: readonly MensagemPendente[]
  /** A primeira página já chegou. */
  carregada: boolean
  /** Uma página está a caminho. */
  carregando: boolean
  temMaisAntigas: boolean
  ultimaId: number
  lidaAte: number
  /** De outras contas, depois de `lidaAte`; o servidor para de contar em `CHAT_NAO_LIDAS_MAX`. */
  naoLidas: number
  /** Chegou, ao vivo, uma menção a quem lê que ele ainda não leu. */
  mencaoNaoLida: boolean
  /** O servidor não abre esta conversa (privado com quem saiu da mesa). */
  fechada: boolean
  /** Juntando todas as páginas para baixar a conversa. */
  juntando: boolean
  /** Ids com o "apagar" a caminho. */
  apagando: ReadonlySet<number>
}

/** As mensagens de uma conversa que ainda não saíram, guardadas ao sair da mesa: voltam quando ela abrir de novo. */
export interface PendentesGuardadas {
  canal: CanalDoChat
  pendentes: readonly MensagemPendente[]
}

/** Quantas mensagens ainda vão sair (enviando ou seguradas); a recusada não conta, o servidor já disse não. */
export function pendentesACaminho(conversas: Iterable<{ pendentes: readonly MensagemPendente[] }>): number {
  let total = 0
  for (const conversa of conversas) for (const pendente of conversa.pendentes) if (pendente.situacao.t !== 'recusada') total += 1
  return total
}

export interface EstadoDoChat {
  /** O canal está em dia e o resumo chegou: dá para pedir e mandar. */
  pronto: boolean
  conversas: ReadonlyMap<string, ConversaDoChat>
  /** A soma das não lidas de todas as conversas (o título da página). */
  naoLidas: number
}

export interface ChatDaCampanha extends ParteDoCanal {
  estado(): EstadoDoChat
  /** A conversa que a tela mostra: pede a primeira página quando ainda não tem. */
  abrir(canal: CanalDoChat): void
  /** A tela saiu da conversa. */
  soltar(canal: CanalDoChat): void
  /** A pessoa viu o fim da conversa: zera as não lidas e avisa o servidor. */
  marcarLida(canal: CanalDoChat): void
  /** `false` = nada a pedir (já tem tudo, já está pedindo, ou o canal caiu). */
  carregarAnteriores(canal: CanalDoChat): boolean
  /** `false` = texto vazio depois da limpeza, ou acima do teto. Sem canal, a mensagem espera a volta. */
  enviar(canal: CanalDoChat, texto: string): boolean
  tentarDeNovo(canal: CanalDoChat, idDoCliente: string): void
  descartar(canal: CanalDoChat, idDoCliente: string): void
  /** Só a própria mensagem (o servidor confere). `false` = sem canal agora. */
  apagar(canal: CanalDoChat, id: number): boolean
  /** Todas as páginas da conversa, da mais velha para a mais nova (para baixar). Falha se o canal cair no meio. */
  juntarTudo(canal: CanalDoChat): Promise<readonly MensagemDoChat[]>
  /** As pendentes de cada conversa, para a mesa guardar antes de `fechar` (só vivem na memória da aba). */
  guardarPendentes(): readonly PendentesGuardadas[]
  fechar(): void
}

export interface OpcoesDoChat {
  /** O `enviarDoChat` da sessão. */
  enviar(pedido: PedidoDoChat): boolean
  /** O contaId de quem está vendo (da base da sessão); `null` antes dela chegar. */
  quemSouEu(): string | null
  aoMudar(estado: EstadoDoChat): void
  /** O que ficou sem sair da última vez que esta mesa abriu nesta aba: volta com o mesmo `idDoCliente` (o servidor não grava duas vezes). */
  pendentesGuardadas?: readonly PendentesGuardadas[]
  relogio?: Relogio
  novoId?: () => string
}

interface LidaAMandar {
  canal: CanalDoChat
  ateId: number
}

interface Juntador {
  resolver(lista: readonly MensagemDoChat[]): void
  rejeitar(erro: Error): void
}

function conversaVazia(canal: CanalDoChat): ConversaDoChat {
  return {
    chave: chatChannelKey(canal),
    canal,
    mensagens: [],
    pendentes: [],
    carregada: false,
    carregando: false,
    temMaisAntigas: false,
    ultimaId: 0,
    lidaAte: 0,
    naoLidas: 0,
    mencaoNaoLida: false,
    fechada: false,
    juntando: false,
    apagando: new Set(),
  }
}

/** As duas listas numa, por id, sem repetir: a versão de `novas` vence (a lápide substitui a mensagem). */
function juntarPorId(atuais: readonly MensagemDoChat[], novas: readonly MensagemDoChat[]): MensagemDoChat[] {
  const porId = new Map<number, MensagemDoChat>()
  for (const msg of atuais) porId.set(msg.id, msg)
  for (const msg of novas) porId.set(msg.id, msg)
  return [...porId.values()].sort((a, b) => a.id - b.id)
}

export function criarChatDaCampanha(opcoes: OpcoesDoChat): ChatDaCampanha {
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID())
  const conversas = new Map<string, ConversaDoChat>()
  let pronto = false
  let emDia = false
  let encerrado = false
  /** O maior `mudou` visto (a volta parte dele); `null` = nunca viu nada. */
  let cursor: number | null = null
  /** O cursor do resumo da volta em curso; o ao vivo só move o cursor depois de alcançá-lo. */
  let alvoDaVolta: number | null = null
  let alcancou = false
  /** As conversas abertas na tela agora (uma, quase sempre). */
  const abertas = new Set<string>()
  /** A página pedida por conversa (`null` = a primeira). */
  const paginasPedidas = new Map<string, number | null>()
  /** As esperas armadas (reenvio segurado, pedido repetido): canceladas na queda e no fim. */
  const esperas = new Set<() => void>()
  /** As lidas que ainda não saíram, por conversa (a mais nova vence). Saiu, sai daqui. */
  const lidasAMandar = new Map<string, LidaAMandar>()
  /**
   * A última lida que saiu, até o servidor confirmar com o resumo (ele só responde quando a lida avança). A recusa
   * por ritmo não diz a conversa: com uma lida no ar por vez, é esta; ela volta para a fila, e a queda também a devolve.
   */
  let lidaNoAr: { chave: string; lida: LidaAMandar } | null = null
  /** Recusada por ritmo: nenhuma lida sai antes disto. */
  let lidaSeguraAte = 0
  let esperaDaLida: (() => void) | null = null
  const juntadores = new Map<string, Juntador>()

  function montarEstado(): EstadoDoChat {
    let naoLidas = 0
    for (const conversa of conversas.values()) naoLidas += conversa.naoLidas
    return { pronto, conversas: new Map(conversas), naoLidas }
  }

  function publicar(): void {
    if (!encerrado) opcoes.aoMudar(montarEstado())
  }

  function conversaDe(canal: CanalDoChat): ConversaDoChat {
    const chave = chatChannelKey(canal)
    const atual = conversas.get(chave)
    if (atual !== undefined) return atual
    const nova = conversaVazia(canal)
    conversas.set(chave, nova)
    return nova
  }

  function mudar(canal: CanalDoChat, mudanca: (conversa: ConversaDoChat) => Partial<ConversaDoChat>): ConversaDoChat {
    const atual = conversaDe(canal)
    const nova = { ...atual, ...mudanca(atual) }
    conversas.set(atual.chave, nova)
    return nova
  }

  function esperar(ms: number, fazer: () => void): void {
    const cancelar = relogio.depois(Math.max(0, ms), () => {
      esperas.delete(cancelar)
      if (!encerrado) fazer()
    })
    esperas.add(cancelar)
  }

  function pararEsperas(): void {
    for (const cancelar of esperas) cancelar()
    esperas.clear()
    esperaDaLida?.()
    esperaDaLida = null
  }

  function moverCursor(mudou: number): void {
    if (alcancou) cursor = Math.max(cursor ?? 0, mudou)
  }

  // ── O que sai ────────────────────────────────────────────────────────────

  function pedirPagina(canal: CanalDoChat, antesDeId: number | null, limite: number): boolean {
    if (!emDia) return false
    if (!opcoes.enviar({ t: 'chat.antes', canal, antesDeId, limite })) return false
    paginasPedidas.set(chatChannelKey(canal), antesDeId)
    mudar(canal, () => ({ carregando: true }))
    return true
  }

  /** A conversa aberta sem a primeira página: pede (depois de alcançar o resumo, para não pedir duas vezes). */
  function pedirAsAbertas(): void {
    for (const chave of abertas) {
      const conversa = conversas.get(chave)
      if (conversa !== undefined && !conversa.carregada && !conversa.carregando && !conversa.fechada) pedirPagina(conversa.canal, null, PAGINA_DO_CHAT)
    }
  }

  function mandarPendente(canal: CanalDoChat, pendente: MensagemPendente): void {
    if (!emDia) return
    opcoes.enviar({ t: 'chat.enviar', canal, texto: pendente.texto, idDoCliente: pendente.idDoCliente })
  }

  /** As pendentes que podem ir agora vão; as seguradas ganham a espera delas. */
  function mandarPendentes(): void {
    const agora = relogio.agora()
    for (const conversa of conversas.values()) {
      for (const pendente of conversa.pendentes) {
        if (pendente.situacao.t === 'enviando') mandarPendente(conversa.canal, pendente)
        else if (pendente.situacao.t === 'esperando') armarReenvio(conversa.canal, pendente.idDoCliente, pendente.situacao.ate - agora)
      }
    }
  }

  /**
   * No fim da espera, vão juntas e na ordem em que foram escritas todas as seguradas da conversa cujo prazo
   * já passou: um relógio por mensagem soltaria a segunda antes da primeira, e a sala mostraria a resposta
   * antes da pergunta.
   */
  function armarReenvio(canal: CanalDoChat, idDoCliente: string, ms: number): void {
    esperar(ms + FOLGA_DA_ESPERA_MS, () => {
      const conversa = conversaDe(canal)
      const pendente = conversa.pendentes.find((candidata) => candidata.idDoCliente === idDoCliente)
      if (pendente === undefined || pendente.situacao.t !== 'esperando') return
      const limite = relogio.agora() + FOLGA_DA_ESPERA_MS
      const vencidas = conversa.pendentes.filter((candidata) => candidata.situacao.t === 'esperando' && candidata.situacao.ate <= limite)
      for (const vencida of vencidas) trocarSituacao(canal, vencida.idDoCliente, { t: 'enviando' })
      for (const vencida of vencidas) mandarPendente(canal, vencida)
      publicar()
    })
  }

  /** A última segurada da conversa: uma mensagem nova espera atrás dela em vez de passar na frente. */
  function seguradaDaConversa(canal: CanalDoChat): Extract<SituacaoDoEnvio, { t: 'esperando' }> | null {
    let ultima: Extract<SituacaoDoEnvio, { t: 'esperando' }> | null = null
    for (const pendente of conversaDe(canal).pendentes) if (pendente.situacao.t === 'esperando') ultima = pendente.situacao
    return ultima
  }

  function trocarSituacao(canal: CanalDoChat, idDoCliente: string, situacao: SituacaoDoEnvio): void {
    mudar(canal, (conversa) => ({
      pendentes: conversa.pendentes.map((pendente) => (pendente.idDoCliente === idDoCliente ? { ...pendente, situacao } : pendente)),
    }))
  }

  function armarLida(ms: number): void {
    esperaDaLida?.()
    esperaDaLida = relogio.depois(Math.max(ms, lidaSeguraAte - relogio.agora(), 0), mandarLidas)
  }

  /**
   * Uma lida por vez, no passo do ritmo: o DO conta todo frame da conta, e a rajada fica para o que a pessoa faz
   * (mensagem, ficha). Quase sempre há uma só na fila: a da conversa que a pessoa acabou de ler.
   */
  function mandarLidas(): void {
    esperaDaLida = null
    if (!emDia || encerrado) return
    const proxima = lidasAMandar.entries().next()
    if (proxima.done === true) return
    const [chave, lida] = proxima.value
    if (!opcoes.enviar({ t: 'chat.lida', canal: lida.canal, ateId: lida.ateId })) return
    lidasAMandar.delete(chave)
    lidaNoAr = { chave, lida }
    if (lidasAMandar.size > 0) armarLida(CHAT_SEND_MIN_INTERVAL_MS)
  }

  /** A maior lida desta conversa que o servidor ainda não mostrou (na fila ou no ar); 0 = nenhuma. */
  function lidaACaminho(chave: string): number {
    const naFila = lidasAMandar.get(chave)?.ateId ?? 0
    const noAr = lidaNoAr !== null && lidaNoAr.chave === chave ? lidaNoAr.lida.ateId : 0
    return Math.max(naFila, noAr)
  }

  /** A lida no ar volta para a fila, sem passar por cima de uma mais nova da mesma conversa. */
  function devolverLidaNoAr(): void {
    if (lidaNoAr === null) return
    const { chave, lida } = lidaNoAr
    lidaNoAr = null
    const naFila = lidasAMandar.get(chave)
    if (naFila === undefined || naFila.ateId < lida.ateId) lidasAMandar.set(chave, lida)
  }

  // ── O que chega ──────────────────────────────────────────────────────────

  function aplicarResumo(canais: readonly ResumoDoCanal[], cursorDoServidor: number): void {
    for (const resumo of canais) {
      const chave = chatChannelKey(resumo.canal)
      // O resumo que já mostra a lida no ar: ela entrou, a queda não precisa devolvê-la.
      if (lidaNoAr !== null && lidaNoAr.chave === chave && resumo.lidaAte >= lidaNoAr.lida.ateId) lidaNoAr = null
      // Uma lida desta aba ainda a caminho (na fila, ou segurada pelo ritmo): o resumo de outra lida não desfaz a leitura na tela.
      const aCaminho = lidaACaminho(chave)
      mudar(resumo.canal, (conversa) => {
        const naoLidas = aCaminho >= resumo.ultimaId ? 0 : resumo.naoLidas
        return {
          ultimaId: Math.max(conversa.ultimaId, resumo.ultimaId),
          lidaAte: Math.max(resumo.lidaAte, aCaminho),
          naoLidas,
          mencaoNaoLida: naoLidas === 0 ? false : conversa.mencaoNaoLida,
        }
      })
    }
    if (!alcancou) alvoDaVolta = cursorDoServidor
    pronto = true
  }

  /** Mensagem nova ou lápide numa conversa: entra se a conversa já tem a página dela. */
  function aplicarMensagem(canal: CanalDoChat, msg: MensagemDoChat): ConversaDoChat {
    return mudar(canal, (conversa) => {
      const primeira = conversa.mensagens.at(0)
      // Mais velha que a página carregada: chega quando a pessoa pedir as anteriores.
      const entra = conversa.carregada && (primeira === undefined || msg.id >= primeira.id || !conversa.temMaisAntigas)
      return {
        mensagens: entra ? juntarPorId(conversa.mensagens, [msg]) : conversa.mensagens,
        ultimaId: Math.max(conversa.ultimaId, msg.id),
      }
    })
  }

  /** Recomeçar: esquece as páginas (as contagens e as pendentes ficam) e pede de novo a conversa aberta. */
  function recomecar(ate: number): void {
    for (const conversa of conversas.values()) {
      conversas.set(conversa.chave, { ...conversa, mensagens: [], carregada: false, carregando: false, temMaisAntigas: false })
    }
    paginasPedidas.clear()
    cursor = ate
    alcancou = true
    for (const juntador of juntadores.values()) juntador.rejeitar(new Error('A conversa foi recarregada; tente baixar de novo'))
    juntadores.clear()
  }

  function receberMudancas(mensagem: Extract<MensagemDoChatDoServidor, { t: 'chat.mudancas' }>): void {
    if (mensagem.recomecar === true) {
      recomecar(mensagem.ate)
    } else {
      for (const { canal, msg } of mensagem.lista) aplicarMensagem(canal, msg)
      cursor = Math.max(cursor ?? 0, mensagem.ate)
      if (mensagem.ate >= (alvoDaVolta ?? 0)) alcancou = true
    }
    if (alcancou) pedirAsAbertas()
  }

  function receberMsgAoVivo(canal: CanalDoChat, msg: MensagemDoChat): void {
    const eu = opcoes.quemSouEu()
    const antes = conversaDe(canal)
    const nova = msg.id > antes.ultimaId && msg.id > antes.lidaAte
    aplicarMensagem(canal, msg)
    moverCursor(msg.mudou)
    if (!nova || msg.autorContaId === eu || msg.apagadaEm !== null) return
    mudar(canal, (conversa) => ({
      naoLidas: Math.min(CHAT_NAO_LIDAS_MAX, conversa.naoLidas + 1),
      mencaoNaoLida: conversa.mencaoNaoLida || (eu !== null && msg.mencoes.includes(eu)),
    }))
  }

  function receberLista(mensagem: Extract<MensagemDoChatDoServidor, { t: 'chat.lista' }>): void {
    const chave = chatChannelKey(mensagem.canal)
    const pedida = paginasPedidas.get(chave)
    paginasPedidas.delete(chave)
    const conversa = mudar(mensagem.canal, (atual) => {
      const ultima = mensagem.lista.at(-1)
      // A primeira página substitui o que havia (fica o ao vivo que chegou enquanto ela vinha); a anterior entra na frente.
      const base = pedida === null || pedida === undefined ? atual.mensagens.filter((msg) => ultima === undefined || msg.id > ultima.id) : atual.mensagens
      return {
        mensagens: juntarPorId(base, mensagem.lista),
        carregada: true,
        carregando: false,
        temMaisAntigas: mensagem.temMaisAntigas,
        ultimaId: Math.max(atual.ultimaId, ultima?.id ?? 0),
      }
    })
    const juntador = juntadores.get(chave)
    if (juntador === undefined) return
    const primeira = conversa.mensagens.at(0)
    if (conversa.temMaisAntigas && primeira !== undefined) {
      if (!pedirPagina(conversa.canal, primeira.id, CHAT_PAGINA_MAX)) terminarJuntar(chave, new Error('A conexão caiu no meio'))
      return
    }
    terminarJuntar(chave, null)
  }

  function terminarJuntar(chave: string, erro: Error | null): void {
    const juntador = juntadores.get(chave)
    juntadores.delete(chave)
    const conversa = conversas.get(chave)
    if (conversa !== undefined) conversas.set(chave, { ...conversa, juntando: false })
    if (juntador === undefined) return
    if (erro === null) juntador.resolver(conversa?.mensagens ?? [])
    else juntador.rejeitar(erro)
  }

  function receberRecusa(mensagem: Extract<MensagemDoChatDoServidor, { t: 'chat.recusado' }>): void {
    const agora = relogio.agora()
    const ate = mensagem.tentarDepoisDe ?? agora + ESPERA_SEM_HORA_MS
    const seguradoPeloRitmo = mensagem.motivo === 'ritmo'
    switch (mensagem.pedido) {
      case 'chat.enviar': {
        const idDoCliente = mensagem.idDoCliente
        const conversa = [...conversas.values()].find((candidata) => candidata.pendentes.some((pendente) => pendente.idDoCliente === idDoCliente))
        if (conversa === undefined || idDoCliente === undefined) return
        if (mensagem.motivo === 'ritmo' || mensagem.motivo === 'cota') {
          trocarSituacao(conversa.canal, idDoCliente, { t: 'esperando', motivo: mensagem.motivo, ate })
          armarReenvio(conversa.canal, idDoCliente, ate - agora)
        } else {
          trocarSituacao(conversa.canal, idDoCliente, { t: 'recusada', motivo: mensagem.motivo })
        }
        return
      }
      case 'chat.antes': {
        // A recusa não diz de qual conversa: a que está pedindo página é a única que pode ser.
        for (const [chave, antesDeId] of paginasPedidas) {
          const conversa = conversas.get(chave)
          if (conversa === undefined) continue
          paginasPedidas.delete(chave)
          if (seguradoPeloRitmo) {
            esperar(ate - agora + FOLGA_DA_ESPERA_MS, () => {
              mudar(conversa.canal, () => ({ carregando: false }))
              if (pedirPagina(conversa.canal, antesDeId, juntadores.has(chave) ? CHAT_PAGINA_MAX : PAGINA_DO_CHAT)) publicar()
            })
          } else {
            conversas.set(chave, { ...conversa, carregando: false, fechada: mensagem.motivo === 'canal' })
            if (juntadores.has(chave)) terminarJuntar(chave, new Error('O servidor não abriu esta conversa'))
          }
        }
        return
      }
      case 'chat.desde':
        if (seguradoPeloRitmo) esperar(ate - agora + FOLGA_DA_ESPERA_MS, pedirDesde)
        return
      case 'chat.lida':
        if (!seguradoPeloRitmo) return
        devolverLidaNoAr()
        lidaSeguraAte = ate + FOLGA_DA_ESPERA_MS
        armarLida(0)
        return
      case 'chat.apagar':
        for (const conversa of conversas.values()) if (conversa.apagando.size > 0) conversas.set(conversa.chave, { ...conversa, apagando: new Set() })
        return
      case 'chat':
        return
    }
  }

  function pedirDesde(): void {
    if (!emDia) return
    alcancou = false
    alvoDaVolta = null
    opcoes.enviar({ t: 'chat.desde', cursor })
  }

  function receber(mensagem: MensagemDoChatDoServidor): void {
    switch (mensagem.t) {
      case 'chat.resumo':
        aplicarResumo(mensagem.canais, mensagem.cursor)
        break
      case 'chat.mudancas':
        receberMudancas(mensagem)
        break
      case 'chat.ok': {
        const idDoCliente = mensagem.idDoCliente
        mudar(mensagem.canal, (conversa) => ({ pendentes: conversa.pendentes.filter((pendente) => pendente.idDoCliente !== idDoCliente) }))
        aplicarMensagem(mensagem.canal, mensagem.msg)
        moverCursor(mensagem.msg.mudou)
        break
      }
      case 'chat.msg':
        receberMsgAoVivo(mensagem.canal, mensagem.msg)
        break
      case 'chat.apagada': {
        const { id, apagadaEm, mudou } = mensagem
        mudar(mensagem.canal, (conversa) => {
          const apagando = new Set(conversa.apagando)
          apagando.delete(id)
          return { mensagens: conversa.mensagens.map((msg) => (msg.id === id ? { ...msg, texto: '', mencoes: [], apagadaEm, mudou } : msg)), apagando }
        })
        moverCursor(mudou)
        break
      }
      case 'chat.lista':
        receberLista(mensagem)
        break
      case 'chat.recusado':
        receberRecusa(mensagem)
        break
    }
    publicar()
  }

  // O que ficou sem sair da última vez que a mesa abriu: sai na primeira vez que o canal ficar em dia.
  for (const { canal, pendentes } of opcoes.pendentesGuardadas ?? []) mudar(canal, () => ({ pendentes }))

  return {
    estado: montarEstado,

    aoFicarEmDia() {
      if (encerrado) return
      emDia = true
      pedirDesde()
      mandarPendentes()
      // As lidas que não chegaram a sair (e a que estava no ar na queda) vão agora; o servidor ignora a que não avança.
      if (lidasAMandar.size > 0) armarLida(0)
    },

    aoReceber(mensagem) {
      if (!encerrado) receber(mensagem)
    },

    aoCair() {
      emDia = false
      pronto = false
      alcancou = false
      pararEsperas()
      // Sem confirmação, a lida que estava no ar pode não ter chegado.
      devolverLidaNoAr()
      paginasPedidas.clear()
      for (const conversa of conversas.values()) {
        conversas.set(conversa.chave, { ...conversa, carregando: false, apagando: new Set() })
      }
      for (const chave of [...juntadores.keys()]) terminarJuntar(chave, new Error('A conexão caiu no meio'))
      publicar()
    },

    abrir(canal) {
      const conversa = conversaDe(canal)
      abertas.add(conversa.chave)
      if (alcancou) pedirAsAbertas()
      publicar()
    },

    soltar(canal) {
      abertas.delete(chatChannelKey(canal))
    },

    marcarLida(canal) {
      const conversa = conversaDe(canal)
      if (conversa.ultimaId <= conversa.lidaAte && conversa.naoLidas === 0) return
      const ateId = conversa.ultimaId
      mudar(canal, () => ({ lidaAte: ateId, naoLidas: 0, mencaoNaoLida: false }))
      lidasAMandar.set(conversa.chave, { canal, ateId })
      armarLida(ESPERA_DA_LIDA_MS)
      publicar()
    },

    carregarAnteriores(canal) {
      const conversa = conversaDe(canal)
      const primeira = conversa.mensagens.at(0)
      if (!conversa.carregada || conversa.carregando || !conversa.temMaisAntigas || primeira === undefined) return false
      const pediu = pedirPagina(canal, primeira.id, PAGINA_DO_CHAT)
      publicar()
      return pediu
    },

    enviar(canal, bruto) {
      const texto = textoDoChat(bruto)
      if (texto === null) return false
      const segurada = seguradaDaConversa(canal)
      const pendente: MensagemPendente = { idDoCliente: `chat_${novoId()}`, texto, criadaEm: relogio.agora(), situacao: segurada ?? { t: 'enviando' } }
      mudar(canal, (conversa) => ({ pendentes: [...conversa.pendentes, pendente] }))
      if (segurada === null) mandarPendente(canal, pendente)
      else armarReenvio(canal, pendente.idDoCliente, segurada.ate - relogio.agora())
      publicar()
      return true
    },

    tentarDeNovo(canal, idDoCliente) {
      const pendente = conversaDe(canal).pendentes.find((candidata) => candidata.idDoCliente === idDoCliente)
      if (pendente === undefined) return
      trocarSituacao(canal, idDoCliente, { t: 'enviando' })
      mandarPendente(canal, pendente)
      publicar()
    },

    descartar(canal, idDoCliente) {
      mudar(canal, (conversa) => ({ pendentes: conversa.pendentes.filter((pendente) => pendente.idDoCliente !== idDoCliente) }))
      publicar()
    },

    apagar(canal, id) {
      if (!emDia || !opcoes.enviar({ t: 'chat.apagar', canal, id })) return false
      mudar(canal, (conversa) => ({ apagando: new Set(conversa.apagando).add(id) }))
      publicar()
      return true
    },

    juntarTudo(canal) {
      const conversa = conversaDe(canal)
      const primeira = conversa.mensagens.at(0)
      if (conversa.carregada && (!conversa.temMaisAntigas || primeira === undefined)) return Promise.resolve(conversa.mensagens)
      if (juntadores.has(conversa.chave)) return Promise.reject(new Error('Já está juntando esta conversa'))
      return new Promise((resolver, rejeitar) => {
        juntadores.set(conversa.chave, { resolver, rejeitar })
        mudar(canal, () => ({ juntando: true }))
        // Com uma página a caminho, a resposta dela continua a juntada (`receberLista`).
        const pediu = conversa.carregando || pedirPagina(canal, conversa.carregada && primeira !== undefined ? primeira.id : null, CHAT_PAGINA_MAX)
        if (!pediu) terminarJuntar(conversa.chave, new Error('Sem conexão com a mesa agora'))
        publicar()
      })
    },

    guardarPendentes() {
      return [...conversas.values()].filter((conversa) => conversa.pendentes.length > 0).map(({ canal, pendentes }) => ({ canal, pendentes }))
    },

    fechar() {
      encerrado = true
      pararEsperas()
      for (const juntador of juntadores.values()) juntador.rejeitar(new Error('A mesa foi fechada'))
      juntadores.clear()
    },
  }
}
