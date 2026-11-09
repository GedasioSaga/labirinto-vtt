import type { Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import type { SaidaDaReacao } from '../combate'
import { comportamentoDoSelo } from '../condicoes'
import { cdDaExpressao } from '../disputa'
import { lerDano } from '../formula'
import type { CdDoTeste, Custo, DuracaoDoSelo, Efeito, MecanicaV1, Numero, NumeroDaCd, NumeroSimples, QuemOAlvoPega, QuemRolaNoTeste } from './modelo'

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

/** O nome do atributo no sistema da ficha ("Resistência"); sem a ficha, o id guardado. */
export function nomeDoAtributo(atributoId: string, ficha?: FichaDaPrevia): string {
  const achado = ficha?.sistema.atributos.find((atributo) => atributo.id === atributoId)
  return achado === undefined || achado.nome.trim() === '' ? atributoId : achado.nome.trim()
}

/** "Resistência com desvantagem". */
function quemRolaNaFrase(quem: QuemRolaNoTeste, ficha?: FichaDaPrevia): string {
  const vantagem = quem.vantagem === undefined ? '' : ` com ${quem.vantagem}`
  return `${nomeDoAtributo(quem.atributo, ficha)}${vantagem}`
}

/** A prévia da CD por fórmula: "= 14 com a ficha de hoje"; `null` = sem ficha. */
export function previaDaCd(formula: string, ficha?: FichaDaPrevia): string | null {
  if (ficha === undefined || formula.trim() === '') return null
  const valor = cdDaExpressao(formula, { personagem: ficha.personagem }, ficha.sistema)
  return valor === null ? 'a fórmula não fecha com esta ficha' : `= ${valor} com a ficha de hoje`
}

function numeroDaCdNaFrase(numero: NumeroDaCd): string {
  return numero === 'automatico' ? 'pega sem teste' : numeroSimples(numero) || '?'
}

/** "CD 12", "CD 12 + mod(Carisma) (= 14 com a ficha de hoje)", "CD 11 (com Concentração: 14 / 17 / pega sem teste)". */
export function textoDaCd(cd: CdDoTeste, ficha?: FichaDaPrevia): string {
  if ('porCarga' in cd) {
    const [zero, um, dois, tres] = cd.porCarga
    return `CD ${numeroSimples(zero) || '?'} (com Concentração: ${[um, dois, tres].map(numeroDaCdNaFrase).join(' / ')})`
  }
  const previa = 'formula' in cd ? previaDaCd(cd.formula, ficha) : null
  return `CD ${numeroSimples(cd) || '?'}${previa === null ? '' : ` (${previa})`}`
}

/** Bloco 4: como acerta. Ajuda (aliado, em si) não se esquiva. */
export function fraseDoTeste(mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const { quem } = mecanica.alvo
  if (quem === 'aliados' || quem === 'si') return 'Ajuda não se esquiva: pega sem teste.'
  const { teste } = mecanica
  switch (teste.tipo) {
    case 'reacao':
      return 'O alvo reage normal (o d20 de sempre).'
    case 'naoErra':
      return 'Não erra: o alvo não reage.'
    case 'resistencia': {
      const devolve = teste.sePassar === 'devolveCusto' ? ' Se todos passarem, a técnica não gasta: o custo e o uso voltam.' : ''
      return `O alvo não reage: testa ${quemRolaNaFrase(teste.alvo, ficha)} (d20 + mod) contra ${textoDaCd(teste.cd, ficha)}. Se passar, nada acontece.${devolve}`
    }
    case 'disputa':
      return `O alvo não reage: disputa de d20 + ${quemRolaNaFrase(teste.usuario, ficha)} de quem usa contra d20 + ${quemRolaNaFrase(teste.alvo, ficha)} do alvo. Empate fica com o alvo; se o alvo vencer, nada acontece.`
  }
}

/** O começo da frase do selo: depende de como o golpe pega ("Se acertar", "Se o alvo falhar"). */
function quandoOSeloPega(mecanica: MecanicaV1): string {
  switch (mecanica.teste.tipo) {
    case 'resistencia':
      return 'Se o alvo falhar'
    case 'disputa':
      return 'Se vencer a disputa'
    case 'reacao':
    case 'naoErra':
      return 'Se acertar'
  }
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
  // Construtor C8: o Siegfried escolhe a arma na hora, e a padrão já vem marcada.
  if (dano.arma === 'perguntar') frases.push('Pergunta qual arma na hora (a padrão vem marcada).')
  return frases
}

/** Construtor C5: o número conta na vez de quem tem o selo (a regra do sistema), e a frase diz de quem. */
function duracaoDoSelo(duracao: DuracaoDoSelo, ajuda: boolean): string {
  if (duracao === 'ateTirar') return 'até tirarem'
  if (duracao === 'proximoGolpe') return 'até o próximo golpe que tomar'
  return `por ${duracao} ${duracao === 1 ? 'vez' : 'vezes'} ${ajuda ? 'de quem recebe' : 'do alvo'}`
}

/** As saídas da reação em verbo, para "não pode esquivar nem contra-atacar". */
const SAIDA_EM_VERBO: Readonly<Record<SaidaDaReacao, string>> = {
  critico: 'acertar crítico',
  cheio: 'receber',
  metade: 'defender',
  esquiva: 'esquivar',
  contra: 'contra-atacar',
  naoReagiu: 'não reagir',
  passou: 'passar',
  semReacao: 'ficar sem reação',
}

/**
 * Construtor C5: o que o selo FAZ, em frases curtas, pela regra do nome
 * (`condicoes.ts`) e pelo "tira X por vez" da peça. Vazio = selo sem regra
 * própria (o app só mostra o selo na carta).
 */
export function frasesDoSelo(selo: Pick<Extract<Efeito, { tipo: 'selo' }>, 'nome' | 'porTurno'>, ficha?: FichaDaPrevia): string[] {
  const regra = comportamentoDoSelo(selo.nome)
  const frases: string[] = []
  if (regra?.trava === true) frases.push('na vez dele só passa a vez, e não reage')
  if (regra?.tiraSaidas !== undefined && regra.tiraSaidas.length > 0) frases.push(`não pode ${regra.tiraSaidas.map((saida) => SAIDA_EM_VERBO[saida]).join(' nem ')}`)
  if (regra?.zera !== undefined) frases.push(`${nomeDoAtributo(regra.zera, ficha)} fica em 0`)
  if (regra?.reageComDesvantagem === true) frases.push('reage com desvantagem')
  if (regra?.esquivaComDesvantagem === true) frases.push('esquiva com desvantagem')
  if (regra?.curaDoDano !== undefined) frases.push(`recupera em vida ${regra.curaDoDano}% do dano que causa`)
  const porVez = selo.porTurno?.quanto.fixo ?? regra?.porVez
  if (porVez !== undefined) frases.push(`perde ${porVez} de HP no começo de cada vez dele, direto, quando o mestre clica Aplicar`)
  if (regra?.renova === true) frases.push('acertar de novo renova a duração')
  if (regra?.lembrete !== undefined) frases.push(`o app só lembra: ${regra.lembrete}`)
  return frases
}

/** Bloco 6: uma frase por efeito. */
export function fraseDoEfeito(efeito: Efeito, mecanica: MecanicaV1, ficha?: FichaDaPrevia): string {
  const ajuda = mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si'
  switch (efeito.tipo) {
    case 'selo': {
      const comeco = ajuda ? `Dá ${efeito.nome}` : `${quandoOSeloPega(mecanica)}: ${efeito.nome}`
      const regra = frasesDoSelo(efeito, ficha)
      return `${comeco} ${duracaoDoSelo(efeito.duracao, ajuda)}${regra.length === 0 ? '' : ` (${regra.join('; ')})`}.`
    }
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
  const alvoETeste = `${fraseDoAlvo(mecanica)} ${fraseDoTeste(mecanica, ficha)}`
  const limite = fraseDoLimite(mecanica)
  return [
    fraseDoCustoEDaAcao(mecanica),
    ...frasesDosOutrosCustos(mecanica),
    alvoETeste,
    ...frasesDoDano(mecanica, ficha),
    ...mecanica.efeitos.map((efeito) => fraseDoEfeito(efeito, mecanica, ficha)),
    ...(limite === null ? [] : [limite]),
  ]
}
