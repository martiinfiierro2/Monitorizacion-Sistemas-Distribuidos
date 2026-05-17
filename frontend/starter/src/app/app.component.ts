import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
    selector   : 'app-root',
    templateUrl: './app.component.html',
    styleUrls  : ['./app.component.scss'],
    standalone : true,
    imports    : [
        MatSidenavModule,
        MatListModule,
        MatToolbarModule,
        MatIconModule,
        RouterModule,
        RouterOutlet
    ],
})
export class AppComponent
{
    /**
     * Constructor
     */
    constructor()
    {
    }
}
