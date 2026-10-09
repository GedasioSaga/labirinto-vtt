import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, QuadroDaCena, ThreeModule } from './tipos'

/**
 * Catálogo das transições especiais: as EMBUTIDAS (três, sempre no app,
 * funcionam sem internet) e as que chegam DE FORA, no pacote de animações
 * baixado do GitHub (`lib/pacoteDeAnimacoes.ts`). Transição embutida nova =
 * uma entrada em `TRANSICOES_EMBUTIDAS` e um arquivo em `cenas/` registrado em
 * `motor.ts`; a do pacote mora em `src/animacoes/transicao/`.
 *
 * Este arquivo não importa `three` em tempo de execução (só tipos): o editor,
 * o disco e a rede validam ids e leem nomes sem baixar a biblioteca 3D.
 */

/**
 * Id de transição no mapa, no disco e na rede: curto, minúsculo, sem espaço.
 * O id é só a FORMA: um id que este app não conhece (pacote ainda não baixado)
 * fica gravado e toca quando o pacote chegar; até lá, sem transição.
 */
export const ID_DE_TRANSICAO = /^[a-z0-9-]{1,40}$/
export type TransicaoId = string

export interface TransicaoInfo {
  id: TransicaoId
  nome: string
  /** Duração da animação inteira, em segundos, quando o mestre não escolhe outra. */
  duracaoNaturalS: number
  /** Momento (em segundos da cena) usado como miniatura na galeria. */
  quadroDaMiniaturaS: number
}

export const TRANSICOES_EMBUTIDAS: readonly TransicaoInfo[] = [
  { id: 'porta', nome: 'Porta rangendo', duracaoNaturalS: 7.2, quadroDaMiniaturaS: 2.2 },
  { id: 'escada-pedra', nome: 'Escadaria subindo', duracaoNaturalS: 11.7, quadroDaMiniaturaS: 4 },
  { id: 'escada-pedra-descendo', nome: 'Escadaria descendo', duracaoNaturalS: 11.7, quadroDaMiniaturaS: 4 },
]

/** Teto da duração escolhida pelo mestre: rápida demais vira piscada, longa demais prende o jogador. */
export const TRANSICAO_DURACAO_MIN_S = 2
export const TRANSICAO_DURACAO_MAX_S = 30
/** Nome longo demais quebraria a linha da galeria (o mesmo teto das portas e dos cenários). */
export const NOME_DE_TRANSICAO_MAX = 60

/** O que fica gravado no pino de viagem e na escada. */
export interface TransicaoEscolhida {
  id: TransicaoId
  /** Ausente = animação inteira, na duração natural. */
  duracaoS?: number
}

/** Id com a forma certa; não diz se este app tem a transição (ver `transicaoInfo`). */
export function isTransicaoId(valor: unknown): valor is TransicaoId {
  return typeof valor === 'string' && ID_DE_TRANSICAO.test(valor)
}

export function isDuracaoValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= TRANSICAO_DURACAO_MIN_S && valor <= TRANSICAO_DURACAO_MAX_S
}

// ---------------------------------------------------------------------------
// Registro das transições DE FORA (pacote baixado)
// ---------------------------------------------------------------------------

interface TransicaoDeFora extends TransicaoInfo {
  criar: CriarCena
}

/** Embutidas primeiro; as de fora depois, na ordem em que chegaram. A referência só muda quando o registro muda. */
let lista: readonly TransicaoInfo[] = TRANSICOES_EMBUTIDAS
let deFora: readonly TransicaoDeFora[] = []
const ouvintes = new Set<() => void>()
/** O carregamento do pacote em andamento, para o motor esperar antes de dizer "desconhecida". */
let carregandoDeFora: Promise<unknown> | null = null

/**
 * Todas as transições, para a galeria. Serve de `getSnapshot` para
 * `useSyncExternalStore`: a mesma referência enquanto nada muda.
 */
export function listarTransicoes(): readonly TransicaoInfo[] {
  return lista
}

/** Avisa quando uma transição entra ou sai do registro. Devolve o cancelamento. */
export function assinarTransicoes(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** A transição do id, ou `undefined` = este app não a tem (id de um pacote ainda não baixado). */
export function transicaoInfo(id: TransicaoId): TransicaoInfo | undefined {
  return lista.find((t) => t.id === id)
}

export function isTransicaoEmbutida(id: string): boolean {
  return TRANSICOES_EMBUTIDAS.some((t) => t.id === id)
}

/** A fábrica da cena de uma transição DE FORA; `null` para embutida ou desconhecida. */
export function criarCenaDeFora(id: TransicaoId): CriarCena | null {
  return deFora.find((t) => t.id === id)?.criar ?? null
}

function trocarDeFora(nova: readonly TransicaoDeFora[]): void {
  deFora = nova
  lista = nova.length === 0 ? TRANSICOES_EMBUTIDAS : [...TRANSICOES_EMBUTIDAS, ...nova]
  for (const ouvinte of ouvintes) ouvinte()
}

/** Tira todas as de fora (o pacote novo substitui o anterior inteiro). As embutidas ficam. */
export function esquecerTransicoesDeFora(): void {
  if (deFora.length === 0) return
  trocarDeFora([])
}

/**
 * Marca o carregamento do pacote em andamento: uma transição pedida no meio
 * dele (o jogador atravessou logo ao conectar) espera o pacote em vez de
 * pular a animação. Falha do carregamento vira "sem a transição", nunca erro.
 */
export function marcarCarregamentoDeFora(carregando: Promise<unknown>): void {
  carregandoDeFora = carregando
  const limpar = () => {
    if (carregandoDeFora === carregando) carregandoDeFora = null
  }
  carregando.then(limpar, limpar)
}

/** Espera o carregamento do pacote em andamento, se houver. Nunca rejeita. */
export async function aguardarTransicoesDeFora(): Promise<void> {
  if (carregandoDeFora === null) return
  await carregandoDeFora.catch(() => undefined)
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** O quadro devolvido pelo `atualizar` de fora: só `fade` entre 0 e 1 passa. */
function quadroConferido(valor: unknown, id: string): QuadroDaCena {
  if (typeof valor !== 'object' || valor === null || !('fade' in valor) || !numeroFinito(valor.fade)) throw new Error(`transição ${id}: atualizar não devolveu { fade }`)
  return { fade: Math.min(1, Math.max(0, valor.fade)) }
}

/** O par de pistas devolvido pelo `criarSom` de fora. */
function pistasConferidas(valor: unknown, id: string): ReturnType<NonNullable<CenaTransicao['criarSom']>> {
  if (typeof valor !== 'object' || valor === null) throw new Error(`transição ${id}: criarSom não devolveu um objeto`)
  if (!('atualizar' in valor) || typeof valor.atualizar !== 'function') throw new Error(`transição ${id}: som sem atualizar`)
  if (!('reiniciar' in valor) || typeof valor.reiniciar !== 'function') throw new Error(`transição ${id}: som sem reiniciar`)
  const atualizar = valor.atualizar
  const reiniciar = valor.reiniciar
  return {
    atualizar: (t) => {
      Reflect.apply(atualizar, valor, [t])
    },
    reiniciar: () => {
      Reflect.apply(reiniciar, valor, [])
    },
  }
}

/**
 * Confere em tempo de execução a cena que o `criar` de fora devolveu e
 * embrulha os métodos. Forma errada LANÇA: o motor pega e chama `onFim`, como
 * sem WebGL. `scene` e `camera` são conferidas contra as classes do PRÓPRIO
 * `three` que o motor passou: a cena do pacote não importa `three`, recebe.
 */
function cenaConferida(valor: unknown, THREE: ThreeModule, id: string): CenaTransicao {
  if (typeof valor !== 'object' || valor === null) throw new Error(`transição ${id}: criar não devolveu um objeto`)
  if (!('scene' in valor) || !(valor.scene instanceof THREE.Scene)) throw new Error(`transição ${id}: sem scene`)
  if (!('camera' in valor) || !(valor.camera instanceof THREE.PerspectiveCamera)) throw new Error(`transição ${id}: sem camera perspectiva`)
  if (!('atualizar' in valor) || typeof valor.atualizar !== 'function') throw new Error(`transição ${id}: sem atualizar`)
  if (!('ajustarTela' in valor) || typeof valor.ajustarTela !== 'function') throw new Error(`transição ${id}: sem ajustarTela`)
  if (!('descartar' in valor) || typeof valor.descartar !== 'function') throw new Error(`transição ${id}: sem descartar`)
  const atualizar = valor.atualizar
  const ajustarTela = valor.ajustarTela
  const descartar = valor.descartar
  const cena: CenaTransicao = {
    scene: valor.scene,
    camera: valor.camera,
    atualizar: (t) => quadroConferido(Reflect.apply(atualizar, valor, [t]), id),
    ajustarTela: (aspecto) => {
      Reflect.apply(ajustarTela, valor, [aspecto])
    },
    descartar: () => {
      Reflect.apply(descartar, valor, [])
    },
  }
  if ('criarSom' in valor && typeof valor.criarSom === 'function') {
    const criarSom = valor.criarSom
    cena.criarSom = (kit: KitDeSom) => pistasConferidas(Reflect.apply(criarSom, valor, [kit]), id)
  }
  return cena
}

/**
 * Registra uma transição vinda de FORA (pacote). Confere tudo em tempo de
 * execução e recusa, devolvendo `false`, o que não tem a forma do contrato.
 * Id de embutida é recusado: a embutida ganha (funciona sem internet e não
 * muda por download). O mesmo id de fora registrado de novo substitui o
 * anterior (versão nova do pacote).
 *
 * O `criar` de fora é chamado por `Reflect.apply`, sem `this`: o contrato é
 * uma função solta, e assim o tipo `Function` do `typeof` serve sem afirmar
 * uma assinatura que não dá para conferir.
 */
export function registrarTransicao(info: unknown): boolean {
  if (typeof info !== 'object' || info === null) return false
  if (!('id' in info) || !isTransicaoId(info.id)) return false
  const id = info.id
  if (isTransicaoEmbutida(id)) return false
  if (!('nome' in info) || typeof info.nome !== 'string') return false
  const nome = info.nome.trim()
  if (nome === '' || nome.length > NOME_DE_TRANSICAO_MAX) return false
  if (!('duracaoNaturalS' in info) || !isDuracaoValida(info.duracaoNaturalS)) return false
  const duracaoNaturalS = info.duracaoNaturalS
  if (!('quadroDaMiniaturaS' in info) || !numeroFinito(info.quadroDaMiniaturaS)) return false
  const quadroDaMiniaturaS = info.quadroDaMiniaturaS
  if (quadroDaMiniaturaS < 0 || quadroDaMiniaturaS > duracaoNaturalS) return false
  if (!('criar' in info) || typeof info.criar !== 'function') return false
  const criarDeFora = info.criar
  const transicao: TransicaoDeFora = {
    id,
    nome,
    duracaoNaturalS,
    quadroDaMiniaturaS,
    criar: (THREE: ThreeModule, opcoes: OpcoesDaCena) => cenaConferida(Reflect.apply(criarDeFora, undefined, [THREE, opcoes]), THREE, id),
  }
  trocarDeFora([...deFora.filter((existente) => existente.id !== id), transicao])
  return true
}

// ---------------------------------------------------------------------------

/**
 * Lê uma transição vinda do disco ou da rede. Id fora da FORMA = sem
 * transição; id na forma mas desconhecido fica gravado (o pacote dele pode
 * chegar depois). Duração fora do teto cai e fica a natural.
 */
export function parseTransicao(valor: unknown): TransicaoEscolhida | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  if (!('id' in valor) || !isTransicaoId(valor.id)) return undefined
  const id = valor.id
  const duracaoS = 'duracaoS' in valor ? valor.duracaoS : undefined
  return isDuracaoValida(duracaoS) ? { id, duracaoS } : { id }
}

/** Mesma transição e mesma duração; ausente só é igual a ausente. */
export function sameTransicao(a: TransicaoEscolhida | undefined, b: TransicaoEscolhida | undefined): boolean {
  return a?.id === b?.id && a?.duracaoS === b?.duracaoS
}

/** Duração que de fato toca, em segundos: a escolhida, senão a natural da transição. */
export function duracaoEfetivaS(escolha: TransicaoEscolhida, info: TransicaoInfo): number {
  return escolha.duracaoS ?? info.duracaoNaturalS
}
