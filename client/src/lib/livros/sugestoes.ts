import { ABA_DAS_TECNICAS, ehPerfurante } from '../batalha/leituraDaFicha'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { abaDoSistema, type SistemaDeRpg } from '../sistemaDeRpg'
import { CAMPO_DO_CARTAO, deixarAMao, lerCampo, mudarCartao, type CampoDaSaude } from './saude'

/**
 * SUGESTÕES DA SAÚDE DA FICHA (M2, docs/planos/livros-de-regras-plano.md,
 * seção M2): poucas regras, cada uma com o porquê, que trocam um texto que a
 * batalha não lê por um que ela lê. Sem regra que serve: a tela fica só com
 * o "Corrigir" e a releitura ao vivo. Puro: sem store, sem disco, sem rede.
 *
 * Toda troca de texto só é oferecida se o texto novo LÊ (releitura pelo
 * mesmo `lerCampo` da Saúde): sugestão que não resolve não aparece.
 */

/** O que é uma regra de sugestão (para a tela agrupar e o teste nomear). */
export type RegraDaSugestao = 'acaoSemA' | 'abreviacao' | 'ignoraEscudo' | 'custoComFrase' | 'dadoNaMedia' | 'dadoAMao'

export interface SugestaoDaFicha {
  regra: RegraDaSugestao
  /** O texto do botão ("Trocar por Ação Bônus", "Usar a média: 7"). */
  rotulo: string
  /** Por que a regra existe, em uma frase. */
  porque: string
  /** Campo do cartão -> texto NOVO inteiro (a Descrição já com a frase somada). Vazio = nenhum campo muda. */
  campos: Readonly<Record<string, string>>
  /** Marca o golpe À mão (`CartaoDaFicha.aMao`): o "Deixar à mão" do dado. */
  aMao?: true
}

/** Os campos do cartão de técnica One Piece que as regras escrevem além dos 4 medidores (lib/sistemaOnePiece.ts). */
const CAMPO_DO_EFEITO = 'efeito'
const CAMPO_DA_DESCRICAO = 'descricao'
const PERFURANTE = 'Perfurante'
const SEPARADOR_DO_EFEITO = '; '
const SEPARADOR_DE_PARAGRAFO = '\n\n'

/** "ção Bônus", "cao simples": o "A" de "Ação" comido na digitação. */
const ACAO_SEM_A = /^(\s*)[cç][aã]o(?=\s|$)/i
/** "(ignora escudo)", ", ignorando o escudo", "ignora escudos". */
const IGNORA_ESCUDO = /\s*[,;]?\s*\(?\s*ignora(?:ndo)?\s+(?:o\s+|os\s+)?escudos?\s*\)?/i
/** "2d6", "d20", "3D8": a média é dados x (faces + 1) / 2. */
const DADO = /\b(\d*)\s?[dD](\d+)\b/g
/** Teto de dados num termo ("999d6" não é ficha, é engano). */
const DADOS_MAX = 100
const TEM_NUMERO = /\d/
/** "-": custo nenhum, como o leitor entende (`lerCusto`). */
const SEM_CUSTO = '-'

/** Lê a releitura do campo com o texto novo e diz se ficou legível (Lido ou Lê na hora). */
function leCom(campo: CampoDaSaude, texto: string, cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg): boolean {
  const comTexto: CartaoDaFicha = { ...cartao, campos: { ...cartao.campos, [CAMPO_DO_CARTAO[campo]]: texto } }
  const leitura = lerCampo(campo, texto, comTexto, personagem, sistema)
  return leitura !== null && (leitura.estado === 'lido' || leitura.estado === 'naHora')
}

/** O cartão de técnica do sistema tem este campo? (sistema sem Efeito não ganha a regra do Perfurante). */
function abaTemCampo(sistema: SistemaDeRpg, campoId: string): boolean {
  return abaDoSistema(sistema, ABA_DAS_TECNICAS)?.campos.some((campo) => campo.id === campoId) === true
}

function sugestaoDaAcao(cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg): SugestaoDaFicha[] {
  const texto = cartao.campos[CAMPO_DO_CARTAO.acao] ?? ''
  if (!ACAO_SEM_A.test(texto)) return []
  const novo = texto.replace(ACAO_SEM_A, '$1Ação').trim()
  if (!leCom('acao', novo, cartao, personagem, sistema)) return []
  return [{ regra: 'acaoSemA', rotulo: `Trocar por "${novo}"`, porque: 'Faltava o "A" do começo: o app só entende o tipo de ação com a palavra inteira.', campos: { [CAMPO_DO_CARTAO.acao]: novo } }]
}

/** "FOR. + 20", "agi + 5": cada abreviação do sistema (com ou sem ponto, qualquer caixa) vira o nome inteiro. */
function comNomesInteiros(texto: string, sistema: SistemaDeRpg): string {
  let novo = texto
  for (const atributo of sistema.atributos) {
    const abreviacao = atributo.abreviacao.trim()
    if (abreviacao.length === 0 || !/^\p{L}+$/u.test(abreviacao)) continue
    novo = novo.replace(new RegExp(`(?<!\\p{L})${abreviacao}\\.?(?!\\p{L})`, 'giu'), atributo.nome)
  }
  return novo
}

function sugestoesDoDano(cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg): SugestaoDaFicha[] {
  const campo = CAMPO_DO_CARTAO.dano
  const texto = cartao.campos[campo] ?? ''
  const sugestoes: SugestaoDaFicha[] = []

  if (IGNORA_ESCUDO.test(texto) && abaTemCampo(sistema, CAMPO_DO_EFEITO)) {
    const novo = texto.replace(IGNORA_ESCUDO, '').trim()
    const efeito = (cartao.campos[CAMPO_DO_EFEITO] ?? '').trim()
    const campos: Record<string, string> = { [campo]: novo }
    // Já diz "perfura" em outro campo: o interruptor da batalha já nasce ligado (`ehPerfurante`), o Efeito fica como está.
    if (!ehPerfurante({ ...cartao, campos: { ...cartao.campos, [campo]: novo } })) campos[CAMPO_DO_EFEITO] = efeito.length === 0 ? PERFURANTE : `${efeito}${SEPARADOR_DO_EFEITO}${PERFURANTE}`
    if (leCom('dano', novo, cartao, personagem, sistema)) {
      sugestoes.push({
        regra: 'ignoraEscudo',
        rotulo: `Dano "${novo}" e ${PERFURANTE} no Efeito`,
        porque: '"Ignora escudo" não é conta: no Efeito, como Perfurante, a batalha manda o golpe direto ao HP.',
        campos,
      })
    }
  }

  const nomesInteiros = comNomesInteiros(texto, sistema)
  if (nomesInteiros !== texto && leCom('dano', nomesInteiros, cartao, personagem, sistema)) {
    sugestoes.push({ regra: 'abreviacao', rotulo: `Trocar por "${nomesInteiros}"`, porque: 'Com o nome inteiro do atributo a conta fecha e a ficha fica clara para quem lê.', campos: { [campo]: nomesInteiros } })
  }

  let temDado = false
  const naMedia = texto.replace(DADO, (inteiro, dados: string, faces: string) => {
    const n = dados.length === 0 ? 1 : Number.parseInt(dados, 10)
    const f = Number.parseInt(faces, 10)
    if (n < 1 || n > DADOS_MAX || f < 1) return inteiro
    temDado = true
    return String(Math.floor((n * (f + 1)) / 2))
  })
  if (temDado) {
    if (leCom('dano', naMedia, cartao, personagem, sistema)) {
      sugestoes.push({ regra: 'dadoNaMedia', rotulo: `Usar a média: "${naMedia}"`, porque: 'O app não rola dado: a média dá um número fixo perto do que o dado daria.', campos: { [campo]: naMedia } })
    }
    if (cartao.aMao !== true) {
      sugestoes.push({ regra: 'dadoAMao', rotulo: 'Deixar à mão', porque: 'Quer rolar de verdade? Na batalha você digita o número, e o golpe sai da porcentagem.', campos: {}, aMao: true })
    }
  }
  return sugestoes
}

function sugestaoDoCusto(cartao: CartaoDaFicha): SugestaoDaFicha[] {
  const texto = (cartao.campos[CAMPO_DO_CARTAO.custo] ?? '').trim()
  // Frase = texto sem número nenhum ("Seguir todas as condições"); "10% do HP + 20" é conta, não frase.
  if (texto.length === 0 || texto === SEM_CUSTO || TEM_NUMERO.test(texto)) return []
  const descricao = (cartao.campos[CAMPO_DA_DESCRICAO] ?? '').trim()
  return [
    {
      regra: 'custoComFrase',
      rotulo: 'Levar a frase para a Descrição',
      porque: 'Frase no Custo faz a batalha perguntar toda vez; na Descrição ela continua escrita, e o Custo fica para o número.',
      campos: { [CAMPO_DO_CARTAO.custo]: '', [CAMPO_DA_DESCRICAO]: descricao.length === 0 ? texto : `${descricao}${SEPARADOR_DE_PARAGRAFO}${texto}` },
    },
  ]
}

/**
 * As sugestões para um campo de um cartão, na ordem de preferência. Lista
 * vazia = nenhuma regra serve. O Tempo não tem regra: o texto livre de
 * recarga não tem conserto adivinhável.
 */
export function sugestoesPara(campo: CampoDaSaude, cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg): SugestaoDaFicha[] {
  switch (campo) {
    case 'acao':
      return sugestaoDaAcao(cartao, personagem, sistema)
    case 'dano':
      return sugestoesDoDano(cartao, personagem, sistema)
    case 'custo':
      return sugestaoDoCusto(cartao)
    case 'tempo':
      return []
  }
}

/** Aplica a sugestão ao cartão `cartaoId` do personagem: troca os campos e, se pedir, marca À mão. */
export function aplicarSugestao(personagem: Personagem, cartaoId: string, sugestao: SugestaoDaFicha): Personagem {
  const comCampos =
    Object.keys(sugestao.campos).length === 0 ? personagem : mudarCartao(personagem, cartaoId, (cartao) => ({ ...cartao, campos: { ...cartao.campos, ...sugestao.campos } }))
  return sugestao.aMao === true ? deixarAMao(comCampos, cartaoId, true) : comCampos
}
