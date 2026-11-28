/**
 * A fatia da VEZ da store da batalha One Piece: o "Passar a vez" e o "Dar a vez" do mestre, e o começo
 * de vez num lugar só (`comecarAVez`): o "Recupera por turno" da ficha, linha "vez" com Desfazer, fim da vez das mecânicas e o
 * prazo das condições (de quem joga e, na virada, de quem está fora da ordem).
 */
import { chaveDaVez, combateVazio, type SeloDaBatalha, type SeloDoGolpe } from '../../lib/batalha/combate'
import { combatesNoComecoDaVez } from '../../lib/batalha/acumuladorNaBatalha'
import { comBandosEmDia, semBandosVazios } from '../../lib/batalha/invocacao'
import { bonusDaBatalha, criarSelo, entradaDoSelo, novoIdDeSelo, ondeNaVez, quedaEmNumeros, textoDosQueAcabaram } from '../../lib/batalha/selos'
import {
  efeitosDaVez,
  ehLembreteDaSaida,
  gatilhosDaVez,
  lembreteDaSaida,
  quantoDoEfeito,
  saidasPagandoDe,
  testesDoFimDaVez,
  chaveDaSaida,
  type DisparoDoSelo,
  type EfeitoDoSelo,
} from '../../lib/batalha/condicoesNaVez'
import { selosQueALimpezaTira } from '../../lib/batalha/debuffs'
import { modificadorDoTeste } from '../../lib/batalha/marca'
import { ajustesDoRecursoDaCura } from '../../lib/batalha/curaDoRecurso'
import { recursoDoEscudo } from '../../lib/batalha/leituraDaFicha'
import { valorDoRank, type Ajuste } from '../../lib/ajusteDaFicha'
import { numeroDaFicha } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { PecaDoGatilho } from '../../lib/itens/modelo'
import { fraseDaPecaDoGatilho } from '../../lib/condicoes/gatilho'
import { formaDaFicha, formaMontada } from '../../lib/batalha/transformacao'
import { ajusteDoRecurso, maximoDoRecurso, numeroDoRecurso } from '../../lib/batalha/recursosDaBatalha'
import { ajustesDaRecuperacao, textoDaRecuperacaoGravada, type AjusteDaRecuperacao } from '../../lib/caracteristicas/recuperacaoNaBatalha'
import { chavesDoDono, idDaChave, mecanicaDoCartao, perdaNoFimDaVez, porcentoDoMaximo } from '../../lib/batalha/mecanicasAMao'
import { curaComOsSelos, notaDosSelosNaCura, selosQueSaemCom, textoDasSaidasDoSelo, type AcontecimentoDaSaida } from '../../lib/batalha/condicoes'
import { comLembretesDaVez, comLembretesDoMomento, type EventoDoGatilho } from '../../lib/batalha/passivas'
import { ehOverload } from '../../lib/batalha/leituraDaFicha'
import { ajustesDaCura, ajustesDoDano } from '../../lib/batalha/reacao'
import { mudancasDaVez, novoIdDeLinha, type ParteDaFicha, type Reversao } from '../../lib/batalha/registro'
import {
  agilidadesDasCartas,
  cartaDaVez,
  darVez as darVezNaOrdem,
  passarVez as passarVezNaOrdem,
  proximaCarta,
  selosQueSairam,
  tokensCaidos,
  type AutorDaAcao,
  type CartaDaOrdem,
  type GastoDaVez,
  type TurnosDaCena,
} from '../../lib/batalha/turnos'
import { nomeNaBatalha } from '../../lib/habilidadeOculta'
import type { Personagem } from '../../lib/personagem'
import { chavesDosSelos, espelhosDasPastilhas, semAVidaQueOSeloPede } from '../../lib/ponteDasCondicoes'
import { comecoDoPrazoNaVez, fimDoPrazoNaVez, motivoDoPrazo, textoDosPrazosQueAcabaram } from '../../lib/prazoNaVez'
import { comCondicoes, condicoesDaFicha } from '../../lib/turnoForaDaBatalha'
import type { BatalhaDaCena, BatalhaState } from './tipos'
import {
  MESTRE,
  nomeDaCarta,
  type LinhaNova,
  comMudanca,
  idsDaOrdem,
  type EfeitoNovo,
  comEfeitos,
  quemNaFicha,
  nomeDoTokenNa,
  nomeDoBandoNa,
  partesDosLembretes,
} from './cena'
import { mexerNaFicha, semOsCaidos, textoDosQueSairam, reversaoDaFicha } from './naMesa'
import { recargasNoComecoDaVez } from './recargaDoPente'
import type { NucleoDaBatalha } from './nucleo'
import type { FormasDaBatalha } from './formas'
import { comPilhasDaMesa, efeitosDosSelos, pedidoComACondicao } from './selos'
import { condicaoDoCatalogoPeloNome } from '../../lib/condicoes/catalogo'
import { contarFimDaVezNaMesa, daFichaNaMesa } from './condicoesNaFicha'
import { textoDoDisparo } from '../../lib/condicoes/gatilho'
import { golpesDaVezQueAcaba, type GolpeNaStore } from './golpe'

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
  /** O texto da linha sem a recuperação por turno (que vai no fim). */
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

/** A vez presa ao núcleo da store, às formas e ao golpe. */
export function criarVez(nucleo: NucleoDaBatalha, fatiaDasFormas: FormasDaBatalha, fatiaDoGolpe: GolpeNaStore) {
  const { mesa, deps, get, mesaDoRpg, cenaDe, gravarCena, avisarQuemCaiu, lembrarDepoisDoDano, rastrear, dispararGatilhos } = nucleo
  const { desligarAForma } = fatiaDasFormas
  const { fecharGolpesSemResposta } = fatiaDoGolpe

  /**
   * Conserto de 18/11/2026 (análise, seção 2.3): a carta que sai da ordem tinha a vez. Antes a vez só pulava
   * para a carta seguinte, sem o começo de vez (recarga, recuperação por turno, prazo das condições) e sem virar a rodada
   * quando era a última. Agora a vez anda ANTES pelo "Passar a vez" de sempre, numa linha própria (o Desfazer
   * de cada linha segue separado), como o DBT faz (`motor.ts`, ação 'tirar'). Cai noutra carta que também
   * sai (a extra do mesmo token): passa de novo. Ninguém mais joga: a saída leva a vez como antes.
   */
  const passarAVezDeQuemSai = (sceneKey: string, sai: (carta: CartaDaOrdem) => boolean): void => {
    const jaPassadas = new Set<string>()
    for (let voltas = cenaDe(sceneKey)?.turnos.cartas.length ?? 0; voltas > 0; voltas -= 1) {
      const turnos = cenaDe(sceneKey)?.turnos
      const daVez = turnos === undefined ? null : cartaDaVez(turnos)
      if (turnos === undefined || daVez === null || !sai(daVez) || jaPassadas.has(daVez.id)) return
      // Explorador 26/11/2026, bug 8: só passa se alguém que fica ainda joga. Sem isso a vez voltava à própria
      // carta (rodada +1) e o laço repetia "Vez: A → A", com veneno, prazos e recargas descontando a cada volta.
      const { personagens, sistema } = mesaDoRpg()
      if (proximaCarta(turnos, tokensCaidos(turnos.cartas, personagens, sistema), (carta) => !sai(carta)) === null) return
      jaPassadas.add(daVez.id)
      if (!get().passarVez(sceneKey)) return
    }
  }

  /**
   * 26/11/2026 (pedido do dono): o "+10 SP de quem não gastou SP" saiu; no lugar, o "Recupera por turno"
   * da ficha (a característica `recuperacao`: Vida ou SP, número ou fórmula). Vale no começo de cada vez da
   * carta própria da ficha (a carta extra não é outro turno) depois da primeira da batalha (o combate de
   * `antes` já tem `jaJogou`), como o SP antigo. Limitada ao máximo; o HP passa pela Cura reduzida dos selos.
   * Grava pela mesa e devolve a parte para a linha da vez e o pedaço do texto (só do jogador: os números do
   * NPC não aparecem a quem lê o registro). Nada a recuperar, cheio ou gravação recusada = `null`.
   */
  const recuperacaoDoComecoDaVez = (antes: TurnosDaCena, depois: TurnosDaCena, autor: AutorDaAcao): { ficha: { personagemId: string; partes: ParteDaFicha[] }; texto: string } | null => {
    const para = cartaDaVez(depois)
    if (para === null || para.personagemId === null || para.extra !== undefined || para.id === antes.vez || antes.combate?.[para.personagemId]?.jaJogou !== true) return null
    const { personagemId, tokenId } = para
    const personagem = mesa.personagens().find((candidato) => candidato.id === personagemId)
    const sistema = mesa.sistema()
    // A ficha sem "Recupera por turno" (a de sempre) nem passa pela gravação.
    if (personagem === undefined || sistema === null || ajustesDaRecuperacao(personagem, sistema, (cura) => cura).length === 0) return null
    // 27/11/2026: as duas linhas (Vida e SP) recuperam juntas; `lidas` = as que a mesa gravou, lidas da ficha de agora.
    let lidas: AjusteDaRecuperacao[] = []
    const feito = mexerNaFicha(
      mesa,
      personagemId,
      (atual, sistemaDaMesa) => {
        lidas = ajustesDaRecuperacao(atual, sistemaDaMesa, (cura) => curaComOsSelos(cura, depois.selos, tokenId))
        return lidas.map(({ ajuste }) => ajuste)
      },
      quemNaFicha(autor),
    )
    if (feito === null || feito === 'recusada' || feito.length === 0) return null
    const texto = textoDaRecuperacaoGravada(lidas, feito)
    const nome = personagem.nome.trim() || 'a ficha'
    return { ficha: { personagemId, partes: feito }, texto: personagem.tipo === 'jogador' && texto !== '' ? ` · ${nome} — ${texto}` : '' }
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
    // Chamas Celestes: cada selo dela em quem sai. Fase 5: o selo montado traz o dreno de SP nele (`drenaSp`), e a regeneração (`regenera`).
    // Nº 5 das pendências do rework: os selos que deram vida aqui (a cura recebida que tira os de saída "ao receber cura").
    const curaram = new Set<string>()
    for (const selo of cena.turnos.selos ?? []) {
      if (selo.tokenId === saindo.tokenId && selo.regenera !== undefined) {
        const { recurso, quanto } = selo.regenera
        const ficha = fichaDe(saindo.personagemId)
        const maximo = ficha === undefined ? null : maximoDoRecurso(ficha, sistema, recurso)
        const atual = ficha === undefined ? 0 : numeroDoRecurso(ficha, sistema, recurso)
        // A cura cortada pela regra do selo (`curaRecebida`) vale também aqui; o máximo da ficha é o teto.
        const cabe = maximo === null ? quanto : Math.max(0, Math.min(recurso === 'hp' ? curaComOsSelos(quanto, cena.turnos.selos, saindo.tokenId) : quanto, maximo - atual))
        const ganhou = cabe === 0 ? 0 : mexer(saindo.personagemId, recurso, cabe)
        if (recurso === 'hp' && ganhou > 0) curaram.add(selo.id)
        // CURA REDUZIDA (25/11/2026): a linha diz o corte ("+10 HP (Cura reduzida −50%)").
        const corte = recurso === 'hp' && ganhou !== 0 ? notaDosSelosNaCura(cena.turnos.selos, saindo.tokenId) : ''
        textos.push(`${selo.nome} em ${nomeDe(saindo.personagemId)}: ${ganhou === 0 ? 'já cheio' : `+${ganhou} ${recurso === 'hp' ? 'HP' : 'SP'}${corte}`}`)
      }
      const dreno = selo.tokenId !== saindo.tokenId ? undefined : selo.drenaSp !== undefined ? { alvoSp: selo.drenaSp.quanto, donoSp: selo.drenaSp.paraQuemUsa, donoHpPorcento: 0 } : selo.cartaoId !== undefined ? mecanicaDoCartao(selo.cartaoId)?.drenoNoFimDaVez : undefined
      const cartaoDoSelo = selo.cartaoId
      if (dreno === undefined || cartaoDoSelo === undefined) continue
      const dono = personagens.find((candidato) => chavesDoDono(candidato).some((chave) => idDaChave(chave) === cartaoDoSelo))
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
    // A vida do regenera é cura recebida: os selos de quem saiu com a saída "ao receber cura" saem (fora os que curaram), na mesma linha e no mesmo Desfazer.
    const saemComACura = curaram.size === 0 ? [] : selosQueSaemCom(novos.selos, saindo.tokenId, { tipo: 'cura' }).filter((selo) => !curaram.has(selo.id))
    if (saemComACura.length > 0) {
      const ids = new Set(saemComACura.map((selo) => selo.id))
      novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => !ids.has(selo.id)) }
      partes.push(...saemComACura.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })))
      textos.push(textoDasSaidasDoSelo(saemComACura, { tipo: 'cura' }, nomeDe(saindo.personagemId)))
    }
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
        // Rework das habilidades (D10, E5): a forma montada acaba com a Fadiga da peça (`nota`), nunca com o cansaço de antes.
        const montada = cartao !== null && formaMontada(cartao) !== null
        const overload = cartao !== null && !montada && ehOverload(cartao)
        const desligada = desligarAForma(saindo.personagemId, saindo.tokenId, forma.cartaoId, overload, novos, quem)
        if (desligada !== null) {
          partes.push(...desligada.partes)
          novos = desligada.turnos
          efeitos.push({ tipo: 'forma', tokenId: saindo.tokenId, forma: nomeDaForma, ligou: false })
          textos.push(`${nomeDaForma} acabou${desligada.nota ?? (overload ? ': atributos pela metade até o fim da batalha (Cansaço do Overload)' : '')}`)
        }
      }
    }
    if (partes.length === 0) return
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const atual = cenaDe(sceneKey) ?? cena
    // Explorador 26/11/2026, bug 4: a linha automática é do mestre, não de quem passou a vez (o jogador desfazia a própria penalidade).
    const linha = comMudanca(atual, novos, { tipo: 'acao', texto: `Fim da vez: ${textos.join(' · ')}`, autor: MESTRE, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } })
    gravarCena(sceneKey, efeitos.length === 0 ? linha : { ...linha, efeitos: comEfeitos(atual.efeitos, efeitos) })
    avisarQuemCaiu(sceneKey, autor)
  }

  /**
   * Fase C (prazo das condições, `lib/prazoNaVez.ts`): a vez passou de `de`
   * para `para`. A ficha de `de` desconta 1 turno de cada prazo (o que a
   * batalha ainda segura por selo de mesmo nome fica aceso); a de `para`
   * perde a vida por turno, direto no HP (sem Escudo, sem redução: Envenenado
   * 3 x 4 tira 12, como fora da batalha), menos a do prazo que um selo de mesmo
   * nome já pede (o espelho da pastilha, Nº 3 do levantamento: vai pelo "Aplicar /
   * pular" do mestre, como o selo). Uma linha própria com Desfazer
   * (o prazo volta pela mesa, o HP pela ficha), gravada depois da linha da
   * vez. A mesa sem mapa (arena) não tem prazo; nada a fazer: nada muda.
   * Devolve o desconto que não rendeu linha (bug 5 do explorador, 26/11): vai na linha da vez.
   */
  /**
   * Pedido de 26/11: a vida que o gatilho de uma condição mexe, pela ficha (com o Desfazer de cada parte). O
   * dano vai direto, como a condição de regra `vida`; a cura já veio cortada pelas condições da ficha e para no
   * máximo. Devolve o dano que saiu de verdade (para o efeito na tela).
   */
  const vidaDoGatilho = (personagemId: string, dano: number, cura: number, autor: AutorDaAcao): { partes: Reversao[]; dano: number } => {
    const partes: Reversao[] = []
    let danoFeito = 0
    if (dano > 0) {
      const feito = mexerNaFicha(mesa, personagemId, (atual, sistema) => ajustesDoDano(atual, sistema, dano, true), quemNaFicha(autor))
      if (feito !== null && feito !== 'recusada' && feito.length > 0) {
        partes.push(...reversaoDaFicha(personagemId, feito))
        danoFeito = dano
      }
    }
    if (cura > 0) {
      const feito = mexerNaFicha(
        mesa,
        personagemId,
        (atual, sistema) => {
          const maximo = maximoDoRecurso(atual, sistema, 'hp')
          const cabe = maximo === null ? cura : Math.min(cura, maximo - numeroDoRecurso(atual, sistema, 'hp'))
          const ajuste = cabe > 0 ? ajusteDoRecurso(atual, sistema, 'hp', cabe) : null
          return ajuste === null ? [] : [ajuste]
        },
        quemNaFicha(autor),
      )
      if (feito !== null && feito !== 'recusada' && feito.length > 0) partes.push(...reversaoDaFicha(personagemId, feito))
    }
    return { partes, dano: danoFeito }
  }

  const prazosDaVez = (sceneKey: string, de: CartaDaOrdem | null, para: CartaDaOrdem | null, autor: AutorDaAcao): Reversao[] => {
    const { fichaDaCena, mudarFichaDaCena } = mesa
    const cena = cenaDe(sceneKey)
    if (cena === undefined || fichaDaCena === undefined || mudarFichaDaCena === undefined) return []
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
    // ITENS REFEITOS, E6c: as condições da FICHA de quem sai descontam no fim da vez dele (a "por N turnos").
    const daFicha = de === null || de.personagemId === null ? null : contarFimDaVezNaMesa(mesa, de.personagemId)
    if (de !== null && daFicha !== null) {
      partes.push(daFicha.parte)
      if (daFicha.acabaram.length > 0) {
        textos.push(`${daFicha.acabaram.join(', ')} ${daFicha.acabaram.length === 1 ? 'acabou' : 'acabaram'} em ${nomeDe(de.tokenId)}`)
        tokenIds.add(de.tokenId)
      }
      // Pedido de 26/11: o gatilho "depois de X turnos" disparou no fim da vez dele (as condições já entraram acima).
      if (de.personagemId !== null && daFicha.disparos.length > 0) {
        for (const disparo of daFicha.disparos) textos.push(textoDoDisparo(disparo, nomeDe(de.tokenId)))
        tokenIds.add(de.tokenId)
        const vida = vidaDoGatilho(de.personagemId, daFicha.dano, daFicha.cura, autor)
        partes.push(...vida.partes)
        if (vida.dano > 0) efeitos.push({ tipo: 'dano', tokenId: de.tokenId, valor: vida.dano, saida: 'direto' })
      }
    }
    // Começo da vez de quem entra: lida DEPOIS do desconto (a mesma ficha pode ter a vez de novo).
    const entrando = para === null || para.bando !== undefined || para.personagemId === null ? null : fichaDaCena(sceneKey, para.tokenId)
    // Nº 3 do levantamento: a vida do prazo que um selo de mesmo nome já pede ("Aplicar / pular") não sai sozinha por cima.
    const comeco = entrando === null ? null : comecoDoPrazoNaVez(semAVidaQueOSeloPede(entrando, cena.turnos.selos))
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
    // E6c: o desconto da ficha sem notícia também fica sem linha, mas ainda assim gravado (como o do prazo do mapa).
    // Bug 5: sem linha, o desconto volta pelo Desfazer da vez (quem chama o põe na linha dela).
    if (textos.length === 0) return partes
    const atual = cenaDe(sceneKey) ?? cena
    // REQUISITOS B3: o dano do prazo no começo da vez também é "apanhou" (e pode derrubar).
    const rastreado = rastrear(atual.turnos, efeitos, partes)
    partes.push(...rastreado.partes)
    const caidos = semOsCaidos(mesa, sceneKey, rastreado.turnos)
    partes.push(...caidos.partes)
    const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
    const lembrados = lembrarDepoisDoDano(semCaidos)
    partes.push(...partesDosLembretes(lembrados))
    const texto = `Condições: ${textos.join(' · ')}${textoDosQueSairam(caidos.nomes)}`
    // Bug 4 (explorador 26/11): linha automática, autor mestre (o jogador não desfaz o veneno que tomou).
    const linha = comMudanca(atual, lembrados.turnos, { tipo: efeitos.length > 0 ? 'dano' : 'acao', texto, autor: MESTRE, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } })
    gravarCena(sceneKey, efeitos.length === 0 ? linha : { ...linha, efeitos: comEfeitos(atual.efeitos, efeitos) })
    if (efeitos.length > 0) avisarQuemCaiu(sceneKey, autor)
    return []
  }

  /**
   * Conserto de 18/11/2026 (análise, seção 2.3): o prazo das condições só andava na vez de quem tem carta. A
   * ficha da cena FORA da ordem (o refém envenenado, o invocado do bando) ficava com o prazo parado a batalha
   * inteira. Na virada da rodada cada uma passa um turno, como `prazosDaVez` faz com quem tem a vez: a vida
   * por turno e o desconto. Uma linha própria com Desfazer; só o desconto, sem notícia, fica sem linha (igual).
   */
  const prazosForaDaOrdem = (sceneKey: string, autor: AutorDaAcao): Reversao[] => {
    const { fichasDaCena, mudarFichaDaCena } = mesa
    const cena = cenaDe(sceneKey)
    if (cena === undefined || fichasDaCena === undefined || mudarFichaDaCena === undefined) return []
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
    // Bug 5 (explorador 26/11): o desconto sem notícia volta pelo Desfazer da vez da virada.
    if (textos.length === 0) return partes
    const atual = cenaDe(sceneKey) ?? cena
    // Bug 4 (explorador 26/11): linha automática, autor mestre.
    const linha = comMudanca(atual, atual.turnos, { tipo: efeitos.length > 0 ? 'dano' : 'acao', texto: `Condições fora da ordem: ${textos.join(' · ')}`, autor: MESTRE, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } })
    gravarCena(sceneKey, efeitos.length === 0 ? linha : { ...linha, efeitos: comEfeitos(atual.efeitos, efeitos) })
    return []
  }

  /**
   * Explorador 26/11/2026, bugs 5 e 6: a linha "vez" `idDaVez` passa a levar as linhas automáticas escritas
   * depois dela (o Desfazer da vez as desfaz junto) e o desconto de prazo que não rendeu linha. Sem nada a
   * juntar, ou a linha já fora do registro: nada muda (sem subir revisão: a reversão não vai para a rede).
   */
  const juntarNaLinhaDaVez = (sceneKey: string, idDaVez: string, prazos: readonly Reversao[]): void => {
    const cena = cenaDe(sceneKey)
    const indice = cena === undefined ? -1 : cena.registro.findIndex((linha) => linha.id === idDaVez)
    if (cena === undefined || indice < 0) return
    const juntas = cena.registro.slice(indice + 1).map((linha) => linha.id)
    if (juntas.length === 0 && prazos.length === 0) return
    const registro = cena.registro.map((linha) =>
      linha.id !== idDaVez || linha.reversao.tipo !== 'vez'
        ? linha
        : { ...linha, reversao: { ...linha.reversao, ...(juntas.length === 0 ? {} : { juntas }), ...(prazos.length === 0 ? {} : { prazos: [...prazos] }) } },
    )
    gravarCena(sceneKey, { ...cena, registro })
  }

  /**
   * REWORK DAS CONDIÇÕES (PLANO.md E5): o que a condição de cada selo faz sozinha na vez, numa linha do mestre
   * com Desfazer, depois do prazo (`lib/batalha/condicoesNaVez.ts` diz o quê; aqui se grava):
   *  - fim da vez de quem saiu: os Efeitos na vez do fim, o gatilho "Depois de X turnos" (a conta da ficha;
   *    os selos que o prazo acabou de tirar contam esta última vez), o teste para sair (d20 + o modificador
   *    do rank, como a marca) e o lembrete "Tentar sair" que ele não respondeu sai;
   *  - começo da vez de quem entra: os Efeitos na vez do começo (a 1ª vida fixa tirada fica no "Aplicar /
   *    pular" de sempre) e o lembrete "Tentar sair" de cada selo que sai pagando.
   * A vida tirada dispara as saídas "ao tomar dano" e a vida dada, as "ao receber cura" (não do próprio selo).
   * Devolve o que mudou sem linha (a conta do gatilho, o lembrete): vai no Desfazer da vez.
   */
  const condicoesDaVez = (sceneKey: string, sai: CartaDaOrdem | null, entra: CartaDaOrdem | null, acabaram: readonly SeloDaBatalha[], autor: AutorDaAcao, rodadaQueSai: number): Reversao[] => {
    const cena = cenaDe(sceneKey)
    const { personagens, sistema } = mesaDoRpg()
    if (cena === undefined || sistema === null) return []
    const quem = quemNaFicha(autor)
    const nomeDe = nomeDoTokenNa(cena.turnos, personagens)
    const criadas = mesa.condicoesCriadas?.() ?? []
    const partes: Reversao[] = []
    const textos: string[] = []
    const tokenIds = new Set<string>()
    const efeitos: EfeitoNovo[] = []
    let novos = cena.turnos
    const fichaDe = (personagemId: string): Personagem | undefined => mesa.personagens().find((candidato) => candidato.id === personagemId)
    const hpDe = (personagemId: string): number => {
      const ficha = fichaDe(personagemId)
      return ficha === undefined ? 0 : numeroDoRecurso(ficha, sistema, 'hp')
    }
    const escudoDe = (personagemId: string): number => {
      const ficha = fichaDe(personagemId)
      const escudo = recursoDoEscudo(sistema)
      return ficha === undefined || escudo === null ? 0 : numeroDaFicha(ficha.recursos, escudo.id)
    }
    /** Grava os ajustes na ficha (com o Desfazer); `false` = nada mudou ou a ficha recusou. */
    const naFicha = (personagemId: string, ajustes: (atual: Personagem, sistemaDaMesa: SistemaDeRpg) => readonly Ajuste[]): boolean => {
      const feito = mexerNaFicha(mesa, personagemId, ajustes, quem)
      if (feito === null || feito === 'recusada' || feito.length === 0) return false
      partes.push(...reversaoDaFicha(personagemId, feito))
      return true
    }
    const tirarSelos = (saem: readonly SeloDaBatalha[]): void => {
      if (saem.length === 0) return
      const ids = new Set(saem.map((selo) => selo.id))
      novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => !ids.has(selo.id)) }
      partes.push(...saem.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })))
    }
    /** As saídas "ao tomar dano" e "ao receber cura" dos selos de `tokenId` (fora o selo que causou). */
    const sairCom = (tokenId: string, acontecimento: AcontecimentoDaSaida, fonteId: string | null): void => {
      const saem = selosQueSaemCom(novos.selos, tokenId, acontecimento).filter((selo) => selo.id !== fonteId)
      if (saem.length === 0) return
      tirarSelos(saem)
      textos.push(textoDasSaidasDoSelo(saem, acontecimento, nomeDe(tokenId)))
      tokenIds.add(tokenId)
    }
    /** Quem pôs o selo (o "quem pôs ganha"): o dono da passiva, o da marca, ou o dono do cartão que o pôs. */
    const quemPos = (selo: SeloDaBatalha): CartaDaOrdem | undefined => {
      const cartaoId = selo.cartaoId
      const donoId = selo.donoId ?? selo.marcaDe ?? (cartaoId === undefined ? undefined : personagens.find((candidato) => chavesDoDono(candidato).some((chave) => idDaChave(chave) === cartaoId))?.id)
      return donoId === undefined ? undefined : novos.cartas.find((carta) => carta.personagemId === donoId && carta.extra === undefined)
    }
    /** Vida tirada de quem tem o selo: o dano na tela, a linha e as saídas "ao tomar dano". Devolve o que saiu da vida. */
    const tirarVida = (personagemId: string, tokenId: string, quanto: number, direto: boolean, fonteId: string | null): { perdeu: number; segurou: number } => {
      const [vidaAntes, escudoAntes] = [hpDe(personagemId), escudoDe(personagemId)]
      if (!naFicha(personagemId, (atual, sistemaDaMesa) => ajustesDoDano(atual, sistemaDaMesa, quanto, direto))) return { perdeu: 0, segurou: 0 }
      const perdeu = Math.max(0, vidaAntes - hpDe(personagemId))
      const segurou = Math.max(0, escudoAntes - escudoDe(personagemId))
      if (perdeu > 0) efeitos.push({ tipo: 'dano', tokenId, valor: perdeu, saida: 'direto' })
      if (perdeu + segurou > 0) sairCom(tokenId, { tipo: 'dano', tipos: [] }, fonteId)
      return { perdeu, segurou }
    }
    /** Vida dada a quem tem o selo, cortada pela Cura reduzida dos selos dele; devolve o que entrou e a nota do corte. */
    const darVida = (personagemId: string, tokenId: string, quanto: number, fonteId: string | null): { ganhou: number; corte: string } => {
      const antes = hpDe(personagemId)
      const cura = curaComOsSelos(quanto, novos.selos, tokenId)
      if (cura <= 0 || !naFicha(personagemId, (atual, sistemaDaMesa) => ajustesDaCura(atual, sistemaDaMesa, cura))) return { ganhou: 0, corte: '' }
      const ganhou = Math.max(0, hpDe(personagemId) - antes)
      const corte = ganhou > 0 ? notaDosSelosNaCura(novos.selos, tokenId) : ''
      if (ganhou > 0) sairCom(tokenId, { tipo: 'cura' }, fonteId)
      return { ganhou, corte }
    }
    /** Um Efeito na vez em quem tem o selo, com o pedaço da linha. */
    const aplicarEfeito = (carta: CartaDaOrdem, personagemId: string, { selo, efeito }: EfeitoDoSelo): void => {
      const ficha = fichaDe(personagemId)
      if (ficha === undefined) return
      const { tokenId } = carta
      const atual = efeito.recurso === 'vida' ? hpDe(personagemId) : efeito.recurso === 'sp' ? numeroDoRecurso(ficha, sistema, 'sp') : escudoDe(personagemId)
      // O Escudo não tem máximo: a % do máximo dele é a da vida máxima, como no boneco do protótipo.
      const maximo = maximoDoRecurso(ficha, sistema, efeito.recurso === 'sp' ? 'sp' : 'hp')
      const quanto = quantoDoEfeito(efeito, maximo, atual)
      if (quanto <= 0) return
      const deQuem = `${selo.nome} em ${nomeDe(tokenId)}`
      const pilhas = (selo.pilhas ?? 1) > 1 ? ` (${selo.pilhas ?? 1} pilhas)` : ''
      tokenIds.add(tokenId)
      if (efeito.faz === 'da') {
        if (efeito.recurso === 'vida') {
          const { ganhou, corte } = darVida(personagemId, tokenId, quanto, selo.id)
          textos.push(`${deQuem}: ${ganhou === 0 ? 'vida já cheia' : `+${ganhou} HP${corte}`}${pilhas}`)
          return
        }
        const recurso = efeito.recurso === 'sp' ? 'sp' : 'escudo'
        const antes = recurso === 'sp' ? numeroDoRecurso(ficha, sistema, 'sp') : escudoDe(personagemId)
        naFicha(personagemId, (agora, sistemaDaMesa) => ajustesDoRecursoDaCura(agora, sistemaDaMesa, recurso, quanto))
        const depois = fichaDe(personagemId)
        const ganhou = depois === undefined ? 0 : (recurso === 'sp' ? numeroDoRecurso(depois, sistema, 'sp') : escudoDe(personagemId)) - antes
        textos.push(`${deQuem}: ${ganhou <= 0 ? `${recurso === 'sp' ? 'SP já cheio' : 'sem Escudo para dar'}` : `+${ganhou} ${recurso === 'sp' ? 'SP' : 'de Escudo'}`}${pilhas}`)
        return
      }
      let tirado = 0
      if (efeito.recurso === 'vida') {
        const { perdeu, segurou } = tirarVida(personagemId, tokenId, quanto, efeito.direto === true, selo.id)
        tirado = perdeu + segurou
        textos.push(`${deQuem}: ${tirado === 0 ? 'nada a tirar' : `-${perdeu} HP${segurou > 0 ? ` (o Escudo segura ${segurou})` : ''}`}${pilhas}`)
      } else if (efeito.recurso === 'sp') {
        const antes = numeroDoRecurso(ficha, sistema, 'sp')
        naFicha(personagemId, (agora, sistemaDaMesa) => {
          const ajuste = ajusteDoRecurso(agora, sistemaDaMesa, 'sp', -quanto)
          return ajuste === null ? [] : [ajuste]
        })
        const depois = fichaDe(personagemId)
        tirado = Math.max(0, antes - (depois === undefined ? antes : numeroDoRecurso(depois, sistema, 'sp')))
        textos.push(`${deQuem}: ${tirado === 0 ? 'sem SP para tirar' : `-${tirado} SP`}${pilhas}`)
      } else {
        const escudo = recursoDoEscudo(sistema)
        const antes = escudoDe(personagemId)
        if (escudo !== null && antes > 0) naFicha(personagemId, () => [{ parte: 'recurso', chave: escudo.id, valor: Math.max(0, antes - quanto) }])
        tirado = Math.max(0, antes - escudoDe(personagemId))
        textos.push(`${deQuem}: ${tirado === 0 ? 'sem Escudo para tirar' : `-${tirado} de Escudo`}${pilhas}`)
      }
      // "Quem pôs ganha" (o roubo): o que saiu de verdade, na vida ou no SP de quem pôs a condição.
      const dono = efeito.rouba === true && efeito.recurso !== 'escudo' && tirado > 0 ? quemPos(selo) : undefined
      if (dono === undefined || dono.personagemId === null) return
      const donoId = dono.personagemId
      tokenIds.add(dono.tokenId)
      if (efeito.recurso === 'vida') {
        const { ganhou, corte } = darVida(donoId, dono.tokenId, tirado, null)
        textos.push(`${nomeDe(dono.tokenId)} ganha ${ganhou} HP${corte} (${selo.nome})`)
      } else {
        const fichaAntes = fichaDe(donoId)
        const spAntes = fichaAntes === undefined ? 0 : numeroDoRecurso(fichaAntes, sistema, 'sp')
        naFicha(donoId, (agora, sistemaDaMesa) => ajustesDoRecursoDaCura(agora, sistemaDaMesa, 'sp', tirado))
        const fichaDoDono = fichaDe(donoId)
        const ganhou = fichaDoDono === undefined ? 0 : numeroDoRecurso(fichaDoDono, sistema, 'sp') - spAntes
        textos.push(`${nomeDe(dono.tokenId)} ganha ${Math.max(0, ganhou)} SP (${selo.nome})`)
      }
    }
    /** A condição que o gatilho põe em quem o tem, pelo caminho do "Pôr selo" (a condição do nome congelada, contra, pilhas). */
    const porDoGatilho = (carta: CartaDaOrdem, personagemId: string, peca: Extract<PecaDoGatilho, { tipo: 'condicao' }>, origem: string): string => {
      const dele = fichaDe(personagemId)
      const pedido: SeloDoGolpe = { nome: peca.nome, turnos: peca.duracao === 'fim' ? null : peca.duracao }
      // PENDENCIAS nº 5: o número próprio da peça do gatilho vence (D4), como no acerto do item.
      const n = peca.n ?? 0
      const regraAntiga = n > 0 ? condicaoDoCatalogoPeloNome(peca.nome, criadas)?.regra : undefined
      if (regraAntiga === 'vida') pedido.porVez = n
      if (regraAntiga === 'cura') pedido.regra = { curaRecebida: -n }
      const resolvido = quedaEmNumeros(pedidoComACondicao(pedido, criadas, null), (atributo) => (dele === undefined ? 0 : valorDoRank(dele, atributo)))
      const selo = criarSelo(carta.tokenId, resolvido, { id: novoIdDeSelo(), rodada: novos.rodada, ...ondeNaVez(novos), origem })
      // PENDENCIAS nº 5: pôr de novo pelo gatilho recalcula as pilhas, como o golpe.
      const entrada = entradaDoSelo(novos.selos, selo, { comPilhas: comPilhasDaMesa(criadas) })
      switch (entrada.tipo) {
        case 'entrou':
          novos = { ...novos, selos: entrada.selos }
          partes.push({ tipo: 'selo', seloId: selo.id, antes: null }, ...entrada.apagados.map((apagado): Reversao => ({ tipo: 'selo', seloId: apagado.id, antes: apagado })))
          return ''
        case 'renovou':
        case 'pilha':
          novos = { ...novos, selos: entrada.selos }
          partes.push({ tipo: 'selo', seloId: entrada.antes.id, antes: entrada.antes, editado: true })
          return ''
        case 'barrado':
          return ` (${peca.nome} não pega: ${entrada.por.nome})`
        default:
          return ` (${peca.nome} não coube)`
      }
    }
    /** As peças do gatilho que disparou, em quem tem o selo (a vida direto, como o gatilho da ficha). */
    const aplicarDisparoDoSelo = (carta: CartaDaOrdem, personagemId: string, disparo: DisparoDoSelo): void => {
      const notas: string[] = []
      for (const peca of disparo.pecas) {
        if (peca.tipo === 'dano' && peca.valor > 0) tirarVida(personagemId, carta.tokenId, peca.valor, true, null)
        else if (peca.tipo === 'curar' && peca.fixo > 0) {
          const { corte } = darVida(personagemId, carta.tokenId, peca.fixo, null)
          if (corte !== '') notas.push(corte.trim())
        } else if (peca.tipo === 'condicao') {
          const nota = porDoGatilho(carta, personagemId, peca, disparo.selo.nome)
          if (nota !== '') notas.push(nota.trim())
        } else if (peca.tipo === 'tirar') {
          const quais = peca.nome === null ? undefined : { nomes: [peca.nome] }
          tirarSelos(selosQueALimpezaTira(novos.selos, carta.tokenId, quais).filter((selo) => selo.id !== disparo.selo.id))
        }
      }
      textos.push(`${disparo.selo.nome} de ${nomeDe(carta.tokenId)} disparou: ${disparo.pecas.map(fraseDaPecaDoGatilho).join(', ')}${disparo.saiu ? `; ${disparo.selo.nome} saiu` : ''}${notas.length === 0 ? '' : ` ${notas.join(' ')}`}`)
      tokenIds.add(carta.tokenId)
    }
    /** O lembrete "Tentar sair" fora do combate de `personagemId` (a vez dele acabou); só tira, sem linha. */
    const semOsLembretesDeSair = (personagemId: string): void => {
      const antes = novos.combate?.[personagemId]
      const ficam = (antes?.lembretes ?? []).filter((lembrete) => !ehLembreteDaSaida(lembrete))
      if (antes === undefined || ficam.length === (antes.lembretes ?? []).length) return
      const depois = { ...antes, lembretes: ficam }
      partes.push({ tipo: 'combate', personagemId, antes, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
    }

    // ── Fim da vez de quem saiu ──
    if (sai !== null && sai.personagemId !== null) {
      const personagemId = sai.personagemId
      for (const efeito of efeitosDaVez(novos.selos, sai.tokenId, 'fim')) aplicarEfeito(sai, personagemId, efeito)
      // Bug de 28/11/2026: uma vez por VEZ (o "Dar a vez" que devolve a vez à mesma carta não conta de novo).
      const contados = gatilhosDaVez(novos.selos, acabaram, sai.tokenId, { rodada: rodadaQueSai, cartaId: sai.id })
      if (contados.contados.length + contados.sairam.length > 0) {
        novos = { ...novos, selos: contados.selos }
        partes.push(...contados.contados.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo, editado: true })))
        partes.push(...contados.sairam.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })))
      }
      for (const disparo of contados.disparos) aplicarDisparoDoSelo(sai, personagemId, disparo)
      for (const teste of testesDoFimDaVez(novos.selos, sai.tokenId)) {
        const ficha = fichaDe(personagemId)
        if (ficha === undefined || !(novos.selos ?? []).some((selo) => selo.id === teste.selo.id)) continue
        const d20 = deps.rolarD20()
        const modificador = modificadorDoTeste(ficha, sistema, teste.atributo, bonusDaBatalha(novos.selos, sai.tokenId))
        const total = d20 + modificador
        const passou = total >= teste.cd
        efeitos.push({ tipo: 'reacao', golpeId: null, tokenId: sai.tokenId, d20, modificador, total })
        const atributo = sistema.atributos.find((candidato) => candidato.id === teste.atributo)?.nome ?? teste.atributo
        textos.push(`${teste.selo.nome} em ${nomeDe(sai.tokenId)}: teste de ${atributo} ${d20} ${modificador < 0 ? '-' : '+'} ${Math.abs(modificador)} = ${total} contra CD ${teste.cd}, ${passou ? 'passou e saiu' : 'não passou'}`)
        tokenIds.add(sai.tokenId)
        if (passou) tirarSelos([teste.selo])
      }
      semOsLembretesDeSair(personagemId)
    }

    // ── Começo da vez de quem entra ──
    if (entra !== null && entra.personagemId !== null) {
      const personagemId = entra.personagemId
      for (const efeito of efeitosDaVez(novos.selos, entra.tokenId, 'comeco')) aplicarEfeito(entra, personagemId, efeito)
      // D8: "Tentar sair" de cada selo que sai pagando, na vez dele (o jogador dono o vê na tira, o mestre na faixa).
      const antes = novos.combate?.[personagemId] ?? null
      const base = antes ?? combateVazio()
      const jaTem = new Set((base.lembretes ?? []).map((lembrete) => lembrete.chave))
      const lembretes = (novos.selos ?? [])
        .filter((selo) => selo.tokenId === entra.tokenId && selo.daPastilha !== true && saidasPagandoDe(selo).length > 0 && !jaTem.has(chaveDaSaida(selo.id)))
        .map((selo) => lembreteDaSaida(selo, novos.rodada))
      if (lembretes.length > 0) {
        const depois = { ...base, lembretes: [...(base.lembretes ?? []), ...lembretes] }
        partes.push({ tipo: 'combate', personagemId, antes, depois })
        novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
      }
    }

    if (partes.length === 0 && textos.length === 0) return []
    const atual = cenaDe(sceneKey) ?? cena
    if (textos.length === 0) {
      gravarCena(sceneKey, comMudanca(atual, novos, null))
      return partes
    }
    const danos = efeitos.filter((efeito) => efeito.tipo === 'dano')
    const rastreado = rastrear(novos, danos, partes)
    partes.push(...rastreado.partes)
    const caidos = semOsCaidos(mesa, sceneKey, rastreado.turnos)
    partes.push(...caidos.partes)
    const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
    const lembrados = lembrarDepoisDoDano(semCaidos)
    partes.push(...partesDosLembretes(lembrados))
    const linha = comMudanca(atual, lembrados.turnos, { tipo: danos.length > 0 ? 'dano' : 'acao', texto: `Condições na vez: ${textos.join(' · ')}${textoDosQueSairam(caidos.nomes)}`, autor: MESTRE, tokenIds: [...tokenIds], reversao: { tipo: 'composta', partes } })
    gravarCena(sceneKey, efeitos.length === 0 ? linha : { ...linha, efeitos: comEfeitos(atual.efeitos, efeitos) })
    if (danos.length > 0) avisarQuemCaiu(sceneKey, autor)
    return []
  }

  /**
   * O começo de vez num lugar só: o "Passar a vez" e o "Dar a vez" do mestre andam a vez nos turnos e
   * chegam aqui. Grava o "Recupera por turno" de quem entra, a linha "vez" com o Desfazer (só o que a vez
   * mudou, a recuperação e as linhas fechadas antes dela) e os selos que acabaram; depois o fim da vez das mecânicas de quem
   * sai e o prazo das condições (na virada, também o de quem está fora da ordem). A carta que sai da
   * ordem com a vez chega aqui pelo "Passar a vez" (`passarAVezDeQuemSai`). `cena` = a cena em que
   * `vez.antes` foi lido.
   */
  const comecarAVez = (sceneKey: string, cena: BatalhaDaCena, vez: VezQueComeca): void => {
    const { antes, sai, autor } = vez
    // REQUISITOS C: os acumuladores na vez (a queda por rodada sem uso na virada; o "sobe no começo da vez" de quem
    // entra), no combate que a linha "Vez" guarda: o Desfazer da vez os volta.
    const combates = combatesNoComecoDaVez(vez.depois, mesaDoRpg().personagens, vez.entra?.personagemId ?? null, vez.virou ? antes.rodada : null)
    const depois = combates === undefined || combates === vez.depois.combate ? vez.depois : { ...vez.depois, combate: combates }
    // Conserto das fichas F1 (bug 3): a linha guarda só o que a vez mudou (o Desfazer volta só isso).
    const mudou = mudancasDaVez(antes, depois)
    // 26/11/2026: o "Recupera por turno" da ficha de quem começa a vez (o +10 SP automático saiu).
    const recuperacao = recuperacaoDoComecoDaVez(antes, depois, autor)
    const idDaVez = novoIdDeLinha()
    const linha: LinhaNova = {
      id: idDaVez,
      tipo: 'vez',
      autor,
      texto: `${vez.texto}${recuperacao?.texto ?? ''}`,
      tokenIds: vez.tokenIds,
      // Os "Não reagiu" vieram antes da vez (fora de `mudou`); `fechados` diz ao Desfazer da vez quais linhas voltam junto.
      reversao: {
        tipo: 'vez',
        antes: { vez: antes.vez, rodada: antes.rodada, removidas: vez.removidas, gastos: antes.gastos, ...(vez.ordem === undefined ? {} : { ordem: vez.ordem }) },
        ...(mudou === undefined ? {} : { mudou }),
        ...(vez.fechados.length === 0 ? {} : { fechados: vez.fechados }),
        ...(recuperacao === null ? {} : { ficha: recuperacao.ficha }),
      },
    }
    // A ficha passou pela aventura (a recuperação): grava sobre a cena de agora.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, { ...comMudanca(atual, depois, linha), efeitos: comEfeitos(atual.efeitos, efeitosDosSelos(vez.acabaram)) })
    // F2 (fatia F): a Doença das Trevas, as Chamas Celestes e a duração da forma de quem saiu, numa linha própria (com Desfazer).
    fimDaVezDasMecanicas(sceneKey, sai, sai === null ? undefined : antes.gastos[sai.id], antes.rodada, autor)
    // Fase C: o prazo das condições (o desconto de quem saiu, a vida por turno de quem entra).
    const prazos = prazosDaVez(sceneKey, sai, vez.entra, autor)
    // 18/11/2026: na virada, o prazo de quem está fora da ordem também anda (um turno por rodada).
    if (vez.virou) prazos.push(...prazosForaDaOrdem(sceneKey, autor))
    // Nº 3 do levantamento: o prazo andou (ou acabou e a pastilha apagou): o espelho acompanha.
    espelharPastilhas(sceneKey)
    // Rework das condições (E5): o Efeito na vez, o gatilho, o teste para sair e o "Tentar sair" dos selos.
    prazos.push(...condicoesDaVez(sceneKey, sai, vez.entra, vez.acabaram, autor, antes.rodada))
    // ITENS REFEITOS, E6a (decisão 3): o pente vazio de quem entra recarrega sozinho, gastando a ação desta vez.
    recargasDaVez(sceneKey, vez.entra)
    // Rework das habilidades (D6, E5): os gatilhos das passivas montadas: "No início da batalha" na primeira vez, "Na rodada N"
    // na virada (e a rodada 1 no início) e "No começo da vez" de quem entra. Cada disparo sozinho tem a linha dele, com Desfazer.
    const eventos: EventoDoGatilho[] = []
    if (antes.vez === null) eventos.push({ momento: 'inicio' })
    else if (vez.virou) eventos.push({ momento: 'rodada' })
    const quemEntra = vez.entra?.personagemId ?? null
    if (quemEntra !== null) eventos.push({ momento: 'comeco', personagemId: quemEntra })
    dispararGatilhos(sceneKey, eventos)
    // Bugs 5 e 6 (explorador 26/11): o Desfazer desta vez leva junto as linhas automáticas e o desconto sem linha.
    juntarNaLinhaDaVez(sceneKey, idDaVez, prazos)
  }

  /**
   * ITENS REFEITOS, E6a (decisão 3): no começo da vez, cada arma equipada de quem entra com o pente
   * vazio e bala na mochila recarrega sozinha, gastando a ação da recarga desta vez. Linha própria, com
   * Desfazer; a do NPC só o mestre vê (as armas dele são segredo, como a escolha das armas era).
   */
  const recargasDaVez = (sceneKey: string, para: CartaDaOrdem | null): void => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || para === null || para.personagemId === null) return
    const feita = recargasNoComecoDaVez(mesa, sceneKey, { carta: para, chaveDoGasto: para.id, regras: cena.regras }, cena.turnos)
    if (feita === 'recusada' || feita.texto === null) return
    const nome = nomeDaCarta(para, mesaDoRpg().personagens)
    // Bug 4 (explorador 26/11): a recarga automática é linha do mestre, como as outras do começo da vez.
    const linha: LinhaNova = { tipo: 'acao', texto: `Recarga de ${nome}: ${feita.texto}`, autor: MESTRE, tokenIds: [para.tokenId], personagemIds: [para.personagemId], reversao: { tipo: 'composta', partes: feita.partes } }
    gravarCena(sceneKey, comMudanca(cena, feita.turnos, linha))
  }

  /**
   * Nº 3 do levantamento (a pastilha vale como o selo): os espelhos das pastilhas das fichas da ordem em dia
   * (`espelhosDasPastilhas`), sem linha no registro: o espelho só repete o que está na ficha do mapa. Roda antes
   * de a vez andar (a trava e o "Aplicar / pular" de quem entra já o leem) e depois do prazo da vez. A mesa sem
   * mapa (arena) não tem pastilha: nada muda.
   */
  const espelharPastilhas = (sceneKey: string): void => {
    const { fichaDaCena } = mesa
    const cena = cenaDe(sceneKey)
    if (cena === undefined || fichaDaCena === undefined) return
    const fichas = [...new Set(cena.turnos.cartas.map((carta) => carta.tokenId))].flatMap((tokenId) => fichaDaCena(sceneKey, tokenId) ?? [])
    // ITENS REFEITOS, E6c: também as condições da ficha de personagem de cada token (a cópia, no NPC).
    const selos = espelhosDasPastilhas(cena.turnos.selos, fichas, cena.turnos.rodada, novoIdDeSelo, daFichaNaMesa(mesa, cena.turnos.cartas))
    if (selos !== null) gravarCena(sceneKey, { ...cena, turnos: { ...cena.turnos, selos }, turnosRev: cena.turnosRev + 1 })
  }

  const acoes: Pick<BatalhaState, 'passarVez' | 'darVez' | 'espelharPastilhas'> = {
    espelharPastilhas,

    passarVez: (sceneKey, autor = MESTRE, esperado) => {
      // Nº 3 do levantamento: a pastilha que o mestre acendeu à mão desde a última vez já vale como selo nesta.
      espelharPastilhas(sceneKey)
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
      espelharPastilhas(sceneKey)
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
  }
  return { passarAVezDeQuemSai, prazosDaVez, acoes }
}

/** O que `criarVez` devolve. */
export type VezDaBatalha = ReturnType<typeof criarVez>
