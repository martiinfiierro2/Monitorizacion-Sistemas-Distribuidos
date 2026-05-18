import { Component, ViewEncapsulation, OnDestroy, AfterViewInit } from '@angular/core';
import { GrafoService } from 'app/services/grafo.service';
import { CommonModule } from '@angular/common';
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
import * as L from 'leaflet';
import 'leaflet-polylinedecorator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from 'app/services/config.service';

@Component({
    selector: 'grafo',
    standalone: true,
    templateUrl: './grafo.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [
        MatButtonToggleModule, MatIconModule, MatToolbarModule, MatCheckboxModule, 
        MatDialogModule, MatFormFieldModule, MatSelectModule, FormsModule, CommonModule
    ]
})
export class GrafoComponent implements AfterViewInit, OnDestroy {
    configuracion: any;
    activarConexiones: boolean = true;
    repintar: boolean = false;
    activarMapa: boolean = false;
    myChart: any = null;
    map!: L.Map;
    lineas: any;
    iconos: L.Marker[] = [];
    datosDelSistema: any;
    
    // Suscripciones agrupadas para limpieza masiva
    private subscriptions: Subscription = new Subscription();
    private timerSubscription: Subscription | null = null;

    ancho = window.innerWidth;
    alto = window.innerHeight;
    margenZona = 10;
    zonas: Record<string, { xInicio: number; xFin: number }> = {
        "Controlador": { xInicio: 0, xFin: 0.2 * this.ancho },
        "Balanceador": { xInicio: 0.25 * this.ancho, xFin: 0.4 * this.ancho },
        "Procesador": { xInicio: 0.45 * this.ancho, xFin: this.ancho }
    };

    constructor(
        private router: Router, 
        private http: GrafoService, 
        private config: ConfigService, 
        private dialog: MatDialog
    ) {}

    ngAfterViewInit() {
        const configSub = this.config.getConfig().subscribe((res: any) => {
            this.configuracion = res;
            this.initChart();
            this.comprobar();
        });
        this.subscriptions.add(configSub);
    }

    irALista(): void {
        this.router.navigate(['/lista']);
    }

    ngOnDestroy(): void {
        // Limpia todas las suscripciones activas de golpe
        this.subscriptions.unsubscribe();
        if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
        }
        if (this.myChart) {
            this.myChart.dispose();
        }
    }

    mapa(event: any) {
        this.activarMapa = event.checked;
        this.repintar = true;

        // Le damos un respiro de 50ms a Angular para que alterne el [hidden] en el DOM
        setTimeout(() => {
            if (this.activarMapa) {
                // Si el mapa no se ha creado nunca, lo inicializamos
                if (!this.map) {
                    this.initMap();
                } else {
                    // SI YA EXISTÍA: recalculamos tamaño para que no se quede gris/blanco
                    this.map.invalidateSize();
                    this.comprobar();
                }
            } else {
                // Si volvemos al Grafo de ECharts, le pedimos que se readapte al contenedor
                if (this.myChart) {
                    this.myChart.resize();
                }
                this.comprobar();
            }
        }, 50);
    }

    initMap(){
        this.map = L.map('mapa').setView(
            [this.configuracion.map.latitud, this.configuracion.map.longitud], 
            this.configuracion.map.zoom
        );
            
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(this.map);

        this.comprobar();
    }

    initChart(): void {
        const chartSub = this.http.getNodosOrdenados().subscribe((res) => {
            const requests = res.nodos.map((nodo: any) =>
                this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
                    map((val: any) => ({ nodo: nodo, datos: val, status: true })),
                    catchError(() => of({ nodo: nodo, datos: '', status: false }))
                )
            );
            forkJoin(requests).subscribe((resultadoNodos: any) => {
                const chartDom = document.getElementById('grafo');

                
                this.myChart = echarts.init(chartDom!);
                
                // Inicializamos la primera opción del grafo usando la función unificada
                this.updateGrafo(resultadoNodos);

                this.myChart.on('click', (params: any) => {
                    if (params.dataType === 'node') {
                        const data = params.data as any;
                        this.dialogo(data.tipo_nodo, data.id, data.url, data.puerto);
                    }
                });
            });
        });
        this.subscriptions.add(chartSub);
    }

    comprobar() {
        // 1. Rompemos el temporizador anterior para que no se solapen
        if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
        }

        // 2. Pedimos los nodos ordenados al servicio
        const comprobarSub = this.http.getNodosOrdenados().subscribe((res: any) => {
            const requests = res.nodos.map((nodo: any) =>
                this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
                    map((val: any) => ({ nodo: nodo, datos: val, status: true })),
                    catchError(() => of({ nodo: nodo, datos: '', status: false }))
                )
            );
            
            // 3. Lanzamos las peticiones en paralelo para todos los nodos
            forkJoin(requests).subscribe((resFinal: any) => {
                let cont = 0;
                
                // 4. Si ya teníamos datos previos, comparamos el estado actual con el anterior
                if (this.datosDelSistema) {
                    for (let x = 0; x < resFinal.length; x++) {
                        const obj1 = JSON.stringify(resFinal[x].datos?.Data);
                        const obj2 = JSON.stringify(this.datosDelSistema[x]?.datos?.Data);
                        
                        // Si el JSON interno cambió o el estado de conexión (status) varió, sumamos un cambio
                        if (obj1 !== obj2 || resFinal[x].status !== this.datosDelSistema[x].status) {
                            cont++;
                        }
                    }
                } 

                console.log("Cambios detectados en el temporizador: " + cont);

                // 5. SI hay cambios o si se ha activado el flag de 'repintar', actualizamos la interfaz
                if (cont > 0 || this.repintar) {
                    if (this.activarMapa) {
                        console.log('Refrescando vista: Mapa');
                        this.updateMapa(resFinal); 
                    } else {
                        console.log('Refrescando vista: Grafo (ECharts)');
                        this.updateGrafo(resFinal);
                    }
                } else {
                    // Si no hay cambios visuales, igual guardamos los datos nuevos del sistema
                    this.datosDelSistema = resFinal;
                }

                // Resetemos el flag de repintado manual
                this.repintar = false;

                // 6. PLANIFICAMOS LA SIGUIENTE COMPROBACIÓN
                // Solo se programa cuando la petición actual ha terminado por completo (evita inundar el servidor)
                const tiempoEspera = this.configuracion?.espera?.valor || 5000;
                this.timerSubscription = timer(tiempoEspera).subscribe(() => this.comprobar());
            });
        });
        
        this.subscriptions.add(comprobarSub);
    }

    // Procesa los nodos y enlaces comunes para evitar duplicación
    private procesarNodosYEnlaces(res: any) {
        const data = res.map((item: any) => {
            const { nodo, status } = item;
            const { tipo_nodo } = nodo;
            
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
                image, tipo_nodo, url: nodo.url, puerto: nodo.puerto, x, y, visible: nodo.visible 
            };
        });

        const activos = res.filter((item: any) => item.status === true);

        const links = activos.reduce((acc: any[], item2: any) => {
            const { nodo, datos } = item2;

            if (this.activarConexiones) {
                if(nodo.tipo_nodo === 'Balanceador Main'){
                    res.forEach((nodoTarget: any) => {
                        datos.Data?.balancerList?.forEach((bal: any) => {
                            if(bal.url === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}`){
                                acc.push({ source: nodo.id, target: nodoTarget.nodo.id, color: '#0c7909' });
                            }
                        });
                    });
                }
                if(nodo.tipo_nodo === 'Balanceador Subs'){
                    res.forEach((nodoTarget: any) => {
                        if(`${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data?.internalConfig?.urlMain){
                            if(!nodoTarget.status){
                                res.forEach((nodoTarget2: any) => {
                                    datos.Data?.balancerList?.forEach((bal: any) => {
                                        if(bal.url === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                            acc.push({ source: nodo.id, target: nodoTarget2.nodo.id, color: '#0c7909' });
                                        }
                                    });
                                });
                            } else {
                                acc.push({ source: nodo.id, target: nodoTarget.nodo.id , color: '#8a8c8d'});
                            }
                        }
                    });
                }
                if(nodo.tipo_nodo === 'Controlador Main'){
                    res.forEach((nodoTarget: any) => {
                        if(datos.Data?.internalConfig?.urlBalancerMain === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}`){
                            if(nodoTarget.status){
                                acc.push({ source: nodo.id, target: nodoTarget.nodo.id, color: '#0c7909' });
                            } else {
                                res.forEach((nodoTarget2: any) => {
                                    if(datos.Data?.internalConfig?.urlBalancerSubs === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}` && nodoTarget2.status){
                                        acc.push({ source: nodo.id, target: nodoTarget2.nodo.id , color: '#0c7909'});
                                    }
                                });
                            }
                        }
                    });
                }
                if(nodo.tipo_nodo === 'Controlador Subs'){
                    res.forEach((nodoTarget: any) => {
                        const isMainUrl = `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` === datos.Data?.internalConfig?.urlCoordinatorlMain;
                        if(isMainUrl && !nodoTarget.status){
                            res.forEach((nodoTarget2: any) => {
                                if(datos.Data?.internalConfig?.urlBalancerMain === `${nodoTarget2.nodo.url}:${nodoTarget2.nodo.puerto}`){
                                    if(nodoTarget2.status){
                                        acc.push({ source: nodo.id, target: nodoTarget2.nodo.id, color: '#0c7909' });
                                    } else {
                                        res.forEach((nodoTarget3: any) => {
                                            if(datos.Data?.internalConfig?.urlBalancerSubs === `${nodoTarget3.nodo.url}:${nodoTarget3.nodo.puerto}` && nodoTarget3.status){
                                                acc.push({ source: nodo.id, target: nodoTarget3.nodo.id , color: '#0c7909'});
                                            }
                                        });
                                    }
                                }
                            });
                        } else if(isMainUrl && nodoTarget.status){
                            acc.push({ source: nodo.id, target: nodoTarget.nodo.id , color: '#8a8c8d'});
                        }
                    });
                }
            }
            return acc;
        }, []);

        return { data, links };
    }

    updateGrafo(res: any) {
        const { data, links } = this.procesarNodosYEnlaces(res);

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
                        curveness: 0.1 
                    },
                })),
                edgeSymbol: ['none', 'arrow'],
                edgeSymbolSize: [6, 20]
            }]
        };

        this.myChart.setOption(option);
        this.datosDelSistema = res;
    }
    
    conexiones(event: any) {
        this.activarConexiones = event.checked;
        if (!this.activarConexiones) {
            this.myChart.setOption({ series: [{ links: [] }] });
        } else {
            const conexSub = this.http.getNodosOrdenados().subscribe((res: any) => {
                const requests = res.nodos.map((nodo: any) =>
                    this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
                        map((val: any) => ({ nodo: nodo, datos: val, status: true })),
                        catchError(() => of({ nodo: nodo, datos: '', status: false }))
                    )
                );
                forkJoin(requests).subscribe((resFinal: any) => this.updateGrafo(resFinal));
            });
            this.subscriptions.add(conexSub);
        }
    }

    updateMapa(res: any){
        this.iconos.forEach((marker: any) => this.map.removeLayer(marker));
        this.iconos = [];
    
        res.forEach((item: any) => {
          if(item.nodo.visible){
            let iconUrl = item.nodo.tipo_nodo === 'Balanceador Main' ? this.configuracion.balancer.pngMain : 
                          item.nodo.tipo_nodo === 'Controlador Main' ? this.configuracion.controller.pngMain : 
                          item.nodo.tipo_nodo === 'Balanceador Subs' ? this.configuracion.balancer.pngSubs : 
                          item.nodo.tipo_nodo === 'Controlador Subs' ? this.configuracion.controller.pngSubs : 
                          this.configuracion.processor.png;
            if (!item.status) {
              iconUrl = item.nodo.tipo_nodo === 'Balanceador Main' ? this.configuracion.balancer.pngMainDes : 
                        item.nodo.tipo_nodo === 'Controlador Main' ? this.configuracion.controller.pngMainDes : 
                        item.nodo.tipo_nodo === 'Balanceador Subs' ? this.configuracion.balancer.pngSubsDes : 
                        item.nodo.tipo_nodo === 'Controlador Subs' ? this.configuracion.controller.pngSubsDes : 
                        this.configuracion.processor.pngDes;
            }
            const customIcon = L.icon({
              iconUrl: `assets/map/png/${iconUrl}`,
              iconSize: [30, 30],
              popupAnchor: [1, -34]
            });
            const marker = L.marker([item.nodo.latitud, item.nodo.longitud], { icon: customIcon }).addTo(this.map);
            
            marker.bindTooltip(item.nodo.nombre, { 
              permanent: true, 
              direction: 'bottom',
              offset: [0, 12]  
            });
            marker.on('click', () => this.dialogo(item.nodo.tipo_nodo, item.nodo.id, item.nodo.url, item.nodo.puerto));
            this.iconos.push(marker);
          }
        });
    
        // Reconstrucción del fragmento cortado del reduce para mapas
        const links = res.reduce((acc: any[], item2: any) => {
          const { nodo, status, datos } = item2;
                            
          if(this.activarConexiones === true){
            if (nodo.tipo_nodo === 'Balanceador Main' && status === true && nodo.visible) {
                res.forEach((nodoTarget: any) => {
                    for(let i = 0; i < datos.Data.balancerList.length; i++){
                        if (datos.Data.balancerList[i].url === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` && nodoTarget.status === true && nodoTarget.nodo.visible) {
                            acc.push({
                                lat1: String(nodo.latitud),
                                lon1: String(nodo.longitud),
                                lat2: String(nodoTarget.nodo.latitud),
                                lon2: String(nodoTarget.nodo.longitud),
                                color: '#0c7909'
                            });
                        }
                    }
                });
            }
            else if(nodo.tipo_nodo === 'Balanceador Subs' && status === true && datos.Data.balancerSubsActive === true && nodo.visible){
                const nodoMain = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlMain && n.status === true);
                if(!nodoMain){
                    res.forEach((nodoTarget: any) => {
                        for(let i = 0; i < datos.Data.balancerList.length; i++){
                            if (datos.Data.balancerList[i].url === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` && nodoTarget.status === true) {
                                acc.push({
                                    lat1: String(nodo.latitud),
                                    lon1: String(nodo.longitud),
                                    lat2: String(nodoTarget.nodo.latitud),
                                    lon2: String(nodoTarget.nodo.longitud),
                                    color: '#0c7909'
                                });
                            }
                        }
                    });
                }
            }
                    
            // Enlace de Balanceadores "subs" hacia "main"
            if (nodo.tipo_nodo === 'Balanceador Subs' && status === true && nodo.visible) {
                const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlMain && n.status === true && n.nodo.visible);
                if (nodoTarget) {
                    acc.push({
                        lat1: String(nodo.latitud),
                        lon1: String(nodo.longitud),
                        lat2: String(nodoTarget.nodo.latitud),
                        lon2: String(nodoTarget.nodo.longitud),
                        color: '#8a8c8d'
                    });
                }
            }

            // Enlace de Controladores "subs" hacia "main"
            if (nodo.tipo_nodo === 'Controlador Subs' && status === true && nodo.visible) {
            const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlCoordinatorlMain && n.status === true && n.nodo.visible);
                if (nodoTarget) {
                    acc.push({
                        lat1: String(nodo.latitud),
                        lon1: String(nodo.longitud),
                        lat2: String(nodoTarget.nodo.latitud),
                        lon2: String(nodoTarget.nodo.longitud),
                        color: '#8a8c8d'
                    });
                }
            }

            //Controlador --> Balanceador
            if(nodo.tipo_nodo === 'Controlador Main' && status === true && nodo.visible){
            const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlBalancerMain && n.status === true && n.nodo.visible);
                if(nodoTarget){
                    acc.push({
                        lat1: String(nodo.latitud),
                        lon1: String(nodo.longitud),
                        lat2: String(nodoTarget.nodo.latitud),
                        lon2: String(nodoTarget.nodo.longitud),
                        color: '#0c7909'
                    });
                }
                else{
                    const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlBalancerSubs && n.status === true && n.nodo.visible);
                    if(nodoTarget){
                    acc.push({
                        lat1: String(nodo.latitud),
                        lon1: String(nodo.longitud),
                        lat2: String(nodoTarget.nodo.latitud),
                        lon2: String(nodoTarget.nodo.longitud),
                        color: '#0c7909'
                    });
                    }
                }
                }
                else if(nodo.tipo_nodo === 'Controlador Subs' && status === true && nodo.visible){
                const nodoMain = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlCoordinatorlMain && n.status === false && datos.Data.coordinatorSubsActive === true && n.nodo.visible);
                    if(nodoMain){
                        const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlBalancerMain && n.status === true && n.nodo.visible);
                        if(nodoTarget){
                            acc.push({
                                lat1: String(nodo.latitud),
                                lon1: String(nodo.longitud),
                                lat2: String(nodoTarget.nodo.latitud),
                                lon2: String(nodoTarget.nodo.longitud),
                                color: '#0c7909'
                            });
                        }
                        else{
                        const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlBalancerSubs && n.status === true && n.nodo.visible);
                            if(nodoTarget){
                                acc.push({
                                    lat1: String(nodo.latitud),
                                    lon1: String(nodo.longitud),
                                    lat2: String(nodoTarget.nodo.latitud),
                                    lon2: String(nodoTarget.nodo.longitud),
                                    color: '#0c7909'
                                });
                            }
                        }
                    }
                }
            }
            return acc;
        }, []);

        // Aquí puedes renderizar los 'links' en tu objeto Leaflet (ej: L.polyline) si fuese necesario.
        this.updateLineas(links);
        this.datosDelSistema = res;
    }

    updateLineas(links: any){
        let newLinks: any = [];
        if(this.lineas){
          for (const lineas of this.lineas) {
            this.map.removeLayer(lineas)
          }
        }
    
        for (const link of links) {
          const pointA = [link.lat1, link.lon1];
          const pointB = [link.lat2, link.lon2];
    
          newLinks.push(L.polyline([pointA, pointB], {
            color: link.color,
            weight: 3,
            opacity: 0.7,
          }).addTo(this.map));
        }
        this.lineas = newLinks;
    }

    dialogo(tipoNodo: string, nodoId: string, url: string, puerto: string) {
        this.dialog.open(Dialog, {
            data: { tipo: tipoNodo, id: nodoId, url: url, puerto: puerto }
        });
    }
}