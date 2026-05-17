import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiServiceService {

  constructor( private http:HttpClient) { }

  // Leer del endpoint de debug
  readDebug (url:string): Observable<object> {
    return this.http.post(url+'/sfmp',{UID:0, Type:'REQUEST', Operation:'DEBUG', Data:{} })
  }
}
