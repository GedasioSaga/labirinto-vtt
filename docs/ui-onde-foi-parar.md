# Onde foi parar cada controle

Gerado por `scripts/onde-foi-parar-doc.mjs` a partir de `client/e2e/helpers/ondeFoiParar.ts`; não edite à mão.
O spec `client/e2e/ui-onde-foi-parar.spec.ts` alcança cada linha no app pelo caminho anotado (fatia 0 do
`docs/design/consolidado/PLANO.md`). A fatia que muda um controle de lugar troca o caminho na lista e roda o gerador.

"Hoje" é o layout de 15/10/2026; "Vai para" vem do protótipo consolidado (ONDE do `app.js` + PLANO §1).

## Mestre (editor, 1440x900)

### Cabeçalho da esquerda

Parte de: editor aberto, Selecionar, nada selecionado. Vai para: Topo do livro do mestre (feito). Fatia: 2.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Logo e nome do app | heading "Labirinto" | (livro do mestre) | (do bloco) |
| + Token | button "Adicionar token" | (livro do mestre) | (do bloco) |
| Campo do novo token | textbox "Nome do novo token" | (livro do mestre) > clicar button "Adicionar token" | (do bloco) |
| Adicionar (novo token) | button "Adicionar" | (livro do mestre) > clicar button "Adicionar token" | (do bloco) |
| Cancelar (novo token) | button "Cancelar" | (livro do mestre) > clicar button "Adicionar token" | (do bloco) |
| Engrenagem (Configurações do mapa) | button "Configurações do mapa" | (livro do mestre) | (do bloco) |
| Faixa "Nada selecionado" | button "Nada selecionado" | (livro do mestre) > clicar tab "Ficha" | Página Ficha, vazio com atalhos (feito, fatia 7) |
| Neste mapa: um exemplo de cada tipo da cena | button "/^Goblin/" | (livro do mestre) > clicar tab "Ficha" | Página Ficha, vazio: "Neste mapa" (novo, fatia 7) |

### Ações do mapa

Parte de: editor aberto. Vai para: Topo do livro do mestre (ícones) e menu Arquivo (feito). Fatia: 2.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Desfazer | button "Desfazer" | (topo do livro do mestre) | (do bloco) |
| Refazer | button "Refazer" | (topo do livro do mestre) | (do bloco) |
| Salvar | button "Salvar" | (topo do livro do mestre) | (do bloco) |
| Abrir... | menuitem "Abrir…" | (topo do livro do mestre) > clicar button "Arquivo" | (do bloco) |
| Imagem de fundo (sem imagem: importar) | menuitem "Importar imagem de fundo…" | (topo do livro do mestre) > clicar button "Arquivo" | (do bloco) |
| Exportar mapa (pasta) | menuitem "Exportar mapa (pasta)…" | (topo do livro do mestre) > clicar button "Arquivo" | (do bloco) |
| Exportar imagem (PNG) | menuitem "Exportar imagem (PNG)…" | (topo do livro do mestre) > clicar button "Arquivo" | (do bloco) |
| Importar mapa (pasta) | menuitem "Importar mapa (pasta)…" | (topo do livro do mestre) > clicar button "Arquivo" | (do bloco) |
| Início | menuitem "Voltar ao início" | (topo do livro do mestre) > clicar button "Arquivo" | (do bloco) |
| Atalhos do teclado (?) | button "Atalhos do teclado" | (topo do livro do mestre) | (do bloco) |

### Chip da cena

Parte de: editor com aventura (Cripta, cena inicial). Vai para: Chip da cena no alto do mapa (feito). Fatia: 3.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Nome da cena aberta (abre o menu de cenas) | button "/^Cripta/" | (chip da cena, no alto do mapa) | (do bloco) |
| Menu de cenas por pasta: a cena | menuitem "Cripta" | (chip da cena, no alto do mapa) > clicar button "/^Cripta/" | (do bloco) |
| Ver todas as cenas (antigo ícone de expandir) | menuitem "Ver todas as cenas" | (chip da cena, no alto do mapa) > clicar button "/^Cripta/" | (do bloco) |

### Grupo Aventura

Parte de: editor com aventura, nada selecionado. Vai para: Página Aventura do livro do mestre: fichas Pinos, Agenda e Estado do mundo, recolhidas com o resumo (feito). Fatia: 2 (casca) e 18a (fichas).

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Pinos: busca | searchbox "Buscar pino" | (livro do mestre) > clicar tab "Aventura" > clicar button "Pinos" | (do bloco) |
| Pinos: pino da lista (abre a cena) | button "Altar Cripta" | (livro do mestre) > clicar tab "Aventura" > clicar button "Pinos" | (do bloco) |
| Agenda: Próximo apito | button "Próximo apito" | (livro do mestre) > clicar tab "Aventura" > clicar button "Agenda" | (do bloco) |
| Agenda: Próximo dia | button "Próximo dia" | (livro do mestre) > clicar tab "Aventura" > clicar button "Agenda" | (do bloco) |
| Agenda: nome do evento | textbox "Evento" | (livro do mestre) > clicar tab "Aventura" > clicar button "Agenda" | (do bloco) |
| Agenda: dia | spinbutton "Dia" | (livro do mestre) > clicar tab "Aventura" > clicar button "Agenda" | (do bloco) |
| Agenda: apito | combobox "Apito" | (livro do mestre) > clicar tab "Aventura" > clicar button "Agenda" | (do bloco) |
| Agenda: Soar alarme ao disparar | checkbox "Soar alarme ao disparar" | (livro do mestre) > clicar tab "Aventura" > clicar button "Agenda" | (do bloco) |
| Agenda: Marcar | button "Marcar" | (livro do mestre) > clicar tab "Aventura" > clicar button "Agenda" | (do bloco) |
| Estado do mundo: Novo estado | button "Novo estado" | (livro do mestre) > clicar tab "Aventura" > clicar button "Estado do mundo" | (do bloco) |

### Grupo Esta cena

Parte de: editor com aventura, Selecionar, nada selecionado. Vai para: Página Cena do livro do mestre: a busca no topo, e as fichas Objetos do mapa, Locais, Marcas, Território, Chão do mapa, Camadas do chão e Camadas, com o resumo (feito). Fatia: 2 (casca), 18a (fichas) e 18b (busca no topo).

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Objetos do mapa: busca | searchbox "Buscar objeto" | (livro do mestre) > clicar tab "Cena" | Busca do topo do marcador Cena, à vista com a ficha Objetos do mapa fechada; digitar abre a lista, com os achados das outras cenas (feito) |
| Objetos do mapa: Ctrl+K põe o cursor na busca | searchbox "Buscar objeto" | (livro do mestre) > tecla Control+k | Ctrl+K foca a busca do topo da página Cena e abre Objetos do mapa |
| Objetos do mapa: item da lista (Ir até lá) | button "Goblin" | (livro do mestre) > clicar tab "Cena" > clicar button "Objetos do mapa" | (do bloco) |
| Locais: sala da árvore (enquadra) | button "Salão" | (livro do mestre) > clicar tab "Cena" > clicar button "Locais" | (do bloco) |
| Território: Quem manda aqui | checkbox "Quem manda aqui" | (livro do mestre) > clicar tab "Cena" > clicar button "Território" | (do bloco) |
| Território: Alerta da cena | radiogroup "Alerta da cena" | (livro do mestre) > clicar tab "Cena" > clicar button "Território" | (do bloco) |
| Chão do mapa: Cor do chão | textbox "Cor do chão" | (livro do mestre) > clicar tab "Cena" > clicar button "Chão do mapa" | (do bloco) |
| Chão do mapa: conta-gotas da cor | button "Pegar do mapa a cor do chão" | (livro do mestre) > clicar tab "Cena" > clicar button "Chão do mapa" | (do bloco) |
| Chão do mapa: Contorno | checkbox "Contorno" | (livro do mestre) > clicar tab "Cena" > clicar button "Chão do mapa" | (do bloco) |
| Camadas: Mostrar grade | checkbox "Mostrar grade" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: Grudar Token no centro | checkbox "Grudar Token no centro" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: Grudar Parede na grade | checkbox "Grudar Parede na grade" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: Grudar Objeto na grade | checkbox "Grudar Objeto na grade" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Paredes | button "Ocultar Paredes" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Paredes | button "Travar Paredes" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Portas | button "Ocultar Portas" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Portas | button "Travar Portas" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Salas | button "Ocultar Salas" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Salas | button "Travar Salas" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Escadas | button "Ocultar Escadas" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Escadas | button "Travar Escadas" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Objetos | button "Ocultar Objetos" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Objetos | button "Travar Objetos" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Decoração | button "Ocultar Decoração" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Decoração | button "Travar Decoração" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Iluminação | button "Ocultar Iluminação" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Iluminação | button "Travar Iluminação" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Tokens | button "Ocultar Tokens" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Tokens | button "Travar Tokens" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Anotações | button "Ocultar Anotações" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Anotações | button "Travar Anotações" | (livro do mestre) > clicar tab "Cena" > clicar button "Camadas" | (do bloco) |

### Camadas do chão

Parte de: peça de chão selecionada. Vai para: Marcador Cena, ficha Camadas do chão (nota "ir: cena" com a ferramenta Chão). Fatia: 7 e 18.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Camadas do chão: lista das peças | heading "Camadas do chão" | (livro do mestre) | (do bloco) |

### Acervos

Parte de: editor aberto. Vai para: Marcador Acervo: o seg "O que mostrar" troca entre Tokens e Itens; o "+" da linha ou do cartão põe no centro da vista (feito). Fatia: 2 (casca) e 18b (seg).

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Acervo de tokens | heading "Acervo de tokens" | (livro do mestre) > clicar tab "Acervo" > clicar radio "Tokens" | (do bloco) |
| Acervo de tokens: + Pasta | button "Nova pasta" | (livro do mestre) > clicar tab "Acervo" > clicar radio "Tokens" | (do bloco) |
| Acervo de itens | region "Itens" | (livro do mestre) > clicar tab "Acervo" > clicar radio "Itens" | (do bloco) |
| Acervo de itens: Categorias | button "Categorias" | (livro do mestre) > clicar tab "Acervo" > clicar radio "Itens" | (do bloco) |
| Acervo de itens: Novo item | button "Novo item" | (livro do mestre) > clicar tab "Acervo" > clicar radio "Itens" | (do bloco) |

### Botões da barra

Parte de: editor aberto. Vai para: Barra no pé do mapa: Escolher / Construir / Terreno / Esconder e revelar / Anotar (feito na fatia 6). Fatia: 6.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Selecionar | button "Selecionar" | (barra de ferramentas) | (do bloco) |
| Parede | button "Parede" | (barra de ferramentas) | (do bloco) |
| Porta | button "Porta" | (barra de ferramentas) | (do bloco) |
| Luz | button "Luz" | (barra de ferramentas) | (do bloco) |
| Sala | button "Sala" | (barra de ferramentas) | (do bloco) |
| Chão | button "Chão" | (barra de ferramentas) | (do bloco) |
| Caminho | button "Caminho" | (barra de ferramentas) | (do bloco) |
| Penhasco | button "Penhasco" | (barra de ferramentas) | (do bloco) |
| Texturas | button "Texturas" | (barra de ferramentas) | (do bloco) |
| Carimbos | button "Carimbos" | (barra de ferramentas) | (do bloco) |
| Escada | button "Escada" | (barra de ferramentas) | (do bloco) |
| Objeto | button "Objeto" | (barra de ferramentas) | (do bloco) |
| Zona oculta | button "Zona oculta" | (barra de ferramentas) | (do bloco) |
| Pincel de revelar | button "Pincel de revelar" | (barra de ferramentas) | (do bloco) |
| Desenho | button "Desenho" | (barra de ferramentas) | (do bloco) |
| Texto | button "Texto" | (barra de ferramentas) | (do bloco) |
| Pino | button "Pino" | (barra de ferramentas) | (do bloco) |
| Medir | button "Medir" | (barra de ferramentas) | (do bloco) |
| Borracha | button "Borracha" | (barra de ferramentas) | (do bloco) |
| Sala: Forma Retângulo | radio "Retângulo" | (barra de ferramentas) > clicar button "Opções de Sala" | (do bloco) |
| Sala: Forma Circular | radio "Circular" | (barra de ferramentas) > clicar button "Opções de Sala" | (do bloco) |
| Sala: Forma Polígono | radio "Polígono" | (barra de ferramentas) > clicar button "Opções de Sala" | (do bloco) |
| Sala: Forma Livre | radio "Livre" | (barra de ferramentas) > clicar button "Opções de Sala" | (do bloco) |
| Sala: Forma Região | radio "Região" | (barra de ferramentas) > clicar button "Opções de Sala" | (do bloco) |
| Objeto: Colocar Móvel | radio "Móvel" | (barra de ferramentas) > clicar button "Opções de Objeto" | (do bloco) |
| Objeto: Colocar Imagem | radio "Imagem" | (barra de ferramentas) > clicar button "Opções de Objeto" | (do bloco) |

### Variantes da barra (setinhas)

Parte de: editor aberto. Vai para: Cantinho do botão (clique direito ou segurar) + ficha da ferramenta. Fatia: 6.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Parede: Tipo de parede | radiogroup "Tipo de parede" | (tela) > clicar button "Opções de Parede" | (do bloco) |
| Porta: Tipo de porta | radiogroup "Tipo de porta" | (tela) > clicar button "Opções de Porta" | (do bloco) |
| Região: Preenchimento | radiogroup "Preenchimento" | (tela) > clicar button "Opções de Sala" > clicar radio "Região" > clicar button "Opções de Sala" | (do bloco) |
| Sala: Preenchimento | radiogroup "Preenchimento" | (tela) > clicar button "Opções de Sala" > clicar radio "Retângulo" > clicar button "Opções de Sala" | (do bloco) |
| Sala Circular: Preenchimento | radiogroup "Preenchimento" | (tela) > clicar button "Opções de Sala" > clicar radio "Circular" > clicar button "Opções de Sala" | (do bloco) |
| Polígono Regular: Lados do polígono | radiogroup "Lados do polígono" | (tela) > clicar button "Opções de Sala" > clicar radio "Polígono" > clicar button "Opções de Sala" | (do bloco) |
| Sala livre: Criar (Sala / Parede) | radiogroup "Criar" | (tela) > clicar button "Opções de Sala" > clicar radio "Livre" > clicar button "Opções de Sala" | (do bloco) |
| Sala livre: Arredondar | radiogroup "Arredondar" | (tela) > clicar button "Opções de Sala" > clicar radio "Livre" > clicar button "Opções de Sala" | (do bloco) |
| Chão: Forma | radiogroup "Forma" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Chão: Tinta | radiogroup "Tinta" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Chão: Tamanho do pincel | radiogroup "Tamanho do pincel" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Chão: Operação | radiogroup "Operação" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Escada: Tamanho | radiogroup "Tamanho" | (tela) > clicar button "Opções de Escada" | (do bloco) |
| Objetos: Barril | radio "Barril" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Caixa | radio "Caixa" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Baú | radio "Baú" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Cama | radio "Cama" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Mesa | radio "Mesa" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Cadeira | radio "Cadeira" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Cerca | radio "Cerca" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Armário de cozinha | radio "Armário de cozinha" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Aparador | radio "Aparador" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Fogueira | radio "Fogueira" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Objetos: Tapete | radio "Tapete" | (tela) > clicar button "Opções de Objeto" > clicar radio "Móvel" > clicar button "Opções de Objeto" | (do bloco) |
| Desenho: Forma (7 formas) | radiogroup "Forma" | (tela) > clicar button "Opções de Desenho" | (do bloco) |
| Desenho: Modo (Traço livre / Balde) | radiogroup "Modo" | (tela) > clicar button "Opções de Desenho" | (do bloco) |
| Desenho: Textura do traço | radiogroup "Textura do traço" | (tela) > clicar button "Opções de Desenho" | (do bloco) |
| Borracha: Modo | radiogroup "Modo" | (tela) > clicar button "Opções de Borracha" | (do bloco) |

### Ficha da ferramenta: Parede

Parte de: ferramenta Parede armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Parede | heading "Ferramenta · Parede" | (livro do mestre) | (do bloco) |
| Parede interna | checkbox "Parede interna" | (livro do mestre) | (do bloco) |
| Espessura da parede | radiogroup "Espessura da parede" | (livro do mestre) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (livro do mestre) | (do bloco) |
| Avançado | button "Avançado" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Porta

Parte de: ferramenta Porta armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Porta | heading "Ferramenta · Porta" | (livro do mestre) | (do bloco) |
| Abrir na parede | radiogroup "Abrir na parede" | (livro do mestre) | (do bloco) |
| Tipo de porta | radiogroup "Tipo de porta" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Luz

Parte de: ferramenta Luz armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Luz | heading "Ferramenta · Luz" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Região

Parte de: ferramenta Região armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Região | heading "Ferramenta · Região" | (livro do mestre) | (do bloco) |
| Forma | radiogroup "Forma" | (livro do mestre) | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Hachurado | checkbox "Hachurado" | (livro do mestre) | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (livro do mestre) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (livro do mestre) | (do bloco) |
| Preenchido | checkbox "Preenchido" | (livro do mestre) | (do bloco) |
| Avançado | button "Avançado" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Sala

Parte de: ferramenta Sala armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Sala | heading "Ferramenta · Sala" | (livro do mestre) | (do bloco) |
| Forma | radiogroup "Forma" | (livro do mestre) | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Hachurado | checkbox "Hachurado" | (livro do mestre) | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (livro do mestre) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (livro do mestre) | (do bloco) |
| Preenchido | checkbox "Preenchido" | (livro do mestre) | (do bloco) |
| Avançado | button "Avançado" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Chão

Parte de: ferramenta Chão armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Chão | heading "Ferramenta · Chão" | (livro do mestre) | (do bloco) |
| Forma | radiogroup "Forma" | (livro do mestre) | (do bloco) |
| Tinta | radiogroup "Tinta" | (livro do mestre) | (do bloco) |
| Operação | radiogroup "Operação" | (livro do mestre) | (do bloco) |
| Chão do mapa | button "Chão do mapa" | (livro do mestre) > clicar button "Ir para Cena" | Página Cena, pela nota "Ir para Cena" da ficha do Chão (feito, fatia 7) |

### Ficha da ferramenta: Caminho

Parte de: ferramenta Caminho armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Caminho | heading "Ferramenta · Caminho" | (livro do mestre) | (do bloco) |
| Cor deste caminho | textbox "Cor deste caminho" | (livro do mestre) | (do bloco) |
| Largura | slider "Largura" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Penhasco

Parte de: ferramenta Penhasco armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta com a biblioteca em grade de cartões (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Penhasco | heading "Ferramenta · Penhasco" | (livro do mestre) | (do bloco) |
| Ao riscar | radiogroup "Ao riscar" | (livro do mestre) | (do bloco) |
| Largura do pincel | radiogroup "Largura do pincel" | (livro do mestre) | (do bloco) |
| Altura do penhasco | radiogroup "Altura do penhasco" | (livro do mestre) | (do bloco) |
| Ligar o relevo | button "Ligar o relevo" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Texturas

Parte de: ferramenta Texturas armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta com a biblioteca em grade de cartões (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Texturas | heading "Ferramenta · Texturas" | (livro do mestre) | (do bloco) |
| Ao pintar | radiogroup "Ao pintar" | (livro do mestre) | (do bloco) |
| Textura | radiogroup "Textura" | (livro do mestre) | (do bloco) |
| Colar ou soltar a imagem da nova textura | region "Colar ou soltar a imagem da nova textura" | (livro do mestre) | (do bloco) |
| Escolher imagem… | button "Escolher imagem…" | (livro do mestre) | (do bloco) |
| Procurar texturas novas | button "Procurar texturas novas" | (livro do mestre) | (do bloco) |
| Tamanho do pincel | slider "Tamanho do pincel" | (livro do mestre) | (do bloco) |
| Força | slider "Força" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Carimbos

Parte de: ferramenta Carimbos armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta com a biblioteca em grade de cartões (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Carimbos | heading "Ferramenta · Carimbos" | (livro do mestre) | (do bloco) |
| Ao clicar | radiogroup "Ao clicar" | (livro do mestre) | (do bloco) |
| Objeto | radiogroup "Objeto" | (livro do mestre) | (do bloco) |
| Árvore | radio "Árvore" | (livro do mestre) | (do bloco) |
| Colar ou soltar a imagem do novo carimbo | region "Colar ou soltar a imagem do novo carimbo" | (livro do mestre) | (do bloco) |
| Escolher imagem… | button "Escolher imagem…" | (livro do mestre) | (do bloco) |
| Procurar carimbos novos | button "Procurar carimbos novos" | (livro do mestre) | (do bloco) |
| Tamanho | slider "Tamanho" | (livro do mestre) | (do bloco) |
| Largura do spray | slider "Largura do spray" | (livro do mestre) | (do bloco) |
| Densidade do spray | slider "Densidade do spray" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Escada

Parte de: ferramenta Escada armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Escada | heading "Ferramenta · Escada" | (livro do mestre) | (do bloco) |
| Tamanho | radiogroup "Tamanho" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Peça

Parte de: ferramenta Peça armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Peça | heading "Ferramenta · Peça" | (livro do mestre) | (do bloco) |
| Colocar | radiogroup "Colocar" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Zona oculta

Parte de: ferramenta Zona oculta armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Zona oculta | heading "Ferramenta · Zona oculta" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Pincel de revelar

Parte de: ferramenta Pincel de revelar armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Pincel de revelar | heading "Ferramenta · Pincel de revelar" | (livro do mestre) | (do bloco) |
| Ao pintar | radiogroup "Ao pintar" | (livro do mestre) | (do bloco) |
| Largura do pincel | radiogroup "Largura do pincel" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Objetos

Parte de: ferramenta Objetos armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Objetos | heading "Ferramenta · Objetos" | (livro do mestre) | (do bloco) |
| Colocar | radiogroup "Colocar" | (livro do mestre) | (do bloco) |
| Objeto | radiogroup "Objeto" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Desenho

Parte de: ferramenta Desenho armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Pincel | heading "Ferramenta · Pincel" | (livro do mestre) | (do bloco) |
| Forma | radiogroup "Forma" | (livro do mestre) | (do bloco) |
| Modo | radiogroup "Modo" | (livro do mestre) | (do bloco) |
| Textura do traço | radiogroup "Textura do traço" | (livro do mestre) | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Espessura | slider "Espessura" | (livro do mestre) | (do bloco) |
| Ponta da linha | radiogroup "Ponta da linha" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Texto

Parte de: ferramenta Texto armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Texto | heading "Ferramenta · Texto" | (livro do mestre) | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Tamanho da fonte | slider "Tamanho da fonte" | (livro do mestre) | (do bloco) |
| Fonte | combobox "Fonte" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Pino

Parte de: ferramenta Pino armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Pino | heading "Ferramenta · Pino" | (livro do mestre) | (do bloco) |
| Tipo do pino | radiogroup "Tipo do pino" | (livro do mestre) | (do bloco) |
| Ícone no mapa | radiogroup "Ícone no mapa" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Medir

Parte de: ferramenta Medir armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Medir | heading "Ferramenta · Medir" | (livro do mestre) | (do bloco) |

### Ficha da ferramenta: Borracha

Parte de: ferramenta Borracha armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Borracha | heading "Ferramenta · Borracha" | (livro do mestre) | (do bloco) |
| Modo | radiogroup "Modo" | (livro do mestre) | (do bloco) |

### Cabeça da ficha da seleção

Parte de: token selecionado no mapa. Vai para: Cabeça da ficha: retrato ou medalha, nome, tipo, Apagar e "Mais ações" (feito). Fatia: 8.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Apagar | button "Apagar token selecionado" | (livro do mestre) | (do bloco) |
| Mais ações | button "Mais ações" | (livro do mestre) | (do bloco) |

### Ficha do token

Parte de: token selecionado no mapa. Vai para: Página Ficha: Tipo de ficha, Nome, Condições, No mapa, Levar para outra cena, cartões de Comportamento (feito). Fatia: 9.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ficha de NPC | checkbox "Ficha de NPC" | (livro do mestre) | (do bloco) |
| Ficha de jogador | checkbox "Ficha de jogador" | (livro do mestre) | (do bloco) |
| Nome | textbox "Nome" | (livro do mestre) | (do bloco) |
| Nome para os jogadores | radiogroup "Nome para os jogadores" | (livro do mestre) | (do bloco) |
| Condição: Envenenado | button "Envenenado" | (livro do mestre) | (do bloco) |
| Condição: Caído | button "Caído" | (livro do mestre) | (do bloco) |
| Condição: Dormindo | button "Dormindo" | (livro do mestre) | (do bloco) |
| Condição: Atordoado | button "Atordoado" | (livro do mestre) | (do bloco) |
| Condição: Invisível | button "Invisível" | (livro do mestre) | (do bloco) |
| Travado | button "Travado" | (livro do mestre) > clicar button "/^No mapa/" | (do bloco) |
| Congelado | button "Congelado" | (livro do mestre) > clicar button "/^No mapa/" | (do bloco) |
| Oculto para jogadores | button "Oculto para jogadores" | (livro do mestre) > clicar button "/^No mapa/" | (do bloco) |
| Tamanho da ficha | radiogroup "Tamanho da ficha" | (livro do mestre) > clicar button "/^No mapa/" | (do bloco) |
| Cor da ficha | radiogroup "Cor da ficha" | (livro do mestre) > clicar button "/^No mapa/" | (do bloco) |
| Escolher imagem... | button "Escolher imagem..." | (livro do mestre) > clicar button "/^No mapa/" | (do bloco) |
| Salvar no acervo | button "Salvar no acervo" | (livro do mestre) > clicar button "/^No mapa/" | (do bloco) |
| Avançado: Rotação | spinbutton "Rotação" | (livro do mestre) > clicar button "/^No mapa/" > clicar button "Avançado" | (do bloco) |
| Avançado: Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) > clicar button "/^No mapa/" > clicar button "Avançado" | (do bloco) |
| Personagem | combobox "Personagem" | (livro do mestre) > clicar button "/^Personagem/" | (do bloco) |
| Vigia: Esta ficha vigia | checkbox "Esta ficha vigia" | (livro do mestre) > clicar button "/^Vigia/" | (do bloco) |
| Patrulha: Marcar ponto aqui | button "Marcar ponto aqui" | (livro do mestre) > clicar button "/^Patrulha/" | (do bloco) |
| Patrulha: Patrulhar sozinha | button "Patrulhar sozinha" | (livro do mestre) > clicar button "/^Patrulha/" | (do bloco) |
| Patrulha: Avançar patrulha | button "Avançar patrulha" | (livro do mestre) > clicar button "/^Patrulha/" | (do bloco) |
| Veículo: Esta ficha é um veículo | checkbox "Esta ficha é um veículo" | (livro do mestre) > clicar button "/^Veículo/" | (do bloco) |
| Piso | spinbutton "Piso" | (livro do mestre) > clicar button "/^Piso/" | (do bloco) |
| Voltar da sub-ficha | button "Voltar para Goblin" | (livro do mestre) > clicar button "/^Vigia/" | (do bloco) |

### Ficha do pino (!)

Parte de: pino de exclamação selecionado. Vai para: Página Ficha do pino: essencial + "+ Adicionar ao pino" + Aparência, Na mesa (feito). Fatia: 12.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo do pino | radiogroup "Tipo do pino" | (livro do mestre) | (do bloco) |
| Nome do local | textbox "Nome do local" | (livro do mestre) | (do bloco) |
| Descrição · o jogador lê | textbox "Descrição · o jogador lê" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Marco: todos veem | checkbox "Marco: todos veem" | (livro do mestre) | (do bloco) |
| Ler só de perto | checkbox "Ler só de perto" | (livro do mestre) | (do bloco) |
| Excluir ponto de interesse | button "Excluir ponto de interesse" | (livro do mestre) | (do bloco) |
| Cor do pino | radiogroup "Cor do pino" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Outra cor… | textbox "Outra cor…" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor padrão | button "Cor padrão" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Tamanho | slider "Tamanho" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Tamanho padrão | button "Tamanho padrão" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Só o círculo, sem haste | checkbox "Só o círculo, sem haste" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Escolher imagem... | button "Escolher imagem..." | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Ícone no mapa | radiogroup "Ícone no mapa" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Animação do cenário | menuitem "Animação do cenário" | (livro do mestre) > clicar button "Adicionar ao pino" | (do bloco) |
| Item pegável | menuitem "Item pegável" | (livro do mestre) > clicar button "Adicionar ao pino" | (do bloco) |
| Fechadura com segredo | menuitem "Fechadura com segredo" | (livro do mestre) > clicar button "Adicionar ao pino" | (do bloco) |
| Peça de coleção | menuitem "Peça de coleção" | (livro do mestre) > clicar button "Adicionar ao pino" | (do bloco) |
| Loja com preços | menuitem "Loja com preços" | (livro do mestre) > clicar button "Adicionar ao pino" | (do bloco) |
| Cabine contínua | menuitem "Cabine contínua" | (livro do mestre) > clicar button "Adicionar ao pino" | (do bloco) |

### Ficha do pino (!) com cenário

Parte de: pino de exclamação com imagem e animação do cenário selecionado. Vai para: Ficha "Animação do cenário" na ficha do pino: prévia viva no topo (Assistir/Parar, Ver grande, duração), Estilo, Câmera, Efeitos, Duração e Quando (feito). Fatia: 13.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Assistir | button "Assistir" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Ver grande | button "Ver grande" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Prévia da animação do cenário | img "Prévia da animação do cenário" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Estilo | combobox "Estilo" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Procurar animações novas | button "Procurar animações novas" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Câmera dentro da moldura | radiogroup "Câmera dentro da moldura" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| De baixo para cima | radio "De baixo para cima" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| De cima para baixo | radio "De cima para baixo" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Da esquerda para a direita | radio "Da esquerda para a direita" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Da direita para a esquerda | radio "Da direita para a esquerda" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Aproximar | radio "Aproximar" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Névoa | button "Névoa" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Raios de sol | button "Raios de sol" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Partículas | button "Partículas" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Som do vento | button "Som do vento" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Duração (segundos) | textbox "Duração (segundos)" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Quando o jogador vê | combobox "Quando o jogador vê" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Tirar do pino | button "Tirar do pino" | (livro do mestre) > clicar button "/^Animação do cenário/" | (do bloco) |
| Ver grande: janela "Animação do cenário · <local>" | dialog "/^Animação do cenário/" | (livro do mestre) > clicar button "/^Animação do cenário/" > clicar button "Ver grande" | (do bloco) |
| Ver grande: Esc fecha e o foco volta | button "Ver grande" | (livro do mestre) > clicar button "/^Animação do cenário/" > clicar button "Ver grande" > tecla Escape | (do bloco) |
| Assistir: vira Parar | button "Parar" | (livro do mestre) > clicar button "/^Animação do cenário/" > clicar button "Assistir" | (do bloco) |

### Ficha do pino de viagem

Parte de: pino de viagem selecionado. Vai para: Página Ficha do pino: destino e Passagem no essencial, o resto na ficha "Mais da viagem" (feito). Fatia: 12.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Leva a… | button "Leva a…" | (livro do mestre) | (do bloco) |
| Passagem | radiogroup "Passagem" | (livro do mestre) | (do bloco) |
| Excluir pino de viagem | button "Excluir pino de viagem" | (livro do mestre) | (do bloco) |
| Transição ao atravessar | heading "Transição ao atravessar" | (livro do mestre) > clicar button "/^Mais da viagem/" | (do bloco) |
| Nenhuma Chega direto | button "Nenhuma Chega direto" | (livro do mestre) > clicar button "/^Mais da viagem/" | (do bloco) |
| Procurar animações novas | button "Procurar animações novas" | (livro do mestre) > clicar button "/^Mais da viagem/" | (do bloco) |
| Preso à ficha | combobox "Preso à ficha" | (livro do mestre) > clicar button "/^Mais da viagem/" | (do bloco) |
| Cabine (elevador, cesto) | combobox "Cabine (elevador, cesto)" | (livro do mestre) > clicar button "/^Mais da viagem/" | (do bloco) |
| Nova cabine | textbox "Nova cabine" | (livro do mestre) > clicar button "/^Mais da viagem/" | (do bloco) |
| Criar cabine aqui | button "Criar cabine aqui" | (livro do mestre) > clicar button "/^Mais da viagem/" | (do bloco) |

### Ficha da alavanca

Parte de: alavanca selecionada. Vai para: Página Ficha do pino (alavanca com "Acionar agora") (feito). Fatia: 12.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Abre a porta | combobox "Abre a porta" | (livro do mestre) | (do bloco) |
| Excluir alavanca | button "Excluir alavanca" | (livro do mestre) | (do bloco) |

### Ficha da porta

Parte de: porta selecionada no mapa. Vai para: Página Ficha da porta: Estado, Trancada, Secreta, Espiar + Quem abre, Aparência, Parede em volta, Depende do estado (feito). Fatia: 11.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Estado | radiogroup "Estado" | (livro do mestre) | (do bloco) |
| Aberta | radio "Aberta" | (livro do mestre) | (do bloco) |
| Trancada | checkbox "Trancada" | (livro do mestre) | (do bloco) |
| Secreta | checkbox "Secreta" | (livro do mestre) | (do bloco) |
| Jogador pode espiar | checkbox "Jogador pode espiar" | (livro do mestre) | (do bloco) |
| Quem abre: Abre por | radiogroup "Abre por" | (livro do mestre) > clicar button "/^Quem abre/" | (do bloco) |
| Tipo de porta | radiogroup "Tipo de porta" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor da porta | radiogroup "Cor da porta" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Outra cor… | textbox "Outra cor…" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor padrão | button "Cor padrão" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Animação ao abrir | combobox "Animação ao abrir" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Procurar animações novas | button "Procurar animações novas" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Parede interna | checkbox "Parede interna" | (livro do mestre) > clicar button "/^Parede em volta/" | (do bloco) |
| Pegar do mapa a cor da parede | button "Pegar do mapa a cor da parede" | (livro do mestre) > clicar button "/^Parede em volta/" | (do bloco) |
| Cor da parede | textbox "Cor da parede" | (livro do mestre) > clicar button "/^Parede em volta/" | (do bloco) |
| Espessura da parede | radiogroup "Espessura da parede" | (livro do mestre) > clicar button "/^Parede em volta/" | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (livro do mestre) > clicar button "/^Parede em volta/" | (do bloco) |
| Avançado | button "Avançado" | (livro do mestre) > clicar button "/^Parede em volta/" | (do bloco) |
| Abrir agora | menuitem "Abrir agora" | (livro do mestre) > clicar button "Mais ações" | (do bloco) |
| Trancar | menuitem "Trancar" | (livro do mestre) > clicar button "Mais ações" | (do bloco) |
| Virar parede sólida | menuitem "Virar parede sólida" | (livro do mestre) > clicar button "Mais ações" | (do bloco) |

### Ficha da parede

Parte de: parede selecionada no mapa. Vai para: Página Ficha da parede: Cor, Espessura, Ajuste fino e Avançado no essencial; O que a parede deixa e Tipo fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Pegar do mapa a cor da parede | button "Pegar do mapa a cor da parede" | (livro do mestre) | (do bloco) |
| Cor da parede | textbox "Cor da parede" | (livro do mestre) | (do bloco) |
| Espessura da parede | radiogroup "Espessura da parede" | (livro do mestre) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (livro do mestre) | (do bloco) |
| Avançado | button "Avançado" | (livro do mestre) | (do bloco) |
| Janela (vê, não passa) | checkbox "Janela (vê, não passa)" | (livro do mestre) > clicar button "/^O que a parede deixa/" | (do bloco) |
| Deixa passar (a ficha atravessa) | checkbox "Deixa passar (a ficha atravessa)" | (livro do mestre) > clicar button "/^O que a parede deixa/" | (do bloco) |
| Deixa ver (a visão atravessa) | checkbox "Deixa ver (a visão atravessa)" | (livro do mestre) > clicar button "/^O que a parede deixa/" | (do bloco) |
| Parede interna | checkbox "Parede interna" | (livro do mestre) > clicar button "/^Tipo/" | (do bloco) |
| Virar porta | menuitem "Virar porta" | (livro do mestre) > clicar button "Mais ações" | "Mais ações" da cabeça da ficha (feito, fatia 16a) |

### Ficha da escada

Parte de: escada selecionada no mapa. Vai para: Página Ficha da escada: Sentido, Forma, Tamanho, Comprimento, Largura, Curva e Oculto no essencial, na gramática do Grimório (seg, número e deslizante; restilo da 17); Para onde leva fechada (feito na 16b; as alças no mapa são da 17). Fatia: 16b e 17.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Sentido da escada | radiogroup "Sentido da escada" | (livro do mestre) | (do bloco) |
| Forma da escada | radiogroup "Forma da escada" | (livro do mestre) | (do bloco) |
| Tamanho da escada | radiogroup "Tamanho da escada" | (livro do mestre) | (do bloco) |
| Comprimento | spinbutton "Comprimento" | (livro do mestre) | (do bloco) |
| Diminuir o comprimento | button "Diminuir o comprimento" | (livro do mestre) | (do bloco) |
| Aumentar o comprimento | button "Aumentar o comprimento" | (livro do mestre) | (do bloco) |
| Largura | spinbutton "Largura" | (livro do mestre) | (do bloco) |
| Diminuir a largura | button "Diminuir a largura" | (livro do mestre) | (do bloco) |
| Aumentar a largura | button "Aumentar a largura" | (livro do mestre) | (do bloco) |
| Curva | slider "Curva" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Leva a | combobox "Leva a" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Passagem da escada | radiogroup "Passagem da escada" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Criar andar de cima | button "Criar andar de cima" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Piso | spinbutton "Piso" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Leva ao piso | spinbutton "Leva ao piso" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Transição ao trocar de piso | heading "Transição ao trocar de piso" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Nenhuma Chega direto | button "Nenhuma Chega direto" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Procurar animações novas | button "Procurar animações novas" | (livro do mestre) > clicar button "/^Para onde leva/" | (do bloco) |
| Curva: Endireitar | button "Endireitar" | (livro do mestre) > clicar slider "Curva" > tecla End | (do bloco) |

### Ficha da sala

Parte de: sala selecionada no mapa. Vai para: Página Ficha da sala: Sala, O que os jogadores veem e Acrescentar abertas; Aparência, Medidas e título e Trava fechadas (feito). Fatia: 15.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Nome | textbox "Nome" | (livro do mestre) | (do bloco) |
| Ao entrar, o jogador lê | textbox "Ao entrar, o jogador lê" | (livro do mestre) | (do bloco) |
| Jogadores veem o nome | checkbox "Jogadores veem o nome" | (livro do mestre) | (do bloco) |
| Teto fechado para jogadores | checkbox "Teto fechado para jogadores" | (livro do mestre) | (do bloco) |
| Cômodo: aparece só depois de visto | checkbox "Cômodo: aparece só depois de visto" | (livro do mestre) | (do bloco) |
| Sala escura | checkbox "Sala escura" | (livro do mestre) | (do bloco) |
| De dentro, vê lá fora | checkbox "De dentro, vê lá fora" | (livro do mestre) | (do bloco) |
| De fora, vê aqui dentro | checkbox "De fora, vê aqui dentro" | (livro do mestre) | (do bloco) |
| Nota do mestre | button "Nota do mestre" | (livro do mestre) | (do bloco) |
| Facção | button "Facção" | (livro do mestre) | (do bloco) |
| Raio de visão aqui | button "Raio de visão aqui" | (livro do mestre) | (do bloco) |
| Perigo | button "Perigo" | (livro do mestre) | (do bloco) |
| Esteira | button "Esteira" | (livro do mestre) | (do bloco) |
| Criar sala dentro | button "Criar sala dentro" | (livro do mestre) | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Hachurado | checkbox "Hachurado" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Preenchido | checkbox "Preenchido" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Pintar parte da sala de outra cor | checkbox "Pintar parte da sala de outra cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Avançado | button "Avançado" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (livro do mestre) > clicar button "/^Aparência/" > clicar button "Avançado" | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (livro do mestre) > clicar button "/^Aparência/" > clicar button "Avançado" | (do bloco) |
| Criar parede na borda | button "Criar parede na borda" | (livro do mestre) > clicar button "/^Aparência/" > clicar button "Avançado" | (do bloco) |
| Largura | spinbutton "Largura" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| Altura | spinbutton "Altura" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| −90° | button "−90°" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| +90° | button "+90°" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| Fundo do título | checkbox "Fundo do título" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| Tamanho do título | slider "Tamanho do título" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| Cor do título | textbox "Cor do título" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| Orientação do título | radiogroup "Orientação do título" | (livro do mestre) > clicar button "/^Medidas e título/" | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) > clicar button "/^Trava$/" | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) > clicar button "/^Trava$/" | (do bloco) |
| Mais ações: levar ao piso | menuitem "/^Levar ao/" | (livro do mestre) > clicar button "Mais ações" | "Mais ações" da cabeça da ficha (feito, fatia 8) |

### Ficha da região (não sala)

Parte de: região selecionada no mapa. Vai para: Página Ficha da região: Cor, Hachurado, Preenchido e Avançado no essencial (a Aparência da sala); Trava aberta; Gatilho fechada (feito). Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Hachurado | checkbox "Hachurado" | (livro do mestre) | (do bloco) |
| Preenchido | checkbox "Preenchido" | (livro do mestre) | (do bloco) |
| Avançado | button "Avançado" | (livro do mestre) | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (livro do mestre) > clicar button "Avançado" | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (livro do mestre) > clicar button "Avançado" | (do bloco) |
| Criar parede na borda | button "Criar parede na borda" | (livro do mestre) > clicar button "Avançado" | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) > clicar button "/^Trava/" | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) > clicar button "/^Trava/" | (do bloco) |
| Gatilho da área | radiogroup "Gatilho da área" | (livro do mestre) > clicar button "/^Gatilho/" | (do bloco) |

### Ficha da luz

Parte de: luz selecionada no mapa. Vai para: Página Ficha da luz: Cor, Intensidade e Vista de longe no essencial; Presa a uma ficha aberta; Depende do estado fechada (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Intensidade | slider "Intensidade" | (livro do mestre) | (do bloco) |
| Vista de longe | checkbox "Vista de longe" | (livro do mestre) | (do bloco) |
| Prender na ficha | combobox "Prender na ficha" | (livro do mestre) | (do bloco) |

### Ficha da peça (imagem)

Parte de: peça de imagem selecionada. Vai para: Página Ficha do objeto: No mapa aberta; Para os jogadores fechada; a imagem solta não tem essencial (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do objeto: barril

Parte de: objeto "m-barril" selecionado no mapa. Vai para: Página Ficha do objeto: Tipo, Vista e Forma no essencial; No mapa aberta; Aparência e Para os jogadores fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (livro do mestre) | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Preencher | checkbox "Preencher" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do objeto: catre

Parte de: objeto "m-catre" selecionado no mapa. Vai para: Página Ficha do objeto: Tipo, Vista e Forma no essencial; No mapa aberta; Aparência e Para os jogadores fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (livro do mestre) | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Preencher | checkbox "Preencher" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor do travesseiro | textbox "Cor do travesseiro" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Paleta: cor do travesseiro | radiogroup "Paleta: cor do travesseiro" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor do cobertor | textbox "Cor do cobertor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Paleta: cor do cobertor | radiogroup "Paleta: cor do cobertor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do objeto: cerca

Parte de: objeto "m-cerca" selecionado no mapa. Vai para: Página Ficha do objeto: Tipo, Vista e Forma no essencial; No mapa aberta; Aparência e Para os jogadores fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (livro do mestre) | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do objeto: armario

Parte de: objeto "m-armario" selecionado no mapa. Vai para: Página Ficha do objeto: Tipo, Vista e Forma no essencial; No mapa aberta; Aparência e Para os jogadores fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (livro do mestre) | (do bloco) |
| Vista | radiogroup "Vista" | (livro do mestre) | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Preencher | checkbox "Preencher" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do objeto: aparador

Parte de: objeto "m-aparador" selecionado no mapa. Vai para: Página Ficha do objeto: Tipo, Vista e Forma no essencial; No mapa aberta; Aparência e Para os jogadores fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (livro do mestre) | (do bloco) |
| Vista | radiogroup "Vista" | (livro do mestre) | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Preencher | checkbox "Preencher" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do objeto: fogueira

Parte de: objeto "m-fogueira" selecionado no mapa. Vai para: Página Ficha do objeto: Tipo, Vista e Forma no essencial; No mapa aberta; Aparência e Para os jogadores fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (livro do mestre) | (do bloco) |
| Vista | radiogroup "Vista" | (livro do mestre) | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Preencher | checkbox "Preencher" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do objeto: tapete

Parte de: objeto "m-tapete" selecionado no mapa. Vai para: Página Ficha do objeto: Tipo, Vista e Forma no essencial; No mapa aberta; Aparência e Para os jogadores fechadas (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (livro do mestre) | (do bloco) |
| Vista | radiogroup "Vista" | (livro do mestre) | (do bloco) |
| Forma | radiogroup "Forma" | (livro do mestre) | (do bloco) |
| Rotação | spinbutton "Rotação" | (livro do mestre) | (do bloco) |
| Travado | checkbox "Travado" | (livro do mestre) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (livro do mestre) | (do bloco) |
| Preencher | checkbox "Preencher" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (livro do mestre) > clicar button "/^Aparência/" | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (livro do mestre) > clicar button "/^Para os jogadores/" | (do bloco) |

### Ficha do desenho

Parte de: linha desenhada selecionada. Vai para: Página Ficha do desenho: Cor, Espessura, Formato da linha e Oculto no essencial; Traço e Paredes fechadas; Endireitar no "Mais ações" (feito). Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Endireitar | menuitem "Endireitar" | (livro do mestre) > clicar button "Mais ações" | "Mais ações" da cabeça da ficha (feito, fatia 8) |
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Espessura | slider "Espessura" | (livro do mestre) | (do bloco) |
| Formato da linha | radiogroup "Formato da linha" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |
| Estilo do traço | radiogroup "Estilo do traço" | (livro do mestre) > clicar button "/^Traço/" | (do bloco) |
| Ponta da linha | radiogroup "Ponta da linha" | (livro do mestre) > clicar button "/^Traço/" | (do bloco) |
| Paredes ao redor | checkbox "Paredes ao redor" | (livro do mestre) > clicar button "/^Paredes/" | (do bloco) |

### Ficha do caminho

Parte de: caminho selecionado. Vai para: Página Ficha do desenho, variante do caminho: Cor, Espessura e Oculto no essencial, sem Paredes (feito). Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Espessura | slider "Espessura" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |

### Ficha do texto

Parte de: texto selecionado. Vai para: Página Ficha do texto: o campo do texto (com nome, "Texto"), Cor, Tamanho da fonte, Fonte e Oculto no essencial (feito). Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Texto | textbox "Texto" | (livro do mestre) | (do bloco) |
| Cor | textbox "Cor" | (livro do mestre) | (do bloco) |
| Tamanho da fonte | slider "Tamanho da fonte" | (livro do mestre) | (do bloco) |
| Fonte | combobox "Fonte" | (livro do mestre) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (livro do mestre) | (do bloco) |

### Ficha da peça de chão

Parte de: peça de chão (retângulo) selecionada. Vai para: Página Ficha da peça de chão: Travar, Operação e Cor no essencial; Medidas aberta; Borda e Ordem fechadas (feito). Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Apagar peça de chão selecionada | button "Apagar peça de chão selecionada" | (livro do mestre) | (do bloco) |
| Mais ações | button "Mais ações" | (livro do mestre) | (do bloco) |
| Travar peça | checkbox "Travar peça" | (livro do mestre) | (do bloco) |
| Operação da peça de chão | radiogroup "Operação da peça de chão" | (livro do mestre) | (do bloco) |
| Cor desta peça | textbox "Cor desta peça" | (livro do mestre) | (do bloco) |
| Centro X (px) | spinbutton "Centro X (px)" | (livro do mestre) > clicar button "/^Medidas/" | (do bloco) |
| Centro Y (px) | spinbutton "Centro Y (px)" | (livro do mestre) > clicar button "/^Medidas/" | (do bloco) |
| Largura (px) | spinbutton "Largura (px)" | (livro do mestre) > clicar button "/^Medidas/" | (do bloco) |
| Altura (px) | spinbutton "Altura (px)" | (livro do mestre) > clicar button "/^Medidas/" | (do bloco) |
| Rotação (graus) | spinbutton "Rotação (graus)" | (livro do mestre) > clicar button "/^Medidas/" | (do bloco) |
| Arredondar (px) | spinbutton "Arredondar (px)" | (livro do mestre) > clicar button "/^Borda/" | (do bloco) |
| Borda irregular | checkbox "Borda irregular" | (livro do mestre) > clicar button "/^Borda/" | (do bloco) |
| Descer | button "Descer" | (livro do mestre) > clicar button "/^Ordem/" | (do bloco) |
| Subir | button "Subir" | (livro do mestre) > clicar button "/^Ordem/" | (do bloco) |
| Apagar peça de chão | button "Apagar peça de chão" | (livro do mestre) > clicar button "/^Ordem/" | (do bloco) |

### Ficha da zona oculta

Parte de: zona oculta selecionada. Vai para: Página Ficha da zona: cabeça com o Excluir zona; Nome, Revelar para jogadores e Revelar para… no essencial; Depende do estado fechada (feito). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Nome | textbox "Nome" | (livro do mestre) | (do bloco) |
| Revelar para jogadores | checkbox "Revelar para jogadores" | (livro do mestre) | (do bloco) |
| Excluir zona | button "Excluir zona" | (livro do mestre) | (do bloco) |

### Seleção múltipla

Parte de: token e parede selecionados juntos. Vai para: Página Ficha com 2 ou mais itens: cabeça que conta quantos e o essencial com o que vale para todos (feito). Fatia: 8.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Apagar 2 itens selecionados | button "Apagar 2 itens selecionados" | (livro do mestre) | (do bloco) |
| Agrupar (Ctrl+G) | button "Agrupar (Ctrl+G)" | (livro do mestre) | (do bloco) |
| Limpar seleção de área | button "Limpar seleção de área" | (livro do mestre) | (do bloco) |
| Alinhar à esquerda | button "Alinhar à esquerda" | (livro do mestre) | (do bloco) |
| Alinhar ao centro | button "Alinhar ao centro" | (livro do mestre) | (do bloco) |
| Alinhar à direita | button "Alinhar à direita" | (livro do mestre) | (do bloco) |
| Alinhar ao topo | button "Alinhar ao topo" | (livro do mestre) | (do bloco) |
| Alinhar ao meio | button "Alinhar ao meio" | (livro do mestre) | (do bloco) |
| Alinhar à base | button "Alinhar à base" | (livro do mestre) | (do bloco) |
| Distribuir na horizontal | button "Distribuir na horizontal" | (livro do mestre) | (do bloco) |
| Distribuir na vertical | button "Distribuir na vertical" | (livro do mestre) | (do bloco) |
| Oculto para jogadores (1) | checkbox "Oculto para jogadores (1)" | (livro do mestre) | (do bloco) |

### Configurações do mapa

Parte de: diálogo aberto pela engrenagem. Vai para: Mesmo diálogo, casca nova com navegação vertical. Fatia: 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Formato da grade | radiogroup "Formato da grade" | (tela) | (do bloco) |
| Cor da grade | textbox "Cor da grade" | (tela) | (do bloco) |
| Opacidade | slider "Opacidade" | (tela) | (do bloco) |
| Espessura | slider "Espessura" | (tela) | (do bloco) |
| Estilo da linha da grade | radiogroup "Estilo da linha da grade" | (tela) | (do bloco) |
| Alinhar grade à imagem | heading "Alinhar grade à imagem" | (tela) | (do bloco) |
| Unidades por célula | spinbutton "Unidades por célula" | (tela) | (do bloco) |
| Unidade | textbox "Unidade" | (tela) | (do bloco) |
| Casas decimais | spinbutton "Casas decimais" | (tela) | (do bloco) |
| Modo de medição | combobox "Modo de medição" | (tela) | (do bloco) |
| Passo máximo (quadrados) | spinbutton "Passo máximo (quadrados)" | (tela) | (do bloco) |
| Fichas ocupam espaço | checkbox "Fichas ocupam espaço" | (tela) | (do bloco) |
| Largura (quadros) | spinbutton "Largura (quadros)" | (tela) | (do bloco) |
| Altura (quadros) | spinbutton "Altura (quadros)" | (tela) | (do bloco) |
| Aplicar 30 × 20 | button "Aplicar 30 × 20" | (tela) | (do bloco) |
| Texto de chegada | textbox "Texto de chegada" | (tela) | (do bloco) |
| Rostos só de perto | checkbox "Rostos só de perto" | (tela) | (do bloco) |
| Casas | spinbutton "Casas" | (tela) | (do bloco) |
| Escolher sistema… | button "Escolher sistema…" | (tela) | (do bloco) |

### Configurar cena

Parte de: diálogo aberto pela engrenagem da cena (livro da mesa, página Cenas). Vai para: Configurar cena com navegação vertical; Relevo, Nomes dos lugares e Nuvens na seção "Mapa vivo". Fatia: 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Visão nesta cena (quadrados) | spinbutton "Visão nesta cena (quadrados)" | (tela) | (do bloco) |
| Cena escura | checkbox "Cena escura" | (tela) | (do bloco) |
| Tipo de mapa | radiogroup "Tipo de mapa" | (tela) | (do bloco) |
| Relevo | checkbox "Relevo" | (tela) | (do bloco) |
| Nomes dos lugares | checkbox "Nomes dos lugares" | (tela) | (do bloco) |
| Nuvens | checkbox "Nuvens" | (tela) | (do bloco) |
| Grupo anda junto (caravana), em mapa Continente | checkbox "Grupo anda junto (caravana)" | (tela) > clicar radio "Continente" | (do bloco) |

### Configurar cena pela página Cena

Parte de: diálogo aberto pelo "Configurar" da nota "Mapa vivo" (livro do mestre, página Cena). Vai para: Nota "Mapa vivo: ligado/desligado" no topo da página Cena; o "Configurar" abre o Configurar cena já na seção Mapa vivo. Fatia: 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Mapa vivo pela nota da página Cena | checkbox "Relevo" | (tela) | (do bloco) |

### Todas as cenas

Parte de: aberto pelo menu do chip da cena, "Ver todas as cenas". Vai para: Chip da cena, "Ver todas as cenas" (feito); a janela muda na 20. Fatia: 3 e 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Miniatura da cena | button "/^Cripta, 1 token/" | (tela) | (do bloco) |

### Atalhos do teclado

Parte de: aberto pelo "?". Vai para: Diálogo Atalhos com a lista nova. Fatia: 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Lista de atalhos | dialog "Atalhos do teclado" | (tela) | (do bloco) |

### Livro da mesa, sala fechada

Parte de: app do mestre, sala fechada. Vai para: Livro da mesa: topo da Sala (sala fechada), páginas Grupo e Mesa (feito); Personagens e Contas viram fichas recolhidas no fim do Grupo (fatia 5, feito). Fatia: 4 e 5.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Marcador Grupo (a aba Jogo de antes) | tab "Grupo" | (livro da mesa) | (do bloco) |
| Abrir sala | button "Abrir sala" | (livro da mesa) | (do bloco) |
| Visão de jogador | button "Visão de jogador" | (livro da mesa) | (do bloco) |
| Rede local (a dica do firewall) | dialog "Rede local" | (livro da mesa) > clicar button "Rede" | (do bloco) |
| Personagens: + Personagem | button "+ Personagem" | (livro da mesa) > clicar tab "Grupo" > clicar button "Personagens" | (do bloco) |
| Personagens: Importar personagens | button "Importar personagens…" | (livro da mesa) > clicar tab "Grupo" > clicar button "Personagens" | (do bloco) |
| Contas: Só com conta | checkbox "Só com conta" | (livro da mesa) > clicar tab "Grupo" > clicar button "Contas dos jogadores" | (do bloco) |
| Contas: nome da nova conta | textbox "Nome do jogador" | (livro da mesa) > clicar tab "Grupo" > clicar button "Contas dos jogadores" | (do bloco) |
| Contas: PIN | textbox "PIN" | (livro da mesa) > clicar tab "Grupo" > clicar button "Contas dos jogadores" | (do bloco) |
| Contas: + Conta | button "+ Conta" | (livro da mesa) > clicar tab "Grupo" > clicar button "Contas dos jogadores" | (do bloco) |
| Mesa: Teste secreto (sem jogadores, Pedir teste apagado) | button "Pedir teste" | (livro da mesa) > clicar tab "Mesa" | (do bloco) |
| Mesa: Visão de jogador | button "/^Visão de jogador.*Teste/" | (livro da mesa) > clicar tab "Mesa" | (do bloco) |
| Mesa: Som da mesa (volume) | slider "Volume" | (livro da mesa) > clicar tab "Mesa" > clicar button "/^Som da mesa/" | (do bloco) |
| Mesa: Som da mesa (mudo) | button "Mudo" | (livro da mesa) > clicar tab "Mesa" > clicar button "/^Som da mesa/" | (do bloco) |
| Recolher a página (Esconder a coluna da direita de antes) | button "Recolher a página" | (livro da mesa) | Seta no pé da lombada (feito) |

### Chat do mestre

Parte de: sala fechada. Vai para: Marcador Chat do livro da mesa (feito). Fatia: 4.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Chat sem sala: o convite com Abrir sala (no lugar do "Ir para Jogo") | region "Chat dos jogadores" | (livro da mesa) > clicar tab "Chat" | Página Chat, "O chat abre junto com a sala" + Abrir sala |

### Cenas

Parte de: aventura aberta, livro da mesa. Vai para: Marcador Cenas do livro da mesa (feito). Fatia: 4.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Cripta | button "Cripta" | (livro da mesa) > clicar tab "Cenas" | (do bloco) |
| Renomear Cripta | button "Renomear Cripta" | (livro da mesa) > clicar tab "Cenas" | (do bloco) |
| Mover Cripta para… | button "Mover Cripta para…" | (livro da mesa) > clicar tab "Cenas" | (do bloco) |
| Planta de Cripta | button "Planta de Cripta" | (livro da mesa) > clicar tab "Cenas" | (do bloco) |
| Configurar Cripta | button "Configurar Cripta" | (livro da mesa) > clicar tab "Cenas" | (do bloco) |
| + Nova cena | button "+ Nova cena" | (livro da mesa) > clicar tab "Cenas" | (do bloco) |
| Revisar aventura | button "Revisar aventura" | (livro da mesa) > clicar tab "Cenas" | (do bloco) |
| Mais ações da cena: Duplicar | menuitem "Duplicar" | (livro da mesa) > clicar tab "Cenas" > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: Subir | menuitem "Subir" | (livro da mesa) > clicar tab "Cenas" > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: Descer | menuitem "Descer" | (livro da mesa) > clicar tab "Cenas" > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: É a cena inicial | menuitem "É a cena inicial" | (livro da mesa) > clicar tab "Cenas" > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: Apagar cena… | menuitem "Apagar cena…" | (livro da mesa) > clicar tab "Cenas" > clicar button "Mais ações de Cripta" | (do bloco) |

## Mestre com a sala aberta

### Livro da mesa, sala aberta

Parte de: sala aberta (código ONDE01), página Grupo. Vai para: Livro da mesa: topo da Sala (código, Mais da sala, Laser, Som, Convidar) e página Mesa (feito). Fatia: 4.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Código da sala (copia ao clicar) | button "/^Código da sala ONDE01/" | (livro da mesa) | (do bloco) |
| Laser do mestre | button "Laser" | (livro da mesa) | (do bloco) |
| Som da mesa (pop do botão Som) | slider "Volume" | (livro da mesa) > clicar button "Som" | (do bloco) |
| Grupo | heading "Grupo" | (livro da mesa) > clicar tab "Grupo" | (do bloco) |
| Convidar jogadores: Tornar pública | button "Tornar pública" | (livro da mesa) > clicar button "Convidar" | (do bloco) |
| Convidar jogadores: o pop com o QR, os endereços na rede local e a dica do firewall | dialog "Convidar jogadores" | (livro da mesa) > clicar button "Convidar" | (do bloco) |
| Mais da sala: Visão de jogador | menuitem "Visão de jogador…" | (livro da mesa) > clicar button "Mais da sala" | (do bloco) |
| Mais da sala: Fechar sala | menuitem "Fechar sala…" | (livro da mesa) > clicar button "Mais da sala" | (do bloco) |
| Fechar sala: a confirmação | alertdialog "Fechar a sala?" | (livro da mesa) > clicar button "Mais da sala" > clicar menuitem "Fechar sala…" | (do bloco) |
| Mesa: Teste secreto | button "/^Teste secreto/" | (livro da mesa) > clicar tab "Mesa" | (do bloco) |
| Mesa: Ruído | button "Ruído" | (livro da mesa) > clicar tab "Mesa" > clicar button "/^Ruído/" | (do bloco) |
| Mesa: Alcance do ruído | combobox "Alcance do ruído" | (livro da mesa) > clicar tab "Mesa" > clicar button "/^Ruído/" | (do bloco) |
| Mesa: Diário de viagens | button "/^Diário de viagens/" | (livro da mesa) > clicar tab "Mesa" | (do bloco) |
| Mesa: Tela da mesa, Cena na tela | combobox "Cena na tela" | (livro da mesa) > clicar tab "Mesa" > clicar button "/^Tela da mesa/" | (do bloco) |

## Mestre com jogadores na sala

### Grupo: alto, Chegando, cena e linha

Parte de: sala aberta; Ana na Cripta, Bruno chegando sem ficha, Caio fora. Vai para: Busca com o chip Pedindo; Chegando aberto; cena com Ir à cena, Congelar e Pausar no título; linha com Ir lá e Recado; Congelar todos no pé. Fatia: 5.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Buscar jogador | searchbox "Buscar jogador" | (livro da mesa) | (do bloco) |
| Pedindo (chip do alto) | button "/^Pedindo/" | (livro da mesa) | (do bloco) |
| Chegando: Atribuir a ficha livre | button "/Atribuir Goblin$/" | (livro da mesa) | (do bloco) |
| Chegando: lista Atribuir token | combobox "Atribuir token" | (livro da mesa) | (do bloco) |
| Chegando: Emprestar como ajudante | button "Emprestar como ajudante…" | (livro da mesa) | (do bloco) |
| Chegando: Expulsar | button "Expulsar" | (livro da mesa) | (do bloco) |
| Cena: recolher e abrir | button "/^Cripta.*jogadores/" | (livro da mesa) | (do bloco) |
| Ir à cena Cripta | button "Ir à cena Cripta" | (livro da mesa) | (do bloco) |
| Congelar a cena Cripta | button "Congelar a cena Cripta" | (livro da mesa) | (do bloco) |
| Pausar a cena Cripta | button "Pausar a cena Cripta" | (livro da mesa) | (do bloco) |
| Ir lá: Ana | button "Ir lá: Ana" | (livro da mesa) | (do bloco) |
| Recado para Ana | button "Recado para Ana" | (livro da mesa) | (do bloco) |
| Congelar todos (pé) | button "Congelar todos" | (livro da mesa) | (do bloco) |

### Grupo: ficha de Ana, cada parte do seg

Parte de: Ana jogando na Cripta, ficha aberta. Vai para: Seg Ações · Mochila · Visão · Ficha dentro da ficha aberta. Fatia: 5.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Seguir | button "Seguir" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Mandar para… | button "Mandar para…" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Ver tela de Ana | button "Ver tela de Ana" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Dar o que o grupo viu | button "Dar o que o grupo viu" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Passar o mapa de Ana a | combobox "Passar o mapa de Ana a" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Dar um mapa a Ana | button "Dar um mapa a Ana" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Emprestar como ajudante… | button "Emprestar como ajudante…" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Expulsar | button "Expulsar" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ações" | (do bloco) |
| Dar item a Ana | button "Dar item a Ana" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Mochila" | (do bloco) |
| Moedas de Ana | button "Moedas de Ana" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Mochila" | (do bloco) |
| Propor troca a Ana | button "Propor troca a Ana" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Mochila" | (do bloco) |
| Raio de visão | slider "Raio de visão" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Visão" | (do bloco) |
| Fator de visão | slider "Fator de visão" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Visão" | (do bloco) |
| Revelar planta | button "Revelar planta" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Visão" | (do bloco) |
| Esconder de novo | button "Esconder de novo" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Visão" | (do bloco) |
| Remover Guerreira | button "Remover Guerreira" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ficha" | (do bloco) |
| Atribuir token | combobox "Atribuir token" | (livro da mesa) > clicar button "/Ana — jogando/" > clicar radio "Ficha" | (do bloco) |

### Grupo: ficha de Caio, fora da mesa

Parte de: Caio desconectado com ficha na Cripta, ficha aberta. Vai para: Parte Ações, blocos Ficha e Sair da mesa; parte Ficha. Fatia: 5.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Guardar ficha | button "Guardar ficha" | (livro da mesa) > clicar button "/Caio — jogando/" > clicar radio "Ações" | (do bloco) |
| Emprestar ficha a | combobox "Emprestar ficha a" | (livro da mesa) > clicar button "/Caio — jogando/" > clicar radio "Ações" | (do bloco) |
| Passar fichas e mapa a | combobox "Passar fichas e mapa a" | (livro da mesa) > clicar button "/Caio — jogando/" > clicar radio "Ações" | (do bloco) |
| Dispensar | button "Dispensar" | (livro da mesa) > clicar button "/Caio — jogando/" > clicar radio "Ações" | (do bloco) |
| Remover Ladino | button "Remover Ladino" | (livro da mesa) > clicar button "/Caio — jogando/" > clicar radio "Ficha" | (do bloco) |

### Grupo: pé depois de congelar

Parte de: a mesa congelada pelo Congelar todos. Vai para: Descongelar todos no pé do Grupo. Fatia: 5.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Descongelar todos | button "Descongelar todos" | (livro da mesa) > clicar button "Congelar todos" | (do bloco) |

## Jogador (celular, 390 px)

### Jogador: barra de cima e cantos

Parte de: jogador no celular (390 px), painel fechado. Vai para: Faixa de couro com 4 atalhos + mão flutuante de latão. Fatia: 19.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Painel | button "Painel" | (tela) | (do bloco) |
| Minha ficha | button "Minha ficha" | (tela) | (do bloco) |
| Inventário | button "Inventário" | (tela) | (do bloco) |
| Aproximar | button "Aproximar" | (tela) | (do bloco) |
| Afastar | button "Afastar" | (tela) | (do bloco) |
| Som | button "Som" | (tela) | (do bloco) |
| Chamar o mestre | button "Chamar o mestre" | (tela) | (do bloco) |

### Jogador: aba Jogo

Parte de: jogador no celular, painel aberto. Vai para: Folha com abas: "No mapa" (4 peças), 2 linhas, fichas Comigo, Grupo, Meu personagem, Visão; Sair no rodapé. Fatia: 19.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Jogo | tab "Jogo" | (tela) | (do bloco) |
| Caderno | tab "Caderno" | (tela) | (do bloco) |
| Lugares | tab "Lugares" | (tela) | (do bloco) |
| Dados | tab "Dados" | (tela) | (do bloco) |
| Chat | tab "Chat" | (tela) | (do bloco) |
| Centralizar em Heroi | button "Centralizar em Heroi" | (tela) | (do bloco) |
| Sinalizar | button "Sinalizar" | (tela) | (do bloco) |
| Marcações | button "Marcações" | (tela) | (do bloco) |
| Medir | button "Medir" | (tela) | (do bloco) |
| Laser | button "Laser" | (tela) | (do bloco) |
| Mostrar meu mapa a… | button "Mostrar meu mapa a…" | (tela) | (do bloco) |
| Volto já | button "Volto já" | (tela) | (do bloco) |
| Sair | button "Sair" | (tela) | (do bloco) |
| Comigo | heading "Comigo" | (tela) | (do bloco) |
| Nome | textbox "Nome" | (tela) | (do bloco) |
| Foto | button "Foto" | (tela) | (do bloco) |
| Esconder | button "Esconder" | (tela) | (do bloco) |
| Brilho do explorado 55% | slider "Brilho do explorado 55%" | (tela) | (do bloco) |
| Grade | checkbox "Grade" | (tela) | (do bloco) |
| Nomes | checkbox "Nomes" | (tela) | (do bloco) |
| Câmera segue minha ficha | checkbox "Câmera segue minha ficha" | (tela) | (do bloco) |
| Efeitos do mapa | checkbox "Efeitos do mapa" | (tela) | (do bloco) |

## Fora do spec (e por quê)

| Controle | Por que não está no spec |
|---|---|
| Voltar à cena anterior (seta do chip da cena, fatia 3) | só aparece depois de viajar entre cenas; ChipDaCena.test.tsx cobre |
| Menu Arquivo com imagem de fundo (Trocar imagem, Chão a partir da imagem, Linhas e portas, Recriar minimapa) | só com imagem de fundo; sem ela o item é "Importar imagem de fundo…" (coberto); LivroDoMestre.test.tsx cobre os quatro |
| Configurações do mapa: "Esconder Aventura e Esta cena ao usar ferramenta" (Categorias do painel) | aposentada na fatia 2: Aventura e Cena viraram páginas do livro, e quem tinha a escolha salva não quebra (a chave sai do aparelho) |
| Endireitar na sala ou parede solta | só com traço torto; coberto no desenho |
| Abrir para o corredor (no "Mais ações" da ficha da sala desde a fatia 15) | só com corredor a abrir ou parede encostando na borda da sala; task-abrir-para-o-corredor.spec.ts abre o vão pelo item do menu, e CabecaDaSelecao.abrirCorredor.test.tsx cobre o item apagado com o motivo (sala travada, secreta, uma linha só) |
| Marcas dos jogadores (MarcasDaCena) | só com marcas deixadas por jogadores |
| Visto por / Ninguém vê (abaixo do tipo de ficha), Levar para outra cena (ficha), Rotina e Luzes (cartões de Comportamento) do token | pedem sala aberta, outra cena ou Estado do mundo com valores; PropertiesPanel.ficha.test.tsx abre Rotina e Luzes |
| Vida do token (Vida atual, Vida máxima, Jogadores veem a barra) | saiu da ficha do token na fatia 9 (D); desde a fatia 10 a barra no mapa lê o HP da ficha do sistema ligada no cartão "Personagem" (o ajuste é na própria ficha: "Abrir ficha" > HP). Mestre vê sempre; jogador vê a das fichas de jogador e das que controla, só a proporção. A vida antiga fica no arquivo sem uso. task-jornada-barra-de-vida.spec.ts cobre |
| Livro de regras (página Mesa; e Grupo com a sala fechada) | só com sistema de RPG que tem livro |
| Divisor "Altura das Cenas" (coluna da direita) | saiu na fatia 4: as Cenas viraram uma página do livro da mesa e não há mais altura a repartir; a chave guardada sai do aparelho |
| Grupo do mestre (fatia 5): sob o título de cada cena, o pedido de passagem ("Deixar ir: <nome>", "Não: <nome>") | pede um jogador que viajou até um pino de passagem ligado a outra cena; GrupoCompacto.test.tsx e PartySection.test.tsx alcançam os dois botões sob o título da cena (o resto do Grupo com jogadores está no estado "mestre com jogadores") |
| Teste secreto com jogadores (Teste, Para quem, Pedir teste, Encerrar), na ficha Teste secreto da página Mesa | só com jogadores na sala; sem eles a ficha mostra o aviso e o Pedir teste apagado (coberto) |
| Pausa geral dos NPCs (faixa no alto da página Grupo e "Pausar todos os NPCs" no "Mais da sala") | só com NPC andando; TopoDaSala.test.tsx cobre o item do menu |
| Depende do estado (porta, luz, zona, pino) | só com Estado do mundo criado |
| Item no chão (essencial da ficha do objeto: Nome do item, Quantidade, Pega sem pedir ao mestre) | só com objeto que é item pegável (o estado de teste não tem); ItemNoMapaControls.test.tsx cobre os campos. Desde a fatia 16a o item fica no essencial, e "No mapa" (aberta) segue com Rotação, Travado, Oculto e Camada |
| Jogador: Ficha, Grupo, Meus personagens em outra cena, abas Caderno/Lugares/Dados por dentro | pedem sistema de RPG, colegas ou histórico; as abas estão cobertas |
| Ficha do desenho (fatia 16b): Preenchido e Opacidade da forma (retângulo, elipse) no essencial; com "Paredes ao redor" ligado, Aparência das paredes, cor, Passagem pelas paredes e Soltar, na ficha Paredes | o estado de teste só tem a linha dr1, com as paredes desligadas; FichasDosItens16b.test.tsx cobre a forma e ParedesAoRedorControls.test.tsx cobre as paredes ligadas |
| Ficha da peça de chão (fatia 16b): Voltar à cor do chão, os campos da Borda irregular ligada (Intensidade, Tamanho do dente, Semente) e as medidas das outras formas (raios, Lados, largura em cada ponto, vértices; blocos sem Rotação) | o estado de teste só tem o retângulo f1, sem cor própria nem borda irregular; FichasDosItens16b.test.tsx cobre a cor própria e a borda irregular |
| Ficha da região (fatia 16b): "Mostrar aos jogadores", na ficha Gatilho | só aparece com um gatilho escolhido (a região r1 não tem); AreaTriggerControls.test.tsx cobre |
| Acervo (fatia 18b): o "+" que põe no centro da vista ("Pôr <nome> no centro do mapa"), na linha do token e no cartão do item | pedem um token guardado no acervo do disco do app e um item no acervo de itens, que o estado de teste não tem; TokenLibraryPanel.linhas.test.tsx e AcervoDeItensPanel.test.tsx alcançam os dois botões, e task-jornada-item-do-acervo-no-mapa.spec.ts põe o item no mapa por ele e confere na tela |
| Ficha da escada (fatia 16b): o Diâmetro da espiral e o "Revelar para" da escada secreta | pedem escada espiral, ou escada secreta com a sala aberta; FichasDosItens16b.test.tsx e StairControls.tamanho.test.tsx cobrem o Diâmetro, RevealToControls.test.tsx cobre o Revelar para |

Total: 661 controles em 70 blocos.
