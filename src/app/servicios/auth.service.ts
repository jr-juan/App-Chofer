import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDB } from './firebase.config';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private rolUsuarioSubject = new BehaviorSubject<'admin' | 'chofer' | null>(null);
  public rolUsuario$: Observable<'admin' | 'chofer' | null> = this.rolUsuarioSubject.asObservable();

  constructor(private router: Router) {
    onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        const rol = await this.obtenerRolUsuario(user.uid);
        this.rolUsuarioSubject.next(rol);
      } else {
        this.rolUsuarioSubject.next(null);
      }
    });
  }

  // Getter para el usuario actual
  get currentUser() {
    return firebaseAuth.currentUser;
  }

  async login({ email, password }: any): Promise<any> {
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;
      console.log('Usuario autenticado:', user?.uid);

      if (user) {
        const rol = await this.obtenerRolUsuario(user.uid);
        console.log('Rol obtenido:', rol);
        this.rolUsuarioSubject.next(rol);
      }

      return user;
    } catch (e) {
      console.error('Error en login:', e);
      return null;
    }
  }

  async logout() {
    try {
      await signOut(firebaseAuth);
      this.rolUsuarioSubject.next(null);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  async obtenerRolUsuario(uid: string): Promise<'admin' | 'chofer' | null> {
    try {
      const ref = doc(firebaseDB, `usuarios/${uid}`);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const userData = snap.data() as any;
        return userData['rol'] || 'chofer';
      }
      return null;
    } catch (error) {
      console.error('Error al obtener rol:', error);
      return null;
    }
  }

  get rolActual(): 'admin' | 'chofer' | null {
    return this.rolUsuarioSubject.value;
  }
}