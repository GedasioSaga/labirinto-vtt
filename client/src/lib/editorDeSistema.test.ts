/**
 * EDITOR DE SISTEMA (entrega 6) — o rascunho e o "Salvar": cada regra que
 * recusa (com a seção e a razão), o id que sai do nome, a ida e volta pelo
 * mesmo leitor do "Importar", a cópia do embutido e a prévia do rank.
 */
import { describe, expect, it } from 'vitest'
import {
  abaNova,
  atributoNovo,
  campoNovo,
  capituloNovo,
  copiaDoSistema,
  escolhaNova,
  idDoNome,
  itemNovo,
  moverLinha,
  nomeDaCopia,
  personagemDeExemplo,
  previaDoRank,
  rascunhoDaCopia,
  rascunhoDoSistema,
  rascunhoEmBranco,
  recursoNovo,
  sistemaDoRascunho,
  tabelaDoRascunho,
  type ErroDoEditor,
  type RascunhoDoSistema,
} from './editorDeSistema'
import { CAPITULO_TEXTO_MAX, CAPITULO_TITULO_MAX, CATALOGO_TEXTO_MAX, lerSistemaDoTexto, serializarSistema, type SistemaDeRpg } from './sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

const BIBLIOTECA = new Set([SISTEMA_ONE_PIECE.id])

/** Um sistema pequeno e válido, do zero, para cada teste quebrar uma coisa só. */
function rascunhoValido(): RascunhoDoSistema {
  const rascunho = rascunhoEmBranco()
  return {
    ...rascunho,
    nome: 'Sistema da Casa',
    atributos: [{ ...atributoNovo(), nome: 'Força', abreviacao: 'FOR', comRank: true, inicial: '1', limiares: '40, 90' }],
  }
}

function salvar(rascunho: RascunhoDoSistema): SistemaDeRpg {
  const resultado = sistemaDoRascunho(rascunho, BIBLIOTECA)
  if (!resultado.ok) throw new Error(`o rascunho deveria salvar: ${resultado.erros.map((erro) => erro.texto).join(' | ')}`)
  return resultado.sistema
}

function errosDe(rascunho: RascunhoDoSistema): ErroDoEditor[] {
  const resultado = sistemaDoRascunho(rascunho, BIBLIOTECA)
  if (resultado.ok) throw new Error('o rascunho deveria ser recusado')
  return resultado.erros
}

describe('ida e volta', () => {
  it('One Piece → rascunho → salvar devolve o mesmo sistema (livro e catálogos inclusos)', () => {
    expect(salvar(rascunhoDoSistema(SISTEMA_ONE_PIECE))).toEqual(SISTEMA_ONE_PIECE)
  })

  it('o que o editor grava é o que a leitura do arquivo daria: salvar → arquivo → ler → mesmo sistema → mesmo rascunho', () => {
    const sistema = salvar(rascunhoValido())
    const relido = lerSistemaDoTexto(serializarSistema(sistema))
    expect(relido).toEqual({ ok: true, sistema })
    if (!relido.ok) return
    expect(salvar(rascunhoDoSistema(relido.sistema))).toEqual(sistema)
  })

  it('editar no rascunho muda só o que foi mexido: renomear o atributo mantém o id dele', () => {
    const rascunho = rascunhoDoSistema(SISTEMA_ONE_PIECE)
    const editado = salvar({ ...rascunho, atributos: rascunho.atributos.map((atributo) => (atributo.id === 'forca' ? { ...atributo, nome: 'Poder' } : atributo)) })
    expect(editado.atributos.find((atributo) => atributo.id === 'forca')?.nome).toBe('Poder')
    expect(editado.atributos.map((atributo) => atributo.id)).toEqual(SISTEMA_ONE_PIECE.atributos.map((atributo) => atributo.id))
  })

  it('a linha salva vem travada (o id não muda); a nova, não', () => {
    const rascunho = rascunhoDoSistema(SISTEMA_ONE_PIECE)
    expect(rascunho.atributos.every((atributo) => !atributo.novo)).toBe(true)
    expect(atributoNovo().novo).toBe(true)
  })
})

describe('ids', () => {
  it('saem do nome sem acento e sem espaço; repetido ganha "-2"; maiúscula não engana (nome de arquivo no Windows)', () => {
    expect(idDoNome('Força Bruta!', new Set(), 'atributo')).toBe('forca-bruta')
    expect(idDoNome('Força', new Set(['forca']), 'atributo')).toBe('forca-2')
    expect(idDoNome('Casa', new Set(['Casa']), 'sistema')).toBe('casa-2')
    expect(idDoNome('!!!', new Set(), 'atributo')).toBe('atributo')
  })

  it('o sistema novo pega um id que a biblioteca não usa; as partes novas, ids do nome', () => {
    const rascunho = rascunhoValido()
    const sistema = salvar({
      ...rascunho,
      nome: 'One Piece',
      recursos: [{ ...recursoNovo(), nome: 'Pontos de Vida' }],
      escolhas: [{ ...escolhaNova(), rotulo: 'Raça', opcoes: 'Humano\nAnão' }],
    })
    expect(sistema.id).toBe('one-piece-2')
    expect(sistema.atributos[0].id).toBe('forca')
    expect(sistema.recursos[0].id).toBe('pontos-de-vida')
    expect(sistema.escolhas[0]).toEqual({ id: 'raca', rotulo: 'Raça', opcoes: ['Humano', 'Anão'] })
  })

  it('id digitado na linha nova vale; dois nomes iguais sem id não colidem', () => {
    const rascunho = rascunhoValido()
    const sistema = salvar({
      ...rascunho,
      atributos: [...rascunho.atributos, { ...atributoNovo(), nome: 'Força', abreviacao: 'FO2' }, { ...atributoNovo(), id: 'sorte', nome: 'Destino', abreviacao: 'DES' }],
    })
    expect(sistema.atributos.map((atributo) => atributo.id)).toEqual(['forca', 'forca-2', 'sorte'])
  })
})

describe('o Salvar recusa, dizendo o quê e onde', () => {
  const casos: [string, (rascunho: RascunhoDoSistema) => RascunhoDoSistema, ErroDoEditor][] = [
    ['sistema sem nome', (r) => ({ ...r, nome: '  ' }), { secao: 'geral', texto: 'O sistema precisa de um nome.' }],
    ['cor torta', (r) => ({ ...r, cor: 'vermelho' }), { secao: 'geral', texto: 'A cor da capa precisa ser #rrggbb.' }],
    ['nenhum atributo', (r) => ({ ...r, atributos: [] }), { secao: 'atributos', texto: 'O sistema precisa de pelo menos um atributo.' }],
    ['atributo sem nome', (r) => ({ ...r, atributos: [{ ...r.atributos[0], nome: '' }] }), { secao: 'atributos', texto: 'O atributo 1 está sem nome.' }],
    ['atributo sem abreviação', (r) => ({ ...r, atributos: [{ ...r.atributos[0], abreviacao: ' ' }] }), { secao: 'atributos', texto: 'Força: falta a abreviação (o rótulo curto dos chips, como FOR).' }],
    [
      'id repetido',
      (r) => ({ ...r, atributos: [{ ...r.atributos[0], id: 'forca' }, { ...atributoNovo(), id: 'forca', nome: 'Fúria', abreviacao: 'FUR' }] }),
      { secao: 'atributos', texto: 'Atributos: o id "forca" está repetido.' },
    ],
    [
      'id com caractere que sai da pasta',
      (r) => ({ ...r, recursos: [{ ...recursoNovo(), id: '../hp', nome: 'HP' }] }),
      { secao: 'recursos', texto: 'Recursos: o id "../hp" só pode ter letras sem acento, números, - e _ (até 64, começando por letra ou número).' },
    ],
    ['limiar fora de ordem', (r) => ({ ...r, atributos: [{ ...r.atributos[0], limiares: '40, 30' }] }), { secao: 'atributos', texto: 'Força: os limiares precisam crescer, e 30 vem depois de 40.' }],
    ['limiar repetido', (r) => ({ ...r, atributos: [{ ...r.atributos[0], limiares: '40, 40' }] }), { secao: 'atributos', texto: 'Força: os limiares precisam crescer, e 40 vem depois de 40.' }],
    ['limiar que não é número', (r) => ({ ...r, atributos: [{ ...r.atributos[0], limiares: '40, muito' }] }), { secao: 'atributos', texto: 'Força: "muito" não é um número nos limiares.' }],
    ['rank inicial quebrado', (r) => ({ ...r, atributos: [{ ...r.atributos[0], inicial: '1.5' }] }), { secao: 'atributos', texto: 'Força: o rank inicial precisa ser um número inteiro (como 1).' }],
    ['recurso sem nome', (r) => ({ ...r, recursos: [recursoNovo()] }), { secao: 'recursos', texto: 'O recurso 1 está sem nome.' }],
    ['escolha sem rótulo', (r) => ({ ...r, escolhas: [escolhaNova()] }), { secao: 'escolhas', texto: 'A escolha 1 está sem rótulo.' }],
    ['opção repetida', (r) => ({ ...r, escolhas: [{ ...escolhaNova(), rotulo: 'Raça', opcoes: 'Mink\nHumano\nMink' }] }), { secao: 'escolhas', texto: 'Raça: a opção "Mink" está repetida.' }],
    ['aba sem nome', (r) => ({ ...r, abas: [abaNova()] }), { secao: 'abas', texto: 'A aba 1 está sem nome.' }],
    ['campo sem rótulo', (r) => ({ ...r, abas: [{ ...abaNova(), nome: 'Habilidades', campos: [campoNovo()] }] }), { secao: 'abas', texto: 'Habilidades: o campo 1 está sem rótulo.' }],
    [
      'cartões de dentro de uma aba apagada',
      (r) => ({ ...r, abas: [{ ...abaNova(), nome: 'Transformações', subcartoes: 'chave-que-sumiu' }] }),
      { secao: 'abas', texto: 'Transformações: os cartões de dentro apontam para uma aba que não existe mais.' },
    ],
    ['item de catálogo sem nome', (r) => ({ ...r, catalogos: { ...r.catalogos, vantagens: [itemNovo()] } }), { secao: 'catalogos', texto: 'Vantagens: o item 1 está sem nome.' }],
    [
      'item de catálogo repetido (sem diferença de maiúscula)',
      (r) => ({ ...r, catalogos: { ...r.catalogos, racas: [{ ...itemNovo(), nome: 'Mink' }, { ...itemNovo(), nome: 'MINK' }] } }),
      { secao: 'catalogos', texto: 'Raças: "MINK" aparece duas vezes.' },
    ],
    [
      'texto de catálogo acima do teto',
      (r) => ({ ...r, catalogos: { ...r.catalogos, desvantagens: [{ ...itemNovo(), nome: 'Azar', efeito: 'x'.repeat(CATALOGO_TEXTO_MAX + 1) }] } }),
      { secao: 'catalogos', texto: 'Desvantagens · Azar: um texto passa de 8.000 letras.' },
    ],
    ['capítulo sem título', (r) => ({ ...r, livro: [capituloNovo([])] }), { secao: 'livro', texto: 'O capítulo 1 está sem título.' }],
    ['capítulo com ordem que não é número', (r) => ({ ...r, livro: [{ ...capituloNovo([]), titulo: 'Regras', ordem: 'primeiro' }] }), { secao: 'livro', texto: 'Regras: a ordem precisa ser um número.' }],
    [
      'capítulo acima do teto',
      (r) => ({ ...r, livro: [{ ...capituloNovo([]), titulo: 'Regras', texto: 'x'.repeat(CAPITULO_TEXTO_MAX + 1) }] }),
      { secao: 'livro', texto: 'Regras: o texto passa de 100.000 letras (tem 100.001).' },
    ],
  ]

  it.each(casos)('%s', (_nome, quebrar, esperado) => {
    expect(errosDe(quebrar(rascunhoValido()))).toContainEqual(esperado)
  })

  it('título de capítulo acima do teto também recusa', () => {
    const erros = errosDe({ ...rascunhoValido(), livro: [{ ...capituloNovo([]), titulo: 'T'.repeat(CAPITULO_TITULO_MAX + 1) }] })
    expect(erros.some((erro) => erro.secao === 'livro' && erro.texto.endsWith(`o título passa de ${CAPITULO_TITULO_MAX} letras.`))).toBe(true)
  })

  it('a aba não pode guardar os próprios cartões dentro dela', () => {
    const aba = { ...abaNova(), nome: 'Técnicas' }
    expect(errosDe({ ...rascunhoValido(), abas: [{ ...aba, subcartoes: aba.chave }] })).toContainEqual({ secao: 'abas', texto: 'Técnicas: os cartões de dentro não podem ser da própria aba.' })
  })

  it('todos os problemas saem de uma vez, cada um na seção dele', () => {
    const erros = errosDe({ ...rascunhoValido(), nome: '', recursos: [recursoNovo()], abas: [abaNova()] })
    expect(erros.map((erro) => erro.secao)).toEqual(['geral', 'recursos', 'abas'])
  })
})

describe('referências que seguem o rascunho', () => {
  it('os cartões de dentro apontam para a aba nova pela chave e gravam o id que ela ganhou', () => {
    const tecnicas = { ...abaNova(), nome: 'Técnicas', item: 'Técnica' }
    const formas = { ...abaNova(), nome: 'Transformações', subcartoes: tecnicas.chave }
    const sistema = salvar({ ...rascunhoValido(), abas: [tecnicas, formas] })
    expect(sistema.abas[1].subcartoes).toEqual({ aba: 'tecnicas', rotulo: 'Técnica' })
  })

  it('o atributo apagado sai das perícias do catálogo; o novo entra pelo id que ganhou', () => {
    const rascunho = rascunhoDoSistema(SISTEMA_ONE_PIECE)
    const fortitude = { ...atributoNovo(), nome: 'Fortitude', abreviacao: 'FTD' }
    const semForca = rascunho.atributos.filter((atributo) => atributo.id !== 'forca')
    const pericias = rascunho.catalogos.pericias.map((pericia, i) => (i === 0 ? { ...pericia, atributos: [...pericia.atributos, fortitude.chave] } : pericia))
    const sistema = salvar({ ...rascunho, atributos: [...semForca, fortitude], catalogos: { ...rascunho.catalogos, pericias } })
    const todas = sistema.catalogos?.pericias.flatMap((pericia) => pericia.atributos) ?? []
    expect(todas).not.toContain('forca')
    expect(sistema.catalogos?.pericias[0].atributos).toContain('fortitude')
  })

  it('mover troca a ordem pela chave; na ponta, nada muda', () => {
    const [a, b] = [escolhaNova(), escolhaNova()]
    expect(moverLinha([a, b], b.chave, -1)).toEqual([b, a])
    expect(moverLinha([a, b], a.chave, -1)).toEqual([a, b])
  })
})

describe('cópia do embutido', () => {
  it('"Duplicar": nome "(cópia)", id que ninguém usa, as mesmas partes com os mesmos ids', () => {
    const copia = copiaDoSistema(SISTEMA_ONE_PIECE, [SISTEMA_ONE_PIECE])
    expect({ id: copia.id, nome: copia.nome }).toEqual({ id: 'one-piece-copia', nome: 'One Piece (cópia)' })
    expect(copia.atributos).toEqual(SISTEMA_ONE_PIECE.atributos)
    const segunda = copiaDoSistema(SISTEMA_ONE_PIECE, [SISTEMA_ONE_PIECE, copia])
    expect({ id: segunda.id, nome: segunda.nome }).toEqual({ id: 'one-piece-copia-2', nome: 'One Piece (cópia 2)' })
  })

  it('"Editar" do embutido abre a cópia como sistema novo; salvar não toca o id do embutido', () => {
    const rascunho = rascunhoDaCopia(SISTEMA_ONE_PIECE, nomeDaCopia(SISTEMA_ONE_PIECE.nome, [SISTEMA_ONE_PIECE.nome]))
    expect(rascunho.novo).toBe(true)
    const sistema = salvar(rascunho)
    expect(sistema.id).toBe('one-piece-copia')
    expect(sistema.abas.map((aba) => aba.id)).toEqual(SISTEMA_ONE_PIECE.abas.map((aba) => aba.id))
    expect(sistema.livro).toEqual(SISTEMA_ONE_PIECE.livro)
  })
})

describe('prévia do rank', () => {
  it('"valor 60 → R2" com a tabela digitada, e o que falta quando não dá para dizer', () => {
    const forca = { comRank: true, inicial: '1', limiares: '40, 90, 150', teste: '60' }
    expect(previaDoRank(forca)).toBe('valor 60 → R2')
    expect(previaDoRank({ ...forca, teste: '39' })).toBe('valor 39 → R1')
    expect(previaDoRank({ ...forca, teste: '150' })).toBe('valor 150 → R4')
    expect(previaDoRank({ ...forca, teste: '' })).toBe('digite um valor')
    expect(previaDoRank({ ...forca, teste: 'muito' })).toBe('digite um valor')
    expect(previaDoRank({ ...forca, limiares: '90, 40' })).toBe('corrija a tabela')
    expect(previaDoRank({ ...forca, comRank: false })).toBe('sem rank')
  })

  it('a tabela aceita vírgula, espaço e ponto e vírgula; sem limiar, o rank fica no inicial', () => {
    expect(tabelaDoRascunho('0', '1 35;75, 115')).toEqual({ ok: true, tabela: { inicial: 0, limiares: [1, 35, 75, 115] } })
    expect(tabelaDoRascunho('2', '')).toEqual({ ok: true, tabela: { inicial: 2, limiares: [] } })
  })
})

describe('personagem da prévia', () => {
  it('mostra cada parte do sistema: primeira opção, recurso pela metade, atributo no primeiro limiar, um cartão por aba', () => {
    const exemplo = personagemDeExemplo(SISTEMA_ONE_PIECE)
    expect(exemplo.escolhas).toEqual({ raca: 'Humano', oficio: 'Arqueólogo' })
    expect(exemplo.recursos.hp).toBe(8)
    expect(exemplo.maximos.hp).toBe(10)
    expect(exemplo.atributos.forca).toBe(40)
    expect(Object.keys(exemplo.abas)).toEqual(SISTEMA_ONE_PIECE.abas.map((aba) => aba.id))
  })
})
