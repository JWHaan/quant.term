import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

interface SankeyNode {
    name: string;
    category?: string;
}

interface SankeyLink {
    source: number;
    target: number;
    value: number;
}

interface OrderFlowSankeyProps {
    nodes: SankeyNode[];
    links: SankeyLink[];
    width?: number;
    height?: number;
}

export const OrderFlowSankey: React.FC<OrderFlowSankeyProps> = ({
    nodes,
    links,
    width = 600,
    height = 400
}) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0 || links.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const { nodes: sankeyNodes, links: sankeyLinks } = sankey<SankeyNode, SankeyLink>()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 1], [width - 1, height - 6]])({
                nodes: nodes.map(d => Object.assign({}, d)),
                links: links.map(d => Object.assign({}, d))
            });

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // Draw links
        svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
            .selectAll("path")
            .data(sankeyLinks)
            .join("path")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke-width", d => Math.max(1, d.width!))
            .style("stroke", () => {
                // Gradient or source color
                return "#aaa";
            });

        // Draw nodes
        svg.append("g")
            .selectAll("rect")
            .data(sankeyNodes)
            .join("rect")
            .attr("x", d => d.x0!)
            .attr("y", d => d.y0!)
            .attr("height", d => d.y1! - d.y0!)
            .attr("width", d => d.x1! - d.x0!)
            .attr("fill", (_d, i) => color(i.toString()))
            .append("title")
            .text(d => `${d.name}\n${d.value}`);

        // Add text
        svg.append("g")
            .style("font", "10px sans-serif")
            .selectAll("text")
            .data(sankeyNodes)
            .join("text")
            .attr("x", (d: any) => d.x0! < width / 2 ? d.x1! + 6 : d.x0! - 6)
            .attr("y", (d: any) => (d.y1! + d.y0!) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", (d: any) => d.x0! < width / 2 ? "start" : "end")
            .text((d: any) => d.name);

    }, [nodes, links, width, height]);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ backgroundColor: '#fff', borderRadius: '8px' }}
        />
    );
};
