import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { RecursoDoSistema, SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import { PERFURACAO_MAX, PERFURACAO_MIN, type AcaoDaTecnica } from './combate'
import { CAMPO_DO_DANO, normalizar } from './formula'

/**
 * LEITURA DA FICHA PARA A BATALHA, F2 (seção 3.1 de
 * docs/planos/batalha-one-piece-f2-plano.md): custo, ação, tempo, Overload,
 * Perfurante (Q4), armas e técnicas, lidos do texto livre dos cartões One
 * Piece. Leitura leve: minúsculas, sem acento, espaços juntados; "-" ou vazio
 * = nada. Na dúvida, "pergunta" (o jogador confirma na tela) — leitura errada
 * é pior que vazia.
 *
 * Puro: sem store, sem rede.
 */

/** A aba da ficha One Piece com as armas (`lib/sistemaOnePiece.ts`). */
export const ABA_DAS_ARMAS = 'armas'
/** A aba das técnicas (e a dos subcartões das transformações). */
export const ABA_DAS_TECNICAS = 'habilidades'
/** A escolha do sistema "Armas por batalha" ("1 arma" a "6 armas"; vazio = sem limite). */
export const ESCOLHA_DAS_ARMAS = 'armasPorBatalha'
/** O maior limite que a escolha oferece. */
export const LIMITE_DE_ARMAS_MAX = 6
/** Os campos da técnica que a batalha lê. */
export const CAMPO_DA_ACAO = 'acao'
export const CAMPO_DO_CUSTO = 'custo'
export const CAMPO_DO_TEMPO = 'tempo'
const NOME_DO_OVERLOAD = 'overload'

export type LeituraDoCusto =
  | { tipo: 'nada' }
  | { tipo: 'valor'; recurso: 'sp' | 'hp'; valor: number; porTurno: boolean }
  | { tipo: 'pergunta'; recurso: 'sp' | 'hp'; sugestao: number | null; texto: string }

export interface LeituraDaAcao {
  acao: AcaoDaTecnica | 'passiva' | null
  overload: boolean
  transformacao: boolean
  tambemReacao: boolean
  /**
   * Ação "Reação" sozinha (Passo de Valsa): não gasta ação da vez (`acao`
   * "livre") e só se usa na caixa REAÇÃO (`lerTipo` dá "reacao"). Ausente = não.
   */
  soReacao?: true
}

export type LeituraDoTempo = { tipo: 'livre' } | { tipo: 'recarga'; turnos: number } | { tipo: 'usos'; vezes: number } | { tipo: 'overload' } | { tipo: 'texto'; texto: string }

function vazio(normal: string): boolean {
  return normal.length === 0 || normal === '-'
}

/** "-35 de SP", "15SP", "35 SP", "45" (SP é a unidade padrão), "-15 (Por turno)", "20 HP". */
const CUSTO_SIMPLES = /^-? ?(\d+) ?(?:de )?(sp|hp)? ?(\( ?por turno ?\)|por turno)?$/
/** "10% do Hp..." (atual): a sugestão é a conta, a pessoa confirma. */
const CUSTO_EM_PORCENTAGEM = /(\d+(?:[.,]\d+)?) ?% ?(?:(?:de|da|do|dos|das) )?(hp|sp|vida)/

/** O custo do cartão. Uma conta que a leitura não fecha vira pergunta, com o texto da ficha ao lado. */
export function lerCusto(texto: string, personagem: Personagem): LeituraDoCusto {
  const normal = normalizar(texto)
  if (vazio(normal)) return { tipo: 'nada' }
  const simples = CUSTO_SIMPLES.exec(normal)
  const numero = simples?.[1]
  if (simples !== null && numero !== undefined) {
    return { tipo: 'valor', recurso: simples[2] === 'hp' ? 'hp' : 'sp', valor: Number.parseInt(numero, 10), porTurno: simples[3] !== undefined }
  }
  const porcentagem = CUSTO_EM_PORCENTAGEM.exec(normal)
  const porcento = porcentagem?.[1]
  // Só a porcentagem sozinha vira sugestão: "10% do HP + 20 SP" é conta demais para adivinhar.
  if (porcentagem !== null && porcento !== undefined && !/[+]/.test(normal)) {
    const recurso = porcentagem[2] === 'sp' ? 'sp' : 'hp'
    const atual = numeroDaFicha(personagem.recursos, recurso)
    return { tipo: 'pergunta', recurso, sugestao: Math.floor((Number.parseFloat(porcento.replace(',', '.')) * atual) / 100), texto }
  }
  const falaDeVida = /\b(hp|vida)\b/.test(normal) && !/\bsp\b/.test(normal)
  return { tipo: 'pergunta', recurso: falaDeVida ? 'hp' : 'sp', sugestao: null, texto }
}

/** "Ação Simples", "Completa", "Bônus", "Livre", "Reação/Ação Completa", "OVERLOAD | TRANSFORMAÇÃO", "Passiva...", "Reação" (livre, `soReacao`). */
export function lerAcao(texto: string): LeituraDaAcao {
  const normal = normalizar(texto)
  const leitura: LeituraDaAcao = { acao: null, overload: false, transformacao: false, tambemReacao: false }
  if (vazio(normal)) return leitura
  if (normal.startsWith('passiva')) return { ...leitura, acao: 'passiva' }
  for (const parte of normal.split(/[|/]/)) {
    const pedaco = parte.trim().replace(/^acao /, '')
    if (pedaco === 'overload') leitura.overload = true
    else if (pedaco === 'transformacao') leitura.transformacao = true
    else if (pedaco === 'reacao') leitura.tambemReacao = true
    else if (leitura.acao === null) {
      if (pedaco === 'simples') leitura.acao = 'simples'
      else if (pedaco === 'completa') leitura.acao = 'completa'
      else if (pedaco === 'bonus') leitura.acao = 'bonus'
      else if (pedaco === 'livre') leitura.acao = 'livre'
    }
  }
  // Overload e Transformação sem ação escrita gastam a vez inteira.
  if (leitura.acao === null && (leitura.overload || leitura.transformacao)) leitura.acao = 'completa'
  // "Reação" sozinha: não gasta ação da vez (decisão 8 do plano dos tipos de habilidade).
  if (leitura.acao === null && leitura.tambemReacao) return { ...leitura, acao: 'livre', soReacao: true }
  return leitura
}

const TEMPO_EM_TURNOS = /^(\d+)(?: ?turnos?)?$/
const TEMPO_EM_USOS = /^(\d+) ?vez(?:es)? ?(?:por|na|no|em|a cada) ?(?:combate|batalha|luta)$/

/** "1" a "5", "3 turnos" (recarga); "2 Vezes por Combate", "1 vez na batalha" (usos); "OVERLOAD"; o resto aparece como texto. */
export function lerTempo(texto: string): LeituraDoTempo {
  const normal = normalizar(texto)
  if (vazio(normal)) return { tipo: 'livre' }
  if (normal === NOME_DO_OVERLOAD) return { tipo: 'overload' }
  const turnos = TEMPO_EM_TURNOS.exec(normal)?.[1]
  if (turnos !== undefined) {
    const numero = Number.parseInt(turnos, 10)
    return numero >= 1 ? { tipo: 'recarga', turnos: numero } : { tipo: 'livre' }
  }
  const usos = TEMPO_EM_USOS.exec(normal)?.[1]
  if (usos !== undefined) {
    const numero = Number.parseInt(usos, 10)
    return numero >= 1 ? { tipo: 'usos', vezes: numero } : { tipo: 'texto', texto }
  }
  return { tipo: 'texto', texto }
}

/** Ação, tempo ou extra de NOME "OVERLOAD". */
export function ehOverload(cartao: CartaoDaFicha): boolean {
  if (lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '').overload) return true
  if (lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? '').tipo === 'overload') return true
  return cartao.extras.some((extra) => normalizar(extra.nome) === NOME_DO_OVERLOAD)
}

const SINAIS_DE_PERFURANTE = [/perfura/, /ignora\w* (?:a |as )?armadura/, /diret[oa] (?:na|no|a|ao) (?:vida|hp)/]

/**
 * Q4: o golpe é PERFURANTE (dano direto ao HP, sem gastar o Escudo) quando a
 * habilidade diz ("perfurante", "ignorando armaduras", "direto na vida"). É o
 * valor inicial do interruptor; quem ataca e o mestre podem trocar.
 */
export function ehPerfurante(cartao: CartaoDaFicha): boolean {
  const textos = [...Object.values(cartao.campos), ...cartao.extras.flatMap((extra) => [extra.nome, extra.valor])]
  return textos.some((texto) => {
    const normal = normalizar(texto)
    return SINAIS_DE_PERFURANTE.some((sinal) => sinal.test(normal))
  })
}

/** "perfura 50%", "perfurante de 50 %"; e "50% perfurante", "50% de perfuração". */
const SINAIS_DA_PERFURACAO = [/perfura\w*\s*(?:de\s*|em\s*)?(\d{1,3})\s*%/, /(\d{1,3})\s*%\s*(?:de\s*)?perfura/]

/**
 * A porcentagem que a habilidade diz que perfura ("perfura 50%", "50%
 * perfurante"), de 1 a 100; `null` = não diz (o Perfurante, se ligado, é
 * 100%). É a sugestão inicial da mira; quem ataca e o mestre podem trocar.
 */
export function perfuracaoDe(cartao: CartaoDaFicha): number | null {
  const textos = [...Object.values(cartao.campos), ...cartao.extras.flatMap((extra) => [extra.nome, extra.valor])]
  for (const texto of textos) {
    const normal = normalizar(texto)
    for (const sinal of SINAIS_DA_PERFURACAO) {
      const numero = Number(sinal.exec(normal)?.[1])
      if (Number.isInteger(numero) && numero >= PERFURACAO_MIN && numero <= PERFURACAO_MAX) return numero
    }
  }
  return null
}

/** Uma técnica e, se vem de transformação ligada, o nome da forma. */
export interface TecnicaDaFicha {
  cartao: CartaoDaFicha
  forma?: string
}

/** As técnicas com a forma de onde vêm: Habilidades, depois os subcartões das transformações LIGADAS. */
export function tecnicasComForma(personagem: Personagem, sistema: SistemaDeRpg): TecnicaDaFicha[] {
  const tecnicas: TecnicaDaFicha[] = (personagem.abas[ABA_DAS_TECNICAS] ?? []).map((cartao) => ({ cartao }))
  for (const aba of sistema.abas) {
    if (aba.subcartoes?.aba !== ABA_DAS_TECNICAS) continue
    for (const forma of personagem.abas[aba.id] ?? []) {
      if (!personagem.cartoesAtivos.includes(forma.id)) continue
      for (const cartao of forma.subcartoes) tecnicas.push({ cartao, forma: forma.nome })
    }
  }
  return tecnicas
}

/** As técnicas que o menu mostra: Habilidades + subcartões das transformações LIGADAS. */
export function tecnicasDe(personagem: Personagem, sistema: SistemaDeRpg): CartaoDaFicha[] {
  return tecnicasComForma(personagem, sistema).map((tecnica) => tecnica.cartao)
}

/** A técnica pelo id, entre as que valem agora. */
export function tecnicaPorId(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string): TecnicaDaFicha | null {
  return tecnicasComForma(personagem, sistema).find((tecnica) => tecnica.cartao.id === cartaoId) ?? null
}

/**
 * O recurso do sistema que o custo cobra: "hp" = o de vida (`recursoDeVida`);
 * "sp" = o de energia com atual e máximo (no One Piece, o SP). `null` = o
 * sistema não tem.
 */
export function recursoDoCusto(sistema: SistemaDeRpg, recurso: 'sp' | 'hp'): RecursoDoSistema | null {
  if (recurso === 'hp') return recursoDeVida(sistema)
  return sistema.recursos.find((candidato) => candidato.id === 'sp') ?? sistema.recursos.find((candidato) => candidato.tom === 'energia' && candidato.atualEMaximo === true) ?? null
}

/** O Escudo (Q4): o recurso de id ou nome "escudo". `null` = o sistema não tem. */
export function recursoDoEscudo(sistema: SistemaDeRpg): RecursoDoSistema | null {
  return sistema.recursos.find((candidato) => candidato.id === 'escudo' || normalizar(candidato.nome) === 'escudo') ?? null
}

/** O molde das balas: a aba dos subcartões "Tipos de bala" da arma (`lib/sistemaOnePiece.ts`). */
export const ABA_DAS_BALAS = 'balas'
/** Os campos da arma e da bala que a batalha lê. */
export const CAMPO_DA_CATEGORIA = 'categoria'
export const CAMPO_DA_CAPACIDADE = 'capacidade'
export const CAMPO_DO_EFEITO = 'efeito'
export const CAMPO_DA_QUANTIDADE = 'quantidade'

export type CategoriaDaArma = 'branca' | 'deFogo' | 'arremesso' | 'hibrida' | 'natural'

/** As categorias, na ordem da escolha do cartão, com o texto que a ficha guarda. */
export const CATEGORIAS_DE_ARMA: readonly { id: CategoriaDaArma; rotulo: string }[] = [
  { id: 'branca', rotulo: 'Branca' },
  { id: 'deFogo', rotulo: 'De fogo' },
  { id: 'arremesso', rotulo: 'Arremesso' },
  { id: 'hibrida', rotulo: 'Híbrida' },
  { id: 'natural', rotulo: 'Natural' },
]

/** As categorias que disparam: só nelas a Capacidade e as balas fazem sentido. */
const CATEGORIAS_QUE_ATIRAM: ReadonlySet<CategoriaDaArma> = new Set<CategoriaDaArma>(['deFogo', 'hibrida'])

/** Um tipo de bala da arma (subcartão "Tipos de bala"). Textos como a ficha guarda, aparados. */
export interface BalaDaArma {
  id: string
  /** Nunca vazio: "Bala sem nome" quando o cartão não tem. */
  nome: string
  /** "+15" = soma ao dano da arma; "40" = troca o dano da arma; vazio = o da arma. Lido por `danoDoAtaque`. */
  dano: string
  efeito: string
  /** Texto livre, só mostra: o app não conta tiros. */
  quantidade: string
}

/** A arma da aba Armas com o que a batalha lê dela. É o próprio cartão, mais as leituras. */
export interface ArmaDaFicha extends CartaoDaFicha {
  /** `null` = vazio ou texto fora da lista (mapas antigos: sem categoria). */
  categoria: CategoriaDaArma | null
  /** Texto livre ("6"), só mostra; vazio = `null`. */
  capacidade: string | null
  balas: BalaDaArma[]
}

export const BALA_SEM_NOME = 'Bala sem nome'

/** "Branca", "arma branca", "De fogo", "fogo", "de arremesso", "Hibrida"... `null` = vazio ou outra coisa. */
export function lerCategoria(texto: string): CategoriaDaArma | null {
  const normal = normalizar(texto).replace(/^arma /, '').replace(/^de /, '')
  if (normal === 'branca') return 'branca'
  if (normal === 'fogo') return 'deFogo'
  if (normal === 'arremesso') return 'arremesso'
  if (normal === 'hibrida') return 'hibrida'
  if (normal === 'natural') return 'natural'
  return null
}

/** A categoria dispara (De fogo, Híbrida)? É quando a tela mostra Capacidade e balas. */
export function categoriaAtira(categoria: CategoriaDaArma | null): boolean {
  return categoria !== null && CATEGORIAS_QUE_ATIRAM.has(categoria)
}

function balaDoCartao(cartao: CartaoDaFicha): BalaDaArma {
  return {
    id: cartao.id,
    nome: cartao.nome.trim() || BALA_SEM_NOME,
    dano: (cartao.campos[CAMPO_DO_DANO] ?? '').trim(),
    efeito: (cartao.campos[CAMPO_DO_EFEITO] ?? '').trim(),
    quantidade: (cartao.campos[CAMPO_DA_QUANTIDADE] ?? '').trim(),
  }
}

/** A arma lida: categoria, capacidade e os tipos de bala (subcartões), todos na ordem da ficha. */
export function lerArma(cartao: CartaoDaFicha): ArmaDaFicha {
  const capacidade = (cartao.campos[CAMPO_DA_CAPACIDADE] ?? '').trim()
  return {
    ...cartao,
    categoria: lerCategoria(cartao.campos[CAMPO_DA_CATEGORIA] ?? ''),
    capacidade: capacidade.length === 0 ? null : capacidade,
    balas: cartao.subcartoes.map(balaDoCartao),
  }
}

/**
 * As leituras guardadas pela lista da aba: a mesma lista de cartões devolve as
 * MESMAS armas, e a tela que compara por referência (memo, efeito) não vê
 * arma "nova" a cada desenho (antes das balas, `armasDe` devolvia a própria
 * lista da ficha). A lista devolvida é compartilhada: não a mude.
 */
const ARMAS_LIDAS = new WeakMap<readonly CartaoDaFicha[], ArmaDaFicha[]>()
const SEM_ARMAS: readonly CartaoDaFicha[] = []

/** Os cartões da aba Armas, cada um com categoria, capacidade e balas (`lerArma`). */
export function armasDe(personagem: Personagem): ArmaDaFicha[] {
  const cartoes = personagem.abas[ABA_DAS_ARMAS] ?? SEM_ARMAS
  const guardadas = ARMAS_LIDAS.get(cartoes)
  if (guardadas !== undefined) return guardadas
  const lidas = cartoes.map(lerArma)
  ARMAS_LIDAS.set(cartoes, lidas)
  return lidas
}

/** A bala da arma pelo id. `null` = a arma não tem essa bala. */
export function balaDaArma(arma: ArmaDaFicha, balaId: string): BalaDaArma | null {
  return arma.balas.find((bala) => bala.id === balaId) ?? null
}

/** O limite da escolha "Armas por batalha", pelo número do começo ("2 armas" = 2). Vazio ou torto = sem limite (`null`). */
export function limiteDeArmas(personagem: Personagem): number | null {
  const escolha = personagem.escolhas[ESCOLHA_DAS_ARMAS]
  if (escolha === undefined) return null
  const numero = /^\s*(\d+)/.exec(escolha)?.[1]
  if (numero === undefined) return null
  const limite = Number.parseInt(numero, 10)
  return limite >= 1 && limite <= LIMITE_DE_ARMAS_MAX ? limite : null
}
