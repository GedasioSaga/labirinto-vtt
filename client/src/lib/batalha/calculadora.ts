import { DANO_MAX } from './combate'

/**
 * CALCULADORA DE PORCENTAGEM do jogador (pedido de 31/10/2026): a conta que a
 * gente escreve, com a porcentagem no meio, sem `eval` nem `Function` (um
 * parser pequeno, descendente recursivo, que só conhece números e sinais).
 *
 * A regra do "%":
 *  - Depois de SOMA ou SUBTRAÇÃO, é relativo ao que vem antes:
 *    "200 + 15%" = 200 + 15% de 200 = 230; "200 - 10%" = 180.
 *  - Em MULTIPLICAÇÃO, DIVISÃO e "de", é fração:
 *    "900 x 10%" = 90; "10% de 900" = 90; "90 / 10%" = 900.
 *  - Sozinho, também é fração: "50%" = 0,5.
 *
 * Números: vírgula é sempre decimal ("1,5"). Ponto é decimal ("1.5", "0.125"),
 * MENOS quando separa grupos de 3 dígitos depois de um número que não começa
 * em zero, que aí é milhar como no Brasil ("1.000" = 1000, "12.500,5").
 *
 * Puro: sem store, sem tela.
 */

/** O texto mais longo que a conta aceita. */
export const CONTA_MAX = 120
/** Parênteses e sinais na frente ("-(-(5))") um dentro do outro. */
export const PROFUNDIDADE_DA_CONTA_MAX = 10
/** Acima disso o número já não é dano de jogo, e o ponto flutuante perde a conta. */
const VALOR_DA_CONTA_MAX = 1e15
/** As casas que a conta guarda entre um passo e outro: tira o ruído do ponto flutuante (0,29 × 100 = 28,999…). */
const CASAS_GUARDADAS = 1e9
const CEM = 100

export type ResultadoDaConta = { ok: true; valor: number; passos: string } | { ok: false; motivo: string }

type Operador = '+' | '-' | '*' | '/'

type Token = { tipo: 'numero'; valor: number } | { tipo: 'operador'; operador: Operador } | { tipo: 'de' } | { tipo: 'abre' } | { tipo: 'fecha' } | { tipo: 'porcento' }

/** Um pedaço já resolvido. `porcento` = é "X%" (o `valor` é o X); a regra de cima decide o que ele vira. */
interface Parcial {
  valor: number
  texto: string
  porcento: boolean
}

/** O erro que a conta mostra ao jogador; só ele é pego em `calcular`. */
class ErroDaConta extends Error {}

const formato = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** O número como a tela mostra: "1.234,5". */
export function formatarDaConta(valor: number): string {
  return formato.format(valor)
}

/** Tira o ruído do ponto flutuante e o "-0". Recusa o que não é número. */
function limpar(valor: number): number {
  if (!Number.isFinite(valor) || Math.abs(valor) > VALOR_DA_CONTA_MAX) throw new ErroDaConta('Número grande demais')
  return Math.round(valor * CASAS_GUARDADAS) / CASAS_GUARDADAS || 0
}

const SINAIS: Readonly<Record<string, Operador>> = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/' }
const MILHAR_COM_DECIMAL = /^\d{1,3}(?:\.\d{3})+$/
const MILHAR_SOZINHO = /^[1-9]\d{0,2}(?:\.\d{3})+$/
const DECIMAL_COM_PONTO = /^\d+\.\d+$/
const SO_DIGITOS = /^\d+$/

/** "1.000" = 1000; "1.5" = 1,5; "1.000,5" = 1000,5; "1,5" = 1,5. */
function lerNumero(bruto: string): number {
  const partes = bruto.split(',')
  const [inteira = '', decimal, sobra] = partes
  if (sobra !== undefined) throw new ErroDaConta(`Vírgula demais em "${bruto}"`)
  if (decimal !== undefined) {
    if (!SO_DIGITOS.test(decimal) || !(SO_DIGITOS.test(inteira) || MILHAR_COM_DECIMAL.test(inteira))) throw new ErroDaConta(`Não entendi o número "${bruto}"`)
    return Number(`${inteira.replaceAll('.', '')}.${decimal}`)
  }
  if (MILHAR_SOZINHO.test(inteira)) return Number(inteira.replaceAll('.', ''))
  if (SO_DIGITOS.test(inteira) || DECIMAL_COM_PONTO.test(inteira)) return Number(inteira)
  throw new ErroDaConta(`Não entendi o número "${bruto}"`)
}

const DIGITO = /\d/
const PEDACO_DE_NUMERO = /[\d.,]/
const ESPACO = /\s/
const LETRA = /\p{L}/u

/** O texto em pedaços: números, sinais, parênteses, "%" e a palavra "de" ("x" é vezes). */
function emPedacos(texto: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < texto.length) {
    const letra = texto.charAt(i)
    if (ESPACO.test(letra)) {
      i += 1
      continue
    }
    if (DIGITO.test(letra)) {
      let fim = i
      while (fim < texto.length && PEDACO_DE_NUMERO.test(texto.charAt(fim))) fim += 1
      tokens.push({ tipo: 'numero', valor: lerNumero(texto.slice(i, fim)) })
      i = fim
      continue
    }
    if (LETRA.test(letra)) {
      let fim = i
      while (fim < texto.length && LETRA.test(texto.charAt(fim))) fim += 1
      const palavra = texto.slice(i, fim).toLocaleLowerCase('pt-BR')
      if (palavra === 'de') tokens.push({ tipo: 'de' })
      else if (palavra === 'x') tokens.push({ tipo: 'operador', operador: '*' })
      else throw new ErroDaConta(`Não entendi "${texto.slice(i, fim)}"`)
      i = fim
      continue
    }
    const operador = SINAIS[letra]
    if (operador !== undefined) tokens.push({ tipo: 'operador', operador })
    else if (letra === '(') tokens.push({ tipo: 'abre' })
    else if (letra === ')') tokens.push({ tipo: 'fecha' })
    else if (letra === '%') tokens.push({ tipo: 'porcento' })
    else if (letra === ',' || letra === '.') throw new ErroDaConta('Número começando com vírgula: escreva 0,5')
    else throw new ErroDaConta(`Não entendi "${letra}"`)
    i += 1
  }
  return tokens
}

/** "X%" vira fração (0,X); o resto fica como está. */
function comoNumero(parcial: Parcial): number {
  return parcial.porcento ? limpar(parcial.valor / CEM) : parcial.valor
}

/** A conta inteira, pedaço a pedaço. Gramática: soma := produto (± produto)*; produto := sinal (× ÷ de sinal)*; sinal := ± sinal | base %?; base := número | ( soma ). */
function resolver(tokens: readonly Token[]): Parcial {
  let posicao = 0
  let profundidade = 0
  const espiar = (): Token | undefined => tokens[posicao]

  const descer = (): void => {
    profundidade += 1
    if (profundidade > PROFUNDIDADE_DA_CONTA_MAX) throw new ErroDaConta('Parênteses demais')
  }

  const soma = (): Parcial => {
    let esquerda = produto()
    for (let token = espiar(); token?.tipo === 'operador' && (token.operador === '+' || token.operador === '-'); token = espiar()) {
      posicao += 1
      const direita = produto()
      const sinal = token.operador === '+' ? 1 : -1
      const base = comoNumero(esquerda)
      if (direita.porcento) {
        // "200 + 15%": 15% DE 200, somado.
        const parte = limpar((base * direita.valor) / CEM)
        esquerda = { valor: limpar(base + sinal * parte), texto: `${esquerda.texto} ${token.operador} ${direita.texto} (${formatarDaConta(parte)})`, porcento: false }
      } else {
        esquerda = { valor: limpar(base + sinal * direita.valor), texto: `${esquerda.texto} ${token.operador} ${direita.texto}`, porcento: false }
      }
    }
    return esquerda
  }

  const produto = (): Parcial => {
    let esquerda = comSinal()
    for (let token = espiar(); token?.tipo === 'de' || (token?.tipo === 'operador' && (token.operador === '*' || token.operador === '/')); token = espiar()) {
      posicao += 1
      if (token.tipo === 'de' && !esquerda.porcento) throw new ErroDaConta('Use "de" depois de uma porcentagem: 10% de 900')
      const direita = comSinal()
      const a = comoNumero(esquerda)
      const b = comoNumero(direita)
      if (token.tipo === 'operador' && token.operador === '/') {
        if (b === 0) throw new ErroDaConta('Divisão por zero')
        esquerda = { valor: limpar(a / b), texto: `${esquerda.texto} ÷ ${direita.texto}`, porcento: false }
      } else {
        esquerda = { valor: limpar(a * b), texto: `${esquerda.texto} ${token.tipo === 'de' ? 'de' : '×'} ${direita.texto}`, porcento: false }
      }
    }
    return esquerda
  }

  const comSinal = (): Parcial => {
    const token = espiar()
    if (token?.tipo === 'operador' && (token.operador === '-' || token.operador === '+')) {
      posicao += 1
      descer()
      const dentro = comSinal()
      profundidade -= 1
      return token.operador === '-' ? { valor: -dentro.valor || 0, texto: `-${dentro.texto}`, porcento: dentro.porcento } : dentro
    }
    const base = numeroOuParenteses()
    if (espiar()?.tipo !== 'porcento') return base
    posicao += 1
    if (base.porcento || espiar()?.tipo === 'porcento') throw new ErroDaConta('Um "%" só por número')
    return { valor: base.valor, texto: `${base.texto}%`, porcento: true }
  }

  const numeroOuParenteses = (): Parcial => {
    const token = espiar()
    if (token?.tipo === 'numero') {
      posicao += 1
      return { valor: limpar(token.valor), texto: formatarDaConta(token.valor), porcento: false }
    }
    if (token?.tipo === 'abre') {
      posicao += 1
      descer()
      const dentro = soma()
      profundidade -= 1
      if (espiar()?.tipo !== 'fecha') throw new ErroDaConta('Falta fechar o parêntese')
      posicao += 1
      // "(15%)" continua sendo porcentagem: o parêntese não muda a regra.
      return { valor: dentro.valor, texto: `(${dentro.texto})`, porcento: dentro.porcento }
    }
    if (token === undefined) throw new ErroDaConta('A conta termina sem número')
    if (token.tipo === 'fecha') throw new ErroDaConta('Parêntese fechando sem abrir')
    throw new ErroDaConta('Falta um número')
  }

  const conta = soma()
  const sobra = espiar()
  if (sobra !== undefined) throw new ErroDaConta(sobra.tipo === 'fecha' ? 'Parêntese fechando sem abrir' : 'Falta um sinal entre os números')
  return conta
}

/**
 * A conta do jogador: "200 + 15%" = 230, passos "200 + 15% (30) = 230";
 * "10% de 900" = 90; "900 x 10%" = 90; "200 - 10%" = 180; "50%" = 0,5.
 * Erro (texto vazio, longo demais, sinal sobrando, divisão por zero): `ok:
 * false` com a frase para a tela.
 */
export function calcular(texto: string): ResultadoDaConta {
  if (texto.length > CONTA_MAX) return { ok: false, motivo: `Conta longa demais (até ${CONTA_MAX} letras)` }
  if (texto.trim() === '') return { ok: false, motivo: 'Escreva uma conta' }
  try {
    const conta = resolver(emPedacos(texto))
    const valor = comoNumero(conta)
    return { ok: true, valor, passos: `${conta.texto} = ${formatarDaConta(valor)}` }
  } catch (erro) {
    if (erro instanceof ErroDaConta) return { ok: false, motivo: erro.message }
    throw erro
  }
}

/** O resultado da conta como dano: inteiro PARA BAIXO (como todo dano do jogo), nunca negativo, até `DANO_MAX`. Ex.: 230,9 = 230; -5 = 0. */
export function arredondarParaDano(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  const limpo = Math.round(valor * CASAS_GUARDADAS) / CASAS_GUARDADAS
  return Math.min(DANO_MAX, Math.max(0, Math.floor(limpo)))
}
