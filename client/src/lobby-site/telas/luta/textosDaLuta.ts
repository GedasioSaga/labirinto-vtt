import type { FimDaLutaV4, ModoDaLuta, PapelNaLuta } from '../../../lib/treino/luta'
import type { FimDaEspera, LadoComContas, LutaNoHistorico, MotivoDaLutaRecusada } from '../../../lib/treino/lutaDoLobby'
import type { LadoDaLuta } from '../../../lib/treino/mesaEmMemoria'

/**
 * Os textos da luta de N lados (Arena multijogador F5), num lugar só: a mesma
 * palavra para a mesma coisa em todas as telas. "Time A" no modo times; no
 * todos contra todos, o lado é a própria pessoa.
 */

export function letraDoLado(lado: LadoDaLuta): string {
  return lado.toUpperCase()
}

export function nomeDoTime(lado: LadoDaLuta): string {
  return `Time ${letraDoLado(lado)}`
}

/** "Bia, Caio e Duda". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? 'ninguém'
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

/** O nome de um lado como quem lê o reconhece: no times, "Time A"; no todos contra todos (e no duelo), quem lutou por ele. */
export function nomeDoLado(lado: LadoComContas, modo: ModoDaLuta | 'duelo'): string {
  if (modo === 'times') return nomeDoTime(lado.lado)
  return juntarNomes(lado.contas.map((conta) => conta.nome))
}

export const TEXTO_DO_MODO: Readonly<Record<ModoDaLuta | 'duelo', string>> = {
  times: 'Times',
  todos: 'Todos contra todos',
  duelo: 'Duelo',
}

export const TEXTO_DO_PAPEL: Readonly<Record<PapelNaLuta, string>> = {
  jogador: 'joga',
  juiz: 'joga com o Judge',
  arbitro: 'arbitra',
  espectador: 'assiste',
}

/** Como a luta acabou, do ponto de vista de quem lê. `nomeDoVencedor` = como o lado vencedor aparece. */
export function textoDoFimDaLuta(fim: FimDaLutaV4, meuLado: LadoDaLuta | null, nomeDoVencedor: (lado: LadoDaLuta) => string): string {
  switch (fim.tipo) {
    case 'vitoria':
      return fim.vencedor === meuLado ? 'Você venceu.' : `Vitória de ${nomeDoVencedor(fim.vencedor)}.`
    case 'todosCaidos':
      return 'Empate: todo mundo caiu no mesmo golpe.'
    case 'tempo':
      return fim.teto === 'rodadas' ? 'Empate por tempo: a luta passou de 30 rodadas.' : 'Empate por tempo: a luta passou do limite de jogadas.'
    case 'arbitro':
      if (fim.vencedor === null) return 'O árbitro encerrou a luta: empate.'
      return fim.vencedor === meuLado ? 'O árbitro encerrou a luta: você venceu.' : `O árbitro encerrou a luta: vitória de ${nomeDoVencedor(fim.vencedor)}.`
  }
}

export function tomDoFimDaLuta(fim: FimDaLutaV4, meuLado: LadoDaLuta | null): 'vitoria' | 'derrota' | 'empate' | 'neutro' {
  const vencedor = fim.tipo === 'vitoria' || fim.tipo === 'arbitro' ? fim.vencedor : null
  if (vencedor === null) return 'empate'
  if (meuLado === null) return 'neutro'
  return vencedor === meuLado ? 'vitoria' : 'derrota'
}

/** O resultado de uma luta do histórico, numa frase curta. */
export function textoDoResultado(luta: LutaNoHistorico): string {
  const vencedor = luta.vencedor === null ? null : luta.lados.find((lado) => lado.lado === luta.vencedor)
  const nome = vencedor === undefined || vencedor === null ? null : nomeDoLado(vencedor, luta.modo)
  switch (luta.motivo) {
    case 'vitoria':
      return nome === null ? 'Vitória' : `Vitória de ${nome}`
    case 'todosCaidos':
      return 'Empate: todos caíram'
    case 'tempo':
      return 'Empate por tempo'
    case 'arbitro':
      return nome === null ? 'Encerrada pelo árbitro: empate' : `Encerrada pelo árbitro: vitória de ${nome}`
    case 'ausencia':
      return nome === null ? 'Ninguém voltou a tempo' : `${nome} venceu: o outro não voltou a tempo`
    case 'desistencia':
      return nome === null ? 'Desistência' : `${nome} venceu por desistência`
  }
}

const TEXTO_DA_RECUSA: Readonly<Record<MotivoDaLutaRecusada, string>> = {
  formato: 'O pedido saiu torto. Recarregue a página e tente de novo.',
  'nao-existe': 'Essa luta ou sala de espera não existe mais (ou alguém saiu da mesa).',
  ocupado: 'Alguém já está em outra luta, ou você já tem uma sala de espera aberta.',
  fichas: 'Alguma ficha escolhida não serve: precisa ser sua e estar na mesa (do Judge, liberada para o treino), e cada lado leva até 6.',
  sistema: 'A luta só funciona em mesa do sistema One Piece.',
  papel: 'Esse papel não combina: Judge e árbitro são só do mestre, e um dos dois por luta.',
  lados: 'Os lados não fecham: cada lado precisa de alguém, e no todos contra todos cada pessoa fica num lado só dela.',
  cheia: 'A luta já tem 12 pessoas, contando quem assiste.',
  'so-criador': 'Só quem criou a sala começa a luta.',
  ritmo: 'Muitos pedidos seguidos. Espere um instante e tente de novo.',
  cota: 'A mesa chegou ao limite de jogadas de hoje. Tente de novo mais tarde.',
  versao: 'Esta luta é de uma versão antiga do jogo e não continua.',
  acabou: 'A luta já acabou.',
  naoJoga: 'Você não joga nesta luta.',
  seqVelho: 'A luta andou antes da sua jogada chegar. Veja como ficou e jogue de novo.',
  naoEDaConta: 'Esse personagem é de outra pessoa: no time, cada um joga só a própria ficha.',
  surpresa: 'Golpe surpresa não vale na luta.',
  danoAMao: 'Essa técnica pede dano digitado à mão, e na luta ninguém digita dano. Escolha outro golpe.',
  foraDoDuelo: 'Isso não existe na luta do site (só na mesa, com o mestre).',
  regra: 'A regra da batalha não deixou: pode não ser a sua vez, a ação já foi gasta ou a técnica está recarregando.',
  pausada: 'O árbitro pausou a luta. As jogadas voltam quando ele retomar.',
  naoArbitra: 'Só o árbitro da luta faz isso.',
}

/** A frase da recusa; com o motivo que a regra da batalha deu (`daRegra`, o mesmo do app), é ele que aparece. */
export function textoDaRecusaDaLuta(motivo: MotivoDaLutaRecusada, daRegra?: string): string {
  return daRegra === undefined || daRegra.trim() === '' ? TEXTO_DA_RECUSA[motivo] : daRegra
}

/** A sala de espera que acabou, pelo lado de quem lê. */
export function textoDaEsperaFechada(motivo: FimDaEspera, souQuemCriou: boolean, nomeDeQuemCriou: string): string {
  switch (motivo) {
    case 'desistiu':
      return souQuemCriou ? 'Você desistiu da sala de espera.' : `${nomeDeQuemCriou} desistiu da sala de espera.`
    case 'expirou':
      return 'A sala de espera passou de 5 minutos sem começar e fechou.'
    case 'recusou':
      return 'Você saiu.'
    case 'semVoce':
      return 'A luta começou sem você (o seu aceite não chegou a tempo, ou as suas fichas já não servem).'
  }
}

/** "4 min" ou "40 s" que faltam (nunca negativo). */
export function tempoQueFalta(ms: number): string {
  const segundos = Math.max(0, Math.ceil(ms / 1000))
  return segundos >= 60 ? `${Math.ceil(segundos / 60)} min` : `${segundos} s`
}

/** A data do histórico: "hoje, 21:04", "ontem, 9:12" ou "05/11, 18:30". */
export function quandoFoi(ms: number, agora: number): string {
  const data = new Date(ms)
  const hora = data.toLocaleTimeString('pt-BR', { hour: 'numeric', minute: '2-digit' })
  const hoje = new Date(agora)
  const ontem = new Date(agora - 86_400_000)
  if (data.toDateString() === hoje.toDateString()) return `hoje, ${hora}`
  if (data.toDateString() === ontem.toDateString()) return `ontem, ${hora}`
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`
}
