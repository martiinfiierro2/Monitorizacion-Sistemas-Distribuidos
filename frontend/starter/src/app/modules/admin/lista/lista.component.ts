import { Component, ViewEncapsulation, inject, EventEmitter, Output, Inject, ViewChild} from '@angular/core';
import { GrafoService } from 'app/services/grafo.service';
import { CommonModule } from '@angular/common';
import { Dialog } from '../dialogs/dialog.component';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatPaginator } from '@angular/material/paginator';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableDataSource } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { ReactiveFormsModule } from '@angular/forms'
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
export interface NodeData {
  id: number,
  tipo_nodo: string;
  nombre: string;
  url: string;
  puerto: string;
  latitud: number;
  longitud: number;
  visible: boolean;
  tiempo: string;
  orden: number;
}

@Component({
    selector     : 'lista',
    standalone   : true,
    templateUrl  : './lista.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [
      MatTableModule, 
      MatToolbarModule, 
      MatIconModule, 
      MatInputModule, 
      MatPaginatorModule, 
      MatButtonToggleModule,
      MatButtonModule,
      CommonModule,
      ReactiveFormsModule,
      MatTooltipModule
    ]
})
export class ListaComponent{
  listaNodos: NodeData[] = [];
  displayedColumns: string[] = ['tipo_nodo', 'nombre', 'url', 'puerto', 'geolocalizacion', 'actions'];
  dataSource = new MatTableDataSource<NodeData>(this.listaNodos);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  readonly dialog = inject(MatDialog);

  constructor(private http: GrafoService, private router: Router) {}

  ngOnInit(): void {
    this.getNodos();
  }

  buscarNodos(datos: any){
    this.http.buscarNodos(datos).subscribe((res: any) =>{
      this.actualizarDataSource(res.nodos)
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  getNodos(){
    this.http.getNodos()
      .subscribe((result) =>{
        this.actualizarDataSource(result.nodos);
    });
  }

  actualizarDataSource(nodos: NodeData[]) {
    this.listaNodos = nodos;
    this.dataSource.data = this.listaNodos;
  }

    irAGrafo(): void {
        this.router.navigate(['/grafo']);
    }

    irAMapa():void{
      this.router.navigate(['/mapa']);
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

    anadirNodo(): void {
      const dialogRef = this.dialog.open(AnadirNodo, {
      });

      dialogRef.componentInstance.dialogClosed.subscribe(() => {
        this.getNodos();
      });
    }

    actualizarNodo(nodo: any): void {
      const dialogRef = this.dialog.open(ActualizarNodo, {
        data: {
          nodo: nodo
        }
      });

      dialogRef.componentInstance.dialogClosed.subscribe(() => {
        this.getNodos();
      });
    }
    
    descargar(): void {
      this.http.getNodos().subscribe(
        (data) => {
          const jsonData = JSON.stringify(data, null, 2);
          const blob = new Blob([jsonData], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
  
          const a = document.createElement('a');
          a.href = url;
          a.download = 'listaNodos.json';
          a.click();
  
          window.URL.revokeObjectURL(url);
        },
        (error) => {
          console.error('Error al descargar el JSON:', error);
        }
      );
    }

    async visible(nodo: any) {
      const nodoAct: NodeData = {
        id: nodo.id,
        tipo_nodo: nodo.tipo_nodo,
        nombre: nodo.nombre,
        url: nodo.url,
        puerto: nodo.puerto,
        latitud: nodo.latitud,
        longitud: nodo.longitud,
        visible: true,
        tiempo: nodo.tiempo,
        orden: nodo.orden
      };

      try {
        await this.http.putNodo(nodoAct);
        this.getNodos();
      } catch (error) {
        console.error('Error al actualizar la visibilidad del nodo', error);
      }
    }
    
    async noVisible(nodo: any){
      const nodoAct: NodeData = {
        id: nodo.id,
        tipo_nodo: nodo.tipo_nodo,
        nombre: nodo.nombre,
        url: nodo.url,
        puerto: nodo.puerto,
        latitud: nodo.latitud,
        longitud: nodo.longitud,
        visible: false,
        tiempo: nodo.tiempo,
        orden: nodo.orden
      }

      try {
        await this.http.putNodo(nodoAct);
        this.getNodos();
      } catch (error) {
        console.error('Error al actualizar la visibilidad del nodo', error);
      }
    }
}
@Component({
  selector: 'dialogDatos',
  templateUrl: '../dialogs/anadirNodo.html',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatIconModule,
    MatGridListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    CommonModule,
    MatDialogModule,
    FormsModule
  ],
})

export class AnadirNodo{
  @Output() dialogClosed = new EventEmitter<void>();

  options = [
    { value: 'Balanceador Main', viewValue: 'Balanceador Main' },
    { value: 'Balanceador Subs', viewValue: 'Balanceador Subs' },
    { value: 'Controlador Main', viewValue: 'Controlador Main' },
    { value: 'Controlador Subs', viewValue: 'Controlador Subs' },
    { value: 'Procesador', viewValue: 'Procesador' },
  ];

  errorPeticion: any = "";
  errorPeticion2: any = "";

  tipoNodo: string;
  puerto: string;
  url: string;
  nombre: string;
  latitud: number;
  longitud: number;
  visible: boolean = true;
  orden: number;

  readonly dialogRef = inject(MatDialogRef<AnadirNodo>);

  constructor(private http: GrafoService){}

  async anadirNodo(){
    const nodoData = {
      tipo_nodo: this.tipoNodo,
      nombre: this.nombre,
      url: this.url,
      puerto: this.puerto,
      latitud: this.latitud,
      longitud: this.longitud,
      visible: this.visible,
      tiempo: Date(),
      orden: this.orden
    }
    try {
      await this.http.postNodo(nodoData);
      this.cerrarDialog();
    } catch (error) {
      this.errorPeticion = "";
      console.log(error)
      if(error.error.errores){
        for(let i = 0; i < error.error.errores.length; i++){
          this.errorPeticion += error.error.errores[i].msg + "\t";
        }
      }
      else{
        this.errorPeticion2 += error.error.msg;
      }
      console.log(this.errorPeticion)
    }
  }

  cerrarDialog(): void {
    this.dialogClosed.emit();
    this.dialogRef.close();
  }
}


@Component({
  selector: 'dialogDatos',
  templateUrl: '../dialogs/actualizarNodo.html',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatIconModule,
    MatGridListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    CommonModule,
    MatDialogModule,
    FormsModule
  ],
})

export class ActualizarNodo{
  @Output() dialogClosed = new EventEmitter<void>();
  nodo: NodeData;

  errorPeticion: any = "";
  errorPeticion2: any = "";

  id: number;
  tipoNodo: string;
  puerto: string;
  url: string;
  nombre: string;
  latitud: number;
  longitud: number;
  visible: boolean;
  tiempo: Date;
  orden: number;

  readonly dialogRef = inject(MatDialogRef<AnadirNodo>);

  constructor(private http: GrafoService, @Inject(MAT_DIALOG_DATA) private data: any){}

  ngOnInit(): void {
    this.http.getNodo(this.data.nodo.id).subscribe(
      (data) => {
        this.nodo = data.nodo
        this.tipoNodo = data.nodo.tipo_nodo;
        this.nombre = data.nodo.nombre;
        this.url = data.nodo.url;
        this.puerto = data.nodo.puerto;
        this.latitud = data.nodo.latitud;
        this.longitud = data.nodo.longitud;
        this.visible = data.nodo.visible;
        this.tiempo = data.nodo.visible;
        this.orden = data.nodo.orden
      },
      (error) => {
        console.error('Error al obtener el nodo', error);
      }
    );
  }

  async actualizarNodo(){
    const nodoAct = {
      id: this.data.nodo.id,
      tipo_nodo: this.tipoNodo,
      nombre: this.nombre,
      url: this.url,
      puerto: this.puerto,
      latitud: this.latitud,
      longitud: this.longitud,
      visible: this.visible,
      tiempo: Date(),
      orden: this.orden,
    }
    
    try { 
      await this.http.putNodo(nodoAct);
      this.cerrarDialog();
    } catch (error) {
      this.errorPeticion = "";
      if(error.error.errores){
        for(let i = 0; i < error.error.errores.length; i++){
          this.errorPeticion += error.error.errores[i].msg + "\t";
        }
      }
      else{
        this.errorPeticion2 += error.error.msg;
      }
      console.log(this.errorPeticion)
    }
  }

  cerrarDialog(): void {
    this.dialogClosed.emit();
    this.dialogRef.close();
  }
}