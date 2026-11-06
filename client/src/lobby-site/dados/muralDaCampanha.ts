import {
  MURAL_MODIFICACOES_PAGINA_MAX,
  MURAL_PAGINA_MAX,
  MURAL_REACOES,
  textoDoMural,
  type ContagemDaReacao,
  type MensagemDoMuralDoServidor,
  type ModificacaoDoMural,
  type MotivoDoMuralRecusado,
  type NoticiaDoMural,
  type PedidoDoMural,
  type ReacaoDoMural,
} from '../../lib/nuvem/muralDoLobby'
import { RELOGIO_DO_NAVEGADOR, type Relogio } from './fonte'
import type { ParteDoMural } from './sessaoDaCampanha'

/**
 * O MURAL DE UMA CAMPANHA no site (plano do Lobby §8.2, fatia M2), sem React:
 * o lado do navegador do protocolo `mural.*` que o DO Campanha fala
 * (`lib/nuvem/muralDoLobby.ts`, `lobby/nuvem/src/mural.ts`), pelo MESMO canal
 * das fichas (a sessão o chama como `ParteDoMural`).
 *
 * - O servidor manda o `mural.estado` sozinho depois de cada `ola`: os avisos
 *   (todas as fixadas, com o `lida` de quem entra) e a primeira página.
 * - A notícia que o mestre posta fica "enviando…" até o `mural.ok`; depois de
 *   uma queda volta com o MESMO `idDoCliente` e o servidor não grava duas vezes.
 * - "Marcar como lido" e reagir aparecem na hora (por cima do que o servidor
 *   disse) e saem pelo canal; o servidor confirma com a notícia inteira. O lido
 *   espera a volta da rede, se precisar: o aviso não volta a aparecer.
 * - A recusa (`mural.recusado`) não diz qual notícia: os pedidos em voo ficam
 *   numa fila, e a recusa é do primeiro do mesmo tipo (o DO responde em ordem).
 *   O DO passa TODO frame pelo ritmo: recusa por ritmo volta sozinha na hora dita.
 */

/** Folga depois do `tentarDepoisDe`, para não chegar um instante antes e ser segurado de novo. */
const FOLGA_DA_ESPERA_MS = 50
/** Sem `tentarDepoisDe` na recusa por ritmo (não deveria faltar): espera isto. */
const ESPERA_SEM_HORA_MS = 1_000

export type SituacaoDaPostagem =
  | { t: 'enviando' }
  /** Segurada pelo servidor (ritmo, ou a cota do dia): vai sozinha em `ate`. */
  | { t: 'esperando'; motivo: 'ritmo' | 'cota'; ate: number }
  /** O servidor não aceita esta: o mestre descarta (ou tenta de novo). */
  | { t: 'recusada'; motivo: MotivoDoMuralRecusado }

export interface PostagemPendente {
  idDoCliente: string
  /** O texto como vai (já passou pelo `cleanChatText`). */
  texto: string
  imagem: string | null
  criadaEm: number
  situacao: SituacaoDaPostagem
}

/** O que o mestre pediu sobre uma notícia e o servidor ainda não respondeu. */
export type AcaoNaNoticia = 'editar' | 'apagar' | 'fixar'

export interface RecusaNaNoticia {
  acao: AcaoNaNoticia | 'reagir'
  motivo: MotivoDoMuralRecusado
}

export interface FeedDeModificacoes {
  fichaId: string | null
  autorContaId: string | null
  /** Da mais nova para a mais velha. */
  lista: readonly ModificacaoDoMural[]
  /** `null` = não há mais antigas (ou a primeira página ainda não chegou). */
  proximaAntesDeRev: number | null
  carregada: boolean
  carregando: boolean
}

export interface EstadoDoMural {
  /** O `mural.estado` deste canal chegou: dá para pedir e mandar. */
  pronto: boolean
  /** Já chegou ao menos uma vez (sem rede, a tela continua mostrando o que tinha). */
  carregado: boolean
  /** Da mais nova para a mais velha, já com o que a pessoa fez e o servidor ainda não confirmou. */
  noticias: readonly NoticiaDoMural[]
  /** Os avisos (as fixadas de pé), do mais novo para o mais velho. */
  fixadas: readonly NoticiaDoMural[]
  temMaisAntigas: boolean
  carregandoAntigas: boolean
  pendentes: readonly PostagemPendente[]
  aCaminho: ReadonlyMap<number, AcaoNaNoticia>
  recusas: ReadonlyMap<number, RecusaNaNoticia>
  /** Chegaram ao vivo depois do estado: a tela as faz entrar com movimento. */
  novas: ReadonlySet<number>
  modificacoes: FeedDeModificacoes | null
}

export interface MuralDaCampanha extends ParteDoMural {
  estado(): EstadoDoMural
  /** Só o mestre (o servidor confere). `false` = texto vazio depois da limpeza, ou acima do teto. Sem canal, espera a volta. */
  postar(texto: string, imagem: string | null): boolean
  tentarDeNovo(idDoCliente: string): void
  descartar(idDoCliente: string): void
  /** `false` = sem canal agora, ou texto que não vai. */
  editar(id: number, texto: string, imagem: string | null): boolean
  apagar(id: number): boolean
  fixar(id: number, fixada: boolean): boolean
  /** `null` tira a reação. `false` = sem canal agora. */
  reagir(id: number, reacao: ReacaoDoMural | null): boolean
  /** Some na hora; sai pelo canal agora ou quando ele voltar. */
  marcarLido(id: number, versao: number): void
  /** `false` = nada a pedir (já tem tudo, já está pedindo, ou o canal caiu). */
  carregarAntigas(): boolean
  /** O feed com estes filtros (`null` = todos); pede a primeira página quando muda. */
  verModificacoes(fichaId: string | null, autorContaId: string | null): void
  carregarMaisModificacoes(): boolean
  /** Uma ficha mudou: pede a primeira página de novo e junta com o que já está na tela. */
  atualizarModificacoes(): void
  esquecerRecusa(id: number): void
  fechar(): void
}

export interface OpcoesDoMural {
  /** O `enviarDoMural` da sessão. */
  enviar(pedido: PedidoDoMural): boolean
  aoMudar(estado: EstadoDoMural): void
  relogio?: Relogio
  novoId?: () => string
}

type PaginaDoFeed = 'primeira' | 'mais' | 'atualizar'

/** Um pedido que saiu e espera resposta (a notícia que muda, a lista, ou a recusa). */
interface EmVoo {
  pedido: PedidoDoMural
  /** A versão da notícia quando o `editar` saiu: a resposta é a versão maior. */
  versaoAntes?: number
  pagina?: PaginaDoFeed
}

function idDoPedido(pedido: PedidoDoMural): number | null {
  return 'id' in pedido ? pedido.id : null
}

function acaoDoPedido(pedido: PedidoDoMural): AcaoNaNoticia | 'reagir' | null {
  switch (pedido.t) {
    case 'mural.editar':
      return 'editar'
    case 'mural.apagar':
      return 'apagar'
    case 'mural.fixar':
      return 'fixar'
    case 'mural.reagir':
      return 'reagir'
    default:
      return null
  }
}

/** A notícia que chegou já mostra o efeito deste pedido? */
function cumprido(voo: EmVoo, noticia: NoticiaDoMural): boolean {
  const { pedido } = voo
  if (idDoPedido(pedido) !== noticia.id) return false
  if (noticia.apagadaEm !== null) return true
  switch (pedido.t) {
    case 'mural.editar':
      return noticia.versao > (voo.versaoAntes ?? 0)
    case 'mural.fixar':
      return noticia.fixada === pedido.fixada
    case 'mural.reagir':
      return noticia.minhaReacao === pedido.reacao
    case 'mural.lido':
      return noticia.lida
    default:
      return false
  }
}

/** As contagens com a minha reação trocada de `antes` para `depois`, na ordem da lista fixa. */
function recontar(reacoes: readonly ContagemDaReacao[], antes: ReacaoDoMural | null, depois: ReacaoDoMural | null): ContagemDaReacao[] {
  const totais = new Map(reacoes.map((contagem): [ReacaoDoMural, number] => [contagem.reacao, contagem.total]))
  if (antes !== null) totais.set(antes, (totais.get(antes) ?? 0) - 1)
  if (depois !== null) totais.set(depois, (totais.get(depois) ?? 0) + 1)
  return MURAL_REACOES.flatMap((reacao) => {
    const total = totais.get(reacao) ?? 0
    return total > 0 ? [{ reacao, total }] : []
  })
}

function juntarPorRev(atuais: readonly ModificacaoDoMural[], novas: readonly ModificacaoDoMural[]): ModificacaoDoMural[] {
  const porRev = new Map<number, ModificacaoDoMural>()
  for (const linha of atuais) porRev.set(linha.rev, linha)
  for (const linha of novas) porRev.set(linha.rev, linha)
  return [...porRev.values()].sort((a, b) => b.rev - a.rev)
}

export function criarMuralDaCampanha(opcoes: OpcoesDoMural): MuralDaCampanha {
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID())
  /** O que o servidor disse de cada notícia da lista (a página do estado e as anteriores carregadas). */
  const porId = new Map<number, NoticiaDoMural>()
  const fixadas = new Map<number, NoticiaDoMural>()
  let temMaisAntigas = false
  let carregandoAntigas = false
  let emDia = false
  /** O `mural.estado` já chegou pelo canal de agora (zera a cada queda). */
  let estadoNesteCanal = false
  let pronto = false
  let carregado = false
  let encerrado = false
  let pendentes: PostagemPendente[] = []
  const emVoo: EmVoo[] = []
  /** Segurados por ritmo, voltam sozinhos (a tela continua vendo o "a caminho"). */
  const segurados: EmVoo[] = []
  const recusas = new Map<number, RecusaNaNoticia>()
  const novas = new Set<number>()
  /** Avisos que a pessoa marcou como lidos (id → versão), por cima do servidor até ele confirmar. */
  const lidasLocais = new Map<number, number>()
  /** Reações feitas e ainda não confirmadas (id → a minha agora). */
  const reacoesLocais = new Map<number, ReacaoDoMural | null>()
  let feed: FeedDeModificacoes | null = null
  const esperas = new Set<() => void>()
  /** Já há uma volta dos lidos marcada para depois de uma recusa por ritmo. */
  let lidosAgendados = false

  function esperar(ms: number, fazer: () => void): void {
    const cancelar = relogio.depois(ms, () => {
      esperas.delete(cancelar)
      if (!encerrado) fazer()
    })
    esperas.add(cancelar)
  }

  function pararEsperas(): void {
    for (const cancelar of esperas) cancelar()
    esperas.clear()
    lidosAgendados = false
  }

  function comOQueFiz(noticia: NoticiaDoMural): NoticiaDoMural {
    let vista = noticia
    const lidaLocal = lidasLocais.get(noticia.id)
    if (!noticia.lida && lidaLocal !== undefined && lidaLocal >= noticia.versao) vista = { ...vista, lida: true }
    if (reacoesLocais.has(noticia.id) && noticia.apagadaEm === null) {
      const minha = reacoesLocais.get(noticia.id) ?? null
      if (minha !== noticia.minhaReacao) vista = { ...vista, minhaReacao: minha, reacoes: recontar(noticia.reacoes, noticia.minhaReacao, minha) }
    }
    return vista
  }

  function aCaminho(): Map<number, AcaoNaNoticia> {
    const mapa = new Map<number, AcaoNaNoticia>()
    for (const voo of [...emVoo, ...segurados]) {
      const id = idDoPedido(voo.pedido)
      const acao = acaoDoPedido(voo.pedido)
      if (id !== null && acao !== null && acao !== 'reagir') mapa.set(id, acao)
    }
    return mapa
  }

  function estado(): EstadoDoMural {
    return {
      pronto,
      carregado,
      noticias: [...porId.values()].sort((a, b) => b.id - a.id).map(comOQueFiz),
      fixadas: [...fixadas.values()].sort((a, b) => b.id - a.id).map(comOQueFiz),
      temMaisAntigas,
      carregandoAntigas,
      pendentes,
      aCaminho: aCaminho(),
      recusas: new Map(recusas),
      novas: new Set(novas),
      modificacoes: feed,
    }
  }

  function publicar(): void {
    if (!encerrado) opcoes.aoMudar(estado())
  }

  /** Manda e registra na fila dos em voo; `false` = o canal não levou. */
  function mandar(voo: EmVoo): boolean {
    if (!pronto || !opcoes.enviar(voo.pedido)) return false
    emVoo.push(voo)
    return true
  }

  // ── Postar ───────────────────────────────────────────────────────────────

  function trocarPendente(idDoCliente: string, situacao: SituacaoDaPostagem): void {
    pendentes = pendentes.map((pendente): PostagemPendente => (pendente.idDoCliente === idDoCliente ? { ...pendente, situacao } : pendente))
  }

  function mandarPostagem(pendente: PostagemPendente): void {
    if (!pronto) return
    opcoes.enviar({ t: 'mural.postar', texto: pendente.texto, imagem: pendente.imagem, idDoCliente: pendente.idDoCliente })
  }

  function reenviarSegurada(idDoCliente: string): void {
    const pendente = pendentes.find((candidata) => candidata.idDoCliente === idDoCliente)
    if (pendente === undefined || pendente.situacao.t !== 'esperando') return
    trocarPendente(idDoCliente, { t: 'enviando' })
    const atual = pendentes.find((candidata) => candidata.idDoCliente === idDoCliente)
    if (atual !== undefined) mandarPostagem(atual)
    publicar()
  }

  function recusarPostagem(idDoCliente: string, motivo: MotivoDoMuralRecusado, tentarDepoisDe: number | undefined): void {
    if (motivo === 'ritmo' || motivo === 'cota') {
      const ate = tentarDepoisDe ?? relogio.agora() + ESPERA_SEM_HORA_MS
      trocarPendente(idDoCliente, { t: 'esperando', motivo, ate })
      esperar(Math.max(0, ate - relogio.agora()) + FOLGA_DA_ESPERA_MS, () => reenviarSegurada(idDoCliente))
      return
    }
    trocarPendente(idDoCliente, { t: 'recusada', motivo })
  }

  // ── O que chega ──────────────────────────────────────────────────────────

  function guardarFixada(noticia: NoticiaDoMural): void {
    if (noticia.fixada && noticia.apagadaEm === null) fixadas.set(noticia.id, noticia)
    else fixadas.delete(noticia.id)
  }

  /** A notícia nova entra na lista; a que já estava é trocada; a velha fora das páginas carregadas fica de fora. */
  function guardarNaLista(noticia: NoticiaDoMural, aoVivo: boolean): void {
    const ids = [...porId.keys()]
    const menor = ids.length === 0 ? Infinity : Math.min(...ids)
    const maior = ids.length === 0 ? 0 : Math.max(...ids)
    const dentro = porId.has(noticia.id) || noticia.id > maior || noticia.id >= menor || !temMaisAntigas
    if (!dentro) return
    if (aoVivo && !porId.has(noticia.id) && noticia.id > maior) novas.add(noticia.id)
    porId.set(noticia.id, noticia)
  }

  function esquecerOverlays(noticia: NoticiaDoMural): void {
    const lidaLocal = lidasLocais.get(noticia.id)
    if (lidaLocal !== undefined && (noticia.lida || noticia.apagadaEm !== null || !noticia.fixada)) lidasLocais.delete(noticia.id)
    if (reacoesLocais.has(noticia.id) && (noticia.apagadaEm !== null || reacoesLocais.get(noticia.id) === noticia.minhaReacao)) reacoesLocais.delete(noticia.id)
  }

  function receberNoticia(noticia: NoticiaDoMural): void {
    for (let i = emVoo.length - 1; i >= 0; i -= 1) {
      if (cumprido(emVoo[i], noticia)) emVoo.splice(i, 1)
    }
    if (noticia.apagadaEm !== null) recusas.delete(noticia.id)
    guardarFixada(noticia)
    guardarNaLista(noticia, true)
    esquecerOverlays(noticia)
  }

  function receberEstado(mensagem: Extract<MensagemDoMuralDoServidor, { t: 'mural.estado' }>): void {
    porId.clear()
    fixadas.clear()
    novas.clear()
    for (const noticia of mensagem.noticias) porId.set(noticia.id, noticia)
    for (const noticia of mensagem.fixadas) guardarFixada(noticia)
    for (const noticia of [...mensagem.noticias, ...mensagem.fixadas]) esquecerOverlays(noticia)
    temMaisAntigas = mensagem.temMaisAntigas
    carregandoAntigas = false
    carregado = true
    estadoNesteCanal = true
    conferirPronto()
  }

  /** Pronto = canal em dia E o `mural.estado` deste canal na mão (chegam em qualquer ordem). */
  function conferirPronto(): void {
    if (pronto || !emDia || !estadoNesteCanal) return
    pronto = true
    aoFicarPronto()
  }

  /**
   * O lido não entra na fila dos em voo: o DO não responde ao lido de notícia
   * que já não está fixada, e o que fica sem resposta prenderia a fila. Ele
   * fica em `lidasLocais` até o servidor confirmar e sai de novo a cada volta.
   */
  function mandarLido(id: number, versao: number): void {
    if (pronto) opcoes.enviar({ t: 'mural.lido', id, versao })
  }

  /** Canal em dia e estado na mão: sai o que estava esperando. */
  function aoFicarPronto(): void {
    for (const pendente of pendentes) if (pendente.situacao.t === 'enviando') mandarPostagem(pendente)
    for (const [id, versao] of lidasLocais) mandarLido(id, versao)
    if (feed !== null) {
      const pagina: PaginaDoFeed = feed.carregada ? 'atualizar' : 'primeira'
      feed = { ...feed, carregando: true }
      pedirPaginaDoFeed(pagina)
    }
  }

  /**
   * Lido segurado pelo ritmo da conta: a recusa não diz qual aviso, então
   * todos os lidos ainda não confirmados saem de novo depois da espera (uma
   * volta marcada por vez; o que o servidor já gravou ele só repete).
   */
  function reenviarLidosDepois(tentarDepoisDe: number | undefined): void {
    if (lidosAgendados || lidasLocais.size === 0) return
    lidosAgendados = true
    const ate = tentarDepoisDe ?? relogio.agora() + ESPERA_SEM_HORA_MS
    esperar(Math.max(0, ate - relogio.agora()) + FOLGA_DA_ESPERA_MS, () => {
      lidosAgendados = false
      for (const [id, versao] of lidasLocais) mandarLido(id, versao)
    })
  }

  function receberRecusa(mensagem: Extract<MensagemDoMuralDoServidor, { t: 'mural.recusado' }>): void {
    if (mensagem.idDoCliente !== undefined && mensagem.pedido === 'mural.postar') {
      recusarPostagem(mensagem.idDoCliente, mensagem.motivo, mensagem.tentarDepoisDe)
      return
    }
    // O lido não entra na fila dos em voo (ver `mandarLido`): a recusa dele é tratada aqui.
    if (mensagem.pedido === 'mural.lido') {
      if (mensagem.motivo === 'ritmo') reenviarLidosDepois(mensagem.tentarDepoisDe)
      return
    }
    const indice = emVoo.findIndex((voo) => voo.pedido.t === mensagem.pedido)
    if (indice < 0) return
    const [voo] = emVoo.splice(indice, 1)
    if (mensagem.motivo === 'ritmo') {
      segurados.push(voo)
      const ate = mensagem.tentarDepoisDe ?? relogio.agora() + ESPERA_SEM_HORA_MS
      esperar(Math.max(0, ate - relogio.agora()) + FOLGA_DA_ESPERA_MS, () => {
        const i = segurados.indexOf(voo)
        if (i < 0) return
        segurados.splice(i, 1)
        if (!mandar(voo)) desistir(voo)
        publicar()
      })
      return
    }
    desistir(voo, mensagem.motivo)
  }

  /** O pedido não vai mais: some o que ele mostrava, e a recusa (se houver) fica perto da notícia. */
  function desistir(voo: EmVoo, motivo?: MotivoDoMuralRecusado): void {
    const { pedido } = voo
    const id = idDoPedido(pedido)
    const acao = acaoDoPedido(pedido)
    if (pedido.t === 'mural.reagir') reacoesLocais.delete(pedido.id)
    if (pedido.t === 'mural.lido' && motivo !== undefined) lidasLocais.delete(pedido.id)
    if (pedido.t === 'mural.antes') carregandoAntigas = false
    if (pedido.t === 'mural.modificacoes' && feed !== null) feed = { ...feed, carregando: false }
    if (id !== null && acao !== null && motivo !== undefined) recusas.set(id, { acao, motivo })
  }

  function receberModificacoes(mensagem: Extract<MensagemDoMuralDoServidor, { t: 'mural.modificacoes' }>): void {
    const indice = emVoo.findIndex((voo) => voo.pedido.t === 'mural.modificacoes')
    const voo = indice < 0 ? undefined : emVoo.splice(indice, 1)[0]
    if (feed === null || feed.fichaId !== mensagem.fichaId || feed.autorContaId !== mensagem.autorContaId) return
    const pagina = voo?.pagina ?? 'primeira'
    if (pagina === 'primeira' || !feed.carregada) {
      feed = { ...feed, lista: mensagem.lista, proximaAntesDeRev: mensagem.proximaAntesDeRev, carregada: true, carregando: false }
    } else if (pagina === 'mais') {
      feed = { ...feed, lista: juntarPorRev(feed.lista, mensagem.lista), proximaAntesDeRev: mensagem.proximaAntesDeRev, carregando: false }
    } else {
      feed = { ...feed, lista: juntarPorRev(feed.lista, mensagem.lista), carregando: false }
    }
  }

  function aoReceber(mensagem: MensagemDoMuralDoServidor): void {
    if (encerrado) return
    switch (mensagem.t) {
      case 'mural.estado':
        receberEstado(mensagem)
        break
      case 'mural.ok':
        pendentes = pendentes.filter((pendente) => pendente.idDoCliente !== mensagem.idDoCliente)
        guardarFixada(mensagem.noticia)
        guardarNaLista(mensagem.noticia, false)
        break
      case 'mural.noticia':
        receberNoticia(mensagem.noticia)
        break
      case 'mural.lista': {
        const indice = emVoo.findIndex((voo) => voo.pedido.t === 'mural.antes')
        if (indice >= 0) emVoo.splice(indice, 1)
        for (const noticia of mensagem.noticias) porId.set(noticia.id, noticia)
        temMaisAntigas = mensagem.temMaisAntigas
        carregandoAntigas = false
        break
      }
      case 'mural.modificacoes':
        receberModificacoes(mensagem)
        break
      case 'mural.recusado':
        receberRecusa(mensagem)
        break
    }
    publicar()
  }

  // ── Modificações ─────────────────────────────────────────────────────────

  function pedirPaginaDoFeed(pagina: PaginaDoFeed): boolean {
    if (feed === null) return false
    const antesDeRev = pagina === 'mais' ? feed.proximaAntesDeRev : null
    if (pagina === 'mais' && antesDeRev === null) return false
    const pedido: PedidoDoMural = { t: 'mural.modificacoes', fichaId: feed.fichaId, autorContaId: feed.autorContaId, antesDeRev, limite: MURAL_MODIFICACOES_PAGINA_MAX }
    const foi = mandar({ pedido, pagina })
    if (!foi) feed = { ...feed, carregando: false }
    return foi
  }

  return {
    estado,
    aoFicarEmDia() {
      // O `mural.estado` vem sozinho logo depois do `ola`; até ele chegar, nada sai.
      emDia = true
      if (encerrado || pronto) return
      conferirPronto()
      if (pronto) publicar()
    },
    aoCair() {
      emDia = false
      estadoNesteCanal = false
      pronto = false
      emVoo.length = 0
      segurados.length = 0
      pararEsperas()
      reacoesLocais.clear()
      carregandoAntigas = false
      if (feed !== null) feed = { ...feed, carregando: false }
      // As seguradas voltam como "enviando": saem de novo quando o canal voltar.
      pendentes = pendentes.map((pendente): PostagemPendente => (pendente.situacao.t === 'esperando' ? { ...pendente, situacao: { t: 'enviando' } } : pendente))
      publicar()
    },
    aoReceber,
    postar(texto, imagem) {
      const limpo = textoDoMural(texto)
      if (limpo === null) return false
      const pendente: PostagemPendente = { idDoCliente: novoId(), texto: limpo, imagem, criadaEm: relogio.agora(), situacao: { t: 'enviando' } }
      pendentes = [...pendentes, pendente]
      mandarPostagem(pendente)
      publicar()
      return true
    },
    tentarDeNovo(idDoCliente) {
      const pendente = pendentes.find((candidata) => candidata.idDoCliente === idDoCliente)
      if (pendente === undefined || pendente.situacao.t === 'enviando') return
      trocarPendente(idDoCliente, { t: 'enviando' })
      mandarPostagem({ ...pendente, situacao: { t: 'enviando' } })
      publicar()
    },
    descartar(idDoCliente) {
      pendentes = pendentes.filter((pendente) => pendente.idDoCliente !== idDoCliente)
      publicar()
    },
    editar(id, texto, imagem) {
      const limpo = textoDoMural(texto)
      const atual = porId.get(id) ?? fixadas.get(id)
      if (limpo === null || atual === undefined) return false
      recusas.delete(id)
      const foi = mandar({ pedido: { t: 'mural.editar', id, texto: limpo, imagem }, versaoAntes: atual.versao })
      publicar()
      return foi
    },
    apagar(id) {
      recusas.delete(id)
      const foi = mandar({ pedido: { t: 'mural.apagar', id } })
      publicar()
      return foi
    },
    fixar(id, fixada) {
      recusas.delete(id)
      const foi = mandar({ pedido: { t: 'mural.fixar', id, fixada } })
      publicar()
      return foi
    },
    reagir(id, reacao) {
      recusas.delete(id)
      const foi = mandar({ pedido: { t: 'mural.reagir', id, reacao } })
      if (foi) reacoesLocais.set(id, reacao)
      publicar()
      return foi
    },
    marcarLido(id, versao) {
      if ((lidasLocais.get(id) ?? 0) >= versao) return
      lidasLocais.set(id, versao)
      mandarLido(id, versao)
      publicar()
    },
    carregarAntigas() {
      if (!temMaisAntigas || carregandoAntigas) return false
      const ids = [...porId.keys()]
      const antesDeId = ids.length === 0 ? null : Math.min(...ids)
      const foi = mandar({ pedido: { t: 'mural.antes', antesDeId, limite: MURAL_PAGINA_MAX } })
      if (foi) carregandoAntigas = true
      publicar()
      return foi
    },
    verModificacoes(fichaId, autorContaId) {
      if (feed !== null && feed.fichaId === fichaId && feed.autorContaId === autorContaId && (feed.carregada || feed.carregando)) return
      feed = { fichaId, autorContaId, lista: [], proximaAntesDeRev: null, carregada: false, carregando: true }
      // Sem canal agora: fica "carregando" e sai quando o estado do mural chegar (`aoFicarPronto`).
      if (pronto) pedirPaginaDoFeed('primeira')
      publicar()
    },
    carregarMaisModificacoes() {
      if (feed === null || feed.carregando || feed.proximaAntesDeRev === null) return false
      feed = { ...feed, carregando: true }
      const foi = pedirPaginaDoFeed('mais')
      publicar()
      return foi
    },
    atualizarModificacoes() {
      if (feed === null || !feed.carregada || feed.carregando) return
      feed = { ...feed, carregando: true }
      pedirPaginaDoFeed('atualizar')
      publicar()
    },
    esquecerRecusa(id) {
      if (recusas.delete(id)) publicar()
    },
    fechar() {
      encerrado = true
      pararEsperas()
    },
  }
}
