import { Component, ViewEncapsulation, ElementRef, ViewChild } from '@angular/core';
import { GrafoService } from 'app/services/grafo.service';
import { Dialog } from '../dialogs/dialog.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { timer, forkJoin, of, Subscription } from 'rxjs';
import * as echarts from 'echarts';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { catchError, map } from 'rxjs/operators';
import { ConfigService, Config } from 'app/services/config.service';

@Component({
    selector: 'grafo',
    standalone: true,
    templateUrl: './grafo.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [MatButtonToggleModule, MatIconModule, MatToolbarModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule,
    MatSelectModule,
    FormsModule]
})
export class GrafoComponent {
    configuracion: any;
    activarConexiones: boolean = true;
    myChart: any = null;
    datosDelSistema: any;
    timerSubscription: Subscription | null = null; // Tipado correcto para RxJS
    ancho = window.innerWidth;
    alto = window.innerHeight;
    margenZona = 10;
    zonas = {
        "Controlador": { xInicio: 0, xFin: 0.2 * this.ancho },
        "Balanceador": { xInicio: 0.25 * this.ancho, xFin: 0.4 * this.ancho },
        "Procesador": { xInicio: 0.45 * this.ancho, xFin: this.ancho }
    };

    constructor(private router: Router, private http: GrafoService, private config: ConfigService, private dialog: MatDialog) {}

    ngAfterViewInit() {
        this.initConfig();
        this.initChart();
    }

    initConfig() {
        this.config.getConfig().subscribe((res: any) => {
            this.configuracion = res;
        });
    }

    irALista(): void {
        this.router.navigate(['/lista']);
    }

    irAMapa(): void {
        this.router.navigate(['/mapa']);
    }

    ngOnDestroy(): void {
        // Limpieza segura al destruir el componente para evitar fugas de memoria
        if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
            this.timerSubscription = null;
        }
    }

    initChart(): void {
        this.http.getNodosOrdenados().subscribe((res) => {
            const requests = res.nodos.map((nodo: any) =>
                this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
                    map((val: any) => ({ nodo: nodo, datos: val, status: true })),
                    catchError(() => of({ nodo: nodo, datos: '', status: false }))
                )
            );
            forkJoin(requests).subscribe((res: any) => {
                const chartDom = document.getElementById('grafo');
                this.myChart = echarts.init(chartDom!);
                const data = res.map((item: any) => {
                    const { nodo, status } = item;
                    const { nombre, tipo_nodo } = nodo;
                    let image = tipo_nodo === 'Balanceador Main' ? this.configuracion.balancer.pngMain :
                        tipo_nodo === 'Controlador Main' ? this.configuracion.controller.pngMain :
                        tipo_nodo === 'Balanceador Subs' ? this.configuracion.balancer.pngSubs :
                        tipo_nodo === 'Controlador Subs' ? this.configuracion.controller.pngSubs :
                        this.configuracion.processor.png;
                    if (!status) {
                        image = tipo_nodo === 'Balanceador Main' ? this.configuracion.balancer.pngMainDes :
                            tipo_nodo === 'Controlador Main' ? this.configuracion.controller.pngMainDes :
                            tipo_nodo === 'Balanceador Subs' ? this.configuracion.balancer.pngSubsDes :
                            tipo_nodo === 'Controlador Subs' ? this.configuracion.controller.pngSubsDes :
                            this.configuracion.processor.pngDes;
                    }
                    const zona = tipo_nodo.startsWith('Balanceador') ? this.zonas['Balanceador'] : 
                        tipo_nodo.startsWith('Controlador') ? this.zonas['Controlador'] : 
                        this.zonas[tipo_nodo];
                    const anchoZona = zona.xFin - zona.xInicio;
                    const altoZona = this.alto - 2 * this.margenZona;
                    const nodosZona = res.filter((n: any) => 
                        n.nodo.tipo_nodo.startsWith(tipo_nodo.split(" ")[0]));
                    const indexZona = nodosZona.findIndex((n: any) => n.nodo.id === nodo.id);
                    const nodosPorColumna = Math.floor(Math.sqrt(nodosZona.length));
                    const espacioX = anchoZona / nodosPorColumna;
                    const espacioY = altoZona / Math.ceil(nodosZona.length / nodosPorColumna);
                    const columna = indexZona % nodosPorColumna;
                    const fila = Math.floor(indexZona / nodosPorColumna);
                    const x = zona.xInicio + columna * espacioX + this.margenZona;
                    const y = this.margenZona + fila * espacioY;
                    return { 
                        id: nodo.id, 
                        name: nodo.nombre, 
                        symbolSize: this.configuracion.map.iconSize, 
                        image: image, 
                        tipo_nodo: tipo_nodo, 
                        url: nodo.url, 
                        puerto: nodo.puerto, 
                        x, 
                        y, 
                        visible: nodo.visible
                    };
                });

                const activos: any[] = [];
                for(let i = 0; i < res.length; i++){
                    if(res[i].status === true){
                        activos.push(res[i]);
                    }
                }

                console.log(activos)

                const links = activos.reduce((acc: any[], item2: any) => {
                    const { nodo, status, datos } = item2;

                    if (this.activarConexiones === true) {
                        if(nodo.tipo_nodo === 'Balanceador Main'){
                            res.forEach((nodoTarget: any) => {
                                for(let j = 0; j < datos.Data.balancerList.length; j++){
                                    if(datos.Data.balancerList[j].url === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}`){
                                        console.log(datos.Data)
                                        console.log(nodoTarget)
                                        acc.push({ source: nodo.id, target: nodoTarget.nodo.id, color: '#0c7909' });
                                    }
                                }
                            });
                        }
                        if(nodo.tipo_nodo === 'Balanceador Subs'){
                            res.forEach((nodoTarget: any) => {
                                if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlMain && 
                                !nodoTarget.status){
                                    res.forEach((nodoTarget2: any) => {
                                        for(let j = 0; j < datos.Data.balancerList.length; j++){
                                            if(datos.Data.balancerList[j].url === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                                acc.push({ source: nodo.id, target: nodoTarget2.nodo.id, color: '#0c7909' });
                                            }
                                        }
                                    });
                                }
                                if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlMain && 
                                nodoTarget.status){
                                    acc.push({ source: nodo.id, target: nodoTarget.nodo.id , color: '#8a8c8d'});
                                }
                            })
                        }
                        if(nodo.tipo_nodo === 'Controlador Main'){
                            res.forEach((nodoTarget: any) => {
                                if(datos.Data.internalConfig.urlBalancerMain === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}`){
                                    if(nodoTarget.status === true){
                                        acc.push({ source: nodo.id, target: nodoTarget.nodo.id, color: '#0c7909' });
                                    }

                                    // Si el Balanceador subs esta activo y main no
                                    else{
                                        res.forEach((nodoTarget2: any) => {
                                            if(!nodoTarget.status && datos.Data.internalConfig.urlBalancerSubs === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}` && nodoTarget2.status === true){
                                                acc.push({ source: nodo.id, target: nodoTarget2.nodo.id , color: '#0c7909'});
                                            }
                                        });
                                    }
                                }
                            });
                        }
                        if(nodo.tipo_nodo === 'Controlador Subs'){
                            res.forEach((nodoTarget: any) => {
                                if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlCoordinatorlMain && 
                                !nodoTarget.status){
                                    res.forEach((nodoTarget2: any) => {
                                        if(datos.Data.internalConfig.urlBalancerMain === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                            if(nodoTarget2.status === true){
                                                acc.push({ source: nodo.id, target: nodoTarget2.nodo.id, color: '#0c7909' });
                                            }
                                        } 

                                        // Si el Balanceador subs esta activo y main no
                                        if(datos.Data.internalConfig.urlBalancerMain === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                            if(!nodoTarget2.status){   
                                                res.forEach((nodoTarget3: any) => {
                                                    if(!nodoTarget2.status && datos.Data.internalConfig.urlBalancerSubs === `${nodoTarget3.nodo.url}:${nodoTarget3.nodo.puerto}` && nodoTarget3.status === true){
                                                        acc.push({ source: nodo.id, target: nodoTarget3.nodo.id , color: '#0c7909'});
                                                    }
                                                });
                                            }
                                        }
                                    });
                                }
                                if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlCoordinatorlMain && 
                                nodoTarget.status){
                                    acc.push({ source: nodo.id, target: nodoTarget.nodo.id , color: '#8a8c8d'});
                                }
                            });
                        }
                    }
                    return acc;
                }, []);

                const option = {
                    series: [{
                        type: 'graph',
                        layout: 'none',
                        roam: true,
                        clip: true,
                        scaleLimit: { min: 0.5, max: 2 },
                        label: {
                            show: true,
                            position: 'bottom',
                            formatter: function(params: any) {
                                const maxLength = 10;
                                const text = params.name || params.value;
                                return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
                            }
                        },
                        data: data.filter((node: any) => node.visible !== false).map((node: any) => ({
                            id: node.id,
                            name: node.name,
                            x: node.x,
                            y: node.y,
                            symbol: `image://assets/map/png/${node.image}`,
                            symbolSize: node.symbolSize,
                            visible: node.visible,
                            tipo_nodo: node.tipo_nodo,
                            url: node.url,
                            puerto: node.puerto
                        })),
                        links: links.map((link: any) => ({
                            source: String(link.source),
                            target: String(link.target),
                            lineStyle: { 
                                color: link.color, 
                                width: link.color === '#0c7909' ? 4 : 2, 
                                opacity: link.color === '#0c7909' ? 1 : 0.7, 
                                curveness: link.color === '#0c7909' ? 0.1 : 0.13 
                            },
                        })),
                        edgeSymbol: ['none', 'arrow'],
                        edgeSymbolSize: [6, 20]
                    }]
                };

                this.myChart.setOption(option);
                this.myChart.on('click', (params: any) => {
                    if (params.dataType === 'node') {
                        const nodoId = (params.data as any).id;
                        const tipoNodo = (params.data as any).tipo_nodo;
                        const url = (params.data as any).url;
                        const puerto = (params.data as any).puerto;
                        this.dialogo(tipoNodo, nodoId, url, puerto);
                    }
                });
                this.datosDelSistema = res;
                this.comprobar();
            });
        });
    }

    comprobar() {
        // Rompemos el temporizador anterior antes de lanzar uno nuevo
        if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
        }

        this.http.getNodosOrdenados().subscribe((res: any) => {
            const requests = res.nodos.map((nodo: any) =>
                this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
                    map((val: any) => ({ nodo: nodo, datos: val, status: true })),
                    catchError(() => of({ nodo: nodo, datos: '', status: false }))
                )
            );
            
            forkJoin(requests).subscribe((res: any) => {
                let cont = 0;
                
                // Si ya tenemos datos previos del sistema, los comparamos
                if (this.datosDelSistema) {
                    for (let x = 0; x < res.length; x++) {
                        const obj1 = JSON.stringify(res[x].datos.Data);
                        const obj2 = JSON.stringify(this.datosDelSistema[x].datos.Data);
                        if (obj1 !== obj2 || res[x].status !== this.datosDelSistema[x].status) {
                            cont++;
                        }
                    }
                }
                console.log("cambios: " + cont);

                if (cont !== 0) {
                    this.updateGrafo(res); // Ahora sí actualiza cuando detecta cambios reales
                } else {
                    // Si no hay cambios, igual actualizamos la referencia local de datos
                    this.datosDelSistema = res;
                }

                // El nuevo timer se programa SOLO cuando esta petición ya ha terminado por completo
                const tiempoEspera = this.configuracion?.espera?.valor || 5000;
                this.timerSubscription = timer(tiempoEspera).subscribe(() => this.comprobar());
            });
        });
    }

    updateGrafo(res: any) {
        const data = res.map((item: any) => {
            const { nodo, status } = item;
            const { nombre, tipo_nodo } = nodo;
            let image = tipo_nodo === 'Balanceador Main' ? this.configuracion.balancer.pngMain :
                tipo_nodo === 'Controlador Main' ? this.configuracion.controller.pngMain :
                tipo_nodo === 'Balanceador Subs' ? this.configuracion.balancer.pngSubs :
                tipo_nodo === 'Controlador Subs' ? this.configuracion.controller.pngSubs :
                this.configuracion.processor.png;
            if (!status) {
                image = tipo_nodo === 'Balanceador Main' ? this.configuracion.balancer.pngMainDes :
                    tipo_nodo === 'Controlador Main' ? this.configuracion.controller.pngMainDes :
                    tipo_nodo === 'Balanceador Subs' ? this.configuracion.balancer.pngSubsDes :
                    tipo_nodo === 'Controlador Subs' ? this.configuracion.controller.pngSubsDes :
                    this.configuracion.processor.pngDes;
            }
            const zona = tipo_nodo.startsWith('Balanceador') ? this.zonas['Balanceador'] : tipo_nodo.startsWith('Controlador') ? this.zonas['Controlador'] : this.zonas[tipo_nodo];
            const anchoZona = zona.xFin - zona.xInicio;
            const altoZona = this.alto - 2 * this.margenZona;
            const nodosZona = res.filter((n: any) => n.nodo.tipo_nodo.startsWith(tipo_nodo.split(" ")[0]));
            const indexZona = nodosZona.findIndex((n: any) => n.nodo.id === nodo.id);
            const nodosPorColumna = Math.floor(Math.sqrt(nodosZona.length));
            const espacioX = anchoZona / nodosPorColumna;
            const espacioY = altoZona / Math.ceil(nodosZona.length / nodosPorColumna);
            const columna = indexZona % nodosPorColumna;
            const fila = Math.floor(indexZona / nodosPorColumna);
            const x = zona.xInicio + columna * espacioX + this.margenZona;
            const y = this.margenZona + fila * espacioY;

            return { 
                id: nodo.id, 
                name: nodo.nombre, 
                symbolSize: this.configuracion.map.iconSize, 
                image: image, 
                tipo_nodo, 
                url: nodo.url, 
                puerto: nodo.puerto, 
                x, 
                y, 
                visible: nodo.visible 
            };
        });

        const activos: any[] = [];
        for(let i = 0; i < res.length; i++){
            if(res[i].status === true){
                activos.push(res[i]);
            }
        }
        console.log(activos)
        const links = activos.reduce((acc: any[], item2: any) => {
            const { nodo, status, datos } = item2;

            if (this.activarConexiones === true) {
                if(nodo.tipo_nodo === 'Balanceador Main'){
                    res.forEach((nodoTarget: any) => {
                        for(let j = 0; j < datos.Data.balancerList.length; j++){
                            if(datos.Data.balancerList[j].url === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}`){
                                acc.push({ source: nodo.id, target: nodoTarget.nodo.id, color: '#0c7909' });
                            }
                        }
                    });
                }
                if(nodo.tipo_nodo === 'Balanceador Subs'){
                    res.forEach((nodoTarget: any) => {
                        if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlMain && 
                        !nodoTarget.status){
                            res.forEach((nodoTarget2: any) => {
                                for(let j = 0; j < datos.Data.balancerList.length; j++){
                                    if(datos.Data.balancerList[j].url === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                        acc.push({ source: nodo.id, target: nodoTarget2.nodo.id, color: '#0c7909' });
                                    }
                                }
                            });
                        }
                        if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlMain && 
                        nodoTarget.status){
                            acc.push({ source: nodo.id, target: nodoTarget.nodo.id , color: '#8a8c8d'});
                        }
                    })
                }
                if(nodo.tipo_nodo === 'Controlador Main'){
                    res.forEach((nodoTarget: any) => {
                        if(datos.Data.internalConfig.urlBalancerMain === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}`){
                            if(nodoTarget.status === true){
                                acc.push({ source: nodo.id, target: nodoTarget.nodo.id, color: '#0c7909' });
                            }

                            // Si el Balanceador subs esta activo y main no
                            else{
                                res.forEach((nodoTarget2: any) => {
                                    if(!nodoTarget.status && datos.Data.internalConfig.urlBalancerSubs === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}` && nodoTarget2.status === true){
                                        acc.push({ source: nodo.id, target: nodoTarget2.nodo.id , color: '#0c7909'});
                                    }
                                });
                            }
                        }
                    });
                }
                if(nodo.tipo_nodo === 'Controlador Subs'){
                    res.forEach((nodoTarget: any) => {
                        if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlCoordinatorlMain && 
                        !nodoTarget.status){
                            res.forEach((nodoTarget2: any) => {
                                if(datos.Data.internalConfig.urlBalancerMain === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                    if(nodoTarget2.status === true){
                                        acc.push({ source: nodo.id, target: nodoTarget2.nodo.id, color: '#0c7909' });
                                    }
                                } 

                                // Si el Balanceador subs esta activo y main no
                                if(datos.Data.internalConfig.urlBalancerMain === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                    if(!nodoTarget2.status){   
                                        res.forEach((nodoTarget3: any) => {
                                            if(!nodoTarget2.status && datos.Data.internalConfig.urlBalancerSubs === `${nodoTarget3.nodo.url}:${nodoTarget3.nodo.puerto}` && nodoTarget3.status === true){
                                                acc.push({ source: nodo.id, target: nodoTarget3.nodo.id , color: '#0c7909'});
                                            }
                                        });
                                    }
                                }
                            });
                        }
                        if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data.internalConfig.urlCoordinatorlMain && 
                        nodoTarget.status){
                            acc.push({ source: nodo.id, target: nodoTarget.nodo.id , color: '#8a8c8d'});
                        }
                    });
                }
            }
            return acc;
        }, []);

        this.myChart.setOption({
            series: [{
                data: data.filter((node: any) => node.visible !== false).map((node: any) => ({
                    id: node.id,
                    name: node.name,
                    x: node.x,
                    y: node.y,
                    symbol: `image://assets/map/png/${node.image}`,
                    symbolSize: node.symbolSize,
                    visible: node.visible,
                    tipo_nodo: node.tipo_nodo,
                    url: node.url,
                    puerto: node.puerto
                })),
                links: links.map((link: any) => ({
                    source: String(link.source),
                    target: String(link.target),
                    lineStyle: { 
                        color: link.color, 
                        width: link.color === '#0c7909' ? 4 : 2, 
                        opacity: link.color === '#0c7909' ? 1 : 0.7, 
                        curveness: link.color === '#0c7909' ? 0.1 : 0.13 
                    },
                })),
                edgeSymbol: ['none', 'arrow'],
                edgeSymbolSize: [6, 20]
            }]
        });
        this.datosDelSistema = res;
    }
    
    // Activar conexiones
    conexiones(event: any) {
        this.activarConexiones = event.checked;
        if (!this.activarConexiones) {
            console.log('desactivar conexiones');
            this.myChart.setOption({
                series: [{ links: [] }]
            });
        } else {
            this.http.getNodosOrdenados().subscribe((res: any) => {
                const requests = res.nodos.map((nodo: any) =>
                    this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
                        map((val: any) => ({ nodo: nodo, datos: val, status: true })),
                        catchError(() => of({ nodo: nodo, datos: '', status: false }))
                    )
                );
                forkJoin(requests).subscribe((res: any) => {
                    this.updateGrafo(res);
                });
            });
        }
    }

    //Datos de cada Nodo
    dialogo(tipo: any, id: any, url: any, puerto: any): void {
        const dialogRef = this.dialog.open(Dialog, {
            data: { id: id, tipo: tipo, url: url, puerto: puerto }
        });
    }
}