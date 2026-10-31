import { valorDoRank } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import { rankDoValor, type SistemaDeRpg } from '../sistemaDeRpg'
import { CARGA_MAX, type AcaoDaTecnica, type BonusDaBatalha, type CombateDoPersonagem } from './combate'
import { motivoDaEvolucao, overloadNaBatalha } from './escolhaEEvolucao'
import { CAMPO_DO_DANO, lerDano, type LeituraDoDano } from './formula'
import {
  CAMPO_DA_ACAO,
  CAMPO_DO_CUSTO,
  CAMPO_DO_TEMPO,
  ehPerfurante,
  lerAcao,
  perfuracaoDe,
  lerCusto,
  lerTempo,
  recursoDoCusto,
  tecnicasComForma,
  tecnicasDe,
  type LeituraDoCusto,
  type LeituraDoTempo,
} from './leituraDaFicha'
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
}

const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

/** As ações da vez da carta, com o que já gastou e as extras do mestre. */
export function acoesDaVez(gasto: GastoDaVez | undefined, extras: AcoesExtras | undefined, rankDeAgilidade: number | null, blocosPorRank: number): AcoesDaVez {
  const gastas = gasto ?? GASTO_ZERO
  const movimento: Contagem = { usadas: gastas.movimento, total: 1 + (extras?.mov ?? 0) }
  const sobram = Math.max(0, movimento.total - movimento.usadas)
  return {
    simples: { usadas: gastas.simples, total: 1 + (extras?.simples ?? 0) },
    movimento,
    bonus: { usadas: gastas.bonus, total: extras?.bonus ?? 0 },
    blocos: { andados: gastas.blocos, limite: rankDeAgilidade === null ? null : rankDeAgilidade * blocosPorRank * sobram },
  }
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
 * A ação que o golpe gasta de fato: com carga 3 a técnica vira Completa
 * (livro, "Atenção 3"); a Livre continua livre. `null` = a ficha não diz (a
 * tela pergunta).
 */
export function acaoDoGolpe(acao: AcaoDaTecnica | null, carga: number): AcaoDaTecnica | null {
  if (acao === null || acao === 'livre') return acao
  return carga >= CARGA_MAX ? 'completa' : acao
}

/** O motivo da técnica de Tipo Reação no menu da vez: ela só se usa na caixa REAÇÃO. */
export const MOTIVO_DA_REACAO_PURA = 'Reação: use na caixa REAÇÃO'

/**
 * Por que a técnica está apagada, ou `null` (pode). `acoes` null = fora da
 * vez (contra-ataque, Q6): a ação da vez não conta. Na ordem do menu:
 * passiva, reação pura, transformação (F3), evolução (tipos de habilidade
 * F4: "Evolução: evolua X primeiro", "Evoluiu: use Y"), Overload, recarga,
 * usos, ação, custo. `comoReacao` (tipos de habilidade F1) = usada NA CAIXA
 * REAÇÃO: o tipo Reação e a ação não contam (passe `acoes` null); passiva
 * continua fora. O `overload` de quem chama já conta o uso evoluído
 * (`overloadNaBatalha`).
 */
export function motivoDaTecnica(
  tecnica: Pick<TecnicaNoMenu, 'cartao' | 'custo' | 'acao' | 'tempo' | 'overload'> & { transformacao: boolean },
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: CombateDoPersonagem | undefined,
  acoes: AcoesDaVez | null,
  comoReacao?: boolean,
): string | null {
  const { cartao } = tecnica
  const tipo = lerTipo(cartao).tipo
  if (tecnica.acao === 'passiva' || tipo === 'passiva') return 'Passiva: vale sempre'
  if (tipo === 'reacao' && comoReacao !== true) return MOTIVO_DA_REACAO_PURA
  if (tecnica.transformacao) return 'É transformação: use a tira Transformação'
  const evolucao = motivoDaEvolucao(cartao, tecnicasDe(personagem, sistema), combate?.evoluidas)
  if (evolucao !== null) return evolucao
  if (tecnica.overload && combate?.overload === true) return 'Overload: já usado nesta batalha'
  const recarga = combate?.recargas[cartao.id] ?? 0
  if (recarga > 0) return `Recarga: ${turnos(recarga)}`
  if (tecnica.tempo.tipo === 'usos') {
    const usadas = combate?.usos[cartao.id] ?? 0
    if (usadas >= tecnica.tempo.vezes) return `Já usada nesta batalha (${usadas}/${tecnica.tempo.vezes})`
  }
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
    const leituraDaAcao = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
    const base = {
      cartao,
      custo: lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem),
      acao: leituraDaAcao.acao,
      tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''),
      // Tipos de habilidade F4: a base evoluída sem "Evolui para" cujo texto diz OVERLOAD conta como Overload.
      overload: overloadNaBatalha(cartao, todas, combate?.evoluidas),
      transformacao: leituraDaAcao.transformacao,
    }
    const tecnica: TecnicaNoMenu = {
      cartao,
      custo: base.custo,
      acao: base.acao,
      tempo: base.tempo,
      dano: lerDano(cartao.campos[CAMPO_DO_DANO] ?? '', { personagem, sistema, arma, vidaDoAlvo: null, bonusDaBatalha: bonus }),
      overload: base.overload,
      perfurante: ehPerfurante(cartao),
      tipo: lerTipo(cartao),
      motivo: motivoDaTecnica(base, personagem, sistema, combate, acoes),
    }
    if (forma !== undefined) tecnica.forma = forma
    const perfuracao = perfuracaoDe(cartao)
    if (perfuracao !== null) tecnica.perfuracao = perfuracao
    return tecnica
  })
}

/**
 * Por que o Concentrar está apagado, ou `null` (pode). Gasta a Simples (ou a
 * Bônus, se só sobrou ela), uma vez por vez, carga até 3. `chaveDaVez` =
 * `chaveDaVez(rodada, cartaId)`.
 */
export function motivoDoConcentrar(combate: CombateDoPersonagem | undefined, acoes: AcoesDaVez, chaveDaVez: string): string | null {
  if (combate?.concentrouEm === chaveDaVez) return 'Já concentrou nesta vez'
  if ((combate?.carga ?? 0) >= CARGA_MAX) return 'Carga no máximo'
  if (!sobra(acoes.simples) && !sobra(acoes.bonus)) return 'A ação simples deste turno já foi usada'
  return null
}

/** O que o Concentrar gasta: a Simples, ou a Bônus se só sobrou ela (livro). */
export function acaoDoConcentrar(acoes: AcoesDaVez): 'simples' | 'bonus' {
  return sobra(acoes.simples) ? 'simples' : 'bonus'
}
