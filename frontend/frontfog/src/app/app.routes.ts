import { Routes } from '@angular/router';
import { MainComponent } from './layouts/main/main.component';
import { LandingComponent } from './pages/landing/landing.component';

export const routes: Routes = [
    {path:'', component: MainComponent,
        children: [
           { path:'', component: LandingComponent }
        ]
    },
    //{ path: '',   redirectTo: '/first-component', pathMatch: 'full' }
    { path: '**', redirectTo: '/', pathMatch: 'full' }
];
