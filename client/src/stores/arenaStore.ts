import { useMemo } from 'react'
import { create } from 'zustand'
import { ajustesValidos, comAjustesDoBoneco, fichaDoBoneco } from '../lib/arena/boneco'
import { copiasDaMontagem, novoIdDeCopia } from '../lib/arena/copias'
import { AUTOR_DA_ARENA, equipesDaArena } from '../lib/arena/estadoDaArena'
import { comEscolha, judgeDoArbitro, montagemPronta, montagemVazia, semEscolha, tokensDaArena, type FichaNaGrade } from '../lib/arena/montagem'
import { golpeNoPlacar, placarDoBoneco, type ContextoDoPlacar, type NomeDoGolpe } from '../lib/arena/placar'
import { passoDoBoneco, type PassoDoBoneco } from '../lib/arena/reacaoDoBoneco'
import {
  BONECO_PADRAO,
  CASA_DA_ARENA,
  CENA_DA_ARENA,
  GRADES_DA_ARENA,
  type AjustesDoBoneco,
  type ArenaState,
  type BonecoDaArena,
  type ContaDoPlacar,
  type GolpeNoPlacar,
  type MontagemDaArena,
  type SessaoDaArena,
} from '../lib/arena/tipos'
import type { ParedeDoPasso } from '../lib/batalha/blocos'
import type { EfeitoDaBatalha, GolpeDaBatalha } from '../lib/batalha/combate'
import { recursoDoEscudo } from '../lib/batalha/leituraDaFicha'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { passoEmBatalha } from '../lib/batalha/movimentoEmBatalha'
import { REGISTRO_MAX, type LinhaDoRegistro } from '../lib/batalha/registro'
import { combatentesIniciais, tokensCaidos } from '../lib/batalha/turnos'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { recursoDeVida } from '../lib/vidaDaFicha'
import { criarBatalhaStore, type LojaDaBatalha } from './batalhaStore'
import { sistemaPorId, useRpgStore } from './rpgStore'

/**
 * ARENA DE TESTES DE BATALHA (fase 1 de
 * docs/planos/batalha-arena-de-testes-plano.md; decisões no fim do plano): a
 * sessão da arena (montagem, cópias, tokens, boneco, placar congelado), a
 * mesa das cópias (`mesaDaArena`) e a batalha da arena (`batalhaDaArena`),
 * uma store de batalha SEPARADA da de verdade: ninguém do App, do host ou da
 * rede a assina, e ela só grava nas cópias. Tudo em memória; sair esquece.
 *
 * O boneco reage e passa a vez sozinho (`lib/arena/reacaoDoBoneco.ts`), um
 * passo por vez, com `ATRASO_DO_BONECO_MS` antes de cada um (o d20 e o número
 * aparecem). O passo que a batalha recusar fica para o mestre resolver à mão
 * na caixa REAÇÃO.
 */

/** Espera antes de cada passo automático do boneco. */
const ATRASO_DO_BONECO_MS = 600
const SEM_FICHAS: readonly Personagem[] = []
const SEM_PAREDES: readonly ParedeDoPasso[] = []

/** O sistema do livro da sessão; `null` = não está no computador. */
function sistemaDaSessao(sessao: SessaoDaArena): SistemaDeRpg | null {
  return sistemaPorId(useRpgStore.getState().biblioteca, sessao.sistemaId) ?? null
}

/** Sessão nova do livro: montando, montagem vazia, o boneco padrão. */
function sessaoNova(sistemaId: string): SessaoDaArena {
  return { fase: 'montando', montagem: montagemVazia(BONECO_PADRAO), sistemaId, copias: [], origemDe: {}, tokens: [], ladoDe: {}, boneco: null, placarCongelado: [] }
}

/** A sessão de volta à montagem: a luta inteira some, as escolhas ficam. */
function semALuta(sessao: SessaoDaArena): SessaoDaArena {
  return { ...sessao, fase: 'montando', copias: [], origemDe: {}, tokens: [], ladoDe: {}, boneco: null, placarCongelado: [] }
}

/** Ajustes novos campo a campo: campo ausente fica como estava. */
function juntarAjustes(atual: AjustesDoBoneco, ajuste: Partial<AjustesDoBoneco>): AjustesDoBoneco {
  return ajustesValidos({
    infinito: ajuste.infinito ?? atual.infinito,
    hp: ajuste.hp ?? atual.hp,
    escudo: ajuste.escudo ?? atual.escudo,
    modificador: ajuste.modificador ?? atual.modificador,
    reage: ajuste.reage ?? atual.reage,
  })
}

/**
 * A MESA DAS CÓPIAS: a batalha da arena lê e grava só aqui. As equipes são as
 * duas virtuais; trocar de equipe não existe na arena.
 */
export const mesaDaArena: MesaDaBatalha = {
  personagens: () => useArenaStore.getState().sessao?.copias ?? SEM_FICHAS,
  sistema: () => {
    const sessao = useArenaStore.getState().sessao
    return sessao === null ? null : sistemaDaSessao(sessao)
  },
  equipes: () => {
    const sessao = useArenaStore.getState().sessao
    return sessao === null ? [] : equipesDaArena(sessao)
  },
  ajustarPersonagem: (personagemId, ajustar) => {
    const sessao = useArenaStore.getState().sessao
    const atual = sessao?.copias.find((copia) => copia.id === personagemId)
    if (sessao === null || atual === undefined) return false
    const novo = ajustar(atual)
    if (novo === atual) return true
    useArenaStore.setState({ sessao: { ...sessao, copias: sessao.copias.map((copia) => (copia.id === personagemId ? novo : copia)) } })
    return true
  },
  trocarEquipe: () => false,
}

/** A batalha da arena: sempre na cena `CENA_DA_ARENA`, com as cópias. */
export const batalhaDaArena: LojaDaBatalha = criarBatalhaStore(mesaDaArena)

// ───────────────────────────────────────────────────────────────────────────
// O boneco sozinho e o placar
// ───────────────────────────────────────────────────────────────────────────

/** golpeId → nome e atacante, guardados quando o golpe nasce (o golpe resolvido some dos pendentes; o efeito sai da fila). */
const nomesDosGolpes = new Map<string, NomeDoGolpe>()
let relogioDoBoneco: ReturnType<typeof setTimeout> | null = null

function guardarNomesDosGolpes(efeitos: readonly EfeitoDaBatalha[] | undefined): void {
  for (const efeito of efeitos ?? []) {
    if (efeito.tipo === 'golpe' && !nomesDosGolpes.has(efeito.golpeId)) nomesDosGolpes.set(efeito.golpeId, { nome: efeito.nome, atacanteTokenId: efeito.atacanteTokenId, alvos: efeito.alvos })
  }
}

/** Os golpes pendentes em que o boneco ainda não reagiu (`turnos.golpes` da cena). */
function esperandoOBoneco(golpes: readonly GolpeDaBatalha[] | undefined, bonecoTokenId: string): Set<string> {
  const esperando = new Set<string>()
  for (const golpe of golpes ?? []) if (golpe.alvos.some((alvo) => alvo.tokenId === bonecoTokenId && alvo.danoFinal === undefined)) esperando.add(golpe.id)
  return esperando
}

/** O contexto do placar da sessão; `null` = sem boneco. `golpes` = os pendentes da cena (o que espera o boneco fica fora). */
function contextoDoPlacar(sessao: SessaoDaArena, sistema: SistemaDeRpg | null, golpes: readonly GolpeDaBatalha[] | undefined): ContextoDoPlacar | null {
  if (sessao.boneco === null) return null
  return {
    bonecoPersonagemId: sessao.boneco.personagemId,
    bonecoTokenId: sessao.boneco.tokenId,
    idDaVida: recursoDeVida(sistema)?.id ?? null,
    idDoEscudo: sistema === null ? null : (recursoDoEscudo(sistema)?.id ?? null),
    golpes: nomesDosGolpes,
    esperando: esperandoOBoneco(golpes, sessao.boneco.tokenId),
    nomeDoToken: (tokenId) => sessao.tokens.find((token) => token.id === tokenId)?.name ?? 'Ficha',
  }
}

/** As linhas que saíram do teto do registro viram golpes congelados no placar antes de sumir. */
function congelarOsQueSairam(antes: readonly LinhaDoRegistro[], depois: readonly LinhaDoRegistro[], pendentes: readonly GolpeDaBatalha[] | undefined): void {
  // Só o teto tira linha do registro (o Desfazer só risca).
  if (depois.length < REGISTRO_MAX) return
  const ficaram = new Set(depois.map((linha) => linha.id))
  const sairam = antes.filter((linha) => !ficaram.has(linha.id))
  const sessao = useArenaStore.getState().sessao
  const ctx = sessao === null ? null : contextoDoPlacar(sessao, sistemaDaSessao(sessao), pendentes)
  if (sessao === null || ctx === null || sairam.length === 0) return
  const golpes = sairam.flatMap((linha): GolpeNoPlacar[] => {
    const golpe = golpeNoPlacar(linha, ctx)
    return golpe === null ? [] : [golpe]
  })
  if (golpes.length > 0) useArenaStore.setState({ sessao: { ...sessao, placarCongelado: [...sessao.placarCongelado, ...golpes] } })
}

/** O próximo passo do boneco agora; `null` = nada esperando ele (ou fora da luta). */
function proximoPassoDoBoneco(): PassoDoBoneco | null {
  const sessao = useArenaStore.getState().sessao
  const boneco = sessao !== null && sessao.fase === 'lutando' ? sessao.boneco : null
  const cena = batalhaDaArena.getState().cenas[CENA_DA_ARENA]
  if (sessao === null || boneco === null || cena === undefined) return null
  const caidos = tokensCaidos(cena.turnos.cartas, sessao.copias, sistemaDaSessao(sessao))
  return passoDoBoneco(cena.turnos, boneco.tokenId, boneco.reage, boneco.modificador, caidos)
}

/** Dá o passo do boneco, relido na hora (o mestre pode ter desfeito algo na espera). */
function darOPassoDoBoneco(): void {
  relogioDoBoneco = null
  const passo = proximoPassoDoBoneco()
  if (passo === null) return
  const batalha = batalhaDaArena.getState()
  // Recusado (`false`): nada muda, nenhum passo novo é agendado, e a caixa REAÇÃO do boneco fica com o mestre.
  if (passo.tipo === 'reagir') batalha.reagir(CENA_DA_ARENA, AUTOR_DA_ARENA, passo.pedido)
  else batalha.passarVez(CENA_DA_ARENA, AUTOR_DA_ARENA, passo.esperado)
}

/** Um passo por vez: com um já esperando, ou nada a fazer, não agenda outro. */
function agendarOBoneco(): void {
  if (relogioDoBoneco !== null || proximoPassoDoBoneco() === null) return
  relogioDoBoneco = setTimeout(darOPassoDoBoneco, ATRASO_DO_BONECO_MS)
}

function pararOBoneco(): void {
  if (relogioDoBoneco === null) return
  clearTimeout(relogioDoBoneco)
  relogioDoBoneco = null
}

/** A luta que acaba (Recomeçar, Voltar, Sair, outro livro): o boneco para e os nomes guardados somem. */
function encerrarALuta(): void {
  pararOBoneco()
  nomesDosGolpes.clear()
  batalhaDaArena.getState().desligar(CENA_DA_ARENA)
}

// ───────────────────────────────────────────────────────────────────────────
// A store
// ───────────────────────────────────────────────────────────────────────────

export const useArenaStore = create<ArenaState>()((set, get) => {
  /** Muda a montagem (só montando). A mesma montagem de volta = nada. */
  const mudarMontagem = (mudar: (montagem: MontagemDaArena) => MontagemDaArena): void => {
    const sessao = get().sessao
    if (sessao === null || sessao.fase !== 'montando') return
    const montagem = mudar(sessao.montagem)
    if (montagem !== sessao.montagem) set({ sessao: { ...sessao, montagem } })
  }

  /**
   * Começa (ou recomeça) a luta da montagem da sessão com as fichas reais de
   * AGORA: cópias, boneco, tokens, a batalha ligada pela Agilidade e o Judge
   * no lugar. Nada muda se a montagem não está pronta ou o livro não tem
   * sistema no computador.
   */
  const comecar = (sessao: SessaoDaArena, fichas: readonly Personagem[]): boolean => {
    const sistema = sistemaDaSessao(sessao)
    if (sistema === null || !montagemPronta(sessao.montagem, fichas)) return false
    const copias = copiasDaMontagem(sessao.montagem, fichas)
    if (copias.length === 0) return false
    const grade = GRADES_DA_ARENA[sessao.montagem.grade]
    const naGrade: FichaNaGrade[] = copias.map((copia) => ({ personagem: copia.personagem, lado: copia.lado }))
    const ajustes = ajustesValidos(sessao.montagem.boneco)
    const fichaBoneco = sessao.montagem.modo === 'boneco' ? fichaDoBoneco(sistema, ajustes, novoIdDeCopia()) : null
    if (fichaBoneco !== null) naGrade.push({ personagem: fichaBoneco, lado: 'boneco' })
    const { tokens, ladoDe } = tokensDaArena(naGrade, grade)
    const tokenDoBoneco = fichaBoneco === null ? undefined : tokens.find((token) => token.characterId === fichaBoneco.id)
    const boneco: BonecoDaArena | null = fichaBoneco === null || tokenDoBoneco === undefined ? null : { ...ajustes, tokenId: tokenDoBoneco.id, personagemId: fichaBoneco.id }
    const personagens = naGrade.map((ficha) => ficha.personagem)

    encerrarALuta()
    // A sessão vem ANTES de ligar: a ordem pela Agilidade lê as cópias pela mesa da arena.
    set({
      sessao: {
        ...sessao,
        fase: 'lutando',
        copias: personagens,
        origemDe: Object.fromEntries(copias.map((copia) => [copia.personagem.id, copia.origem])),
        tokens,
        ladoDe,
        boneco,
        placarCongelado: [],
      },
    })
    const batalha = batalhaDaArena.getState()
    const combatentes = combatentesIniciais(tokens, personagens, sistema, new Set(tokens.map((token) => token.id)))
    batalha.ligar(CENA_DA_ARENA, {}, { combatentes, regras: null, desempate: 'd20' })
    // O Judge: no modo boneco ele É o boneco; nos dois lados, árbitro ao norte da 1ª ficha da ordem.
    const primeiraId = batalhaDaArena.getState().cenas[CENA_DA_ARENA]?.turnos.cartas[0]?.tokenId
    const primeira = tokens.find((token) => token.id === primeiraId) ?? null
    const judge = tokenDoBoneco ?? judgeDoArbitro(primeira, grade)
    batalhaDaArena.getState().moverJudge(CENA_DA_ARENA, judge.x, judge.y)
    return true
  }

  return {
    sessao: null,

    abrir: (sistemaId) => {
      const sessao = get().sessao
      if (sessao !== null && sessao.sistemaId === sistemaId) return
      if (sessao !== null) encerrarALuta()
      set({ sessao: sessaoNova(sistemaId) })
    },

    escolher: (personagemId, lado, vezes) => mudarMontagem((montagem) => comEscolha(montagem, personagemId, lado, vezes)),

    tirar: (personagemId, lado) => mudarMontagem((montagem) => semEscolha(montagem, personagemId, lado)),

    trocarModo: (modo) => mudarMontagem((montagem) => (montagem.modo === modo ? montagem : { ...montagem, modo })),

    trocarGrade: (grade) => mudarMontagem((montagem) => (montagem.grade === grade ? montagem : { ...montagem, grade })),

    lutar: (fichas) => {
      const sessao = get().sessao
      if (sessao === null || sessao.fase !== 'montando') return false
      return comecar(sessao, fichas)
    },

    moverFicha: (tokenId, x, y) => {
      const sessao = get().sessao
      const token = sessao?.tokens.find((candidato) => candidato.id === tokenId)
      if (sessao === null || sessao.fase !== 'lutando' || token === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return false
      const grade = GRADES_DA_ARENA[sessao.montagem.grade]
      const casaDe = (valor: number): number => Math.floor(valor / CASA_DA_ARENA)
      // Sem paredes nem terreno na arena (fora da 1ª entrega); outra ficha ocupa a casa.
      const passo = passoEmBatalha({
        grid: CASA_DA_ARENA,
        colunas: grade.colunas,
        linhas: grade.linhas,
        de: { x: token.x, y: token.y },
        para: { x, y },
        tamanho: token.size,
        passoMaximo: null,
        paredesDoHost: SEM_PAREDES,
        paredesDoJogador: SEM_PAREDES,
        noChao: () => true,
        ocupada: (ponto) => sessao.tokens.some((outro) => outro.id !== tokenId && casaDe(outro.x) === casaDe(ponto.x) && casaDe(outro.y) === casaDe(ponto.y)),
      })
      if (!passo.ok || (passo.x === token.x && passo.y === token.y)) return false
      set({ sessao: { ...sessao, tokens: sessao.tokens.map((candidato) => (candidato.id === tokenId ? { ...candidato, x: passo.x, y: passo.y } : candidato)) } })
      const batalha = batalhaDaArena.getState()
      if (passo.blocos > 0) batalha.somarCaminho(CENA_DA_ARENA, tokenId, passo.blocos, passo.caminho)
      // O boneco anda e o Judge (que é ele) vai junto.
      if (sessao.boneco !== null && sessao.boneco.tokenId === tokenId) batalha.moverJudge(CENA_DA_ARENA, passo.x, passo.y)
      return true
    },

    ajustarBoneco: (ajuste) => {
      const sessao = get().sessao
      if (sessao === null) return
      const ajustes = juntarAjustes(sessao.montagem.boneco, ajuste)
      const montagem: MontagemDaArena = { ...sessao.montagem, boneco: ajustes }
      if (sessao.boneco === null) {
        set({ sessao: { ...sessao, montagem } })
        return
      }
      const boneco: BonecoDaArena = { ...sessao.boneco, ...ajustes }
      const sistema = sistemaDaSessao(sessao)
      // Só o que foi pedido: trocar o Escudo no meio da luta não enche a vida de volta. Sem linha no registro.
      const partes = { vida: ajuste.infinito !== undefined || ajuste.hp !== undefined, escudo: ajuste.escudo !== undefined }
      const copias =
        sistema === null || (!partes.vida && !partes.escudo)
          ? sessao.copias
          : sessao.copias.map((copia) => (copia.id === boneco.personagemId ? comAjustesDoBoneco(copia, sistema, ajustes, partes) : copia))
      set({ sessao: { ...sessao, montagem, boneco, copias } })
      // "Parado" ↔ "d20" pode destravar um golpe que espera o boneco.
      agendarOBoneco()
    },

    recomecar: (fichas) => {
      const sessao = get().sessao
      return sessao === null ? false : comecar(sessao, fichas)
    },

    voltarAMontagem: () => {
      const sessao = get().sessao
      if (sessao === null || sessao.fase === 'montando') return
      encerrarALuta()
      set({ sessao: semALuta(sessao) })
    },

    sair: () => {
      if (get().sessao === null) return
      encerrarALuta()
      set({ sessao: null })
    },
  }
})

// Cada mudança da batalha da arena: guarda os nomes dos golpes, congela o que sai do registro e agenda o boneco.
batalhaDaArena.subscribe((estado, anterior) => {
  const cena = estado.cenas[CENA_DA_ARENA]
  if (cena === undefined) return
  guardarNomesDosGolpes(cena.efeitos)
  const antes = anterior.cenas[CENA_DA_ARENA]
  if (antes !== undefined && antes.registro !== cena.registro) congelarOsQueSairam(antes.registro, cena.registro, cena.turnos.golpes)
  agendarOBoneco()
})

/**
 * O placar do modo boneco (`PlacarDoBoneco`): cada golpe que tirou algo dele,
 * o total e a média por rodada, do registro não desfeito mais os congelados.
 * `null` = fora da luta ou modo "lados".
 */
export function usePlacarDaArena(): ContaDoPlacar | null {
  const sessao = useArenaStore((state) => state.sessao)
  const registro = batalhaDaArena((state) => state.cenas[CENA_DA_ARENA]?.registro)
  const rodada = batalhaDaArena((state) => state.cenas[CENA_DA_ARENA]?.turnos.rodada)
  const golpes = batalhaDaArena((state) => state.cenas[CENA_DA_ARENA]?.turnos.golpes)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  return useMemo(() => {
    if (sessao === null || registro === undefined || rodada === undefined) return null
    const ctx = contextoDoPlacar(sessao, sistemaPorId(biblioteca, sessao.sistemaId) ?? null, golpes)
    return ctx === null ? null : placarDoBoneco(registro, ctx, sessao.placarCongelado, rodada)
  }, [sessao, registro, rodada, golpes, biblioteca])
}
