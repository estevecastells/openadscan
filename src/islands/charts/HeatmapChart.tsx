import { useEffect, useRef } from "hono/jsx";
import { readCssVar } from "./chartTheme";

export default function HeatmapChart(props: {
  xLabels: string[];
  yLabels: string[];
  data: Array<[number, number, number]>; // [xIdx, yIdx, value]
  max?: number;
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
        textStyle: { color: readCssVar("--text", "#0f172a") },
        grid: { left: 80, right: 16, top: 16, bottom: 32 },
        tooltip: { position: "top" },
        xAxis: { type: "category", data: props.xLabels, splitArea: { show: true } },
        yAxis: { type: "category", data: props.yLabels, splitArea: { show: true } },
        visualMap: {
          min: 0,
          max: props.max ?? Math.max(1, ...props.data.map((d) => d[2])),
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          inRange: { color: ["#f1f5f9", "#818cf8", "#4338ca"] },
        },
        series: [
          {
            type: "heatmap",
            data: props.data,
            label: { show: false },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.4)" } },
          },
        ],
      });
    })();
    return () => {
      disposed = true;
      chart?.dispose();
    };
  }, []);
  return <div ref={ref} style={{ width: "100%", height: `${props.height ?? 280}px` }} />;
}
