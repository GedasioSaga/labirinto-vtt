import type { CartaoDaFicha } from '../../../personagem'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO, CAMPO_DO_TEMPO, lerAcao, lerCusto, lerTempo } from '../../leituraDaFicha'
import { alvoDaPassiva, efeitoPorTurno, gatilhoDaPassiva, seloDaPassiva, type GatilhoDaPassiva } from '../../passivas'
import { lerDuracao } from '../../selos'
import {
  CAMPO_DA_DURACAO,
  CAMPO_DO_DANO_RECEBIDO,
  CAMPO_DO_DESLOCAMENTO,
  CAMPO_DOS_ATAQUES_EXTRAS,
  CAMPO_DOS_USOS,
  acaoDaForma,
  ataquesExtrasDaForma,
  deslocamentoDaForma,
  duracaoDaForma,
  grupoDaForma,
  reducaoDaForma,
  requisitoDaForma,
  usosDaForma,
} from '../../transformacao'
import type { MecanicaV2 } from '../modelo'
import { EFEITOS_DO_GATILHO_MAX, MODS_DA_FORMA_MAX, PECA_DE_PARTIDA, type EfeitoDoGatilho, type PecaGatilho, type PecaTransformacao, type QuandoOGatilhoDispara } from '../pecas'
import { montarCartao } from '../textoGerado'
import { guardarConvertida, type ContextoDaConversao, type ResultadoDoCartao } from './comum'
import { custosDoTexto } from './tecnica'

/**
 * CONVERSÃO DA PASSIVA E DA FORMA DE TEXTO (E2, D11). Só monta o que a peça diz igual ao texto; o
 * resto segue pelo texto, como hoje (a E5 mantém esse ramo).
 *
 * Passiva: o gatilho com hora (início da batalha, rodada N, vida abaixo de N%) e o selo com números
 * por N turnos viram a peça "Dispara sozinha" com "Pergunta antes de disparar" ligada (o "Ativar /
 * Agora não" de hoje, D6), uma vez por batalha (o `lembradas` de hoje). A passiva que vale sempre, a
 * de requisito escrito, a do oponente, a de efeito a cada turno e a sem número com tempo ficam no texto.
 *
 * Forma (aba Transformações): Duração, Ataques extras, Dano recebido, Deslocamento, Grupo, Usos e os
 * modificadores viram a peça Transformação (D5); Ação e Custo, a ação e o custo da mecânica "Ligar e
 * manter". Os campos de texto da forma ficam como estão (o app de antes, o site e o Worker leem por
 * eles; a gravação da E6 os escreve das peças). A forma Overload fica no texto: o cansaço de antes não
 * vira a Fadiga sozinho (D10).
 */

function noTexto(porque: string): ResultadoDoCartao {
  return { tipo: 'noTexto', porque }
}

/** O gatilho de hoje como o da peça; `null` = vale sempre ou pede um requisito escrito (sem hora). */
function quandoDaPeca(gatilho: GatilhoDaPassiva): { quando: QuandoOGatilhoDispara; n: number } | null {
  switch (gatilho.tipo) {
    case 'inicio':
      return { quando: 'inicio', n: PECA_DE_PARTIDA.gatilho.n }
    case 'rodada':
      return { quando: 'rodada', n: gatilho.rodada }
    case 'vida':
      return { quando: 'vidaAbaixo', n: gatilho.abaixoDe }
    case 'requisito':
    case 'sempre':
      return null
  }
}

/** As frases do texto que a leitura não usou (a frase do selo "por N turnos" foi usada). */
function frasesForaDoSelo(texto: string, nome: string, turnos: number | null): string[] {
  const limpo = texto.trim()
  if (limpo === '' || limpo === '-') return []
  return limpo
    .split(/[.;!?\n]+/)
    .map((frase) => frase.trim())
    .filter((frase) => frase.length > 0)
    .filter((frase) => turnos === null || lerDuracao(frase, nome)?.turnos !== turnos)
}

/** A passiva de texto montada (só a que a peça diz igual); senão, no texto. */
export function converterPassiva(cartao: CartaoDaFicha, ctx: ContextoDaConversao): ResultadoDoCartao {
  const quando = quandoDaPeca(gatilhoDaPassiva(cartao))
  if (quando === null) return noTexto('passiva que vale sempre ou pede um requisito escrito: segue pelo texto, como hoje')
  if (alvoDaPassiva(cartao) === 'oponente') return noTexto('passiva que vai num oponente: segue pelo texto, como hoje')
  if (efeitoPorTurno(cartao, ctx.sistema) !== null) return noTexto('passiva com efeito a cada turno: segue pelo texto, como hoje')
  const selo = seloDaPassiva(cartao, ctx.sistema)
  const mods = selo.mods ?? []
  const turnos = selo.turnos
  if (turnos === null || mods.length === 0) return noTexto('passiva sem números por um tempo: segue pelo texto, como hoje')
  if (mods.length > EFEITOS_DO_GATILHO_MAX) return noTexto('passiva com números demais para uma peça: segue pelo texto')
  const custos = custosDoTexto(lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', ctx.personagem))
  if (custos === null) return noTexto('passiva com custo em conta: segue pelo texto')
  const efeitos: EfeitoDoGatilho[] = mods.map((mod) => ({ tipo: 'atributo', atributo: mod.alvo, valor: mod.delta, turnos }))
  const peca: PecaGatilho = { tipo: 'gatilho', quando: quando.quando, n: quando.n, vezes: 'umaPorBatalha', pergunta: true, efeitos }
  const mecanica: MecanicaV2 = { versao: 5, uso: 'passiva', acao: 'livre', custos, limite: {}, alvo: { quem: 'si', forma: { tipo: 'um' } }, teste: { tipo: 'naoErra' }, efeitos: [], pecas: [peca] }
  const guardada = guardarConvertida(mecanica)
  if (guardada === null) return noTexto('a passiva lida do texto não fecha nas peças')
  return { tipo: 'convertido', cartao: montarCartao(cartao, guardada, ctx.sistema), deQue: 'passiva', confira: frasesForaDoSelo(cartao.campos[CAMPO_DO_EFEITO] ?? '', cartao.nome, turnos) }
}

/** O campo da forma escrito que a leitura não entendeu: "Rótulo de antes: valor". */
function campoNaoLido(cartao: CartaoDaFicha, campo: string, rotulo: string, lido: boolean): string[] {
  const escrito = (cartao.campos[campo] ?? '').trim()
  return lido || escrito === '' || escrito === '-' ? [] : [`${rotulo} de antes: ${escrito}`]
}

/** A forma de texto como a peça Transformação na mecânica "Ligar e manter"; a Overload e o custo em conta ficam no texto. */
export function converterForma(cartao: CartaoDaFicha, ctx: ContextoDaConversao): ResultadoDoCartao {
  const tempo = lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? '')
  if (lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '').overload || tempo.tipo === 'overload') return noTexto('forma Overload: o cansaço de antes não vira a Fadiga sozinho (monte a Fadiga na peça quando quiser)')
  if (tempo.tipo !== 'livre') return noTexto('forma com Tempo escrito: segue pelo texto')
  const custos = custosDoTexto(lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', ctx.personagem))
  if (custos === null) return noTexto('forma com custo em conta: segue pelo texto')
  if (cartao.modificadores.length > MODS_DA_FORMA_MAX) return noTexto('forma com modificadores demais para uma peça: segue pelo texto')
  const { aMais, max } = deslocamentoDaForma(cartao)
  const reducao = reducaoDaForma(cartao)
  const acoes = ataquesExtrasDaForma(cartao)
  const dura = duracaoDaForma(cartao)
  const usos = usosDaForma(cartao)
  const partida = PECA_DE_PARTIDA.transformacao
  const peca: PecaTransformacao = {
    tipo: 'transformacao',
    dura: dura ?? 0,
    acoes: acoes ?? 0,
    mods: cartao.modificadores.map((mod) => ({ atributo: mod.atributo, valor: mod.delta })),
    danoRecebido: reducao === null ? 0 : -reducao,
    deslocamento: aMais ?? 0,
    deslocamentoMax: max ?? 0,
    grupo: grupoDaForma(cartao) ?? '',
    naoErra: false,
    marca: false,
    fadiga: false,
    fadigaTurnos: partida.fadigaTurnos,
    fadigaMods: partida.fadigaMods,
  }
  const mecanica: MecanicaV2 = {
    versao: 5,
    uso: 'manter',
    acao: acaoDaForma(cartao),
    custos,
    limite: usos === null ? {} : { usosPorBatalha: usos },
    alvo: { quem: 'si', forma: { tipo: 'um' } },
    teste: { tipo: 'naoErra' },
    efeitos: [],
    pecas: [peca],
  }
  const guardada = guardarConvertida(mecanica)
  if (guardada === null) return noTexto('a forma lida do texto não fecha nas peças (algum número passa do que a peça aceita)')
  const requisito = requisitoDaForma(cartao)
  const confira = [
    ...(requisito === null ? [] : [`Requisito de antes: ${requisito} (ponha em Requisitos)`]),
    ...(acoes === null || acoes === 0 ? [] : [`Ataques extras de antes: ${acoes} (agora são as ações a mais em cada vez)`]),
    ...campoNaoLido(cartao, CAMPO_DA_DURACAO, 'Duração', dura !== null),
    ...campoNaoLido(cartao, CAMPO_DOS_ATAQUES_EXTRAS, 'Ataques extras', acoes !== null),
    ...campoNaoLido(cartao, CAMPO_DO_DANO_RECEBIDO, 'Dano recebido', reducao !== null),
    ...campoNaoLido(cartao, CAMPO_DO_DESLOCAMENTO, 'Deslocamento', aMais !== null || max !== null),
    ...campoNaoLido(cartao, CAMPO_DOS_USOS, 'Usos', usos !== null),
    ...frasesForaDoSelo(cartao.campos[CAMPO_DO_EFEITO] ?? '', cartao.nome, null),
  ]
  // Os campos de texto da forma ficam: só a mecânica entra (o texto dela diz o mesmo que a peça).
  return { tipo: 'convertido', cartao: { ...cartao, mecanica: guardada }, deQue: 'forma', confira }
}
