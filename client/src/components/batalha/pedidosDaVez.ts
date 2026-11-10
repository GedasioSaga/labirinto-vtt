import type { PedidoDeAcao, PedidoDeEvolucao, PedidoDeInvocacao, PedidoDeMarca, PedidoDePassiva, PedidoDeReacao } from '../../lib/batalha/combate'
import type { VezEsperada } from '../../lib/batalha/ponte'
import type { AutorDaAcao } from '../../lib/batalha/turnos'
import type { BatalhaState, LojaDaBatalha } from '../../stores/batalhaFabrica'

/**
 * OS PEDIDOS DA VEZ, UMA LISTA SÓ (U4 do plano de unificação do combate,
 * 10/11/2026). Antes cada entrada montava a lista dela à mão: a Arena tinha 8
 * pedidos, o mapa todos, e o que faltava numa só aparecia quando alguém
 * tentava usar. Agora quem opera uma batalha pela store (o mestre no mapa, a
 * Arena) pede tudo por `pedidosDaVez`, e a lista é a mesma por construção.
 *
 * `ConexaoDaBatalha` é a parte que a tela da vez (`BatalhaDoJogador`) usa; o
 * jogador por LAN monta a dele sobre a rede com os MESMOS nomes (`agir`,
 * `reagir`, `passarVez`...), então a tela não sabe de onde o pedido vem.
 *
 * O que uma entrada NÃO pode ter fica desligado em `PedidosForaDaEntrada`,
 * com o motivo escrito lá: nunca por esquecimento.
 */

/** O que a tela da vez pede. Campo ausente = a tela esconde o controle dele. */
export interface ConexaoDaBatalha {
  agir: (vez: VezEsperada | null, pedido: PedidoDeAcao) => boolean
  reagir: (pedido: PedidoDeReacao) => boolean
  escolherArmas: (personagemId: string, armas: readonly string[]) => boolean
  passarVez: (cartaId: string, rodada: number) => boolean
  /** "Zerar" a concentração do personagem dele. Ausente = sem o botão. */
  zerarCarga?: (personagemId: string) => boolean
  /** Tipos de habilidade F3: Ativar/Desligar a passiva e responder o lembrete. Ausente = sem a tira Passivas nem os lembretes. */
  passiva?: (pedido: PedidoDePassiva) => boolean
  /** Tipos de habilidade F4: Evoluir a técnica nesta batalha (o jogador, na vez dele). Ausente = sem o botão Evoluir. */
  evoluir?: (pedido: PedidoDeEvolucao) => boolean
  /** Invocação F3: pedir a técnica de Tipo Invocação (o mestre põe no campo). Ausente = a técnica fica apagada. */
  invocar?: (pedido: PedidoDeInvocacao) => boolean
  /** R1 (lote de 01/11): responder o lembrete da marca. Ausente = sem os lembretes da marca. */
  marcar?: (pedido: PedidoDeMarca) => boolean
}

/** A ação da store sem a cena e o autor na frente: quem monta os pedidos já disse os dois. */
type ComAutor<Nome extends keyof BatalhaState> = BatalhaState[Nome] extends (sceneKey: string, autor: AutorDaAcao, ...resto: infer Resto) => infer Saida ? (...resto: Resto) => Saida : never
/** A ação só do mestre (a store não recebe autor): sem a cena na frente. */
type SoDoMestre<Nome extends keyof BatalhaState> = BatalhaState[Nome] extends (sceneKey: string, ...resto: infer Resto) => infer Saida ? (...resto: Resto) => Saida : never

/**
 * Tudo o que quem opera a batalha pela store pede: a parte da tela da vez
 * (`ConexaoDaBatalha`, aqui inteira) e a parte de quem conduz (o Ajustar, o
 * contador, a forma que o mestre decide, o bando, o Dar dano, os selos, o Desfazer).
 */
export interface PedidosDaVez extends ConexaoDaBatalha {
  /** Sem a carta e a rodada, passa a vez de agora (o botão da faixa); com elas, só se ainda for aquela vez. */
  passarVez: (cartaId?: string, rodada?: number) => boolean
  zerarCarga: ComAutor<'zerarCarga'>
  passiva: ComAutor<'passiva'>
  evoluir: ComAutor<'evoluir'>
  marcar: ComAutor<'marcar'>
  /** O motivo da regra para o `agir` que ela recusaria agora; `null` = não recusa. */
  motivoDoAgir: ComAutor<'motivoDoAgir'>
  ajustar: ComAutor<'ajustar'>
  contador: ComAutor<'contador'>
  darDano: ComAutor<'darDano'>
  darAcoesExtras: SoDoMestre<'darAcoesExtras'>
  trocarPerfurante: SoDoMestre<'trocarPerfurante'>
  porSelo: SoDoMestre<'porSelo'>
  editarSelo: SoDoMestre<'editarSelo'>
  tirarSelo: SoDoMestre<'tirarSelo'>
  /** A forma em que o mestre decide os números: decidir liga, recusar devolve o pedido. */
  decidirForma: SoDoMestre<'decidirForma'>
  cancelarForma: SoDoMestre<'cancelarForma'>
  /** A vez do bando: o mestre age pelo invocado; cancelar a invocação pendente devolve o custo. */
  agirComInvocado: SoDoMestre<'agirComInvocado'>
  cancelarInvocacao: SoDoMestre<'cancelarInvocacao'>
  desfazer: (linhaId: string) => boolean
}

/** O pedido que a entrada não pode ter. Cada campo diz o motivo; quem liga repete o motivo num comentário de uma linha. */
export interface PedidosForaDaEntrada {
  /** Sem o Invocar (a técnica fica apagada no menu): só para a mesa que não tem campo onde pôr o token (`MesaDaBatalha.criarInvocado` ausente). */
  invocar?: true
}

/**
 * Os pedidos de `autor` na batalha `sceneKey` da `loja`. Cada pedido lê a
 * store na hora (`getState`), então o objeto vale enquanto a cena e o autor
 * forem os mesmos: quem monta guarda um só.
 */
export function pedidosDaVez(loja: LojaDaBatalha, sceneKey: string, autor: AutorDaAcao, fora: PedidosForaDaEntrada = {}): PedidosDaVez {
  const agora = (): BatalhaState => loja.getState()
  const pedidos: PedidosDaVez = {
    agir: (vez, pedido) => agora().agir(sceneKey, autor, vez, pedido),
    motivoDoAgir: (vez, pedido) => agora().motivoDoAgir(sceneKey, autor, vez, pedido),
    reagir: (pedido) => agora().reagir(sceneKey, autor, pedido),
    escolherArmas: (personagemId, armas) => agora().escolherArmas(sceneKey, autor, personagemId, armas),
    passarVez: (cartaId, rodada) => agora().passarVez(sceneKey, autor, cartaId === undefined || rodada === undefined ? undefined : { cartaId, rodada }),
    zerarCarga: (personagemId) => agora().zerarCarga(sceneKey, autor, personagemId),
    passiva: (pedido) => agora().passiva(sceneKey, autor, pedido),
    evoluir: (pedido) => agora().evoluir(sceneKey, autor, pedido),
    marcar: (pedido) => agora().marcar(sceneKey, autor, pedido),
    ajustar: (pedido) => agora().ajustar(sceneKey, autor, pedido),
    contador: (pedido) => agora().contador(sceneKey, autor, pedido),
    darDano: (tokenId, valor) => agora().darDano(sceneKey, autor, tokenId, valor),
    darAcoesExtras: (cartaId, extras) => agora().darAcoesExtras(sceneKey, cartaId, extras),
    trocarPerfurante: (golpeId, perfurante, perfuracao) => agora().trocarPerfurante(sceneKey, golpeId, perfurante, perfuracao),
    porSelo: (tokenId, selo) => agora().porSelo(sceneKey, tokenId, selo),
    editarSelo: (seloId, selo) => agora().editarSelo(sceneKey, seloId, selo),
    tirarSelo: (seloId) => agora().tirarSelo(sceneKey, seloId),
    decidirForma: (pendenteId, decisao) => agora().decidirForma(sceneKey, pendenteId, decisao),
    cancelarForma: (pendenteId) => agora().cancelarForma(sceneKey, pendenteId),
    agirComInvocado: (vez, tokenId, pedido) => agora().agirComInvocado(sceneKey, vez, tokenId, pedido),
    cancelarInvocacao: (invocacaoId) => agora().cancelarInvocacao(sceneKey, invocacaoId),
    desfazer: (linhaId) => agora().desfazer(sceneKey, linhaId, autor),
  }
  if (fora.invocar !== true) pedidos.invocar = (pedido) => agora().invocar(sceneKey, autor, pedido)
  return pedidos
}
