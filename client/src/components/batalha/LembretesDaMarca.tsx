import { useId, useState } from 'react'
import type { PedidoDeMarca } from '../../lib/batalha/combate'
import { modificadorDoTeste, motivoDaMarca, passivaDaMarca, type ComoMarca } from '../../lib/batalha/marca'
import { numeroDaFicha, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { formatarNumero } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * R1 (lote de 01/11): o lembrete da MARCA (Olhar Artístico, do Vincent),
 * no estilo dos lembretes das passivas: quando ele acerta com arma de fogo,
 * "Marcar o alvo? Pagar 40 SP · Teste de Percepção · Agora não". Nunca
 * automático. O teste rola no host (d20 + modificador, a CD da ficha) e, para
 * quem rolou na mesa, "Rolei fora: Passou / Falhou". A marca não tem turnos:
 * o próximo golpe que acertar o marcado dá o dobro e ela some.
 */

/** Um lembrete de marca pronto para a tela. */
export interface MarcaNaTela {
  id: string
  /** Quem atirou, quando a tela mostra lembretes de mais de uma ficha. */
  quem?: string
  alvo: string
  /** O nome da passiva ("Olhar Artístico"). */
  passiva: string
  sp: number | null
  /** O SP de agora de quem marca (o "SP insuficiente" apaga o botão). */
  spAtual: number
  teste: { nome: string; cd: number | null; modificador: number } | null
}

/** O lembrete da ficha: a passiva e o teste dela, ou `null` (a passiva saiu da ficha). */
export function marcaNaTela(lembrete: { id: string; alvoTokenId: string }, personagem: Personagem | undefined, sistema: SistemaDeRpg | null, nomeDe: (tokenId: string) => string, quem?: string): MarcaNaTela | null {
  if (personagem === undefined || sistema === null) return null
  const achada = passivaDaMarca(personagem, sistema)
  if (achada === null) return null
  const { cartao, leitura } = achada
  const sp = sistema.recursos.find((recurso) => recurso.tom === 'energia')
  const teste = leitura.teste === null ? null : { nome: leitura.teste.nome, cd: leitura.teste.cd, modificador: modificadorDoTeste(personagem, sistema, leitura.teste.atributoId) }
  const item: MarcaNaTela = {
    id: lembrete.id,
    alvo: nomeDe(lembrete.alvoTokenId),
    passiva: cartao.nome.replace(/\s*\([^)]*\)/g, '').trim() || cartao.nome,
    sp: leitura.sp,
    spAtual: sp === undefined ? 0 : Math.max(0, numeroDaFicha(personagem.recursos, sp.id)),
    teste,
  }
  if (quem !== undefined) item.quem = quem
  return item
}

/** "d20 + 3, 15 ou mais"; sem CD = só o "rolei fora". */
function textoDoTeste(teste: NonNullable<MarcaNaTela['teste']>): string {
  const mod = teste.modificador === 0 ? '' : ` ${teste.modificador > 0 ? '+' : '−'} ${Math.abs(teste.modificador)}`
  return teste.cd === null ? `d20${mod}` : `d20${mod}, ${teste.cd} ou mais`
}

function UmaMarca({ item, esperando, onResponder }: { item: MarcaNaTela; esperando?: boolean; onResponder: (pedido: PedidoDeMarca) => boolean }) {
  const id = useId()
  const [erro, setErro] = useState<string | null>(null)
  const leitura = { tipo: 'passiva' as const, sp: item.sp, teste: item.teste === null ? null : { atributoId: '', nome: item.teste.nome, cd: item.teste.cd } }
  const motivo = (como: ComoMarca) => motivoDaMarca(leitura, como, item.spAtual)
  const responder = (como: ComoMarca) => {
    if (esperando) return
    const saiu = onResponder({ tipo: 'marcar', lembreteId: item.id, como })
    setErro(saiu ? null : 'Não saiu: sem conexão com o mestre, ou o alvo já está marcado.')
  }
  const motivoDoSp = item.sp === null ? null : motivo('sp')
  const comTesteNoApp = item.teste !== null && item.teste.cd !== null

  return (
    <li className="bt-lembrete bt-lembrete--marca" data-tipo="marca">
      <p className="bt-lembrete__texto" id={`${id}-texto`}>
        <span className="bt-lembrete__marca" aria-hidden="true" />
        {item.quem !== undefined && <span className="bt-lembrete__quem">{item.quem} · </span>}
        <b>Marcar {item.alvo}?</b>
        <span className="bt-lembrete__det">
          {' '}
          · {item.passiva}: o próximo golpe que acertar dá o dobro
        </span>
      </p>
      <div className="bt-lembrete__acoes" role="group" aria-labelledby={`${id}-texto`}>
        {item.sp !== null && (
          <button type="button" className="bt-botao bt-botao--passiva" disabled={esperando || motivoDoSp !== null} aria-describedby={motivoDoSp === null ? undefined : `${id}-motivo`} onClick={() => responder('sp')}>
            Pagar {formatarNumero(item.sp)} SP
          </button>
        )}
        {item.teste !== null && comTesteNoApp && (
          <button type="button" className={item.sp === null ? 'bt-botao bt-botao--passiva' : 'bt-botao'} disabled={esperando} title={`O app rola ${textoDoTeste(item.teste)}`} onClick={() => responder('teste')}>
            Teste de {item.teste.nome} <small>{textoDoTeste(item.teste)}</small>
          </button>
        )}
        <button type="button" className="bt-botao" disabled={esperando} onClick={() => responder('agoraNao')}>
          Agora não
        </button>
      </div>
      {item.teste !== null && (
        <div className="bt-lembrete__fora" role="group" aria-label={`Rolei o teste de ${item.teste.nome} fora`}>
          <span>Rolei fora:</span>
          <button type="button" className="bt-botao bt-botao--p" disabled={esperando} onClick={() => responder('passou')}>
            Passou
          </button>
          <button type="button" className="bt-botao bt-botao--p" disabled={esperando} onClick={() => responder('falhou')}>
            Falhou
          </button>
        </div>
      )}
      {motivoDoSp !== null && (
        <p className="bt-lembrete__motivo" id={`${id}-motivo`}>
          {motivoDoSp}
        </p>
      )}
      {erro !== null && (
        <p className="bt-lembrete__motivo" role="alert">
          {erro}
        </p>
      )}
    </li>
  )
}

export interface LembretesDaMarcaProps {
  itens: readonly MarcaNaTela[]
  esperando?: boolean
  onResponder: (pedido: PedidoDeMarca) => boolean
  className?: string
}

/** A faixa dos lembretes da marca: some quando não há nenhum. */
export function LembretesDaMarca({ itens, esperando, onResponder, className }: LembretesDaMarcaProps) {
  if (itens.length === 0) return null
  return (
    <section className={['bt-lembretes', className].filter(Boolean).join(' ')} aria-label="Lembretes da marca">
      <ul className="bt-lembretes__lista">
        {itens.map((item) => (
          <UmaMarca key={item.id} item={item} esperando={esperando} onResponder={onResponder} />
        ))}
      </ul>
    </section>
  )
}
