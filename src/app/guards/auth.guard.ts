import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../servicios/auth.service';
import { filter, map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.authService.rolUsuario$.pipe(
      filter((rol) => rol !== undefined),
      take(1),
      map((rol) => {
        if (rol === null) {
          this.router.navigate(['/login']);
          return false;
        }
        return true;
      })
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class ChoferGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.authService.rolUsuario$.pipe(
      filter((rol) => rol !== undefined),
      take(1),
      map((rol) => {
        if (rol === 'chofer') return true;
        this.router.navigate(['/login']);
        return false;
      })
    );
  }
}