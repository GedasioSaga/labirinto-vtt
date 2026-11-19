import { chaveDaVez, type PedidoDeAcao } from '../lib/batalha/combate'
import { travaDoToken } from '../lib/batalha/condicoes'
import { acoesDaCarta, sugestaoParaNpc } from '../lib/batalha/golpe'
import type { LinhaDoRegistro, TipoDaLinha } from '../lib/batalha/registro'
import { danoFinal } from '../lib/batalha/reacao'
import { bonusDaBatalha } from '../lib/batalha/selos'
import { formasQueDesligamNoFim } from '../lib/batalha/transformacao'
import { cartaDaVez, contrasQueSeguramAVez, tokensCaidos, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../lib/batalha/turnos'
import { ehDoMestre, golpesDaVezDoNpc, mesaAgora, sugestaoNaTela, type MesaDaCena } from '../components/batalha/BatalhaDoMestre'
import { faixaDoMestre, linhasDoMestre, type RecursoNaCarta } from '../components/batalha/dadosDaFaixa'
import { armaPadraoNaBatalha, economiaEmTexto, formatarNumero, golpesDeAtaque, golpesDeHabilidade, pipsDaVez, type GolpeNaTela } from '../components/batalha/dadosDoMenu'
import { itensDaCartaDoMestre } from '../components/batalha/menuDaCartaDoMestre'
import { alvosDaOrdem, nomeDaFicha } from '../components/batalha/mesaDoMestre'
import { deixarParaDepois, deveAReacao, travasDeixadas } from '../components/batalha/travaDoPassar'
import { pedidoDoGolpe } from '../components/batalha/MiraDoGolpe'
import { ligarSomDoCombate, somDoCombateLigado } from '../lib/sons/sonsDoCombate'
import { cameraDaBatalhaLigada, ligarCameraDaBatalha } from '../pixi/cameraDaBatalha'
import { useBatalhaStore } from '../stores/batalhaStore'
import { useToastStore } from '../stores/toastStore'
import { escolherItemDaCarta, itensNoEspelho } from './menuDaCartaNoEspelho'
import { ligarOMenuDoMapa, menuDoMapaAberto } from './telaDaMesa'
import type { AjusteDoGolpe, AlvoNoEspelho, CartaNoEspelho, ContraNoEspelho, EspelhoDaBatalha, GolpeNoEspelho, LinhaNoEspelho, PedidoDaMesa, PendenteNoEspelho, RecursoNoEspelho, RespostaDaMesa, VezNoEspelho } from './tipos'

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
function porQueNoMapa(golpe: GolpeNaTela): string | null {
  if (golpe.invocacao === true) return 'Invocação: escolha a opção e o lugar pelo menu do mapa.'
  if (golpe.acao === 'passiva') return 'Passiva: não se lança.'
  if (golpe.custo.tipo === 'pergunta') return `Pede o custo à mão (${golpe.custo.texto}): use o menu do mapa.`
  if (golpe.acao === null) return 'A ficha não diz a ação: escolha pelo menu do mapa.'
  if ((golpe.opcoes?.length ?? 0) > 0) return 'Tem opções para escolher: use o menu do mapa.'
  if ((golpe.perguntas?.length ?? 0) > 0) return 'Faz perguntas na hora: use o menu do mapa.'
  if ((golpe.armas?.length ?? 0) > 1) return 'Pede a arma: use o menu do mapa.'
  if ((golpe.balas?.length ?? 0) > 0 || golpe.exigeMunicao === true) return 'Pede a bala: use o menu do mapa.'
  if (golpe.area !== undefined || golpe.areaPelaGrade === true) return 'Marca a área no mapa: use o menu do mapa.'
  if (golpe.dano.valor === null && !golpe.dano.semDano && golpe.dano.pelaVida !== true) return 'O dano é à mão: use o menu do mapa.'
  return null
}

function detalheDoGolpe(golpe: GolpeNaTela): string {
  const dano = golpe.dano.semDano ? 'sem dano' : golpe.dano.valor === null ? 'dano pela vida' : `dano ${formatarNumero(golpe.dano.valor)}`
  return [golpe.acaoTexto, dano, golpe.custoTexto, golpe.tempoTexto].filter((parte): parte is string => typeof parte === 'string' && parte !== '').join(' · ')
}

function golpeNoEspelho(golpe: GolpeNaTela): GolpeNoEspelho {
  const teto = golpe.semAlvo === true ? 0 : (golpe.tetoDeAlvos ?? golpe.divide ?? 8)
  const comNumero = !golpe.dano.semDano && golpe.dano.valor !== null
  return {
    chave: golpe.chave,
    nome: golpe.nome,
    detalhe: detalheDoGolpe(golpe),
    motivo: golpe.motivo,
    noMapa: golpe.motivo === null ? porQueNoMapa(golpe) : null,
    alvo: golpe.semAlvo === true ? 'nenhum' : teto === 1 ? 'um' : 'varios',
    alvosMax: teto,
    alvosPermitidos: null,
    dano: comNumero ? golpe.dano.valor : null,
    perfurante: golpe.perfurante,
    ajustavel: comNumero,
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
}

/** Os golpes e os alvos da vez do NPC, lidos como o menu do centro os lê; `null` = a vez não é de NPC. */
function vezDoNpc(mesa: MesaDaCena, turnos: TurnosDaCena, carta: CartaDaOrdem): VezDoNpc | null {
  const { cena, personagens, sistema } = mesa
  if (cena === undefined || carta.bando !== undefined || !ehDoMestre(carta.personagemId, personagens)) return null
  const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena.regras })
  const { trava, habilidades, armas } = golpesDaVezDoNpc(mesa, turnos, carta, personagem, acoes)
  return { carta, golpes: [...habilidades, ...armas], alvos: alvosDaOrdem(mesa, turnos.cartas, carta), trava }
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
    return { ...base, npc: true, descricao: 'Bando de invocados', golpes: [], alvos: [], aviso: 'A vez do bando (cada invocado age) fica na página Batalha do livro. Daqui dá para passar a vez.' }
  }
  const doNpc = vezDoNpc(mesa, turnos, carta)
  if (doNpc === null) {
    return { ...base, npc: false, descricao: equipe === null ? 'Jogador' : `Jogador · ${equipe}`, golpes: [], alvos: [], aviso: `${quem} joga na tela própria. Daqui você passa a vez, desfaz e responde às reações.` }
  }
  const sugestao = personagem === null || cena === undefined ? null : sugestaoParaNpc(personagem, cena, { personagens, sistema, equipes, caidos: tokensCaidos(turnos.cartas, personagens, sistema) })
  const naTela = sugestaoNaTela(sugestao)
  const economia = acoes === null ? '' : economiaEmTexto(acoes)
  return {
    ...base,
    npc: true,
    descricao: [equipe === null ? 'NPC' : `NPC · ${equipe}`, base.pips.length === 0 ? economia : ''].filter((parte) => parte !== '').join(' · '),
    golpes: doNpc.golpes.map(golpeNoEspelho),
    alvos: alvosNoEspelho(doNpc.alvos),
    sugestao: { golpe: naTela.chave, alvo: naTela.alvoTokenId },
    aviso: doNpc.trava ?? (doNpc.golpes.length === 0 ? 'Sem técnica nem arma na ficha: passe a vez ou dê dano pelo livro.' : null),
    menuDoMapa: true,
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
  return itens
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
  return {
    golpeId: contra.golpeId,
    quem: nomeDaFicha(mesa, contra.tokenId, carta),
    de: nomeDaFicha(mesa, contra.atacanteTokenId),
    doMestre,
    desde: contraVistoEm.get(contra.golpeId) ?? null,
    golpes: comMenu ? golpesDoContra(mesa, turnos, carta).map(golpeNoEspelho) : [],
    alvos: comMenu ? alvosNoEspelho(alvosDaOrdem(mesa, turnos.cartas, carta)) : [],
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

/** O pedido do golpe com o de sempre da mira e o ajuste da mesa (Dano base, Surpresa, Perfurante). */
function acaoDoGolpe(golpe: GolpeNaTela, alvos: readonly string[], ajuste: AjusteDoGolpe | undefined): PedidoDeAcao {
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
  })
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
  const golpe = doNpc.golpes.find((candidato) => candidato.chave === pedido.golpe)
  if (golpe === undefined) return recusa('Esta ação não está mais na ficha.')
  if (golpe.motivo !== null) return recusa(golpe.motivo)
  const noMapa = porQueNoMapa(golpe)
  if (noMapa !== null) return recusa(noMapa)
  const dosAlvos = motivoDosAlvos(golpe, pedido.alvos, doNpc.alvos)
  if (dosAlvos !== null) return recusa(dosAlvos)
  const acao = acaoDoGolpe(golpe, pedido.alvos, pedido.ajuste)
  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const loja = useBatalhaStore.getState()
  const motivo = loja.motivoDoAgir(sceneKey, MESTRE, vez, acao)
  if (motivo !== null) return recusa(motivo)
  return loja.agir(sceneKey, MESTRE, vez, acao) ? OK : recusa('A regra recusou: confira a ação, o custo e a recarga.')
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
  const golpe = golpesDoContra(mesa, turnos, carta).find((candidato) => candidato.chave === pedido.golpe)
  if (golpe === undefined) return recusa('Esta ação não está mais na ficha.')
  if (golpe.motivo !== null) return recusa(golpe.motivo)
  const noMapa = porQueNoMapa(golpe)
  if (noMapa !== null) return recusa(noMapa)
  const dosAlvos = motivoDosAlvos(golpe, pedido.alvos, alvosDaOrdem(mesa, turnos.cartas, carta))
  if (dosAlvos !== null) return recusa(dosAlvos)
  const golpeDaMira = acaoDoGolpe(golpe, pedido.alvos, pedido.ajuste)
  if (golpeDaMira.tipo !== 'atacar' && golpeDaMira.tipo !== 'habilidade') return recusa('Esta ação não serve de contra-ataque.')
  const acao: PedidoDeAcao = { ...golpeDaMira, contraDe: contra.golpeId }
  const motivo = loja.motivoDoAgir(sceneKey, MESTRE, null, acao)
  if (motivo !== null) return recusa(motivo)
  return loja.agir(sceneKey, MESTRE, null, acao) ? OK : recusa('A regra recusou: confira a ação, o custo e a recarga.')
}

/** A resposta do mestre a um golpe que espera: "Sem reação" antes do dado, "Tomar o golpe" depois (NPC ou jogador que sumiu). */
function responderOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'responder' }>): RespostaDaMesa {
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
      ligarOMenuDoMapa(sceneKey, pedido.ligar && carta !== null ? chaveDe(turnos, carta) : null)
      return OK
    }
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
  }
}
