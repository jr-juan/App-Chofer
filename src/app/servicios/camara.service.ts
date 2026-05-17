import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Injectable({
  providedIn: 'root'
})
export class CamaraService {

  async tomarFoto(): Promise<string | null> {
    try {
      const foto = await Camera.getPhoto({
        quality: 10,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        saveToGallery: false,
        width: 512,
        height: 512
      });
      return foto.base64String || null;
    } catch (err) {
      console.error('Error abriendo cámara:', err);
      return null;
    }
  }
}