/**
 * BAÚ, CAIXA E BARRIL — as mensagens do objeto que se abre com minigame
 * (Fase C do pedido de 15/11/2026). Aditivo como o resto do protocolo:
 * jogador antigo cai no `default` e ignora; mestre antigo responde
 * `error invalid_message`.
 *
 *  - jogador → mestre: `objeto.abrir` (encostou e tocou no objeto) e
 *    `objeto.venceu` (o minigame da tela dele abriu);
 *  - mestre → jogador: `objeto.jogo` (o jogo, a semente e a dificuldade, só a
 *    quem pediu), `objeto.desfecho` (o que havia dentro e a armadilha, SÓ
 *    depois da vitória) e `objeto.recusado`.
 *
 * O conteúdo nunca sai antes da vitória: até lá o jogador só sabe que o
 * objeto se abre (`Prop.abrivel`). Falhar não tem consequência e não manda
 * nada: a tela tenta de novo sozinha.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

export type JogoDoObjetoNoFio = 'bau' | 'caixa' | 'barril'
const JOGOS: readonly JogoDoObjetoNoFio[] = ['bau', 'caixa', 'barril']
export type DificuldadeDoObjeto = 'normal' | 'dificil'
const DIFICULDADES: readonly DificuldadeDoObjeto[] = ['normal', 'dificil']
export type ArmadilhaNoFio = 'cobra' | 'aranha'

/** Por que o host não abriu o jogo. */
export type ObjetoMotivoDaRecusa = 'longe' | 'indisponivel' | 'aberto' | 'congelado' | 'ocupado'
export const OBJETO_MOTIVOS_DA_RECUSA: readonly ObjetoMotivoDaRecusa[] = ['longe', 'indisponivel', 'aberto', 'congelado', 'ocupado']

/** Tetos do que viaja: só barram lixo. */
export const OBJETO_ID_MAX = 128
export const OBJETO_SESSAO_MAX = 64
export const OBJETO_NOME_MAX = 80
export const OBJETO_ITENS_MAX = 40
/** Documentos ganhos num objeto (o teto do conteúdo é menor; este só barra lixo). */
const OBJETO_DOCUMENTOS_MAX = 20
const QUANTIDADE_MAX = 9999
const NUMERO_MAX = 999_999

/** O que a tela do jogador mostra ao abrir: o que levou e a armadilha (o mesmo contrato do overlay). */
export interface DesfechoDoObjetoNoFio {
  armadilha: ArmadilhaNoFio | null
  /** `false` = o mestre desligou o jumpscare neste mapa: a cobra aparece parada, com o som. */
  jumpscare: boolean
  itens: { nome: string; quantidade: number }[]
  moedas: number
  /** Os títulos dos documentos que entraram agora na lista dele, com o "novo". Ausente = nenhum (e o mestre de antes nunca manda). */
  documentos?: string[]
  /** Vida tirada na picada (0 sem armadilha). */
  dano: number
  /** O nome da pastilha ("Envenenado", "Lento"); `null` sem armadilha. */
  efeito: string | null
  turnos: number
}

export type ObjetoPlayerMessage = { type: 'objeto.abrir'; propId: string } | { type: 'objeto.venceu'; sessao: string; propId: string }

export type ObjetoHostMessage =
  | { type: 'objeto.jogo'; sessao: string; propId: string; jogo: JogoDoObjetoNoFio; nome: string; semente: number; dificuldade: DificuldadeDoObjeto }
  | { type: 'objeto.desfecho'; sessao: string; propId: string; desfecho: DesfechoDoObjetoNoFio }
  | { type: 'objeto.recusado'; propId: string; motivo: ObjetoMotivoDaRecusa }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoAte(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function inteiroAte(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max
}

function umDaLista<T extends string>(lista: readonly T[], value: unknown): T | undefined {
  return lista.find((item) => item === value)
}

/** Do jogador, no host: a sessão confere o resto (alcance, recorte, objeto fechado). */
export function parseObjetoPlayerMessage(value: unknown): ObjetoPlayerMessage | null {
  if (!isRecord(value) || !textoAte(value.propId, OBJETO_ID_MAX)) return null
  if (value.type === 'objeto.abrir') return { type: 'objeto.abrir', propId: value.propId }
  if (value.type === 'objeto.venceu' && textoAte(value.sessao, OBJETO_SESSAO_MAX)) return { type: 'objeto.venceu', sessao: value.sessao, propId: value.propId }
  return null
}

function lerDesfecho(value: unknown): DesfechoDoObjetoNoFio | null {
  if (!isRecord(value) || typeof value.jumpscare !== 'boolean' || !Array.isArray(value.itens) || value.itens.length > OBJETO_ITENS_MAX) return null
  const armadilha = value.armadilha === null ? null : value.armadilha === 'cobra' || value.armadilha === 'aranha' ? value.armadilha : undefined
  if (armadilha === undefined) return null
  const itens: { nome: string; quantidade: number }[] = []
  for (const item of value.itens) {
    if (!isRecord(item) || !textoAte(item.nome, OBJETO_NOME_MAX) || !inteiroAte(item.quantidade, QUANTIDADE_MAX)) return null
    itens.push({ nome: item.nome, quantidade: item.quantidade })
  }
  if (!inteiroAte(value.moedas, NUMERO_MAX) || !inteiroAte(value.dano, NUMERO_MAX) || !inteiroAte(value.turnos, NUMERO_MAX)) return null
  const efeito = value.efeito === null ? null : textoAte(value.efeito, OBJETO_NOME_MAX) ? value.efeito : undefined
  if (efeito === undefined) return null
  const documentos = lerTitulosDosDocumentos(value.documentos)
  if (documentos === null) return null
  const desfecho: DesfechoDoObjetoNoFio = { armadilha, jumpscare: value.jumpscare, itens, moedas: value.moedas, dano: value.dano, efeito, turnos: value.turnos }
  if (documentos.length > 0) desfecho.documentos = documentos
  return desfecho
}

/** Ausente = nenhum; torto = a mensagem inteira cai. */
function lerTitulosDosDocumentos(value: unknown): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > OBJETO_DOCUMENTOS_MAX) return null
  const titulos: string[] = []
  for (const titulo of value) {
    if (!textoAte(titulo, OBJETO_NOME_MAX)) return null
    titulos.push(titulo)
  }
  return titulos
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia tela. */
export function parseObjetoHostMessage(value: unknown): ObjetoHostMessage | null {
  if (!isRecord(value) || !textoAte(value.propId, OBJETO_ID_MAX)) return null
  const propId = value.propId
  if (value.type === 'objeto.recusado') {
    const motivo = umDaLista(OBJETO_MOTIVOS_DA_RECUSA, value.motivo)
    return motivo === undefined ? null : { type: 'objeto.recusado', propId, motivo }
  }
  if (!textoAte(value.sessao, OBJETO_SESSAO_MAX)) return null
  const sessao = value.sessao
  if (value.type === 'objeto.jogo') {
    const jogo = umDaLista(JOGOS, value.jogo)
    const dificuldade = umDaLista(DIFICULDADES, value.dificuldade)
    if (jogo === undefined || dificuldade === undefined || !textoAte(value.nome, OBJETO_NOME_MAX) || !inteiroAte(value.semente, 0xffffffff)) return null
    return { type: 'objeto.jogo', sessao, propId, jogo, nome: value.nome, semente: value.semente, dificuldade }
  }
  if (value.type === 'objeto.desfecho') {
    const desfecho = lerDesfecho(value.desfecho)
    return desfecho === null ? null : { type: 'objeto.desfecho', sessao, propId, desfecho }
  }
  return null
}

/** O texto curto de cada recusa, na tela do jogador. */
export function textoDaRecusaDoObjeto(motivo: ObjetoMotivoDaRecusa): string {
  switch (motivo) {
    case 'longe':
      return 'Chegue mais perto para abrir.'
    case 'aberto':
      return 'Alguém já abriu.'
    case 'congelado':
      return 'Sua ficha está parada agora.'
    case 'ocupado':
      return 'Termine o que está jogando antes.'
    case 'indisponivel':
      return 'Não dá para abrir agora.'
  }
}
