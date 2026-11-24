/**
 * A fatia dos SELOS da store da batalha One Piece: o selo que o golpe põe no acerto (e o que renova), os
 * aliados que ele poupa, e o que o mestre põe, edita e tira à mão (`porSelo`, `editarSelo`, `tirarSelo`).
 */
import type { AlvoDoGolpe, GolpeDaBatalha, SeloDaBatalha, SeloDoGolpe } from '../../lib/batalha/combate'
import {
  bonusDaBatalha,
  comSeloNovo,
  criarSelo,
  ondeNaVez,
  modsIguais,
  naturezaDosMods,
  novoIdDeSelo,
  pegaOSelo,
  seloEditado,
  seloPedidoValido,
  textoDoSelo,
  textoDoSeloComMods,
} from '../../lib/batalha/selos'
import { comportamentoDoSelo } from '../../lib/batalha/condicoes'
import { aliadosNaLuta, quemLutaPeloDono } from '../../lib/batalha/equipes'
import { quemUsaVence, rolarDisputa, textoDaDisputa } from '../../lib/batalha/disputa'
import { disputaNoAcerto, seloPegaNoAlvo } from '../../lib/batalha/mecanicasAMao'
import { TEXTO_DO_ALVO_SEM_FICHA } from '../../lib/batalha/disputaNoUso'
import { disputaDoTesteDoSelo } from '../../lib/batalha/mecanica/teste'
import type { Reversao } from '../../lib/batalha/registro'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { BatalhaState } from './tipos'
import { comMudanca, type EfeitoNovo, nomeDoTokenNa } from './cena'
import type { NucleoDaBatalha } from './nucleo'

/** Um efeito "selo" por selo que acabou ("ATORDOADO ACABOU"). */
export function efeitosDosSelos(acabaram: readonly SeloDaBatalha[]): EfeitoNovo[] {
  return acabaram.map((selo): EfeitoNovo => ({ tipo: 'selo', tokenId: selo.tokenId, nome: selo.nome, acabou: true }))
}

/** Q6: o selo do golpe no alvo que ele ACERTOU (resolvido com saída que pega). Sem selo, sem acerto ou no teto: `null`. */
function seloDoGolpe(turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selos: SeloDaBatalha[]; parte: Reversao } | null {
  // Fase 5 (B16): quem passou no teste da Explosão toma metade, mas o selo não pega.
  if (golpe.selo === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) || alvo.passouNoTeste === true) return null
  const pedido = golpe.selo
  // F2 (fatia A): o selo que renova (Queimando) volta aos turnos cheios em vez de pôr outro.
  const renovado = seloRenovado(turnos, alvo.tokenId, pedido)
  if (renovado !== null) return renovado
  const selo = criarSelo(alvo.tokenId, pedido, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: golpe.nome })
  const selos = comSeloNovo(turnos.selos, selo)
  return selos === null ? null : { selos, parte: { tipo: 'selo', seloId: selo.id, antes: null } }
}

/** F2 (fatia A): o selo igual que já está no alvo e renova; `null` = não renova (põe um novo). */
function seloRenovado(turnos: TurnosDaCena, tokenId: string, pedido: SeloDoGolpe): { selos: SeloDaBatalha[]; parte: Reversao } | null {
  const comportamento = comportamentoDoSelo(pedido.nome)
  if (comportamento?.renova !== true) return null
  const antes = (turnos.selos ?? []).find((selo) => selo.tokenId === tokenId && comportamentoDoSelo(selo.nome) === comportamento)
  if (antes === undefined) return null
  // Construtor C5 (revisão): a duração vem toda do pedido, o "até o próximo golpe" junto com os turnos (um Queimando 2 renovado
  // por "Queimando até o próximo golpe" passa a sair no golpe seguinte; o contrário volta a contar turnos).
  const { saiNoProximoGolpe: _anterior, ...semADuracao } = antes
  const depois: SeloDaBatalha = { ...semADuracao, turnos: pedido.turnos, total: pedido.turnos }
  if (pedido.porVez !== undefined) depois.porVez = pedido.porVez
  if (pedido.saiNoProximoGolpe === true) depois.saiNoProximoGolpe = true
  return { selos: (turnos.selos ?? []).map((selo) => (selo.id === antes.id ? depois : selo)), parte: { tipo: 'selo', seloId: antes.id, antes, editado: true } }
}

/** Os selos presos ao núcleo da store. */
export function criarSelos(nucleo: NucleoDaBatalha) {
  const { mesa, deps, mesaDoRpg, cenaDe, gravarCena } = nucleo

  /**
   * F2 (fatia B): o selo do golpe no alvo acertado, com a disputa da mecânica
   * à mão (Corta Cenoura: d20 + FOR com vantagem contra d20 + RES do alvo): o
   * app rola e o selo só pega se quem usou vencer. O resultado vai no alvo
   * (`disputa`) para a linha do golpe. Sem disputa: o selo de sempre.
   */
  const seloNoAcerto = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    const feito = seloDoGolpeNoAcerto(turnos, golpe, alvo)
    // F2 (revisão da fatia E, Bala de Prata): o selo da bala pega junto, por cima do da mira, do da técnica e da marca.
    // Fase 5: os selos a mais da técnica montada pegam do mesmo jeito, um depois do outro (cada um com o seu Desfazer).
    // Fase ED4: cada um com o seu teste (`pega`), rolado na ordem dos selos.
    const extras = [...(golpe.seloDaBala === undefined ? [] : [golpe.seloDaBala]), ...(golpe.selosAMais ?? [])]
    return extras.reduce((ate, extra) => {
      const teste = testeDoSelo(turnos, golpe, extra, ate.alvo)
      if (!teste.pega) return { ...ate, alvo: teste.alvo }
      const mais = seloDoGolpe(ate.selado === null ? turnos : { ...turnos, selos: ate.selado.selos }, { ...golpe, selo: extra }, teste.alvo)
      if (mais === null) return { ...ate, alvo: teste.alvo }
      return { alvo: teste.alvo, selado: ate.selado === null ? mais : { selos: mais.selos, parte: { tipo: 'composta', partes: [ate.selado.parte, mais.parte] } } }
    }, feito)
  }

  /**
   * Fase ED4: o teste do selo (a peça `pega`, o "com teste" do tipo do golpe). No alvo que o golpe
   * acertou, ele rola d20 + mod do atributo contra a CD de quem usa (`rolarDisputa`, o mesmo dado do
   * teste da técnica, com os selos de cada um); passou, o selo não entra. A rolagem vai no texto do alvo
   * (a linha do golpe: "Resistência: teste 9 + 2 = 11 contra CD 12, Atordoado"); o Desfazer da linha
   * tira o selo junto. Sem teste, sem acerto, ou o alvo que já passou no teste da técnica: nada a rolar.
   */
  const testeDoSelo = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, selo: SeloDoGolpe, alvo: AlvoDoGolpe): { pega: boolean; alvo: AlvoDoGolpe } => {
    const pega = selo.pega
    if (pega === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) || alvo.passouNoTeste === true) return { pega: true, alvo }
    const comTexto = (texto: string): AlvoDoGolpe => ({ ...alvo, disputa: alvo.disputa === undefined || alvo.disputa === '' ? texto : `${alvo.disputa}; ${texto}` })
    const { personagens, sistema } = mesaDoRpg()
    const usa = personagens.find((candidato) => candidato.id === golpe.atacantePersonagemId)
    const resiste = personagens.find((candidato) => candidato.id === alvo.personagemId)
    // O alvo sem ficha (token genérico) não rola: o selo entra e a linha avisa, como no teste da técnica montada.
    if (usa === undefined || resiste === undefined || sistema === null) return { pega: true, alvo: comTexto(`${selo.nome}: ${TEXTO_DO_ALVO_SEM_FICHA}`) }
    const deQuemUsa = { personagem: usa, bonus: bonusDaBatalha(turnos.selos, golpe.atacanteTokenId) }
    const doAlvo = { personagem: resiste, bonus: bonusDaBatalha(turnos.selos, alvo.tokenId) }
    const resultado = rolarDisputa(disputaDoTesteDoSelo(pega), { testa: doAlvo, usa: deQuemUsa, resiste: deQuemUsa }, sistema, golpe.carga ?? 0, deps.rolarD20)
    const pegou = quemUsaVence(resultado, 'alvo')
    const atributo = sistema.atributos.find((candidato) => candidato.id === pega.atributoId)?.nome.trim()
    const quem = atributo === undefined || atributo === '' ? pega.atributoId : atributo
    return { pega: pegou, alvo: comTexto(`${quem}: ${textoDaDisputa(resultado)}, ${pegou ? selo.nome : `sem ${selo.nome}`}`) }
  }

  /** O selo principal do golpe no alvo, depois do teste dele (`testeDoSelo`); sem selo = nada. */
  const seloComOTeste = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    if (golpe.selo === undefined) return { selado: null, alvo }
    const teste = testeDoSelo(turnos, golpe, golpe.selo, alvo)
    return { selado: teste.pega ? seloDoGolpe(turnos, golpe, teste.alvo) : null, alvo: teste.alvo }
  }

  /**
   * U3 (plano de 10/11): os aliados de `personagemId` nesta luta, a regra única de "quem pode ajudar quem" (`aliadosNaLuta`):
   * quem está do lado dele entre as fichas da ordem e os invocados, jogador ou NPC.
   */
  const aliadosNaLutaDe = (personagemId: string | null, turnos: TurnosDaCena, personagens: readonly Personagem[]): Set<string> => {
    const invocados = turnos.invocados ?? []
    return aliadosNaLuta(personagemId, [...turnos.cartas.map((carta) => carta.personagemId), ...invocados.map((invocado) => invocado.personagemId)], { equipes: mesa.equipes(), personagens, invocados: quemLutaPeloDono(turnos) })
  }

  /** O selo do golpe (o da mira ou o da técnica) no alvo que ele acertou, com a disputa da mecânica à mão quando há. */
  const seloDoGolpeNoAcerto = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    const cartaoId = golpe.selo?.cartaoId
    const { personagens, sistema } = mesaDoRpg()
    // F2 (fatia C, A Luz do Sol): o selo só nos aliados de quem usou (no inimigo vai só o dano). U3: os aliados na luta, a mesma lista do golpe.
    if (cartaoId !== undefined && golpe.atacantePersonagemId !== null && !seloPegaNoAlvo(cartaoId, alvo.personagemId, aliadosNaLutaDe(golpe.atacantePersonagemId, turnos, personagens))) return { selado: null, alvo }
    const disputa = cartaoId === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) ? null : disputaNoAcerto(cartaoId)
    const usa = personagens.find((candidato) => candidato.id === golpe.atacantePersonagemId)
    const resiste = personagens.find((candidato) => candidato.id === alvo.personagemId)
    if (disputa === null || usa === undefined || resiste === undefined || sistema === null) return seloComOTeste(turnos, golpe, alvo)
    const deQuemUsa = { personagem: usa, bonus: bonusDaBatalha(turnos.selos, golpe.atacanteTokenId) }
    const doAlvo = { personagem: resiste, bonus: bonusDaBatalha(turnos.selos, alvo.tokenId) }
    const quemUsaTesta = disputa.testa === 'quemUsa'
    // F2 (fatia C): a carga gasta no golpe entra na CD (a dança da Aira).
    const resultado = rolarDisputa(disputa, { testa: quemUsaTesta ? deQuemUsa : doAlvo, usa: deQuemUsa, resiste: quemUsaTesta ? doAlvo : deQuemUsa }, sistema, golpe.carga ?? 0, deps.rolarD20)
    // Quando o alvo testa, quem usa vence se o alvo NÃO passou; sem teste (concentração), quem usa vence.
    const venceu = quemUsaVence(resultado, disputa.testa)
    const comTexto: AlvoDoGolpe = { ...alvo, disputa: `${textoDaDisputa(resultado)}, ${venceu ? 'o selo pegou' : 'o selo não pegou'}` }
    return venceu ? seloComOTeste(turnos, golpe, comTexto) : { selado: null, alvo: comTexto }
  }

  /** O selo trocado (`depois`) ou tirado (`null`), com a linha "selo" do mestre. */
  const mudarSelo = (sceneKey: string, seloId: string, depois: SeloDaBatalha | null): boolean => {
    const cena = cenaDe(sceneKey)
    const antes = cena?.turnos.selos?.find((selo) => selo.id === seloId)
    if (cena === undefined || antes === undefined) return false
    const selos = (cena.turnos.selos ?? []).flatMap((selo) => (selo.id !== seloId ? [selo] : depois === null ? [] : [depois]))
    const { personagens, sistema } = mesaDoRpg()
    const nome = nomeDoTokenNa(cena.turnos, personagens)(antes.tokenId)
    const texto = depois === null ? `Mestre tirou ${textoDoSelo(antes)} de ${nome}` : `Mestre: ${textoDoSeloComMods(antes, sistema)} → ${textoDoSeloComMods(depois, sistema)} em ${nome}`
    const reversao: Reversao = depois === null ? { tipo: 'selo', seloId, antes } : { tipo: 'selo', seloId, antes, editado: true }
    gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, selos }, { tipo: 'selo', texto, tokenIds: [antes.tokenId], reversao }))
    return true
  }

  const acoes: Pick<BatalhaState, 'porSelo' | 'editarSelo' | 'tirarSelo'> = {
    porSelo: (sceneKey, tokenId, pedido) => {
      const cena = cenaDe(sceneKey)
      const { personagens, sistema } = mesaDoRpg()
      const selo = seloPedidoValido(pedido, sistema)
      if (cena === undefined || selo === null || !cena.turnos.cartas.some((carta) => carta.tokenId === tokenId)) return false
      const { turnos } = cena
      // Tipos de habilidade F2: a cor do selo à mão vem do sinal dos mods ("Reação +3" = buff).
      // F2 (fatia A): o que o selo faz pelo nome (Cego zera a Percepção) é lido na hora (`bonusDaBatalha`), nada é gravado aqui.
      const novo = criarSelo(tokenId, { ...selo, natureza: naturezaDosMods(selo.mods) }, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos) })
      const selos = comSeloNovo(turnos.selos, novo)
      if (selos === null) return false
      const texto = `Mestre pôs ${textoDoSeloComMods(novo, sistema)} em ${nomeDoTokenNa(turnos, personagens)(tokenId)}`
      gravarCena(sceneKey, comMudanca(cena, { ...turnos, selos }, { tipo: 'selo', texto, tokenIds: [tokenId], reversao: { tipo: 'selo', seloId: novo.id, antes: null } }))
      return true
    },

    editarSelo: (sceneKey, seloId, pedido) => {
      const selo = seloPedidoValido(pedido, mesaDoRpg().sistema)
      const antes = cenaDe(sceneKey)?.turnos.selos?.find((candidato) => candidato.id === seloId)
      if (selo === null || antes === undefined) return false
      if (antes.nome === selo.nome && antes.turnos === selo.turnos && modsIguais(antes.mods, selo.mods)) return false
      return mudarSelo(sceneKey, seloId, seloEditado(antes, selo))
    },

    tirarSelo: (sceneKey, seloId) => mudarSelo(sceneKey, seloId, null),
  }
  return { seloNoAcerto, aliadosNaLutaDe, acoes }
}

/** O que `criarSelos` devolve. */
export type SelosDaBatalha = ReturnType<typeof criarSelos>
