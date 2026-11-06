import { isTauri } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import type { ContaDeJogador } from '../../lib/contasDosJogadores'
import { MOTOR_DRAGON_BALL, motorDoSistema } from '../../lib/motores'
import { ehRegistro, paraJson, proprio, type Json } from '../../lib/nuvem/json'
import { VERSAO_DO_FORMATO } from '../../lib/nuvem/tipos'
import { lerRpgDaPasta, type RpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { comandosDaR1, type ComandosDaR1 } from '../../net/nuvem/comandosDaR1'
import { pastaDaNuvemNoApp, pastaNoDisco, primitivasDoTauri } from '../../net/nuvem/discoDaNuvem'
import { vaiAoLobby } from '../../net/nuvem/emissor'
import { estadoNovo, gravarEstado, lerCampanhas, lerEstado, type CampanhaPublicada } from '../../net/nuvem/estadoNoDisco'
import { registrarELigar, retomarLobby } from '../../net/nuvem/nuvemNoApp'
import { copiasDeTreino, inimigosLiberadosDe, midiasDaFicha, semImagemEmbutida } from '../../net/nuvem/publicar'
import { listaDeNomes, membrosDasContas, NOME_DO_MESTRE, textoDoMotivo } from './textosDoLobby'

/**
 * AS TELAS DO LOBBY FALANDO COM A PONTE (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.4, fatias R1 e A6): guardar o Service Token ("Conta na nuvem"), conferir
 * quem é o app (`eu`), publicar a pasta e reenviar a lista de jogadores. O
 * HTTPS é do Rust (`nuvem.rs`); daqui sai só o comando, pelo adaptador
 * `net/nuvem/comandosDaR1.ts` (nome e argumentos de cada um num lugar só).
 *
 * Toda falha volta como `FalhaDoLobby`, com a frase pronta. Duas não são do
 * servidor: fora do app (navegador, jornadas e2e) e "ponte ainda não
 * instalada" (o app aberto é de antes da R1: o comando não existe). Nas duas
 * os botões dizem o motivo e não quebram nada.
 */

/** `cofre` = o Cofre do Windows não deu a credencial (a guardada está danificada): colar de novo a substitui. */
export type MotivoDaFalha = 'fora-do-app' | 'sem-ponte' | 'sem-credencial' | 'cofre' | 'sem-rede' | 'erro'

export interface FalhaDoLobby {
  t: MotivoDaFalha
  mensagem: string
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; falha: FalhaDoLobby }

const FORA_DO_APP: FalhaDoLobby = { t: 'fora-do-app', mensagem: 'O Lobby só funciona no app instalado do Labirinto (aqui é o navegador).' }
const SEM_PONTE: FalhaDoLobby = {
  t: 'sem-ponte',
  mensagem: 'A ponte com a nuvem ainda não está instalada neste app. Ela chega com a próxima versão do Labirinto; até lá, nada aqui fala com a Cloudflare.',
}

/** Os códigos da R1 que querem dizer "falta (ou não vale) o token". */
const CODIGOS_DE_CREDENCIAL: ReadonlySet<string> = new Set(['sem_credencial', 'acesso_negado', 'credencial_invalida'])

/** O erro do `invoke` lido: o da R1 (`{ codigo, mensagem }`) ou o do próprio Tauri (texto). */
export function falhaDoErro(erro: unknown): FalhaDoLobby {
  if (typeof erro === 'string') {
    // O Tauri responde em texto quando o comando não existe neste binário (app de antes da R1).
    return /not found|unknown command|not allowed/i.test(erro) ? SEM_PONTE : { t: 'erro', mensagem: erro }
  }
  if (ehRegistro(erro)) {
    const codigo = proprio(erro, 'codigo')
    const mensagem = proprio(erro, 'mensagem')
    const texto = typeof mensagem === 'string' && mensagem !== '' ? mensagem : 'A ponte da nuvem falhou.'
    if (typeof codigo === 'string' && CODIGOS_DE_CREDENCIAL.has(codigo)) return { t: 'sem-credencial', mensagem: texto }
    if (codigo === 'cofre') return { t: 'cofre', mensagem: texto }
    if (codigo === 'rede') return { t: 'sem-rede', mensagem: texto }
    return { t: 'erro', mensagem: texto }
  }
  return { t: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) }
}

const r1: ComandosDaR1 = comandosDaR1()

async function chamar<T>(fazer: (comandos: ComandosDaR1) => Promise<T>): Promise<Resultado<T>> {
  if (!isTauri()) return { ok: false, falha: FORA_DO_APP }
  try {
    return { ok: true, valor: await fazer(r1) }
  } catch (erro) {
    return { ok: false, falha: falhaDoErro(erro) }
  }
}

// ── Conta na nuvem ──────────────────────────────────────────────────────────

/** Se há Service Token guardado no Cofre do Windows (nunca o devolve). */
export function credencialGuardada(): Promise<Resultado<boolean>> {
  return chamar((comandos) => comandos.credencialGuardada())
}

/** Guarda o token colado (substitui o de antes) e acorda os laços parados por falta dele. */
export async function guardarCredencial(clientId: string, clientSecret: string): Promise<Resultado<null>> {
  const resultado = await chamar(async (comandos) => {
    await comandos.guardarCredencial(clientId.trim(), clientSecret.trim())
    return null
  })
  if (resultado.ok) retomarLobby()
  return resultado
}

export function apagarCredencial(): Promise<Resultado<null>> {
  return chamar(async (comandos) => {
    await comandos.apagarCredencial()
    return null
  })
}

export interface ContaConferida {
  email: string
  campanhas: number
}

/** `GET /api/eu`: o e-mail que o Access deu ao token (o do mestre) e quantas campanhas ele tem. */
export function conferirConta(): Promise<Resultado<ContaConferida>> {
  return chamar(async (comandos) => {
    const bruto = await comandos.pedir({ rota: 'eu' })
    const email = ehRegistro(bruto) ? proprio(bruto, 'email') : undefined
    const campanhas = ehRegistro(bruto) ? proprio(bruto, 'campanhas') : undefined
    return { email: typeof email === 'string' ? email : '?', campanhas: Array.isArray(campanhas) ? campanhas.length : 0 }
  })
}

// ── As campanhas publicadas no disco ────────────────────────────────────────

async function raizDaNuvem() {
  return pastaNoDisco(primitivasDoTauri, await pastaDaNuvemNoApp())
}

/** A campanha desta pasta, se ela já foi publicada (`<appData>/nuvem/campanhas.json`). */
export async function campanhaDaPasta(pastaId: string): Promise<CampanhaPublicada | null> {
  if (!isTauri()) return null
  const campanhas = await lerCampanhas(await raizDaNuvem())
  return campanhas.find((campanha) => campanha.pastaId === pastaId) ?? null
}

// ── Jogadores (rota `membros`) ──────────────────────────────────────────────

function corpoDosMembros(contas: readonly ContaDeJogador[]): Json {
  return { v: VERSAO_DO_FORMATO, nomeDoMestre: NOME_DO_MESTRE, membros: paraJson(membrosDasContas(contas)) }
}

export interface EnvioDosMembros {
  campanhas: number
  falha: FalhaDoLobby | null
}

/**
 * Reenvia a lista de jogadores (conta com e-mail) a TODAS as campanhas
 * publicadas: o e-mail é da conta, e toda pasta publicada usa as mesmas contas
 * (§5.4, "reenviado sozinho quando mudam contas, e-mail ou dono"). Sem
 * campanha publicada não há o que mandar.
 */
export async function reenviarMembros(contas: readonly ContaDeJogador[]): Promise<EnvioDosMembros> {
  if (!isTauri()) return { campanhas: 0, falha: null }
  const campanhas = await lerCampanhas(await raizDaNuvem())
  for (const campanha of campanhas) {
    const resultado = await chamar((comandos) => comandos.pedir({ rota: 'membros', campanhaId: campanha.campanhaId, corpo: corpoDosMembros(contas) }))
    if (!resultado.ok) return { campanhas: campanhas.length, falha: resultado.falha }
  }
  return { campanhas: campanhas.length, falha: null }
}

// ── Publicar a pasta ────────────────────────────────────────────────────────

export type SituacaoDaFichaPublicada = 'publicada' | 'ja-publicada' | 'recusada' | 'adiada'

export interface FichaNaPublicacao {
  fichaId: string
  nome: string
  situacao: SituacaoDaFichaPublicada
  motivo?: string
}

export interface Publicacao {
  campanha: CampanhaPublicada
  fichas: FichaNaPublicacao[]
  /** As cópias dos inimigos liberados para o treino (T8); `fichaId` é o da cópia. */
  inimigos: FichaNaPublicacao[]
  /** Imagens que subiram e que não subiram (a ficha sobe mesmo assim; a imagem falta no site). */
  imagens: { enviadas: number; falharam: number; falha: FalhaDoLobby | null }
  /** Fotos embutidas antigas que ficaram de fora (ainda não viraram mídia). */
  embutidasDeFora: number
  /** O sincronizador ligou (`false` = a razão foi para o aviso do app). */
  ligou: boolean
}

function situacaoDaResposta(resposta: unknown): { situacao: SituacaoDaFichaPublicada; motivo?: string } {
  const t = ehRegistro(resposta) ? proprio(resposta, 't') : undefined
  switch (t) {
    case 'ack':
      return { situacao: 'publicada' }
    case 'ja-publicada':
      return { situacao: 'ja-publicada' }
    case 'adiado':
      return { situacao: 'adiada', motivo: 'o servidor está no limite do dia; ela sobe sozinha depois' }
    case 'negado': {
      const motivo = ehRegistro(resposta) ? proprio(resposta, 'motivo') : undefined
      const detalhe = ehRegistro(resposta) ? proprio(resposta, 'detalhe') : undefined
      return { situacao: 'recusada', motivo: typeof motivo === 'string' ? textoDoMotivo(motivo, typeof detalhe === 'string' ? detalhe : undefined) : 'recusada pelo servidor' }
    }
    case 'conflito':
      return { situacao: 'recusada', motivo: 'outra mudança chegou antes; publique de novo' }
    default:
      return { situacao: 'recusada', motivo: 'o servidor não reconheceu o id desta ficha' }
  }
}

export interface PedidoDePublicacao {
  pastaId: string
  nome: string
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
  contas: readonly ContaDeJogador[]
  /** Os NPCs liberados para o treino (T8). Ausente = os do `rpg.json` da pasta. */
  inimigosLiberados?: readonly string[]
}

/** Quantas fichas desta pasta sobem: só de jogador, sem invocação (NPC fica no app, §5.1). */
export function fichasQueSobem(personagens: readonly Personagem[]): Personagem[] {
  return personagens.filter(vaiAoLobby)
}

// ── Dragon Ball fora da v1 (12.21) ──────────────────────────────────────────

/** O Dragon Ball que esta pasta levaria ao Lobby: o sistema, ou as fichas que sobem com o bloco `dbt`. */
export type DragonBallNaPasta = { t: 'sistema' } | { t: 'fichas'; fichas: Personagem[] }

/**
 * O sistema sozinho não basta: a ficha guarda o bloco `dbt` mesmo depois de a
 * pasta trocar para um sistema de motor padrão (`rpgComSistema` troca só o
 * sistema) ou de vir copiada de um mapa Dragon Ball, e cada mudança dela
 * subiria como op em `['dbt', campo]`, a que a 12.21 deixa fora da v1.
 */
export function dragonBallNaPasta(sistema: SistemaDeRpg | undefined, personagens: readonly Personagem[]): DragonBallNaPasta | null {
  if (motorDoSistema(sistema) === MOTOR_DRAGON_BALL) return { t: 'sistema' }
  const fichas = fichasQueSobem(personagens).filter((ficha) => ficha.dbt !== undefined)
  return fichas.length === 0 ? null : { t: 'fichas', fichas }
}

const POR_QUE_O_DRAGON_BALL_FICA_FORA =
  'No Dragon Ball os campos de um bloco andam juntos, e duas pessoas mudando dois campos do mesmo bloco brigariam. A publicação abre quando o bloco for detalhado campo a campo.'

/** "a ficha Goku tem" / "as fichas Goku e Vegeta têm" (no meio da frase; `noComeco` põe a maiúscula). */
export function fichasComOBloco(fichas: readonly Personagem[], noComeco = false): string {
  const nomes = listaDeNomes(fichas.map((ficha) => ficha.nome))
  const artigo = fichas.length === 1 ? 'a ficha' : 'as fichas'
  return `${noComeco ? artigo[0].toUpperCase() + artigo.slice(1) : artigo} ${nomes} ${fichas.length === 1 ? 'tem' : 'têm'}`
}

/** Por que esta pasta não pode ir ao Lobby por causa do Dragon Ball; `null` = pode. */
export function bloqueioDoDragonBall(sistema: SistemaDeRpg | undefined, personagens: readonly Personagem[]): string | null {
  const achado = dragonBallNaPasta(sistema, personagens)
  if (achado === null) return null
  if (achado.t === 'sistema') return `Pasta Dragon Ball ainda não vai ao Lobby. ${POR_QUE_O_DRAGON_BALL_FICA_FORA}`
  return `${fichasComOBloco(achado.fichas, true)} o bloco do Dragon Ball, e ficha Dragon Ball ainda não vai ao Lobby, nem numa pasta de outro sistema. ${POR_QUE_O_DRAGON_BALL_FICA_FORA}`
}

/**
 * PUBLICAR (§5.4): cria a campanha no servidor com o sistema, os jogadores
 * com e-mail e as fichas de jogador que ainda não existem lá; depois liga o
 * sincronizador desta pasta e sobe as imagens das fichas.
 *
 * O `clienteId` do publicar é o mesmo que o sincronizador vai usar (gravado no
 * `estado.json` antes do pedido): a mudança que o mestre fizer logo depois,
 * antes da primeira busca, tem a mesma chave de autoria da criação e não vira
 * conflito com ela (§5.2).
 */
export async function publicarPasta(pedido: PedidoDePublicacao): Promise<Resultado<Publicacao>> {
  // A mesma guarda do botão, aqui também: quem chamar sem passar pela tela não cria campanha nem liga o sincronizador.
  const dragonBall = bloqueioDoDragonBall(pedido.sistema, pedido.personagens)
  if (dragonBall !== null) return { ok: false, falha: { t: 'erro', mensagem: dragonBall } }
  if (!isTauri()) return { ok: false, falha: FORA_DO_APP }
  const raiz = await raizDaNuvem()
  const existente = (await lerCampanhas(raiz)).find((campanha) => campanha.pastaId === pedido.pastaId)
  const campanha: CampanhaPublicada = { campanhaId: existente?.campanhaId ?? `camp_${crypto.randomUUID()}`, pastaId: pedido.pastaId, nome: pedido.nome.trim().slice(0, 120) }
  const clienteId = await clienteIdDaCampanha(campanha)

  const limpas = fichasQueSobem(pedido.personagens).map(semImagemEmbutida)
  const fichas = limpas.map((limpa) => limpa.ficha)
  const liberados = await liberadosDoPedido(pedido)
  const copias = liberados === null ? null : copiasDeTreino(pedido.personagens, liberados)
  const corpo = corpoDoPublicar({ clienteId, nome: campanha.nome, sistema: pedido.sistema, contas: pedido.contas, fichas, copias })
  const resposta = await chamar((comandos) => comandos.pedir({ rota: 'publicar', campanhaId: campanha.campanhaId, corpo }))
  if (!resposta.ok) return resposta

  const relatorio = relatorioDe(fichas, respostasPorFicha(resposta.valor, 'fichas'))
  const inimigos = copias === null ? [] : relatorioDoTreino(copias, respostasPorFicha(resposta.valor, 'treino'))

  // A campanha entra na lista do disco e o sincronizador liga: daqui em diante, cada mudança sobe sozinha.
  const ligou = await registrarELigar(campanha)
  const imagens = await enviarMidias(campanha, [...fichas, ...(copias ?? [])], [...relatorio, ...inimigos])

  return {
    ok: true,
    valor: {
      campanha,
      fichas: relatorio,
      inimigos,
      imagens,
      embutidasDeFora: limpas.reduce((soma, limpa) => soma + limpa.tiradas, 0),
      ligou,
    },
  }
}

/** O `clienteId` da campanha (o do sincronizador, gravado no `estado.json`); a campanha nova ganha um antes do pedido. */
async function clienteIdDaCampanha(campanha: CampanhaPublicada): Promise<string> {
  const pastaDaCampanha = pastaNoDisco(primitivasDoTauri, await join(await pastaDaNuvemNoApp(), campanha.campanhaId))
  const estado = await lerEstado(pastaDaCampanha)
  if (estado !== null) return estado.clienteId
  const clienteId = crypto.randomUUID()
  await gravarEstado(pastaDaCampanha, estadoNovo(campanha.campanhaId, campanha.pastaId, clienteId))
  return clienteId
}

/** Os liberados do pedido ou do `rpg.json`; `null` = não deu para ler, e o servidor deixa as cópias de treino como estão. */
async function liberadosDoPedido(pedido: PedidoDePublicacao): Promise<readonly string[] | null> {
  if (pedido.inimigosLiberados !== undefined) return pedido.inimigosLiberados
  const lido = await lerRpgDaPasta(pedido.pastaId)
  return lido.ok ? inimigosLiberadosDe(lido.rpg) : null
}

interface PartesDoPublicar {
  clienteId: string
  nome: string
  sistema: SistemaDeRpg
  contas: readonly ContaDeJogador[]
  fichas: readonly Personagem[]
  /** `null` = sem a lista: as cópias de treino do servidor ficam como estão. */
  copias: readonly Personagem[] | null
}

/** O corpo do `POST publicar` (§5.4). `treino` é a lista INTEIRA de cópias: a que não vem sai do treino no servidor. */
function corpoDoPublicar({ clienteId, nome, sistema, contas, fichas, copias }: PartesDoPublicar): Json {
  const corpo: Json = {
    v: VERSAO_DO_FORMATO,
    clienteId,
    nome,
    nomeDoMestre: NOME_DO_MESTRE,
    sistema: paraJson(sistema),
    membros: paraJson(membrosDasContas(contas)),
    fichas: fichas.map((ficha) => paraJson(ficha)),
  }
  return copias === null ? corpo : { ...corpo, treino: copias.map((copia) => paraJson(copia)) }
}

/** A resposta do servidor de cada ficha, pela lista `campo` da resposta do publicar. */
function respostasPorFicha(valor: unknown, campo: 'fichas' | 'treino'): Map<string, unknown> {
  const porId = new Map<string, unknown>()
  const brutas = ehRegistro(valor) ? proprio(valor, campo) : undefined
  if (!Array.isArray(brutas)) return porId
  const lista: readonly unknown[] = brutas
  for (const bruta of lista) {
    const fichaId = ehRegistro(bruta) ? proprio(bruta, 'fichaId') : undefined
    if (typeof fichaId === 'string') porId.set(fichaId, ehRegistro(bruta) ? proprio(bruta, 'resposta') : undefined)
  }
  return porId
}

function relatorioDe(fichas: readonly Personagem[], porId: ReadonlyMap<string, unknown>): FichaNaPublicacao[] {
  return fichas.map((ficha): FichaNaPublicacao => ({ fichaId: ficha.id, nome: ficha.nome, ...situacaoDaResposta(porId.get(ficha.id)) }))
}

/** A cópia de treino não passa pela fila: adiada, ela não sobe sozinha depois, o mestre manda de novo. */
function relatorioDoTreino(copias: readonly Personagem[], porId: ReadonlyMap<string, unknown>): FichaNaPublicacao[] {
  return relatorioDe(copias, porId).map((inimigo) => (inimigo.situacao === 'adiada' ? { ...inimigo, motivo: 'o servidor está no limite do dia; mande de novo mais tarde' } : inimigo))
}

/** Sobe as imagens das fichas que estão no servidor (publicadas agora ou de antes). */
async function enviarMidias(campanha: CampanhaPublicada, fichas: readonly Personagem[], relatorio: readonly FichaNaPublicacao[]): Promise<Publicacao['imagens']> {
  const noServidor = new Set(relatorio.filter((ficha) => ficha.situacao === 'publicada' || ficha.situacao === 'ja-publicada').map((ficha) => ficha.fichaId))
  const ids = [...new Set(fichas.filter((ficha) => noServidor.has(ficha.id)).flatMap(midiasDaFicha))]
  let enviadas = 0
  let ultimaFalha: FalhaDoLobby | null = null
  for (const midiaId of ids) {
    const envio = await chamar((comandos) => comandos.enviarMidia(campanha.campanhaId, campanha.pastaId, midiaId))
    if (envio.ok) enviadas += 1
    else ultimaFalha = envio.falha
  }
  return { enviadas, falharam: ids.length - enviadas, falha: ultimaFalha }
}

// ── Inimigos liberados para o treino (T8) ───────────────────────────────────

export interface PedidoDoTreino {
  pastaId: string
  /** O RPG da pasta como ficou: os personagens e a lista `treino.inimigosLiberados`. */
  rpg: RpgDaPasta
  sistema: SistemaDeRpg | undefined
  /** As contas JÁ LIDAS do disco: o publicar troca a lista de jogadores do servidor por esta. */
  contas: readonly ContaDeJogador[]
}

/** `so-no-app` = a pasta não está no Lobby: a lista ficou guardada e sobe com o Publicar. */
export type EnvioDoTreino = { t: 'so-no-app' } | { t: 'enviado'; inimigos: FichaNaPublicacao[]; imagens: Publicacao['imagens'] }

/**
 * Manda ao Lobby as cópias de TODOS os inimigos liberados da pasta, pela
 * rota `publicar` (a única que cria ficha com `visivel:'treino'`), sem ficha
 * da mesa: o servidor cria a cópia nova, troca a que mudou e tira do treino a
 * que não veio. Repetir é seguro (o que não mudou não vira op).
 */
export async function enviarInimigosDoTreino(pedido: PedidoDoTreino): Promise<Resultado<EnvioDoTreino>> {
  if (!isTauri()) return { ok: false, falha: FORA_DO_APP }
  const campanha = await campanhaDaPasta(pedido.pastaId)
  if (campanha === null) return { ok: true, valor: { t: 'so-no-app' } }
  if (pedido.sistema === undefined) return { ok: false, falha: { t: 'erro', mensagem: 'O sistema universal desta pasta não está na biblioteca deste computador: sem ele, o Lobby não recebe nada.' } }
  const dragonBall = bloqueioDoDragonBall(pedido.sistema, pedido.rpg.personagens)
  if (dragonBall !== null) return { ok: false, falha: { t: 'erro', mensagem: dragonBall } }
  const clienteId = await clienteIdDaCampanha(campanha)
  const copias = copiasDeTreino(pedido.rpg.personagens, inimigosLiberadosDe(pedido.rpg))
  const corpo = corpoDoPublicar({ clienteId, nome: campanha.nome, sistema: pedido.sistema, contas: pedido.contas, fichas: [], copias })
  const resposta = await chamar((comandos) => comandos.pedir({ rota: 'publicar', campanhaId: campanha.campanhaId, corpo }))
  if (!resposta.ok) return resposta
  const inimigos = relatorioDoTreino(copias, respostasPorFicha(resposta.valor, 'treino'))
  const imagens = await enviarMidias(campanha, copias, inimigos)
  return { ok: true, valor: { t: 'enviado', inimigos, imagens } }
}
