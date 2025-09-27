-- Criar Banco
CREATE DATABASE EstoqueDB;
GO
USE EstoqueDB;
GO

-- ==============================
-- Tabela de Produtos
-- ==============================
IF OBJECT_ID('Produtos', 'U') IS NOT NULL DROP TABLE Produtos;
GO

CREATE TABLE Produtos (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL UNIQUE,
    Nome NVARCHAR(100) NOT NULL,
    Categoria NVARCHAR(50) NOT NULL,
    Quantidade INT NOT NULL DEFAULT 0,
    Preco DECIMAL(10,2) NOT NULL CHECK (Preco >= 0),
    DataCriacao DATETIME NOT NULL DEFAULT GETDATE(),
    DataAtualizacao DATETIME NULL
);
GO

-- Índice para buscas por nome
CREATE INDEX IX_Produtos_Nome ON Produtos(Nome);

-- ==============================
-- Tabela de Movimentações
-- ==============================
IF OBJECT_ID('Movimentacoes', 'U') IS NOT NULL DROP TABLE Movimentacoes;
GO

CREATE TABLE Movimentacoes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProdutoId INT NOT NULL,
    Tipo VARCHAR(10) NOT NULL CHECK (Tipo IN ('entrada','saida')),
    Quantidade INT NOT NULL CHECK (Quantidade > 0),
    PrecoUnitario DECIMAL(10,2) NULL, -- NOVO CAMPO para registrar o preço de venda na saída
    Data DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Movimentacoes_Produtos FOREIGN KEY (ProdutoId) 
        REFERENCES Produtos(Id) ON DELETE CASCADE
);
GO

-- Índice para relatórios rápidos por produto e data
CREATE INDEX IX_Movimentacoes_ProdutoId ON Movimentacoes(ProdutoId, Data DESC);

-- ==============================
-- Tabela de Categorias
-- ==============================
IF OBJECT_ID('Categorias', 'U') IS NOT NULL DROP TABLE Categorias;
GO

CREATE TABLE Categorias (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Nome NVARCHAR(50) UNIQUE NOT NULL
);

-- Inserir categorias padrão
INSERT INTO Categorias (Nome) VALUES 
('Material Escolar'), ('Escritório'), ('Limpeza');
GO

-- Use o banco de dados correto
USE EstoqueDB;
GO

-- 1. Alterar a tabela Movimentacoes para incluir o PrecoUnitario (se ela já existe)
IF EXISTS(SELECT * FROM sys.columns 
          WHERE Name = N'PrecoUnitario' AND Object_ID = Object_ID(N'Movimentacoes'))
BEGIN
    -- Se a coluna já existe, não precisa fazer nada.
    PRINT 'Coluna PrecoUnitario já existe.'
END
ELSE
BEGIN
    -- Se a coluna não existe, adiciona ela.
    ALTER TABLE Movimentacoes 
    ADD PrecoUnitario DECIMAL(10,2) NULL; 
    
    PRINT 'Coluna PrecoUnitario adicionada.'
END
GO

IF OBJECT_ID('Produtos', 'U') IS NOT NULL DROP TABLE Produtos;
GO
CREATE TABLE Produtos (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL UNIQUE,
    Nome NVARCHAR(100) NOT NULL,
    Categoria NVARCHAR(50) NOT NULL,
    Quantidade INT NOT NULL DEFAULT 0,
    Preco DECIMAL(10,2) NOT NULL CHECK (Preco >= 0),
    DataCriacao DATETIME NOT NULL DEFAULT GETDATE(),
    DataAtualizacao DATETIME NULL
);
GO