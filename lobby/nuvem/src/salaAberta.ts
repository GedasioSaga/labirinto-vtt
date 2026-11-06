import { ErroDoPedido } from './http'
import { chaveDaSalaValida, ehRegistro, proprio, type MensagemDoServidor } from './nucleo'

/**
 * SALA ABERTA NO APP (pedido de 06/11/2026: "Entrar na mesa agora" no site do
 * Lobby, fatia B2). O app do mestre conta ao DO Campanha que a sala está
 * aberta, com o código e os endereços da página do jogador; o DO guarda isso
 * com uma chave de 32 bytes sorteada a cada abertura e um prazo de 10 minutos,
 * que a batida do app (a cada 4 minutos) renova:
 *
 * - `POST /api/c/:id/sala` (só o Service Token): `{ codigo, enderecos: [{ tipo, url }] }`
 *   -> `{ chave, agora, expiraEm }`. A chave só sai para o app (que confere o
 *   bilhete com ela), NUNCA para o jogador.
 * - `POST /api/c/:id/sala/fechar` (só o Service Token): apaga o registro e a chave.
 * - `POST /api/c/:id/bilhete` (só o site, de jogador): o bilhete assinado
 *   (client/src/lib/nuvem/bilhete.ts) -> `{ bilhete, validoAte, sala }`.
 *
 * O jogador recebe `sala` (`SalaParaJogador` ou `null`) no `estado` e no frame
 * `{ t: 'sala', sala }`, que sai quando a sala abre, muda de endereço, fecha
 * ou vence. No `ola` que responde com ops (sem `estado`), o frame só sai com a
 * sala aberta: o site de antes da B4 derruba o socket com frame que não
 * conhece, e o app de antes da B3 nunca abre sala, então sem sala nada muda
 * para ele. Por isso a sala só vale enquanto o socket que a trouxe está de pé:
 * o site a esquece quando o socket cai.
 *
 * Este arquivo é puro (sem Worker nem storage): o DO (campanha.ts) guarda e
 * difunde; aqui ficam a leitura do pedido, a forma dos endereços, o prazo e o
 * ritmo do bilhete.
 */

/** A batida do app vem a cada 4 minutos; 10 de prazo aguentam uma batida perdida. */
export const PRAZO_DA_SALA_MS = 10 * 60_000
/** Wi-Fi, cabo e o túnel, com folga. */
export const ENDERECOS_MAX = 4
/** Quatro URLs de ~70 caracteres e o código cabem com muita folga. */
export const CORPO_MAX_SALA = 4 * 1024
/** A chave do registro no storage do DO (KV do SQLite). */
export const CHAVE_DO_REGISTRO_DA_SALA = 'salaAberta'
/** Ritmo do bilhete: 6 por minuto por conta (GCRA), rajada de 6 e depois 1 a cada 10 s. */
export const INTERVALO_DO_BILHETE_MS = 10_000
export const RAJADA_DO_BILHETE = 6

/** O mesmo do código no bilhete (bilhete.ts); o app sorteia 6 de `A-Z2-9` (net/commands.rs). */
const FORMA_DO_CODIGO = /^[A-Za-z0-9]{1,16}$/
/** IPv4 em decimal, com a porta explícita: `http://192.168.0.10:7878/player`. */
const FORMA_DA_LAN = /^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})\/player$/
/** O túnel rápido da Cloudflare tem nome de palavras com hífen (`alfa-beta-gama-delta`): isso deixa de fora `api.` e `www.`. */
const FORMA_DO_TUNEL = /^https:\/\/([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com\/player$/
/** Um rótulo de DNS tem até 63 caracteres. */
const ROTULO_MAX = 63
/** Número sem zero à esquerda: `010` não é a mesma coisa que `10` para todo leitor de URL. */
const FORMA_DO_NUMERO = /^(?:0|[1-9]\d*)$/
const OCTETO_MAX = 255
const PORTA_MAX = 65_535

export type TipoDoEndereco = 'lan' | 'tunel'

export interface EnderecoDaSala {
  tipo: TipoDoEndereco
  /** Já termina em `/player`: o site navega para `<url>#entrar=<bilhete>`. */
  url: string
}

export interface PedidoDaSala {
  codigo: string
  enderecos: EnderecoDaSala[]
}

/** O que fica no storage do DO. A `chave` nunca sai para o jogador. */
export interface RegistroDaSala {
  codigo: string
  enderecos: EnderecoDaSala[]
  /** 32 bytes em base64url (`novaChaveDaSala`). */
  chave: string
  /** ms desde 1970, no relógio do DO. */
  expiraEm: number
}

/** O que o jogador vê: sem a chave e sem o prazo. */
export interface SalaParaJogador {
  codigo: string
  enderecos: EnderecoDaSala[]
}

export type MensagemDaSala = { t: 'sala'; sala: SalaParaJogador | null }

/** O `estado` do jogador com a sala aberta agora (`null` = nenhuma). */
export type EstadoComSala = Extract<MensagemDoServidor, { t: 'estado' }> & { sala: SalaParaJogador | null }

export interface BatidaDaSala {
  registro: RegistroDaSala
  /** Sala nova (outra chave) ou endereços mudados: o jogador recebe o frame `sala`. */
  mudouParaJogador: boolean
}

export type RitmoDoBilhete = { ok: true; paceAt: number } | { ok: false; tentarDepoisDe: number }

function foraDoFormato(detalhe: string): ErroDoPedido {
  return new ErroDoPedido(400, 'fora-do-formato', detalhe)
}

function numeroAte(texto: string, maximo: number): number | null {
  if (!FORMA_DO_NUMERO.test(texto)) return null
  const numero = Number(texto)
  return numero <= maximo ? numero : null
}

/** 10.0.0.0/8, 172.16.0.0/12 e 192.168.0.0/16 (RFC 1918). VPN (100.64/10), loopback e IP público ficam de fora. */
function ipPrivado(primeiro: number, segundo: number): boolean {
  return primeiro === 10 || (primeiro === 172 && segundo >= 16 && segundo <= 31) || (primeiro === 192 && segundo === 168)
}

function urlDaLan(url: string): boolean {
  const achado = FORMA_DA_LAN.exec(url)
  if (achado === null) return false
  const [, a, b, c, d, textoDaPorta] = achado
  const octetos = [a, b, c, d].map((octeto) => numeroAte(octeto, OCTETO_MAX))
  const porta = numeroAte(textoDaPorta, PORTA_MAX)
  const [primeiro, segundo] = octetos
  if (octetos.some((octeto) => octeto === null) || primeiro === null || segundo === null || porta === null || porta === 0) return false
  return ipPrivado(primeiro, segundo)
}

function urlDoTunel(url: string): boolean {
  const achado = FORMA_DO_TUNEL.exec(url)
  return achado !== null && achado[1].length <= ROTULO_MAX
}

/**
 * O endereço que o DO aceita guardar e mostrar ao jogador, na forma exata:
 * `lan` = `http://<IPv4 privado>:<porta>/player`; `tunel` =
 * `https://<nome>.trycloudflare.com/player`. Nada de barra no fim, query,
 * fragmento, usuário na URL ou maiúscula no nome do túnel: o site navega para
 * esta URL com o bilhete no fragmento, então ela não pode apontar para outro lugar.
 */
export function urlDaSalaValida(tipo: TipoDoEndereco, url: string): boolean {
  return tipo === 'lan' ? urlDaLan(url) : urlDoTunel(url)
}

/** O endereço de fora (pedido do app ou registro relido); `null` = fora da forma. */
export function lerEnderecoDaSala(valor: unknown): EnderecoDaSala | null {
  if (!ehRegistro(valor)) return null
  const tipo = proprio(valor, 'tipo')
  const url = proprio(valor, 'url')
  if ((tipo !== 'lan' && tipo !== 'tunel') || typeof url !== 'string') return null
  return urlDaSalaValida(tipo, url) ? { tipo, url } : null
}

function enderecosDe(valor: unknown): EnderecoDaSala[] | null {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > ENDERECOS_MAX) return null
  const enderecos: EnderecoDaSala[] = []
  for (const item of valor) {
    const endereco = lerEnderecoDaSala(item)
    if (endereco === null) return null
    enderecos.push(endereco)
  }
  return new Set(enderecos.map((endereco) => endereco.url)).size === enderecos.length ? enderecos : null
}

/** O corpo de `POST /sala`. Fora da forma = 400, sem ecoar a URL que veio (§6.2). */
export function lerPedidoDaSala(corpo: unknown): PedidoDaSala {
  if (!ehRegistro(corpo)) throw foraDoFormato('Esperava um objeto')
  const codigo = proprio(corpo, 'codigo')
  if (typeof codigo !== 'string' || !FORMA_DO_CODIGO.test(codigo)) throw foraDoFormato('codigo: de 1 a 16 letras e números')
  const enderecos = enderecosDe(proprio(corpo, 'enderecos'))
  if (enderecos === null) {
    throw foraDoFormato(`enderecos: de 1 a ${ENDERECOS_MAX}, sem repetir, só http://<IP da rede local>:<porta>/player ou https://<nome>.trycloudflare.com/player`)
  }
  return { codigo, enderecos }
}

/** O registro relido do storage; `null` = não há (ou é de uma forma que este código não conhece). */
export function lerRegistroDaSala(valor: unknown): RegistroDaSala | null {
  if (!ehRegistro(valor)) return null
  const codigo = proprio(valor, 'codigo')
  const chave = proprio(valor, 'chave')
  const expiraEm = proprio(valor, 'expiraEm')
  const enderecos = enderecosDe(proprio(valor, 'enderecos'))
  if (typeof codigo !== 'string' || !FORMA_DO_CODIGO.test(codigo) || enderecos === null) return null
  if (typeof chave !== 'string' || !chaveDaSalaValida(chave) || typeof expiraEm !== 'number' || !Number.isSafeInteger(expiraEm)) return null
  return { codigo, enderecos, chave, expiraEm }
}

function mesmosEnderecos(a: readonly EnderecoDaSala[], b: readonly EnderecoDaSala[]): boolean {
  return a.length === b.length && a.every((endereco, indice) => endereco.tipo === b[indice].tipo && endereco.url === b[indice].url)
}

/**
 * A abertura e a batida são o mesmo pedido: com a sala vigente e o mesmo
 * código, a chave fica e o prazo renova; sem sala, vencida ou com outro código
 * (o app reabriu sem fechar), é uma abertura nova, com chave nova.
 */
export function registroDepoisDaBatida(anterior: RegistroDaSala | null, pedido: PedidoDaSala, agora: number, sortearChave: () => string): BatidaDaSala {
  const vigente = anterior !== null && anterior.expiraEm > agora && anterior.codigo === pedido.codigo ? anterior : null
  const registro: RegistroDaSala = {
    codigo: pedido.codigo,
    enderecos: pedido.enderecos,
    chave: vigente === null ? sortearChave() : vigente.chave,
    expiraEm: agora + PRAZO_DA_SALA_MS,
  }
  return { registro, mudouParaJogador: vigente === null || !mesmosEnderecos(vigente.enderecos, pedido.enderecos) }
}

/** A sala que o jogador vê; a vencida (o alarme ainda não tocou) já é `null`. */
export function salaParaJogador(registro: RegistroDaSala | null, agora: number): SalaParaJogador | null {
  if (registro === null || registro.expiraEm <= agora) return null
  return { codigo: registro.codigo, enderecos: registro.enderecos.map(({ tipo, url }) => ({ tipo, url })) }
}

/** O menor prazo dos que existem; `null` = nada vence. */
export function menorPrazo(prazos: readonly (number | null)[]): number | null {
  let menor: number | null = null
  for (const prazo of prazos) if (prazo !== null && (menor === null || prazo < menor)) menor = prazo
  return menor
}

export function chaveDoRitmoDoBilhete(contaId: string): string {
  return `ritmoDoBilhete:${contaId}`
}

/**
 * GCRA: `paceAt` é o instante teórico do próximo pedido. Passa enquanto ele
 * não estiver mais de `(RAJADA - 1) × INTERVALO` à frente de agora.
 */
export function conferirRitmoDoBilhete(paceAt: number | undefined, agora: number): RitmoDoBilhete {
  const teorico = paceAt === undefined ? agora : Math.max(paceAt, agora)
  const folga = (RAJADA_DO_BILHETE - 1) * INTERVALO_DO_BILHETE_MS
  if (teorico - agora > folga) return { ok: false, tentarDepoisDe: teorico - folga }
  return { ok: true, paceAt: teorico + INTERVALO_DO_BILHETE_MS }
}
