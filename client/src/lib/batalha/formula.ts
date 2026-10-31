import { atributoComposto } from '../ajusteDaFicha'
import { FORCA_PADRAO, aplicarForca, forcaDe, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'

/**
 * O DANO DA FICHA, F2 (seção 3.2 de docs/planos/batalha-one-piece-f2-plano.md):
 * a fórmula livre do cartão ("(Força + 20) + Dano da Arma") vira número com a
 * conta ao lado. Gramática pequena, descida recursiva, SEM `eval`:
 *
 *   soma    := produto (("+" | "-") produto)*
 *   produto := unario (("*" | "x" | "×" | "/") unario)*
 *   unario  := "-" unario | primario
 *   primario:= (numero | variavel | "(" soma ")") enfeite*
 *
 * Variáveis (sem acento e sem caixa): o nome ou a abreviação de cada atributo
 * do sistema (o TOTAL, `atributoComposto`), e "dano da arma", "dano de arma"
 * ou "arma" (o campo Dano da arma, lido pela mesma gramática, sem arma
 * dentro), e "dano da bala" (o dano da bala escolhida na mira; 0 sem bala).
 * Enfeite depois de número ou variável: "de dano", "de dano base",
 * "dano", "base", "pontos"; "de" + palavra desconhecida vira rótulo da conta
 * ("50 de queimadura" = "50 queimadura"). Qualquer outra palavra, dado
 * ("1d6") ou sobra = `naoEntende`: leitura errada é pior que vazia (R3).
 *
 * Antes da gramática: sai a pontuação final ("30 de dano." , "base;") e o
 * rótulo "Dano:" / "Dano 1:"; com várias partes rotuladas na mesma célula,
 * lê só a primeira e avisa (`aviso`). Texto antes do primeiro rótulo = não lê.
 * Atalho antes da gramática: "N% de/da vida/HP (atual/máxima) do alvo".
 * Resultado arredondado para BAIXO, nunca negativo.
 *
 * Puro: sem store, sem rede.
 */

export interface ContextoDaFormula {
  personagem: Personagem
  sistema: SistemaDeRpg
  /** A arma escolhida para o golpe; `null` = nenhuma. */
  arma: CartaoDaFicha | null
  /** A vida do alvo, quando quem calcula pode vê-la; `null` = não sabe (o jogador nunca vê a do NPC). */
  vidaDoAlvo: { atual: number; maximo: number } | null
  /**
   * A bala escolhida na mira (`BalaDaArma`, só nome e dano). No Atacar
   * (`danoDoAtaque`) muda o "Dano da arma". Numa fórmula que diz "Dano da
   * Bala" (tipos de habilidade F1), é o número da bala ("+15" = 15) e o "Dano
   * da arma" fica o da arma sozinha. Ausente ou `null` = sem bala especial
   * ("Dano da Bala" = 0).
   */
  bala?: { nome: string; dano: string } | null
}

export type LeituraDoDano =
  /** "-": habilidade de suporte. */
  | { tipo: 'semDano' }
  /**
   * "(160 Força + 20) + 8 Gram = 188". `aviso` = a leitura deixou algo de
   * fora que a pessoa precisa saber (a célula com "Dano 1:" e "Dano 2:" leu
   * só o primeiro).
   */
  | { tipo: 'valor'; valor: number; conta: string; aviso?: string }
  /** Fala de "Dano da Arma" e não há arma escolhida. */
  | { tipo: 'precisaArma'; conta: string }
  /** "% da vida do alvo" sem a vida do alvo conhecida. */
  | { tipo: 'precisaAlvo' }
  /** Campo vazio ou fora da gramática: digita à mão. */
  | { tipo: 'naoEntende'; texto: string }

/** O campo Dano dos cartões (técnica e arma). */
export const CAMPO_DO_DANO = 'dano'
/** Q2: o dano do Atacar com arma. Sem arma, só a Força. */
export const FORMULA_DO_ATAQUE = 'Força + Dano da arma'
const FORMULA_DO_ATAQUE_SEM_ARMA = 'Força'
/** Fórmula mais comprida que isto não é fórmula: é descrição. */
const FORMULA_MAX = 200

/** Minúsculas, sem acento, espaços juntados. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

type Token = { tipo: 'numero'; valor: number; texto: string } | { tipo: 'op'; op: '+' | '-' | '*' | '/' | '(' | ')' } | { tipo: 'palavra'; texto: string; chave: string }

const OPERADORES: Readonly<Record<string, '+' | '-' | '*' | '/' | '(' | ')'>> = { '+': '+', '-': '-', '*': '*', '×': '*', '/': '/', '(': '(', ')': ')' }
const NUMERO = /^\d+(?:[.,]\d+)?/
const PALAVRA = /^\p{L}+/u
/** "1.000" pode ser mil ou um: na dúvida, não entende. */
const MILHAR_AMBIGUO = /^\d+\.\d{3}$/

/** Os tokens do texto; `null` = caractere que a gramática não conhece. */
function tokens(texto: string): Token[] | null {
  const lista: Token[] = []
  let resto = texto.trim()
  while (resto.length > 0) {
    const espacos = /^\s+/.exec(resto)
    if (espacos !== null) {
      resto = resto.slice(espacos[0].length)
      continue
    }
    const op = OPERADORES[resto.charAt(0)]
    if (op !== undefined) {
      lista.push({ tipo: 'op', op })
      resto = resto.slice(1)
      continue
    }
    const numero = NUMERO.exec(resto)
    if (numero !== null) {
      if (MILHAR_AMBIGUO.test(numero[0])) return null
      lista.push({ tipo: 'numero', valor: Number.parseFloat(numero[0].replace(',', '.')), texto: numero[0] })
      resto = resto.slice(numero[0].length)
      continue
    }
    const palavra = PALAVRA.exec(resto)
    if (palavra !== null) {
      lista.push({ tipo: 'palavra', texto: palavra[0], chave: normalizar(palavra[0]) })
      resto = resto.slice(palavra[0].length)
      continue
    }
    return null
  }
  return lista
}

/** Um pedaço já calculado: o número e como ele aparece na conta. */
interface Parcial {
  valor: number
  conta: string
}

/** Erro de leitura que sobe até `lerDano` e vira a saída. */
type Falha = { tipo: 'naoEntende' } | { tipo: 'precisaArma' }

const ENFEITES: ReadonlySet<string> = new Set(['dano', 'base', 'pontos', 'extra'])

function formatarNumero(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : String(valor).replace('.', ',')
}

/** "dano da bala", "dano de bala", "dano do bala" a partir do token `i`. */
function ehDanoDaBala(lista: readonly Token[], i: number): boolean {
  const [primeira, segunda, terceira] = [lista[i], lista[i + 1], lista[i + 2]]
  return (
    primeira?.tipo === 'palavra' &&
    primeira.chave === 'dano' &&
    segunda?.tipo === 'palavra' &&
    (segunda.chave === 'da' || segunda.chave === 'de' || segunda.chave === 'do') &&
    terceira?.tipo === 'palavra' &&
    terceira.chave === 'bala'
  )
}

/** A fórmula fala do "Dano da Bala"? A tela usa para oferecer a escolha da bala também na técnica. */
export function formulaUsaBala(texto: string): boolean {
  const lista = tokens(semPontuacaoFinal(texto))
  return lista !== null && lista.some((_, i) => ehDanoDaBala(lista, i))
}

/** O leitor de uma fórmula. `arma` false = dentro do dano da arma (sem arma de novo). */
class Leitor {
  private i = 0
  falha: Falha | null = null
  /** A fórmula tem "Dano da Bala": então o "Dano da arma" não soma a bala de novo. */
  private readonly falaDaBala: boolean

  constructor(
    private readonly lista: readonly Token[],
    private readonly ctx: ContextoDaFormula,
    private readonly podeArma: boolean,
  ) {
    this.falaDaBala = lista.some((_, i) => ehDanoDaBala(lista, i))
  }

  ler(): Parcial | null {
    const soma = this.soma()
    if (soma === null) return null
    if (this.i < this.lista.length) return this.falhar({ tipo: 'naoEntende' })
    return soma
  }

  private falhar(falha: Falha): null {
    // A primeira falha manda: "precisa de arma" não vira "não entende" no caminho de volta.
    if (this.falha === null) this.falha = falha
    return null
  }

  private olhar(deslocamento = 0): Token | undefined {
    return this.lista[this.i + deslocamento]
  }

  private ehOp(token: Token | undefined, ...ops: string[]): boolean {
    return token !== undefined && token.tipo === 'op' && ops.includes(token.op)
  }

  private soma(): Parcial | null {
    let esquerda = this.produto()
    if (esquerda === null) return null
    for (;;) {
      const token = this.olhar()
      if (!this.ehOp(token, '+', '-') || token === undefined || token.tipo !== 'op') return esquerda
      this.i += 1
      const direita = this.produto()
      if (direita === null) return null
      esquerda =
        token.op === '+'
          ? { valor: esquerda.valor + direita.valor, conta: `${esquerda.conta} + ${direita.conta}` }
          : { valor: esquerda.valor - direita.valor, conta: `${esquerda.conta} - ${direita.conta}` }
    }
  }

  /** O próximo token é de multiplicar ou dividir ("x" conta como vezes)? */
  private operadorDeProduto(): '*' | '/' | null {
    const token = this.olhar()
    if (token === undefined) return null
    if (token.tipo === 'op') return token.op === '*' || token.op === '/' ? token.op : null
    return token.tipo === 'palavra' && token.chave === 'x' ? '*' : null
  }

  private produto(): Parcial | null {
    let esquerda = this.unario()
    if (esquerda === null) return null
    for (;;) {
      const op = this.operadorDeProduto()
      if (op === null) return esquerda
      this.i += 1
      const direita = this.unario()
      if (direita === null) return null
      if (op === '/' && direita.valor === 0) return this.falhar({ tipo: 'naoEntende' })
      esquerda =
        op === '*'
          ? { valor: esquerda.valor * direita.valor, conta: `${esquerda.conta} × ${direita.conta}` }
          : { valor: esquerda.valor / direita.valor, conta: `${esquerda.conta} / ${direita.conta}` }
    }
  }

  private unario(): Parcial | null {
    if (this.ehOp(this.olhar(), '-')) {
      this.i += 1
      const dentro = this.unario()
      return dentro === null ? null : { valor: -dentro.valor, conta: `-${dentro.conta}` }
    }
    return this.primario()
  }

  private primario(): Parcial | null {
    const token = this.olhar()
    if (token === undefined) return this.falhar({ tipo: 'naoEntende' })
    let parcial: Parcial | null
    if (token.tipo === 'numero') {
      this.i += 1
      parcial = { valor: token.valor, conta: formatarNumero(token.valor) }
    } else if (token.tipo === 'op' && token.op === '(') {
      this.i += 1
      const dentro = this.soma()
      if (dentro === null) return null
      if (!this.ehOp(this.olhar(), ')')) return this.falhar({ tipo: 'naoEntende' })
      this.i += 1
      return { valor: dentro.valor, conta: `(${dentro.conta})` }
    } else if (token.tipo === 'palavra') {
      parcial = this.variavel()
    } else {
      return this.falhar({ tipo: 'naoEntende' })
    }
    return parcial === null ? null : this.enfeites(parcial)
  }

  /** "dano da arma", "dano de arma", "arma", "dano da bala", ou um atributo. */
  private variavel(): Parcial | null {
    const primeira = this.olhar()
    if (primeira === undefined || primeira.tipo !== 'palavra') return this.falhar({ tipo: 'naoEntende' })
    if (ehDanoDaBala(this.lista, this.i)) {
      this.i += 3
      return this.danoDaBala()
    }
    const segunda = this.olhar(1)
    const terceira = this.olhar(2)
    const ehDanoDaArma =
      primeira.chave === 'dano' &&
      segunda?.tipo === 'palavra' &&
      (segunda.chave === 'da' || segunda.chave === 'de' || segunda.chave === 'do') &&
      terceira?.tipo === 'palavra' &&
      terceira.chave === 'arma'
    if (ehDanoDaArma || primeira.chave === 'arma') {
      this.i += ehDanoDaArma ? 3 : 1
      return this.danoDaArma()
    }
    const atributo = this.ctx.sistema.atributos.find((candidato) => normalizar(candidato.nome) === primeira.chave || normalizar(candidato.abreviacao) === primeira.chave || candidato.id === primeira.chave)
    if (atributo === undefined) return this.falhar({ tipo: 'naoEntende' })
    this.i += 1
    const valor = atributoComposto(this.ctx.personagem, atributo.id).total
    return { valor, conta: `${formatarNumero(valor)} ${atributo.nome}` }
  }

  /**
   * O "Dano da arma". Com bala escolhida (`ctx.bala`): "+15" soma ao da arma
   * ("20 Rosa Fúnebre + 15 Bala de Prata"), "40" troca o da arma ("40 Bala
   * Explosiva"); bala sem dano = o da arma.
   */
  private danoDaArma(): Parcial | null {
    if (!this.podeArma) return this.falhar({ tipo: 'naoEntende' })
    const { arma } = this.ctx
    // Com "Dano da Bala" na mesma fórmula, a bala já entra por lá: aqui, só a arma.
    const bala = this.falaDaBala ? null : this.ctx.bala
    if (arma === null) return this.falhar({ tipo: 'precisaArma' })
    const nomeDaBala = bala === undefined || bala === null ? '' : bala.nome.trim() || 'Bala'
    const lista = bala === undefined || bala === null ? [] : tokens(semPontuacaoFinal(bala.dano))
    if (lista === null) return this.falhar({ tipo: 'naoEntende' })
    const [sinal, ...resto] = lista
    const daArma = (): Parcial | null => this.trecho(tokens(semPontuacaoFinal(arma.campos[CAMPO_DO_DANO] ?? '')), arma.nome.trim() || 'Arma')
    // Sem bala, bala sem dano, ou só "-"/"+": o dano da arma.
    if (sinal === undefined || (sinal.tipo === 'op' && (sinal.op === '+' || sinal.op === '-') && resto.length === 0)) return daArma()
    if (sinal.tipo !== 'op' || (sinal.op !== '+' && sinal.op !== '-')) return this.trecho(lista, nomeDaBala)
    const base = daArma()
    if (base === null) return null
    const somado = this.trecho(resto, nomeDaBala)
    if (somado === null) return null
    const valor = sinal.op === '+' ? somado.valor : -somado.valor
    return { valor: base.valor + valor, conta: `${base.conta} ${valor < 0 ? '-' : '+'} ${formatarNumero(Math.abs(valor))} ${nomeDaBala}` }
  }

  /**
   * O "Dano da Bala" (tipos de habilidade F1, resposta solta de 31/10): o
   * número da bala escolhida na mira, sem o sinal de soma ("+15" = "15 Bala de
   * Prata", "40" = "40 Bala Explosiva"). Sem bala especial, ou bala sem dano:
   * 0 ("0 sem bala"). Não precisa de arma.
   */
  private danoDaBala(): Parcial | null {
    if (!this.podeArma) return this.falhar({ tipo: 'naoEntende' })
    const { bala } = this.ctx
    const texto = bala === undefined || bala === null ? '' : semPontuacaoFinal(bala.dano).replace(/^\+\s*/u, '')
    if (bala === undefined || bala === null || texto.length === 0) return { valor: 0, conta: '0 sem bala' }
    return this.trecho(tokens(texto), bala.nome.trim() || 'Bala')
  }

  /** Um dano de cartão (arma ou bala), sem arma dentro: "20" vira "20 Rosa Fúnebre". */
  private trecho(lista: Token[] | null, rotulo: string): Parcial | null {
    if (lista === null || lista.length === 0) return this.falhar({ tipo: 'naoEntende' })
    const leitor = new Leitor(lista, this.ctx, false)
    const lido = leitor.ler()
    if (lido === null) return this.falhar(leitor.falha ?? { tipo: 'naoEntende' })
    return { valor: lido.valor, conta: `${formatarNumero(lido.valor)} ${rotulo}` }
  }

  /** Os enfeites depois de um número ou variável; "de" + palavra desconhecida vira rótulo. */
  private enfeites(parcial: Parcial): Parcial {
    let atual = parcial
    for (;;) {
      const token = this.olhar()
      if (token === undefined || token.tipo !== 'palavra') return atual
      if (ENFEITES.has(token.chave)) {
        this.i += 1
        continue
      }
      if (token.chave !== 'de') return atual
      const seguinte = this.olhar(1)
      if (seguinte === undefined || seguinte.tipo !== 'palavra') return atual
      if (ENFEITES.has(seguinte.chave)) {
        this.i += 1
        continue
      }
      // "de" + palavra que não é atributo nem arma: o rótulo ("50 de queimadura").
      if (seguinte.chave === 'arma' || seguinte.chave === 'x' || this.ctx.sistema.atributos.some((atributo) => normalizar(atributo.nome) === seguinte.chave || normalizar(atributo.abreviacao) === seguinte.chave)) return atual
      this.i += 2
      atual = { valor: atual.valor, conta: `${atual.conta} ${seguinte.texto}` }
    }
  }
}

const PORCENTAGEM_DA_VIDA = /^(\d+(?:[.,]\d+)?) ?% ?(?:(?:de|da|do) )?(?:vida|hp)(?: (atual|maxima|maximo|max))? (?:do|da) alvo$/

function lerPorcentagem(normal: string, ctx: ContextoDaFormula): LeituraDoDano | null {
  const achado = PORCENTAGEM_DA_VIDA.exec(normal)
  const numero = achado?.[1]
  if (achado === null || numero === undefined) return null
  if (ctx.vidaDoAlvo === null) return { tipo: 'precisaAlvo' }
  const porcento = Number.parseFloat(numero.replace(',', '.'))
  const maxima = achado[2] !== undefined && achado[2] !== 'atual'
  const vida = maxima ? ctx.vidaDoAlvo.maximo : ctx.vidaDoAlvo.atual
  const valor = Math.max(0, Math.floor((porcento * vida) / 100))
  return { tipo: 'valor', valor, conta: `${formatarNumero(porcento)}% de ${vida} = ${valor}` }
}

/**
 * MUNDO DO LIVRO (M1): a força do NPC de combate multiplica o dano que a
 * fórmula deu, com a conta à vista ("188 x1,5 = 282"). Só o mestre vê a
 * conta de NPC: NPC não vai ao jogador, e o fio tira a força (`paraOFio`).
 * Jogador e NPC sem marca têm força 1: a leitura sai como entrou.
 */
function comForca(leitura: LeituraDoDano, personagem: Personagem): LeituraDoDano {
  const forca = forcaDe(personagem)
  if (leitura.tipo !== 'valor' || forca === FORCA_PADRAO) return leitura
  const valor = aplicarForca(leitura.valor, forca)
  return { ...leitura, valor, conta: `${leitura.conta} x${formatarNumero(forca)} = ${valor}` }
}

/** Pontuação de fim de frase que a ficha costuma deixar: "30 de dano.", "45 de dano base;". */
const PONTUACAO_FINAL = /[\s.;!]+$/u

/** "Dano:", "Dano 1:", "dano 2 :" — o rótulo de uma parte da célula. */
const ROTULO_DO_DANO = /\bdano\s*(\d*)\s*:/giu

function semPontuacaoFinal(texto: string): string {
  return texto.replace(PONTUACAO_FINAL, '').trim()
}

/** O trecho que a gramática lê, e o aviso quando a célula tinha mais de uma parte rotulada. `null` = ambíguo. */
interface TrechoDoDano {
  texto: string
  aviso?: string
}

/**
 * Tira o rótulo "Dano N:" e a pontuação final. Com várias partes rotuladas
 * ("Dano 1: ... Dano 2: ..."), lê só a primeira e avisa. Texto antes do
 * primeiro rótulo ("Corte Dano 1: 20") é ambíguo: `null`.
 */
function trechoDoDano(texto: string): TrechoDoDano | null {
  const rotulos: RegExpExecArray[] = []
  const busca = new RegExp(ROTULO_DO_DANO)
  for (let achado = busca.exec(texto); achado !== null; achado = busca.exec(texto)) rotulos.push(achado)
  const [primeiro, segundo] = rotulos
  if (primeiro === undefined) return { texto: semPontuacaoFinal(texto) }
  if (texto.slice(0, primeiro.index).trim().length > 0) return null
  const fim = segundo === undefined ? texto.length : segundo.index
  // Entre uma parte e a seguinte a ficha põe "/", "|" ou ",": não é conta, é separador.
  const parte = semPontuacaoFinal(texto.slice(primeiro.index + primeiro[0].length, fim).replace(/[\s/|,]+$/u, ''))
  if (segundo === undefined) return { texto: parte }
  const nome = primeiro[1] === undefined || primeiro[1] === '' ? 'Dano' : `Dano ${primeiro[1]}`
  return { texto: parte, aviso: `A célula tem ${rotulos.length} partes de dano; lido só o "${nome}".` }
}

export function lerDano(texto: string, ctx: ContextoDaFormula): LeituraDoDano {
  return comForca(lerDanoSemForca(texto, ctx), ctx.personagem)
}

function lerDanoSemForca(texto: string, ctx: ContextoDaFormula): LeituraDoDano {
  const trecho = trechoDoDano(texto)
  if (trecho === null) return { tipo: 'naoEntende', texto }
  const lido = lerTrecho(trecho.texto, texto, ctx)
  return lido.tipo === 'valor' && trecho.aviso !== undefined ? { ...lido, aviso: trecho.aviso } : lido
}

function lerTrecho(limpo: string, texto: string, ctx: ContextoDaFormula): LeituraDoDano {
  const normal = normalizar(limpo)
  if (normal === '-') return { tipo: 'semDano' }
  if (normal.length === 0 || normal.length > FORMULA_MAX) return { tipo: 'naoEntende', texto }
  const porcentagem = lerPorcentagem(normal, ctx)
  if (porcentagem !== null) return porcentagem
  const lista = tokens(limpo)
  if (lista === null || lista.length === 0) return { tipo: 'naoEntende', texto }
  const leitor = new Leitor(lista, ctx, true)
  const lido = leitor.ler()
  if (lido === null) return leitor.falha?.tipo === 'precisaArma' ? { tipo: 'precisaArma', conta: limpo } : { tipo: 'naoEntende', texto }
  if (!Number.isFinite(lido.valor)) return { tipo: 'naoEntende', texto }
  const valor = Math.max(0, Math.floor(lido.valor))
  return { tipo: 'valor', valor, conta: `${lido.conta} = ${valor}` }
}

/**
 * Q2: o dano do Atacar: "Força + Dano da arma" (Balmung: "160 Força + 5 Balmung = 165"); sem arma, a Força. Editável sempre.
 * Com `bala` (a arma de fogo ou híbrida): "+15" soma ("160 Força + 20 Rosa Fúnebre + 15 Bala de Prata = 195"),
 * "40" troca o dano da arma ("160 Força + 40 Bala Explosiva = 200"); a força do NPC vale do mesmo jeito.
 */
export function danoDoAtaque(ctx: ContextoDaFormula, bala?: { nome: string; dano: string } | null): LeituraDoDano {
  const comBala = bala === undefined || bala === null || ctx.arma === null ? ctx : { ...ctx, bala }
  return lerDano(ctx.arma === null ? FORMULA_DO_ATAQUE_SEM_ARMA : FORMULA_DO_ATAQUE, comBala)
}
