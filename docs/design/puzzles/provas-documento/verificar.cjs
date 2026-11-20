// Roteiro de navegador do protótipo D0, os 4 extras do documento (Playwright da raiz do repo, Edge sem janela).
// Uso (na raiz do repo): node docs/design/puzzles/provas-documento/verificar.cjs [--prints]
// --prints regrava os 4 prints e o medidas.json desta pasta. Tarefa longa é medida desde o carregamento.
const fs = require('fs')
const path = require('path')
const { chromium } = require('C:/dev/labirinto/node_modules/playwright')
const ARQ = 'file:///C:/dev/labirinto/docs/design/puzzles/prototipo-documento-extras.html'
const PROVAS = 'C:/dev/labirinto/docs/design/puzzles/provas-documento'
const PRINTS = process.argv.includes('--prints')
const resultados = []
const medidas = {}
const LONGAS = []
let pag
function conferir(nome, ok, detalhe = '') { resultados.push({ nome, ok: !!ok, detalhe }); console.log(`${ok ? 'OK ' : 'FALHOU'} ${nome}${detalhe !== '' ? ` :: ${typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)}` : ''}`) }
const est = () => pag.evaluate(() => JSON.parse(localStorage.getItem('lbdx.estado')))
const espera = (ms) => pag.waitForTimeout(ms)
async function print(nome) { if (!PRINTS) return; await pag.waitForFunction(() => !document.querySelector('#aviso.is-visivel'), null, { timeout: 5000 }).catch(() => {}); await espera(450); await pag.screenshot({ path: path.join(PROVAS, nome), type: 'jpeg', quality: 84 }) }
async function aba(v) { await pag.click(`.topo__bt[data-vista="${v}"]`); await espera(150) }
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
const previa = () => pag.$eval('[data-previa]', (e) => e.innerHTML)
async function zerar() { await pag.click('[data-acao="zerar"]'); await espera(150) }
async function escolherDoc(id) { await pag.click(`[data-acao="escolher-doc"][data-doc="${id}"]`); await espera(80) }
const rotulo = (sel) => `label:has(> ${sel})`
async function verComo(v) {
  const atual = await pag.evaluate(() => window.__prototipo.estado().ui.verComo)
  if (atual !== v) { await pag.click(rotulo(`input[data-campo="v-como"][value="${v}"]`)); await espera(60) }
}
// O DOM do que o jogador vê: a tela inteira (palco, leitor, aviso), menos o <script> do protótipo, que faz o papel do host e guarda o claro.
async function textoDoLeitor() { return pag.evaluate(() => { const l = document.querySelector('[data-leitura]'); if (!l) return null; const c = document.body.cloneNode(true); c.querySelectorAll('script').forEach((s) => s.remove()); return { html: c.outerHTML, texto: document.body.innerText } }) }
async function fecharLeitor() { await pag.keyboard.press('Escape'); await espera(260) }
async function esperarDecifrar() { await pag.waitForFunction(() => !document.querySelector('[data-leitura] .is-decifrando'), null, { timeout: 4000 }).catch(() => {}); await espera(80) }

;(async () => {
  fs.mkdirSync(PROVAS, { recursive: true })
  const nav = await chromium.launch({ channel: 'msedge', headless: true })
  pag = await nav.newPage({ viewport: { width: 1440, height: 900 } })
  const erros = []
  pag.on('pageerror', (e) => erros.push(e.message))
  pag.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  await instalarMedidor()
  await pag.goto(ARQ + '#mestre')
  await espera(500)
  await pag.evaluate(() => localStorage.clear())
  await pag.reload()
  await espera(500)
  const png = Buffer.from(await pag.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d'); g.fillStyle = '#7a3b1c'; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e9d39a'; g.fillRect(24, 14, 16, 36)
    return c.toDataURL('image/png').split(',')[1]
  }), 'base64')
  const arquivoPng = { name: 'brasao.png', mimeType: 'image/png', buffer: png }

  /* 1. cada opção da ficha muda a prévia (rádios e caixas, nos 4 documentos) */
  const ESTRUTURAIS = new Set(['doc-papel', 'x-selo', 'x-brasao', 't-mostra'])
  const vistos = new Set(), testados = new Set(), semEfeito = []
  for (const docId of ['d-ordem', 'd-porao', 'd-diario', 'd-juramento']) {
    await escolherDoc(docId)
    for (let volta = 0; volta < 160; volta++) {
      const ctrls = await pag.$$eval('[data-ficha-doc] input[type=radio], [data-ficha-doc] input[type=checkbox]', (els) => els.map((e) => ({ campo: e.dataset.campo, t: e.dataset.t || '', k: e.dataset.k || '', item: e.dataset.item || '', value: e.value, tipo: e.type, checked: e.checked })))
      const chave = (c) => [c.campo, c.t, c.k, c.item, c.tipo === 'radio' ? c.value : (c.checked ? 'desmarcar' : 'marcar')].join('|')
      const testaveis = ctrls.filter((c) => c.tipo === 'checkbox' || !c.checked)
      testaveis.forEach((c) => vistos.add(chave(c)))
      const prox = testaveis.filter((c) => !testados.has(chave(c))).sort((a, b) => (ESTRUTURAIS.has(a.campo) ? 1 : 0) - (ESTRUTURAIS.has(b.campo) ? 1 : 0))[0]
      if (!prox) break
      testados.add(chave(prox))
      await verComo(prox.campo === 't-chave' ? prox.item : 'nada')
      const sel = `[data-ficha-doc] input[data-campo="${prox.campo}"]${prox.t ? `[data-t="${prox.t}"]` : ''}${prox.k ? `[data-k="${prox.k}"]` : ''}${prox.item ? `[data-item="${prox.item}"]` : ''}${prox.tipo === 'radio' ? `[value="${prox.value}"]` : ''}`
      const antes = await previa()
      await pag.click(rotulo(sel.replace('[data-ficha-doc] ', '')))
      await espera(40)
      if (prox.campo === 'x-brasao' && prox.value === 'imagem') { await pag.setInputFiles('[data-campo="x-brasao-img"]', arquivoPng); await espera(350) }
      if (prox.campo === 'doc-papel' && prox.value === 'imagem') { await pag.setInputFiles('[data-campo="doc-papel-img"]', { ...arquivoPng, name: 'papel.png' }); await espera(350) }
      const depois = await previa()
      if (antes === depois) semEfeito.push(chave(prox))
    }
  }
  const naoTestados = [...vistos].filter((k) => !testados.has(k))
  conferir('Ficha: cada opção (rádio e caixa) muda a prévia', semEfeito.length === 0 && naoTestados.length === 0, { mudaram: `${testados.size - semEfeito.length} de ${testados.size}`, semEfeito, naoTestados })
  const campos = [...new Set([...testados].map((k) => k.split('|')[0]))].sort()
  conferir('Ficha: o teste passou por todos os grupos de opção', ['doc-papel', 't-chave', 't-mostra', 'x-brasao', 'x-brasao-arte', 'x-cor', 'x-desgaste', 'x-letra', 'x-manchas', 'x-selo', 'x-selo-arte', 'x-selo-cor', 'x-tinta'].every((c) => campos.includes(c)), campos.join(', '))

  /* 2. campos de texto e os botões Cifrar / Borrar */
  await zerar()
  await escolherDoc('d-ordem')
  await verComo('nada')
  await pag.fill('[data-campo="doc-titulo"]', 'Ordem da Guarda nº 48')
  await espera(60)
  conferir('Texto: o título muda a prévia', (await previa()).includes('Ordem da Guarda nº 48'))
  await pag.fill('[data-campo="x-assinatura"]', 'Ten. Rosa Bravo')
  await espera(60)
  conferir('Texto: a assinatura aparece no fim da prévia', await pag.$eval('[data-previa] .papel__assinatura', (e) => e.textContent.trim()).catch(() => '') === 'Ten. Rosa Bravo')
  await pag.fill('[data-campo="x-assinatura"]', '')
  await espera(60)
  conferir('Texto: assinatura vazia some da prévia', !(await pag.$('[data-previa] .papel__assinatura')))
  await pag.fill('[data-campo="x-selo-texto"]', 'Porto de Água Fria')
  await espera(60)
  conferir('Texto: o texto do carimbo muda a prévia', (await previa()).includes('PORTO DE ÁGUA FRIA'))
  await pag.fill('[data-campo="t-cifrado"][data-t="c1"]', 'XQV ZZT PLO')
  await espera(60)
  conferir('Texto: o código digitado é o que vê quem não tem o item', (await previa()).includes('XQV ZZT PLO'))
  await verComo('cifra')
  await pag.fill('[data-campo="t-claro"][data-t="c1"]', 'lua cheia no moinho')
  await espera(60)
  const comCifra = await previa()
  await verComo('nada')
  const semCifra = await previa()
  conferir('Texto: o texto claro novo só aparece para quem tem a chave', comCifra.includes('lua cheia no moinho') && !semCifra.includes('lua cheia no moinho'))
  const textoPag = '[data-campo="pag-texto"][data-k="0"]'
  await pag.focus(textoPag)
  await pag.keyboard.press('Control+End')
  await pag.keyboard.type(' Posto da ponte.')
  await espera(60)
  conferir('Texto: digitar na página muda a prévia', (await previa()).includes('Posto da ponte.'))

  await escolherDoc('d-porao')
  const selecionar = (frase) => pag.evaluate(([s, f]) => { const ta = document.querySelector(s); const a = ta.value.indexOf(f); ta.focus(); ta.setSelectionRange(a, a + f.length) }, [textoPag, frase])
  await selecionar('com a voz da minha mãe')
  await pag.click('[data-acao="proteger"][data-tipo="cifra"][data-k="0"]')
  await espera(80)
  let s = (await est()).docs.find((d) => d.id === 'd-porao')
  const novo = Object.entries(s.trechos).find(([, t]) => t.claro === 'com a voz da minha mãe')
  conferir('Cifrar: o trecho selecionado vira um trecho cifrado', !!novo && s.paginas[0].texto.includes(`{{cifra:${novo?.[0]}}}`), novo ? novo[0] : 'nada criado')
  conferir('Cifrar: sem o item, a prévia não mostra o trecho', !(await previa()).includes('voz da minha mãe') && !!(await pag.$('[data-previa] .trecho--cifra')))
  await selecionar('meu nome')
  await pag.click('[data-acao="proteger"][data-tipo="borrado"][data-k="0"]')
  await espera(80)
  s = (await est()).docs.find((d) => d.id === 'd-porao')
  conferir('Borrar: o trecho selecionado vira tinta borrada', Object.values(s.trechos).some((t) => t.tipo === 'borrado' && t.claro === 'meu nome') && !(await previa()).includes('meu nome'))
  await pag.keyboard.press('Control+z')
  await espera(120)
  conferir('Borrar: Ctrl+Z no texto devolve as palavras', (await pag.inputValue(textoPag)).includes('meu nome') && (await previa()).includes('meu nome'))
  await pag.click(`[data-acao="t-desfazer"][data-t="${novo?.[0]}"]`)
  await espera(80)
  s = (await est()).docs.find((d) => d.id === 'd-porao')
  conferir('Desfazer: o trecho cifrado volta a ser texto comum', s.paginas[0].texto.includes('com a voz da minha mãe') && !s.trechos[novo?.[0]])
  await selecionar('Ele ainda escuta.')
  await pag.click('[data-acao="proteger"][data-tipo="cifra"][data-k="0"]')
  await espera(80)

  /* 3. guardar e reabrir mantém tudo */
  await pag.click(rotulo('input[data-campo="x-selo"][value="cera"]'))
  await pag.click(rotulo('input[data-campo="x-brasao"][value="desenho"]'))
  await pag.fill('[data-campo="x-assinatura"]', 'Uma vizinha')
  await espera(400)
  const docAntes = (await est()).docs.find((d) => d.id === 'd-porao')
  const previaAntes = await previa()
  const marcadosAntes = await pag.$$eval('[data-ficha-doc] input:checked', (els) => els.map((e) => `${e.dataset.campo}|${e.dataset.t || ''}|${e.dataset.k || ''}|${e.dataset.item || ''}|${e.value}`))
  await pag.reload()
  await espera(500)
  await escolherDoc('d-porao')
  const docDepois = (await est()).docs.find((d) => d.id === 'd-porao')
  const marcadosDepois = await pag.$$eval('[data-ficha-doc] input:checked', (els) => els.map((e) => `${e.dataset.campo}|${e.dataset.t || ''}|${e.dataset.k || ''}|${e.dataset.item || ''}|${e.value}`))
  conferir('Guardar: depois de recarregar, o documento é o mesmo', JSON.stringify(docAntes) === JSON.stringify(docDepois))
  conferir('Guardar: depois de recarregar, a prévia é a mesma', previaAntes === (await previa()))
  conferir('Guardar: depois de recarregar, a ficha marca as mesmas opções', JSON.stringify(marcadosAntes) === JSON.stringify(marcadosDepois), `${marcadosDepois.length} opções marcadas`)

  /* 4. o jogador sem nenhum item: o texto claro de nenhum trecho cifrado chega ao leitor */
  await zerar()
  const docs = (await est()).docs
  const claros = docs.flatMap((d) => Object.entries(d.trechos).filter(([, t]) => t.tipo === 'cifra').map(([id, t]) => ({ doc: d.id, id, claro: t.claro, chaves: t.chaves })))
  const borrados = docs.flatMap((d) => Object.entries(d.trechos).filter(([, t]) => t.tipo === 'borrado').map(([id, t]) => ({ doc: d.id, id, claro: t.claro })))
  const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const aparece = (pg, t) => pg.html.includes(t) || pg.html.includes(escapar(t)) || pg.texto.includes(t)
  async function lerTudo(docId, cada) {
    await pag.click(`[data-acao="ler-doc"][data-doc="${docId}"]`)
    await espera(60)
    const n = (await est()).docs.find((d) => d.id === docId).paginas.length
    for (let p = 0; p < n; p++) {
      if (p > 0) { await pag.keyboard.press('ArrowRight'); await espera(60) }
      await cada(p)
    }
    await fecharLeitor()
  }
  await aba('jogador')
  const vazamentos = []
  let paginasLidas = 0, cifrasVistas = 0
  for (const d of docs) {
    await lerTudo(d.id, async () => {
      paginasLidas++
      await esperarDecifrar()
      const pg = await textoDoLeitor()
      cifrasVistas += await pag.$$eval('[data-leitura] .trecho--cifra', (e) => e.length)
      for (const c of [...claros, ...borrados]) if (aparece(pg, c.claro)) vazamentos.push(`${d.id}: ${c.id}`)
    })
  }
  conferir('Sem item: nenhum texto claro no DOM do leitor (HTML e texto visível)', vazamentos.length === 0 && paginasLidas === 5, { paginasLidas, trechosFechados: cifrasVistas, vazamentos })
  conferir('Sem item: a lista Documentos e a mochila vazia', await pag.$eval('[data-mochila]', (e) => e.textContent.trim()) === 'Nenhum item que ajude a ler.')

  /* 5. só a lente: lê o trecho da lente, os outros continuam fechados */
  await pag.evaluate(() => { window.__sw = document.querySelector('[data-acao="item"][data-item="lente"]') })
  await pag.click('[data-acao="item"][data-item="lente"]')
  await espera(30)
  const bolinha = await pag.evaluate(() => ({ mesmo: window.__sw.isConnected, anima: window.__sw.querySelector('.interruptor__trilho').getAnimations({ subtree: true }).length > 0 }))
  await espera(200)
  conferir('Interruptor: a lente entra na mochila', (await pag.$eval('[data-mochila]', (e) => e.textContent)).includes('Lente de leitura') && (await pag.getAttribute('[data-acao="item"][data-item="lente"]', 'aria-checked')) === 'true')
  conferir('Interruptor: troca no lugar e a bolinha desliza', bolinha.mesmo && bolinha.anima, bolinha)
  const lidosLente = [], fechadosLente = []
  for (const d of docs) {
    await lerTudo(d.id, async () => {
      await esperarDecifrar()
      const pg = await textoDoLeitor()
      for (const c of claros.filter((x) => x.doc === d.id)) {
        const naPagina = d.paginas.findIndex((p) => p.texto.includes(`{{cifra:${c.id}}}`))
        const atual = await pag.$eval('[data-leitura] .leitura__pag', (e) => +e.textContent.match(/\d+/)[0] - 1).catch(() => 0)
        if (naPagina !== atual) continue
        ;(aparece(pg, c.claro) ? lidosLente : fechadosLente).push(c.id)
      }
    })
  }
  conferir('Só a lente: lê o trecho que pede a lente (c2) e não lê c1 nem c3', lidosLente.join() === 'c2' && fechadosLente.sort().join() === 'c1,c3', { lidos: lidosLente, fechados: fechadosLente })
  const decifrados = (await est()).jogador.decifrados
  await pag.click('[data-acao="ler-doc"][data-doc="d-diario"]')
  await espera(120)
  const animouDeNovo = !!(await pag.$('[data-leitura] .is-decifrando'))
  await fecharLeitor()
  conferir('Decifrar: a animação roda só na primeira leitura', JSON.stringify(decifrados) === '{"d-diario":["c2"]}' && !animouDeNovo, decifrados)

  /* 6. os três itens: tudo legível; o borrado continua impossível de ler */
  await pag.click('[data-acao="item"][data-item="dicionario"]')
  await pag.click('[data-acao="item"][data-item="cifra"]')
  await espera(80)
  const faltando = []
  let borradoInfo = null
  for (const d of docs) {
    await lerTudo(d.id, async (p) => {
      await esperarDecifrar()
      const pg = await textoDoLeitor()
      for (const c of claros.filter((x) => x.doc === d.id && d.paginas[p].texto.includes(`{{cifra:${x.id}}}`))) if (!pg.texto.includes(c.claro)) faltando.push(c.id)
      for (const b of borrados.filter((x) => x.doc === d.id && d.paginas[p].texto.includes(`{{borrado:${x.id}}}`))) {
        borradoInfo = await pag.$eval(`[data-leitura] [data-borrado="${b.id}"]`, (e) => {
          const cs = getComputedStyle(e)
          const blur = [...cs.textShadow.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)].map((m) => +m[3])
          return { texto: e.textContent, cor: cs.color, blurMax: Math.max(0, ...blur), ariaHidden: e.getAttribute('aria-hidden'), sr: e.nextElementSibling?.classList.contains('sr') ? e.nextElementSibling.textContent : null, selecao: cs.userSelect }
        })
        borradoInfo.claroNoDom = aparece(pg, b.claro)
        borradoInfo.mesmoTamanho = borradoInfo.texto.length === b.claro.length
      }
    })
  }
  conferir('Com os três itens: todo trecho cifrado aparece em texto claro', faltando.length === 0, { trechos: claros.map((c) => c.id), faltando })
  const bi = borradoInfo || {}
  conferir('Borrado: o texto claro não está no DOM, nem com todos os itens', bi.claroNoDom === false, bi.texto)
  conferir('Borrado: a tinta é transparente com desfoque de 4px ou mais', bi.cor === 'rgba(0, 0, 0, 0)' && bi.blurMax >= 4, { cor: bi.cor, desfoqueMaior: bi.blurMax })
  conferir('Borrado: escondido do leitor de tela, com aviso no lugar, sem seleção', bi.ariaHidden === 'true' && /borrado/.test(bi.sr || '') && bi.selecao === 'none', { sr: bi.sr })
  await aba('mestre')
  await escolherDoc('d-diario')
  for (const v of ['lente', 'dicionario', 'cifra']) { await verComo(v); if ((await previa()).includes(borrados[0].claro)) bi.naPrevia = v }
  conferir('Borrado: a prévia do mestre também não mostra o claro, em nenhum "Quem lê tem"', !bi.naPrevia)

  /* 7. medida: o quadro durante a decifração (o Juramento, com o dicionário) */
  await aba('jogador')
  await pag.click('[data-acao="esquecer"]')
  await espera(80)
  await pag.evaluate(() => window.__med.ini())
  await pag.click('[data-acao="ler-doc"][data-doc="d-juramento"]')
  await espera(560)
  const meio = await pag.$eval('[data-leitura] .trecho--lido[data-trecho="c3"]', (e) => ({ decifrando: e.classList.contains('is-decifrando'), texto: e.textContent }))
  await espera(1100)
  const quadros = await pag.evaluate(() => window.__med.fim())
  const fimTexto = await pag.$eval('[data-leitura] .trecho--lido[data-trecho="c3"]', (e) => e.textContent)
  const c3 = claros.find((c) => c.id === 'c3').claro
  conferir('Decifrar: no meio, o trecho está trocando letras; no fim, é o texto claro', meio.decifrando && meio.texto !== c3 && fimTexto === c3, { meio: meio.texto })
  medidas.decifrar = { quadros: quadros.length, p50: pct(quadros, 50), p95: pct(quadros, 95), max: pct(quadros, 100) }
  conferir('Decifrar: p95 do quadro até 20 ms', medidas.decifrar.p95 !== null && medidas.decifrar.p95 <= 20, medidas.decifrar)
  await fecharLeitor()
  conferir('Teclado: Esc fecha o leitor e o foco volta ao documento', !(await pag.$('[data-leitura]')) && (await pag.evaluate(() => document.activeElement?.dataset?.doc)) === 'd-juramento')
  await pag.keyboard.press('Enter')
  await espera(20)
  const abrirTeclado = await pag.evaluate(() => ({ aberto: !!document.querySelector('[data-leitura]'), animacoes: document.querySelector('[data-rolo]')?.getAnimations().length ?? -1 }))
  await pag.keyboard.press('Escape')
  await espera(20)
  conferir('Teclado: Enter abre e Esc fecha o papel sem animar (ação de teclado)', abrirTeclado.aberto && abrirTeclado.animacoes === 0 && !(await pag.$('[data-leitura]')), abrirTeclado)

  /* 8. movimento reduzido: troca direta, sem animar */
  await pag.click('[data-acao="esquecer"]')
  await pag.check('#rm')
  await pag.click('[data-acao="ler-doc"][data-doc="d-juramento"]')
  await espera(40)
  const rm = await pag.$eval('[data-leitura] .trecho--lido[data-trecho="c3"]', (e) => ({ decifrando: e.classList.contains('is-decifrando'), texto: e.textContent }))
  conferir('Movimento reduzido: o texto claro aparece direto, sem a troca de letras', !rm.decifrando && rm.texto === c3)
  await fecharLeitor()
  await pag.uncheck('#rm')

  /* 9. prints em 1440 */
  await pag.click('[data-acao="item"][data-item="dicionario"]')
  await pag.click('[data-acao="item"][data-item="cifra"]')
  await pag.click('[data-acao="esquecer"]')
  await aba('mestre')
  await escolherDoc('d-ordem')
  await verComo('nada')
  await pag.$eval('[data-pagina]', (e) => { const h = [...e.querySelectorAll('.ficha h3')].find((x) => x.textContent.startsWith('Letra e tinta')); e.scrollTop = h ? h.closest('.ficha').offsetTop - 60 : 0 })
  await print('1-ficha-mestre-1440.jpg')
  await aba('exemplos')
  await print('2-exemplos-1440.jpg')
  await aba('jogador')
  await pag.click('[data-acao="ler-doc"][data-doc="d-diario"]')
  await espera(1500)
  await print('3-leitor-decifrado-1440.jpg')
  await fecharLeitor()

  /* 10. 1024: nenhuma aba transborda */
  await pag.setViewportSize({ width: 1024, height: 768 })
  await espera(200)
  const transborda = async () => pag.evaluate(() => {
    const ruins = []
    if (document.documentElement.scrollWidth > innerWidth + 1) ruins.push(`página ${document.documentElement.scrollWidth}px`)
    for (const s of ['[data-pagina]', '.painel', '.pagina', '.gaveta-j__corpo', '.leitura__rolo', '.mochila-j', '.bancada', '.cartao-ex__corpo']) for (const e of document.querySelectorAll(s)) if (e.scrollWidth > e.clientWidth + 1) ruins.push(`${s} ${e.scrollWidth}>${e.clientWidth}`)
    const pv = document.querySelector('.previa'), pp = document.querySelector('.previa .papel')
    if (pv && pp) { const a = pv.getBoundingClientRect(), b = pp.getBoundingClientRect(); if (b.left < a.left - 1 || b.right > a.right + 1) ruins.push('papel cortado na prévia') }
    for (const e of document.querySelectorAll('.topo__bt, .bt, .interruptor')) if (e.getBoundingClientRect().right > innerWidth) ruins.push(`fora da tela: ${e.textContent.trim().slice(0, 30)}`)
    return ruins
  })
  for (const v of ['mestre', 'exemplos', 'jogador']) {
    await aba(v)
    if (v === 'mestre') for (const id of ['d-ordem', 'd-porao', 'd-diario', 'd-juramento']) { await escolherDoc(id); const r = await transborda(); if (r.length) { conferir(`1024: ficha de ${id} sem transbordar`, false, r) } }
    conferir(`1024: aba ${v} sem transbordar`, (await transborda()).length === 0, (await transborda()).join('; '))
  }
  await pag.click('[data-acao="ler-doc"][data-doc="d-juramento"]')
  await espera(1400)
  conferir('1024: leitor aberto sem transbordar', (await transborda()).length === 0, (await transborda()).join('; '))
  await fecharLeitor()
  await aba('mestre')
  await escolherDoc('d-diario')
  await verComo('lente')
  await print('4-ficha-mestre-1024.jpg')

  /* 11. tarefa longa e console */
  await espera(300)
  medidas.tarefaLongaMaior = LONGAS.length ? Math.max(...LONGAS) : 0
  medidas.tarefasLongas = LONGAS.length
  conferir('Nenhuma tarefa longa de 200 ms ou mais desde o carregamento', medidas.tarefaLongaMaior < 200, { quantas: LONGAS.length, maior: medidas.tarefaLongaMaior })
  conferir('Nenhum erro no console', erros.length === 0, erros.slice(0, 5))

  const falhas = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - falhas.length} de ${resultados.length} conferências passaram.`)
  if (PRINTS) fs.writeFileSync(path.join(PROVAS, 'medidas.json'), JSON.stringify({ quando: new Date().toISOString(), navegador: 'msedge headless 1440x900 e 1024x768', medidas, resultados }, null, 2))
  await nav.close()
  process.exit(falhas.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
