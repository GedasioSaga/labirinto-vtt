import { useMemo, useState } from 'react'
import { lerMarcas, lerRequisitos, mesmaMarca } from '../../../../lib/batalha/requisitos/ler'
import { marcasGuardadas } from '../../../../lib/batalha/requisitos/guardados'
import { MARCA_MAX, MARCAS_MAX, type ValorJson } from '../../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../../../lib/personagem'
import { BlocoDosRequisitos, type ListasDosRequisitos } from '../../blocos/BlocoDosRequisitos'
import type { OpcoesDasFontes } from '../../blocos/requisitosNaTela'
import { blocoCru, blocoParaLer, comUsar, todosCru } from '../requisitosDoCartao'
import { ResumoDosRequisitos } from './ResumoDosRequisitos'

interface LinhaDosRequisitosProps {
  cartao: CartaoDaFicha
  personagem: Personagem
  fontes: OpcoesDasFontes
  listas: ListasDosRequisitos
  custoEmSp: number
  onChange: (cartao: CartaoDaFicha) => void
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

/**
 * LINHA REQUISITOS (EDITOR.md §3.6; REQUISITOS.md §9, fase F): o bloco "Todos estes / Um destes"
 * com a busca nos 41 tipos, "Em palavras" e o "Falta:" ao vivo, e as marcas do cartão. Grava no
 * campo `requisitos` do cartão, nunca na mecânica: vale também para a técnica que é só texto.
 */
export function LinhaDosRequisitos({ cartao, personagem, fontes, listas, custoEmSp, onChange }: LinhaDosRequisitosProps) {
  const bloco = blocoCru(cartao)
  const todos = useMemo(() => todosCru(bloco, 'usar'), [bloco])
  const lidos = useMemo(() => lerRequisitos(blocoParaLer(todos, 'usar')), [todos])
  const doCartao = useMemo(() => lerRequisitos(cartao.requisitos), [cartao.requisitos])
  const mudar = (novos: readonly ValorJson[]) => onChange(comUsar(cartao, novos))
  return (
    <>
      {doCartao.deAppNovo && <p className="lb-ed__alerta">Estes requisitos têm parte de um app mais novo: o que não se lê aqui fica guardado como veio.</p>}
      <BlocoDosRequisitos todos={todos} lidos={lidos.bloco?.usar?.todos ?? []} fontes={fontes} listas={listas} vazio="Sem requisito: a técnica se usa sempre que tiver o custo." onChange={mudar} />
      <ResumoDosRequisitos todos={todos} qual="usar" nome={cartao.nome} personagem={personagem} custoEmSp={custoEmSp} />
      <MarcasDoCartao cartao={cartao} listas={listas} onChange={onChange} />
    </>
  )
}
