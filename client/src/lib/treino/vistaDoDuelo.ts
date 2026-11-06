import { vistaParaJogador, type EstadoParaJogador } from '../batalha/vistaDoJogador'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { dueloParaOFio, type DueloGravado, type DueloNoFio } from './duelo'
import { criarMesaEmMemoria, LADOS_DO_TREINO, type LadoDoTreino } from './mesaEmMemoria'

/**
 * A VISTA DE CADA LADO NO FIO DO DUELO (fatia M2 da Arena no site): o recorte
 * que o HUD da Arena do app (`BatalhaDoJogador`, `FaixaDaOrdem`) lê, o
 * `EstadoParaJogador`, montado pelo SERVIDOR para cada lado com a mesma
 * `vistaParaJogador` da mesa. O site não consegue montá-lo sozinho: o cheio
 * da barra do Escudo (`cheioDoEscudo`) lê o registro COMPLETO, com a reversão,
 * e o fio só leva a cauda (`dueloParaOFio`).
 *
 * Cada lado é um jogador da mesa: as fichas dele são "eu", as do outro lado
 * "outro" (sem `personagemId`, sem Escudo, sem "caiu"); só ele recebe as ações
 * da vez dele, os golpes que esperam a reação de ficha dele, os contra-ataques
 * e o combate (`meus`) das fichas dele. As cartas levam a equipe virtual do
 * lado (Lado A azul, Lado B vermelho), como a Arena.
 *
 * O registro da vista é o MESMO do fio (a cauda, `REGISTRO_PARA_JOGADOR_MAX`
 * linhas, sem a reversão): no duelo os dois veem todas as fichas e ninguém
 * desfaz (o servidor não tem desfazer, então nenhuma linha acende o botão).
 *
 * Só do servidor para o site, sem teto: o de 64 KiB é só do cliente para o DO
 * (`lerJogadaDoDuelo`), e a vista nunca volta ao servidor. Puro: sem rede,
 * sem relógio, sem DOM.
 */

/** O duelo como UM lado o recebe: o fio de sempre e a vista dele. */
export interface DueloDoLado extends DueloNoFio {
  vista: EstadoParaJogador
}

/** O lado da conta no duelo; `null` = a conta não joga este duelo. */
export function ladoDaContaNoDuelo(duelo: Pick<DueloGravado, 'jogadores'>, contaId: string): LadoDoTreino | null {
  return LADOS_DO_TREINO.find((lado) => duelo.jogadores[lado].contaId === contaId) ?? null
}

/** A vista de um lado sobre o duelo guardado, com o registro do fio (`fio.registro`). */
function vistaDoLado(duelo: DueloGravado, lado: LadoDoTreino, sistema: SistemaDeRpg | null, fio: DueloNoFio): EstadoParaJogador {
  // A mesma mesa da jogada (`aplicarJogada`): os tokens com o nome da cópia e as duas equipes dos lados.
  const mesa = criarMesaEmMemoria(sistema, duelo.lutadores)
  const doLado = duelo.lutadores.vagas.filter((vaga) => vaga.lado === lado)
  const vista = vistaParaJogador(duelo.cena, {
    playerId: duelo.jogadores[lado].contaId,
    meusTokens: new Set(doLado.map((vaga) => vaga.tokenId)),
    tokensNoRecorte: new Map(mesa.tokens().map((token) => [token.id, token.name])),
    meusPersonagens: new Set(doLado.map((vaga) => vaga.personagemId)),
    // Todas as fichas do lado são da mesma conta: nenhuma é "aliado", todas são "eu".
    aliados: new Set(),
    equipes: mesa.equipes(),
    personagens: duelo.lutadores.personagens,
    sistema,
  })
  return { ...vista, registro: [...fio.registro] }
}

/** O duelo para um lado: o fio e a vista dele. */
export function dueloParaOLado(duelo: DueloGravado, lado: LadoDoTreino, sistema: SistemaDeRpg | null): DueloDoLado {
  const fio = dueloParaOFio(duelo)
  return { ...fio, vista: vistaDoLado(duelo, lado, sistema, fio) }
}

/** O duelo para os dois lados de uma vez (a difusão de cada jogada): o fio é montado uma vez só. */
export function dueloParaOsLados(duelo: DueloGravado, sistema: SistemaDeRpg | null): Readonly<Record<LadoDoTreino, DueloDoLado>> {
  const fio = dueloParaOFio(duelo)
  return {
    a: { ...fio, vista: vistaDoLado(duelo, 'a', sistema, fio) },
    b: { ...fio, vista: vistaDoLado(duelo, 'b', sistema, fio) },
  }
}
