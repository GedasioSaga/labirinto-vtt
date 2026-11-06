import type { EfeitoDaBatalha } from '../batalha/combate'
import { recursoDoEscudo } from '../batalha/leituraDaFicha'
import type { TurnosDaCena } from '../batalha/turnos'
import { vistaParaJogador, type EstadoParaJogador } from '../batalha/vistaDoJogador'
import type { ParteDoAjuste, Personagem } from '../personagem'
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
 * O FIO que vai junto também é recortado para o lado (`fioDoLado`), senão o
 * resto do frame levaria o que a vista esconde: sem o combate, os
 * contra-ataques e os lembretes da marca das fichas do outro lado, sem o
 * Escudo das fichas dele e sem os números das formas dele. Ficam inteiros os
 * golpes esperando reação: a vista também os dá aos dois (`golpes`:
 * atacante, alvos, d20 e total), o dano é o do golpe de quem ataca, e a tela
 * do duelo os lê para dizer "esperando o outro reagir". Ficam também a ordem,
 * os selos e os gastos da vez, que o registro e a grade já contam aos dois.
 *
 * O registro da vista é o MESMO do fio (a cauda, `REGISTRO_PARA_JOGADOR_MAX`
 * linhas, sem a reversão): no duelo os dois veem todas as fichas e ninguém
 * desfaz (o servidor não tem desfazer, então nenhuma linha acende o botão).
 *
 * Só do servidor para o site, sem teto: o de 64 KiB é só do cliente para o DO
 * (`lerJogadaDoDuelo`), e a vista nunca volta ao servidor. Puro: sem rede,
 * sem relógio, sem DOM.
 */

/** O duelo como UM lado o recebe: o fio recortado para ele e a vista dele. */
export interface DueloDoLado extends DueloNoFio {
  vista: EstadoParaJogador
}

/**
 * O duelo como o site o LÊ: a vista pode faltar (o Worker de antes da M2 só
 * manda o fio) ou vir torta. Aí o duelo entra com `vista` null, sem o HUD da
 * Arena, em vez de derrubar o frame inteiro (`lerDueloDoLado`).
 */
export interface DueloRecebido extends DueloNoFio {
  vista: EstadoParaJogador | null
}

/** Sem o sistema, o Escudo é achado pelo id do livro (`recursoDoEscudo` acha por id ou por nome). */
const ID_DO_ESCUDO_SEM_SISTEMA = 'escudo'

/** As partes do histórico da ficha que guardam um número de recurso: o atual, o máximo e o modificador. */
const PARTES_DE_RECURSO: ReadonlySet<ParteDoAjuste> = new Set<ParteDoAjuste>(['recurso', 'maximo', 'modRecurso'])

/** O lado da conta no duelo; `null` = a conta não joga este duelo. */
export function ladoDaContaNoDuelo(duelo: Pick<DueloGravado, 'jogadores'>, contaId: string): LadoDoTreino | null {
  return LADOS_DO_TREINO.find((lado) => duelo.jogadores[lado].contaId === contaId) ?? null
}

function semAChave<T>(mapa: Readonly<Record<string, T>>, chave: string): Record<string, T> {
  return Object.fromEntries(Object.entries(mapa).filter(([id]) => id !== chave))
}

/** A ficha do OUTRO lado: sem o Escudo (o atual, o máximo, o modificador e as linhas dele no histórico), como a carta "outro" da vista. */
function fichaDoOutroLado(ficha: Personagem, idDoEscudo: string): Personagem {
  return {
    ...ficha,
    recursos: semAChave(ficha.recursos, idDoEscudo),
    maximos: semAChave(ficha.maximos, idDoEscudo),
    modificadoresDosRecursos: semAChave(ficha.modificadoresDosRecursos, idDoEscudo),
    historico: ficha.historico.filter((ajuste) => !PARTES_DE_RECURSO.has(ajuste.parte) || ajuste.chave !== idDoEscudo),
  }
}

/** A ordem do duelo para um lado: o combate, os contra-ataques e os lembretes da marca só das fichas dele (a vista os dá só ao dono, em `meus` e `contras`). */
function turnosDoLado(turnos: TurnosDaCena, meusTokens: ReadonlySet<string>, minhasFichas: ReadonlySet<string>): TurnosDaCena {
  const { combate, contras, lembretesDaMarca, ...daOrdem } = turnos
  const recorte: TurnosDaCena = { ...daOrdem }
  if (combate !== undefined) recorte.combate = Object.fromEntries(Object.entries(combate).filter(([personagemId]) => minhasFichas.has(personagemId)))
  if (contras !== undefined) recorte.contras = contras.filter((contra) => meusTokens.has(contra.tokenId))
  if (lembretesDaMarca !== undefined) recorte.lembretesDaMarca = lembretesDaMarca.filter((lembrete) => meusTokens.has(lembrete.tokenId))
  return recorte
}

/** Os efeitos para um lado: a forma do outro lado sai sem os números ("FOR 160 → 220"), como `efeitosParaJogador` faz a quem não é dono nem aliado. */
function efeitosDoLado(efeitos: readonly EfeitoDaBatalha[], meusTokens: ReadonlySet<string>): EfeitoDaBatalha[] {
  return efeitos.map((efeito) => {
    if (efeito.tipo !== 'transformacao' || efeito.numeros === undefined || meusTokens.has(efeito.tokenId)) return efeito
    const { numeros: _soDoDono, ...soONome } = efeito
    return soONome
  })
}

/** O fio de sempre recortado para um lado: nada do que, na vista, só o outro lado vê. */
function fioDoLado(fio: DueloNoFio, lado: LadoDoTreino, sistema: SistemaDeRpg | null): DueloNoFio {
  const doLado = fio.lutadores.vagas.filter((vaga) => vaga.lado === lado)
  const meusTokens = new Set(doLado.map((vaga) => vaga.tokenId))
  const minhasFichas = new Set(doLado.map((vaga) => vaga.personagemId))
  // Sistema sem Escudo (`recursoDoEscudo` null): não há o que tirar.
  const idDoEscudo = sistema === null ? ID_DO_ESCUDO_SEM_SISTEMA : (recursoDoEscudo(sistema)?.id ?? null)
  const personagens = fio.lutadores.personagens.map((ficha) => (idDoEscudo === null || minhasFichas.has(ficha.id) ? ficha : fichaDoOutroLado(ficha, idDoEscudo)))
  return {
    ...fio,
    lutadores: { ...fio.lutadores, personagens },
    turnos: turnosDoLado(fio.turnos, meusTokens, minhasFichas),
    efeitos: efeitosDoLado(fio.efeitos, meusTokens),
  }
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

/** O lado a partir do fio já montado: o fio recortado e a vista dele. */
function ladoDoFio(duelo: DueloGravado, fio: DueloNoFio, lado: LadoDoTreino, sistema: SistemaDeRpg | null): DueloDoLado {
  return { ...fioDoLado(fio, lado, sistema), vista: vistaDoLado(duelo, lado, sistema, fio) }
}

/** O duelo para um lado: o fio recortado e a vista dele. */
export function dueloParaOLado(duelo: DueloGravado, lado: LadoDoTreino, sistema: SistemaDeRpg | null): DueloDoLado {
  return ladoDoFio(duelo, dueloParaOFio(duelo), lado, sistema)
}

/** O duelo para os dois lados de uma vez (a difusão de cada jogada): o fio é montado uma vez só. */
export function dueloParaOsLados(duelo: DueloGravado, sistema: SistemaDeRpg | null): Readonly<Record<LadoDoTreino, DueloDoLado>> {
  const fio = dueloParaOFio(duelo)
  return { a: ladoDoFio(duelo, fio, 'a', sistema), b: ladoDoFio(duelo, fio, 'b', sistema) }
}
