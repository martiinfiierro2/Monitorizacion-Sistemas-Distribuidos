import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, lastValueFrom, map, timeout } from 'rxjs';
import { ConfigService } from './config.service';
import { CatalogNode, normalizeEndpoint } from './topology';
@Injectable({ providedIn: 'root' })
export class GrafoService {
    urlAPI = '/api';
    constructor(private http: HttpClient, private config: ConfigService) { }
    private get base() { return this.config.current.apiUrl || this.urlAPI; }
    private get options() { const token = sessionStorage.getItem('monitor-token'); return { headers: new HttpHeaders(token ? { Authorization: 'Bearer ' + token } : {}) }; }
    setToken(token: string) { token ? sessionStorage.setItem('monitor-token', token) : sessionStorage.removeItem('monitor-token'); }
    readDebug(url: string): Observable<any> { return this.http.post(normalizeEndpoint(url) + '/sfmp', { UID: 0, Type: 'REQUEST', Operation: 'DEBUG', Data: {} }).pipe(timeout(this.config.current.requestTimeout || 3000)); }
    readNodeDebug(node: CatalogNode): Observable<any> {
        if (this.config.current.debugProxy)
            return this.http.get(this.base + '/nodo/' + node.id + '/debug', this.options).pipe(timeout(this.config.current.requestTimeout || 3000));
        return this.readDebug(normalizeEndpoint(node.url, node.puerto));
    }
    getNodos(): Observable<any> { return this.http.get(this.base + '/nodos', this.options).pipe(timeout(5000)); }
    getNodosOrdenados(): Observable<any> { return this.http.get(this.base + '/nodosOrden', this.options).pipe(timeout(5000)); }
    getNodo(id: any): Observable<any> { return this.http.get(this.base + '/nodo/' + id, this.options).pipe(timeout(5000)); }
    buscarNodos(datos: any): Observable<any> { return String(datos).trim() ? this.http.get(this.base + '/nodos/' + encodeURIComponent(datos), this.options).pipe(timeout(5000)) : this.getNodos(); }
    postNodo(data: any): Promise<any> { return lastValueFrom(this.http.post(this.base + '/nodo', data, this.options).pipe(timeout(5000))); }
    putNodo(data: any): Promise<any> { return lastValueFrom(this.http.put(this.base + '/nodo/' + data.id, data, this.options).pipe(timeout(5000))); }
    deleteNodo(id: number): Promise<any> { return lastValueFrom(this.http.delete(this.base + '/nodo/' + id, this.options).pipe(timeout(5000))); }
    recordQuery(id: number): Observable<any> { return this.http.patch(this.base + '/nodo/' + id + '/consulta', {}, this.options).pipe(timeout(5000)); }
}
