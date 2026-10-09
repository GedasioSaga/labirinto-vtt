'use strict'
/**
 * PUBLICAR UMA VERSÃO COM ATUALIZAÇÃO AUTOMÁTICA.
 *
 *   node scripts/publicar-versao.cjs                         só builda e gera, para conferir
 *   node scripts/publicar-versao.cjs --publicar --notas N.md  idem + gitleaks + gh release create
 *
 * O app instalado procura em
 *   https://github.com/GedasioSaga/labirinto-vtt/releases/latest/download/latest.json
 * então TODA release daqui em diante precisa levar o `latest.json`; sem ele os
 * apps ficam em silêncio (não quebram, só não atualizam).
 *
 * A chave privada mora fora do repo (%USERPROFILE%\.tauri\labirinto.key, sem
 * senha). Ela só entra no ambiente do processo filho do build, pelo CAMINHO,
 * e nunca é impressa. Perder a chave = nenhum app instalado aceita mais
 * atualização (seria preciso reinstalar à mão): guarde uma cópia de segurança.
 */
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..')
const CONF = path.join(RAIZ, 'desktop', 'src-tauri', 'tauri.conf.json')
const REPO_GITHUB = 'GedasioSaga/labirinto-vtt'
const CHAVE = path.join(os.homedir(), '.tauri', 'labirinto.key')
const GITLEAKS = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'Microsoft',
  'WinGet',
  'Packages',
  'Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe',
  'gitleaks.exe',
)

function falhar(mensagem) {
  console.error(`\n[publicar-versao] ERRO: ${mensagem}`)
  process.exit(1)
}

function lerArgumentos(argv) {
  const args = { publicar: false, notas: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--publicar') args.publicar = true
    else if (argv[i] === '--notas') args.notas = argv[++i] ?? falhar('--notas pede um arquivo')
    else falhar(`argumento desconhecido: ${argv[i]}`)
  }
  return args
}

/** Roda um comando mostrando a saída; aborta se falhar. */
function rodar(cmd, args, opcoes = {}) {
  const r = spawnSync(cmd, args, { cwd: RAIZ, stdio: 'inherit', ...opcoes })
  if (r.error) falhar(`${cmd} não rodou: ${r.error.message}`)
  if (r.status !== 0) falhar(`${cmd} ${args.join(' ')} saiu com código ${r.status}`)
}

function capturar(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: RAIZ, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

/**
 * Confere a assinatura minisign (formato do `tauri signer`) contra a chave
 * pública do tauri.conf.json. Mesma conta que o plugin faz no app: se falhar
 * aqui, nenhum app instalado aceitaria a atualização.
 */
function assinaturaConfere(arquivo, sigBase64, pubkeyBase64) {
  const segundaLinha = (b64) => Buffer.from(b64.trim(), 'base64').toString('utf8').split(/\r?\n/)[1]
  const pub = Buffer.from(segundaLinha(pubkeyBase64), 'base64') // 'Ed' + id(8) + chave(32)
  const sig = Buffer.from(segundaLinha(sigBase64), 'base64') // alg(2) + id(8) + assinatura(64)
  if (pub.length !== 42 || sig.length !== 74 || !sig.subarray(2, 10).equals(pub.subarray(2, 10))) return false
  const dados = fs.readFileSync(arquivo)
  // 'ED' = assinatura do hash BLAKE2b-512 do arquivo (o que o tauri gera).
  const mensagem = sig.subarray(0, 2).toString() === 'ED' ? crypto.createHash('blake2b512').update(dados).digest() : dados
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub.subarray(10)])
  const chave = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' })
  return crypto.verify(null, mensagem, chave, sig.subarray(10))
}

/** O artefato desta versão, gerado por ESTE build (não um que sobrou de antes). */
function acharArtefato(pasta, filtro, desde) {
  if (!fs.existsSync(pasta)) falhar(`pasta de saída não existe: ${pasta}`)
  const achados = fs
    .readdirSync(pasta)
    .filter(filtro)
    .map((nome) => path.join(pasta, nome))
    .filter((arquivo) => fs.statSync(arquivo).mtimeMs >= desde)
  if (achados.length !== 1) falhar(`esperava 1 artefato novo em ${pasta}, achei ${achados.length}`)
  return achados[0]
}

function main() {
  const args = lerArgumentos(process.argv.slice(2))
  const conf = JSON.parse(fs.readFileSync(CONF, 'utf8'))
  const versao = conf.version
  const pubkey = conf.plugins?.updater?.pubkey
  if (!/^\d+\.\d+\.\d+$/.test(versao ?? '')) falhar(`versão estranha em tauri.conf.json: ${versao}`)
  if (!pubkey) falhar('tauri.conf.json sem plugins.updater.pubkey')
  if (!fs.existsSync(CHAVE)) falhar(`chave de assinatura não encontrada em ${CHAVE}`)
  const tag = `v${versao}`
  if (args.publicar) {
    if (!args.notas || !fs.existsSync(args.notas)) falhar('--publicar pede --notas <arquivo> existente')
    // O tag nasce no commit que foi buildado; ele precisa já estar no GitHub.
    const head = capturar('git', ['rev-parse', 'HEAD'])
    if (head === null || head !== capturar('git', ['rev-parse', '@{u}'])) falhar('HEAD local diferente do remoto: faça o push antes de publicar')
    if (capturar('gh', ['release', 'view', tag, '--repo', REPO_GITHUB]) !== null) falhar(`a release ${tag} já existe: suba a versão antes`)
  }

  console.log(`[publicar-versao] build da versão ${versao} (assinado para o updater)`)
  const inicio = Date.now() - 1000
  // Só o filho recebe a chave, pelo caminho; o terminal do usuário fica limpo.
  const env = { ...process.env, TAURI_SIGNING_PRIVATE_KEY: CHAVE, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' }
  rodar('npm', ['run', 'tauri:build'], { env, shell: process.platform === 'win32' })

  const target = process.env.CARGO_TARGET_DIR || path.join(RAIZ, 'desktop', 'src-tauri', 'target')
  const bundle = path.join(target, 'release', 'bundle')
  const setup = acharArtefato(path.join(bundle, 'nsis'), (n) => n.endsWith(`_${versao}_x64-setup.exe`), inicio)
  const msi = acharArtefato(path.join(bundle, 'msi'), (n) => n.includes(`_${versao}_`) && n.endsWith('.msi'), inicio)
  const sigArquivo = `${setup}.sig`
  if (!fs.existsSync(sigArquivo)) falhar(`assinatura não gerada: ${sigArquivo} (createUpdaterArtifacts ligado?)`)
  const assinatura = fs.readFileSync(sigArquivo, 'utf8').trim()
  if (!assinaturaConfere(setup, assinatura, pubkey)) falhar('a assinatura do setup NÃO confere com a pubkey do tauri.conf.json')
  console.log('[publicar-versao] assinatura do setup confere com a chave pública do app')

  const notas = args.notas ? fs.readFileSync(args.notas, 'utf8').trim() : `Versão ${versao}`
  const latest = {
    version: versao,
    notes: notas,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: assinatura,
        url: `https://github.com/${REPO_GITHUB}/releases/download/${tag}/${path.basename(setup)}`,
      },
    },
  }
  const latestArquivo = path.join(bundle, 'latest.json')
  fs.writeFileSync(latestArquivo, `${JSON.stringify(latest, null, 2)}\n`)
  console.log(`[publicar-versao] gerados:\n  ${setup}\n  ${sigArquivo}\n  ${msi}\n  ${latestArquivo}`)

  if (!args.publicar) {
    console.log('[publicar-versao] sem --publicar: nada foi enviado ao GitHub.')
    return
  }
  if (!fs.existsSync(GITLEAKS)) falhar(`gitleaks não encontrado em ${GITLEAKS}`)
  const tagAnterior = capturar('git', ['describe', '--tags', '--abbrev=0'])
  const intervalo = tagAnterior ? `--log-opts=${tagAnterior}..HEAD` : '--log-opts=HEAD'
  rodar(GITLEAKS, ['git', '--no-banner', '--redact', intervalo])
  rodar('gh', [
    'release',
    'create',
    tag,
    setup,
    sigArquivo,
    msi,
    latestArquivo,
    '--repo',
    REPO_GITHUB,
    '--target',
    capturar('git', ['rev-parse', 'HEAD']),
    '--title',
    tag,
    '--notes-file',
    args.notas,
  ])
  console.log(`[publicar-versao] release ${tag} publicada com latest.json.`)
}

// Importável para conferir a assinatura sem buildar (require não dispara o build).
if (require.main === module) main()
module.exports = { assinaturaConfere }
