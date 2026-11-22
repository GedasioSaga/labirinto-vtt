/**
 * A fatia do GOLPE da store da batalha One Piece: agir com a carta da vez, a reação do alvo (com técnica,
 * esquiva, passar), o dano no alvo com a marca e as reduções, os golpes sem resposta que fecham na virada
 * e os ajustes do mestre no golpe (dano à mão, ações extras, armas, carga, perfurante).
 */
import {
  ARMAS_NA_BATALHA_MAX,
  chaveDaVez,
  combateVazio,
  CONTRAS_MAX,
  DANO_MAX,
  GOLPES_PENDENTES_MAX,
  MODIFICADOR_DA_REACAO_MAX,
  PERFURACAO_MAX,
  type AlvoDoGolpe,
  type CombateDoPersonagem,
  type ContraAtaque,
  type GolpeDaBatalha,
  type PedidoDeAcao,
  type SaidaDaReacao,
} from '../../lib/batalha/combate'
import { comBandosEmDia, invocadoDoToken } from '../../lib/batalha/invocacao'
import { NOME_DA_MARCA, acertoNaMarca, criarMarca, golpeComOAlvo, marcaDoToken, passivaDaMarca, type AcertoNaMarca } from '../../lib/batalha/marca'
import { bonusDaBatalha, comSeloNovo, criarSelo, ondeNaVez, novoIdDeSelo, selosDoToken } from '../../lib/batalha/selos'
import { curaComOsSelos, curaDoDano, esquivaComDesvantagem, saidasComOsSelos, selosQueSaemNoGolpe, travaDoToken, vantagemDaReacao } from '../../lib/batalha/condicoes'
import { selosQueALimpezaTira } from '../../lib/batalha/debuffs'
import { ajustesDoRecursoDaCura, curaPelaParteDoMaximo, notaDoRecursoDaCura, quantoCabeNoRecurso } from '../../lib/batalha/curaDoRecurso'
import { danoComAsReducoes, nomesDasReducoes, porcentoDasReducoes, reducoesDoDano, reducoesDosSelos } from '../../lib/batalha/reducaoDoDano'
import {
  golpePendente,
  lancarGolpe,
  PARTES_SEGUINTES_MAX,
  partesSeguintes,
  podeAgir,
  passarSemDano,
  resolverAlvo,
  rolarReacao,
  textoDaReacaoComTecnica,
  textoDaRolagem,
  textoDoGolpe,
  type ContextoDoGolpe,
} from '../../lib/batalha/golpe'
import { lerDano } from '../../lib/batalha/formula'
import { chavesDoDono, disputaNoUso, formulaDaCura, limpezaDe, mecanicaDoCartao, reacaoAMaoDe, rebatePertoDe, saidasTiradasDoDono } from '../../lib/batalha/mecanicasAMao'
import { comADisputaNoUso } from '../../lib/batalha/disputaNoUso'
import { debuffsDobrados } from '../../lib/batalha/debuffs'
import { motivoDaReacaoComTecnica, reacoesDisponiveis, reagirComTecnica, temOverloadDeReacao, temReacaoContraSurpresa, type PedidoDeTecnica } from '../../lib/batalha/reacaoComTecnica'
import { casaNaAreaVirada, pegadaDaFicha } from '../../lib/batalha/area'
import { recursoDeVida, vidaDoPersonagem } from '../../lib/vidaDaFicha'
import { armasDe, limiteDeArmas, recursoDoEscudo, tecnicaPorId } from '../../lib/batalha/leituraDaFicha'
import { fichaComAMochilaDoBoneco } from '../../lib/batalha/municaoDaFicha'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import { ajustesDaCura, ajustesDoDano, curaQueCabe, notaDaCura, perfuracaoValida, rolarComVantagem, rolarODadoDaEsquiva, saidaDoPassar, saidasDaRolagem } from '../../lib/batalha/reacao'
import { escudoMaisAlto, nomeDoAutor, novoIdDeLinha, type Reversao, type TipoDaLinha } from '../../lib/batalha/registro'
import { cartaDaVez, contraGanhoAgora, type AcoesExtras, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../../lib/batalha/turnos'
import { revelacaoAoUsar } from '../../lib/habilidadeOculta'
import { chavesDosSelos } from '../../lib/ponteDasCondicoes'
import { condicoesQueACuraTirou, curarPeloItem } from '../../lib/curaPeloItem'
import { comCondicoes, condicoesDaFicha } from '../../lib/turnoForaDaBatalha'
import type { BatalhaDaCena, BatalhaState } from './tipos'
import {
  MESTRE,
  GASTO_ZERO,
  nomeDaCarta,
  type LinhaNova,
  comMudanca,
  type EfeitoNovo,
  comEfeitos,
  quemNaFicha,
  personagemDoTokenNa,
  nomeDoTokenNa,
  nomeDoBandoNa,
  linhaAtualizada,
  partesDosLembretes,
} from './cena'
import { mexerNaFicha, type Recusada, type CuraDoItemNoAlvo, gastarMunicaoNaMesa, semOsCaidos, textoDosQueSairam, reversaoDaFicha } from './naMesa'
import { devolverFichasDaAcao } from './desfazer'
import type { NucleoDaBatalha } from './nucleo'
import type { FormasDaBatalha } from './formas'
import type { SelosDaBatalha } from './selos'

function novoIdDeGolpe(): string {
  return `golpe_${crypto.randomUUID()}`
}

/** R5: a ficha do token gastou a reação no contador (fica sem reagir até a vez dela). */
function gastouAReacao(turnos: TurnosDaCena, tokenId: string): boolean {
  const personagemId = personagemDoTokenNa(turnos)(tokenId)
  return personagemId !== undefined && personagemId !== null && turnos.combate?.[personagemId]?.semReacao === true
}

/** A lista com o golpe trocado (ou tirado, se não espera mais ninguém). */
function comGolpe(golpes: readonly GolpeDaBatalha[] | undefined, golpe: GolpeDaBatalha): GolpeDaBatalha[] {
  const outros = (golpes ?? []).filter((candidato) => candidato.id !== golpe.id)
  return golpePendente(golpe) ? [...outros, golpe] : outros
}

/**
 * O dano final do alvo na ficha dele, com o efeito "dano". Golpe perfurante (Q4) não gasta o Escudo; com `perfuracao`, só
 * aquela porcentagem pula o Escudo. `'recusada'` (bug 11): a mesa não gravou o dano; quem chama para sem linha e sem animação.
 */
function danoNoAlvo(mesa: MesaDaBatalha, alvo: AlvoDoGolpe, golpe: Pick<GolpeDaBatalha, 'perfurante' | 'perfuracao'> & Partial<Pick<GolpeDaBatalha, 'curaDoDano' | 'atacantePersonagemId'>>, autor: AutorDaAcao): { partes: Reversao[]; efeito: EfeitoNovo | null } | Recusada {
  if (alvo.danoFinal === undefined || alvo.saida === undefined) return { partes: [], efeito: null }
  const valor = alvo.danoFinal
  const partes = alvo.personagemId === null || valor <= 0 ? null : mexerNaFicha(mesa, alvo.personagemId, (atual, sistema) => ajustesDoDano(atual, sistema, valor, golpe.perfurante, golpe.perfuracao), quemNaFicha(autor))
  if (partes === 'recusada') return partes
  const reversao: Reversao[] = alvo.personagemId === null ? [] : [...reversaoDaFicha(alvo.personagemId, partes)]
  // F2 (fatia C, Bênção de uma Raposa): quem bateu recupera a porcentagem do dano que causou, na mesma linha (o Desfazer tira junto).
  // A cura recusada (a ficha de quem bateu não grava) não derruba o golpe: o dano já valeu.
  const quemBateu = golpe.atacantePersonagemId ?? null
  const cura = partes === null || quemBateu === null ? 0 : curaDoDano(valor, golpe.curaDoDano ?? 0)
  const curou = cura === 0 || quemBateu === null ? null : mexerNaFicha(mesa, quemBateu, (atual, sistema) => ajustesDaCura(atual, sistema, cura), quemNaFicha(autor))
  if (curou !== null && curou !== 'recusada' && quemBateu !== null) reversao.push(...reversaoDaFicha(quemBateu, curou))
  // A animação toca sempre (esquiva também: "ESQUIVOU" sobre a ficha).
  return { partes: reversao, efeito: { tipo: 'dano', tokenId: alvo.tokenId, valor, saida: alvo.saida } }
}

export function novoIdDaMarca(): string {
  return `marca_${crypto.randomUUID()}`
}

/**
 * R1 (lote de 01/11): o alvo resolvido passa pela marca ANTES do dano na
 * ficha (o dobro sai no número do dano e no texto). A passiva de marca é a do
 * personagem de quem atacou; a técnica que marca é a do golpe (`golpe.marca`).
 */
function acertoComMarca(mesa: MesaDaBatalha, turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): AcertoNaMarca {
  const sistema = mesa.sistema()
  const atacante = golpe.atacantePersonagemId === null ? undefined : mesa.personagens().find((personagem) => personagem.id === golpe.atacantePersonagemId)
  const passiva = sistema === null || atacante === undefined ? null : (passivaDaMarca(atacante, sistema)?.cartao ?? null)
  const tecnicaQueMarca = golpe.marca === undefined ? null : { id: golpe.marca, nome: golpe.nome }
  const acerto = acertoNaMarca(turnos, golpe, alvo, { linhaId: golpe.linhaId, novoId: novoIdDaMarca, passiva, tecnicaQueMarca })
  // R6: a forma ligada do alvo que reduz o dano recebido (Resiliente: -20%), depois do dobro da marca.
  // S4: e a Determinação (rank 4+, HP abaixo da metade), uma depois da outra.
  const dele = alvo.personagemId === null || sistema === null ? undefined : mesa.personagens().find((personagem) => personagem.id === alvo.personagemId)
  const { danoFinal } = acerto.alvo
  if (dele === undefined || sistema === null || danoFinal === undefined || danoFinal <= 0) return acerto
  // Fase 5: e o selo montado com regra de dano recebido (−20% a menos, +50% a mais), por último.
  const dosSelos = reducoesDosSelos(acerto.turnos.selos, alvo.tokenId)
  const reducoes = [...reducoesDoDano(dele, sistema), ...dosSelos]
  if (reducoes.length === 0) return acerto
  const reduzido: AlvoDoGolpe = { ...acerto.alvo, danoFinal: danoComAsReducoes(danoFinal, reducoes), reducao: porcentoDasReducoes(reducoes) }
  // Só a forma: o registro segue "(forma −20%)", como antes.
  if (dosSelos.length > 0 || reducoes.some((reducao) => reducao.nome === 'Determinação')) reduzido.reducaoDe = nomesDasReducoes(reducoes)
  return { ...acerto, alvo: reduzido }
}

/**
 * Conserto das fichas F1 (bug 2): os golpes lançados na vez que está
 * acabando, o contra-ataque fora da vez incluído: a linha deles veio depois
 * da linha "vez" de pé mais nova. O alvo deles ainda não teve tempo de
 * responder, então esperam a virada seguinte. Sem linha "vez" (a primeira vez
 * da batalha): todos são da vez de agora.
 */
export function golpesDaVezQueAcaba(cena: BatalhaDaCena): ReadonlySet<string> {
  let comeco = Number.NEGATIVE_INFINITY
  for (let i = cena.registro.length - 1; i >= 0; i -= 1) {
    const linha = cena.registro[i]
    if (linha !== undefined && linha.tipo === 'vez' && linha.desfeita === undefined) {
      comeco = linha.seq
      break
    }
  }
  const depois = new Set(cena.registro.filter((linha) => linha.seq > comeco).map((linha) => linha.id))
  return new Set((cena.turnos.golpes ?? []).filter((golpe) => depois.has(golpe.linhaId)).map((golpe) => golpe.id))
}

/** "+1 Simples, +1 Bônus". */
function textoDasExtras(extras: AcoesExtras): string {
  const partes = [extras.simples > 0 ? `+${extras.simples} Simples` : null, extras.bonus > 0 ? `+${extras.bonus} Bônus` : null, extras.mov > 0 ? `+${extras.mov} Movimento` : null]
  return partes.filter((parte): parte is string => parte !== null).join(', ')
}

const EXTRAS_MAX = 20

function contadorDeExtra(valor: number): number {
  return Number.isFinite(valor) ? Math.min(EXTRAS_MAX, Math.max(0, Math.trunc(valor))) : 0
}

/** O golpe preso ao núcleo da store, às formas e aos selos. */
export function criarGolpe(nucleo: NucleoDaBatalha, fatiaDasFormas: FormasDaBatalha, fatiaDosSelos: SelosDaBatalha) {
  const { mesa, deps, mesaDoRpg, cenaDe, gravarCena, avisarQuemCaiu, revelarAoUsar, lembrarDepoisDoDano } = nucleo
  const { cansarNoOverload, subidaDoPedido, mudarForma } = fatiaDasFormas
  const { seloNoAcerto, aliadosNaLutaDe } = fatiaDosSelos

  /**
   * A CURA TIRA O VENENO (`lib/curaPeloItem.ts`): o que a cura pelo item tira
   * da ficha `tokenId` no mapa, só lido (nada gravado). O selo de mesmo nome
   * segura a pastilha (a Medicina só cura e deixa os debuffs). `null` = nada a
   * tirar, ou a mesa sem mapa (arena).
   */
  const curaDoItemNoAlvo = (sceneKey: string, tokenId: string, selos: TurnosDaCena['selos']): CuraDoItemNoAlvo | null => {
    const antes = mesa.fichaDaCena?.(sceneKey, tokenId) ?? null
    if (antes === null || mesa.mudarFichaDaCena === undefined) return null
    const depois = curarPeloItem(antes, chavesDosSelos(selos).get(tokenId))
    if (depois === antes) return null
    return { tokenId, antes, depois, curou: condicoesQueACuraTirou(antes, depois) }
  }

  /** Grava as curas pelo item (depois de todo alvo aceito) e devolve as partes do Desfazer: as condições voltam como estavam. */
  const gravarCurasDoItem = (sceneKey: string, curas: readonly CuraDoItemNoAlvo[]): Reversao[] => {
    const { mudarFichaDaCena } = mesa
    if (mudarFichaDaCena === undefined) return []
    return curas.map(({ tokenId, antes, depois }): Reversao => {
      const campos = condicoesDaFicha(depois)
      mudarFichaDaCena(sceneKey, tokenId, (token) => comCondicoes(token, campos))
      return { tipo: 'prazo', tokenId, antes: condicoesDaFicha(antes) }
    })
  }

  /**
   * Tipos de habilidade F1: a reação COM TÉCNICA (sem d20, ou "rolar" com o
   * d20 do host). Confere a regra (`motivoDaReacaoComTecnica`), cobra o custo
   * pela aventura, marca recarga, usos e Overload, resolve o alvo (dano,
   * selo do golpe, contra-ataque da Q6), põe o selo em quem atacou se pedido
   * e escreve a linha "reacao" própria, com Desfazer que volta tudo e devolve
   * o alvo à espera. Não gasta ação da vez. A linha do golpe ganha o texto
   * novo ("esquivou com Passo de Valsa").
   */
  const reagirComTecnicaNaCena = (sceneKey: string, cena: BatalhaDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe, autor: AutorDaAcao, pedido: PedidoDeTecnica): boolean => {
    const { turnos } = cena
    // F2 (fatia B, o "perto" do Aplauso): quem reage no lugar do alvo é um dos `porPerto` dele, só com a técnica que rebate e só rebatendo.
    const { por } = pedido
    if (por !== undefined && (!(alvo.porPerto ?? []).includes(por) || pedido.saida !== 'contra' || rebatePertoDe(pedido.cartaoId) === null)) return false
    const reageTokenId = por ?? alvo.tokenId
    const personagemId = por === undefined ? alvo.personagemId : (personagemDoTokenNa(turnos)(por) ?? null)
    if (personagemId === null) return false
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    const combateAntes = turnos.combate?.[personagemId]
    // Conserto das fichas F1: contra golpe Overload, só técnica Overload. F2 (revisão da fatia E): contra Surpresa, só a que vale contra
    // ela; a técnica que o mestre confirma (Recuperação de forças) só ele usa.
    if (motivoDaReacaoComTecnica({ personagem, sistema, combate: combateAntes, quemPede: autor.tipo }, alvo, pedido, golpe.overload, golpe.surpresa) !== null || personagem === null || sistema === null) return false
    // S4: Atordoado ou Paralisado não reage, nem com técnica.
    if (travaDoToken(turnos.selos, reageTokenId) !== null) return false
    // F2 (revisão da fatia D): quem está preso no Campo de Contenção rola com desvantagem, sem marcar.
    const selosDeQuemReage = selosDoToken(turnos.selos, reageTokenId)
    const rolado = pedido.saida === 'rolar' ? rolarComVantagem(deps.rolarD20, vantagemDaReacao(pedido.vantagem, selosDeQuemReage, golpe)) : null
    // F2 (revisão da fatia E): o Marcado esquiva com desvantagem também depois da técnica que rola (o Giro da Lança tem a rolagem dele).
    // Fase 4: pelo cartão (não pelo id), para a reação montada que rola o dado (o Aparar) contar como rolagem própria.
    const cartaoDaReacao = tecnicaPorId(personagem, sistema, pedido.cartaoId)?.cartao ?? pedido.cartaoId
    const esquiva = rolado !== null && reacaoAMaoDe(cartaoDaReacao)?.rolagem === undefined && esquivaComDesvantagem(selosDeQuemReage, rolado.vantagem?.modo) ? rolarODadoDaEsquiva(deps.rolarD20, rolado.d20) : undefined
    const combateBase = combateAntes ?? combateVazio()
    const lida = reagirComTecnica(golpe, alvo.tokenId, pedido, personagem, sistema, combateBase, rolado?.d20 ?? null, rolado?.vantagem, esquiva)
    if (lida === null) return false
    // R1: resolvido na reação, o alvo passa pela marca antes do dano (o golpe da reversão já leva o dobro).
    const acerto = lida.alvo.danoFinal === undefined ? null : acertoComMarca(mesa, turnos, lida.golpe, lida.alvo)
    const feita = acerto === null ? lida : { ...lida, alvo: acerto.alvo, golpe: golpeComOAlvo(lida.golpe, acerto.alvo) }
    const quem = quemNaFicha(autor)
    const partes: Reversao[] = [{ tipo: 'reacaoComTecnica', golpe: feita.golpe, tokenId: alvo.tokenId, alvoAntes: alvo }, ...(acerto?.partes ?? [])]
    const efeitos: EfeitoNovo[] = []
    let novos: TurnosDaCena = { ...(acerto?.turnos ?? turnos), golpes: comGolpe(turnos.golpes, feita.golpe) }
    // `depoisDaTecnica` devolve o MESMO combate quando a técnica não marca nada (sem recarga, usos nem Overload).
    if (feita.combate !== combateBase) {
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois: feita.combate })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: feita.combate } }
    }
    if (feita.custo.length > 0) {
      const custo = feita.custo
      const doCusto = mexerNaFicha(mesa, personagemId, () => custo, quem)
      // Bug 11: custo recusado = a reação não sai (o alvo segue esperando).
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, doCusto))
    }
    // Conserto das fichas F1 (Overload, resposta da May "nos 2 modos"): reagir com Overload também cansa.
    if (feita.combate.overload && !combateBase.overload) {
      const cansado = cansarNoOverload(personagemId, reageTokenId, novos)
      if (cansado !== null) {
        partes.push(...cansado.partes)
        novos = cansado.turnos
      }
    }
    const { alvo: depois } = feita
    let golpeFeito = feita.golpe
    let textoDoRebate = ''
    if (depois.rolagem !== undefined && depois.danoFinal === undefined) {
      efeitos.push({ tipo: 'reacao', golpeId: golpe.id, tokenId: depois.tokenId, d20: depois.rolagem.d20, modificador: depois.rolagem.modificador, total: depois.rolagem.total })
    } else {
      const dano = danoNoAlvo(mesa, depois, golpe, autor)
      // Bug 11: o dano recusado leva o custo junto de volta; a reação não sai.
      if (dano === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(...dano.partes)
      if (dano.efeito !== null) efeitos.push(dano.efeito)
      // F3 (Q6): o selo do golpe só pega se o golpe acertou este alvo (Metade, Receber). F2 (fatia B): com a disputa da mecânica à mão.
      const noAcerto = seloNoAcerto(novos, golpe, depois)
      if (noAcerto.alvo !== depois) {
        golpeFeito = golpeComOAlvo(golpeFeito, noAcerto.alvo)
        novos = { ...novos, golpes: comGolpe(turnos.golpes, golpeFeito) }
      }
      const selado = noAcerto.selado
      if (selado !== null) {
        partes.push(selado.parte)
        novos = { ...novos, selos: selado.selos }
      }
      // F2 (fatia B, Aplauso da May): a técnica que REBATE devolve o dano que chegou + a Força dela em quem atacou, na hora (no lugar do contra-ataque).
      const rebate = depois.saida === 'contra' && depois.tecnica !== undefined ? mecanicaDoCartao(depois.tecnica.cartaoId)?.rebate : undefined
      // F2 (fatia D, Armadura Humana "Atacar"): toma o golpe inteiro e devolve o que tomou ÷ 7 (para baixo) em quem atacou, sem reação.
      const devolve = feita.devolveDividido === undefined || feita.devolveDividido <= 0 ? 0 : Math.floor((depois.danoFinal ?? 0) / feita.devolveDividido)
      if (devolve > 0) {
        const noAtacante: AlvoDoGolpe = { tokenId: golpe.atacanteTokenId, personagemId: golpe.atacantePersonagemId, dano: devolve, podeReagir: false, saida: 'semReacao', danoFinal: devolve }
        const devolvido = danoNoAlvo(mesa, noAtacante, { perfurante: false }, autor)
        if (devolvido === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...devolvido.partes)
        if (devolvido.efeito !== null) efeitos.push(devolvido.efeito)
        textoDoRebate = ` · devolveu ${devolve} em ${nomeDoTokenNa(turnos, personagens)(golpe.atacanteTokenId)} (${depois.danoFinal ?? 0} ÷ ${feita.devolveDividido ?? 1})`
      } else if (rebate !== undefined) {
        // A Força de antes da reação: o cansaço do Overload dela vem DEPOIS de rebater.
        const lida = lerDano(rebate.soma, { personagem, sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(turnos.selos, reageTokenId) })
        const soma = lida.tipo === 'valor' ? lida.valor : 0
        const total = Math.min(DANO_MAX, (depois.dano ?? 0) + soma)
        const noAtacante: AlvoDoGolpe = { tokenId: golpe.atacanteTokenId, personagemId: golpe.atacantePersonagemId, dano: total, podeReagir: false, saida: 'semReacao', danoFinal: total }
        const rebatido = danoNoAlvo(mesa, noAtacante, { perfurante: false }, autor)
        if (rebatido === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...rebatido.partes)
        if (rebatido.efeito !== null) efeitos.push(rebatido.efeito)
        textoDoRebate = ` · rebateu ${total} em ${nomeDoTokenNa(turnos, personagens)(golpe.atacanteTokenId)} (${depois.dano ?? 0} + ${soma})`
      } else if (depois.saida === 'contra' && (novos.contras?.length ?? 0) < CONTRAS_MAX) {
        // Q6: Contra = sem dano e uma ação a mais na hora (sai no Desfazer pela parte "reacaoComTecnica").
        const ganho: ContraAtaque = contraGanhoAgora(turnos, { golpeId: golpe.id, tokenId: depois.tokenId, personagemId: depois.personagemId, atacanteTokenId: golpe.atacanteTokenId })
        novos = { ...novos, contras: [...(novos.contras ?? []), ganho] }
      }
      // F2 (fatia E, Recuperação de forças): 20% do dano que chegava volta em vida (até o máximo); só o mestre usa (ele confirmou o fogo ou a explosão).
      const cura = feita.cura ?? 0
      const curou = cura <= 0 ? null : mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDaCura(atual, sistemaDaMesa, cura), quem)
      if (curou === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      if (curou !== null) {
        partes.push(...reversaoDaFicha(personagemId, curou))
        textoDoRebate += ` · come o golpe e cura ${cura} (o mestre confirmou: fogo ou explosão)`
      }
    }
    // O selo da técnica em QUEM ATACOU ("Marcado"), se marcado na caixa e o atacante segue na ordem.
    // "Marcado" é a MARCA de verdade (Passo de Valsa, decisão do usuário 01/11): o próximo golpe que acertar dá o dobro; uma por alvo.
    const linhaId = novoIdDeLinha()
    const marcaNoAtacante = feita.seloNoAtacante?.nome === NOME_DA_MARCA && depois.tecnica !== undefined
    const atacanteJaMarcado = marcaNoAtacante && marcaDoToken(novos.selos, golpe.atacanteTokenId) !== undefined
    if (feita.seloNoAtacante !== null && !atacanteJaMarcado && turnos.cartas.some((carta) => carta.tokenId === golpe.atacanteTokenId)) {
      const selo =
        marcaNoAtacante && depois.tecnica !== undefined
          ? criarMarca(novos, golpe.atacanteTokenId, { selo: novoIdDaMarca(), linha: linhaId }, { id: depois.tecnica.cartaoId, nome: depois.tecnica.nome })
          : criarSelo(golpe.atacanteTokenId, feita.seloNoAtacante, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: depois.tecnica?.nome })
      const selos = comSeloNovo(novos.selos, selo)
      if (selos !== null) {
        partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
        novos = { ...novos, selos }
      }
    }
    // Tipos de habilidade F3: o dano (ou o custo de HP da técnica) pode levar alguém abaixo do gatilho de vida.
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    const comOGolpe = { ...atual, registro: linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(golpeFeito, nomeDoToken), []) }
    const quemReage = por === undefined ? textoDaReacaoComTecnica(depois, nomeDoToken) : `${nomeDoToken(por)} reage com ${depois.tecnica?.nome ?? 'técnica'} por ${nomeDoToken(depois.tokenId)}: o golpe não pega`
    const texto = quemReage + textoDoRebate
    gravarCena(sceneKey, {
      ...comMudanca(comOGolpe, novos, { id: linhaId, tipo: 'reacao', texto, autor, tokenIds: [...new Set([reageTokenId, depois.tokenId, golpe.atacanteTokenId])], reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    revelarAoUsar(personagemId, pedido.cartaoId)
    avisarQuemCaiu(sceneKey, autor)
    return true
  }

  /**
   * R3 (lote de 01/11): o alvo passa sem tomar dano, antes ou depois do dado.
   * Nada de ficha, selo, marca nem contra: só o golpe resolvido e a linha
   * "reacao" própria ("Siegfried passou sem dano"), cujo Desfazer devolve o
   * alvo à espera pela mesma parte da reação com técnica.
   */
  const passarSemDanoNaCena = (sceneKey: string, cena: BatalhaDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe, autor: AutorDaAcao): boolean => {
    const novo = passarSemDano(golpe, alvo.tokenId)
    if (novo === golpe) return false
    const nomeDoToken = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)
    const atual = cenaDe(sceneKey) ?? cena
    const novos: TurnosDaCena = { ...atual.turnos, golpes: comGolpe(atual.turnos.golpes, novo) }
    const comOGolpe = { ...atual, registro: linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(novo, nomeDoToken), []) }
    const texto = `${nomeDoToken(alvo.tokenId)} passou sem dano`
    const linha: LinhaNova = { tipo: 'reacao', texto, autor, tokenIds: [...new Set([alvo.tokenId, golpe.atacanteTokenId])], reversao: { tipo: 'reacaoComTecnica', golpe: novo, tokenId: alvo.tokenId, alvoAntes: alvo } }
    if (alvo.personagemId !== null) linha.personagemIds = [alvo.personagemId]
    gravarCena(sceneKey, comMudanca(comOGolpe, novos, linha))
    return true
  }

  /**
   * O corpo do `agir`: lança o golpe (ou concentra, ou move pelo contra) pela
   * carta `carta`. `turnosDoCtx` são os turnos que a regra lê (para o
   * invocado, com o gasto DELE no lugar do da carta do bando); `chaveDoGasto`
   * é onde o gasto novo é gravado (`carta.id`, ou a chave do membro do
   * bando). A base do que muda é sempre `cena.turnos`.
   */
  /**
   * F2 (fatia B, o "perto" do Aplauso = o 6x6 à frente da May): as fichas que
   * podem rebater o golpe Overload de `atacanteTokenId` no alvo: técnica de
   * reação Overload disponível com rebate e área `perto` (mecânica à mão), o
   * alvo dentro dela, sem Atordoado nem Paralisado; fora quem ataca e o
   * próprio alvo. A mesa sem mapa (arena, duelo) não sabe onde ninguém está:
   * ninguém.
   */
  const quemRebatePor = (sceneKey: string, turnos: TurnosDaCena, atacanteTokenId: string) => (alvoTokenId: string): string[] => {
    const { personagens, sistema } = mesaDoRpg()
    const doAlvo = mesa.posicaoDoToken?.(sceneKey, alvoTokenId) ?? null
    if (sistema === null || doAlvo === null) return []
    const tokens = new Set<string>()
    for (const carta of turnos.cartas) {
      const { tokenId, personagemId } = carta
      // Como o alvo: quem gastou a reação no contador (R5) ou está travado (S4) não reage.
      if (personagemId === null || tokenId === alvoTokenId || tokenId === atacanteTokenId || tokens.has(tokenId) || gastouAReacao(turnos, tokenId) || travaDoToken(turnos.selos, tokenId) !== null) continue
      const personagem = personagens.find((candidato) => candidato.id === personagemId)
      if (personagem === undefined) continue
      const areas = reacoesDisponiveis(personagem, sistema, turnos.combate?.[personagemId]).flatMap((reacao) => {
        const perto = reacao.overload && reacao.motivo === null ? rebatePertoDe(reacao.cartao) : null
        return perto === null ? [] : [perto]
      })
      const dele = areas.length === 0 ? null : (mesa.posicaoDoToken?.(sceneKey, tokenId) ?? null)
      if (dele !== null && areas.some((forma) => casaNaAreaVirada(forma, dele.casa, dele.direcao, doAlvo.casa))) tokens.add(tokenId)
    }
    return [...tokens]
  }

  /** O que a regra do golpe lê para `carta` agir agora (`podeAgir`, `lancarGolpe`). */
  const contextoDaCarta = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, turnosDoCtx: TurnosDaCena): ContextoDoGolpe => {
    const { turnos } = cena
    const { personagens, sistema } = mesaDoRpg()
    const daFicha = carta.personagemId === null ? null : (personagens.find((candidato) => candidato.id === carta.personagemId) ?? null)
    // MUNIÇÃO: na aventura que não migrou a mochila, a bala conta (e o `podeAgir` recusa com 0) pela mochila do boneco, a dona.
    const personagem = daFicha === null ? null : fichaComAMochilaDoBoneco(daFicha, mesa.mochilaDoBoneco?.(sceneKey, carta.tokenId) ?? null)
    return {
      turnos: turnosDoCtx,
      carta,
      personagem,
      sistema,
      regras: cena.regras,
      autor,
      personagens,
      personagemDoToken: personagemDoTokenNa(turnos),
      // Invocação (decisão 8): o invocado não reage; o dano nele resolve na hora.
      // R5: quem gastou a reação no contador também não reage (até a vez dele).
      // Conserto das fichas F1 (S4): Atordoado ou Paralisado não reage (o golpe nele resolve na hora).
      semReacao: (tokenId) => invocadoDoToken(turnos, tokenId) !== null || gastouAReacao(turnos, tokenId) || travaDoToken(turnos.selos, tokenId) !== null,
      // Conserto das fichas F1: o golpe Overload espera só quem tem outra Overload de reação disponível.
      reageAOverload: (tokenId) => {
        const personagemId = personagemDoTokenNa(turnos)(tokenId)
        const alvo = personagemId === null || personagemId === undefined ? undefined : personagens.find((candidato) => candidato.id === personagemId)
        return alvo !== undefined && sistema !== null && temOverloadDeReacao(alvo, sistema, turnos.combate?.[alvo.id])
      },
      // F2 (revisão da fatia E): o golpe Surpresa espera só quem tem técnica que vale contra ela (Recuperação de forças).
      reageASurpresa: (tokenId) => {
        const personagemId = personagemDoTokenNa(turnos)(tokenId)
        const alvo = personagemId === null || personagemId === undefined ? undefined : personagens.find((candidato) => candidato.id === personagemId)
        return alvo !== undefined && sistema !== null && temReacaoContraSurpresa(alvo, sistema, turnos.combate?.[alvo.id])
      },
      quemRebatePor: quemRebatePor(sceneKey, turnos, carta.tokenId),
      // Fase 6: a ficha inteira na grade, para o host conferir o alcance e a área longe; a mesa sem mapa (o Testar) não confere.
      ...(mesa.posicaoDoToken === undefined
        ? {}
        : {
            pegadaDoToken: (tokenId: string) => {
              const posicao = mesa.posicaoDoToken?.(sceneKey, tokenId) ?? null
              return posicao === null ? null : pegadaDaFicha(posicao.casa, mesa.fichaDaCena?.(sceneKey, tokenId)?.size)
            },
          }),
      // U3: a regra única de "quem pode ajudar quem": o aliado é o do lado na luta, jogador ou NPC, para toda técnica (montada,
      // de texto e à mão), a mesma regra da mira do mestre. A Luz do Sol (o selo só nos aliados, sem dano neles) lê a mesma lista.
      aliados: aliadosNaLutaDe(carta.personagemId, turnos, personagens),
      // U2: o cheio do Escudo nesta batalha (o maior que a ficha teve), para a recusa da cura dizer que o Escudo segurou o golpe.
      escudoCheio: (personagemId) => {
        const escudo = sistema === null ? null : recursoDoEscudo(sistema)
        return escudo === null ? 0 : escudoMaisAlto(cena.registro, personagemId, escudo.id)
      },
    }
  }

  const agirComACarta = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, turnosDoCtx: TurnosDaCena, chaveDoGasto: string, pedido: PedidoDeAcao): boolean => {
    const { turnos } = cena
    const { personagens } = mesaDoRpg()
    const ctx = contextoDaCarta(sceneKey, cena, autor, carta, turnosDoCtx)
    if (podeAgir(ctx, pedido) !== null) return false
    const linhaId = novoIdDeLinha()
    // F2 (fatias B e C): os ids das partes seguintes vão sempre; só a técnica com `segundoGolpe` e o Atacar melhorado (Aira com a Bênção) os usam.
    const bruto = lancarGolpe(ctx, pedido, {
      golpe: novoIdDeGolpe(),
      linha: linhaId,
      segundo: { golpe: novoIdDeGolpe(), linha: novoIdDeLinha() },
      seguintes: Array.from({ length: PARTES_SEGUINTES_MAX }, () => ({ golpe: novoIdDeGolpe(), linha: novoIdDeLinha() })),
    })
    // F2 (fatia D, Explosão): a disputa da mecânica à mão rolada LOGO AO USAR (o alvo testa; passou = nada; se ninguém falhou, não gasta).
    // Construtor C1/C4: procura pelo cartão (o teste e a disputa da técnica montada vêm das peças; a cura e a limpeza também, mais abaixo).
    const cartaoDoPedido = pedido.tipo !== 'habilidade' ? null : ctx.personagem !== null && ctx.sistema !== null ? (tecnicaPorId(ctx.personagem, ctx.sistema, pedido.cartaoId)?.cartao ?? pedido.cartaoId) : pedido.cartaoId
    const noUso = cartaoDoPedido === null ? null : disputaNoUso(cartaoDoPedido)
    const fichaNaDisputa = (personagemId: string | null, tokenId: string) => {
      const dele = personagemId === null ? undefined : personagens.find((candidato) => candidato.id === personagemId)
      return dele === undefined ? null : { personagem: dele, bonus: bonusDaBatalha(turnos.selos, tokenId) }
    }
    const deQuemUsa = fichaNaDisputa(carta.personagemId, carta.tokenId)
    const usado =
      noUso === null || deQuemUsa === null || ctx.sistema === null
        ? null
        : comADisputaNoUso(bruto, noUso, {
            usa: deQuemUsa,
            fichaDoAlvo: (alvo) => fichaNaDisputa(alvo.personagemId, alvo.tokenId),
            combateAntes: carta.personagemId === null ? undefined : turnos.combate?.[carta.personagemId],
            sistema: ctx.sistema,
            carga: bruto.cargaUsada,
            rolarD20: deps.rolarD20,
          })
    const lancado = usado?.lancado ?? bruto
    const quem = quemNaFicha(autor)
    // A ordem da reversão é a da seção 3.6: gasto, combate, custo, contra-ataque, golpe, fichas dos alvos.
    const partes: Reversao[] = []
    let novos: TurnosDaCena = turnos
    if (lancado.gasto !== null) {
      partes.push({ tipo: 'gasto', cartaId: chaveDoGasto, antes: turnos.gastos[chaveDoGasto] ?? null })
      novos = { ...novos, gastos: { ...novos.gastos, [chaveDoGasto]: lancado.gasto } }
    }
    if (lancado.combate !== null && carta.personagemId !== null) {
      partes.push({ tipo: 'combate', personagemId: carta.personagemId, antes: turnos.combate?.[carta.personagemId] ?? null, depois: lancado.combate })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [carta.personagemId]: lancado.combate } }
    }
    if (lancado.custo.length > 0 && carta.personagemId !== null) {
      const custo = lancado.custo
      const doCusto = mexerNaFicha(mesa, carta.personagemId, () => custo, quem)
      // Bug 11: custo recusado = a técnica não sai (sem recarga, sem golpe, sem linha).
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(carta.personagemId, doCusto))
    }
    // MUNIÇÃO (pedido de 16/11/2026): o tiro com a bala ligada tira 1 da mochila da ficha (o boneco espelha). No host, o
    // tiro do jogador chega aqui pelo mesmo `agir`: o `podeAgir` acima já recusou a bala com 0.
    if (lancado.municao !== undefined && carta.personagemId !== null) {
      const parte = gastarMunicaoNaMesa(mesa, sceneKey, carta.tokenId, carta.personagemId, lancado.municao.armaId, lancado.municao.balaId)
      if (parte === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      if (parte !== null) partes.push(parte)
    }
    // Conserto das fichas F1 (Overload): quem usou fica com os atributos base pela metade até o fim da batalha.
    // F2b (revisão): só a técnica Overload cansa aqui; o golpe Overload pela forma (A Caçada Começa) cansa no fim dela.
    if (lancado.gastaOOverload === true && carta.personagemId !== null) {
      const cansado = cansarNoOverload(carta.personagemId, carta.tokenId, novos)
      if (cansado !== null) {
        partes.push(...cansado.partes)
        novos = cansado.turnos
      }
    }
    if (lancado.contraUsado !== null) {
      const usado = lancado.contraUsado
      partes.push({ tipo: 'contra', contra: usado })
      novos = { ...novos, contras: (novos.contras ?? []).filter((candidato) => !(candidato.golpeId === usado.golpeId && candidato.tokenId === usado.tokenId)) }
    }
    const efeitos: EfeitoNovo[] = []
    let golpe = lancado.golpe
    if (golpe !== null) {
      // F2 (fatia F, redoma da Orquídea): o selo que dura "até o próximo golpe" sai dos alvos deste golpe (antes do selo novo dele).
      // Construtor C5 (revisão): o montado não sai com a técnica de ajuda (a cura de um aliado, a técnica "em si").
      for (const saiu of selosQueSaemNoGolpe(novos.selos, golpe.alvos.map((alvo) => alvo.tokenId), lancado.ajuda === true)) {
        partes.push({ tipo: 'selo', seloId: saiu.id, antes: saiu })
        novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => selo.id !== saiu.id) }
      }
      // F2 (fatia F, Golpe Baixo): quem usa ganha o selo da técnica ("+8 em reação" por 2 turnos dele).
      if (golpe.seloEmQuemUsa !== undefined) {
        const proprio = criarSelo(carta.tokenId, golpe.seloEmQuemUsa, { id: novoIdDeSelo(), rodada: novos.rodada, ...ondeNaVez(novos), origem: golpe.nome })
        const comOProprio = comSeloNovo(novos.selos, proprio)
        if (comOProprio !== null) {
          partes.push({ tipo: 'selo', seloId: proprio.id, antes: null })
          novos = { ...novos, selos: comOProprio }
        }
      }
      partes.push({ tipo: 'golpe', golpeId: golpe.id })
      efeitos.push({ tipo: 'golpe', golpeId: golpe.id, atacanteTokenId: golpe.atacanteTokenId, nome: golpe.nome, alvos: golpe.alvos.map((alvo) => alvo.tokenId), surpresa: golpe.surpresa, overload: golpe.overload })
      for (const resolvido of lancado.resolvidos) {
        // R1: a marca antes do dano (o dobro, a marca da técnica, o lembrete da passiva).
        const acerto = acertoComMarca(mesa, novos, golpe, resolvido)
        novos = acerto.turnos
        golpe = golpeComOAlvo(golpe, acerto.alvo)
        const alvo = acerto.alvo
        const feito = danoNoAlvo(mesa, alvo, golpe, autor)
        // Bug 11: o dano recusado leva de volta o custo e o dano dos alvos anteriores; o golpe não sai.
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...feito.partes, ...acerto.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        // F3 (Q6): o selo do golpe pega no alvo que ele acertou (F2, fatia B: com a disputa da mecânica à mão).
        const noAcerto = seloNoAcerto(novos, golpe, alvo)
        golpe = golpeComOAlvo(golpe, noAcerto.alvo)
        const selado = noAcerto.selado
        if (selado !== null) {
          partes.push(selado.parte)
          novos = { ...novos, selos: selado.selos }
        }
      }
      // F2 (fatia D, Explosão): em quem falhou, os selos negativos dobram os turnos que faltam (Atordoado 2 vira 4).
      if (usado !== null && noUso?.seQuemUsaVence?.dobraOsDebuffs === true) {
        for (const tokenId of usado.venceuEm) {
          for (const { antes, depois } of debuffsDobrados(novos.selos, tokenId)) {
            partes.push({ tipo: 'selo', seloId: antes.id, antes, editado: true })
            novos = { ...novos, selos: (novos.selos ?? []).map((selo) => (selo.id === antes.id ? depois : selo)) }
          }
        }
      }
      // F2 (fatia D, Revigorar): tira os selos negativos (o cansaço do Overload junto) e cura, em cada alvo (ele ou um aliado).
      const limpeza = cartaoDoPedido === null ? null : limpezaDe(cartaoDoPedido)
      if (limpeza !== null && ctx.personagem !== null && ctx.sistema !== null) {
        const curasDoItem: CuraDoItemNoAlvo[] = []
        for (const alvo of golpe.alvos) {
          // F2 (fatia F, Medicina): a que só cura deixa os debuffs.
          // Fase 5: a montada tira pelo nome (o antídoto), as positivas ou todas; ausente = os negativos.
          const tirados = limpeza.soCura === true ? [] : selosQueALimpezaTira(novos.selos, alvo.tokenId, limpeza.tira)
          for (const selo of tirados) partes.push({ tipo: 'selo', seloId: selo.id, antes: selo })
          const fora = new Set(tirados.map((selo) => selo.id))
          novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => !fora.has(selo.id)) }
          // A cura lê o Espírito de quem usa DEPOIS da limpeza (sem o cansaço, se ele limpou a si mesmo); com 3 cargas, a fórmula do X3 da ficha.
          const lida = lerDano(formulaDaCura(limpeza, lancado.cargaUsada), { personagem: ctx.personagem, sistema: ctx.sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(novos.selos, carta.tokenId) })
          // Pedido de 09/11 (a Bolha): o que cabe na vida do alvo AGORA (lido antes de gravar), para a nota dizer o que entrou.
          const sistemaDaCura = ctx.sistema
          const fichaDoAlvo = alvo.personagemId === null ? undefined : mesa.personagens().find((candidato) => candidato.id === alvo.personagemId)
          // Fase 5: o SP e o Escudo (a Barreira) pela mesma porta da ficha; a nota diz o recurso.
          const recursoDaCura = limpeza.recurso ?? 'hp'
          // Fase 7 (itens): a parte do máximo DO ALVO (a Poção Suprema), lida na ficha dele; sem ficha, nada.
          const pelaParte = limpeza.porcentoDoMaximo === undefined || recursoDaCura === 'escudo' ? null : fichaDoAlvo === undefined ? 0 : curaPelaParteDoMaximo(fichaDoAlvo, sistemaDaCura, recursoDaCura, limpeza.porcentoDoMaximo)
          // U6: a fórmula que não fecha a conta já foi recusada antes de cobrar (`podeAgir`); aqui só chega número ou "sem cura" (0).
          // Fase 5: a cura cortada (ou aumentada) pela regra do selo de quem recebe (`curaRecebida`).
          const cura = pelaParte !== null ? curaComOsSelos(pelaParte, novos.selos, alvo.tokenId) : lida.tipo === 'valor' ? curaComOsSelos(lida.valor, novos.selos, alvo.tokenId) : 0
          const coube = fichaDoAlvo === undefined ? 0 : recursoDaCura === 'hp' ? curaQueCabe(fichaDoAlvo, sistemaDaCura, cura) : quantoCabeNoRecurso(fichaDoAlvo, sistemaDaCura, recursoDaCura, cura)
          const curou = alvo.personagemId === null || cura <= 0 ? null : mexerNaFicha(mesa, alvo.personagemId, (atual, sistema) => (recursoDaCura === 'hp' ? ajustesDaCura(atual, sistema, cura) : ajustesDoRecursoDaCura(atual, sistema, recursoDaCura, cura)), quem)
          if (curou === 'recusada') {
            devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
            return false
          }
          if (curou !== null && alvo.personagemId !== null) partes.push(...reversaoDaFicha(alvo.personagemId, curou))
          // Fase 7 (o Elixir): a segunda cura no mesmo alvo, de outro recurso, lida na ficha já curada; recusada, nada sai.
          const tambem = limpeza.tambem
          let daOutra = ''
          if (tambem !== undefined && alvo.personagemId !== null) {
            const fichaAgora = mesa.personagens().find((candidato) => candidato.id === alvo.personagemId)
            const lidaOutra = tambem.porcentoDoMaximo !== undefined ? null : lerDano(tambem.formula, { personagem: ctx.personagem, sistema: ctx.sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(novos.selos, carta.tokenId) })
            const parte = tambem.porcentoDoMaximo === undefined || tambem.recurso === 'escudo' || fichaAgora === undefined ? 0 : curaPelaParteDoMaximo(fichaAgora, sistemaDaCura, tambem.recurso, tambem.porcentoDoMaximo)
            const base = lidaOutra === null ? parte : lidaOutra.tipo === 'valor' ? lidaOutra.valor : 0
            const outra = tambem.recurso === 'hp' ? curaComOsSelos(base, novos.selos, alvo.tokenId) : base
            const recursoDaOutra = tambem.recurso
            const coubeOutra = fichaAgora === undefined ? 0 : recursoDaOutra === 'hp' ? curaQueCabe(fichaAgora, sistemaDaCura, outra) : quantoCabeNoRecurso(fichaAgora, sistemaDaCura, recursoDaOutra, outra)
            const curouOutra = outra <= 0 ? null : mexerNaFicha(mesa, alvo.personagemId, (atual, sistema) => (recursoDaOutra === 'hp' ? ajustesDaCura(atual, sistema, outra) : ajustesDoRecursoDaCura(atual, sistema, recursoDaOutra, outra)), quem)
            if (curouOutra === 'recusada') {
              devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
              return false
            }
            if (curouOutra !== null) partes.push(...reversaoDaFicha(alvo.personagemId, curouOutra))
            daOutra = `, ${recursoDaOutra === 'hp' ? notaDaCura(outra, coubeOutra) : notaDoRecursoDaCura(recursoDaOutra, outra, coubeOutra)}`
          }
          // F2 (fatia F, Medicina): a nota diz o item gasto ("curou 100, gastou 1 Kit Médico").
          // Fase 5: pelo cartão (a montada tem o item nas peças, não na tabela pelo id).
          const item = pedido.tipo === 'habilidade' ? mecanicaDoCartao(cartaoDoPedido ?? pedido.cartaoId)?.gastaItem : undefined
          // A CURA TIRA O VENENO (`lib/curaPeloItem.ts`): o item gasto para curar tira o Envenenado do alvo ("..., tirou Envenenado").
          const curaDoItem = item === undefined ? null : curaDoItemNoAlvo(sceneKey, alvo.tokenId, novos.selos)
          if (curaDoItem !== null) curasDoItem.push(curaDoItem)
          const doVeneno = curaDoItem === null || curaDoItem.curou.length === 0 ? '' : `, tirou ${curaDoItem.curou.join(', ')}`
          const doItem = item === undefined ? '' : `, gastou 1 ${item}${doVeneno}`
          const daCura = `${recursoDaCura === 'hp' ? notaDaCura(cura, coube) : notaDoRecursoDaCura(recursoDaCura, cura, coube)}${daOutra}${doItem}`
          const nomesTirados = limpeza.tira === undefined ? '' : tirados.length === 0 ? 'não tinha o que tirar' : `tirou ${tirados.map((selo) => selo.nome).join(', ')}`
          const nota = limpeza.soCura === true ? daCura : limpeza.tira !== undefined ? (cura > 0 ? `${nomesTirados}, ${daCura}` : nomesTirados) : `tirou ${tirados.length} ${tirados.length === 1 ? 'debuff' : 'debuffs'}, ${daCura}`
          golpe = golpeComOAlvo(golpe, { ...alvo, nota })
        }
        // Só depois de todo alvo aceito: o pedido recusado no meio (acima) não deixa o veneno tirado de ninguém.
        partes.push(...gravarCurasDoItem(sceneKey, curasDoItem))
      }
      // Fase 6 (H14): o caído volta com a parte do HP máximo dele (ou a fórmula de quem usa). O `podeAgir` já conferiu que todos estão a 0.
      const reviver = cartaoDoPedido === null ? undefined : mecanicaDoCartao(cartaoDoPedido)?.reviver
      if (reviver !== undefined && ctx.personagem !== null && ctx.sistema !== null) {
        const vida = recursoDeVida(ctx.sistema)
        for (const alvo of golpe.alvos) {
          const fichaDoAlvo = alvo.personagemId === null ? undefined : mesa.personagens().find((candidato) => candidato.id === alvo.personagemId)
          const vidaDoAlvo = fichaDoAlvo === undefined || vida === null ? null : vidaDoPersonagem(fichaDoAlvo, vida)
          if (vidaDoAlvo === null || alvo.personagemId === null) continue
          const lida = 'porcento' in reviver ? null : lerDano(reviver.formula, { personagem: ctx.personagem, sistema: ctx.sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(novos.selos, carta.tokenId) })
          // Volta com pelo menos 1: reviver que deixa a ficha a 0 não reviveria.
          const volta = Math.max(1, 'porcento' in reviver ? Math.floor((vidaDoAlvo.maximo * reviver.porcento) / 100) : lida?.tipo === 'valor' ? lida.valor : 1)
          const voltou = mexerNaFicha(mesa, alvo.personagemId, (atual, sistema) => ajustesDaCura(atual, sistema, volta), quem)
          if (voltou === 'recusada') {
            devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
            return false
          }
          if (voltou !== null) partes.push(...reversaoDaFicha(alvo.personagemId, voltou))
          const coube = Math.min(volta, vidaDoAlvo.maximo - vidaDoAlvo.atual)
          golpe = golpeComOAlvo(golpe, { ...alvo, nota: `levantou com ${coube} de vida` })
        }
      }
      // Fase 5: a cura em quem usa (o golpe que cura quem bate), depois dos alvos; recusada, nada sai.
      const emQuemUsa = cartaoDoPedido === null ? undefined : mecanicaDoCartao(cartaoDoPedido)?.curaEmQuemUsa
      if (emQuemUsa !== undefined && ctx.personagem !== null && ctx.sistema !== null && carta.personagemId !== null) {
        const lida = lerDano(emQuemUsa.formula, { personagem: ctx.personagem, sistema: ctx.sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha(novos.selos, carta.tokenId) })
        const base = lida.tipo === 'valor' ? lida.valor : 0
        const cura = emQuemUsa.recurso === 'hp' ? curaComOsSelos(base, novos.selos, carta.tokenId) : base
        const curou = cura <= 0 ? null : mexerNaFicha(mesa, carta.personagemId, (atual, sistema) => (emQuemUsa.recurso === 'hp' ? ajustesDaCura(atual, sistema, cura) : ajustesDoRecursoDaCura(atual, sistema, emQuemUsa.recurso, cura)), quem)
        if (curou === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        if (curou !== null) partes.push(...reversaoDaFicha(carta.personagemId, curou))
      }
      novos = { ...novos, golpes: comGolpe(novos.golpes, golpe) }
    }
    // F2 (fatia B, Rapid Dash; fatia C, o Atacar da Aira com a Bênção): as partes seguintes entram juntas, cada uma com a linha dela
    // (gravada logo depois); o dano de quem não reage cai já, com o selo da parte.
    const seguintes: { golpe: GolpeDaBatalha; partes: Reversao[] }[] = []
    for (const parte of partesSeguintes(lancado)) {
      // O Desfazer da linha do 1º golpe desfaz junto a das outras partes (e as reações a elas).
      partes.push({ tipo: 'linhaJunto', linhaId: parte.golpe.linhaId })
      const daParte: Reversao[] = [{ tipo: 'golpe', golpeId: parte.golpe.id }]
      let golpeDaParte = parte.golpe
      for (const resolvido of parte.resolvidos) {
        const feito = danoNoAlvo(mesa, resolvido, golpeDaParte, autor)
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, [...partes, ...seguintes.flatMap((anterior) => anterior.partes), ...daParte], autor)
          return false
        }
        daParte.push(...feito.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        const noAcerto = seloNoAcerto(novos, golpeDaParte, resolvido)
        golpeDaParte = golpeComOAlvo(golpeDaParte, noAcerto.alvo)
        if (noAcerto.selado !== null) {
          daParte.push(noAcerto.selado.parte)
          novos = { ...novos, selos: noAcerto.selado.selos }
        }
      }
      novos = { ...novos, golpes: comGolpe(novos.golpes, golpeDaParte) }
      seguintes.push({ golpe: golpeDaParte, partes: daParte })
    }
    // Invocação (decisão 9): o invocado que o dano levou a 0 sai do mapa e do bando.
    const caidos = semOsCaidos(mesa, sceneKey, novos)
    partes.push(...caidos.partes)
    novos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
    // Tipos de habilidade F3: o dano dos alvos sem reação (e o custo de HP) pode levar alguém abaixo do gatilho de vida.
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    const quemAge = nomeDoToken(carta.tokenId)
    let texto: string
    let tipo: TipoDaLinha
    if (golpe !== null) {
      texto = textoDoGolpe(golpe, nomeDoToken)
      tipo = pedido.tipo === 'habilidade' ? 'habilidade' : 'golpe'
    } else if (pedido.tipo === 'concentrar') {
      texto = `${quemAge} concentrou (carga ${lancado.combate?.carga ?? 0}${lancado.acao === 'livre' ? ', sem gastar ação' : ''})`
      tipo = 'acao'
    } else {
      texto = `${quemAge} usou o contra-ataque para se mover`
      tipo = 'acao'
    }
    texto += textoDosQueSairam(caidos.nomes)
    const tokenIds = [...new Set([carta.tokenId, ...(golpe?.alvos.map((alvo) => alvo.tokenId) ?? [])])]
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, {
      ...comMudanca(atual, novos, { id: linhaId, tipo, texto, autor, tokenIds, reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    for (const parte of seguintes) {
      const comALinha = cenaDe(sceneKey)
      if (comALinha !== undefined) gravarCena(sceneKey, comMudanca(comALinha, comALinha.turnos, { id: parte.golpe.linhaId, tipo, texto: textoDoGolpe(parte.golpe, nomeDoToken), autor, tokenIds, reversao: { tipo: 'composta', partes: parte.partes } }))
    }
    // Fatia C7: a técnica oculta que revela ao usar sai revelada depois do golpe (o Desfazer da linha não a esconde de novo).
    if (pedido.tipo === 'habilidade' && carta.personagemId !== null) {
      const { cartaoId } = pedido
      mesa.ajustarPersonagem(carta.personagemId, (atual) => revelacaoAoUsar(atual, cartaoId) ?? atual)
    }
    avisarQuemCaiu(sceneKey, autor)
    // Conserto das fichas F1 (bug 2): acima do teto, o golpe mais velho vira "Não reagiu"; o ataque novo nunca é recusado por isso.
    const esperando = cenaDe(sceneKey)?.turnos.golpes ?? []
    if (esperando.length > GOLPES_PENDENTES_MAX) {
      const ficam = new Set(esperando.slice(-GOLPES_PENDENTES_MAX).map((pendente) => pendente.id))
      fecharGolpesSemResposta(sceneKey, (pendente) => !ficam.has(pendente.id), 'a tempo (golpes demais esperando)')
    }
    return true
  }

  /**
   * Conserto das fichas F1 (bug 2, regra P3 do grilling): o alvo que não
   * respondeu vira "Não reagiu" sozinho, como no botão Não reagir do mestre
   * (a marca, o dano na ficha, o selo do golpe). Uma linha "reacao" por golpe
   * diz quem não reagiu e por quê (`porque`); o Desfazer dela devolve o alvo à
   * espera e o dano à ficha (as mesmas partes da reação com técnica). `fecha`
   * escolhe os golpes, lidos da cena de agora. Devolve os ids das linhas
   * escritas, na ordem.
   */
  const fecharGolpesSemResposta = (sceneKey: string, fecha: (golpe: GolpeDaBatalha) => boolean, porque: string): string[] => {
    const ids = (cenaDe(sceneKey)?.turnos.golpes ?? []).filter(fecha).map((golpe) => golpe.id)
    const linhas: string[] = []
    for (const golpeId of ids) {
      const cena = cenaDe(sceneKey)
      const antes = cena?.turnos.golpes?.find((candidato) => candidato.id === golpeId)
      if (cena === undefined || antes === undefined) continue
      let golpe = antes
      let novos: TurnosDaCena = cena.turnos
      const partes: Reversao[] = []
      const efeitos: EfeitoNovo[] = []
      const resolvidos: AlvoDoGolpe[] = []
      let recusou = false
      for (const esperando of antes.alvos) {
        if (esperando.danoFinal !== undefined) continue
        // Quem já rolou e não escolheu toma o "Passar" (o 1 natural continua crítico): esperar a virada não foge do dado.
        const saida = esperando.rolagem === undefined ? 'naoReagiu' : saidaDoPassar(esperando.rolagem.d20)
        const semResposta = resolverAlvo(golpe, esperando.tokenId, saida)
        const semMarca = semResposta.alvos.find((candidato) => candidato.tokenId === esperando.tokenId)
        if (semMarca === undefined) continue
        // R1: a marca antes do dano, como em toda reação.
        const acerto = acertoComMarca(mesa, novos, semResposta, semMarca)
        novos = acerto.turnos
        golpe = golpeComOAlvo(semResposta, acerto.alvo)
        const feito = danoNoAlvo(mesa, acerto.alvo, golpe, MESTRE)
        // Bug 11: dano recusado = este golpe segue esperando (o dano dos outros alvos dele volta); a próxima virada tenta de novo.
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, MESTRE)
          recusou = true
          break
        }
        partes.push({ tipo: 'reacaoComTecnica', golpe, tokenId: esperando.tokenId, alvoAntes: esperando }, ...acerto.partes, ...feito.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        const noAcerto = seloNoAcerto(novos, golpe, acerto.alvo)
        golpe = golpeComOAlvo(golpe, noAcerto.alvo)
        const selado = noAcerto.selado
        if (selado !== null) {
          partes.push(selado.parte)
          novos = { ...novos, selos: selado.selos }
        }
        resolvidos.push(acerto.alvo)
      }
      if (recusou || resolvidos.length === 0) continue
      novos = { ...novos, golpes: comGolpe(novos.golpes, golpe) }
      const lembrados = lembrarDepoisDoDano(novos)
      partes.push(...partesDosLembretes(lembrados))
      novos = lembrados.turnos
      const nomeDoToken = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)
      const nomes = resolvidos.map((alvo) => nomeDoToken(alvo.tokenId))
      const quem = nomes.length === 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1] ?? ''}`
      const texto = `${quem} não ${nomes.length === 1 ? 'reagiu' : 'reagiram'} ${porque} (${golpe.nome} de ${nomeDoToken(golpe.atacanteTokenId)})`
      const linhaId = novoIdDeLinha()
      const linha: LinhaNova = { id: linhaId, tipo: 'reacao', texto, tokenIds: [...new Set([golpe.atacanteTokenId, ...resolvidos.map((alvo) => alvo.tokenId)])], reversao: { tipo: 'composta', partes } }
      const personagemIds = resolvidos.flatMap((alvo) => (alvo.personagemId === null ? [] : [alvo.personagemId]))
      if (personagemIds.length > 0) linha.personagemIds = personagemIds
      // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
      const atual = cenaDe(sceneKey) ?? cena
      const comOGolpe = { ...atual, registro: linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(golpe, nomeDoToken), []) }
      gravarCena(sceneKey, { ...comMudanca(comOGolpe, novos, linha), efeitos: comEfeitos(atual.efeitos, efeitos) })
      avisarQuemCaiu(sceneKey, MESTRE)
      linhas.push(linhaId)
    }
    return linhas
  }

  const acoes: Pick<BatalhaState, 'motivoDoAgir' | 'agir' | 'reagir' | 'darDano' | 'darAcoesExtras' | 'escolherArmas' | 'zerarCarga' | 'trocarPerfurante'> = {
    motivoDoAgir: (sceneKey, autor, vez, pedido) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return 'A batalha não está ligada nesta cena'
      const { turnos } = cena
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      const contra = contraDe === undefined ? null : ((turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe) ?? null)
      if (contraDe !== undefined && contra === null) return 'Esse contra-ataque não existe mais'
      if (contra === null && (vez === null || turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada)) return 'A vez já passou'
      const carta = contra === null ? cartaDaVez(turnos) : (turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId) ?? null)
      if (carta === null || carta.bando !== undefined) return 'Não é a vez desta ficha'
      return podeAgir(contextoDaCarta(sceneKey, cena, autor, carta, turnos), pedido)
    },

    agir: (sceneKey, autor, vez, pedido) => {
      // F3 (fatia T): Ativar e Desfazer a forma têm caminho próprio (não lançam golpe).
      if (pedido.tipo === 'transformar' || pedido.tipo === 'destransformar') return mudarForma(sceneKey, autor, vez, pedido)
      // F2 (fatia E, Fúria do Dragão): a técnica que sobe de Parte é o Ativar da Parte seguinte, com a ação da técnica.
      const subida = subidaDoPedido(sceneKey, pedido)
      if (subida !== null) return mudarForma(sceneKey, autor, vez, subida)
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      // O contra-ataque (Q6) age fora da vez, pela carta da ficha que o ganhou; o resto, só a carta da vez nesta rodada.
      const contra = contraDe === undefined ? null : ((turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe) ?? null)
      if (contraDe !== undefined && contra === null) return false
      if (contra === null && (vez === null || turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada)) return false
      const carta = contra === null ? cartaDaVez(turnos) : (turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId) ?? null)
      // Invocação: na carta do bando, o mestre age pelo invocado (`agirComInvocado`), nunca pela carta.
      if (carta === null || carta.bando !== undefined) return false
      return agirComACarta(sceneKey, cena, autor, carta, turnos, carta.id, pedido)
    },

    reagir:(sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      const { personagens } = mesaDoRpg()
      const nomeDoToken = nomeDoTokenNa(turnos, personagens)
      if ((pedido.tipo === 'rolar' || pedido.tipo === 'rerolar') && (!Number.isInteger(pedido.modificador) || Math.abs(pedido.modificador) > MODIFICADOR_DA_REACAO_MAX)) return false
      // Reação livre (o botão Reação sem golpe esperando): o d20 para todos e uma linha.
      if (pedido.tipo === 'rolar' && pedido.golpeId === null) {
        if (!turnos.cartas.some((carta) => carta.tokenId === pedido.tokenId)) return false
        // S4: com vantagem ou desvantagem, 2 d20 (fica o maior ou o menor). F2 (revisão da fatia D): preso no Campo, desvantagem.
        const { d20, vantagem } = rolarComVantagem(deps.rolarD20, vantagemDaReacao(pedido.vantagem, selosDoToken(turnos.selos, pedido.tokenId)))
        const total = d20 + pedido.modificador
        const texto = `${nomeDoToken(pedido.tokenId)} reagiu: ${textoDaRolagem(d20, pedido.modificador, total, vantagem)}`
        gravarCena(sceneKey, {
          ...comMudanca(cena, turnos, { tipo: 'reacao', texto, autor, tokenIds: [pedido.tokenId], reversao: { tipo: 'composta', partes: [] } }),
          efeitos: comEfeitos(cena.efeitos, [{ tipo: 'reacao', golpeId: null, tokenId: pedido.tokenId, d20, modificador: pedido.modificador, total }]),
        })
        return true
      }
      const golpe = (turnos.golpes ?? []).find((candidato) => candidato.id === pedido.golpeId)
      const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === pedido.tokenId)
      if (golpe === undefined || alvo === undefined || alvo.danoFinal !== undefined) return false
      // Tipos de habilidade F1: a técnica de reação no lugar do d20 tem linha própria.
      if (pedido.tipo === 'tecnica') return reagirComTecnicaNaCena(sceneKey, cena, golpe, alvo, autor, pedido)
      if (pedido.tipo === 'semDano') return passarSemDanoNaCena(sceneKey, cena, golpe, alvo, autor)
      let novo: GolpeDaBatalha
      const efeitos: EfeitoNovo[] = []
      const partes: Reversao[] = []
      let contras = turnos.contras
      let selos = turnos.selos
      // R1: os turnos depois da marca (os lembretes da marca moram neles); os selos seguem em `selos`.
      let marcados: TurnosDaCena = turnos
      switch (pedido.tipo) {
        case 'rolar':
        case 'rerolar': {
          // Rolar só sem rolagem; Rerolar só com (Ponto Saga é manual, sem limite: decisão 10).
          // Conserto das fichas F1: Overload não erra; o d20 não defende dele (só outra Overload, pela técnica).
          // F2 (revisão da fatia E): Surpresa também não rola (quem espera nela só reage com a técnica que vale contra ela).
          if (!alvo.podeReagir || golpe.overload || golpe.surpresa || (pedido.tipo === 'rolar') !== (alvo.rolagem === undefined)) return false
          // S4: Atordoado ou Paralisado não reage (o golpe que já esperava também não).
          if (travaDoToken(turnos.selos, alvo.tokenId) !== null) return false
          // F2 (revisão da fatia D): quem está preso no Campo de Contenção rola com desvantagem, sem marcar.
          const selosDoAlvo = selosDoToken(turnos.selos, alvo.tokenId)
          const { d20, vantagem } = rolarComVantagem(deps.rolarD20, vantagemDaReacao(pedido.vantagem, selosDoAlvo, golpe))
          // F2 (revisão da fatia E): o Marcado esquiva e contra-ataca com desvantagem (mais um d20, fica o menor); Defender usa o d20.
          const esquiva = esquivaComDesvantagem(selosDoAlvo, vantagem?.modo) ? rolarODadoDaEsquiva(deps.rolarD20, d20) : undefined
          novo = rolarReacao(golpe, alvo.tokenId, pedido.modificador, d20, vantagem, esquiva)
          efeitos.push({ tipo: 'reacao', golpeId: golpe.id, tokenId: alvo.tokenId, d20, modificador: pedido.modificador, total: d20 + pedido.modificador })
          break
        }
        case 'escolher':
        case 'naoReagir':
        case 'passar': {
          let saida: SaidaDaReacao = 'naoReagiu'
          // Depois de rolar, o jogador escolhe entre o que o dado deu: "Não reagir" no 1 natural fugiria do crítico. O mestre pode tudo.
          if (pedido.tipo === 'naoReagir' && alvo.rolagem !== undefined && autor.tipo === 'jogador') return false
          if (pedido.tipo === 'escolher') {
            // F2 (fatia A): Aéreo tira a Esquiva e o Contra-ataque de quem reage.
            // F2 (fatia E, Orgulho dos Ogros): o ogro (menos a Ryoko) só Defende ou Recebe.
            const doAlvo = personagens.find((candidato) => candidato.id === alvo.personagemId)
            const daRaca = doAlvo === undefined ? [] : saidasTiradasDoDono(chavesDoDono(doAlvo))
            if (alvo.rolagem === undefined || daRaca.includes(pedido.saida) || !saidasComOsSelos(saidasDaRolagem(alvo.rolagem), selosDoToken(turnos.selos, alvo.tokenId)).includes(pedido.saida)) return false
            saida = pedido.saida
          }
          // Passar só depois do dado: o golpe inteiro, sem usar a reação; o 1 natural continua crítico.
          if (pedido.tipo === 'passar') {
            if (alvo.rolagem === undefined) return false
            saida = saidaDoPassar(alvo.rolagem.d20)
          }
          novo = resolverAlvo(golpe, alvo.tokenId, saida)
          const semMarca = novo.alvos.find((candidato) => candidato.tokenId === alvo.tokenId)
          if (semMarca === undefined) return false
          // R1: a marca antes do dano (o dobro, a marca da técnica, o lembrete da passiva).
          const acerto = acertoComMarca(mesa, turnos, novo, semMarca)
          marcados = acerto.turnos
          selos = marcados.selos
          novo = golpeComOAlvo(novo, acerto.alvo)
          const resolvido = acerto.alvo
          const feito = danoNoAlvo(mesa, resolvido, golpe, autor)
          // Bug 11: dano recusado = o alvo segue esperando (sem linha nova nem animação).
          if (feito === 'recusada') return false
          partes.push(...feito.partes, ...acerto.partes)
          if (feito.efeito !== null) efeitos.push(feito.efeito)
          // F3 (Q6): o selo do golpe só pega se o golpe acertou este alvo.
          const noAcerto = seloNoAcerto(marcados, golpe, resolvido)
          novo = golpeComOAlvo(novo, noAcerto.alvo)
          const selado = noAcerto.selado
          if (selado !== null) {
            partes.push(selado.parte)
            selos = selado.selos
          }
          // Q6: 20 e Contra-atacar = sem dano e uma ação a mais na hora, fora da vez (Atacar, Habilidade ou Mover).
          if (saida === 'contra' && (contras?.length ?? 0) < CONTRAS_MAX) {
            const ganho: ContraAtaque = contraGanhoAgora(turnos, { golpeId: golpe.id, tokenId: alvo.tokenId, personagemId: alvo.personagemId, atacanteTokenId: golpe.atacanteTokenId })
            contras = [...(contras ?? []), ganho]
          }
          break
        }
      }
      let novos: TurnosDaCena = { ...marcados, golpes: comGolpe(turnos.golpes, novo) }
      if (contras !== undefined) novos.contras = contras
      if (selos !== undefined) novos.selos = selos
      // Tipos de habilidade F3: o alvo resolvido tomou o dano: o gatilho de vida lê a ficha de agora (a reversão vai na linha do golpe).
      if (partes.length > 0) {
        const lembrados = lembrarDepoisDoDano(novos)
        partes.push(...partesDosLembretes(lembrados))
        novos = lembrados.turnos
      }
      const atual = cenaDe(sceneKey) ?? cena
      const registro = linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(novo, nomeDoToken), partes)
      gravarCena(sceneKey, { ...atual, turnos: novos, registro, efeitos: comEfeitos(atual.efeitos, efeitos), turnosRev: atual.turnosRev + 1 })
      avisarQuemCaiu(sceneKey, autor)
      return true
    },

    darDano: (sceneKey, autor, tokenId, valor) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || !Number.isInteger(valor) || valor < 1 || valor > DANO_MAX) return false
      // A ficha da ordem, ou o invocado em campo (que não tem carta própria: está no bando).
      const personagemId = personagemDoTokenNa(cena.turnos)(tokenId)
      if (personagemId === undefined || personagemId === null) return false
      // R6: a forma ligada do alvo que reduz o dano recebido (Resiliente: -20%) vale também no dano livre do mestre.
      // S4 (P5): no "Me dar dano" o jogador digita o dano CHEIO; o app desconta a forma e a Determinação (a tela avisa antes).
      let dado = valor
      let reducao = ''
      const partes = mexerNaFicha(
        mesa,
        personagemId,
        (atual, sistema) => {
          const reducoes = reducoesDoDano(atual, sistema)
          dado = danoComAsReducoes(valor, reducoes)
          reducao = reducoes.length === 0 ? '' : ` (${reducoes.map((parte) => `${parte.nome} -${parte.porcento}%`).join(', ')}: de ${valor})`
          return ajustesDoDano(atual, sistema, dado, false)
        },
        quemNaFicha(autor),
      )
      if (partes === null || partes === 'recusada') return false
      const alvo = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(tokenId)
      const atual = cenaDe(sceneKey) ?? cena
      // Invocação (decisão 9): o invocado que o dano levou a 0 sai do mapa e do bando.
      const caidos = semOsCaidos(mesa, sceneKey, atual.turnos)
      const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
      const texto = `${nomeDoAutor(autor)} deu ${dado} de dano em ${alvo}${reducao}${textoDosQueSairam(caidos.nomes)}`
      // Tipos de habilidade F3: o gatilho de vida depois do dano livre (o mesmo ponto do golpe).
      const lembrados = lembrarDepoisDoDano(semCaidos)
      gravarCena(sceneKey, {
        ...comMudanca(atual, lembrados.turnos, { tipo: 'dano', texto, autor, tokenIds: [tokenId], reversao: { tipo: 'composta', partes: [...reversaoDaFicha(personagemId, partes), ...caidos.partes, ...partesDosLembretes(lembrados)] } }),
        efeitos: comEfeitos(atual.efeitos, [{ tipo: 'dano', tokenId, valor: dado, saida: 'direto' }]),
      })
      // F2 (fatia B): o dano livre também pode levar a ficha a 0 (Recuperação Espantosa avisa o mestre).
      avisarQuemCaiu(sceneKey, autor)
      return true
    },

    darAcoesExtras: (sceneKey, cartaId, extras) => {
      const cena = cenaDe(sceneKey)
      const carta = cena?.turnos.cartas.find((candidata) => candidata.id === cartaId)
      if (cena === undefined || carta === undefined) return false
      const antes = cena.turnos.extras[cartaId] ?? null
      const limpas: AcoesExtras | null =
        extras === null ? null : { simples: contadorDeExtra(extras.simples), bonus: contadorDeExtra(extras.bonus), mov: contadorDeExtra(extras.mov), duracao: extras.duracao, rodada: cena.turnos.rodada }
      const valem = limpas !== null && limpas.simples + limpas.bonus + limpas.mov > 0 ? limpas : null
      if (antes === null && valem === null) return false
      const extrasNovas: Record<string, AcoesExtras> = { ...cena.turnos.extras }
      if (valem === null) delete extrasNovas[cartaId]
      else extrasNovas[cartaId] = valem
      const nome = nomeDaCarta(carta, mesaDoRpg().personagens)
      const quanto = valem?.duracao === 'sempre' ? 'em todas as vezes' : 'só nesta vez'
      const texto = valem === null ? `Mestre tirou as ações extras de ${nome}` : `Mestre: ${textoDasExtras(valem)} para ${nome} (${quanto})`
      gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, extras: extrasNovas }, { tipo: 'acoesExtras', texto, tokenIds: [carta.tokenId], reversao: { tipo: 'acoesExtras', cartaId, antes } }))
      return true
    },

    escolherArmas: (sceneKey, autor, personagemId, armas) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const tokenIds = [...new Set(cena.turnos.cartas.filter((carta) => carta.personagemId === personagemId).map((carta) => carta.tokenId))]
      const personagem = mesaDoRpg().personagens.find((candidato) => candidato.id === personagemId)
      if (tokenIds.length === 0 || personagem === undefined) return false
      // Q8: troca quando quiser, sempre dentro do limite da ficha; só armas da aba Armas, sem repetir.
      const daFicha = armasDe(personagem)
      const limite = limiteDeArmas(personagem) ?? ARMAS_NA_BATALHA_MAX
      if (new Set(armas).size !== armas.length || armas.length > limite || !armas.every((id) => daFicha.some((arma) => arma.id === id))) return false
      const antes: CombateDoPersonagem | null = cena.turnos.combate?.[personagemId] ?? null
      const base = antes ?? combateVazio()
      if (base.armas !== null && base.armas.length === armas.length && base.armas.every((id, i) => armas[i] === id)) return true
      const nomes = armas.map((id) => daFicha.find((arma) => arma.id === id)?.nome ?? 'arma')
      const lista = nomes.length === 0 ? 'nenhuma arma' : nomes.length === 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1] ?? ''}`
      const depois: CombateDoPersonagem = { ...base, armas: [...armas] }
      const turnos: TurnosDaCena = { ...cena.turnos, combate: { ...(cena.turnos.combate ?? {}), [personagemId]: depois } }
      // `personagemIds` = o dono das armas: a linha das armas de NPC não sai ao jogador (as armas dele são segredo).
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'acao', texto: `${personagem.nome} levou ${lista}`, autor, tokenIds, personagemIds: [personagemId], reversao: { tipo: 'combate', personagemId, antes, depois } }))
      return true
    },

    zerarCarga: (sceneKey, autor, personagemId) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const cartas = cena.turnos.cartas.filter((carta) => carta.personagemId === personagemId)
      const combate = cena.turnos.combate?.[personagemId]
      if (cartas.length === 0 || combate === undefined || combate.carga === 0) return false
      const antes = combate.carga
      const tokenIds = [...new Set(cartas.map((carta) => carta.tokenId))]
      const nome = nomeDaCarta(cartas[0], mesaDoRpg().personagens)
      const { turnos: turnosAntes } = cena
      // C2: concentrou NESTA vez e zerou = não fez nada: a ação do Concentrar volta e ele pode concentrar de novo.
      const daVez = cartaDaVez(turnosAntes)
      const mesmaVez = daVez !== null && daVez.personagemId === personagemId && combate.concentrouEm === chaveDaVez(turnosAntes.rodada, daVez.id)
      const { concentrouEm: _em, concentrouCom: _com, ...semAVez } = combate
      const depois: CombateDoPersonagem = mesmaVez ? { ...semAVez, carga: 0 } : { ...combate, carga: 0 }
      let turnos: TurnosDaCena = { ...turnosAntes, combate: { ...(turnosAntes.combate ?? {}), [personagemId]: depois } }
      // A reversão "combate" volta só o que mudou (a carga, a vez do Concentrar), por campo: nada que outra linha mexeu depois.
      const partes: Reversao[] = [{ tipo: 'combate', personagemId, antes: combate, depois }]
      const devolvida = mesmaVez ? combate.concentrouCom : undefined
      if (daVez !== null && devolvida !== undefined) {
        const gasto = turnosAntes.gastos[daVez.id] ?? GASTO_ZERO
        turnos = { ...turnos, gastos: { ...turnos.gastos, [daVez.id]: { ...gasto, [devolvida.acao]: Math.max(0, gasto[devolvida.acao] - 1) } } }
        partes.push({ tipo: 'acaoDevolvida', cartaId: daVez.id, rodada: turnosAntes.rodada, acao: devolvida.acao, linhaDoConcentrar: devolvida.linhaId })
      }
      const texto = `${nome} zerou a concentração (carga ${antes} → 0)${devolvida === undefined ? '' : ' · a ação do Concentrar voltou'}`
      // `personagemIds` = o dono: a carga de NPC não sai ao jogador (só o mestre e o dono a veem, `dadosDaFaixa`).
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'acao', texto, autor, tokenIds, personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
      return true
    },

    trocarPerfurante: (sceneKey, golpeId, perfurante, perfuracao) => {
      const cena = cenaDe(sceneKey)
      const golpe = cena?.turnos.golpes?.find((candidato) => candidato.id === golpeId)
      const lida = perfuracao === undefined ? undefined : perfuracaoValida(perfuracao)
      if (cena === undefined || golpe === undefined || lida === null) return false
      // 100 = o Perfurante inteiro, que é o golpe sem o campo (a mesma forma de `lancarGolpe`).
      const porcentagem = lida === undefined ? golpe.perfuracao : lida < PERFURACAO_MAX ? lida : undefined
      if (golpe.perfurante === perfurante && golpe.perfuracao === porcentagem) return false
      const { perfuracao: _antiga, ...semPorcentagem } = golpe
      const novo: GolpeDaBatalha = porcentagem === undefined ? { ...semPorcentagem, perfurante } : { ...semPorcentagem, perfurante, perfuracao: porcentagem }
      const registro = linhaAtualizada(cena.registro, golpe.linhaId, textoDoGolpe(novo, nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)), [])
      gravarCena(sceneKey, { ...cena, turnos: { ...cena.turnos, golpes: comGolpe(cena.turnos.golpes, novo) }, registro, turnosRev: cena.turnosRev + 1 })
      return true
    },
  }
  return { agirComACarta, fecharGolpesSemResposta, acoes }
}

/** O que `criarGolpe` devolve. */
export type GolpeNaStore = ReturnType<typeof criarGolpe>
