import type { CitacaoDaCondicao } from '../../../lib/condicoes/frasesDaCondicao'
import type { TipoDaCondicao } from '../../../lib/condicoes/modelo'
import { textoDoUso, type UsoDaCondicao } from '../../../lib/condicoes/usos'
import './editor.css'

/**
 * ONDE ELA APARECE (rework das condições, PLANO.md E6; `blocoOnde` do protótipo, prototipo.html:1371): os
 * lugares que leem a condição do catálogo (o que se salva aqui já vale em todos) e quem a põe ou cita
 * agora: as fichas da pasta, o catálogo do livro e as outras condições (`usosDaCondicao`, E2), mais as de
 * fábrica que a citam (`quemCita`). Só leitura.
 */

const COMO_CITA: Readonly<Record<CitacaoDaCondicao['como'], string>> = { apaga: 'apaga esta', gatilho: 'no Depois de X turnos', aura: 'pela Aura' }

export interface OndeApareceProps {
  tipo: TipoDaCondicao
  usos: readonly UsoDaCondicao[]
  /** As de fábrica que citam esta (as criadas já entram em `usos`). */
  citadaPor: readonly CitacaoDaCondicao[]
  /** O nome de uma condição posta pelo id (o texto do uso "está com X"). */
  nomeDaCondicao: (condId: string) => string | null
}

export function OndeAparece({ tipo, usos, citadaPor, nomeDaCondicao }: OndeApareceProps) {
  const todos = [...usos.map((uso) => textoDoUso(uso, nomeDaCondicao)), ...citadaPor.map((citacao) => `${citacao.condicao.nome} (${COMO_CITA[citacao.como]})`)]
  return (
    <>
      <ul className="lb-cde-onde">
        <li>"Pôr condição" na ficha, no mapa e na batalha, com esta pastilha.</li>
        <li>
          Habilidades: "Se acertar, deixa uma condição" escolhe esta e os turnos; "Tira condições" pode tirar só as negativas
          {tipo === 'negativa' ? ', e esta entra.' : ', e esta fica.'}
        </li>
        <li>Itens: o "Ao acertar" da arma ou da munição.</li>
        <li>Outras condições: o Depois de X turnos, a Aura e a Contra-condição.</li>
      </ul>
      <div className="lb-cde-usos">
        <span className="lb-cde-rot">Quem põe ou cita agora</span>
        {todos.length === 0 ? (
          <span className="lb-cde-nota">ninguém ainda.</span>
        ) : (
          <ul className="lb-cde-etiquetas">
            {todos.map((texto, indice) => (
              <li key={indice} className="lb-cde-etiqueta">
                {texto}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
