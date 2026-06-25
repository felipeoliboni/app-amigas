# Amigas do Bem - Controle de Estoque

Sistema de Controle de Estoque Mobile-Friendly projetado para gerenciar o enxoval e produtos do projeto **Amigas do Bem**. Desenvolvido com foco na usabilidade mobile, responsividade e rapidez de uso.

## 🚀 Funcionalidades

- **Dashboard Principal**: Métricas resumidas de estoque, lista detalhada de peças e botão de exportação.
- **Exportação de PDF**: Botão integrado para gerar relatórios profissionais do estoque atualizado em formato PDF.
- **Controle por Tamanhos**: Suporte inteligente a categorias de enxoval que exigem tamanhos (PP, P, M, G, GG) ou tamanho Único (U).
- **Aba de Saídas**:
  - Cadastro rápido de novas saídas de itens com desconto automático do estoque físico.
  - Exibição de estoque disponível dinamicamente ao selecionar o produto/tamanho.
  - Histórico de retiradas/saídas cronológico e visual.
- **Controle de Estoque Rápido**: Ajustes rápidos de entrada (+1/-1) ou inserção de quantidades personalizadas na aba Estoque.
- **Modo Offline (PWA)**: Preparado com Service Worker para acesso offline básico.

## 🛠️ Stack Tecnológica

- **Backend**: Node.js com Express
- **Banco de Dados**: SQLite3 (armazenado localmente em `estoque.db`)
- **Frontend**: HTML5, Vanilla CSS3 (Design System responsivo) e Javascript nativo (ES6)
- **Biblioteca PDF**: jsPDF com plugin jsPDF-AutoTable

## 📂 Estrutura do Projeto

* `server.js` — Servidor Express com as APIs REST de gerenciamento.
* `db.js` — Conexão, utilitários de Promises e inicialização do banco SQLite.
* `schema.sql` — Estrutura de tabelas e sementes iniciais de categorias e produtos.
* `public/` — Arquivos do cliente (HTML, CSS, JS e Assets).
  * `index.html` — Estrutura de telas e abas da aplicação.
  * `app.js` — Controlador de estado frontend, chamadas de API e geração de relatórios.
  * `style.css` — Estilização moderna inspirada na marca.

## ⚙️ Instalação e Execução

### Pré-requisitos
* Node.js instalado (versão 18 ou superior recomendada)

### Executar a Aplicação

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor:
   ```bash
   npm start
   ```
   Ou inicie em modo desenvolvimento (watch mode):
   ```bash
   npm run dev
   ```

3. Acesse no navegador:
   [http://localhost:3000](http://localhost:3000)

## 🗄️ Esquema do Banco de Dados

* **categories**: Categorias de enxoval (ex: Conjuntos, Toucas, Mantas).
* **items**: Itens individuais cadastrados sob uma categoria.
* **stock**: Controle do estoque disponível físico agrupado por `item_id` e `size`.
* **stock_history**: Histórico completo de movimentações de entrada (`IN`) e saída (`OUT`).
