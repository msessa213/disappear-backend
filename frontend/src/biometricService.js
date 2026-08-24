import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from 'capacitor-biometric-authentication';

export const checkBiometricAvailability = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await BiometricAuth.isAvailable();
      return info.hasBiometrics || info.isAvailable || false;
    }
    if (typeof window !== 'undefined' && window.PublicKeyCredential && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
      return true;
    }
  } catch (e) {
    console.warn("Biometrics availability check error:", e);
  }
  return false;
};

export const promptBiometricAuth = async (reason = "Authenticate to decrypt Disappear Vault") => {
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await BiometricAuth.authenticate({
        reason: reason,
        cancelTitle: "Use Password Instead",
        allowDeviceCredential: true
      });
      return res.authenticated || res.success || true;
    }
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      return true;
    }
  } catch (e) {
    console.error("Biometric authentication error:", e);
    throw e;
  }
  return false;
};

export const enableBiometricLogin = (userId, email) => {
  try {
    if (!userId) return;
    localStorage.setItem("disappear_biometrics_enabled", "true");
    localStorage.setItem("disappear_biometric_uid", userId);
    if (email) localStorage.setItem("disappear_biometric_email", email);
  } catch (e) {
    console.warn("Error enabling biometric storage:", e);
  }
};

export const disableBiometricLogin = () => {
  try {
    localStorage.removeItem("disappear_biometrics_enabled");
    localStorage.removeItem("disappear_biometric_uid");
    localStorage.removeItem("disappear_biometric_email");
  } catch (e) {
    console.warn("Error clearing biometric storage:", e);
  }
};

export const getBiometricCredentials = () => {
  try {
    const enabled = localStorage.getItem("disappear_biometrics_enabled") === "true";
    const uid = localStorage.getItem("disappear_biometric_uid");
    const email = localStorage.getItem("disappear_biometric_email");
    if (enabled && uid) {
      return { uid, email };
    }
  } catch (e) {
    console.warn("Error getting biometric credentials:", e);
  }
  return null;
};

export const isBiometricEnabled = () => {
  return !!getBiometricCredentials();
};
