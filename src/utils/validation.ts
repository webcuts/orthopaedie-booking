// Validation constants
const NAME_MIN = 2;
const NAME_MAX = 50;
const NAME_PATTERN = /^[a-zA-ZäöüÄÖÜßéèêëàâçñ '\-]+$/;

const EMAIL_MAX = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_MIN = 6;
const PHONE_MAX = 20;
const PHONE_PATTERN = /^[0-9 +\-()]+$/;

const NOTES_MAX = 500;

export function sanitizeInput(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

// Validation functions return translation keys instead of German strings.
// Components translate the returned key via t(key).

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'validation.name.required';
  if (trimmed.length < NAME_MIN) return 'validation.name.tooShort';
  if (trimmed.length > NAME_MAX) return 'validation.name.tooLong';
  if (!NAME_PATTERN.test(trimmed)) return 'validation.name.invalid';
  return null;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'validation.email.required';
  if (trimmed.length > EMAIL_MAX) return 'validation.email.tooLong';
  if (!EMAIL_PATTERN.test(trimmed)) return 'validation.email.invalid';
  return null;
}

export function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null; // Telefon ist optional
  if (trimmed.length < PHONE_MIN) return 'validation.phone.tooShort';
  if (trimmed.length > PHONE_MAX) return 'validation.phone.tooLong';
  if (!PHONE_PATTERN.test(trimmed)) return 'validation.phone.invalid';
  return null;
}

export function validateContactFields(
  email: string,
  phone: string
): { emailError: string | null; phoneError: string | null } {
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();

  if (!trimmedEmail && !trimmedPhone) {
    return {
      emailError: 'validation.contact.required',
      phoneError: 'validation.contact.required',
    };
  }

  let emailError: string | null = null;
  if (trimmedEmail) {
    if (trimmedEmail.length > EMAIL_MAX) emailError = 'validation.email.tooLong';
    else if (!EMAIL_PATTERN.test(trimmedEmail)) emailError = 'validation.email.invalid';
  }

  let phoneError: string | null = null;
  if (trimmedPhone) {
    if (trimmedPhone.length < PHONE_MIN) phoneError = 'validation.phone.tooShort';
    else if (trimmedPhone.length > PHONE_MAX) phoneError = 'validation.phone.tooLong';
    else if (!PHONE_PATTERN.test(trimmedPhone)) phoneError = 'validation.phone.invalid';
  }

  return { emailError, phoneError };
}

export function validateNotes(notes: string): string | null {
  if (!notes) return null;
  if (notes.length > NOTES_MAX) return 'validation.notes.tooLong';
  return null;
}

export const FIELD_LIMITS = {
  NAME_MAX,
  EMAIL_MAX,
  PHONE_MAX,
  NOTES_MAX,
} as const;
