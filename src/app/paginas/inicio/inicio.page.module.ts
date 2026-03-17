import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { InicioPage } from './inicio.page';

const routes: Routes = [
  {
    path: '',
    component: InicioPage
  }
];

@NgModule({
  declarations: [InicioPage],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes)
  ]
})
export class InicioPageModule {}