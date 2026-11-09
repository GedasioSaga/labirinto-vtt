import type { Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { lerDano } from '../formula'
import type { Custo, Efeito, MecanicaV1, Numero, NumeroSimples, QuemOAlvoPega } from './modelo'

/**
 * O RESUMO EM FRASES da técnica montada (construtor de mecânicas, fatia C2;
 * seção 3 do plano): o que o mestre lê embaixo do editor e o que o jogador vê
 * no cartão, sem jargão ("Custa 30 SP e gasta a Ação Simples. Acerta 1
 * inimigo, que reage normal."). As frases saem das MESMAS peças que o motor
 * executa: nada aqui decide regra, só descreve.
 *
 * Puro: sem store, sem rede.
 */

/** A ficha para a prévia do número ("= 80 com a ficha de hoje"); ausente = só a fórmula. */
export interface FichaDaPrevia {
  personagem: Personagem
  sistema: SistemaDeRpg
}

const RECURSO: Readonly<Record<'sp' | 'hp', string>> = { sp: 'SP', hp: 'HP' }

const ACAO: Readonly<Record<Exclude<MecanicaV1['acao'], 'perguntar'>, string>> = {
  simples: 'a Ação Simples',
  bonus: 'a Ação Bônus',
  completa: 'a Ação Completa',
  livre: 'uma Ação Livre',
}

/** "1,5": o número com a vírgula da ficha. */
export function numeroComVirgula(valor: number): string {
  return String(valor).replace('.', ',')
}

function numeroSimples(numero: NumeroSimples): string {
  return 'fixo' in numero ? String(numero.fixo) : numero.formula.trim()
}

/** "100" ou "100 (com Concentração: 150 / 200 / 350)". */
function numeroDaPeca(numero: Numero): string {
  if (!('porCarga' in numero)) return numeroSimples(numero)
  const [zero, um, dois, tres] = numero.porCarga
  return `${numeroSimples(zero)} (com Concentração: ${numeroSimples(um)} / ${numeroSimples(dois)} / ${numeroSimples(tres)})`
}

/** "30 SP", "10% do HP máximo", "Força de SP". */
function quantoCusta(custo: Custo): string {
  const recurso = RECURSO[custo.recurso]
  const { quanto } = custo
  if ('porcento' in quanto) return `${quanto.porcento}% do ${recurso} ${quanto.de === 'maximo' ? 'máximo' : 'atual'}`
  if ('fixo' in quanto) return `${quanto.fixo} ${recurso}`
  return `${quanto.formula.trim() || '?'} de ${recurso}`
}

/** Bloco 1 e 2 juntos: "Custa 30 SP e gasta a Ação Simples." */
export function fraseDoCustoEDaAcao(mecanica: MecanicaV1): string {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  const custa = aoUsar === undefined ? 'Não custa nada' : `Custa ${quantoCusta(aoUsar)}`
  return mecanica.acao === 'perguntar' ? `${custa}, e quem usa escolhe a ação na hora.` : `${custa} e gasta ${ACAO[mecanica.acao]}.`
}

/** Só o bloco 1 (o custo ao usar): "Custa 30 SP ao usar." */
export function fraseDoCusto(mecanica: MecanicaV1): string {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  return aoUsar === undefined ? 'Não custa nada ao usar.' : `Custa ${quantoCusta(aoUsar)} ao usar.`
}

/** Os custos de fora do "ao usar": o da técnica mantida e o de depois. */
export function frasesDosOutrosCustos(mecanica: MecanicaV1): string[] {
  const frases: string[] = []
  const porTurno = mecanica.custos.find((custo) => custo.quando === 'porTurno')
  if (porTurno !== undefined) frases.push(`Enquanto mantida, custa ${quantoCusta(porTurno)} a cada vez (o mestre aplica ou pula).`)
  const depois = mecanica.custos.find((custo) => custo.quando === 'depois')
  if (depois !== undefined) frases.push(`Depois de usar, perde ${quantoCusta(depois)}.`)
  return frases
}

/** O alvo no singular e no plural ("inimigo", "inimigos"). */
const QUEM: Readonly<Record<Exclude<QuemOAlvoPega, 'si'>, readonly [string, string]>> = {
  inimigos: ['inimigo', 'inimigos'],
  aliados: ['aliado', 'aliados'],
  todos: ['alvo (aliado ou inimigo)', 'alvos, aliados e inimigos'],
  escolha: ['alvo à escolha', 'alvos à escolha'],
}

/** Bloco 3: "Acerta todos os inimigos num quadrado 3x3 à frente." */
export function fraseDoAlvo(mecanica: MecanicaV1): string {
  const { quem, forma } = mecanica.alvo
  const ajuda = quem === 'aliados' || quem === 'si'
  const verbo = ajuda ? 'Pega' : 'Acerta'
  if (quem === 'si') return 'Pega em quem usa.'
  const [um, varios] = QUEM[quem]
  switch (forma.tipo) {
    case 'um':
      return `${verbo} 1 ${um}.`
    case 'varios':
      return `${verbo} até ${forma.max} ${varios}${forma.dividirDano === true ? ', e o dano se divide entre eles' : ''}.`
    case 'linha':
      return `${verbo} todos os ${varios} numa linha reta de ${forma.casas} ${forma.casas === 1 ? 'casa' : 'casas'}.`
    case 'quadrado':
      return `${verbo} todos os ${varios} num quadrado ${forma.lado}x${forma.lado} ${forma.centro === 'frente' ? 'à frente' : 'em volta de quem usa'}.`
    case 'raio':
      return `${verbo} todos os ${varios} a até ${forma.casas} ${forma.casas === 1 ? 'casa' : 'casas'} de quem usa.`
  }
}

/** Bloco 4: como acerta. Ajuda (aliado, em si) não se esquiva. */
export function fraseDoTeste(mecanica: MecanicaV1): string {
  const { quem } = mecanica.alvo
  if (quem === 'aliados' || quem === 'si') return 'Ajuda não se esquiva: pega sem teste.'
  return mecanica.teste.tipo === 'naoErra' ? 'Não erra: o alvo não reage.' : 'O alvo reage normal (o d20 de sempre).'
}

/** A prévia do número com a ficha: "= 80 com a ficha de hoje", "+ a arma escolhida na hora"; `null` = sem prévia. */
export function previaDoDano(formula: string, ficha: FichaDaPrevia | undefined): string | null {
  if (ficha === undefined || formula.trim() === '') return null
  const lido = lerDano(formula, { personagem: ficha.personagem, sistema: ficha.sistema, arma: null, vidaDoAlvo: null })
  switch (lido.tipo) {
    case 'valor':
      return `= ${lido.valor} com a ficha de hoje`
    case 'precisaArma':
      return 'soma a arma escolhida na hora'
    case 'precisaAlvo':
      return 'sai da vida do alvo, na hora'
    case 'semDano':
    case 'naoEntende':
      return null
  }
}

/** Bloco 5: "Dano: Força + 20 (= 80 com a ficha de hoje). Perfurante." */
export function frasesDoDano(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  const { dano } = mecanica
  const { quem } = mecanica.alvo
  if (dano === undefined) return quem === 'aliados' || quem === 'si' ? [] : ['Não dá dano.']
  const formula = numeroSimples(dano.base)
  const previa = previaDoDano(formula, ficha)
  const frases = [`Dano: ${formula || '(vazio)'}${previa === null ? '' : ` (${previa})`}${dano.perfurante === true ? ', perfurante' : ''}.`]
  const { concentracao, surpresa, extra = [] } = dano.multiplicadores
  const sem = [concentracao ? null : 'a Concentração', surpresa ? null : 'a Surpresa'].filter((item): item is string => item !== null)
  if (sem.length > 0) frases.push(`Não multiplica com ${sem.join(' nem com ')}.`)
  for (const mult of extra) frases.push(`× ${numeroComVirgula(mult.vezes)} (${mult.nome}).`)
  return frases
}

function duracaoDoSelo(duracao: number | 'ateTirar'): string {
  if (duracao === 'ateTirar') return 'até tirarem'
  return `por ${duracao} ${duracao === 1 ? 'vez' : 'vezes'}`
}

/** Bloco 6: uma frase por efeito. */
export function fraseDoEfeito(efeito: Efeito, mecanica: MecanicaV1): string {
  const ajuda = mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si'
  switch (efeito.tipo) {
    case 'selo':
      return ajuda ? `Dá ${efeito.nome} ${duracaoDoSelo(efeito.duracao)}.` : `Se acertar: ${efeito.nome} ${duracaoDoSelo(efeito.duracao)}.`
    case 'cura':
      return `Cura ${numeroDaPeca(efeito.quanto)} de HP.`
    case 'tirarSelos':
      return 'Tira os selos negativos.'
    case 'aMao':
      return `À mão (o app lembra o mestre): ${efeito.texto.trim()}`
  }
}

/** Bloco 7: recarga, usos e Overload; `null` = sem limite. */
export function fraseDoLimite(mecanica: MecanicaV1): string | null {
  const { recarga, usosPorBatalha, overload } = mecanica.limite
  const partes: string[] = []
  if (recarga !== undefined) partes.push(`Depois de usar, espera ${recarga} ${recarga === 1 ? 'vez' : 'vezes'} para usar de novo.`)
  if (usosPorBatalha !== undefined) partes.push(`Até ${usosPorBatalha} ${usosPorBatalha === 1 ? 'uso' : 'usos'} por batalha.`)
  if (overload === true) partes.push('Overload: 1 por batalha.')
  return partes.length === 0 ? null : partes.join(' ')
}

/** Quantas peças o app não executa (só lembra o mestre). */
export function pecasAMao(mecanica: MecanicaV1): number {
  return mecanica.efeitos.filter((efeito) => efeito.tipo === 'aMao').length
}

/** A etiqueta do resumo: "O app faz tudo" ou "1 peça à mão". */
export function etiquetaDaMecanica(mecanica: MecanicaV1): string {
  const quantas = pecasAMao(mecanica)
  if (quantas === 0) return 'O app faz tudo'
  return quantas === 1 ? '1 peça à mão' : `${quantas} peças à mão`
}

/** O resumo inteiro, na ordem dos blocos do editor. */
export function resumoDaMecanica(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string[] {
  const alvoETeste = `${fraseDoAlvo(mecanica)} ${fraseDoTeste(mecanica)}`
  const limite = fraseDoLimite(mecanica)
  return [
    fraseDoCustoEDaAcao(mecanica),
    ...frasesDosOutrosCustos(mecanica),
    alvoETeste,
    ...frasesDoDano(mecanica, ficha),
    ...mecanica.efeitos.map((efeito) => fraseDoEfeito(efeito, mecanica)),
    ...(limite === null ? [] : [limite]),
  ]
}
