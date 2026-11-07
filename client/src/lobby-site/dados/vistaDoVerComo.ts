import type { EstadoDoChat } from './chatDaCampanha'
import { criarDueloDaCampanha, type EstadoDoDuelo } from './dueloDaCampanha'
import type { EstadoComSala, VistaDoVerComoNoSite } from './fonte'
import { criarMuralDaCampanha, type EstadoDoMural } from './muralDaCampanha'
import type { EstadoDaCampanha, FichaDoSite } from './sessaoDaCampanha'

/**
 * O QUE A TELA MOSTRA NO "VER COMO" (07/11/2026): a vista que o DO montou
 * para o jogador vira o mesmo formato que as telas já leem (campanha, chat,
 * mural, duelo). Nada daqui tem canal: o mural e o duelo passam pelas mesmas
 * stores do site, com um `enviar` que nunca sai, só para ler a vista do jeito
 * que o jogador a teria. Tudo puro do lado da página: o mestre continua com a
 * base, a fila e o canal dele intactos por baixo.
 */

/** A campanha como o jogador a vê: fichas, membros e `eu` da vista; conexão e presença são as do canal do mestre (as mesmas para todos). */
export function campanhaVistaComo(real: EstadoDaCampanha, estado: EstadoComSala): EstadoDaCampanha {
  const fichas = estado.fichas.map((ficha): FichaDoSite => ({ doc: ficha.doc, visivel: ficha.visivel, ehMinha: ficha.ehMinha, nomeDoDono: ficha.nomeDoDono, naoAceita: false }))
  const sistema = estado.sistema ?? null
  return {
    campanhaId: real.campanhaId,
    conexao: real.conexao,
    carregada: true,
    rev: estado.rev,
    fichas,
    membros: estado.membros,
    eu: estado.eu,
    naMesa: real.naMesa,
    // A fila, as decisões, o histórico e o desfazer são do mestre: na vista do jogador não aparece nada disso.
    esperando: 0,
    paraDecidir: [],
    historicos: new Map(),
    desfazeres: new Map(),
    erroLocal: null,
    sala: estado.sala ?? null,
    sistema,
    livro: estado.livro ?? null,
    // O livro é o mesmo para a mesa toda: o que o mestre já baixou vale, se for do mesmo sistema.
    livroDeRegras: sistema !== null && real.sistema?.id === sistema.id ? real.livroDeRegras : undefined,
  }
}

/**
 * O chat como a vista mostra: SÓ a sala (a mesma para todo mundo), viva, da
 * conversa que o mestre já tem. Nenhum privado: nem os do jogador com colegas
 * (o mestre nunca lê privado entre jogadores) nem o dele com o mestre.
 * As não lidas são de cada conta: na vista, nenhuma.
 */
export function chatSoDaSala(real: EstadoDoChat): EstadoDoChat {
  const sala = real.conversas.get('sala')
  // As pendentes e a menção são do mestre (o que ele mandou, o que o chama): na vista, só o que a sala já tem.
  return { pronto: real.pronto, conversas: new Map(sala === undefined ? [] : [['sala', { ...sala, naoLidas: 0, pendentes: [], mencaoNaoLida: false }]]), naoLidas: 0 }
}

/** O mural da vista pela store do mural (o mesmo `mural.estado` que o jogador recebe), sem canal: `pronto` fica falso, nada sai. */
export function muralDaVista(vista: VistaDoVerComoNoSite): EstadoDoMural | null {
  if (vista.mural === null) return null
  const mural = criarMuralDaCampanha({ enviar: () => false, aoMudar: () => undefined })
  mural.aoReceber(vista.mural)
  const estado = mural.estado()
  mural.fechar()
  return estado
}

/** Os convites e duelos do lado do jogador, pela store do duelo, sem canal. */
export function dueloDaVista(vista: VistaDoVerComoNoSite): EstadoDoDuelo | null {
  if (vista.duelos === null) return null
  const duelo = criarDueloDaCampanha({ enviar: () => false, aoMudar: () => undefined })
  duelo.aoReceber(vista.duelos)
  const estado = duelo.estado()
  duelo.fechar()
  return estado
}
