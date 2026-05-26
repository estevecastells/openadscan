import { useEffect, useRef } from "hono/jsx";
import { chartPalette, readCssVar } from "./chartTheme";

export type ScatterPoint = { x: number; y: number; size?: number; label?: string };

export default function ScatterChart(props: { points: ScatterPoint[]; xLabel?: string; yLabel?: string; height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let disposed = false;
    let chart: { dispose: () => void; setOption: (opt: unknown) => void } | null = null;
    (async () => {
      const echarts = await import("echarts");
      if (disposed || !ref.current) return;
      chart = echarts.init(ref.current);
      chart.setOption({
        backgroundColor: "transparent",
        color: chartPalette(),
        textStyle: { color: readCssVar("--text", "#0f172a") },
        grid: { left: 48, right: 16, top: 32, bottom: 48 },
        tooltip: {
          trigger: "item",
          formatter: (p: { data: number[]; dataIndex: number }) =>
            `<strong>${props.points[p.dataIndex]?.label ?? ""}</strong><br/>${props.xLabel ?? "x"}: ${p.data[0]}<br/>${props.yLabel ?? "y"}: ${p.data[1]}`,
        },
        xAxis: { name: props.xLabel ?? "", type: "value", nameTextStyle: { color: readCssVar("--muted", "#64748b") } },
        yAxis: { name: props.yLabel ?? "", type: "value", nameTextStyle: { color: readCssVar("--muted", "#64748b") } },
        series: [
          {
            type: "scatter",
            symbolSize: (val: number[]) => 6 + Math.sqrt(val[2] ?? 1) * 2,
            data: props.points.map((p) => [p.x, p.y, p.size ?? 1]),
          },
        ],
      });
    })();
    return () => {
      disposed = true;
      chart?.dispose();
    };
  }, []);
  return <div ref={ref} style={{ width: "100%", height: `${props.height ?? 260}px` }} />;
}
