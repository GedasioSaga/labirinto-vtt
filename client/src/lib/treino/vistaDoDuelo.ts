import type { EfeitoDaBatalha } from '../batalha/combate'
import type { TurnosDaCena } from '../batalha/turnos'
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
 * "outro" (sem `personagemId`, sem "caiu"); só ele recebe as ações da vez
 * dele, os golpes que esperam a reação de ficha dele, os contra-ataques e o
 * combate (`meus`) das fichas dele. As cartas levam a equipe virtual do lado
 * (Lado A azul, Lado B vermelho), como a Arena.
 *
 * A FICHA É PÚBLICA NO DUELO: a Vida, a Energia e o Escudo de todas as cópias
 * vão inteiros aos dois lados, nas fichas do fio (`lutadores.personagens`),
 * com o histórico. Esconder só o Escudo do outro não escondia nada: o dano do
 * golpe (`efeitos`, "recebeu N" no registro) e a queda da Vida da ficha
 * mostram quanto o Escudo absorveu (`danoNoAlvo` gasta o Escudo antes da
 * Vida), e a Vida dos dois é o que a grade e a Arena do site já mostram. A
 * vista não muda isso: a carta da vista nunca leva a Vida de ninguém (o HUD a
 * lê da ficha que tem) e só leva o Escudo nas cartas "eu"/"aliado" (no leitor
 * do app, `lerEstadoParaJogador`, Escudo em carta "outro" é mensagem forjada);
 * o Escudo do outro, como a Vida dele, o site lê da ficha do fio.
 *
 * O FIO que vai junto é recortado para o lado (`fioDoLado`) no que a ficha não
 * conta: sem o combate, os contra-ataques e os lembretes da marca das fichas
 * do outro lado e sem os números das formas dele. Ficam inteiros os golpes
 * esperando reação: a vista também os dá aos dois (`golpes`: atacante, alvos,
 * d20 e total), o dano é o do golpe de quem ataca, e a tela do duelo os lê
 * para dizer "esperando o outro reagir". Ficam também a ordem, os selos e os
 * gastos da vez, que o registro e a grade já contam aos dois.
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

/** O lado da conta no duelo; `null` = a conta não joga este duelo. */
export function ladoDaContaNoDuelo(duelo: Pick<DueloGravado, 'jogadores'>, contaId: string): LadoDoTreino | null {
  return LADOS_DO_TREINO.find((lado) => duelo.jogadores[lado].contaId === contaId) ?? null
}

/** A ordem do duelo para um lado: o combate, os contra-ataques e os lembretes da marca só das fichas dele (a vista os dá só ao dono, em `meus` e `contras`). */
export function turnosDoLado(turnos: TurnosDaCena, meusTokens: ReadonlySet<string>, minhasFichas: ReadonlySet<string>): TurnosDaCena {
  const { combate, contras, lembretesDaMarca, ...daOrdem } = turnos
  const recorte: TurnosDaCena = { ...daOrdem }
  if (combate !== undefined) recorte.combate = Object.fromEntries(Object.entries(combate).filter(([personagemId]) => minhasFichas.has(personagemId)))
  if (contras !== undefined) recorte.contras = contras.filter((contra) => meusTokens.has(contra.tokenId))
  if (lembretesDaMarca !== undefined) recorte.lembretesDaMarca = lembretesDaMarca.filter((lembrete) => meusTokens.has(lembrete.tokenId))
  return recorte
}

/** Os efeitos para um lado: a forma do outro lado sai sem os números ("FOR 160 → 220"), como `efeitosParaJogador` faz a quem não é dono nem aliado. */
export function efeitosDoLado(efeitos: readonly EfeitoDaBatalha[], meusTokens: ReadonlySet<string>): EfeitoDaBatalha[] {
  return efeitos.map((efeito) => {
    if (efeito.tipo !== 'transformacao' || efeito.numeros === undefined || meusTokens.has(efeito.tokenId)) return efeito
    const { numeros: _soDoDono, ...soONome } = efeito
    return soONome
  })
}

/** O fio de sempre recortado para um lado: nada do que, na vista, só o outro lado vê. As fichas vão inteiras (a ficha é pública no duelo). */
function fioDoLado(fio: DueloNoFio, lado: LadoDoTreino): DueloNoFio {
  const doLado = fio.lutadores.vagas.filter((vaga) => vaga.lado === lado)
  const meusTokens = new Set(doLado.map((vaga) => vaga.tokenId))
  const minhasFichas = new Set(doLado.map((vaga) => vaga.personagemId))
  return {
    ...fio,
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
  return { ...fioDoLado(fio, lado), vista: vistaDoLado(duelo, lado, sistema, fio) }
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
