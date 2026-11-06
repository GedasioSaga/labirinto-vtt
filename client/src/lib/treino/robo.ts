import { danoSugeridoDoAtaque, acoesDaCarta } from '../batalha/golpe'
import { motivoDoAtacar, tecnicasNoMenu, type AcoesDaVez, type TecnicaNoMenu } from '../batalha/acoes'
import { DANO_MAX, type CombateDoPersonagem, type PedidoDeAcao, type PedidoDeReacao, type SeloPedido } from '../batalha/combate'
import { armasDe, type ArmaDaFicha } from '../batalha/leituraDaFicha'
import { lerMarca } from '../batalha/marca'
import type { VezEsperada } from '../batalha/ponte'
import type { RegrasDaBatalha } from '../batalha/regrasDoCampo'
import { bonusDaBatalha, bonusDaReacao, seloPedidoValido } from '../batalha/selos'
import { seloSugeridoDaTecnica } from '../batalha/tiposDaHabilidade'
import { cartaDaVez, type CartaDaOrdem, type TurnosDaCena } from '../batalha/turnos'
import { reacaoDoBoneco } from '../arena/reacaoDoBoneco'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import type { VagaDoTreino } from './mesaEmMemoria'

/**
 * O ROBÔ DO TREINO (LOBBY v2, fatia T3 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2; decisão do usuário: "robô
 * simples primeiro: golpe mais forte que pode pagar no alvo mais ferido;
 * melhor defesa"). A próxima jogada de quem está esperando na luta:
 *  - REAÇÃO primeiro: golpe esperando uma vaga = a defesa do boneco da arena
 *    (`reacaoDoBoneco` no modo "d20"): rola com o bônus de reação dos selos e
 *    escolhe a melhor saída que o dado liberou (esquiva > metade > cheio,
 *    nunca o contra-ataque);
 *  - depois a VEZ: o alvo é o inimigo de pé com a menor proporção de vida
 *    (empate: o primeiro na ordem das vagas); os golpes são todos os que ele
 *    pode pagar agora, do mais forte ao mais fraco, para quem executa tentar
 *    um por um e, se nenhum passar, passar a vez.
 *
 * O dano do golpe vai PREENCHIDO (achado Tr1 do plano, "robô sem dano =
 * empate por tempo"): na técnica, o `dano.valor` de `tecnicasNoMenu`; no
 * Atacar, `danoSugeridoDoAtaque` com a arma. Técnica de "dano à mão" é
 * pulada: a marcada À mão no cartão (`aMao`) ou a de dano que a leitura não
 * calcula (sem número, "% da vida do alvo", "Dano da arma" sem arma). Também
 * ficam de fora: a de Tipo Buff (não é golpe no inimigo), a de custo que a
 * ficha não diz ao certo (a tela perguntaria) e a de custo em HP que derruba
 * quem usa. Sem nenhuma técnica, o Atacar com a arma; sem arma utilizável,
 * ou sem nenhuma de dano que a conta lê ("1d6", o Escudo sem dano), o Atacar
 * sem arma (a Força): o robô não digita o dano, e a arma ilegível não pode
 * deixá-lo mais fraco do que sem arma.
 *
 * A técnica vai com o selo que a mira sugere (`seloSugeridoDaTecnica`): na
 * mira ele já abre marcado (MiraDoGolpe, `comSelo`), então é o padrão da
 * regra. Sem ele, a técnica de atordoar ou o Debuff com dano virava só dano.
 *
 * Empate de dano entre golpes: o Atacar vem antes (não gasta SP), depois as
 * técnicas na ordem da ficha. Teto de golpes por vez (`GOLPES_POR_VEZ_MAX`):
 * a técnica de Ação Livre sem custo nem recarga não segura a vez para sempre.
 * O robô nunca concentra, nunca se transforma, nunca põe selo por conta
 * própria ("Pôr selo...") e nunca usa passiva: é o simples primeiro.
 *
 * Nada aqui olha id aleatório para decidir (carta, golpe e linha têm
 * `crypto.randomUUID`): só a ordem das vagas, das cartas e dos golpes. Assim
 * a mesma semente dá a mesma luta, também depois de pausar em JSON.
 *
 * Puro: sem store, sem DOM.
 */

/** Golpes que uma carta dá numa vez, no máximo. Com a Simples gasta, só a técnica de Ação Livre ainda passaria. */
export const GOLPES_POR_VEZ_MAX = 3

/** O que o robô lê da luta agora. */
export interface VistaDoRobo {
  turnos: TurnosDaCena
  regras: RegrasDaBatalha | null
  vagas: readonly VagaDoTreino[]
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
  /** Quantos golpes a carta da vez já deu nesta vez (quem executa conta). */
  golpesNaVez: number
}

/**
 * A próxima jogada. "reagir": um pedido de reação de uma vaga. "vez": a carta
 * da vez e os golpes a tentar, do mais forte ao mais fraco; lista vazia (ou
 * nenhum aceito) = passar a vez com `esperado`.
 */
export type JogadaDoRobo =
  | { tipo: 'reagir'; pedido: PedidoDeReacao }
  | { tipo: 'vez'; tokenId: string; esperado: VezEsperada; golpes: readonly PedidoDeAcao[] }

/** A proporção da vida de agora (0 a 1); sem vida legível, 1: no fim da fila do alvo. */
function proporcaoDaVida(personagem: Personagem, sistema: SistemaDeRpg | null): number {
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return vida === null ? 1 : vida.atual / vida.maximo
}

/** De pé = vida acima de 0, ou sem vida legível (a mesma leitura de `fimDaLuta`). */
function dePe(personagem: Personagem, sistema: SistemaDeRpg | null): boolean {
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return vida === null || vida.atual > 0
}

/** O pedido de reação da primeira vaga (na ordem das vagas) com golpe esperando por ela; `null` = ninguém. */
function reacaoPendente(vista: VistaDoRobo): PedidoDeReacao | null {
  for (const vaga of vista.vagas) {
    const modificador = bonusDaReacao(bonusDaBatalha(vista.turnos.selos, vaga.tokenId))
    const pedido = reacaoDoBoneco(vista.turnos.golpes, vaga.tokenId, 'd20', modificador)
    if (pedido !== null) return pedido
  }
  return null
}

/** O token inimigo de pé, na ordem, com a menor proporção de vida; `null` = nenhum. */
function alvoMaisFerido(vista: VistaDoRobo, minhaVaga: VagaDoTreino): string | null {
  const porId = new Map(vista.personagens.map((personagem) => [personagem.id, personagem]))
  const naOrdem = new Set(vista.turnos.cartas.map((carta) => carta.tokenId))
  let melhor: { tokenId: string; proporcao: number } | null = null
  for (const vaga of vista.vagas) {
    if (vaga.lado === minhaVaga.lado || !naOrdem.has(vaga.tokenId)) continue
    const copia = porId.get(vaga.personagemId)
    if (copia === undefined || !dePe(copia, vista.sistema)) continue
    const proporcao = proporcaoDaVida(copia, vista.sistema)
    if (melhor === null || proporcao < melhor.proporcao) melhor = { tokenId: vaga.tokenId, proporcao }
  }
  return melhor?.tokenId ?? null
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

/** A técnica entra na lista do robô? Disponível, de custo certo, com ação, de dano calculado e não à mão. */
function tecnicaDoRobo(tecnica: TecnicaNoMenu, personagem: Personagem, sistema: SistemaDeRpg): tecnica is TecnicaNoMenu & { dano: { tipo: 'valor'; valor: number } } {
  return (
    tecnica.motivo === null &&
    tecnica.custo.tipo !== 'pergunta' &&
    tecnica.acao !== null &&
    tecnica.acao !== 'passiva' &&
    tecnica.tipo.tipo !== 'buff' &&
    tecnica.cartao.aMao !== true &&
    tecnica.dano.tipo === 'valor' &&
    !custoQueDerruba(tecnica, personagem, sistema)
  )
}

interface GolpeCandidato {
  dano: number
  pedido: PedidoDeAcao
  /** Técnica: o cartão (a mesma técnica com outra arma não repete). */
  cartaoId: string | null
}

/** O Atacar com a arma (`null` = sem arma, a Força); `null` = a conta não lê o dano dela. */
function ataqueCom(personagem: Personagem, sistema: SistemaDeRpg, arma: ArmaDaFicha | null, alvo: string): GolpeCandidato | null {
  const valor = danoSugeridoDoAtaque(personagem, sistema, arma)
  if (valor === null) return null
  const dano = danoNoTeto(valor)
  return { dano, cartaoId: null, pedido: { tipo: 'atacar', armaId: arma?.id ?? null, alvos: [{ tokenId: alvo, dano }], surpresa: false, perfurante: false } }
}

/**
 * Os Atacar possíveis: um por arma utilizável de dano legível; nenhuma (sem
 * arma, ou todas de dano que a conta não lê) = o Atacar sem arma, que o
 * `podeAgir` aceita sempre. Simples já gasta = nenhum.
 */
function ataques(personagem: Personagem, sistema: SistemaDeRpg, armas: readonly ArmaDaFicha[], acoes: AcoesDaVez, alvo: string): GolpeCandidato[] {
  if (motivoDoAtacar(acoes) !== null) return []
  const lista: GolpeCandidato[] = []
  for (const arma of armas) {
    const golpe = ataqueCom(personagem, sistema, arma, alvo)
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

/** As técnicas possíveis, com o dano lido com cada arma utilizável (a que fala de "Dano da arma" muda com ela). */
function tecnicas(personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined, armas: readonly ArmaDaFicha[], acoes: AcoesDaVez, carta: CartaDaOrdem, turnos: TurnosDaCena, alvo: string): GolpeCandidato[] {
  const bonus = bonusDaBatalha(turnos.selos, carta.tokenId)
  const opcoes: readonly (ArmaDaFicha | null)[] = armas.length > 0 ? armas : [null]
  const lista: GolpeCandidato[] = []
  for (const arma of opcoes) {
    for (const tecnica of tecnicasNoMenu(personagem, sistema, combate, acoes, arma, bonus)) {
      if (!tecnicaDoRobo(tecnica, personagem, sistema)) continue
      const dano = danoNoTeto(tecnica.dano.valor)
      const selo = seloDaMira(tecnica.cartao, sistema)
      const pedido: PedidoDeAcao = {
        tipo: 'habilidade',
        cartaoId: tecnica.cartao.id,
        armaId: arma?.id ?? null,
        alvos: [{ tokenId: alvo, dano }],
        surpresa: false,
        perfurante: tecnica.perfurante,
        // A porcentagem que a habilidade diz (como a mira: o interruptor Perfurante começa no da ficha).
        ...(tecnica.perfurante && tecnica.perfuracao !== undefined ? { perfuracao: tecnica.perfuracao } : {}),
        custo: null,
        acao: null,
        ...(selo === null ? {} : { selo }),
      }
      lista.push({ dano, cartaoId: tecnica.cartao.id, pedido })
    }
  }
  return lista
}

/**
 * Os golpes da carta da vez no alvo mais ferido, do mais forte ao mais fraco
 * (empate: o Atacar primeiro, depois as técnicas na ordem da ficha; a mesma
 * técnica com outra arma só fica a mais forte). Lista vazia = passar a vez.
 */
export function golpesDoRobo(vista: VistaDoRobo, carta: CartaDaOrdem): PedidoDeAcao[] {
  const { sistema, turnos } = vista
  if (sistema === null || carta.personagemId === null || carta.bando !== undefined || vista.golpesNaVez >= GOLPES_POR_VEZ_MAX) return []
  const minhaVaga = vista.vagas.find((vaga) => vaga.tokenId === carta.tokenId)
  const personagem = vista.personagens.find((candidato) => candidato.id === carta.personagemId)
  if (minhaVaga === undefined || personagem === undefined || !dePe(personagem, sistema)) return []
  const alvo = alvoMaisFerido(vista, minhaVaga)
  if (alvo === null) return []
  const combate = turnos.combate?.[personagem.id]
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: vista.regras })
  const armas = armasUtilizaveis(personagem, combate)
  const candidatos = [...ataques(personagem, sistema, armas, acoes, alvo), ...tecnicas(personagem, sistema, combate, armas, acoes, carta, turnos, alvo)]
  // `sort` é estável: no empate fica a ordem de cima (Atacar, depois a ficha).
  const ordenados = candidatos.sort((a, b) => b.dano - a.dano)
  const vistas = new Set<string>()
  const golpes: PedidoDeAcao[] = []
  for (const candidato of ordenados) {
    if (candidato.cartaoId !== null) {
      if (vistas.has(candidato.cartaoId)) continue
      vistas.add(candidato.cartaoId)
    }
    golpes.push(candidato.pedido)
  }
  return golpes
}

/** A próxima jogada do robô: a reação esperando, ou a vez; `null` = sem vez (a luta não começou ou a vez sumiu). */
export function jogadaDoRobo(vista: VistaDoRobo): JogadaDoRobo | null {
  const pedido = reacaoPendente(vista)
  if (pedido !== null) return { tipo: 'reagir', pedido }
  const carta = cartaDaVez(vista.turnos)
  if (carta === null) return null
  return { tipo: 'vez', tokenId: carta.tokenId, esperado: { cartaId: carta.id, rodada: vista.turnos.rodada }, golpes: golpesDoRobo(vista, carta) }
}
