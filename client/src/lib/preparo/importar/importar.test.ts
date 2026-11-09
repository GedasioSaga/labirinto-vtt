/**
 * PRELÚDIO F1: o importador do Grimório em simulação, contra um cofre
 * INVENTADO (`cofreDeTeste.ts`; o repositório é público: nenhum dado real).
 */
import { describe, expect, it } from 'vitest'
import { ehRegistro } from '../molde'
import type { Quadro, Secao, Verbete } from '../tipos'
import { DESTINOS } from './classificar'
import type { LeitorDoCofre } from './cofre'
import { COM_ESPACO, CRIADO, HASH, MODIFICADO, SO_NA_NUVEM, cofreFalso, cofreInventado, json, png, tldraw } from './cofreDeTeste'
import type { NoPreludio } from './reimportar'
import { midiaDaTabela } from './relatorio'
import { simularImportacao } from './simular'

function verbeteDe(verbetes: readonly Verbete[], id: string): Verbete {
  const achado = verbetes.find((verbete) => verbete.id === id)
  if (achado === undefined) throw new Error(`faltou o verbete ${id}`)
  return achado
}

function quadroDe(quadros: readonly { id: string; quadro: Quadro }[], id: string): Quadro {
  const achado = quadros.find((quadro) => quadro.id === id)
  if (achado === undefined) throw new Error(`faltou o quadro ${id}`)
  return achado.quadro
}

/** O que o TipTap 3 faz com um nó ao abrir: o link ganha os atributos padrão e todo atributo ausente vira `null`. */
function noDoEditor(no: unknown): unknown {
  if (Array.isArray(no)) return no.map(noDoEditor)
  if (!ehRegistro(no)) return no
  const saida: Record<string, unknown> = Object.fromEntries(Object.entries(no).map(([chave, valor]) => [chave, noDoEditor(valor)]))
  const attrs = ehRegistro(saida.attrs) ? saida.attrs : {}
  if (saida.type === 'link') saida.attrs = { ...attrs, target: '_blank', rel: 'noopener noreferrer nofollow', class: null, title: null }
  if (saida.type === 'image') saida.attrs = { ...attrs, alt: attrs.alt ?? null }
  return saida
}

/** A seção como o editor a devolve: nós normalizados e o parágrafo vazio que o TrailingNode põe depois de lista ou título. */
function secaoAberta(secao: Secao): Secao {
  const conteudo = (secao.texto.content ?? []).map(noDoEditor)
  const ultimo = conteudo[conteudo.length - 1]
  const terminaEmParagrafo = ehRegistro(ultimo) && ultimo.type === 'paragraph'
  return { ...secao, texto: { type: 'doc', content: terminaEmParagrafo ? conteudo : [...conteudo, { type: 'paragraph' }] } }
}

/** O verbete aberto no editor do Prelúdio e salvo pelo salvar automático, sem o mestre escrever nada. */
function abertoNoEditor(verbete: Verbete): Verbete {
  return { ...verbete, formas: verbete.formas.map((forma) => ({ ...forma, secoes: forma.secoes.map(secaoAberta) })) }
}

describe('simulação da importação do Grimório', () => {
  it('cada arquivo cai em exatamente 1 destino, e as contagens e conversões batem com o cofre inventado', async () => {
    const arquivos = cofreInventado()
    const { relatorio, plano } = await simularImportacao(cofreFalso(arquivos).leitor, COM_ESPACO)

    expect(relatorio.cadaArquivoUmDestino).toBe(true)
    expect(relatorio.arquivos.map((arquivo) => arquivo.caminho).sort()).toEqual(Object.keys(arquivos).sort())
    expect(DESTINOS.reduce((soma, destino) => soma + relatorio.destinos[destino].arquivos, 0)).toBe(Object.keys(arquivos).length)
    expect(relatorio.contagens).toEqual({
      campanhas: 1, sessoes: 1, cadernos: 1, paginas: 4, personagens: 2, cenarios: 2, itens: 1, quadros: 3,
      vinculos: 5, participacoes: 4, relacoes: 1, imagens: 3, imagensUnicas: 2, chats: 1, pastas: 2, lixeira: 1,
    })
    expect(relatorio.destinos.soOriginal.arquivos).toBe(1)
    expect(relatorio.destinos.ignorado.arquivos).toBe(1)
    expect(relatorio.falhas).toEqual([])
    expect(relatorio.podeAplicar).toBe(true)
    expect(relatorio.saida).toMatchObject({ verbetes: { personagem: 2, lugar: 2, item: 1, faccao: 0, pagina: 5, sessao: 1 }, chats: 1, teia: 1, lixeira: 1 })
    expect(plano.modo).toBe('importacao')

    const capita = verbeteDe(plano.verbetes, 'pers-capita')
    expect(capita.formaAtivaId).toBe('v-noite')
    expect(capita.campanhas).toEqual(['camp-mar'])
    expect(capita.organizacao).toEqual(['Piratas'])
    expect(capita.extras).toEqual({ criadoEm: CRIADO, modificadoEm: MODIFICADO })
    const dia = capita.formas[0]
    expect(dia.secoes.map((secao) => [secao.titulo, secao.segredo])).toEqual([['Descrição', false], ['Anotações', true]])
    expect(dia.retrato).toMatch(/^midia\/[0-9a-f]{64}\.png$/)
    expect(dia.imagens).toEqual([{ midia: dia.retrato, legenda: 'De frente' }])
    expect(dia.acervo).toEqual([{ itemId: 'item-bussola', qtd: 1 }])
    expect(capita.origem?.grimorio?.hash).toMatch(HASH)

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
    expect(plano.ligacoes.ligacoes).toEqual([
      {
        id: 'v5', de: 'pers-capita', para: 'cen-ilha', tipo: 'mora em', notas: 'desde o teste', segredo: false,
        origem: { grimorio: { id: 'v5', caminho: 'vinculos.json', hash: expect.stringMatching(HASH) } }, extras: { criadoEm: CRIADO },
      },
    ])
    expect(relatorio.espaco.cabe).toBe(true)

    // Datas e origem em quadro e campanha (com o hash da reimportação).
    const livre = quadroDe(plano.quadros, 'canvas-livre')
    expect(livre.extras).toEqual({ criadoEm: CRIADO })
    expect(livre.origem?.grimorio).toEqual({ id: 'canvas-livre', caminho: 'canvases-soltos/quadro-livre.json', hash: expect.stringMatching(HASH) })
    expect(plano.indice.campanhas).toEqual([
      { id: 'camp-mar', nome: 'Mar de Teste', extras: { criadoEm: CRIADO, descricao: 'Inventada.' }, origem: { grimorio: { id: 'camp-mar', caminho: 'campanhas/mar-de-teste/campanha.json', hash: expect.stringMatching(HASH) } } },
    ])
    expect(relatorio.avisos.some((aviso) => aviso.includes('data de criação de 1 participação'))).toBe(true)

    // Página do caderno de um canvas: presa ao quadro, sem o aviso falso de "sem dono".
    expect(verbeteDe(plano.verbetes, 'pag-ideias')).toMatchObject({ campanhas: ['camp-mar'], extras: { ordem: 0, quadroId: 'canvas-livre' } })
    expect(verbeteDe(plano.verbetes, 'pag-ideias').paiId).toBeUndefined()
    expect(relatorio.avisos.filter((aviso) => aviso.includes('não tem página-mãe'))).toEqual([])

    // Chat, Teia e lixeira entram no plano, com os ids do Prelúdio.
    expect(plano.chats).toEqual([{ donoId: 'sessao-um', caminho: 'campanhas/mar-de-teste/sessoes/sessao-01.notas/chat-ia.json', conteudo: { mensagens: [{ papel: 'user', texto: 'oi', em: '' }] } }])
    expect(plano.teia).toEqual({ caminho: 'layout-teia.json', porEscopo: { cofre: { 'pers-capita': { x: 0.25, y: 0.75 } }, 'campanha:camp-mar': { 'cen-ilha': { x: 0.5, y: 0.5 } } } })
    expect(relatorio.avisos.some((aviso) => aviso.includes('1 posição(ões) do layout-teia.json'))).toBe(true)
    expect(plano.lixeira.map((entrada) => [entrada.id, entrada.arquivos.map((arquivo) => arquivo.caminho)])).toEqual([
      ['lix-1', ['.lixeira/lix-1/descartado.json', '.lixeira/lix-1/entrada.json']],
    ])

    // A tabela de mídia acha o caminho com qualquer grafia (o cofre cita `imagens/`, o disco tem `Imagens/`).
    expect(midiaDaTabela(relatorio.tabelaDeMidia, 'imagens/canvas/mapa.png')).toMatch(/^midia\/[0-9a-f]{64}\.png$/)
    expect(midiaDaTabela(relatorio.tabelaDeMidia, 'Imagens/canvas/mapa.png')).toBe(midiaDaTabela(relatorio.tabelaDeMidia, 'imagens/canvas/mapa.png'))
    expect(midiaDaTabela(relatorio.tabelaDeMidia, 'imagens/canvas/sumiu.png')).toBeNull()
    // A imagem do quadro que não existe entra no aviso.
    expect(relatorio.avisos).toContain('1 imagem(ns) citadas nas fichas, páginas ou quadros não existem no cofre.')
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
        'layout-teia.json': vazio,
        'campanhas/c/sessoes/s.notas/chat-ia.json': '{"mensagens": [',
      }).leitor,
    )
    expect(relatorio.cadaArquivoUmDestino).toBe(true)
    expect(relatorio.falhas).toEqual([])
    expect(plano.verbetes.map((verbete) => verbete.tipo).sort()).toEqual(['item', 'lugar', 'pagina', 'pagina', 'personagem', 'sessao'])
    expect(plano.verbetes.every((verbete) => /^grim-[0-9a-f]{32}$/.test(verbete.id))).toBe(true)
    expect(plano.verbetes.every((verbete) => verbete.extras === undefined || !('criadoEm' in verbete.extras))).toBe(true)
    expect(plano.quadros.map(({ quadro }) => quadro.tldraw)).toEqual([null, null])
    expect(plano.indice.campanhas).toHaveLength(1)
    expect(relatorio.avisos.some((aviso) => aviso.includes('sem id'))).toBe(true)
    // Chat quebrado não conta como importado: fica só no original, e o plano não o leva.
    expect(relatorio.porTipo.chat).toEqual({ lidos: 1, importados: 0, soOriginal: 1, ignorados: 0, falhas: 0 })
    expect(plano.chats).toEqual([])
    expect(plano.teia).toEqual({ caminho: 'layout-teia.json', porEscopo: {} })
    // Sem a medida do espaço livre, o "Aplicar" fica travado.
    expect(relatorio.espaco.cabe).toBeNull()
    expect(relatorio.podeAplicar).toBe(false)
    expect(relatorio.motivosParaNaoAplicar).toEqual([expect.stringContaining('não foi medido')])
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
    const { relatorio } = await simularImportacao(falso.leitor, COM_ESPACO)

    expect(falso.listadas).not.toContain('Imagens/de-fora')
    expect(relatorio.arquivos.map((arquivo) => arquivo.caminho)).not.toContain('Imagens/de-fora/foto.png')
    expect(relatorio.falhas).toEqual([expect.objectContaining({ caminho: 'Imagens/de-fora', motivo: expect.stringContaining('atalho') })])
    expect(relatorio.arquivos.find((arquivo) => arquivo.caminho === 'Imagens/de-fora')).toMatchObject({ bytes: 0, destino: 'falha' })
    expect(relatorio.cadaArquivoUmDestino).toBe(true)
    expect(relatorio.podeAplicar).toBe(false)
    expect(relatorio.motivosParaNaoAplicar).toHaveLength(1)
  })

  it('cópias de conflito não entram: o relatório só compara com o original e avisa o que tem a mais, o que só difere e o que não leu', async () => {
    const original = cofreInventado()
    const capitaSemAcervo: unknown = JSON.parse(String(original['personagens-soltos/piratas/capita.json']))
    if (!ehRegistro(capitaSemAcervo) || !Array.isArray(capitaSemAcervo.versoes) || !ehRegistro(capitaSemAcervo.versoes[0])) throw new Error('capita inventada mudou')
    capitaSemAcervo.versoes[0].acervo = []
    // Caminho de imagem que mudou (organizar imagens): difere, mas não é texto escrito.
    capitaSemAcervo.versoes[0].retrato = 'imagens/personagens/Capita/retrato-de-antes-de-organizar.png'
    const copias = cofreFalso({
      'canvases-soltos/quadro-livre (conflito — Grimorio 13-08 22h29).json': json({ id: 'outro-id', nome: 'Quadro livre (conflito — Grimorio 13-08 22h29)', documento: tldraw(['shape:b', 'shape:nova']) }),
      'personagens-soltos/piratas/capita (conflito — Grimorio 12-08 14h51).json': String(original['personagens-soltos/piratas/capita.json']).replace('"pers-capita"', '"id-novo"'),
      'personagens-soltos/piratas/capita (conflito — Grimorio 12-08 15h00).json': json(capitaSemAcervo),
      'cenarios/mares/ilha (conflito — Grimorio 13-08 23h03) (2)/cenario.json': String(original['cenarios/mares/ilha/cenario.json']).replace('<p>Ilha.</p>', '<p>Ilha <em>velha</em>.</p>'),
      'canvases-soltos/sumido (conflito — Grimorio 14-08 00h03).json': json({ id: 'z', nome: 'Sumido', documento: null }),
      // O Grimório marca o nome dentro do JSON com o prefixo "(conflito) ".
      'canvases-soltos/descartado (conflito — Grimorio 14-08 00h08).json': json({ id: 'outro', nome: '(conflito) Descartado' }),
      'itens/bussola (conflito — Grimorio 13-08 10h00).json': '{"nome": ',
    })
    const { relatorio, plano } = await simularImportacao(cofreFalso(original).leitor, { ...COM_ESPACO, copiasDeConflito: copias.leitor })

    const situacoes = Object.fromEntries((relatorio.copiasDeConflito?.comparacoes ?? []).map((comparacao) => [comparacao.copia, [comparacao.situacao, comparacao.naLixeira]]))
    expect(situacoes).toEqual({
      'canvases-soltos/quadro-livre (conflito — Grimorio 13-08 22h29).json': ['temCoisaAMais', false],
      'personagens-soltos/piratas/capita (conflito — Grimorio 12-08 14h51).json': ['igual', false],
      // Lista vazia onde o original tem item: a cópia tem MENOS.
      'personagens-soltos/piratas/capita (conflito — Grimorio 12-08 15h00).json': ['soDiferencas', false],
      // Palavra nova dentro de um campo que o original também tem.
      'cenarios/mares/ilha (conflito — Grimorio 13-08 23h03) (2)/cenario.json': ['temCoisaAMais', false],
      'canvases-soltos/sumido (conflito — Grimorio 14-08 00h03).json': ['semOriginal', false],
      'canvases-soltos/descartado (conflito — Grimorio 14-08 00h08).json': ['igual', true],
      'itens/bussola (conflito — Grimorio 13-08 10h00).json': ['naoLida', false],
    })
    expect(relatorio.copiasDeConflito).toMatchObject({ arquivos: 7, comCoisaAMais: 2, soDiferencas: 1, naoLidas: 1, pastasIlegiveis: [] })
    expect(relatorio.avisos.filter((aviso) => aviso.includes('cópia(s) de conflito'))).toEqual(
      expect.arrayContaining([expect.stringContaining('2 cópia(s)'), expect.stringContaining('1 cópia(s) de conflito têm valores diferentes'), expect.stringContaining('1 cópia(s) de conflito não deram')]),
    )
    expect(plano.verbetes.some((verbete) => verbete.id === 'id-novo')).toBe(false)
    expect(relatorio.cofre.arquivos).toBe(Object.keys(original).length)
  })

  it('cópias de conflito numa pasta que o app não consegue listar: o relatório diz que NÃO comparou, nunca "nada a mais" calado', async () => {
    const foraDoEscopo: LeitorDoCofre = {
      listar: () => Promise.reject(new Error('forbidden path')),
      info: () => Promise.reject(new Error('forbidden path')),
      lerTexto: () => Promise.reject(new Error('forbidden path')),
      lerBytes: () => Promise.reject(new Error('forbidden path')),
    }
    const { relatorio } = await simularImportacao(cofreFalso(cofreInventado()).leitor, { ...COM_ESPACO, copiasDeConflito: foraDoEscopo })
    expect(relatorio.copiasDeConflito).toMatchObject({ arquivos: 0, comCoisaAMais: 0, pastasIlegiveis: [{ caminho: '', motivo: 'forbidden path' }] })
    expect(relatorio.avisos.some((aviso) => aviso.includes('NÃO foi feita') && aviso.includes('forbidden path'))).toBe(true)
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
    const { relatorio, plano: paraGravar } = await simularImportacao(cofreFalso(mudado).leitor, { ...COM_ESPACO, existentes: { verbetes: existentes } })

    const plano = relatorio.reimportacao?.verbetes
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
    // O plano que o "Aplicar" grava traz só o que entra ou é trocado: o editado e o igual ficam como estão.
    expect(paraGravar.modo).toBe('reimportacao')
    const gravados = paraGravar.verbetes.map((verbete) => verbete.id)
    expect(gravados).toContain('pers-capita')
    expect(gravados).toContain('cen-ilha')
    expect(gravados).not.toContain('item-bussola')
    expect(gravados).not.toContain('cen-porto')
    expect(gravados).not.toContain(idDoAntigo)
  })

  it('reimportar: revelar conta como editar; com o Grimório mudado o revelado fica (o mestre decide), com o Grimório igual nada muda', async () => {
    const antes = await simularImportacao(cofreFalso(cofreInventado()).leitor)
    const existentes = ['pers-capita', 'cen-porto', 'item-bussola'].map((id) => verbeteDe(antes.plano.verbetes, id))
    const mudado = cofreInventado()
    mudado['personagens-soltos/piratas/capita.json'] = String(mudado['personagens-soltos/piratas/capita.json']).replace('Navega em testes.', 'Na verdade é filha do Almirante.')
    mudado['itens/bussola.json'] = json({ id: 'item-bussola', nome: 'Bússola Falsa', resumo: 'Aponta para outro teste.', retrato: null, descricao: '<p>d</p>', informacao: '', efeito: '<p>e</p>' })
    // A Capitã e o Porto têm revelação (a forma ou a seção basta); a Bússola não.
    const noPreludio: NoPreludio = { verbetes: existentes, revelados: new Set(['pers-capita', 'cen-porto']) }
    const { relatorio, plano: paraGravar } = await simularImportacao(cofreFalso(mudado).leitor, { ...COM_ESPACO, existentes: noPreludio })

    const plano = relatorio.reimportacao?.verbetes
    expect(plano?.editadosNoPreludio).toEqual([{ id: 'pers-capita', titulo: verbeteDe(antes.plano.verbetes, 'pers-capita').titulo, mudouNoGrimorioTambem: true, revelado: true }])
    expect(plano?.atualizar).toEqual(['item-bussola'])
    expect(plano?.iguais).toEqual(['cen-porto'])
    const gravados = paraGravar.verbetes.map((verbete) => verbete.id)
    expect(gravados).toContain('item-bussola')
    expect(gravados).not.toContain('pers-capita')
    // Sem a lista de revelados (quem chamou não leu o revelado), vale a regra do hash: a Capitã seria trocada.
    const semRevelados = await simularImportacao(cofreFalso(mudado).leitor, { ...COM_ESPACO, existentes: { verbetes: existentes } })
    expect([...(semRevelados.relatorio.reimportacao?.verbetes.atualizar ?? [])].sort()).toEqual(['item-bussola', 'pers-capita'])
  })

  it('reimportar quadro, ligação e campanha: a pasta ligada, a ligação do Prelúdio, o segredo marcado e o quadro editado ficam; o apagado não volta', async () => {
    const antes = (await simularImportacao(cofreFalso(cofreInventado()).leitor, COM_ESPACO)).plano
    const [campanha] = antes.indice.campanhas
    const [ligacaoImportada] = antes.ligacoes.ligacoes
    const livre = quadroDe(antes.quadros, 'canvas-livre')
    const daSessao = quadroDe(antes.quadros, 'sessao-um')
    const fotoDaSessao = ehRegistro(daSessao.tldraw) ? daSessao.tldraw : {}
    const existentes: NoPreludio = {
      verbetes: antes.verbetes.filter((verbete) => verbete.id !== 'item-bussola'),
      quadros: [
        { id: 'canvas-livre', quadro: { ...livre, nome: 'Renomeado no Prelúdio' } },
        // Só a vista mudou (câmera): olhar não é editar.
        { id: 'sessao-um', quadro: { ...daSessao, tldraw: { ...fotoDaSessao, session: { camera: 99 } } } },
      ],
      ligacoes: [{ ...ligacaoImportada, segredo: true }, { id: 'lig-do-mestre', de: 'pers-capita', para: 'item-bussola', tipo: 'carrega', notas: '', segredo: false }],
      campanhas: [{ ...campanha, pastaId: 'pasta-do-labirinto' }],
      apagados: { verbetes: ['item-bussola'], quadros: ['mapa-masmorra'] },
    }
    const mudado = cofreInventado()
    mudado['campanhas/mar-de-teste/campanha.json'] = json({ id: 'camp-mar', nome: 'Mar de Teste', descricao: 'Inventada de novo.', criadoEm: CRIADO })
    mudado['canvases-soltos/quadro-livre.json'] = String(mudado['canvases-soltos/quadro-livre.json']).replace('"shape:b"', '"shape:c"')
    mudado['vinculos.json'] = String(mudado['vinculos.json']).replace('desde o teste', 'desde o teste de novo')
    const { relatorio, plano } = await simularImportacao(cofreFalso(mudado).leitor, { ...COM_ESPACO, existentes })

    const reimportacao = relatorio.reimportacao
    expect(reimportacao?.verbetes.apagadosNoPreludio).toEqual([{ id: 'item-bussola', titulo: 'Bússola Falsa' }])
    expect(reimportacao?.verbetes.novos).toEqual([])
    expect(reimportacao?.quadros).toMatchObject({
      editadosNoPreludio: [{ id: 'canvas-livre', titulo: 'Renomeado no Prelúdio', mudouNoGrimorioTambem: true }],
      iguais: ['sessao-um'],
      apagadosNoPreludio: [{ id: 'mapa-masmorra', titulo: 'Masmorra' }],
      novos: [],
    })
    expect(reimportacao?.ligacoes.editadosNoPreludio).toEqual([{ id: 'v5', titulo: 'pers-capita → cen-ilha (mora em)', mudouNoGrimorioTambem: true }])
    expect(reimportacao?.campanhas.atualizar).toEqual(['camp-mar'])

    expect(plano.verbetes).toEqual([])
    expect(plano.quadros).toEqual([])
    expect(plano.indice.campanhas).toEqual([expect.objectContaining({ id: 'camp-mar', pastaId: 'pasta-do-labirinto', extras: { criadoEm: CRIADO, descricao: 'Inventada de novo.' } })])
    expect(plano.ligacoes.ligacoes.map((ligacao) => [ligacao.id, ligacao.segredo, ligacao.notas])).toEqual([
      ['v5', true, 'desde o teste'],
      ['lig-do-mestre', false, ''],
    ])
  })

  it('abrir o verbete no editor (atributos padrão, parágrafo final do TrailingNode) não conta como edição', async () => {
    const antes = (await simularImportacao(cofreFalso(cofreInventado()).leitor, COM_ESPACO)).plano
    const capita = verbeteDe(antes.verbetes, 'pers-capita')
    const aberta = abertoNoEditor(capita)
    const informacao = aberta.formas[1].secoes[0].texto.content ?? []
    // A seção termina em lista com link: o editor de fato muda o JSON.
    expect(informacao.map((no) => (ehRegistro(no) ? no.type : '?'))).toEqual(['paragraph', 'bulletList', 'paragraph'])
    expect(aberta).not.toEqual(capita)

    const { relatorio } = await simularImportacao(cofreFalso(cofreInventado()).leitor, { ...COM_ESPACO, existentes: { verbetes: [aberta] } })
    expect(relatorio.reimportacao?.verbetes.iguais).toEqual(['pers-capita'])
    expect(relatorio.reimportacao?.verbetes.editadosNoPreludio).toEqual([])
  })
})
