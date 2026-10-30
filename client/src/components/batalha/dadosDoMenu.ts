import { acaoDoGolpe, motivoDaAcao, tecnicasNoMenu, type AcoesDaVez, type TecnicaNoMenu } from '../../lib/batalha/acoes'
import {
  CARGA_MAX,
  MULTIPLICADOR_DA_CARGA,
  MULTIPLICADOR_DA_SURPRESA,
  type AcaoDaTecnica,
  type CombateDoPersonagem,
  type EfeitoDaBatalha,
  type SaidaDaReacao,
} from '../../lib/batalha/combate'
import { danoDoAtaque, type LeituraDoDano } from '../../lib/batalha/formula'
import { CAMPO_DA_ACAO, armasDe, lerAcao, type LeituraDoCusto, type LeituraDoTempo } from '../../lib/batalha/leituraDaFicha'
import { danoFinal, danoQueChega, saidasPossiveis } from '../../lib/batalha/reacao'
import type { CombateParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'

/**
 * O ADAPTADOR DO MENU DA VEZ (F2 da batalha One Piece, seção 5.2 do plano):
 * personagem, combate e sistema viram as props que as telas de golpe e de
 * reação desenham. Puro, nos dois lados (mestre e jogador): toda regra mora em
 * `lib/batalha` (`tecnicasNoMenu`, `danoDoAtaque`, `danoQueChega`,
 * `saidasPossiveis`); aqui só se junta o texto.
 */

/** O dano como a tira e a mira o mostram. `valor` null = a ficha não dá um número (a pessoa digita). */
export interface DanoNaTela {
  valor: number | null
  /** "160 Força + 5 Balmung = 165", ou o porquê de não ter número. */
  conta: string
  /** Golpe de suporte ("-"): nenhum dano a digitar. */
  semDano: boolean
}

/** Um golpe que o menu oferece: uma arma (Atacar) ou uma técnica (Habilidades). */
export interface GolpeNaTela {
  /** Chave estável na lista: "arma:<id>", "tecnica:<id>" ou "ataque" (sem arma). */
  chave: string
  tipo: 'atacar' | 'habilidade'
  /** Só na habilidade. */
  cartaoId: string | null
  /** A arma do Atacar; na habilidade, a arma que entra na conta ("Dano da arma"). */
  armaId: string | null
  nome: string
  descricao: string
  /** A transformação ligada de onde a técnica vem. */
  forma?: string
  /** "45 SP", "? SP", "15 SP por turno"; `null` = não custa. */
  custoTexto: string | null
  custo: LeituraDoCusto
  /** A da ficha; `null` = a ficha não diz (a mira pergunta). */
  acao: AcaoDaTecnica | 'passiva' | null
  acaoTexto: string
  /** "Recarga 1", "1/2 usos", "Overload"; `null` = livre. */
  tempoTexto: string | null
  dano: DanoNaTela
  overload: boolean
  /** Q4: o valor inicial do interruptor Perfurante. */
  perfurante: boolean
  /** Presente = apagado, com a frase. */
  motivo: string | null
}

/** Uma ficha que pode ser alvo, como a mira a lista. */
export interface AlvoNaMira {
  tokenId: string
  nome: string
  /** 'eu' = do jogador que olha (ou do NPC da vez, no mestre). */
  lado: 'eu' | 'aliado' | 'outro'
  caiu: boolean
  /** Presente = não pode ser alvo (ficha sem personagem), com a frase. */
  motivo?: string | null
}

/** A ficha sem personagem não é alvo (a store recusa): fica na lista, apagada. */
export const MOTIVO_SEM_PERSONAGEM = 'sem ficha ligada'

const ROTULO_DA_ACAO: Record<AcaoDaTecnica | 'passiva', string> = {
  simples: 'Simples',
  completa: 'Completa',
  bonus: 'Bônus',
  livre: 'Livre',
  passiva: 'Passiva',
}

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export function formatarNumero(valor: number): string {
  return numero.format(valor)
}

export function textoDaAcao(acao: AcaoDaTecnica | 'passiva' | null): string {
  return acao === null ? 'Ação ?' : ROTULO_DA_ACAO[acao]
}

/** "45 SP", "? SP", "15 SP por turno"; `null` = não custa. */
export function textoDoCusto(custo: LeituraDoCusto): string | null {
  switch (custo.tipo) {
    case 'nada':
      return null
    case 'valor':
      return `${formatarNumero(custo.valor)} ${custo.recurso.toUpperCase()}${custo.porTurno ? ' por turno' : ''}`
    case 'pergunta':
      return `? ${custo.recurso.toUpperCase()}`
  }
}

/** "Recarga 1" (o que falta, se está recarregando), "1/2 usos", "Overload"; `null` = livre. */
export function textoDoTempo(tempo: LeituraDoTempo, combate: CombateDoPersonagem | undefined, cartaoId: string): string | null {
  switch (tempo.tipo) {
    case 'livre':
      return null
    case 'recarga': {
      const falta = combate?.recargas[cartaoId] ?? 0
      return falta > 0 ? `Recarga ${falta}/${tempo.turnos}` : `Recarga ${tempo.turnos}`
    }
    case 'usos':
      return `${combate?.usos[cartaoId] ?? 0}/${tempo.vezes} usos`
    case 'overload':
      return 'Overload'
    case 'texto':
      return tempo.texto.trim() || null
  }
}

/** A leitura do dano em texto de tela. */
export function danoNaTela(leitura: LeituraDoDano): DanoNaTela {
  switch (leitura.tipo) {
    case 'semDano':
      return { valor: null, conta: 'Sem dano', semDano: true }
    case 'valor':
      return { valor: leitura.valor, conta: leitura.conta, semDano: false }
    case 'precisaArma':
      return { valor: null, conta: `Precisa de uma arma: ${leitura.conta}`, semDano: false }
    case 'precisaAlvo':
      return { valor: null, conta: 'Depende da vida do alvo: digite o dano', semDano: false }
    case 'naoEntende':
      return { valor: null, conta: leitura.texto.trim() === '' ? 'A ficha não diz: digite o dano' : `"${leitura.texto.trim()}": digite o dano`, semDano: false }
  }
}

function golpeDaTecnica(tecnica: TecnicaNoMenu, combate: CombateDoPersonagem | undefined, arma: CartaoDaFicha | null): GolpeNaTela {
  const golpe: GolpeNaTela = {
    chave: `tecnica:${tecnica.cartao.id}`,
    tipo: 'habilidade',
    cartaoId: tecnica.cartao.id,
    armaId: arma?.id ?? null,
    nome: tecnica.cartao.nome.trim() || 'Habilidade sem nome',
    descricao: (tecnica.cartao.campos.descricao ?? tecnica.cartao.campos.efeito ?? '').trim(),
    custoTexto: textoDoCusto(tecnica.custo),
    custo: tecnica.custo,
    acao: tecnica.acao,
    acaoTexto: textoDaAcao(tecnica.acao),
    tempoTexto: textoDoTempo(tecnica.tempo, combate, tecnica.cartao.id),
    dano: danoNaTela(tecnica.dano),
    overload: tecnica.overload,
    perfurante: tecnica.perfurante,
    motivo: tecnica.motivo,
  }
  if (tecnica.forma !== undefined) golpe.forma = tecnica.forma
  return golpe
}

/** As técnicas (Habilidades + as das transformações ligadas), com o motivo de cada apagada. `acoes` null = fora da vez (contra-ataque). */
export function golpesDeHabilidade(
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: CombateDoPersonagem | undefined,
  acoes: AcoesDaVez | null,
  arma: CartaoDaFicha | null,
): GolpeNaTela[] {
  return tecnicasNoMenu(personagem, sistema, combate, acoes, arma).map((tecnica) => golpeDaTecnica(tecnica, combate, arma))
}

/** As armas que valem nesta batalha: as levadas (Q8) ou, sem escolha, todas da aba Armas. */
export function armasNaBatalha(personagem: Personagem | null, combate: Pick<CombateDoPersonagem, 'armas'> | undefined): CartaoDaFicha[] {
  if (personagem === null) return []
  const todas = armasDe(personagem)
  const levadas = combate?.armas
  if (levadas === null || levadas === undefined) return todas
  return todas.filter((arma) => levadas.includes(arma.id))
}

/** O Atacar: uma tira por arma levada; sem arma, o ataque desarmado (Força). Q2: Força + dano da arma, editável. */
export function golpesDeAtaque(personagem: Personagem | null, sistema: SistemaDeRpg | null, combate: CombateDoPersonagem | undefined, acoes: AcoesDaVez | null): GolpeNaTela[] {
  const carga = combate?.carga ?? 0
  const golpeDe = (arma: CartaoDaFicha | null): GolpeNaTela => {
    const lida = arma === null ? null : lerAcao(arma.campos[CAMPO_DA_ACAO] ?? '').acao
    const acaoDaFicha: AcaoDaTecnica = lida === null || lida === 'passiva' ? 'simples' : lida
    const gasta = acaoDoGolpe(acaoDaFicha, carga) ?? acaoDaFicha
    const dano = personagem === null || sistema === null ? danoNaTela({ tipo: 'naoEntende', texto: '' }) : danoNaTela(danoDoAtaque({ personagem, sistema, arma, vidaDoAlvo: null }))
    return {
      chave: arma === null ? 'ataque' : `arma:${arma.id}`,
      tipo: 'atacar',
      cartaoId: null,
      armaId: arma?.id ?? null,
      nome: arma === null ? 'Ataque desarmado' : arma.nome.trim() || 'Arma sem nome',
      descricao: arma === null ? 'Sem arma: o dano é a Força.' : (arma.campos.descricao ?? arma.campos.efeito ?? '').trim(),
      custoTexto: null,
      custo: { tipo: 'nada' },
      acao: acaoDaFicha,
      acaoTexto: textoDaAcao(gasta),
      tempoTexto: null,
      dano,
      overload: false,
      perfurante: false,
      motivo: acoes === null ? null : motivoDaAcao(acoes, gasta),
    }
  }
  const armas = armasNaBatalha(personagem, combate)
  return armas.length === 0 ? [golpeDe(null)] : armas.map(golpeDe)
}

/** A arma de um golpe pelo id, entre as da ficha. */
export function armaPorId(personagem: Personagem | null, armaId: string | null): CartaoDaFicha | null {
  if (personagem === null || armaId === null) return null
  return armasDe(personagem).find((arma) => arma.id === armaId) ?? null
}

/** Um pip da cabeça do menu ("Simples 1", riscado quando gasto). */
export interface PipDaVez {
  id: 'simples' | 'bonus' | 'mov'
  texto: string
  gasto: boolean
  /** Mov passou do limite: vermelho, nunca trava (decisão 6). */
  passou?: boolean
}

/** "Simples 1 · Bônus 0 · Mov 2/4": o que sobrou da vez, como no protótipo. */
export function pipsDaVez(acoes: AcoesDaVez): PipDaVez[] {
  const sobra = (contagem: { usadas: number; total: number }) => Math.max(0, contagem.total - contagem.usadas)
  const pips: PipDaVez[] = [{ id: 'simples', texto: `Simples ${sobra(acoes.simples)}`, gasto: sobra(acoes.simples) === 0 }]
  if (acoes.bonus.total > 0) pips.push({ id: 'bonus', texto: `Bônus ${sobra(acoes.bonus)}`, gasto: sobra(acoes.bonus) === 0 })
  const { andados, limite } = acoes.blocos
  pips.push({
    id: 'mov',
    texto: limite === null ? `Mov ${andados}` : `Mov ${andados}/${limite}`,
    gasto: sobra(acoes.movimento) === 0,
    passou: limite !== null && andados > limite,
  })
  return pips
}

/** O mesmo texto dos pips, numa linha, para o leitor de tela e o painel do mestre. */
export function economiaEmTexto(acoes: AcoesDaVez): string {
  return pipsDaVez(acoes)
    .map((pip) => pip.texto)
    .join(' · ')
}

/** O combate do personagem dele como a regra o lê, a partir do recorte (`concentrouNestaVez` vira a chave da vez). */
export function combateDoJogador(meu: CombateParaJogador | undefined, chaveDaVezAgora: string | null): CombateDoPersonagem | undefined {
  if (meu === undefined) return undefined
  const carga = Math.min(CARGA_MAX, Math.max(0, Math.trunc(meu.carga))) as CombateDoPersonagem['carga']
  const combate: CombateDoPersonagem = { recargas: meu.recargas, usos: meu.usos, overload: meu.overload, carga, armas: meu.armas }
  if (meu.concentrouNestaVez && chaveDaVezAgora !== null) combate.concentrouEm = chaveDaVezAgora
  return combate
}

/** "Carga 2 · próximo golpe ×2"; `null` sem carga. */
export function textoDaCarga(carga: number): string | null {
  if (carga <= 0) return null
  const vezes = MULTIPLICADOR_DA_CARGA[Math.min(CARGA_MAX, carga)] ?? 1
  return `Carga ${carga} · próximo golpe ×${formatarNumero(vezes)}`
}

/** O dano que chega e a conta ao lado: "205 × 2 concentração × 1,5 Surpresa = 615". */
export function contaDoGolpe(base: number, carga: number, surpresa: boolean): { valor: number; conta: string } {
  const valor = danoQueChega(base, carga, surpresa)
  const partes = [formatarNumero(base)]
  const vezes = MULTIPLICADOR_DA_CARGA[Math.min(CARGA_MAX, Math.max(0, carga))] ?? 1
  if (vezes !== 1) partes.push(`${formatarNumero(vezes)} concentração`)
  if (surpresa) partes.push(`${formatarNumero(MULTIPLICADOR_DA_SURPRESA)} Surpresa`)
  return { valor, conta: partes.length === 1 ? formatarNumero(valor) : `${partes.join(' × ')} = ${formatarNumero(valor)}` }
}

/** O que cada saída diz no botão da caixa REAÇÃO e no selo do d20. */
export const TEXTO_DA_SAIDA: Record<SaidaDaReacao, { botao: string; selo: string }> = {
  critico: { botao: 'Receber o golpe', selo: 'Falha crítica · ×1,5' },
  cheio: { botao: 'Receber o golpe', selo: 'Acertou' },
  metade: { botao: 'Defender', selo: 'Defendeu · metade' },
  esquiva: { botao: 'Esquivar', selo: 'Esquivou' },
  contra: { botao: 'Contra-atacar', selo: 'Contra-ataque!' },
  naoReagiu: { botao: 'Não reagir', selo: 'Não reagiu' },
  passou: { botao: 'Passar', selo: 'Passou' },
  semReacao: { botao: 'Receber o golpe', selo: 'Sem reação' },
}

export interface SaidaNaTela {
  saida: SaidaDaReacao
  rotulo: string
  /** O dano que cai com esta saída; `null` = golpe sem dano. */
  dano: number | null
}

/** As saídas que o d20 liberou (a melhor primeiro), com o dano de cada uma. */
export function saidasNaTela(d20: number, total: number, dano: number | null): SaidaNaTela[] {
  return saidasPossiveis(d20, total).map((saida) => ({ saida, rotulo: TEXTO_DA_SAIDA[saida].botao, dano: dano === null ? null : danoFinal(dano, saida) }))
}

/** A palavra grande sobre o número do dano; `null` = só o número. */
export function palavraDoDano(saida: SaidaDaReacao | 'direto'): string | null {
  switch (saida) {
    case 'critico':
      return 'CRÍTICO'
    case 'esquiva':
      return 'ESQUIVOU'
    case 'contra':
      return 'CONTRA-ATAQUE'
    case 'metade':
      return 'DEFENDEU'
    default:
      return null
  }
}

/** O efeito como texto para a região viva (leitor de tela). */
export function anuncioDoEfeito(efeito: EfeitoDaBatalha, nomeDe: (tokenId: string) => string): string {
  switch (efeito.tipo) {
    case 'golpe':
      return `${nomeDe(efeito.atacanteTokenId)} usa ${efeito.nome}${efeito.surpresa ? ', Surpresa' : ''}`
    case 'reacao':
      return `${nomeDe(efeito.tokenId)} rolou ${efeito.d20}${efeito.modificador === 0 ? '' : ` ${efeito.modificador > 0 ? '+' : '−'} ${Math.abs(efeito.modificador)}`} = ${efeito.total}`
    case 'dano': {
      const palavra = palavraDoDano(efeito.saida)
      return `${nomeDe(efeito.tokenId)}: ${palavra === null ? '' : `${palavra.toLowerCase()}, `}${formatarNumero(efeito.valor)} de dano`
    }
  }
}

/** Movimento reduzido do sistema (o jogador não carrega o grimório, então não importa `grimorio/comum`). */
export function movimentoReduzido(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

/** Um inteiro de 0 ao teto, a partir do que foi digitado; `null` = vazio ou inválido. */
export function lerInteiro(texto: string, teto: number): number | null {
  const limpo = texto.replace(/\D/g, '')
  if (limpo === '') return null
  const valor = Number(limpo)
  return Number.isFinite(valor) ? Math.min(teto, Math.max(0, Math.trunc(valor))) : null
}
