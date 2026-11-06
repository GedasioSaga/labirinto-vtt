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
//      node fumaca.mjs duelo               -> a T6 (Nami e Zoro, contas falsas): convite, aceite (cada conta recebe a
//                                             vista do lado dela, M2); o andar na grade (M1): fora da vez,
//                                             casa ocupada e ficha do outro lado = recusa, a ficha da vez anda
//                                             e as duas contas veem a casa nova, sem o que só o outro lado vê;
//                                             duelo curto até o fim
//                                             com todo Atacar pedindo dano 99999 (o servidor aplica o da ficha);
//                                             no meio, a 2ª aba fecha sem deixar ausente e a única aba fecha e volta
//                                             antes dos 3 min; imprime o vencedor. Depois: Zoro convida de novo,
//                                             desiste no meio e a Nami vence; por último, 20 duelo.* tortos fazem o
//                                             servidor fechar a aba da Nami e o Zoro a vê ausente na hora
//      node fumaca.mjs sala                -> a B2 (sala aberta no app e bilhete): IP público = 400; o app abre a sala e
//                                             recebe a chave; a Nami vê a sala (frame, ola com ops e estado) SEM a chave;
//                                             o bilhete dela confere com a chave; não membro e Service Token = 404,
//                                             mestre pelo site = 403; a batida mantém a chave e troca os endereços;
//                                             o 7º bilhete seguido = 429; fechar manda sala null, bilhete = 409 e
//                                             reabrir sorteia outra chave
// Outro endereço: NUVEM_URL=http://127.0.0.1:9000 node fumaca.mjs
//
// Prova do bundle (nada de Tauri, React, DOM ou Pixi):
//   npx wrangler deploy --dry-run --outdir <pasta> --metafile <pasta>/meta.json
//   e conferir as entradas do meta.json e o texto do index.js (a porta src/dev.ts não entra).
//
// Só fala com a porta de dev local (identidade pela URL, ?eu=&origem=); nunca com a conta real.
// Nomes e e-mails inventados (@example.com).

import { createHash, createHmac, randomBytes } from 'node:crypto'
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

/**
 * O sistema do aceite (F1): um que a leitura do app aceita (tem atributo), com
 * o livro e um catálogo, que o `estado` do jogador NÃO leva.
 */
const SISTEMA_DO_ACEITE = {
  id: 'one-piece',
  nome: 'One Piece',
  atributos: [{ id: 'forca', nome: 'Força', abreviacao: 'FOR' }],
  recursos: [{ id: 'hp', nome: 'Vida', tom: 'vida', atualEMaximo: true }],
  abas: [{ id: 'tecnicas', nome: 'Técnicas' }],
  livro: [{ id: 'cap_regras', titulo: 'Regras', ordem: 1, texto: 'O livro fica no app.' }],
  catalogos: { pericias: [], vantagens: [{ nome: 'Sorte', descricao: 'Do livro.' }], desvantagens: [], racas: [], oficios: [] },
}

function pedidoDePublicar(fichas) {
  return {
    v: VERSAO,
    clienteId: 'cli_app',
    nome: 'Fumaça One Piece',
    nomeDoMestre: 'Mestre',
    sistema: SISTEMA_DO_ACEITE,
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
  const sistema = estado.sistema
  conferir(
    'estado da Nami leva o sistema publicado (F1), sem o livro e sem os catálogos',
    sistema?.id === SISTEMA_DO_ACEITE.id && sistema.recursos?.[0]?.nome === 'Vida' && sistema.atributos?.[0]?.id === 'forca' && !('livro' in sistema) && !('catalogos' in sistema),
    JSON.stringify(sistema),
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

/**
 * O sistema e o livro do site (revisão da F1), num socket da Nami só deste passo (os de antes não ganham frame a mais):
 * o `estado` leva o resumo do livro e a marca; o `livro.pedir` devolve o livro em partes (e recusa outro sistema);
 * o mestre republica trocando Vida por Fôlego com o canal dela fechado (fichas iguais) e a volta com a marca velha
 * recebe o `estado` com o sistema novo, não uma página de ops; com a marca nova, ops.
 */
async function livroEMarcaDoSistema(campanhaId) {
  const antes = await Sala.abrir(campanhaId, NAMI)
  await antes.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami_livro', marcaDoSistema: null })
  const estado = await antes.esperar((m) => m.t === 'estado', 'o estado com o livro')
  const marcaVelha = estado.marcaDoSistema
  conferir(
    'estado leva o resumo do livro (1 capítulo, o catálogo de vantagens) e a marca do sistema',
    estado.livro?.capitulos === 1 && estado.livro?.catalogos?.includes('vantagens') && typeof marcaVelha === 'string' && marcaVelha.length > 0,
    JSON.stringify({ livro: estado.livro, marca: marcaVelha }),
  )
  await antes.mandar({ t: 'livro.pedir', reqId: 'req_livro', sistemaId: SISTEMA_DO_ACEITE.id })
  const primeira = await antes.esperar((m) => m.t === 'livro.parte' && m.reqId === 'req_livro', 'a 1ª parte do livro')
  const partes = [primeira]
  while (partes.length < primeira.total) partes.push(await antes.esperar((m) => m.t === 'livro.parte' && m.reqId === 'req_livro', 'mais uma parte do livro'))
  const pacote = JSON.parse(partes.sort((a, b) => a.indice - b.indice).map((p) => p.texto).join(''))
  conferir(
    'livro.pedir devolve o livro e os catálogos em partes, do sistema pedido',
    pacote.sistemaId === SISTEMA_DO_ACEITE.id && pacote.livro?.[0]?.id === 'cap_regras' && pacote.catalogos?.vantagens?.[0]?.nome === 'Sorte',
    JSON.stringify(pacote),
  )
  await antes.mandar({ t: 'livro.pedir', reqId: 'req_outro', sistemaId: 'dragon-ball' })
  const recusa = await antes.esperar((m) => m.t?.startsWith('livro.') && m.reqId === 'req_outro', 'a resposta do livro de outro sistema')
  conferir('livro.pedir de outro sistema = livro.recusa', recusa.t === 'livro.recusa', JSON.stringify(recusa))
  antes.fechar()
  const recursoNovo = { ...SISTEMA_DO_ACEITE.recursos[0], nome: 'Fôlego' }
  const republicar = { ...pedidoDePublicar([ficha('pers_nami', 'conta_nami'), ficha('pers_zoro', 'conta_zoro')]), sistema: { ...SISTEMA_DO_ACEITE, recursos: [recursoNovo] } }
  const publicado = await doApp('POST', `/api/c/${campanhaId}/publicar`, republicar)
  conferir('republicar só trocando o nome do recurso = ok', publicado.status === 200, JSON.stringify(publicado.corpo))
  const revDeAgora = publicado.corpo.rev
  const volta = await Sala.abrir(campanhaId, NAMI)
  try {
    await volta.mandar({ t: 'ola', desdeRev: revDeAgora, v: VERSAO, clienteId: 'cli_nami_livro', marcaDoSistema: marcaVelha })
    const naVolta = await volta.esperar((m) => m.t === 'estado' || m.t === 'ops', 'a resposta do ola da volta')
    conferir(
      'volta em dia com a marca velha = estado com o sistema novo (Fôlego) e outra marca, não ops',
      naVolta.t === 'estado' && naVolta.sistema?.recursos?.[0]?.nome === 'Fôlego' && typeof naVolta.marcaDoSistema === 'string' && naVolta.marcaDoSistema !== marcaVelha,
      JSON.stringify({ t: naVolta.t, recursos: naVolta.sistema?.recursos, marca: naVolta.marcaDoSistema }),
    )
    await volta.mandar({ t: 'ola', desdeRev: naVolta.rev, v: VERSAO, clienteId: 'cli_nami_livro', marcaDoSistema: naVolta.marcaDoSistema })
    const emDia = await volta.esperar((m) => m.t === 'estado' || m.t === 'ops', 'a resposta do ola com a marca nova')
    conferir('volta em dia com a marca de agora = ops (página vazia), sem estado', emDia.t === 'ops' && emDia.lista.length === 0, JSON.stringify({ t: emDia.t }))
  } finally {
    volta.fechar()
  }
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
    await livroEMarcaDoSistema(campanhaId)
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

/**
 * `de` convida `para` (conta `contaPara`), cada um com uma ficha, e `para` aceita: o duelo começado.
 * As filas das duas salas são limpas antes (o convite de um duelo velho não pode passar por este).
 */
async function comecarDuelo(de, para, contaPara, fichaDe, fichaPara) {
  de.recebidas.length = 0
  para.recebidas.length = 0
  await de.mandar({ t: 'duelo.convidar', para: contaPara, fichas: [fichaDe] })
  const enviado = await doDuelo(de, (m) => m.t === 'duelo.convite' || m.t === 'duelo.recusado', 'o convite enviado')
  if (enviado.t !== 'duelo.convite') throw new Error(`convite recusado: ${enviado.motivo}`)
  const { id } = enviado.convite
  await doDuelo(para, (m) => m.t === 'duelo.convite' && m.convite.id === id, 'o convite')
  await para.mandar({ t: 'duelo.aceitar', id, fichas: [fichaPara] })
  const inicio = await doDuelo(para, (m) => (m.t === 'duelo.estado' && m.duelo.id === id) || (m.t === 'duelo.recusado' && m.id === id), 'o duelo começar')
  if (inicio.t !== 'duelo.estado') throw new Error(`aceitar recusado: ${inicio.motivo}`)
  return inicio.duelo
}

/**
 * Fatia M2: cada conta recebe a vista do lado DELA (o recorte do HUD da Arena). No começo, só a
 * conta da vez tem `minhaVez` e as ações; a ficha dela é "eu" na vista dela e "outro" na do outro lado.
 */
async function vistasDoComeco(salas, duelo) {
  const daNami = await doDuelo(salas.conta_nami, (m) => m.t === 'duelo.estado' && m.duelo.id === duelo.id && m.duelo.seq === duelo.seq, 'o começo do duelo na Nami')
  const vistas = { a: daNami.duelo.vista, b: duelo.vista }
  const carta = duelo.turnos.cartas.find((candidata) => candidata.id === duelo.turnos.vez)
  const ladoDaVez = carta === undefined ? null : vagaDoToken(duelo, carta.tokenId).lado
  const tokenDo = (lado) => duelo.lutadores.vagas.find((vaga) => vaga.lado === lado).tokenId
  const ladoNaVista = (vista, tokenId) => vista?.cartas.find((candidata) => candidata.tokenId === tokenId)?.lado
  const certo = ['a', 'b'].every((lado) => {
    const outro = lado === 'a' ? 'b' : 'a'
    const vista = vistas[lado]
    return vista !== undefined && vista.minhaVez === (lado === ladoDaVez) && (vista.acoes !== undefined) === (lado === ladoDaVez) && ladoNaVista(vista, tokenDo(lado)) === 'eu' && ladoNaVista(vista, tokenDo(outro)) === 'outro'
  })
  console.log(`        duelo.estado do começo: ${Buffer.byteLength(JSON.stringify(daNami))} bytes para a Nami, vez do Lado ${String(ladoDaVez).toUpperCase()}`)
  conferir(
    'cada conta recebe a vista do lado dela: a vez e as ações só na conta da vez; a ficha dela é "eu" nela e "outro" na outra (M2)',
    certo,
    JSON.stringify({ ladoDaVez, a: vistas.a && { minhaVez: vistas.a.minhaVez, cartas: vistas.a.cartas }, b: vistas.b && { minhaVez: vistas.b.minhaVez, cartas: vistas.b.cartas } }),
  )
  // O resto do frame também é do lado (o fio recortado): combate, contra-ataques e lembretes só das fichas dele.
  // As fichas não: a ficha é pública no duelo (Vida e Escudo de todas), inteira e igual nos dois frames.
  const frames = { a: daNami.duelo, b: duelo }
  const fichasIguais = JSON.stringify(frames.a.lutadores.personagens) === JSON.stringify(frames.b.lutadores.personagens)
  const recorte = (lado) => {
    const { turnos, lutadores } = frames[lado]
    const doLado = lutadores.vagas.filter((vaga) => vaga.lado === lado)
    const minhas = new Set(doLado.map((vaga) => vaga.personagemId))
    const meusTokens = new Set(doLado.map((vaga) => vaga.tokenId))
    return {
      combate: Object.keys(turnos.combate ?? {}).every((id) => minhas.has(id)),
      contras: (turnos.contras ?? []).every((contra) => meusTokens.has(contra.tokenId)),
      lembretes: (turnos.lembretesDaMarca ?? []).every((lembrete) => meusTokens.has(lembrete.tokenId)),
      fichasInteiras: fichasIguais && lutadores.vagas.every((vaga) => lutadores.personagens.some((ficha) => ficha.id === vaga.personagemId)),
    }
  }
  const recortes = { a: recorte('a'), b: recorte('b') }
  conferir('o fio de cada conta vem recortado para o lado dela: combate, contra-ataques e lembretes só das fichas dela; as fichas (Vida e Escudo) inteiras e iguais nos dois (M2)', Object.values(recortes).every((r) => Object.values(r).every(Boolean)), JSON.stringify(recortes))
}

// ── O andar na grade (M1) pelo DO de verdade ────────────────────────────────

/** A grade do duelo (`GRADE_DO_TREINO` em mesaEmMemoria.ts): a pequena da Arena. */
const GRADE_DO_DUELO = { colunas: 12, linhas: 8 }

/** A carta da vez: o lado, o token e a `vez` que o andar leva (como o agir). */
function cartaDaVezNoDuelo(duelo) {
  const carta = duelo.turnos.cartas.find((candidata) => candidata.id === duelo.turnos.vez)
  if (carta === undefined) throw new Error('duelo sem vez')
  return { lado: vagaDoToken(duelo, carta.tokenId).lado, cartaId: carta.id, tokenId: carta.tokenId, vez: { cartaId: carta.id, rodada: duelo.turnos.rodada } }
}

/** Uma casa vizinha de `tokenId`, dentro da grade e sem ficha (o passo de 1 bloco). */
function casaLivreAoLado(duelo, tokenId) {
  const { col, row } = duelo.posicoes[tokenId]
  const ocupadas = new Set(Object.values(duelo.posicoes).map((casa) => `${casa.col},${casa.row}`))
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const casa = { col: col + dc, row: row + dr }
    const naGrade = casa.col >= 0 && casa.row >= 0 && casa.col < GRADE_DO_DUELO.colunas && casa.row < GRADE_DO_DUELO.linhas
    if (naGrade && !ocupadas.has(`${casa.col},${casa.row}`)) return casa
  }
  throw new Error(`nenhuma casa livre ao lado de ${tokenId}`)
}

/** Manda um andar sobre o `seq` de `duelo` e devolve o motivo da recusa, ou "aceito" se o estado andou. */
async function motivoDoAndar(sala, duelo, andar) {
  await sala.mandar({ t: 'duelo.jogar', id: duelo.id, jogada: { tipo: 'andar', seq: duelo.seq, ...andar } })
  const resposta = await doDuelo(sala, (m) => (m.t === 'duelo.recusado' && m.id === duelo.id) || (m.t === 'duelo.estado' && m.duelo.id === duelo.id && m.duelo.seq > duelo.seq), `a resposta do andar de ${sala.email}`)
  return resposta.t === 'duelo.recusado' ? resposta.motivo : `aceito (seq ${resposta.duelo.seq})`
}

/**
 * O que, no frame de um lado, só o OUTRO lado pode ver: a vez e as ações dele; o combate (`meus`), os
 * contra-ataques, as reações e os lembretes das fichas dele; e a carta dele aberta (perfil, Escudo, caiu).
 * Vazio = nada vazou.
 */
function vazamentosDoOutroLado(frame, lado, ladoDaVez) {
  const doLado = frame.lutadores.vagas.filter((vaga) => vaga.lado === lado)
  const meusTokens = new Set(doLado.map((vaga) => vaga.tokenId))
  const minhasFichas = new Set(doLado.map((vaga) => vaga.personagemId))
  const { vista, turnos } = frame
  const achados = []
  if (vista.minhaVez !== (lado === ladoDaVez)) achados.push(`vista.minhaVez ${vista.minhaVez}`)
  if (lado !== ladoDaVez && vista.acoes !== undefined) achados.push('vista.acoes da vez do outro')
  for (const id of Object.keys(turnos.combate ?? {})) if (!minhasFichas.has(id)) achados.push(`turnos.combate ${id}`)
  for (const contra of turnos.contras ?? []) if (!meusTokens.has(contra.tokenId)) achados.push(`turnos.contras ${contra.tokenId}`)
  for (const lembrete of turnos.lembretesDaMarca ?? []) if (!meusTokens.has(lembrete.tokenId)) achados.push(`turnos.lembretesDaMarca ${lembrete.tokenId}`)
  for (const meu of vista.meus ?? []) if (!minhasFichas.has(meu.personagemId)) achados.push(`vista.meus ${meu.personagemId}`)
  for (const reacao of vista.reacoes ?? []) if (!meusTokens.has(reacao.tokenId)) achados.push(`vista.reacoes ${reacao.tokenId}`)
  for (const contra of vista.contras ?? []) if (!meusTokens.has(contra.tokenId)) achados.push(`vista.contras ${contra.tokenId}`)
  for (const carta of vista.cartas) {
    const aberta = carta.lado !== 'outro' || 'personagemId' in carta || 'escudo' in carta || 'caiu' in carta
    if (!meusTokens.has(carta.tokenId) && aberta) achados.push(`vista.cartas ${carta.tokenId} (${carta.lado})`)
  }
  return achados
}

/**
 * Fatia M1 contra o DO: antes de qualquer golpe, as três recusas (fora da vez, casa ocupada, ficha do
 * outro lado) sobre o mesmo `seq`, depois o andar da ficha da vez para a casa vizinha livre. Se uma
 * recusa tivesse sido aplicada, o andar certo chegaria com `seq` velho e seria recusado.
 */
async function andarNaGrade(salas, duelo) {
  const daVez = cartaDaVezNoDuelo(duelo)
  const outroLado = daVez.lado === 'a' ? 'b' : 'a'
  const salaDaVez = salas[duelo.jogadores[daVez.lado].contaId]
  const salaDoOutro = salas[duelo.jogadores[outroLado].contaId]
  const vagaDoOutro = duelo.lutadores.vagas.find((vaga) => vaga.lado === outroLado)
  const casaDoOutro = duelo.posicoes[vagaDoOutro.tokenId]
  const livreDoOutro = casaLivreAoLado(duelo, vagaDoOutro.tokenId)
  console.log(`        andar: vez do Lado ${daVez.lado.toUpperCase()} (${daVez.tokenId} em ${JSON.stringify(duelo.posicoes[daVez.tokenId])}); ${vagaDoOutro.tokenId} em ${JSON.stringify(casaDoOutro)}`)

  const foraDaVez = await motivoDoAndar(salaDoOutro, duelo, { vez: daVez.vez, tokenId: vagaDoOutro.tokenId, ...livreDoOutro })
  console.log(`        (b) Lado ${outroLado.toUpperCase()} anda a própria ficha fora da vez para ${JSON.stringify(livreDoOutro)}: ${foraDaVez}`)
  conferir('andar fora da vez = recusado (regra)', foraDaVez === 'regra', foraDaVez)

  const ocupada = await motivoDoAndar(salaDaVez, duelo, { vez: daVez.vez, tokenId: daVez.tokenId, ...casaDoOutro })
  console.log(`        (c) a ficha da vez anda para a casa ocupada ${JSON.stringify(casaDoOutro)}: ${ocupada}`)
  conferir('andar para casa ocupada = recusado (regra)', ocupada === 'regra', ocupada)

  const fichaDoOutro = await motivoDoAndar(salaDaVez, duelo, { vez: daVez.vez, tokenId: vagaDoOutro.tokenId, ...livreDoOutro })
  console.log(`        (d) o Lado ${daVez.lado.toUpperCase()} anda a ficha do outro lado para ${JSON.stringify(livreDoOutro)}: ${fichaDoOutro}`)
  conferir('andar com a ficha do outro lado = recusado (naoEDaConta)', fichaDoOutro === 'naoEDaConta', fichaDoOutro)

  const destino = casaLivreAoLado(duelo, daVez.tokenId)
  const depois = (sala) => doDuelo(sala, (m) => (m.t === 'duelo.estado' && m.duelo.id === duelo.id && m.duelo.seq === duelo.seq + 1) || (m.t === 'duelo.recusado' && m.id === duelo.id), `o estado depois do andar em ${sala.email}`)
  const chegaram = Promise.all([depois(salaDaVez), depois(salaDoOutro)])
  await salaDaVez.mandar({ t: 'duelo.jogar', id: duelo.id, jogada: { tipo: 'andar', seq: duelo.seq, vez: daVez.vez, tokenId: daVez.tokenId, ...destino } })
  const [naVez, noOutro] = await chegaram
  if (naVez.t !== 'duelo.estado') throw new Error(`andar recusado: ${naVez.motivo}`)
  const frames = { [daVez.lado]: naVez.duelo, [outroLado]: noOutro.duelo }
  const naCasa = (frame, tokenId, casa) => frame?.posicoes?.[tokenId]?.col === casa.col && frame.posicoes[tokenId].row === casa.row
  const andouNasDuas = [naVez, noOutro].every((resposta) => resposta.t === 'duelo.estado' && naCasa(resposta.duelo, daVez.tokenId, destino) && naCasa(resposta.duelo, vagaDoOutro.tokenId, casaDoOutro))
  const mov = naVez.duelo.turnos.gastos?.[daVez.cartaId]?.blocos
  console.log(`        (a) a ficha da vez anda para ${JSON.stringify(destino)}: seq ${naVez.duelo.seq} nas duas contas, MOV da vez ${mov} bloco(s)`)
  conferir(
    'a ficha da vez anda para a casa livre: as duas contas recebem o estado com a posição nova (e a do outro igual)',
    andouNasDuas,
    JSON.stringify({ naVez: naVez.t === 'duelo.estado' ? naVez.duelo.posicoes : naVez, noOutro: noOutro.t === 'duelo.estado' ? noOutro.duelo.posicoes : noOutro }),
  )

  const vazouEmA = vazamentosDoOutroLado(frames.a, 'a', daVez.lado)
  const vazouEmB = vazamentosDoOutroLado(frames.b, 'b', daVez.lado)
  // Controle: o que falta no frame de A existe no de B (o combate da ficha de B), então é recorte, não ausência.
  const fichaDeB = frames.b.lutadores.vagas.find((vaga) => vaga.lado === 'b').personagemId
  const bTemOProprio = (frames.b.vista.meus ?? []).some((meu) => meu.personagemId === fichaDeB)
  console.log(`        (e) depois do andar, só-do-outro no frame de A: ${JSON.stringify(vazouEmA)}; no de B: ${JSON.stringify(vazouEmB)}; B traz o combate da ficha dele: ${bTemOProprio}`)
  conferir('a vista de A não traz o que só B vê (combate, contra-ataques, reações, ações e carta aberta de B), e B traz o dele', vazouEmA.length === 0 && vazouEmB.length === 0 && bTemOProprio, JSON.stringify({ vazouEmA, vazouEmB, bTemOProprio }))
  return naVez.duelo
}

/**
 * Sem tempo por turno (12.15), quem cansou de esperar desiste. Zoro convida (o duelo acabado não o
 * deixou "ocupado"), a Nami aceita e o Zoro desiste no meio: os dois recebem o fim, a Nami vence.
 */
async function desistencia(salas) {
  const { conta_nami: nami, conta_zoro: zoro } = salas
  const duelo = await comecarDuelo(zoro, nami, 'conta_nami', 'pers_zoro', 'pers_nami')
  await zoro.mandar({ t: 'duelo.desistir', id: duelo.id })
  const fimPara = (sala) => doDuelo(sala, (m) => (m.t === 'duelo.estado' && m.duelo.id === duelo.id && m.duelo.fim !== null) || (m.t === 'duelo.recusado' && m.id === duelo.id), 'o fim por desistência')
  const [paraZoro, paraNami] = await Promise.all([fimPara(zoro), fimPara(nami)])
  const fimDe = (resposta) => (resposta.t === 'duelo.estado' ? resposta.duelo.fim : resposta)
  const venceuANami = (resposta) => resposta.t === 'duelo.estado' && resposta.duelo.fim.tipo === 'desistencia' && resposta.duelo.fim.vencedor === 'b'
  console.log(`        desistência: ${JSON.stringify(fimDe(paraNami))} (Lado B = ${paraNami.t === 'duelo.estado' ? paraNami.duelo.jogadores.b.nome : '?'})`)
  conferir('Zoro (Lado A) desiste no meio: os dois recebem o fim por desistência com a Nami (Lado B) vencendo', venceuANami(paraZoro) && venceuANami(paraNami), JSON.stringify({ zoro: fimDe(paraZoro), nami: fimDe(paraNami) }))
}

/**
 * Achado da revisão: 20 frames duelo.* tortos fazem o SERVIDOR fechar a única aba da Nami (e
 * bloquear a conta). Ela fica ausente na hora (o Zoro vê), então os 3 minutos dela começam e o
 * duelo não para para sempre. Fica por último: a Nami sai bloqueada por 5 minutos.
 */
async function fechadaPorViolacao(salas) {
  const { conta_nami: nami, conta_zoro: zoro } = salas
  const duelo = await comecarDuelo(nami, zoro, 'conta_zoro', 'pers_nami', 'pers_zoro')
  const fechou = new Promise((pronto) => nami.ws.addEventListener('close', (evento) => pronto(evento.code), { once: true }))
  // 'duelo.jogar' sem a jogada = fora do formato, uma violação cada; 20 = LIMITES.violacoesAteFechar.
  for (let vez = 0; vez < 20; vez += 1) nami.ws.send(JSON.stringify({ t: 'duelo.jogar', id: duelo.id }))
  const codigo = await Promise.race([fechou, esperarMs(ESPERA_MS).then(() => 'não fechou')])
  const ausente = await doDuelo(zoro, (m) => m.t === 'duelo.estado' && m.duelo.id === duelo.id && m.duelo.jogadores.a.ausenteDesde !== null, 'a Nami ausente').catch(() => null)
  conferir(
    '20 duelo.* tortos: o servidor fecha a aba da Nami (1008) e o Zoro a vê ausente na hora (os 3 min dela começam)',
    codigo === 1008 && ausente !== null && ausente.duelo.fim === null,
    JSON.stringify({ codigo, jogadores: ausente?.duelo.jogadores ?? null }),
  )
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
    const golpes = []
    let duelo = await comecarDuelo(salas.conta_nami, salas.conta_zoro, 'conta_zoro', 'pers_nami', 'pers_zoro')
    await vistasDoComeco(salas, duelo)
    duelo = await andarNaGrade(salas, duelo)
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
    await desistencia(salas)
    await fechadaPorViolacao(salas)
  } finally {
    salas.conta_nami.fechar()
    salas.conta_zoro.fechar()
  }
  console.log(falhas === 0 ? `DUELO OK (campanha ${campanhaId})` : `${falhas} FALHA(S)`)
}

// ── Sala aberta no app e bilhete do jogador (B2) ─────────────────────────────

const CODIGO_DA_SALA = 'ABC234'
const LAN = { tipo: 'lan', url: 'http://192.168.0.10:7878/player' }
const TUNEL = { tipo: 'tunel', url: 'https://alfa-beta-gama-delta.trycloudflare.com/player' }
/** Bilhete pedido em seguida: 6 por minuto por conta (salaAberta.ts), o 7º = 429. */
const RAJADA_DO_BILHETE = 6
const VALIDADE_DO_BILHETE_MS = 120_000
const PRAZO_DA_SALA_MS = 10 * 60_000

/** Lê o bilhete como o host faria: confere o HMAC-SHA256 de "v1.<payload>" com a chave e decodifica o payload. */
function lerBilhete(bilhete, chave) {
  const [versao, payloadB64, assinatura] = String(bilhete).split('.')
  const esperada = createHmac('sha256', Buffer.from(chave, 'base64url')).update(`${versao}.${payloadB64}`).digest('base64url')
  let payload = null
  try {
    payload = JSON.parse(Buffer.from(payloadB64 ?? '', 'base64url').toString('utf8'))
  } catch {
    payload = null
  }
  return { confere: versao === 'v1' && assinatura === esperada, payload }
}

const doSite = (metodo, caminho, eu, corpo) => pedir(metodo, caminho, eu, 'site', corpo)
const mesmos = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function salaAbreSemAChave(campanhaId, nami, rev) {
  const rota = `/api/c/${campanhaId}/sala`
  const publica = await doApp('POST', rota, { codigo: CODIGO_DA_SALA, enderecos: [{ tipo: 'lan', url: 'http://8.8.8.8:7878/player' }] })
  conferir('abrir a sala com IP público = 400 (só rede local ou trycloudflare)', publica.status === 400 && publica.corpo.erro === 'fora-do-formato', `${publica.status} ${JSON.stringify(publica.corpo)}`)
  const pelaJogadora = await doSite('POST', rota, NAMI, { codigo: CODIGO_DA_SALA, enderecos: [LAN] })
  conferir('abrir a sala pelo site = 404 (rota só do app)', pelaJogadora.status === 404, String(pelaJogadora.status))
  const aberta = await doApp('POST', rota, { codigo: CODIGO_DA_SALA, enderecos: [LAN, TUNEL] })
  const { chave, agora, expiraEm } = aberta.corpo
  conferir(
    'o app abre a sala: chave de 32 bytes, agora e expiraEm = agora + 10 min',
    aberta.status === 200 && typeof chave === 'string' && Buffer.from(chave, 'base64url').length === 32 && expiraEm - agora === PRAZO_DA_SALA_MS,
    `${aberta.status} ${JSON.stringify({ agora, expiraEm, tamanho: typeof chave === 'string' ? chave.length : null })}`,
  )
  const frame = await nami.esperar((m) => m.t === 'sala', 'o frame sala')
  conferir('a Nami recebe o frame sala com o código e os 2 endereços, sem chave nem prazo', mesmos(frame.sala, { codigo: CODIGO_DA_SALA, enderecos: [LAN, TUNEL] }), JSON.stringify(frame))
  // A volta com ops (desdeRev em dia) não traz `estado`: a sala vem no frame próprio.
  const volta = await Sala.abrir(campanhaId, NAMI)
  await volta.mandar({ t: 'ola', desdeRev: rev, v: VERSAO, clienteId: 'cli_nami_volta' })
  const naVolta = await volta.esperar((m) => m.t === 'sala', 'a sala no ola com ops')
  conferir('o ola com ops (sem estado) também traz a sala', mesmos(naVolta.sala, frame.sala) && !volta.recebidas.some((m) => m.t === 'estado'), JSON.stringify(naVolta))
  volta.fechar()
  const zoro = await Sala.abrir(campanhaId, ZORO)
  await zoro.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_zoro' })
  const estadoDoZoro = await zoro.esperar((m) => m.t === 'estado', 'o estado do Zoro')
  conferir('o estado de quem chega traz a sala', mesmos(estadoDoZoro.sala, frame.sala), JSON.stringify(estadoDoZoro.sala))
  return { chave, expiraEm, zoro, sockets: [nami, volta, zoro] }
}

async function bilheteDaJogadora(campanhaId, chave) {
  const rota = `/api/c/${campanhaId}/bilhete`
  const antes = Date.now()
  const pedido = await doSite('POST', rota, NAMI)
  const { confere, payload } = lerBilhete(pedido.corpo.bilhete, chave)
  conferir(
    'o bilhete da Nami confere com a chave da sala: s = código, c = conta_nami, n = Nami, j de 16 bytes, vale 120 s',
    pedido.status === 200 &&
      confere &&
      payload?.s === CODIGO_DA_SALA &&
      payload.c === 'conta_nami' &&
      payload.n === 'Nami' &&
      /^[A-Za-z0-9_-]{22}$/.test(payload.j) &&
      payload.e === pedido.corpo.validoAte &&
      payload.e - antes >= VALIDADE_DO_BILHETE_MS - 5000 &&
      payload.e - Date.now() <= VALIDADE_DO_BILHETE_MS + 5000,
    `${pedido.status} ${JSON.stringify({ confere, payload, validoAte: pedido.corpo.validoAte })}`,
  )
  conferir('a resposta do bilhete traz a sala, sem a chave', mesmos(pedido.corpo.sala, { codigo: CODIGO_DA_SALA, enderecos: [LAN, TUNEL] }) && !JSON.stringify(pedido.corpo).includes(chave), JSON.stringify(pedido.corpo.sala))
  const estranho = await doSite('POST', rota, 'ninguem@example.com')
  conferir('bilhete de quem não é membro = 404', estranho.status === 404, `${estranho.status} ${JSON.stringify(estranho.corpo)}`)
  const peloApp = await doApp('POST', rota)
  conferir('bilhete pelo Service Token = 404 (rota só do site)', peloApp.status === 404, String(peloApp.status))
  const mestre = await doSite('POST', rota, MESTRE)
  conferir('bilhete do mestre pelo site = 403 (ele entra pelo app)', mestre.status === 403 && mestre.corpo.erro === 'mestre', `${mestre.status} ${JSON.stringify(mestre.corpo)}`)
}

async function batidaERitmo(campanhaId, nami, chave, expiraEm) {
  const batida = await doApp('POST', `/api/c/${campanhaId}/sala`, { codigo: CODIGO_DA_SALA, enderecos: [LAN] })
  conferir('a batida mantém a chave e renova o prazo', batida.status === 200 && batida.corpo.chave === chave && batida.corpo.expiraEm >= expiraEm, `${batida.status} ${batida.corpo.expiraEm - expiraEm}`)
  const frame = await nami.esperar((m) => m.t === 'sala', 'a sala da batida')
  conferir('a batida que troca os endereços manda a sala nova (só a LAN)', mesmos(frame.sala, { codigo: CODIGO_DA_SALA, enderecos: [LAN] }), JSON.stringify(frame))
  // A Nami já pediu 1 bilhete: mais 5 passam e o 7º seguido leva 429.
  const status = []
  for (let vez = 0; vez < RAJADA_DO_BILHETE; vez += 1) status.push((await doSite('POST', `/api/c/${campanhaId}/bilhete`, NAMI)).status)
  conferir('ritmo do bilhete: 6 seguidos passam, o 7º = 429', mesmos(status, [200, 200, 200, 200, 200, 429]), JSON.stringify(status))
}

async function fecharESumir(campanhaId, nami, zoro, chave) {
  const fechada = await doApp('POST', `/api/c/${campanhaId}/sala/fechar`)
  conferir('o app fecha a sala', fechada.status === 200, `${fechada.status} ${JSON.stringify(fechada.corpo)}`)
  const frame = await nami.esperar((m) => m.t === 'sala', 'a sala fechada')
  conferir('fechar: a Nami recebe sala null', frame.sala === null, JSON.stringify(frame))
  const semSala = await doSite('POST', `/api/c/${campanhaId}/bilhete`, ZORO)
  conferir('bilhete com a sala fechada = 409 sem-sala', semSala.status === 409 && semSala.corpo.erro === 'sem-sala', `${semSala.status} ${JSON.stringify(semSala.corpo)}`)
  const depois = await Sala.abrir(campanhaId, ZORO)
  await depois.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_zoro_depois' })
  const estado = await depois.esperar((m) => m.t === 'estado', 'o estado depois de fechar')
  depois.fechar()
  conferir('o estado depois de fechar traz sala null', estado.sala === null, JSON.stringify(estado.sala))
  const vazou = [...nami.todas, ...zoro.todas, ...depois.todas].some((texto) => texto.includes(chave))
  conferir('a chave nunca passou por nenhum socket de jogador', !vazou)
  const reaberta = await doApp('POST', `/api/c/${campanhaId}/sala`, { codigo: CODIGO_DA_SALA, enderecos: [LAN] })
  conferir('reabrir depois de fechar sorteia outra chave', reaberta.status === 200 && typeof reaberta.corpo.chave === 'string' && reaberta.corpo.chave !== chave, String(reaberta.status))
  await doApp('POST', `/api/c/${campanhaId}/sala/fechar`)
}

async function aceiteDaSala() {
  const campanhaId = `fumaca-sala-${Date.now().toString(36)}`
  console.log(`campanha ${campanhaId} em ${BASE}`)
  const publicada = await doApp('POST', `/api/c/${campanhaId}/publicar`, pedidoDePublicar([ficha('pers_nami', 'conta_nami'), ficha('pers_zoro', 'conta_zoro')]))
  if (publicada.status !== 200) throw new Error(`publicar falhou (${publicada.status}): ${JSON.stringify(publicada.corpo)}`)
  const nami = await Sala.abrir(campanhaId, NAMI)
  const abertas = [nami]
  try {
    await nami.mandar({ t: 'ola', desdeRev: null, v: VERSAO, clienteId: 'cli_nami' })
    const estado = await nami.esperar((m) => m.t === 'estado', 'o estado')
    conferir('sem sala aberta, o estado traz sala null', estado.sala === null, JSON.stringify(estado.sala))
    const cedo = await doSite('POST', `/api/c/${campanhaId}/bilhete`, ZORO)
    conferir('bilhete antes de abrir = 409 sem-sala', cedo.status === 409 && cedo.corpo.erro === 'sem-sala', `${cedo.status} ${JSON.stringify(cedo.corpo)}`)
    const { chave, expiraEm, zoro, sockets } = await salaAbreSemAChave(campanhaId, nami, estado.rev)
    abertas.push(...sockets)
    await bilheteDaJogadora(campanhaId, chave)
    await batidaERitmo(campanhaId, nami, chave, expiraEm)
    await fecharESumir(campanhaId, nami, zoro, chave)
  } finally {
    for (const sala of abertas) sala.fechar()
  }
  console.log(falhas === 0 ? `SALA OK (campanha ${campanhaId})` : `${falhas} FALHA(S)`)
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
  } else if (modo === 'sala') {
    await aceiteDaSala()
  } else {
    await aceite()
  }
} catch (erro) {
  falhas += 1
  console.log(`FALHOU  ${erro instanceof Error ? erro.message : String(erro)}`)
}
process.exit(falhas === 0 ? 0 : 1)
