'use strict'
/**
 * PACOTE DE MINIGAMES (jogo Godot baixado na primeira vez, sem pesar no instalador).
 *
 *   node scripts/pacote-minigames.cjs              empacota o Fogo na Floresta, assina e confere (nada sai do PC)
 *   node scripts/pacote-minigames.cjs --publicar   idem + envia para a release "minigames" do GitHub
 *
 * Opções:
 *   --jogo <id>         qual jogo (padrão: fogo; os conhecidos estão em JOGOS)
 *   --motor-minimo <x.y.z>  a versão mais antiga do app que roda este pacote. Sem a opção
 *                       vale a versão do app nesta árvore (o mais seguro: só quem tem o app
 *                       de agora baixa). Com ela, um pacote que só conserta o JOGO chega também
 *                       a quem ainda não atualizou o app. De MOTOR_MINIMO_PISO à versão desta árvore.
 * Opções de teste (recusadas com --publicar):
 *   --build <pasta>     lê o export web de outra pasta (padrão: FOGO_WEB_DIR ou o build do projeto do jogo)
 *   --versao <n>        troca a versão do índice (em vez da publicada + 1)
 *   --saida <pasta>     grava a saída em outra pasta (padrão: client/dist-minigames)
 *
 * O QUE SAI (release fixa "minigames", pré-lançamento, como a "animacoes"):
 *   <jogo>.indice.json              o índice: versão, motorMinimo, entrada e a lista dos arquivos
 *   <jogo>.indice.json.sig          a assinatura do índice, pela MESMA chave do atualizador
 *   <jogo>.v<versao>.<nome>.gz      cada arquivo do export web, em gzip (ex.: fogo.v3.index.wasm.gz)
 *
 * Por que gzip arquivo a arquivo (e não um .zip): o motor tem 38 MB e vira 10 MB
 * em gzip. O mestre baixa e guarda os .gz como vieram, confere o sha256 de cada
 * um contra o índice assinado e serve aos jogadores com `Content-Encoding: gzip`:
 * o navegador descompacta sozinho e ninguém precisa abrir zip no app.
 *
 * O nome servido sai do nome do arquivo: tira o "<jogo>.v<versao>." da frente (a
 * versão é a do índice que o lista) e o ".gz" do fim (`fogo.v3.index.wasm.gz` vira
 * `/minigames/fogo/index.wasm`). A versão no nome é o que deixa publicar com app
 * baixando: a v4 sobe em arquivos novos e o índice v3, ainda publicado, continua
 * apontando para arquivos da v3, inteiros. (Os de versões velhas ficam na release.)
 *
 * O app instalado só aceita o pacote se o índice vier assinado pela chave do
 * atualizador (%USERPROFILE%\.tauri\labirinto.key, sem senha). O caminho da chave
 * entra só no ambiente do processo que assina; a chave nunca é lida nem impressa aqui.
 */
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { assinaturaConfere } = require('./publicar-versao.cjs')

const RAIZ = path.resolve(__dirname, '..')
const SAIDA_PADRAO = path.join(RAIZ, 'client', 'dist-minigames')
const CONF = path.join(RAIZ, 'desktop', 'src-tauri', 'tauri.conf.json')
const CHAVE = path.join(os.homedir(), '.tauri', 'labirinto.key')
const REPO_GITHUB = 'GedasioSaga/labirinto-vtt'
const RELEASE = 'minigames'

/** Os jogos que o app sabe baixar. `build` = a pasta do export web do Godot. */
const JOGOS = {
  fogo: {
    nome: 'Fogo na Floresta',
    build: process.env.FOGO_WEB_DIR ?? path.join(os.homedir(), 'jogos', 'fogo-na-floresta', 'build', 'web'),
  },
}

/** A versão do app em que o pacote nasceu: o motorMinimo nunca fica abaixo dela. */
const MOTOR_MINIMO_PISO = '0.5.37'
const FORMATO = 1
/** A página que o iframe abre (o export do Godot sempre gera `<executável>.html`; o nosso é "index"). */
const ENTRADA = 'index.html'

// Os mesmos tetos que o lado Rust tem de aplicar (ver as pendências do pacote):
// o que passa aqui, passa lá. Tamanhos do arquivo JÁ em gzip.
const TETO_ARQUIVO = 32 * 1024 * 1024
const TETO_TOTAL = 64 * 1024 * 1024
const MAX_ARQUIVOS = 32
const MAX_NOME = 60
/** Só o que um export web do Godot precisa; o resto (`.import` do editor, notas) fica fora. */
const EXTENSOES = ['.html', '.js', '.wasm', '.pck', '.png']
/** Nome servido: trechos de [a-z0-9-] separados por ponto, com uma das extensões. Sem barra, sem "..". */
const NOME_SERVIDO = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:html|js|wasm|pck|png)$/
const ID_DO_JOGO = /^[a-z0-9-]{1,20}$/
/** No Windows, `con.js` abre o dispositivo, não um arquivo. */
const DISPOSITIVO_DO_WINDOWS = /^(?:con|prn|aux|nul|com\d|lpt\d)$/

function falhar(mensagem) {
  console.error(`\n[pacote-minigames] ERRO: ${mensagem}`)
  process.exit(1)
}

function log(mensagem) {
  console.log(`[pacote-minigames] ${mensagem}`)
}

function lerArgumentos(argv) {
  const args = { publicar: false, jogo: 'fogo', build: null, versao: null, saida: SAIDA_PADRAO, motorMinimo: null }
  const valor = (i, nome) => argv[i] ?? falhar(`${nome} pede um valor`)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--publicar') args.publicar = true
    else if (argv[i] === '--jogo') args.jogo = valor(++i, '--jogo')
    else if (argv[i] === '--motor-minimo') args.motorMinimo = valor(++i, '--motor-minimo')
    else if (argv[i] === '--build') args.build = path.resolve(valor(++i, '--build'))
    else if (argv[i] === '--versao') args.versao = Number(valor(++i, '--versao'))
    else if (argv[i] === '--saida') args.saida = path.resolve(valor(++i, '--saida'))
    else falhar(`argumento desconhecido: ${argv[i]}`)
  }
  if (!Object.hasOwn(JOGOS, args.jogo)) falhar(`jogo desconhecido: ${args.jogo} (conhecidos: ${Object.keys(JOGOS).join(', ')})`)
  if (args.publicar && (args.build !== null || args.versao !== null || args.saida !== SAIDA_PADRAO)) {
    falhar('--build, --versao e --saida são só para teste: não valem com --publicar')
  }
  if (args.versao !== null && !(Number.isSafeInteger(args.versao) && args.versao >= 1)) falhar('--versao pede um inteiro >= 1')
  return args
}

/** "x.y.z" só com dígitos, como o Rust (`ler_versao`). */
function lerVersao(texto) {
  const partes = String(texto).split('.')
  if (partes.length !== 3 || !partes.every((p) => /^\d+$/.test(p))) return null
  return partes.map(Number)
}

function maiorVersao(a, b) {
  const va = lerVersao(a)
  const vb = lerVersao(b)
  for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return va[i] > vb[i] ? a : b
  return a
}

/**
 * O `motorMinimo` do índice. Sem pedido, a versão do app desta árvore (nunca abaixo do piso).
 * Com `--motor-minimo`, a pedida, desde que fique entre o piso e a versão desta árvore: abaixo
 * do piso o app nem conhecia o pacote; acima da árvore, nenhum app publicado baixaria.
 */
function escolherMotorMinimo(pedido, versaoDoApp, erro) {
  const padrao = maiorVersao(versaoDoApp, MOTOR_MINIMO_PISO)
  if (pedido === null) return padrao
  if (lerVersao(pedido) === null) return erro(`--motor-minimo pede uma versão x.y.z, veio "${pedido}"`)
  if (maiorVersao(pedido, MOTOR_MINIMO_PISO) !== pedido) return erro(`--motor-minimo ${pedido} fica abaixo do piso ${MOTOR_MINIMO_PISO}`)
  if (maiorVersao(pedido, padrao) !== padrao) return erro(`--motor-minimo ${pedido} passa da versão do app desta árvore (${padrao})`)
  return pedido
}

/** O `GODOT_CONFIG` que o export grava no HTML: daí saem o executável e os tamanhos esperados. */
function lerConfigDoGodot(html, erro) {
  const achado = /GODOT_CONFIG\s*=\s*(\{.*?\});/s.exec(html)
  if (achado === null) erro(`${ENTRADA} sem GODOT_CONFIG: não parece um export web do Godot`)
  try {
    return JSON.parse(achado[1])
  } catch (falha) {
    return erro(`GODOT_CONFIG de ${ENTRADA} não é JSON: ${falha.message}`)
  }
}

/**
 * Os arquivos do export web que vão no pacote, conferidos: os essenciais
 * existem, os tamanhos batem com o `fileSizes` do Godot (pega build copiado
 * pela metade) e tudo o que o HTML referencia está junto.
 */
function lerArquivosDoBuild(pasta, erro) {
  if (!fs.existsSync(pasta)) erro(`pasta do build não existe: ${pasta}`)
  const arquivos = []
  const ignorados = []
  for (const nome of fs.readdirSync(pasta).sort()) {
    const caminho = path.join(pasta, nome)
    if (!fs.statSync(caminho).isFile()) continue
    if (!EXTENSOES.includes(path.extname(nome))) {
      ignorados.push(nome)
      continue
    }
    if (!NOME_SERVIDO.test(nome)) erro(`${nome}: nome fora do padrão (a-z, 0-9, "-" e ".", em minúsculas)`)
    if (DISPOSITIVO_DO_WINDOWS.test(nome.split('.')[0])) erro(`${nome}: nome de dispositivo do Windows`)
    arquivos.push({ servido: nome, bytes: fs.readFileSync(caminho) })
  }
  const porNome = new Map(arquivos.map((a) => [a.servido, a]))
  const html = porNome.get(ENTRADA)
  if (html === undefined) erro(`falta ${ENTRADA} em ${pasta}`)
  const config = lerConfigDoGodot(html.bytes.toString('utf8'), erro)
  const executavel = typeof config.executable === 'string' ? config.executable : ''
  if (`${executavel}.html` !== ENTRADA) erro(`o export se chama "${executavel}"; o app abre ${ENTRADA}`)
  for (const essencial of [`${executavel}.js`, `${executavel}.wasm`, `${executavel}.pck`]) {
    if (!porNome.has(essencial)) erro(`falta ${essencial} em ${pasta}`)
  }
  const tamanhos = typeof config.fileSizes === 'object' && config.fileSizes !== null ? config.fileSizes : {}
  for (const [nome, esperado] of Object.entries(tamanhos)) {
    const arquivo = porNome.get(nome)
    if (arquivo === undefined) erro(`GODOT_CONFIG lista ${nome}, que não está na pasta`)
    if (arquivo.bytes.length !== esperado) erro(`${nome} tem ${arquivo.bytes.length} bytes, mas o GODOT_CONFIG diz ${esperado}: build copiado pela metade?`)
  }
  for (const [, referencia] of html.bytes.toString('utf8').matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    if (!/^[a-z]+:/i.test(referencia) && !porNome.has(referencia)) erro(`${ENTRADA} usa ${referencia}, que não está na pasta`)
  }
  if (arquivos.length > MAX_ARQUIVOS) erro(`${arquivos.length} arquivos, acima do teto de ${MAX_ARQUIVOS}`)
  return { arquivos, ignorados }
}

/** Compacta cada arquivo e confere que o gzip volta ao original. */
function compactar(arquivos, erro) {
  let total = 0
  const saida = arquivos.map(({ servido, bytes }) => {
    const gz = zlib.gzipSync(bytes, { level: 9 })
    if (!zlib.gunzipSync(gz).equals(bytes)) erro(`${servido}: o gzip não voltou ao original`)
    if (gz.length > TETO_ARQUIVO) erro(`${servido}: ${gz.length} bytes em gzip, acima do teto de ${TETO_ARQUIVO}`)
    total += gz.length
    return { servido, gz, original: bytes.length, sha256: crypto.createHash('sha256').update(gz).digest('hex') }
  })
  if (total > TETO_TOTAL) erro(`pacote com ${total} bytes, acima do teto de ${TETO_TOTAL}`)
  return saida
}

/** O nome do .gz na release: `fogo.v3.index.wasm.gz`. O Rust tira o `<jogo>.v<versao>.` e o `.gz` para servir. */
function nomeNaRelease(jogo, versao, servido) {
  return `${jogo}.v${versao}.${servido}.gz`
}

/** Dá a cada arquivo compactado o nome da release; a versão só se sabe depois de compactar (pode vir da rede). */
function nomear(jogo, versao, compactados, erro) {
  return compactados.map((compactado) => {
    const nome = nomeNaRelease(jogo, versao, compactado.servido)
    if (nome.length > MAX_NOME) erro(`${nome}: nome com mais de ${MAX_NOME} letras`)
    return { ...compactado, nome }
  })
}

function montarIndice({ jogo, versao, motorMinimo, nomeados }) {
  return {
    formato: FORMATO,
    jogo,
    nome: JOGOS[jogo].nome,
    versao,
    motorMinimo,
    entrada: ENTRADA,
    arquivos: nomeados.map(({ nome, sha256, gz }) => ({ nome, sha256, tamanho: gz.length })),
  }
}

/** Versão publicada + 1; sem release ou sem índice ainda = 1. Rede ruim aborta: chutar daria versão repetida. */
async function proximaVersao(jogo) {
  const url = `https://github.com/${REPO_GITHUB}/releases/download/${RELEASE}/${jogo}.indice.json`
  let resposta
  try {
    resposta = await fetch(url, { redirect: 'follow' })
  } catch (falha) {
    falhar(`não deu para ler o índice publicado (${falha.message}); sem ele não dá para saber a próxima versão (ou passe --versao)`)
  }
  if (resposta.status === 404) return 1
  if (!resposta.ok) falhar(`o GitHub respondeu ${resposta.status} ao índice publicado`)
  let publicado
  try {
    publicado = JSON.parse(await resposta.text())
  } catch {
    falhar('o índice publicado não é JSON')
  }
  if (!Number.isSafeInteger(publicado.versao) || publicado.versao < 1) falhar('o índice publicado não tem "versao" válida')
  return publicado.versao + 1
}

/** Assina com o `tauri signer` (o mesmo formato do atualizador). Só o filho recebe o CAMINHO da chave. */
function assinar(arquivo) {
  const cli = path.join(path.dirname(require.resolve('@tauri-apps/cli/package.json', { paths: [RAIZ] })), 'tauri.js')
  const env = { ...process.env, TAURI_SIGNING_PRIVATE_KEY_PATH: CHAVE, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' }
  delete env.TAURI_SIGNING_PRIVATE_KEY
  // Sem shell e sem entrada: o "-p ''" chega intacto e, se a chave pedisse senha, falha em vez de esperar.
  const r = spawnSync(process.execPath, [cli, 'signer', 'sign', '-p', '', arquivo], { cwd: RAIZ, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.error) falhar(`tauri signer não rodou: ${r.error.message}`)
  if (r.status !== 0) falhar(`tauri signer saiu com código ${r.status}: ${(r.stderr || '').trim().slice(0, 300)}`)
  const sig = `${arquivo}.sig`
  if (!fs.existsSync(sig)) falhar(`assinatura não gerada: ${sig}`)
  return sig
}

function rodar(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: RAIZ, stdio: 'inherit' })
  if (r.error) falhar(`${cmd} não rodou: ${r.error.message}`)
  if (r.status !== 0) falhar(`${cmd} ${args.join(' ')} saiu com código ${r.status}`)
}

function releaseExiste() {
  const r = spawnSync('gh', ['release', 'view', RELEASE, '--repo', REPO_GITHUB], { cwd: RAIZ, encoding: 'utf8' })
  if (r.error) falhar(`gh não rodou: ${r.error.message}`)
  return r.status === 0
}

function publicar(arquivos, indice, sig) {
  if (!releaseExiste()) {
    log(`criando a release "${RELEASE}" como PRÉ-LANÇAMENTO (não vira a "latest" do atualizador)`)
    rodar('gh', ['release', 'create', RELEASE, '--repo', REPO_GITHUB, '--prerelease', '--title', 'Pacote de minigames', '--notes', 'Jogos baixados pelo app na primeira vez que o mestre abre o minigame (Fogo na Floresta). Publicado por scripts/pacote-minigames.cjs.'])
  }
  // Arquivos primeiro: o app nunca vê um índice novo apontando para arquivo que
  // ainda não subiu. E, com a versão no nome, nenhum deles é de um índice já
  // publicado: quem lê o índice velho enquanto estes sobem baixa os arquivos
  // velhos, inteiros. O --clobber só pega a sobra de uma publicação DESTA versão
  // que caiu no meio (nenhum índice publicado aponta para ela).
  rodar('gh', ['release', 'upload', RELEASE, ...arquivos, '--clobber', '--repo', REPO_GITHUB])
  // Índice e assinatura por último, juntos. Ainda sobra um instante (o tempo de
  // subir dois arquivos de 1 KB) em que um app pode ler o índice de uma versão
  // com a .sig da outra, ou não achar o índice (o --clobber apaga antes de
  // subir): por isso o app relê índice e .sig uma vez antes de recusar.
  rodar('gh', ['release', 'upload', RELEASE, sig, indice, '--clobber', '--repo', REPO_GITHUB])
  log(`publicado em https://github.com/${REPO_GITHUB}/releases/tag/${RELEASE}`)
}

function tamanhoLegivel(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2))
  const conf = JSON.parse(fs.readFileSync(CONF, 'utf8'))
  const pubkey = conf.plugins?.updater?.pubkey
  if (lerVersao(conf.version) === null) falhar(`versão estranha em tauri.conf.json: ${conf.version}`)
  if (!pubkey) falhar('tauri.conf.json sem plugins.updater.pubkey')
  if (!fs.existsSync(CHAVE)) falhar(`chave de assinatura não encontrada em ${CHAVE}`)
  if (!ID_DO_JOGO.test(args.jogo)) falhar(`id de jogo fora do padrão: ${args.jogo}`)

  const pasta = args.build ?? JOGOS[args.jogo].build
  const { arquivos, ignorados } = lerArquivosDoBuild(pasta, falhar)
  log(`${JOGOS[args.jogo].nome}: ${arquivos.length} arquivo(s) em ${pasta}`)
  if (ignorados.length > 0) log(`  fora do pacote: ${ignorados.join(', ')}`)
  const compactados = compactar(arquivos, falhar)

  const versao = args.versao ?? (await proximaVersao(args.jogo))
  const nomeados = nomear(args.jogo, versao, compactados, falhar)
  const motorMinimo = escolherMotorMinimo(args.motorMinimo, conf.version, falhar)
  fs.rmSync(args.saida, { recursive: true, force: true })
  fs.mkdirSync(args.saida, { recursive: true })
  const caminhos = []
  for (const { nome, gz, original } of nomeados) {
    const destino = path.join(args.saida, nome)
    fs.writeFileSync(destino, gz)
    caminhos.push(destino)
    log(`  ${nome} (${tamanhoLegivel(original)} -> ${tamanhoLegivel(gz.length)})`)
  }
  const indice = montarIndice({ jogo: args.jogo, versao, motorMinimo, nomeados })
  const indiceArquivo = path.join(args.saida, `${args.jogo}.indice.json`)
  fs.writeFileSync(indiceArquivo, `${JSON.stringify(indice, null, 2)}\n`)
  const sig = assinar(indiceArquivo)
  if (!assinaturaConfere(indiceArquivo, fs.readFileSync(sig, 'utf8').trim(), pubkey)) {
    falhar('a assinatura do índice NÃO confere com a pubkey do tauri.conf.json: nenhum app aceitaria este pacote')
  }
  const total = compactados.reduce((soma, c) => soma + c.gz.length, 0)
  log(`índice versão ${versao}, motorMinimo ${motorMinimo}, ${tamanhoLegivel(total)} para baixar; assinatura confere com a chave pública do app`)
  log(`saída em ${args.saida}`)

  if (!args.publicar) {
    log(`sem --publicar: nada foi enviado ao GitHub. Para publicar: node scripts/pacote-minigames.cjs --jogo ${args.jogo} --publicar`)
    return
  }
  publicar(caminhos, indiceArquivo, sig)
}

// Rodado direto, empacota; carregado por require (o teste), só expõe as peças puras.
if (require.main === module) main().catch((erro) => falhar(erro && erro.stack ? erro.stack : String(erro)))

module.exports = { lerArquivosDoBuild, compactar, nomeNaRelease, nomear, montarIndice, escolherMotorMinimo, MOTOR_MINIMO_PISO, TETO_ARQUIVO, TETO_TOTAL, MAX_ARQUIVOS }
