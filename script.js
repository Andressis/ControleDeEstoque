// Sistema de Gerenciamento de Estoque com API (Node/SQL)
class EstoqueManager {
    constructor() {
        this.produtos = [];
        this.categorias = [];
        this.movimentacoes = [];
        this.itemParaExcluir = { tipo: null, id: null, nome: null };
        this.editandoProduto = false;
        this.init();
    }

    async init() {
        await this.carregarTudo();
        this.setupEventListeners();
        this.showTab('resumo');
    }

    async carregarTudo() {
        await this.carregarProdutos();
        await this.carregarCategorias();
        await this.carregarMovimentacoes();
        this.atualizarInterface();
    }

    // =========================================================
    //                      COMUNICAÇÃO COM API
    // =========================================================

    async carregarProdutos() {
        try {
            const response = await fetch('/api/produtos');
            this.produtos = await response.json();
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            this.produtos = [];
        }
    }

    async carregarCategorias() {
        try {
            const response = await fetch('/api/categorias');
            this.categorias = await response.json();
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
            this.categorias = [];
        }
    }
    
    async carregarMovimentacoes() {
        try {
            const response = await fetch('/api/movimentacoes');
            this.movimentacoes = await response.json();
        } catch (error) {
            console.error('Erro ao carregar movimentações:', error);
            this.movimentacoes = [];
        }
    }

    // =========================================================
    //                      PRODUTOS CRUD
    // =========================================================

    async salvarProduto() {
        const id = document.getElementById('produto-id').value;
        const produto = {
            codigo: document.getElementById('codigo').value,
            nome: document.getElementById('nome').value,
            categoria: document.getElementById('categoria').value,
            quantidade: parseInt(document.getElementById('quantidade').value) || 0, 
            preco: parseFloat(document.getElementById('preco').value) || 0.00 
        };

        try {
            let response;
            if (this.editandoProduto && id) {
                response = await fetch(`/api/produtos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(produto)
                });
            } else {
                response = await fetch('/api/produtos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(produto)
                });
            }
            
            if (response.ok) {
                await this.carregarProdutos();
                this.cancelarEdicao();
                this.atualizarInterface();
            } else {
                const erro = await response.json();
                alert(`Erro ao salvar produto: ${erro.erro}`);
            }

        } catch (error) {
            console.error('Erro de rede ao salvar produto:', error);
            alert('Erro de rede. Verifique a conexão com o servidor.');
        }
    }
    
    iniciarEdicao(id) {
        const produto = this.produtos.find(p => p.Id === id); 
        if (!produto) {
            console.error('Produto não encontrado para edição:', id);
            return;
        }

        this.editandoProduto = true;
        
        document.getElementById('produto-id').value = produto.Id;
        document.getElementById('codigo').value = produto.Codigo; 
        document.getElementById('nome').value = produto.Nome; 
        
        this.atualizarSelectCategoriasProduto(produto.Categoria); 
        
        document.getElementById('quantidade').value = produto.Quantidade;
        document.getElementById('preco').value = produto.Preco;

        document.getElementById('form-title').textContent = 'Editar Produto';
        document.getElementById('btn-salvar').textContent = 'Salvar Alterações';
        document.getElementById('btn-cancelar').style.display = 'block';

        this.showTab('produtos');
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    }

    cancelarEdicao() {
        this.editandoProduto = false;
        this.limparFormulario('produto-form');
        
        document.getElementById('form-title').textContent = 'Adicionar Novo Produto';
        document.getElementById('btn-salvar').textContent = 'Adicionar Produto';
        document.getElementById('btn-cancelar').style.display = 'none';
        
        this.atualizarSelectCategoriasProduto(); 
    }

    // =========================================================
    //                      CATEGORIAS CRUD
    // =========================================================

    async salvarCategoria() {
        const nome = document.getElementById('nova-categoria-nome').value.trim();
        if (!nome) return;

        try {
            const response = await fetch('/api/categorias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome })
            });
            
            if (response.ok) {
                document.getElementById('nova-categoria-nome').value = '';
                await this.carregarCategorias();
                this.atualizarInterface();
            } else {
                const erro = await response.json();
                alert(`Erro ao adicionar categoria: ${erro.erro}`);
            }

        } catch (error) {
            console.error('Erro de rede ao salvar categoria:', error);
            alert('Erro de rede. Verifique a conexão com o servidor.');
        }
    }

    // =========================================================
    //                      MOVIMENTAÇÃO
    // =========================================================

    async registrarMovimentacao(tipo) {
        const produtoId = document.getElementById(`${tipo}-produto-id`).value;
        const quantidade = parseInt(document.getElementById(`${tipo}-quantidade`).value);
        
        if (!produtoId || isNaN(quantidade) || quantidade <= 0) {
            alert('Selecione um produto e insira uma quantidade válida.');
            return;
        }

        try {
            const response = await fetch('/api/movimentacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, produtoId: parseInt(produtoId), quantidade })
            });

            if (response.ok) {
                const data = await response.json();
                alert(data.mensagem);
                this.limparFormulario(`form-${tipo}`);
                await this.carregarTudo();
            } else {
                const erro = await response.json();
                alert(`Erro ao registrar movimentação: ${erro.erro}`);
            }
        } catch (error) {
            console.error('Erro de rede ao registrar movimentação:', error);
            alert('Erro de rede. Verifique a conexão com o servidor.');
        }
    }

    // =========================================================
    //                      INTERFACE
    // =========================================================

    atualizarInterface() {
        this.atualizarTabelaProdutos();
        this.atualizarResumo();
        this.atualizarProdutosBaixoEstoque();
        this.atualizarSelectsMovimentacao();
        this.atualizarSelectCategoriasProduto(); 
        this.atualizarTabelaCategorias(); 
        this.atualizarTabelaMovimentacoes(); 
    }
    
    atualizarTabelaMovimentacoes() {
        const tbody = document.getElementById('movimentacao-tbody');
        if (!tbody) return;
        
        const formatDateTime = (dateString) => {
            const options = { 
                year: 'numeric', month: 'numeric', day: 'numeric', 
                hour: '2-digit', minute: '2-digit'
            };
            return new Date(dateString).toLocaleDateString('pt-BR', options);
        };

        const formatCurrency = (value) => {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(value || 0); 
        };
        
        tbody.innerHTML = this.movimentacoes.map(mov => {
            
            // Lógica para calcular o Valor Total: (Preço Unitário * Quantidade)
            // Usa PrecoUnitario (que é NULL para entrada) ou 0 se for nulo.
            const precoUnitario = mov.PrecoUnitario || 0; 
            const valorTotal = mov.Tipo === 'saida' ? precoUnitario * mov.Quantidade : 0;
            
            // Exibição do preço e valor total (apenas para saída)
            const displayPreco = mov.Tipo === 'saida' ? formatCurrency(precoUnitario) : '-';
            const displayTotal = mov.Tipo === 'saida' ? formatCurrency(valorTotal) : '-';

            const movNomeParaExcluir = `Mov. ${mov.Tipo.toUpperCase()} de ${mov.Quantidade}x ${mov.ProdutoNome}`;

            return `
                <tr>
                    <td>${formatDateTime(mov.Data)}</td>
                    <td>${mov.ProdutoNome}</td>
                    <td><span class="status ${mov.Tipo === 'entrada' ? 'disponivel' : 'esgotado'}">${mov.Tipo.charAt(0).toUpperCase() + mov.Tipo.slice(1)}</span></td>
                    <td>${mov.Tipo === 'saida' ? '-' : '+'}${mov.Quantidade}</td>
                    <td>${displayPreco}</td>   
                    <td>${displayTotal}</td>   
                    <td>
                        <button class="btn-action btn-delete" 
                            onclick="estoqueManager.confirmarExclusao('movimentacao', ${mov.Id}, '${movNomeParaExcluir}')">
                            Excluir
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    atualizarTabelaProdutos() {
        const tbody = document.getElementById('produtos-tbody');
        if (!tbody) return;

        tbody.innerHTML = this.produtos.map(produto => `
            <tr>
                <td>${produto.Codigo}</td>
                <td>${produto.Nome}</td>
                <td>${produto.Categoria}</td>
                <td>${produto.Quantidade}</td>
                <td>${this.formatCurrency(produto.Preco)}</td>
                <td><span class="status ${this.getStatusClass(produto.Quantidade)}">${this.getStatusText(produto.Quantidade)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="estoqueManager.iniciarEdicao(${produto.Id})">Editar</button>
                        <button class="btn-action btn-delete" onclick="estoqueManager.confirmarExclusao('produto', ${produto.Id}, '${produto.Nome}')">Excluir</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    atualizarSelectCategoriasProduto(categoriaSelecionada = '') {
        const select = document.getElementById('categoria');
        if (!select) return;

        const options = this.categorias.map(c => 
            `<option value="${c.Nome}" ${c.Nome === categoriaSelecionada ? 'selected' : ''}>${c.Nome}</option>`
        ).join('');
        
        const defaultOption = '<option value="">Selecione uma categoria</option>';
        select.innerHTML = defaultOption + options;
        
        if (categoriaSelecionada) {
             select.value = categoriaSelecionada;
        } else if (select.value === '') {
            select.value = '';
        }
    }
    
    atualizarTabelaCategorias() {
        const tbody = document.getElementById('categorias-tbody');
        if (!tbody) return;

        tbody.innerHTML = this.categorias.map(categoria => `
            <tr>
                <td>${categoria.Nome}</td>
                <td>
                    <button class="btn-action btn-delete" onclick="estoqueManager.confirmarExclusao('categoria', ${categoria.Id}, '${categoria.Nome}')">Excluir</button>
                </td>
            </tr>
        `).join('');
    }

    atualizarResumo() {
        const summaryCards = document.getElementById('summary-cards');
        if (!summaryCards) return;

        const stats = this.calcularEstatisticas();
        
        summaryCards.innerHTML = `
            <div class="summary-card">
                <h3>${stats.total}</h3>
                <p>Total de Produtos</p>
            </div>
            <div class="summary-card">
                <h3>${stats.baixoEstoque}</h3>
                <p>Estoque Baixo</p>
            </div>
            <div class="summary-card">
                <h3>${stats.esgotados}</h3>
                <p>Produtos Esgotados</p>
            </div>
            <div class="summary-card">
                <h3>${this.formatCurrency(stats.valorTotal)}</h3>
                <p>Valor Total</p>
            </div>
        `;

        const alert = document.querySelector('.alert-warning');
        if (alert) {
            alert.innerHTML = `<strong>Atenção!</strong> Você tem ${stats.baixoEstoque} produtos com estoque baixo.`;
        }
    }

    atualizarProdutosBaixoEstoque() {
        const tbody = document.getElementById('produtos-baixo-tbody');
        if (!tbody) return;

        const produtosBaixo = this.produtos.filter(p => p.Quantidade > 0 && p.Quantidade <= 10);
        
        tbody.innerHTML = produtosBaixo.map(produto => `
            <tr>
                <td>${produto.Codigo}</td>
                <td>${produto.Nome}</td>
                <td>${produto.Quantidade}</td>
                <td><span class="status ${this.getStatusClass(produto.Quantidade)}">${this.getStatusText(produto.Quantidade)}</span></td>
            </tr>
        `).join('');
    }

    atualizarSelectsMovimentacao() {
        const selects = document.querySelectorAll('#movimentacao select');
        const options = this.produtos.map(p => `<option value="${p.Id}">${p.Nome}</option>`).join('');
        
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Selecione um produto</option>' + options;
            select.value = currentValue;
        });
    }

    // =========================================================
    //                      EXCLUSÃO GENÉRICA
    // =========================================================
    
    confirmarExclusao(tipo, id, nome) {
        this.itemParaExcluir = { tipo, id, nome };
        const modalMensagem = document.getElementById('modal-mensagem-exclusao');
        
        if (tipo === 'produto') {
            modalMensagem.textContent = `Tem certeza que deseja excluir o produto "${nome}"? Esta ação é irreversível.`;
        } else if (tipo === 'categoria') {
            modalMensagem.textContent = `ATENÇÃO: Excluir a categoria "${nome}" pode causar problemas se houver produtos vinculados. Tem certeza?`;
        } else if (tipo === 'movimentacao') {
             // MENSAGEM AJUSTADA PARA REFLETIR A REVERSÃO DO ESTOQUE
             modalMensagem.textContent = `ATENÇÃO: Você irá excluir a transação: "${nome}". Isso **reverterá a quantidade** no estoque. Tem certeza?`; 
        }
        
        document.getElementById('modal-confirmacao').style.display = 'block';
    }

    async excluirConfirmado() {
        const { tipo, id } = this.itemParaExcluir;
        
        if (tipo === 'produto') {
            await this.excluirItem('/api/produtos', id);
        } else if (tipo === 'categoria') {
            await this.excluirItem('/api/categorias', id);
        } else if (tipo === 'movimentacao') {
            // A API de movimentação fará a reversão do estoque.
            await this.excluirItem('/api/movimentacoes', id); 
        }
        
        await this.carregarTudo(); 
        this.fecharModal();
        this.atualizarInterface();
    }
    
    async excluirItem(apiEndpoint, id) {
        try {
            const response = await fetch(`${apiEndpoint}/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                 const data = await response.json();
                 alert(data.mensagem);
            } else {
                const erro = await response.json();
                alert(`Erro ao excluir: ${erro.erro}`);
            }
        } catch (error) {
            console.error('Erro de rede ao excluir:', error);
            alert('Erro de rede. Verifique a conexão com o servidor.');
        }
    }

    fecharModal() {
        document.getElementById('modal-confirmacao').style.display = 'none';
        this.itemParaExcluir = { tipo: null, id: null, nome: null };
    }


    // =========================================================
    //                      UTILIDADES
    // =========================================================

    calcularEstatisticas() {
        return {
            total: this.produtos.length,
            baixoEstoque: this.produtos.filter(p => p.Quantidade > 0 && p.Quantidade <= 10).length,
            esgotados: this.produtos.filter(p => p.Quantidade === 0).length,
            valorTotal: this.produtos.reduce((total, p) => total + (p.Quantidade * p.Preco), 0)
        };
    }

    getStatusClass(quantidade) {
        if (quantidade === 0) return 'esgotado';
        if (quantidade <= 10) return 'baixo';
        return 'disponivel';
    }

    getStatusText(quantidade) {
        if (quantidade === 0) return 'Esgotado';
        if (quantidade <= 10) return 'Estoque Baixo';
        return 'Disponível';
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    limparFormulario(formId) {
        document.getElementById(formId).reset();
        if (formId === 'produto-form') {
            document.getElementById('produto-id').value = '';
            document.getElementById('categoria').value = '';
        }
    }

    buscarProdutos(termo) {
        const tbody = document.getElementById('produtos-tbody');
        const rows = tbody.getElementsByTagName('tr');
        
        for (let i = 0; i < rows.length; i++) {
            const nome = rows[i].getElementsByTagName('td')[1];
            if (nome) {
                const texto = nome.textContent.toLowerCase();
                if (texto.includes(termo.toLowerCase())) {
                    rows[i].style.display = '';
                } else {
                    rows[i].style.display = 'none';
                }
            }
        }
    }

    showTab(tabName) {
        const contents = document.getElementsByClassName('tab-content');
        for (let i = 0; i < contents.length; i++) {
            contents[i].classList.remove('active');
        }
        
        const buttons = document.getElementsByClassName('tab-button');
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].classList.remove('active');
        }
        
        document.getElementById(tabName).classList.add('active');
        
        const targetButton = Array.from(buttons).find(btn => 
            btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`showTab('${tabName}')`)
        );
        if (targetButton) {
            targetButton.classList.add('active');
        }
        
        this.atualizarInterface();
    }

    setupEventListeners() {
        const produtoForm = document.getElementById('produto-form');
        if (produtoForm) {
            produtoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarProduto();
            });
        }
        
        const categoriaForm = document.getElementById('categoria-form');
        if (categoriaForm) {
            categoriaForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarCategoria();
            });
        }
        
        const formEntrada = document.getElementById('form-entrada');
        if (formEntrada) {
            formEntrada.addEventListener('submit', (e) => {
                e.preventDefault();
                this.registrarMovimentacao('entrada');
            });
        }

        const formSaida = document.getElementById('form-saida');
        if (formSaida) {
            formSaida.addEventListener('submit', (e) => {
                e.preventDefault();
                this.registrarMovimentacao('saida');
            });
        }

        const searchBox = document.querySelector('.search-box');
        if (searchBox) {
            searchBox.addEventListener('keyup', (e) => {
                this.buscarProdutos(e.target.value);
            });
        }

        const modal = document.getElementById('modal-confirmacao');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.fecharModal();
                }
            });
        }
    }
}

// Instância global
let estoqueManager;

// Funções globais para compatibilidade
function showTab(tabName) {
    estoqueManager.showTab(tabName);
}

function cancelarEdicao() {
    estoqueManager.cancelarEdicao();
}

function excluirConfirmado() {
    estoqueManager.excluirConfirmado();
}

function fecharModal() {
    estoqueManager.fecharModal();
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    estoqueManager = new EstoqueManager();
});