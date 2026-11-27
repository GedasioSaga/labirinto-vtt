/**
 * A fatia das PASSIVAS e dos ajustes da store da batalha One Piece: passiva e lembrete da regra, evoluir
 * técnica, marcar o alvo, ajuste à mão na batalha e o contador.
 */
import {
  combateVazio,
  type CombateDoPersonagem,
  type PedidoDeAjusteNaBatalha,
  type PedidoDoContador,
  type PedidoDeEvolucao,
  type PedidoDeMarca,
  type PedidoDePassiva,
  type LembreteDaPassiva,
  type SeloDaBatalha,
  MUDANCAS_DO_AJUSTE_MAX,
  NOME_DO_SELO_MAX,
} from '../../lib/batalha/combate'
import { contadorDoPersonagem, motivoDoContador, nivelDoContador, seloDoContador, selosComONivel, temGolpeEsperando } from '../../lib/batalha/contador'
import { comBandosEmDia } from '../../lib/batalha/invocacao'
import { criarMarca, marcaDoToken, modificadorDoTeste, motivoDaMarca, passivaDaMarca } from '../../lib/batalha/marca'
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
} from '../../lib/batalha/selos'
import { formaDaFicha } from '../../lib/batalha/transformacao'
import { ehLembreteDoSangramento, porVezDoLembrete, travaDoToken, verboDoPorVez } from '../../lib/batalha/condicoes'
import { ehLembreteDaPreparacao, NOME_DA_PREPARACAO, seloDaPreparacao } from '../../lib/batalha/preparacao'
import { danoComAsReducoes, reducoesDoDano } from '../../lib/batalha/reducaoDoDano'
import { custoPorTurno, textoDoCustoPorTurno } from '../../lib/batalha/custoPorTurno'
import { cartaoDaVariante, comEvoluida, custoDaEvolucao, evolucaoDe, motivoDoEvoluir, portaoDoEvoluir, varianteDoPedido, type ContextoDaEvolucao } from '../../lib/batalha/escolhaEEvolucao'
import { ajustesDoCusto, custoEmSp, depoisDaTecnica, textoDaRolagem } from '../../lib/batalha/golpe'
import { mantidaDe } from '../../lib/batalha/mecanicasAMao'
import {
  ajustesDoPorTurno,
  chaveDoGatilho,
  comLembrada,
  custoDaPassiva,
  disparoDoLembrete,
  efeitoPorTurno,
  ehPassivaMontada,
  gatilhoDaPassiva,
  lembreteDe,
  modsSomados,
  motivoDaPassiva,
  seloDaPassiva,
  selosDaPassiva,
  semLembretes,
  textoDoPorTurno,
} from '../../lib/batalha/passivas'
import { CAMPO_DO_TEMPO, ehOverload, lerTempo, recursoDoCusto, tecnicaPorId, tecnicasDe } from '../../lib/batalha/leituraDaFicha'
import { ajustesDoDano } from '../../lib/batalha/reacao'
import { nomeDoAutor, novoIdDeLinha, semOLigarDeGraca, type ParteDaFicha, type Reversao } from '../../lib/batalha/registro'
import type { AutorDaAcao, CartaDaOrdem, TurnosDaCena } from '../../lib/batalha/turnos'
import { ajusteDoAtualDigitado, type Ajuste } from '../../lib/ajusteDaFicha'
import { motivoDoOcultoParaJogador, NOME_DO_OCULTO, nomeNaBatalha, ocultoNaBatalha } from '../../lib/habilidadeOculta'
import { numeroDaFicha, type Personagem } from '../../lib/personagem'
import type { BatalhaDaCena, BatalhaState } from './tipos'
import { comMudanca, type EfeitoNovo, comEfeitos, quemNaFicha, personagemDoTokenNa, nomeDoTokenNa, nomeDoBandoNa, partesDosLembretes } from './cena'
import { mexerNaFicha, semOsCaidos, textoDosQueSairam, tirouSp, reversaoDaFicha, mudancaValida } from './naMesa'
import { devolverFichasDaAcao } from './desfazer'
import { gastarOsRequisitos, notaDaLinha } from './gastosDosRequisitos'
import { pedirAjuda, pedirAoMestre } from './ajuda'
import type { AceitesDoPedido } from '../../lib/batalha/requisitos/ajuda'
import { aliadosNaLuta, quemLutaPeloDono } from '../../lib/batalha/equipes'
import { acumuladoresDoPersonagem, acumuladorQueCarrega, comGastoNoAcumulador, comOEventoNosAcumuladores, nivelDoAcumulador } from '../../lib/batalha/acumuladorNaBatalha'
import type { NucleoDaBatalha } from './nucleo'
import type { FormasDaBatalha } from './formas'
import { novoIdDaMarca } from './golpe'

/** As passivas presas ao núcleo da store e às formas. */
export function criarPassivas(nucleo: NucleoDaBatalha, fatiaDasFormas: FormasDaBatalha) {
  const { mesa, deps, mesaDoRpg, cenaDe, gravarCena, comAvisoDeQuemCaiu, revelarAoUsar, ocultoParaQuemPede, lembrarDepoisDoDano, rastrear, aplicarDisparo } = nucleo
  const { custoDaFormaNaVez, custoDaMantidaNaVez } = fatiaDasFormas

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
      // REQUISITOS B3: o dano do selo por vez também é "apanhou" (e pode derrubar).
      const rastreado = rastrear(comCombate(atual.turnos), [{ tipo: 'dano', tokenId: carta.tokenId, valor: dado, saida: 'direto' }], partes)
      partes.push(...rastreado.partes)
      const caidos = semOsCaidos(mesa, sceneKey, rastreado.turnos)
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
    // Rework das habilidades (D6, E5): o Ativar da passiva montada é o do lembrete do gatilho que perguntou: os efeitos das
    // peças, pelo mesmo caminho do disparo sozinho (`aplicarDisparo`, linha com Desfazer). O alvo escolhido na tela vence.
    if (pedido.tipo === 'passiva' && pedido.ligar && ehPassivaMontada(cartao)) {
      const lembrete = lembreteDe(combateBase, cartao.id)
      const disparo = lembrete === null ? null : disparoDoLembrete(lembrete, personagemId, cartao)
      if (disparo === null) return false
      return aplicarDisparo(sceneKey, pedido.alvoTokenId === undefined ? disparo : { ...disparo, alvoTokenId: pedido.alvoTokenId }, autor)
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
  const evoluirTecnica = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao, aceite?: AceitesDoPedido): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
    if (carta === undefined || carta.personagemId === null) return false
    const personagemId = carta.personagemId
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    if (ocultoParaQuemPede(autor, personagem, pedido.cartaoId)) return false
    // REQUISITOS C: o retrato do "Para evoluir" vê as fichas da mesa e os aliados na luta; o mestre força.
    const invocados = turnos.invocados ?? []
    const aliados = aliadosNaLuta(personagemId, [...turnos.cartas.map((candidata) => candidata.personagemId), ...invocados.map((invocado) => invocado.personagemId)], { equipes: mesa.equipes(), personagens, invocados: quemLutaPeloDono(turnos) })
    const ctxDaEvolucao: ContextoDaEvolucao = {
      personagem,
      sistema,
      turnos,
      soNaVez: autor.tipo === 'jogador',
      personagens,
      aliados,
      autorEhMestre: autor.tipo === 'mestre',
      // REQUISITOS E e J2: `aceite` = o aliado aceitou o pedido de ajuda (ou o mestre aprovou); no treino do Lobby o pedido fica "Só na mesa".
      ...(aceite?.ajuda === true ? { ajudaAceita: true } : {}),
      ...(aceite?.mestre === true ? { mestreDeixou: true } : {}),
      ...(deps.treino === true ? { noTreino: true } : {}),
      // REQUISITOS E5: a luz é medida no host, com o mapa inteiro.
      ...(mesa.naLuz === undefined ? {} : { naLuz: (tokenId: string) => mesa.naLuz?.(sceneKey, tokenId) ?? null }),
    }
    // REQUISITOS E (§7) e J2: só falta o aliado aceitar (ou o mestre aprovar). Se o resto vale supondo os dois sins, nasce a
    // pendência; nada é gasto antes.
    const antesDaAjuda = portaoDoEvoluir(ctxDaEvolucao, pedido)
    if (antesDaAjuda.tipo === 'perguntaAoAliado' || antesDaAjuda.tipo === 'perguntaAoMestre') {
      if (motivoDoEvoluir({ ...ctxDaEvolucao, ajudaAceita: true, mestreDeixou: true }, pedido) !== null || personagem === null || sistema === null) return false
      const daBase = tecnicaPorId(personagem, sistema, pedido.cartaoId)
      const tecnica = `Evoluir ${daBase === null ? 'a técnica' : nomeNaBatalha(personagem, daBase.cartao, 'a técnica')}`
      if (antesDaAjuda.tipo === 'perguntaAoMestre') return pedirAoMestre(nucleo, sceneKey, cena, autor, carta, { tipo: 'evoluir', pedido }, antesDaAjuda.pergunta, tecnica, aceite?.ajuda === true)
      return pedirAjuda(nucleo, sceneKey, cena, autor, carta, { tipo: 'evoluir', pedido }, antesDaAjuda.pergunta, tecnica)
    }
    if (motivoDoEvoluir(ctxDaEvolucao, pedido) !== null || personagem === null || sistema === null) return false
    const doPortao = portaoDoEvoluir(ctxDaEvolucao, pedido)
    const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
    const evolucao = achada === null ? null : evolucaoDe(achada.cartao, tecnicasDe(personagem, sistema))
    if (achada === null || evolucao === null) return false
    const { cartao } = achada
    const custo = custoDaEvolucao(pedido.custo)
    const combateAntes = turnos.combate?.[personagemId]
    const evoluida = comEvoluida(combateAntes ?? combateVazio(), cartao.id)
    // Conserto das fichas F1 (+10 SP por vez): evoluir pagando SP conta como gastar SP na vez.
    const combate: CombateDoPersonagem = custoEmSp(custo) && evoluida.gastouSp !== true ? { ...evoluida, gastouSp: true } : evoluida
    let novos: TurnosDaCena = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
    const partes: Reversao[] = [{ tipo: 'evolucao', personagemId, cartaoId: cartao.id }]
    if (combate !== evoluida) partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois: combate })
    const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quemNaFicha(autor))
    // Bug 11: custo recusado = a técnica não evolui.
    if (doCusto === 'recusada') return false
    partes.push(...reversaoDaFicha(personagemId, doCusto))
    // REQUISITOS C (I3): os gastos do "Para evoluir" que vale, nesta linha (o Desfazer devolve tudo).
    let notaDosRequisitos = doPortao.tipo === 'passa' ? doPortao.nota : null
    if (doPortao.tipo === 'passa') {
      const gastos = gastarOsRequisitos(mesa, sceneKey, personagemId, carta.tokenId, novos, doPortao.gastos, autor)
      if (gastos === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(...gastos.partes)
      novos = gastos.turnos
      notaDosRequisitos = notaDaLinha(gastos.texto, notaDosRequisitos)
    }
    // REQUISITOS E (G2 aceito): a ajuda sem pagamento também fica na linha.
    if (aceite?.ajuda === true && doPortao.tipo === 'passa' && pedido.ajudaDe !== undefined && !doPortao.gastos.some((gasto) => gasto.recurso === 'doAliado')) {
      notaDosRequisitos = notaDaLinha(notaDosRequisitos, `(com a ajuda de ${nomeDoTokenNa(turnos, personagens)(pedido.ajudaDe)})`)
    }
    const dono = nomeDoTokenNa(turnos, personagens)(carta.tokenId)
    const nome = nomeNaBatalha(personagem, cartao, 'a técnica')
    // Com link: "→ SUPER CAÇA AS BRUXAS!"; sem link e o texto diz OVERLOAD: o uso evoluído é Overload.
    // Fatia C7 (revisão): a evoluída oculta também sai como "???".
    const destino = evolucao.para !== null ? ` → ${nomeNaBatalha(personagem, evolucao.para, 'a evoluída')}` : evolucao.overload ? ' (agora Overload)' : ''
    const recurso = recursoDoCusto(sistema, 'sp')?.nome ?? 'SP'
    const pago = custo.tipo === 'valor' && personagem.tipo === 'jogador' ? ` (${custo.valor} ${recurso})` : ''
    const texto = `${dono} evoluiu ${nome}${destino}${pago}${notaDosRequisitos === null ? '' : ` ${notaDosRequisitos}`}`
    // REQUISITOS C: o SP do Evoluir (o custo e o gasto do requisito) sobe o acumulador "a cada N SP gastos".
    const rastreado = rastrear(novos, [], partes)
    partes.push(...rastreado.partes)
    novos = rastreado.turnos
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
  /**
   * REQUISITOS C: o "Carregar" do acumulador genérico que sobe ao gastar a reação (a Polaridade no motor
   * novo): as travas do contador antigo; gasta a reação (`semReacao`) e o evento sobe o nível; zerar
   * (do mestre) volta a 0. Uma parte "combate" na linha: o Desfazer devolve o nível e a reação.
   */
  const carregarOAcumulador = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDoContador, personagem: Personagem): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const { turnos } = cena
    const achado = acumuladorQueCarrega(personagem)
    if (achado === null || achado.cartao.id !== pedido.cartaoId) return false
    if (ocultoParaQuemPede(autor, personagem, achado.cartao.id)) return false
    if (pedido.tipo === 'ganhar' && travaDoToken(turnos.selos, pedido.tokenId) !== null) return false
    const { acumulador } = achado
    const combateAntes = turnos.combate?.[personagem.id]
    const base = combateAntes ?? combateVazio()
    const nivel = nivelDoAcumulador(combateAntes, acumulador.id)
    if (motivoDoContador(pedido.tipo, nivel, acumulador.maximo, combateAntes?.semReacao === true, temGolpeEsperando(turnos.golpes, pedido.tokenId)) !== null) return false
    const definicoes = acumuladoresDoPersonagem(personagem)
    const depois =
      pedido.tipo === 'ganhar'
        ? comOEventoNosAcumuladores({ ...base, semReacao: true }, definicoes, { quando: 'gastaReacao' }, turnos.rodada)
        : comGastoNoAcumulador(base, definicoes, { id: acumulador.id, nome: acumulador.nome }, nivel, turnos.rodada)
    const nivelDepois = nivelDoAcumulador(depois, acumulador.id)
    const oculto = ocultoNaBatalha(personagem, achado.cartao)
    const nomeDoAcumulador = oculto ? NOME_DO_OCULTO : acumulador.nome
    const nome = nomeDoTokenNa(turnos, mesaDoRpg().personagens)(pedido.tokenId)
    const texto = pedido.tipo === 'ganhar' ? `${nome} carregou ${nomeDoAcumulador}: nível ${nivelDepois} · sem reação até a vez dele` : `${nomeDoAutor(autor)} zerou ${nomeDoAcumulador} de ${nome}`
    const novos: TurnosDaCena = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagem.id]: depois } }
    const partes: Reversao[] = [{ tipo: 'combate', personagemId: personagem.id, antes: combateAntes ?? null, depois }]
    gravarCena(sceneKey, comMudanca(cena, novos, { tipo: 'habilidade', texto, autor, tokenIds: [pedido.tokenId], personagemIds: [personagem.id], reversao: { tipo: 'composta', partes } }))
    if (pedido.tipo === 'ganhar') revelarAoUsar(personagem.id, achado.cartao.id)
    return true
  }

  const mexerNoContador = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDoContador): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || (pedido.tipo === 'zerar' && autor.tipo !== 'mestre')) return false
    const { turnos } = cena
    const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId && candidata.bando === undefined)
    const personagemId = carta?.personagemId ?? null
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    const achado = personagem === undefined || sistema === null ? null : contadorDoPersonagem(personagem, sistema)
    if (personagemId !== null && personagem !== undefined && achado === null) return carregarOAcumulador(sceneKey, autor, pedido, personagem)
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

  const acoes: Pick<BatalhaState, 'passiva' | 'evoluir' | 'motivoDoEvoluir' | 'marcar' | 'ajustar' | 'contador'> = {
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
  }
  /** REQUISITOS E: o aliado aceitou; o Evoluir congelado roda o portão inteiro de novo, com o autor de quem pediu. */
  const evoluirComAjudaAceita = (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao, aceites: AceitesDoPedido): boolean => evoluirTecnica(sceneKey, autor, pedido, aceites)
  return { acoes, evoluirComAjudaAceita }
}
