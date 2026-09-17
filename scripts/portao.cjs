#!/usr/bin/env node
'use strict'
/*
 * Portão de validade do Labirinto — um comando só, honesto.
 *
 * ARTEFATO EM JULGAMENTO NESTA BAR: O Labirinto servindo a tela do mestre em
 * http://localhost:1450/ e a tela do jogador em http://localhost:1450/player.html.
 *
 * POR QUE ELE MUDOU (auditoria de 17/09/2026). O portão desta rodada eram três
 * comandos — `tsc -p tsconfig.json`, `tsc -p tsconfig.e2e.json` e
 * `npm run test --workspace=client` — e nenhum deles abre um navegador:
 *
 *   1. CRÍTICO — o portão nunca desenhava um pixel. 66 specs e2e existem no
 *      repositório e ele rodava ZERO. O alvo das peças desta bar é a tela do
 *      jogador (client/src/player/PlayerView.tsx, redrawFog em :310-348) e
 *      nenhum comando a carregava, nem em teste de unidade, nem em e2e. Toda
 *      peça julgada assim foi julgada por texto.
 *   2. CRÍTICO — a Invariante 3 ("a memória serializada continua sendo lida
 *      sem quebrar") não era cobrada. Todo o bloco encode/decode de
 *      client/src/lib/exploration.test.ts era ida-e-volta: mutei o formato de
 *      fio nos dois lados (exploration.ts:57 e :63) e os 2096 testes ficaram
 *      VERDES, com todo mapa salvo virando névoa embaralhada. Agora existe
 *      fixture literal (FIO_DOURADO) e a mesma mutação derruba 5 testes.
 *   3. ALTO — o portão reaproveita um vite com história de HMR, a condição que
 *      o próprio playwright.config.ts documenta como produtora de verde e
 *      vermelho falsos, e não tinha passo nenhum conferindo isso.
 *   4. MÉDIO — a Invariante 2 (estilo de minimapa) tinha spec no worktree
 *      (e2e/task-integracao-estilo-sala.spec.ts, 11,4 KB) e o spec não era
 *      citado por nenhum dos três comandos.
 *   5. MÉDIO — a escotilha de servidor limpo mandava liberar a porta 1420, que
 *      este worktree não usa (ele serve na 1450). Corrigido em
 *      client/playwright.config.ts, e a porta agora é conferida ANTES da suíte.
 *
 * O QUE SAIU. Os passos de `cargo clippy`/`cargo test` e a sonda do exe release
 * na LAN (porta 7777) eram da bar ANTERIOR, cujo artefato era o executável. Esta
 * bar tem a Invariante 7 — "o lado Rust não é tocado" — então compilar o Rust a
 * cada julgamento gastava minutos medindo o que ninguém pode ter mudado. No
 * lugar entrou uma guarda que COBRA a invariante: se qualquer arquivo Rust
 * aparecer modificado no git, a FASE 0 reprova.
 *
 * O QUE ELE FAZ, em ordem — qualquer vermelho encerra com exit 1:
 *
 *   FASE 0 — auditoria estática do próprio portão e das invariantes que se
 *            medem sem rodar nada (escopo de arquivo, Rust intocado, ausência
 *            de credencial no diff). Cada guarda é função pura sobre texto, e
 *            `--autoteste` prova que cada uma REPROVA a entrada ruim conhecida.
 *            Guarda que nunca reprova nada é decoração.
 *   FASE 1 — comandos. Cada um roda com o exit code real, tem detector de
 *            FALSO-VERDE (saiu 0 mas a saída contém ruína) e, quando abre
 *            navegador, tem PROVA POSITIVA (`exige`): sem ver "N passed" o
 *            passo reprova, porque "rodou zero spec" é exatamente o defeito
 *            que este portão existe para não repetir.
 *
 * Uso:
 *   node scripts/portao.cjs              portão completo (jornadas 1x)
 *   node scripts/portao.cjs --vitoria    jornadas 3x, para declarar vencedora
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
const { spawnSync } = require('child_process')

const RAIZ = path.resolve(__dirname, '..')
const CLIENTE = path.join(RAIZ, 'client')
const SAIDA = path.join(os.tmpdir(), 'portao-labirinto')

/** As duas telas do artefato. Portas congeladas pela Invariante 8 deste worktree. */
const PORTA = Number(process.env.PORTAO_PORTA || 1450)
const URL_EDITOR = process.env.PORTAO_URL_EDITOR || 'http://localhost:' + PORTA + '/'
const URL_JOGADOR = process.env.PORTAO_URL_JOGADOR || 'http://localhost:' + PORTA + '/player.html'
const TIMEOUT_HTTP_MS = 8000
/** Os módulos que os specs importam dentro de `page.evaluate` — os que podem virar instância dupla. */
const MODULOS_DE_SPEC = ['/src/stores/mapStore.ts', '/src/lib/mapFactory.ts']

/**
 * As jornadas declaradas por esta bar, mais a do próprio portão. O portão roda
 * cada uma 1 vez; com `--vitoria`, 3 vezes.
 */
const JORNADAS_E2E = [
  'e2e/task-jornada-entrar-na-casa.spec.ts',
  'e2e/task-jornada-visao-sala-inteira.spec.ts',
  'e2e/task-jornada-portao-desenha-pixel.spec.ts',
]
/**
 * A jornada de FLUIDEZ roda sozinha, com `--workers=1`. Não é preferência: medir
 * travamento numa máquina que hospeda outros 3 Pixi/WebGL mede a máquina.
 * Medido em 17/09/2026, mesma jornada, mesmo commit, desenhando a sala:
 *   com 4 workers (--repeat-each=3):  longtask_max_ms = 168, 192, 199  (teto 200)
 *   sozinha, --workers=1:             longtask_max_ms =  95, 120, 130
 * A 199 contra um teto de 200 o resultado vira cara-ou-coroa — flake, que é
 * exatamente o que `retries: 0` existe para não deixar passar disfarçado.
 */
const JORNADA_FLUIDEZ = 'e2e/task-jornada-portao-fluidez.spec.ts'

/**
 * As INVARIANTES da bar e o comando que mede cada uma. Invariante sem arquivo
 * aqui é texto, não invariante — e foi assim que a Invariante 2 ficou de fora
 * do portão tendo spec pronto no worktree.
 */
const INVARIANTES = [
  {
    n: 1,
    texto: 'a névoa não afrouxa: sala secreta, zona oculta, token, peça e luz fora da visão atual não vazam',
    medida: ['e2e/task-jornada-visao-sala-inteira.spec.ts', 'e2e/task-player-map.spec.ts', 'e2e/task-conceal-zone.spec.ts', 'src/lib/fogFilter.test.ts'],
  },
  {
    n: 2,
    texto: 'estilo minimapa de Resident Evil: chão chapado, parede como linha clara fina, porta como retângulo pequeno, fundo escuro',
    medida: ['e2e/task-integracao-estilo-sala.spec.ts'],
  },
  {
    n: 3,
    texto: 'mapa antigo continua abrindo; a memória serializada continua legível (encodeExploration)',
    medida: ['src/lib/exploration.test.ts', 'src/lib/mapFile.persistencia.test.ts', 'src/lib/mapFileIO.persistencia.test.ts'],
  },
]

/** Specs que medem invariante e NÃO são jornada: rodam num passo próprio, uma vez. */
const INVARIANTES_E2E = ['e2e/task-integracao-estilo-sala.spec.ts', 'e2e/task-player-map.spec.ts', 'e2e/task-conceal-zone.spec.ts']

const JORNADAS_UNIDADE = [
  'src/lib/exploration.test.ts',
  'src/lib/mapFile.persistencia.test.ts',
  'src/lib/mapFileIO.persistencia.test.ts',
  'src/lib/fogFilter.test.ts',
]

/** Tudo que a FASE 0 audita spec a spec. */
const TODOS_SPECS_AUDITADOS = JORNADAS_E2E.concat([JORNADA_FLUIDEZ], INVARIANTES_E2E)

/**
 * As jornadas que a bar declarou FIXAS (Invariante 5): builder nenhum edita.
 * Arquivo novo é permitido; modificar um destes, não.
 *
 * A lista serve de nome bonito no relatório, mas a guarda NÃO se apoia nela: a
 * Invariante 5 é "nenhum builder edita arquivo em client/e2e", e uma lista de
 * dois nomes deixaria um builder afrouxar a asserção de qualquer um dos outros
 * 64 specs — inclusive os que medem as Invariantes 1 e 2 — sem o portão piscar.
 * Quem manda é PASTA_DE_JORNADAS.
 */
const JORNADAS_FIXAS = ['client/e2e/task-jornada-entrar-na-casa.spec.ts', 'client/e2e/task-jornada-visao-sala-inteira.spec.ts']
/** Toda a pasta das jornadas: o escopo literal da Invariante 5. */
const PASTA_DE_JORNADAS = 'client/e2e/'

/** O alvo do artefato: a tela do jogador. Nenhum plano pode deixar de carregá-la. */
const ALVO_DO_ARTEFATO = '/player.html'

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
 * O que um spec NÃO pode fazer é inventar a RESPOSTA. Ligar as duas abas por um
 * cano do teste é legítimo nesta bar: a Invariante 7 tira o Rust do jogo, então
 * o transporte real (axum) não está em julgamento — o que corre por dentro
 * (sessão do mestre, recorte de névoa, memória do jogador) continua sendo
 * código de produção. Escrever à mão um `{ type: 'snapshot' }` e mandar para a
 * tela do jogador é outra coisa: aí o spec afirma sobre o payload do próprio
 * spec, e a tela do jogador vira um visualizador de fixture.
 *
 * Regra: payload de protocolo montado à mão reprova. Cano que encaminha o que a
 * sessão de produção produziu (`createHostSession`, `exposeFunction`,
 * `__jornadaNetSend`) aprova.
 */
function guardaRespostaFabricada(arquivo, texto) {
  const protocoloAMao = /\{\s*type\s*:\s*['"](snapshot|welcome|explored|vision)['"]/.test(texto)
  if (protocoloAMao) {
    return reprova(
      'g5-resposta-fabricada',
      arquivo + ' monta mensagem de protocolo à mão: a tela do jogador passa a exibir a fixture do próprio spec',
      arquivo,
    )
  }
  const fabricaTransporte = /case\s+'net_(start_room|send|kick|stop_room)'/.test(texto) || /__emitTauri\s*\(/.test(texto)
  if (!fabricaTransporte) return ok('g5-resposta-fabricada', arquivo + ' não simula transporte')
  const encaminha = /createHostSession|exposeFunction|__jornadaNetSend|routeWebSocket/.test(texto)
  if (!encaminha) {
    return reprova(
      'g5-resposta-fabricada',
      arquivo + ' falsifica o transporte sem encaminhar nada para o código de produção (sem createHostSession/exposeFunction/routeWebSocket)',
      arquivo,
    )
  }
  return ok('g5-resposta-fabricada', arquivo + ': cano entre as abas, payload vindo do código de produção')
}

/** A fluidez que a interface da peça manda medir precisa de UM comando; senão é texto. */
function guardaFluidezTemComando(textos) {
  const mede = Object.keys(textos).filter((a) => /longtask/i.test(textos[a]) && /\b200\b/.test(textos[a]))
  if (mede.length === 0) {
    return reprova('g6-fluidez-medida', 'nenhuma jornada mede longtask com o teto de 200 ms — a fluidez não tem comando', 'interface da peça')
  }
  return ok('g6-fluidez-medida', 'medida por ' + mede.join(', '))
}

/** O plano precisa desenhar as duas telas e conferir o ambiente; senão o artefato julgado não é o artefato. */
function guardaPlanoCobreArtefato(plano) {
  const faltando = []
  const tem = (id) => plano.some((p) => p.id === id)
  if (!tem('tipos-src') || !tem('tipos-e2e')) faltando.push('tipos do app e/ou das jornadas fora do plano')
  if (!tem('unidade')) faltando.push('nenhum passo roda a suíte de unidade')
  if (!tem('paginas-vivas')) faltando.push('nenhum passo confere que as duas telas do artefato sobem')
  if (!tem('servidor-limpo')) faltando.push('nenhum passo confere se o dev server duplicou módulo por HMR')
  if (!tem('jornadas-e2e')) faltando.push('nenhum passo roda as jornadas da bar')
  if (!tem('jornada-fluidez')) faltando.push('nenhum passo mede a fluidez com a máquina sozinha')
  if (!tem('invariantes-e2e')) faltando.push('nenhum passo roda os specs que medem as invariantes')
  if (!tem('suite-e2e')) faltando.push('nenhum passo roda a suíte e2e inteira (os 66 specs que o portão antigo ignorava)')
  if (faltando.length > 0) return reprova('g7-plano-cobre-artefato', faltando.join('; '), 'scripts/portao.cjs (PLANO)')
  return ok('g7-plano-cobre-artefato', 'plano cobre tipos, unidade, as duas telas, ambiente, jornadas, fluidez, invariantes e a suíte inteira')
}

/** Jornada declarada que não existe, ou que não declara teste nenhum, é invariante vazia. */
function guardaJornadasExistem(arquivos, lerTexto) {
  const problemas = []
  for (const arquivo of arquivos) {
    const texto = lerTexto(arquivo)
    if (texto === null) {
      problemas.push(arquivo + ' não existe')
      continue
    }
    const quantos = (texto.match(/\b(test|it)\s*\(\s*['"`]/g) || []).length
    if (quantos === 0) problemas.push(arquivo + ' não declara nenhum teste')
  }
  if (problemas.length > 0) return reprova('g8-jornadas-existem', problemas.join('; '), 'client/e2e + client/src/lib')
  return ok('g8-jornadas-existem', arquivos.length + ' arquivos de jornada presentes e com testes')
}

/**
 * Invariante 3 — o formato de fio precisa estar ANCORADO num valor literal.
 * Teste de ida-e-volta compara o decode do encode do próprio processo: trocar a
 * ordem dos bits nos dois lados mantém os dois de acordo e a suíte verde.
 * Medido em 17/09/2026: a mutação passou por 2096 testes. A âncora é uma string
 * base64 escrita no teste e comparada com `toEqual`/`toBe`.
 */
function guardaFioAncorado(texto) {
  const temFixture = /FIO_DOURADO/.test(texto)
  const temLiteralBase64 = /bits\s*:\s*'[A-Za-z0-9+/]{4,}={0,2}'/.test(texto)
  if (!temFixture || !temLiteralBase64) {
    return reprova(
      'g9-fio-ancorado',
      'o teste da memória serializada não tem fixture literal (FIO_DOURADO + `bits: <base64>`): só ida-e-volta, que aprova formato mutado',
      'client/src/lib/exploration.test.ts',
    )
  }
  return ok('g9-fio-ancorado', 'formato de fio ancorado em base64 literal')
}

/** Um spec só LÊ pixel se tirar foto ou puxar `getImageData`; o resto é afirmação sobre DOM. */
const LE_PIXEL = /page\.screenshot\s*\(|\.screenshot\s*\(\s*\{|toHaveScreenshot\s*\(|getImageData\s*\(/

/**
 * O defeito-mãe: o portão rodava três comandos e nenhum carregava a tela do
 * jogador. Algum spec do PLANO precisa abrir `/player.html`, e algum precisa
 * abrir o editor.
 *
 * ABRIR NÃO BASTA. O alvo desta bar é o que a tela do jogador DESENHA
 * (client/src/player/PlayerView.tsx, `redrawFog`), e um spec que faz
 * `goto('/player.html')` e confere só um rótulo de DOM passaria nesta guarda
 * sem nunca ter olhado um pixel de névoa — que é exatamente a forma fraca do
 * defeito que esta guarda existe para pegar. Por isso o plano também precisa
 * de pelo menos um spec que abra a tela do jogador E leia pixel nela.
 *
 * LIMITE HONESTO: a guarda é textual. Ela prova que o comando existe no plano,
 * não que a foto lida seja do canvas do jogador — isso quem cobra é a asserção
 * dentro do próprio spec.
 */
function guardaAlvoDesenhado(textosDosSpecsDoPlano) {
  const abreJogador = Object.keys(textosDosSpecsDoPlano).filter((a) => textosDosSpecsDoPlano[a].includes(ALVO_DO_ARTEFATO))
  const abreEditor = Object.keys(textosDosSpecsDoPlano).filter((a) => /enterEditor|goto\(\s*'\/'\s*\)/.test(textosDosSpecsDoPlano[a]))
  const lePixelNoJogador = abreJogador.filter((a) => LE_PIXEL.test(textosDosSpecsDoPlano[a]))
  const faltando = []
  if (abreJogador.length === 0) faltando.push('nenhum spec do plano carrega ' + ALVO_DO_ARTEFATO + ' — a tela do jogador nunca é desenhada')
  else if (lePixelNoJogador.length === 0) {
    faltando.push(
      'o plano abre ' +
        ALVO_DO_ARTEFATO +
        ' (' +
        abreJogador.join(', ') +
        ') mas nenhum desses specs lê pixel: o alvo é desenhado e ninguém olha',
    )
  }
  if (abreEditor.length === 0) faltando.push('nenhum spec do plano abre a tela do mestre')
  if (faltando.length > 0) return reprova('g10-alvo-desenhado', faltando.join('; '), 'scripts/portao.cjs (PLANO) + client/e2e')
  return ok(
    'g10-alvo-desenhado',
    'jogador desenhado por ' + abreJogador.join(', ') + ' (pixel lido em ' + lePixelNoJogador.length + '); mestre por ' + abreEditor.length + ' spec(s)',
  )
}

/**
 * Passo de navegador que não exige prova positiva sai VERDE rodando zero spec —
 * um filtro errado, um caminho que ninguém casa, e o playwright devolve 0 com
 * "no tests found" em algumas versões. Todo passo de e2e declara `exige`.
 */
function guardaProvaPositivaNoNavegador(plano) {
  const sem = plano.filter((p) => p.navegador && (!p.exige || p.exige.length === 0)).map((p) => p.id)
  if (sem.length > 0) {
    return reprova('g11-prova-positiva', 'passo de navegador sem `exige` (sai verde rodando zero spec): ' + sem.join(', '), 'scripts/portao.cjs (PLANO)')
  }
  return ok('g11-prova-positiva', 'todo passo de navegador exige "N passed"')
}

/** Invariante 7 — o lado Rust não é tocado. Se apareceu Rust no diff, a peça saiu do escopo. */
function guardaRustIntocado(porcelain) {
  const sujos = linhasDeStatus(porcelain).filter((l) => /\.rs$|desktop\/src-tauri\//.test(l.caminho) && l.estado !== '??')
  if (sujos.length > 0) {
    return reprova('g12-invariante-7-rust', 'arquivo Rust modificado: ' + sujos.map((l) => l.caminho).join(', '), 'INVARIANTES item 7')
  }
  return ok('g12-invariante-7-rust', 'nenhum arquivo Rust modificado')
}

/** Invariante 6 — nada de .env, credencial, certificado ou chave no diff. */
function guardaSemCredencial(porcelain) {
  const risco = /(^|\/)\.env|(^|\/)secrets\/|\.pem$|\.key$|\.pfx$|\.p12$|\.dpapi$|credentials\.json$/
  const sujos = linhasDeStatus(porcelain).filter((l) => risco.test(l.caminho))
  if (sujos.length > 0) {
    return reprova('g13-invariante-6-credencial', 'arquivo de credencial no diff: ' + sujos.map((l) => l.caminho).join(', '), 'INVARIANTES item 6')
  }
  return ok('g13-invariante-6-credencial', 'nenhum .env/segredo/certificado no diff')
}

/**
 * Invariante 5 — "nenhum builder edita arquivo em client/e2e: as jornadas são
 * fixas". Arquivo NOVO (`??`) é permitido: é assim que uma peça entrega a
 * jornada dela. Modificar, apagar ou renomear um spec que já existia, não —
 * afrouxar a asserção do spec que te julga é a forma mais barata de sair
 * verde, e é justamente a que não deixa rastro no relatório do playwright.
 */
function guardaJornadasFixas(porcelain) {
  const mexidas = linhasDeStatus(porcelain).filter((l) => l.caminho.startsWith(PASTA_DE_JORNADAS) && /[MDR]/.test(l.estado))
  if (mexidas.length > 0) {
    const declarada = (c) => (JORNADAS_FIXAS.includes(c) ? ' (jornada DECLARADA da bar)' : '')
    return reprova(
      'g14-invariante-5-jornadas-fixas',
      'spec de ' + PASTA_DE_JORNADAS + ' editado por um builder: ' + mexidas.map((l) => l.estado + ' ' + l.caminho + declarada(l.caminho)).join(', '),
      'INVARIANTES item 5',
    )
  }
  return ok('g14-invariante-5-jornadas-fixas', 'nenhum spec de ' + PASTA_DE_JORNADAS + ' modificado (as ' + JORNADAS_FIXAS.length + ' declaradas inclusive)')
}

/**
 * Cada invariante da bar precisa de pelo menos um arquivo que a meça, o arquivo
 * precisa existir, e o PLANO precisa alcançá-lo: spec de e2e listado em algum
 * passo, ou teste de unidade (a suíte inteira roda no passo `unidade`).
 * A Invariante 2 tinha spec de 11,4 KB pronto e fora dos três comandos.
 */
function guardaInvariantesTemComando(invariantes, alcancadosE2E, lerTexto) {
  const problemas = []
  for (const inv of invariantes) {
    if (inv.medida.length === 0) {
      problemas.push('Invariante ' + inv.n + ' não tem arquivo que a meça')
      continue
    }
    for (const arquivo of inv.medida) {
      if (lerTexto(arquivo) === null) {
        problemas.push('Invariante ' + inv.n + ': ' + arquivo + ' não existe')
        continue
      }
      const unidade = arquivo.startsWith('src/')
      if (!unidade && !alcancadosE2E.includes(arquivo)) {
        problemas.push('Invariante ' + inv.n + ': ' + arquivo + ' existe mas nenhum passo do plano o roda')
      }
    }
  }
  if (problemas.length > 0) return reprova('g15-invariantes-tem-comando', problemas.join('; '), 'scripts/portao.cjs (INVARIANTES + PLANO)')
  return ok('g15-invariantes-tem-comando', invariantes.length + ' invariantes com comando que as mede')
}

/** `git status --porcelain` em linhas {estado, caminho}, com o caminho de renomeação resolvido. */
function linhasDeStatus(porcelain) {
  return String(porcelain || '')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      const estado = l.slice(0, 2).trim() || l.slice(0, 2)
      const resto = l.slice(3)
      const caminho = resto.includes(' -> ') ? resto.split(' -> ')[1] : resto
      return { estado, caminho: caminho.replace(/^"|"$/g, '') }
    })
}

// ---------------------------------------------------------------------------
// FASE 1 — comandos, com exit code real e detector de falso-verde.
// ---------------------------------------------------------------------------

const TSC = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')
const VITEST = path.join(RAIZ, 'node_modules', 'vitest', 'vitest.mjs')
const PLAYWRIGHT = path.join(RAIZ, 'node_modules', '@playwright', 'test', 'cli.js')

/**
 * Ruína comum a todo passo do playwright.
 *
 * `[1-9]\d*` e não `\d+`: um relatório que imprimisse "0 failed" viraria
 * VERMELHO com exit code 0 — o portão acusaria FALSO-VERDE onde não há nada.
 * Portão que grita à toa é portão que o operador aprende a ignorar, que é o
 * mesmo defeito, pelo outro lado, do portão que nunca grita.
 */
const RUINA_E2E = [/\b[1-9]\d* skipped\b/, /\b[1-9]\d* flaky\b/, /\bdid not run\b/, /\b[1-9]\d* failed\b/, /no tests found/i]
/** Prova positiva: sem "N passed" o passo não rodou spec nenhum. */
const EXIGE_E2E = [/\b[1-9]\d* passed\b/]

function montarPlano(repeticoes) {
  return [
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
      titulo: 'vitest (suíte inteira, inclui o fio dourado da Invariante 3)',
      exe: process.execPath,
      args: [VITEST, 'run', '--reporter=default'],
      cwd: CLIENTE,
      // `\d+ skipped` e não `skipped`: "todo" é palavra comum em português e o
      // repositório é em português — um nome de teste derrubaria o portão à toa.
      ruina: [/[1-9]\d* skipped\b/i, /[1-9]\d* todo\b/i, /\bFAIL\b/, /No test files found/],
      exige: [/Tests\s+[1-9]\d* passed/],
    },
    {
      id: 'paginas-vivas',
      titulo: 'as duas telas do artefato respondem (' + URL_EDITOR + ' e ' + URL_JOGADOR + ')',
      sonda: sondarPaginas,
    },
    {
      id: 'servidor-limpo',
      titulo: 'editor sem módulo duplicado por HMR (senão toda afirmação por store é sobre a store errada)',
      sonda: sondarServidorLimpo,
    },
    {
      id: 'jornadas-e2e',
      titulo: 'jornadas da bar com ponteiro real, ' + repeticoes + 'x cada',
      exe: process.execPath,
      args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--repeat-each=' + repeticoes, '--reporter=list'].concat(JORNADAS_E2E),
      cwd: CLIENTE,
      navegador: true,
      ruina: RUINA_E2E,
      exige: EXIGE_E2E,
    },
    {
      id: 'jornada-fluidez',
      titulo: 'fluidez medida com a máquina só para ela (workers=1, 3 execuções)',
      exe: process.execPath,
      args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--repeat-each=3', '--workers=1', '--reporter=list', JORNADA_FLUIDEZ],
      cwd: CLIENTE,
      navegador: true,
      ruina: RUINA_E2E,
      exige: EXIGE_E2E,
    },
    {
      id: 'invariantes-e2e',
      titulo: 'specs que medem as Invariantes 1 e 2 (estilo de minimapa e névoa)',
      exe: process.execPath,
      args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--reporter=list'].concat(INVARIANTES_E2E),
      cwd: CLIENTE,
      navegador: true,
      ruina: RUINA_E2E,
      exige: EXIGE_E2E,
    },
    {
      id: 'suite-e2e',
      titulo: 'suíte e2e inteira (os specs que o portão de três comandos nunca rodou)',
      exe: process.execPath,
      args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--reporter=list'],
      cwd: CLIENTE,
      navegador: true,
      ruina: RUINA_E2E,
      exige: EXIGE_E2E,
    },
  ]
}

/**
 * As duas telas do artefato precisam responder ANTES da suíte: sem isto, meia
 * hora de e2e vira "timeout no goto" e o relatório culpa o app.
 */
function pegar(url) {
  return new Promise((resolve) => {
    const pedido = http.get(url, (r) => {
      let corpo = ''
      r.on('data', (d) => {
        corpo += d
      })
      r.on('end', () => resolve({ status: r.statusCode, corpo }))
    })
    pedido.setTimeout(TIMEOUT_HTTP_MS, () => {
      pedido.destroy()
      resolve({ status: 0, corpo: '', erro: 'sem resposta em ' + TIMEOUT_HTTP_MS + ' ms' })
    })
    pedido.on('error', (e) => resolve({ status: 0, corpo: '', erro: e.message }))
  })
}

async function sondarPaginas() {
  const problemas = []
  const linhas = []
  for (const [nome, url] of [
    ['mestre', URL_EDITOR],
    ['jogador', URL_JOGADOR],
  ]) {
    const r = await pegar(url)
    linhas.push('GET ' + url + ' -> ' + (r.erro ? r.erro : r.status + ' (' + r.corpo.length + ' bytes)'))
    if (r.status !== 200) problemas.push('a tela do ' + nome + ' não respondeu 200')
    // Casca de HTML sem script nenhum é página morta servida por engano.
    else if (!/<script[\s>]/.test(r.corpo)) problemas.push('a tela do ' + nome + ' veio sem <script>: não é o app')
  }
  return { codigo: problemas.length === 0 ? 0 : 1, saida: linhas.join('\n') + '\n' + (problemas.join('; ') || 'as duas telas do artefato estão no ar') }
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

/**
 * Com PORTAO_SERVIDOR_LIMPO=1 o playwright sobe um vite NOVO, e o vite deste
 * repositório é `strictPort` na 1450: porta ocupada = processo morto em vez de
 * outra porta. Conferir antes custa 50 ms e evita descobrir isso depois de
 * meia hora de suíte.
 */
function portaOcupada(porta) {
  return new Promise((resolve) => {
    const servidor = net.createServer()
    servidor.once('error', () => resolve(true))
    servidor.once('listening', () => servidor.close(() => resolve(false)))
    servidor.listen(porta, '127.0.0.1')
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

/** Texto de um arquivo do cliente, ou `null` se não existir. */
function lerDoCliente(relativo) {
  const absoluto = path.join(CLIENTE, relativo)
  return fs.existsSync(absoluto) ? fs.readFileSync(absoluto, 'utf8') : null
}

function statusDoGit() {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8', shell: true })
  return String(r.stdout || '')
}

function rodarFase0(plano) {
  const resultados = []
  const projetos = [path.join(CLIENTE, 'tsconfig.json'), path.join(CLIENTE, 'tsconfig.e2e.json')]
    .filter((p) => fs.existsSync(p))
    .map(lerTsconfig)
  resultados.push(guardaCoberturaDeTipos(projetos))
  resultados.push(guardaSemRetries(fs.readFileSync(path.join(CLIENTE, 'playwright.config.ts'), 'utf8')))
  resultados.push(guardaJornadasExistem(TODOS_SPECS_AUDITADOS.concat(JORNADAS_UNIDADE), lerDoCliente))
  resultados.push(guardaPlanoCobreArtefato(plano))
  resultados.push(guardaProvaPositivaNoNavegador(plano))
  resultados.push(guardaInvariantesTemComando(INVARIANTES, JORNADAS_E2E.concat(INVARIANTES_E2E, [JORNADA_FLUIDEZ]), lerDoCliente))

  const fio = lerDoCliente('src/lib/exploration.test.ts')
  resultados.push(guardaFioAncorado(fio === null ? '' : fio))

  const porcelain = statusDoGit()
  resultados.push(guardaRustIntocado(porcelain))
  resultados.push(guardaSemCredencial(porcelain))
  resultados.push(guardaJornadasFixas(porcelain))

  const textos = {}
  for (const arquivo of TODOS_SPECS_AUDITADOS.concat(JORNADAS_UNIDADE)) {
    const texto = lerDoCliente(arquivo)
    if (texto !== null) textos[arquivo] = texto
  }
  resultados.push(guardaFluidezTemComando(textos))
  resultados.push(guardaAlvoDesenhado(textos))
  for (const arquivo of Object.keys(textos)) {
    resultados.push(guardaSemOnlyNemSkip(arquivo, textos[arquivo]))
    resultados.push(guardaTetoSemControle(arquivo, textos[arquivo]))
    if (arquivo.endsWith('.spec.ts')) resultados.push(guardaRespostaFabricada(arquivo, textos[arquivo]))
  }
  return resultados
}

/**
 * Autoteste: cada guarda tem de REPROVAR a entrada ruim conhecida e APROVAR a
 * boa. Sem isto não dá para saber se uma guarda virou decoração.
 */
function rodarAutoteste() {
  const planoReal = montarPlano(1)
  const semArquivo = () => null
  const comArquivo = (t) => () => t
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
    ['g5 reprova snapshot montado à mão', guardaRespostaFabricada('x', "ws.send(JSON.stringify({ type: 'snapshot', map }))"), false],
    ['g5 reprova stub que não encaminha nada', guardaRespostaFabricada('x', "case 'net_send': return null"), false],
    [
      'g5 aprova cano com sessão de produção',
      guardaRespostaFabricada('x', "case 'net_send': alvo.__jornadaNetSend(a); await page.exposeFunction('__jornadaNetSend', f)"),
      true,
    ],
    ['g5 aprova jornada sem stub', guardaRespostaFabricada('x', 'await page.mouse.down()'), true],
    ['g6 reprova sem medida de longtask', guardaFluidezTemComando({ 'a.spec.ts': 'expect(1).toBe(1)' }), false],
    ['g6 aprova com medida', guardaFluidezTemComando({ 'a.spec.ts': 'longtask_max_ms deve ficar abaixo de 200' }), true],
    ['g7 reprova plano sem jornadas', guardaPlanoCobreArtefato(planoReal.filter((p) => p.id !== 'jornadas-e2e')), false],
    ['g7 reprova plano sem suíte inteira', guardaPlanoCobreArtefato(planoReal.filter((p) => p.id !== 'suite-e2e')), false],
    ['g7 reprova plano sem as telas vivas', guardaPlanoCobreArtefato(planoReal.filter((p) => p.id !== 'paginas-vivas')), false],
    ['g7 reprova plano sem sonda de servidor', guardaPlanoCobreArtefato(planoReal.filter((p) => p.id !== 'servidor-limpo')), false],
    ['g7 reprova plano sem specs de invariante', guardaPlanoCobreArtefato(planoReal.filter((p) => p.id !== 'invariantes-e2e')), false],
    ['g7 reprova plano sem a medida sozinha da fluidez', guardaPlanoCobreArtefato(planoReal.filter((p) => p.id !== 'jornada-fluidez')), false],
    ['g7 aprova plano real', guardaPlanoCobreArtefato(planoReal), true],
    ['g8 reprova jornada inexistente', guardaJornadasExistem(['e2e/nao-existe-mesmo.spec.ts'], semArquivo), false],
    ['g8 reprova arquivo sem teste nenhum', guardaJornadasExistem(['e2e/vazio.spec.ts'], comArquivo('// só comentário')), false],
    ['g8 aprova arquivo com teste', guardaJornadasExistem(['e2e/cheio.spec.ts'], comArquivo("test('a', () => {})")), true],
    ['g9 reprova teste só de ida-e-volta', guardaFioAncorado('const back = decodeExploration(encodeExploration(exp))'), false],
    ['g9 reprova fixture sem base64 literal', guardaFioAncorado('const FIO_DOURADO = { wire: encodeExploration(exp) }'), false],
    ['g9 aprova fixture literal', guardaFioAncorado("const FIO_DOURADO = { wire: { cell: 8, cols: 8, rows: 4, bits: 'Dw8AAA==' } }"), true],
    ['g10 reprova plano que nunca abre a tela do jogador', guardaAlvoDesenhado({ 'a.spec.ts': "await enterEditor(page)" }), false],
    [
      'g10 reprova plano que nunca abre a tela do mestre',
      guardaAlvoDesenhado({ 'a.spec.ts': "await page.goto('/player.html'); await page.screenshot()" }),
      false,
    ],
    [
      'g10 reprova plano que abre a tela do jogador e só confere DOM',
      guardaAlvoDesenhado({ 'a.spec.ts': 'await enterEditor(page)', 'b.spec.ts': "await page.goto('/player.html'); await expect(x).toBeVisible()" }),
      false,
    ],
    [
      'g10 aprova plano com as duas telas e pixel lido na do jogador',
      guardaAlvoDesenhado({ 'a.spec.ts': 'await enterEditor(page)', 'b.spec.ts': "await page.goto('/player.html'); const f = await page.screenshot()" }),
      true,
    ],
    ['g11 reprova passo de navegador sem exige', guardaProvaPositivaNoNavegador([{ id: 'x', navegador: true }]), false],
    ['g11 aprova plano real', guardaProvaPositivaNoNavegador(planoReal), true],
    ['g12 reprova Rust modificado', guardaRustIntocado(' M desktop/src-tauri/src/net_server.rs'), false],
    ['g12 aprova sem Rust no diff', guardaRustIntocado(' M client/src/player/PlayerView.tsx'), true],
    ['g13 reprova .env no diff', guardaSemCredencial(' M client/.env.local'), false],
    ['g13 reprova chave no diff', guardaSemCredencial('?? secrets/host.pem'), false],
    ['g13 aprova diff sem credencial', guardaSemCredencial(' M client/src/lib/exploration.test.ts'), true],
    ['g14 reprova jornada declarada editada', guardaJornadasFixas(' M client/e2e/task-jornada-entrar-na-casa.spec.ts'), false],
    // O buraco da versão de lista: o spec que mede a Invariante 2 não estava
    // entre os dois nomes declarados, e afrouxá-lo saía verde.
    ['g14 reprova spec de invariante editado', guardaJornadasFixas(' M client/e2e/task-integracao-estilo-sala.spec.ts'), false],
    ['g14 reprova spec de e2e apagado', guardaJornadasFixas(' D client/e2e/task-player-map.spec.ts'), false],
    ['g14 aprova jornada declarada intacta', guardaJornadasFixas('?? client/e2e/task-jornada-entrar-na-casa.spec.ts'), true],
    ['g14 aprova spec novo de e2e', guardaJornadasFixas('?? client/e2e/task-jornada-portao-desenha-pixel.spec.ts'), true],
    ['g14 aprova código de produção modificado', guardaJornadasFixas(' M client/src/player/PlayerView.tsx'), true],
    [
      'g15 reprova invariante sem arquivo que a meça',
      guardaInvariantesTemComando([{ n: 9, texto: 'x', medida: [] }], [], semArquivo),
      false,
    ],
    [
      'g15 reprova spec de invariante fora do plano',
      guardaInvariantesTemComando([{ n: 2, texto: 'x', medida: ['e2e/task-integracao-estilo-sala.spec.ts'] }], [], comArquivo("test('a', () => {})")),
      false,
    ],
    [
      'g15 aprova spec de invariante dentro do plano',
      guardaInvariantesTemComando(
        [{ n: 2, texto: 'x', medida: ['e2e/task-integracao-estilo-sala.spec.ts'] }],
        ['e2e/task-integracao-estilo-sala.spec.ts'],
        comArquivo("test('a', () => {})"),
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
  const repeticoes = argv.includes('--vitoria') ? 3 : 1
  const PLANO = montarPlano(repeticoes)

  if (argv.includes('--listar')) {
    process.stdout.write(
      JSON.stringify(
        {
          raiz: RAIZ,
          url_editor: URL_EDITOR,
          url_jogador: URL_JOGADOR,
          jornadas_e2e: JORNADAS_E2E,
          jornada_fluidez: JORNADA_FLUIDEZ,
          invariantes: INVARIANTES,
          jornadas_unidade: JORNADAS_UNIDADE,
          plano: PLANO.map((p) => ({
            id: p.id,
            titulo: p.titulo,
            comando: p.sonda ? 'sonda HTTP/navegador interna' : [p.exe].concat(p.args).join(' '),
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

  const fase0 = rodarFase0(PLANO)
  imprimir('FASE 0 — auditoria do portão', fase0)
  const fase0Ruim = fase0.filter((r) => !r.ok)

  if (argv.includes('--fase0')) {
    process.stdout.write('\n' + (fase0Ruim.length === 0 ? 'PORTÃO ÍNTEGRO' : 'PORTÃO COMPROMETIDO: ' + fase0Ruim.length + ' achado(s)') + '\n')
    return fase0Ruim.length === 0 ? 0 : 1
  }

  // A escotilha de servidor limpo só funciona com a porta livre (vite strictPort).
  if (process.env.PORTAO_SERVIDOR_LIMPO === '1' && (await portaOcupada(PORTA))) {
    process.stdout.write(
      '\nPORTAO_SERVIDOR_LIMPO=1 pede um vite NOVO, mas a porta ' +
        PORTA +
        ' está ocupada. O vite deste repositório é `strictPort` (client/vite.config.ts:11-12): ele não cai para outra porta, morre.\n' +
        'Pare o `npm run dev` e rode de novo, ou rode sem PORTAO_SERVIDOR_LIMPO e deixe o passo `servidor-limpo` conferir o servidor que já está de pé.\n',
    )
    return 1
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
