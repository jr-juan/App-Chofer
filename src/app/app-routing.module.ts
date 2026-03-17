import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard, ChoferGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./paginas/login/login.page.module').then(m => m.LoginPageModule)
  }, 
  {
    path: 'inicio', 
    loadChildren: () => import('./paginas/inicio/inicio.page.module').then(m => m.InicioPageModule),
    canActivate: [ChoferGuard] 
  },  
  {
    path: '**',
    redirectTo: 'login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}