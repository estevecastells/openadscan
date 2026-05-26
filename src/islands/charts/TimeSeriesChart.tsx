import { useEffect, useRef } from "hono/jsx";
import { chartPalette, readCssVar } from "./chartTheme";

export type Series = { name: string; data: Array<[string, number]> };

export default function TimeSeriesChart(props: { series: Series[]; height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let chart: { dispose: () => void; setOption: (opt: unknown) => void } | null = null;
    (async () => {
      const echarts = await import("echarts");
      if (disposed || !ref.current) return;
      chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
      chart.setOption({
        backgroundColor: "transparent",
        textStyle: { color: readCssVar("--text", "#0f172a"), fontFamily: "Inter, sans-serif" },
        color: chartPalette(),
        legend: { textStyle: { color: readCssVar("--muted", "#64748b") } },
        grid: { left: 48, right: 16, top: 32, bottom: 32 },
        tooltip: { trigger: "axis" },
        xAxis: { type: "time", axisLine: { lineStyle: { color: readCssVar("--border", "#e2e8f0") } } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: readCssVar("--border", "#e2e8f0") } } },
        series: props.series.map((s) => ({
          name: s.name,
          type: "line",
          smooth: true,
          showSymbol: false,
          data: s.data,
        })),
      });
    })();
    return () => {
      disposed = true;
      chart?.dispose();
    };
  }, []);

  return <div ref={ref} style={{ width: "100%", height: `${props.height ?? 240}px` }} />;
}
