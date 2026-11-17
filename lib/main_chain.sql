-- Cadeia: Atas → Contratações → Contratos → Notas → Liquidações
CREATE OR REPLACE VIEW v_cadeia_principal AS
SELECT
    a.numeroProcesso, a.ano, a.mes, a.nomeOrgao, a.modalidade, a.situacao,
    ct.numeroLicitacao, ct.valorAdjudicado,
    c.numeroContrato, c.valorTotal,
    n.numeroEmpenho, n.codigoOrgao AS orgNota, n.ano AS anoNota,
    n.valorEmpenhado, n.valorLiquidado, n.valorPago,
    l.anoExercicio, l.numeroDocumento, l.valorGD, l.nomeCredor
FROM atas a
LEFT JOIN contratacoes  ct ON a.numeroProcesso = ct.numeroProcesso
LEFT JOIN contratos     c  ON ct.numeroProcesso = c.numeroProcessoLicitacao
LEFT JOIN notas_empenho n  ON c.numeroContrato = n.contrato
LEFT JOIN liquidacoes   l  ON n.numeroEmpenho = l.numeroEmpenho
                          AND n.codigoOrgao   = l.codigoOrgao
                          AND n.ano           = l.anoExercicio;

-- Gestor (N:M por causa dos meses em Servidores) — cpf OU matrícula
CREATE OR REPLACE VIEW v_contrato_gestor_mensal AS
SELECT
    c.numeroContrato, c.valorTotal,
    c.cpfGestor, c.matriculaGestor,
    s.cpfServidor, s.matricula,
    s.anoExercicio, s.mesReferencia, s.periodo,
    s.nomeServidor, s.nomeCargo, s.situacaoServidor, s.valorBruto
FROM contratos c
LEFT JOIN servidores s
  ON (c.cpfGestor      IS NOT NULL AND c.cpfGestor      = s.cpfServidor)
  OR (c.matriculaGestor IS NOT NULL AND c.matriculaGestor = s.matricula);