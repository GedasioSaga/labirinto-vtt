import { useMemo, useState } from 'react'
import { mesmaReferencia } from '../../../../lib/batalha/requisitos/contexto'
import { lerMarcas, lerRequisitos, mesmaMarca } from '../../../../lib/batalha/requisitos/ler'
import { marcasGuardadas } from '../../../../lib/batalha/requisitos/guardados'
import { LIGA_POR_MAX, MARCA_MAX, MARCAS_MAX, type ObjetoJson, type Referencia, type ValorJson } from '../../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../../../lib/personagem'
import { BlocoDosRequisitos, type ListasDosRequisitos } from '../../blocos/BlocoDosRequisitos'
import { blocoComLigacoes, ligacoesAtivas, ligacoesDoBloco, referenciaJson, textoDoJson, type LigacaoDaForma, type LigacoesDoBloco, type OpcoesDasFontes } from '../../blocos/requisitosNaTela'
import { blocoCru, blocoParaLer, comUsar, todosCru } from '../requisitosDoCartao'
import { ResumoDosRequisitos } from './ResumoDosRequisitos'
import '../pecas/pecas.css'

interface LinhaDosRequisitosProps {
  cartao: CartaoDaFicha
  personagem: Personagem
  fontes: OpcoesDasFontes
  listas: ListasDosRequisitos
  custoEmSp: number
  onChange: (cartao: CartaoDaFicha) => void
  /** ED7: o item não tem marcas (o catálogo as guarda só na habilidade e na arma). */
  comMarcas?: boolean
  /** A frase do bloco vazio ("Sem requisito: a técnica se usa..."). */
  vazio?: string
}

/** As marcas do cartão ("Fogo"): o que o requisito "Ajuda de um aliado com Fogo" procura nas fichas dos aliados. */
function MarcasDoCartao({ cartao, listas, onChange }: Pick<LinhaDosRequisitosProps, 'cartao' | 'listas' | 'onChange'>) {
  const [nova, setNova] = useState('')
  const marcas = lerMarcas(cartao.marcas)
  const gravar = (lista: readonly string[]) => {
    const guardadas = marcasGuardadas(lista)
    const { marcas: _antes, ...sem } = cartao
    onChange(guardadas === undefined ? sem : { ...sem, marcas: guardadas })
  }
  const por = () => {
    const texto = nova.trim()
    setNova('')
    if (texto === '' || marcas.some((marca) => mesmaMarca(marca, texto)) || marcas.length >= MARCAS_MAX) return
    gravar([...marcas, texto])
  }
  const sugestoes = listas.marcas.filter((marca) => !marcas.some((outra) => mesmaMarca(outra, marca)))
  return (
    <div className="lb-req__marcas">
      <span className="lb-ed__rot">Marcas</span>
      {marcas.map((marca) => (
        <span key={marca} className="lb-req__chip">
          {marca}
          <button type="button" className="lb-req__chip-x" aria-label={`Tirar a marca ${marca}`} onClick={() => gravar(marcas.filter((outra) => outra !== marca))}>
            ×
          </button>
        </span>
      ))}
      {marcas.length < MARCAS_MAX && (
        <input
          className="lb-req__txt"
          value={nova}
          maxLength={MARCA_MAX}
          placeholder="+ marca (ex.: Fogo)"
          aria-label="Nova marca"
          list={sugestoes.length > 0 ? 'lb-ed-marcas' : undefined}
          onChange={(evento) => setNova(evento.target.value)}
          onBlur={por}
          onKeyDown={(evento) => {
            if (evento.key !== 'Enter') return
            evento.preventDefault()
            por()
          }}
        />
      )}
      {sugestoes.length > 0 && (
        <datalist id="lb-ed-marcas">
          {sugestoes.map((marca) => (
            <option key={marca} value={marca} />
          ))}
        </datalist>
      )}
      <span className="lb-ed__dica">o aliado com a mesma marca pode ajudar quem pede</span>
    </div>
  )
}

/** A técnica guardada no "Só liga" ({ id?, nome } do disco) como referência. */
function referenciaGuardada(peca: ObjetoJson): Referencia {
  const id = textoDoJson(peca, 'id')
  const nome = textoDoJson(peca, 'nome')
  return id === '' ? { nome } : { id, nome }
}

interface LigacoesDaFormaProps {
  ligacoes: LigacoesDoBloco
  tecnicas: readonly { id?: string; nome: string }[]
  /** O "Só liga" foi pedido na busca, mas a ficha não tem técnica para pôr: a linha aparece vazia. */
  soLigaPedido: boolean
  onChange: (ligacoes: LigacoesDoBloco) => void
  onFecharPedido: () => void
}

/**
 * AS LIGAÇÕES DA FORMA (D8 do rework): "Só liga pela técnica" (`requisitos.forma.soLigaPor`) e
 * "Parte da forma, em ordem" (`requisitos.forma.partesEmOrdem`). Valem no cartão inteiro (o motor as
 * confere ao ligar a forma), então ficam fora dos grupos "Todos estes / Um destes".
 */
function LigacoesDaForma({ ligacoes, tecnicas, soLigaPedido, onChange, onFecharPedido }: LigacoesDaFormaProps) {
  const lista = ligacoes.soLigaPor.map(referenciaGuardada)
  const livres = tecnicas.filter((tecnica) => !lista.some((ref) => mesmaReferencia(ref, tecnica)))
  const mostrarSoLiga = lista.length > 0 || soLigaPedido
  if (!mostrarSoLiga && !ligacoes.partesEmOrdem) return null
  const chaveDe = (ref: { id?: string; nome: string }) => ref.id ?? `nome:${ref.nome}`
  return (
    <div className="lb-pc-lig" role="group" aria-label="Ligações da forma">
      <p className="lb-pc-lig__tit">Ligações da forma (valem no cartão inteiro)</p>
      {mostrarSoLiga && (
        <div className="lb-pc-lig__linha">
          <b>Só liga pela técnica</b>
          {lista.length === 0 && <span className="lb-ed__dica">nenhuma técnica na ficha ainda</span>}
          {lista.map((ref, indice) => (
            <span key={chaveDe(ref)} className="lb-req__chip">
              {ref.nome.trim() || 'sem nome'}
              <button
                type="button"
                className="lb-req__chip-x"
                aria-label={`Tirar ${ref.nome.trim() || 'a técnica'} do Só liga`}
                onClick={() => onChange({ ...ligacoes, soLigaPor: ligacoes.soLigaPor.filter((_peca, i) => i !== indice) })}
              >
                ×
              </button>
            </span>
          ))}
          {livres.length > 0 && lista.length < LIGA_POR_MAX && (
            <select
              className="lb-pc__sel lb-pc__sel--por"
              value=""
              aria-label="Pôr outra técnica que liga a forma"
              onChange={(evento) => {
                const tecnica = livres.find((candidata) => chaveDe(candidata) === evento.target.value)
                if (tecnica !== undefined) onChange({ ...ligacoes, soLigaPor: [...ligacoes.soLigaPor, referenciaJson(tecnica)] })
              }}
            >
              <option value="">{lista.length === 0 ? '+ técnica' : '+ ou outra'}</option>
              {livres.map((tecnica) => (
                <option key={chaveDe(tecnica)} value={chaveDe(tecnica)}>
                  {tecnica.nome.trim() || 'sem nome'}
                </option>
              ))}
            </select>
          )}
          <span className="lb-ed__dica">a forma não liga pelo Ativar nem por outra técnica</span>
          <button
            type="button"
            className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic"
            aria-label="Tirar: Só liga pela técnica"
            onClick={() => {
              onFecharPedido()
              onChange({ ...ligacoes, soLigaPor: [] })
            }}
          >
            ×
          </button>
        </div>
      )}
      {ligacoes.partesEmOrdem && (
        <div className="lb-pc-lig__linha">
          <b>Parte da forma, em ordem</b>
          <span>uma Parte por vez: só liga a Parte seguinte</span>
          <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label="Tirar: Parte da forma, em ordem" onClick={() => onChange({ ...ligacoes, partesEmOrdem: false })}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * LINHA REQUISITOS (EDITOR.md §3.6; REQUISITOS.md §9, fase F): o bloco "Todos estes / Um destes"
 * com a busca nos 41 tipos, "Em palavras" e o "Falta:" ao vivo, e as marcas do cartão. Grava no
 * campo `requisitos` do cartão, nunca na mecânica: vale também para a técnica que é só texto.
 */
export function LinhaDosRequisitos({ cartao, personagem, fontes, listas, custoEmSp, onChange, comMarcas = true, vazio = 'Sem requisito: a técnica se usa sempre que tiver o custo.' }: LinhaDosRequisitosProps) {
  const bloco = blocoCru(cartao)
  const todos = useMemo(() => todosCru(bloco, 'usar'), [bloco])
  const lidos = useMemo(() => lerRequisitos(blocoParaLer(todos, 'usar')), [todos])
  const doCartao = useMemo(() => lerRequisitos(cartao.requisitos), [cartao.requisitos])
  const ligacoes = useMemo(() => ligacoesDoBloco(bloco), [bloco])
  const [soLigaPedido, setSoLigaPedido] = useState(false)
  const mudar = (novos: readonly ValorJson[]) => onChange(comUsar(cartao, novos))
  const gravarLigacoes = (novas: LigacoesDoBloco) => {
    const novo = blocoComLigacoes(bloco, novas)
    const { requisitos: _antes, ...sem } = cartao
    onChange(novo === null ? sem : { ...sem, requisitos: novo })
  }
  const porLigacao = (ligacao: LigacaoDaForma) => {
    if (ligacao === 'partesEmOrdem') return gravarLigacoes({ ...ligacoes, partesEmOrdem: true })
    // Como os outros requisitos: nasce com a primeira opção da fonte (a primeira técnica da ficha).
    const primeira = fontes.tecnica[0]
    if (primeira === undefined) return setSoLigaPedido(true)
    gravarLigacoes({ ...ligacoes, soLigaPor: [referenciaJson(primeira)] })
  }
  return (
    <>
      {doCartao.deAppNovo && <p className="lb-ed__alerta">Estes requisitos têm parte de um app mais novo: o que não se lê aqui fica guardado como veio.</p>}
      <BlocoDosRequisitos
        todos={todos}
        lidos={lidos.bloco?.usar?.todos ?? []}
        fontes={fontes}
        listas={listas}
        vazio={vazio}
        onChange={mudar}
        ligacoes={{ ativas: soLigaPedido ? [...ligacoesAtivas(ligacoes), 'soLigaPor'] : ligacoesAtivas(ligacoes), onPor: porLigacao }}
      />
      <LigacoesDaForma ligacoes={ligacoes} tecnicas={fontes.tecnica} soLigaPedido={soLigaPedido} onChange={gravarLigacoes} onFecharPedido={() => setSoLigaPedido(false)} />
      <ResumoDosRequisitos todos={todos} qual="usar" nome={cartao.nome} personagem={personagem} custoEmSp={custoEmSp} />
      {comMarcas && <MarcasDoCartao cartao={cartao} listas={listas} onChange={onChange} />}
    </>
  )
}
