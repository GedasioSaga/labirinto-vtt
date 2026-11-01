import { useId, useMemo, useState, type FormEvent } from 'react'
import { atributoComposto, atualSemForca, forcaDoRecurso, maximoBase, NUMERO_DA_FICHA_MAX, temMaximo } from '../../lib/ajusteDaFicha'
import { MUDANCAS_DO_AJUSTE_MAX, type MudancaDoAjuste, type PedidoDeAjusteNaBatalha } from '../../lib/batalha/combate'
import { recursoDoEscudo } from '../../lib/batalha/leituraDaFicha'
import type { Personagem } from '../../lib/personagem'
import type { RecursoDoSistema, SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { recursosQueAparecem } from './dadosDaFaixa'
import { formatarNumero } from './dadosDoMenu'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import './batalha.css'
import './combate.css'

/**
 * R4 (lote de 01/11): o "Ajustar..." da carta. Atual e máximo de HP, SP e
 * Escudo na ficha, e um modificador de atributo (+ ou -) que vale até a
 * batalha acabar. O mestre ajusta qualquer ficha; o jogador, só a dele (o host
 * confere). Só o que mudou vai no pedido; vira uma linha no registro, e o
 * mestre desfaz por ela.
 *
 * O atual do HP do NPC com Força é o HP NORMAL (decisão do usuário): o campo
 * mostra o número sem a força e o app põe a força por cima.
 */

export interface AjustarDialogProps {
  quem: string
  tokenId: string
  personagem: Personagem
  sistema: SistemaDeRpg
  /** O pedido saiu? `false` mantém a janela, com o aviso. */
  onConfirmar: (pedido: PedidoDeAjusteNaBatalha) => boolean
  onFechar: () => void
}

/** O modificador de atributo, para os dois lados; mais que isso é engano de digitação. */
const DELTA_DO_ATRIBUTO_MAX = 9_999

interface LinhaDoAjuste {
  recurso: RecursoDoSistema
  atual: number
  /** `null` = o recurso não tem máximo neste sistema (o Escudo). */
  maximo: number | null
  /** A força que multiplica o atual (o HP do NPC de combate); 1 = nenhuma. */
  forca: number
}

/** HP e SP (os da carta) e o Escudo, na ordem da carta. */
function linhasDaFicha(personagem: Personagem, sistema: SistemaDeRpg): LinhaDoAjuste[] {
  const recursos = [...recursosQueAparecem(sistema)]
  const escudo = recursoDoEscudo(sistema)
  if (escudo !== null && !recursos.some((recurso) => recurso.id === escudo.id)) recursos.push(escudo)
  return recursos.map((recurso) => ({
    recurso,
    atual: atualSemForca(personagem, recurso.id),
    maximo: temMaximo(sistema, recurso.id) ? maximoBase(personagem, recurso.id) : null,
    forca: forcaDoRecurso(personagem, recurso.id),
  }))
}

/** O número digitado: inteiro de 0 ao teto; vazio ou torto = `null`. */
function lerNumero(texto: string): number | null {
  const limpo = texto.trim()
  if (!/^\d{1,7}$/.test(limpo)) return null
  const valor = Number(limpo)
  return valor <= NUMERO_DA_FICHA_MAX ? valor : null
}

/** "+2", "-3", "4": inteiro com sinal, sem o zero. */
function lerDelta(texto: string): number | null {
  const limpo = texto.replace(/\s+/g, '').replace('−', '-')
  if (!/^[+-]?\d{1,4}$/.test(limpo)) return null
  const valor = Number(limpo)
  return valor === 0 || Math.abs(valor) > DELTA_DO_ATRIBUTO_MAX ? null : valor
}

export function AjustarDialog({ quem, tokenId, personagem, sistema, onConfirmar, onFechar }: AjustarDialogProps) {
  const idBase = useId()
  const linhas = useMemo(() => linhasDaFicha(personagem, sistema), [personagem, sistema])
  const [textos, setTextos] = useState<Record<string, string>>(() => {
    const inicio: Record<string, string> = {}
    for (const linha of linhas) {
      inicio[`atual:${linha.recurso.id}`] = String(linha.atual)
      if (linha.maximo !== null) inicio[`maximo:${linha.recurso.id}`] = String(linha.maximo)
    }
    return inicio
  })
  const [atributoId, setAtributoId] = useState(() => sistema.atributos[0]?.id ?? '')
  const [deltaTexto, setDeltaTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [invalido, setInvalido] = useState<string | null>(null)

  const trocar = (chave: string, valor: string) => {
    setErro(null)
    setInvalido(null)
    setTextos((antes) => ({ ...antes, [chave]: valor }))
  }

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    const mudancas: MudancaDoAjuste[] = []
    for (const linha of linhas) {
      for (const tipo of ['atual', 'maximo'] as const) {
        if (tipo === 'maximo' && linha.maximo === null) continue
        const chave = `${tipo}:${linha.recurso.id}`
        const valor = lerNumero(textos[chave] ?? '')
        if (valor === null) {
          setInvalido(chave)
          setErro(`${linha.recurso.nome}: digite um número de 0 a ${formatarNumero(NUMERO_DA_FICHA_MAX)}.`)
          return
        }
        const antes = tipo === 'atual' ? linha.atual : linha.maximo
        if (valor !== antes) mudancas.push({ tipo, recursoId: linha.recurso.id, valor })
      }
    }
    if (deltaTexto.trim() !== '') {
      const delta = lerDelta(deltaTexto)
      if (delta === null || atributoId === '') {
        setInvalido('delta')
        setErro('Modificador: um número com sinal, como +2 ou -3 (sem o zero).')
        return
      }
      mudancas.push({ tipo: 'atributo', atributoId, delta })
    }
    if (mudancas.length === 0) {
      setErro('Nada mudou: troque um número antes de ajustar.')
      return
    }
    if (onConfirmar({ tokenId, mudancas: mudancas.slice(0, MUDANCAS_DO_AJUSTE_MAX) })) onFechar()
    else setErro('Não saiu: a ficha saiu da batalha, ou sem conexão com o mestre.')
  }

  const atributo = sistema.atributos.find((candidato) => candidato.id === atributoId)
  const deltaLido = deltaTexto.trim() === '' ? null : lerDelta(deltaTexto)
  return (
    <JanelaDaBatalha titulo={`Ajustar ${quem}`} descricao="Muda a ficha na hora. Entra no registro; o mestre desfaz por ele." onFechar={onFechar}>
      <form className="bt-form bt-ajuste" onSubmit={confirmar} noValidate>
        {linhas.length > 0 && (
          <fieldset className="bt-ajuste__grade">
            <legend className="bt-sr">Recursos</legend>
            <span className="bt-ajuste__cabeca" aria-hidden="true" />
            <span className="bt-ajuste__cabeca" aria-hidden="true">
              Atual
            </span>
            <span className="bt-ajuste__cabeca" aria-hidden="true">
              Máximo
            </span>
            {linhas.map((linha) => {
              const id = linha.recurso.id
              return (
                <div key={id} className="bt-ajuste__linha" role="group" aria-labelledby={`${idBase}-${id}`}>
                  <span className="bt-ajuste__nome" id={`${idBase}-${id}`} data-tom={linha.recurso.tom}>
                    {linha.recurso.nome}
                    {linha.forca !== 1 && <small>Força ×{formatarNumero(linha.forca)}: o app multiplica</small>}
                  </span>
                  <input
                    className="bt-num"
                    inputMode="numeric"
                    aria-label={`${linha.recurso.nome} atual`}
                    value={textos[`atual:${id}`] ?? ''}
                    aria-invalid={invalido === `atual:${id}` ? true : undefined}
                    onChange={(evento) => trocar(`atual:${id}`, evento.target.value)}
                  />
                  {linha.maximo === null ? (
                    <span className="bt-ajuste__sem">sem máximo</span>
                  ) : (
                    <input
                      className="bt-num"
                      inputMode="numeric"
                      aria-label={`${linha.recurso.nome} máximo`}
                      value={textos[`maximo:${id}`] ?? ''}
                      aria-invalid={invalido === `maximo:${id}` ? true : undefined}
                      onChange={(evento) => trocar(`maximo:${id}`, evento.target.value)}
                    />
                  )}
                </div>
              )
            })}
          </fieldset>
        )}
        {sistema.atributos.length > 0 && (
          <div className="bt-form__linha bt-ajuste__atributo">
            <label htmlFor={`${idBase}-atributo`}>Atributo até o fim da batalha</label>
            <span className="bt-calc-junto">
              <select id={`${idBase}-atributo`} className="bt-num" style={{ width: 'auto' }} value={atributoId} onChange={(evento) => setAtributoId(evento.target.value)}>
                {sistema.atributos.map((candidato) => (
                  <option key={candidato.id} value={candidato.id}>
                    {candidato.nome} ({formatarNumero(atributoComposto(personagem, candidato.id).total)})
                  </option>
                ))}
              </select>
              <input
                className="bt-num"
                inputMode="numeric"
                placeholder="+2"
                aria-label="Modificador do atributo"
                aria-describedby={`${idBase}-atributo-nota`}
                value={deltaTexto}
                aria-invalid={invalido === 'delta' ? true : undefined}
                onChange={(evento) => {
                  setErro(null)
                  setInvalido(null)
                  setDeltaTexto(evento.target.value)
                }}
              />
            </span>
            <small className="bt-mira__nota" id={`${idBase}-atributo-nota`}>
              {atributo !== undefined && deltaLido !== null
                ? `${atributo.nome} ${formatarNumero(atributoComposto(personagem, atributo.id).total)} → ${formatarNumero(atributoComposto(personagem, atributo.id).total + deltaLido)}, vira um selo na carta`
                : 'Vazio = sem modificador. Vira um selo na carta até a batalha acabar.'}
            </small>
          </div>
        )}
        {erro !== null && (
          <p className="bt-form__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="bt-form__acoes">
          <button type="button" className="bt-botao" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="bt-botao bt-botao--batalha">
            Ajustar
          </button>
        </div>
      </form>
    </JanelaDaBatalha>
  )
}
