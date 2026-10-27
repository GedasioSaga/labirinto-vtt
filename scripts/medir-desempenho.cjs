#!/usr/bin/env node
/*
 * MEDIR DESEMPENHO — harness do mapa grande (27/10/2026).
 *
 * COMO RODAR (da raiz do repositório; uma suíte pesada por vez na máquina):
 *
 *   node scripts/medir-desempenho.cjs --mapa-real C:/caminho/mapa.json
 *   node scripts/medir-desempenho.cjs --conjunto rapido            # só o caso principal, sem perfil
 *   node scripts/medir-desempenho.cjs --so real-mt-1080,sint200-mt-1080
 *   node scripts/medir-desempenho.cjs --modo dev                   # vite de desenvolvimento (perfil legível)
 *   node scripts/medir-desempenho.cjs --sem-build                  # reaproveita o build anterior
 *   node scripts/medir-desempenho.cjs --gravar docs/desempenho/linha-de-base-AAAA-MM-DD.json
 *   node scripts/medir-desempenho.cjs --so ... --limites docs/desempenho/limites.json   # reprova (código 1) fora dos limites
 *
 * VARIÁVEIS: `LAB_DES_DIST` = pasta do build (padrão %TEMP%/labirinto-desempenho/dist;
 * duas fatias medindo em fila não pisam no build uma da outra). `LAB_DES_FOTOS` = pasta das
 * fotos de referência (modo foto do spec: só fotos, sem cenários; `LAB_DES_ATUALIZAR_FOTOS=1` grava).
 *
 * O QUE FAZ:
 *   1. build de produção do client com a sonda (`VITE_LAB_SONDA=1`, ver
 *      client/src/lib/sondaDeDesempenho.ts), sem minificar e com sourcemap
 *      (nomes legíveis no perfil; o modo é produção: React de produção, sem os
 *      ramos de desenvolvimento), numa pasta temporária fora do repositório;
 *   2. `playwright test -c playwright.desempenho.config.ts`, que sobe o
 *      `vite preview` desse build e roda client/desempenho/mapa-grande.spec.ts
 *      com os casos escolhidos;
 *   3. junta as linhas JSON dos casos, imprime a tabela e, com `--gravar`,
 *      escreve o JSON consolidado.
 *
 * O MAPA REAL nunca entra no repositório (conteúdo do usuário, repo público):
 * vem por `--mapa-real` ou `LAB_DES_MAPA_REAL`. Sem ele os casos `real-*` são
 * pulados e os sintéticos rodam.
 */
'use strict'
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..')
const CLIENT = path.join(RAIZ, 'client')
const TEMP = path.join(os.tmpdir(), 'labirinto-desempenho')

const FULLHD = { largura: 1920, altura: 1080, dpr: 1 }
const QHD_150 = { largura: 2560, altura: 1440, dpr: 1.5 }

/** Os casos. `perfil` liga o perfil de CPU (segunda passada de cada cenário). */
const CASOS = [
  { id: 'real-mt-1080', mapa: 'real', obra: 'meio-termo', tela: FULLHD, perfil: true, fases: 'mesa' },
  { id: 'real-linhas-1080', mapa: 'real', obra: 'linhas', tela: FULLHD, perfil: false, fases: 'mesa' },
  { id: 'real-mt-1440-dpr15', mapa: 'real', obra: 'meio-termo', tela: QHD_150, perfil: false, fases: 'mesa' },
  { id: 'real-linhas-1440-dpr15', mapa: 'real', obra: 'linhas', tela: QHD_150, perfil: false, fases: 'mesa' },
  { id: 'sint200-mt-1440-dpr15', mapa: 'sintetico', lado: 200, obra: 'meio-termo', tela: QHD_150, perfil: false, fases: 'mesa' },
  { id: 'sint200-linhas-1440-dpr15', mapa: 'sintetico', lado: 200, obra: 'linhas', tela: QHD_150, perfil: false, fases: 'mesa' },
  { id: 'sint200-mt-1080', mapa: 'sintetico', lado: 200, obra: 'meio-termo', tela: FULLHD, perfil: false, fases: 'mesa' },
  { id: 'sint100-mt-1080', mapa: 'sintetico', lado: 100, obra: 'meio-termo', tela: FULLHD, perfil: false, fases: 'mesa' },
  { id: 'sint50-mt-1080', mapa: 'sintetico', lado: 50, obra: 'meio-termo', tela: FULLHD, perfil: false, fases: 'mesa' },
]
const CONJUNTOS = {
  'linha-de-base': CASOS.map((c) => c.id),
  rapido: ['real-mt-1080'],
}

function lerArgs(argv) {
  const out = { modo: 'prod', conjunto: 'linha-de-base', so: null, semBuild: false, gravar: null, mapaReal: process.env.LAB_DES_MAPA_REAL || '', semPerfil: false, limites: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--modo') out.modo = argv[++i]
    else if (a === '--conjunto') out.conjunto = argv[++i]
    else if (a === '--so') out.so = argv[++i].split(',')
    else if (a === '--sem-build') out.semBuild = true
    else if (a === '--sem-perfil') out.semPerfil = true
    else if (a === '--janela') process.env.LAB_DES_JANELA = '1'
    else if (a === '--gravar') out.gravar = argv[++i]
    else if (a === '--mapa-real') out.mapaReal = argv[++i]
    else if (a === '--limites') out.limites = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
      process.exit(0)
    } else throw new Error(`argumento desconhecido: ${a}`)
  }
  return out
}

/**
 * O Chromium que a máquina já tem (`LAB_NAVEGADOR`, como no playwright.config.ts).
 * Sem a variável, o `chromium-*` mais novo de %LOCALAPPDATA%/ms-playwright: a
 * revisão exata deste Playwright pode não estar baixada, e baixar pede autorização.
 */
function navegadorDaMaquina() {
  if (process.env.LAB_NAVEGADOR) return process.env.LAB_NAVEGADOR
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  if (!fs.existsSync(base)) return ''
  const revisoes = fs
    .readdirSync(base)
    .filter((n) => /^chromium-\d+$/.test(n))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const r of revisoes) {
    const exe = path.join(base, r, 'chrome-win64', 'chrome.exe')
    if (fs.existsSync(exe)) return exe
  }
  return ''
}

function rodar(cmd, args, opcoes) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opcoes })
  return r.status ?? 1
}

function main() {
  const args = lerArgs(process.argv.slice(2))
  const ids = args.so ?? CONJUNTOS[args.conjunto]
  if (ids === undefined) throw new Error(`conjunto desconhecido: ${args.conjunto}`)
  const casos = CASOS.filter((c) => ids.includes(c.id)).map((c) => (args.semPerfil ? { ...c, perfil: false } : c))
  if (casos.length === 0) throw new Error(`nenhum caso com os ids ${ids.join(',')}`)
  fs.mkdirSync(TEMP, { recursive: true })
  const dist = process.env.LAB_DES_DIST || path.join(TEMP, 'dist')

  if (args.modo === 'prod' && !args.semBuild) {
    console.log(`[medir] build de produção com a sonda -> ${dist}`)
    const status = rodar('npx', ['vite', 'build', '--outDir', `"${dist}"`, '--emptyOutDir', '--sourcemap', '--minify', 'false', '--logLevel', 'warn'], { cwd: CLIENT, env: { ...process.env, VITE_LAB_SONDA: '1' } })
    if (status !== 0) process.exit(status)
  }

  const saida = path.join(TEMP, `casos-${Date.now()}.jsonl`)
  console.log(`[medir] ${casos.length} caso(s): ${casos.map((c) => c.id).join(', ')}`)
  const status = rodar('npx', ['playwright', 'test', '-c', 'playwright.desempenho.config.ts'], {
    cwd: CLIENT,
    env: { ...process.env, LAB_NAVEGADOR: navegadorDaMaquina(), LAB_DES_MODO: args.modo, LAB_DES_DIST: dist, LAB_DES_CASOS: JSON.stringify(casos), LAB_DES_SAIDA: saida, LAB_DES_MAPA_REAL: args.mapaReal },
  })
  const linhas = fs.existsSync(saida) ? fs.readFileSync(saida, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  for (const r of linhas) {
    console.log(`\n== ${r.caso.id}  (${r.mapa.lado}, ${r.gpu})`)
    console.log(`abrir mestre: ${JSON.stringify(r.abrir_mestre)}`)
    if (r.abrir_jogador) console.log(`abrir jogador: ${JSON.stringify(r.abrir_jogador)}`)
    for (const c of r.cenarios) console.log(`${c.papel.padEnd(8)} ${c.cenario.padEnd(46)} fps ${String(c.fps).padStart(5)}  p95 ${String(c.quadro_p95_ms).padStart(6)} ms  longa max ${String(c.longas_max_ms).padStart(6)} ms  cpu ${String(c.cpu_ms_por_s).padStart(6)} ms/s`)
  }
  if (args.gravar) {
    const destino = path.resolve(RAIZ, args.gravar)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.writeFileSync(destino, `${JSON.stringify({ gerado_em: new Date().toISOString(), modo: args.modo, build: args.modo === 'prod' ? 'vite build, VITE_LAB_SONDA=1, --minify false, --sourcemap' : 'vite dev', casos: linhas }, null, 1)}\n`)
    console.log(`\n[medir] gravado em ${destino}`)
  }
  if (args.limites) {
    const reprovas = conferirLimites(JSON.parse(fs.readFileSync(path.resolve(RAIZ, args.limites), 'utf8')), linhas)
    console.log(`\n[medir] limites (${args.limites}): ${reprovas.length === 0 ? 'PASSOU' : `REPROVOU em ${reprovas.length}`}`)
    for (const r of reprovas) console.log(`  REPROVA ${r}`)
    if (reprovas.length > 0) process.exit(1)
  }
  process.exit(status)
}

/**
 * Confere o resultado com os limites (`docs/desempenho/limites.json`). Cada regra:
 * `{ casos: [ids], cenarios: [nomes], papeis: [papeis], fps_min, p95_max_ms }` sobre os
 * cenários, ou `{ casos, gpu: [chaves do registro], mb_max, lado_max_px }` sobre a memória
 * de textura, ou `{ casos, filtro: [chaves do registro], passadas_max }` sobre as passadas
 * de filtro por quadro (`passadasDeFiltro` do spec). Nos cenários também `longas_max_ms`
 * (maior tarefa longa). Caso pedido que não rodou, cenário que faltou ou campo ausente
 * REPROVA: limite que não mede nada não protege nada.
 */
function conferirLimites(limites, linhas) {
  const reprovas = []
  const porCaso = new Map(linhas.map((r) => [r.caso.id, r]))
  for (const regra of limites.regras) {
    for (const id of regra.casos) {
      const r = porCaso.get(id)
      if (r === undefined) {
        reprovas.push(`${id}: o caso não rodou (mapa real ausente?) [${regra.nome}]`)
        continue
      }
      if (regra.filtro) {
        for (const chave of regra.filtro) {
          const f = r[chave]
          if (!f) reprovas.push(`${id} ${chave}: sem medida [${regra.nome}]`)
          else if (f.passadas_por_quadro > regra.passadas_max) reprovas.push(`${id} ${chave}: ${f.passadas_por_quadro} passadas de filtro por quadro > ${regra.passadas_max} [${regra.nome}]`)
        }
        continue
      }
      if (regra.gpu) {
        for (const chave of regra.gpu) {
          const g = r[chave]
          if (!g) {
            reprovas.push(`${id} ${chave}: sem medida [${regra.nome}]`)
            continue
          }
          if (regra.mb_max !== undefined && g.mb_rgba > regra.mb_max) reprovas.push(`${id} ${chave}: ${g.mb_rgba} MB > ${regra.mb_max} [${regra.nome}]`)
          const lado = Math.max(0, ...(g.maiores ?? []).map((d) => Math.max(...d.split(' ')[0].split('x').map(Number))))
          if (regra.lado_max_px !== undefined && lado > regra.lado_max_px) reprovas.push(`${id} ${chave}: textura de ${lado} px > ${regra.lado_max_px} [${regra.nome}]`)
        }
        continue
      }
      for (const nome of regra.cenarios) {
        for (const papel of regra.papeis) {
          const c = (r.cenarios ?? []).find((x) => x.cenario === nome && x.papel === papel)
          if (c === undefined) {
            reprovas.push(`${id} ${papel} ${nome}: cenário não mediu [${regra.nome}]`)
            continue
          }
          if (regra.fps_min !== undefined && c.fps < regra.fps_min) reprovas.push(`${id} ${papel} ${nome}: ${c.fps} fps < ${regra.fps_min} [${regra.nome}]`)
          if (regra.p95_max_ms !== undefined && c.quadro_p95_ms > regra.p95_max_ms) reprovas.push(`${id} ${papel} ${nome}: p95 ${c.quadro_p95_ms} ms > ${regra.p95_max_ms} [${regra.nome}]`)
          if (regra.longas_max_ms !== undefined && c.longas_max_ms >= regra.longas_max_ms) reprovas.push(`${id} ${papel} ${nome}: tarefa longa de ${c.longas_max_ms} ms >= ${regra.longas_max_ms} [${regra.nome}]`)
        }
      }
    }
  }
  return reprovas
}

main()
