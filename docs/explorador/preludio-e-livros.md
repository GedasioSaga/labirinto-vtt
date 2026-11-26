# Explorador: Prelúdio / Grimório e Livros de regras

- Data: 26/11/2026. Só leitura de código; nada foi rodado no app nem no navegador.
- "CERTO" = o código prova o defeito (arquivo:linha + porquê). "INCERTO" = depende de algo que não deu para confirmar só lendo.
- Gravidade: G (perde dado ou trava uso), M (resultado errado ou confuso), P (incômodo ou risco baixo).
- Não repete o que já está em docs/levantamento-mecanicas-duplicadas.md (ex.: Nº 22 "4 jeitos de dar texto", Nº 28 "verbete casa item só pelo nome", Nº 31 "5+ sistemas de pastas").
- Arquivos em rework agora (outro agente, árvore suja): PaginaItens.tsx, MundoDoLivro.tsx, MenuDeFerramentas.tsx, coisaERegra.ts, regraDaArma.ts, pendenciasDasFerramentas.ts, armasNaFonte.ts. Não fiz afirmações fortes sobre eles.

## Respostas diretas às pistas do passeio

1. **Prelúdio "sumido" = escondido de propósito, atrás de chave.**
   - client/src/lib/features.ts:48 tem `preparo: false`.
   - client/src/screens/MainMenu.tsx:212 só mostra a porta "Prelúdio" com `flags.preparo` ligado OU o atalho escondido **Ctrl+Alt+P na tela inicial** (MainMenu.tsx:138-153; lib/preparo/chave.ts:13-37, guarda `lb-preparo:neste-pc` no localStorage).
   - Veio assim desde o commit cf175b84 ("F0 foundation behind the preparo flag"). Com a chave desligada, lib/preparo/disco.ts:163 e :239 recusam ler e gravar, e o marcador "Roteiro" do Livro do mestre também some (preludio/roteiro/RoteiroNoLivro.tsx:28-36).
   - Não há nenhuma dica na tela: quem não sabe do atalho nunca acha. É de propósito (plano preludio-2026-11-08 §5).
2. **Livros de regras com erro cru no navegador = falta o app, e o erro não é traduzido.**
   - screens/LivrosScreen.tsx:78 chama `lerIndiceDasPastas` (lib/pastasDeMapas.ts:455). No navegador, `appDataDir()` chama o `invoke` do Tauri, que não existe, e o catch de pastasDeMapas.ts:449-450 monta a frase com a mensagem crua do erro (`motivo`, pastasDeMapas.ts:398-400).
   - Com zero pastas lidas, todo cartão fica apagado com a instrução "Em Carregar Mapa, abra a configuração de uma pasta..." (LivrosScreen.tsx:131). A instrução está errada nesse caso: o problema é não estar no app.
   - O app já tem a frase certa para isso: lib/foraDoApp.ts:19-40 (`temPonteDoApp`, `motivoDaFalhaDeArquivo`), mas só App.tsx usa. Ver "Coisas erradas" item 1.
   - O mundo do livro exige uma pasta de mapas (LivrosScreen.tsx:200-210; stores/mundoDoLivroStore.ts:137-140). Não existe "modo leitura" do livro sem pasta: é pedido novo, não defeito.

## Bugs certos

### B1. Nota do mestre some se a pessoa aperta Esc logo depois de digitar (M)
- Onde: components/livros/PaginaAnotacoes.tsx:19 (espera de 400 ms), :69-88 (grava o pendente ao desmontar); stores/mundoDoLivroStore.ts:148-150 (`mudar` com o mundo fechado devolve "ok" sem gravar); screens/LivrosScreen.tsx:215-216 e App.tsx:5193 (o Fechar chama `fechar()` ANTES de desmontar).
- Sintoma: escreve a nota e aperta Esc em menos de 400 ms: as últimas letras não vão para o disco, sem aviso.
- Causa: o Esc da seção (MundoDoLivro.tsx:217-223) chama `onFechar`, que zera `aberto`. Na desmontagem, `guardarPendente` chama `gravarNoMundo`, mas `mudar` vê `aberto === null` e devolve `Promise.resolve()`; ninguém grava e ninguém avisa. Com o mouse o blur do campo salva antes; com o teclado, não.
- Conserto: o Fechar grava o pendente antes de fechar (o EditorDaNota expõe um "salvar já", ou o `mudar` aceita a pasta explícita), ou `fechar()` espera a fila do mundo. E `mudar` sem mundo aberto deve lançar, não fingir que gravou.

### B2. Desfazer de "apagar modelo" não refaz a família (M)
- Onde: components/livros/PaginaNpcs.tsx:159-166 (apagar + Desfazer); stores/mundoDoLivroStore.ts:124-125 (toda gravação passa por `sincronizarVariacoes`); lib/livros/combate.ts:328-340 (variação sem modelo vira NPC único).
- Sintoma: apagar um NPC que é modelo de 3 variações e clicar Desfazer: o modelo volta, mas as 3 variações continuam soltas (NPC único). A família se perde para sempre.
- Causa: na mesma gravação do apagar, `sincronizarVariacoes` tira o `modeloId` das variações órfãs. O Desfazer só reinsere o modelo. Também não há pergunta antes de apagar um modelo com variações. O mesmo padrão está em components/dbt/mundo/PaginaNpcsDBT.tsx:103.
- Conserto: o Desfazer guarda e devolve também as variações de antes; ou apagar modelo com variações pede confirmação dizendo "as N variações viram NPC único".

### B3. "Jogar esta sessão" grava o índice fora da fila do índice (M)
- Onde: preludio/estado/preludio.ts:844-861 (`jogarSessao` lê e grava `preparo.json` direto) x :344-367 e :873 (pastas e campanha usam `naVezDoIndice`).
- Sintoma: mexer nas pastas da Enciclopédia e marcar "Jogar esta sessão" logo em seguida (dentro de ~1 s): uma das duas mudanças pode sumir do disco (a sessão em jogo volta a ser a velha, ou a pasta volta ao lugar antigo na próxima abertura).
- Causa: `gravarAsPastas` e `jogarSessao` fazem ler-mudar-gravar do mesmo arquivo em paralelo; a fila por arquivo de disco.ts:187-196 só ordena as escritas, não o par leitura+escrita.
- Conserto: pôr o corpo de `jogarSessao` dentro de `naVezDoIndice`, como `mudarCampanha`.

### B4. Erro técnico cru nas telas de disco (P)
- Onde: lib/pastasDeMapas.ts:450 e :501; lib/livros/catalogoNoDisco.ts:46 e :60; lib/livros/jogadoresVistos.ts:105; lib/preparo/disco.ts:178 e preludio/estado/preludio.ts:674 ("Não deu para ler o Prelúdio: ..."); preludio/mesa/EscolherNaMesa.tsx:188; components/livros/MundoDoLivro.tsx:230.
- Sintoma: fora do app (ou com a ponte quebrada) aparece "Cannot read properties of undefined (reading invoke)". Também sai ponto duplo quando o motivo já termina com ponto (MundoDoLivro.tsx:230 acrescenta outro).
- Causa: cada módulo tem o próprio `motivo(erro)` que repassa `erro.message`.
- Conserto: trocar esses `motivo` por `motivoDaFalhaDeArquivo(erro, temPonteDoApp())` de lib/foraDoApp.ts; na LivrosScreen, sem ponte, mostrar "Os livros de regras só abrem no app instalado" em vez da instrução de Carregar Mapa.

### B5. Mundo do livro aberto pela tela inicial não vê o que o Lobby gravou (M)
- Onde: stores/mundoDoLivroStore.ts:116-122 (lê a pasta só ao abrir) e :187-194 (`usePersonagensDoMundo` só acompanha a cópia do editor); net/nuvem/nuvemNoApp.ts:59-67 (o Lobby ajusta só a pasta aberta no EDITOR; as outras vão direto ao disco por `gravarRpgLeve`).
- Sintoma: jogador muda a ficha pelo Lobby com o mundo aberto pela porta "Livros de regras": a tela segue mostrando o valor velho até fechar e abrir de novo.
- Causa: ninguém avisa o mundo quando o disco da pasta muda.
- Por que importa mais: as gravações que trocam a ficha INTEIRA por uma cópia guardada antes (I1) gravam esse valor velho por cima do que o Lobby trouxe.
- Conserto: o gravador leve avisa (evento ou store) e o mundo chama `recarregar()` quando a pasta é a aberta.

## Bugs incertos

### I1. Ações que trocam a ficha inteira por uma cópia antiga (M)
- Onde: components/livros/GavetaDaFicha.tsx:23 e :31 (troca pela ficha `salvo`); components/livros/NovoNpcDialog.tsx:100 e :128 (troca pela `ficha` montada com a ficha do momento em que a janela abriu); Desfazer que devolve `antes` em ArrastoDoBestiario.tsx:102 e :129 e NovoNpcDialog.tsx:130.
- Sintoma possível: o que mudou na ficha enquanto a janela estava aberta ou o aviso com Desfazer estava na tela (vida da mesa, mochila, condição posta na batalha, edição pelo Lobby) volta ao valor antigo.
- Por que incerto: o código troca a ficha inteira (certo), mas a janela de tempo é curta e não verifiquei se a janela de ficha do editor faz igual (se faz, é padrão do app).
- Conserto: gravar só os campos que a janela edita (como PaginaJogadores.tsx:81-84 já faz), e Desfazer por campo.

### I2. "Dar ficha de combate" apaga mochila, moedas e condições do NPC de cenário (M)
- Onde: components/livros/NovoNpcDialog.tsx:105-110.
- Sintoma possível: NPC "só no cenário" que já tinha itens na mochila (o sistema de itens refeito põe a posse na mochila) ganha ficha de modelo, mínima ou em branco e perde a mochila, as moedas, o dono e as condições. Só id, retrato e nota ficam.
- Por que incerto: pode ser de propósito ("ficha nova"); o comentário só fala de retrato e nota.
- Conserto: levar também mochila, moedas e condições da ficha antiga, ou avisar na janela o que se perde.

### I3. Duas telas do Prelúdio editando ao mesmo tempo depois de a principal recarregar (M)
- Onde: preludio/janela/portaDaJanela.ts:24-29 e :50-55 (o "há janela aberta" só existe depois que `mesaDoPreludio` é carregado); App.tsx:3694-3698 (a porta decide por esse sinal); mesaDoPreludio.ts:80-95 (a sessão sobrevive a recarregar, ou seja, o caso foi previsto).
- Sintoma possível: com a janela do Prelúdio aberta, a principal recarrega (F5/Ctrl+R do WebView, ou queda e volta). O módulo da mesa não carrega sozinho, então `janelaDoPreludioAberta()` diz "não" e a porta "Prelúdio" abre a tela do Prelúdio também na principal. Duas telas gravam os mesmos verbetes sem juntar (só o revelado junta, preludio.ts:416-423): a última gravação vence. Os recados "mudou" da janela também se perdem.
- Por que incerto: não confirmei se o WebView da principal deixa recarregar no app instalado.
- Conserto: carregar o ouvinte da mesa (o canal, sem o resto) no início do App quando a chave está ligada, ou perguntar ao Rust se a janela existe antes de abrir a tela.

### I4. A cópia diária no Drive não roda quando o Prelúdio é aberto em janela (M)
- Onde: preludio/TelaDoPreludio.tsx:159-186 (na janela, o Início mostra só o aviso SO_NA_PRINCIPAL, sem PainelDaCopia); preludio/copia/PainelDaCopia.tsx:140-160 (a cópia diária nasce ao montar o painel) e :296 (o texto promete "roda sozinha ao abrir o Prelúdio, uma vez por dia").
- Sintoma possível: mestre que usa só a janela (aberta pelo Roteiro do Livro do mestre ou pelo pino) nunca tem cópia automática.
- Por que incerto: depende de como o mestre abre o Prelúdio no dia a dia.
- Conserto: disparar a cópia diária também pela principal quando a janela abre (o Rust faz o trabalho; basta um lado chamar), ou corrigir a frase.

### I5. "Apagar de vez" não avisa a outra janela (P)
- Onde: preludio/enciclopedia/lixeiraDoPreludio.ts:86-110 (não chama `avisarMudanca`); preludio/estado/preludio.ts:807-817 (`relerDoDisco` de um verbete que sumiu do disco não o tira da memória: quando o disco responde "novo", só retorna).
- Sintoma possível: a principal (Roteiro do Livro do mestre) segue com o verbete apagado na memória até reabrir o Prelúdio. Como ele estava na Lixeira, o efeito visível é pequeno.
- Conserto: avisar e, no `relerDoDisco`, tirar da memória o verbete que voltou "novo".

### I6. Catálogo do livro não relê as entradas do livro quando o sistema muda com o mesmo id (P)
- Onde: components/livros/MundoDoLivro.tsx:123-125 e PaginaItens.tsx:298 (só reabrem se o id do sistema mudou); stores/catalogoStore.ts:100-101 (`doLivro` calculado só no `abrir`).
- Sintoma possível: importar de novo o sistema (livro com perícias novas) e voltar ao mesmo livro: a página Habilidades mostra as perícias antigas até trocar de sistema ou reiniciar.
- Conserto: reabrir quando o objeto do sistema mudar (ou quando `sistema.livro` mudar).

### I7. Entrada do catálogo que falhou pode voltar na gravação seguinte (P)
- Onde: stores/catalogoStore.ts:68-79.
- Sintoma possível: dois Salvar seguidos; o primeiro falha no disco e a tela relê, mas o segundo já tinha montado a lista com a entrada do primeiro e grava as duas.
- Conserto: montar a lista de cada gravação dentro da fila, a partir do que o disco tem.

## Coisas erradas (duplicadas, redundantes, mortas)

1. **Seis "motivo(erro)" diferentes e um tradutor que quase ninguém usa** (P): lib/pastasDeMapas.ts:398, lib/preparo/disco.ts:94, preludio/estado/preludio.ts:189, lib/livros/catalogoNoDisco.ts:28, components/livros/comum.tsx:78, lib/livros/jogadoresVistos.ts:105 (inline). O certo já existe em lib/foraDoApp.ts:37 e só App.tsx o usa. Juntar num só resolve B4 de uma vez.
2. **Duas formas de saber "estou no app"**: catalogoStore.ts:84 e rpgStore.ts:91 usam `isTauri()`; foraDoApp.ts:12-24 explica que o certo é `temPonteDoApp()` (as jornadas e2e só instalam a ponte). LivrosScreen e o Prelúdio não usam nenhuma das duas (P).
3. **"Dar alcance aos antigos" e "Dar requisitos aos antigos" são quase o mesmo arquivo**: components/livros/DarAlcanceAosAntigos.tsx:50, :102, :255-257, :410-412 x DarRequisitosAosAntigos.tsx:89, :96, :259-276, :395-397 (agrupar, cortar em passos, "Mostrar mais", trecho da linha). São ferramentas de migração de uma vez só: depois que as pendências zerarem, candidatas a sair (P).
4. **Quatro jeitos de gravar arquivo com fila e "ler nunca lança"**, cada um com sua regra de segurança: pastasDeMapas.ts (cópia `.anterior` e fila por pasta), lib/preparo/disco.ts (cópia `.anterior`, fila por arquivo, formato), lib/livros/catalogoNoDisco.ts (sem `.anterior`; arquivo danificado = só leitura sem volta, :39-48), lib/livros/jogadoresVistos.ts (ilegível = vazio). O catálogo do livro é trabalho do mestre e é o único sem cópia de volta (P/M).
5. **`movimentoReduzido` duplicado**: components/livros/comum.tsx:63 (com guarda de `matchMedia`) e ArrastoDoBestiario.tsx:83 (sem a guarda) (P).
6. **`PASTA_DOS_LIVROS` declarada duas vezes**: catalogoNoDisco.ts:18 e jogadoresVistos.ts:35 (P).
7. **Dois "catálogos" com o mesmo nome e coisas diferentes**: lib/livros/catalogo.ts (entradas do livro) x preludio/mesa/catalogo.ts (mapas, cenas e fichas para os links do Prelúdio). Confunde busca e leitura (P).
8. **Ferramentas do livro contam com a cópia do disco, as páginas com a cópia viva**: biblioteca/MenuDeFerramentas.tsx:47 e :65-73 usam `daPasta`; o resto do mundo usa `usePersonagensDoMundo` (mundoDoLivroStore.ts:187). Com o mundo aberto por cima do editor e ficha não salva, o número do menu e a lista da ferramenta podem diferir (P; arquivo em rework).
9. **A chave do Prelúdio não tem dica nenhuma**: escondida de propósito, mas nem as Opções nem a tela "Roleplay (em construção)" mencionam. Se o dono quiser testers achando, falta um texto (P, decisão do dono).

## Performance

1. **Abrir o Prelúdio lê cada verbete com ~5 idas ao Rust** (M):
   - Onde: preludio/estado/preludio.ts:639-640 (`Promise.all` sem limite sobre todos os ids); lib/preparo/disco.ts:85-90 e :98-101 (por arquivo: `appDataDir`, dois `join`, `exists`, `readTextFile`; no Tauri 2 o `join` também passa pelo Rust).
   - Quando pesa: Grimório importado com centenas ou milhares de verbetes; repete a cada abertura da tela, depois de importar/restaurar e quando o Roteiro do Livro do mestre abre.
   - Ganho: guardar o caminho de `preparo/` uma vez e montar o caminho com texto; ideal, um comando Rust que devolve todos os verbetes numa ida. De ~5N para 1-2 idas.
   - Risco: baixo (a validação do id de disco.ts:41-53 continua valendo).
2. **A porta "Livros de regras" lê o `rpg.json` inteiro de TODAS as pastas só para contar fichas** (P/M):
   - Onde: screens/LivrosScreen.tsx:77-102, chamado ao abrir e de novo a cada "Outros livros" (:218); depois o mundo relê o índice (comum.tsx:165-181) e a pasta (mundoDoLivroStore.ts:119).
   - Ganho: guardar as contagens no índice das pastas, ou só reler a pasta que mudou.
   - Risco: baixo.
3. **"Nome sem link" recalcula o pacote do jogador de todas as campanhas a cada mudança do texto** (P):
   - Onde: preludio/enciclopedia/PaginaDoVerbete.tsx:335-344 (duas vezes por desenho, dependendo do Map inteiro `verbetes`); lib/preparo/pacoteDoJogador.ts:390-397 e :450-472 (refaz `revelacoesPorAlvo` com JSON.stringify por revelação, filtra e ordena todos os verbetes, por campanha e por conta).
   - Quando pesa: muitas campanhas, muitas contas com revelação própria e muitos verbetes; o editor manda o texto a cada 250 ms.
   - Ganho: memorizar `revelacoesPorAlvo` por objeto `revelado` (WeakMap) e calcular as duas listas num passe só.
   - Risco: baixo; medir antes (não medi).
4. **Saúde da ficha calculada duas vezes** (P): MundoDoLivro.tsx:103-106 (número do marcador) e PaginaSaude.tsx:343 (a página). Com o mundo por cima do editor, `personagens` muda a cada mudança da pasta viva, e as duas contas refazem tudo. Ganho pequeno: calcular num lugar (store ou memo compartilhado).
5. Listas grandes: a biblioteca de Itens/Habilidades já usa `content-visibility` e corta por grupo (biblioteca/biblioteca.css:66; ListaDaBiblioteca.tsx:238); as ferramentas "dos antigos" desenham em passos; o Balanceador roda as lutas num worker (BalanceadorDaLuta.tsx:7 e :178). Nada urgente aqui.

## O que NÃO cobri

- PaginaItens e a biblioteca de 3 colunas a fundo (em rework agora), Arena de testes (One Piece e Dragon Ball), painel da IA, PaginaComparar e o Balanceador além do que roda no worker.
- Importação do Grimório (lib/preparo/importar/: simular, aplicar, reimportar, conflitos) só pelo cabeçalho: parece cuidadosa (recusa com o Prelúdio mudado, menos de 8 GB livres etc.), mas não li linha a linha.
- Quadros (tldraw), Linha do tempo, Busca geral, Campanhas e Sistemas, Revelar e "Ver como jogador" só por cima.
- Lado Rust do Drive (google.rs, drive.rs, restauração em copia.rs:500-619) e disco_da_janela.rs: li só a cópia (copia.rs:170-418), que trata bem arquivo que muda no meio e arquivos de serviço.
- Envio do pacote do jogador ao Lobby: ainda não existe (pacoteDoJogador.ts:9-11 diz "o envio ao Lobby (F5) vai mandar"); hoje só o "Ver como jogador" usa.
- Nada foi reproduzido no app. Antes de consertar, reproduzir B1, B2 e B3 na mesa.
