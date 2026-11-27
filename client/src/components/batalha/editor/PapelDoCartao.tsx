import type { ReactNode } from 'react'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO } from '../../../lib/batalha/leituraDaFicha'
import { CAMPO_DO_DANO } from '../../../lib/batalha/formula'
import { NOME_DO_TEXTO_DE_ANTES } from '../../../lib/batalha/mecanica/textoGerado'
import type { CartaoDaFicha } from '../../../lib/personagem'

/** A frase do papel no cartão só de texto: o Efeito escrito. */
export function fraseDoTexto(cartao: CartaoDaFicha): string {
  return (cartao.campos[CAMPO_DO_EFEITO] ?? '').trim() || 'Sem efeito escrito.'
}

/** A linha curta do cartão só de texto: a Ação, o Custo e o Dano escritos, que a batalha lê hoje. */
export function linhaDoTexto(cartao: CartaoDaFicha): string {
  const ler = (campo: string) => (cartao.campos[campo] ?? '').trim()
  const dano = ler(CAMPO_DO_DANO)
  const partes = [ler(CAMPO_DA_ACAO), ler(CAMPO_DO_CUSTO), dano === '' ? '' : `Dano ${dano}`].filter((parte) => parte !== '')
  return partes.length === 0 ? 'Ainda sem peças: a batalha lê os campos escritos' : partes.join(' · ')
}

interface PapelDoCartaoProps {
  cartao: CartaoDaFicha
  linhaCurta: string
  /** A frase: o Efeito escrito, ou os pedaços que levam às linhas do editor. */
  frase: ReactNode
  /** No editor o nome é o título do papel; no cartão da ficha, só texto (o título é o do cartão). */
  nomeComoTitulo?: boolean
}

/**
 * O PAPEL (protótipo aprovado, `.papel`): como a habilidade fica no cartão. O mesmo na coluna do
 * editor e no topo do cartão de texto da ficha, para os dois dizerem igual.
 */
export function PapelDoCartao({ cartao, linhaCurta, frase, nomeComoTitulo = true }: PapelDoCartaoProps) {
  // O "Texto de antes" é o que estava escrito antes das peças: não é anotação do cartão para ler no papel.
  const extrasDoPapel = cartao.extras.filter((extra) => extra.nome !== NOME_DO_TEXTO_DE_ANTES)
  const descricao = (cartao.campos.descricao ?? '').trim()
  const nome = cartao.nome.trim() || 'Sem nome'
  return (
    <article className="lb-ed__papel">
      {nomeComoTitulo ? <h3 className="lb-ed__papel-nome">{nome}</h3> : <p className="lb-ed__papel-nome">{nome}</p>}
      <p className="lb-ed__papel-linha">{linhaCurta}</p>
      <p className="lb-ed__papel-frase">{frase}</p>
      {descricao !== '' && <p className="lb-ed__papel-desc">{descricao}</p>}
      {extrasDoPapel.length > 0 && (
        <div className="lb-ed__papel-extras">
          {extrasDoPapel.map((extra, indice) => (
            <span key={indice}>
              <b>{extra.nome.trim() || '(sem nome)'}:</b> {extra.valor}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
