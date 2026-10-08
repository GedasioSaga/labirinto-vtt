import { useId, useRef, useState } from 'react'
import { atributoComposto, comSinal, maximoComposto, textoDaConta, trocarNumero, valorDoRank, type Ajuste, type ValorComposto } from '../lib/ajusteDaFicha'
import { numeroDaFicha, type ParteDoAjuste, type Personagem } from '../lib/personagem'
import { rankDoValor, rotuloDoRank, type AtributoDoSistema, type RecursoDoSistema, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import { BotaoPasso, DicaDoAjuste, LinhaDeAjuste, PainelDeAjuste } from './AjusteRapido'
import { CampoNumero } from './FichaPecas'

/**
 * Os NÚMEROS da ficha de personagem: os quadrinhos dos recursos (HP 450/600,
 * Escudo) e a lista de atributos com o rank. Na leitura, com `onAjustar`,
 * cada número tem o ajuste rápido: o HP abre um painel ao toque (atual,
 * máximo, modificador e o campo do "-50"); o Escudo e os atributos têm − e +
 * na hora, e o número do atributo abre a conta e o modificador. Na edição
 * (Editar/Salvar), cada parte vira campo e nada vai para lugar nenhum antes
 * do Salvar — um comportamento por modo, nunca os dois misturados.
 */

/** Faixa da cor do rank: quanto maior, mais quente (a escala do projeto-rpg-v2: 10+, 7+, 4+, resto). */
export function faixaDoRank(rank: number): 'alta' | 'forte' | 'media' | 'base' {
  if (rank >= 10) return 'alta'
  if (rank >= 7) return 'forte'
  if (rank >= 4) return 'media'
  return 'base'
}

export function ChipDoRank({ rank }: { rank: number | null }) {
  if (rank === null) return null
  return (
    <span className="lb-ficha__rank" data-faixa={faixaDoRank(rank)} title={`Rank ${rank}`}>
      {rotuloDoRank(rank)}
    </span>
  )
}

interface NumerosLidosProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  /** Ausente = só leitura (sem − e +). */
  onAjustar?: (ajuste: Ajuste) => void
}

/** Abre um painel por vez e devolve o foco a quem o abriu quando ele fecha. */
function usePainelAberto() {
  const [aberto, setAberto] = useState<string | null>(null)
  const gatilhos = useRef(new Map<string, HTMLButtonElement>())
  const guardar = (id: string) => (elemento: HTMLButtonElement | null) => {
    if (elemento === null) gatilhos.current.delete(id)
    else gatilhos.current.set(id, elemento)
  }
  const alternar = (id: string) => setAberto((atual) => (atual === id ? null : id))
  const fechar = () => {
    if (aberto !== null) gatilhos.current.get(aberto)?.focus()
    setAberto(null)
  }
  return { aberto, guardar, alternar, fechar }
}

/** Quanto do máximo o atual ocupa, para a barrinha do quadrinho (0 a 1). */
function fracao(atual: number, maximo: number): number {
  return maximo <= 0 ? 0 : Math.min(1, Math.max(0, atual / maximo))
}

export function RecursosDaFicha({ personagem, sistema, onAjustar }: NumerosLidosProps) {
  const idBase = useId()
  const painel = usePainelAberto()
  if (sistema.recursos.length === 0) return null
  const painelId = `${idBase}-painel`
  const aberto = onAjustar === undefined ? undefined : sistema.recursos.find((recurso) => recurso.id === painel.aberto)
  return (
    <div className="lb-ficha__recursos-bloco">
      <ul className="lb-ficha__recursos" aria-label="Recursos">
        {sistema.recursos.map((recurso) => {
          const atual = numeroDaFicha(personagem.recursos, recurso.id)
          const expandido = aberto?.id === recurso.id
          if (recurso.atualEMaximo === true) {
            const maximo = maximoComposto(personagem, recurso.id)
            const conteudo = (
              <>
                <span className="lb-ficha__recurso-nome">{recurso.nome}</span>
                <span className="lb-ficha__recurso-valor">
                  {atual}
                  <span className="lb-ficha__recurso-max">/{maximo.total}</span>
                </span>
                <span className="lb-ficha__barra" aria-hidden="true">
                  <span style={{ transform: `scaleX(${fracao(atual, maximo.total)})` }} />
                </span>
              </>
            )
            return (
              <li key={recurso.id} className="lb-ficha__recurso-item">
                {onAjustar === undefined ? (
                  <div className="lb-ficha__recurso" data-tom={recurso.tom}>
                    {conteudo}
                  </div>
                ) : (
                  <button
                    ref={painel.guardar(recurso.id)}
                    type="button"
                    className="lb-ficha__recurso lb-ficha__recurso--toque"
                    data-tom={recurso.tom}
                    aria-expanded={expandido}
                    aria-controls={expandido ? painelId : undefined}
                    aria-label={`${recurso.nome} ${atual} de ${maximo.total}. Ajustar`}
                    onClick={() => painel.alternar(recurso.id)}
                  >
                    {conteudo}
                  </button>
                )}
              </li>
            )
          }
          return (
            <li key={recurso.id} className="lb-ficha__recurso-item">
              <div className="lb-ficha__recurso" data-tom={recurso.tom}>
                <span className="lb-ficha__recurso-nome">{recurso.nome}</span>
                {onAjustar === undefined ? (
                  <span className="lb-ficha__recurso-valor">{atual}</span>
                ) : (
                  <>
                    <button
                      ref={painel.guardar(recurso.id)}
                      type="button"
                      className="lb-ficha__recurso-valor lb-ficha__recurso-valor--toque"
                      aria-expanded={expandido}
                      aria-controls={expandido ? painelId : undefined}
                      aria-label={`${recurso.nome} ${atual}. Digitar valor`}
                      onClick={() => painel.alternar(recurso.id)}
                    >
                      {atual}
                    </button>
                    <span className="lb-ficha__passos">
                      <BotaoPasso rotulo={`Diminuir ${recurso.nome}`} sinal="−" noLimite={atual <= 0} onClick={() => onAjustar({ parte: 'recurso', chave: recurso.id, valor: atual - 1 })} />
                      <BotaoPasso rotulo={`Aumentar ${recurso.nome}`} sinal="+" onClick={() => onAjustar({ parte: 'recurso', chave: recurso.id, valor: atual + 1 })} />
                    </span>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {aberto !== undefined && onAjustar !== undefined && (
        <PainelDoRecurso key={aberto.id} id={painelId} recurso={aberto} personagem={personagem} onAjustar={onAjustar} onFechar={painel.fechar} />
      )}
    </div>
  )
}

interface PainelDoRecursoProps {
  id: string
  recurso: RecursoDoSistema
  personagem: Personagem
  onAjustar: (ajuste: Ajuste) => void
  onFechar: () => void
}

function PainelDoRecurso({ id, recurso, personagem, onAjustar, onFechar }: PainelDoRecursoProps) {
  const atual = numeroDaFicha(personagem.recursos, recurso.id)
  const ajustar = (parte: ParteDoAjuste) => (valor: number) => onAjustar({ parte, chave: recurso.id, valor })
  if (recurso.atualEMaximo !== true) {
    return (
      <PainelDeAjuste id={id} rotulo={`Ajustar ${recurso.nome}`} titulo={recurso.nome} resumo={String(atual)} onFechar={onFechar}>
        {(dicaId) => (
          <>
            <LinhaDeAjuste rotulo="Valor" nome={recurso.nome} valor={atual} min={0} onTrocar={ajustar('recurso')} dicaId={dicaId} />
            <DicaDoAjuste id={dicaId} />
          </>
        )}
      </PainelDeAjuste>
    )
  }
  const maximo = maximoComposto(personagem, recurso.id)
  return (
    <PainelDeAjuste id={id} rotulo={`Ajustar ${recurso.nome}`} titulo={recurso.nome} resumo={`${atual}/${maximo.total}`} onFechar={onFechar}>
      {(dicaId) => (
        <>
          <LinhaDeAjuste rotulo="Atual" nome={recurso.nome} valor={atual} min={0} max={maximo.total} onTrocar={ajustar('recurso')} dicaId={dicaId} />
          <LinhaDeAjuste rotulo="Máximo" nome={`${recurso.nome} máximo`} valor={maximo.base} min={0} onTrocar={ajustar('maximo')} dicaId={dicaId} />
          <LinhaDeAjuste rotulo="Modificador" nome={`modificador do máximo de ${recurso.nome}`} valor={maximo.modificador} modo="valor" onTrocar={ajustar('modRecurso')} dicaId={dicaId} />
          {(maximo.modificador !== 0 || maximo.cartoes.length > 0) && <p className="lb-ajuste__conta">Máximo {textoDaConta(maximo)}</p>}
          <DicaDoAjuste id={dicaId} modificador />
        </>
      )}
    </PainelDeAjuste>
  )
}

/** O total, e o quanto ele passa da base em destaque ("65 +5"): a conta inteira fica no painel e no `title`. */
function ValorDoAtributo({ valor }: { valor: ValorComposto }) {
  const extra = valor.total - valor.base
  return (
    <>
      {valor.total}
      {extra !== 0 && (
        <span className="lb-ficha__extra" data-sinal={extra > 0 ? 'mais' : 'menos'}>
          {comSinal(extra)}
        </span>
      )}
    </>
  )
}

export function AtributosDaFicha({ personagem, sistema, onAjustar }: NumerosLidosProps) {
  const idBase = useId()
  const painel = usePainelAberto()
  if (sistema.atributos.length === 0) return null
  return (
    <div>
      <h3 className="lb-eyebrow lb-ficha__subtitulo">Atributos</h3>
      <ul className="lb-ficha__atributos">
        {sistema.atributos.map((atributo) => {
          const valor = atributoComposto(personagem, atributo.id)
          const conta = textoDaConta(valor)
          const painelId = `${idBase}-${atributo.id}`
          const expandido = onAjustar !== undefined && painel.aberto === atributo.id
          return (
            <li key={atributo.id} className="lb-ficha__atributo-item">
              <div className="lb-ficha__atributo">
                <span className="lb-ficha__atributo-nome">{atributo.nome}</span>
                <span className="lb-ficha__atributo-valores">
                  {onAjustar === undefined ? (
                    <span className="lb-ficha__valor" title={conta}>
                      <ValorDoAtributo valor={valor} />
                    </span>
                  ) : (
                    <>
                      <BotaoPasso
                        rotulo={`Diminuir ${atributo.nome}`}
                        sinal="−"
                        noLimite={valor.base <= 0}
                        onClick={() => onAjustar({ parte: 'atributo', chave: atributo.id, valor: valor.base - 1 })}
                      />
                      <button
                        ref={painel.guardar(atributo.id)}
                        type="button"
                        className="lb-ficha__valor lb-ficha__valor--toque"
                        title={conta}
                        aria-expanded={expandido}
                        aria-controls={expandido ? painelId : undefined}
                        aria-label={`${atributo.nome}: ${conta}. Conta e modificador`}
                        onClick={() => painel.alternar(atributo.id)}
                      >
                        <ValorDoAtributo valor={valor} />
                      </button>
                      <BotaoPasso rotulo={`Aumentar ${atributo.nome}`} sinal="+" onClick={() => onAjustar({ parte: 'atributo', chave: atributo.id, valor: valor.base + 1 })} />
                    </>
                  )}
                  <ChipDoRank rank={rankDoValor(atributo.rank, valorDoRank(personagem, atributo.id))} />
                </span>
              </div>
              {expandido && <PainelDoAtributo id={painelId} atributo={atributo} valor={valor} onAjustar={onAjustar} onFechar={painel.fechar} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface PainelDoAtributoProps {
  id: string
  atributo: AtributoDoSistema
  valor: ValorComposto
  onAjustar: (ajuste: Ajuste) => void
  onFechar: () => void
}

/** A conta do atributo ("75 = 60 base +5 mod +10 Forma Híbrida"), a base e o modificador, separados. */
function PainelDoAtributo({ id, atributo, valor, onAjustar, onFechar }: PainelDoAtributoProps) {
  return (
    <PainelDeAjuste id={id} rotulo={`Ajustar ${atributo.nome}`} titulo={atributo.nome} resumo={textoDaConta(valor)} onFechar={onFechar}>
      {(dicaId) => (
        <>
          <LinhaDeAjuste
            rotulo="Base"
            nome={`base de ${atributo.nome}`}
            valor={valor.base}
            min={0}
            onTrocar={(novo) => onAjustar({ parte: 'atributo', chave: atributo.id, valor: novo })}
            dicaId={dicaId}
          />
          <LinhaDeAjuste
            rotulo="Modificador"
            nome={`modificador de ${atributo.nome}`}
            valor={valor.modificador}
            modo="valor"
            onTrocar={(novo) => onAjustar({ parte: 'modAtributo', chave: atributo.id, valor: novo })}
            dicaId={dicaId}
          />
          <DicaDoAjuste id={dicaId} modificador />
        </>
      )}
    </PainelDeAjuste>
  )
}

interface NumerosEditaveisProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  onChange: (personagem: Personagem) => void
}

/** Os recursos na edição: o HP com atual, máximo e modificador; o Escudo, um campo. */
export function RecursosEditaveis({ personagem, sistema, onChange }: NumerosEditaveisProps) {
  const idBase = useId()
  if (sistema.recursos.length === 0) return null
  const trocar = (parte: Exclude<ParteDoAjuste, 'cartao'>, chave: string) => (valor: number) => onChange(trocarNumero(personagem, parte, chave, valor))
  return (
    <div className="lb-ficha__recursos lb-ficha__recursos--edit">
      {sistema.recursos.map((recurso) =>
        recurso.atualEMaximo === true ? (
          <fieldset key={recurso.id} className="lb-ficha__recurso lb-ficha__recurso--partes" data-tom={recurso.tom}>
            <legend className="lb-ficha__recurso-nome">{recurso.nome}</legend>
            <span className="lb-ficha__mini" aria-hidden="true">
              Atual
            </span>
            <CampoNumero rotulo={`${recurso.nome} atual`} valor={numeroDaFicha(personagem.recursos, recurso.id)} onChange={trocar('recurso', recurso.id)} />
            <span className="lb-ficha__mini" aria-hidden="true">
              Máximo
            </span>
            <CampoNumero rotulo={`${recurso.nome} máximo`} valor={maximoComposto(personagem, recurso.id).base} onChange={trocar('maximo', recurso.id)} />
            <span className="lb-ficha__mini" aria-hidden="true">
              Mod.
            </span>
            <CampoNumero
              rotulo={`Modificador do máximo de ${recurso.nome}`}
              valor={numeroDaFicha(personagem.modificadoresDosRecursos, recurso.id)}
              onChange={trocar('modRecurso', recurso.id)}
            />
          </fieldset>
        ) : (
          <label key={recurso.id} className="lb-ficha__recurso" data-tom={recurso.tom} htmlFor={`${idBase}-recurso-${recurso.id}`}>
            <span>{recurso.nome}</span>
            <CampoNumero id={`${idBase}-recurso-${recurso.id}`} rotulo={recurso.nome} valor={numeroDaFicha(personagem.recursos, recurso.id)} onChange={trocar('recurso', recurso.id)} />
          </label>
        ),
      )}
    </div>
  )
}

/** Os atributos na edição: base e modificador lado a lado, e o rank do total. */
export function AtributosEditaveis({ personagem, sistema, onChange }: NumerosEditaveisProps) {
  const idBase = useId()
  if (sistema.atributos.length === 0) return null
  return (
    <div>
      <h3 className="lb-eyebrow lb-ficha__subtitulo">Atributos</h3>
      <div className="lb-ficha__atributos">
        {sistema.atributos.map((atributo) => (
          <div key={atributo.id} className="lb-ficha__atributo">
            <label htmlFor={`${idBase}-atributo-${atributo.id}`}>{atributo.nome}</label>
            <span className="lb-ficha__atributo-edit">
              <CampoNumero
                id={`${idBase}-atributo-${atributo.id}`}
                rotulo={atributo.nome}
                valor={numeroDaFicha(personagem.atributos, atributo.id)}
                onChange={(novo) => onChange(trocarNumero(personagem, 'atributo', atributo.id, novo))}
              />
              <CampoNumero
                rotulo={`Modificador de ${atributo.nome}`}
                valor={numeroDaFicha(personagem.modificadoresDosAtributos, atributo.id)}
                onChange={(novo) => onChange(trocarNumero(personagem, 'modAtributo', atributo.id, novo))}
              />
              <ChipDoRank rank={rankDoValor(atributo.rank, valorDoRank(personagem, atributo.id))} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
