import type { Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import {
  combateVazio,
  CUSTO_MAX,
  DANO_MAX,
  LEMBRADAS_MAX,
  LEMBRETES_MAX,
  MODS_POR_SELO_MAX,
  NOME_DO_SELO_MAX,
  SELOS_MAX,
  SELOS_POR_TOKEN_MAX,
  type CombateDoPersonagem,
  type LembreteDaPassiva,
  type ModDoSelo,
  type PedidoDePassiva,
  type SeloDaBatalha,
  type SeloPedido,
} from './combate'
import { varianteDoPedido } from './escolhaEEvolucao'
import { normalizar } from './formula'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO, CAMPO_DO_TEMPO, ehOverload, lerCusto, lerTempo, recursoDoCusto, tecnicaPorId, tecnicasComForma, type LeituraDoCusto, type LeituraDoTempo } from './leituraDaFicha'
import { ehNomeDeSelo, lerDuracao, lerMods, seloPedidoValido, selosDoToken, textoDoMod } from './selos'
import { lerTipo } from './tiposDaHabilidade'
import { cartaDaVez, type TurnosDaCena } from './turnos'

/**
 * PASSIVAS, tipos de habilidade F3 (seções 4b e 7 de
 * docs/planos/batalha-tipos-de-habilidade-plano.md, com as decisões 3 e 4 do
 * usuário de 31/10/2026): "Lembra, pergunta se ativa e dá os buffs". A
 * passiva NUNCA ativa sozinha: no gatilho (início do combate, virada para a
 * rodada N, vida abaixo de N%) sai um LEMBRETE ao dono, "Ativar / Agora
 * não"; Ativar cobra o custo, conta usos e recarga e põe o selo dourado com
 * os mods. O efeito "a cada turno" (Fortaleza: HP +30, FOR +10) é outro
 * lembrete, no começo da vez do dono, com Aplicar (pode pular).
 *
 * Leitura de texto erra: o gatilho, o selo e o efeito por turno são
 * SUGESTÃO, que a tela mostra e o mestre corrige (a tira Passivas ativa e
 * desliga a qualquer hora).
 *
 * Puro: sem store, sem rede.
 */

// ───────────────────────────────────────────────────────────────────────────
// Gatilho
// ───────────────────────────────────────────────────────────────────────────

/**
 * O que faz a passiva lembrar. "vida" = abaixo de `abaixoDe`% do HP (o único
 * requisito que o app confere sozinho). "requisito" = texto que o app NÃO
 * confere (só mostra). "sempre" = vale sempre: nunca lembra, só aparece na tira.
 */
export type GatilhoDaPassiva =
  | { tipo: 'inicio' }
  | { tipo: 'rodada'; rodada: number }
  | { tipo: 'vida'; abaixoDe: number }
  | { tipo: 'requisito'; texto: string }
  | { tipo: 'sempre' }

/** O extra que diz o gatilho à mão ("Gatilho: início da 3ª rodada"); vence a leitura dos campos. */
const NOME_DO_EXTRA_DO_GATILHO = 'gatilho'
/** O extra "Requisito" (Orquídea: Florescer): o texto que o app não confere. */
const NOME_DO_EXTRA_DO_REQUISITO = 'requisito'
/** Teto do texto do requisito na tira (a ficha guarda o inteiro). */
export const TEXTO_DO_REQUISITO_MAX = 160
/** A maior rodada que o gatilho aceita (número maior é texto torto). */
const RODADA_DO_GATILHO_MAX = 999

/** "3", "3º", "3ª", "3o": o ordinal depois do número (º e ª não se desfazem no `normalizar`). */
const ORDINAL = String.raw`\s*(?:º|ª|o|a)?`
/** "início da 3º rodada", "a partir do 3 turno", "na 3ª rodada", "a partir da rodada 3". */
const SINAIS_DA_RODADA: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:inicio|comeco|partir) d[ao]s? (\d{1,3})${ORDINAL} (?:rodada|turno)`),
  new RegExp(String.raw`\b(?:inicio|comeco|partir) d[ao] (?:rodada|turno) (\d{1,3})\b`),
  new RegExp(String.raw`\b(?:na|no) (\d{1,3})${ORDINAL} (?:rodada|turno)`),
  new RegExp(String.raw`\b(?:na|no) (?:rodada|turno) (\d{1,3})\b`),
]
/** "abaixo de 50% de HP", "menos de 30% da vida", "vida abaixo de 50%". */
const SINAIS_DA_VIDA: readonly RegExp[] = [
  /\b(?:abaixo|menos) d[ae] (\d{1,3}) ?% ?(?:(?:de|da|do|de sua|da sua|do seu) )?(?:hp|vida|pv)\b/,
  /\b(?:hp|vida|pv) (?:abaixo|menor que|menos) d[ae] (\d{1,3}) ?%/,
]
/** "abaixo da metade da vida" = 50%. */
const SINAL_DA_METADE = /\b(?:abaixo|menos) d[ae] metade d[aeo] (?:sua |seu )?(?:hp|vida|pv)\b/
const METADE = 50
/** "início do combate", "ao iniciar a batalha", "automaticamente em combate". */
const SINAL_DO_INICIO = /\b(?:inicio|comeco) d[ao] (?:combate|batalha|luta)\b|\bao (?:iniciar|comecar|entrar em) (?:o |a )?(?:combate|batalha|luta)\b|\bautomaticamente em (?:combate|batalha|luta)\b/
/** Texto que é condição ("Ao atingir inimigos...", "Quando..."): requisito. Sem isso, a passiva vale sempre. */
const SINAL_DO_REQUISITO = /^(?:ao|quando|se|caso|apos|depois|sempre que|enquanto)\b|\b(?:requisito|so pode|somente se|apenas se|desde que)\b/

function extraDe(cartao: Pick<CartaoDaFicha, 'extras'>, nome: string): string {
  return cartao.extras.find((extra) => normalizar(extra.nome) === nome)?.valor ?? ''
}

/** Texto que não diz nada para o gatilho: vazio, "-" ou só "Passiva". */
function semGatilho(normal: string): boolean {
  return normal.length === 0 || normal === '-' || /^passiva\.?$/.test(normal)
}

function rodadaDoTexto(normal: string): number | null {
  for (const sinal of SINAIS_DA_RODADA) {
    const numero = Number.parseInt(sinal.exec(normal)?.[1] ?? '', 10)
    if (numero >= 1 && numero <= RODADA_DO_GATILHO_MAX) return numero
  }
  return null
}

function vidaDoTexto(normal: string): number | null {
  if (SINAL_DA_METADE.test(normal)) return METADE
  for (const sinal of SINAIS_DA_VIDA) {
    const numero = Number.parseInt(sinal.exec(normal)?.[1] ?? '', 10)
    if (numero >= 1 && numero <= 100) return numero
  }
  return null
}

/** O gatilho que UM texto diz, nesta ordem: rodada, vida, início. `null` = não diz. */
function gatilhoDoTexto(texto: string): GatilhoDaPassiva | null {
  const normal = normalizar(texto)
  if (semGatilho(normal)) return null
  const rodada = rodadaDoTexto(normal)
  if (rodada !== null) return { tipo: 'rodada', rodada }
  const vida = vidaDoTexto(normal)
  if (vida !== null) return { tipo: 'vida', abaixoDe: vida }
  return SINAL_DO_INICIO.test(normal) ? { tipo: 'inicio' } : null
}

function textoDoRequisito(texto: string): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  return limpo.length <= TEXTO_DO_REQUISITO_MAX ? limpo : `${limpo.slice(0, TEXTO_DO_REQUISITO_MAX - 1)}…`
}

/**
 * O gatilho da passiva. Lido do extra "Gatilho", senão do Tempo, do Efeito,
 * da Ação e dos outros extras (o primeiro texto que diz algo vence). Nada
 * disso: o extra "Requisito", ou Efeito/Tempo com cara de condição ("Ao
 * atingir..."), é "requisito"; o resto, "sempre".
 * Ex. (ficha real de 31/10): Melodia (Tempo "início da 3º rodada") = rodada
 * 3; Fortaleza (extra "Ao ficar abaixo de 50% de HP...") = vida 50;
 * Mecânicas gerais (tudo "Passiva") = sempre; Olhar artístico (Efeito "Ao
 * atingir inimigos com disparos...") = requisito.
 */
export function gatilhoDaPassiva(cartao: Pick<CartaoDaFicha, 'campos' | 'extras'>): GatilhoDaPassiva {
  const outrosExtras = cartao.extras.filter((extra) => {
    const nome = normalizar(extra.nome)
    return nome !== NOME_DO_EXTRA_DO_GATILHO && nome !== NOME_DO_EXTRA_DO_REQUISITO
  })
  const textos = [
    extraDe(cartao, NOME_DO_EXTRA_DO_GATILHO),
    cartao.campos[CAMPO_DO_TEMPO] ?? '',
    cartao.campos[CAMPO_DO_EFEITO] ?? '',
    cartao.campos[CAMPO_DA_ACAO] ?? '',
    ...outrosExtras.map((extra) => extra.valor),
  ]
  for (const texto of textos) {
    const gatilho = gatilhoDoTexto(texto)
    if (gatilho !== null) return gatilho
  }
  const requisito = extraDe(cartao, NOME_DO_EXTRA_DO_REQUISITO)
  if (requisito.trim().length > 0) return { tipo: 'requisito', texto: textoDoRequisito(requisito) }
  for (const texto of [cartao.campos[CAMPO_DO_EFEITO] ?? '', cartao.campos[CAMPO_DO_TEMPO] ?? '']) {
    if (SINAL_DO_REQUISITO.test(normalizar(texto))) return { tipo: 'requisito', texto: textoDoRequisito(texto) }
  }
  return { tipo: 'sempre' }
}

/**
 * A chave de `lembradas` do gatilho: "cartaoId:inicio", "cartaoId:rodada3",
 * "cartaoId:vida50". `null` = gatilho que nunca lembra (requisito, sempre).
 */
export function chaveDoGatilho(cartaoId: string, gatilho: GatilhoDaPassiva): string | null {
  switch (gatilho.tipo) {
    case 'inicio':
      return `${cartaoId}:inicio`
    case 'rodada':
      return `${cartaoId}:rodada${gatilho.rodada}`
    case 'vida':
      return `${cartaoId}:vida${gatilho.abaixoDe}`
    case 'requisito':
    case 'sempre':
      return null
  }
}

/** A chave do lembrete "a cada turno" (não entra em `lembradas`: volta a cada vez do dono). */
export function chaveDoPorTurno(cartaoId: string): string {
  return `${cartaoId}:turno`
}

/** "Início do combate", "Rodada 3", "Vida abaixo de 50%", o texto do requisito, "Sempre". */
export function textoDoGatilho(gatilho: GatilhoDaPassiva): string {
  switch (gatilho.tipo) {
    case 'inicio':
      return 'Início do combate'
    case 'rodada':
      return `Rodada ${gatilho.rodada}`
    case 'vida':
      return `Vida abaixo de ${gatilho.abaixoDe}%`
    case 'requisito':
      return gatilho.texto
    case 'sempre':
      return 'Sempre'
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Selo da passiva e efeito "a cada turno"
// ───────────────────────────────────────────────────────────────────────────

/** "a cada turno", "no início de cada turno", "por turno", "toda rodada". "por 2 turnos" é duração, não repetição. */
const SINAL_DO_POR_TURNO = /\b(?:a cada|cada|todo|toda|todos os|todas as|por) (?:turnos?|rodadas?)\b/
/** "recupera 30 de HP", "cura 20 de vida", "ganha 15 de SP". */
const RECURSO_QUE_SOMA = /\b(?:recuper|cur|regener|ganh|receb|restaur|recobr)\w* (?:mais )?(\d{1,7}) ?(?:pontos? )?(?:(?:de|em) )?(hp|vida|pv|sp)\b/
/** "perde 10 de HP", "gasta 15 de SP". */
const RECURSO_QUE_TIRA = /\b(?:perd|gast|consom)\w* (\d{1,7}) ?(?:pontos? )?(?:de )?(hp|vida|pv|sp)\b/

/** As frases de um texto (o efeito por turno vem numa frase; o imediato, nas outras). */
function frasesDe(texto: string): string[] {
  return texto.split(/[.;\n]+/).map((frase) => frase.trim()).filter((frase) => frase.length > 0)
}

function ehPorTurno(frase: string): boolean {
  return SINAL_DO_POR_TURNO.test(normalizar(frase))
}

/** Onde o selo da passiva vai por padrão: no dono, ou num oponente que a tela pede ("escolhendo um oponente"). */
export type AlvoDaPassiva = 'dono' | 'oponente'

const SINAL_DO_OPONENTE = /\bescolhendo (?:um|o|uma|a) (?:oponente|inimigo|alvo)\b|\bcontra (?:um|o) (?:oponente|inimigo)\b/

/** Melodia ("escolhendo um oponente") = oponente; o resto, o dono. A tela deixa trocar. */
export function alvoDaPassiva(cartao: Pick<CartaoDaFicha, 'campos'>): AlvoDaPassiva {
  const textos = [cartao.campos[CAMPO_DO_EFEITO] ?? '', cartao.campos[CAMPO_DA_ACAO] ?? '']
  return textos.some((texto) => SINAL_DO_OPONENTE.test(normalizar(texto))) ? 'oponente' : 'dono'
}

/** A palavra de ligação que o corte deixa pendurada no fim ("Melodia de todas as"). */
const LIGACAO_NO_FIM = /\s+(?:de|da|do|das|dos|e|a|o|as|os|em|no|na|nos|nas|com|para|por)$/i

/**
 * O nome que cabe na pílula: sem parênteses ("(Passiva)"), cortado na palavra
 * dentro do teto e sem ligação pendurada ("Melodia de todas as coisas" =
 * "Melodia de todas"). Nada sobra: "Passiva".
 */
function nomeDoSeloDaPassiva(nome: string): string {
  const limpo = nome.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (limpo.length <= NOME_DO_SELO_MAX && ehNomeDeSelo(limpo)) return limpo
  const corte = limpo.slice(0, NOME_DO_SELO_MAX + 1)
  const espaco = corte.lastIndexOf(' ')
  let curto = (espaco > 0 ? corte.slice(0, espaco) : corte.slice(0, NOME_DO_SELO_MAX)).trim()
  while (LIGACAO_NO_FIM.test(curto)) curto = curto.replace(LIGACAO_NO_FIM, '')
  return ehNomeDeSelo(curto) ? curto : 'Passiva'
}

/**
 * O selo que Ativar sugere (pílula dourada, editável na tela): o nome curto
 * da passiva, os turnos de "por N turnos" (sem número = até desligar) e os
 * mods do Efeito, SEM as frases "a cada turno" (essas são do Aplicar).
 * Fortaleza (Efeito "Passiva") = Fortaleza, sem mods; os +10 de FOR vêm a
 * cada Aplicar.
 */
export function seloDaPassiva(cartao: Pick<CartaoDaFicha, 'nome' | 'campos'>, sistema: SistemaDeRpg): SeloPedido {
  const imediato = frasesDe(cartao.campos[CAMPO_DO_EFEITO] ?? '')
    .filter((frase) => !ehPorTurno(frase))
    .join('. ')
  const mods = lerMods(imediato, sistema)
  const selo: SeloPedido = { nome: nomeDoSeloDaPassiva(cartao.nome), turnos: lerDuracao(imediato, cartao.nome)?.turnos ?? null }
  return mods.length === 0 ? selo : { ...selo, mods }
}

/** Um recurso que o efeito por turno mexe: HP ou SP, com sinal. */
export interface RecursoDoPorTurno {
  recurso: 'hp' | 'sp'
  delta: number
}

/** O que a passiva repete a cada turno: recursos (cura, gasto) e mods que se somam ao selo dela. */
export interface EfeitoPorTurno {
  recursos: readonly RecursoDoPorTurno[]
  mods: readonly ModDoSelo[]
}

function recursoDoPorTurno(normal: string): RecursoDoPorTurno | null {
  const soma = RECURSO_QUE_SOMA.exec(normal)
  const tira = RECURSO_QUE_TIRA.exec(normal)
  const achado = soma ?? tira
  const valor = Number.parseInt(achado?.[1] ?? '', 10)
  if (achado === null || !(valor > 0) || valor > DANO_MAX) return null
  return { recurso: achado[2] === 'sp' ? 'sp' : 'hp', delta: soma === null ? -valor : valor }
}

/**
 * O efeito "a cada turno" (sugestão do Aplicar): as frases com "a cada
 * turno", "no início de cada turno" ou "por turno" do Efeito, do Tempo e dos
 * extras. Um recurso de cada (HP, SP) e um mod por alvo, o primeiro.
 * Fortaleza ("recupera 30 de HP no início de cada turno", "vai ganhando 10
 * de força a cada turno") = HP +30, FOR +10. `null` = nada a repetir.
 */
export function efeitoPorTurno(cartao: Pick<CartaoDaFicha, 'campos' | 'extras'>, sistema: SistemaDeRpg): EfeitoPorTurno | null {
  const textos = [cartao.campos[CAMPO_DO_EFEITO] ?? '', cartao.campos[CAMPO_DO_TEMPO] ?? '', ...cartao.extras.map((extra) => extra.valor)]
  const recursos: RecursoDoPorTurno[] = []
  const mods: ModDoSelo[] = []
  for (const frase of textos.flatMap(frasesDe).filter(ehPorTurno)) {
    const recurso = recursoDoPorTurno(normalizar(frase))
    if (recurso !== null && !recursos.some((outro) => outro.recurso === recurso.recurso)) recursos.push(recurso)
    for (const mod of lerMods(frase, sistema)) if (!mods.some((outro) => outro.alvo === mod.alvo)) mods.push(mod)
  }
  if (recursos.length === 0 && mods.length === 0) return null
  return { recursos, mods: mods.slice(0, MODS_POR_SELO_MAX) }
}

function comSinal(numero: number): string {
  return numero < 0 ? String(numero) : `+${numero}`
}

/** "HP +30, FOR +10": o efeito por turno no lembrete e na linha do registro. */
export function textoDoPorTurno(efeito: EfeitoPorTurno, sistema: SistemaDeRpg | null): string {
  const recursos = efeito.recursos.map((parte) => {
    const recurso = sistema === null ? null : recursoDoCusto(sistema, parte.recurso)
    return `${recurso?.nome ?? parte.recurso.toUpperCase()} ${comSinal(parte.delta)}`
  })
  return [...recursos, ...efeito.mods.map((mod) => textoDoMod(mod, sistema))].join(', ')
}

/** Os ajustes de HP/SP do Aplicar (a cura para no máximo em `aplicarAjustes`; o gasto, no 0). */
export function ajustesDoPorTurno(personagem: Personagem, sistema: SistemaDeRpg, efeito: EfeitoPorTurno): Ajuste[] {
  return efeito.recursos.flatMap((parte): Ajuste[] => {
    const recurso = recursoDoCusto(sistema, parte.recurso)
    if (recurso === null) return []
    return [{ parte: 'recurso', chave: recurso.id, valor: Math.max(0, numeroDaFicha(personagem.recursos, recurso.id) + parte.delta) }]
  })
}

/** Os mods do selo com os do Aplicar somados por alvo (FOR +10 e FOR +10 = FOR +20), no teto; soma 0 sai. */
export function modsSomados(antes: readonly ModDoSelo[] | undefined, mais: readonly ModDoSelo[]): ModDoSelo[] {
  const porAlvo = new Map<string, number>()
  for (const mod of [...(antes ?? []), ...mais]) porAlvo.set(mod.alvo, (porAlvo.get(mod.alvo) ?? 0) + mod.delta)
  return [...porAlvo.entries()]
    .map(([alvo, delta]) => ({ alvo, delta: Math.max(-DANO_MAX, Math.min(DANO_MAX, delta)) }))
    .filter((mod) => mod.delta !== 0)
    .slice(0, MODS_POR_SELO_MAX)
}

// ───────────────────────────────────────────────────────────────────────────
// Estado na tira
// ───────────────────────────────────────────────────────────────────────────

/** "ativa" = o selo dela está na luta; "pronta" = o gatilho bateu; "espera" = ainda não (com o texto); "sempre" = vale sempre. */
export type EstadoDaPassiva = 'ativa' | 'pronta' | 'espera' | 'sempre'

/** O que a tira precisa da batalha (o mestre tira da cena; o jogador, do recorte). */
export interface CenaDaPassiva {
  rodada: number
  /** As passivas ligadas deste personagem: `passivasLigadas(turnos.selos, id)` no mestre; `CombateParaJogador.passivasAtivas` no jogador. */
  ativas: ReadonlySet<string>
  combate: Pick<CombateDoPersonagem, 'recargas' | 'usos' | 'overload' | 'lembretes'> | undefined
  /** Os selos que a ficha do dono já tem (o teto da pílula no dono); ausente = a tira não confere. */
  selosNoDono?: number
}

/** Uma passiva como a tira Passivas (menu da vez, perfil da carta, painel do NPC) a mostra. */
export interface PassivaNaTira {
  cartao: CartaoDaFicha
  /** A transformação ligada de onde a passiva vem. */
  forma?: string
  /** Nunca vazio. */
  nome: string
  gatilho: GatilhoDaPassiva
  /** "Rodada 3", "Vida abaixo de 50%", o texto do requisito, "Sempre". */
  textoDoGatilho: string
  estado: EstadoDaPassiva
  custo: LeituraDoCusto
  tempo: LeituraDoTempo
  overload: boolean
  /** Onde a tela põe o selo por padrão. "oponente" = a tela pede o alvo antes de Ativar. */
  alvo: AlvoDaPassiva
  /** O selo sugerido (editável): vai no pedido como `selo`. */
  selo: SeloPedido
  /** O que repetir no começo da vez ("HP +30, FOR +10"); `null` = nada. */
  porTurno: EfeitoPorTurno | null
  /** Por que Ativar está apagado (Overload, recarga, usos, SP, teto de selos); `null` = pode. Ativa: `null` (o botão é Desligar). */
  motivo: string | null
  /** O lembrete esperando resposta; `null` = nenhum. */
  lembrete: LembreteDaPassiva | null
}

/** O nome do botão quando o cartão não tem nome. */
const PASSIVA_SEM_NOME = 'Passiva sem nome'

/** É passiva: o Tipo (campo, ou deduzido da Ação "Passiva..."). */
export function ehPassiva(cartao: Pick<CartaoDaFicha, 'campos'>): boolean {
  return lerTipo(cartao).tipo === 'passiva'
}

/** A vida do personagem está abaixo de `porcento`% do máximo. Sem vida no sistema: não. */
export function vidaAbaixoDe(personagem: Personagem, sistema: SistemaDeRpg | null, porcento: number): boolean {
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return vida !== null && vida.atual * 100 < porcento * vida.maximo
}

/** O gatilho já bateu agora (o "pronta" da tira). Requisito e sempre: nunca (o app não confere). */
function gatilhoBateu(gatilho: GatilhoDaPassiva, rodada: number, personagem: Personagem, sistema: SistemaDeRpg | null): boolean {
  switch (gatilho.tipo) {
    case 'inicio':
      return true
    case 'rodada':
      return rodada >= gatilho.rodada
    case 'vida':
      return vidaAbaixoDe(personagem, sistema, gatilho.abaixoDe)
    case 'requisito':
    case 'sempre':
      return false
  }
}

function estadoDe(gatilho: GatilhoDaPassiva, ativa: boolean, bateu: boolean): EstadoDaPassiva {
  if (ativa) return 'ativa'
  if (gatilho.tipo === 'sempre') return 'sempre'
  return bateu ? 'pronta' : 'espera'
}

function turnos(n: number): string {
  return n === 1 ? '1 turno' : `${n} turnos`
}

/** O custo confirmado na tela vale sobre o da ficha, no recurso que a ficha diz (SP por padrão), como no golpe. */
export function custoDaPassiva(cartao: Pick<CartaoDaFicha, 'campos'>, personagem: Personagem, custo: number | null): LeituraDoCusto {
  const lido = lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
  if (custo === null) return lido
  return { tipo: 'valor', recurso: lido.tipo === 'nada' ? 'sp' : lido.recurso, valor: custo, porTurno: false }
}

/**
 * Por que a passiva não ativa agora (sem olhar a vez: passiva não gasta
 * ação), ou `null`. Overload usado, recarga, usos do Tempo, recurso que não
 * dá. Custo que é pergunta não apaga: a tela pergunta.
 */
function motivoDoUso(
  tecnica: { cartao: Pick<CartaoDaFicha, 'id'>; custo: LeituraDoCusto; tempo: LeituraDoTempo; overload: boolean },
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: Pick<CombateDoPersonagem, 'recargas' | 'usos' | 'overload'> | undefined,
): string | null {
  if (tecnica.overload && combate?.overload === true) return 'Overload: já usado nesta batalha'
  const recarga = combate?.recargas[tecnica.cartao.id] ?? 0
  if (recarga > 0) return `Recarga: ${turnos(recarga)}`
  if (tecnica.tempo.tipo === 'usos') {
    const usadas = combate?.usos[tecnica.cartao.id] ?? 0
    if (usadas >= tecnica.tempo.vezes) return `Já usada nesta batalha (${usadas}/${tecnica.tempo.vezes})`
  }
  if (tecnica.custo.tipo === 'valor') {
    const recurso = recursoDoCusto(sistema, tecnica.custo.recurso)
    if (recurso !== null) {
      const tem = numeroDaFicha(personagem.recursos, recurso.id)
      if (tem < tecnica.custo.valor) return `${recurso.nome} insuficiente: custa ${tecnica.custo.valor}, você tem ${tem}`
    }
  }
  return null
}

/** O motivo do teto de selos na ficha que recebe o selo da passiva. */
function motivoDoTeto(nome: string, selosNaFicha: number, selosNaCena: number): string | null {
  if (selosNaFicha >= SELOS_POR_TOKEN_MAX) return `A ficha já tem ${SELOS_POR_TOKEN_MAX} selos: tire um para ativar ${nome}`
  if (selosNaCena >= SELOS_MAX) return `A luta já tem ${SELOS_MAX} selos: tire um para ativar ${nome}`
  return null
}

/**
 * As passivas do personagem (Habilidades e transformações ligadas), na ordem
 * da ficha, com o estado e o que a tira mostra. A mesma função no menu da vez,
 * no perfil da carta e no painel do NPC.
 * Ex. (ficha real): May = Fortaleza (vida 50: "espera" acima de 50%,
 * "pronta" abaixo, com Aplicar "HP +30, FOR +10"); Siegfried = Melodia
 * (rodada 3, 15 SP, alvo oponente); Vagn = Mecânicas gerais ("sempre");
 * Vincent = Olhar artístico ("espera", com o texto do requisito).
 */
export function passivasDe(personagem: Personagem, sistema: SistemaDeRpg, cena: CenaDaPassiva): PassivaNaTira[] {
  return tecnicasComForma(personagem, sistema)
    .filter(({ cartao }) => ehPassiva(cartao))
    .map(({ cartao, forma }) => {
      const gatilho = gatilhoDaPassiva(cartao)
      const ativa = cena.ativas.has(cartao.id)
      const nome = cartao.nome.trim() || PASSIVA_SEM_NOME
      const custo = custoDaPassiva(cartao, personagem, null)
      const tempo = lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? '')
      const overload = ehOverload(cartao)
      const alvo = alvoDaPassiva(cartao)
      const teto = alvo === 'dono' && cena.selosNoDono !== undefined ? motivoDoTeto(nome, cena.selosNoDono, 0) : null
      const passiva: PassivaNaTira = {
        cartao,
        nome,
        gatilho,
        textoDoGatilho: textoDoGatilho(gatilho),
        estado: estadoDe(gatilho, ativa, gatilhoBateu(gatilho, cena.rodada, personagem, sistema)),
        custo,
        tempo,
        overload,
        alvo,
        selo: seloDaPassiva(cartao, sistema),
        porTurno: efeitoPorTurno(cartao, sistema),
        motivo: ativa ? null : (motivoDoUso({ cartao, custo, tempo, overload }, personagem, sistema, cena.combate) ?? teto),
        lembrete: (cena.combate?.lembretes ?? []).find((lembrete) => lembrete.cartaoId === cartao.id) ?? null,
      }
      if (forma !== undefined) passiva.forma = forma
      return passiva
    })
}

// ───────────────────────────────────────────────────────────────────────────
// Selos da passiva na luta
// ───────────────────────────────────────────────────────────────────────────

/** É selo posto por passiva deste personagem. */
function ehSeloDaPassiva(selo: Pick<SeloDaBatalha, 'natureza' | 'donoId' | 'cartaoId'>, personagemId: string): boolean {
  return selo.natureza === 'passiva' && selo.donoId === personagemId && selo.cartaoId !== undefined
}

/** Os cartaoIds das passivas ligadas do personagem: as que têm selo dourado na luta (no dono ou no oponente). */
export function passivasLigadas(selos: readonly SeloDaBatalha[] | undefined, personagemId: string): Set<string> {
  const ligadas = new Set<string>()
  for (const selo of selos ?? []) if (ehSeloDaPassiva(selo, personagemId) && selo.cartaoId !== undefined) ligadas.add(selo.cartaoId)
  return ligadas
}

/** Os selos que a passiva `cartaoId` do personagem pôs (Desligar tira todos; Aplicar soma no primeiro). */
export function selosDaPassiva(selos: readonly SeloDaBatalha[] | undefined, personagemId: string, cartaoId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => ehSeloDaPassiva(selo, personagemId) && selo.cartaoId === cartaoId)
}

// ───────────────────────────────────────────────────────────────────────────
// Lembretes
// ───────────────────────────────────────────────────────────────────────────

/** O combate com o lembrete esperando (um por passiva: o novo troca o velho) e, no "ativar", a chave em `lembradas`. */
export function comLembrete(combate: CombateDoPersonagem, lembrete: LembreteDaPassiva): CombateDoPersonagem {
  const lembretes = [...(combate.lembretes ?? []).filter((outro) => outro.cartaoId !== lembrete.cartaoId), lembrete].slice(-LEMBRETES_MAX)
  const novo: CombateDoPersonagem = { ...combate, lembretes }
  return lembrete.tipo === 'ativar' ? comLembrada(novo, lembrete.chave) : novo
}

/** O combate com a chave em `lembradas` (já estava: o MESMO). */
export function comLembrada(combate: CombateDoPersonagem, chave: string): CombateDoPersonagem {
  const lembradas = combate.lembradas ?? []
  if (lembradas.includes(chave)) return combate
  return { ...combate, lembradas: [...lembradas, chave].slice(-LEMBRADAS_MAX) }
}

/** O combate sem os lembretes da passiva (nenhum: o MESMO). Lista vazia sai do objeto. */
export function semLembretes(combate: CombateDoPersonagem, cartaoId: string): CombateDoPersonagem {
  const lembretes = combate.lembretes ?? []
  if (!lembretes.some((lembrete) => lembrete.cartaoId === cartaoId)) return combate
  const ficam = lembretes.filter((lembrete) => lembrete.cartaoId !== cartaoId)
  const novo: CombateDoPersonagem = { ...combate }
  if (ficam.length > 0) novo.lembretes = ficam
  else delete novo.lembretes
  return novo
}

/** O lembrete da passiva esperando no combate; `null` = nenhum. */
export function lembreteDe(combate: Pick<CombateDoPersonagem, 'lembretes'> | undefined, cartaoId: string): LembreteDaPassiva | null {
  return (combate?.lembretes ?? []).find((lembrete) => lembrete.cartaoId === cartaoId) ?? null
}

/** O momento em que o host olha os gatilhos: o Iniciar, a virada da rodada, depois de um dano. */
export type MomentoDaPassiva = 'inicio' | 'rodada' | 'dano'

/** O que os gatilhos precisam da mesa. */
export interface FichasDaPassiva {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
}

/** Uma passiva cujo gatilho bateu agora e ainda não lembrou. */
export interface PassivaQueDispara {
  personagemId: string
  /** A primeira ficha do personagem na ordem (onde o lembrete aparece). */
  tokenId: string
  cartaoId: string
  chave: string
}

/** Os gatilhos que o momento olha: o Iniciar olha todos (quem já começa abaixo de 50% também lembra); a virada, só rodada; o dano, só vida. */
function momentoOlha(momento: MomentoDaPassiva, gatilho: GatilhoDaPassiva): boolean {
  switch (momento) {
    case 'inicio':
      return gatilho.tipo === 'inicio' || gatilho.tipo === 'rodada' || gatilho.tipo === 'vida'
    case 'rodada':
      return gatilho.tipo === 'rodada'
    case 'dano':
      return gatilho.tipo === 'vida'
  }
}

/** Cada personagem com carta na ordem, uma vez, com a primeira ficha dele. */
function combatentes(turnos: TurnosDaCena): { personagemId: string; tokenId: string }[] {
  const vistos = new Map<string, string>()
  for (const carta of turnos.cartas) if (carta.personagemId !== null && !vistos.has(carta.personagemId)) vistos.set(carta.personagemId, carta.tokenId)
  return [...vistos].map(([personagemId, tokenId]) => ({ personagemId, tokenId }))
}

/**
 * As passivas que o `momento` dispara: gatilho que bateu (início; rodada >=
 * N; vida abaixo de N%), passiva desligada, chave fora de `lembradas` e sem
 * lembrete esperando. NUNCA ativa: quem chama só põe o lembrete (`comLembrete`).
 * Ex.: na virada para a rodada 3, Melodia de Siegfried; depois do dano que
 * leva May a 49%, Fortaleza.
 */
export function passivasQueDisparam(momento: MomentoDaPassiva, turnos: TurnosDaCena, mesa: FichasDaPassiva): PassivaQueDispara[] {
  const { sistema } = mesa
  if (sistema === null) return []
  const disparam: PassivaQueDispara[] = []
  for (const { personagemId, tokenId } of combatentes(turnos)) {
    const personagem = mesa.personagens.find((candidato) => candidato.id === personagemId)
    if (personagem === undefined) continue
    const combate = turnos.combate?.[personagemId]
    const ligadas = passivasLigadas(turnos.selos, personagemId)
    for (const { cartao } of tecnicasComForma(personagem, sistema)) {
      if (!ehPassiva(cartao) || ligadas.has(cartao.id) || lembreteDe(combate, cartao.id) !== null) continue
      const gatilho = gatilhoDaPassiva(cartao)
      const chave = chaveDoGatilho(cartao.id, gatilho)
      if (chave === null || !momentoOlha(momento, gatilho) || (combate?.lembradas ?? []).includes(chave)) continue
      if (gatilhoBateu(gatilho, turnos.rodada, personagem, sistema)) disparam.push({ personagemId, tokenId, cartaoId: cartao.id, chave })
    }
  }
  return disparam
}

/** Os turnos com combate novo e, por personagem que mudou, o combate de antes (a parte "combate" do Desfazer). */
export interface TurnosComLembretes {
  turnos: TurnosDaCena
  mudaram: { personagemId: string; antes: CombateDoPersonagem | null }[]
}

function comCombates(turnos: TurnosDaCena, novos: ReadonlyMap<string, CombateDoPersonagem>): TurnosComLembretes {
  if (novos.size === 0) return { turnos, mudaram: [] }
  const mudaram = [...novos.keys()].map((personagemId) => ({ personagemId, antes: turnos.combate?.[personagemId] ?? null }))
  return { turnos: { ...turnos, combate: { ...(turnos.combate ?? {}), ...Object.fromEntries(novos) } }, mudaram }
}

/** Os lembretes "ativar" que o momento dispara, já nos turnos (`passivasQueDisparam` + `comLembrete`). Nada: os MESMOS turnos. */
export function comLembretesDoMomento(momento: MomentoDaPassiva, turnos: TurnosDaCena, mesa: FichasDaPassiva): TurnosComLembretes {
  const novos = new Map<string, CombateDoPersonagem>()
  for (const dispara of passivasQueDisparam(momento, turnos, mesa)) {
    const combate = novos.get(dispara.personagemId) ?? turnos.combate?.[dispara.personagemId] ?? combateVazio()
    novos.set(dispara.personagemId, comLembrete(combate, { cartaoId: dispara.cartaoId, tokenId: dispara.tokenId, tipo: 'ativar', chave: dispara.chave, rodada: turnos.rodada }))
  }
  return comCombates(turnos, novos)
}

/**
 * O lembrete "a cada turno" no começo da vez (decisão 4): as passivas
 * LIGADAS do personagem da carta da vez que têm `efeitoPorTurno`. Troca o
 * lembrete velho da mesma passiva. Nada: os MESMOS turnos.
 */
export function comLembretesDaVez(turnos: TurnosDaCena, mesa: FichasDaPassiva): TurnosComLembretes {
  const carta = cartaDaVez(turnos)
  const { sistema } = mesa
  if (carta === null || carta.personagemId === null || sistema === null) return { turnos, mudaram: [] }
  const personagemId = carta.personagemId
  const personagem = mesa.personagens.find((candidato) => candidato.id === personagemId)
  const ligadas = passivasLigadas(turnos.selos, personagemId)
  if (personagem === undefined || ligadas.size === 0) return { turnos, mudaram: [] }
  let combate = turnos.combate?.[personagemId] ?? combateVazio()
  const antes = combate
  for (const { cartao } of tecnicasComForma(personagem, sistema)) {
    if (!ligadas.has(cartao.id) || efeitoPorTurno(cartao, sistema) === null) continue
    combate = comLembrete(combate, { cartaoId: cartao.id, tokenId: carta.tokenId, tipo: 'porTurno', chave: chaveDoPorTurno(cartao.id), rodada: turnos.rodada })
  }
  return combate === antes ? { turnos, mudaram: [] } : comCombates(turnos, new Map([[personagemId, combate]]))
}

// ───────────────────────────────────────────────────────────────────────────
// Regra do pedido (mesma no mestre e no host)
// ───────────────────────────────────────────────────────────────────────────

/** O que a regra da passiva precisa da batalha. */
export interface ContextoDaPassiva {
  /** O personagem da ficha `pedido.tokenId`; `null` = ficha sem personagem. */
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  turnos: TurnosDaCena
  /** Jogador: Aplicar só com o lembrete "a cada turno" esperando (o mestre aplica quando quiser). */
  aplicarSoComLembrete: boolean
}

/**
 * Por que o pedido não vale, ou `null` (pode). A passiva é do personagem da
 * ficha e é passiva; Ativar: desligada, custo no teto e confirmado (o da
 * ficha não pode ser pergunta), selo dentro das regras, alvo na luta,
 * Overload/recarga/usos/recurso e o teto de selos da ficha que recebe;
 * Desligar: ligada; Aplicar: ligada, com efeito por turno; "Agora não": com
 * lembrete esperando.
 */
export function motivoDaPassiva(ctx: ContextoDaPassiva, pedido: PedidoDePassiva): string | null {
  const { personagem, sistema, turnos } = ctx
  if (personagem === null || sistema === null) return 'Ficha sem personagem não tem passiva'
  const carta = turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
  if (carta === undefined || carta.personagemId !== personagem.id) return 'A ficha não está na luta'
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return 'Passiva não encontrada na ficha'
  const { cartao } = achada
  if (!ehPassiva(cartao)) return 'Esta habilidade não é passiva'
  const ligada = passivasLigadas(turnos.selos, personagem.id).has(cartao.id)
  const combate = turnos.combate?.[personagem.id]
  if (pedido.tipo === 'lembrete') {
    const lembrete = lembreteDe(combate, cartao.id)
    if (!pedido.aplicar) return lembrete === null ? 'Nenhum lembrete desta passiva' : null
    if (!ligada) return 'Ative a passiva primeiro'
    if (efeitoPorTurno(cartao, sistema) === null) return 'A passiva não tem efeito a cada turno'
    return ctx.aplicarSoComLembrete && lembrete?.tipo !== 'porTurno' ? 'Aplicar só no começo da sua vez' : null
  }
  if (!pedido.ligar) return ligada ? null : 'A passiva não está ativa'
  if (ligada) return 'A passiva já está ativa'
  // Tipos de habilidade F4 (mudança mínima na F3): a opção do Ativar (Melodia) tem de ser opção desta passiva.
  if (pedido.variante !== undefined && varianteDoPedido(cartao, pedido.variante) === null) return 'Opção não encontrada na passiva'
  if (pedido.custo !== null && (!Number.isInteger(pedido.custo) || pedido.custo < 0 || pedido.custo > CUSTO_MAX)) return 'Custo inválido'
  if (pedido.selo !== undefined && seloPedidoValido(pedido.selo, sistema) === null) return 'Selo inválido'
  const alvoTokenId = pedido.alvoTokenId ?? pedido.tokenId
  if (!turnos.cartas.some((candidata) => candidata.tokenId === alvoTokenId)) return 'O alvo precisa estar na luta'
  const custo = custoDaPassiva(cartao, personagem, pedido.custo)
  if (custo.tipo === 'pergunta') return 'Confirme o custo'
  const nome = cartao.nome.trim() || PASSIVA_SEM_NOME
  const uso = motivoDoUso({ cartao, custo, tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''), overload: ehOverload(cartao) }, personagem, sistema, combate)
  return uso ?? motivoDoTeto(nome, selosDoToken(turnos.selos, alvoTokenId).length, turnos.selos?.length ?? 0)
}
