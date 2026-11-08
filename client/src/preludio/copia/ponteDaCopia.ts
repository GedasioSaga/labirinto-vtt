import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { preparoLigado } from '../../lib/preparo/chave'
import { ehRegistro, proprio } from '../../lib/nuvem/json'

/**
 * A PONTE DA CÓPIA NO GOOGLE DRIVE (docs/planos/preludio-2026-11-08.md, "Depois do
 * conselho"): o login do Google e o HTTPS com o Drive são do Rust
 * (`desktop/src-tauri/src/preludio/`), com o refresh token no Cofre do Windows. Daqui
 * sai só o verbo; nenhum token chega à webview.
 *
 * Com a chave `preparo` desligada nada aqui chama o Rust (plano §5: sem a chave, nada
 * roda). O contrato, com nome e argumento de cada comando, está no topo de
 * `desktop/src-tauri/src/preludio/mod.rs`.
 */

export type MotivoDaFalha =
  | 'desligado'
  | 'fora-do-app'
  | 'sem-ponte'
  | 'sem-build'
  | 'sem-conta'
  | 'cancelado'
  | 'ocupado'
  | 'cofre'
  | 'sem-rede'
  | 'vazio'
  | 'erro'

export interface FalhaDaCopia {
  t: MotivoDaFalha
  mensagem: string
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; falha: FalhaDaCopia }

export interface ContaDoGoogle {
  /** A build tem o cliente do Google; sem ele, "Entrar" explica por que não entra. */
  credenciaisNaBuild: boolean
  /** `null` = ninguém entrou neste PC. */
  email: string | null
}

export interface UltimaCopia {
  /** Milissegundos desde 1970: quando a cópia foi feita (ou conferida, se nada mudou). */
  quando: number
  /** O nome da cópia no Drive (`2026-11-08T21-30-05Z.json`). */
  nome: string
  arquivos: number
  bytes: number
  /** Arquivos que subiram nesta vez (os outros o Drive já tinha). */
  enviados: number
  /** O Drive já tinha tudo: nenhuma cópia nova, a última continua valendo. */
  nadaMudou: boolean
}

export interface ResumoDaCopia extends UltimaCopia {
  bytesEnviados: number
  avisos: string[]
}

export interface CopiaNoDrive {
  /** Id do manifesto no Drive: o que o restaurar recebe. */
  id: string
  nome: string
  quando: number
  arquivos: number
  bytes: number
}

export interface ResumoDaRestauracao {
  nome: string
  arquivos: number
  baixados: number
  doDisco: number
  /** Onde ficou o Prelúdio de antes, relativo à pasta de dados do app (`null` = não havia). */
  guardadoEm: string | null
}

/** `fim` = o comando terminou (deu certo ou não). */
export type FaseDoAndamento = 'lendo' | 'conferindo' | 'enviando' | 'baixando' | 'trocando' | 'fim'

export interface Andamento {
  fase: FaseDoAndamento
  feitos: number
  total: number
}

const EVENTO_DO_ANDAMENTO = 'preludio:copia'

const DESLIGADO: FalhaDaCopia = { t: 'desligado', mensagem: 'O Prelúdio está desligado: a cópia não roda.' }
const FORA_DO_APP: FalhaDaCopia = { t: 'fora-do-app', mensagem: 'A cópia no Google Drive só funciona no app instalado do Labirinto.' }
const SEM_PONTE: FalhaDaCopia = {
  t: 'sem-ponte',
  mensagem: 'Esta versão do Labirinto ainda não tem a cópia no Google Drive. Ela chega com a próxima versão.',
}

/** Código do Rust (`ErroPreludio.codigo`) → o que a tela faz com ele. */
const MOTIVOS: Readonly<Record<string, MotivoDaFalha>> = {
  sem_credenciais_na_build: 'sem-build',
  sem_conta: 'sem-conta',
  cancelado: 'cancelado',
  ocupado: 'ocupado',
  cofre: 'cofre',
  rede: 'sem-rede',
  vazio: 'vazio',
}

/** O erro do `invoke` lido: o do Rust (`{ codigo, mensagem }`) ou o do próprio Tauri (texto). */
export function falhaDoErro(erro: unknown): FalhaDaCopia {
  if (typeof erro === 'string') {
    // O Tauri responde em texto quando o comando não existe neste binário (app de antes da ponte).
    return /not found|unknown command|not allowed/i.test(erro) ? SEM_PONTE : { t: 'erro', mensagem: erro }
  }
  if (ehRegistro(erro)) {
    const codigo = proprio(erro, 'codigo')
    const mensagem = proprio(erro, 'mensagem')
    const texto = typeof mensagem === 'string' && mensagem !== '' ? mensagem : 'A cópia no Google Drive falhou.'
    const motivo = typeof codigo === 'string' ? proprio(MOTIVOS, codigo) : undefined
    return { t: motivo ?? 'erro', mensagem: texto }
  }
  return { t: 'erro', mensagem: erro instanceof Error ? erro.message : String(erro) }
}

async function chamar<T>(comando: string, argumentos?: Record<string, unknown>): Promise<Resultado<T>> {
  if (!preparoLigado()) return { ok: false, falha: DESLIGADO }
  if (!isTauri()) return { ok: false, falha: FORA_DO_APP }
  try {
    return { ok: true, valor: await invoke<T>(comando, argumentos) }
  } catch (erro) {
    return { ok: false, falha: falhaDoErro(erro) }
  }
}

export function contaDoGoogle(): Promise<Resultado<ContaDoGoogle>> {
  return chamar('preludio_google_estado')
}

/** Abre o navegador no login do Google e espera o mestre terminar lá (até 5 min). Devolve o e-mail. */
export function entrarComGoogle(): Promise<Resultado<string>> {
  return chamar('preludio_google_entrar')
}

/** Desiste do login que espera o navegador. */
export function cancelarLogin(): Promise<Resultado<null>> {
  return chamar('preludio_google_cancelar')
}

/** Esquece a conta neste PC. Não revoga no Google: o cliente é o mesmo do Grimório. */
export function sairDoGoogle(): Promise<Resultado<null>> {
  return chamar('preludio_google_sair')
}

export function ultimaCopia(): Promise<Resultado<UltimaCopia | null>> {
  return chamar('preludio_copia_ultima')
}

export function copiarAgora(): Promise<Resultado<ResumoDaCopia>> {
  return chamar('preludio_copia_fazer')
}

export function copiasNoDrive(): Promise<Resultado<CopiaNoDrive[]>> {
  return chamar('preludio_copia_listar')
}

export function restaurarCopia(copiaId: string): Promise<Resultado<ResumoDaRestauracao>> {
  return chamar('preludio_copia_restaurar', { copiaId })
}

const FASES: ReadonlySet<string> = new Set<FaseDoAndamento>(['lendo', 'conferindo', 'enviando', 'baixando', 'trocando', 'fim'])

function ehContagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

/** O andamento que veio do evento, ou `null` se não tem a forma combinada. */
export function lerAndamento(bruto: unknown): Andamento | null {
  if (!ehRegistro(bruto)) return null
  const fase = proprio(bruto, 'fase')
  const feitos = proprio(bruto, 'feitos')
  const total = proprio(bruto, 'total')
  if (typeof fase !== 'string' || !FASES.has(fase) || !ehContagem(feitos) || !ehContagem(total)) return null
  return { fase: fase as FaseDoAndamento, feitos, total }
}

/** Cancela o listener do Tauri sem poder derrubar a tela (o mesmo cuidado de `pararDeOuvir` em `App.tsx`). */
function pararDeOuvir(parar: (() => void) | null): void {
  if (parar === null) return
  try {
    void Promise.resolve(parar() as unknown).catch(() => undefined)
  } catch {
    // Ponte de eventos ausente ou pela metade: nada a fazer.
  }
}

/** Ouve o andamento da cópia e da restauração. Devolve quem para de ouvir. */
export function ouvirAndamento(aoAndar: (andamento: Andamento) => void): () => void {
  if (!preparoLigado() || !isTauri()) return () => undefined
  let parar: (() => void) | null = null
  let encerrado = false
  void listen<unknown>(EVENTO_DO_ANDAMENTO, (evento) => {
    const andamento = lerAndamento(evento.payload)
    if (andamento !== null) aoAndar(andamento)
  }).then(
    (fn) => {
      if (encerrado) pararDeOuvir(fn)
      else parar = fn
    },
    () => undefined,
  )
  return () => {
    encerrado = true
    pararDeOuvir(parar)
  }
}
