import { useState } from 'react'
import { Botao } from '../../grimorio/Botao'
import { CampoLiga } from '../../grimorio/CampoLiga'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { CampoTexto } from '../../grimorio/CampoTexto'
import { itemParaDar } from '../../../lib/acervoDeItens'
import { ITENS_NO_CONTEUDO_MAX, MOEDAS_NO_CONTEUDO_MAX } from '../../../lib/conteudoDoObjeto'
import { ITEM_QUANTIDADE_MAX } from '../../../lib/items'
import type { LeverDoorOption } from '../../../lib/lever'
import { castigoPadrao, TEXTO_DO_CASTIGO_PADRAO, visualEhPorta } from '../../../puzzles/padroes'
import { PV_DO_CASTIGO_MAX, TEXTO_DO_CASTIGO_MAX, TEXTO_DO_PUZZLE_MAX, type CastigoDoPuzzle, type DesfechoDoPuzzle, type TipoDeCastigo } from '../../../puzzles/tipos'
import { EscolhaDeItem, NumeroDoCampo, Secao, type PropsDaSecao } from './comum'
import '../../livro/conteudoDoObjeto.css'

const TIPOS_DA_DICA: readonly { valor: 'texto' | 'documento'; rotulo: string }[] = [
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'documento', rotulo: 'Num documento' },
]

/** "Dica" (v2): texto embaixo do quadro, ou num documento da biblioteca Documentos. */
export function SecaoDica({ puzzle, mudar }: PropsDaSecao) {
  const [querDocumento, setQuerDocumento] = useState(false)
  const { dica } = puzzle
  const tipo = dica.tipo === 'documento' || querDocumento ? 'documento' : 'texto'
  return (
    <Secao titulo="Dica">
      <CampoSeg
        nomeAcessivel="De onde vem a dica"
        opcoes={TIPOS_DA_DICA}
        valor={tipo}
        onChange={(valor) => {
          setQuerDocumento(valor === 'documento')
          if (valor === 'texto' && dica.tipo === 'documento') mudar({ ...puzzle, dica: { tipo: 'texto', texto: '' } })
        }}
      />
      {dica.tipo === 'texto' && !querDocumento && (
        <>
          <CampoTexto rotulo="Texto da dica" valor={dica.texto} multilinha maxLength={TEXTO_DO_PUZZLE_MAX} onChange={(texto) => mudar({ ...puzzle, dica: { tipo: 'texto', texto } }, 'dica')} />
          <p className="pze-nota">Aparece embaixo da tela de perto. Vazia, o jogador não vê dica.</p>
        </>
      )}
      {tipo === 'documento' && (
        <p className="pze-nota">
          {dica.tipo === 'documento'
            ? 'A dica aponta um documento da biblioteca Documentos, que chega numa próxima versão. Ela fica guardada como está.'
            : 'A biblioteca Documentos chega numa próxima versão. Até lá, a dica fica em texto.'}
        </p>
      )}
    </Secao>
  )
}

const MODOS: readonly { valor: DesfechoDoPuzzle['modo']; rotulo: string }[] = [
  { valor: 'texto', rotulo: 'Só texto' },
  { valor: 'cena', rotulo: 'Cena e texto' },
]

export interface PortaDoEditor {
  valor: string | null
  opcoes: readonly LeverDoorOption[]
  onChange: (wallId: string | null) => void
}

/** "Ao resolver" (v2 e v1): texto ou cena, os itens e as moedas do baú, os documentos e a porta do mapa. */
export function SecaoDesfecho({ puzzle, mudar, porta }: PropsDaSecao & { porta: PortaDoEditor | null }) {
  const [escolhendo, setEscolhendo] = useState(false)
  const { desfecho } = puzzle
  const mudarDesfecho = (mudanca: (atual: DesfechoDoPuzzle) => DesfechoDoPuzzle, chave?: string) => mudar((atual) => ({ ...atual, desfecho: mudanca(atual.desfecho) }), chave)
  const ehPorta = visualEhPorta(puzzle.visual)
  return (
    <Secao titulo="Ao resolver">
      <CampoSeg rotulo="Como termina" opcoes={MODOS} valor={desfecho.modo} onChange={(modo) => modo !== desfecho.modo && mudarDesfecho((atual) => ({ ...atual, modo }))} />
      <p className="pze-nota">
        {desfecho.modo === 'texto'
          ? 'O cartão com o texto aparece logo que o puzzle cede.'
          : puzzle.visual.tipo === 'imagem'
            ? 'Com imagem própria, a cena é o brilho do quadro, e depois vem o texto.'
            : 'A arte se mexe (a porta abre, a água sobe) e depois vem o texto.'}
      </p>
      <CampoTexto rotulo="O que acontece" valor={desfecho.texto} multilinha maxLength={TEXTO_DO_PUZZLE_MAX} onChange={(texto) => mudarDesfecho((atual) => ({ ...atual, texto }), 'desfecho')} />
      <div className="gr-campo">
        <span className="gr-campo__rot">Dar itens {desfecho.itens.length > 0 && <small>{desfecho.itens.reduce((soma, dentro) => soma + dentro.quantidade, 0)} no total</small>}</span>
        {desfecho.itens.length === 0 ? (
          <p className="pze-vazio">Nenhum item.</p>
        ) : (
          <ul className="pze-lista-itens">
            {desfecho.itens.map((dentro, indice) => (
              <li key={`${dentro.item.itemId ?? dentro.item.nome}-${indice}`}>
                <span className="pze-lista-itens__nome">{dentro.item.nome}</span>
                <NumeroDoCampo
                  valor={dentro.quantidade}
                  min={1}
                  max={ITEM_QUANTIDADE_MAX}
                  rotulo={`Quantidade de ${dentro.item.nome}`}
                  onChange={(quantidade) => mudarDesfecho((atual) => ({ ...atual, itens: atual.itens.map((outro, i) => (i === indice ? { ...outro, quantidade } : outro)) }), `item:${indice}`)}
                />
                <button type="button" className="pze-bt-ico" aria-label={`Tirar ${dentro.item.nome}`} onClick={() => mudarDesfecho((atual) => ({ ...atual, itens: atual.itens.filter((_, i) => i !== indice) }))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {desfecho.itens.length < ITENS_NO_CONTEUDO_MAX && (
          <Botao tamanho="p" largo aria-haspopup="dialog" aria-expanded={escolhendo} onClick={() => setEscolhendo((antes) => !antes)}>
            + Item do acervo
          </Botao>
        )}
        {escolhendo && (
          <EscolhaDeItem
            verbo="dá a quem resolver"
            aoFechar={() => setEscolhendo(false)}
            aoEscolher={(escolhido) => {
              // Sem munições, como no baú: o desfecho não guarda a lista.
              const item = itemParaDar(escolhido, [])
              mudarDesfecho((atual) => {
                const ja = atual.itens.findIndex((dentro) => dentro.item.itemId === escolhido.id)
                if (ja >= 0) return { ...atual, itens: atual.itens.map((dentro, i) => (i === ja ? { ...dentro, quantidade: Math.min(ITEM_QUANTIDADE_MAX, dentro.quantidade + 1) } : dentro)) }
                return { ...atual, itens: [...atual.itens, { item, quantidade: 1 }] }
              })
              setEscolhendo(false)
            }}
          />
        )}
      </div>
      <label className="gr-campo">
        <span className="gr-campo__rot">Moedas</span>
        <NumeroDoCampo valor={desfecho.moedas} min={0} max={MOEDAS_NO_CONTEUDO_MAX} rotulo="Moedas" onChange={(moedas) => mudarDesfecho((atual) => ({ ...atual, moedas }), 'moedas')} />
      </label>
      <p className="pze-nota">
        {desfecho.documentos.length > 0
          ? `${desfecho.documentos.length === 1 ? '1 documento ligado' : `${desfecho.documentos.length} documentos ligados`}: a biblioteca Documentos chega numa próxima versão.`
          : 'Dar documento chega com a biblioteca Documentos, numa próxima versão.'}
      </p>
      {ehPorta && (
        <div className="pze-grupo">
          <CampoLiga
            rotulo="Abre a porta do mapa"
            ajuda="A porta ligada no mapa abre para todos quando o puzzle cede."
            ligado={desfecho.abrePorta}
            onChange={(abrePorta) => mudarDesfecho((atual) => ({ ...atual, abrePorta }))}
          />
          {desfecho.abrePorta &&
            (porta === null ? (
              <p className="pze-nota">A porta de verdade se escolhe em cada lugar: abra a cópia do mapa no editor.</p>
            ) : porta.opcoes.length === 0 ? (
              <p className="pze-nota">Este mapa não tem porta. Desenhe uma e volte aqui.</p>
            ) : (
              <label className="gr-campo">
                <span className="gr-campo__rot">Qual porta</span>
                <select className="gr-entrada" value={porta.valor ?? ''} onChange={(evento) => porta.onChange(evento.currentTarget.value === '' ? null : evento.currentTarget.value)}>
                  <option value="">Nenhuma porta</option>
                  {porta.opcoes.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
      )}
    </Secao>
  )
}

const CASTIGOS: readonly { valor: TipoDeCastigo; rotulo: string }[] = [
  { valor: 'nada', rotulo: 'Nenhum' },
  { valor: 'dano', rotulo: 'Dano' },
  { valor: 'armadilha', rotulo: 'Armadilha' },
  { valor: 'barulho', rotulo: 'Barulho' },
]

const AJUDA_DO_CASTIGO: Readonly<Record<TipoDeCastigo, string>> = {
  nada: 'Errar não custa nada: dá para tentar de novo.',
  dano: 'Tira PV da ficha de quem errou.',
  armadilha: 'Uma armadilha dispara em quem errou e tira PV dele.',
  barulho: 'Só avisa você, com o texto, para narrar o que o barulho atrai.',
}

/** O mesmo castigo com outro texto ou outro PV, sem trocar de tipo. */
function castigoCom(castigo: CastigoDoPuzzle, mudanca: { texto?: string; pv?: number }): CastigoDoPuzzle {
  switch (castigo.tipo) {
    case 'nada':
      return castigo
    case 'barulho':
      return { ...castigo, texto: mudanca.texto ?? castigo.texto }
    case 'dano':
    case 'armadilha':
      return { ...castigo, texto: mudanca.texto ?? castigo.texto, pv: mudanca.pv ?? castigo.pv }
  }
}

/** "Se errar" (v2). */
export function SecaoCastigo({ puzzle, mudar }: PropsDaSecao) {
  const { castigo } = puzzle
  const mudarCastigo = (mudanca: { texto?: string; pv?: number }, chave: string) => mudar((atual) => ({ ...atual, castigo: castigoCom(atual.castigo, mudanca) }), chave)
  const soNaTroca = puzzle.regra !== 'ordem'
  return (
    <Secao titulo="Se errar">
      <CampoSeg nomeAcessivel="Castigo ao errar" forma="grade" opcoes={CASTIGOS} valor={castigo.tipo} onChange={(tipo) => tipo !== castigo.tipo && mudar({ ...puzzle, castigo: castigoPadrao(tipo) })} />
      <p className="pze-nota">{AJUDA_DO_CASTIGO[castigo.tipo]}</p>
      {(castigo.tipo === 'dano' || castigo.tipo === 'armadilha') && (
        <label className="gr-campo">
          <span className="gr-campo__rot">Dano em PV</span>
          <NumeroDoCampo valor={castigo.pv} min={castigo.tipo === 'dano' ? 1 : 0} max={PV_DO_CASTIGO_MAX} rotulo="Dano em PV" onChange={(pv) => mudarCastigo({ pv }, 'castigo:pv')} />
        </label>
      )}
      {castigo.tipo !== 'nada' && (
        <CampoTexto
          rotulo="O que acontece"
          valor={castigo.texto}
          placeholder={TEXTO_DO_CASTIGO_PADRAO[castigo.tipo]}
          maxLength={TEXTO_DO_CASTIGO_MAX}
          onChange={(texto) => mudarCastigo({ texto }, 'castigo:texto')}
        />
      )}
      <p className="pze-nota">
        {soNaTroca
          ? puzzle.troca === null
            ? 'No Encaixe a peça errada nem entra, então o castigo só vale na Ordem certa e na troca de peso.'
            : 'No Encaixe a peça errada nem entra: o castigo vale quando o peso da bandeja erra.'
          : 'Vale a cada tentativa errada.'}
      </p>
    </Secao>
  )
}
