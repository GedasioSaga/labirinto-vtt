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
  type SeloDaBatalha,
  type UltimaAcaoDoRastro,
} from '../../lib/batalha/combate'
import { comBandosEmDia, invocadoDoToken } from '../../lib/batalha/invocacao'
import { NOME_DA_MARCA, acertoNaMarca, criarMarca, golpeComOAlvo, marcaDoToken, moldeDaMarca, passivaDaMarca, type AcertoNaMarca, type ContextoDoAcerto } from '../../lib/batalha/marca'
import { bonusDaBatalha, comSeloNovo, selosDoToken } from '../../lib/batalha/selos'
import { comOBonusDosAcumuladores } from '../../lib/batalha/acumuladorNaBatalha'
import { valorDaParte, type Ajuste } from '../../lib/ajusteDaFicha'
import { curaComOsSelos, curaDoDano, esquivaComDesvantagem, motivoDoBloqueio, naoReageDoToken, notaDosSelosNaCura, saidasComOsSelos, selosQueSaemNoGolpe, selosSemOsQueSaem, vantagemDaReacao, type AcontecimentoDaSaida } from '../../lib/batalha/condicoes'
import { selosQueALimpezaTira } from '../../lib/batalha/debuffs'
import { ajustesDoRecursoDaCura, curaPelaParteDoMaximo, notaDoRecursoDaCura, quantoCabeNoRecurso } from '../../lib/batalha/curaDoRecurso'
import { danoComAsReducoes, nomesDasReducoes, porcentoDasReducoes, reducoesDoDano, reducoesDoDanoCausado, reducoesDosSelos } from '../../lib/batalha/reducaoDoDano'
import { anulacaoNoGolpe, type AnulacaoNoGolpe } from '../../lib/batalha/anulacaoNoGolpe'
import { ajusteDoRecurso } from '../../lib/batalha/recursosDaBatalha'
import {
  golpePendente,
  lancarGolpe,
  PARTES_SEGUINTES_MAX,
  partesSeguintes,
  podeAgir,
  portaoDoPedido,
  passarSemDano,
  resolverAlvo,
  rolarReacao,
  textoDaReacaoComTecnica,
  textoDaRolagem,
  textoDoGolpe,
  ctxDoItem,
  alcanceDaMira,
  type ContextoDoGolpe,
} from '../../lib/batalha/golpe'
import { linhaComOGasto, sobraDoUso, textoDoGasto } from '../../lib/batalha/itemNaBatalha'
import { lerDano } from '../../lib/batalha/formula'
import { cartoesLigados, chavesDoDono, disputaNoUso, formaQueMarca, formulaDaCura, idDaChave, itemQueATecnicaGasta, limpezaDe, marcaDoCartao, mecanicaDoCartao, reacaoAMaoDe, rebatePertoDe, saidasTiradasDoDono, saidasTiradasPeloAtacante, tecnicaSemRegraPropria } from '../../lib/batalha/mecanicasAMao'
import { comADisputaNoUso } from '../../lib/batalha/disputaNoUso'
import { debuffsDobrados } from '../../lib/batalha/debuffs'
import { motivoDaReacaoComTecnica, reacoesDisponiveis, reagirComTecnica, temOverloadDeReacao, temReacaoContraSurpresa, type PedidoDeTecnica } from '../../lib/batalha/reacaoComTecnica'
import { casaNaAreaVirada, pegadaDaFicha } from '../../lib/batalha/area'
import { recursoDeVida, vidaDoPersonagem } from '../../lib/vidaDaFicha'
import { armasDe, limiteDeArmas, recursoDoEscudo, tecnicaPorId, tecnicasDe } from '../../lib/batalha/leituraDaFicha'
import { fichaComAMochilaDoBoneco } from '../../lib/batalha/municaoDaFicha'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import { ajustesDaCura, ajustesDoDano, curaQueCabe, notaDaCura, perfuracaoValida, rolarComVantagem, rolarODadoDaEsquiva, saidaDoPassar, saidasDaRolagem } from '../../lib/batalha/reacao'
import { escudoMaisAlto, nomeDoAutor, novoIdDeLinha, type Reversao, type TipoDaLinha } from '../../lib/batalha/registro'
import { cartaDaVez, contraGanhoAgora, type AcoesExtras, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../../lib/batalha/turnos'
import { revelacaoAoUsar } from '../../lib/habilidadeOculta'
import { tirarCondicaoDaFicha } from '../../lib/prazoDaCondicao'
import type { TelaDoPedido, VezEsperada } from '../../lib/batalha/ponte'
import { CONDICOES_QUE_A_CURA_TIRA, condicoesQueACuraTirou, curarPeloItem } from '../../lib/curaPeloItem'
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
import { mexerNaFicha, type Recusada, type CuraDoItemNoAlvo, gastarMunicaoNaMesa, gastarItemNaMesa, gastarConsumivelNaMesa, semOsCaidos, textoDosQueSairam, reversaoDaFicha } from './naMesa'
import { armaNaMesa, gastarDoPenteNaMesa, recargaDepoisDoTiro } from './recargaDoPente'
import { arremessoDepoisDoAtaque } from './arremessoNaMesa'
import { linhaDoItemQueNarra, vagaQueNarra } from '../../lib/batalha/itemNaBatalha'
import { devolverFichasDaAcao } from './desfazer'
import { gastarOsRequisitos, notaDaLinha } from './gastosDosRequisitos'
import { nomeDaAcaoDaAjuda, pedirAjuda, pedirAoMestre } from './ajuda'
import type { AceitesDoPedido } from '../../lib/batalha/requisitos/ajuda'
import type { AcaoDaAjuda } from '../../lib/batalha/combate'
import { basesQueVoltamAoUsar, semEvoluida } from '../../lib/batalha/escolhaEEvolucao'
import { contextoDosRequisitos } from '../../lib/batalha/requisitos/montar'
import { motivoDoPortao, portaoDosRequisitos, testesQuePassam, type RequisitoDeTeste, type ResultadoDoPortao } from '../../lib/batalha/requisitos/portao'
import { perdeAAcaoNosTestes, rolarOsTestes, testesDoPortao, textoDosTestes, type TesteRolado } from '../../lib/batalha/requisitos/testes'
import type { Personagem } from '../../lib/personagem'
import type { NucleoDaBatalha } from './nucleo'
import type { FormasDaBatalha } from './formas'
import type { SelosDaBatalha } from './selos'
import { tirarDaFichaPeloEspelho } from './condicoesNaFicha'

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
function danoNoAlvo(
  mesa: MesaDaBatalha,
  alvo: AlvoDoGolpe,
  golpe: Pick<GolpeDaBatalha, 'perfurante' | 'perfuracao'> & Partial<Pick<GolpeDaBatalha, 'curaDoDano' | 'atacantePersonagemId' | 'atacanteTokenId'>>,
  autor: AutorDaAcao,
  selos?: readonly SeloDaBatalha[],
): { partes: Reversao[]; efeito: EfeitoNovo | null } | Recusada {
  if (alvo.danoFinal === undefined || alvo.saida === undefined) return { partes: [], efeito: null }
  const valor = alvo.danoFinal
  const partes = alvo.personagemId === null || valor <= 0 ? null : mexerNaFicha(mesa, alvo.personagemId, (atual, sistema) => ajustesDoDano(atual, sistema, valor, golpe.perfurante, golpe.perfuracao), quemNaFicha(autor))
  if (partes === 'recusada') return partes
  const reversao: Reversao[] = alvo.personagemId === null ? [] : [...reversaoDaFicha(alvo.personagemId, partes)]
  // F2 (fatia C, Bênção de uma Raposa): quem bateu recupera a porcentagem do dano que causou, na mesma linha (o Desfazer tira junto).
  // A cura recusada (a ficha de quem bateu não grava) não derruba o golpe: o dano já valeu.
  const quemBateu = golpe.atacantePersonagemId ?? null
  // CURA REDUZIDA (25/11/2026): a vida que volta para quem bateu também vem cortada pelos selos dele.
  const cura = partes === null || quemBateu === null ? 0 : curaComOsSelos(curaDoDano(valor, golpe.curaDoDano ?? 0), selos, golpe.atacanteTokenId ?? '')
  const curou = cura === 0 || quemBateu === null ? null : mexerNaFicha(mesa, quemBateu, (atual, sistema) => ajustesDaCura(atual, sistema, cura), quemNaFicha(autor))
  if (curou !== null && curou !== 'recusada' && quemBateu !== null) reversao.push(...reversaoDaFicha(quemBateu, curou))
  // A animação toca sempre (esquiva também: "ESQUIVOU" sobre a ficha).
  return { partes: reversao, efeito: { tipo: 'dano', tokenId: alvo.tokenId, valor, saida: alvo.saida } }
}

/**
 * Rework das condições (E3, as saídas): os selos de `tokenId` que saem com o acontecimento (`selosQueSaemCom`) fora
 * da cena, com o Desfazer (cada um volta) e o texto da linha. Nada sai = os MESMOS turnos, nenhuma parte e texto vazio.
 */
function saidasNoToken(turnos: TurnosDaCena, tokenId: string, acontecimento: AcontecimentoDaSaida, nomeDoToken: (tokenId: string) => string): { turnos: TurnosDaCena; partes: Reversao[]; texto: string } {
  const saida = selosSemOsQueSaem(turnos.selos, tokenId, acontecimento, nomeDoToken(tokenId))
  if (saida.sairam.length === 0) return { turnos, partes: [], texto: '' }
  return { turnos: { ...turnos, selos: saida.selos }, partes: saida.sairam.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })), texto: saida.texto }
}

/** Bug G1-05: o que o "toma 0" e os cortes fizeram no dano que volta ("; Intangível: X tomou 0 de dano", "; Vulnerável +25%"). Nada = vazio. */
function notaDosCortes(alvo: AlvoDoGolpe): string {
  const { reducao } = alvo
  const corte = reducao === undefined || reducao === 0 ? null : `${alvo.reducaoDe ?? 'forma'} ${reducao > 0 ? '−' : '+'}${Math.abs(reducao)}%`
  const partes = [alvo.disputa ?? '', corte ?? ''].filter((parte) => parte !== '')
  return partes.length === 0 ? '' : `; ${partes.join('; ')}`
}

/** O texto a mais no alvo (o pedaço dele na linha do golpe), depois do que ele já tinha. Vazio = o MESMO alvo. */
function comNotaNoAlvo(alvo: AlvoDoGolpe, texto: string): AlvoDoGolpe {
  return texto === '' ? alvo : { ...alvo, disputa: alvo.disputa === undefined || alvo.disputa === '' ? texto : `${alvo.disputa}; ${texto}` }
}

/**
 * E3 (sair ao tomar dano): o golpe deixou dano em `alvo`; os selos dele que saem com o dano dos tipos do golpe (o
 * Confuso com qualquer dano, o Molhado com Fogo) saem ANTES do selo novo do golpe (o Confuso que o golpe põe não sai
 * com o próprio dano), e o texto vai no alvo. Sem dano, ou nada sai: os MESMOS objetos.
 */
function saidasDoDano(turnos: TurnosDaCena, golpe: Pick<GolpeDaBatalha, 'tipos'>, alvo: AlvoDoGolpe, nomeDoToken: (tokenId: string) => string): { turnos: TurnosDaCena; alvo: AlvoDoGolpe; partes: Reversao[] } {
  if ((alvo.danoFinal ?? 0) <= 0) return { turnos, alvo, partes: [] }
  const saida = saidasNoToken(turnos, alvo.tokenId, { tipo: 'dano', tipos: golpe.tipos ?? [] }, nomeDoToken)
  return { turnos: saida.turnos, alvo: comNotaNoAlvo(alvo, saida.texto), partes: saida.partes }
}

export function novoIdDaMarca(): string {
  return `marca_${crypto.randomUUID()}`
}

/**
 * Rework das habilidades (PLANO.md D10): o que as peças de quem atacou dizem da marca deste acerto. A
 * técnica do golpe (`marcaDaTecnica`, o `golpe.marca`) com a peça Marca dá o molde (nome, turnos, quem
 * aproveita, as vezes, se some); a forma ligada com marca marca a cada acerto. Sem ficha, nada.
 */
function marcasDasPecas(atacante: Personagem | undefined, marcaDaTecnica: string | undefined): Pick<ContextoDoAcerto, 'moldeDaTecnica' | 'formaQueMarca'> {
  if (atacante === undefined) return {}
  const daTecnica = marcaDaTecnica === undefined ? undefined : chavesDoDono(atacante).find((chave) => idDaChave(chave) === marcaDaTecnica)
  const pecaDaTecnica = daTecnica === undefined ? null : marcaDoCartao(daTecnica)
  const daForma = formaQueMarca(cartoesLigados(atacante))
  const marcas: Pick<ContextoDoAcerto, 'moldeDaTecnica' | 'formaQueMarca'> = {}
  if (pecaDaTecnica !== null) marcas.moldeDaTecnica = moldeDaMarca(pecaDaTecnica, atacante.id)
  if (daForma !== null) marcas.formaQueMarca = { origem: { id: daForma.cartaoId, nome: daForma.nome }, molde: moldeDaMarca(daForma.marca, atacante.id) }
  return marcas
}

/** O que o acerto pede da store para o "toma 0" (pedido de 27/11/2026): quem grava na ficha, o d20 do host e o nome do alvo no registro. */
interface ContextoDaAnulacao {
  quem: string
  rolarD20: () => number
  nomeDoToken: (tokenId: string) => string
}

/**
 * Pedido de 27/11/2026 (Intangível): o acerto que não tira nada. O dano final fica 0, o texto "Intangível: X
 * tomou 0 de dano" vai no alvo, o uso do limite fica no combate do dono e o SP sai da ficha dele (o Desfazer
 * da linha devolve os dois). `null` = a mesa recusou cobrar o SP: o dano segue como sempre.
 */
function acertoAnulado(mesa: MesaDaBatalha, acerto: AcertoNaMarca, personagemId: string, anulacao: Extract<AnulacaoNoGolpe, { anulou: true }>, quem: string): AcertoNaMarca | null {
  const partes: Reversao[] = [...acerto.partes]
  let turnos = acerto.turnos
  if (anulacao.paga > 0) {
    const paga = anulacao.paga
    const pagou = mexerNaFicha(
      mesa,
      personagemId,
      (atual, sistemaDaMesa) => {
        const ajuste = ajusteDoRecurso(atual, sistemaDaMesa, 'sp', -paga)
        return ajuste === null ? [] : [ajuste]
      },
      quem,
    )
    if (pagou === 'recusada') return null
    partes.push(...reversaoDaFicha(personagemId, pagou))
  }
  if (anulacao.combate !== null) {
    partes.push({ tipo: 'combate', personagemId, antes: turnos.combate?.[personagemId] ?? null, depois: anulacao.combate })
    turnos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: anulacao.combate } }
  }
  // Pedido de 28/11/2026: o corte em parte deixa o resto do dano (`anulacao.dano`), que segue pelos cortes do dano.
  return { turnos, partes, alvo: comNotaNoAlvo({ ...acerto.alvo, danoFinal: anulacao.dano }, anulacao.texto) }
}

/**
 * R1 (lote de 01/11): o alvo resolvido passa pela marca ANTES do dano na
 * ficha (o dobro sai no número do dano e no texto). A passiva de marca é a do
 * personagem de quem atacou; a técnica que marca é a do golpe (`golpe.marca`).
 * Pedido de 27/11/2026: depois da marca e antes das reduções, o "toma 0" (`anulacaoNoGolpe`).
 */
function acertoComMarca(mesa: MesaDaBatalha, turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe, contexto: ContextoDaAnulacao): AcertoNaMarca {
  const sistema = mesa.sistema()
  const atacante = golpe.atacantePersonagemId === null ? undefined : mesa.personagens().find((personagem) => personagem.id === golpe.atacantePersonagemId)
  const daPassiva = sistema === null || atacante === undefined ? null : passivaDaMarca(atacante, sistema)
  const passiva = daPassiva?.cartao ?? null
  // Pedido de 27/11/2026: a passiva montada com a peça Marca "quando o dono acerta" pergunta em todo acerto (a de texto e a "à distância", só no tiro).
  const pecaDaPassiva = daPassiva?.leitura.peca
  const passivaEmTodoAcerto = pecaDaPassiva !== undefined && pecaDaPassiva.quando !== 'tiro'
  const tecnicaQueMarca = golpe.marca === undefined ? null : { id: golpe.marca, nome: golpe.nome }
  // Rework das habilidades (PLANO.md D10): a peça Marca da técnica (o molde dela) e a forma ligada de quem atacou que marca a cada acerto.
  const acerto = acertoNaMarca(turnos, golpe, alvo, { linhaId: golpe.linhaId, novoId: novoIdDaMarca, passiva, passivaEmTodoAcerto, tecnicaQueMarca, ...marcasDasPecas(atacante, golpe.marca) })
  return acertoComOsCortes(mesa, acerto, golpe, atacante, contexto)
}

/** O que os cortes do dano leem do golpe: o nome e os tipos (as exceções) e quem bate (o dano causado dele). */
type GolpeDosCortes = Pick<GolpeDaBatalha, 'nome' | 'atacanteTokenId'> & Partial<Pick<GolpeDaBatalha, 'tipos'>>

/**
 * Depois da marca: o "toma 0" (`anulacaoNoGolpe`) e os cortes do dano que o alvo recebe e que quem bate causa.
 * Bug G1-05 (28/11/2026): o dano que volta (o Devolve o golpe e o rebate) passa por aqui também, sem a marca.
 */
function acertoComOsCortes(mesa: MesaDaBatalha, acerto: AcertoNaMarca, golpe: GolpeDosCortes, atacante: Personagem | undefined, contexto: ContextoDaAnulacao): AcertoNaMarca {
  const sistema = mesa.sistema()
  const { alvo } = acerto
  // R6: a forma ligada do alvo que reduz o dano recebido (Resiliente: -20%), depois do dobro da marca.
  // S4: e a Determinação (rank 4+, HP abaixo da metade), uma depois da outra.
  const dele = alvo.personagemId === null || sistema === null ? undefined : mesa.personagens().find((personagem) => personagem.id === alvo.personagemId)
  const { danoFinal } = acerto.alvo
  if (dele === undefined || sistema === null || danoFinal === undefined || danoFinal <= 0) return acerto
  // Fase 5: e o selo montado com regra de dano recebido (−20% a menos, +50% a mais), por último.
  // Rework das condições (E3): o dano de um tipo só pelos tipos do golpe (Congelado: Impacto +50%) e o dano causado de quem bate (Amedrontado −20%).
  const dosSelosDoAlvo = reducoesDosSelos(acerto.turnos.selos, alvo.tokenId, golpe.tipos)
  const doAlvo = [...reducoesDoDano(dele, sistema), ...dosSelosDoAlvo]
  // Pedido de 27/11/2026: a raça com 100%, a condição Intangível e o "Anula o dano" da passiva, pela mesma função.
  const anulacao = anulacaoNoGolpe({ turnos: acerto.turnos, golpe, alvoTokenId: alvo.tokenId, alvo: dele, sistema, ...(atacante === undefined ? {} : { atacante }), reducoes: doAlvo, nomeDoAlvo: contexto.nomeDoToken(alvo.tokenId), rolarD20: contexto.rolarD20, dano: danoFinal })
  const anulado = anulacao !== null && anulacao.anulou ? acertoAnulado(mesa, acerto, dele.id, anulacao, contexto.quem) : null
  // Pedido de 28/11/2026: o "anula só uma parte" deixa o resto, que passa pelos cortes do dano como o golpe inteiro passaria.
  if (anulado !== null && (anulado.alvo.danoFinal ?? 0) <= 0) return anulado
  // A fonte que tentou e não valeu deixa o porquê no alvo ("Corpo de Fumaça não anulou: o golpe tem Haki").
  const comMotivo: AcertoNaMarca = anulado ?? (anulacao !== null && !anulacao.anulou ? { ...acerto, alvo: comNotaNoAlvo(acerto.alvo, anulacao.texto) } : acerto)
  const danoQueFica = comMotivo.alvo.danoFinal ?? danoFinal
  const deQuemBate = reducoesDoDanoCausado(acerto.turnos.selos, golpe.atacanteTokenId)
  const reducoes = [...doAlvo, ...deQuemBate]
  if (reducoes.length === 0) return comMotivo
  const reduzido: AlvoDoGolpe = { ...comMotivo.alvo, danoFinal: danoComAsReducoes(danoQueFica, reducoes), reducao: porcentoDasReducoes(reducoes) }
  // Só a forma: o registro segue "(forma −20%)", como antes.
  if (dosSelosDoAlvo.length > 0 || deQuemBate.length > 0 || reducoes.some((reducao) => reducao.nome === 'Determinação')) reduzido.reducaoDe = nomesDasReducoes(reducoes)
  return { ...comMotivo, alvo: reduzido }
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
  const { mesa, deps, mesaDoRpg, cenaDe, gravarCena, avisarQuemCaiu, revelarAoUsar, lembrarDepoisDoDano, rastrear, anotarAcao } = nucleo
  const { cansarNoOverload, subidaDoPedido, mudarForma } = fatiaDasFormas
  const { seloNoAcerto, seloPostoNaFicha, aliadosNaLutaDe } = fatiaDosSelos
  /** Pedido de 27/11/2026: o que o "toma 0" do acerto precisa (quem cobra o SP, o d20 do host, o nome do alvo). */
  const paraAnular = (autor: AutorDaAcao, turnos: TurnosDaCena): ContextoDaAnulacao => ({ quem: quemNaFicha(autor), rolarD20: deps.rolarD20, nomeDoToken: nomeDoTokenNa(turnos, mesa.personagens()) })

  /**
   * O que sai da ficha `tokenId` no mapa, só lido (nada gravado): as pastilhas
   * (e o prazo) de `nomes`, os selos que a limpeza tirou (Nº 3 do levantamento:
   * a limpeza tira os dois, dentro e fora da batalha) e, com `curaPeloItem`, o
   * veneno (`lib/curaPeloItem.ts`; o selo dele já saiu da cena, então a pastilha
   * sai também). `null` = nada a tirar, ou a mesa sem mapa (arena).
   */
  const condicoesQueSaemNoAlvo = (sceneKey: string, tokenId: string, nomes: readonly string[], curaPeloItem: boolean): CuraDoItemNoAlvo | null => {
    const antes = mesa.fichaDaCena?.(sceneKey, tokenId) ?? null
    if (antes === null || mesa.mudarFichaDaCena === undefined) return null
    const semOsTirados = nomes.reduce(tirarCondicaoDaFicha, antes)
    const depois = curaPeloItem ? curarPeloItem(semOsTirados) : semOsTirados
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
   * REQUISITOS D: o portão dos requisitos da técnica de REAÇÃO de `personagemId` (a ficha do token
   * `reageTokenId`), com o retrato do host "na reação" e o alvo = quem atacou. Sem ficha, sem sistema ou
   * técnica fora da ficha = `livre` (a regra da reação recusa por conta própria). O teste (H1, H2) na
   * reação não é rolado: recusa com o motivo de sempre.
   */
  const portaoDaReacao = (sceneKey: string, turnos: TurnosDaCena, autor: AutorDaAcao, personagem: Personagem | null, personagemId: string, reageTokenId: string, atacanteTokenId: string, cartaoId: string): ResultadoDoPortao => {
    const { personagens, sistema } = mesaDoRpg()
    const cartao = personagem === null || sistema === null ? null : (tecnicaPorId(personagem, sistema, cartaoId)?.cartao ?? null)
    if (personagem === null || sistema === null || cartao === null || cartao.requisitos === undefined) return { tipo: 'livre' }
    const { posicaoDoToken } = mesa
    const retrato = contextoDosRequisitos({
      personagem,
      sistema,
      tokenId: reageTokenId,
      cartaId: turnos.cartas.find((carta) => carta.tokenId === reageTokenId)?.id ?? '',
      turnos,
      personagens,
      personagemDoToken: personagemDoTokenNa(turnos),
      aliados: aliadosNaLutaDe(personagemId, turnos, personagens),
      ...(posicaoDoToken === undefined
        ? {}
        : {
            pegadaDoToken: (tokenId: string) => {
              const posicao = posicaoDoToken(sceneKey, tokenId)
              return posicao === null ? null : (posicao.pegada ?? pegadaDaFicha(posicao.casa, mesa.fichaDaCena?.(sceneKey, tokenId)?.size))
            },
          }),
      visao: 'tudo',
      alvos: [atacanteTokenId],
      naReacao: true,
      autorEhMestre: autor.tipo === 'mestre',
      ...(mesa.naLuz === undefined ? {} : { naLuz: (tokenId: string) => mesa.naLuz?.(sceneKey, tokenId) ?? null }),
    })
    return portaoDosRequisitos(cartao.requisitos, 'usar', retrato, {}, autor.tipo === 'mestre')
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
    // REQUISITOS D: a técnica na reação passa pelo mesmo portão do golpe, com o retrato "na reação" (o pedido ao aliado e o
    // "o mestre decide" não valem nela) e o alvo dela = quem atacou. O pedido da reação não leva respostas: a caixa recusa.
    const doPortao = portaoDaReacao(sceneKey, turnos, autor, personagem, personagemId, reageTokenId, golpe.atacanteTokenId, pedido.cartaoId)
    // Conserto das fichas F1: contra golpe Overload, só técnica Overload. F2 (revisão da fatia E): contra Surpresa, só a que vale contra
    // ela; a técnica que o mestre confirma (Recuperação de forças) só ele usa.
    if (motivoDaReacaoComTecnica({ personagem, sistema, combate: combateAntes, quemPede: autor.tipo, requisitos: motivoDoPortao(doPortao) }, alvo, pedido, golpe.overload, golpe.surpresa) !== null || personagem === null || sistema === null) return false
    // S4: Atordoado ou Paralisado não reage, nem com técnica. Rework das condições (D3): o bloqueio "Não pode reagir".
    if (naoReageDoToken(turnos.selos, reageTokenId) !== null) return false
    // Rework das condições (D10): "Não pode usar técnica" (o Silenciado) vale também na reação com técnica.
    if (motivoDoBloqueio(turnos.selos, reageTokenId, 'naoTecnica') !== null) return false
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
    const acerto = lida.alvo.danoFinal === undefined ? null : acertoComMarca(mesa, turnos, lida.golpe, lida.alvo, paraAnular(autor, turnos))
    const feita = acerto === null ? lida : { ...lida, alvo: acerto.alvo, golpe: golpeComOAlvo(lida.golpe, acerto.alvo) }
    const quem = quemNaFicha(autor)
    const partes: Reversao[] = [{ tipo: 'reacaoComTecnica', golpe: feita.golpe, tokenId: alvo.tokenId, alvoAntes: alvo }, ...(acerto?.partes ?? [])]
    const efeitos: EfeitoNovo[] = []
    let novos: TurnosDaCena = { ...(acerto?.turnos ?? turnos), golpes: comGolpe(turnos.golpes, feita.golpe) }
    // `depoisDaTecnica` devolve o MESMO combate quando a técnica não marca nada (sem recarga, usos nem Overload).
    if (feita.combate !== combateBase) {
      // Pedido de 27/11/2026: o "Anula o dano" de quem reage já contou o uso nas lembradas dele; a técnica vem por cima sem perder a conta.
      const doAnula = acerto?.turnos.combate?.[personagemId]
      const combateFeito: CombateDoPersonagem =
        doAnula === undefined || doAnula === combateAntes ? feita.combate : { ...feita.combate, lembradas: [...new Set([...(feita.combate.lembradas ?? []), ...(doAnula.lembradas ?? [])])] }
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois: combateFeito })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: combateFeito } }
    }
    if (feita.custo.length > 0) {
      // Bug G1-10 (28/11/2026): o custo veio da ficha de antes do acerto, e o "Anula o dano" de quem reage pode já ter cobrado
      // SP dela. Com o `de` (o número de que partiu), vale a diferença sobre a ficha de agora, sem apagar o SP já pago.
      const custo = feita.custo.map((ajuste): Ajuste => ({ ...ajuste, de: valorDaParte(personagem, ajuste.parte, ajuste.chave) }))
      const doCusto = mexerNaFicha(mesa, personagemId, () => custo, quem)
      // Bug 11: custo recusado = a reação não sai (o alvo segue esperando).
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, doCusto))
    }
    // REQUISITOS D: os gastos dos requisitos que valem, depois do custo e nesta linha (o Desfazer devolve; o rastro conta o SP).
    let notaDosRequisitos = doPortao.tipo === 'passa' ? doPortao.nota : null
    if (doPortao.tipo === 'passa') {
      const gastos = gastarOsRequisitos(mesa, sceneKey, personagemId, reageTokenId, novos, doPortao.gastos, autor)
      if (gastos === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(...gastos.partes)
      novos = gastos.turnos
      notaDosRequisitos = notaDaLinha(gastos.texto, notaDosRequisitos)
    }
    // FRENTE A (25/11/2026): a técnica que gasta item (o Kit Médico) tira da mochila de quem reage, como no golpe
    // (`gastarConsumivelNaMesa`): o registro diz o mesmo que a mochila, e o Desfazer da linha devolve. O
    // `motivoDaReacaoComTecnica` já recusou sem item bastante; a mesa que recusa agora leva tudo de volta.
    const gastoDaTecnica = itemQueATecnicaGasta(cartaoDaReacao)
    let textoDoItem = ''
    if (gastoDaTecnica !== null) {
      const gastou = gastarConsumivelNaMesa(mesa, sceneKey, reageTokenId, personagemId, gastoDaTecnica)
      partes.push(...gastou.partes)
      if (!gastou.ok) {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      textoDoItem = ` · gastou ${gastoDaTecnica.porUso} ${gastoDaTecnica.nome}`
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
      const dano = danoNoAlvo(mesa, depois, golpe, autor, novos.selos)
      // Bug 11: o dano recusado leva o custo junto de volta; a reação não sai.
      if (dano === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(...dano.partes)
      if (dano.efeito !== null) efeitos.push(dano.efeito)
      // Rework das condições (E3): o que sai com o dano (o Confuso, o Molhado com Fogo), antes do selo novo do golpe.
      const saiuComODano = saidasDoDano(novos, golpe, depois, nomeDoTokenNa(novos, personagens))
      novos = saiuComODano.turnos
      partes.push(...saiuComODano.partes)
      // F3 (Q6): o selo do golpe só pega se o golpe acertou este alvo (Metade, Receber). F2 (fatia B): com a disputa da mecânica à mão.
      const noAcerto = seloNoAcerto(sceneKey, novos, golpe, saiuComODano.alvo)
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
      const dividido = feita.devolveDividido === undefined || feita.devolveDividido <= 0 ? 0 : Math.floor((depois.danoFinal ?? 0) / feita.devolveDividido)
      // Rework das habilidades (D3, a peça Devolve o golpe): mais o atributo de quem reagiu, lido como a soma do rebate (antes do cansaço),
      // só quando o golpe ficou nele (a defesa que zerou o dano não devolve).
      // Bug G1-06 (28/11/2026): com o atributo dos marcos do acumulador, como no golpe (`bonusDeQuemAge`).
      const bonusDeQuemReage = comOBonusDosAcumuladores(bonusDaBatalha(turnos.selos, reageTokenId), personagem, combateAntes)
      const lidaDoDevolve = feita.devolveSoma === undefined || (depois.danoFinal ?? 0) <= 0 ? null : lerDano(feita.devolveSoma, { personagem, sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDeQuemReage })
      const somaDoDevolve = lidaDoDevolve?.tipo === 'valor' ? Math.max(0, Math.floor(lidaDoDevolve.valor)) : 0
      const devolve = Math.min(DANO_MAX, dividido + somaDoDevolve)
      // Bug G1-05 (28/11/2026): o dano que volta em quem atacou passa pelo "toma 0" e pelos cortes dele, como um acerto (sem a marca).
      const quemReage = depois.tecnica?.nome ?? golpe.nome
      const cortarNoAtacante = (total: number): AcertoNaMarca => {
        const noAtacante: AlvoDoGolpe = { tokenId: golpe.atacanteTokenId, personagemId: golpe.atacantePersonagemId, dano: total, podeReagir: false, saida: 'semReacao', danoFinal: total }
        return acertoComOsCortes(mesa, { alvo: noAtacante, turnos: novos, partes: [] }, { nome: quemReage, atacanteTokenId: reageTokenId }, personagem, paraAnular(autor, novos))
      }
      if (devolve > 0) {
        const cortado = cortarNoAtacante(devolve)
        partes.push(...cortado.partes)
        novos = cortado.turnos
        const devolvido = danoNoAlvo(mesa, cortado.alvo, { perfurante: false }, autor)
        if (devolvido === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...devolvido.partes)
        if (devolvido.efeito !== null) efeitos.push(devolvido.efeito)
        const comASoma = somaDoDevolve > 0 ? ` + ${somaDoDevolve}` : ''
        textoDoRebate = ` · devolveu ${cortado.alvo.danoFinal ?? devolve} em ${nomeDoTokenNa(turnos, personagens)(golpe.atacanteTokenId)} (${depois.danoFinal ?? 0} ÷ ${feita.devolveDividido ?? 1}${comASoma}${notaDosCortes(cortado.alvo)})`
      } else if (rebate !== undefined) {
        // A Força de antes da reação: o cansaço do Overload dela vem DEPOIS de rebater.
        const lida = lerDano(rebate.soma, { personagem, sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDeQuemReage })
        const soma = lida.tipo === 'valor' ? lida.valor : 0
        const total = Math.min(DANO_MAX, (depois.dano ?? 0) + soma)
        const cortado = cortarNoAtacante(total)
        partes.push(...cortado.partes)
        novos = cortado.turnos
        const rebatido = danoNoAlvo(mesa, cortado.alvo, { perfurante: false }, autor)
        if (rebatido === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...rebatido.partes)
        if (rebatido.efeito !== null) efeitos.push(rebatido.efeito)
        textoDoRebate = ` · rebateu ${cortado.alvo.danoFinal ?? total} em ${nomeDoTokenNa(turnos, personagens)(golpe.atacanteTokenId)} (${depois.dano ?? 0} + ${soma}${notaDosCortes(cortado.alvo)})`
      } else if (depois.saida === 'contra' && (novos.contras?.length ?? 0) < CONTRAS_MAX) {
        // Q6: Contra = sem dano e uma ação a mais na hora (sai no Desfazer pela parte "reacaoComTecnica").
        const ganho: ContraAtaque = contraGanhoAgora(turnos, { golpeId: golpe.id, tokenId: depois.tokenId, personagemId: depois.personagemId, atacanteTokenId: golpe.atacanteTokenId })
        novos = { ...novos, contras: [...(novos.contras ?? []), ganho] }
      }
      // F2 (fatia E, Recuperação de forças): 20% do dano que chegava volta em vida (até o máximo); só o mestre usa (ele confirmou o fogo ou a explosão).
      // CURA REDUZIDA (25/11/2026): cortada pelos selos de quem reage, e a linha diz o corte.
      const cura = curaComOsSelos(feita.cura ?? 0, novos.selos, reageTokenId)
      const curou = cura <= 0 ? null : mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDaCura(atual, sistemaDaMesa, cura), quem)
      if (curou === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      if (curou !== null) {
        partes.push(...reversaoDaFicha(personagemId, curou))
        textoDoRebate += ` · come o golpe e cura ${cura}${notaDosSelosNaCura(novos.selos, reageTokenId)} (o mestre confirmou: fogo ou explosão)`
        // Rework das condições (E3, sair ao receber cura): a vida que voltou tira o que sai com cura.
        const saiuComACura = saidasNoToken(novos, reageTokenId, { tipo: 'cura' }, nomeDoTokenNa(novos, personagens))
        novos = saiuComACura.turnos
        partes.push(...saiuComACura.partes)
        if (saiuComACura.texto !== '') textoDoRebate += ` · ${saiuComACura.texto}`
      }
    }
    // O selo da técnica em QUEM ATACOU ("Marcado"), se marcado na caixa e o atacante segue na ordem.
    // "Marcado" é a MARCA de verdade (Passo de Valsa, decisão do usuário 01/11): o próximo golpe que acertar dá o dobro; uma por alvo.
    const linhaId = novoIdDeLinha()
    const marcaNoAtacante = feita.seloNoAtacante?.nome === NOME_DA_MARCA && depois.tecnica !== undefined
    const atacanteJaMarcado = marcaNoAtacante && marcaDoToken(novos.selos, golpe.atacanteTokenId) !== undefined
    if (feita.seloNoAtacante !== null && !atacanteJaMarcado && turnos.cartas.some((carta) => carta.tokenId === golpe.atacanteTokenId)) {
      if (marcaNoAtacante && depois.tecnica !== undefined) {
        const marca = criarMarca(novos, golpe.atacanteTokenId, { selo: novoIdDaMarca(), linha: linhaId }, { id: depois.tecnica.cartaoId, nome: depois.tecnica.nome })
        const selos = comSeloNovo(novos.selos, marca)
        if (selos !== null) {
          partes.push({ tipo: 'selo', seloId: marca.id, antes: null })
          novos = { ...novos, selos }
        }
      } else {
        // Rework das condições (D2): o selo da reação em quem atacou congela a condição do nome, como o do golpe.
        const posto = seloPostoNaFicha(novos, { tokenId: golpe.atacanteTokenId, personagemId: golpe.atacantePersonagemId }, feita.seloNoAtacante, {
          autor,
          quemPos: personagemId,
          ...(depois.tecnica === undefined ? {} : { origem: depois.tecnica.nome }),
        })
        if (posto !== null) {
          partes.push(posto.parte)
          novos = { ...novos, selos: posto.selos }
        }
      }
    }
    // REQUISITOS B3: a técnica da reação entra nas usadas de quem reagiu; o golpe resolvido e o dano, no rastro.
    const reagiu = anotarAcao(novos, personagemId, { tipo: 'reacao', cartaoId: pedido.cartaoId, nome: depois.tecnica?.nome ?? personagem.nome }, null)
    const rastreado = rastrear(reagiu.turnos, efeitos, partes, [{ antes: golpe, depois: golpeFeito }])
    partes.push(...reagiu.partes, ...rastreado.partes)
    novos = rastreado.turnos
    // Tipos de habilidade F3: o dano (ou o custo de HP da técnica) pode levar alguém abaixo do gatilho de vida.
    const lembrados = lembrarDepoisDoDano(novos)
    partes.push(...partesDosLembretes(lembrados))
    novos = lembrados.turnos
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    const comOGolpe = { ...atual, registro: linhaAtualizada(atual.registro, golpe.linhaId, textoDoGolpe(golpeFeito, nomeDoToken), []) }
    const quemReage = por === undefined ? textoDaReacaoComTecnica(depois, nomeDoToken) : `${nomeDoToken(por)} reage com ${depois.tecnica?.nome ?? 'técnica'} por ${nomeDoToken(depois.tokenId)}: o golpe não pega`
    const texto = quemReage + textoDoRebate + textoDoItem + (notaDosRequisitos === null ? '' : ` ${notaDosRequisitos}`)
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
  /** Rework das condições (D10): o "Não pode usar técnica" (Silenciado) de `tokenId`, que recusa a reação com técnica (`reagirComTecnicaNaCena`). */
  const semTecnicaNaReacao = (turnos: TurnosDaCena, tokenId: string): boolean => motivoDoBloqueio(turnos.selos, tokenId, 'naoTecnica') !== null

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
      // Bug G1-08 (28/11/2026): o "Não pode usar técnica" (Silenciado) também fica de fora, porque só técnica rebate.
      if (personagemId === null || tokenId === alvoTokenId || tokenId === atacanteTokenId || tokens.has(tokenId) || gastouAReacao(turnos, tokenId) || naoReageDoToken(turnos.selos, tokenId) !== null || semTecnicaNaReacao(turnos, tokenId)) continue
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
  const contextoDaCarta = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, turnosDoCtx: TurnosDaCena, tela?: TelaDoPedido): ContextoDoGolpe => {
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
      semReacao: (tokenId) => invocadoDoToken(turnos, tokenId) !== null || gastouAReacao(turnos, tokenId) || naoReageDoToken(turnos.selos, tokenId) !== null,
      // Conserto das fichas F1: o golpe Overload espera só quem tem outra Overload de reação disponível.
      // Bug G1-08 (28/11/2026): contra Overload só técnica defende, e o Silenciado não usa técnica nem na reação.
      reageAOverload: (tokenId) => {
        if (semTecnicaNaReacao(turnos, tokenId)) return false
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
              return posicao === null ? null : (posicao.pegada ?? pegadaDaFicha(posicao.casa, mesa.fichaDaCena?.(sceneKey, tokenId)?.size))
            },
            // Fase C do alcance: o pedido do jogador mede com as paredes que ELE vê (a tela dele); o do mestre, com o mapa inteiro.
            mapaDoAlcance: () => (tela === undefined ? (mesa.mapaDoAlcance?.(sceneKey, carta.tokenId) ?? null) : tela.mapaDoAlcance(carta.tokenId)),
          }),
      // U3: a regra única de "quem pode ajudar quem": o aliado é o do lado na luta, jogador ou NPC, para toda técnica (montada,
      // de texto e à mão), a mesma regra da mira do mestre. A Luz do Sol (o selo só nos aliados, sem dano neles) lê a mesma lista.
      aliados: aliadosNaLutaDe(carta.personagemId, turnos, personagens),
      // U2: o cheio do Escudo nesta batalha (o maior que a ficha teve), para a recusa da cura dizer que o Escudo segurou o golpe.
      escudoCheio: (personagemId) => {
        const escudo = sistema === null ? null : recursoDoEscudo(sistema)
        return escudo === null ? 0 : escudoMaisAlto(cena.registro, personagemId, escudo.id)
      },
      // REQUISITOS E: no treino do Lobby o que espera alguém (G1, G2, J2) fica "Só na mesa".
      ...(deps.treino === true ? { noTreino: true } : {}),
      // REQUISITOS E5: a luz é medida no host, com o mapa inteiro (o requisito "na luz" do jogador também).
      ...(mesa.naLuz === undefined ? {} : { naLuz: (tokenId: string) => mesa.naLuz?.(sceneKey, tokenId) ?? null }),
    }
  }

  /**
   * REQUISITOS D (H1, H2): rola os testes do pedido com o d20 do host: quem usa (a ficha com o cartão
   * do item, no item) com os selos dele, contra a CD ou contra o primeiro alvo do pedido.
   */
  const rolarOsTestesDoPedido = (ctx: ContextoDoGolpe, pedido: PedidoDeAcao, testes: readonly RequisitoDeTeste[]): TesteRolado[] => {
    const { sistema } = ctx
    const doItem = pedido.tipo === 'item' ? ctxDoItem(ctx, pedido) : null
    const quemUsa = doItem === null || typeof doItem === 'string' ? ctx.personagem : doItem.ctx.personagem
    const primeiro = 'alvos' in pedido ? pedido.alvos[0]?.tokenId : undefined
    const doAlvo = primeiro === undefined ? undefined : ctx.personagemDoToken(primeiro)
    const alvo = doAlvo === null || doAlvo === undefined ? undefined : ctx.personagens.find((candidato) => candidato.id === doAlvo)
    // Sem ficha ou sem sistema não há o que rolar: os testes falham (o mestre força, se quiser).
    if (quemUsa === null || sistema === null) return testes.map((teste) => ({ requisitoId: teste.id, passou: false, seFalhar: teste.seFalhar, texto: `${teste.atributo.nome}: sem ficha para rolar, falhou` }))
    return rolarOsTestes(testes, {
      quemUsa: { personagem: quemUsa, bonus: bonusDaBatalha(ctx.turnos.selos, ctx.carta.tokenId) },
      alvo: alvo === undefined || primeiro === undefined ? null : { personagem: alvo, bonus: bonusDaBatalha(ctx.turnos.selos, primeiro) },
      sistema,
      rolarD20: deps.rolarD20,
    })
  }

  /**
   * REQUISITOS D (H1, H2): o teste do requisito falhou. A linha diz o dado; com "perde a ação" a ação
   * e o custo normal vão (o golpe não sai; recarga e usos não contam), com "não gasta" nada muda. O
   * Desfazer da linha devolve a ação e o custo. `ctx` = o contexto supondo os testes passando (só
   * para ler a ação, o custo e o nome do que seria usado).
   */
  const falhouNoTeste = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, chaveDoGasto: string, ctx: ContextoDoGolpe, pedidoDeQuemAge: PedidoDeAcao, rolados: readonly TesteRolado[]): boolean => {
    const { turnos } = cena
    const doItem = pedidoDeQuemAge.tipo === 'item' ? ctxDoItem(ctx, pedidoDeQuemAge) : null
    if (typeof doItem === 'string') return false
    const linhaId = novoIdDeLinha()
    const lido = lancarGolpe(doItem === null ? ctx : doItem.ctx, doItem === null ? pedidoDeQuemAge : doItem.uso.pedido, {
      golpe: novoIdDeGolpe(),
      linha: linhaId,
      segundo: { golpe: novoIdDeGolpe(), linha: novoIdDeLinha() },
      seguintes: [],
    })
    const perde = perdeAAcaoNosTestes(rolados)
    const partes: Reversao[] = []
    let novos: TurnosDaCena = turnos
    if (perde && lido.gasto !== null) {
      partes.push({ tipo: 'gasto', cartaId: chaveDoGasto, antes: turnos.gastos[chaveDoGasto] ?? null })
      novos = { ...novos, gastos: { ...novos.gastos, [chaveDoGasto]: lido.gasto } }
    }
    if (perde && lido.custo.length > 0 && carta.personagemId !== null) {
      const custo = lido.custo
      const doCusto = mexerNaFicha(mesa, carta.personagemId, () => custo, quemNaFicha(autor))
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(carta.personagemId, doCusto))
      // O SP perdido conta como gasto para o acumulador "a cada N SP gastos".
      const rastreado = rastrear(novos, [], partes)
      partes.push(...rastreado.partes)
      novos = rastreado.turnos
    }
    const nomeDoToken = nomeDoTokenNa(turnos, mesaDoRpg().personagens)
    const texto = `${nomeDoToken(carta.tokenId)} tentou ${lido.golpe?.nome ?? 'agir'}: ${rolados.map((rolado) => rolado.texto).join('; ')} · ${perde ? 'perdeu a ação' : 'não usou e não gastou nada'}`
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { id: linhaId, tipo: 'acao', texto, autor, tokenIds: [carta.tokenId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  const agirComACarta = (sceneKey: string, cena: BatalhaDaCena, autor: AutorDaAcao, carta: CartaDaOrdem, turnosDoCtx: TurnosDaCena, chaveDoGasto: string, pedidoDeQuemAge: PedidoDeAcao, tela?: TelaDoPedido, aceite?: AceitesDoPedido): boolean => {
    const { turnos } = cena
    const { personagens } = mesaDoRpg()
    // REQUISITOS E e J2: `aceite` = o pedido congelado rodando de novo porque o aliado aceitou (o G1, o G2 valem) ou o mestre aprovou (o J2 vale).
    const ctxSemTestes: ContextoDoGolpe = { ...contextoDaCarta(sceneKey, cena, autor, carta, turnosDoCtx, tela), ...(aceite?.ajuda === true ? { ajudaAceita: true } : {}), ...(aceite?.mestre === true ? { mestreDeixou: true } : {}) }
    // ITENS REFEITOS, E6b (decisão 12): o consumível sem efeito não se gasta e não gasta ação: a linha diz que o mestre narra.
    const queNarra = pedidoDeQuemAge.tipo === 'item' && ctxSemTestes.personagem !== null ? vagaQueNarra(ctxSemTestes.personagem.mochila, pedidoDeQuemAge.vagaId) : null
    if (queNarra !== null) {
      const texto = linhaDoItemQueNarra(nomeDoTokenNa(turnos, personagens)(carta.tokenId), queNarra)
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'acao', texto, autor, tokenIds: [carta.tokenId], reversao: { tipo: 'composta', partes: [] } }))
      return true
    }
    // REQUISITOS D (H1, H2): o teste do requisito é rolado AQUI, no host, e só depois de o resto do pedido valer (supondo que
    // passe): pedido torto não gasta dado. Falhou: a linha diz o dado e, com "perde a ação", a ação e o custo vão.
    const antesDosTestes = portaoDoPedido(ctxSemTestes, pedidoDeQuemAge)
    // REQUISITOS E (§7) e J2: só falta o aliado aceitar (ou o mestre aprovar). Se o resto do pedido vale supondo o sim, nasce a
    // pendência e nada é gasto. Supõe os dois sins: o J2 que vem depois do aliado não barra o pedido ao aliado.
    if (antesDosTestes.tipo === 'perguntaAoAliado' || antesDosTestes.tipo === 'perguntaAoMestre') {
      const supondo: ContextoDoGolpe = { ...ctxSemTestes, ajudaAceita: true, mestreDeixou: true }
      const comOSim = portaoDoPedido(supondo, pedidoDeQuemAge)
      const supondoTudo: ContextoDoGolpe = comOSim.tipo === 'teste' ? { ...supondo, testesDosRequisitos: testesQuePassam(comOSim.testes) } : supondo
      if (podeAgir(supondoTudo, pedidoDeQuemAge) !== null) return false
      const vez = turnos.vez === null ? null : { cartaId: turnos.vez, rodada: turnos.rodada }
      const acao: AcaoDaAjuda = { tipo: 'agir', vez, pedido: pedidoDeQuemAge }
      const tecnica = nomeDaAcaoDaAjuda(ctxSemTestes, pedidoDeQuemAge)
      if (antesDosTestes.tipo === 'perguntaAoMestre') return pedirAoMestre(nucleo, sceneKey, cena, autor, carta, acao, antesDosTestes.pergunta, tecnica, aceite?.ajuda === true)
      return pedirAjuda(nucleo, sceneKey, cena, autor, carta, acao, antesDosTestes.pergunta, tecnica)
    }
    let ctxDaCarta = ctxSemTestes
    let rolados: TesteRolado[] = []
    if (antesDosTestes.tipo === 'teste') {
      const supondo: ContextoDoGolpe = { ...ctxSemTestes, testesDosRequisitos: testesQuePassam(antesDosTestes.testes) }
      if (podeAgir(supondo, pedidoDeQuemAge) !== null) return false
      rolados = rolarOsTestesDoPedido(ctxSemTestes, pedidoDeQuemAge, antesDosTestes.testes)
      if (rolados.some((rolado) => !rolado.passou)) return falhouNoTeste(sceneKey, cena, autor, carta, chaveDoGasto, supondo, pedidoDeQuemAge, rolados)
      ctxDaCarta = { ...ctxSemTestes, testesDosRequisitos: testesDoPortao(rolados) }
    }
    if (podeAgir(ctxDaCarta, pedidoDeQuemAge) !== null) return false
    // REQUISITOS C (§6): o mesmo portão do `podeAgir`, lido ANTES de a linha mexer em nada: os gastos e a nota.
    const doPortao = portaoDoPedido(ctxDaCarta, pedidoDeQuemAge)
    // Fase 8: o item vira a técnica dele (a ficha com o cartão do item só nesta conta, nunca gravada); a pilha desce mais abaixo.
    const doItem = pedidoDeQuemAge.tipo === 'item' ? ctxDoItem(ctxDaCarta, pedidoDeQuemAge) : null
    if (typeof doItem === 'string') return false
    const ctx = doItem === null ? ctxDaCarta : doItem.ctx
    const pedido = doItem === null ? pedidoDeQuemAge : doItem.uso.pedido
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
    // REQUISITOS C: os gastos dos requisitos que valem, depois do custo normal e nesta linha (o Desfazer devolve tudo).
    // REQUISITOS D: o dado dos testes que passaram vai junto ("(Percepção: teste d20 14+2 = 16 contra CD 15, passou)").
    let notaDosRequisitos = doPortao.tipo === 'passa' ? notaDaLinha(rolados.length === 0 ? null : textoDosTestes(rolados), doPortao.nota) : null
    if (doPortao.tipo === 'passa' && carta.personagemId !== null) {
      const gastos = gastarOsRequisitos(mesa, sceneKey, carta.personagemId, carta.tokenId, novos, doPortao.gastos, autor)
      if (gastos === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(...gastos.partes)
      novos = gastos.turnos
      notaDosRequisitos = notaDaLinha(gastos.texto, notaDosRequisitos)
    }
    // REQUISITOS E (G2 aceito): a ajuda sem pagamento também fica na linha.
    const ajudouSemPagar = aceite?.ajuda === true && doPortao.tipo === 'passa' && 'ajudaDe' in pedidoDeQuemAge && pedidoDeQuemAge.ajudaDe !== undefined && !doPortao.gastos.some((gasto) => gasto.recurso === 'doAliado')
    if (ajudouSemPagar && 'ajudaDe' in pedidoDeQuemAge && pedidoDeQuemAge.ajudaDe !== undefined) notaDosRequisitos = notaDaLinha(notaDosRequisitos, `(com a ajuda de ${nomeDoTokenNa(turnos, personagens)(pedidoDeQuemAge.ajudaDe)})`)
    // REQUISITOS C (I3, "dura um uso"): a versão super usada uma vez volta a base a comum (só a base com "Para evoluir").
    const cartaoUsado = pedido.tipo === 'habilidade' && ctx.personagem !== null && ctx.sistema !== null ? tecnicaPorId(ctx.personagem, ctx.sistema, pedido.cartaoId) : null
    const combateDeQuemUsa = carta.personagemId === null ? undefined : novos.combate?.[carta.personagemId]
    if (cartaoUsado !== null && combateDeQuemUsa !== undefined && carta.personagemId !== null && ctx.personagem !== null && ctx.sistema !== null) {
      const voltam = basesQueVoltamAoUsar(cartaoUsado.cartao, tecnicasDe(ctx.personagem, ctx.sistema), combateDeQuemUsa.evoluidas)
      const semAsSuper = voltam.reduce(semEvoluida, combateDeQuemUsa)
      if (semAsSuper !== combateDeQuemUsa) {
        partes.push({ tipo: 'combate', personagemId: carta.personagemId, antes: combateDeQuemUsa, depois: semAsSuper })
        novos = { ...novos, combate: { ...(novos.combate ?? {}), [carta.personagemId]: semAsSuper } }
      }
    }
    // MUNIÇÃO (pedido de 16/11/2026): o tiro com a bala ligada tira 1 da mochila da ficha (o boneco espelha). No host, o
    // tiro do jogador chega aqui pelo mesmo `agir`: o `podeAgir` acima já recusou a bala com 0.
    if (lancado.municao !== undefined && carta.personagemId !== null) {
      const { armaId, balaId } = lancado.municao
      // ITENS REFEITOS, E6a: a bala do pente sai do pente (nunca da vaga da munição); a de antes, da mochila.
      const doPente = armaNaMesa(mesa, sceneKey, carta.tokenId, carta.personagemId, armaId)?.pente !== undefined
      const parte = doPente ? gastarDoPenteNaMesa(mesa, sceneKey, carta.tokenId, carta.personagemId, armaId) : gastarMunicaoNaMesa(mesa, sceneKey, carta.tokenId, carta.personagemId, armaId, balaId)
      if (parte === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      if (parte !== null) partes.push(parte)
      // Decisão 3: o pente zerou? A mesa recarrega da mochila, agora se a ação da recarga cabe, senão no começo da próxima vez.
      if (doPente) {
        const recarga = recargaDepoisDoTiro(mesa, sceneKey, { carta, chaveDoGasto, regras: ctx.regras }, novos, armaId)
        if (recarga === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...recarga.partes)
        novos = recarga.turnos
        if (recarga.texto !== null) notaDosRequisitos = notaDaLinha(notaDosRequisitos, `(${recarga.texto})`)
      }
    }
    // ITENS REFEITOS, E6b (decisão 7): o Arremesso jogado sai da mochila (o boomerang não) e espera o "Tempo de recarga".
    if (pedido.tipo === 'atacar' && pedido.armaId !== null && carta.personagemId !== null) {
      const jogado = arremessoDepoisDoAtaque(mesa, sceneKey, { carta, chaveDoGasto, regras: ctx.regras }, novos, pedido.armaId)
      if (jogado === 'recusada') {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(...jogado.partes)
      novos = jogado.turnos
      if (jogado.texto !== null) notaDosRequisitos = notaDaLinha(notaDosRequisitos, `(${jogado.texto})`)
    }
    // Fase 8: o item que gasta tira 1 da vaga de quem usa (a ficha, ou o boneco na aventura não migrada); o Desfazer devolve.
    if (doItem !== null && doItem.uso.vaga.efeito.gasta === 'um' && carta.personagemId !== null) {
      const parte = gastarItemNaMesa(mesa, sceneKey, carta.tokenId, carta.personagemId, doItem.uso.vaga.id)
      if (parte === 'recusada' || parte === null) {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
      partes.push(parte)
    }
    // Frente A (25/11/2026): a técnica que gasta item (o Kit Médico da Medicina) tira da mochila de quem usa, como o "Usar";
    // o registro diz o mesmo que a mochila, e o Desfazer da linha devolve. O `podeAgir` já recusou sem item bastante.
    const gastoDaTecnica = cartaoDoPedido === null ? null : itemQueATecnicaGasta(cartaoDoPedido)
    if (gastoDaTecnica !== null && carta.personagemId !== null) {
      const gastou = gastarConsumivelNaMesa(mesa, sceneKey, carta.tokenId, carta.personagemId, gastoDaTecnica)
      partes.push(...gastou.partes)
      if (!gastou.ok) {
        devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
        return false
      }
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
    // Fase 8: o golpe do item guarda quantos sobram, para a linha fechar com o gasto também ao ser reescrita alvo a alvo.
    const sobraDoItem = doItem === null ? undefined : sobraDoUso(doItem.uso.vaga)
    let golpe = lancado.golpe === null || sobraDoItem === undefined ? lancado.golpe : { ...lancado.golpe, sobraDoItem }
    // ITENS REFEITOS, E6b (decisão 13): a técnica sem regra própria gasta o que pede (os requisitos, acima) e o mestre narra o efeito.
    if (golpe !== null && golpe.selo === undefined && doItem === null && cartaoUsado !== null && tecnicaSemRegraPropria(cartaoUsado.cartao)) notaDosRequisitos = notaDaLinha(notaDosRequisitos, '(sem regra própria: o mestre narra)')
    // REQUISITOS C: a nota fica no golpe (a linha reescrita alvo a alvo a mantém).
    if (golpe !== null && notaDosRequisitos !== null) golpe = { ...golpe, notaDosRequisitos }
    if (golpe !== null) {
      // F2 (fatia F, redoma da Orquídea): o selo que dura "até o próximo golpe" sai dos alvos deste golpe (antes do selo novo dele).
      // Construtor C5 (revisão): o montado não sai com a técnica de ajuda (a cura de um aliado, a técnica "em si").
      for (const saiu of selosQueSaemNoGolpe(novos.selos, golpe.alvos.map((alvo) => alvo.tokenId), lancado.ajuda === true)) {
        partes.push({ tipo: 'selo', seloId: saiu.id, antes: saiu })
        novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => selo.id !== saiu.id) }
      }
      // Rework das condições (E3, sair ao agir): quem age perde o que sai quando ele age (o Invisível), com nota na linha do golpe.
      const agiu = saidasNoToken(novos, carta.tokenId, { tipo: 'agir' }, nomeDoTokenNa(novos, mesa.personagens()))
      if (agiu.partes.length > 0) {
        novos = agiu.turnos
        partes.push(...agiu.partes)
        const nota = notaDaLinha(golpe.notaDosRequisitos ?? null, agiu.texto)
        if (nota !== null) golpe = { ...golpe, notaDosRequisitos: nota }
      }
      // F2 (fatia F, Golpe Baixo): quem usa ganha o selo da técnica ("+8 em reação" por 2 turnos dele).
      // Rework das condições (D2): pelo mesmo caminho do selo do golpe (a condição do nome congelada, o "ao entrar").
      if (golpe.seloEmQuemUsa !== undefined) {
        const proprio = seloPostoNaFicha(novos, carta, golpe.seloEmQuemUsa, { autor: golpe.autor, quemPos: carta.personagemId, origem: golpe.nome })
        if (proprio !== null) {
          partes.push(proprio.parte)
          novos = { ...novos, selos: proprio.selos }
          const nota = notaDaLinha(golpe.notaDosRequisitos ?? null, proprio.notas.length === 0 ? null : proprio.notas.join('; '))
          if (nota !== null) golpe = { ...golpe, notaDosRequisitos: nota }
        }
      }
      partes.push({ tipo: 'golpe', golpeId: golpe.id })
      efeitos.push({ tipo: 'golpe', golpeId: golpe.id, atacanteTokenId: golpe.atacanteTokenId, nome: golpe.nome, alvos: golpe.alvos.map((alvo) => alvo.tokenId), surpresa: golpe.surpresa, overload: golpe.overload })
      for (const resolvido of lancado.resolvidos) {
        // R1: a marca antes do dano (o dobro, a marca da técnica, o lembrete da passiva).
        const acerto = acertoComMarca(mesa, novos, golpe, resolvido, paraAnular(autor, novos))
        novos = acerto.turnos
        golpe = golpeComOAlvo(golpe, acerto.alvo)
        const alvo = acerto.alvo
        const feito = danoNoAlvo(mesa, alvo, golpe, autor, novos.selos)
        // Bug 11: o dano recusado leva de volta o custo e o dano dos alvos anteriores; o golpe não sai.
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...feito.partes, ...acerto.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        // Rework das condições (E3): o que sai com o dano, antes do selo novo do golpe.
        const saiuComODano = saidasDoDano(novos, golpe, alvo, nomeDoTokenNa(novos, mesa.personagens()))
        novos = saiuComODano.turnos
        partes.push(...saiuComODano.partes)
        // F3 (Q6): o selo do golpe pega no alvo que ele acertou (F2, fatia B: com a disputa da mecânica à mão).
        const noAcerto = seloNoAcerto(sceneKey, novos, golpe, saiuComODano.alvo)
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
          // Rework das condições (E3, sair ao receber cura): a vida curada tira o que sai com cura (o Sangrando).
          const saiuComACura = curou !== null && recursoDaCura === 'hp' && cura > 0 ? saidasNoToken(novos, alvo.tokenId, { tipo: 'cura' }, nomeDoTokenNa(novos, mesa.personagens())) : null
          if (saiuComACura !== null) {
            novos = saiuComACura.turnos
            partes.push(...saiuComACura.partes)
          }
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
            daOutra = `, ${recursoDaOutra === 'hp' ? `${notaDaCura(outra, coubeOutra)}${notaDosSelosNaCura(novos.selos, alvo.tokenId)}` : notaDoRecursoDaCura(recursoDaOutra, outra, coubeOutra)}`
          }
          // F2 (fatia F, Medicina): a nota diz o item gasto ("curou 100, gastou 1 Kit Médico").
          // Fase 5: pelo cartão (a montada tem o item nas peças, não na tabela pelo id).
          const item = gastoDaTecnica?.nome
          // A CURA TIRA O VENENO (`lib/curaPeloItem.ts`): o item gasto para curar tira o Envenenado do alvo ("..., tirou Envenenado").
          // Nº 3 do levantamento: o selo de mesmo nome sai junto com a pastilha (antes ficava, e o veneno seguia pedindo "Aplicar").
          const venenos = item === undefined ? [] : selosQueALimpezaTira(novos.selos, alvo.tokenId, { nomes: CONDICOES_QUE_A_CURA_TIRA })
          for (const selo of venenos) partes.push({ tipo: 'selo', seloId: selo.id, antes: selo })
          const semVeneno = new Set(venenos.map((selo) => selo.id))
          if (semVeneno.size > 0) novos = { ...novos, selos: (novos.selos ?? []).filter((selo) => !semVeneno.has(selo.id)) }
          // Nº 3: a limpeza tira os dois, como fora da batalha: as pastilhas (e o prazo) dos selos tirados saem da ficha do mapa.
          const curaDoItem = condicoesQueSaemNoAlvo(sceneKey, alvo.tokenId, [...tirados, ...venenos].map((selo) => selo.nome), item !== undefined)
          // ITENS REFEITOS, E6c: o espelho tirado de uma condição da FICHA de personagem: ela sai da ficha também (o antídoto, o "Tirar condição").
          if (alvo.personagemId !== null) {
            for (const selo of [...tirados, ...venenos]) {
              if (selo.daPastilha !== true) continue
              const saiu = tirarDaFichaPeloEspelho(mesa, alvo.personagemId, selo.nome)
              if (saiu !== null) partes.push(saiu.parte)
            }
          }
          if (curaDoItem !== null) curasDoItem.push(curaDoItem)
          const doVeneno = item === undefined || curaDoItem === null || curaDoItem.curou.length === 0 ? '' : `, tirou ${curaDoItem.curou.join(', ')}`
          const doItem = item === undefined ? '' : `, gastou ${gastoDaTecnica?.porUso ?? 1} ${item}${doVeneno}`
          // CURA REDUZIDA (25/11/2026): a linha diz por que a cura veio cortada ("curou 25 (Cura reduzida −50%)").
          const daCura = `${recursoDaCura === 'hp' ? `${notaDaCura(cura, coube)}${cura > 0 ? notaDosSelosNaCura(novos.selos, alvo.tokenId) : ''}` : notaDoRecursoDaCura(recursoDaCura, cura, coube)}${daOutra}${doItem}`
          const nomesTirados = limpeza.tira === undefined ? '' : tirados.length === 0 ? 'não tinha o que tirar' : `tirou ${tirados.map((selo) => selo.nome).join(', ')}`
          // Fase 8 (a Panaceia): a limpeza sem cura não diz "curou 0"; o pedaço da cura só entra com cura, como na que tira pelo nome.
          const tirouDebuffs = `tirou ${tirados.length} ${tirados.length === 1 ? 'debuff' : 'debuffs'}`
          const notaDaLimpeza = limpeza.soCura === true ? daCura : limpeza.tira !== undefined ? (cura > 0 ? `${nomesTirados}, ${daCura}` : nomesTirados) : cura > 0 ? `${tirouDebuffs}, ${daCura}` : tirouDebuffs
          const nota = saiuComACura === null || saiuComACura.texto === '' ? notaDaLimpeza : `${notaDaLimpeza}; ${saiuComACura.texto}`
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
        // Rework das condições (E3, sair ao receber cura): a vida curada em quem usa tira o que sai com cura, com nota na linha.
        const saiuComACura = curou !== null && emQuemUsa.recurso === 'hp' ? saidasNoToken(novos, carta.tokenId, { tipo: 'cura' }, nomeDoTokenNa(novos, mesa.personagens())) : null
        if (saiuComACura !== null && saiuComACura.partes.length > 0) {
          novos = saiuComACura.turnos
          partes.push(...saiuComACura.partes)
          const nota = notaDaLinha(golpe.notaDosRequisitos ?? null, saiuComACura.texto)
          if (nota !== null) golpe = { ...golpe, notaDosRequisitos: nota }
        }
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
        const feito = danoNoAlvo(mesa, resolvido, golpeDaParte, autor, novos.selos)
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, [...partes, ...seguintes.flatMap((anterior) => anterior.partes), ...daParte], autor)
          return false
        }
        daParte.push(...feito.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        // Rework das condições (E3): o que sai com o dano da parte, antes do selo dela.
        const saiuComODano = saidasDoDano(novos, golpeDaParte, resolvido, nomeDoTokenNa(novos, mesa.personagens()))
        novos = saiuComODano.turnos
        daParte.push(...saiuComODano.partes)
        const noAcerto = seloNoAcerto(sceneKey, novos, golpeDaParte, saiuComODano.alvo)
        golpeDaParte = golpeComOAlvo(golpeDaParte, noAcerto.alvo)
        if (noAcerto.selado !== null) {
          daParte.push(noAcerto.selado.parte)
          novos = { ...novos, selos: noAcerto.selado.selos }
        }
      }
      novos = { ...novos, golpes: comGolpe(novos.golpes, golpeDaParte) }
      seguintes.push({ golpe: golpeDaParte, partes: daParte })
    }
    // REQUISITOS B3: a ação dele (técnica, Atacar ou item; concentrar e mover não trocam a de antes) e o que os golpes
    // e o dano deixaram no rastro (antes de o invocado caído sair: a queda dele também conta).
    const acaoDoRastro: UltimaAcaoDoRastro | null =
      pedidoDeQuemAge.tipo === 'atacar' ? { tipo: 'atacar' } : pedidoDeQuemAge.tipo === 'item' ? { tipo: 'item' } : pedidoDeQuemAge.tipo === 'habilidade' ? { tipo: 'cartao', cartaoId: pedidoDeQuemAge.cartaoId, nome: typeof cartaoDoPedido === 'object' && cartaoDoPedido !== null ? cartaoDoPedido.nome : (golpe?.nome ?? '') } : null
    if (acaoDoRastro !== null && carta.personagemId !== null) {
      const agiu = anotarAcao(novos, carta.personagemId, acaoDoRastro, turnos.vez === carta.id ? chaveDaVez(turnos.rodada, carta.id) : null)
      partes.push(...agiu.partes)
      novos = agiu.turnos
    }
    const golpesDaLinha = [...(golpe === null ? [] : [{ antes: null, depois: golpe }]), ...seguintes.map((parte) => ({ antes: null, depois: parte.golpe }))]
    const rastreado = rastrear(novos, efeitos, [...partes, ...seguintes.flatMap((parte) => parte.partes)], golpesDaLinha)
    partes.push(...rastreado.partes)
    novos = rastreado.turnos
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
    const quemSaiu = textoDosQueSairam(caidos.nomes)
    if (golpe !== null) {
      // Fase 8: o gasto do item (`sobraDoItem`) vem por último, depois de quem saiu: o teto do registro não o come.
      texto = textoDoGolpe(golpe, nomeDoToken, quemSaiu)
      tipo = pedido.tipo === 'habilidade' ? 'habilidade' : 'golpe'
    } else {
      texto = pedido.tipo === 'concentrar' ? `${quemAge} concentrou (carga ${lancado.combate?.carga ?? 0}${lancado.acao === 'livre' ? ', sem gastar ação' : ''})` : `${quemAge} usou o contra-ataque para se mover`
      texto += quemSaiu
      if (doItem !== null) texto = linhaComOGasto(texto, textoDoGasto(doItem.uso.vaga))
      tipo = 'acao'
    }
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
    if (pedido.tipo === 'habilidade' && doItem === null && carta.personagemId !== null) {
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
        const acerto = acertoComMarca(mesa, novos, semResposta, semMarca, paraAnular(MESTRE, novos))
        novos = acerto.turnos
        golpe = golpeComOAlvo(semResposta, acerto.alvo)
        const feito = danoNoAlvo(mesa, acerto.alvo, golpe, MESTRE, novos.selos)
        // Bug 11: dano recusado = este golpe segue esperando (o dano dos outros alvos dele volta); a próxima virada tenta de novo.
        if (feito === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, MESTRE)
          recusou = true
          break
        }
        partes.push({ tipo: 'reacaoComTecnica', golpe, tokenId: esperando.tokenId, alvoAntes: esperando }, ...acerto.partes, ...feito.partes)
        if (feito.efeito !== null) efeitos.push(feito.efeito)
        // Rework das condições (E3): o que sai com o dano, antes do selo novo do golpe.
        const saiuComODano = saidasDoDano(novos, golpe, acerto.alvo, nomeDoTokenNa(novos, mesa.personagens()))
        novos = saiuComODano.turnos
        partes.push(...saiuComODano.partes)
        const noAcerto = seloNoAcerto(sceneKey, novos, golpe, saiuComODano.alvo)
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
      // REQUISITOS B3: o golpe fechado e o dano, no rastro.
      const rastreado = rastrear(novos, efeitos, partes, [{ antes, depois: golpe }])
      partes.push(...rastreado.partes)
      novos = rastreado.turnos
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

  /** O `agir` da store; `aceite` (REQUISITOS E e J2) = o pedido congelado de um pedido de ajuda aceito ou aprovado pelo mestre. */
  const agirNaCena = (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao, tela?: TelaDoPedido, aceite?: AceitesDoPedido): boolean => {
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
    return agirComACarta(sceneKey, cena, autor, carta, turnos, carta.id, pedido, tela, aceite)
  }

  /** REQUISITOS E e J2: o aliado aceitou (ou o mestre aprovou); o pedido congelado roda o portão inteiro de novo, com o autor de quem pediu. */
  const agirComAjudaAceita = (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao, aceites: AceitesDoPedido): boolean => agirNaCena(sceneKey, autor, vez, pedido, undefined, aceites)

  const acoes: Pick<BatalhaState, 'motivoDoAgir' | 'alcanceDaMira' | 'agir' | 'reagir' | 'darDano' | 'darAcoesExtras' | 'escolherArmas' | 'zerarCarga' | 'trocarPerfurante'> = {
    motivoDoAgir: (sceneKey, autor, vez, pedido, tela) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return 'A batalha não está ligada nesta cena'
      const { turnos } = cena
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      const contra = contraDe === undefined ? null : ((turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe) ?? null)
      if (contraDe !== undefined && contra === null) return 'Esse contra-ataque não existe mais'
      if (contra === null && (vez === null || turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada)) return 'A vez já passou'
      const carta = contra === null ? cartaDaVez(turnos) : (turnos.cartas.find((candidata) => candidata.tokenId === contra.tokenId) ?? null)
      if (carta === null || carta.bando !== undefined) return 'Não é a vez desta ficha'
      return podeAgir(contextoDaCarta(sceneKey, cena, autor, carta, turnos, tela), pedido)
    },

    alcanceDaMira: (sceneKey, autor, tokenId, acao) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return null
      const { turnos } = cena
      // A carta da vez dessa ficha, ou a do contra-ataque que ela guardou (a mira do contra abre fora da vez).
      const daVez = cartaDaVez(turnos)
      const contra = (turnos.contras ?? []).find((candidato) => candidato.tokenId === tokenId)
      const carta = daVez !== null && daVez.tokenId === tokenId ? daVez : contra === undefined ? null : (turnos.cartas.find((candidata) => candidata.tokenId === tokenId) ?? null)
      if (carta === null || carta.bando !== undefined) return null
      return alcanceDaMira(contextoDaCarta(sceneKey, cena, autor, carta, turnos), acao)
    },

    agir: (sceneKey, autor, vez, pedido, tela) => agirNaCena(sceneKey, autor, vez, pedido, tela),

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
          // S4: Atordoado ou Paralisado não reage (o golpe que já esperava também não). D3: o bloqueio "Não pode reagir".
          if (naoReageDoToken(turnos.selos, alvo.tokenId) !== null) return false
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
            // Rework das habilidades (D3, a Passiva de raça): e a raça de quem atacou que não deixa desviar ("quem ele acerta não esquiva").
            const doAtacante = personagens.find((candidato) => candidato.id === golpe.atacantePersonagemId)
            const daRaca = [...(doAlvo === undefined ? [] : saidasTiradasDoDono(chavesDoDono(doAlvo))), ...(doAtacante === undefined ? [] : saidasTiradasPeloAtacante(chavesDoDono(doAtacante)))]
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
          const acerto = acertoComMarca(mesa, turnos, novo, semMarca, paraAnular(autor, turnos))
          marcados = acerto.turnos
          selos = marcados.selos
          novo = golpeComOAlvo(novo, acerto.alvo)
          const resolvido = acerto.alvo
          const feito = danoNoAlvo(mesa, resolvido, golpe, autor, marcados.selos)
          // Bug 11: dano recusado = o alvo segue esperando (sem linha nova nem animação).
          if (feito === 'recusada') return false
          partes.push(...feito.partes, ...acerto.partes)
          if (feito.efeito !== null) efeitos.push(feito.efeito)
          // Rework das condições (E3): o que sai com o dano, antes do selo novo do golpe.
          const saiuComODano = saidasDoDano(marcados, golpe, resolvido, nomeDoTokenNa(marcados, personagens))
          marcados = saiuComODano.turnos
          selos = marcados.selos
          partes.push(...saiuComODano.partes)
          // F3 (Q6): o selo do golpe só pega se o golpe acertou este alvo.
          const noAcerto = seloNoAcerto(sceneKey, marcados, golpe, saiuComODano.alvo)
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
      const mexeuNaFicha = partes.length > 0
      // REQUISITOS B3: o alvo resolvido (o que esquivou também: o erro não tem dano) e o dano, no rastro (as partes vão na linha do golpe).
      const rastreado = rastrear(novos, efeitos, partes, [{ antes: golpe, depois: novo }])
      partes.push(...rastreado.partes)
      novos = rastreado.turnos
      // Tipos de habilidade F3: o alvo resolvido tomou o dano: o gatilho de vida lê a ficha de agora (a reversão vai na linha do golpe).
      if (mexeuNaFicha) {
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
      const daFicha = reversaoDaFicha(personagemId, partes)
      // REQUISITOS B3: o dano livre também entra no rastro (o apanhou, a queda).
      const rastreado = rastrear(atual.turnos, [{ tipo: 'dano', tokenId, valor: dado, saida: 'direto' }], daFicha)
      // Invocação (decisão 9): o invocado que o dano levou a 0 sai do mapa e do bando.
      const caidos = semOsCaidos(mesa, sceneKey, rastreado.turnos)
      const semCaidos = caidos.partes.length === 0 ? caidos.turnos : comBandosEmDia(caidos.turnos, nomeDoBandoNa(caidos.turnos, mesa.personagens()))
      const texto = `${nomeDoAutor(autor)} deu ${dado} de dano em ${alvo}${reducao}${textoDosQueSairam(caidos.nomes)}`
      // Tipos de habilidade F3: o gatilho de vida depois do dano livre (o mesmo ponto do golpe).
      const lembrados = lembrarDepoisDoDano(semCaidos)
      gravarCena(sceneKey, {
        ...comMudanca(atual, lembrados.turnos, { tipo: 'dano', texto, autor, tokenIds: [tokenId], reversao: { tipo: 'composta', partes: [...daFicha, ...rastreado.partes, ...caidos.partes, ...partesDosLembretes(lembrados)] } }),
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
  return { agirComACarta, agirComAjudaAceita, fecharGolpesSemResposta, acoes }
}

/** O que `criarGolpe` devolve. */
export type GolpeNaStore = ReturnType<typeof criarGolpe>
