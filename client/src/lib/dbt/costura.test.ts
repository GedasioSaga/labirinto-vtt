/**
 * COSTURA DO DRAGON BALL TALES (fase 1 do plano docs/planos/sistema-dragon-ball.md):
 * o motor atravessa leitura, editor e cópia; o sistema embutido usa só campos
 * genéricos; `Personagem.dbt` atravessa disco, fio, edição do jogador e host.
 * E o aditivo: sistema e ficha do One Piece saem iguais.
 */
import { describe, expect, it } from 'vitest'
import { aplicarPartes, ERRO_FICHA_DBT_GRANDE, mensagensDoSalvar, partesMudadas, type MensagemDoSalvar } from '../../net/edicaoDoPersonagem'
import { PLAYER_MESSAGE_MAX_BYTES } from '../../net/protocol'
import { parsePartesDoPersonagem } from '../../net/protocoloDoPersonagem'
import { copiaDoSistema, rascunhoDaCopia, rascunhoDoSistema, sistemaDoRascunho } from '../editorDeSistema'
import { editavelNoEditor, motorDoSistema } from '../motores'
import { novoPersonagem, paraOFio, personagemDoArquivo, type Personagem } from '../personagem'
import { lerSistemaDeRpg, lerSistemaDoTexto, serializarSistema, type SistemaDeRpg } from '../sistemaDeRpg'
import { SISTEMA_ONE_PIECE, SISTEMAS_EMBUTIDOS } from '../sistemaOnePiece'
import { ATRIBUTO_INICIAL, fichaDBTVazia, ID_SISTEMA_DBT, IDS_DOS_ATRIBUTOS, type FichaDBT } from './modelo'
import { SISTEMA_DRAGON_BALL } from './sistemaDragonBall'

const bytes = (mensagem: MensagemDoSalvar): number => new TextEncoder().encode(JSON.stringify(mensagem)).length
const cabe = (mensagem: MensagemDoSalvar): boolean => bytes(mensagem) <= PLAYER_MESSAGE_MAX_BYTES

function salvar(base: Personagem, rascunho: Personagem) {
  let n = 0
  return mensagensDoSalvar(base, rascunho, { novoReqId: () => `p${++n}`, cabe })
}

function salvarNoEditor(sistema: SistemaDeRpg, biblioteca: ReadonlySet<string> = new Set()): SistemaDeRpg {
  const resultado = sistemaDoRascunho(rascunhoDoSistema(sistema), biblioteca)
  if (!resultado.ok) throw new Error(resultado.erros.map((erro) => erro.texto).join(' | '))
  return resultado.sistema
}

function goku(): Personagem & { dbt: FichaDBT } {
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, 'jogador', 'Goku')
  return { ...novo, id: 'pers_goku', dbt: novo.dbt ?? fichaDBTVazia() }
}

describe('motor do sistema', () => {
  it('a leitura preserva o motor Dragon Ball, do arquivo e de volta', () => {
    expect(lerSistemaDoTexto(serializarSistema(SISTEMA_DRAGON_BALL))).toEqual({ ok: true, sistema: SISTEMA_DRAGON_BALL })
  })

  it('motor padrão no arquivo não é gravado; o One Piece segue sem a chave', () => {
    const lido = lerSistemaDeRpg({ ...SISTEMA_ONE_PIECE, motor: 'padrao' })
    expect(lido).toEqual({ ok: true, sistema: SISTEMA_ONE_PIECE })
    expect(lido.ok && 'motor' in lido.sistema).toBe(false)
  })

  it('motor que o app não conhece recusa o arquivo, com a razão', () => {
    const lido = lerSistemaDeRpg({ ...SISTEMA_ONE_PIECE, motor: 'pokemon' })
    expect(lido.ok).toBe(false)
  })

  it('motorDoSistema e editavelNoEditor: sem sistema e One Piece são o padrão', () => {
    expect(motorDoSistema(SISTEMA_ONE_PIECE)).toBe('padrao')
    expect(motorDoSistema(null)).toBe('padrao')
    expect(motorDoSistema(undefined)).toBe('padrao')
    expect(motorDoSistema(SISTEMA_DRAGON_BALL)).toBe('dragon-ball-tales')
    expect(editavelNoEditor(SISTEMA_ONE_PIECE)).toBe(true)
    expect(editavelNoEditor(SISTEMA_DRAGON_BALL)).toBe(false)
  })
})

describe('sistema Dragon Ball embutido', () => {
  it('está nos embutidos, com o id do contrato', () => {
    expect(SISTEMAS_EMBUTIDOS.map((sistema) => sistema.id)).toEqual(['one-piece', ID_SISTEMA_DBT])
  })

  it('só campos genéricos: os 7 atributos, PV (vida) e PK (energia) com máximo, nenhuma aba do One Piece', () => {
    expect(SISTEMA_DRAGON_BALL.atributos.map((atributo) => atributo.id)).toEqual([...IDS_DOS_ATRIBUTOS])
    expect(SISTEMA_DRAGON_BALL.atributos.map((atributo) => atributo.abreviacao)).toEqual(['FOR', 'DES', 'CON', 'INT', 'SAB', 'POD', 'PRE'])
    expect(SISTEMA_DRAGON_BALL.recursos).toEqual([
      { id: 'pv', nome: 'PV', tom: 'vida', atualEMaximo: true },
      { id: 'pk', nome: 'PK', tom: 'energia', atualEMaximo: true },
    ])
    expect(SISTEMA_DRAGON_BALL.abas.some((aba) => ['armas', 'balas', 'habilidades'].includes(aba.id))).toBe(false)
  })
})

describe('editor de sistema', () => {
  it('rascunho → salvar devolve o Dragon Ball com o motor', () => {
    expect(salvarNoEditor(SISTEMA_DRAGON_BALL)).toEqual(SISTEMA_DRAGON_BALL)
  })

  it('a cópia (do editor e do Duplicar) herda o motor', () => {
    expect(rascunhoDaCopia(SISTEMA_DRAGON_BALL, 'Meu DB').motor).toBe('dragon-ball-tales')
    expect(copiaDoSistema(SISTEMA_DRAGON_BALL, SISTEMAS_EMBUTIDOS).motor).toBe('dragon-ball-tales')
  })

  it('a cópia editada do One Piece guarda as opções dos campos (Tipo da habilidade)', () => {
    const salvo = salvarNoEditor(SISTEMA_ONE_PIECE)
    const opcoes = (sistema: SistemaDeRpg) => sistema.abas.flatMap((aba) => aba.campos.map((campo) => campo.opcoes ?? null))
    expect(opcoes(salvo)).toEqual(opcoes(SISTEMA_ONE_PIECE))
    expect(salvo).toEqual(SISTEMA_ONE_PIECE)
  })
})

describe('Personagem.dbt', () => {
  it('ficha nova do One Piece não tem dbt; a do Dragon Ball nasce com a ficha vazia e atributos em 8', () => {
    expect('dbt' in novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy')).toBe(false)
    const novo = novoPersonagem(SISTEMA_DRAGON_BALL, 'jogador', 'Goku')
    expect(novo.dbt).toEqual(fichaDBTVazia())
    expect(Object.values(novo.atributos)).toEqual(IDS_DOS_ATRIBUTOS.map(() => ATRIBUTO_INICIAL))
    expect(novo.recursos).toEqual({ pv: 0, pk: 0 })
  })

  it('atravessa o disco e o fio', () => {
    const ficha = { ...goku(), dbt: { ...fichaDBTVazia(), pdl: 30_000, historia: 'Criado nas montanhas.' } }
    const relido = personagemDoArquivo(JSON.parse(JSON.stringify(ficha)))
    expect(relido?.dbt).toEqual(ficha.dbt)
    expect(paraOFio({ ...ficha, notaDoMestre: 'segredo' }).dbt).toEqual(ficha.dbt)
  })

  it('dbt torto ou de versão futura some na leitura, sem a chave', () => {
    expect('dbt' in (personagemDoArquivo({ ...goku(), dbt: 'x' }) ?? {})).toBe(false)
    expect('dbt' in (personagemDoArquivo({ ...goku(), dbt: { versao: 99 } }) ?? {})).toBe(false)
  })
})

describe('edição do jogador com dbt', () => {
  it('o host aceita a ficha Dragon Ball inteira e recusa a torta', () => {
    const dbt = { ...fichaDBTVazia(), pdl: 1000 }
    expect(parsePartesDoPersonagem({ dbt })).toEqual({ dbt })
    expect(parsePartesDoPersonagem({ dbt: 'x' })).toBeNull()
    expect(parsePartesDoPersonagem({ dbt: { versao: 99 } })).toBeNull()
  })

  it('o Salvar manda a ficha Dragon Ball só quando ela mudou, inteira', () => {
    const base = goku()
    expect(partesMudadas(base, { ...base, descricao: 'Saiyajin.' })).toEqual({ descricao: 'Saiyajin.' })
    const rascunho = { ...base, dbt: { ...base.dbt, pdl: 5000 } }
    expect(salvar(base, rascunho)).toEqual({
      ok: true,
      mensagens: [{ type: 'personagem.editar', reqId: 'p1', personagemId: 'pers_goku', partes: { dbt: rascunho.dbt } }],
    })
  })

  it('ficha Dragon Ball que sozinha passa do teto da mesa é recusada antes de enviar', () => {
    const base = goku()
    const longo = 'é'.repeat(20_000)
    const resultado = salvar(base, { ...base, dbt: { ...base.dbt, historia: longo, notas: longo } })
    expect(resultado).toEqual({ ok: false, erro: ERRO_FICHA_DBT_GRANDE })
  })

  it('no host, a ficha Dragon Ball troca a de agora; sem dbt nas partes, nada muda nela', () => {
    const atual = goku()
    const nova = { ...fichaDBTVazia(), pdl: 9000 }
    expect(aplicarPartes(atual, { dbt: nova }).dbt).toEqual(nova)
    expect(aplicarPartes(atual, { nome: 'Kakarotto' }).dbt).toBe(atual.dbt)
  })
})
