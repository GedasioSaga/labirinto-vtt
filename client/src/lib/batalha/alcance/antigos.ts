import type { ItemDoCatalogo } from '../../livros/catalogo'
import { cartoesDaAba, type AlcanceGuardado, type CartaoDaFicha, type MecanicaGuardada, type Personagem } from '../../personagem'
import { alcanceDaMecanica, alcanceDoCartao, formaDoAlcanceGuardada } from '../alcanceDoCartao'
import { ABA_DAS_ARMAS, ABA_DAS_TECNICAS } from '../leituraDaFicha'
import { pecasDoCartao } from '../mecanica/leitura'
import type { MecanicaV1 } from '../mecanica/modelo'
import { guardarMecanica } from '../mecanica/modelos'
import type { FormaDoAlcance } from './forma'

/**
 * OS ANTIGOS SEM ALCANCE (fase G, docs/design/habilidades/ALCANCE.md §9; pedido do dono de
 * 22/11: "Eu preencho e você confere"). A habilidade e a arma de antes do alcance não acendem
 * casa nenhuma. O Claude propõe um alcance para cada uma pelo texto (`alcances-propostos.json`,
 * fora do repo), o mestre confere a lista e só o Confirmar grava.
 *
 * Aqui a parte pura: QUEM está sem alcance (pelo único leitor, `alcanceDoCartao`), ONDE o
 * alcance se grava (a ordem do §3.2) e a gravação de volta (o Desfazer). A ordem das gravações
 * no disco e as cópias de antes ficam em `stores/alcanceDosAntigos.ts`.
 *
 * - A mecânica montada recebe o alcance no alvo dela (`alvo.alcance`, o anel em `alcanceMinimo`);
 *   a forma dela não muda (quem é atingido continua o mesmo).
 * - O cartão só de texto e a entrada do livro sem mecânica recebem o campo `alcance` (qualquer forma).
 * - A arma da ficha ligada a uma entrada do livro não entra: a entrada é a fonte (ela recebe, e as
 *   cópias seguem pelo caminho de sempre, `fichasComARegraDaArma`).
 * - A mecânica que este app não lê (torta, de app mais novo) não entra: vai para `naoLidos`.
 *
 * Puro: sem store, sem rede, sem disco.
 */

/** O arquivo da proposta, na pasta de dados do app (nunca no repo: o texto é da campanha). */
export const ARQUIVO_DAS_PROPOSTAS = 'alcances-propostos.json'

/** Até quantas letras do texto a lista mostra e a proposta guarda. */
export const TRECHO_MAX = 320

export type GrupoDoAntigo = 'arma' | 'habilidade'

/**
 * Onde o alcance se grava:
 * - `campo`: o campo `alcance` (qualquer forma);
 * - `alvo`: a mecânica de 1 ou vários alvos (alvo até N, ou o anel de N a M);
 * - `centro`: a mecânica da área longe (só até onde vai o centro; a explosão fica).
 */
export type OndeOAlcanceVai = 'campo' | 'alvo' | 'centro'

export interface AntigoSemAlcance {
  /** `livro:<sistema>:<entrada>` ou `ficha:<pasta>:<personagem>:<cartão>`: a mesma da proposta. */
  chave: string
  lugar: 'livro' | 'ficha'
  grupo: GrupoDoAntigo
  nome: string
  /** A descrição e os campos, numa linha, até `TRECHO_MAX`. */
  texto: string
  onde: OndeOAlcanceVai
  /** Dá dano (a cor da prévia: azul com dano, verde sem): a mecânica com dano, ou o campo Dano escrito. */
  daDano: boolean
  /** Só na ficha. */
  personagemId?: string
  personagemNome?: string
}

/** Quem não deu para ler (a mecânica torta ou de app mais novo): o editor dela diz o que fazer. */
export interface AntigoNaoLido {
  chave: string
  nome: string
  personagemNome?: string
}

export interface DadosDosAntigos {
  sistemaId: string
  catalogo: readonly ItemDoCatalogo[]
  pastaId: string | null
  personagens: readonly Personagem[]
}

export interface ListaDosAntigos {
  antigos: AntigoSemAlcance[]
  naoLidos: AntigoNaoLido[]
}

/** O mesmo que se lê ou se grava num cartão e numa entrada do livro. */
type ComAlcance = Pick<CartaoDaFicha, 'id' | 'mecanica' | 'alcance'>

const GRUPO_DA_ENTRADA: Readonly<Partial<Record<ItemDoCatalogo['tipo'], GrupoDoAntigo>>> = { arma: 'arma', habilidade: 'habilidade' }
const GRUPO_DA_ABA: readonly (readonly [string, GrupoDoAntigo])[] = [
  [ABA_DAS_TECNICAS, 'habilidade'],
  [ABA_DAS_ARMAS, 'arma'],
]

export function chaveDoLivro(sistemaId: string, entradaId: string): string {
  return `livro:${sistemaId}:${entradaId}`
}

export function chaveDaFicha(pastaId: string, personagemId: string, cartaoId: string): string {
  return `ficha:${pastaId}:${personagemId}:${cartaoId}`
}

/** A descrição primeiro, depois os outros campos (`efeito: ...`), numa linha. */
function textoDe(descricao: string, campos: Readonly<Record<string, string>>): string {
  const outros = Object.entries(campos)
    .filter(([chave, valor]) => chave !== 'descricao' && valor.trim() !== '')
    .map(([chave, valor]) => `${chave}: ${valor.trim()}`)
  const junto = [descricao.trim(), ...outros].filter((parte) => parte !== '').join(' | ').replace(/\s+/g, ' ')
  return junto.length > TRECHO_MAX ? `${junto.slice(0, TRECHO_MAX - 1)}…` : junto
}

/** Se dá dano, para a cor da prévia: a arma sempre; a mecânica pela peça do dano; o texto pelo campo Dano ("0" e "-" não contam). */
function daDano(x: ComAlcance & { campos: Readonly<Record<string, string>> }, grupo: GrupoDoAntigo): boolean {
  if (grupo === 'arma') return true
  const pecas = x.mecanica === undefined ? null : pecasDoCartao(x)
  if (pecas !== null) return pecas.dano !== undefined
  const dano = (x.campos.dano ?? '').trim()
  return dano !== '' && dano !== '0' && dano !== '-'
}

/** Onde o alcance deste vai; `null` = já tem alcance; `'naoLido'` = a mecânica não se lê. */
function ondeVai(x: ComAlcance): OndeOAlcanceVai | 'naoLido' | null {
  if (alcanceDoCartao(x) !== null) return null
  if (x.mecanica === undefined) return 'campo'
  const pecas = pecasDoCartao(x)
  if (pecas === null) return 'naoLido'
  const { forma } = pecas.alvo
  return forma.tipo === 'um' || forma.tipo === 'varios' ? 'alvo' : 'centro'
}

/** A arma da ficha que segue uma entrada do livro (pela coisa do Acervo): quem recebe é a entrada. */
function armaQueSegueOLivro(cartao: CartaoDaFicha, catalogo: readonly ItemDoCatalogo[]): boolean {
  return cartao.itemId !== undefined && catalogo.some((entrada) => entrada.tipo === 'arma' && entrada.acervoId === cartao.itemId)
}

/** Todas as habilidades e armas sem alcance: as do livro aberto e as das fichas da pasta aberta. */
export function antigosSemAlcance(dados: DadosDosAntigos): ListaDosAntigos {
  const antigos: AntigoSemAlcance[] = []
  const naoLidos: AntigoNaoLido[] = []
  for (const entrada of dados.catalogo) {
    const grupo = GRUPO_DA_ENTRADA[entrada.tipo]
    if (grupo === undefined) continue
    const onde = ondeVai(entrada)
    if (onde === null) continue
    const chave = chaveDoLivro(dados.sistemaId, entrada.id)
    if (onde === 'naoLido') naoLidos.push({ chave, nome: entrada.nome })
    else antigos.push({ chave, lugar: 'livro', grupo, nome: entrada.nome, texto: textoDe(entrada.texto, entrada.campos), onde, daDano: daDano(entrada, grupo) })
  }
  if (dados.pastaId === null) return { antigos, naoLidos }
  for (const personagem of dados.personagens) {
    for (const [aba, grupo] of GRUPO_DA_ABA) {
      for (const cartao of cartoesDaAba(personagem, aba)) {
        if (grupo === 'arma' && armaQueSegueOLivro(cartao, dados.catalogo)) continue
        const onde = ondeVai(cartao)
        if (onde === null) continue
        const chave = chaveDaFicha(dados.pastaId, personagem.id, cartao.id)
        if (onde === 'naoLido') naoLidos.push({ chave, nome: cartao.nome, personagemNome: personagem.nome })
        else antigos.push({ chave, lugar: 'ficha', grupo, nome: cartao.nome, texto: textoDe(cartao.campos.descricao ?? '', cartao.campos), onde, daDano: daDano(cartao, grupo), personagemId: personagem.id, personagemNome: personagem.nome })
      }
    }
  }
  return { antigos, naoLidos }
}

// ─── A forma que cabe em cada lugar ─────────────────────────────────────────

/** Até onde a forma vai (o número que o alvo e o centro da área longe guardam); `null` = só em quem usa. */
function ateDe(forma: FormaDoAlcance): number | null {
  switch (forma.tipo) {
    case 'si':
      return null
    case 'frente':
      return forma.lado
    default:
      return forma.ate
  }
}

/** O alvo da mecânica com o alcance da forma (o anel só no alvo escolhido). */
function alvoComAlcance(pecas: MecanicaV1, forma: FormaDoAlcance): MecanicaV1['alvo'] | null {
  const ate = ateDe(forma)
  if (ate === null) return null
  const { alcance: _alcance, alcanceMinimo: _minimo, ...alvo } = pecas.alvo
  const comAnel = forma.tipo === 'alvo' && forma.de !== undefined && (alvo.forma.tipo === 'um' || alvo.forma.tipo === 'varios')
  return comAnel && forma.tipo === 'alvo' ? { ...alvo, alcance: ate, alcanceMinimo: forma.de } : { ...alvo, alcance: ate }
}

/**
 * A forma como ela vai ficar de verdade naquele lugar: o campo aceita qualquer uma; a mecânica
 * montada só o número (a forma dela não muda), e o anel só no alvo escolhido. `null` = não cabe
 * (só em quem usa numa mecânica que escolhe alvo).
 */
export function formaQueCabe(x: ComAlcance, forma: FormaDoAlcance): FormaDoAlcance | null {
  if (x.mecanica === undefined) return forma
  const pecas = pecasDoCartao(x)
  if (pecas === null) return null
  const alvo = alvoComAlcance(pecas, forma)
  return alvo === null ? null : alcanceDaMecanica({ alvo })
}

/** A forma que cabe naquele antigo, procurado pela chave nos dados de agora. */
export function formaQueCabeNoAntigo(dados: DadosDosAntigos, chave: string, forma: FormaDoAlcance): FormaDoAlcance | null {
  const achado = acharPelaChave(dados, chave)
  return achado === null ? null : formaQueCabe(achado, forma)
}

function acharPelaChave(dados: DadosDosAntigos, chave: string): ComAlcance | null {
  for (const entrada of dados.catalogo) if (chaveDoLivro(dados.sistemaId, entrada.id) === chave) return entrada
  if (dados.pastaId === null) return null
  for (const personagem of dados.personagens) {
    for (const [aba] of GRUPO_DA_ABA) {
      for (const cartao of cartoesDaAba(personagem, aba)) if (chaveDaFicha(dados.pastaId, personagem.id, cartao.id) === chave) return cartao
    }
  }
  return null
}

// ─── Gravar e desfazer ──────────────────────────────────────────────────────

export interface EscolhaDoAlcance {
  chave: string
  forma: FormaDoAlcance
}

/** O que o cartão ou a entrada tinha antes: o Desfazer põe de volta exatamente isto. */
export interface AntesDoAlcance {
  chave: string
  alcance: AlcanceGuardado | undefined
  mecanica: MecanicaGuardada | undefined
}

export interface AlcancesGravados {
  catalogo: ItemDoCatalogo[]
  personagens: Personagem[]
  /** As que mudaram de verdade (a chave sumida ou que já tem alcance não conta). */
  antes: AntesDoAlcance[]
  /** As entradas de arma do livro que mudaram (as cópias ligadas seguem). */
  armasDoLivro: string[]
}

/** O cartão ou a entrada com o alcance no lugar certo; `null` = nada a gravar (já tem, ou não cabe). */
function comAlcance<T extends ComAlcance>(x: T, forma: FormaDoAlcance): T | null {
  const onde = ondeVai(x)
  if (onde === null || onde === 'naoLido') return null
  if (onde === 'campo') {
    const guardada: AlcanceGuardado = { ...forma }
    return formaDoAlcanceGuardada(guardada) === null ? null : { ...x, alcance: guardada }
  }
  const pecas = pecasDoCartao(x)
  const alvo = pecas === null ? null : alvoComAlcance(pecas, forma)
  return pecas === null || alvo === null ? null : { ...x, mecanica: guardarMecanica({ ...pecas, alvo }) }
}

function antesDe(chave: string, x: ComAlcance): AntesDoAlcance {
  return { chave, alcance: x.alcance, mecanica: x.mecanica }
}

/**
 * O cartão com o `alcance` e a `mecanica` de antes (ausente volta a ser ausente), cada chave no
 * lugar em que estava: o Confirmar só pôs o `alcance` no fim ou trocou a `mecanica` no lugar dela,
 * e o disco volta a sair na mesma ordem de antes.
 */
function comOQueEra<T extends ComAlcance>(x: T, era: AntesDoAlcance): T {
  const entradas = Object.entries(x).flatMap(([chave, valor]): [string, unknown][] => {
    if (chave === 'alcance') return era.alcance === undefined ? [] : [[chave, era.alcance]]
    if (chave === 'mecanica') return era.mecanica === undefined ? [] : [[chave, era.mecanica]]
    return [[chave, valor]]
  })
  if (era.mecanica !== undefined && !('mecanica' in x)) entradas.push(['mecanica', era.mecanica])
  if (era.alcance !== undefined && !('alcance' in x)) entradas.push(['alcance', era.alcance])
  return Object.fromEntries(entradas) as T // as mesmas chaves de T, só o valor de `alcance` e `mecanica` trocado (as duas opcionais em T)
}

type Mudanca = <T extends ComAlcance>(chave: string, x: T) => T | null

/** Passa `mudar` em toda entrada do livro e todo cartão de habilidade e de arma das fichas. */
function emTodos(dados: DadosDosAntigos, mudar: Mudanca): { catalogo: ItemDoCatalogo[]; personagens: Personagem[]; mudaram: string[] } {
  const mudaram: string[] = []
  const catalogo = dados.catalogo.map((entrada) => {
    const nova = mudar(chaveDoLivro(dados.sistemaId, entrada.id), entrada)
    if (nova === null) return entrada
    mudaram.push(chaveDoLivro(dados.sistemaId, entrada.id))
    return nova
  })
  const { pastaId } = dados
  if (pastaId === null) return { catalogo, personagens: [...dados.personagens], mudaram }
  const personagens = dados.personagens.map((personagem) => {
    let abas = personagem.abas
    for (const [aba] of GRUPO_DA_ABA) {
      const cartoes = cartoesDaAba(personagem, aba)
      let trocou = false
      const novos = cartoes.map((cartao) => {
        const chave = chaveDaFicha(pastaId, personagem.id, cartao.id)
        const novo = mudar(chave, cartao)
        if (novo === null) return cartao
        trocou = true
        mudaram.push(chave)
        return novo
      })
      if (trocou) abas = { ...abas, [aba]: novos }
    }
    return abas === personagem.abas ? personagem : { ...personagem, abas }
  })
  return { catalogo, personagens, mudaram }
}

/** GRAVAR: cada escolha no lugar certo. Só muda quem ainda está sem alcance. Puro. */
export function comOsAlcances(dados: DadosDosAntigos, escolhas: readonly EscolhaDoAlcance[]): AlcancesGravados {
  const porChave = new Map(escolhas.map((escolha) => [escolha.chave, escolha.forma]))
  const antes: AntesDoAlcance[] = []
  const feito = emTodos(dados, (chave, x) => {
    const forma = porChave.get(chave)
    const novo = forma === undefined ? null : comAlcance(x, forma)
    if (novo !== null) antes.push(antesDe(chave, x))
    return novo
  })
  const armasDoLivro = dados.catalogo.filter((entrada, indice) => entrada.tipo === 'arma' && feito.catalogo[indice] !== entrada).map((entrada) => entrada.id)
  return { catalogo: feito.catalogo, personagens: feito.personagens, antes, armasDoLivro }
}

/** DESFAZER: o `alcance` e a `mecanica` de antes, só nos que o Confirmar mudou. Puro. */
export function semOsAlcances(dados: DadosDosAntigos, antes: readonly AntesDoAlcance[]): AlcancesGravados {
  const porChave = new Map(antes.map((era) => [era.chave, era]))
  const desfeitos: AntesDoAlcance[] = []
  const feito = emTodos(dados, (chave, x) => {
    const era = porChave.get(chave)
    if (era === undefined) return null
    desfeitos.push(antesDe(chave, x))
    return comOQueEra(x, era)
  })
  const armasDoLivro = dados.catalogo.filter((entrada, indice) => entrada.tipo === 'arma' && feito.catalogo[indice] !== entrada).map((entrada) => entrada.id)
  return { catalogo: feito.catalogo, personagens: feito.personagens, antes: desfeitos, armasDoLivro }
}

// ─── O arquivo da proposta ──────────────────────────────────────────────────

export type CertezaDaProposta = 'alta' | 'baixa'

export interface PropostaDeAlcance {
  chave: string
  nome: string
  forma: FormaDoAlcance
  certeza: CertezaDaProposta
  /** O pedaço do texto que justifica a forma. */
  trecho: string
}

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function propostaLida(valor: unknown): PropostaDeAlcance | null {
  if (!ehRegistro(valor) || typeof valor.chave !== 'string' || typeof valor.nome !== 'string') return null
  const forma = formaDoAlcanceGuardada(valor.forma)
  if (forma === null) return null
  const certeza: CertezaDaProposta = valor.certeza === 'alta' ? 'alta' : 'baixa'
  const trecho = typeof valor.trecho === 'string' ? valor.trecho.slice(0, TRECHO_MAX) : ''
  return { chave: valor.chave, nome: valor.nome, forma, certeza, trecho }
}

/**
 * A proposta lida do arquivo (`{ formato: 1, propostas: [...] }`), pela chave. Tolerante: a linha
 * torta (forma que este app não lê, chave sem texto) é ignorada, e o antigo dela fica sem proposta.
 */
export function propostasDoArquivo(valor: unknown): Map<string, PropostaDeAlcance> {
  const lidas = new Map<string, PropostaDeAlcance>()
  if (!ehRegistro(valor) || !Array.isArray(valor.propostas)) return lidas
  for (const bruta of valor.propostas) {
    const lida = propostaLida(bruta)
    if (lida !== null && !lidas.has(lida.chave)) lidas.set(lida.chave, lida)
  }
  return lidas
}
