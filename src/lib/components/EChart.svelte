<script lang="ts">
	/**
	 * Thin client-only ECharts wrapper (gtweb-6ab6bd).
	 *
	 * Modular imports keep the bundle lean: only the line chart + the interactive
	 * components the quota charts use (tooltip crosshair, native legend, dataZoom)
	 * are registered. The chart initializes on mount (SSR-safe), follows container
	 * size via ResizeObserver, and re-applies the option reactively.
	 */
	import { onMount } from 'svelte';
	import * as echarts from 'echarts/core';
	import { LineChart, BarChart, RadarChart } from 'echarts/charts';
	import {
		GridComponent,
		TooltipComponent,
		LegendComponent,
		DataZoomComponent,
		RadarComponent,
	} from 'echarts/components';
	import { CanvasRenderer } from 'echarts/renderers';
	import type { EChartsCoreOption } from 'echarts/core';

	echarts.use([
		LineChart,
		BarChart,
		RadarChart,
		GridComponent,
		TooltipComponent,
		LegendComponent,
		DataZoomComponent,
		RadarComponent,
		CanvasRenderer,
	]);

	let {
		option,
		height = 220,
	}: { option: EChartsCoreOption; height?: number } = $props();

	let el: HTMLDivElement;
	let chart: echarts.ECharts | null = null;

	onMount(() => {
		chart = echarts.init(el);
		const ro = new ResizeObserver(() => chart?.resize());
		ro.observe(el);
		return () => {
			ro.disconnect();
			chart?.dispose();
			chart = null;
		};
	});

	$effect(() => {
		// `notMerge` keeps stale series from lingering when filters change the set.
		chart?.setOption(option, { notMerge: true });
	});
</script>

<div bind:this={el} style="width:100%; height:{height}px"></div>
