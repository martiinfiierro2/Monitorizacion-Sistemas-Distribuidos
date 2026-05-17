import { Component, OnInit } from '@angular/core';
import { ApiServiceService } from '../../services/api.service.service';
import { timer } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})


export class LandingComponent implements OnInit {

  readTime = 3000;
  idTimer: any;



  // States to show
  mainBalancerState = {
    UID: '', Type: '', Operation: '', Data: {
      UID: '0', balancerSubsActive: false, balancerMainMaxAYA: 0, receivedMessages: 0,
      internalConfig: {
        port: 3100,
        type: "main",
        urlMain: ""
      },
      balancerList: []
    }
  };

  subsBalancerState = {
    UID: '', Type: '', Operation: '', Data: {
      UID: '0', balancerSubsActive: false, balancerMainMaxAYA: 0, receivedMessages: 0,
      internalConfig: {
        port: 3100,
        type: "main",
        urlMain: ""
      },
      balancerList: []
    }
  };

  mainCoordinatorState = {
    UID: '', Type: '', Operation: '', Data: {
      UID: '0', balancerList: [], coordinatorMainMaxAYA: 0, coordinatorSubsActive: false, processorsList: [],
      internalConfig: {
        port: 0,
        type: "main",
        urlBalancerMain: "http://127.0.001:3100",
        urlBalancerSubs: "http://127.0.001:3101",
        urlCoordinatorlMain: ""
      },
      receivedMessages: 0
    }
  };

  subsCoordinatorState = {
    UID: '', Type: '', Operation: '', Data: {
      UID: '0', balancerList: [], coordinatorMainMaxAYA: 0, coordinatorSubsActive: false, processorsList: [],
      internalConfig: {
        port: 0,
        type: "main",
        urlBalancerMain: "http://127.0.001:3100",
        urlBalancerSubs: "http://127.0.001:3101",
        urlCoordinatorlMain: ""
      },
      receivedMessages: 0
    }
  };

  // Creamos un array de procesadores con una estructura interna de procesador
  numProcessors = 3;
  processorsState = Array(this.numProcessors).fill({
    UID: "",
    Type: "",
    Operation: "",
    Data: {
      UID: "",
      internalConfig: {
        name: "",
        port: 0,
        capacity: 0,
        preference: 0,
        urlCoordinatorMain: "",
        urlCoordinatorSubs: ""
      }
    }
  });

  componentsStatus = {
    mainBalancer: false,
    subsBalancer: false,
    mainCoordinator: false,
    subsCoordinator: false,
    processors: Array(this.numProcessors).fill(false)
  }

  localhost = 'http://localhost'
  config = {
    balancerMain: { baseurl: this.localhost, port: 3100, url: this.localhost + ":3100" },
    balancerSubs: { baseurl: this.localhost, port: 3101, url: this.localhost + ":3101" },
    coordinatorMain: { baseurl: this.localhost, port: 3000, url: this.localhost + ":3000" },
    coordinatorSubs: { baseurl: this.localhost, port: 3001, url: this.localhost + ":3001" },
    processor: [{ baseurl: '', port: 0, url: '' }]
  }


  constructor(private http: ApiServiceService) { }

  ngOnInit(): void {
    //console.log('Inicio de Landing');
    // Inicilizamos los datos de los procesadores, puerto y url para consulta
    this.iniProccesors();

    this.updateMainBalancerState();
    this.updateSubsBalancerState();
    this.updateMainCoordinatorState();
    this.updateSubsCoordinatorState();
   
    // Lanzamos un update para cada processor configurado
    this.config.processor.forEach((element , index) => { this.updateProcessors(index); })
    
  }

  // Configuramos los datos de los procesadores
  iniProccesors() {
    const iniPort = 4001;
    this.config.processor.splice(0, this.config.processor.length);
    for (let i = 0; i < this.numProcessors; i++) {
      const newO = { baseurl: this.localhost, port: Number(iniPort + i), url: this.localhost + ":" + Number(iniPort + i) }
      this.config.processor.push(newO);
    }
  }

  show(val: any) {
    return JSON.stringify(val)
  }

  updateProcessors(i:any) {
    //console.log('Inicio updateProcessors:',i);
    this.http.readDebug(this.config.processor[i].url).subscribe({
        next: (val: any) => {
          console.log('Process:',val)
          this.componentsStatus.processors[i] = true;
          this.processorsState[i] = val;
          // Volvemos a programar la lectura
          timer(this.readTime).subscribe(() => this.updateProcessors(i));

        },
        error: (err) => {
          this.componentsStatus.processors[i] = false;
          console.log('updateProcessors no devuelve state')
          // Volvemos a programar la lectura
          timer(this.readTime).subscribe(() => this.updateProcessors(i));
        }
      });
  
  }

  // Actualizar estado de mainBlanacer
  updateMainBalancerState() {
    // console.log('Inicio updateMainBalancerState');
    // Consultamos el balanceador principal
    this.http.readDebug(this.config.balancerMain.url).subscribe({
      next: (val: any) => {
        this.componentsStatus.mainBalancer = true;
        this.mainBalancerState = val;
        //console.log(val.Data.receivedMessages)
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateMainBalancerState());

      },
      error: (err) => {
        this.componentsStatus.mainBalancer = false;
        // console.log('updateMainBalancerState no devuelve state')
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateMainBalancerState());
      }
    });



  }

  // Actualizar estado de subsBalancer
  updateSubsBalancerState() {
    // console.log('Inicio updateSubsBalancerState');
    // Consultamos el balanceador principal
    this.http.readDebug(this.config.balancerSubs.url).subscribe({
      next: (val: any) => {
        this.componentsStatus.subsBalancer = true;
        this.subsBalancerState = val;
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateSubsBalancerState());

      },
      error: (err) => {
        this.componentsStatus.subsBalancer = false;
        // console.log('updateSubsBalancerState no devuelve state')
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateSubsBalancerState());
      }
    }
    );



  }

  // Actualizar estado de mainCoordinator
  updateMainCoordinatorState() {
    // console.log('Inicio updateMainCoordinatorState');
    // Consultamos el balanceador principal
    this.http.readDebug(this.config.coordinatorMain.url).subscribe({
      next: (val: any) => {
        //console.log(val)
        this.componentsStatus.mainCoordinator = true;
        this.mainCoordinatorState = val;
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateMainCoordinatorState());

      },
      error: (err) => {
        this.componentsStatus.mainCoordinator = false;
        // console.log('updateMainCoordinatorState no devuelve state')
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateMainCoordinatorState());
      }
    }
    );



  }

  // Actualizar estado subsCoordinator
  updateSubsCoordinatorState() {
    // console.log('Inicio updateSubsCoordinatorState');
    // Consultamos el balanceador principal
    this.http.readDebug(this.config.coordinatorSubs.url).subscribe({
      next: (val: any) => {
        this.componentsStatus.subsCoordinator = true;
        this.subsCoordinatorState = val;
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateSubsCoordinatorState());

      },
      error: (err) => {
        this.componentsStatus.subsCoordinator = false;
        // console.log('updateSubsCoordinatorState no devuelve state')
        // Volvemos a programar la lectura
        timer(this.readTime).subscribe(() => this.updateSubsCoordinatorState());
      }
    }
    );



  }



}
