import { Component, ViewEncapsulation, inject, EventEmitter, Output, Inject, ViewChild } from '@angular/core';
import { GrafoService } from 'app/services/grafo.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { DatePipe } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { ConfigService } from 'app/services/config.service';
import { Config } from 'app/services/config.service';
import { NodeData } from '../lista/lista.component';

export interface procesor {
  UID: string;
  Type: string;
  Operation: string;
  Data: {
    UID: number;
    internalConfig: {
      capacity: number;
      name: string;
      port: number;
      preference: number;
      urlCoordinatorMain: string;
      urlCoordinatorSubs: string;
    };
  };
}
export interface controller{
  UID: string;
  Type: string;
  Operation: string;
  Data: {
    UID: number;
    balancerList: {
      name: string;
      capacity: number;
      url: string;
      load: number;
    }[];
    coordinatorMainMaxAYA: number;
    coordinatorSubsActive: boolean;
    internalConfig: {
      port: number;
      type: string;
      typeRol: string;
      urlBalancerMain: string;
      urlBalancerSubs: string;
      urlCoordinatorlMain: string;
    };
    processorsList: {
      name: string;
      capacity: number;
      url: string;
      preference: number;
      AYACOUNT: number;
      AYAUID: string;
    }[];
    receivedMessages: number;
  };
}
export interface balancer{
  UID: string;
  Type: string;
  Operation: string;
  Data: {
    UID: number;
    balancerList: {
      name: string;
      load: number;
      url: string;
    }[];
    balancerMainMaxAYA: number;
    balancerSubsActive: boolean;
    internalConfig: {
      port: number;
      type: string;
      urlMain: string;
    };
    receivedMessages: number;
  };
}
@Component({
    selector: 'dialogDatos',
    templateUrl: './dialog.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [
      DatePipe
    ],
    imports: [
      MatDialogTitle,
      MatTableModule,
      MatDialogContent,
      MatIconModule,
      MatGridListModule,
      MatButtonModule,
      CommonModule,
    ],
  })
  
  export class Dialog{
    readonly dialogRef = inject(MatDialogRef<Dialog>);
    nodo: NodeData;
    tipo: any;
    configuracion: Config;
    estado_interno: any;
    displayedColumns: string[] = ['name', 'load', 'url'];
    displayedColumns2: string[] = ['name', 'capacity', 'url', 'preference', 'AYACOUNT', 'AYAUID'];
    displayedColumns3: string[] = ['name', 'capacity', 'url', 'load'];
    dataSource: any;
    dataSource2: any;
  
    constructor(private datePipe: DatePipe, private http: GrafoService, private config: ConfigService, @Inject(MAT_DIALOG_DATA) private data: any) {
    }
  
    cerrarDialog(): void {
      this.dialogRef.close();
    }

    ngOnDestroy(): void {
      this.actualizarTiempo();
    }

    async actualizarTiempo(){
      const nodoAct = {
        id: this.nodo.id,
        tipo_nodo: this.nodo.tipo_nodo,
        nombre: this.nodo.nombre,
        url: this.nodo.url,
        puerto: this.nodo.puerto,
        latitud: this.nodo.latitud,
        longitud: this.nodo.longitud,
        visible: this.nodo.visible,
        tiempo: new Date(),
      }
      try {
        await this.http.putNodo(nodoAct);
      } catch (error) {
        console.error('Error al actualizar la visibilidad del nodo', error);
      }
    }

    initConfig(){
      this.config.getConfig().subscribe((res: any) => {
        this.configuracion = res;
      });
    }

    getEstadoInterno(){
      this.http.readDebug(`${this.data.url}:${this.data.puerto}`).subscribe((res: any) => {
        console.log(res)
        if(this.tipo.startsWith('Balanceador')){
          this.estado_interno = res;
          this.dataSource = this.estado_interno.Data.balancerList;
        }
        else if(this.tipo.startsWith('Controlador')){
          this.estado_interno = res;
          this.dataSource = this.estado_interno.Data.balancerList;
          this.dataSource2 = this.estado_interno.Data.processorsList;
        }
        else if(this.tipo === 'Procesador'){
          this.estado_interno = res;
        }
      })
    }
   
    ngOnInit(): void {
      this.getEstadoInterno();
      this.initConfig();
      this.tipo = this.data.tipo;
      this.http.getNodo(this.data.id).subscribe(
        (data) => {
          this.nodo = data.nodo;
          this.nodo.tiempo = this.datePipe.transform(this.nodo.tiempo, 'dd/MM/yyyy HH:mm:ss') || '';
        },
        (error) => {
          console.error('Error al obtener el nodo', error);
        }
      );
    }
  }