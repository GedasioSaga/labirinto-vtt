import { useState } from 'react'
import type { ComandoDBT, NucleoDBT } from '../../../lib/dbt/batalha/tipos'
import { fichaDoCombatente, type Fichas } from './dadosDaBatalhaDBT'
import { Secao } from './pecasDaBatalhaDBT'

/**
 * A FASE DE INICIATIVA (seção 5, `PainelIniciativaDBT`): quem tem forma
 * declara se transforma antes; o mestre rola (ou digita o d20 do dado
 * físico; sem ficha DBT, digita o total), confere a ordem, mexe nos empates
 * com Subir e Descer, e começa o combate.
 */

export interface PainelIniciativaDBTProps {
  nucleo: NucleoDBT
  fichas: Fichas
  enviar: (comando: ComandoDBT) => boolean
}

export function PainelIniciativaDBT({ nucleo, fichas, enviar }: PainelIniciativaDBTProps) {
  const [digitados, setDigitados] = useState<Readonly<Record<string, string>>>({})
  const [formas, setFormas] = useState<Readonly<Record<string, string>>>({})
  const declaracao = nucleo.pendencias.find((pendencia) => pendencia.tipo === 'declaracao')
  const faltam = declaracao?.tipo === 'declaracao' ? declaracao.faltam : []
  const cartas = nucleo.ordem.cartas.filter((id) => Object.hasOwn(nucleo.combatentes, id))
  const rolados = cartas.length > 0 && cartas.every((id) => nucleo.combatentes[id].iniciativa !== null)

  const rolar = () => {
    const numeros: Record<string, number> = {}
    for (const [id, texto] of Object.entries(digitados)) {
      const valor = Number(texto)
      if (texto.trim() !== '' && Number.isFinite(valor)) numeros[id] = Math.trunc(valor)
    }
    if (enviar({ tipo: 'rolarIniciativa', digitados: numeros })) setDigitados({})
  }

  const mover = (indice: number, passo: -1 | 1) => {
    const destino = indice + passo
    if (destino < 0 || destino >= cartas.length) return
    const ordem = [...cartas]
    ;[ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]]
    enviar({ tipo: 'ordenar', ordem })
  }

  return (
    <>
      {faltam.length > 0 && (
        <Secao titulo="Transformar antes do combate?" nota="Quem não declarar não transforma">
          <ul className="dbb-ini">
            {faltam.map((id) => {
              const c = nucleo.combatentes[id]
              const f = fichaDoCombatente(c, fichas)
              if (c === undefined || f === null) return null
              const escolhida = formas[id] ?? ''
              return (
                <li key={id}>
                  <span>{c.nome}</span>
                  <select className="dbf-sel" aria-label={`Forma de ${c.nome}`} value={escolhida} onChange={(evento) => setFormas({ ...formas, [id]: evento.target.value })}>
                    <option value="">Forma normal</option>
                    {f.transformacoes.map((forma) => (
                      <option key={forma.id} value={forma.id}>
                        {forma.nome} (+{forma.epBonus} EP, {forma.ki} Ki)
                      </option>
                    ))}
                  </select>
                  <button type="button" className="dbf-btn dbf-btn--sm" onClick={() => enviar({ tipo: 'declarar', combatenteId: id, transformacaoId: escolhida === '' ? null : escolhida })}>
                    Declarar
                  </button>
                </li>
              )
            })}
          </ul>
        </Secao>
      )}
      <Secao titulo="Iniciativa" nota={nucleo.opcoes.modo === 'manual' ? 'Digite o d20 rolado à mesa, ou deixe vazio para o app rolar' : 'Vazio = o app rola; digitado = o d20 da mesa'}>
        <ol className="dbb-ini" aria-label="Ordem da iniciativa">
          {cartas.map((id, indice) => {
            const c = nucleo.combatentes[id]
            const manual = fichaDoCombatente(c, fichas) === null
            const natural = c.iniciativa?.d20 === 20 ? ' (20 natural: imune na rodada 1)' : c.iniciativa?.d20 === 1 ? ' (1 natural: perde o 1º turno)' : ''
            return (
              <li key={id}>
                <span>
                  {c.nome}
                  {c.transformacao !== null && <span className="dbf-tag dbf-tag--amber"> {c.transformacao.nome}</span>}
                  {natural !== '' && <span className="dbb-cartao__d">{natural}</span>}
                </span>
                <input
                  className="dbf-inp"
                  type="number"
                  inputMode="numeric"
                  min={manual ? undefined : 1}
                  max={manual ? undefined : 20}
                  placeholder={manual ? 'total' : 'd20'}
                  aria-label={manual ? `Total da iniciativa de ${c.nome} (sem ficha Dragon Ball)` : `d20 da iniciativa de ${c.nome}`}
                  value={digitados[id] ?? ''}
                  onChange={(evento) => setDigitados({ ...digitados, [id]: evento.target.value })}
                />
                <span className="dbb-carta__ctl">
                  <span className="dbb-ini__total" aria-label={c.iniciativa === null ? 'Sem iniciativa' : `Iniciativa ${c.iniciativa.total}`}>
                    {c.iniciativa?.total ?? '–'}
                  </span>
                  {rolados && (
                    <>
                      <button type="button" className="dbf-sbtn" aria-label={`Subir ${c.nome}`} disabled={indice === 0} onClick={() => mover(indice, -1)}>
                        ↑
                      </button>
                      <button type="button" className="dbf-sbtn" aria-label={`Descer ${c.nome}`} disabled={indice === cartas.length - 1} onClick={() => mover(indice, 1)}>
                        ↓
                      </button>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
        {cartas.length === 0 && <p className="dbb-vazio">Ninguém entrou na batalha. Encerre e inicie de novo com fichas na cena.</p>}
        <div className="dbb-cartao__acoes">
          <button type="button" className={`dbf-btn${rolados ? '' : ' dbf-btn--pri'}`} disabled={cartas.length === 0} onClick={rolar}>
            {rolados ? 'Rolar de novo' : 'Rolar iniciativa'}
          </button>
          <button type="button" className={`dbf-btn${rolados ? ' dbf-btn--pri' : ''}`} disabled={!rolados} onClick={() => enviar({ tipo: 'comecar' })}>
            Começar o combate
          </button>
        </div>
      </Secao>
    </>
  )
}
