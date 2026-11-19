import { createStore, type StoreApi } from 'zustand/vanilla'
import { somarNaTrilha } from '../lib/batalha/caminhoAndado'
import {
  chaveDaVez,
  combateVazio,
  type CombateDoPersonagem,
  type EfeitoDaBatalha,
  type PedidoDeAjusteNaBatalha,
  type PedidoDoContador,
  type PedidoDeEvolucao,
  type PedidoDeMarca,
  type PedidoDePassiva,
  type LembreteDaPassiva,
  type SeloDaBatalha,
  MUDANCAS_DO_AJUSTE_MAX,
  NOME_DO_SELO_MAX,
} from '../lib/batalha/combate'
import { contadorDoPersonagem, motivoDoContador, nivelDoContador, seloDoContador, selosComONivel, temGolpeEsperando } from '../lib/batalha/contador'
import {
  chaveDoGastoDoInvocado,
  comBandosEmDia,
  comunsQueSaem,
  invocadoDaPendencia,
  membrosDoBando,
  motivoDaInvocacao,
  nomeDaColocacao,
  nomeNumerado,
  novoIdDeInvocacao,
  numerosValidos,
  pedirInvocacao,
  pendenciaPorId,
  semBandosVazios,
  temporariosDaCena,
  ultraEmCampo,
  type ContextoDaInvocacao,
} from '../lib/batalha/invocacao'
import { fichaDoInvocado } from '../lib/livros/combate'
import { criarMarca, marcaDoToken, modificadorDoTeste, motivoDaMarca, passivaDaMarca } from '../lib/batalha/marca'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import type { Token } from '../types/map'
import {
  bonusDaBatalha,
  comSeloNovo,
  criarSelo,
  ondeNaVez,
  nomeDoSeloNaBatalha,
  novoIdDeSelo,
  seloPedidoValido,
  textoDoSeloComMods,
  textoDosMods,
  textoDosQueAcabaram,
} from '../lib/batalha/selos'
import { desfazerFormasNoFim, formaDaFicha } from '../lib/batalha/transformacao'
import { ehLembreteDoSangramento, porVezDoLembrete, travaDoToken, verboDoPorVez } from '../lib/batalha/condicoes'
import { comLembretesDaPreparacao, ehLembreteDaPreparacao, NOME_DA_PREPARACAO, seloDaPreparacao } from '../lib/batalha/preparacao'
import { danoComAsReducoes, reducoesDoDano } from '../lib/batalha/reducaoDoDano'
import { ajusteDoRecurso, ajusteDoSpDaVez, escudoNoComeco, ganhaSpNaVez, maximoDoRecurso } from '../lib/batalha/recursosDaBatalha'
import { custoPorTurno, textoDoCustoPorTurno } from '../lib/batalha/custoPorTurno'
import { ID_DA_EQUIPE_DOS_JOGADORES, equipeDe } from '../lib/batalha/equipes'
import { cartaoDaVariante, comEvoluida, custoDaEvolucao, evolucaoDe, motivoDoEvoluir, varianteDoPedido } from '../lib/batalha/escolhaEEvolucao'
import { acoesDaCarta, ajustesDoCusto, custoEmSp, depoisDaTecnica, textoDaRolagem } from '../lib/batalha/golpe'
import { chavesDoDono, mantidaDe, mecanicaDoCartao, perdaNoFimDaVez, porcentoDoMaximo } from '../lib/batalha/mecanicasAMao'
import {
  ajustesDoPorTurno,
  chaveDoGatilho,
  comLembrada,
  comLembretesDaVez,
  comLembretesDoMomento,
  custoDaPassiva,
  efeitoPorTurno,
  gatilhoDaPassiva,
  modsSomados,
  motivoDaPassiva,
  seloDaPassiva,
  selosDaPassiva,
  semLembretes,
  textoDoPorTurno,
} from '../lib/batalha/passivas'
import { lerJudgeNaCena, type JudgeNaCena } from '../lib/batalha/judge'
import { CAMPO_DO_TEMPO, ehOverload, lerTempo, recursoDoCusto, tecnicaPorId, tecnicasDe } from '../lib/batalha/leituraDaFicha'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { ajustesDoDano } from '../lib/batalha/reacao'
import {
  mudancasDaVez,
  nomeDoAutor,
  novoIdDeLinha,
  registrarAjuste as registrarAjusteNasLinhas,
  semOLigarDeGraca,
  textoDaLinha,
  TIPOS_QUE_O_JOGADOR_DESFAZ,
  type ParteDaFicha,
  type Reversao,
} from '../lib/batalha/registro'
import {
  adicionarCartaExtra as adicionarCartaExtraNaOrdem,
  agilidadesDasCartas,
  cartaDaVez,
  darVez as darVezNaOrdem,
  incluirCombatente as incluirCombatenteNaOrdem,
  moverCarta as moverCartaNaOrdem,
  normalizar,
  novaCarta,
  ordenarPelaAgilidade as ordenarNaOrdem,
  passarVez as passarVezNaOrdem,
  removerCarta as removerCartaDaOrdem,
  selosQueSairam,
  tirarCombatente as tirarCombatenteDaOrdem,
  tokensCaidos,
  trocarDesempate as trocarDesempateNaOrdem,
  turnosVazios,
  type AutorDaAcao,
  type CartaDaOrdem,
  type GastoDaVez,
  type TurnosDaCena,
} from '../lib/batalha/turnos'
import { aplicarAjustes, ajusteDoAtualDigitado, NOME_DO_MESTRE, type Ajuste } from '../lib/ajusteDaFicha'
import { cartaoPorId as cartaoEmQualquerNivel, motivoDoOcultoParaJogador, NOME_DO_OCULTO, nomeNaBatalha, ocultoNaBatalha, revelarCartao } from '../lib/habilidadeOculta'
import { numeroDaFicha, type Personagem } from '../lib/personagem'
import { chavesDosSelos } from '../lib/ponteDasCondicoes'
import { comecoDoPrazoNaVez, fimDoPrazoNaVez, motivoDoPrazo, textoDosPrazosQueAcabaram } from '../lib/prazoNaVez'
import { comCondicoes, condicoesDaFicha } from '../lib/turnoForaDaBatalha'
import type { DependenciasDaBatalha, InicioDaBatalha, BatalhaDaCena, AnuncioDaBatalha, BatalhaState } from './batalha/tipos'
import {
  SEM_CAMINHOS,
  SEM_TRILHAS,
  CENA_NOVA,
  MESTRE,
  GASTO_ZERO,
  semACena,
  fichasDaMesa,
  nomeDaCarta,
  type LinhaNova,
  comMudanca,
  idsDaOrdem,
  cenasComOPersonagem,
  type EfeitoNovo,
  comEfeitos,
  quemNaFicha,
  personagemDoTokenNa,
  nomeDoTokenNa,
  nomeDoBandoNa,
  partesDosLembretes,
} from './batalha/cena'
import {
  trocarEquipeNaMesa,
  textoDaTrocaDeEquipe,
  tirarDoMapa,
  mexerNaFicha,
  semOsCaidos,
  textoDosQueSairam,
  tirouSp,
  reversaoDaFicha,
  mudancaValida,
} from './batalha/naMesa'
import { linhasDaDecisaoDe, devolverFichasDaAcao, reacoesComTecnicaDe, golpesDaReversao, linhasJuntoDe } from './batalha/desfazer'
import { criarNucleo } from './batalha/nucleo'
import { criarFormas } from './batalha/formas'
import { efeitosDosSelos, criarSelos } from './batalha/selos'
import { novoIdDaMarca, golpesDaVezQueAcaba, criarGolpe } from './batalha/golpe'

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
/** Janela em que movimentos seguidos da mesma carta pelo mestre viram uma linha (Alt + seta repetido). */
const JANELA_DO_MOVIMENTO_MS = 5_000

/** O que o começo de vez (`comecarAVez`) recebe de quem andou a vez: os turnos de antes e de depois e o que vai na linha "vez". */
interface VezQueComeca {
  /** Os turnos de antes da vez andar (no "Passar a vez", depois dos "Não reagiu" da virada). */
  antes: TurnosDaCena
  /** Os turnos com a vez nova e os lembretes do começo dela. */
  depois: TurnosDaCena
  /** A carta que acaba a vez (fim da vez das mecânicas, desconto do prazo); `null` = nenhuma. */
  sai: CartaDaOrdem | null
  /** A carta que começa a vez (vida por turno do prazo). */
  entra: CartaDaOrdem | null
  autor: AutorDaAcao
  /** O texto da linha sem os +10 SP (que vão no fim). */
  texto: string
  tokenIds: readonly string[]
  /** As cartas que a vez tirou da ordem (extras da rodada, bando vazio): o Desfazer da vez as põe de volta. */
  removidas: Extract<Reversao, { tipo: 'vez' }>['antes']['removidas']
  /** A ordem de antes, só quando a virada mudou alguém de lugar. */
  ordem?: readonly string[]
  /** As linhas "Não reagiu" que a virada gravou antes da vez. */
  fechados: readonly string[]
  /** Os selos que acabaram com a vez (efeito na tela). */
  acabaram: readonly SeloDaBatalha[]
  /** A rodada virou. */
  virou: boolean
}

/**
 * O corpo da store (o que era o inicializador do `create`), preso à `mesa`:
 * toda leitura e gravação de ficha das ações passa por ela. Todo d20 sai de
 * `deps.rolarD20`.
 */
function estadoDaBatalha(mesa: MesaDaBatalha, deps: DependenciasDaBatalha, set: StoreApi<BatalhaState>['setState'], get: StoreApi<BatalhaState>['getState']): BatalhaState {
  // As fatias da store por assunto (stores/batalha/): o núcleo (cena, gravação, avisos, Desfazer) e as que dependem dele.
  const nucleo = criarNucleo(mesa, deps, set, get)
  const { mesaDoRpg, cenaDe, gravarCena, mudarTurnos, avisarQuemCaiu, comAvisoDeQuemCaiu, revelarAoUsar, ocultoParaQuemPede, lembrarDepoisDoDano, desfazerLinha } = nucleo
  const fatiaDasFormas = criarFormas(nucleo)
  const { desligarAForma, custoDaFormaNaVez, custoDaMantidaNaVez } = fatiaDasFormas
  const fatiaDosSelos = criarSelos(nucleo)
  const fatiaDoGolpe = criarGolpe(nucleo, fatiaDasFormas, fatiaDosSelos)
  const { agirComACarta, fecharGolpesSemResposta } = fatiaDoGolpe

  /**
   * Conserto de 18/11/2026 (análise, seção 2.3): a carta que sai da ordem tinha a vez. Antes a vez só pulava
   * para a carta seguinte, sem o começo de vez (recarga, +10 SP, prazo das condições) e sem virar a rodada
   * quando era a última. Agora a vez anda ANTES pelo "Passar a vez" de sempre, numa linha própria (o Desfazer
   * de cada linha segue separado), como o DBT faz (`motor.ts`, ação 'tirar'). Cai noutra carta que também
   * sai (a extra do mesmo token): passa de novo. Ninguém mais joga: a saída leva a vez como antes.
   */
  const passarAVezDeQuemSai = (sceneKey: string, sai: (carta: CartaDaOrdem) => boolean): void => {
    for (let voltas = cenaDe(sceneKey)?.turnos.cartas.length ?? 0; voltas > 0; voltas -= 1) {
      const turnos = cenaDe(sceneKey)?.turnos
      const daVez = turnos === undefined ? null : cartaDaVez(turnos)
      if (daVez === null || !sai(daVez) || !get().passarVez(sceneKey)) return
    }
  }

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
        const escudo = escudoNoComeco(atual, sistema)
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
  }

  /**
   * Conserto das fichas F1 (resposta do Vincent): +10 SP no começo da vez de
   * quem não gastou SP desde a vez anterior (`ganhaSpNaVez` no combate de
   * `antes`; a primeira vez da batalha não ganha). Grava pela mesa e devolve a
   * parte para a linha da vez e o pedaço do texto (só do jogador: o SP do NPC
   * não aparece). Nada a ganhar, SP cheio ou gravação recusada = `null`.
   */
  const spDoComecoDaVez = (antes: TurnosDaCena, depois: TurnosDaCena, autor: AutorDaAcao): { ficha: { personagemId: string; partes: ParteDaFicha[] }; texto: string } | null => {
    const para = cartaDaVez(depois)
    if (para === null || para.personagemId === null || para.id === antes.vez || !ganhaSpNaVez(antes.combate?.[para.personagemId])) return null
    const personagemId = para.personagemId
    const feito = mexerNaFicha(
      mesa,
      personagemId,
      (atual, sistemaDaMesa) => {
        const ajuste = ajusteDoSpDaVez(atual, sistemaDaMesa)
        return ajuste === null ? [] : [ajuste]
      },
      quemNaFicha(autor),
    )
    if (feito === null || feito === 'recusada' || feito.length === 0) return null
    const ganho = feito.reduce((soma, parte) => (parte.parte === 'recurso' ? soma + parte.para - parte.de : soma), 0)
    const personagem = mesa.personagens().find((candidato) => candidato.id === personagemId)
    const nome = personagem?.nome.trim() || 'a ficha'
    return { ficha: { personagemId, partes: feito }, texto: personagem?.tipo === 'jogador' ? ` · ${nome} recupera ${ganho} SP` : '' }
  }

  /**
   * F2 (fatia F, Siegfried): o que o fim da vez de `saindo` tira e dá sozinho,
   * numa linha própria com Desfazer, gravada depois da linha da vez:
   *  - Doença das Trevas: o dono perde 3% do HP máximo (27) se andou ou agiu
   *    nesta vez (`gasto`);
   *  - Chamas Celestes: em quem tem o selo, −15 SP; no dono da técnica, +10 SP
   *    e −3% do HP máximo dele;
   *  - F2b (A Caçada Começa): a forma com duração conta esta vez do dono (a
   *    vez em que ligou não conta) e, no fim da última, desliga sozinha, com o
   *    cansaço do Overload.
   * `rodada` = a da vez que acaba. Nada a fazer: a cena fica como está.
   */
  const fimDaVezDasMecanicas = (sceneKey: string, saindo: CartaDaOrdem | null, gasto: GastoDaVez | undefined, rodada: number, autor: AutorDaAcao): void => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || saindo === null || saindo.personagemId === null) return
    const { personagens, sistema } = mesaDoRpg()
    if (sistema === null) return
    const quem = quemNaFicha(autor)
    const partes: Reversao[] = []
    const textos: string[] = []
    const tokenIds = new Set<string>([saindo.tokenId])
    const fichaDe = (personagemId: string): Personagem | undefined => mesa.personagens().find((candidato) => candidato.id === personagemId)
    const nomeDe = (personagemId: string): string => fichaDe(personagemId)?.nome.trim() || 'a ficha'
    /** Soma `delta` no recurso; devolve quanto mudou de verdade (0 = nada, ou recusado). */
    const mexer = (personagemId: string, qual: 'sp' | 'hp', delta: number): number => {
      const antes = fichaDe(personagemId)
      const feito = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => {
        const ajuste = ajusteDoRecurso(atual, sistemaDaMesa, qual, delta)
        return ajuste === null ? [] : [ajuste]
      }, quem)
      if (feito === null || feito === 'recusada' || feito.length === 0 || antes === undefined) return 0
      partes.push(...reversaoDaFicha(personagemId, feito))
      return feito.reduce((soma, parte) => (parte.parte === 'recurso' ? soma + parte.para - parte.de : soma), 0)
    }
    const perdaDoMaximo = (personagemId: string, porcento: number): number => {
      const ficha = fichaDe(personagemId)
      const maximo = ficha === undefined ? null : maximoDoRecurso(ficha, sistema, 'hp')
      return maximo === null ? 0 : porcentoDoMaximo(maximo, porcento)
    }
    // Doença das Trevas: só na vez em que andou ou agiu (Mover, Atacar, técnica, Concentrar). `golpeou`: a técnica livre (Florescer) não soma nos contadores.
    const agiu = gasto !== undefined && (gasto.movimento > 0 || gasto.blocos > 0 || gasto.simples > 0 || gasto.bonus > 0 || gasto.atacou === true || gasto.golpeou === true)
    const dona = fichaDe(saindo.personagemId)
    const doenca = dona === undefined ? null : perdaNoFimDaVez(chavesDoDono(dona))
    if (agiu && doenca !== null) {
      const perdeu = mexer(saindo.personagemId, 'hp', -perdaDoMaximo(saindo.personagemId, doenca.hpPorcento))
      if (perdeu !== 0) textos.push(`${nomeDe(saindo.personagemId)} perde ${-perdeu} HP (Doença das Trevas)`)
    }
    // Chamas Celestes: cada selo dela em quem sai.
    for (const selo of cena.turnos.selos ?? []) {
      const dreno = selo.tokenId === saindo.tokenId && selo.cartaoId !== undefined ? mecanicaDoCartao(selo.cartaoId)?.drenoNoFimDaVez : undefined
      const cartaoDoSelo = selo.cartaoId
      if (dreno === undefined || cartaoDoSelo === undefined) continue
      const dono = personagens.find((candidato) => chavesDoDono(candidato).includes(cartaoDoSelo))
      const tirou = mexer(saindo.personagemId, 'sp', -dreno.alvoSp)
      const partesDoDono: string[] = []
      if (dono !== undefined) {
        const ganhou = mexer(dono.id, 'sp', dreno.donoSp)
        const perdeu = mexer(dono.id, 'hp', -perdaDoMaximo(dono.id, dreno.donoHpPorcento))
        if (ganhou !== 0) partesDoDono.push(`+${ganhou} SP`)
        if (perdeu !== 0) partesDoDono.push(`${perdeu} HP`)
        const doDono = cena.turnos.cartas.find((carta) => carta.personagemId === dono.id && carta.extra === undefined)
        if (doDono !== undefined) tokenIds.add(doDono.tokenId)
      }
      const noAlvo = tirou === 0 ? 'sem SP para tirar' : `${tirou} SP`
      textos.push(`${selo.nome} em ${nomeDe(saindo.personagemId)}: ${noAlvo}${dono === undefined || partesDoDono.length === 0 ? '' : `; ${dono.nome.trim() || 'o dono'} ${partesDoDono.join(', ')}`}`)
    }
    let novos = cena.turnos
    const efeitos: EfeitoNovo[] = []
    // F2b (A Caçada Começa): "5 turnos" = 5 vezes do dono DEPOIS da vez em que ligou (a da carta extra também conta).
    const forma = novos.formas?.[saindo.personagemId]
    const ligada = forma !== undefined && dona !== undefined && dona.cartoesAtivos.includes(forma.cartaoId)
    if (forma?.duracao !== undefined && ligada && forma.duracao.ligouNa !== chaveDaVez(rodada, saindo.id)) {
      const cartao = dona === undefined ? null : formaDaFicha(dona, sistema, forma.cartaoId)
      // Fatia C7 (revisão): a forma oculta conta e acaba como "???".
      const nomeDaForma = cartao === null || dona === undefined ? 'A forma' : nomeNaBatalha(dona, cartao, 'A forma')
      const faltam = forma.duracao.faltam - 1
      if (faltam > 0) {
        partes.push({ tipo: 'forma', personagemId: saindo.personagemId, antes: forma })
        novos = { ...novos, formas: { ...(novos.formas ?? {}), [saindo.personagemId]: { ...forma, duracao: { ...forma.duracao, faltam } } } }
        textos.push(`${nomeDaForma}: ${faltam === 1 ? 'falta 1 vez' : `faltam ${faltam} vezes`}`)
      } else {
        const overload = cartao !== null && ehOverload(cartao)
        const desligada = desligarAForma(saindo.personagemId, saindo.tokenId, forma.cartaoId, overload, novos, quem)
        if (desligada !== null) {
          partes.push(...desligada.partes)
          novos = desligada.turnos
          efeitos.push({ tipo: 'forma', tokenId: saindo.tokenId, forma: nomeDaForma, ligou: false })
          textos.push(`${nomeDaForma} acabou${overload ? ': atributos pela metade até o fim da batalha (Cansaço do Overload)' : ''}`)
        }
      }
    }
    if (partes.length === 0) return
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const atual = cenaDe(sceneKey) ?? cena
    const linha = comMudanca(atual, novos, { tipo: 'acao', texto: `Fim da vez: ${textos.join(' · ')}`, autor, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } })
    gravarCena(sceneKey, efeitos.length === 0 ? linha : { ...linha, efeitos: comEfeitos(atual.efeitos, efeitos) })
    avisarQuemCaiu(sceneKey, autor)
  }

  /**
   * Fase C (prazo das condições, `lib/prazoNaVez.ts`): a vez passou de `de`
   * para `para`. A ficha de `de` desconta 1 turno de cada prazo (o que a
   * batalha ainda segura por selo de mesmo nome fica aceso); a de `para`
   * perde a vida por turno, direto no HP (sem Escudo, sem redução: Envenenado
   * 3 x 4 tira 12, como fora da batalha). Uma linha própria com Desfazer
   * (o prazo volta pela mesa, o HP pela ficha), gravada depois da linha da
   * vez. A mesa sem mapa (arena) não tem prazo; nada a fazer: nada muda.
   */
  const prazosDaVez = (sceneKey: string, de: CartaDaOrdem | null, para: CartaDaOrdem | null, autor: AutorDaAcao): void => {
    const { fichaDaCena, mudarFichaDaCena } = mesa
    const cena = cenaDe(sceneKey)
    if (cena === undefined || fichaDaCena === undefined || mudarFichaDaCena === undefined) return
    const { personagens } = mesaDoRpg()
    const nomeDe = nomeDoTokenNa(cena.turnos, personagens)
    const partes: Reversao[] = []
    const textos: string[] = []
    const tokenIds = new Set<string>()
    const efeitos: EfeitoNovo[] = []
    // Fim da vez de quem sai (a carta do bando não tem ficha própria no mapa).
    const saindo = de === null || de.bando !== undefined ? null : fichaDaCena(sceneKey, de.tokenId)
    const fim = saindo === null ? null : fimDoPrazoNaVez(saindo, chavesDosSelos(cena.turnos.selos).get(saindo.id))
    if (saindo !== null && fim !== null) {
      const depois = condicoesDaFicha(fim.token)
      mudarFichaDaCena(sceneKey, saindo.id, (token) => comCondicoes(token, depois))
      partes.push({ tipo: 'prazo', tokenId: saindo.id, antes: condicoesDaFicha(saindo) })
      if (fim.acabaram.length > 0) {
        textos.push(textoDosPrazosQueAcabaram(fim.acabaram, nomeDe(saindo.id)))
        tokenIds.add(saindo.id)
      }
    }
    // Começo da vez de quem entra: lida DEPOIS do desconto (a mesma ficha pode ter a vez de novo).
    const entrando = para === null || para.bando !== undefined || para.personagemId === null ? null : fichaDaCena(sceneKey, para.tokenId)
    const comeco = entrando === null ? null : comecoDoPrazoNaVez(entrando)
    if (para !== null && para.personagemId !== null && comeco !== null) {
      const feito = mexerNaFicha(mesa, para.personagemId, (atual, sistema) => ajustesDoDano(atual, sistema, comeco.dano, true), quemNaFicha(autor))
      if (feito !== null && feito !== 'recusada' && feito.length > 0) {
        partes.push(...reversaoDaFicha(para.personagemId, feito))
        textos.push(`${nomeDe(para.tokenId)} perde ${comeco.dano} HP (${motivoDoPrazo(comeco.danos)})`)
        tokenIds.add(para.tokenId)
        efeitos.push({ tipo: 'dano', tokenId: para.tokenId, valor: comeco.dano, saida: 'direto' })
      }
    }
    // Só o desconto, sem nada que acabou nem dano: não há o que dizer ao mestre (o número que falta está na pastilha).
    if (textos.length === 0) return
    const atual = cenaDe(sceneKey) ?? cena
    const caidos = semOsCaidos(mesa, sceneKey, atual.turnos)
    partes.push(...caidos.partes)
    const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
    const lembrados = lembrarDepoisDoDano(semCaidos)
    partes.push(...partesDosLembretes(lembrados))
    const texto = `Condições: ${textos.join(' · ')}${textoDosQueSairam(caidos.nomes)}`
    const linha = comMudanca(atual, lembrados.turnos, { tipo: efeitos.length > 0 ? 'dano' : 'acao', texto, autor, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } })
    gravarCena(sceneKey, efeitos.length === 0 ? linha : { ...linha, efeitos: comEfeitos(atual.efeitos, efeitos) })
    if (efeitos.length > 0) avisarQuemCaiu(sceneKey, autor)
  }

  /**
   * Conserto de 18/11/2026 (análise, seção 2.3): o prazo das condições só andava na vez de quem tem carta. A
   * ficha da cena FORA da ordem (o refém envenenado, o invocado do bando) ficava com o prazo parado a batalha
   * inteira. Na virada da rodada cada uma passa um turno, como `prazosDaVez` faz com quem tem a vez: a vida
   * por turno e o desconto. Uma linha própria com Desfazer; só o desconto, sem notícia, fica sem linha (igual).
   */
  const prazosForaDaOrdem = (sceneKey: string, autor: AutorDaAcao): void => {
    const { fichasDaCena, mudarFichaDaCena } = mesa
    const cena = cenaDe(sceneKey)
    if (cena === undefined || fichasDaCena === undefined || mudarFichaDaCena === undefined) return
    const naOrdem = new Set(cena.turnos.cartas.map((carta) => carta.tokenId))
    const seguradas = chavesDosSelos(cena.turnos.selos)
    const partes: Reversao[] = []
    const textos: string[] = []
    const tokenIds = new Set<string>()
    const efeitos: EfeitoNovo[] = []
    for (const ficha of fichasDaCena(sceneKey)) {
      if (naOrdem.has(ficha.id)) continue
      const comeco = comecoDoPrazoNaVez(ficha)
      const fim = fimDoPrazoNaVez(ficha, seguradas.get(ficha.id))
      const nome = ficha.name.trim() || 'Ficha sem nome'
      if (comeco !== null && ficha.characterId !== null) {
        const feito = mexerNaFicha(mesa, ficha.characterId, (atual, sistema) => ajustesDoDano(atual, sistema, comeco.dano, true), quemNaFicha(autor))
        if (feito !== null && feito !== 'recusada' && feito.length > 0) {
          partes.push(...reversaoDaFicha(ficha.characterId, feito))
          textos.push(`${nome} perde ${comeco.dano} HP (${motivoDoPrazo(comeco.danos)})`)
          tokenIds.add(ficha.id)
          efeitos.push({ tipo: 'dano', tokenId: ficha.id, valor: comeco.dano, saida: 'direto' })
        }
      }
      if (fim !== null) {
        const depois = condicoesDaFicha(fim.token)
        mudarFichaDaCena(sceneKey, ficha.id, (token) => comCondicoes(token, depois))
        partes.push({ tipo: 'prazo', tokenId: ficha.id, antes: condicoesDaFicha(ficha) })
        if (fim.acabaram.length > 0) {
          textos.push(textoDosPrazosQueAcabaram(fim.acabaram, nome))
          tokenIds.add(ficha.id)
        }
      }
    }
    if (textos.length === 0) return
    const atual = cenaDe(sceneKey) ?? cena
    const linha = comMudanca(atual, atual.turnos, { tipo: efeitos.length > 0 ? 'dano' : 'acao', texto: `Condições fora da ordem: ${textos.join(' · ')}`, autor, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } })
    gravarCena(sceneKey, efeitos.length === 0 ? linha : { ...linha, efeitos: comEfeitos(atual.efeitos, efeitos) })
  }

  /**
   * O começo de vez num lugar só: o "Passar a vez" e o "Dar a vez" do mestre andam a vez nos turnos e
   * chegam aqui. Grava os +10 SP de quem entra, a linha "vez" com o Desfazer (só o que a vez mudou, o SP
   * e as linhas fechadas antes dela) e os selos que acabaram; depois o fim da vez das mecânicas de quem
   * sai e o prazo das condições (na virada, também o de quem está fora da ordem). A carta que sai da
   * ordem com a vez chega aqui pelo "Passar a vez" (`passarAVezDeQuemSai`). `cena` = a cena em que
   * `vez.antes` foi lido.
   */
  const comecarAVez = (sceneKey: string, cena: BatalhaDaCena, vez: VezQueComeca): void => {
    const { antes, depois, sai, autor } = vez
    // Conserto das fichas F1 (bug 3): a linha guarda só o que a vez mudou (o Desfazer volta só isso).
    const mudou = mudancasDaVez(antes, depois)
    // Conserto das fichas F1: +10 SP para quem começa a vez sem ter gastado SP na anterior.
    const sp = spDoComecoDaVez(antes, depois, autor)
    const linha: LinhaNova = {
      tipo: 'vez',
      autor,
      texto: `${vez.texto}${sp?.texto ?? ''}`,
      tokenIds: vez.tokenIds,
      // Os "Não reagiu" vieram antes da vez (fora de `mudou`); `fechados` diz ao Desfazer da vez quais linhas voltam junto.
      reversao: {
        tipo: 'vez',
        antes: { vez: antes.vez, rodada: antes.rodada, removidas: vez.removidas, gastos: antes.gastos, ...(vez.ordem === undefined ? {} : { ordem: vez.ordem }) },
        ...(mudou === undefined ? {} : { mudou }),
        ...(vez.fechados.length === 0 ? {} : { fechados: vez.fechados }),
        ...(sp === null ? {} : { ficha: sp.ficha }),
      },
    }
    // A ficha passou pela aventura (o SP): grava sobre a cena de agora.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, { ...comMudanca(atual, depois, linha), efeitos: comEfeitos(atual.efeitos, efeitosDosSelos(vez.acabaram)) })
    // F2 (fatia F): a Doença das Trevas, as Chamas Celestes e a duração da forma de quem saiu, numa linha própria (com Desfazer).
    fimDaVezDasMecanicas(sceneKey, sai, sai === null ? undefined : antes.gastos[sai.id], antes.rodada, autor)
    // Fase C: o prazo das condições (o desconto de quem saiu, a vida por turno de quem entra).
    prazosDaVez(sceneKey, sai, vez.entra, autor)
    // 18/11/2026: na virada, o prazo de quem está fora da ordem também anda (um turno por rodada).
    if (vez.virou) prazosForaDaOrdem(sceneKey, autor)
  }

  /**
   * Tipos de habilidade F3: a passiva (`PedidoDePassiva`). Ver `passiva` em
   * `BatalhaState`. A reversão de Ativar é [combate, ficha, selo]; a de
   * Desligar, [combate, selos]; a de Aplicar, [combate, selo, ficha]. O
   * "combate" volta só o que a linha mudou (o lembrete tirado, os usos), e
   * vem primeiro: no Desfazer, o selo volta antes e o lembrete "a cada turno"
   * acha a passiva ligada.
   */
  /**
   * Conserto das fichas F1 (S4): a resposta aos lembretes que a REGRA põe (não
   * uma passiva da ficha). `lembrete` = o que está esperando no combate.
   *  - Sangramento: só o mestre decide. Aplicar tira 10 direto no HP (sem
   *    Escudo), menos as reduções de quem sangra (F2, revisão da fatia E: a
   *    Ryoko tira 7), com linha "dano"; pular só tira o lembrete.
   *  - Preparação para a Batalha: Aplicar com `atributoId` põe o selo +20 nele
   *    até o fim do combate; "Agora não" só tira o lembrete.
   * A reversão é [combate, ficha | selo]: o Desfazer devolve o lembrete.
   */
  const lembreteDaRegra = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, personagemId: string, lembrete: LembreteDaPassiva, pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>): boolean => {
    const { turnos } = cena
    const { personagens, sistema } = mesaDoRpg()
    const sangramento = ehLembreteDoSangramento(lembrete)
    if (sistema === null || (sangramento && autor.tipo === 'jogador')) return false
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const semOLembrete = semLembretes(combateAntes ?? combateVazio(), lembrete.cartaoId)
    const comCombate = (base: TurnosDaCena): TurnosDaCena => ({ ...base, combate: { ...(base.combate ?? {}), [personagemId]: semOLembrete } })
    if (!pedido.aplicar) {
      gravarCena(sceneKey, comMudanca(cena, comCombate(turnos), null))
      return true
    }
    const quem = nomeDoTokenNa(turnos, personagens)(carta.tokenId)
    const partes: Reversao[] = [{ tipo: 'combate', personagemId, antes: combateAntes, depois: semOLembrete }]
    if (sangramento) {
      // F2 (fatia A): quanto tira (Sangrando 10, Queimando N) e o verbo da linha vêm do selo, ou do lembrete se o selo já saiu no fim da vez.
      const { nome, dano: porVez } = porVezDoLembrete(lembrete, turnos.selos)
      // F2 (revisão da fatia E): o dano por vez também passa pelas reduções de quem sangra ("na Ryoko os −30% valem contra TUDO": 10 vira 7).
      let dado = porVez
      let reducao = ''
      const feito = mexerNaFicha(
        mesa,
        personagemId,
        (atual, sistemaDaMesa) => {
          const reducoes = reducoesDoDano(atual, sistemaDaMesa)
          dado = danoComAsReducoes(porVez, reducoes)
          reducao = reducoes.length === 0 ? '' : `; ${reducoes.map((parte) => `${parte.nome} -${parte.porcento}%`).join(', ')}: de ${porVez}`
          return ajustesDoDano(atual, sistemaDaMesa, dado, true)
        },
        quemNaFicha(autor),
      )
      if (feito === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, feito))
      const atual = cenaDe(sceneKey) ?? cena
      const caidos = semOsCaidos(mesa, sceneKey, comCombate(atual.turnos))
      partes.push(...caidos.partes)
      const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
      const lembrados = lembrarDepoisDoDano(semCaidos)
      partes.push(...partesDosLembretes(lembrados))
      // Construtor C5: o selo montado fora da tabela ("Veneno") diz "sofre com Veneno".
      const texto = `${quem} ${verboDoPorVez(nome)}: -${dado} HP (direto, sem o Escudo${reducao})${textoDosQueSairam(caidos.nomes)}`
      gravarCena(sceneKey, {
        ...comMudanca(atual, lembrados.turnos, { tipo: 'dano', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }),
        efeitos: comEfeitos(atual.efeitos, [{ tipo: 'dano', tokenId: carta.tokenId, valor: dado, saida: 'direto' }]),
      })
      return true
    }
    const pedidoDoSelo = pedido.atributoId === undefined ? null : seloDaPreparacao(sistema, pedido.atributoId)
    if (pedidoDoSelo === null) return false
    const selo = criarSelo(carta.tokenId, { ...pedidoDoSelo, natureza: 'buff' }, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: NOME_DA_PREPARACAO })
    const selos = comSeloNovo(turnos.selos, selo)
    if (selos === null) return false
    partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
    const texto = `${quem} faz a ${NOME_DA_PREPARACAO}: ${textoDosMods(selo.mods, sistema)} até o fim do combate`
    gravarCena(sceneKey, comMudanca(cena, { ...comCombate(turnos), selos }, { tipo: 'selo', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  const mudarPassiva = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDePassiva): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
    if (carta === undefined || carta.personagemId === null) return false
    const personagemId = carta.personagemId
    // S4: o lembrete do Sangramento e o da Preparação têm caminho próprio (não são passiva da ficha).
    if (pedido.tipo === 'lembrete') {
      const daRegra = (turnos.combate?.[personagemId]?.lembretes ?? []).find((lembrete) => lembrete.cartaoId === pedido.cartaoId && (ehLembreteDoSangramento(lembrete) || ehLembreteDaPreparacao(lembrete)))
      if (daRegra !== undefined) return lembreteDaRegra(sceneKey, cena, autor, carta, personagemId, daRegra, pedido)
    }
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    // Fatia C7 (revisão): passiva, forma e mantida ocultas são só do mestre, também pelo lembrete.
    if (ocultoParaQuemPede(autor, personagem, pedido.cartaoId)) return false
    // Conserto das fichas F1 (P6): o lembrete do custo por turno de uma FORMA tem caminho próprio.
    if (pedido.tipo === 'lembrete' && personagem !== null && sistema !== null && formaDaFicha(personagem, sistema, pedido.cartaoId) !== null) {
      return custoDaFormaNaVez(sceneKey, cena, autor, carta, personagem, sistema, pedido)
    }
    // F2 (revisão da fatia D): e o da técnica MANTIDA (Giro, Campo), na mesma faixa.
    // Construtor C1: procura pelo cartão (o montado com custo por vez também é mantido).
    if (pedido.tipo === 'lembrete' && personagem !== null && sistema !== null && mantidaDe(tecnicaPorId(personagem, sistema, pedido.cartaoId)?.cartao ?? pedido.cartaoId) !== null) {
      return custoDaMantidaNaVez(sceneKey, cena, autor, carta, personagem, sistema, pedido)
    }
    if (motivoDaPassiva({ personagem, sistema, turnos, aplicarSoComLembrete: autor.tipo === 'jogador' }, pedido) !== null || personagem === null || sistema === null) return false
    const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
    if (achada === null) return false
    const { cartao } = achada
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const combateBase = combateAntes ?? combateVazio()
    const semOLembrete = semLembretes(combateBase, cartao.id)
    const comCombate = (base: TurnosDaCena, combate: CombateDoPersonagem): TurnosDaCena => (combate === combateBase ? base : { ...base, combate: { ...(base.combate ?? {}), [personagemId]: combate } })
    // "Agora não" / pular: só tira o lembrete, sem linha (a tira Passivas ativa a qualquer hora).
    if (pedido.tipo === 'lembrete' && !pedido.aplicar) {
      gravarCena(sceneKey, comMudanca(cena, comCombate(turnos, semOLembrete), null))
      return true
    }
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    const dono = nomeDoToken(carta.tokenId)
    const nome = nomeNaBatalha(personagem, cartao, 'a passiva')
    // Fatia C7 (revisão): a passiva oculta liga como "???": sem a opção escolhida e sem os números na linha.
    const oculta = ocultoNaBatalha(personagem, cartao)
    const quem = quemNaFicha(autor)
    const partes: Reversao[] = []
    // O lembrete que Aplicar e Desligar tiram volta no Desfazer (só ele: a parte "combate" volta o que a linha mudou).
    const parteDoLembrete: Reversao[] = semOLembrete === combateBase ? [] : [{ tipo: 'combate', personagemId, antes: combateAntes, depois: semOLembrete }]
    const tokenIds = new Set([carta.tokenId])
    let novos: TurnosDaCena
    let texto: string
    if (pedido.tipo === 'lembrete') {
      // Aplicar o "a cada turno" (decisão 4): HP/SP pela aventura e os mods somados no selo dela.
      const efeito = efeitoPorTurno(cartao, sistema)
      // Conserto das fichas F1 (P6): o custo por turno da técnica mantida (a regra já conferiu que o recurso paga).
      const custoDaVez = custoPorTurno(cartao, personagem)
      const selo = selosDaPassiva(turnos.selos, personagemId, cartao.id)[0]
      if ((efeito === null && custoDaVez === null) || selo === undefined) return false
      const doCusto = custoDaVez === null ? null : mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custoDaVez), quem)
      // Bug 11: o custo recusado não aplica (o lembrete fica para o Aplicar de novo).
      if (doCusto === 'recusada') return false
      const fichas: Reversao[] = reversaoDaFicha(personagemId, doCusto)
      novos = turnos
      // HP e SP em quem tem o selo, como os mods: no oponente, "o alvo perde 20 de HP a cada turno" não tira do dono.
      const doSelo = turnos.cartas.find((candidata) => candidata.tokenId === selo.tokenId)?.personagemId ?? null
      let doPorTurno: ParteDaFicha[] | null = null
      if (efeito !== null && doSelo !== null) {
        const feito = mexerNaFicha(mesa, doSelo, (atual, sistemaDaMesa) => ajustesDoPorTurno(atual, sistemaDaMesa, efeito), quem)
        // Bug 11: a ficha recusada não leva o "a cada turno" (o custo já pago volta; o lembrete fica para o Aplicar de novo).
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, fichas, autor)
          return false
        }
        doPorTurno = feito
        fichas.push(...reversaoDaFicha(doSelo, feito))
      }
      // Conserto das fichas F1 (+10 SP por vez): o custo, ou o "a cada turno" que tira SP do próprio dono (Manter o Giro), conta como gastar SP.
      const gastou = (custoDaVez !== null && custoEmSp(custoDaVez)) || (doSelo === personagemId && tirouSp(doPorTurno, sistema))
      const combateDepois: CombateDoPersonagem = gastou && semOLembrete.gastouSp !== true ? { ...semOLembrete, gastouSp: true } : semOLembrete
      if (combateDepois !== combateBase) partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combateDepois })
      novos = comCombate(turnos, combateDepois)
      if (efeito !== null && efeito.mods.length > 0) {
        const mods = modsSomados(selo.mods, efeito.mods)
        const depois: SeloDaBatalha = { ...selo }
        if (mods.length > 0) depois.mods = mods
        else delete depois.mods
        partes.push({ tipo: 'selo', seloId: selo.id, antes: selo, editado: true })
        novos = { ...novos, selos: (novos.selos ?? []).map((candidato) => (candidato.id === selo.id ? depois : candidato)) }
      }
      partes.push(...fichas)
      tokenIds.add(selo.tokenId)
      const pago = custoDaVez === null ? '' : `${dono} paga ${textoDoCustoPorTurno(custoDaVez, sistema)}`
      const doEfeito = efeito === null ? '' : oculta ? `em ${nomeDoToken(selo.tokenId)}` : `em ${nomeDoToken(selo.tokenId)}: ${textoDoPorTurno(efeito, sistema)}`
      texto = `${nome} (a cada turno) ${[doEfeito, pago].filter((parte) => parte !== '').join(' · ')}`
    } else if (!pedido.ligar) {
      const tirados = selosDaPassiva(turnos.selos, personagemId, cartao.id)
      const ids = new Set(tirados.map((selo) => selo.id))
      partes.push(...parteDoLembrete)
      for (const selo of tirados) {
        partes.push({ tipo: 'selo', seloId: selo.id, antes: selo })
        tokenIds.add(selo.tokenId)
      }
      novos = { ...comCombate(turnos, semOLembrete), selos: (turnos.selos ?? []).filter((selo) => !ids.has(selo.id)) }
      const unico = tirados.length === 1 && partes.length === 1 ? tirados[0] : undefined
      const semOLigar = unico === undefined ? null : semOLigarDeGraca(cena.registro, autor, unico.id)
      if (semOLigar !== null) {
        gravarCena(sceneKey, { ...comMudanca(cena, novos, null), registro: semOLigar })
        return true
      }
      texto = `${dono} desligou ${nome}`
    } else {
      // Ativar: tudo calculado ANTES de cobrar (selo que não cabe no teto recusa sem mexer na ficha).
      const custo = custoDaPassiva(cartao, personagem, pedido.custo)
      // Tipos de habilidade F4: a opção escolhida (Melodia); sem selo editado, o selo sai do texto dela.
      const variante = pedido.variante === undefined ? null : varianteDoPedido(cartao, pedido.variante)
      const pedidoDoSelo = pedido.selo === undefined ? seloDaPassiva(variante === null ? cartao : cartaoDaVariante(cartao, variante), sistema) : seloPedidoValido(pedido.selo, sistema)
      const alvoTokenId = pedido.alvoTokenId ?? carta.tokenId
      if (pedidoDoSelo === null) return false
      const onde = { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: nomeNaBatalha(personagem, cartao, cartao.nome) }
      // F2 (fatia F, Melodia): a opção que não é a principal fica no selo (o "+20 contra o analisado" só vale na principal).
      // Fatia C7 (revisão): o selo fica no token, à vista de todos; o da passiva oculta leva "???" no lugar do nome dela.
      const nomeDoSelo = nomeDoSeloNaBatalha(personagem, cartao, pedidoDoSelo.nome)
      const selo: SeloDaBatalha = { ...criarSelo(alvoTokenId, { ...pedidoDoSelo, nome: nomeDoSelo, natureza: 'passiva', cartaoId: cartao.id }, onde), donoId: personagemId, ...(variante === null || variante.principal ? {} : { opcao: variante.chave }) }
      const selos = comSeloNovo(turnos.selos, selo)
      if (selos === null) return false
      // Usos e recarga do Tempo, o lembrete fora e a chave do gatilho em `lembradas` (ativada à mão antes do gatilho não lembra depois).
      const chave = chaveDoGatilho(cartao.id, gatilhoDaPassiva(cartao))
      const usada = semLembretes(depoisDaTecnica(combateBase, { cartao, tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''), overload: ehOverload(cartao), custo }), cartao.id)
      const combate = chave === null ? usada : comLembrada(usada, chave)
      if (combate !== combateBase) partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combate })
      const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quem)
      // Bug 11: custo recusado = a passiva não liga (sem selo, recarga nem linha).
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, doCusto))
      partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
      novos = { ...comCombate(turnos, combate), selos }
      tokenIds.add(alvoTokenId)
      const pago = custo.tipo === 'valor' && custo.valor > 0 ? ` (${custo.valor} ${custo.recurso.toUpperCase()})` : ''
      const emQuem = alvoTokenId === carta.tokenId ? '' : ` em ${nomeDoToken(alvoTokenId)}`
      // O selo com o mesmo nome e sem mods nem turnos ("Fortaleza · Fortaleza") não diz nada a mais.
      const doSelo = textoDoSeloComMods(selo, sistema)
      const escolha = variante === null ? '' : ` (${variante.rotulo})`
      texto = oculta ? `${dono} ativou ${nome}${emQuem}${pago}` : `${dono} ativou ${nome}${escolha}${emQuem}${pago}${doSelo === nome ? '' : ` · ${doSelo}`}`
    }
    // O custo de HP do Ativar e o HP que o Aplicar tira podem levar alguém abaixo do gatilho de vida (o mesmo ponto do dano).
    if (partes.some((parte) => parte.tipo === 'ficha')) {
      const lembrados = lembrarDepoisDoDano(novos)
      partes.push(...partesDosLembretes(lembrados))
      novos = lembrados.turnos
    }
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    // `personagemIds` = o dono: a linha da passiva de NPC (custo, HP) não sai ao jogador.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'habilidade', texto, autor, tokenIds: [...tokenIds], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    // Ativar e Aplicar são uso; Desligar, não.
    if (pedido.tipo === 'lembrete' || pedido.ligar) revelarAoUsar(personagemId, cartao.id)
    return true
  }

  /**
   * Tipos de habilidade F4: Evoluir (`PedidoDeEvolucao`). Ver `evoluir` em
   * `BatalhaState`. A reversão é [evolucao, ficha]: o Desfazer tira só esta
   * técnica de `evoluidas` e devolve o SP. O custo e o SP saem do texto do
   * NPC: a linha pode chegar a jogador da equipe dele.
   */
  const evoluirTecnica = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
    if (carta === undefined || carta.personagemId === null) return false
    const personagemId = carta.personagemId
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    if (ocultoParaQuemPede(autor, personagem, pedido.cartaoId)) return false
    if (motivoDoEvoluir({ personagem, sistema, turnos, soNaVez: autor.tipo === 'jogador' }, pedido) !== null || personagem === null || sistema === null) return false
    const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
    const evolucao = achada === null ? null : evolucaoDe(achada.cartao, tecnicasDe(personagem, sistema))
    if (achada === null || evolucao === null) return false
    const { cartao } = achada
    const custo = custoDaEvolucao(pedido.custo)
    const combateAntes = turnos.combate?.[personagemId]
    const evoluida = comEvoluida(combateAntes ?? combateVazio(), cartao.id)
    // Conserto das fichas F1 (+10 SP por vez): evoluir pagando SP conta como gastar SP na vez.
    const combate: CombateDoPersonagem = custoEmSp(custo) && evoluida.gastouSp !== true ? { ...evoluida, gastouSp: true } : evoluida
    const novos: TurnosDaCena = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
    const partes: Reversao[] = [{ tipo: 'evolucao', personagemId, cartaoId: cartao.id }]
    if (combate !== evoluida) partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois: combate })
    const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quemNaFicha(autor))
    // Bug 11: custo recusado = a técnica não evolui.
    if (doCusto === 'recusada') return false
    partes.push(...reversaoDaFicha(personagemId, doCusto))
    const dono = nomeDoTokenNa(turnos, personagens)(carta.tokenId)
    const nome = nomeNaBatalha(personagem, cartao, 'a técnica')
    // Com link: "→ SUPER CAÇA AS BRUXAS!"; sem link e o texto diz OVERLOAD: o uso evoluído é Overload.
    // Fatia C7 (revisão): a evoluída oculta também sai como "???".
    const destino = evolucao.para !== null ? ` → ${nomeNaBatalha(personagem, evolucao.para, 'a evoluída')}` : evolucao.overload ? ' (agora Overload)' : ''
    const recurso = recursoDoCusto(sistema, 'sp')?.nome ?? 'SP'
    const pago = custo.tipo === 'valor' && personagem.tipo === 'jogador' ? ` (${custo.valor} ${recurso})` : ''
    const texto = `${dono} evoluiu ${nome}${destino}${pago}`
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'habilidade', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    revelarAoUsar(personagemId, cartao.id)
    return true
  }

  /** R1: a resposta ao lembrete da marca. Ver `marcar` em `BatalhaState`. */
  const marcarOAlvo = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeMarca): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const lembrete = (turnos.lembretesDaMarca ?? []).find((candidato) => candidato.id === pedido.lembreteId)
    if (lembrete === undefined) return false
    const semOLembrete: TurnosDaCena = { ...turnos, lembretesDaMarca: (turnos.lembretesDaMarca ?? []).filter((candidato) => candidato.id !== lembrete.id) }
    // "Agora não": só tira o lembrete, sem linha (como na passiva).
    if (pedido.como === 'agoraNao') {
      gravarCena(sceneKey, comMudanca(cena, semOLembrete, null))
      return true
    }
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === lembrete.personagemId)
    const achada = personagem === undefined || sistema === null ? null : passivaDaMarca(personagem, sistema)
    if (personagem === undefined || sistema === null || achada === null || achada.cartao.id !== lembrete.cartaoId) return false
    if (ocultoParaQuemPede(autor, personagem, achada.cartao.id)) return false
    // Fatia C7 (revisão): a passiva de marca oculta vai à linha e à origem da marca como "???".
    const nome = nomeNaBatalha(personagem, achada.cartao, 'a passiva')
    // O alvo segue na ordem e sem marca (uma marca por alvo).
    if (!turnos.cartas.some((carta) => carta.tokenId === lembrete.alvoTokenId) || marcaDoToken(turnos.selos, lembrete.alvoTokenId) !== undefined) return false
    const recursoDoSp = recursoDoCusto(sistema, 'sp')
    const sp = recursoDoSp === null ? 0 : numeroDaFicha(personagem.recursos, recursoDoSp.id)
    const { leitura } = achada
    if (motivoDaMarca(leitura, pedido.como, sp) !== null) return false
    const linhaId = novoIdDeLinha()
    const efeitos: EfeitoNovo[] = []
    let passou: boolean
    let detalhe: string
    if (pedido.como === 'teste' && leitura.teste !== null && leitura.teste.cd !== null) {
      const d20 = deps.rolarD20()
      // O digitado na tela vence o do rank (o parse do fio já limitou o número).
      const modificador = pedido.modificador ?? modificadorDoTeste(personagem, sistema, leitura.teste.atributoId, bonusDaBatalha(turnos.selos, lembrete.tokenId))
      const total = d20 + modificador
      passou = total >= leitura.teste.cd
      detalhe = `${leitura.teste.nome} ${textoDaRolagem(d20, modificador, total)} contra CD ${leitura.teste.cd}`
      efeitos.push({ tipo: 'reacao', golpeId: null, tokenId: lembrete.tokenId, d20, modificador, total })
    } else if (pedido.como === 'sp') {
      passou = true
      detalhe = personagem.tipo === 'jogador' ? `${leitura.sp ?? 0} ${recursoDoSp?.nome ?? 'SP'}` : 'pagou'
    } else {
      passou = pedido.como === 'passou'
      detalhe = 'teste rolado fora'
    }
    let novos = semOLembrete
    const partes: Reversao[] = [{ tipo: 'lembreteDaMarcaRespondido', lembrete }]
    if (passou) {
      // A marca é calculada ANTES de cobrar: selo que não cabe no teto recusa sem mexer no SP.
      const marca = criarMarca(novos, lembrete.alvoTokenId, { selo: novoIdDaMarca(), linha: linhaId }, ocultoNaBatalha(personagem, achada.cartao) ? { id: achada.cartao.id, nome: NOME_DO_OCULTO } : achada.cartao)
      const selos = comSeloNovo(novos.selos, marca)
      if (selos === null) return false
      if (pedido.como === 'sp' && leitura.sp !== null) {
        const custo = leitura.sp
        const doCusto = mexerNaFicha(mesa, personagem.id, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, { tipo: 'valor', recurso: 'sp', valor: custo, porTurno: false }), quemNaFicha(autor))
        // Bug 11: o SP recusado não marca (o lembrete fica esperando).
        if (doCusto === 'recusada') return false
        // Conserto das fichas F1 (+10 SP por vez, regra que veio do Vincent): a Marca paga com SP conta como gastar SP.
        const combateAntes = novos.combate?.[personagem.id]
        if (tirouSp(doCusto, sistema) && combateAntes?.gastouSp !== true) {
          const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), gastouSp: true }
          partes.push({ tipo: 'combate', personagemId: personagem.id, antes: combateAntes ?? null, depois })
          novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagem.id]: depois } }
        }
        partes.push(...reversaoDaFicha(personagem.id, doCusto))
      }
      partes.push({ tipo: 'selo', seloId: marca.id, antes: null })
      novos = { ...novos, selos }
    }
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    const texto = passou
      ? `${nomeDoToken(lembrete.tokenId)} marcou ${nomeDoToken(lembrete.alvoTokenId)} (${nome} · ${detalhe})`
      : `${nomeDoToken(lembrete.tokenId)} não marcou ${nomeDoToken(lembrete.alvoTokenId)} (${nome} · ${detalhe} · falhou)`
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, {
      ...comMudanca(atual, novos, { id: linhaId, tipo: 'habilidade', texto, autor, tokenIds: [lembrete.tokenId, lembrete.alvoTokenId], personagemIds: [personagem.id], reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    revelarAoUsar(personagem.id, achada.cartao.id)
    return true
  }

  /**
   * R4: o "Ajustar..." (ver `ajustar` no estado). Mudança torta (recurso ou
   * atributo que o sistema não tem, número fora do teto) recusa o pedido
   * inteiro, antes de mexer em nada.
   */
  const ajustarNaBatalha = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeAjusteNaBatalha): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const personagemId = personagemDoTokenNa(turnos)(pedido.tokenId)
    const sistema = mesa.sistema()
    const { mudancas } = pedido
    if (personagemId === undefined || personagemId === null || sistema === null || mudancas.length === 0 || mudancas.length > MUDANCAS_DO_AJUSTE_MAX) return false
    if (!mudancas.every((mudanca) => mudancaValida(sistema, mudanca))) return false
    // F2 (fatia B, resposta da Saga): Atual e Máximo juntos valem o digitado (1300/1300): o Máximo entra antes, para o Atual não parar no máximo de antes.
    const naFicha = mudancas.filter((mudanca) => mudanca.tipo !== 'atributo').sort((a, b) => Number(b.tipo === 'maximo') - Number(a.tipo === 'maximo'))
    const partes: Reversao[] = []
    if (naFicha.length > 0) {
      const ajustes = (atual: Personagem): Ajuste[] =>
        naFicha.flatMap((mudanca): Ajuste[] =>
          mudanca.tipo === 'atual' ? [ajusteDoAtualDigitado(atual, mudanca.recursoId, mudanca.valor)] : mudanca.tipo === 'maximo' ? [{ parte: 'maximo', chave: mudanca.recursoId, valor: mudanca.valor }] : [],
        )
      const naMesa = mexerNaFicha(mesa, personagemId, ajustes, quemNaFicha(autor))
      // Bug 11: recusada = o "Ajustar..." inteiro não entra (nem os atributos, que só moram aqui).
      if (naMesa === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, naMesa))
    }
    const atual = cenaDe(sceneKey) ?? cena
    let novos = atual.turnos
    const pedacos: string[] = []
    for (const mudanca of mudancas) {
      if (mudanca.tipo === 'atributo') {
        const nome = sistema.atributos.find((atributo) => atributo.id === mudanca.atributoId)?.nome ?? mudanca.atributoId
        const sinal = mudanca.delta > 0 ? `+${mudanca.delta}` : String(mudanca.delta)
        const selo: SeloDaBatalha = {
          ...criarSelo(pedido.tokenId, { nome: `${nome} ${sinal}`.slice(0, NOME_DO_SELO_MAX), turnos: null, mods: [{ alvo: mudanca.atributoId, delta: mudanca.delta }], natureza: mudanca.delta > 0 ? 'buff' : 'debuff' }, { id: novoIdDeSelo(), rodada: novos.rodada, ...ondeNaVez(novos), origem: 'Ajustar' }),
          ajuste: true,
        }
        const selos = comSeloNovo(novos.selos, selo)
        if (selos === null) continue
        novos = { ...novos, selos }
        partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
        pedacos.push(`${nome} ${sinal} até o fim da batalha`)
        continue
      }
      const recurso = sistema.recursos.find((candidato) => candidato.id === mudanca.recursoId)
      pedacos.push(`${recurso?.nome ?? mudanca.recursoId}${mudanca.tipo === 'maximo' ? ' máximo' : ''} ${mudanca.valor}`)
    }
    if (partes.length === 0) return false
    const nomeDoToken = nomeDoTokenNa(turnos, mesaDoRpg().personagens)
    // `personagemIds` = a ficha: a linha de ajuste de NPC (HP, atributo) não sai ao jogador.
    const texto = `${nomeDoAutor(autor)} ajustou ${nomeDoToken(pedido.tokenId)}: ${pedacos.join(' · ')}`
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'ficha', texto, autor, tokenIds: [pedido.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /** R5: o contador (ver `contador` no estado). O "sem reação" mora no combate; o nível, no selo do token. */
  const mexerNoContador = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDoContador): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || (pedido.tipo === 'zerar' && autor.tipo !== 'mestre')) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId && candidata.bando === undefined)
    const personagemId = carta?.personagemId ?? null
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    const achado = personagem === undefined || sistema === null ? null : contadorDoPersonagem(personagem, sistema)
    if (personagemId === null || achado === null || achado.cartao.id !== pedido.cartaoId) return false
    if (ocultoParaQuemPede(autor, personagem, achado.cartao.id)) return false
    // S4: carregar gasta a reação, e o Atordoado ou Paralisado não reage. Zerar (do mestre) continua valendo.
    if (pedido.tipo === 'ganhar' && travaDoToken(turnos.selos, pedido.tokenId) !== null) return false
    const { leitura } = achado
    // Fatia C7 (revisão): o contador oculto (nome do cartão ou o escrito nele) vai ao selo e à linha como "???", sem o dano do nível.
    const oculto = ocultoNaBatalha(personagem ?? null, achado.cartao)
    const nomeDoContador = oculto ? NOME_DO_OCULTO : leitura.nome
    const combateAntes = turnos.combate?.[personagemId]
    const nivel = nivelDoContador(turnos, pedido.tokenId, pedido.cartaoId)
    if (motivoDoContador(pedido.tipo, nivel, leitura.danoPorNivel.length, combateAntes?.semReacao === true, temGolpeEsperando(turnos.golpes, pedido.tokenId)) !== null) return false
    const molde = seloDoContador(turnos, pedido.tokenId, pedido.cartaoId) ?? {
      ...criarSelo(pedido.tokenId, { nome: nomeDoContador, turnos: null, natureza: 'buff', cartaoId: achado.cartao.id }, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: oculto ? NOME_DO_OCULTO : achado.cartao.nome }),
      contador: 0,
    }
    // Selo novo acima do teto da ficha ou da cena: recusa sem gastar a reação.
    if (nivel === 0 && comSeloNovo(turnos.selos, molde) === null) return false
    const delta = pedido.tipo === 'ganhar' ? 1 : -nivel
    const selos = selosComONivel(turnos.selos ?? [], molde, nomeDoContador, leitura.danoPorNivel, delta)
    const partes: Reversao[] = [{ tipo: 'contador', selo: molde, nome: nomeDoContador, danoPorNivel: leitura.danoPorNivel, delta }]
    let novos: TurnosDaCena = { ...turnos, selos: [...selos] }
    if (pedido.tipo === 'ganhar') {
      const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), semReacao: true }
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
    }
    const nome = nomeDoTokenNa(turnos, personagens)(pedido.tokenId)
    const dano = leitura.danoPorNivel[nivel] ?? 0
    const doDano = oculto ? '' : ` (+${dano} de dano)`
    const texto = pedido.tipo === 'ganhar' ? `${nome} carregou ${nomeDoContador}: nível ${nivel + 1}${doDano} · sem reação até a vez dele` : `${nomeDoAutor(autor)} zerou ${nomeDoContador} de ${nome}`
    gravarCena(sceneKey, comMudanca(cena, novos, { tipo: 'habilidade', texto, autor, tokenIds: [pedido.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    if (pedido.tipo === 'ganhar') revelarAoUsar(personagemId, achado.cartao.id)
    return true
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
      fimDaBatalhaNasFichas(cena.turnos)
    },

    passarVez: (sceneKey, autor = MESTRE, esperado) => {
      const inicio = cenaDe(sceneKey)
      if (inicio === undefined) return false
      if (esperado !== undefined && (inicio.turnos.vez !== esperado.cartaId || inicio.turnos.rodada !== esperado.rodada)) return false
      const mesaDeAntes = mesaDoRpg()
      const caidosAntes = tokensCaidos(inicio.turnos.cartas, mesaDeAntes.personagens, mesaDeAntes.sistema)
      // F2b (revisão, Ignição): as agilidades de agora põem no lugar novo, na virada, quem mudou de Velocidade na rodada.
      const previa = passarVezNaOrdem(inicio.turnos, caidosAntes, agilidadesDasCartas(inicio.turnos.cartas, mesaDeAntes.personagens, mesaDeAntes.sistema))
      if (previa === null) return false
      // Conserto das fichas F1 (bug 2, P3): na virada, o golpe que ninguém respondeu vira "Não reagiu" ANTES de a vez andar
      // (quem cai com ele não ganha a vez). O da vez que está acabando espera a virada seguinte: o alvo dele ainda não teve tempo.
      let fechados: string[] = []
      if (previa.turnos.rodada !== inicio.turnos.rodada) {
        const daVezQueAcaba = golpesDaVezQueAcaba(inicio)
        fechados = fecharGolpesSemResposta(sceneKey, (golpe) => !daVezQueAcaba.has(golpe.id), 'até a virada da rodada')
      }
      const cena = cenaDe(sceneKey) ?? inicio
      const { turnos } = cena
      const { personagens, sistema } = mesaDoRpg()
      // Sem fechamento a cena não mudou: vale a prévia. Todos caíram no fechamento: a vez anda como andaria antes dele (a batalha não trava).
      const agilidades = agilidadesDasCartas(turnos.cartas, personagens, sistema)
      const passadaNaOrdem = fechados.length === 0 ? previa : (passarVezNaOrdem(turnos, tokensCaidos(turnos.cartas, personagens, sistema), agilidades) ?? passarVezNaOrdem(turnos, caidosAntes, agilidades))
      if (passadaNaOrdem === null) return false
      // Invocação: a carta do bando que ficou vazia na vez dela sai agora; o Desfazer da vez a põe de volta no lugar.
      const semVazios = semBandosVazios(passadaNaOrdem.turnos, turnos.cartas)
      const passada = semVazios.removidas.length === 0 ? passadaNaOrdem : { ...passadaNaOrdem, turnos: semVazios.turnos, removidas: [...passadaNaOrdem.removidas, ...semVazios.removidas] }
      // Tipos de habilidade F3: na virada, o lembrete das passivas de "rodada N"; no começo da vez, o "a cada turno" do dono.
      // Só o combate muda, e a reversão "vez" guarda o combate de antes e de depois de quem mudou: o Desfazer da vez tira os lembretes.
      const virada = passada.turnos.rodada !== turnos.rodada ? comLembretesDoMomento('rodada', passada.turnos, { personagens, sistema }).turnos : passada.turnos
      const comLembretes = comLembretesDaVez(virada, { personagens, sistema }).turnos
      const de = cartaDaVez(turnos)
      const para = cartaDaVez(passada.turnos)
      const virou = passada.turnos.rodada !== turnos.rodada ? ` (rodada ${passada.turnos.rodada})` : ''
      // F2b (revisão, Ignição): "· Vagn vai para a posição 1 (Agilidade de agora: 39)".
      const movidas = (passada.movidas ?? []).map((cartaId) => {
        const posicao = passada.turnos.cartas.findIndex((carta) => carta.id === cartaId)
        return ` · ${nomeDaCarta(passada.turnos.cartas[posicao], personagens)} vai para a posição ${posicao + 1} (Agilidade de agora: ${agilidades.get(cartaId) ?? 0})`
      })
      const acabaram = passada.acabaram ?? []
      // F3 (Q4): "· Atordoado acabou em Ilo" no fim da linha da vez.
      const fimDosSelos = acabaram.length === 0 ? '' : ` · ${textoDosQueAcabaram(acabaram, nomeDoTokenNa(turnos, personagens))}`
      comecarAVez(sceneKey, cena, {
        antes: turnos,
        depois: comLembretes,
        sai: de,
        entra: para,
        autor,
        texto: `${de === null ? `Começou: vez de ${nomeDaCarta(para, personagens)}` : `Vez: ${nomeDaCarta(de, personagens)} → ${nomeDaCarta(para, personagens)}${virou}`}${movidas.join('')}${fimDosSelos}`,
        tokenIds: [...new Set([de?.tokenId, para?.tokenId].filter((id): id is string => id !== undefined))],
        removidas: passada.removidas,
        ...(movidas.length === 0 ? {} : { ordem: idsDaOrdem(turnos) }),
        fechados,
        acabaram,
        virou: passada.turnos.rodada !== turnos.rodada,
      })
      return true
    },

    darVez: (sceneKey, cartaId) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const antes = cena.turnos
      const dadaNaOrdem = darVezNaOrdem(antes, cartaId)
      if (dadaNaOrdem === antes) return false
      // Invocação: a carta do bando que ficou vazia na vez dela sai agora; o Desfazer da vez a põe de volta no lugar.
      const { turnos: dada, removidas } = semBandosVazios(dadaNaOrdem, antes.cartas)
      const { personagens, sistema } = mesaDoRpg()
      // Tipos de habilidade F3: o "a cada turno" do dono no começo da vez dada (a reversão "vez" volta o combate).
      const depois = comLembretesDaVez(dada, { personagens, sistema }).turnos
      const para = cartaDaVez(depois)
      const acabaram = selosQueSairam(antes, depois)
      const fimDosSelos = acabaram.length === 0 ? '' : ` · ${textoDosQueAcabaram(acabaram, nomeDoTokenNa(antes, personagens))}`
      // F2b (revisão da fatia F): o "Dar a vez" do mestre também acaba a vez de quem estava nela (Doença, Chamas, duração da forma).
      const de = cartaDaVez(antes)
      comecarAVez(sceneKey, cena, {
        antes,
        depois,
        sai: de !== null && de.id !== para?.id ? de : null,
        entra: para,
        autor: MESTRE,
        texto: `Vez dada a ${nomeDaCarta(para, personagens)}${fimDosSelos}`,
        tokenIds: para === null ? [] : [para.tokenId],
        removidas,
        fechados: [],
        acabaram,
        virou: false,
      })
      return true
    },

    moverCarta: (sceneKey, cartaId, indice) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const turnos = moverCartaNaOrdem(cena.turnos, cartaId, indice)
      if (turnos === cena.turnos) return false
      const carta = turnos.cartas.find((candidata) => candidata.id === cartaId)
      const posicao = turnos.cartas.findIndex((candidata) => candidata.id === cartaId) + 1
      const texto = `${nomeDaCarta(carta, mesaDoRpg().personagens)} foi para a posição ${posicao}`
      const ultima = cena.registro[cena.registro.length - 1]
      // Alt + seta repetido: a mesma linha, com a ordem de ANTES do primeiro movimento.
      const mesmaLinha =
        ultima !== undefined &&
        ultima.tipo === 'ordem' &&
        ultima.autor.tipo === 'mestre' &&
        ultima.desfeita === undefined &&
        ultima.reversao.tipo === 'ordem' &&
        carta !== undefined &&
        ultima.envolve.tokenIds.length === 1 &&
        ultima.envolve.tokenIds[0] === carta.tokenId &&
        Date.now() - ultima.quando < JANELA_DO_MOVIMENTO_MS
      if (mesmaLinha) {
        const registro = [...cena.registro]
        registro[registro.length - 1] = { ...ultima, quando: Date.now(), texto: textoDaLinha(texto) }
        gravarCena(sceneKey, { ...cena, turnos, registro, turnosRev: cena.turnosRev + 1 })
        return true
      }
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'ordem', texto, tokenIds: carta === undefined ? [] : [carta.tokenId], reversao: { tipo: 'ordem', antes: idsDaOrdem(cena.turnos) } }))
      return true
    },

    ordenarPelaAgilidade: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { personagens, sistema } = mesaDoRpg()
      const turnos = ordenarNaOrdem(cena.turnos, agilidadesDasCartas(cena.turnos.cartas, personagens, sistema), deps.rolarD20)
      const rolou = Object.keys(turnos.d20).length > 0
      // O número do d20 não vai no texto: o jogador lê o registro e nunca vê o d20.
      const texto = rolou ? 'Ordem pela Agilidade, empate no 1d20' : 'Ordem pela Agilidade'
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: rolou ? 'desempate' : 'ordem', texto, reversao: { tipo: 'ordem', antes: idsDaOrdem(cena.turnos) } }))
      return true
    },

    trocarDesempate: (sceneKey, desempate) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const turnos = trocarDesempateNaOrdem(cena.turnos, desempate)
      if (turnos === cena.turnos) return false
      gravarCena(sceneKey, comMudanca(cena, turnos, null))
      return true
    },

    incluirCombatente: (sceneKey, token, indice) => {
      const carta = novaCarta(token.id, token.characterId, token.name)
      return mudarTurnos(
        sceneKey,
        (turnos) => incluirCombatenteNaOrdem(turnos, carta, indice),
        () => ({ tipo: 'combatente', texto: `${nomeDaCarta(carta, mesaDoRpg().personagens)} entrou na luta`, tokenIds: [token.id], reversao: { tipo: 'cartaNova', cartaId: carta.id } }),
      )
    },

    tirarCombatente: (sceneKey, tokenId) => {
      const inicio = cenaDe(sceneKey)
      // Invocação: a carta do bando não sai assim (todo Desfazer a recriaria sem aviso): saem os membros dela.
      if (inicio === undefined || inicio.turnos.cartas.some((carta) => carta.tokenId === tokenId && carta.bando !== undefined)) return false
      if (!inicio.turnos.cartas.some((carta) => carta.tokenId === tokenId)) return false
      passarAVezDeQuemSai(sceneKey, (carta) => carta.tokenId === tokenId)
      const cena = cenaDe(sceneKey) ?? inicio
      const { turnos, removidas } = tirarCombatenteDaOrdem(cena.turnos, tokenId)
      const primeira = removidas[0]
      if (primeira === undefined) return false
      // Desfazer volta as partes da última para a primeira: em ordem decrescente aqui, cada uma reentra no lugar certo.
      const partes: Reversao[] = [...removidas].sort((a, b) => b.indice - a.indice).map(({ carta, indice }) => ({ tipo: 'cartaRemovida', carta, indice }))
      const linha: LinhaNova = { tipo: 'combatente', texto: `${nomeDaCarta(primeira.carta, mesaDoRpg().personagens)} saiu da luta`, tokenIds: [tokenId], reversao: { tipo: 'composta', partes } }
      gravarCena(sceneKey, comMudanca(cena, turnos, linha))
      return true
    },

    adicionarCartaExtra: (sceneKey, tokenId, indice, duracao) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return null
      const feito = adicionarCartaExtraNaOrdem(cena.turnos, tokenId, indice, duracao)
      if (feito === null) return null
      const quanto = duracao === 'rodada' ? 'só nesta rodada' : 'em todas as rodadas'
      const texto = `Carta extra de ${nomeDaCarta(feito.carta, mesaDoRpg().personagens)} (${quanto})`
      gravarCena(sceneKey, comMudanca(cena, feito.turnos, { tipo: 'cartaExtra', texto, tokenIds: [tokenId], reversao: { tipo: 'cartaNova', cartaId: feito.carta.id } }))
      return feito.carta.id
    },

    removerCarta: (sceneKey, cartaId) => {
      const inicio = cenaDe(sceneKey)
      if (inicio === undefined) return false
      const antes = removerCartaDaOrdem(inicio.turnos, cartaId)
      // Invocação: a carta do bando não sai assim (todo Desfazer a recriaria sem aviso): saem os membros dela.
      if (antes === null || antes.removida.carta.bando !== undefined) return false
      passarAVezDeQuemSai(sceneKey, (carta) => carta.id === cartaId)
      const cena = cenaDe(sceneKey) ?? inicio
      const feito = removerCartaDaOrdem(cena.turnos, cartaId)
      // A virada da rodada já tirou a carta extra "só nesta rodada": a vez andou e ela saiu.
      if (feito === null) return true
      const { carta, indice } = feito.removida
      const nome = nomeDaCarta(carta, mesaDoRpg().personagens)
      const linha: LinhaNova = {
        tipo: carta.extra === undefined ? 'combatente' : 'cartaExtra',
        texto: carta.extra === undefined ? `${nome} saiu da luta` : `Carta extra de ${nome} saiu`,
        tokenIds: [carta.tokenId],
        reversao: { tipo: 'cartaRemovida', carta, indice },
      }
      gravarCena(sceneKey, comMudanca(cena, feito.turnos, linha))
      return true
    },

    definirRegras: (sceneKey, regras) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const texto = regras === null ? 'Sem regras do campo' : `Regras do campo: ${regras.nome}`
      gravarCena(sceneKey, comMudanca(cena, cena.turnos, { tipo: 'regras', texto, reversao: { tipo: 'regras', antes: cena.regras } }, regras))
      return true
    },

    normalizarCena: (sceneKey, tokenIdsDaCena) => {
      const inicio = cenaDe(sceneKey)
      if (inicio === undefined) return
      // A ficha apagada tinha a vez: ela anda antes pelo "Passar a vez" (começo de vez, virada), como no "Tirar".
      passarAVezDeQuemSai(sceneKey, (carta) => carta.bando === undefined && !tokenIdsDaCena.has(carta.tokenId))
      const cena = cenaDe(sceneKey) ?? inicio
      const turnos = normalizar(cena.turnos, tokenIdsDaCena)
      if (turnos !== cena.turnos) gravarCena(sceneKey, comMudanca(cena, turnos, null))
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
      if (!desfazerLinha(sceneKey, linhaId, autor)) return false
      // Conserto das fichas F1 (bug 2): o Desfazer da vez desfaz junto os "Não reagiu" que a virada dela escreveu,
      // do mais novo para o mais velho. O já desfeito fica como está. (Bug 3: a vez guarda só o que ela mudou, então
      // o "Não reagiu" desfeito sozinho antes não volta com ela.)
      if (linha.reversao.tipo === 'vez') {
        for (const fechado of [...(linha.reversao.fechados ?? [])].reverse()) desfazerLinha(sceneKey, fechado, autor)
      }
      return true
    },

    agirComInvocado: (sceneKey, vez, tokenId, pedido) => {
      if ((pedido.tipo !== 'atacar' && pedido.tipo !== 'habilidade') || pedido.contraDe !== undefined) return false
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      if (turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada) return false
      const bando = cartaDaVez(turnos)
      const invocado = bando === null ? undefined : membrosDoBando(turnos, bando).find((membro) => membro.tokenId === tokenId)
      if (bando === null || invocado === undefined) return false
      // O invocado age como se fosse a carta da vez, com o gasto DELE (a Simples de cada um é dele).
      const chave = chaveDoGastoDoInvocado(bando.id, tokenId)
      const carta: CartaDaOrdem = { id: bando.id, tokenId, personagemId: invocado.personagemId, nome: invocado.nome }
      const doInvocado: TurnosDaCena = { ...turnos, gastos: { ...turnos.gastos, [bando.id]: turnos.gastos[chave] ?? GASTO_ZERO } }
      return agirComACarta(sceneKey, cena, MESTRE, carta, doInvocado, chave, pedido)
    },

    invocar: (sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      // Mesa que não diz onde pôr o token não invoca. A arena põe no palco dela (`mesaDaArena`).
      if (cena === undefined || mesa.criarInvocado === undefined) return false
      const { turnos } = cena
      const dono = turnos.cartas.find((carta) => carta.tokenId === pedido.tokenId && carta.bando === undefined)
      const daVez = cartaDaVez(turnos)
      if (dono === undefined || dono.personagemId === null || daVez === null || daVez.bando !== undefined) return false
      // Conserto das fichas F1 (S4): Atordoado ou Paralisado só passa a vez, então não invoca.
      if (travaDoToken(turnos.selos, dono.tokenId) !== null) return false
      const personagemId = dono.personagemId
      const { personagens, sistema } = mesaDoRpg()
      const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
      const ctx: ContextoDaInvocacao = { personagem, sistema, turnos, acoes: acoesDaCarta({ turnos, carta: daVez, personagem, sistema, regras: cena.regras }) }
      if (ocultoParaQuemPede(autor, personagem, pedido.cartaoId) || motivoDaInvocacao(ctx, pedido) !== null) return false
      const linhaId = novoIdDeLinha()
      const pedida = pedirInvocacao({ ...ctx, autor, donoTokenId: dono.tokenId }, pedido, { pendente: novoIdDeInvocacao(), linha: linhaId })
      if (pedida === null) return false
      // Desfazer de trás para a frente: lembretes, a pendência (e o invocado que veio dela), o SP, a recarga e a carga, a ação.
      const partes: Reversao[] = [
        // A ação só volta se ainda é esta vez: o Cancelar da pendência numa vez depois não zera o gasto de agora.
        { tipo: 'gasto', cartaId: daVez.id, antes: turnos.gastos[daVez.id] ?? null, vez: { cartaId: daVez.id, rodada: turnos.rodada } },
        { tipo: 'combate', personagemId, antes: turnos.combate?.[personagemId] ?? null, depois: pedida.combate },
      ]
      const { custo } = pedida
      if (custo.length > 0) {
        const doCusto = mexerNaFicha(mesa, personagemId, () => custo, quemNaFicha(autor))
        // Bug 11: custo recusado = a invocação não sai.
        if (doCusto === 'recusada') return false
        partes.push(...reversaoDaFicha(personagemId, doCusto))
      }
      partes.push({ tipo: 'invocacaoPedida', pendente: pedida.pendente })
      let novos: TurnosDaCena = {
        ...turnos,
        gastos: { ...turnos.gastos, [daVez.id]: pedida.gasto },
        combate: { ...(turnos.combate ?? {}), [personagemId]: pedida.combate },
        invocacoes: [...(turnos.invocacoes ?? []), pedida.pendente],
      }
      // O custo de HP pode levar o dono abaixo do gatilho de vida (o mesmo ponto do golpe).
      const lembrados = lembrarDepoisDoDano(novos)
      partes.push(...partesDosLembretes(lembrados))
      novos = lembrados.turnos
      // O SP só aparece na linha da ficha de jogador (o de NPC nunca vai à mesa).
      const recurso = pedida.pago === null || sistema === null ? null : (recursoDoCusto(sistema, pedida.pago.recurso)?.nome ?? pedida.pago.recurso.toUpperCase())
      const pago = pedida.pago !== null && personagem !== null && personagem.tipo === 'jogador' ? ` (${pedida.pago.valor} ${recurso ?? ''})` : ''
      // Fatia C7 (revisão): a técnica de invocação oculta sai como "???" (o invocado aparece no mapa de todo jeito).
      const daTecnica = personagem === null ? null : cartaoEmQualquerNivel(personagem, pedido.cartaoId)
      const tecnica = daTecnica !== null && ocultoNaBatalha(personagem, daTecnica) ? NOME_DO_OCULTO : pedida.tecnica
      const texto = `${nomeDoTokenNa(turnos, personagens)(dono.tokenId)} invocou 1 ${pedida.pendente.nome} com ${tecnica}${pago}`
      // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, comMudanca(atual, novos, { id: linhaId, tipo: 'habilidade', texto, autor, tokenIds: [dono.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
      revelarAoUsar(personagemId, pedido.cartaoId)
      return true
    },

    colocarInvocado: (sceneKey, invocacaoId, onde, ajuste = {}) => {
      const cena = cenaDe(sceneKey)
      const sistema = mesa.sistema()
      if (cena === undefined || sistema === null || mesa.criarInvocado === undefined) return null
      const { turnos } = cena
      const pendente = pendenciaPorId(turnos, invocacaoId)
      if (pendente === null || !Number.isFinite(onde.x) || !Number.isFinite(onde.y) || (onde.piso !== undefined && !Number.isInteger(onde.piso))) return null
      // Decisão 10: o comum pendente de antes do Ultra não entra ao lado dele (o mestre cancela a pendência e o custo volta).
      if (ultraEmCampo(turnos, pendente)) return null
      // Os números do texto, ou os que o mestre ajustou (o Ultra só sugere, decisão 10); torto = nada muda.
      const pedidos = ajuste.numeros ?? pendente.numeros
      const numeros = pedidos === null ? null : numerosValidos(pedidos)
      if (numeros === null) return null
      // "Lobo 1", "Lobo 2", "Lobo 3": os do mesmo dono com o mesmo nome ganham número (a lista "Quem age" e o mapa dizem qual é qual).
      const nome = nomeNumerado(turnos, pendente, nomeDaColocacao(pendente, ajuste.nome))
      const personagem = fichaDoInvocado(sistema, nome, { hp: numeros.hp, dano: numeros.dano }, pendente.donoPersonagemId, sceneKey)
      const token: Token = { id: crypto.randomUUID(), characterId: personagem.id, name: nome, x: onde.x, y: onde.y, size: 1, image: null }
      // A foto só vale embutida (`data:image/...`); `midia:` do cartão quem chama resolve e manda em `ajuste.imageData`.
      const foto = ajuste.imageData === undefined ? pendente.imagem : ajuste.imageData
      if (isTokenPhotoData(foto)) token.imageData = foto
      if (onde.piso !== undefined && onde.piso !== 0) token.piso = onde.piso
      if (!mesa.criarInvocado(sceneKey, personagem, token)) return null
      const linhaId = novoIdDeLinha()
      const invocado = invocadoDaPendencia(pendente, { tokenId: token.id, personagemId: personagem.id, linhaId, nome, numeros })
      let novos: TurnosDaCena = {
        ...turnos,
        invocacoes: (turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id),
        invocados: [...(turnos.invocados ?? []), invocado],
      }
      // Desfazer de trás para a frente: os comuns voltam, depois o invocado sai e a pendência volta.
      const partes: Reversao[] = [{ tipo: 'invocacaoColocada', pendente, invocado }]
      // Ultra (decisão 10): os comuns do mesmo dono e da mesma técnica saem quando ele entra.
      const saem = comunsQueSaem(turnos, pendente)
      for (const comum of saem) {
        const tirado = tirarDoMapa(mesa, sceneKey, novos, comum)
        novos = tirado.turnos
        partes.push(tirado.parte)
      }
      const personagens = mesa.personagens()
      novos = comBandosEmDia(novos, nomeDoBandoNa(novos, personagens))
      const texto = `${nomeDoTokenNa(turnos, personagens)(pendente.donoTokenId)}: ${nome} entrou no mapa${textoDosQueSairam(saem.map((comum) => comum.nome))}`
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, comMudanca(atual, novos, { id: linhaId, tipo: 'invocacao', texto, autor: MESTRE, tokenIds: [pendente.donoTokenId, token.id], personagemIds: [pendente.donoPersonagemId], reversao: { tipo: 'composta', partes } }))
      return token.id
    },

    cancelarInvocacao: (sceneKey, invocacaoId) => {
      const cena = cenaDe(sceneKey)
      const pendente = cena === undefined ? null : pendenciaPorId(cena.turnos, invocacaoId)
      if (cena === undefined || pendente === null) return false
      // É o Desfazer da linha do pedido: a pendência sai e o SP, a recarga, a carga e a ação voltam.
      if (cena.registro.some((linha) => linha.id === pendente.linhaId)) return desfazerLinha(sceneKey, pendente.linhaId, MESTRE)
      // A linha do pedido saiu do teto do registro: não há o que devolver, mas a pendência não fica presa.
      const turnos: TurnosDaCena = { ...cena.turnos, invocacoes: (cena.turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id) }
      const nomeDoDono = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(pendente.donoTokenId)
      const texto = `Mestre cancelou 1 ${pendente.nome} de ${nomeDoDono} (o pedido já saiu do registro: o custo não volta)`
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'invocacao', texto, tokenIds: [pendente.donoTokenId], personagemIds: [pendente.donoPersonagemId], reversao: { tipo: 'invocacaoCancelada', pendente } }))
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

    passiva: (sceneKey, autor, pedido) => comAvisoDeQuemCaiu(sceneKey, autor, mudarPassiva(sceneKey, autor, pedido)),

    evoluir: (sceneKey, autor, pedido) => evoluirTecnica(sceneKey, autor, pedido),

    motivoDoEvoluir: (sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return 'A batalha não está ligada nesta cena'
      const personagemId = cena.turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)?.personagemId ?? null
      const { personagens, sistema } = mesaDoRpg()
      const personagem = personagemId === null ? null : (personagens.find((candidato) => candidato.id === personagemId) ?? null)
      // Fatia C7 (revisão): o mesmo motivo que o `evoluir` recusa.
      const oculto = autor.tipo === 'jogador' ? motivoDoOcultoParaJogador(personagem, pedido.cartaoId) : null
      return oculto ?? motivoDoEvoluir({ personagem, sistema, turnos: cena.turnos, soNaVez: autor.tipo === 'jogador' }, pedido)
    },

    marcar: (sceneKey, autor, pedido) => marcarOAlvo(sceneKey, autor, pedido),
    ajustar: (sceneKey, autor, pedido) => comAvisoDeQuemCaiu(sceneKey, autor, ajustarNaBatalha(sceneKey, autor, pedido)),
    contador: (sceneKey, autor, pedido) => mexerNoContador(sceneKey, autor, pedido),
    ...fatiaDasFormas.acoes,
    ...fatiaDosSelos.acoes,
    ...fatiaDoGolpe.acoes,
  }
}

/**
 * A FÁBRICA (arena, fase 0; treino, T1): uma store de batalha nova, que lê
 * e grava as fichas só pela `mesa` e rola o d20 só por `deps.rolarD20`. Cada
 * chamada é uma store separada, com as cenas dela; só o contador
 * `ultimoSeqDeEfeito` é do módulo (sobe sempre, não atrapalha ninguém).
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
  const turnos = comLembretesDaPreparacao(lembrados, { personagens, sistema }).turnos
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
