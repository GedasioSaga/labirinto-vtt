// Teste do Worker do Lobby contra o `wrangler dev` (plano do Lobby, fatia W1).
// Confere a saída esperada de cada passo, então é teste, não só fumaça.
//
// Como rodar (em lobby/nuvem):
//   1. npx wrangler dev src/dev.ts --local --port 8787
//   2. node fumaca.mjs                    -> o aceite inteiro da W1; sai 0 se tudo bateu
//      node fumaca.mjs exportar <campanha> -> lista as ops da campanha, com autor
//      node fumaca.mjs limites             -> o limitador: ritmo vira adiado; frames tortos fecham e bloqueiam
//      node fumaca.mjs midia               -> o aceite da W3: PNG de 2 MiB sobe e volta com o mesmo sha256;
//                                             hash errado = 400; .png com HTML dentro = 400
//      node fumaca.mjs chat                -> o aceite da C1 (mestre, Nami e Zoro em três sockets): sala chega
//                                             aos 3; privado Nami<->Zoro não chega ao mestre; chat.antes com
//                                             canal 'dm:a:b' em texto = recusa; 6º envio em rajada = ritmo;
//                                             exportar sem nenhum privado; presença por conta, sem e-mail;
//                                             trocar o e-mail da Nami não abre o privado dela ao e-mail novo
//      node fumaca.mjs mural               -> o aceite da M1 (mestre, Nami e Zoro): notícia do mestre chega aos 3;
//                                             jogador que tenta postar ou fixar = recusado (sem-permissao); aviso
//                                             fixado aparece no mural.estado de quem entra e some para quem leu;
//                                             modificações da jogadora sem notaDoMestre, NPC nem e-mail
//      node fumaca.mjs duelo               -> a T6 (Nami e Zoro, contas falsas): convite, aceite, duelo curto até o fim
//                                             com todo Atacar pedindo dano 99999 (o servidor aplica o da ficha);
//                                             no meio, a 2ª aba fecha sem deixar ausente e a única aba fecha e volta
//                                             antes dos 3 min; imprime o vencedor
// Outro endereço: NUVEM_URL=http://127.0.0.1:9000 node fumaca.mjs
//
// Prova do bundle (nada de Tauri, React, DOM ou Pixi):
//   npx wrangler deploy --dry-run --outdir <pasta> --metafile <pasta>/meta.json
//   e conferir as entradas do meta.json e o texto do index.js (a porta src/dev.ts não entra).
//
// Só fala com a porta de dev local (identidade pela URL, ?eu=&origem=); nunca com a conta real.
// Nomes e e-mails inventados (@example.com).

import { createHash, randomBytes } from 'node:crypto'
import { crc32, deflateSync } from 'node:zlib'

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
    /** Todo texto que chegou, na ordem (o chat confere que o privado alheio nunca passou por aqui). */
    this.todas = []
    ws.addEventListener('message', (evento) => this.chegou(String(evento.data)))
  }

  chegou(texto) {
    this.todas.push(texto)
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

// ── Mídia (W3, plano §6.6) ───────────────────────────────────────────────────

const MIB = 1024 * 1024
const ASSINATURA_DO_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

function pedacoDoPng(tipo, dados) {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tamanho, corpo, crc])
}

/**
 * Um PNG de verdade (ruído RGB `lado`×`lado`, guardado sem compressão) com um pedaço
 * privado de enchimento (`laBi`, que o leitor de PNG ignora) até `tamanho` bytes exatos.
 */
function pngDe(tamanho, lado) {
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(lado, 0)
  cabecalho.writeUInt32BE(lado, 4)
  cabecalho[8] = 8 // 8 bits por canal
  cabecalho[9] = 2 // RGB
  const linha = lado * 3 + 1
  const pixels = randomBytes(linha * lado)
  for (let y = 0; y < lado; y += 1) pixels[y * linha] = 0 // filtro "nenhum" em cada linha
  const partes = [pedacoDoPng('IHDR', cabecalho), pedacoDoPng('IDAT', deflateSync(pixels, { level: 0 })), pedacoDoPng('IEND', Buffer.alloc(0))]
  const semEnchimento = ASSINATURA_DO_PNG.length + partes.reduce((soma, parte) => soma + parte.length, 0)
  const enchimento = tamanho - semEnchimento - 12
  if (enchimento < 0) throw new Error(`o PNG de ${lado}px já passa de ${tamanho} bytes`)
  return Buffer.concat([ASSINATURA_DO_PNG, partes[0], pedacoDoPng('laBi', Buffer.alloc(enchimento)), partes[1], partes[2]])
}

async function pedirMidia(metodo, campanhaId, midiaId, eu, origem, bytes) {
  const resposta = await fetch(enderecoDe(`/api/c/${campanhaId}/midia/${midiaId}`, eu, origem), {
    method: metodo,
    headers: bytes === undefined ? {} : { 'content-type': 'image/png' },
    body: bytes,
  })
  const corpo = Buffer.from(await resposta.arrayBuffer())
  let json = null
  try {
    json = JSON.parse(corpo.toString('utf8'))
  } catch {
    json = null
  }
  return { status: resposta.status, cabecalhos: resposta.headers, bytes: corpo, json }
}

const subirMidia = (campanhaId, midiaId, bytes) => pedirMidia('PUT', campanhaId, midiaId, MESTRE, 'app', bytes)

async function aceiteDaMidia() {
  const campanhaId = `fumaca-midia-${Date.now().toString(36)}`
  console.log(`campanha ${campanhaId} em ${BASE}`)
  const publicada = await doApp('POST', `/api/c/${campanhaId}/publicar`, pedidoDePublicar([ficha('pers_nami', 'conta_nami')]))
  if (publicada.status !== 200) throw new Error(`publicar falhou (${publicada.status}): ${JSON.stringify(publicada.corpo)}`)

  // 1. Imagem de 2 MiB exatos (o teto, §6.6): o mestre sobe pelo app; a jogadora baixa pelo site.
  const imagem = pngDe(2 * MIB, 835)
  const hash = sha256(imagem)
  const id = `${hash}.png`
  const subida = await subirMidia(campanhaId, id, imagem)
  const baixada = await pedirMidia('GET', campanhaId, id, NAMI, 'site')
  const hashBaixado = sha256(baixada.bytes)
  console.log(`        PUT ${imagem.length} bytes -> ${subida.status} ${JSON.stringify(subida.json)}`)
  console.log(`        sha256 enviado ${hash}`)
  console.log(`        sha256 baixado ${hashBaixado} (${baixada.bytes.length} bytes, GET ${baixada.status})`)
  conferir(
    '2 MiB: PUT 200 e o GET da jogadora no site devolve os mesmos bytes (sha256 igual)',
    subida.status === 200 && subida.json?.novo === true && baixada.status === 200 && baixada.bytes.length === 2 * MIB && hashBaixado === hash,
  )
  const cabecalho = (nome) => baixada.cabecalhos.get(nome)
  conferir(
    'GET: image/png, cache privado e imutável, nosniff, CSP sem nada e em sandbox',
    cabecalho('content-type') === 'image/png' &&
      cabecalho('cache-control') === 'private, max-age=31536000, immutable' &&
      cabecalho('x-content-type-options') === 'nosniff' &&
      cabecalho('content-security-policy') === "default-src 'none'; sandbox",
    JSON.stringify(Object.fromEntries(baixada.cabecalhos)),
  )

  // 2. Hash errado: bytes de PNG válido num endereço cujo hash é de outro conteúdo.
  const outra = pngDe(64 * 1024, 64)
  const idErrado = `${sha256(Buffer.from('outro conteúdo'))}.png`
  const errada = await subirMidia(campanhaId, idErrado, outra)
  const depoisDaErrada = await pedirMidia('GET', campanhaId, idErrado, NAMI, 'site')
  console.log(`        hash errado: PUT -> ${errada.status} ${JSON.stringify(errada.json)}; GET depois -> ${depoisDaErrada.status}`)
  conferir('hash errado = 400 (hash-errado) e nada gravado (GET 404)', errada.status === 400 && errada.json?.erro === 'hash-errado' && depoisDaErrada.status === 404)

  // 3. Um .png que é HTML por dentro, com o hash CERTO: só o tipo pelos bytes barra.
  const html = Buffer.from('<!doctype html><html><body><script>alert(1)</script></body></html>', 'utf8')
  const idHtml = `${sha256(html)}.png`
  const comHtml = await subirMidia(campanhaId, idHtml, html)
  const depoisDoHtml = await pedirMidia('GET', campanhaId, idHtml, NAMI, 'site')
  console.log(`        .png com HTML: PUT -> ${comHtml.status} ${JSON.stringify(comHtml.json)}; GET depois -> ${depoisDoHtml.status}`)
  conferir('.png com HTML dentro (hash certo) = 400 (tipo-errado) e nada gravado (GET 404)', comHtml.status === 400 && comHtml.json?.erro === 'tipo-errado' && depoisDoHtml.status === 404)

  console.log(falhas === 0 ? `MIDIA OK (campanha ${campanhaId})` : `${falhas} FALHA(S)`)
}

// ── Chat (C1, plano 8.2; liberado pela 12.18 f) ─────────────────────────────

const esperarMs = (ms) => new Promise((pronto) => setTimeout(pronto, ms))

async function abrirOs3(campanhaId) {
  const salas = { mestre: await Sala.abrir(campanhaId, MESTRE), nami: await Sala.abrir(campanhaId, NAMI), zoro: await Sala.abrir(campanhaId, ZORO) }
  for (const [nome, sala] of Object.entries(salas)) await sala.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: `cli_${nome}` })
  for (const sala of Object.values(salas)) await sala.esperar((m) => m.t === 'estado', 'o estado')
  const presenca = await salas.mestre.esperar((m) => m.t === 'presenca' && m.naMesa.length === 3, 'a presença com os 3')
  const contas = presenca.naMesa.map((p) => p.contaId).join(',')
  const textoDaPresenca = JSON.stringify(presenca)
  conferir('presença: os 3 na mesa, uma linha por conta, mestre primeiro, sem e-mail', contas === 'mestre,conta_nami,conta_zoro' && !textoDaPresenca.includes('@') && !textoDaPresenca.includes('email'), textoDaPresenca)
  return salas
}

const okDe = (sala, idDoCliente) => sala.esperar((m) => (m.t === 'chat.ok' || m.t === 'chat.recusado') && m.idDoCliente === idDoCliente, `a resposta de ${idDoCliente}`)
const msgNoCanal = (sala, id, eDm) => sala.esperar((m) => m.t === 'chat.msg' && m.msg.id === id && (eDm(m.canal)), `a chat.msg ${id}`)

async function salaEPrivados(s, marcadorDm) {
  const pedido = { t: 'chat.enviar', canal: 'sala', texto: '  oi, sala! @Zoro  ', idDoCliente: 'c_sala_1' }
  await s.nami.mandar(pedido)
  const ok = await okDe(s.nami, 'c_sala_1')
  const [doMestre, doZoro] = await Promise.all([s.mestre, s.zoro].map((sala) => msgNoCanal(sala, ok.msg?.id, (canal) => canal === 'sala')))
  conferir(
    'sala chega aos 3 (chat.ok da Nami; mestre e Zoro recebem a mesma; texto limpo; @Zoro = conta_zoro)',
    ok.t === 'chat.ok' && ok.msg.texto === 'oi, sala! @Zoro' && ok.msg.mencoes.join() === 'conta_zoro' && doMestre.msg.id === ok.msg.id && doZoro.msg.autorNome === 'Nami',
    JSON.stringify(ok),
  )
  await s.nami.mandar(pedido)
  const deNovo = await okDe(s.nami, 'c_sala_1')
  conferir('reenvio do mesmo idDoCliente = a mesma mensagem (nada gravado de novo)', deNovo.t === 'chat.ok' && deNovo.msg.id === ok.msg.id, JSON.stringify(deNovo))

  await s.nami.mandar({ t: 'chat.enviar', canal: { dm: 'conta_zoro' }, texto: `segredo ${marcadorDm}`, idDoCliente: 'c_dm_1' })
  const okDm = await okDe(s.nami, 'c_dm_1')
  const noZoro = await msgNoCanal(s.zoro, okDm.msg?.id, (canal) => canal?.dm === 'conta_nami')
  conferir('privado Nami -> Zoro chega ao Zoro como {dm: conta_nami}', okDm.t === 'chat.ok' && noZoro.msg.texto === `segredo ${marcadorDm}`, JSON.stringify(okDm))

  await s.mestre.mandar({ t: 'chat.enviar', canal: { dm: 'conta_nami' }, texto: 'oi Nami, aqui é o mestre', idDoCliente: 'c_dm_mestre' })
  const okMestre = await okDe(s.mestre, 'c_dm_mestre')
  const naNami = await msgNoCanal(s.nami, okMestre.msg?.id, (canal) => canal?.dm === 'mestre')
  conferir('privado mestre -> Nami existe (12.16) e chega a ela como {dm: mestre}', okMestre.t === 'chat.ok' && naNami.msg.autorContaId === 'mestre', JSON.stringify(okMestre))
  return ok.msg
}

/** O mestre tenta ler o privado Nami<->Zoro por todos os caminhos que tem: ao vivo, pela volta (`chat.desde`) e pelo privado dele com a Nami. */
async function mestreNaoVePrivadoAlheio(s, marcadorDm) {
  await s.mestre.mandar({ t: 'chat.desde', cursor: 0 })
  const resumo = await s.mestre.esperar((m) => m.t === 'chat.resumo', 'o resumo do mestre')
  const mudancas = await s.mestre.esperar((m) => m.t === 'chat.mudancas', 'as mudanças do mestre')
  await s.mestre.mandar({ t: 'chat.antes', canal: { dm: 'conta_nami' }, antesDeId: null, limite: 50 })
  const comANami = await s.mestre.esperar((m) => m.t === 'chat.lista', 'o privado do mestre com a Nami')
  const vazou = s.mestre.todas.some((texto) => texto.includes(marcadorDm))
  conferir(
    'privado Nami<->Zoro não chega ao mestre (ao vivo, chat.desde 0, chat.antes do privado dele com a Nami)',
    !vazou && mudancas.lista.some((m) => m.canal === 'sala') && comANami.lista.length === 1 && resumo.canais.every((c) => c.canal === 'sala' || c.canal.dm === 'conta_nami'),
    `vazou=${vazou} mudancas=${JSON.stringify(mudancas.lista.map((m) => m.canal))} privado=${comANami.lista.length} canais=${JSON.stringify(resumo.canais.map((c) => c.canal))}`,
  )
  await s.mestre.mandar({ t: 'chat.antes', canal: 'dm:conta_nami:conta_zoro', antesDeId: null, limite: 50 })
  const recusa = await s.mestre.esperar((m) => m.t === 'chat.recusado' || m.t === 'chat.lista', 'a resposta do chat.antes torto')
  conferir("chat.antes com canal 'dm:conta_nami:conta_zoro' em texto = chat.recusado (formato), sem lista", recusa.t === 'chat.recusado' && recusa.pedido === 'chat.antes' && recusa.motivo === 'formato', JSON.stringify(recusa))
}

async function lidasELapide(s, daSala) {
  await s.zoro.mandar({ t: 'chat.desde', cursor: null })
  const antes = await s.zoro.esperar((m) => m.t === 'chat.resumo', 'o resumo do Zoro')
  await s.zoro.mandar({ t: 'chat.lida', canal: { dm: 'conta_nami' }, ateId: 999 })
  const depois = await s.zoro.esperar((m) => m.t === 'chat.resumo', 'o resumo do Zoro depois de ler')
  const naoLidas = (resumo, eSala) => resumo.canais.find((c) => (eSala ? c.canal === 'sala' : c.canal.dm === 'conta_nami'))?.naoLidas
  conferir(
    'não lidas do Zoro: sala 1 e privado com a Nami 1; chat.lida (ateId além do fim) zera o privado e deixa a sala',
    naoLidas(antes, true) === 1 && naoLidas(antes, false) === 1 && naoLidas(depois, false) === 0 && naoLidas(depois, true) === 1,
    JSON.stringify([antes.canais, depois.canais]),
  )
  await s.nami.mandar({ t: 'chat.apagar', canal: 'sala', id: daSala.id })
  const [paraZoro, paraNami] = await Promise.all([s.zoro, s.nami].map((sala) => sala.esperar((m) => m.t === 'chat.apagada' && m.id === daSala.id, 'a lápide')))
  conferir('apagar = lápide para todos (chat.apagada com mudou novo)', paraZoro.canal === 'sala' && paraNami.mudou > daSala.mudou, JSON.stringify(paraZoro))
}

async function rajada(s) {
  await esperarVez(ZORO)
  await esperarMs(INTERVALO_ENTRE_FRAMES_MS)
  const ids = Array.from({ length: 6 }, (_, indice) => `c_rajada_${indice}`)
  ids.forEach((idDoCliente, indice) => s.zoro.ws.send(JSON.stringify({ t: 'chat.enviar', canal: 'sala', texto: `rajada ${indice}`, idDoCliente })))
  const respostas = await Promise.all(ids.map((idDoCliente) => okDe(s.zoro, idDoCliente)))
  ultimoFrame.set(ZORO, Date.now())
  const tipos = respostas.map((r) => (r.t === 'chat.recusado' ? `recusado:${r.motivo}` : r.t))
  conferir('rajada de 6 na sala: 5 entram, o 6º = chat.recusado (ritmo) com tentarDepoisDe', tipos.slice(0, 5).every((t) => t === 'chat.ok') && tipos[5] === 'recusado:ritmo' && respostas[5].tentarDepoisDe > 0, tipos.join(' '))
}

async function semPrivadoNoApp(campanhaId, marcadorDm) {
  const exportada = await doApp('GET', `/api/c/${campanhaId}/exportar`)
  const texto = JSON.stringify(exportada.corpo)
  const sala = exportada.corpo.tabelas?.chatSala ?? []
  conferir(
    'exportar: a sala inteira (5 da rajada + 1 lápide sem texto), nenhum privado',
    exportada.status === 200 && sala.length === 6 && sala.filter((m) => m.apagadaEm !== null && m.texto === '').length === 1 && !texto.includes(marcadorDm) && !texto.includes('aqui é o mestre'),
    `status=${exportada.status} sala=${sala.length}`,
  )
  const copia = await doApp('GET', `/api/c/${campanhaId}/chat/sala?desde=0`)
  const lista = copia.corpo.lista ?? []
  conferir(
    'cópia da sala do app (GET chat/sala?desde=0): as 6 com a lápide, nenhum privado, ate = cursor de agora',
    copia.status === 200 && lista.length === 6 && lista.some((m) => m.apagadaEm !== null) && !JSON.stringify(copia.corpo).includes(marcadorDm) && copia.corpo.ate === copia.corpo.cursorAtual,
    JSON.stringify({ status: copia.status, n: lista.length, ate: copia.corpo.ate, cursorAtual: copia.corpo.cursorAtual }),
  )
}

const MESTRE_ALT = 'mestre.alt@example.com'

function membrosComANami(emailDaNami) {
  return {
    v: VERSAO,
    nomeDoMestre: 'Mestre',
    membros: [
      { contaId: 'conta_nami', email: emailDaNami, nome: 'Nami' },
      { contaId: 'conta_zoro', email: ZORO, nome: 'Zoro' },
    ],
  }
}

/** Abre o socket, manda `ola`, pede o privado com o Zoro e devolve a `chat.lista` (fecha o socket no fim). */
async function privadoComOZoro(campanhaId, email, clienteId, depois = async () => {}) {
  const sala = await Sala.abrir(campanhaId, email)
  try {
    await sala.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId })
    await sala.esperar((m) => m.t === 'estado', `o estado de ${email}`)
    await sala.mandar({ t: 'chat.antes', canal: { dm: 'conta_zoro' }, antesDeId: null, limite: 50 })
    const lista = await sala.esperar((m) => m.t === 'chat.lista', 'o privado com o Zoro')
    return { lista, ...(await depois(sala)) }
  } finally {
    sala.fechar()
  }
}

/**
 * Achado da revisão da C1: quem liga conta a e-mail é o mestre. Ele troca o e-mail da Nami pelo de
 * uma segunda conta dele e entra no site com ela; o privado Nami<->Zoro não pode aparecer por nenhum
 * caminho. Depois o e-mail volta e a Nami lê tudo de novo (o privado ficou fechado, não apagado).
 */
async function trocaDeEmailNaoAbrePrivado(campanhaId, marcadorDm) {
  const trocou = await doApp('POST', `/api/c/${campanhaId}/membros`, membrosComANami(MESTRE_ALT))
  const comOAlt = await privadoComOZoro(campanhaId, MESTRE_ALT, 'cli_mestre_alt', async (alt) => {
    await alt.mandar({ t: 'chat.desde', cursor: 0 })
    const resumo = await alt.esperar((m) => m.t === 'chat.resumo', 'o resumo da conta trocada')
    const mudancas = await alt.esperar((m) => m.t === 'chat.mudancas', 'as mudanças da conta trocada')
    return { resumo, mudancas, vazou: alt.todas.some((texto) => texto.includes(marcadorDm)) }
  })
  const soSala = (canais) => canais.every((canal) => canal === 'sala')
  conferir(
    'mestre troca o e-mail da Nami pelo de outra conta dele: o privado Nami<->Zoro não aparece (chat.antes, chat.desde 0, resumo)',
    trocou.status === 200 &&
      !comOAlt.vazou &&
      comOAlt.lista.lista.length === 0 &&
      soSala(comOAlt.resumo.canais.map((c) => c.canal)) &&
      soSala(comOAlt.mudancas.lista.map((m) => m.canal)),
    `membros=${trocou.status} vazou=${comOAlt.vazou} lista=${comOAlt.lista.lista.length} canais=${JSON.stringify(comOAlt.resumo.canais.map((c) => c.canal))}`,
  )
  const voltou = await doApp('POST', `/api/c/${campanhaId}/membros`, membrosComANami(NAMI))
  const daNami = await privadoComOZoro(campanhaId, NAMI, 'cli_nami_de_volta')
  conferir(
    'o e-mail volta para a Nami: ela lê o privado com o Zoro de novo (fechado, não apagado)',
    voltou.status === 200 && daNami.lista.lista.some((m) => m.texto === `segredo ${marcadorDm}`),
    `membros=${voltou.status} lista=${JSON.stringify(daNami.lista.lista.map((m) => m.texto))}`,
  )
}

async function aceiteDoChat() {
  const campanhaId = `fumaca-chat-${Date.now().toString(36)}`
  const marcadorDm = `dm-${randomBytes(4).toString('hex')}`
  console.log(`campanha ${campanhaId} em ${BASE}`)
  const publicada = await doApp('POST', `/api/c/${campanhaId}/publicar`, pedidoDePublicar([ficha('pers_nami', 'conta_nami'), ficha('pers_zoro', 'conta_zoro')]))
  if (publicada.status !== 200) throw new Error(`publicar falhou (${publicada.status}): ${JSON.stringify(publicada.corpo)}`)
  const s = await abrirOs3(campanhaId)
  try {
    const daSala = await salaEPrivados(s, marcadorDm)
    await mestreNaoVePrivadoAlheio(s, marcadorDm)
    await lidasELapide(s, daSala)
    await rajada(s)
    await semPrivadoNoApp(campanhaId, marcadorDm)
    s.mestre.recebidas = s.mestre.recebidas.filter((m) => m.t !== 'presenca')
    s.zoro.fechar()
    const semZoro = await s.mestre.esperar((m) => m.t === 'presenca', 'a presença depois que o Zoro saiu')
    conferir('Zoro fecha a aba: a presença do mestre fica só com mestre e Nami', semZoro.naMesa.map((p) => p.contaId).join(',') === 'mestre,conta_nami', JSON.stringify(semZoro))
    await trocaDeEmailNaoAbrePrivado(campanhaId, marcadorDm)
  } finally {
    for (const sala of Object.values(s)) sala.fechar()
  }
  console.log(falhas === 0 ? `CHAT OK (campanha ${campanhaId})` : `${falhas} FALHA(S)`)
}

// ── Mural (M1, plano 8.2; permissão e projeção liberadas pela 12.18 b e c) ───

/** Sistema com o nome do recurso: a frase do feed diz "Vida", não "hp". */
const SISTEMA_DO_MURAL = { id: 'one-piece', nome: 'One Piece', recursos: [{ id: 'hp', nome: 'Vida' }], abas: [{ id: 'tecnicas', nome: 'Técnicas' }] }

const doMural = (sala, criterio, descricao) => sala.esperar((m) => typeof m.t === 'string' && m.t.startsWith('mural.') && criterio(m), descricao)

async function noticiaChegaAos3(s, marcador) {
  await s.mestre.mandar({ t: 'mural.postar', texto: `  Sessão no sábado! @Nami ${marcador}  `, imagem: null, idDoCliente: 'n_1' })
  const ok = await doMural(s.mestre, (m) => (m.t === 'mural.ok' || m.t === 'mural.recusado') && m.idDoCliente === 'n_1', 'o mural.ok do mestre')
  const [naNami, noZoro] = await Promise.all([s.nami, s.zoro].map((sala) => doMural(sala, (m) => m.t === 'mural.noticia' && m.noticia.id === ok.noticia?.id, 'a notícia do mestre')))
  conferir(
    'notícia do mestre chega aos 3 (mural.ok ao mestre; Nami e Zoro recebem a mesma; texto limpo; @Nami = conta_nami)',
    ok.t === 'mural.ok' && ok.noticia.texto === `Sessão no sábado! @Nami ${marcador}` && ok.noticia.mencoes.join() === 'conta_nami' && naNami.noticia.texto === ok.noticia.texto && noZoro.noticia.autorNome === 'Mestre',
    JSON.stringify(ok),
  )
  return ok.noticia
}

async function jogadorNaoPostaNemFixa(s, noticia) {
  await s.nami.mandar({ t: 'mural.postar', texto: 'post da Nami', imagem: null, idDoCliente: 'n_nami' })
  const postar = await doMural(s.nami, (m) => m.t === 'mural.recusado' || m.t === 'mural.ok', 'a resposta do postar da Nami')
  conferir(
    'jogadora tenta postar = mural.recusado (sem-permissao), nada chega ao mestre',
    postar.t === 'mural.recusado' && postar.motivo === 'sem-permissao' && postar.idDoCliente === 'n_nami' && !s.mestre.todas.some((texto) => texto.includes('post da Nami')),
    JSON.stringify(postar),
  )
  await s.zoro.mandar({ t: 'mural.fixar', id: noticia.id, fixada: true })
  const fixar = await doMural(s.zoro, (m) => m.t === 'mural.recusado' || (m.t === 'mural.noticia' && m.noticia.fixada), 'a resposta do fixar do Zoro')
  conferir('jogador tenta fixar = mural.recusado (sem-permissao)', fixar.t === 'mural.recusado' && fixar.pedido === 'mural.fixar' && fixar.motivo === 'sem-permissao', JSON.stringify(fixar))
}

/** Abre outro socket da conta, manda `ola` e devolve o `mural.estado` que chega (fecha o socket no fim). */
async function estadoDoMuralAoEntrar(campanhaId, email, clienteId) {
  const sala = await Sala.abrir(campanhaId, email)
  try {
    await sala.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId })
    return await sala.esperar((m) => m.t === 'mural.estado', `o mural.estado de ${email}`)
  } finally {
    sala.fechar()
  }
}

async function avisoAteLer(campanhaId, s, noticia) {
  await s.mestre.mandar({ t: 'mural.fixar', id: noticia.id, fixada: true })
  const fixada = await doMural(s.zoro, (m) => m.t === 'mural.noticia' && m.noticia.id === noticia.id && m.noticia.fixada, 'o aviso fixado no Zoro')
  await s.zoro.mandar({ t: 'mural.lido', id: noticia.id, versao: fixada.noticia.versao })
  await doMural(s.zoro, (m) => m.t === 'mural.noticia' && m.noticia.id === noticia.id && m.noticia.lida, 'o lido do Zoro')
  const daNami = await estadoDoMuralAoEntrar(campanhaId, NAMI, 'cli_nami_2')
  const doZoro = await estadoDoMuralAoEntrar(campanhaId, ZORO, 'cli_zoro_2')
  const aviso = (estado) => estado.fixadas.find((n) => n.id === noticia.id)
  conferir(
    'aviso fixado aparece no mural.estado de quem entra (Nami não leu: lida=false, mesma versão)',
    aviso(daNami)?.lida === false && aviso(daNami)?.versao === fixada.noticia.versao,
    JSON.stringify(daNami.fixadas),
  )
  conferir('o aviso some para quem marcou lido (Zoro entra de novo: lida=true, a faixa de aviso não aparece)', aviso(doZoro)?.lida === true, JSON.stringify(doZoro.fixadas))
}

async function confirmar(sala, lote) {
  await sala.mandar({ t: 'ops', lote })
  const respostas = await Promise.all(lote.map((uma) => sala.respostaDe(uma.opId)))
  if (!respostas.every((r) => r.t === 'ack')) throw new Error(`ops do teste não entraram: ${JSON.stringify(respostas)}`)
}

const pedirModificacoes = async (sala, filtros = {}) => {
  await sala.mandar({ t: 'mural.modificacoes', fichaId: null, autorContaId: null, antesDeRev: null, limite: 50, ...filtros })
  return doMural(sala, (m) => m.t === 'mural.modificacoes', `as modificações de ${sala.email}`)
}

async function modificacoesPelaProjecao(s, base, marcadorNota) {
  await confirmar(s.mestre, [
    op('pers_nami', ['notaDoMestre'], 'definir', base, 'cli_mestre', { valor: `nota ${marcadorNota}` }),
    op('pers_npc', ['recursos', 'hp'], 'definir', base, 'cli_mestre', { valor: 1 }),
  ])
  await confirmar(s.nami, [op('pers_nami', ['recursos', 'hp'], 'definir', base, 'cli_nami', { valor: 250 })])
  const daNami = await pedirModificacoes(s.nami)
  const texto = JSON.stringify(daNami)
  conferir(
    'modificações vistas pela jogadora: "Nami mudou Vida de 300 para 250", sem notaDoMestre, NPC nem e-mail',
    daNami.lista.some((linha) => linha.frase === 'Nami mudou Vida de 300 para 250') &&
      !texto.includes(marcadorNota) &&
      !texto.includes('nota do mestre') &&
      !texto.includes('nunca vê') &&
      !texto.includes('pers_npc') &&
      !texto.includes('@'),
    texto,
  )
  const doMestre = await pedirModificacoes(s.mestre)
  conferir(
    'o mestre vê no feed dele a nota do mestre e o NPC (o filtro é a projeção de quem lê)',
    doMestre.lista.some((linha) => linha.frase === 'Mestre mudou a nota do mestre') && doMestre.lista.some((linha) => linha.fichaId === 'pers_npc'),
    JSON.stringify(doMestre.lista.map((linha) => linha.frase)),
  )
  const filtrada = await pedirModificacoes(s.zoro, { fichaId: 'pers_nami', autorContaId: 'conta_nami' })
  conferir(
    'filtro por ficha e por pessoa: o Zoro pede pers_nami + conta_nami e só vem a mudança da Nami na ficha dela',
    filtrada.lista.length === 1 && filtrada.lista[0].fichaId === 'pers_nami' && filtrada.lista[0].autorNome === 'Nami' && filtrada.proximaAntesDeRev === null,
    JSON.stringify(filtrada),
  )
}

async function aceiteDoMural() {
  const campanhaId = `fumaca-mural-${Date.now().toString(36)}`
  const marcador = `aviso-${randomBytes(4).toString('hex')}`
  const marcadorNota = `nota-${randomBytes(4).toString('hex')}`
  console.log(`campanha ${campanhaId} em ${BASE}`)
  const npc = ficha('pers_npc', undefined, { tipo: 'npc', nome: 'Capitão da Marinha' })
  const pedido = { ...pedidoDePublicar([ficha('pers_nami', 'conta_nami'), ficha('pers_zoro', 'conta_zoro'), npc]), sistema: SISTEMA_DO_MURAL }
  const publicada = await doApp('POST', `/api/c/${campanhaId}/publicar`, pedido)
  if (publicada.status !== 200 || publicada.corpo.rev !== 3) throw new Error(`publicar falhou (${publicada.status}): ${JSON.stringify(publicada.corpo)}`)
  const s = await abrirOs3(campanhaId)
  try {
    const noticia = await noticiaChegaAos3(s, marcador)
    await jogadorNaoPostaNemFixa(s, noticia)
    await avisoAteLer(campanhaId, s, noticia)
    await modificacoesPelaProjecao(s, publicada.corpo.rev, marcadorNota)
  } finally {
    for (const sala of Object.values(s)) sala.fechar()
  }
  console.log(falhas === 0 ? `MURAL OK (campanha ${campanhaId})` : `${falhas} FALHA(S)`)
}

// ── Duelo (T6, plano 8.2) ────────────────────────────────────────────────────

/** Um One Piece mínimo: Vida e SP como a batalha lê (tom e atual/máximo), Força e Agilidade, a aba Armas. */
const SISTEMA_DO_DUELO = {
  id: 'one-piece',
  nome: 'One Piece',
  recursos: [
    { id: 'hp', nome: 'HP', tom: 'vida', atualEMaximo: true },
    { id: 'sp', nome: 'SP', tom: 'energia', atualEMaximo: true },
  ],
  atributos: [
    { id: 'forca', nome: 'Força', abreviacao: 'FOR' },
    { id: 'agilidade', nome: 'Agilidade', abreviacao: 'AGI' },
  ],
  abas: [{ id: 'armas', nome: 'Armas', campos: [{ id: 'dano', rotulo: 'Dano', forma: 'linha' }] }],
}

/** O dano que o cliente "pede" em todo Atacar: o servidor tem de ignorar e usar o da ficha. */
const DANO_FORJADO = 99999

function lutadoraDoDuelo(id, dono, vida, forca, agilidade, arma) {
  return ficha(id, dono, {
    recursos: { hp: vida, sp: 50 },
    maximos: { hp: vida, sp: 50 },
    atributos: { forca, agilidade },
    abas: { armas: [{ id: arma.id, nome: arma.nome, campos: { dano: String(arma.dano) }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }] },
  })
}

const doDuelo = (sala, criterio, descricao) => sala.esperar((m) => typeof m.t === 'string' && m.t.startsWith('duelo.') && criterio(m), descricao)

function vagaDoToken(duelo, tokenId) {
  const vaga = duelo.lutadores.vagas.find((candidata) => candidata.tokenId === tokenId)
  if (vaga === undefined) throw new Error(`token ${tokenId} sem vaga`)
  return vaga
}

function vidaDoToken(duelo, tokenId) {
  const { personagemId } = vagaDoToken(duelo, tokenId)
  return duelo.lutadores.personagens.find((p) => p.id === personagemId).recursos.hp
}

/**
 * A próxima jogada, como dois jogadores bem simples: golpe esperando reação = "não reagir" (toma
 * inteiro); na vez, Atacar com a primeira arma no outro lado pedindo DANO_FORJADO; depois do
 * Atacar (Simples gasta), passar a vez.
 */
function proximaJogada(duelo) {
  const { turnos, seq } = duelo
  const contaDoToken = (tokenId) => duelo.jogadores[vagaDoToken(duelo, tokenId).lado].contaId
  for (const golpe of turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (alvo.danoFinal !== undefined || !alvo.podeReagir) continue
      return { contaId: contaDoToken(alvo.tokenId), golpe: { dano: alvo.dano, tokenId: alvo.tokenId }, jogada: { tipo: 'reagir', seq, pedido: { tipo: 'naoReagir', golpeId: golpe.id, tokenId: alvo.tokenId } } }
    }
  }
  const carta = turnos.cartas.find((candidata) => candidata.id === turnos.vez)
  if (carta === undefined) throw new Error('duelo sem vez')
  const vez = { cartaId: carta.id, rodada: turnos.rodada }
  const contaId = contaDoToken(carta.tokenId)
  if ((turnos.gastos?.[carta.id]?.simples ?? 0) > 0) return { contaId, jogada: { tipo: 'passar', seq, vez } }
  const minha = vagaDoToken(duelo, carta.tokenId)
  const alvo = duelo.lutadores.vagas.find((vaga) => vaga.lado !== minha.lado)
  const copia = duelo.lutadores.personagens.find((p) => p.id === minha.personagemId)
  const pedido = { tipo: 'atacar', armaId: copia.abas.armas[0].id, alvos: [{ tokenId: alvo.tokenId, dano: DANO_FORJADO }], surpresa: false, perfurante: false }
  return { contaId, jogada: { tipo: 'agir', seq, vez, pedido } }
}

async function jogarUmaVez(salas, duelo, golpesConferidos) {
  const { contaId, jogada, golpe } = proximaJogada(duelo)
  const sala = salas[contaId]
  await sala.mandar({ t: 'duelo.jogar', id: duelo.id, jogada })
  const resposta = await doDuelo(sala, (m) => (m.t === 'duelo.estado' && m.duelo.id === duelo.id && m.duelo.seq === duelo.seq + 1) || (m.t === 'duelo.recusado' && m.id === duelo.id), `o estado depois de ${jogada.tipo}`)
  if (resposta.t === 'duelo.recusado') throw new Error(`${jogada.tipo} recusado: ${resposta.motivo}`)
  if (golpe !== undefined) {
    const antes = vidaDoToken(duelo, golpe.tokenId)
    const depois = vidaDoToken(resposta.duelo, golpe.tokenId)
    golpesConferidos.push({ pedido: DANO_FORJADO, servidor: golpe.dano, antes, depois })
  }
  return resposta.duelo
}

/**
 * No meio do duelo (achado Tr9 e resposta 12.15): a 2ª aba da Nami fecha e a conta NÃO fica
 * ausente; depois a única aba fecha (Zoro vê a Nami ausente), ela reabre antes dos 3 minutos e
 * recebe o duelo de volta, presente, no mesmo `seq`.
 */
async function caiEVolta(campanhaId, salas, duelo) {
  const zoro = salas.conta_zoro
  const segunda = await Sala.abrir(campanhaId, NAMI)
  await segunda.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami_aba2' })
  await doDuelo(segunda, (m) => m.t === 'duelo.lista', 'a lista da 2ª aba')
  zoro.recebidas.length = 0
  segunda.fechar()
  await esperarMs(1500)
  const ausenteCedo = zoro.recebidas.some((m) => m.t === 'duelo.estado' && m.duelo.jogadores.a.ausenteDesde !== null)
  conferir('fechar a 2ª aba da Nami (a 1ª segue aberta) não a deixa ausente', !ausenteCedo)
  salas.conta_nami.fechar()
  const caiu = await doDuelo(zoro, (m) => m.t === 'duelo.estado' && m.duelo.jogadores.a.ausenteDesde !== null, 'a Nami ausente')
  zoro.recebidas.length = 0
  const volta = await Sala.abrir(campanhaId, NAMI)
  await volta.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami_volta' })
  const lista = await doDuelo(volta, (m) => m.t === 'duelo.lista', 'a lista da volta')
  const voltou = await doDuelo(zoro, (m) => m.t === 'duelo.estado' && m.duelo.jogadores.a.ausenteDesde === null, 'a Nami de volta')
  const naLista = lista.duelos.find((d) => d.id === duelo.id)
  conferir(
    'Nami fecha a única aba: Zoro vê ausente; ela reabre antes dos 3 min e o duelo volta (mesmo seq, presente, sem fim)',
    caiu.duelo.seq === duelo.seq && naLista?.seq === duelo.seq && naLista.jogadores.a.ausenteDesde === null && naLista.fim === null && voltou.duelo.fim === null,
    JSON.stringify({ caiu: caiu.duelo.jogadores, lista: naLista?.jogadores, seq: naLista?.seq }),
  )
  salas.conta_nami = volta
  return naLista
}

async function aceiteDoDuelo() {
  const campanhaId = `fumaca-duelo-${Date.now().toString(36)}`
  console.log(`campanha ${campanhaId} em ${BASE}`)
  const nami = lutadoraDoDuelo('pers_nami', 'conta_nami', 300, 60, 80, { id: 'arma_bastao', nome: 'Bastão', dano: 20 })
  const zoro = lutadoraDoDuelo('pers_zoro', 'conta_zoro', 150, 30, 10, { id: 'arma_faca', nome: 'Faca', dano: 10 })
  const publicada = await doApp('POST', `/api/c/${campanhaId}/publicar`, { ...pedidoDePublicar([nami, zoro]), sistema: SISTEMA_DO_DUELO })
  if (publicada.status !== 200) throw new Error(`publicar falhou (${publicada.status}): ${JSON.stringify(publicada.corpo)}`)
  const salas = { conta_nami: await Sala.abrir(campanhaId, NAMI), conta_zoro: await Sala.abrir(campanhaId, ZORO) }
  try {
    await salas.conta_nami.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami' })
    await salas.conta_zoro.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_zoro' })
    await Promise.all([salas.conta_nami, salas.conta_zoro].map((sala) => doDuelo(sala, (m) => m.t === 'duelo.lista', 'a lista vazia')))
    await salas.conta_nami.mandar({ t: 'duelo.convidar', para: 'conta_zoro', fichas: ['pers_nami'] })
    const convite = await doDuelo(salas.conta_zoro, (m) => m.t === 'duelo.convite' || m.t === 'duelo.recusado', 'o convite')
    if (convite.t !== 'duelo.convite') throw new Error(`convite recusado: ${convite.motivo}`)
    await salas.conta_zoro.mandar({ t: 'duelo.aceitar', id: convite.convite.id, fichas: ['pers_zoro'] })
    const inicio = await doDuelo(salas.conta_zoro, (m) => (m.t === 'duelo.estado' && m.duelo.id === convite.convite.id) || m.t === 'duelo.recusado', 'o duelo começar')
    if (inicio.t !== 'duelo.estado') throw new Error(`aceitar recusado: ${inicio.motivo}`)
    const golpes = []
    let duelo = inicio.duelo
    let caiuEVoltou = false
    for (let jogadas = 0; duelo.fim === null; jogadas += 1) {
      if (jogadas >= 40) throw new Error('o duelo não acabou em 40 jogadas')
      duelo = await jogarUmaVez(salas, duelo, golpes)
      // Depois do primeiro golpe resolvido: cai e volta no meio do duelo.
      if (!caiuEVoltou && golpes.length === 1 && duelo.fim === null) {
        duelo = await caiEVolta(campanhaId, salas, duelo)
        caiuEVoltou = true
      }
    }
    const forjadoIgnorado = golpes.length > 0 && golpes.every((g) => g.servidor !== DANO_FORJADO && g.servidor > 0 && g.antes - g.depois === Math.min(g.antes, g.servidor))
    conferir(`dano forjado ignorado em ${golpes.length} golpes (pedido ${DANO_FORJADO}; aplicado o da ficha)`, forjadoIgnorado, JSON.stringify(golpes))
    const [primeiro] = golpes
    if (primeiro !== undefined) console.log(`        1º golpe: pedido ${primeiro.pedido}, o servidor aplicou ${primeiro.servidor} (vida ${primeiro.antes} -> ${primeiro.depois})`)
    const vencedor = duelo.fim.tipo === 'vitoria' ? `Lado ${duelo.fim.vencedor.toUpperCase()} (${duelo.jogadores[duelo.fim.vencedor].nome})` : JSON.stringify(duelo.fim)
    console.log(`        vencedor: ${vencedor}, na rodada ${duelo.turnos.rodada}, seq ${duelo.seq}`)
    conferir('o duelo acaba com vencedor (não por tempo): a Nami', duelo.fim.tipo === 'vitoria' && duelo.fim.vencedor === 'a', JSON.stringify(duelo.fim))
  } finally {
    salas.conta_nami.fechar()
    salas.conta_zoro.fechar()
  }
  console.log(falhas === 0 ? `DUELO OK (campanha ${campanhaId})` : `${falhas} FALHA(S)`)
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
  } else if (modo === 'midia') {
    await aceiteDaMidia()
  } else if (modo === 'chat') {
    await aceiteDoChat()
  } else if (modo === 'mural') {
    await aceiteDoMural()
  } else if (modo === 'duelo') {
    await aceiteDoDuelo()
  } else {
    await aceite()
  }
} catch (erro) {
  falhas += 1
  console.log(`FALHOU  ${erro instanceof Error ? erro.message : String(erro)}`)
}
process.exit(falhas === 0 ? 0 : 1)
