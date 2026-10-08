import { useId, useState } from 'react'
import { numeroDaFicha, type Personagem, type TipoDePersonagem } from '../lib/personagem'
import { rankDoValor, rotuloDoRank, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import { FichaAbas } from './FichaAbas'
import { CampoNumero, IniciaisDoNome } from './FichaPecas'
import './FichaDePersonagem.css'

/**
 * FICHA DE PERSONAGEM — o desenho de referência do usuário é a ficha do
 * projeto-rpg-v2 (CharacterSheet + StatBlock): as escolhas (raça, ofício) em
 * chips no topo; à esquerda o cartão do personagem com retrato, nome e o selo
 * JOGADOR/NPC, a descrição, os quadrinhos dos recursos e a lista de
 * atributos com o rank; à direita as abas de cartões.
 *
 * A mesma tela lê e edita (`editando`): o mestre vê a ficha como ela é e,
 * em edição, cada número e texto vira campo no mesmo lugar. Quem guarda o
 * rascunho e decide quando gravar é a janela (`FichaDePersonagemDialog`).
 */

export interface FichaDePersonagemProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  editando: boolean
  onChange: (personagem: Personagem) => void
  /** Pede uma imagem ao disco (retrato e imagem do cartão); `null` = cancelou. */
  escolherImagem: () => Promise<string | null>
  /** Id do título com o nome: a janela se nomeia por ele. */
  tituloId?: string
}

export function FichaDePersonagem({ personagem, sistema, editando, onChange, escolherImagem, tituloId }: FichaDePersonagemProps) {
  return (
    <div className="lb-ficha">
      <div className="lb-ficha__lado">
        <EscolhasDoPersonagem personagem={personagem} sistema={sistema} editando={editando} onChange={onChange} />
        {editando ? (
          <BlocoEditavel personagem={personagem} sistema={sistema} onChange={onChange} escolherImagem={escolherImagem} tituloId={tituloId} />
        ) : (
          <BlocoLido personagem={personagem} sistema={sistema} tituloId={tituloId} />
        )}
      </div>
      <div className="lb-ficha__principal">
        <FichaAbas personagem={personagem} sistema={sistema} editando={editando} onChange={onChange} escolherImagem={escolherImagem} />
      </div>
    </div>
  )
}

/** Faixa da cor do rank: quanto maior, mais quente (a escala do projeto-rpg-v2: 10+, 7+, 4+, resto). */
export function faixaDoRank(rank: number): 'alta' | 'forte' | 'media' | 'base' {
  if (rank >= 10) return 'alta'
  if (rank >= 7) return 'forte'
  if (rank >= 4) return 'media'
  return 'base'
}

function ChipDoRank({ rank }: { rank: number | null }) {
  if (rank === null) return null
  return (
    <span className="lb-ficha__rank" data-faixa={faixaDoRank(rank)} title={`Rank ${rank}`}>
      {rotuloDoRank(rank)}
    </span>
  )
}

const TEXTO_DO_TIPO: Record<TipoDePersonagem, string> = { jogador: 'Jogador', npc: 'NPC' }

function SeloDoTipo({ tipo }: { tipo: TipoDePersonagem }) {
  return (
    <span className="lb-ficha__selo" data-tipo={tipo}>
      {TEXTO_DO_TIPO[tipo]}
    </span>
  )
}

/** Descrição longa (ficha importada traz parágrafos) abre em 3 linhas, com "Mostrar tudo". */
const DESCRICAO_CURTA_MAX = 160

function Descricao({ texto }: { texto: string }) {
  const [inteira, setInteira] = useState(false)
  const limpo = texto.trim()
  if (limpo.length === 0) return null
  const longa = limpo.length > DESCRICAO_CURTA_MAX || limpo.split('\n').length > 3
  return (
    <div className="lb-ficha__descricao-bloco">
      <p className="lb-ficha__descricao" data-cortada={longa && !inteira ? 'true' : undefined}>
        {limpo}
      </p>
      {longa && (
        <button type="button" className="lb-ficha__mais" aria-expanded={inteira} onClick={() => setInteira(!inteira)}>
          {inteira ? 'Mostrar menos' : 'Mostrar tudo'}
        </button>
      )}
    </div>
  )
}

function EscolhasDoPersonagem({ personagem, sistema, editando, onChange }: { personagem: Personagem; sistema: SistemaDeRpg; editando: boolean; onChange: (personagem: Personagem) => void }) {
  const idBase = useId()
  if (!editando) {
    const valores = sistema.escolhas.map((escolha) => ({ id: escolha.id, rotulo: escolha.rotulo, valor: (personagem.escolhas[escolha.id] ?? '').trim() })).filter((escolha) => escolha.valor.length > 0)
    if (valores.length === 0 && personagem.etiquetas.length === 0) return null
    return (
      <ul className="lb-ficha__chips" aria-label="Escolhas e etiquetas">
        {valores.map((escolha) => (
          <li key={escolha.id} className="lb-ficha__chip" title={escolha.rotulo}>
            {escolha.valor}
          </li>
        ))}
        {personagem.etiquetas.map((etiqueta) => (
          <li key={`etiqueta-${etiqueta}`} className="lb-ficha__chip lb-ficha__chip--etiqueta">
            {etiqueta}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="lb-ficha__escolhas-edit">
      {sistema.escolhas.map((escolha) => {
        const atual = personagem.escolhas[escolha.id] ?? ''
        // Valor fora da lista (ficha importada: "Mink (Raposa)") continua escolhível: trocar o select não pode apagá-lo.
        const opcoes = atual.length > 0 && !escolha.opcoes.includes(atual) ? [...escolha.opcoes, atual] : escolha.opcoes
        return (
          <label key={escolha.id} className="lb-field" htmlFor={`${idBase}-${escolha.id}`}>
            <span className="lb-label">{escolha.rotulo}</span>
            <select
              id={`${idBase}-${escolha.id}`}
              className="lb-input"
              value={atual}
              onChange={(event) => onChange({ ...personagem, escolhas: { ...personagem.escolhas, [escolha.id]: event.target.value } })}
            >
              <option value="">— nenhuma</option>
              {opcoes.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </label>
        )
      })}
      <label className="lb-field" htmlFor={`${idBase}-etiquetas`}>
        <span className="lb-label">Etiquetas (separadas por vírgula)</span>
        <input
          id={`${idBase}-etiquetas`}
          className="lb-input"
          defaultValue={personagem.etiquetas.join(', ')}
          onChange={(event) =>
            onChange({
              ...personagem,
              etiquetas: event.target.value
                .split(',')
                .map((etiqueta) => etiqueta.trim())
                .filter((etiqueta) => etiqueta.length > 0),
            })
          }
        />
      </label>
    </div>
  )
}

function Retrato({ personagem }: { personagem: Personagem }) {
  return <div className="lb-ficha__retrato">{personagem.retrato !== null ? <img src={personagem.retrato} alt={`Retrato de ${personagem.nome}`} /> : <IniciaisDoNome nome={personagem.nome} />}</div>
}

function BlocoLido({ personagem, sistema, tituloId }: { personagem: Personagem; sistema: SistemaDeRpg; tituloId?: string }) {
  return (
    <section className="lb-ficha__bloco" aria-label="Personagem">
      <Retrato personagem={personagem} />
      <div className="lb-ficha__identidade">
        <h2 id={tituloId} className="lb-ficha__nome">
          {personagem.nome}
        </h2>
        <SeloDoTipo tipo={personagem.tipo} />
      </div>
      <Descricao texto={personagem.descricao} />
      {sistema.recursos.length > 0 && (
        <dl className="lb-ficha__recursos">
          {sistema.recursos.map((recurso) => (
            <div key={recurso.id} className="lb-ficha__recurso" data-tom={recurso.tom}>
              <dt>{recurso.nome}</dt>
              <dd>{numeroDaFicha(personagem.recursos, recurso.id)}</dd>
            </div>
          ))}
        </dl>
      )}
      {sistema.atributos.length > 0 && (
        <div>
          <h3 className="lb-eyebrow lb-ficha__subtitulo">Atributos</h3>
          <dl className="lb-ficha__atributos">
            {sistema.atributos.map((atributo) => {
              const valor = numeroDaFicha(personagem.atributos, atributo.id)
              return (
                <div key={atributo.id} className="lb-ficha__atributo">
                  <dt>{atributo.nome}</dt>
                  <dd>
                    <span className="lb-ficha__valor">{valor}</span>
                    <ChipDoRank rank={rankDoValor(atributo.rank, valor)} />
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}
    </section>
  )
}

interface BlocoEditavelProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  onChange: (personagem: Personagem) => void
  escolherImagem: () => Promise<string | null>
  tituloId?: string
}

function BlocoEditavel({ personagem, sistema, onChange, escolherImagem, tituloId }: BlocoEditavelProps) {
  const idBase = useId()
  const [erroDoRetrato, setErroDoRetrato] = useState<string | null>(null)
  const pedirRetrato = async () => {
    setErroDoRetrato(null)
    try {
      const retrato = await escolherImagem()
      if (retrato !== null) onChange({ ...personagem, retrato })
    } catch (erro) {
      setErroDoRetrato(erro instanceof Error ? erro.message : String(erro))
    }
  }
  return (
    <section className="lb-ficha__bloco lb-ficha__bloco--edit" aria-label="Personagem">
      <h2 id={tituloId} className="lb-sr-only">
        {personagem.nome}
      </h2>
      <Retrato personagem={personagem} />
      <div className="lb-ficha__retrato-acoes">
        <button type="button" className="lb-btn lb-btn--compact" onClick={() => void pedirRetrato()}>
          {personagem.retrato === null ? 'Escolher retrato…' : 'Trocar retrato…'}
        </button>
        {personagem.retrato !== null && (
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => onChange({ ...personagem, retrato: null })}>
            Tirar retrato
          </button>
        )}
      </div>
      {erroDoRetrato !== null && (
        <p className="lb-field__error" role="alert">
          {erroDoRetrato}
        </p>
      )}
      <label className="lb-field" htmlFor={`${idBase}-nome`}>
        <span className="lb-label">Nome</span>
        <input id={`${idBase}-nome`} className="lb-input" value={personagem.nome} onChange={(event) => onChange({ ...personagem, nome: event.target.value })} />
      </label>
      <label className="lb-field" htmlFor={`${idBase}-tipo`}>
        <span className="lb-label">Tipo</span>
        <select
          id={`${idBase}-tipo`}
          className="lb-input"
          value={personagem.tipo}
          onChange={(event) => onChange({ ...personagem, tipo: event.target.value === 'jogador' ? 'jogador' : 'npc' })}
        >
          <option value="jogador">Jogador</option>
          <option value="npc">NPC</option>
        </select>
      </label>
      <label className="lb-field" htmlFor={`${idBase}-descricao`}>
        <span className="lb-label">Descrição</span>
        <textarea
          id={`${idBase}-descricao`}
          className="lb-input lb-textarea"
          value={personagem.descricao}
          onChange={(event) => onChange({ ...personagem, descricao: event.target.value })}
        />
      </label>
      {sistema.recursos.length > 0 && (
        <div className="lb-ficha__recursos lb-ficha__recursos--edit">
          {sistema.recursos.map((recurso) => (
            <label key={recurso.id} className="lb-ficha__recurso" data-tom={recurso.tom} htmlFor={`${idBase}-recurso-${recurso.id}`}>
              <span>{recurso.nome}</span>
              <CampoNumero
                id={`${idBase}-recurso-${recurso.id}`}
                rotulo={recurso.nome}
                valor={numeroDaFicha(personagem.recursos, recurso.id)}
                onChange={(valor) => onChange({ ...personagem, recursos: { ...personagem.recursos, [recurso.id]: valor } })}
              />
            </label>
          ))}
        </div>
      )}
      {sistema.atributos.length > 0 && (
        <div>
          <h3 className="lb-eyebrow lb-ficha__subtitulo">Atributos</h3>
          <div className="lb-ficha__atributos">
            {sistema.atributos.map((atributo) => {
              const valor = numeroDaFicha(personagem.atributos, atributo.id)
              return (
                <div key={atributo.id} className="lb-ficha__atributo">
                  <label htmlFor={`${idBase}-atributo-${atributo.id}`}>{atributo.nome}</label>
                  <span className="lb-ficha__atributo-edit">
                    <CampoNumero
                      id={`${idBase}-atributo-${atributo.id}`}
                      rotulo={atributo.nome}
                      valor={valor}
                      onChange={(novo) => onChange({ ...personagem, atributos: { ...personagem.atributos, [atributo.id]: novo } })}
                    />
                    <ChipDoRank rank={rankDoValor(atributo.rank, valor)} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
