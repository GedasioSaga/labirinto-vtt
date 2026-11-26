import type { Direcao } from '../lib/batalha/area'
import { MOTIVO_FORA_DO_ALCANCE } from '../lib/batalha/alcance/doGolpe'
import { motivoDoConcentrar } from '../lib/batalha/acoes'
import { ALVOS_MAX, chaveDaVez, type PedidoDeAcao } from '../lib/batalha/combate'
import { travaDoToken } from '../lib/batalha/condicoes'
import { acoesDaCarta, sugestaoParaNpc } from '../lib/batalha/golpe'
import type { LinhaDoRegistro, TipoDaLinha } from '../lib/batalha/registro'
import { danoFinal } from '../lib/batalha/reacao'
import { bonusDaBatalha } from '../lib/batalha/selos'
import { formasQueDesligamNoFim, type FormaNoMenu } from '../lib/batalha/transformacao'
import type { Personagem } from '../lib/personagem'
import { nomeDaForma } from '../components/batalha/ListaDeFormas'
import { passivasNaCena } from '../components/batalha/PassivasDaBatalha'
import { cartaDaVez, contrasQueSeguramAVez, tokensCaidos, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../lib/batalha/turnos'
import { ehDoMestre, golpesDaVezDoNpc, mesaAgora, sugestaoNaTela, type MesaDaCena } from '../components/batalha/BatalhaDoMestre'
import { faixaDoMestre, linhasDoMestre, type RecursoNaCarta } from '../components/batalha/dadosDaFaixa'
import { armaPadraoNaBatalha, economiaEmTexto, formatarNumero, golpesDeAtaque, golpesDeHabilidade, pipsDaVez, type AlvoNaMira, type GolpeNaTela } from '../components/batalha/dadosDoMenu'
import { itensDaCartaDoMestre } from '../components/batalha/menuDaCartaDoMestre'
import { alvosDaOrdem, nomeDaFicha } from '../components/batalha/mesaDoMestre'
import { deixarParaDepois, deveAReacao, travasDeixadas } from '../components/batalha/travaDoPassar'
import { pedidoDoGolpe } from '../components/batalha/MiraDoGolpe'
import { areaDaGrade, direcaoAoAbrirAMira, formaOlhaParaUmLado, mandaOLado, marcasDaAreaVirada, quemSaiAoMandar, textoDoForaDoAlcance } from '../components/batalha/regraDaMira'
import { ligarSomDoCombate, somDoCombateLigado } from '../lib/sons/sonsDoCombate'
import { cameraDaBatalhaLigada, ligarCameraDaBatalha } from '../pixi/cameraDaBatalha'
import type { MiraNoMapa } from '../stores/batalha/miraNoMapa'
import { useBatalhaStore } from '../stores/batalhaStore'
import { useToastStore } from '../stores/toastStore'
import { escolherItemDaCarta, itensNoEspelho } from './menuDaCartaNoEspelho'
import { ligarOMenuDoMapa, menuDoMapaAberto } from './telaDaMesa'
import { ladoDoMouseNaMiraDaMesa, miraDaMesaNoChao, mostrarMiraDaMesa } from './miraDaMesa'
import type { AjusteDoGolpe, AlcanceDoPedido, AlvoNoEspelho, CartaNoEspelho, ContraNoEspelho, EspelhoDaBatalha, GolpeNoEspelho, LinhaNoEspelho, MiraDaMesa, OutrasAcoesNoEspelho, PedidoDaMesa,PendenteNoEspelho, RecursoNoEspelho, RespostaDaMesa, VezNoEspelho } from './tipos'

/**
 * A MESA DA BATALHA no One Piece: o espelho lido das stores (as mesmas leituras
 * da página Batalha e do menu do centro: `faixaDoMestre`, `golpesDaVezDoNpc`,
 * `alvosDaOrdem`, `linhasDoMestre`) e os pedidos aplicados pelas mesmas ações da
 * `batalhaStore` que o livro chama, sempre como o mestre.
 */

const MESTRE: AutorDaAcao = { tipo: 'mestre' }
/** O registro na tela: as mais novas (o livro tem o inteiro). */
const LINHAS_NA_MESA = 60
/** O que aconteceu nesta vez, no cartão da vez: as mais novas. */
const FEITOS_NA_VEZ = 3
const SEPARA_ID = '|'
/** O id do pendente que é um pedido de ajuda (o resto é golpe|ficha da reação). */
const PREFIXO_DA_AJUDA = 'ajuda:'
const RESPOSTA_ACEITA = 'aceitar'
const RESPOSTA_RECUSA = 'recusar'
/** As linhas que contam o que a vez fez (golpe, reação, dano); as de ordem e regra ficam só no registro. */
const LINHAS_DA_VEZ: ReadonlySet<TipoDaLinha> = new Set<TipoDaLinha>(['acao', 'golpe', 'habilidade', 'reacao', 'dano', 'transformacao', 'selo'])

const recusa = (motivo: string): RespostaDaMesa => ({ ok: false, motivo })
const OK: RespostaDaMesa = { ok: true, motivo: null }

/** Quando cada contra-ataque começou a esperar (a store não guarda a hora): visto pela primeira vez aqui. */
const contraVistoEm = new Map<string, number>()

function recursos(lista: readonly RecursoNaCarta[]): RecursoNoEspelho[] {
  return lista.map((recurso) => ({ rotulo: recurso.rotulo, atual: recurso.atual, maximo: recurso.maximo, tom: recurso.tom }))
}

/** A chave da vez (rodada e carta): o pedido que chega com outra é de uma vez que já passou. */
function chaveDe(turnos: TurnosDaCena, carta: CartaDaOrdem): string {
  return chaveDaVez(turnos.rodada, carta.id)
}

/**
 * Por que o golpe só sai pelo menu do mapa: a mesa lança com o de sempre da mira
 * (o dano da ficha, sem Surpresa, o Perfurante da técnica, o selo sugerido), e
 * o golpe que pede uma escolha a mais não tem de onde tirar. `null` = sai daqui.
 */
function porQueNoMapa(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): string | null {
  if (golpe.invocacao === true) return 'Invocação: escolha a opção e o lugar pelo menu do mapa.'
  if (golpe.acao === 'passiva') return 'Passiva: não se lança.'
  if (golpe.custo.tipo === 'pergunta') return `Pede o custo à mão (${golpe.custo.texto}): use o menu do mapa.`
  if (golpe.acao === null) return 'A ficha não diz a ação: escolha pelo menu do mapa.'
  if ((golpe.opcoes?.length ?? 0) > 0) return 'Tem opções para escolher: use o menu do mapa.'
  if ((golpe.perguntas?.length ?? 0) > 0) return 'Faz perguntas na hora: use o menu do mapa.'
  if ((golpe.armas?.length ?? 0) > 1) return 'Pede a arma: use o menu do mapa.'
  // ITENS REFEITOS, E6a: a arma de pente atira a bala que está no pente, sem escolha (o host a acha pelo `balaDoPedido`).
  const soOPente = golpe.balas?.length === 1 && golpe.balas[0]?.doPente === true
  if (!soOPente && ((golpe.balas?.length ?? 0) > 0 || golpe.exigeMunicao === true)) return 'Pede a bala: use o menu do mapa.'
  if ((golpe.area !== undefined || golpe.areaPelaGrade === true) && !aMesaMarcaAArea(golpe, alvos)) return 'Marca a área no mapa: use o menu do mapa.'
  if (golpe.dano.valor === null && !golpe.dano.semDano && golpe.dano.pelaVida !== true) return 'O dano é à mão: use o menu do mapa.'
  return null
}

/**
 * Conserto de 25/11/2026 (levantamento das mecânicas duplicadas, item 16): a área montada pela grade a mesa
 * marca sozinha, pela regra do menu da vez. A área longe (o centro, escolhido no mapa) e a área sem a grade
 * seguem pelo menu do mapa.
 */
function aMesaMarcaAArea(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): boolean {
  return areaDaGrade(golpe, alvos) !== null && golpe.area?.centro === undefined
}

/** A casa de quem usa (coluna, linha e tamanho): mudou, a mesa remarca a área, como o menu da vez quando a ficha anda. */
function casaDeQuemUsa(alvos: readonly AlvoNaMira[]): string | null {
  const pegada = alvos.find((alvo) => alvo.naGrade !== undefined)?.naGrade?.deQuemAge
  return pegada === undefined ? null : `${pegada.col},${pegada.row},${pegada.tamanho}`
}

/**
 * Item 16: o lado e a área pela regra do menu da vez (`regraDaMira`), contados aqui porque a mesa não tem a
 * grade: o lado ao abrir, se as setas viram e quem a área pega virada para cada lado.
 */
function ladoEAreaNoEspelho(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): Pick<GolpeNoEspelho, 'lado' | 'area'> {
  if (!mandaOLado(golpe, alvos)) return {}
  const lado = { aoAbrir: direcaoAoAbrirAMira(golpe, alvos), vira: formaOlhaParaUmLado(golpe, alvos) }
  const casa = casaDeQuemUsa(alvos)
  if (casa === null || !aMesaMarcaAArea(golpe, alvos)) return { lado }
  const pega = (direcao: Direcao): string[] => marcasDaAreaVirada(golpe, alvos, direcao) ?? []
  return { lado, area: { pega: { norte: pega('norte'), sul: pega('sul'), leste: pega('leste'), oeste: pega('oeste') }, casa } }
}

function detalheDoGolpe(golpe: GolpeNaTela): string {
  const dano = golpe.dano.semDano ? 'sem dano' : golpe.dano.valor === null ? 'dano pela vida' : `dano ${formatarNumero(golpe.dano.valor)}`
  return [golpe.acaoTexto, dano, golpe.custoTexto, golpe.tempoTexto].filter((parte): parte is string => typeof parte === 'string' && parte !== '').join(' · ')
}

/** REQUISITOS G: o golpe está cinza só pelo que falta dos requisitos (o mesmo teste do "Usar mesmo assim" do menu do centro). */
function cinzaSoDosRequisitos(golpe: GolpeNaTela): boolean {
  return golpe.faltaDosRequisitos !== undefined && golpe.motivo === golpe.faltaDosRequisitos
}

/**
 * O golpe que o pedido lança. Com `forcar` (o "Usar mesmo assim" da mesa), o cinza só pelos requisitos
 * sai com `forcarRequisitos` (o host pula o que falta; o custo normal fica). Cinza por outra regra
 * (recarga, custo, ação gasta, trava) continua recusado com o motivo dela.
 */
function golpeDoPedido(golpe: GolpeNaTela, forcar: boolean): { golpe: GolpeNaTela; motivo: null } | { golpe: null; motivo: string } {
  if (golpe.motivo === null) return { golpe, motivo: null }
  if (forcar && cinzaSoDosRequisitos(golpe)) return { golpe: { ...golpe, motivo: null, forcarRequisitos: true }, motivo: null }
  return { golpe: null, motivo: golpe.motivo }
}

function golpeNoEspelho(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[]): GolpeNoEspelho {
  // Item 16: sem teto da técnica, o mesmo teto do menu da vez (a área que pega muitos marca até ele).
  const teto = golpe.semAlvo === true ? 0 : (golpe.tetoDeAlvos ?? golpe.divide ?? ALVOS_MAX)
  const comNumero = !golpe.dano.semDano && golpe.dano.valor !== null
  const forcavel = cinzaSoDosRequisitos(golpe)
  return {
    chave: golpe.chave,
    nome: golpe.nome,
    detalhe: detalheDoGolpe(golpe),
    motivo: golpe.motivo,
    // O forçável diz também se sai daqui: forçado, o cinza some e o que sobra é o de sempre.
    noMapa: golpe.motivo === null || forcavel ? porQueNoMapa(golpe, alvos) : null,
    forcavel,
    alvo: golpe.semAlvo === true ? 'nenhum' : teto === 1 ? 'um' : 'varios',
    alvosMax: teto,
    alvosPermitidos: null,
    dano: comNumero ? golpe.dano.valor : null,
    perfurante: golpe.perfurante,
    ajustavel: comNumero,
    ...ladoEAreaNoEspelho(golpe, alvos),
  }
}

function alvosNoEspelho(alvos: ReturnType<typeof alvosDaOrdem>): AlvoNoEspelho[] {
  return alvos.map((alvo) => ({ id: alvo.tokenId, nome: alvo.nome, lado: alvo.lado, caiu: alvo.caiu, motivo: alvo.motivo ?? null, detalhe: null }))
}

/**
 * Quando a vez começou e o que ela já fez: as linhas depois da última "Vez" de
 * pé no registro (o registro vem da mais velha à mais nova).
 */
function daVez(registro: readonly LinhaDoRegistro[]): { desde: number | null; feitos: string[] } {
  let inicio = -1
  for (let indice = registro.length - 1; indice >= 0; indice -= 1) {
    const linha = registro[indice]
    if (linha !== undefined && linha.tipo === 'vez' && linha.desfeita === undefined) {
      inicio = indice
      break
    }
  }
  const desde = inicio >= 0 ? (registro[inicio]?.quando ?? null) : null
  const feitos = registro
    .slice(inicio + 1)
    .filter((linha) => linha.desfeita === undefined && LINHAS_DA_VEZ.has(linha.tipo))
    .map((linha) => linha.texto)
    .reverse()
    .slice(0, FEITOS_NA_VEZ)
  return { desde, feitos }
}

interface VezDoNpc {
  carta: CartaDaOrdem
  golpes: readonly GolpeNaTela[]
  alvos: ReturnType<typeof alvosDaOrdem>
  /** Atordoado, Paralisado: tudo apaga com esta frase, menos o Passar. */
  trava: string | null
  /** 26/11/2026: o Concentrar e, só quando a ficha tem, a Transformação, as Passivas e os itens (a mesa reduzida). */
  outras: OutrasAcoesNoEspelho
}

/** Os golpes e os alvos da vez do NPC, lidos como o menu do centro os lê; `null` = a vez não é de NPC. */
function vezDoNpc(mesa: MesaDaCena, turnos: TurnosDaCena, carta: CartaDaOrdem): VezDoNpc | null {
  const { cena, personagens, sistema } = mesa
  if (cena === undefined || carta.bando !== undefined || !ehDoMestre(carta.personagemId, personagens)) return null
  const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena.regras })
  const { trava, habilidades, armas, formas, itens } = golpesDaVezDoNpc(mesa, turnos, carta, personagem, acoes)
  return { carta, golpes: [...habilidades, ...armas], alvos: alvosDaOrdem(mesa, turnos.cartas, carta), trava, outras: outrasAcoes(mesa, turnos, carta, personagem, acoes, { trava, formas, itens }) }
}

/**
 * Pedido do dono de 26/11/2026: o que o menu da vez do NPC (`MenuDaVezDoNpc`) tem além do golpe, lido com as
 * mesmas leituras dele. O Concentrar sempre (o motivo é o mesmo da tira); a Transformação, as Passivas e os itens
 * só quando a ficha tem, apagados com a trava (Atordoado), como as tiras do menu.
 */
function outrasAcoes(
  mesa: MesaDaCena,
  turnos: TurnosDaCena,
  carta: CartaDaOrdem,
  personagem: Personagem | null,
  acoes: ReturnType<typeof acoesDaCarta>,
  daVez: { trava: string | null; formas: readonly FormaNoMenu[]; itens: readonly GolpeNaTela[] },
): OutrasAcoesNoEspelho {
  const { trava, formas, itens } = daVez
  const combate = carta.personagemId === null ? undefined : turnos.combate?.[carta.personagemId]
  const passivas = passivasNaCena(personagem, mesa.sistema, turnos, carta.tokenId)
  const ligada = formas.find((forma) => forma.ligada)
  return {
    concentrar: { motivo: trava ?? motivoDoConcentrar(combate, acoes, chaveDaVez(turnos.rodada, carta.id)), carga: combate?.carga ?? 0 },
    transformacao: formas.length === 0 ? null : { quantas: formas.length, ativa: ligada === undefined ? null : nomeDaForma(ligada), motivo: trava },
    passivas: passivas.length === 0 ? null : { quantas: passivas.length, ativas: passivas.filter((passiva) => passiva.estado === 'ativa').length, motivo: trava },
    itens: itens.length === 0 ? null : { quantos: itens.length, motivo: trava },
  }
}

/** As ações do NPC que contra-ataca, como o menu do contra no centro as lê: fora da vez (sem a ação da vez), com a trava dele. */
function golpesDoContra(mesa: MesaDaCena, turnos: TurnosDaCena, carta: CartaDaOrdem): GolpeNaTela[] {
  const { personagens, sistema } = mesa
  const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
  const combate = carta.personagemId === null ? undefined : turnos.combate?.[carta.personagemId]
  const arma = armaPadraoNaBatalha(personagem, combate)
  const bonus = bonusDaBatalha(turnos.selos, carta.tokenId)
  const trava = travaDoToken(turnos.selos, carta.tokenId)
  const habilidades = personagem !== null && sistema !== null ? golpesDeHabilidade(personagem, sistema, combate, null, arma, bonus) : []
  const todos = [...habilidades, ...golpesDeAtaque(personagem, sistema, combate, null, bonus)]
  return trava === null ? todos : todos.map((golpe) => ({ ...golpe, motivo: trava }))
}

function vezNoEspelho(mesa: MesaDaCena, turnos: TurnosDaCena, carta: CartaDaOrdem, recursosDaVez: readonly RecursoNoEspelho[], equipe: string | null, posicao: number, registro: readonly LinhaDoRegistro[]): VezNoEspelho {
  const quem = nomeDaFicha(mesa, carta.tokenId, carta)
  const { cena, personagens, sistema, equipes } = mesa
  const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
  const acoes = carta.bando === undefined ? acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena?.regras ?? null }) : null
  const { desde, feitos } = daVez(registro)
  const base = {
    chave: chaveDe(turnos, carta),
    quem,
    recursos: recursosDaVez,
    sugestao: { golpe: null, alvo: null },
    posicao,
    desde,
    feitos,
    pips: acoes === null ? [] : pipsDaVez(acoes).map((pip) => ({ texto: pip.texto, gasto: pip.gasto })),
    menuDoMapa: false,
  }
  if (carta.bando !== undefined) {
    return { ...base, npc: true, descricao: 'Bando de invocados', golpes: [], alvos: [], aviso: 'A vez do bando (cada invocado age) fica na página Batalha do livro. Daqui dá para passar a vez.', outras: null }
  }
  const doNpc = vezDoNpc(mesa, turnos, carta)
  if (doNpc === null) {
    return { ...base, npc: false, descricao: equipe === null ? 'Jogador' : `Jogador · ${equipe}`, golpes: [], alvos: [], aviso: `${quem} joga na tela própria. Daqui você passa a vez, desfaz e responde às reações.`, outras: null }
  }
  const sugestao = personagem === null || cena === undefined ? null : sugestaoParaNpc(personagem, cena, { personagens, sistema, equipes, caidos: tokensCaidos(turnos.cartas, personagens, sistema) })
  const naTela = sugestaoNaTela(sugestao)
  const economia = acoes === null ? '' : economiaEmTexto(acoes)
  return {
    ...base,
    npc: true,
    descricao: [equipe === null ? 'NPC' : `NPC · ${equipe}`, base.pips.length === 0 ? economia : ''].filter((parte) => parte !== '').join(' · '),
    golpes: doNpc.golpes.map((golpe) => golpeNoEspelho(golpe, doNpc.alvos)),
    alvos: alvosNoEspelho(doNpc.alvos),
    sugestao: { golpe: naTela.chave, alvo: naTela.alvoTokenId },
    aviso: doNpc.trava ?? (doNpc.golpes.length === 0 ? 'Sem técnica nem arma na ficha: passe a vez ou dê dano pelo livro.' : null),
    menuDoMapa: true,
    outras: doNpc.outras,
  }
}

function pendentes(mesa: MesaDaCena, turnos: TurnosDaCena, quandoDaLinha: ReadonlyMap<string, number>): PendenteNoEspelho[] {
  const itens: PendenteNoEspelho[] = []
  for (const golpe of turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (!deveAReacao(alvo)) continue
      const doMestre = ehDoMestre(alvo.personagemId, mesa.personagens)
      const nomeDoAlvo = nomeDaFicha(mesa, alvo.tokenId)
      const atacante = nomeDaFicha(mesa, golpe.atacanteTokenId)
      const dano = alvo.dano === null ? '' : ` (${formatarNumero(alvo.dano)})`
      const antesDoDado = alvo.rolagem === undefined
      itens.push({
        id: `${golpe.id}${SEPARA_ID}${alvo.tokenId}`,
        titulo: `${golpe.nome} de ${atacante} em ${nomeDoAlvo}${dano}`,
        quem: doMestre ? 'Você (NPC)' : `${nomeDoAlvo} (jogador)`,
        doMestre,
        desde: quandoDaLinha.get(golpe.linhaId) ?? null,
        ativa: true,
        // O mestre responde pelo NPC; pelo jogador que sumiu, só o "Sem reação" antes do dado (o "Tomar o golpe" depois).
        respostas: [antesDoDado ? { chave: 'naoReagir', rotulo: 'Sem reação', bloqueio: null } : { chave: 'passar', rotulo: 'Tomar o golpe', bloqueio: null }],
        nota: doMestre
          ? antesDoDado
            ? 'Rolar a esquiva ou a defesa: na carta REAÇÃO, no meio do mapa do app.'
            : 'Escolher o que o dado liberou: na carta REAÇÃO, no meio do mapa do app.'
          : `${nomeDoAlvo} rola 1d20 na tela do jogador.`,
        golpe: {
          nome: golpe.nome,
          de: atacante,
          alvo: nomeDoAlvo,
          chega: alvo.dano,
          rolou: alvo.rolagem === undefined ? null : { d20: alvo.rolagem.d20, total: alvo.rolagem.total },
          danos: alvo.dano === null ? null : { critico: danoFinal(alvo.dano, 'critico'), cheio: danoFinal(alvo.dano, 'cheio'), metade: danoFinal(alvo.dano, 'metade') },
        },
      })
    }
  }
  itens.push(...ajudasDoMestre(turnos))
  return itens
}

/**
 * REQUISITOS E/J2: os pedidos de ajuda que só o mestre responde (o J2 "o mestre decide" e o NPC aliado que
 * paga). A mesa encostada cobre a página Batalha do livro, onde a caixa deles mora: sem isto o mestre não
 * os via nem aprovava (jornada por gesto de 23/11). Os entre jogadores ficam com o aliado, como antes.
 */
function ajudasDoMestre(turnos: TurnosDaCena): PendenteNoEspelho[] {
  return (turnos.pedidosDeAjuda ?? []).flatMap((ajuda): PendenteNoEspelho[] => {
    if (ajuda.estado !== 'esperando' || (ajuda.aoMestre !== true && ajuda.paraPersonagemId !== null)) return []
    const aoMestre = ajuda.aoMestre === true
    return [
      {
        id: `${PREFIXO_DA_AJUDA}${ajuda.id}`,
        titulo: ajuda.frase,
        quem: aoMestre ? 'Você' : `Você (${ajuda.nomePara})`,
        doMestre: true,
        desde: ajuda.criadoEm,
        ativa: true,
        respostas: [
          { chave: RESPOSTA_ACEITA, rotulo: aoMestre ? 'Aprovar' : 'Aceitar', bloqueio: null },
          { chave: RESPOSTA_RECUSA, rotulo: 'Recusar', bloqueio: null },
        ],
        nota: aoMestre ? `Para usar ${ajuda.tecnica}. Nada é gasto até você aprovar.` : `${ajuda.nomeDe} pede para usar ${ajuda.tecnica}; o ${ajuda.nomePara} paga.`,
        golpe: null,
      },
    ]
  })
}

function contraNoEspelho(mesa: MesaDaCena, turnos: TurnosDaCena): ContraNoEspelho | null {
  const seguram = contrasQueSeguramAVez(turnos)
  const ids = new Set(seguram.map((contra) => contra.golpeId))
  for (const id of [...contraVistoEm.keys()]) if (!ids.has(id)) contraVistoEm.delete(id)
  const contra = seguram[0]
  if (contra === undefined) return null
  if (!contraVistoEm.has(contra.golpeId)) contraVistoEm.set(contra.golpeId, Date.now())
  const doMestre = ehDoMestre(contra.personagemId, mesa.personagens)
  const carta = turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId && candidata.bando === undefined)
  const comMenu = doMestre && carta !== undefined
  const alvos = comMenu ? alvosDaOrdem(mesa, turnos.cartas, carta) : []
  return {
    golpeId: contra.golpeId,
    quem: nomeDaFicha(mesa, contra.tokenId, carta),
    de: nomeDaFicha(mesa, contra.atacanteTokenId),
    doMestre,
    desde: contraVistoEm.get(contra.golpeId) ?? null,
    golpes: comMenu ? golpesDoContra(mesa, turnos, carta).map((golpe) => golpeNoEspelho(golpe, alvos)) : [],
    alvos: alvosNoEspelho(alvos),
    alvoSugerido: contra.atacanteTokenId,
  }
}

/** O espelho da batalha One Piece da cena; `null` = a cena não está nela. */
export function espelhoOP(sceneKey: string): EspelhoDaBatalha | null {
  const mesa = mesaAgora(sceneKey)
  const { cena } = mesa
  if (cena === undefined) return null
  const { turnos } = cena
  const faixa = faixaDoMestre({ turnos, fichas: mesa.fichas, personagens: mesa.personagens, equipes: mesa.equipes, sistema: mesa.sistema, registro: cena.registro })
  const contextoDoMenu = { sceneKey, dados: faixa, turnos, personagens: mesa.personagens, equipes: mesa.equipes ?? [], sistema: mesa.sistema }
  const indiceDaVez = faixa.cartas.findIndex((carta) => carta.id === faixa.vez)
  const ordem: CartaNoEspelho[] = faixa.cartas.map((carta, indice) => {
    const marcas = (carta.selos ?? []).map((selo) => selo.texto)
    if (carta.forma) marcas.unshift(carta.forma)
    if (carta.extra !== null) marcas.push(carta.extra === 'rodada' ? 'Carta extra (rodada)' : 'Carta extra')
    if ((carta.carga ?? 0) > 0) marcas.push(`Carga ${carta.carga}`)
    return {
      id: carta.id,
      nome: carta.bando === undefined ? nomeDaFicha(mesa, carta.tokenId) : carta.nome,
      npc: carta.npc,
      cor: carta.cor,
      lado: carta.equipe,
      iniciativa: null,
      recursos: carta.vida === 'numeros' ? recursos(carta.recursos) : [],
      caiu: carta.caiu,
      vez: carta.id === faixa.vez,
      proxima: carta.id === faixa.proxima,
      marcas,
      posicao: indice + 1,
      agiu: indiceDaVez >= 0 && indice < indiceDaVez,
      menu: itensNoEspelho(itensDaCartaDoMestre(carta, contextoDoMenu)),
    }
  })
  const carta = cartaDaVez(turnos)
  const daVezNaFaixa = carta === null ? undefined : faixa.cartas.find((candidata) => candidata.id === carta.id)
  const quandoDaLinha = new Map(cena.registro.map((linha) => [linha.id, linha.quando]))
  const linhas = linhasDoMestre(cena.registro)
  const registro: LinhaNoEspelho[] = linhas.slice(0, LINHAS_NA_MESA).map((linha) => ({ id: linha.id, rodada: linha.rodada, autor: linha.autor, texto: linha.texto, desfeita: linha.desfeitaPor !== null, podeDesfazer: linha.podeDesfazer }))
  const ultima = linhas.find((linha) => linha.podeDesfazer)
  const vez =
    carta === null
      ? null
      : vezNoEspelho(mesa, turnos, carta, daVezNaFaixa !== undefined && daVezNaFaixa.vida === 'numeros' ? recursos(daVezNaFaixa.recursos) : [], daVezNaFaixa?.equipe ?? null, indiceDaVez + 1, cena.registro)
  return {
    sistema: 'op',
    sceneKey,
    fase: 'combate',
    rodada: turnos.rodada,
    turno: faixa.turno.m === 0 ? null : faixa.turno,
    vez,
    ordem,
    pendentes: pendentes(mesa, turnos, quandoDaLinha),
    registro,
    desfazer: ultima === undefined ? null : { linhaId: ultima.id, texto: ultima.texto },
    podePassar: carta !== null,
    avisoDoEncerrar: 'Encerrar desliga a batalha desta cena e tira as formas de quem lutou. As fichas ficam como estão.',
    avisos: [],
    contra: contraNoEspelho(mesa, turnos),
    ladoNoMapa: ladoDoMouseNaMiraDaMesa(),
    temCaminhos: Object.values(cena.caminhos).some((blocos) => blocos > 0),
    podeOrdenar: turnos.cartas.length > 1,
    // Aberto pela vez do NPC ou pelo contra-ataque dele (que acontece também na vez do jogador): a chave é a da vez de agora.
    menuDoMapaAberto: vez !== null && menuDoMapaAberto(sceneKey, vez.chave),
    chaves: { camera: cameraDaBatalhaLigada(), som: somDoCombateLigado() },
    deixados: [...travasDeixadas()],
  }
}

/** O Encerrar do livro (`ControleDaBatalha`): as formas de quem lutou desligam, um aviso por personagem. */
function encerrarOP(sceneKey: string): RespostaDaMesa {
  const mesa = mesaAgora(sceneKey)
  if (mesa.cena === undefined) return recusa('A batalha desta cena já acabou.')
  const turnos = mesa.cena.turnos
  const ids = [...turnos.cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])), ...Object.keys(turnos.combate ?? {})]
  const sairam = formasQueDesligamNoFim(ids, mesa.personagens, mesa.sistema)
  useBatalhaStore.getState().desligar(sceneKey)
  for (const linha of sairam) useToastStore.getState().push('info', linha)
  return OK
}

/** O pedido do golpe com o de sempre da mira, o ajuste da mesa (Dano base, Surpresa, Perfurante) e o alcance (o lado, o "usar mesmo assim"). */
function acaoDoGolpe(golpe: GolpeNaTela, alvos: readonly string[], ajuste: AjusteDoGolpe | undefined, alcance: AlcanceDoPedido): PedidoDeAcao {
  const comNumero = !golpe.dano.semDano && golpe.dano.valor !== null
  const danoDaFicha = golpe.dano.semDano ? null : (golpe.dano.valor ?? 0)
  const dano = comNumero && ajuste !== undefined && ajuste.dano !== null ? ajuste.dano : danoDaFicha
  const perfurante = ajuste?.perfurante ?? golpe.perfurante
  const selo = golpe.selo === undefined ? null : { nome: golpe.selo.nome, turnos: golpe.selo.turnos, ...(golpe.selo.mods === undefined ? {} : { mods: golpe.selo.mods }) }
  return pedidoDoGolpe(golpe, {
    alvos: golpe.semAlvo === true ? [] : [...new Set(alvos)].map((tokenId) => ({ tokenId, dano })),
    surpresa: ajuste?.surpresa ?? false,
    perfurante,
    perfuracao: perfurante ? golpe.perfuracao : null,
    custo: null,
    acao: null,
    selo,
    ...alcance,
  })
}

/** Item 16: a recusa pelo alcance com a frase do menu da vez; o mesmo pedido com `foraDoAlcance` sai. */
function recusaDoAlcance(quem: string | null, alvos: readonly AlvoNaMira[]): RespostaDaMesa {
  return { ok: false, motivo: textoDoForaDoAlcance(quem, alvos), foraDoAlcance: true }
}

/**
 * Item 16 do levantamento (25/11/2026): o alcance como o menu da vez manda e confere. O lado vai só no golpe
 * que o manda (o que a mesa virou, ou o de abrir); sem a confirmação, quem sai das casas acesas (a conta da
 * mira, com as paredes do mapa do mestre) pede o "usar mesmo assim?" com o nome dele.
 */
function alcanceDoPedido(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[], pedido: { alvos: readonly string[] } & AlcanceDoPedido): { alcance: AlcanceDoPedido; fora: RespostaDaMesa | null } {
  const direcao = mandaOLado(golpe, alvos) ? (pedido.direcao ?? direcaoAoAbrirAMira(golpe, alvos)) : null
  const alcance: AlcanceDoPedido = {}
  if (direcao !== null) alcance.direcao = direcao
  if (pedido.foraDoAlcance === true) {
    alcance.foraDoAlcance = true
    return { alcance, fora: null }
  }
  const marcados = golpe.semAlvo === true ? [] : [...new Set(pedido.alvos)]
  const quem = quemSaiAoMandar(golpe, alvos, { marcados, direcao, ponto: null, centroId: null })
  return { alcance, fora: quem === null ? null : recusaDoAlcance(quem, alvos) }
}

/** A recusa do host; a do alcance (parede ou condição que a conta da mira não viu) abre a mesma pergunta do menu da vez. */
function recusaDoHost(motivo: string, alvos: readonly AlvoNaMira[]): RespostaDaMesa {
  return motivo === MOTIVO_FORA_DO_ALCANCE ? recusaDoAlcance(null, alvos) : recusa(motivo)
}

/** Confere os alvos do pedido contra os da lista; `null` = valem. */
function motivoDosAlvos(golpe: GolpeNaTela, alvos: readonly string[], lista: ReturnType<typeof alvosDaOrdem>): string | null {
  if (golpe.semAlvo === true) return null
  const validos = new Set(lista.filter((alvo) => alvo.motivo === undefined || alvo.motivo === null).map((alvo) => alvo.tokenId))
  if (alvos.length === 0) return 'Escolha ao menos um alvo.'
  if (alvos.some((alvo) => !validos.has(alvo))) return 'Um dos alvos não pode ser escolhido.'
  if (golpe.tetoDeAlvos !== undefined && alvos.length > golpe.tetoDeAlvos) return golpe.tetoDeAlvos === 1 ? `${golpe.nome} acerta um alvo só.` : `${golpe.nome} acerta no máximo ${golpe.tetoDeAlvos} alvos.`
  return null
}

/** O golpe do NPC com o de sempre da mira (o pedido sai pelo mesmo `pedidoDoGolpe` do menu). */
function agirOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'agir' }>): RespostaDaMesa {
  const mesa = mesaAgora(sceneKey)
  const turnos = mesa.cena?.turnos
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  if (turnos === undefined || carta === null || chaveDe(turnos, carta) !== pedido.vez) return recusa('A vez já mudou: confira a ordem.')
  const doNpc = vezDoNpc(mesa, turnos, carta)
  if (doNpc === null) return recusa('A vez não é de um NPC: o jogador age na tela dele.')
  const naFicha = doNpc.golpes.find((candidato) => candidato.chave === pedido.golpe)
  if (naFicha === undefined) return recusa('Esta ação não está mais na ficha.')
  const { golpe, motivo: doCinza } = golpeDoPedido(naFicha, pedido.forcar === true)
  if (golpe === null) return recusa(doCinza)
  const noMapa = porQueNoMapa(golpe, doNpc.alvos)
  if (noMapa !== null) return recusa(noMapa)
  const dosAlvos = motivoDosAlvos(golpe, pedido.alvos, doNpc.alvos)
  if (dosAlvos !== null) return recusa(dosAlvos)
  const { alcance, fora } = alcanceDoPedido(golpe, doNpc.alvos, pedido)
  if (fora !== null) return fora
  const acao = acaoDoGolpe(golpe, pedido.alvos, pedido.ajuste, alcance)
  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const loja = useBatalhaStore.getState()
  const motivo = loja.motivoDoAgir(sceneKey, MESTRE, vez, acao)
  if (motivo !== null) return recusaDoHost(motivo, doNpc.alvos)
  return loja.agir(sceneKey, MESTRE, vez, acao) ? OK : recusa('A regra recusou: confira a ação, o custo e a recarga.')
}

/** 26/11/2026: o Concentrar do NPC da vez pela mesa reduzida: o mesmo `{ tipo: 'concentrar' }` da tira do menu da vez. */
function concentrarOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'concentrar' }>): RespostaDaMesa {
  const mesa = mesaAgora(sceneKey)
  const turnos = mesa.cena?.turnos
  const carta = turnos === undefined ? null : cartaDaVez(turnos)
  if (turnos === undefined || carta === null || chaveDe(turnos, carta) !== pedido.vez) return recusa('A vez já mudou: confira a ordem.')
  if (vezDoNpc(mesa, turnos, carta) === null) return recusa('A vez não é de um NPC: o jogador concentra na tela dele.')
  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const acao: PedidoDeAcao = { tipo: 'concentrar' }
  const loja = useBatalhaStore.getState()
  const motivo = loja.motivoDoAgir(sceneKey, MESTRE, vez, acao)
  if (motivo !== null) return recusa(motivo)
  return loja.agir(sceneKey, MESTRE, vez, acao) ? OK : recusa('Não concentrou: a ação já foi gasta.')
}

/** Os golpes e os alvos da escolha da mesa: a vez do NPC (pela chave da vez) ou o contra-ataque dele; `null` = já passou. */
function escolhaDaMesa(mesa: MesaDaCena, turnos: TurnosDaCena, escolha: MiraDaMesa): { golpes: readonly GolpeNaTela[]; alvos: ReturnType<typeof alvosDaOrdem> } | null {
  if (escolha.tipo === 'vez') {
    const carta = cartaDaVez(turnos)
    const doNpc = carta === null || chaveDe(turnos, carta) !== escolha.id ? null : vezDoNpc(mesa, turnos, carta)
    return doNpc === null ? null : { golpes: doNpc.golpes, alvos: doNpc.alvos }
  }
  const contra = contrasQueSeguramAVez(turnos).find((candidato) => candidato.golpeId === escolha.id)
  const carta = contra === undefined ? undefined : turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId && candidata.bando === undefined)
  return carta === undefined ? null : { golpes: golpesDoContra(mesa, turnos, carta), alvos: alvosDaOrdem(mesa, turnos.cartas, carta) }
}

/** A escolha da mesa no mapa (sobra do alcance): as casas do golpe escolhido acendem como na mira do menu da vez. */
function miraOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'mira' }>): RespostaDaMesa {
  const escolha = pedido.mira
  if (escolha === null) {
    mostrarMiraDaMesa(null)
    return OK
  }
  // A conta com a mesa de AGORA: a mesma no pedido e a cada mudança do mapa (conserto de 25/11: a ficha que anda
  // com a mira no ar leva as casas e as marcas junto; antes a mira ficava na casa de onde a ficha saiu).
  const montar = (): { mira: MiraNoMapa | null } | null => {
    const mesa = mesaAgora(sceneKey)
    const turnos = mesa.cena?.turnos
    const daMesa = turnos === undefined ? null : escolhaDaMesa(mesa, turnos, escolha)
    const golpe = daMesa?.golpes.find((candidato) => candidato.chave === escolha.golpe)
    return daMesa === null || golpe === undefined ? null : { mira: miraDaMesaNoChao(golpe, daMesa.alvos, escolha.alvos, escolha.direcao) }
  }
  const agora = montar()
  if (agora === null) {
    mostrarMiraDaMesa(null)
    return recusa('Esta ação não está mais na ficha.')
  }
  mostrarMiraDaMesa(agora.mira, () => montar()?.mira ?? null)
  return OK
}

/** O contra-ataque do NPC (Q6): o golpe dele fora da vez, com `contraDe`; usado, a vez volta para quem atacou. */
function contraOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'contra' | 'abrirMao' }>): RespostaDaMesa {
  const mesa = mesaAgora(sceneKey)
  const turnos = mesa.cena?.turnos
  const contra = turnos === undefined ? undefined : contrasQueSeguramAVez(turnos).find((candidato) => candidato.golpeId === pedido.golpeId)
  if (turnos === undefined || contra === undefined) return recusa('Este contra-ataque já foi usado.')
  if (!ehDoMestre(contra.personagemId, mesa.personagens)) return recusa('Quem contra-ataca é o jogador, na tela dele.')
  const loja = useBatalhaStore.getState()
  if (pedido.acao === 'abrirMao') {
    const mover: PedidoDeAcao = { tipo: 'mover', contraDe: contra.golpeId }
    const motivo = loja.motivoDoAgir(sceneKey, MESTRE, null, mover)
    if (motivo !== null) return recusa(motivo)
    return loja.agir(sceneKey, MESTRE, null, mover) ? OK : recusa('A regra recusou o Mover do contra-ataque.')
  }
  const carta = turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId && candidata.bando === undefined)
  if (carta === undefined) return recusa('Quem contra-ataca saiu da ordem.')
  const naFicha = golpesDoContra(mesa, turnos, carta).find((candidato) => candidato.chave === pedido.golpe)
  if (naFicha === undefined) return recusa('Esta ação não está mais na ficha.')
  const { golpe, motivo: doCinza } = golpeDoPedido(naFicha, pedido.forcar === true)
  if (golpe === null) return recusa(doCinza)
  const alvos = alvosDaOrdem(mesa, turnos.cartas, carta)
  const noMapa = porQueNoMapa(golpe, alvos)
  if (noMapa !== null) return recusa(noMapa)
  const dosAlvos = motivoDosAlvos(golpe, pedido.alvos, alvos)
  if (dosAlvos !== null) return recusa(dosAlvos)
  const { alcance, fora } = alcanceDoPedido(golpe, alvos, pedido)
  if (fora !== null) return fora
  const golpeDaMira = acaoDoGolpe(golpe, pedido.alvos, pedido.ajuste, alcance)
  if (golpeDaMira.tipo !== 'atacar' && golpeDaMira.tipo !== 'habilidade') return recusa('Esta ação não serve de contra-ataque.')
  const acao: PedidoDeAcao = { ...golpeDaMira, contraDe: contra.golpeId }
  const motivo = loja.motivoDoAgir(sceneKey, MESTRE, null, acao)
  if (motivo !== null) return recusaDoHost(motivo, alvos)
  return loja.agir(sceneKey, MESTRE, null, acao) ? OK : recusa('A regra recusou: confira a ação, o custo e a recarga.')
}

/** A resposta do mestre a um golpe que espera: "Sem reação" antes do dado, "Tomar o golpe" depois (NPC ou jogador que sumiu). */
function responderOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'responder' }>): RespostaDaMesa {
  if (pedido.pendente.startsWith(PREFIXO_DA_AJUDA)) {
    if (pedido.resposta !== RESPOSTA_ACEITA && pedido.resposta !== RESPOSTA_RECUSA) return recusa('Resposta desconhecida.')
    const ajudaId = pedido.pendente.slice(PREFIXO_DA_AJUDA.length)
    const ok = useBatalhaStore.getState().ajuda(sceneKey, MESTRE, { tipo: 'responderAjuda', ajudaId, aceita: pedido.resposta === RESPOSTA_ACEITA })
    return ok ? OK : recusa('O pedido já fechou, venceu o prazo ou não passou mais na regra.')
  }
  const [golpeId, tokenId] = pedido.pendente.split(SEPARA_ID)
  const mesa = mesaAgora(sceneKey)
  const golpe = mesa.cena?.turnos.golpes?.find((candidato) => candidato.id === golpeId)
  const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === tokenId)
  if (golpe === undefined || alvo === undefined || alvo.danoFinal !== undefined) return recusa('Esta reação já foi resolvida.')
  if (pedido.resposta !== 'naoReagir' && pedido.resposta !== 'passar') return recusa('Resposta desconhecida.')
  if (pedido.resposta === 'naoReagir' && alvo.rolagem !== undefined) return recusa('O dado já rolou: escolha o que ele liberou na carta REAÇÃO, ou tome o golpe.')
  const ok = useBatalhaStore.getState().reagir(sceneKey, MESTRE, { tipo: pedido.resposta, golpeId: golpe.id, tokenId: alvo.tokenId })
  return ok ? OK : recusa('A regra recusou a resposta.')
}

/** Um item do menu da carta, remontado com a batalha de agora (o mesmo menu da faixa do mestre). */
function itemDaCartaOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'itemDaCarta' }>): RespostaDaMesa {
  const mesa = mesaAgora(sceneKey)
  if (mesa.cena === undefined) return recusa('A batalha desta cena já acabou.')
  const { turnos } = mesa.cena
  const dados = faixaDoMestre({ turnos, fichas: mesa.fichas, personagens: mesa.personagens, equipes: mesa.equipes, sistema: mesa.sistema, registro: mesa.cena.registro })
  const carta = dados.cartas.find((candidata) => candidata.id === pedido.cartaId)
  if (carta === undefined) return recusa('Esta carta não está mais na ordem.')
  return escolherItemDaCarta(itensDaCartaDoMestre(carta, { sceneKey, dados, turnos, personagens: mesa.personagens, equipes: mesa.equipes ?? [], sistema: mesa.sistema }), pedido.item)
}

/** Aplica um pedido da mesa na batalha One Piece da cena. */
export function aplicarPedidoOP(pedido: PedidoDaMesa): RespostaDaMesa {
  const { sceneKey } = pedido
  const loja = useBatalhaStore.getState()
  if (!Object.hasOwn(loja.cenas, sceneKey)) return recusa('A batalha desta cena já acabou.')
  const turnos = loja.cenas[sceneKey].turnos
  switch (pedido.acao) {
    case 'passar': {
      const carta = cartaDaVez(turnos)
      if (carta === null || chaveDe(turnos, carta) !== pedido.vez) return recusa('A vez já mudou: confira a ordem.')
      return loja.passarVez(sceneKey, MESTRE, { cartaId: carta.id, rodada: turnos.rodada }) ? OK : recusa('A vez não passou: ela já tinha andado.')
    }
    case 'darVez':
      return loja.darVez(sceneKey, pedido.cartaId) ? OK : recusa('Esta carta não está mais na ordem.')
    case 'itemDaCarta':
      return itemDaCartaOP(sceneKey, pedido)
    case 'agir':
      return agirOP(sceneKey, pedido)
    case 'contra':
    case 'abrirMao':
      return contraOP(sceneKey, pedido)
    case 'responder':
      return responderOP(sceneKey, pedido)
    case 'desfazer':
      return loja.desfazer(sceneKey, pedido.linhaId, MESTRE) ? OK : recusa('Esta linha não se desfaz mais.')
    case 'iniciativa':
      return recusa('No One Piece a ordem sai da Agilidade: não há iniciativa a rolar.')
    case 'ordenar':
      return loja.ordenarPelaAgilidade(sceneKey) ? OK : recusa('A ordem já está pela Agilidade.')
    case 'zerarCaminhos':
      loja.zerarCaminhos(sceneKey)
      return OK
    case 'menuDoMapa': {
      const carta = cartaDaVez(turnos)
      if (pedido.ligar && carta === null) return recusa('Sem vez agora.')
      // 26/11/2026: com `tela`, o menu abre já na Transformação, nas Passivas ou nos Itens (a mesa reduzida).
      ligarOMenuDoMapa(sceneKey, pedido.ligar && carta !== null ? chaveDe(turnos, carta) : null, pedido.tela)
      return OK
    }
    case 'concentrar':
      return concentrarOP(sceneKey, pedido)
    case 'abrirLivro':
      return recusa('O livro abre pela janela principal.')
    case 'chave':
      // As mesmas chaves do painel da batalha (`ChavesDoCombate`), guardadas neste computador.
      if (pedido.chave === 'camera') ligarCameraDaBatalha(pedido.ligar)
      else ligarSomDoCombate(pedido.ligar)
      return OK
    case 'seguir':
      // O "Seguir sem esperar" da mesa vale também no menu da vez no meio do mapa, no painel e na faixa (`travaDoPassar`).
      deixarParaDepois(pedido.chaves)
      return OK
    case 'encerrar':
      return encerrarOP(sceneKey)
    case 'mira':
      return miraOP(sceneKey, pedido)
  }
}
