/**
 * A fatia da VEZ da store da batalha One Piece: o "Passar a vez" e o "Dar a vez" do mestre, e o começo
 * de vez num lugar só (`comecarAVez`): +10 SP, linha "vez" com Desfazer, fim da vez das mecânicas e o
 * prazo das condições (de quem joga e, na virada, de quem está fora da ordem).
 */
import { chaveDaVez, type SeloDaBatalha } from '../../lib/batalha/combate'
import { combatesNoComecoDaVez } from '../../lib/batalha/acumuladorNaBatalha'
import { comBandosEmDia, semBandosVazios } from '../../lib/batalha/invocacao'
import { novoIdDeSelo, textoDosQueAcabaram } from '../../lib/batalha/selos'
import { formaDaFicha } from '../../lib/batalha/transformacao'
import { ajusteDoRecurso, ajusteDoSpDaVez, ganhaSpNaVez, maximoDoRecurso, numeroDoRecurso } from '../../lib/batalha/recursosDaBatalha'
import { chavesDoDono, mecanicaDoCartao, perdaNoFimDaVez, porcentoDoMaximo } from '../../lib/batalha/mecanicasAMao'
import { curaComOsSelos } from '../../lib/batalha/condicoes'
import { comLembretesDaVez, comLembretesDoMomento } from '../../lib/batalha/passivas'
import { ehOverload } from '../../lib/batalha/leituraDaFicha'
import { ajustesDoDano } from '../../lib/batalha/reacao'
import { mudancasDaVez, type ParteDaFicha, type Reversao } from '../../lib/batalha/registro'
import {
  agilidadesDasCartas,
  cartaDaVez,
  darVez as darVezNaOrdem,
  passarVez as passarVezNaOrdem,
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
import type { NucleoDaBatalha } from './nucleo'
import type { FormasDaBatalha } from './formas'
import { efeitosDosSelos } from './selos'
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

/** A vez presa ao núcleo da store, às formas e ao golpe. */
export function criarVez(nucleo: NucleoDaBatalha, fatiaDasFormas: FormasDaBatalha, fatiaDoGolpe: GolpeNaStore) {
  const { mesa, get, mesaDoRpg, cenaDe, gravarCena, avisarQuemCaiu, lembrarDepoisDoDano, rastrear } = nucleo
  const { desligarAForma } = fatiaDasFormas
  const { fecharGolpesSemResposta } = fatiaDoGolpe

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
    // Chamas Celestes: cada selo dela em quem sai. Fase 5: o selo montado traz o dreno de SP nele (`drenaSp`), e a regeneração (`regenera`).
    for (const selo of cena.turnos.selos ?? []) {
      if (selo.tokenId === saindo.tokenId && selo.regenera !== undefined) {
        const { recurso, quanto } = selo.regenera
        const ficha = fichaDe(saindo.personagemId)
        const maximo = ficha === undefined ? null : maximoDoRecurso(ficha, sistema, recurso)
        const atual = ficha === undefined ? 0 : numeroDoRecurso(ficha, sistema, recurso)
        // A cura cortada pela regra do selo (`curaRecebida`) vale também aqui; o máximo da ficha é o teto.
        const cabe = maximo === null ? quanto : Math.max(0, Math.min(recurso === 'hp' ? curaComOsSelos(quanto, cena.turnos.selos, saindo.tokenId) : quanto, maximo - atual))
        const ganhou = cabe === 0 ? 0 : mexer(saindo.personagemId, recurso, cabe)
        textos.push(`${selo.nome} em ${nomeDe(saindo.personagemId)}: ${ganhou === 0 ? 'já cheio' : `+${ganhou} ${recurso === 'hp' ? 'HP' : 'SP'}`}`)
      }
      const dreno = selo.tokenId !== saindo.tokenId ? undefined : selo.drenaSp !== undefined ? { alvoSp: selo.drenaSp.quanto, donoSp: selo.drenaSp.paraQuemUsa, donoHpPorcento: 0 } : selo.cartaoId !== undefined ? mecanicaDoCartao(selo.cartaoId)?.drenoNoFimDaVez : undefined
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
   * 3 x 4 tira 12, como fora da batalha), menos a do prazo que um selo de mesmo
   * nome já pede (o espelho da pastilha, Nº 3 do levantamento: vai pelo "Aplicar /
   * pular" do mestre, como o selo). Uma linha própria com Desfazer
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
    if (textos.length === 0) return
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
    const { antes, sai, autor } = vez
    // REQUISITOS C: os acumuladores na vez (a queda por rodada sem uso na virada; o "sobe no começo da vez" de quem
    // entra), no combate que a linha "Vez" guarda: o Desfazer da vez os volta.
    const combates = combatesNoComecoDaVez(vez.depois, mesaDoRpg().personagens, vez.entra?.personagemId ?? null, vez.virou ? antes.rodada : null)
    const depois = combates === undefined || combates === vez.depois.combate ? vez.depois : { ...vez.depois, combate: combates }
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
    // Nº 3 do levantamento: o prazo andou (ou acabou e a pastilha apagou): o espelho acompanha.
    espelharPastilhas(sceneKey)
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
    const selos = espelhosDasPastilhas(cena.turnos.selos, fichas, cena.turnos.rodada, novoIdDeSelo)
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
