import { GRADES_DA_ARENA, type TamanhoDaGrade } from '../arena/grade'
import type { EfeitoDaBatalha } from '../batalha/combate'
import type { RegrasDaBatalha } from '../batalha/regrasDoCampo'
import { registroParaJogador, type LinhaParaJogador } from '../batalha/registro'
import type { TurnosDaCena } from '../batalha/turnos'
import { vistaParaJogador, type ContextoDoJogador, type EstadoParaJogador } from '../batalha/vistaDoJogador'
import { projetarParaJogador } from '../nuvem/projecao'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { linhaQueOArbitroDesfaz } from './arbitroDaLuta'
import { participanteDaConta, type EstadoDaLuta, type FimDaLutaV4, type MarcoDaLuta, type ModoDaLuta, type ParticipanteDaLuta } from './luta'
import { criarMesaEmMemoria, type CasaDoTreino, type LutadoresDaLuta, type VagaDaLuta } from './mesaEmMemoria'
import { efeitosDoLado, turnosDoLado } from './vistaDoDuelo'

/**
 * A VISTA DE CADA CONTA NA LUTA DE N LADOS (Arena multijogador, fatia F2 de
 * docs/planos/arena-multijogador-2026-11-07.md §2): o `luta.estado` que o DO
 * manda a cada destinatário, um por papel.
 *  - QUEM JOGA: as fichas dele são "eu", as do mesmo lado (o colega de time)
 *    "aliado", o resto "outro". O fio vai recortado como no duelo
 *    (`vistaDoDuelo.ts`): o combate, os contra-ataques e os lembretes da marca
 *    só das fichas dele; os números das formas dele e dos aliados;
 *  - QUEM ASSISTE (o espectador, e o mestre que só olha): nenhuma ficha é dele.
 *    O fio vai sem o combate, os contra-ataques e os lembretes de ninguém, e as
 *    formas sem os números. Igual para todos que assistem: montada uma vez só;
 *  - O ÁRBITRO vê tudo: o fio inteiro, e na vista todas as fichas são "eu"
 *    (o combate e os contra-ataques de todos). F3: no registro dele, a
 *    última linha não riscada vem com `podeDesfazer`, se não é da saída de
 *    alguém (o Desfazer do árbitro, `linhaQueOArbitroDesfaz`).
 * F3: a pausa e os marcos do árbitro vão a todos (campos opcionais do fio).
 * A ficha é pública como no duelo: as cópias vão projetadas a todos
 * (`projetarParaJogador`), e o registro é a mesma cauda para todos.
 *
 * Só do servidor para o site, sem teto: o de 64 KiB é só do cliente para o DO.
 * Puro: sem rede, sem relógio, sem DOM.
 */

/** Como a conta olha a luta. */
export type OlharNaLuta = 'jogador' | 'assistindo' | 'arbitro'

/** A luta no fio, antes do recorte de cada conta. */
export interface LutaNoFio {
  versao: number
  id: string
  modo: ModoDaLuta
  seq: number
  fim: FimDaLutaV4 | null
  participantes: readonly ParticipanteDaLuta[]
  lutadores: LutadoresDaLuta
  tamanho: TamanhoDaGrade
  posicoes: Readonly<Record<string, CasaDoTreino>>
  montagem: boolean
  turnos: TurnosDaCena
  regras: RegrasDaBatalha | null
  efeitos: readonly EfeitoDaBatalha[]
  registro: readonly LinhaParaJogador[]
  /** F3: o árbitro pausou. Ausente = a luta corre. */
  pausada?: true
  /** F3: pausar, retomar e encerrar do árbitro. Ausente = nenhum. */
  marcos?: readonly MarcoDaLuta[]
}

/** A luta como UMA conta a recebe: o fio recortado para o olhar dela e a vista dela. */
export interface LutaDaConta extends LutaNoFio {
  olhar: OlharNaLuta
  vista: EstadoParaJogador
}

/** O olhar da conta; `null` = a conta não está nesta luta. O `juiz` (F3) joga o lado dele: olha como quem joga. */
export function olharDaConta(luta: Pick<EstadoDaLuta, 'participantes'>, contaId: string): OlharNaLuta | null {
  const participante = participanteDaConta(luta, contaId)
  if (participante === null) return null
  switch (participante.papel) {
    case 'jogador':
    case 'juiz':
      return 'jogador'
    case 'arbitro':
      return 'arbitro'
    case 'espectador':
      return 'assistindo'
  }
}

/** O estado que vai a todos antes do recorte: as cópias projetadas e só a cauda do registro, sem a reversão (como `dueloParaOFio`). */
export function lutaParaOFio(luta: EstadoDaLuta): LutaNoFio {
  const { vagas, personagens } = luta.lutadores
  const registro = registroParaJogador(luta.cena.registro, {
    // Ninguém desfaz pelo registro do fio (o árbitro ganha o dele no recorte); todos veem todas as fichas.
    playerId: '',
    minhaVez: false,
    tokensNoRecorte: new Set(vagas.map((vaga) => vaga.tokenId)),
    personagensVisiveis: new Set(personagens.map((personagem) => personagem.id)),
    npcs: new Set(),
  })
  return {
    versao: luta.versao,
    id: luta.id,
    modo: luta.modo,
    seq: luta.seq,
    fim: luta.fim,
    participantes: luta.participantes,
    lutadores: { vagas, personagens: personagens.map(projetarParaJogador) },
    tamanho: luta.tamanho,
    posicoes: luta.posicoes,
    montagem: luta.montagem,
    turnos: luta.cena.turnos,
    regras: luta.cena.regras,
    efeitos: luta.cena.efeitos ?? [],
    registro,
    ...(luta.pausada === true ? { pausada: true } : {}),
    ...(luta.marcos === undefined ? {} : { marcos: luta.marcos }),
  }
}

/** O registro do árbitro: a linha `desfazivel` com o Desfazer aceso (a única que ele desfaz). */
function registroDoArbitro(registro: readonly LinhaParaJogador[], desfazivel: string | null): readonly LinhaParaJogador[] {
  return desfazivel === null ? registro : registro.map((linha) => (linha.id === desfazivel ? { ...linha, podeDesfazer: true } : linha))
}

/** Quem é o quê para uma conta: as fichas "eu" e os personagens "aliado". */
interface RecorteDaConta {
  contaId: string
  olhar: OlharNaLuta
  minhas: readonly VagaDaLuta[]
  aliadas: readonly VagaDaLuta[]
  /** O id da linha que o Desfazer do árbitro desfaz; `null` = nenhuma, ou quem olha não arbitra. */
  desfazivel: string | null
}

function recorteDaConta(luta: EstadoDaLuta, contaId: string, olhar: OlharNaLuta): RecorteDaConta {
  const { vagas } = luta.lutadores
  if (olhar === 'arbitro') {
    const linha = linhaQueOArbitroDesfaz(luta)
    return { contaId, olhar, minhas: vagas, aliadas: [], desfazivel: linha === null ? null : linha.id }
  }
  if (olhar === 'assistindo') return { contaId: '', olhar, minhas: [], aliadas: [], desfazivel: null }
  const lado = participanteDaConta(luta, contaId)?.lado ?? null
  return {
    contaId,
    olhar,
    minhas: vagas.filter((vaga) => vaga.contaId === contaId),
    aliadas: vagas.filter((vaga) => lado !== null && vaga.lado === lado && vaga.contaId !== contaId),
    desfazivel: null,
  }
}

/** A ordem de quem assiste: sem o combate, os contra-ataques e os lembretes da marca de ninguém. */
function turnosDeQuemAssiste(turnos: TurnosDaCena): TurnosDaCena {
  const { combate: _combate, contras: _contras, lembretesDaMarca: _lembretes, ...daOrdem } = turnos
  return daOrdem
}

function fioDoRecorte(fio: LutaNoFio, recorte: RecorteDaConta): LutaNoFio {
  if (recorte.olhar === 'arbitro') return { ...fio, registro: registroDoArbitro(fio.registro, recorte.desfazivel) }
  if (recorte.olhar === 'assistindo') return { ...fio, turnos: turnosDeQuemAssiste(fio.turnos), efeitos: efeitosDoLado(fio.efeitos, new Set()) }
  const meusTokens = new Set(recorte.minhas.map((vaga) => vaga.tokenId))
  const comNumeros = new Set([...meusTokens, ...recorte.aliadas.map((vaga) => vaga.tokenId)])
  return {
    ...fio,
    turnos: turnosDoLado(fio.turnos, meusTokens, new Set(recorte.minhas.map((vaga) => vaga.personagemId))),
    efeitos: efeitosDoLado(fio.efeitos, comNumeros),
  }
}

/** O que a vista lê da mesa, montado uma vez por difusão: os nomes dos tokens e as equipes dos lados. */
interface MesaDaVista {
  tokensNoRecorte: ReadonlyMap<string, string>
  equipes: ContextoDoJogador['equipes']
}

function mesaDaVista(luta: EstadoDaLuta, sistema: SistemaDeRpg | null): MesaDaVista {
  const mesa = criarMesaEmMemoria(sistema, luta.lutadores, GRADES_DA_ARENA[luta.tamanho])
  return { tokensNoRecorte: new Map(mesa.tokens().map((token) => [token.id, token.name])), equipes: mesa.equipes() }
}

function lutaDoRecorte(luta: EstadoDaLuta, fio: LutaNoFio, recorte: RecorteDaConta, mesa: MesaDaVista, sistema: SistemaDeRpg | null): LutaDaConta {
  const vista = vistaParaJogador(luta.cena, {
    playerId: recorte.contaId,
    meusTokens: new Set(recorte.minhas.map((vaga) => vaga.tokenId)),
    tokensNoRecorte: mesa.tokensNoRecorte,
    meusPersonagens: new Set(recorte.minhas.map((vaga) => vaga.personagemId)),
    aliados: new Set(recorte.aliadas.map((vaga) => vaga.personagemId)),
    equipes: mesa.equipes,
    personagens: luta.lutadores.personagens,
    sistema,
  })
  const recortado = fioDoRecorte(fio, recorte)
  return { ...recortado, olhar: recorte.olhar, vista: { ...vista, registro: [...recortado.registro] } }
}

/** A luta para uma conta; `null` = a conta não está nesta luta. */
export function lutaParaAConta(luta: EstadoDaLuta, contaId: string, sistema: SistemaDeRpg | null): LutaDaConta | null {
  const olhar = olharDaConta(luta, contaId)
  if (olhar === null) return null
  return lutaDoRecorte(luta, lutaParaOFio(luta), recorteDaConta(luta, contaId, olhar), mesaDaVista(luta, sistema), sistema)
}

/**
 * A luta para todas as contas de uma vez (a difusão de cada jogada), pela
 * conta: o fio e a mesa montados uma vez só, e a de quem assiste uma vez para
 * todos os que assistem.
 */
export function lutaParaTodos(luta: EstadoDaLuta, sistema: SistemaDeRpg | null): ReadonlyMap<string, LutaDaConta> {
  const fio = lutaParaOFio(luta)
  const mesa = mesaDaVista(luta, sistema)
  const porConta = new Map<string, LutaDaConta>()
  let deQuemAssiste: LutaDaConta | null = null
  for (const { contaId } of luta.participantes) {
    const olhar = olharDaConta(luta, contaId)
    if (olhar === null) continue
    if (olhar === 'assistindo') {
      deQuemAssiste ??= lutaDoRecorte(luta, fio, recorteDaConta(luta, contaId, olhar), mesa, sistema)
      porConta.set(contaId, deQuemAssiste)
      continue
    }
    porConta.set(contaId, lutaDoRecorte(luta, fio, recorteDaConta(luta, contaId, olhar), mesa, sistema))
  }
  return porConta
}
