import { useRef, useState } from 'react'
import type { LinhaDoFimDBT } from '../../../lib/dbt/batalha/fim'
import { Dialogo } from '../../grimorio/Dialogo'
import '../ficha/fichaDBT.css'
import './batalhaDBT.css'

/**
 * O FIM DA BATALHA DBT (seção 13, `FimDaBatalhaDBT`), em duas etapas:
 * 1) a tabela da exaustão, editável, com o aviso de cada ficha
 *    (`LinhaDoFimDBT.aviso`); 2) a confirmação, porque encerrar não se
 *    desfaz (o histórico da ficha guarda o que mudou).
 */

export interface FimDaBatalhaDBTProps {
  aberto: boolean
  /** A tabela de `resumoDoFim`, lida quando o mestre clicou Encerrar. */
  linhas: readonly LinhaDoFimDBT[]
  exaustao: boolean
  onEncerrar: (linhas: readonly LinhaDoFimDBT[] | null) => void
  onFechar: () => void
}

type Etapa = { tipo: 'tabela' } | { tipo: 'confirmar'; aplicar: boolean }

function inteiroEntre(texto: string, min: number, max: number): number | null {
  const valor = Number(texto)
  if (texto.trim() === '' || !Number.isFinite(valor)) return null
  return Math.min(max, Math.max(min, Math.trunc(valor)))
}

export function FimDaBatalhaDBT({ aberto, linhas, exaustao, onEncerrar, onFechar }: FimDaBatalhaDBTProps) {
  const [editadas, setEditadas] = useState<readonly LinhaDoFimDBT[]>(linhas)
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'tabela' })
  const voltar = useRef<HTMLButtonElement>(null)

  const trocar = (personagemId: string, mudar: (linha: LinhaDoFimDBT) => LinhaDoFimDBT) => setEditadas(editadas.map((linha) => (linha.personagemId === personagemId ? mudar(linha) : linha)))

  if (etapa.tipo === 'confirmar') {
    const quantas = editadas.length
    return (
      <Dialogo aberto={aberto} titulo="Encerrar a batalha?" onFechar={onFechar} pequeno alerta focoInicial={voltar} descricao="Encerrar não se desfaz.">
        <div className="dbf dbb">
          <p className="dbb-cartao__d">
            {etapa.aplicar
              ? `O Ki bloqueado entra em ${quantas === 1 ? '1 ficha' : `${quantas} fichas`} até o Descanso Longo, e o Ki atual volta ao máximo menos o bloqueado. A vida fica como está.`
              : 'Nenhuma ficha muda. Transformações e condições somem com a batalha.'}
          </p>
          <div className="dbb-cartao__acoes">
            <button type="button" className="dbf-btn dbf-btn--pri" onClick={() => onEncerrar(etapa.aplicar ? editadas : null)}>
              {etapa.aplicar ? 'Aplicar e encerrar' : 'Encerrar sem aplicar'}
            </button>
            <button ref={voltar} type="button" className="dbf-btn dbf-btn--ghost" onClick={() => setEtapa({ tipo: 'tabela' })}>
              Voltar à tabela
            </button>
          </div>
        </div>
      </Dialogo>
    )
  }

  return (
    <Dialogo aberto={aberto} titulo="Fim da batalha" onFechar={onFechar} descricao={exaustao ? 'A exaustão de cada ficha (8.5.1). Ajuste antes de aplicar.' : 'A exaustão está desligada nesta batalha: só o Ki bloqueado da forma máxima conta.'}>
      <div className="dbf dbb">
        {editadas.length === 0 ? (
          <p className="dbb-vazio">Ninguém com ficha Dragon Ball lutou: não há o que gravar.</p>
        ) : (
          <table className="dbb-fim">
            <thead>
              <tr>
                <th scope="col">Ficha</th>
                <th scope="col">Técnicas</th>
                <th scope="col">Formas</th>
                <th scope="col">Ki bloqueado</th>
                <th scope="col">Forma máx.</th>
                <th scope="col">Choque</th>
              </tr>
            </thead>
            <tbody>
              {editadas.map((linha) => (
                <tr key={linha.personagemId}>
                  <td>
                    {linha.nome}
                    {linha.aviso !== null && <span className="dbb-fim__aviso">{linha.aviso}</span>}
                  </td>
                  <td>{linha.pctTecnicas}%</td>
                  <td>{linha.pctInferiores}%</td>
                  <td>
                    <input
                      className="dbf-inp"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={linha.pkMax}
                      aria-label={`Ki bloqueado de ${linha.nome} (antes ${linha.pkBloqueadosAntes}, de ${linha.pkMax})`}
                      value={linha.pkBloqueados}
                      onChange={(evento) => {
                        const valor = inteiroEntre(evento.target.value, 0, linha.pkMax)
                        if (valor !== null) trocar(linha.personagemId, (atual) => ({ ...atual, pkBloqueados: valor }))
                      }}
                    />{' '}
                    / {linha.pkMax}
                  </td>
                  <td>
                    <input
                      className="dbf-inp"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`Usos da forma máxima de ${linha.nome}`}
                      value={linha.usosTransfMaxima}
                      onChange={(evento) => {
                        const valor = inteiroEntre(evento.target.value, 0, 99)
                        if (valor !== null) trocar(linha.personagemId, (atual) => ({ ...atual, usosTransfMaxima: valor }))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${linha.nome} usou o Choque de Poder`}
                      checked={linha.choqueUsado}
                      onChange={(evento) => trocar(linha.personagemId, (atual) => ({ ...atual, choqueUsado: evento.target.checked }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="dbb-cartao__acoes">
          <button type="button" className="dbf-btn dbf-btn--pri" disabled={editadas.length === 0} onClick={() => setEtapa({ tipo: 'confirmar', aplicar: true })}>
            Aplicar e encerrar…
          </button>
          <button type="button" className="dbf-btn" onClick={() => setEtapa({ tipo: 'confirmar', aplicar: false })}>
            Encerrar sem aplicar…
          </button>
          <button type="button" className="dbf-btn dbf-btn--ghost" onClick={onFechar}>
            Voltar à batalha
          </button>
        </div>
      </div>
    </Dialogo>
  )
}
