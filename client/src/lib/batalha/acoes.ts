import { maximoComposto, temMaximo, valorDoRank } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import { rankDoValor, type SistemaDeRpg } from '../sistemaDeRpg'
import { CARGA_MAX, type AcaoDaTecnica, type BonusDaBatalha, type CombateDoPersonagem } from './combate'
import { motivoDaEvolucao } from './escolhaEEvolucao'
import type { LeituraDoDano } from './formula'
import {
  ehPerfurante,
  perfuracaoDe,
  recursoDoCusto,
  tecnicasComForma,
  tecnicasDe,
  vezesDeRecarga,
  type LeituraDoCusto,
  type LeituraDoTempo,
} from './leituraDaFicha'
import { danoDaTecnica, leituraDaTecnica } from './leituraDaTecnica'
import { lerTipo, type LeituraDoTipo } from './tiposDaHabilidade'
import type { AcoesExtras, GastoDaVez } from './turnos'

/**
 * ECONOMIA DA VEZ, F2 (seção 3.3 de docs/planos/batalha-one-piece-f2-plano.md;
 * decisões 6 e 8): quantas ações a carta tem e já gastou, o limite de blocos
 * do "Mov 2/4" e o motivo de cada técnica apagada no menu.
 *
 * Simples = 1 + extras; Movimento = 1 + extras; Bônus = só as extras (decisão
 * 8). Completa gasta 1 Simples + 1 Movimento. Limite de blocos = rank da
 * Agilidade × blocos por rank × Movimentos que sobraram (conta, não trava).
 *
 * Puro: sem store, sem rede.
 */

export interface Contagem {
  usadas: number
  total: number
}

export interface AcoesDaVez {
  simples: Contagem
  movimento: Contagem
  bonus: Contagem
  /** `limite` null = sistema sem rank de Agilidade ("Mov 3", sem teto). */
  blocos: { andados: number; limite: number | null }
  /**
   * R6 (lote de 01/11): o ataque adicional da forma ligada (Ignição: "ao usar
   * a ação Atacar pode realizar um ataque adicional, apenas uma vez por
   * rodada"). `usadas`/`total` = nesta rodada; `liberado` = já usou Atacar
   * nesta vez. Ausente = nenhuma forma ligada dá.
   */
  ataqueExtra?: { usadas: number; total: number; liberado: boolean }
}

const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

/**
 * R6 (lote de 01/11): o que as formas ligadas mudam na vez. `aMais` = casas
 * somadas em cada ação de Movimento (Ignição: +2); `max` = o teto do
 * deslocamento da VEZ inteira, somadas todas as ações de Movimento
 * (Resiliente: 6); `ataquesExtras` = o ataque adicional ao usar Atacar
 * (Ignição: 1 por rodada), com os já feitos nesta rodada. Quem lê da ficha é
 * `formaNaVez` (transformacao.ts).
 */
export interface MovimentoDaForma {
  aMais: number | null
  max: number | null
  /** Ausente = a forma não dá ataque adicional. */
  ataquesExtras?: { total: number; usados: number }
}

/** As casas da vez: (rank × blocos por rank + o da forma) por Movimento que sobrou, no teto da forma para a vez. */
function limiteDosBlocos(rankDeAgilidade: number, blocosPorRank: number, sobram: number, forma: MovimentoDaForma | undefined): number {
  const total = (rankDeAgilidade * blocosPorRank + (forma?.aMais ?? 0)) * sobram
  return forma?.max === null || forma?.max === undefined ? total : Math.min(total, forma.max)
}

/** As ações da vez da carta, com o que já gastou e as extras do mestre. */
export function acoesDaVez(gasto: GastoDaVez | undefined, extras: AcoesExtras | undefined, rankDeAgilidade: number | null, blocosPorRank: number, forma?: MovimentoDaForma): AcoesDaVez {
  const gastas = gasto ?? GASTO_ZERO
  const movimento: Contagem = { usadas: gastas.movimento, total: 1 + (extras?.mov ?? 0) }
  const sobram = Math.max(0, movimento.total - movimento.usadas)
  const acoes: AcoesDaVez = {
    simples: { usadas: gastas.simples, total: 1 + (extras?.simples ?? 0) },
    movimento,
    bonus: { usadas: gastas.bonus, total: extras?.bonus ?? 0 },
    blocos: { andados: gastas.blocos, limite: rankDeAgilidade === null ? null : limiteDosBlocos(rankDeAgilidade, blocosPorRank, sobram, forma) },
  }
  const ataquesExtras = forma?.ataquesExtras
  if (ataquesExtras !== undefined && ataquesExtras.total > 0) acoes.ataqueExtra = { usadas: ataquesExtras.usados, total: ataquesExtras.total, liberado: gastas.atacou === true }
  return acoes
}

/**
 * R6: o Atacar de agora é o ataque adicional da forma (Ignição): já usou a
 * ação Atacar nesta vez e ainda não fez o adicional desta rodada. Não gasta a
 * Simples.
 */
export function usaOAtaqueExtra(acoes: AcoesDaVez): boolean {
  const extra = acoes.ataqueExtra
  return extra !== undefined && extra.liberado && extra.usadas < extra.total
}

/** Por que o Atacar não cabe na vez, ou `null`: com o ataque adicional livre, cabe; senão, a regra da Simples. */
export function motivoDoAtacar(acoes: AcoesDaVez): string | null {
  return usaOAtaqueExtra(acoes) ? null : motivoDaAcao(acoes, 'simples')
}

/** O rank da Agilidade pela tabela do sistema; `null` = sistema sem o atributo ou sem tabela. */
export function rankDeAgilidade(personagem: Personagem, sistema: SistemaDeRpg): number | null {
  const atributo =
    sistema.atributos.find((candidato) => candidato.id === 'agilidade') ??
    sistema.atributos.find((candidato) => candidato.nome.trim().toLocaleLowerCase('pt-BR') === 'agilidade')
  if (atributo === undefined) return null
  return rankDoValor(atributo.rank, valorDoRank(personagem, atributo.id))
}

function sobra(contagem: Contagem): boolean {
  return contagem.usadas < contagem.total
}

/** A ação cabe no que sobrou da vez? */
export function cabeAcao(acoes: AcoesDaVez, acao: AcaoDaTecnica): boolean {
  switch (acao) {
    case 'simples':
      return sobra(acoes.simples)
    case 'completa':
      return sobra(acoes.simples) && sobra(acoes.movimento)
    case 'bonus':
      return sobra(acoes.bonus)
    case 'livre':
      return true
  }
}

/** O gasto com a ação somada. "livre": o MESMO gasto. */
export function gastarAcao(gasto: GastoDaVez, acao: AcaoDaTecnica): GastoDaVez {
  switch (acao) {
    case 'simples':
      return { ...gasto, simples: gasto.simples + 1 }
    case 'completa':
      return { ...gasto, simples: gasto.simples + 1, movimento: gasto.movimento + 1 }
    case 'bonus':
      return { ...gasto, bonus: gasto.bonus + 1 }
    case 'livre':
      return gasto
  }
}

/** Uma técnica como o menu a mostra; `motivo` presente = apagada, com a frase. */
export interface TecnicaNoMenu {
  cartao: CartaoDaFicha
  /** A transformação ligada de onde a técnica vem. */
  forma?: string
  custo: LeituraDoCusto
  acao: AcaoDaTecnica | 'passiva' | null
  tempo: LeituraDoTempo
  dano: LeituraDoDano
  overload: boolean
  /** Q4: o valor inicial do interruptor Perfurante. */
  perfurante: boolean
  /** A porcentagem que a habilidade diz que perfura ("perfura 50%"); ausente = não diz (100%). */
  perfuracao?: number
  /** Tipos de habilidade F1: o tipo (campo Tipo, ou deduzido da Ação) e se aparece também na caixa REAÇÃO. */
  tipo: LeituraDoTipo
  motivo: string | null
}

/** "1 turno", "2 turnos". */
function turnos(n: number): string {
  return n === 1 ? '1 turno' : `${n} turnos`
}

/** Por que a ação não cabe na vez, ou `null`. */
export function motivoDaAcao(acoes: AcoesDaVez, acao: AcaoDaTecnica): string | null {
  if (cabeAcao(acoes, acao)) return null
  switch (acao) {
    case 'simples':
      return 'A ação simples deste turno já foi usada'
    case 'completa':
      return 'Completa precisa da Simples e do Movimento'
    case 'bonus':
      return acoes.bonus.total === 0 ? 'Ação bônus: só quando o mestre dá' : 'A ação bônus deste turno já foi usada'
    case 'livre':
      return null
  }
}

/**
 * A ação que o golpe gasta de fato: a da ficha. C1 (lote de 01/11): com a 3ª
 * carga ele ainda move e ataca normalmente, então a carga não troca mais a
 * ação pela Completa. `null` = a ficha não diz (a tela pergunta). O
 * `_carga` fica só para as telas que ainda o passam.
 */
export function acaoDoGolpe(acao: AcaoDaTecnica | null, _carga?: number): AcaoDaTecnica | null {
  return acao
}

/**
 * Conserto das fichas F1 (resposta da May): a técnica OVERLOAD que não é
 * transformação gasta a ação Completa, seja qual for a ação escrita na ficha.
 */
export function acaoComOverload(acao: AcaoDaTecnica | 'passiva' | null, overload: boolean, transformacao: boolean): AcaoDaTecnica | 'passiva' | null {
  return overload && !transformacao && acao !== 'passiva' ? 'completa' : acao
}

/** O motivo da técnica de Tipo Reação no menu da vez: ela só se usa na caixa REAÇÃO. */
export const MOTIVO_DA_REACAO_PURA = 'Reação: use na caixa REAÇÃO'

/** Invocação: a técnica de Tipo Invocação não lança golpe; ela pede um invocado (`batalha.invocar`). */
export const MOTIVO_DA_INVOCACAO = 'Invocação: use Invocar'

/**
 * Por que a técnica está apagada, ou `null` (pode). `acoes` null = fora da
 * vez (contra-ataque, Q6): a ação da vez não conta. Na ordem do menu:
 * passiva, reação pura, transformação (F3), evolução (tipos de habilidade
 * F4: "Evolução: evolua X primeiro", "Evoluiu: use Y"), Overload, recarga,
 * usos, ação, custo. `comoReacao` (tipos de habilidade F1) = usada NA CAIXA
 * REAÇÃO: o tipo Reação e a ação não contam (passe `acoes` null); passiva
 * continua fora. O `overload` de quem chama já conta o uso evoluído
 * (`overloadNaBatalha`). `comoInvocacao` (invocação) = pedida pelo Invocar:
 * sem ele, a técnica de Tipo Invocação sai apagada (`MOTIVO_DA_INVOCACAO`),
 * para não ser usada como golpe comum.
 */
export function motivoDaTecnica(
  tecnica: Pick<TecnicaNoMenu, 'cartao' | 'custo' | 'acao' | 'tempo' | 'overload'> & { transformacao: boolean },
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: CombateDoPersonagem | undefined,
  acoes: AcoesDaVez | null,
  comoReacao?: boolean,
  comoInvocacao?: boolean,
): string | null {
  const { cartao } = tecnica
  const tipo = lerTipo(cartao).tipo
  if (tecnica.acao === 'passiva' || tipo === 'passiva') return 'Passiva: use a tira Passivas'
  if (tipo === 'reacao' && comoReacao !== true) return MOTIVO_DA_REACAO_PURA
  if (tipo === 'invocacao' && comoInvocacao !== true) return MOTIVO_DA_INVOCACAO
  if (tecnica.transformacao) return 'É transformação: use a tira Transformação'
  const evolucao = motivoDaEvolucao(cartao, tecnicasDe(personagem, sistema), combate?.evoluidas)
  if (evolucao !== null) return evolucao
  if (tecnica.overload && combate?.overload === true) return MOTIVO_DO_OVERLOAD_USADO
  const recarga = combate?.recargas[cartao.id] ?? 0
  if (recarga > 0) return `Recarga: ${turnos(vezesDeRecarga(recarga, tecnica.tempo))}`
  if (tecnica.tempo.tipo === 'usos') {
    const usadas = combate?.usos[cartao.id] ?? 0
    if (usadas >= tecnica.tempo.vezes) return `Já usada nesta batalha (${usadas}/${tecnica.tempo.vezes})`
  }
  // Conserto das fichas F1 (resposta do Jimboy): custo acima do MÁXIMO do recurso = bloqueada com o motivo, antes da ação.
  const caro = motivoDoCustoAcimaDoMaximo(tecnica.custo, personagem, sistema)
  if (caro !== null) return caro
  if (acoes !== null) {
    const acao = acaoDoGolpe(tecnica.acao, combate?.carga ?? 0)
    const motivo = acao === null ? null : motivoDaAcao(acoes, acao)
    if (motivo !== null) return motivo
  }
  if (tecnica.custo.tipo === 'valor') {
    const recurso = recursoDoCusto(sistema, tecnica.custo.recurso)
    if (recurso !== null) {
      const tem = numeroDaFicha(personagem.recursos, recurso.id)
      if (tem < tecnica.custo.valor) return `${recurso.nome} insuficiente: custa ${tecnica.custo.valor}, você tem ${tem}`
    }
  }
  return null
}

/** O motivo do Overload já usado (técnica ou forma): 1 por batalha. */
export const MOTIVO_DO_OVERLOAD_USADO = 'Overload: já usado nesta batalha'

/**
 * Conserto das fichas F1 (resposta do Jimboy, "certos jogadores têm técnica
 * que custa SP que eles ainda não podem gastar"): o custo passa do MÁXIMO do
 * recurso ("Precisa de 105 SP (o máximo é 60)"). `null` = cabe no máximo, o
 * recurso não tem máximo ou o custo não é número.
 */
export function motivoDoCustoAcimaDoMaximo(custo: LeituraDoCusto, personagem: Personagem, sistema: SistemaDeRpg): string | null {
  if (custo.tipo !== 'valor') return null
  const recurso = recursoDoCusto(sistema, custo.recurso)
  if (recurso === null || !temMaximo(sistema, recurso.id)) return null
  const maximo = maximoComposto(personagem, recurso.id).total
  return custo.valor > maximo ? `Precisa de ${custo.valor} ${recurso.nome} (o máximo é ${maximo})` : null
}

/**
 * As técnicas do menu com o motivo de cada apagada. `acoes` null = fora da
 * vez (o contra-ataque). O dano é lido sem a vida do alvo (o menu não sabe o
 * alvo ainda; a mira relê com ele). `bonus` (tipos de habilidade F2) = o
 * `bonusDaBatalha` de quem age: entra no dano com o nome do selo na conta.
 */
export function tecnicasNoMenu(
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: CombateDoPersonagem | undefined,
  acoes: AcoesDaVez | null,
  arma: CartaoDaFicha | null,
  bonus?: BonusDaBatalha,
): TecnicaNoMenu[] {
  const tecnicas = tecnicasComForma(personagem, sistema)
  const todas = tecnicas.map((tecnica) => tecnica.cartao)
  return tecnicas.map(({ cartao, forma }) => {
    // F2 (fatia A): a leitura única. Tipos de habilidade F4: a base evoluída sem "Evolui para" cujo texto diz OVERLOAD conta como Overload.
    const lida = leituraDaTecnica(cartao, { personagem, sistema, evoluidas: combate?.evoluidas, todas })
    const base = {
      cartao,
      custo: lida.custo,
      acao: acaoComOverload(lida.acaoDaFicha.acao, lida.overload, lida.transformacao),
      tempo: lida.tempo,
      overload: lida.overload,
      transformacao: lida.transformacao,
    }
    const tecnica: TecnicaNoMenu = {
      cartao,
      custo: base.custo,
      acao: base.acao,
      tempo: base.tempo,
      dano: danoDaTecnica(cartao, { personagem, sistema, arma, bonusDaBatalha: bonus }),
      overload: base.overload,
      perfurante: ehPerfurante(cartao),
      tipo: lida.tipo,
      motivo: motivoDaTecnica(base, personagem, sistema, combate, acoes),
    }
    if (forma !== undefined) tecnica.forma = forma
    const perfuracao = perfuracaoDe(cartao)
    if (perfuracao !== null) tecnica.perfuracao = perfuracao
    return tecnica
  })
}

/** O Concentrar já usado nesta vez; com ele, zerar desfaz o Concentrar da vez (C2: a ação volta). */
export const MOTIVO_JA_CONCENTROU = 'Já concentrou nesta vez'

/** C1 (lote de 01/11): a concentração que leva a carga a 3 não gasta ação. */
function concentrarEhLivre(carga: number): boolean {
  return carga === CARGA_MAX - 1
}

/**
 * Por que o Concentrar está apagado, ou `null` (pode). Gasta a Simples (ou a
 * Bônus, se só sobrou ela), uma vez por vez, carga até 3; a 3ª é livre (C1).
 * `chaveDaVez` = `chaveDaVez(rodada, cartaId)`.
 */
export function motivoDoConcentrar(combate: CombateDoPersonagem | undefined, acoes: AcoesDaVez, chaveDaVez: string): string | null {
  const carga = combate?.carga ?? 0
  if (combate?.concentrouEm === chaveDaVez) return MOTIVO_JA_CONCENTROU
  if (carga >= CARGA_MAX) return 'Carga no máximo'
  if (!concentrarEhLivre(carga) && !sobra(acoes.simples) && !sobra(acoes.bonus)) return 'A ação simples deste turno já foi usada'
  return null
}

/** A ação que o Concentrar gasta. */
export type AcaoDoConcentrar = 'simples' | 'bonus' | 'livre'

/** O que o Concentrar gasta: a Simples, ou a Bônus se só sobrou ela (livro); a 3ª carga, nada (C1). */
export function acaoDoConcentrar(acoes: AcoesDaVez, carga: number): AcaoDoConcentrar {
  if (concentrarEhLivre(carga)) return 'livre'
  return sobra(acoes.simples) ? 'simples' : 'bonus'
}
