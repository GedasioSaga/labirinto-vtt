import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { CUSTO_MAX, EVOLUIDAS_MAX, NOME_DO_GOLPE_MAX, type CombateDoPersonagem, type PedidoDeEvolucao, type SeloDoGolpe } from './combate'
import { lerDano, normalizar, type ContextoDaFormula, type LeituraDoDano } from './formula'
import { CAMPO_DO_EFEITO, ehOverload, recursoDoCusto, tecnicaPorId, tecnicasDe, type LeituraDoCusto } from './leituraDaFicha'
import { lerDuracao, lerMods, seloComMods } from './selos'
import { lerTipo, seloSugeridoDaTecnica } from './tiposDaHabilidade'
import { cartaDaVez, type TurnosDaCena } from './turnos'

/**
 * ESCOLHA E EVOLUÇÃO, tipos de habilidade F4 (seções 4d, 4e e 7 de
 * docs/planos/batalha-tipos-de-habilidade-plano.md, com as decisões do
 * usuário de 31/10/2026).
 *
 * Escolha "um ou outro": o Efeito do cartão é a opção 1 ("Efeito
 * principal"); cada extra "Opção ...", "Efeito N" ou "Variante ..." é mais
 * uma. Os extras "Ação" e "Reação" (Aplauso) NÃO são opções: "Reação" é o
 * texto do modo reação. A opção escolhida vai no pedido (`variante`) e no
 * registro ("Harvey usa Medicina (Cirugia)").
 *
 * Evolução: extras "Evolution"/"Evolução", "Condições do Evolution" e o link
 * "Evolui para" (o nome de outra técnica). O app NÃO confere a condição
 * (texto livre): mostra e dá o botão Evoluir. Com link, a evoluída fica
 * apagada até Evoluir e, depois, a base fica apagada. Sem link, a base vira
 * "Evoluída" e o texto da Evolution vale como efeito; se ele diz OVERLOAD, o
 * uso evoluído conta como Overload. Vale só nesta batalha.
 *
 * Leitura de texto erra: as opções, o pré-preenchimento e a sugestão de link
 * são SUGESTÃO que a tela mostra e a pessoa troca.
 *
 * Puro: sem store, sem rede.
 */

// ───────────────────────────────────────────────────────────────────────────
// Nomes dos extras
// ───────────────────────────────────────────────────────────────────────────

/** O nome do extra para comparar: sem acento, minúsculo, aparado e sem ":" ou "." no fim ("Concentração:"). */
function nomeDoExtra(nome: string): string {
  return normalizar(nome).replace(/[\s:.\-–]+$/u, '').trim()
}

/** "Opção", "Opção 2", "Opção: Cura", "Variante Fogo", "Efeito 2" (sem acento). "Opções", "Efeito da Marca" não. */
const SINAL_DA_OPCAO = /^(?:opcao|variante)\b|^efeito ?\d{1,3}$/

/** A palavra que abre o nome da opção ("Opção", "Variante"), para tirar do rótulo ("Opção Cura" = "Cura"). */
const PALAVRA_DA_OPCAO = /^(?:op[cç][aã]o|variante)\b\s*[:\-–]?\s*/iu

/** "Evolution", "Evolução". */
const EXTRA_DA_EVOLUCAO = /^(?:evolution|evolucao)$/
/** "Condições do Evolution", "Condição da evolução", "Condições de evolução". */
const EXTRA_DAS_CONDICOES = /^condic(?:ao|oes) (?:d[aoe] )?(?:evolution|evolucao)$/
/** "Evolui para", "Evolui pra". */
const EXTRA_DO_LINK = /^evolui (?:para|pra)$/

/** Os nomes que o botão "+ Evolução" da ficha cria (o leitor aceita também os de antes: "Evolution", "Condições do Evolution"). */
export const EXTRAS_DA_EVOLUCAO = { texto: 'Evolução', condicoes: 'Condições da evolução', para: 'Evolui para' } as const // `as const` só congela os literais (readonly); não afirma tipo nenhum

/** O nome que o botão "+ Opção" da ficha cria: "Opção 2", "Opção 3"... (a principal é a 1), sem repetir nome que já existe. */
export function nomeDaNovaOpcao(cartao: Pick<CartaoDaFicha, 'extras'>): string {
  const usados = new Set(cartao.extras.map((extra) => nomeDoExtra(extra.nome)))
  let numero = 2 + cartao.extras.filter((extra) => SINAL_DA_OPCAO.test(nomeDoExtra(extra.nome))).length
  while (usados.has(`opcao ${numero}`)) numero += 1
  return `Opção ${numero}`
}

// ───────────────────────────────────────────────────────────────────────────
// Escolha "um ou outro" (seção 4e)
// ───────────────────────────────────────────────────────────────────────────

/** O rótulo e a chave da opção 1 (o Efeito do cartão). */
export const VARIANTE_PRINCIPAL = 'Efeito principal'
/** O título lido do começo do texto da opção ("Cirugia - Pode fazer isso 1 vez" = "Cirugia"): no máximo isto. */
const TITULO_DA_OPCAO_MAX = 32
const PALAVRAS_DO_TITULO_MAX = 4
/** O separador entre o título e o resto: " - ", " – ", ": ". */
const SEPARADOR_DO_TITULO = /\s+[-–—]\s+|\s*:\s+/u

/** Uma opção da habilidade, como os chips da mira e o Ativar da passiva a mostram. */
export interface VarianteDaHabilidade {
  /**
   * O que vai no pedido (`variante`) e o host casa: o nome do extra aparado
   * (nome repetido ganha " (2)"); a principal, `VARIANTE_PRINCIPAL`. No teto
   * `NOME_DO_GOLPE_MAX`.
   */
  chave: string
  /** O chip e o registro: "Efeito principal", "Cirugia", "Cura". No teto `NOME_DO_GOLPE_MAX`. */
  rotulo: string
  /** O texto da opção: o Efeito do cartão (principal) ou o valor do extra. */
  texto: string
  principal: boolean
}

function semEspacosSobrando(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

function noTetoDoNome(texto: string): string {
  return texto.slice(0, NOME_DO_GOLPE_MAX).trim()
}

/** O título do começo do texto ("Cura: recupera..." = "Cura"); `null` = não tem (longo, com número, sem separador). */
function tituloDoTexto(texto: string): string | null {
  const limpo = semEspacosSobrando(texto)
  const achado = SEPARADOR_DO_TITULO.exec(limpo)
  if (achado === null || achado.index === 0) return null
  const titulo = limpo.slice(0, achado.index).trim()
  // "Recupera 100 de vida - ..." é efeito, não nome.
  if (titulo.length > TITULO_DA_OPCAO_MAX || titulo.split(' ').length > PALAVRAS_DO_TITULO_MAX || /\d/.test(titulo)) return null
  return titulo
}

/**
 * O rótulo da opção: o que vem depois de "Opção"/"Variante" no nome ("Opção
 * Cura" = "Cura"); nome só com número ("Opção 2", "Efeito 2"), o título do
 * começo do texto ("Cirugia - Pode fazer isso 1 vez" = "Cirugia"); sem
 * título, o próprio nome.
 */
function rotuloDaOpcao(nome: string, texto: string): string {
  const limpo = semEspacosSobrando(nome)
  const resto = limpo.replace(PALAVRA_DA_OPCAO, '').trim()
  const soNumero = /^\d*$/.test(resto) || /^efeito ?\d{1,3}$/.test(normalizar(limpo))
  return noTetoDoNome(soNumero ? (tituloDoTexto(texto) ?? limpo) : resto)
}

/** A chave do extra: o nome aparado no teto; repetida (sem acento e caixa), "Nome (2)", "Nome (3)"... */
function chaveUnica(nome: string, usadas: Set<string>): string {
  const base = noTetoDoNome(semEspacosSobrando(nome))
  let chave = base
  for (let numero = 2; usadas.has(normalizar(chave)); numero += 1) {
    const sufixo = ` (${numero})`
    chave = `${base.slice(0, NOME_DO_GOLPE_MAX - sufixo.length).trim()}${sufixo}`
  }
  usadas.add(normalizar(chave))
  return chave
}

/**
 * As opções da habilidade, na ordem da ficha: a principal (o Efeito) e cada
 * extra "Opção ...", "Efeito N", "Variante ..." com texto. Sempre começa pela
 * principal; uma só = sem escolha (`temEscolha`).
 * Ex. (ficha real): Medicina = [Efeito principal "Recupera 100 de vida...",
 * Cirugia (extra "Efeito 2": "Cirugia - Pode fazer isso 1 vez")]; Aplauso do
 * Deus do Trovão = só a principal (os extras "Ação" e "Reação" não são opção).
 */
export function variantesDe(cartao: Pick<CartaoDaFicha, 'campos' | 'extras'>): VarianteDaHabilidade[] {
  const principal: VarianteDaHabilidade = { chave: VARIANTE_PRINCIPAL, rotulo: VARIANTE_PRINCIPAL, texto: (cartao.campos[CAMPO_DO_EFEITO] ?? '').trim(), principal: true }
  const opcoes = [principal]
  const usadas = new Set([normalizar(VARIANTE_PRINCIPAL)])
  for (const extra of cartao.extras) {
    const texto = extra.valor.trim()
    if (texto.length === 0 || !SINAL_DA_OPCAO.test(nomeDoExtra(extra.nome))) continue
    opcoes.push({ chave: chaveUnica(extra.nome, usadas), rotulo: rotuloDaOpcao(extra.nome, texto), texto, principal: false })
  }
  return opcoes
}

/** A habilidade tem "um ou outro": duas opções ou mais (a marca "2 opções" na tira). */
export function temEscolha(cartao: Pick<CartaoDaFicha, 'campos' | 'extras'>): boolean {
  return variantesDe(cartao).length > 1
}

/** A opção do pedido (`variante`), pela chave exata de `variantesDe`; `null` = não é opção desta habilidade. */
export function varianteDoPedido(cartao: Pick<CartaoDaFicha, 'campos' | 'extras'>, chave: string): VarianteDaHabilidade | null {
  return variantesDe(cartao).find((variante) => variante.chave === chave) ?? null
}

/**
 * O cartão como se o Efeito fosse o texto da opção. A Descrição sai: ela
 * costuma listar as duas opções (Medicina: "Efeito 1: ... Efeito 2: ...") e a
 * leitura do selo pegaria a errada. A principal: o MESMO cartão.
 */
export function cartaoDaVariante(cartao: CartaoDaFicha, variante: VarianteDaHabilidade): CartaoDaFicha {
  if (variante.principal) return cartao
  return { ...cartao, campos: { ...cartao.campos, [CAMPO_DO_EFEITO]: variante.texto, descricao: '' } }
}

/** O que a opção escolhida já preenche na mira (tudo editável). */
export interface PreenchimentoDaVariante {
  /** O dano lido do texto da opção (`lerDano`); `null` = o texto não diz: a mira fica com o do campo Dano. */
  dano: LeituraDoDano | null
  /**
   * O selo sugerido com esta opção: Buff/Debuff, o de `seloSugeridoDaTecnica`
   * sobre o texto dela; o resto, "por N turnos" e os mods do texto (`null` =
   * o texto não diz nenhum dos dois). A principal: o da técnica, como sempre.
   */
  selo: SeloDoGolpe | null
}

/**
 * O pré-preenchimento da opção. `ctx` = o da fórmula da mira (quem age, a
 * arma, a vida do alvo, o bônus dos selos). Ex.: opção "Fúria: +20 de Força
 * por 2 turnos" = selo Fúria 2 com FOR +20; "Cirugia - Pode fazer isso 1 vez"
 * = nada (dano e selo da técnica ficam).
 */
export function preenchimentoDaVariante(cartao: CartaoDaFicha, variante: VarianteDaHabilidade, ctx: ContextoDaFormula): PreenchimentoDaVariante {
  if (variante.principal) return { dano: null, selo: seloSugeridoDaTecnica(cartao, ctx.sistema) }
  const lido = lerDano(variante.texto, ctx)
  const dano = lido.tipo === 'valor' || lido.tipo === 'precisaArma' || lido.tipo === 'precisaAlvo' ? lido : null
  const daOpcao = cartaoDaVariante(cartao, variante)
  const { tipo } = lerTipo(cartao)
  if (tipo === 'buff' || tipo === 'debuff') return { dano, selo: seloSugeridoDaTecnica(daOpcao, ctx.sistema) }
  if (lerDuracao(variante.texto, cartao.nome) === null && lerMods(variante.texto, ctx.sistema).length === 0) return { dano, selo: null }
  return { dano, selo: seloComMods(daOpcao, ctx.sistema) }
}

// ───────────────────────────────────────────────────────────────────────────
// Evolução (seção 4d)
// ───────────────────────────────────────────────────────────────────────────

/** O nome do cartão para casar: sem acento, caixa, pontuação e espaço sobrando ("SUPER CAÇA AS BRUXAS!" = "super caca as bruxas"). */
function chaveDoNome(nome: string): string {
  return normalizar(nome)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nome de base mais curto que isto não sugere link (o "A" de um cartão contido em tudo). */
const NOME_DA_BASE_MIN = 3

/** O cartão de `todos` com este nome (sem acento, caixa e pontuação), fora o `exceto`; `null` = nenhum. */
function cartaoPeloNome(nome: string, todos: readonly CartaoDaFicha[], exceto: string): CartaoDaFicha | null {
  const chave = chaveDoNome(nome)
  if (chave.length === 0) return null
  return todos.find((cartao) => cartao.id !== exceto && chaveDoNome(cartao.nome) === chave) ?? null
}

/**
 * A sugestão de link por nome: outra técnica cujo nome CONTÉM o da base,
 * palavra inteira ("SUPER CAÇA AS BRUXAS!" contém "CAÇA AS BRUXAS!"); várias,
 * a de nome mais curto. O editor da ficha mostra; a batalha não usa (só o
 * link escrito apaga a evoluída). `null` = nenhuma.
 */
export function sugestaoDeEvolucao(cartao: Pick<CartaoDaFicha, 'id' | 'nome'>, todos: readonly CartaoDaFicha[]): CartaoDaFicha | null {
  const base = chaveDoNome(cartao.nome)
  if (base.length < NOME_DA_BASE_MIN) return null
  let melhor: { cartao: CartaoDaFicha; tamanho: number } | null = null
  for (const outro of todos) {
    if (outro.id === cartao.id) continue
    const nome = chaveDoNome(outro.nome)
    if (nome === base || !` ${nome} `.includes(` ${base} `)) continue
    if (melhor === null || nome.length < melhor.tamanho) melhor = { cartao: outro, tamanho: nome.length }
  }
  return melhor?.cartao ?? null
}

/** A evolução da técnica como a tira e o detalhe a mostram. */
export interface EvolucaoDaHabilidade {
  /** O texto do extra "Evolution"/"Evolução" ('' = não tem). Sem link, é o efeito do uso evoluído. */
  texto: string
  /** O texto de "Condições do Evolution" ('' = não tem). O app só mostra: não confere. */
  condicoes: string
  /** A técnica do link "Evolui para", achada pelo nome; `null` = sem link, ou o nome não acha nenhuma. */
  para: CartaoDaFicha | null
  /** O nome escrito em "Evolui para" ('' = sem link). Escrito e `para` null: a tela avisa "não achada". */
  paraEscrito: string
  /** Sem link: a técnica que o nome sugere (`sugestaoDeEvolucao`), para o editor da ficha. Com link: `null`. */
  sugestao: CartaoDaFicha | null
  /** O texto da Evolution diz OVERLOAD: sem link, o uso evoluído conta como Overload (sem reação, 1 por batalha). */
  overload: boolean
}

/** Os extras da evolução lidos do cartão; `null` = nenhum. */
function extrasDaEvolucao(cartao: Pick<CartaoDaFicha, 'extras'>): { texto: string; condicoes: string; paraEscrito: string } | null {
  let achou = false
  const lidos = { texto: '', condicoes: '', paraEscrito: '' }
  for (const extra of cartao.extras) {
    const nome = nomeDoExtra(extra.nome)
    const valor = extra.valor.trim()
    if (EXTRA_DA_EVOLUCAO.test(nome)) lidos.texto ||= valor
    else if (EXTRA_DAS_CONDICOES.test(nome)) lidos.condicoes ||= valor
    else if (EXTRA_DO_LINK.test(nome)) lidos.paraEscrito ||= semEspacosSobrando(valor)
    else continue
    achou = true
  }
  return achou ? lidos : null
}

/** O cartão já tem algum extra da evolução ("Evolução", "Condições...", "Evolui para"): o "+ Evolução" da ficha não repete. */
export function temExtrasDaEvolucao(cartao: Pick<CartaoDaFicha, 'extras'>): boolean {
  return extrasDaEvolucao(cartao) !== null
}

/** Só o link: a técnica de "Evolui para" (sem a sugestão por nome, que varre todas). */
function linkDe(cartao: CartaoDaFicha, todos: readonly CartaoDaFicha[]): CartaoDaFicha | null {
  const paraEscrito = extrasDaEvolucao(cartao)?.paraEscrito ?? ''
  return paraEscrito === '' ? null : cartaoPeloNome(paraEscrito, todos, cartao.id)
}

/**
 * A evolução da técnica: extras "Evolution"/"Evolução", "Condições do
 * Evolution" e "Evolui para", ou o campo Tipo "Evolução". `todos` = as
 * técnicas do personagem que valem agora (`tecnicasDe`). `null` = a técnica
 * não evolui.
 * Ex. (cópia da ficha real): CAÇA AS BRUXAS! = texto "...se tornando
 * OVERLOAD.", condições "Melodia de todas as coisas tem que está ativada...",
 * sem link, sugestão SUPER CAÇA AS BRUXAS!, overload.
 */
export function evolucaoDe(cartao: CartaoDaFicha, todos: readonly CartaoDaFicha[]): EvolucaoDaHabilidade | null {
  const extras = extrasDaEvolucao(cartao)
  if (extras === null && lerTipo(cartao).tipo !== 'evolucao') return null
  const { texto, condicoes, paraEscrito } = extras ?? { texto: '', condicoes: '', paraEscrito: '' }
  const para = paraEscrito === '' ? null : cartaoPeloNome(paraEscrito, todos, cartao.id)
  return { texto, condicoes, para, paraEscrito, sugestao: para === null ? sugestaoDeEvolucao(cartao, todos) : null, overload: /\boverload\b/.test(normalizar(texto)) }
}

/** As técnicas que evoluem PARA esta (o "Evolui para" delas acha esta). Nenhuma = lista vazia. */
export function basesDaEvolucao(cartao: Pick<CartaoDaFicha, 'id'>, todos: readonly CartaoDaFicha[]): CartaoDaFicha[] {
  return todos.filter((outro) => outro.id !== cartao.id && linkDe(outro, todos)?.id === cartao.id)
}

/** A técnica evoluiu nesta batalha. */
export function evoluiuNaBatalha(evoluidas: readonly string[] | undefined, cartaoId: string): boolean {
  return (evoluidas ?? []).includes(cartaoId)
}

function nomeDe(cartao: Pick<CartaoDaFicha, 'nome'>): string {
  return cartao.nome.trim() || 'a técnica'
}

/**
 * Por que a técnica está apagada pela evolução, ou `null`. A evoluída por
 * link, com nenhuma base evoluída: "Evolução: evolua CAÇA AS BRUXAS!
 * primeiro" (decisão 5). A base evoluída com link: "Evoluiu: use SUPER CAÇA
 * AS BRUXAS!". Sem link nada apaga (a base vira "Evoluída").
 */
export function motivoDaEvolucao(cartao: CartaoDaFicha, todos: readonly CartaoDaFicha[], evoluidas: readonly string[] | undefined): string | null {
  const bases = basesDaEvolucao(cartao, todos)
  const [primeira] = bases
  if (primeira !== undefined && !bases.some((base) => evoluiuNaBatalha(evoluidas, base.id))) return `Evolução: evolua ${nomeDe(primeira)} primeiro`
  if (!evoluiuNaBatalha(evoluidas, cartao.id)) return null
  const para = linkDe(cartao, todos)
  return para === null ? null : `Evoluiu: use ${nomeDe(para)}`
}

/** O uso desta técnica é o evoluído SEM link (a base marcada "Evoluída"): o registro diz "(evoluída)". */
export function usoEvoluido(cartao: CartaoDaFicha, todos: readonly CartaoDaFicha[], evoluidas: readonly string[] | undefined): boolean {
  return evoluiuNaBatalha(evoluidas, cartao.id) && extrasOuTipoDeEvolucao(cartao) && linkDe(cartao, todos) === null
}

function extrasOuTipoDeEvolucao(cartao: CartaoDaFicha): boolean {
  return extrasDaEvolucao(cartao) !== null || lerTipo(cartao).tipo === 'evolucao'
}

/**
 * Overload nesta batalha: o da ficha (`ehOverload`) ou o uso evoluído sem
 * link cujo texto da Evolution diz OVERLOAD (sem reação, trava os outros
 * Overload). Ex.: CAÇA AS BRUXAS! evoluída sem "Evolui para" = Overload.
 */
export function overloadNaBatalha(cartao: CartaoDaFicha, todos: readonly CartaoDaFicha[], evoluidas: readonly string[] | undefined): boolean {
  if (ehOverload(cartao)) return true
  return usoEvoluido(cartao, todos, evoluidas) && (evolucaoDe(cartao, todos)?.overload ?? false)
}

/** O efeito que o detalhe mostra: evoluída sem link, o texto da Evolution (se tem); senão, o Efeito. */
export function efeitoNaBatalha(cartao: CartaoDaFicha, todos: readonly CartaoDaFicha[], evoluidas: readonly string[] | undefined): string {
  const efeito = cartao.campos[CAMPO_DO_EFEITO] ?? ''
  if (!usoEvoluido(cartao, todos, evoluidas)) return efeito
  return evolucaoDe(cartao, todos)?.texto || efeito
}

/** O combate com a técnica evoluída (já estava: o MESMO), no teto `EVOLUIDAS_MAX`. */
export function comEvoluida(combate: CombateDoPersonagem, cartaoId: string): CombateDoPersonagem {
  const evoluidas = combate.evoluidas ?? []
  if (evoluidas.includes(cartaoId)) return combate
  return { ...combate, evoluidas: [...evoluidas, cartaoId].slice(-EVOLUIDAS_MAX) }
}

/** O combate sem a técnica evoluída (o Desfazer); não estava: o MESMO. Lista vazia sai do objeto. */
export function semEvoluida(combate: CombateDoPersonagem, cartaoId: string): CombateDoPersonagem {
  const evoluidas = combate.evoluidas ?? []
  if (!evoluidas.includes(cartaoId)) return combate
  const ficam = evoluidas.filter((id) => id !== cartaoId)
  const novo: CombateDoPersonagem = { ...combate }
  if (ficam.length > 0) novo.evoluidas = ficam
  else delete novo.evoluidas
  return novo
}

/** O custo do Evoluir: o digitado na tela, em SP; `null` ou 0 = nada. */
export function custoDaEvolucao(custo: number | null): LeituraDoCusto {
  return custo === null || custo <= 0 ? { tipo: 'nada' } : { tipo: 'valor', recurso: 'sp', valor: custo, porTurno: false }
}

/** O que a regra do Evoluir precisa da batalha. */
export interface ContextoDaEvolucao {
  /** O personagem da ficha `pedido.tokenId`; `null` = ficha sem personagem. */
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  turnos: TurnosDaCena
  /** Jogador: só na vez de uma carta do mesmo personagem. O mestre evolui sempre. */
  soNaVez: boolean
}

/**
 * Por que o Evoluir não vale, ou `null` (pode). A ficha está na luta com o
 * personagem; jogador, na vez dele; a técnica existe e evolui; não está
 * apagada esperando a base ("Evolução: evolua X primeiro"); ainda não
 * evoluiu; custo inteiro no teto e SP que dá. A condição da Evolution o app
 * NÃO confere (texto livre): quem aperta decide.
 */
export function motivoDoEvoluir(ctx: ContextoDaEvolucao, pedido: PedidoDeEvolucao): string | null {
  const { personagem, sistema, turnos } = ctx
  if (personagem === null || sistema === null) return 'Ficha sem personagem não evolui'
  const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
  if (carta === undefined || carta.personagemId !== personagem.id) return 'A ficha não está na luta'
  if (ctx.soNaVez && cartaDaVez(turnos)?.personagemId !== personagem.id) return 'Evoluir só na sua vez'
  return motivoDoEvoluirNaFicha(personagem, sistema, turnos.combate?.[personagem.id]?.evoluidas, pedido)
}

/**
 * A parte de `motivoDoEvoluir` que só olha a ficha e as evoluídas (sem a
 * ordem): a técnica existe e evolui, não está apagada esperando a base, ainda
 * não evoluiu, custo no teto e SP que dá. A tela do jogador usa esta (o
 * recorte não traz a ordem inteira; a vez ela confere à parte); o host
 * confere tudo de novo.
 */
export function motivoDoEvoluirNaFicha(personagem: Personagem, sistema: SistemaDeRpg, evoluidas: readonly string[] | undefined, pedido: Pick<PedidoDeEvolucao, 'cartaoId' | 'custo'>): string | null {
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return 'Técnica não encontrada na ficha'
  const { cartao } = achada
  const todos = tecnicasDe(personagem, sistema)
  if (evolucaoDe(cartao, todos) === null) return 'Esta técnica não evolui'
  if (evoluiuNaBatalha(evoluidas, cartao.id)) return 'Já evoluiu nesta batalha'
  const apagada = motivoDaEvolucao(cartao, todos, evoluidas)
  if (apagada !== null) return apagada
  if ((evoluidas?.length ?? 0) >= EVOLUIDAS_MAX) return 'Evoluções demais nesta batalha'
  if (pedido.custo !== null && (!Number.isInteger(pedido.custo) || pedido.custo < 0 || pedido.custo > CUSTO_MAX)) return 'Custo inválido'
  const custo = custoDaEvolucao(pedido.custo)
  if (custo.tipo !== 'valor') return null
  const recurso = recursoDoCusto(sistema, custo.recurso)
  if (recurso === null) return null
  const tem = numeroDaFicha(personagem.recursos, recurso.id)
  return tem < custo.valor ? `${recurso.nome} insuficiente: custa ${custo.valor}, você tem ${tem}` : null
}
