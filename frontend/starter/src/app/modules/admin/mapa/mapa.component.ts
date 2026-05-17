import { Component, ViewEncapsulation, inject, Inject} from '@angular/core';
import { GrafoService } from 'app/services/grafo.service';
import { Dialog } from '../dialogs/dialog.component';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Router } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { timer } from 'rxjs';
import { forkJoin, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import * as L from 'leaflet';
import 'leaflet-polylinedecorator';
import { ConfigService } from 'app/services/config.service';
import { Config } from 'app/services/config.service';
@Component({
    selector     : 'mapa',
    standalone   : true,
    templateUrl  : './mapa.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [
      MatTableModule, 
      MatToolbarModule, 
      MatIconModule, 
      MatInputModule, 
      MatPaginatorModule, 
      MatButtonToggleModule,
      MatButtonModule,
      MatCheckboxModule,
      CommonModule
    ]
})
export class MapaComponent{
  readonly dialog = inject(MatDialog);
  configuracion: Config;
  datosDelSistema: any;
  activarConexiones: boolean = true;
  timerSubscription: any;
  lineas: any;
  iconos: L.Marker[] = [];

  constructor(private http: GrafoService, private config: ConfigService, private router: Router) { }

  map!: L.Map;

  ngOnInit(): void{
    this.initConfig();
  }

  ngOnDestroy(): void {
    if (this.timerSubscription) {
        this.timerSubscription.unsubscribe();
        this.timerSubscription = null;
    }
  }

  conexiones(event: any){
    this.activarConexiones = !event.checked;
    if(!this.activarConexiones){
        console.log('desactivar conexiones')
        if(this.lineas){
          for (const lineas of this.lineas) {
            this.map.removeLayer(lineas)
          }
        }
    }
    else{
        console.log('activar conexiones')
        this.http.getNodos().subscribe((res: any) =>{
            const requests = res.nodos.map((nodo: any) => 
                this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
                    map((val: any) => ({
                        nodo: nodo,
                        datos: val,
                        status: true
                    })),
                    catchError(() => of({
                        nodo: nodo,
                        datos: '',
                        status: false
                    }))
                )
            );
            forkJoin(requests).subscribe((res: any) => {
              this.updateMapa(res);
            });
        });
    }
}


  initConfig(){
    this.config.getConfig().subscribe((res: any) => {
        this.configuracion = res;
        this.initMap();
    });
  }

  comprobar(){
    this.http.getNodos().subscribe((res: any) =>{
    const requests = res.nodos.map((nodo: any) => 
        this.http.readDebug(`${nodo.url}:${nodo.puerto}`).pipe(
            map((val: any) => ({
                nodo: nodo,
                datos: val,
                status: true
            })),
            catchError(() => of({
                nodo: nodo,
                datos: '',
                status: false
            }))
        )
    );
    forkJoin(requests).subscribe((res: any) => {
        let cont = 0;
        if(!this.datosDelSistema){
          console.log("primera carga");
          this.updateMapa(res);
        }
        else{
          for(let x = 0; x < res.length; x++){
            const obj1 = JSON.stringify(res[x].nodo);
            const obj2 = JSON.stringify(this.datosDelSistema[x].nodo);
  
            if (obj1 !== obj2 || res[x].status !== this.datosDelSistema[x].status) {
                console.log(obj1 + obj2)
                cont++;
            }
          }
          if(cont !== 0){
            console.log("cambios: " + cont)
            this.updateMapa(res);
          }
        }
      });
    });
    this.timerSubscription = timer(this.configuracion.espera.valor).subscribe(() => this.comprobar());
  }

  updateMapa(res: any){
    this.iconos.forEach((marker: any) => this.map.removeLayer(marker));
    this.iconos = [];

    res.map((item: any) => {
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
        })
        const marker = L.marker([item.nodo.latitud, item.nodo.longitud], { icon: customIcon }).addTo(this.map);
        
        const { nodo} = item;
        const { tipo_nodo } = nodo;
        marker.bindTooltip(nodo.nombre, { 
          permanent: true, 
          direction: 'bottom',
          offset: [0, 12]  
        });
        marker.on('click', () => this.dialogo(item.nodo.tipo_nodo, item.nodo.id, item.nodo.url, item.nodo.puerto));
        this.iconos.push(marker);
      }
    });

    const links = res.reduce((acc: any[], item2: any) => {
      const { nodo, status, datos } = item2;
                    
        // Enlaces de Balanceadores a Procesadores
        if(this.activarConexiones === true){
          if (nodo.tipo_nodo === 'Balanceador Main' && status === true && nodo.visible) {
            res.forEach((nodoTarget: any) => {
              for(let i = 0; i < datos.Data.balancerList.length; i++){
                if (datos.Data.balancerList[i].url === `${nodoTarget.nodo.url}:${nodoTarget.nodo.puerto}` && nodoTarget.status === true && nodoTarget.nodo.visible) {
                  acc.push({
                    lat1: String(nodo.latitud),
                    lon1: String(nodo.longitud),
                    lat2: String(nodoTarget.nodo.latitud),
                    lon2: String(nodoTarget.nodo.longitud)
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
                      lon2: String(nodoTarget.nodo.longitud)
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
              lon2: String(nodoTarget.nodo.longitud)
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
              lon2: String(nodoTarget.nodo.longitud)
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
              lon2: String(nodoTarget.nodo.longitud)
            });
          }
          else{
            const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlBalancerSubs && n.status === true && n.nodo.visible);
            if(nodoTarget){
              acc.push({
                lat1: String(nodo.latitud),
                lon1: String(nodo.longitud),
                lat2: String(nodoTarget.nodo.latitud),
                lon2: String(nodoTarget.nodo.longitud)
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
                lon2: String(nodoTarget.nodo.longitud)
              });
            }
            else{
              const nodoTarget = res.find((n: any) => `${n.nodo.url}:${n.nodo.puerto}` === datos.Data.internalConfig.urlBalancerSubs && n.status === true && n.nodo.visible);
              if(nodoTarget){
                acc.push({
                  lat1: String(nodo.latitud),
                  lon1: String(nodo.longitud),
                  lat2: String(nodoTarget.nodo.latitud),
                  lon2: String(nodoTarget.nodo.longitud)
                });
              }
            }
          }
        }
      }
      return acc;
    }, [])
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
        color: 'grey',
        weight: 3,
        opacity: 0.7,
      }).addTo(this.map));
    }
    this.lineas = newLinks;
  }

  initMap(): void {
    this.map = L.map('map').setView([this.configuracion.map.latitud, this.configuracion.map.longitud], this.configuracion.map.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
  
    this.comprobar();
  }
 
    irAGrafo(): void {
        this.router.navigate(['/grafo']);
    }

    irALista(): void {
      this.router.navigate(['/lista']);
  }

    dialogo(tipo: any, id: any, url: any, puerto: any): void {
      const dialogRef = this.dialog.open(Dialog, {
        data: {
          id: id,
          tipo: tipo,
          url: url,
          puerto: puerto
        }
      });
    }
}