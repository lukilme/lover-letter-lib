import logging
from IPython.display import display, HTML, Markdown
import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def table_with_limit(df : pd.DataFrame, columns=[], limits=[], title=None):
    columns = list(columns) if columns is not None else df.select_dtypes("number").columns.tolist()
    limits = list(limits) if limits is not None else []

    if len(columns) != len(limits):
        raise ValueError("`columns` e `limits` devem ter o mesmo tamanho.")

    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise KeyError(f"Colunas não encontradas no DataFrame: {missing}")

    limit_map = dict(zip(columns, limits))

    def highlight(col):
        if col.name not in limit_map:
            return [""] * len(col)
        return [
            "background-color: #ffcccc; color: #b00000; font-weight: bold"
            if pd.notna(v) and v > limit_map[col.name] else ""
            for v in col
        ]

    styler = df.style.apply(highlight, axis=0)

    if title:
        styler = styler.set_caption(title).set_table_styles(
            [{"selector": "caption",
              "props": [("font-size", "16px"), ("font-weight", "bold"), ("padding", "8px")]}]
        )

    return styler


def printf(*args, **kwargs):
    """Função para imprimir mensagens no Jupyter Notebook."""
    display(Markdown(" ".join(str(arg) for arg in args)), **kwargs)