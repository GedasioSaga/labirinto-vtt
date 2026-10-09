'use strict'
/**
 * PUBLICAR O PACOTE DE ANIMAÇÕES (sem instalador novo).
 *
 *   node scripts/pacote-animacoes.cjs              compila, monta o índice, assina e confere (nada sai do PC)
 *   node scripts/pacote-animacoes.cjs --publicar   idem + envia para a release "animacoes" do GitHub
 *
 * Opções de teste (recusadas com --publicar):
 *   --fontes <pasta>        lê as fontes de outra pasta (padrão: client/src/animacoes)
 *   --motor-minimo <x.y.z>  troca o motorMinimo (o app de dev é mais velho que o mínimo de publicação)
 *   --versao <n>            troca a versão do índice (em vez da publicada + 1)
 *
 * Fontes: client/src/animacoes/<tipo>/<id>.ts, com <id>.json ao lado (nome e
 * durações); tipo = transicao | porta | cenario. Cada uma vira um módulo ES
 * autocontido (Vite em modo lib), cujo `export default` é a função do tipo.
 * O contrato está no README de cada pasta.
 *
 * O app instalado só aceita o pacote se o `indice.json` vier assinado pela
 * MESMA chave do atualizador (%USERPROFILE%\.tauri\labirinto.key, sem senha),
 * e cada módulo só vale com o sha256 e o tamanho que o índice assinado diz.
 * O caminho da chave entra só no ambiente do processo que assina; a chave
 * nunca é lida nem impressa aqui.
 */
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { assinaturaConfere } = require('./publicar-versao.cjs')

const RAIZ = path.resolve(__dirname, '..')
const CLIENT = path.join(RAIZ, 'client')
const FONTES_PADRAO = path.join(CLIENT, 'src', 'animacoes')
const SAIDA = path.join(CLIENT, 'dist-animacoes')
const CONF = path.join(RAIZ, 'desktop', 'src-tauri', 'tauri.conf.json')
const CHAVE = path.join(os.homedir(), '.tauri', 'labirinto.key')
const REPO_GITHUB = 'GedasioSaga/labirinto-vtt'
const RELEASE = 'animacoes'
const URL_DO_INDICE_PUBLICADO = `https://github.com/${REPO_GITHUB}/releases/download/${RELEASE}/indice.json`

/** O primeiro app que entende o pacote (o lado TS da Fase B nasceu na 0.4.21). */
const MOTOR_MINIMO_PISO = '0.4.21'
const FORMATO = 1

// Os mesmos tetos e formas do app (lib/pacoteDeAnimacoes.ts e o Rust em
// desktop/src-tauri/src/net/animacoes.rs): o que passa aqui, passa lá.
const ID = /^[a-z0-9-]{1,40}$/
const NOME_MAX = 60
const TETO_ARQUIVO = 2 * 1024 * 1024
const TETO_TOTAL = 20 * 1024 * 1024
const TRANSICAO_DURACAO = [2, 30]
const CENARIO_DURACAO = [3, 40]
const PORTA_DURACAO_MAX_MS = 3000
/** Ids embutidos no app (transicoes/catalogo.ts, portas/animacoesDePorta.ts, cenario/estilosDeCenario.ts): a embutida ganha. */
const EMBUTIDAS = {
  transicao: ['porta', 'escada-pedra', 'escada-pedra-descendo'],
  porta: ['girar', 'deslizar'],
  cenario: ['panoramica'],
}
const TIPOS = Object.keys(EMBUTIDAS)

function falhar(mensagem) {
  console.error(`\n[pacote-animacoes] ERRO: ${mensagem}`)
  process.exit(1)
}

function log(mensagem) {
  console.log(`[pacote-animacoes] ${mensagem}`)
}

function lerArgumentos(argv) {
  const args = { publicar: false, fontes: FONTES_PADRAO, motorMinimo: null, versao: null }
  const valor = (i, nome) => argv[i] ?? falhar(`${nome} pede um valor`)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--publicar') args.publicar = true
    else if (argv[i] === '--fontes') args.fontes = path.resolve(valor(++i, '--fontes'))
    else if (argv[i] === '--motor-minimo') args.motorMinimo = valor(++i, '--motor-minimo')
    else if (argv[i] === '--versao') args.versao = Number(valor(++i, '--versao'))
    else falhar(`argumento desconhecido: ${argv[i]}`)
  }
  if (args.publicar && (args.fontes !== FONTES_PADRAO || args.motorMinimo !== null || args.versao !== null)) {
    falhar('--fontes, --motor-minimo e --versao são só para teste: não valem com --publicar')
  }
  if (args.motorMinimo !== null && lerVersao(args.motorMinimo) === null) falhar(`--motor-minimo estranho: ${args.motorMinimo}`)
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

function numero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** Confere a meta de uma fonte e devolve a entrada do índice (sem o arquivo). */
function entradaDaMeta(tipo, id, meta, onde) {
  const erro = (campo) => falhar(`${onde}: ${campo}`)
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) erro('a meta tem de ser um objeto JSON')
  const nome = typeof meta.nome === 'string' ? meta.nome.trim() : ''
  if (nome === '' || nome.length > NOME_MAX) erro(`"nome" de 1 a ${NOME_MAX} letras`)
  if (tipo === 'porta') {
    if (!numero(meta.duracaoMs) || meta.duracaoMs <= 0 || meta.duracaoMs > PORTA_DURACAO_MAX_MS) erro(`"duracaoMs" entre 1 e ${PORTA_DURACAO_MAX_MS}`)
    return { id, tipo, nome, duracaoMs: meta.duracaoMs }
  }
  const [min, max] = tipo === 'transicao' ? TRANSICAO_DURACAO : CENARIO_DURACAO
  if (!numero(meta.duracaoNaturalS) || meta.duracaoNaturalS < min || meta.duracaoNaturalS > max) erro(`"duracaoNaturalS" entre ${min} e ${max}`)
  const quadro = meta.quadroDaMiniaturaS
  const quadroValido = numero(quadro) && quadro >= 0 && quadro <= meta.duracaoNaturalS
  if (tipo === 'transicao' && !quadroValido) erro('"quadroDaMiniaturaS" entre 0 e a duração natural')
  if (tipo === 'cenario' && quadro !== undefined && !quadroValido) erro('"quadroDaMiniaturaS" (opcional) entre 0 e a duração natural')
  const entrada = { id, tipo, nome, duracaoNaturalS: meta.duracaoNaturalS }
  if (quadro !== undefined) entrada.quadroDaMiniaturaS = quadro
  return entrada
}

/** As fontes da pasta: <tipo>/<id>.ts + <id>.json. README e afins são ignorados. */
function acharFontes(pasta) {
  if (!fs.existsSync(pasta)) falhar(`pasta de fontes não existe: ${pasta}`)
  const fontes = []
  for (const tipo of TIPOS) {
    const dir = path.join(pasta, tipo)
    if (!fs.existsSync(dir)) continue
    for (const nome of fs.readdirSync(dir).sort()) {
      if (!nome.endsWith('.ts')) continue
      const id = nome.slice(0, -3)
      const onde = `${tipo}/${nome}`
      if (!ID.test(id)) falhar(`${onde}: o nome do arquivo é o id (a-z, 0-9 e "-", até 40)`)
      if (EMBUTIDAS[tipo].includes(id)) falhar(`${onde}: "${id}" é de uma animação embutida no app`)
      const metaArquivo = path.join(dir, `${id}.json`)
      if (!fs.existsSync(metaArquivo)) falhar(`${onde}: falta ${id}.json ao lado (nome e durações)`)
      let meta
      try {
        meta = JSON.parse(fs.readFileSync(metaArquivo, 'utf8'))
      } catch (erro) {
        falhar(`${tipo}/${id}.json não é JSON: ${erro.message}`)
      }
      fontes.push({ tipo, id, fonte: path.join(dir, nome), entrada: entradaDaMeta(tipo, id, meta, `${tipo}/${id}.json`) })
    }
  }
  return fontes
}

/**
 * Compila UMA fonte num módulo ES autocontido. `three` fica de fora do
 * bundle (externo) só para poder ser DETECTADO: a cena recebe o `three` por
 * parâmetro e só pode usá-lo como tipo. Qualquer import que sobre falha.
 */
async function compilar(vite, { tipo, id, fonte }) {
  const resultado = await vite.build({
    configFile: false,
    root: CLIENT,
    logLevel: 'warn',
    publicDir: false,
    mode: 'production',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      target: 'es2022',
      minify: 'esbuild',
      sourcemap: false,
      copyPublicDir: false,
      reportCompressedSize: false,
      lib: { entry: fonte, formats: ['es'], fileName: () => `${tipo}-${id}.js` },
      rollupOptions: { external: (fonteImportada) => fonteImportada === 'three' || fonteImportada.startsWith('three/') },
    },
  })
  const saidas = (Array.isArray(resultado) ? resultado : [resultado]).flatMap((s) => s.output)
  const onde = `${tipo}/${id}.ts`
  const chunks = saidas.filter((s) => s.type === 'chunk')
  const assets = saidas.filter((s) => s.type === 'asset')
  if (chunks.length !== 1 || assets.length > 0) {
    falhar(`${onde}: virou ${chunks.length} pedaços de código e ${assets.length} arquivos (CSS, imagem). O módulo tem de ser UM arquivo .js: nada de import() dinâmico, CSS ou asset.`)
  }
  const [chunk] = chunks
  const importados = [...chunk.imports, ...chunk.dynamicImports]
  if (importados.some((i) => i === 'three' || i.startsWith('three/'))) {
    falhar(`${onde}: importa "three" em tempo de execução. A cena recebe o three por parâmetro; use só "import type" do three.`)
  }
  if (importados.length > 0) falhar(`${onde}: o módulo ainda importa ${importados.join(', ')}; tem de ser autocontido.`)
  if (!chunk.exports.includes('default')) falhar(`${onde}: sem "export default" (a função do tipo ${tipo}).`)
  const bytes = Buffer.from(chunk.code, 'utf8')
  if (bytes.length > TETO_ARQUIVO) falhar(`${onde}: ${bytes.length} bytes, acima do teto de ${TETO_ARQUIVO}`)
  return bytes
}

/** Versão publicada + 1; sem release ou sem índice ainda = 1. Rede ruim aborta: chutar daria versão repetida. */
async function proximaVersao() {
  let resposta
  try {
    resposta = await fetch(URL_DO_INDICE_PUBLICADO, { redirect: 'follow' })
  } catch (erro) {
    falhar(`não deu para ler o índice publicado (${erro.message}); sem ele não dá para saber a próxima versão`)
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

function publicar(modulos, indice, sig) {
  if (!releaseExiste()) {
    log(`criando a release "${RELEASE}" como PRÉ-LANÇAMENTO (não vira a "latest" do atualizador)`)
    rodar('gh', ['release', 'create', RELEASE, '--repo', REPO_GITHUB, '--prerelease', '--title', 'Pacote de animações', '--notes', 'Animações baixadas pelo app (transições, portas, cenários). Publicado por scripts/pacote-animacoes.cjs.'])
  }
  // Módulos primeiro, índice e assinatura por último: o app nunca vê um índice
  // novo apontando para módulo que ainda não subiu.
  if (modulos.length > 0) rodar('gh', ['release', 'upload', RELEASE, ...modulos, '--clobber', '--repo', REPO_GITHUB])
  rodar('gh', ['release', 'upload', RELEASE, sig, indice, '--clobber', '--repo', REPO_GITHUB])
  log(`publicado em https://github.com/${REPO_GITHUB}/releases/tag/${RELEASE}`)
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2))
  const conf = JSON.parse(fs.readFileSync(CONF, 'utf8'))
  const pubkey = conf.plugins?.updater?.pubkey
  if (lerVersao(conf.version) === null) falhar(`versão estranha em tauri.conf.json: ${conf.version}`)
  if (!pubkey) falhar('tauri.conf.json sem plugins.updater.pubkey')
  if (!fs.existsSync(CHAVE)) falhar(`chave de assinatura não encontrada em ${CHAVE}`)

  const fontes = acharFontes(args.fontes)
  log(`${fontes.length} animação(ões) em ${args.fontes}`)
  fs.rmSync(SAIDA, { recursive: true, force: true })
  fs.mkdirSync(SAIDA, { recursive: true })

  const arquivos = []
  const animacoes = []
  const modulos = []
  let total = 0
  if (fontes.length > 0) {
    const vite = await import('vite')
    for (const fonte of fontes) {
      const nome = `${fonte.tipo}-${fonte.id}.js`
      const bytes = await compilar(vite, fonte)
      total += bytes.length
      const destino = path.join(SAIDA, nome)
      fs.writeFileSync(destino, bytes)
      modulos.push(destino)
      arquivos.push({ nome, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), tamanho: bytes.length })
      animacoes.push({ ...fonte.entrada, arquivo: nome })
      log(`  ${nome} (${bytes.length} bytes)`)
    }
  }
  if (total > TETO_TOTAL) falhar(`pacote com ${total} bytes, acima do teto de ${TETO_TOTAL}`)

  const versao = args.versao ?? (await proximaVersao())
  const motorMinimo = args.motorMinimo ?? maiorVersao(conf.version, MOTOR_MINIMO_PISO)
  const indice = { formato: FORMATO, versao, motorMinimo, arquivos, animacoes }
  const indiceArquivo = path.join(SAIDA, 'indice.json')
  fs.writeFileSync(indiceArquivo, `${JSON.stringify(indice, null, 2)}\n`)
  const sig = assinar(indiceArquivo)
  if (!assinaturaConfere(indiceArquivo, fs.readFileSync(sig, 'utf8').trim(), pubkey)) {
    falhar('a assinatura do indice.json NÃO confere com a pubkey do tauri.conf.json: nenhum app aceitaria este pacote')
  }
  log(`índice versão ${versao}, motorMinimo ${motorMinimo}; assinatura confere com a chave pública do app`)
  log(`saída em ${SAIDA}`)

  if (!args.publicar) {
    log('sem --publicar: nada foi enviado ao GitHub.')
    return
  }
  publicar(modulos, indiceArquivo, sig)
}

main().catch((erro) => falhar(erro && erro.stack ? erro.stack : String(erro)))
