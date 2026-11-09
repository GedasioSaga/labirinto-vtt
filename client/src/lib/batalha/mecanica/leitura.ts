import type { CartaoDaFicha, Personagem } from '../../personagem'
import { numeroDaFicha } from '../../personagem'
import type { SeloDoGolpe } from '../combate'
import type { FormaDaArea } from '../area'
import type { LeituraDaAcao, LeituraDoCusto, LeituraDoTempo } from '../leituraDaFicha'
import type { LimpezaAMao, MecanicaAMao } from '../mecanicasAMao'
import type { ReacaoDoTipo } from '../tiposDaHabilidade'
import { avisoDaMecanica, lerMecanica, type Custo, type FormaDoAlvo, type MecanicaLida, type MecanicaV1, type Numero, type NumeroSimples } from './modelo'

/**
 * A TRADUÇÃO DAS PEÇAS (construtor de mecânicas, fatia C1; seção 2 do plano):
 * as peças do cartão viram as MESMAS leituras que o texto dá (custo, ação,
 * tempo, Overload) e a MESMA linha que a tabela à mão da F2 dá
 * (`MecanicaAMao`). Assim o resto do motor (menu, mira, golpe, store, duelo)
 * não percebe a diferença: quem procura a mecânica passa o cartão
 * (`mecanicaDoCartao`) e recebe a linha das peças no lugar da da tabela.
 *
 * Tudo ou nada: cartão com o campo `mecanica` nunca cai na tabela nem no
 * texto. Peça torta ou versão futura = cartão à mão (custo e dano digitados,
 * ação perguntada) com o aviso no lembrete da mira.
 *
 * Puro: sem store, sem rede.
 */

/** A leitura de cada objeto de mecânica, uma vez só (o cartão é imutável: editar troca o objeto). */
const lidas = new WeakMap<object, MecanicaLida>()

/** As peças do cartão, lidas e conferidas (`lerMecanica`). */
export function mecanicaLidaDoCartao(cartao: Pick<CartaoDaFicha, 'mecanica'>): MecanicaLida {
  const guardada = cartao.mecanica
  if (guardada === undefined) return { tipo: 'nenhuma' }
  const memoria = lidas.get(guardada)
  if (memoria !== undefined) return memoria
  const lida = lerMecanica(guardada)
  lidas.set(guardada, lida)
  return lida
}

/** O cartão é montado por peças (mesmo torto ou de app mais novo): o texto não vale mais. */
export function cartaoMontado(cartao: Pick<CartaoDaFicha, 'mecanica'>): boolean {
  return cartao.mecanica !== undefined
}

/** As peças válidas do cartão; `null` = sem campo, torto ou futuro. */
export function pecasDoCartao(cartao: Pick<CartaoDaFicha, 'mecanica'>): MecanicaV1 | null {
  const lida = mecanicaLidaDoCartao(cartao)
  return lida.tipo === 'pecas' ? lida.mecanica : null
}

/** O texto de um número simples na gramática de `lerDano` (o fixo vira "30"). */
export function formulaDoNumero(numero: NumeroSimples): string {
  return 'fixo' in numero ? String(numero.fixo) : numero.formula
}

/** A fórmula do dano do cartão montado ("" = sem dano, torto ou futuro); `null` = cartão de texto (vale o campo Dano). */
export function formulaDoDanoDasPecas(cartao: Pick<CartaoDaFicha, 'mecanica'>): string | null {
  if (!cartaoMontado(cartao)) return null
  const dano = pecasDoCartao(cartao)?.dano
  return dano === undefined ? '' : formulaDoNumero(dano.base)
}

/** O número na carga 0 (o de sempre). */
function semCarga(numero: Numero): NumeroSimples {
  return 'porCarga' in numero ? numero.porCarga[0] : numero
}

/** O número do custo na ficha de quem usa, para baixo; `null` = a fórmula não fecha (vira pergunta). */
function valorDoCusto(custo: Custo, personagem: Personagem, lerFormula: (formula: string) => number | null): number | null {
  const { quanto } = custo
  if ('fixo' in quanto) return quanto.fixo
  if ('formula' in quanto) {
    const valor = lerFormula(quanto.formula)
    return valor === null ? null : Math.max(0, Math.floor(valor))
  }
  // O máximo que a ficha não tem não vira 0 de custo: vira pergunta (como `custoPeloMaximo` da F2).
  const maximo: number | undefined = personagem.maximos[custo.recurso]
  const base = quanto.de === 'maximo' ? maximo : numeroDaFicha(personagem.recursos, custo.recurso)
  return base === undefined ? null : Math.max(0, Math.floor((base * quanto.porcento) / 100))
}

/**
 * O custo que bloqueia, como o texto o daria: o "ao usar" (ou, sem ele, o
 * "por vez", com `porTurno`). O "depois" não bloqueia: vai na linha
 * (`custoEmHp`) e cobra ao lançar.
 */
export function custoDasPecas(mecanica: MecanicaV1, personagem: Personagem, lerFormula: (formula: string) => number | null): LeituraDoCusto {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  const custo = aoUsar ?? mecanica.custos.find((custo) => custo.quando === 'porTurno')
  if (custo === undefined) return { tipo: 'nada' }
  const valor = valorDoCusto(custo, personagem, lerFormula)
  if (valor === null) return { tipo: 'pergunta', recurso: custo.recurso, sugestao: null, texto: 'A fórmula do custo não fecha com esta ficha' }
  return { tipo: 'valor', recurso: custo.recurso, valor, porTurno: custo.quando === 'porTurno' }
}

/** A ação como `lerAcao` daria; `perguntar` = `null` (a mira pergunta, como na transformação). */
export function acaoDasPecas(mecanica: MecanicaV1): LeituraDaAcao {
  const acao = mecanica.acao === 'perguntar' ? null : mecanica.acao
  return { acao, overload: mecanica.limite.overload === true, transformacao: false, tambemReacao: false }
}

/** O Tempo como `lerTempo` daria. */
export function tempoDasPecas(mecanica: MecanicaV1): LeituraDoTempo {
  const { recarga, usosPorBatalha, overload } = mecanica.limite
  if (recarga !== undefined) return { tipo: 'recarga', turnos: recarga }
  if (usosPorBatalha !== undefined) return { tipo: 'usos', vezes: usosPorBatalha }
  return overload === true ? { tipo: 'overload' } : { tipo: 'livre' }
}

/**
 * Quem reage: "não erra" ou o golpe em si ou nos aliados (ajuda não se
 * esquiva, como o Buff) = ninguém; com selo ou sem dano = reage sempre
 * (esquivou, o efeito não pega); o resto, só com dano.
 */
export function reacaoDasPecas(mecanica: MecanicaV1): ReacaoDoTipo {
  if (mecanica.teste.tipo === 'naoErra' || mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si') return 'nunca'
  const temSelo = mecanica.efeitos.some((efeito) => efeito.tipo === 'selo')
  return temSelo || mecanica.dano === undefined ? 'sempre' : 'comDano'
}

/** Os multiplicadores do golpe montado, na ordem de `danoQueChega` (os extras na ordem da lista). */
export interface MultiplicadoresDasPecas {
  surpresa: boolean
  extras: readonly number[]
}

export function multiplicadoresDasPecas(mecanica: MecanicaV1): MultiplicadoresDasPecas {
  const mult = mecanica.dano?.multiplicadores
  return { surpresa: mult?.surpresa !== false, extras: (mult?.extra ?? []).map((extra) => extra.vezes) }
}

/** O dano divide entre os marcados (com o teto de alvos); `null` = cada um toma o golpe inteiro. */
export function divisaoDasPecas(mecanica: MecanicaV1): number | null {
  const { forma } = mecanica.alvo
  return forma.tipo === 'varios' && forma.dividirDano === true ? forma.max : null
}

/** A forma do alvo como a área de hoje (`area.ts`) a desenha; `null` = alvo marcado à mão. */
function areaDaForma(forma: FormaDoAlvo): FormaDaArea | null {
  switch (forma.tipo) {
    case 'linha':
      return { tipo: 'linha', alcance: forma.casas }
    case 'raio':
      return { tipo: 'raio', casas: forma.casas }
    case 'quadrado':
      // Em volta de quem usa, lado ímpar (a leitura confere): 3x3 = raio 1, 5x5 = raio 2.
      return forma.centro === 'frente' ? { tipo: 'frente', lado: forma.lado } : { tipo: 'raio', casas: (forma.lado - 1) / 2 }
    case 'um':
    case 'varios':
      return null
  }
}

/** A cura e a limpeza das peças como a da Revigorar (`LimpezaAMao`); `null` = nenhuma das duas. */
function limpezaDasPecas(mecanica: MecanicaV1): LimpezaAMao | null {
  const cura = mecanica.efeitos.find((efeito) => efeito.tipo === 'cura')
  const tira = mecanica.efeitos.some((efeito) => efeito.tipo === 'tirarSelos')
  if (cura === undefined && !tira) return null
  // Só tirar selos: a limpeza da F2 sempre cura; "0" não mexe na ficha.
  const limpeza: LimpezaAMao = { cura: cura === undefined ? '0' : formulaDoNumero(semCarga(cura.quanto)) }
  if (cura !== undefined && 'porCarga' in cura.quanto) {
    const [, um, dois, tres] = cura.quanto.porCarga
    limpeza.porCarga = { 1: formulaDoNumero(um), 2: formulaDoNumero(dois), 3: formulaDoNumero(tres) }
  }
  if (!tira) limpeza.soCura = true
  return limpeza
}

/** O selo que o golpe põe no acerto; `null` = nenhum. */
export function seloDasPecas(mecanica: MecanicaV1): SeloDoGolpe | null {
  const selo = mecanica.efeitos.find((efeito) => efeito.tipo === 'selo')
  if (selo === undefined) return null
  const lido: SeloDoGolpe = { nome: selo.nome, turnos: selo.duracao === 'ateTirar' ? null : selo.duracao }
  if (selo.natureza !== undefined) lido.natureza = selo.natureza
  return lido
}

/** Os lembretes à mão, juntos (a mira mostra um texto só). */
function lembretesDasPecas(mecanica: MecanicaV1): string | null {
  const textos = mecanica.efeitos.flatMap((efeito) => (efeito.tipo === 'aMao' ? [efeito.texto] : []))
  return textos.length === 0 ? null : textos.join(' · ')
}

/**
 * A linha da tabela à mão que as peças dão. Só os campos que as peças
 * preenchem; o resto fica ausente (= "não tem", como na técnica sem linha).
 */
export function linhaDasPecas(nome: string, mecanica: MecanicaV1): MecanicaAMao {
  const linha: MecanicaAMao = { nome }
  if (mecanica.acao !== 'perguntar') linha.acao = mecanica.acao
  if (mecanica.limite.usosPorBatalha !== undefined) linha.usosPorBatalha = mecanica.limite.usosPorBatalha
  if (mecanica.teste.tipo === 'naoErra') linha.semReacao = true
  for (const custo of mecanica.custos) {
    if (custo.quando === 'aoUsar' && 'porcento' in custo.quanto && custo.quanto.de === 'maximo') linha.custoDoMaximo = { recurso: custo.recurso, porcento: custo.quanto.porcento }
    // A técnica mantida: o "por vez" é sempre fixo (a leitura confere).
    if (custo.quando === 'porTurno' && 'fixo' in custo.quanto) linha.mantida = { custoPorVez: { recurso: custo.recurso, valor: custo.quanto.fixo } }
    // O "depois" em HP fixo é o "Técnica Incompleta" da Sai Dai Rin: cobra ao lançar, sem bloquear.
    if (custo.quando === 'depois' && custo.recurso === 'hp' && 'fixo' in custo.quanto) linha.custoEmHp = custo.quanto.fixo
  }
  const { dano } = mecanica
  if (dano !== undefined) {
    linha.dano = formulaDoNumero(dano.base)
    linha.perfurante = dano.perfurante === true
    if (!dano.multiplicadores.concentracao) linha.semConcentracao = true
  } else {
    linha.perfurante = false
  }
  const { forma, quem } = mecanica.alvo
  const area = areaDaForma(forma)
  if (area !== null) linha.area = { forma: area, quem: quem === 'inimigos' ? 'inimigos' : 'todos' }
  if (forma.tipo === 'varios' && forma.dividirDano === true) linha.divide = { teto: forma.max }
  else if (forma.tipo === 'varios') linha.tetoDeAlvosComDano = forma.max
  else if (forma.tipo === 'um') linha.tetoDeAlvosComDano = 1
  const selo = seloDasPecas(mecanica)
  if (selo !== null) linha.selo = selo
  const limpa = limpezaDasPecas(mecanica)
  if (limpa !== null) linha.limpa = limpa
  const lembrete = lembretesDasPecas(mecanica)
  if (lembrete !== null) linha.lembreteNaMira = lembrete
  return linha
}

/** As linhas já traduzidas, pela mesma chave da leitura. */
const linhas = new WeakMap<object, MecanicaAMao>()

/**
 * A linha do cartão montado: a das peças, ou (torto, futuro) a linha vazia
 * com o aviso na mira. `null` = o cartão não é montado (vale a tabela).
 */
export function linhaDoCartaoMontado(cartao: Pick<CartaoDaFicha, 'mecanica'> & { nome?: string }): MecanicaAMao | null {
  const guardada = cartao.mecanica
  if (guardada === undefined) return null
  const memoria = linhas.get(guardada)
  if (memoria !== undefined) return memoria
  const lida = mecanicaLidaDoCartao(cartao)
  const nome = cartao.nome?.trim() || 'Técnica montada'
  const linha: MecanicaAMao = lida.tipo === 'pecas' ? linhaDasPecas(nome, lida.mecanica) : { nome, lembreteNaMira: avisoDaMecanica(lida.tipo === 'nenhuma' ? { tipo: 'invalida', motivo: 'vazia' } : lida) }
  linhas.set(guardada, linha)
  return linha
}

/** O aviso do cartão montado que o app não executa; `null` = peças válidas ou cartão de texto. */
export function avisoDoCartaoMontado(cartao: Pick<CartaoDaFicha, 'mecanica'>): string | null {
  const lida = mecanicaLidaDoCartao(cartao)
  return lida.tipo === 'invalida' || lida.tipo === 'futura' ? avisoDaMecanica(lida) : null
}
