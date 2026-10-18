import { Component, ElementRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import * as echarts from 'echarts';
import { GrafoService } from 'app/services/grafo.service';
import { MonitorService } from 'app/services/monitor.service';
import { MonitorView } from '../monitor-view';
import { MonitorToolbarComponent } from '../monitor-toolbar.component';
@Component({ selector: 'grafo', standalone: true, imports: [CommonModule, MonitorToolbarComponent], templateUrl: './grafo.component.html', styleUrls: ['../monitoring.scss'], encapsulation: ViewEncapsulation.None })
export class GrafoComponent extends MonitorView {
    @ViewChild('chart')
    container: ElementRef<HTMLElement>;
    myChart: echarts.ECharts;
    zoomPercent = 100;
    private resize: ResizeObserver;
    private resetView = false;
    constructor(monitor: MonitorService, api: GrafoService, dialog: MatDialog, router: Router) { super(monitor, api, dialog, router); }
    ngAfterViewInit() {
        this.myChart = echarts.init(this.container.nativeElement);
        this.myChart.on('click', (params: any) => { if (params.dataType === 'node') {
            const n = this.selectedNodes.find(s => s.nodo.id === Number(params.data.id))?.nodo;
            if (n)
                this.dialogo(n.tipo_nodo, n.id, n.url, n.puerto);
        } });
        this.myChart.on('graphroam', () => this.updateZoom());
        this.resize = new ResizeObserver(() => { this.myChart.resize(); this.render(); });
        this.resize.observe(this.container.nativeElement);
        this.start();
    }
    render() {
        if (!this.myChart || !this.snapshot)
            return;
        const selected = this.selectedNodes;
        const groups = [...new Set(selected.map(s => s.group))].sort();
        const viewportWidth = this.container.nativeElement.clientWidth;
        const viewportHeight = this.container.nativeElement.clientHeight;
        if (!viewportWidth || !viewportHeight)
            return;
        const width = Math.max(900, viewportWidth);
        const symbolSize = this.configuracion.map.iconSize || 60;
        const rowHeight = symbolSize + 30;
        const topPadding = symbolSize / 2 + 30;
        const column = (type: string) => type.startsWith('Controlador') ? 0 : type.startsWith('Balanceador') ? 1 : 2;
        const offsets = new Map<string, number>();
        let offset = 0;
        for (const group of groups) {
            offsets.set(group, offset);
            const members = selected.filter(node => node.group === group);
            const processors = members.filter(node => column(node.nodo.tipo_nodo) === 2).length;
            const processorColumns = Math.max(1, Math.ceil(Math.sqrt(processors)));
            const rows = Math.max(
                members.filter(node => column(node.nodo.tipo_nodo) === 0).length,
                members.filter(node => column(node.nodo.tipo_nodo) === 1).length,
                Math.ceil(processors / processorColumns)
            );
            offset += rows * rowHeight + 24;
        }
        const layoutHeight = Math.max(200, offset - rowHeight - 24 + topPadding + symbolSize / 2 + 40);
        const fitScale = Math.min(1, (viewportWidth - 32) / width, (viewportHeight - 32) / layoutHeight);
        const previous = (this.myChart.getOption() as any)?.series?.[0];
        const nodes = selected.map(s => {
            const roleColumn = column(s.nodo.tipo_nodo);
            const siblings = selected.filter(n => n.group === s.group && column(n.nodo.tipo_nodo) === roleColumn);
            const row = siblings.findIndex(n => n.nodo.id === s.nodo.id);
            const columns = roleColumn === 2 ? Math.max(1, Math.ceil(Math.sqrt(siblings.length))) : 1;
            const x = roleColumn === 0 ? 100 : roleColumn === 1 ? width * .28 : width * .53 + (row % columns) * width * .4 / Math.max(1, columns - 1);
            const y = topPadding + offsets.get(s.group) + Math.floor(row / columns) * rowHeight;
            const labelWidth = roleColumn === 2 ? Math.min(160, width * .4 / columns - 16) : 160;
            return { id: String(s.nodo.id), name: s.nodo.nombre, x, y, symbol: 'image://assets/map/png/' + this.icon(s), symbolSize: symbolSize * fitScale, label: { width: labelWidth * fitScale, overflow: 'truncate' }, group: s.group, tipo_nodo: s.nodo.tipo_nodo, status: s.status, endpoint: s.endpoint, error: s.error };
        });
        // Fit positions AND symbols to the viewport, keeping room for labels.
        // The chart stays inside the screen; roaming is handled by ECharts.
        const xs = nodes.map(node => node.x), ys = nodes.map(node => node.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const bounds = nodes.length ? {
            left: (viewportWidth - width * fitScale) / 2 + (minX - (minX === maxX ? 1 : 0)) * fitScale,
            top: (viewportHeight - layoutHeight * fitScale) / 2 + (minY - (minY === maxY ? 1 : 0)) * fitScale,
            width: (maxX - minX || 2) * fitScale,
            height: (maxY - minY || 2) * fitScale
        } : {};
        this.myChart.setOption({ animation: false, tooltip: { trigger: 'item', formatter: (p: any) => p.dataType === 'node' ? [p.data.name, p.data.group, p.data.tipo_nodo, p.data.status ? 'Responde' : 'Sin respuesta válida', p.data.endpoint].map(v => String(v || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))).join('<br>') : p.data.kind === 'supervision' ? 'Supervisión' : 'Asignación operativa' }, series: [{ type: 'graph', layout: 'none', ...bounds, roam: true, nodeScaleRatio: 1, zoom: this.resetView ? 1 : (previous?.zoom || 1), center: this.resetView ? undefined : previous?.center, scaleLimit: { min: 0.35, max: 4 }, label: { show: true, position: 'bottom', distance: 4, fontSize: Math.max(11, 12 * fitScale), lineHeight: 15, formatter: (p: any) => p.data.name }, data: nodes, links: this.selectedLinks.map(l => ({ ...l, source: String(l.source), target: String(l.target), lineStyle: { color: l.kind === 'assignment' ? '#18823b' : '#687587', width: l.kind === 'assignment' ? 3 : 2, type: l.kind === 'assignment' ? 'solid' : 'dashed', curveness: 0.08 } })), edgeSymbol: ['none', 'arrow'], edgeSymbolSize: [0, 10] }] }, true);
        this.resetView = false;
        this.updateZoom();
    }
    fit() { this.resetView = true; this.render(); }
    zoomBy(factor: number) {
        this.myChart?.dispatchAction({ type: 'graphRoam', seriesIndex: 0, zoom: factor, originX: this.container.nativeElement.clientWidth / 2, originY: this.container.nativeElement.clientHeight / 2 });
        this.updateZoom();
    }
    private updateZoom() { this.zoomPercent = Math.round(((this.myChart?.getOption() as any)?.series?.[0]?.zoom || 1) * 100); }
    ngOnDestroy() { super.ngOnDestroy(); this.resize?.disconnect(); this.myChart?.dispose(); }
}
