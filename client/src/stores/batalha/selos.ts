/**
 * A fatia dos SELOS da store da batalha One Piece: o selo que o golpe põe no acerto (e o que renova), os
 * aliados que ele poupa, e o que o mestre põe, edita e tira à mão (`porSelo`, `editarSelo`, `tirarSelo`).
 */
import type { AlvoDoGolpe, GolpeDaBatalha, SeloDaBatalha, SeloDoGolpe } from '../../lib/batalha/combate'
import {
  bonusDaBatalha,
  comSeloNovo,
  criarSelo,
  ehNomeDeSelo,
  ondeNaVez,
  modsIguais,
  naturezaDosMods,
  novoIdDeSelo,
  pegaOSelo,
  quedaEmNumeros,
  seloComQuedaNoToken,
  seloEditado,
  seloPedidoValido,
  textoDoSelo,
  textoDoSeloComMods,
} from '../../lib/batalha/selos'
import { valorDoRank } from '../../lib/ajusteDaFicha'
import { comportamentoDoSelo } from '../../lib/batalha/condicoes'
import type { AoAcertarDoGolpe } from '../../lib/batalha/aoAcertarDoItem'
import { condicaoDoCatalogoPeloNome } from '../../lib/condicoes/catalogo'
import { condicoesNaFicha, espelhoNaHora, porCondicoesDoAcerto, tirarDaFichaPeloEspelho } from './condicoesNaFicha'
import { aliadosNaLuta, quemLutaPeloDono } from '../../lib/batalha/equipes'
import { quemUsaVence, rolarDisputa, textoDaDisputa } from '../../lib/batalha/disputa'
import { disputaNoAcerto, seloPegaNoAlvo } from '../../lib/batalha/mecanicasAMao'
import { TEXTO_DO_ALVO_SEM_FICHA } from '../../lib/batalha/disputaNoUso'
import { disputaDoTesteDoSelo } from '../../lib/batalha/mecanica/teste'
import { novoIdDeLinha, type Reversao } from '../../lib/batalha/registro'
import { selosQueALimpezaTira } from '../../lib/batalha/debuffs'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { BatalhaState } from './tipos'
import { comMudanca, type EfeitoNovo, nomeDoTokenNa } from './cena'
import { tirarPastilhasNaMesa } from './naMesa'
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
  // Rework das habilidades (PLANO.md D10, decisão 12): o Diminui atributo que o alvo já tem desta técnica só recomeça o prazo (não soma outra queda).
  const comQueda = seloComQuedaNoToken(turnos.selos, alvo.tokenId, pedido)
  if (comQueda !== undefined) {
    const depois: SeloDaBatalha = { ...comQueda, turnos: pedido.turnos, total: pedido.turnos }
    return { selos: (turnos.selos ?? []).map((selo) => (selo.id === comQueda.id ? depois : selo)), parte: { tipo: 'selo', seloId: comQueda.id, antes: comQueda, editado: true } }
  }
  // F2 (fatia A): o selo que renova (Queimando) volta aos turnos cheios em vez de pôr outro.
  const renovado = seloRenovado(turnos, alvo.tokenId, pedido)
  if (renovado !== null) return renovado
  const selo = criarSelo(alvo.tokenId, pedido, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: golpe.nome })
  const selos = comSeloNovo(turnos.selos, selo)
  return selos === null ? null : { selos, parte: { tipo: 'selo', seloId: selo.id, antes: null } }
}

/**
 * E6c: as condições do acerto do item como selos da batalha (a mesa sem condição na ficha, o token sem
 * ficha): os turnos da duração ("até o fim da batalha" = sem turnos, sai com ela), a vida por vez da de
 * regra `vida` e o corte da de regra `cura`, pelo catálogo de fábrica.
 */
function selosDasCondicoesDoAcerto(aoAcertar: Pick<AoAcertarDoGolpe, 'condicoes'>): SeloDoGolpe[] {
  return aoAcertar.condicoes.flatMap((condicao): SeloDoGolpe[] => {
    const doCatalogo = condicaoDoCatalogoPeloNome(condicao.nome, [])
    const pedido: SeloDoGolpe = { nome: condicao.nome, turnos: typeof condicao.duracao === 'number' ? condicao.duracao : null, natureza: 'debuff' }
    const n = condicao.n ?? doCatalogo?.n ?? 0
    if (doCatalogo?.regra === 'vida' && n > 0) pedido.porVez = n
    if (doCatalogo?.regra === 'cura' && n > 0) pedido.regra = { curaRecebida: -n }
    return ehNomeDeSelo(pedido.nome) ? [pedido] : []
  })
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
  const seloNoAcerto = (sceneKey: string, turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    const dosSelos = selosNoAcerto(turnos, golpe, alvo)
    // ITENS REFEITOS, E6c: depois dos selos, o "Ao acertar" do item (a condição na ficha, o empurrão), com o Desfazer junto.
    const doItem = itemNoAcerto(sceneKey, dosSelos.selado === null ? turnos : { ...turnos, selos: dosSelos.selado.selos }, golpe, dosSelos.alvo)
    if (doItem === null) return dosSelos
    const selado = dosSelos.selado === null ? doItem.selado : { selos: doItem.selado.selos, parte: { tipo: 'composta' as const, partes: [dosSelos.selado.parte, doItem.selado.parte] } }
    return { selado, alvo: doItem.alvo }
  }

  /**
   * ITENS REFEITOS, E6c: o "Ao acertar" do item (`golpe.aoAcertar`, a arma e a bala do tiro) no alvo que o
   * golpe ACERTOU. As condições vão para a FICHA dele (o espelho entra na hora); na mesa sem condição na
   * ficha (o treino, a Arena) ou no token sem ficha, viram selo da batalha. O empurrão move o token pela mesa
   * (A5). O texto do alvo na linha do golpe diz o que houve. `null` = nada a fazer.
   */
  const itemNoAcerto = (sceneKey: string, turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: { selos: SeloDaBatalha[]; parte: Reversao }; alvo: AlvoDoGolpe } | null => {
    const aoAcertar = golpe.aoAcertar
    if (aoAcertar === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) || alvo.passouNoTeste === true) return null
    let selos: SeloDaBatalha[] = [...(turnos.selos ?? [])]
    const partes: Reversao[] = []
    const notas: string[] = []
    const naFicha = alvo.personagemId === null ? null : porCondicoesDoAcerto(mesa, alvo.personagemId, aoAcertar)
    if (naFicha !== null) {
      partes.push(naFicha.parte)
      notas.push(`${aoAcertar.condicoes.map((condicao) => condicao.nome).join(', ')} na ficha`)
      const espelho = alvo.personagemId === null ? null : espelhoNaHora(mesa, sceneKey, selos, alvo.tokenId, alvo.personagemId, turnos.rodada)
      if (espelho !== null) {
        partes.push(...espelho.partes)
        selos = espelho.selos
      }
    } else if (!condicoesNaFicha(mesa) || alvo.personagemId === null) {
      // O treino, a Arena e o token sem ficha: a condição fica só nesta batalha, como o selo de uma técnica.
      for (const pedido of selosDasCondicoesDoAcerto(aoAcertar)) {
        const feito = seloDoGolpe({ ...turnos, selos }, { ...golpe, nome: aoAcertar.origem, selo: pedido }, alvo)
        if (feito === null) continue
        partes.push(feito.parte)
        selos = feito.selos
      }
    }
    const casas = aoAcertar.empurrar ?? 0
    if (casas > 0 && mesa.empurrarToken !== undefined) {
      const empurrao = mesa.empurrarToken(sceneKey, alvo.tokenId, golpe.atacanteTokenId, casas)
      if (empurrao !== null && empurrao.casas > 0) {
        partes.push({ tipo: 'empurrao', tokenId: alvo.tokenId, empurrao })
        notas.push(`empurrado ${empurrao.casas} ${empurrao.casas === 1 ? 'casa' : 'casas'}`)
      } else if (empurrao !== null) notas.push('não tinha para onde ser empurrado')
    }
    if (partes.length === 0 && notas.length === 0) return null
    const texto = notas.join('; ')
    const comTexto: AlvoDoGolpe = texto === '' ? alvo : { ...alvo, disputa: alvo.disputa === undefined || alvo.disputa === '' ? texto : `${alvo.disputa}; ${texto}` }
    return { selado: { selos, parte: { tipo: 'composta', partes } }, alvo: comTexto }
  }

  /** Os selos do golpe (o da mira ou da técnica, o da bala de texto e os a mais) no alvo acertado. */
  const selosNoAcerto = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    // Rework das habilidades (D10): o selo principal com a queda em % também já vai em números (o mesmo golpe nos outros campos).
    const feito = seloDoGolpeNoAcerto(turnos, golpe.selo?.queda?.emPorcento === true ? { ...golpe, selo: quedaFixadaNoAlvo(golpe.selo, alvo) } : golpe, alvo)
    // F2 (revisão da fatia E, Bala de Prata): o selo da bala pega junto, por cima do da mira, do da técnica e da marca.
    // Fase 5: os selos a mais da técnica montada pegam do mesmo jeito, um depois do outro (cada um com o seu Desfazer).
    // Fase ED4: cada um com o seu teste (`pega`), rolado na ordem dos selos.
    // Rework das habilidades (D10): a queda em % do Diminui atributo vira números com o atributo do alvo agora ("fixado no acerto").
    const extras = [...(golpe.seloDaBala === undefined ? [] : [golpe.seloDaBala]), ...(golpe.selosAMais ?? [])].map((extra) => quedaFixadaNoAlvo(extra, alvo))
    return extras.reduce((ate, extra) => {
      const teste = testeDoSelo(turnos, golpe, extra, ate.alvo)
      if (!teste.pega) return { ...ate, alvo: teste.alvo }
      const mais = seloDoGolpe(ate.selado === null ? turnos : { ...turnos, selos: ate.selado.selos }, { ...golpe, selo: extra }, teste.alvo)
      if (mais === null) return { ...ate, alvo: teste.alvo }
      return { alvo: teste.alvo, selado: ate.selado === null ? mais : { selos: mais.selos, parte: { tipo: 'composta', partes: [ate.selado.parte, mais.parte] } } }
    }, feito)
  }

  /** D10: o selo com queda em % já em números, pelo atributo do alvo (o token sem ficha perde 0). Sem queda em %: o MESMO pedido. */
  const quedaFixadaNoAlvo = (pedido: SeloDoGolpe, alvo: AlvoDoGolpe): SeloDoGolpe => {
    if (pedido.queda?.emPorcento !== true) return pedido
    const dele = alvo.personagemId === null ? undefined : mesaDoRpg().personagens.find((candidato) => candidato.id === alvo.personagemId)
    return quedaEmNumeros(pedido, (atributo) => (dele === undefined ? 0 : valorDoRank(dele, atributo)))
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
    const doSelo: Reversao = depois === null ? { tipo: 'selo', seloId, antes } : { tipo: 'selo', seloId, antes, editado: true }
    // Nº 3 do levantamento: tirar o espelho tira a pastilha dele (e o prazo) da ficha do mapa; senão a vez seguinte o poria de volta.
    const daFicha = depois === null && antes.daPastilha === true ? tirarPastilhasNaMesa(mesa, sceneKey, antes.tokenId, [antes.nome]) : null
    // ITENS REFEITOS, E6c: o espelho de uma condição da FICHA de personagem: ela sai da ficha também.
    const personagemId = cena.turnos.cartas.find((carta) => carta.tokenId === antes.tokenId)?.personagemId ?? null
    const daPersonagem = depois === null && antes.daPastilha === true && personagemId !== null ? tirarDaFichaPeloEspelho(mesa, personagemId, antes.nome) : null
    const partes = [doSelo, ...(daFicha === null ? [] : [daFicha]), ...(daPersonagem === null ? [] : [daPersonagem.parte])]
    const reversao: Reversao = partes.length === 1 ? doSelo : { tipo: 'composta', partes }
    gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, selos }, { tipo: 'selo', texto, tokenIds: [antes.tokenId], reversao }))
    return true
  }

  const acoes: Pick<BatalhaState, 'porSelo' | 'editarSelo' | 'tirarSelo' | 'tirarSelosPeloUso'> = {
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

    tirarSelosPeloUso: (sceneKey, tokenId, nomes, quem) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || nomes.length === 0) return null
      const saem = selosQueALimpezaTira(cena.turnos.selos, tokenId, { nomes }).filter((selo) => selo.daPastilha !== true)
      if (saem.length === 0) return null
      const ids = new Set(saem.map((selo) => selo.id))
      const selos = (cena.turnos.selos ?? []).filter((selo) => !ids.has(selo.id))
      const nome = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(tokenId)
      const texto = `${quem} tirou ${saem.map((selo) => textoDoSelo(selo)).join(', ')} de ${nome} (item usado fora da batalha)`
      const reversao: Reversao = { tipo: 'composta', partes: saem.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })) }
      const id = novoIdDeLinha()
      gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, selos }, { id, tipo: 'selo', texto, tokenIds: [tokenId], reversao }))
      return id
    },
  }
  return { seloNoAcerto, aliadosNaLutaDe, acoes }
}

/** O que `criarSelos` devolve. */
export type SelosDaBatalha = ReturnType<typeof criarSelos>
