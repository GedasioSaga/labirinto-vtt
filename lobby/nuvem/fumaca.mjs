// Teste do Worker do Lobby contra o `wrangler dev` (plano do Lobby, fatia W1).
// Confere a saída esperada de cada passo, então é teste, não só fumaça.
//
// Como rodar (em lobby/nuvem):
//   1. npx wrangler dev src/dev.ts --local --port 8787
//   2. node fumaca.mjs                    -> o aceite inteiro da W1; sai 0 se tudo bateu
//      node fumaca.mjs exportar <campanha> -> lista as ops da campanha, com autor
//      node fumaca.mjs limites             -> o limitador: ritmo vira adiado; frames tortos fecham e bloqueiam
// Outro endereço: NUVEM_URL=http://127.0.0.1:9000 node fumaca.mjs
//
// Prova do bundle (nada de Tauri, React, DOM ou Pixi):
//   npx wrangler deploy --dry-run --outdir <pasta> --metafile <pasta>/meta.json
//   e conferir as entradas do meta.json e o texto do index.js (a porta src/dev.ts não entra).
//
// Só fala com a porta de dev local (identidade pela URL, ?eu=&origem=); nunca com a conta real.
// Nomes e e-mails inventados (@example.com).

const BASE = process.env.NUVEM_URL ?? 'http://127.0.0.1:8787'
const MESTRE = 'mestre@example.com'
const NAMI = 'nami@example.com'
const ZORO = 'zoro@example.com'
const VERSAO = 1
/** O ritmo do servidor deixa 5 frames seguidos e depois 1 a cada 700 ms por conta (limites.ts). */
const INTERVALO_ENTRE_FRAMES_MS = 750
const ESPERA_MS = 8000
const MIDIA_FALSA = `midia:${'a'.repeat(64)}.png`
const FOTO_EMBUTIDA = 'data:image/png;base64,iVBORw0KGgo='

let falhas = 0

function conferir(descricao, condicao, detalhe = '') {
  if (condicao) console.log(`ok      ${descricao}`)
  else {
    falhas += 1
    console.log(`FALHOU  ${descricao}${detalhe === '' ? '' : `: ${detalhe}`}`)
  }
}

function enderecoDe(caminho, eu, origem, protocolo = 'http') {
  const url = new URL(caminho, BASE)
  url.searchParams.set('eu', eu)
  url.searchParams.set('origem', origem)
  if (protocolo === 'ws') url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url
}

async function pedir(metodo, caminho, eu, origem, corpo) {
  const resposta = await fetch(enderecoDe(caminho, eu, origem), {
    method: metodo,
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await resposta.text()
  let json = null
  try {
    json = JSON.parse(texto)
  } catch {
    json = { texto }
  }
  return { status: resposta.status, corpo: json }
}

const doApp = (metodo, caminho, corpo) => pedir(metodo, caminho, MESTRE, 'app', corpo)

// ── WebSocket do site ────────────────────────────────────────────────────────

const ultimoFrame = new Map()

async function esperarVez(email) {
  const ultimo = ultimoFrame.get(email) ?? 0
  const falta = ultimo + INTERVALO_ENTRE_FRAMES_MS - Date.now()
  if (falta > 0) await new Promise((pronto) => setTimeout(pronto, falta))
  ultimoFrame.set(email, Date.now())
}

class Sala {
  static abrir(campanhaId, email) {
    return new Promise((pronto, falhou) => {
      const ws = new WebSocket(enderecoDe(`/api/c/${campanhaId}/ws`, email, 'site', 'ws'))
      const sala = new Sala(ws, email)
      ws.addEventListener('open', () => pronto(sala), { once: true })
      ws.addEventListener('error', () => falhou(new Error(`WebSocket de ${email} não abriu`)), { once: true })
    })
  }

  constructor(ws, email) {
    this.ws = ws
    this.email = email
    this.recebidas = []
    this.esperando = []
    ws.addEventListener('message', (evento) => this.chegou(String(evento.data)))
  }

  chegou(texto) {
    let mensagem
    try {
      mensagem = JSON.parse(texto)
    } catch {
      mensagem = { cru: texto }
    }
    const achou = this.esperando.findIndex((espera) => espera.criterio(mensagem))
    if (achou >= 0) this.esperando.splice(achou, 1)[0].pronto(mensagem)
    else this.recebidas.push(mensagem)
  }

  async mandar(frame) {
    await esperarVez(this.email)
    this.ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame))
  }

  /** A primeira mensagem (já chegada ou a chegar) que passa no critério; some da fila. */
  esperar(criterio, descricao) {
    const ja = this.recebidas.findIndex(criterio)
    if (ja >= 0) return Promise.resolve(this.recebidas.splice(ja, 1)[0])
    return new Promise((pronto, falhou) => {
      const espera = { criterio, pronto }
      this.esperando.push(espera)
      setTimeout(() => {
        const indice = this.esperando.indexOf(espera)
        if (indice < 0) return
        this.esperando.splice(indice, 1)
        falhou(new Error(`${this.email}: não chegou ${descricao}`))
      }, ESPERA_MS)
    })
  }

  respostaDe(opId) {
    return this.esperar((m) => ['ack', 'conflito', 'negado', 'adiado'].includes(m.t) && m.opId === opId, `a resposta de ${opId}`)
  }

  fechar() {
    this.ws.close(1000, 'fim do teste')
  }
}

// ── Dados inventados ─────────────────────────────────────────────────────────

function ficha(id, dono, extra = {}) {
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
    ...extra,
  }
}

function cartao(id, nome, imagem) {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem, modificadores: [], subcartoes: [] }
}

let contador = 0

function op(fichaId, caminho, acao, baseRev, clienteId, extra = {}) {
  contador += 1
  return { opId: `op_${contador}`, loteId: `lote_${contador}`, fichaId, caminho, acao, baseRev, clienteId, quandoCliente: Date.now(), ...extra }
}

function pedidoDePublicar(fichas) {
  return {
    v: VERSAO,
    clienteId: 'cli_app',
    nome: 'Fumaça One Piece',
    nomeDoMestre: 'Mestre',
    sistema: { id: 'one-piece', nome: 'One Piece', abas: [{ id: 'tecnicas', nome: 'Técnicas' }] },
    membros: [
      { contaId: 'conta_nami', email: NAMI, nome: 'Nami' },
      { contaId: 'conta_zoro', email: ZORO, nome: 'Zoro' },
    ],
    fichas,
  }
}

async function exportarTudo(campanhaId, eu, origem, limite) {
  const ops = []
  let pagina = await pedir('GET', `/api/c/${campanhaId}/exportar?limite=${limite}`, eu, origem)
  const primeira = pagina.corpo
  ops.push(...pagina.corpo.ops)
  while (pagina.corpo.proximaDeRev !== null && pagina.status === 200) {
    pagina = await pedir('GET', `/api/c/${campanhaId}/exportar?limite=${limite}&deRev=${pagina.corpo.proximaDeRev}`, eu, origem)
    ops.push(...pagina.corpo.ops)
  }
  return { primeira, ops }
}

const revsSeguidas = (ops, ate) => ops.length === ate && ops.every((gravada, indice) => gravada.rev === indice + 1)

// ── O aceite ─────────────────────────────────────────────────────────────────

async function publicar(campanhaId) {
  const nami = ficha('pers_nami', 'conta_nami')
  const zoro = ficha('pers_zoro', 'conta_zoro')
  const fotoNoRetrato = ficha('pers_foto_retrato', 'conta_nami', { retrato: FOTO_EMBUTIDA })
  const fotoNoCartao = ficha('pers_foto_cartao', 'conta_nami', { abas: { tecnicas: [cartao('cart_foto', 'Foto', FOTO_EMBUTIDA)] } })
  const { status, corpo } = await doApp('POST', `/api/c/${campanhaId}/publicar`, pedidoDePublicar([nami, zoro, fotoNoRetrato, fotoNoCartao]))
  const resposta = (fichaId) => corpo.fichas?.find((f) => f.fichaId === fichaId)?.resposta ?? {}
  conferir('publicar ok (2 fichas criadas, rev 1 e 2)', status === 200 && resposta('pers_nami').rev === 1 && resposta('pers_zoro').rev === 2, JSON.stringify(corpo))
  const negadaPorFoto = (r) => r.t === 'negado' && r.motivo === 'fora-do-esquema'
  conferir('publicar ficha com data URL no retrato = negado (fora-do-esquema)', negadaPorFoto(resposta('pers_foto_retrato')), JSON.stringify(resposta('pers_foto_retrato')))
  conferir('publicar ficha com data URL num cartão = negado (fora-do-esquema)', negadaPorFoto(resposta('pers_foto_cartao')), JSON.stringify(resposta('pers_foto_cartao')))
  const denovo = await doApp('POST', `/api/c/${campanhaId}/publicar`, pedidoDePublicar([nami, zoro]))
  conferir('publicar de novo = ja-publicada, nenhuma rev nova', denovo.corpo.rev === 2 && denovo.corpo.fichas.every((f) => f.resposta.t === 'ja-publicada'), JSON.stringify(denovo.corpo))
  const eu = await pedir('GET', '/api/eu', NAMI, 'site')
  conferir('Diretório: /api/eu da Nami lista a campanha como jogadora', eu.corpo.campanhas?.some((c) => c.campanhaId === campanhaId && c.papel === 'jogador'), JSON.stringify(eu.corpo))
  const estranho = await pedir('GET', `/api/c/${campanhaId}/exportar`, 'ninguem@example.com', 'site')
  conferir('quem não é membro = 404 (mesma resposta de "não existe")', estranho.status === 404, String(estranho.status))
  // exportar e desde são rotas do app (§5.4): pelo site não há ritmo nem bloqueio, então nem membro passa.
  const jogadoraNoSite = await pedir('GET', `/api/c/${campanhaId}/exportar`, NAMI, 'site')
  conferir('exportar pela jogadora no site = 404 (rota só do app)', jogadoraNoSite.status === 404, String(jogadoraNoSite.status))
  const mestreNoSite = await pedir('GET', `/api/c/${campanhaId}/desde/0`, MESTRE, 'site')
  conferir('desde pelo mestre no site = 404 (a regra olha a origem, não o papel)', mestreNoSite.status === 404, String(mestreNoSite.status))
}

async function entrarNaSala(campanhaId) {
  const nami = await Sala.abrir(campanhaId, NAMI)
  const zoro = await Sala.abrir(campanhaId, ZORO)
  await nami.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami' })
  await zoro.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_zoro' })
  const estado = await nami.esperar((m) => m.t === 'estado', 'o estado')
  await zoro.esperar((m) => m.t === 'estado', 'o estado')
  const minha = estado.fichas.find((f) => f.doc.id === 'pers_nami')
  const doZoro = estado.fichas.find((f) => f.doc.id === 'pers_zoro')
  conferir(
    'estado da Nami: a ficha dela é dela, a do Zoro não, e nada do mestre (dono, nota)',
    minha?.ehMinha === true && doZoro?.ehMinha === false && !('dono' in minha.doc) && !('notaDoMestre' in minha.doc) && doZoro.nomeDoDono === 'Zoro',
    JSON.stringify(estado.fichas.map((f) => [f.doc.id, f.ehMinha, Object.keys(f.doc).includes('dono')])),
  )
  await nami.mandar('ping')
  const pong = await nami.esperar((m) => m.cru === 'pong', 'o pong')
  conferir('ping = pong (auto-resposta do Hibernation)', pong.cru === 'pong')
  return { nami, zoro, rev: estado.rev }
}

async function mesclar(campanhaId, nami, zoro, base) {
  const vidaDoMestre = op('pers_nami', ['recursos', 'hp'], 'definir', base, 'cli_app', { valor: 25 })
  const doApp1 = await doApp('POST', `/api/c/${campanhaId}/ops`, { v: VERSAO, clienteId: 'cli_app', lote: [vidaDoMestre] })
  const descricao = op('pers_nami', ['descricao'], 'definir', base, 'cli_nami', { valor: 'Navegadora dos Chapéus de Palha' })
  await nami.mandar({ t: 'ops', lote: [descricao] })
  const ackDaNami = await nami.respostaDe(descricao.opId)
  const ackDoApp = doApp1.corpo.respostas?.[0] ?? {}
  conferir('2 acks (mestre no app e Nami no site, campos diferentes, mesma base)', ackDoApp.t === 'ack' && ackDaNami.t === 'ack' && ackDaNami.rev === ackDoApp.rev + 1, JSON.stringify([ackDoApp, ackDaNami]))
  const aplicadas = await Promise.all([vidaDoMestre.opId, descricao.opId].map((opId) => zoro.esperar((m) => m.t === 'aplicada' && m.op.opId === opId, `a aplicada de ${opId}`)))
  conferir('o Zoro recebeu as duas como aplicada, com o autor de cada uma', aplicadas.map((m) => m.op.autorNome).join(',') === 'Mestre,Nami')
  const vidaDaNami = op('pers_nami', ['recursos', 'hp'], 'definir', base, 'cli_nami', { valor: 28 })
  await nami.mandar({ t: 'ops', lote: [vidaDaNami] })
  const conflito = await nami.respostaDe(vidaDaNami.opId)
  conferir('1 conflito (mesmo campo, o mestre mudou depois da base): valorAtual 25, quem Mestre', conflito.t === 'conflito' && conflito.valorAtual === 25 && conflito.quem === 'Mestre', JSON.stringify(conflito))
  return { descricao, ackDaNami, vidaDaNami, conflito }
}

async function reenviar(nami, zoro, feitas) {
  await nami.mandar({ t: 'ops', lote: [feitas.descricao] })
  const denovo = await nami.respostaDe(feitas.descricao.opId)
  conferir('reenvio = mesma rev (ack de antes, nada gravado de novo)', denovo.t === 'ack' && denovo.rev === feitas.ackDaNami.rev, JSON.stringify(denovo))
  await nami.mandar({ t: 'ops', lote: [feitas.vidaDaNami] })
  const conflitoDeNovo = await nami.respostaDe(feitas.vidaDaNami.opId)
  conferir('recusada reenviada = mesma resposta (o conflito guardado em recusadas)', JSON.stringify(conflitoDeNovo) === JSON.stringify(feitas.conflito), JSON.stringify(conflitoDeNovo))
  const alheia = { ...feitas.vidaDaNami, fichaId: 'pers_zoro', caminho: ['descricao'], valor: 'Espadachim', clienteId: 'cli_zoro' }
  await zoro.mandar({ t: 'ops', lote: [alheia] })
  const negada = await zoro.respostaDe(alheia.opId)
  conferir('opId alheio = negado sem vazar nada da recusada', negada.t === 'negado' && negada.motivo === 'sem-permissao' && !('valorAtual' in negada) && !('quem' in negada), JSON.stringify(negada))
}

async function desfazer(nami, feitas) {
  await nami.mandar({ t: 'desfazer', opId: feitas.descricao.opId, novoOpId: 'op_desfaz_descricao' })
  const resposta = await nami.respostaDe('op_desfaz_descricao')
  const aplicada = await nami.esperar((m) => m.t === 'aplicada' && m.op.opId === 'op_desfaz_descricao', 'a aplicada do desfazer')
  conferir('desfazer ok (a descrição volta ao vazio, op nova com desfaz)', resposta.t === 'ack' && aplicada.op.desfaz === feitas.descricao.opId && aplicada.op.valor === '', JSON.stringify([resposta, aplicada.op]))
}

async function cartaoComImagem(nami, base) {
  const comImagem = op('pers_nami', ['abas', 'tecnicas', 'cart_haki'], 'criar', base, 'cli_nami', { valor: cartao('cart_haki', 'Haki', MIDIA_FALSA) })
  await nami.mandar({ t: 'ops', lote: [comImagem] })
  const negada = await nami.respostaDe(comImagem.opId)
  conferir('cartão novo com imagem mandado pelo jogador = negado (sem-permissao)', negada.t === 'negado' && negada.motivo === 'sem-permissao', JSON.stringify(negada))
  const semImagem = op('pers_nami', ['abas', 'tecnicas', 'cart_clima'], 'criar', base, 'cli_nami', { valor: cartao('cart_clima', 'Clima-Tact', null) })
  await nami.mandar({ t: 'ops', lote: [semImagem] })
  const aceita = await nami.respostaDe(semImagem.opId)
  conferir('o mesmo cartão sem imagem = ack (a permissão olha a mudança, não só o caminho)', aceita.t === 'ack', JSON.stringify(aceita))
}

async function fichaTrocadaInteira(campanhaId) {
  const rev = (await doApp('GET', `/api/c/${campanhaId}/desde/0?limite=1`)).corpo.revAtual
  const zoroNovo = ficha('pers_zoro', 'conta_zoro', { nome: 'Zoro (trocado)' })
  const trocar = (valor) => {
    const lote = `lote_troca_${contador}`
    const apagar = op('pers_zoro', [], 'apagar', rev, 'cli_app', { loteId: lote, atomico: true })
    const criar = op('pers_zoro', [], 'criar', rev, 'cli_app', { loteId: lote, atomico: true, valor })
    return [apagar, criar]
  }
  const ruim = await doApp('POST', `/api/c/${campanhaId}/ops`, { v: VERSAO, clienteId: 'cli_app', lote: trocar({ ...zoroNovo, retrato: FOTO_EMBUTIDA }) })
  const depoisDoRuim = await doApp('GET', `/api/c/${campanhaId}/exportar`)
  const zoroAinda = depoisDoRuim.corpo.tabelas.fichas.find((f) => f.doc.id === 'pers_zoro')
  conferir(
    'atomico: ficha trocada inteira com o criar recusado = apagar também recusado, ficha continua',
    ruim.corpo.respostas.every((r) => r.t === 'negado') && depoisDoRuim.corpo.revAtual === rev && zoroAinda?.apagada === false,
    JSON.stringify(ruim.corpo),
  )
  const boa = await doApp('POST', `/api/c/${campanhaId}/ops`, { v: VERSAO, clienteId: 'cli_app', lote: trocar(zoroNovo) })
  const [a, b] = boa.corpo.respostas
  conferir('atomico: par válido = 2 acks em revs seguidas', a?.t === 'ack' && b?.t === 'ack' && b.rev === a.rev + 1 && boa.corpo.revAtual === rev + 2, JSON.stringify(boa.corpo))
}

async function exportarEDesde(campanhaId, conflitoId) {
  const inteira = await exportarTudo(campanhaId, MESTRE, 'app', 500)
  const total = inteira.primeira.revAtual
  const emPaginas = await exportarTudo(campanhaId, MESTRE, 'app', 3)
  const recusadas = inteira.primeira.tabelas.recusadas.map((r) => r.opId)
  conferir(
    `exportar com todas as ops (${total}, revs 1..${total}; de 3 em 3 = o mesmo; recusada guardada)`,
    revsSeguidas(inteira.ops, total) && JSON.stringify(emPaginas.ops) === JSON.stringify(inteira.ops) && recusadas.includes(conflitoId),
    `ops=${inteira.ops.length} paginas=${emPaginas.ops.length} recusadas=${recusadas}`,
  )
  const lidas = []
  let desde = 0
  let soOps = true
  for (let volta = 0; volta < 100 && desde < total; volta += 1) {
    const pagina = (await doApp('GET', `/api/c/${campanhaId}/desde/${desde}?limite=2`)).corpo
    soOps &&= pagina.t === 'ops' && !('fichas' in pagina) && pagina.lista.length <= 2
    lidas.push(...pagina.lista)
    desde = pagina.ate
  }
  conferir('desde paginado sem snapshot (de 2 em 2 até a rev atual, só ops)', soOps && revsSeguidas(lidas, total), `lidas=${lidas.length} de ${total}`)
}

async function aceite() {
  const campanhaId = `fumaca-${Date.now().toString(36)}`
  console.log(`campanha ${campanhaId} em ${BASE}`)
  await publicar(campanhaId)
  const { nami, zoro, rev } = await entrarNaSala(campanhaId)
  try {
    const feitas = await mesclar(campanhaId, nami, zoro, rev)
    await reenviar(nami, zoro, feitas)
    await desfazer(nami, feitas)
    await cartaoComImagem(nami, feitas.ackDaNami.rev)
    await fichaTrocadaInteira(campanhaId)
    await exportarEDesde(campanhaId, feitas.vidaDaNami.opId)
  } finally {
    nami.fechar()
    zoro.fechar()
  }
  console.log(falhas === 0 ? `TUDO OK (campanha ${campanhaId})` : `${falhas} FALHA(S)`)
}

/** O limitador (§6.5): rajada acima do ritmo vira `adiado`, nunca `negado`; frames tortos demais fecham o socket e bloqueiam a conta. */
async function limites() {
  const campanhaId = `fumaca-limites-${Date.now().toString(36)}`
  console.log(`campanha ${campanhaId} em ${BASE}`)
  await doApp('POST', `/api/c/${campanhaId}/publicar`, pedidoDePublicar([ficha('pers_nami', 'conta_nami'), ficha('pers_zoro', 'conta_zoro')]))
  const nami = await Sala.abrir(campanhaId, NAMI)
  await nami.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami' })
  await nami.esperar((m) => m.t === 'estado', 'o estado')
  const rajada = Array.from({ length: 8 }, (_, indice) => op('pers_nami', ['descricao'], 'definir', 2, 'cli_nami', { valor: `rajada ${indice}` }))
  for (const mudanca of rajada) nami.ws.send(JSON.stringify({ t: 'ops', lote: [mudanca] }))
  const respostas = await Promise.all(rajada.map((mudanca) => nami.respostaDe(mudanca.opId)))
  const tipos = respostas.map((r) => (r.t === 'adiado' ? `adiado:${r.motivo}` : r.t))
  conferir('rajada acima do ritmo: as primeiras entram, as outras = adiado (ritmo), nenhuma negada', tipos[0] === 'ack' && tipos.at(-1) === 'adiado:ritmo' && !tipos.includes('negado'), tipos.join(' '))
  nami.fechar()
  const zoro = await Sala.abrir(campanhaId, ZORO)
  const fechou = new Promise((pronto) => zoro.ws.addEventListener('close', (evento) => pronto(evento.code), { once: true }))
  for (let vez = 0; vez < 20; vez += 1) zoro.ws.send('{torto')
  const codigo = await Promise.race([fechou, new Promise((pronto) => setTimeout(() => pronto('não fechou'), ESPERA_MS))])
  conferir('20 frames fora do formato = socket fechado (1008)', codigo === 1008, String(codigo))
  const deNovo = await Sala.abrir(campanhaId, ZORO).then(
    (sala) => (sala.fechar(), 'abriu'),
    () => 'recusado',
  )
  conferir('upgrade logo depois do bloqueio = recusado', deNovo === 'recusado', deNovo)
  console.log(falhas === 0 ? 'LIMITES OK' : `${falhas} FALHA(S)`)
}

async function listarOps(campanhaId) {
  const { primeira, ops } = await exportarTudo(campanhaId, MESTRE, 'app', 500)
  if (primeira.ops === undefined) {
    console.log(`exportar falhou: ${JSON.stringify(primeira)}`)
    falhas += 1
    return
  }
  console.log(`campanha ${campanhaId}: ${ops.length} ops (rev atual ${primeira.revAtual})`)
  for (const gravada of ops) {
    const autor = `${gravada.autorNome} (${gravada.origem}${gravada.atestadoPeloApp ? ', atestado pelo app' : ''})`
    const mudanca = gravada.delta === undefined ? JSON.stringify(gravada.valor ?? null).slice(0, 60) : `${gravada.delta > 0 ? '+' : ''}${gravada.delta}`
    console.log(`${String(gravada.rev).padStart(5)}  ${autor}  ${gravada.fichaId}  ${gravada.acao} [${gravada.caminho.join(', ')}] ${mudanca}`)
  }
}

const [modo, campanha] = process.argv.slice(2)
try {
  if (modo === 'exportar') {
    if (campanha === undefined) throw new Error('uso: node fumaca.mjs exportar <campanha>')
    await listarOps(campanha)
  } else if (modo === 'limites') {
    await limites()
  } else {
    await aceite()
  }
} catch (erro) {
  falhas += 1
  console.log(`FALHOU  ${erro instanceof Error ? erro.message : String(erro)}`)
}
process.exit(falhas === 0 ? 0 : 1)
