import { createStore, type StoreApi } from 'zustand/vanilla'
import { somarNaTrilha } from '../lib/batalha/caminhoAndado'
import { combatesNoComecoDaBatalha } from '../lib/batalha/acumuladorNaBatalha'
import type { EfeitoDaBatalha } from '../lib/batalha/combate'
import { chaveDoGastoDoInvocado, membrosDoBando, temporariosDaCena } from '../lib/batalha/invocacao'
import { desfazerFormasNoFim } from '../lib/batalha/transformacao'
import { comLembretesDaPreparacao } from '../lib/batalha/preparacao'
import { escudoNoComeco } from '../lib/batalha/recursosDaBatalha'
import { equipamentoNoAcervo } from '../lib/batalha/municoesDoAcervo'
import { bonusDaRoupa } from '../lib/mochila/bonusDaRoupa'
import { ID_DA_EQUIPE_DOS_JOGADORES, equipeDe } from '../lib/batalha/equipes'
import { comLembretesDoMomento } from '../lib/batalha/passivas'
import { lerJudgeNaCena, type JudgeNaCena } from '../lib/batalha/judge'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { registrarAjuste as registrarAjusteNasLinhas, TIPOS_QUE_O_JOGADOR_DESFAZ } from '../lib/batalha/registro'
import {
  agilidadesDasCartas,
  cartaDaVez,
  ordenarPelaAgilidade as ordenarNaOrdem,
  passarVez as passarVezNaOrdem,
  tokensCaidos,
  turnosVazios,
  type CartaDaOrdem,
  type TurnosDaCena,
} from '../lib/batalha/turnos'
import { aplicarAjustes, NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
import { revelarCartao } from '../lib/habilidadeOculta'
import type { Personagem } from '../lib/personagem'
import type { DependenciasDaBatalha, InicioDaBatalha, BatalhaDaCena, AnuncioDaBatalha, BatalhaState } from './batalha/tipos'
import { SEM_CAMINHOS, SEM_TRILHAS, CENA_NOVA, MESTRE, GASTO_ZERO, semACena, fichasDaMesa, comMudanca, cenasComOPersonagem } from './batalha/cena'
import { trocarEquipeNaMesa, textoDaTrocaDeEquipe } from './batalha/naMesa'
import { linhasDaDecisaoDe, reacoesComTecnicaDe, golpesDaReversao, linhasJuntoDe } from './batalha/desfazer'
import { criarNucleo } from './batalha/nucleo'
import { criarFormas } from './batalha/formas'
import { criarSelos } from './batalha/selos'
import { criarGolpe } from './batalha/golpe'
import { criarVez } from './batalha/vez'
import { criarOrdem } from './batalha/ordem'
import { criarInvocacao } from './batalha/invocacao'
import { criarCompanions } from './batalha/companions'
import { donosQueEscolhem } from '../lib/caracteristicas/naBatalha'
import { criarPassivas } from './batalha/passivas'
import { criarAjuda } from './batalha/ajuda'
import { criarDarNaBatalha } from './batalha/darNaBatalha'
import { tirarNoFimDaBatalhaNaMesa } from './batalha/condicoesNaFicha'

/**
 * MODO BATALHA (fatia B4 de docs/planos/modo-batalha-2026-10-24.md): quais
 * cenas estão em batalha e o caminho andado de cada ficha nelas. Estado da
 * SESSÃO do mestre (decisão 1): não vai ao arquivo, ao desfazer nem ao
 * jogador. A chave da cena é a de `tableSceneKey` (`net/hostSession.ts`): o id
 * da cena na aventura, ou o id do mapa solto.
 *
 * Quem lê é a sessão do host (`getBatalha`, a cada snapshot e pedido de
 * movimento); quem soma o caminho é a mesma sessão (`onBatalhaAndou`). O App
 * assina a store: troca de cena em batalha manda o snapshot na hora
 * (`notifyBatalhaChanged`) e o `anuncio` novo vai aos jogadores e à tela da
 * mesa (`anunciarBatalha`). A B5 só chama `ligar`, `desligar` e `zerarCaminhos`.
 *
 * BATALHA ONE PIECE F1 (docs/planos/batalha-one-piece-f1-plano.md): cada cena
 * ganha a ordem dos turnos, o registro com Desfazer e a cópia das regras do
 * campo. As regras puras moram em `lib/batalha/` (turnos, registro); aqui só
 * se escolhe o caminho e se escreve a linha do registro. Toda mudança disso
 * sobe `turnosRev` — e NÃO o `rev` dos caminhos, que faria snapshot inteiro do
 * mapa a cada vez (`deveAvisarJogadores`). O host lê pela `ponteDaBatalha`.
 *
 * ARENA DE TESTES, fase 0 (docs/planos/batalha-arena-de-testes-plano.md §4.2):
 * a store nasce de uma FÁBRICA, `criarBatalhaStore(mesa)`, e as fichas vêm só
 * da mesa recebida (`lib/batalha/mesa.ts`). `useBatalhaStore` é a instância da
 * mesa de verdade (`mesaDaAventura`), a única que o App, o host e a ponte
 * assinam; a arena cria a dela com as cópias, isolada de tudo isso.
 *
 * LOBBY v2, fatia T1 (docs/planos/lobby-jogadores-2026-11-05.md §8.2): a
 * fábrica mora sozinha AQUI, sem Tauri, sem a mesa de verdade e sem a store
 * DBT, para o treino do site rodar a mesma regra no navegador. O que vinha de
 * fora entra por `DependenciasDaBatalha`: o d20 (os 6 pontos que rolam) e a
 * pergunta "a cena já está na outra batalha?". `stores/batalhaStore.ts` só
 * instancia com o d20 seguro e a store DBT, e reexporta.
 *
 * A store é a VANILLA do zustand (`zustand/vanilla`, sem React): o duelo do
 * Worker (`lobby/nuvem/src/duelo.ts`) chega aqui pela regra do treino, e o
 * `zustand` inteiro puxava o `react` para o bundle. O hook do React
 * (`useBatalhaStore(seletor)`) mora só em `stores/batalhaStore.ts`, que embrulha
 * esta store com o `useStore`. A guarda é o `lib/nuvem/pureza.test.ts`.
 */

export type { DependenciasDaBatalha, AberturaDaBatalha, InicioDaBatalha, BatalhaDaCena, AnuncioDaBatalha, BatalhaState, OndeNasceOInvocado, AjusteDaColocacao } from './batalha/tipos'

/**
 * O corpo da store (o que era o inicializador do `create`), preso à `mesa`:
 * toda leitura e gravação de ficha das ações passa por ela. Todo d20 sai de
 * `deps.rolarD20`. Refatoração de 19/11/2026 (análise de 18/11, seção 3): as
 * ações moram em fatias por assunto em `stores/batalha/` (núcleo, formas,
 * selos, golpe, vez, ordem, invocação, passivas), cada uma criada com o
 * núcleo e as fatias de que depende; aqui fica a casca (ligar, desligar,
 * caminhos, retomar, encerrar, equipe, ajuste à mão, Desfazer, Judge).
 */
function estadoDaBatalha(mesa: MesaDaBatalha, deps: DependenciasDaBatalha, set: StoreApi<BatalhaState>['setState'], get: StoreApi<BatalhaState>['getState']): BatalhaState {
  // As fatias da store por assunto (stores/batalha/): o núcleo (cena, gravação, avisos, Desfazer) e as que dependem dele.
  const nucleo = criarNucleo(mesa, deps, set, get)
  const { mesaDoRpg, cenaDe, gravarCena, desfazerLinha } = nucleo
  const fatiaDasFormas = criarFormas(nucleo)
  const fatiaDosSelos = criarSelos(nucleo)
  const fatiaDoGolpe = criarGolpe(nucleo, fatiaDasFormas, fatiaDosSelos)
  const fatiaDaVez = criarVez(nucleo, fatiaDasFormas, fatiaDoGolpe)
  const { prazosDaVez } = fatiaDaVez
  const fatiaDaOrdem = criarOrdem(nucleo, fatiaDaVez)
  const fatiaDaInvocacao = criarInvocacao(nucleo, fatiaDoGolpe)
  const fatiaDosCompanions = criarCompanions(nucleo)
  const fatiaDasPassivas = criarPassivas(nucleo, fatiaDasFormas)
  const fatiaDaAjuda = criarAjuda(nucleo, fatiaDoGolpe, fatiaDasPassivas)
  // Itens refeitos, E6b: dar item na batalha (só a aliado; a munição recebida recarrega o pente vazio).
  const fatiaDoDar = criarDarNaBatalha(nucleo)

  /**
   * Conserto das fichas F1 (resposta do Vincent, "o Escudo volta cheio a cada
   * batalha"): no Iniciar, o Escudo de cada personagem da ordem volta ao cheio
   * gravado em `maximos` (`escudoNoComeco`; sem cheio, o de agora vira o
   * cheio). Gravação recusada pela pasta publicada: fica como está.
   */
  const encherOsEscudos = (cartas: readonly CartaDaOrdem[]): void => {
    const sistema = mesa.sistema()
    if (sistema === null) return
    const ids = new Set(cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])))
    for (const personagemId of ids) {
      mesa.ajustarPersonagem(personagemId, (atual) => {
        // Itens refeitos, decisão 8: o Escudo da roupa vestida enche junto, em cima do cheio da ficha.
        const escudo = escudoNoComeco(atual, sistema, bonusDaRoupa(atual.mochila, equipamentoNoAcervo).escudo)
        if (escudo === null) return atual
        const gravado: Personagem = { ...atual, maximos: { ...atual.maximos, [escudo.escudoId]: escudo.cheio } }
        return escudo.ajuste === null ? gravado : aplicarAjustes(gravado, sistema, [escudo.ajuste], NOME_DO_MESTRE, Date.now())
      })
    }
  }

  /**
   * Conserto das fichas F1 (resposta do Vagn): no fim da batalha, cada
   * personagem dela (na ordem ou com combate) desliga TODAS as formas (o atual
   * perde o que elas deram, bug 9). O cansaço do Overload mora nos selos da
   * batalha e some com ela. Gravação recusada pela pasta publicada: fica como está.
   */
  const fimDaBatalhaNasFichas = (turnos: TurnosDaCena): void => {
    const sistema = mesa.sistema()
    if (sistema === null) return
    const ids = new Set([...turnos.cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])), ...Object.keys(turnos.combate ?? {})])
    for (const personagemId of ids) mesa.ajustarPersonagem(personagemId, (atual) => desfazerFormasNoFim(atual, sistema, NOME_DO_MESTRE, Date.now()) ?? atual)
    // ITENS REFEITOS, E6c (decisão 11): saem da ficha as condições com duração; a "até alguém tirar" fica.
    tirarNoFimDaBatalhaNaMesa(mesa, ids)
  }

  /** COMPANION, fim da batalha: os tokens que nasceram para ela saem do mapa (o que já estava fica). */
  const tirarOsCompanions = (sceneKey: string, turnos: TurnosDaCena | undefined): void => {
    const criados = (turnos?.companions ?? []).filter((companion) => companion.criado).map((companion) => companion.tokenId)
    if (criados.length > 0) mesa.tirarTokensDosCompanions?.(sceneKey, criados)
  }

  return {
    cenas: {},
    anuncio: null,

    ligar: (sceneKey, abertura = {}, inicio) => {
      const { cenas, anuncio } = get()
      const seq = (anuncio?.seq ?? 0) + 1
      const novo: AnuncioDaBatalha = { seq, sceneKey }
      if (abertura.transicao !== undefined) novo.transicao = abertura.transicao
      if (abertura.texto !== undefined) novo.texto = abertura.texto
      const jaLigada = Object.hasOwn(cenas, sceneKey)
      // BATALHA DBT: a cena já está na batalha Dragon Ball. Não liga por cima nem anuncia (a mesma cena nunca fica nas duas).
      if (!jaLigada && deps.outraBatalhaLigada(sceneKey)) return
      if (jaLigada) {
        set({ anuncio: novo })
        return
      }
      // Invocação: o app fechado no meio da batalha deixou lobos salvos (personagem temporário e token).
      // Saem ANTES da ordem, e a carta de um deles que o mestre escolheu não entra.
      const sobras = new Set(temporariosDaCena(mesa.personagens(), sceneKey).map((personagem) => personagem.id))
      if (sobras.size > 0) mesa.limparInvocados?.(sceneKey)
      const semSobras = inicio === undefined || sobras.size === 0 ? inicio : { ...inicio, combatentes: inicio.combatentes.filter((carta) => carta.personagemId === null || !sobras.has(carta.personagemId)) }
      // Conserto das fichas F1 (resposta do Vincent): o Escudo de cada combatente volta cheio. Sem linha: o Iniciar não se desfaz.
      if (semSobras !== undefined) encherOsEscudos(semSobras.combatentes)
      set({ cenas: { ...get().cenas, [sceneKey]: semSobras === undefined ? CENA_NOVA : cenaDoInicio(mesa, semSobras, deps.rolarD20) }, anuncio: novo })
      // Fase C: o Iniciar já abre a vez do primeiro; a vida por turno do prazo dele sai aqui (linha própria, com Desfazer).
      if (semSobras !== undefined) prazosDaVez(sceneKey, null, cartaDaVez(get().cenas[sceneKey].turnos), MESTRE)
    },

    desligar: (sceneKey) => {
      const { cenas } = get()
      const cena = Object.hasOwn(cenas, sceneKey) ? cenas[sceneKey] : undefined
      // Invocação (decisão 10): o fim da batalha tira os invocados e os personagens temporários (nada vai ao bestiário).
      // Primeiro os da lista; depois a varredura pela marca pega o que sobrou (token tirado à mão, pendência perdida).
      for (const invocado of cena?.turnos.invocados ?? []) mesa.tirarInvocado?.(sceneKey, invocado.personagemId, invocado.tokenId)
      mesa.limparInvocados?.(sceneKey)
      // COMPANION: o token criado para a batalha sai; a ficha (com o dano que levou) fica.
      tirarOsCompanions(sceneKey, cena?.turnos)
      if (cena === undefined) return
      // Conserto das fichas F1: no fim da batalha as formas desligam sozinhas e o cansaço do Overload sai.
      fimDaBatalhaNasFichas(cena.turnos)
      set({ cenas: semACena(get().cenas, sceneKey) })
    },

    zerarCaminhos: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || Object.keys(cena.caminhos).length === 0) return
      gravarCena(sceneKey, { ...cena, caminhos: SEM_CAMINHOS, trilhas: SEM_TRILHAS, zerados: cena.zerados + 1, rev: cena.rev + 1 })
    },

    somarCaminho: (sceneKey, tokenId, blocos, casas = []) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || !Number.isFinite(blocos) || blocos <= 0) return
      const caminhos = { ...cena.caminhos, [tokenId]: (cena.caminhos[tokenId] ?? 0) + blocos }
      const trilhas = { ...cena.trilhas, [tokenId]: somarNaTrilha(cena.trilhas[tokenId] ?? [], casas) }
      const daVez = cartaDaVez(cena.turnos)
      // Invocação: na vez do bando, quem anda é um membro; o "Mov" conta no gasto dele.
      const chave = daVez === null ? null : daVez.bando === undefined ? (daVez.tokenId === tokenId ? daVez.id : null) : membrosDoBando(cena.turnos, daVez).some((membro) => membro.tokenId === tokenId) ? chaveDoGastoDoInvocado(daVez.id, tokenId) : null
      if (chave === null) {
        gravarCena(sceneKey, { ...cena, caminhos, trilhas, rev: cena.rev + 1 })
        return
      }
      // S7: a ficha da carta da vez andou — o "Mov 2/4" conta (e não trava, decisão 6); `turnosRev` sobe para o recorte chegar.
      const gasto = cena.turnos.gastos[chave] ?? GASTO_ZERO
      const turnos: TurnosDaCena = { ...cena.turnos, gastos: { ...cena.turnos.gastos, [chave]: { ...gasto, blocos: gasto.blocos + blocos } } }
      gravarCena(sceneKey, { ...cena, caminhos, trilhas, turnos, rev: cena.rev + 1, turnosRev: cena.turnosRev + 1 })
    },

    ligada: (sceneKey) => Object.hasOwn(get().cenas, sceneKey),

    reset: () => set({ cenas: {}, anuncio: null }),

    esquecerCenas: (sceneKeys) => {
      const { cenas } = get()
      if (!sceneKeys.some((sceneKey) => Object.hasOwn(cenas, sceneKey))) return
      set({ cenas: Object.fromEntries(Object.entries(cenas).filter(([sceneKey]) => !sceneKeys.includes(sceneKey))) })
    },

    retomar: (sceneKey, cena) => {
      if (Object.hasOwn(get().cenas, sceneKey) || deps.outraBatalhaLigada(sceneKey)) return false
      // As animações não voltam (já tocaram); sem `anuncio`, a abertura não toca de novo.
      const { efeitos: _jaTocados, ...semEfeitos } = cena
      set({ cenas: { ...get().cenas, [sceneKey]: semEfeitos } })
      return true
    },

    encerrarSalva: (sceneKey, cena) => {
      if (Object.hasOwn(get().cenas, sceneKey)) return
      for (const invocado of cena.turnos.invocados ?? []) mesa.tirarInvocado?.(sceneKey, invocado.personagemId, invocado.tokenId)
      mesa.limparInvocados?.(sceneKey)
      tirarOsCompanions(sceneKey, cena.turnos)
      fimDaBatalhaNasFichas(cena.turnos)
    },

    revelar: (personagemId, cartaoId) => mesa.ajustarPersonagem(personagemId, (atual) => revelarCartao(atual, cartaoId)),

    trocarEquipe: (personagemId, equipeId) => {
      // Lidos ANTES de trocar, como a foto da aventura de antes: a equipe e o nome não mudam com a troca.
      const equipes = mesa.equipes()
      const personagens = mesa.personagens()
      const antes = equipeDe(personagemId, equipes)
      if ((antes?.id ?? null) === equipeId) return true
      if (!trocarEquipeNaMesa(mesa, personagemId, equipeId)) return false
      const depois = equipeId === null ? null : (equipes.find((equipe) => equipe.id === equipeId) ?? null)
      const personagem = personagens.find((candidato) => candidato.id === personagemId)
      const texto = textoDaTrocaDeEquipe(personagem, antes, depois, equipeId === ID_DA_EQUIPE_DOS_JOGADORES)
      const cenas = { ...get().cenas }
      for (const { chave, cena, tokenIds } of cenasComOPersonagem(cenas, personagemId)) {
        cenas[chave] = comMudanca(cena, cena.turnos, {
          tipo: 'equipe',
          texto,
          tokenIds,
          personagemIds: [personagemId],
          reversao: { tipo: 'equipe', personagemId, antes: antes?.id ?? null, depois: equipeId },
        })
      }
      set({ cenas })
      return true
    },

    registrarAjuste: (personagemId, antes, depois, autor) => {
      if (antes === depois) return
      const { sistema } = mesaDoRpg()
      const cenas = { ...get().cenas }
      let mudou = false
      for (const { chave, cena, tokenIds } of cenasComOPersonagem(cenas, personagemId)) {
        const registro = registrarAjusteNasLinhas(cena.registro, { antes, depois, autor, sistema, quando: Date.now(), rodada: cena.turnos.rodada, tokenIds })
        if (registro === cena.registro) continue
        cenas[chave] = { ...cena, registro, turnosRev: cena.turnosRev + 1 }
        mudou = true
      }
      if (mudou) set({ cenas })
    },

    desfazer: (sceneKey, linhaId, autor) => {
      const cena = cenaDe(sceneKey)
      const linha = cena?.registro.find((candidata) => candidata.id === linhaId)
      if (cena === undefined || linha === undefined || linha.desfeita !== undefined) return false
      if (autor.tipo === 'jogador' && (linha.autor.tipo !== 'jogador' || linha.autor.playerId !== autor.playerId || !TIPOS_QUE_O_JOGADOR_DESFAZ.has(linha.tipo))) return false
      // F2 (fatia B, Rapid Dash): a linha que nasceu junto (o 2º golpe) sai com esta.
      const juntas = linhasJuntoDe(linha.reversao).flatMap((id) => cena.registro.find((candidata) => candidata.id === id) ?? [])
      // Tipos de habilidade F1: desfazer o golpe desfaz ANTES as reações com técnica a ele (o custo de quem reagiu volta).
      const golpeIds = new Set([linha, ...juntas].flatMap((dela) => golpesDaReversao(dela.reversao)))
      if (golpeIds.size > 0) {
        for (const outra of cena.registro) {
          if (outra.desfeita === undefined && reacoesComTecnicaDe(outra.reversao).some((parte) => golpeIds.has(parte.golpe.id))) desfazerLinha(sceneKey, outra.id, autor)
        }
      }
      for (const junta of [...juntas].reverse()) desfazerLinha(sceneKey, junta.id, autor)
      // Construtor C6: desfazer o pedido da forma desfaz antes a decisão do mestre que veio dele (o Desfazer volta tudo).
      for (const decisao of linhasDaDecisaoDe(cena.registro, linha.reversao)) desfazerLinha(sceneKey, decisao, autor)
      // Explorador 26/11/2026, bug 6: as linhas automáticas do começo da vez (Fim da vez, Condições, Recarga) saem antes
      // dela, da mais nova para a mais velha; ficavam de pé e o "Passar a vez" seguinte aplicava tudo de novo.
      if (linha.reversao.tipo === 'vez') {
        for (const junta of [...(linha.reversao.juntas ?? [])].reverse()) desfazerLinha(sceneKey, junta, autor)
      }
      if (!desfazerLinha(sceneKey, linhaId, autor)) return false
      // Conserto das fichas F1 (bug 2): o Desfazer da vez desfaz junto os "Não reagiu" que a virada dela escreveu,
      // do mais novo para o mais velho. O já desfeito fica como está. (Bug 3: a vez guarda só o que ela mudou, então
      // o "Não reagiu" desfeito sozinho antes não volta com ela.)
      if (linha.reversao.tipo === 'vez') {
        for (const fechado of [...(linha.reversao.fechados ?? [])].reverse()) desfazerLinha(sceneKey, fechado, autor)
      }
      return true
    },

    moverJudge: (sceneKey, x, y) => {
      const cena = cenaDe(sceneKey)
      const judge = lerJudgeNaCena({ x, y })
      if (cena === undefined || judge === null) return false
      if (cena.judge !== undefined && cena.judge.x === judge.x && cena.judge.y === judge.y) return false
      // Sem linha: mover o Judge não é jogada. `turnosRev` sobe para o `batalha.estado` levar a posição nova.
      gravarCena(sceneKey, { ...cena, judge, turnosRev: cena.turnosRev + 1 })
      return true
    },
    ...fatiaDasFormas.acoes,
    ...fatiaDosSelos.acoes,
    ...fatiaDoGolpe.acoes,
    ...fatiaDaVez.acoes,
    ...fatiaDaOrdem.acoes,
    ...fatiaDaInvocacao.acoes,
    ...fatiaDosCompanions.acoes,
    ...fatiaDasPassivas.acoes,
    ...fatiaDaAjuda.acoes,
    ...fatiaDoDar.acoes,
  }
}

/**
 * A FÁBRICA (arena, fase 0; treino, T1): uma store de batalha nova, que lê
 * e grava as fichas só pela `mesa` e rola o d20 só por `deps.rolarD20`. Cada
 * chamada é uma store separada, com as cenas dela; só o contador
 * `ultimoSeqDeEfeito` (`stores/batalha/cena.ts`) é do módulo (sobe sempre, não atrapalha ninguém).
 */
export function criarBatalhaStore(mesa: MesaDaBatalha, deps: DependenciasDaBatalha): StoreApi<BatalhaState> {
  return createStore<BatalhaState>()((set, get) => estadoDaBatalha(mesa, deps, set, get))
}

/**
 * Uma store de batalha SEM o hook do React (`getState`, `setState`,
 * `subscribe`): a do treino e a do duelo do Worker. A da mesa de verdade e a
 * da arena são esta mesma store com o hook, em `stores/batalhaStore.ts`.
 */
export type LojaDaBatalha = ReturnType<typeof criarBatalhaStore>

/** A cena que nasce do Iniciar: a ordem pela Agilidade (com o desempate escolhido), a vez na primeira que joga, as regras. */
function cenaDoInicio(mesa: MesaDaBatalha, inicio: InicioDaBatalha, rolarD20: () => number): BatalhaDaCena {
  const { personagens, sistema } = fichasDaMesa(mesa)
  const vazios = turnosVazios(inicio.desempate)
  const comCartas: TurnosDaCena = { ...vazios, cartas: [...inicio.combatentes] }
  const ordenados = ordenarNaOrdem(comCartas, agilidadesDasCartas(comCartas.cartas, personagens, sistema), rolarD20)
  const comeco = passarVezNaOrdem(ordenados, tokensCaidos(ordenados.cartas, personagens, sistema))
  // Tipos de habilidade F3: o lembrete das passivas de início do combate (e das que já começam no gatilho: rodada 1, vida baixa).
  // Nunca ativa (decisão 3). Sem linha: o Iniciar não se desfaz.
  const lembrados = comLembretesDoMomento('inicio', comeco?.turnos ?? ordenados, { personagens, sistema }).turnos
  // Conserto das fichas F1 (S4): quem tem a Preparação para a Batalha recebe a pergunta "vai fazer?" no começo.
  const preparados = comLembretesDaPreparacao(lembrados, { personagens, sistema }).turnos
  // Fase ED4: o acumulador que "começa a batalha em N" já entra com o nível. Sem linha: o Iniciar não se desfaz.
  const combate = combatesNoComecoDaBatalha(preparados, personagens)
  const comCombate = combate === preparados.combate ? preparados : { ...preparados, combate }
  // COMPANION: quem tem companion escolhe quem vai ("Aira escolhendo…"). A mesa sem mapa (a arena) não leva companion.
  const escolhendo = mesa.porCompanionsAoLado === undefined ? [] : donosQueEscolhem(comCombate.cartas, personagens)
  const turnos: TurnosDaCena = escolhendo.length === 0 ? comCombate : { ...comCombate, escolhendoCompanions: escolhendo }
  const cena: BatalhaDaCena = { ...CENA_NOVA, turnos, regras: inicio.regras }
  // F3: o Judge que o Iniciar já trouxe (torto fica de fora; o App põe depois).
  const judge = inicio.judge === undefined ? null : lerJudgeNaCena(inicio.judge)
  if (judge !== null) cena.judge = judge
  return cena
}

type EstadoDaBatalha = Pick<BatalhaState, 'cenas'>

/**
 * S2: o App avisa as pontes (`notifyBatalhaChanged`) quando isto é verdade:
 * uma cena ligou ou desligou, o mestre zerou caminhos, ou a ordem, o
 * registro ou as regras mudaram (`turnosRev`). O caminho que só soma vai com
 * o snapshot do próprio movimento.
 */
export function deveAvisarJogadores(state: EstadoDaBatalha, previous: EstadoDaBatalha): boolean {
  if (state.cenas === previous.cenas) return false
  const chaves = Object.keys(state.cenas)
  if (chaves.length !== Object.keys(previous.cenas).length) return true
  for (const chave of chaves) {
    const antes = previous.cenas[chave]
    const cena = state.cenas[chave]
    if (antes === undefined || cena === undefined) return true
    if (antes.zerados !== cena.zerados || antes.turnosRev !== cena.turnosRev) return true
  }
  return false
}

/** S4: o token da carta da vez na cena (para o anel e o pulso no mapa); `null` fora de batalha ou sem vez. */
export function vezTokenIdDaCena(state: EstadoDaBatalha, sceneKey: string | null): string | null {
  if (sceneKey === null) return null
  const cena = state.cenas[sceneKey]
  return cena === undefined ? null : (cartaDaVez(cena.turnos)?.tokenId ?? null)
}

const SEM_EFEITOS: readonly EfeitoDaBatalha[] = []

/**
 * S5: as animações da cena para o `EfeitosDaBatalha` do mestre (`App.tsx`).
 * Fora de batalha, a MESMA lista vazia (seletor estável).
 */
export function efeitosDaCena(state: EstadoDaBatalha, sceneKey: string | null): readonly EfeitoDaBatalha[] {
  if (sceneKey === null) return SEM_EFEITOS
  return state.cenas[sceneKey]?.efeitos ?? SEM_EFEITOS
}

/**
 * S-J1 (F3): onde o Judge está na cena, para o `PixiCanvas` do mestre;
 * `null` fora de batalha ou antes de o App o pôr. Devolve o MESMO objeto da
 * cena (seletor estável enquanto ele não anda).
 */
export function judgeDaCena(state: EstadoDaBatalha, sceneKey: string | null): JudgeNaCena | null {
  if (sceneKey === null) return null
  return state.cenas[sceneKey]?.judge ?? null
}

/** Ficha que o mestre move: sem personagem, ou de personagem NPC. */
function ehDoMestre(personagemId: string | null, personagens: readonly Personagem[]): boolean {
  if (personagemId === null) return true
  return personagens.find((personagem) => personagem.id === personagemId)?.tipo === 'npc'
}

/**
 * S9 (Q7): o contador do marcador Batalha no livro da mesa — a vez é de NPC
 * (1) mais as reações de NPC esperando. 0 = nada esperando o mestre. Lê os
 * personagens da mesa na hora (o tipo do personagem não mora na batalha).
 * Aqui a `mesa` é obrigatória; a de `stores/batalhaStore.ts` põe a de
 * verdade quando ela falta (a arena passa a dela).
 */
export function esperandoOMestre(state: EstadoDaBatalha, sceneKey: string | null, mesa: MesaDaBatalha): number {
  if (sceneKey === null) return 0
  const cena = state.cenas[sceneKey]
  if (cena === undefined) return 0
  const personagens = mesa.personagens()
  const daVez = cartaDaVez(cena.turnos)
  let esperando = daVez !== null && ehDoMestre(daVez.personagemId, personagens) ? 1 : 0
  for (const golpe of cena.turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (alvo.danoFinal === undefined && alvo.podeReagir && ehDoMestre(alvo.personagemId, personagens)) esperando += 1
    }
  }
  return esperando
}
