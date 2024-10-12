import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/fire";

export const signin = async (email, password) => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, password);
    return res.user;
  } catch (error) {
    return error;
  }
};

export const logout = async () => {
  try {
    auth.signOut();
  } catch (error) {
    console.log(error);

    return error;
  }
};

export const signUp = async (email, password, userData) => {
  try {
    const user = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", user.user.uid), {
      ...userData,
      uid: user.user.uid,
    });
    sendEmailVerification(auth.currentUser);

    return user.user;
  } catch (error) {
    return error;
  }
};
