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
 * Escrita em disco: o relatório, os artefatos de jornada e os recibos de
 * regressão, os três em %TEMP%/portao-labirinto/, mais o selo em
 * scripts/portao-selo.json. Os passos de cargo escrevem no `target` da árvore
 * PRINCIPAL (ver `ALVO_DO_CARGO`) — build ignorado pelo git, compartilhado por
 * todas as árvores e já quente; nunca fonte. Nenhum passo apaga ou sobrescreve
 * dado do repositório nem do usuário.
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
const net = require('net')
const crypto = require('crypto')
const { spawn, spawnSync } = require('child_process')
const { pathToFileURL } = require('url')

const RAIZ = path.resolve(__dirname, '..')
const CLIENTE = path.join(RAIZ, 'client')
const TAURI = path.join(RAIZ, 'desktop', 'src-tauri')
/**
 * A prova positiva do passo `rust-clippy`: o cargo NOMEOU o crate desta árvore.
 *
 * `Fresh` é o caso do cache cheio (com `-v`), `Checking` o do lint a fazer e
 * `Compiling` o do build frio — os três dizem que o crate entrou no grafo. O
 * caminho absoluto entre parênteses é o que separa ESTA árvore da vizinha: dois
 * worktrees do mesmo repositório rodam o mesmo código com o mesmo nome de crate,
 * e só o endereço difere. Case-insensitive porque no Windows o mesmo caminho
 * aparece com letra de unidade maiúscula ou minúscula conforme quem chamou.
 */
const PROVA_DE_CLIPPY_NESTA_ARVORE = new RegExp(
  '\\b(Fresh|Checking|Compiling)\\s+labirinto\\s+v\\d[^\\n(]*\\(' + TAURI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)',
  'i',
)
const SAIDA = path.join(os.tmpdir(), 'portao-labirinto')
/**
 * Uma pasta por passo de jornada. O Playwright APAGA o `outputDir` inteiro ao
 * começar, então rodar as jornadas uma a uma no `outputDir` padrão
 * (client/test-results) fazia cada passo destruir a prova do anterior — o
 * portão terminava com screenshot e trace só da última. Aqui cada passo recebe
 * `PORTAO_ARTEFATOS` próprio, em pasta temporária (Invariante 7).
 */
const ARTEFATOS = path.join(SAIDA, 'artefatos')
/**
 * Onde fica a PROVA de que a regressão rodou — um recibo por passo de
 * regressão, carimbado com a árvore e o estado exato em que ele saiu verde.
 *
 * POR QUE EXISTE. Em 21/09/2026 a rodada declarou 14 comandos e nenhum deles
 * era `jornadas-da-bar`: as jornadas de regressão não rodaram em lugar nenhum,
 * e a rodada podia ser declarada verde com qualquer uma delas quebrada. O
 * conserto daquela volta foi um AVISO em voz alta — e aviso não é portão: o
 * juiz da volta seguinte anotou que "nada fica vermelho por causa dele" e que
 * o invariante "nenhuma jornada já existente pode ficar vermelha" seguia sem
 * medida. Aqui ele vira passo: `regressao-em-dia` (ver `sondarRegressaoEmDia`)
 * sai VERMELHO enquanto não existir recibo verde da regressão para ESTA árvore
 * no estado de AGORA. Quem não rodar a regressão não consegue mais fechar a
 * volta comum em verde.
 */
const RECIBOS = path.join(SAIDA, 'recibos')
/** Os passos cuja ausência é regressão sem medida, e não recorte legítimo. */
const PASSOS_DE_REGRESSAO = ['jornadas-e2e', 'jornadas-da-bar', 'jornadas-entregues']
/**
 * UM diretório de build do cargo para TODAS as árvores, em vez de um por peça.
 *
 * MEDIDO em 21/09/2026, madrugada, nesta máquina. Os dois passos de Rust que o
 * portão exige (`rust-clippy` e `rust-test`) criam
 * `desktop/src-tauri/target` DENTRO da árvore em que rodam: 5,50 GB medidos no
 * worktree desta peça, do zero, só por rodar a lista de validade. A rodada tem
 * cinco peças de cliente, cada uma em worktree próprio, e o passo `disco` cobra
 * um piso de 3 GB livres — a conta não fecha em disco nenhum, e o que sobra é
 * `disco` VERMELHO para a peça que chegar depois, por sujeira que não é dela.
 * Foi exatamente o que aconteceu aqui: 0,32 GB livres depois de UM worktree.
 *
 * Compartilhar é seguro e não é preguiça. As dependências do crates.io são
 * byte a byte iguais entre as árvores (mesmo Cargo.lock), e o crate LOCAL não
 * colide porque o cargo carimba o hash de metadados do pacote com o caminho do
 * manifesto — cada worktree tem o seu, e `PROVA_DE_CLIPPY_NESTA_ARVORE` continua
 * cobrando que a linha `Fresh|Checking|Compiling labirinto` traga o caminho
 * DESTA árvore. Duas árvores que rodarem cargo ao mesmo tempo esperam no lock
 * do cargo ("Blocking waiting for file lock on build directory") e seguem em
 * série: mais lento que disputar disco, e muito melhor que ficar sem ele.
 *
 * ONDE fica: no `target` da ÁRVORE PRINCIPAL, e não numa pasta temporária.
 *
 * MEDIDO em 21/09/2026, depois da primeira volta desta peça. Apontar o alvo
 * para `%TEMP%/portao-labirinto/cargo-target` compartilhava, sim — mas
 * compartilhava uma pasta VAZIA. Os números da máquina na hora:
 *   C:/dev/labirinto/desktop/src-tauri/target   10,17 GB  (cache QUENTE, já pago)
 *   %TEMP%/portao-labirinto/cargo-target        ausente   (0 GB)
 *   disco livre                                  5,76 GB
 *   build frio do crate                          5,50 GB  (medido no worktree)
 * Ou seja: o primeiro `cargo` da rodada abandonaria 10 GB de cache pronto para
 * refazer tudo do zero com 0,26 GB de sobra sobre um piso de 3 GB — o mesmo
 * `os error 112` para o qual este arquivo já tinha mensagem escrita. Trocar
 * disco por disco não é economia.
 *
 * O `target` da árvore principal resolve as duas coisas ao mesmo tempo: é UM
 * diretório para todas as árvores (a intenção de antes) e é o que já está
 * quente (o que faltava). Continua sendo build, não fonte: `target/` é
 * ignorado pelo git, não entra em diff nenhum e a partição das peças
 * (`sondarParticao`) segue medindo o que o git vê. `PORTAO_ALVO_DO_CARGO`
 * troca o destino para quem quiser outro, e `vereditoDeDiscoParaCargo` recusa
 * rodar o cargo quando o alvo escolhido está FRIO e o disco não comporta o
 * build — o portão para antes de encher o disco, em vez de descobrir depois.
 */
function alvoDoCargo() {
  if (process.env.PORTAO_ALVO_DO_CARGO) return path.resolve(process.env.PORTAO_ALVO_DO_CARGO)
  // `--git-common-dir` é o `.git` da árvore PRINCIPAL, também quando se roda de
  // dentro de um worktree (onde `--git-dir` aponta para `.git/worktrees/<nome>`).
  const comum = String(git(['rev-parse', '--git-common-dir']) || '').trim()
  if (comum) {
    const principal = path.dirname(path.resolve(RAIZ, comum))
    if (fs.existsSync(path.join(principal, 'desktop', 'src-tauri', 'Cargo.toml'))) {
      return path.join(principal, 'desktop', 'src-tauri', 'target')
    }
  }
  // Sem git legível, o padrão do próprio cargo. Frio, e por isso o veredito de
  // disco (abaixo) é quem decide se ele pode rodar.
  return path.join(TAURI, 'target')
}
const ALVO_DO_CARGO = alvoDoCargo()
/**
 * Quantos deps já compilados fazem um alvo de cargo ser QUENTE.
 *
 * A pergunta é "o próximo cargo é incremental ou é build do zero?", e a
 * resposta barata está em `<alvo>/debug/deps`: o crate tem ~350 dependências
 * transitivas, então uma pasta com menos de 100 artefatos é cache pela metade
 * ou nenhum. Medir o TAMANHO da pasta custaria uma varredura de 10 GB a cada
 * chamada; contar entradas custa um `readdir`.
 */
const DEPS_DE_CARGO_QUENTE = 100
function cargoQuente(alvo) {
  try {
    if (!fs.existsSync(path.join(alvo, '.rustc_info.json'))) return false
    return fs.readdirSync(path.join(alvo, 'debug', 'deps')).length >= DEPS_DE_CARGO_QUENTE
  } catch (e) {
    return false
  }
}
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
 * O que ESTA rodada ainda vai escrever — a parte do disco que o passo cobra
 * além do piso.
 *
 * Antes daqui havia `FOLGA_DE_TRABALHO_GB = PISO + 3`, que o passo IMPRIMIA
 * como "alvo" e nunca cobrava: em 21/09/2026 ele mediu 2,77 GB de folga contra
 * um alvo declarado de 3,00 GB e saiu exit 0 dizendo, no mesmo parágrafo, que
 * "um worktree, um build ou uma pasta de trace derruba este passo NO MEIO do
 * run". Passo que contradiz o próprio texto e sai verde é falso-verde, mesmo
 * quando o texto está certo.
 *
 * Trocado por uma conta que o passo cobra de verdade: o piso MAIS o que falta
 * escrever. E cada um cobra o que ELE escreve, que não é a mesma coisa:
 *
 *   `disco`, uma vez por volta, cobra a VOLTA inteira (CUSTO_DE_VOLTA_GB):
 *     1,00 GB — trace e screenshot de todas as jornadas (0,06 GB medidos em
 *     %TEMP% em 21/09/2026) mais o build, arredondado para cima porque a volta
 *     da vencedora roda cada jornada 3x.
 *   a barreira de cada passo de cargo cobra só o CARGO daquele passo:
 *     frio      5,50 GB  medido em 21/09/2026, crate do zero num worktree
 *     quente    0,50 GB  medido no mesmo dia: com o alvo compartilhado quente,
 *                        `rust-clippy` (0,33 s) e `rust-test` (38 s) juntos
 *                        deixaram o target em 10,17 GB — o mesmo valor de
 *                        antes deles, com a casa de 0,01 GB da medida.
 *
 * Misturar os dois cobrava do cargo o disco das jornadas: em 21/09/2026, com
 * 3,86 GB livres, a barreira recusou um `clippy` incremental que precisava de
 * 0,05 GB e tinha acabado de rodar em 0,33 s. Cobrar de cada passo o que ele
 * causa é o que separa "não cabe" de "não quis".
 *
 * A régua continua mais dura que a de antes nas duas pontas: o piso sozinho
 * aprovava 3,01 GB livres com um build FRIO de 5,50 GB pela frente, e aprovava
 * uma volta inteira de jornadas sem folga nenhuma.
 */
const CUSTO_DE_BUILD_FRIO_GB = 5.5
const CUSTO_DE_BUILD_INCREMENTAL_GB = 0.5
const CUSTO_DE_VOLTA_GB = 1

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

/**
 * Qual peça é esta árvore, lida do nome do ramo. O run dá a cada peça um ramo
 * `auto/<id>`; a integração vive em `feat/...`. É o que distingue os dois modos
 * da Invariante 5 (ver `guardaParticao`) sem inventar variável de ambiente nova.
 */
function pecaDaArvore() {
  const ramo = String(git(['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim()
  const achado = /^auto\/(.+)$/.exec(ramo)
  return { ramo, peca: achado ? achado[1] : null }
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
/**
 * A porta que as JORNADAS vão usar — a mesma que `playwright.config.ts` lê de
 * `client/porta.js`. Guardada num const próprio porque o passo `servidor-limpo`
 * precisa comparar a porta que ele SONDOU com esta: sonda numa porta e jornada
 * em outra é verde sobre servidor que ninguém vai abrir (ver `guardaPortaDaSonda`).
 */
const PORTA_DAS_JORNADAS = portaDaArvore()
const URL_EDITOR = process.env.PORTAO_URL_EDITOR || 'http://localhost:' + PORTA_DAS_JORNADAS + '/'
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
  // A jornada DESTA peça (20/09/2026): rodar teste não escreve dentro do
  // repositório nem apaga a prova da corrida anterior. Nasce VERDE — é o
  // contrato do conserto de `outputDir` em client/playwright.config.ts —, então
  // o lugar dela é aqui, no passo que roda em toda volta, e não no critério.
  'e2e/task-jornada-portao-nao-apaga-prova.spec.ts',
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
/**
 * REGRESSÃO: o que já estava verde antes desta rodada e precisa CONTINUAR verde
 * em toda volta. É o lado do portão que roda sempre.
 */
const JORNADAS_DE_REGRESSAO_DA_BAR = [
  'e2e/task-jornada-ferramentas-mudas.spec.ts',
  'e2e/task-jornada-luz-que-para-na-parede.spec.ts',
  'e2e/task-jornada-token-com-foto.spec.ts',
  'e2e/task-jornada-pincel-balde-caminhos.spec.ts',
  'e2e/task-jornada-sala-livre.spec.ts',
  'e2e/task-jornada-pinos-ponto-de-interesse.spec.ts',
]
/**
 * ENTREGUES: jornadas de features JÁ ENTREGUES e provadas verdes no commit
 * juntado (HANDOFF.md, "Provas no commit juntado"). Moram aqui, e não no
 * critério, porque o critério só roda na PROVA: enquanto estavam lá, a volta
 * comum saía verde sem medir nenhuma delas — achado CONFIRMADO da varredura de
 * 23/09/2026. Aqui são REGRESSÃO: passo `jornadas-entregues`, volta comum,
 * recibo em `regressao-em-dia`. Jornada que sair vermelha por defeito real volta
 * para o critério com a nota do motivo — regressão é promessa de verde.
 */
const JORNADAS_ENTREGUES = [
  // 20/09/2026 — o marcador com ícone, dos cinco pedidos da noite.
  'e2e/task-jornada-marcador-com-icone.spec.ts',
  // 21/09/2026 — pino de viagem e várias cenas na mesma sessão, entrega 1
  // (plano aprovado em ~/.claude/plans/immutable-inventing-acorn.md): várias
  // cenas numa aventura, trocando com um clique e sobrevivendo a reabrir.
  'e2e/task-jornada-varias-cenas.spec.ts',
  // Entrega 2 do mesmo plano: pino de viagem no editor, ligado em mão dupla a
  // um pino de chegada noutra cena, e o painel dizendo para onde leva.
  'e2e/task-jornada-pino-de-viagem.spec.ts',
  // Entrega 3 do mesmo plano: cada jogador no mapa em que está o token dele,
  // indo para outra cena pelo pino de viagem com pedido e aprovação do mestre.
  'e2e/task-jornada-viagem-do-jogador.spec.ts',
  // 21/09/2026, noite — girar sala pela alça no mapa e pelo campo Rotação do
  // painel; sala, sub-salas, paredes e portas giram juntas, o conteúdo fica.
  'e2e/task-jornada-girar-sala.spec.ts',
  // 22/09/2026 — medir distância na tela do jogador: botão Medir, arrasto com
  // linha e rótulo no formato do mestre, só na tela dele, sem roubar o sinal.
  'e2e/task-jornada-medir-na-tela-do-jogador.spec.ts',
  // 22/09/2026 — defeitos do passeio de 20/09: Subtrair com o Pincel de blocos
  // abre buraco em vez de pintar, e a borracha diz que não apaga chão.
  'e2e/task-jornada-subtrair-abre-buraco.spec.ts',
  'e2e/task-jornada-borracha-diz-o-que-nao-apaga.spec.ts',
  // 22/09/2026, grupo espalhado G2 — passagem do pino de viagem: pede ao
  // mestre, livre ou trancada, cada pino do par com a sua.
  'e2e/task-jornada-modos-do-pino.spec.ts',
  // 22/09/2026, grupo espalhado G1 — painel do grupo na aba Jogo: uma linha
  // por jogador com a cena, Ir lá e Mandar para… sem pedido.
  'e2e/task-jornada-painel-do-grupo.spec.ts',
  // 22/09/2026 — defeitos do passeio de 20/09: salvar fora do app explica,
  // corredor aberto não some, atalho com foco no painel, acervo recebe token.
  'e2e/task-jornada-salvar-fora-do-app-explica.spec.ts',
  'e2e/task-jornada-corredor-aberto-nao-some.spec.ts',
  'e2e/task-jornada-atalho-com-foco-no-painel.spec.ts',
  'e2e/task-jornada-acervo-recebe-token.spec.ts',
  // 22/09/2026, grupo espalhado G3 — lista Cenas com as bolinhas de quem está
  // em cada cena e selo de pedido esperando. A queda do socket é repassada ao
  // mestre como net:peer só quando a página do jogador fecha de verdade.
  'e2e/task-jornada-cenas-com-gente.spec.ts',
  // 22/09/2026, grupo espalhado G4 — com 2 ou mais pedidos esperando, os
  // avisos viram uma caixa "Pedidos (N)" com linha por pedido e Deixar todos.
  'e2e/task-jornada-caixa-de-pedidos.spec.ts',
  // (G5, reunir-o-grupo, voltou para o critério — ver a nota lá.)
  // 22/09/2026, grupo espalhado G6 — sinal de jogador em cena de fundo vira
  // aviso "<jogador> chamou em <cena>" com Ir lá, um por jogador.
  'e2e/task-jornada-chamado-de-fundo.spec.ts',
  // 22/09/2026, grupo espalhado G7 — seguir jogador: a câmera do mestre
  // acompanha a ficha, inclusive trocando de cena; mexer no mapa desliga.
  'e2e/task-jornada-seguir-jogador.spec.ts',
  // 22/09/2026, grupo espalhado G8 — encruzilhada: pino de viagem com várias
  // saídas nomeadas pelo mestre; o jogador escolhe pelo nome da saída.
  'e2e/task-jornada-encruzilhada.spec.ts',
  // 22/09/2026, grupo espalhado G9 — mão única: a chegada fica oculta ao
  // jogador e não leva de volta.
  'e2e/task-jornada-chegada-oculta.spec.ts',
  // 22/09/2026, grupo espalhado G11 — recado do mestre só para quem está numa
  // cena, texto puro, nada para as outras cenas.
  'e2e/task-jornada-recado-por-cena.spec.ts',
]
/**
 * CRITÉRIO: as três do passeio de usuário de 18/09/2026. Entram na bar para
 * ganharem o selo e a auditoria arquivo a arquivo da FASE 0 — sem isso,
 * `jornadas-intactas` não as protege e um builder poderia afrouxar a própria
 * régua sem o portão piscar.
 *
 * Nascem VERMELHAS de propósito: são o critério de conserto, não regressão. É
 * exatamente por isso que elas NÃO podem estar no mesmo grupo da regressão —
 * ver `GRUPOS_DA_BAR`.
 */
const JORNADAS_DO_CRITERIO = [
  'e2e/task-jornada-camada-travada.spec.ts',
  'e2e/task-jornada-poligono-termina.spec.ts',
  'e2e/task-jornada-menu-cabe-na-janela.spec.ts',
  // A quarta jornada da noite de 18/09: a ferramenta Escada muda.
  'e2e/task-jornada-escada-fala.spec.ts',
  // 18/09/2026, manhã, nas palavras do usuário: "o pino, eu consigo colocar,
  // não consigo tirar". Delete e Backspace não alcançavam o pino.
  'e2e/task-jornada-pino-apaga-com-delete.spec.ts',
  // 18/09/2026, tarde: teto de construção. O jogador vê o prédio fechado e
  // nada do interior; o teto abre quando o token dele entra e fecha quando sai.
  'e2e/task-jornada-teto-de-construcao.spec.ts',
  // 18/09/2026, noite, nas palavras do usuário: "eu queria que eu pudesse
  // salvar Tokens pre prontos, tipos tokens de npcs e afins para colocar para
  // os jogadores". O acervo é GLOBAL do app: sobrevive ao outro mapa e ao
  // reinício, e é isso que a jornada mede (disco falso que atravessa o reload).
  'e2e/task-jornada-acervo-de-tokens.spec.ts',
  // -------------------------------------------------------------------------
  // 20/09/2026, noite — as jornadas DESTA rodada.
  //
  // Elas já estavam COMMITADAS no repositório (4b9a9de e 41c3a7a) e fora desta
  // lista, e uma omissão só produziu três falso-verdes ao mesmo tempo:
  //   - `--so=jornadas-do-criterio` saía exit 0 julgando o critério de 18/09,
  //     com as oito desta noite vermelhas e fora de qualquer linha de comando;
  //   - o SELO não as cobria (`JORNADAS_SELADAS` deriva desta lista), então um
  //     builder podia afrouxar a própria régua sem o portão piscar;
  //   - a FASE 0 imprimia PORTÃO ÍNTEGRO sem ter auditado nenhuma delas
  //     (`TODAS_JORNADAS_E2E` também deriva daqui).
  // Estes oito nomes são o conserto de hoje; `guardaJornadaNovaSemComando`
  // (g27) é o que impede a omissão de voltar a passar em silêncio.
  //
  // Os cinco pedidos da noite:
  'e2e/task-jornada-caminho-com-cor-propria.spec.ts',
  'e2e/task-jornada-etiqueta-pilula.spec.ts',
  'e2e/task-jornada-linha-pontilhada.spec.ts',
  // (marcador-com-icone foi para `JORNADAS_ENTREGUES` em 23/09/2026.)
  'e2e/task-jornada-saida-sem-parede.spec.ts',
  // As três do acervo, escritas depois do passeio de usuário: trocar a foto do
  // token não troca o que aparece na tela, o aviso de escolher imagem some
  // sozinho aos 7 segundos, e apagar item com o arquivo travado engole a falha
  // num catch mudo (o app diz que apagou e a foto fica no disco).
  // 21/09/2026, manhã — os três achados do passeio de usuário que têm convenção
  // demonstrada em produto público. Dois deles foram RE-MIRADOS pelo testador
  // depois de medir: o duplo clique FECHA a forma hoje (o defeito é a janela fixa
  // de 500 ms do Chromium, que ignora o duplo clique mais lento do Windows), e a
  // alça de seleção EXISTE, mas é um quadrado de 7 px na mesma cor do contorno.
  // 21/09/2026, manhã — as três primeiras da fila de features candidatas
  // (docs/features-candidatas-2026-09-21.md): o que a mesa faz no olhômetro
  // hoje (quantos quadrados o token andou) e o que o painel não deixa dizer
  // (cor e tamanho da ficha).
  // (23/09/2026: as entregues daqui — várias cenas, pino de viagem, viagem do
  // jogador, girar sala, medir na tela do jogador, os defeitos de 20/09, G1-G9 e
  // G11 — foram para `JORNADAS_ENTREGUES`, que roda na volta comum.)
  // 22/09/2026, grupo espalhado G5 — reunir o grupo num pino: fichas marcadas
  // vêm de qualquer cena para casas livres em volta dele.
  // NOTA (23/09/2026): entregue e provada no commit juntado, mas VERMELHA no
  // acervo 8f5d7e3 rodando SOZINHA (`--workers=1`, 3 passed / 2 failed em 12,4
  // min): os testes 3 e 4 caem em `cameraDoMestre` com "o canvas do mestre não
  // tem caixa" (`locator('canvas').first().boundingBox()` nulo) — e a foto da
  // falha mostra as três fichas já reunidas em volta do pino. Não é carga (as
  // outras que caíram na volta cheia passaram sozinhas); é régua ou produto, a
  // investigar. Fica aqui até alguém dizer qual dos dois e consertar.
  'e2e/task-jornada-reunir-o-grupo.spec.ts',
  // 22/09/2026, grupo espalhado G10 — viajar junto: no aviso do pedido, levar
  // também quem está a até 2 casas de quem pediu.
  'e2e/task-jornada-viajar-junto.spec.ts',
  // 22/09/2026, grupo espalhado G12 — pausa por cena: quem está na cena
  // pausada não anda e lê o aviso; as outras cenas seguem.
  'e2e/task-jornada-pausa-por-cena.spec.ts',
  // 22/09/2026, grupo espalhado G13 — companheiros na tela do jogador: aqui,
  // em outro lugar ou fora, nunca o nome da cena.
  'e2e/task-jornada-companheiros-do-jogador.spec.ts',
  // 22/09/2026, grupo espalhado G14 — visão geral: miniaturas de todas as
  // cenas com as fichas em cima; clicar abre a cena.
  'e2e/task-jornada-visao-geral-das-cenas.spec.ts',
  // 22/09/2026, fila antiga e grupo G15 — réguas nascidas vermelhas:
  // salvamento automático, diário de viagens, copiar e colar, laser do
  // jogador, tela de atalhos, tocha presa na ficha, pincel revelar/esconder,
  // espelhar a tela do jogador, lista de objetos, ficha andando suave no
  // jogador, barra de vida, dado na sala, exportar PNG, condição na ficha,
  // iniciativa, agrupar objetos, alinhar e distribuir.
  'e2e/task-jornada-salvamento-automatico.spec.ts',
  'e2e/task-jornada-diario-de-viagens.spec.ts',
  'e2e/task-jornada-copiar-e-colar.spec.ts',
  'e2e/task-jornada-laser-do-jogador.spec.ts',
  'e2e/task-jornada-tela-de-atalhos.spec.ts',
  'e2e/task-jornada-tocha-presa-na-ficha.spec.ts',
  'e2e/task-jornada-pincel-revelar-esconder.spec.ts',
  'e2e/task-jornada-espelhar-tela-do-jogador.spec.ts',
  'e2e/task-jornada-lista-de-objetos.spec.ts',
  'e2e/task-jornada-ficha-anda-suave-no-jogador.spec.ts',
  'e2e/task-jornada-barra-de-vida.spec.ts',
  'e2e/task-jornada-dado-na-sala.spec.ts',
  'e2e/task-jornada-exportar-png.spec.ts',
  'e2e/task-jornada-condicao-na-ficha.spec.ts',
  'e2e/task-jornada-iniciativa.spec.ts',
  'e2e/task-jornada-agrupar-objetos.spec.ts',
  'e2e/task-jornada-alinhar-e-distribuir.spec.ts',
  'e2e/task-jornada-quadrados-ao-arrastar-token.spec.ts',
  'e2e/task-jornada-cor-do-token.spec.ts',
  'e2e/task-jornada-tamanho-do-token-em-quadrados.spec.ts',
  'e2e/task-jornada-texto-recebe-o-que-se-digita.spec.ts',
  'e2e/task-jornada-duplo-clique-fecha-a-forma.spec.ts',
  'e2e/task-jornada-selecao-mostra-alcas.spec.ts',
  'e2e/task-jornada-acervo-foto-certa.spec.ts',
  'e2e/task-jornada-apagar-limpa-disco.spec.ts',
  'e2e/task-jornada-salvar-sem-foto-avisa.spec.ts',
  // AS DUAS QUE A g27 ACHOU SOZINHA, e que nenhum humano tinha notado: elas
  // entraram na tarde de 18/09 declaradas no manifesto (`pecas`.`teto`), foram
  // commitadas, e passo NENHUM do portão jamais as rodou — duas rodadas
  // inteiras de gauntlet passaram por cima delas. Ficam aqui, no grupo do
  // critério, porque ninguém mediu se estão verdes: grupo de regressão é
  // promessa de verde em toda volta, e promessa sem medida é o falso-verde que
  // este arquivo existe para não fazer.
  'e2e/task-jornada-item-travado.spec.ts',
  'e2e/task-jornada-pino-move-e-cartao-direita.spec.ts',
  // 23/09/2026, simulação de 7 jogadores, onda 1 (C:/dev/backlog-simulacao-7-jogadores.md):
  // réguas escritas para SAIR VERMELHAS no código de hoje, uma por item do backlog.
  'e2e/task-jornada-atribuir-livres-primeiro.spec.ts',
  'e2e/task-jornada-chegada-em-casa-livre.spec.ts',
  'e2e/task-jornada-so-a-propria-ficha-arrasta.spec.ts',
  'e2e/task-jornada-mapa-livre-do-painel.spec.ts',
  'e2e/task-jornada-zoom-no-celular.spec.ts',
  'e2e/task-jornada-nome-publico-da-ficha.spec.ts',
  'e2e/task-jornada-sala-secreta-nao-vaza.spec.ts',
  'e2e/task-jornada-zona-oculta-sem-buraco.spec.ts',
]
/**
 * A bar inteira, na ordem de sempre: é esta lista que o SELO carimba e que a
 * auditoria arquivo a arquivo da FASE 0 percorre. Concatenar os dois grupos
 * mantém a ordem byte a byte da lista anterior — o selo não se mexe.
 */
const JORNADAS_DA_BAR = JORNADAS_DE_REGRESSAO_DA_BAR.concat(JORNADAS_ENTREGUES, JORNADAS_DO_CRITERIO)
/**
 * O PORTÃO ESTÁ DIVIDIDO EM DOIS DE PROPÓSITO, e a divisão mora aqui.
 *
 * `guardaListaDeJornadas` cobra COMPLETUDE — quem roda alguma jornada da bar
 * roda todas. Com a bar sendo uma lista só, isso virou um deadlock de desenho
 * nas rodadas 3 e 4: o comando de REGRESSÃO (as 6 que já estavam verdes) era
 * acusado de omitir as 3 do critério, e o comando de PROVA (as 3 do critério)
 * era acusado de omitir as 6 da regressão. Os dois saíam em exit 2 ANTES do
 * Playwright, e o run inteiro rodava ZERO jornada — falso-verde disfarçado de
 * erro. Nenhuma peça conseguia passar, nem a do próprio portão, porque as
 * jornadas do critério só ficam verdes DEPOIS que as peças de cliente
 * consertam os defeitos.
 *
 * A completude continua valendo, mas DENTRO de cada grupo: rodar 5 das 6 da
 * regressão é vermelho, rodar 2 das 3 do critério é vermelho. O que deixa de
 * ser exigido é misturar os dois lados na mesma linha de comando — e o verde
 * diz em voz alta qual grupo NÃO entrou, para que a omissão continue audível.
 */
const GRUPOS_DA_BAR = [
  { id: 'regressao', titulo: 'regressão (tem de estar verde em TODA volta)', jornadas: JORNADAS_DE_REGRESSAO_DA_BAR },
  { id: 'entregues', titulo: 'features entregues (regressão: verde em TODA volta)', jornadas: JORNADAS_ENTREGUES },
  { id: 'criterio', titulo: 'critério desta rodada (vermelho até a peça consertar; roda na volta da PROVA)', jornadas: JORNADAS_DO_CRITERIO },
]
/**
 * Jornada da bar DISPENSADA desta rodada, com o motivo escrito — a única forma
 * de sair da lista do comando 15 sem ser omissão.
 *
 * A lista de specs daquele comando é digitada à mão pelo orquestrador (as 9 da
 * bar menos a dispensada), e nada a conferia: omitir uma das jornadas do
 * critério devolvia exit 0 com um `N passed` de aparência impecável. Quem julga
 * não pode depender de alguém lembrar de digitar oito caminhos certos.
 * `guardaListaDeJornadas` cobra a lista completa; este objeto é a exceção
 * declarada, e o motivo dela sai impresso no verde.
 */
const JORNADAS_DISPENSADAS = {
  'e2e/task-jornada-ferramentas-mudas.spec.ts':
    'Invariante 11 do run de 18/09/2026: duas das três asserções cobram o contrário de NEW_MAP_SHOW_GRID = false, ' +
    'decisão de produto já tomada pelo usuário. Pendência da manhã — não é licença para quebrar a jornada.',
}

/**
 * REGRESSÃO das telas que as peças desta rodada reestruturam.
 *
 * O repositório tem 88 specs em `client/e2e`; o portão citava 25. Os 63 de fora
 * não tinham comando NENHUM — e quatro deles dirigem exatamente o que a peça
 * `menu-cabe-na-janela` vai mexer: o menu 'Opções de Chão'
 * (task-floor-pieces.spec.ts:74-75) e o `ToolVariantMenu` da setinha
 * (task-drawing-group.spec.ts:30, task-fase5-variantes, task-new-shapes).
 * Medido em 18/09/2026 pelo modo `--jornada=`: os 14 testes destes quatro
 * arquivos passam hoje. Sem eles na lista, um builder podia reestruturar
 * `ToolVariantMenu.tsx` e `toolVariants.ts`, quebrar as quatro telas, e os 15
 * comandos do portão seguirem verdes.
 *
 * Entram no passo `jornadas-e2e` (as já entregues, que só têm de continuar
 * passando) e no SELO, mas NÃO na auditoria arquivo a arquivo da FASE 0: eles
 * não foram escritos com a régua das jornadas da bar (prova por gesto, teto com
 * controle positivo), e cobrar isso deles agora reprovaria o portão inteiro por
 * causa de spec antigo — vermelho que nenhuma peça desta rodada pode consertar.
 * O que se cobra deles é o que eles provam: continuam passando.
 *
 * Os outros 59 seguem fora, com endereço: `client/e2e/task-room-tool.spec.ts` e
 * `client/e2e/task-room-circle-polygon.spec.ts` já falham hoje (5 testes,
 * anterior a esta rodada) e entrar com eles seria vermelho herdado.
 */
const JORNADAS_REGRESSAO_MENUS = [
  'e2e/task-drawing-group.spec.ts',
  'e2e/task-fase5-variantes.spec.ts',
  'e2e/task-floor-pieces.spec.ts',
  'e2e/task-new-shapes.spec.ts',
]
/**
 * REGRESSÃO dos TRÊS ALVOS desta rodada — o buraco que sobrava depois da
 * regressão dos menus.
 *
 * O que estava errado: dos três defeitos que as peças vão consertar, só o do
 * menu tinha regressão (`JORNADAS_REGRESSAO_MENUS`, 4 specs). O cadeado de
 * camada e o encerramento do polígono tinham UM comando cada — as jornadas do
 * CRITÉRIO —, e essas nascem VERMELHAS e só rodam na volta da PROVA
 * (`prova: true`). Enquanto elas estão vermelhas, elas não distinguem "a peça
 * ainda não consertou" de "a peça quebrou o que já funcionava": nenhum comando
 * da volta comum tocava `selectionHitTest.ts` nem o rascunho do Polígono em
 * `PixiCanvas.tsx`. Uma peça podia arrastar o hit-test de camada para o lixo e
 * os 13 comandos que rodam de verdade saírem verdes.
 *
 * Estes seis specs são a rede embaixo dos alvos. Escolhidos por DUAS provas,
 * não por nome: (1) dirigem o arquivo-alvo declarado de alguma peça; (2) estão
 * VERDES hoje, medido em 18/09/2026 na base desta rodada —
 * `--jornada=cobertura-dos-alvos` com os seis: `25 passed (21.6s)`, exit 0.
 * Spec vermelho antes da rodada não entra: seria vermelho herdado, que peça
 * nenhuma consegue consertar (por isso `task-alignment-door-curve-portal.spec.ts`
 * ficou de fora — `1 failed` hoje, anterior a este run, como os 5 de
 * task-room-tool/task-room-circle-polygon).
 *
 * Endereço de cada um contra o alvo que ele protege:
 *  - task-rascunho-desfazer.spec.ts:97 — o rascunho ponto a ponto do Polígono
 *    (alvo de `poligono-termina`: a condição do Enter sobre `polygonDraftPoints`).
 *  - task-layers-visibility.spec.ts:54 — o hit-test por camada
 *    (alvo de `camada-travada`: client/src/lib/selectionHitTest.ts).
 *  - task-background-convert-menu.spec.ts, task-drawing-tools.spec.ts,
 *    task-ctrl-reto.spec.ts, task-jornada-barra-honesta.spec.ts — menu de
 *    variante e barra de ferramentas (alvo de `menu-cabe-na-janela`:
 *    ToolVariantMenu.tsx + toolVariants.ts).
 *
 * Entram no passo `jornadas-e2e` (que a volta comum alcança) e no SELO, pela
 * mesma porta dos specs de menu: são rastreados pelo git, então o hash sai do
 * commit base do run e o selo não precisa ser recarimbado. Não entram na
 * auditoria arquivo a arquivo da FASE 0, pelo mesmo motivo já escrito acima —
 * não foram escritos com a régua das jornadas da bar.
 */
const JORNADAS_REGRESSAO_DOS_ALVOS = [
  'e2e/task-rascunho-desfazer.spec.ts',
  'e2e/task-layers-visibility.spec.ts',
  'e2e/task-background-convert-menu.spec.ts',
  'e2e/task-drawing-tools.spec.ts',
  'e2e/task-ctrl-reto.spec.ts',
  'e2e/task-jornada-barra-honesta.spec.ts',
]
/** Tudo que a FASE 0 audita arquivo a arquivo — a de fluidez inclusive. */
const TODAS_JORNADAS_E2E = JORNADAS_E2E.concat([JORNADA_FLUIDEZ, JORNADA_ESTILO, JORNADA_VISTA_MOVEL], JORNADAS_DA_BAR)
/**
 * As jornadas que o selo PROTEGE (Invariante 6). Eram só as 9 da bar: fluidez,
 * estilo, vista-móvel e as 7 já entregues ficavam sem hash nenhum — e são
 * exatamente as réguas que uma peça tem motivo para afrouxar quando o conserto
 * dela quebra uma entrega antiga. Agora são as 19 jornadas e2e.
 *
 * Quem não estiver no `portao-selo.json` não fica sem juiz: `guardaJornadasIntactas`
 * compara essa jornada com o conteúdo dela no COMMIT BASE do run (as 19 são
 * rastreadas pelo git). Sem selo E sem base é vermelho, nunca silêncio.
 *
 * 18/09/2026 — entram também os quatro specs de REGRESSÃO dos menus. É por essa
 * porta que eles ganham hash sem o selo precisar ser tirado de novo: são
 * rastreados pelo git, então "como estavam quando as peças saíram" sai do commit
 * base do run. Afrouxar o spec que prova que o menu ainda abre é tão barato
 * quanto afrouxar uma jornada da bar.
 */
const JORNADAS_SELADAS = TODAS_JORNADAS_E2E.concat(JORNADAS_REGRESSAO_MENUS, JORNADAS_REGRESSAO_DOS_ALVOS)
const JORNADAS_UNIDADE = [
  'src/lib/mapFile.persistencia.test.ts',
  'src/lib/mapFileIO.persistencia.test.ts',
  'src/lib/mapFactory.porta-tipo.test.ts',
  // Invariante 3 sem nome de campo escrito à mão: campo novo entra na
  // cobertura no mesmo commit em que nasce.
  'src/lib/mapFile.invariante3.test.ts',
]

/**
 * 18/09/2026 — a AUDITORIA DA UNIDADE deixou de ser uma lista escrita à mão.
 *
 * A lista acima tem 4 nomes e a suíte tem 139 arquivos: 135 arquivos de teste
 * passavam pela FASE 0 sem nenhuma guarda arquivo-a-arquivo, e eles moram
 * dentro da área de escrita de TODAS as peças de cliente (`client/src/**` no
 * manifesto de partição). Apagar `client/src/lib/areaSelection.test.ts` era
 * aprovado por `--so=particao` (está na área da peça) e por `--so=unidade`
 * (vitest sai verde com o que sobrou). Agora a lista auditada é DESCOBERTA no
 * git, não digitada, e por isso não tem como ficar para trás do repositório.
 *
 * Os 4 continuam existindo: eles são os que a FASE 0 audita na régua ESTRITA,
 * linha a linha, junto das jornadas e2e. Os outros 135 entram em guardas de
 * lote (g21/g22/g23), que julgam o mesmo texto e nomeiam o arquivo quando
 * reprovam — sem despejar 400 linhas de verde em cada uma das 16 chamadas.
 */
function arquivosDeUnidade() {
  const saida = git(['ls-files', 'client/src/**/*.test.ts', 'client/src/**/*.test.tsx'])
  if (saida === null) return null
  return saida
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^client\//, ''))
    .sort()
}

/**
 * Os arquivos de teste de unidade que existem NO DISCO agora — não no índice do
 * git. Achado da auditoria de 23/09/2026: `git ls-files` continua listando um
 * arquivo apagado do disco sem `git rm`, então a contagem pelo índice não
 * encolhia e a g24 saía verde com o teste fora.
 */
function arquivosDeUnidadeNoDisco() {
  let nomes
  try {
    nomes = fs.readdirSync(path.join(CLIENTE, 'src'), { recursive: true })
  } catch (e) {
    return null
  }
  return nomes
    .map((n) => 'src/' + String(n).split(path.sep).join('/'))
    .filter((n) => /\.test\.tsx?$/.test(n) && n.indexOf('/node_modules/') === -1)
    .sort()
}

/**
 * O JUIZ DO ACERVO: o `merge-base` entre esta árvore e `auto/acervo`.
 *
 * `auto/acervo` é o ramo do orquestrador: tudo o que está no merge-base foi
 * escrito ANTES desta árvore divergir, ou trazido por merge do próprio acervo,
 * e nenhum commit desta árvore o move. É o juiz da suíte de unidade (g24) e das
 * réguas (g35). A base do run (`baseDoRun`, do manifesto de partição) ficou
 * velha — `auto/base-pecas-21set`, 144 arquivos de teste contra 189 medidos
 * em 23/09/2026 —, e juiz velho deixa sem piso tudo o que nasceu depois dele.
 * O nome do ramo é constante AQUI, e não variável de ambiente: quem é julgado
 * não escolhe o juiz.
 */
const REF_DO_ACERVO = 'auto/acervo'
/** Ramos onde régua PODE mudar: o acervo e as lanes de réguas/infra do orquestrador. */
const RAMOS_DE_REGUAS = /^auto\/(acervo|lane-infra|reguas-[\w.-]+)$/
let juizDoAcervoMemo = null
function juizDoAcervo() {
  if (juizDoAcervoMemo) return juizDoAcervoMemo
  const ramo = String(git(['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim() || '?'
  const base = String(git(['merge-base', 'HEAD', REF_DO_ACERVO]) || '').trim() || null
  juizDoAcervoMemo = base
    ? { ramo, base, ref: 'merge-base(HEAD, ' + REF_DO_ACERVO + ') = ' + base.slice(0, 8), erro: null }
    : { ramo, base: null, ref: null, erro: 'sem merge-base com ' + REF_DO_ACERVO + ' (o ramo existe nesta máquina?)' }
  return juizDoAcervoMemo
}

/** Os mesmos arquivos COMO ESTAVAM no commit base do run — o juiz de quem encolheu. */
function arquivosDeUnidadeNaBase(base) {
  if (!base) return null
  const saida = git(['ls-tree', '-r', '--name-only', base, '--', 'client/src'])
  if (saida === null) return null
  return saida
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /\.test\.tsx?$/.test(s))
    .map((s) => s.replace(/^client\//, ''))
    .sort()
}

/**
 * As jornadas que NASCERAM nesta rodada — descobertas no git, não digitadas.
 *
 * POR QUE EXISTE (20/09/2026). As oito jornadas desta noite entraram
 * commitadas no repositório e ficaram fora de `JORNADAS_DO_CRITERIO`. Nenhuma
 * guarda notou: `g8-jornadas-existem` só confere as que a lista DECLARA, e o
 * detector de falso-verde julga o relatório do que rodou — o que nunca entrou
 * em linha de comando nenhuma não deixa rastro em relatório nenhum. Resultado:
 * `--so=jornadas-do-criterio` exit 0 julgando a rodada anterior, selo sem
 * hash delas, e FASE 0 imprimindo PORTÃO ÍNTEGRO sem tê-las lido.
 *
 * A pergunta certa não é "as listas estão completas?" — quem responde a essa é
 * quem escreveu a lista. É "o repositório ganhou jornada que comando nenhum
 * alcança?", e essa o git responde sozinho, toda rodada, sem ninguém lembrar.
 *
 * O recorte é NOVIDADE, não o repositório inteiro, de propósito: `client/e2e`
 * tem 45 specs de jornada e o PLANO alcança pouco mais de vinte. Cobrar
 * comando das 20 antigas seria vermelho herdado, que peça nenhuma desta rodada
 * consegue consertar — o mesmo motivo já escrito em `JORNADAS_REGRESSAO_MENUS`.
 * Jornada escrita DEPOIS da base do run é outra história: ela é o critério
 * desta rodada, e critério sem comando é critério que ninguém cobra.
 */
function jornadasNovasDesdeABase(base) {
  if (!base) return null
  const acrescentadas = git(['diff', '--name-only', '--diff-filter=A', base, 'HEAD', '--', 'client/e2e'])
  const naArvore = git(['ls-files', '--others', '--exclude-standard', 'client/e2e'])
  if (acrescentadas === null && naArvore === null) return null
  const vistas = new Set()
  return String((acrescentadas || '') + '\n' + (naArvore || ''))
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^client\/e2e\/.+\.spec\.ts$/.test(s))
    .map((s) => s.replace(/^client\//, ''))
    .filter((s) => (vistas.has(s) ? false : (vistas.add(s), true)))
    .sort()
}

/**
 * Os specs que o PLANO realmente alcança — lidos das LINHAS DE COMANDO, não das
 * listas que as montam. É a diferença entre "está declarado numa constante" e
 * "entra num `npx playwright test`": a constante pode existir e nenhum passo
 * usá-la, e foi por aí que `JORNADAS_DO_CRITERIO` passou a julgar a rodada
 * errada sem nada ficar vermelho.
 */
function specsDoPlano(plano) {
  const alcancados = new Set()
  for (const passo of plano || []) {
    for (const arg of passo.args || []) {
      const texto = String(arg)
      if (/\.spec\.ts$/.test(texto)) alcancados.add(texto)
    }
  }
  return alcancados
}

/** Jornada nascida nesta rodada que nenhum passo do PLANO roda é critério sem cobrança. */
function guardaJornadaNovaSemComando(novas, alcancados, medida) {
  const m = medida || {}
  if (novas === null) {
    return reprova(
      'g27-jornada-nova-sem-comando',
      'não deu para descobrir as jornadas desta rodada: ' + (m.erro || 'git não respondeu ao diff contra a base do run') +
        '. Sem essa lista, jornada nova fica sem cobrança e o portão não sabe.',
      'scripts/portao-particao.json ("base") + scripts/portao.cjs (jornadasNovasDesdeABase)',
    )
  }
  const orfas = novas.filter((arquivo) => !alcancados.has(arquivo))
  if (orfas.length > 0) {
    return reprova(
      'g27-jornada-nova-sem-comando',
      orfas.length + ' jornada(s) escrita(s) nesta rodada que passo NENHUM do portão roda: ' + orfas.join(', ') +
        '. Enquanto elas estiverem fora, `--so=jornadas-do-criterio` sai verde julgando a rodada anterior, o selo não as cobre e a FASE 0 não as lê.' +
        ' Acrescente cada uma a `JORNADAS_DO_CRITERIO` (ou ao grupo de regressão, se já nasceu verde).',
      'scripts/portao.cjs (JORNADAS_DO_CRITERIO) + client/e2e',
    )
  }
  return ok(
    'g27-jornada-nova-sem-comando',
    novas.length === 0
      ? 'nenhuma jornada nova desde a base do run (' + (m.ref || '?') + ')'
      : novas.length + ' jornada(s) nova(s) desde ' + (m.ref || '?') + ', todas alcançadas por algum passo do PLANO',
  )
}

/**
 * Piso de ESCALA da suíte de unidade. O passo `unidade` declarava só `ruína` e
 * nenhuma prova positiva de tamanho: rodar a suíte reduzida a UM arquivo saía
 * `1 passed`, exit 0, sem `skipped` — verde idêntico ao dos 139. Medido em
 * 18/09/2026 com o mesmo binário do passo.
 *
 * O piso de ARQUIVOS não está escrito aqui de propósito: ele é contado no
 * commit base do run (`arquivosDeUnidadeNaBase`), então uma peça que apaga um
 * arquivo de teste derruba a contagem de agora sem conseguir mexer no juiz.
 * O piso de TESTES é um número declarado porque não existe forma de contar
 * caso de teste sem rodar a suíte; ele mora em `scripts/portao.cjs`, que está
 * FORA da área de escrita de toda peça de cliente (Invariante 5). Piso só
 * sobe: acrescentar teste mantém o verde, tirar teste fica vermelho.
 *
 * 18/09/2026, Fase 0 do run do teto: o piso estava em 2290 contra 2299 medidos
 * na árvore. Nove testes de folga é o bastante para apagar do disco um arquivo
 * pequeno (`fogFilter.vazamento.test.ts`, 4 testes) sem `git rm`, acrescentar
 * um arquivo trivial e sair verde com o teste de vazamento do jogador fora —
 * a guarda de ARQUIVOS conta pelo índice do git, não pelo disco. Subido para o
 * medido.
 *
 * 23/09/2026: 2299 estava velho de cinco dias — a suíte tinha 2850 testes em
 * 189 arquivos (medido em lane-defeitos, lane-passeio e no instantâneo da G12,
 * todos no mesmo acervo). Com 551 testes de folga dava para apagar arquivos
 * inteiros e sair verde. Subido para o medido.
 */
const PISO_DE_TESTES_DE_UNIDADE = 2850

/**
 * Relatório de vitest sintético, só para o autoteste das guardas: os fixtures
 * do passo `unidade` derivam do piso em vez de repetir o número, senão subir o
 * piso pinta o autoteste de vermelho e o conserto barato vira baixar o piso.
 */
function relatorioDeUnidade(arquivos, testes) {
  return ' Test Files  ' + arquivos + ' passed (' + arquivos + ')\n      Tests  ' + testes + ' passed (' + testes + ')\n'
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

/**
 * g24 — a suíte de unidade não ENCOLHEU desde a base do run.
 *
 * O piso de arquivos do passo `unidade` é contado aqui, no commit base: é um
 * fato do repositório, não um número que uma peça possa baixar. Apagar um
 * arquivo de teste derruba a contagem de agora e deixa o piso onde estava.
 * Renomear não reprova (a contagem não muda), apagar reprova com o nome.
 *
 * 23/09/2026 — O CONJUNTO, não a contagem. A auditoria da Fase 0 das lanes
 * G10/G12/G13 apagou `mandarPara.test.ts` e `hostBridge.test.ts` e o passo saiu
 * VERDE: a contagem era pelo índice do git (o arquivo apagado continuava lá) e
 * trocar um arquivo por outro não mudava o número. Agora `agora` vem do DISCO
 * (`arquivosDeUnidadeNoDisco`), `naBase` do juiz do acervo, e TODO arquivo da
 * base tem de existir — sumido é vermelho com o nome, mesmo que a suíte tenha
 * crescido. Renomear passa a reprovar: o nome antigo sumiu.
 */
function guardaEscalaDaUnidade(agora, naBase, medida) {
  if (!naBase) {
    return reprova(
      'g24-unidade-nao-encolheu',
      'sem base para contar a suíte de unidade: ' + ((medida && medida.erro) || 'base do run não resolveu') +
        ' — sem juiz, `1 passed` e `2290 passed` são o mesmo verde',
      'scripts/portao-particao.json ("base")',
    )
  }
  if (!agora) {
    return reprova('g24-unidade-nao-encolheu', 'não deu para listar os arquivos de teste do disco (client/src)', 'client/src')
  }
  const noDisco = new Set(agora)
  const sumiram = naBase.filter((a) => !noDisco.has(a))
  if (sumiram.length > 0 || agora.length < naBase.length) {
    return reprova(
      'g24-unidade-nao-encolheu',
      'a suíte de unidade perdeu arquivo desde ' + ((medida && medida.ref) || 'a base') + ': ' + agora.length +
        ' no disco contra ' + naBase.length + ' na base' + (sumiram.length > 0 ? ' — SUMIRAM ' + sumiram.join(', ') : ''),
      'client/src (arquivos *.test.ts*)',
    )
  }
  return ok(
    'g24-unidade-nao-encolheu',
    agora.length + ' arquivos de unidade agora, ' + naBase.length + ' na base (' + ((medida && medida.ref) || 'base do run') +
      '); piso do passo `unidade`: ' + naBase.length + ' arquivos e ' + PISO_DE_TESTES_DE_UNIDADE + ' testes',
  )
}

/** O piso de arquivos que o passo `unidade` cobra, lido do juiz do acervo. */
function pisoDeArquivosDeUnidade() {
  const naBase = arquivosDeUnidadeNaBase(juizDoAcervo().base)
  return naBase === null ? null : naBase.length
}

/**
 * Antes de subir o vitest (e de pegar vaga): algum arquivo de teste do juiz
 * sumiu do disco? Então o passo sai VERMELHO na hora, com o nome — rodar 25
 * min de suíte sob carga para chegar ao mesmo veredito pelo piso não compra
 * nada. Devolve `null` quando está tudo no disco.
 */
function unidadeSemArquivoSumido() {
  const juiz = juizDoAcervo()
  const r = guardaEscalaDaUnidade(arquivosDeUnidadeNoDisco(), arquivosDeUnidadeNaBase(juiz.base), juiz)
  return r.ok ? null : { codigo: 1, saida: 'VERMELHO antes do vitest — ' + r.detalhe + '\n' }
}

/**
 * g21 — `.only`/`.skip`/`.fixme` nos 139, não nos 4.
 *
 * Mesma régua da g3, aplicada arquivo a arquivo a TODA a suíte de unidade, com
 * um resultado só para não afogar o relatório. Medido em 18/09/2026: zero
 * ocorrência nos 139, então isto nasce verde e só fica vermelho quando alguém
 * cala um teste durante o run. O nome do arquivo sai no vermelho.
 */
function guardaUnidadeSemOnlyNemSkip(textos) {
  const arquivos = Object.keys(textos).sort()
  const sujos = arquivos.map((a) => guardaSemOnlyNemSkip(a, textos[a])).filter((r) => !r.ok)
  if (sujos.length > 0) {
    return reprova('g21-unidade-sem-only-skip', sujos.map((r) => r.detalhe).join('; '), sujos[0].endereco)
  }
  return ok('g21-unidade-sem-only-skip', arquivos.length + ' arquivos de unidade auditados, nenhum com only/skip/fixme')
}

/**
 * g22 — asserção que compara verdade com verdade.
 *
 * `expect(true).toBe(true)`, `expect(x).toBe(x)` e `expect(2).toEqual(2)`
 * passam com o código inteiro apagado: elas não têm como reprovar. É o
 * afrouxamento mais barato que existe dentro de um arquivo de teste, e era o
 * único que não tinha guarda nenhuma nos 135 fora da lista — o `\d+ skipped`
 * do passo `unidade` só pega quem DESLIGA o teste, não quem o esvazia.
 * Medido em 18/09/2026: zero ocorrência nos 139.
 */
function guardaAssertTautologico(arquivo, texto) {
  const marcas = []
  // literal comparado com ele mesmo: expect(true).toBe(true), expect(2).toEqual(2)
  const literal = /expect\s*\(\s*(true|false|null|undefined|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")\s*\)\s*\.\s*(?:toBe|toEqual|toStrictEqual)\s*\(\s*(true|false|null|undefined|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")\s*\)/g
  let m
  while ((m = literal.exec(texto)) !== null) if (m[1] === m[2]) marcas.push(m[0])
  // a mesma expressão dos dois lados: expect(mapa.grid).toBe(mapa.grid)
  const espelho = /expect\s*\(\s*([A-Za-z_$][\w$.[\]]*)\s*\)\s*\.\s*(?:toBe|toEqual|toStrictEqual)\s*\(\s*([A-Za-z_$][\w$.[\]]*)\s*\)/g
  while ((m = espelho.exec(texto)) !== null) if (m[1] === m[2]) marcas.push(m[0])
  // expect(true).toBeTruthy() e parentes: verdade constante afirmada como verdade
  const constante = /expect\s*\(\s*(?:true|1)\s*\)\s*\.\s*toBeTruthy\s*\(|expect\s*\(\s*(?:false|0|null|undefined)\s*\)\s*\.\s*toBeFalsy\s*\(/g
  while ((m = constante.exec(texto)) !== null) marcas.push(m[0])
  if (marcas.length > 0) {
    return reprova('g22-assert-tautologico', arquivo + ': asserção que não tem como reprovar — ' + marcas.slice(0, 3).join(', '), arquivo)
  }
  return ok('g22-assert-tautologico', arquivo + ': nenhuma asserção tautológica')
}

/** g22 em lote sobre a suíte de unidade, um resultado só. */
function guardaUnidadeSemAssertTautologico(textos) {
  const arquivos = Object.keys(textos).sort()
  const sujos = arquivos.map((a) => guardaAssertTautologico(a, textos[a])).filter((r) => !r.ok)
  if (sujos.length > 0) {
    return reprova('g22-assert-tautologico', sujos.map((r) => r.detalhe).join('; '), sujos[0].endereco)
  }
  return ok('g22-assert-tautologico', arquivos.length + ' arquivos de unidade sem asserção tautológica')
}

/**
 * g23 — teto sem controle positivo na unidade, por CATRACA.
 *
 * A régua da g4 vale aqui igual: `toBeLessThan` sozinho aprova o app morto,
 * porque delta zero é menor que qualquer teto. Só que 19 dos 139 arquivos já
 * tinham teto nu ANTES deste run (medido em 18/09/2026) — ligar a régua
 * estrita sobre eles pintaria o portão de vermelho por dívida que peça nenhuma
 * desta rodada causou, e isso é o deadlock que a Invariante 1 manda evitar.
 *
 * Então a comparação é com o MESMO arquivo no commit base do run: arquivo
 * intocado não é julgado, arquivo mexido não pode ganhar teto nu novo, e
 * arquivo NOVO (sem versão na base) começa na régua estrita. A dívida velha
 * fica para o relatório da manhã; ninguém acrescenta dívida durante o run.
 */
function guardaTetoNovoNaUnidade(agora, base) {
  const tetosNus = (texto) => {
    const teto = /\.toBeLessThan(OrEqual)?\s*\(/
    const controle = /\.(toBeGreaterThan(OrEqual)?|toEqual|toStrictEqual|toBeVisible|toHaveText|toContainText|toHaveCount|toHaveAttribute|toBeChecked)\s*\(|\.toBe\s*\(/
    return blocosDeTeste(texto)
      .filter((b) => teto.test(b.corpo) && !controle.test(b.corpo))
      .map((b) => b.nome)
  }
  const novos = []
  for (const arquivo of Object.keys(agora).sort()) {
    const antes = Object.prototype.hasOwnProperty.call(base, arquivo) ? tetosNus(base[arquivo]) : []
    const depois = tetosNus(agora[arquivo])
    const acrescentados = depois.filter((nome) => antes.indexOf(nome) === -1)
    if (acrescentados.length > 0) novos.push(arquivo + ': ' + acrescentados.map((n) => JSON.stringify(n)).join(', '))
  }
  if (novos.length > 0) {
    return reprova(
      'g23-teto-novo-na-unidade',
      'teto sem controle positivo APARECEU nesta rodada — ' + novos.join('; ') +
        '. Teto sozinho aprova o app morto: acrescente um piso, uma igualdade ou uma presença.',
      novos[0].split(':')[0],
    )
  }
  return ok('g23-teto-novo-na-unidade', Object.keys(agora).length + ' arquivo(s) de unidade mexido(s) desde a base, nenhum com teto nu novo')
}

/** Recorta o corpo de cada `test('...')` de um spec, para julgar asserção por asserção. */
function blocosDeTeste(texto) {
  const blocos = []
  // `it(` além de `test(`: as jornadas e2e escrevem `test(`, mas os 139
  // arquivos de unidade escrevem `it(` — recortar só por `test(` fazia o corpo
  // inteiro de um arquivo de vitest virar UM bloco só, e aí qualquer piso em
  // qualquer teste do arquivo servia de controle para um teto nu em outro.
  const abertura = /\b(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g
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

/** Índice do `}` que fecha o `{` em `abre`, pulando texto entre aspas; -1 se não fecha. */
function fimDoBloco(texto, abre) {
  let nivel = 0
  for (let i = abre; i < texto.length; i++) {
    const c = texto[i]
    if (c === '/' && (texto[i + 1] === '/' || texto[i + 1] === '*')) {
      const fecha = texto[i + 1] === '/' ? texto.indexOf('\n', i) : texto.indexOf('*/', i + 2) + 1
      if (fecha <= 0) return -1
      i = fecha
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const fecha = texto.indexOf(c, i + 1)
      if (fecha < 0) return -1
      i = fecha
      continue
    }
    if (c === '{') nivel++
    else if (c === '}' && --nivel === 0) return i
  }
  return -1
}

/**
 * g5, terceira forma (22/09/2026, régua das cenas com gente): o evento Tauri
 * pode chegar aos ouvintes SEM passar por `__emitTauri` — basta uma função de
 * outro nome chamar o handler com `{ event, id, payload }`. Era por aí que a
 * queda de socket (`__labSocketCaiu`) entrava invisível à contagem de emits.
 * Todo despacho direto aos ouvintes é achado pela FORMA do objeto e julgado:
 * dentro de `__emitTauri` já é coberto pela contagem acima; fora dele, só vale
 * o repasse da queda de socket — `net:peer` com `{ clientId, event:
 * 'disconnected' }` literal, jornada com socket roteado de verdade, e TODA
 * chamada da função dentro de um `.on('close', …)` (a página do jogador fechou
 * de fato). Qualquer outro despacho é evento de transporte inventado.
 */
function despachosForaDoEmit(texto, socketRepassado) {
  const donos = []
  const definicao = /\.(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g
  let m
  while ((m = definicao.exec(texto)) !== null) {
    const abre = m.index + m[0].length - 1
    donos.push({ nome: m[1], de: abre, ate: fimDoBloco(texto, abre) })
  }
  const fechamentos = []
  const aoFechar = /\.on\(\s*['"]close['"]\s*,[^{]*\{/g
  while ((m = aoFechar.exec(texto)) !== null) {
    const abre = m.index + m[0].length - 1
    fechamentos.push({ de: abre, ate: fimDoBloco(texto, abre) })
  }
  const temChave = (corpo, chave) => new RegExp('(^|,)\\s*' + chave + '\\s*(:|,|$)').test(corpo)
  const desvios = []
  const despacho = /\(\s*\{([^{}]*)\}\s*\)/g
  while ((m = despacho.exec(texto)) !== null) {
    const corpo = m[1]
    if (!temChave(corpo, 'event') || !temChave(corpo, 'payload')) continue
    const dono = donos.filter((d) => d.de < m.index && m.index < d.ate).pop()
    if (dono && dono.nome === '__emitTauri') continue
    const nome = dono ? dono.nome : '(sem função)'
    const corpoDoDono = dono ? texto.slice(dono.de, dono.ate) : ''
    const eventoEhQueda =
      /^\s*event\s*:\s*['"]net:peer['"]/.test(corpo) &&
      (/const\s+payload\s*=\s*\{\s*clientId\s*,\s*event\s*:\s*['"]disconnected['"]\s*\}/.test(corpoDoDono) ||
        /payload\s*:\s*\{\s*clientId\s*,\s*event\s*:\s*['"]disconnected['"]\s*\}/.test(corpo))
    const chamadas = []
    if (dono) {
      const chamada = new RegExp('\\b' + nome + '\\s*\\(', 'g')
      let c
      while ((c = chamada.exec(texto)) !== null) chamadas.push(c.index)
    }
    const todaChamadaAoFechar =
      chamadas.length > 0 && chamadas.every((em) => fechamentos.some((f) => f.de < em && em < f.ate))
    if (!(socketRepassado && eventoEhQueda && todaChamadaAoFechar)) {
      desvios.push(nome + ' (evento despachado aos ouvintes por fora de __emitTauri, e não é a queda real de socket)')
    }
  }
  return desvios
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
  //
  // Segunda forma do mesmo par (21/09/2026, régua da viagem do jogador): o host
  // real é o APP INTEIRO na página do mestre (`net/hostBridge.ts` cria a sessão
  // lá dentro), e a jornada só faz o papel do fio Rust — o que o `player.html`
  // de verdade manda pelo socket roteado entra no mestre como `net:message`, e o
  // `net_send` do mestre volta ao socket por `exposeFunction`. Vale só se TODA
  // chamada de `__emitTauri` for esse repasse, com a mensagem tirada do socket
  // (`JSON.parse` do que chegou); um evento inventado a mais derruba a exceção.
  const chamadasDeEmit = (texto.match(/__emitTauri\s*\(/g) || []).length
  const repassesDoSocket = (texto.match(/__emitTauri\s*\(\s*['"]net:message['"]\s*,\s*\{[^}]*JSON\.parse\(/g) || []).length
  const mestreEhOAppComSocketRepassado =
    /routeWebSocket\s*\(/.test(texto) &&
    /goto\(\s*['"]\/player\.html/.test(texto) &&
    /exposeFunction\s*\(/.test(texto) &&
    chamadasDeEmit > 0 &&
    chamadasDeEmit === repassesDoSocket
  const jogadorNoSocketReal =
    (/routeWebSocket\s*\(/.test(texto) && /createHostSession\s*\(/.test(texto)) || mestreEhOAppComSocketRepassado
  if (/__emitTauri\s*\(/.test(texto) && !jogadorNoSocketReal) {
    marcas.push('__emitTauri (evento de transporte inventado na página)')
  }
  if (/case\s+'net_(start_room|send|kick|stop_room)'/.test(texto) && !jogadorNoSocketReal) {
    marcas.push("stub de invoke 'net_*'")
  }
  for (const desvio of despachosForaDoEmit(texto, mestreEhOAppComSocketRepassado)) marcas.push(desvio)
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
  // Sem este passo, "nenhuma jornada já existente pode ficar vermelha" volta a
  // depender de alguém lembrar de digitar dois comandos (ver `RECIBOS`).
  if (!plano.some((p) => p.id === 'regressao-em-dia')) faltando.push('nenhum passo cobra o recibo verde da regressão')
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
 * g35 — régua que já estava no acervo só muda em ramo de réguas.
 *
 * FALSO-VERDE PROVADO (auditoria das lanes G10/G12/G13, 23/09/2026): `g12` e o
 * passo `jornadas-intactas` comparavam as jornadas com o selo DA PRÓPRIA
 * árvore. A lane edita a régua, roda `--selar`, e volta verde — o réu
 * carimbando o próprio juiz.
 *
 * O critério mais simples que fecha o furo: o juiz é o CONTEÚDO de cada
 * jornada no merge-base com `auto/acervo` (ver `juizDoAcervo`), não o selo. Se
 * um `*.spec.ts` que já existia ali está diferente (ou sumiu) no disco, só
 * passa quando o ramo atual é de réguas (`auto/acervo`, `auto/lane-infra`,
 * `auto/reguas-*`). O que o acervo recebe por merge já está no merge-base, então
 * régua mexida pelo orquestrador nunca acusa lane nenhuma; o que muda DEPOIS
 * dele numa lane é, por construção, da lane. Jornada NOVA (fora do merge-base)
 * não entra aqui: quem a julga é o commit em que nasceu, como sempre.
 * Recarimbar o selo local não muda nada disto — o selo nem é lido.
 */
function guardaReguasDesdeOAcervo(mudadas, juiz) {
  if (!juiz || juiz.erro || !juiz.base) {
    return reprova('g35-reguas-do-acervo', 'sem juiz para as réguas: ' + ((juiz && juiz.erro) || 'merge-base não resolveu'), 'git (' + REF_DO_ACERVO + ')')
  }
  if (mudadas === null) {
    return reprova('g35-reguas-do-acervo', 'git diff não respondeu: sem lista de réguas mudadas não há juízo', 'git diff ' + juiz.base.slice(0, 8))
  }
  if (mudadas.length === 0) {
    return ok('g35-reguas-do-acervo', 'nenhuma régua mudou desde ' + juiz.ref + ' (ramo ' + juiz.ramo + ')')
  }
  if (RAMOS_DE_REGUAS.test(juiz.ramo)) {
    return ok(
      'g35-reguas-do-acervo',
      mudadas.length + ' régua(s) mudada(s) desde ' + juiz.ref + ' no ramo de réguas ' + juiz.ramo + ': ' + mudadas.join(', '),
    )
  }
  return reprova(
    'g35-reguas-do-acervo',
    mudadas.length + ' régua(s) mudada(s) ou apagada(s) desde ' + juiz.ref + ' num ramo que NÃO é de réguas (' + juiz.ramo + '): ' +
      mudadas.join(', ') + '. Selar de novo na lane não conserta — régua só muda em auto/acervo, auto/lane-infra ou auto/reguas-*.',
    'client/e2e',
  )
}

/** Os `*.spec.ts` de `client/e2e` que existiam no juiz e estão diferentes (ou sumiram) no disco. */
function reguasMudadasDesde(base) {
  if (!base) return null
  const saida = git(['diff', '--name-only', '--no-renames', '--diff-filter=MD', base, '--', 'client/e2e'])
  if (saida === null) return null
  return saida
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /\.spec\.ts$/.test(s))
    .map((s) => s.replace(/^client\//, ''))
    .sort()
}

/**
 * Invariante 6: as jornadas da bar são FIXAS. Como elas nascem untracked, o
 * `git status` não acusa edição nenhuma — um builder podia afrouxar a própria
 * jornada e o portão nem piscava. O selo guarda o hash de cada uma no começo
 * do run (`--selar`), e esta guarda compara.
 */
function guardaJornadasIntactas(selo, textos, esperadas, hashesDaBase) {
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
  // O selo escrito antes desta rodada cobria 9 das 19 jornadas. As outras 10
  // não ficam sem juiz por causa disso: elas são rastreadas pelo git, então o
  // conteúdo delas no COMMIT BASE do run é um hash tão bom quanto o do selo.
  // Jornada sem selo E sem base é a única sem juiz — e essa é VERMELHA.
  const base = hashesDaBase || {}
  const porBase = []
  const semJuiz = []
  for (const arquivo of esperadas || []) {
    if (Object.prototype.hasOwnProperty.call(selo.jornadas, arquivo)) continue
    const texto = textos[arquivo]
    if (texto === undefined) {
      problemas.push(arquivo + ' declarada e ausente da árvore')
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(base, arquivo)) {
      semJuiz.push(arquivo)
      continue
    }
    porBase.push(arquivo)
    if (sha256(texto) !== base[arquivo]) problemas.push(arquivo + ' MUDOU desde a base do run (fora do selo)')
  }
  if (semJuiz.length > 0) {
    problemas.push('sem selo E sem conteúdo no commit base — nenhum juiz: ' + semJuiz.join(', ') + '. Rode `node scripts/portao.cjs --selar`.')
  }
  if (problemas.length > 0) return reprova('g12-jornadas-intactas', problemas.join('; '), 'client/e2e')
  return ok(
    'g12-jornadas-intactas',
    Object.keys(selo.jornadas).length + ' jornada(s) com o hash do selo' +
      (porBase.length > 0 ? ' + ' + porBase.length + ' conferida(s) contra o commit base do run' : ''),
  )
}

/**
 * Invariante 3, lado do esquema: campo OPCIONAL novo em `types/map.ts` tem de
 * aparecer na migração de `lib/mapFile.ts` — ou dizer, no próprio comentário,
 * por que a ausência já é o default ("undefined === …", "sem linha de
 * migração", o vocabulário que o arquivo já usa). Campo novo em silêncio é
 * mapa antigo abrindo diferente do que a pessoa salvou.
 *
 * 18/09/2026, Fase 0 do run do teto: a guarda escapava por FORMATAÇÃO, e quem
 * escreve o campo é quem escolhe como formatar — então a guarda não pode
 * depender disso. Seis escapes medidos e fechados, em duas levas:
 *   `readonly roof?:`  o modificador na frente
 *   `\troof?:`         um tab é UM caractere, e o padrão exigia dois
 *   `roof ?:`          espaço antes da interrogação
 *   `roof?:` na coluna 0
 *   `type X = { roof?: boolean }`  tudo numa linha só
 *   `"roof"?:`         chave entre aspas
 *
 * Por isso a busca deixou de ser ancorada no começo da linha: o campo é
 * procurado depois de `{`, `;` ou `,` também, que é onde ele aparece num
 * literal de uma linha. Em troca, o comentário precisa ser tirado ANTES (antes
 * bastava o `*` não abrir identificador) — senão `* roof?: number` num bloco de
 * documentação viraria campo. A isenção continua lida no texto ORIGINAL: ela
 * mora justamente no comentário.
 */
const CAMPO_OPCIONAL = /(?:^|[{;,])\s*(?:readonly\s+)?["']?([A-Za-z_]\w*)["']?\s*\?\s*:/g

/**
 * A linha sem comentário — só o código. `bloco` entra e sai dizendo se estamos
 * dentro de um `/* ... *\/` aberto numa linha anterior.
 */
function semComentario(linha, blocoAberto) {
  let codigo = ''
  let bloco = blocoAberto
  let i = 0
  while (i < linha.length) {
    if (bloco) {
      const fim = linha.indexOf('*/', i)
      if (fim === -1) return { codigo, bloco: true }
      i = fim + 2
      bloco = false
      continue
    }
    if (linha.startsWith('//', i)) return { codigo, bloco: false }
    if (linha.startsWith('/*', i)) {
      bloco = true
      i += 2
      continue
    }
    codigo += linha[i]
    i += 1
  }
  return { codigo, bloco }
}

function camposOpcionais(textoDeTipos) {
  const campos = []
  const linhas = textoDeTipos.split('\n')
  let bloco = false
  for (let i = 0; i < linhas.length; i++) {
    const limpa = semComentario(linhas[i], bloco)
    bloco = limpa.bloco
    CAMPO_OPCIONAL.lastIndex = 0
    const contexto = linhas.slice(Math.max(0, i - 14), i + 1).join('\n')
    const isento = /undefined\s*===|sem linha de migração/i.test(contexto)
    let achado = CAMPO_OPCIONAL.exec(limpa.codigo)
    while (achado !== null) {
      campos.push({ nome: achado[1], isento })
      achado = CAMPO_OPCIONAL.exec(limpa.codigo)
    }
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

/**
 * Invariante 5 em função pura — "cada peça escreve SOMENTE nos arquivos
 * declarados nela".
 *
 * POR QUE TEM DOIS MODOS. A pergunta que a Invariante 5 faz muda conforme as
 * peças dividirem ou não a árvore de trabalho:
 *
 *  - ÁRVORE COMPARTILHADA (branch de integração, `feat/...`): duas escritas no
 *    mesmo arquivo se sobrescrevem sem erro. Aí a pergunta é "todo arquivo
 *    mudado tem UM dono?", e arquivo declarado por duas peças é o defeito.
 *
 *  - PEÇA ISOLADA (branch `auto/<id>`, uma por peça): o git já garante que
 *    ninguém apaga o trabalho da irmã — só a integração junta. A pergunta que
 *    sobra é a única que importa ali: "esta peça escreveu fora do que foi
 *    declarado PARA ELA?". Exigir dono único aqui era pior que inútil: arquivo
 *    de origem compartilhado (PixiCanvas.tsx e afins) tem de aparecer na lista
 *    de mais de uma peça, e a regra de dono único reprovava a declaração
 *    correta. Foi assim que, em 18/09/2026, o manifesto ficou com as peças da
 *    rodada ANTERIOR e o passo passou a reprovar toda correção legítima: todo
 *    arquivo mudado saía "sem dono declarado".
 *
 * A peça vem do nome do ramo (`auto/<id>`) porque é o mesmo endereço que o
 * orquestrador já usa para separar as peças — nada de variável nova para
 * alguém esquecer de passar.
 */
function casaCom(arquivo, padrao) {
  if (padrao === arquivo) return true
  if (padrao.indexOf('*') === -1) return false
  const escapar = (t) => t.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  // `**` atravessa pasta; `*` fica dentro de um segmento. Uma peça pode
  // declarar a ÁREA que é dela ("client/src/**") sem enumerar arquivo que
  // ainda não escreveu — enumerar o que não existe era o que empurrava o
  // orquestrador a deixar o manifesto velho no lugar.
  const corpo = padrao
    .split('**')
    .map((parte) => parte.split('*').map(escapar).join('[^/]*'))
    .join('.*')
  return new RegExp('^' + corpo + '$').test(arquivo)
}

/** Nomes de peça que aceitam este ramo: a chave, ou um apelido declarado nela. */
function pecaDeclarada(pecas, apelidos, peca) {
  if (Object.prototype.hasOwnProperty.call(pecas, peca)) return peca
  for (const nome of Object.keys(apelidos || {})) {
    if ((apelidos[nome] || []).includes(peca)) return nome
  }
  return null
}

function guardaParticao(entrada) {
  const arquivos = entrada.arquivos || []
  const manifesto = entrada.manifesto || {}
  const peca = entrada.peca || null
  const pecas = manifesto.pecas || {}
  const livres = manifesto.livres || []
  const alvos = manifesto.alvos || {}
  // `Array.isArray` e não `|| []`, pela mesma razão que em `alvos` logo abaixo: o
  // manifesto é documentado em campos de texto, e um comentário escrito dentro de
  // `pecas` derrubava o portão inteiro com `TypeError: (...).some is not a function`
  // — medido em 21/09/2026. Portão que estoura não reprova nem aprova: some.
  const areaDaPeca = (nome) => (Array.isArray(pecas[nome]) ? pecas[nome] : [])
  const donosDe = (arquivo) => Object.keys(pecas).filter((nome) => areaDaPeca(nome).some((p) => casaCom(arquivo, p)))
  // `Array.isArray` e não `|| []`: o manifesto é documentado em campos `_...`
  // de texto, e um deles caindo aqui dentro derrubaria o portão com TypeError
  // em vez de julgar.
  const listaDeAlvos = (nome) => (Array.isArray(alvos[nome]) ? alvos[nome] : [])
  const donoDoAlvo = (arquivo) => Object.keys(alvos).filter((nome) => listaDeAlvos(nome).some((p) => casaCom(arquivo, p)))

  if (peca !== null) {
    const chave = pecaDeclarada(pecas, manifesto.apelidos, peca)
    if (chave === null) {
      return reprova(
        'g14-particao',
        'a peça `' + peca + '` (ramo auto/' + peca + ') não está declarada no manifesto; declaradas: ' +
          (Object.keys(pecas).join(', ') || 'nenhuma') +
          '. Manifesto de outra rodada reprova toda correção legítima desta.',
        'scripts/portao-particao.json ("pecas")',
      )
    }
    const permitido = (a) => areaDaPeca(chave).some((p) => casaCom(a, p)) || livres.some((p) => casaCom(a, p))
    const invasao = arquivos.filter((a) => !permitido(a))
    if (invasao.length > 0) {
      return reprova(
        'g14-particao',
        'a peça `' + chave + '` escreveu fora do que foi declarado para ela: ' + invasao.join(', '),
        'scripts/portao-particao.json ("pecas"."' + chave + '")',
      )
    }
    // ÁREA declarada não é o mesmo que ARQUIVO ALVO. Nesta rodada as três peças
    // de cliente declaram a MESMA área (`client/src/**`), então a checagem acima
    // aprovava a peça do menu editando o arquivo que a peça da camada existe
    // para consertar: em ramos separados ninguém apaga ninguém na hora, mas o
    // merge do usuário resolve o conflito escolhendo UM dos dois — e o conserto
    // perdido some sem erro. `alvos` declara o arquivo que é EXCLUSIVO de cada
    // peça (o endereço da causa, citado na jornada dela); escrever no alvo de
    // outra peça é vermelho com nome e dono.
    const meuAlvo = (a) => listaDeAlvos(chave).some((p) => casaCom(a, p))
    const alheios = arquivos.filter((a) => !meuAlvo(a) && donoDoAlvo(a).some((n) => n !== chave))
    if (alheios.length > 0) {
      return reprova(
        'g14-particao',
        'a peça `' + chave + '` escreveu no arquivo ALVO de outra peça: ' +
          alheios.map((a) => a + ' [alvo de ' + donoDoAlvo(a).filter((n) => n !== chave).join(' e ') + ']').join('; ') +
          '. Em ramos separados isso não dá erro — o merge é que escolhe um dos dois consertos e perde o outro.',
        'scripts/portao-particao.json ("alvos")',
      )
    }
    // Arquivo que DUAS peças podem legitimamente tocar (PixiCanvas.tsx, nesta
    // rodada) continua permitido: sai nomeado no verde, para quem for juntar as
    // branches saber onde olhar antes de aceitar um dos lados.
    const compartilhados = arquivos.filter((a) => !meuAlvo(a) && donosDe(a).length > 1)
    return ok(
      'g14-particao',
      'peça `' + chave + '`: ' + arquivos.length + ' arquivo(s) mudado(s), todos na lista dela e nenhum no alvo de outra' +
        (compartilhados.length > 0 ? '\nATENÇÃO AO MERGE — arquivo em área que outra peça também declara: ' + compartilhados.join(', ') : ''),
    )
  }

  const problemas = []
  const disputados = arquivos.filter((a) => donosDe(a).length > 1)
  if (disputados.length > 0) {
    problemas.push(
      'árvore compartilhada e arquivo mudado que DUAS peças declaram (a segunda escrita apaga a primeira em silêncio): ' +
        disputados.map((a) => a + ' [' + donosDe(a).join(' e ') + ']').join('; '),
    )
  }
  const semDono = arquivos.filter((a) => donosDe(a).length === 0 && !livres.some((p) => casaCom(a, p)))
  if (semDono.length > 0) problemas.push('arquivo mudado sem dono declarado: ' + semDono.join(', '))
  if (problemas.length > 0) return reprova('g14-particao', problemas.join('\n'), 'scripts/portao-particao.json')
  return ok('g14-particao', arquivos.length + ' arquivo(s) mudado(s), cada um com uma peça dona')
}

/**
 * O que a peça ESCREVEU neste run — não o que sobrou sujo na árvore.
 *
 * POR QUE ISTO EXISTE. Os passos `particao` e `rust-intocado` perguntavam só
 * `git status --porcelain`. A Invariante 6 do run manda cada peça COMMITAR na
 * própria branch `auto/<id>`; depois do commit a árvore fica limpa e as duas
 * Invariantes que mais importam (5 — quem escreve onde; 9 — Rust intocado)
 * passavam a medir ZERO arquivo e sair verdes. Medido em 18/09/2026 num
 * worktree descartável do mesmo sha: a MESMA invasão (`scripts/__probe_fora.cjs`
 * + `desktop/src-tauri/__probe.rs`) era VERMELHA suja e VERDE depois de
 * `git commit`. Verde sem medida é o falso-verde mais caro do portão, porque
 * ele aparece exatamente quando a peça terminou o trabalho.
 *
 * A medida certa é a UNIÃO do que está sujo com o que foi commitado desde a
 * base do run (`git diff --name-only <base> HEAD`). Renomeação no porcelain vem
 * como `antigo -> novo`: os DOIS lados são escrita da peça, e ignorar o lado
 * esquerdo deixaria "mover arquivo de outra peça para dentro da minha área"
 * sem juiz.
 */
function arquivosMudados(porcelain, diff) {
  const nomes = new Set()
  const limpar = (t) => String(t).trim().replace(/^"|"$/g, '').replace(/\\/g, '/')
  for (const linha of String(porcelain || '').split('\n')) {
    if (linha.trim().length === 0) continue
    for (const lado of linha.slice(3).split(' -> ')) {
      const nome = limpar(lado)
      if (nome.length > 0) nomes.add(nome)
    }
  }
  for (const linha of String(diff || '').split('\n')) {
    const nome = limpar(linha)
    if (nome.length > 0) nomes.add(nome)
  }
  return Array.from(nomes).sort()
}

/**
 * DUAS bases, porque UMA só é um juiz que o réu pode mover.
 *
 * O manifesto declara a base do run, e a peça `portao` é a única que pode
 * reescrever o manifesto — é o que a Invariante 5 dá a ela. As duas coisas
 * juntas abrem a porta dos fundos medida em 18/09/2026: a peça do portão
 * apontou `base`."ramo" para `auto/base-pecas` = 32a74cd, o PAI do próprio topo
 * dela, e o primeiro commit dela saiu da medida de `particao` dela mesma.
 * Naquele run não escondeu nada (conferido commit a commit), mas o mecanismo é
 * o falso-verde que o passo existe para caçar: quem escolhe a própria base sai
 * verde por construção.
 *
 * E um ponteiro só não resolvia nem o outro lado. Medido no mesmo dia: com
 * `base`."ramo" parado num commit ANTERIOR ao topo do portão, a peça de cliente
 * cortada desse topo era acusada de escrever em `scripts/portao.cjs` antes de
 * digitar uma linha; com ele à frente do commit de onde a peça saiu, `particao`
 * e `rust-intocado` saíam "SEM JUIZ" — dois dos quinze comandos sem medir nada.
 * Nenhum builder de cliente consegue consertar nem um nem outro: o manifesto é
 * proibido para ele.
 *
 * Por isso os dois papéis, que estavam espremidos num campo só, viram dois:
 *
 *  - `base`."origem" — o ponteiro CONGELADO do começo do run, do orquestrador
 *    (carimbado no selo quando o selo for tirado por este portão). É contra ele
 *    que a peça capaz de mexer no manifesto é medida, sempre.
 *  - `base`."ramo" — o ponto de corte das peças de cliente: o topo do portão no
 *    instante em que os builders foram soltos. Este PRECISA andar quando o
 *    portão recebe conserto, senão o commit do portão cai na conta de quem não
 *    o escreveu.
 *
 * Quem pode mover a base não é julgado por ela; quem não pode movê-la é julgado
 * pelo ponto de onde saiu de verdade.
 */
/** O manifesto visto de dentro do repositório — o arquivo que decide quem julga quem. */
const MANIFESTO_NO_REPO = 'scripts/portao-particao.json'

/**
 * Esta peça pode reescrever o manifesto? Lido do próprio manifesto, não do nome
 * da peça: se amanhã outra peça receber `scripts/portao-particao.json` na lista
 * dela, ela também passa a ser medida pela base que não consegue mover.
 */
function pecaMoveABase(manifesto, chave) {
  // Peça não declarada e árvore compartilhada caem aqui: sem dono conhecido, a
  // medida vai para a base mais antiga, que é a que mede MAIS coisa.
  if (chave === null) return true
  const pecas = (manifesto && manifesto.pecas) || {}
  const lista = Array.isArray(pecas[chave]) ? pecas[chave] : []
  return lista.some((p) => casaCom(MANIFESTO_NO_REPO, p))
}

/**
 * Uma peça do manifesto que NÃO pode reescrevê-lo — ou seja, das medidas por
 * `base`."ramo". Existe para o autoteste, que precisa de um nome de peça REAL e
 * não pode carregar um literal: em 18/09/2026 o fixture dizia
 * `menu-cabe-na-janela`, a rodada seguinte apagou essa peça do manifesto e o
 * autoteste saiu vermelho por fixture velho — tirando do orquestrador o direito
 * de usar o exit code dele como portão.
 */
function pecaDeClienteDoManifesto(manifesto) {
  const pecas = (manifesto && manifesto.pecas) || {}
  return Object.keys(pecas).find((chave) => !pecaMoveABase(manifesto, chave)) || null
}

/** Qual dos dois ponteiros julga ESTA peça, e por quê (a frase sai no relatório). */
function refDaBase(manifesto, peca) {
  const base = (manifesto && manifesto.base) || {}
  const refPecas = base.ramo || null
  const refOrigem = base.origem || null
  const chave = peca === null ? null : pecaDeclarada((manifesto && manifesto.pecas) || {}, manifesto && manifesto.apelidos, peca)
  const move = pecaMoveABase(manifesto, chave)
  return {
    chave,
    refPecas,
    refOrigem,
    move,
    ref: move ? refOrigem : refPecas,
    papel: move
      ? 'base IMUTÁVEL do run (`base`."origem"): esta peça pode reescrever o manifesto, então não é a base que ela move que a julga'
      : 'base das peças (`base`."ramo"): o ponteiro congelado no commit de onde esta peça foi cortada',
  }
}

/**
 * A base imutável existe, resolve, está na linha do run — e bate com o que o
 * selo carimbou.
 *
 * O selo é tirado pelo orquestrador ANTES dos builders e nenhum builder pode
 * editá-lo (Invariante 5). Quando ele traz `base_do_run`, é ele quem manda: a
 * peça do portão pode reescrever `origem` no manifesto, mas não consegue mexer
 * no carimbo, e a divergência sai VERMELHA com os dois endereços.
 *
 * Selo SEM o campo (o desta rodada, tirado antes desta guarda existir) deixava
 * a âncora INATIVA: nada a comparar, nota no verde, e o réu escolhendo o juiz
 * na prática. A segunda âncora fecha isso sem pedir nada ao orquestrador — o
 * commit da base é imutável e a cópia do manifesto que vive DENTRO dele já diz
 * qual era a base do run (`origemDeclaradaNoCommit`). Base sem NENHUMA das duas
 * âncoras é VERMELHA: âncora ausente não é detalhe, é o juiz faltando.
 */
function guardaOrigemDaBase(entrada) {
  const refOrigem = entrada.refOrigem || null
  const refPecas = entrada.refPecas || null
  const commitOrigem = entrada.commitOrigem || null
  const commitPecas = entrada.commitPecas || null
  const origemEhAncestral = entrada.origemEhAncestral === true
  const refSelada = entrada.refSelada || null
  const commitSelado = entrada.commitSelado || null
  const refOrigemCommitada = entrada.refOrigemCommitada || null
  const commitadaEhAncestral = entrada.commitadaEhAncestral === true
  if (!refOrigem) {
    return reprova(
      'g20-base-imutavel',
      'o manifesto não declara `base`."origem" — a base IMUTÁVEL do run, a única que a peça do portão não pode mover. Sem ela, quem ' +
        'reescreve o manifesto escolhe o próprio juiz: basta apontar "ramo" para o topo dela e o diff sai vazio por construção, com ' +
        'tudo o que ela commitou fora das Invariantes 5 e 9. Declare `"origem": "<ponteiro congelado do começo do run>"`.',
      'scripts/portao-particao.json ("base"."origem")',
    )
  }
  if (!commitOrigem) {
    return reprova(
      'g20-base-imutavel',
      'a base imutável `' + refOrigem + '` não resolve neste repositório (ponteiro apagado, ou sha de outra máquina).',
      'scripts/portao-particao.json ("base"."origem")',
    )
  }
  if (refSelada !== null && commitSelado !== null && commitSelado !== commitOrigem) {
    return reprova(
      'g20-base-imutavel',
      'o manifesto diz que a base do run é `' + refOrigem + '` = ' + String(commitOrigem).slice(0, 8) + ', mas o SELO carimbou `' +
        refSelada + '` = ' + String(commitSelado).slice(0, 8) + ' antes dos builders. O selo é de quem abriu o run e nenhum builder ' +
        'pode editá-lo: base trocada no meio do run é o réu escolhendo o juiz.',
      'scripts/portao-particao.json ("base"."origem") + scripts/portao-selo.json ("base_do_run")',
    )
  }
  // SEGUNDA ÂNCORA, que não depende de ninguém ter rodado `--selar`: o commit
  // da base é CONGELADO, e a cópia do manifesto que vive DENTRO dele já declara
  // qual era a base daquele momento. A base do run só pode ANDAR PARA A FRENTE
  // na mesma linha — de uma rodada para a outra o orquestrador congela um
  // ponteiro novo, e o antigo continua sendo ancestral dele. `origem` apontada
  // para fora dessa linha não é avanço de rodada: é ponto de corte escolhido a
  // dedo, e muda o que cada peça parece ter escrito sem ninguém ter escrito nada.
  //
  // A comparação é por ANCESTRALIDADE e não por nome de ponteiro de propósito:
  // por nome, a rodada seguinte — que legitimamente congela `auto/base-r6` sobre
  // um commit cujo manifesto ainda dizia `auto/base-noite` — sairia vermelha sem
  // ninguém ter feito nada de errado.
  if (refOrigemCommitada !== null && refOrigemCommitada !== refOrigem && !commitadaEhAncestral) {
    return reprova(
      'g20-base-imutavel',
      'o manifesto da árvore diz que a base imutável do run é `' + refOrigem + '` = ' + String(commitOrigem).slice(0, 8) +
        ', mas o manifesto commitado DENTRO desse commit declara `' + refOrigemCommitada + '`, que não é ancestral dele. Base fora da ' +
        'linha do run é o réu escolhendo o próprio juiz: basta apontar `origem` para perto do topo e tudo o que a peça commitou some ' +
        'do diff das Invariantes 5 e 9.',
      'scripts/portao-particao.json ("base"."origem") + o manifesto commitado em ' + String(commitOrigem).slice(0, 8),
    )
  }
  if (refSelada === null && refOrigemCommitada === null) {
    return reprova(
      'g20-base-imutavel',
      'a base imutável `' + refOrigem + '` não tem ÂNCORA NENHUMA: o selo não carimbou `base_do_run` e o commit ' +
        String(commitOrigem).slice(0, 8) + ' não traz `scripts/portao-particao.json` para se confirmar. Sem âncora, `origem` é só um ' +
        'campo que a peça capaz de reescrever este arquivo pode apontar para onde quiser — e o diff das Invariantes 5 e 9 sai do ' +
        'tamanho que ela escolher. Rode `node scripts/portao.cjs --selar` ANTES de soltar os builders.',
      'scripts/portao-selo.json ("base_do_run") + scripts/portao-particao.json ("base"."origem")',
    )
  }
  if (refPecas !== null && commitPecas === null) {
    return reprova(
      'g20-base-imutavel',
      'a base das peças `' + refPecas + '` não resolve neste repositório (ponteiro apagado, ou sha de outra máquina).',
      'scripts/portao-particao.json ("base"."ramo")',
    )
  }
  if (refPecas !== null && commitPecas !== commitOrigem && !origemEhAncestral) {
    return reprova(
      'g20-base-imutavel',
      'a base das peças `' + refPecas + '` = ' + String(commitPecas).slice(0, 8) + ' NÃO descende da base imutável `' + refOrigem +
        '` = ' + String(commitOrigem).slice(0, 8) + '. Ponto de corte fora da linha do run não é ponto de corte: ele muda o que cada ' +
        'peça parece ter escrito, sem que ninguém tenha escrito nada.',
      'scripts/portao-particao.json ("base")',
    )
  }
  return ok(
    'g20-base-imutavel',
    'base imutável do run: ' + refOrigem + ' = ' + String(commitOrigem).slice(0, 8) +
      (refPecas !== null && refPecas !== refOrigem
        ? '; base das peças: ' + refPecas + ' = ' + String(commitPecas).slice(0, 8) + ' (descende dela)'
        : '') +
      '\nâncoras ATIVAS (é o que impede a peça que reescreve este manifesto de escolher o próprio juiz): ' +
      [
        refSelada !== null && commitSelado !== null ? 'selo tirado antes dos builders (`base_do_run`)' : null,
        refOrigemCommitada !== null ? 'o manifesto commitado dentro de ' + String(commitOrigem).slice(0, 8) + ', que declara `' + refOrigemCommitada + '`' : null,
      ]
        .filter(Boolean)
        .join(' + ') +
      (refSelada === null ? '\nnota: o selo desta rodada não carimbou `base_do_run`; a âncora que segura hoje é a do commit. Rode `--selar` antes do próximo run para ter as duas.' : ''),
  )
}

/**
 * A base do run, declarada pelo ORQUESTRADOR em `scripts/portao-particao.json`
 * ("base".ramo / "base".origem) — o ponto de onde toda peça saiu. Sem ela não
 * existe "o que esta peça commitou", e o portão prefere ficar VERMELHO a medir
 * o vazio.
 *
 * A última cláusula é a que fecha a porta dos fundos: se a base ANDAR junto com
 * a peça — isto é, se o que o manifesto declara como base for o próprio ramo em
 * que ela commita —, o diff sai vazio por construção e tudo o que ela commitou
 * escapa. Isso é reprovado com endereço, não silenciado.
 *
 * 18/09/2026 — o que estava ERRADO aqui. A cláusula comparava SHA: `base ===
 * cabeça` era vermelho. Mas esse é exatamente o estado normal de toda peça
 * ANTES do primeiro commit dela: o ponteiro congelado `auto/base-noite` aponta
 * para o mesmo commit em que a peça começou, e `merge-base` devolve o próprio
 * HEAD. Resultado medido nesta máquina: `particao` e `rust-intocado` saíam
 * VERMELHOS com "SEM JUIZ" enquanto a peça só tivesse trabalho na árvore suja —
 * dois dos 15 comandos do portão sem medir nada, e vermelho que não é do
 * builder. O que importa não é o SHA coincidir hoje: é a base ser um ponteiro
 * que a peça EMPURRA quando commita. Por isso agora a comparação é de NOME de
 * ramo, e a coincidência de SHA sai como nota no verde ("ainda sem commit
 * próprio"), com a árvore suja medida normalmente.
 */
function guardaBaseDoRun(entrada) {
  const ref = entrada.ref || null
  const base = entrada.base || null
  const cabeca = entrada.cabeca || null
  const peca = entrada.peca || null
  const ramo = entrada.ramo || (peca !== null ? 'auto/' + peca : null)
  /** O sha para onde o ponteiro declarado aponta — não o `merge-base` com o HEAD. */
  const commitDaBase = entrada.commitDaBase || null
  if (!ref) {
    return reprova(
      'g17-base-do-run',
      'o manifesto não declara a base do run em "base".ramo. Sem base, `particao` e `rust-intocado` só veriam a árvore suja — ' +
        'e toda peça que commitar (Invariante 6) sai verde sem ser medida.',
      'scripts/portao-particao.json ("base")',
    )
  }
  if (!base) {
    return reprova(
      'g17-base-do-run',
      'a base declarada `' + ref + '` não resolve neste repositório (ramo apagado, sha de outra máquina ou históricos sem ancestral comum).',
      'scripts/portao-particao.json ("base"."ramo")',
    )
  }
  if (ramo !== null && baseAndaComOramo(ref, ramo)) {
    return reprova(
      'g17-base-do-run',
      'a base declarada `' + ref + '` é o PRÓPRIO ramo em que a peça `' + (peca || '?') + '` commita: ela avança a cada commit, o diff ' +
        'sai vazio por construção e tudo o que a peça commitar escapa das Invariantes 5 e 9. A base tem de ser um ponteiro CONGELADO, ' +
        'no ponto de onde as peças saíram.',
      'scripts/portao-particao.json ("base"."ramo")',
    )
  }
  // A base declarada é ANCESTRAL desta peça?
  //
  // `particao` cobra da peça tudo o que está entre `merge-base(HEAD, base)` e o
  // HEAD dela. Quando o ponteiro declarado NÃO é ancestral do HEAD — a peça foi
  // cortada de um commit mais novo que a base, ou de outro ramo —, o merge-base
  // cai para trás e todo commit que OUTRA peça fez nesse meio vira "invasão"
  // desta. Medido em 18/09/2026: com `base.ramo = auto/base-noite` (6500be7) e
  // as peças cortadas de auto/portao (32a74cd), `particao` reprovava as três
  // peças de cliente por escreverem em `scripts/portao.cjs` ANTES de elas
  // escreverem uma linha — vermelho por invasão que não existe, e que nenhum
  // builder consegue consertar. Agora isso sai como diagnóstico com endereço,
  // no lugar de acusação contra quem não escreveu nada.
  if (commitDaBase !== null && base !== null && commitDaBase !== base) {
    return reprova(
      'g17-base-do-run',
      'a base declarada `' + ref + '` = ' + String(commitDaBase).slice(0, 8) + ' NÃO é ancestral desta peça: `merge-base` caiu em ' +
        String(base).slice(0, 8) + '. Tudo o que foi commitado entre os dois vai ser cobrado desta peça como invasão, mesmo que outra ' +
        'peça é que tenha escrito. A base tem de ser o commit de onde ESTA peça saiu.',
      'scripts/portao-particao.json ("base"."ramo")',
    )
  }
  if (cabeca !== null && base === cabeca) {
    // Não é buraco: é a peça que ainda não commitou. A base é um ponteiro de
    // outro nome, parado no commit de partida; cada commit da peça move só o
    // HEAD e passa a contar no diff. Enquanto isso a medida é a árvore suja —
    // dito em voz alta, para ninguém ler este verde como "nada a declarar".
    return ok(
      'g17-base-do-run',
      'base do run: ' + ref + ' = ' + String(base).slice(0, 8) + ' — a peça ainda não commitou nada (base = HEAD), ' +
        'então esta rodada mede a árvore suja; cada commit dela entra na medida a partir daqui',
    )
  }
  return ok('g17-base-do-run', 'base do run: ' + ref + ' = ' + String(base).slice(0, 8))
}

/**
 * A base declarada é o mesmo ramo em que a peça commita? Comparação por NOME,
 * não por SHA: `refs/heads/auto/portao`, `origin/auto/portao` e `auto/portao`
 * são o mesmo ponteiro, e `HEAD`/`@` também andam junto por definição.
 */
function baseAndaComOramo(ref, ramo) {
  const limpar = (t) => String(t || '').trim().replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '').replace(/^origin\//, '')
  const a = limpar(ref)
  const b = limpar(ramo)
  if (/^(HEAD|@)$/.test(a)) return true
  return a.length > 0 && a === b
}

/**
 * O que torna "nenhum servidor no ar" uma resposta HONESTA em vez de verde
 * vazio: o `playwright.config.ts` sobe um servidor NOVO por invocação. Sem
 * essa cláusula lida do arquivo, "não achei servidor" não prova nada — e era
 * exatamente o estado do passo `servidor-limpo` rodando em porta onde nunca
 * houve servidor nenhum (LAB_PORTA=1466): verde permanente sem medida.
 */
function guardaConfigDeServidorNovo(texto, ambiente) {
  const env = ambiente || {}
  if (!/webServer\s*:/.test(texto)) {
    return reprova(
      'g15-servidor-novo',
      'playwright.config.ts não declara `webServer` — as jornadas dependem de um servidor que ninguém sobe nem inspeciona',
      'client/playwright.config.ts',
    )
  }
  const achado = /reuseExistingServer\s*:\s*([^,\n]+)/.exec(texto)
  if (!achado) {
    return reprova(
      'g15-servidor-novo',
      'playwright.config.ts não declara `reuseExistingServer` — o padrão reaproveita servidor com história de HMR',
      'client/playwright.config.ts',
    )
  }
  const valor = achado[1].trim()
  if (valor === 'true') {
    return reprova(
      'g15-servidor-novo',
      'reuseExistingServer: true — a jornada pode pegar um vite órfão servindo código velho',
      'client/playwright.config.ts',
    )
  }
  if (env.LAB_REUSA_SERVIDOR === '1') {
    return reprova(
      'g15-servidor-novo',
      'LAB_REUSA_SERVIDOR=1 no ambiente: o reaproveitamento está LIGADO nesta execução, então "nenhum servidor no ar" não garante servidor novo',
      'ambiente da execução + client/playwright.config.ts',
    )
  }
  return ok('g15-servidor-novo', 'reuseExistingServer: ' + valor + ' e LAB_REUSA_SERVIDOR desligado — cada invocação sobe servidor próprio')
}

/**
 * A sonda olhou a MESMA porta que as jornadas vão usar?
 *
 * POR QUE ISTO EXISTE (18/09/2026). Sem servidor no ar, o passo `servidor-limpo`
 * saía verde apoiado só no `playwright.config.ts` ("cada invocação sobe servidor
 * novo"). Só que o endereço sondado vem de `PORTAO_URL_EDITOR`, que qualquer um
 * pode apontar para outra porta ou outra máquina, enquanto as jornadas usam
 * `client/porta.js` (`LAB_PORTA` = 1466 nesta noite). Com os dois divergindo, o
 * verde é sobre um servidor que ninguém vai abrir — a prova é verdadeira e
 * IRRELEVANTE, que é a forma mais educada de falso-verde. Aqui a prova passa a
 * dizer de qual servidor ela fala, e diverge em vermelho.
 */
function guardaPortaDaSonda(url, portaDasJornadas) {
  const achado = /^https?:\/\/([^/:]+):(\d+)(?:\/|$)/.exec(String(url || ''))
  if (!achado) {
    return reprova('g18-porta-da-sonda', 'endereço sondado sem host e porta explícitos: `' + url + '`', 'PORTAO_URL_EDITOR')
  }
  const host = achado[1]
  const porta = Number(achado[2])
  if (!/^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(host)) {
    return reprova(
      'g18-porta-da-sonda',
      'a sonda olhou `' + host + '`, mas as jornadas abrem http://localhost:' + portaDasJornadas + ' — o verde seria sobre outra máquina',
      'PORTAO_URL_EDITOR + client/porta.js',
    )
  }
  if (porta !== Number(portaDasJornadas)) {
    return reprova(
      'g18-porta-da-sonda',
      'a sonda olhou a porta ' + porta + ' e as jornadas vão usar a ' + portaDasJornadas +
        ': nada do que foi medido aqui vale para o servidor que as jornadas abrem',
      'PORTAO_URL_EDITOR + client/porta.js (LAB_PORTA)',
    )
  }
  return ok('g18-porta-da-sonda', 'sonda e jornadas no mesmo endereço: localhost:' + porta)
}

/**
 * O servidor que respondeu nesta porta é o DESTA árvore?
 *
 * `g18` compara o NÚMERO da porta e nada mais. Com as peças em `git worktree`
 * separados e TODAS forçadas à mesma porta por `LAB_PORTA` (é o que a
 * Invariante 3 deste run manda fazer), `client/porta.js:44` faz a variável de
 * ambiente VENCER a porta por árvore que as linhas 47-51 existem para dar: as
 * quatro peças apontam para localhost:1466 e quem chegar primeiro fica com a
 * porta. Daí saem dois desfechos, e `g18` não distingue nenhum dos dois —
 * ambos passam pelo "mesmo número de porta":
 *  - `strictPort: true` derruba o vite da segunda árvore e o Playwright dela
 *    testa o app da PRIMEIRA (verde ou vermelho sobre código que não é o dela);
 *  - a sonda inspeciona os módulos do vite da árvore vizinha e sai verde sobre
 *    um servidor que não é o desta peça.
 *
 * O discriminador é o CAMINHO ABSOLUTO, não a porta: `/@fs/<caminho absoluto>`
 * só entrega o arquivo quando ele está dentro da raiz do vite que atendeu — o
 * de outra árvore está fora dela. Endereço absoluto é a única coisa que difere
 * entre dois worktrees do mesmo repositório rodando o mesmo código.
 *
 * E o JUIZ É O CORPO, NÃO O STATUS. Medido nesta máquina em 18/09/2026 com um
 * vite desta árvore no ar na 1466: `/@fs/C:/dev/labirinto-outro/client/porta.js`
 * — caminho que NÃO EXISTE — respondeu **200**, porque o vite cai no
 * `index.html` do app (fallback de SPA) em vez de recusar. Um `status === 200`
 * teria aprovado qualquer servidor, que é exatamente o falso-verde que esta
 * guarda existe para fechar. O que prova a árvore é o corpo trazer o arquivo
 * pedido: a marca sai do `client/porta.js` DESTA árvore, lido na hora.
 */
/**
 * A marca que reconhece `client/porta.js` desta árvore dentro da resposta do
 * servidor. Sai do arquivo LIDO na hora e não de uma string digitada aqui: se
 * alguém renomear a função, a guarda fica vermelha com endereço em vez de
 * aprovar qualquer corpo.
 */
const MARCA_DA_ARVORE = (() => {
  try {
    const texto = fs.readFileSync(path.join(CLIENTE, 'porta.js'), 'utf8')
    return texto.indexOf('portaDoProjeto') === -1 ? '' : 'portaDoProjeto'
  } catch (e) {
    return ''
  }
})()

function guardaArvoreDoServidor(resposta, url, marcaLocal) {
  const status = (resposta || {}).status
  const corpo = String((resposta || {}).corpo || '')
  const marca = String(marcaLocal || '')
  if (marca === '') {
    return reprova(
      'g26-arvore-do-servidor',
      'não há marca para reconhecer esta árvore: `client/porta.js` não foi lido ou está vazio. Sem marca, qualquer resposta passaria.',
      'client/porta.js',
    )
  }
  const trecho = corpo.replace(/\s+/g, ' ').slice(0, 120)
  if (status !== 200 || corpo.indexOf(marca) === -1) {
    return reprova(
      'g26-arvore-do-servidor',
      'o servidor que atendeu nesta porta NÃO serve esta árvore de trabalho: GET ' + url + ' -> ' +
        (status === -1 ? 'sem resposta' : 'status ' + status) + ', e o corpo não traz `' + marca + '`' +
        (trecho === '' ? '' : ' (veio: ' + trecho + '…)') +
        '. Com LAB_PORTA fixo, duas árvores disputam a mesma porta e quem chegou primeiro fica com ela — tudo o que for medido aqui ' +
        'seria sobre o código de OUTRA peça. Feche o servidor alheio, ou tire LAB_PORTA e deixe `client/porta.js` dar uma porta por árvore.',
      'client/porta.js (LAB_PORTA vence a porta por árvore) + PORTAO_URL_EDITOR',
    )
  }
  return ok('g26-arvore-do-servidor', 'o servidor desta porta serve ESTA árvore: GET ' + url + ' -> 200 com `' + marca + '` no corpo')
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
 * A lista de specs do modo `--jornada=` está COMPLETA?
 *
 * O detector de falso-verde (`ruina` + `exige`) julga o relatório do que rodou:
 * ele pega `N skipped`, `N flaky`, `did not run` e suíte sem nenhum `N passed`.
 * O que ele não tem como pegar é a jornada que nunca entrou na linha de comando
 * — sete das oito jornadas do critério saem `19 passed`, exit 0, relatório
 * impecável, e a oitava (vermelha) simplesmente não existiu. Era o último
 * caminho de verde silencioso do comando 15, e ele dependia de digitar oito
 * caminhos à mão sem errar.
 *
 * A regra é: quem roda ALGUMA jornada de um GRUPO da bar roda TODAS as daquele
 * grupo, menos as dispensadas com motivo (`JORNADAS_DISPENSADAS`). Lista que não
 * toca nenhuma jornada da bar é amostra avulsa e segue livre — é para isso que o
 * modo existe.
 *
 * A completude é POR GRUPO e não pela bar inteira porque o portão tem dois
 * lados de propósito (ver `GRUPOS_DA_BAR`): exigir os dois na mesma linha de
 * comando trava a regressão atrás de um critério que ainda está vermelho, e
 * nenhum dos dois comandos chega a rodar um teste sequer. O grupo que NÃO foi
 * tocado sai NOMEADO no verde: omitir continua sendo audível, só deixou de ser
 * fatal.
 */
function guardaListaDeJornadas(alvos, grupos, dispensadas) {
  const pedidas = new Set(alvos || [])
  const dispensa = dispensadas || {}
  // Aceita tanto a lista de grupos quanto uma lista plana de specs (um grupo só):
  // as provas do autoteste e qualquer chamador antigo continuam significando a
  // mesma coisa.
  const lista =
    Array.isArray(grupos) && grupos.length > 0 && typeof grupos[0] === 'string'
      ? [{ id: 'bar', titulo: 'jornadas da bar', jornadas: grupos }]
      : (grupos || []).map((g) => ({ id: g.id, titulo: g.titulo || g.id, jornadas: g.jornadas || [] }))
  const tocados = lista.filter((g) => g.jornadas.some((j) => pedidas.has(j)))
  if (tocados.length === 0) {
    return ok('g19-lista-de-jornadas', (alvos || []).length + ' spec(s) fora das jornadas da bar: lista avulsa, sem exigência de completude')
  }
  // UMA jornada só: o comando de UMA PEÇA, e ele passa.
  //
  // MEDIDO em 21/09/2026, madrugada. A rodada tinha cinco peças de cliente, uma
  // por feature, e o comando declarado de cada uma rodava a jornada DELA:
  // `--jornada=r3-linha-pontilhada e2e/task-jornada-linha-pontilhada.spec.ts`.
  // Todas as cinco jornadas moram no grupo `criterio` (17 specs), então a regra
  // de completude acusava cada comando de omitir as outras 16 e devolvia exit 2
  // ANTES do Playwright: as cinco peças da rodada ficaram sem conseguir rodar
  // uma jornada sequer. É o MESMO deadlock de desenho que `GRUPOS_DA_BAR`
  // descreve entre os dois grupos, reaparecido um nível abaixo — agora entre a
  // peça e o grupo dela.
  //
  // POR QUE ISTO NÃO REABRE O FALSO-VERDE que a guarda existe para fechar. O
  // buraco original era outro: uma linha de comando com OITO caminhos digitados
  // à mão, em que esquecer um fazia o relatório sair `19 passed`, exit 0, e a
  // jornada ausente não deixava rastro nenhum. Uma lista de UM spec não tem
  // onde esconder: ela nomeia exatamente o que mede, o `exige` do passo cobra
  // que esse um tenha passado, e caminho errado já morre no teste de existência
  // logo acima. A exigência de completude continua FATAL para qualquer lista de
  // dois ou mais — que é onde a omissão por digitação mora.
  //
  // O que se perde é a garantia de que as outras 16 rodaram, e ela não se perde
  // em silêncio: o verde abaixo nomeia o grupo, quantas ficaram de fora e diz
  // com todas as letras que este comando não prova nada sobre elas.
  if (pedidas.size === 1) {
    const grupo = tocados[0]
    const unica = Array.from(pedidas)[0]
    const foraDesteComando = grupo.jornadas.filter((j) => j !== unica)
    return ok(
      'g19-lista-de-jornadas',
      'UMA jornada nesta linha (' + unica + '), do grupo `' + grupo.id + '` (' + grupo.titulo + '): é o comando de UMA PEÇA, e a ' +
        'completude do grupo não é cobrada dele — uma lista de um spec nomeia exatamente o que mede.\n' +
        'este comando NÃO prova nada sobre as outras ' + foraDesteComando.length + ' do grupo `' + grupo.id + '`: ' +
        (foraDesteComando.join(', ') || '(nenhuma)') + '\n' +
        'o grupo inteiro tem passo próprio no PLANO — rode-o antes de declarar a rodada verde.',
    )
  }
  const buracos = tocados
    .map((g) => ({ grupo: g, faltando: g.jornadas.filter((j) => !pedidas.has(j) && !Object.prototype.hasOwnProperty.call(dispensa, j)) }))
    .filter((x) => x.faltando.length > 0)
  if (buracos.length > 0) {
    return reprova(
      'g19-lista-de-jornadas',
      buracos
        .map(
          (x) =>
            'o grupo `' + x.grupo.id + '` (' + x.grupo.titulo + ') está INCOMPLETO na linha de comando: OMITE ' +
            x.faltando.length + ' de ' + x.grupo.jornadas.length + ' — ' + x.faltando.join(', '),
        )
        .join('\n') +
        '. Jornada que não entra na lista não aparece como vermelha — aparece como nada, e o relatório sai `N passed` com exit 0. ' +
        'Rode o grupo inteiro, ou declare a dispensa com motivo.',
      'scripts/portao.cjs (GRUPOS_DA_BAR / JORNADAS_DISPENSADAS)',
    )
  }
  const naoTocados = lista.filter((g) => !tocados.includes(g))
  const dispensadasFora = tocados.reduce((acc, g) => acc.concat(g.jornadas.filter((j) => !pedidas.has(j))), [])
  return ok(
    'g19-lista-de-jornadas',
    'grupo(s) COMPLETO(s) nesta linha: ' +
      tocados.map((g) => g.id + ' (' + g.jornadas.filter((j) => pedidas.has(j)).length + ' de ' + g.jornadas.length + ')').join(', ') +
      (naoTocados.length === 0
        ? ''
        : '\ngrupo(s) que NÃO entraram nesta linha — rodam em comando próprio, e a ausência aqui não é prova de nada:\n' +
          naoTocados.map((g) => '  ' + g.id + ': ' + g.titulo + ' (' + g.jornadas.join(', ') + ')').join('\n')) +
      (dispensadasFora.length === 0
        ? '\nnenhuma dispensada'
        : '\ndispensada(s) com motivo declarado:\n' + dispensadasFora.map((j) => '  ' + j + ': ' + dispensa[j]).join('\n')),
  )
}

/**
 * Os alvos desta rodada têm REGRESSÃO dentro da volta comum?
 *
 * `JORNADAS_REGRESSAO_DOS_ALVOS` só vale alguma coisa se algum passo que a
 * volta comum ALCANÇA de fato rodar aqueles specs. Declarar a lista e esquecer
 * de ligá-la num passo — ou ligá-la só num passo `prova: true`, que nasce
 * vermelho e fica fora da volta comum — devolve o portão exatamente ao buraco
 * que ela existe para fechar: exit 0 com o alvo quebrado. A lista não se
 * fiscaliza sozinha; esta guarda é o fiscal dela.
 */
function guardaAlvosComRegressao(plano, specs) {
  const lista = specs || []
  if (lista.length === 0) {
    return reprova(
      'g25-alvos-com-regressao',
      'nenhum spec de regressão declarado para os alvos da rodada: os defeitos do critério ficam com UM comando só, e ele nasce vermelho',
      'scripts/portao.cjs (JORNADAS_REGRESSAO_DOS_ALVOS)',
    )
  }
  const rodados = new Set()
  for (const passo of plano || []) {
    if (passo.fora || passo.prova || !Array.isArray(passo.args)) continue
    for (const arg of passo.args) rodados.add(arg)
  }
  const fora = lista.filter((s) => !rodados.has(s))
  if (fora.length > 0) {
    return reprova(
      'g25-alvos-com-regressao',
      'declarado(s) e NÃO rodado(s) por passo nenhum da volta comum: ' + fora.join(', ') +
        '. Spec que só existe na constante não protege alvo nenhum — o passo do critério nasce vermelho e fica de fora da volta comum, ' +
        'então sem isto os alvos voltam a poder quebrar com exit 0.',
      'scripts/portao.cjs (PLANO, passo `jornadas-e2e`)',
    )
  }
  return ok(
    'g25-alvos-com-regressao',
    lista.length + ' spec(s) de regressão dos alvos dentro da volta comum (cadeado de camada, rascunho do polígono, menu de variante)',
  )
}

// ---------------------------------------------------------------------------
// FASE 1 — comandos, com exit code real e detector de falso-verde.
// ---------------------------------------------------------------------------

const TSC = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')
const VITEST = path.join(RAIZ, 'node_modules', 'vitest', 'vitest.mjs')
/** Teto de forks do vitest no passo `unidade` (`PORTAO_VITEST_WORKERS`, padrão 4). */
const WORKERS_DO_VITEST = (() => {
  const n = Math.floor(Number(process.env.PORTAO_VITEST_WORKERS))
  return Number.isFinite(n) && n > 0 ? n : 4
})()
const PLAYWRIGHT = path.join(RAIZ, 'node_modules', '@playwright', 'test', 'cli.js')

// ---------------------------------------------------------------------------
// VAGAS DE PLAYWRIGHT — na MÁQUINA inteira, não por árvore.
//
// MEDIDO em 22/09/2026, 23h: 8+ lanes, cada uma na sua árvore, cada uma
// chamando este portão. Cada suíte do Playwright sobe `workers: 4` com Pixi em
// WebGL por software: 11 vites, ~100 processos node, e jornadas que passam
// sozinhas (escada-legivel, selecao-arrasto, pincel-balde,
// luz-que-para-na-parede) estourando 30 s/90 s de timeout. Vermelho de CARGA,
// não de defeito — e ele travava o juízo de todas as lanes.
//
// Aqui cada execução do Playwright pega uma vaga antes de rodar e devolve
// depois. As vagas são arquivos `vaga-<k>.lock` em %TEMP%, criados com `wx`
// (criar-se-não-existe é atômico no sistema de arquivos), então duas árvores
// diferentes enxergam o MESMO semáforo sem combinar nada. Workers, timeouts e
// jornadas não mudam: muda só quantas suítes disputam a CPU ao mesmo tempo.
//
// `PORTAO_VAGAS=0` desliga (comportamento antigo). Ausente ou inválido: 3.
// ---------------------------------------------------------------------------
const VAGAS = path.join(SAIDA, 'vagas')
const VAGAS_PADRAO = 3
/** Vaga mais velha que isto é de processo que sumiu sem devolver (nenhuma suíte dura 3 h). */
const VAGA_ORFA_MS = 3 * 60 * 60 * 1000
/** Arquivo de vaga ilegível só conta como órfão depois disto — antes pode ser só a escrita em andamento. */
const VAGA_ILEGIVEL_MS = 10 * 1000
const VAGA_POLLING_MS = 2000
const VAGA_AVISO_MS = 30 * 1000
/** Vagas nas mãos deste processo, para o `exit`/sinal devolverem mesmo sem `finally`. */
const VAGAS_EM_MAOS = new Set()
let vagasComSaidaRegistrada = false

function quantasVagas(env) {
  const bruto = env.PORTAO_VAGAS
  if (bruto === undefined || String(bruto).trim() === '') return VAGAS_PADRAO
  const n = Number(bruto)
  // `Number(x) || 3` transformaria o 0 em 3 — e 0 é justamente o "desliga".
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : VAGAS_PADRAO
}

function pidVivo(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM: o processo existe, só não é nosso. Só ESRCH prova que morreu.
    return !(e && e.code === 'ESRCH')
  }
}

/**
 * O juízo de uma vaga, separado do disco para ter autoteste: vaga de pid morto
 * ou mais velha que 3 h é órfã e pode ser retomada; vaga ilegível só depois de
 * `VAGA_ILEGIVEL_MS` (antes disso o dono pode estar no meio da escrita).
 */
function julgarVaga(dono, agoraMs, idadeDoArquivoMs, vivo) {
  if (!dono || !Number.isFinite(Number(dono.pid))) {
    return idadeDoArquivoMs > VAGA_ILEGIVEL_MS
      ? { orfa: true, motivo: 'arquivo de vaga ilegível há ' + Math.round(idadeDoArquivoMs / 1000) + ' s' }
      : { orfa: false, motivo: 'arquivo de vaga sendo escrito' }
  }
  if (!vivo(Number(dono.pid))) return { orfa: true, motivo: 'pid ' + dono.pid + ' morto' }
  const desde = Date.parse(dono.desde)
  const idade = Number.isFinite(desde) ? agoraMs - desde : idadeDoArquivoMs
  if (idade > VAGA_ORFA_MS) return { orfa: true, motivo: 'vaga com ' + Math.round(idade / 60000) + ' min (teto ' + VAGA_ORFA_MS / 60000 + ' min)' }
  return { orfa: false, motivo: 'pid ' + dono.pid + ' vivo' }
}

function lerVaga(caminho) {
  let bruto
  let idade
  try {
    idade = Date.now() - fs.statSync(caminho).mtimeMs
    bruto = fs.readFileSync(caminho, 'utf8')
  } catch (e) {
    return null // sumiu entre o readdir e a leitura: foi devolvida
  }
  try {
    return { bruto, idade, dono: JSON.parse(bruto) }
  } catch (e) {
    return { bruto, idade, dono: null }
  }
}

function escreverNaTela(texto) {
  // `fs.writeSync` porque a espera bloqueia o laço de eventos (Atomics.wait) e
  // um `process.stdout.write` em TTY do Windows só sairia depois dela.
  try {
    fs.writeSync(1, texto)
  } catch (e) {
    // Sem terminal para escrever não é motivo para largar a vaga.
  }
}

function tentarCriarVaga(caminho, dono) {
  let fd
  try {
    fd = fs.openSync(caminho, 'wx')
  } catch (e) {
    if (e && e.code === 'EEXIST') return false
    throw e
  }
  try {
    fs.writeSync(fd, JSON.stringify(dono))
  } finally {
    fs.closeSync(fd)
  }
  return true
}

/**
 * Retoma a vaga se ela for órfã. Renomeia antes de apagar e confere que o que
 * foi renomeado é a MESMA órfã que foi julgada: se outro processo a retomou e
 * criou a dele no intervalo, a dele volta para o lugar em vez de sumir.
 */
function retomarSeOrfa(caminho) {
  const lida = lerVaga(caminho)
  if (!lida) return null
  const juizo = julgarVaga(lida.dono, Date.now(), lida.idade, pidVivo)
  if (!juizo.orfa) return null
  const lixo = caminho + '.orfa-' + process.pid + '-' + Date.now()
  try {
    fs.renameSync(caminho, lixo)
  } catch (e) {
    return null // outro processo chegou primeiro
  }
  let conferido = null
  try {
    conferido = fs.readFileSync(lixo, 'utf8')
  } catch (e) {
    conferido = null
  }
  if (conferido !== lida.bruto) {
    try {
      fs.copyFileSync(lixo, caminho, fs.constants.COPYFILE_EXCL)
    } catch (e) {
      // Alguém já ocupou o lugar; o dono da vaga renomeada a verá sumida e só
      // deixa de devolvê-la — nada é apagado de terceiro.
    }
    try {
      fs.unlinkSync(lixo)
    } catch (e) {}
    return null
  }
  try {
    fs.unlinkSync(lixo)
  } catch (e) {}
  const quem = lida.dono ? (lida.dono.raiz || '?') + '/' + (lida.dono.passo || '?') : 'dono desconhecido'
  escreverNaTela('vaga de máquina retomada: ' + path.basename(caminho) + ' (' + juizo.motivo + '; era de ' + quem + ')\n')
  return juizo
}

function ocupantes() {
  let nomes = []
  try {
    nomes = fs.readdirSync(VAGAS).filter((n) => /^vaga-\d+\.lock$/.test(n))
  } catch (e) {
    return []
  }
  return nomes
    .map((n) => lerVaga(path.join(VAGAS, n)))
    .filter(Boolean)
    .map((l) => (l.dono ? (l.dono.raiz || '?') + '/' + (l.dono.passo || '?') + ' pid ' + l.dono.pid : '(escrevendo)'))
}

function devolverVaga(vaga) {
  if (!vaga || !VAGAS_EM_MAOS.has(vaga)) return
  VAGAS_EM_MAOS.delete(vaga)
  if (VAGAS_EM_MAOS.size === 0) sinaisDasVagas(false)
  // Só apaga se o arquivo ainda for DESTE dono: uma vaga retomada como órfã
  // (3 h) pode já ser de outro processo.
  const lida = lerVaga(vaga.caminho)
  if (lida && lida.bruto === vaga.bruto) {
    try {
      fs.unlinkSync(vaga.caminho)
    } catch (e) {}
  }
  escreverNaTela(
    'vaga de ' + vaga.rotulo + ' ' + vaga.k + ' de ' + vaga.n + ' devolvida em ' + new Date().toISOString() + ' — ' + vaga.dono.passo + '\n',
  )
}

function devolverTodasAsVagas() {
  for (const v of Array.from(VAGAS_EM_MAOS)) devolverVaga(v)
  for (const s of Array.from(SENHAS_EM_MAOS)) rasgarSenha(s)
}

const SINAIS_DAS_VAGAS = [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]].map(([sinal, codigo]) => ({
  sinal,
  ouvinte: () => {
    devolverTodasAsVagas()
    process.exit(codigo)
  },
}))

function registrarSaidaDasVagas() {
  if (vagasComSaidaRegistrada) return
  vagasComSaidaRegistrada = true
  process.on('exit', devolverTodasAsVagas)
}

/**
 * Os ouvintes de sinal só existem ENQUANTO há vaga na mão. Ouvinte de SIGINT
 * troca o Ctrl+C nativo (que mata na hora) por um callback de JS — e durante a
 * espera o `Atomics.wait` nunca devolve o laço, então um ouvinte ali deixaria
 * o Ctrl+C sem efeito. Esperando, sem vaga, o Ctrl+C mata como sempre matou.
 */
function sinaisDasVagas(ligar) {
  for (const s of SINAIS_DAS_VAGAS) {
    process.removeListener(s.sinal, s.ouvinte)
    if (ligar) process.on(s.sinal, s.ouvinte)
  }
}

// ---------------------------------------------------------------------------
// FILA — ordem de chegada entre quem espera vaga.
//
// MEDIDO em 23/09/2026: com o passo por spec, um processo devolve a vaga e
// pede a próxima no MESMO instante, enquanto quem espera só olha a cada 2 s.
// Resultado: `jornadas-entregues` ficou 25 min sem vaga, perdendo toda corrida
// para quem acabava de devolver. Aqui quem espera tira uma senha (arquivo com
// o instante de chegada no nome) e só pode ocupar vaga livre quando a posição
// dela na fila é menor que o número de vagas livres. Quem devolve e pede de
// novo tira senha nova — vai para o FIM da fila.
// ---------------------------------------------------------------------------
const FILA = path.join(VAGAS, 'fila')
const SENHAS_EM_MAOS = new Set()
let senhaSeq = 0

function tirarSenha(passo) {
  fs.mkdirSync(FILA, { recursive: true })
  senhaSeq += 1
  const nome = String(Date.now()).padStart(15, '0') + '-' + process.pid + '-' + senhaSeq + '.senha'
  const caminho = path.join(FILA, nome)
  fs.writeFileSync(caminho, JSON.stringify({ pid: process.pid, raiz: RAIZ, passo: passo.id }), 'utf8')
  SENHAS_EM_MAOS.add(caminho)
  return caminho
}

function rasgarSenha(caminho) {
  if (!caminho) return
  SENHAS_EM_MAOS.delete(caminho)
  try {
    fs.unlinkSync(caminho)
  } catch (e) {}
}

/** As senhas VIVAS, em ordem de chegada. Senha de processo morto é rasgada no caminho. */
function senhasVivas() {
  let nomes = []
  try {
    nomes = fs.readdirSync(FILA).filter((n) => /^\d{15}-\d+-\d+\.senha$/.test(n))
  } catch (e) {
    return []
  }
  const vivas = []
  for (const nome of nomes.sort()) {
    const pid = Number(nome.split('-')[1])
    if (pid === process.pid || pidVivo(pid)) vivas.push(path.join(FILA, nome))
    else rasgarSenha(path.join(FILA, nome))
  }
  return vivas
}

/**
 * A vez de uma senha, separada do disco para ter autoteste: com `livres`
 * vagas livres, as `livres` primeiras senhas da fila podem ocupá-las.
 */
function minhaVez(fila, minha, livres) {
  const posicao = fila.indexOf(minha)
  return posicao !== -1 && posicao < livres
}

/** Quantas das vagas 1..n estão livres agora (órfãs já retomadas). */
function vagasLivres(n) {
  let livres = 0
  for (let k = 1; k <= n; k++) {
    const caminho = path.join(VAGAS, 'vaga-' + k + '.lock')
    if (!fs.existsSync(caminho) || retomarSeOrfa(caminho)) livres += 1
  }
  return livres
}

/**
 * Bloqueia até existir vaga (ou devolve `null` com `PORTAO_VAGAS=0`). A espera
 * dorme em `Atomics.wait` — CPU zero — e reclama a cada 30 s dizendo quem
 * ocupa. O tempo esperado volta em `esperouMs`, fora do tempo do passo. A ordem
 * entre quem espera é a de chegada (ver FILA).
 */
function pegarVaga(passo) {
  const n = quantasVagas(process.env)
  if (n === 0) return null
  fs.mkdirSync(VAGAS, { recursive: true })
  registrarSaidaDasVagas()
  const t0 = Date.now()
  let ultimoAviso = t0
  const sono = new Int32Array(new SharedArrayBuffer(4))
  const senha = tirarSenha(passo)
  try {
    return esperarNaFila(passo, n, senha, t0, ultimoAviso, sono)
  } finally {
    rasgarSenha(senha)
  }
}

function esperarNaFila(passo, n, senha, t0, ultimoAviso, sono) {
  for (;;) {
    const naVez = minhaVez(senhasVivas(), senha, vagasLivres(n))
    for (let k = 1; naVez && k <= n; k++) {
      const caminho = path.join(VAGAS, 'vaga-' + k + '.lock')
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const dono = { pid: process.pid, desde: new Date().toISOString(), raiz: RAIZ, passo: passo.id }
        if (tentarCriarVaga(caminho, dono)) {
          const vaga = { caminho, k, n, dono, rotulo: rotuloDaVaga(passo), bruto: JSON.stringify(dono), esperouMs: Date.now() - t0 }
          VAGAS_EM_MAOS.add(vaga)
          sinaisDasVagas(true)
          escreverNaTela(
            'vaga de ' + vaga.rotulo + ' ' + k + ' de ' + n + ' pega em ' + dono.desde + ' — ' + passo.id +
              ' (esperou vaga ' + (vaga.esperouMs / 1000).toFixed(1) + ' s)\n',
          )
          return vaga
        }
        if (tentativa === 0 && !retomarSeOrfa(caminho)) break
      }
    }
    if (Date.now() - ultimoAviso >= VAGA_AVISO_MS) {
      ultimoAviso = Date.now()
      const quem = ocupantes()
      const fila = senhasVivas()
      escreverNaTela(
        'aguardando vaga de ' + rotuloDaVaga(passo) + ': ' + quem.length + ' de ' + n + ' (quem: ' + (quem.join('; ') || '?') + ') — ' +
          passo.id + ', há ' + Math.round((ultimoAviso - t0) / 1000) + ' s, ' + (fila.indexOf(senha) + 1) + 'º de ' + fila.length + ' na fila\n',
      )
    }
    Atomics.wait(sono, 0, 0, VAGA_POLLING_MS)
  }
}

/** Forma de guarda (`ok`/`detalhe`) do `julgarVaga`: APROVA = a vaga fica com o dono. */
function vagaPresa(juizo) {
  return juizo.orfa ? reprova('g32-vagas', 'órfã: ' + juizo.motivo) : ok('g32-vagas', 'presa: ' + juizo.motivo)
}

/**
 * Passo PESADO de CPU: jornada (suíte do Playwright), sonda que abre o
 * chromium, ou a suíte do vitest (`vaga: 'vitest'`). Todos na MESMA fila — ver
 * o passo `unidade` para o porquê.
 */
function precisaDeVaga(passo) {
  return Boolean(passo.artefatos || passo.vaga)
}

/** Nome do que ocupa a vaga, para as linhas de espera e de teto. */
function rotuloDaVaga(passo) {
  return typeof passo.vaga === 'string' ? passo.vaga : 'Playwright'
}

// ---------------------------------------------------------------------------
// TETO DO PLAYWRIGHT — processo travado não segura vaga por 3 h.
//
// MEDIDO em 23/09/2026 na fumaça das vagas: duas vezes o Playwright ficou vivo
// e parado (CPU 2 s em 15 min) depois que o vite dele subiu tarde e ficou
// órfão na porta. Sem teto, o `spawnSync` esperava para sempre e a vaga só
// voltava pelo teto de órfã (3 h) — a máquina inteira perdia uma vaga.
// Estourou: a ÁRVORE do processo morre (taskkill /F /T), o passo sai VERMELHO
// com a linha de teto na frente e a vaga volta pelo `finally` de `rodarPasso`.
// ---------------------------------------------------------------------------
const TETO_PLAYWRIGHT_PADRAO_MIN = 45
/** Depois do `exit`, quanto esperar os pipes fecharem antes de desistir deles. */
const ESPERA_DE_PIPE_MS = 15 * 1000

function tetoDoPlaywrightMs(env) {
  const n = Number(env.PORTAO_TETO_PLAYWRIGHT_MIN)
  return (Number.isFinite(n) && n > 0 ? n : TETO_PLAYWRIGHT_PADRAO_MIN) * 60 * 1000
}

function linhaDeTeto(tetoMs, rotulo, variavel) {
  const min = Math.round((tetoMs / 60000) * 100) / 100
  return (rotulo || 'Playwright') + ' passou do teto de ' + min + ' min (travado?) — a árvore de processos foi morta e o passo NÃO mediu nada; ' +
    'não é falha de teste. Teto em ' + (variavel || 'PORTAO_TETO_PLAYWRIGHT_MIN') + '.'
}

function matarArvore(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
    return
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch (e) {}
}

/** Quanto antes do teto o Playwright para sozinho — tempo de imprimir o relatório e fechar o vite. */
const FOLGA_DO_LIMITE_GLOBAL_MS = 90 * 1000

/**
 * Os args do Playwright com `--global-timeout` um pouco abaixo do teto do
 * portão (ideia da lane G13, 23/09/2026). MEDIDO na mesma noite: o passo
 * `jornadas-entregues` bateu no teto de 45 min sob carga e o que sobrou foi só a
 * lista de `ok`/`x`, sem o resumo e sem o motivo de cada `x` — o Playwright
 * morreu antes de imprimi-los. Parando sozinho antes, ele sai com o placar
 * inteiro (`did not run`/`interrupted` são ruína, então nada vira verde) e
 * derruba o próprio webServer; o teto continua lá para quem travar de verdade.
 * Só para jornada (suíte do Playwright); `passo.args` fica intocado.
 */
function argsComLimiteGlobal(passo, tetoMs) {
  if (!passo.artefatos || tetoMs <= FOLGA_DO_LIMITE_GLOBAL_MS * 2) return passo.args
  // O `--global-timeout` entra ANTES da lista de specs: depois dela o Playwright o
  // leria como filtro de arquivo.
  const i = passo.args.indexOf('test')
  const limite = '--global-timeout=' + (tetoMs - FOLGA_DO_LIMITE_GLOBAL_MS)
  return passo.args.slice(0, i + 1).concat([limite], passo.args.slice(i + 1))
}

/**
 * Mata (com a árvore) quem escuta na porta e devolve os PIDs mortos. Só para o
 * pós-teto: é o que alcança o vite órfão que `matarArvore` não alcança.
 */
function matarQuemOcupaAPorta(porta) {
  const mortos = []
  for (const dono of quemOcupaAPorta(porta)) {
    const pid = Number((/^PID (\d+)/.exec(dono) || [])[1])
    if (!pid || pid === process.pid) continue
    matarArvore(pid)
    mortos.push(pid)
  }
  return mortos
}

/**
 * O `spawnSync` do passo, com teto. Devolve a mesma forma (`status`, `stdout`,
 * `stderr`, `error`) mais `estourou` e `tetoMs`. Assíncrono porque só assim dá
 * para matar a ÁRVORE enquanto o pai ainda vive: o `timeout` do `spawnSync`
 * mata só o filho direto, e no Windows os netos (vite, chromium) ficam.
 */
function rodarComTeto(exe, args, opcoes, tetoMs) {
  return new Promise((resolve) => {
    const saidas = { stdout: '', stderr: '' }
    let estourou = false
    let status = null
    let erro = null
    let terminou = false
    let filho
    const fim = () => {
      if (terminou) return
      terminou = true
      clearTimeout(relogio)
      clearTimeout(desistenciaDoPipe)
      resolve({ status, stdout: saidas.stdout, stderr: saidas.stderr, error: erro, estourou, tetoMs })
    }
    let desistenciaDoPipe = null
    let relogio = null
    try {
      filho = spawn(exe, args, { cwd: opcoes.cwd, env: opcoes.env, shell: opcoes.shell, windowsHide: true })
    } catch (e) {
      erro = e
      fim()
      return
    }
    for (const nome of ['stdout', 'stderr']) {
      filho[nome].setEncoding('utf8')
      filho[nome].on('data', (pedaco) => {
        // Mesmo teto de memória do `spawnSync` (maxBuffer): guarda o FIM, que é onde mora o resumo.
        saidas[nome] = (saidas[nome] + pedaco).slice(-opcoes.maxBuffer)
      })
    }
    relogio = setTimeout(() => {
      estourou = true
      matarArvore(filho.pid)
    }, tetoMs)
    filho.on('error', (e) => {
      erro = e
      fim()
    })
    filho.on('exit', (codigo) => {
      status = estourou ? null : codigo
      clearTimeout(relogio)
      // Neto fora da árvore segurando o pipe não pode prender o passo de novo.
      desistenciaDoPipe = setTimeout(() => {
        filho.stdout.destroy()
        filho.stderr.destroy()
        fim()
      }, ESPERA_DE_PIPE_MS)
    })
    filho.on('close', fim)
  })
}

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
    // A lista de specs guardada à parte da linha de comando: `imprimirForaDaVolta`
    // precisa NOMEAR o que um passo de regressão deixou de medir, e garimpar os
    // caminhos de dentro de `args` (que tem config, repeat-each e reporter no
    // meio) é o tipo de leitura que erra em silêncio.
    specs: (arquivos || []).slice(),
    // Guardado para `rodarPorSpec` montar a invocação de cada spec com os mesmos extras.
    extras: (extras || []).slice(),
    ruina: [
      /\b\d+ skipped\b/,
      /\b\d+ flaky\b/,
      /\bdid not run\b/,
      /\b\d+ failed\b/,
      // COLISÃO DE PORTA, nomeada. Com `reuseExistingServer` desligado (é o
      // padrão desta árvore, e por bons motivos — ver playwright.config.ts), o
      // Playwright RECUSA a rodar quando alguém já atende naquele endereço:
      // "http://localhost:1420 is already used". Ele aborta ANTES do primeiro
      // teste, e um aborto não imprime `failed` nem `passed` — o relatório sai
      // sem número nenhum. Aqui isso ficava só por conta do `exige`, e quem
      // lia o portão via "faltou /passed/" em vez de "a porta estava ocupada".
      // Pior fora do portão: o filtro do rtk resume o mesmo aborto como
      // "PASS (0) FAIL (0)", que é verde para quem passa o olho.
      /is already used/i,
      /Port \d+ is already in use/i,
    ],
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
    // 23/09/2026: o tsc do projeto inteiro come ~1,5 GB e um núcleo por minutos; com
    // muitas árvores construindo ao mesmo tempo ele entra na mesma fila de vagas.
    vaga: 'tsc',
  },
  {
    id: 'tipos-e2e',
    titulo: 'tipos das jornadas e do playwright.config (client/tsconfig.e2e.json)',
    exe: process.execPath,
    args: [TSC, '--noEmit', '-p', path.join(CLIENTE, 'tsconfig.e2e.json')],
    cwd: CLIENTE,
    ruina: [/error TS\d+/],
    vaga: 'tsc',
  },
  {
    id: 'unidade',
    titulo: 'vitest (suíte inteira, até ' + WORKERS_DO_VITEST + ' workers)',
    exe: process.execPath,
    // MEDIDO em 23/09/2026 com ~9 lanes ao mesmo tempo: o vitest sobe um fork
    // por CPU (19) em cada lane, e a lane de defeitos saiu BLOQUEADA com 84
    // "Failed to start forks worker ... Timeout waiting for worker to respond",
    // 2 "Test timed out in 5000ms" em RoomControls.test.tsx e só 105 dos 189
    // arquivos rodados. Teto de workers (`--maxWorkers`; o vitest 4.1 não tem
    // mais `--minWorkers`) + vaga de máquina.
    args: [VITEST, 'run', '--reporter=default', '--maxWorkers=' + WORKERS_DO_VITEST],
    cwd: CLIENTE,
    // A MESMA fila das jornadas, e não uma `PORTAO_VAGAS_UNIDADE` própria: o que
    // se disputa é CPU, e ela é uma só. Com filas separadas, 3 suítes de
    // Playwright (4 workers + vite + chromium cada) e 3 de vitest (4 forks
    // cada) rodariam juntas — o dobro do que a fila das jornadas foi medida
    // para aguentar. Uma fila só mantém o teto de carga que o número de vagas
    // promete; o custo é o vitest (1-3 min) esperar atrás de uma jornada.
    vaga: 'vitest',
    // Arquivo de teste do juiz sumido do disco: vermelho ANTES da vaga e do vitest.
    previo: unidadeSemArquivoSumido,
    // Reprise: ruína de INFRAESTRUTURA do runner (worker que não subiu) roda o
    // passo de novo UMA vez, e só vale a segunda — ver `precisaDeReprise`. O
    // `piso` continua valendo na segunda: 105 de 189 arquivos nunca sai verde.
    reprise: [/Failed to start forks worker/, /Timeout waiting for worker/],
    // `\d+ skipped` e não `skipped`: "todo" é palavra comum em português e o
    // repositório é em português — um nome de teste derrubaria o portão à toa.
    ruina: [/\d+ skipped\b/i, /\d+ todo\b/i, /\bFAIL\b/, /No test files found/],
    // Prova positiva de ESCALA (18/09/2026). Sem ela o passo aprovava a suíte
    // reduzida a um arquivo: `Test Files 1 passed`, exit 0, nenhuma ruína — e
    // os arquivos de teste moram dentro da área de escrita das peças de
    // cliente. O piso de arquivos vem do commit base do run; o de testes está
    // declarado em `PISO_DE_TESTES_DE_UNIDADE`, aqui neste arquivo, que é área
    // do portão e não das peças.
    piso: [
      { rotulo: 'arquivos de teste', re: /Test Files\s+(\d+) passed/, minimo: pisoDeArquivosDeUnidade },
      { rotulo: 'testes', re: /\bTests\s+(\d+) passed/, minimo: PISO_DE_TESTES_DE_UNIDADE },
    ],
  },
  {
    id: 'rust-clippy',
    titulo: 'cargo clippy do exe (desktop/src-tauri)',
    exe: 'cargo',
    // `-v` NÃO é enfeite: é o que dá PROVA POSITIVA a este passo.
    //
    // MEDIDO nesta máquina em 21/09/2026, três invocações seguidas do mesmo
    // comando, todas exit 0:
    //   1ª (frio):   ... Compiling labirinto v0.1.0 (<caminho>) ... Finished
    //   2ª (morno):  ... Checking  labirinto v0.1.0 (<caminho>) ... Finished
    //   3ª (quente): `Finished `dev` profile ... in 0.34s`   — UMA LINHA, e só.
    // Com o cache cheio a saída verde inteira cabe numa linha que não diz o
    // nome de nada: "lint limpo" e "não lintei coisa nenhuma" ficam com a
    // MESMA cara, e o passo não tinha `exige` para separar os dois. Com `-v` o
    // cargo imprime `Fresh labirinto v0.1.0 (<caminho>)` também no caso
    // quente — medido: 299 linhas, 10 KB, custo nenhum.
    //
    // CONFRONTADO COM CARGO DE VERDADE em 21/09/2026, com o alvo compartilhado
    // já quente (14,2 s, exit 0, 302 linhas). As duas linhas que o `exige`
    // cobra, copiadas da saída daquele run:
    //     Compiling labirinto v0.1.0 (C:\dev\labirinto\.claude\worktrees\wf_58a1f005-b8d-5\desktop\src-tauri)
    //      Finished `dev` profile [unoptimized + debuginfo] target(s) in 14.10s
    // Importa porque o autoteste do `exige` monta o texto esperado com o mesmo
    // `path.join` que alimenta a regex — ele prova a régua, não o formato do
    // cargo. Quem prova o formato é este run, e ele nomeou o crate DESTA
    // árvore mesmo escrevendo no `target` da principal (CARGO_TARGET_DIR).
    args: ['clippy', '--all-targets', '--all-features', '-v', '--', '-D', 'warnings', '-W', 'clippy::unwrap_used', '-W', 'clippy::expect_used'],
    cwd: TAURI,
    shell: true,
    cargo: true,
    // Sem `^warning:`: o `-D warnings` acima já reprova warning de verdade pelo
    // exit code, e cargo imprime aviso benigno de manifesto que viraria falso vermelho.
    ruina: [/\berror(\[E\d+\])?:/],
    // Prova positiva, nas duas pontas: o crate DESTA árvore foi considerado (e
    // pelo caminho absoluto, que é a única coisa que difere entre dois
    // worktrees do mesmo repositório — o mesmo discriminador que `/@fs/` dá às
    // jornadas), e o cargo chegou ao fim do grafo.
    exige: [PROVA_DE_CLIPPY_NESTA_ARVORE, /\bFinished\b/],
  },
  {
    id: 'rust-test',
    titulo: 'cargo test do transporte (net_server.rs + módulos cfg(test))',
    exe: 'cargo',
    args: ['test', '--all-features'],
    cwd: TAURI,
    shell: true,
    cargo: true,
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
    // EXCLUSÃO DECLARADA (Invariante 11): o IP está fixo e errado, e o servidor
    // só nasce quando alguém abre a sala — é pendência da manhã, não critério
    // desta rodada. Antes isso era um fato invisível: o passo não era `prova`,
    // nenhum dos 16 comandos o alcançava, e o aviso em voz alta só listava
    // passos de prova, então os 16 saíam verdes sem nunca nomear o que ficou
    // de fora. Agora a exclusão tem motivo escrito e sai impressa em toda
    // chamada; `--so=transporte-vivo` continua alcançando o passo.
    fora: 'Invariante 11: IP fixo errado e servidor que só nasce por gente abrindo a sala — pendência da manhã',
  },
  {
    id: 'servidor-limpo',
    titulo: 'editor sem módulo duplicado por HMR (senão toda afirmação por store é sobre a store errada)',
    sonda: sondarServidorLimpo,
    // Abre um chromium do Playwright: entra na fila das vagas como as jornadas.
    vaga: true,
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
    titulo:
      'Invariante 6: as ' + JORNADAS_SELADAS.length + ' jornadas seladas continuam com o hash do selo (ou o do commit base do run)',
    sonda: sondarJornadasIntactas,
  },
  {
    id: 'disco',
    titulo: 'Invariante 8 MEDIDA (a premissa declarada estava velha)',
    sonda: sondarDisco,
  },
  jornada('estilo-minimapa', 'Invariante 1 medida em pixel (chão chapado, parede clara e fina, sem grade)', [JORNADA_ESTILO]),
  jornada('jornada-vista-movel', 'Invariante 4: a vista continua móvel por botão do meio e por Espaço+arrastar', [JORNADA_VISTA_MOVEL]),
  // UMA invocação do Playwright POR SPEC nos três passos de regressão (ver
  // `rodarPorSpec`). MEDIDO em 23/09/2026: `jornadas-entregues` numa invocação
  // só bateu no teto de 45 min duas vezes sob carga, e o placar que sobrava
  // não dizia qual spec travou nem por quê. Por spec, cada um tem vaga, teto
  // (PORTAO_TETO_SPEC_MIN, 20) e reprise de timeout próprios, e o vermelho
  // nomeia o spec e a causa. O que os passos PROVAM não muda: a mesma lista de
  // specs, o mesmo detector de falso-verde em cada um, o mesmo recibo — e a
  // config não tem `fullyParallel`, então os testes de um arquivo já rodavam
  // em série num worker só; o que se perde é só o paralelismo ENTRE arquivos,
  // que é justamente a carga que derrubava a máquina.
  Object.assign(
    jornada(
      'jornadas-e2e',
      'jornadas já entregues, com ponteiro real, mais a regressão dos menus e dos TRÊS ALVOS que esta rodada reestrutura',
      JORNADAS_E2E.concat(JORNADAS_REGRESSAO_MENUS, JORNADAS_REGRESSAO_DOS_ALVOS),
    ),
    { porSpec: true },
  ),
  // REGRESSÃO. Roda em toda volta e tem de sair verde em toda volta. A lista é
  // DERIVADA do grupo, não digitada: antes era a bar inteira, e por isso este
  // passo nascia vermelho por causa do critério — nenhum builder conseguia
  // passar num passo que não dependia dele.
  Object.assign(
    jornada(
      'jornadas-da-bar',
      'REGRESSÃO: os gestos que a bar deste run já tinha verdes (luz, token com foto, pincel e balde, sala livre, pinos)',
      JORNADAS_DE_REGRESSAO_DA_BAR.filter((j) => !JORNADAS_DISPENSADAS[j]),
    ),
    { porSpec: true },
  ),
  // REGRESSÃO das features ENTREGUES (ver `JORNADAS_ENTREGUES`). Passo próprio,
  // e não somado ao `jornadas-da-bar`, para o recibo e o vermelho dizerem de
  // qual lado veio: gesto antigo da bar ou feature entregue nesta leva.
  Object.assign(
    jornada(
      'jornadas-entregues',
      'REGRESSÃO: as ' + JORNADAS_ENTREGUES.filter((j) => !JORNADAS_DISPENSADAS[j]).length +
        ' jornadas de features já entregues e provadas no commit juntado',
      JORNADAS_ENTREGUES.filter((j) => !JORNADAS_DISPENSADAS[j]),
    ),
    { porSpec: true },
  ),
  {
    id: 'regressao-em-dia',
    titulo: 'os ' + PASSOS_DE_REGRESSAO.length + ' passos de regressão rodaram VERDES nesta árvore, neste estado (recibo, não promessa)',
    sonda: sondarRegressaoEmDia,
  },
  // PROVA. As três jornadas do critério desta rodada. Nascem VERMELHAS: só
  // ficam verdes depois que as peças de cliente consertam os defeitos, e por
  // isso este passo fica FORA da volta comum (`prova: true`) e só entra em
  // `--prova` ou `--so=jornadas-do-criterio`. Antes dele não existia rota
  // nenhuma: os comandos de regressão saíam exit 0 com os três defeitos
  // intactos, porque nenhum passo do PLANO alcançava estes três specs.
  Object.assign(
    jornada(
      'jornadas-do-criterio',
      'PROVA: as ' + JORNADAS_DO_CRITERIO.filter((j) => !JORNADAS_DISPENSADAS[j]).length +
        ' jornadas de critério AINDA EM ABERTO — as de 18/09 e as de 20/09 (caminho com cor, etiqueta, linha pontilhada, marcador, saída sem parede e as três do acervo)',
      JORNADAS_DO_CRITERIO.filter((j) => !JORNADAS_DISPENSADAS[j]),
    ),
    { prova: true },
  ),
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
/**
 * A pergunta "o que esta peça escreveu?" respondida uma vez só, para os dois
 * passos. Devolve `{ erro }` quando não dá para medir — e quem chama fica
 * VERMELHO, porque "não consegui medir" nunca é verde (ver `arquivosMudados`).
 */
/**
 * O commit de onde as peças saíram, resolvido uma vez para todos os passos que
 * precisam comparar "antes" com "agora": `particao`, `rust-intocado`, o hash
 * das jornadas fora do selo e a base de esquema da guarda g13.
 */
function baseDoRun() {
  const { ramo, peca } = pecaDaArvore()
  let manifesto = null
  try {
    manifesto = JSON.parse(fs.readFileSync(PARTICAO, 'utf8'))
  } catch (e) {
    return { ramo, peca, manifesto: null, base: null, ref: null, erro: 'sem manifesto de partição em scripts/portao-particao.json (' + e.message + ')' }
  }
  const cabeca = String(git(['rev-parse', 'HEAD']) || '').trim() || null
  const sha = (r) => (r ? String(git(['rev-parse', r + '^{commit}']) || '').trim() || null : null)
  // Qual dos dois ponteiros julga esta peça — ver `refDaBase`. Quem pode
  // reescrever o manifesto é medido pela base que ela não consegue mover.
  const escolha = refDaBase(manifesto, peca)
  const commitOrigem = sha(escolha.refOrigem)
  const commitPecas = sha(escolha.refPecas)
  // `merge-base --is-ancestor` não imprime nada: o veredito é o código de saída,
  // e `git()` devolve string vazia no sucesso e null na reprovação.
  const origemEhAncestral =
    escolha.refOrigem !== null && escolha.refPecas !== null
      ? git(['merge-base', '--is-ancestor', escolha.refOrigem, escolha.refPecas]) !== null
      : false
  const carimbo = baseSelada()
  const refOrigemCommitada = origemDeclaradaNoCommit(commitOrigem)
  const rOrigem = guardaOrigemDaBase({
    refOrigem: escolha.refOrigem,
    refPecas: escolha.refPecas,
    commitOrigem,
    commitPecas,
    origemEhAncestral,
    refSelada: carimbo.ref,
    commitSelado: carimbo.commit,
    refOrigemCommitada: refOrigemCommitada,
    commitadaEhAncestral:
      refOrigemCommitada !== null && commitOrigem !== null
        ? git(['merge-base', '--is-ancestor', refOrigemCommitada, commitOrigem]) !== null
        : false,
  })
  const ref = escolha.ref
  if (!rOrigem.ok) {
    return { ramo, peca, manifesto, ref, base: null, cabeca, papel: escolha.papel, erro: rOrigem.detalhe + (rOrigem.endereco ? '  [' + rOrigem.endereco + ']' : '') }
  }
  const base = ref ? String(git(['merge-base', 'HEAD', ref]) || '').trim() || null : null
  // Para onde o ponteiro aponta, separado do `merge-base`: os dois só coincidem
  // quando a base é mesmo ancestral desta peça (ver `guardaBaseDoRun`).
  const commitDaBase = ref === escolha.refOrigem ? commitOrigem : commitPecas
  const r = guardaBaseDoRun({ ref, base, cabeca, peca, ramo, commitDaBase })
  if (!r.ok) return { ramo, peca, manifesto, ref, base, cabeca, papel: escolha.papel, erro: r.detalhe + (r.endereco ? '  [' + r.endereco + ']' : '') }
  return { ramo, peca, manifesto, ref, base, cabeca, papel: escolha.papel, erro: null, nota: rOrigem.detalhe + '\n' + r.detalhe }
}

/**
 * Que base o manifesto declarava DENTRO do commit para onde `base`."origem"
 * aponta — a âncora que não depende de ninguém ter rodado `--selar`.
 *
 * Um commit é imutável: a cópia de `scripts/portao-particao.json` que vive lá
 * dentro é do começo do run e nenhum builder alcança. Se a árvore de trabalho
 * aponta `origem` para um lugar e aquele commit declarava outro, a base foi
 * movida depois que o run começou. Commit sem o manifesto (base anterior a ele)
 * devolve null: a guarda trata como âncora ausente, não como divergência.
 */
function origemDeclaradaNoCommit(commitOrigem) {
  if (!commitOrigem) return null
  const bruto = git(['show', commitOrigem + ':scripts/portao-particao.json'])
  if (!bruto) return null
  try {
    const base = (JSON.parse(bruto) || {}).base || {}
    return base.origem || base.ramo || null
  } catch (e) {
    return null
  }
}

/**
 * A base que o SELO carimbou antes dos builders, quando carimbou. Fica fora de
 * `baseDoRun` porque é leitura de arquivo, e a guarda que a usa é pura.
 */
function baseSelada() {
  let selo = null
  try {
    selo = JSON.parse(fs.readFileSync(SELO, 'utf8'))
  } catch (e) {
    return { ref: null, commit: null }
  }
  const carimbo = selo && selo.base_do_run
  const ref = typeof carimbo === 'string' ? carimbo : (carimbo && (carimbo.sha || carimbo.ramo)) || null
  if (!ref) return { ref: null, commit: null }
  return { ref, commit: String(git(['rev-parse', ref + '^{commit}']) || '').trim() || null }
}

function arquivosDoRun() {
  const medida = baseDoRun()
  const { ramo, peca, manifesto, base } = medida
  if (medida.erro) return { ramo, peca, manifesto, erro: medida.erro }
  const ref = medida.ref

  const sujos = git(['status', '--porcelain'])
  if (sujos === null) return { ramo, peca, manifesto, erro: 'git status falhou: sem repositório?' }
  const commitados = git(['diff', '--name-only', base, 'HEAD'])
  if (commitados === null) return { ramo, peca, manifesto, erro: 'git diff ' + String(base).slice(0, 8) + '..HEAD falhou' }

  const arquivos = arquivosMudados(sujos, commitados)
  const nSujos = arquivosMudados(sujos, '').length
  const nCommitados = arquivosMudados('', commitados).length
  return {
    ramo,
    peca,
    manifesto,
    arquivos,
    erro: null,
    origem:
      'medido contra a base do run (' + ref + ' = ' + String(base).slice(0, 8) + '): ' +
      nCommitados + ' commitado(s) + ' + nSujos + ' na árvore suja = ' + arquivos.length + ' arquivo(s)' +
      (medida.papel ? '\njuiz desta peça: ' + medida.papel : '') +
      // O veredito do g20 vinha sendo montado e JOGADO FORA aqui: `baseDoRun`
      // devolve `nota` com o estado das âncoras e este retorno não a copiava,
      // então o relatório nunca dizia se a âncora que impede o réu de escolher
      // o próprio juiz estava ativa ou não. Guarda que ninguém lê é guarda que
      // ninguém sabe que apagou.
      (medida.nota ? '\n' + medida.nota : ''),
  }
}

function sondarRustIntocado() {
  return Promise.resolve().then(() => {
    const medida = arquivosDoRun()
    if (medida.erro) return { codigo: 1, saida: 'Invariante 9 SEM JUIZ: ' + medida.erro }
    const arquivos = medida.arquivos
    const rust = arquivos.filter(
      (a) => a.startsWith('desktop/') || a.endsWith('.rs') || a.endsWith('Cargo.toml') || a.endsWith('Cargo.lock'),
    )
    return {
      codigo: rust.length === 0 ? 0 : 1,
      saida:
        medida.origem + '\n' +
        (rust.length === 0
          ? arquivos.length + ' arquivo(s) mudado(s), nenhum do lado Rust'
          : 'Invariante 9 violada — lado Rust tocado: ' + rust.join(', ')),
    }
  })
}

function sondarParticao() {
  return Promise.resolve().then(() => {
    const medida = arquivosDoRun()
    if (medida.erro) {
      return {
        codigo: 1,
        saida:
          'Invariantes 5 e 9 SEM JUIZ: ' + medida.erro + '\n' +
          'Enquanto ninguém declarar a base do run e quem escreve onde, nenhuma das duas é verificável.',
      }
    }
    const arquivos = medida.arquivos
    const manifesto = medida.manifesto

    const problemas = []
    const rust = arquivos.filter((a) => a.startsWith('desktop/') || a.endsWith('.rs') || a.endsWith('Cargo.toml') || a.endsWith('Cargo.lock'))
    if (rust.length > 0) problemas.push('Invariante 9 violada — lado Rust tocado: ' + rust.join(', '))

    const peca = medida.peca
    const ramo = medida.ramo
    const r = guardaParticao({ arquivos, manifesto, peca })
    if (!r.ok) problemas.push(r.detalhe + (r.endereco ? '  [' + r.endereco + ']' : ''))

    const modo = peca !== null ? 'peça isolada `' + peca + '` (ramo ' + ramo + ')' : 'árvore compartilhada (ramo ' + (ramo || '?') + ')'
    return {
      codigo: problemas.length === 0 ? 0 : 1,
      saida:
        'modo: ' + modo + '\n' + medida.origem + '\n' + r.detalhe + '\n' +
        (problemas.length === 0 ? 'partição respeitada e Rust intocado' : problemas.join('\n')),
    }
  })
}

/**
 * O conteúdo de cada jornada NO COMMIT BASE do run, virado hash. É o juiz das
 * jornadas que o selo desta rodada não cobriu: as 19 são rastreadas pelo git,
 * então "como estava quando as peças saíram" é um fato do repositório, não uma
 * lembrança. Devolve `{}` quando a base não resolve — e aí a guarda fica
 * vermelha por falta de juiz, que é o certo.
 */
function hashesDaBaseDasJornadas(arquivos) {
  const medida = baseDoRun()
  if (medida.erro || !medida.base) return { hashes: {}, base: null, erro: medida.erro || 'base do run não resolveu' }
  const hashes = {}
  const porNascimento = []
  for (const arquivo of arquivos) {
    const texto = git(['show', medida.base + ':client/' + arquivo])
    if (texto !== null) {
      hashes[arquivo] = sha256(texto)
      continue
    }
    // TERCEIRO JUIZ: o COMMIT EM QUE A JORNADA NASCEU.
    //
    // Jornada escrita DEPOIS da base do run não existe naquele commit, e o selo
    // desta rodada foi tirado antes de ela entrar na lista da bar: sem isto, as
    // oito jornadas desta noite caíam em "sem selo E sem base — nenhum juiz" e a
    // única saída era recarimbar o selo. Recarimbar DEPOIS dos builders é
    // exatamente o que a Invariante 6 existe para impedir: carimba a régua já
    // afrouxada.
    //
    // O conteúdo com que a jornada entrou no repositório é tão imutável quanto o
    // da base — está num commit, e commit não se reescreve sem force. Afrouxar
    // um `expect` depois do nascimento muda o hash e fica VERMELHO do mesmo
    // jeito. Quem não tem nem nascimento (arquivo nunca commitado) continua sem
    // juiz, e continua vermelho.
    const nascimento = String(git(['log', '--format=%H', '--diff-filter=A', '-1', 'HEAD', '--', 'client/' + arquivo]) || '').trim()
    if (nascimento === '') continue
    const comoNasceu = git(['show', nascimento + ':client/' + arquivo])
    if (comoNasceu === null) continue
    hashes[arquivo] = sha256(comoNasceu)
    porNascimento.push(arquivo + ' (nasceu em ' + nascimento.slice(0, 8) + ')')
  }
  return { hashes, base: medida.base, ref: medida.ref, porNascimento, erro: null }
}

/** Invariante 6 — as jornadas são fixas; o selo (ou a base do run) guarda o hash delas. */
function sondarJornadasIntactas() {
  return Promise.resolve().then(() => {
    const textos = {}
    for (const arquivo of JORNADAS_SELADAS) {
      const absoluto = path.join(CLIENTE, arquivo)
      if (fs.existsSync(absoluto)) textos[arquivo] = fs.readFileSync(absoluto, 'utf8')
    }
    let selo = null
    try {
      selo = JSON.parse(fs.readFileSync(SELO, 'utf8'))
    } catch (e) {
      return { codigo: 1, saida: 'sem selo (' + e.message + '). Rode `node scripts/portao.cjs --selar` ANTES dos builders.' }
    }
    const daBase = hashesDaBaseDasJornadas(JORNADAS_SELADAS)
    const r = guardaJornadasIntactas(selo, textos, JORNADAS_SELADAS, daBase.hashes)
    // O selo é da própria árvore — e a árvore pode recarimbá-lo. O juiz que ela
    // não alcança é o merge-base com o acervo (ver `guardaReguasDesdeOAcervo`).
    const juiz = juizDoAcervo()
    const doAcervo = guardaReguasDesdeOAcervo(reguasMudadasDesde(juiz.base), juiz)
    return {
      codigo: r.ok && doAcervo.ok ? 0 : 1,
      saida:
        (doAcervo.ok ? '' : 'VERMELHO ') + doAcervo.id + ': ' + doAcervo.detalhe + '\n' +
        r.detalhe + '\nselo de ' + (selo.selado_em || '?') +
        '\nbase do run para as jornadas fora do selo: ' + (daBase.base ? daBase.ref + ' = ' + daBase.base.slice(0, 8) : 'NÃO RESOLVEU (' + daBase.erro + ')') +
        // Qual jornada está sendo julgada pelo commit em que NASCEU sai
        // nomeada: juiz mais fraco que o selo não pode ficar implícito.
        ((daBase.porNascimento || []).length > 0
          ? '\njulgadas pelo commit de nascimento (nasceram depois da base, fora do selo): ' + daBase.porNascimento.join(', ')
          : ''),
    }
  })
}

/**
 * Invariante 8 — a bar declarou "cerca de 5,9 GB livres em C: de 476 GB". A
 * máquina tinha 33,9 GB de 511 em 17/09/2026: a premissa estava velha. Premissa
 * velha não se copia para o relatório, se mede.
 */
/** Bytes de uma pasta inteira, sem seguir link. Só para relatar tamanho de trace. */
function tamanhoDaPasta(dir) {
  let total = 0
  let entradas = []
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return 0
  }
  for (const entrada of entradas) {
    const alvo = path.join(dir, entrada.name)
    try {
      if (entrada.isDirectory()) total += tamanhoDaPasta(alvo)
      else total += fs.statSync(alvo).size
    } catch (e) {
      // Arquivo que sumiu no meio da varredura não é erro de medida de disco.
    }
  }
  return total
}

/**
 * Cada passo de jornada grava trace.zip e screenshot na pasta DELE
 * (`%TEMP%/portao-labirinto/artefatos/<passo>-<ms>`, ver ARTEFATOS) e nada
 * apagava as antigas: três peças vezes várias rodadas de gauntlet comem sozinhas
 * a folga que o passo `disco` cobra, e o passo só reprovava DEPOIS do disco já
 * estar no fim. Medido em 18/09/2026: 6,08 GB livres contra um piso de 3 GB.
 *
 * Aqui o próprio passo devolve o espaço antes de medir, com três freios:
 *  - só mexe DENTRO de `%TEMP%/portao-labirinto/artefatos` (Invariante 9: nada
 *    apagado fora de pasta temporária), conferido contra `os.tmpdir()`;
 *  - só apaga pasta com nome de artefato de passo (`<id>-<ms>`);
 *  - guarda as `ARTEFATOS_MANTIDOS` mais novas E tudo o que tem menos de duas
 *    horas — outra rodada em paralelo ainda pode estar escrevendo na dela, e a
 *    prova de um vermelho recente vale mais que o espaço.
 */
const ARTEFATOS_MANTIDOS = 12
const ARTEFATO_IDADE_MINIMA_MS = 2 * 60 * 60 * 1000

function limparArtefatosAntigos(agora) {
  const dentroDoTemp = path.resolve(ARTEFATOS).toLowerCase().startsWith(path.resolve(os.tmpdir()).toLowerCase() + path.sep)
  if (!dentroDoTemp || !fs.existsSync(ARTEFATOS)) {
    return { apagadas: 0, bytes: 0, mantidas: 0, motivo: dentroDoTemp ? 'nenhuma pasta de artefato ainda' : 'pasta de artefatos fora de %TEMP%: nada apagado' }
  }
  const agoraMs = agora || Date.now()
  const pastas = fs
    .readdirSync(ARTEFATOS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[A-Za-z0-9._-]+-(\d{10,})$/.test(e.name))
    .map((e) => ({ nome: e.name, em: Number(/-(\d{10,})$/.exec(e.name)[1]) }))
    .sort((a, b) => b.em - a.em)
  const candidatas = pastas.slice(ARTEFATOS_MANTIDOS).filter((p) => agoraMs - p.em > ARTEFATO_IDADE_MINIMA_MS)
  let bytes = 0
  let apagadas = 0
  for (const pasta of candidatas) {
    const alvo = path.join(ARTEFATOS, pasta.nome)
    const tamanho = tamanhoDaPasta(alvo)
    try {
      fs.rmSync(alvo, { recursive: true, force: true })
      apagadas += 1
      bytes += tamanho
    } catch (e) {
      // Pasta em uso por outra rodada: fica onde está, e o relatório conta o resto.
    }
  }
  return { apagadas, bytes, mantidas: pastas.length - apagadas, motivo: null }
}

function sondarDisco() {
  return Promise.resolve().then(() => {
    const faxina = limparArtefatosAntigos(Date.now())
    const estado = fs.statfsSync(RAIZ)
    const livreGb = (estado.bfree * estado.bsize) / 1e9
    const totalGb = (estado.blocks * estado.bsize) / 1e9
    const ocupadoGb = tamanhoDaPasta(ARTEFATOS) / 1e9
    const quente = cargoQuente(ALVO_DO_CARGO)
    const conta = contaDeDisco(livreGb, custoDaVolta(quente))
    return {
      codigo: conta.cabe ? 0 : 1,
      saida:
        'AMBIENTE DA MÁQUINA — este passo não mede trabalho de peça nenhuma; vermelho aqui é disco, não builder.' +
        '\nlivre ' + livreGb.toFixed(2) + ' GB de ' + totalGb.toFixed(2) + ' GB' +
        '\nalvo do cargo: ' + ALVO_DO_CARGO + ' — ' + (quente ? 'QUENTE (build incremental)' : 'FRIO (build do zero)') +
        '\nnecessidade desta rodada: ' + conta.necessidadeGb.toFixed(2) + ' GB = piso ' + PISO_DE_DISCO_GB + ' GB + ' +
        conta.aEscreverGb.toFixed(2) + ' GB ainda por escrever; folga sobre a necessidade: ' + conta.folgaGb.toFixed(2) + ' GB' +
        '\ntrace e screenshot de jornada: ' + faxina.apagadas + ' pasta(s) antiga(s) apagada(s) (' + (faxina.bytes / 1e9).toFixed(2) +
        ' GB devolvidos), ' + faxina.mantidas + ' mantida(s) ocupando ' + ocupadoGb.toFixed(2) + ' GB em ' + ARTEFATOS +
        (faxina.motivo ? ' — ' + faxina.motivo : '') +
        (conta.cabe
          ? ''
          : '\nNÃO CABE: faltam ' + (-conta.folgaGb).toFixed(2) + ' GB. ' +
            (quente
              ? 'Libere disco antes de julgar qualquer peça — é pendência de ambiente, não de peça.'
              : 'O alvo do cargo está FRIO: o próximo `cargo` escreveria ' + CUSTO_DE_BUILD_FRIO_GB.toFixed(2) +
                ' GB do zero. Aponte `PORTAO_ALVO_DO_CARGO` para um target já quente, ou libere disco.')),
    }
  })
}

/**
 * A conta de disco, separada de quem a imprime para poder ser testada com
 * números de entrada (`--autoteste`) em vez de com o disco da máquina — que
 * muda sozinho entre duas chamadas e nunca reprova nada em teste.
 */
function contaDeDisco(livreGb, aEscreverGb) {
  const necessidadeGb = PISO_DE_DISCO_GB + aEscreverGb
  return { aEscreverGb, necessidadeGb, folgaGb: livreGb - necessidadeGb, cabe: livreGb >= necessidadeGb }
}

/** O que a VOLTA inteira ainda escreve: jornadas sempre, mais o build se o alvo estiver frio. */
function custoDaVolta(quente) {
  return quente ? CUSTO_DE_VOLTA_GB : CUSTO_DE_BUILD_FRIO_GB + CUSTO_DE_VOLTA_GB
}

/** O que UM passo de cargo escreve — sem o disco das jornadas, que não são dele. */
function custoDoCargo(quente) {
  return quente ? CUSTO_DE_BUILD_INCREMENTAL_GB : CUSTO_DE_BUILD_FRIO_GB
}

/**
 * O estado exato desta árvore: o commit MAIS o que está por commitar. Um
 * recibo de regressão só vale para a árvore em que foi tirado e para o texto
 * que estava lá na hora — mudou uma linha de cliente, a regressão voltou a ser
 * promessa e tem de rodar de novo.
 */
function identidadeDaArvore() {
  const sha = String(git(['rev-parse', 'HEAD']) || '').trim() || 'sem-HEAD'
  const sujo = String(git(['status', '--porcelain']) || '')
  return sujo.trim() === '' ? sha : sha + '+' + sha256(sujo).slice(0, 12)
}

/** Grava o recibo de um passo de regressão que saiu VERDE. Só verde deixa recibo. */
function escreverRecibo(passo, resultado) {
  if (PASSOS_DE_REGRESSAO.indexOf(passo.id) === -1 || !resultado.ok) return
  try {
    fs.mkdirSync(RECIBOS, { recursive: true })
    fs.writeFileSync(
      path.join(RECIBOS, passo.id + '.json'),
      JSON.stringify(
        {
          id: passo.id,
          raiz: RAIZ,
          identidade: identidadeDaArvore(),
          specs: (passo.specs || []).slice().sort(),
          repeticoes: Number(REPETICOES),
          quando: new Date().toISOString(),
          ms: resultado.ms,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )
  } catch (e) {
    // Recibo é prova, não é o trabalho: se %TEMP% recusar a escrita, o passo
    // `regressao-em-dia` continua vermelho e diz o que falta rodar.
  }
}

function lerRecibo(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(RECIBOS, id + '.json'), 'utf8'))
  } catch (e) {
    return null
  }
}

/**
 * O juízo dos recibos, separado do disco para ter autoteste com entrada
 * sintética: recibo ausente, recibo de OUTRA árvore, recibo de um estado
 * anterior e recibo com lista de specs ENCOLHIDA têm de reprovar os quatro.
 */
function julgarRecibosDeRegressao(esperados, recibos, identidade, raiz) {
  const faltas = []
  const emDia = []
  for (const esperado of esperados) {
    const recibo = recibos[esperado.id]
    const specsEsperados = (esperado.specs || []).slice().sort().join(',')
    if (!recibo) {
      faltas.push(esperado.id + ': sem recibo — este comando não rodou nesta máquina')
    } else if (recibo.raiz !== raiz) {
      faltas.push(esperado.id + ': o recibo é de outra árvore (' + recibo.raiz + ')')
    } else if (recibo.identidade !== identidade) {
      faltas.push(esperado.id + ': o recibo é de outro estado da árvore (' + recibo.identidade + ', agora ' + identidade + ')')
    } else if ((recibo.specs || []).slice().sort().join(',') !== specsEsperados) {
      faltas.push(
        esperado.id + ': o recibo cobre ' + (recibo.specs || []).length + ' spec(s) e o passo pede ' +
          (esperado.specs || []).length + ' — lista encolhida entre uma coisa e outra',
      )
    } else {
      emDia.push(esperado.id + ' (' + (recibo.specs || []).length + ' spec(s), ' + recibo.quando + ')')
    }
  }
  return { ok: faltas.length === 0, faltas, emDia }
}

/**
 * REGRESSÃO MEDIDA, não prometida.
 *
 * A promessa desta bar é "nenhuma jornada já existente pode ficar vermelha", e
 * quem a mede são `jornadas-e2e` e `jornadas-da-bar`. Enquanto isso era só um
 * aviso no relatório, uma rodada inteira saiu verde sem que nenhum dos dois
 * tivesse rodado. Agora a volta comum carrega este passo, e ele fica VERMELHO
 * até existir recibo verde dos dois para esta árvore neste estado.
 */
function sondarRegressaoEmDia() {
  return Promise.resolve().then(() => {
    const esperados = PLANO.filter((p) => PASSOS_DE_REGRESSAO.indexOf(p.id) !== -1).map((p) => ({ id: p.id, specs: p.specs || [] }))
    const recibos = {}
    for (const e of esperados) recibos[e.id] = lerRecibo(e.id)
    const identidade = identidadeDaArvore()
    const veredito = julgarRecibosDeRegressao(esperados, recibos, identidade, RAIZ)
    return {
      codigo: veredito.ok ? 0 : 1,
      saida:
        'REGRESSÃO — "nenhuma jornada já existente pode ficar vermelha" medida, não prometida.\n' +
        'árvore ' + RAIZ + ' no estado ' + identidade + '\n' +
        (veredito.emDia.length > 0 ? 'em dia: ' + veredito.emDia.join('; ') + '\n' : '') +
        (veredito.ok
          ? 'os ' + esperados.length + ' passos de regressão rodaram verdes neste estado da árvore.'
          : 'SEM MEDIDA:\n  ' + veredito.faltas.join('\n  ') + '\n' +
            'rode, desta árvore:\n' +
            esperados.map((e) => '  node scripts/portao.cjs --so=' + e.id).join('\n') + '\n' +
            'recibo só nasce de passo VERDE, e morre a cada mudança na árvore (recibos em ' + RECIBOS + ').'),
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
    // Antes de qualquer medida: de QUAL servidor ela vai falar? Medido em
    // 18/09/2026 com `LAB_PORTA=1466` e `PORTAO_URL_EDITOR=http://localhost:1420/`
    // — a sonda achou o vite órfão da 1420, inspecionou os módulos DELE e saiu
    // verde, enquanto as jornadas iam abrir a 1466. Verde verdadeiro sobre o
    // servidor errado. Esta guarda vale para os dois casos (servidor no ar e
    // servidor ausente), por isso vem antes de subir o navegador.
    const endereco = guardaPortaDaSonda(URL_EDITOR, PORTA_DAS_JORNADAS)
    if (!endereco.ok) {
      resolve({
        codigo: 1,
        saida:
          'a sonda não fala do servidor das jornadas: ' + endereco.detalhe + (endereco.endereco ? '  [' + endereco.endereco + ']' : '') +
          '\nQualquer coisa medida aqui seria sobre outro servidor — verde assim é verdadeiro e irrelevante.',
      })
      return
    }
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
        // ANTES de medir qualquer módulo: este servidor é o DESTA árvore?
        // (ver `guardaArvoreDoServidor`). Medir módulo duplicado no vite da
        // peça vizinha é verde verdadeiro sobre o código errado.
        const alvoDaArvore = String(URL_EDITOR).replace(/\/$/, '') + '/@fs/' + CLIENTE.split(path.sep).join('/') + '/porta.js'
        const respostaDaArvore = await pagina.evaluate(async (u) => {
          try {
            const r = await fetch(u, { cache: 'no-store' })
            return { status: r.status, corpo: (await r.text()).slice(0, 4000) }
          } catch (e) {
            return { status: -1, corpo: '' }
          }
        }, alvoDaArvore)
        const arvore = guardaArvoreDoServidor(respostaDaArvore, alvoDaArvore, MARCA_DA_ARVORE)
        if (!arvore.ok) {
          resolve({
            codigo: 1,
            saida: arvore.detalhe + (arvore.endereco ? '  [' + arvore.endereco + ']' : ''),
          })
          return
        }
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
        const resumo = arvore.detalhe + '\n' + modulos.length + ' módulos de /src/, ' + carimbados.length + ' carimbados por HMR'
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
      //
      // 18/09/2026: ausência deixou de sair verde SOZINHA. Rodando com
      // `LAB_PORTA=1466` — porta onde nunca houve servidor — este passo era
      // verde permanente sem medir nada, que é falso-verde do mesmo tipo que o
      // portão existe para pegar. Agora o verde por ausência carrega a prova
      // que o justifica, lida do `playwright.config.ts`: servidor novo por
      // invocação. Se essa cláusula cair, o passo fica vermelho em vez de mudo.
      if (/ERR_CONNECTION_REFUSED|ECONNREFUSED|net::ERR_CONNECTION_RESET/.test(msg)) {
        let config = null
        try {
          config = fs.readFileSync(path.join(CLIENTE, 'playwright.config.ts'), 'utf8')
        } catch (erro) {
          resolve({ codigo: 1, saida: 'nenhum servidor em ' + URL_EDITOR + ' e o playwright.config.ts não abriu (' + erro.message + '): nada foi medido' })
          return
        }
        // `guardaPortaDaSonda` já rodou lá em cima, antes do navegador: aqui ela
        // entra de novo só para o relatório dizer as DUAS coisas que sustentam
        // este verde, em vez de deixar uma delas implícita.
        const provas = [guardaPortaDaSonda(URL_EDITOR, PORTA_DAS_JORNADAS), guardaConfigDeServidorNovo(config, process.env)]
        const ruins = provas.filter((p) => !p.ok)
        resolve({
          codigo: ruins.length === 0 ? 0 : 1,
          saida:
            'MEDIDO: a porta ' + PORTA_DAS_JORNADAS + ' de ' + URL_EDITOR + ' recusou conexão (' + msg.split('\n')[0] + ') — ' +
            'não há servidor algum para carregar módulo duas vezes.\n' +
            'A pergunta que sobra é se esse fato vale para o servidor das JORNADAS. Duas provas:\n' +
            provas.map((p) => (p.ok ? '  VERDE  ' : '  VERMELHO ') + p.id + ': ' + p.detalhe + (p.endereco ? '  [' + p.endereco + ']' : '')).join('\n') +
            (ruins.length === 0 ? '' : '\nCom uma delas vermelha, "nenhum servidor no ar" não prova nada sobre o que as jornadas vão abrir.'),
        })
        return
      }
      resolve({ codigo: 1, saida: 'sonda do servidor falhou: ' + msg })
    })
  })
}

/** Alguém está escutando nesta porta, em qualquer das duas pilhas? */
function portaOcupada(porta) {
  const sonda = (host) =>
    new Promise((resolve) => {
      const tomada = net.connect({ host, port: porta })
      let respondido = false
      const fim = (ocupada) => {
        if (respondido) return
        respondido = true
        tomada.destroy()
        resolve(ocupada)
      }
      tomada.setTimeout(1000)
      tomada.on('connect', () => fim(true))
      tomada.on('error', () => fim(false))
      tomada.on('timeout', () => fim(false))
    })
  // IPv4 E IPv6: um vite órfão preso só em `::1` não aparece em 127.0.0.1, e foi
  // exatamente esse que fez o Playwright abortar com "Port 1420 is already in
  // use" e ZERO teste em 17/09/2026.
  return Promise.all([sonda('127.0.0.1'), sonda('::1')]).then((r) => r[0] || r[1])
}

/**
 * Espera a porta das jornadas ser LIBERADA antes do próximo passo de jornada.
 *
 * POR QUE EXISTE (20/09/2026). Cada passo de jornada é uma invocação própria do
 * Playwright, e com `reuseExistingServer` desligado cada uma sobe o seu vite.
 * O servidor do passo anterior não solta a porta no mesmo instante em que o
 * processo morre: o seguinte chega, encontra alguém atendendo, e o Playwright
 * ABORTA — sem rodar um teste sequer. O portão pegava isso pelo `exige` (é
 * vermelho, nunca foi verde), mas era vermelho de RELÓGIO, não do app: a peça
 * que estivesse na vez levava a culpa de uma corrida entre dois passos.
 *
 * Esperar alguns segundos é mais barato que uma rodada inteira perdida. O que
 * NÃO se faz aqui é matar processo: se o servidor for de outra pessoa (um
 * `npm run dev` aberto, ou a árvore vizinha disputando `LAB_PORTA`), o portão
 * diz o que viu e deixa o Playwright falhar com a mensagem dele. Com
 * `LAB_REUSA_SERVIDOR=1` a espera não faz sentido — ali o servidor no ar é o
 * que se QUER reaproveitar — e por isso ela nem começa.
 */
const ESPERA_DE_PORTA_MS = 20000
async function esperarPortaLivre(porta, limiteMs) {
  if (process.env.LAB_REUSA_SERVIDOR === '1') return { esperou: 0, ocupada: false, dispensada: true }
  const t0 = Date.now()
  let ocupada = await portaOcupada(porta)
  while (ocupada && Date.now() - t0 < limiteMs) {
    await new Promise((r) => setTimeout(r, 500))
    ocupada = await portaOcupada(porta)
  }
  return { esperou: Date.now() - t0, ocupada, dispensada: false }
}

/**
 * QUEM está segurando a porta — o PID, e o nome do processo quando dá.
 *
 * Sem isto a mensagem de porta ocupada mandava "feche o `npm run dev` aberto"
 * sem dizer QUAL: em 21/09/2026 o que segurava a 1420 era um vite órfão preso
 * em `[::1]`, de nenhuma janela visível, e achá-lo custou mais que o conserto.
 * Só leitura: o portão NUNCA mata processo (pode ser o `npm run dev` do
 * usuário), ele nomeia e deixa a decisão com quem está olhando.
 */
function quemOcupaAPorta(porta) {
  if (process.platform !== 'win32') return []
  // `netstat` e não o módulo `net` deste arquivo: aqui a pergunta não é "alguém
  // atende?" (isso é `portaOcupada`) e sim "QUEM atende?".
  // 60 s e não 15: MEDIDO em 23/09/2026 com a máquina a 100%, `netstat -ano`
  // levou 7-15 s, estourava os 15 s e a resposta vinha vazia — "ninguém ocupa a
  // porta" dito por quem nem chegou a olhar.
  const netstat = spawnSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 60000, windowsHide: true })
  if (netstat.status !== 0) return []
  const pids = new Set()
  for (const linha of String(netstat.stdout || '').split('\n')) {
    if (!/\bLISTENING\b/i.test(linha)) continue
    if (!new RegExp(':' + porta + '\\s').test(linha)) continue
    const campos = linha.trim().split(/\s+/)
    const pid = campos[campos.length - 1]
    if (/^\d+$/.test(pid)) pids.add(pid)
  }
  return Array.from(pids).map((pid) => {
    const t = spawnSync('tasklist', ['/FI', 'PID eq ' + pid, '/NH', '/FO', 'CSV'], {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    })
    const nome = (/^"([^"]+)"/.exec(String(t.stdout || '').trim()) || [])[1] || 'processo desconhecido'
    return 'PID ' + pid + ' (' + nome + ')'
  })
}

/**
 * O passo VERMELHO DE AMBIENTE de porta ocupada, montado à parte de quem o
 * dispara.
 *
 * Estava embutido dentro de `rodarPasso`, e por isso era código que só rodava
 * quando a máquina tivesse, naquele instante, a porta desta árvore tomada por
 * outro processo — condição que nenhum autoteste alcançava. O juiz de
 * 21/09/2026 anotou exatamente isso: "o ramo só foi LIDO, nunca executado".
 * Separado assim, `--autoteste` ABRE uma porta de verdade, deixa o portão
 * descobri-la e compara o veredito (ver `casosDePortaOcupada`).
 */
function vereditoDePortaOcupada(passo, porta, esperouMs, donos, ms) {
  return {
    id: passo.id,
    titulo: passo.titulo,
    codigo: 1,
    ms,
    ok: false,
    falsoVerde: false,
    ruina: [],
    ambiente: true,
    saida:
      'VERMELHO DE AMBIENTE — nenhuma jornada rodou, e a causa NÃO é a peça.\n' +
      'a porta ' + porta + ' desta árvore (' + RAIZ + ') continuou ocupada depois de ' + esperouMs + ' ms de espera.\n' +
      (donos.length > 0 ? 'quem a segura agora: ' + donos.join(', ') + '\n' : 'não consegui identificar o processo que a segura.\n') +
      'com `reuseExistingServer` desligado (client/playwright.config.ts), o Playwright recusa a subir o servidor e sai sem ' +
      'rodar um teste sequer — e o filtro do rtk resume esse aborto como "PASS (0) FAIL (0)", que passa por verde para quem ' +
      'lê rápido. Por isso o portão nem chamou o Playwright.\n' +
      'o que fazer: feche o servidor acima, ou rode este comando de dentro do worktree da peça, que tem porta própria ' +
      '(client/porta.js dá 1420 na árvore principal e uma porta por worktree). Nenhum processo foi morto por este portão.\n',
  }
}

/**
 * A barreira que roda ANTES do cargo: devolve o passo vermelho quando o build
 * não cabe no disco, ou `null` quando cabe.
 *
 * MEDIDO em 21/09/2026: `rust-test` saiu verde e, cinco minutos depois,
 * vermelho com `os error 112` — mesmo commit, zero linhas mudadas. O portão já
 * sabia traduzir esse vermelho depois do estrago (ver `rodarPasso`); o que
 * faltava era não causá-lo. Com o alvo FRIO e 5,76 GB livres, a conta é
 * conhecida antes de começar: 5,50 GB de build contra 2,76 GB utilizáveis
 * acima do piso. Este é o passo que se recusa a tentar.
 */
function vereditoDeDiscoParaCargo(passo, livreGb, quente, ms) {
  const conta = contaDeDisco(livreGb, custoDoCargo(quente))
  if (conta.cabe) return null
  return {
    id: passo.id,
    titulo: passo.titulo,
    codigo: 1,
    ms,
    ok: false,
    falsoVerde: false,
    ruina: [],
    ambiente: true,
    saida:
      'VERMELHO DE AMBIENTE — o cargo NÃO foi chamado, e a causa NÃO é a peça.\n' +
      'livre ' + livreGb.toFixed(2) + ' GB; esta rodada precisa de ' + conta.necessidadeGb.toFixed(2) + ' GB (piso ' +
      PISO_DE_DISCO_GB + ' GB + ' + conta.aEscreverGb.toFixed(2) + ' GB de build) — faltam ' + (-conta.folgaGb).toFixed(2) + ' GB.\n' +
      'alvo do cargo: ' + ALVO_DO_CARGO + ' — ' + (quente ? 'QUENTE (build incremental)' : 'FRIO (build do zero)') + '\n' +
      'chamar o cargo aqui encheria o disco no meio do build (`os error 112`) e deixaria a máquina pior do que está, sem medir ' +
      'nada. Rode `node scripts/portao.cjs --so=disco` para a conta, aponte `PORTAO_ALVO_DO_CARGO` para um target já quente, ou ' +
      'libere espaço. Nenhum arquivo foi apagado por este portão.\n',
  }
}

/**
 * Todo passo passa por aqui. Passo que sobe o Playwright pega vaga ANTES (ver
 * `pegarVaga`) e a devolve no `finally`; o tempo de espera vai para
 * `esperaVagaMs`, separado de `ms`, e nunca entra na `saida` que o detector de
 * falso-verde lê.
 */
async function rodarPasso(passo) {
  if (passo.porSpec) return rodarPorSpec(passo)
  // Barreira barata antes da fila: veredito que não depende de rodar nada.
  const barreira = passo.previo ? passo.previo() : null
  if (barreira) {
    const v = julgarSaida(passo, barreira.codigo, barreira.saida)
    return { id: passo.id, titulo: passo.titulo, codigo: barreira.codigo, ms: 0, ok: v.ok, falsoVerde: v.falsoVerde, ruina: v.ruina, saida: barreira.saida }
  }
  const vaga = precisaDeVaga(passo) ? pegarVaga(passo) : null
  try {
    let r = await rodarPassoNaVaga(passo)
    if (precisaDeReprise(passo, r)) {
      // Ainda DENTRO da vaga: a reprise não volta para a fila.
      const primeira = r
      r = await rodarPassoNaVaga(passo)
      r.saida = (passo.notaDeReprise || NOTA_DE_REPRISE) + r.saida
      // O fim da primeira vai para o relatório JSON (diagnóstico), nunca para a `saida` julgada.
      r.reprise = { primeiraMs: primeira.ms, primeiraCodigo: primeira.codigo, primeiraCauda: String(primeira.saida).slice(-3000) }
      r.ms += primeira.ms
    }
    if (vaga) {
      r.esperaVagaMs = vaga.esperouMs
      r.vaga = vaga.k + '/' + vaga.n
    }
    return r
  } finally {
    devolverVaga(vaga)
  }
}

// ---------------------------------------------------------------------------
// PASSO DE JORNADAS POR SPEC — uma invocação do Playwright por arquivo.
// ---------------------------------------------------------------------------
const TETO_SPEC_PADRAO_MIN = 20

function tetoDoSpecMs(env) {
  const n = Number(env.PORTAO_TETO_SPEC_MIN)
  return (Number.isFinite(n) && n > 0 ? n : TETO_SPEC_PADRAO_MIN) * 60 * 1000
}

/**
 * Reprise de TIMEOUT de um spec: o teste inteiro estourou o tempo dele, o vite
 * não subiu a tempo, ou o spec bateu no teto (ver `repriseNoTeto`). É a forma
 * que a carga da máquina tem (medido em 22-23/09/2026: jornadas verdes
 * sozinhas estourando 30 s/90 s com 8+ lanes). Timeout de UMA asserção
 * (`expect(...).toBeVisible: Timeout 5000ms exceeded`) NÃO entra: é a cara
 * normal de uma régua vermelha de verdade, e reprisá-la seria retry disfarçado.
 */
const REPRISE_DE_TIMEOUT_DE_SPEC = [/Test timeout of \d+ms exceeded/, /Timed out waiting \d+ms from config\.webServer/]
const NOTA_DE_REPRISE_DE_SPEC =
  'reprise: a primeira execução deste spec estourou tempo (teste inteiro, subida do vite ou teto do spec); ' +
  'rodou de novo UMA vez e só vale esta segunda, julgada inteira.\n'

/** O passo de UM spec, derivado do passo de jornadas: mesmas ruínas, mesma prova positiva, vaga e teto próprios. */
function passoDoSpec(passo, spec, tetoMs) {
  const nome = path.basename(spec).replace(/\.spec\.ts$/, '')
  return Object.assign(jornada(passo.id + '--' + nome, passo.id + ': ' + spec, [spec], passo.extras), {
    spec,
    tetoMs,
    reprise: REPRISE_DE_TIMEOUT_DE_SPEC,
    repriseNoTeto: true,
    notaDeReprise: NOTA_DE_REPRISE_DE_SPEC,
  })
}

/** A causa de um spec vermelho, em palavras: teto × teste falhou × falso-verde. */
function causaDoSpec(r) {
  if (r.teto) return 'teto do spec estourado'
  if (r.falsoVerde) return 'falso-verde (' + (r.ruina || []).join(', ') + ')'
  const falhas = /\b(\d+) failed\b/.exec(String(r.saida || ''))
  return 'teste falhou' + (falhas ? ' (' + falhas[1] + ' failed)' : r.ruina && r.ruina.length ? ' (' + r.ruina.join(', ') + ')' : ' (exit ' + r.codigo + ')')
}

function linhaDoSpec(r) {
  const passou = /\b(\d+) passed\b/.exec(String(r.saida || ''))
  return (
    (r.ok ? 'VERDE   ' : 'VERMELHO') + ' ' + r.spec + ' — ' +
    (r.ok ? (passou ? passou[1] + ' passed' : 'verde') : causaDoSpec(r)) +
    ', ' + Math.round(r.ms / 1000) + ' s' +
    (typeof r.esperaVagaMs === 'number' ? ', esperou vaga ' + Math.round(r.esperaVagaMs / 1000) + ' s' : '') +
    (r.reprise ? ', REPRISADO (1ª: exit ' + r.reprise.primeiraCodigo + ')' : '')
  )
}

/**
 * O veredito do passo a partir dos vereditos por spec. Função pura, para ter
 * autoteste: todo spec declarado tem de ter resultado (spec sem resultado é
 * vermelho, nomeado), e o passo só é verde se todos forem.
 */
function agregarPorSpec(passo, porSpec) {
  const rodados = new Set(porSpec.map((r) => r.spec))
  const semResultado = (passo.specs || []).filter((s) => !rodados.has(s))
  const vermelhos = porSpec.filter((r) => !r.ok)
  const ok = porSpec.length > 0 && vermelhos.length === 0 && semResultado.length === 0
  const soma = (campo) => porSpec.reduce((t, r) => t + (Number(r[campo]) || 0), 0)
  const saida =
    'PLACAR POR SPEC — ' + (porSpec.length - vermelhos.length) + ' de ' + (passo.specs || []).length + ' verdes:\n' +
    porSpec.map(linhaDoSpec).join('\n') + '\n' +
    (semResultado.length > 0 ? 'SEM RESULTADO (não rodaram): ' + semResultado.join(', ') + '\n' : '') +
    vermelhos.map((r) => '\n--- ' + r.spec + ' — ' + causaDoSpec(r) + ' ---\n' + String(r.saida || '').slice(-3000)).join('\n')
  return {
    id: passo.id,
    titulo: passo.titulo,
    codigo: ok ? 0 : 1,
    ms: soma('ms'),
    ok,
    falsoVerde: porSpec.some((r) => r.falsoVerde),
    ruina: vermelhos.map((r) => r.spec + ': ' + causaDoSpec(r)).concat(semResultado.map((s) => s + ': sem resultado')),
    saida,
    esperaVagaMs: soma('esperaVagaMs'),
    porSpec: porSpec.map((r) => ({
      spec: r.spec,
      ok: r.ok,
      causa: r.ok ? null : causaDoSpec(r),
      ms: r.ms,
      esperaVagaMs: r.esperaVagaMs,
      teto: Boolean(r.teto),
      reprise: r.reprise || null,
    })),
  }
}

/**
 * Roda os specs do passo UM A UM, cada um pegando e devolvendo a sua vaga (em
 * série: um passo não ocupa mais de uma vaga da máquina). Cada spec que termina
 * sai impresso na hora — o passo inteiro leva dezenas de minutos.
 */
async function rodarPorSpec(passo) {
  const tetoMs = tetoDoSpecMs(process.env)
  const porSpec = []
  for (const spec of passo.specs || []) {
    const r = await rodarPasso(passoDoSpec(passo, spec, tetoMs))
    r.spec = spec
    porSpec.push(r)
    escreverNaTela('  ' + passo.id + ' ' + porSpec.length + '/' + passo.specs.length + ': ' + linhaDoSpec(r) + '\n')
  }
  return agregarPorSpec(passo, porSpec)
}

/**
 * A nota que abre a saída de um passo reprisado. Escrita para NÃO casar com
 * ruína nenhuma (nada de `FAIL`, `skipped`, `failed`): quem decide o verde é a
 * saída da SEGUNDA execução, inteira, com o `piso` de arquivos e de testes.
 */
const NOTA_DE_REPRISE =
  'reprise: a primeira execução caiu por infraestrutura do runner (worker que não subiu sob carga); ' +
  'rodou de novo UMA vez e só vale esta segunda, julgada inteira.\n'

/**
 * Reprisar só quando: o passo declara `reprise`, a primeira execução NÃO saiu
 * verde, e a saída dela tem a marca de infraestrutura do runner. Vermelho de
 * teste de verdade não ganha segunda chance. Nem passo que ESTOUROU o teto:
 * MEDIDO em 23/09/2026, o `unidade` bateu 45 min sob carga, a saída dele tinha a
 * marca de worker, e a reprise segurou a vaga por mais 45 min — carga não se
 * cura rodando de novo o mesmo tamanho de trabalho na mesma máquina.
 */
function precisaDeReprise(passo, resultado) {
  if (!passo.reprise || !resultado || resultado.ok) return false
  // Teto só reprisa onde o teto é por SPEC (`repriseNoTeto`): 20 min de um
  // arquivo travado custam uma segunda chance; 45 min de suíte inteira, não.
  if (resultado.teto) return Boolean(passo.repriseNoTeto)
  return passo.reprise.some((re) => re.test(String(resultado.saida || '')))
}

/** Sufixo das linhas VERDE/VERMELHO: a espera por vaga, fora do tempo do passo. */
function notaDeVaga(r) {
  return typeof r.esperaVagaMs === 'number' ? ' [esperou vaga ' + (r.esperaVagaMs / 1000).toFixed(1) + ' s]' : ''
}

async function rodarPassoNaVaga(passo) {
  const t0 = Date.now()
  let codigo
  let saida
  let estourouTeto = false
  if (passo.sonda) {
    const r = await passo.sonda()
    codigo = r.codigo
    saida = r.saida
  } else {
    // Pasta de artefato própria por passo: o Playwright limpa o `outputDir` ao
    // começar, então sem isto cada jornada apagaria o screenshot e o trace da
    // anterior. Sempre em %TEMP% (Invariante 7: nada fora de pasta temporária).
    const ambiente = Object.assign({}, process.env)
    // Ver `ALVO_DO_CARGO`: um diretório de build para todas as árvores, e o da
    // árvore principal, que já está quente — senão cada worktree da rodada
    // deixa 5,5 GB para trás e o passo `disco` fica vermelho para quem chegar
    // depois. E ANTES de chamar o cargo, a conta de disco: encher o disco no
    // meio de um build é o vermelho mais caro que este portão já produziu.
    if (passo.cargo) {
      ambiente.CARGO_TARGET_DIR = ALVO_DO_CARGO
      const estado = fs.statfsSync(RAIZ)
      const barreira = vereditoDeDiscoParaCargo(
        passo,
        (estado.bfree * estado.bsize) / 1e9,
        cargoQuente(ALVO_DO_CARGO),
        Date.now() - t0,
      )
      if (barreira) return barreira
    }
    let aviso = ''
    if (passo.artefatos) {
      ambiente.PORTAO_ARTEFATOS = path.join(ARTEFATOS, passo.id + '-' + t0)
      // A porta do passo ANTERIOR ainda está sendo devolvida? Ver `esperarPortaLivre`.
      const porta = await esperarPortaLivre(PORTA_DAS_JORNADAS, ESPERA_DE_PORTA_MS)
      if (porta.ocupada) {
        // PARA AQUI, e diz de quem é a culpa.
        //
        // MEDIDO em 21/09/2026: a porta 1420 estava presa por um vite órfão em
        // `[::1]` e, com `reuseExistingServer` desligado, TODA jornada da
        // rodada morreu antes de rodar um teste. O portão já avisava — mas
        // chamava o Playwright assim mesmo, e o que sobrava no relatório era o
        // vermelho do PASSO, colado na peça que estava na vez. Vermelho de
        // ambiente cobrado da peça é pior que vermelho nenhum: manda o builder
        // consertar código que não tem defeito.
        //
        // Gastar 30 s por passo para produzir uma acusação errada não compra
        // nada. Aqui o passo sai vermelho na hora, com a palavra AMBIENTE, a
        // porta, a árvore e o PID de quem a segura — e quem lê sabe que não é
        // com a peça que ele tem de falar. Continua vermelho de propósito: sem
        // jornada rodada, ninguém tem prova de nada.
        return vereditoDePortaOcupada(
          passo,
          PORTA_DAS_JORNADAS,
          porta.esperou,
          quemOcupaAPorta(PORTA_DAS_JORNADAS),
          Date.now() - t0,
        )
      } else if (porta.esperou >= 500) {
        aviso = 'nota: esperei ' + porta.esperou + ' ms a porta ' + PORTA_DAS_JORNADAS + ' ser liberada pelo passo anterior.\n'
      }
    }
    const opcoes = {
      cwd: passo.cwd,
      encoding: 'utf8',
      shell: Boolean(passo.shell),
      env: ambiente,
      maxBuffer: 64 * 1024 * 1024,
    }
    // Passo que sobe o Playwright roda com TETO (ver `rodarComTeto`); o resto
    // continua no `spawnSync` de sempre.
    const r = precisaDeVaga(passo)
      ? await rodarComTeto(
          passo.exe,
          argsComLimiteGlobal(passo, passo.tetoMs || tetoDoPlaywrightMs(process.env)),
          opcoes,
          passo.tetoMs || tetoDoPlaywrightMs(process.env),
        )
      : spawnSync(passo.exe, passo.args, opcoes)
    codigo = r.status === null ? 1 : r.status
    saida = aviso + String(r.stdout || '') + String(r.stderr || '')
    if (r.estourou) {
      codigo = 1
      estourouTeto = true
      // O vite do webServer pode ter ficado FORA da árvore (o `npm`/`cmd` pai
      // dele já morreu — medido na fumaça de 23/09/2026: vite órfão na porta,
      // pai inexistente). `taskkill /T` anda pelos pais vivos e não o alcança.
      // A porta é desta árvore, e ninguém mais a abre: quem ainda a ocupa depois
      // do teto é o órfão deste passo.
      const orfaos = passo.artefatos ? matarQuemOcupaAPorta(PORTA_DAS_JORNADAS) : []
      saida =
        linhaDeTeto(r.tetoMs, rotuloDaVaga(passo), passo.tetoMs ? 'PORTAO_TETO_SPEC_MIN' : null) + '\n' +
        (orfaos.length > 0 ? 'órfão(s) na porta ' + PORTA_DAS_JORNADAS + ' morto(s) também: PID ' + orfaos.join(', ') + '\n' : '') +
        saida
    }
    // DISCO CHEIO tem nome, e o nome não é o da peça.
    //
    // MEDIDO em 21/09/2026: `rust-test` saiu VERDE (144 s) e, cinco minutos
    // depois, VERMELHO com `failed to build archive ...: Espaço insuficiente no
    // disco. (os error 112)` — mesmo commit, mesmo código, zero linhas
    // mudadas. Sem este aviso o relatório entrega um passo de Rust vermelho e
    // quem lê manda o builder consertar Rust que está intacto. O passo continua
    // VERMELHO de propósito (não houve medida), mas com a causa na primeira
    // linha, e `--so=disco` diz quanto falta.
    if (/os error 112|insufficient space|No space left on device|Espa.o insuficiente no disco/i.test(saida)) {
      saida =
        'VERMELHO DE AMBIENTE — o disco acabou no meio deste passo, e a causa NÃO é a peça.\n' +
        'o compilador não conseguiu escrever o artefato; nenhum teste foi medido. Rode `node scripts/portao.cjs --so=disco` ' +
        'para ver quanto falta para o piso, e libere espaço antes de julgar qualquer peça por este vermelho.\n' +
        saida
    }
    if (r.error) saida += '\n' + r.error.message
  }
  const veredito = julgarSaida(passo, codigo, saida)
  return {
    id: passo.id,
    titulo: passo.titulo,
    codigo,
    ms: Date.now() - t0,
    ok: veredito.ok,
    falsoVerde: veredito.falsoVerde,
    ruina: veredito.ruina,
    saida,
    teto: estourouTeto,
  }
}

/**
 * O detector de falso-verde, separado de quem roda o comando para poder ser
 * testado com relatório sintético (`--autoteste`). Ele é a única coisa entre
 * "exit 0" e "passou": relatório com `skipped`, `flaky` ou `did not run` sai 0
 * no Playwright, e relatório sem nenhum "N passed" é suíte que não rodou.
 */
function julgarSaida(passo, codigo, saida) {
  const ruina = (passo.ruina || []).filter((re) => re.test(saida)).map(String)
  // `exige` é a prova positiva: sem ela, um comando que não rodou nada sai 0 e
  // passa por verde. Marca ausente conta como ruína, com o mesmo peso.
  const faltando = (passo.exige || []).filter((re) => !re.test(saida)).map((re) => 'faltou ' + String(re))
  // `piso` é a prova positiva de ESCALA. `exige` só pergunta "passou alguma
  // coisa?", e `1 passed` responde que sim: a suíte reduzida a um arquivo saía
  // tão verde quanto a inteira. Aqui o relatório tem de dizer um NÚMERO e esse
  // número tem de alcançar o piso. Ausente conta como ruína — relatório sem a
  // marca de escala é relatório que não dá para medir.
  const abaixoDoPiso = (passo.piso || [])
    .map((p) => {
      const minimo = typeof p.minimo === 'function' ? p.minimo() : p.minimo
      if (minimo === null || minimo === undefined || !Number.isFinite(Number(minimo))) {
        return 'piso de ' + p.rotulo + ' sem juiz (não deu para medir o mínimo)'
      }
      const achado = p.re.exec(saida)
      if (achado === null) return 'relatório sem a marca de escala de ' + p.rotulo + ' (' + String(p.re) + ')'
      const medido = Number(achado[1])
      if (!(medido >= Number(minimo))) return p.rotulo + ': ' + medido + ' abaixo do piso ' + minimo
      return null
    })
    .filter(Boolean)
  const ruinaTotal = ruina.concat(faltando).concat(abaixoDoPiso)
  const falsoVerde = codigo === 0 && ruinaTotal.length > 0
  return { ok: codigo === 0 && !falsoVerde, falsoVerde, ruina: ruinaTotal }
}

/** Forma de guarda (`ok`/`detalhe`) para o detector entrar no `--autoteste`. */
function guardaFalsoVerde(nome, passo, codigo, saida) {
  const v = julgarSaida(passo, codigo, saida)
  return v.ok ? ok(nome, 'exit ' + codigo + ' aceito') : reprova(nome, 'exit ' + codigo + ' recusado: ' + (v.ruina.join(', ') || 'exit não-zero'))
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
  const configPlaywright = fs.readFileSync(path.join(CLIENTE, 'playwright.config.ts'), 'utf8')
  resultados.push(guardaCoberturaDeTipos(projetos))
  resultados.push(guardaSemRetries(configPlaywright))
  resultados.push(guardaConfigDeServidorNovo(configPlaywright, process.env))
  resultados.push(guardaJornadasExistem(TODAS_JORNADAS_E2E.concat(JORNADAS_UNIDADE)))
  resultados.push(guardaPlanoCobreArtefato(PLANO))
  resultados.push(guardaAlvosComRegressao(PLANO, JORNADAS_REGRESSAO_DOS_ALVOS))

  const textos = {}
  for (const arquivo of TODAS_JORNADAS_E2E.concat(JORNADAS_UNIDADE)) {
    const absoluto = path.join(CLIENTE, arquivo)
    if (fs.existsSync(absoluto)) textos[arquivo] = fs.readFileSync(absoluto, 'utf8')
  }
  resultados.push(guardaInvariante6TemComando(textos))
  resultados.push(guardaInvariantes1e4TemComando(textos))
  resultados.push(guardaOrdemDoPlano(PLANO))

  // A suíte de unidade INTEIRA, descoberta no git — não os 4 nomes da lista.
  // g21/g22 leem todos os arquivos; g23 só os que mudaram desde a base do run,
  // que é o único conjunto para o qual vale (e custa) buscar a versão antiga.
  const medidaParaUnidade = baseDoRun()
  // O repositório ganhou jornada que comando nenhum alcança? A pergunta é feita
  // ao git, não às listas deste arquivo — ver `jornadasNovasDesdeABase`.
  resultados.push(
    guardaJornadaNovaSemComando(jornadasNovasDesdeABase(medidaParaUnidade.base), specsDoPlano(PLANO), medidaParaUnidade),
  )
  const listaUnidade = arquivosDeUnidade()
  if (listaUnidade === null) {
    resultados.push(
      reprova(
        'g21-unidade-sem-only-skip',
        'git ls-files não respondeu: sem lista de arquivos de unidade não há auditoria arquivo-a-arquivo',
        'scripts/portao.cjs (arquivosDeUnidade)',
      ),
    )
  } else {
    const textosUnidade = {}
    for (const arquivo of listaUnidade) {
      const absoluto = path.join(CLIENTE, arquivo)
      if (fs.existsSync(absoluto)) textosUnidade[arquivo] = fs.readFileSync(absoluto, 'utf8')
    }
    // g24 julga o DISCO contra o juiz do acervo (ver `guardaEscalaDaUnidade`).
    const juizDaUnidade = juizDoAcervo()
    resultados.push(guardaEscalaDaUnidade(arquivosDeUnidadeNoDisco(), arquivosDeUnidadeNaBase(juizDaUnidade.base), juizDaUnidade))
    resultados.push(guardaUnidadeSemOnlyNemSkip(textosUnidade))
    resultados.push(guardaUnidadeSemAssertTautologico(textosUnidade))
    const mexidos = {}
    const base = {}
    const diff = medidaParaUnidade.base ? git(['diff', '--name-only', medidaParaUnidade.base, '--', 'client/src']) : null
    const novos = medidaParaUnidade.base ? git(['ls-files', '--others', '--exclude-standard', 'client/src']) : null
    const candidatos = String((diff || '') + '\n' + (novos || ''))
      .split('\n')
      .map((s) => s.trim().replace(/^client\//, ''))
      .filter((s) => /\.test\.tsx?$/.test(s))
    for (const arquivo of candidatos) {
      if (textosUnidade[arquivo] === undefined) continue
      mexidos[arquivo] = textosUnidade[arquivo]
      const antes = git(['show', medidaParaUnidade.base + ':client/' + arquivo])
      if (antes !== null) base[arquivo] = antes
    }
    resultados.push(guardaTetoNovoNaUnidade(mexidos, base))
  }

  let selo = null
  try {
    selo = JSON.parse(fs.readFileSync(SELO, 'utf8'))
  } catch (e) {
    selo = null
  }
  // O selo cobre MAIS arquivos do que a auditoria linha a linha: os quatro
  // specs de regressão dos menus (JORNADAS_REGRESSAO_MENUS) ganham hash, mas não
  // a régua das jornadas da bar — ver o comentário da constante. Por isso a
  // leitura deles é própria: sem ela, `g12` os acusaria de "ausentes da árvore".
  const textosSelados = Object.assign({}, textos)
  for (const arquivo of JORNADAS_SELADAS) {
    if (textosSelados[arquivo] !== undefined) continue
    const absoluto = path.join(CLIENTE, arquivo)
    if (fs.existsSync(absoluto)) textosSelados[arquivo] = fs.readFileSync(absoluto, 'utf8')
  }
  const daBase = hashesDaBaseDasJornadas(JORNADAS_SELADAS)
  resultados.push(guardaJornadasIntactas(selo, textosSelados, JORNADAS_SELADAS, daBase.hashes))
  // O selo acima é da própria árvore; o juiz que a árvore não reescreve é este.
  resultados.push(guardaReguasDesdeOAcervo(reguasMudadasDesde(juizDoAcervo().base), juizDoAcervo()))

  // Base do esquema = o `types/map.ts` do COMMIT BASE DO RUN, não o de HEAD.
  //
  // Com HEAD, esta guarda se apagava sozinha: a Invariante 6 do run manda a
  // peça COMMITAR, e o primeiro commit dela vira o novo HEAD — o campo que ela
  // acabou de acrescentar passa a estar nos DOIS lados da comparação e a guarda
  // aprova o que existe para reprovar. Falso-verde dentro da própria FASE 0,
  // medido em 18/09/2026. Contra a base do run a pergunta volta a ser a certa:
  // "o que esta peça acrescentou desde que saiu?".
  const medidaDaBase = baseDoRun()
  const tiposBase = medidaDaBase.base ? git(['show', medidaDaBase.base + ':client/src/types/map.ts']) : null
  const tiposAtual = fs.readFileSync(path.join(CLIENTE, 'src', 'types', 'map.ts'), 'utf8')
  const migracao = fs.readFileSync(path.join(CLIENTE, 'src', 'lib', 'mapFile.ts'), 'utf8')
  if (tiposBase === null) {
    resultados.push(
      reprova(
        'g13-campo-novo-migrado',
        'sem base de esquema para comparar: ' + (medidaDaBase.erro || 'git show <base do run>:client/src/types/map.ts falhou'),
        'client/src/types/map.ts + scripts/portao-particao.json ("base")',
      ),
    )
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
  // Todas as 19, não só as 9 da bar: fluidez, estilo, vista-móvel e as 7 já
  // entregues são réguas tão afrouxáveis quanto as da rodada.
  for (const arquivo of JORNADAS_SELADAS) {
    const absoluto = path.join(CLIENTE, arquivo)
    if (!fs.existsSync(absoluto)) {
      faltando.push(arquivo)
      continue
    }
    jornadas[arquivo] = sha256(fs.readFileSync(absoluto, 'utf8'))
  }
  // A base do run carimbada junto com as jornadas. É o que tira `base`."origem"
  // do alcance de quem pode reescrever o manifesto: o selo é tirado pelo
  // orquestrador ANTES dos builders e nenhum builder pode editá-lo (Invariante
  // 5). Sem carimbo, `g20-base-imutavel` ainda mede o resto e diz em voz alta
  // que a âncora não existe — ver `guardaOrigemDaBase`.
  let manifesto = null
  try {
    manifesto = JSON.parse(fs.readFileSync(PARTICAO, 'utf8'))
  } catch (e) {
    manifesto = null
  }
  const refOrigem = (manifesto && manifesto.base && manifesto.base.origem) || null
  const selo = { selado_em: new Date().toISOString(), jornadas }
  if (refOrigem) {
    selo.base_do_run = { ramo: refOrigem, sha: String(git(['rev-parse', refOrigem + '^{commit}']) || '').trim() || null }
  }
  fs.writeFileSync(SELO, JSON.stringify(selo, null, 2) + '\n', 'utf8')
  return { selo, faltando }
}

/**
 * Autoteste: cada guarda tem de REPROVAR a entrada ruim conhecida e APROVAR a
 * boa. Sem isto não dá para saber se uma guarda virou decoração.
 */
async function rodarAutoteste() {
  // `arquivosMudados` devolve lista, não veredito: aqui ela vira caso de
  // autoteste comparando a lista medida com a esperada.
  const provaDeMedida = (nome, porcelain, diff, esperado) => {
    const achado = arquivosMudados(porcelain, diff).join(',')
    return [
      nome,
      achado === esperado ? ok('g17-medida', achado) : reprova('g17-medida', 'esperava `' + esperado + '`, veio `' + achado + '`'),
      true,
    ]
  }
  // `refDaBase` também devolve escolha, não veredito: aqui ela vira caso de
  // autoteste comparando QUAL base julgaria cada peça.
  const provaDeBase = (nome, manifesto, peca, esperado) => {
    const achado = refDaBase(manifesto, peca).ref
    return [
      nome,
      achado === esperado
        ? ok('g20-juiz-da-peca', String(achado))
        : reprova('g20-juiz-da-peca', 'esperava `' + String(esperado) + '`, veio `' + String(achado) + '`'),
      true,
    ]
  }
  const MANIFESTO_DE_PROVA = {
    base: { ramo: 'auto/base-pecas-r4', origem: 'auto/base-noite' },
    pecas: {
      portao: ['scripts/portao.cjs', 'scripts/portao-particao.json'],
      'camada-travada': ['client/src/**'],
    },
    apelidos: { portao: ['gate'] },
  }
  /**
   * O passo `unidade` DE VERDADE — mesmas ruínas, mesmo `exige`, mesmos padrões
   * de piso —, com um único ajuste: o piso de ARQUIVOS vira 10 em vez de ser
   * contado no git. Assim os casos abaixo julgam os padrões que rodam no run,
   * e não uma cópia que pode divergir deles, sem depender do repositório.
   */
  const passoUnidadeReal = PLANO.find((p) => p.id === 'unidade') || {}
  const PASSO_DE_UNIDADE_DE_PROVA = {
    id: 'unidade-de-prova',
    ruina: passoUnidadeReal.ruina,
    exige: passoUnidadeReal.exige,
    piso: (passoUnidadeReal.piso || []).map((p) => (typeof p.minimo === 'function' ? { rotulo: p.rotulo, re: p.re, minimo: 10 } : p)),
  }
  /** O manifesto de verdade, porque autoteste sobre manifesto de brinquedo não impede o real de sair errado. */
  const manifestoReal = () => {
    try {
      return JSON.parse(fs.readFileSync(PARTICAO, 'utf8'))
    } catch (e) {
      return {}
    }
  }
  // Fixture mínima da g5: o par socket roteado + app mestre com repasse de net:message.
  const G5_BASE =
    "await page.routeWebSocket((u) => true, (ws) => { ws.onMessage((t) => mestre.evaluate(() => w.__emitTauri('net:message', { clientId: c, msg: JSON.parse(t) }))) })\n" +
    "await mestre.exposeFunction('__labParaJogador', () => {})\nawait page.goto('/player.html')\n" +
    'alvo.__emitTauri = (event, payload) => { for (const [id, o] of ouvintes) if (o.event === event) o.handler({ event, id, payload }) }\n'
  const G5_QUEDA =
    "alvo.__labSocketCaiu = (clientId) => {\n  const payload = { clientId, event: 'disconnected' }\n" +
    "  for (const [id, o] of ouvintes) if (o.event === 'net:peer') o.handler({ event: 'net:peer', id, payload })\n}\n"
  const G5_AO_FECHAR = "page.on('close', () => {\n  fila.then(() => mestre.evaluate((c) => w.__labSocketCaiu(c), 'j1'))\n})\n"
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
    ['g5 aprova a queda real de socket repassada', guardaTransporteFalsificado('x', G5_BASE + G5_QUEDA + G5_AO_FECHAR), true],
    [
      'g5 reprova clone de __emitTauri com outro nome',
      guardaTransporteFalsificado('x', G5_BASE + "alvo.__outro = (e, p) => { for (const [id, o] of ouvintes) o.handler({ event: e, id, payload: p }) }\n__outro('net:peer', {})"),
      false,
    ],
    [
      'g5 reprova queda de socket chamada fora do close',
      guardaTransporteFalsificado('x', G5_BASE + G5_QUEDA + G5_AO_FECHAR + "await mestre.evaluate((c) => w.__labSocketCaiu(c), 'j1')\n"),
      false,
    ],
    [
      'g5 reprova net:peer connected inventado com o nome da queda',
      guardaTransporteFalsificado('x', G5_BASE + G5_QUEDA.replace("'disconnected'", "'connected'") + G5_AO_FECHAR),
      false,
    ],
    ['g5 reprova a queda sem socket roteado', guardaTransporteFalsificado('x', G5_QUEDA + G5_AO_FECHAR), false],
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
    // As 10 jornadas que o selo desta rodada não cobriu: o juiz delas é o
    // conteúdo no commit base do run. Sem selo e sem base não há juiz nenhum —
    // e isso é vermelho, não silêncio.
    [
      'g12 reprova jornada fora do selo que mudou desde a base do run',
      guardaJornadasIntactas(
        { jornadas: {} },
        { 'e2e/fluidez.spec.ts': 'afrouxada' },
        ['e2e/fluidez.spec.ts'],
        { 'e2e/fluidez.spec.ts': sha256('original') },
      ),
      false,
    ],
    [
      'g12 reprova jornada sem selo E sem base (ninguém a julga)',
      guardaJornadasIntactas({ jornadas: {} }, { 'e2e/fluidez.spec.ts': 'qualquer' }, ['e2e/fluidez.spec.ts'], {}),
      false,
    ],
    [
      'g12 aprova jornada fora do selo igual à base do run',
      guardaJornadasIntactas(
        { jornadas: {} },
        { 'e2e/fluidez.spec.ts': 'original' },
        ['e2e/fluidez.spec.ts'],
        { 'e2e/fluidez.spec.ts': sha256('original') },
      ),
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
    // 18/09/2026: os três jeitos de escrever o MESMO campo opcional que
    // escapavam do padrão anterior (`/^\s{2,}([a-zA-Z_][\w]*)\?:/`). Quem
    // declara o campo escolhe a formatação, então a guarda não pode depender
    // dela — sem estes casos, `readonly roof?: boolean` entra sem migração e o
    // mapa antigo abre diferente sem ninguém piscar.
    [
      'g13 reprova campo novo declarado com readonly',
      guardaCamposNovosMigrados('interface Wall {\n  id: string\n}', 'interface Wall {\n  id: string\n  readonly espessuraNova?: number\n}', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 reprova campo novo indentado com tab',
      guardaCamposNovosMigrados('interface Wall {\n\tid: string\n}', 'interface Wall {\n\tid: string\n\tespessuraNova?: number\n}', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 reprova campo novo com espaço antes da interrogação',
      guardaCamposNovosMigrados('interface Wall {\n  id: string\n}', 'interface Wall {\n  id: string\n  espessuraNova ?: number\n}', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 não confunde linha de comentário com campo',
      guardaCamposNovosMigrados('interface Wall {\n  id: string\n}', 'interface Wall {\n  id: string\n  /* espessuraNova?: number ficou para depois */\n}', 'return { id: parsed.id }'),
      true,
    ],
    // Segunda leva de escapes, achada pela RE-auditoria de 18/09/2026: a busca
    // ancorada no começo da linha não via campo na coluna 0, nem campo dentro de
    // um literal escrito numa linha só, nem chave entre aspas.
    [
      'g13 reprova campo novo na coluna 0',
      guardaCamposNovosMigrados('interface Wall {\n  id: string\n}', 'interface Wall {\n  id: string\nespessuraNova?: number\n}', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 reprova campo novo em literal de uma linha só',
      guardaCamposNovosMigrados('type Wall = { id: string }', 'type Wall = { id: string, espessuraNova?: number }', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 reprova campo novo com a chave entre aspas',
      guardaCamposNovosMigrados('interface Wall {\n  id: string\n}', 'interface Wall {\n  id: string\n  "espessuraNova"?: number\n}', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 reprova a combinação: tab, readonly e interrogação solta',
      guardaCamposNovosMigrados('interface Wall {\n\tid: string\n}', 'interface Wall {\n\tid: string\n\treadonly  espessuraNova  ?:  number\n}', 'return { id: parsed.id }'),
      false,
    ],
    [
      'g13 não confunde bloco de documentação de várias linhas com campo',
      guardaCamposNovosMigrados(
        'interface Wall {\n  id: string\n}',
        'interface Wall {\n  id: string\n  /**\n   * espessuraNova?: number ficou para a próxima rodada.\n   */\n}',
        'return { id: parsed.id }',
      ),
      true,
    ],
    [
      'g13 não confunde comentário de fim de linha com campo',
      guardaCamposNovosMigrados('interface Wall {\n  id: string\n}', 'interface Wall {\n  id: string // espessuraNova?: number fica para depois\n}', 'return { id: parsed.id }'),
      true,
    ],
    [
      'g14 reprova peça que escreve fora da lista dela',
      guardaParticao({ arquivos: ['client/src/App.tsx'], manifesto: { pecas: { portao: ['scripts/portao.cjs'] } }, peca: 'portao' }),
      false,
    ],
    [
      'g14 reprova ramo auto/<id> que o manifesto não declara (manifesto de outra rodada)',
      guardaParticao({ arquivos: ['scripts/portao.cjs'], manifesto: { pecas: { luz: ['client/e2e/luz.spec.ts'] } }, peca: 'portao' }),
      false,
    ],
    [
      'g14 aprova peça isolada dentro da lista dela, com arquivo compartilhado por duas peças',
      guardaParticao({
        arquivos: ['client/src/PixiCanvas.tsx'],
        manifesto: { pecas: { a: ['client/src/PixiCanvas.tsx'], b: ['client/src/PixiCanvas.tsx'] } },
        peca: 'a',
      }),
      true,
    ],
    [
      'g14 reprova arquivo sem dono na árvore compartilhada',
      guardaParticao({ arquivos: ['client/src/App.tsx'], manifesto: { pecas: { a: ['client/src/PixiCanvas.tsx'] } }, peca: null }),
      false,
    ],
    [
      'g14 reprova arquivo mudado que duas peças declaram na árvore compartilhada',
      guardaParticao({ arquivos: ['x.ts'], manifesto: { pecas: { a: ['x.ts'], b: ['x.ts'] } }, peca: null }),
      false,
    ],
    [
      'g14 reprova peça que sai da área declarada por padrão',
      guardaParticao({ arquivos: ['scripts/portao.cjs'], manifesto: { pecas: { a: ['client/src/**'] } }, peca: 'a' }),
      false,
    ],
    [
      'g14 aprova arquivo novo dentro da área declarada por padrão',
      guardaParticao({ arquivos: ['client/src/components/Menu.tsx'], manifesto: { pecas: { a: ['client/src/**'] } }, peca: 'a' }),
      true,
    ],
    [
      'g14 aprova ramo que bate por apelido declarado',
      guardaParticao({
        arquivos: ['client/src/App.tsx'],
        manifesto: { pecas: { 'menu-cabe-na-janela': ['client/src/**'] }, apelidos: { 'menu-cabe-na-janela': ['menu'] } },
        peca: 'menu',
      }),
      true,
    ],
    [
      'g14 reprova peça que escreve no arquivo ALVO de outra, mesmo dentro da área declarada',
      guardaParticao({
        arquivos: ['client/src/lib/selectionHitTest.ts'],
        manifesto: {
          pecas: { 'menu-cabe-na-janela': ['client/src/**'], 'camada-travada': ['client/src/**'] },
          alvos: { 'camada-travada': ['client/src/lib/selectionHitTest.ts'] },
        },
        peca: 'menu-cabe-na-janela',
      }),
      false,
    ],
    [
      'g14 aprova peça escrevendo no alvo DELA',
      guardaParticao({
        arquivos: ['client/src/lib/selectionHitTest.ts'],
        manifesto: {
          pecas: { 'menu-cabe-na-janela': ['client/src/**'], 'camada-travada': ['client/src/**'] },
          alvos: { 'camada-travada': ['client/src/lib/selectionHitTest.ts'] },
        },
        peca: 'camada-travada',
      }),
      true,
    ],
    [
      'g14 aprova arquivo compartilhado que não é alvo de ninguém (sai nomeado no verde)',
      guardaParticao({
        arquivos: ['client/src/pixi/PixiCanvas.tsx'],
        manifesto: {
          pecas: { 'menu-cabe-na-janela': ['client/src/**'], 'camada-travada': ['client/src/**'] },
          alvos: { 'camada-travada': ['client/src/lib/selectionHitTest.ts'] },
        },
        peca: 'menu-cabe-na-janela',
      }),
      true,
    ],
    [
      'g14 aprova árvore compartilhada com dono único e arquivo livre',
      guardaParticao({ arquivos: ['x.ts', 'HANDOFF.md'], manifesto: { pecas: { a: ['x.ts'] }, livres: ['HANDOFF.md'] }, peca: null }),
      true,
    ],
    // g17 — a medida de "o que a peça escreveu". O buraco que fechou aqui era
    // VERDE MEDINDO ZERO: depois do commit a árvore fica limpa e as
    // Invariantes 5 e 9 ficavam sem entrada nenhuma.
    [
      'g17 reprova manifesto sem base declarada',
      guardaBaseDoRun({ ref: null, base: null, cabeca: 'aaaa', peca: 'portao' }),
      false,
    ],
    [
      'g17 reprova base declarada que não resolve',
      guardaBaseDoRun({ ref: 'feat/que-nao-existe', base: null, cabeca: 'aaaa', peca: 'portao' }),
      false,
    ],
    [
      'g17 reprova base que é o próprio ramo da peça (diff vazio por construção)',
      guardaBaseDoRun({ ref: 'auto/portao', base: 'aaaa', cabeca: 'aaaa', peca: 'portao', ramo: 'auto/portao' }),
      false,
    ],
    [
      'g17 reprova o ramo da peça escrito como refs/heads/, mesmo com sha diferente do HEAD',
      guardaBaseDoRun({ ref: 'refs/heads/auto/portao', base: 'bbbb', cabeca: 'aaaa', peca: 'portao', ramo: 'auto/portao' }),
      false,
    ],
    ['g17 reprova base declarada como HEAD', guardaBaseDoRun({ ref: 'HEAD', base: 'bbbb', cabeca: 'aaaa', peca: 'portao', ramo: 'auto/portao' }), false],
    [
      'g17 aprova base anterior ao HEAD da peça',
      guardaBaseDoRun({ ref: 'feat/consolidado-17set', base: 'bbbb', cabeca: 'aaaa', peca: 'portao' }),
      true,
    ],
    // O caso que deixava `particao` e `rust-intocado` sem medir nada: ponteiro
    // CONGELADO de outro nome, parado no commit em que a peça começou. Antes era
    // vermelho "SEM JUIZ"; agora é verde com a árvore suja medida.
    [
      'g17 aprova ponteiro congelado que ainda coincide com o HEAD (peça sem commit próprio)',
      guardaBaseDoRun({ ref: 'auto/base-noite', base: 'aaaa', cabeca: 'aaaa', peca: 'portao', ramo: 'auto/portao' }),
      true,
    ],
    // A base que não é ancestral da peça: `merge-base` cai para trás e a peça
    // leva a conta do que outra escreveu. Era o vermelho fantasma de 18/09.
    [
      'g17 reprova base que não é ancestral desta peça (merge-base cai para trás)',
      guardaBaseDoRun({ ref: 'auto/base-noite', base: 'bbbb', cabeca: 'aaaa', peca: 'camada-travada', ramo: 'auto/camada-travada', commitDaBase: 'cccc' }),
      false,
    ],
    [
      'g17 aprova base ancestral (ponteiro e merge-base no mesmo commit)',
      guardaBaseDoRun({ ref: 'auto/base-pecas', base: 'bbbb', cabeca: 'aaaa', peca: 'camada-travada', ramo: 'auto/camada-travada', commitDaBase: 'bbbb' }),
      true,
    ],
    // g20 — a base que o réu não pode mover. O buraco que fechou aqui era a
    // peça do portão apontando `base`."ramo" para o pai do próprio topo: o
    // primeiro commit dela saía da medida de `particao` dela mesma.
    [
      'g20 reprova manifesto sem a base imutável do run',
      guardaOrigemDaBase({ refOrigem: null, refPecas: 'auto/base-pecas', commitPecas: 'bbbb' }),
      false,
    ],
    [
      'g20 reprova base imutável que não resolve neste repositório',
      guardaOrigemDaBase({ refOrigem: 'auto/que-nao-existe', commitOrigem: null }),
      false,
    ],
    [
      'g20 reprova base das peças que não descende da base imutável',
      guardaOrigemDaBase({
        refOrigem: 'auto/base-noite',
        commitOrigem: 'aaaa',
        refPecas: 'auto/base-pecas',
        commitPecas: 'bbbb',
        origemEhAncestral: false,
        // Com âncora: sem ela a guarda pararia antes, e este caso passaria a
        // provar a ausência de âncora em vez da cláusula de ancestralidade.
        refOrigemCommitada: 'auto/base-noite',
      }),
      false,
    ],
    [
      'g20 reprova origem trocada depois do selo (réu escolhendo o juiz)',
      guardaOrigemDaBase({ refOrigem: 'auto/base-trocada', commitOrigem: 'aaaa', refSelada: 'auto/base-noite', commitSelado: 'zzzz' }),
      false,
    ],
    [
      'g20 aprova base das peças à frente da base imutável, na mesma linha',
      guardaOrigemDaBase({
        refOrigem: 'auto/base-noite',
        commitOrigem: 'aaaa',
        refPecas: 'auto/base-pecas',
        commitPecas: 'bbbb',
        origemEhAncestral: true,
        refOrigemCommitada: 'auto/base-noite',
      }),
      true,
    ],
    [
      'g20 aprova origem que confere com o carimbo do selo',
      guardaOrigemDaBase({ refOrigem: 'auto/base-noite', commitOrigem: 'aaaa', refSelada: 'auto/base-noite', commitSelado: 'aaaa' }),
      true,
    ],
    // A âncora que NÃO depende do selo. Sem ela, o selo desta rodada (tirado
    // antes da guarda existir) deixava g20 sem nada para comparar: a peça capaz
    // de reescrever o manifesto apontava `origem` para onde quisesse e o diff
    // das Invariantes 5 e 9 saía do tamanho que ela escolhesse.
    [
      'g20 reprova origem fora da linha do manifesto commitado na própria base (sem selo)',
      guardaOrigemDaBase({
        refOrigem: 'auto/base-que-eu-escolhi',
        commitOrigem: 'aaaa',
        refOrigemCommitada: 'auto/base-noite',
        commitadaEhAncestral: false,
      }),
      false,
    ],
    [
      'g20 aprova origem confirmada pelo manifesto commitado na própria base (sem selo)',
      guardaOrigemDaBase({ refOrigem: 'auto/base-noite', commitOrigem: 'aaaa', refOrigemCommitada: 'auto/base-noite' }),
      true,
    ],
    [
      'g20 aprova a base avançada de uma rodada para a outra (ponteiro novo, linha antiga)',
      guardaOrigemDaBase({
        refOrigem: 'auto/base-r6',
        commitOrigem: 'cccc',
        refOrigemCommitada: 'auto/base-noite',
        commitadaEhAncestral: true,
      }),
      true,
    ],
    [
      'g20 reprova base sem ÂNCORA nenhuma (selo sem carimbo e commit sem manifesto)',
      guardaOrigemDaBase({ refOrigem: 'auto/base-noite', commitOrigem: 'aaaa', refSelada: null, refOrigemCommitada: null }),
      false,
    ],
    provaDeBase('g20 mede a peça do portão pela base IMUTÁVEL, não pela que ela move', MANIFESTO_DE_PROVA, 'portao', 'auto/base-noite'),
    provaDeBase('g20 aceita o apelido do ramo da peça do portão', MANIFESTO_DE_PROVA, 'gate', 'auto/base-noite'),
    provaDeBase('g20 mede a peça de cliente pelo ponto de corte dela', MANIFESTO_DE_PROVA, 'camada-travada', 'auto/base-pecas-r4'),
    provaDeBase('g20 manda peça não declarada para a base mais antiga', MANIFESTO_DE_PROVA, 'peca-que-ninguem-declarou', 'auto/base-noite'),
    provaDeBase('g20 mede a árvore compartilhada pela base mais antiga', MANIFESTO_DE_PROVA, null, 'auto/base-noite'),
    // A mesma pergunta contra o manifesto REAL desta rodada: autoteste sobre
    // manifesto de brinquedo não impede o manifesto de verdade de sair errado.
    [
      'g20 o manifesto real desta rodada declara as DUAS bases',
      (manifestoReal().base || {}).origem && (manifestoReal().base || {}).ramo
        ? ok('g20-manifesto-real', 'origem `' + manifestoReal().base.origem + '` + ponto de corte das peças `' + manifestoReal().base.ramo + '`')
        : reprova(
            'g20-manifesto-real',
            'o manifesto real não declara as duas bases — sem `origem` a peça do portão é medida pela base que ela mesma move',
            'scripts/portao-particao.json ("base")',
          ),
      true,
    ],
    provaDeBase('g20 no manifesto real: a peça do portão cai na base imutável', manifestoReal(), 'portao', (manifestoReal().base || {}).origem || null),
    // O nome da peça de cliente sai do MANIFESTO REAL, nunca digitado aqui: ver
    // `pecaDeClienteDoManifesto`. Fixture com nome literal morre na rodada que
    // troca as peças, e o vermelho parece defeito de guarda quando é só idade.
    provaDeBase(
      'g20 no manifesto real: uma peça de cliente cai na base das peças',
      manifestoReal(),
      pecaDeClienteDoManifesto(manifestoReal()),
      (manifestoReal().base || {}).ramo || null,
    ),
    // g19 — a lista do comando 15. O que não entra na linha de comando não sai
    // no relatório nem como vermelho nem como skipped: sai como nada.
    // g25 — a regressão dos alvos desta rodada só protege alguma coisa se
    // algum passo da VOLTA COMUM rodar aqueles specs.
    [
      'g25 reprova spec de alvo declarado e rodado por passo nenhum',
      guardaAlvosComRegressao(
        [{ id: 'x', args: ['e2e/outro.spec.ts'] }],
        ['e2e/task-layers-visibility.spec.ts'],
      ),
      false,
    ],
    [
      'g25 reprova regressão de alvo pendurada só no passo de PROVA (que nasce vermelho e fica fora da volta comum)',
      guardaAlvosComRegressao(
        [{ id: 'criterio', prova: true, args: ['e2e/task-layers-visibility.spec.ts'] }],
        ['e2e/task-layers-visibility.spec.ts'],
      ),
      false,
    ],
    [
      'g25 reprova lista de regressão dos alvos VAZIA',
      guardaAlvosComRegressao([{ id: 'x', args: ['e2e/task-layers-visibility.spec.ts'] }], []),
      false,
    ],
    [
      'g25 aprova o PLANO real desta rodada (os seis specs dos alvos dentro da volta comum)',
      guardaAlvosComRegressao(PLANO, JORNADAS_REGRESSAO_DOS_ALVOS),
      true,
    ],
    // g26 — porta igual não é árvore igual. O primeiro caso é o que mediu nesta
    // máquina: caminho de outra árvore devolve 200 com o index.html do app.
    [
      'g26 reprova o 200 de fallback de SPA (caminho de outra árvore, corpo = index.html)',
      guardaArvoreDoServidor(
        { status: 200, corpo: '<!doctype html>\n<html lang="pt-BR"><head><script type="module">…' },
        'http://localhost:1466/@fs/C:/dev/labirinto-outro/client/porta.js',
        'portaDoProjeto',
      ),
      false,
    ],
    [
      'g26 reprova recusa do vite da árvore vizinha (403)',
      guardaArvoreDoServidor({ status: 403, corpo: 'Forbidden' }, 'http://localhost:1466/@fs/C:/dev/labirinto/client/porta.js', 'portaDoProjeto'),
      false,
    ],
    [
      'g26 reprova servidor que não respondeu',
      guardaArvoreDoServidor({ status: -1, corpo: '' }, 'http://localhost:1466/@fs/C:/dev/labirinto/client/porta.js', 'portaDoProjeto'),
      false,
    ],
    [
      'g26 reprova quando a MARCA sumiu de client/porta.js (sem marca, tudo passaria)',
      guardaArvoreDoServidor({ status: 200, corpo: 'export function portaDoProjeto() {}' }, 'http://localhost:1466/x', ''),
      false,
    ],
    [
      'g26 aprova o servidor desta árvore (200 com o arquivo pedido no corpo)',
      guardaArvoreDoServidor(
        { status: 200, corpo: 'export function portaDoProjeto() { return 1466 }' },
        'http://localhost:1466/@fs/C:/dev/labirinto/client/porta.js',
        'portaDoProjeto',
      ),
      true,
    ],
    [
      'g26 a marca real desta árvore existe em client/porta.js',
      MARCA_DA_ARVORE !== ''
        ? ok('g26-marca-real', 'marca `' + MARCA_DA_ARVORE + '` lida de client/porta.js')
        : reprova('g26-marca-real', 'client/porta.js não traz a marca que reconhece esta árvore', 'client/porta.js'),
      true,
    ],
    // g27 — jornada nascida nesta rodada que passo NENHUM roda. É a guarda que
    // teria pegado o falso-verde de 20/09/2026: oito jornadas commitadas, fora
    // de `JORNADAS_DO_CRITERIO`, e três comandos saindo verdes por cima delas.
    // O último caso é o que impede a guarda de virar decoração: ela julga as
    // LINHAS DE COMANDO do PLANO real, não uma lista digitada ao lado.
    [
      'g27 reprova jornada nova que passo nenhum do PLANO roda',
      guardaJornadaNovaSemComando(['e2e/task-jornada-nova.spec.ts'], new Set(['e2e/task-jornada-velha.spec.ts']), { ref: 'auto/base-x' }),
      false,
    ],
    [
      'g27 reprova quando a lista de jornadas novas não pôde ser descoberta (sem base, sem juiz)',
      guardaJornadaNovaSemComando(null, new Set(), { erro: 'base do run não resolveu' }),
      false,
    ],
    [
      'g27 aprova jornada nova que algum passo roda',
      guardaJornadaNovaSemComando(['e2e/task-jornada-nova.spec.ts'], new Set(['e2e/task-jornada-nova.spec.ts']), { ref: 'auto/base-x' }),
      true,
    ],
    [
      'g27 aprova a árvore de agora contra o PLANO real (as jornadas desta rodada têm comando)',
      (() => {
        const medida = baseDoRun()
        return guardaJornadaNovaSemComando(jornadasNovasDesdeABase(medida.base), specsDoPlano(PLANO), medida)
      })(),
      true,
    ],
    [
      'g19 reprova lista da bar com uma jornada omitida',
      guardaListaDeJornadas(['e2e/a.spec.ts', 'e2e/b.spec.ts'], ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/c.spec.ts'], {}),
      false,
    ],
    [
      'g19 aprova lista completa da bar',
      guardaListaDeJornadas(['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/c.spec.ts'], ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/c.spec.ts'], {}),
      true,
    ],
    [
      'g19 aprova omissão declarada com motivo',
      guardaListaDeJornadas(['e2e/a.spec.ts', 'e2e/b.spec.ts'], ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/c.spec.ts'], { 'e2e/c.spec.ts': 'motivo' }),
      true,
    ],
    [
      'g19 aprova amostra avulsa que não toca a bar',
      guardaListaDeJornadas(['e2e/outro.spec.ts'], ['e2e/a.spec.ts', 'e2e/b.spec.ts'], {}),
      true,
    ],
    [
      'g19 reprova a PROVA real com uma jornada do critério de fora',
      guardaListaDeJornadas(
        JORNADAS_DO_CRITERIO.filter((j) => j !== 'e2e/task-jornada-poligono-termina.spec.ts'),
        GRUPOS_DA_BAR,
        JORNADAS_DISPENSADAS,
      ),
      false,
    ],
    [
      'g19 reprova a REGRESSÃO real com uma jornada da regressão de fora',
      guardaListaDeJornadas(
        JORNADAS_DE_REGRESSAO_DA_BAR.filter((j) => j !== 'e2e/task-jornada-sala-livre.spec.ts' && !JORNADAS_DISPENSADAS[j]),
        GRUPOS_DA_BAR,
        JORNADAS_DISPENSADAS,
      ),
      false,
    ],
    // As duas linhas que as rodadas 3 e 4 reprovavam por deadlock de desenho.
    // São os comandos de verdade do run: se alguma delas voltar a sair vermelha,
    // o portão voltou a rodar ZERO teste.
    [
      'g19 aprova a REGRESSÃO real sozinha (grupo completo, critério fora por desenho)',
      guardaListaDeJornadas(JORNADAS_DE_REGRESSAO_DA_BAR.filter((j) => !JORNADAS_DISPENSADAS[j]), GRUPOS_DA_BAR, JORNADAS_DISPENSADAS),
      true,
    ],
    [
      'g19 aprova a PROVA real sozinha (as três do critério, regressão fora por desenho)',
      guardaListaDeJornadas(JORNADAS_DO_CRITERIO, GRUPOS_DA_BAR, JORNADAS_DISPENSADAS),
      true,
    ],
    [
      'g19 aprova a bar inteira numa linha só (os dois grupos completos)',
      guardaListaDeJornadas(JORNADAS_DA_BAR.filter((j) => !JORNADAS_DISPENSADAS[j]), GRUPOS_DA_BAR, JORNADAS_DISPENSADAS),
      true,
    ],
    // O comando REAL de cada peça de cliente desta rodada: uma jornada, a dela.
    // Saía em exit 2 antes do Playwright e deixou as cinco peças sem rodar nada.
    // Se alguma destas voltar a sair vermelha, a rodada voltou a rodar ZERO
    // jornada de peça.
    [
      'g19 aprova o comando de UMA peça (uma jornada do critério, sozinha)',
      guardaListaDeJornadas(['e2e/task-jornada-linha-pontilhada.spec.ts'], GRUPOS_DA_BAR, JORNADAS_DISPENSADAS),
      true,
    ],
    [
      'g19 aprova o comando de UMA peça também no grupo da regressão',
      guardaListaDeJornadas(['e2e/task-jornada-sala-livre.spec.ts'], GRUPOS_DA_BAR, JORNADAS_DISPENSADAS),
      true,
    ],
    // O dente que a exceção de uma jornada NÃO pode tirar: dois specs ou mais,
    // com o grupo incompleto, continuam fatais — é ali que mora a omissão por
    // digitação que a guarda nasceu para pegar.
    [
      'g19 continua reprovando DUAS do critério com o resto de fora',
      guardaListaDeJornadas(
        ['e2e/task-jornada-linha-pontilhada.spec.ts', 'e2e/task-jornada-etiqueta-pilula.spec.ts'],
        GRUPOS_DA_BAR,
        JORNADAS_DISPENSADAS,
      ),
      false,
    ],
    provaDeMedida(
      'g17 mede o que a peça COMMITOU, não só a árvore suja',
      '',
      'scripts/portao.cjs\ndesktop/src-tauri/__probe.rs\n',
      'desktop/src-tauri/__probe.rs,scripts/portao.cjs',
    ),
    provaDeMedida(
      'g17 soma árvore suja e commitado sem repetir arquivo',
      ' M scripts/portao.cjs\n?? scripts/__probe_fora.cjs\n',
      'scripts/portao.cjs\n',
      'scripts/__probe_fora.cjs,scripts/portao.cjs',
    ),
    provaDeMedida(
      'g17 conta os DOIS lados de uma renomeação',
      'R  client/src/velho.tsx -> client/src/novo.tsx\n',
      '',
      'client/src/novo.tsx,client/src/velho.tsx',
    ),
    ['g15 reprova config sem webServer', guardaConfigDeServidorNovo('export default defineConfig({ retries: 0 })', {}), false],
    ['g15 reprova webServer sem reuseExistingServer', guardaConfigDeServidorNovo('webServer: { command: "npm run dev" }', {}), false],
    ['g15 reprova reuseExistingServer: true', guardaConfigDeServidorNovo('webServer: {\n  reuseExistingServer: true,\n}', {}), false],
    [
      'g15 reprova reaproveitamento ligado pelo ambiente',
      guardaConfigDeServidorNovo("webServer: {\n  reuseExistingServer: process.env.LAB_REUSA_SERVIDOR === '1',\n}", { LAB_REUSA_SERVIDOR: '1' }),
      false,
    ],
    [
      'g15 aprova servidor novo por invocação',
      guardaConfigDeServidorNovo("webServer: {\n  reuseExistingServer: process.env.LAB_REUSA_SERVIDOR === '1',\n}", {}),
      true,
    ],
    // g18 — de qual servidor a prova de `servidor-limpo` fala. Verde verdadeiro
    // sobre a porta errada é verde irrelevante.
    ['g18 reprova sonda em porta diferente da das jornadas', guardaPortaDaSonda('http://localhost:1420/', 1466), false],
    ['g18 reprova sonda em outra máquina', guardaPortaDaSonda('http://192.168.0.8:1466/', 1466), false],
    ['g18 reprova endereço sem porta', guardaPortaDaSonda('http://localhost/', 1466), false],
    ['g18 aprova sonda na mesma porta das jornadas', guardaPortaDaSonda('http://localhost:1466/', 1466), true],
    // g16 — o detector de falso-verde do passo de jornada, com relatório
    // sintético. É o que separa "exit 0" de "passou", e era a diferença entre o
    // passo de jornada do PLANO e o comando de Playwright CRU da lista do run.
    ['g16 reprova relatório com skipped e exit 0', guardaFalsoVerde('g16', jornada('j', 't', ['a']), 0, '1 passed\n2 skipped\n'), false],
    ['g16 reprova relatório com flaky e exit 0', guardaFalsoVerde('g16', jornada('j', 't', ['a']), 0, '1 passed\n1 flaky\n'), false],
    ['g16 reprova "did not run" com exit 0', guardaFalsoVerde('g16', jornada('j', 't', ['a']), 0, '1 passed\n3 did not run\n'), false],
    ['g16 reprova suíte que não rodou nada (exit 0 sem nenhum passed)', guardaFalsoVerde('g16', jornada('j', 't', ['a']), 0, 'Running 0 tests using 0 workers\n'), false],
    ['g16 reprova "0 passed" com exit 0', guardaFalsoVerde('g16', jornada('j', 't', ['a']), 0, '0 passed (1.0s)\n'), false],
    ['g16 aprova relatório com testes passando', guardaFalsoVerde('g16', jornada('j', 't', ['a']), 0, '  2 passed (10.0s)\n'), true],
    // g28 — a prova positiva do `rust-clippy`, com saída sintética.
    //
    // O passo era só `ruina`: com o cache cheio a saída verde inteira era
    // `Finished \`dev\` profile ... in 0.34s`, UMA linha que não nomeia coisa
    // nenhuma — "lint limpo" e "não lintei nada" tinham a mesma cara e as duas
    // saíam exit 0. Estes casos são o dente do `exige` novo, e o caso da árvore
    // vizinha é o mesmo discriminador de caminho absoluto que as jornadas usam.
    ...(() => {
      const passo = PLANO.find((p) => p.id === 'rust-clippy')
      const linhaDoCrate = (raiz) => '       Fresh labirinto v0.1.0 (' + path.join(raiz, 'desktop', 'src-tauri') + ')\n'
      const finished = '    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.34s\n'
      return [
        ['g28 reprova a saída de UMA linha do cache cheio (o buraco de antes)', guardaFalsoVerde('g28', passo, 0, finished), false],
        ['g28 reprova saída vazia (nada foi lintado)', guardaFalsoVerde('g28', passo, 0, ''), false],
        [
          'g28 reprova clippy que nomeou o crate de OUTRA árvore',
          guardaFalsoVerde('g28', passo, 0, linhaDoCrate(path.join(path.dirname(RAIZ), 'labirinto-outra-arvore')) + finished),
          false,
        ],
        ['g28 aprova clippy que nomeou o crate DESTA árvore', guardaFalsoVerde('g28', passo, 0, linhaDoCrate(RAIZ) + finished), true],
      ]
    })(),
    // --- disco antes do cargo (21/09/2026) --------------------------------
    //
    // A conta entra por PARÂMETRO, e não pelo disco da máquina: teste que lê o
    // disco de verdade aprova ou reprova conforme a hora do dia e não reprova
    // nada de propósito nunca. Os números são os medidos nesta máquina na
    // madrugada de 21/09/2026 — 5,76 GB livres, build frio de 5,50 GB.
    ...(() => {
      const passo = PLANO.find((p) => p.id === 'rust-clippy')
      const barrou = (livreGb, quente) => {
        const r = vereditoDeDiscoParaCargo(passo, livreGb, quente, 1)
        return r === null ? ok('g30-disco-antes-do-cargo', 'deixou o cargo rodar') : reprova('g30-disco-antes-do-cargo', r.saida.split('\n')[1])
      }
      return [
        ['g30 barra o cargo com alvo FRIO e o disco de hoje (5,76 GB)', barrou(5.76, false), false],
        ['g30 barra o cargo com alvo quente e disco no osso (3,20 GB)', barrou(3.2, true), false],
        ['g30 deixa passar alvo QUENTE com o disco de hoje (5,76 GB)', barrou(5.76, true), true],
        // O caso que fez a conta ser separada em duas: com 3,86 GB livres a
        // barreira recusava um clippy incremental de 0,05 GB porque cobrava
        // dele o disco das jornadas. O passo `disco` continua vermelho aqui —
        // a VOLTA não cabe —, e é lá que essa conta mora.
        ['g30 deixa o cargo incremental rodar com 3,86 GB livres', barrou(3.86, true), true],
        ['g30 deixa passar alvo frio quando o disco comporta o build (20 GB)', barrou(20, false), true],
      ]
    })(),
    // --- recibo da regressão (21/09/2026) ---------------------------------
    //
    // O aviso "REGRESSÃO SEM MEDIDA" não reprovava nada: a rodada saía verde
    // com as jornadas de regressão nunca rodadas. Estes casos são o dente do
    // passo `regressao-em-dia` — os quatro jeitos de não ter medido.
    ...(() => {
      const esperados = [{ id: 'jornadas-e2e', specs: ['e2e/a.spec.ts', 'e2e/b.spec.ts'] }]
      const bom = { id: 'jornadas-e2e', raiz: '/arvore', identidade: 'sha1', specs: ['e2e/a.spec.ts', 'e2e/b.spec.ts'], quando: 'agora' }
      const julgar = (recibo) => {
        const r = julgarRecibosDeRegressao(esperados, { 'jornadas-e2e': recibo }, 'sha1', '/arvore')
        return r.ok ? ok('g31-recibo-da-regressao', r.emDia.join('; ')) : reprova('g31-recibo-da-regressao', r.faltas.join('; '))
      }
      return [
        ['g31 reprova regressão sem recibo nenhum', julgar(null), false],
        ['g31 reprova recibo tirado em OUTRA árvore', julgar(Object.assign({}, bom, { raiz: '/outra' })), false],
        ['g31 reprova recibo de um estado anterior da árvore', julgar(Object.assign({}, bom, { identidade: 'sha0' })), false],
        ['g31 reprova recibo com a lista de specs encolhida', julgar(Object.assign({}, bom, { specs: ['e2e/a.spec.ts'] })), false],
        ['g31 aprova recibo verde desta árvore neste estado', julgar(bom), true],
      ]
    })(),
    // --- escala da unidade (18/09/2026) -----------------------------------
    // O passo `unidade` com os MESMOS pisos do PLANO, contra relatórios de
    // vitest sintéticos. Sem estes casos, o piso seria texto: é exatamente o
    // que o passo era antes, quando `1 passed` saía tão verde quanto 2290.
    [
      'piso reprova suíte reduzida a um arquivo',
      guardaFalsoVerde('piso', PASSO_DE_UNIDADE_DE_PROVA, 0, ' Test Files  1 passed (1)\n      Tests  21 passed (21)\n'),
      false,
    ],
    [
      'piso reprova relatório sem a marca de escala',
      guardaFalsoVerde('piso', PASSO_DE_UNIDADE_DE_PROVA, 0, 'tudo certo por aqui\n'),
      false,
    ],
    // Os relatórios sintéticos abaixo DERIVAM do piso em vez de repetir o
    // número: quando o piso sobe (18/09/2026, de 2290 para 2299), um fixture
    // literal vira vermelho no autoteste e o conserto barato é baixar o piso de
    // volta — exatamente o dente que a guarda existe para ter.
    [
      'piso reprova arquivo a menos, mesmo com os testes no lugar',
      guardaFalsoVerde('piso', PASSO_DE_UNIDADE_DE_PROVA, 0, relatorioDeUnidade(9, PISO_DE_TESTES_DE_UNIDADE)),
      false,
    ],
    [
      'piso aprova a suíte inteira',
      guardaFalsoVerde('piso', PASSO_DE_UNIDADE_DE_PROVA, 0, relatorioDeUnidade(10, PISO_DE_TESTES_DE_UNIDADE)),
      true,
    ],
    [
      'piso reprova um teste a menos que o piso',
      guardaFalsoVerde('piso', PASSO_DE_UNIDADE_DE_PROVA, 0, relatorioDeUnidade(10, PISO_DE_TESTES_DE_UNIDADE - 1)),
      false,
    ],
    [
      'piso aprova suíte que cresceu',
      guardaFalsoVerde('piso', PASSO_DE_UNIDADE_DE_PROVA, 0, relatorioDeUnidade(11, PISO_DE_TESTES_DE_UNIDADE + 1)),
      true,
    ],
    ['g21 reprova it.skip em arquivo de unidade', guardaUnidadeSemOnlyNemSkip({ 'src/lib/a.test.ts': "it.skip('a', () => {})" }), false],
    ['g21 aprova suíte sem only/skip', guardaUnidadeSemOnlyNemSkip({ 'src/lib/a.test.ts': "it('a', () => { expect(f(1)).toBe(2) })" }), true],
    ['g22 reprova expect(true).toBe(true)', guardaAssertTautologico('x', "it('a', () => { expect(true).toBe(true) })"), false],
    ['g22 reprova a mesma expressão dos dois lados', guardaAssertTautologico('x', 'expect(mapa.grid).toBe(mapa.grid)'), false],
    ['g22 reprova expect(1).toBeTruthy()', guardaAssertTautologico('x', 'expect(1).toBeTruthy()'), false],
    ['g22 aprova asserção que pode reprovar', guardaAssertTautologico('x', 'expect(mapa.grid).toBe(64)'), true],
    [
      'g23 reprova teto nu que apareceu nesta rodada',
      guardaTetoNovoNaUnidade(
        { 'src/lib/a.test.ts': "it('mede', () => { expect(d).toBeLessThan(24) })" },
        { 'src/lib/a.test.ts': "it('mede', () => { expect(d).toBe(12) })" },
      ),
      false,
    ],
    [
      'g23 reprova teto nu em arquivo novo (sem versão na base)',
      guardaTetoNovoNaUnidade({ 'src/lib/novo.test.ts': "it('mede', () => { expect(d).toBeLessThan(24) })" }, {}),
      false,
    ],
    [
      'g23 aprova dívida velha que continua igual',
      guardaTetoNovoNaUnidade(
        { 'src/lib/a.test.ts': "it('mede', () => { expect(d).toBeLessThan(24) })" },
        { 'src/lib/a.test.ts': "it('mede', () => { expect(d).toBeLessThan(24) })" },
      ),
      true,
    ],
    [
      'g23 aprova teto que ganhou controle positivo',
      guardaTetoNovoNaUnidade(
        { 'src/lib/a.test.ts': "it('mede', () => { expect(d).toBeGreaterThan(0); expect(d).toBeLessThan(24) })" },
        { 'src/lib/a.test.ts': "it('mede', () => { expect(d).toBeLessThan(24) })" },
      ),
      true,
    ],
    ['g24 reprova sem base para contar', guardaEscalaDaUnidade(['src/a.test.ts'], null, { erro: 'base do run não resolveu' }), false],
    [
      'g24 reprova suíte que encolheu',
      guardaEscalaDaUnidade(['src/a.test.ts'], ['src/a.test.ts', 'src/b.test.ts'], { ref: 'base' }),
      false,
    ],
    ['g24 aprova suíte do mesmo tamanho', guardaEscalaDaUnidade(['src/a.test.ts'], ['src/a.test.ts'], { ref: 'base' }), true],
    ['g24 aprova suíte que cresceu', guardaEscalaDaUnidade(['src/a.test.ts', 'src/b.test.ts'], ['src/a.test.ts'], { ref: 'base' }), true],
    [
      'g33 jornada ganha --global-timeout 90 s abaixo do teto, antes dos specs',
      (() => {
        const a = argsComLimiteGlobal(jornada('x', 't', ['e2e/a.spec.ts']), 45 * 60 * 1000)
        const i = a.indexOf('--global-timeout=2610000')
        return i > a.indexOf('test') && i < a.indexOf('e2e/a.spec.ts')
          ? ok('g33-limite-global', a.slice(1, 3).join(' ') + ' ... ' + a[i])
          : reprova('g33-limite-global', 'args: ' + a.slice(1).join(' '))
      })(),
      true,
    ],
    // 23/09/2026 — o furo da auditoria: trocar um arquivo por outro não muda a contagem.
    [
      'g24 reprova arquivo da base trocado por outro (mesma contagem)',
      guardaEscalaDaUnidade(['src/a.test.ts', 'src/trivial.test.ts'], ['src/a.test.ts', 'src/mandarPara.test.ts'], { ref: 'base' }),
      false,
    ],
    ['g24 reprova sem lista do disco', guardaEscalaDaUnidade(null, ['src/a.test.ts'], { ref: 'base' }), false],
    // g35 — régua do acervo só muda em ramo de réguas; o selo local não conta.
    ['g35 reprova sem juiz do acervo', guardaReguasDesdeOAcervo([], { erro: 'sem merge-base', ramo: 'x' }), false],
    ['g35 reprova sem lista do git', guardaReguasDesdeOAcervo(null, { base: 'abcdef12', ref: 'mb', ramo: 'auto/g10' }), false],
    ['g35 aprova nada mudado', guardaReguasDesdeOAcervo([], { base: 'abcdef12', ref: 'mb', ramo: 'auto/g10' }), true],
    [
      'g35 reprova régua mudada numa lane (mesmo com selo recarimbado)',
      guardaReguasDesdeOAcervo(['e2e/task-jornada-girar-sala.spec.ts'], { base: 'abcdef12', ref: 'mb', ramo: 'auto/g10-viajar-junto' }),
      false,
    ],
    [
      'g35 reprova régua mudada em HEAD destacado (instantâneo de lane)',
      guardaReguasDesdeOAcervo(['e2e/task-jornada-girar-sala.spec.ts'], { base: 'abcdef12', ref: 'mb', ramo: 'HEAD' }),
      false,
    ],
    [
      'g35 aprova régua mudada em auto/reguas-*',
      guardaReguasDesdeOAcervo(['e2e/task-jornada-girar-sala.spec.ts'], { base: 'abcdef12', ref: 'mb', ramo: 'auto/reguas-a' }),
      true,
    ],
    [
      'g35 aprova régua mudada em auto/lane-infra',
      guardaReguasDesdeOAcervo(['e2e/task-jornada-girar-sala.spec.ts'], { base: 'abcdef12', ref: 'mb', ramo: 'auto/lane-infra' }),
      true,
    ],
    [
      'g35 reprova ramo que só PARECE de réguas',
      guardaReguasDesdeOAcervo(['e2e/task-jornada-girar-sala.spec.ts'], { base: 'abcdef12', ref: 'mb', ramo: 'auto/acervo-g10' }),
      false,
    ],
    // g34 — `unidade` sob carga: vaga, teto de workers e reprise SÓ por infraestrutura do runner.
    [
      'g34 aprova unidade na fila de máquina com teto de workers',
      passoUnidadeReal.vaga === 'vitest' && (passoUnidadeReal.args || []).some((a) => /^--maxWorkers=\d+$/.test(String(a)))
        ? ok('g34-unidade', 'vaga ' + passoUnidadeReal.vaga + ', ' + passoUnidadeReal.args.filter((a) => /maxWorkers/.test(a)).join(' '))
        : reprova('g34-unidade', 'unidade sem vaga ou sem --maxWorkers'),
      true,
    ],
    [
      'g34 aprova reprise quando o worker do vitest não subiu',
      precisaDeReprise(passoUnidadeReal, { ok: false, saida: 'Error: [vitest-pool]: Failed to start forks worker for test files a.test.ts' })
        ? ok('g34-unidade', 'reprisa')
        : reprova('g34-unidade', 'não reprisou'),
      true,
    ],
    [
      'g34 reprova reprise de vermelho de TESTE (sem marca de runner)',
      precisaDeReprise(passoUnidadeReal, { ok: false, saida: ' FAIL  src/a.test.ts > mede\nAssertionError: expected 1 to be 2' })
        ? ok('g34-unidade', 'reprisou vermelho de teste')
        : reprova('g34-unidade', 'não reprisa'),
      false,
    ],
    [
      'g34 reprova reprise de passo que estourou o teto (mesmo com a marca de worker)',
      precisaDeReprise(passoUnidadeReal, { ok: false, teto: true, saida: 'Timeout waiting for worker to respond' })
        ? ok('g34-unidade', 'reprisou teto')
        : reprova('g34-unidade', 'não reprisa'),
      false,
    ],
    [
      'g34 reprova reprise de passo que já saiu verde',
      precisaDeReprise(passoUnidadeReal, { ok: true, saida: 'Timeout waiting for worker to respond' })
        ? ok('g34-unidade', 'reprisou verde')
        : reprova('g34-unidade', 'não reprisa'),
      false,
    ],
    [
      'g34 reprova reprise que só rodou parte dos arquivos (105 de 189 nunca é verde)',
      guardaFalsoVerde('g34-unidade', PASSO_DE_UNIDADE_DE_PROVA, 0, NOTA_DE_REPRISE + relatorioDeUnidade(5, PISO_DE_TESTES_DE_UNIDADE)),
      false,
    ],
    [
      'g34 aprova reprise inteira (a nota não é ruína)',
      guardaFalsoVerde('g34-unidade', PASSO_DE_UNIDADE_DE_PROVA, 0, NOTA_DE_REPRISE + relatorioDeUnidade(10, PISO_DE_TESTES_DE_UNIDADE)),
      true,
    ],
    // g37 — fila de vagas por ordem de chegada (quem devolve e pede de novo vai para o fim).
    ['g37 aprova o primeiro da fila com 1 vaga livre', minhaVez(['a', 'b', 'c'], 'a', 1) ? ok('g37-fila', 'vez') : reprova('g37-fila', 'sem vez'), true],
    ['g37 reprova o segundo da fila com 1 vaga livre', minhaVez(['a', 'b', 'c'], 'b', 1) ? ok('g37-fila', 'furou a fila') : reprova('g37-fila', 'espera'), false],
    ['g37 aprova o segundo da fila com 2 vagas livres', minhaVez(['a', 'b', 'c'], 'b', 2) ? ok('g37-fila', 'vez') : reprova('g37-fila', 'sem vez'), true],
    ['g37 reprova quem acabou de devolver (senha nova, no fim)', minhaVez(['a', 'b', 'volta'], 'volta', 1) ? ok('g37-fila', 'furou a fila') : reprova('g37-fila', 'espera'), false],
    ['g37 reprova senha fora da fila', minhaVez(['a'], 'x', 3) ? ok('g37-fila', 'vez sem senha') : reprova('g37-fila', 'sem senha'), false],
    ['g37 reprova sem vaga livre', minhaVez(['a'], 'a', 0) ? ok('g37-fila', 'vez sem vaga') : reprova('g37-fila', 'espera'), false],
    // g36 — jornadas por spec: agregado, causa nomeada e reprise só de timeout.
    ...(() => {
      const dois = { id: 'jornadas-x', titulo: 'x', specs: ['e2e/a.spec.ts', 'e2e/b.spec.ts'] }
      const verde = (spec) => ({ spec, ok: true, codigo: 0, ms: 1000, saida: '  3 passed (1s)' })
      const agregado = (nome, subs, esperado, precisa) => {
        const r = agregarPorSpec(dois, subs)
        const temTudo = (precisa || []).every((p) => r.saida.indexOf(p) !== -1 || r.ruina.join(' ').indexOf(p) !== -1)
        return [
          nome,
          r.ok === esperado && temTudo
            ? (esperado ? ok('g36-por-spec', r.saida.split('\n')[0]) : reprova('g36-por-spec', r.ruina.join('; ')))
            : esperado
              ? reprova('g36-por-spec', 'ok=' + r.ok + ', faltou nomear ' + JSON.stringify(precisa))
              : ok('g36-por-spec', 'ok=' + r.ok + ', faltou nomear ' + JSON.stringify(precisa)),
          esperado,
        ]
      }
      const passoSpec = passoDoSpec(Object.assign(jornada('jornadas-x', 'x', ['e2e/a.spec.ts']), { porSpec: true }), 'e2e/a.spec.ts', 60000)
      const reprisa = (nome, resultado, esperado) => [
        nome,
        precisaDeReprise(passoSpec, resultado) ? ok('g36-reprise-de-spec', 'reprisa') : reprova('g36-reprise-de-spec', 'não reprisa'),
        esperado,
      ]
      return [
        agregado('g36 aprova todos os specs verdes', [verde('e2e/a.spec.ts'), verde('e2e/b.spec.ts')], true),
        agregado(
          'g36 reprova spec que falhou, nomeando spec e causa',
          [verde('e2e/a.spec.ts'), { spec: 'e2e/b.spec.ts', ok: false, codigo: 1, ms: 1, saida: '  2 failed\n  1 passed', ruina: [] }],
          false,
          ['e2e/b.spec.ts', 'teste falhou (2 failed)'],
        ),
        agregado(
          'g36 reprova spec que estourou o teto, nomeando a causa',
          [verde('e2e/a.spec.ts'), { spec: 'e2e/b.spec.ts', ok: false, teto: true, codigo: 1, ms: 1, saida: 'x', ruina: [] }],
          false,
          ['e2e/b.spec.ts', 'teto do spec estourado'],
        ),
        agregado('g36 reprova spec declarado sem resultado', [verde('e2e/a.spec.ts')], false, ['e2e/b.spec.ts', 'sem resultado']),
        agregado('g36 reprova passo sem spec nenhum rodado', [], false, []),
        reprisa('g36 aprova reprise de teste que estourou o tempo', { ok: false, saida: 'Test timeout of 30000ms exceeded.' }, true),
        reprisa('g36 aprova reprise de spec no teto', { ok: false, teto: true, saida: '' }, true),
        reprisa('g36 aprova reprise de vite que não subiu', { ok: false, saida: 'Error: Timed out waiting 120000ms from config.webServer.' }, true),
        reprisa(
          'g36 reprova reprise de asserção vermelha (timeout de expect não é timeout de teste)',
          { ok: false, saida: 'Error: expect(locator).toBeVisible() failed\nTimeout: 5000ms\n  1 failed' },
          false,
        ),
        [
          'g36 aprova os três passos de regressão por spec, com os specs de sempre',
          ['jornadas-e2e', 'jornadas-da-bar', 'jornadas-entregues'].every((id) => {
            const p = PLANO.find((x) => x.id === id)
            return p && p.porSpec && (p.specs || []).length > 0 && p.args.slice(-p.specs.length).join() === p.specs.join()
          })
            ? ok('g36-por-spec', 'jornadas-e2e, jornadas-da-bar e jornadas-entregues com porSpec')
            : reprova('g36-por-spec', 'algum passo de regressão sem porSpec ou com lista divergente'),
          true,
        ],
      ]
    })(),
    // g32 — vagas de Playwright: o juízo de órfã e o "0 desliga".
    ['g32 reprova vaga de pid morto (tem de ser retomada)', vagaPresa(julgarVaga({ pid: 4242, desde: new Date().toISOString() }, Date.now(), 0, () => false)), false],
    [
      'g32 reprova vaga de 3 h + 1 min (tem de ser retomada)',
      vagaPresa(julgarVaga({ pid: 4242, desde: new Date(Date.now() - VAGA_ORFA_MS - 60000).toISOString() }, Date.now(), 0, () => true)),
      false,
    ],
    ['g32 reprova vaga ilegível e velha (tem de ser retomada)', vagaPresa(julgarVaga(null, Date.now(), VAGA_ILEGIVEL_MS + 1000, () => true)), false],
    ['g32 aprova vaga de pid vivo e recente (fica com o dono)', vagaPresa(julgarVaga({ pid: 4242, desde: new Date().toISOString() }, Date.now(), 0, () => true)), true],
    ['g32 aprova vaga ilegível recente (dono no meio da escrita)', vagaPresa(julgarVaga(null, Date.now(), 100, () => true)), true],
    ['g32 aprova PORTAO_VAGAS=0 como desligado (não vira 3)', quantasVagas({ PORTAO_VAGAS: '0' }) === 0 ? ok('g32-vagas', '0') : reprova('g32-vagas', 'veio ' + quantasVagas({ PORTAO_VAGAS: '0' })), true],
    ['g32 aprova padrão 3 sem PORTAO_VAGAS', quantasVagas({}) === 3 ? ok('g32-vagas', '3') : reprova('g32-vagas', 'veio ' + quantasVagas({})), true],
    // A linha de espera não é ruína: ela nem entra na saída julgada, e se
    // entrasse o detector ainda a leria como texto neutro.
    [
      'g32 aprova relatório com a linha de espera por vaga',
      guardaFalsoVerde(
        'g32-vagas',
        jornada('prova-vaga', 'x', ['e2e/a.spec.ts']),
        0,
        'aguardando vaga de Playwright: 3 de 3 (quem: C:/dev/x/jornadas-e2e pid 1)\n  3 passed (10.0s)',
      ),
      true,
    ],
  ]
  const sinteticos = casos.map(([nome, resultado, esperado]) => ({
    id: nome,
    ok: resultado.ok === esperado,
    detalhe: 'esperado ' + (esperado ? 'APROVA' : 'REPROVA') + ', veio ' + (resultado.ok ? 'APROVA' : 'REPROVA') + ' — ' + resultado.detalhe,
  }))
  // O único caso que NÃO é sintético: uma porta de verdade, ocupada de verdade.
  return sinteticos.concat(await casosDePortaOcupada()).concat(await casosDeTetoDoPlaywright())
}

/**
 * O teto do Playwright exercitado DE VERDADE (g33): um node que abre um NETO e
 * fica parado, como o Playwright travado da fumaça de 23/09/2026. Com teto de
 * 1,5 s, `rodarComTeto` tem de estourar, matar pai E neto, e o veredito tem de
 * sair vermelho com a linha de teto — não como falso-verde nem como ruína de
 * teste. Controle negativo: processo rápido sob o teto sai com o exit dele.
 */
async function casosDeTetoDoPlaywright() {
  const caso = (id, passou, detalhe) => ({ id, ok: passou, detalhe })
  const travado =
    "const c=require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});" +
    "process.stdout.write('neto='+c.pid);setTimeout(()=>{},60000)"
  const opcoes = { cwd: RAIZ, env: process.env, shell: false, maxBuffer: 64 * 1024 * 1024 }
  const t0 = Date.now()
  const r = await rodarComTeto(process.execPath, ['-e', travado], opcoes, 1500)
  const levou = Date.now() - t0
  const neto = Number((/neto=(\d+)/.exec(r.stdout) || [])[1])
  await new Promise((pronto) => setTimeout(pronto, 500))
  const netoVivo = Number.isFinite(neto) && neto > 0 ? pidVivo(neto) : true
  const passo = jornada('autoteste-teto', 'passo de jornada travado', ['e2e/nao-roda.spec.ts'])
  const saida = linhaDeTeto(r.tetoMs) + '\n' + r.stdout
  const veredito = julgarSaida(passo, 1, saida)
  const rapido = await rodarComTeto(process.execPath, ['-e', "process.stdout.write('ok')"], opcoes, 60000)
  // O órfão fora da árvore: um node escutando numa porta sorteada, que NÃO é
  // filho de ninguém que o teto mate. Só `matarQuemOcupaAPorta` o alcança.
  const orfao = spawn(
    process.execPath,
    ['-e', "const s=require('net').createServer().listen(0,'127.0.0.1',()=>process.stdout.write('porta='+s.address().port));setTimeout(()=>{},60000)"],
    { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
  )
  const portaDoOrfao = await new Promise((pronto) => {
    let lido = ''
    const desiste = setTimeout(() => pronto(0), 15000)
    orfao.stdout.on('data', (d) => {
      lido += d
      const m = /porta=(\d+)/.exec(lido)
      if (m) {
        clearTimeout(desiste)
        pronto(Number(m[1]))
      }
    })
  })
  const mortosNaPorta = portaDoOrfao > 0 ? matarQuemOcupaAPorta(portaDoOrfao) : []
  await new Promise((pronto) => setTimeout(pronto, 500))
  const orfaoVivo = pidVivo(orfao.pid)
  if (orfaoVivo) {
    try {
      orfao.kill()
    } catch (e) {}
  }
  return [
    caso(
      'g33 órfão fora da árvore escutando na porta morre pelo dono da porta',
      process.platform !== 'win32' || (portaDoOrfao > 0 && mortosNaPorta.indexOf(orfao.pid) !== -1 && !orfaoVivo),
      'porta ' + portaDoOrfao + ', mortos ' + JSON.stringify(mortosNaPorta) + ', pid ' + orfao.pid + (orfaoVivo ? ' VIVO' : ' morto'),
    ),
    caso(
      'g33 teto estoura processo travado e mata a árvore (pai e neto)',
      r.estourou === true && neto > 0 && !netoVivo && levou < 20000,
      'estourou=' + r.estourou + ', neto ' + (neto || '?') + (netoVivo ? ' VIVO' : ' morto') + ', ' + levou + ' ms',
    ),
    caso(
      'g33 teto estourado sai VERMELHO com a linha de teto, sem falso-verde',
      !veredito.ok && !veredito.falsoVerde && /^Playwright passou do teto de 0\.03 min \(travado\?\)/.test(saida),
      'ok=' + veredito.ok + ', falsoVerde=' + veredito.falsoVerde + ', primeira linha: ' + saida.split('\n')[0].slice(0, 60),
    ),
    caso(
      'g33 processo rápido sob o teto sai com o próprio exit (controle negativo)',
      rapido.estourou === false && rapido.status === 0 && rapido.stdout === 'ok',
      'estourou=' + rapido.estourou + ', status=' + rapido.status + ', stdout=' + JSON.stringify(rapido.stdout),
    ),
  ]
}

/**
 * O ramo "VERMELHO DE AMBIENTE — porta ocupada", exercitado DE VERDADE.
 *
 * O juiz de 21/09/2026: "o código novo de `quemOcupaAPorta` + VERMELHO DE
 * AMBIENTE NÃO foi exercitado — a porta do worktree estava livre, então esse
 * ramo só foi LIDO, nao rodado. Não há autoteste cobrindo ele." Aqui o teste
 * ABRE um servidor numa porta livre do sistema, faz o portão descobrir sozinho
 * que ela está ocupada, confere que ele NOMEIA o PID (que é o deste processo, o
 * único dono possível) e que o veredito sai vermelho com a palavra AMBIENTE.
 * Depois fecha o servidor e cobra o controle negativo: porta livre não acusa
 * ninguém. Nada é morto e nada é escrito — e a porta é sorteada pelo sistema
 * (`listen(0)`), então isto não disputa a porta de jornada de árvore nenhuma.
 */
async function casosDePortaOcupada() {
  const caso = (id, passou, detalhe) => ({ id, ok: passou, detalhe })
  const passo = jornada('autoteste-porta-ocupada', 'passo de jornada que NÃO deve ser chamado', ['e2e/nao-roda.spec.ts'])
  const reusa = process.env.LAB_REUSA_SERVIDOR
  const servidor = net.createServer(() => {})
  const resultados = []
  try {
    // `LAB_REUSA_SERVIDOR=1` dispensa a espera de propósito (ali o servidor no
    // ar é o que se quer reaproveitar); o que está sob teste é o outro caminho.
    delete process.env.LAB_REUSA_SERVIDOR
    await new Promise((resolve, reject) => {
      servidor.once('error', reject)
      servidor.listen(0, '127.0.0.1', resolve)
    })
    const porta = servidor.address().port
    const ocupada = await esperarPortaLivre(porta, 1200)
    resultados.push(
      caso(
        'g29 enxerga porta REALMENTE ocupada (servidor aberto por este teste)',
        ocupada.ocupada === true && ocupada.dispensada !== true,
        'porta ' + porta + ', esperou ' + ocupada.esperou + ' ms e continuou ocupada: ' + ocupada.ocupada,
      ),
    )
    const donos = quemOcupaAPorta(porta)
    resultados.push(
      caso(
        'g29 nomeia o PID que segura a porta',
        process.platform !== 'win32' || donos.some((d) => d.indexOf('PID ' + process.pid + ' ') === 0),
        'esperava PID ' + process.pid + ', veio: ' + (donos.join(', ') || '(ninguém)'),
      ),
    )
    const veredito = vereditoDePortaOcupada(passo, porta, ocupada.esperou, donos, 1)
    resultados.push(
      caso(
        'g29 devolve VERMELHO DE AMBIENTE, sem chamar o Playwright',
        veredito.ok === false &&
          veredito.ambiente === true &&
          veredito.codigo === 1 &&
          /VERMELHO DE AMBIENTE/.test(veredito.saida) &&
          veredito.saida.indexOf(String(porta)) !== -1,
        'ok=' + veredito.ok + ', ambiente=' + veredito.ambiente + ', primeira linha: ' + veredito.saida.split('\n')[0],
      ),
    )
    await new Promise((resolve) => servidor.close(resolve))
    const livre = await esperarPortaLivre(porta, 1200)
    resultados.push(
      caso(
        'g29 NÃO acusa porta livre (controle negativo, mesma porta depois de fechar)',
        livre.ocupada === false,
        'porta ' + porta + ' depois do close: ocupada=' + livre.ocupada + ' em ' + livre.esperou + ' ms',
      ),
    )
  } catch (e) {
    resultados.push(caso('g29 porta ocupada de verdade', false, 'o autoteste não conseguiu abrir a porta: ' + String((e && e.message) || e)))
  } finally {
    try {
      servidor.close()
    } catch (e) {
      // já fechado pelo controle negativo
    }
    if (reusa === undefined) delete process.env.LAB_REUSA_SERVIDOR
    else process.env.LAB_REUSA_SERVIDOR = reusa
  }
  return resultados
}

/**
 * Em voz alta: o que não rodou nesta chamada, e POR QUÊ. Três motivos, nesta
 * ordem de gravidade — exclusão declarada (o passo não roda em volta nenhuma),
 * prova (nasce vermelha, roda na volta que declara vencedor) e recorte de
 * `--so=` (o operador pediu um passo só). Compacto de propósito: uma linha por
 * motivo, com os ids, para caber no relatório sem virar ruído.
 */
function imprimirForaDaVolta(foraDaVolta, recorteChamado, prova) {
  if (!foraDaVolta || foraDaVolta.length === 0) return
  const excluidos = foraDaVolta.filter((p) => p.fora)
  const provas = foraDaVolta.filter((p) => !p.fora && p.prova && !prova)
  const recorte = foraDaVolta.filter((p) => !p.fora && !(p.prova && !prova))
  const ids = (lista) => lista.map((p) => p.id).join(', ')
  let texto = 'FORA DESTA VOLTA — ' + foraDaVolta.length + ' de ' + PLANO.length + ' passos do PLANO não rodaram aqui:\n'
  for (const p of excluidos) texto += '  EXCLUSÃO DECLARADA: ' + p.id + ' — ' + p.fora + '\n'
  if (provas.length > 0) {
    texto +=
      '  PROVA (' + provas.length + '): ' + ids(provas) +
      ' — são o critério de conserto da rodada e nascem VERMELHAS; rode `--prova` (ou `--so=<id>`) na volta que declara vencedor.\n'
  }
  if (recorte.length > 0) {
    texto += '  recorte de `' + (recorteChamado || 'volta comum') + '` (' + recorte.length + '): ' + ids(recorte) + '\n'
    // A REGRESSÃO tem nome próprio nesta linha.
    //
    // MEDIDO em 21/09/2026: `jornadas-da-bar` ficou fora dos 14 comandos da
    // rodada e as seis jornadas de regressão não rodaram em lugar nenhum —
    // "nenhuma jornada já existente pode ficar vermelha" era, naquela rodada,
    // uma promessa que ninguém mediu. O aviso antigo listava o id no meio dos
    // outros e não dizia o que ele carregava, então ler a linha não bastava
    // para perceber o buraco. Aqui ele sai destacado, com os specs que ficaram
    // sem medida e o comando exato que os mede.
    const regressao = recorte.filter((p) => p.id === 'jornadas-da-bar' || p.id === 'jornadas-e2e')
    for (const p of regressao) {
      texto +=
        '  ATENÇÃO — REGRESSÃO SEM MEDIDA nesta chamada: `' + p.id + '` (' + (p.specs || []).length + ' spec(s)) não rodou.\n' +
        '    ' + (p.specs || []).join(', ') + '\n' +
        '    é o lado do portão que promete verde em TODA volta; sem este comando a promessa não foi medida.\n' +
        '    rode: node scripts/portao.cjs --so=' + p.id + '\n' +
        '    enquanto ele não rodar VERDE nesta árvore, o passo `regressao-em-dia` fica VERMELHO (recibo, não aviso).\n'
    }
  }
  process.stdout.write(texto + '\n')
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
          // A suíte de unidade inteira (descoberta no git) e o piso que o passo
          // `unidade` cobra dela: quem lê a lista vê o tamanho auditado, não só
          // os 4 nomes da régua estrita.
          unidade_auditada: (arquivosDeUnidade() || []).length,
          piso_de_unidade: { arquivos: pisoDeArquivosDeUnidade(), testes: PISO_DE_TESTES_DE_UNIDADE },
          fora_da_volta: PLANO.filter((p) => p.fora).map((p) => ({ id: p.id, motivo: p.fora })),
          // A LISTA DE COMANDOS DA VOLTA COMUM, pronta para copiar.
          //
          // MEDIDO em 21/09/2026: a rodada declarou 14 comandos digitados à mão
          // e o passo `jornadas-da-bar` ficou de fora — as SEIS jornadas de
          // regressão da bar (luz, token com foto, pincel e balde, sala livre,
          // pinos, ferramentas mudas) não tiveram comando nenhum, e a rodada
          // inteira podia sair verde com qualquer uma delas quebrada. Nada no
          // portão acusava, porque o portão não sabe qual lista alguém digitou.
          //
          // Agora ele publica a lista certa. Quem orquestra copia este array em
          // vez de transcrever o PLANO: `comandos_da_volta_comum.length` é
          // quantos comandos a rodada precisa ter, e a conferência vira uma
          // comparação de números em vez de uma leitura atenta.
          //
          // `prova: true` e exclusão declarada ficam FORA deste array de
          // propósito — são os passos que não rodam na volta comum —, e saem
          // logo abaixo, nomeados, para não sumirem.
          comandos_da_volta_comum: PLANO.filter((p) => !p.fora && !p.prova).map((p) => 'node scripts/portao.cjs --so=' + p.id),
          comandos_da_prova: PLANO.filter((p) => !p.fora && p.prova).map((p) => 'node scripts/portao.cjs --so=' + p.id),
          plano: PLANO.map((p) => ({
            id: p.id,
            titulo: p.titulo,
            comando: p.sonda ? 'sonda HTTP interna' : [p.exe].concat(p.args).join(' '),
            comando_portao: 'node scripts/portao.cjs --so=' + p.id,
            volta_comum: !p.fora && !p.prova,
            cwd: p.cwd || RAIZ,
          })),
        },
        null,
        2,
      ) + '\n',
    )
    return 0
  }

  // `--jornada=<id> <spec...>` — o MESMO passo de jornada do PLANO, para uma
  // lista de specs escolhida na linha de comando.
  //
  // POR QUE EXISTE. A lista de comandos do run tinha um passo de Playwright
  // CRU (`node node_modules/@playwright/test/cli.js test <8 specs>`), o único
  // de jornada sem detector de falso-verde: `N skipped`, `N flaky`, `did not
  // run` e até relatório sem nenhum "N passed" saem com exit 0, e o run inteiro
  // lê isso como verde. Aqui a mesma lista passa pelo `jornada()` — ruína,
  // prova positiva de que algo passou, `--repeat-each` e pasta de artefato
  // própria. Trocar o comando cru por este é uma linha na lista do run.
  const jornadaAvulsa = (argv.find((a) => a.startsWith('--jornada=')) || '').slice(10)
  if (jornadaAvulsa) {
    const alvos = argv.filter((a) => !a.startsWith('--'))
    const extras = argv.filter((a) => a.startsWith('--pw=')).map((a) => a.slice(5))
    if (alvos.length === 0) {
      process.stderr.write('--jornada=<id> precisa de pelo menos um spec: --jornada=novas e2e/a.spec.ts e2e/b.spec.ts\n')
      return 2
    }
    const ausentes = alvos.filter((a) => !fs.existsSync(path.join(CLIENTE, a)))
    if (ausentes.length > 0) {
      // Spec que não existe faz o Playwright rodar ZERO teste e sair 0 — o
      // falso-verde mais barato de todos, e por erro de digitação.
      process.stderr.write('spec inexistente em client/: ' + ausentes.join(', ') + '\n')
      return 2
    }
    // Existir não basta: a lista também tem de estar COMPLETA. Omitir uma
    // jornada do critério é o falso-verde que o detector de relatório não
    // alcança, porque o que não rodou não deixa rastro no relatório.
    const completa = guardaListaDeJornadas(alvos, GRUPOS_DA_BAR, JORNADAS_DISPENSADAS)
    process.stdout.write((completa.ok ? 'VERDE  ' : 'VERMELHO') + ' ' + completa.id + ': ' + completa.detalhe + (completa.endereco ? '  [' + completa.endereco + ']' : '') + '\n')
    if (!completa.ok) return 2
    // O modo avulso roda UM passo de jornada e nenhum outro. Ele também deve o
    // aviso: sem ele, os comandos `--jornada=` do run saíam verdes sem nomear
    // os 16 passos do PLANO que ficaram de fora.
    imprimirForaDaVolta(PLANO, '--jornada=' + jornadaAvulsa, false)
    // A FASE 0 roda AQUI TAMBÉM, como em toda outra chamada.
    //
    // O que estava errado: este bloco devolvia antes da linha
    // `const fase0 = rodarFase0()`, e os dois comandos de jornada do run
    // (regressão da bar e critério da noite) eram os únicos que não imprimiam
    // guarda nenhuma além de `g19`. Quem rodasse SÓ eles ficava sem auditoria
    // estática: sem `g12` (jornada afrouxada depois do selo), sem `g24`
    // (suíte de unidade encolhida) e sem `g3`/`g4` (only/skip e teto sem
    // controle positivo) — e são justamente essas as guardas que pegam o
    // builder afrouxando a própria régua no MESMO commit em que a jornada fica
    // verde. Como no modo comum, achado da FASE 0 não aborta a jornada: ela
    // roda, e o exit code soma os dois lados.
    const fase0Avulsa = rodarFase0()
    imprimir('FASE 0 — auditoria do portão', fase0Avulsa)
    const fase0AvulsaRuim = fase0Avulsa.filter((x) => !x.ok)
    const r = await rodarPasso(jornada(jornadaAvulsa, alvos.length + ' spec(s) pela linha de comando', alvos, extras))
    process.stdout.write(r.saida + '\n')
    process.stdout.write(
      (r.ok ? 'VERDE  ' : 'VERMELHO') +
        ' ' + r.id + ' (' + r.ms + ' ms, exit ' + r.codigo + ')' + notaDeVaga(r) +
        (r.falsoVerde ? ' FALSO-VERDE: saiu 0 com ' + r.ruina.join(', ') : '') +
        ' — ' + r.titulo + '\n',
    )
    process.stdout.write(fase0AvulsaRuim.length + ' achado(s) na FASE 0\n')
    return r.ok && fase0AvulsaRuim.length === 0 ? 0 : 1
  }

  if (argv.includes('--selar')) {
    const { selo, faltando } = selar()
    process.stdout.write('selo escrito em ' + SELO + '\n' + JSON.stringify(selo, null, 2) + '\n')
    if (faltando.length > 0) process.stdout.write('\nATENÇÃO — jornada declarada e ausente do disco, fora do selo: ' + faltando.join(', ') + '\n')
    return faltando.length === 0 ? 0 : 1
  }

  if (argv.includes('--autoteste')) {
    const r = await rodarAutoteste()
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

  // Os passos de PROVA (`prova: true`) ficam fora da volta comum de propósito:
  // eles são o critério de conserto desta rodada e nascem vermelhos, então
  // deixá-los na regressão trava toda peça atrás de um defeito que ela não
  // causou. `--so=<id>` sempre alcança um deles; `--prova` roda o portão
  // inteiro com eles dentro, que é a volta que declara vencedor.
  const prova = argv.includes('--prova')
  const passos = so ? PLANO.filter((p) => p.id === so) : PLANO.filter((p) => !p.fora && (!p.prova || prova))
  if (so && passos.length === 0) {
    process.stderr.write('passo desconhecido: ' + so + '\n')
    return 2
  }
  // O que NÃO rodou sai nomeado em TODA chamada, com o motivo de cada um.
  //
  // A conta antiga (`so || prova ? [] : PLANO.filter(p => p.prova)`) zerava a
  // lista sempre que havia `--so=`, e os 16 comandos do run são todos `--so=`
  // ou `--jornada=`: nenhum deles chegou a imprimir a linha uma vez sequer, e
  // `transporte-vivo` — que passo nenhum alcança — nunca foi nomeado. Quem
  // lesse só o verde acharia que o PLANO inteiro rodou.
  imprimirForaDaVolta(PLANO.filter((p) => passos.indexOf(p) === -1), so ? '--so=' + so : 'volta comum', prova)

  const resultados = []
  for (const passo of passos) {
    const r = await rodarPasso(passo)
    // Passo de regressão verde deixa recibo; é dele que `regressao-em-dia` vive.
    escreverRecibo(passo, r)
    resultados.push(r)
    process.stdout.write(
      (r.ok ? 'VERDE  ' : 'VERMELHO') + ' ' + r.id + ' (' + r.ms + ' ms, exit ' + r.codigo + ')' + notaDeVaga(r) + (r.falsoVerde ? ' FALSO-VERDE: saiu 0 com ' + r.ruina.join(', ') : '') + ' — ' + r.titulo + '\n',
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
