/**
 * O Desfazer da batalha One Piece: volta a reversão de uma linha (turnos, fichas, mapa) e diz o que vem
 * junto (as linhas da decisão, os golpes e os contra-ataques que a linha abriu).
 */
import { FORMAS_PENDENTES_MAX, INVOCACOES_PENDENTES_MAX } from '../../lib/batalha/combate'
import { invocadoDoToken, lerInvocacao, opcaoDaInvocacao, pendenciaPorId, quantosNoCampo, ultraEmCampo } from '../../lib/batalha/invocacao'
import { marcaDoToken } from '../../lib/batalha/marca'
import { cartaoAindaComADecisao, cartaoPorId, comCartaoTrocado } from '../../lib/batalha/mecanica/formaDoMestre'
import { tecnicaPorId } from '../../lib/batalha/leituraDaFicha'
import { devolverMunicaoNaFicha, fichaComAMochilaDoBoneco } from '../../lib/batalha/municaoDaFicha'
import { desfazerMochilaNaMesa, devolverAoPenteNaMesa } from './recargaDoPente'
import { comCondicoesNaFicha, condicoesDe } from '../../lib/condicoes/naFicha'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import {
  desfazerFicha,
  ehPersonagemDeInvocado,
  invocadoSaiuPorLinha,
  linhaDesfeita,
  reverterTurnos,
  vezSemOsSelosDesfeitos,
  type LinhaDoRegistro,
  type Reversao,
} from '../../lib/batalha/registro'
import type { AutorDaAcao } from '../../lib/batalha/turnos'
import { NOME_DO_MESTRE } from '../../lib/ajusteDaFicha'
import { comAsMarcasDeOcultaDe } from '../../lib/habilidadeOculta'
import { comCondicoes } from '../../lib/turnoForaDaBatalha'
import type { BatalhaDaCena } from './tipos'
import { trocarEquipeNaMesa, tirarDoMapa } from './naMesa'

/** O nome que vai no histórico da ficha ao desfazer: diferente do autor, para o `registrar` não fundir e apagar a linha velha. */
function quemDesfezNaFicha(autor: AutorDaAcao): string {
  return `${autor.tipo === 'mestre' ? NOME_DO_MESTRE : autor.nome} (desfez)`
}

/** O que o Desfazer fez com uma reversão: a cena nova, se voltou só em parte, e se deu. */
interface Desfeito {
  cena: BatalhaDaCena
  emParte: boolean
  ok: boolean
}

/** As partes de uma reversão, abrindo as compostas. */
function partesSoltas(reversao: Reversao): Reversao[] {
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(partesSoltas) : [reversao]
}

/**
 * Construtor C6: as linhas de pé em que o mestre decidiu uma forma pedida na
 * reversão `doPedido`, da mais nova para a mais velha. Nenhuma = a linha não é
 * pedido de forma, ou o mestre ainda não decidiu.
 */
export function linhasDaDecisaoDe(registro: readonly LinhaDoRegistro[], doPedido: Reversao): string[] {
  const pedidas = new Set(partesSoltas(doPedido).flatMap((parte) => (parte.tipo === 'formaPedida' ? [parte.pendente.id] : [])))
  if (pedidas.size === 0) return []
  return registro
    .filter((linha) => linha.desfeita === undefined && partesSoltas(linha.reversao).some((parte) => parte.tipo === 'formaDecidida' && pedidas.has(parte.pendente.id)))
    .map((linha) => linha.id)
    .reverse()
}

/** Desfaz a reversão: a ordem na própria cena; ficha e equipe pela mesa (a aventura); regras na cópia; o invocado pela mesa (mapa e aventura). */
export function desfazerReversao(mesa: MesaDaBatalha, sceneKey: string, cena: BatalhaDaCena, reversao: Reversao, autor: AutorDaAcao): Desfeito {
  switch (reversao.tipo) {
    case 'ficha': {
      const sistema = mesa.sistema()
      if (sistema === null) return { cena, emParte: false, ok: false }
      // Invocação: o personagem temporário que já saiu do mapa não volta por aqui; o resto da linha volta ("em parte").
      if (!mesa.personagens().some((personagem) => personagem.id === reversao.personagemId) && ehPersonagemDeInvocado(cena.registro, reversao.personagemId)) {
        return { cena, emParte: true, ok: true }
      }
      let emParte = false
      const ok = mesa.ajustarPersonagem(reversao.personagemId, (atual) => {
        const feito = desfazerFicha(atual, sistema, reversao.partes, quemDesfezNaFicha(autor), Date.now())
        emParte = feito.emParte
        return feito.personagem
      })
      return { cena, emParte, ok }
    }
    case 'equipe': {
      const ok = trocarEquipeNaMesa(mesa, reversao.personagemId, reversao.antes)
      return { cena, emParte: false, ok }
    }
    case 'regras':
      return { cena: { ...cena, regras: reversao.antes }, emParte: false, ok: true }
    case 'prazo': {
      // Fase C: as condições da ficha voltam como estavam antes do desconto (a ficha fora de alcance fica: "em parte").
      const { antes, tokenId } = reversao
      const ficha = mesa.fichaDaCena?.(sceneKey, tokenId) ?? null
      if (mesa.mudarFichaDaCena === undefined || ficha === null) return { cena, emParte: true, ok: true }
      mesa.mudarFichaDaCena(sceneKey, tokenId, (token) => comCondicoes(token, antes))
      return { cena, emParte: false, ok: true }
    }
    case 'reacaoComTecnica': {
      // A linha do golpe já desfeita: o golpe não volta a esperar (o resto da reação, custo e selos, volta pelas outras partes).
      const linhaDoGolpe = cena.registro.find((linha) => linha.id === reversao.golpe.linhaId)
      if (linhaDoGolpe?.desfeita !== undefined) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'composta': {
      let atual = cena
      let emParte = false
      let ok = true
      // Da última parte para a primeira, como foram feitas ao contrário. C6: a pendência da forma decidida volta
      // por último, depois que a ficha desligou a forma (ela só volta a esperar o mestre com a forma desligada).
      const deTrasParaFrente = [...reversao.partes].reverse()
      const naOrdem = [...deTrasParaFrente.filter((parte) => parte.tipo !== 'formaDecidida'), ...deTrasParaFrente.filter((parte) => parte.tipo === 'formaDecidida')]
      for (const parte of naOrdem) {
        const feito = desfazerReversao(mesa, sceneKey, atual, parte, autor)
        atual = feito.cena
        emParte = emParte || feito.emParte
        ok = ok && feito.ok
      }
      return { cena: atual, emParte, ok }
    }
    case 'invocacaoPedida': {
      // A pendência sai; se o mestre já a pôs no mapa, o invocado que veio dela também (decisão 11).
      const { pendente } = reversao
      let turnos = cena.turnos
      const invocacoes = (turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id)
      if (invocacoes.length !== (turnos.invocacoes?.length ?? 0)) turnos = { ...turnos, invocacoes }
      const veio = (turnos.invocados ?? []).find((invocado) => invocado.pedidoId === pendente.id)
      if (veio !== undefined) turnos = tirarDoMapa(mesa, sceneKey, turnos, veio).turnos
      return { cena: { ...cena, turnos }, emParte: false, ok: true }
    }
    case 'invocacaoColocada': {
      // O invocado sai (se ainda está) e a pendência volta a esperar, se o pedido não foi desfeito.
      const { pendente, invocado } = reversao
      let turnos = cena.turnos
      const emCampo = invocadoDoToken(turnos, invocado.tokenId) !== null
      if (emCampo) turnos = tirarDoMapa(mesa, sceneKey, turnos, invocado).turnos
      // Já saiu por outra linha de pé (HP 0, o Ultra): a pendência não volta (passaria do máximo e "ressuscitaria" com HP cheio).
      const saiuPorOutraLinha = !emCampo && invocadoSaiuPorLinha(cena.registro, invocado.tokenId)
      if (!saiuPorOutraLinha && !linhaDesfeita(cena.registro, pendente.linhaId) && pendenciaPorId(turnos, pendente.id) === null) turnos = { ...turnos, invocacoes: [...(turnos.invocacoes ?? []), pendente] }
      return { cena: { ...cena, turnos }, emParte: false, ok: true }
    }
    case 'invocacaoCancelada': {
      // A pendência volta só se ainda cabe: no teto, no máximo da opção (um pedido novo pode ter tomado o lugar) e sem o Ultra em campo.
      const { pendente } = reversao
      const { turnos } = cena
      const dono = mesa.personagens().find((personagem) => personagem.id === pendente.donoPersonagemId)
      const sistema = mesa.sistema()
      const achada = dono === undefined || sistema === null ? null : tecnicaPorId(dono, sistema, pendente.cartaoId)
      const leitura = achada === null ? null : lerInvocacao(achada.cartao)
      const maximo = leitura === null ? null : (opcaoDaInvocacao(leitura, pendente.opcao)?.maximo ?? null)
      const cabe =
        pendenciaPorId(turnos, pendente.id) === null &&
        (turnos.invocacoes?.length ?? 0) < INVOCACOES_PENDENTES_MAX &&
        (maximo === null || quantosNoCampo(turnos, pendente.donoPersonagemId, pendente.cartaoId, pendente.opcao) < maximo) &&
        !ultraEmCampo(turnos, pendente)
      if (!cabe) return { cena, emParte: true, ok: true }
      return { cena: { ...cena, turnos: { ...turnos, invocacoes: [...(turnos.invocacoes ?? []), pendente] } }, emParte: false, ok: true }
    }
    case 'formaPedida': {
      // C6: a pendência sai (a linha da decisão, se houve, já foi desfeita antes pela store).
      const formasPendentes = (cena.turnos.formasPendentes ?? []).filter((candidata) => candidata.id !== reversao.pendente.id)
      if (formasPendentes.length === (cena.turnos.formasPendentes?.length ?? 0)) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: { ...cena.turnos, formasPendentes } }, emParte: false, ok: true }
    }
    case 'formaDecidida': {
      // C6: a pendência volta a esperar o mestre, só se o pedido segue de pé, ela não está lá, cabe no teto e a forma
      // está desligada (Desfazer fora de ordem: outra decisão já a ligou, e "decidir" daria "já está ligada").
      const { pendente } = reversao
      const lista = cena.turnos.formasPendentes ?? []
      const ligada = mesa.personagens().find((personagem) => personagem.id === pendente.personagemId)?.cartoesAtivos.includes(pendente.cartaoId) === true
      const volta = !ligada && !linhaDesfeita(cena.registro, pendente.linhaId) && !lista.some((candidata) => candidata.id === pendente.id) && lista.length < FORMAS_PENDENTES_MAX
      if (!volta) return { cena, emParte: ligada, ok: true }
      return { cena: { ...cena, turnos: { ...cena.turnos, formasPendentes: [...lista, pendente] } }, emParte: false, ok: true }
    }
    case 'cartaoDaForma': {
      // C6: o cartão da forma volta como era antes dos números do mestre (modificadores e subcartões), só se ainda tem
      // os números desta decisão: uma decisão posterior por cima fica (Desfazer fora de ordem).
      const { antes, escrito } = reversao
      let outraDecisao = false
      const ok = mesa.ajustarPersonagem(reversao.personagemId, (atual) => {
        const agora = cartaoPorId(atual, antes.id)
        if (escrito !== undefined && agora !== null && !cartaoAindaComADecisao(agora, escrito)) {
          outraDecisao = true
          return atual
        }
        // Fatia C7 (revisão): voltam os números; a forma que o uso revelou (ou que o mestre revelou depois) não se esconde de novo.
        return comCartaoTrocado(atual, agora === null ? antes : comAsMarcasDeOcultaDe(antes, agora))
      })
      return { cena, emParte: !ok || outraDecisao, ok: true }
    }
    case 'municao': {
      // MUNIÇÃO: a unidade que o tiro gastou volta à mochila da ficha (o boneco espelha), sobre a ficha de agora.
      const { vaga, indice, tokenId } = reversao
      const doBoneco = tokenId === undefined ? null : (mesa.mochilaDoBoneco?.(sceneKey, tokenId) ?? null)
      if (tokenId !== undefined && doBoneco !== null) {
        // A vaga era do boneco (aventura não migrada): a unidade volta a ele, sobre a mochila de agora.
        const ficha = mesa.personagens().find((candidato) => candidato.id === reversao.personagemId)
        const devolvida = ficha === undefined ? null : devolverMunicaoNaFicha(fichaComAMochilaDoBoneco(ficha, doBoneco), vaga, indice)
        const ok = devolvida !== null && mesa.gravarMochilaDoBoneco?.(sceneKey, tokenId, devolvida.mochila ?? []) === true
        return { cena, emParte: !ok, ok: true }
      }
      // A ficha é a dona (ou a aventura migrou entre o tiro e o Desfazer, e a mochila do boneco já é a da ficha).
      const ok = mesa.ajustarPersonagem(reversao.personagemId, (atual) => devolverMunicaoNaFicha(atual, vaga, indice))
      return { cena, emParte: !ok, ok: true }
    }
    case 'pente': {
      // ITENS REFEITOS, E6a: as balas do tiro voltam ao pente, sobre a mochila de agora (a do boneco na aventura não migrada).
      return { cena, emParte: !devolverAoPenteNaMesa(mesa, sceneKey, reversao), ok: true }
    }
    case 'mochila': {
      // ITENS REFEITOS, E6a: a recarga da mesa desfeita: a bala volta à mochila e o pente fica como estava.
      return { cena, emParte: !desfazerMochilaNaMesa(mesa, sceneKey, reversao), ok: true }
    }
    case 'condicoes': {
      // ITENS REFEITOS, E6c: as condições da ficha voltam às de antes, só se ninguém mexeu nelas depois.
      const { personagemId, antes, depois } = reversao
      let voltou = false
      const gravou = mesa.ajustarPersonagem(personagemId, (atual) => {
        if (JSON.stringify(condicoesDe(atual)) !== JSON.stringify(depois)) return atual
        voltou = true
        return comCondicoesNaFicha(atual, antes)
      })
      return { cena, emParte: !gravou || !voltou, ok: true }
    }
    case 'empurrao': {
      // E6c (A5): o empurrado volta à casa de antes, se ainda está onde o golpe o deixou.
      return { cena, emParte: mesa.voltarEmpurrao?.(sceneKey, reversao.tokenId, reversao.empurrao) !== true, ok: true }
    }
    case 'invocadoSaiu': {
      // Só volta quem foi posto por linhas ainda de pé (desfazer fora de ordem não ressuscita) e não está em campo.
      const { invocado } = reversao
      const podeVoltar = !linhaDesfeita(cena.registro, invocado.linhaId) && !linhaDesfeita(cena.registro, invocado.linhaDoPedido) && invocadoDoToken(cena.turnos, invocado.tokenId) === null
      if (!podeVoltar) return { cena, emParte: false, ok: true }
      if (mesa.criarInvocado === undefined || !mesa.criarInvocado(sceneKey, reversao.personagem, reversao.token)) return { cena, emParte: true, ok: true }
      return { cena: { ...cena, turnos: { ...cena.turnos, invocados: [...(cena.turnos.invocados ?? []), invocado] } }, emParte: false, ok: true }
    }
    case 'acaoDevolvida': {
      // C2: a linha do Concentrar já desfeita devolveu a ação por ela; gastar de novo tiraria uma ação que nada gastou.
      if (linhaDesfeita(cena.registro, reversao.linhaDoConcentrar)) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'marcaUsada': {
      // R1: a marca só volta com a linha que a pôs de pé (desfazer fora de ordem não ressuscita) e o alvo ainda na ordem.
      const { selo } = reversao
      const posta = selo.linhaDaMarca === undefined || !linhaDesfeita(cena.registro, selo.linhaDaMarca)
      if (!posta || !cena.turnos.cartas.some((carta) => carta.tokenId === selo.tokenId)) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'lembreteDaMarcaRespondido': {
      // R1: o lembrete só volta a esperar se o golpe que o deixou segue de pé e o alvo não ganhou marca.
      const { lembrete } = reversao
      if (linhaDesfeita(cena.registro, lembrete.linhaId) || marcaDoToken(cena.turnos.selos, lembrete.alvoTokenId) !== undefined) return { cena, emParte: false, ok: true }
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    }
    case 'lembreteDaMarca':
    case 'contador':
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
    case 'vez': {
      // Bug 3: o selo que acabou na vez e cuja linha foi desfeita depois não volta com ela.
      const volta = { ...cena, turnos: reverterTurnos(cena.turnos, vezSemOsSelosDesfeitos(cena.registro, reversao)) }
      // Conserto das fichas F1: os +10 SP do começo da vez saem junto.
      return reversao.ficha === undefined ? { cena: volta, emParte: false, ok: true } : desfazerReversao(mesa, sceneKey, volta, { tipo: 'ficha', ...reversao.ficha }, autor)
    }
    case 'ordem':
    case 'cartaNova':
    case 'cartaRemovida':
    case 'gasto':
    case 'acoesExtras':
    case 'combate':
    case 'carga':
    case 'golpe':
    case 'contra':
    case 'forma':
    case 'selo':
    case 'evolucao':
    case 'linhaJunto':
    case 'caiu':
      return { cena: { ...cena, turnos: reverterTurnos(cena.turnos, reversao) }, emParte: false, ok: true }
  }
}

/**
 * Bug 11: a ação parou no meio porque a mesa recusou gravar uma ficha. O que
 * ela já gravou em outras fichas (as partes "ficha" juntadas até ali: o custo
 * de quem atacou, o dano do alvo anterior) volta, e nada dela fica.
 */
export function devolverFichasDaAcao(mesa: MesaDaBatalha, sceneKey: string, cena: BatalhaDaCena, partes: readonly Reversao[], autor: AutorDaAcao): void {
  const daFicha = partes.filter((parte) => parte.tipo === 'ficha' || parte.tipo === 'municao')
  if (daFicha.length > 0) desfazerReversao(mesa, sceneKey, cena, { tipo: 'composta', partes: daFicha }, autor)
}

/** As partes "reacaoComTecnica" de uma reversão (a linha da reação com técnica). */
export function reacoesComTecnicaDe(reversao: Reversao): Extract<Reversao, { tipo: 'reacaoComTecnica' }>[] {
  if (reversao.tipo === 'reacaoComTecnica') return [reversao]
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(reacoesComTecnicaDe) : []
}

/** Os golpes que nasceram na linha (partes "golpe"). */
export function golpesDaReversao(reversao: Reversao): string[] {
  if (reversao.tipo === 'golpe') return [reversao.golpeId]
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(golpesDaReversao) : []
}

/** F2 (fatia B): as linhas que nasceram junto desta (o 2º golpe do Rapid Dash), na ordem em que foram escritas. */
export function linhasJuntoDe(reversao: Reversao): string[] {
  if (reversao.tipo === 'linhaJunto') return [reversao.linhaId]
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(linhasJuntoDe) : []
}

/** Os contra-ataques que a linha deu: todo contra do golpe que nasceu nela (`tokenId` null) e o da reação com técnica que saiu "contra". */
export function contrasDaReversao(reversao: Reversao): { golpeId: string; tokenId: string | null }[] {
  const doGolpe = golpesDaReversao(reversao).map((golpeId) => ({ golpeId, tokenId: null }))
  const daReacao = reacoesComTecnicaDe(reversao)
    .filter((parte) => parte.golpe.alvos.some((alvo) => alvo.tokenId === parte.tokenId && alvo.saida === 'contra'))
    .map((parte) => ({ golpeId: parte.golpe.id, tokenId: parte.tokenId }))
  return [...doGolpe, ...daReacao]
}
