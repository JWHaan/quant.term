import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface CorrelationHeatmapProps {
    data: number[][];
    labels: string[];
    width?: number;
    height?: number;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
    data,
    labels,
    width = 400,
    height = 400
}) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 30, right: 30, bottom: 30, left: 30 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scaleBand()
            .range([0, innerWidth])
            .domain(labels)
            .padding(0.01);

        const y = d3.scaleBand()
            .range([innerHeight, 0])
            .domain(labels)
            .padding(0.01);

        // Color scale
        const color = d3.scaleLinear<string>()
            .range(["#ef4444", "#ffffff", "#22c55e"]) // Red to White to Green
            .domain([-1, 0, 1]);

        // Draw squares
        for (let i = 0; i < labels.length; i++) {
            for (let j = 0; j < labels.length; j++) {
                const labelI = labels[i];
                const labelJ = labels[j];
                if (!labelI || !labelJ) continue;
                
                const xPos = x(labelI);
                const yPos = y(labelJ);
                const val = data[i]?.[j];

                if (xPos === undefined || yPos === undefined || val === undefined) continue;

                g.append("rect")
                    .attr("x", xPos)
                    .attr("y", yPos)
                    .attr("width", x.bandwidth())
                    .attr("height", y.bandwidth())
                    .style("fill", color(val))
                    .on("mouseover", function () {
                        d3.select(this).style("stroke", "black").style("stroke-width", 2);
                        // Tooltip logic could go here
                    })
                    .on("mouseleave", function () {
                        d3.select(this).style("stroke", "none");
                    });

                // Add text
                const bandwidthX = x.bandwidth();
                const bandwidthY = y.bandwidth();

                g.append("text")
                    .attr("x", xPos + bandwidthX / 2)
                    .attr("y", yPos + bandwidthY / 2)
                    .attr("dy", ".35em")
                    .style("text-anchor", "middle")
                    .style("font-size", "10px")
                    .style("fill", Math.abs(val) > 0.5 ? "white" : "black")
                    .text(val.toFixed(2));
            }
        }

        // Axes
        g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x));

        g.append("g")
            .call(d3.axisLeft(y));

    }, [data, labels, width, height]);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ backgroundColor: '#f8fafc', borderRadius: '8px' }}
        />
    );
};
