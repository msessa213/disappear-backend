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
