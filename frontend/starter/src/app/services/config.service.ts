import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, shareReplay, timeout } from 'rxjs';
export interface Config {
    controller: any;
    balancer: any;
    processor: any;
    espera: {
        valor: number;
    };
    map: {
        latitud: number;
        longitud: number;
        zoom: number;
        iconSize?: number;
    };
    apiUrl?: string;
    requestTimeout?: number;
    debugProxy?: boolean;
}
const defaults: Config = { controller: { pngMain: 'cMainAct.png', pngSubs: 'cSubsAct.png', pngMainDes: 'cMainDes.png', pngSubsDes: 'cSubsDes.png' }, balancer: { pngMain: 'bMainAct.png', pngSubs: 'bSubsAct.png', pngMainDes: 'bMainDes.png', pngSubsDes: 'bSubsDes.png' }, processor: { png: 'procesadorAct.png', pngDes: 'procesadorDes.png' }, espera: { valor: 5000 }, map: { latitud: 0, longitud: 0, zoom: 2, iconSize: 60 }, apiUrl: '/api', requestTimeout: 3000, debugProxy: true };
@Injectable({ providedIn: 'root' })
export class ConfigService {
    current = defaults;
    private config$ = this.http.get<Config>('assets/theme/config.json').pipe(timeout(3000), catchError(() => of(defaults)), map(config => this.current = { ...defaults, ...config, map: { ...defaults.map, ...config.map }, espera: { valor: Math.max(200, Number(config.espera?.valor) || 5000) } }), shareReplay(1));
    constructor(private http: HttpClient) { }
    getConfig() { return this.config$; }
}
