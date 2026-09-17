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
 *   node scripts/portao.cjs --selar      carimba o hash das jornadas da bar (ANTES dos builders)
 *
 * Variáveis: PORTAO_REPETICOES (1 na rodada comum, 3 na volta da vencedora).
 *
 * Escrita em disco: o relatório e os artefatos de jornada, os dois em
 * %TEMP%/portao-labirinto/, mais o selo em scripts/portao-selo.json. Nenhum
 * passo apaga ou sobrescreve dado do repositório nem do usuário.
 *
 * CORREÇÕES DE 17/09/2026 (a rodada que auditou o próprio portão):
 *   - Invariante 1 não tinha comando NENHUM: agora é medida em pixel
 *     (`task-portao-estilo-minimapa.spec.ts`), com controle positivo — ligar a
 *     grade e a hachura tem de REPROVAR a medida, senão o detector é cego.
 *   - Invariante 4 tinha um spec que passava com o app morto (estado injetado,
 *     `dispatchEvent`, prova lida da store): reescrito, e a guarda g9 recusa
 *     esse padrão em qualquer jornada nova.
 *   - Invariantes 5 e 9 (quem escreve onde, Rust intocado) não tinham comando:
 *     passo `particao`, contra o manifesto do orquestrador.
 *   - Invariante 6 (jornadas fixas) era inverificável — as jornadas da bar são
 *     untracked, o git não acusa edição: passo `jornadas-intactas`, por hash.
 *   - Invariante 3 só tinha teste com nome de campo escrito à mão: entrou
 *     `mapFile.invariante3.test.ts` e a guarda g13, que comparam o esquema de
 *     HEAD com o de agora.
 *   - Cada passo de jornada apagava a prova do anterior (o Playwright limpa o
 *     `outputDir`): agora cada um tem a sua pasta em %TEMP%.
 *   - Invariante 8 citava 5,9 GB de 476; a máquina tem 33,9 de 511. O portão
 *     mede (`disco`) em vez de repetir premissa velha.
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const { pathToFileURL } = require('url')

const RAIZ = path.resolve(__dirname, '..')
const CLIENTE = path.join(RAIZ, 'client')
const TAURI = path.join(RAIZ, 'desktop', 'src-tauri')
const SAIDA = path.join(os.tmpdir(), 'portao-labirinto')
/**
 * Uma pasta por passo de jornada. O Playwright APAGA o `outputDir` inteiro ao
 * começar, então rodar as jornadas uma a uma no `outputDir` padrão
 * (client/test-results) fazia cada passo destruir a prova do anterior — o
 * portão terminava com screenshot e trace só da última. Aqui cada passo recebe
 * `PORTAO_ARTEFATOS` próprio, em pasta temporária (Invariante 7).
 */
const ARTEFATOS = path.join(SAIDA, 'artefatos')
/** Selo do começo do run: hash das jornadas da bar e campos opcionais do esquema. */
const SELO = path.join(__dirname, 'portao-selo.json')
/** Quem pode escrever onde (Invariante 5), declarado pelo orquestrador. */
const PARTICAO = path.join(__dirname, 'portao-particao.json')
/**
 * Quantas vezes cada jornada roda. A interface das peças pede 1 na rodada
 * comum e 3 na volta em que a peça é declarada vencedora — repetir 3x sempre
 * triplicava o relógio de toda rodada sem acrescentar prova nenhuma até o fim.
 */
const REPETICOES = String(Number(process.env.PORTAO_REPETICOES || '1') || 1)
/** Piso de disco livre. A Invariante 8 declarava 5,9 GB de 476; a máquina tinha
 *  33,9 GB de 511 em 17/09/2026 — premissa velha, então o portão MEDE em vez de citar. */
const PISO_DE_DISCO_GB = 3

/**
 * Hash do CONTEÚDO, não do fim de linha. `core.autocrlf` é true nesta máquina:
 * a árvore principal fica com LF e todo `git worktree` novo nasce com CRLF, de
 * modo que o selo tirado aqui reprovava toda peça lá — vermelho por quebra de
 * linha, sem ninguém ter tocado na jornada. Normalizar CRLF para LF mede o que
 * a Invariante 6 quer medir: se o texto da jornada mudou.
 */
function sha256(texto) {
  const normalizado = String(texto).replace(/\r\n/g, '\n')
  return crypto.createHash('sha256').update(normalizado, 'utf8').digest('hex')
}

/** Roda git e devolve stdout, ou null quando o comando falha (arquivo novo, repo sem HEAD…). */
function git(args) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return r.status === 0 ? String(r.stdout) : null
}

/** Página do jogador servida pelo exe RELEASE na LAN — o artefato que está em julgamento. */
const URL_JOGADOR = process.env.PORTAO_URL_JOGADOR || 'http://192.168.0.6:7777/player'
const TIMEOUT_JOGADOR_MS = 8000
/**
 * Editor do mestre no servidor de desenvolvimento — o mesmo baseURL do
 * playwright.config.ts, derivado da árvore de trabalho (client/porta.js):
 * 1420 na principal, porta própria em cada worktree, para que dois portões em
 * paralelo não testem o mesmo servidor.
 *
 * `client/porta.js` é ESM (o vite empacota o config e um require de builtin em
 * CJS quebra o bundle), e este arquivo é CommonJS — então a porta vem de um
 * node curto, uma vez só, em vez de duas cópias da regra que divergem.
 */
function portaDaArvore() {
  const alvo = pathToFileURL(path.join(RAIZ, 'client', 'porta.js')).href
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', 'import(' + JSON.stringify(alvo) + ').then((m) => process.stdout.write(String(m.portaDoProjeto())))'],
    { encoding: 'utf8', timeout: 15000, windowsHide: true },
  )
  const n = Number(String(r.stdout || '').trim())
  return Number.isFinite(n) && n > 0 ? n : 1420
}
const URL_EDITOR = process.env.PORTAO_URL_EDITOR || 'http://localhost:' + portaDaArvore() + '/'
/** Os módulos que os specs importam dentro de `page.evaluate` — os que podem virar instância dupla. */
const MODULOS_DE_SPEC = ['/src/stores/mapStore.ts', '/src/lib/mapFactory.ts']

/**
 * As jornadas que a bar declarou, mais a desta peça. O portão roda cada uma 3
 * vezes (`--repeat-each=3`), que é o que a interface da peça pede.
 */
const JORNADAS_E2E = [
  'e2e/task-jornada-parede-grossa.spec.ts',
  'e2e/task-jornada-selecao-arrasto.spec.ts',
  'e2e/task-jornada-escada-legivel.spec.ts',
  'e2e/task-jornada-entrada-jogador.spec.ts',
  'e2e/task-jornada-nao-perder-trabalho.spec.ts',
  'e2e/task-jornada-gestos-centrais.spec.ts',
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
/**
 * Invariante 1 (estilo do minimapa de Resident Evil) e Invariante 4 (a vista
 * continua móvel) eram as duas que não tinham COMANDO nenhum: o estilo não era
 * medido em lugar algum, e o pan só tinha um spec que passava com o app morto
 * (estado injetado + `dispatchEvent` + prova lida da store). Estes dois
 * arquivos são o comando de cada uma.
 */
const JORNADA_ESTILO = 'e2e/task-portao-estilo-minimapa.spec.ts'
const JORNADA_VISTA_MOVEL = 'e2e/task-jornada-portao-vista-movel.spec.ts'
/**
 * As jornadas dos GESTOS da bar deste run — parede grossa, seleção por arrasto
 * e escada legível. São fixas (Invariante 6): nenhum builder pode editá-las, e
 * o passo `jornadas-intactas` confere isso por hash.
 */
const JORNADAS_DA_BAR = [
  'e2e/task-jornada-ferramentas-mudas.spec.ts',
  'e2e/task-jornada-luz-que-para-na-parede.spec.ts',
  'e2e/task-jornada-token-com-foto.spec.ts',
  'e2e/task-jornada-pincel-balde-caminhos.spec.ts',
  'e2e/task-jornada-sala-livre.spec.ts',
  'e2e/task-jornada-pinos-ponto-de-interesse.spec.ts',
]
/** Tudo que a FASE 0 audita arquivo a arquivo — a de fluidez inclusive. */
const TODAS_JORNADAS_E2E = JORNADAS_E2E.concat([JORNADA_FLUIDEZ, JORNADA_ESTILO, JORNADA_VISTA_MOVEL], JORNADAS_DA_BAR)
const JORNADAS_UNIDADE = [
  'src/lib/mapFile.persistencia.test.ts',
  'src/lib/mapFileIO.persistencia.test.ts',
  'src/lib/mapFactory.porta-tipo.test.ts',
  // Invariante 3 sem nome de campo escrito à mão: campo novo entra na
  // cobertura no mesmo commit em que nasce.
  'src/lib/mapFile.invariante3.test.ts',
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
  // `__emitTauri` e o stub de `net_*` falsificam o lado do MESTRE (o evento e os
  // comandos Rust que abrem a sala). Quando a MESMA jornada dirige a página do
  // jogador por `routeWebSocket` ligado à sessão REAL do host
  // (`createHostSession`), o que o jogador recebe vem do código de produção, não
  // de um switch de mentira: a jornada continua sendo prova de tela, e o
  // transporte de verdade é medido pelo passo `transporte-vivo` (exe release na
  // 7777), que é o lugar certo para isso. Sem esse par (socket real + host
  // real), os dois voltam a reprovar — jornada que fabrica TUDO não prova nada.
  const jogadorNoSocketReal = /routeWebSocket\s*\(/.test(texto) && /createHostSession\s*\(/.test(texto)
  if (/__emitTauri\s*\(/.test(texto) && !jogadorNoSocketReal) {
    marcas.push('__emitTauri (evento de transporte inventado na página)')
  }
  if (/case\s+'net_(start_room|send|kick|stop_room)'/.test(texto) && !jogadorNoSocketReal) {
    marcas.push("stub de invoke 'net_*'")
  }
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
  if (!plano.some((p) => p.id === 'estilo-minimapa')) faltando.push('nenhum passo mede a Invariante 1 (estilo do minimapa) em pixel')
  if (!plano.some((p) => p.id === 'jornada-vista-movel')) faltando.push('nenhum passo prova a Invariante 4 (a vista continua móvel)')
  if (!plano.some((p) => p.id === 'particao')) faltando.push('nenhum passo mede quem escreveu onde (Invariantes 5 e 9)')
  if (!plano.some((p) => p.id === 'jornadas-intactas')) faltando.push('nenhum passo confere se uma jornada da bar foi editada (Invariante 6)')
  if (!plano.some((p) => p.id === 'jornadas-da-bar')) faltando.push('nenhum passo roda os três gestos que a bar deste run pede')
  if (faltando.length > 0) return reprova('g7-plano-cobre-artefato', faltando.join('; '), 'scripts/portao.cjs (PLANO)')
  return ok('g7-plano-cobre-artefato', 'plano cobre tipos, unidade, Rust, jornadas e exe vivo')
}

/**
 * Prova por GESTO. Jornada que injeta estado (`loadMap`/`setState` dentro de um
 * `page.evaluate`), que fabrica o gesto com `dispatchEvent`, ou cuja ÚNICA
 * afirmação é lida da store, prova o que o app faz por dentro — não o que a
 * pessoa consegue fazer. Foi assim que `task-middle-button-pan.spec.ts` cobriu
 * a Invariante 4 por meses passando: estado injetado, PointerEvent sintético e
 * `expect(after.x).not.toBe(before.x)` lido do zustand.
 */
function guardaProvaPorGesto(arquivo, texto) {
  const marcas = []
  if (/dispatchEvent\s*\(\s*new\s+(Pointer|Mouse|Keyboard|Wheel)Event/.test(texto)) marcas.push('gesto fabricado com dispatchEvent')
  // Montar cenário pela store (um `loadMap` no beforeEach) é fraco, mas não é
  // mentira: o gesto julgado continua sendo o do ponteiro. O que este portão
  // recusa é a jornada que NUNCA olha a tela — aí a única testemunha é a store,
  // que pode estar duplicada por HMR e nem ser a que a interface usa.
  const olhaATela = /page\.screenshot\s*\(|getByRole\s*\(|getByText\s*\(|getByLabel\s*\(|toBeVisible\s*\(/.test(texto)
  if (!olhaATela) marcas.push('nenhuma asserção sobre o que está na tela')
  if (marcas.length > 0) return reprova('g9-prova-por-gesto', arquivo + ': ' + marcas.join('; '), arquivo)
  return ok('g9-prova-por-gesto', arquivo + ': gesto de ponteiro e prova na tela')
}

/**
 * A Invariante 1 (estilo do minimapa) precisa de um comando que MEÇA pixel, e
 * a Invariante 4 (a vista continua móvel) precisa de um que prove o pan por um
 * caminho que não seja arrastar no vazio. Texto de invariante sem arquivo que
 * a meça é preferência, não portão.
 */
function guardaInvariantes1e4TemComando(textos) {
  const faltando = []
  const mede = (predicado) => Object.keys(textos).some((a) => predicado(textos[a]))
  if (!mede((t) => /estaChapado|referenciaDeCor/.test(t))) faltando.push('Invariante 1: ninguém mede chão chapado nem cor de parede')
  // `'middle'` em vez de `button: 'middle'`: o botão costuma chegar ao
  // `page.mouse.down` por variável (`down({ button: botao })`), e cobrar o
  // literal colado fazia a guarda reprovar a jornada que EXISTE e mede certo.
  if (!mede((t) => /'middle'/.test(t) && /screenshot/.test(t))) faltando.push('Invariante 4: ninguém prova pan com botão do meio por pixel')
  if (!mede((t) => /keyboard\.down\(\s*' '\s*\)/.test(t))) faltando.push('Invariante 4: ninguém prova o pan por Espaço+arrastar')
  if (faltando.length > 0) return reprova('g10-invariantes-1-e-4', faltando.join('; '), 'INVARIANTES itens 1 e 4')
  return ok('g10-invariantes-1-e-4', 'estilo e vista móvel têm comando')
}

/**
 * A sonda do servidor limpo tem de vir ANTES de qualquer passo de Playwright.
 * Depois não serve: as jornadas já teriam rodado contra o vite com módulo
 * duplicado por HMR, e o relatório sairia com verde (ou vermelho) de mentira.
 */
function guardaOrdemDoPlano(plano) {
  const ondeSonda = plano.findIndex((p) => p.id === 'servidor-limpo')
  const primeiroE2e = plano.findIndex((p) => Array.isArray(p.args) && p.args.some((a) => String(a).indexOf('playwright') !== -1))
  if (ondeSonda === -1) return reprova('g11-ordem-do-plano', 'não há passo `servidor-limpo`', 'scripts/portao.cjs (PLANO)')
  if (primeiroE2e !== -1 && ondeSonda > primeiroE2e) {
    return reprova('g11-ordem-do-plano', 'a sonda do servidor roda DEPOIS das jornadas — tarde demais para valer', 'scripts/portao.cjs (PLANO)')
  }
  return ok('g11-ordem-do-plano', 'servidor-limpo vem antes das jornadas')
}

/**
 * Invariante 6: as jornadas da bar são FIXAS. Como elas nascem untracked, o
 * `git status` não acusa edição nenhuma — um builder podia afrouxar a própria
 * jornada e o portão nem piscava. O selo guarda o hash de cada uma no começo
 * do run (`--selar`), e esta guarda compara.
 */
function guardaJornadasIntactas(selo, textos) {
  if (!selo || !selo.jornadas) {
    return reprova('g12-jornadas-intactas', 'sem selo: rode `node scripts/portao.cjs --selar` ANTES dos builders', 'scripts/portao-selo.json')
  }
  const problemas = []
  for (const arquivo of Object.keys(selo.jornadas)) {
    const texto = textos[arquivo]
    if (texto === undefined) {
      problemas.push(arquivo + ' sumiu depois do selo')
      continue
    }
    if (sha256(texto) !== selo.jornadas[arquivo]) problemas.push(arquivo + ' MUDOU depois do selo')
  }
  if (problemas.length > 0) return reprova('g12-jornadas-intactas', problemas.join('; '), 'client/e2e')
  return ok('g12-jornadas-intactas', Object.keys(selo.jornadas).length + ' jornada(s) da bar com o hash do selo')
}

/**
 * Invariante 3, lado do esquema: campo OPCIONAL novo em `types/map.ts` tem de
 * aparecer na migração de `lib/mapFile.ts` — ou dizer, no próprio comentário,
 * por que a ausência já é o default ("undefined === …", "sem linha de
 * migração", o vocabulário que o arquivo já usa). Campo novo em silêncio é
 * mapa antigo abrindo diferente do que a pessoa salvou.
 */
function camposOpcionais(textoDeTipos) {
  const campos = []
  const linhas = textoDeTipos.split('\n')
  for (let i = 0; i < linhas.length; i++) {
    const achado = /^\s{2,}([a-zA-Z_][\w]*)\?:/.exec(linhas[i])
    if (!achado) continue
    const contexto = linhas.slice(Math.max(0, i - 14), i + 1).join('\n')
    campos.push({ nome: achado[1], isento: /undefined\s*===|sem linha de migração/i.test(contexto) })
  }
  return campos
}

function guardaCamposNovosMigrados(textoDeTiposBase, textoDeTiposAtual, textoDaMigracao) {
  const antes = new Set(camposOpcionais(textoDeTiposBase).map((c) => c.nome))
  const novos = camposOpcionais(textoDeTiposAtual).filter((c) => !antes.has(c.nome))
  const orfaos = novos.filter((c) => !c.isento && textoDaMigracao.indexOf(c.nome) === -1).map((c) => c.nome)
  if (orfaos.length > 0) {
    return reprova(
      'g13-campo-novo-migrado',
      'campo(s) opcional(is) novo(s) sem default na migração nem isenção documentada: ' + orfaos.join(', '),
      'client/src/types/map.ts + client/src/lib/mapFile.ts',
    )
  }
  return ok('g13-campo-novo-migrado', novos.length + ' campo(s) opcional(is) novo(s) neste run, todos tratados')
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

/**
 * Um passo de jornada. Todos iguais no que importa: exit code real, detector de
 * falso-verde, `--repeat-each` vindo de `PORTAO_REPETICOES` e pasta de
 * artefato PRÓPRIA — sem isso um passo apaga a prova do outro (ver ARTEFATOS).
 */
function jornada(id, titulo, arquivos, extras) {
  return {
    id,
    titulo: titulo + ' (' + REPETICOES + 'x cada)',
    exe: process.execPath,
    args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--repeat-each=' + REPETICOES, '--reporter=list']
      .concat(extras || [])
      .concat(arquivos),
    cwd: CLIENTE,
    artefatos: true,
    ruina: [/\b\d+ skipped\b/, /\b\d+ flaky\b/, /\bdid not run\b/, /\b\d+ failed\b/],
    // Prova positiva: relatório sem nenhuma linha "N passed" é relatório de
    // suíte que não rodou — e exit 0 nesse caso é o falso-verde mais barato.
    exige: [/\b[1-9]\d* passed\b/],
  }
}

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
    id: 'particao',
    titulo: 'Invariantes 5 e 9: quem escreveu onde (partição declarada, Rust intocado)',
    sonda: sondarParticao,
  },
  {
    id: 'rust-intocado',
    titulo: 'Invariante 9 sozinha: nenhuma peça tocou o lado Rust',
    sonda: sondarRustIntocado,
  },
  {
    id: 'jornadas-intactas',
    titulo: 'Invariante 6: as jornadas da bar continuam com o hash do selo',
    sonda: sondarJornadasIntactas,
  },
  {
    id: 'disco',
    titulo: 'Invariante 8 MEDIDA (a premissa declarada estava velha)',
    sonda: sondarDisco,
  },
  jornada('estilo-minimapa', 'Invariante 1 medida em pixel (chão chapado, parede clara e fina, sem grade)', [JORNADA_ESTILO]),
  jornada('jornada-vista-movel', 'Invariante 4: a vista continua móvel por botão do meio e por Espaço+arrastar', [JORNADA_VISTA_MOVEL]),
  jornada('jornadas-e2e', 'jornadas já entregues, com ponteiro real', JORNADAS_E2E),
  jornada('jornadas-da-bar', 'os gestos que a bar deste run pede (luz, token com foto, pincel e balde, sala livre, pinos)', JORNADAS_DA_BAR),
  jornada('jornada-fluidez', 'Invariante 6 medida com a máquina só para ela (workers=1)', [JORNADA_FLUIDEZ], ['--workers=1']),
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
 * Invariantes 5 e 9 — "cada peça escreve SOMENTE nos arquivos listados nela" e
 * "o lado Rust não é tocado por nenhuma peça deste run".
 *
 * Nenhum passo media isso: as peças rodam na MESMA árvore de trabalho, e duas
 * escritas no mesmo arquivo se sobrescrevem sem erro nenhum. Aqui o portão
 * pergunta ao git o que mudou e cobra um dono declarado para cada arquivo.
 *
 * O manifesto (scripts/portao-particao.json) é do ORQUESTRADOR, não deste
 * arquivo: o portão não adivinha a partição, ele exige que ela exista e bate a
 * lista contra a realidade. Arquivo mudado sem dono é vermelho com nome e
 * endereço — é a pergunta "quem escreveu isto?" virando comando.
 */
/**
 * Invariante 9 sozinha — o lado Rust não é tocado por nenhuma peça.
 *
 * O passo `particao` já media isso, mas junto com a Invariante 5 (quem escreve
 * onde), que só faz sentido quando as peças dividem a MESMA árvore. Com cada
 * peça no próprio `git worktree`, a partição é garantida pelo isolamento e o
 * manifesto não tem como declarar arquivo compartilhado sem acusar disputa —
 * então a Invariante 9 ficava sem comando nenhum. Aqui ela tem o dela, e roda
 * em qualquer modo.
 */
function sondarRustIntocado() {
  return Promise.resolve().then(() => {
    const mudados = git(['status', '--porcelain'])
    if (mudados === null) return { codigo: 1, saida: 'git status falhou: sem repositório?' }
    const arquivos = mudados
      .split('\n')
      .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/\\/g, '/'))
    const rust = arquivos.filter(
      (a) => a.startsWith('desktop/') || a.endsWith('.rs') || a.endsWith('Cargo.toml') || a.endsWith('Cargo.lock'),
    )
    return {
      codigo: rust.length === 0 ? 0 : 1,
      saida:
        rust.length === 0
          ? arquivos.length + ' arquivo(s) mudado(s), nenhum do lado Rust'
          : 'Invariante 9 violada — lado Rust tocado: ' + rust.join(', '),
    }
  })
}

function sondarParticao() {
  return Promise.resolve().then(() => {
    const mudados = git(['status', '--porcelain'])
    if (mudados === null) return { codigo: 1, saida: 'git status falhou: sem repositório?' }
    const arquivos = mudados
      .split('\n')
      .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
      .filter((l) => l.length > 0)
      .map((l) => l.replace(/\\/g, '/'))

    const problemas = []
    const rust = arquivos.filter((a) => a.startsWith('desktop/') || a.endsWith('.rs') || a.endsWith('Cargo.toml') || a.endsWith('Cargo.lock'))
    if (rust.length > 0) problemas.push('Invariante 9 violada — lado Rust tocado: ' + rust.join(', '))

    let manifesto = null
    try {
      manifesto = JSON.parse(fs.readFileSync(PARTICAO, 'utf8'))
    } catch (e) {
      return {
        codigo: 1,
        saida:
          'sem manifesto de partição em scripts/portao-particao.json (' + e.message + ').\n' +
          'A Invariante 5 não é verificável enquanto ninguém declarar quem escreve onde.\n' +
          'Arquivos mudados agora, para o orquestrador distribuir entre as peças:\n  ' +
          arquivos.join('\n  '),
      }
    }

    const donos = new Map()
    for (const peca of Object.keys(manifesto.pecas || {})) {
      for (const arquivo of manifesto.pecas[peca]) {
        if (!donos.has(arquivo)) donos.set(arquivo, [])
        donos.get(arquivo).push(peca)
      }
    }
    const disputados = Array.from(donos.keys()).filter((a) => donos.get(a).length > 1)
    if (disputados.length > 0) {
      problemas.push('arquivo declarado por DUAS peças (a segunda escrita apaga a primeira em silêncio): ' + disputados.map((a) => a + ' [' + donos.get(a).join(' e ') + ']').join('; '))
    }

    const semDono = arquivos.filter((a) => !donos.has(a) && !(manifesto.livres || []).includes(a))
    if (semDono.length > 0) problemas.push('arquivo mudado sem dono declarado: ' + semDono.join(', '))

    return {
      codigo: problemas.length === 0 ? 0 : 1,
      saida:
        arquivos.length + ' arquivo(s) mudado(s); ' + donos.size + ' com dono declarado\n' +
        (problemas.length === 0 ? 'partição respeitada e Rust intocado' : problemas.join('\n')),
    }
  })
}

/** Invariante 6 — as jornadas da bar são fixas; o selo guarda o hash delas. */
function sondarJornadasIntactas() {
  return Promise.resolve().then(() => {
    const textos = {}
    for (const arquivo of JORNADAS_DA_BAR) {
      const absoluto = path.join(CLIENTE, arquivo)
      if (fs.existsSync(absoluto)) textos[arquivo] = fs.readFileSync(absoluto, 'utf8')
    }
    let selo = null
    try {
      selo = JSON.parse(fs.readFileSync(SELO, 'utf8'))
    } catch (e) {
      return { codigo: 1, saida: 'sem selo (' + e.message + '). Rode `node scripts/portao.cjs --selar` ANTES dos builders.' }
    }
    const r = guardaJornadasIntactas(selo, textos)
    return { codigo: r.ok ? 0 : 1, saida: r.detalhe + '\nselo de ' + (selo.selado_em || '?') }
  })
}

/**
 * Invariante 8 — a bar declarou "cerca de 5,9 GB livres em C: de 476 GB". A
 * máquina tinha 33,9 GB de 511 em 17/09/2026: a premissa estava velha. Premissa
 * velha não se copia para o relatório, se mede.
 */
function sondarDisco() {
  return Promise.resolve().then(() => {
    const estado = fs.statfsSync(RAIZ)
    const livreGb = (estado.bfree * estado.bsize) / 1e9
    const totalGb = (estado.blocks * estado.bsize) / 1e9
    return {
      codigo: livreGb >= PISO_DE_DISCO_GB ? 0 : 1,
      saida:
        'livre ' + livreGb.toFixed(2) + ' GB de ' + totalGb.toFixed(2) + ' GB (piso do portão: ' + PISO_DE_DISCO_GB + ' GB)' +
        (livreGb < PISO_DE_DISCO_GB ? '\nabaixo do piso: worktree, build e trace não cabem — pare antes de encher o disco' : ''),
    }
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
    })().catch((e) => {
      const msg = String((e && e.message) || e)
      // Servidor NO AR com módulo duplicado é o defeito que esta sonda existe
      // para pegar. Servidor ausente não é defeito nenhum desde 17/09/2026: o
      // `playwright.config.ts` passou a subir um servidor novo por invocação
      // (`reuseExistingServer` desligado), então não há histórico de HMR para
      // contaminar spec. Reprovar por ausência transformava este passo em
      // vermelho permanente fora de uma sessão de `npm run dev` aberta.
      if (/ERR_CONNECTION_REFUSED|ECONNREFUSED|net::ERR_CONNECTION_RESET/.test(msg)) {
        resolve({ codigo: 0, saida: 'nenhum servidor no ar em ' + URL_EDITOR + ': nada para duplicar; as jornadas sobem servidor novo' })
        return
      }
      resolve({ codigo: 1, saida: 'sonda do servidor falhou: ' + msg })
    })
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
    // Pasta de artefato própria por passo: o Playwright limpa o `outputDir` ao
    // começar, então sem isto cada jornada apagaria o screenshot e o trace da
    // anterior. Sempre em %TEMP% (Invariante 7: nada fora de pasta temporária).
    const ambiente = Object.assign({}, process.env)
    if (passo.artefatos) ambiente.PORTAO_ARTEFATOS = path.join(ARTEFATOS, passo.id + '-' + t0)
    const r = spawnSync(passo.exe, passo.args, {
      cwd: passo.cwd,
      encoding: 'utf8',
      shell: Boolean(passo.shell),
      env: ambiente,
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
  resultados.push(guardaInvariantes1e4TemComando(textos))
  resultados.push(guardaOrdemDoPlano(PLANO))

  let selo = null
  try {
    selo = JSON.parse(fs.readFileSync(SELO, 'utf8'))
  } catch (e) {
    selo = null
  }
  resultados.push(guardaJornadasIntactas(selo, textos))

  // Base do esquema = o `types/map.ts` do último commit, não um arquivo selado
  // à mão: é exatamente "o que existia antes deste run", sem ninguém precisar
  // lembrar de carimbar nada.
  const tiposBase = git(['show', 'HEAD:client/src/types/map.ts'])
  const tiposAtual = fs.readFileSync(path.join(CLIENTE, 'src', 'types', 'map.ts'), 'utf8')
  const migracao = fs.readFileSync(path.join(CLIENTE, 'src', 'lib', 'mapFile.ts'), 'utf8')
  if (tiposBase === null) {
    resultados.push(reprova('g13-campo-novo-migrado', 'git show HEAD:client/src/types/map.ts falhou — sem base de esquema para comparar', 'client/src/types/map.ts'))
  } else {
    resultados.push(guardaCamposNovosMigrados(tiposBase, tiposAtual, migracao))
  }

  for (const arquivo of Object.keys(textos)) {
    resultados.push(guardaSemOnlyNemSkip(arquivo, textos[arquivo]))
    resultados.push(guardaTetoSemControle(arquivo, textos[arquivo]))
    if (arquivo.endsWith('.spec.ts')) resultados.push(guardaTransporteFalsificado(arquivo, textos[arquivo]))
    if (arquivo.endsWith('.spec.ts')) resultados.push(guardaProvaPorGesto(arquivo, textos[arquivo]))
  }
  return resultados
}

/**
 * Sela o começo do run: hash das jornadas da bar (Invariante 6). Rodar ANTES
 * dos builders — selo tirado depois carimba a jornada já afrouxada.
 */
function selar() {
  const jornadas = {}
  const faltando = []
  for (const arquivo of JORNADAS_DA_BAR) {
    const absoluto = path.join(CLIENTE, arquivo)
    if (!fs.existsSync(absoluto)) {
      faltando.push(arquivo)
      continue
    }
    jornadas[arquivo] = sha256(fs.readFileSync(absoluto, 'utf8'))
  }
  const selo = { selado_em: new Date().toISOString(), jornadas }
  fs.writeFileSync(SELO, JSON.stringify(selo, null, 2) + '\n', 'utf8')
  return { selo, faltando }
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
    [
      'g9 reprova gesto fabricado com dispatchEvent',
      guardaProvaPorGesto('x', "canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))\npage.screenshot()"),
      false,
    ],
    ['g9 reprova spec que nunca olha a tela', guardaProvaPorGesto('x', 'await page.mouse.down(); expect(store.camera.x).toBe(1)'), false],
    ['g9 aprova gesto real com prova na tela', guardaProvaPorGesto('x', "await page.mouse.down({ button: 'middle' })\nawait page.screenshot({ clip })"), true],
    ['g10 reprova sem comando de estilo nem de vista', guardaInvariantes1e4TemComando({ 'a.spec.ts': 'expect(1).toBe(1)' }), false],
    [
      'g10 aprova com estilo e vista medidos',
      guardaInvariantes1e4TemComando({
        'a.spec.ts': "estaChapado(page, 1, 2, 3, 4); referenciaDeCor(page, '#2b2b2b')",
        'b.spec.ts': "page.mouse.down({ button: 'middle' }); page.screenshot(); page.keyboard.down(' ')",
      }),
      true,
    ],
    [
      'g11 reprova sonda de servidor depois das jornadas',
      guardaOrdemDoPlano([{ id: 'jornadas-e2e', args: ['cli.js/playwright', 'test'] }, { id: 'servidor-limpo' }]),
      false,
    ],
    ['g11 aprova plano real', guardaOrdemDoPlano(PLANO), true],
    ['g12 reprova sem selo', guardaJornadasIntactas(null, {}), false],
    [
      'g12 reprova jornada editada depois do selo',
      guardaJornadasIntactas({ jornadas: { 'e2e/j.spec.ts': sha256('original') } }, { 'e2e/j.spec.ts': 'afrouxada' }),
      false,
    ],
    [
      'g12 aprova jornada intacta',
      guardaJornadasIntactas({ jornadas: { 'e2e/j.spec.ts': sha256('original') } }, { 'e2e/j.spec.ts': 'original' }),
      true,
    ],
    [
      'g13 reprova campo novo sem default nem isenção',
      guardaCamposNovosMigrados('interface Wall {\n  id: string\n}', 'interface Wall {\n  id: string\n  espessuraNova?: number\n}', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 aprova campo novo com default na migração',
      guardaCamposNovosMigrados(
        'interface Wall {\n  id: string\n}',
        'interface Wall {\n  id: string\n  espessuraNova?: number\n}',
        'espessuraNova: parsed.espessuraNova ?? 1',
      ),
      true,
    ],
    [
      'g13 aprova campo novo com ausência documentada',
      guardaCamposNovosMigrados(
        'interface Wall {\n  id: string\n}',
        'interface Wall {\n  id: string\n  /** `undefined` === 1, sem linha de migração. */\n  espessuraNova?: number\n}',
        'return { id: parsed.id }',
      ),
      true,
    ],
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

  if (argv.includes('--selar')) {
    const { selo, faltando } = selar()
    process.stdout.write('selo escrito em ' + SELO + '\n' + JSON.stringify(selo, null, 2) + '\n')
    if (faltando.length > 0) process.stdout.write('\nATENÇÃO — jornada da bar ausente no selo: ' + faltando.join(', ') + '\n')
    return faltando.length === 0 ? 0 : 1
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
