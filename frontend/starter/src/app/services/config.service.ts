import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Config {
  controller: {
    pngMain: string;
    pngSubs: string;
    pngMainDes: string;
    pngSubsDes: string;
    size: number;
  };
  balancer: {
    pngMain: string;
    pngSubs: string;
    pngMainDes: string;
    pngSubsDes: string;
    size: number;
  };
  processor: {
    png: string;
    pngDes: string;
    size: number;
  };
  espera: {
    valor: number;
  };
  map: {
    latitud: number;
    longitud: number;
    zoom: number;
  }
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {

  private configUrl = 'assets/theme/config.json';

  constructor(private http: HttpClient) {}

  getConfig(): Observable<Config> {
    return this.http.get<Config>(this.configUrl);
  }
}
