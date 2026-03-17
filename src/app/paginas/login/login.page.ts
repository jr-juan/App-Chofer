import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../servicios/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.css'],
})
export class LoginPage {
  email = '';
  password = '';

  constructor(private authService: AuthService, private router: Router) {}

 async iniciarSesion() {
  if (!this.email || !this.password) {
    alert('Por favor, ingresa correo y contraseña.');
    return;
  }

  const user = await this.authService.login({
    email: this.email,
    password: this.password,
  });

  console.log('Usuario:', user);
  console.log('Rol actual:', this.authService.rolActual);

  if (user) {
    const rol = this.authService.rolActual;
    console.log('Redirigiendo con rol:', rol);
    if (rol === 'chofer') {
      this.router.navigate(['/inicio']);
    } else {
      alert('No tienes permisos para acceder a esta aplicación.');
      await this.authService.logout();
    }
  } else {
    alert('Error en el correo o la contraseña. Por favor, inténtalo de nuevo.');
  }
}
}