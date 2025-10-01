// server.js
const express = require('express');
const sql = require('mssql');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuração de Conexão com o SQL Server
// **ATENÇÃO:** Mude estas credenciais para as suas!
const config = {
    user: 'SA', // Seu nome de usuário
    password: '123qwe4r', // Sua senha
    server: 'DESKTOP-LBE34BN', // Endereço do seu SQL Server
    database: 'EstoqueDB', // O nome do banco de dados
    options: {  
        encrypt: false, 
        trustServerCertificate: true 
    }
};

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

// Conexão com o banco de dados
const pool = new sql.ConnectionPool(config);
let isConnected = false;

// Função de Conexão
async function connectDb() {
    try {
        await pool.connect();
        isConnected = true;
        console.log("Conectado ao SQL Server!");
    } catch (err) {
        console.error("Erro ao conectar ao SQL Server:", err.message);
        setTimeout(connectDb, 5000); 
    }
}

connectDb();

// Middleware de verificação de conexão
app.use((req, res, next) => {
    if (!isConnected) {
        return res.status(503).json({ erro: 'Serviço indisponível. Conexão com o banco de dados falhou.' });
    }
    next();
});

// =========================================================
//                  PRODUTOS CRUD 
// =========================================================

app.get('/api/produtos', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM Produtos ORDER BY Id DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/produtos', async (req, res) => {
    const { codigo, nome, categoria, quantidade, preco } = req.body;
    try {
        const request = pool.request();
        request.input('codigo', sql.VarChar, codigo);
        request.input('nome', sql.VarChar, nome);
        request.input('categoria', sql.VarChar, categoria);
        request.input('quantidade', sql.Int, quantidade);
        request.input('preco', sql.Decimal(10, 2), preco);

        const query = `
            INSERT INTO Produtos (Codigo, Nome, Categoria, Quantidade, Preco, DataAtualizacao) 
            VALUES (@codigo, @nome, @categoria, @quantidade, @preco, GETDATE());
            SELECT SCOPE_IDENTITY() AS id;
        `;
        const result = await request.query(query);
        const novoId = result.recordset[0].id;

        res.status(201).json({ id: novoId, ...req.body });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.put('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    const { codigo, nome, categoria, quantidade, preco } = req.body;
    
    try {
        const request = pool.request();
        request.input('id', sql.Int, id);
        request.input('codigo', sql.VarChar, codigo);
        request.input('nome', sql.VarChar, nome);
        request.input('categoria', sql.VarChar, categoria);
        request.input('quantidade', sql.Int, quantidade);
        request.input('preco', sql.Decimal(10, 2), preco);

        const query = `
            UPDATE Produtos 
            SET Codigo = @codigo, Nome = @nome, Categoria = @categoria, 
                Quantidade = @quantidade, Preco = @preco, DataAtualizacao = GETDATE()
            WHERE Id = @id;
        `;
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }
        res.json({ mensagem: 'Produto atualizado com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const request = pool.request();
        request.input('id', sql.Int, id);

        const query = 'DELETE FROM Produtos WHERE Id = @id';
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }
        res.json({ mensagem: 'Produto excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// =========================================================
//                  CATEGORIAS ENDPOINTS
// =========================================================

app.get('/api/categorias', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM Categorias ORDER BY Nome ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/categorias', async (req, res) => {
    const { nome } = req.body;
    try {
        const request = pool.request();
        request.input('nome', sql.NVarChar, nome);

        const query = `
            INSERT INTO Categorias (Nome) 
            VALUES (@nome);
            SELECT SCOPE_IDENTITY() AS id;
        `;
        const result = await request.query(query);
        const novoId = result.recordset[0].id;

        res.status(201).json({ id: novoId, nome: nome });
    } catch (err) {
        if (err.message.includes('UNIQUE KEY constraint')) {
            return res.status(409).json({ erro: 'Categoria já existe.' });
        }
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/categorias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const request = pool.request();
        request.input('id', sql.Int, id);

        const query = 'DELETE FROM Categorias WHERE Id = @id';
        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ erro: 'Categoria não encontrada.' });
        }
        res.json({ mensagem: 'Categoria excluída com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// =========================================================
//                  MOVIMENTAÇÃO ENDPOINTS (COM PREÇO)
// =========================================================

// POST /api/movimentacao: Registrar movimentação
app.post('/api/movimentacao', async (req, res) => {
    const { tipo, produtoId, quantidade } = req.body; 

    if (!['entrada', 'saida'].includes(tipo)) {
        return res.status(400).json({ erro: 'Tipo de movimentação inválido.' });
    }

    try {
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        // 1. Obter Preço e Quantidade Atuais do Produto
        const productCheckRequest = new sql.Request(transaction);
        productCheckRequest.input('pId', sql.Int, produtoId);
        const productResult = await productCheckRequest
            .query('SELECT Nome, Quantidade, Preco FROM Produtos WHERE Id = @pId');
        
        if (productResult.recordset.length === 0) {
             await transaction.rollback();
             return res.status(404).json({ erro: 'Produto não encontrado.' });
        }

        const { Nome: produtoNome, Quantidade: currentStock, Preco: currentPrice } = productResult.recordset[0];
        
        let precoUnitario = null;
        const operador = tipo === 'entrada' ? '+' : '-';
        
        if (tipo === 'saida') {
             if (currentStock < quantidade) {
                 await transaction.rollback();
                 return res.status(400).json({ erro: 'ERRO: Quantidade insuficiente em estoque!' });
             }
             // O preço unitário é o preço atual do produto
             precoUnitario = currentPrice; 
        }

        // 2. Atualizar a quantidade no Produtos
        const updateRequest = new sql.Request(transaction);
        updateRequest.input('produtoId', sql.Int, produtoId);
        updateRequest.input('quantidade', sql.Int, quantidade);
        
        const updateQuery = `
            UPDATE Produtos 
            SET Quantidade = Quantidade ${operador} @quantidade, DataAtualizacao = GETDATE()
            WHERE Id = @produtoId
        `;
        await updateRequest.query(updateQuery);

        // 3. Registrar a movimentação
        const insertMovRequest = new sql.Request(transaction);
        insertMovRequest.input('produtoId', sql.Int, produtoId);
        insertMovRequest.input('tipo', sql.VarChar, tipo);
        insertMovRequest.input('quantidade', sql.Int, quantidade);
        // Salva o preço unitário (NULL para entrada, Preco do Produto para saída)
        insertMovRequest.input('precoUnitario', sql.Decimal(10, 2), precoUnitario); 
        
        const insertMovQuery = `
            INSERT INTO Movimentacoes (ProdutoId, Tipo, Quantidade, PrecoUnitario) 
            VALUES (@produtoId, @tipo, @quantidade, @precoUnitario);
        `;
        await insertMovRequest.query(insertMovQuery);
        
        await transaction.commit();
        
        const produtoResultFinal = await pool.request()
            .input('id', sql.Int, produtoId)
            .query('SELECT Quantidade FROM Produtos WHERE Id = @id');

        res.json({ 
            mensagem: `${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada!`, 
            produtoNome: produtoNome, 
            novaQuantidade: produtoResultFinal.recordset[0].Quantidade
        });

    } catch (err) {
        if (transaction && transaction.inTransaction) {
            await transaction.rollback();
        }
        res.status(500).json({ erro: err.message });
    }
});

// GET /api/movimentacoes: Listar as últimas movimentações
app.get('/api/movimentacoes', async (req, res) => {
    try {
        const query = `
            SELECT TOP 20
                M.Id,               
                M.Data,
                P.Nome as ProdutoNome,
                M.Tipo,
                M.Quantidade,
                M.PrecoUnitario 
            FROM Movimentacoes M
            INNER JOIN Produtos P ON M.ProdutoId = P.Id
            ORDER BY M.Data DESC
        `;
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// DELETE /api/movimentacoes/:id: Excluir uma movimentação (Com Reversão)
app.delete('/api/movimentacoes/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        const movRequest = new sql.Request(transaction);
        movRequest.input('movId', sql.Int, id);

        // 1. Obter detalhes da movimentação
        const movResult = await movRequest.query('SELECT ProdutoId, Tipo, Quantidade FROM Movimentacoes WHERE Id = @movId');
        
        if (movResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ erro: 'Movimentação não encontrada.' });
        }

        const { ProdutoId, Tipo, Quantidade } = movResult.recordset[0];

        // 2. Determinar a operação de REVERSÃO
        // Se for uma entrada, a exclusão é uma subtração no estoque (-).
        // Se for uma saída, a exclusão é uma adição no estoque (+).
        const operador = Tipo === 'entrada' ? '-' : '+'; 
        const operacaoNome = Tipo === 'entrada' ? 'subtração' : 'adição'; 
        
        // 3. Reverter a quantidade no Produtos
        const updateRequest = new sql.Request(transaction);
        updateRequest.input('produtoId', sql.Int, ProdutoId);
        updateRequest.input('quantidade', sql.Int, Quantidade);
        
        // Antes de reverter a saída, verifica se o estoque atual é suficiente
        if (Tipo === 'saida') {
             const stockCheckRequest = new sql.Request(transaction);
             stockCheckRequest.input('produtoId', sql.Int, ProdutoId);
             const stockResult = await stockCheckRequest.query('SELECT Quantidade FROM Produtos WHERE Id = @produtoId');
             const currentStock = stockResult.recordset[0].Quantidade;
             
             // O estoque pode ficar negativo se a saída original já levou ele a 0 ou menos, 
             // mas estamos fazendo uma reversão (adição), então não precisamos de checagem.
             // Se fosse uma reversão de entrada (subtração), a checagem seria necessária.
             // Para a reversão de ENTRADA (operação -), precisamos checar se o estoque atual cobre.
             if (Tipo === 'entrada' && currentStock < Quantidade) {
                  await transaction.rollback();
                  return res.status(400).json({ erro: 'ERRO: Estoque insuficiente para reverter a entrada (produto ficaria negativo).' });
             }
        }
        
        const updateQuery = `
            UPDATE Produtos 
            SET Quantidade = Quantidade ${operador} @quantidade, DataAtualizacao = GETDATE()
            WHERE Id = @produtoId
        `;
        await updateRequest.query(updateQuery);

        // 4. Excluir o registro da movimentação
        const deleteRequest = new sql.Request(transaction);
        deleteRequest.input('movId', sql.Int, id);
        const deleteQuery = 'DELETE FROM Movimentacoes WHERE Id = @movId';
        await deleteRequest.query(deleteQuery);

        await transaction.commit();
        
        res.json({ mensagem: `Movimentação excluída e estoque revertido com sucesso. (Operação: ${operacaoNome})` });

    } catch (err) {
        if (transaction && transaction.inTransaction) {
            await transaction.rollback();
        }
        res.status(500).json({ erro: `Erro ao reverter movimentação: ${err.message}` });
    }
});

// =========================================================
//                      ROTA DE EXPORTAÇÃO PARA CSV
// =========================================================

// Rota para exportar dados de produtos como CSV
app.get('/api/produtos/exportar', async (req, res) => {
    if (!isConnected) {
        return res.status(503).json({ erro: 'Servidor indisponível. Banco de dados desconectado.' });
    }
    
    try {
        const request = pool.request();
        // Consulta que retorna todos os dados de Produtos
        const result = await request.query(`
            SELECT 
                Id, 
                Codigo, 
                Nome, 
                Categoria, 
                Quantidade, 
                Preco, 
                DataCriacao, 
                DataAtualizacao 
            FROM Produtos
            ORDER BY Nome
        `);

        const data = result.recordset;

        if (data.length === 0) {
            return res.status(404).json({ mensagem: 'Nenhum produto encontrado para exportação.' });
        }

        // 1. Definir os cabeçalhos do CSV (colunas)
        const headers = ['Id', 'Codigo', 'Nome', 'Categoria', 'Quantidade', 'Preco', 'DataCriacao', 'DataAtualizacao'];
        // Usamos ponto e vírgula (;) como delimitador para compatibilidade com o Excel em PT-BR
        let csv = headers.join(';') + '\n'; 

        // 2. Mapear os dados para linhas do CSV
        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header] === null || row[header] === undefined ? '' : row[header];

                // Formatar valores para CSV
                if (typeof value === 'string') {
                    // Escapar aspas duplas e envolver com aspas se necessário
                    value = value.replace(/"/g, '""'); 
                    if (value.includes(';') || value.includes('\n') || value.includes('"')) {
                        value = `"${value}"`; 
                    }
                } else if (value instanceof Date) {
                    value = value.toLocaleString('pt-BR'); // Formatar data/hora
                } else if (typeof value === 'number') {
                     // Formatar números decimais (ponto para vírgula)
                    value = String(value).replace('.', ','); 
                }
                
                return value;
            });
            csv += values.join(';') + '\n';
        });

        // 3. Enviar a resposta com os headers corretos para download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="produtos_estoque.csv"');
        // O Byte Order Mark (BOM) é crucial para que o Excel interprete UTF-8 corretamente
        const bom = '\ufeff'; 
        res.send(bom + csv);

    } catch (err) {
        console.error('Erro ao exportar produtos:', err);
        res.status(500).json({ erro: 'Erro interno do servidor ao exportar os dados.' });
    }
});

    


// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}/index.html`);
});