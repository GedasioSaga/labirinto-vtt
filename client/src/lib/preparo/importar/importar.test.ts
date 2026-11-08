/**
 * PRELÚDIO F1: o importador do Grimório em simulação, contra um cofre
 * INVENTADO montado aqui (o repositório é público: nenhum dado real).
 */
import { describe, expect, it } from 'vitest'
import type { Verbete } from '../tipos'
import type { LeitorDoCofre, TipoDaEntrada } from './cofre'
import { DESTINOS } from './classificar'
import { simularImportacao } from './simular'

const SO_NA_NUVEM = 0x400000 | 0x1000
const LOCAL_FIXADO = 0x80000

type Conteudo = string | Uint8Array
interface Falso {
  readonly leitor: LeitorDoCofre
  /** Arquivos cujo conteúdo foi aberto (`lerTexto`/`lerBytes`). */
  readonly abertos: string[]
  /** Pastas que o inventário pediu para listar. */
  readonly listadas: string[]
}

/** `atalhos`: caminhos que o leitor mostra como link (o que houver dentro deles não pode ser listado). */
function cofreFalso(arquivos: Readonly<Record<string, Conteudo>>, atributos: Readonly<Record<string, number>> = {}, atalhos: readonly string[] = []): Falso {
  const conteudos = new Map(Object.entries(arquivos))
  const abertos: string[] = []
  const listadas: string[] = []
  const bytesDe = (conteudo: Conteudo) => (typeof conteudo === 'string' ? new TextEncoder().encode(conteudo) : conteudo)
  const pegar = (caminho: string): Conteudo => {
    const conteudo = conteudos.get(caminho)
    if (conteudo === undefined) throw new Error(`não existe: ${caminho}`)
    return conteudo
  }
  const tipoDe = (caminho: string, temFilhos: boolean): TipoDaEntrada => {
    if (atalhos.includes(caminho)) return 'atalho'
    return temFilhos ? 'pasta' : 'arquivo'
  }
  const leitor: LeitorDoCofre = {
    async listar(pasta) {
      listadas.push(pasta)
      const prefixo = pasta === '' ? '' : `${pasta}/`
      const filhos = new Map<string, boolean>()
      for (const caminho of conteudos.keys()) {
        if (!caminho.startsWith(prefixo)) continue
        const [nome, ...resto] = caminho.slice(prefixo.length).split('/')
        filhos.set(nome, (filhos.get(nome) ?? false) || resto.length > 0)
      }
      return [...filhos].map(([nome, temFilhos]) => ({ nome, tipo: tipoDe(`${prefixo}${nome}`, temFilhos) }))
    },
    async info(caminho) {
      return { bytes: bytesDe(pegar(caminho)).length, atributos: atributos[caminho] ?? LOCAL_FIXADO }
    },
    async lerTexto(caminho) {
      abertos.push(caminho)
      const conteudo = pegar(caminho)
      return typeof conteudo === 'string' ? conteudo : new TextDecoder().decode(conteudo)
    },
    async lerBytes(caminho) {
      abertos.push(caminho)
      return bytesDe(pegar(caminho))
    },
  }
  return { leitor, abertos, listadas }
}

function png(semente: number): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, semente, semente + 1, semente + 2])
}

const json = (valor: unknown) => JSON.stringify(valor, null, 2)
const tldraw = (formas: string[]) => ({ document: { store: Object.fromEntries(formas.map((id) => [id, { id, typeName: 'shape', x: 1 }])) }, session: { camera: 1 } })

/** Um cofre pequeno e inventado, com o formato atual e o antigo lado a lado. */
function cofreInventado(): Record<string, Conteudo> {
  return {
    'campanhas/mar-de-teste/campanha.json': json({ id: 'camp-mar', nome: 'Mar de Teste', descricao: 'Inventada.' }),
    'campanhas/mar-de-teste/sessoes/sessao-01.json': json({ id: 'sessao-um', nome: 'Sessão Um', documento: tldraw(['shape:a']) }),
    'campanhas/mar-de-teste/sessoes/sessao-01.notas/roteiro.json': json({ id: 'pag-roteiro', titulo: 'Roteiro', paiId: null, ordem: 0, corpo: '<p>Abre com <strong>tempestade</strong>.</p>' }),
    'campanhas/mar-de-teste/sessoes/sessao-01.notas/chat-ia.json': json({ mensagens: [{ papel: 'user', texto: 'oi', em: '' }] }),
    'campanhas/mar-de-teste/escrita/lendas.json': json({ id: 'caderno-lendas', nome: 'Lendas', documento: null }),
    'campanhas/mar-de-teste/escrita/lendas.notas/origem.json': json({
      id: 'pag-origem', titulo: 'Origem', paiId: null, ordem: 0,
      corpo: '<h2>Começo</h2><ul><li>um</li></ul><img data-rel="imagens/canvas/mapa.png" data-legenda="o mapa"><table><tr><td>x</td></tr></table>',
    }),
    'campanhas/mar-de-teste/escrita/lendas.notas/detalhe.json': json({ id: 'pag-detalhe', titulo: 'Detalhe', paiId: 'pag-origem', ordem: 1, corpo: '<p>filha</p>' }),
    'canvases-soltos/quadro-livre.json': json({ id: 'canvas-livre', nome: 'Quadro livre', documento: tldraw(['shape:b']) }),
    'mapas-soltos/masmorra.json': json({ id: 'mapa-masmorra', nome: 'Masmorra', documento: tldraw([]), camadas: [{ id: 'c1', nome: 'Base', oculta: false, travada: false }], versaoCamadas: 2 }),
    'personagens-soltos/piratas/pasta.json': json({ id: 'pasta-piratas', nome: 'Piratas' }),
    'personagens-soltos/piratas/capita.json': json({
      id: 'pers-capita', nome: 'Sombra', versaoAtivaId: 'v-noite',
      versoes: [
        {
          id: 'v-dia', nome: 'Capitã Inventada', retrato: 'imagens/personagens/Capita/retrato.png', foco: { x: 40, y: 60 }, resumo: 'Navega em testes.',
          descricao: '<p>Descrição.</p>', informacao: '', historia: '', extras: '', anotacoes: '<p>SEGREDO-TESTE</p>',
          imagens: [{ rel: 'Imagens/personagens/Capita/retrato.png', legenda: 'De frente' }], acervo: [{ itemId: 'item-bussola' }],
        },
        { id: 'v-noite', nome: 'Sombra', retrato: null, resumo: '', descricao: '', informacao: '<p>À noite.</p>', historia: '', extras: '', anotacoes: '', imagens: [] },
      ],
    }),
    'personagens-soltos/antigo.json': json({ nome: 'Marujo Antigo', corpo: '<p>Formato plano, sem id.</p>' }),
    'itens/bussola.json': json({ id: 'item-bussola', nome: 'Bússola Falsa', resumo: 'Aponta para o teste.', retrato: null, descricao: '<p>d</p>', informacao: '', efeito: '<p>e</p>' }),
    'cenarios/mares/pasta.json': json({ id: 'pasta-mares', nome: 'Mares' }),
    'cenarios/mares/ilha/cenario.json': json({
      id: 'cen-ilha', nome: 'Ilha de Teste', personagens: ['pers-capita'], versaoAtivaId: 'cv-base',
      versoes: [{ id: 'cv-base', nome: 'Base', retrato: null, resumo: '', descricao: '<p>Ilha.</p>', informacao: '', historia: '', eventos: '', itens: '', acervo: [], anotacoes: '', imagens: [] }],
    }),
    'cenarios/mares/ilha/porto/cenario.json': json({ id: 'cen-porto', nome: 'Porto', retrato: 'imagens-cenarios/retrato-cen-porto.png', descricao: '<p>Formato plano.</p>' }),
    'vinculos.json': json({
      vinculos: [
        { id: 'v1', deTipo: 'pasta', deId: 'pasta-piratas', paraTipo: 'campanha', paraId: 'camp-mar', tipo: 'participa', notas: '' },
        { id: 'v2', deTipo: 'cenario', deId: 'cen-ilha', paraTipo: 'campanha', paraId: 'camp-mar', tipo: 'participa', notas: '' },
        { id: 'v3', deTipo: 'canvas', deId: 'canvas-livre', paraTipo: 'campanha', paraId: 'camp-mar', tipo: 'participa', notas: '' },
        { id: 'v4', deTipo: 'item', deId: 'item-bussola', paraTipo: 'campanha', paraId: 'camp-na-lixeira', tipo: 'participa', notas: '' },
        { id: 'v5', deTipo: 'personagem', deId: 'pers-capita', paraTipo: 'cenario', paraId: 'cen-ilha', tipo: 'mora em', notas: 'desde o teste' },
        { id: 'v6', deTipo: 'canvas', deId: 'x', paraTipo: 'canvas', paraId: 'y', tipo: 'invalido' },
      ],
    }),
    'layout-teia.json': json({}),
    'Imagens/personagens/Capita/retrato.png': png(1),
    'imagens-cenarios/retrato-cen-porto.png': png(1),
    'Imagens/canvas/mapa.png': png(9),
    'Imagens/leia-me.md': '# notas soltas',
    'desktop.ini': '[.ShellClassInfo]',
    '.lixeira/lix-1/entrada.json': json({ id: 'lix-1', tipo: 'personagem', nome: 'Descartado' }),
    '.lixeira/lix-1/descartado.json': json({ id: 'pers-descartado', nome: 'Descartado' }),
  }
}

function verbeteDe(verbetes: readonly Verbete[], id: string): Verbete {
  const achado = verbetes.find((verbete) => verbete.id === id)
  if (achado === undefined) throw new Error(`faltou o verbete ${id}`)
  return achado
}

describe('simulação da importação do Grimório', () => {
  it('cada arquivo cai em exatamente 1 destino, e as contagens e conversões batem com o cofre inventado', async () => {
    const arquivos = cofreInventado()
    const { relatorio, plano } = await simularImportacao(cofreFalso(arquivos).leitor, { espacoLivreBytes: 20 * 1024 ** 3 })

    expect(relatorio.cadaArquivoUmDestino).toBe(true)
    expect(relatorio.arquivos.map((arquivo) => arquivo.caminho).sort()).toEqual(Object.keys(arquivos).sort())
    expect(DESTINOS.reduce((soma, destino) => soma + relatorio.destinos[destino].arquivos, 0)).toBe(Object.keys(arquivos).length)
    expect(relatorio.contagens).toEqual({
      campanhas: 1, sessoes: 1, cadernos: 1, paginas: 3, personagens: 2, cenarios: 2, itens: 1, quadros: 3,
      vinculos: 5, participacoes: 4, relacoes: 1, imagens: 3, imagensUnicas: 2, chats: 1, pastas: 2, lixeira: 1,
    })
    expect(relatorio.destinos.soOriginal.arquivos).toBe(1)
    expect(relatorio.destinos.ignorado.arquivos).toBe(1)
    expect(relatorio.falhas).toEqual([])
    expect(relatorio.podeAplicar).toBe(true)
    expect(relatorio.saida.verbetes).toEqual({ personagem: 2, lugar: 2, item: 1, faccao: 0, pagina: 4, sessao: 1 })

    const capita = verbeteDe(plano.verbetes, 'pers-capita')
    expect(capita.formaAtivaId).toBe('v-noite')
    expect(capita.campanhas).toEqual(['camp-mar'])
    expect(capita.organizacao).toEqual(['Piratas'])
    const dia = capita.formas[0]
    expect(dia.secoes.map((secao) => [secao.titulo, secao.segredo])).toEqual([['Descrição', false], ['Anotações', true]])
    expect(dia.retrato).toMatch(/^midia\/[0-9a-f]{64}\.png$/)
    expect(dia.imagens).toEqual([{ midia: dia.retrato, legenda: 'De frente' }])
    expect(dia.acervo).toEqual([{ itemId: 'item-bussola', qtd: 1 }])
    expect(capita.origem?.grimorio?.hash).toMatch(/^[0-9a-f]{64}$/)

    const porto = verbeteDe(plano.verbetes, 'cen-porto')
    expect([porto.tipo, porto.paiId, porto.formas[0].nome, porto.formas[0].retrato]).toEqual(['lugar', 'cen-ilha', 'Base', dia.retrato])
    expect(verbeteDe(plano.verbetes, 'cen-ilha').extras).toEqual({ personagens: ['pers-capita'] })
    expect(verbeteDe(plano.verbetes, 'item-bussola').campanhas).toEqual([])
    expect(relatorio.avisos.some((aviso) => aviso.includes('campanha que não está no cofre'))).toBe(true)

    expect(verbeteDe(plano.verbetes, 'pag-detalhe').paiId).toBe('pag-origem')
    expect(verbeteDe(plano.verbetes, 'pag-origem').paiId).toBe('caderno-lendas')
    expect(verbeteDe(plano.verbetes, 'pag-roteiro')).toMatchObject({ paiId: 'sessao-um', campanhas: ['camp-mar'] })
    const origem = verbeteDe(plano.verbetes, 'pag-origem').formas[0].secoes[0].texto.content ?? []
    expect(origem.map((no) => (typeof no === 'object' && no !== null && 'type' in no ? no.type : '?'))).toEqual(['heading', 'bulletList', 'image', 'paragraph'])

    expect(plano.quadros.map(({ id, quadro }) => [id, quadro.campanhaId, quadro.sessaoId])).toEqual([
      ['sessao-um', 'camp-mar', 'sessao-um'],
      ['canvas-livre', 'camp-mar', undefined],
      ['mapa-masmorra', undefined, undefined],
    ])
    expect(plano.ligacoes.ligacoes).toEqual([{ id: 'v5', de: 'pers-capita', para: 'cen-ilha', tipo: 'mora em', notas: 'desde o teste', segredo: false }])
    expect(relatorio.espaco.cabe).toBe(true)
  })

  it('arquivo sem id ganha o mesmo id fixo a cada simulação, e o formato antigo vira forma', async () => {
    const primeira = await simularImportacao(cofreFalso(cofreInventado()).leitor)
    const segunda = await simularImportacao(cofreFalso(cofreInventado()).leitor)
    const antigo = primeira.plano.verbetes.find((verbete) => verbete.origem?.grimorio?.caminho === 'personagens-soltos/antigo.json')
    expect(antigo?.id).toMatch(/^grim-[0-9a-f]{32}$/)
    expect(segunda.plano.verbetes.map((verbete) => verbete.id)).toEqual(primeira.plano.verbetes.map((verbete) => verbete.id))
    expect(antigo?.formas.map((forma) => [forma.nome, forma.secoes.map((secao) => secao.titulo)])).toEqual([['Marujo Antigo', ['Descrição']]])
  })

  it('arquivo com todo campo ausente ({}) entra com os vazios do Grimório e id fixo, sem quebrar a conferência', async () => {
    const vazio = '{}'
    const { relatorio, plano } = await simularImportacao(
      cofreFalso({
        'campanhas/c/campanha.json': vazio,
        'campanhas/c/sessoes/s.json': vazio,
        'campanhas/c/escrita/e.json': vazio,
        'campanhas/c/escrita/e.notas/p.json': vazio,
        'personagens-soltos/p.json': vazio,
        'cenarios/x/cenario.json': vazio,
        'itens/i.json': vazio,
        'canvases-soltos/q.json': vazio,
        'vinculos.json': vazio,
      }).leitor,
    )
    expect(relatorio.cadaArquivoUmDestino).toBe(true)
    expect(relatorio.falhas).toEqual([])
    expect(plano.verbetes.map((verbete) => verbete.tipo).sort()).toEqual(['item', 'lugar', 'pagina', 'pagina', 'personagem', 'sessao'])
    expect(plano.verbetes.every((verbete) => /^grim-[0-9a-f]{32}$/.test(verbete.id))).toBe(true)
    expect(plano.quadros.map(({ quadro }) => quadro.tldraw)).toEqual([null, null])
    expect(plano.indice.campanhas).toHaveLength(1)
    expect(relatorio.avisos.some((aviso) => aviso.includes('sem id'))).toBe(true)
  })

  it('arquivo só na nuvem do OneDrive vira falha, não é aberto, e trava o Aplicar; pouco espaço também trava', async () => {
    const falso = cofreFalso(cofreInventado(), { 'itens/bussola.json': SO_NA_NUVEM, 'Imagens/canvas/mapa.png': SO_NA_NUVEM })
    const { relatorio } = await simularImportacao(falso.leitor, { espacoLivreBytes: 1024 })

    expect(falso.abertos).not.toContain('itens/bussola.json')
    expect(falso.abertos).not.toContain('Imagens/canvas/mapa.png')
    expect(relatorio.falhas.map((falha) => falha.caminho)).toEqual(['Imagens/canvas/mapa.png', 'itens/bussola.json'])
    expect(relatorio.cadaArquivoUmDestino).toBe(true)
    expect(relatorio.porTipo.item).toEqual({ lidos: 1, importados: 0, soOriginal: 0, ignorados: 0, falhas: 1 })
    expect(relatorio.espaco.cabe).toBe(false)
    expect(relatorio.podeAplicar).toBe(false)
    expect(relatorio.motivosParaNaoAplicar).toHaveLength(2)
  })

  it('atalho (link ou junção) não é seguido nem some calado: entra na lista como falha e trava o Aplicar', async () => {
    const falso = cofreFalso({ ...cofreInventado(), 'Imagens/de-fora/foto.png': png(9) }, {}, ['Imagens/de-fora'])
    const { relatorio } = await simularImportacao(falso.leitor)

    expect(falso.listadas).not.toContain('Imagens/de-fora')
    expect(relatorio.arquivos.map((arquivo) => arquivo.caminho)).not.toContain('Imagens/de-fora/foto.png')
    expect(relatorio.falhas).toEqual([expect.objectContaining({ caminho: 'Imagens/de-fora', motivo: expect.stringContaining('atalho') })])
    expect(relatorio.arquivos.find((arquivo) => arquivo.caminho === 'Imagens/de-fora')).toMatchObject({ bytes: 0, destino: 'falha' })
    expect(relatorio.cadaArquivoUmDestino).toBe(true)
    expect(relatorio.podeAplicar).toBe(false)
    expect(relatorio.motivosParaNaoAplicar).toHaveLength(1)
  })

  it('cópias de conflito não entram: o relatório só compara com o original e avisa o que tem a mais', async () => {
    const original = cofreInventado()
    const copias = cofreFalso({
      'canvases-soltos/quadro-livre (conflito — Grimorio 13-08 22h29).json': json({ id: 'outro-id', nome: 'Quadro livre (conflito)', documento: tldraw(['shape:b', 'shape:nova']) }),
      'personagens-soltos/piratas/capita (conflito — Grimorio 12-08 14h51).json': String(original['personagens-soltos/piratas/capita.json']).replace('"pers-capita"', '"id-novo"'),
      'cenarios/mares/ilha (conflito — Grimorio 13-08 23h03) (2)/cenario.json': String(original['cenarios/mares/ilha/cenario.json']).replace('<p>Ilha.</p>', '<p>Ilha velha.</p>'),
      'canvases-soltos/sumido (conflito — Grimorio 14-08 00h03).json': json({ id: 'z', nome: 'Sumido', documento: null }),
      'canvases-soltos/descartado (conflito — Grimorio 14-08 00h08).json': json({ id: 'outro', nome: 'Descartado' }),
    })
    const { relatorio, plano } = await simularImportacao(cofreFalso(original).leitor, { copiasDeConflito: copias.leitor })

    const situacoes = Object.fromEntries((relatorio.copiasDeConflito?.comparacoes ?? []).map((comparacao) => [comparacao.original, [comparacao.situacao, comparacao.naLixeira]]))
    expect(situacoes).toEqual({
      'canvases-soltos/quadro-livre.json': ['temCoisaAMais', false],
      'personagens-soltos/piratas/capita.json': ['igual', false],
      'cenarios/mares/ilha/cenario.json': ['soDiferencas', false],
      'canvases-soltos/sumido.json': ['semOriginal', false],
      '.lixeira/lix-1/descartado.json': ['igual', true],
    })
    expect(relatorio.copiasDeConflito?.comCoisaAMais).toBe(1)
    expect(plano.verbetes.some((verbete) => verbete.id === 'id-novo')).toBe(false)
    expect(relatorio.cofre.arquivos).toBe(Object.keys(original).length)
  })

  it('reimportar: editado no Prelúdio fica, não mexido é atualizado, sumido lá fica, nada se junta', async () => {
    const antes = await simularImportacao(cofreFalso(cofreInventado()).leitor)
    const idDoAntigo = antes.plano.verbetes.find((verbete) => verbete.origem?.grimorio?.caminho === 'personagens-soltos/antigo.json')?.id ?? ''
    const editar = (id: string, titulo: string) => ({ ...verbeteDe(antes.plano.verbetes, id), titulo })
    const soNoPreludio: Verbete = { ...verbeteDe(antes.plano.verbetes, 'item-bussola'), id: 'feito-no-preludio', origem: undefined }
    const sumido: Verbete = { ...verbeteDe(antes.plano.verbetes, 'cen-porto'), id: 'sumiu-do-grimorio' }
    const existentes = [
      verbeteDe(antes.plano.verbetes, 'pers-capita'),
      editar(idDoAntigo, 'Marujo Renomeado no Prelúdio'),
      editar('item-bussola', 'Bússola Renomeada no Prelúdio'),
      verbeteDe(antes.plano.verbetes, 'cen-porto'),
      sumido,
      soNoPreludio,
    ]

    const mudado = cofreInventado()
    mudado['personagens-soltos/piratas/capita.json'] = String(mudado['personagens-soltos/piratas/capita.json']).replace('Navega em testes.', 'Navega em testes novos.')
    mudado['personagens-soltos/antigo.json'] = json({ nome: 'Marujo Antigo', corpo: '<p>Mudou no Grimório também.</p>' })
    const { relatorio } = await simularImportacao(cofreFalso(mudado).leitor, { existentes })

    const plano = relatorio.reimportacao
    expect(plano?.atualizar).toEqual(['pers-capita'])
    expect(plano?.iguais).toEqual(['cen-porto'])
    expect(plano?.editadosNoPreludio).toHaveLength(2)
    expect(plano?.editadosNoPreludio).toEqual(
      expect.arrayContaining([
        { id: idDoAntigo, titulo: 'Marujo Renomeado no Prelúdio', mudouNoGrimorioTambem: true },
        { id: 'item-bussola', titulo: 'Bússola Renomeada no Prelúdio', mudouNoGrimorioTambem: false },
      ]),
    )
    expect(plano?.sumiuLa).toEqual([{ id: 'sumiu-do-grimorio', titulo: 'Porto' }])
    expect(plano?.novos).toContain('cen-ilha')
    expect(plano?.novos).not.toContain('feito-no-preludio')
  })
})
