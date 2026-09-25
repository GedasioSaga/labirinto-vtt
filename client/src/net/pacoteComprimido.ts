/**
 * PACOTE COMPRIMIDO para quem joga pelo 4G (link público).
 *
 * O servidor do app manda cada mensagem como texto JSON, sem compressão, e o
 * mapa inteiro da cena pesa dezenas de KB. Aqui a mensagem grande sai em gzip,
 * dentro de um envelope `{"gz":"<base64>"}`, só para quem declarou no `join`
 * que sabe abrir (`accept: ['gzip']`) — e só declara quem abriu a página pelo
 * link público (`pedeGzip`). Cliente antigo ou na rede local não declara e
 * recebe texto como sempre; mestre antigo ignora o `accept`.
 *
 * O envelope vai em frame de TEXTO, e não binário, porque quem monta a
 * mensagem é o mestre (TS) e o servidor Rust só repassa objetos JSON como
 * texto: o base64 custa ~33% sobre o gzip, e o mapa ainda chega várias vezes
 * menor. Frame binário direto do Rust fica para quando o lado Rust mudar.
 *
 * Comprimir e abrir são assíncronos (`CompressionStream`), então os dois lados
 * têm uma fila por conexão: nada passa na frente de um pacote que ainda está
 * sendo comprimido ou aberto. Sem pacote na fila, tudo segue síncrono, como antes.
 */

/** O que o jogador põe em `accept` no `join` quando sabe abrir o envelope. */
export const ACEITA_GZIP = 'gzip'

/**
 * A partir de quantos caracteres do JSON a mensagem vai comprimida (32 K).
 * Abaixo disso o ganho não paga o trabalho; e caractere nunca passa de byte
 * em UTF-8, então o limite em caracteres também é um piso em bytes.
 */
export const COMPRIMIR_A_PARTIR_DE = 32 * 1024

/** Envelope do pacote: um objeto com uma chave só, para o jogador reconhecer pelo começo do texto. */
export interface PacoteComprimido {
  gz: string
}

/** O `serde_json` do servidor serializa `{gz}` sem espaço: é assim que o texto começa. */
const INICIO_DO_ENVELOPE = '{"gz":"'

/** Pedaço do `String.fromCharCode(...)` no base64: argumento demais estoura a pilha. */
const PEDACO_BASE64 = 0x8000

/** Este navegador (ou o webview do mestre) comprime gzip? */
export function sabeComprimirGzip(): boolean {
  return typeof CompressionStream === 'function'
}

/** Este navegador abre gzip? Navegador antigo não declara `accept` e recebe texto. */
export function sabeAbrirGzip(): boolean {
  return typeof DecompressionStream === 'function'
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/

/**
 * A página do jogador foi aberta por um endereço da rede local (IP privado,
 * `localhost`, `.local`)? Na LAN o mapa chega rápido e o mestre não gasta
 * CPU comprimindo; fora dela (o link público do túnel) é quem joga pelo 4G.
 */
export function ehRedeLocal(hostname: string): boolean {
  const nome = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (nome === '' || nome === 'localhost' || nome.endsWith('.localhost') || nome.endsWith('.local')) return true
  if (nome.includes(':')) return nome === '::1' || nome.startsWith('fe80:') || nome.startsWith('fc') || nome.startsWith('fd')
  const ip = IPV4.exec(nome)
  if (ip === null) return false
  const a = Number(ip[1])
  const b = Number(ip[2])
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
}

/** O jogador pede o mapa comprimido: veio pelo link público e o navegador sabe abrir gzip. */
export function pedeGzip(hostname: string): boolean {
  return !ehRedeLocal(hostname) && sabeAbrirGzip()
}

/** A mensagem (já em JSON) é grande o bastante para ir comprimida, e dá para comprimir aqui? */
export function valeComprimir(texto: string): boolean {
  return texto.length >= COMPRIMIR_A_PARTIR_DE && sabeComprimirGzip()
}

async function passarPor(bytes: Uint8Array<ArrayBuffer>, transformacao: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const entrada = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controle) {
      controle.enqueue(bytes)
      controle.close()
    },
  })
  return new Uint8Array(await new Response(entrada.pipeThrough(transformacao)).arrayBuffer())
}

function paraBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i += PEDACO_BASE64) binario += String.fromCharCode(...bytes.subarray(i, i + PEDACO_BASE64))
  return btoa(binario)
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/**
 * O envelope com o `texto` em gzip. `null` = vai como texto mesmo: sem
 * `CompressionStream`, falha ao comprimir, ou o envelope não saiu menor.
 */
export async function comprimirPacote(texto: string): Promise<PacoteComprimido | null> {
  if (!sabeComprimirGzip()) return null
  try {
    const gz = paraBase64(await passarPor(new TextEncoder().encode(texto), new CompressionStream('gzip')))
    return gz.length < texto.length ? { gz } : null
  } catch {
    return null
  }
}

/** O JSON de dentro do envelope. `null` = pacote estragado (base64 ou gzip inválido). */
export async function abrirPacote(gz: string): Promise<string | null> {
  if (!sabeAbrirGzip()) return null
  try {
    return new TextDecoder().decode(await passarPor(deBase64(gz), new DecompressionStream('gzip')))
  } catch {
    return null
  }
}

/** O base64 do envelope, se `dado` é o texto de um envelope; senão `null`. */
export function lerPacote(dado: unknown): string | null {
  // Olhar o começo evita um JSON.parse a mais em toda mensagem comum.
  if (typeof dado !== 'string' || !dado.startsWith(INICIO_DO_ENVELOPE)) return null
  let valor: unknown
  try {
    valor = JSON.parse(dado)
  } catch {
    return null
  }
  if (typeof valor !== 'object' || valor === null || Object.keys(valor).length !== 1) return null
  const gz: unknown = Reflect.get(valor, 'gz')
  return typeof gz === 'string' ? gz : null
}

/**
 * Entrada do jogador: devolve a função que recebe cada `event.data` do socket
 * e chama `entregar` com o texto da mensagem, na ORDEM em que chegou. O
 * envelope é aberto antes; o que chega atrás dele espera. Pacote estragado é
 * descartado, como hoje o JSON inválido.
 */
export function criarEntradaEmOrdem(entregar: (dado: unknown) => void): (dado: unknown) => void {
  let fila: Promise<void> = Promise.resolve()
  let naFila = 0
  const entregarNaFila = (aberto: { dado: unknown } | null) => {
    naFila--
    if (aberto === null) return
    try {
      entregar(aberto.dado)
    } catch (erro) {
      // O erro de quem trata a mensagem sobe como no caminho síncrono, sem parar a fila.
      setTimeout(() => {
        throw erro
      })
    }
  }
  return (dado) => {
    const gz = lerPacote(dado)
    if (gz === null && naFila === 0) {
      entregar(dado)
      return
    }
    naFila++
    // A abertura começa já; a entrega espera a vez.
    const pronto: Promise<{ dado: unknown } | null> =
      gz === null ? Promise.resolve({ dado }) : abrirPacote(gz).then((texto) => (texto === null ? null : { dado: texto }))
    fila = fila.then(() => pronto).then(entregarNaFila)
  }
}

/**
 * Saída do mestre: devolve `enviar(clientId, msg, aceitaGzip)`. Para quem
 * aceita gzip, a mensagem grande vai no envelope e as seguintes do MESMO
 * cliente esperam por ela; as de outros clientes não esperam ninguém. Sem
 * nada na fila do cliente, a mensagem sai na hora, como antes.
 *
 * `mandar` nunca rejeita (o `net_send` do mestre já vira toast na falha): a
 * fila depende disso para seguir.
 */
export function criarSaidaEmOrdem(
  mandar: (clientId: string, carga: object) => Promise<void>,
): (clientId: string, msg: object, aceitaGzip: boolean) => Promise<void> {
  const emCurso = new Map<string, Promise<void>>()
  return (clientId, msg, aceitaGzip) => {
    const anterior = emCurso.get(clientId)
    const texto = aceitaGzip ? JSON.stringify(msg) : ''
    const comprimir = aceitaGzip && valeComprimir(texto)
    if (!comprimir && anterior === undefined) return mandar(clientId, msg)
    // Comprime já, em paralelo com o que ainda está na fila; manda na vez.
    const carga: Promise<object> = comprimir ? comprimirPacote(texto).then((pacote) => pacote ?? msg) : Promise.resolve(msg)
    const passo = (anterior ?? Promise.resolve()).then(() => carga).then((pronta) => mandar(clientId, pronta))
    emCurso.set(clientId, passo)
    const liberar = () => {
      if (emCurso.get(clientId) === passo) emCurso.delete(clientId)
    }
    void passo.then(liberar, liberar)
    return passo
  }
}
