import { valorDoRank } from '../ajusteDaFicha'
import { acoesDaCarta, danoSugeridoDoAtaque, sugestaoParaNpc, type SugestaoDoNpc } from '../batalha/golpe'
import { acaoDoConcentrar, motivoDoAtacar, motivoDoConcentrar, tecnicasNoMenu, type AcoesDaVez, type TecnicaNoMenu } from '../batalha/acoes'
import {
  chaveDaVez,
  DANO_MAX,
  type AcaoDaForma,
  type AcaoDaTecnica,
  type BonusDaBatalha,
  type CombateDoPersonagem,
  type LembreteDaPassiva,
  type PedidoDeAcao,
  type PedidoDeAlvo,
  type PedidoDeMarca,
  type PedidoDePassiva,
  type PedidoDeReacao,
  type SeloPedido,
} from '../batalha/combate'
import { lerDano, type ContextoDaFormula } from '../batalha/formula'
import { armasDe, type ArmaDaFicha } from '../batalha/leituraDaFicha'
import { danoDaTecnicaComAVida } from '../batalha/leituraDaTecnica'
import { lerMarca, type ComoMarca } from '../batalha/marca'
import { formaDecididaPeloMestre } from '../batalha/mecanica/formaDoMestre'
import { cartaoMontado, pecasDoCartao, seloDasPecas } from '../batalha/mecanica/leitura'
import { formulaDaCura, limpezaDe } from '../batalha/mecanicasAMao'
import { passivasDe, passivasLigadas, type PassivaNaTira } from '../batalha/passivas'
import type { VezEsperada } from '../batalha/ponte'
import { ehLembreteDaPreparacao } from '../batalha/preparacao'
import type { RegrasDaBatalha } from '../batalha/regrasDoCampo'
import { bonusDaBatalha, bonusDaReacao, seloPedidoValido, selosDoToken } from '../batalha/selos'
import { seloSugeridoDaTecnica } from '../batalha/tiposDaHabilidade'
import { formasNoMenu } from '../batalha/transformacao'
import { cartaDaVez, tokensCaidos, type CartaDaOrdem, type TurnosDaCena } from '../batalha/turnos'
import { reacaoDoBoneco } from '../arena/reacaoDoBoneco'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem, type VidaDaFicha } from '../vidaDaFicha'
import { equipesDasVagas, type VagaDaLuta } from './mesaEmMemoria'

/**
 * O ROBÔ DO TREINO (LOBBY v2, fatia T3 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2; refeito na raia R2 de
 * docs/planos/unificacao-do-combate-2026-11-10.md: "o robô usa cura, buff,
 * passiva, concentrar e forma, com alvo aliado"). A próxima jogada de quem
 * está esperando na luta:
 *  - REAÇÃO primeiro: golpe esperando uma vaga = a defesa do boneco da arena
 *    (`reacaoDoBoneco` no modo "d20"): rola com o bônus de reação dos selos e
 *    escolhe a melhor saída que o dado liberou (esquiva > metade > cheio,
 *    nunca o contra-ataque). A vaga marcada `reage: 'parado'` (o Judge com
 *    "Fica parado", fatia J) não reage: o golpe entra cheio, sem d20;
 *  - depois a VEZ: a lista do que tentar, em ordem. Quem executa tenta um por
 *    um; a regra da batalha recusa o que não vale, e se nada passar ele passa
 *    a vez.
 *
 * A ORDEM DA VEZ (`golpesDoRobo`):
 *  1. CURA: alguém do lado dele (ele inclusive) abaixo de 60% da vida e uma
 *     técnica que cura (`limpezaDe`: a Bolha, o Revigorar, a Medicina): cura
 *     o mais ferido. A cura que custa o golpe da vez (Ação Simples ou
 *     Completa) sai nas rodadas ímpares, ou em qualquer uma com o ferido
 *     abaixo de 30%, e só se devolve pelo menos 5% da vida máxima dele (a
 *     cura pequena e sem limite não toma o lugar do golpe para sempre);
 *  2. FORMA: a transformação desligada que ele pode ativar, com a ação da
 *     ficha. Ficam de fora a que troca outra forma ligada do mesmo grupo e a
 *     que o mestre decide os números (no site não há mestre para decidir);
 *  3. AJUDA: a técnica de Tipo Buff (nele; a montada "nos aliados", nele e
 *     depois nos colegas) e a de Tipo Debuff sem dano (no inimigo mais
 *     ferido), em quem ainda não tem o selo dela. Sem selo que ele consiga
 *     conferir, só abre a luta com ela (rodada 1, antes de tudo);
 *  4. CONCENTRAR antes do golpe quando sai de graça (a 3ª carga) ou quando a
 *     técnica mais forte está em recarga e dá pelo menos o dobro do melhor
 *     golpe de agora (ele carrega enquanto espera);
 *  5. GOLPE: todos os que ele pode pagar agora, do mais forte ao mais fraco,
 *     no alvo que o app sugere para o NPC (`sugestaoParaNpc`, a mesma escolha
 *     do painel do mestre: o inimigo de pé mais ferido). No empate de dano, o
 *     golpe que o app sugere vem primeiro. A ordem segue "o mais forte"
 *     (decisão do usuário) e não a sugestão inteira porque ela prefere a
 *     técnica ao Atacar mesmo mais fraca e só lê a arma padrão;
 *  6. CONCENTRAR por último, se ainda couber (sobrou a Bônus, ou nenhum golpe
 *     passou).
 * A forma e a ajuda que custam o golpe da vez só saem nas rodadas ímpares: nas
 * pares ele bate (senão o robô com três buffs nunca atacaria). O último golpe
 * da vez (`GOLPES_POR_VEZ_MAX`) fica para a cura e o golpe, sem preparo.
 *
 * O dano do golpe vai PREENCHIDO (achado Tr1 do plano, "robô sem dano =
 * empate por tempo"): na técnica, o `dano.valor` de `tecnicasNoMenu`; na de
 * "% da vida do alvo", a conta com a vida dele (o motor refaz na hora); no
 * Atacar, `danoSugeridoDoAtaque` com a arma. Técnica de "dano à mão" é
 * pulada: a marcada À mão no cartão (`aMao`) ou a de dano que a leitura não
 * calcula (sem número, "Dano da arma" sem arma). Também ficam de fora a de
 * custo que a ficha não diz ao certo (a tela perguntaria), a de custo em HP
 * que derruba quem usa e a sem dano que não é cura, Buff nem Debuff (o robô
 * não sabe o que ela faz). Sem nenhuma técnica, o Atacar com a arma; sem arma
 * utilizável, ou sem nenhuma de dano que a conta lê ("1d6", o Escudo sem
 * dano), o Atacar sem arma (a Força): o robô não digita o dano, e a arma
 * ilegível não pode deixá-lo mais fraco do que sem arma.
 *
 * A técnica vai com o selo que a mira sugere (`seloSugeridoDaTecnica`): na
 * mira ele já abre marcado (MiraDoGolpe, `comSelo`), então é o padrão da
 * regra. Sem ele, a técnica de atordoar ou o Debuff com dano virava só dano.
 *
 * Empate de dano entre golpes: o Atacar vem antes (não gasta SP), depois as
 * técnicas na ordem da ficha. Teto de golpes por vez (`GOLPES_POR_VEZ_MAX`):
 * a técnica de Ação Livre sem custo nem recarga não segura a vez para sempre.
 *
 * FORA DA VEZ, quem executa pergunta antes: o lembrete da marca
 * (`marcaDoRobo`, o Olhar Artístico do Vincent) e as passivas
 * (`passivasDoRobo`: o lembrete esperando resposta e a passiva cujo gatilho
 * bateu). O robô nunca põe selo por conta própria ("Pôr selo..."), nunca
 * desfaz forma e nunca invoca.
 *
 * Nada aqui olha id aleatório para decidir (carta, golpe e linha têm
 * `crypto.randomUUID`): só a ordem das vagas, das cartas e dos golpes, a vida
 * e a rodada. Assim a mesma semente dá a mesma luta, também depois de pausar
 * em JSON.
 *
 * Puro: sem store, sem DOM.
 */

/** Golpes que uma carta dá numa vez, no máximo. Com a Simples gasta, só a técnica de Ação Livre ainda passaria. */
export const GOLPES_POR_VEZ_MAX = 3

/** Abaixo desta parte da vida (60%), alguém do lado pede cura. */
const VIDA_QUE_PEDE_CURA = 0.6
/** Abaixo desta (30%), a cura sai mesmo custando o golpe numa rodada de bater. */
const VIDA_CRITICA = 0.3
/** Quantos feridos cada cura tenta, do mais ferido ao menos (o segundo, se a regra recusar o primeiro). */
const ALVOS_DA_CURA_MAX = 2
/** A cura que custa o golpe da vez tem de devolver pelo menos esta parte (5%) da vida máxima do ferido: abaixo disso, bater vale mais. */
const CURA_QUE_VALE_O_GOLPE = 0.05
/** A técnica em recarga vale a espera concentrando quando dá pelo menos isto vezes o melhor golpe de agora. */
const VANTAGEM_PARA_ESPERAR = 2

const CONCENTRAR: PedidoDeAcao = { tipo: 'concentrar' }

/** O que o robô lê da luta agora. */
export interface VistaDoRobo {
  turnos: TurnosDaCena
  regras: RegrasDaBatalha | null
  vagas: readonly VagaDaLuta[]
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
  /** Quantos golpes a carta da vez já deu nesta vez (quem executa conta). */
  golpesNaVez: number
}

/** O que o robô lê para as passivas (fora da vez). */
export type VistaDasPassivas = Pick<VistaDoRobo, 'turnos' | 'vagas' | 'personagens' | 'sistema'>

/**
 * A próxima jogada. "reagir": um pedido de reação de uma vaga. "vez": a carta
 * da vez e o que tentar, na ordem; lista vazia (ou nenhum aceito) = passar a
 * vez com `esperado`.
 */
export type JogadaDoRobo =
  | { tipo: 'reagir'; pedido: PedidoDeReacao }
  | { tipo: 'vez'; tokenId: string; esperado: VezEsperada; golpes: readonly PedidoDeAcao[] }

/** Uma vaga de pé na luta, com a cópia e a vida dela. */
interface Lutador {
  vaga: VagaDaLuta
  copia: Personagem
  /** `null` = sem vida legível. */
  vida: VidaDaFicha | null
  /** A parte da vida de agora (0 a 1); sem vida legível, 1: no fim da fila do alvo. */
  proporcao: number
}

/** De pé = vida acima de 0, ou sem vida legível (a mesma leitura de `fimDaLuta`). */
function dePe(personagem: Personagem, sistema: SistemaDeRpg | null): boolean {
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return vida === null || vida.atual > 0
}

/** As vagas de pé que estão na ordem, na ordem das vagas. */
function lutadoresDePe(vista: VistaDasPassivas): Lutador[] {
  const recurso = recursoDeVida(vista.sistema)
  const porId = new Map(vista.personagens.map((personagem) => [personagem.id, personagem]))
  const naOrdem = new Set(vista.turnos.cartas.map((carta) => carta.tokenId))
  const lista: Lutador[] = []
  for (const vaga of vista.vagas) {
    if (!naOrdem.has(vaga.tokenId)) continue
    const copia = porId.get(vaga.personagemId)
    if (copia === undefined) continue
    const vida = recurso === null ? null : vidaDoPersonagem(copia, recurso)
    if (vida !== null && vida.atual <= 0) continue
    lista.push({ vaga, copia, vida, proporcao: vida === null ? 1 : vida.atual / vida.maximo })
  }
  return lista
}

/** Do mais ferido ao menos (empate: a ordem das vagas; `sort` é estável). */
function doMaisFerido(lutadores: readonly Lutador[]): Lutador[] {
  return [...lutadores].sort((a, b) => a.proporcao - b.proporcao)
}

/** O pedido de reação da primeira vaga (na ordem das vagas) com golpe esperando por ela; `null` = ninguém. */
function reacaoPendente(vista: VistaDoRobo): PedidoDeReacao | null {
  for (const vaga of vista.vagas) {
    const modificador = bonusDaReacao(bonusDaBatalha(vista.turnos.selos, vaga.tokenId))
    const pedido = reacaoDoBoneco(vista.turnos.golpes, vaga.tokenId, vaga.reage ?? 'd20', modificador, vista.turnos.selos)
    if (pedido !== null) return pedido
  }
  return null
}

/** O dano no teto do pedido (inteiro de 0 a `DANO_MAX`). O duelo (`duelo.ts`) recalcula com o mesmo. */
export function danoNoTeto(valor: number): number {
  return Math.min(DANO_MAX, Math.max(0, Math.floor(valor)))
}

/** As armas que o robô pode usar: as levadas (ou todas, sem escolha) que não são de dano à mão. */
function armasUtilizaveis(personagem: Personagem, combate: CombateDoPersonagem | undefined): ArmaDaFicha[] {
  const levadas = combate?.armas ?? null
  return armasDe(personagem).filter((arma) => arma.aMao !== true && (levadas === null || levadas.includes(arma.id)))
}

/** O custo em HP que leva quem usa a 0 (ou abaixo): o robô não se derruba. */
function custoQueDerruba(tecnica: TecnicaNoMenu, personagem: Personagem, sistema: SistemaDeRpg): boolean {
  if (tecnica.custo.tipo !== 'valor' || tecnica.custo.recurso !== 'hp') return false
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return vida !== null && tecnica.custo.valor >= vida.atual
}

/** A técnica tem leitura que o robô manda sem perguntar: custo certo, com ação e não à mão. */
function legivel(tecnica: TecnicaNoMenu): tecnica is TecnicaNoMenu & { acao: AcaoDaTecnica } {
  return tecnica.custo.tipo !== 'pergunta' && tecnica.acao !== null && tecnica.acao !== 'passiva' && tecnica.cartao.aMao !== true
}

/** A técnica que o robô pode usar agora: legível, disponível, e sem custo em HP que o derruba. */
function utilizavel(tecnica: TecnicaNoMenu, personagem: Personagem, sistema: SistemaDeRpg): tecnica is TecnicaNoMenu & { acao: AcaoDaTecnica } {
  return legivel(tecnica) && tecnica.motivo === null && !custoQueDerruba(tecnica, personagem, sistema)
}

/** Para que o robô usa a técnica: curar o lado dele, ajudar (Buff), enfraquecer sem dano (Debuff) ou bater. */
type PapelDaTecnica = 'cura' | 'ajuda' | 'debuff' | 'golpe'

/** Sem número de dano: a de suporte ("-") ou o campo que a conta não lê (vazio). */
function semNumero(tecnica: TecnicaNoMenu): boolean {
  return tecnica.dano.tipo === 'semDano' || tecnica.dano.tipo === 'naoEntende'
}

/**
 * O papel da técnica; `null` = o robô não usa (a de ajuda com número de dano,
 * a sem dano que não é cura, Buff nem Debuff). A cura é a que a regra chama
 * de limpeza; a ajuda, o Tipo Buff ou a montada que vale "em si" ou "nos
 * aliados"; o golpe, a de dano lido (ou "% da vida do alvo").
 */
function papelDaTecnica(tecnica: TecnicaNoMenu): PapelDaTecnica | null {
  if (limpezaDe(tecnica.cartao) !== null) return tecnica.dano.tipo === 'valor' ? null : 'cura'
  const quem = pecasDoCartao(tecnica.cartao)?.alvo.quem
  if (tecnica.tipo.tipo === 'buff' || quem === 'si' || quem === 'aliados') return semNumero(tecnica) ? 'ajuda' : null
  if (tecnica.dano.tipo === 'valor' || tecnica.dano.tipo === 'precisaAlvo') return 'golpe'
  return tecnica.tipo.tipo === 'debuff' && semNumero(tecnica) ? 'debuff' : null
}

/** A ação gasta a Simples, que é o golpe da vez. */
function custaOGolpe(acao: AcaoDaTecnica | AcaoDaForma): boolean {
  return acao === 'simples' || acao === 'completa'
}

/** Nas rodadas ímpares o robô pode trocar o golpe por preparo (forma, Buff, Debuff sem dano, cura); nas pares, bate. */
function rodadaDePreparo(rodada: number): boolean {
  return rodada % 2 === 1
}

/** As técnicas do menu lidas com uma arma (`null` = sem arma). */
interface MenuComArma {
  arma: ArmaDaFicha | null
  tecnicas: readonly TecnicaNoMenu[]
}

/** A vez de uma carta do robô, já lida. */
interface VezDoRobo {
  turnos: TurnosDaCena
  sistema: SistemaDeRpg
  carta: CartaDaOrdem
  personagem: Personagem
  combate: CombateDoPersonagem | undefined
  acoes: AcoesDaVez
  /** O que os selos de quem age somam. */
  bonus: BonusDaBatalha
  /** Um menu por arma utilizável; sem arma, um só (sem arma). */
  menus: readonly MenuComArma[]
  /** Ele mesmo; `undefined` = fora da ordem (não deveria). */
  eu: Lutador | undefined
  /** Os de pé do lado dele (ele inclusive), do mais ferido ao menos. */
  aliados: readonly Lutador[]
  /** Os de pé dos outros lados, do mais ferido ao menos. */
  inimigos: readonly Lutador[]
  golpesNaVez: number
}

interface GolpeCandidato {
  dano: number
  pedido: PedidoDeAcao
  /** Técnica: o cartão (a mesma técnica com outra arma não repete). `null` = o Atacar. */
  cartaoId: string | null
  armaId: string | null
}

/** O Atacar com a arma (`null` = sem arma, a Força); `null` = a conta não lê o dano dela. */
function ataqueCom(personagem: Personagem, sistema: SistemaDeRpg, arma: ArmaDaFicha | null, alvo: string): GolpeCandidato | null {
  // Construtor C8: a arma montada (efeito com usos, o Boomerang) fica fora: o robô não conta os usos nem lê o dano das peças.
  // A só de efeito ("Nada" no Soma no ataque) já sai pela conta: `danoSugeridoDoAtaque` dá `null` (sem dano).
  if (arma !== null && cartaoMontado(arma)) return null
  const valor = danoSugeridoDoAtaque(personagem, sistema, arma)
  if (valor === null) return null
  const dano = danoNoTeto(valor)
  const armaId = arma?.id ?? null
  return { dano, cartaoId: null, armaId, pedido: { tipo: 'atacar', armaId, alvos: [{ tokenId: alvo, dano }], surpresa: false, perfurante: false } }
}

/**
 * Os Atacar possíveis: um por arma utilizável de dano legível; nenhuma (sem
 * arma, ou todas de dano que a conta não lê) = o Atacar sem arma, que o
 * `podeAgir` aceita sempre. Simples já gasta = nenhum.
 */
function ataques(vez: VezDoRobo, alvo: string): GolpeCandidato[] {
  const { personagem, sistema } = vez
  if (motivoDoAtacar(vez.acoes) !== null) return []
  const lista: GolpeCandidato[] = []
  for (const { arma } of vez.menus) {
    const golpe = arma === null ? null : ataqueCom(personagem, sistema, arma, alvo)
    if (golpe !== null) lista.push(golpe)
  }
  if (lista.length > 0) return lista
  const semArma = ataqueCom(personagem, sistema, null, alvo)
  return semArma === null ? [] : [semArma]
}

/**
 * O selo que a mira manda por padrão com a técnica: o sugerido, no formato
 * do fio (nome, turnos e mods; a natureza e o cartaoId o host tira da
 * técnica). A que marca ao acertar não leva, como no menu (`dadosDoMenu`):
 * a marca já é o efeito dela. O duelo (`duelo.ts`) recalcula com o mesmo.
 */
export function seloDaMira(cartao: TecnicaNoMenu['cartao'], sistema: SistemaDeRpg): SeloPedido | null {
  if (lerMarca(cartao, sistema)?.tipo === 'aoAcertar') return null
  const sugerido = seloSugeridoDaTecnica(cartao, sistema)
  return sugerido === null ? null : seloPedidoValido(sugerido, sistema)
}

/** O pedido da técnica como a mira manda: o custo e a ação da ficha (`null`) e o selo que ela sugere. */
function pedidoDaTecnica(tecnica: TecnicaNoMenu, sistema: SistemaDeRpg, armaId: string | null, alvos: readonly PedidoDeAlvo[], perfurante: boolean): PedidoDeAcao {
  const selo = seloDaMira(tecnica.cartao, sistema)
  return {
    tipo: 'habilidade',
    cartaoId: tecnica.cartao.id,
    armaId,
    alvos,
    surpresa: false,
    perfurante,
    // A porcentagem que a habilidade diz (como a mira: o interruptor Perfurante começa no da ficha).
    ...(perfurante && tecnica.perfuracao !== undefined ? { perfuracao: tecnica.perfuracao } : {}),
    custo: null,
    acao: null,
    ...(selo === null ? {} : { selo }),
  }
}

/** O dano da técnica no alvo: o lido; o "% da vida do alvo", com a vida dele (o motor refaz a conta na hora). `null` = a conta não lê. */
function danoNoAlvo(tecnica: TecnicaNoMenu, formula: Omit<ContextoDaFormula, 'vidaDoAlvo'>, alvo: Lutador): number | null {
  if (tecnica.dano.tipo === 'valor') return tecnica.dano.valor
  if (tecnica.dano.tipo !== 'precisaAlvo' || alvo.vida === null) return null
  const comAVida = danoDaTecnicaComAVida(tecnica.cartao, formula, alvo.vida)
  return comAVida.tipo === 'valor' ? comAVida.valor : null
}

/** As técnicas de golpe possíveis, com o dano lido com cada arma utilizável (a que fala de "Dano da arma" muda com ela). */
function tecnicasDeGolpe(vez: VezDoRobo, alvo: Lutador): GolpeCandidato[] {
  const { personagem, sistema } = vez
  const lista: GolpeCandidato[] = []
  for (const { arma, tecnicas } of vez.menus) {
    for (const tecnica of tecnicas) {
      if (!utilizavel(tecnica, personagem, sistema) || papelDaTecnica(tecnica) !== 'golpe') continue
      const valor = danoNoAlvo(tecnica, { personagem, sistema, arma, bonusDaBatalha: vez.bonus }, alvo)
      if (valor === null) continue
      const dano = danoNoTeto(valor)
      const armaId = arma?.id ?? null
      lista.push({ dano, cartaoId: tecnica.cartao.id, armaId, pedido: pedidoDaTecnica(tecnica, sistema, armaId, [{ tokenId: alvo.vaga.tokenId, dano }], tecnica.perfurante) })
    }
  }
  return lista
}

/** O golpe é o que o app sugere para o NPC: a mesma técnica (ou o Atacar, sem técnica) com a mesma arma. */
function ehOSugerido(golpe: GolpeCandidato, sugestao: SugestaoDoNpc): boolean {
  return golpe.cartaoId === sugestao.cartaoId && golpe.armaId === sugestao.armaId
}

/**
 * Os golpes no alvo, do mais forte ao mais fraco (empate: o que o app sugere
 * para o NPC, depois o Atacar, depois as técnicas na ordem da ficha; a mesma
 * técnica com outra arma só fica a mais forte).
 */
function golpesNoAlvo(vez: VezDoRobo, alvo: Lutador, sugestao: SugestaoDoNpc): GolpeCandidato[] {
  const candidatos = [...ataques(vez, alvo.vaga.tokenId), ...tecnicasDeGolpe(vez, alvo)]
  // `sort` é estável: no empate que sobra fica a ordem de cima (Atacar, depois a ficha).
  const ordenados = candidatos.sort((a, b) => b.dano - a.dano || Number(ehOSugerido(b, sugestao)) - Number(ehOSugerido(a, sugestao)))
  const vistas = new Set<string>()
  const golpes: GolpeCandidato[] = []
  for (const candidato of ordenados) {
    if (candidato.cartaoId !== null) {
      if (vistas.has(candidato.cartaoId)) continue
      vistas.add(candidato.cartaoId)
    }
    golpes.push(candidato)
  }
  return golpes
}

/** As técnicas de apoio (cura, ajuda) não mudam com a arma: valem as do primeiro menu. */
function tecnicasDeApoio(vez: VezDoRobo): readonly TecnicaNoMenu[] {
  return vez.menus[0]?.tecnicas ?? []
}

/**
 * Quanto a técnica cura agora, pela conta da regra (`formulaDaCura` com a
 * carga de agora, lida por `lerDano` como a store lê). `null` = a conta não
 * fecha (a regra recusa o pedido sem cobrar) ou a técnica não diz.
 */
function quantoCura(tecnica: TecnicaNoMenu, vez: VezDoRobo): number | null {
  const limpeza = limpezaDe(tecnica.cartao)
  if (limpeza === null) return null
  const lida = lerDano(formulaDaCura(limpeza, vez.combate?.carga ?? 0), { personagem: vez.personagem, sistema: vez.sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: vez.bonus })
  return lida.tipo === 'valor' ? lida.valor : lida.tipo === 'semDano' ? 0 : null
}

/**
 * A cura paga o golpe que ela custa? Só quando devolve pelo menos
 * `CURA_QUE_VALE_O_GOLPE` da vida máxima do ferido. Sem isso, o robô com uma
 * cura pequena e sem limite gastava todas as vezes num colega que não saía do
 * vermelho e nunca batia (fase final, risco 1: de 73% para 6% de vitória).
 * Sem número lido, decide a regra (ela recusa a conta que não fecha).
 */
function curaValeOGolpe(quanto: number | null, ferido: Lutador): boolean {
  return quanto === null || ferido.vida === null || quanto >= ferido.vida.maximo * CURA_QUE_VALE_O_GOLPE
}

/**
 * As curas: cada técnica que cura, nos feridos do lado dele (abaixo de
 * `VIDA_QUE_PEDE_CURA`), do mais ferido ao menos. A que só vale "em si" (a
 * montada), só nele. A que custa o golpe da vez: nas rodadas de preparo, ou
 * com o ferido abaixo de `VIDA_CRITICA`, e só se devolve vida que pague o
 * golpe (`curaValeOGolpe`).
 */
function curas(vez: VezDoRobo): PedidoDeAcao[] {
  const { personagem, sistema, carta } = vez
  const feridos = vez.aliados.filter((aliado) => aliado.proporcao < VIDA_QUE_PEDE_CURA)
  if (feridos.length === 0) return []
  const preparo = rodadaDePreparo(vez.turnos.rodada)
  const lista: PedidoDeAcao[] = []
  for (const tecnica of tecnicasDeApoio(vez)) {
    if (!utilizavel(tecnica, personagem, sistema) || papelDaTecnica(tecnica) !== 'cura') continue
    const quanto = quantoCura(tecnica, vez)
    // A cura que a conta diz que não devolve nada não vale nem a ação livre.
    if (quanto !== null && quanto <= 0) continue
    const soEmMim = pecasDoCartao(tecnica.cartao)?.alvo.quem === 'si'
    const pesa = custaOGolpe(tecnica.acao)
    const semPerderOGolpe = preparo || !pesa
    const alvos = feridos.filter(
      (ferido) => (!soEmMim || ferido.vaga.tokenId === carta.tokenId) && (semPerderOGolpe || ferido.proporcao < VIDA_CRITICA) && (!pesa || curaValeOGolpe(quanto, ferido)),
    )
    for (const alvo of alvos.slice(0, ALVOS_DA_CURA_MAX)) lista.push(pedidoDaTecnica(tecnica, sistema, null, [{ tokenId: alvo.vaga.tokenId, dano: null }], false))
  }
  return lista
}

/**
 * As formas que ele ativa: desligada, sem motivo que a apague (ação, usos,
 * custo, ordem das partes), que não troca outra forma ligada e que não espera
 * o mestre decidir os números. A que custa o golpe, só na rodada de preparo.
 */
function formas(vez: VezDoRobo): PedidoDeAcao[] {
  const preparo = rodadaDePreparo(vez.turnos.rodada)
  const lista: PedidoDeAcao[] = []
  for (const forma of formasNoMenu(vez.personagem, vez.sistema, vez.acoes, vez.combate)) {
    if (forma.ligada || forma.motivo !== null || forma.troca.length > 0 || formaDecididaPeloMestre(forma.cartao)) continue
    if (custaOGolpe(forma.acaoDaFicha) && !preparo) continue
    lista.push({ tipo: 'transformar', cartaoId: forma.cartao.id, acao: forma.acaoDaFicha, trocarImagem: false })
  }
  return lista
}

/** O nome do selo que a técnica deixa em quem acerta (o da mira, ou o das peças); `null` = nenhum que o robô consiga conferir. */
function seloQueFica(cartao: TecnicaNoMenu['cartao'], sistema: SistemaDeRpg): string | null {
  const daMira = seloDaMira(cartao, sistema)
  if (daMira !== null) return daMira.nome
  const pecas = pecasDoCartao(cartao)
  return pecas === null ? null : (seloDasPecas(pecas)?.nome ?? null)
}

/** A ficha já tem o selo desta técnica (pelo cartão que o pôs, ou pelo nome). */
function temOSelo(turnos: TurnosDaCena, tokenId: string, cartaoId: string, nome: string | null): boolean {
  return selosDoToken(turnos.selos, tokenId).some((selo) => selo.cartaoId === cartaoId || (nome !== null && selo.nome === nome))
}

/**
 * As ajudas: o Buff (nele; a montada "nos aliados", nele e depois nos colegas)
 * e o Debuff sem dano (nos inimigos, do mais ferido ao menos), na primeira
 * ficha que ainda não tem o selo da técnica. Sem selo para conferir, o robô
 * não sabe se a ajuda já vale: só abre a luta com ela (rodada 1, antes de
 * tudo, e nunca a de uso livre). A que custa o golpe, só na rodada de preparo.
 */
function ajudas(vez: VezDoRobo): PedidoDeAcao[] {
  const { personagem, sistema, turnos, eu } = vez
  const preparo = rodadaDePreparo(turnos.rodada)
  const abrindo = turnos.rodada === 1 && vez.golpesNaVez === 0
  const meus = eu === undefined ? [] : [eu]
  const colegas = vez.aliados.filter((aliado) => aliado !== eu)
  const lista: PedidoDeAcao[] = []
  for (const tecnica of tecnicasDeApoio(vez)) {
    if (!utilizavel(tecnica, personagem, sistema)) continue
    const papel = papelDaTecnica(tecnica)
    if (papel !== 'ajuda' && papel !== 'debuff') continue
    if (custaOGolpe(tecnica.acao) && !preparo) continue
    const nomeDoSelo = seloQueFica(tecnica.cartao, sistema)
    if (nomeDoSelo === null && (!abrindo || tecnica.tempo.tipo === 'livre')) continue
    const nosAliados = pecasDoCartao(tecnica.cartao)?.alvo.quem === 'aliados'
    const candidatos = papel === 'debuff' ? vez.inimigos : nosAliados ? [...meus, ...colegas] : meus
    const alvo = candidatos.find((lutador) => !temOSelo(turnos, lutador.vaga.tokenId, tecnica.cartao.id, nomeDoSelo))
    if (alvo !== undefined) lista.push(pedidoDaTecnica(tecnica, sistema, null, [{ tokenId: alvo.vaga.tokenId, dano: null }], false))
  }
  return lista
}

/** O maior dano entre as técnicas de golpe que só a recarga segura agora (0 = nenhuma). */
function maiorEmRecarga(vez: VezDoRobo): number {
  const recargas = vez.combate?.recargas
  if (recargas === undefined) return 0
  let maior = 0
  for (const { tecnicas } of vez.menus) {
    for (const tecnica of tecnicas) {
      if ((recargas[tecnica.cartao.id] ?? 0) <= 0 || !legivel(tecnica) || tecnica.dano.tipo !== 'valor' || papelDaTecnica(tecnica) !== 'golpe') continue
      maior = Math.max(maior, danoNoTeto(tecnica.dano.valor))
    }
  }
  return maior
}

/**
 * O que a carta da vez tenta, em ordem (ver "A ORDEM DA VEZ" no topo): cura,
 * forma, ajuda, concentrar, golpes, concentrar. Lista vazia = passar a vez.
 */
export function golpesDoRobo(vista: VistaDoRobo, carta: CartaDaOrdem): PedidoDeAcao[] {
  const { sistema, turnos } = vista
  if (sistema === null || carta.personagemId === null || carta.bando !== undefined || vista.golpesNaVez >= GOLPES_POR_VEZ_MAX) return []
  const minhaVaga = vista.vagas.find((vaga) => vaga.tokenId === carta.tokenId)
  const personagem = vista.personagens.find((candidato) => candidato.id === carta.personagemId)
  if (minhaVaga === undefined || personagem === undefined || !dePe(personagem, sistema)) return []
  const naLuta = doMaisFerido(lutadoresDePe(vista))
  const inimigos = naLuta.filter((lutador) => lutador.vaga.lado !== minhaVaga.lado)
  // O alvo e o golpe que o app sugere para o NPC (a escolha do painel do mestre), sobre as equipes da luta.
  const sugestao = sugestaoParaNpc(
    personagem,
    { turnos, registro: [], regras: vista.regras },
    { personagens: vista.personagens, sistema, equipes: equipesDasVagas(vista.vagas), caidos: tokensCaidos(turnos.cartas, vista.personagens, sistema) },
  )
  const alvo = inimigos.find((lutador) => lutador.vaga.tokenId === sugestao.alvoTokenId) ?? inimigos[0]
  if (alvo === undefined) return []
  const combate = turnos.combate?.[personagem.id]
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: vista.regras })
  const bonus = bonusDaBatalha(turnos.selos, carta.tokenId)
  const armas = armasUtilizaveis(personagem, combate)
  const opcoes: readonly (ArmaDaFicha | null)[] = armas.length > 0 ? armas : [null]
  const vez: VezDoRobo = {
    turnos,
    sistema,
    carta,
    personagem,
    combate,
    acoes,
    bonus,
    menus: opcoes.map((arma) => ({ arma, tecnicas: tecnicasNoMenu(personagem, sistema, combate, acoes, arma, bonus) })),
    eu: naLuta.find((lutador) => lutador.vaga.tokenId === carta.tokenId),
    aliados: naLuta.filter((lutador) => lutador.vaga.lado === minhaVaga.lado),
    inimigos,
    golpesNaVez: vista.golpesNaVez,
  }
  const golpes = golpesNoAlvo(vez, alvo, sugestao)
  // O último golpe da vez fica para a cura e o golpe: o preparo de ação livre não toma o lugar do ataque.
  const ultimo = vista.golpesNaVez >= GOLPES_POR_VEZ_MAX - 1
  const preparo = ultimo ? [] : [...formas(vez), ...ajudas(vez)]
  const podeConcentrar = motivoDoConcentrar(combate, acoes, chaveDaVez(turnos.rodada, carta.id)) === null
  const deGraca = podeConcentrar && acaoDoConcentrar(acoes, combate?.carga ?? 0) === 'livre'
  const emRecarga = podeConcentrar && !deGraca ? maiorEmRecarga(vez) : 0
  const antesDoGolpe = deGraca || (emRecarga > 0 && emRecarga >= VANTAGEM_PARA_ESPERAR * (golpes[0]?.dano ?? 0))
  return [
    ...curas(vez),
    ...preparo,
    ...(antesDoGolpe ? [CONCENTRAR] : []),
    ...golpes.map((golpe) => golpe.pedido),
    ...(podeConcentrar && !antesDoGolpe ? [CONCENTRAR] : []),
  ]
}

/**
 * Como o robô responde ao lembrete da marca (o Olhar Artístico do Vincent),
 * na ordem de tentar: o TESTE primeiro (o d20 do motor, como a reação do
 * boneco rola o dela: com semente, a mesma luta), o SP só quando a passiva não
 * tem teste com CD (o SP é o que paga os golpes dele) e, se nenhum valer
 * (SP curto, alvo já marcado), "Agora não", que sempre tira o lembrete.
 */
const RESPOSTAS_DA_MARCA: readonly ComoMarca[] = ['teste', 'sp', 'agoraNao']

/**
 * O primeiro lembrete da marca (na ordem) de uma ficha que o robô joga
 * (`doRobo`): a ficha que atirou e os pedidos, na ordem de tentar; `null` =
 * nenhum. Quem executa tenta um por um: a store recusa o que não vale (sem
 * CD, SP insuficiente).
 */
export function marcaDoRobo(turnos: Pick<TurnosDaCena, 'lembretesDaMarca'>, doRobo: (tokenId: string) => boolean): { tokenId: string; pedidos: PedidoDeMarca[] } | null {
  const lembrete = (turnos.lembretesDaMarca ?? []).find((candidato) => doRobo(candidato.tokenId))
  if (lembrete === undefined) return null
  return { tokenId: lembrete.tokenId, pedidos: RESPOSTAS_DA_MARCA.map((como): PedidoDeMarca => ({ tipo: 'marcar', lembreteId: lembrete.id, como })) }
}

/** O atributo de maior valor da cópia (empate: a ordem do sistema): o que a Preparação para a Batalha reforça. */
function atributoMaisAlto(copia: Personagem, sistema: SistemaDeRpg): string | null {
  let melhor: { id: string; valor: number } | null = null
  for (const atributo of sistema.atributos) {
    const valor = valorDoRank(copia, atributo.id)
    if (melhor === null || valor > melhor.valor) melhor = { id: atributo.id, valor }
  }
  return melhor?.id ?? null
}

/** As passivas da ficha como a tira Passivas as mostra agora (o estado, o motivo, o lembrete). */
function passivasDoLutador(turnos: TurnosDaCena, sistema: SistemaDeRpg, lutador: Lutador): PassivaNaTira[] {
  const { vaga, copia } = lutador
  return passivasDe(copia, sistema, { rodada: turnos.rodada, ativas: passivasLigadas(turnos.selos, copia.id), combate: turnos.combate?.[copia.id], selosNoDono: selosDoToken(turnos.selos, vaga.tokenId).length })
}

/** Ativar a passiva: no dono, ou no inimigo mais ferido quando o selo dela é para o oponente; `null` = sem inimigo de pé. */
function ativarPassiva(passiva: PassivaNaTira, tokenId: string, inimigo: Lutador | undefined): PedidoDePassiva | null {
  if (passiva.alvo !== 'oponente') return { tipo: 'passiva', tokenId, cartaoId: passiva.cartao.id, ligar: true, custo: null }
  return inimigo === undefined ? null : { tipo: 'passiva', tokenId, cartaoId: passiva.cartao.id, ligar: true, alvoTokenId: inimigo.vaga.tokenId, custo: null }
}

/**
 * As respostas a um lembrete, na ordem de tentar; a última ("Agora não" /
 * pular) sempre tira o lembrete. A Preparação para a Batalha: +20 no atributo
 * mais alto. O "a cada turno" (o efeito da passiva, o custo da forma e da
 * técnica mantida, o selo que tira por vez): Aplicar. O "ativar" de uma
 * passiva: Ativar.
 */
function respostasDoLembrete(lembrete: LembreteDaPassiva, lutador: Lutador, turnos: TurnosDaCena, sistema: SistemaDeRpg, inimigo: Lutador | undefined): PedidoDePassiva[] {
  const { tokenId } = lutador.vaga
  const { cartaoId } = lembrete
  const pular: PedidoDePassiva = { tipo: 'lembrete', tokenId, cartaoId, aplicar: false }
  if (ehLembreteDaPreparacao(lembrete)) {
    const atributoId = atributoMaisAlto(lutador.copia, sistema)
    return atributoId === null ? [pular] : [{ tipo: 'lembrete', tokenId, cartaoId, aplicar: true, atributoId }, pular]
  }
  if (lembrete.tipo === 'porTurno') return [{ tipo: 'lembrete', tokenId, cartaoId, aplicar: true }, pular]
  const passiva = passivasDoLutador(turnos, sistema, lutador).find((candidata) => candidata.cartao.id === cartaoId)
  const ativar = passiva === undefined ? null : ativarPassiva(passiva, tokenId, inimigo)
  return ativar === null ? [pular] : [ativar, pular]
}

/**
 * AS PASSIVAS DO ROBÔ (fora da vez, sem gastar ação): os pedidos na ordem de
 * tentar (o primeiro que a batalha aceitar vale); lista vazia = nada a fazer.
 *  - Primeiro, o lembrete esperando resposta de uma ficha de pé que ele joga
 *    (`doRobo`, na ordem das vagas): `respostasDoLembrete`, que sempre termina
 *    no "Agora não" (o lembrete nunca fica preso);
 *  - sem lembrete, as passivas da ficha DA VEZ (se é dele) cujo gatilho já
 *    bateu ("pronta": o início, a rodada, a vida abaixo de tanto) e que ele
 *    pode pagar: Ativar, como o jogador que abre a tira Passivas na vez dele.
 * A passiva nunca ativa sozinha na regra: quem executa o robô chama isto antes
 * da vez. A "sempre" (vale sempre) e a de requisito que o app não confere
 * ficam como estão.
 */
export function passivasDoRobo(vista: VistaDasPassivas, doRobo: (tokenId: string) => boolean): PedidoDePassiva[] {
  const { turnos, sistema } = vista
  if (sistema === null) return []
  const naLuta = lutadoresDePe(vista)
  const inimigoDe = (lutador: Lutador): Lutador | undefined => doMaisFerido(naLuta.filter((outro) => outro.vaga.lado !== lutador.vaga.lado))[0]
  for (const lutador of naLuta) {
    if (!doRobo(lutador.vaga.tokenId)) continue
    const lembrete = turnos.combate?.[lutador.copia.id]?.lembretes?.[0]
    if (lembrete !== undefined) return respostasDoLembrete(lembrete, lutador, turnos, sistema, inimigoDe(lutador))
  }
  const carta = cartaDaVez(turnos)
  const daVez = carta === null ? undefined : naLuta.find((lutador) => lutador.vaga.tokenId === carta.tokenId)
  if (daVez === undefined || !doRobo(daVez.vaga.tokenId)) return []
  const inimigo = inimigoDe(daVez)
  const pedidos: PedidoDePassiva[] = []
  for (const passiva of passivasDoLutador(turnos, sistema, daVez)) {
    if (passiva.estado !== 'pronta' || passiva.motivo !== null || passiva.custo.tipo === 'pergunta') continue
    const ativar = ativarPassiva(passiva, daVez.vaga.tokenId, inimigo)
    if (ativar !== null) pedidos.push(ativar)
  }
  return pedidos
}

/** A próxima jogada do robô: a reação esperando, ou a vez; `null` = sem vez (a luta não começou ou a vez sumiu). */
export function jogadaDoRobo(vista: VistaDoRobo): JogadaDoRobo | null {
  const pedido = reacaoPendente(vista)
  if (pedido !== null) return { tipo: 'reagir', pedido }
  const carta = cartaDaVez(vista.turnos)
  if (carta === null) return null
  return { tipo: 'vez', tokenId: carta.tokenId, esperado: { cartaId: carta.id, rodada: vista.turnos.rodada }, golpes: golpesDoRobo(vista, carta) }
}
