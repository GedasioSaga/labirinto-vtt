import { chaveDaVez, type PedidoDeAcao } from '../lib/batalha/combate'
import { acoesDaCarta, sugestaoParaNpc } from '../lib/batalha/golpe'
import { formasQueDesligamNoFim } from '../lib/batalha/transformacao'
import { cartaDaVez, tokensCaidos, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../lib/batalha/turnos'
import { ehDoMestre, golpesDaVezDoNpc, mesaAgora, sugestaoNaTela, type MesaDaCena } from '../components/batalha/BatalhaDoMestre'
import { faixaDoMestre, linhasDoMestre, type RecursoNaCarta } from '../components/batalha/dadosDaFaixa'
import { economiaEmTexto, formatarNumero, type GolpeNaTela } from '../components/batalha/dadosDoMenu'
import { alvosDaOrdem, nomeDaFicha } from '../components/batalha/mesaDoMestre'
import { pedidoDoGolpe } from '../components/batalha/MiraDoGolpe'
import { useBatalhaStore } from '../stores/batalhaStore'
import { useToastStore } from '../stores/toastStore'
import type { AlvoNoEspelho, CartaNoEspelho, EspelhoDaBatalha, GolpeNoEspelho, LinhaNoEspelho, PedidoDaMesa, PendenteNoEspelho, RecursoNoEspelho, RespostaDaMesa, VezNoEspelho } from './tipos'

/**
 * A MESA DA BATALHA no One Piece: o espelho lido das stores (as mesmas leituras
 * da página Batalha e do menu do centro: `faixaDoMestre`, `golpesDaVezDoNpc`,
 * `alvosDaOrdem`, `linhasDoMestre`) e os pedidos aplicados pelas mesmas ações da
 * `batalhaStore` que o livro chama, sempre como o mestre.
 */

const MESTRE: AutorDaAcao = { tipo: 'mestre' }
/** O registro na tela: as mais novas (o livro tem o inteiro). */
const LINHAS_NA_MESA = 60
const SEPARA_ID = '|'

const recusa = (motivo: string): RespostaDaMesa => ({ ok: false, motivo })
const OK: RespostaDaMesa = { ok: true, motivo: null }

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
  return {
    chave: golpe.chave,
    nome: golpe.nome,
    detalhe: detalheDoGolpe(golpe),
    motivo: golpe.motivo,
    noMapa: golpe.motivo === null ? porQueNoMapa(golpe) : null,
    alvo: golpe.semAlvo === true ? 'nenhum' : teto === 1 ? 'um' : 'varios',
    alvosMax: teto,
    alvosPermitidos: null,
  }
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

function vezNoEspelho(mesa: MesaDaCena, turnos: TurnosDaCena, carta: CartaDaOrdem, recursosDaVez: readonly RecursoNoEspelho[], equipe: string | null): VezNoEspelho {
  const quem = nomeDaFicha(mesa, carta.tokenId, carta)
  const base = { chave: chaveDe(turnos, carta), quem, recursos: recursosDaVez, sugestao: { golpe: null, alvo: null } }
  if (carta.bando !== undefined) {
    return { ...base, npc: true, descricao: 'Bando de invocados', golpes: [], alvos: [], aviso: 'A vez do bando (cada invocado age) fica na página Batalha do livro. Daqui dá para passar a vez.' }
  }
  const doNpc = vezDoNpc(mesa, turnos, carta)
  if (doNpc === null) {
    return { ...base, npc: false, descricao: equipe === null ? 'Jogador' : `Jogador · ${equipe}`, golpes: [], alvos: [], aviso: `A vez de ${quem} é do jogador, que escolhe na tela própria. Daqui você passa a vez, desfaz e responde às reações.` }
  }
  const { cena, personagens, sistema, equipes } = mesa
  const personagem = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena?.regras ?? null })
  const sugestao = personagem === null || cena === undefined ? null : sugestaoParaNpc(personagem, cena, { personagens, sistema, equipes, caidos: tokensCaidos(turnos.cartas, personagens, sistema) })
  const naTela = sugestaoNaTela(sugestao)
  const alvos: AlvoNoEspelho[] = doNpc.alvos.map((alvo) => ({ id: alvo.tokenId, nome: alvo.nome, lado: alvo.lado, caiu: alvo.caiu, motivo: alvo.motivo ?? null, detalhe: null }))
  const economia = economiaEmTexto(acoes)
  return {
    ...base,
    npc: true,
    descricao: [equipe === null ? 'NPC' : `NPC · ${equipe}`, economia].filter((parte) => parte !== '').join(' · '),
    golpes: doNpc.golpes.map(golpeNoEspelho),
    alvos,
    sugestao: { golpe: naTela.chave, alvo: naTela.alvoTokenId },
    aviso: doNpc.trava ?? (doNpc.golpes.length === 0 ? 'Sem técnica nem arma na ficha: passe a vez ou dê dano pelo livro.' : null),
  }
}

function pendentes(mesa: MesaDaCena, turnos: TurnosDaCena, quandoDaLinha: ReadonlyMap<string, number>): PendenteNoEspelho[] {
  const itens: PendenteNoEspelho[] = []
  for (const golpe of turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (alvo.danoFinal !== undefined || !alvo.podeReagir) continue
      const doMestre = ehDoMestre(alvo.personagemId, mesa.personagens)
      const nomeDoAlvo = nomeDaFicha(mesa, alvo.tokenId)
      const dano = alvo.dano === null ? '' : ` (${formatarNumero(alvo.dano)})`
      itens.push({
        id: `${golpe.id}${SEPARA_ID}${alvo.tokenId}`,
        titulo: `${golpe.nome} de ${nomeDaFicha(mesa, golpe.atacanteTokenId)} em ${nomeDoAlvo}${dano}`,
        quem: doMestre ? 'Você (NPC)' : `${nomeDoAlvo} (jogador)`,
        doMestre,
        desde: quandoDaLinha.get(golpe.linhaId) ?? null,
        ativa: true,
        respostas: doMestre ? [alvo.rolagem === undefined ? { chave: 'naoReagir', rotulo: 'Não reagir', bloqueio: null } : { chave: 'passar', rotulo: 'Tomar o golpe', bloqueio: null }] : [],
        nota: doMestre ? 'Rolar esquiva ou defesa: na carta REAÇÃO do mapa.' : null,
      })
    }
  }
  return itens
}

/** O espelho da batalha One Piece da cena; `null` = a cena não está nela. */
export function espelhoOP(sceneKey: string): EspelhoDaBatalha | null {
  const mesa = mesaAgora(sceneKey)
  const { cena } = mesa
  if (cena === undefined) return null
  const { turnos } = cena
  const faixa = faixaDoMestre({ turnos, fichas: mesa.fichas, personagens: mesa.personagens, equipes: mesa.equipes, sistema: mesa.sistema, registro: cena.registro })
  const ordem: CartaNoEspelho[] = faixa.cartas.map((carta) => {
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
    }
  })
  const carta = cartaDaVez(turnos)
  const daVez = carta === null ? undefined : faixa.cartas.find((candidata) => candidata.id === carta.id)
  const quandoDaLinha = new Map(cena.registro.map((linha) => [linha.id, linha.quando]))
  const linhas = linhasDoMestre(cena.registro)
  const registro: LinhaNoEspelho[] = linhas.slice(0, LINHAS_NA_MESA).map((linha) => ({ id: linha.id, rodada: linha.rodada, autor: linha.autor, texto: linha.texto, desfeita: linha.desfeitaPor !== null, podeDesfazer: linha.podeDesfazer }))
  const ultima = linhas.find((linha) => linha.podeDesfazer)
  return {
    sistema: 'op',
    sceneKey,
    fase: 'combate',
    rodada: turnos.rodada,
    turno: faixa.turno.m === 0 ? null : faixa.turno,
    vez: carta === null ? null : vezNoEspelho(mesa, turnos, carta, daVez !== undefined && daVez.vida === 'numeros' ? recursos(daVez.recursos) : [], daVez?.equipe ?? null),
    ordem,
    pendentes: pendentes(mesa, turnos, quandoDaLinha),
    registro,
    desfazer: ultima === undefined ? null : { linhaId: ultima.id, texto: ultima.texto },
    podePassar: carta !== null,
    avisoDoEncerrar: 'Encerrar desliga a batalha desta cena e tira as formas de quem lutou. As fichas ficam como estão.',
    avisos: [],
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
  const validos = new Set(doNpc.alvos.filter((alvo) => alvo.motivo === undefined || alvo.motivo === null).map((alvo) => alvo.tokenId))
  if (golpe.semAlvo !== true) {
    if (pedido.alvos.length === 0) return recusa('Escolha ao menos um alvo.')
    if (pedido.alvos.some((alvo) => !validos.has(alvo))) return recusa('Um dos alvos não pode ser escolhido.')
    if (golpe.tetoDeAlvos !== undefined && pedido.alvos.length > golpe.tetoDeAlvos) return recusa(golpe.tetoDeAlvos === 1 ? `${golpe.nome} acerta um alvo só.` : `${golpe.nome} acerta no máximo ${golpe.tetoDeAlvos} alvos.`)
  }
  const dano = golpe.dano.semDano ? null : (golpe.dano.valor ?? 0)
  const selo = golpe.selo === undefined ? null : { nome: golpe.selo.nome, turnos: golpe.selo.turnos, ...(golpe.selo.mods === undefined ? {} : { mods: golpe.selo.mods }) }
  const acao: PedidoDeAcao = pedidoDoGolpe(golpe, {
    alvos: golpe.semAlvo === true ? [] : [...new Set(pedido.alvos)].map((tokenId) => ({ tokenId, dano })),
    surpresa: false,
    perfurante: golpe.perfurante,
    perfuracao: golpe.perfurante ? golpe.perfuracao : null,
    custo: null,
    acao: null,
    selo,
  })
  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const loja = useBatalhaStore.getState()
  const motivo = loja.motivoDoAgir(sceneKey, MESTRE, vez, acao)
  if (motivo !== null) return recusa(motivo)
  return loja.agir(sceneKey, MESTRE, vez, acao) ? OK : recusa('A regra recusou: confira a ação, o custo e a recarga.')
}

/** A reação do NPC daqui: só o "não reagir" (antes do dado) ou o "tomar o golpe" (depois dele). */
function responderOP(sceneKey: string, pedido: Extract<PedidoDaMesa, { acao: 'responder' }>): RespostaDaMesa {
  const [golpeId, tokenId] = pedido.pendente.split(SEPARA_ID)
  const mesa = mesaAgora(sceneKey)
  const golpe = mesa.cena?.turnos.golpes?.find((candidato) => candidato.id === golpeId)
  const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === tokenId)
  if (golpe === undefined || alvo === undefined || alvo.danoFinal !== undefined) return recusa('Esta reação já foi resolvida.')
  if (!ehDoMestre(alvo.personagemId, mesa.personagens)) return recusa('Quem reage é o jogador, na tela dele.')
  if (pedido.resposta !== 'naoReagir' && pedido.resposta !== 'passar') return recusa('Resposta desconhecida.')
  const ok = useBatalhaStore.getState().reagir(sceneKey, MESTRE, { tipo: pedido.resposta, golpeId: golpe.id, tokenId: alvo.tokenId })
  return ok ? OK : recusa('A regra recusou a resposta.')
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
    case 'agir':
      return agirOP(sceneKey, pedido)
    case 'responder':
      return responderOP(sceneKey, pedido)
    case 'desfazer':
      return loja.desfazer(sceneKey, pedido.linhaId, MESTRE) ? OK : recusa('Esta linha não se desfaz mais.')
    case 'iniciativa':
      return recusa('No One Piece a ordem sai da Agilidade: não há iniciativa a rolar.')
    case 'encerrar':
      return encerrarOP(sceneKey)
  }
}
