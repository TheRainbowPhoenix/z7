#!/usr/bin/env python3
"""Render generated call_graph.json into PNG/SVG for visual exploration."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import networkx as nx


def main() -> None:
    root = Path(__file__).resolve().parent
    graph_json = root / "generated" / "call_graph.json"
    out_dir = root / "generated" / "images"
    out_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(graph_json.read_text())

    graph = nx.DiGraph()
    for node in data["nodes"]:
        graph.add_node(node["name"], kind=node.get("kind", "external"))
    for edge in data["edges"]:
        graph.add_edge(
            edge["from"],
            edge["to"],
            label=f"N{edge['network']} {edge['blockType']}",
        )

    pos = nx.spring_layout(graph, seed=42, k=1.4)

    plt.figure(figsize=(15, 11))
    internal = [n for n, d in graph.nodes(data=True) if d.get("kind") == "internal"]
    external = [n for n, d in graph.nodes(data=True) if d.get("kind") != "internal"]

    nx.draw_networkx_nodes(
        graph,
        pos,
        nodelist=internal,
        node_color="#8ecae6",
        node_shape="s",
        node_size=2600,
    )
    nx.draw_networkx_nodes(
        graph,
        pos,
        nodelist=external,
        node_color="#ffb703",
        node_shape="o",
        node_size=2200,
    )
    nx.draw_networkx_labels(graph, pos, font_size=8, font_weight="bold")
    nx.draw_networkx_edges(
        graph,
        pos,
        arrowstyle="-|>",
        arrowsize=16,
        edge_color="#4a4a4a",
        width=1.8,
    )

    edge_labels = {(u, v): d.get("label", "") for u, v, d in graph.edges(data=True)}
    nx.draw_networkx_edge_labels(graph, pos, edge_labels=edge_labels, font_size=7)

    plt.title("PLC Global Call Graph (OB/FB/FC)", fontsize=14)
    plt.axis("off")
    plt.tight_layout()
    png = out_dir / "call_graph.png"
    svg = out_dir / "call_graph.svg"
    plt.savefig(png, dpi=220)
    plt.savefig(svg)
    print(png)
    print(svg)


if __name__ == "__main__":
    main()
