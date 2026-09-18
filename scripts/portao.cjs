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
 * Folga de trabalho acima do piso. Abaixo dela o passo `disco` AINDA sai verde
 * — o piso é o piso —, mas grita o número: com pouca folga, um worktree, um
 * build ou uma pasta de trace derruba o passo NO MEIO do run, e a peça que
 * estiver rodando na hora leva a culpa de um vermelho que não é dela. Medido em
 * 18/09/2026: 5,27 GB livres de 511 — folga de 2,27 GB sobre o piso, que é
 * MENOS que uma volta de jornadas com trace e um build de release juntos. Por
 * isso o alvo é piso + 3 GB: com a folga de hoje, o aviso SAI.
 */
const FOLGA_DE_TRABALHO_GB = PISO_DE_DISCO_GB + 3

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
]
/**
 * A bar inteira, na ordem de sempre: é esta lista que o SELO carimba e que a
 * auditoria arquivo a arquivo da FASE 0 percorre. Concatenar os dois grupos
 * mantém a ordem byte a byte da lista anterior — o selo não se mexe.
 */
const JORNADAS_DA_BAR = JORNADAS_DE_REGRESSAO_DA_BAR.concat(JORNADAS_DO_CRITERIO)
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
 */
const PISO_DE_TESTES_DE_UNIDADE = 2299

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
  const sumiram = naBase.filter((a) => agora.indexOf(a) === -1)
  if (agora.length < naBase.length) {
    return reprova(
      'g24-unidade-nao-encolheu',
      'a suíte de unidade encolheu: ' + agora.length + ' arquivos agora contra ' + naBase.length + ' na base' +
        (sumiram.length > 0 ? ' — sumiram ' + sumiram.join(', ') : ''),
      'client/src (arquivos *.test.ts*)',
    )
  }
  return ok(
    'g24-unidade-nao-encolheu',
    agora.length + ' arquivos de unidade agora, ' + naBase.length + ' na base (' + ((medida && medida.ref) || 'base do run') +
      '); piso do passo `unidade`: ' + naBase.length + ' arquivos e ' + PISO_DE_TESTES_DE_UNIDADE + ' testes',
  )
}

/** O piso de arquivos que o passo `unidade` cobra, lido do commit base do run. */
function pisoDeArquivosDeUnidade() {
  const naBase = arquivosDeUnidadeNaBase(baseDoRun().base)
  return naBase === null ? null : naBase.length
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
  const donosDe = (arquivo) => Object.keys(pecas).filter((nome) => (pecas[nome] || []).some((p) => casaCom(arquivo, p)))
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
    const permitido = (a) => (pecas[chave] || []).some((p) => casaCom(a, p)) || livres.some((p) => casaCom(a, p))
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
  jornada(
    'jornadas-e2e',
    'jornadas já entregues, com ponteiro real, mais a regressão dos menus e dos TRÊS ALVOS que esta rodada reestrutura',
    JORNADAS_E2E.concat(JORNADAS_REGRESSAO_MENUS, JORNADAS_REGRESSAO_DOS_ALVOS),
  ),
  // REGRESSÃO. Roda em toda volta e tem de sair verde em toda volta. A lista é
  // DERIVADA do grupo, não digitada: antes era a bar inteira, e por isso este
  // passo nascia vermelho por causa do critério — nenhum builder conseguia
  // passar num passo que não dependia dele.
  jornada(
    'jornadas-da-bar',
    'REGRESSÃO: os gestos que a bar deste run já tinha verdes (luz, token com foto, pincel e balde, sala livre, pinos)',
    JORNADAS_DE_REGRESSAO_DA_BAR.filter((j) => !JORNADAS_DISPENSADAS[j]),
  ),
  // PROVA. As três jornadas do critério desta rodada. Nascem VERMELHAS: só
  // ficam verdes depois que as peças de cliente consertam os defeitos, e por
  // isso este passo fica FORA da volta comum (`prova: true`) e só entra em
  // `--prova` ou `--so=jornadas-do-criterio`. Antes dele não existia rota
  // nenhuma: os comandos de regressão saíam exit 0 com os três defeitos
  // intactos, porque nenhum passo do PLANO alcançava estes três specs.
  Object.assign(
    jornada(
      'jornadas-do-criterio',
      'PROVA: as três jornadas do critério de 18/09/2026 (cadeado de camada, encerramento do polígono, menu que cabe na janela)',
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
  for (const arquivo of arquivos) {
    const texto = git(['show', medida.base + ':client/' + arquivo])
    if (texto !== null) hashes[arquivo] = sha256(texto)
  }
  return { hashes, base: medida.base, ref: medida.ref, erro: null }
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
    return {
      codigo: r.ok ? 0 : 1,
      saida:
        r.detalhe + '\nselo de ' + (selo.selado_em || '?') +
        '\nbase do run para as jornadas fora do selo: ' + (daBase.base ? daBase.ref + ' = ' + daBase.base.slice(0, 8) : 'NÃO RESOLVEU (' + daBase.erro + ')'),
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
    const folgaGb = livreGb - PISO_DE_DISCO_GB
    return {
      codigo: livreGb >= PISO_DE_DISCO_GB ? 0 : 1,
      saida:
        'AMBIENTE DA MÁQUINA — este passo não mede trabalho de peça nenhuma; vermelho aqui é disco, não builder.' +
        '\nlivre ' + livreGb.toFixed(2) + ' GB de ' + totalGb.toFixed(2) + ' GB (piso do portão: ' + PISO_DE_DISCO_GB +
        ' GB; folga sobre o piso: ' + folgaGb.toFixed(2) + ' GB)' +
        '\ntrace e screenshot de jornada: ' + faxina.apagadas + ' pasta(s) antiga(s) apagada(s) (' + (faxina.bytes / 1e9).toFixed(2) +
        ' GB devolvidos), ' + faxina.mantidas + ' mantida(s) ocupando ' + ocupadoGb.toFixed(2) + ' GB em ' + ARTEFATOS +
        (faxina.motivo ? ' — ' + faxina.motivo : '') +
        (livreGb < PISO_DE_DISCO_GB
          ? '\nabaixo do piso: worktree, build e trace não cabem — pare antes de encher o disco'
          : livreGb < FOLGA_DE_TRABALHO_GB
            ? '\nFOLGA CURTA (' + folgaGb.toFixed(2) + ' GB sobre o piso, alvo ' + (FOLGA_DE_TRABALHO_GB - PISO_DE_DISCO_GB).toFixed(2) +
              ' GB): um worktree, um build de release ou uma pasta de trace derruba este passo NO MEIO do run, e quem estiver ' +
              'rodando na hora leva a culpa. Libere disco antes da volta da prova — é pendência de ambiente, não de peça.'
            : ''),
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
    resultados.push(guardaEscalaDaUnidade(listaUnidade, arquivosDeUnidadeNaBase(medidaParaUnidade.base), medidaParaUnidade))
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
function rodarAutoteste() {
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
  ]
  return casos.map(([nome, resultado, esperado]) => ({
    id: nome,
    ok: resultado.ok === esperado,
    detalhe: 'esperado ' + (esperado ? 'APROVA' : 'REPROVA') + ', veio ' + (resultado.ok ? 'APROVA' : 'REPROVA') + ' — ' + resultado.detalhe,
  }))
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
        ' ' + r.id + ' (' + r.ms + ' ms, exit ' + r.codigo + ')' +
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
