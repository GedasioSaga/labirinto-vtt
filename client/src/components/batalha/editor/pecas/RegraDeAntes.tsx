import { useId, useState } from 'react'
import { frasePeca, textoDaFrase } from '../../../../lib/condicoes/frasesDaCondicao'
import { rascunhoDoLegado, type LegadoDaCondicao } from '../../../../lib/condicoes/legado'
import { PRAZO_PADRAO } from '../../../../lib/condicoes/modelo'
import { condicaoDoSeletor, virarCondicaoNovaRegistrado, type CatalogoDoSeletor } from './condicoesNoSeletor'
import './condicaoNoSeletor.css'

/**
 * "REGRA PRÓPRIA (DE ANTES)" (rework das condições, D4; E7). Antes do rework, quem punha a condição
 * podia levar números próprios (o selo da técnica, o `n` e o gatilho do item, a Fadiga da forma). Eles
 * continuam valendo por cima dos da condição, e aqui ficam À VISTA, em frases, sem campo para mudar: a
 * regra nova mora na condição. Duas saídas:
 *  - "Usar só a condição": o lugar fica só com o nome e o prazo, e vale a regra da condição;
 *  - "Virar condição nova": o número de antes e a condição viram uma condição sua (só no app), e o lugar
 *    passa a pôr essa.
 */

interface RegraDeAntesProps {
  legado: LegadoDaCondicao
  /** O nome da condição que o lugar põe (a base do "Virar condição nova"). */
  nome: string
  catalogo: CatalogoDoSeletor
  onUsarSoACondicao: () => void
  /** O lugar passa a pôr a condição nova, sem os números de antes. Ausente = o lugar não troca de nome (a Fadiga da forma). */
  onVirou?: (nome: string) => void
}

function comMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

export function RegraDeAntes({ legado, nome, catalogo, onUsarSoACondicao, onVirou }: RegraDeAntesProps) {
  const titulo = useId()
  const [erro, setErro] = useState<string | null>(null)
  const virar = onVirou === undefined ? null : virarCondicaoNovaRegistrado()
  const prazo = legado.prazo ?? PRAZO_PADRAO
  const frases = legado.pecas.map((peca) => comMaiuscula(textoDaFrase(frasePeca(peca, { prazo }, catalogo.contexto))))
  const virarAgora = () => {
    if (virar === null || onVirou === undefined) return
    const nomeLimpo = nome.trim()
    const feito = virar(rascunhoDoLegado(legado, nomeLimpo === '' ? null : condicaoDoSeletor(catalogo, nomeLimpo), nomeLimpo === '' ? 'Condição' : nomeLimpo, catalogo.ocupados))
    if (feito === null) {
      setErro('Não gravou: a lista de condições está cheia ou o nome não vale. Apague uma em Livros › Condições e tente de novo.')
      return
    }
    setErro(null)
    onVirou(feito)
  }
  return (
    <section className="lb-cs-antes" aria-labelledby={titulo}>
      <h4 className="lb-cs-antes__tit" id={titulo}>
        Regra própria (de antes)
      </h4>
      <p className="lb-cs-antes__nota">{`Estes números vêm de antes das condições novas e valem por cima dos ${nome.trim() === '' ? 'da condição' : `de ${nome.trim()}`}.`}</p>
      {frases.length > 0 && (
        <ul className="lb-cs-antes__lista">
          {frases.map((frase, indice) => (
            <li key={`${indice}-${frase}`}>{frase}</li>
          ))}
        </ul>
      )}
      {legado.confira.length > 0 && (
        <ul className="lb-cs-antes__lista lb-cs-antes__lista--confira">
          {legado.confira.map((linha, indice) => (
            <li key={`${indice}-${linha}`}>{linha}</li>
          ))}
        </ul>
      )}
      <div className="lb-cs-antes__acoes">
        <button type="button" className="lb-btn lb-btn--compact" onClick={onUsarSoACondicao}>
          Usar só a condição
        </button>
        {virar !== null && (
          <button type="button" className="lb-btn lb-btn--compact" onClick={virarAgora}>
            Virar condição nova
          </button>
        )}
      </div>
      {erro !== null && (
        <p className="lb-cs-antes__erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  )
}
