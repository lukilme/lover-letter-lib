-- Duplicidade em Atas.numeroProcesso? ("validar unicidade")
CREATE OR REPLACE VIEW v_dup_atas AS
SELECT numeroProcesso, COUNT(*) AS n
FROM atas GROUP BY numeroProcesso HAVING COUNT(*) > 1;

-- Contratos sem processo de licitação (2.484 esperados)
CREATE OR REPLACE VIEW v_contratos_sem_processo AS
SELECT numeroContrato FROM contratos WHERE numeroProcessoLicitacao IS NULL;

-- Contratos cujo processo NÃO existe em contratações (órfãos)
CREATE OR REPLACE VIEW v_contratos_orfao AS
SELECT c.numeroContrato, c.numeroProcessoLicitacao
FROM contratos c
LEFT JOIN contratacoes ct ON c.numeroProcessoLicitacao = ct.numeroProcesso
WHERE c.numeroProcessoLicitacao IS NOT NULL AND ct.numeroProcesso IS NULL;

-- Servidores: CPF sozinho NÃO é único (snapshot mensal)
CREATE OR REPLACE VIEW v_serv_cpf_nao_unico AS
SELECT cpfServidor, COUNT(DISTINCT anoExercicio||'-'||mesReferencia||'-'||periodo) AS n_periodos
FROM servidores
WHERE cpfServidor IS NOT NULL
GROUP BY cpfServidor
HAVING n_periodos > 1;

-- Notas com contrato preenchido mas inexistente em Contratos
CREATE OR REPLACE VIEW v_notas_contrato_orfao AS
SELECT n.numeroEmpenho, n.codigoOrgao, n.ano, n.contrato
FROM notas_empenho n
LEFT JOIN contratos c ON n.contrato = c.numeroContrato
WHERE n.contrato IS NOT NULL AND c.numeroContrato IS NULL;

-- Notas sem contrapartida em Liquidações
CREATE OR REPLACE VIEW v_notas_sem_liquidacao AS
SELECT n.numeroEmpenho, n.codigoOrgao, n.ano
FROM notas_empenho n
LEFT JOIN liquidacoes l
  ON n.numeroEmpenho = l.numeroEmpenho
 AND n.codigoOrgao   = l.codigoOrgao
 AND n.ano           = l.anoExercicio
WHERE l.numeroEmpenho IS NULL;