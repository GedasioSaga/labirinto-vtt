import type { FimDoDuelo } from '../../../lib/treino/duelo'
import type { FimDoConvite, MotivoDoDueloRecusado } from '../../../lib/treino/dueloDoLobby'
import type { LadoDoTreino } from '../../../lib/treino/mesaEmMemoria'

/**
 * Os textos do treino e do duelo (fatia T7), num lugar só: a mesma palavra
 * para a mesma coisa em todas as telas. Os nomes dos golpes e das saídas da
 * defesa são os do HUD da Arena (fatia H), que a luta usa desde então.
 */

export function contar(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`
}

/**
 * Como a luta acabou, do ponto de vista de quem lê. `meuLado` null = quem lê
 * não está na luta (não acontece no site, mas o texto continua certo).
 */
export function textoDoFim(fim: FimDoDuelo, meuLado: LadoDoTreino | null, nomeDoOutro: string): string {
  switch (fim.tipo) {
    case 'vitoria':
      return fim.vencedor === meuLado ? 'Você venceu.' : `${nomeDoOutro} venceu.`
    case 'todosCaidos':
      return 'Empate: todo mundo caiu no mesmo golpe.'
    case 'tempo':
      return fim.teto === 'rodadas' ? 'Empate por tempo: a luta passou de 30 rodadas.' : 'Empate por tempo: a luta passou do limite de jogadas.'
    case 'ausencia':
      if (fim.vencedor === null) return 'Ninguém venceu: os dois ficaram fora da conexão por mais de 3 minutos.'
      return fim.vencedor === meuLado ? `${nomeDoOutro} não voltou a tempo. Você venceu.` : 'Você ficou fora da conexão por mais de 3 minutos e perdeu o duelo.'
    case 'desistencia':
      return fim.vencedor === meuLado ? `${nomeDoOutro} desistiu. Você venceu.` : `Você desistiu. ${nomeDoOutro} venceu.`
  }
}

/** O tom do fim: vitória, derrota ou empate (a cor do cartão, sempre com o texto). */
export function tomDoFim(fim: FimDoDuelo, meuLado: LadoDoTreino | null): 'vitoria' | 'derrota' | 'empate' {
  if (fim.tipo === 'todosCaidos' || fim.tipo === 'tempo' || (fim.tipo === 'ausencia' && fim.vencedor === null)) return 'empate'
  return fim.vencedor === meuLado ? 'vitoria' : 'derrota'
}

const TEXTO_DA_RECUSA: Readonly<Record<MotivoDoDueloRecusado, string>> = {
  formato: 'O pedido saiu torto. Recarregue a página e tente de novo.',
  'nao-existe': 'Esse duelo ou convite não existe mais (ou a pessoa saiu da mesa).',
  ocupado: 'Alguém já está num duelo, ou você já tem um desafio esperando resposta.',
  fichas: 'Alguma ficha escolhida não serve: precisa ser sua e estar na mesa.',
  sistema: 'O duelo só funciona em mesa do sistema One Piece.',
  ritmo: 'Muitos pedidos seguidos. Espere um instante e tente de novo.',
  cota: 'A mesa chegou ao limite de jogadas de hoje. Tente de novo mais tarde.',
  versao: 'Este duelo é de uma versão antiga do jogo e não continua.',
  acabou: 'O duelo já acabou.',
  naoJoga: 'Você não está neste duelo.',
  seqVelho: 'A luta andou antes da sua jogada chegar. Veja como ficou e jogue de novo.',
  naoEDaConta: 'Esse personagem é do outro lado.',
  surpresa: 'Golpe surpresa não vale no duelo.',
  danoAMao: 'Essa técnica pede dano digitado à mão, e no duelo ninguém digita dano. Escolha outro golpe.',
  foraDoDuelo: 'Isso não existe no duelo (só na mesa, com o mestre).',
  regra: 'A regra da batalha não deixou: pode não ser a sua vez, a ação já foi gasta ou a técnica está recarregando.',
}

/**
 * A frase da recusa. `daRegra` (R1 do plano de unificação do combate) = o
 * motivo que a regra da batalha deu, o mesmo que o app mostra na mesa
 * ("Ninguém marcado está ferido", "SP insuficiente: custa 25, você tem 20"):
 * com ele, é ele que aparece. Sem ele (o servidor de antes, ou a recusa que
 * não é da regra), a frase do código.
 */
export function textoDaRecusa(motivo: MotivoDoDueloRecusado, daRegra?: string): string {
  return daRegra === undefined || daRegra.trim() === '' ? TEXTO_DA_RECUSA[motivo] : daRegra
}

/** O convite que acabou sem duelo, pelo lado de quem lê. */
export function textoDoConviteFechado(motivo: FimDoConvite, souQuemConvidou: boolean, nomeDoOutro: string): string {
  switch (motivo) {
    case 'recusado':
      return souQuemConvidou ? `${nomeDoOutro} recusou o desafio.` : 'Você recusou o desafio.'
    case 'desistiu':
      return souQuemConvidou ? 'Você desistiu do desafio.' : `${nomeDoOutro} desistiu do desafio.`
    case 'expirou':
      return 'O desafio passou de 10 minutos sem resposta e foi cancelado.'
    case 'fichas':
      return 'As fichas do desafio mudaram (de dono, ou saíram da mesa). O desafio foi cancelado.'
  }
}

/** "2:41": minutos e segundos que faltam (nunca negativo). */
export function relogioDaVolta(ms: number): string {
  const segundos = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}
