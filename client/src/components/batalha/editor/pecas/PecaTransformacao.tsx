import type { Limite } from '../../../../lib/batalha/mecanica/modelo'
import { MODS_DA_FORMA_MAX, NOME_CURTO_MAX, NOME_DA_FADIGA, type ModDaForma, type PecaTransformacao } from '../../../../lib/batalha/mecanica/pecas'
import { condicaoDaFabrica } from '../../../../lib/condicoes/fabrica'
import { fraseCurta } from '../../../../lib/condicoes/frasesDaCondicao'
import { legadoDaFadiga } from '../../../../lib/condicoes/legado'
import { useCatalogoDoSeletor } from './condicoesNoSeletor'
import { Caixa, Campo, Escolher, Frase, Mais, Nota, Numero, PorDaLista, Segmentos, Texto, TextoCurto, Tirar } from './controlesDaPeca'
import { RegraDeAntes } from './RegraDeAntes'
import { Glifo } from './glifos'
import { comATecnicaNaForma, pedeAForma, tecnicasDaFicha } from './ligacoes'
import type { ArredoresDaPeca, PropsDaPeca } from './registro'
import { STATUS_DAS_PECAS, semOItem, trocado, turnos, vezes } from './vocabulario'

/** Os turnos de partida quando "alguns turnos" volta a valer (o `dura` do `pecaNova`). */
const DURA_DE_PARTIDA = 3
/** Os usos por batalha quando a caixa liga (o `usos` do protótipo). */
const USOS_DE_PARTIDA = 1
const USOS_MAX = 10
/** Quanto o atributo novo do "+ Atributo" muda. */
const MOD_DE_PARTIDA = 10

/** O limite com os usos por batalha (`null` = sem limite). A espera em rodadas sai: o motor guarda um tempo só. */
function limiteComUsos(limite: Limite, usos: number | null): Limite {
  const { recarga: _espera, usosPorBatalha: _antes, ...resto } = limite
  return usos === null ? resto : { ...resto, usosPorBatalha: usos }
}

function ListaDeMods({ rotulo, mods, sinal, aoMudar }: { rotulo: string; mods: readonly ModDaForma[]; sinal: 1 | -1; aoMudar: (mods: ModDaForma[]) => void }) {
  const livre = STATUS_DAS_PECAS.find((opcao) => !mods.some((mod) => mod.atributo === opcao.valor))
  const nomeDe = (atributo: string) => STATUS_DAS_PECAS.find((opcao) => opcao.valor === atributo)?.rotulo ?? atributo
  return (
    <>
      {mods.length > 0 && (
        <ul className="lb-pc__lista">
          {mods.map((mod, indice) => (
            // A posição é a identidade: trocar o atributo pela lista não pode remontar a linha (o foco sumiria).
            <li key={indice} className="lb-pc__item">
              <Escolher
                rotulo={`${rotulo}: atributo`}
                valor={mod.atributo}
                // O mesmo atributo duas vezes o leitor recusa: os já usados (menos o desta linha) saem da lista.
                opcoes={STATUS_DAS_PECAS.filter((opcao) => opcao.valor === mod.atributo || !mods.some((outro) => outro.atributo === opcao.valor))}
                onChange={(atributo) => aoMudar(trocado(mods, indice, { ...mod, atributo }))}
              />
              <Numero rotulo={`${rotulo}: quanto`} valor={mod.valor} minimo={-200} maximo={200} semZero onChange={(valor) => aoMudar(trocado(mods, indice, { ...mod, valor }))} />
              <Tirar rotulo={`Tirar ${nomeDe(mod.atributo)}`} onClick={() => aoMudar(semOItem(mods, indice))} />
            </li>
          ))}
        </ul>
      )}
      {livre !== undefined && mods.length < MODS_DA_FORMA_MAX && (
        <div>
          <Mais onClick={() => aoMudar([...mods, { atributo: livre.valor, valor: sinal * MOD_DE_PARTIDA }])}>Atributo</Mais>
        </div>
      )}
    </>
  )
}

/**
 * As técnicas da forma (D8): as que pedem "Numa forma <esta>" nos Requisitos delas. A lista mora lá;
 * aqui ela aparece e, com a ficha em volta, liga e desliga pelo requisito da técnica.
 */
function TecnicasDaForma({ arredores }: { arredores: ArredoresDaPeca | undefined }) {
  if (arredores === undefined) return <Nota>Cada técnica da forma pede «Numa forma» nos Requisitos dela: só dá para usar enquanto a forma durar.</Nota>
  const forma = arredores.cartao
  const tecnicas = tecnicasDaFicha(arredores.personagem, forma.id)
  const daForma = tecnicas.filter((cartao) => pedeAForma(cartao, forma))
  const outras = tecnicas.filter((cartao) => !daForma.includes(cartao))
  const mudar = arredores.aoMudarOutroCartao
  return (
    <Frase>
      <Texto>Técnicas da forma (só dá para usar enquanto durar):</Texto>
      {daForma.length === 0 && <Texto>nenhuma ainda</Texto>}
      {daForma.map((cartao) => (
        <span key={cartao.id} className="lb-pc__etq lb-pc__etq--selo">
          {cartao.nome.trim()}
          {mudar !== undefined && (
            <button type="button" className="lb-pc__etq-x" aria-label={`Tirar ${cartao.nome.trim()} da forma`} title="Tira o «Numa forma» dos Requisitos dela" onClick={() => mudar(comATecnicaNaForma(cartao, forma, false))}>
              <Glifo nome="x" />
            </button>
          )}
        </span>
      ))}
      {mudar !== undefined && outras.length > 0 && (
        <PorDaLista
          rotulo="Técnica"
          opcoes={outras.map((cartao) => ({ valor: cartao.id, rotulo: cartao.nome.trim() }))}
          onPor={(id) => {
            const cartao = outras.find((candidato) => candidato.id === id)
            if (cartao !== undefined) mudar(comATecnicaNaForma(cartao, forma, true))
          }}
        />
      )}
      <span className="lb-pc__nota-curta">grava «Numa forma {forma.nome || 'esta'}» nos Requisitos de cada uma</span>
    </Frase>
  )
}

/**
 * TRANSFORMAÇÃO (mecânica 5, D5 e D10; `corpoTransformacao` do protótipo; na "Ligar e manter" ou na
 * Overload): quanto dura, quantas vezes liga por batalha (o `limite` da técnica), ações a mais, as
 * técnicas da forma, os atributos que muda, o dano recebido, o deslocamento, o grupo, os golpes que não
 * erram (Overload), a marca a cada acerto e a Fadiga no fim.
 */
export function PecaTransformacao({ peca, mecanica, aoMudar, aoMudarAMecanica, arredores }: PropsDaPeca<'transformacao'>) {
  const overload = mecanica.limite.overload === true
  const usos = mecanica.limite.usosPorBatalha
  return (
    <>
      {overload && (
        <p className="lb-pc__frase">
          <span className="lb-pc__etq lb-pc__etq--selo">
            <Glifo nome="overload" />
            Overload
          </span>
          <Texto>1 por batalha. Ligar não erra e ninguém desvia: só outra Overload defende.</Texto>
        </p>
      )}
      <Frase>
        <Texto forte>Dura</Texto>
        <Segmentos
          rotulo="Quanto dura"
          valor={peca.dura > 0 ? 'turnos' : 'sempre'}
          opcoes={[
            { valor: 'turnos', rotulo: 'alguns turnos' },
            { valor: 'sempre', rotulo: 'até desligar' },
          ]}
          onChange={(como) => aoMudar({ ...peca, dura: como === 'sempre' ? 0 : DURA_DE_PARTIDA })}
        />
        {peca.dura > 0 && (
          <>
            <Numero rotulo="Quantos turnos" valor={peca.dura} minimo={1} maximo={20} onChange={(dura) => aoMudar({ ...peca, dura })} />
            <Texto>{`${turnos(peca.dura)} do dono depois de ligar`}</Texto>
          </>
        )}
      </Frase>
      {!overload && (
        <Frase>
          <Caixa rotulo="Pode ligar só" marcado={usos !== undefined} onChange={(marcado) => aoMudarAMecanica({ ...mecanica, limite: limiteComUsos(mecanica.limite, marcado ? USOS_DE_PARTIDA : null) })} />
          {usos === undefined ? (
            <Texto>algumas vezes por batalha (sem a caixa, liga sempre que tiver o custo)</Texto>
          ) : (
            <>
              <Numero rotulo="Usos por batalha" valor={usos} minimo={1} maximo={USOS_MAX} onChange={(n) => aoMudarAMecanica({ ...mecanica, limite: limiteComUsos(mecanica.limite, n) })} />
              <Texto>{`${vezes(usos)} por batalha`}</Texto>
            </>
          )}
          {mecanica.limite.recarga !== undefined && <span className="lb-pc__nota-curta">marcar troca a espera de {mecanica.limite.recarga} rodadas da linha Custo</span>}
        </Frase>
      )}
      <Frase>
        <Texto>Ações a mais em cada vez:</Texto>
        <Numero rotulo="Ações a mais" valor={peca.acoes} minimo={0} maximo={3} onChange={(acoes) => aoMudar({ ...peca, acoes })} />
        <Texto>{peca.acoes > 0 ? `(ataca ${peca.acoes + 1} vezes por vez)` : '(age normal)'}</Texto>
      </Frase>
      <TecnicasDaForma arredores={arredores} />
      <Campo rotulo="Muda os atributos enquanto durar (os Modificadores da aba Transformações)">
        <ListaDeMods rotulo="Muda" mods={peca.mods} sinal={1} aoMudar={(mods) => aoMudar({ ...peca, mods })} />
      </Campo>
      <Frase>
        <Texto>Dano recebido</Texto>
        <Numero rotulo="Dano recebido em porcentagem" valor={peca.danoRecebido} minimo={-90} maximo={200} onChange={(danoRecebido) => aoMudar({ ...peca, danoRecebido })} />
        <Texto>% (negativo = leva menos); deslocamento</Texto>
        <Numero rotulo="Deslocamento a mais" valor={peca.deslocamento} minimo={-6} maximo={6} onChange={(deslocamento) => aoMudar({ ...peca, deslocamento })} />
        <Texto>casas, no máximo</Texto>
        <Numero rotulo="Deslocamento máximo" valor={peca.deslocamentoMax} minimo={0} maximo={12} onChange={(deslocamentoMax) => aoMudar({ ...peca, deslocamentoMax })} />
        <Texto>(0 = sem teto)</Texto>
      </Frase>
      <Frase>
        <Texto>Grupo</Texto>
        <TextoCurto rotulo="Grupo da forma" valor={peca.grupo} maximo={NOME_CURTO_MAX} placeholder="Dragão" vazioVale onChange={(grupo) => aoMudar({ ...peca, grupo })} />
        <span className="lb-pc__nota-curta">formas do mesmo grupo trocam uma pela outra</span>
      </Frase>
      {overload && (
        <Frase>
          <Caixa rotulo="Os golpes enquanto durar também não erram (só outra Overload defende)" marcado={peca.naoErra} onChange={(naoErra) => aoMudar({ ...peca, naoErra })} />
        </Frase>
      )}
      <Frase>
        <Caixa rotulo="Cada ataque deixa uma marca no alvo; o próximo golpe do dono na marca dá o dobro e a marca some" marcado={peca.marca} onChange={(marca) => aoMudar({ ...peca, marca })} />
      </Frase>
      <Frase>
        <Caixa rotulo={`Quando acaba, vem a ${NOME_DA_FADIGA}`} marcado={peca.fadiga} onChange={(fadiga) => aoMudar({ ...peca, fadiga })} />
        {peca.fadiga && (
          <>
            <Texto>por</Texto>
            <Numero rotulo="Turnos da Fadiga" valor={peca.fadigaTurnos} minimo={1} maximo={10} onChange={(fadigaTurnos) => aoMudar({ ...peca, fadigaTurnos })} />
            <Texto>{turnos(peca.fadigaTurnos)}</Texto>
          </>
        )}
      </Frase>
      {peca.fadiga && <FadigaDaForma peca={peca} aoMudar={aoMudar} />}
    </>
  )
}

/** Os números da Fadiga de fábrica no formato da forma (`fadigaMods`): o que a peça guarda quando vale só a condição. */
function modsDaFadigaDeFabrica(): ModDaForma[] {
  const deFabrica = condicaoDaFabrica('fadiga')
  if (deFabrica === null) return []
  return deFabrica.pecas.flatMap((condicao) => (condicao.tipo === 'atributo' && condicao.conta === 'fixo' && condicao.ritmo === 'umaVez' && (condicao.faz === 'tira' || condicao.faz === 'soma') ? [{ atributo: condicao.atr, valor: condicao.faz === 'tira' ? -condicao.v : condicao.v }] : []))
}

/**
 * A Fadiga do fim da forma (rework das condições, E7; "Peça Transformação" no "onde fica" do protótipo):
 * é a Fadiga de fábrica, e a forma escolhe só os turnos. Os números próprios de antes (`fadigaMods`
 * diferentes dos da de fábrica) continuam valendo e ficam à vista, com "Usar só a condição".
 */
function FadigaDaForma({ peca, aoMudar }: { peca: PecaTransformacao; aoMudar: (peca: PecaTransformacao) => void }) {
  const catalogo = useCatalogoDoSeletor()
  const legado = legadoDaFadiga(peca)
  const deFabrica = condicaoDaFabrica('fadiga')
  const frase = deFabrica === null ? '' : fraseCurta(deFabrica, catalogo.contexto)
  return (
    <div className="lb-pc__frase--sub">
      {legado === null ? (
        <Nota>{frase === '' ? `A ${NOME_DA_FADIGA} de fábrica.` : `A ${NOME_DA_FADIGA} de fábrica: ${frase}.`}</Nota>
      ) : (
        // Sem "Virar condição nova": a forma põe a Fadiga pelo nome, e não guarda outro.
        <RegraDeAntes legado={legado} nome={NOME_DA_FADIGA} catalogo={catalogo} onUsarSoACondicao={() => aoMudar({ ...peca, fadigaMods: modsDaFadigaDeFabrica() })} />
      )}
    </div>
  )
}
