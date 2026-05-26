import { useEffect, useRef } from "hono/jsx";
import { chartPalette, readCssVar } from "./chartTheme";

export type StackedBarSeries = { name: string; data: number[] };

export default function StackedBarChart(props: {
  categories: string[];
  series: StackedBarSeries[];
  height?: number;
}) {
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
        legend: { textStyle: { color: readCssVar("--muted", "#64748b") } },
        grid: { left: 48, right: 16, top: 32, bottom: 32 },
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: props.categories },
        yAxis: { type: "value" },
        series: props.series.map((s) => ({ name: s.name, type: "bar", stack: "total", data: s.data })),
      });
    })();
    return () => {
      disposed = true;
      chart?.dispose();
    };
  }, []);
  return <div ref={ref} style={{ width: "100%", height: `${props.height ?? 240}px` }} />;
}
