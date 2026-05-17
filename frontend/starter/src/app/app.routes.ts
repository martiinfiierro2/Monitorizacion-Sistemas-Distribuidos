import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { LayoutComponent } from 'app/layout/layout.component';

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const appRoutes: Route[] = [

    // Redirect empty path to '/example'
    {path: '', pathMatch : 'full', redirectTo: 'grafo'},


    // Admin routes
    {
        path: '',
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver
        },
        children: [
            {path: 'grafo', loadChildren: () => import('app/modules/admin/grafo/grafo.routes')},
            {path: 'lista', loadChildren: () => import('app/modules/admin/lista/lista.routes')},
            {path: 'mapa', loadChildren: () => import('app/modules/admin/mapa/mapa.routes')}
        ]
    }
];
