#!/usr/bin/env node
'use strict'
/*
 * Portão de validade do Labirinto — um comando só, honesto.
 *
 * POR QUE EXISTE. O portão anterior eram três comandos e cada um mentia de um
 * jeito diferente:
 *
 *   1. `tsc --noEmit` do cliente só enxerga `src` (client/tsconfig.json,
 *      "include": ["src"]). `e2e/` e `playwright.config.ts` ficavam FORA da
 *      checagem de tipo — e havia (e há) erro de tipo VIVO dentro de uma
 *      jornada declarada. O portão saía verde com a jornada quebrada.
 *   2. Rodado pelo atalho `npx tsc`, o proxy rtk imprime os erros e ainda
 *      assim devolve exit 0 (medido em 17/09/2026: 3 erros impressos,
 *      `EXIT=0`). Aqui o TypeScript é chamado pelo seu próprio entry point com
 *      `process.execPath`, sem npx, sem hook, sem filtro — exit code de
 *      verdade.
 *   3. Nenhum dos três compilava ou testava o lado Rust, e o artefato julgado
 *      é o exe release servindo o jogador na LAN. 21 testes em
 *      desktop/src-tauri/tests/net_server.rs e 3 módulos `cfg(test)` nunca
 *      rodavam.
 *   4. A Invariante 6 ("desenhar uma sala arrastando com longtask_max_ms
 *      abaixo de 200") não tinha comando NENHUM no repositório inteiro.
 *   5. Nada tocava o exe release na porta 7777: a jornada do jogador simula o
 *      transporte inteiro dentro do navegador.
 *
 * O QUE ELE FAZ, em ordem — qualquer vermelho encerra com exit 1:
 *
 *   FASE 0 — auditoria estática do próprio portão (barata, sem suíte). Cada
 *            guarda é uma função pura sobre texto, e `--autoteste` prova que
 *            cada uma REPROVA a entrada ruim conhecida. Guarda que nunca
 *            reprova nada é decoração.
 *   FASE 1 — comandos. Cada um roda com o exit code real E tem um detector de
 *            FALSO-VERDE: se saiu 0 mas a saída contém ruína (erro de tipo,
 *            teste pulado, flaky, panic), o portão reprova assim mesmo.
 *
 * Uso:
 *   node scripts/portao.cjs              portão completo
 *   node scripts/portao.cjs --fase0      só a auditoria estática (segundos)
 *   node scripts/portao.cjs --autoteste  prova que as guardas reprovam entrada ruim
 *   node scripts/portao.cjs --listar     imprime o plano em JSON, não roda nada
 *   node scripts/portao.cjs --so=<id>    roda um passo só
 *   node scripts/portao.cjs --json       relatório em JSON no stdout
 *
 * Escrita em disco: só o relatório, em %TEMP%/portao-labirinto/. Nenhum passo
 * apaga ou sobrescreve dado do repositório.
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const { spawnSync } = require('child_process')

const RAIZ = path.resolve(__dirname, '..')
const CLIENTE = path.join(RAIZ, 'client')
const TAURI = path.join(RAIZ, 'desktop', 'src-tauri')
const SAIDA = path.join(os.tmpdir(), 'portao-labirinto')

/** Página do jogador servida pelo exe RELEASE na LAN — o artefato que está em julgamento. */
const URL_JOGADOR = process.env.PORTAO_URL_JOGADOR || 'http://192.168.0.6:7777/player'
const TIMEOUT_JOGADOR_MS = 8000
/** Editor do mestre no servidor de desenvolvimento — o mesmo baseURL do playwright.config.ts. */
const URL_EDITOR = process.env.PORTAO_URL_EDITOR || 'http://localhost:1420/'
/** Os módulos que os specs importam dentro de `page.evaluate` — os que podem virar instância dupla. */
const MODULOS_DE_SPEC = ['/src/stores/mapStore.ts', '/src/lib/mapFactory.ts']

/**
 * As jornadas que a bar declarou, mais a desta peça. O portão roda cada uma 3
 * vezes (`--repeat-each=3`), que é o que a interface da peça pede.
 */
const JORNADAS_E2E = [
  'e2e/task-jornada-entrada-jogador.spec.ts',
  'e2e/task-jornada-nao-perder-trabalho.spec.ts',
  'e2e/task-jornada-gestos-centrais.spec.ts',
  'e2e/task-jornada-ferramentas-mudas.spec.ts',
  'e2e/task-jornada-porta-sem-buraco.spec.ts',
]
/**
 * A jornada de FLUIDEZ roda sozinha, com `--workers=1`. Não é preferência: medir
 * travamento numa máquina que hospeda outros 3 Pixi/WebGL mede a máquina.
 * Medido em 17/09/2026, mesma jornada, mesmo commit, desenhando a sala:
 *   com 4 workers (--repeat-each=3):  longtask_max_ms = 168, 192, 199  (teto 200)
 *   sozinha, --workers=1:             longtask_max_ms =  95, 120, 130
 * A 199 contra um teto de 200 o resultado vira cara-ou-coroa — flake, que é
 * exatamente o que `retries: 0` existe para não deixar passar disfarçado. Com a
 * máquina só para ela a folga é de 70 ms e o número passa a ser do app.
 */
const JORNADA_FLUIDEZ = 'e2e/task-jornada-portao-fluidez.spec.ts'
/** Tudo que a FASE 0 audita arquivo a arquivo — a de fluidez inclusive. */
const TODAS_JORNADAS_E2E = JORNADAS_E2E.concat([JORNADA_FLUIDEZ])
const JORNADAS_UNIDADE = [
  'src/lib/mapFile.persistencia.test.ts',
  'src/lib/mapFileIO.persistencia.test.ts',
  'src/lib/mapFactory.porta-tipo.test.ts',
]

// ---------------------------------------------------------------------------
// FASE 0 — guardas. Funções puras sobre texto: dá para provar que reprovam.
// ---------------------------------------------------------------------------

function ok(id, detalhe) {
  return { id, ok: true, detalhe }
}
function reprova(id, detalhe, endereco) {
  return { id, ok: false, detalhe, endereco: endereco || null }
}

/**
 * Os projetos de tipo do portão, juntos, precisam cobrir `src`, `e2e` e o
 * `playwright.config.ts`. Um `include: ["src"]` sozinho deixa toda jornada
 * fora da checagem de tipo.
 */
function guardaCoberturaDeTipos(projetos) {
  const cobre = (alvo) =>
    projetos.some((p) => (p.include || []).some((i) => i === alvo || i.startsWith(alvo + '/') || i.startsWith(alvo + '/**')))
  const faltando = ['src', 'e2e', 'playwright.config.ts'].filter((alvo) => !cobre(alvo))
  if (faltando.length > 0) {
    return reprova(
      'g1-tipos-cobrem-e2e',
      'os projetos de tipo do portão não cobrem: ' + faltando.join(', '),
      'client/tsconfig.json + client/tsconfig.e2e.json ("include")',
    )
  }
  return ok('g1-tipos-cobrem-e2e', 'tipos cobrem src, e2e e playwright.config.ts (' + projetos.length + ' projetos)')
}

/**
 * `retries > 0` transforma flake em verde: o relatório diz "passou" e o
 * primeiro vermelho some. Flake se conserta na causa, não no retry.
 */
function guardaSemRetries(texto) {
  const achado = /retries\s*:\s*(\d+)/.exec(texto)
  if (!achado) return reprova('g2-sem-retries', 'playwright.config.ts não declara `retries` — o padrão pode mascarar flake', 'client/playwright.config.ts')
  if (Number(achado[1]) !== 0) {
    return reprova('g2-sem-retries', 'retries: ' + achado[1] + ' — retry esconde flake atrás de verde', 'client/playwright.config.ts')
  }
  return ok('g2-sem-retries', 'retries: 0')
}

/** `.only` roda um teste e cala os outros; `skip`/`fixme` deixa a jornada declarada sem rodar. */
function guardaSemOnlyNemSkip(arquivo, texto) {
  const marcas = []
  if (/\b(test|describe|it)\.only\s*\(/.test(texto)) marcas.push('.only')
  if (/\b(test|describe|it)\.skip\s*\(/.test(texto)) marcas.push('.skip')
  if (/\b(test|describe|it)\.fixme\s*\(/.test(texto)) marcas.push('.fixme')
  if (/\btest\.setTimeout\s*\(\s*0\s*\)/.test(texto)) marcas.push('setTimeout(0)')
  if (marcas.length > 0) return reprova('g3-sem-only-skip', arquivo + ' usa ' + marcas.join(', '), arquivo)
  return ok('g3-sem-only-skip', arquivo + ' sem only/skip/fixme')
}

/** Recorta o corpo de cada `test('...')` de um spec, para julgar asserção por asserção. */
function blocosDeTeste(texto) {
  const blocos = []
  const abertura = /\btest\s*\(\s*['"`]([^'"`]+)['"`]/g
  let m
  const inicios = []
  while ((m = abertura.exec(texto)) !== null) inicios.push({ nome: m[1], em: m.index })
  for (let i = 0; i < inicios.length; i++) {
    const fim = i + 1 < inicios.length ? inicios[i + 1].em : texto.length
    blocos.push({ nome: inicios[i].nome, corpo: texto.slice(inicios[i].em, fim) })
  }
  return blocos
}

/**
 * Asserção de TETO sem controle positivo passa com o app morto: se o gesto não
 * pegou e nada mudou, o delta é 0 e `toBeLessThan(24)` aprova. Um teto só vale
 * acompanhado de alguma prova de que o cenário aconteceu — um piso
 * (`toBeGreaterThan`), uma igualdade ou uma presença na tela.
 */
function guardaTetoSemControle(arquivo, texto) {
  const teto = /\.toBeLessThan(OrEqual)?\s*\(/
  const controle = /\.(toBeGreaterThan(OrEqual)?|toEqual|toStrictEqual|toBeVisible|toHaveText|toContainText|toHaveCount|toHaveAttribute|toBeChecked)\s*\(|\.toBe\s*\(/
  const nus = blocosDeTeste(texto).filter((b) => teto.test(b.corpo) && !controle.test(b.corpo))
  if (nus.length > 0) {
    return reprova(
      'g4-teto-sem-controle',
      arquivo + ': teto sem controle positivo em ' + nus.map((b) => JSON.stringify(b.nome)).join(', '),
      arquivo,
    )
  }
  return ok('g4-teto-sem-controle', arquivo + ': todo teto tem controle positivo')
}

/**
 * Uma jornada que fabrica a resposta do transporte dentro do próprio navegador
 * não prova transporte nenhum: ela prova que o `switch` do stub responde. O
 * artefato declarado é o exe release servindo o jogador na LAN.
 */
function guardaTransporteFalsificado(arquivo, texto) {
  const marcas = []
  if (/__emitTauri\s*\(/.test(texto)) marcas.push('__emitTauri (evento de transporte inventado na página)')
  if (/case\s+'net_(start_room|send|kick|stop_room)'/.test(texto)) marcas.push("stub de invoke 'net_*'")
  if (marcas.length > 0) {
    return reprova(
      'g5-transporte-falsificado',
      arquivo + ' simula o transporte: ' + marcas.join(', ') + ' — nada toca o exe release nem a porta 7777',
      arquivo,
    )
  }
  return ok('g5-transporte-falsificado', arquivo + ' não fabrica transporte')
}

/** A Invariante 6 precisa de UM comando que a meça; senão é texto, não invariante. */
function guardaInvariante6TemComando(textos) {
  const mede = Object.keys(textos).filter((a) => /longtask/i.test(textos[a]) && /\b200\b/.test(textos[a]))
  if (mede.length === 0) {
    return reprova(
      'g6-invariante-6-medida',
      'nenhuma jornada mede longtask com o teto de 200 ms — a Invariante 6 não tem comando',
      'INVARIANTES item 6',
    )
  }
  return ok('g6-invariante-6-medida', 'medida por ' + mede.join(', '))
}

/** O plano precisa tocar o Rust e precisa tocar o exe vivo; senão o artefato julgado não é o artefato. */
function guardaPlanoCobreArtefato(plano) {
  const faltando = []
  if (!plano.some((p) => p.id.startsWith('rust-'))) faltando.push('nenhum passo cargo (desktop/src-tauri)')
  if (!plano.some((p) => p.id === 'transporte-vivo')) faltando.push('nenhum passo bate no exe release')
  if (!plano.some((p) => p.id === 'jornadas-e2e')) faltando.push('nenhum passo roda as jornadas')
  if (!plano.some((p) => p.id === 'servidor-limpo')) faltando.push('nenhum passo confere se o dev server duplicou módulo por HMR')
  // Sem passo próprio, a fluidez volta a ser medida junto dos outros workers — e
  // aí o número é o da máquina carregada, não o do app.
  if (!plano.some((p) => p.id === 'jornada-fluidez')) faltando.push('nenhum passo mede a Invariante 6 com a máquina sozinha')
  if (faltando.length > 0) return reprova('g7-plano-cobre-artefato', faltando.join('; '), 'scripts/portao.cjs (PLANO)')
  return ok('g7-plano-cobre-artefato', 'plano cobre tipos, unidade, Rust, jornadas e exe vivo')
}

/** Jornada declarada que não existe, ou que não declara teste nenhum, é invariante vazia. */
function guardaJornadasExistem(arquivos) {
  const problemas = []
  for (const arquivo of arquivos) {
    const absoluto = path.join(CLIENTE, arquivo)
    if (!fs.existsSync(absoluto)) {
      problemas.push(arquivo + ' não existe')
      continue
    }
    const texto = fs.readFileSync(absoluto, 'utf8')
    const quantos = (texto.match(/\b(test|it)\s*\(\s*['"`]/g) || []).length
    if (quantos === 0) problemas.push(arquivo + ' não declara nenhum teste')
  }
  if (problemas.length > 0) return reprova('g8-jornadas-existem', problemas.join('; '), 'client/e2e + client/src/lib')
  return ok('g8-jornadas-existem', arquivos.length + ' arquivos de jornada presentes e com testes')
}

// ---------------------------------------------------------------------------
// FASE 1 — comandos, com exit code real e detector de falso-verde.
// ---------------------------------------------------------------------------

const TSC = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')
const VITEST = path.join(RAIZ, 'node_modules', 'vitest', 'vitest.mjs')
const PLAYWRIGHT = path.join(RAIZ, 'node_modules', '@playwright', 'test', 'cli.js')

const PLANO = [
  {
    id: 'tipos-src',
    titulo: 'tipos do app (client/tsconfig.json)',
    exe: process.execPath,
    args: [TSC, '--noEmit', '-p', path.join(CLIENTE, 'tsconfig.json')],
    cwd: CLIENTE,
    ruina: [/error TS\d+/],
  },
  {
    id: 'tipos-e2e',
    titulo: 'tipos das jornadas e do playwright.config (client/tsconfig.e2e.json)',
    exe: process.execPath,
    args: [TSC, '--noEmit', '-p', path.join(CLIENTE, 'tsconfig.e2e.json')],
    cwd: CLIENTE,
    ruina: [/error TS\d+/],
  },
  {
    id: 'unidade',
    titulo: 'vitest (suíte inteira)',
    exe: process.execPath,
    args: [VITEST, 'run', '--reporter=default'],
    cwd: CLIENTE,
    // `\d+ skipped` e não `skipped`: "todo" é palavra comum em português e o
    // repositório é em português — um nome de teste derrubaria o portão à toa.
    ruina: [/\d+ skipped\b/i, /\d+ todo\b/i, /\bFAIL\b/, /No test files found/],
  },
  {
    id: 'rust-clippy',
    titulo: 'cargo clippy do exe (desktop/src-tauri)',
    exe: 'cargo',
    args: ['clippy', '--all-targets', '--all-features', '--', '-D', 'warnings', '-W', 'clippy::unwrap_used', '-W', 'clippy::expect_used'],
    cwd: TAURI,
    shell: true,
    // Sem `^warning:`: o `-D warnings` acima já reprova warning de verdade pelo
    // exit code, e cargo imprime aviso benigno de manifesto que viraria falso vermelho.
    ruina: [/\berror(\[E\d+\])?:/],
  },
  {
    id: 'rust-test',
    titulo: 'cargo test do transporte (net_server.rs + módulos cfg(test))',
    exe: 'cargo',
    args: ['test', '--all-features'],
    cwd: TAURI,
    shell: true,
    ruina: [/\bFAILED\b/, /panicked at/, /\b[1-9]\d* ignored/],
    // `running 0 tests` NÃO serve como ruína: o cargo imprime uma linha dessas
    // por alvo, e a seção de doc-tests de um crate sem doc-test sempre sai
    // zerada. Medido em 17/09/2026: 25 testes passando e o portão vermelho por
    // causa da linha do doc-test. O que importa é o contrário — pelo menos um
    // alvo precisa ter rodado teste de verdade.
    exige: [/running [1-9]\d* tests/],
  },
  {
    id: 'transporte-vivo',
    titulo: 'exe release servindo /player na LAN (' + URL_JOGADOR + ')',
    sonda: sondarJogador,
  },
  {
    id: 'servidor-limpo',
    titulo: 'editor sem módulo duplicado por HMR (senão toda afirmação por store é sobre a store errada)',
    sonda: sondarServidorLimpo,
  },
  {
    id: 'jornadas-e2e',
    titulo: 'jornadas com ponteiro real, 3 execuções cada',
    exe: process.execPath,
    args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--repeat-each=3', '--reporter=list'].concat(JORNADAS_E2E),
    cwd: CLIENTE,
    ruina: [/\b\d+ skipped\b/, /\b\d+ flaky\b/, /\bdid not run\b/, /\b\d+ failed\b/],
  },
  {
    id: 'jornada-fluidez',
    titulo: 'Invariante 6 medida com a máquina só para ela (workers=1, 3 execuções)',
    exe: process.execPath,
    args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--repeat-each=3', '--workers=1', '--reporter=list', JORNADA_FLUIDEZ],
    cwd: CLIENTE,
    ruina: [/\b\d+ skipped\b/, /\b\d+ flaky\b/, /\bdid not run\b/, /\b\d+ failed\b/],
  },
]

/**
 * Prova que o exe RELEASE está no ar e é ele que serve o jogador — não o vite
 * dev. O discriminador é o bundle: o build de release referencia
 * `/assets/player-<hash>.js`; o dev server injeta `/@vite/client`.
 */
function sondarJogador() {
  return new Promise((resolve) => {
    const pedido = http.get(URL_JOGADOR, (r) => {
      let corpo = ''
      r.on('data', (d) => {
        corpo += d
      })
      r.on('end', () => {
        const problemas = []
        if (r.statusCode !== 200) problemas.push('status ' + r.statusCode)
        if (/@vite\/client/.test(corpo)) problemas.push('a página veio do vite dev, não do exe release')
        if (!/\/assets\/player-[\w-]+\.js/.test(corpo)) problemas.push('a página não referencia o bundle de release do jogador')
        resolve({
          codigo: problemas.length === 0 ? 0 : 1,
          saida: 'GET ' + URL_JOGADOR + ' -> ' + r.statusCode + ' (' + corpo.length + ' bytes)\n' + (problemas.join('; ') || 'bundle de release confirmado'),
        })
      })
    })
    pedido.setTimeout(TIMEOUT_JOGADOR_MS, () => {
      pedido.destroy()
      resolve({ codigo: 1, saida: 'sem resposta em ' + TIMEOUT_JOGADOR_MS + ' ms: o exe release não está servindo ' + URL_JOGADOR })
    })
    pedido.on('error', (e) => resolve({ codigo: 1, saida: 'GET ' + URL_JOGADOR + ' falhou: ' + e.message }))
  })
}

/**
 * O servidor de desenvolvimento que o portão reaproveita
 * (`reuseExistingServer: true`) fica de pé por horas. Cada vez que o vite faz
 * HMR de um módulo, ele passa a servi-lo carimbado — `mapStore.ts?t=<ms>`. A
 * página do app carrega o carimbado; um `page.evaluate(import('/src/...'))`
 * de spec carrega o SEM carimbo. São dois módulos, duas stores zustand, e a
 * asserção olha uma store que a interface nunca usou.
 *
 * Medido em 17/09/2026 neste repositório: a página carregou as duas,
 *   /src/stores/mapStore.ts?t=1789618960728   (a do app)
 *   /src/stores/mapStore.ts                   (a do evaluate)
 * e `task-room-tool.spec.ts:85` reprovou com `regions: []` embora a sala
 * estivesse desenhada na tela (`aria-pressed="true"` no botão Sala e pixels
 * do canvas mudando). Vermelho falso — e, no sentido oposto, um spec que
 * escreve E lê pela store do evaluate nunca toca o app: verde falso.
 *
 * Conserto do operador: reiniciar o `npm run dev` antes de rodar o portão.
 */
function sondarServidorLimpo() {
  return new Promise((resolve) => {
    let chromium
    try {
      chromium = require(path.join(RAIZ, 'node_modules', 'playwright')).chromium
    } catch (e) {
      resolve({ codigo: 1, saida: 'playwright não carregou: ' + e.message })
      return
    }
    ;(async () => {
      const navegador = await chromium.launch()
      try {
        const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } })
        await pagina.goto(URL_EDITOR, { waitUntil: 'load', timeout: 30000 })
        await pagina.waitForTimeout(1500)
        // O carimbo sozinho não basta como prova: é o import do jeito que um
        // spec faz que materializa a SEGUNDA instância. A sonda reproduz esse
        // import — senão ela sairia verde exatamente no caso que existe para pegar.
        for (const mod of MODULOS_DE_SPEC) {
          await pagina.evaluate((caminho) => import(/* @vite-ignore */ caminho), mod).catch(() => {})
        }
        await pagina.waitForTimeout(500)
        const modulos = await pagina.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .filter((n) => n.indexOf('/src/') !== -1),
        )
        const carimbados = modulos.filter((n) => /\?t=\d+/.test(n))
        const porCaminho = new Map()
        for (const url of modulos) {
          const limpo = url.split('?')[0]
          if (!porCaminho.has(limpo)) porCaminho.set(limpo, new Set())
          porCaminho.get(limpo).add(url)
        }
        const duplicados = []
        for (const [limpo, urls] of porCaminho) if (urls.size > 1) duplicados.push(limpo + ' -> ' + Array.from(urls).join(' , '))
        const resumo = modulos.length + ' módulos de /src/, ' + carimbados.length + ' carimbados por HMR'
        resolve({
          codigo: duplicados.length === 0 ? 0 : 1,
          saida:
            duplicados.length === 0
              ? resumo + ', nenhum carregado duas vezes'
              : resumo +
                '\nmódulo carregado com E sem carimbo de HMR (duas instâncias, duas stores):\n' +
                duplicados.join('\n') +
                '\nReinicie o `npm run dev` antes de confiar em qualquer spec que afirme pela store.',
        })
      } finally {
        await navegador.close()
      }
    })().catch((e) => resolve({ codigo: 1, saida: 'sonda do servidor falhou: ' + String((e && e.message) || e) }))
  })
}

async function rodarPasso(passo) {
  const t0 = Date.now()
  let codigo
  let saida
  if (passo.sonda) {
    const r = await passo.sonda()
    codigo = r.codigo
    saida = r.saida
  } else {
    const r = spawnSync(passo.exe, passo.args, {
      cwd: passo.cwd,
      encoding: 'utf8',
      shell: Boolean(passo.shell),
      maxBuffer: 64 * 1024 * 1024,
    })
    codigo = r.status === null ? 1 : r.status
    saida = String(r.stdout || '') + String(r.stderr || '')
    if (r.error) saida += '\n' + r.error.message
  }
  const ruina = (passo.ruina || []).filter((re) => re.test(saida)).map(String)
  // `exige` é a prova positiva: sem ela, um comando que não rodou nada sai 0 e
  // passa por verde. Marca ausente conta como ruína, com o mesmo peso.
  const faltando = (passo.exige || []).filter((re) => !re.test(saida)).map((re) => 'faltou ' + String(re))
  const ruinaTotal = ruina.concat(faltando)
  const falsoVerde = codigo === 0 && ruinaTotal.length > 0
  return {
    id: passo.id,
    titulo: passo.titulo,
    codigo,
    ms: Date.now() - t0,
    ok: codigo === 0 && !falsoVerde,
    falsoVerde,
    ruina: ruinaTotal,
    saida,
  }
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function lerTsconfig(arquivo) {
  const bruto = fs.readFileSync(arquivo, 'utf8')
  // tsconfig aceita comentário; tira-os antes do JSON.parse.
  const limpo = bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return JSON.parse(limpo)
}

function rodarFase0() {
  const resultados = []
  const projetos = [path.join(CLIENTE, 'tsconfig.json'), path.join(CLIENTE, 'tsconfig.e2e.json')]
    .filter((p) => fs.existsSync(p))
    .map(lerTsconfig)
  resultados.push(guardaCoberturaDeTipos(projetos))
  resultados.push(guardaSemRetries(fs.readFileSync(path.join(CLIENTE, 'playwright.config.ts'), 'utf8')))
  resultados.push(guardaJornadasExistem(TODAS_JORNADAS_E2E.concat(JORNADAS_UNIDADE)))
  resultados.push(guardaPlanoCobreArtefato(PLANO))

  const textos = {}
  for (const arquivo of TODAS_JORNADAS_E2E.concat(JORNADAS_UNIDADE)) {
    const absoluto = path.join(CLIENTE, arquivo)
    if (fs.existsSync(absoluto)) textos[arquivo] = fs.readFileSync(absoluto, 'utf8')
  }
  resultados.push(guardaInvariante6TemComando(textos))
  for (const arquivo of Object.keys(textos)) {
    resultados.push(guardaSemOnlyNemSkip(arquivo, textos[arquivo]))
    resultados.push(guardaTetoSemControle(arquivo, textos[arquivo]))
    if (arquivo.endsWith('.spec.ts')) resultados.push(guardaTransporteFalsificado(arquivo, textos[arquivo]))
  }
  return resultados
}

/**
 * Autoteste: cada guarda tem de REPROVAR a entrada ruim conhecida e APROVAR a
 * boa. Sem isto não dá para saber se uma guarda virou decoração.
 */
function rodarAutoteste() {
  const casos = [
    ['g1 reprova include só de src', guardaCoberturaDeTipos([{ include: ['src'] }]), false],
    ['g1 aprova src + e2e + config', guardaCoberturaDeTipos([{ include: ['src'] }, { include: ['e2e', 'playwright.config.ts'] }]), true],
    ['g2 reprova retries: 1', guardaSemRetries('retries: 1,'), false],
    ['g2 reprova config sem retries', guardaSemRetries('workers: 4,'), false],
    ['g2 aprova retries: 0', guardaSemRetries('retries: 0,'), true],
    ['g3 reprova test.only', guardaSemOnlyNemSkip('x', "test.only('a', async () => {})"), false],
    ['g3 reprova test.skip', guardaSemOnlyNemSkip('x', "test.skip('a', async () => {})"), false],
    ['g3 aprova spec limpo', guardaSemOnlyNemSkip('x', "test('a', async () => { expect(1).toBe(1) })"), true],
    ['g4 reprova teto sem controle', guardaTetoSemControle('x', "test('a', async () => { expect(d).toBeLessThan(24) })"), false],
    ['g4 aprova teto com piso', guardaTetoSemControle('x', "test('a', async () => { expect(n).toBeGreaterThan(0); expect(d).toBeLessThan(24) })"), true],
    ['g5 reprova stub de transporte', guardaTransporteFalsificado('x', "await page.evaluate(() => alvo.__emitTauri('net:peer', {}))"), false],
    ['g5 reprova switch net_start_room', guardaTransporteFalsificado('x', "case 'net_start_room':"), false],
    ['g5 aprova jornada sem stub', guardaTransporteFalsificado('x', 'await page.mouse.down()'), true],
    ['g6 reprova sem medida de longtask', guardaInvariante6TemComando({ 'a.spec.ts': 'expect(1).toBe(1)' }), false],
    ['g6 aprova com medida', guardaInvariante6TemComando({ 'a.spec.ts': 'longtask_max_ms deve ficar abaixo de 200' }), true],
    ['g7 reprova plano sem cargo', guardaPlanoCobreArtefato([{ id: 'tipos-src' }, { id: 'transporte-vivo' }, { id: 'jornadas-e2e' }]), false],
    ['g7 reprova plano sem exe vivo', guardaPlanoCobreArtefato([{ id: 'rust-test' }, { id: 'jornadas-e2e' }, { id: 'servidor-limpo' }]), false],
    ['g7 reprova plano sem sonda de servidor', guardaPlanoCobreArtefato([{ id: 'rust-test' }, { id: 'jornadas-e2e' }, { id: 'transporte-vivo' }]), false],
    [
      'g7 reprova plano sem a medida sozinha da Invariante 6',
      guardaPlanoCobreArtefato([{ id: 'rust-test' }, { id: 'jornadas-e2e' }, { id: 'transporte-vivo' }, { id: 'servidor-limpo' }]),
      false,
    ],
    ['g7 aprova plano real', guardaPlanoCobreArtefato(PLANO), true],
    ['g8 reprova jornada inexistente', guardaJornadasExistem(['e2e/nao-existe-mesmo.spec.ts']), false],
  ]
  return casos.map(([nome, resultado, esperado]) => ({
    id: nome,
    ok: resultado.ok === esperado,
    detalhe: 'esperado ' + (esperado ? 'APROVA' : 'REPROVA') + ', veio ' + (resultado.ok ? 'APROVA' : 'REPROVA') + ' — ' + resultado.detalhe,
  }))
}

function imprimir(titulo, linhas) {
  process.stdout.write('\n== ' + titulo + ' ==\n')
  for (const l of linhas) {
    const marca = l.ok ? 'VERDE  ' : 'VERMELHO'
    const extra = l.endereco ? '  [' + l.endereco + ']' : ''
    process.stdout.write(marca + ' ' + l.id + ': ' + (l.detalhe || l.titulo || '') + extra + '\n')
  }
}

async function principal() {
  const argv = process.argv.slice(2)
  const so = (argv.find((a) => a.startsWith('--so=')) || '').slice(5)
  const json = argv.includes('--json')

  if (argv.includes('--listar')) {
    process.stdout.write(
      JSON.stringify(
        {
          raiz: RAIZ,
          url_jogador: URL_JOGADOR,
          jornadas_e2e: TODAS_JORNADAS_E2E,
          jornadas_unidade: JORNADAS_UNIDADE,
          plano: PLANO.map((p) => ({
            id: p.id,
            titulo: p.titulo,
            comando: p.sonda ? 'sonda HTTP interna' : [p.exe].concat(p.args).join(' '),
            cwd: p.cwd || RAIZ,
          })),
        },
        null,
        2,
      ) + '\n',
    )
    return 0
  }

  if (argv.includes('--autoteste')) {
    const r = rodarAutoteste()
    imprimir('autoteste das guardas', r)
    const maus = r.filter((x) => !x.ok)
    process.stdout.write('\n' + (maus.length === 0 ? 'TODAS as guardas reprovam a entrada ruim conhecida.' : maus.length + ' guarda(s) sem dente.') + '\n')
    return maus.length === 0 ? 0 : 1
  }

  const fase0 = rodarFase0()
  imprimir('FASE 0 — auditoria do portão', fase0)
  const fase0Ruim = fase0.filter((r) => !r.ok)

  if (argv.includes('--fase0')) {
    process.stdout.write('\n' + (fase0Ruim.length === 0 ? 'PORTÃO ÍNTEGRO' : 'PORTÃO COMPROMETIDO: ' + fase0Ruim.length + ' achado(s)') + '\n')
    return fase0Ruim.length === 0 ? 0 : 1
  }

  const passos = so ? PLANO.filter((p) => p.id === so) : PLANO
  if (so && passos.length === 0) {
    process.stderr.write('passo desconhecido: ' + so + '\n')
    return 2
  }

  const resultados = []
  for (const passo of passos) {
    const r = await rodarPasso(passo)
    resultados.push(r)
    process.stdout.write(
      (r.ok ? 'VERDE  ' : 'VERMELHO') + ' ' + r.id + ' (' + r.ms + ' ms, exit ' + r.codigo + ')' + (r.falsoVerde ? ' FALSO-VERDE: saiu 0 com ' + r.ruina.join(', ') : '') + ' — ' + r.titulo + '\n',
    )
  }

  fs.mkdirSync(SAIDA, { recursive: true })
  const relatorio = path.join(SAIDA, 'portao-' + Date.now() + '.json')
  fs.writeFileSync(relatorio, JSON.stringify({ fase0, passos: resultados }, null, 2), 'utf8')

  const ruins = resultados.filter((r) => !r.ok)
  if (json) process.stdout.write(JSON.stringify({ fase0, passos: resultados.map((r) => Object.assign({}, r, { saida: r.saida.slice(-4000) })) }, null, 2) + '\n')
  else for (const r of ruins) process.stdout.write('\n--- ' + r.id + ' ---\n' + r.saida.slice(-4000) + '\n')

  process.stdout.write('\nrelatório: ' + relatorio + '\n')
  process.stdout.write(fase0Ruim.length + ' achado(s) na FASE 0, ' + ruins.length + ' passo(s) vermelho(s)\n')
  return fase0Ruim.length === 0 && ruins.length === 0 ? 0 : 1
}

principal().then(
  (c) => process.exit(c),
  (e) => {
    process.stderr.write(String((e && e.stack) || e) + '\n')
    process.exit(2)
  },
)
