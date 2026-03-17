import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { environment } from "../../environments/environment";
import { environmentFireBase } from "src/environments/environment.prod";

const app = initializeApp(environmentFireBase.firebaseConfig);

export const firebaseAuth = getAuth(app);
export const firebaseDB = getFirestore(app);
