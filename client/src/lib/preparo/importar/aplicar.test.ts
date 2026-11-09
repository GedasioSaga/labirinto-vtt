/**
 * PRELÚDIO F2a: o "Aplicar" da importação do Grimório, de verdade, contra um
 * cofre INVENTADO (`cofreDeTeste.ts`) e um disco em memória no lugar do
 * `<appData>`. O repositório é público: nenhum dado real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARQUIVO_DAS_LIGACOES, ARQUIVO_DO_INDICE, type ArquivoDoPreparo } from '../tipos'
import { COM_ESPACO, CRIADO, cofreFalso, cofreInventado, json, png, type Conteudo } from './cofreDeTeste'
import { MINIMO_QUE_SOBRA_BYTES } from './relatorio'

const APPDATA = 'C:/Users/teste/AppData/Roaming/labirinto'
const PREPARO = `${APPDATA}/preparo`
/** O disco do app, em memória: caminho → conteúdo. */
const disco = new Map<string, string | Uint8Array>()
const pastasCriadas = new Set<string>()

function existe(caminho: string): boolean {
  if (disco.has(caminho) || pastasCriadas.has(caminho)) return true
  return [...disco.keys(), ...pastasCriadas].some((chave) => chave.startsWith(`${caminho}/`))
}

function listar(caminho: string): { name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }[] {
  const prefixo = `${caminho}/`
  const filhos = new Map<string, boolean>()
  for (const chave of disco.keys()) {
    if (!chave.startsWith(prefixo)) continue
    const [nome, ...resto] = chave.slice(prefixo.length).split('/')
    filhos.set(nome, (filhos.get(nome) ?? false) || resto.length > 0)
  }
  for (const pasta of pastasCriadas) if (pasta.startsWith(prefixo)) filhos.set(pasta.slice(prefixo.length).split('/')[0], true)
  return [...filhos].map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
}

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...partes: string[]) => partes.join('/')),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (caminho: string) => existe(caminho)),
  mkdir: vi.fn(async (caminho: string) => {
    pastasCriadas.add(caminho)
  }),
  readDir: vi.fn(async (caminho: string) => listar(caminho)),
  readTextFile: vi.fn(async (caminho: string) => {
    const conteudo = disco.get(caminho)
    if (typeof conteudo !== 'string') throw new Error(`não existe texto em ${caminho}`)
    return conteudo
  }),
  writeTextFile: vi.fn(async (caminho: string, conteudo: string) => {
    disco.set(caminho, conteudo)
  }),
  writeFile: vi.fn(async (caminho: string, conteudo: Uint8Array) => {
    disco.set(caminho, conteudo)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const conteudo = disco.get(de)
    if (conteudo === undefined) throw new Error(`não existe: ${de}`)
    disco.set(para, conteudo)
    disco.delete(de)
  }),
  remove: vi.fn(async (caminho: string) => {
    disco.delete(caminho)
  }),
}))

const { FEATURES } = await import('../../features')
const { LUGARES, gravarNoPreparo, gravarRevelado, gravarVerbete, lerDoPreparo, lerIndiceDoPreparo, lerVerbete } = await import('../disco')
const { alvoDaSecao, alvoDoVerbete } = await import('../revelado')
const { aplicarImportacao, RecusaDaImportacao } = await import('./aplicar')
const { lerPreludio } = await import('./noPreludio')
const { simularImportacao } = await import('./simular')

const LIGADO = { ...FEATURES, preparo: true }
const AGORA = new Date('2026-11-08T12:00:00.000Z')
const PASTA_DA_IMPORTACAO = `${PREPARO}/importacoes/2026-11-08T12-00-00Z`

async function fotoDoPreludio() {
  const leitura = await lerPreludio(LIGADO)
  if (!leitura.ok) throw new Error(`o Prelúdio devia abrir: ${leitura.problemas.join(' ')}`)
  return leitura.foto
}

/** O caminho completo do mestre na tela: lê o Prelúdio, simula com o que já existe e aplica. */
async function simularEAplicar(arquivos: Readonly<Record<string, Conteudo>>, pastas: ReadonlyMap<string, string | null> = new Map()) {
  const foto = await fotoDoPreludio()
  const falso = cofreFalso(arquivos)
  const resultado = await simularImportacao(falso.leitor, { ...COM_ESPACO, existentes: foto.vazio ? undefined : foto.noPreludio, midiasNoPreludio: foto.midias })
  const resumo = await aplicarImportacao(resultado, falso.leitor, { foto, pastas, espacoLivreBytes: COM_ESPACO.espacoLivreBytes, agora: () => AGORA, flags: LIGADO })
  return { resultado, resumo }
}

/** Um arquivo de preparo/ lido pelo molde, como o app lê. */
async function lidoNoPreparo<T extends { formato: number }>(arquivo: ArquivoDoPreparo<T>, partes: readonly string[]): Promise<T> {
  const lido = await lerDoPreparo(arquivo, partes, LIGADO)
  if (lido.estado !== 'ok') throw new Error(`preparo/${partes.join('/')} devia abrir, veio ${lido.estado}`)
  return lido.valor
}

/** Uma fatia futura acrescenta uma chave no topo dos dois arquivos; esta versão não a conhece, então ela mora em `extras`. */
async function comChaveNovaNoTopo(): Promise<void> {
  const indice = await lidoNoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice())
  const ligacoes = await lidoNoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes())
  await gravarNoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice(), { ...indice, extras: { ordem: ['camp-mar'] } }, LIGADO)
  await gravarNoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes(), { ...ligacoes, extras: { vista: { zoom: 2 } } }, LIGADO)
}

/** O mesmo caminho do mestre, só a simulação: o Aplicar fica com o teste. */
async function simularDeNovo(arquivos: Readonly<Record<string, Conteudo>>) {
  const foto = await fotoDoPreludio()
  const falso = cofreFalso(arquivos)
  const resultado = await simularImportacao(falso.leitor, { ...COM_ESPACO, existentes: foto.vazio ? undefined : foto.noPreludio, midiasNoPreludio: foto.midias })
  const aplicar = (espacoLivreBytes: number) => aplicarImportacao(resultado, falso.leitor, { foto, pastas: new Map(), espacoLivreBytes, agora: () => AGORA, flags: LIGADO })
  return { foto, resultado, aplicar }
}

function somaDosBytes(midias: readonly { readonly bytes: number }[]): number {
  return midias.reduce((soma, midia) => soma + midia.bytes, 0)
}

/** O JSON é copiado como texto e o resto byte a byte: compara pelo texto. */
function comoTexto(conteudo: string | Uint8Array | undefined): string | undefined {
  // `typeof`, e não `instanceof`: o Uint8Array do TextEncoder do jsdom é de outro "realm".
  return conteudo === undefined || typeof conteudo === 'string' ? conteudo : new TextDecoder().decode(conteudo)
}

function arquivosEm(pasta: string): string[] {
  return [...disco.keys()].filter((caminho) => caminho.startsWith(`${pasta}/`)).map((caminho) => caminho.slice(pasta.length + 1)).sort()
}

async function verbeteNoDisco(id: string) {
  const lido = await lerVerbete(id, LIGADO)
  if (lido.estado !== 'ok') throw new Error(`o verbete ${id} devia abrir, veio ${lido.estado}`)
  return lido.valor
}

beforeEach(() => {
  disco.clear()
  pastasCriadas.clear()
})

describe('aplicar a importação do Grimório', () => {
  it('grava o plano pelos moldes, cada imagem uma vez, a pasta escolhida e a pasta da importação sem imagens', async () => {
    const arquivos = cofreInventado()
    const { resultado, resumo } = await simularEAplicar(arquivos, new Map([['camp-mar', 'pasta-do-labirinto']]))
    const { plano } = resultado

    expect(resumo).toMatchObject({ verbetes: plano.verbetes.length, quadros: plano.quadros.length, imagens: 2, ligacoesMudaram: true, indiceMudou: true, preservados: [], pasta: 'importacoes/2026-11-08T12-00-00Z' })
    for (const verbete of plano.verbetes) expect(await verbeteNoDisco(verbete.id)).toEqual(verbete)
    expect(arquivosEm(`${PREPARO}/quadros`)).toEqual(plano.quadros.map((quadro) => `${quadro.id}.json`).sort())

    // Cada imagem uma vez, pelo SHA-256 do conteúdo (png(1) aparece em dois caminhos do cofre).
    const midias = arquivosEm(`${PREPARO}/midia`)
    expect(midias).toEqual(plano.midias.map((midia) => midia.midia.slice('midia/'.length)).sort())
    expect(midias).toHaveLength(2)
    expect(disco.get(`${PREPARO}/${plano.midias.find((midia) => midia.caminho === 'Imagens/canvas/mapa.png')?.midia}`)).toEqual(png(9))

    const indice = await lerIndiceDoPreparo(LIGADO)
    expect(indice.estado === 'ok' && indice.valor.campanhas.map((campanha) => [campanha.id, campanha.pastaId])).toEqual([['camp-mar', 'pasta-do-labirinto']])
    expect(arquivosEm(PREPARO).filter((caminho) => !caminho.startsWith('verbetes/') && !caminho.startsWith('quadros/') && !caminho.startsWith('midia/') && !caminho.startsWith('importacoes/2026'))).toEqual([
      'chats/sessao-um.json', 'importacoes/vindos-do-grimorio.json', 'ligacoes.json', 'lixeira/do-grimorio/lix-1.json', 'preparo.json', 'teia.json',
    ])

    // importacoes/<data>/: o relatório e todos os JSON do cofre (mais o que ficou só no original), nenhuma imagem.
    const originais = Object.keys(arquivos).filter((caminho) => caminho.endsWith('.json') || caminho === 'Imagens/leia-me.md').sort()
    expect(arquivosEm(PASTA_DA_IMPORTACAO)).toEqual([...originais.map((caminho) => `original/${caminho}`), 'relatorio.json'].sort())
    for (const caminho of originais) expect(comoTexto(disco.get(`${PASTA_DA_IMPORTACAO}/original/${caminho}`))).toBe(comoTexto(arquivos[caminho]))
    const relatorio = JSON.parse(String(disco.get(`${PASTA_DA_IMPORTACAO}/relatorio.json`)))
    expect(relatorio.aplicacao).toMatchObject({ em: AGORA.toISOString(), modo: 'importacao', mudancas: resumo.mudancas, pastas: { 'camp-mar': 'pasta-do-labirinto' } })
    expect(Object.values(relatorio.tabelaDeMidia)).toHaveLength(3)

    const vindos = JSON.parse(String(disco.get(`${PREPARO}/importacoes/vindos-do-grimorio.json`)))
    expect(vindos.verbetes).toEqual(plano.verbetes.map((verbete) => verbete.id).sort())
    expect(vindos.campanhas).toEqual(['camp-mar'])
  })

  it('cofre mínimo (só a campanha, sem campo opcional, sem imagem, chat, Teia nem lixeira) grava só o essencial', async () => {
    const arquivos = { 'campanhas/so-isso/campanha.json': json({ id: 'camp-so', nome: 'Só Isso' }) }
    const { resultado, resumo } = await simularEAplicar(arquivos)

    expect(resultado.relatorio.podeAplicar).toBe(true)
    expect(resumo).toMatchObject({ imagens: 0, soLeitura: 0, indiceMudou: true, preservados: [], pasta: 'importacoes/2026-11-08T12-00-00Z' })
    const indice = await lerIndiceDoPreparo(LIGADO)
    expect(indice.estado === 'ok' && indice.valor.campanhas.map((campanha) => [campanha.id, campanha.pastaId])).toEqual([['camp-so', undefined]])
    expect(arquivosEm(PREPARO).filter((caminho) => !caminho.startsWith('verbetes/') && !caminho.startsWith('quadros/'))).toEqual([
      `${PASTA_DA_IMPORTACAO.slice(PREPARO.length + 1)}/original/campanhas/so-isso/campanha.json`,
      `${PASTA_DA_IMPORTACAO.slice(PREPARO.length + 1)}/relatorio.json`,
      'importacoes/vindos-do-grimorio.json', 'ligacoes.json', 'preparo.json',
    ])
  })

  it('reaplicar com o Grimório igual = 0 mudanças: nenhum arquivo é tocado, nem a pasta da importação', async () => {
    await simularEAplicar(cofreInventado(), new Map([['camp-mar', 'pasta-do-labirinto']]))
    const antes = new Map(disco)

    const { resultado, resumo } = await simularEAplicar(cofreInventado(), new Map([['camp-mar', 'pasta-do-labirinto']]))

    const reimportacao = resultado.relatorio.reimportacao
    for (const tipo of ['verbetes', 'quadros', 'ligacoes', 'campanhas'] as const) {
      expect(reimportacao?.[tipo]).toMatchObject({ novos: [], atualizar: [], editadosNoPreludio: [], sumiuLa: [], apagadosNoPreludio: [] })
    }
    expect(resumo).toEqual({ mudancas: 0, verbetes: 0, quadros: 0, imagens: 0, soLeitura: 0, ligacoesMudaram: false, indiceMudou: false, preservados: [], pasta: null, avisos: [] })
    expect(disco).toEqual(antes)
  })

  it('o que o mestre editou no Prelúdio não é tocado; o resto é atualizado; o que sumiu do Grimório fica no Prelúdio', async () => {
    const arquivos = cofreInventado()
    await simularEAplicar(arquivos)
    await gravarVerbete({ ...(await verbeteNoDisco('item-bussola')), titulo: 'Bússola Editada no Prelúdio' }, LIGADO)
    const editada = disco.get(`${PREPARO}/verbetes/item-bussola.json`)

    const mudado = { ...arquivos }
    mudado['itens/bussola.json'] = json({ id: 'item-bussola', nome: 'Bússola Falsa', resumo: 'Aponta para outro teste.', retrato: null, descricao: '<p>d</p>', informacao: '', efeito: '<p>e</p>' })
    mudado['cenarios/mares/ilha/porto/cenario.json'] = json({ id: 'cen-porto', nome: 'Porto', retrato: 'imagens-cenarios/retrato-cen-porto.png', descricao: '<p>Porto reformado.</p>' })
    delete mudado['campanhas/mar-de-teste/escrita/lendas.notas/detalhe.json']
    const { resultado, resumo } = await simularEAplicar(mudado)

    expect(resultado.relatorio.reimportacao?.verbetes).toMatchObject({
      atualizar: ['cen-porto'],
      editadosNoPreludio: [{ id: 'item-bussola', titulo: 'Bússola Editada no Prelúdio', mudouNoGrimorioTambem: true }],
      sumiuLa: [{ id: 'pag-detalhe', titulo: 'Detalhe' }],
    })
    expect(resumo).toMatchObject({ verbetes: 1, quadros: 0, imagens: 0, pasta: 'importacoes/2026-11-08T12-00-00Z-2' })
    expect(disco.get(`${PREPARO}/verbetes/item-bussola.json`)).toBe(editada)
    expect(JSON.stringify(await verbeteNoDisco('cen-porto'))).toContain('Porto reformado.')
    expect((await verbeteNoDisco('pag-detalhe')).titulo).toBe('Detalhe')
  })

  it('o que o mestre apagou no Prelúdio não volta na reimportação', async () => {
    await simularEAplicar(cofreInventado())
    disco.delete(`${PREPARO}/verbetes/pers-capita.json`)

    const { resultado, resumo } = await simularEAplicar(cofreInventado())

    expect(resultado.relatorio.reimportacao?.verbetes.apagadosNoPreludio).toEqual([{ id: 'pers-capita', titulo: expect.any(String) }])
    expect(resumo.mudancas).toBe(0)
    expect(disco.has(`${PREPARO}/verbetes/pers-capita.json`)).toBe(false)
  })

  it('recusa sem gravar nada: espaço não medido, menos de 8 GB sobrando, Prelúdio mudado depois da simulação', async () => {
    const foto = await fotoDoPreludio()
    const falso = cofreFalso(cofreInventado())
    const resultado = await simularImportacao(falso.leitor, COM_ESPACO)
    const aplicar = (espacoLivreBytes: number | null) => aplicarImportacao(resultado, falso.leitor, { foto, pastas: new Map(), espacoLivreBytes, agora: () => AGORA, flags: LIGADO })

    await expect(aplicar(null)).rejects.toBeInstanceOf(RecusaDaImportacao)
    await expect(aplicar(8 * 1024 ** 3 + resultado.relatorio.espaco.necessarioBytes - 1)).rejects.toThrow(/mínimo é 8 GB/)
    expect(disco.size).toBe(0)

    await gravarVerbete({ ...resultado.plano.verbetes[0], titulo: 'Criado no Prelúdio entre a simulação e o Aplicar' }, LIGADO)
    const antes = new Map(disco)
    await expect(aplicar(COM_ESPACO.espacoLivreBytes)).rejects.toThrow(/mudou desde a simulação/)
    expect(disco).toEqual(antes)
  })

  it('imagem que mudou no cofre depois da simulação para a importação antes de gravar qualquer verbete', async () => {
    const foto = await fotoDoPreludio()
    const resultado = await simularImportacao(cofreFalso(cofreInventado()).leitor, COM_ESPACO)
    const depois = cofreFalso({ ...cofreInventado(), 'Imagens/canvas/mapa.png': png(42) })

    await expect(aplicarImportacao(resultado, depois.leitor, { foto, pastas: new Map(), espacoLivreBytes: COM_ESPACO.espacoLivreBytes, flags: LIGADO })).rejects.toThrow(/mudou no cofre/)
    expect(arquivosEm(`${PREPARO}/verbetes`)).toEqual([])
  })
})

describe('revelar conta como editar: a reimportação não troca o que o jogador já pode ver', () => {
  const CONTA = 'conta-inventada'
  const QUANDO = '2026-11-09T12:00:00.000Z'

  /** O mestre segue escrevendo no Grimório: muda a Capitã (que está na campanha) e a Bússola (que não está). */
  function grimorioMudado(): Record<string, Conteudo> {
    const mudado = cofreInventado()
    mudado['personagens-soltos/piratas/capita.json'] = String(mudado['personagens-soltos/piratas/capita.json']).replace('Navega em testes.', 'Na verdade é filha do Almirante.')
    mudado['itens/bussola.json'] = json({ id: 'item-bussola', nome: 'Bússola Falsa', resumo: 'Aponta para outro teste.', retrato: null, descricao: '<p>d</p>', informacao: '', efeito: '<p>e</p>' })
    return mudado
  }

  it('uma seção revelada a uma conta só segura o verbete inteiro: ele fica como estava, e o resto é atualizado', async () => {
    await simularEAplicar(cofreInventado())
    const capita = await verbeteNoDisco('pers-capita')
    const [parte] = capita.formas.flatMap((forma) => forma.secoes.map((secao) => ({ forma, secao })))
    if (parte === undefined) throw new Error('a Capitã inventada devia ter uma seção')
    await gravarRevelado('camp-mar', { formato: 1, revelacoes: [{ alvo: alvoDaSecao('pers-capita', parte.forma.id, parte.secao.id), para: [CONTA], quando: QUANDO }] }, LIGADO)
    const antes = disco.get(`${PREPARO}/verbetes/pers-capita.json`)

    const { resultado, resumo } = await simularEAplicar(grimorioMudado())

    expect(resultado.relatorio.reimportacao?.verbetes).toMatchObject({
      atualizar: ['item-bussola'],
      editadosNoPreludio: [{ id: 'pers-capita', titulo: capita.titulo, mudouNoGrimorioTambem: true, revelado: true }],
    })
    expect(resumo.verbetes).toBe(1)
    expect(disco.get(`${PREPARO}/verbetes/pers-capita.json`)).toBe(antes)
    expect(JSON.stringify(await verbeteNoDisco('pers-capita'))).not.toContain('Almirante')
  })

  it('revelado que não abre (danificado sem cópia, formato mais novo) segura todos os verbetes daquela campanha', async () => {
    for (const conteudo of ['{ isto não é JSON', JSON.stringify({ formato: 2, revelacoes: [], revelarTudoDoTipo: 'personagem' })]) {
      disco.clear()
      pastasCriadas.clear()
      await simularEAplicar(cofreInventado())
      expect((await verbeteNoDisco('pers-capita')).campanhas).toContain('camp-mar')
      expect((await verbeteNoDisco('item-bussola')).campanhas).not.toContain('camp-mar')
      disco.set(`${PREPARO}/revelado/camp-mar.json`, conteudo)

      const { resultado } = await simularEAplicar(grimorioMudado())

      expect(resultado.relatorio.reimportacao?.verbetes).toMatchObject({ atualizar: ['item-bussola'], editadosNoPreludio: [expect.objectContaining({ id: 'pers-capita', revelado: true })] })
      expect(JSON.stringify(await verbeteNoDisco('pers-capita'))).not.toContain('Almirante')
    }
  })

  it('revelar entre a simulação e o Aplicar: o Aplicar recusa e nada é gravado', async () => {
    await simularEAplicar(cofreInventado())
    const { resultado, aplicar } = await simularDeNovo(grimorioMudado())
    expect([...(resultado.relatorio.reimportacao?.verbetes.atualizar ?? [])].sort()).toEqual(['item-bussola', 'pers-capita'])
    await gravarRevelado('camp-mar', { formato: 1, revelacoes: [{ alvo: alvoDoVerbete('pers-capita'), para: 'todos', quando: QUANDO }] }, LIGADO)
    const antes = new Map(disco)

    await expect(aplicar(COM_ESPACO.espacoLivreBytes)).rejects.toThrow(/mudou desde a simulação/)
    expect(disco).toEqual(antes)
  })
})

describe('o resto do preparo.json e do ligacoes.json volta igual: só a lista vem da importação', () => {
  it('chave no topo que esta versão não conhece fica, e o Grimório igual dá 0 mudanças', async () => {
    await simularEAplicar(cofreInventado())
    await comChaveNovaNoTopo()
    const antes = new Map(disco)

    const { resumo } = await simularEAplicar(cofreInventado())

    expect(resumo).toMatchObject({ mudancas: 0, indiceMudou: false, ligacoesMudaram: false, pasta: null })
    expect(disco).toEqual(antes)
  })

  it('com o Grimório mudado, só a lista é trocada: a chave no topo e a pasta ligada ficam', async () => {
    await simularEAplicar(cofreInventado(), new Map([['camp-mar', 'pasta-do-labirinto']]))
    await comChaveNovaNoTopo()
    const mudado = cofreInventado()
    mudado['campanhas/mar-de-teste/campanha.json'] = json({ id: 'camp-mar', nome: 'Mar Renomeado', descricao: 'Inventada.', criadoEm: CRIADO })
    mudado['vinculos.json'] = String(mudado['vinculos.json']).replace('desde o teste', 'desde o teste de novo')

    const { resumo } = await simularEAplicar(mudado)

    expect(resumo).toMatchObject({ indiceMudou: true, ligacoesMudaram: true })
    const indice = await lidoNoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice())
    expect(indice.extras).toEqual({ ordem: ['camp-mar'] })
    expect(indice.campanhas.map((campanha) => [campanha.id, campanha.nome, campanha.pastaId])).toEqual([['camp-mar', 'Mar Renomeado', 'pasta-do-labirinto']])
    const ligacoes = await lidoNoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes())
    expect(ligacoes.extras).toEqual({ vista: { zoom: 2 } })
    expect(ligacoes.ligacoes.find((ligacao) => ligacao.id === 'v5')?.notas).toBe('desde o teste de novo')
  })

  it('o exemplo da revisão: "ordem" escrita à mão no fim do preparo.json fica, e a reimportação seguinte dá 0 mudanças', async () => {
    await simularEAplicar(cofreInventado())
    const caminho = `${PREPARO}/preparo.json`
    disco.set(caminho, JSON.stringify({ ...JSON.parse(String(disco.get(caminho))), ordem: ['a', 'b'] }))

    await simularEAplicar(cofreInventado())
    expect((await lidoNoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice())).extras).toEqual({ ordem: ['a', 'b'] })

    expect((await simularEAplicar(cofreInventado())).resumo).toMatchObject({ mudancas: 0, indiceMudou: false })
  })

  it('primeira importação sobre preparo.json e ligacoes.json de lista vazia: a chave no topo também fica', async () => {
    await gravarNoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice(), { formato: 1, campanhas: [], extras: { ordem: [] } }, LIGADO)
    await gravarNoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes(), { formato: 1, ligacoes: [], extras: { vista: { zoom: 2 } } }, LIGADO)
    expect((await fotoDoPreludio()).vazio).toBe(true)

    const { resultado } = await simularEAplicar(cofreInventado())

    expect(resultado.plano.modo).toBe('importacao')
    const indice = await lidoNoPreparo(ARQUIVO_DO_INDICE, LUGARES.indice())
    expect(indice.extras).toEqual({ ordem: [] })
    expect(indice.campanhas.map((campanha) => campanha.id)).toEqual(['camp-mar'])
    expect((await lidoNoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes())).extras).toEqual({ vista: { zoom: 2 } })
  })
})

describe('o espaço não conta as imagens que já estão em midia/', () => {
  it('reimportar: nem a simulação nem o Aplicar pedem espaço para elas; o Aplicar conta de novo a que sumiu depois da simulação', async () => {
    const primeira = await simularEAplicar(cofreInventado())
    const todas = somaDosBytes(primeira.resultado.plano.midias)
    expect(todas).toBeGreaterThan(0)
    expect(primeira.resultado.relatorio.espaco.midiaBytes).toBe(todas)

    const { foto, resultado, aplicar } = await simularDeNovo(cofreInventado())
    expect([...foto.midias].sort()).toEqual(primeira.resultado.plano.midias.map((midia) => midia.midia).sort())
    const contandoTodas = await simularImportacao(cofreFalso(cofreInventado()).leitor, { ...COM_ESPACO, existentes: foto.noPreludio })
    expect(resultado.relatorio.espaco.midiaBytes).toBe(0)
    expect(contandoTodas.relatorio.espaco.necessarioBytes - resultado.relatorio.espaco.necessarioBytes).toBe(todas)

    // Livre = o mínimo + só o que a reimportação grava. Antes, o Aplicar pedia todas as imagens de novo e recusava.
    const justo = MINIMO_QUE_SOBRA_BYTES + resultado.relatorio.espaco.necessarioBytes
    await expect(aplicar(justo - 1)).rejects.toThrow(/mínimo é 8 GB/)
    expect(await aplicar(justo)).toMatchObject({ mudancas: 0, imagens: 0 })

    // Uma imagem some de midia/ depois da simulação: o Aplicar conta de novo na hora, pede o espaço dela e a copia.
    const [sumida] = resultado.plano.midias
    disco.delete(`${PREPARO}/${sumida.midia}`)
    await expect(aplicar(justo + sumida.bytes - 1)).rejects.toThrow(/mínimo é 8 GB/)
    expect(await aplicar(justo + sumida.bytes)).toMatchObject({ imagens: 1 })
    expect(disco.has(`${PREPARO}/${sumida.midia}`)).toBe(true)
  })

  it('primeira importação depois de uma que parou no meio: a imagem já copiada não conta nem é copiada de novo', async () => {
    const arquivos = cofreInventado()
    const [copiada, faltando] = (await simularImportacao(cofreFalso(arquivos).leitor, COM_ESPACO)).plano.midias
    disco.set(`${PREPARO}/${copiada.midia}`, arquivos[copiada.caminho])
    expect((await fotoDoPreludio()).vazio).toBe(true)

    const { resultado, resumo } = await simularEAplicar(arquivos)

    expect(resultado.plano.modo).toBe('importacao')
    expect(resultado.relatorio.espaco.midiaBytes).toBe(faltando.bytes)
    expect(resumo.imagens).toBe(1)
  })
})
