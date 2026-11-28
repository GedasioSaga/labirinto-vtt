import { useState } from 'react'
import { Botao } from '../../grimorio/Botao'
import { CampoLiga } from '../../grimorio/CampoLiga'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { NOME_DO_MATERIAL_DO_PAINEL } from '../../../puzzles/interruptores/interruptores'
import { corDasPartes, lerMistura, misturaDoPuzzle, NOME_DO_AO_ERRAR, NOME_DO_LIQUIDO, NOME_DO_MODO } from '../../../puzzles/mistura/mistura'
import { buscarNaBancada, caminhoDoAlvo, chaveDaCor, comAlvoAlcancavel, passosMinimos, textoDaProporcao, textoDoPasso } from '../../../puzzles/mistura/solucao'
import {
  AO_ERRAR_NA_MISTURA,
  CAPACIDADE_MAX,
  CAPACIDADE_MIN,
  INGREDIENTES_MAX,
  LIQUIDOS_DA_MISTURA,
  MATERIAIS_DOS_INTERRUPTORES,
  MODOS_DA_MISTURA,
  RECIPIENTES_MAX,
  RECIPIENTES_MIN,
  type MisturaDoPuzzle,
  type RecipienteDaMistura,
} from '../../../puzzles/tipos'
import { comMistura } from '../edicao'
import { EscolhaDeItem, NumeroDoCampo, Secao, type PropsDaSecao } from './comum'

/**
 * A MISTURA DE LÍQUIDOS NA FICHA DO EDITOR (28/11): o metal, o modo (medir
 * volumes, misturar cores ou seguir a receita), quantos recipientes e o que
 * cada um tem no começo, a torneira, o alvo e o que o erro faz.
 *
 * SEMPRE SOLUCIONÁVEL: o alvo só se escolhe entre os que a busca do caminho
 * mais curto alcança com esta bancada, e qualquer mudança na bancada que
 * deixe o alvo fora de alcance o troca pelo alcançável mais perto. O mestre
 * vê o número mínimo de passos e a solução, passo a passo.
 */

const OPCOES_DO_MATERIAL = MATERIAIS_DOS_INTERRUPTORES.map((material) => ({ valor: material, rotulo: NOME_DO_MATERIAL_DO_PAINEL[material] }))
const OPCOES_DO_MODO = MODOS_DA_MISTURA.map((modo) => ({ valor: modo, rotulo: NOME_DO_MODO[modo] }))
const OPCOES_DO_ERRO = AO_ERRAR_NA_MISTURA.map((ao) => ({ valor: ao, rotulo: NOME_DO_AO_ERRAR[ao] }))
const OPCOES_DE_QUANTOS = Array.from({ length: RECIPIENTES_MAX - RECIPIENTES_MIN + 1 }, (_, i) => ({ valor: String(RECIPIENTES_MIN + i), rotulo: String(RECIPIENTES_MIN + i) }))
const VAZIO = 'vazio'
const OPCOES_DO_COMECO = [{ valor: VAZIO, rotulo: 'Vazio' }, ...LIQUIDOS_DA_MISTURA.filter((l) => l !== 'agua').map((l) => ({ valor: l, rotulo: NOME_DO_LIQUIDO[l] }))]
/** Quantas cores alcançáveis o editor oferece (as de caminho mais curto primeiro). */
const CORES_NA_LISTA = 24
const QUALQUER = 'qualquer'

const AJUDA_DO_MODO: Readonly<Record<MisturaDoPuzzle['modo'], string>> = {
  volumes: 'Jarras sem marca, uma torneira e uma pia: o jogador enche, esvazia e despeja de uma na outra até uma delas ter a medida certa, e a leva ao receptáculo.',
  cores: 'Frascos com tinta: despejar de um no outro mistura as cores na proporção do que passou. A cor certa é uma proporção (2 de vermelho e 1 de amarelo dá um laranja).',
  receita: 'Frascos de água e os ingredientes que o grupo achou no mapa (itens do acervo): o jogador põe os itens certos num frasco e o leva ao receptáculo.',
}

function nomeDoRecipiente(i: number, modo: MisturaDoPuzzle['modo']): string {
  return `${modo === 'volumes' ? 'Jarra' : 'Frasco'} ${i + 1}`
}

export function SecaoMistura({ puzzle, mudar }: PropsDaSecao) {
  const mistura = misturaDoPuzzle(puzzle)
  const [escolhendo, setEscolhendo] = useState(false)
  if (mistura === null) return null
  const { modo, recipientes } = mistura
  /** Uma mudança na bancada, relida pelo leitor e com o alvo levado ao alcançável mais perto. */
  const trocar = (mudanca: Partial<MisturaDoPuzzle>) => mudar((atual) => comMistura(atual, (antes) => comAlvoAlcancavel(lerMistura({ ...antes, ...mudanca }) ?? antes)))
  const trocarRecipiente = (i: number, mudanca: Partial<RecipienteDaMistura>) => trocar({ recipientes: recipientes.map((r, k) => (k === i ? { ...r, ...mudanca } : r)) })

  const busca = buscarNaBancada(mistura)
  const caminho = caminhoDoAlvo(mistura)
  const minimo = passosMinimos(mistura)
  const litrosAlcancaveis = [...busca.litros.keys()].sort((a, b) => a - b)
  const coresAlcancaveis = [...busca.cores.values()].sort((a, b) => a.caminho.length - b.caminho.length).slice(0, CORES_NA_LISTA)
  const corDoAlvo = chaveDaCor(mistura.cor)

  return (
    <Secao titulo="Bancada de mistura">
      <CampoSeg rotulo="Metal" opcoes={OPCOES_DO_MATERIAL} valor={mistura.material} onChange={(material) => material !== mistura.material && trocar({ material })} />
      <CampoSeg rotulo="Modo" opcoes={OPCOES_DO_MODO} valor={modo} onChange={(novo) => novo !== modo && trocar({ modo: novo, recipientes: recipientes.map((r) => ({ ...r, comeca: novo === 'cores' ? null : 'agua', quanto: novo === 'cores' ? 0 : Math.min(r.quanto, r.capacidade) })) })} />
      <p className="pze-nota">{AJUDA_DO_MODO[modo]}</p>
      <CampoSeg
        rotulo={modo === 'volumes' ? 'Jarras' : 'Frascos'}
        opcoes={OPCOES_DE_QUANTOS}
        valor={String(recipientes.length)}
        onChange={(valor) => {
          const n = Number(valor)
          if (n === recipientes.length) return
          const novos = Array.from({ length: n }, (_, i): RecipienteDaMistura => recipientes[i] ?? { capacidade: 4, comeca: modo === 'cores' ? null : 'agua', quanto: 0 })
          trocar({ recipientes: novos })
        }}
      />
      {recipientes.map((r, i) => (
        <div key={i} className="gr-campo pze-mx-recipiente">
          <span className="gr-campo__rot">{nomeDoRecipiente(i, modo)}</span>
          <NumeroDoCampo rotulo="Cabem (L)" valor={r.capacidade} min={CAPACIDADE_MIN} max={CAPACIDADE_MAX} onChange={(capacidade) => trocarRecipiente(i, { capacidade, quanto: Math.min(r.quanto, capacidade) })} />
          {modo === 'cores' && (
            <CampoSeg rotulo="Começa com" opcoes={OPCOES_DO_COMECO} valor={r.comeca === null || r.quanto === 0 ? VAZIO : r.comeca} onChange={(valor) => trocarRecipiente(i, valor === VAZIO ? { comeca: null, quanto: 0 } : { comeca: LIQUIDOS_DA_MISTURA.find((l) => l === valor) ?? null, quanto: Math.max(1, r.quanto) })} />
          )}
          {(modo !== 'cores' || (r.comeca !== null && r.quanto > 0)) && <NumeroDoCampo rotulo={modo === 'cores' ? 'Litros de tinta' : 'Litros de água no começo'} valor={r.quanto} min={modo === 'cores' ? 1 : 0} max={r.capacidade} onChange={(quanto) => trocarRecipiente(i, { quanto })} />}
        </div>
      ))}
      {modo !== 'cores' && <CampoLiga rotulo="Torneira na bancada" ajuda={mistura.fonte ? 'Água à vontade: o jogador enche na torneira e esvazia na pia.' : 'Sem torneira: só a água que os recipientes já têm.'} ligado={mistura.fonte} onChange={(fonte) => trocar({ fonte })} />}

      {modo === 'volumes' && (
        <CampoSeg rotulo="Medida certa (L)" opcoes={litrosAlcancaveis.map((l) => ({ valor: String(l), rotulo: String(l) }))} valor={String(mistura.litros ?? '')} onChange={(valor) => trocar({ litros: Number(valor) })} />
      )}
      {modo === 'cores' && (
        <div className="gr-campo">
          <span className="gr-campo__rot">A cor certa (só as que esta bancada alcança)</span>
          <div className="pze-mx-cores" role="group" aria-label="A cor certa">
            {coresAlcancaveis.map((alvo) => {
              const chave = chaveDaCor(alvo.partes)
              const nome = `${textoDaProporcao(alvo.partes)}: ${alvo.caminho.length + 1} passos`
              return <button key={chave} type="button" className="pze-mx-cor" style={{ background: corDasPartes(alvo.partes) }} aria-pressed={chave === corDoAlvo} aria-label={nome} title={nome} onClick={() => trocar({ cor: alvo.partes })} />
            })}
          </div>
          <span className="pze-nota">Agora: {textoDaProporcao(mistura.cor)}.</span>
        </div>
      )}
      {modo === 'receita' && (
        <div className="gr-campo">
          <span className="gr-campo__rot">Ingredientes (itens do acervo que o grupo acha no mapa)</span>
          {mistura.ingredientes.length === 0 && <p className="pze-nota">Sem ingredientes, a receita é só água. Ponha de 1 a {INGREDIENTES_MAX} itens.</p>}
          <ol className="pze-mx-ingredientes">
            {mistura.ingredientes.map((ingrediente, i) => (
              <li key={`${ingrediente.itemId}-${i}`}>
                <span>{ingrediente.nome}</span>
                <Botao tamanho="p" onClick={() => trocar({ ingredientes: mistura.ingredientes.filter((_, k) => k !== i) })}>
                  Tirar
                </Botao>
              </li>
            ))}
          </ol>
          {mistura.ingredientes.length < INGREDIENTES_MAX ? (
            <Botao tamanho="p" className="pze-alinha-inicio" onClick={() => setEscolhendo(true)}>
              Pôr ingrediente
            </Botao>
          ) : (
            <p className="pze-nota">A receita já tem {INGREDIENTES_MAX} ingredientes, o máximo.</p>
          )}
          {escolhendo && (
            <EscolhaDeItem
              verbo="Pôr na receita"
              aoFechar={() => setEscolhendo(false)}
              aoEscolher={(item) => {
                setEscolhendo(false)
                if (mistura.ingredientes.length < INGREDIENTES_MAX) trocar({ ingredientes: [...mistura.ingredientes, { itemId: item.id, nome: item.nome }] })
              }}
            />
          )}
          <CampoLiga rotulo="Nesta ordem" ajuda={mistura.emOrdem ? 'Os ingredientes precisam entrar na ordem da lista.' : 'A ordem não importa.'} ligado={mistura.emOrdem} onChange={(emOrdem) => trocar({ emOrdem })} />
          <CampoLiga rotulo="Turva na hora" ajuda={mistura.turvaNaHora ? 'Um item fora da receita turva o frasco na hora: o jogador vê e esvazia na pia.' : 'O erro só aparece no receptáculo.'} ligado={mistura.turvaNaHora} onChange={(turvaNaHora) => trocar({ turvaNaHora })} />
          <CampoSeg
            rotulo="Água na receita (L)"
            opcoes={[{ valor: QUALQUER, rotulo: 'Qualquer' }, ...litrosAlcancaveis.map((l) => ({ valor: String(l), rotulo: String(l) }))]}
            valor={mistura.litros === null ? QUALQUER : String(mistura.litros)}
            onChange={(valor) => trocar({ litros: valor === QUALQUER ? null : Number(valor) })}
          />
        </div>
      )}

      {caminho === null || minimo === null ? (
        <p className="pze-nota pze-mx-aviso" role="status">
          Esta bancada não chega a alvo nenhum: {modo === 'cores' ? 'ponha tinta em pelo menos um frasco e deixe espaço vazio para misturar.' : 'ligue a torneira ou comece com água num recipiente.'}
        </p>
      ) : (
        <div className="gr-campo">
          <span className="gr-campo__rot">
            Mínimo: {minimo} {minimo === 1 ? 'passo' : 'passos'}
            {modo === 'receita' && mistura.ingredientes.length > 0 ? ` (com ${mistura.ingredientes.length === 1 ? 'o ingrediente' : `os ${mistura.ingredientes.length} ingredientes`} e o receptáculo)` : ' (com o receptáculo)'}
          </span>
          <ol className="pze-mx-solucao">
            {caminho.caminho.map((passo, k) => (
              <li key={k}>{textoDoPasso(passo, mistura)}</li>
            ))}
            {modo === 'receita' && mistura.ingredientes.length > 0 && <li>Ponha {mistura.ingredientes.map((ing) => ing.nome).join(mistura.emOrdem ? ', nesta ordem, ' : ', ')} no frasco {caminho.recipiente + 1}.</li>}
            <li>Leve {modo === 'volumes' ? 'a jarra' : 'o frasco'} {caminho.recipiente + 1} ao receptáculo.</li>
          </ol>
        </div>
      )}

      <CampoSeg rotulo="Mistura errada no receptáculo" opcoes={OPCOES_DO_ERRO} valor={mistura.aoErrar} onChange={(aoErrar) => aoErrar !== mistura.aoErrar && trocar({ aoErrar })} />
      <CampoLiga rotulo="Mostrar o alvo na plaqueta" ajuda={mistura.alvoNaPlaqueta ? 'O jogador vê o alvo gravado na bancada.' : 'O alvo fica com você: dê como pista (um documento, por exemplo).'} ligado={mistura.alvoNaPlaqueta} onChange={(alvoNaPlaqueta) => trocar({ alvoNaPlaqueta })} />
      <p className="pze-nota">Errar no receptáculo castiga como você escolher no castigo; a mistura certa destrava o que você escolher em Ao resolver.</p>
    </Secao>
  )
}
