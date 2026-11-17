-- Cadeia principal
CREATE INDEX IF NOT EXISTS idx_atas_proc          ON atas(numeroProcesso);
CREATE INDEX IF NOT EXISTS idx_contratacoes_proc  ON contratacoes(numeroProcesso);
CREATE INDEX IF NOT EXISTS idx_contratos_proc     ON contratos(numeroProcessoLicitacao);
CREATE INDEX IF NOT EXISTS idx_contratos_numero   ON contratos(numeroContrato);
CREATE INDEX IF NOT EXISTS idx_notas_contrato     ON notas_empenho(contrato);
CREATE INDEX IF NOT EXISTS idx_notas_pk_comp      ON notas_empenho(numeroEmpenho, codigoOrgao, ano);
CREATE INDEX IF NOT EXISTS idx_liquid_pk_comp     ON liquidacoes(numeroEmpenho, codigoOrgao, anoExercicio);

-- Servidores e ligações por pessoa
CREATE INDEX IF NOT EXISTS idx_serv_cpf           ON servidores(cpfServidor);
CREATE INDEX IF NOT EXISTS idx_serv_matricula     ON servidores(matricula);
CREATE INDEX IF NOT EXISTS idx_contratos_cpfgest  ON contratos(cpfGestor);
CREATE INDEX IF NOT EXISTS idx_contratos_matgest  ON contratos(matriculaGestor);
CREATE INDEX IF NOT EXISTS idx_notas_cpfcnpj      ON notas_empenho(cpfCnpj);
CREATE INDEX IF NOT EXISTS idx_liquid_cpfcredor   ON liquidacoes(cnpjCpfCredor);

-- Órgão
CREATE INDEX IF NOT EXISTS idx_serv_orgao         ON servidores(orgaoLotacao);
CREATE INDEX IF NOT EXISTS idx_contratos_orgao    ON contratos(nomeOrgao);
CREATE INDEX IF NOT EXISTS idx_contratacoes_orgao ON contratacoes(nomeOrgao);
CREATE INDEX IF NOT EXISTS idx_atas_orgao         ON atas(nomeOrgao);
CREATE INDEX IF NOT EXISTS idx_notas_orgao        ON notas_empenho(nomeOrgao);