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
 * O QUE ESTA RODADA CONSERTOU (17/09/2026), cada item com o achado que o gerou:
 *
 *   a. O "gate 4" era um comando de playwright montado à mão no terminal do
 *      orquestrador, com filtro de exclusão que morria junto com a sessão. Ele
 *      não reproduzia o próprio baseline (2 de 2 execuções vermelhas, com
 *      CONJUNTOS DE FALHA DIFERENTES) e ninguém conseguia dizer o que ficara de
 *      fora. Agora a bateria é o passo `regressao` daqui: a lista sai do
 *      diretório `client/e2e`, as exclusões estão declaradas em
 *      EXCLUSOES_DA_BATERIA com motivo e endereço, e uma guarda (g10) reprova
 *      exclusão muda.
 *   b. A jornada de FLUIDEZ rodava dentro dessa bateria, com 4 workers. O
 *      número que saía era o da máquina carregada, e ia para o relatório como
 *      se fosse do app. Ela tem passo próprio com `--workers=1`, está fora da
 *      bateria (g11) e o próprio arquivo reprova se for medido acompanhado.
 *   c. A sonda de servidor limpo abria `localhost:1420` — o checkout errado.
 *      O endereço agora sai do `baseURL` do playwright.config DESTE checkout
 *      (g9), que é a mesma fonte das jornadas.
 *   d. `PORTAO_SERVIDOR_LIMPO=1` não era conferido de forma nenhuma: no modo de
 *      servidor novo a sonda agora exige a porta do baseURL LIVRE, em vez de
 *      certificar o servidor velho de outra pessoa.
 *   e. A partição de arquivos entre as peças não existia: a Invariante 4 ("cada
 *      peça escreve só nos arquivos dela") não tinha comando. Passo `particao`
 *      + `scripts/portao-particao.json`, que é do ORQUESTRADOR.
 *   f. `task-jornada-ferramentas-mudas.spec.ts` estava excluída do gate e cobre
 *      o assunto de DUAS peças deste run. Voltou para a bateria; g10 proíbe
 *      excluir jornada de peça.
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
const net = require('net')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

const RAIZ = path.resolve(__dirname, '..')
const CLIENTE = path.join(RAIZ, 'client')
const TAURI = path.join(RAIZ, 'desktop', 'src-tauri')
const SAIDA = path.join(os.tmpdir(), 'portao-labirinto')
const CONFIG_PLAYWRIGHT = path.join(CLIENTE, 'playwright.config.ts')
const PARTICAO = path.join(__dirname, 'portao-particao.json')

/** Página do jogador servida pelo exe RELEASE na LAN — o artefato que está em julgamento. */
const URL_JOGADOR = process.env.PORTAO_URL_JOGADOR || 'http://192.168.0.6:7777/player'
const TIMEOUT_JOGADOR_MS = 8000

/**
 * O endereço do editor NÃO é escrito à mão aqui.
 *
 * Estava: `'http://localhost:1420/'`. Este checkout serve na 1437
 * (`client/playwright.config.ts`, `use.baseURL`), e cada worktree do projeto
 * tem a porta dele. Com a constante fixa, a sonda `servidor-limpo` abria o
 * EDITOR DE OUTRO CHECKOUT: ou não achava nada (vermelho enganoso), ou —
 * pior — encontrava um vite alheio limpo e dava VERDE para um servidor que
 * jornada nenhuma deste run usa. O portão certificava o checkout errado.
 *
 * A única fonte é o `baseURL` do playwright.config deste checkout: o mesmo
 * lugar de onde as jornadas tiram o endereço delas.
 */
function baseUrlDoPlaywright() {
  const texto = fs.readFileSync(CONFIG_PLAYWRIGHT, 'utf8')
  const achado = /baseURL\s*:\s*['"]([^'"]+)['"]/.exec(texto)
  if (!achado) throw new Error('client/playwright.config.ts não declara use.baseURL — sem endereço, o portão não tem o que sondar')
  return achado[1].replace(/\/+$/, '') + '/'
}

const URL_EDITOR = process.env.PORTAO_URL_EDITOR || baseUrlDoPlaywright()
/** Os módulos que os specs importam dentro de `page.evaluate` — os que podem virar instância dupla. */
const MODULOS_DE_SPEC = ['/src/stores/mapStore.ts', '/src/lib/mapFactory.ts']
/** `PORTAO_SERVIDOR_LIMPO=1` manda o Playwright subir servidor próprio (playwright.config.ts). */
const EXIGE_SERVIDOR_NOVO = process.env.PORTAO_SERVIDOR_LIMPO === '1'

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

/**
 * As jornadas das PEÇAS deste run — os seis pontos em que a tela mente ou fica
 * muda, mais a jornada do próprio portão. Cada uma é o comando que prova a peça
 * dela; ficar de fora do portão é a peça não ser julgada.
 */
const JORNADAS_DAS_PECAS = [
  'e2e/task-jornada-peca-muda.spec.ts',
  'e2e/task-jornada-previa-honesta.spec.ts',
  'e2e/task-jornada-token-no-lugar.spec.ts',
  'e2e/task-jornada-sala-de-verdade.spec.ts',
  'e2e/task-jornada-barra-honesta.spec.ts',
  'e2e/task-jornada-painel-com-nome-certo.spec.ts',
  'e2e/task-jornada-portao-honesto.spec.ts',
]

/** Tudo que a FASE 0 audita arquivo a arquivo — a de fluidez e as das peças inclusive. */
const TODAS_JORNADAS_E2E = JORNADAS_E2E.concat([JORNADA_FLUIDEZ]).concat(JORNADAS_DAS_PECAS)
const JORNADAS_UNIDADE = [
  'src/lib/mapFile.persistencia.test.ts',
  'src/lib/mapFileIO.persistencia.test.ts',
  'src/lib/mapFactory.porta-tipo.test.ts',
]

/**
 * Quantos workers a BATERIA DE REGRESSÃO usa. Passado na linha de comando, que
 * vence a config — o número mora aqui, num lugar só.
 *
 * Medido em 17/09/2026 neste worktree: com 4 workers a bateria saiu vermelha em
 * 2 de 2 execuções e com CONJUNTOS DE FALHA DIFERENTES. Conjunto que troca a
 * cada rodada é saturação (cada worker sobe outro Pixi/WebGL no mesmo vite
 * dev), não regressão — e um baseline que não reproduz não distingue vermelho
 * de peça de vermelho de máquina. Metade, pela mesma alavanca que já levou 10
 * para 4. AINDA NÃO MEDIDO: quem rodar a bateria mede; se 2 também não
 * reproduzir, o passo seguinte é 1.
 */
const WORKERS_BATERIA = Number(process.env.PORTAO_WORKERS || 2)

/**
 * O QUE A BATERIA DE REGRESSÃO NÃO COBRE — declarado, com motivo e endereço.
 *
 * Um filtro de exclusão escrito na linha de comando do orquestrador some junto
 * com o terminal, e ninguém mais sabe o que ficou de fora. Aqui cada exclusão
 * tem de dizer POR QUÊ e ONDE; a guarda `g10-exclusoes-declaradas` reprova
 * exclusão sem motivo, exclusão de arquivo que não existe mais (lista podre) e
 * — principalmente — exclusão de jornada que é assunto de uma PEÇA deste run.
 *
 * Foi exatamente isso que tinha acontecido com `task-jornada-ferramentas-mudas`:
 * ela cobre o assunto de DUAS peças desta tarefa (a ferramenta Peça e o mapa
 * novo com grade) e estava fora do gate. Peça julgada por um portão que não
 * roda a jornada do assunto dela não foi julgada. Ela voltou para a bateria.
 */
const EXCLUSOES_DA_BATERIA = [
  {
    arquivo: 'e2e/task-alignment-door-curve-portal.spec.ts',
    motivo: 'já vermelho em HEAD antes deste run (link de cenário), e nenhuma peça deste run toca o assunto',
    endereco: 'e2e/task-alignment-door-curve-portal.spec.ts',
  },
  {
    arquivo: 'e2e/task-fluxo-consertos.spec.ts',
    motivo: 'já vermelho em HEAD antes deste run ("Voltar do andar salva"; Ctrl+A e Ctrl+O), assunto de nenhuma peça deste run',
    endereco: 'e2e/task-fluxo-consertos.spec.ts',
  },
  {
    arquivo: JORNADA_FLUIDEZ,
    motivo: 'medida de fluidez só vale com a máquina sozinha — roda no passo `jornada-fluidez` com --workers=1',
    coberto_em: 'jornada-fluidez',
  },
].concat(
  JORNADAS_E2E.map((a) => ({ arquivo: a, motivo: 'roda no passo `jornadas-e2e`, com repetição', coberto_em: 'jornadas-e2e' })),
).concat(
  JORNADAS_DAS_PECAS.map((a) => ({ arquivo: a, motivo: 'roda no passo `jornadas-das-pecas`, com repetição', coberto_em: 'jornadas-das-pecas' })),
)

/** Todo `*.spec.ts` de `client/e2e`, menos o que está declarado em EXCLUSOES_DA_BATERIA. */
function bateriaDeRegressao() {
  const dir = path.join(CLIENTE, 'e2e')
  const fora = new Set(EXCLUSOES_DA_BATERIA.map((e) => e.arquivo))
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.spec.ts'))
    .map((n) => 'e2e/' + n)
    .filter((a) => !fora.has(a))
    .sort()
}

function sha256(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex')
}

function git(args) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' })
  if (r.status !== 0) return null
  return String(r.stdout || '')
}

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
  // Sem estes dois o portão julga peça sem rodar a jornada da peça, e deixa a
  // Invariante 4 (quem escreve onde) sem comando nenhum.
  if (!plano.some((p) => p.id === 'jornadas-das-pecas')) faltando.push('nenhum passo roda as jornadas das peças deste run')
  if (!plano.some((p) => p.id === 'particao')) faltando.push('nenhum passo confere a partição de arquivos entre as peças')
  if (!plano.some((p) => p.id === 'regressao')) faltando.push('nenhum passo roda a bateria de regressão do resto da suíte')
  if (faltando.length > 0) return reprova('g7-plano-cobre-artefato', faltando.join('; '), 'scripts/portao.cjs (PLANO)')
  return ok('g7-plano-cobre-artefato', 'plano cobre tipos, unidade, Rust, partição, jornadas, regressão e exe vivo')
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

/**
 * Endereço escrito à mão no portão certifica o checkout errado. O editor que a
 * sonda abre tem de ser o MESMO `baseURL` que as jornadas usam — e este
 * checkout tem porta própria (Invariante 9).
 */
function guardaEnderecoDoConfig(textoConfig, urlUsada) {
  const achado = /baseURL\s*:\s*['"]([^'"]+)['"]/.exec(textoConfig)
  if (!achado) {
    return reprova('g9-endereco-do-config', 'playwright.config.ts não declara use.baseURL', 'client/playwright.config.ts')
  }
  const doConfig = achado[1].replace(/\/+$/, '') + '/'
  if (doConfig !== urlUsada) {
    return reprova(
      'g9-endereco-do-config',
      'o portão sonda ' + urlUsada + ' e as jornadas usam ' + doConfig + ' — são checkouts diferentes',
      'scripts/portao.cjs (URL_EDITOR) x client/playwright.config.ts (use.baseURL)',
    )
  }
  return ok('g9-endereco-do-config', 'editor e jornadas no mesmo endereço, tirado do config: ' + urlUsada)
}

/**
 * Exclusão de bateria é dívida: só vale declarada, com motivo e endereço, e
 * NUNCA sobre o assunto de uma peça que este run vai julgar.
 */
function guardaExclusoesDeclaradas(exclusoes, jornadasDasPecas, existe) {
  const problemas = []
  for (const e of exclusoes) {
    if (!e || !e.arquivo) {
      problemas.push('exclusão sem arquivo')
      continue
    }
    if (!e.motivo) problemas.push(e.arquivo + ' excluído sem motivo declarado')
    if (!e.coberto_em && !e.endereco) problemas.push(e.arquivo + ' excluído sem endereço e sem passo do portão que o cubra')
    if (!existe(e.arquivo)) problemas.push(e.arquivo + ' não existe — lista de exclusão podre')
    if (jornadasDasPecas.indexOf(e.arquivo) !== -1 && !e.coberto_em) {
      problemas.push(e.arquivo + ' é jornada de peça deste run e está fora do portão — a peça não seria julgada')
    }
  }
  if (problemas.length > 0) return reprova('g10-exclusoes-declaradas', problemas.join('; '), 'scripts/portao.cjs (EXCLUSOES_DA_BATERIA)')
  return ok('g10-exclusoes-declaradas', exclusoes.length + ' exclusão(ões), cada uma com motivo e com passo que cubra ou endereço')
}

/**
 * A jornada de fluidez dentro da bateria mede a máquina carregada, não o app —
 * e o número ia para o relatório como se fosse do app. Ela tem passo próprio,
 * com `--workers=1`; na bateria ela não pode estar.
 */
function guardaFluidezForaDaBateria(bateria, fluidez) {
  if (bateria.indexOf(fluidez) !== -1) {
    return reprova(
      'g11-fluidez-fora-da-bateria',
      fluidez + ' está na bateria de regressão: com mais de um worker o longtask medido é o da máquina',
      'scripts/portao.cjs (EXCLUSOES_DA_BATERIA) + client/e2e/task-jornada-portao-fluidez.spec.ts (WORKERS_EXIGIDOS)',
    )
  }
  return ok('g11-fluidez-fora-da-bateria', 'a fluidez roda no passo próprio, com a máquina só para ela')
}

/**
 * Sonda de servidor limpo DEPOIS das jornadas não serve para nada: quando ela
 * acusa a store duplicada, as asserções já foram dadas como boas.
 */
function guardaOrdemDoPlano(plano) {
  const ids = plano.map((p) => p.id)
  const limpo = ids.indexOf('servidor-limpo')
  const primeiraJornada = ids.findIndex((id) => id === 'jornadas-e2e' || id === 'jornadas-das-pecas' || id === 'regressao' || id === 'jornada-fluidez')
  if (limpo === -1) return reprova('g12-ordem-do-plano', 'sem passo servidor-limpo', 'scripts/portao.cjs (PLANO)')
  if (primeiraJornada === -1) return reprova('g12-ordem-do-plano', 'sem nenhum passo de jornada', 'scripts/portao.cjs (PLANO)')
  if (limpo > primeiraJornada) {
    return reprova('g12-ordem-do-plano', 'servidor-limpo roda DEPOIS das jornadas — o aviso chega tarde demais', 'scripts/portao.cjs (PLANO)')
  }
  return ok('g12-ordem-do-plano', 'servidor-limpo vem antes de qualquer jornada')
}

/**
 * Invariante 4 do run ("cada peça escreve só nos arquivos dela") não é
 * verificável sem alguém declarar quem escreve onde: as peças rodam na MESMA
 * árvore e duas escritas no mesmo arquivo se sobrescrevem sem erro nenhum. O
 * manifesto é do ORQUESTRADOR; o portão exige que exista e bate contra o git.
 */
function guardaParticaoDeclarada(manifesto) {
  if (!manifesto || !manifesto.pecas) {
    return reprova(
      'g13-particao-declarada',
      'sem manifesto de partição — a Invariante 4 não tem como ser verificada',
      'scripts/portao-particao.json',
    )
  }
  const donos = new Map()
  for (const peca of Object.keys(manifesto.pecas)) {
    for (const arquivo of manifesto.pecas[peca]) {
      if (!donos.has(arquivo)) donos.set(arquivo, [])
      donos.get(arquivo).push(peca)
    }
  }
  const disputados = Array.from(donos.keys()).filter((a) => donos.get(a).length > 1)
  if (disputados.length > 0) {
    return reprova(
      'g13-particao-declarada',
      'arquivo declarado por DUAS peças (a segunda escrita apaga a primeira em silêncio): ' +
        disputados.map((a) => a + ' [' + donos.get(a).join(' e ') + ']').join('; '),
      'scripts/portao-particao.json',
    )
  }
  if (manifesto.pendente) {
    return reprova(
      'g13-particao-declarada',
      'manifesto marcado como PENDENTE: ' + manifesto.pendente,
      'scripts/portao-particao.json',
    )
  }
  return ok('g13-particao-declarada', donos.size + ' arquivo(s) com dono declarado, nenhum disputado')
}

// ---------------------------------------------------------------------------
// FASE 1 — comandos, com exit code real e detector de falso-verde.
// ---------------------------------------------------------------------------

const TSC = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')
const VITEST = path.join(RAIZ, 'node_modules', 'vitest', 'vitest.mjs')
const PLAYWRIGHT = path.join(RAIZ, 'node_modules', '@playwright', 'test', 'cli.js')

/** Repetições das jornadas. 3 é o que a interface das peças pede na volta de vitória. */
const REPETICOES = Number(process.env.PORTAO_REPETICOES || 3)

/**
 * Um passo de jornada. `workers` é explícito em TODO passo: a CLI vence a
 * config, então o número de workers de cada medida mora aqui, num lugar só, e
 * não depende de quem editou o playwright.config por último.
 */
function jornada(id, titulo, arquivos, opcoes) {
  const o = opcoes || {}
  const repeticoes = o.repeticoes === undefined ? REPETICOES : o.repeticoes
  const args = [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--reporter=list', '--workers=' + (o.workers || WORKERS_BATERIA)]
  if (repeticoes > 1) args.push('--repeat-each=' + repeticoes)
  return {
    id,
    titulo,
    exe: process.execPath,
    args: args.concat(arquivos),
    cwd: CLIENTE,
    ruina: [/\b\d+ skipped\b/, /\b\d+ flaky\b/, /\bdid not run\b/, /\b\d+ failed\b/],
    // Prova positiva: comando que não rodou teste nenhum sai 0 e passaria por verde.
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
    titulo: 'Invariante 4: quem escreveu onde (partição declarada, Rust intocado)',
    sonda: sondarParticao,
  },
  jornada('jornadas-e2e', 'jornadas já entregues, com ponteiro real', JORNADAS_E2E),
  jornada('jornadas-das-pecas', 'as jornadas das peças deste run — cada peça julgada pelo comando dela', JORNADAS_DAS_PECAS),
  jornada('regressao', 'bateria de regressão: o resto da suíte e2e, uma execução', bateriaDeRegressao(), { repeticoes: 1 }),
  jornada('jornada-fluidez', 'Invariante 6 medida com a máquina só para ela (workers=1)', [JORNADA_FLUIDEZ], { workers: 1 }),
]

/**
 * Invariante 4 — quem escreveu onde.
 *
 * As peças deste run rodam na MESMA árvore de trabalho, e duas escritas no
 * mesmo arquivo se sobrescrevem sem erro nenhum: a segunda peça apaga a
 * primeira e as duas saem "verdes". Nenhum passo media isso; o portão nem
 * tinha o que comparar, porque a partição nunca foi escrita em lugar algum.
 *
 * O manifesto (`scripts/portao-particao.json`) é do ORQUESTRADOR: o portão não
 * adivinha a partição, ele exige que ela exista e bate a lista contra o que o
 * git diz que mudou. Arquivo mudado sem dono sai vermelho com nome e endereço.
 */
function sondarParticao() {
  return Promise.resolve().then(() => {
    const mudados = git(['status', '--porcelain'])
    if (mudados === null) return { codigo: 1, saida: 'git status falhou: sem repositório?' }
    const arquivos = mudados
      .split('\n')
      .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
      .filter((l) => l.length > 0)
      .map((l) => l.split('\\').join('/'))

    const problemas = []
    // Invariante 8 do run: o lado Rust não é tocado. Esta parte não depende de
    // manifesto nenhum — reprova sozinha.
    const rust = arquivos.filter((a) => a.startsWith('desktop/') || a.endsWith('.rs') || a.endsWith('Cargo.toml') || a.endsWith('Cargo.lock'))
    if (rust.length > 0) problemas.push('Invariante 8 violada — lado Rust tocado: ' + rust.join(', '))

    let manifesto = null
    try {
      manifesto = JSON.parse(fs.readFileSync(PARTICAO, 'utf8'))
    } catch (e) {
      return {
        codigo: 1,
        saida:
          'sem manifesto de partição em scripts/portao-particao.json (' + e.message + ').\n' +
          'A Invariante 4 não é verificável enquanto ninguém declarar quem escreve onde.\n' +
          'Arquivos mudados agora, para o orquestrador distribuir entre as peças:\n  ' +
          arquivos.join('\n  '),
      }
    }

    const estatica = guardaParticaoDeclarada(manifesto)
    if (!estatica.ok) problemas.push(estatica.detalhe)

    const donos = new Map()
    for (const peca of Object.keys(manifesto.pecas || {})) {
      for (const arquivo of manifesto.pecas[peca]) {
        if (!donos.has(arquivo)) donos.set(arquivo, [])
        donos.get(arquivo).push(peca)
      }
    }
    const livres = manifesto.livres || []
    const semDono = arquivos.filter((a) => !donos.has(a) && livres.indexOf(a) === -1)
    if (semDono.length > 0) problemas.push('arquivo mudado sem dono declarado: ' + semDono.join(', '))

    return {
      codigo: problemas.length === 0 ? 0 : 1,
      saida:
        arquivos.length + ' arquivo(s) mudado(s); ' + donos.size + ' com dono declarado\n' +
        (problemas.length === 0 ? 'partição respeitada e Rust intocado' : problemas.join('\n')),
    }
  })
}

/** Porta livre = o Playwright vai subir servidor próprio, e ele nasce sem história. */
function portaLivre(url) {
  return new Promise((resolve) => {
    const alvo = new URL(url)
    const porta = Number(alvo.port || (alvo.protocol === 'https:' ? 443 : 80))
    const soquete = net.connect({ host: alvo.hostname, port: porta })
    const decidir = (livre) => {
      soquete.destroy()
      resolve(livre)
    }
    soquete.setTimeout(2000, () => decidir(true))
    soquete.on('connect', () => decidir(false))
    soquete.on('error', () => decidir(true))
  })
}

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
 *
 * COM `PORTAO_SERVIDOR_LIMPO=1` a pergunta é outra. Nesse modo o Playwright
 * sobe o servidor DELE (`reuseExistingServer: false`), então não há servidor
 * velho para sondar — e sondar o que estiver na porta seria certificar um
 * servidor que jornada nenhuma vai usar. O que importa aí é a porta do
 * `baseURL` estar LIVRE: livre, o servidor nasce sem história e a sonda não tem
 * o que fazer; ocupada, o `npm run dev` do Playwright nem sobe e a bateria
 * inteira morre. Nenhum dos dois casos sai verde por ausência de resposta.
 */
function sondarServidorLimpo() {
  if (EXIGE_SERVIDOR_NOVO) {
    return portaLivre(URL_EDITOR).then((livre) => ({
      codigo: livre ? 0 : 1,
      saida: livre
        ? 'PORTAO_SERVIDOR_LIMPO=1 e ' + URL_EDITOR + ' está livre: o Playwright sobe um servidor novo, sem histórico de HMR'
        : 'PORTAO_SERVIDOR_LIMPO=1 exige a porta do baseURL livre, e ' + URL_EDITOR + ' já tem alguém ouvindo.\n' +
          'O webServer do Playwright não vai conseguir subir. Derrube o `npm run dev` desta porta ou rode sem a variável.',
    }))
  }
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
  const textoConfig = fs.readFileSync(CONFIG_PLAYWRIGHT, 'utf8')
  resultados.push(guardaCoberturaDeTipos(projetos))
  resultados.push(guardaSemRetries(textoConfig))
  resultados.push(guardaJornadasExistem(TODAS_JORNADAS_E2E.concat(JORNADAS_UNIDADE)))
  resultados.push(guardaPlanoCobreArtefato(PLANO))
  resultados.push(guardaEnderecoDoConfig(textoConfig, URL_EDITOR))
  resultados.push(guardaExclusoesDeclaradas(EXCLUSOES_DA_BATERIA, JORNADAS_DAS_PECAS, (a) => fs.existsSync(path.join(CLIENTE, a))))
  resultados.push(guardaFluidezForaDaBateria(bateriaDeRegressao(), JORNADA_FLUIDEZ))
  resultados.push(guardaOrdemDoPlano(PLANO))
  let manifesto = null
  try {
    manifesto = JSON.parse(fs.readFileSync(PARTICAO, 'utf8'))
  } catch (e) {
    manifesto = null
  }
  resultados.push(guardaParticaoDeclarada(manifesto))

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
    [
      'g9 reprova endereço de outro checkout',
      guardaEnderecoDoConfig("baseURL: 'http://localhost:1437',", 'http://localhost:1420/'),
      false,
    ],
    ['g9 reprova config sem baseURL', guardaEnderecoDoConfig('viewport: { width: 1280 }', 'http://localhost:1437/'), false],
    ['g9 aprova endereço tirado do config', guardaEnderecoDoConfig("baseURL: 'http://localhost:1437',", 'http://localhost:1437/'), true],
    [
      'g10 reprova exclusão sem motivo',
      guardaExclusoesDeclaradas([{ arquivo: 'e2e/x.spec.ts' }], [], () => true),
      false,
    ],
    [
      'g10 reprova exclusão de jornada de peça',
      guardaExclusoesDeclaradas([{ arquivo: 'e2e/p.spec.ts', motivo: 'm', endereco: 'e' }], ['e2e/p.spec.ts'], () => true),
      false,
    ],
    [
      'g10 reprova exclusão de arquivo que não existe',
      guardaExclusoesDeclaradas([{ arquivo: 'e2e/sumiu.spec.ts', motivo: 'm', endereco: 'e' }], [], () => false),
      false,
    ],
    [
      'g10 aprova exclusão declarada',
      guardaExclusoesDeclaradas([{ arquivo: 'e2e/x.spec.ts', motivo: 'vermelho em HEAD', endereco: 'e2e/x.spec.ts' }], [], () => true),
      true,
    ],
    ['g11 reprova fluidez dentro da bateria', guardaFluidezForaDaBateria(['e2e/a.spec.ts', JORNADA_FLUIDEZ], JORNADA_FLUIDEZ), false],
    ['g11 aprova bateria sem a fluidez', guardaFluidezForaDaBateria(['e2e/a.spec.ts'], JORNADA_FLUIDEZ), true],
    ['g12 reprova sonda depois das jornadas', guardaOrdemDoPlano([{ id: 'regressao' }, { id: 'servidor-limpo' }]), false],
    ['g12 reprova plano sem sonda de servidor', guardaOrdemDoPlano([{ id: 'regressao' }]), false],
    ['g12 aprova plano real', guardaOrdemDoPlano(PLANO), true],
    ['g13 reprova sem manifesto', guardaParticaoDeclarada(null), false],
    [
      'g13 reprova arquivo com dois donos',
      guardaParticaoDeclarada({ pecas: { a: ['client/src/x.ts'], b: ['client/src/x.ts'] } }),
      false,
    ],
    ['g13 reprova manifesto pendente', guardaParticaoDeclarada({ pecas: { a: ['x'] }, pendente: 'falta o resto' }), false],
    ['g13 aprova partição sem disputa', guardaParticaoDeclarada({ pecas: { a: ['x'], b: ['y'] } }), true],
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
          url_editor: URL_EDITOR,
          workers_bateria: WORKERS_BATERIA,
          jornadas_e2e: TODAS_JORNADAS_E2E,
          jornadas_das_pecas: JORNADAS_DAS_PECAS,
          jornadas_unidade: JORNADAS_UNIDADE,
          bateria_regressao: bateriaDeRegressao(),
          fora_da_bateria: EXCLUSOES_DA_BATERIA,
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
