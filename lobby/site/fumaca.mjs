// Teste do portão do Lobby (plano do Lobby, fatia W2) contra o `wrangler pages dev`.
// Confere a saída esperada de cada passo, então é teste, não só fumaça.
//
// O Access de verdade não roda no local. Este script faz o papel dele: gera um par de
// chaves RSA, serve as certs em http://127.0.0.1:8792/cdn-cgi/access/certs (o "time"
// falso) e assina os JWTs que o Access poria em `Cf-Access-Jwt-Assertion`. O portão
// valida tudo como em produção; só aceita time em 127.0.0.1 porque foi compilado pelo
// `wrangler pages dev` e o pedido chega em localhost (src/portao.ts).
//
// Como rodar:
//   1. (em lobby/nuvem) npx wrangler dev src/dev.ts --local --port 8787
//   2. (em client)      npx vite build --config vite.lobby.config.ts   (põe o _routes.json no dist-lobby)
//   3. (em lobby/site)  npx wrangler pages dev --port 8788
//                         --do CAMPANHA=Campanha@labirinto-nuvem --do DIRETORIO=Diretorio@labirinto-nuvem
//                         --binding ACCESS_AUD=aud-de-teste
//                         --binding ACCESS_TIME=127.0.0.1:8792
//                         --binding MAPA_DO_APP=cliente-de-teste.access=mestre@example.com
//   4. (em lobby/site)  node fumaca.mjs         -> o aceite local da W2; sai 0 se tudo bateu
//                       node fumaca.mjs extra   -> as outras regras do JWT, da identidade e do Origin
// Outro endereço: PORTAO_URL=http://127.0.0.1:9000 node fumaca.mjs
//
// Só fala com o local; nunca com a conta real. E-mails inventados (@example.com).

import { createHmac, createSign, generateKeyPairSync } from 'node:crypto'
import { createServer } from 'node:http'

const BASE = process.env.PORTAO_URL ?? 'http://127.0.0.1:8788'
const ORIGEM_DO_SITE = new URL(BASE).origin
const PORTA_DO_TIME = 8792
const EMISSOR = `http://127.0.0.1:${PORTA_DO_TIME}`
const AUD = 'aud-de-teste'
const CLIENTE_DO_APP = 'cliente-de-teste.access'
const MESTRE = 'mestre@example.com'
const NAMI = 'nami@example.com'
const ZORO = 'zoro@example.com'
const VERSAO = 1
const KID = 'kid-de-teste'
const ESPERA_MS = 8000
const ORIGEM_DE_FORA = 'https://site-malvado.example.com'

let falhas = 0

function conferir(descricao, condicao, detalhe = '') {
  if (condicao) console.log(`ok      ${descricao}`)
  else {
    falhas += 1
    console.log(`FALHOU  ${descricao}${detalhe === '' ? '' : `: ${detalhe}`}`)
  }
}

// ── O "time" falso do Access ─────────────────────────────────────────────────

const doTime = generateKeyPairSync('rsa', { modulusLength: 2048 })
const deFora = generateKeyPairSync('rsa', { modulusLength: 2048 })

function servirCerts() {
  const certs = JSON.stringify({ keys: [{ ...doTime.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] })
  const servidor = createServer((pedido, resposta) => {
    if (pedido.method === 'GET' && pedido.url === '/cdn-cgi/access/certs') {
      resposta.writeHead(200, { 'content-type': 'application/json' })
      resposta.end(certs)
      return
    }
    resposta.writeHead(404)
    resposta.end()
  })
  return new Promise((pronto) => servidor.listen(PORTA_DO_TIME, '127.0.0.1', () => pronto(servidor)))
}

const base64url = (valor) => Buffer.from(valor).toString('base64url')

/** O JWT que o Access mandaria; `cabecalho` e `chave` mudam só nos casos de token forjado. */
function assinar(payload, { cabecalho = { alg: 'RS256', kid: KID, typ: 'JWT' }, chave = doTime.privateKey } = {}) {
  const dados = `${base64url(JSON.stringify(cabecalho))}.${base64url(JSON.stringify(payload))}`
  const assinatura =
    cabecalho.alg === 'RS256' ? createSign('RSA-SHA256').update(dados).sign(chave) : createHmac('sha256', 'qualquer-segredo').update(dados).digest()
  return `${dados}.${base64url(assinatura)}`
}

const agora = () => Math.floor(Date.now() / 1000)

function daPessoa(email, extra = {}) {
  return { aud: [AUD], email, exp: agora() + 300, iat: agora(), nbf: agora(), iss: EMISSOR, type: 'app', sub: `sub-${email}`, ...extra }
}

function doServico(extra = {}) {
  return { aud: [AUD], common_name: CLIENTE_DO_APP, exp: agora() + 300, iat: agora(), iss: EMISSOR, type: 'app', sub: '', ...extra }
}

// ── Pedidos ──────────────────────────────────────────────────────────────────

async function pedir(metodo, caminho, { jwt, origem, corpo, cabecalhos = {} } = {}) {
  const headers = { ...cabecalhos }
  if (jwt !== undefined) headers['Cf-Access-Jwt-Assertion'] = jwt
  if (origem !== undefined) headers.Origin = origem
  if (corpo !== undefined) headers['content-type'] = 'application/json'
  const resposta = await fetch(new URL(caminho, BASE), { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  const texto = await resposta.text()
  let json
  try {
    json = JSON.parse(texto)
  } catch {
    json = { texto: texto.slice(0, 200) }
  }
  return { status: resposta.status, corpo: json, tipo: resposta.headers.get('content-type') ?? '' }
}

const recusadoCom = (r, status, detalhe) => r.status === status && (detalhe === undefined || r.corpo.detalhe === detalhe)

/** Abre o WebSocket pelo portão; resolve com o socket aberto ou com o motivo de não abrir. */
function abrirSocket(campanhaId, jwt, origem) {
  const url = new URL(`/api/c/${campanhaId}/ws`, BASE)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const headers = { 'Cf-Access-Jwt-Assertion': jwt }
  if (origem !== undefined) headers.Origin = origem
  return new Promise((pronto) => {
    const ws = new WebSocket(url, { headers })
    const desistir = setTimeout(() => pronto({ aberto: false, motivo: 'tempo' }), ESPERA_MS)
    ws.addEventListener('open', () => (clearTimeout(desistir), pronto({ aberto: true, ws })), { once: true })
    ws.addEventListener('error', () => (clearTimeout(desistir), pronto({ aberto: false, motivo: 'recusado' })), { once: true })
  })
}

function esperarMensagem(ws, criterio) {
  return new Promise((pronto) => {
    const desistir = setTimeout(() => pronto(null), ESPERA_MS)
    ws.addEventListener('message', function ouvir(evento) {
      let mensagem
      try {
        mensagem = JSON.parse(String(evento.data))
      } catch {
        return
      }
      if (!criterio(mensagem)) return
      clearTimeout(desistir)
      ws.removeEventListener('message', ouvir)
      pronto(mensagem)
    })
  })
}

function ficha(id, dono) {
  return {
    id,
    tipo: 'jogador',
    nome: id.replace('pers_', ''),
    descricao: '',
    retrato: null,
    escolhas: {},
    etiquetas: [],
    recursos: { hp: 300 },
    maximos: {},
    modificadoresDosRecursos: {},
    atributos: {},
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas: { tecnicas: [] },
    dono,
    notaDoMestre: 'Nota que o jogador nunca vê',
  }
}

function pedidoDePublicar() {
  return {
    v: VERSAO,
    clienteId: 'cli_app',
    nome: 'Portão One Piece',
    nomeDoMestre: 'Mestre',
    sistema: { id: 'one-piece', nome: 'One Piece', abas: [{ id: 'tecnicas', nome: 'Técnicas' }] },
    membros: [
      { contaId: 'conta_nami', email: NAMI, nome: 'Nami' },
      { contaId: 'conta_zoro', email: ZORO, nome: 'Zoro' },
    ],
    fichas: [ficha('pers_nami', 'conta_nami'), ficha('pers_zoro', 'conta_zoro')],
  }
}

// ── O aceite local da W2 (no máximo 2 casos por situação) ────────────────────

async function aceite() {
  const campanhaId = `portao_${Date.now()}`

  // (a) sem login não passa
  conferir('sem JWT = 401 sem-token', recusadoCom(await pedir('GET', '/api/eu'), 401, 'sem-token'))
  const forjado = assinar(daPessoa(NAMI), { chave: deFora.privateKey })
  conferir('JWT assinado por chave fora das certs do time = 401 assinatura', recusadoCom(await pedir('GET', '/api/eu', { jwt: forjado }), 401, 'assinatura'))

  // (c) Service Token = o mestre; publica a campanha do teste
  const app = assinar(doServico())
  const publicado = await pedir('POST', `/api/c/${campanhaId}/publicar`, { jwt: app, corpo: pedidoDePublicar() })
  const fichas = Array.isArray(publicado.corpo.fichas) ? publicado.corpo.fichas : []
  conferir(
    'Service Token (common_name, sem Origin) publica como mestre: 2 fichas criadas',
    publicado.status === 200 && fichas.filter((f) => f.resposta?.t === 'ack').length === 2,
    `${publicado.status} ${JSON.stringify(publicado.corpo).slice(0, 300)}`,
  )
  const ambos = assinar(daPessoa(NAMI, { common_name: CLIENTE_DO_APP }))
  conferir('JWT com email E common_name = 401', recusadoCom(await pedir('GET', '/api/eu', { jwt: ambos }), 401, 'email-e-common-name'))

  // (b) pessoa: /api/eu mostra o e-mail do JWT, nunca o de um cabeçalho de fora
  const nami = assinar(daPessoa('Nami@Example.com'))
  const eu = await pedir('GET', '/api/eu', { jwt: nami })
  conferir(
    '/api/eu da Nami mostra o e-mail dela (minúsculo) e a campanha como jogadora',
    eu.status === 200 && eu.corpo.email === NAMI && eu.corpo.campanhas?.some((c) => c.campanhaId === campanhaId && c.papel === 'jogador'),
    `${eu.status} ${JSON.stringify(eu.corpo)}`,
  )
  const forjando = await pedir('GET', '/api/eu', {
    jwt: nami,
    cabecalhos: { 'X-Identidade': JSON.stringify({ email: MESTRE, origem: 'app' }), 'Cf-Access-Authenticated-User-Email': MESTRE },
  })
  conferir('X-Identidade e Cf-Access-Authenticated-User-Email de fora são ignorados (continua Nami)', forjando.status === 200 && forjando.corpo.email === NAMI, JSON.stringify(forjando.corpo))

  // Origin: POST e upgrade do WS só do próprio site
  const opsDeFora = await pedir('POST', `/api/c/${campanhaId}/ops`, { jwt: nami, origem: ORIGEM_DE_FORA, corpo: { v: VERSAO, ops: [] } })
  conferir('POST com Origin de outro site = 403 origem-recusada', opsDeFora.status === 403 && opsDeFora.corpo.erro === 'origem-recusada', `${opsDeFora.status} ${JSON.stringify(opsDeFora.corpo)}`)
  const socketDeFora = await abrirSocket(campanhaId, nami, ORIGEM_DE_FORA)
  conferir('WebSocket com Origin de outro site não abre', !socketDeFora.aberto, socketDeFora.aberto ? 'abriu' : '')
  if (socketDeFora.aberto) socketDeFora.ws.close(1000, 'fim')

  // (e) WebSocket pela Function, mesma origem: chega o estado
  const socket = await abrirSocket(campanhaId, nami, ORIGEM_DO_SITE)
  conferir('WebSocket pela Function (JWT da Nami, Origin do site) abre', socket.aberto, socket.aberto ? '' : socket.motivo)
  if (socket.aberto) {
    const estado = esperarMensagem(socket.ws, (m) => m.t === 'estado')
    socket.ws.send(JSON.stringify({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami_portao' }))
    const recebido = await estado
    const minha = recebido?.fichas?.find((f) => f.doc?.id === 'pers_nami')
    conferir(
      'WebSocket recebe estado: a ficha da Nami é dela e sem campo do mestre',
      recebido !== null && minha?.ehMinha === true && !Object.keys(minha.doc).includes('notaDoMestre'),
      JSON.stringify(recebido).slice(0, 300),
    )
    socket.ws.close(1000, 'fim do teste')
  }
}

// ── O resto das regras (rodada final) ────────────────────────────────────────

async function extra() {
  const campanhaId = `portao_extra_${Date.now()}`
  const casos = [
    ['alg HS256 (chave pública como segredo) = 401 algoritmo', assinar(daPessoa(NAMI), { cabecalho: { alg: 'HS256', kid: KID, typ: 'JWT' } }), 'algoritmo'],
    ['alg none = 401 algoritmo', assinar(daPessoa(NAMI), { cabecalho: { alg: 'none', kid: KID } }), 'algoritmo'],
    ['kid que o time não tem = 401 chave', assinar(daPessoa(NAMI), { cabecalho: { alg: 'RS256', kid: 'kid-inventado' } }), 'chave'],
    ['aud de outra aplicação = 401 audiencia', assinar(daPessoa(NAMI, { aud: ['outra-aplicacao'] })), 'audiencia'],
    ['iss de outro time = 401 emissor', assinar(daPessoa(NAMI, { iss: 'https://outro-time.cloudflareaccess.com' })), 'emissor'],
    ['exp no passado = 401 expirado', assinar(daPessoa(NAMI, { exp: agora() - 1 })), 'expirado'],
    ['sem exp = 401 expirado', assinar(daPessoa(NAMI, { exp: undefined })), 'expirado'],
    ['nbf daqui a 10 min = 401 ainda-nao-vale', assinar(daPessoa(NAMI, { nbf: agora() + 600 })), 'ainda-nao-vale'],
    ['token com 2 partes = 401 formato', 'aaa.bbb', 'formato'],
    ['common_name fora do MAPA_DO_APP = 401', assinar(doServico({ common_name: 'outro-cliente.access' })), 'service-token-fora-do-mapa'],
    ['nem email nem common_name = 401', assinar(doServico({ common_name: undefined })), 'sem-identidade'],
    ['email que não é e-mail = 401', assinar(daPessoa('sem-arroba')), 'email-invalido'],
  ]
  for (const [descricao, jwt, detalhe] of casos) {
    const r = await pedir('GET', '/api/eu', { jwt })
    conferir(descricao, recusadoCom(r, 401, detalhe), `${r.status} ${JSON.stringify(r.corpo)}`)
  }
  const nami = assinar(daPessoa(NAMI))
  const semOrigin = await pedir('POST', `/api/c/${campanhaId}/ops`, { jwt: nami, corpo: { v: VERSAO, ops: [] } })
  conferir('POST de pessoa sem Origin = 403 (navegador sempre manda)', semOrigin.status === 403, `${semOrigin.status} ${JSON.stringify(semOrigin.corpo)}`)
  const socketSemOrigin = await abrirSocket(campanhaId, nami, undefined)
  conferir('WebSocket de pessoa sem Origin não abre', !socketSemOrigin.aberto)
  if (socketSemOrigin.aberto) socketSemOrigin.ws.close(1000, 'fim')
  const app = assinar(doServico())
  const appDeFora = await pedir('POST', `/api/c/${campanhaId}/publicar`, { jwt: app, origem: ORIGEM_DE_FORA, corpo: pedidoDePublicar() })
  conferir('Service Token com Origin de outro site = 403', appDeFora.status === 403, `${appDeFora.status}`)
  const versao = await pedir('GET', '/api/versao', { jwt: nami })
  conferir('/api/versao passa pelo portão e responde a versão do formato', versao.status === 200 && versao.corpo.versaoDoFormato === VERSAO, JSON.stringify(versao.corpo))
  const inexistente = await pedir('GET', '/api/nada-aqui', { jwt: nami })
  conferir('rota /api que não existe = 404 do Worker', inexistente.status === 404, `${inexistente.status}`)
  const pagina = await pedir('GET', '/')
  conferir('página do site (fora de /api) não passa pelo portão: 200 HTML sem JWT', pagina.status === 200 && pagina.tipo.includes('text/html'), `${pagina.status} ${pagina.tipo}`)
}

const modo = process.argv[2] ?? 'aceite'
const time = await servirCerts()
try {
  if (modo === 'aceite') await aceite()
  else if (modo === 'extra') await extra()
  else {
    console.log(`modo desconhecido: ${modo} (use aceite ou extra)`)
    falhas += 1
  }
} catch (erro) {
  falhas += 1
  console.log(`FALHOU  erro inesperado: ${erro instanceof Error ? erro.message : String(erro)}`)
} finally {
  time.close()
}
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
