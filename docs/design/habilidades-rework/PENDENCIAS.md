# Pendências do workflow do rework (27/11)

Ordem do journal (rótulo aproximado; confira pelo conteúdo e pelo git log). Algumas podem já ter sido resolvidas por etapa posterior (a E8 resolveu parte): confira no código antes de mexer.

## Agente 1

- E5, client/src/lib/batalha/transformacao.ts:149: ainda chama vezesDaForma(cartao.id). Precisa passar o cartão, vezesDaForma(cartao). Sem isso, a forma montada que dura N vezes não desliga sozinha. É a única chamada da lista do critério de pronto que ainda passa só o id.
- E5 e quem cuida de requisitos/frases.ts: pôr DescidaAoDesligar na união DescidaDoAcumulador junto com o caso em requisitos/ler.ts (descidaLida), requisitos/frases.ts (fraseDaDescida) e acumuladorNaBatalha.ts, no mesmo commit.
- E5, passivas.ts:397: ehPassiva precisa aceitar uso: 'passiva' (D6); o lerTipo já devolve 'passiva'. O Fadiga precisa entrar como condição comum no catálogo (lib/condicoes/catalogo.ts).
- E6, modelos.ts:517: a cadeia de guardarMecanica para no precisaDaVersao4. Uma mecânica v5 seria gravada como versão 4 com pecas e o leitor a recusaria. Pôr precisaDaVersao5 primeiro (versão 5) e gravar as peças com pecasParaGuardar. O LinhaDaAcao.tsx deve usar categoriaDaHabilidade.
- Arquivos fora de qualquer etapa: lib/livros/gruposDaBiblioteca.ts e linhaDaBiblioteca.ts usam categoriaDaMecanica, então passiva e 'manter' caem em simples ou apoio por lá.
- E4/E5, motor: nada dos campos novos roda ainda; a E1 só traduz. Faltam ler: imbuir, gatilhos, forma (com acoesAMais via AcoesExtras.daForma e a Fadiga no lugar do cansaço do Overload), diminui (copiar SeloDoGolpe.queda para SeloDaBatalha.queda), marca e marcaDe/marcaVezes/marcaFica, invocacao, devolve, npcRespondeAPrimeira, somaNosFisicos/alvoNaoDesvia, MudancaDaResposta.bate/perfuracao e SeloDaBatalha.ligada.
- Decisão para E4/E6: Muda atributo em técnica de ataque com dois tempos diferentes no dono deixa a mecânica inválida ('mais de um selo em quem usa'), porque o motor só tem um seloEmQuemUsa. O motor passa a aceitar vários, ou o editor limita a uma duração.
- E3/E4: a pergunta da própria técnica montada só vem pelo cartão, mas perguntasDoGolpe e motivoDasRespostasDoGolpe ainda recebem o id em dadosDoMenu.ts:990, golpe.ts:1410 e duelo.ts:477. O mesmo vale para somaCorpoACorpo(..., tecnica?.cartao.id) e perguntasComAsFormas(..., cartoesAtivos). Os tipos já aceitam o cartão.
- E3 (D13): o RESPOSTAS_MAX é 8 hoje. Três perguntas, mais o Imbuir e o Marcar, podem passar disso num pedido.
- Não verificado: 'cartão de versão 1 a 4 dá a mesma linha' foi conferido só lendo o código, não pela suíte. Os ramos novos só abrem com pecas ou com uso 'passiva'/'manter', e pecasParaOMotor devolve o mesmo objeto, na versão 4, para as versões 1 a 4. A E8 confere pela suíte. Não abri o app nem a tela: o registro só tem tipos.
- O hook pediu atualizar docs/diagrams/requisitos.html e o INDEX, e não atualizei: estão fora dos arquivos da E1, e a mudança lá é só um tipo novo fora da união. HANDOFF.md também ficou sem mexer (fora da E1).

## Agente 2

- E6 precisa: renderizar MolduraDaPeca + entradaDaPeca(f).Componente na lista de peças; passar 'nova' só na peça recém-posta; passar arredores {cartao: {id,nome}, personagem, atributos do sistema, aoMudarOutroCartao que troca o cartão pelo id, inclusive subcartões}; usar avisoDaPeca(peca, mecanica) no aviso; ligar REGISTRO_DAS_PECAS.acumulador ao cartao.acumulador.
- E5: pôr DescidaAoDesligar {quando:'desliga'} na união DescidaDoAcumulador e no leitor. A peça já reconhece os dois formatos; depois da E5 dá para trocar DESCIDA_DESLIGA (PecaAcumulador.tsx) pela regra tipada.
- A linha Evolução (fora de E4) não recebe as ligações; se a E6 quiser filtrar as ligações só para cartão de forma, é uma prop nova na LinhaDosRequisitos.
- HANDOFF.md e docs/diagrams/INDEX.md não foram atualizados (fora dos arquivos de E4). O orquestrador deve atualizá-los, e o aviso de compactação pediu /handoff.
- Não verificado: tela no navegador ou no app (as peças ainda não estão montadas no editor; isso é da E6), gesto e teclado reais, medição ux-driver (sem tela para medir antes da E6), e o visual das cores e do encaixe contra o protótipo.
- Escape hatch herdado: nenhum nas funções de que a entrega depende (motivoDasPecasComOUso, frasesDoAcumulador, mesmaMarca, mesmaReferencia, acumuladoresNaFicha, idParaOAcumulador, ganhoNoNivel, blocoCru/comUsar/todosCru, lerRequisitos); não encontrei any, as nem ! no que li delas.

## Agente 3

- E6: - guardarMecanica (modelos.ts) para na v4, e problemaDaMecanica falha na v5. Por isso a E2 usa o próprio guardarConvertida. - O editor deve abrir o cartão por fichaConvertida(personagem, sistema), que também traz o contador, ou por converterCartao(cartao, aba, ctx, { mesmoComDiferenca: true }). - O botão 'Conferida' usa semConfira.
- E7: - Etiqueta 'Convertida: confira': na ficha é temConfira(cartao); no catálogo é confiraDoTexto(item.texto).length > 0. - O relatório por ficha está em fichaConvertida(...).relatorio. - Quando o mestre salva, grava o personagem convertido; antes disso nada é gravado.
- Ficha gravada sem mapa aberto (se esse caminho existir) não passa pela cópia da abertura: quem gravar deve chamar guardarCopiaDasFichasDoMapa antes. O site (Lobby) e o Worker não fazem cópia nem conversão.
- E5 pode ampliar a conversão da passiva (sempre, requisito, por turno) e da invocação. A passiva e a forma convertidas saem v5; o app de antes segue lendo os campos de texto.
- E8, testes não escritos aqui, por ordem: - idempotência por referência; - cartão da tabela intocado com subcartões; - nada perdido; - cópia uma vez com disco falso (guardarCopiaDasFichasDoMapa aceita DiscoDaMigracao).
- Não verificado: - gravarCatalogo com a cópia: precisa do fs do Tauri; só revisado e passado no tsc. - A abertura real no app: guardarCopiaDasHabilidadesAoAbrir só roda no Tauri; o miolo foi testado com disco falso. - Diagrama, INDEX e HANDOFF não atualizados: estão fora dos arquivos da E2.
- Escape hatch herdado: nenhum nas funções de que a entrega depende. Varri textoGerado, modelos, modelo, pecas, doTexto, leituraDaTecnica, leituraDaFicha, tiposDaHabilidade, marca, selos, passivas, transformacao, acumuladoresDaFicha, requisitos/ler, contador, mecanicasAMao, migracaoDaMochila, personagem e adventure. O único 'as' achado é personagem.ts:883 (Object.keys(...) as CampoDaFichaDBT[]), uma constante dos campos DBT fora do caminho da conversão.

## Agente 4

- dadosDoMenu.ts:990 e :1394 (nenhuma etapa é dona) passam o id e não passam `ligadas`. Com isso, o menu não mostra as perguntas da técnica montada ('Pergunta', 'Marcar?') nem o 'Imbuir?'. Conserto: passar o cartão e ligadasDoDono(turnos.selos, personagem.id, personagem.cartoesAtivos).
- duelo.ts:477 (Worker) passa o id para motivoDasRespostasDoGolpe. O duelo recusa as respostas da técnica montada com 'Resposta que a técnica não pergunta'. É preciso passar o cartão e `ligadas`.
- A tela de reação deve esconder o Esquivar quando saidasTiradasPeloAtacante(chavesDoDono(atacante)) tiver 'esquiva'. O host já recusa.
- O texto do registro diz '(marca ×2)' fixo (golpe.ts:1729), porque AlvoDoGolpe.marcado é `true` em combate.ts (E1). A marca x3 dá o dano certo, mas o texto mostra ×2. Precisa de um campo do tipo marcadoVezes no AlvoDoGolpe (E1/E8).
- E5 precisa criar o selo `ligada` da D7 (ligada, donoId, cartaoId). Sem ele, o Imbuir nunca pergunta. Testei só com um selo feito à mão.
- Sugestão para E1/E8: expor o tipo de partida na MecanicaAMao, para o motor não ler `golpe`. O comentário em modelo.ts:322 diz que o motor nunca lê esse campo.
- Não executado: o 'Marcar?' do robô no treino (sem SP, o host recusa a técnica); a reação com técnica contra alvoNaoDesvia; a troca de nome para '???' dos selos novos na técnica oculta; o envio dos selos com queda ao jogador ('só do host').
- Escape hatch: o código commitado não tem `as`, `!`, `any` nem `@ts-ignore`. Nas funções de que dependo e que li (leitura.ts, marca.ts, selos.ts, partes de golpe.ts) não achei cast. Não varri lerMecanica nem lerDano por inteiro.
- HANDOFF.md não foi atualizado (fora da E3). Depois da compactação, peça /handoff.

## Agente 5

- O tsc do projeto termina com exit 2 por 1 erro que não é da E6: src/stores/batalha/formas.ts(40,10) TS6133 'ehOverload' is declared but its value is never read. O arquivo está modificado e sem commit, de outra etapa em andamento, por isso não toquei. Na rodada anterior havia 10 erros em src/lib/batalha/passivas.ts (TS6133, TS6192 e TS2304 'ehPassivaMontada'), também de outra etapa, que sumiram sozinhos. Nenhum erro nos arquivos da E6.
- FichaAbas.tsx não é da E6 e está modificado por outra sessão. A linha 980 ainda mostra ao usuário 'O Desmontar devolve o texto de antes.' e a 851 tem um comentário sobre 'Montar no editor'; a etapa dona precisa trocar o texto.
- As props novas da HabilidadeNaFicha ainda não estão ligadas em quem a chama: FichaAbas e a entrada de Livros > Habilidades. Sem guardarNoCatalogo a caixa 'Guardar também no catálogo do livro' não aparece. Sem aoMudarOutroCartao as ligações D8 das peças só explicam. Sem abaDoCartao a conversão assume Habilidades.
- O ramo do teto de 12.000 letras não foi executado com uma mecânica válida: todos os outros tetos (efeitos 8, multiplicadores 4, nome do multiplicador de 1 a 24 letras) bloqueiam antes. Medi 193 a 807 letras nos modelos novos e confirmei que 14.269 letras não gravam. O teto ficou como defesa.
- A interface não foi testada no app nem no navegador (nenhuma jornada nem print). Ficaram sem verificação o layout do topo, do catálogo de peças e dos 7 cartões da Ação, e o Ctrl+S dentro do dialog.
- E8 (testes): rodar e atualizar os testes que dependam do editor antigo. Não rodei a suíte, conforme a regra. Pelo rg, nenhum teste usa os rótulos removidos.
- HANDOFF.md e docs/diagrams estão fora da E6 e não foram atualizados. A instrução da compactação pede /handoff depois dela; isso fica para o orquestrador.

## Agente 6

- tsc: na primeira rodada apareceram erros só em arquivos de outra etapa em andamento: ColunaDoPapel.tsx(123,114) TS2322 'semSorte', e depois stores/batalha/formas.ts(40,10) TS6133 'ehOverload'. Não mexi neles e os dois sumiram sozinhos; a rodada final depois do commit deu exit 0 sem saída.
- client/src/lib/livros/gruposDaBiblioteca.ts, linhas 168 e 200, ainda usa abaDeDestino. A forma vinda do catálogo pode aparecer agrupada na aba Habilidades da Biblioteca. Isso não está em nenhuma etapa.
- Nos sistemas sem a aba Transformações, a lista antiga continua, com 'Editar como texto' (FichaAbas.tsx:1004, condição textoEmBaixo).
- O site e o jogador não têm 'Guardar também no catálogo'. Só o mestre no app tem.
- O catálogo não guarda acumulador, imagem, modificadores nem subcartões (MAPA §1.2). A peça Transformação vai, porque mora na mecanica.
- Gravar no disco a ficha inteira convertida é papel do host (store da aventura), não destes arquivos.
- O selo 'também no catálogo' nas linhas da ficha ficou de fora.
- UI não testada no browser nem no app instalado, e o ux-driver medir não rodou: não há números de longtask, frame p95 nem INP. A renderização foi conferida só por SSR (renderToStaticMarkup).
- HANDOFF.md, docs/diagrams e INDEX.md não foram atualizados, porque estão fora do escopo da E7.

## Agente 7

- lib/batalha/golpe.ts:570 (arquivo da E3): 'podeAgir' confere o Overload só pelo texto, com 'if (ehOverload(cartao) && combate.overload)'. Isso supõe que a forma montada com Overload tem o campo de texto Overload. Quando não tem, um pedido pelo fio, ou depois que o Overload da batalha foi gasto, pode religar a forma Overload montada. O menu bloqueia, porque usa 'formaEhOverload', e 'usosPorBatalha' da peça também bloqueia se estiver posto. A correção é trocar por 'formaEhOverload(cartao)'.
- Para pôr 'DescidaAoDesligar' na união 'DescidaDoAcumulador' é preciso mexer em requisitos/modelo.ts (E1) e em requisitos/frases.ts (sem etapa).
- A técnica 'manter' com custo 0 não ganha o lembrete 'Aplicar / pular' ('mantidasComCusto'). Então o selo 'ligada' e a mantida só saem pelo Desfazer ou pela mão do mestre.
- O lembrete do gatilho que pergunta e a chave da 'uma por batalha' entram sem linha. O Desfazer da linha que provocou o gatilho não os tira, mas 'Agora não' tira o lembrete.
- Se uma ação for recusada depois do 'rastrear' (por 'devolverFichasDaAcao'), os eventos que ele guardou podem disparar no próximo 'avisarQuemCaiu'. A fila é esvaziada a cada chamada.
- A forma montada com 'o mestre decide' ('decidirForma') não recebe ações a mais nem a leitura nova das peças. Só 'mudarForma' foi tratado.
- HANDOFF.md, docs/diagrams e INDEX.md não foram atualizados: estão fora dos arquivos da E5.
- Escape hatch herdado: nenhum encontrado nas funções que li e de que dependo ('criarSelo', 'comSeloNovo', 'mexerNaFicha', 'pecasDoCartao', 'mecanicaDoCartao', 'tecnicaPorId'). Não varri o resto do projeto.
- Nada foi testado na tela pelo navegador: a tira e o painel das formas foram verificados só pelo tsc e pelo smoke da lib e da store.

## Agente 8

- O tsc do e2e (tsconfig.e2e.json) dá 1 erro num arquivo que não é desta etapa: e2e/task-camadas-desempenho.spec.ts(207,23) TS2589 'Type instantiation is excessively deep'. Não mexi. O spec novo não tem erro.
- Não vi a jornada vermelha antes da correção dos modificadores. O vermelho foi visto só no teste 2 da store ('expected 30 to be 50'). A jornada confere a prévia 'AGI 30 → vai para 50' e o HP, mas não rodei a versão sem a correção para vê-la reprovar.
- Texto gerado, de E1/E6. A forma Overload criada por '+ Transformação' diz 'Overload: acerta 1 inimigo. Não dá dano. Não erra: o alvo não reage.' e 'Gasta a vez inteira', mas a forma é em si e liga como Livre. Isso aparece no papel, na lista da ficha e no menu: o texto engana, mas a batalha age certo. O painel Testar da forma diz 'Não saiu: a técnica não aparece no menu da vez'.
- Ainda falta parte da D5: o Salvar não gera os campos de texto da aba Transformações (Duração, Usos, Ataques extras, Grupo...). Como a E5 lê a Duração de texto antes da peça, uma forma convertida que tem Duração escrita e a peça mudada no editor fica com a duração do texto.
- O catálogo não guarda modificadores (MAPA §1.2). Uma forma posta a partir de Livros ('Pôr em') chega com a peça, mas sem os modificadores; o +20 só passa a valer quando o editor salvar o cartão de novo. O conserto seria gravar modificadoresDaPecaDaForma no porNaFicha/cartaoDoCatalogo (lib/livros/catalogo.ts).
- Nos sistemas sem a aba Transformações, a ficha ainda mostra 'Editar como texto' (FichaAbas.tsx:1004), fora do que a D14 pede. É decisão da E7 e é pendência grande.
- Continuam abertas das etapas anteriores, sem mexer: DescidaAoDesligar fora da união DescidaDoAcumulador (funciona por RegraNaoLida); gruposDaBiblioteca.ts e linhaDaBiblioteca.ts com categoriaDaMecanica e abaDeDestino; decidirForma sem ações a mais; o texto '(marca ×2)' fixo no registro; a tela de reação ainda mostra o Esquivar contra alvoNaoDesvia (o host já recusa).
- Fica fora deste workflow: verificador-realidade item por item contra os PEDIDOS das 22:40 às 23:23, a publicação da 0.6.5 e o aviso ao dono. HANDOFF.md, docs/diagrams e INDEX não foram atualizados.
- Medição de fluidez (ux-driver medir) não rodou. Não há números de longtask, frame p95 nem INP do editor novo.

