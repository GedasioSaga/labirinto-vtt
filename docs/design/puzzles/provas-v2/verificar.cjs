// Roteiro de navegador do protótipo v2 (Playwright do repo, Edge sem janela).
// Uso (na raiz do repo): node docs/design/puzzles/provas-v2/verificar.cjs [--prints]
// --prints regrava os 5 prints e o medidas.json desta pasta. Tarefa longa é medida desde o carregamento.
const fs = require('fs')
const path = require('path')
const { chromium } = require('C:/dev/labirinto/node_modules/playwright')
const ARQ = 'file:///C:/dev/labirinto/docs/design/puzzles/prototipo-v2.html'
const PROVAS = 'C:/dev/labirinto/docs/design/puzzles/provas-v2'
const PRINTS = process.argv.includes('--prints')
const resultados = []
let pag
const LONGAS = []
function conferir(nome, ok, detalhe = '') { resultados.push({ nome, ok: !!ok, detalhe }); console.log(`${ok ? 'OK ' : 'FALHOU'} ${nome}${detalhe !== '' ? ` :: ${typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)}` : ''}`) }
const est = () => pag.evaluate(() => JSON.parse(localStorage.getItem('lbz2.estado')))
const espera = (ms) => pag.waitForTimeout(ms)
async function print(nome) { if (!PRINTS) return; await pag.waitForFunction(() => !document.querySelector('#aviso.is-visivel'), null, { timeout: 5000 }).catch(() => {}); await espera(450); await pag.screenshot({ path: path.join(PROVAS, nome), type: 'jpeg', quality: 84 }) }
async function aba(v) { await pag.click(`.topo__bt[data-vista="${v}"]`); await espera(200) }
async function instalarMedidor() {
  await pag.exposeFunction('__longa', (d) => LONGAS.push(d))
  await pag.addInitScript(() => {
    const m = window.__med = { quadros: [], rodando: false }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longa(Math.round(e.duration)) }).observe({ type: 'longtask', buffered: true })
    m.ini = () => { m.quadros = []; m.rodando = true; let t0 = performance.now(); const f = (t) => { if (!m.rodando) return; m.quadros.push(t - t0); t0 = t; requestAnimationFrame(f) }; requestAnimationFrame(f) }
    m.fim = () => { m.rodando = false; return m.quadros.slice(1) }
  })
}
const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? +a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))].toFixed(1) : null }

;(async () => {
  fs.mkdirSync(PROVAS, { recursive: true })
  const nav = await chromium.launch({ channel: 'msedge', headless: true })
  pag = await nav.newPage({ viewport: { width: 1440, height: 900 } })
  const erros = []
  pag.on('pageerror', (e) => erros.push(e.message))
  pag.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  await instalarMedidor()
  await pag.goto(ARQ + '#editor')
  await espera(800)
  await pag.evaluate(() => localStorage.clear())
  await pag.reload()

  /* 1. arrastar um encaixe muda a posição salva (e o p95 do quadro durante o arrasto) */
  const antes = (await est()).ed.cfg.encaixes[0]
  const enc = pag.locator('.enc-ed').first()
  const caixa = await enc.boundingBox()
  const q = await pag.locator('[data-ed-quadro]').boundingBox()
  const x0 = caixa.x + caixa.width / 2, y0 = caixa.y + caixa.height / 2
  await pag.evaluate(() => window.__med.ini())
  await pag.mouse.move(x0, y0)
  await pag.mouse.down()
  const PASSOS = 150
  for (let i = 1; i <= PASSOS; i++) {
    const t = i / PASSOS
    await pag.mouse.move(x0 - 140 * Math.sin(t * Math.PI) + 120 * t, y0 + 60 * t + 40 * Math.sin(t * Math.PI * 2))
    await espera(14)
  }
  await pag.mouse.up()
  const quadros = await pag.evaluate(() => window.__med.fim())
  await espera(200)
  const depois = (await est()).ed.cfg.encaixes[0]
  const esperadoX = +(antes.x + (120 / q.width) * 100).toFixed(1), esperadoY = +(antes.y + (60 / q.height) * 100).toFixed(1)
  conferir('Editor: arrastar o encaixe 1 muda a posição guardada', Math.abs(depois.x - esperadoX) < 0.6 && Math.abs(depois.y - esperadoY) < 0.6, { antes: [antes.x, antes.y], depois: [depois.x, depois.y], esperado: [esperadoX, esperadoY] })
  const p95Arrasto = pct(quadros, 95)
  conferir('Editor: p95 do quadro ao arrastar até 20 ms', p95Arrasto !== null && p95Arrasto <= 20, { quadros: quadros.length, p50: pct(quadros, 50), p95: p95Arrasto, max: pct(quadros, 100) })
  // redimensionar pela alça
  const alca = pag.locator('.enc-ed.is-escolhido .alca')
  const ca = await alca.boundingBox()
  await pag.mouse.move(ca.x + ca.width / 2, ca.y + ca.height / 2)
  await pag.mouse.down()
  for (let i = 1; i <= 10; i++) { await pag.mouse.move(ca.x + ca.width / 2 + i * 3, ca.y + ca.height / 2 + i * 3); await espera(16) }
  await pag.mouse.up()
  await espera(150)
  const t1 = (await est()).ed.cfg.encaixes[0].t
  conferir('Editor: a alça do canto muda o tamanho do encaixe', t1 > antes.t, { antes: antes.t, depois: t1 })
  // adicionar e tirar encaixe, e desfazer
  await pag.click('[data-acao="novo-enc"]')
  const n4 = (await est()).ed.cfg.encaixes.length
  await pag.keyboard.press('Delete')
  const n3 = (await est()).ed.cfg.encaixes.length
  await pag.keyboard.press('Control+z')
  const n4b = (await est()).ed.cfg.encaixes.length
  conferir('Editor: adicionar, tirar (Delete) e desfazer (Ctrl+Z) encaixe', n4 === 4 && n3 === 3 && n4b === 4, { n4, n3, n4b })
  await pag.keyboard.press('Delete')
  // cor e texto do modelo
  await pag.fill('[data-campo="inscricao"]', 'Onde a garça bebe')
  await pag.locator('[data-campo="cor"][data-k="objeto"]').evaluate((el) => { el.value = '#c9b28a'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) })
  await espera(400)
  const vis = (await est()).ed.cfg.visual
  const textoNaArte = await pag.locator('[data-ed-quadro] svg text').first().textContent()
  conferir('Editor: cor e texto do modelo mudam a arte', vis.cores.objeto === '#c9b28a' && /Onde a garça bebe/.test(textoNaArte), { cor: vis.cores.objeto, texto: textoNaArte })
  // peça da biblioteca arrastada até um encaixe vira a peça certa
  const pb = await pag.locator('[data-peca-b="joia-safira"]').boundingBox()
  const e2 = await pag.locator('.enc-ed').nth(1).boundingBox()
  await pag.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2)
  await pag.mouse.down()
  for (let i = 1; i <= 12; i++) { await pag.mouse.move(pb.x + pb.width / 2 + ((e2.x + e2.width / 2) - (pb.x + pb.width / 2)) * i / 12, pb.y + pb.height / 2 + ((e2.y + e2.height / 2) - (pb.y + pb.height / 2)) * i / 12); await espera(16) }
  const acende = await pag.locator('.enc-ed').nth(1).evaluate((el) => el.classList.contains('is-pairando-ok'))
  await pag.mouse.up()
  await espera(150)
  const peca2 = (await est()).ed.cfg.encaixes[1].peca
  conferir('Editor: peça arrastada da biblioteca acende o encaixe na pausa e vira a peça certa', acende && peca2 === 'joia-safira', { acende, peca2 })
  await pag.locator('[data-campo="enc-peca"]').nth(1).selectOption('med-sapo')
  await espera(150)
  await print('1-editor-1440.jpg')

  /* 2. salvar o modelo e recarregar mantém */
  await pag.click('[data-acao="salvar-novo"]')
  await espera(150)
  const salvo = (await est()).modelos.find((m) => m.nome === 'Fonte do pátio')
  await pag.reload()
  await aba('meus')
  const card = pag.locator('.cartao-mp', { hasText: 'Fonte do pátio' })
  const ponto = await card.locator('.ponto-enc').first().getAttribute('style')
  const depoisReload = (await est()).modelos.find((m) => m.nome === 'Fonte do pátio')
  conferir('Meus puzzles: o modelo salvo volta igual depois de recarregar (posição do encaixe)', !!salvo && depoisReload.encaixes[0].x === depois.x && depoisReload.encaixes[0].y === depois.y && ponto.includes(`left:${depois.x}%`) && !/d{5}/.test(ponto), { ponto, x: depoisReload?.encaixes[0].x, y: depoisReload?.encaixes[0].y })

  /* 3. testar não dispara o desfecho */
  await card.locator('[data-acao="editar-modelo"]').click()
  await espera(150)
  await pag.locator('[data-campo="desfecho-doc"]').selectOption('d-juramento')
  await pag.fill('[data-campo="novo-item"]', 'Moeda do teste')
  await pag.click('[data-acao="dar-item"]')
  await pag.click('[data-acao="salvar-modelo"]')
  const e0 = await est()
  const fotoJog = JSON.stringify(e0.jogadores), regAntes = e0.registro.length
  await pag.locator('.ed-cab [data-acao="testar"]').click()
  await espera(200)
  const faixa = await pag.locator('[data-faixa-teste]').isVisible()
  const cfgTeste = (await est()).ed.cfg
  for (const en of cfgTeste.encaixes) {
    await pag.click(`[data-pz] .item[data-peca="${en.peca}"]`)
    await pag.click(`[data-pz] .encaixe[data-enc="${en.id}"]`)
    await espera(320)
  }
  await pag.waitForSelector('[data-pz] [data-resultado]', { timeout: 4000 })
  const textoRes = await pag.locator('[data-pz] [data-resultado]').textContent()
  await print('3-testar-resolvido-1440.jpg')
  const e1 = await est()
  conferir('Testar: a faixa "Teste" está na tela', faixa)
  conferir('Testar: resolver no teste não entrega item, documento nem registra', /Resolvido no teste/.test(textoRes) && /Aqui nada foi entregue/.test(textoRes) && JSON.stringify(e1.jogadores) === fotoJog && e1.registro.length === regAntes, { regAntes, regDepois: e1.registro.length, cartao: textoRes.replace(/\s+/g, ' ').slice(0, 160) })

  /* 4. ler o documento no mapa põe na lista e sobrevive ao recarregar */
  await aba('mapa')
  await pag.focus('[data-cena]')
  for (let i = 0; i < 5; i++) { await pag.keyboard.press('ArrowUp'); await espera(60) }
  await pag.keyboard.press('ArrowLeft')
  await espera(150)
  const tocar = await pag.locator('[data-cena] .tocar').textContent()
  await pag.keyboard.press('e')
  await pag.waitForSelector('[data-leitura]')
  await espera(400)
  const titulo = await pag.locator('[data-leitura] .papel__titulo').textContent()
  await print('2-documento-aberto-1440.jpg')
  await pag.keyboard.press('Escape')
  await espera(700)
  await pag.keyboard.press('d')
  await espera(200)
  const lista1 = await pag.locator('.docs-j__titulo').allTextContents()
  await pag.reload()
  await espera(200)
  await pag.keyboard.press('d')
  await espera(200)
  const lista2 = await pag.locator('.docs-j__titulo').allTextContents()
  conferir('Mapa: encostar e tocar (E) abre o papel', /Ler “Bilhete na parede”/.test(tocar) && titulo === 'Bilhete na parede', { tocar, titulo })
  conferir('Mapa: o documento lido entra em Documentos e continua lá depois de recarregar', lista1.some((t) => t.includes('Bilhete na parede')) && lista2.some((t) => t.includes('Bilhete na parede')), { lista1, lista2 })
  await pag.keyboard.press('Escape')

  /* 5. "some depois de pego" tira o papel do mapa */
  await aba('docs')
  await pag.click('[data-acao="escolher-doc"][data-doc="d-carta"]')
  await pag.click('label:has([data-campo="doc-depois"][value="some"])')
  await espera(150)
  const depoisCfg = (await est()).docs.find((d) => d.id === 'd-carta').depois
  await aba('mapa')
  await pag.click('[data-cena] [data-obj="papel"][data-id="d-carta"]', { force: true })
  await pag.waitForFunction(() => /Carta da irmã/.test(document.querySelector('[data-cena] .tocar')?.textContent || ''), null, { timeout: 5000 })
  await pag.keyboard.press('e')
  await pag.waitForSelector('[data-leitura]')
  await espera(300)
  await pag.keyboard.press('ArrowRight')
  await espera(100)
  const pag2 = await pag.locator('[data-leitura] .leitura__pag').textContent()
  await pag.keyboard.press('Escape')
  await espera(700)
  const naCena = await pag.locator('[data-cena] [data-obj="papel"][data-id="d-carta"]').count()
  await pag.reload()
  await espera(200)
  const naCena2 = await pag.locator('[data-cena] [data-obj="papel"][data-id="d-carta"]').count()
  const laraTem = (await est()).jogadores.Lara.docs.some((d) => d.doc === 'd-carta')
  conferir('Documento com 2 páginas: a seta troca para a página 2', /Página 2 de 2/.test(pag2), pag2)
  conferir('Mestre marca "some depois de pego": depois de lido o papel sai do mapa (também depois de recarregar) e fica na lista de quem leu', depoisCfg === 'some' && naCena === 0 && naCena2 === 0 && laraTem, { depoisCfg, naCena, naCena2, laraTem })

  /* 6. "Dar a..." entrega só ao escolhido */
  await aba('docs')
  await pag.click('[data-acao="escolher-doc"][data-doc="d-juramento"]')
  await pag.selectOption('[data-dar-quem]', 'Bento')
  await pag.click('[data-acao="dar-um"]')
  await espera(150)
  const e6 = await est()
  const quem = Object.fromEntries(Object.entries(e6.jogadores).map(([n, j]) => [n, j.docs.some((d) => d.doc === 'd-juramento')]))
  await aba('mapa')
  await pag.click('label:has([data-campo="ver-como"][value="Bento"])')
  await espera(150)
  const novoBento = await pag.locator('[data-bj-novo]').isVisible() ? await pag.locator('[data-bj-novo]').textContent() : ''
  await pag.click('label:has([data-campo="ver-como"][value="Iara"])')
  await espera(150)
  const novoIara = await pag.locator('[data-bj-novo]').isVisible()
  await pag.click('label:has([data-campo="ver-como"][value="Lara"])')
  await espera(150)
  conferir('Mestre "Dar a…" Bento: só o Bento recebe, com o aviso de novo', quem.Bento && !quem.Lara && !quem.Iara && /^1/.test(novoBento.trim()) && !novoIara, { quem, novoBento: novoBento.trim(), novoIara })
  // Dar a todos
  await aba('docs')
  await pag.click('[data-acao="escolher-doc"][data-doc="d-diario"]')
  const todosAntes = (await est()).jogadores

  /* 7. o desfecho do puzzle entrega o documento (cadeia: bilhete com a dica -> cofre -> diário) */
  await aba('mapa')
  await pag.click('[data-cena] [data-obj="puzzle"]', { force: true })
  await pag.waitForFunction(() => /Abrir “Cofre do Capitão”/.test(document.querySelector('[data-cena] .tocar')?.textContent || ''), null, { timeout: 6000 })
  await pag.keyboard.press('e')
  await pag.waitForSelector('[data-pz] [data-roda]')
  const dica = await pag.locator('[data-pz] .pz__dica').textContent()
  const giros = [[3, 'ArrowUp'], [1, 'ArrowUp'], [2, 'ArrowDown']]
  for (let k = 0; k < 3; k++) { await pag.focus(`[data-pz] [data-roda][data-k="${k}"]`); for (let i = 0; i < giros[k][0]; i++) await pag.keyboard.press(giros[k][1]) }
  await pag.click('[data-pz] [data-acao="tentar"]')
  await pag.waitForSelector('[data-pz] [data-doc-ganho]', { timeout: 5000 })
  const ganho = await pag.locator('[data-pz] [data-doc-ganho]').textContent()
  await pag.click('[data-pz] [data-acao="fechar-resultado"]')
  await pag.keyboard.press('Escape')
  await espera(200)
  const badge = await pag.locator('[data-bj-novo]').textContent()
  await pag.keyboard.press('d')
  await espera(250)
  const itemDiario = await pag.locator('.docs-j__item', { hasText: 'Diário do capitão' }).getAttribute('class')
  const e7 = await est()
  const entrada = e7.jogadores.Lara.docs.find((d) => d.doc === 'd-diario')
  conferir('Cadeia: a dica do cofre aponta para o bilhete já lido, com o botão Ler', /Bilhete na parede/.test(dica) && /Ler/.test(dica), dica.replace(/\s+/g, ' ').trim())
  conferir('Cofre resolvido (318) entrega o "Diário do capitão" na lista, marcado como novo', /Diário do capitão/.test(ganho) && /Documento novo/.test(ganho) && entrada?.origem === 'puzzle' && entrada?.novo === true && /is-novo/.test(itemDiario) && /^1/.test(badge.trim()), { ganho: ganho.replace(/\s+/g, ' ').trim(), badge: badge.trim(), entrada })
  await espera(150)
  await print('4-mapa-documentos-1440.jpg')
  // reler da lista tira o "novo"
  await pag.locator('.docs-j__item', { hasText: 'Diário do capitão' }).click()
  await pag.waitForSelector('[data-leitura]')
  await pag.keyboard.press('Escape')
  await espera(300)
  const novoDepois = (await est()).jogadores.Lara.docs.find((d) => d.doc === 'd-diario').novo
  conferir('Reler pela lista tira a marca de novo', novoDepois === false, { novoDepois })

  /* 8. cópia própria em cada lugar: editar a cópia não muda o modelo */
  await aba('meus')
  await pag.locator('.lista-lugares li').first().locator('[data-acao="editar-copia"]').click()
  await espera(150)
  await pag.fill('[data-campo="nome"]', 'Cofre da casa do capitão')
  await pag.click('[data-acao="salvar-copia"]')
  await espera(150)
  const e8 = await est()
  const modeloCofre = e8.modelos.find((m) => m.nome === 'Cofre do Capitão')
  conferir('Editar a cópia do lugar não muda o modelo', e8.lugares[0].cfg.nome === 'Cofre da casa do capitão' && !!modeloCofre, { copia: e8.lugares[0].cfg.nome, modelo: modeloCofre?.nome })
  await aba('meus')
  const marca = await pag.locator('.lista-lugares li').first().textContent()
  conferir('Meus puzzles mostra que a cópia mudou só no lugar', /mudada só aqui/.test(marca), marca.replace(/\s+/g, ' ').trim().slice(0, 140))

  /* 8b. imagem própria: fundo do puzzle, peça nova e papel do documento (arquivo local, sem rede) */
  const png = Buffer.from((await pag.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#5b6b4a'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#d9c9a0'; g.beginPath(); g.arc(160, 100, 60, 0, 7); g.fill(); return c.toDataURL('image/png') })).split(',')[1], 'base64')
  const arquivo = { name: 'minha-arte.png', mimeType: 'image/png', buffer: png }
  await aba('editor')
  await pag.click('[data-acao="novo-rascunho"]')
  await pag.setInputFiles('[data-campo="imagem"]', arquivo)
  await pag.waitForSelector('[data-ed-quadro] img', { timeout: 4000 })
  await pag.click('[data-acao="novo-enc"]')
  await pag.click('[data-acao="novo-enc"]')
  await pag.setInputFiles('[data-campo="peca-img"]', arquivo)
  await espera(300)
  await pag.fill('[data-campo="peca-nome"]', 'Selo do capitão')
  await espera(400)
  const e8b = await est()
  const propria = Object.values(e8b.pecasProprias)
  conferir('Imagem própria: vira o fundo do puzzle e recebe encaixes novos; peça nova com imagem e nome entra na biblioteca', e8b.ed.cfg.visual.tipo === 'imagem' && e8b.ed.cfg.encaixes.length >= 2 && propria.some((p) => p.nome === 'Selo do capitão' && /^data:image/.test(p.img)), { visual: e8b.ed.cfg.visual.tipo, encaixes: e8b.ed.cfg.encaixes.length, pecas: propria.map((p) => p.nome) })
  await aba('docs')
  await pag.click('[data-acao="escolher-doc"][data-doc="d-juramento"]')
  await pag.click('label:has([data-campo="doc-papel"][value="imagem"])')
  await pag.setInputFiles('[data-campo="doc-papel-img"]', arquivo)
  await espera(300)
  const papelImg = await pag.locator('[data-previa] .papel--imagem').count()
  conferir('Documento com papel de imagem própria aparece na prévia', papelImg === 1 && /^data:image/.test((await est()).docs.find((d) => d.id === 'd-juramento').imagemPapel || ''), { papelImg })
  await pag.click('label:has([data-campo="doc-papel"][value="pergaminho"])')

  /* 8c. movimento reduzido: abrir o papel só com opacidade */
  await aba('mapa')
  await pag.check('#rm')
  await pag.keyboard.press('d')
  await espera(150)
  await pag.locator('.docs-j__item').first().click()
  const anims = await pag.evaluate(() => document.getAnimations().map((a) => a.effect.getKeyframes().some((k) => k.transform && k.transform !== 'none')))
  await pag.waitForSelector('[data-leitura]')
  await pag.keyboard.press('Escape')
  await espera(300)
  const classeRm = await pag.evaluate(() => document.documentElement.classList.contains('rm'))
  conferir('Movimento reduzido: o papel abre só com opacidade, nada se move', classeRm && anims.length > 0 && !anims.some(Boolean), { classeRm, animacoes: anims.length, comTransform: anims.filter(Boolean).length })
  await pag.uncheck('#rm')

  /* 9. layout a 1024 */
  await pag.setViewportSize({ width: 1024, height: 768 })
  await aba('docs')
  await pag.click('[data-acao="escolher-doc"][data-doc="d-bilhete"]')
  await espera(200)
  await print('5-documentos-mestre-1024.jpg')
  const transborda = await pag.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  conferir('1024: a página Documentos (mestre) não vaza na largura', !transborda)
  for (const v of ['editor', 'meus', 'testar', 'mapa']) { await aba(v); const t = await pag.evaluate(() => document.documentElement.scrollWidth > innerWidth); conferir(`1024: a aba ${v} não vaza na largura`, !t) }

  const longas = LONGAS
  conferir('Nenhuma tarefa longa de 200 ms ou mais em todo o roteiro', !longas.some((l) => l >= 200), { longas })
  conferir('Nenhum erro no console', erros.length === 0, erros)
  const falhas = resultados.filter((r) => !r.ok).length
  const medidas = {
    data: new Date().toISOString(), navegador: 'Microsoft Edge (Playwright, sem janela)', viewport: '1440x900 e 1024x768',
    desempenho: { arrasto: { quadros: quadros.length, p50: pct(quadros, 50), p95: p95Arrasto, p99: pct(quadros, 99), max: pct(quadros, 100) }, tarefasLongas: longas.length, maiorTarefaLonga: longas.length ? Math.max(...longas) : 0, longas },
    conferencias: resultados.length, falhas, resultados,
  }
  if (PRINTS) fs.writeFileSync(path.join(PROVAS, 'medidas.json'), JSON.stringify(medidas, null, 1))
  console.log(`\n${resultados.length - falhas}/${resultados.length} ok · p95 arrasto ${p95Arrasto} ms · tarefas longas ${JSON.stringify(longas)}`)
  await nav.close()
  process.exit(falhas ? 1 : 0)
})().catch(async (e) => { console.error('ERRO NO ROTEIRO:', e.message.split('\n').slice(0, 6).join('\n')); console.log(JSON.stringify(resultados.map((r) => [r.ok, r.nome]))); process.exit(2) })
