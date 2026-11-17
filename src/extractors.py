from src.extractor import BaseExtractor
from typing import List, Dict, Any

class AtasExtractor(BaseExtractor):
    @property
    def resource_name(self) -> str:
        return "atas"

    @property
    def period_mode(self) -> str:
        return "ano_inicio_vigencia"

    def fetch_vigencia_records(self, year: int) -> List[Dict[str, Any]]:
        return self.api.obter_todas_atas_registro_preco(
            ano_inicio_vigencia=year
        )


class NotasEmpenhoExtractor(BaseExtractor):
    @property
    def resource_name(self) -> str:
        return "notas_empenho"

    def fetch_month_records(self, year: int, month: int) -> List[Dict[str, Any]]:
        return self.api.obter_todas_notas_empenho(
            ano=year,
            mes=month
        )


class LiquidacoesExtractor(BaseExtractor):
    @property
    def resource_name(self) -> str:
        return "liquidacoes"

    def fetch_month_records(self, year: int, month: int) -> List[Dict[str, Any]]:
        return self.api.obter_todas_liquidacoes(
            ano=year,
            mes=month
        )


class ContratosExtractor(BaseExtractor):
    @property
    def resource_name(self) -> str:
        return "contratos"

    def fetch_year_records(self, year: int) -> List[Dict[str, Any]]:
        return self.api.obter_todos_contratos(
            ano_inicio_vigencia=year
        )


class ContratacoesExtractor(BaseExtractor):
    @property
    def resource_name(self) -> str:
        return "contratacoes"

    def fetch_month_records(self, year: int, month: int) -> List[Dict[str, Any]]:
        return self.api.obter_todas_contratacoes(
            ano=year,
            mes=month
        )


class ServidoresExtractor(BaseExtractor):
    @property
    def resource_name(self) -> str:
        return "servidores"

    def fetch_month_records(self, year: int, month: int) -> List[Dict[str, Any]]:
        return self.api.obter_todos_servidores(
            ano=year,
            mes=month
        )