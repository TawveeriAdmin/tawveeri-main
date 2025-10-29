// Authentication Form Validation Utilities

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, message: 'emailRequired' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, message: 'emailInvalid' };
  }

  return { isValid: true };
};

export const validatePhone = (phone: string): ValidationResult => {
  if (!phone) {
    return { isValid: false, message: 'phoneRequired' };
  }

  // Saudi phone number format: +966 followed by 9 digits
  const phoneRegex = /^\+966[0-9]{9}$|^05[0-9]{8}$|^5[0-9]{8}$/;
  if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
    return { isValid: false, message: 'phoneInvalid' };
  }

  return { isValid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, message: 'passwordRequired' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'passwordTooShort' };
  }

  // Check for at least one uppercase, one lowercase, and one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return { isValid: false, message: 'passwordWeak' };
  }

  return { isValid: true };
};

export const validatePasswordMatch = (password: string, confirmPassword: string): ValidationResult => {
  if (!confirmPassword) {
    return { isValid: false, message: 'passwordRequired' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, message: 'passwordMismatch' };
  }

  return { isValid: true, message: 'passwordMatch' };
};

export const validateFullName = (fullName: string): ValidationResult => {
  if (!fullName) {
    return { isValid: false, message: 'fullNameRequired' };
  }

  if (fullName.trim().length < 2) {
    return { isValid: false, message: 'fullNameTooShort' };
  }

  return { isValid: true };
};

export const validateOtp = (otp: string): ValidationResult => {
  if (!otp) {
    return { isValid: false, message: 'otpRequired' };
  }

  if (!/^[0-9]{6}$/.test(otp)) {
    return { isValid: false, message: 'otpInvalid' };
  }

  return { isValid: true };
};
