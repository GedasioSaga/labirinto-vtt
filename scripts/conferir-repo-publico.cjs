'use strict'
/**
 * GUARDA DO REPO PÚBLICO (docs/planos/lobby-jogadores-2026-11-05.md, 6.7, 12.12 e XS14).
 *
 *   node scripts/conferir-repo-publico.cjs     sai 0 = nada bloqueia; sai 1 = lista o que bloqueia
 *
 * O repo GedasioSaga/labirinto-vtt é público, e o site do Lobby também sai
 * daqui. O publicar-versao.cjs roda esta guarda antes de qualquer envio
 * (Worker, Pages e release do GitHub). Ela olha o que está RASTREADO pelo git
 * (o índice: o que entra no próximo commit e no push) e o build do site
 * (client/dist-lobby), não a pasta de trabalho inteira:
 *  1. segredos: gitleaks nos commits desde a última tag, no índice e no dist-lobby;
 *  2. e-mail fora dos domínios reservados para exemplo (RFC 2606), salvo a lista abaixo;
 *  3. arquivo com nome de dado real do app (rpg.json, fila.jsonl, ...);
 *  4. `.dev.vars*` ou qualquer arquivo dentro de `.wrangler/` (segredos e SQLite do wrangler dev);
 *  5. print novo ou trocado em docs/verification desde a base (12.12), salvo a lista abaixo;
 *  6. HTML cru (dangerouslySetInnerHTML, innerHTML/outerHTML =, insertAdjacentHTML,
 *     document.write) no código do client/src que vai para o usuário (o app também
 *     recebe texto da internet agora) e, no dist-lobby, além do que o React DOM já traz.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..')
const DIST_DO_LOBBY = path.join(RAIZ, 'client', 'dist-lobby')
const GITLEAKS = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'Microsoft',
  'WinGet',
  'Packages',
  'Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe',
  'gitleaks.exe',
)

/** Domínios reservados para exemplo (RFC 2606): nunca são de alguém. */
const DOMINIOS_DE_EXEMPLO = new Set(['example.com', 'example.org', 'example.net'])

/** Endereços inventados que já estão no repo, cada um com o motivo. Comparação sem maiúsculas. */
const EMAILS_LIBERADOS = new Set([
  'noreply@anthropic.com', // linha Co-Authored-By citada em documentação
  'ana@bruno.com', // exemplo de texto que não menciona ninguém (lib/chat.ts e o teste do chat)
  'youtube.com@golpe.net', // link de golpe no teste do link do YouTube
  'b@www.youtube.com', // idem
])

/** "128x128@2x.png" casa com o desenho de e-mail, mas é nome de arquivo. */
const DOMINIO_QUE_E_ARQUIVO = /\.(?:png|jpe?g|webp|gif|svg|ico|json|[cm]?[jt]sx?|css|html?)$/i

/** Nomes dos arquivos onde o app guarda dado de jogo e de jogador (appData, pastas, nuvem/<campanha>). */
const NOME_DE_DADO_REAL =
  /^(?:rpg\.json|adventure\.json|map\.json|contas\.json|fila\.jsonl|estado\.json|negadas\.jsonl|chat-sala\.jsonl|global\.jsonl|jogadores-vistos\.json|migracao-da-mochila\.json|diario-\d{4}-\d{2}\.jsonl|.+\.antes-da-mochila|.+\.anterior|.+\.sqlite3?)$/i

/** Caminhos exatos com nome de dado real que podem ficar (dado inventado), cada um com o motivo. */
const DADOS_LIBERADOS = new Set([])

const PASTA_DOS_PRINTS = 'docs/verification'
/**
 * Commit em que esta guarda nasceu: os prints que já estavam em docs/verification
 * ficam como estão; a regra da 12.12 vale do que entrar ou mudar depois dele.
 */
const BASE_DOS_PRINTS = 'cbdd10a9c3329deecaec92e1c5205aea61c36696'
const EXTENSAO_DE_IMAGEM = /\.(?:png|jpe?g|webp|gif|bmp|avif|tiff?)$/i
/**
 * Prints liberados (12.12): só print da pasta de teste, com dados inventados,
 * pelo caminho exato e com o motivo. Print do app com ficha real nunca entra.
 */
const PRINTS_LIBERADOS = new Set([])

/** Código de teste não vai para o usuário (e lê `container.innerHTML` à vontade). */
const FORA_DO_CODIGO_ENTREGUE = [
  ':(exclude,glob)client/src/**/*.test.*',
  ':(exclude,glob)client/src/**/*.spec.*',
  ':(exclude,glob)client/src/**/*.fixture.*',
  ':(exclude,glob)client/src/**/__fixtures__/**',
  ':(exclude,glob)client/src/**/__tests__/**',
]

/**
 * As saídas de HTML cru. `git` é o mesmo desenho em ERE (git grep -E); `js`
 * conta no build. Ler `x.innerHTML` não é saída: só a atribuição conta.
 */
const SAIDAS_DE_HTML = [
  // A prop no JSX (`={`) ou no objeto compilado (`:`); `== "object"` é o React DOM conferindo, não escrevendo.
  { nome: 'dangerouslySetInnerHTML', git: 'dangerouslySetInnerHTML[[:space:]]*(:|=([^=]|$))', js: /dangerouslySetInnerHTML\s*(?::|=(?!=))/g },
  { nome: 'innerHTML/outerHTML =', git: '\\.(inner|outer)HTML[[:space:]]*\\+?=([^=]|$)', js: /\.(?:inner|outer)HTML\s*\+?=(?!=)/g },
  { nome: 'insertAdjacentHTML', git: 'insertAdjacentHTML[[:space:]]*\\(', js: /insertAdjacentHTML\s*\(/g },
  { nome: 'document.write', git: 'document\\.write(ln)?[[:space:]]*\\(', js: /document\.write(?:ln)?\s*\(/g },
]

const EXTENSAO_DE_TEXTO = /\.(?:js|mjs|css|html|json|txt|map|svg|webmanifest)$|^_(?:headers|redirects)$/i
const MAX_BUFFER = 64 * 1024 * 1024

/** Roda o git na raiz; status 1 do `git grep` é "nada achado", não erro. */
function git(args, { aceitarUm = false } = {}) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: MAX_BUFFER })
  if (r.error) throw new Error(`git não rodou: ${r.error.message}`)
  if (r.status === 0 || (aceitarUm && r.status === 1)) return r.stdout
  throw new Error(`git ${args.join(' ')} saiu com código ${r.status}: ${r.stderr.trim()}`)
}

/** `git grep -z -n`: cada linha é `caminho\0linha\0texto`. */
function linhasDoGrep(saida) {
  return saida
    .split('\n')
    .filter((linha) => linha.length > 0)
    .map((linha) => {
      const [caminho, numero, ...resto] = linha.split('\0')
      return { caminho, numero, texto: resto.join('\0') }
    })
}

function arquivosRastreados() {
  return git(['ls-files', '-z']).split('\0').filter((caminho) => caminho.length > 0)
}

function emailLiberado(email) {
  const minusculo = email.toLowerCase()
  const dominio = minusculo.slice(minusculo.lastIndexOf('@') + 1)
  return DOMINIOS_DE_EXEMPLO.has(dominio) || EMAILS_LIBERADOS.has(minusculo) || DOMINIO_QUE_E_ARQUIVO.test(dominio)
}

/** Os arquivos de texto do build do site (o que vai para o Pages). */
function arquivosDoDist() {
  const achados = []
  const andar = (pasta) => {
    for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
      const caminho = path.join(pasta, entrada.name)
      if (entrada.isDirectory()) andar(caminho)
      else if (EXTENSAO_DE_TEXTO.test(entrada.name)) achados.push(caminho)
    }
  }
  andar(DIST_DO_LOBBY)
  return achados
}

function relativo(caminho) {
  return path.relative(RAIZ, caminho).split(path.sep).join('/')
}

// --- 1. segredos -------------------------------------------------------------

function rodarGitleaks(args) {
  const r = spawnSync(GITLEAKS, [...args, '--no-banner', '--no-color', '--redact', '--verbose', '--log-level=warn'], {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
  })
  if (r.error) return `gitleaks não rodou: ${r.error.message}`
  if (r.status === 0) return null
  return `${r.stdout}${r.stderr}`.trim() || `gitleaks saiu com código ${r.status}`
}

function conferirSegredos() {
  if (!fs.existsSync(GITLEAKS)) return [`gitleaks não encontrado em ${GITLEAKS} (sem ele a guarda não confere segredo)`]
  const problemas = []
  const tag = spawnSync('git', ['describe', '--tags', '--abbrev=0'], { cwd: RAIZ, encoding: 'utf8' })
  const intervalo = tag.status === 0 ? `--log-opts=${tag.stdout.trim()}..HEAD` : '--log-opts=HEAD'
  const nosCommits = rodarGitleaks(['git', intervalo])
  if (nosCommits !== null) problemas.push(`commits (${intervalo.slice('--log-opts='.length)}):\n${nosCommits}`)
  const noIndice = rodarGitleaks(['git', '--staged'])
  if (noIndice !== null) problemas.push(`índice (git add ainda sem commit):\n${noIndice}`)
  if (fs.existsSync(DIST_DO_LOBBY)) {
    const noDist = rodarGitleaks(['dir', DIST_DO_LOBBY])
    if (noDist !== null) problemas.push(`client/dist-lobby:\n${noDist}`)
  }
  return problemas
}

// --- 2. e-mail ---------------------------------------------------------------

const DESENHO_DE_EMAIL_GIT = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'
const DESENHO_DE_EMAIL_JS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

function conferirEmails() {
  const problemas = []
  const saida = git(['grep', '--cached', '-I', '-z', '-n', '-o', '-E', DESENHO_DE_EMAIL_GIT], { aceitarUm: true })
  for (const { caminho, numero, texto } of linhasDoGrep(saida)) {
    if (!emailLiberado(texto)) problemas.push(`${caminho}:${numero}: ${texto}`)
  }
  if (fs.existsSync(DIST_DO_LOBBY)) {
    for (const arquivo of arquivosDoDist()) {
      for (const email of fs.readFileSync(arquivo, 'utf8').match(DESENHO_DE_EMAIL_JS) ?? []) {
        if (!emailLiberado(email)) problemas.push(`${relativo(arquivo)}: ${email}`)
      }
    }
  }
  return problemas
}

// --- 3 e 4. arquivos que não podem estar rastreados -------------------------

function conferirArquivosRastreados(rastreados) {
  const dadoReal = []
  const doWrangler = []
  for (const caminho of rastreados) {
    const partes = caminho.split('/')
    const nome = partes[partes.length - 1]
    if (nome.startsWith('.dev.vars') || partes.includes('.wrangler')) doWrangler.push(caminho)
    else if (NOME_DE_DADO_REAL.test(nome) && !DADOS_LIBERADOS.has(caminho)) dadoReal.push(caminho)
  }
  return { dadoReal, doWrangler }
}

// --- 5. prints ---------------------------------------------------------------

function conferirPrints() {
  if (spawnSync('git', ['cat-file', '-e', `${BASE_DOS_PRINTS}^{commit}`], { cwd: RAIZ }).status !== 0) {
    return [`commit base ${BASE_DOS_PRINTS} não está neste clone (clone raso?): não dá para saber o que é print novo`]
  }
  // Índice contra a base: pega o que já foi commitado depois dela e o que está no git add.
  const saida = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR', BASE_DOS_PRINTS, '--', PASTA_DOS_PRINTS])
  return saida
    .split('\0')
    .filter((caminho) => EXTENSAO_DE_IMAGEM.test(caminho) && !PRINTS_LIBERADOS.has(caminho))
}

// --- 6. HTML cru -------------------------------------------------------------

/** O React DOM escreve `innerHTML` por dentro (SVG, <script>): o build pode ter até isso, nada além. */
function contagemDoReactDom() {
  const pacote = require.resolve('react-dom/package.json', { paths: [path.join(RAIZ, 'client')] })
  const arquivo = path.join(path.dirname(pacote), 'cjs', 'react-dom-client.production.js')
  const texto = fs.readFileSync(arquivo, 'utf8')
  return new Map(SAIDAS_DE_HTML.map((saida) => [saida.nome, (texto.match(saida.js) ?? []).length]))
}

function conferirHtmlCru() {
  const problemas = []
  const desenhos = SAIDAS_DE_HTML.flatMap((saida) => ['-e', saida.git])
  const saida = git(['grep', '--cached', '-I', '-z', '-n', '-E', ...desenhos, '--', 'client/src', ...FORA_DO_CODIGO_ENTREGUE], { aceitarUm: true })
  for (const { caminho, numero, texto } of linhasDoGrep(saida)) problemas.push(`${caminho}:${numero}: ${texto.trim().slice(0, 160)}`)

  if (fs.existsSync(DIST_DO_LOBBY)) {
    let doReact
    try {
      doReact = contagemDoReactDom()
    } catch (erro) {
      return [...problemas, `não deu para ler o React DOM instalado para comparar com o dist-lobby: ${erro.message}`]
    }
    const codigo = arquivosDoDist()
      .filter((arquivo) => /\.m?js$/i.test(arquivo))
      .map((arquivo) => fs.readFileSync(arquivo, 'utf8'))
      .join('\n')
    for (const saidaDeHtml of SAIDAS_DE_HTML) {
      const noDist = (codigo.match(saidaDeHtml.js) ?? []).length
      const permitido = doReact.get(saidaDeHtml.nome) ?? 0
      if (noDist > permitido) problemas.push(`client/dist-lobby: ${noDist}× ${saidaDeHtml.nome}, o React DOM traz ${permitido}`)
    }
  }
  return problemas
}

// --- relatório ---------------------------------------------------------------

function main() {
  const rastreados = arquivosRastreados()
  const { dadoReal, doWrangler } = conferirArquivosRastreados(rastreados)
  const regras = [
    { nome: 'segredos (gitleaks)', problemas: conferirSegredos() },
    { nome: 'e-mail fora de example.com', problemas: conferirEmails() },
    { nome: 'arquivo com nome de dado real rastreado', problemas: dadoReal },
    { nome: '.dev.vars* ou .wrangler/ rastreado', problemas: doWrangler },
    { nome: `print novo ou trocado em ${PASTA_DOS_PRINTS} (12.12)`, problemas: conferirPrints() },
    { nome: 'HTML cru no client/src entregue e no dist-lobby', problemas: conferirHtmlCru() },
  ]
  const semDist = fs.existsSync(DIST_DO_LOBBY) ? '' : ' (sem client/dist-lobby: o build do site ficou de fora)'
  console.log(`[conferir-repo-publico] ${rastreados.length} arquivos rastreados${semDist}`)
  let bloqueios = 0
  for (const regra of regras) {
    if (regra.problemas.length === 0) {
      console.log(`  ok   ${regra.nome}`)
      continue
    }
    bloqueios += regra.problemas.length
    console.log(`  FALHA ${regra.nome}:`)
    for (const problema of regra.problemas) console.log(`         ${problema.split('\n').join('\n         ')}`)
  }
  if (bloqueios > 0) {
    console.error(`\n[conferir-repo-publico] ${bloqueios} bloqueio(s): nada pode ir para o repo público nem para o Lobby assim.`)
    process.exit(1)
  }
  console.log('[conferir-repo-publico] nada bloqueia.')
}

try {
  main()
} catch (erro) {
  // Falha ao conferir conta como bloqueio: sem conferência, nada sai.
  console.error(`\n[conferir-repo-publico] ERRO: ${erro instanceof Error ? erro.message : String(erro)}`)
  process.exit(1)
}
