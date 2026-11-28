import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { CarriedItem } from '../../types/map'
import type { RecursoDoSistema, SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import { PERFURACAO_MAX, PERFURACAO_MIN, type AcaoDaTecnica } from './combate'
import { ATAQUE_SEM_ATRIBUTO, CAMPO_DO_ATRIBUTO_DO_ATAQUE, CAMPO_DO_DANO, normalizar } from './formula'
import { municaoNaMochila, type MunicaoDaBala } from '../mochila/municao'
import { balasParaOPente, penteDaArma } from '../mochila/armaNaMochila'
import { quantidadeDe } from '../items'
import type { AtaqueDoItem, BlocosDoItem, PenteDaVaga, RecargaDoItem } from '../itens/modelo'
import { ACERVO_DA_BATALHA, municoesDaArma, nomeNoAcervo, regraNoAcervo, tiroDaMunicao, versaoDasMunicoes, type MunicaoAceita } from './municoesDoAcervo'
import { efeitosAoAcertar, temEfeitoAoAcertar, type EfeitosAoAcertar } from './aoAcertarDoItem'

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

/**
 * Conserto das fichas F1 (P1 do grilling): "Tempo N" bloqueia N VEZES do dono
 * (Tempo 3: usa na vez 1, bloqueada na 2, 3 e 4, usa na 5). A recarga desce no
 * começo de cada vez do dono, então guarda N + 1 ao usar (`RECARGA_A_MAIS`).
 */
export const RECARGA_A_MAIS = 1

/**
 * As vezes de recarga que a tela mostra: as que ainda vão ficar bloqueadas
 * (na vez do uso, o "+1" guardado ainda não desceu). Sem a leitura do Tempo,
 * o número guardado.
 */
export function vezesDeRecarga(guardada: number, tempo: LeituraDoTempo | null): number {
  return tempo !== null && tempo.tipo === 'recarga' ? Math.min(guardada, tempo.turnos) : guardada
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
  /** Texto livre, só mostra. Com `municao`, deixa de valer: quem conta é a mochila. */
  quantidade: string
  /** O item de munição do Acervo a que o tipo de bala se liga (o `itemId` do subcartão); ausente = pelo nome. */
  itemId?: string
  /**
   * MUNIÇÃO (pedido de 16/11/2026): a bala ligada a uma vaga da mochila da
   * ficha (`municaoNaMochila`). O tiro com ela gasta 1, e com 0 não sai.
   * Ausente = bala só de texto, como antes.
   */
  municao?: MunicaoDaBala
  /**
   * ITENS REFEITOS, E6c: o "Ao acertar" da bala do pente (a Bala de Prata: Cura reduzida 50% até o fim
   * da batalha), do Acervo de agora ou da `regra` da vaga dela. Ausente = a bala não faz nada além do dano.
   */
  aoAcertar?: EfeitosAoAcertar
  /** Pedido de 26/11: a bala do pente é perfurante (o bloco `bala` do item); a mira já abre com o Perfurante ligado. */
  perfurante?: true
}

/** A arma da aba Armas com o que a batalha lê dela. É o próprio cartão, mais as leituras. */
export interface ArmaDaFicha extends CartaoDaFicha {
  /** `null` = vazio ou texto fora da lista (mapas antigos: sem categoria). */
  categoria: CategoriaDaArma | null
  /** Texto livre ("6"), só mostra; vazio = `null`. */
  capacidade: string | null
  balas: BalaDaArma[]
  /**
   * MUNIÇÃO: a arma do Acervo declara as munições que aceita (`municoes`).
   * Ela só atira gastando uma: sem a bala escolhida, vai a primeira que a
   * mochila tem (`balaDoPedido`); sem nenhuma, o tiro não sai.
   */
  exigeMunicao?: true
  /**
   * ITENS REFEITOS, E6a: a arma equipada com pente (De fogo, o tiro da Híbrida). O tiro gasta do
   * pente; zerado, a mesa recarrega da mochila (`stores/batalha/recargaDoPente.ts`). Ausente = sem pente.
   */
  pente?: PenteDaArmaNaBatalha
  /**
   * ITENS REFEITOS, E6b (decisão 7): a arma de Arremesso equipada. Sem `volta`, cada um jogado sai da
   * vaga (o Desfazer devolve) e o "Tempo de recarga" é a espera até o próximo estar na mão; com `volta`
   * (o boomerang), não sai e fica fora da mão até o começo da próxima vez de quem jogou
   * (`stores/batalha/arremessoNaMesa.ts`). Ausente = não é arremesso.
   */
  arremesso?: ArremessoDaArmaNaBatalha
  /**
   * ITENS REFEITOS, E6c: o "Ao acertar" da arma equipada (condição, Dano extra que conta, empurrão), do
   * Acervo de agora ou da `regra` da vaga. Ausente = só o dano.
   */
  aoAcertar?: EfeitosAoAcertar
}

/** O arremesso equipado como a batalha o lê. */
export interface ArremessoDaArmaNaBatalha {
  /** A vaga da pilha na mochila (de onde sai o que é jogado). */
  vagaId: string
  /** O boomerang: volta para a mão e não se gasta. */
  volta: boolean
  /** A ação que pôr o próximo na mão gasta e quantas rodadas leva (para o boomerang, quando volta). */
  recarga: RecargaDoItem
  /** Quantos a pilha tem agora. */
  quantos: number
}

/** O pente da arma equipada como a batalha o lê. */
export interface PenteDaArmaNaBatalha {
  /** A vaga da arma na mochila (onde mora o pente). */
  vagaId: string
  capacidade: number
  /** As do pente agora; 0 = vazio. */
  n: number
  /** A bala do pente; ausente = vazio. */
  balaId?: string
  /** A ação que a recarga gasta e em quantas rodadas a arma fica pronta (decisão 3). */
  recarga: RecargaDoItem
  /** As balas que a arma aceita na mochila, fora do pente. */
  naMochila: number
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

function balaDoCartao(cartao: CartaoDaFicha, mochila: readonly CarriedItem[]): BalaDaArma {
  const nome = cartao.nome.trim() || BALA_SEM_NOME
  // A bala sem nome não casa com vaga nenhuma pelo nome ("Bala sem nome" seria um item de verdade por acaso).
  const municao = cartao.nome.trim() === '' && cartao.itemId === undefined ? undefined : municaoNaMochila(mochila, nome, cartao.itemId, cartao.municaoPeloNome === true)
  // Fonte única (25/11): o tiro do item do Acervo vence; o subcartão fica de reserva (o app do jogador, o item que não declara).
  const tiro = tiroDaMunicao(cartao.itemId)
  return {
    id: cartao.id,
    nome,
    dano: tiro?.dano || (cartao.campos[CAMPO_DO_DANO] ?? '').trim(),
    efeito: tiro?.efeito || (cartao.campos[CAMPO_DO_EFEITO] ?? '').trim(),
    quantidade: (cartao.campos[CAMPO_DA_QUANTIDADE] ?? '').trim(),
    ...(cartao.itemId === undefined ? {} : { itemId: cartao.itemId }),
    ...(municao === undefined ? {} : { municao }),
  }
}

/**
 * A arma lida: categoria, capacidade e os tipos de bala (subcartões), todos na
 * ordem da ficha. `mochila` = a da ficha: a bala ligada a uma vaga conta dela
 * (`BalaDaArma.municao`); sem ela, nenhuma bala é ligada.
 */
export function lerArma(cartao: CartaoDaFicha, mochila: readonly CarriedItem[] = []): ArmaDaFicha {
  const capacidade = (cartao.campos[CAMPO_DA_CAPACIDADE] ?? '').trim()
  const doCartao = cartao.subcartoes.map((bala) => balaDoCartao(bala, mochila))
  // MUNIÇÃO: a arma do Acervo (o cartão ligado a ela, ou a da mochila) traz as munições que aceita, menos as que um tipo de bala já cobre.
  // A lista da vaga vem primeiro (é a que o jogador também tem); o Acervo de agora só vale para a vaga dada antes dela existir.
  const aceitas = municoesDaVagaDaArma(cartao, mochila) ?? municoesDaArma(cartao.itemId)
  const cobertas = new Set(doCartao.flatMap((bala) => [bala.itemId, bala.municao?.itemId]))
  const doAcervo = aceitas.filter((municao) => !cobertas.has(municao.itemId)).map((municao) => balaDaMunicaoAceita(municao, mochila))
  return {
    ...cartao,
    categoria: lerCategoria(cartao.campos[CAMPO_DA_CATEGORIA] ?? ''),
    capacidade: capacidade.length === 0 ? null : capacidade,
    balas: [...doCartao, ...doAcervo],
    ...(aceitas.length > 0 ? { exigeMunicao: true as const } : {}),
  }
}

/**
 * As munições que a VAGA da arma declara (`CarriedItem.municoes`): a vaga da
 * própria arma da mochila (`mochila:<vaga>`), ou a primeira vaga do mesmo
 * item do Acervo que declara alguma (o cartão da aba Armas ligado à coisa).
 * `undefined` = nenhuma vaga declara (a vaga antiga): quem lê cai no Acervo.
 */
function municoesDaVagaDaArma(cartao: CartaoDaFicha, mochila: readonly CarriedItem[]): readonly MunicaoAceita[] | undefined {
  const vagaId = cartao.id.startsWith(PREFIXO_DA_ARMA_DA_MOCHILA) ? cartao.id.slice(PREFIXO_DA_ARMA_DA_MOCHILA.length) : undefined
  const daVaga = vagaId === undefined ? undefined : mochila.find((vaga) => vaga.id === vagaId)?.municoes
  if (daVaga !== undefined) return daVaga
  const itemId = cartao.itemId
  return itemId === undefined ? undefined : mochila.find((vaga) => vaga.itemId === itemId && vaga.municoes !== undefined)?.municoes
}

/** O id da bala que vem da munição do Acervo: `municao:<id do item>`; nunca colide com o id de um subcartão (sem dois-pontos). */
export const PREFIXO_DA_MUNICAO = 'municao:'

/** A munição do Acervo como bala da arma: o dano e o efeito são os do item (sem eles, o da arma), e a quantidade é a da mochila (0 = "Sem <nome>"). */
function balaDaMunicaoAceita(municao: MunicaoAceita, mochila: readonly CarriedItem[]): BalaDaArma {
  const naMochila = municaoNaMochila(mochila, municao.nome, municao.itemId)
  const tiro = tiroDaMunicao(municao.itemId)
  return {
    id: `${PREFIXO_DA_MUNICAO}${municao.itemId}`,
    nome: municao.nome,
    dano: tiro?.dano ?? '',
    efeito: tiro?.efeito ?? '',
    quantidade: '',
    itemId: municao.itemId,
    ...(naMochila === undefined ? {} : { municao: naMochila }),
  }
}

/** "Sem Balas de prata": por que o tiro com esta bala não sai, ou `null` (bala de texto, ou com munição na mochila). */
export function motivoSemMunicao(bala: Pick<BalaDaArma, 'nome' | 'municao'>): string | null {
  return bala.municao !== undefined && bala.municao.quantos < 1 ? `Sem ${bala.nome}` : null
}

/**
 * As leituras guardadas pela lista da aba: a mesma lista de cartões devolve as
 * MESMAS armas, e a tela que compara por referência (memo, efeito) não vê
 * arma "nova" a cada desenho (antes das balas, `armasDe` devolvia a própria
 * lista da ficha). A lista devolvida é compartilhada: não a mude.
 */
let armasLidas = new WeakMap<readonly CartaoDaFicha[], WeakMap<readonly CarriedItem[], ArmaDaFicha[]>>()
/** As munições do Acervo da leitura guardada: mudou a lista (`definirMunicoesDasArmas`), as armas são lidas de novo. */
let versaoLida = versaoDasMunicoes()
const SEM_ARMAS: readonly CartaoDaFicha[] = []
const SEM_MOCHILA: readonly CarriedItem[] = []

/** O id da arma que vem da mochila: `mochila:<id da vaga>`; nunca colide com o id de um cartão (sem dois-pontos). */
export const PREFIXO_DA_ARMA_DA_MOCHILA = 'mochila:'
/** As categorias do Acervo que contam como arma (sem acento, sem caixa), as mesmas do filtro do livro (`lib/livros/acervoNoLivro.ts`). */
const CATEGORIAS_DO_ACERVO_QUE_SAO_ARMA: ReadonlySet<string> = new Set(['arma', 'armas'])

/** A vaga da mochila é uma arma (categoria Arma do Acervo)? */
export function ehArmaDaMochila(item: Pick<CarriedItem, 'categoria'>): boolean {
  return item.categoria !== undefined && CATEGORIAS_DO_ACERVO_QUE_SAO_ARMA.has(normalizar(item.categoria).trim())
}

/**
 * COISA x REGRA (Fase 5): a arma da mochila sem cartão na aba Armas, como
 * cartão de leitura. Sem regra no livro, o dano é digitado na batalha
 * (`aMao`), como a técnica à mão; a descrição e a foto vêm da coisa.
 */
function armaDaMochila(item: CarriedItem): CartaoDaFicha {
  return {
    id: `${PREFIXO_DA_ARMA_DA_MOCHILA}${item.id}`,
    nome: item.nome,
    campos: item.descricao === undefined ? {} : { descricao: item.descricao },
    extras: [],
    atributos: [],
    imagem: item.imagem ?? null,
    modificadores: [],
    subcartoes: [],
    aMao: true,
    ...(item.itemId === undefined ? {} : { itemId: item.itemId }),
  }
}

/**
 * As armas da mochila que a aba Armas ainda não cobre: a vaga cujo `itemId`
 * já está num cartão (a regra do livro) ou cujo nome já é de um cartão (a
 * ficha de antes) fica de fora — ataca pelo cartão. Uma por coisa: duas
 * Garruchas não empilháveis são uma arma só na escolha.
 */
function armasSoNaMochila(cartoes: readonly CartaoDaFicha[], mochila: readonly CarriedItem[]): CartaoDaFicha[] {
  const ids = new Set(cartoes.flatMap((cartao) => (cartao.itemId === undefined ? [] : [cartao.itemId])))
  const nomes = new Set(cartoes.map((cartao) => normalizar(cartao.nome).trim()))
  const vistas = new Set<string>()
  const armas: CartaoDaFicha[] = []
  for (const item of mochila) {
    if (!ehArmaDaMochila(item)) continue
    const nome = normalizar(item.nome).trim()
    // Frente A (25/11/2026): a vaga guarda o nome da hora em que foi dada; a coisa renomeada no Acervo, com o cartão do
    // livro já no nome novo, aparecia duas vezes no Atacar. O nome de agora no Acervo também casa (só mestre e host o veem).
    const doAcervo = nomeNoAcervo(item.itemId)
    if ((item.itemId !== undefined && ids.has(item.itemId)) || nomes.has(nome) || (doAcervo !== undefined && nomes.has(normalizar(doAcervo).trim()))) continue
    const chave = item.itemId ?? `nome:${nome}`
    if (vistas.has(chave)) continue
    vistas.add(chave)
    armas.push(armaDaMochila(item))
  }
  return armas
}

/**
 * Os cartões da aba Armas, cada um com categoria, capacidade e balas
 * (`lerArma`), e depois as armas da MOCHILA que nenhum cartão cobre
 * (`armasSoNaMochila`). É a leitura de ANTES dos itens refeitos: a batalha lê
 * `armasDe`; esta fica para a ficha que ainda mostra a aba Armas, até a E7.
 */
export function armasDosCartoes(personagem: Personagem): ArmaDaFicha[] {
  const cartoes = personagem.abas[ABA_DAS_ARMAS] ?? SEM_ARMAS
  const mochila = personagem.mochila ?? SEM_MOCHILA
  if (versaoLida !== versaoDasMunicoes()) {
    armasLidas = new WeakMap()
    armasEquipadasLidas = new WeakMap()
    versaoLida = versaoDasMunicoes()
  }
  let porMochila = armasLidas.get(cartoes)
  if (porMochila === undefined) {
    porMochila = new WeakMap()
    armasLidas.set(cartoes, porMochila)
  }
  const guardadas = porMochila.get(mochila)
  if (guardadas !== undefined) return guardadas
  const lidas = [...cartoes, ...armasSoNaMochila(cartoes, mochila)].map((cartao) => lerArma(cartao, mochila))
  porMochila.set(mochila, lidas)
  return lidas
}

/** As leituras das armas equipadas, pela mochila (a mesma mochila = as MESMAS armas, como em `armasDosCartoes`). */
let armasEquipadasLidas = new WeakMap<readonly CarriedItem[], ArmaDaFicha[]>()

/** A parte que bate da Híbrida: `mochila:<vaga>:golpe`, ao lado do tiro (`mochila:<vaga>`). */
export const SUFIXO_DO_GOLPE = ':golpe'
const CATEGORIA_DO_TIPO: Readonly<Record<'corpo' | 'fogo' | 'hibrida' | 'arremesso', CategoriaDaArma>> = { corpo: 'branca', fogo: 'deFogo', hibrida: 'hibrida', arremesso: 'arremesso' }
/** A recarga do pente que o item não diz: Ação Simples, na hora (a do protótipo). */
export const RECARGA_PADRAO: RecargaDoItem = { acao: 'Ação Simples', rodadas: 0 }
/** O arremesso que não diz o tempo: o próximo vai para a mão na hora, sem gastar ação (o padrão do editor). */
const RECARGA_DO_ARREMESSO: RecargaDoItem = { acao: 'Ação Livre', rodadas: 0 }
/** O boomerang que não diz o tempo: volta no começo da próxima vez de quem jogou (decisão 7). */
const RECARGA_DA_VOLTA: RecargaDoItem = { acao: 'Ação Livre', rodadas: 1 }
const MUNICAO_SEM_NOME = 'Munição do pente'

/** O id da vaga da arma da mochila (`mochila:<vaga>` ou `mochila:<vaga>:golpe`); `null` = não é arma da mochila. */
export function vagaDaArma(armaId: string): string | null {
  if (!armaId.startsWith(PREFIXO_DA_ARMA_DA_MOCHILA)) return null
  const resto = armaId.slice(PREFIXO_DA_ARMA_DA_MOCHILA.length)
  return resto.endsWith(SUFIXO_DO_GOLPE) ? resto.slice(0, -SUFIXO_DO_GOLPE.length) : resto
}

/**
 * O dano da bala como o tiro o lê ("+15" soma, "40" troca, "+percepcao / 2" pelo atributo). Sem o bloco, o `tiro` de antes.
 * `blocos` = os da bala do pente (do Acervo, ou da vaga dela sem o Acervo): conserto de 27/11/2026, o jogador, que não vê o
 * Acervo, atirava a Bala de Prata com o dano da arma sem ela.
 */
function danoDaBala(balaId: string, blocos: Pick<BlocosDoItem, 'bala'> | undefined): string {
  const bala = blocos?.bala
  if (bala === undefined) return tiroDaMunicao(balaId)?.dano ?? ''
  if (bala.modo === 'troca') return String(bala.valor)
  if (bala.modo === 'soma') return bala.valor === 0 ? '' : `+${bala.valor}`
  const atributo = bala.atributo ?? ''
  if (atributo.length === 0) return ''
  return bala.divisor === undefined || bala.divisor <= 1 ? `+${atributo}` : `+${atributo} / ${bala.divisor}`
}

/** O nome da bala: o do Acervo de agora, senão o da vaga da mochila com ela, senão o copiado no pente (rodada 3). */
function nomeDaBala(balaId: string, mochila: readonly CarriedItem[], doPente?: string): string {
  return nomeNoAcervo(balaId) ?? mochila.find((vaga) => vaga.itemId === balaId)?.nome ?? doPente ?? MUNICAO_SEM_NOME
}

/** A bala que está no pente como bala da arma: o tiro tira 1 do pente (`municao.pente`). */
function balaDoPente(armaVagaId: string, pente: PenteDaVaga, mochila: readonly CarriedItem[]): BalaDaArma {
  // Sem o Acervo (o Worker do Lobby, o jogador), a regra da bala vem da vaga dela na mochila (a cópia mais nova) e, sem
  // a vaga, do pente (rodada 3: com todas as balas no pente, a vaga da munição já saiu da mochila).
  const blocos = regraNoAcervo(pente.balaId)?.blocos ?? mochila.find((vaga) => vaga.itemId === pente.balaId)?.regra ?? pente.regra
  const aoAcertar = efeitosAoAcertar(blocos)
  return {
    ...(temEfeitoAoAcertar(aoAcertar) ? { aoAcertar } : {}),
    ...(blocos?.bala?.perfurante === true ? { perfurante: true as const } : {}),
    id: `${PREFIXO_DA_MUNICAO}${pente.balaId}`,
    nome: nomeDaBala(pente.balaId, mochila, pente.nome),
    dano: danoDaBala(pente.balaId, blocos),
    efeito: tiroDaMunicao(pente.balaId)?.efeito ?? '',
    quantidade: '',
    itemId: pente.balaId,
    municao: { itemId: pente.balaId, quantos: pente.n, vagaId: armaVagaId, pente: true },
  }
}

/** Os campos de cartão do ataque do item, como a batalha os lê (dano, ação, "Soma no ataque", categoria). */
function camposDoAtaque(ataque: Pick<AtaqueDoItem, 'dano' | 'soma' | 'acao'>, categoria: CategoriaDaArma, vaga: CarriedItem, capacidade: number | null): Record<string, string> {
  const rotulo = CATEGORIAS_DE_ARMA.find((candidata) => candidata.id === categoria)?.rotulo ?? ''
  return {
    dano: String(ataque.dano),
    acao: ataque.acao,
    categoria: rotulo,
    // Bug de 28/11/2026: o item sem atributo é o "Soma no ataque: Nada" do editor do item, só o dano dele (a conversão guarda a Força da arma antiga).
    [CAMPO_DO_ATRIBUTO_DO_ATAQUE]: ataque.soma.length === 0 ? ATAQUE_SEM_ATRIBUTO : ataque.soma,
    ...(capacidade === null ? {} : { [CAMPO_DA_CAPACIDADE]: String(capacidade) }),
    ...(vaga.descricao === undefined ? {} : { descricao: vaga.descricao }),
  }
}

/**
 * A arma equipada como cartão de leitura: o ataque do item (do Acervo de agora; sem ele, a `regra`
 * da vaga). Sem o bloco de ataque, o dano é digitado na batalha (`aMao`), como a arma de antes.
 */
function armaDoBloco(id: string, nome: string, vaga: CarriedItem, ataque: Pick<AtaqueDoItem, 'dano' | 'soma' | 'acao' | 'alcance'> | undefined, categoria: CategoriaDaArma, capacidade: number | null): ArmaDaFicha {
  return {
    id,
    nome,
    campos: ataque === undefined ? (vaga.descricao === undefined ? {} : { descricao: vaga.descricao }) : camposDoAtaque(ataque, categoria, vaga, capacidade),
    extras: [],
    atributos: [],
    imagem: vaga.imagem ?? null,
    modificadores: [],
    subcartoes: [],
    ...(ataque === undefined ? { aMao: true as const } : {}),
    ...(ataque?.alcance === undefined ? {} : { alcance: ataque.alcance }),
    ...(vaga.itemId === undefined ? {} : { itemId: vaga.itemId }),
    categoria,
    capacidade: capacidade === null ? null : String(capacidade),
    balas: [],
  }
}

/** As balas que a arma aceita na mochila, fora do pente. */
function balasForaDoPente(mochila: readonly CarriedItem[], vagaId: string): number {
  return balasParaOPente(mochila, vagaId, ACERVO_DA_BATALHA).reduce((soma, vaga) => soma + quantidadeDe(vaga), 0)
}

/**
 * ITENS REFEITOS, E6a: a vaga EQUIPADA vira as armas do Atacar. De fogo: o tiro com o pente. Híbrida:
 * o tiro com o pente e o golpe (`:golpe`). Corpo a corpo e Arremesso: o ataque. Guardada, sem tipo de
 * arma ou fora do Acervo sem `regra`: nenhuma.
 */
function armasDaVaga(vaga: CarriedItem, mochila: readonly CarriedItem[]): ArmaDaFicha[] {
  if (vaga.equipado !== true) return []
  const doAcervo = regraNoAcervo(vaga.itemId)
  const tipo = doAcervo?.tipo ?? vaga.tipo
  if (tipo !== 'corpo' && tipo !== 'fogo' && tipo !== 'hibrida' && tipo !== 'arremesso') return []
  const blocos = doAcervo?.blocos ?? vaga.regra ?? {}
  const nome = nomeNoAcervo(vaga.itemId) ?? vaga.nome
  const id = `${PREFIXO_DA_ARMA_DA_MOCHILA}${vaga.id}`
  const molde = penteDaArma(vaga, ACERVO_DA_BATALHA)
  const daArma = armaDoBloco(id, nome, vaga, blocos.ataque, CATEGORIA_DO_TIPO[tipo], molde === null ? null : molde.capacidade)
  // E6c: o "Ao acertar" vale no tiro, no golpe da Híbrida e no arremesso (o mesmo item).
  const aoAcertar = efeitosAoAcertar(blocos)
  const principal: ArmaDaFicha = temEfeitoAoAcertar(aoAcertar) ? { ...daArma, aoAcertar } : daArma
  if (tipo === 'arremesso') {
    const volta = blocos.arremesso?.volta === true
    const recarga = blocos.arremesso?.recarga ?? (volta ? RECARGA_DA_VOLTA : RECARGA_DO_ARREMESSO)
    return [{ ...principal, arremesso: { vagaId: vaga.id, volta, recarga, quantos: quantidadeDe(vaga) } }]
  }
  const comPente: ArmaDaFicha =
    molde === null
      ? principal
      : {
          ...principal,
          balas: vaga.pente === undefined ? [] : [balaDoPente(vaga.id, vaga.pente, mochila)],
          exigeMunicao: true,
          pente: {
            vagaId: vaga.id,
            capacidade: molde.capacidade,
            n: vaga.pente?.n ?? 0,
            ...(vaga.pente === undefined ? {} : { balaId: vaga.pente.balaId }),
            recarga: blocos.pente?.recarga ?? RECARGA_PADRAO,
            naMochila: balasForaDoPente(mochila, vaga.id),
          },
        }
  if (tipo !== 'hibrida' || blocos.golpe === undefined) return [comPente]
  const golpe = armaDoBloco(`${id}${SUFIXO_DO_GOLPE}`, `${nome} (golpe)`, vaga, blocos.golpe, 'branca', null)
  return [comPente, temEfeitoAoAcertar(aoAcertar) ? { ...golpe, aoAcertar } : golpe]
}

/**
 * ITENS REFEITOS, E6a (PLANO §3, decisões 5 e 6): as armas do Atacar são só as EQUIPADAS da mochila
 * de agora; os cartões da aba Armas deixaram de valer (a conversão os pôs na mochila). Equipar e
 * guardar mudam a mochila, e a lista muda junto, sem gastar ação. Uma vaga = uma arma (a Híbrida dá
 * o tiro e o golpe).
 */
export function armasDe(personagem: Personagem): ArmaDaFicha[] {
  const mochila = personagem.mochila ?? SEM_MOCHILA
  if (versaoLida !== versaoDasMunicoes()) {
    armasLidas = new WeakMap()
    armasEquipadasLidas = new WeakMap()
    versaoLida = versaoDasMunicoes()
  }
  const guardadas = armasEquipadasLidas.get(mochila)
  if (guardadas !== undefined) return guardadas
  const lidas = mochila.flatMap((vaga) => armasDaVaga(vaga, mochila))
  armasEquipadasLidas.set(mochila, lidas)
  return lidas
}

/**
 * Por que o tiro com a arma de pente não sai agora: o pente vazio (e se a mesa ainda tem bala para
 * recarregar) ou a recarga esperando rodadas. `null` = pode atirar (ou a arma não tem pente).
 */
export function motivoDoPente(arma: Pick<ArmaDaFicha, 'nome' | 'pente'>, rodadasDaRecarga: number): string | null {
  const pente = arma.pente
  if (pente === undefined) return null
  if (rodadasDaRecarga > 0) return `Recarregando: pronta em ${rodadasDaRecarga} ${rodadasDaRecarga === 1 ? 'rodada' : 'rodadas'}`
  if (pente.n > 0) return null
  const nome = arma.nome.trim() || 'a arma'
  return pente.naMochila > 0 ? `Pente vazio: a mesa recarrega ${nome} no começo da próxima vez (${pente.recarga.acao})` : `Pente vazio e nenhuma bala que ${nome} aceita na mochila`
}

/** "na próxima vez", "daqui a 2 vezes": quando a espera de `rodadas` acaba (desce no começo de cada vez do dono). */
export function quandoAcabaAEspera(rodadas: number): string {
  return rodadas <= 1 ? 'no começo da próxima vez' : `daqui a ${rodadas} vezes`
}

/**
 * ITENS REFEITOS, E6b (decisão 7): por que o arremesso não sai agora: o boomerang ainda voltando, o
 * próximo ainda indo para a mão, ou a pilha vazia. `null` = pode jogar (ou a arma não é arremesso).
 */
export function motivoDoArremesso(arma: Pick<ArmaDaFicha, 'nome' | 'arremesso'>, rodadasDaEspera: number): string | null {
  const arremesso = arma.arremesso
  if (arremesso === undefined) return null
  const nome = arma.nome.trim() || 'O item'
  if (rodadasDaEspera > 0) return arremesso.volta ? `${nome} está voltando para a mão: volta ${quandoAcabaAEspera(rodadasDaEspera)}` : `${nome}: o próximo chega à mão ${quandoAcabaAEspera(rodadasDaEspera)}`
  if (!arremesso.volta && arremesso.quantos < 1) return `Sem ${nome} na mochila`
  return null
}

/** O que trava a arma equipada agora, fora a ação: o pente (E6a) ou o arremesso (E6b). `null` = está na mão e pronta. */
export function motivoDaArmaNaMao(arma: Pick<ArmaDaFicha, 'nome' | 'pente' | 'arremesso'>, rodadasDaEspera: number): string | null {
  return motivoDoPente(arma, rodadasDaEspera) ?? motivoDoArremesso(arma, rodadasDaEspera)
}

/** A bala da arma pelo id. `null` = a arma não tem essa bala. */
export function balaDaArma(arma: ArmaDaFicha, balaId: string): BalaDaArma | null {
  return arma.balas.find((bala) => bala.id === balaId) ?? null
}

/**
 * A bala do tiro: a escolhida; sem escolha, na arma que exige munição
 * (`exigeMunicao`), a primeira que a mochila tem — é o tiro do jogador, cujo
 * app não vê o Acervo do mestre. `null` = sem bala (o dano da arma).
 */
export function balaDoPedido(arma: ArmaDaFicha, balaId: string | undefined): BalaDaArma | null {
  if (balaId !== undefined) return balaDaArma(arma, balaId)
  if (arma.exigeMunicao !== true) return null
  return arma.balas.find((bala) => bala.municao !== undefined && bala.municao.quantos > 0) ?? null
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
